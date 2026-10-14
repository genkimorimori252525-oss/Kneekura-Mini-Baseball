import { expect, it } from 'vitest';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { openSqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';
import { openSqlitePlayerHealthRehabStore, type AcceptedHealthRehabEffect } from './SqlitePlayerHealthRehabStore';
import { healthRehabDiagnosis } from './HealthRehabFixtures.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

const fixture = (rehab = true) => {
  const x = physicalPlateAppearanceActorFixture(undefined, undefined, undefined, rehab ? ['p2'] : []), f = x.f;
  const snapshots = f.track(openSqliteNationalRosterSnapshotStore(f.path, { roster: f.roster }));
  const snapshot = snapshots.capture('career-a', 'club-a');
  const effects = new Map<string, AcceptedHealthRehabEffect>();
  const sources = { personLinks: f.links, workload: f.workload, participation: f.participation, rosterSnapshots: snapshots, roster: f.roster };
  const authority = { readAcceptedDiagnosis: () => healthRehabDiagnosis, readAcceptedEffect: (id: string) => effects.get(id) ?? null };
  const health = f.track(openSqlitePlayerHealthRehabStore(f.path, sources, authority));
  health.initialize('injury-1');
  for (const [sourceEventId, atDay, detail, kind, revision] of [
    ['medical', 3, { kind: 'RECOVERY', durationHours: 4, quality: 1, medicalAvailability: 1 }, 'MEDICAL_RECOVERY', 0],
    ['practice', 4, { kind: 'PRACTICE', effortUnits: 2, healthAvailability: 1 }, 'REHAB_PRACTICE', 1],
  ] as const) {
    f.activities.set(sourceEventId, { sourceEventId, sourceVersion: 'fixture-v1', evidenceId: `actual-${sourceEventId}`,
      careerId: 'career-a', playerId: 'p2', atDay, ...detail });
    f.workload.apply(sourceEventId, revision);
    effects.set(sourceEventId, { sourceId: sourceEventId, sourceVersion: 'fixture-v1', caseId: 'injury-1', kind,
      clinicalRecordId: `clinical-${sourceEventId}`, workloadActivityId: sourceEventId });
    health.apply(sourceEventId, revision);
  }
  x.actors.accept(x.source.sourceId);
  let tick = 0;
  for (let i = 0; i < 3; i++) {
    const source = continuousPitchAction(f, i, tick);
    x.actions.set(source.sourceId, { ...source, request: { ...source.request, workloadRevision: 2 } });
    tick = x.pitches.accept(source.sourceId, i).result.pitch.resolution.timeline.lastEventTick;
  }
  const close = x.closeInput(tick); x.closes.set(close.sourceId, close); x.closure.submit(close.sourceId);
  const receipt = f.participation.confirmPhysicalPlayed('game-1', 'p2', close.sourceId);
  effects.set('game', { sourceId: 'game', sourceVersion: 'fixture-v1', caseId: 'injury-1', kind: 'REHAB_GAME',
    participationReceiptId: receipt.receiptId, rosterSnapshotId: snapshot.snapshotId });
  return { x, f, health, sources, authority, receipt };
};

it('connects an original physical appearance to the eligible rehab game requirement exactly once after reopen', () => {
  const { f, health, sources, receipt } = fixture();
  try {
    const ready = health.apply('game', 2);
    expect(ready).toMatchObject({ phase: 'READY', revision: 3, rehabGameIds: ['game-1'] });
    expect(health.readEffect('game')!.proof).toMatchObject({ receipt });
    const before = f.db.prepare('SELECT * FROM world_health_rehab_effects ORDER BY source_id').all();
    const reopened = f.track(openSqlitePlayerHealthRehabStore(f.path, sources));
    expect(reopened.apply('game', 2)).toEqual(ready);
    expect(reopened.readHead('career-a', 'p2')).toEqual(ready);
    expect(f.db.prepare('SELECT * FROM world_health_rehab_effects ORDER BY source_id').all()).toEqual(before);
  } finally { f.close(); }
});

it('requires the original REHAB roster status for a supported tagged appearance', () => {
  const { f, health } = fixture(false);
  try {
    expect(() => health.apply('game', 2)).toThrow('REHAB roster');
    expect(health.readEffect('game')).toBeNull();
    expect(health.readHead('career-a', 'p2')!.revision).toBe(2);
  } finally { f.close(); }
});

it('reauthenticates original physical closure after the clinical INSERT and rolls back a writer-local mutation', () => {
  const { x, f, health } = fixture();
  try {
    const mutation = witnessSqliteWrite(/INSERT INTO world_health_rehab_effects/, db => {
      db.prepare("UPDATE physical_play_closures SET proposal_hash='changed' WHERE source_id='close-1'").run(); return true;
    });
    try { expect(() => health.apply('game', 2)).toThrow(); expect(mutation.wasReached()).toBe(true); }
    finally { mutation.close(); }
    expect(health.readEffect('game')).toBeNull();
    expect(x.closure.read('close-1')!.status).toBe('COMPLETED');
    expect(health.apply('game', 2).phase).toBe('READY');
  } finally { f.close(); }
});
