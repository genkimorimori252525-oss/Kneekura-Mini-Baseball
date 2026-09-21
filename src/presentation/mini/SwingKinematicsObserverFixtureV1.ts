import type { Vec3 } from '../../core/model/geometry';
import {
  sampleSwingKinematicsV1,
  type SwingKinematicsPhaseV1,
} from '../../core/sim/contact/SwingKinematicsV1';
import {
  planCourseAwareSwingKinematicsV1,
} from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import {
  MINI_PRESENTATION_CADENCE_MICROS,
} from './model';
import {
  projectBatPoseToBatterPov,
  projectWorldToBatterPov,
  type ProjectedPoint,
} from './BatterPovCamera';

export const SWING_KINEMATICS_OBSERVER_FIXTURE_V1_VERSION =
  'swing-kinematics-observer-fixture-v1' as const;

export const SWING_KINEMATICS_OBSERVER_HIGH_FIDELITY_STEP_MICROS =
  5_000 as const;

const STRIKE_ZONE = Object.freeze({
  centerX: 0,
  halfWidth: 0.2159,
  lowerY: 0.50,
  upperY: 1.10,
} as const);

const BATTER_CENTER = Object.freeze({
  x: -0.78,
  y: 1.0,
  z: -0.16,
} as const);

const CONTACT_TICK = 2_000_000 as const;
const TICKS_PER_SECOND = 1_000_000 as const;

export type SwingObserverCourseIdV1 =
  | 'high_inside'
  | 'high_middle'
  | 'high_outside'
  | 'middle_inside'
  | 'middle_middle'
  | 'middle_outside'
  | 'low_inside'
  | 'low_middle'
  | 'low_outside';

type RoundedVec3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

type RoundedProjectedPoint =
  | Readonly<{
      x: number;
      y: number;
      depth: number;
      apparentScale: number;
    }>
  | null;

export type SwingObserverFrameV1 = Readonly<{
  tick: number;
  phase: SwingKinematicsPhaseV1;
  sweetSpot: RoundedVec3;
  grip: RoundedVec3;
  tip: RoundedVec3;
  batterPov: Readonly<{
    grip: RoundedProjectedPoint;
    tip: RoundedProjectedPoint;
    sweetSpot: RoundedProjectedPoint;
  }>;
}>;

export type SwingObserverCourseV1 = Readonly<{
  id: SwingObserverCourseIdV1;
  label: string;
  heightNormalized: -1 | 0 | 1;
  insideOutsideNormalized: -1 | 0 | 1;
  targetBallCenterAtPlate: RoundedVec3;
  intendedBallCenterAtContact: RoundedVec3;
  preferredContactDepthM: number;
  attackAngleDeg: number;
  attackDirectionPullDeg: number;
  contactSweetSpotSpeedMps: number;
  preContactSeconds: number;
  contactTick: number;
  startTick: number;
  endTick: number;
  highFidelityFrames: readonly SwingObserverFrameV1[];
  miniFrames: readonly SwingObserverFrameV1[];
}>;

export type SwingKinematicsObserverFixtureV1 = Readonly<{
  version:
    typeof SWING_KINEMATICS_OBSERVER_FIXTURE_V1_VERSION;
  source:
    'core-generated-swing-kinematics-v1';
  handedness: 'R';
  highFidelityStepMicros:
    typeof SWING_KINEMATICS_OBSERVER_HIGH_FIDELITY_STEP_MICROS;
  miniCadenceMicros:
    typeof MINI_PRESENTATION_CADENCE_MICROS;
  strikeZone: typeof STRIKE_ZONE;
  batterCenterOfMass: typeof BATTER_CENTER;
  strikeZoneBatterPov: Readonly<{
    lowerInside: RoundedProjectedPoint;
    lowerOutside: RoundedProjectedPoint;
    upperInside: RoundedProjectedPoint;
    upperOutside: RoundedProjectedPoint;
  }>;
  courses: readonly SwingObserverCourseV1[];
}>;

const roundNumber = (
  value: number,
): number => (
  Math.round(value * 1_000_000)
  / 1_000_000
);

const roundVec3 = (
  value: Vec3,
): RoundedVec3 => ({
  x: roundNumber(value.x),
  y: roundNumber(value.y),
  z: roundNumber(value.z),
});

