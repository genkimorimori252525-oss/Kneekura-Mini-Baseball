import { expect, it } from 'vitest';
import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
import { playerObservationModelFixture } from './PlayerObservationModelFixtures.test-support';
import { playerDecisionModelFixture } from './PlayerDecisionModelFixtures.test-support';
import { openSqlitePlayerFieldingModelStore } from './SqlitePlayerFieldingModelStore';
import { openSqlitePlayerObservationModelStore } from './SqlitePlayerObservationModelStore';
import { openSqlitePlayerDecisionModelStore } from './SqlitePlayerDecisionModelStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const fixtures = { fielding: playerFieldingModelFixture, observation: playerObservationModelFixture, decision: playerDecisionModelFixture };
const open = { fielding: openSqlitePlayerFieldingModelStore, observation: openSqlitePlayerObservationModelStore, decision: openSqlitePlayerDecisionModelStore };
type Kind = keyof typeof fixtures;
type Fixture = ReturnType<(typeof fixtures)[Kind]>;
type ObjectJson = Record<string, unknown>;
const kinds = Object.keys(fixtures) as Kind[];
const foreign = { careerId: 'moved-career', playerId: 'moved-player' };
const at = (value: ObjectJson, path: readonly string[]): ObjectJson => path.reduce((node, key) => node[key] as ObjectJson, value);
const rawAt = (value: ObjectJson, path: readonly string[], change: (node: ObjectJson) => string): string => path.length === 0
  ? change(value) : `{${Object.keys(value).sort().map((key) => `${json(key)}:${key === path[0]
    ? rawAt(value[key] as ObjectJson, path.slice(1), change) : json(value[key])}`).join(',')}}`;
const append = (value: ObjectJson, members: ObjectJson): string => `${json(value).slice(0, -1)},${json(members).slice(1)}`;
const move = (value: unknown, sourceId: string): unknown => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'careerId' ? foreign.careerId
    : key === 'playerId' ? foreign.playerId : key === 'sourceId' && item === sourceId ? 'moved-id' : move(item, sourceId)])) : value;
const archive = (f: Fixture, kind: Kind) => f.db.prepare(`SELECT * FROM world_player_${kind}_models ORDER BY source_id`).all();
const saveMoved = (f: Fixture, kind: Kind, source: string, snapshot: string) => {
  f.db.prepare(`UPDATE world_player_${kind}_models SET source_id='moved-id',career_id=?,player_id=?,
    source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`).run(foreign.careerId, foreign.playerId,
    source, hash(JSON.parse(source)), snapshot, hash(JSON.parse(snapshot)));
};
const playerCases = kinds.flatMap((kind) => [
  { kind, document: 'source' as const, path: [] as string[] },
  ...[ ['source'], ...(kind === 'fielding' ? [['person']] : [['fieldingModel', 'source'], ['fieldingModel', 'person']]) ]
    .map((path) => ({ kind, document: 'snapshot' as const, path })),
]);

// The discovery query must not select only SQLite's first occurrence. These raw
// archives intentionally retain all duplicate bytes and rehash JSON.parse's value.
it.each(playerCases)('rejects a replacement $kind baseline hidden behind duplicate $document $path owner keys', ({ kind, document, path }) => {
  const f = fixtures[kind]();
  try {
    const value = f.models.accept(f.source.sourceId);
    const source = move(f.source, f.source.sourceId) as ObjectJson, snapshot = move(value, f.source.sourceId) as ObjectJson;
    const ambiguous = rawAt(document === 'source' ? source : snapshot, path,
      (node) => append(node, { careerId: f.source.careerId, playerId: f.source.playerId }));
    saveMoved(f, kind, document === 'source' ? ambiguous : json(source), document === 'snapshot' ? ambiguous : json(snapshot));
    const before = archive(f, kind), replacement = { ...f.source, sourceId: `${kind}-replacement` };
    (f.sources as Map<string, typeof replacement>).set(replacement.sourceId, replacement);
    expect.soft(() => f.models.selectAtDay(f.source.careerId, f.source.playerId, f.source.acceptedAtDay)).toThrow(/scope|archive/);
    expect.soft(() => f.models.accept(replacement.sourceId)).toThrow();
    expect(archive(f, kind)).toEqual(before);
  } finally { f.close(); }
});

const containerCases = kinds.flatMap((kind) => (kind === 'fielding' ? [['source'], ['person']]
  : [['source'], ['fieldingModel'], ['fieldingModel', 'source'], ['fieldingModel', 'person']])
  .map((path) => ({ kind, path })));
it.each(containerCases)('discovers a $kind Player claim inside a later duplicate $path container', ({ kind, path }) => {
  const f = fixtures[kind]();
  try {
    const value = f.models.accept(f.source.sourceId) as unknown as ObjectJson;
    const source = move(f.source, f.source.sourceId) as ObjectJson, snapshot = move(value, f.source.sourceId) as ObjectJson;
    const key = path[path.length - 1], original = at(value, path);
    const ambiguous = rawAt(snapshot, path.slice(0, -1), (node) => append(node, { [key]: original }));
    saveMoved(f, kind, json(source), ambiguous);
    const before = archive(f, kind), replacement = { ...f.source, sourceId: `${kind}-replacement` };
    (f.sources as Map<string, typeof replacement>).set(replacement.sourceId, replacement);
    expect.soft(() => f.models.selectAtDay(f.source.careerId, f.source.playerId, f.source.acceptedAtDay)).toThrow(/scope|archive/);
    expect.soft(() => f.models.accept(replacement.sourceId)).toThrow();
    expect(archive(f, kind)).toEqual(before);
  } finally { f.close(); }
});

