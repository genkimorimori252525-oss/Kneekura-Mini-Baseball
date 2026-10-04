import { afterAll, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { actualDefensiveDecisionFixture } from './ActualDefensiveDecisionFixtures.test-support';
import { preflightOwnedMotionCausality as preflight } from './OwnedMotionCausality';

const createFixture = () => {
  const x = actualDefensiveDecisionFixture();
  x.plans.accept(x.planSource.sourceId); x.decisions.accept(x.decisionSource.sourceId);
  // The initial observation really predates this later field anchor and its execution owner.
  const fieldSource = { ...x.fieldSource, sourceId: 'later-field-anchor', previousFieldSourceId: x.baseField.source.sourceId,
    availableAtTick: x.baseField.field.motion.world.moment.ball.tick, throughTick: x.baseField.field.motion.world.moment.ball.tick + 1 };
  x.fieldSources.set(fieldSource.sourceId, fieldSource); const baseField = x.fields.accept(fieldSource.sourceId);
  const source = { ...x.source, baseFieldSourceId: baseField.source.sourceId, action: { kind: 'motion' as const, availableAtTick: baseField.field.motion.world.moment.ball.tick,
    throughTick: baseField.field.motion.world.moment.ball.tick + 5, commands: x.fieldSource.commands } };
  x.sources.set(source.sourceId, source); const execution = x.executions.accept(source.sourceId);
  const observationSource = { ...x.observationSource, sourceId: 'observation-2', previousObservationSourceId: x.observationSource.sourceId,
    executionSourceId: source.sourceId, baseFieldSourceId: baseField.source.sourceId };
  x.observationSources.set(observationSource.sourceId, observationSource); x.observations.accept(observationSource.sourceId);
  const decisionSource = { ...x.decisionSource, sourceId: 'decision-2', previousDecisionSourceId: x.decisionSource.sourceId,
    observationSourceId: observationSource.sourceId };
  x.decisionSources.set(decisionSource.sourceId, decisionSource); x.decisions.accept(decisionSource.sourceId);
  // Deliberately metadata-only motor archive: this guard cannot manufacture motor evidence or replay its domain payload.
  const motor = { sourceId: 'motor-1', sourceVersion: 'synthetic-v1', capability: 'initial_defender_step_v1',
    physicalPitchSourceId: x.decisionSource.physicalPitchSourceId, playerId: 'p2', decisionSourceId: decisionSource.sourceId,
    locomotionModelSourceId: 'model', baseFieldSourceId: baseField.source.sourceId, executionSourceId: execution.source.sourceId };
  x.f.db.exec(`CREATE TABLE actual_locomotion_receipts (source_id TEXT PRIMARY KEY,source_version TEXT,capability TEXT,
    physical_pitch_source_id TEXT,player_id TEXT,decision_source_id TEXT,locomotion_model_source_id TEXT,base_field_source_id TEXT,
    execution_source_id TEXT,source_json TEXT,snapshot_json TEXT);
    CREATE TABLE actual_locomotion_heads (physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);`);
  const snapshot = { source: motor, revision: 1, history: [motor], receipt: { self: {
    physicalPitchSourceId: motor.physicalPitchSourceId, playerId: motor.playerId, cut: {
      physicalPitchSourceId: motor.physicalPitchSourceId, playerId: motor.playerId, baseFieldSourceId: motor.baseFieldSourceId,
      executionSourceId: motor.executionSourceId, mode: 'original' } }, command: { playerId: motor.playerId }, segment: 'not replayable' } };
  x.f.db.prepare('INSERT INTO actual_locomotion_receipts VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(motor.sourceId, motor.sourceVersion,
    motor.capability, motor.physicalPitchSourceId, motor.playerId, motor.decisionSourceId, motor.locomotionModelSourceId,
    motor.baseFieldSourceId, motor.executionSourceId, JSON.stringify(motor), JSON.stringify(snapshot));
  x.f.db.prepare('INSERT INTO actual_locomotion_heads VALUES (?,?,?,1)').run(motor.physicalPitchSourceId, motor.playerId, motor.sourceId);
  return { ...x, baseField, execution, laterObservationSource: observationSource, laterDecisionSource: decisionSource, motor,
    input: { baseField, executionPrefix: [execution], motorSourceIds: [motor.sourceId], decisionSourceIds: [decisionSource.sourceId] } };
};
type Fixture = ReturnType<typeof createFixture>;
let cached: Fixture | undefined;
afterAll(() => cached?.f.close());
const fixture = (): Fixture => {
  cached ??= createFixture();
  cached.f.db.exec('SAVEPOINT causal_test');
  return { ...cached, f: { ...cached.f, close() { cached!.f.db.exec('ROLLBACK TO causal_test; RELEASE causal_test'); } } };
};
const rewrite = (x: Fixture, table: string, id: string, change: Record<string, unknown>, replacements: Record<string, string> = {}) => {
  const row = x.f.db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id)!;
  const values: Record<string, unknown> = { ...change };
  for (const column of ['source_json', 'snapshot_json']) {
    let value = row[column] as string;
    for (const [old, replacement] of Object.entries(replacements)) value = value.replaceAll(JSON.stringify(old), JSON.stringify(replacement));
    values[column] = value;
  }
  x.f.db.prepare(`UPDATE ${table} SET ${Object.keys(values).map(k => `${k}=?`).join(',')} WHERE source_id=?`)
    .run(...Object.values(values) as never[], id);
  return () => x.f.db.prepare(`UPDATE ${table} SET ${Object.keys(values).map(k => `${k}=?`).join(',')} WHERE source_id=?`)
    .run(...Object.keys(values).map(k => row[k]) as never[], id);
};

