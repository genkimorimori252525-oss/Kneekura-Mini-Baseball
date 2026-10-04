import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { freezeBattedWorldField, hasBattedWorldFieldFields } from '../ball/BattedWorldFieldExecution';
import { validateBattedWorldScheduledFieldAcquisitionPlan, validateBattedWorldScheduledFieldAcquisitionProgress } from '../ball/BattedWorldScheduledFieldAcquisition';
import { resolveEventQueueWatermark } from './EventQueueWatermark';
import type { BallWorldMoment } from '../ball/BallWorldContinuation';
import type { BattedWorldBallCursor } from '../ball/BattedWorldContinuation';
import type { BattedWorldFieldAcquisition } from '../ball/BattedWorldFieldAcquisition';
import type { BattedWorldScheduledFieldAcquisitionPlan, BattedWorldScheduledFieldAcquisitionAdvance } from '../ball/BattedWorldScheduledFieldAcquisition';
import type { LivePlaySource } from './LivePlayRegistry';
import type { PendingPhysicalWork } from './ActionFrontier';

export type ScheduledFieldAcquisitionLiveWorkInput = Readonly<{
  physicalPitchSourceId: string;
  planSourceId: string;
  executionSourceId: string;
  revision: number;
  plan: BattedWorldScheduledFieldAcquisitionPlan;
  progress: BattedWorldScheduledFieldAcquisitionAdvance | null;
}>;

type ScheduledFieldAcquisitionReceiptScope = Readonly<{
  physicalPitchSourceId: string;
  planSourceId: string;
  executionSourceId: string;
  revision: number;
  sourceId: string;
  eventId: string;
  generatedAtTick: number;
  adoptedAtTick: number;
  /** Adoption by this capture owner only; rule consumption stays pending. */
  status: 'consumed';
}>;

type SecuredAcquisition = Extract<BattedWorldFieldAcquisition, { kind: 'secured' }>;
export type ScheduledFieldAcquisitionEventReceipt = ScheduledFieldAcquisitionReceiptScope & (
  Readonly<{ kind: 'acquisition_confirmed'; acquisition: SecuredAcquisition; confirmationMoment: BallWorldMoment; cursor: BattedWorldBallCursor }>
  | Readonly<{ kind: 'acquisition_interrupted'; acquisition: Extract<BattedWorldFieldAcquisition, { kind: 'interrupted' }> }>
);

type ScheduledFieldAcquisitionHandoffScope = Readonly<{
  fromSourceId: string;
  toSourceId: string;
  basisEventId: string;
  source: LivePlaySource;
}>;
export type ScheduledFieldAcquisitionHandoff = ScheduledFieldAcquisitionHandoffScope & (
  Readonly<{ kind: 'custody'; cursor: BattedWorldBallCursor }>
  | Readonly<{ kind: 'rule_evidence'; acquisition: SecuredAcquisition; status: 'pending' }>
);

export type ScheduledFieldAcquisitionLiveWork = Readonly<{
  physicalPitchSourceId: string;
  planSourceId: string;
  executionSourceId: string;
  phase: 'pending' | BattedWorldScheduledFieldAcquisitionAdvance['kind'];
  dueTick: number;
  source: LivePlaySource;
  receipts: readonly ScheduledFieldAcquisitionEventReceipt[];
  handoffs: readonly ScheduledFieldAcquisitionHandoff[];
}>;

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();

/**
 * Projects one validated, actually executed capture lifecycle. Native must bind
 * the Source IDs and persist receipts and all successor work in the same write.
 * This is not a complete play registry or authority to settle actors or rules.
 */
