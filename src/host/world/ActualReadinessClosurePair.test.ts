import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { AcceptedActualRoleWorkloadAssessment } from './ActualRoleWorkloadAssessment';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';

const closed = vi.hoisted(() => ({ value: null as unknown, calls: 0, hook: null as ((db: DatabaseSync) => void) | null }));
// Replace only the expensive physical/official boundary with explicit fixture
// evidence. Settlement archives, ten real MATCH effects, heads, WAL connections
// and read guards remain real. This cannot certify an actual physical artifact.
vi.mock('./ActualLivePlayClosureEvidenceFromSqlite', () => ({
  actualLivePlayClosureEvidenceFromSqlite: (db: DatabaseSync) => ({ read: () => {
    closed.calls++; closed.hook?.(db); return structuredClone(closed.value);
  } }),
  assertActualLiveClosureStage: () => true, actualLiveClosureApplicationRows: () => [], assertPriorActualLiveClosureCompleted: () => {},
}));
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { actualRoleWorkloadEvidenceFromSqlite } from './ActualRoleWorkloadEvidenceFromSqlite';
import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import { deriveOfficialPlayResult } from '../SqliteOfficialStateStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync: RealDatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const fixture = (walkoff = false) => {
  closed.hook = null; closed.calls = 0;
  const directory = mkdtempSync(join(tmpdir(), 'actual-readiness-pair-')), path = join(directory, 'state.sqlite');
  const cleanups: (() => void)[] = [() => rmSync(directory, { recursive: true, force: true })];
  const close = () => {
    closed.hook = null; const errors: unknown[] = [];
    while (cleanups.length) { try { cleanups.pop()!(); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(errors, 'readiness-pair fixture cleanup failed');
  };
  try {
    const f = officialPitchWorkloadFixture(true, false, path, true);
    cleanups.push(() => { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); });
    const bindings = f.db.prepare('SELECT binding_json FROM official_participant_bindings ORDER BY player_id LIMIT 10').all()
      .map(row => JSON.parse(String(row.binding_json)) as OfficialParticipantBinding);
    const actors = bindings.map(binding => ({ binding, person: f.links.readLink(binding.personLinkSourceId)! }));
    const physicalEndReference = { owner: 'actual_first_base_play_ends' as const, sourceId: 'end', sourceVersion: 'fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
    const wholeHistoryReference = { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' as const };
    const originalApplication = structuredClone(f.secondInput), originalExpected = structuredClone(deriveOfficialPlayResult(originalApplication, 2));
    const application = walkoff ? { ...originalApplication,
      match: { ...originalApplication.match, half: 'bottom' as const, score: { home: 0, away: 0 } } } : originalApplication;
    const expectedOfficial = walkoff ? { ...originalExpected, receipt: { ...originalExpected.receipt,
      appliedMatchState: { ...originalExpected.receipt.appliedMatchState, score: { home: 1, away: 0 } } } } : originalExpected;
    const proposal = { source: { sourceId: 'application-2' }, gameId: 'game-1', playId: application.match.playId,
      application, actors, physicalEndReference, wholeHistoryReference, controllerReset: { physicalEndReference }, expectedOfficial };
    closed.value = { officialApplied: true, result: {}, proposal };
    f.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT PRIMARY KEY); CREATE TABLE readiness_pair_probe(value INTEGER NOT NULL); INSERT INTO readiness_pair_probe VALUES(0)');
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
    const role = f.track(openSqliteActualRoleWorkloadStore(path, f.links, {
      readAcceptedAssessment: id => assessments.get(id) ?? null, readAcceptedBaseline: id => baselines.get(id) ?? null,
    }));
    for (const id of baselines.keys()) role.initializeBaseline(id);
    role.acceptAssessments([...assessments.keys()]); const complete = role.settle('application-2');
    if (complete.kind !== 'complete' || complete.participants.length !== 10) throw new Error('fixture requires ten real completed role effects');
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n).toBe(10);
    const peer = new RealDatabaseSync(path); cleanups.push(() => peer.close());
    peer.exec('PRAGMA busy_timeout=0'); closed.calls = 0;
    return { f, peer, complete, proposal,
      ready: actualLivePlayReadinessFromSqlite(f.db), role: actualRoleWorkloadEvidenceFromSqlite(f.db),
      transaction<T>(body: () => T) {
        f.db.exec('BEGIN'); try { const value = body(); f.db.exec('COMMIT'); return value; }
        catch (error) { if (f.db.isTransaction) f.db.exec('ROLLBACK'); throw error; }
      },
      close };
  } catch (error) {
    try { close(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'readiness-pair fixture setup failed', { cause: error }); }
    throw error;
  }
};

it('authenticates one closure per real transactional readiness operation with identical public bytes', () => {
  const x = fixture();
  try {
    const original = x.ready.read('application-2'); expect(original.kind).toBe('ready'); expect(closed.calls).toBe(2);
    closed.calls = 0;
    const current = x.transaction(() => x.ready.read('application-2'));
    expect(json(current)).toBe(json(original)); expect(closed.calls).toBe(1);
  } finally { x.close(); }
});

it('authenticates freshly for independent paired calls and new transactions', () => {
  const x = fixture();
  try {
    const first = x.transaction(() => {
      const a = x.role.readWithClosure('application-2', () => true), b = x.role.readWithClosure('application-2', () => true);
      expect(json(a)).toBe(json(b)); return a;
    });
    expect(closed.calls).toBe(2); closed.calls = 0;
    expect(json(x.transaction(() => x.role.readWithClosure('application-2', () => true)))).toBe(json(first));
    expect(closed.calls).toBe(1);
  } finally { x.close(); }
});

