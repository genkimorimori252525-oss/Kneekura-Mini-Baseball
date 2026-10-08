import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { foulTerminalApplicationTableSql } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { foulTerminalApplicationClaims, type FoulTerminalApplicationScope } from './ActualFoulTerminalApplicationOwnership';
import { officialApplicationOwnershipClaims, officialMatchActivationClaims } from '../OfficialApplicationOwnershipFromSqlite';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { readActualLivePhysicalActivation } from './ActualLivePhysicalActivation';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let db: Database;
const scope: FoulTerminalApplicationScope = {
  official: { sourceId: 'session', gameId: 'game', playId: 7, physicalPitchSourceId: 'pitch', physicalEndSourceId: 'end',
    consumptionSourceId: 'count', officialObligationKey: 'official-child', originalSuccessorKey: 'successor' },
  applicationSourceId: 'terminal', applicationId: 'apply', closureId: 'terminal',
};
const pending = (applicationId = 'apply', matchId = 'game', previousPlayId = 7) => ({
  version: 'official_pending_post_play_v1', applicationId, matchId, previousPlayId, closureId: 'foreign-closure',
  durableRevision: 1, origin: { owner: 'foreign-owner', sourceId: 'foreign-source' } });
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER NOT NULL,state_json TEXT NOT NULL,activation_json TEXT);
    CREATE TABLE applications(application_id TEXT PRIMARY KEY,match_id TEXT,closure_id TEXT,request_hash TEXT,result_json TEXT);`);
  db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game', 0, '{}', null);
});
afterEach(() => db.close());
const insertTerminal = (result: string) => {
  db.exec(foulTerminalApplicationTableSql);
  db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    'foreign-source', 'foreign-game', 91, 'foreign-application', 'foreign-pitch', 'foreign-end', 'foreign-obligation',
    'OFFICIAL_APPLIED_PENDING_POST_PLAY', '{}', 'bad-source-hash', '{}', 'bad-proposal-hash', result);
};
const raw = (value: unknown, encoding: string): string => encoding === 'plain' ? JSON.stringify({ pendingPostPlay: value })
  : '{"pendingPostPlay":{},"pending\\u0050ostPlay":[' + JSON.stringify(value) + '],"pendingPostPlay":{}}';

it.each(['application', 'match', 'terminal'] as const)('M01 discovers a sole pending marker Match/play scope in %s with every indexed identity foreign', owner => {
  const marker = pending('foreign-application');
  if (owner === 'application') db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign-application', 'foreign-game', 'foreign-closure', 'bad', raw(marker, 'plain'));
  else if (owner === 'match') db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('foreign-game', 1, '{}', raw(marker, 'plain'));
  else insertTerminal(JSON.stringify({ official: { pendingPostPlay: marker } }));
  if (owner === 'terminal') expect(foulTerminalApplicationClaims(db, scope).map(row => row.source_id)).toEqual(['foreign-source']);
  else {
    const claims = officialApplicationOwnershipClaims(db, scope);
    expect(claims.some(claim => claim.table === (owner === 'match' ? 'matches' : 'applications')
      && claim.row.match_id === 'foreign-game')).toBe(true);
    if (owner === 'match') expect(officialMatchActivationClaims(db, db.prepare('SELECT * FROM matches WHERE match_id=?').get('foreign-game')!, scope)).toBe(true);
  }
});
it.each(['plain', 'duplicate_array'] as const)('M02 pending raw %s application blocks both next guards when no live owner exists', encoding => {
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign-application', 'foreign-game', 'foreign-closure', 'bad', raw(pending(), encoding));
  expect(() => assertPriorPhysicalClosureCompleted(db, 'apply')).toThrow(/terminal|pending/);
  expect(() => readActualLivePhysicalActivation(db, 'game', 'apply')).toThrow(/terminal|pending/);
});
it.each(['match', 'terminal'] as const)('M03 sole %s pending mirror blocks next admission after application mirror deletion', owner => {
  if (owner === 'match') db.prepare('UPDATE matches SET activation_json=?').run(raw(pending(), 'duplicate_array'));
  else insertTerminal(JSON.stringify({ official: { pendingPostPlay: pending() } }));
  expect(() => assertPriorPhysicalClosureCompleted(db, 'apply')).toThrow(/terminal|pending/);
  expect(() => readActualLivePhysicalActivation(db, 'game', 'apply')).toThrow(/terminal|pending/);
});
it('M04 unrelated earlier-PA pending scope is not a claim on this terminal application', () => {
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign-application', 'game', 'foreign-closure', 'bad', raw(pending('foreign-application', 'game', 6), 'plain'));
  expect(officialApplicationOwnershipClaims(db, scope).map(claim => claim.table)).toEqual(['matches']);
});

it.each(['physical_admission', 'historical_actor'] as const)('M05 preserves an earlier-PA application when a later PA is pending: %s', route => {
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply', 'game', 'prior-closure', 'prior-hash',
    JSON.stringify({ receipt: { applicationId: 'apply', previousPlayId: 6 } }));
  db.prepare('UPDATE matches SET activation_json=? WHERE match_id=?').run(raw(pending('later-application', 'game', 7), 'plain'), 'game');
  const read = () => route === 'physical_admission' ? assertPriorPhysicalClosureCompleted(db, 'apply')
    : readActualLivePhysicalActivation(db, 'game', 'apply');
  expect(read).not.toThrow();
});
it('M06 preserves same-original-PA rejection when the pending marker application identity is damaged', () => {
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply', 'game', 'prior-closure', 'prior-hash',
    JSON.stringify({ receipt: { applicationId: 'apply', previousPlayId: 7 } }));
  db.prepare('UPDATE matches SET activation_json=? WHERE match_id=?').run(raw(pending('damaged-application', 'game', 7), 'plain'), 'game');
  expect(() => assertPriorPhysicalClosureCompleted(db, 'apply')).toThrow(/terminal|pending/);
  expect(() => readActualLivePhysicalActivation(db, 'game', 'apply')).toThrow(/terminal|pending/);
});
