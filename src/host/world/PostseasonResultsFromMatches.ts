import { isDeepStrictEqual } from 'node:util';
import { createCompetitionSourceReader } from './CompetitionSourceReadScope';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { PostseasonSeriesPlan } from
  '../../core/world/competition/PostseasonSeries';
import type { SqliteOfficialStateStore } from
  '../SqliteOfficialStateStore';

export type PostseasonMatchSource = Pick<SqliteOfficialStateStore,
  'getMatch' | 'getOfficialFixture'>;
const sourceReaders = new WeakMap<PostseasonMatchSource, PostseasonMatchSource>();
const readersFor = (source: PostseasonMatchSource): PostseasonMatchSource => {
  let readers = sourceReaders.get(source);
  if (!readers) {
    readers = { getMatch: createCompetitionSourceReader((gameId: string) => source.getMatch(gameId)),
      getOfficialFixture: createCompetitionSourceReader((gameId: string) => source.getOfficialFixture(gameId)) };
    sourceReaders.set(source, readers);
  }
  return readers;
};

/** A final is usable only with the fixture binding pinned by Match. */
export const readDurableOfficialGameResult = (
  matchStore: PostseasonMatchSource,
  gameId: string,
): OfficialGameResult | null => {
  const readers = readersFor(matchStore);
  const final = readers.getMatch(gameId)?.finalResult;
  if (!final) return null;
  const fixture = readers.getOfficialFixture(gameId);
  if (!fixture || !final.venueBinding
    || !isDeepStrictEqual(fixture, final.venueBinding)) {
    throw new Error('postseason result lacks durable Match fixture');
  }
  return final;
};

/** Only the contiguous played prefix of one series can become official input. */
export const readDurablePostseasonResults = (
  matchStore: PostseasonMatchSource,
  plan: PostseasonSeriesPlan,
): readonly OfficialGameResult[] => {
  const results: OfficialGameResult[] = [];
  let pending = false;
  for (const game of plan.scheduledGames) {
    const result = readDurableOfficialGameResult(matchStore,
      game.gameId);
    if (!result) {
      pending = true;
      continue;
    }
    if (pending) {
      throw new Error('postseason Match final skips an earlier game');
    }
    results.push(result);
  }
  return Object.freeze(results);
};
