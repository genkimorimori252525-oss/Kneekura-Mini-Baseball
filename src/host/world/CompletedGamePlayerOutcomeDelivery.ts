import { isDeepStrictEqual } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { freeze } from '../../core/world/club/ClubValidation';
import type { OfficialGameResult } from '../../core/world/competition/OfficialGameCompletion';
import type { CompletedMatchPlayerOutcomes, openSqliteOfficialPlayerOutcomeStore } from './SqliteOfficialPlayerOutcomeStore';
import { withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

export type CompletedGameOutcomeStores = Readonly<{
  outcomes?: Pick<ReturnType<typeof openSqliteOfficialPlayerOutcomeStore>, 'applyCompletedGame'>;
}>;
export type CompletedGameOutcomeCommitment = Readonly<{ outcomeDelivery?: 'required_completed_match_outcomes_v1' }>;
export type WithCompletedGamePlayerOutcomes<T> = T & Readonly<{ playerOutcomes?: CompletedGamePlayerOutcomeDelivery }>;
export type CompletedGamePlayerOutcomeDelivery = Readonly<{
  careerId: string; competitionEditionId: string; gameIds: readonly string[];
}> & (Readonly<{ kind: 'unavailable'; reason: 'outcome_authority_missing' }>
  | Readonly<{ kind: 'delivered'; coverage: CompletedMatchPlayerOutcomes['coverage']; games: readonly CompletedMatchPlayerOutcomes[] }>);

/** Existing completion drivers select the games. Each delivery owns its Native
 * transaction and reauthenticates on retry; there is no extra completion journal.
 * Competition read proofs never survive a downstream outcome write. */
export const deliverCompletedGamePlayerOutcomes = (
  stores: CompletedGameOutcomeStores, careerId: string, competitionEditionId: string,
  originalFinals: readonly OfficialGameResult[],
): CompletedGamePlayerOutcomeDelivery => {
  const finals = cloneInert(originalFinals), gameIds = finals.map(final => final.gameId);
  const id = (value: unknown): value is string => typeof value === 'string' && !!value && value.trim() === value;
  if (!id(careerId) || !id(competitionEditionId) || !finals.length || new Set(gameIds).size !== gameIds.length
    || finals.some(final => !id(final.gameId) || final.seasonId !== competitionEditionId
      || !final.venueBinding || final.venueBinding.gameId !== final.gameId)) {
    throw new Error('completed game outcome delivery final scope differs');
  }
  const scope = { careerId, competitionEditionId, gameIds };
  if (!stores.outcomes) return freeze({ ...scope, kind: 'unavailable', reason: 'outcome_authority_missing' });
  const games = finals.map(final => {
    const delivered = cloneInert(withCompetitionSourceReadPhase(() => stores.outcomes!.applyCompletedGame({ careerId, gameId: final.gameId })));
    if (!isDeepStrictEqual(delivered.finalResult, final)) throw new Error('completed game outcome delivery original final differs');
    return delivered;
  });
  return freeze({ ...scope, kind: 'delivered', games, coverage: games.every(game => game.coverage === 'all_official_plays_attributed')
    ? 'all_official_plays_attributed' : 'attributed_supported_plays_only' });
};
