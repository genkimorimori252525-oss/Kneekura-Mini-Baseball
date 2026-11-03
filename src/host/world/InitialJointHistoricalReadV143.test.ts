import {createRequire} from 'node:module';
import {beforeEach,expect,it,vi} from 'vitest';
import {prepareInitialOwnedJointControlFromSqlite,readHistoricalInitialOwnedJointControlFromSqlite} from './InitialOwnedJointControlPreparationFromSqlite';
import {withSamePaLifecycleReadPhase} from './SamePlateAppearanceLifecycleFromSqlite';
import type {InitialOwnedJointControlRequestV1} from './InitialOwnedJointControlPreparationFromSqlite';
import type {SamePaReference} from './SamePlateAppearanceWorkPrefix';

const reads=vi.hoisted(()=>({historical:vi.fn(),current:vi.fn(),body:vi.fn(),hold:vi.fn()}));
vi.mock('./InitialMeasuredBatControlFromSqlite',()=>({
  readHistoricalInitialCoupledMeasuredBatControlFromSqlite:reads.historical,prepareInitialCoupledMeasuredBatControlFromSqlite:reads.current}));
vi.mock('./SqliteMeasuredBattingBodyReferenceStore',()=>({readMeasuredBattingBodyReferenceFromSqlite:reads.body}));
vi.mock('./SqliteInitialPitchHandHoldStore',()=>({readInitialPitchHandHoldControlFromSqlite:reads.hold}));
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const ref=<T extends string>(owner:T):SamePaReference<T>=>({owner,sourceId:'synthetic-phase-input',sourceHash:'1'.repeat(64),snapshotHash:'2'.repeat(64)});
const request=():InitialOwnedJointControlRequestV1=>({batter:{initialBatReference:ref('batting_initial_equipment_v1_sources'),
  decisionReference:ref('pa_observed_initial_v1_operations'),bodyControlReference:ref('batting_measured_body_v1_sources'),bridgeStartTick:300,throughTick:900},
  pitcherHandHoldReference:ref('pa_pitch_hand_hold_v1_sources')});
beforeEach(()=>{
  const p=request(),lineage={careerId:'synthetic-memo-seam'};
  const batter=()=>({lineage,evaluatedAtTick:100,control:{bat:{throughTick:900}},certificate:{synthetic:true}});
  reads.historical.mockReset().mockImplementation(batter);reads.current.mockReset().mockImplementation(batter);
  reads.body.mockReset().mockImplementation(()=>({playerId:'synthetic-batter'}));
  reads.hold.mockReset().mockImplementation(()=>({hold:{lineage,source:{operationReference:p.batter.decisionReference},
    request:{fromTick:200,throughTick:900},issuedAtTick:100,pitcherPlayerId:'synthetic-pitcher'},
    original:{control:{anchors:{followThroughEndTick:200},descriptor:{initial:{originTick:0}}}}}));
});
function database(run:(db:InstanceType<typeof Native>)=>void,q1=true){
  const db=new Native(':memory:');db.exec('CREATE TABLE witness(n INTEGER)');
  if(q1)db.exec('PRAGMA query_only=1; BEGIN');
  try{run(db);}finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
}

