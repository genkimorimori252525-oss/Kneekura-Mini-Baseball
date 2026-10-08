import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { beginActualLivePlayWrite, beginActualLivePlayRegistration } from './ActualLivePlayFence';
import { assertNoReceivedDefenderReferenceClaims, receivedDefenderClaims } from './ActualReceivedUmpireDefenderClaims';
import { installReceivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { installRenewalOwnerSchema, type RenewalOwnerTable } from './ActualReceivedUmpireRenewalSchema';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope = { gameId: 'game-a', playId: 1, physicalPitchSourceId: 'pitch-a' };
const snapshot = (db: InstanceType<typeof DatabaseSync>) => db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
const renewalRow = (db: InstanceType<typeof DatabaseSync>, table: RenewalOwnerTable, changes: Record<string,unknown>={}) => {
  const columns=db.prepare(`PRAGMA table_info(${table})`).all(),row:Record<string,unknown>={};
  for(const c of columns)row[String(c.name)]=c.type==='INTEGER'?1:String(c.name)+'-b';
  Object.assign(row,{source_id:'renewal-b',game_id:'game-b',play_id:1,physical_pitch_source_id:'pitch-b',player_id:'shared-player',
    source_json:JSON.stringify({sourceId:'renewal-b',sourceVersion:'fixture-v1',capability:'received_umpire_renewal_enrollment_v1',receivedEnrollmentSourceId:'old-b',receivedReplanSourceId:'replan-b'}),
    snapshot_json:'{}',owner:'actual_received_umpire_renewal_enrollments'},changes);
  const names=columns.map(c=>String(c.name));db.prepare(`INSERT INTO ${table}(${names.join(',')}) VALUES(${names.map(()=>'?').join(',')})`).run(...names.map(n=>row[n]) as never[]);
};

it('RU01 blocks renewal-only partial ownership before legacy write with all old family tables absent', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE actual_received_umpire_renewal_heads(physical_pitch_source_id TEXT); INSERT INTO actual_received_umpire_renewal_heads VALUES('pitch-a'); BEGIN");
    const before = snapshot(db);
    expect(() => beginActualLivePlayWrite(db, scope), 'RENEWAL_ONLY_WRITE_INGRESS_OPEN').toThrow(/renewal.*schema|received.*pending/i);
    expect(snapshot(db)).toEqual(before);
    expect(db.prepare("SELECT * FROM actual_received_umpire_renewal_heads").all()).toEqual([{ physical_pitch_source_id: 'pitch-a' }]);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it('RU02 rejects mixed-case renewal namespace during fresh registration without installing old tables', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE Actual_Received_Umpire_Renewal_Enrollments(source_id TEXT); BEGIN');
    const before = snapshot(db);
    expect(() => beginActualLivePlayRegistration(db, scope), 'RENEWAL_ALIAS_REGISTRATION_OPEN').toThrow(/renewal.*schema|received.*pending/i);
    expect(snapshot(db)).toEqual(before);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it('RU03 rejects renewal-only namespace at terminal reference ingress before scope derivation', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE actual_received_umpire_renewal_admissions(source_id TEXT)');
    const before = snapshot(db);
    expect(() => assertNoReceivedDefenderReferenceClaims(db, [{ owner: 'batted_world_field_executions', sourceId: 'execution-a' }]),
      'RENEWAL_ONLY_TERMINAL_INGRESS_OPEN').toThrow(/renewal.*schema|received.*pending/i);
    expect(snapshot(db)).toEqual(before);
  } finally { db.close(); }
});

it('RU04 keeps old family census separate while its fresh guard rejects a malformed renewal family', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN'); installReceivedOwnerSchema(db); db.exec('COMMIT');
    db.exec('CREATE TABLE actual_received_umpire_renewal_motors(source_id TEXT); BEGIN');
    const before = snapshot(db);
    expect(receivedDefenderClaims(db, scope)).toEqual([]);
    expect(() => beginActualLivePlayWrite(db, scope), 'RENEWAL_CENSUS_FRESH_GUARD_OPEN').toThrow(/renewal.*schema|received.*pending/i);
    expect(receivedDefenderClaims(db, scope)).toEqual([]); expect(snapshot(db)).toEqual(before);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it('RU05 finds complete renewal head-only and journal-only claims with the old family absent', () => {
  for(const table of ['actual_received_umpire_renewal_heads','actual_received_umpire_renewal_admissions'] as const){
    const db=new DatabaseSync(':memory:');
    try{db.exec('BEGIN');installRenewalOwnerSchema(db);renewalRow(db,table,{physical_pitch_source_id:'pitch-a'});const before=snapshot(db);
      expect(receivedDefenderClaims(db,scope)).toEqual([]);
      expect(()=>beginActualLivePlayWrite(db,scope),'RENEWAL_SURVIVING_ROW_IGNORED').toThrow(/received.*pending/i);
      expect(snapshot(db)).toEqual(before);
    }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
  }
});

it('RU06 follows a surviving namespaced anchor through original raw game-play metadata after renewal scopes move', () => {
  const db=new DatabaseSync(':memory:');
  try{db.exec('BEGIN');installRenewalOwnerSchema(db);
    db.exec('CREATE TABLE batted_world_field_executions(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT)');
    db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?)').run('execution-a','moved',99,'pitch-moved','{"sourceId":"execution-a"}','{"gameId":"game-a","playId":1,"physicalPitchSourceId":"pitch-a"}');
    renewalRow(db,'actual_received_umpire_renewal_enrollments',{snapshot_json:'{"anchor":{"execution":{"sourceId":"execution-a"}}}'});
    expect(()=>beginActualLivePlayWrite(db,{gameId:'game-a',playId:1}),'RENEWAL_MOVED_RAW_LINK_IGNORED').toThrow(/received.*pending/i);
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
});

it('RU07 does not join separate plays by shared Player model or policy identities', () => {
  const db=new DatabaseSync(':memory:');
  try{db.exec('BEGIN');installRenewalOwnerSchema(db);renewalRow(db,'actual_received_umpire_renewal_enrollments',{
    snapshot_json:'{"playerId":"shared-player","fieldingModelSourceId":"shared-model","policyDataSourceId":"shared-policy"}'});
    expect(()=>beginActualLivePlayWrite(db,scope)).not.toThrow();
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
});

it('RU08 discovers a physical renewal action survivor when both extension families are absent', () => {
  const db=new DatabaseSync(':memory:');
  try{db.exec('CREATE TABLE batted_world_field_executions(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT)');
    db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?)').run('adopt-a','game-a',1,'pitch-a',JSON.stringify({sourceId:'adopt-a',sourceVersion:'fixture-v1',baseFieldSourceId:'field-a',previousExecutionSourceId:'execution-a',action:{kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:'renewal-a',renewalMotorSourceId:'new-motor-a'}}),'{}');
    db.exec('BEGIN');const before=snapshot(db);
    expect(()=>beginActualLivePlayWrite(db,scope),'RENEWAL_PHYSICAL_SURVIVOR_IGNORED').toThrow(/received.*pending/i);
    expect(()=>assertNoReceivedDefenderReferenceClaims(db,[{owner:'batted_world_field_executions',sourceId:'adopt-a'}])).toThrow();
    expect(snapshot(db)).toEqual(before);
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
});

it('RU09 follows physical predecessor references after a renewal adoption cached scope moves',()=>{
  for(const key of ['previousExecutionSourceId','previous_source_id'] as const){
    const db=new DatabaseSync(':memory:');
    try{db.exec('CREATE TABLE batted_world_field_executions(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,previous_source_id TEXT,source_json TEXT,snapshot_json TEXT)');
      db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?,?)').run('execution-a','game-a',1,'pitch-a',null,'{"sourceId":"execution-a"}','{}');
      const action={kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:'renewal-b',renewalMotorSourceId:'motor-b'};
      const s={sourceId:'adopt-b',sourceVersion:'fixture-v1',baseFieldSourceId:'field-b',...(key==='previousExecutionSourceId'?{previousExecutionSourceId:'execution-a'}:{}),action};
      db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?,?)').run('adopt-b','game-b',1,'pitch-b',key==='previous_source_id'?'execution-a':null,JSON.stringify(s),'{}');db.exec('BEGIN');
      expect(()=>beginActualLivePlayWrite(db,scope),'RENEWAL_PREDECESSOR_REFERENCE_IGNORED').toThrow(/received.*pending/);
      expect(()=>assertNoReceivedDefenderReferenceClaims(db,[{owner:'batted_world_field_executions',sourceId:'execution-a'}])).toThrow(/received.*pending/);
    }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
  }
});

it('RU10 rejects case-aliased physical renewal survivors while both received families are absent',()=>{
  for(const name of ['BATTED_WORLD_FIELD_EXECUTIONS','Batted_World_Field_Executions']){
    const db=new DatabaseSync(':memory:');
    try{db.exec(`CREATE TABLE ${name}(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT)`);
      db.prepare(`INSERT INTO ${name} VALUES(?,?,?,?,?,?)`).run('adopt-a','game-a',1,'pitch-a',JSON.stringify({sourceId:'adopt-a',sourceVersion:'fixture-v1',baseFieldSourceId:'field-a',previousExecutionSourceId:'execution-a',action:{kind:'received_renewal_adoption_v1',renewalEnrollmentSourceId:'renewal-a',renewalMotorSourceId:'motor-a'}}),'{}');
      db.exec('BEGIN');const before=snapshot(db);
      expect(()=>beginActualLivePlayWrite(db,scope),'PHYSICAL_RENEWAL_CASE_ALIAS_IGNORED').toThrow(/schema|pending/);
      expect(()=>assertNoReceivedDefenderReferenceClaims(db,[{owner:'batted_world_field_executions',sourceId:'adopt-a'}])).toThrow(/schema|pending/);
      expect(snapshot(db)).toEqual(before);
    }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
  }
});
