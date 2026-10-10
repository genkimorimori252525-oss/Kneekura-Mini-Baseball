import { quantizeEventTick } from '../sim/ExactEventTime';
import type { BaseOccupancy, CanonicalMatchState } from '../model/CanonicalMatchState';
import type { RuleProfileId } from '../model/RuleProfileRef';
import type { PlayEndFact } from '../rules/PhysicalRuleFacts';
import type { DefensiveAppealAttemptFact } from '../rules/PhysicalRuleFacts';
import { evaluateTagUpCompliance, type TagUpComplianceInput } from '../rules/TagUpCompliance';
import { evaluateBallWorldTagUpCompliance } from '../rules/BallWorldTagUpCompliance';
import { resolveTagUpAppeal, type TagUpAppealResult } from '../rules/TagUpAppealRule';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from '../rules/RuleProfile';
import {
  applyResolvedLiveBallPlateAppearanceToMatchState,
  type ResolvedLiveBallPlateAppearance,
} from '../sim/plateAppearance/PlateAppearanceMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';

/** Native pins this history and first contact to their original physical sources.
 * Core validates their chronology and preserves it across appeal ledger replay. */
export type BallWorldAppealComplianceEvidence = Parameters<typeof evaluateBallWorldTagUpCompliance>[0]
  & Readonly<{ kind: 'ball_world_tag_up_history_v1' }>;
export type TagUpAppealComplianceEvidence = TagUpComplianceInput | BallWorldAppealComplianceEvidence;

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

/** Evidence that cannot support a correct gameplay ruling at the model's resolution. */
export type UnresolvedCorrectRuleSnapshot = Readonly<{
  snapshotId: string;
  evidenceRevision: number;
  resolution: 'unresolved';
  reason: 'exact_simultaneity' | 'insufficient_evidence';
}>;

export type CorrectRuleEvidenceSnapshot = CorrectRuleSnapshot | UnresolvedCorrectRuleSnapshot;

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

