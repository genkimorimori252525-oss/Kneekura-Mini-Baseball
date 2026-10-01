import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteOfficialScoringStore } from '../SqliteOfficialScoringStore';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';

const source = { sourceId: 'initial-world', sourceVersion: 'fixture-v1', gameId: 'game-1', fixtureEventId: 'fixture-1',
  startedAtTick: 0, worldSetup: worldSetup('p2') };
const diskFixture = () => {
  const f = officialPitchWorkloadFixture(true, true);
  const path = join(mkdtempSync(join(tmpdir(), 'minibaseball-initial-world-')), 'world.db');
  f.db.exec(`VACUUM INTO '${path.replaceAll("'", "''")}'`);
  const official = f.track(new SqliteOfficialStateStore(path)), links = f.track(openSqlitePlayerPersonLinkStore(path));
  const participation = f.track(new SqliteOfficialParticipationStore(path, { ...f.authority, readPersonLink(playerId, sourceId) {
    const link = links.readLink(sourceId); return link?.playerId === playerId ? { personId: link.personId, sourceId: link.sourceId } : null;
  } }));
  const initial = f.track(openSqliteOfficialInitialWorldStore(path, { matches: official, participation }, { readAcceptedSetup: () => source }));
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = f.track(new DatabaseSync(path));
  expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
  return { f, path, db, official, participation, initial };
};

it.each([
  "DELETE FROM world_player_person_links WHERE source_id='intake-home-1'",
  "UPDATE world_player_person_links SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='intake-home-1'",
  `UPDATE matches SET activation_json='{"finalResult":{"gameId":"game-1","durableRevision":0,"awayRuns":0,"homeRuns":0}}' WHERE match_id='game-1'`,
])('rolls back late initial evidence changes in actual disk/WAL: %s', (mutation) => {
  const { f, db, official, initial } = diskFixture();
  try {
    const before = official.getMatch('game-1');
    db.exec(`CREATE TRIGGER alter_initial AFTER INSERT ON official_initial_world_sources BEGIN ${mutation}; END`);
    expect(() => initial.accept(source.sourceId)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM official_initial_world_sources').get()).toEqual({ n: 0 });
    expect(official.getMatch('game-1')).toEqual(before);
    db.exec('DROP TRIGGER alter_initial');
    expect(initial.accept(source.sourceId).personLinks).toHaveLength(9);
  } finally { f.close(); }
});

it.each([
  "UPDATE official_initial_world_sources SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='initial-world'",
  "DELETE FROM world_player_person_links WHERE source_id='intake-home-1'",
  "UPDATE world_player_person_links SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='intake-home-1'",
  "UPDATE official_participant_bindings SET binding_json=json_set(binding_json,'$.rosterRevision',999) WHERE player_id='home-1'",
  "UPDATE official_fixtures SET fixture_revision=999 WHERE game_id='game-1'",
  "UPDATE applications SET result_json=json_set(result_json,'$.receipt.durableRevision',999) WHERE application_id='application-1'",
  "UPDATE applications SET request_hash='changed' WHERE application_id='application-1'",
  "DELETE FROM official_scoring_applications WHERE scoring_application_id='scoring-1'",
  "UPDATE official_scoring_applications SET result_json=json_set(result_json,'$.closureId','changed') WHERE scoring_application_id='scoring-1'",
])('rolls back initial workload when original evidence changes in its own WAL transaction: %s', (mutation) => {
  const { f, path, db, official, participation, initial } = diskFixture();
  try {
    const accepted = initial.accept(source.sourceId);
    official.applyAndActivate(f.firstInput);
    const scoring = f.track(openSqliteOfficialScoringStore(path));
    scoring.apply({ scoringApplicationId: 'scoring-1', officialApplication: f.firstInput });
    const policy = { sourceId: 'effort', sourceVersion: 'fixture-v1', policyId: 'effort', version: 'v1', availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 };
    const producer = f.track(openSqliteOfficialPitchWorkloadStore(path, { scoring, participation, initialWorlds: initial }, { readAcceptedPolicy: () => policy }));
    const request = { scoringApplicationId: 'scoring-1', initialWorldSourceId: source.sourceId, policySourceId: 'effort' };
    db.exec(`CREATE TRIGGER alter_initial_from_workload AFTER INSERT ON official_pitch_workload_sources BEGIN ${mutation}; END`);
    expect(() => producer.accept(request)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM official_pitch_workload_policies').get()).toEqual({ n: 0 });
    expect(initial.readAcceptedSource(source.sourceId)).toEqual(accepted);
    db.exec('DROP TRIGGER alter_initial_from_workload');
    expect(producer.accept(request).effortUnits).toBe(6);
  } finally { f.close(); }
});

it('rejects revision-zero final evidence and Person provenance rewrites after initial acceptance', () => {
  const { f, db, initial } = diskFixture();
  try {
    initial.accept(source.sourceId);
    db.exec(`UPDATE matches SET activation_json='{"finalResult":{"gameId":"game-1","durableRevision":0,"awayRuns":0,"homeRuns":0}}' WHERE match_id='game-1'`);
    expect(() => initial.readAcceptedSource(source.sourceId)).toThrow('corrupt');
    db.exec("UPDATE matches SET activation_json=NULL WHERE match_id='game-1'");
    db.exec("UPDATE world_player_person_links SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='intake-home-1'");
    expect(() => initial.accept(source.sourceId)).toThrow('corrupt');
  } finally { f.close(); }
});
