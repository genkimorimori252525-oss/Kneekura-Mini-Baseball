import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
  sampleUninterruptedBallFreeFlight,
} from '../sim/ball/BallFlight';
import {
  NPB_2015_RIGID_WALL_COR_REFERENCE,
} from '../sim/ball/BaseballSurfacePaceCalibration';
import {
  NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
} from '../sim/ball/BaseballSpinDecay';
import {
  resolveBallSurfaceContact,
} from '../sim/ball/BallSurfaceContact';
import {
  advanceGroundBallMotion,
} from '../sim/ball/GroundBallMotion';
import {
  resolvePlanarBallSurfaceImpact,
} from '../sim/ball/PlanarBallSurfaceImpact';
import {
  findTahara2008HardBallSurfaceReboundEvidence,
} from '../sim/ball/Tahara2008SurfaceReboundEvidence';
import {
  NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT,
} from '../sim/contact/HighSpeedObliqueBatCalibration';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
} from '../sim/contact/RigidBatBallContact';
import {
  findAerodynamicPitchPlateCrossing,
  type AerodynamicPitchTrajectory,
} from '../sim/pitching/AerodynamicPitchTrajectory';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../sim/ball/BaseballAerodynamics';
import {
  evaluatePhysicsValidationCorpus,
  type PhysicsValidationCase,
  type PhysicsValidationCorpusResult,
} from './PhysicsObservableValidation';

export const BASEBALL_PHYSICS_V1_END_TO_END_CORPUS_VERSION =
  'baseball-physics-e2e-observables-v1' as const;

const SPIN_DECAY_TEST_SPEED_MPS = 44.704;
const SPIN_DECAY_TEST_INITIAL_RAD_PER_SECOND = 200;

