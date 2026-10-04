import { expect, it } from 'vitest';
import { playerLocomotionModelFixture as fixture } from './PlayerLocomotionModelFixtures.test-support';
import { openSqlitePlayerLocomotionModelStore, playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('owns the actual Player/Person and exact fielding baseline, then reopens without an authority', () => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId);
    expect(value.source).toEqual(f.source); expect(value.fieldingModel).toEqual(f.fieldingModel);
    expect(value.fieldingModel.person).toEqual(f.person);
    expect(value.source.calibration.brakingMps2).toBe(8);
    expect(value.fieldingModel.source.ratings.acceleration).toBe(0.25);
    expect(value.fieldingModel.source.ratings.routeEfficiency).toBe(0.75);
    expect(value.source.capability).toBe('defender_locomotion_v1');
    expect(value.source).not.toHaveProperty('ratings'); expect(value.source).not.toHaveProperty('view');
    expect(Object.isFrozen(value)).toBe(true); expect(Object.isFrozen(value.source.calibration.accelerationRatingCalibration)).toBe(true);
    expect(Object.isFrozen(value.fieldingModel.source.ratings)).toBe(true);
    f.models.close();
    const reopened = f.track(openSqlitePlayerLocomotionModelStore(f.path));
    expect(reopened.read(f.source.sourceId)).toEqual(value);
    expect(reopened.accept(f.source.sourceId)).toEqual(value);
    expect(reopened.selectAtDay('career-a', 'player-a', 11)).toEqual(value);
    expect(playerLocomotionModelEvidenceFromSqlite(f.db).read(f.source.sourceId)).toEqual(value);
    expect(playerLocomotionModelEvidenceFromSqlite(f.db).selectAtDay('career-a', 'player-a', 12)).toEqual(value);
    expect(() => reopened.selectAtDay('career-a', 'player-a', 10)).toThrow(/future/);
    expect(() => reopened.selectAtDay('career-a', 'player-b', 11)).toThrow(/missing/);
    expect(() => reopened.selectAtDay('other-career', 'player-a', 11)).toThrow(/missing/);
  } finally { f.close(); }
});
it.each(['career', 'player', 'person-link', 'fielding-model', 'before-model'] as const)('rejects foreign or unavailable %s evidence', (kind) => {
  const f = fixture();
  try {
    const changed = kind === 'career' ? { ...f.source, careerId: 'other-career' }
      : kind === 'player' ? { ...f.source, playerId: 'player-b' }
      : kind === 'person-link' ? { ...f.source, personLinkSourceId: 'other-person-link' }
      : kind === 'fielding-model' ? { ...f.source, fieldingModelSourceId: 'other-model' }
      : { ...f.source, acceptedAtDay: 9 };
    f.sources.set(f.source.sourceId, changed); expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_locomotion_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rejects a future fielding model even when the Person is already available', () => {
  const f = fixture();
  try {
    const source = { ...f.fieldingModel.source, acceptedAtDay: 12 }, model = { ...f.fieldingModel, source };
    f.db.prepare('UPDATE world_player_fielding_models SET accepted_at_day=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run(12, json(source), hash(source), json(model), hash(model));
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/scope|future/);
  } finally { f.close(); }
});
it.each([
  { sourceVersion: '' }, { sourceId: 'wrong-id' }, { acceptedAtDay: 1.5 }, { result: 'safe' },
  { capability: 'relative_reach_v1' }, { capability: 'defender_locomotion_v2' }, { capability: null },
  { calibration: null }, { ratings: { situationalAwareness: 0.5 } },
])('rejects malformed accepted Source %j', (changed) => {
  const f = fixture();
  try {
    f.sources.set(f.source.sourceId, { ...f.source, ...changed } as unknown as typeof f.source);
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_locomotion_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rejects incomplete parameters instead of promoting fixture calibration or ratings into a default', () => {
  const f = fixture();
  try {
    const calibration = { ...f.source.calibration, arrivalRadiusMeters: undefined };
    f.sources.set(f.source.sourceId, { ...f.source, calibration } as unknown as typeof f.source);
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    f.sources.delete(f.source.sourceId); expect(() => f.models.accept(f.source.sourceId)).toThrow(/missing/);
    expect(f.models.read(f.source.sourceId)).toBeNull();
  } finally { f.close(); }
});
it('preserves the original baseline, refuses another version, and detects changed authority on retry', () => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId);
    const next = { ...f.source, sourceId: 'locomotion-v2', sourceVersion: 'synthetic-v2', acceptedAtDay: 12 };
    f.sources.set(next.sourceId, next); expect(() => f.models.accept(next.sourceId)).toThrow(/baseline/);
    expect(f.models.selectAtDay('career-a', 'player-a', 12)).toEqual(value);
    f.sources.set(f.source.sourceId, { ...f.source, calibration: { ...f.source.calibration, arrivalRadiusMeters: 0.1 } });
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/frozen/);
    expect(f.models.read(f.source.sourceId)).toEqual(value);
    f.sources.delete(f.source.sourceId); expect(f.models.accept(f.source.sourceId)).toEqual(value);
  } finally { f.close(); }
});
it.each([
  "UPDATE world_player_locomotion_models SET capability='changed'",
  "UPDATE world_player_locomotion_models SET source_version='changed'",
  "UPDATE world_player_locomotion_models SET source_hash='changed'",
  "UPDATE world_player_locomotion_models SET snapshot_hash='changed'",
  "UPDATE world_player_locomotion_models SET career_id='changed'",
  "UPDATE world_player_locomotion_models SET player_id='changed'",
  "UPDATE world_player_locomotion_models SET person_link_source_id='changed'",
  "UPDATE world_player_locomotion_models SET fielding_model_source_id='changed'",
  'UPDATE world_player_locomotion_models SET accepted_at_day=12',
  "UPDATE world_player_fielding_models SET snapshot_hash='changed'",
  "UPDATE world_player_person_links SET person_id='changed'",
])('reconstructs original Source and its bindings on read and retry: %s', (sql) => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId); f.db.exec(sql);
    expect(() => f.models.read(f.source.sourceId)).toThrow();
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(() => f.models.selectAtDay('career-a', 'player-a', 11)).toThrow();
  } finally { f.close(); }
});
it('rejects a fully rehashed Person rebinding against the previously accepted locomotion snapshot', () => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    const person = { ...f.person, personId: 'different-person' }, fieldingModel = { ...f.fieldingModel, person };
    f.db.prepare('UPDATE world_player_person_links SET person_id=?,source_json=?').run(person.personId, json(person));
    f.db.prepare('UPDATE world_player_fielding_models SET snapshot_json=?,snapshot_hash=?').run(json(fieldingModel), hash(fieldingModel));
    expect(f.fieldingModels.read(f.fieldingModel.source.sourceId)).toEqual(fieldingModel);
    expect(() => f.models.read(f.source.sourceId)).toThrow(/archive/);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/archive/);
  } finally { f.close(); }
});
it('rejects changed but rehashed fielding calibration instead of silently refreshing its exact reference', () => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    const source = { ...f.fieldingModel.source, ratings: { ...f.fieldingModel.source.ratings, acceleration: 0.9 } };
    const model = { ...f.fieldingModel, source };
    f.db.prepare('UPDATE world_player_fielding_models SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run(json(source), hash(source), json(model), hash(model));
    expect(f.fieldingModels.read(source.sourceId)).toEqual(model);
    expect(() => f.models.read(f.source.sourceId)).toThrow(/archive/);
  } finally { f.close(); }
});
it('validates query inputs and closed stores without creating data', () => {
  const f = fixture();
  try {
    expect(() => f.models.read(' ')).toThrow(); expect(() => f.models.accept(' ')).toThrow();
    expect(() => f.models.selectAtDay('career-a', 'player-a', NaN)).toThrow();
    expect(() => f.models.selectAtDay('career-a', 'player-a', -1)).toThrow();
    expect(() => f.models.selectAtDay('', 'player-a', 11)).toThrow();
    expect(() => openSqlitePlayerLocomotionModelStore('')).toThrow();
    expect(() => openSqlitePlayerLocomotionModelStore(f.path, {} as never)).toThrow();
    f.models.close(); f.models.close();
    expect(() => f.models.read(f.source.sourceId)).toThrow(/closed/);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/closed/);
    expect(() => f.models.selectAtDay('career-a', 'player-a', 11)).toThrow(/closed/);
  } finally { f.close(); }
});