const roundProjected = (
  value: ProjectedPoint | null,
): RoundedProjectedPoint => (
  value === null
    ? null
    : {
        x: value.x,
        y: value.y,
        depth:
          roundNumber(value.depth),
        apparentScale:
          roundNumber(
            value.apparentScale,
          ),
      }
);

const targetAt = (
  insideOutsideNormalized:
    -1 | 0 | 1,
  heightNormalized:
    -1 | 0 | 1,
): Vec3 => {
  const centerY =
    (
      STRIKE_ZONE.lowerY
      + STRIKE_ZONE.upperY
    ) / 2;
  const halfHeight =
    (
      STRIKE_ZONE.upperY
      - STRIKE_ZONE.lowerY
    ) / 2;

  return {
    x:
      STRIKE_ZONE.centerX
      + STRIKE_ZONE.halfWidth
        * insideOutsideNormalized,
    y:
      centerY
      + halfHeight
        * heightNormalized,
    z: 0,
  };
};

const sampleFrame = (
  trajectory:
    ReturnType<
      typeof planCourseAwareSwingKinematicsV1
    >['trajectory'],
  tick: number,
): SwingObserverFrameV1 => {
  const sample =
    sampleSwingKinematicsV1(
      trajectory,
      tick,
    );
  const projected =
    projectBatPoseToBatterPov(
      sample.swingState.pose,
      'R',
    );

  return {
    tick,
    phase: sample.phase,
    sweetSpot:
      roundVec3(
        sample.sweetSpotPosition,
      ),
    grip:
      roundVec3(
        sample.swingState.pose.grip,
      ),
    tip:
      roundVec3(
        sample.swingState.pose.tip,
      ),
    batterPov: {
      grip:
        roundProjected(
          projected.grip,
        ),
      tip:
        roundProjected(
          projected.tip,
        ),
      sweetSpot:
        roundProjected(
          projectWorldToBatterPov(
            sample.sweetSpotPosition,
            'R',
          ),
        ),
    },
  };
};

const regularTicks = (
  startTick: number,
  endTick: number,
  stepTicks: number,
): number[] => {
  const ticks: number[] = [];
  for (
    let tick = startTick;
    tick <= endTick;
    tick += stepTicks
  ) {
    ticks.push(tick);
  }
  if (
    ticks[ticks.length - 1]
    !== endTick
  ) {
    ticks.push(endTick);
  }
  return ticks;
};

const miniTicks = (
  startTick: number,
  contactTick: number,
  endTick: number,
): number[] => {
  const firstCadenceTick =
    Math.ceil(
      startTick
      / MINI_PRESENTATION_CADENCE_MICROS,
    )
    * MINI_PRESENTATION_CADENCE_MICROS;

  const ticks: number[] = [];
  for (
    let tick = firstCadenceTick;
    tick <= endTick;
    tick += MINI_PRESENTATION_CADENCE_MICROS
  ) {
    ticks.push(tick);
  }

  ticks.push(
    startTick,
    contactTick,
    endTick,
  );

  return [
    ...new Set(ticks),
  ].sort(
    (left, right) =>
      left - right,
  );
};

const COURSE_DEFINITIONS:
  readonly Readonly<{
    id: SwingObserverCourseIdV1;
    label: string;
    heightNormalized: -1 | 0 | 1;
    insideOutsideNormalized:
      -1 | 0 | 1;
  }>[] =
  Object.freeze([
    {
      id: 'high_inside',
      label: '高め内角',
      heightNormalized: 1,
      insideOutsideNormalized: -1,
    },
    {
      id: 'high_middle',
      label: '高め中央',
      heightNormalized: 1,
      insideOutsideNormalized: 0,
    },
    {
      id: 'high_outside',
      label: '高め外角',
      heightNormalized: 1,
      insideOutsideNormalized: 1,
    },
    {
      id: 'middle_inside',
      label: '内角',
      heightNormalized: 0,
      insideOutsideNormalized: -1,
    },
    {
      id: 'middle_middle',
      label: '真ん中',
      heightNormalized: 0,
      insideOutsideNormalized: 0,
    },
    {
      id: 'middle_outside',
      label: '外角',
      heightNormalized: 0,
      insideOutsideNormalized: 1,
    },
    {
      id: 'low_inside',
      label: '低め内角',
      heightNormalized: -1,
      insideOutsideNormalized: -1,
    },
    {
      id: 'low_middle',
      label: '低め中央',
      heightNormalized: -1,
      insideOutsideNormalized: 0,
    },
    {
      id: 'low_outside',
      label: '低め外角',
      heightNormalized: -1,
      insideOutsideNormalized: 1,
    },
  ]);

