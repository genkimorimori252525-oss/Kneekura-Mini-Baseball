import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import type { PitchWorldState } from './BatBallContact';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
  resolveRigidBatBallContact,
  sampleBatEffectiveMass,
  sampleBatRadius,
  type BatRadiusProfile,
  type RigidBatState,
} from './RigidBatBallContact';

const v = (x: number, y: number, z: number): Vec3 => ({
  x,
  y,
  z,
});

const profile: BatRadiusProfile = {
  knots: [
    { t: 0, radiusM: 0.025 },
    { t: 0.35, radiusM: 0.027 },
    { t: 0.7, radiusM: 0.034 },
    { t: 1, radiusM: 0.033 },
  ],
};

const bat = (
  centerOfMassT = 0.6,
): RigidBatState => ({
  pose: {
    grip: v(-0.45, 1, 0),
    tip: v(0.45, 1, 0),
  },
  centerOfMassVelocity: v(0, 0, 20),
  angularVelocity: v(0, 0, 0),
  physical: {
    massKg: 0.9,
    centerOfMassT,
    transverseMomentOfInertiaKgM2: 0.06,
    axialMomentOfInertiaKgM2: 0.00055,
    radiusProfile: profile,
  },
});

const parameters = {
  normalRestitution: 0.5,
  tangentialRestitution: 0,
  frictionCoefficient: 0.35,
} as const;

const pitchAt = (
  x: number,
  y = 1,
  spin: Vec3 = v(0, 0, 0),
): PitchWorldState => {
  const segmentT = (x + 0.45) / 0.9;
  const localRadius = sampleBatRadius(
    profile,
    segmentT,
  );
  return {
    tick: 2_000_000,
    position: v(
      x,
      y,
      localRadius
        + REFERENCE_BASEBALL_RIGID_BODY.radiusM
        - 1e-6,
    ),
    velocity: v(0, 0, -40),
    spin,
  };
};

const speed = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

