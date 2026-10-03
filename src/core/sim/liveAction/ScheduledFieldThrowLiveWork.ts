import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BattedWorldBallCursor } from '../ball/BattedWorldContinuation';
import { freezeBattedWorldField, hasBattedWorldFieldFields } from '../ball/BattedWorldFieldExecution';
import type { BattedWorldFieldMotion } from '../ball/BattedWorldFieldMotion';
import { validateBattedWorldScheduledFieldThrowPlan, validateBattedWorldScheduledFieldThrowProgress,
  type BattedWorldScheduledFieldThrowPlan, type BattedWorldScheduledFieldThrowAdvance } from '../ball/BattedWorldScheduledFieldThrow';
import type { PendingPhysicalWork } from './ActionFrontier';
import { resolveEventQueueWatermark } from './EventQueueWatermark';
import type { LivePlaySource } from './LivePlayRegistry';

export type ScheduledFieldThrowLiveWorkInput = Readonly<{
  physicalPitchSourceId: string;
  planSourceId: string;
  executionSourceId: string;
  revision: number;
  plan: BattedWorldScheduledFieldThrowPlan;
  progress: BattedWorldScheduledFieldThrowAdvance | null;
}>;

type ScheduledFieldThrowReceiptScope = Readonly<{
  physicalPitchSourceId: string;
  planSourceId: string;
  executionSourceId: string;
  revision: number;
  sourceId: string;
  eventId: string;
  generatedAtTick: number;
  adoptedAtTick: number;
  /** Consumption by this transfer owner only, not by every play contributor. */
  status: 'consumed';
}>;

export type ScheduledFieldThrowEventReceipt = ScheduledFieldThrowReceiptScope & (
  Readonly<{ kind: 'throw_released'; cursor: BattedWorldBallCursor }>
  | Readonly<{ kind: 'throw_interrupted'; field: BattedWorldFieldMotion }>
);

export type ScheduledFieldThrowBallHandoff = Readonly<{
  fromSourceId: string;
  toSourceId: string;
  basisEventId: string;
  cursor: BattedWorldBallCursor | null;
  field: BattedWorldFieldMotion;
  source: LivePlaySource;
}>;

export type ScheduledFieldThrowLiveWork = Readonly<{
  physicalPitchSourceId: string;
  planSourceId: string;
  executionSourceId: string;
  phase: 'pending' | BattedWorldScheduledFieldThrowAdvance['kind'];
  dueTick: number;
  source: LivePlaySource;
  receipts: readonly ScheduledFieldThrowEventReceipt[];
  handoff: ScheduledFieldThrowBallHandoff | null;
}>;

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();

/**
 * Projects one actually executed throw lifecycle. Native binds the Source IDs
 * and persists the source, receipt and successor together with that execution.
 * This is deliberately not a whole-play registry, actor policy or finalizer.
 */
