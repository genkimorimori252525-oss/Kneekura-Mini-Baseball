import type { OwnedScheduledMotionExecution } from './OwnedScheduledBattedWorldMotion';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import type { AcceptedActualLivePlayScope } from './ActualLivePlayScope';
import { actualDefensiveDecisionLiveWorkFromSqlite } from './SqliteActualDefensiveDecisionLiveWork';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type ActualLiveEventMoment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
export type ActualLiveEventReference = Readonly<{ owner: string; sourceId: string; snapshotHash: string }>;
export type ActualLiveOwnedEvent = Readonly<{ eventKey: string; eventId: string; kind: string; owner: ActualLiveEventReference;
  occurredAt: ActualLiveEventMoment; availableAt: ActualLiveEventMoment; originalReceipt: unknown }>;
export type ActualLiveOwnedSuccessor = Readonly<{ successorKey: string; basisEventKey: string; kind: string;
  owner: ActualLiveEventReference; localSourceId: string; status: 'pending'; originalHandoff: unknown }>;
export type ActualLiveOwnedConsumption = Readonly<{ eventKey: string; consumerKind: string; consumer: ActualLiveEventReference;
  availableAt: ActualLiveEventMoment; status: 'consumed'; successorKey: string | null }>;
export const actualLiveEventKey = (owner: string, sourceId: string, eventId: string) => json(['actual_live_event_v1', owner, sourceId, eventId]);
export const actualLiveSuccessorKey = (owner: string, sourceId: string, localSourceId: string) => json(['actual_live_successor_v1', owner, sourceId, localSourceId]);
export const actualLiveEventMoment = (m: BallWorldMoment): ActualLiveEventMoment => ({ originTick: m.originTick, elapsedSeconds: m.elapsedSeconds, tick: m.ball.tick });
/** Projection of a freshly rederived v2 operation. Pending plans and forecasts
 * produce no receipts; source-qualified custody/rule work stays independently open. */
export const actualLiveScheduledEvents = (execution: OwnedScheduledMotionExecution, owner: ActualLiveEventReference) => {
  const events: ActualLiveOwnedEvent[] = [], successors: ActualLiveOwnedSuccessor[] = [], consumptions: ActualLiveOwnedConsumption[] = [];
  if (execution.kind !== 'owned_motion_v2' || !execution.operation || !execution.liveWork.operation) return { events, successors, consumptions };
  const operation = execution.operation, work = execution.liveWork.operation;
  for (const receipt of work.receipts) {
    const occurrence = receipt.kind === 'acquisition_confirmed' && receipt.acquisition?.kind === 'secured'
      ? receipt.acquisition.moment : receipt.kind === 'throw_released' && receipt.releaseCursor ? receipt.releaseCursor.moment
        : operation.kind === 'acquisition' ? operation.progress.world.moment : operation.progress.field.motion.world.moment;
    const eventKey = actualLiveEventKey(owner.owner, owner.sourceId, receipt.eventId);
    events.push({ eventKey, eventId: receipt.eventId, kind: receipt.kind, owner,
      occurredAt: actualLiveEventMoment(occurrence), availableAt: receipt.at, originalReceipt: receipt });
    consumptions.push({ eventKey, consumerKind: 'physical_execution', consumer: owner, availableAt: receipt.at, status: 'consumed', successorKey: null });
  }
  for (const h of work.handoffs) successors.push({ successorKey: actualLiveSuccessorKey(owner.owner, owner.sourceId, h.toSourceId),
    basisEventKey: actualLiveEventKey(owner.owner, owner.sourceId, h.basisEventId), kind: h.kind,
    owner, localSourceId: h.toSourceId, status: 'pending', originalHandoff: h });
  return { events, successors, consumptions };
};
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;

/** Re-derives immutable represented physical sources and their explicit dependencies.
 * This is not an inventory of all possible producers, a generator certificate or a fence.
 * Original receipt/handoff payloads remain unchanged, including pending/null cursors. */