it('preserves all original fielding and Person archive bytes after acceptance and every read path', () => {
  const f = fixture();
  try {
    const archive = () => ({ fielding: f.db.prepare('SELECT * FROM world_player_fielding_models').all(),
      people: f.db.prepare('SELECT * FROM world_player_person_links').all() });
    const original = archive();
    f.models.accept(f.source.sourceId); f.models.read(f.source.sourceId); f.models.accept(f.source.sourceId);
    f.models.selectAtDay('career-a', 'player-a', Number.MAX_SAFE_INTEGER);
    expect(archive()).toEqual(original);
  } finally { f.close(); }
});
it.each(['source', 'snapshot-source', 'snapshot-fielding', 'snapshot-person', 'index'] as const)(
  'cannot hide a previous baseline when only the %s scope mirror still identifies its original Player', (remaining) => {
    const f = fixture();
    try {
      const value = f.models.accept(f.source.sourceId), foreign = { careerId: 'moved-career', playerId: 'moved-player' };
      const source = remaining === 'source' ? value.source : { ...value.source, ...foreign };
      const snapshot = { source: remaining === 'snapshot-source' ? value.source : { ...value.source, ...foreign },
        fieldingModel: { source: remaining === 'snapshot-fielding' ? value.fieldingModel.source : { ...value.fieldingModel.source, ...foreign },
          person: remaining === 'snapshot-person' ? value.fieldingModel.person : { ...value.fieldingModel.person, ...foreign } } };
      f.db.prepare('UPDATE world_player_locomotion_models SET career_id=?,player_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
        .run(remaining === 'index' ? 'career-a' : foreign.careerId, remaining === 'index' ? 'player-a' : foreign.playerId,
          json(source), hash(source), json(snapshot), hash(snapshot));
      const replacement = { ...f.source, sourceId: 'locomotion-replacement' }; f.sources.set(replacement.sourceId, replacement);
      expect(() => f.models.selectAtDay('career-a', 'player-a', 11)).toThrow();
      expect(() => f.models.accept(replacement.sourceId)).toThrow();
      expect(f.db.prepare('SELECT count(*) AS n FROM world_player_locomotion_models').get()).toEqual({ n: 1 });
    } finally { f.close(); }
  },
);
it.each(['source', 'snapshot', 'index'] as const)('detects a moved Source ID through its remaining %s mirror', (remaining) => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId);
    const source = { ...value.source, sourceId: remaining === 'source' ? f.source.sourceId : 'moved-id' };
    const snapshot = { ...value, source: { ...value.source, sourceId: remaining === 'snapshot' ? f.source.sourceId : 'moved-id' } };
    f.db.prepare('UPDATE world_player_locomotion_models SET source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run(remaining === 'index' ? f.source.sourceId : 'moved-id', json(source), hash(source), json(snapshot), hash(snapshot));
    expect(() => f.models.read(f.source.sourceId)).toThrow();
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects a duplicate whose index and Source scope move while its complete original snapshot remains', () => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    f.db.exec(`INSERT INTO world_player_locomotion_models SELECT 'hidden-locomotion',source_version,capability,'other-career','other-player',
      person_link_source_id,fielding_model_source_id,accepted_at_day,
      json_set(source_json,'$.sourceId','hidden-locomotion','$.careerId','other-career','$.playerId','other-player'),
      source_hash,snapshot_json,snapshot_hash FROM world_player_locomotion_models`);
    expect(() => f.models.read(f.source.sourceId)).toThrow();
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(() => f.models.selectAtDay('career-a', 'player-a', 11)).toThrow();
  } finally { f.close(); }
});
it.each(['alias', 'getter', 'symbol', 'inherited', 'nonenumerable', 'array'] as const)('rejects non-inert or inexact Source %s', (kind) => {
  const f = fixture();
  try {
    let source = { ...f.source }; let called = false;
    if (kind === 'alias') source = { [Object.keys(source).sort().join('|')]: 0 } as unknown as typeof source;
    if (kind === 'getter') Object.defineProperty(source, 'sourceId', { enumerable: true, get() { called = true; return f.source.sourceId; } });
    if (kind === 'symbol') Object.assign(source, { [Symbol('hidden')]: 1 });
    if (kind === 'inherited') source = Object.assign(Object.create({ hidden: true }), source) as typeof source;
    if (kind === 'nonenumerable') Object.defineProperty(source, 'hidden', { value: true });
    if (kind === 'array') source = [] as unknown as typeof source;
    f.sources.set(f.source.sourceId, source);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(); expect(called).toBe(false);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_locomotion_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('validates even direct derivation before touching malformed Source properties', () => {
  const f = fixture();
  try {
    const own = playerLocomotionModelEvidenceFromSqlite(f.db); let called = false;
    const source = { ...f.source };
    Object.defineProperty(source, 'sourceId', { enumerable: true, get() { called = true; return f.source.sourceId; } });
    expect(() => own.derive(source)).toThrow(); expect(called).toBe(false);
    expect(() => own.derive({ ...f.source, calibration: null } as never)).toThrow();
  } finally { f.close(); }
});
it('rejects executable direct preflight snapshots without invoking their getters', () => {
  const f = fixture();
  try {
    const own = playerLocomotionModelEvidenceFromSqlite(f.db), value = own.derive(f.source);
    let called = false;
    const snapshot = { ...value };
    Object.defineProperty(snapshot, 'source', { enumerable: true, get() { called = true; return value.source; } });
    expect(() => own.before(snapshot)).toThrow(); expect(called).toBe(false);
  } finally { f.close(); }
});

it.each(['sourceId', 'sourceVersion', 'capability', 'careerId', 'playerId', 'personLinkSourceId', 'fieldingModelSourceId', 'acceptedAtDay', 'calibration'])(
  'requires the explicit Source field %s', (key) => {
    const f = fixture();
    try {
      const source = { ...f.source } as Record<string, unknown>; delete source[key];
      f.sources.set(f.source.sourceId, source as never);
      expect(() => f.models.accept(f.source.sourceId)).toThrow();
      expect(f.db.prepare('SELECT count(*) AS n FROM world_player_locomotion_models').get()).toEqual({ n: 0 });
    } finally { f.close(); }
  },
);
it('uses its own database fielding original and cannot borrow a peer snapshot with matching IDs', () => {
  const local = fixture(), peer = fixture();
  try {
    const peerSource = { ...peer.fieldingModel.source, ratings: { ...peer.fieldingModel.source.ratings, acceleration: 1, routeEfficiency: 0 } };
    const peerFielding = { ...peer.fieldingModel, source: peerSource };
    peer.db.prepare('UPDATE world_player_fielding_models SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run(json(peerSource), hash(peerSource), json(peerFielding), hash(peerFielding));
    const peerValue = peer.models.accept(peer.source.sourceId);
    const own = playerLocomotionModelEvidenceFromSqlite(local.db);
    expect(() => own.before(peerValue)).toThrow(/original changed/);
    expect(() => own.derive({ ...local.source, fieldingModel: peerValue.fieldingModel } as never)).toThrow();
    const localValue = local.models.accept(local.source.sourceId);
    expect(localValue.fieldingModel.source.ratings.acceleration).toBe(0.25);
    expect(peerValue.fieldingModel.source.ratings.acceleration).toBe(1);
    expect(localValue.fieldingModel).toEqual(local.fieldingModel);
  } finally { local.close(); peer.close(); }
});
it('rejects malformed direct derivation and preflight Sources before any SQL', () => {
  const f = fixture();
  try {
    let queries = 0;
    const own = playerLocomotionModelEvidenceFromSqlite({ prepare: (...args: Parameters<typeof f.db.prepare>) => { queries++; return f.db.prepare(...args); } });
    for (const source of [null, [], { ...f.source, capability: 'relative_reach_v1' }, { ...f.source, acceptedAtDay: -1 },
      { ...f.source, calibration: { ...f.source.calibration, ticksPerSecond: 1000 } }]) {
      expect(() => own.derive(source as never)).toThrow();
      expect(() => own.before({ source, fieldingModel: f.fieldingModel } as never)).toThrow();
    }
    expect(queries).toBe(0);
  } finally { f.close(); }
});
it.each(['source', 'fieldingModel', 'calibration', 'ratings', 'person'] as const)('rejects a getter in direct preflight %s without executing it or SQL', (kind) => {
  const f = fixture();
  try {
    const value = structuredClone(playerLocomotionModelEvidenceFromSqlite(f.db).derive(f.source));
    let called = false, queries = 0;
    const own = playerLocomotionModelEvidenceFromSqlite({ prepare: (...args: Parameters<typeof f.db.prepare>) => { queries++; return f.db.prepare(...args); } });
    const target = kind === 'source' || kind === 'fieldingModel' ? value : kind === 'calibration' ? value.source
      : kind === 'ratings' ? value.fieldingModel.source : value.fieldingModel;
    Object.defineProperty(target, kind, { enumerable: true, get() { called = true; return null; } });
    expect(() => own.before(value)).toThrow(); expect(called).toBe(false); expect(queries).toBe(0);
  } finally { f.close(); }
});
it.each(['source_json', 'snapshot_json'] as const)('rejects malformed owned %s instead of treating it as a missing baseline', (column) => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    f.db.exec(`UPDATE world_player_locomotion_models SET ${column}='{'`);
    expect(() => f.models.read(f.source.sourceId)).toThrow();
    expect(() => f.models.selectAtDay('career-a', 'player-a', 11)).toThrow();
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    const replacement = { ...f.source, sourceId: 'replacement' }; f.sources.set(replacement.sourceId, replacement);
    expect(() => f.models.accept(replacement.sourceId)).toThrow();
  } finally { f.close(); }
});
