import { expect, it } from 'vitest';
import { healthRehabStoreFixture, healthRehabDiagnosis } from './HealthRehabFixtures.test-support';
import { openSqlitePlayerHealthRehabStore } from './SqlitePlayerHealthRehabStore';

it.each([
  "DELETE FROM world_player_person_links WHERE source_id='intake-p2'",
  "UPDATE world_health_rehab_cases SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id=NEW.source_id",
  "UPDATE world_health_rehab_cases SET case_ordinal=2 WHERE source_id=NEW.source_id",
  "DELETE FROM world_health_rehab_policies WHERE career_id='career-a'",
])('rolls back an original clinical case when a late WAL change alters accepted evidence: %s', (mutation) => {
  const { f, health } = healthRehabStoreFixture(false);
  try {
    f.db.exec(`CREATE TRIGGER alter_clinical_case AFTER INSERT ON world_health_rehab_case_heads BEGIN ${mutation.replaceAll('NEW.source_id', 'NEW.case_id')}; END`);
    expect(() => health.initialize('injury-1')).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_cases').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_case_heads').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_player_heads').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER alter_clinical_case'); expect(health.initialize('injury-1').initial.phase).toBe('INJURED');
  } finally { f.close(); }
});
it.each([
  "DELETE FROM world_player_person_links WHERE source_id='intake-p2'",
  "UPDATE world_player_workload_baselines SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='workload-p2'",
  "UPDATE world_player_workload_activities SET before_json=json_set(before_json,'$.recoveryCapacity',0.2) WHERE source_id='treatment'",
  "UPDATE world_health_rehab_cases SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='injury-1'",
  "UPDATE world_health_rehab_player_heads SET case_ordinal=99 WHERE player_id='p2'",
  "UPDATE world_health_rehab_effects SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id=NEW.source_id",
])('rolls back a clinical effect and head if actual original medical/Person facts change in WAL: %s', (mutation) => {
  const { f, health } = healthRehabStoreFixture();
  try {
    f.db.exec(`CREATE TRIGGER alter_clinical_effect AFTER INSERT ON world_health_rehab_effects BEGIN ${mutation}; END`);
    expect(() => health.apply('medical', 0)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_effects').get()).toEqual({ n: 0 });
    expect(health.readHead('career-a', 'p2')!.revision).toBe(0);
    f.db.exec('DROP TRIGGER alter_clinical_effect'); expect(health.apply('medical', 0).phase).toBe('REHAB');
  } finally { f.close(); }
});
it.each([
  "UPDATE official_participation_receipts SET receipt_json=json_set(receipt_json,'$.playedPlayId',999) WHERE player_id='p2'",
  "UPDATE official_participant_bindings SET binding_json=json_set(binding_json,'$.personId','other') WHERE player_id='p2'",
  "UPDATE world_national_roster_snapshots SET snapshot_json=json_set(snapshot_json,'$.revision',999) WHERE career_id='career-a'",
  "UPDATE applications SET result_json=json_set(result_json,'$.receipt.durableRevision',999) WHERE application_id='rehab-close'",
])('rejects changed real played rehabilitation proof and preserves the pre-game clinical head: %s', (mutation) => {
  const { f, health, prepareGame } = healthRehabStoreFixture();
  try {
    prepareGame(); f.db.exec(`CREATE TRIGGER alter_rehab_game AFTER INSERT ON world_health_rehab_effects WHEN NEW.source_id='game' BEGIN ${mutation}; END`);
    expect(() => health.apply('game', 2)).toThrow();
    expect(f.db.prepare("SELECT count(*) AS n FROM world_health_rehab_effects WHERE source_id='game'").get()).toEqual({ n: 0 });
    expect(health.readHead('career-a', 'p2')!.revision).toBe(2);
    f.db.exec('DROP TRIGGER alter_rehab_game'); expect(health.apply('game', 2).phase).toBe('READY');
  } finally { f.close(); }
});
it('rejects mixed Native workload reads before pinning a newly changed baseline as original medical evidence', () => {
  const { f, sources, authority } = healthRehabStoreFixture();
  try {
    const consumer = f.track(openSqlitePlayerHealthRehabStore(f.path, { ...sources, workload: { readActivity: (sourceId) => {
      const actual = f.workload.readActivity(sourceId);
      f.db.exec("UPDATE world_player_workload_baselines SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='workload-p2'");
      return actual;
    } } }, authority));
    expect(() => consumer.apply('medical', 0)).toThrow('Source changed');
    expect(f.db.prepare('SELECT count(*) AS n FROM world_health_rehab_effects').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rejects an issued return after recurrent injury and rolls back a late clinical change in the Roster transaction', () => {
  const { f, health, diagnoses, prepareGame } = healthRehabStoreFixture();
  try {
    prepareGame(); health.apply('game', 2);
    const binding = health.createAvailabilityAction({ careerId: 'career-a', clubId: 'club-a', caseId: 'injury-1', caseRevision: 3,
      actionId: 'return', expectedRosterRevision: 2, effectiveDay: 11 });
    const issued = f.applyAvailability(binding);
    f.db.exec("CREATE TRIGGER alter_return AFTER INSERT ON world_roster_executions BEGIN UPDATE world_health_rehab_case_heads SET revision=999 WHERE case_id='injury-1'; END");
    expect(() => issued.execute()).toThrow();
    expect(f.roster.readHead('career-a', 'club-a')!.roster.revision).toBe(2);
    expect(f.control.readHead('career-a')!.worldRevision).toBe(2);
    expect(f.db.prepare("SELECT count(*) AS n FROM world_roster_executions WHERE execution_id='execute-return'").get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER alter_return');
    const recurrent = { ...healthRehabDiagnosis, sourceId: 'injury-2', previousCaseId: 'injury-1', clinicalRecordId: 'recurrent-record',
      diagnosis: { ...healthRehabDiagnosis.diagnosis, caseId: 'injury-2', diagnosedAtDay: 12, injuryBurden: 0.9 } };
    diagnoses.set(recurrent.sourceId, recurrent); health.initialize(recurrent.sourceId);
    expect(() => issued.execute()).toThrow('current');
    expect(f.roster.readHead('career-a', 'club-a')!.roster.players.find((p) => p.playerId === 'p2')!.availability.status).toBe('REHAB');
  } finally { f.close(); }
});