export const deriveScheduledFieldThrowLiveWork = (raw: ScheduledFieldThrowLiveWorkInput): ScheduledFieldThrowLiveWork => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['physicalPitchSourceId', 'planSourceId', 'executionSourceId', 'revision', 'plan', 'progress'])
    || !id(input.physicalPitchSourceId) || !id(input.planSourceId) || !id(input.executionSourceId)) {
    throw new Error('invalid scheduled field throw live-work scope');
  }
  if (!Number.isSafeInteger(input.revision) || input.revision <= 0) throw new Error('invalid scheduled field throw source revision');
  validateBattedWorldScheduledFieldThrowPlan(input.plan);
  if (input.progress !== null) validateBattedWorldScheduledFieldThrowProgress(input.plan, input.progress);

  const { physicalPitchSourceId, planSourceId, executionSourceId, revision, plan, progress } = input;
  const namespace = (kind: string, ...suffix: readonly string[]): string => JSON.stringify([kind, physicalPitchSourceId, planSourceId, ...suffix]);
  const sourceId = namespace('scheduled-field-throw');
  const actionKey = namespace('scheduled-field-throw-action');
  const dueTick = plan.transfer.throwReadyTick;
  const currentTick = progress === null ? plan.input.cursor.moment.ball.tick : progress.field.motion.world.moment.ball.tick;
  const phase = progress?.kind ?? 'pending';
  const receiptScope = (kind: string): ScheduledFieldThrowReceiptScope => ({ physicalPitchSourceId, planSourceId, executionSourceId,
    revision, sourceId, eventId: namespace('scheduled-field-throw-event', executionSourceId, kind),
    generatedAtTick: currentTick, adoptedAtTick: currentTick, status: 'consumed' });
  const common = { sourceId, revision, intents: [], information: [], decisions: [], ruleWindows: [] };
  let source: LivePlaySource;
  let handoff: ScheduledFieldThrowBallHandoff | null = null;
  let receipts: readonly ScheduledFieldThrowEventReceipt[] = [];

  if (progress?.kind === 'released') {
    const receipt: ScheduledFieldThrowEventReceipt = { ...receiptScope('release'), kind: 'throw_released', cursor: progress.releaseCursor };
    receipts = [receipt];
    const toSourceId = namespace('scheduled-field-throw-ball', executionSourceId);
    const cursor = progress.field.motion.cursor;
    // The transfer source may finish only alongside this explicit still-open
    // successor. Its horizon is accepted coverage, never a predicted collision.
    const ballSource: LivePlaySource = { sourceId: toSourceId, revision: 1,
      physical: [{ workId: namespace('scheduled-field-throw-work', executionSourceId, 'ball'),
        kind: cursor === null ? 'possession_transition' : 'ball_motion',
        throughTick: cursor === null ? currentTick : plan.input.throughTick, actionKey: namespace('scheduled-field-throw-ball-action', executionSourceId) }],
      intents: [], information: [], decisions: [], ruleWindows: [],
      queue: { sourceId: toSourceId, settledThroughTick: currentTick - 1, nextPendingTick: null } };
    // A launch can encounter a boundary at the very same instant. Preserve the
    // actual response, including a null unresolved cursor, rather than reviving
    // the pre-response release cursor kept by the receipt.
    handoff = { fromSourceId: sourceId, toSourceId, basisEventId: receipt.eventId, cursor, field: progress.field, source: ballSource };
    source = { ...common, physical: [], queue: { sourceId, settledThroughTick: currentTick, nextPendingTick: null },
      completion: { completedAtTick: currentTick, basisEventId: receipt.eventId } };
  } else {
    const physical: PendingPhysicalWork[] = [];
    if (progress?.kind === 'interrupted') {
      receipts = [{ ...receiptScope('interruption'), kind: 'throw_interrupted', field: progress.field }];
      physical.push({ workId: namespace('scheduled-field-throw-work', 'contact'), kind: 'possession_transition',
        actorId: plan.input.carrierPlayerId!, throughTick: currentTick, actionKey });
    } else {
      physical.push({ workId: namespace('scheduled-field-throw-work', 'throw'), kind: 'throw',
        actorId: plan.input.carrierPlayerId!, throughTick: dueTick, actionKey });
      physical.push({ workId: namespace('scheduled-field-throw-work', 'transfer'), kind: 'possession_transition',
        actorId: plan.input.carrierPlayerId!, throughTick: dueTick, actionKey });
    }
    // Even a known future release does not prove absence of earlier contacts.
    // The current recorded tick can still contain an unexecuted physical event.
    // A collision leaves contact work open, with no invented next event time.
    source = { ...common, physical, queue: { sourceId, settledThroughTick: currentTick - 1,
      nextPendingTick: progress?.kind === 'interrupted' ? null : dueTick } };
  }
  resolveEventQueueWatermark(currentTick, [source.queue!, ...(handoff === null ? [] : [handoff.source.queue!])]);
  return freezeBattedWorldField({ physicalPitchSourceId, planSourceId, executionSourceId, phase, dueTick, source, receipts, handoff });
};
