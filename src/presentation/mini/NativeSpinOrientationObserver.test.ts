import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/model/geometry';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../../core/sim/ball/BaseballAerodynamics';
import { NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE } from '../../core/sim/ball/BaseballSpinDecay';
import {
  sampleAerodynamicPitchTrajectory,
  sampleAerodynamicPitchOrientation,
  type AerodynamicPitchTrajectory,
} from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import {
  IDENTITY_QUATERNION,
  multiplyQuaternions,
  quaternionFromAxisAngle,
  rotateVectorByQuaternion,
  type Quaternion,
} from '../../core/sim/pitching/BaseballOrientation';
import { createOpticalBaseballGlyph } from './OpticalBaseballGlyph';
import { createNativeSpinOrientationObserver } from './NativeSpinOrientationObserver';

const RELEASE = 1_000_000;
const TICKS_PER_SECOND = 1_000_000;
const RPM_TO_RAD_PER_SECOND = 2 * Math.PI / 60;
const spinRpm = (rpm: number) => rpm * RPM_TO_RAD_PER_SECOND;
const localSeam = { x: 1, y: 0, z: 0 };
const SHUTTER_120FPS = Math.round(TICKS_PER_SECOND / 120);
const SHUTTER_60FPS = Math.round(TICKS_PER_SECOND / 60);

function flight(
  spin: Vec3,
  options: Readonly<{
    durationTicks?: number;
    releaseOrientation?: Quaternion;
    spinDecay?: boolean;
    referenceSpeed?: number;
    referenceTimeConstant?: number;
    integrationStepTicks?: number;
  }> = {},
): AerodynamicPitchTrajectory {
  const aerodynamic = {
    ...REFERENCE_BASEBALL_AERODYNAMICS,
    // Retain constant flight speed when testing exact analytic spin decay.
    // This is an explicit input to the existing physical source, not a UI
    // correction or a fake angular-velocity estimate.
    airDensityKgM3: 0,
    dragCoefficient: 0,
    spinDecay: options.spinDecay
      ? {
          referenceSpeedMps: options.referenceSpeed ?? 40,
          timeConstantSecondsAtReferenceSpeed: options.referenceTimeConstant ?? 0.25,
        }
      : undefined,
  };
  return {
    start: {
      tick: RELEASE,
      position: { x: 0, y: 1.45, z: 18 },
      velocity: { x: 0, y: 0, z: -40 },
      spin,
    },
    endTick: RELEASE + (options.durationTicks ?? 350_000),
    parameters: {
      ticksPerSecond: TICKS_PER_SECOND,
      integrationStepTicks: options.integrationStepTicks ?? 1_000,
      gravityY: 0,
      aerodynamics: aerodynamic,
    },
    ...(options.releaseOrientation !== undefined
      ? { releaseOrientation: options.releaseOrientation }
      : {}),
  };
}

function nearQuaternion(
  observed: Quaternion,
  expected: Quaternion,
  precision = 10,
): void {
  // Quaternions q and -q encode identical physical orientation.
  const dot = observed.w * expected.w + observed.x * expected.x
    + observed.y * expected.y + observed.z * expected.z;
  const sign = dot < 0 ? -1 : 1;
  expect(observed.w).toBeCloseTo(sign * expected.w, precision);
  expect(observed.x).toBeCloseTo(sign * expected.x, precision);
  expect(observed.y).toBeCloseTo(sign * expected.y, precision);
  expect(observed.z).toBeCloseTo(sign * expected.z, precision);
  expect(Math.hypot(observed.w, observed.x, observed.y, observed.z)).toBeCloseTo(1, 12);
}

