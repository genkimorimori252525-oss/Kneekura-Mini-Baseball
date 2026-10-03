import { expect, it } from 'vitest';
import { playerFieldingModelFixture as fixture } from './PlayerFieldingModelFixtures.test-support';
import { openSqlitePlayerFieldingModelStore } from './SqlitePlayerFieldingModelStore';
import { resolveRatedBallTransferTiming, createDefensiveRatedThrowLaunch } from '../../core/sim/fielding/DefensiveRatingAdapters';
import { DeterministicRng } from '../../core/rng/DeterministicRng';

it('owns the actual accepted Player/Person and reopens the immutable physical model without a peer', () => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId);
    expect(value.source).toEqual(f.source); expect(value.person).toEqual(f.person); expect(Object.isFrozen(value.source.ratings)).toBe(true);
    const reopened = f.track(openSqlitePlayerFieldingModelStore(f.path));
    expect(reopened.read(f.source.sourceId)).toEqual(value); expect(reopened.accept(f.source.sourceId)).toEqual(value);
    expect(reopened.selectAtDay('career-a', 'player-a', 10)).toEqual(value);
    expect(resolveRatedBallTransferTiming(1000, value.source.ratings, value.source.transferParameters).throwReadyTick).toBe(1210);
    const launch = createDefensiveRatedThrowLaunch({ releaseTick: 1210, origin: { x: 0, y: 1, z: 0 }, intendedTarget: { x: 10, y: 1, z: 0 },
      ratings: value.source.ratings, calibration: value.source.throwCalibration, rng: new DeterministicRng(42) });
    expect(launch.releaseSpeedMps).toBe(20); expect(launch.targetErrorScaleMeters).toBe(0.5);
    expect(value).not.toHaveProperty('out'); expect(value).not.toHaveProperty('possession');
    expect(() => reopened.selectAtDay('career-a', 'player-a', 9)).toThrow(/future/);
    expect(() => reopened.selectAtDay('career-a', 'missing-player', 10)).toThrow();
  } finally { f.close(); }
});
it.each(['career', 'player', 'link', 'before-intake'] as const)('rejects %s scope instead of adopting a caller identity', (kind) => {
  const f = fixture();
  try {
    const changed = kind === 'career' ? { ...f.source, careerId: 'other-career' } : kind === 'player' ? { ...f.source, playerId: 'player-b' }
      : kind === 'link' ? { ...f.source, personLinkSourceId: 'missing-link' } : { ...f.source, acceptedAtDay: 9 };
    f.sources.set(f.source.sourceId, changed); expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_fielding_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it.each(['rating', 'positions', 'transfer', 'transfer-overflow', 'throw', 'outcome'] as const)('rejects invalid %s calibration/Source without production defaults', (kind) => {
  const f = fixture();
  try {
    const changed = kind === 'rating' ? { ...f.source, ratings: { ...f.source.ratings, transfer: 1.01 } }
      : kind === 'positions' ? { ...f.source, ratings: { ...f.source.ratings, positionSuitability: { ...f.source.ratings.positionSuitability, P: NaN } } }
      : kind === 'transfer' ? { ...f.source, transferParameters: { ...f.source.transferParameters, minimumTransferDelayTicks: 301 } }
      : kind === 'transfer-overflow' ? { ...f.source, transferParameters: { ...f.source.transferParameters, maximumTransferDelayTicks: Number.MAX_SAFE_INTEGER } }
      : kind === 'throw' ? { ...f.source, throwCalibration: { ...f.source.throwCalibration, maximumReleaseSpeedMps: 9 } }
      : { ...f.source, out: true };
    f.sources.set(f.source.sourceId, changed); expect(() => f.models.accept(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it.each([
  "UPDATE world_player_fielding_models SET source_hash='changed'",
  "UPDATE world_player_fielding_models SET snapshot_hash='changed'",
  "UPDATE world_player_fielding_models SET career_id='wrong'",
  "UPDATE world_player_fielding_models SET person_link_source_id='wrong'",
  "UPDATE world_player_person_links SET person_id='wrong'",
])('reconstructs its own Source and actual original Person on read/retry: %s', (sql) => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId); f.db.exec(sql);
    expect(() => f.models.read(f.source.sourceId)).toThrow(); expect(() => f.models.accept(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects a combined calibration key instead of accepting missing mandatory throw values', () => {
  const f = fixture();
  try {
    const throwCalibration = { 'maximumReleaseSpeedMps|maximumTargetErrorMeters|minimumReleaseSpeedMps|minimumTargetErrorMeters': 1 };
    f.sources.set(f.source.sourceId, { ...f.source, throwCalibration } as unknown as typeof f.source);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/invalid accepted/);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_fielding_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('keeps the baseline immutable rather than replacing it with another accepted Source', () => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId), next = { ...f.source, sourceId: 'different-baseline', sourceVersion: 'fixture-v2' };
    f.sources.set(next.sourceId, next); expect(() => f.models.accept(next.sourceId)).toThrow(/baseline/);
    expect(f.models.read(f.source.sourceId)).toEqual(value);
    f.sources.set(f.source.sourceId, { ...f.source, ratings: { ...f.source.ratings, armStrength: 0.9 } });
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/frozen/);
  } finally { f.close(); }
});
