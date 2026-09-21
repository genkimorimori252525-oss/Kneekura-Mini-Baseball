import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  createCanonicalPlateAppearanceTimeline,
  type CanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  CommandSwingKinematicsV1BatterCalibration,
} from '../plateAppearance/PlateAppearanceCommandPitchAdapter';
import {
  createCommandedSwingKinematicsV1PitchInput,
  type CommandedSwingKinematicsV1Pitch,
} from '../plateAppearance/PlateAppearanceCommandPitchAdapter';
import {
  assertCommandSessionCanDriveTimeline,
  type PlateAppearanceCommandSession,
} from '../plateAppearance/PlateAppearanceCommandSession';
import {
  resolveAndRecordSwingKinematicsV1PitchAgainstBatter,
  type SwingKinematicsV1BatterRuntime,
  type SwingKinematicsV1PitchAgainstBatterResolution,
} from './SwingKinematicsV1PitchAgainstBatter';
import type {
  CatcherLeadProfile,
  CatcherPitchCall,
} from './CatcherLead';
import {
  simulateCatcherLedPhysicalPitch,
  type CatcherLedPhysicalPitch,
} from './CatcherLedPhysicalPitch';
import type {
  PitchSkillCommandResponseProfile,
} from './PitchSkillCommandResponse';
import type {
  PitcherPitchSkillProfile,
  PitchSkillSamplingContext,
} from './PitchSkillProfile';
import type {
  AerodynamicPitchTrajectoryParameters,
} from './AerodynamicPitchTrajectory';
import type {
  PitcherSignBehaviorProfile,
} from './PitcherSignDecision';
import type {
  BatterPitchAnticipation,
} from './BatterPitchAnticipation';
import type {
  BatterAnticipationTimingCalibration,
} from './BatterAnticipationSwingAdapter';
import type {
  StrikeZoneRegion,
} from './TakenPitchPhysicalResult';

export type CatcherLedPhysicalPlateAppearanceEnvironment =
  Readonly<{
    sampling:
      PitchSkillSamplingContext;
    endTick: number;
    plateZ: number;
    strikeZone:
      StrikeZoneRegion;
    batterCalibration:
      CommandSwingKinematicsV1BatterCalibration;
    batter:
      SwingKinematicsV1BatterRuntime;
  }>;

export type CatcherLedPlateAppearanceSequenceInput =
  Readonly<{
    match: CanonicalMatchState;
    managerSession:
      PlateAppearanceCommandSession;
    catcherLead:
      CatcherLeadProfile;
    startedAtTick: number;
    environments:
      readonly CatcherLedPhysicalPlateAppearanceEnvironment[];
    pitcherSkills:
      PitcherPitchSkillProfile;
    commandResponses:
      readonly PitchSkillCommandResponseProfile[];
    trajectoryParameters:
      AerodynamicPitchTrajectoryParameters;
    pitcherSignBehavior?:
      PitcherSignBehaviorProfile;
    batterAnticipation?:
      BatterPitchAnticipation;
    anticipationTimingCalibration?:
      BatterAnticipationTimingCalibration;
  }>;

export type CatcherLedResolvedPitch =
  Readonly<{
    physicalPitch:
      CatcherLedPhysicalPitch;
    commanded:
      CommandedSwingKinematicsV1Pitch;
    batterResolution:
      Exclude<
        SwingKinematicsV1PitchAgainstBatterResolution,
        { kind: 'unresolved' }
      >;
  }>;

export type CatcherLedPlateAppearanceSequenceResult =
  Readonly<{
    pitchesGenerated: number;
    unusedEnvironmentCount: number;
    catcherCalls:
      readonly CatcherPitchCall[];
    finalCalls:
      readonly CatcherPitchCall[];
    generatedPitches:
      readonly CatcherLedResolvedPitch[];
    timeline:
      CanonicalPlateAppearanceTimeline;
  }>;

const validateEnvironmentOrdinals = (
  environments:
    readonly CatcherLedPhysicalPlateAppearanceEnvironment[],
): void => {
  for (
    let index = 0;
    index < environments.length;
    index += 1
  ) {
    const sampling =
      environments[index]!.sampling;
    if (
      sampling.pitchOrdinal
      !== index
    ) {
      throw new Error(
        'catcher-led physical pitch environments must use contiguous ordinals starting at zero',
      );
    }
  }
};

