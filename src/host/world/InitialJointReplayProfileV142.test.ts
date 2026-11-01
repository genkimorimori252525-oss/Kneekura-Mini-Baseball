import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {databaseCensusV139,replayInitialQualifiedJointV139} from './InitialQualifiedJointV139.test-support';
import {initialQualifiedHeadsV135} from './InitialQualifiedPitchV135.test-support';
import {initialJointExecutionTable} from './InitialJointPhysicalExecutionMetadata';
import type {SamePaReference} from './SamePlateAppearanceWorkPrefix';

const timings=vi.hoisted(()=>({rows:[] as {phase:string;ms:number}[],
  run<T>(phase:string,fn:()=>T):T{const start=performance.now();try{return fn();}finally{
    const ms=performance.now()-start;this.rows.push({phase,ms});process.stdout.write('IQP142-phase '+phase+' '+ms.toFixed(3)+'ms\n');
  }}
}));
vi.mock('./InitialOwnedJointControlPreparationFromSqlite',async load=>{
  const original=await load<typeof import('./InitialOwnedJointControlPreparationFromSqlite')>();
  return {...original,readHistoricalInitialOwnedJointControlFromSqlite:(...args:Parameters<typeof original.readHistoricalInitialOwnedJointControlFromSqlite>)=>
    timings.run('historical-joint-control',()=>original.readHistoricalInitialOwnedJointControlFromSqlite(...args))};
});
vi.mock('./InitialOwnedJointPhysicalCalculationFromSqlite',async load=>{
  const original=await load<typeof import('./InitialOwnedJointPhysicalCalculationFromSqlite')>();
  return {...original,calculateHistoricalInitialOwnedJointPhysicalFromSqlite:(...args:Parameters<typeof original.calculateHistoricalInitialOwnedJointPhysicalFromSqlite>)=>
    timings.run('historical-physical-calculation',()=>original.calculateHistoricalInitialOwnedJointPhysicalFromSqlite(...args))};
});
vi.mock('../../core/sim/pitch/ControlledBatBodyPitchWorldV1',async load=>{
  const original=await load<typeof import('../../core/sim/pitch/ControlledBatBodyPitchWorldV1')>();
  return {...original,queryControlledBatBodyPitchWorldV1:(...args:Parameters<typeof original.queryControlledBatBodyPitchWorldV1>)=>
    timings.run('pure-controlled-world-query',()=>original.queryControlledBatBodyPitchWorldV1(...args))};
});

const manifest=process.env.BASEBALL_INITIAL_QUALIFIED_MANIFEST_V139;
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
it.skipIf(!manifest)('IQP142 authenticates the committed original execution through its query-only Owner and profiles unchanged replay without issuing motion',()=>{
  if(!manifest)throw Error('explicit original Native manifest required');
  const {path}=JSON.parse(readFileSync(manifest,'utf8')) as {path:string};
  const before=databaseCensusV139(path),heads=initialQualifiedHeadsV135(path),db=new Native(path,{readOnly:true});let ref;
  try{
    const row=db.prepare('SELECT source_id,source_hash,snapshot_hash FROM main.'+initialJointExecutionTable+' WHERE source_id=?').get('iqj141:execution');
    if(!row)throw Error('committed original execution required; no repair or new admission');
    const locator:SamePaReference<typeof initialJointExecutionTable>={owner:initialJointExecutionTable,
      sourceId:String(row.source_id),sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)};
    ref=locator;
  }finally{db.close();}
  process.stdout.write('IQP142-stage original-query-only-owner-replay-start\n');
  const execution=replayInitialQualifiedJointV139(path,ref),physical=execution.calculation.result;
  expect(physical.kind).toBe('bat_contact');
  if(physical.kind!=='bat_contact')throw Error('actual measured contact required');
  const bat=execution.calculation.input.batterControl.bat;
  expect(bat.version).toBe('held_to_measured_bat_control_v141');
  const end=bat.measured.startTick+(bat.measured.frames.at(-1)!.tick-bat.measured.frames[0].tick)
    /bat.measured.sourceTicksPerSecond/bat.measured.playbackRate*bat.measured.ticksPerSecond;
  const tick=physical.moment.originTick+physical.moment.elapsedSeconds*1e6;
  expect(tick).toBeGreaterThanOrEqual(bat.measured.startTick);expect(tick).toBeLessThan(end);
  expect(physical.contact.normalImpulseNs).toBeGreaterThan(0);
  expect(execution.timeline.events.filter(e=>e.kind==='BatBallContact')).toHaveLength(1);
  expect(execution.stop.nextMotionAllowed).toBe(false);expect(execution.stop.workloadTotalAdmitted).toBe(false);
  expect(execution.physicalWork.assessmentStatus).toBe('REQUIRES_NONEMPTY_WORKLOAD_SETTLEMENT');
  expect(timings.rows.some(t=>t.phase==='pure-controlled-world-query')).toBe(true);
  expect(databaseCensusV139(path)).toEqual(before);expect(initialQualifiedHeadsV135(path)).toBe(heads);
  process.stdout.write('IQP142-stage original-query-only-owner-replay-ready '+JSON.stringify(timings.rows)+'\n');
},120_000);
