import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import * as runtime from './BatterRunnerRuntime';
const open = () => {
  const fn=(runtime as unknown as {openSqliteBatterSwingExitStateStore?:(path:string,authority?:{readAcceptedState(id:string):unknown})=>{accept(id:string):unknown;read(id:string):unknown;close():void}}).openSqliteBatterSwingExitStateStore;
  expect(fn,'original physical swing-exit state Native intake is missing').toBeTypeOf('function');return fn!;
};
it('BSN01 does not promote accepted orientation into state when the original physical owner is absent',()=>{
  const factory=open(),directory=mkdtempSync(join(tmpdir(),'batter-run-boundary-')),path=join(directory,'state.sqlite');
  const pin=(owner:string)=>({owner,sourceId:'missing',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)});
  const source={sourceId:'exit-state',sourceVersion:'explicit-test-v1',capability:'same_pa_batter_swing_exit_state_v1',
    fieldReference:pin('pa_physical_v1_field_roots'),transitionModelReference:pin('world_player_batter_run_transition_models'),bodyForwardUnit:{x:1,z:0}};
  const store=factory(path,{readAcceptedState:()=>source});
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path);
  try{expect(()=>store.accept(source.sourceId)).toThrow(/physical|prerequisite|owner|schema/);expect(store.read(source.sourceId)).toBeNull();
    expect(db.prepare('SELECT count(*) AS n FROM main.world_batter_swing_exit_states').get()!.n).toBe(0);
  }finally{db.close();store.close();rmSync(directory,{recursive:true});}
});
it('BSN02 rejects lifecycle-claimed missing plans without repairing their row or absent table',()=>{
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const directory=mkdtempSync(join(tmpdir(),'batter-plan-orphan-'));
  const factory=runtime.openSqliteBatterRunPlanStore;
  const reference={owner:'world_batter_run_plans',sourceId:'deleted-plan',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)};
  const source=JSON.stringify({eventReferences:[reference]});
  // Raw damaged descendants exercise missing-original metadata fences only;
  // these small databases are not claims of a complete lifecycle ancestry.
  const mirrors=[[source,'{}'],['{}',JSON.stringify({source:JSON.parse(source)})],
    [source.slice(0,-1)+',"eventReferences":[]}','{}'],['{}','{"source":'+source+',"source":{}}']];
  try{for(const [index,[sourceJson,snapshotJson]] of mirrors.entries()){
    const path=join(directory,index+'.sqlite'),store=factory(path),db=new DatabaseSync(path);
    let replacement:ReturnType<typeof factory>|undefined;
    try{
      db.exec('CREATE TABLE pa_lifecycle_v1_work_prefixes(source_json TEXT,snapshot_json TEXT)');
      db.prepare('INSERT INTO pa_lifecycle_v1_work_prefixes VALUES (?,?)').run(sourceJson,snapshotJson);
      const before=db.prepare('SELECT rowid,* FROM pa_lifecycle_v1_work_prefixes').all();
      expect(()=>store.read(reference.sourceId)).toThrow(/surviving typed.*claim/);
      expect(db.prepare('SELECT * FROM world_batter_run_plans').all()).toEqual([]);
      db.exec('DROP TABLE world_batter_run_plans');
      expect(()=>store.read(reference.sourceId)).toThrow(/surviving typed.*claim/);
      store.close();
      expect(()=>{replacement=factory(path);}).toThrow(/surviving typed.*claim/);
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='world_batter_run_plans'").get()).toBeUndefined();
      expect(db.prepare('SELECT rowid,* FROM pa_lifecycle_v1_work_prefixes').all()).toEqual(before);
    }finally{replacement?.close();store.close();db.close();}
  }}finally{rmSync(directory,{recursive:true});}
});
