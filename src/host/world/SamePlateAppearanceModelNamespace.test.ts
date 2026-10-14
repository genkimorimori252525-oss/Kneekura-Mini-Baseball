import { createRequire } from 'node:module';
import { test, expect } from 'vitest';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';

const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
type Kind = 'observation' | 'decision' | 'locomotion';
type Classifier = (db: import('node:sqlite').DatabaseSync, kind: Kind) => 'present' | 'pristine';
const load = async (): Promise<Classifier> => {
  const modules = import.meta.glob('./SamePlateAppearanceModelNamespace.test-support.ts');
  const entry = modules['./SamePlateAppearanceModelNamespace.test-support.ts'];
  expect(entry, 'PRISTINE_MODEL_FAMILY_CLASSIFIER_MISSING').toBeTypeOf('function');
  return (await entry() as { classifyFieldModelNamespace: Classifier }).classifyFieldModelNamespace;
};
const kinds: readonly Kind[] = ['observation', 'decision', 'locomotion'];
const table = (kind: Kind) => `world_player_${kind}_models`;
// Exact existing normal-owner table shape, with no accepted model/calibration values.
const ddl = (kind: Kind, name = table(kind)) => `CREATE TABLE ${name} (
  source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, ${kind === 'locomotion' ? 'capability TEXT NOT NULL,' : ''}
  career_id TEXT NOT NULL, player_id TEXT NOT NULL, person_link_source_id TEXT NOT NULL,
  fielding_model_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
  source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
  UNIQUE(career_id,player_id))`;
const read = (db: import('node:sqlite').DatabaseSync, kind: Kind) => ({ observation: playerObservationModelEvidenceFromSqlite,
  decision: playerDecisionModelEvidenceFromSqlite, locomotion: playerLocomotionModelEvidenceFromSqlite }[kind])(db).selectAtDay('career', 'player', 10);
const inspect = <T>(db: import('node:sqlite').DatabaseSync, operation: () => T): T => {
  const schema = db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all(), changes = db.prepare('SELECT total_changes() n').get()!.n;
  db.exec('PRAGMA query_only=ON; BEGIN');
  try { return operation(); }
  finally { db.exec('ROLLBACK; PRAGMA query_only=OFF'); expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(changes);
    expect(db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all()).toEqual(schema); }
};

test('MN01 pristine absent families and installed empty normal owners remain distinct without writes', async () => {
  const classify = await load(), db = new Native(':memory:');
  try { for (const kind of kinds) {
    expect(inspect(db, () => classify(db, kind))).toBe('pristine');
    db.exec(ddl(kind));
    expect(inspect(db, () => classify(db, kind))).toBe('present');
    expect(() => inspect(db, () => read(db, kind))).toThrow(`accepted Player ${kind} baseline is missing`);
  } } finally { db.close(); }
});

test('MN02 partial alias view trigger and shadow namespaces cannot become pristine absence', async () => {
  const classify = await load();
  for (const setup of [ddl('observation', 'World_Player_Observation_Models'),
    'CREATE VIEW world_player_observation_models AS SELECT 1 n',
    'CREATE TABLE world_player_observation_models(source_id TEXT)',
    'CREATE TABLE world_player_observation_models_removed(source_id TEXT)',
    ddl('observation') + '; CREATE TRIGGER changed AFTER INSERT ON world_player_observation_models BEGIN SELECT 1; END',
    'CREATE TEMP TABLE world_player_observation_models(source_id TEXT)',
    "ATTACH ':memory:' AS peer"]) {
    const db = new Native(':memory:'); try { db.exec(setup); expect(() => inspect(db, () => classify(db, 'observation'))).toThrow(); } finally { db.close(); }
  }
});

test('MN03 surviving indexed and decoded duplicate raw model claims prevent absent-family classification', async () => {
  const classify = await load();
  for (const kind of kinds) for (const rawOnly of [false, true]) {
    const db = new Native(':memory:'); try {
      db.exec(`CREATE TABLE moved_receipts(${kind}_model_source_id TEXT,source_json TEXT,snapshot_json TEXT)`);
      const key = `${kind}ModelSourceId`, escaped = key.replace('M', '\\u004d');
      db.prepare('INSERT INTO moved_receipts VALUES(?,?,?)').run(rawOnly ? null : 'owned-model',
        rawOnly ? `{"source":{"${key}":"disjoint"},"source":{"${escaped}":"owned-model"}}` : '{invalid', '{"futurePayload":"opaque"}');
      expect(() => inspect(db, () => classify(db, kind))).toThrow(/surviving.*claim/);
    } finally { db.close(); }
  }
});

test('MN04 typed owner references survive moved indexes while unrelated opaque payloads stay unhydrated', async () => {
  const classify = await load(), db = new Native(':memory:');
  try {
    db.exec('CREATE TABLE unrelated(source_json TEXT,snapshot_json TEXT)');
    db.prepare('INSERT INTO unrelated VALUES(?,?)').run('{invalid future payload', JSON.stringify({ owner: ['world_player_observation_models'], value: 'world_player_observation_models' }));
    expect(inspect(db, () => classify(db, 'observation'))).toBe('pristine');
    db.prepare('INSERT INTO unrelated VALUES(?,?)').run('{"refs":{"owner":"disjoint"},"refs":{"ow\\u006eer":"world_player_observation_models","sourceId":"original"}}', '{}');
    expect(() => inspect(db, () => classify(db, 'observation'))).toThrow(/surviving.*claim/);
  } finally { db.close(); }
});

test('MN05 present malformed original model history propagates its normal owner rejection', async () => {
  const classify = await load(), db = new Native(':memory:');
  try {
    db.exec(ddl('observation'));
    db.prepare('INSERT INTO world_player_observation_models VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run('model', 'v1', 'career', 'player', 'person', 'fielding', 0, '{}', 'invalid', '{}', 'invalid');
    expect(inspect(db, () => classify(db, 'observation'))).toBe('present');
    expect(() => inspect(db, () => read(db, 'observation'))).toThrow('invalid accepted Player observation model Source');
  } finally { db.close(); }
});

test('MN06 incomplete surviving consumer schemas cannot certify a pristine model family', async () => {
  const classify = await load(), db = new Native(':memory:');
  try {
    db.exec('CREATE TABLE actual_field_observations(source_json TEXT); CREATE TABLE actual_field_observation_heads(source_id TEXT)');
    expect(() => inspect(db, () => classify(db, 'observation')), 'PARTIAL_CONSUMER_FAMILY_ACCEPTED').toThrow();
  } finally { db.close(); }
});

test('MN07 surviving consumer heads cannot hide a removed original model and receipt', async () => {
  const classify = await load(), db = new Native(':memory:');
  try {
    db.exec(`CREATE TABLE actual_field_observations (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT NOT NULL,
      player_id TEXT NOT NULL,base_field_source_id TEXT NOT NULL,execution_source_id TEXT,observation_model_source_id TEXT NOT NULL,
      previous_source_id TEXT,revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
      UNIQUE(physical_pitch_source_id,player_id,revision));
      CREATE TABLE actual_field_observation_heads (physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,
      source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,PRIMARY KEY(physical_pitch_source_id,player_id));`);
    expect(inspect(db, () => classify(db, 'observation'))).toBe('pristine');
    db.prepare('INSERT INTO actual_field_observation_heads VALUES(?,?,?,?)').run('pitch', 'player', 'removed-receipt', 0);
    expect(() => inspect(db, () => classify(db, 'observation'))).toThrow(/surviving.*claim/);
  } finally { db.close(); }
});
