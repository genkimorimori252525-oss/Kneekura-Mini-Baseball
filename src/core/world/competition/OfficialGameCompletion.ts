import type { OfficialStateApplicationReceipt } from '../../adjudication/NextPlayActivation';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import {
  createCanonicalLineScoreSnapshot,
  type CanonicalLineScoreSnapshot,
} from '../../model/CanonicalLineScoreSnapshot';

export type GameCompletionPolicy = Readonly<{
  version: string;
  minimumInnings: number;
  maximumInnings?: number;
  tiesAllowed: boolean;
}>;
export type OfficialGameResult = Readonly<{
  gameId: string;
  seasonId: string;
  homeClubId: string;
  awayClubId: string;
  homeRuns: number;
  awayRuns: number;
  winnerClubId: string | null;
  completionReason: 'HOME_LEADS_AFTER_TOP' | 'WALK_OFF' | 'BOTTOM_COMPLETE' | 'TIE_LIMIT';
  ruleProfileId: CanonicalMatchState['ruleProfileId'];
  gamePolicyVersion: string;
  closureId: string;
  applicationId: string;
  durableRevision: number;
  lineScore: CanonicalLineScoreSnapshot;
}>;
export type OfficialGameBoundary =
  | Readonly<{ kind: 'GAME_CONTINUES'; nextMatchState: CanonicalMatchState }>
  | Readonly<{ kind: 'GAME_FINAL'; result: OfficialGameResult }>;
export type OfficialGameBoundaryInput = Readonly<{
  gameId: string;
  seasonId: string;
  homeClubId: string;
  awayClubId: string;
  policy: GameCompletionPolicy;
  priorMatch: CanonicalMatchState;
  application: OfficialStateApplicationReceipt;
  lineScore: CanonicalLineScoreSnapshot;
}>;

const positive = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const nonnegative = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/**
 * Evaluates finality only after the official state has a durable application receipt.
 * Match Core's half-inning transition may already point at the next half; that
 * transition is never treated as evidence that the next pitch has begun.
 */
export const resolveOfficialGameBoundary = (
  input: OfficialGameBoundaryInput,
): OfficialGameBoundary => {
  const { priorMatch: prior, application, policy } = input;
  const after = application.appliedMatchState;
  if (
    !input.gameId || !input.seasonId || !input.homeClubId || !input.awayClubId
    || input.homeClubId === input.awayClubId
    || !policy.version || !positive(policy.minimumInnings)
    || (policy.maximumInnings !== undefined
      && (!positive(policy.maximumInnings) || policy.maximumInnings < policy.minimumInnings))
    || typeof policy.tiesAllowed !== 'boolean'
    || (policy.maximumInnings !== undefined && !policy.tiesAllowed)
  ) throw new Error('invalid versioned game completion policy or identity');
  if (
    !application.applicationId || !application.closureId
    || !nonnegative(application.durableRevision)
    || application.previousPlayId !== prior.playId
    || after.playId !== prior.playId + 1
    || after.ruleProfileId !== prior.ruleProfileId
    || !positive(prior.inning)
    || !nonnegative(after.score.away) || !nonnegative(after.score.home)
    || after.score.away < prior.score.away || after.score.home < prior.score.home
  ) throw new Error('official game boundary requires matching durable MatchState application');
  if (
    (prior.half === 'top' && after.score.home !== prior.score.home)
    || (prior.half === 'bottom' && after.score.away !== prior.score.away)
  ) throw new Error('official play cannot credit runs to the fielding team');

  const lineScore = createCanonicalLineScoreSnapshot(input.lineScore);
  if (
    lineScore.innings.length < prior.inning
    || lineScore.totals.away.runs !== after.score.away
    || lineScore.totals.home.runs !== after.score.home
  ) throw new Error('official line score must match the durable MatchState score');
  if (lineScore.innings.slice(prior.inning).some((inning) =>
    inning.awayRuns !== null || inning.homeRuns !== null)) {
    throw new Error('future inning must not contain official scoring');
  }
  const playedInnings = lineScore.innings.slice(0, prior.inning);
  if (playedInnings.some((inning) => inning.awayRuns === null)) {
    throw new Error('played top half must have an official run count');
  }
  if (playedInnings.slice(0, -1).some((inning) => inning.homeRuns === null)) {
    throw new Error('previously played bottom half must have an official run count');
  }

  const topEnded = prior.half === 'top'
    && after.half === 'bottom' && after.inning === prior.inning && after.outs === 0;
  const bottomEnded = prior.half === 'bottom'
    && after.half === 'top' && after.inning === prior.inning + 1 && after.outs === 0;
  const sameHalf = after.half === prior.half && after.inning === prior.inning;
  if (!topEnded && !bottomEnded && !sameHalf) {
    throw new Error('durable MatchState has an invalid half-inning transition');
  }
  if (prior.half === 'top' && playedInnings[prior.inning - 1].homeRuns !== null) {
    throw new Error('unplayed bottom half must remain null in official line score');
  }
  if (prior.half === 'bottom' && playedInnings[prior.inning - 1].homeRuns === null) {
    throw new Error('played bottom half must have an official run count');
  }
  let completionReason: OfficialGameResult['completionReason'] | null = null;
  if (prior.inning >= policy.minimumInnings) {
    if (topEnded && after.score.home > after.score.away) {
      completionReason = 'HOME_LEADS_AFTER_TOP';
    } else if (prior.half === 'bottom' && sameHalf
      && prior.score.home <= prior.score.away && after.score.home > after.score.away) {
      completionReason = 'WALK_OFF';
    } else if (bottomEnded && after.score.home !== after.score.away) {
      completionReason = 'BOTTOM_COMPLETE';
    } else if (bottomEnded && policy.maximumInnings !== undefined
      && prior.inning >= policy.maximumInnings) {
      completionReason = 'TIE_LIMIT';
    }
  }
  if (completionReason === null) {
    return Object.freeze({
      kind: 'GAME_CONTINUES',
      nextMatchState: after,
    });
  }
  const frozenLineScore = Object.freeze({
    innings: Object.freeze(playedInnings.map((inning) => Object.freeze({ ...inning }))),
    totals: Object.freeze({
      away: Object.freeze({ ...lineScore.totals.away }),
      home: Object.freeze({ ...lineScore.totals.home }),
    }),
  });
  return Object.freeze({
    kind: 'GAME_FINAL',
    result: Object.freeze({
      gameId: input.gameId,
      seasonId: input.seasonId,
      homeClubId: input.homeClubId,
      awayClubId: input.awayClubId,
      homeRuns: after.score.home,
      awayRuns: after.score.away,
      winnerClubId: after.score.home > after.score.away ? input.homeClubId
        : after.score.away > after.score.home ? input.awayClubId : null,
      completionReason,
      ruleProfileId: after.ruleProfileId,
      gamePolicyVersion: policy.version,
      closureId: application.closureId,
      applicationId: application.applicationId,
      durableRevision: application.durableRevision,
      lineScore: frozenLineScore,
    }),
  });
};
