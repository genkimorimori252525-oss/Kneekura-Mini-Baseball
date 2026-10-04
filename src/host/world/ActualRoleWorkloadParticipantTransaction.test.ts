import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { AcceptedActualRoleWorkloadAssessment } from './ActualRoleWorkloadAssessment';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
const closure = vi.hoisted(() => ({ value: null as unknown }));
// Only the unavailable closed-physical/official boundary is supplied. All ten
// assessments, frozen plans, state authentication, global writes and WAL are real.
// This is a transaction regression, not original-chain physical completion proof.
vi.mock('./ActualLivePlayClosureEvidenceFromSqlite', () => ({
  actualLivePlayClosureEvidenceFromSqlite: () => ({ read: () => closure.value }), assertActualLiveClosureStage: () => true,
  actualLiveClosureApplicationRows: () => [], assertPriorActualLiveClosureCompleted: () => {},
}));
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'role-participant-transaction-')), path = join(directory, 'state.sqlite');
  const f = officialPitchWorkloadFixture(true, false, path, true);
  const bindings = f.db.prepare('SELECT binding_json FROM official_participant_bindings ORDER BY player_id LIMIT 10').all()
    .map(row => JSON.parse(String(row.binding_json)) as OfficialParticipantBinding);
  const actors = bindings.map(binding => ({ binding, person: f.links.readLink(binding.personLinkSourceId)! }));
  const physicalEndReference = { owner: 'actual_first_base_play_ends' as const, sourceId: 'end', sourceVersion: 'fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
  const wholeHistoryReference = { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' as const };
  closure.value = { officialApplied: true, proposal: { source: { sourceId: 'application-2' }, gameId: 'game-1', playId: f.secondInput.match.playId,
    application: f.secondInput, actors, physicalEndReference, wholeHistoryReference, controllerReset: { physicalEndReference } } };
  f.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT PRIMARY KEY)');
  const assessments = new Map<string, AcceptedActualRoleWorkloadAssessment>(), baselines = new Map<string, AcceptedPlayerWorkloadBaseline>();
  for (const a of actors) {
    const playerId = a.binding.playerId;
    assessments.set(`assessment:${playerId}`, { sourceId: `assessment:${playerId}`, sourceVersion: 'fixture', closureSourceId: 'application-2',
      physicalEndReference, wholeHistoryReference, participantReference: { playerId, bindingHash: hash(a.binding), personHash: hash(a.person) }, effortUnits: 1,
      provenance: { assessmentSourceId: `accepted:${playerId}`, assessmentVersion: 'fixture', calibrationSourceId: 'calibration', calibrationVersion: 'fixture' } });
    baselines.set(`baseline:${playerId}`, { sourceId: `baseline:${playerId}`, sourceVersion: 'fixture', personLinkSourceId: a.binding.personLinkSourceId,
      careerId: a.binding.careerId, playerId, createdAtDay: 1, fatigue: 0.1, recoveryCapacity: 0.5,
      policy: { policyId: 'fixture', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } });
  }
  const store = f.track(openSqliteActualRoleWorkloadStore(path, f.links, {
    readAcceptedAssessment: id => assessments.get(id) ?? null, readAcceptedBaseline: id => baselines.get(id) ?? null,
  }));
  for (const id of baselines.keys()) store.initializeBaseline(id);
  store.acceptAssessments([...assessments.keys()]);
  const plan = store.freeze('application-2');
  if (plan.kind !== 'applying') throw new Error('fixture requires frozen unapplied participants');
  expect(plan.participants).toHaveLength(10);
  expect(f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
  expect(f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  return { f, path, directory, store, plan, count: () => Number(f.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n) };
};

it.each([0, 1, 9])('rolls back charge %i and another participant head corruption while retaining only earlier committed charges', chargeIndex => {
  const x = fixture(), charged = x.plan.participants[chargeIndex], other = x.plan.participants[chargeIndex === 0 ? 1 : 0];
  try {
    x.f.db.exec(`CREATE TRIGGER corrupt_other_required_head AFTER INSERT ON world_player_workload_activities
      WHEN NEW.source_id=${literal(charged.activity.sourceEventId)} BEGIN
      UPDATE world_player_workload_heads SET revision=revision+100 WHERE player_id=${literal(other.playerId)}; END;`);
    expect(() => x.store.settle('application-2')).toThrow(/current|head|corrupt/);
    expect(x.count()).toBe(chargeIndex);
    expect(x.f.db.prepare('SELECT revision FROM world_player_workload_heads WHERE player_id=?').get(other.playerId)!.revision).toBe(chargeIndex === 0 ? 0 : 1);
    expect(x.f.db.prepare('SELECT source_id FROM world_player_workload_activities WHERE source_id=?').get(charged.activity.sourceEventId)).toBeUndefined();
    x.f.db.exec('DROP TRIGGER corrupt_other_required_head');
    const complete = x.store.settle('application-2'); expect(complete.kind).toBe('complete'); expect(x.count()).toBe(10);
    expect(x.store.settle('application-2')).toEqual(complete); expect(x.count()).toBe(10);
  } finally { x.f.close(); rmSync(x.directory, { recursive: true, force: true }); }
});

it('rejects a changed unapplied current head before any participant charge is committed', () => {
  const x = fixture(), other = x.plan.participants[1];
  try {
    x.f.db.prepare('UPDATE world_player_workload_heads SET revision=100 WHERE player_id=?').run(other.playerId);
    expect(() => x.store.settle('application-2')).toThrow(/current|head|corrupt/); expect(x.count()).toBe(0);
  } finally { x.f.close(); rmSync(x.directory, { recursive: true, force: true }); }
});

it('rejects even a valid-looking additional activity on another participant inside the charged transaction', () => {
  const x = fixture(), first = x.plan.participants[0], charged = x.plan.participants[1];
  const recovery = { sourceEventId: 'injected-recovery', sourceVersion: 'fixture', evidenceId: 'fixture-recovery', careerId: x.plan.careerId,
    playerId: first.playerId, kind: 'RECOVERY' as const, atDay: x.plan.gameDay, durationHours: 1, quality: 1, medicalAvailability: 1 };
  const after = advancePlayerWorkloadRecovery(first.after, first.after.revision, recovery);
  try {
    x.f.db.exec(`CREATE TRIGGER change_other_history AFTER INSERT ON world_player_workload_activities WHEN NEW.source_id=${literal(charged.activity.sourceEventId)} BEGIN
      INSERT INTO world_player_workload_activities VALUES (${literal(recovery.sourceEventId)},${literal(x.plan.careerId)},${literal(first.playerId)},
        ${first.after.revision},${after.revision},${literal(json(recovery))},${literal(json(first.after))},${literal(json(after))});
      UPDATE world_player_workload_heads SET revision=${after.revision},state_json=${literal(json(after))} WHERE player_id=${literal(first.playerId)}; END;`);
    expect(() => x.store.settle('application-2')).toThrow(/participant|current|head/);
    expect(x.count()).toBe(1);
    expect(x.f.db.prepare('SELECT revision FROM world_player_workload_heads WHERE player_id=?').get(first.playerId)!.revision).toBe(first.after.revision);
    expect(x.f.db.prepare('SELECT source_id FROM world_player_workload_activities WHERE source_id=?').get(recovery.sourceEventId)).toBeUndefined();
  } finally { x.f.close(); rmSync(x.directory, { recursive: true, force: true }); }
});

it('resumes a legitimate partial settlement after separately accepted recovery and preserves complete historical replay after close/reopen', () => {
  const x = fixture(), first = x.plan.participants[0], blocked = x.plan.participants[1];
  const recovery = { sourceEventId: 'accepted-later-recovery', sourceVersion: 'fixture', evidenceId: 'independent-fixture-recovery', careerId: x.plan.careerId,
    playerId: first.playerId, kind: 'RECOVERY' as const, atDay: x.plan.gameDay, durationHours: 1, quality: 1, medicalAvailability: 1 };
  let completed: ReturnType<typeof x.store.settle> | undefined;
  try {
    x.f.db.exec(`CREATE TRIGGER interrupt_settlement BEFORE INSERT ON world_player_workload_activities WHEN NEW.source_id=${literal(blocked.activity.sourceEventId)}
      BEGIN SELECT RAISE(ABORT,'fixture interruption'); END;`);
    expect(() => x.store.settle('application-2')).toThrow(/fixture interruption/); expect(x.count()).toBe(1);
    x.f.db.exec('DROP TRIGGER interrupt_settlement');
    const global = x.f.track(openSqlitePlayerWorkloadRecoveryStore(x.path, x.f.links, { readAcceptedBaseline: () => null, readAcceptedActivity: id => id === recovery.sourceEventId ? recovery : null }));
    expect(global.apply(recovery.sourceEventId, first.after.revision).revision).toBe(2);
    completed = x.store.settle('application-2'); expect(completed.kind).toBe('complete'); expect(x.count()).toBe(11);
    expect(x.store.readSettlement('application-2')).toEqual(completed); expect(x.store.settle('application-2')).toEqual(completed);
  } finally { x.f.close(); }
  const links = openSqlitePlayerPersonLinkStore(x.path), reopened = openSqliteActualRoleWorkloadStore(x.path, links), db = new DatabaseSync(x.path);
  try {
    expect(reopened.readSettlement('application-2')).toEqual(completed); expect(reopened.settle('application-2')).toEqual(completed);
    expect(Number(db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n)).toBe(11);
    expect(db.prepare('SELECT revision FROM world_player_workload_heads WHERE player_id=?').get(first.playerId)!.revision).toBe(2);
    db.prepare('UPDATE world_player_workload_heads SET revision=100 WHERE player_id=?').run(blocked.playerId);
    expect(reopened.readSettlement('application-2')).toEqual(completed);
    expect(() => reopened.settle('application-2')).toThrow(/current|head|corrupt/);
  } finally { db.close(); reopened.close(); links.close(); rmSync(x.directory, { recursive: true, force: true }); }
});
