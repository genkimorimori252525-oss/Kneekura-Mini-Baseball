import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {expect,it} from 'vitest';
import {officialPitchWorkloadFixture} from './OfficialPitchWorkloadFixtures.test-support';
import {openSqliteOfficialPitchWorkloadStore} from './SqliteOfficialPitchWorkloadStore';
const policy={sourceId:'pitch-effort-policy',sourceVersion:'fixture-v1',policyId:'fixture-effort',version:'v1',availableAtDay:1,effortUnitsPerPhysicalPitch:2};
const request={scoringApplicationId:'scoring-2',activationApplicationId:'application-1',policySourceId:policy.sourceId};
// Fresh structural Core/Native fixtures. No retained terminal/physical proof is substituted or qualified.
const fixture=(body:(f:ReturnType<typeof officialPitchWorkloadFixture>)=>void)=>{const dir=mkdtempSync(join(tmpdir(),'effort-handoff-'));const f=officialPitchWorkloadFixture(true,false,join(dir,'game.sqlite'));try{body(f);}finally{f.close();rmSync(dir,{recursive:true,force:true});}};
it('EP-H01 performs one prewrite and one postinsert projection while later operations rederive',()=>fixture(f=>{
 let writer:DatabaseSync|undefined;const phases:{transaction:boolean;rows:number}[]=[];
 const scoring={...f.scoring,readAcceptedPlay:(id:string)=>{phases.push({transaction:writer!.isTransaction,rows:Number(writer!.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()!.n)});return f.scoring.readAcceptedPlay(id);}};
 const p=f.track(openSqliteOfficialPitchWorkloadStore(f.path,{scoring,participation:f.participation},{readAcceptedPolicy:()=>policy},db=>{writer=db as DatabaseSync;}));
 const activity=p.accept(request);expect(phases.length,'EFFORT_PROJECT_HANDOFF_MISSING').toBe(2);expect(phases).toEqual([{transaction:false,rows:0},{transaction:true,rows:1}]);
 const original=f.db.prepare('SELECT * FROM official_pitch_workload_sources').get();expect(p.readAcceptedActivity(activity.sourceEventId)).toEqual(activity);expect(phases.length).toBe(3);expect(p.accept(request)).toEqual(activity);expect(phases.length).toBe(4);expect(f.db.prepare('SELECT * FROM official_pitch_workload_sources').get()).toEqual(original);
 f.db.exec("UPDATE official_pitch_workload_sources SET source_json='{}'");expect(()=>p.readAcceptedActivity(activity.sourceEventId)).toThrow('corrupt');
}));
const mutation=(mode:'row'|'replace'|'commit')=>fixture(f=>{
 let writer:DatabaseSync|undefined,witness=false;
 const scoring={...f.scoring,readAcceptedPlay:(id:string)=>{const value=f.scoring.readAcceptedPlay(id);const db=writer!;
  if(!witness&&db.isTransaction&&Number(db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()!.n)===1){
   const before=db.prepare('PRAGMA query_only').get()!.query_only;db.exec('PRAGMA query_only=OFF');
   if(mode==='row'){const changed=db.prepare('UPDATE official_pitch_workload_sources SET source_json=source_json').run();witness=Number(changed.changes)===1;}
   else if(mode==='replace'){
    const policyRow=db.prepare('SELECT * FROM official_pitch_workload_policies').get()!,sourceRow=db.prepare('SELECT * FROM official_pitch_workload_sources').get()!;db.exec('ROLLBACK');db.exec('BEGIN IMMEDIATE');
    for(const [table,row]of [['official_pitch_workload_policies',policyRow],['official_pitch_workload_sources',sourceRow]]as const){const keys=Object.keys(row);db.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(key=>row[key]));}witness=true;
   }else{db.exec('COMMIT');db.exec('BEGIN');witness=true;}
   db.exec('PRAGMA query_only='+before);
  }return value;}};
 const p=f.track(openSqliteOfficialPitchWorkloadStore(f.path,{scoring,participation:f.participation},{readAcceptedPolicy:()=>policy},db=>{writer=db as DatabaseSync;}));
 let rejected=false;try{p.accept(request);}catch{rejected=true;}expect(witness).toBe(true);expect(rejected,'EFFORT_HANDOFF_'+mode.toUpperCase()+'_ACCEPTED').toBe(true);
 const expected=mode==='commit'?1:0;expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_sources').get()).toEqual({n:expected});expect(f.db.prepare('SELECT count(*) AS n FROM official_pitch_workload_policies').get()).toEqual({n:expected});
 if(mode!=='row')expect(()=>p.readAcceptedActivity('anything')).toThrow(/closed|retired/);
});
it('EP-H02 rejects an actual byte-neutral Source write during the postinsert proof',()=>mutation('row'));
it('EP-H03 rejects and retires a replaced postinsert transaction with restored rows',()=>mutation('replace'));
it('EP-H04 rejects and retires a real committed handoff without compensating repair',()=>mutation('commit'));
