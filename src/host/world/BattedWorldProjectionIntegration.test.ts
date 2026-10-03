import { expect, it } from 'vitest';
import { battedWorldContinuationFixture } from './BattedWorldContinuationFixtures.test-support';
import { openSqliteBattedPostResponseFlightStore } from './SqliteBattedPostResponseFlightStore';

const fixture = () => {
  const base = battedWorldContinuationFixture();
  const source = { sourceId: 'shared-response-projection', sourceVersion: 'fixture-v1',
    contactResponseSourceId: base.responseSource.sourceId, previousContinuationSourceId: null, searchDurationTicks: 100_000 };
  const projections = base.f.track(openSqliteBattedPostResponseFlightStore(base.f.path, base.responses,
    { readAcceptedContinuation: (id) => id === source.sourceId ? source : null }));
  return { ...base, projectionSource: source, projections };
};

it('owns both projection and actual World prefix from the same original Native response', () => {
  const { f, response, responses, continuations, continuationSource, projections, projectionSource } = fixture();
  try {
    const projection = projections.accept(projectionSource.sourceId);
    const actual = continuations.accept(continuationSource.sourceId);
    expect(projection.result.kind).toBe('flight_projection');
    expect(actual.result.steps[0].world.kind).toBe('boundary');
    expect(projection.response).toEqual(response);
    expect(actual.response).toEqual(response);
    expect(responses.read(response.source.sourceId)).toEqual(response);
    expect(projections.read(projectionSource.sourceId)).toEqual(projection);
    expect(continuations.read(continuationSource.sourceId)).toEqual(actual);
    expect(projections.accept(projectionSource.sourceId)).toEqual(projection);
    expect(continuations.accept(continuationSource.sourceId)).toEqual(actual);
    expect(actual).not.toHaveProperty('possession');
    expect(actual).not.toHaveProperty('playEnd');
  } finally { f.close(); }
});

it('re-derives actual contacts independently of a corrupted projection archive', () => {
  const { f, continuations, continuationSource, projections, projectionSource } = fixture();
  try {
    projections.accept(projectionSource.sourceId);
    const actual = continuations.accept(continuationSource.sourceId);
    f.db.prepare("UPDATE batted_post_response_flights SET snapshot_hash='changed' WHERE source_id=?").run(projectionSource.sourceId);
    expect(() => projections.read(projectionSource.sourceId)).toThrow();
    expect(continuations.read(continuationSource.sourceId)).toEqual(actual);
    f.db.prepare("UPDATE batted_world_continuations SET snapshot_hash='changed' WHERE source_id=?").run(continuationSource.sourceId);
    expect(() => continuations.read(continuationSource.sourceId)).toThrow();
  } finally { f.close(); }
});