export const deriveScheduledFieldAcquisitionLiveWork = (raw: ScheduledFieldAcquisitionLiveWorkInput): ScheduledFieldAcquisitionLiveWork => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['physicalPitchSourceId', 'planSourceId', 'executionSourceId', 'revision', 'plan', 'progress'])
    || !id(input.physicalPitchSourceId) || !id(input.planSourceId) || !id(input.executionSourceId)) {
    throw new Error('invalid scheduled field acquisition live-work scope');
  }
  if (!Number.isSafeInteger(input.revision) || input.revision <= 0) throw new Error('invalid scheduled field acquisition source revision');
  validateBattedWorldScheduledFieldAcquisitionPlan(input.plan);
  if (input.progress !== null) validateBattedWorldScheduledFieldAcquisitionProgress(input.plan, input.progress);

  const { physicalPitchSourceId, planSourceId, executionSourceId, revision, plan, progress } = input;
  const namespace = (kind: string, ...suffix: readonly string[]): string => JSON.stringify([kind, physicalPitchSourceId, planSourceId, ...suffix]);
  const sourceId = namespace('scheduled-field-acquisition');
  const actionKey = namespace('scheduled-field-acquisition-action');
  const dueTick = plan.candidateSecureTick;
  const currentTick = progress === null ? plan.contactMoment.ball.tick : progress.world.moment.ball.tick;
  const phase = progress?.kind ?? 'pending';
  const receiptScope = (kind: string): ScheduledFieldAcquisitionReceiptScope => ({ physicalPitchSourceId, planSourceId, executionSourceId,
    revision, sourceId, eventId: namespace('scheduled-field-acquisition-event', executionSourceId, kind),
    generatedAtTick: currentTick, adoptedAtTick: currentTick, status: 'consumed' });
  const common = { sourceId, revision, intents: [], information: [], decisions: [], ruleWindows: [] };
  let source: LivePlaySource;
  let receipts: readonly ScheduledFieldAcquisitionEventReceipt[] = [];
  let handoffs: readonly ScheduledFieldAcquisitionHandoff[] = [];

  if (progress?.kind === 'secured') {
    const receipt: ScheduledFieldAcquisitionEventReceipt = { ...receiptScope('confirmation'), kind: 'acquisition_confirmed',
      acquisition: progress.acquisition, confirmationMoment: progress.world.moment, cursor: progress.cursor };
    receipts = [receipt];
    const custodySourceId = namespace('scheduled-field-acquisition-custody', executionSourceId);
    const custodySource: LivePlaySource = { sourceId: custodySourceId, revision: 1,
      physical: [{ workId: namespace('scheduled-field-acquisition-work', executionSourceId, 'ball'), kind: 'ball_motion',
        actorId: plan.acquirerPlayerId, throughTick: plan.coverageThroughTick,
        actionKey: namespace('scheduled-field-acquisition-custody-action', executionSourceId) }],
      intents: [], information: [], decisions: [], ruleWindows: [],
      queue: { sourceId: custodySourceId, settledThroughTick: currentTick - 1, nextPendingTick: null } };
    const ruleSourceId = namespace('scheduled-field-acquisition-rule-evidence', executionSourceId);
    // These facts become available only at confirmation. Their historical secure
    // moment remains in the acquisition, while consumption awaits the rule owner.
    // An uncompleted source with a pending queue is sufficient; a live-rule window
    // would invent policy not established by capture physics.
    const ruleSource: LivePlaySource = { sourceId: ruleSourceId, revision: 1,
      physical: [], intents: [], information: [], decisions: [], ruleWindows: [],
      queue: { sourceId: ruleSourceId, settledThroughTick: currentTick - 1, nextPendingTick: currentTick } };
    handoffs = [
      { kind: 'custody', fromSourceId: sourceId, toSourceId: custodySourceId, basisEventId: receipt.eventId,
        cursor: progress.cursor, source: custodySource },
      { kind: 'rule_evidence', fromSourceId: sourceId, toSourceId: ruleSourceId, basisEventId: receipt.eventId,
        acquisition: progress.acquisition, status: 'pending', source: ruleSource },
    ];
    // Completion belongs only to this capture source. Its two successors must be
    // persisted alongside it; neither is proof of full-play event settlement.
    source = { ...common, physical: [], queue: { sourceId, settledThroughTick: currentTick, nextPendingTick: null },
      completion: { completedAtTick: currentTick, basisEventId: receipt.eventId } };
  } else {
    const physical: PendingPhysicalWork[] = [];
    if (progress?.kind === 'interrupted') {
      receipts = [{ ...receiptScope('interruption'), kind: 'acquisition_interrupted', acquisition: progress.acquisition }];
      physical.push({ workId: namespace('scheduled-field-acquisition-work', 'contact'), kind: 'possession_transition',
        actorId: plan.acquirerPlayerId, throughTick: currentTick, actionKey });
    } else {
      physical.push({ workId: namespace('scheduled-field-acquisition-work', 'capture'), kind: 'reception',
        actorId: plan.acquirerPlayerId, throughTick: dueTick, actionKey });
      physical.push({ workId: namespace('scheduled-field-acquisition-work', 'possession'), kind: 'possession_transition',
        actorId: plan.acquirerPlayerId, throughTick: dueTick, actionKey });
    }
    // Zero energy inside the recorded-tick fence still leaves same-tick events
    // unproved. An interruption leaves contact policy open without a made-up due time.
    source = { ...common, physical, queue: { sourceId, settledThroughTick: currentTick - 1,
      nextPendingTick: progress?.kind === 'interrupted' ? null : dueTick } };
  }
  resolveEventQueueWatermark(currentTick, [source.queue!, ...handoffs.map((handoff) => handoff.source.queue!)]);
  return freezeBattedWorldField({ physicalPitchSourceId, planSourceId, executionSourceId, phase, dueTick, source, receipts, handoffs });
};