export type UnresolvedCorrectRuleSnapshotRecorded = EventBase & Readonly<{
  kind: 'UnresolvedCorrectRuleSnapshotRecorded';
  snapshot: UnresolvedCorrectRuleSnapshot;
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

export type DefensiveAppealAttemptRecorded = EventBase & Readonly<{
  kind: 'DefensiveAppealAttemptRecorded';
  windowId: string;
  timing: 'timely' | 'expired' | 'simultaneous_unresolved';
  attempt: DefensiveAppealAttemptFact;
  complianceEvidence: TagUpAppealComplianceEvidence;
}>;

export type OnFieldCallRecorded = EventBase & Readonly<{
  kind: 'OnFieldCallRecorded';
  call: OnFieldCall;
}>;

/** Opaque identity bindings. Native must rederive the actual owners; hashes alone are not proof. */
export type OwnedLiveCallSourceReference = Readonly<{
  owner: string; sourceId: string; sourceVersion: string; sourceHash: string; snapshotHash: string;
}>;
export type OwnedLiveCallImportProvenance = Readonly<{
  version: 'owned_live_call_import_v1'; playId: number; gameId: string; physicalPitchSourceId: string;
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>;
  calledAtElapsedSeconds: number; availableAtElapsedSeconds: number; importedAtElapsedSeconds: number;
  call: OwnedLiveCallSourceReference; perception: OwnedLiveCallSourceReference;
  policy: OwnedLiveCallSourceReference; ruleEvidence: OwnedLiveCallSourceReference;
  reception: OwnedLiveCallSourceReference | null;
}>;
export type OwnedLiveCallImported = EventBase & Readonly<{
  kind: 'OwnedLiveCallImported'; call: OnFieldCall; provenance: OwnedLiveCallImportProvenance;
}>;
export type OwnedLiveCallImportInput = Omit<OwnedLiveCallImported, 'kind'>;

/** Missing evidence owner, not an adjudicated appeal result. A rights-admission
 * event must bind this same original execution to authenticated live-ball/window,
 * territory and forfeiture evidence under the ledger's RuleProfile before clearing it. */
export type OwnedLiveAppealRightsDependency = Readonly<{
  kind: 'pending'; reason: 'original_live_ball_and_appeal_rights_required';
}>;
export type OwnedLiveAppealImportProvenance = Readonly<{
  version: 'owned_live_appeal_import_v1'; playId: number; gameId: string; physicalPitchSourceId: string;
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>;
  indicatedAtElapsedSeconds: number; executedAtElapsedSeconds: number; importedAtElapsedSeconds: number;
  indication: OwnedLiveCallSourceReference; throwPlan: OwnedLiveCallSourceReference; execution: OwnedLiveCallSourceReference;
}>;
export type OwnedLiveAppealImported = EventBase & Readonly<{
  kind: 'OwnedLiveAppealImported'; attempt: DefensiveAppealAttemptFact;
  complianceEvidence: BallWorldAppealComplianceEvidence;
  provenance: OwnedLiveAppealImportProvenance; rights: OwnedLiveAppealRightsDependency;
}>;
export type OwnedLiveAppealImportInput = Omit<OwnedLiveAppealImported, 'kind'>;

export type OwnedLiveAppealRightsMoment = Readonly<{
  originTick: number; elapsedSeconds: number; tick: number;
}>;
export type OwnedLiveAppealLiveEvidence = Readonly<{ kind: 'live'; playDeclaration: OwnedLiveCallSourceReference;
  at: OwnedLiveAppealRightsMoment; coveredThroughElapsedSeconds: number;
  initialContinuation?: OwnedLiveCallSourceReference }>;
/** Native authenticates complete legal-state and all purpose-throw histories,
 * including nonforfeited throws. These are the exact facts extracted from those
 * owners, not caller-selected eligibility flags. Core validates and interprets
 * the facts again on replay; it does not authenticate Source hashes or geometry. */
export type OwnedLiveAppealRightsEvidence = Readonly<{
  version: 'owned_live_appeal_rights_evidence_v1' | 'owned_live_appeal_rights_evidence_v2';
  liveAtExecution:
    | OwnedLiveAppealLiveEvidence
    | Readonly<{ kind: 'dead'; cause: OwnedLiveCallSourceReference; at: OwnedLiveAppealRightsMoment }>
    | Readonly<{ kind: 'unknown'; reason: 'initial_live_ball_owner_missing' | 'original_live_ball_coverage_required' }>;
  liveAtFirstTouch?: OwnedLiveAppealLiveEvidence;
  window: Readonly<{ openedAtElapsedSeconds: number; closedAtElapsedSeconds: number | null;
    closeReason: 'next_pitch_or_play' | 'defense_left_field' | null }>
    | Readonly<{ kind: 'unresolved'; reason: 'original_live_appeal_window_owner_required' }>
    | Readonly<{ kind: 'closed_by'; openedAtElapsedSeconds: number; closedNoLaterThanElapsedSeconds: number;
        closeReason: 'defense_left_field'; evidenceReference: OwnedLiveCallSourceReference }>;
  appealThrowForfeitures: readonly Readonly<{ indication: OwnedLiveCallSourceReference;
    throwPlan: OwnedLiveCallSourceReference; legalCoverage: OwnedLiveCallSourceReference;
    firstCertainDeadAtElapsedSeconds: number }>[];
}>;
export type OwnedLiveAppealRightsAdmissionProvenance = Readonly<{
  version: 'owned_live_appeal_rights_admission_v1'; originalImport: OwnedLiveAppealImportProvenance;
  admittedAtElapsedSeconds: number; legalState: OwnedLiveCallSourceReference; venue: OwnedLiveCallSourceReference;
}>;
/** A correct-rule appeal result is evidence for a refreshed snapshot and call;
 * this disposition is never itself an official ruling or a MatchState update. */
export type OwnedLiveAppealRightsDisposition =
  | Readonly<{ kind: 'eligible'; result: TagUpAppealResult }>
  | Readonly<{ kind: 'ineligible'; reason: 'dead_ball' | 'appeal_throw_forfeited' | 'appeal_window_expired' }>;
export type OwnedLiveAppealRightsAdmitted = EventBase & Readonly<{
  kind: 'OwnedLiveAppealRightsAdmitted'; provenance: OwnedLiveAppealRightsAdmissionProvenance;
  evidence: OwnedLiveAppealRightsEvidence; disposition: OwnedLiveAppealRightsDisposition;
}>;
export type OwnedLiveAppealRightsAdmissionInput = Omit<OwnedLiveAppealRightsAdmitted, 'kind' | 'disposition'>;

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
  | UnresolvedCorrectRuleSnapshotRecorded
  | OfficialStateWindowOpened
  | OfficialStateWindowClosed
  | DefensiveAppealAttemptRecorded
  | OnFieldCallRecorded
  | OwnedLiveCallImported
  | OwnedLiveAppealImported
  | OwnedLiveAppealRightsAdmitted
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
      latestCorrectRule: CorrectRuleEvidenceSnapshot;
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

export type UnresolvedCorrectRuleSnapshotInput = Readonly<{
  eventId: string;
  tick: number;
  snapshotId: string;
  evidenceRevision: number;
  reason: UnresolvedCorrectRuleSnapshot['reason'];
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

export type DefensiveAppealAttemptInput = Readonly<{
  eventId: string;
  windowId: string;
  timing: DefensiveAppealAttemptRecorded['timing'];
  attempt: DefensiveAppealAttemptFact;
  complianceEvidence: TagUpAppealComplianceEvidence;
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
  latestCorrect: CorrectRuleEvidenceSnapshot | null;
  windows: Map<string, OfficialStateWindow>;
  calls: OnFieldCall[];
  callIds: Set<string>;
  reviews: ReviewDecision[];
  reviewIds: Set<string>;
  eventIds: Set<string>;
  snapshotIds: Set<string>;
  snapshots: Map<string, CorrectRuleEvidenceSnapshot>;
  closure: OfficialPlayClosure | null;
  lastTick: number;
  appealSnapshotPending: boolean;
  appealCallPending: boolean;
  pendingLiveAppeals: OwnedLiveAppealImported[];
  liveAppealExecutionIds: Set<string>;
  liveAppealRightsAdmissions: OwnedLiveAppealRightsAdmitted[];
  liveAppealCallPending: boolean;
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

const freezeAppealEvidence = (
  attemptInput: DefensiveAppealAttemptFact,
  evidenceInput: TagUpAppealComplianceEvidence,
  eventTick: number,
  physicalEndTick: number,
): Pick<DefensiveAppealAttemptRecorded, 'attempt' | 'complianceEvidence'> => {
  const attempt = cloneInertData(attemptInput, 'adjudication.appealAttempt');
  const evidence = cloneInertData(evidenceInput, 'adjudication.appealEvidence');
  const factId = (value: unknown, name: string): void => {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must not be empty`);
  };
  if (attempt.kind !== 'defensive_appeal_attempt' || attempt.reason !== 'tag_up_early_departure') {
    throw new Error('tag-up appeal requires an actual defensive appeal attempt');
  }
  factId(attempt.defenderId, 'appeal defenderId');
  factId(attempt.runnerId, 'appeal runnerId');
  if (![1, 2, 3, 4].includes(attempt.base)) throw new Error('appeal base must be a baseball base');
  if (tick(attempt.tick, 'appeal tick') !== eventTick) throw new Error('appeal attempt tick must match event tick');
  if ('kind' in evidence) {
    if (evidence.kind !== 'ball_world_tag_up_history_v1') throw new Error('unknown exact appeal evidence');
    factId(evidence.firstTouch.fact.fielderId, 'firstTouch fielderId');
    const compliance = evaluateBallWorldTagUpCompliance(evidence);
    if (compliance.kind === 'pending') throw new Error('appeal requires supported original contact history');
    if (attempt.runnerId !== compliance.runnerId || attempt.base !== compliance.originBase)
      throw new Error('appeal must target the original exact-history runner and base');
    const horizon = quantizeEventTick(evidence.history.originTick, evidence.history.endElapsedSeconds, evidence.history.ticksPerSecond);
    if (horizon !== physicalEndTick || horizon > eventTick) throw new Error('exact appeal history must end at the original physical PlayEnd');
    const freeze = <T>(value: T): T => {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
      return value;
    };
    return { attempt: Object.freeze(attempt), complianceEvidence: freeze(evidence) };
  }
  factId(evidence.runnerId, 'tag-up runnerId');
  if (![1, 2, 3, 4].includes(evidence.originBase)) throw new Error('tag-up origin must be a baseball base');
  if (evidence.firstTouch.kind !== 'fly_ball_first_fielder_touch') throw new Error('firstTouch kind is invalid');
  factId(evidence.firstTouch.fielderId, 'firstTouch fielderId');
  tick(evidence.firstTouch.tick, 'firstTouch tick');
  if (evidence.departure.kind !== 'runner_base_departure') throw new Error('departure kind is invalid');
  factId(evidence.departure.runnerId, 'departure runnerId');
  tick(evidence.departure.tick, 'departure tick');
  if (evidence.retouch !== null) {
    if (evidence.retouch.kind !== 'runner_base_touch') throw new Error('retouch kind is invalid');
    factId(evidence.retouch.runnerId, 'retouch runnerId');
    tick(evidence.retouch.tick, 'retouch tick');
  }
  if (attempt.runnerId !== evidence.runnerId) throw new Error('appeal must target the evaluated runner');
  if (attempt.base !== evidence.originBase) throw new Error('appeal must target the tag-up origin base');
  if (evidence.firstTouch.tick > eventTick || evidence.departure.tick > eventTick
    || (evidence.retouch !== null && evidence.retouch.tick > eventTick)) {
    throw new Error('tag-up evidence cannot occur after the appeal attempt');
  }
  evaluateTagUpCompliance(evidence);
  return {
    attempt: Object.freeze(attempt),
    complianceEvidence: Object.freeze({
      ...evidence,
      firstTouch: Object.freeze(evidence.firstTouch),
      departure: Object.freeze(evidence.departure),
      retouch: evidence.retouch === null ? null : Object.freeze(evidence.retouch),
    }),
  };
};

const validateAppealAttemptTiming = (
  stateWindow: OfficialStateWindow,
  eventTick: number,
  timing: DefensiveAppealAttemptRecorded['timing'],
  ruleProfileId: RuleProfileId,
): void => {
  if (timing !== 'timely' && timing !== 'expired' && timing !== 'simultaneous_unresolved') {
    throw new Error('unknown appeal attempt timing');
  }
  if (stateWindow.closedAtTick === null && timing !== 'timely') {
    throw new Error('open appeal window requires timely attempt');
  }
  if (stateWindow.closedAtTick !== null && eventTick > stateWindow.closedAtTick && timing !== 'expired') {
    throw new Error('closed appeal window requires expired attempt');
  }
  if (stateWindow.closedAtTick === eventTick && ruleProfileId === NPB_2026_RULE_PROFILE.id
    && timing !== 'simultaneous_unresolved') {
    throw new Error('NPB same-tick appeal must remain unresolved');
  }
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

const rejectUnresolvedRuling = (snapshot: object): void => {
  if ('ruling' in snapshot) throw new Error('unresolved correct-rule snapshot must not supply a ruling');
};

const freezeUnresolvedSnapshot = (snapshot: UnresolvedCorrectRuleSnapshot): UnresolvedCorrectRuleSnapshot => {
  rejectUnresolvedRuling(snapshot);
  if (snapshot.resolution !== 'unresolved') throw new Error('correct-rule resolution must be unresolved');
  if (snapshot.reason !== 'exact_simultaneity' && snapshot.reason !== 'insufficient_evidence') {
    throw new Error('unknown unresolved correct-rule reason');
  }
  return Object.freeze({
    snapshotId: id(snapshot.snapshotId, 'snapshotId'),
    evidenceRevision: revision(snapshot.evidenceRevision, 'evidenceRevision'),
    resolution: 'unresolved',
    reason: snapshot.reason,
  });
};

const requireNewSnapshot = (replay: Replay, snapshot: CorrectRuleEvidenceSnapshot): void => {
  if (replay.snapshotIds.has(snapshot.snapshotId)) throw new Error('correct-rule snapshot ids must be unique');
  if (replay.latestCorrect !== null && snapshot.evidenceRevision <= replay.latestCorrect.evidenceRevision) {
    throw new Error('correct-rule evidence revision must increase monotonically');
  }
};

const freezeCall = (call: OnFieldCall): OnFieldCall => Object.freeze({
  callId: id(call.callId, 'callId'),
  tick: tick(call.tick, 'call tick'),
  basisSnapshotId: id(call.basisSnapshotId, 'basisSnapshotId'),
  basisEvidenceRevision: revision(call.basisEvidenceRevision, 'basisEvidenceRevision'),
  ruling: validateRuling(call.ruling),
});

const importFields = (v: unknown, names: readonly string[]): boolean => !!v && typeof v === 'object'
  && !Array.isArray(v) && JSON.stringify(Object.keys(v).sort()) === JSON.stringify([...names].sort());
const freezeImportedCall = (raw: OnFieldCall): OnFieldCall => {
  if (!importFields(raw, ['callId', 'tick', 'basisSnapshotId', 'basisEvidenceRevision', 'ruling'])
    || !importFields(raw.ruling, ['outsAfter', 'basesAfter', 'scoredRunnerIds'])
    || !importFields(raw.ruling.basesAfter, ['first', 'second', 'third'])) throw new Error('invalid original live-call shape');
  return freezeCall(raw);
};
const importId = (v: string, name: string): string => {
  id(v, name);
  if (v !== v.trim()) throw new Error(`${name} must be an exact Source identity`);
  return v;
};
const freezeImportReference = (raw: OwnedLiveCallSourceReference): OwnedLiveCallSourceReference => {
  if (!importFields(raw, ['owner', 'sourceId', 'sourceVersion', 'sourceHash', 'snapshotHash'])
    || typeof raw.sourceHash !== 'string' || typeof raw.snapshotHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(raw.sourceHash) || !/^[a-f0-9]{64}$/.test(raw.snapshotHash)) {
    throw new Error('invalid owned live-call Source reference');
  }
  return Object.freeze({ owner: importId(raw.owner, 'owner'), sourceId: importId(raw.sourceId, 'sourceId'),
    sourceVersion: importId(raw.sourceVersion, 'sourceVersion'), sourceHash: raw.sourceHash, snapshotHash: raw.snapshotHash });
};
/** Bounded original-call import: post-play chronology cannot replace the original called/available time.
 * Native owns exact physical end and every referenced Source; this pure ledger does not authenticate them. */
const freezeLiveCallImport = (raw: OwnedLiveCallImportProvenance, call: OnFieldCall,
  playId: number, playEnd: PlayEndFact | null, importedTick: number, replay: Replay): OwnedLiveCallImportProvenance => {
  if (!importFields(raw, ['version', 'playId', 'gameId', 'physicalPitchSourceId', 'clock', 'calledAtElapsedSeconds',
    'availableAtElapsedSeconds', 'importedAtElapsedSeconds', 'call', 'perception', 'policy', 'ruleEvidence', 'reception'])
    || raw.version !== 'owned_live_call_import_v1' || raw.playId !== playId
    || !importFields(raw.clock, ['originTick', 'ticksPerSecond'])
    || !Number.isSafeInteger(raw.clock.ticksPerSecond) || raw.clock.ticksPerSecond <= 0) {
    throw new Error('invalid owned live-call import provenance');
  }
  if (playEnd === null) throw new Error('owned live-call import requires physical PlayEnd');
  if (replay.calls.length !== 0 || replay.reviews.length !== 0) throw new Error('original live call must precede all other ledger calls');
  const basis = replay.snapshots.get(call.basisSnapshotId);
  if (!basis || basis.evidenceRevision !== call.basisEvidenceRevision) throw new Error('live call requires its original registered rule basis');
  const { originTick, ticksPerSecond } = raw.clock;
  const calledTick = quantizeEventTick(originTick, raw.calledAtElapsedSeconds, ticksPerSecond);
  const availableTick = quantizeEventTick(originTick, raw.availableAtElapsedSeconds, ticksPerSecond);
  const recordedTick = quantizeEventTick(originTick, raw.importedAtElapsedSeconds, ticksPerSecond);
  if (calledTick !== call.tick || calledTick > playEnd.tick || recordedTick !== importedTick
    || availableTick > importedTick || raw.availableAtElapsedSeconds < raw.calledAtElapsedSeconds
    || raw.importedAtElapsedSeconds < raw.availableAtElapsedSeconds) throw new Error('owned live-call clock or availability differs');
  return Object.freeze({ version: raw.version, playId, gameId: importId(raw.gameId, 'gameId'),
    physicalPitchSourceId: importId(raw.physicalPitchSourceId, 'physicalPitchSourceId'), clock: Object.freeze({ originTick, ticksPerSecond }),
    calledAtElapsedSeconds: raw.calledAtElapsedSeconds, availableAtElapsedSeconds: raw.availableAtElapsedSeconds,
    importedAtElapsedSeconds: raw.importedAtElapsedSeconds, call: freezeImportReference(raw.call),
    perception: freezeImportReference(raw.perception), policy: freezeImportReference(raw.policy),
    ruleEvidence: freezeImportReference(raw.ruleEvidence), reception: raw.reception === null ? null : freezeImportReference(raw.reception) });
};

const sourceIdentity = (reference: OwnedLiveCallSourceReference): string =>
  JSON.stringify([reference.owner, reference.sourceId]);

/** Import original physical execution only. Native authenticates the Sources and exact
 * original PlayEnd; this ledger can compare PlayEnd only at its authoritative tick. */
const freezeLiveAppealImport = (
  request: OwnedLiveAppealImportInput,
  ledger: Pick<PlayAdjudicationLedger, 'playId' | 'ruleProfileId' | 'playEnd'>,
  replay: Replay,
): OwnedLiveAppealImported => {
  getRuleProfile(ledger.ruleProfileId);
  if (ledger.playEnd === null || replay.latestCorrect === null) {
    throw new Error('owned live-appeal import requires physical PlayEnd and correct-rule snapshot');
  }
  const { provenance: raw, attempt, complianceEvidence: evidence, rights } = request;
  if (!importFields(raw, ['version', 'playId', 'gameId', 'physicalPitchSourceId', 'clock',
    'indicatedAtElapsedSeconds', 'executedAtElapsedSeconds', 'importedAtElapsedSeconds', 'indication', 'throwPlan', 'execution'])
    || raw.version !== 'owned_live_appeal_import_v1' || raw.playId !== ledger.playId
    || !importFields(raw.clock, ['originTick', 'ticksPerSecond'])
    || !Number.isSafeInteger(raw.clock.ticksPerSecond) || raw.clock.ticksPerSecond <= 0) {
    throw new Error('invalid owned live-appeal import provenance');
  }
  if (!importFields(rights, ['kind', 'reason']) || rights.kind !== 'pending'
    || rights.reason !== 'original_live_ball_and_appeal_rights_required') {
    throw new Error('owned live-appeal requires its unresolved original rights dependency');
  }
  if (!importFields(attempt, ['kind', 'defenderId', 'runnerId', 'base', 'reason', 'tick'])
    || attempt.kind !== 'defensive_appeal_attempt' || attempt.reason !== 'tag_up_early_departure'
    || ![1, 2, 3, 4].includes(attempt.base)) {
    throw new Error('owned live-appeal requires an original defensive appeal attempt');
  }
  importId(attempt.defenderId, 'appeal defenderId'); importId(attempt.runnerId, 'appeal runnerId');
  const { originTick, ticksPerSecond } = raw.clock;
  const indicatedTick = quantizeEventTick(originTick, raw.indicatedAtElapsedSeconds, ticksPerSecond);
  const executedTick = quantizeEventTick(originTick, raw.executedAtElapsedSeconds, ticksPerSecond);
  const importedTick = quantizeEventTick(originTick, raw.importedAtElapsedSeconds, ticksPerSecond);
  if (tick(attempt.tick, 'appeal execution tick') !== executedTick || indicatedTick > executedTick
    || executedTick > ledger.playEnd.tick || ledger.playEnd.tick > importedTick || importedTick !== request.tick
    || raw.indicatedAtElapsedSeconds > raw.executedAtElapsedSeconds
    || raw.executedAtElapsedSeconds > raw.importedAtElapsedSeconds) {
    throw new Error('owned live-appeal execution or import clock differs');
  }
  if (!importFields(evidence, ['kind', 'history', 'originBase', 'firstTouch'])
    || evidence.kind !== 'ball_world_tag_up_history_v1'
    || !['first', 'second', 'third'].includes(evidence.originBase)
    || evidence.history.originTick !== originTick || evidence.history.ticksPerSecond !== ticksPerSecond
    || evidence.history.endElapsedSeconds !== raw.executedAtElapsedSeconds) {
    throw new Error('owned live-appeal history must end exactly at original execution');
  }
  importId(evidence.firstTouch.fact.fielderId, 'firstTouch fielderId');
  const compliance = evaluateBallWorldTagUpCompliance(evidence);
  if (compliance.kind === 'pending') throw new Error('owned live-appeal requires supported original contact history');
  if (attempt.runnerId !== compliance.runnerId || attempt.base !== compliance.originBase) {
    throw new Error('owned live-appeal must target the original exact-history runner and base');
  }
  const indication = freezeImportReference(raw.indication), throwPlan = freezeImportReference(raw.throwPlan),
    execution = freezeImportReference(raw.execution);
  if (new Set([indication, throwPlan, execution].map(sourceIdentity)).size !== 3) {
    throw new Error('owned live-appeal Sources must have distinct original identities');
  }
  if (replay.liveAppealExecutionIds.has(sourceIdentity(execution))) {
    throw new Error('original live-appeal execution was already imported');
  }
  const provenance: OwnedLiveAppealImportProvenance = Object.freeze({ version: raw.version, playId: ledger.playId,
    gameId: importId(raw.gameId, 'gameId'), physicalPitchSourceId: importId(raw.physicalPitchSourceId, 'physicalPitchSourceId'),
    clock: Object.freeze({ originTick, ticksPerSecond }), indicatedAtElapsedSeconds: raw.indicatedAtElapsedSeconds,
    executedAtElapsedSeconds: raw.executedAtElapsedSeconds, importedAtElapsedSeconds: raw.importedAtElapsedSeconds,
    indication, throwPlan, execution });
  const freeze = <T>(value: T): T => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  return Object.freeze({ kind: 'OwnedLiveAppealImported', eventId: request.eventId, tick: request.tick,
    attempt: Object.freeze(attempt), complianceEvidence: freeze(evidence), provenance, rights: Object.freeze(rights) });
};

const sameRightsData = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && sameRightsData(a[key], b[key]));
};

/** Interpret authenticated live appeal facts independently of physical PlayEnd.
 * Native owns Source authentication. This function validates the same original
 * chronology and rights used by post-end ledger admission; it creates no event,
 * official call, window, PlayEnd, or final gameplay ruling. */
export type OriginalLiveAppealRightsInput = Readonly<{
  ruleProfileId: RuleProfileId;
  attempt: DefensiveAppealAttemptFact;
  complianceEvidence: BallWorldAppealComplianceEvidence;
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>;
  indicatedAtElapsedSeconds: number;
  executedAtElapsedSeconds: number;
  evaluatedThroughElapsedSeconds: number;
  evidence: OwnedLiveAppealRightsEvidence;
}>;
export const interpretOriginalLiveAppealRights = (rawInput: OriginalLiveAppealRightsInput): OwnedLiveAppealRightsDisposition => {
  const input = cloneInertData(rawInput, 'adjudication.originalLiveAppealRights');
  if (!importFields(input, ['ruleProfileId', 'attempt', 'complianceEvidence', 'clock',
    'indicatedAtElapsedSeconds', 'executedAtElapsedSeconds', 'evaluatedThroughElapsedSeconds', 'evidence'])
    || !importFields(input.clock, ['originTick', 'ticksPerSecond'])
    || !Number.isSafeInteger(input.clock.ticksPerSecond) || input.clock.ticksPerSecond <= 0) {
    throw new Error('invalid original live-appeal rights interpretation input');
  }
  const profile = getRuleProfile(input.ruleProfileId), { originTick, ticksPerSecond } = input.clock;
  const original = { attempt: input.attempt, complianceEvidence: input.complianceEvidence };
  const { attempt, complianceEvidence } = original;
  if (!importFields(attempt, ['kind', 'defenderId', 'runnerId', 'base', 'reason', 'tick'])
    || attempt.kind !== 'defensive_appeal_attempt' || attempt.reason !== 'tag_up_early_departure'
    || ![1, 2, 3, 4].includes(attempt.base)) {
    throw new Error('owned live-appeal requires an original defensive appeal attempt');
  }
  importId(attempt.defenderId, 'appeal defenderId'); importId(attempt.runnerId, 'appeal runnerId');
  const executedAt = input.executedAtElapsedSeconds, evaluatedThroughElapsedSeconds = input.evaluatedThroughElapsedSeconds;
  const momentTick = (elapsed: number): number => quantizeEventTick(originTick, elapsed, ticksPerSecond);
  momentTick(input.indicatedAtElapsedSeconds); momentTick(evaluatedThroughElapsedSeconds);
  if (tick(attempt.tick, 'appeal execution tick') !== momentTick(executedAt)
    || input.indicatedAtElapsedSeconds > executedAt || executedAt > evaluatedThroughElapsedSeconds) {
    throw new Error('original live-appeal execution or evaluation clock differs');
  }
  if (!importFields(complianceEvidence, ['kind', 'history', 'originBase', 'firstTouch'])
    || complianceEvidence.kind !== 'ball_world_tag_up_history_v1'
    || !['first', 'second', 'third'].includes(complianceEvidence.originBase)
    || complianceEvidence.history.originTick !== originTick || complianceEvidence.history.ticksPerSecond !== ticksPerSecond
    || complianceEvidence.history.endElapsedSeconds !== executedAt) {
    throw new Error('owned live-appeal history must end exactly at original execution');
  }
  importId(complianceEvidence.firstTouch.fact.fielderId, 'firstTouch fielderId');
  const compliance = evaluateBallWorldTagUpCompliance(complianceEvidence);
  if (compliance.kind === 'pending') throw new Error('owned live-appeal requires supported original contact history');
  if (attempt.runnerId !== compliance.runnerId || attempt.base !== compliance.originBase) {
    throw new Error('owned live-appeal must target the original exact-history runner and base');
  }
  const evidence = input.evidence;
  if (!importFields(evidence, ['version', 'liveAtExecution', 'window', 'appealThrowForfeitures', ...('liveAtFirstTouch' in evidence ? ['liveAtFirstTouch'] : [])])
    || !['owned_live_appeal_rights_evidence_v1', 'owned_live_appeal_rights_evidence_v2'].includes(evidence.version)
    || !Array.isArray(evidence.appealThrowForfeitures)) throw new Error('invalid owned live-appeal rights evidence');
  const validateMoment = (moment: OwnedLiveAppealRightsMoment, through = executedAt): void => {
    if (!importFields(moment, ['originTick', 'elapsedSeconds', 'tick']) || moment.originTick !== originTick
      || momentTick(moment.elapsedSeconds) !== moment.tick || moment.elapsedSeconds > through) {
      throw new Error('live appeal legal-state moment differs from original execution clock');
    }
  };
  const validateLive = (live: OwnedLiveAppealLiveEvidence, through: number): void => {
    const initial = 'initialContinuation' in live;
    if (live?.kind !== 'live' || !importFields(live, ['kind', 'playDeclaration', 'at', 'coveredThroughElapsedSeconds', ...(initial ? ['initialContinuation'] : [])])) {
      throw new Error('invalid original live-ball coverage');
    }
    freezeImportReference(live.playDeclaration);
    if (initial) {
      if (evidence.version !== 'owned_live_appeal_rights_evidence_v2'
        || !importFields(live.at, ['originTick', 'elapsedSeconds', 'tick'])
        || !Number.isSafeInteger(live.at.originTick) || live.at.originTick < 0
        || live.at.elapsedSeconds !== 0 || live.at.tick !== live.at.originTick || live.at.tick > originTick)
        throw new Error('initial live-ball continuation clock or version differs');
      freezeImportReference(live.initialContinuation!);
    } else validateMoment(live.at, through);
    momentTick(live.coveredThroughElapsedSeconds);
    if (live.coveredThroughElapsedSeconds < through || live.coveredThroughElapsedSeconds > evaluatedThroughElapsedSeconds) {
      throw new Error('original live-ball coverage must include execution and precede admission');
    }
  };
  const live = evidence.liveAtExecution;
  if (live?.kind === 'live') validateLive(live, executedAt);
  else if (live?.kind === 'dead') {
    if (!importFields(live, ['kind', 'cause', 'at'])) throw new Error('invalid original dead-ball cause');
    freezeImportReference(live.cause); validateMoment(live.at);
  } else if (live?.kind === 'unknown') {
    if (!importFields(live, ['kind', 'reason']) || (live.reason !== 'initial_live_ball_owner_missing'
      && live.reason !== 'original_live_ball_coverage_required')) throw new Error('invalid unknown live-ball owner');
  } else throw new Error('unknown original live-ball state');
  if ('liveAtFirstTouch' in evidence) {
    if (evidence.version !== 'owned_live_appeal_rights_evidence_v2' || !evidence.liveAtFirstTouch)
      throw new Error('separate first-touch live evidence requires v2');
    validateLive(evidence.liveAtFirstTouch, original.complianceEvidence.firstTouch.elapsedSeconds);
  }

  const window = evidence.window;
  if (window && 'kind' in window) {
    if (window.kind === 'closed_by') {
      if (evidence.version !== 'owned_live_appeal_rights_evidence_v2'
        || !importFields(window, ['kind', 'openedAtElapsedSeconds', 'closedNoLaterThanElapsedSeconds', 'closeReason', 'evidenceReference'])
        || window.closeReason !== 'defense_left_field' || !profile.appeal.defenseLeavingFieldClosesInningEndingWindow)
        throw new Error('invalid bounded original defense-departure evidence');
      momentTick(window.openedAtElapsedSeconds); momentTick(window.closedNoLaterThanElapsedSeconds);
      freezeImportReference(window.evidenceReference);
      if (window.openedAtElapsedSeconds > executedAt || window.closedNoLaterThanElapsedSeconds < window.openedAtElapsedSeconds
        || window.closedNoLaterThanElapsedSeconds > evaluatedThroughElapsedSeconds)
        throw new Error('bounded original defense-departure chronology differs');
    } else if (!importFields(window, ['kind', 'reason']) || window.kind !== 'unresolved'
      || window.reason !== 'original_live_appeal_window_owner_required') throw new Error('invalid unresolved original appeal-window owner');
  } else {
    if (!importFields(window, ['openedAtElapsedSeconds', 'closedAtElapsedSeconds', 'closeReason'])) {
      throw new Error('invalid original appeal-window evidence');
    }
    momentTick(window.openedAtElapsedSeconds);
    if (window.openedAtElapsedSeconds > executedAt) throw new Error('original appeal window must open before execution');
    if (window.closedAtElapsedSeconds === null) {
      if (window.closeReason !== null) throw new Error('open original appeal window cannot have a close reason');
    } else {
      momentTick(window.closedAtElapsedSeconds);
      if (window.closedAtElapsedSeconds < window.openedAtElapsedSeconds
        || window.closedAtElapsedSeconds > evaluatedThroughElapsedSeconds
        || (window.closeReason !== 'next_pitch_or_play' && window.closeReason !== 'defense_left_field')) {
        throw new Error('original appeal-window closure chronology or reason differs');
      }
      if (window.closeReason === 'next_pitch_or_play' && !profile.appeal.nextPitchOrPlayClosesWindow
        || window.closeReason === 'defense_left_field' && !profile.appeal.defenseLeavingFieldClosesInningEndingWindow) {
        throw new Error('original appeal-window closure is unsupported by RuleProfile');
      }
    }
  }
  const forfeitedThrows = new Set<string>();
  let previousForfeiture = -1;
  for (const fact of evidence.appealThrowForfeitures) {
    if (!importFields(fact, ['indication', 'throwPlan', 'legalCoverage', 'firstCertainDeadAtElapsedSeconds'])) {
      throw new Error('invalid original appeal-throw forfeiture evidence');
    }
    const indication = freezeImportReference(fact.indication), throwPlan = freezeImportReference(fact.throwPlan);
    freezeImportReference(fact.legalCoverage); momentTick(fact.firstCertainDeadAtElapsedSeconds);
    if (sourceIdentity(indication) === sourceIdentity(throwPlan) || forfeitedThrows.has(sourceIdentity(throwPlan))
      || fact.firstCertainDeadAtElapsedSeconds < previousForfeiture || fact.firstCertainDeadAtElapsedSeconds > executedAt) {
      throw new Error('original appeal-throw forfeiture identity or chronology differs');
    }
    forfeitedThrows.add(sourceIdentity(throwPlan)); previousForfeiture = fact.firstCertainDeadAtElapsedSeconds;
  }

  let disposition: OwnedLiveAppealRightsDisposition;
  if (evidence.appealThrowForfeitures.some(fact => fact.firstCertainDeadAtElapsedSeconds < executedAt)) {
    // NPB's appeal-throw dead-ball loss of rights is a bounded v1 admission;
    // no new policy field or change to existing RuleProfile bytes is implied.
    if (profile.id !== NPB_2026_RULE_PROFILE.id) throw new Error('appeal-throw forfeiture requires the supported NPB RuleProfile');
    disposition = { kind: 'ineligible', reason: 'appeal_throw_forfeited' };
  } else if (evidence.appealThrowForfeitures.length !== 0) {
    throw new Error('exact simultaneous appeal-throw forfeiture remains unresolved');
  } else if (live.kind === 'dead') {
    if (live.at.elapsedSeconds === executedAt) throw new Error('exact simultaneous dead-ball ordering remains unresolved');
    disposition = { kind: 'ineligible', reason: 'dead_ball' };
  } else if (!('kind' in window) && window.closedAtElapsedSeconds !== null && window.closedAtElapsedSeconds < executedAt) {
    disposition = { kind: 'ineligible', reason: 'appeal_window_expired' };
  } else if ('kind' in window && window.kind === 'closed_by') {
    if (window.closedNoLaterThanElapsedSeconds >= executedAt) throw new Error('bounded defense-departure order remains unresolved');
    disposition = { kind: 'ineligible', reason: 'appeal_window_expired' };
  } else {
    if (live.kind !== 'live') throw new Error('original live-ball owner or coverage remains unresolved');
    if ('kind' in window) throw new Error('original live-appeal window owner remains unresolved');
    if (window.openedAtElapsedSeconds === executedAt) throw new Error('exact simultaneous appeal-window opening remains unresolved');
    if (window.closedAtElapsedSeconds === executedAt) throw new Error('exact simultaneous appeal-window closure remains unresolved');
    const beginsBeforeExecution = live.initialContinuation
      ? live.at.tick < originTick || executedAt > 0 : live.at.elapsedSeconds < executedAt;
    if (!beginsBeforeExecution) throw new Error('exact simultaneous Play and appeal execution remain unresolved');
    const firstLive = evidence.liveAtFirstTouch ?? live;
    const beginsBeforeTouch = firstLive.initialContinuation
      ? firstLive.at.tick < originTick || original.complianceEvidence.firstTouch.elapsedSeconds > 0
      : firstLive.at.elapsedSeconds < original.complianceEvidence.firstTouch.elapsedSeconds;
    if (!beginsBeforeTouch) {
      throw new Error('original live-ball coverage must begin before first-fielder contact');
    }
    if (profile.tagUp.legalReleaseBasis !== 'first_fielder_touch' || !profile.tagUp.earlyDepartureRequiresAppeal
      || profile.officialWindows?.appeal?.available !== true) throw new Error('original tag-up appeal is unsupported by RuleProfile');
    const compliance = evaluateBallWorldTagUpCompliance(original.complianceEvidence);
    if (compliance.kind === 'pending') throw new Error('original exact tag-up compliance remains unresolved');
    // Exact original chronology already proved the window open at execution.
    // Keep the original attempt tick; tick-collapsed later closure is not expiry.
    disposition = { kind: 'eligible', result: resolveTagUpAppeal({ compliance, appeal: original.attempt,
      window: { openedAtTick: momentTick(window.openedAtElapsedSeconds), closedAtTick: null, closeReason: null } }) };
  }
  const freeze = <T>(value: T): T => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  return freeze(disposition);
};

/** The imported physical execution and the later legal evidence have separate
 * clocks. Native authenticates both owners. This replay validates all binding
 * fields and derives the disposition again, never trusting a stored result. */
const freezeLiveAppealRightsAdmission = (
  request: OwnedLiveAppealRightsAdmissionInput,
  ledger: Pick<PlayAdjudicationLedger, 'ruleProfileId'>,
  replay: Replay,
): OwnedLiveAppealRightsAdmitted => {
  const raw = request.provenance;
  if (!importFields(raw, ['version', 'originalImport', 'admittedAtElapsedSeconds', 'legalState', 'venue'])
    || raw.version !== 'owned_live_appeal_rights_admission_v1') {
    throw new Error('invalid owned live-appeal rights admission provenance');
  }
  const original = replay.pendingLiveAppeals.find(candidate => sameRightsData(candidate.provenance, raw.originalImport));
  if (!original) throw new Error('live appeal rights require the exact pending original execution and provenance');
  const { originTick, ticksPerSecond } = original.provenance.clock;
  const executedAt = original.provenance.executedAtElapsedSeconds;
  const momentTick = (elapsed: number): number => quantizeEventTick(originTick, elapsed, ticksPerSecond);
  if (momentTick(raw.admittedAtElapsedSeconds) !== request.tick
    || raw.admittedAtElapsedSeconds < original.provenance.importedAtElapsedSeconds) {
    throw new Error('live appeal rights admission clock differs from original import');
  }
  const legalState = freezeImportReference(raw.legalState), venue = freezeImportReference(raw.venue);
  const evidence = request.evidence;
  const disposition = interpretOriginalLiveAppealRights({ ruleProfileId: ledger.ruleProfileId,
    attempt: original.attempt, complianceEvidence: original.complianceEvidence, clock: original.provenance.clock,
    indicatedAtElapsedSeconds: original.provenance.indicatedAtElapsedSeconds,
    executedAtElapsedSeconds: executedAt, evaluatedThroughElapsedSeconds: raw.admittedAtElapsedSeconds, evidence });
  const freeze = <T>(value: T): T => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  return freeze({ kind: 'OwnedLiveAppealRightsAdmitted', eventId: request.eventId, tick: request.tick,
    provenance: { version: raw.version, originalImport: original.provenance,
      admittedAtElapsedSeconds: raw.admittedAtElapsedSeconds, legalState, venue }, evidence, disposition });
};

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
  if (replay.pendingLiveAppeals.length > 0) {
    throw new Error('original live-ball and appeal rights require an authenticated owner before official ruling');
  }
  const correct = replay.latestCorrect;
  if (correct === null) {
    throw new Error('correct-rule snapshot is required before official closure');
  }
  const call = latestCall(replay);
  if (call === null) {
    if (!('ruling' in correct)) {
      throw new Error('unresolved correct-rule evidence requires an explicit on-field call');
    }
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
    snapshots: new Map(),
    closure: null,
    lastTick: playEnd?.tick ?? 0,
    appealSnapshotPending: false,
    appealCallPending: false,
    pendingLiveAppeals: [],
    liveAppealExecutionIds: new Set(),
    liveAppealRightsAdmissions: [],
    liveAppealCallPending: false,
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
      requireNewSnapshot(replay, snapshot);
      replay.snapshotIds.add(snapshot.snapshotId);
      replay.snapshots.set(snapshot.snapshotId, snapshot);
      replay.latestCorrect = snapshot;
      replay.appealSnapshotPending = false;
      events.push(Object.freeze({ ...event, snapshot }));
      continue;
    }

    if (event.kind === 'UnresolvedCorrectRuleSnapshotRecorded') {
      const snapshot = freezeUnresolvedSnapshot(event.snapshot);
      requireNewSnapshot(replay, snapshot);
      replay.snapshotIds.add(snapshot.snapshotId);
      replay.snapshots.set(snapshot.snapshotId, snapshot);
      replay.latestCorrect = snapshot;
      replay.appealSnapshotPending = false;
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

    if (event.kind === 'DefensiveAppealAttemptRecorded') {
      const windowId = id(event.windowId, 'windowId');
      const stateWindow = replay.windows.get(windowId);
      if (stateWindow === undefined || stateWindow.windowKind !== 'appeal') {
        throw new Error('appeal window does not exist');
      }
      if (playEnd === null || replay.latestCorrect === null) {
        throw new Error('tag-up appeal requires physical PlayEnd and correct-rule snapshot');
      }
      const evidence = freezeAppealEvidence(event.attempt, event.complianceEvidence, eventTick, playEnd.tick);
      validateAppealAttemptTiming(stateWindow, eventTick, event.timing, input.ruleProfileId);
      replay.appealSnapshotPending = true;
      if (event.timing === 'simultaneous_unresolved') replay.appealCallPending = true;
      events.push(Object.freeze({ kind: event.kind, eventId: event.eventId, tick: eventTick,
        windowId, timing: event.timing, ...evidence }));
      continue;
    }

    if (event.kind === 'OwnedLiveCallImported') {
      if (!importFields(event, ['kind', 'eventId', 'tick', 'call', 'provenance'])) throw new Error('invalid owned live-call import event');
      const call = freezeImportedCall(event.call);
      const provenance = freezeLiveCallImport(event.provenance, call, playId, playEnd, eventTick, replay);
      replay.callIds.add(call.callId); replay.calls.push(call);
      // A historical call cannot resolve a new post-play appeal obligation.
      events.push(Object.freeze({ kind: event.kind, eventId: event.eventId, tick: eventTick, call, provenance }));
      continue;
    }

    if (event.kind === 'OwnedLiveAppealImported') {
      if (!importFields(event, ['kind', 'eventId', 'tick', 'attempt', 'complianceEvidence', 'provenance', 'rights'])) {
        throw new Error('invalid owned live-appeal import event');
      }
      const imported = freezeLiveAppealImport(event, { playId, ruleProfileId: input.ruleProfileId, playEnd }, replay);
      replay.pendingLiveAppeals.push(imported);
      replay.liveAppealExecutionIds.add(sourceIdentity(imported.provenance.execution));
      events.push(imported);
      continue;
    }

    if (event.kind === 'OwnedLiveAppealRightsAdmitted') {
      if (!importFields(event, ['kind', 'eventId', 'tick', 'provenance', 'evidence', 'disposition'])) {
        throw new Error('invalid owned live-appeal rights admission event');
      }
      const admitted = freezeLiveAppealRightsAdmission(event, { ruleProfileId: input.ruleProfileId }, replay);
      if (!sameRightsData(event.disposition, admitted.disposition)) throw new Error('stored live-appeal rights disposition differs from evidence');
      replay.pendingLiveAppeals = replay.pendingLiveAppeals.filter(candidate =>
        !sameRightsData(candidate.provenance, admitted.provenance.originalImport));
      replay.liveAppealRightsAdmissions.push(admitted);
      replay.appealSnapshotPending = true;
      replay.liveAppealCallPending = true;
      events.push(admitted);
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
      if (!replay.appealSnapshotPending) {
        replay.appealCallPending = false;
        replay.liveAppealCallPending = false;
      }
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
      if (replay.appealSnapshotPending) throw new Error('appeal attempt requires a newer correct-rule snapshot');
      if (replay.appealCallPending) throw new Error('same-tick appeal requires an explicit on-field call');
      if (replay.liveAppealCallPending) throw new Error('live appeal rights admission requires an explicit on-field call');
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
  requireNewSnapshot(replay, snapshot);
  return append(ledger, Object.freeze({
    kind: 'CorrectRuleSnapshotRecorded',
    eventId,
    tick: eventTick,
    snapshot,
  }));
};

export const recordUnresolvedCorrectRuleSnapshot = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: UnresolvedCorrectRuleSnapshotInput,
): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.unresolvedCorrectRule');
  const eventId = ensureNewEventId(replay, request.eventId);
  const eventTick = requireEventTick(replay, request.tick);
  rejectUnresolvedRuling(request);
  const snapshot = freezeUnresolvedSnapshot({
    snapshotId: request.snapshotId,
    evidenceRevision: request.evidenceRevision,
    resolution: 'unresolved',
    reason: request.reason,
  });
  requireNewSnapshot(replay, snapshot);
  return append(ledger, Object.freeze({
    kind: 'UnresolvedCorrectRuleSnapshotRecorded',
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

export const recordDefensiveAppealAttempt = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: DefensiveAppealAttemptInput,
): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.appealAttempt');
  const eventId = ensureNewEventId(replay, request.eventId);
  const eventTick = requireEventTick(replay, request.attempt.tick);
  const windowId = id(request.windowId, 'windowId');
  const stateWindow = replay.windows.get(windowId);
  if (stateWindow === undefined || stateWindow.windowKind !== 'appeal') {
    throw new Error('appeal window does not exist');
  }
  if (ledger.playEnd === null || replay.latestCorrect === null) {
    throw new Error('tag-up appeal requires physical PlayEnd and correct-rule snapshot');
  }
  const evidence = freezeAppealEvidence(request.attempt, request.complianceEvidence, eventTick, ledger.playEnd.tick);
  validateAppealAttemptTiming(stateWindow, eventTick, request.timing, ledger.ruleProfileId);
  return append(ledger, Object.freeze({
    kind: 'DefensiveAppealAttemptRecorded', eventId, tick: eventTick,
    windowId, timing: request.timing, ...evidence,
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

/** Import one owned original live call. The event tick is recording time, not call time. */
export const recordOwnedLiveCallImport = (ledgerInput: PlayAdjudicationLedger, expectedRevision: number,
  input: OwnedLiveCallImportInput): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.liveCallImport');
  if (!importFields(request, ['eventId', 'tick', 'call', 'provenance'])) throw new Error('invalid owned live-call import request');
  const eventId = ensureNewEventId(replay, request.eventId), eventTick = requireEventTick(replay, request.tick);
  const call = freezeImportedCall(request.call);
  const provenance = freezeLiveCallImport(request.provenance, call, ledger.playId, ledger.playEnd, eventTick, replay);
  return append(ledger, Object.freeze({ kind: 'OwnedLiveCallImported', eventId, tick: eventTick, call, provenance }));
};

/** Recording time remains post-play; occurrence and compliance stop at the original
 * field execution. This event cannot adjudicate OUT or establish legal appeal rights. */
export const recordOwnedLiveAppealImport = (ledgerInput: PlayAdjudicationLedger, expectedRevision: number,
  input: OwnedLiveAppealImportInput): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.liveAppealImport');
  if (!importFields(request, ['eventId', 'tick', 'attempt', 'complianceEvidence', 'provenance', 'rights'])) {
    throw new Error('invalid owned live-appeal import request');
  }
  ensureNewEventId(replay, request.eventId); requireEventTick(replay, request.tick);
  return append(ledger, freezeLiveAppealImport(request, ledger, replay));
};

/** Admit the authenticated original rights of one pending execution. A new
 * correct-rule snapshot and an explicit current call are still required. */
export const recordOwnedLiveAppealRightsAdmission = (ledgerInput: PlayAdjudicationLedger, expectedRevision: number,
  input: OwnedLiveAppealRightsAdmissionInput): PlayAdjudicationLedger => {
  const { ledger, replay } = requireOpen(ledgerInput, expectedRevision);
  const request = cloneInertData(input, 'adjudication.liveAppealRights');
  if (!importFields(request, ['eventId', 'tick', 'provenance', 'evidence'])) throw new Error('invalid owned live-appeal rights admission request');
  ensureNewEventId(replay, request.eventId); requireEventTick(replay, request.tick);
  return append(ledger, freezeLiveAppealRightsAdmission(request, ledger, replay));
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
  if (replay.appealSnapshotPending) throw new Error('appeal attempt requires a newer correct-rule snapshot');
  if (replay.appealCallPending) throw new Error('same-tick appeal requires an explicit on-field call');
  if (replay.liveAppealCallPending) throw new Error('live appeal rights admission requires an explicit on-field call');
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

/** Separate from legacy state shapes. Only an authenticated admission bound to
 * the same execution may discharge this dependency; snapshots/calls/windows cannot. */
export const getPendingOwnedLiveAppealImports = (
  ledgerInput: PlayAdjudicationLedger,
): readonly OwnedLiveAppealImported[] => Object.freeze([...replayLedger(ledgerInput).replay.pendingLiveAppeals]);

export const getOwnedLiveAppealRightsAdmissions = (
  ledgerInput: PlayAdjudicationLedger,
): readonly OwnedLiveAppealRightsAdmitted[] => Object.freeze([...replayLedger(ledgerInput).replay.liveAppealRightsAdmissions]);

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
