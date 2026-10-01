import { expect, it } from 'vitest';
import { healthRehabFixture } from './HealthRehabFixtures.test-support';
import { openSqlitePlayerHealthRehabStore, type AcceptedHealthDiagnosis, type AcceptedHealthRehabEffect } from './SqlitePlayerHealthRehabStore';

const diagnosis: AcceptedHealthDiagnosis = { sourceId: 'injury-1', sourceVersion: 'v1', clinicalRecordId: 'diagnosis-record', personLinkSourceId: 'intake-p2',
  previousCaseId: null, diagnosis: { caseId: 'injury-1', careerId: 'career-a', playerId: 'p2', diagnosedAtDay: 2, injuryBurden: 0.8,
    policy: { policyId: 'clinical-fixture', version: 'v1', availableAtDay: 1, medicalBurdenReductionPerHour: 0.2,
      rehabEntryMaximumBurden: 0.5, returnMaximumBurden: 0.1, practiceExposurePerEffortUnit: 1, minimumPracticeExposure: 1, minimumRehabGames: 1 } } };
it('actual Native medical dose -> practice -> played rehab receipt -> accepted availability preserves identities and historical cases', () => {
  const f = healthRehabFixture();
  try {
    const diagnoses = new Map([[diagnosis.sourceId, diagnosis]]), effects = new Map<string, AcceptedHealthRehabEffect>();
    const sources = { personLinks: f.links, workload: f.workload, participation: f.participation, rosterSnapshots: f.snapshots, roster: f.roster };
    const health = f.track(openSqlitePlayerHealthRehabStore(f.path, sources, { readAcceptedDiagnosis: (id) => diagnoses.get(id) ?? null,
      readAcceptedEffect: (id) => effects.get(id) ?? null }));
    const initial = health.initialize(diagnosis.sourceId);
    expect(initial.initial.phase).toBe('INJURED');
    const originalPlayer = f.roster.readHead('career-a', 'club-a')!.roster.players.find((p) => p.playerId === 'p2')!;
    f.applyAvailability(health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 0,
      actionId: 'injured', expectedRosterRevision: 0, effectiveDay: 2 })).execute();
    f.record('treatment', 3, { kind: 'RECOVERY', durationHours: 4, quality: 1, medicalAvailability: 1 });
    effects.set('medical', { sourceId: 'medical', sourceVersion: 'v1', caseId: 'injury-1', kind: 'MEDICAL_RECOVERY', clinicalRecordId: 'treatment-record', workloadActivityId: 'treatment' });
    expect(health.apply('medical', 0).phase).toBe('REHAB');
    f.applyAvailability(health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 1,
      actionId: 'rehab', expectedRosterRevision: 1, effectiveDay: 3 })).execute();
    f.record('rehab-practice', 4, { kind: 'PRACTICE', effortUnits: 2, healthAvailability: 1 });
    effects.set('practice', { sourceId: 'practice', sourceVersion: 'v1', caseId: 'injury-1', kind: 'REHAB_PRACTICE', clinicalRecordId: 'exercise-record', workloadActivityId: 'rehab-practice' });
    expect(health.apply('practice', 1).phase).toBe('REHAB');
    const { receipt, snapshot } = f.play();
    effects.set('game', { sourceId: 'game', sourceVersion: 'v1', caseId: 'injury-1', kind: 'REHAB_GAME', participationReceiptId: receipt.receiptId, rosterSnapshotId: snapshot.snapshotId });
    const ready = health.apply('game', 2);
    expect(ready.phase).toBe('READY'); expect(ready.rehabGameIds).toEqual(['rehab-game']);
    expect(health.apply('game', 2)).toEqual(ready);
    const binding = health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 3,
      actionId: 'return', expectedRosterRevision: 2, effectiveDay: 11 });
    const acceptedReturn = f.applyAvailability(binding); acceptedReturn.execute();
    const after = f.roster.readHead('career-a', 'club-a')!.roster.players.find((p) => p.playerId === 'p2')!;
    expect(after.availability.status).toBe('AVAILABLE'); expect(after.assignment).toEqual(originalPlayer.assignment);
    expect(after.clubRights).toEqual(originalPlayer.clubRights); expect(f.links.readLink('intake-p2')!.personId).toBe('person-p2');
    expect(snapshot.roster.players.find((p) => p.playerId === 'p2')!.availability.status).toBe('REHAB');
    const recurrent: AcceptedHealthDiagnosis = { ...diagnosis, sourceId: 'injury-2', previousCaseId: 'injury-1', clinicalRecordId: 'recurrent-record',
      diagnosis: { ...diagnosis.diagnosis, caseId: 'injury-2', diagnosedAtDay: 12, injuryBurden: 0.9 } };
    diagnoses.set(recurrent.sourceId, recurrent); health.initialize(recurrent.sourceId);
    expect(() => health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 3,
      actionId: 'stale-return', expectedRosterRevision: 3, effectiveDay: 12 })).toThrow('current');
    diagnoses.clear(); effects.clear();
    const reopened = f.track(openSqlitePlayerHealthRehabStore(f.path, sources));
    expect(reopened.readEffect('game')!.after).toEqual(ready); expect(reopened.initialize('injury-1')).toEqual(initial);
    expect(reopened.apply('medical', 0).injuryBurden).toBeCloseTo(0);
    expect(reopened.readHead('career-a', 'p2')!.caseId).toBe('injury-2');
  } finally { f.close(); }
});
