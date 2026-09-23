import type { BaseOccupancy, CanonicalMatchState } from '../model/CanonicalMatchState';
import type { RuleProfileId } from '../model/RuleProfileRef';
import type { PlayEndFact } from '../rules/PhysicalRuleFacts';
import {
  applyResolvedLiveBallPlateAppearanceToMatchState,
  type ResolvedLiveBallPlateAppearance,
} from '../sim/plateAppearance/PlateAppearanceMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';

export type OfficialGameplayRuling = Readonly<{
  outsAfter: number;
  basesAfter: BaseOccupancy;
  scoredRunnerIds: readonly string[];
}>;

export type CorrectRuleSnapshot = Readonly<{
  snapshotId: string;
  evidenceRevision: number;
  ruling: OfficialGameplayRuling;
}>;

export type OfficialStateWindowKind = 'appeal' | 'review' | 'challenge';
export type OfficialStateWindowCloseReason =
  | 'resolved'
  | 'expired'
  | 'declined'
  | 'defense_left_field'
  | 'next_play_fence';

export type OfficialStateWindow = Readonly<{
  windowId: string;
  windowKind: OfficialStateWindowKind;
  openedAtTick: number;
  closedAtTick: number | null;
  closeReason: OfficialStateWindowCloseReason | null;
}>;

export type OnFieldCall = Readonly<{
  callId: string;
  tick: number;
  basisSnapshotId: string;
  basisEvidenceRevision: number;
  ruling: OfficialGameplayRuling;
}>;

export type ReviewDecisionKind = 'confirmed' | 'stands' | 'overturned';

export type ReviewDecision = Readonly<{
  reviewId: string;
  tick: number;
  callId: string;
  basisSnapshotId: string;
  basisEvidenceRevision: number;
  decision: ReviewDecisionKind;
  replacementRuling: OfficialGameplayRuling | null;
}>;

export type FinalOfficialRuling = Readonly<{
  rulingId: string;
  source: 'correct_rule' | 'on_field_call' | 'review';
  basisEvidenceRevision: number;
  basisSnapshotId: string;
  basisCallId: string | null;
  basisReviewId: string | null;
  gameplay: OfficialGameplayRuling;
}>;

export type OfficialMatchStateDelta = Readonly<{
  outsAfter: number;
  basesAfter: BaseOccupancy;
  scoredRunnerIds: readonly string[];
  basisEvidenceRevision: number;
  basisRulingId: string;
}>;

export type OfficialPlayClosure = Readonly<{
  closureId: string;
  playId: number;
  closedAtTick: number;
  playEnd: PlayEndFact | null;
  finalRuling: FinalOfficialRuling;
  officialDelta: OfficialMatchStateDelta;
  openWindows: readonly [];
}>;

type EventBase = Readonly<{
  eventId: string;
  tick: number;
}>;

export type CorrectRuleSnapshotRecorded = EventBase & Readonly<{
  kind: 'CorrectRuleSnapshotRecorded';
  snapshot: CorrectRuleSnapshot;
}>;

export type OfficialStateWindowOpened = EventBase & Readonly<{
  kind: 'OfficialStateWindowOpened';
  windowId: string;
  windowKind: OfficialStateWindowKind;
}>;

export type OfficialStateWindowClosed = EventBase & Readonly<{
  kind: 'OfficialStateWindowClosed';
  windowId: string;
  reason: OfficialStateWindowCloseReason;
}>;

export type OnFieldCallRecorded = EventBase & Readonly<{
  kind: 'OnFieldCallRecorded';
  call: OnFieldCall;
}>;

export type ReviewDecisionRecorded = EventBase & Readonly<{
  kind: 'ReviewDecisionRecorded';
  review: ReviewDecision;
}>;

export type OfficialPlayClosed = EventBase & Readonly<{
  kind: 'OfficialPlayClosed';
  closureId: string;
  basisRulingId: string;
  basisEvidenceRevision: number;
}>;