it('proves owned dependency rank without deserializing or replaying motor domain payload', () => {
  const x = fixture();
  try {
    expect(x.baseField.history.map(source => source.sourceId)).toContain(x.observationSource.baseFieldSourceId);
    expect(x.observationSource.baseFieldSourceId).not.toBe(x.baseField.source.sourceId);
    expect(() => preflight(x.f.db, x.input)).not.toThrow();
  } finally { x.f.close(); }
});

it('rejects self, forward, stale and null selected motor cuts before any reader dereference', () => {
  const x = fixture();
  try {
    for (const cut of ['adopting-execution', 'future-execution', 'missing-old-execution']) {
      const restore = rewrite(x, 'actual_locomotion_receipts', x.motor.sourceId, { execution_source_id: cut }, { [x.motor.executionSourceId]: cut });
      expect.soft(() => preflight(x.f.db, x.input), cut).toThrow(/causal|predecessor/); restore();
    }
    const row = x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').get()!;
    x.f.db.prepare('UPDATE actual_locomotion_receipts SET execution_source_id=NULL,source_json=?,snapshot_json=?')
      .run((row.source_json as string).replaceAll(JSON.stringify(x.motor.executionSourceId), 'null'),
        (row.snapshot_json as string).replaceAll(JSON.stringify(x.motor.executionSourceId), 'null'));
    expect(() => preflight(x.f.db, x.input)).toThrow(/causal|predecessor/);
  } finally { x.f.close(); }
});

it('rejects source, snapshot, history and nested self-cut identity divergence and escaped duplicate containers', () => {
  const x = fixture();
  try {
    const row = x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').get()!;
    const original = JSON.parse(row.snapshot_json as string);
    const cases: [string, string][] = [
      ['source_json', (row.source_json as string).replace('"executionSourceId":', '"executionSourceId":"self","executionSourceId":')],
      ['snapshot_json', JSON.stringify({ ...original, source: { ...original.source, executionSourceId: 'self' } })],
      ['snapshot_json', JSON.stringify({ ...original, history: [{ ...original.source, executionSourceId: 'self' }] })],
      ['snapshot_json', JSON.stringify({ ...original, receipt: { ...original.receipt, self: { ...original.receipt.self,
        cut: { ...original.receipt.self.cut, executionSourceId: 'self' } } } })],
      ['snapshot_json', (row.snapshot_json as string).replace('"receipt":', '"rece\\u0069pt":{"self":{"cut":{"executionSourceId":"self"}}},"receipt":')],
      ['snapshot_json', JSON.stringify({ ...original, source: JSON.stringify(original.source) })],
      ['snapshot_json', JSON.stringify({ ...original, history: { 0: original.source } })],
    ];
    for (const [column, json] of cases) {
      x.f.db.prepare(`UPDATE actual_locomotion_receipts SET ${column}=?`).run(json);
      expect.soft(() => preflight(x.f.db, x.input), json).toThrow();
      x.f.db.prepare(`UPDATE actual_locomotion_receipts SET ${column}=?`).run(row[column]);
    }
  } finally { x.f.close(); }
});