export const actualLivePlayQueueEvidenceFromSqlite = (db: Db) => {
  const scopes = actualLivePlayEvidenceFromSqlite(db);
  const derive = (source: AcceptedActualLivePlayScope, current = false) => {
    const { value: scope, prefix } = scopes.deriveWithPhysicalPrefix(source, current);
    const events: ActualLiveOwnedEvent[] = [], successors: ActualLiveOwnedSuccessor[] = [], consumptions: ActualLiveOwnedConsumption[] = [];
    const represented: { owner: ActualLiveEventReference; localWork: unknown }[] = [];
    const addEvent = (event: ActualLiveOwnedEvent) => {
      const prior = events.find(e => e.eventKey === event.eventKey);
      if (prior && json(prior) !== json(event)) throw new Error('actual live event ownership differs');
      if (!prior) events.push(event);
      return event.eventKey;
    };
    const addSuccessor = (s: ActualLiveOwnedSuccessor) => {
      const prior = successors.find(e => e.successorKey === s.successorKey);
      if (prior && json(prior) !== json(s)) throw new Error('actual live successor ownership differs');
      if (!prior) successors.push(s);
    };
    for (const ref of scope.scope.physicalReferences.filter(r => r.owner === 'batted_world_field_executions')) {
      const value = prefix?.executions.find(v => v.source.sourceId === ref.sourceId);
      if (!value || ownedScheduledMotionArchiveHash(value) !== ref.hash) throw new Error('actual live queue physical Source differs');
      const execution = value.execution, owner = { owner: ref.owner, sourceId: ref.sourceId, snapshotHash: ref.hash };
      if (!('liveWork' in execution)) continue;
      represented.push({ owner, localWork: execution.liveWork });
      if ('source' in execution.liveWork) {
        const work = execution.liveWork;
        for (const receipt of work.receipts) {
          const occurrence = receipt.kind === 'acquisition_confirmed' ? receipt.acquisition.moment
            : receipt.kind === 'acquisition_interrupted' ? receipt.acquisition.world.moment
              : receipt.kind === 'throw_released' ? receipt.cursor.moment : receipt.field.motion.world.moment;
          const available = receipt.kind === 'acquisition_confirmed' ? receipt.confirmationMoment
            : execution.kind === 'acquisition_advance' ? execution.progress.world.moment : execution.field.motion.world.moment;
          const eventKey = addEvent({ eventKey: actualLiveEventKey(ref.owner, ref.sourceId, receipt.eventId), eventId: receipt.eventId,
            kind: receipt.kind, owner, occurredAt: actualLiveEventMoment(occurrence), availableAt: actualLiveEventMoment(available), originalReceipt: receipt });
          consumptions.push({ eventKey, consumerKind: 'physical_execution', consumer: owner,
            availableAt: actualLiveEventMoment(available), status: 'consumed', successorKey: null });
        }
        const handoffs = 'handoffs' in work ? work.handoffs : work.handoff ? [work.handoff] : [];
        for (const h of handoffs) addSuccessor({ successorKey: actualLiveSuccessorKey(ref.owner, ref.sourceId, h.toSourceId),
          basisEventKey: actualLiveEventKey(ref.owner, ref.sourceId, h.basisEventId), kind: 'kind' in h ? h.kind : 'released_ball',
          owner, localSourceId: h.toSourceId, status: 'pending', originalHandoff: h });
      } else if (execution.kind === 'owned_motion_v1' || execution.kind === 'owned_motion_v2') {
        if (execution.kind === 'owned_motion_v2') {
          const scheduled = actualLiveScheduledEvents(execution, owner);
          for (const event of scheduled.events) addEvent(event);
          for (const successor of scheduled.successors) addSuccessor(successor);
          consumptions.push(...scheduled.consumptions);
        }
        for (const known of execution.composition.knownWork) {
          if (known.decisionSourceId === null) continue;
          const decision = actualDefensiveDecisionLiveWorkFromSqlite(db).read(known.decisionSourceId);
          if (!decision) throw new Error('actual live queue decision Source missing');
          const work = decision.work, decisionOwner = { owner: 'actual_defensive_decisions', sourceId: known.decisionSourceId, snapshotHash: decision.decisionHash };
          for (const receipt of work.receipts) {
            const eventKey = addEvent({ eventKey: actualLiveEventKey(decisionOwner.owner, decisionOwner.sourceId, receipt.eventId),
              eventId: receipt.eventId, kind: receipt.kind, owner: decisionOwner, occurredAt: receipt.issuedAt, availableAt: receipt.issuedAt, originalReceipt: receipt });
            const h = work.handoff!;
            const successorKey = actualLiveSuccessorKey(decisionOwner.owner, decisionOwner.sourceId, h.toSourceId);
            addSuccessor({ successorKey, basisEventKey: eventKey, kind: h.kind, owner: decisionOwner, localSourceId: h.toSourceId,
              status: 'pending', originalHandoff: h });
            if (known.motorSourceId === null) continue;
            const motor = actualLocomotionEvidenceFromSqlite(db).read(known.motorSourceId);
            if (!motor || motor.source.decisionSourceId !== decisionOwner.sourceId) throw new Error('actual live queue motor/decision Source differs');
            const adopted = execution.adoption.contributors.find(c => c.motorSourceId === motor.source.sourceId);
            if (adopted?.motorAdoptionEventId) {
              const adoptionKey = addEvent({ eventKey: actualLiveEventKey(owner.owner, owner.sourceId, adopted.motorAdoptionEventId),
                eventId: adopted.motorAdoptionEventId, kind: 'motor_adopted', owner, occurredAt: execution.adoption.adoptedAt,
                availableAt: execution.adoption.executedThrough, originalReceipt: adopted });
              consumptions.push({ eventKey, consumerKind: 'motor_adoption', consumer: owner,
                availableAt: execution.adoption.executedThrough, status: 'consumed', successorKey });
              // The source-qualified motor and issuance remain visible; adoption does not acknowledge any rule successor.
              represented.push({ owner: { owner: 'actual_locomotion_receipts', sourceId: motor.source.sourceId, snapshotHash: hash(motor) },
                localWork: { receipt: motor.receipt, adoptionEventKey: adoptionKey } });
            }
          }
        }
      }
    }
    if (successors.some(s => !events.some(e => e.eventKey === s.basisEventKey))) throw new Error('actual live successor basis event missing');
    return freeze({ version: 'actual_live_play_queue_evidence_v1' as const, scope,
      coverage: 'represented_sources_only' as const, generation: 'event_generation_coverage_pending' as const,
      closureFence: 'not_installed' as const, playEnd: null, represented, events, consumptions, successors });
  };
  return { derive };
};
export type ActualLivePlayQueueEvidence = ReturnType<ReturnType<typeof actualLivePlayQueueEvidenceFromSqlite>['derive']>;