export type PlayAdjudicationEvent =
  | CorrectRuleSnapshotRecorded
  | OfficialStateWindowOpened
  | OfficialStateWindowClosed
  | OnFieldCallRecorded
  | ReviewDecisionRecorded
  | OfficialPlayClosed;

export type PlayAdjudicationLedger = Readonly<{
  playId: number;
  ruleProfileId: RuleProfileId;
  playEnd: PlayEndFact | null;
  revision: number;
  events: readonly PlayAdjudicationEvent[];
}>;

export type PlayAdjudicationState =
  | Readonly<{
      kind: 'physical_play_ended';
      playEnd: PlayEndFact | null;
    }>
  | Readonly<{
      kind: 'official_adjudication_open';
      playEnd: PlayEndFact | null;
      latestCorrectRule: CorrectRuleSnapshot;
      calls: readonly OnFieldCall[];
      reviews: readonly ReviewDecision[];
      openWindows: readonly OfficialStateWindow[];
    }>
  | Readonly<{
      kind: 'official_closed';
      closure: OfficialPlayClosure;
    }>;

export type CorrectRuleSnapshotInput = Readonly<{
  eventId: string;
  tick: number;
  snapshotId: string;
  evidenceRevision: number;
  ruling: OfficialGameplayRuling;
}>;

export type OpenOfficialStateWindowInput = Readonly<{
  eventId: string;
  tick: number;
  windowId: string;
  windowKind: OfficialStateWindowKind;
}>;

export type CloseOfficialStateWindowInput = Readonly<{
  eventId: string;
  tick: number;
  windowId: string;
  reason: OfficialStateWindowCloseReason;
}>;

export type OnFieldCallInput = Readonly<{
  eventId: string;
  tick: number;
  callId: string;
  basisSnapshotId: string;
  basisEvidenceRevision: number;
  ruling: OfficialGameplayRuling;
}>;

export type ReviewDecisionInput = Readonly<{
  eventId: string;
  tick: number;
  reviewId: string;
  callId: string;
  basisSnapshotId: string;
  basisEvidenceRevision: number;
  decision: ReviewDecisionKind;
  replacementRuling: OfficialGameplayRuling | null;
}>;

export type CloseOfficialPlayInput = Readonly<{
  eventId: string;
  closureId: string;
  tick: number;
}>;

type Replay = {
  latestCorrect: CorrectRuleSnapshot | null;
  windows: Map<string, OfficialStateWindow>;
  calls: OnFieldCall[];
  callIds: Set<string>;
  reviews: ReviewDecision[];
  reviewIds: Set<string>;
  eventIds: Set<string>;
  snapshotIds: Set<string>;
  closure: OfficialPlayClosure | null;
  lastTick: number;
};

const cloneInertData = <T>(input: T, path = 'adjudication'): T => {
  const ancestors = new Set<object>();
  let nodes = 0;

  const visit = (value: unknown, currentPath: string, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error(`${currentPath} exceeds inert-data depth or size limits`);
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`${currentPath} must be finite`);
      return value === 0 ? 0 : value;
    }
    if (typeof value !== 'object') {
      throw new Error(`${currentPath} must contain inert data only`);
    }
    if (ancestors.has(value)) throw new Error(`${currentPath} must not contain cycles`);
    ancestors.add(value);

    let result: unknown;
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        throw new Error(`${currentPath} must be a dense inert array`);
      }
      const array: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${currentPath} must not contain active array properties`);
        }
        array.push(visit(descriptor.value, `${currentPath}[${index}]`, depth + 1));
      }
      result = array;
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error(`${currentPath} must be a plain inert object`);
      }
      const record: Record<string, unknown> = {};
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') throw new Error(`${currentPath} must not contain symbol properties`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error(`${currentPath} must not contain active properties`);
        }
        Object.defineProperty(record, key, {
          value: visit(descriptor.value, `${currentPath}.${key}`, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      result = record;
    }
    ancestors.delete(value);
    return result;
  };

  return visit(input, path, 0) as T;
};

const id = (value: string, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must not be empty`);
  return value;
};

