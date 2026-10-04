import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { freezeBattedWorldField } from '../ball/BattedWorldFieldExecution';
import { quantizeEventTick } from '../ExactEventTime';
import type { LivePlaySource } from './LivePlayRegistry';

export type ActualDecisionLiveMoment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
export type ActualDefensiveDecisionLiveWorkInput = Readonly<{
  physicalPitchSourceId: string; playerId: string; originDecisionSourceId: string; decisionSourceId: string; revision: number;
  originObservationSourceId: string; ticksPerSecond: number; availableAt: ActualDecisionLiveMoment;
  cut: Readonly<{ observationSourceId: string; baseFieldSourceId: string; executionSourceId: string | null; at: ActualDecisionLiveMoment }>;
  scheduling: Readonly<{ startedAtTick: number; decisionDelayTicks: number; decisionTick: number; firstStepDelayTicks: number; movementStartTick: number }>;
  lifecycle: Readonly<{ status: 'pending_decision' | 'pending_first_step' | 'issued'; issuedAt: ActualDecisionLiveMoment | null; issuedBySourceId: string | null }>;
  intentKind: 'ball_handler' | 'hold';
  evidence: Readonly<{ captureAt: ActualDecisionLiveMoment; confidence: number }> | null;
}>;
export type ActualDefensiveDecisionIssueReceipt = Readonly<{
  kind: 'intent_issued'; status: 'issued'; eventId: string; sourceId: string; decisionSourceId: string; revision: number;
  /** Availability of the owned issue receipt, not execution or motor consumption. */
  issuedAt: ActualDecisionLiveMoment;
}>;
export type ActualDefensiveDecisionMotorHandoff = Readonly<{
  kind: 'motor_adoption'; status: 'pending'; fromSourceId: string; toSourceId: string; basisEventId: string;
  due: ActualDecisionLiveMoment; availableAt: ActualDecisionLiveMoment; source: LivePlaySource;
}>;
export type ActualDefensiveDecisionLiveWork = Readonly<{
  physicalPitchSourceId: string; playerId: string; originDecisionSourceId: string; decisionSourceId: string; revision: number;
  originObservationSourceId: string; availableAt: ActualDecisionLiveMoment; ticksPerSecond: number;
  cut: ActualDefensiveDecisionLiveWorkInput['cut']; intentKind: ActualDefensiveDecisionLiveWorkInput['intentKind'];
  evidence: ActualDefensiveDecisionLiveWorkInput['evidence']; phase: ActualDefensiveDecisionLiveWorkInput['lifecycle']['status'];
  deadlines: Readonly<{ decision: ActualDecisionLiveMoment; firstStep: ActualDecisionLiveMoment }>;
  source: LivePlaySource; receipts: readonly ActualDefensiveDecisionIssueReceipt[]; handoff: ActualDefensiveDecisionMotorHandoff | null;
}>;
const fields = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const sameMoment = (a: ActualDecisionLiveMoment, b: ActualDecisionLiveMoment) => a.originTick === b.originTick
  && a.elapsedSeconds === b.elapsedSeconds && a.tick === b.tick;

/**
 * Pure projection of one owned decision prefix, not an authority for supplied receipts.
 * Native must rederive that prefix and its observation cut on one connection/snapshot.
 * No queue coverage, actor settlement, physical adoption or all-play completeness is proved.
 */