/**
 * Active catcher-led plate-appearance sequence.
 *
 * The catcher/pitcher side first produces a real pitch-skill aerodynamic
 * trajectory. Batter decision, timing bias, anticipation delay and contact are
 * then resolved through the single Swing Kinematics v1 physical bat authority.
 *
 * No PitchAgainstBatter / PitchTrajectorySegment / historical BatterSwingWindow
 * participates in this active path.
 */
export const resolveCatcherLedPlateAppearanceSequence = (
  input:
    CatcherLedPlateAppearanceSequenceInput,
): CatcherLedPlateAppearanceSequenceResult => {
  if (
    input.managerSession.playId
    !== input.match.playId
  ) {
    throw new Error(
      'manager command session playId must match CanonicalMatchState.playId',
    );
  }
  if (
    input.catcherLead.pitcherId.length
      === 0
    || input.catcherLead.catcherId.length
      === 0
  ) {
    throw new Error(
      'catcher lead requires pitcher and catcher ids',
    );
  }
  if (
    input.batterAnticipation
      !== undefined
    && input
      .anticipationTimingCalibration
      === undefined
  ) {
    throw new Error(
      'batter anticipation requires an explicit timing calibration',
    );
  }

  validateEnvironmentOrdinals(
    input.environments,
  );

  let timeline =
    createCanonicalPlateAppearanceTimeline(
      input.match,
      input.startedAtTick,
    );

  assertCommandSessionCanDriveTimeline(
    input.managerSession,
    timeline,
  );

  const catcherCalls:
    CatcherPitchCall[] = [];
  const finalCalls:
    CatcherPitchCall[] = [];
  const generatedPitches:
    CatcherLedResolvedPitch[] = [];

  let previousCall:
    CatcherPitchCall | undefined;

  for (
    const environment
    of input.environments
  ) {
    if (
      timeline.status.kind
      !== 'active'
    ) {
      break;
    }

    assertCommandSessionCanDriveTimeline(
      input.managerSession,
      timeline,
    );

    const physicalPitch =
      simulateCatcherLedPhysicalPitch({
        managerSession:
          input.managerSession,
        timeline,
        catcherLead:
          input.catcherLead,
        pitcherSkills:
          input.pitcherSkills,
        commandResponses:
          input.commandResponses,
        previousCall,
        pitcherSignBehavior:
          input.pitcherSignBehavior,
        batterAnticipation:
          input.batterAnticipation,
        sampling:
          environment.sampling,
        trajectoryParameters:
          input.trajectoryParameters,
        endTick:
          environment.endTick,
        plateZ:
          environment.plateZ,
      });

    const anticipation =
      physicalPitch.batterAnticipation
        === null
        ? undefined
        : {
            resolution:
              physicalPitch
                .batterAnticipation,
            calibration:
              input
                .anticipationTimingCalibration!,
          };

    const commanded =
      createCommandedSwingKinematicsV1PitchInput({
        session:
          input.managerSession,
        environment: {
          pitchOrdinal:
            environment.sampling
              .pitchOrdinal,
          actualTrajectory:
            physicalPitch
              .execution.physical
              .flight.trajectory,
          plateZ:
            environment.plateZ,
          strikeZone:
            environment.strikeZone,
          batterCalibration:
            environment
              .batterCalibration,
          batter:
            environment.batter,
          anticipation,
        },
      });

    const batterResolution =
      resolveAndRecordSwingKinematicsV1PitchAgainstBatter(
        timeline,
        commanded.input,
      );

    if (
      batterResolution.kind
      === 'unresolved'
    ) {
      throw new Error(
        `catcher-led physical pitch unresolved: ${batterResolution.reason}`,
      );
    }

    catcherCalls.push(
      physicalPitch.catcherCall,
    );
    finalCalls.push(
      physicalPitch.finalCall,
    );
    generatedPitches.push({
      physicalPitch,
      commanded,
      batterResolution,
    });
    timeline =
      batterResolution
        .resolution.timeline;

    // Preserve the catcher's previous-call memory rather than turning a
    // pitcher shake-off into a fictional previous catcher call.
    previousCall =
      physicalPitch.catcherCall;
  }

  return {
    pitchesGenerated:
      generatedPitches.length,
    unusedEnvironmentCount:
      input.environments.length
      - generatedPitches.length,
    catcherCalls,
    finalCalls,
    generatedPitches,
    timeline,
  };
};