import type { BallFlightParameters } from '../../core/sim/ball/BallFlight';
import { createAeroGroundBallPhysicsProfile, type AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';

export const SAME_PA_AERO_GROUND_FIELD_ROOT_SOURCE_VERSION = 'same_pa_field_root_aero_ground_continuous_v2';
export const SAME_PA_AERO_GROUND_FIELD_STEP_SOURCE_VERSION = 'same_pa_field_step_aero_ground_continuous_v2';
export const SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION = 'same_pa_field_root_aero_ground_escape_v3';
export const SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION = 'same_pa_field_step_aero_ground_escape_v3';
export const SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION = 'same_pa_field_step_aero_ground_integer_boundary_v1';
export const SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION = 'same_pa_field_step_aero_ground_motor_v1';
export const SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION = 'same_pa_field_step_aero_ground_control_v1';
export const SAME_PA_AERO_GROUND_ACQUISITION_FIELD_STEP_SOURCE_VERSION = 'same_pa_field_step_aero_ground_acquisition_v1';
/** Only these actions retain the complete executed field without issuing motion. */
export const samePaSourceFieldMetadataActionV3 = (action: unknown): boolean => !!action && typeof action === 'object' && 'kind' in action
  && typeof action.kind === 'string'
  && ['defender_observation_v1', 'defender_decision_v1', 'defender_candidate_set_v1', 'defender_team_selection_v1', 'defender_actor_selection_v1'].includes(action.kind);

/** Explicit reserved algorithm version; opaque legacy labels retain their original contract. */
export const samePaFieldBallPhysics = (source: Readonly<{ sourceVersion: string; parameters: Required<BallFlightParameters>; ballPhysics?: AeroGroundBallPhysicsV1 }>): AeroGroundBallPhysicsV1 | undefined => {
  if (![SAME_PA_AERO_GROUND_FIELD_ROOT_SOURCE_VERSION, SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION].includes(source.sourceVersion)) {
    if (Object.hasOwn(source, 'ballPhysics') || [SAME_PA_AERO_GROUND_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION,
      SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION,
      SAME_PA_AERO_GROUND_ACQUISITION_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION].includes(source.sourceVersion)) throw new Error('unsupported same-PA field ball physics version');
    return undefined;
  }
  const profile = createAeroGroundBallPhysicsProfile(source.ballPhysics), p = source.parameters;
  if (profile.air.ticksPerSecond !== p.ticksPerSecond || profile.ground.ticksPerSecond !== p.ticksPerSecond
    || profile.air.integrationStepTicks !== p.integrationStepTicks || profile.air.gravityY !== p.gravityY
    || profile.ground.gravityMps2 !== -p.gravityY || profile.ground.radiusM !== p.ballRadius
    || profile.air.aerodynamics.ballRadiusM !== p.ballRadius) throw new Error('same-PA field ball physics header differs');
  return profile;
};

export const assertSamePaFieldBallPhysicsStep = (source: Readonly<{ sourceVersion: string; action?: unknown }>, root: Readonly<{ sourceVersion: string; parameters: Required<BallFlightParameters>; ballPhysics?: AeroGroundBallPhysicsV1 }>,
  previous: Readonly<{ sourceVersion: string }>, previousIsRoot: boolean): void => {
  const profile = samePaFieldBallPhysics(root);
  if (!profile) {
    if ([SAME_PA_AERO_GROUND_FIELD_ROOT_SOURCE_VERSION, SAME_PA_AERO_GROUND_FIELD_STEP_SOURCE_VERSION,
      SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION,
      SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION,
      SAME_PA_AERO_GROUND_ACQUISITION_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION].includes(source.sourceVersion)) throw new Error('same-PA field ball physics step changes its root algorithm');
    return;
  }
  if (source.sourceVersion === SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION) {
    const start = !!source.action && typeof source.action === 'object' && 'kind' in source.action && source.action.kind === 'defender_control_v1';
    if (root.sourceVersion !== SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION || previousIsRoot
      || ![SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION].includes(previous.sourceVersion)
      || previous.sourceVersion !== SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION && !start
      || Object.hasOwn(source, 'action') && !start && !samePaSourceFieldMetadataActionV3(source.action))
      throw new Error('unsupported same-PA Source continuous control transition');
    return;
  }
  if (source.sourceVersion === SAME_PA_AERO_GROUND_ACQUISITION_FIELD_STEP_SOURCE_VERSION) {
    if(root.sourceVersion!==SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION||previousIsRoot
      ||![SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION,SAME_PA_AERO_GROUND_ACQUISITION_FIELD_STEP_SOURCE_VERSION].includes(previous.sourceVersion)
      ||!source.action||typeof source.action!=='object'||!('kind'in source.action)||source.action.kind!=='capture_checkpoint_v1')
      throw new Error('same-PA Source acquisition requires original motor candidate and capture checkpoints only');
    return;
  }
  if (source.sourceVersion === SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION) {
    const motor = !!source.action && typeof source.action === 'object' && 'kind' in source.action && source.action.kind === 'defender_motion_v1';
    if (root.sourceVersion !== SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION || previousIsRoot
      || ![SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION].includes(previous.sourceVersion))
      throw new Error('same-PA Source motor branch changes its original version');
    if (previous.sourceVersion !== SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION && !motor)
      throw new Error('same-PA Source motor branch requires an initial owned team motor');
    if (Object.hasOwn(source, 'action') && !motor && !samePaSourceFieldMetadataActionV3(source.action))
      throw new Error('unsupported same-PA Source motor branch action');
    return;
  }
  if (source.sourceVersion === SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION) {
    const checkpoint = source.action && typeof source.action === 'object' && 'kind' in source.action
      && source.action.kind === 'source_integer_boundary_checkpoint_v1' && Object.keys(source.action).length === 1;
    if (root.sourceVersion !== SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION
      || previousIsRoot && previous.sourceVersion !== root.sourceVersion
      || !previousIsRoot && ![SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION,
        SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION].includes(previous.sourceVersion)) {
      throw new Error('same-PA integer checkpoint changes its original version');
    }
    if (previous.sourceVersion !== SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION && !checkpoint) {
      throw new Error('same-PA integer branch requires an initial positive checkpoint');
    }
    if (Object.hasOwn(source, 'action') && !checkpoint && !samePaSourceFieldMetadataActionV3(source.action)) {
      throw new Error('unsupported same-PA integer branch action; free checkpoints and metadata only');
    }
    return;
  }
  const stepVersion = root.sourceVersion === SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION
    ? SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION : SAME_PA_AERO_GROUND_FIELD_STEP_SOURCE_VERSION;
  if (source.sourceVersion !== stepVersion
    || previous.sourceVersion !== (previousIsRoot ? root.sourceVersion : stepVersion)) throw new Error('same-PA field ball physics step drops its original version');
  if (Object.hasOwn(source, 'action') && !(root.sourceVersion === SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION
    && samePaSourceFieldMetadataActionV3(source.action))) throw new Error('unsupported same-PA Aero/ground field action; free checkpoints only');
};
