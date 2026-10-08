import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import * as terminal from './ActualFoulTerminalApplicationOwnership';
import * as official from '../OfficialApplicationOwnershipFromSqlite';
import { officialApplicationOwnershipClaims, officialApplicationIdentityClaims, officialMatchActivationClaims } from '../OfficialApplicationOwnershipFromSqlite';

// Rejection-only raw metadata. Deliberately malformed cached columns and payloads
// below never establish accepted setup, completed effects, retirement or readiness.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope: terminal.FoulTerminalApplicationScope = { official: { sourceId:'session',gameId:'game',playId:7,
  physicalPitchSourceId:'pitch',physicalEndSourceId:'end',consumptionSourceId:'count',
  officialObligationKey:'child',originalSuccessorKey:'successor' }, applicationSourceId:'terminal',applicationId:'apply',closureId:'terminal' };
const version = 'actual_foul_terminal_post_play_completion_v1';
const completionId = JSON.stringify([version,'terminal','setup']);
const ref = (sourceId = 'terminal') => ({ owner:'actual_foul_terminal_applications',sourceId });
const at = (path: string[], value: unknown): any => path.reduceRight((value, key) => ({ [key]:value }), value);
const encoded = (value: unknown, variant: string): string => {
  if (variant === 'plain') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => encoded(v,variant)).join(',') + ']';
  if (value !== null && typeof value === 'object') return '[{' + Object.entries(value).flatMap(([k,v]) => {
    const key = JSON.stringify(k), escaped = '"\\u' + k.charCodeAt(0).toString(16).padStart(4,'0') + k.slice(1) + '"';
    return [key + ':{}',escaped + ':[[' + encoded(v,variant) + ']]',key + ':{}'];
  }).join(',') + '}]';
  return JSON.stringify(value);
};
let db: Database;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE actual_foul_terminal_applications(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,
    physical_pitch_source_id TEXT,physical_end_source_id TEXT,official_obligation_key TEXT,status TEXT,source_json TEXT,
    source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
    CREATE TABLE applications(application_id TEXT,match_id TEXT,closure_id TEXT,request_hash TEXT,result_json TEXT);
    CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);
    CREATE TABLE physical_play_closures(source_id TEXT,source_version TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,
      scoring_application_id TEXT,status TEXT,source_json TEXT,source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
    CREATE TABLE actual_live_play_closures(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,status TEXT,
      source_json TEXT,source_hash TEXT,proposal_json TEXT,proposal_hash TEXT,result_json TEXT);`);
});
afterEach(() => db.close());
const clear = () => { for (const t of ['actual_foul_terminal_applications','applications','matches','physical_play_closures','actual_live_play_closures']) db.exec('DELETE FROM ' + t); };
const insertTerminal = (completion: unknown, source = 'foreign', form = 'plain', game = 'foreign-game') =>
  db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(source,game,91,
    source + ':apply',source + ':pitch',source + ':end',source + ':child','BROKEN','{}','bad','{}','bad',encoded({ completion },form));
const insertOfficial = (table: string, completion: unknown, form = 'plain', prefix: string[] = []) => {
  const document = encoded(at(prefix,{ completion }),form);
  if (table === 'applications') db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign-game','foreign-closure','bad',document);
  else if (table === 'matches') db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('foreign-game',99,'{}',document);
  else if (table === 'physical_play_closures') db.prepare('INSERT INTO physical_play_closures VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(
    'foreign','v1','foreign-game',91,'foreign-apply','foreign-score','BROKEN','{}','bad',prefix[0] === 'expectedOfficial' ? document : '{}','bad',prefix[0] === 'official' ? document : '{}');
  else db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?,?,?,?,?,?,?,?)').run(
    'foreign','foreign-game',91,'foreign-apply','BROKEN','{}','bad',prefix[0] === 'expectedOfficial' ? document : '{}','bad',prefix[0] === 'official' ? document : '{}');
};
const ids = () => terminal.foulTerminalApplicationIdentityRows(db,'terminal').map(r => r.source_id).sort();
const sources = [ { terminalReference:ref() }, { source:{ terminalReference:ref() } },
  { workloadReference:{ terminalSourceId:'terminal' } }, { terminalSourceId:'terminal' }, { completionId },
  { scoringReference:{ scoringApplicationId:JSON.stringify(['actual_foul_terminal_scoring_v1','terminal']) } },
  { activation:{ closureId:'terminal' } } ];
const setupPaths = [['source','sourceId'],['controllerRetirement','sourceId'],['setupSourceId']];
const typedPaths = [['completionId'],['sourceHash'],['snapshotHash'],['terminalReference','sourceHash'],
  ['source','terminalReference','sourceHash'],['terminalReference','proposalHash'],['source','terminalReference','proposalHash'],
  ['officialReference','receiptHash'],['officialReference','pendingPostPlayHash'],['officialReference','acknowledgementHash'],
  ['scoringReference','scoringApplicationId'],['scoringReference','rowHash'],['workloadReference','planHash'],
  ['workloadReference','participantEffects','activitySourceId'],['workloadReference','participantEffects','activityHash'],
  ['workloadReference','participantEffects','afterHash'],['controllerRetirement','physicalEndReference','sourceHash'],
  ['controllerRetirement','physicalEndReference','snapshotHash']];
it('CP-M01 discovers every terminal reference and versioned embedded identity in raw completion variants', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) for (const completion of sources) {
    clear(); insertTerminal(completion,'foreign',form);
    expect(ids(),'COMPLETION_TERMINAL_REFERENCE_MISSING ' + JSON.stringify(completion)).toEqual(['foreign']);
    expect(terminal.foulTerminalApplicationClaims(db,scope).map(r => r.source_id),'COMPLETION_SCOPE_REFERENCE_MISSING').toEqual(['foreign']);
  }
});
it('CP-M02 connects surviving setup aliases across every setup identity path to a fixed point', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) for (const path of setupPaths) {
    clear(); insertTerminal({ source:{ sourceId:'setup' } },'terminal');
    insertTerminal(at(path,'setup'),'foreign',form);
    expect(ids(),'COMPLETION_SETUP_ALIAS_MISSING').toEqual(['foreign','terminal']);
  }
  clear(); insertTerminal({ source:{ sourceId:'setup' } },'terminal');
  insertTerminal({ completionId:JSON.stringify([version,'damaged-terminal','setup']) });
  expect(ids(),'COMPLETION_ENCODED_SETUP_ALIAS_MISSING').toEqual(['foreign','terminal']);
});
it('CP-M03 discovers all completion reference hash and identity domains without parsing payloads', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) for (const path of typedPaths) {
    clear(); insertTerminal(at(path,'same-domain-alias'),'terminal'); insertTerminal(at(path,'same-domain-alias'),'foreign',form);
    expect(ids(),'COMPLETION_TYPED_REFERENCE_MISSING ' + path.join('.')).toEqual(['foreign','terminal']);
  }
});
it('CP-M04 discovers completion references across application Match and legacy closure mirrors', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) for (const table of ['applications','matches','physical_play_closures','actual_live_play_closures']) {
    for (const prefix of table.endsWith('closures') ? [['official'],['expectedOfficial']] : [[]]) {
      for (const completion of sources) {
        clear(); insertOfficial(table,completion,form,prefix);
        expect(officialApplicationOwnershipClaims(db,scope).map(c => c.table),'COMPLETION_OFFICIAL_REFERENCE_MISSING ' + table).toEqual([table]);
      }
    }
  }
});
it('CP-M05 propagates setup and typed completion aliases from terminal to official raw peers', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) for (const path of [...setupPaths,...typedPaths]) {
    clear(); insertTerminal(at(path,'alias'),'terminal'); insertOfficial('applications',at(path,'alias'),form);
    expect(officialApplicationOwnershipClaims(db,scope).map(c => c.table),'COMPLETION_OFFICIAL_ALIAS_MISSING ' + path.join('.')).toEqual(['applications']);
  }
});
it('CP-M06 finds orphan terminal identities through official completion references', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) for (const completion of sources) {
    clear(); insertOfficial('applications',completion,form);
    expect(officialApplicationIdentityClaims(db,'terminal').map(c => c.table),'COMPLETION_ORPHAN_REFERENCE_MISSING').toEqual(['applications']);
  }
});
it('CP-M07 discovers retirement physical references and original previous-play scope', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) for (const completion of [
    { controllerRetirement:{ physicalEndReference:{ owner:'actual_foul_play_ends',sourceId:'end' } } },
    { controllerRetirement:{ previousPlayId:7 } }, { activation:{ previousPlayId:7 } },
  ]) {
    clear(); insertTerminal(completion,'foreign',form,'game');
    expect(terminal.foulTerminalApplicationClaims(db,scope).map(r => r.source_id),'COMPLETION_PREVIOUS_SCOPE_MISSING').toEqual(['foreign']);
  }
});
it('CP-M08 global setup census discovers damaged owners aliases and encoded setup identities without writes', () => {
  const census = (terminal as unknown as Record<string, unknown>).foulTerminalPostPlaySetupIdentityRows;
  expect(typeof census,'COMPLETION_SETUP_CENSUS_MISSING').toBe('function');
  const read = census as (db: Database, setup: string) => Record<string, unknown>[];
  for (const form of ['plain','escaped_duplicates_arrays']) for (const completion of [
    ...setupPaths.map(p => at(p,'setup')), { completionId:JSON.stringify([version,'damaged','setup']) },
  ]) {
    clear(); insertTerminal(completion,'foreign',form);
    db.exec("UPDATE actual_foul_terminal_applications SET source_id=NULL,game_id=NULL,play_id=NULL,source_json='invalid',proposal_json='invalid',source_hash=NULL,proposal_hash=NULL");
    const before = db.prepare('SELECT total_changes() AS n').get();
    expect(read(db,'setup'),'COMPLETION_GLOBAL_DAMAGED_SETUP_MISSING').toHaveLength(1);
    expect(read(db,'unrelated')).toEqual([]);
    expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
  }
  clear(); insertTerminal({ source:{ sourceId:'setup' },snapshotHash:'bridge' },'foreign');
  insertTerminal({ snapshotHash:'bridge' },'raw-only-peer');
  expect(read(db,'setup').map(r => r.source_id).sort(),'COMPLETION_SETUP_FIXED_POINT_MISSING').toEqual(['foreign','raw-only-peer']);
  expect(() => read(db,'')).toThrow();
});
it('CP-M09 Match stray completion remains a rejection claim despite canonical next-world envelope rules', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) {
    clear(); insertOfficial('matches',{ terminalSourceId:'terminal' },form);
    expect(officialMatchActivationClaims(db,db.prepare('SELECT * FROM matches').get()!,scope),'COMPLETION_MATCH_CLAIM_MISSING').toBe(true);
  }
});
it('CP-M10 decodes escaped noncanonical completion and scoring IDs for rejection only', () => {
  for (const completion of [
    { completionId:'[ "actual_foul_terminal_post_play_completion_v1", "termi\\u006eal", "setup" ]' },
    { scoringReference:{ scoringApplicationId:'[ "actual_foul_terminal_scoring_v1", "termi\\u006eal" ]' } },
  ]) { clear(); insertTerminal(completion,'foreign','escaped_duplicates_arrays'); expect(ids(),'COMPLETION_ENCODED_SOURCE_MISSING').toEqual(['foreign']); }
});
it('CP-M11 literal collisions across source setup completion application and hash domains are not claims', () => {
  for (const path of [...setupPaths,...typedPaths]) {
    clear(); insertTerminal(at(path,'terminal')); expect(ids()).toEqual([]);
  }
  for (const path of [['sourceHash'],['snapshotHash'],['source','sourceId'],['completionId']]) {
    for (const other of [['sourceHash'],['snapshotHash'],['source','sourceId'],['completionId']]) {
      if (path.join('.') === other.join('.')) continue;
      clear(); insertTerminal(at(path,'collision'),'terminal'); insertTerminal(at(other,'collision'));
      expect(ids()).toEqual(['terminal']);
    }
  }
});
it('CP-M12 wrong owner unsupported encoded identities and next-play scope never invent original claims', () => {
  for (const completion of [ { terminalReference:{ owner:'wrong',sourceId:'terminal' } },
    { source:{ terminalReference:{ owner:'wrong',sourceId:'terminal' } } },
    { completionId:JSON.stringify(['wrong','terminal','setup']) }, { completionId:JSON.stringify([version,'terminal','setup','extra']) },
    { completionId:JSON.stringify([version,null,'setup']) }, { completionId:JSON.stringify({ 0:version,1:'terminal',2:'setup' }) },
    { scoringReference:{ scoringApplicationId:JSON.stringify(['wrong','terminal']) } },
    { controllerRetirement:{ previousPlayId:6,nextPlayId:7 } }, { activation:{ previousPlayId:6,nextMatchState:{ playId:7 } } },
  ]) { clear(); insertTerminal(completion,'foreign','escaped_duplicates_arrays','game'); expect(ids()).toEqual([]); expect(terminal.foulTerminalApplicationClaims(db,scope)).toEqual([]); }
});
it('CP-M13 absent optional owners remain absent and raw claims never mutate storage', () => {
  clear(); const schema = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
  const changes = db.prepare('SELECT total_changes() AS n').get();
  expect(ids()).toEqual([]); expect(officialApplicationOwnershipClaims(db,scope)).toEqual([]);
  expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(schema);
  expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
});
it('CP-M14 sole Match retirement physical reference stays discoverable with damaged game and identity', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) {
    clear(); insertOfficial('matches',{ controllerRetirement:{ physicalEndReference:{ owner:'actual_foul_play_ends',sourceId:'end' } } },form);
    expect(officialApplicationOwnershipClaims(db,scope).map(c => c.table),'COMPLETION_MATCH_PHYSICAL_REFERENCE_MISSING').toEqual(['matches']);
    expect(officialMatchActivationClaims(db,db.prepare('SELECT * FROM matches').get()!,scope),'COMPLETION_MATCH_PHYSICAL_REFERENCE_MISSING').toBe(true);
  }
});
it('CP-M15 retirement physical Source aliases propagate through the raw identity fixed point', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) {
    clear(); const completion = { controllerRetirement:{ physicalEndReference:{ owner:'actual_foul_play_ends',sourceId:'end-alias' } } };
    insertTerminal(completion,'terminal'); insertTerminal(completion,'foreign',form);
    expect(ids(),'COMPLETION_PHYSICAL_IDENTITY_EDGE_MISSING').toEqual(['foreign','terminal']);
    insertOfficial('applications',completion,form);
    expect(officialApplicationOwnershipClaims(db,scope).map(c => c.table),'COMPLETION_OFFICIAL_PHYSICAL_IDENTITY_EDGE_MISSING').toEqual(['applications']);
  }
});
it('CP-M16 official discovery reaches terminal raw-only bridges before deciding uniqueness', () => {
  insertTerminal({},'terminal');
  insertTerminal({ setupSourceId:'setup-bridge',snapshotHash:'snapshot-bridge' },'damaged-peer');
  insertOfficial('applications',{ terminalSourceId:'terminal',setupSourceId:'setup-bridge' });
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('second','foreign-game','second-closure','bad',
    encoded({ completion:{ snapshotHash:'snapshot-bridge' } },'escaped_duplicates_arrays'));
  expect(officialApplicationOwnershipClaims(db,scope).filter(c => c.table === 'applications').map(c => c.row.application_id).sort(),
    'COMPLETION_CROSS_OWNER_FIXED_POINT_MISSING').toEqual(['foreign','second']);
  expect(officialApplicationIdentityClaims(db,'terminal').filter(c => c.table === 'applications').map(c => c.row.application_id).sort(),
    'COMPLETION_ORPHAN_CROSS_OWNER_FIXED_POINT_MISSING').toEqual(['foreign','second']);
});
it('CP-M17 official completion scope uses original game and previous play while preserving earlier history', () => {
  for (const table of ['applications','matches','physical_play_closures','actual_live_play_closures']) {
    for (const prefix of table.endsWith('closures') ? [['official'],['expectedOfficial']] : [[]]) {
      for (const kind of ['activation','controllerRetirement']) for (const playId of [6,7]) {
        clear(); insertOfficial(table,{ [kind]:{ previousPlayId:playId,nextPlayId:7,nextMatchState:{ playId:7 } } },'escaped_duplicates_arrays',prefix);
        db.exec('UPDATE ' + table + " SET " + (table.endsWith('closures') ? 'game_id' : 'match_id') + "='game'");
        if (table === 'matches') expect(officialMatchActivationClaims(db,db.prepare('SELECT * FROM matches').get()!,scope)).toBe(playId === 7);
        else expect(officialApplicationOwnershipClaims(db,scope).map(c => c.table)).toEqual(playId === 7 ? [table] : []);
      }
    }
  }
});
it('CP-M18 global setup census validates identity and leaves missing optional storage absent', () => {
  const census = (terminal as unknown as { foulTerminalPostPlaySetupIdentityRows: (db: Database, setup: string) => unknown[] }).foulTerminalPostPlaySetupIdentityRows;
  db.exec('DROP TABLE actual_foul_terminal_applications');
  const before = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
  expect(census(db,'setup')).toEqual([]); expect(() => census(db,' invalid ')).toThrow(/identity/);
  expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);
});
it('CP-M19 official application references preserve their separate identity domain', () => {
  for (const path of [['officialReference','applicationId'],['activation','applicationId']]) {
    clear(); insertTerminal(at(path,'apply'));
    expect(terminal.foulTerminalApplicationClaims(db,scope).map(r => r.source_id)).toEqual(['foreign']);
    clear(); insertOfficial('applications',at(path,'apply'));
    expect(officialApplicationOwnershipClaims(db,scope).map(c => c.table)).toEqual(['applications']);
    clear(); insertOfficial('applications',at(path,'terminal'));
    expect(officialApplicationIdentityClaims(db,'terminal')).toEqual([]);
    clear(); insertTerminal(at(path,'terminal')); expect(ids()).toEqual([]);
  }
});

const setupOfficialCensus = () => {
  const read = (official as unknown as Record<string, unknown>).officialApplicationPostPlaySetupIdentityClaims;
  expect(typeof read,'COMPLETION_OFFICIAL_SETUP_CENSUS_MISSING').toBe('function');
  return read as (db: Database, setupSourceId: string) => official.OfficialApplicationOwnershipClaim[];
};
it('CP-M20 setup-seeded official census finds wholly orphan compact application and Match claims', () => {
  const read = setupOfficialCensus();
  for (const form of ['plain','escaped_duplicates_arrays']) for (const table of ['applications','matches']) {
    for (const completion of [{ setupSourceId:'setup' },
      { setupSourceId:'setup',terminalSourceId:null,completionId:'broken',sourceHash:null,snapshotHash:17 }]) {
      clear(); insertOfficial(table,completion,form);
      const before = db.prepare('SELECT total_changes() AS n').get();
      const claims = read(db,'setup');
      expect(claims.map(c => c.table)).toEqual([table]);
      expect(claims[0].row).toEqual(db.prepare('SELECT * FROM ' + table).get());
      expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
    }
  }
});
it('CP-M21 setup-seeded official census keeps every literal identity and hash domain separate', () => {
  const read = setupOfficialCensus();
  for (const completion of [{ terminalSourceId:'setup' }, { completionId:'setup' }, { sourceHash:'setup' },
    { snapshotHash:'setup' }, { officialReference:{ applicationId:'setup' } }, { terminalReference:ref('setup') }]) {
    clear(); insertOfficial('applications',completion,'escaped_duplicates_arrays');
    expect(read(db,'setup')).toEqual([]);
  }
  for (const value of ['', ' invalid ']) expect(() => read(db,value)).toThrow(/identity/);
});
it('CP-M22 setup-seeded official census traverses typed hashes and terminal raw bridges to a fixed point', () => {
  const read = setupOfficialCensus();
  insertOfficial('applications',{ setupSourceId:'setup',snapshotHash:'snapshot-bridge' },'escaped_duplicates_arrays');
  insertTerminal({ snapshotHash:'snapshot-bridge',source:{ sourceId:'second-setup' } },'damaged-terminal','escaped_duplicates_arrays');
  insertOfficial('matches',{ setupSourceId:'second-setup',sourceHash:'source-bridge' },'escaped_duplicates_arrays');
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('second','second-game','second-closure','bad',
    encoded({ completion:{ sourceHash:'source-bridge' } },'escaped_duplicates_arrays'));
  expect(read(db,'setup').map(c => c.table + ':' + (c.row.application_id ?? c.row.match_id)).sort())
    .toEqual(['applications:foreign','applications:second','matches:foreign-game']);
});
it('CP-M23 setup-seeded official census includes legacy mirrors and does not depend on terminal storage', () => {
  const read = setupOfficialCensus();
  for (const form of ['plain','escaped_duplicates_arrays']) for (const table of ['physical_play_closures','actual_live_play_closures']) {
    for (const prefix of [['official'],['expectedOfficial']]) for (const completion of [
      { setupSourceId:'setup' }, { source:{ sourceId:'setup' } }, { controllerRetirement:{ sourceId:'setup' } },
      { completionId:JSON.stringify([version,'damaged-terminal','setup']) },
    ]) {
      clear(); insertOfficial(table,completion,form,prefix);
      expect(read(db,'setup').map(c => c.table)).toEqual([table]);
    }
  }
  clear(); db.exec('DROP TABLE actual_foul_terminal_applications');
  insertOfficial('applications',{ setupSourceId:'setup' },'escaped_duplicates_arrays');
  const before = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
  expect(read(db,'setup').map(c => c.table)).toEqual(['applications']);
  expect(read(db,'absent')).toEqual([]);
  expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(before);
});
it('CP-M24 completion previous-play scope survives damaged cached game with retained original game markers', () => {
  for (const form of ['plain','escaped_duplicates_arrays']) for (const kind of ['activation','controllerRetirement']) {
    for (const gameId of ['game','other-game']) for (const previousPlayId of [6,7]) {
      const completion = { [kind]:{ previousPlayId,nextPlayId:7 } }, claims = gameId === 'game' && previousPlayId === 7;
      for (const marker of [{ official:{ pendingPostPlay:{ matchId:gameId } } },
        { acknowledgement:{ applicationReference:{ matchId:gameId } } }]) {
        clear(); insertTerminal(completion);
        db.prepare('UPDATE actual_foul_terminal_applications SET result_json=?').run(encoded({ ...marker,completion },form));
        expect(terminal.foulTerminalApplicationClaims(db,scope).map(r => r.source_id),
          'COMPLETION_RETAINED_GAME_SCOPE_MISSING').toEqual(claims ? ['foreign'] : []);
      }
      clear(); insertOfficial('matches',completion);
      db.prepare('UPDATE matches SET activation_json=?').run(encoded({ pendingPostPlay:{ matchId:gameId },completion },form));
      expect(officialMatchActivationClaims(db,db.prepare('SELECT * FROM matches').get()!,scope),
        'COMPLETION_MATCH_RETAINED_GAME_SCOPE_MISSING').toBe(claims);
    }
  }
});
