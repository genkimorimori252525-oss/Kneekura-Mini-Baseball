import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
import {prepareInitialCoupledMeasuredBatControlFromSqlite} from './InitialMeasuredBatControlFromSqlite';

const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const ref=(owner:string)=>({owner,sourceId:'synthetic-input-boundary',sourceHash:'1'.repeat(64),snapshotHash:'2'.repeat(64)});
it.each([null,false,0,''])('rejects explicitly malformed preparation %j at the Native input boundary before original dependencies are read',preparationV141=>{
  const db=new Native(':memory:');
  try{
    const raw=JSON.parse(JSON.stringify({initialBatReference:ref('batting_initial_equipment_v1_sources'),
      decisionReference:ref('pa_observed_initial_v1_operations'),bodyControlReference:ref('batting_measured_body_v1_sources'),
      bridgeStartTick:100000,throughTick:599999,preparationV141}));
    expect(()=>prepareInitialCoupledMeasuredBatControlFromSqlite(db,raw)).toThrow(/invalid explicit preparation/);
    expect(db.prepare('SELECT count(*) AS n FROM sqlite_schema').get()!.n).toBe(0);
  }finally{db.close();}
});