it('checks every earlier decision observation, observation ancestor, and original receipt pointer', () => {
  const x = fixture();
  try {
    for (const id of [x.observationSource.sourceId, x.laterObservationSource.sourceId]) {
      const row = x.f.db.prepare('SELECT * FROM actual_field_observations WHERE source_id=?').get(id)!;
      // Match all metadata mirrors; the malicious edge itself must be rejected before replay.
      const source = { ...JSON.parse(row.source_json as string), executionSourceId: 'adopting-execution' };
      const snapshot = JSON.parse(row.snapshot_json as string);
      snapshot.source = source; snapshot.history = snapshot.history.map((s: { sourceId: string }) => s.sourceId === id ? source : s);
      x.f.db.prepare('UPDATE actual_field_observations SET execution_source_id=?,source_json=?,snapshot_json=? WHERE source_id=?')
        .run('adopting-execution', JSON.stringify(source), JSON.stringify(snapshot), id);
      expect.soft(() => preflight(x.f.db, x.input), id).toThrow();
      x.f.db.prepare('UPDATE actual_field_observations SET execution_source_id=?,source_json=?,snapshot_json=? WHERE source_id=?')
        .run(row.execution_source_id, row.source_json, row.snapshot_json, id);
    }
    const row = x.f.db.prepare('SELECT snapshot_json FROM actual_defensive_decisions WHERE source_id=?').get(x.laterDecisionSource.sourceId)!;
    for (const key of ['originObservationSourceId', 'originDecisionSourceId']) {
      const value = JSON.parse(row.snapshot_json as string); value.receipt[key] = 'hidden-forward-origin';
      x.f.db.prepare('UPDATE actual_defensive_decisions SET snapshot_json=? WHERE source_id=?').run(JSON.stringify(value), x.laterDecisionSource.sourceId);
      expect.soft(() => preflight(x.f.db, x.input), key).toThrow();
    }
  } finally { x.f.close(); }
});

it('rejects foreign namespaces, wrong field anchors, duplicate selection and orphan heads', () => {
  const x = fixture();
  try {
    for (const [column, original, foreign] of [
      ['physical_pitch_source_id', x.motor.physicalPitchSourceId, 'other-pitch'],
      ['base_field_source_id', x.motor.baseFieldSourceId, 'other-field'],
      ['player_id', x.motor.playerId, 'other-player'],
    ]) {
      const restore = rewrite(x, 'actual_locomotion_receipts', x.motor.sourceId, { [column]: foreign }, { [original]: foreign });
      expect.soft(() => preflight(x.f.db, x.input), column).toThrow(); restore();
    }
    expect(() => preflight(x.f.db, { ...x.input, motorSourceIds: [x.motor.sourceId, x.motor.sourceId] })).toThrow();
    x.f.db.prepare('UPDATE actual_defensive_decision_heads SET revision=99').run();
    expect(() => preflight(x.f.db, x.input)).toThrow();
  } finally { x.f.close(); }
});

it('rejects duplicate selected identities before accessing a physical dependency', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    expect(() => preflight(db, { motorSourceIds: ['duplicate', 'duplicate'], decisionSourceIds: [] } as unknown as Parameters<typeof preflight>[1]))
      .toThrow(/identity|duplicate/);
  } finally { db.close(); }
});

