import { expect, it } from 'vitest';
import { healthRehabDiagnosis, healthRehabStoreFixture } from './HealthRehabFixtures.test-support';
import type { AcceptedHealthRehabEffect } from './SqlitePlayerHealthRehabStore';

it('cannot duplicate actual medical dose or a played game through a new clinical Source ID', () => {
  const { f, health, effects, medical, prepareGame } = healthRehabStoreFixture();
  try {
    const { game } = prepareGame();
    effects.set('medical-alias', { ...medical, sourceId: 'medical-alias', clinicalRecordId: 'alias-record' });
    expect(() => health.apply('medical-alias', 2)).toThrow();
    expect(health.readHead('career-a', 'p2')!.revision).toBe(2);
    health.apply('game', 2);
    effects.set('game-alias', { ...game, sourceId: 'game-alias' });
    expect(() => health.apply('game-alias', 3)).toThrow();
    expect(health.readHead('career-a', 'p2')!.revision).toBe(3);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_effects').get()).toEqual({ n: 3 });
  } finally { f.close(); }
});

it.each(['missing', 'wrong-kind', 'caller-dose', 'wrong-case', 'stale-revision'] as const)(
  'rejects an invalid actual medical effect without advancing a clinical head: %s', (kind) => {
    const { f, health, effects, medical } = healthRehabStoreFixture();
    try {
      if (kind === 'missing') effects.set('medical', { ...medical, workloadActivityId: 'absent-activity' });
      if (kind === 'wrong-kind') effects.set('medical', { ...medical, kind: 'REHAB_PRACTICE' });
      if (kind === 'caller-dose') effects.set('medical', { ...medical, durationHours: 24 } as AcceptedHealthRehabEffect);
      if (kind === 'wrong-case') effects.set('medical', { ...medical, caseId: 'other-case' });
      expect(() => health.apply('medical', kind === 'stale-revision' ? 1 : 0)).toThrow();
      expect(health.readHead('career-a', 'p2')!.revision).toBe(0);
      expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_effects').get()).toEqual({ n: 0 });
    } finally { f.close(); }
  },
);

it('cannot apply an actual recovery that occurred before the accepted injury', () => {
  const { f, health, diagnoses } = healthRehabStoreFixture(false);
  try {
    diagnoses.set('injury-1', { ...healthRehabDiagnosis, diagnosis: { ...healthRehabDiagnosis.diagnosis, diagnosedAtDay: 4 } });
    health.initialize('injury-1');
    expect(() => health.apply('medical', 0)).toThrow();
    expect(health.readHead('career-a', 'p2')!.medicalRecoveryHours).toBe(0);
  } finally { f.close(); }
});

it.each(['missing-receipt', 'other-player', 'missing-snapshot', 'wrong-revision'] as const)(
  'requires actual played patient and the original pregame REHAB checkpoint: %s', (kind) => {
    const { f, health, effects, prepareGame } = healthRehabStoreFixture();
    try {
      const originalAvailable = f.snapshots.capture('career-a', 'club-a');
      const { game } = prepareGame();
      if (kind === 'missing-receipt') {
        expect(() => f.participation.confirmPlayed('rehab-game', 'unused', 'DEFENDER', 'rehab-activate', 'rehab-close')).toThrow();
        effects.set('game', { ...game, participationReceiptId: 'unused-is-not-played' });
      }
      if (kind === 'other-player') {
        const actualOther = f.participation.confirmPlayed('rehab-game', 'home-1', 'DEFENDER', 'rehab-activate', 'rehab-close');
        effects.set('game', { ...game, participationReceiptId: actualOther.receiptId });
      }
      if (kind === 'missing-snapshot') effects.set('game', { ...game, rosterSnapshotId: 'absent-snapshot' });
      if (kind === 'wrong-revision') effects.set('game', { ...game, rosterSnapshotId: originalAvailable.snapshotId });
      expect(() => health.apply('game', 2)).toThrow();
      expect(health.readHead('career-a', 'p2')!.revision).toBe(2);
      effects.set('game', game); expect(health.apply('game', 2).phase).toBe('READY');
    } finally { f.close(); }
  },
);

it('rejects altered live accepted Sources on retry while retaining the original historical result', () => {
  const { f, health, effects, diagnoses, medical } = healthRehabStoreFixture();
  try {
    const original = health.apply('medical', 0);
    effects.set('medical', { ...medical, sourceVersion: 'changed' });
    expect(() => health.apply('medical', 0)).toThrow('frozen differently');
    diagnoses.set('injury-1', { ...healthRehabDiagnosis, clinicalRecordId: 'changed' });
    expect(() => health.initialize('injury-1')).toThrow('frozen differently');
    effects.clear(); diagnoses.clear(); expect(health.apply('medical', 0)).toEqual(original);
    expect(() => health.apply('medical', 1)).toThrow('frozen differently');
  } finally { f.close(); }
});