const tick = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer tick`);
  return value;
};

const revision = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer revision`);
  return value;
};

const nextRevision = (value: number): number => {
  revision(value, 'ledger revision');
  const next = value + 1;
  if (!Number.isSafeInteger(next)) throw new Error('adjudication ledger revision overflow');
  return next;
};

const validatePlayEnd = (value: PlayEndFact | null): PlayEndFact | null => {
  if (value === null) return null;
  if (value.kind !== 'play_end') throw new Error('playEnd.kind must be play_end');
  tick(value.tick, 'playEnd.tick');
  if (value.reason !== 'live_action_complete' && value.reason !== 'dead_ball') {
    throw new Error('unknown playEnd reason');
  }
  return Object.freeze({ ...value });
};

const validateBases = (bases: BaseOccupancy): BaseOccupancy => {
  const values = [bases.first, bases.second, bases.third];
  for (const value of values) {
    if (value !== null && (typeof value !== 'string' || value.length === 0)) {
      throw new Error('official bases must contain null or non-empty runner ids');
    }
  }
  const occupied = values.filter((value): value is string => value !== null);
  if (new Set(occupied).size !== occupied.length) {
    throw new Error('official bases must contain unique runner ids');
  }
  return Object.freeze({ first: bases.first, second: bases.second, third: bases.third });
};

const validateRuling = (rulingInput: OfficialGameplayRuling): OfficialGameplayRuling => {
  const ruling = cloneInertData(rulingInput, 'adjudication.ruling');
  if (!Number.isInteger(ruling.outsAfter) || ruling.outsAfter < 0 || ruling.outsAfter > 3) {
    throw new Error('official outsAfter must be an integer from 0 through 3');
  }
  const basesAfter = validateBases(ruling.basesAfter);
  if (!Array.isArray(ruling.scoredRunnerIds)) {
    throw new Error('scoredRunnerIds must be an array');
  }
  const scoredRunnerIds = ruling.scoredRunnerIds.map((runnerId) => id(runnerId, 'scored runner id'));
  if (new Set(scoredRunnerIds).size !== scoredRunnerIds.length) {
    throw new Error('scoredRunnerIds must be unique');
  }
  const occupied = [basesAfter.first, basesAfter.second, basesAfter.third]
    .filter((value): value is string => value !== null);
  if (scoredRunnerIds.some((runnerId) => occupied.includes(runnerId))) {
    throw new Error('a scored runner cannot remain on an official base');
  }
  return Object.freeze({
    outsAfter: ruling.outsAfter,
    basesAfter,
    scoredRunnerIds: Object.freeze(scoredRunnerIds),
  });
};

const validateWindowKind = (value: OfficialStateWindowKind): OfficialStateWindowKind => {
  if (value !== 'appeal' && value !== 'review' && value !== 'challenge') {
    throw new Error('unknown official-state window kind');
  }
  return value;
};

const validateCloseReason = (value: OfficialStateWindowCloseReason): OfficialStateWindowCloseReason => {
  if (
    value !== 'resolved'
    && value !== 'expired'
    && value !== 'declined'
    && value !== 'defense_left_field'
    && value !== 'next_play_fence'
  ) {
    throw new Error('unknown official-state window close reason');
  }
  return value;
};

const validateReviewDecision = (value: ReviewDecisionKind): ReviewDecisionKind => {
  if (value !== 'confirmed' && value !== 'stands' && value !== 'overturned') {
    throw new Error('unknown review decision');
  }
  return value;
};

const freezeSnapshot = (snapshot: CorrectRuleSnapshot): CorrectRuleSnapshot => Object.freeze({
  snapshotId: id(snapshot.snapshotId, 'snapshotId'),
  evidenceRevision: revision(snapshot.evidenceRevision, 'evidenceRevision'),
  ruling: validateRuling(snapshot.ruling),
});

const freezeCall = (call: OnFieldCall): OnFieldCall => Object.freeze({
  callId: id(call.callId, 'callId'),
  tick: tick(call.tick, 'call tick'),
  basisSnapshotId: id(call.basisSnapshotId, 'basisSnapshotId'),
  basisEvidenceRevision: revision(call.basisEvidenceRevision, 'basisEvidenceRevision'),
  ruling: validateRuling(call.ruling),
});

