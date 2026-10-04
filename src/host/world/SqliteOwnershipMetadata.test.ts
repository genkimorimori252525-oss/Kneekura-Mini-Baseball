import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const databases: InstanceType<typeof DatabaseSync>[] = [];
const database = () => { const db = new DatabaseSync(':memory:'); databases.push(db); return db; };
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const fields = (raw: string, keys: readonly string[], path = '$'): string =>
  (database().prepare(`SELECT ${projection(literal(raw), keys, path)} AS metadata`).get() as { metadata: string }).metadata;
afterEach(() => databases.splice(0).forEach(db => db.close()));

it('enumerates all duplicate containers and decoded scalar keys instead of choosing a first or last value', () => {
  const raw = '{"source":{"sourceId":"first","source\\u0049d":"second"},"sour\\u0063e":{"sourceId":"third"}}';
  const db = database();
  expect(db.prepare(nodes(literal(raw), ['source', 'sourceId'])).all()).toEqual([
    { value: 'first', type: 'text', atom: 'first' }, { value: 'second', type: 'text', atom: 'second' },
    { value: 'third', type: 'text', atom: 'third' },
  ]);
  expect(db.prepare(nodes(literal(raw), ['source'])).all()).toHaveLength(2);
});

it('enumerates every history array for scope but only each last entry for own Source-ID discovery', () => {
  const raw = '{"history":[{"sourceId":"ancestor"},{"sourceId":"own-a"}],"history":[{"sourceId":"own-b"}]}';
  const db = database();
  expect(db.prepare(nodes(literal(raw), ['history', { array: 'all' }, 'sourceId'])).all().map(row => row.atom))
    .toEqual(['ancestor', 'own-a', 'own-b']);
  expect(db.prepare(nodes(literal(raw), ['history', { array: 'last' }, 'sourceId'])).all().map(row => row.atom))
    .toEqual(['own-a', 'own-b']);
});

it.each(['invalid JSON', 'null', '7', '"opaque"', '{"source":"{\\"sourceId\\":\\"ghost\\"}"}',
  '{"source":null}', '{"source":[]}', '{"source":true}'])(
  'does not reinterpret a non-object or malformed parent as ownership: %s', raw => {
    expect(database().prepare(nodes(literal(raw), ['source', 'sourceId'])).all()).toEqual([]);
  });

it.each(['{"history":{}}', '{"history":"[]"}', '{"history":null}', '{"history":[]}', '{"history":[null,3,"opaque"]}'])(
  'does not invent identities under absent or non-object history entries: %s', raw => {
    expect(database().prepare(nodes(literal(raw), ['history', { array: 'all' }, 'sourceId'])).all()).toEqual([]);
    expect(database().prepare(nodes(literal(raw), ['history', { array: 'last' }, 'sourceId'])).all()).toEqual([]);
  });

it('discovers later duplicate scope claims outside indexed ownership using a correlated query', () => {
  const db = database(); db.exec('CREATE TABLE evidence (source_id TEXT, snapshot_json TEXT)');
  db.prepare('INSERT INTO evidence VALUES (?,?)').run('foreign-index',
    '{"receipt":{"self":{"playerId":"foreign","playerId":"original"}},"receipt":{"self":{"playerId":"third"}}}');
  expect(db.prepare(`SELECT source_id FROM evidence WHERE EXISTS (SELECT 1 FROM
    (${nodes('snapshot_json', ['receipt', 'self', 'playerId'])}) claim WHERE claim.type='text' AND claim.atom=?)`).all('original'))
    .toEqual([{ source_id: 'foreign-index' }]);
});

it('keeps root object nodes available without consuming their domain payload', () => {
  const raw = '{"sourceId":"owned","view":{"opaque":"payload"}}';
  expect(database().prepare(nodes(literal(raw))).all()).toEqual([{ value: raw, type: 'object', atom: null }]);
});

it('requires exactly one occurrence of every configured typed metadata key', () => {
  expect(matches(fields('{"sourceId":"owned","previous":null}', ['sourceId', 'previous']), { sourceId: 'owned', previous: null })).toBe(true);
  expect(matches(fields('{"sourceId":"owned"}', ['sourceId', 'previous']), { sourceId: 'owned', previous: null })).toBe(false);
  expect(matches(fields('{"sourceId":"owned","sourceId":"owned"}', ['sourceId']), { sourceId: 'owned' })).toBe(false);
  expect(matches(fields('{"sourceId":"owned","source\\u0049d":"other"}', ['sourceId']), { sourceId: 'owned' })).toBe(false);
  expect(matches(fields('{"sourceId":1}', ['sourceId']), { sourceId: '1' })).toBe(false);
  expect(matches(fields('{"revision":1.0}', ['revision']), { revision: 1 })).toBe(false);
  expect(matches(null, { sourceId: 'owned' })).toBe(false);
});

it('supports exact scalar number/boolean/null metadata without admitting structured values', () => {
  const raw = '{"revision":2,"offset":1.5,"active":true,"closed":false,"previous":null}';
  expect(matches(fields(raw, ['revision', 'offset', 'active', 'closed', 'previous']),
    { previous: null, revision: 2, offset: 1.5, active: true, closed: false })).toBe(true);
  for (const raw of ['{"sourceId":{"privatePayload":"do-not-project"}}', '{"sourceId":["do-not-project"]}']) {
    const projected = fields(raw, ['sourceId']);
    expect(projected).not.toContain('do-not-project');
    expect(matches(projected, { sourceId: 'owned' })).toBe(false);
  }
});

it('leaves unrelated view/receipt keys opaque, including duplicate keys and malformed domain shapes', () => {
  const raw = '{"sourceId":"owned","view":null,"view":{"x":1,"x":2},"receipt":"opaque","receipt":[]}';
  expect(matches(fields(raw, ['sourceId']), { sourceId: 'owned' })).toBe(true);
  expect(matches(fields('{"source":{"sourceId":"owned","view":null,"view":[]}}', ['sourceId'], '$.source'), { sourceId: 'owned' })).toBe(true);
});

it('handles quoted keys as data in configured paths and projection lists', () => {
  const raw = '{"a\'b":{"x\'y":"owned"}}';
  expect(database().prepare(nodes(literal(raw), ["a'b", "x'y"])).all()).toEqual([{ value: 'owned', type: 'text', atom: 'owned' }]);
  expect(matches(fields('{"x\'y":"owned"}', ["x'y"]), { "x'y": 'owned' })).toBe(true);
});
