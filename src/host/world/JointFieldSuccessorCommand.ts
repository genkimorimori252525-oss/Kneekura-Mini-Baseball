import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { SourceBallWorldMotionInputV1 } from '../../core/sim/ball/SourceBallWorldMotionV1';
import type { BattedWorldPrimitiveMotionCommand } from '../../core/sim/ball/BattedWorldMotion';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash as digest, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

type FatigueResponse = Readonly<{ fatigue: number; maximumBodySpeedMps: number; maximumGloveSpeedMps: number; maximumAccelerationMps2: number }>;
export type AcceptedJointFieldSuccessorCommand = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'owned_joint_field_successor_execution_v1';
  workloadViewReference: SamePaReference<'pa_joint_recovery_workload_v1_views'>;
  recoveryReference: SamePaReference<'pa_joint_recovery_v1_executions'>; throughTick: number; equipmentId: string;
  actorProfiles: SourceBallWorldMotionInputV1['response']['actors'];
  surfaces: SourceBallWorldMotionInputV1['response']['world']['surfaces'];
  surfaceProfiles: SourceBallWorldMotionInputV1['response']['surfaces']; baseGeometry: SourceBallWorldMotionInputV1['baseGeometry'];
  modelCalibration: Readonly<{ basis: 'EXPLICIT_SYNTHETIC_FINITE_FIELD_CONTROL_V1'; modelId: 'rigid_actor_spheres_horizontal_acceleration_v1';
    feedback: 'ZERO_DELAY_SNAPSHOT_TEST_CONTROL'; availableAtDay: number; assessmentSourceId: string; assessmentVersion: string;
    footGroundSupport: Readonly<{ kind: 'compliant_stationary_sole_v1'; maximumCompressionMeters: number }> }>;
  participantResponses: readonly Readonly<{ playerId: string; personHash: string; projectedStateHash: string;
    calibrationSourceId: string; calibrationVersion: string; availableAtDay: number; fatigueSamples: readonly FatigueResponse[] }>[];
  commands: readonly BattedWorldPrimitiveMotionCommand[];
}>;
function assert(v: unknown, message: string): asserts v { if (!v) throw new Error('joint field successor command: ' + message); }
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const day = (n: number) => Number.isSafeInteger(n) && n >= 0;
export function jointFieldSuccessorCommandInput(raw: unknown, id?: string): AcceptedJointFieldSuccessorCommand {
  const s = cloneInert(raw) as AcceptedJointFieldSuccessorCommand;
  assert(fields(s, ['sourceId', 'sourceVersion', 'capability', 'workloadViewReference', 'recoveryReference', 'throughTick', 'equipmentId',
    'actorProfiles', 'surfaces', 'surfaceProfiles', 'baseGeometry', 'modelCalibration', 'participantResponses', 'commands'])
    && text(s.sourceId) && text(s.sourceVersion) && (id === undefined || id === s.sourceId) && s.capability === 'owned_joint_field_successor_execution_v1'
    && ref(s.workloadViewReference, 'pa_joint_recovery_workload_v1_views') && ref(s.recoveryReference, 'pa_joint_recovery_v1_executions')
    && day(s.throughTick) && text(s.equipmentId), 'invalid identity, parent or finite interval');
  const m = s.modelCalibration;
  assert(fields(m, ['basis', 'modelId', 'feedback', 'availableAtDay', 'assessmentSourceId', 'assessmentVersion', 'footGroundSupport'])
    && m.basis === 'EXPLICIT_SYNTHETIC_FINITE_FIELD_CONTROL_V1' && m.modelId === 'rigid_actor_spheres_horizontal_acceleration_v1'
    && m.feedback === 'ZERO_DELAY_SNAPSHOT_TEST_CONTROL' && day(m.availableAtDay) && text(m.assessmentSourceId) && text(m.assessmentVersion), 'explicit supported finite control model required');
  assert(fields(m.footGroundSupport, ['kind', 'maximumCompressionMeters']) && m.footGroundSupport.kind === 'compliant_stationary_sole_v1'
    && typeof m.footGroundSupport.maximumCompressionMeters === 'number' && Number.isFinite(m.footGroundSupport.maximumCompressionMeters)
    && m.footGroundSupport.maximumCompressionMeters >= 0, 'explicit physical sole support calibration required');
  assert(Array.isArray(s.participantResponses) && s.participantResponses.length >= 10 && s.participantResponses.length <= 13
    && new Set(s.participantResponses.map(p => p.playerId)).size === s.participantResponses.length, 'complete unique participant response set required');
  for (const p of s.participantResponses as AcceptedJointFieldSuccessorCommand['participantResponses']) {
    assert(fields(p, ['playerId', 'personHash', 'projectedStateHash', 'calibrationSourceId', 'calibrationVersion', 'availableAtDay', 'fatigueSamples'])
      && text(p.playerId) && digest(p.personHash) && digest(p.projectedStateHash) && text(p.calibrationSourceId) && text(p.calibrationVersion)
      && day(p.availableAtDay) && Array.isArray(p.fatigueSamples) && p.fatigueSamples.length >= 2 && p.fatigueSamples.length <= 32, 'explicit person/state SI response required');
    const knots = p.fatigueSamples as readonly FatigueResponse[];
    assert(knots.every((k: FatigueResponse, i) => fields(k, ['fatigue', 'maximumBodySpeedMps', 'maximumGloveSpeedMps', 'maximumAccelerationMps2'])
      && typeof k.fatigue === 'number' && Number.isFinite(k.fatigue) && k.fatigue >= 0 && k.fatigue <= 1
      && [k.maximumBodySpeedMps, k.maximumGloveSpeedMps, k.maximumAccelerationMps2].every(positive)
      && (i === 0 || k.fatigue > knots[i - 1].fatigue && k.maximumBodySpeedMps <= knots[i - 1].maximumBodySpeedMps
        && k.maximumGloveSpeedMps <= knots[i - 1].maximumGloveSpeedMps && k.maximumAccelerationMps2 <= knots[i - 1].maximumAccelerationMps2))
      && p.fatigueSamples[0].fatigue === 0 && p.fatigueSamples.at(-1)!.fatigue === 1, 'complete monotonic SI fatigue response required');
  }
  assert(Array.isArray(s.actorProfiles) && Array.isArray(s.surfaces) && Array.isArray(s.surfaceProfiles)
    && Array.isArray(s.commands) && s.commands.length === s.participantResponses.length * 5
    && s.commands.every((c: BattedWorldPrimitiveMotionCommand) => fields(c, ['playerId', 'role', 'acceleration']) && text(c.playerId)
      && ['glove', 'tag_hand', 'body', 'left_foot', 'right_foot'].includes(c.role)
      && fields(c.acceleration, ['x', 'y', 'z']) && Object.values(c.acceleration).every(Number.isFinite) && c.acceleration.y === 0)
    && new Set(s.commands.map(c => JSON.stringify([c.playerId, c.role]))).size === s.commands.length, 'complete horizontal primitive commands required');
  // The current model is a rigid per-player proxy; independent glove/crouch
  // needs a different accepted controller rather than an unconstrained hand.
  for (const p of s.participantResponses) {
    const commands = s.commands.filter(c => c.playerId === p.playerId);
    assert(commands.length === 5 && commands.every(c => c.acceleration.x === commands[0].acceleration.x
      && c.acceleration.z === commands[0].acceleration.z), 'complete rigid per-player controller required');
  }
  return freeze(s);
}
export function jointFieldCapabilityAt(samples: readonly FatigueResponse[], fatigue: number) {
  assert(Number.isFinite(fatigue) && fatigue >= 0 && fatigue <= 1, 'invalid projected fatigue');
  let i = 0; while (i < samples.length - 2 && fatigue > samples[i + 1].fatigue) i++;
  const a = samples[i], b = samples[i + 1], u = (fatigue - a.fatigue) / (b.fatigue - a.fatigue);
  return freeze({ maximumBodySpeedMps: a.maximumBodySpeedMps + (b.maximumBodySpeedMps - a.maximumBodySpeedMps) * u,
    maximumGloveSpeedMps: a.maximumGloveSpeedMps + (b.maximumGloveSpeedMps - a.maximumGloveSpeedMps) * u,
    maximumAccelerationMps2: a.maximumAccelerationMps2 + (b.maximumAccelerationMps2 - a.maximumAccelerationMps2) * u });
}
