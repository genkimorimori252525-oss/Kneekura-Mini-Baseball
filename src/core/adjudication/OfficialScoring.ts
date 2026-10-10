import { deriveActualFairCatchOccupiedRunnerOutcome } from '../rules/FairCatchRunnerOutcome';
import { deriveBallWorldBattedRuleChronology } from '../rules/BallWorldBattedRuleChronology';
import { projectActualFairFieldTimeline } from '../sim/plateAppearance/ActualFairFieldTimeline';
import { validateActualFairCatchStationaryRunners, type ActualFairCatchScoringInput } from './ActualFairCatchScoring';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { RuleProfileId } from '../model/RuleProfileRef';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { deriveClosedNonLiveMatchState, type NonLiveOfficialContext } from './NonLiveOfficialApplication';
import { cloneInert } from './OfficialWindowPolicy';
import { classifyActualGroundOutForOfficialScoring,
  type ActualGroundOutScoringInput } from './ActualGroundOutScoring';
import {
  deriveClosedLiveBallMatchState,
  getOfficialPlayClosure,
  type OfficialPlayClosure,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';

export type OfficialFairBallScoringEvidence = Readonly<{
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
    | Readonly<{ kind: 'fielders_choice'; retiredPriorRunnerId: string }>
    | Readonly<{ kind: 'fielders_choice'; attemptedPriorRunnerId: string }>;
}> & (Readonly<{ schemaVersion: 1 }> | Readonly<{ schemaVersion: 2;
  /** Explicit accepted scorer awards; final base occupancy does not award hit value. */
  playerStatistics: Readonly<{ rbiRunnerIds: readonly string[]; hitBases?: 1 | 2 | 3 | 4; sacrifice?: 'none' | 'bunt' | 'fly' }>;
}>);

/** Accepted descriptive judgment for the already supported caught-foul path.
 * Catch timing/batter/ruling come from the original timeline and closure; the
 * scorer explicitly supplies the defensive role/location and scoring awards. */
export type OfficialCaughtFoulScoringEvidence = Readonly<{
  schemaVersion: 1; sourceKind: 'official_caught_foul_scorer_judgment';
  sourceEventId: string; scorerId: string; ruleProfileId: RuleProfileId;
  playId: number; closureId: string; basisRulingId: string; recordedAtTick: number;
  contactSequence: number; catchSequence: number; batterRunnerId: string;
  catcherPlayerId: string; catcherRole: 'outfielder' | 'infielder_in_outfield' | 'other';
  playerStatistics: Readonly<{ rbiRunnerIds: readonly string[]; sacrifice: 'none' | 'fly' }>;
}>;

export type OfficialScoringInput = Readonly<{
  match: CanonicalMatchState;
  timeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
}> & (
  | Readonly<{ kind: 'non_live'; context: NonLiveOfficialContext }>
  | Readonly<{ kind: 'live_ball';
      scoringEvidence?: OfficialFairBallScoringEvidence;
      caughtFoulEvidence?: OfficialCaughtFoulScoringEvidence;
      /** Native must authenticate the complete physical sidecar and independently owned end. */
      fairCatchEvidence?: ActualFairCatchScoringInput;
      /** Original fair-ground first-base race and independently owned end. */
      groundOutEvidence?: ActualGroundOutScoringInput }>
);

export type SupportedOfficialScoringRecord = Readonly<{
  playId: number;
  closureId: string;
  basisRulingId: string;
  classification: 'base_on_balls' | 'strikeout' | 'foul_out' | 'fly_out' | 'ground_out'
    | 'base_hit' | 'reached_on_error' | 'fielders_choice';
  battingTeam: 'away' | 'home';
  runsScored: number;
  hitsCredited: 0 | 1;
  errorsCharged: 0 | 1;
  playerStatistics?: Readonly<{ runsBattedIn: number; hitBases?: 1 | 2 | 3 | 4; sacrifice?: 'none' | 'bunt' | 'fly' }>;
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
// Native archives sort object keys. Equality must preserve all values and array
// order without making JavaScript insertion order part of physical truth.
const canonicalJson = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

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
  if (![1, 2].includes(evidence.schemaVersion)
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
  if (evidence.schemaVersion === 2) {
    const statistics = evidence.playerStatistics;
    const hit = evidence.judgment.kind === 'base_hit';
    const keys = ['rbiRunnerIds', ...(hit ? ['hitBases'] : []), ...(statistics && Object.hasOwn(statistics, 'sacrifice') ? ['sacrifice'] : [])];
    if (!statistics || Object.keys(statistics).sort().join('|') !== keys.sort().join('|')
      || !Array.isArray(statistics.rbiRunnerIds) || new Set(statistics.rbiRunnerIds).size !== statistics.rbiRunnerIds.length
      || statistics.rbiRunnerIds.some(runner => !nonEmpty(runner) || !scored.includes(runner))
      || hit && (![1, 2, 3, 4].includes(statistics.hitBases!) || statistics.hitBases === 4 && !scored.includes(batter))) {
      throw new Error('scoring evidence player awards contradict closed play');
    }
    if (Object.hasOwn(statistics, 'sacrifice')) {
      const sacrifice = statistics.sacrifice;
      const bases = ['first', 'second', 'third'] as const;
      const advanced = bases.some((base, index) => {
        const runner = match.bases[base];
        return runner !== null && (scored.includes(runner) || bases.some((nextBase, nextIndex) =>
          nextIndex > index && closure.officialDelta.basesAfter[nextBase] === runner));
      });
      if (!['none', 'bunt', 'fly'].includes(sacrifice!) || sacrifice !== 'none'
        && (!(evidence.judgment.kind === 'reached_on_error'
          || sacrifice === 'bunt' && evidence.judgment.kind === 'fielders_choice' && 'attemptedPriorRunnerId' in evidence.judgment)
          || match.outs >= 2 || !priorRunners.length
          || sacrifice === 'bunt' && !advanced || sacrifice === 'fly' && !scored.length)) {
        throw new Error('scoring evidence sacrifice judgment contradicts supported play');
      }
    }
  } else if (Object.hasOwn(evidence, 'playerStatistics')) {
    throw new Error('legacy scoring evidence cannot carry player awards');
  }
  const judgment = evidence.judgment;
  if (judgment.kind === 'base_hit') return;
  if (judgment.kind === 'reached_on_error'
    && nonEmpty(judgment.chargedFielderId)) return;
  if (judgment.kind === 'fielders_choice' && 'attemptedPriorRunnerId' in judgment) {
    const runner = judgment.attemptedPriorRunnerId;
    const bases = ['first', 'second', 'third'] as const;
    const start = bases.findIndex(base => match.bases[base] === runner);
    if (evidence.schemaVersion === 2 && nonEmpty(runner) && start >= 0
      && closure.officialDelta.outsAfter === match.outs && finalRunners.includes(batter)
      && (scored.includes(runner) || bases.some((base, index) => index > start && closure.officialDelta.basesAfter[base] === runner))) return;
    throw new Error('scoring evidence unsuccessful choice contradicts closed play');
  }
  if (judgment.kind === 'fielders_choice' && 'retiredPriorRunnerId' in judgment
    && nonEmpty(judgment.retiredPriorRunnerId)
    && priorRunners.includes(judgment.retiredPriorRunnerId)
    && !finalRunners.includes(judgment.retiredPriorRunnerId)
    && !scored.includes(judgment.retiredPriorRunnerId)
    && closure.officialDelta.outsAfter > match.outs
    && finalRunners.includes(batter)) return;
  throw new Error('scoring evidence judgment contradicts closed play');
};

const caughtFoulStatistics = (evidence: OfficialCaughtFoulScoringEvidence, match: CanonicalMatchState,
  timeline: CanonicalPlateAppearanceTimeline, closure: OfficialPlayClosure, catchSequence: number, batterRunnerId: string) => {
  const statistics = evidence.playerStatistics;
  const contact = timeline.events.find(event => event.sequence === evidence.contactSequence);
  const scored = closure.officialDelta.scoredRunnerIds;
  if (evidence.schemaVersion !== 1 || evidence.sourceKind !== 'official_caught_foul_scorer_judgment'
    || ![evidence.sourceEventId, evidence.scorerId, evidence.catcherPlayerId].every(nonEmpty)
    || evidence.catcherPlayerId === batterRunnerId || evidence.batterRunnerId !== batterRunnerId
    || evidence.ruleProfileId !== match.ruleProfileId || evidence.playId !== match.playId
    || evidence.closureId !== closure.closureId || evidence.basisRulingId !== closure.finalRuling.rulingId
    || !safeTick(evidence.recordedAtTick) || evidence.recordedAtTick < closure.closedAtTick
    || contact?.kind !== 'BatBallContact' || timeline.status.kind !== 'live_ball_complete' || contact.tick !== timeline.status.contactTick
    || !safeTick(evidence.contactSequence) || evidence.catchSequence !== catchSequence
    || !['outfielder', 'infielder_in_outfield', 'other'].includes(evidence.catcherRole)
    || !statistics || Object.keys(statistics).sort().join('|') !== 'rbiRunnerIds|sacrifice'
    || !Array.isArray(statistics.rbiRunnerIds) || new Set(statistics.rbiRunnerIds).size !== statistics.rbiRunnerIds.length
    || statistics.rbiRunnerIds.some(runner => !nonEmpty(runner) || !scored.includes(runner))
    || !['none', 'fly'].includes(statistics.sacrifice)
    || statistics.sacrifice === 'fly' && (evidence.catcherRole === 'other' || !statistics.rbiRunnerIds.length || match.outs >= 2)) {
    throw new Error('caught-foul scorer judgment differs from original catch');
  }
  return Object.freeze({ runsBattedIn: statistics.rbiRunnerIds.length, sacrifice: statistics.sacrifice });
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
    if (request.caughtFoulEvidence && (request.scoringEvidence || request.fairCatchEvidence || request.groundOutEvidence)) {
      throw new Error('caught-foul scoring rejects competing evidence');
    }
    const next = deriveClosedLiveBallMatchState(request.match, request.timeline, request.adjudication);
    const closure = getOfficialPlayClosure(request.adjudication);
    if (closure === null) throw new Error('official scoring requires OfficialPlayClosure');
    if (request.groundOutEvidence !== undefined) {
      if (request.scoringEvidence !== undefined || request.fairCatchEvidence !== undefined) {
        throw new Error('ground-out scoring rejects competing scoring evidence');
      }
      return Object.freeze({ kind: 'supported', record: classifyActualGroundOutForOfficialScoring({
        match: request.match, timeline: request.timeline, adjudication: request.adjudication,
        evidence: request.groundOutEvidence,
      }) });
    }
    if (request.fairCatchEvidence !== undefined) {
      const physical = request.fairCatchEvidence;
      const keys = ['originalTimeline', 'field', 'playEnd', ...('occupiedRunners' in physical ? ['occupiedRunners'] : []),
        ...('occupiedRunnerEvidence' in physical ? ['occupiedRunnerEvidence'] : [])];
      if ('occupiedRunners' in physical && 'occupiedRunnerEvidence' in physical) throw new Error('fair catch scoring rejects competing runner evidence');
      if (Object.keys(physical).sort().join('|') !== keys.sort().join('|')) throw new Error('invalid fair catch scoring sidecar');
      const caught = deriveBallWorldBattedRuleChronology(physical.field.evidence).ballEvidence;
      const projection = projectActualFairFieldTimeline({ originalTimeline: physical.originalTimeline, field: physical.field, playEnd: physical.playEnd });
      const batter = physical.field.evidence.batterRunnerId;
      const occupiedOutcome = physical.occupiedRunnerEvidence === undefined ? null : deriveActualFairCatchOccupiedRunnerOutcome({
        originalMatch: request.match, field: physical.field, runnerEvidence: physical.occupiedRunnerEvidence });
      if (occupiedOutcome?.kind === 'pending') throw new Error('fair catch scoring requires resolved occupied runner claims: ' + occupiedOutcome.reason);
      if (!occupiedOutcome) validateActualFairCatchStationaryRunners({ originalMatch: request.match, batterRunnerId: batter,
        originTick: physical.field.evidence.originTick, ticksPerSecond: physical.field.evidence.ticksPerSecond,
        endElapsedSeconds: physical.field.evidence.horizon.elapsedSeconds, occupiedRunners: physical.occupiedRunners });
      if (request.scoringEvidence !== undefined
        || caught.kind !== 'fly_catch'
        || projection.kind !== 'projected'
        || canonicalJson(projection.timeline) !== canonicalJson(request.timeline)
        || canonicalJson(physical.playEnd) !== canonicalJson(closure.playEnd)
        || physical.originalTimeline.playId !== request.match.playId
        || !nonEmpty(batter) || caught.correctRuleResult.batterRunnerId !== batter
        || canonicalJson(closure.officialDelta.basesAfter) !== canonicalJson(occupiedOutcome?.correctRuling.basesAfter ?? request.match.bases)
        || canonicalJson(closure.officialDelta.scoredRunnerIds) !== canonicalJson(occupiedOutcome?.correctRuling.scoredRunnerIds ?? [])
        || closure.officialDelta.outsAfter !== (occupiedOutcome?.correctRuling.outsAfter ?? request.match.outs + 1)) {
        throw new Error('fair catch scoring requires its exact physical projection and closed runner outcome');
      }
      const battingTeam = request.match.half === 'top' ? 'away' : 'home';
      return Object.freeze({ kind: 'supported', record: Object.freeze({
        playId: closure.playId, closureId: closure.closureId,
        basisRulingId: closure.finalRuling.rulingId,
        classification: 'fly_out', battingTeam,
        runsScored: occupiedOutcome?.finalRunnerLedger.scoredRunnerIds.length ?? 0, hitsCredited: 0, errorsCharged: 0,
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
        ...(request.scoringEvidence.schemaVersion === 2 ? { playerStatistics: Object.freeze({
          runsBattedIn: request.scoringEvidence.playerStatistics.rbiRunnerIds.length,
          ...(judgment.kind === 'base_hit' ? { hitBases: request.scoringEvidence.playerStatistics.hitBases! } : {}),
          ...(request.scoringEvidence.playerStatistics.sacrifice !== undefined ? { sacrifice: request.scoringEvidence.playerStatistics.sacrifice } : {}),
        }) } : {}),
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
        ...(request.caughtFoulEvidence ? { playerStatistics: caughtFoulStatistics(request.caughtFoulEvidence,
          request.match, request.timeline, closure, caught[0].sequence, caught[0].payload.resolution.batterRunnerId) } : {}),
      }) });
    }
    if (request.caughtFoulEvidence) throw new Error('caught-foul scorer judgment lacks the supported original catch');
    return Object.freeze({
      kind: 'unsupported',
      playId: closure.playId,
      closureId: closure.closureId,
      reason: 'live_ball_hit_error_fielders_choice_not_classified',
    });
  }
  throw new Error('unknown official scoring play kind');
};
