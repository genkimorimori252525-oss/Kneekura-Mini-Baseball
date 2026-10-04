import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { ownedMotionKnownWorkFromSqlite as known } from './OwnedMotionKnownWorkFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const databases: InstanceType<typeof DatabaseSync>[] = [];
const open = () => { const db = new DatabaseSync(':memory:'); databases.push(db); return db; };
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
// Metadata-only fixtures deliberately leave domain payloads opaque; they are never passed to a receipt authority.
const decisionTable = 'actual_defensive_decisions', motorTable = 'actual_locomotion_receipts';
const schema = (db: ReturnType<typeof open>) => db.exec(`
  CREATE TABLE actual_field_observations (source_id TEXT PRIMARY KEY,physical_pitch_source_id TEXT,player_id TEXT,revision INTEGER);
  CREATE TABLE actual_defensive_decisions (source_id TEXT PRIMARY KEY,source_version TEXT,physical_pitch_source_id TEXT,player_id TEXT,
    observation_source_id TEXT,decision_model_source_id TEXT,plan_source_id TEXT,previous_source_id TEXT,revision INTEGER,source_json TEXT,snapshot_json TEXT);
  CREATE TABLE actual_defensive_decision_heads (physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);
  CREATE TABLE actual_locomotion_receipts (source_id TEXT PRIMARY KEY,source_version TEXT,capability TEXT,physical_pitch_source_id TEXT,player_id TEXT,
    decision_source_id TEXT,locomotion_model_source_id TEXT,base_field_source_id TEXT,execution_source_id TEXT,source_json TEXT,snapshot_json TEXT);
  CREATE TABLE actual_locomotion_heads (physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);
`);
const insert = (db: ReturnType<typeof open>, table: string, row: Record<string, string | number | null>) =>
  db.prepare(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
const decisionSource = (sourceId = 'decision-1', playerId = 'p2', physicalPitchSourceId = 'pitch', previousDecisionSourceId: string | null = null) => ({
  sourceId, sourceVersion: 'v1', physicalPitchSourceId, playerId, observationSourceId: `observation-${sourceId}`,
  decisionModelSourceId: `decision-model-${playerId}`, planSourceId: `plan-${playerId}`, previousDecisionSourceId,
});
const addDecision = (db: ReturnType<typeof open>, source = decisionSource(), history = [source]) => {
  const origin = history[0], snapshot = { source, revision: history.length, history,
    receipt: { self: { playerId: source.playerId }, originDecisionSourceId: origin.sourceId, originObservationSourceId: origin.observationSourceId,
      scheduling: 'deliberately opaque domain payload', lifecycle: { status: 'unknown future capability' } } };
  insert(db, decisionTable, { source_id: source.sourceId, source_version: source.sourceVersion, physical_pitch_source_id: source.physicalPitchSourceId,
    player_id: source.playerId, observation_source_id: source.observationSourceId, decision_model_source_id: source.decisionModelSourceId,
    plan_source_id: source.planSourceId, previous_source_id: source.previousDecisionSourceId, revision: history.length,
    source_json: JSON.stringify(source), snapshot_json: JSON.stringify(snapshot) });
  insert(db, 'actual_field_observations', { source_id: source.observationSourceId, physical_pitch_source_id: source.physicalPitchSourceId,
    player_id: source.playerId, revision: history.length });
  db.prepare('DELETE FROM actual_defensive_decision_heads WHERE physical_pitch_source_id=? AND player_id=?').run(source.physicalPitchSourceId, source.playerId);
  insert(db, 'actual_defensive_decision_heads', { physical_pitch_source_id: source.physicalPitchSourceId, player_id: source.playerId,
    source_id: source.sourceId, revision: history.length });
  return { source, snapshot };
};
const addMotor = (db: ReturnType<typeof open>, decision = decisionSource(), sourceId = 'motor-1') => {
  const source = { sourceId, sourceVersion: 'v1', capability: 'initial_defender_step_v1', physicalPitchSourceId: decision.physicalPitchSourceId,
    playerId: decision.playerId, decisionSourceId: decision.sourceId, locomotionModelSourceId: `motor-model-${decision.playerId}`,
    baseFieldSourceId: 'field', executionSourceId: null };
  const snapshot = { source, revision: 1, history: [source], receipt: { self: { physicalPitchSourceId: source.physicalPitchSourceId,
    playerId: source.playerId, cut: { physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId,
      baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.executionSourceId, mode: 'original' } },
    command: { playerId: source.playerId, acceleration: 'opaque' }, lifecycle: 'opaque', retainedRoles: 'opaque' } };
  insert(db, motorTable, { source_id: source.sourceId, source_version: source.sourceVersion, capability: source.capability,
    physical_pitch_source_id: source.physicalPitchSourceId, player_id: source.playerId, decision_source_id: source.decisionSourceId,
    locomotion_model_source_id: source.locomotionModelSourceId, base_field_source_id: source.baseFieldSourceId, execution_source_id: null,
    source_json: JSON.stringify(source), snapshot_json: JSON.stringify(snapshot) });
  insert(db, 'actual_locomotion_heads', { physical_pitch_source_id: source.physicalPitchSourceId, player_id: source.playerId, source_id: sourceId, revision: 1 });
  return { source, snapshot };
};
const change = (db: ReturnType<typeof open>, table: string, column: string, sourceId: string, value: string) =>
  db.prepare(`UPDATE ${table} SET ${column}=? WHERE source_id=?`).run(value, sourceId);
const duplicate = (first: Record<string, unknown>, last: Record<string, unknown>) => `${JSON.stringify(first).slice(0, -1)},${JSON.stringify(last).slice(1)}`;

it('returns explicit absent work in caller order without creating optional owner tables', () => {
  const db = open();
  expect(known(db, 'pitch', ['batter', 'p2'])).toEqual([
    { playerId: 'batter', decisionSourceId: null, motorSourceId: null }, { playerId: 'p2', decisionSourceId: null, motorSourceId: null },
  ]);
  expect(db.prepare('SELECT name FROM sqlite_master').all()).toEqual([]);
});

it.each(['actual_defensive_decisions', 'actual_defensive_decision_heads', 'actual_locomotion_receipts', 'actual_locomotion_heads'])(
  'rejects a half-installed optional owner: %s', table => {
    const db = open(); db.exec(`CREATE TABLE ${table} (source_id TEXT)`);
    expect(() => known(db, 'pitch', ['p2'])).toThrow(/tables/);
  });

it('finds the latest decision and original one-shot motor without interpreting domain payloads', () => {
  const db = open(); schema(db); const first = addDecision(db), second = decisionSource('decision-2', 'p2', 'pitch', first.source.sourceId);
  addDecision(db, second, [first.source, second]); addMotor(db, second);
  expect(known(db, 'pitch', ['batter', 'p2'])).toEqual([
    { playerId: 'batter', decisionSourceId: null, motorSourceId: null }, { playerId: 'p2', decisionSourceId: second.sourceId, motorSourceId: 'motor-1' },
  ]);
});

it.each(['actual_defensive_decision_heads', 'actual_locomotion_heads'])('rejects missing, stale, duplicate and foreign relevant %s', table => {
  for (const mutation of ['missing', 'stale', 'duplicate', 'foreign', 'revision']) {
    const db = open(); schema(db); addDecision(db); addMotor(db);
    if (mutation === 'missing') db.exec(`DELETE FROM ${table}`);
    if (mutation === 'stale') db.exec(`UPDATE ${table} SET source_id='missing'`);
    if (mutation === 'duplicate') db.exec(`INSERT INTO ${table} SELECT * FROM ${table}`);
    if (mutation === 'foreign') db.exec(`UPDATE ${table} SET player_id='foreign'`);
    if (mutation === 'revision') db.exec(`UPDATE ${table} SET revision=2`);
    expect(() => known(db, 'pitch', ['p2']), `${table}: ${mutation}`).toThrow();
  }
});

it.each([decisionTable, motorTable])('rejects mismatched and duplicate Source, snapshot and history mirrors for %s', table => {
  for (const target of ['source', 'snapshot source', 'history', 'revision', 'receipt self', 'duplicate source', 'escaped key', 'string history']) {
    const db = open(); schema(db); const d = addDecision(db), m = addMotor(db); const value = table === decisionTable ? d : m;
    const snapshot: any = structuredClone(value.snapshot);
    let column = 'snapshot_json', text: string;
    if (target === 'source') { column = 'source_json'; text = JSON.stringify({ ...value.source, playerId: 'foreign' }); }
    else if (target === 'duplicate source') text = duplicate({ source: { ...value.source, playerId: 'foreign' } }, snapshot);
    else if (target === 'escaped key') { column = 'source_json'; text = JSON.stringify(value.source).replace('"playerId":"p2"', '"playerId":"p2","player\\u0049d":"foreign"'); }
    else {
      if (target === 'snapshot source') snapshot.source.playerId = 'foreign';
      if (target === 'history') snapshot.history[0].sourceId = 'foreign';
      if (target === 'revision') snapshot.revision = '1';
      if (target === 'receipt self') snapshot.receipt.self.playerId = 'foreign';
      if (target === 'string history') snapshot.history = snapshot.history.map(JSON.stringify);
      text = JSON.stringify(snapshot);
    }
    change(db, table, column, value.source.sourceId, text!);
    expect(() => known(db, 'pitch', ['p2']), `${table}: ${target}`).toThrow();
  }
});

it.each(['source', 'snapshot source', 'history', 'receipt self', 'receipt cut', 'receipt command', 'decision pointer'])(
  'discovers a foreign motor whose only ownership claim is %s', target => {
    const db = open(); schema(db); const d = addDecision(db), foreign = decisionSource('foreign-decision', 'foreign', 'elsewhere'); addDecision(db, foreign);
    const m = addMotor(db, foreign, 'hidden'); let source: any = structuredClone(m.source), snapshot: any = structuredClone(m.snapshot);
    const scope = { physicalPitchSourceId: 'pitch', playerId: 'p2' };
    if (target === 'source') source = { ...source, ...scope };
    if (target === 'snapshot source') snapshot.source = { ...snapshot.source, ...scope };
    if (target === 'history') snapshot.history[0] = { ...snapshot.history[0], ...scope };
    if (target === 'receipt self') snapshot.receipt.self = { ...snapshot.receipt.self, ...scope };
    if (target === 'receipt cut') snapshot.receipt.self.cut = { ...snapshot.receipt.self.cut, ...scope };
    if (target === 'receipt command') { snapshot.source.physicalPitchSourceId = 'pitch'; snapshot.receipt.command.playerId = 'p2'; }
    if (target === 'decision pointer') snapshot.history[0].decisionSourceId = d.source.sourceId;
    change(db, motorTable, 'source_json', m.source.sourceId, JSON.stringify(source));
    change(db, motorTable, 'snapshot_json', m.source.sourceId, JSON.stringify(snapshot));
    expect(() => known(db, 'pitch', ['p2'])).toThrow();
  });

it.each(['source', 'snapshot source', 'history', 'receipt self', 'origin observation', 'origin decision'])(
  'discovers a foreign decision whose only ownership claim is %s', target => {
    const db = open(); schema(db); const d = addDecision(db), foreign = addDecision(db, decisionSource('hidden', 'foreign', 'elsewhere'));
    let source: any = structuredClone(foreign.source), snapshot: any = structuredClone(foreign.snapshot);
    const scope = { physicalPitchSourceId: 'pitch', playerId: 'p2' };
    if (target === 'source') source = { ...source, ...scope };
    if (target === 'snapshot source') snapshot.source = { ...snapshot.source, ...scope };
    if (target === 'history') snapshot.history[0] = { ...snapshot.history[0], ...scope };
    if (target === 'receipt self') { snapshot.source.physicalPitchSourceId = 'pitch'; snapshot.receipt.self.playerId = 'p2'; }
    if (target === 'origin observation') snapshot.receipt.originObservationSourceId = d.source.observationSourceId;
    if (target === 'origin decision') snapshot.receipt.originDecisionSourceId = d.source.sourceId;
    change(db, decisionTable, 'source_json', foreign.source.sourceId, JSON.stringify(source));
    change(db, decisionTable, 'snapshot_json', foreign.source.sourceId, JSON.stringify(snapshot));
    expect(() => known(db, 'pitch', ['p2'])).toThrow();
  });

it('does not turn unrelated malformed payloads or string-encoded scope objects into work', () => {
  const db = open(); schema(db);
  const d = addDecision(db, decisionSource('foreign-decision', 'foreign', 'elsewhere')), m = addMotor(db, d.source, 'foreign-motor');
  change(db, decisionTable, 'source_json', d.source.sourceId, 'opaque unrelated payload');
  change(db, decisionTable, 'snapshot_json', d.source.sourceId, JSON.stringify({ source: JSON.stringify(decisionSource()) }));
  change(db, motorTable, 'source_json', m.source.sourceId, 'opaque unrelated payload');
  change(db, motorTable, 'snapshot_json', m.source.sourceId, JSON.stringify({ source: JSON.stringify({ physicalPitchSourceId: 'pitch', playerId: 'p2' }) }));
  expect(known(db, 'pitch', ['p2'])).toEqual([{ playerId: 'p2', decisionSourceId: null, motorSourceId: null }]);
});

it('rejects invalid and duplicate player scope inputs before attempting SQL', () => {
  const db = open();
  for (const players of [['p2', 'p2'], [''], [' p2'], []]) expect(() => known(db, 'pitch', players)).toThrow();
  expect(() => known(db, '', ['p2'])).toThrow();
});

it.each([decisionTable, motorTable])('rejects duplicate escaped metadata containers and ownership aliases for %s', table => {
  for (const target of ['history container', 'receipt container', 'history leaf', 'source alias', 'history alias', 'malformed history alias']) {
    const db = open(); schema(db); const d = addDecision(db), m = addMotor(db), original = table === decisionTable ? d : m;
    const foreignDecision = addDecision(db, decisionSource('foreign-decision', 'foreign', 'elsewhere'));
    const foreign = table === decisionTable ? foreignDecision : addMotor(db, foreignDecision.source, 'foreign-motor');
    let source = JSON.stringify(foreign.source), snapshot = JSON.stringify(foreign.snapshot);
    const ownedScope = { physicalPitchSourceId: 'pitch', playerId: 'p2' };
    if (target === 'history container') snapshot = snapshot.slice(0, -1) + `,"histo\\u0072y":[${JSON.stringify({ ...foreign.source, ...ownedScope })}]}`;
    if (target === 'receipt container') snapshot = snapshot.slice(0, -1) + `,"rece\\u0069pt":${JSON.stringify({ self: ownedScope })}}`;
    if (target === 'history leaf') snapshot = JSON.stringify({ ...foreign.snapshot, history: '__LEAF__' }).replace('"__LEAF__"',
      `[${duplicate(foreign.source, { ...foreign.source, ...ownedScope })}]`);
    if (target === 'source alias') source = JSON.stringify({ ...foreign.source, sourceId: original.source.sourceId });
    if (target === 'history alias') snapshot = JSON.stringify({ ...foreign.snapshot, history: [{ ...foreign.source, sourceId: original.source.sourceId }] });
    if (target === 'malformed history alias') snapshot = JSON.stringify({ ...foreign.snapshot, history: { ...foreign.source, sourceId: original.source.sourceId } });
    // A decision receipt self has only Player identity. Its pitch comes from the Source mirror.
    if (table === decisionTable && target === 'receipt container') snapshot = snapshot.replace('"physicalPitchSourceId":"elsewhere"', '"physicalPitchSourceId":"pitch"');
    change(db, table, 'source_json', foreign.source.sourceId, source); change(db, table, 'snapshot_json', foreign.source.sourceId, snapshot);
    expect(() => known(db, 'pitch', ['p2']), `${table}: ${target}`).toThrow(/known-work/);
  }
});

it('rejects stale motor-decision lineage even when every motor mirror agrees', () => {
  const db = open(); schema(db); const first = addDecision(db); addMotor(db);
  const second = decisionSource('decision-2', 'p2', 'pitch', first.source.sourceId); addDecision(db, second, [first.source, second]);
  expect(() => known(db, 'pitch', ['p2'])).toThrow(/known-work/);
});

it('returns a fresh immutable head list and cannot retroactively update previous discovery', () => {
  const db = open(); schema(db); const first = addDecision(db), initial = known(db, 'pitch', ['p2']);
  const second = decisionSource('decision-2', 'p2', 'pitch', first.source.sourceId); addDecision(db, second, [first.source, second]);
  expect(initial).toEqual([{ playerId: 'p2', decisionSourceId: 'decision-1', motorSourceId: null }]);
  expect(known(db, 'pitch', ['p2'])).toEqual([{ playerId: 'p2', decisionSourceId: 'decision-2', motorSourceId: null }]);
  expect(Object.isFrozen(initial)).toBe(true); expect(Object.isFrozen(initial[0])).toBe(true);
});

it.each(['source_json', 'snapshot_json'])('rejects opaque relevant %s without dereferencing its domain payload', column => {
  const db = open(); schema(db); const d = addDecision(db);
  change(db, decisionTable, column, d.source.sourceId, 'not JSON');
  expect(() => known(db, 'pitch', ['p2'])).toThrow(/known-work/);
});

it('rejects observation lineage gaps and metadata outside the relevant Player', () => {
  for (const mutation of ['DELETE FROM actual_field_observations', "UPDATE actual_field_observations SET player_id='foreign'",
    "UPDATE actual_field_observations SET revision=0", "UPDATE actual_field_observations SET revision=1.5"]) {
    const db = open(); schema(db); addDecision(db); db.exec(mutation);
    expect(() => known(db, 'pitch', ['p2'])).toThrow(/known-work/);
  }
});

it('discovers a genuine accepted decision without changing original owner archives', async () => {
  const { actualDefensiveDecisionFixture } = await import('./ActualDefensiveDecisionFixtures.test-support');
  const x = actualDefensiveDecisionFixture();
  try {
    x.plans.accept(x.planSource.sourceId); const decision = x.decisions.accept(x.decisionSource.sourceId);
    const tables = [decisionTable, 'actual_defensive_decision_heads', 'actual_field_observations'];
    const before = tables.map(table => x.f.db.prepare(`SELECT * FROM ${table}`).all());
    expect(known(x.f.db, decision.source.physicalPitchSourceId, ['p1', 'p2'])).toEqual([
      { playerId: 'p1', decisionSourceId: null, motorSourceId: null },
      { playerId: 'p2', decisionSourceId: decision.source.sourceId, motorSourceId: null },
    ]);
    expect(tables.map(table => x.f.db.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
  } finally { x.f.close(); }
});

it.each([['actual_defensive_decisions', 'actual_defensive_decision_heads'], ['actual_locomotion_receipts', 'actual_locomotion_heads']])(
  'does not treat non-table owner objects as absence: %s', (table, heads) => {
    const db = open(); db.exec(`CREATE VIEW ${table} AS SELECT 'hidden' AS source_id; CREATE VIEW ${heads} AS SELECT 'hidden' AS source_id`);
    expect(() => known(db, 'pitch', ['p2'])).toThrow(/tables/);
  });
