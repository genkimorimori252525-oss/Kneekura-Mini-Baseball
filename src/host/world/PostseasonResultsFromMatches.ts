import { isDeepStrictEqual } from 'node:util';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { PostseasonSeriesPlan } from
  '../../core/world/competition/PostseasonSeries';
import type { SqliteOfficialStateStore } from
  '../SqliteOfficialStateStore';

export type PostseasonMatchSource = Pick<SqliteOfficialStateStore,
  'getMatch' | 'getOfficialFixture'>;

/** Only the contiguous played prefix of one series can become official input. */
export const readDurablePostseasonResults = (
  matchStore: PostseasonMatchSource,
  plan: PostseasonSeriesPlan,
): readonly OfficialGameResult[] => {
  const results: OfficialGameResult[] = [];
  let pending = false;
  for (const game of plan.scheduledGames) {
    const match = matchStore.getMatch(game.gameId);
    if (!match?.finalResult) {
      pending = true;
      continue;
    }
    if (pending) {
      throw new Error('postseason Match final skips an earlier game');
    }
    const fixture = matchStore.getOfficialFixture(game.gameId);
    if (!fixture || !match.finalResult.venueBinding
      || !isDeepStrictEqual(fixture,
        match.finalResult.venueBinding)) {
      throw new Error('postseason result lacks durable Match fixture');
    }
    results.push(match.finalResult);
  }
  return Object.freeze(results);
};