const magnitude3 = (
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

const createPitchSpinDecayCase =
  (): PhysicsValidationCase => {
    const distanceToPlateM = 18.44;
    const elapsedSeconds =
      distanceToPlateM
      / SPIN_DECAY_TEST_SPEED_MPS;
    const expectedSpin =
      SPIN_DECAY_TEST_INITIAL_RAD_PER_SECOND
      * Math.exp(
        -elapsedSeconds
        / NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE
          .timeConstantSecondsAtReferenceSpeed,
      );

    const trajectory:
      AerodynamicPitchTrajectory = {
        start: {
          tick: 0,
          position: {
            x: 0,
            y: 1.8,
            z: distanceToPlateM,
          },
          velocity: {
            x: 0,
            y: 0,
            z: -SPIN_DECAY_TEST_SPEED_MPS,
          },
          // Pure gyro spin makes Magnus acceleration zero. Setting Cd=0 below
          // therefore isolates the pitch integrator's aerodynamic torque path.
          spin: {
            x: 0,
            y: 0,
            z:
              -SPIN_DECAY_TEST_INITIAL_RAD_PER_SECOND,
          },
        },
        endTick: 600_000,
        parameters: {
          ticksPerSecond: 1_000_000,
          integrationStepTicks: 1_000,
          gravityY: 0,
          aerodynamics: {
            ...REFERENCE_BASEBALL_AERODYNAMICS,
            dragCoefficient: 0,
            spinDecay:
              NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
          },
        },
      };

    const crossing =
      findAerodynamicPitchPlateCrossing(
        trajectory,
        0,
      );
    if (crossing === null) {
      throw new Error(
        'pitch spin-decay validation fixture must cross the plate',
      );
    }

    return {
      caseId:
        'pitch-path-nathan-2026-spin-decay',
      targets: [
        {
          observableId:
            'pitch_plate_speed_mps',
          sourceId:
            'constant-speed-gyro-flight-invariant',
          sourceVersion: 'v1',
          targetValue:
            SPIN_DECAY_TEST_SPEED_MPS,
          absoluteTolerance: 1e-8,
        },
        {
          observableId:
            'spin_rate_rad_per_second',
          sourceId:
            'nathan-2026-spin-decay-estimate',
          sourceVersion:
            'tau-20s-at-100mph-v1',
          targetValue: expectedSpin,
          absoluteTolerance: 2e-5,
        },
      ],
      measurements: [
        {
          observableId:
            'pitch_plate_speed_mps',
          observedValue:
            magnitude3(crossing.velocity),
        },
        {
          observableId:
            'spin_rate_rad_per_second',
          observedValue:
            magnitude3(crossing.spin),
        },
      ],
    };
  };

const createGameSpeedWoodContactCase =
  (): PhysicsValidationCase => {
    const speed = 50;
    const angle =
      20 * Math.PI / 180;
    const contact =
      resolveBallSurfaceContact({
        tick: 0,
        ballCenter: {
          x: 0,
          y:
            REALISTIC_BASEBALL_RIGID_BODY
              .radiusM,
          z: 0,
        },
        ballVelocity: {
          x:
            speed * Math.sin(angle),
          y:
            -speed * Math.cos(angle),
          z: 0,
        },
        ballSpin: {
          x: 0,
          y: 0,
          z: 0,
        },
        ball:
          REALISTIC_BASEBALL_RIGID_BODY,
        surfaceNormal: {
          x: 0,
          y: 1,
          z: 0,
        },
        parameters:
          NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT,
      });
    if (contact === null) {
      throw new Error(
        'game-speed wood contact validation fixture must impact',
      );
    }

    const before =
      contact
        .relativeSurfaceVelocityBefore.x;
    const after =
      contact
        .relativeSurfaceVelocityAfter.x;
    const observedTangentialCor =
      -after / before;

    return {
      caseId:
        'game-speed-wood-oblique-contact',
      targets: [
        {
          observableId:
            'tangential_coefficient_of_restitution',
          sourceId:
            'nathan-2012-spin-of-a-batted-baseball',
          sourceVersion:
            'non-gross-slip-fit-v1',
          targetValue: 0.30,
          absoluteTolerance: 0.02,
        },
      ],
      measurements: [
        {
          observableId:
            'tangential_coefficient_of_restitution',
          observedValue:
            observedTangentialCor,
        },
      ],
    };
  };

const createBattedFlightSpinDecayCase =
  (): PhysicsValidationCase => {
    const afterOneSecond =
      sampleUninterruptedBallFreeFlight(
        {
          tick: 0,
          position: {
            x: 0,
            y: 100,
            z: 0,
          },
          velocity: {
            x: 0,
            y: 0,
            z:
              SPIN_DECAY_TEST_SPEED_MPS,
          },
          // Parallel spin suppresses Magnus acceleration, leaving a constant
          // air-relative speed for an analytic spin-decay reference.
          spin: {
            x: 0,
            y: 0,
            z:
              SPIN_DECAY_TEST_INITIAL_RAD_PER_SECOND,
          },
        },
        1_000_000,
        {
          ...DEFAULT_BALL_FLIGHT_PARAMETERS,
          gravityY: 0,
          aerodynamics: {
            ...REFERENCE_BASEBALL_AERODYNAMICS,
            dragCoefficient: 0,
            spinDecay:
              NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
          },
        },
      );
    const expectedSpin =
      SPIN_DECAY_TEST_INITIAL_RAD_PER_SECOND
      * Math.exp(-1 / 20);

    return {
      caseId:
        'batted-flight-nathan-2026-spin-decay',
      targets: [
        {
          observableId:
            'spin_rate_rad_per_second',
          sourceId:
            'nathan-2026-spin-decay-estimate',
          sourceVersion:
            'tau-20s-at-100mph-v1',
          targetValue: expectedSpin,
          absoluteTolerance: 2e-5,
        },
      ],
      measurements: [
        {
          observableId:
            'spin_rate_rad_per_second',
          observedValue:
            magnitude3(
              afterOneSecond.spin,
            ),
        },
      ],
    };
  };

const createNaturalTurfBounceCase =
  (): PhysicsValidationCase => {
    const evidence =
      findTahara2008HardBallSurfaceReboundEvidence(
        'natural_turf',
      );
    const incidentSpeedMps = 10;
    const contact =
      resolveBallSurfaceContact({
        tick: 0,
        ballCenter: {
          x: 0,
          y:
            REALISTIC_BASEBALL_RIGID_BODY
              .radiusM,
          z: 0,
        },
        ballVelocity: {
          x: 0,
          y: -incidentSpeedMps,
          z: 0,
        },
        ballSpin: {
          x: 0,
          y: 0,
          z: 0,
        },
        ball:
          REALISTIC_BASEBALL_RIGID_BODY,
        surfaceNormal: {
          x: 0,
          y: 1,
          z: 0,
        },
        parameters: {
          normalRestitution:
            evidence
              .normalRepulsionCoefficient,
          tangentialRestitution: 0,
          frictionCoefficient: 0,
        },
      });
    if (contact === null) {
      throw new Error(
        'natural turf bounce validation fixture must impact',
      );
    }

    return {
      caseId:
        'natural-turf-hard-ball-vertical-bounce',
      targets: [
        {
          observableId:
            'ground_rebound_speed_mps',
          sourceId:
            'tahara-2008-natural-turf-hard-ball',
          sourceVersion:
            'vertical-repulsion-v1',
          targetValue:
            incidentSpeedMps
            * evidence
              .normalRepulsionCoefficient,
          absoluteTolerance:
            incidentSpeedMps
            * evidence
              .normalRepulsionCoefficientStdDev,
        },
      ],
      measurements: [
        {
          observableId:
            'ground_rebound_speed_mps',
          observedValue:
            Math.max(
              0,
              contact.exitVelocity.y,
            ),
        },
      ],
    };
  };

const createSkidRollKinematicCase =
  (): PhysicsValidationCase => {
    const speedMps = 5;
    const durationSeconds = 2;
    const rollingDecelerationMps2 = 1;
    const radius =
      REALISTIC_BASEBALL_RIGID_BODY
        .radiusM;
    const result =
      advanceGroundBallMotion(
        {
          tick: 0,
          position: {
            x: 0,
            y: radius,
            z: 0,
          },
          velocity: {
            x: speedMps,
            y: 0,
            z: 0,
          },
          spin: {
            x: 0,
            y: 0,
            z:
              -speedMps / radius,
          },
        },
        durationSeconds
          * 1_000_000,
        {
          ticksPerSecond: 1_000_000,
          gravityMagnitudeMps2: 9.81,
          ball:
            REALISTIC_BASEBALL_RIGID_BODY,
          slidingFrictionCoefficient:
            0.3,
          rollingDecelerationMps2,
        },
      );

    const expectedDistance =
      speedMps * durationSeconds
      - 0.5
        * rollingDecelerationMps2
        * durationSeconds
        * durationSeconds;

    return {
      caseId:
        'ground-no-slip-roll-kinematic-invariant',
      targets: [
        {
          observableId:
            'roll_distance_m',
          sourceId:
            'constant-rolling-deceleration-kinematic-invariant',
          sourceVersion: 'v1',
          targetValue:
            expectedDistance,
          absoluteTolerance: 1e-10,
        },
      ],
      measurements: [
        {
          observableId:
            'roll_distance_m',
          observedValue:
            result.state.position.x,
        },
      ],
    };
  };

const createRigidWallImpactCase =
  (): PhysicsValidationCase => {
    const incidentSpeedMps =
      NPB_2015_RIGID_WALL_COR_REFERENCE
        .incidentSpeedMps;
    const wall = {
      point: {
        x: 5,
        y: 0,
        z: 0,
      },
      normal: {
        x: -1,
        y: 0,
        z: 0,
      },
    } as const;
    const impact =
      resolvePlanarBallSurfaceImpact(
        {
          tick: 0,
          position: {
            x: 0,
            y: 1,
            z: 0,
          },
          velocity: {
            x: incidentSpeedMps,
            y: 0,
            z: 0,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        100_000,
        {
          ...DEFAULT_BALL_FLIGHT_PARAMETERS,
          gravityY: 0,
        },
        REALISTIC_BASEBALL_RIGID_BODY,
        wall,
        {
          normalRestitution:
            NPB_2015_RIGID_WALL_COR_REFERENCE
              .desiredNormalCor,
          tangentialRestitution: 0,
          frictionCoefficient: 0,
        },
      );
    if (impact === null) {
      throw new Error(
        'rigid wall validation fixture must impact',
      );
    }

    return {
      caseId:
        'takashima-2015-rigid-wall-impact',
      targets: [
        {
          observableId:
            'wall_rebound_speed_mps',
          sourceId:
            'takashima-2015-npb-rigid-wall',
          sourceVersion:
            '75mps-cor-reference-v1',
          targetValue:
            incidentSpeedMps
            * NPB_2015_RIGID_WALL_COR_REFERENCE
              .desiredNormalCor,
          absoluteTolerance: 1e-8,
        },
      ],
      measurements: [
        {
          observableId:
            'wall_rebound_speed_mps',
          observedValue:
            Math.abs(
              impact.contact
                .exitVelocity.x,
            ),
        },
      ],
    };
  };

export const createBaseballPhysicsV1EndToEndCases =
  (): readonly PhysicsValidationCase[] =>
    Object.freeze([
      createPitchSpinDecayCase(),
      createGameSpeedWoodContactCase(),
      createBattedFlightSpinDecayCase(),
      createNaturalTurfBounceCase(),
      createSkidRollKinematicCase(),
      createRigidWallImpactCase(),
    ]);

export const evaluateBaseballPhysicsV1EndToEndCorpus =
  (): PhysicsValidationCorpusResult =>
    evaluatePhysicsValidationCorpus(
      BASEBALL_PHYSICS_V1_END_TO_END_CORPUS_VERSION,
      createBaseballPhysicsV1EndToEndCases(),
    );
