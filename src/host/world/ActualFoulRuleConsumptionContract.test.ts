import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { recordFoulBattedBall } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { originalFoulRuleFixture, advanceOriginalFoulFieldExecution, type FoulRuleScenario } from './ActualFoulRuleFixtures.test-support';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { nativeSettledFoulInputArchiveBytes } from './NativeSettledFoulPhysicalFixtures.test-support';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Fixture = ReturnType<typeof originalFoulRuleFixture>;
const table = 'actual_foul_rule_consumptions', scenarios = ['ordinary_0', 'ordinary_2', 'bunt_2', 'legacy_2'] as const;
const fixtures = new Map<FoulRuleScenario, Fixture>();
let directory: string, unconsumed: Fixture | undefined, producerOnly: Fixture | undefined;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-rule-contract-'));
  for (const scenario of scenarios) fixtures.set(scenario, originalFoulRuleFixture(join(directory, scenario + '.sqlite'), scenario));
  unconsumed = originalFoulRuleFixture(join(directory, 'unconsumed.sqlite'), 'ordinary_0');
  producerOnly = originalFoulRuleFixture(join(directory, 'producer-only.sqlite'), 'ordinary_0', true);
}, 240_000);
afterAll(() => { for (const x of fixtures.values()) x.f.close(); unconsumed?.f.close(); producerOnly?.f.close();
  if (directory) rmSync(directory, { recursive: true, force: true }); });
const x = () => fixtures.get('ordinary_2')!;
const consume = (f = x()) => f.store.accept(f.source.sourceId);
const read = (f = x()) => actualFoulRuleConsumptionEvidenceFromSqlite(f.f.db);
const admissions = (f = x()) => f.f.db.prepare('SELECT * FROM actual_live_play_admissions ORDER BY sequence').all();
const unrelatedBytes = (f: Fixture) => json(f.f.db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' ORDER BY name").all()
  .filter(r => ![table, 'actual_live_play_admissions'].includes(String(r.name)))
  .map(r => ({ table: r.name, rows: f.f.db.prepare('SELECT * FROM main."' + String(r.name).replaceAll('"', '""') + '"').all() })));
const writeState = (f: Fixture) => ({
  consumers: f.f.db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(table)
    ? json(f.f.db.prepare('SELECT * FROM main.' + table + ' ORDER BY source_id').all()) : null,
  admissions: json(admissions(f)), unrelated: unrelatedBytes(f),
});
const expectFrozen = (value: unknown): void => {
  if (value && typeof value === 'object') { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(expectFrozen); }
};