const freezeReview = (review: ReviewDecision): ReviewDecision => {
  const decision = validateReviewDecision(review.decision);
  const replacementRuling = review.replacementRuling === null
    ? null
    : validateRuling(review.replacementRuling);
  if (decision === 'overturned' && replacementRuling === null) {
    throw new Error('overturned review requires replacementRuling');
  }
  if (decision !== 'overturned' && replacementRuling !== null) {
    throw new Error('confirmed/stands review must not supply replacementRuling');
  }
  return Object.freeze({
    reviewId: id(review.reviewId, 'reviewId'),
    tick: tick(review.tick, 'review tick'),
    callId: id(review.callId, 'review callId'),
    basisSnapshotId: id(review.basisSnapshotId, 'basisSnapshotId'),
    basisEvidenceRevision: revision(review.basisEvidenceRevision, 'basisEvidenceRevision'),
    decision,
    replacementRuling,
  });
};

const openWindows = (replay: Replay): readonly OfficialStateWindow[] =>
  Object.freeze([...replay.windows.values()].filter((stateWindow) => stateWindow.closedAtTick === null));

const latestCall = (replay: Replay): OnFieldCall | null =>
  replay.calls.length === 0 ? null : replay.calls[replay.calls.length - 1];

const latestReviewForCall = (replay: Replay, callId: string): ReviewDecision | null => {
  for (let index = replay.reviews.length - 1; index >= 0; index -= 1) {
    if (replay.reviews[index].callId === callId) return replay.reviews[index];
  }
  return null;
};

const deriveFinalRuling = (replay: Replay): FinalOfficialRuling => {
  const correct = replay.latestCorrect;
  if (correct === null) {
    throw new Error('correct-rule snapshot is required before official closure');
  }
  const call = latestCall(replay);
  if (call === null) {
    return Object.freeze({
      rulingId: correct.snapshotId,
      source: 'correct_rule',
      basisEvidenceRevision: correct.evidenceRevision,
      basisSnapshotId: correct.snapshotId,
      basisCallId: null,
      basisReviewId: null,
      gameplay: correct.ruling,
    });
  }

  const review = latestReviewForCall(replay, call.callId);
  if (review !== null) {
    if (
      review.basisEvidenceRevision !== correct.evidenceRevision
      || review.basisSnapshotId !== correct.snapshotId
    ) {
      throw new Error('official ruling is stale relative to correct-rule evidence');
    }
    const gameplay = review.decision === 'overturned'
      ? review.replacementRuling!
      : call.ruling;
    return Object.freeze({
      rulingId: review.reviewId,
      source: 'review',
      basisEvidenceRevision: review.basisEvidenceRevision,
      basisSnapshotId: review.basisSnapshotId,
      basisCallId: call.callId,
      basisReviewId: review.reviewId,
      gameplay,
    });
  }

  if (
    call.basisEvidenceRevision !== correct.evidenceRevision
    || call.basisSnapshotId !== correct.snapshotId
  ) {
    throw new Error('official ruling is stale relative to correct-rule evidence');
  }
  return Object.freeze({
    rulingId: call.callId,
    source: 'on_field_call',
    basisEvidenceRevision: call.basisEvidenceRevision,
    basisSnapshotId: call.basisSnapshotId,
    basisCallId: call.callId,
    basisReviewId: null,
    gameplay: call.ruling,
  });
};

