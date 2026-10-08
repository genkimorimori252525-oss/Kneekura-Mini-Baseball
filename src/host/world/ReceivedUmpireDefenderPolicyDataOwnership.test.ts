import { expect, test } from 'vitest';
import { policyFixture } from './ReceivedUmpireDefenderPolicyDataFixtures.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const table = 'world_received_umpire_defender_policy_data';
type RecordJson = Record<string, unknown>;
const move = (value: unknown): unknown => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'careerId' ? 'moved-career'
    : key === 'playerId' ? 'moved-player' : key === 'sourceId' && item === 'policy-a' ? 'moved-policy' : move(item)])) : value;
const rawAt = (value: RecordJson, path: readonly string[], replace: (node: RecordJson) => string): string => !path.length ? replace(value)
  : `{${Object.keys(value).sort().map(key => `${json(key)}:${key === path[0]
    ? rawAt(value[key] as RecordJson, path.slice(1), replace) : json(value[key])}`).join(',')}}`;
const append = (node: RecordJson, members: RecordJson) => json(node).slice(0, -1) + ',' + json(members).slice(1);
const escaped = (raw: string) => raw.replaceAll('"careerId"', '"career\\u0049d"').replaceAll('"playerId"', '"player\\u0049d"')
  .replaceAll('"sourceId"', '"source\\u0049d"').replaceAll('"fieldingModel"', '"fielding\\u004dodel"');

test('RP-O01 every original Player scope mirror rejects a hidden replacement baseline', async () => {
  for (const path of [[], ['source'], ['fieldingModel', 'source'], ['fieldingModel', 'person']]) {
    for (const mode of ['plain', 'duplicate', 'escaped-duplicate']) {
      const f = await policyFixture();
      try {
        const value = f.store.accept('policy-a');
        let source = json(move(value.source)), snapshot = json(move(value));
        const replace = (node: RecordJson) => mode === 'plain'
          ? json({ ...node, careerId: 'career-a', playerId: 'player-a' }) : append(node, { careerId: 'career-a', playerId: 'player-a' });
        if (!path.length) source = rawAt(move(value.source) as RecordJson, [], replace);
        else snapshot = rawAt(move(value) as RecordJson, path, replace);
        if (mode === 'escaped-duplicate') { source = escaped(source); snapshot = escaped(snapshot); }
        f.db.prepare(`UPDATE ${table} SET source_id='moved-policy',career_id='moved-career',player_id='moved-player',
          source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`).run(source, hash(JSON.parse(source)), snapshot, hash(JSON.parse(snapshot)));
        const before = f.rows(); f.sources.set('policy-b', { ...f.source, sourceId: 'policy-b' });
        expect(() => f.store.accept('policy-b'), path + ':' + mode).toThrow(); expect(f.rows()).toEqual(before);
      } finally { f.close(); }
    }
  }
});

test('RP-O02 decoded duplicate Source IDs and duplicate containers cannot hide historical ownership', async () => {
  for (const mode of ['source', 'snapshot', 'container', 'index']) {
    for (const encode of [false, true]) {
      const f = await policyFixture();
      try {
        const value = f.store.accept('policy-a');
        let source = json(move(value.source)), snapshot = json(move(value));
        if (mode === 'source') source = append(move(value.source) as RecordJson, { sourceId: 'policy-a' });
        if (mode === 'snapshot') snapshot = rawAt(move(value) as RecordJson, ['source'], node => append(node, { sourceId: 'policy-a' }));
        if (mode === 'container') snapshot = append(move(value) as RecordJson, { source: value.source });
        if (encode) { source = escaped(source); snapshot = escaped(snapshot); }
        f.db.prepare(`UPDATE ${table} SET source_id=?,career_id='moved-career',player_id='moved-player',source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`)
          .run(mode === 'index' ? 'policy-a' : 'moved-policy', source, hash(JSON.parse(source)), snapshot, hash(JSON.parse(snapshot)));
        const before = f.rows(); expect(() => f.store.read('policy-a')).toThrow(); expect(() => f.store.accept('policy-a')).toThrow();
        expect(f.rows()).toEqual(before);
      } finally { f.close(); }
    }
  }
});

test('RP-O03 later duplicate nested owner containers still reserve the original Player baseline', async () => {
  for (const path of [['source'], ['fieldingModel'], ['fieldingModel', 'source'], ['fieldingModel', 'person']]) {
    const f = await policyFixture();
    try {
      const value = f.store.accept('policy-a') as RecordJson, original = path.reduce((node, key) => node[key] as RecordJson, value);
      const snapshot = escaped(rawAt(move(value) as RecordJson, path.slice(0, -1), node => append(node, { [path.at(-1)!]: original })));
      const source = json(move(value.source));
      f.db.prepare(`UPDATE ${table} SET source_id='moved-policy',career_id='moved-career',player_id='moved-player',source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`)
        .run(source, hash(JSON.parse(source)), snapshot, hash(JSON.parse(snapshot)));
      const before = f.rows(); f.sources.set('policy-b', { ...f.source, sourceId: 'policy-b' });
      expect(() => f.store.accept('policy-b')).toThrow(); expect(f.rows()).toEqual(before);
    } finally { f.close(); }
  }
});

test('RP-O04 raw duplicates malformed archives and hidden duplicate rows fail before acceptance or replay', async () => {
  for (const mode of ['duplicate-row', 'malformed-source', 'duplicate-profile', 'duplicate-profile-container', 'wrong-snapshot']) {
    const f = await policyFixture();
    try {
      const value = f.store.accept('policy-a');
      if (mode === 'duplicate-row') f.db.exec(`INSERT INTO ${table} SELECT 'hidden',source_version,'other-career','other-player',
        person_link_source_id,fielding_model_source_id,accepted_at_day,source_json,source_hash,snapshot_json,snapshot_hash FROM ${table}`);
      else if (mode === 'malformed-source') f.db.exec(`UPDATE ${table} SET source_json='invalid-json'`);
      else if (mode === 'wrong-snapshot') f.db.exec(`UPDATE ${table} SET snapshot_json='[]'`);
      else {
        const source = mode === 'duplicate-profile' ? rawAt(value.source as RecordJson, ['profiles', 'out'], node => append(node, { holdPriority: 0.9 }))
          : rawAt(value.source as RecordJson, ['profiles'], node => append(node, { out: value.source.profiles.out }));
        f.db.prepare(`UPDATE ${table} SET source_json=?,source_hash=?`).run(source, hash(JSON.parse(source)));
      }
      const before = f.rows(); expect(() => f.store.read('policy-a')).toThrow(); expect(() => f.store.accept('policy-a')).toThrow();
      expect(f.rows()).toEqual(before);
    } finally { f.close(); }
  }
});