describe('rigid bat-ball reduced-order contact', () => {
  it('interpolates a tapered/torpedo-capable radius profile', () => {
    expect(sampleBatRadius(profile, 0)).toBeCloseTo(0.025, 12);
    expect(sampleBatRadius(profile, 0.525)).toBeCloseTo(0.0305, 12);
    expect(sampleBatRadius(profile, 0.7)).toBeCloseTo(0.034, 12);
    expect(sampleBatRadius(profile, 1)).toBeCloseTo(0.033, 12);
  });


  it('interpolates an empirical dynamic effective-mass profile without deformation state', () => {
    const effectiveMassProfile = {
      knots: [
        { t: 0, effectiveMassKg: 0.4 },
        { t: 0.5, effectiveMassKg: 0.7 },
        { t: 1, effectiveMassKg: 0.5 },
      ],
    } as const;

    expect(
      sampleBatEffectiveMass(
        effectiveMassProfile,
        0.25,
      ),
    ).toBeCloseTo(0.55, 12);
    expect(
      sampleBatEffectiveMass(
        effectiveMassProfile,
        0.75,
      ),
    ).toBeCloseTo(0.6, 12);
  });

  it('can use measured dynamic effective mass instead of pretending the bat is perfectly rigid', () => {
    const inputPitch = pitchAt(0.09);
    const rigid = resolveRigidBatBallContact(
      inputPitch,
      bat(),
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );
    const reducedDynamicBat: RigidBatState = {
      ...bat(),
      physical: {
        ...bat().physical,
        normalEffectiveMassProfile: {
          knots: [
            { t: 0, effectiveMassKg: 0.45 },
            { t: 1, effectiveMassKg: 0.45 },
          ],
        },
      },
    };
    const dynamic = resolveRigidBatBallContact(
      inputPitch,
      reducedDynamicBat,
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );

    expect(rigid).not.toBeNull();
    expect(dynamic).not.toBeNull();
    expect(rigid!.normalEffectiveMassSource)
      .toBe('rigid_body');
    expect(dynamic!.normalEffectiveMassSource)
      .toBe('dynamic_profile');
    expect(dynamic!.batRecoilModel)
      .toBe('rigid_projection_only');
    expect(dynamic!.batNormalEffectiveMassKg)
      .toBeCloseTo(0.45, 12);
    expect(dynamic!.normalImpulseNs)
      .toBeLessThan(rigid!.normalImpulseNs);
  });

  it('is deterministic for identical physical inputs', () => {
    const inputPitch = pitchAt(0.09);
    const inputBat = bat();

    const a = resolveRigidBatBallContact(
      inputPitch,
      inputBat,
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );
    const b = resolveRigidBatBallContact(
      inputPitch,
      inputBat,
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );

    expect(a).not.toBeNull();
    expect(a).toEqual(b);
  });

  it('gets a larger normal impulse near the bat COM than far from it', () => {
    const nearCom = resolveRigidBatBallContact(
      pitchAt(0.09),
      bat(),
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );
    const farFromCom = resolveRigidBatBallContact(
      pitchAt(0.38),
      bat(),
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );

    expect(nearCom).not.toBeNull();
    expect(farFromCom).not.toBeNull();
    expect(nearCom!.effectiveNormalMassKg)
      .toBeGreaterThan(farFromCom!.effectiveNormalMassKg);
    expect(nearCom!.normalImpulseNs)
      .toBeGreaterThan(farFromCom!.normalImpulseNs);
    expect(speed(nearCom!.exitVelocity))
      .toBeGreaterThan(speed(farFromCom!.exitVelocity));
  });

  it('uses incoming ball surface spin in tangential contact', () => {
    const noSpin = resolveRigidBatBallContact(
      pitchAt(0.09),
      bat(),
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );
    const incomingSpin = resolveRigidBatBallContact(
      pitchAt(0.09, 1, v(-180, 0, 0)),
      bat(),
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );

    expect(noSpin).not.toBeNull();
    expect(incomingSpin).not.toBeNull();
    expect(noSpin!.tangentialRelativeSpeedBeforeMps)
      .toBeCloseTo(0, 12);
    expect(incomingSpin!.tangentialRelativeSpeedBeforeMps)
      .toBeGreaterThan(0);
    expect(incomingSpin!.exitSpin)
      .not.toEqual(v(-180, 0, 0));
  });

  it('creates launch-angle change from geometric vertical offset without a result label', () => {
    const center = pitchAt(0.09);
    const localRadius = sampleBatRadius(
      profile,
      (0.09 + 0.45) / 0.9,
    );
    const combinedRadius =
      localRadius + REFERENCE_BASEBALL_RIGID_BODY.radiusM;
    const yOffset = 0.025;
    const zOffset = Math.sqrt(
      combinedRadius * combinedRadius
      - yOffset * yOffset,
    );

    const upperPitch: PitchWorldState = {
      ...center,
      position: v(
        0.09,
        1 + yOffset,
        zOffset - 1e-6,
      ),
    };
    const upper = resolveRigidBatBallContact(
      upperPitch,
      bat(),
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );
    const squared = resolveRigidBatBallContact(
      center,
      bat(),
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );

    expect(upper).not.toBeNull();
    expect(squared).not.toBeNull();
    expect(upper!.exitVelocity.y)
      .toBeGreaterThan(squared!.exitVelocity.y);
  });

  it('recoils the bat instead of treating it as an infinite-mass velocity source', () => {
    const result = resolveRigidBatBallContact(
      pitchAt(0.38),
      bat(),
      REFERENCE_BASEBALL_RIGID_BODY,
      parameters,
    );

    expect(result).not.toBeNull();
    expect(result!.batExitCenterOfMassVelocity)
      .not.toEqual(bat().centerOfMassVelocity);
    expect(result!.batExitAngularVelocity)
      .not.toEqual(bat().angularVelocity);
  });
});
