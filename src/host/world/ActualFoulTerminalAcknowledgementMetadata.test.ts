import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { foulTerminalApplicationClaims, foulTerminalApplicationIdentityRows,
  type FoulTerminalApplicationScope } from './ActualFoulTerminalApplicationOwnership';
import { assertNoFoulTerminalNextPlay } from './FoulTerminalNextPlayGuard';

// Rejection-only synthetic metadata. This file has no fixture, original-owner
// reconstruction, runner, or genuine-acceptance import.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope: FoulTerminalApplicationScope = {
  official: { sourceId:'session',gameId:'game',playId:7,physicalPitchSourceId:'pitch',physicalEndSourceId:'end',
    consumptionSourceId:'count',officialObligationKey:'official-child',originalSuccessorKey:'successor' },
  applicationSourceId:'terminal',applicationId:'apply',closureId:'terminal',
};
const acknowledgementId = JSON.stringify(['actual_foul_terminal_official_acknowledgement_v1','official-child','terminal']);
let db: Database;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE actual_foul_terminal_applications(
    source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,physical_pitch_source_id TEXT,
    physical_end_source_id TEXT,official_obligation_key TEXT,status TEXT,source_json TEXT,source_hash TEXT,
    proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
    CREATE TABLE applications(application_id TEXT,match_id TEXT,closure_id TEXT,request_hash TEXT,result_json TEXT);
    CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);`);
});
afterEach(() => db.close());
const insert = (result: string, sourceId = 'foreign-source') => {
  db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId,
    sourceId + ':game',91,sourceId + ':application',sourceId + ':pitch',sourceId + ':end',sourceId + ':child',
    'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY','{}','bad','{}','bad',result);
};
const encoded = (value: unknown, form: string): string => form === 'plain' ? JSON.stringify({ acknowledgement:value })
  : '[{"acknowledgement":{},"acknowledg\\u0065ment":[[' + JSON.stringify(value) + ']],"acknowledgement":{}}]';
const reference = (playId = 7) => ({ applicationReference:{ owner:'applications',matchId:'game',previousPlayId:playId } });

it.each(['plain','escaped_duplicate_arrays'])('A-M01 discovers sole acknowledgementId scope in %s raw foreign row', form => {
  insert(encoded({ acknowledgementId },form));
  expect(foulTerminalApplicationClaims(db,scope).map(row => row.source_id),'ACK_ID_SCOPE_MISSING').toEqual(['foreign-source']);
});
it.each(['plain','escaped_duplicate_arrays'])('A-M02 follows acknowledgement identity from selected row before parsing %s competitors', form => {
  insert(JSON.stringify({ acknowledgement:{ acknowledgementId } }),'terminal');
  insert(encoded({ acknowledgementId },form));
  expect(foulTerminalApplicationIdentityRows(db,'terminal').map(row => row.source_id).sort(),'ACK_ID_TRANSITIVE_CLAIM_MISSING')
    .toEqual(['foreign-source','terminal']);
});
it.each(['plain','escaped_duplicate_arrays'])('A-M03 discovers applicationReference original Match/play scope in %s', form => {
  insert(encoded(reference(),form));
  expect(foulTerminalApplicationClaims(db,scope).map(row => row.source_id),'ACK_REFERENCE_SCOPE_MISSING').toEqual(['foreign-source']);
});
it.each(['plain','escaped_duplicate_arrays'])('A-M04 sole acknowledgement applicationReference identity still fences next play in %s', form => {
  insert(encoded({ applicationReference:{ applicationId:'apply' } },form));
  expect(() => assertNoFoulTerminalNextPlay(db,'apply')).toThrow(/terminal|pending/);
});
it.each(['plain','escaped_duplicate_arrays'])('A-M05 sole acknowledgement scope fences the original application with damaged identity in %s', form => {
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply','game','terminal','bad',
    JSON.stringify({ receipt:{ applicationId:'apply',previousPlayId:7 } }));
  insert(encoded(reference(),form));
  expect(() => assertNoFoulTerminalNextPlay(db,'apply'),'ACK_REFERENCE_SCOPE_GUARD_MISSING').toThrow(/terminal|pending/);
});
it('A-M06 acknowledgement scope does not consume an earlier PA', () => {
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply','game','earlier','bad',
    JSON.stringify({ receipt:{ applicationId:'apply',previousPlayId:6 } }));
  insert(encoded(reference(7),'escaped_duplicate_arrays'));
  expect(() => assertNoFoulTerminalNextPlay(db,'apply')).not.toThrow();
});
it('A-M07 unrelated acknowledgement ID and different original Match/play scope are not claims', () => {
  insert(JSON.stringify({ acknowledgement:{ acknowledgementId:'unrelated',...reference(6) } }));
  expect(foulTerminalApplicationClaims(db,scope)).toEqual([]);
});
it.each(['terminal','apply','distinct-closure'])('A-M08 acknowledgement ID equal to %s in another identity domain is not linkage', collision => {
  insert(JSON.stringify({ acknowledgement:{ acknowledgementId:collision } }));
  expect(foulTerminalApplicationIdentityRows(db,'terminal')).toEqual([]);
  expect(foulTerminalApplicationClaims(db,{ ...scope,closureId:'distinct-closure' })).toEqual([]);
});
it.each(['plain','escaped_duplicate_arrays'])('A-M09 discovers original source encoded only in a sole %s acknowledgement ID', form => {
  insert(encoded({ acknowledgementId },form));
  expect(foulTerminalApplicationIdentityRows(db,'terminal').map(row => row.source_id),'ACK_EMBEDDED_SOURCE_CLAIM_MISSING').toEqual(['foreign-source']);
});
it('A-M10 discovers a noncanonical whitespace and escaped embedded source in acknowledgement ID for rejection only', () => {
  insert(encoded({ acknowledgementId:'[ "actual_foul_terminal_official_acknowledgement_v1", "official-child", "termi\\u006eal" ]' },'escaped_duplicate_arrays'));
  expect(foulTerminalApplicationIdentityRows(db,'terminal').map(row => row.source_id),'ACK_ESCAPED_EMBEDDED_SOURCE_CLAIM_MISSING').toEqual(['foreign-source']);
});
it.each(['["wrong-version","official-child","terminal"]',
  '["actual_foul_terminal_official_acknowledgement_v1","official-child","terminal","extra"]',
  '{"0":"actual_foul_terminal_official_acknowledgement_v1","1":"official-child","2":"terminal"}',
  '["actual_foul_terminal_official_acknowledgement_v1",null,"terminal"]'])
('A-M11 unsupported acknowledgement identity shape %s does not invent Source linkage', acknowledgementId => {
  insert(JSON.stringify({ acknowledgement:{ acknowledgementId } }));
  expect(foulTerminalApplicationIdentityRows(db,'terminal')).toEqual([]);
});
