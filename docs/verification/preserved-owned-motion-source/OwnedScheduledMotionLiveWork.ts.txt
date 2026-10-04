import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import type { PendingPhysicalWork } from '../../core/sim/liveAction/ActionFrontier';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import type { BattedWorldFieldAcquisition } from '../../core/sim/ball/BattedWorldFieldAcquisition';
import type { BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { OwnedScheduledMotionComposition, OwnedScheduledMotionAdoption, OwnedScheduledMotionOperation } from './OwnedScheduledBattedWorldMotion';
import { ownedMotionLiveWorkFacts } from './OwnedMotionLiveWork';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Receipt = Readonly<{ eventId: string; kind: 'acquisition_confirmed' | 'acquisition_interrupted' | 'throw_released' | 'throw_interrupted';
  status: 'consumed'; at: OwnedScheduledMotionAdoption['executedThrough']; acquisition?: BattedWorldFieldAcquisition;
  releaseCursor?: BattedWorldBallCursor }>;
type Handoff = Readonly<{ kind: 'custody' | 'rule_evidence' | 'free_ball' | 'contact'; status: 'pending'; fromSourceId: string;
  toSourceId: string; basisEventId: string; source: LivePlaySource; cursor?: BattedWorldBallCursor | null;
  acquisition?: BattedWorldFieldAcquisition; field?: BattedWorldFieldMotion }>;
/** The writer persists this projection with its own physical result. Source-local
 * completion never settles the independent decision, rule or controller successors. */
export const ownedScheduledMotionLiveWork = (composition: OwnedScheduledMotionComposition, adoption: OwnedScheduledMotionAdoption,
  operation: OwnedScheduledMotionOperation | null) => {
  const motion = ownedMotionLiveWorkFacts(composition, adoption);
  const operationWork = () => {
    if (!operation) return null;
    const { physicalPitchSourceId, executionSourceId, executionRevision, executedThrough: at } = adoption;
    const namespace = (kind: string) => json(['owned_scheduled_motion_v1', kind, physicalPitchSourceId,
      'batted_world_field_executions', operation.planSourceId, executionSourceId]);
    const sourceId = namespace(operation.kind), eventId = namespace('event');
    const common = { sourceId, revision: executionRevision, intents: [], information: [], decisions: [], ruleWindows: [] };
    const phase = operation.progress.kind;
    const dueElapsedSeconds = operation.kind === 'acquisition' ? operation.plan.secureElapsedSeconds : operation.plan.releaseElapsedSeconds;
    const dueTick = operation.kind === 'acquisition' ? operation.plan.candidateSecureTick : operation.plan.transfer.throwReadyTick;
    const receipts: Receipt[] = [], handoffs: Handoff[] = [];
    const physical: PendingPhysicalWork[] = [];
    const successor = (kind: Handoff['kind'], fields: Omit<Handoff, 'kind' | 'status' | 'fromSourceId' | 'toSourceId' | 'basisEventId' | 'source'>) => {
      const toSourceId = namespace(kind), source: LivePlaySource = { sourceId: toSourceId, revision: 1,
        physical: kind === 'rule_evidence' ? [] : [{ workId: namespace(`${kind}-work`), kind: kind === 'contact' ? 'possession_transition' : 'ball_motion',
          throughTick: kind === 'contact' ? at.tick : composition.coverageThroughTick, actionKey: namespace(`${kind}-action`) }],
        intents: [], information: [], decisions: [], ruleWindows: [], queue: { sourceId: toSourceId,
          settledThroughTick: at.tick - 1, nextPendingTick: kind === 'rule_evidence' ? at.tick : null } };
      handoffs.push({ kind, status: 'pending', fromSourceId: sourceId, toSourceId, basisEventId: eventId, source, ...fields });
    };
    let completed = false;
    if (operation.kind === 'acquisition' && operation.progress.kind === 'secured') {
      const p = operation.progress;
      receipts.push({ eventId, kind: 'acquisition_confirmed', status: 'consumed', at, acquisition: p.acquisition });
      successor('custody', { cursor: p.cursor }); successor('rule_evidence', { acquisition: p.acquisition }); completed = true;
    } else if (operation.kind === 'throw' && operation.progress.kind === 'released') {
      const p = operation.progress;
      receipts.push({ eventId, kind: 'throw_released', status: 'consumed', at, releaseCursor: p.releaseCursor });
      successor(p.field.motion.cursor ? 'free_ball' : 'contact', { cursor: p.field.motion.cursor, field: p.field }); completed = true;
    } else if (phase === 'interrupted') {
      receipts.push(operation.kind === 'acquisition' && operation.progress.kind === 'interrupted'
        ? { eventId, kind: 'acquisition_interrupted', status: 'consumed', at, acquisition: operation.progress.acquisition }
        : { eventId, kind: 'throw_interrupted', status: 'consumed', at });
      physical.push({ workId: namespace('contact-work'), kind: 'possession_transition', throughTick: at.tick, actionKey: namespace('action') });
      successor('contact', operation.kind === 'throw' ? { cursor: operation.progress.field.motion.cursor, field: operation.progress.field } : { cursor: null });
    } else {
      physical.push({ workId: namespace('operation-work'), kind: operation.kind === 'acquisition' ? 'reception' : 'throw',
        actorId: operation.kind === 'acquisition' ? operation.plan.acquirerPlayerId : operation.plan.input.carrierPlayerId,
        throughTick: dueTick, actionKey: namespace('action') });
    }
    const source: LivePlaySource = { ...common, physical, queue: { sourceId, settledThroughTick: completed ? at.tick : at.tick - 1,
      nextPendingTick: completed || phase === 'interrupted' ? null : dueTick },
      ...(completed ? { completion: { completedAtTick: at.tick, basisEventId: eventId } } : {}) };
    return { planSourceId: operation.planSourceId, phase, originalDueAt: { originTick: at.originTick, elapsedSeconds: dueElapsedSeconds, tick: dueTick },
      actualExecutedThrough: at, commandCoverageThroughTick: composition.coverageThroughTick, source, receipts, handoffs };
  };
  return freeze({ ...motion, version: 'owned_scheduled_motion_live_work_v1' as const, operation: operationWork() });
};
export type OwnedScheduledMotionLiveWork = ReturnType<typeof ownedScheduledMotionLiveWork>;
