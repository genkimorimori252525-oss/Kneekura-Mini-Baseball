import type {
  Vec3,
} from '../../model/geometry';
import {
  SeedRoot,
} from '../../rng/SeedRoot';
import type {
  BatterSwingState,
} from '../contact/BatBallContact';
import type {
  PitchAgainstBatterInput,
} from '../pitching/PitchAgainstBatter';
import type {
  StrikeZoneRegion,
} from '../pitching/TakenPitchPhysicalResult';
import type {
  PitchTrajectorySegment,
} from '../pitching/PitchTrajectory';
import type {
  AerodynamicPitchTrajectory,
} from '../pitching/AerodynamicPitchTrajectory';
import type {
  SwingKinematicsV1BatterRuntime,
  SwingKinematicsV1PitchAgainstBatterInput,
} from '../pitching/SwingKinematicsV1PitchAgainstBatter';
import type {
  PlateAppearanceCommandSession,
} from './PlateAppearanceCommandSession';

export type CommandPitchTargetCalibration = Readonly<{
  challengeHorizontalZoneFraction: number;
  balancedHorizontalZoneFraction: number;
  wasteHorizontalZoneFraction: number;
  lowVerticalZoneFraction: number;
  middleVerticalZoneFraction: number;
  highVerticalZoneFraction: number;
}>;

export type CommandBatterCalibration = Readonly<{
  balancedSwingProbability: number;
  aggressiveSwingProbability: number;
  earlyTimingOffsetTicks: number;
  lateTimingOffsetTicks: number;
  swingWindowHalfWidthTicks: number;
}>;

export type CommandPitchEnvironment = Readonly<{
  pitchStartTick: number;
  pitchOrdinal: number;
  ticksPerSecond: number;
  pitchDurationTicks: number;
  releasePosition: Vec3;
  acceleration: Vec3;
  releaseSpin?: Vec3;
  plateZ: number;
  strikeZone: StrikeZoneRegion;
  ballRadiusMeters: number;
  insideXDirection: -1 | 1;
  targetCalibration: CommandPitchTargetCalibration;
  batterCalibration: CommandBatterCalibration;
  swingStateAtWindowStart: BatterSwingState;
}>;

export type CommandedPitchAgainstBatter = Readonly<{
  pitchOrdinal: number;
  targetPlatePosition: Vec3;
  batterDecisionRoll: number;
  input: PitchAgainstBatterInput;
}>;

const validateTick = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