it.each(kinds.flatMap((kind) => ['source', 'snapshot', 'source-container'].map((proof) => ({ kind, proof }))))(
  'rejects read and retry of a $kind Source ID hidden behind a duplicate $proof member', ({ kind, proof }) => {
    const f = fixtures[kind]();
    try {
      const value = f.models.accept(f.source.sourceId);
      const source = move(f.source, f.source.sourceId) as ObjectJson, snapshot = move(value, f.source.sourceId) as ObjectJson;
      const ambiguousSource = append(source, { sourceId: f.source.sourceId });
      const ambiguousSnapshot = proof === 'source-container'
        ? append(snapshot, { source: { ...snapshot.source as ObjectJson, sourceId: f.source.sourceId } })
        : rawAt(snapshot, ['source'], (node) => append(node, { sourceId: f.source.sourceId }));
      saveMoved(f, kind, proof === 'source' ? ambiguousSource : json(source), proof === 'source' ? json(snapshot) : ambiguousSnapshot);
      const before = archive(f, kind);
      expect.soft(() => f.models.read(f.source.sourceId)).toThrow();
      expect.soft(() => f.models.accept(f.source.sourceId)).toThrow();
      expect(archive(f, kind)).toEqual(before);
    } finally { f.close(); }
  },
);

it.each(kinds)('preserves healthy %s archive bytes across authority-free reopen and all public read paths', (kind) => {
  const f = fixtures[kind]();
  try {
    const value = f.models.accept(f.source.sourceId), before = archive(f, kind);
    f.models.close();
    const reopened = f.track(open[kind](f.path));
    expect(reopened.read(f.source.sourceId)).toEqual(value);
    expect(reopened.accept(f.source.sourceId)).toEqual(value);
    expect(reopened.selectAtDay(f.source.careerId, f.source.playerId, f.source.acceptedAtDay)).toEqual(value);
    expect(archive(f, kind)).toEqual(before);
  } finally { f.close(); }
});

it.each(kinds)('discovers a %s Source ID claimed only by the middle of three duplicate leaves', (kind) => {
  const f = fixtures[kind]();
  try {
    const value = f.models.accept(f.source.sourceId), source = move(f.source, f.source.sourceId) as ObjectJson;
    const ambiguous = `${append(source, { sourceId: f.source.sourceId }).slice(0, -1)},"sourceId":"moved-id"}`;
    saveMoved(f, kind, ambiguous, json(move(value, f.source.sourceId)));
    const before = archive(f, kind);
    expect(() => f.models.read(f.source.sourceId)).toThrow();
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(archive(f, kind)).toEqual(before);
  } finally { f.close(); }
});

const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;
const copyRowSql = (kind: Kind, source: string, snapshot: string): string => `INSERT INTO world_player_${kind}_models
  SELECT 'moved-id',${kind === 'fielding' ? '' : 'source_version,'}'moved-career','moved-player',person_link_source_id,
    ${kind === 'fielding' ? '' : 'fielding_model_source_id,'}accepted_at_day,
    ${sql(source)},${sql(hash(JSON.parse(source)))},${sql(snapshot)},${sql(hash(JSON.parse(snapshot)))}
  FROM world_player_${kind}_models WHERE source_id!='moved-id'`;

it.each(kinds)('rolls back a post-insert %s claimant hidden in a duplicate Person container', (kind) => {
  const f = fixtures[kind](), table = `world_player_${kind}_models`;
  try {
    const value = f.models.accept(f.source.sourceId) as unknown as ObjectJson;
    f.db.exec(`DELETE FROM ${table}`);
    const source = move(f.source, f.source.sourceId) as ObjectJson, snapshot = move(value, f.source.sourceId) as ObjectJson;
    const path = kind === 'fielding' ? [] : ['fieldingModel'];
    const ambiguous = rawAt(snapshot, path, (node) => append(node, { person: at(value, [...path, 'person']) }));
    const people = f.db.prepare('SELECT * FROM world_player_person_links').all();
    const fielding = f.db.prepare('SELECT * FROM world_player_fielding_models').all();
    f.db.exec(`CREATE TRIGGER hide_duplicate AFTER INSERT ON ${table} BEGIN ${copyRowSql(kind, json(source), ambiguous)}; END`);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/scope/);
    expect(archive(f, kind)).toEqual([]);
    expect(f.db.prepare('SELECT * FROM world_player_person_links').all()).toEqual(people);
    expect(f.db.prepare('SELECT * FROM world_player_fielding_models').all()).toEqual(fielding);
    f.db.exec('DROP TRIGGER hide_duplicate');
    expect(f.models.accept(f.source.sourceId)).toEqual(value);
  } finally { f.close(); }
});

it.each(kinds)('does not combine %s ownership across separate duplicate Source containers', (kind) => {
  const f = fixtures[kind]();
  try {
    const value = f.models.accept(f.source.sourceId), source = move(f.source, f.source.sourceId) as ObjectJson;
    const snapshot = move(value, f.source.sourceId) as ObjectJson;
    snapshot.source = { ...snapshot.source as ObjectJson, careerId: f.source.careerId };
    const ambiguous = append(snapshot, { source: { ...source, playerId: f.source.playerId } });
    f.db.exec(copyRowSql(kind, json(source), ambiguous));
    const before = archive(f, kind);
    expect(f.models.read(f.source.sourceId)).toEqual(value);
    expect(f.models.accept(f.source.sourceId)).toEqual(value);
    expect(f.models.selectAtDay(f.source.careerId, f.source.playerId, f.source.acceptedAtDay)).toEqual(value);
    expect(archive(f, kind)).toEqual(before);
  } finally { f.close(); }
});
