import type { SupportedOfficialScoringRecord } from '../../adjudication/OfficialScoring';

/** Original actor identities and scoring must be authenticated before attribution. */
export type AttributedOfficialPlayerOutcome = Readonly<{
  attributionId: string;
  careerId: string;
  competitionEditionId: string;
  gameId: string;
  playId: number;
  gameDay: number;
  batterPlayerId: string;
  pitcherPlayerId: string;
  classification: SupportedOfficialScoringRecord['classification'];
}>;

export type OfficialPlayerOutcomeStatisticsScope = Readonly<{
  careerId: string;
  competitionEditionId: string;
  playerId: string;
  asOfDay: number;
}>;

type Classification = SupportedOfficialScoringRecord['classification'];
type OutcomeCounts = Record<Classification, number>;

export type OfficialPlayerOutcomeTally = Readonly<{
  classifiedPlays: number;
  outcomes: Readonly<OutcomeCounts>;
}>;

export type OfficialPlayerOutcomeStatistics = Readonly<{
  scope: OfficialPlayerOutcomeStatisticsScope;
  coverage: 'attributed_supported_plays_only';
  batting: OfficialPlayerOutcomeTally;
  pitching: OfficialPlayerOutcomeTally;
  attributionIds: readonly string[];
  gameIds: readonly string[];
}>;

const emptyOutcomes = (): OutcomeCounts => ({
  base_on_balls: 0,
  strikeout: 0,
  foul_out: 0,
  fly_out: 0,
  ground_out: 0,
  base_hit: 0,
  reached_on_error: 0,
  fielders_choice: 0,
});

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const increment = (value: number): number => {
  const next = value + 1;
  if (!Number.isSafeInteger(next)) {
    throw new Error('official outcome statistics count overflow');
  }
  return next;
};

/**
 * Counts only supplied, already-attributed supported plays. The result makes no
 * claim of complete season coverage and does not infer baseball scoring metrics.
 * Invalid or duplicate evidence rejects even when it is outside the read scope.
 */
export const aggregateOfficialPlayerOutcomes = (
  input: readonly AttributedOfficialPlayerOutcome[],
  scope: OfficialPlayerOutcomeStatisticsScope,
): OfficialPlayerOutcomeStatistics => {
  // Preserve the readonly element contract while the runtime array check below
  // validates the caller's container without widening iteration to any[].
  const outcomes: readonly AttributedOfficialPlayerOutcome[] = input;
  if (!scope || !id(scope.careerId) || !id(scope.competitionEditionId)
    || !id(scope.playerId) || !integer(scope.asOfDay)) {
    throw new Error('invalid official outcome statistics scope');
  }
  if (!Array.isArray(input)) {
    throw new Error('official outcome statistics require an array');
  }
  const batting = { classifiedPlays: 0, outcomes: emptyOutcomes() };
  const pitching = { classifiedPlays: 0, outcomes: emptyOutcomes() };
  const seenAttributions = new Set<string>();
  const seenPlays = new Set<string>();
  const attributionIds: string[] = [];
  const gameIds = new Set<string>();

  for (const item of outcomes) {
    if (!item || !id(item.attributionId) || !id(item.careerId)
      || !id(item.competitionEditionId) || !id(item.gameId)
      || !id(item.batterPlayerId) || !id(item.pitcherPlayerId)
      || item.batterPlayerId === item.pitcherPlayerId
      || !integer(item.playId) || !integer(item.gameDay)
      || typeof item.classification !== 'string'
      || !Object.hasOwn(batting.outcomes, item.classification)) {
      throw new Error('invalid attributed official outcome');
    }
    if (seenAttributions.has(item.attributionId)) {
      throw new Error('duplicate official outcome attribution');
    }
    const playKey = JSON.stringify([item.careerId, item.gameId, item.playId]);
    if (seenPlays.has(playKey)) {
      throw new Error('duplicate official outcome play');
    }
    seenAttributions.add(item.attributionId);
    seenPlays.add(playKey);

    if (item.careerId !== scope.careerId
      || item.competitionEditionId !== scope.competitionEditionId
      || item.gameDay > scope.asOfDay) continue;
    const tally = item.batterPlayerId === scope.playerId ? batting
      : item.pitcherPlayerId === scope.playerId ? pitching : null;
    if (tally === null) continue;
    tally.classifiedPlays = increment(tally.classifiedPlays);
    tally.outcomes[item.classification] = increment(tally.outcomes[item.classification]);
    attributionIds.push(item.attributionId);
    gameIds.add(item.gameId);
  }

  return Object.freeze({
    scope: Object.freeze({ careerId: scope.careerId,
      competitionEditionId: scope.competitionEditionId,
      playerId: scope.playerId, asOfDay: scope.asOfDay }),
    coverage: 'attributed_supported_plays_only',
    batting: Object.freeze({ classifiedPlays: batting.classifiedPlays,
      outcomes: Object.freeze(batting.outcomes) }),
    pitching: Object.freeze({ classifiedPlays: pitching.classifiedPlays,
      outcomes: Object.freeze(pitching.outcomes) }),
    attributionIds: Object.freeze(attributionIds.sort()),
    gameIds: Object.freeze([...gameIds].sort()),
  });
};
