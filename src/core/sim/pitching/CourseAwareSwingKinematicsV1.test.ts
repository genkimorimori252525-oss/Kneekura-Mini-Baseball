import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1,
  planCourseAwareSwingKinematicsV1,
  resolveAttackAngleDegV1,
  resolvePreferredContactDepthV1,
  resolvePreContactSecondsV1,
  resolveSwingCourseCoordinatesV1,
} from './CourseAwareSwingKinematicsV1';
import {
  sampleSwingKinematicsV1,
} from '../contact/SwingKinematicsV1';

const zone = {
  centerX: 0,
  halfWidth: 0.2159,
  lowerY: 0.50,
  upperY: 1.10,
} as const;

const target = (
  xNorm: number,
  yNorm: number,
) => ({
  x:
    zone.centerX
    + zone.halfWidth
      * xNorm,
  y:
    (
      zone.lowerY
      + zone.upperY
    ) / 2
    + (
      zone.upperY
      - zone.lowerY
    ) / 2
      * yNorm,
  z: 0,
});

const plan = (
  handedness: 'R' | 'L',
  xNorm: number,
  yNorm: number,
) => planCourseAwareSwingKinematicsV1({
  handedness,
  batterCenterOfMass: {
    x:
      handedness === 'R'
        ? -0.78
        : 0.78,
    y: 1.0,
    z: -0.16,
  },
  targetBallCenterAtPlate:
    target(
      handedness === 'R'
        ? xNorm
        : -xNorm,
      yNorm,
    ),
  strikeZone: zone,
  contactTick: 2_000_000,
  ticksPerSecond: 1_000_000,
});

describe('course-aware swing kinematics v1', () => {
  it('maps world x to batter-relative inside/outside without mirroring the world', () => {
    expect(
      resolveSwingCourseCoordinatesV1(
        target(-1, 0),
        zone,
        'R',
      ).insideOutsideNormalized,
    ).toBe(-1);
    expect(
      resolveSwingCourseCoordinatesV1(
        target(1, 0),
        zone,
        'L',
      ).insideOutsideNormalized,
    ).toBe(-1);
  });

  it('keeps the adopted high-inside contact forward of low-outside', () => {
    const highInside = {
      heightNormalized: 1,
      insideOutsideNormalized: -1,
    } as const;
    const lowOutside = {
      heightNormalized: -1,
      insideOutsideNormalized: 1,
    } as const;

    expect(
      resolvePreferredContactDepthV1(
        highInside,
      ),
    ).toBeGreaterThan(
      resolvePreferredContactDepthV1(
        lowOutside,
      ),
    );
  });

  it('places inside contact forward of outside and gives inside a longer pre-contact duration', () => {
    const inside = {
      heightNormalized: 0,
      insideOutsideNormalized: -1,
    } as const;
    const outside = {
      heightNormalized: 0,
      insideOutsideNormalized: 1,
    } as const;

    expect(
      resolvePreferredContactDepthV1(
        inside,
      ),
    ).toBeGreaterThan(
      resolvePreferredContactDepthV1(
        outside,
      ),
    );
    expect(
      resolvePreContactSecondsV1(
        inside,
      ),
    ).toBeGreaterThan(
      resolvePreContactSecondsV1(
        outside,
      ),
    );
  });

  it('uses the evidence-backed height attack-angle curve continuously', () => {
    expect(
      resolveAttackAngleDegV1(1),
    ).toBe(7);
    expect(
      resolveAttackAngleDegV1(0),
    ).toBe(9);
    expect(
      resolveAttackAngleDegV1(-1),
    ).toBe(16);
    expect(
      resolveAttackAngleDegV1(0.5),
    ).toBe(8);
    expect(
      resolveAttackAngleDegV1(-0.5),
    ).toBe(12.5);
  });

  it('changes contact speed through the adopted contact-depth slope rather than a result bonus', () => {
    const inside =
      plan('R', -1, 0);
    const outside =
      plan('R', 1, 0);

    expect(
      inside.contactSweetSpotSpeedMps,
    ).toBeGreaterThan(
      outside.contactSweetSpotSpeedMps,
    );

    const expectedDifference =
      (
        inside.preferredContactDepthM
        - outside.preferredContactDepthM
      )
      * EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1
        .contactDepthSpeedGainMpsPerM;

    expect(
      inside.contactSweetSpotSpeedMps
      - outside.contactSweetSpotSpeedMps,
    ).toBeCloseTo(
      expectedDifference,
      12,
    );
  });

  it('mirrors the physical pose between right and left batters while keeping y/z identical', () => {
    const right =
      plan('R', -0.5, 0.4);
    const left =
      plan('L', -0.5, 0.4);

    for (
      const offset
      of [
        0,
        40_000,
        90_000,
      ]
    ) {
      const rightTick =
        Math.min(
          right.trajectory.endTick,
          right.trajectory.startTick
          + offset,
        );
      const leftTick =
        Math.min(
          left.trajectory.endTick,
          left.trajectory.startTick
          + offset,
        );
      const r =
        sampleSwingKinematicsV1(
          right.trajectory,
          rightTick,
        );
      const l =
        sampleSwingKinematicsV1(
          left.trajectory,
          leftTick,
        );

      expect(
        l.swingState.pose.grip.x,
      ).toBeCloseTo(
        -r.swingState.pose.grip.x,
        10,
      );
      expect(
        l.swingState.pose.tip.x,
      ).toBeCloseTo(
        -r.swingState.pose.tip.x,
        10,
      );
      expect(
        l.swingState.pose.grip.y,
      ).toBeCloseTo(
        r.swingState.pose.grip.y,
        10,
      );
      expect(
        l.swingState.pose.grip.z,
      ).toBeCloseTo(
        r.swingState.pose.grip.z,
        10,
      );
    }
  });

  it('derives nine representative zones from one continuous planner', () => {
    const values = [
      -1,
      0,
      1,
    ];
    const plans =
      values.flatMap(
        (height) =>
          values.map(
            (course) =>
              plan(
                'R',
                course,
                height,
              ),
          ),
      );

    expect(plans).toHaveLength(9);
    expect(
      new Set(
        plans.map(
          (entry) =>
            [
              entry.preferredContactDepthM,
              entry.attackAngleDeg,
              entry.attackDirectionPullDeg,
            ].join(':'),
        ),
      ).size,
    ).toBeGreaterThan(3);

    const midpoint =
      plan('R', 0.5, 0.5);
    expect(
      midpoint.course
        .insideOutsideNormalized,
    ).toBeCloseTo(0.5, 12);
    expect(
      midpoint.course
        .heightNormalized,
    ).toBeCloseTo(0.5, 12);
  });
});