export const deriveActualDefensiveDecisionLiveWork = (raw: ActualDefensiveDecisionLiveWorkInput): ActualDefensiveDecisionLiveWork => {
  const input = cloneInert(raw);
  if (!fields(input, ['physicalPitchSourceId', 'playerId', 'originDecisionSourceId', 'decisionSourceId', 'revision', 'originObservationSourceId',
    'ticksPerSecond', 'availableAt', 'cut', 'scheduling', 'lifecycle', 'intentKind', 'evidence'])
    || ![input.physicalPitchSourceId, input.playerId, input.originDecisionSourceId, input.decisionSourceId, input.originObservationSourceId].every(id)
    || !tick(input.revision) || input.revision === 0 || !tick(input.ticksPerSecond) || input.ticksPerSecond === 0
    || !fields(input.cut, ['observationSourceId', 'baseFieldSourceId', 'executionSourceId', 'at'])
    || !id(input.cut.observationSourceId) || !id(input.cut.baseFieldSourceId)
    || input.cut.executionSourceId !== null && !id(input.cut.executionSourceId)
    || !fields(input.scheduling, ['startedAtTick', 'decisionDelayTicks', 'decisionTick', 'firstStepDelayTicks', 'movementStartTick'])
    || !Object.values(input.scheduling).every(tick)
    || !fields(input.lifecycle, ['status', 'issuedAt', 'issuedBySourceId'])
    || !['ball_handler', 'hold'].includes(input.intentKind)) throw new Error('invalid actual defensive decision live-work scope');
  const { availableAt, cut, scheduling: s, lifecycle: life, ticksPerSecond: p } = input;
  const validMoment = (m: ActualDecisionLiveMoment) => fields(m, ['originTick', 'elapsedSeconds', 'tick'])
    && tick(m.originTick) && tick(m.tick) && Number.isFinite(m.elapsedSeconds) && m.elapsedSeconds >= 0
    && quantizeEventTick(m.originTick, m.elapsedSeconds, p) === m.tick;
  if (!validMoment(availableAt) || !validMoment(cut.at) || cut.at.originTick !== availableAt.originTick
    || cut.at.elapsedSeconds < availableAt.elapsedSeconds
    || input.revision === 1 && (input.decisionSourceId !== input.originDecisionSourceId
      || cut.observationSourceId !== input.originObservationSourceId || !sameMoment(cut.at, availableAt))
    || input.revision > 1 && (input.decisionSourceId === input.originDecisionSourceId
      || cut.observationSourceId === input.originObservationSourceId || cut.at.elapsedSeconds <= availableAt.elapsedSeconds)) {
    throw new Error('actual defensive decision live-work cut differs');
  }
  const seconds = (t: number) => (t - availableAt.originTick) / p;
  if (s.startedAtTick < availableAt.originTick || seconds(s.startedAtTick) < availableAt.elapsedSeconds
    || s.startedAtTick > availableAt.originTick && seconds(s.startedAtTick - 1) >= availableAt.elapsedSeconds
    || !Number.isSafeInteger(s.startedAtTick + s.decisionDelayTicks) || s.decisionTick !== s.startedAtTick + s.decisionDelayTicks
    || !Number.isSafeInteger(s.decisionTick + s.firstStepDelayTicks) || s.movementStartTick !== s.decisionTick + s.firstStepDelayTicks
    || !Number.isFinite(seconds(s.movementStartTick))) throw new Error('invalid actual defensive decision live-work deadlines');
  if (input.evidence !== null && (!fields(input.evidence, ['captureAt', 'confidence']) || !validMoment(input.evidence.captureAt)
    || input.evidence.captureAt.originTick !== availableAt.originTick || input.evidence.captureAt.elapsedSeconds > availableAt.elapsedSeconds
    || !Number.isFinite(input.evidence.confidence) || input.evidence.confidence < 0 || input.evidence.confidence > 1)
    || (input.intentKind === 'hold') !== (input.evidence === null)) throw new Error('invalid actual defensive decision live-work evidence');
  const phase = cut.at.elapsedSeconds >= seconds(s.movementStartTick) ? 'issued'
    : cut.at.elapsedSeconds >= seconds(s.decisionTick) ? 'pending_first_step' : 'pending_decision';
  if (phase !== life.status || (phase === 'issued' ? life.issuedAt === null || !validMoment(life.issuedAt)
    || !sameMoment(life.issuedAt, cut.at) || life.issuedBySourceId !== input.decisionSourceId
    : life.issuedAt !== null || life.issuedBySourceId !== null)) throw new Error('actual defensive decision live-work lifecycle differs');
  const { physicalPitchSourceId, playerId, originDecisionSourceId, decisionSourceId, revision, originObservationSourceId, intentKind, evidence } = input;
  const namespace = (kind: string, ...suffix: readonly (string | number)[]) => JSON.stringify([kind, physicalPitchSourceId, playerId, originDecisionSourceId, ...suffix]);
  const sourceId = namespace('actual-defensive-decision'), motorSourceId = namespace('actual-defensive-decision-motor');
  const deadline = (t: number): ActualDecisionLiveMoment => ({ originTick: availableAt.originTick, elapsedSeconds: seconds(t), tick: t });
  const deadlines = { decision: deadline(s.decisionTick), firstStep: deadline(s.movementStartTick) };
  const intent = { workId: namespace('actual-defensive-decision-work', 'motor'), kind: 'issued_intent' as const, actorId: playerId,
    dueTick: s.movementStartTick, actionKey: namespace('actual-defensive-decision-motor-action') };
  const empty = { physical: [], intents: [], information: [], decisions: [], ruleWindows: [], queue: null };
  let source: LivePlaySource = { ...empty, sourceId, revision }, receipts: readonly ActualDefensiveDecisionIssueReceipt[] = [];
  let handoff: ActualDefensiveDecisionMotorHandoff | null = null;
  if (phase === 'pending_decision') source = { ...source, decisions: [{ workId: namespace('actual-defensive-decision-work', 'decision'),
    kind: 'actor_decision', actorId: playerId, dueTick: s.decisionTick }] };
  else if (phase === 'pending_first_step') source = { ...source, intents: [intent] };
  else {
    const receipt: ActualDefensiveDecisionIssueReceipt = { kind: 'intent_issued', status: 'issued',
      eventId: namespace('actual-defensive-decision-event', decisionSourceId, revision, 'issued'), sourceId, decisionSourceId, revision, issuedAt: cut.at };
    receipts = [receipt];
    // Only this decision lifecycle finishes; the unchanged original motor deadline remains open.
    source = { ...source, completion: { completedAtTick: cut.at.tick, basisEventId: receipt.eventId } };
    handoff = { kind: 'motor_adoption', status: 'pending', fromSourceId: sourceId, toSourceId: motorSourceId,
      basisEventId: receipt.eventId, due: deadlines.firstStep, availableAt: cut.at,
      source: { ...empty, sourceId: motorSourceId, revision, intents: [intent] } };
  }
  return freezeBattedWorldField({ physicalPitchSourceId, playerId, originDecisionSourceId, decisionSourceId, revision, originObservationSourceId,
    availableAt, ticksPerSecond: p, cut, intentKind, evidence, phase, deadlines, source, receipts, handoff });
};