const createCourse = (
  definition:
    typeof COURSE_DEFINITIONS[number],
): SwingObserverCourseV1 => {
  const target =
    targetAt(
      definition
        .insideOutsideNormalized,
      definition.heightNormalized,
    );
  const plan =
    planCourseAwareSwingKinematicsV1({
      handedness: 'R',
      batterCenterOfMass:
        BATTER_CENTER,
      targetBallCenterAtPlate:
        target,
      strikeZone:
        STRIKE_ZONE,
      contactTick:
        CONTACT_TICK,
      ticksPerSecond:
        TICKS_PER_SECOND,
    });

  return {
    id: definition.id,
    label: definition.label,
    heightNormalized:
      definition.heightNormalized,
    insideOutsideNormalized:
      definition
        .insideOutsideNormalized,
    targetBallCenterAtPlate:
      roundVec3(target),
    intendedBallCenterAtContact:
      roundVec3(
        plan
          .intendedBallCenterAtContact,
      ),
    preferredContactDepthM:
      roundNumber(
        plan.preferredContactDepthM,
      ),
    attackAngleDeg:
      roundNumber(
        plan.attackAngleDeg,
      ),
    attackDirectionPullDeg:
      roundNumber(
        plan.attackDirectionPullDeg,
      ),
    contactSweetSpotSpeedMps:
      roundNumber(
        plan.contactSweetSpotSpeedMps,
      ),
    preContactSeconds:
      roundNumber(
        plan.preContactSeconds,
      ),
    contactTick:
      plan.trajectory.contactTick,
    startTick:
      plan.trajectory.startTick,
    endTick:
      plan.trajectory.endTick,
    highFidelityFrames:
      regularTicks(
        plan.trajectory.startTick,
        plan.trajectory.endTick,
        SWING_KINEMATICS_OBSERVER_HIGH_FIDELITY_STEP_MICROS,
      ).map(
        (tick) =>
          sampleFrame(
            plan.trajectory,
            tick,
          ),
      ),
    miniFrames:
      miniTicks(
        plan.trajectory.startTick,
        plan.trajectory.contactTick,
        plan.trajectory.endTick,
      ).map(
        (tick) =>
          sampleFrame(
            plan.trajectory,
            tick,
          ),
      ),
  };
};

export const createSwingKinematicsObserverFixtureV1 =
  (): SwingKinematicsObserverFixtureV1 => ({
    version:
      SWING_KINEMATICS_OBSERVER_FIXTURE_V1_VERSION,
    source:
      'core-generated-swing-kinematics-v1',
    handedness: 'R',
    highFidelityStepMicros:
      SWING_KINEMATICS_OBSERVER_HIGH_FIDELITY_STEP_MICROS,
    miniCadenceMicros:
      MINI_PRESENTATION_CADENCE_MICROS,
    strikeZone:
      STRIKE_ZONE,
    batterCenterOfMass:
      BATTER_CENTER,
    strikeZoneBatterPov: {
      lowerInside:
        roundProjected(
          projectWorldToBatterPov(
            {
              x:
                STRIKE_ZONE.centerX
                - STRIKE_ZONE.halfWidth,
              y: STRIKE_ZONE.lowerY,
              z: 0,
            },
            'R',
          ),
        ),
      lowerOutside:
        roundProjected(
          projectWorldToBatterPov(
            {
              x:
                STRIKE_ZONE.centerX
                + STRIKE_ZONE.halfWidth,
              y: STRIKE_ZONE.lowerY,
              z: 0,
            },
            'R',
          ),
        ),
      upperInside:
        roundProjected(
          projectWorldToBatterPov(
            {
              x:
                STRIKE_ZONE.centerX
                - STRIKE_ZONE.halfWidth,
              y: STRIKE_ZONE.upperY,
              z: 0,
            },
            'R',
          ),
        ),
      upperOutside:
        roundProjected(
          projectWorldToBatterPov(
            {
              x:
                STRIKE_ZONE.centerX
                + STRIKE_ZONE.halfWidth,
              y: STRIKE_ZONE.upperY,
              z: 0,
            },
            'R',
          ),
        ),
    },
    courses:
      COURSE_DEFINITIONS.map(
        createCourse,
      ),
  });