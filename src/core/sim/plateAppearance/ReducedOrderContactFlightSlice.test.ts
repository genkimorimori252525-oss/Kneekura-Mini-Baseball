import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
} from '../ball/BallFlight';
import type { PitchWorldState } from '../contact/BatBallContact';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
  sampleBatRadius,
  type BatRadiusProfile,
  type RigidBatState,
} from '../contact/RigidBatBallContact';
import {
  simulateReducedOrderContactFlightSlice,
} from './ReducedOrderContactFlightSlice';

const v = (x: number, y: number, z: number): Vec3 => ({
  x,
  y,
  z,
});

const radiusProfile: BatRadiusProfile = {
  knots: [
    { t: 0, radiusM: 0.025 },
    { t: 0.65, radiusM: 0.033 },
    { t: 1, radiusM: 0.033 },
  ],
};

const bat: RigidBatState = {
  pose: {
    grip: v(-0.45, 1, 0),
    tip: v(0.45, 1, 0),
  },
  centerOfMassVelocity: v(0, 0, 20),
  angularVelocity: v(0, 0, 0),
  physical: {
    massKg: 0.9,
    centerOfMassT: 0.6,
    transverseMomentOfInertiaKgM2: 0.06,
    axialMomentOfInertiaKgM2: 0.00055,
    radiusProfile,
  },
};

const contactParameters = {
  normalRestitution: 0.5,
  tangentialRestitution: 0,
  frictionCoefficient: 0.35,
} as const;

const pitch = (): PitchWorldState => {
  const x = 0.09;
  const t = (x + 0.45) / 0.9;
  return {
    tick: 3_000_000,
    position: v(
      x,
      1,
      sampleBatRadius(radiusProfile, t)
        + REFERENCE_BASEBALL_RIGID_BODY.radiusM
        - 1e-6,
    ),
    velocity: v(0, 0, -40),
    spin: v(-120, 0, 0),
  };
};

const flightParameters = {
  ...REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
  aerodynamics: {
    ...REFERENCE_BASEBALL_AERODYNAMICS,
    ballMassKg: REFERENCE_BASEBALL_RIGID_BODY.massKg,
    ballRadiusM: REFERENCE_BASEBALL_RIGID_BODY.radiusM,
  },
};

describe('reduced-order contact -> aerodynamic flight slice', () => {
  it('feeds physical collision output directly into canonical flight state', () => {
    const result = simulateReducedOrderContactFlightSlice({
      pitch: pitch(),
      bat,
      ball: REFERENCE_BASEBALL_RIGID_BODY,
      contactParameters,
      flightParameters,
      durationTicks: 200_000,
      cadenceTicks: 50_000,
    });

    expect(result.initialBall.tick)
      .toBe(result.contact.tick);
    expect(result.initialBall.velocity)
      .toEqual(result.contact.exitVelocity);
    expect(result.initialBall.spin)
      .toEqual(result.contact.exitSpin);
    expect(result.samples).toHaveLength(5);
    expect(result.samples[0])
      .toEqual(result.initialBall);
  });

  it('is deterministic through collision and aerodynamic integration', () => {
    const input = {
      pitch: pitch(),
      bat,
      ball: REFERENCE_BASEBALL_RIGID_BODY,
      contactParameters,
      flightParameters,
      durationTicks: 300_000,
      cadenceTicks: 50_000,
    } as const;

    const a = simulateReducedOrderContactFlightSlice(input);
    const b = simulateReducedOrderContactFlightSlice(input);

    expect(a).toEqual(b);
  });

  it('rejects inconsistent ball dimensions instead of silently changing physics', () => {
    expect(() => simulateReducedOrderContactFlightSlice({
      pitch: pitch(),
      bat,
      ball: REFERENCE_BASEBALL_RIGID_BODY,
      contactParameters,
      flightParameters: {
        ...flightParameters,
        ballRadius: 0.04,
      },
      durationTicks: 100_000,
      cadenceTicks: 50_000,
    })).toThrow(
      'flight ballRadius must match rigid contact ball radius',
    );
  });
});
