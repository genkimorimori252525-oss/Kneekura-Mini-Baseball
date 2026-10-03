import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import { openSqliteBattedWorldContinuationStore, type AcceptedBattedWorldContinuation } from './SqliteBattedWorldContinuationStore';

export const battedWorldContinuationFixture = (path?: string, kind: Parameters<typeof battedContactResponseFixture>[1] = 'body') => {
  const base = battedContactResponseFixture(path, kind), { f, responses, responseSource } = base;
  const response = responses.accept(responseSource.sourceId);
  const throughTick = response.touch.worldContact.actors[0].primitive.endTick;
  const source: AcceptedBattedWorldContinuation = { sourceId: 'continuation-1', sourceVersion: 'fixture-v1',
    responseSourceId: responseSource.sourceId, previousContinuationSourceId: null, throughTick };
  const sources = new Map([[source.sourceId, source]]);
  const authority = { readAcceptedContinuation: (id: string) => sources.get(id) ?? null };
  const continuations = f.track(openSqliteBattedWorldContinuationStore(f.path, responses, authority));
  return { ...base, response, continuationSource: source, continuationSources: sources, continuationAuthority: authority, continuations, throughTick };
};
