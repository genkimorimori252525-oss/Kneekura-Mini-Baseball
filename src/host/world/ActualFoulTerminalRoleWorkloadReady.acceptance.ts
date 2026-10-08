import { prepareTerminalWorkloadReadyCopy } from './ActualFoulTerminalRoleWorkloadCheckpoint.test-support';
import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { assertNoActualRoleWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { readActualLivePhysicalActivation } from './ActualLivePhysicalActivation';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { requireTerminalWorkload, acceptedTerminalWorkloadFixturePacket,
  assertFrozenParticipants, cleanupTerminalWorkload, rows, workloadTables,
  observeTerminalWorkloadConnectionChanges,
  type TerminalWorkloadStore, type TerminalWorkloadFixture } from './ActualFoulTerminalRoleWorkloadFixture.test-support';

const assertTerminalStillPending = (f: TerminalWorkloadFixture) => {
  withSqliteReadTransaction(f.db, () => {
    expect(() => assertPriorPhysicalClosureCompleted(f.db, f.saved.source.applicationId)).toThrow(/terminal|pending/);
    expect(() => readActualLivePhysicalActivation(f.db, f.saved.proposal.gameId, f.saved.source.applicationId)).toThrow(/terminal|pending/);
  });
};

it('W10 qualified ready checkpoint charges ten participants once and preserves zero-write retry and reopen', async () => {
  const f = await prepareTerminalWorkloadReadyCopy();
  let store: TerminalWorkloadStore | undefined;
  let witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  let openAccounting: ReturnType<typeof observeTerminalWorkloadConnectionChanges> | undefined;
  let writeAccounting: ReturnType<typeof observeTerminalWorkloadConnectionChanges> | undefined;
  let reopenAccounting: ReturnType<typeof observeTerminalWorkloadConnectionChanges> | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    const original = rawCensus(f.db, workloadTables), schema = schemaCensus(f.db);
    const observed: { connection: Database }[] = [];
    witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?(actual_role_workload_assessments|actual_role_workload_settlements|world_player_workload_activities)\b/,
      connection => {
        expect(connection.isTransaction).toBe(true);
        observed.push({ connection });
        return true;
      });
    const beforeOpen = rawCensus(f.db);
    openAccounting = observeTerminalWorkloadConnectionChanges();
    store = api.open(f.path, f.links, packet.authority);
    expect(rawCensus(f.db)).toEqual(beforeOpen); expect(schemaCensus(f.db)).toEqual(schema);
    openAccounting.assertUnchanged(); openAccounting.close(); openAccounting = undefined;
    expect(rawCensus(f.db, workloadTables)).toEqual(original); expect(schemaCensus(f.db)).toEqual(schema);
    writeAccounting = observeTerminalWorkloadConnectionChanges();
    const before = rawCensus(f.db);
    const beforeSettlement = rows(f.db, 'actual_role_workload_settlements');
    const beforeActivities = rows(f.db, 'world_player_workload_activities'), beforeHeads = rows(f.db, 'world_player_workload_heads');
    const beforeStates = withSqliteReadTransaction(f.db, () => f.actors.map(a => readActualRoleWorkloadState(f.db,
      a.binding.careerId, a.binding.playerId, undefined, a.binding.personLinkSourceId)!));
    expect(beforeStates.every(Boolean)).toBe(true);
    const afterAcceptance = before, countAtFreeze = observed.length;
    const frozen = assertFrozenParticipants(f, store.freeze(f.sourceId), packet);
    expect(frozen.kind).toBe('applying'); expect(frozen.participants.every(p => !p.applied)).toBe(true);
    expect(frozen.participants.map(p => p.before)).toEqual(beforeStates);
    expect(observed.length - countAtFreeze).toBe(1);
    const savedPlan = { ...f.reference, kind: 'frozen', capturedAt: 'settlement_freeze',
      participants: frozen.participants.map(({ applied: _applied, ...p }) => p), assessmentHashes: frozen.assessmentHashes };
    const expectedSettlement = { __ack_rowid: Math.max(0, ...beforeSettlement.map(r => Number(r.__ack_rowid))) + 1,
      closure_source_id: f.sourceId, career_id: f.reference.careerId, game_id: f.reference.gameId, play_id: f.reference.playId,
      plan_json: json(savedPlan), plan_hash: hash(savedPlan) };
    expect(rawCensus(f.db)).toEqual(afterAcceptance.map(owner => owner.table === 'actual_role_workload_settlements'
      ? { ...owner, rows: [...beforeSettlement, expectedSettlement] } : owner));
    writeAccounting.assertChanges(1); writeAccounting.checkpoint();
    const afterFreeze = rawCensus(f.db), countAtSettle = observed.length;
    const complete = assertFrozenParticipants(f, store.settle(f.sourceId), packet);
    expect(complete.kind).toBe('complete'); expect(complete.participants.every(p => p.applied)).toBe(true);
    expect(complete).toEqual({ ...frozen, kind: 'complete', participants: frozen.participants.map(p => ({ ...p, applied: true })) });
    expect(observed.length - countAtSettle).toBe(10); expect(witness.wasReached()).toBe(true);
    const expectedActivities = complete.participants.map((p, i) => ({
      __ack_rowid: Math.max(0, ...beforeActivities.map(r => Number(r.__ack_rowid))) + i + 1,
      source_id: p.activity.sourceEventId, career_id: f.reference.careerId, player_id: p.playerId,
      before_revision: p.before.revision, after_revision: p.after.revision,
      source_json: json(p.activity), before_json: json(p.before), after_json: json(p.after) }));
    const afterHeads = beforeHeads.map(row => {
      const p = complete.participants.find(p => p.playerId === row.player_id && f.reference.careerId === row.career_id);
      return p ? { ...row, revision: p.after.revision, state_json: json(p.after) } : row;
    });
    const after = afterFreeze.map(owner => owner.table === 'world_player_workload_activities'
      ? { ...owner, rows: [...beforeActivities, ...expectedActivities] }
      : owner.table === 'world_player_workload_heads' ? { ...owner, rows: afterHeads } : owner);
    expect(rawCensus(f.db)).toEqual(after); expect(schemaCensus(f.db)).toEqual(schema);
    writeAccounting.assertChanges(20); writeAccounting.checkpoint();
    expect(rawCensus(f.db, workloadTables)).toEqual(original);
    for (const p of complete.participants) {
      expect(() => assertNoActualRoleWorkloadCharge(f.db, { ...f.reference, playerId: p.playerId })).toThrow(/workload.*charge/);
      expect(readActualRoleWorkloadState(f.db, f.reference.careerId, p.playerId)).toEqual(p.after);
    }
    assertTerminalStillPending(f);
    const changeCounters = [...new Set(observed.map(value => value.connection))].map(db => ({ db, n: db.prepare('SELECT total_changes() AS n').get()!.n }));
    const writes = observed.length;
    store.acceptAssessments([...packet.assessments.keys()]); expect(store.freeze(f.sourceId)).toEqual(complete);
    expect(store.readSettlement(f.sourceId)).toEqual(complete); expect(store.settle(f.sourceId)).toEqual(complete);
    expect(observed.length).toBe(writes);
    for (const counter of changeCounters) expect(counter.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(counter.n);
    expect(rawCensus(f.db)).toEqual(after); expect(schemaCensus(f.db)).toEqual(schema);
    writeAccounting.assertUnchanged(); writeAccounting.close(); writeAccounting = undefined;
    const legacy = openSqliteActualRoleWorkloadStore(f.path, f.links);
    try { expect(() => legacy.readSettlement(f.sourceId)).toThrow(/terminal|closure/); } finally { legacy.close(); }
    store.close(); store = undefined;
    for (const counter of changeCounters) expect(() => counter.db.prepare('SELECT 1')).toThrow();
    // Close every remaining test-owned DB handle before reopening durable bytes.
    f.links.close(); f.db.close();
    reopenAccounting = observeTerminalWorkloadConnectionChanges();
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    f.db = new DatabaseSync(f.path); f.links = openSqlitePlayerPersonLinkStore(f.path);
    // No authority callback: archived accepted inputs must authenticate replay.
    store = api.open(f.path, f.links);
    expect(store.readSettlement(f.sourceId)).toEqual(complete); expect(store.settle(f.sourceId)).toEqual(complete);
    expect(observed.length).toBe(writes); expect(rawCensus(f.db)).toEqual(after); expect(schemaCensus(f.db)).toEqual(schema);
    assertTerminalStillPending(f); expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
    reopenAccounting.assertUnchanged(); reopenAccounting.close(); reopenAccounting = undefined;
    const reopenedObserver = new DatabaseSync(f.path);
    try { expect(rawCensus(reopenedObserver)).toEqual(after); } finally { reopenedObserver.close(); }
  } finally { try { reopenAccounting?.close(); } finally { try { writeAccounting?.close(); } finally {
    try { openAccounting?.close(); } finally { try { witness?.close(); } finally { cleanupTerminalWorkload(f, store); } }
  } } }
}, 2_400_000);