it('retains two fresh reads for nontransactional and proxy readiness', () => {
  const x = fixture();
  try {
    const original = x.ready.read('application-2'); expect(closed.calls).toBe(2); closed.calls = 0;
    const proxy = { prepare: x.f.db.prepare.bind(x.f.db) };
    expect(json(x.transaction(() => actualLivePlayReadinessFromSqlite(proxy).read('application-2')))).toBe(json(original));
    expect(closed.calls).toBe(2);
  } finally { x.close(); }
});

it('returns official-pending before touching a corrupted settlement archive', () => {
  const x = fixture();
  try {
    closed.value = { ...(closed.value as object), officialApplied: false, result: null };
    x.f.db.exec("UPDATE actual_role_workload_settlements SET plan_json='corrupt'");
    expect(x.transaction(() => x.ready.read('application-2'))).toEqual({ kind: 'pending', reason: 'official_application_pending', closureSourceId: 'application-2' });
    expect(closed.calls).toBe(1);
  } finally { x.close(); }
});

it('preserves current game-policy pending before settlement and historical readiness ordering', () => {
  const x = fixture(true);
  try {
    expect(x.transaction(() => x.ready.read('application-2'))).toEqual({ kind: 'pending', reason: 'game_policy_pending', closureSourceId: 'application-2' });
    expect(closed.calls).toBe(1);
    expect(x.transaction(() => x.ready.readHistorical('application-2')).kind).toBe('ready');
  } finally { x.close(); }
});

it('an explicit false gate returns only freshly authenticated closure before settlement access', () => {
  const x = fixture();
  try {
    x.f.db.exec("UPDATE actual_role_workload_settlements SET plan_json='corrupt'");
    const result = x.transaction(() => x.role.readWithClosure('application-2', closure => {
      expect(Object.isFrozen(closure)).toBe(true); return false;
    }));
    expect(result.settlement).toBeNull(); expect(closed.calls).toBe(1);
  } finally { x.close(); }
});

const invalidGates: [string, () => unknown][] = [
  ['undefined', () => undefined], ['null', () => null], ['zero', () => 0], ['one', () => 1], ['string', () => 'true'],
  ['object', () => ({})], ['Promise', () => Promise.resolve(true)], ['thenable', () => ({ then() {} })],
  ['throwing then getter', () => Object.defineProperty({}, 'then', { get() { throw new Error('then getter must not run'); } })],
];
for (const [name, value] of invalidGates) it(`rejects ${name} gate output before any settlement read`, () => {
  const x = fixture();
  try {
    expect(() => x.transaction(() => x.role.readWithClosure('application-2', () => value() as boolean)))
      .toThrow('readiness gate must return a synchronous boolean');
    expect(closed.calls).toBe(1); expect(x.f.db.isTransaction).toBe(false);
  } finally { x.close(); }
});

it('preserves an exact gate error and restores the enclosing guard without ending the caller transaction', () => {
  const x = fixture(), failure = new Error('readiness gate failure');
  try {
    x.f.db.exec('BEGIN'); let caught: unknown;
    try { x.role.readWithClosure('application-2', () => { throw failure; }); } catch (error) { caught = error; }
    expect(caught).toBe(failure); expect(x.f.db.isTransaction).toBe(true);
    expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(x.role.readWithClosure('application-2', () => true).settlement!.kind).toBe('complete');
    x.f.db.exec('ROLLBACK'); expect(x.f.db.isTransaction).toBe(false);
  } finally { x.close(); }
});

it('rejects a local write during the gate instead of reusing an earlier closure context', () => {
  const x = fixture();
  try {
    expect(() => x.transaction(() => x.role.readWithClosure('application-2', () => {
      x.f.db.exec('UPDATE readiness_pair_probe SET value=1'); return true;
    }))).toThrow();
    expect(x.f.db.prepare('SELECT value FROM readiness_pair_probe').get()!.value).toBe(0);
  } finally { x.close(); }
});

it('rejects rollback and rebegin during the gate and leaves later transactions usable', () => {
  const x = fixture();
  try {
    expect(() => x.transaction(() => x.role.readWithClosure('application-2', () => {
      x.f.db.exec('ROLLBACK; BEGIN'); return true;
    }))).toThrow();
    expect(x.f.db.isTransaction).toBe(false);
    expect(x.transaction(() => x.ready.read('application-2')).kind).toBe('ready');
  } finally { x.close(); }
});

it('holds the read snapshot through its gate and sees peer WAL data after ending the transaction', () => {
  const x = fixture();
  try {
    const observed: number[] = [];
    x.transaction(() => x.role.readWithClosure('application-2', () => {
      observed.push(Number(x.f.db.prepare('SELECT value FROM readiness_pair_probe').get()!.value));
      x.peer.exec('UPDATE readiness_pair_probe SET value=1');
      observed.push(Number(x.f.db.prepare('SELECT value FROM readiness_pair_probe').get()!.value)); return true;
    }));
    expect(observed).toEqual([0, 0]);
    expect(x.transaction(() => x.f.db.prepare('SELECT value FROM readiness_pair_probe').get()!.value)).toBe(1);
  } finally { x.close(); }
});
