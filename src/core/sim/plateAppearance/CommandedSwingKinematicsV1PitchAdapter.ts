import {
  SeedRoot,
} from '../../rng/SeedRoot';
import type {
  AerodynamicPitchTrajectory,
} from '../pitching/AerodynamicPitchTrajectory';
import type {
  BatterPitchAnticipationResolution,
} from '../pitching/BatterPitchAnticipation';
import type {
  BatterAnticipationTimingCalibration,
} from '../pitching/BatterAnticipationSwingAdapter';
import type {
  SwingKinematicsV1BatterRuntime,
  SwingKinematicsV1PitchAgainstBatterInput,
} from '../pitching/SwingKinematicsV1PitchAgainstBatter';
import type {
  StrikeZoneRegion,
} from '../pitching/TakenPitchPhysicalResult';
import type {
  PlateAppearanceCommandSession,
} from './PlateAppearanceCommandSession';

export type CommandSwingKinematicsV1BatterCalibration =
  Readonly<{
    balancedSwingProbability: number;
    aggressiveSwingProbability: number;
    earlyTimingOffsetTicks: number;
    lateTimingOffsetTicks: number;
  }>;

export type CommandedPhysicalPitchEnvironmentV1 =
  Readonly<{
    pitchOrdinal: number;
    actualTrajectory:
      AerodynamicPitchTrajectory;
    predictedTrajectory?:
      AerodynamicPitchTrajectory;
    plateZ: number;
    strikeZone: StrikeZoneRegion;
    batterCalibration:
      CommandSwingKinematicsV1BatterCalibration;
    batter:
      SwingKinematicsV1BatterRuntime;
    anticipation?: Readonly<{
      resolution:
        BatterPitchAnticipationResolution;
      calibration:
        BatterAnticipationTimingCalibration;
    }>;
  }>;

export type CommandedSwingKinematicsV1Pitch =
  Readonly<{
    pitchOrdinal: number;
    batterDecisionRoll: number;
    input:
      SwingKinematicsV1PitchAgainstBatterInput;
  }>;

const validateProbability = (
  name: string,
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(
      `${name} must be finite and within [0, 1]`,
    );
  }
};

const validateBatterCalibration = (
  calibration:
    CommandSwingKinematicsV1BatterCalibration,
): void => {
  validateProbability(
    'balancedSwingProbability',
    calibration.balancedSwingProbability,
  );
  validateProbability(
    'aggressiveSwingProbability',
    calibration.aggressiveSwingProbability,
  );
  if (
    !Number.isSafeInteger(
      calibration.earlyTimingOffsetTicks,
    )
    || !Number.isSafeInteger(
      calibration.lateTimingOffsetTicks,
    )
  ) {
    throw new Error(
      'Swing Kinematics v1 timing offsets must be safe integer ticks',
    );
  }
};

const swingProbability = (
  session:
    PlateAppearanceCommandSession,
  calibration:
    CommandSwingKinematicsV1BatterCalibration,
): number => {
  switch (
    session.command.batter.approach
  ) {
    case 'take':
      return 0;
    case 'balanced':
      return calibration
        .balancedSwingProbability;
    case 'aggressive':
      return calibration
        .aggressiveSwingProbability;
  }
};

const swingBiasTicks = (
  session:
    PlateAppearanceCommandSession,
  calibration:
    CommandSwingKinematicsV1BatterCalibration,
): number => {
  switch (
    session.command.batter.swingBias
  ) {
    case 'early':
      return calibration
        .earlyTimingOffsetTicks;
    case 'neutral':
      return 0;
    case 'late':
      return calibration
        .lateTimingOffsetTicks;
  }
};

/**
 * Active production batter-decision adapter.
 *
 * The pitch is already a physical AerodynamicPitchTrajectory. This layer only
 * makes the deterministic numerical take/swing decision and passes timing to
 * the single Swing Kinematics v1 physical bat authority.
 */
export const createCommandedSwingKinematicsV1PitchInput = (
  input: Readonly<{
    session:
      PlateAppearanceCommandSession;
    environment:
      CommandedPhysicalPitchEnvironmentV1;
  }>,
): CommandedSwingKinematicsV1Pitch => {
  const {
    session,
    environment,
  } = input;

  if (
    !Number.isSafeInteger(
      environment.pitchOrdinal,
    )
    || environment.pitchOrdinal < 0
  ) {
    throw new Error(
      'production pitchOrdinal must be a non-negative safe integer',
    );
  }

  validateBatterCalibration(
    environment.batterCalibration,
  );

  const rng = new SeedRoot(
    session.matchSeed,
  ).streamRng(
    session.playId,
    'batting',
    `p7:pitch:${environment.pitchOrdinal}:decision`,
  );
  const batterDecisionRoll =
    rng.nextFloat();
  const shouldSwing =
    batterDecisionRoll
    < swingProbability(
      session,
      environment.batterCalibration,
    );

  if (!shouldSwing) {
    return {
      pitchOrdinal:
        environment.pitchOrdinal,
      batterDecisionRoll,
      input: {
        action: {
          kind: 'take',
        },
        actualTrajectory:
          environment.actualTrajectory,
        predictedTrajectory:
          environment.predictedTrajectory,
        plateZ:
          environment.plateZ,
        strikeZone:
          environment.strikeZone,
        ballRadiusMeters:
          environment.batter.ball.radiusM,
      },
    };
  }

  return {
    pitchOrdinal:
      environment.pitchOrdinal,
    batterDecisionRoll,
    input: {
      action: {
        kind: 'swing',
        timingOffsetTicks:
          swingBiasTicks(
            session,
            environment.batterCalibration,
          ),
        anticipation:
          environment.anticipation,
      },
      actualTrajectory:
        environment.actualTrajectory,
      predictedTrajectory:
        environment.predictedTrajectory,
      plateZ:
        environment.plateZ,
      strikeZone:
        environment.strikeZone,
      batter:
        environment.batter,
    },
  };
};