import { deriveBallWorldBattedRuleChronology } from '../rules/BallWorldBattedRuleChronology';
import { projectActualFairFieldTimeline, type ActualFairFieldTimelineInput } from '../sim/plateAppearance/ActualFairFieldTimeline';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { RuleProfileId } from '../model/RuleProfileRef';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { deriveClosedNonLiveMatchState, type NonLiveOfficialContext } from './NonLiveOfficialApplication';
import { cloneInert } from './OfficialWindowPolicy';
import {
  deriveClosedLiveBallMatchState,
  getOfficialPlayClosure,
  type OfficialPlayClosure,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';

export type OfficialFairBallScoringEvidence = Readonly<{
  schemaVersion: 1;
  sourceEventId: string;
  sourceKind: 'official_scorer_judgment';
  scorerId: string;
  ruleProfileId: RuleProfileId;
  playId: number;
  closureId: string;
  basisRulingId: string;
  recordedAtTick: number;
  contactSequence: number;
  fairSequence: number;
  batterRunnerId: string;
  /** Scorer authority assigns H/E/FC; PA events do not identify a charged defender or defensive choice. */
  judgment:
    | Readonly<{ kind: 'base_hit' }>
    | Readonly<{ kind: 'reached_on_error'; chargedFielderId: string }>
    | Readonly<{ kind: 'fielders_choice'; retiredPriorRunnerId: string }>;
}>;

export type OfficialScoringInput = Readonly<{
  match: CanonicalMatchState;
  timeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
}> & (
  | Readonly<{ kind: 'non_live'; context: NonLiveOfficialContext }>
  | Readonly<{ kind: 'live_ball';
      scoringEvidence?: OfficialFairBallScoringEvidence;
      /** Native must authenticate the complete physical sidecar and independently owned end. */
      fairCatchEvidence?: ActualFairFieldTimelineInput }>
);

export type SupportedOfficialScoringRecord = Readonly<{
  playId: number;
  closureId: string;
  basisRulingId: string;
  classification: 'base_on_balls' | 'strikeout' | 'foul_out' | 'fly_out'
    | 'base_hit' | 'reached_on_error' | 'fielders_choice';
  battingTeam: 'away' | 'home';
  runsScored: number;
  hitsCredited: 0 | 1;
  errorsCharged: 0 | 1;
}>;

export type OfficialScoringResult =
  | Readonly<{ kind: 'supported'; record: SupportedOfficialScoringRecord }>
  | Readonly<{
      kind: 'unsupported';
      playId: number;
      closureId: string;
      reason: 'live_ball_hit_error_fielders_choice_not_classified';
    }>;

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const safeTick = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const validateFairBallScoringEvidence = (
  evidence: OfficialFairBallScoringEvidence,
  match: CanonicalMatchState,
  timeline: CanonicalPlateAppearanceTimeline,
  closure: OfficialPlayClosure,
): void => {
  const status = timeline.status;
  const contact = timeline.events.find((event) =>
    event.sequence === evidence.contactSequence);
  const fair = timeline.events.find((event) =>
    event.sequence === evidence.fairSequence);
  const batter = evidence.batterRunnerId;
  const finalRunners = Object.values(closure.officialDelta.basesAfter);
  const scored = closure.officialDelta.scoredRunnerIds;
  const priorRunners = Object.values(match.bases).filter(
    (runnerId): runnerId is string => runnerId !== null);
  if (evidence.schemaVersion !== 1
    || !nonEmpty(evidence.sourceEventId)
    || evidence.sourceKind !== 'official_scorer_judgment'
    || !nonEmpty(evidence.scorerId)
    || evidence.ruleProfileId !== match.ruleProfileId
    || !nonEmpty(batter)
    || evidence.playId !== match.playId
    || evidence.closureId !== closure.closureId
    || evidence.basisRulingId !== closure.finalRuling.rulingId
    || !safeTick(evidence.recordedAtTick)
    || evidence.recordedAtTick < closure.closedAtTick
    || !safeTick(evidence.contactSequence)
    || !safeTick(evidence.fairSequence)
    || status.kind !== 'live_ball_complete'
    || status.disposition.kind !== 'fair'
    || contact?.kind !== 'BatBallContact'
    || fair?.kind !== 'BattedBallDeclaredFair'
    || contact.tick !== status.contactTick
    || fair.tick !== status.disposition.fairDeterminationTick
    || fair.payload.contactTick !== contact.tick
    || priorRunners.includes(batter)
    || (!finalRunners.includes(batter) && !scored.includes(batter))) {
    throw new Error('scoring evidence does not match closed fair play');
  }
  const judgment = evidence.judgment;
  if (judgment.kind === 'base_hit') return;
  if (judgment.kind === 'reached_on_error'
    && nonEmpty(judgment.chargedFielderId)) return;
  if (judgment.kind === 'fielders_choice'
    && nonEmpty(judgment.retiredPriorRunnerId)
    && priorRunners.includes(judgment.retiredPriorRunnerId)
    && !finalRunners.includes(judgment.retiredPriorRunnerId)
    && !scored.includes(judgment.retiredPriorRunnerId)
    && closure.officialDelta.outsAfter > match.outs
    && finalRunners.includes(batter)) return;
  throw new Error('scoring evidence judgment contradicts closed play');
};

/** Classify only results established by the closed official state and existing rule path. */
export const classifyClosedPlayForOfficialScoring = (
  input: OfficialScoringInput,
): OfficialScoringResult => {
  const request = cloneInert(input);
  if (request.kind === 'non_live') {
    const next = deriveClosedNonLiveMatchState({
      match: request.match,
      timeline: request.timeline,
      adjudication: request.adjudication,
      context: request.context,
    });
    const closure = getOfficialPlayClosure(request.adjudication);
    if (closure === null) throw new Error('official scoring requires OfficialPlayClosure');
    const battingTeam = request.match.half === 'top' ? 'away' : 'home';
    const runsScored = next.score[battingTeam] - request.match.score[battingTeam];
    return Object.freeze({
      kind: 'supported',
      record: Object.freeze({
        playId: closure.playId,
        closureId: closure.closureId,
        basisRulingId: closure.finalRuling.rulingId,
        classification: request.context.kind === 'walk' ? 'base_on_balls' : 'strikeout',
        battingTeam,
        runsScored,
        hitsCredited: 0,
        errorsCharged: 0,
      }),
    });
  }
  if (request.kind === 'live_ball') {
    const next = deriveClosedLiveBallMatchState(request.match, request.timeline, request.adjudication);
    const closure = getOfficialPlayClosure(request.adjudication);
    if (closure === null) throw new Error('official scoring requires OfficialPlayClosure');
    if (request.fairCatchEvidence !== undefined) {
      const physical = request.fairCatchEvidence;
      const caught = deriveBallWorldBattedRuleChronology(physical.field.evidence).ballEvidence;
      const projection = projectActualFairFieldTimeline(physical);
      const batter = physical.field.evidence.batterRunnerId;
      if (request.scoringEvidence !== undefined
        || caught.kind !== 'fly_catch'
        || projection.kind !== 'projected'
        || JSON.stringify(projection.timeline) !== JSON.stringify(request.timeline)
        || JSON.stringify(physical.playEnd) !== JSON.stringify(closure.playEnd)
        || physical.originalTimeline.playId !== request.match.playId
        || !nonEmpty(batter) || caught.correctRuleResult.batterRunnerId !== batter
        || Object.values(request.match.bases).some((runnerId) => runnerId !== null)
        || Object.values(closure.officialDelta.basesAfter).some((runnerId) => runnerId !== null)
        || closure.officialDelta.scoredRunnerIds.length !== 0
        || closure.officialDelta.outsAfter !== request.match.outs + 1) {
        throw new Error('fair catch scoring requires its exact physical projection and closed empty-base batter retirement');
      }
      const battingTeam = request.match.half === 'top' ? 'away' : 'home';
      return Object.freeze({ kind: 'supported', record: Object.freeze({
        playId: closure.playId, closureId: closure.closureId,
        basisRulingId: closure.finalRuling.rulingId,
        classification: 'fly_out', battingTeam,
        runsScored: 0, hitsCredited: 0, errorsCharged: 0,
      }) });
    }
    if (request.scoringEvidence !== undefined) {
      validateFairBallScoringEvidence(request.scoringEvidence,
        request.match, request.timeline, closure);
      const judgment = request.scoringEvidence.judgment;
      const battingTeam = request.match.half === 'top' ? 'away' : 'home';
      return Object.freeze({ kind: 'supported', record: Object.freeze({
        playId: closure.playId,
        closureId: closure.closureId,
        basisRulingId: closure.finalRuling.rulingId,
        classification: judgment.kind,
        battingTeam,
        runsScored: next.score[battingTeam] - request.match.score[battingTeam],
        hitsCredited: judgment.kind === 'base_hit' ? 1 : 0,
        errorsCharged: judgment.kind === 'reached_on_error' ? 1 : 0,
      }) });
    }
    const status = request.timeline.status;
    const disposition = status.kind === 'live_ball_complete'
      ? status.disposition : null;
    const caught = request.timeline.events.filter((event) =>
      event.kind === 'FoulBattedBallResolved'
      && event.payload.resolution.kind === 'caught_foul_fly');
    const initialRunners = Object.values(request.match.bases).filter(
      (runnerId): runnerId is string => runnerId !== null);
    const finalRunners = Object.values(closure.officialDelta.basesAfter)
      .filter((runnerId): runnerId is string => runnerId !== null);
    if (status.kind === 'live_ball_complete'
      && disposition?.kind === 'caught_foul'
      && request.match.outs < 2
      && caught.length === 1
      && caught[0]?.kind === 'FoulBattedBallResolved'
      && caught[0].payload.resolution.kind === 'caught_foul_fly'
      && caught[0].payload.resolution.outTick === disposition.outTick
      && caught[0].payload.contactTick === status.contactTick
      && closure.officialDelta.outsAfter === request.match.outs + 1
      && initialRunners.every((runnerId) =>
        finalRunners.includes(runnerId)
        || closure.officialDelta.scoredRunnerIds.includes(runnerId))
      && !initialRunners.includes(caught[0].payload.resolution.batterRunnerId)
      && !finalRunners.includes(caught[0].payload.resolution.batterRunnerId)
      && !closure.officialDelta.scoredRunnerIds.includes(
        caught[0].payload.resolution.batterRunnerId)) {
      const battingTeam = request.match.half === 'top' ? 'away' : 'home';
      return Object.freeze({ kind: 'supported', record: Object.freeze({
        playId: closure.playId,
        closureId: closure.closureId,
        basisRulingId: closure.finalRuling.rulingId,
        classification: 'foul_out', battingTeam,
        runsScored: next.score[battingTeam] - request.match.score[battingTeam],
        hitsCredited: 0, errorsCharged: 0,
      }) });
    }
    return Object.freeze({
      kind: 'unsupported',
      playId: closure.playId,
      closureId: closure.closureId,
      reason: 'live_ball_hit_error_fielders_choice_not_classified',
    });
  }
  throw new Error('unknown official scoring play kind');
};
