import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { AcceptedActualRoleWorkloadAssessment } from './ActualRoleWorkloadAssessment';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';

const closure = vi.hoisted(() => ({ value: null as unknown, onRead: null as ((db: DatabaseSync) => void) | null }));
// Supply only the expensive physical/official boundary. The role owner, its
// private connection, the separate Player owner, SQL writes and rollback are real.
// These controls cannot certify a genuine physical or official artifact.
vi.mock('./ActualLivePlayClosureEvidenceFromSqlite', () => ({
  actualLivePlayClosureEvidenceFromSqlite: (db: DatabaseSync) => ({ read: () => { closure.onRead?.(db); return closure.value; } }),
  assertActualLiveClosureStage: () => true, actualLiveClosureApplicationRows: () => [], assertPriorActualLiveClosureCompleted: () => {},
}));
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync: RealDatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const fixture = () => {
  closure.onRead = null;
  const directory = mkdtempSync(join(tmpdir(), 'role-accepted-read-')), path = join(directory, 'state.sqlite');
  const f = officialPitchWorkloadFixture(true, false, path, true);
  try {
    const bindings = f.db.prepare('SELECT binding_json FROM official_participant_bindings ORDER BY player_id LIMIT 10').all()
      .map(row => JSON.parse(String(row.binding_json)) as OfficialParticipantBinding);
    const actors = bindings.map(binding => ({ binding, person: f.links.readLink(binding.personLinkSourceId)! }));
    const physicalEndReference = { owner: 'actual_first_base_play_ends' as const, sourceId: 'end', sourceVersion: 'fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
    const wholeHistoryReference = { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' as const };
    closure.value = { officialApplied: true, proposal: { source: { sourceId: 'application-2' }, gameId: 'game-1', playId: f.secondInput.match.playId,
      application: f.secondInput, actors, physicalEndReference, wholeHistoryReference, controllerReset: { physicalEndReference } } };
    f.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT PRIMARY KEY)');
    const assessments = new Map<string, AcceptedActualRoleWorkloadAssessment>(), baselines = new Map<string, AcceptedPlayerWorkloadBaseline>();
    for (const actor of actors) {
      const playerId = actor.binding.playerId;
      assessments.set(`assessment:${playerId}`, { sourceId: `assessment:${playerId}`, sourceVersion: 'fixture', closureSourceId: 'application-2',
        physicalEndReference, wholeHistoryReference, participantReference: { playerId, bindingHash: hash(actor.binding), personHash: hash(actor.person) }, effortUnits: 1,
        provenance: { assessmentSourceId: `accepted:${playerId}`, assessmentVersion: 'fixture', calibrationSourceId: 'calibration', calibrationVersion: 'fixture' } });
      baselines.set(`baseline:${playerId}`, { sourceId: `baseline:${playerId}`, sourceVersion: 'fixture', personLinkSourceId: actor.binding.personLinkSourceId,
        careerId: actor.binding.careerId, playerId, createdAtDay: 1, fatigue: 0.1, recoveryCapacity: 0.5,
        policy: { policyId: 'fixture', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } });
    }
    let roleConnection: DatabaseSync | null = null;
    closure.onRead = db => { roleConnection ??= db; };
    const store = f.track(openSqliteActualRoleWorkloadStore(path, f.links, {
      readAcceptedAssessment: id => assessments.get(id) ?? null, readAcceptedBaseline: id => baselines.get(id) ?? null,
    }));
    for (const id of baselines.keys()) store.initializeBaseline(id);
    store.acceptAssessments([...assessments.keys()]);
    const plan = store.freeze('application-2');
    if (plan.kind !== 'applying' || !roleConnection) throw new Error('fixture requires a real frozen ten-player role owner');
    expect(plan.participants).toHaveLength(10);
    const role = roleConnection as DatabaseSync;
    expect(role).toBeInstanceOf(RealDatabaseSync); expect(role).not.toBe(f.db); expect(role.isTransaction).toBe(false);
    closure.onRead = null;
    return { f, store, role, plan, path,
      count: () => Number(f.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n),
      close() { closure.onRead = null; f.close(); rmSync(directory, { recursive: true, force: true }); } };
  } catch (error) { closure.onRead = null; f.close(); rmSync(directory, { recursive: true, force: true }); throw error; }
};

it('uses a fresh private read transaction for each accepted activity and closes it before every consumer guard', () => {
  const x = fixture();
  const roleReads: { transaction: boolean; activities: number }[] = [], consumerReads: { transaction: boolean; roleTransaction: boolean; activities: number }[] = [];
  closure.onRead = db => {
    const activities = Number(db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n);
    if (db === x.role) roleReads.push({ transaction: db.isTransaction, activities });
    else consumerReads.push({ transaction: db.isTransaction, roleTransaction: x.role.isTransaction, activities });
  };
  try {
    const complete = x.store.settle('application-2'); expect(complete.kind).toBe('complete'); expect(x.count()).toBe(10);
    // First/final role reads belong to freeze/readback; these ten are the actual accepted-activity callbacks.
    expect(roleReads).toHaveLength(12);
    expect(roleReads.slice(1, -1)).toEqual(Array.from({ length: 10 }, (_, activities) => ({ transaction: true, activities })));
    expect(consumerReads).toEqual(Array.from({ length: 10 }, (_, i) => [
      { transaction: true, roleTransaction: false, activities: i }, { transaction: true, roleTransaction: false, activities: i + 1 },
    ]).flat());
    roleReads.length = 0; consumerReads.length = 0;
    expect(x.store.settle('application-2')).toEqual(complete); expect(x.count()).toBe(10);
    expect(roleReads).toHaveLength(12);
    expect(roleReads.slice(1, -1)).toEqual(Array.from({ length: 10 }, () => ({ transaction: true, activities: 10 })));
    expect(consumerReads).toEqual(Array.from({ length: 10 }, () => ({ transaction: true, roleTransaction: false, activities: 10 })));
    expect(x.role.isTransaction).toBe(false);
  } finally { x.close(); }
});

it('rolls back a failed private read before the consumer rollback and remains usable for a fresh retry', () => {
  const x = fixture(); let consumer: DatabaseSync | undefined;
  closure.onRead = db => { if (db !== x.role) consumer = db; };
  let restore: { mockRestore(): void } | undefined;
  try {
    const complete = x.store.settle('application-2'); expect(consumer).toBeDefined();
    const failure = new Error('accepted-activity-read-failure'), rollbacks: { roleTransaction: boolean; consumerTransaction: boolean }[] = [];
    let roleReads = 0, callbackTransaction: boolean | undefined;
    closure.onRead = db => {
      if (db === x.role && ++roleReads === 2) { callbackTransaction = db.isTransaction; throw failure; }
    };
    const exec = x.role.exec.bind(x.role);
    restore = vi.spyOn(x.role, 'exec').mockImplementation(sql => {
      const result = exec(sql);
      if (sql === 'ROLLBACK') rollbacks.push({ roleTransaction: x.role.isTransaction, consumerTransaction: consumer!.isTransaction });
      return result;
    });
    let caught: unknown;
    try { x.store.settle('application-2'); } catch (error) { caught = error; }
    expect(caught).toBe(failure); expect(x.count()).toBe(10);
    expect(x.role.isTransaction).toBe(false); expect(consumer!.isTransaction).toBe(false);
    expect(callbackTransaction).toBe(true);
    expect(rollbacks).toEqual([{ roleTransaction: false, consumerTransaction: true }]);
    restore.mockRestore(); restore = undefined; closure.onRead = null;
    expect(x.store.settle('application-2')).toEqual(complete); expect(x.count()).toBe(10);
  } finally { restore?.mockRestore(); x.close(); }
});

it('rederives the consumer evidence after the private read and rolls back a changed assessment before INSERT', () => {
  const x = fixture(), first = x.plan.participants[0]; let changed = false;
  const before = x.f.db.prepare('SELECT source_hash FROM actual_role_workload_assessments WHERE source_id=?').get(first.assessmentSourceId)!;
  closure.onRead = db => {
    if (db !== x.role && !changed) {
      expect(db.isTransaction).toBe(true); expect(x.role.isTransaction).toBe(false); changed = true;
      db.prepare("UPDATE actual_role_workload_assessments SET source_hash='forged' WHERE source_id=?").run(first.assessmentSourceId);
    }
  };
  try {
    expect(() => x.store.settle('application-2')).toThrow(/assessment archive differs/);
    expect(changed).toBe(true); expect(x.count()).toBe(0); expect(x.role.isTransaction).toBe(false);
    expect(x.f.db.prepare('SELECT source_hash FROM actual_role_workload_assessments WHERE source_id=?').get(first.assessmentSourceId)).toEqual(before);
    closure.onRead = null;
    expect(x.store.settle('application-2').kind).toBe('complete'); expect(x.count()).toBe(10);
  } finally { x.close(); }
});

it('keeps the consumer write lock while the private callback reads and releases both transactions afterward', () => {
  const x = fixture(); let roleReads = 0, callbackTransaction: boolean | undefined, competingWrite: unknown;
  x.f.db.exec('PRAGMA busy_timeout=0');
  closure.onRead = db => {
    if (db === x.role && ++roleReads === 2) {
      callbackTransaction = db.isTransaction;
      try { x.f.db.prepare('UPDATE world_player_workload_heads SET revision=revision+100 WHERE player_id=?').run(x.plan.participants[0].playerId); }
      catch (error) { competingWrite = error; }
    }
  };
  try {
    expect(x.store.settle('application-2').kind).toBe('complete'); expect(x.count()).toBe(10);
    expect(competingWrite).toBeInstanceOf(Error); expect(String(competingWrite)).toMatch(/locked|busy/);
    expect(callbackTransaction).toBe(true); expect(x.role.isTransaction).toBe(false);
    x.f.db.exec('BEGIN IMMEDIATE'); expect(x.f.db.isTransaction).toBe(true); x.f.db.exec('ROLLBACK');
  } finally { if (x.f.db.isTransaction) x.f.db.exec('ROLLBACK'); x.close(); }
});