const closureFrom = (
  ledger: Pick<PlayAdjudicationLedger, 'playId' | 'playEnd'>,
  close: OfficialPlayClosed,
  finalRuling: FinalOfficialRuling,
): OfficialPlayClosure => {
  if (
    close.basisRulingId !== finalRuling.rulingId
    || close.basisEvidenceRevision !== finalRuling.basisEvidenceRevision
  ) {
    throw new Error('closure basis does not match final official ruling');
  }
  const gameplay = finalRuling.gameplay;
  return Object.freeze({
    closureId: close.closureId,
    playId: ledger.playId,
    closedAtTick: close.tick,
    playEnd: ledger.playEnd,
    finalRuling,
    officialDelta: Object.freeze({
      outsAfter: gameplay.outsAfter,
      basesAfter: gameplay.basesAfter,
      scoredRunnerIds: gameplay.scoredRunnerIds,
      basisEvidenceRevision: finalRuling.basisEvidenceRevision,
      basisRulingId: finalRuling.rulingId,
    }),
    openWindows: Object.freeze([]) as readonly [],
  });
};

const replayLedger = (ledgerInput: PlayAdjudicationLedger): {
  ledger: PlayAdjudicationLedger;
  replay: Replay;
} => {
  const input = cloneInertData(ledgerInput, 'adjudication.ledger');
  const playId = revision(input.playId, 'playId');
  if (typeof input.ruleProfileId !== 'string' || input.ruleProfileId.length === 0) {
    throw new Error('ruleProfileId must not be empty');
  }
  const playEnd = validatePlayEnd(input.playEnd);
  const ledgerRevision = revision(input.revision, 'ledger revision');
  if (!Array.isArray(input.events)) throw new Error('adjudication events must be an array');
  if (ledgerRevision !== input.events.length) {
    throw new Error('adjudication ledger revision must equal event count');
  }

  const replay: Replay = {
    latestCorrect: null,
    windows: new Map(),
    calls: [],
    callIds: new Set(),
    reviews: [],
    reviewIds: new Set(),
    eventIds: new Set(),
    snapshotIds: new Set(),
    closure: null,
    lastTick: playEnd?.tick ?? 0,
  };
  const events: PlayAdjudicationEvent[] = [];

  for (const raw of input.events) {
    if (replay.closure !== null) throw new Error('official play is already closed');
    const event = raw as PlayAdjudicationEvent;
    id(event.eventId, 'adjudication eventId');
    if (replay.eventIds.has(event.eventId)) throw new Error('adjudication event ids must be unique');
    replay.eventIds.add(event.eventId);
    const eventTick = tick(event.tick, 'adjudication event tick');
    if (eventTick < replay.lastTick) {
      throw new Error('adjudication event ticks must be monotonic');
    }
    replay.lastTick = eventTick;

    if (event.kind === 'CorrectRuleSnapshotRecorded') {
      const snapshot = freezeSnapshot(event.snapshot);
      if (replay.snapshotIds.has(snapshot.snapshotId)) throw new Error('correct-rule snapshot ids must be unique');
      if (
        replay.latestCorrect !== null
        && snapshot.evidenceRevision <= replay.latestCorrect.evidenceRevision
      ) {
        throw new Error('correct-rule evidence revision must increase monotonically');
      }
      replay.snapshotIds.add(snapshot.snapshotId);
      replay.latestCorrect = snapshot;
      events.push(Object.freeze({ ...event, snapshot }));
      continue;
    }

    if (event.kind === 'OfficialStateWindowOpened') {
      const windowId = id(event.windowId, 'windowId');
      if (replay.windows.has(windowId)) throw new Error('official-state window ids must be unique');
      const stateWindow: OfficialStateWindow = Object.freeze({
        windowId,
        windowKind: validateWindowKind(event.windowKind),
        openedAtTick: eventTick,
        closedAtTick: null,
        closeReason: null,
      });
      replay.windows.set(windowId, stateWindow);
      events.push(Object.freeze({ ...event, windowId, windowKind: stateWindow.windowKind }));
      continue;
    }

    if (event.kind === 'OfficialStateWindowClosed') {
      const windowId = id(event.windowId, 'windowId');
      const existing = replay.windows.get(windowId);
      if (existing === undefined) throw new Error('official-state window does not exist');
      if (existing.closedAtTick !== null) throw new Error('official-state window is already closed');
      const reason = validateCloseReason(event.reason);
      replay.windows.set(windowId, Object.freeze({
        ...existing,
        closedAtTick: eventTick,
        closeReason: reason,
      }));
      events.push(Object.freeze({ ...event, windowId, reason }));
      continue;
    }

    if (event.kind === 'OnFieldCallRecorded') {
      const call = freezeCall(event.call);
      if (replay.callIds.has(call.callId)) throw new Error('on-field call ids must be unique');
      const correct = replay.latestCorrect;
      if (
        correct === null
        || call.basisEvidenceRevision !== correct.evidenceRevision
        || call.basisSnapshotId !== correct.snapshotId
      ) {
        throw new Error('on-field call must bind the latest correct-rule snapshot');
      }
      replay.callIds.add(call.callId);
      replay.calls.push(call);
      events.push(Object.freeze({ ...event, call }));
      continue;
    }

    if (event.kind === 'ReviewDecisionRecorded') {
      const review = freezeReview(event.review);
      if (replay.reviewIds.has(review.reviewId)) throw new Error('review ids must be unique');
      const call = replay.calls.find((candidate) => candidate.callId === review.callId);
      if (call === undefined) throw new Error('review must reference an existing on-field call');
      const correct = replay.latestCorrect;
      if (
        correct === null
        || review.basisEvidenceRevision !== correct.evidenceRevision
        || review.basisSnapshotId !== correct.snapshotId
      ) {
        throw new Error('review must bind the latest correct-rule snapshot');
      }
      replay.reviewIds.add(review.reviewId);
      replay.reviews.push(review);
      events.push(Object.freeze({ ...event, review }));
      continue;
    }

    if (event.kind === 'OfficialPlayClosed') {
      id(event.closureId, 'closureId');
      if (openWindows(replay).length > 0) throw new Error('official-state window remains open');
      const finalRuling = deriveFinalRuling(replay);
      const close: OfficialPlayClosed = Object.freeze({
        kind: 'OfficialPlayClosed',
        eventId: event.eventId,
        tick: eventTick,
        closureId: event.closureId,
        basisRulingId: id(event.basisRulingId, 'basisRulingId'),
        basisEvidenceRevision: revision(event.basisEvidenceRevision, 'basisEvidenceRevision'),
      });
      replay.closure = closureFrom(
        { playId, playEnd },
        close,
        finalRuling,
      );
      events.push(close);
      continue;
    }

    throw new Error('unknown adjudication event kind');
  }

  return {
    ledger: Object.freeze({
      playId,
      ruleProfileId: input.ruleProfileId,
      playEnd,
      revision: ledgerRevision,
      events: Object.freeze(events),
    }),
    replay,
  };
};