it.each(scenarios)('owns the exact original foul count disposition for %s without applying a physical or official reset', scenario => {
  const f = fixtures.get(scenario)!, before = unrelatedBytes(f), journal = admissions(f), result = consume(f);
  const original = f.physical.result.pitch.resolution.timeline, stop = f.production;
  expect(result.source).toEqual(f.source); expect(result.revision).toBe(1); expect(result.history).toEqual([f.source]);
  expect(result.gameId).toBe(f.physical.frame.gameId); expect(result.playId).toBe(original.playId);
  expect(result.firstPhysicalPitchSourceId).toBe(f.prefix[0].source.sourceId);
  expect(result.physicalPitchSourceId).toBe(f.physical.source.sourceId); expect(result.scopeId).toBe(f.runtime.membership.scopeId);
  expect(result.runtimeReference).toEqual({ owner: 'actual_live_play_runtimes', sourceId: f.runtime.source.sourceId, snapshotHash: hash(f.runtime) });
  expect(result.producerReference).toEqual({ owner: 'actual_settled_foul_stop_productions', sourceId: stop.source.sourceId, snapshotHash: hash(stop) });
  expect(result.countEvidence).toEqual(f.countEvidence); expect(result.countEvidence.basis).toEqual(stop.basis);
  const ownershipKey = json(['actual_original_settled_foul_rule_consumption_v1', f.physical.source.sourceId, stop.successor.successorKey]);
  const receiptId = json(['actual_foul_rule_consumption_receipt_v1', ownershipKey, f.source.sourceId]);
  expect(result.ownershipKey).toBe(ownershipKey);
  expect(result.consumption).toEqual({ kind: 'settled_foul_rule_consumption', status: 'consumed', receiptId,
    eventKey: stop.event.eventKey, successorKey: stop.successor.successorKey, occurredAt: stop.event.occurredAt,
    eventAvailableAt: stop.event.availableAt, availableAt: stop.event.availableAt, proofScope: 'one_original_untouched_foul_rule_consumer' });
  if (scenario === 'legacy_2') expect(result.disposition).toEqual({ kind: 'pending_original_intent', timeline: null });
  else {
    const expected = recordFoulBattedBall(original, stop.event.occurredAt.tick, scenario === 'bunt_2', null);
    expect(result.disposition).toEqual({ kind: scenario === 'bunt_2' ? 'terminal_strikeout' : 'continue_same_pa', timeline: expected });
    expect(expected.playId).toBe(original.playId); expect(expected.events.slice(0, -1)).toEqual(original.events);
    expect(expected.events.at(-1)).toMatchObject({ kind: 'FoulBattedBallResolved', tick: stop.event.occurredAt.tick, sequence: original.nextSequence });
    expect(expected.status).toEqual(scenario === 'bunt_2' ? { kind: 'strikeout', terminalCount: { balls: 0, strikes: 3 } }
      : { kind: 'active', count: { balls: 0, strikes: scenario === 'ordinary_0' ? 1 : 2 } });
  }
  expect(result.successor).toEqual({ kind: 'settled_foul_disposition', status: 'pending', basisReceiptId: receiptId,
    successorKey: json(['actual_foul_disposition_successor_v1', receiptId]), pendingReason: scenario === 'legacy_2'
      ? 'original_batting_intent_missing' : scenario === 'bunt_2' ? 'physical_end_and_terminal_official_closure_unowned'
        : 'physical_end_and_official_continuation_unowned' });
  expect(admissions(f).slice(0, -1)).toEqual(journal);
  expect(admissions(f).at(-1)).toMatchObject({ owner: table, source_id: f.source.sourceId, source_hash: hash(f.source), snapshot_hash: hash(result) });
  expect(unrelatedBytes(f)).toBe(before); expect(f.inputArchiveBytes()).toBe(f.beforePhysicalBytes);
  expect(JSON.stringify(f.f.official.getMatch('game-1'))).toBe(f.originalMatchBytes);
  expect(f.pitches.readAcceptedPitch(f.physical.source.sourceId)!.result.pitch.resolution.timeline).toEqual(original);
  expect(original.status.kind).toBe('batted_ball_pending');
  for (const key of ['physicalEnd', 'playEnd', 'officialClosure', 'resumeReceipt', 'nextPitchAdmission', 'workloadCharge']) expect(result).not.toHaveProperty(key);
  const frozenBytes = json(result), after = writeState(f); expectFrozen(result);
  expect(Reflect.set(result, 'physicalPitchSourceId', 'mutated')).toBe(false);
  expect(Reflect.set(result.disposition, 'kind', 'mutated')).toBe(false);
  if (result.disposition.timeline) {
    const timeline = result.disposition.timeline, event = timeline.events.at(-1)!;
    expect(Reflect.set(timeline.status, 'kind', 'mutated')).toBe(false);
    expect(Reflect.set(event.payload, 'contactTick', -1)).toBe(false);
    expect(() => Reflect.apply(Array.prototype.push, timeline.events, [event])).toThrow(TypeError);
  }
  expect(json(result)).toBe(frozenBytes); expect(read(f).read(result.source.sourceId)).toEqual(result);
  expect(consume(f)).toEqual(result); expect(writeState(f)).toEqual(after);
});
it('retries the same consumer Source without a second count event or admission', () => {
  const first = consume(), before = admissions(), changes = x().f.db.prepare('SELECT total_changes() AS n').get()!.n;
  expect(consume()).toEqual(first); expect(read().read(first.source.sourceId)).toEqual(first);
  expect(admissions()).toEqual(before); expect(x().f.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
});
it('rejects an alias consumer for the same original rule successor', () => {
  consume(); const f = x(), before = admissions(), alias = { ...f.source, sourceId: 'alias-consumer' };
  f.sources.set(alias.sourceId, alias); expect(() => f.store.accept(alias.sourceId)).toThrow(); expect(admissions()).toEqual(before);
});
it('overlays one owned consumption while keeping disposition and global generation pending', () => {
  const result = consume(), census = read().census(x().query);
  expect(census.acceptedConsumptions).toEqual([result]);
  expect(census.successors.find(s => s.original.successorKey === x().production.successor.successorKey)?.consumption).toEqual(result.consumption);
  expect(census.producer.successors.at(-1)!.status).toBe('pending');
  expect(census.dispositionSuccessors).toEqual([result.successor]);
  expect(census.consumerCoverage).toBe('original_foul_consumer_claims_complete'); expect(census.futureConsumptionSourceIds).toEqual([]);
  expect(census.generation).toBe('event_generation_coverage_pending');
  expect(census.physicalEnd).toBeNull(); expect(census.officialClosure).toBeNull(); expect(census.samePaResume).toBeNull();
});
it('rejects every caller-supplied result field without writes before accepting the valid Source', () => {
  const f = unconsumed!;
  for (const field of ['countResult', 'buntAttempt', 'resolutionTick', 'availableAt', 'composedTimeline', 'producers'] as const) {
    const sourceId = 'injected-' + field, before = writeState(f);
    f.sources.set(sourceId, { ...f.source, sourceId, [field]: true } as never);
    expect(() => f.store.accept(sourceId)).toThrow(); expect(writeState(f)).toEqual(before);
  }
  expect(consume(f).source).toEqual(f.source);
});
it('rejects foreign references without writes before accepting the valid Source', () => {
  const f = originalFoulRuleFixture(join(directory, 'foreign-references.sqlite'), 'ordinary_0');
  try {
    for (const field of ['runtimeSourceId', 'stopProductionSourceId'] as const) {
      const sourceId = 'foreign-' + field, before = writeState(f);
      f.sources.set(sourceId, { ...f.source, sourceId, [field]: 'foreign' });
      expect(() => f.store.accept(sourceId)).toThrow(); expect(writeState(f)).toEqual(before);
    }
    expect(consume(f).source).toEqual(f.source);
  } finally { f.f.close(); }
});
it('rejects count admission under the unchanged producer-only capability', () => {
  const before = writeState(producerOnly!);
  expect(() => producerOnly!.store.accept(producerOnly!.source.sourceId)).toThrow();
  expect(writeState(producerOnly!)).toEqual(before);
  expect(producerOnly!.producer.read(producerOnly!.production.source.sourceId)).toEqual(producerOnly!.production);
});
it.each(['sourceVersion', 'stopProductionSourceId'] as const)('rejects a changed same-ID %s without changing the saved consumption', field => {
  const f = x(), result = consume(), before = writeState(f);
  f.sources.set(f.source.sourceId, { ...f.source, [field]: 'changed-' + field });
  try { expect(() => consume(f)).toThrow(/frozen|different/); expect(writeState(f)).toEqual(before); }
  finally { f.sources.set(f.source.sourceId, f.source); }
  expect(read(f).read(f.source.sourceId)).toEqual(result); expect(consume(f)).toEqual(result); expect(writeState(f)).toEqual(before);
});
it('keeps future count payload opaque at an earlier cut while reconciling original consumer identity', () => {
  const result = consume(), f = x(), row = f.f.db.prepare('SELECT snapshot_json FROM ' + table + ' WHERE source_id=?').get(result.source.sourceId)!;
  const changed = JSON.parse(String(row.snapshot_json)); changed.disposition.timeline = 'future-count-payload';
  f.f.db.exec('BEGIN');
  try {
    f.f.db.prepare('UPDATE ' + table + ' SET snapshot_json=? WHERE source_id=?').run(json(changed), result.source.sourceId);
    const early = read().census({ ...f.query, cut: { kind: 'original_pitch' } });
    expect(early.acceptedConsumptions).toEqual([]); expect(early.futureConsumptionSourceIds).toEqual([result.source.sourceId]);
    expect(() => read().census(f.query)).toThrow(); expect(() => read().read(result.source.sourceId)).toThrow();
  } finally { f.f.db.exec('ROLLBACK'); }
});
it.each(['source', 'history', 'producerReference'] as const)('rejects hidden %s identity corruption even before the consumed event cut', field => {
  const result = consume(), f = x(), changed = JSON.parse(json(result));
  if (field === 'source') changed.source.stopProductionSourceId = 'foreign';
  else if (field === 'history') changed.history[0].stopProductionSourceId = 'foreign';
  else changed.producerReference.sourceId = 'foreign';
  f.f.db.exec('BEGIN');
  try { f.f.db.prepare('UPDATE ' + table + ' SET snapshot_json=? WHERE source_id=?').run(json(changed), result.source.sourceId);
    expect(() => read().census({ ...f.query, cut: { kind: 'original_pitch' } })).toThrow(); }
  finally { f.f.db.exec('ROLLBACK'); }
});
it.each(['raw_source', 'snapshot_source', 'raw_source_duplicate_escaped', 'history', 'history_object',
  'history_duplicate_escaped', 'producer_reference', 'producer_reference_duplicate_escaped',
  'count_basis_pitch', 'count_intent_pitch', 'count_policy', 'count_field_cut', 'count_intent_duplicate_escaped'] as const)(
  'discovers a foreign-indexed second consumer with a raw %s target claim', kind => {
    const result = consume(), f = x(), originalState = writeState(f);
    const originalRow = f.f.db.prepare('SELECT * FROM main.' + table + ' WHERE source_id=?').get(result.source.sourceId)!;
    const foreignValue = (value: unknown): unknown => typeof value === 'string' ? 'foreign:' + value
      : Array.isArray(value) ? value.map(foreignValue) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, foreignValue(item)])) : value;
    const source = { ...f.source, sourceId: 'foreign-consumer', runtimeSourceId: 'foreign-runtime', stopProductionSourceId: 'foreign-stop' };
    const snapshot = JSON.parse(json(foreignValue(result)));
    snapshot.source = source; snapshot.history = [source]; snapshot.gameId = 'foreign-game'; snapshot.playId = 999;
    snapshot.physicalPitchSourceId = 'foreign-pitch'; snapshot.firstPhysicalPitchSourceId = 'foreign-first-pitch'; snapshot.scopeId = 'foreign-scope';
    snapshot.ownershipKey = json(['actual_original_settled_foul_rule_consumption_v1', 'foreign-pitch', 'foreign-successor']);
    const row = { ...originalRow };
    for (const key of Object.keys(row)) {
      if (key.endsWith('_id') || key.endsWith('_key')) row[key] = 'foreign-' + key;
    }
    Object.assign(row, { source_id: source.sourceId, physical_pitch_source_id: snapshot.physicalPitchSourceId,
      runtime_source_id: source.runtimeSourceId, stop_production_source_id: source.stopProductionSourceId,
      first_physical_pitch_source_id: snapshot.firstPhysicalPitchSourceId, scope_id: snapshot.scopeId,
      game_id: snapshot.gameId, play_id: snapshot.playId, ownership_key: snapshot.ownershipKey, consumed_successor_key: 'foreign-successor',
      source_json: json(source), source_hash: hash(source), snapshot_json: json(snapshot), snapshot_hash: hash(snapshot) });
    const keys = Object.keys(row), early = { ...f.query, cut: { kind: 'original_pitch' as const } };
    const baseline = read(f).census(early);
    const duplicate = (object: unknown, escapedKey: string, target: string) => '{"' + escapedKey + '":' + json(target) + ',' + json(object).slice(1);
    const replaceObject = (document: string, name: string, original: unknown, replacement: string) => {
      const before = json(name) + ':' + json(original); expect(document).toContain(before);
      return document.replace(before, json(name) + ':' + replacement);
    };
    f.f.db.exec('BEGIN');
    try {
      f.f.db.prepare('INSERT INTO main.' + table + '(' + keys.map(key => '"' + key.replaceAll('"', '""') + '"').join(',')
        + ') VALUES(' + keys.map(() => '?').join(',') + ')').run(...keys.map(key => row[key]));
      // A fully unrelated opaque row alone cannot be mistaken for the target.
      expect(read(f).read(result.source.sourceId)).toEqual(result); expect(read(f).census(early)).toEqual(baseline);
      let sourceJson = json(source), snapshotJson = json(snapshot);
      if (kind === 'raw_source') sourceJson = json({ ...source, stopProductionSourceId: f.production.source.sourceId });
      else if (kind === 'snapshot_source') { snapshot.source = { ...source, stopProductionSourceId: f.production.source.sourceId }; snapshotJson = json(snapshot); }
      else if (kind === 'raw_source_duplicate_escaped') sourceJson = duplicate(source, 'stopProductionSource\\u0049d', f.production.source.sourceId);
      else if (kind === 'history') { snapshot.history = [{ ...source, stopProductionSourceId: f.production.source.sourceId }]; snapshotJson = json(snapshot); }
      else if (kind === 'history_object') { snapshot.history = { stopProductionSourceId: f.production.source.sourceId }; snapshotJson = json(snapshot); }
      else if (kind === 'history_duplicate_escaped') snapshotJson = replaceObject(snapshotJson, 'history', [source],
        '[' + duplicate(source, 'stopProductionSource\\u0049d', f.production.source.sourceId) + ']');
      else if (kind === 'producer_reference') { snapshot.producerReference.sourceId = f.production.source.sourceId; snapshotJson = json(snapshot); }
      else if (kind === 'producer_reference_duplicate_escaped') snapshotJson = replaceObject(snapshotJson, 'producerReference', snapshot.producerReference,
        duplicate(snapshot.producerReference, 'source\\u0049d', f.production.source.sourceId));
      else if (kind === 'count_basis_pitch') { snapshot.countEvidence.basis.physicalPitchSourceId = f.physical.source.sourceId; snapshotJson = json(snapshot); }
      else if (kind === 'count_intent_pitch') { snapshot.countEvidence.battingIntent.physicalPitch.sourceId = f.physical.source.sourceId; snapshotJson = json(snapshot); }
      else if (kind === 'count_policy') { snapshot.countEvidence.basis.policyReference.sourceId = f.production.source.policySourceId; snapshotJson = json(snapshot); }
      else if (kind === 'count_field_cut') { snapshot.countEvidence.basis.physicalCut.baseFieldSourceId = f.production.source.baseFieldSourceId; snapshotJson = json(snapshot); }
      else snapshotJson = replaceObject(snapshotJson, 'physicalPitch', snapshot.countEvidence.battingIntent.physicalPitch,
        duplicate(snapshot.countEvidence.battingIntent.physicalPitch, 'source\\u0049d', f.physical.source.sourceId));
      f.f.db.prepare('UPDATE main.' + table + ' SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?')
        .run(sourceJson, createHash('sha256').update(sourceJson).digest('hex'), snapshotJson,
          createHash('sha256').update(snapshotJson).digest('hex'), source.sourceId);
      const before = writeState(f);
      expect(() => read(f).census(early)).toThrow(); expect(() => read(f).read(result.source.sourceId)).toThrow();
      expect(writeState(f)).toEqual(before);
    } finally { f.f.db.exec('ROLLBACK'); }
    expect(writeState(f)).toEqual(originalState);
  });