const insert = (x: Fixture, table: string, row: Record<string, unknown>) => x.f.db.prepare(
  `INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row) as never[]);
const future = (x: Fixture) => {
  const execution = x.f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(x.execution.source.sourceId)!;
  insert(x, 'batted_world_field_executions', { ...execution, source_id: 'future-execution', previous_source_id: execution.source_id,
    revision: 2, source_json: 'opaque future physical Source', snapshot_json: 'opaque future physical snapshot' });
  x.f.db.prepare("UPDATE batted_world_field_execution_heads SET source_id='future-execution',revision=2").run();
  for (const [table, head, oldId, sourceId, predecessorKey] of [
    ['actual_field_observations', 'actual_field_observation_heads', x.laterObservationSource.sourceId, 'future-observation', 'previousObservationSourceId'],
    ['actual_defensive_decisions', 'actual_defensive_decision_heads', x.laterDecisionSource.sourceId, 'future-decision', 'previousDecisionSourceId'],
  ]) {
    const row = x.f.db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(oldId)!;
    const source = { ...JSON.parse(row.source_json as string), sourceId, [predecessorKey]: oldId,
      ...(table === 'actual_field_observations' ? { executionSourceId: 'future-execution', view: 'opaque future view' }
        : { observationSourceId: 'future-observation' }) };
    const snapshot = JSON.parse(row.snapshot_json as string);
    insert(x, table, { ...row, source_id: sourceId, revision: 3, previous_source_id: oldId,
      ...(table === 'actual_field_observations' ? { execution_source_id: 'future-execution' } : { observation_source_id: 'future-observation' }),
      source_json: JSON.stringify(source), snapshot_json: JSON.stringify({ ...snapshot, source, revision: 3, history: [...snapshot.history, source],
        receipt: table === 'actual_field_observations' ? 'opaque future perception' : { ...snapshot.receipt, scheduling: 'opaque future timing' } }) });
    x.f.db.prepare(`UPDATE ${head} SET source_id=?,revision=3`).run(sourceId);
  }
};

it('does not borrow or replay newer physical, observation and decision payloads across a historical bound', () => {
  const x = fixture();
  try {
    future(x);
    expect(() => preflight(x.f.db, x.input)).not.toThrow();
    for (const [table, id] of [['actual_field_observations', 'future-observation'], ['actual_defensive_decisions', 'future-decision']]) {
      x.f.db.prepare(`UPDATE ${table} SET source_json='opaque future Source',snapshot_json='opaque future snapshot' WHERE source_id=?`).run(id);
    }
    expect(() => preflight(x.f.db, x.input)).not.toThrow();
    // Metadata ownership is still complete even when the later domain payload is opaque.
    x.f.db.prepare("UPDATE actual_defensive_decision_heads SET player_id='foreign'").run();
    expect(() => preflight(x.f.db, x.input)).toThrow(/head/);
  } finally { x.f.close(); }
});

it('rejects an otherwise internally mirrored plan-origin observation beyond the physical predecessor', () => {
  const x = fixture();
  try {
    future(x);
    rewrite(x, 'actual_defensive_plans', x.planSource.sourceId, { observation_source_id: 'future-observation' },
      { [x.observationSource.sourceId]: 'future-observation' });
    expect(() => preflight(x.f.db, x.input)).toThrow(/strict predecessor/);
  } finally { x.f.close(); }
});

it('rejects selected and ancestor physical cuts by rank even when all dependency mirrors agree', () => {
  const x = fixture();
  try {
    future(x);
    for (const row of x.f.db.prepare('SELECT * FROM actual_field_observations ORDER BY revision').all()) {
      const source = JSON.parse(row.source_json as string); source.executionSourceId = 'future-execution'; source.baseFieldSourceId = x.baseField.source.sourceId;
      const snapshot = JSON.parse(row.snapshot_json as string); snapshot.source = source;
      snapshot.history = snapshot.history.map((s: object) => ({ ...s, executionSourceId: 'future-execution', baseFieldSourceId: x.baseField.source.sourceId }));
      x.f.db.prepare('UPDATE actual_field_observations SET execution_source_id=?,base_field_source_id=?,source_json=?,snapshot_json=? WHERE source_id=?')
        .run('future-execution', x.baseField.source.sourceId, JSON.stringify(source), JSON.stringify(snapshot), row.source_id);
    }
    expect(() => preflight(x.f.db, x.input)).toThrow(/strict predecessor/);
    expect(() => preflight(x.f.db, { ...x.input, motorSourceIds: [], decisionSourceIds: [x.decisionSource.sourceId] })).toThrow(/strict predecessor/);
  } finally { x.f.close(); }
});

it('keeps a null original execution bound empty even when later executions and decisions exist', () => {
  const x = fixture();
  try {
    future(x);
    expect(() => preflight(x.f.db, { ...x.input, executionPrefix: [], motorSourceIds: [], decisionSourceIds: [x.decisionSource.sourceId] })).not.toThrow();
    expect(() => preflight(x.f.db, { ...x.input, executionPrefix: [], motorSourceIds: [], decisionSourceIds: [x.laterDecisionSource.sourceId] }))
      .toThrow(/strict predecessor/);
  } finally { x.f.close(); }
});

it('requires observation history versions to be typed and to mirror the original Source', () => {
  const x = fixture();
  try {
    const row = x.f.db.prepare('SELECT snapshot_json FROM actual_field_observations WHERE source_id=?').get(x.laterObservationSource.sourceId)!;
    for (const version of [null, {}, 'different-version']) {
      const snapshot = JSON.parse(row.snapshot_json as string); snapshot.history[0].sourceVersion = version;
      x.f.db.prepare('UPDATE actual_field_observations SET snapshot_json=? WHERE source_id=?').run(JSON.stringify(snapshot), x.laterObservationSource.sourceId);
      expect.soft(() => preflight(x.f.db, x.input), String(version)).toThrow(/version/);
    }
  } finally { x.f.close(); }
});

it('discovers hidden motor identity claims even in malformed v1 histories', () => {
  const x = fixture();
  try {
    const row = x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').get()!;
    const original = JSON.parse(row.snapshot_json as string), source = { ...original.source,
      sourceId: 'foreign-motor', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player', decisionSourceId: 'foreign-decision' };
    for (const history of [[{ ...source, sourceId: x.motor.sourceId }, source], { sourceId: x.motor.sourceId }]) {
      const snapshot = { source, revision: 1, history, receipt: { self: { physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player' } } };
      insert(x, 'actual_locomotion_receipts', { ...row, source_id: source.sourceId, physical_pitch_source_id: source.physicalPitchSourceId,
        player_id: source.playerId, decision_source_id: source.decisionSourceId, source_json: JSON.stringify(source), snapshot_json: JSON.stringify(snapshot) });
      expect.soft(() => preflight(x.f.db, x.input)).toThrow(/identity/);
      x.f.db.prepare('DELETE FROM actual_locomotion_receipts WHERE source_id=?').run(source.sourceId);
    }
  } finally { x.f.close(); }
});


it('discovers foreign row scope claims hidden by duplicated Source keys for each dependency owner', () => {
  const x = fixture();
  try {
    for (const [table, sourceId] of [
      ['actual_locomotion_receipts', x.motor.sourceId], ['actual_defensive_decisions', x.laterDecisionSource.sourceId],
      ['actual_field_observations', x.laterObservationSource.sourceId], ['actual_defensive_plans', x.planSource.sourceId],
    ]) {
      const row = x.f.db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(sourceId)!;
      const source = { ...JSON.parse(row.source_json as string), sourceId: 'foreign-source', physicalPitchSourceId: 'foreign-pitch',
        playerId: 'foreign-player', observationSourceId: 'foreign-observation', decisionSourceId: 'foreign-decision' };
      const snapshot = { source, history: [source], revision: 1, binding: { playerId: source.playerId },
        receipt: { self: { physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId },
          originDecisionSourceId: source.sourceId, originObservationSourceId: source.observationSourceId } };
      const hidden = JSON.stringify(source).slice(0, -1) + ',"physicalPitchSourceId":' + JSON.stringify(x.motor.physicalPitchSourceId)
        + ',"playerId":' + JSON.stringify(x.motor.playerId) + '}';
      insert(x, table, { ...row, source_id: source.sourceId, physical_pitch_source_id: source.physicalPitchSourceId,
        player_id: source.playerId, ...('observation_source_id' in row ? { observation_source_id: source.observationSourceId } : {}),
        ...('decision_source_id' in row ? { decision_source_id: source.decisionSourceId } : {}),
        source_json: hidden, snapshot_json: JSON.stringify(snapshot) });
      expect.soft(() => preflight(x.f.db, x.input), table).toThrow();
      x.f.db.prepare(`DELETE FROM ${table} WHERE source_id=?`).run(source.sourceId);
    }
  } finally { x.f.close(); }
});

it('rejects physical index namespace changes even when the previously validated prefix object is unchanged', () => {
  const x = fixture();
  try {
    for (const column of ['physical_pitch_source_id', 'base_field_source_id', 'game_id']) {
      const row = x.f.db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(x.execution.source.sourceId)!;
      x.f.db.prepare(`UPDATE batted_world_field_executions SET ${column}='foreign' WHERE source_id=?`).run(x.execution.source.sourceId);
      expect.soft(() => preflight(x.f.db, x.input), column).toThrow();
      x.f.db.prepare(`UPDATE batted_world_field_executions SET ${column}=? WHERE source_id=?`).run(row[column], x.execution.source.sourceId);
    }
  } finally { x.f.close(); }
});