const requireOpen = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
): ReturnType<typeof replayLedger> => {
  const result = replayLedger(ledgerInput);
  revision(expectedRevision, 'expected adjudication ledger revision');
  if (result.ledger.revision !== expectedRevision) {
    throw new Error('stale adjudication ledger revision');
  }
  if (result.replay.closure !== null) {
    throw new Error('official play is already closed');
  }
  return result;
};

const append = (
  ledger: PlayAdjudicationLedger,
  event: PlayAdjudicationEvent,
): PlayAdjudicationLedger => Object.freeze({
  ...ledger,
  revision: nextRevision(ledger.revision),
  events: Object.freeze([...ledger.events, Object.freeze(event)]),
});

const ensureNewEventId = (replay: Replay, eventId: string): string => {
  const value = id(eventId, 'eventId');
  if (replay.eventIds.has(value)) throw new Error('adjudication event ids must be unique');
  return value;
};

const requireEventTick = (replay: Replay, value: number): number => {
  const result = tick(value, 'adjudication event tick');
  if (result < replay.lastTick) throw new Error('adjudication event ticks must be monotonic');
  return result;
};

export const createPlayAdjudicationLedger = (input: Readonly<{
  playId: number;
  ruleProfileId: RuleProfileId;
  playEnd: PlayEndFact | null;
}>): PlayAdjudicationLedger => {
  const request = cloneInertData(input, 'adjudication.create');
  const playId = revision(request.playId, 'playId');
  if (typeof request.ruleProfileId !== 'string' || request.ruleProfileId.length === 0) {
    throw new Error('ruleProfileId must not be empty');
  }
  return Object.freeze({
    playId,
    ruleProfileId: request.ruleProfileId,
    playEnd: validatePlayEnd(request.playEnd),
    revision: 0,
    events: Object.freeze([]),
  });
};