it('preserves the caller transaction, query-only state and authorizer', () => {
  consume(); const f = x(), expected = read().census(f.query), before = admissions();
  f.f.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
  f.f.db.exec('BEGIN; PRAGMA query_only=ON');
  try { expect(read().census(f.query)).toEqual(expected); expect(f.f.db.isTransaction).toBe(true);
    expect(f.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(() => f.f.db.prepare('DELETE FROM main.' + table)).toThrow(/authorized/i); expect(admissions()).toEqual(before); }
  finally { f.f.db.exec('ROLLBACK; PRAGMA query_only=OFF'); f.f.db.setAuthorizer(null); }
});
it('requires main-only authority even after a valid consumption exists', () => {
  consume(); const f = x(); f.f.db.exec('CREATE TEMP TABLE ' + table + '(source_id TEXT)');
  try { expect(() => read().census(f.query)).toThrow(); }
  finally { f.f.db.exec('DROP TABLE temp.' + table); }
});
it('rejects an original consumer whose admission has disappeared even at an earlier cut', () => {
  const result = consume(), f = x(); f.f.db.exec('BEGIN');
  try { f.f.db.prepare('DELETE FROM main.actual_live_play_admissions WHERE owner=? AND source_id=?').run(table, result.source.sourceId);
    expect(() => read().census({ ...f.query, cut: { kind: 'original_pitch' } })).toThrow(); }
  finally { f.f.db.exec('ROLLBACK'); }
});
it('rejects first consumption of an earlier stop after genuinely admitted later execution without writes', () => {
  const f = originalFoulRuleFixture(join(directory, 'stale-first-write.sqlite'), 'ordinary_0');
  try {
    const journal = admissions(f), later = advanceOriginalFoulFieldExecution(f);
    expect(later.executions.read(later.source.sourceId)).toEqual(later.value);
    expect(admissions(f).slice(0, -1)).toEqual(journal);
    expect(admissions(f).at(-1)).toMatchObject({ owner: 'batted_world_field_executions', source_id: later.source.sourceId });
    const before = writeState(f);
    expect(() => consume(f)).toThrow(); expect(writeState(f)).toEqual(before); expect(f.store.read(f.source.sourceId)).toBeNull();
  } finally { f.f.close(); }
}, 120_000);
it('preserves historical consumption reads and identical retry after genuinely admitted later execution', () => {
  const f = originalFoulRuleFixture(join(directory, 'historical-retry.sqlite'), 'ordinary_0');
  try {
    const result = consume(f), originalView = read(f).census(f.query), later = advanceOriginalFoulFieldExecution(f);
    expect(later.executions.read(later.source.sourceId)).toEqual(later.value);
    expect(admissions(f).at(-1)).toMatchObject({ owner: 'batted_world_field_executions', source_id: later.source.sourceId });
    const before = writeState(f);
    expect(read(f).read(f.source.sourceId)).toEqual(result); expect(read(f).census(f.query)).toEqual(originalView);
    expect(read(f).census({ ...f.query, cut: { ...f.query.cut, kind: 'field_execution',
      baseFieldSourceId: f.foul.last.source.sourceId, executionSourceId: later.source.sourceId } }).acceptedConsumptions).toEqual([result]);
    expect(consume(f)).toEqual(result); expect(writeState(f)).toEqual(before);
  } finally { f.f.close(); }
}, 120_000);
it('rolls back an unrelated Match write triggered by count-consumer insertion', () => {
  const f = originalFoulRuleFixture(join(directory, 'rollback.sqlite'), 'ordinary_0');
  try {
    expect(f.store.read(f.source.sourceId)).toBeNull(); const before = unrelatedBytes(f), journal = admissions(f);
    f.f.db.exec('CREATE TRIGGER mutate_foul_count_match AFTER INSERT ON ' + table
      + " BEGIN UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id='game-1'; END");
    try { expect(() => f.store.accept(f.source.sourceId)).toThrow(); expect(unrelatedBytes(f)).toBe(before); expect(admissions(f)).toEqual(journal);
      expect(f.f.db.prepare('SELECT count(*) AS n FROM ' + table).get()!.n).toBe(0); }
    finally { f.f.db.exec('DROP TRIGGER mutate_foul_count_match'); }
  } finally { f.f.close(); }
}, 120_000);
it('rejects a concurrent producer mutation during consumer Source capture without a receipt or admission', () => {
  const f = originalFoulRuleFixture(join(directory, 'concurrent.sqlite'), 'ordinary_0');
  let writer: InstanceType<typeof DatabaseSync> | undefined;
  try {
    expect(f.store.read(f.source.sourceId)).toBeNull(); const journal = admissions(f);
    writer = new DatabaseSync(f.f.path);
    const old = writer.prepare('SELECT snapshot_hash FROM actual_settled_foul_stop_productions WHERE source_id=?').get(f.production.source.sourceId)!;
    const get = f.sources.get.bind(f.sources); let changed = false;
    f.sources.get = sourceId => { if (!changed) { changed = true;
      writer!.prepare('UPDATE actual_settled_foul_stop_productions SET snapshot_hash=? WHERE source_id=?').run('peer-corruption', f.production.source.sourceId); }
      return get(sourceId); };
    try { expect(() => f.store.accept(f.source.sourceId)).toThrow(); expect(changed).toBe(true);
      expect(f.f.db.prepare('SELECT count(*) AS n FROM ' + table).get()!.n).toBe(0); expect(admissions(f)).toEqual(journal); }
    finally { writer.prepare('UPDATE actual_settled_foul_stop_productions SET snapshot_hash=? WHERE source_id=?').run(old.snapshot_hash!, f.production.source.sourceId); }
  } finally { writer?.close(); f.f.close(); }
}, 120_000);
it('does not admit another pitch or submit the raw pending pitch as a terminal official closure', () => {
  for (const scenario of ['ordinary_2', 'bunt_2'] as const) {
    const f = fixtures.get(scenario)!, consumed = consume(f), before = writeState(f);
    const bytes = f.inputArchiveBytes(), journal = admissions(f);
    expect(consumed.disposition.kind).toBe(scenario === 'bunt_2' ? 'terminal_strikeout' : 'continue_same_pa');
    expect(f.pitches.readAcceptedPitch(f.physical.source.sourceId)!.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
    expect(() => f.pitch(f.physical.progressRevision, f.production.event.availableAt.tick)).toThrow();
    expect(writeState(f)).toEqual(before);
    const closure = f.closeInput(f.production.event.availableAt.tick, f.physical.source.sourceId);
    f.closes.set(closure.sourceId, closure);
    let rejection: unknown;
    try { f.closure.submit(closure.sourceId); } catch (error) { rejection = error; }
    // The real non-live proposal validates completed physical workload before
    // its later terminal-status branch. The immutable raw pitch is still pending.
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe('physical pitch workload requires a completed canonical play');
    expect((rejection as Error).stack).toContain('PhysicalNonLiveClosure.ts');
    expect((rejection as Error).stack).toContain('PhysicalPlayClosureEvidenceFromSqlite.ts');
    expect(f.closure.read(closure.sourceId)).toBeNull(); expect(writeState(f)).toEqual(before);
    expect(f.inputArchiveBytes()).toBe(bytes); expect(admissions(f)).toEqual(journal);
    expect(JSON.stringify(f.f.official.getMatch('game-1'))).toBe(f.originalMatchBytes);
  }
});
it('reopens the same composed count and pending consumer view after all original handles close', () => {
  const f = x(), result = consume(f), census = read(f).census(f.query), bytes = f.inputArchiveBytes(), query = f.query, path = f.f.path;
  f.f.close(); fixtures.delete('ordinary_2'); expect(() => f.f.db.prepare('SELECT 1').get()).toThrow();
  const db = new DatabaseSync(path, { readOnly: true });
  try { const reopened = actualFoulRuleConsumptionEvidenceFromSqlite(db);
    expect(reopened.read(result.source.sourceId)).toEqual(result); expect(reopened.census(query)).toEqual(census);
    expect(nativeSettledFoulInputArchiveBytes(db)).toBe(bytes); }
  finally { db.close(); }
});
