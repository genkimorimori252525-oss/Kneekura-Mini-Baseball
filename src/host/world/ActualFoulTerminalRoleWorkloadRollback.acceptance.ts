import { createRequire } from 'node:module';
import { prepareTerminalWorkloadReadyCopy } from './ActualFoulTerminalRoleWorkloadCheckpoint.test-support';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect, it } from 'vitest';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { prepareTerminalWorkloadCopy, requireTerminalWorkload, acceptedTerminalWorkloadFixturePacket,
  assertFrozenParticipants, initializeTerminalWorkloadFixtureBaselines, cleanupTerminalWorkload, literal, type TerminalWorkloadStore,
  type TerminalWorkloadPlan } from './ActualFoulTerminalRoleWorkloadFixture.test-support';

type FrozenPlan = Exclude<TerminalWorkloadPlan, { kind: 'pending' }>;
/** Exact allowed delta for earlier individually committed charges. The target
 * failed charge, head CAS and trigger effects are all absent from this census. */
const chargedPrefix = (before: ReturnType<typeof rawCensus>, plan: FrozenPlan, count: number) => {
  const activities = before.find(owner => owner.table === 'world_player_workload_activities')!.rows;
  const max = Math.max(0, ...activities.map(row => Number(row.__ack_rowid)));
  const committed = plan.participants.slice(0, count);
  return before.map(owner => owner.table === 'world_player_workload_activities' ? { ...owner, rows: [
    ...activities, ...committed.map((p, i) => ({ __ack_rowid: max + i + 1,
      source_id: p.activity.sourceEventId, career_id: plan.careerId, player_id: p.playerId,
      before_revision: p.before.revision, after_revision: p.after.revision,
      source_json: json(p.activity), before_json: json(p.before), after_json: json(p.after) }))] }
    : owner.table === 'world_player_workload_heads' ? { ...owner, rows: owner.rows.map(row => {
      const p = committed.find(p => row.career_id === plan.careerId && row.player_id === p.playerId);
      return p ? { ...row, revision: p.after.revision, state_json: json(p.after) } : row;
    }) } : owner);
};

// Regression target: checking accepted/BEFORE evidence only before INSERT rather
// than on the writer connection after its real trigger effects.
for (const phase of ['assessment', 'freeze'] as const)
it(`W03 prerequisite ${phase} INSERT corruption rolls back the entire owned write`, async () => {
  const f = phase === 'freeze' ? await prepareTerminalWorkloadReadyCopy() : prepareTerminalWorkloadCopy();
  let store: TerminalWorkloadStore | undefined, writer: Database | undefined;
  let witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    const table = phase === 'assessment' ? 'actual_role_workload_assessments' : 'actual_role_workload_settlements';
    witness = witnessSqliteWrite(new RegExp('INSERT INTO (?:main\\.)?' + table + '\\b'), connection => {
      writer = connection;
      return connection.isTransaction && (phase === 'assessment'
        ? connection.prepare("SELECT 1 FROM actual_role_workload_assessments WHERE source_hash='corrupt-after-insert'").get() !== undefined
        : connection.prepare('SELECT revision FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
          .get(f.reference.careerId, f.actors[9].binding.playerId)!.revision === 999999);
    });
    store = api.open(f.path, f.links, packet.authority);
    // Assessment writes need no baseline; freeze uses the qualified ready copy.
    f.db.exec('CREATE TRIGGER terminal_workload_fault AFTER INSERT ON ' + table + ' BEGIN '
      + (phase === 'assessment' ? "UPDATE actual_role_workload_assessments SET source_hash='corrupt-after-insert' WHERE source_id=NEW.source_id;"
        : 'UPDATE world_player_workload_heads SET revision=999999 WHERE career_id=' + literal(f.reference.careerId)
          + ' AND player_id=' + literal(f.actors[9].binding.playerId) + ';') + ' END');
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    const action = () => phase === 'assessment' ? store!.acceptAssessments([...packet.assessments.keys()]) : store!.freeze(f.sourceId);
    expect(action).toThrow(); expect(witness.wasReached()).toBe(true); expect(writer!.isTransaction).toBe(false);
    expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
    f.db.exec('DROP TRIGGER terminal_workload_fault');
    expect(action).not.toThrow(); expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } finally { try { witness?.close(); } finally { cleanupTerminalWorkload(f, store); } }
}, 2_400_000);