export const recordCorrectRuleSnapshot = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: CorrectRuleSnapshotInput,
): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.correctRule');
  const eventId = ensureNewEventId(replay, request.eventId);
  const eventTick = requireEventTick(replay, request.tick);
  const snapshot = freezeSnapshot({
    snapshotId: request.snapshotId,
    evidenceRevision: request.evidenceRevision,
    ruling: request.ruling,
  });
  if (replay.snapshotIds.has(snapshot.snapshotId)) throw new Error('correct-rule snapshot ids must be unique');
  if (
    replay.latestCorrect !== null
    && snapshot.evidenceRevision <= replay.latestCorrect.evidenceRevision
  ) {
    throw new Error('correct-rule evidence revision must increase monotonically');
  }
  return append(ledger, Object.freeze({
    kind: 'CorrectRuleSnapshotRecorded',
    eventId,
    tick: eventTick,
    snapshot,
  }));
};

export const openOfficialStateWindow = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: OpenOfficialStateWindowInput,
): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.openWindow');
  const eventId = ensureNewEventId(replay, request.eventId);
  const eventTick = requireEventTick(replay, request.tick);
  const windowId = id(request.windowId, 'windowId');
  if (replay.windows.has(windowId)) throw new Error('official-state window ids must be unique');
  return append(ledger, Object.freeze({
    kind: 'OfficialStateWindowOpened',
    eventId,
    tick: eventTick,
    windowId,
    windowKind: validateWindowKind(request.windowKind),
  }));
};

export const closeOfficialStateWindow = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: CloseOfficialStateWindowInput,
): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.closeWindow');
  const eventId = ensureNewEventId(replay, request.eventId);
  const eventTick = requireEventTick(replay, request.tick);
  const windowId = id(request.windowId, 'windowId');
  const stateWindow = replay.windows.get(windowId);
  if (stateWindow === undefined) throw new Error('official-state window does not exist');
  if (stateWindow.closedAtTick !== null) throw new Error('official-state window is already closed');
  return append(ledger, Object.freeze({
    kind: 'OfficialStateWindowClosed',
    eventId,
    tick: eventTick,
    windowId,
    reason: validateCloseReason(request.reason),
  }));
};

export const recordOnFieldCall = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: OnFieldCallInput,
): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.onFieldCall');
  const eventId = ensureNewEventId(replay, request.eventId);
  const eventTick = requireEventTick(replay, request.tick);
  const call = freezeCall({
    callId: request.callId,
    tick: eventTick,
    basisSnapshotId: request.basisSnapshotId,
    basisEvidenceRevision: request.basisEvidenceRevision,
    ruling: request.ruling,
  });
  if (replay.callIds.has(call.callId)) throw new Error('on-field call ids must be unique');
  const correct = replay.latestCorrect;
  if (
    correct === null
    || call.basisEvidenceRevision !== correct.evidenceRevision
    || call.basisSnapshotId !== correct.snapshotId
  ) {
    throw new Error('on-field call must bind the latest correct-rule snapshot');
  }
  return append(ledger, Object.freeze({
    kind: 'OnFieldCallRecorded',
    eventId,
    tick: eventTick,
    call,
  }));
};