it('a recurrent diagnosis cannot weaken the existing injury or replace a different current case', () => {
  const { f, health, diagnoses } = healthRehabStoreFixture();
  try {
    const recurrent = { ...healthRehabDiagnosis, sourceId: 'injury-2', previousCaseId: 'injury-1',
      diagnosis: { ...healthRehabDiagnosis.diagnosis, caseId: 'injury-2', diagnosedAtDay: 4, injuryBurden: 0.1 } };
    diagnoses.set('injury-2', recurrent); expect(() => health.initialize('injury-2')).toThrow();
    expect(health.readHead('career-a', 'p2')!.injuryBurden).toBe(0.8);
    diagnoses.set('injury-2', { ...recurrent, previousCaseId: null, diagnosis: { ...recurrent.diagnosis, injuryBurden: 0.9 } });
    expect(() => health.initialize('injury-2')).toThrow('predecessor');
    expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_cases').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});

it('does not resurrect an archived READY case when the Player pointer rolls back behind the latest accepted diagnosis', () => {
  const { f, health, diagnoses, prepareGame } = healthRehabStoreFixture();
  try {
    prepareGame(); const ready = health.apply('game', 2);
    diagnoses.set('injury-2', { ...healthRehabDiagnosis, sourceId: 'injury-2', previousCaseId: 'injury-1',
      diagnosis: { ...healthRehabDiagnosis.diagnosis, caseId: 'injury-2', diagnosedAtDay: 12, injuryBurden: 0.9 } });
    health.initialize('injury-2');
    f.db.exec("UPDATE world_health_rehab_player_heads SET case_id='injury-1', case_ordinal=1 WHERE player_id='p2'");
    expect(health.readEffect('game')!.after).toEqual(ready);
    expect(() => health.readHead('career-a', 'p2')).toThrow('current');
    expect(() => health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 3,
      actionId: 'stale-return', expectedRosterRevision: 2, effectiveDay: 12 })).toThrow('current');
  } finally { f.close(); }
});

it('rolls back a newly accepted injury if a late WAL change restores the Player pointer to the previous case', () => {
  const { f, health, diagnoses } = healthRehabStoreFixture();
  try {
    diagnoses.set('injury-2', { ...healthRehabDiagnosis, sourceId: 'injury-2', previousCaseId: 'injury-1',
      diagnosis: { ...healthRehabDiagnosis.diagnosis, caseId: 'injury-2', diagnosedAtDay: 4, injuryBurden: 0.9 } });
    f.db.exec("CREATE TRIGGER restore_old_case AFTER UPDATE ON world_health_rehab_player_heads BEGIN UPDATE world_health_rehab_player_heads SET case_id='injury-1', case_ordinal=1 WHERE player_id='p2'; END");
    expect(() => health.initialize('injury-2')).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_cases').get()).toEqual({ n: 1 });
    expect(health.readHead('career-a', 'p2')!.caseId).toBe('injury-1');
    f.db.exec('DROP TRIGGER restore_old_case'); expect(health.initialize('injury-2').caseOrdinal).toBe(2);
  } finally { f.close(); }
});

it('a normal Manager Roster action cannot bypass current clinical recovery by omitting its medical Source', () => {
  const { f, health } = healthRehabStoreFixture();
  try {
    f.applyAvailability(health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 0,
      actionId: 'injured', expectedRosterRevision: 0, effectiveDay: 2 })).execute();
    expect(() => f.applyAvailability({ actionId: 'return', command: { commandId: 'return', expectedRevision: 1, effectiveDay: 3,
      changes: [{ playerId: 'p2', availability: { status: 'AVAILABLE', evidenceId: 'manager-return' } }] } }).execute()).toThrow('medical Source');
    expect(f.roster.readHead('career-a', 'club-a')!.roster.players.find((p) => p.playerId === 'p2')!.availability.status).toBe('INJURED');
    expect(health.readHead('career-a', 'p2')!.injuryBurden).toBe(0.8);
  } finally { f.close(); }
});

it('rejects an ordinary availability action issued before a newly accepted injury at the actual Roster execution', () => {
  const { f, health } = healthRehabStoreFixture(false);
  try {
    const issued = f.applyAvailability({ actionId: 'return', command: { commandId: 'return', expectedRevision: 0, effectiveDay: 4,
      changes: [{ playerId: 'p2', availability: { status: 'AVAILABLE', evidenceId: 'manager-return' } }] } });
    health.initialize('injury-1');
    expect(() => issued.execute()).toThrow('medical Source');
    expect(f.roster.readHead('career-a', 'club-a')!.roster.revision).toBe(0);
    expect(f.control.readHead('career-a')!.worldRevision).toBe(0);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_roster_executions').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('retains an independent restriction owner without authorizing a later clinical return', () => {
  const { f, health } = healthRehabStoreFixture();
  try {
    f.applyAvailability({ actionId: 'injured', command: { commandId: 'injured', expectedRevision: 0, effectiveDay: 2,
      changes: [{ playerId: 'p2', availability: { status: 'UNAVAILABLE', evidenceId: 'accepted-nonmedical-restriction' } }] } }).execute();
    expect(f.roster.readHead('career-a', 'club-a')!.roster.players.find((p) => p.playerId === 'p2')!.availability.status).toBe('UNAVAILABLE');
    expect(health.readHead('career-a', 'p2')!.phase).toBe('INJURED');
    expect(() => f.applyAvailability({ actionId: 'return', command: { commandId: 'return', expectedRevision: 1, effectiveDay: 3,
      changes: [{ playerId: 'p2', availability: { status: 'AVAILABLE', evidenceId: 'restriction-ended' } }] } }).execute()).toThrow('medical Source');
  } finally { f.close(); }
});

it.each([
  "UPDATE world_health_rehab_effects SET record_json=json_set(record_json,'$.proof.workload.before.recoveryCapacity',0.2) WHERE source_id='medical'",
  "DELETE FROM world_health_rehab_cases WHERE source_id='injury-1'",
  "DELETE FROM world_health_rehab_player_heads WHERE player_id='p2'",
])('rejects corrupt or orphaned persisted clinical history: %s', (mutation) => {
  const { f, health } = healthRehabStoreFixture();
  try {
    health.apply('medical', 0); f.db.exec(mutation);
    expect(() => health.readHead('career-a', 'p2')).toThrow();
    if (!mutation.includes('player_heads')) expect(() => health.readEffect('medical')).toThrow();
  } finally { f.close(); }
});