// The optional global baseline guard must protect the actual global writer,
// including trigger effects before its baseline/head transaction commits.
for (const fault of ['original_end', 'baseline_policy'] as const)
it(`W07 baseline initialization rolls back writer INSERT corruption of ${fault}`, async () => {
  const f = prepareTerminalWorkloadCopy();
  let store: TerminalWorkloadStore | undefined, writer: Database | undefined;
  let witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    const source = [...packet.baselines.values()][0];
    expect(source, 'GENUINE_MISSING_BASELINE_PREREQUISITE_ABSENT').toBeDefined();
    if (!source) throw new Error('GENUINE_MISSING_BASELINE_PREREQUISITE_ABSENT');
    witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?world_player_workload_baselines\b/, connection => {
      writer = connection;
      return connection.isTransaction && (fault === 'original_end'
        ? connection.prepare('SELECT snapshot_hash FROM actual_foul_play_ends WHERE source_id=?')
          .get(f.reference.physicalEndReference.sourceId)!.snapshot_hash === 'corrupt-baseline-origin'
        : connection.prepare('SELECT policy_json FROM world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?')
          .get(source.careerId, source.policy.policyId, source.policy.version)!.policy_json === '{}');
    });
    store = api.open(f.path, f.links, packet.authority);
    const mutation = fault === 'original_end'
      ? "UPDATE actual_foul_play_ends SET snapshot_hash='corrupt-baseline-origin' WHERE source_id=" + literal(f.reference.physicalEndReference.sourceId) + ';'
      : "UPDATE world_player_workload_policies SET policy_json='{}' WHERE career_id=" + literal(source.careerId)
        + ' AND policy_id=' + literal(source.policy.policyId) + ' AND version=' + literal(source.policy.version) + ';';
    f.db.exec('CREATE TRIGGER terminal_baseline_fault AFTER INSERT ON world_player_workload_baselines WHEN NEW.source_id='
      + literal(source.sourceId) + ' BEGIN ' + mutation + ' END');
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.initializeBaseline(f.sourceId, source.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(writer!.isTransaction).toBe(false); expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
    f.db.exec('DROP TRIGGER terminal_baseline_fault');
    initializeTerminalWorkloadFixtureBaselines(f, store, { ...packet, baselines: new Map([[source.sourceId, source]]) });
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } finally { try { witness?.close(); } finally { cleanupTerminalWorkload(f, store); } }
}, 2_400_000);

// Regression target: single-pitcher settlement or authenticating only the charged
// actor, allowing a different required participant to change inside the write.
for (const chargeIndex of [0, 1, 9])
it(`W03 charge ${chargeIndex} rolls back another participant mutation and resumes its exact partial prefix`, async () => {
  const f = await prepareTerminalWorkloadReadyCopy();
  let store: TerminalWorkloadStore | undefined, writer: Database | undefined;
  let witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  let frozen: FrozenPlan | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    const other = f.actors[chargeIndex === 0 ? 1 : 0].binding.playerId;
    witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?world_player_workload_activities\b/, connection => {
      if (!frozen) return false;
      writer = connection;
      return connection.isTransaction && connection.prepare('SELECT revision FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
        .get(f.reference.careerId, other)!.revision === 999999;
    });
    store = api.open(f.path, f.links, packet.authority);
    frozen = assertFrozenParticipants(f, store.freeze(f.sourceId), packet);
    f.db.exec('CREATE TRIGGER terminal_workload_fault AFTER INSERT ON world_player_workload_activities WHEN NEW.source_id='
      + literal(frozen.participants[chargeIndex].activity.sourceEventId)
      + ' BEGIN UPDATE world_player_workload_heads SET revision=999999 WHERE career_id=' + literal(f.reference.careerId)
      + ' AND player_id=' + literal(other) + '; END');
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.settle(f.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(writer!.isTransaction).toBe(false); expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(rawCensus(f.db)).toEqual(chargedPrefix(before, frozen, chargeIndex)); expect(schemaCensus(f.db)).toEqual(schema);
    const partial = assertFrozenParticipants(f, store.readSettlement(f.sourceId), packet);
    expect(partial.kind).toBe('applying');
    expect(partial.participants.map(p => p.applied)).toEqual(frozen.participants.map((_p, i) => i < chargeIndex));
    f.db.exec('DROP TRIGGER terminal_workload_fault');
    store.close(); store = api.open(f.path, f.links);
    expect(store.readSettlement(f.sourceId)).toEqual(partial);
    const beforeResume = rawCensus(f.db), after = assertFrozenParticipants(f, store.settle(f.sourceId), packet);
    expect(after.kind).toBe('complete'); expect(after.participants.every(p => p.applied)).toBe(true);
    // Build expected end state from the pre-fault census after removing only its
    // schema trigger. No extra activity, recovery or charge alias is permitted.
    expect(rawCensus(f.db)).toEqual(chargedPrefix(before, frozen, 10));
    expect(beforeResume).toEqual(chargedPrefix(before, frozen, chargeIndex));
    const stable = rawCensus(f.db); expect(store.settle(f.sourceId)).toEqual(after); expect(rawCensus(f.db)).toEqual(stable);
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } finally { try { witness?.close(); } finally { cleanupTerminalWorkload(f, store); } }
}, 2_400_000);

