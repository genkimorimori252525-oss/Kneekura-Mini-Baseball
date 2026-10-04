import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
// Stable original-scope proof isolates only the real runtime owner's retry protocol.
vi.mock('./ActualLivePlayEvidenceFromSqlite', () => ({ actualLivePlayEvidenceFromSqlite: () => ({ derive: () => ({ scope: {
  unsupportedParticipantIds: [], gameId: 'game', playId: 7, originalPitchHash: 'proof', scopeId: 'scope', participants: [], producers: [],
} }) }) }));
import { openSqliteActualLivePlayRuntimeStore } from './SqliteActualLivePlayRuntimeStore';
it.each(['actual_field_observations','actual_first_base_umpire_setups'])('does not register causal ownership retroactively over raw original-pitch work hidden in %s cached metadata', table => {
  const path = join(mkdtempSync(join(tmpdir(), 'review-runtime-preexisting-work-')), 'state.sqlite');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const source = { sourceId: 'runtime', sourceVersion: 'v1', capability: 'causal_original_live_play_runtime_v1' as const, physicalPitchSourceId: 'pitch' };
  const store = openSqliteActualLivePlayRuntimeStore(path, { readAcceptedRuntime: () => source });
  const db = new DatabaseSync(path);
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  try {
    db.exec(`CREATE TABLE ${table}(source_id TEXT, physical_pitch_source_id TEXT, source_json TEXT, snapshot_json TEXT)`);
    const prior = { sourceId: 'already-governed', physicalPitchSourceId: 'pitch' };
    db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?)`).run(prior.sourceId, 'foreign-pitch', JSON.stringify(prior), JSON.stringify({source:prior}));
    expect(() => store.accept(source.sourceId)).toThrow(/governed|ownership|metadata|scope/);
  } finally { store.close(); db.close(); }
});

const governed = ['batted_post_response_flights', 'batted_world_continuations', 'batted_world_acquisitions', 'batted_world_motions',
  'batted_world_executions', 'batted_world_field_actions', 'batted_world_field_executions', 'actual_field_observations',
  'actual_defensive_plans', 'actual_defensive_decisions', 'actual_locomotion_receipts', 'actual_live_rule_consumptions',
  'actual_first_base_umpire_setups', 'actual_first_base_umpire_observations', 'actual_first_base_umpire_calls', 'actual_call_communications'];
const registrationFixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'runtime-registration-census-')), 'state.sqlite');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const source = { sourceId: 'runtime', sourceVersion: 'v1', capability: 'causal_original_live_play_runtime_v1' as const, physicalPitchSourceId: 'pitch' };
  const store = openSqliteActualLivePlayRuntimeStore(path, { readAcceptedRuntime: () => source }), db = new DatabaseSync(path);
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
  const table = (name: string, cachedPitch = true) => db.exec(`CREATE TABLE ${name}(source_id TEXT,${cachedPitch ? 'physical_pitch_source_id TEXT,' : ''}source_json TEXT,snapshot_json TEXT)`);
  const insert = (name: string, source: object, snapshot = { source }, pitch = 'pitch') => db.prepare(`INSERT INTO ${name} VALUES(?,?,?,?)`).run((source as { sourceId: string }).sourceId, pitch, JSON.stringify(source), JSON.stringify(snapshot));
  const roots = () => {
    const entries = [
      ['batted_ball_flights', { sourceId: 'flight', physicalPitchSourceId: 'pitch', searchDurationTicks: 0 }],
      ['batted_world_contacts', { sourceId: 'contact', flightSourceId: 'flight' }],
      ['batted_first_fielder_touches', { sourceId: 'touch', worldContactSourceId: 'contact' }],
      ['batted_contact_responses', { sourceId: 'response', firstFielderTouchSourceId: 'touch' }],
      ['actual_communication_models', { sourceId: 'model', physicalPitchSourceId: 'pitch' }],
    ] as const;
    for (const [name, value] of entries) { table(name); insert(name, value); }
  };
  return { db, source, store, table, insert, roots, close() {
    const rows = db.prepare('SELECT * FROM actual_live_play_runtimes').all();
    store.close(); db.close();
    const reopened = new DatabaseSync(path, { readOnly: true });
    try {
      expect(reopened.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
      expect(reopened.prepare('SELECT * FROM actual_live_play_runtimes').all()).toEqual(rows);
    } finally { reopened.close(); }
  } };
};
it.each(governed)('rejects duplicate/escaped raw pitch claims in governed %s both before and after registration INSERT', table => {
  for (const post of [false, true]) {
    const x = registrationFixture();
    try {
      x.table(table, false);
      const source = '{"sourceId":"work","physicalPitchSourceId":"foreign","physical\\u0050itchSourceId":"pitch"}';
      const snapshot = '{"source":{"physicalPitchSourceId":"foreign"},"source":{"physicalPitchSourceId":"pitch"}}';
      if (post) x.db.exec(`CREATE TRIGGER late_work AFTER INSERT ON actual_live_play_runtimes BEGIN
        INSERT INTO ${table} VALUES('work','${source}','${snapshot}'); END;`);
      else x.db.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run('work', source, snapshot);
      const witness = post ? witnessSqliteWrite('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?,?,?,?)', db =>
        db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n === 1) : null;
      try {
        expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed|ownership/);
        if (witness) expect(witness.wasReached()).toBe(true);
      } finally { witness?.close(); }
      expect(x.db.prepare('SELECT * FROM actual_live_play_runtimes').all()).toEqual([]);
      if (post) expect(x.db.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
    } finally { x.close(); }
  }
});
it.each([
  { history: { physicalPitchSourceId: 'pitch' } },
  { history: [{ physicalPitchSourceId: 'foreign' }, { physicalPitchSourceId: 'pitch' }] },
  { receipt: { self: { physicalPitchSourceId: 'pitch' } } },
  { receipt: { self: { cut: { physicalPitchSourceId: 'pitch' } } } },
  { baseField: { physicalPitchSourceId: 'pitch' } },
  { baseField: { response: { touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'pitch' } } } } } } },
  { baseMotion: { response: { touch: { worldContact: { flight: { physicalPitch: { frame: { gameId: 'game', match: { playId: 7 } } } } } } } } },
  { observation: { setup: { physicalPitchSourceId: 'pitch' } } },
])('rejects scoped snapshot metadata without parsing its future payload: %j', mirror => {
  const x = registrationFixture();
  try {
    x.table('actual_field_observations');
    x.insert('actual_field_observations', { sourceId: 'work' }, { source: { sourceId: 'work' }, ...mirror, futurePayload: 'opaque invalid domain' } as never, 'foreign');
    expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed/);
  } finally { x.close(); }
});
it.each([
  ['batted_post_response_flights', 'contactResponseSourceId', 'response'],
  ['batted_world_continuations', 'responseSourceId', 'response'],
  ['batted_world_acquisitions', 'responseSourceId', 'response'],
  ['batted_world_motions', 'responseSourceId', 'response'],
  ['batted_world_field_actions', 'responseSourceId', 'response'],
  ['actual_call_communications', 'modelSourceId', 'model'],
])('rejects dependency-only governed ownership in %s with foreign cached pitch', (table, key, value) => {
  const x = registrationFixture();
  try {
    x.roots(); x.table(table);
    x.insert(table, { sourceId: 'work', [key]: value }, undefined, 'foreign');
    expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed/);
  } finally { x.close(); }
});
it('permits legitimate zero-horizon input/config roots and unrelated opaque governed work', () => {
  const x = registrationFixture();
  try {
    x.roots(); x.table('actual_field_observations');
    x.db.prepare('INSERT INTO actual_field_observations VALUES(?,?,?,?)').run('foreign', 'foreign-pitch', '{"sourceId":"foreign","physicalPitchSourceId":"foreign-pitch"}', '{malformed future payload');
    expect(x.store.accept(x.source.sourceId).source).toEqual(x.source);
  } finally { x.close(); }
});
it.each([1, 1000])('rejects already advanced flight root with search horizon %s', duration => {
  const x = registrationFixture();
  try {
    x.table('batted_ball_flights'); x.insert('batted_ball_flights', { sourceId: 'flight', physicalPitchSourceId: 'pitch', searchDurationTicks: duration });
    expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed|ownership/);
  } finally { x.close(); }
});
it.each(['batted_world_field_execution_heads', 'actual_field_observation_heads', 'actual_defensive_decision_heads', 'actual_locomotion_heads'])('rejects head-only original scope in %s', head => {
  const x = registrationFixture();
  try {
    x.db.exec(`CREATE TABLE ${head}(physical_pitch_source_id TEXT,source_id TEXT); INSERT INTO ${head} VALUES('pitch','missing-work');`);
    expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed/);
  } finally { x.close(); }
});
it('rejects a root head that masks a foreign-indexed root row or has no corresponding row', () => {
  for (const missing of [false, true]) {
    const x = registrationFixture();
    try {
      x.table('batted_ball_flights');
      x.db.exec("CREATE TABLE batted_ball_flight_heads(physical_pitch_source_id TEXT,source_id TEXT); INSERT INTO batted_ball_flight_heads VALUES('pitch','flight');");
      if (!missing) x.insert('batted_ball_flights', { sourceId: 'flight', physicalPitchSourceId: 'foreign', searchDurationTicks: 0 }, undefined, 'foreign');
      expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed|ownership/);
    } finally { x.close(); }
  }
});
it('discovers crossed root predecessors even when all cached/direct pitch fields on that row are foreign', () => {
  const x = registrationFixture();
  try {
    x.table('batted_ball_flights');
    x.insert('batted_ball_flights', { sourceId: 'initial', physicalPitchSourceId: 'pitch', searchDurationTicks: 0, previousFlightSourceId: null });
    x.insert('batted_ball_flights', { sourceId: 'crossed', physicalPitchSourceId: 'foreign', searchDurationTicks: 0, previousFlightSourceId: 'initial' }, undefined, 'foreign');
    expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed|ownership/);
  } finally { x.close(); }
});
it('recognizes embedded original response identity even after direct pitch metadata and Source links move', () => {
  const x = registrationFixture();
  try {
    x.roots(); x.table('batted_world_field_actions');
    x.insert('batted_world_field_actions', { sourceId: 'field', responseSourceId: 'foreign' },
      { source: { sourceId: 'field', responseSourceId: 'foreign' }, response: { source: { sourceId: 'response' } } } as never, 'foreign');
    expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed/);
  } finally { x.close(); }
});
it.each(['head', 'embedded_source', 'embedded_frame'] as const)('rejects %s root ownership hidden before or during runtime INSERT', kind => {
  for (const post of [false, true]) {
    const x = registrationFixture();
    try {
      x.table('batted_ball_flights');
      x.db.exec('CREATE TABLE batted_ball_flight_heads(physical_pitch_source_id TEXT,source_id TEXT)');
      const source = { sourceId: 'flight', physicalPitchSourceId: kind === 'head' ? 'pitch' : 'foreign-pitch', searchDurationTicks: 0 };
      const snapshot = { source, ...(kind === 'embedded_source' ? { physicalPitch: { source: { sourceId: 'pitch' } } }
        : kind === 'embedded_frame' ? { physicalPitch: { frame: { gameId: 'game', match: { playId: 7 } } } } : {}) };
      const insert = kind === 'head' ? "INSERT INTO batted_ball_flight_heads VALUES('foreign-pitch','flight');"
        : `INSERT INTO batted_ball_flights VALUES('flight','foreign-pitch','${JSON.stringify(source)}','${JSON.stringify(snapshot)}');`;
      if (kind === 'head') x.insert('batted_ball_flights', source);
      if (post) x.db.exec(`CREATE TRIGGER hidden_root AFTER INSERT ON actual_live_play_runtimes BEGIN ${insert} END;`);
      else x.db.exec(insert);
      const witness = post ? witnessSqliteWrite('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?,?,?,?)', db =>
        db.prepare(`SELECT count(*) AS n FROM ${kind === 'head' ? 'batted_ball_flight_heads' : 'batted_ball_flights'}`).get()!.n === 1) : null;
      try {
        expect(() => x.store.accept(x.source.sourceId)).toThrow(/governed|ownership/);
        if (witness) expect(witness.wasReached()).toBe(true);
      } finally { witness?.close(); }
      expect(x.db.prepare('SELECT * FROM actual_live_play_runtimes').all()).toEqual([]);
      if (post) expect(x.db.prepare(`SELECT * FROM ${kind === 'head' ? 'batted_ball_flight_heads' : 'batted_ball_flights'}`).all()).toEqual([]);
    } finally { x.close(); }
  }
});
it('permits an original zero-horizon flight with its matching source-qualified head and embedded physical pitch', () => {
  const x = registrationFixture();
  try {
    x.table('batted_ball_flights');
    const source = { sourceId: 'flight', physicalPitchSourceId: 'pitch', searchDurationTicks: 0 };
    x.insert('batted_ball_flights', source, { source, physicalPitch: { source: { sourceId: 'pitch' } } } as never);
    x.db.exec("CREATE TABLE batted_ball_flight_heads(physical_pitch_source_id TEXT,source_id TEXT); INSERT INTO batted_ball_flight_heads VALUES('pitch','flight');");
    expect(x.store.accept(x.source.sourceId).source).toEqual(x.source);
  } finally { x.close(); }
});
