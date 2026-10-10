import { samePaActorProducerPolicyValid, type SamePaActorProducerPolicy } from './SamePlateAppearanceActorProducerPolicy';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { AerodynamicPitchTrajectory, AerodynamicPitchTrajectoryParameters } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import type { AerodynamicRigidPitchAgainstBatterResolution } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import type { BattingCommitment } from '../../core/world/psychology/batting/BattingTypes';
import type { BattedBallContactResponseInput } from '../../core/sim/ball/BattedBallContactResponse';
import type { BattedWorldFieldGeometry, BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { BallFlightParameters } from '../../core/sim/ball/BallFlight';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';
import { actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaNominalTakeInput, type AcceptedSamePaFirstPitchAction } from './SamePlateAppearanceDispatchSource';
import { samePaDispatchMemberValid, samePaDispatchRouteValid, type SamePaDispatchMember, type SamePaDispatchRoute } from './SamePlateAppearanceDispatchRoles';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text, type SamePaReference, type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import type { SamePaLifecycleBodyCut } from './SamePlateAppearanceLifecycle';
import { samePaPhysicalFieldCalibrationSourceInput, type SamePaPhysicalFieldCalibrationSource } from './SamePlateAppearancePhysicalFieldCalibration';
export type { SamePaPhysicalFieldCalibrationSource } from './SamePlateAppearancePhysicalFieldCalibration';
import { samePaPhysicalFieldActionInput, type SamePaPhysicalFieldAction, type SamePaPhysicalFieldActionResult } from './SamePlateAppearancePhysicalFieldAction';
import { samePaBuntProfileBindingInput, type SamePaBuntProfileBinding } from './SamePlateAppearanceBuntProfile';
import { battedVenuePlayableWallPolicyInput, type AcceptedBattedVenuePlayableWallPolicy } from './BattedVenuePlayableWallPolicy';
import type { SamePaPlayableWallPolicyBinding } from './SamePlateAppearancePlayableWallPolicy';
import { battedVenueLegalCoveragePolicyInput, type AcceptedBattedVenueLegalCoveragePolicy, type SamePaVenueLegalCoveragePolicyBinding } from './BattedVenueLegalCoveragePolicy';

export const samePaPhysicalOperationOwners = Object.freeze(['pa_physical_v1_launches', 'pa_physical_v1_cuts', 'pa_physical_v1_commitments',
  'pa_physical_v1_resolutions', 'pa_physical_v1_field_roots', 'pa_physical_v1_field_steps'] as const);
export type SamePaPhysicalOperationOwner = typeof samePaPhysicalOperationOwners[number];
export type SamePaPhysicalOperationReference = SamePaReference<SamePaPhysicalOperationOwner>;
export type SamePaPhysicalLaunchReference = SamePaReference<'pa_physical_v1_launches'>;
type SourceBase = Readonly<{ sourceId: string; sourceVersion: string; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'> }>;
export type SamePaPhysicalActionSource = SourceBase & Readonly<{ capability: 'same_pa_physical_action_v1'; physicalPitchSourceId: string;
  nominalPitch: AcceptedSamePaFirstPitchAction['nominalPitch']; timingReference: AcceptedSamePaFirstPitchAction['timingReference'];
  releaseReference: AcceptedSamePaFirstPitchAction['releaseReference']; pitchResponseReference: AcceptedSamePaFirstPitchAction['pitchResponseReference'];
  batterModelReference: AcceptedSamePaFirstPitchAction['batterModelReference']; battingMode: 'declared_take' | 'observer_decision';
  actualFlightParameters: AerodynamicPitchTrajectoryParameters; contactResponse: 'nathan_2012_wood_local_v1' }>;
export type SamePaPhysicalRightSource = SourceBase & Readonly<{ capability: 'same_pa_physical_right_v1';
  actionReference: SamePaReference<'pa_physical_v1_action_plans'>;
  postureReference: SamePaReference<'batting_observation_v1_postures'>;
  participantInputs: readonly Readonly<{ member: SamePaDispatchMember; calibrationReferences: readonly Readonly<{
    route: SamePaDispatchRoute; calibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'> }>[] }>[] }>;
export type SamePaPhysicalLaunchSource = SourceBase & Readonly<{ capability: 'same_pa_physical_launch_v1';
  actionReference: SamePaReference<'pa_physical_v1_action_plans'>; rightReference: SamePaReference<'pa_physical_v1_rights'> }>;
type OperationSource = SourceBase & Readonly<{ launchReference: SamePaPhysicalLaunchReference; previousOperationReference: SamePaPhysicalOperationReference }>;
export type SamePaPhysicalCutSource = OperationSource & Readonly<{ capability: 'same_pa_physical_cut_v1'; throughTick: number }>;
export type SamePaPhysicalCommitmentSource = OperationSource & Readonly<{ capability: 'same_pa_physical_commitment_v1';
  inputReference: SamePaReference<'batting_execution_v1_inputs'>; intentReference: SamePaReference<'batting_execution_v1_intents'>;
  buntProfileBinding?: SamePaBuntProfileBinding }>;
export type SamePaPhysicalResolutionSource = OperationSource & Readonly<{ capability: 'same_pa_physical_resolution_v1'; throughTick: number;
  commitmentReference: SamePaReference<'pa_physical_v1_commitments'> | null }>;
export type SamePaPhysicalFieldRootSource = OperationSource & Readonly<{ capability: 'same_pa_physical_field_root_v1';
  resolutionReference: SamePaReference<'pa_physical_v1_resolutions'>;postureReference: SamePaReference<'batting_observation_v1_postures'>;
  fieldInputs: Readonly<{kind:'reused_normal_field_inputs_v1';geometryReference:SamePaReference<'batted_world_field_geometries'>;modelReference:SamePaReference<'batted_world_models'>;responseModelReference:SamePaReference<'batted_contact_response_models'>}>
    |Readonly<{kind:'fresh_physical_field_calibration_v1';calibrationReference:SamePaReference<'pa_physical_v1_field_calibrations'>}>;
  commands: import('./SqliteBattedWorldContactStore').AcceptedBattedWorldContact['commands']; parameters: Required<BallFlightParameters>; throughTick: number;
  venuePolicy?: AcceptedBattedVenuePlayableWallPolicy;
  venueLegalCoveragePolicy?: AcceptedBattedVenueLegalCoveragePolicy;
  liveProducerProfile?: 'same_pa_empty_base_catch_v1' | 'same_pa_stationary_occupied_catch_v1';
  actorProducerPolicies?: readonly Readonly<{playerId:string;policy:SamePaActorProducerPolicy}>[] }>;
export type SamePaPhysicalFieldStepSource = OperationSource & Readonly<{ capability: 'same_pa_physical_field_step_v1';
  fieldRootReference: SamePaReference<'pa_physical_v1_field_roots'>; previousFieldReference: SamePaReference<'pa_physical_v1_field_roots' | 'pa_physical_v1_field_steps'>;
  throughTick: number; action?: SamePaPhysicalFieldAction }>;
export type SamePaPhysicalEpisodeSource = SamePaPhysicalActionSource | SamePaPhysicalRightSource | SamePaPhysicalLaunchSource
  | SamePaPhysicalCutSource | SamePaPhysicalCommitmentSource | SamePaPhysicalResolutionSource | SamePaPhysicalFieldRootSource | SamePaPhysicalFieldStepSource | SamePaPhysicalFieldCalibrationSource;
export type SamePaPhysicalStage = 'in_flight' | 'committed' | 'resolved' | 'field';
export type SamePaPhysicalBodyCut = SamePaLifecycleBodyCut;
type RecordBase<S> = Readonly<{ source: S; lineage: SamePaExecutionLineage; pitchOrdinal: number; operationOrdinal: number; evaluationTick: number;
  physicalPitchSourceId: string; timeline: CanonicalPlateAppearanceTimeline; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'> }>;
export type SamePaPhysicalAction = RecordBase<SamePaPhysicalActionSource> & Readonly<{ kind: 'same_pa_physical_action_prepared_v1'; actor: DurablePhysicalPlateAppearanceActor;
  physicalWorld: CanonicalWorldSnapshot; baseCenters: import('../../core/adjudication/BetweenPlayWorldReset').BetweenPlayWorldSetup['baseCenters'];
  bodyCut: SamePaPhysicalBodyCut; previousPitchReference: SamePaReference; outcomeReference: SamePaReference | null;
  nominalTimingHash: string; nominalReleaseHash: string; nominalBattingModelHash: string }>;
export type SamePaPhysicalRight = RecordBase<SamePaPhysicalRightSource> & Readonly<{ kind: 'same_pa_physical_right_prepared_v1' }>;
export type SamePaPhysicalFieldCalibration=RecordBase<SamePaPhysicalFieldCalibrationSource>&Readonly<{kind:'same_pa_physical_field_calibration_prepared_v1';
  calibration:ReturnType<typeof import('./SamePlateAppearancePhysicalFieldCalibration').deriveSamePaPhysicalFieldCalibration>}>;
export type SamePaPhysicalLaunch = RecordBase<SamePaPhysicalLaunchSource> & Readonly<{ kind: 'same_pa_physical_launch_v1'; stage: 'in_flight';
  delivery: ReturnType<typeof import('../../core/sim/pitch/CanonicalPitchDelivery').resolveCanonicalPitchDelivery>;
  trajectory: AerodynamicPitchTrajectory; pitcherMember: SamePaDispatchMember; reservedPitcherStateHash: string; projectedPitcherStateHash: string }>;
export type SamePaPhysicalCut = RecordBase<SamePaPhysicalCutSource> & Readonly<{ kind: 'same_pa_physical_cut_v1'; stage: 'in_flight' | 'committed';
  ball: ReturnType<typeof import('../../core/sim/pitching/AerodynamicPitchTrajectory').sampleAerodynamicPitchTrajectory> }>;
export type SamePaPhysicalCommitment = RecordBase<SamePaPhysicalCommitmentSource> & Readonly<{ kind: 'same_pa_physical_commitment_v1'; stage: 'committed';
  commitment: BattingCommitment; calculation: import('../../core/world/psychology/batting/BattingCommitment').BattingExecutionCalculation;
  inputSource: import('./NativeBattingExecutionInput').AcceptedInFlightSamePaBattingExecutionInput;
  originalIntent: import('./OriginalBattingIntent').AcceptedOriginalBattingIntent;
  beforeWorldRevision: number; afterWorldRevision: number; controlRevision: number; controlHash: string; actionKey: string }>;
export type SamePaPhysicalResolution = RecordBase<SamePaPhysicalResolutionSource> & Readonly<{ kind: 'same_pa_physical_resolution_v1'; stage: 'resolved';
  resolution: AerodynamicRigidPitchAgainstBatterResolution; contact: import('../../core/sim/contact/BatBallContact').BatBallContactResult | null }>;
export type SamePaPhysicalFieldRoot = RecordBase<SamePaPhysicalFieldRootSource> & Readonly<{ kind: 'same_pa_physical_field_root_v1'; stage: 'field';
  response: BattedBallContactResponseInput; geometry: BattedWorldFieldGeometry; field: BattedWorldFieldMotion; geometryBindingHash: string;
  venuePolicyBinding?: SamePaPlayableWallPolicyBinding; venueLegalCoveragePolicyBinding?: SamePaVenueLegalCoveragePolicyBinding }>;
export type SamePaPhysicalFieldStep = RecordBase<SamePaPhysicalFieldStepSource> & Readonly<{ kind: 'same_pa_physical_field_step_v1'; stage: 'field'; field: BattedWorldFieldMotion; actionResult?: SamePaPhysicalFieldActionResult }>;
export type SamePaPhysicalOperation = SamePaPhysicalLaunch | SamePaPhysicalCut | SamePaPhysicalCommitment | SamePaPhysicalResolution | SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
export type SamePaPhysicalEpisodeRecord = SamePaPhysicalAction | SamePaPhysicalRight | SamePaPhysicalOperation | SamePaPhysicalFieldCalibration;
export type SamePaPhysicalOperationProof = Readonly<{ reference: SamePaPhysicalOperationReference; record: SamePaPhysicalOperation;
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>; lineage: SamePaExecutionLineage; evaluationTick: number; pitchOrdinal: number;
  timeline: CanonicalPlateAppearanceTimeline; kind: SamePaPhysicalOperation['kind']; stage: SamePaPhysicalStage;
  physicalPitchReference: SamePaPhysicalLaunchReference; actor: DurablePhysicalPlateAppearanceActor; physicalWorld: CanonicalWorldSnapshot;
  bodyCut: SamePaPhysicalBodyCut }>;
const tick = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
const operationRef = (value: unknown) => samePaPhysicalOperationOwners.some(owner => ref(value, owner));
const explicitAerodynamics = (s: SamePaPhysicalActionSource) => {
  const p=s.actualFlightParameters.aerodynamics;
  const optional=['coefficientProfile','airKinematicViscosityM2PerSecond','spinDecay'] as const;
  if(!p||!fields(p,['ballMassKg','ballRadiusM','airDensityKgM3','windVelocityMps','dragCoefficient',...optional.filter(k=>Object.hasOwn(p,k))])
    ||!fields(p.windVelocityMps,['x','y','z'])||p.airKinematicViscosityM2PerSecond!==undefined&&(!Number.isFinite(p.airKinematicViscosityM2PerSecond)||p.airKinematicViscosityM2PerSecond<=0))throw new Error('invalid explicit aerodynamic parameters');
  if(p.spinDecay!==undefined&&!fields(p.spinDecay,['referenceSpeedMps','timeConstantSecondsAtReferenceSpeed']))throw new Error('invalid explicit spin decay');
  const c=p.coefficientProfile;
  if(c!==undefined&&(!fields(c,['profileId','version','referenceReynoldsNumber','spinKnots','reynoldsKnots','reynoldsCorrectionFullThroughSpinFactor','reynoldsCorrectionZeroAtSpinFactor'])
    ||!text(c.profileId)||!text(c.version)||!Array.isArray(c.spinKnots)||!Array.isArray(c.reynoldsKnots)
    ||c.spinKnots.some(k=>!fields(k,['spinFactor','dragCoefficientAtReferenceRe','liftCoefficient']))||c.reynoldsKnots.some(k=>!fields(k,['reynoldsNumber','dragCorrectionFactorAtLowSpin']))))throw new Error('invalid explicit aerodynamic profile');
  // Use the normal numerical owner's validation, with the accepted parameters
  // supplied explicitly. This never selects its optional reference defaults.
  calculateBaseballAerodynamics(s.nominalPitch.delivery.physics.velocity,s.nominalPitch.delivery.physics.spin,p);
};
export const samePaPhysicalEpisodeSourceInput = (raw: unknown, id?: string): SamePaPhysicalEpisodeSource => {
  const s = cloneInert(raw) as SamePaPhysicalEpisodeSource;
  if (!s || !text(s.sourceId) || !text(s.sourceVersion) || id !== undefined && id !== s.sourceId || !ref(s.viewReference, 'pa_lifecycle_v1_execution_views')) throw new Error('invalid same-PA physical Source');
  if(s.capability==='same_pa_physical_field_calibration_v1')return samePaPhysicalFieldCalibrationSourceInput(s,id);
  const base = ['sourceId', 'sourceVersion', 'viewReference', 'capability'];
  if (s.capability === 'same_pa_physical_action_v1') {
    if (!fields(s, [...base, 'physicalPitchSourceId', 'nominalPitch', 'timingReference', 'releaseReference', 'pitchResponseReference', 'batterModelReference', 'battingMode', 'actualFlightParameters', 'contactResponse'])
      || !text(s.physicalPitchSourceId) || s.physicalPitchSourceId === s.sourceId || !(ref(s.timingReference, 'world_pitch_timing_baselines') || ref(s.timingReference, 'world_pitch_timing_updates'))
      || !(ref(s.releaseReference, 'world_player_release_baselines') || ref(s.releaseReference, 'world_player_release_changes')) || !ref(s.pitchResponseReference, 'world_pitch_fatigue_policies')
      || !ref(s.batterModelReference, 'world_player_batting_models') || !['declared_take', 'observer_decision'].includes(s.battingMode)
      || s.contactResponse !== 'nathan_2012_wood_local_v1' || !fields(s.actualFlightParameters, ['ticksPerSecond', 'integrationStepTicks', 'gravityY', 'aerodynamics'])
      || s.actualFlightParameters.ticksPerSecond !== 1_000_000 || !tick(s.actualFlightParameters.integrationStepTicks) || s.actualFlightParameters.integrationStepTicks === 0
      || !Number.isFinite(s.actualFlightParameters.gravityY)) throw new Error('invalid explicit physical action parameters');
    samePaNominalTakeInput(s.nominalPitch);
    explicitAerodynamics(s);
  } else if (s.capability === 'same_pa_physical_right_v1') {
    if (!fields(s, [...base, 'actionReference', 'postureReference', 'participantInputs']) || !ref(s.actionReference, 'pa_physical_v1_action_plans')
      || !ref(s.postureReference, 'batting_observation_v1_postures') || !Array.isArray(s.participantInputs)
      || s.participantInputs.length < 10 || s.participantInputs.length > 13 || new Set(s.participantInputs.map(p => p.member?.playerId)).size !== s.participantInputs.length
      || s.participantInputs.some(p => !fields(p, ['member', 'calibrationReferences']) || !samePaDispatchMemberValid(p.member) || !Array.isArray(p.calibrationReferences)
        || p.calibrationReferences.some(r => !fields(r, ['route', 'calibrationReference']) || !samePaDispatchRouteValid(r.route) || !ref(r.calibrationReference, 'pa_lifecycle_v1_execution_calibrations')))
      || s.participantInputs.flatMap(p => p.calibrationReferences).length !== 32 || new Set(s.participantInputs.flatMap((p: SamePaPhysicalRightSource['participantInputs'][number]) => p.calibrationReferences.map(r => r.calibrationReference.sourceId))).size !== 32) throw new Error('invalid physical all-ten right');
  } else if (s.capability === 'same_pa_physical_launch_v1') {
    if (!fields(s, [...base, 'actionReference', 'rightReference']) || !ref(s.actionReference, 'pa_physical_v1_action_plans') || !ref(s.rightReference, 'pa_physical_v1_rights')) throw new Error('invalid physical launch references');
  } else {
    if (!ref(s.launchReference, 'pa_physical_v1_launches') || !operationRef(s.previousOperationReference) || s.previousOperationReference.sourceId === s.sourceId) throw new Error('invalid physical predecessor');
    const op = [...base, 'launchReference', 'previousOperationReference'];
    if (s.capability === 'same_pa_physical_cut_v1') { if (!fields(s, [...op, 'throughTick']) || !tick(s.throughTick)) throw new Error('invalid physical cut'); }
    else if (s.capability === 'same_pa_physical_commitment_v1') { if (!fields(s, [...op, 'inputReference', 'intentReference', ...('buntProfileBinding' in s ? ['buntProfileBinding'] : [])]) || !ref(s.inputReference, 'batting_execution_v1_inputs') || !ref(s.intentReference, 'batting_execution_v1_intents')) throw new Error('invalid physical commitment');
      if ('buntProfileBinding' in s) samePaBuntProfileBindingInput(s.buntProfileBinding); }
    else if (s.capability === 'same_pa_physical_resolution_v1') { if (!fields(s, [...op, 'throughTick', 'commitmentReference']) || !tick(s.throughTick) || s.commitmentReference !== null && !ref(s.commitmentReference, 'pa_physical_v1_commitments')) throw new Error('invalid physical resolution'); }
    else if (s.capability === 'same_pa_physical_field_root_v1') { const f=s.fieldInputs; if (!fields(s, [...op, 'resolutionReference', 'fieldInputs', 'postureReference', 'commands', 'parameters', 'throughTick', ...('venuePolicy' in s ? ['venuePolicy'] : []), ...('venueLegalCoveragePolicy' in s ? ['venueLegalCoveragePolicy'] : []), ...('liveProducerProfile' in s ? ['liveProducerProfile'] : []), ...('actorProducerPolicies' in s ? ['actorProducerPolicies'] : [])]) || !tick(s.throughTick)
      || 'liveProducerProfile' in s && !['same_pa_empty_base_catch_v1', 'same_pa_stationary_occupied_catch_v1'].includes(s.liveProducerProfile!)
      || !ref(s.resolutionReference, 'pa_physical_v1_resolutions') || !ref(s.postureReference, 'batting_observation_v1_postures')
      ||!(f?.kind==='reused_normal_field_inputs_v1'&&fields(f,['kind','geometryReference','modelReference','responseModelReference'])&&ref(f.geometryReference,'batted_world_field_geometries')&&ref(f.modelReference,'batted_world_models')&&ref(f.responseModelReference,'batted_contact_response_models')
        ||f?.kind==='fresh_physical_field_calibration_v1'&&fields(f,['kind','calibrationReference'])&&ref(f.calibrationReference,'pa_physical_v1_field_calibrations'))|| !Array.isArray(s.commands) || s.commands.length < 10 || s.commands.length > 13
      || !fields(s.parameters, ['ticksPerSecond', 'gravityY', 'ballRadius', 'groundRestitution', 'groundFriction', 'groundRollingDecelerationMps2', 'integrationStepTicks', 'restingVerticalSpeed'])
      || Object.values(s.parameters).some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new Error('invalid physical field root');
      if ('actorProducerPolicies' in s && (!Array.isArray(s.actorProducerPolicies)||!s.actorProducerPolicies.length
        ||new Set(s.actorProducerPolicies.map(p=>p.playerId)).size!==s.actorProducerPolicies.length
        ||s.actorProducerPolicies.some(p=>!fields(p,['playerId','policy'])||!text(p.playerId)||!samePaActorProducerPolicyValid(p.policy)
          ||!s.commands.some(c=>c.playerId===p.playerId))))throw new Error('invalid physical field root actor producer policy');
      if ('venuePolicy' in s) battedVenuePlayableWallPolicyInput(s.venuePolicy!);
      if ('venueLegalCoveragePolicy' in s) battedVenueLegalCoveragePolicyInput(s.venueLegalCoveragePolicy!); }
    else if (s.capability === 'same_pa_physical_field_step_v1') { if (!fields(s, [...op, 'fieldRootReference', 'previousFieldReference', 'throughTick', ...('action' in s ? ['action'] : [])]) || !tick(s.throughTick)
      || !ref(s.fieldRootReference, 'pa_physical_v1_field_roots') || !(ref(s.previousFieldReference, 'pa_physical_v1_field_roots') || ref(s.previousFieldReference, 'pa_physical_v1_field_steps'))) throw new Error('invalid physical field step'); if ('action' in s) samePaPhysicalFieldActionInput(s.action!); }
    else throw new Error('unsupported physical episode Source');
  }
  return freeze(s);
};