it('W03 activity INSERT reauthenticates the original terminal receipt on its writer connection', async () => {
  const f = await prepareTerminalWorkloadReadyCopy();
  let store: TerminalWorkloadStore | undefined, witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  let writer: Database | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?world_player_workload_activities\b/, connection => {
      writer = connection;
      return connection.isTransaction && connection.prepare('SELECT request_hash FROM applications WHERE application_id=?')
        .get(f.saved.source.applicationId)!.request_hash === 'corrupt-during-charge';
    });
    store = api.open(f.path, f.links, packet.authority);
    store.freeze(f.sourceId);
    f.db.exec('CREATE TRIGGER terminal_workload_origin_fault AFTER INSERT ON world_player_workload_activities BEGIN '
      + "UPDATE applications SET request_hash='corrupt-during-charge' WHERE application_id=" + literal(f.saved.source.applicationId) + '; END');
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.settle(f.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(writer!.isTransaction).toBe(false); expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { try { witness?.close(); } finally { cleanupTerminalWorkload(f, store); } }
}, 2_400_000);

const sameDescriptor = (a: PropertyDescriptor | undefined, b: PropertyDescriptor) => a !== undefined
  && (['configurable', 'enumerable', 'value', 'writable', 'get', 'set'] as const).every(key => a[key] === b[key]);
// Regression target: reusing evidence computed before the global writer's actual
// transaction acquisition rather than authenticating the latest committed state.
it('W04 rejects a real peer commit immediately before the first charge acquires its transaction', async () => {
  const f = await prepareTerminalWorkloadReadyCopy();
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let store: TerminalWorkloadStore | undefined, witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  let committed = false, inserted = false, patched = false, writer: Database | undefined;
  let original: PropertyDescriptor | undefined, replacement: PropertyDescriptor | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?world_player_workload_activities\b/, () => { inserted = true; return true; });
    store = api.open(f.path, f.links, packet.authority);
    store.freeze(f.sourceId);
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    original = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec');
    if (!original || typeof original.value !== 'function') throw new Error('real SQLite exec descriptor missing');
    const exec = original.value as Database['exec'];
    replacement = { ...original, value: function(this: Database, sql: string) {
      if (!committed && sql === 'BEGIN IMMEDIATE') {
        committed = true; writer = this;
        f.db.prepare('UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id=?').run(f.reference.gameId);
        expect(f.db.isTransaction).toBe(false);
      }
      return Reflect.apply(exec, this, [sql]);
    } };
    Object.defineProperty(DatabaseSync.prototype, 'exec', replacement); patched = true;
    expect(() => store!.settle(f.sourceId)).toThrow(); expect(committed).toBe(true); expect(inserted).toBe(false);
    expect(writer!.isTransaction).toBe(false);
    expect(rawCensus(f.db)).toEqual(before.map(owner => owner.table === 'matches' ? { ...owner, rows: owner.rows.map(row =>
      row.match_id === f.reference.gameId ? { ...row, durable_revision: Number(row.durable_revision) + 1 } : row) } : owner));
    expect(schemaCensus(f.db)).toEqual(schema); expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } finally {
    try {
      if (patched) {
        if (!sameDescriptor(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec'), replacement!)) throw new Error('later SQLite exec interceptor preserved');
        Object.defineProperty(DatabaseSync.prototype, 'exec', original!);
      }
    } finally { try { witness?.close(); } finally { cleanupTerminalWorkload(f, store); } }
  }
}, 2_400_000);
