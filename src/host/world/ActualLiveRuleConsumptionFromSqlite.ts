import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLivePlayId as id, actualLivePlayFields as fields } from './ActualLivePlayScope';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actualLivePlayQueueEvidenceFromSqlite } from './ActualLivePlayQueueEvidenceFromSqlite';
import { actualLiveImmutableReceiptEvidenceFromSqlite } from './ActualLiveImmutableReceiptStore';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type AcceptedActualLiveRuleConsumption = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'actual_first_base_rule_consumption_v1'; captureExecutionSourceId: string; ruleExecutionSourceId: string }>;
const input = (raw: AcceptedActualLiveRuleConsumption, sourceId: string): AcceptedActualLiveRuleConsumption => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'captureExecutionSourceId', 'ruleExecutionSourceId'])
    || source.sourceId !== sourceId || source.capability !== 'actual_first_base_rule_consumption_v1'
    || ![source.sourceId, source.sourceVersion, source.captureExecutionSourceId, source.ruleExecutionSourceId].every(id)) {
    throw new Error('invalid accepted actual first-base rule consumption Source');
  }
  return freeze(source);
};
export const actualLiveRuleCaptureConfirmed = (execution: DurableBattedWorldFieldExecution['execution']) =>
  execution.kind === 'acquisition_advance' && execution.progress.kind === 'secured'
  || execution.kind === 'owned_motion_v2' && execution.operation?.kind === 'acquisition' && execution.operation.progress.kind === 'secured';
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
/** Acknowledges only this confirmed capture's first-base rule read. A rule read can be
 * unresolved; neither acknowledgement nor true OUT establishes an operative call/end. */
export const actualLiveRuleConsumptionOwnerFromSqlite = (db: Db) => {
  const derive = (raw: AcceptedActualLiveRuleConsumption, current = false) => {
    const inert = cloneInert(raw), source = input(inert, inert.sourceId), physical = battedWorldFieldExecutionEvidenceFromSqlite(db);
    const capture = physical.read(source.captureExecutionSourceId), rule = physical.read(source.ruleExecutionSourceId);
    if (!capture || !actualLiveRuleCaptureConfirmed(capture.execution)) {
      throw new Error('actual rule consumption requires confirmed scheduled capture');
    }
    if (!rule || rule.execution.kind !== 'first_base_race') throw new Error('actual rule consumption requires canonical first-base race');
    if (capture.source.baseFieldSourceId !== rule.source.baseFieldSourceId || capture.revision >= rule.revision
      || json(capture.baseField) !== json(rule.baseField)
      || !rule.history.slice(0, -1).some(s => s.sourceId === capture.source.sourceId && json(s) === json(capture.source))) {
      throw new Error('actual rule consumption capture is not an original rule predecessor');
    }
    const pitch = rule.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId;
    const queue = actualLivePlayQueueEvidenceFromSqlite(db).derive({ sourceId: source.sourceId, sourceVersion: source.sourceVersion,
      capability: 'actual_live_play_scope_v1', physicalPitchSourceId: pitch,
      cut: { kind: 'field_execution', baseFieldSourceId: rule.baseField.source.sourceId, executionSourceId: rule.source.sourceId } }, current);
    const event = queue.events.find(e => e.owner.owner === 'batted_world_field_executions' && e.owner.sourceId === capture.source.sourceId && e.kind === 'acquisition_confirmed');
    const successor = queue.successors.find(s => s.owner.owner === 'batted_world_field_executions' && s.owner.sourceId === capture.source.sourceId && s.kind === 'rule_evidence');
    const availableAt = queue.scope.scope.at;
    if (!event || !successor || successor.basisEventKey !== event.eventKey
      || event.occurredAt.originTick !== availableAt.originTick || event.availableAt.originTick !== availableAt.originTick
      || event.occurredAt.elapsedSeconds > event.availableAt.elapsedSeconds || event.availableAt.elapsedSeconds > availableAt.elapsedSeconds) {
      throw new Error('actual rule consumption confirmation/availability chronology differs');
    }
    const ownershipKey = json(['actual_first_base_rule_consumption_v1', pitch, successor.successorKey]);
    const receiptId = json(['actual_live_rule_consumption_receipt_v1', ownershipKey, source.sourceId]);
    const ruleReference = { owner: 'batted_world_field_executions' as const, sourceId: rule.source.sourceId, snapshotHash: ownedScheduledMotionArchiveHash(rule) };
    return freeze({ source, revision: 1 as const, history: [source], ownershipKey,
      physicalPitchSourceId: pitch, scopeId: queue.scope.scope.scopeId,
      consumption: { kind: 'first_base_rule_consumption' as const, status: 'consumed' as const, receiptId,
        eventKey: event.eventKey, successorKey: successor.successorKey, capture: event.owner, rule: ruleReference,
        occurredAt: event.occurredAt, eventAvailableAt: event.availableAt, availableAt,
        proofScope: 'one_confirmed_capture_first_base_reader' as const },
      successor: { kind: 'first_base_rule_result' as const, successorKey: json(['actual_live_rule_result_successor_v1', receiptId]),
        basisReceiptId: receiptId, status: 'pending' as const, pendingReason: 'next_rule_consumer_unowned' as const,
        rule: ruleReference, availableAt, result: rule.execution },
    });
  };
  return { input, derive, ownershipField: 'captureExecutionSourceId' as const };
};
export const actualLiveRuleConsumptionEvidenceFromSqlite = (db: Db) =>
  actualLiveImmutableReceiptEvidenceFromSqlite(db, 'actual_live_rule_consumptions', actualLiveRuleConsumptionOwnerFromSqlite(db));
export type DurableActualLiveRuleConsumption = ReturnType<ReturnType<typeof actualLiveRuleConsumptionOwnerFromSqlite>['derive']>;
