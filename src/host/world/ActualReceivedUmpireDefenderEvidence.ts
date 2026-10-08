import type { DatabaseSync } from 'node:sqlite';
import { receivedEnrollmentInput, type ReceivedEnrollmentSource } from './ActualReceivedUmpireDefender';
import { actualReceivedUmpireDefenderReplanInputEvidenceFromSqlite } from './ActualReceivedUmpireDefenderReplanInput';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { actualLiveAdmissionOwners, actualLivePlayExtensionOpenState } from './ActualLivePlayFence';
import { actualDefensiveContextFromSqlite } from './ActualDefensiveContext';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { actualCommunicationEvidenceFromSqlite } from './SqliteActualCommunicationStore';
import { actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { actualDefensivePlanEvidenceFromSqlite } from './SqliteActualDefensivePlanStore';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createHash } from 'node:crypto';
const need = <T>(value: T | null | undefined, name: string): T => { if (!value) throw new Error('received enrollment original '+name+' missing'); return value; };
const ref = (value: {source: {sourceId: string}}, snapshotHash = hash(value)) => ({sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash});
const revisionRef = (value: {source: {sourceId: string}; revision: number}, snapshotHash = hash(value)) => ({...ref(value, snapshotHash), revision: value.revision});
const bytesHash = (raw: unknown) => typeof raw === 'string' ? createHash('sha256').update(raw).digest('hex') : null;
/** Frozen legacy prefix only. A later suffix remains opaque and gains no credit. */
export const receivedLegacyAdmissionPrefix = (db: DatabaseSync, runtimeId: string, count?: number) => {
  if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) throw new Error('received enrollment admission bound differs');
  const rows = db.prepare('SELECT * FROM actual_live_play_admissions WHERE runtime_source_id=?'+(count === undefined ? '' : ' AND sequence<=?')+' ORDER BY sequence')
    .all(...(count === undefined ? [runtimeId] : [runtimeId, count]));
  if (count !== undefined && rows.length !== count) throw new Error('received enrollment admission prefix is incomplete');
  const seen = new Set<string>();
  return rows.map((row, index) => {
    if (row.sequence !== index+1 || !(actualLiveAdmissionOwners as readonly unknown[]).includes(row.owner)
      || typeof row.source_id !== 'string' || seen.has(json([row.owner,row.source_id]))) throw new Error('received enrollment admission prefix differs');
    const own = db.prepare(`SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM main.${row.owner} WHERE source_id=?`).get(row.source_id);
    if (!own || own.source_hash !== row.source_hash || own.snapshot_hash !== row.snapshot_hash
      || bytesHash(own.source_json) !== own.source_hash || bytesHash(own.snapshot_json) !== own.snapshot_hash) throw new Error('received enrollment admitted original archive differs');
    seen.add(json([row.owner,row.source_id]));
    return {sequence:index+1,owner:String(row.owner),sourceId:row.source_id,sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)};
  });
};
export const receivedEnrollmentEvidenceFromSqlite = (db: DatabaseSync) => {
  const derive = (raw: ReceivedEnrollmentSource, admissionCount?: number) => withBattedWorldPhysicalReadTraversal(db, () => {
    const source = receivedEnrollmentInput(raw);
    const bridge = actualReceivedUmpireDefenderReplanInputEvidenceFromSqlite(db).derive({sourceId:source.sourceId,sourceVersion:source.sourceVersion,
      capability:'received_umpire_defender_replan_v1',physicalPitchSourceId:source.physicalPitchSourceId,playerId:source.playerId,
      observationSourceId:source.observationSourceId,currentExecutionSourceId:source.currentExecutionSourceId,
      predecessorDecisionSourceId:source.predecessorDecisionSourceId,predecessorMotorSourceId:source.predecessorMotorSourceId,
      predecessorAdoptionSourceId:source.predecessorAdoptionSourceId,policySourceId:null,previousReplanSourceId:null});
    if (bridge.input.observation.reception.kind !== 'received' || !bridge.replan.cause) throw new Error('received enrollment requires actual received cause');
    const runtime = need(actualLiveRuntimeEvidenceFromSqlite(db).read(source.runtimeSourceId),'runtime');
    if (runtime.source.capability !== 'causal_original_live_play_runtime_v1' || runtime.source.physicalPitchSourceId !== source.physicalPitchSourceId
      || !runtime.membership.participants.some(p => p.playerId === source.playerId && p.role === 'defender')) throw new Error('received enrollment original runtime or defender differs');
    const context = actualDefensiveContextFromSqlite(db).read(source.observationSourceId,source.physicalPitchSourceId,source.playerId);
    const observation = context.observation, fields = battedWorldFieldEvidenceFromSqlite(db), baseField = need(fields.read(observation.source.baseFieldSourceId),'base field');
    const executions = battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField,source.currentExecutionSourceId);
    const execution = need(executions.at(-1),'execution'), adoption = need(executions.find(v=>v.source.sourceId===source.predecessorAdoptionSourceId),'adoption');
    const self = actualPlayerKinematicsFromPrefix(source.playerId,{baseField,fields:fields.scope(baseField,baseField.source.sourceId),executions});
    const decision = need(actualDefensiveDecisionEvidenceFromSqlite(db).read(source.predecessorDecisionSourceId),'decision');
    const originObservation = need(actualFieldObservationEvidenceFromSqlite(db).read(decision.receipt.originObservationSourceId),'origin observation');
    const motor = need(actualLocomotionEvidenceFromSqlite(db).read(source.predecessorMotorSourceId),'motor');
    const communication = need(actualCommunicationEvidenceFromSqlite(db).read(bridge.input.communication.sourceId),'communication');
    const call = need(actualFirstBaseUmpireEvidenceFromSqlite(db).readCall(bridge.input.communication.callSourceId),'call');
    const model = need(playerDecisionModelEvidenceFromSqlite(db).read(bridge.input.model.sourceId),'model');
    const plan = need(actualDefensivePlanEvidenceFromSqlite(db).read(bridge.input.contextualPlan.sourceId),'plan');
    const prefix = receivedLegacyAdmissionPrefix(db,source.runtimeSourceId,admissionCount), binding = context.binding;
    if (runtime.gameId !== binding.gameId || json(self.at)!==json(observation.receipt.at) || json(self.at)!==json(bridge.input.currentCut)
      || execution.source.sourceId!==source.currentExecutionSourceId) throw new Error('received enrollment observation and physical cut differ');
    const responsibilities = [ ['actual_received_umpire_defender_enrollments','received_process_admission'],
      ['actual_received_umpire_defender_policy_availabilities','received_policy_availability'],
      ['actual_received_umpire_defender_replans','received_decision_and_renewal_obligation'] ] as const;
    const value = freeze({source,gameId:runtime.gameId,playId:runtime.playId,
      receiver:{careerId:binding.careerId,playerId:binding.playerId,personId:binding.personId,personLinkSourceId:binding.personLinkSourceId,
        fieldingModelSourceId:context.fieldingModel.source.sourceId,gameDay:binding.gameDay},cause:bridge.replan.cause,
      membership:{version:'received_umpire_defender_membership_v1' as const,receiverRole:'defender' as const,playerId:source.playerId,
        effectiveFrom:self.at,legacyCoverage:'unchanged' as const,physicalAdvancement:'blocked_until_future_capability' as const,
        producers:responsibilities.map(([owner,responsibility])=>({producerId:json(['received_umpire_defender_producer_v1',source.runtimeSourceId,source.playerId,responsibility]),owner,responsibility,playerId:source.playerId}))},
      anchor:{runtime:ref(runtime),originalPitchHash:runtime.originalPitchHash,legacyAdmissionPrefix:{count:prefix.length,digest:hash(prefix)},
        baseField:ref(baseField),execution:revisionRef(execution,ownedScheduledMotionArchiveHash(execution)),observation:revisionRef(observation),at:self.at,ticksPerSecond:self.ticksPerSecond,
        decision:revisionRef(decision),originObservation:ref(originObservation),motor:ref(motor),adoption:revisionRef(adoption,ownedScheduledMotionArchiveHash(adoption)),
        communication:ref(communication),call:ref(call),decisionModel:ref(model),contextualPlan:ref(plan),playerBindingHash:hash(binding),fieldingModelHash:hash(context.fieldingModel),
        selfHash:hash(self),activeCommandHash:hash(self.activeCommand),roleAuthoritiesHash:hash(self.ownedMotionCoverage?.roleAuthorities)}});
    return {value,bridge,observation,execution,context};
  });
  const qualifyCurrent = (derived: ReturnType<typeof derive>) => withBattedWorldPhysicalReadTraversal(db, () => {
    const {value,observation,execution} = derived;
    actualFieldObservationEvidenceFromSqlite(db).current(observation);
    battedWorldFieldExecutionEvidenceFromSqlite(db).current(execution);
    const head = db.prepare('SELECT * FROM actual_defensive_decision_heads WHERE physical_pitch_source_id=? AND player_id=?')
      .get(value.source.physicalPitchSourceId,value.source.playerId);
    if (!head || head.source_id!==value.source.predecessorDecisionSourceId || head.revision!==value.anchor.decision.revision
      || json(receivedLegacyAdmissionPrefix(db,value.source.runtimeSourceId))!==json(receivedLegacyAdmissionPrefix(db,value.source.runtimeSourceId,value.anchor.legacyAdmissionPrefix.count))) {
      throw new Error('received enrollment current incumbent or legacy admission prefix differs');
    }
    return actualLivePlayExtensionOpenState(db,{gameId:value.gameId,playId:value.playId,physicalPitchSourceId:value.source.physicalPitchSourceId});
  });
  return {derive,qualifyCurrent};
};
export type DurableReceivedEnrollment = ReturnType<ReturnType<typeof receivedEnrollmentEvidenceFromSqlite>['derive']>['value'];