describe('Native physical-spin material orientation and read-only high-frequency observation', () => {
  it.each([800, 2200])('%i rpm input gives exact constant world-axis material rotation, not a static seam pose', rpm => {
    const radiansPerSecond = spinRpm(rpm);
    const reference = quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 6);
    const trajectory = flight({ x: 0, y: radiansPerSecond, z: 0 }, {
      releaseOrientation: reference,
    });
    const observer = createNativeSpinOrientationObserver({ trajectory });
    const release = observer.sampleAtTick(RELEASE, { shutterTicks: 0 });
    const at = RELEASE + 31_000;
    const next = observer.sampleAtTick(at, {
      shutterTicks: SHUTTER_120FPS,
      previousFrameTick: at - SHUTTER_120FPS,
    });
    nearQuaternion(release.orientationMaterialToWorld, reference);
    const expected = multiplyQuaternions(
      quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, radiansPerSecond * 0.031),
      reference,
    );
    nearQuaternion(next.orientationMaterialToWorld, expected, 9);
    expect(next.angularVelocityWorldRadPerSecond).toEqual({
      x: 0, y: radiansPerSecond, z: 0,
    });
    expect(next.angularSpeedRadPerSecond).toBeCloseTo(radiansPerSecond, 11);
    expect(next.spinAxisWorld).toEqual({ x: 0, y: 1, z: 0 });
    expect(next.angularTravelSinceReleaseRadians).toBeCloseTo(radiansPerSecond * 0.031, 10);
    expect(next.elapsedSecondsSinceRelease).toBe(0.031);
    expect(next.orientationProvenance).toBe('native_source_release_orientation');
    expect(next.hasSourceReleaseOrientation).toBe(true);
    expect(next.authority).toBe('PRESENTATION_ONLY_NATIVE_SPIN');
    expect(next.orientationMaterialToWorld).not.toEqual(release.orientationMaterialToWorld);
    expect('rpm' in next).toBe(false);
    expect(next.shutter.openTick).toBeGreaterThan(RELEASE);
    expect(next.shutter.openTick).toBeLessThan(at);
    expect(next.shutter.closeTick).toBeGreaterThan(at);
    expect(next.shutter.angularTravelRadians)
      .toBeCloseTo(radiansPerSecond * SHUTTER_120FPS / TICKS_PER_SECOND, 8);
    expect(next.shutter.rotationsDuringExposure)
      .toBeCloseTo(next.shutter.angularTravelRadians / (2 * Math.PI), 12);
  });

  it('pre-multiplies world-space angular velocity with a noncommuting release orientation', () => {
    const reference = quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 3);
    const speed = spinRpm(800);
    const trajectory = flight({ x: 0, y: 0, z: speed }, { releaseOrientation: reference });
    const result = createNativeSpinOrientationObserver({ trajectory })
      .sampleAtTick(RELEASE + 11_000, { shutterTicks: 0 });
    const worldThenBody = multiplyQuaternions(
      quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, speed * 0.011),
      reference,
    );
    const bodyThenWorld = multiplyQuaternions(
      reference,
      quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, speed * 0.011),
    );
    nearQuaternion(result.orientationMaterialToWorld, worldThenBody, 10);
    const point = rotateVectorByQuaternion(localSeam, result.orientationMaterialToWorld);
    const wrongPoint = rotateVectorByQuaternion(localSeam, bodyThenWorld);
    expect(Math.hypot(point.x - wrongPoint.x, point.y - wrongPoint.y, point.z - wrongPoint.z))
      .toBeGreaterThan(0.3);
    expect(result.spinAxisWorld).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('uses source identity only as an uncalibrated display convention when material release phase is missing', () => {
    const trajectory = flight({ x: spinRpm(800), y: 0, z: 0 });
    const observer = createNativeSpinOrientationObserver({ trajectory });
    const initial = observer.sampleAtTick(RELEASE, { shutterTicks: 0 });
    const later = observer.sampleAtTick(RELEASE + 10_000, { shutterTicks: 0 });
    expect(initial.orientationMaterialToWorld).toEqual(IDENTITY_QUATERNION);
    expect(initial.orientationProvenance).toBe('identity_display_convention_uncalibrated');
    expect(initial.hasSourceReleaseOrientation).toBe(false);
    expect(later.orientationMaterialToWorld).not.toEqual(IDENTITY_QUATERNION);
    const orientation = later.orientationMaterialToWorld;
    nearQuaternion(orientation,
      quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, spinRpm(800) * 0.01));
    // A reference/uncalibrated identity must NOT silently be advertised to
    // the existing optical glyph as an authenticated canonical seam phase.
    expect(createOpticalBaseballGlyph({
      camera: 'pitcher', projectedDiameterPx: 8,
      hasCanonicalOrientation: later.hasSourceReleaseOrientation,
    }).showSeams).toBe(false);
    const real = createNativeSpinOrientationObserver({
      trajectory: { ...trajectory, releaseOrientation: IDENTITY_QUATERNION },
    }).sampleAtTick(RELEASE + 10_000, { shutterTicks: 0 });
    expect(real.hasSourceReleaseOrientation).toBe(true);
    expect(real.orientationMaterialToWorld).toEqual(later.orientationMaterialToWorld);
    expect(createOpticalBaseballGlyph({
      camera: 'pitcher', projectedDiameterPx: 8,
      hasCanonicalOrientation: real.hasSourceReleaseOrientation,
    }).showSeams).toBe(true);
  });

  it('tracks actual Native RK4 spin decay at every observed tick instead of integrating release rpm forever', () => {
    const initialOmega = spinRpm(2200);
    const tau = 0.25;
    const trajectory = flight({ x: 0, y: initialOmega, z: 0 }, {
      durationTicks: 350_000,
      releaseOrientation: IDENTITY_QUATERNION,
      spinDecay: true,
      referenceTimeConstant: tau,
    });
    const observer = createNativeSpinOrientationObserver({ trajectory });
    const times = [RELEASE, RELEASE + 25_000, RELEASE + 50_000,
      RELEASE + 175_000, RELEASE + 300_000];
    const frames = observer.sampleFrameTicks(times, { shutterTicks: 5_000 });
    for (let index = 0; index < times.length; index++) {
      const observed = frames[index];
      const physical = sampleAerodynamicPitchTrajectory(trajectory, times[index]);
      expect(observed.angularVelocityWorldRadPerSecond).toEqual(physical.spin);
      expect(observed.angularSpeedRadPerSecond).toBeCloseTo(
        initialOmega * Math.exp(-observed.elapsedSecondsSinceRelease / tau), 8,
      );
      const analyticAngle = initialOmega * tau
        * (1 - Math.exp(-observed.elapsedSecondsSinceRelease / tau));
      expect(observed.angularTravelSinceReleaseRadians).toBeCloseTo(analyticAngle, 5);
      nearQuaternion(observed.orientationMaterialToWorld,
        quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, analyticAngle), 5);
      if (index > 0) {
        expect(observed.angularSpeedRadPerSecond)
          .toBeLessThan(frames[index - 1].angularSpeedRadPerSecond);
        expect(observed.angularTravelSinceReleaseRadians)
          .toBeGreaterThan(frames[index - 1].angularTravelSinceReleaseRadians);
        expect(observed.tick).toBeGreaterThan(frames[index - 1].tick);
      }
    }
    const last = frames.at(-1)!;
    const legacyConstantOmega = sampleAerodynamicPitchOrientation(
      trajectory, last.elapsedSecondsSinceRelease,
    )!;
    const physicalRotation = rotateVectorByQuaternion(localSeam, last.orientationMaterialToWorld);
    const constantOmegaRotation = rotateVectorByQuaternion(localSeam, legacyConstantOmega);
    expect(Math.hypot(
      physicalRotation.x - constantOmegaRotation.x,
      physicalRotation.z - constantOmegaRotation.z,
    )).toBeGreaterThan(0.01);
    expect(last.shutter.angularTravelRadians).toBeLessThan(
      createNativeSpinOrientationObserver({
        trajectory: flight({ x: 0, y: initialOmega, z: 0 }, {
          releaseOrientation: IDENTITY_QUATERNION,
        }),
      }).sampleAtTick(last.tick, { shutterTicks: 5_000 }).shutter.angularTravelRadians,
    );
    expect(trajectory.start.spin.y).toBe(initialOmega);
  });

  it('works with the named Native Nathan spin-decay estimate without inventing a calibrated spin rate', () => {
    const trajectory = flight({ x: 12, y: spinRpm(800), z: 0 }, {
      releaseOrientation: IDENTITY_QUATERNION,
    });
    const withNativeEstimate: AerodynamicPitchTrajectory = {
      ...trajectory,
      parameters: {
        ...trajectory.parameters,
        aerodynamics: {
          ...REFERENCE_BASEBALL_AERODYNAMICS,
          spinDecay: NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
        },
      },
    };
    const finalTick = RELEASE + 200_000;
    const observed = createNativeSpinOrientationObserver({
      trajectory: withNativeEstimate,
    }).sampleAtTick(finalTick, { shutterTicks: 10_000 });
    const physical = sampleAerodynamicPitchTrajectory(withNativeEstimate, finalTick);
    expect(observed.angularVelocityWorldRadPerSecond).toEqual(physical.spin);
    expect(observed.angularSpeedRadPerSecond)
      .toBeLessThan(Math.hypot(trajectory.start.spin.x, trajectory.start.spin.y));
    expect(observed.shutter.angularTravelRadians).toBeGreaterThan(0);
    expect(observed.spinAxisWorld!.x).toBeGreaterThan(0);
    expect(Math.hypot(
      observed.orientationMaterialToWorld.w,
      observed.orientationMaterialToWorld.x,
      observed.orientationMaterialToWorld.y,
      observed.orientationMaterialToWorld.z,
    )).toBeCloseTo(1, 12);
  });

  it('is exactly source-clock invariant to render shot schedule, viewport, exposure, and call order', () => {
    const trajectory = flight({ x: 23, y: spinRpm(2200), z: -7 }, {
      releaseOrientation: quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.3),
      spinDecay: true,
      integrationStepTicks: 350,
    });
    const observer = createNativeSpinOrientationObserver({ trajectory });
    const sharedTick = RELEASE + 63_350;
    const first = observer.sampleAtTick(sharedTick, { shutterTicks: 0 });
    const lowCadence = observer.sampleFrameTicks(
      [RELEASE, sharedTick, RELEASE + 150_000], { shutterTicks: 8_000 });
    const highCadence = observer.sampleFrameTicks(
      [RELEASE, RELEASE + 21_350, RELEASE + 44_100, sharedTick, RELEASE + 150_000],
      { shutterTicks: 5_000 },
    );
    const highTick = observer.sampleAtTick(RELEASE + 149_000, { shutterTicks: 0 });
    const backToShared = observer.sampleAtTick(sharedTick, {
      shutterTicks: 17_000, previousFrameTick: RELEASE + 41_000,
    });
    const fresh = createNativeSpinOrientationObserver({ trajectory })
      .sampleAtTick(sharedTick, { shutterTicks: 50_000 });
    const physical = sampleAerodynamicPitchTrajectory(trajectory, sharedTick);
    expect(first.angularVelocityWorldRadPerSecond).toEqual(physical.spin);
    expect(lowCadence[1].orientationMaterialToWorld).toEqual(first.orientationMaterialToWorld);
    expect(highCadence[3].orientationMaterialToWorld).toEqual(first.orientationMaterialToWorld);
    expect(backToShared.orientationMaterialToWorld).toEqual(first.orientationMaterialToWorld);
    expect(fresh.orientationMaterialToWorld).toEqual(first.orientationMaterialToWorld);
    expect(highTick.angularTravelSinceReleaseRadians)
      .toBeGreaterThan(first.angularTravelSinceReleaseRadians);
    expect(highCadence[3].shutter.angularTravelRadians).not.toBe(first.shutter.angularTravelRadians);
    expect(lowCadence[1].previousFrameTick).toBe(RELEASE);
    expect(highCadence[3].previousFrameTick).toBe(RELEASE + 44_100);
    expect(trajectory.parameters.integrationStepTicks).toBe(350);
  });

  it('provides aliasing/shutter evidence from actual speed: 800 vs 2200rpm without altering either', () => {
    const tick = RELEASE + 150_000;
    const observe = (rpm: number) => createNativeSpinOrientationObserver({
      trajectory: flight({ x: 0, y: spinRpm(rpm), z: 0 }),
    }).sampleAtTick(tick, {
      shutterTicks: SHUTTER_60FPS,
      previousFrameTick: tick - SHUTTER_60FPS,
    });
    const slow = observe(800);
    const fast = observe(2200);
    expect(slow.angularSpeedRadPerSecond).toBeCloseTo(spinRpm(800), 11);
    expect(fast.angularSpeedRadPerSecond).toBeCloseTo(spinRpm(2200), 11);
    expect(fast.shutter.angularTravelRadians).toBeGreaterThan(slow.shutter.angularTravelRadians);
    expect(fast.shutter.quarterTurnSampleCount).toBeGreaterThan(slow.shutter.quarterTurnSampleCount);
    expect(slow.shutter.singleSamplePhaseAliasingRisk).toBe(false);
    expect(fast.shutter.singleSamplePhaseAliasingRisk).toBe(true);
    expect(slow.interframePhaseAliasingRisk).toBe(false);
    expect(fast.interframePhaseAliasingRisk).toBe(true);
    expect(fast.angularTravelSincePreviousFrameRadians).toBeCloseTo(
      spinRpm(2200) * SHUTTER_60FPS / TICKS_PER_SECOND, 8,
    );
  });

  it('zero spin holds source release pose and reports no false axis, blur, or revolutions', () => {
    const initial = quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.27);
    const observer = createNativeSpinOrientationObserver({
      trajectory: flight({ x: 0, y: 0, z: 0 }, { releaseOrientation: initial }),
    });
    const samples = observer.sampleFrameTicks([
      RELEASE, RELEASE + 1, RELEASE + 100_000, RELEASE + 350_000,
    ], { shutterTicks: 20_000 });
    for (const sample of samples) {
      expect(sample.spinAxisWorld).toBeNull();
      expect(sample.angularVelocityWorldRadPerSecond).toEqual({ x: 0, y: 0, z: 0 });
      expect(sample.angularSpeedRadPerSecond).toBe(0);
      expect(sample.angularTravelSinceReleaseRadians).toBe(0);
      expect(sample.shutter.angularTravelRadians).toBe(0);
      expect(sample.shutter.rotationsDuringExposure).toBe(0);
      expect(sample.shutter.quarterTurnSampleCount).toBe(1);
      expect(sample.shutter.singleSamplePhaseAliasingRisk).toBe(false);
      nearQuaternion(sample.orientationMaterialToWorld, initial, 12);
    }
  });

  it('never samples/spins past an explicitly supplied real contact tick or source end', () => {
    const trajectory = flight({ x: 0, y: spinRpm(2200), z: 0 });
    const stop = RELEASE + 25_000;
    const observer = createNativeSpinOrientationObserver({
      trajectory, physicalStopTick: stop,
    });
    const atContact = observer.sampleAtTick(stop, { shutterTicks: 30_000 });
    expect(observer.physicalStopTick).toBe(stop);
    expect(atContact.shutter.openTick).toBe(stop - 15_000);
    expect(atContact.shutter.closeTick).toBe(stop);
    expect(atContact.shutter.exposureSeconds).toBe(0.015);
    expect(atContact.tick).toBe(stop);
    expect(atContact.shutter.angularTravelRadians)
      .toBeCloseTo(spinRpm(2200) * 0.015, 9);
    expect(() => observer.sampleAtTick(stop + 1, { shutterTicks: 0 }))
      .toThrow('outside actual release/physical stop');
    expect(() => observer.sampleFrameTicks([RELEASE, stop + 1], { shutterTicks: 0 }))
      .toThrow('outside true source flight');
  });

  it('validates strict monotonic render timestamps, canonical ticks and exact source clocks', () => {
    const trajectory = flight({ x: 0, y: spinRpm(800), z: 0 });
    const observer = createNativeSpinOrientationObserver({ trajectory });
    expect(() => observer.sampleFrameTicks([RELEASE + 2, RELEASE + 1], { shutterTicks: 0 }))
      .toThrow('strictly increasing');
    expect(() => observer.sampleFrameTicks([RELEASE, RELEASE], { shutterTicks: 0 }))
      .toThrow('strictly increasing');
    expect(() => observer.sampleAtTick(RELEASE + 0.1, { shutterTicks: 0 }))
      .toThrow('safe integer');
    expect(() => observer.sampleAtTick(RELEASE - 1, { shutterTicks: 0 }))
      .toThrow('outside actual release');
    expect(() => observer.sampleAtTick(RELEASE, { shutterTicks: -1 }))
      .toThrow('safe integer');
    expect(() => observer.sampleAtTick(RELEASE + 12_000, {
      shutterTicks: 0, previousFrameTick: RELEASE + 12_000,
    })).toThrow('strictly precede');
    expect(() => observer.sampleFrameTicks([RELEASE + 1], { shutterTicks: 2.5 }))
      .toThrow('safe integer');
    expect(() => createNativeSpinOrientationObserver({
      trajectory, physicalStopTick: trajectory.endTick + 1,
    })).toThrow('must lie within');
    expect(() => createNativeSpinOrientationObserver({
      trajectory: {
        ...trajectory,
        parameters: { ...trajectory.parameters, integrationStepTicks: 0 },
      },
    })).toThrow('positive source clock');
    expect(() => createNativeSpinOrientationObserver({
      trajectory: { ...trajectory, releaseOrientation: { w: 0, x: 0, y: 0, z: 0 } },
    })).toThrow('non-zero magnitude');
  });

  it('snapshots source inputs without executing getters or mutating Native physical parameters', () => {
    const trajectory = flight({ x: 0, y: spinRpm(800), z: 0 });
    const original = JSON.stringify(trajectory);
    const observer = createNativeSpinOrientationObserver({ trajectory });
    const first = observer.sampleAtTick(RELEASE + 20_000, { shutterTicks: 0 });
    (trajectory.start.spin as { y: number }).y = spinRpm(2200);
    expect(observer.sampleAtTick(RELEASE + 20_000, { shutterTicks: 0 }))
      .toEqual(first);
    expect(original).not.toBe(JSON.stringify(trajectory));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.orientationMaterialToWorld)).toBe(true);
    expect(Object.isFrozen(first.shutter)).toBe(true);
    expect(() => { (first.orientationMaterialToWorld as { w: number }).w = 0; }).toThrow();
    const throwGetter: AerodynamicPitchTrajectory = {
      ...trajectory,
      get start(): AerodynamicPitchTrajectory['start'] {
        throw new Error('getter must never execute');
      },
    };
    expect(() => createNativeSpinOrientationObserver({ trajectory: throwGetter }))
      .toThrow('accessors');
  });
});