const validateFinite = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${name} must be finite`,
    );
  }
};

const validateVec3 = (
  name: string,
  value: Vec3,
): void => {
  validateFinite(`${name}.x`, value.x);
  validateFinite(`${name}.y`, value.y);
  validateFinite(`${name}.z`, value.z);
};

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

const horizontalFraction = (
  session: PlateAppearanceCommandSession,
  calibration: CommandPitchTargetCalibration,
): number => {
  switch (session.command.pitcher.aggression) {
    case 'challenge':
      return calibration.challengeHorizontalZoneFraction;
    case 'balanced':
      return calibration.balancedHorizontalZoneFraction;
    case 'waste':
      return calibration.wasteHorizontalZoneFraction;
  }
};

const verticalFraction = (
  session: PlateAppearanceCommandSession,
  calibration: CommandPitchTargetCalibration,
): number => {
  switch (session.command.pitcher.verticalPlan) {
    case 'low':
      return calibration.lowVerticalZoneFraction;
    case 'middle':
      return calibration.middleVerticalZoneFraction;
    case 'high':
      return calibration.highVerticalZoneFraction;
  }
};

const targetXDirection = (
  session: PlateAppearanceCommandSession,
  insideXDirection: -1 | 1,
): -1 | 0 | 1 => {
  switch (session.command.pitcher.attackZone) {
    case 'inside':
      return insideXDirection;
    case 'middle':
      return 0;
    case 'outside':
      return insideXDirection === 1 ? -1 : 1;
  }
};

const swingProbability = (
  session: PlateAppearanceCommandSession,
  calibration: CommandBatterCalibration,
): number => {
  switch (session.command.batter.approach) {
    case 'take':
      return 0;
    case 'balanced':
      return calibration.balancedSwingProbability;
    case 'aggressive':
      return calibration.aggressiveSwingProbability;
  }
};

const swingBiasTicks = (
  session: PlateAppearanceCommandSession,
  calibration: CommandBatterCalibration,
): number => {
  switch (session.command.batter.swingBias) {
    case 'early':
      return calibration.earlyTimingOffsetTicks;
    case 'neutral':
      return 0;
    case 'late':
      return calibration.lateTimingOffsetTicks;
  }
};

const validateEnvironment = (
  environment: CommandPitchEnvironment,
): void => {
  validateTick(
    'pitchStartTick',
    environment.pitchStartTick,
  );
  if (
    !Number.isSafeInteger(environment.pitchOrdinal)
    || environment.pitchOrdinal < 0
  ) {
    throw new Error(
      'pitchOrdinal must be a non-negative safe integer',
    );
  }
  if (
    !Number.isSafeInteger(environment.ticksPerSecond)
    || environment.ticksPerSecond <= 0
  ) {
    throw new Error(
      'ticksPerSecond must be a positive safe integer',
    );
  }
  if (
    !Number.isSafeInteger(environment.pitchDurationTicks)
    || environment.pitchDurationTicks <= 0
  ) {
    throw new Error(
      'pitchDurationTicks must be a positive safe integer',
    );
  }

  validateVec3(
    'releasePosition',
    environment.releasePosition,
  );
  validateVec3(
    'acceleration',
    environment.acceleration,
  );
  if (environment.releaseSpin !== undefined) {
    validateVec3(
      'releaseSpin',
      environment.releaseSpin,
    );
  }

  validateFinite('plateZ', environment.plateZ);
  validateFinite(
    'strikeZone.centerX',
    environment.strikeZone.centerX,
  );
  validateFinite(
    'strikeZone.halfWidth',
    environment.strikeZone.halfWidth,
  );
  validateFinite(
    'strikeZone.lowerY',
    environment.strikeZone.lowerY,
  );
  validateFinite(
    'strikeZone.upperY',
    environment.strikeZone.upperY,
  );
  if (
    environment.strikeZone.halfWidth <= 0
    || environment.strikeZone.upperY
      <= environment.strikeZone.lowerY
  ) {
    throw new Error(
      'strikeZone geometry must be positive and ordered',
    );
  }
  if (
    !Number.isFinite(environment.ballRadiusMeters)
    || environment.ballRadiusMeters <= 0
  ) {
    throw new Error(
      'ballRadiusMeters must be finite and positive',
    );
  }
  if (
    environment.insideXDirection !== -1
    && environment.insideXDirection !== 1
  ) {
    throw new Error(
      'insideXDirection must be -1 or 1',
    );
  }

  const target = environment.targetCalibration;
  for (const [name, value] of Object.entries(target)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(
        `targetCalibration.${name} must be finite and non-negative`,
      );
    }
  }
  for (const name of [
    'lowVerticalZoneFraction',
    'middleVerticalZoneFraction',
    'highVerticalZoneFraction',
  ] as const) {
    const value = target[name];
    if (value > 1) {
      throw new Error(
        `targetCalibration.${name} must be within [0, 1]`,
      );
    }
  }

  const batter = environment.batterCalibration;
  validateProbability(
    'balancedSwingProbability',
    batter.balancedSwingProbability,
  );
  validateProbability(
    'aggressiveSwingProbability',
    batter.aggressiveSwingProbability,
  );
  if (
    !Number.isSafeInteger(
      batter.earlyTimingOffsetTicks,
    )
    || !Number.isSafeInteger(
      batter.lateTimingOffsetTicks,
    )
  ) {
    throw new Error(
      'swing timing offsets must be safe integer ticks',
    );
  }
  validateTick(
    'swingWindowHalfWidthTicks',
    batter.swingWindowHalfWidthTicks,
  );
};

const createTargetPlatePosition = (
  session: PlateAppearanceCommandSession,
  environment: CommandPitchEnvironment,
): Vec3 => {
  const direction = targetXDirection(
    session,
    environment.insideXDirection,
  );
  const x = (
    environment.strikeZone.centerX
    + direction
      * environment.strikeZone.halfWidth
      * horizontalFraction(
        session,
        environment.targetCalibration,
      )
  );

  const verticalSpan = (
    environment.strikeZone.upperY
    - environment.strikeZone.lowerY
  );
  const y = (
    environment.strikeZone.lowerY
    + verticalSpan * verticalFraction(
      session,
      environment.targetCalibration,
    )
  );

  return {
    x,
    y,
    z: environment.plateZ,
  };
};

const createTrajectory = (
  environment: CommandPitchEnvironment,
  target: Vec3,
): PitchTrajectorySegment => {
  const endTick = (
    environment.pitchStartTick
    + environment.pitchDurationTicks
  );
  if (!Number.isSafeInteger(endTick)) {
    throw new Error(
      'pitch end tick must be a safe integer',
    );
  }

  const seconds = (
    environment.pitchDurationTicks
    / environment.ticksPerSecond
  );
  const solveVelocity = (
    start: number,
    end: number,
    acceleration: number,
  ): number => (
    (
      end
      - start
      - 0.5 * acceleration * seconds * seconds
    ) / seconds
  );

  return {
    start: {
      tick: environment.pitchStartTick,
      position: environment.releasePosition,
      velocity: {
        x: solveVelocity(
          environment.releasePosition.x,
          target.x,
          environment.acceleration.x,
        ),
        y: solveVelocity(
          environment.releasePosition.y,
          target.y,
          environment.acceleration.y,
        ),
        z: solveVelocity(
          environment.releasePosition.z,
          target.z,
          environment.acceleration.z,
        ),
      },
      spin: environment.releaseSpin ?? {
        x: 0,
        y: 0,
        z: 0,
      },
    },
    acceleration: environment.acceleration,
    endTick,
    ticksPerSecond: environment.ticksPerSecond,
  };
};

export const createCommandedPitchAgainstBatterInput = (
  input: Readonly<{
    session: PlateAppearanceCommandSession;
    environment: CommandPitchEnvironment;
  }>,
): CommandedPitchAgainstBatter => {
  const {
    session,
    environment,
  } = input;
  validateEnvironment(environment);

  const targetPlatePosition =
    createTargetPlatePosition(
      session,
      environment,
    );
  const trajectory = createTrajectory(
    environment,
    targetPlatePosition,
  );

  const rng = new SeedRoot(
    session.matchSeed,
  ).streamRng(
    session.playId,
    'batting',
    `p7:pitch:${environment.pitchOrdinal}:decision`,
  );
  const batterDecisionRoll = rng.nextFloat();
  const shouldSwing = (
    batterDecisionRoll
    < swingProbability(
      session,
      environment.batterCalibration,
    )
  );

  if (!shouldSwing) {
    return {
      pitchOrdinal: environment.pitchOrdinal,
      targetPlatePosition,
      batterDecisionRoll,
      input: {
        action: {
          kind: 'take',
        },
        trajectory,
        plateZ: environment.plateZ,
        strikeZone: environment.strikeZone,
        ballRadiusMeters:
          environment.ballRadiusMeters,
      },
    };
  }

  const crossingTick = trajectory.endTick;
  const centerTick = (
    crossingTick
    + swingBiasTicks(
      session,
      environment.batterCalibration,
    )
  );
  const halfWindow = (
    environment.batterCalibration
      .swingWindowHalfWidthTicks
  );
  const startTick = Math.max(
    trajectory.start.tick,
    centerTick - halfWindow,
  );
  const endTick = Math.min(
    trajectory.endTick,
    centerTick + halfWindow,
  );
  if (endTick <= startTick) {
    throw new Error(
      'commanded swing window must have positive duration inside pitch trajectory',
    );
  }

  return {
    pitchOrdinal: environment.pitchOrdinal,
    targetPlatePosition,
    batterDecisionRoll,
    input: {
      action: {
        kind: 'swing',
        swing: {
          startTick,
          endTick,
          ticksPerSecond:
            environment.ticksPerSecond,
          stateAtStart:
            environment.swingStateAtWindowStart,
        },
      },
      trajectory,
    },
  };
};


/**
 * Production command-resolution environment.
 *
 * The physical aerodynamic pitch must already have been generated upstream
 * from pitcher/catcher/player numerical inputs. This layer owns only the
 * deterministic batter take/swing decision and timing bias before handing the
 * pitch to Swing Kinematics v1.
 */
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
  }>;

export type CommandedSwingKinematicsV1Pitch =
  Readonly<{
    pitchOrdinal: number;
    batterDecisionRoll: number;
    input:
      SwingKinematicsV1PitchAgainstBatterInput;
  }>;

const validateProductionBatterCalibration = (
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

const productionSwingProbability = (
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

const productionSwingBiasTicks = (
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
  validateProductionBatterCalibration(
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
    < productionSwingProbability(
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
          productionSwingBiasTicks(
            session,
            environment.batterCalibration,
          ),
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