it('shares only complete frozen historical control inside one actual Native immutable phase',()=>database(db=>{
  withSamePaLifecycleReadPhase(db,()=>{
    const a=readHistoricalInitialOwnedJointControlFromSqlite(db,request()),b=readHistoricalInitialOwnedJointControlFromSqlite(db,request());
    expect(a).toBe(b);expect(Object.isFrozen(a)).toBe(true);
    expect(reads.historical).toHaveBeenCalledTimes(1);expect(reads.hold).toHaveBeenCalledTimes(1);
  });
}));
it('keys the full route, lease and original reference pins without sharing current admission',()=>database(db=>{
  withSamePaLifecycleReadPhase(db,()=>{
    const p=request();readHistoricalInitialOwnedJointControlFromSqlite(db,p);
    readHistoricalInitialOwnedJointControlFromSqlite(db,{...p,batter:{...p.batter,bodyControlReference:{...p.batter.bodyControlReference,snapshotHash:'3'.repeat(64)}}});
    readHistoricalInitialOwnedJointControlFromSqlite(db,{...p,batter:{...p.batter,preparationV141:{version:'explicit_bat_preparation_waypoints_v141',
      waypoints:[{tick:400,grip:{x:0,y:1.45,z:0},orientation:{x:0,y:0,z:0,w:1}}]}}});
    readHistoricalInitialOwnedJointControlFromSqlite(db,{...p,batter:{...p.batter,bridgeStartTick:301}});
    readHistoricalInitialOwnedJointControlFromSqlite(db,{...p,batter:{...p.batter,throughTick:899}});
    prepareInitialOwnedJointControlFromSqlite(db,p);prepareInitialOwnedJointControlFromSqlite(db,p);
    expect(reads.historical).toHaveBeenCalledTimes(5);expect(reads.current).toHaveBeenCalledTimes(2);
  });
}));
it('discards completed proofs across phases and connections',()=>{
  database(db=>{for(let i=0;i<2;i++)withSamePaLifecycleReadPhase(db,()=>readHistoricalInitialOwnedJointControlFromSqlite(db,request()));});
  database(db=>withSamePaLifecycleReadPhase(db,()=>readHistoricalInitialOwnedJointControlFromSqlite(db,request())));
  expect(reads.historical).toHaveBeenCalledTimes(3);
});
it.each(['q0-no-tx','q0-tx','q1-no-tx'] as const)('keeps %s compatibility uncached',mode=>database(db=>{
  if(mode==='q0-tx')db.exec('BEGIN');if(mode==='q1-no-tx')db.exec('PRAGMA query_only=1');
  readHistoricalInitialOwnedJointControlFromSqlite(db,request());readHistoricalInitialOwnedJointControlFromSqlite(db,request());
  expect(reads.historical).toHaveBeenCalledTimes(2);
},false));
it.each(['DML','main-schema','temp-schema','user-version','query-mode','commit','attached-namespace'] as const)('rejects %s drift rather than returning a completed historical proof',fault=>database(db=>{
  expect(()=>withSamePaLifecycleReadPhase(db,()=>{
    readHistoricalInitialOwnedJointControlFromSqlite(db,request());db.exec('PRAGMA query_only=0');
    if(fault==='DML')db.exec('INSERT INTO witness VALUES(1)');
    if(fault==='main-schema')db.exec('CREATE TABLE added(n INTEGER)');
    if(fault==='temp-schema')db.exec('CREATE TEMP TABLE added(n INTEGER)');
    if(fault==='user-version')db.exec('PRAGMA user_version=2');
    if(fault==='commit')db.exec('COMMIT; BEGIN');
    if(fault==='attached-namespace')db.exec("ATTACH ':memory:' AS foreign_owner");
    if(fault!=='query-mode')db.exec('PRAGMA query_only=1');
    readHistoricalInitialOwnedJointControlFromSqlite(db,request());
  })).toThrow();
}));
it('poisons a phase after a caught q0 read even when q1 and all counters are restored',()=>database(db=>{
  expect(()=>withSamePaLifecycleReadPhase(db,()=>{
    readHistoricalInitialOwnedJointControlFromSqlite(db,request());db.exec('PRAGMA query_only=0');
    expect(()=>readHistoricalInitialOwnedJointControlFromSqlite(db,request())).toThrow(/expired|mutable/);
    db.exec('PRAGMA query_only=1');
    expect(()=>readHistoricalInitialOwnedJointControlFromSqlite(db,request())).toThrow(/expired/);
  })).toThrow(/expired/);
}));
it('invalidates the phase after a dependency failure even when the caller catches it',()=>database(db=>{
  reads.historical.mockImplementationOnce(()=>{throw Error('synthetic dependency failure');});
  expect(()=>withSamePaLifecycleReadPhase(db,()=>{
    expect(()=>readHistoricalInitialOwnedJointControlFromSqlite(db,request())).toThrow(/dependency failure/);
    expect(()=>readHistoricalInitialOwnedJointControlFromSqlite(db,request())).toThrow(/expired/);
  })).toThrow(/expired/);
}));
it('rejects recursive historical derivation instead of publishing an incomplete proof',()=>database(db=>{
  let calls=0;reads.historical.mockImplementation(()=>{
    if(++calls>3)throw Error('synthetic recursion limit');
    return readHistoricalInitialOwnedJointControlFromSqlite(db,request());
  });
  expect(()=>withSamePaLifecycleReadPhase(db,()=>readHistoricalInitialOwnedJointControlFromSqlite(db,request()))).toThrow(/cycle/);
}));
it('rejects accessors before cache key creation without invoking them or a dependency again',()=>database(db=>{
  withSamePaLifecycleReadPhase(db,()=>{
    readHistoricalInitialOwnedJointControlFromSqlite(db,request());let getterCalls=0;
    const raw=request();Object.defineProperty(raw.batter,'untrusted',{enumerable:true,get(){getterCalls++;return 1;}});
    expect(()=>readHistoricalInitialOwnedJointControlFromSqlite(db,raw)).toThrow(/accessors/);
    expect(getterCalls).toBe(0);expect(reads.historical).toHaveBeenCalledTimes(1);
  });
}));
