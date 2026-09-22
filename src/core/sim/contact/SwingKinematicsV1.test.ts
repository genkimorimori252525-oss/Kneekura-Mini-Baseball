import { describe, expect, it } from 'vitest';
import {
  createSwingKinematicsTrajectoryV1,
  sampleSwingKinematicsV1,
} from './SwingKinematicsV1';

const magnitude = (
  value: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
): number => Math.hypot(
  value.x,
  value.y,
  value.z,
);

const subtract = (
  first: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
  second: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
) => ({
  x: first.x - second.x,
  y: first.y - second.y,
  z: first.z - second.z,
});

const cross = (
  first: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
  second: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
) => ({
  x:
    first.y * second.z
    - first.z * second.y,
  y:
    first.z * second.x
    - first.x * second.z,
  z:
    first.x * second.y
    - first.y * second.x,
});

const fixture = () =>
  createSwingKinematicsTrajectoryV1({
    startTick: 1_000_000,
    contactTick: 1_160_000,
    endTick: 1_280_000,
    ticksPerSecond: 1_000_000,
    batLengthM: 0.84,
    sweetSpotT: 0.72,
    start: {
      sweetSpotPosition: {
        x: -0.55,
        y: 1.55,
        z: -0.20,
      },
      sweetSpotVelocity: {
        x: 2,
        y: -1,
        z: 4,
      },
      batAxis: {
        x: 0.15,
        y: 0.92,
        z: -0.36,
      },
    },
    contact: {
      sweetSpotPosition: {
        x: 0,
        y: 1.0,
        z: 0.18,
      },
      sweetSpotVelocity: {
        x: -2.5,
        y: 5.0,
        z: 29.5,
      },
      batAxis: {
        x: 0.96,
        y: -0.12,
        z: 0.25,
      },
    },
    finish: {
      sweetSpotPosition: {
        x: 0.35,
        y: 1.40,
        z: 0.62,
      },
      sweetSpotVelocity: {
        x: 5,
        y: 2,
        z: 10,
      },
      batAxis: {
        x: -0.25,
        y: 0.72,
        z: 0.64,
      },
    },
  });

describe('swing kinematics v1', () => {
  it('preserves rigid bat length at every sampled time', () => {
    const trajectory = fixture();

    for (
      let tick =
        trajectory.startTick;
      tick <= trajectory.endTick;
      tick += 2_500
    ) {
      const sample =
        sampleSwingKinematicsV1(
          trajectory,
          tick,
        );
      const axis =
        subtract(
          sample.swingState.pose.tip,
          sample.swingState.pose.grip,
        );

      expect(
        magnitude(axis),
      ).toBeCloseTo(
        trajectory.batLengthM,
        11,
      );
      expect(
        magnitude(sample.batAxis),
      ).toBeCloseTo(1, 11);
    }
  });

  it('returns the exact contact knot and a non-zero contact speed', () => {
    const trajectory = fixture();
    const sample =
      sampleSwingKinematicsV1(
        trajectory,
        trajectory.contactTick,
      );

    expect(sample.phase)
      .toBe('contact');
    expect(sample.sweetSpotPosition)
      .toEqual(
        trajectory.contact
          .sweetSpotPosition,
      );
    expect(sample.sweetSpotVelocity)
      .toEqual(
        trajectory.contact
          .sweetSpotVelocity,
      );
    expect(
      magnitude(
        sample.sweetSpotVelocity,
      ),
    ).toBeGreaterThan(25);
  });

  it('makes angular velocity exactly reproduce the sampled axis derivative', () => {
    const trajectory = fixture();

    for (
      const tick
      of [
        1_020_000,
        1_100_000,
        1_160_000,
        1_220_000,
        1_270_000,
      ]
    ) {
      const sample =
        sampleSwingKinematicsV1(
          trajectory,
          tick,
        );
      const reproduced =
        cross(
          sample.swingState
            .angularVelocity,
          sample.batAxis,
        );

      expect(reproduced.x)
        .toBeCloseTo(
          sample
            .batAxisDerivative.x,
          10,
        );
      expect(reproduced.y)
        .toBeCloseTo(
          sample
            .batAxisDerivative.y,
          10,
        );
      expect(reproduced.z)
        .toBeCloseTo(
          sample
            .batAxisDerivative.z,
          10,
        );
    }
  });

  it('reports grip velocity consistent with the derivative of the rigid pose', () => {
    const trajectory = fixture();
    const tick = 1_130_000;
    const deltaTicks = 10;
    const before =
      sampleSwingKinematicsV1(
        trajectory,
        tick - deltaTicks,
      );
    const after =
      sampleSwingKinematicsV1(
        trajectory,
        tick + deltaTicks,
      );
    const current =
      sampleSwingKinematicsV1(
        trajectory,
        tick,
      );
    const dt =
      (
        2 * deltaTicks
      )
      / trajectory.ticksPerSecond;

    const finiteDifference = {
      x:
        (
          after.swingState.pose.grip.x
          - before.swingState.pose.grip.x
        ) / dt,
      y:
        (
          after.swingState.pose.grip.y
          - before.swingState.pose.grip.y
        ) / dt,
      z:
        (
          after.swingState.pose.grip.z
          - before.swingState.pose.grip.z
        ) / dt,
    };

    expect(
      current.swingState
        .linearVelocity.x,
    ).toBeCloseTo(
      finiteDifference.x,
      5,
    );
    expect(
      current.swingState
        .linearVelocity.y,
    ).toBeCloseTo(
      finiteDifference.y,
      5,
    );
    expect(
      current.swingState
        .linearVelocity.z,
    ).toBeCloseTo(
      finiteDifference.z,
      5,
    );
  });

  it('is deterministic for identical inputs', () => {
    const trajectory = fixture();

    expect(
      sampleSwingKinematicsV1(
        trajectory,
        1_143_219,
      ),
    ).toEqual(
      sampleSwingKinematicsV1(
        trajectory,
        1_143_219,
      ),
    );
  });
});