export const recordReviewDecision = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: ReviewDecisionInput,
): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.review');
  const eventId = ensureNewEventId(replay, request.eventId);
  const eventTick = requireEventTick(replay, request.tick);
  const review = freezeReview({
    reviewId: request.reviewId,
    tick: eventTick,
    callId: request.callId,
    basisSnapshotId: request.basisSnapshotId,
    basisEvidenceRevision: request.basisEvidenceRevision,
    decision: request.decision,
    replacementRuling: request.replacementRuling,
  });
  if (replay.reviewIds.has(review.reviewId)) throw new Error('review ids must be unique');
  if (!replay.callIds.has(review.callId)) throw new Error('review must reference an existing on-field call');
  const correct = replay.latestCorrect;
  if (
    correct === null
    || review.basisEvidenceRevision !== correct.evidenceRevision
    || review.basisSnapshotId !== correct.snapshotId
  ) {
    throw new Error('review must bind the latest correct-rule snapshot');
  }
  return append(ledger, Object.freeze({
    kind: 'ReviewDecisionRecorded',
    eventId,
    tick: eventTick,
    review,
  }));
};

export const closeOfficialPlay = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: CloseOfficialPlayInput,
): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.closePlay');
  const eventId = ensureNewEventId(replay, request.eventId);
  const eventTick = requireEventTick(replay, request.tick);
  if (openWindows(replay).length > 0) throw new Error('official-state window remains open');
  const finalRuling = deriveFinalRuling(replay);
  return append(ledger, Object.freeze({
    kind: 'OfficialPlayClosed',
    eventId,
    tick: eventTick,
    closureId: id(request.closureId, 'closureId'),
    basisRulingId: finalRuling.rulingId,
    basisEvidenceRevision: finalRuling.basisEvidenceRevision,
  }));
};

export const getOfficialPlayClosure = (
  ledgerInput: PlayAdjudicationLedger,
): OfficialPlayClosure | null => replayLedger(ledgerInput).replay.closure;

export const getOfficialStateWindows = (
  ledgerInput: PlayAdjudicationLedger,
): readonly OfficialStateWindow[] => Object.freeze([...replayLedger(ledgerInput).replay.windows.values()]);

export const getPlayAdjudicationState = (
  ledgerInput: PlayAdjudicationLedger,
): PlayAdjudicationState => {
  const { ledger, replay } = replayLedger(ledgerInput);
  if (replay.closure !== null) {
    return Object.freeze({ kind: 'official_closed', closure: replay.closure });
  }
  if (replay.latestCorrect === null) {
    return Object.freeze({ kind: 'physical_play_ended', playEnd: ledger.playEnd });
  }
  return Object.freeze({
    kind: 'official_adjudication_open',
    playEnd: ledger.playEnd,
    latestCorrectRule: replay.latestCorrect,
    calls: Object.freeze([...replay.calls]),
    reviews: Object.freeze([...replay.reviews]),
    openWindows: openWindows(replay),
  });
};

export const deriveClosedLiveBallMatchState = (
  match: CanonicalMatchState,
  timeline: CanonicalPlateAppearanceTimeline,
  ledgerInput: PlayAdjudicationLedger,
): CanonicalMatchState => {
  const matchState = cloneInertData(match, 'adjudication.matchState') as CanonicalMatchState;
  const physicalTimeline = cloneInertData(
    timeline,
    'adjudication.physicalTimeline',
  ) as CanonicalPlateAppearanceTimeline;
  const { ledger, replay } = replayLedger(ledgerInput);
  const closure = replay.closure;
  if (closure === null) throw new Error('official play must be closed before deriving next MatchState');
  if (closure.playEnd === null) throw new Error('live-ball MatchState derivation requires physical PlayEnd');
  if (ledger.playId !== matchState.playId || physicalTimeline.playId !== ledger.playId) {
    throw new Error('adjudication playId must match MatchState and physical timeline');
  }
  if (ledger.ruleProfileId !== matchState.ruleProfileId) {
    throw new Error('adjudication rule profile must match CanonicalMatchState');
  }
  const resolution: ResolvedLiveBallPlateAppearance = {
    playEnd: closure.playEnd,
    outsAfter: closure.officialDelta.outsAfter,
    basesAfter: closure.officialDelta.basesAfter,
    scoredRunnerIds: closure.officialDelta.scoredRunnerIds,
  };
  return applyResolvedLiveBallPlateAppearanceToMatchState(
    matchState,
    physicalTimeline,
    resolution,
  );
};
