import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
import {readInitialQualifiedDecisionV135,initialQualifiedHeadsV135} from './InitialQualifiedPitchV135.test-support';
import {readInitialBatEquipmentFromSqlite} from './SqliteInitialBatEquipmentStore';
import {openSqliteInitialPitchHandHoldStore,initialPitchHandHoldTable,type AcceptedInitialPitchHandHoldV1} from './SqliteInitialPitchHandHoldStore';
import {withBattedWorldPhysicalReadTraversal} from './SqliteBattedWorldFieldExecutionStore';
import {withSamePaLifecycleReadPhase} from './SamePlateAppearanceLifecycleFromSqlite';
import {databaseCensusV139} from './InitialQualifiedJointV139.test-support';
import {deepStrictEqual} from 'node:assert';

const manifest=process.env.BASEBALL_INITIAL_QUALIFIED_MANIFEST_V139;
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
/** One isolated next Owner boundary, not a rerun of B and not physics. The
 * original B's exact successor Source is admitted at most once by its Owner. */
it.skipIf(!manifest)('IQHP139 isolates the original prospective pitcher hand successor after the committed body reference',()=>{
  if(!manifest)throw Error('explicit qualified Native manifest locator required');
  process.stdout.write('IQHP139-stage original-decision-read-start\n');
  const original=readInitialQualifiedDecisionV135(manifest),{prefix,decision}=original,{path}=prefix;
  expect(decision.calculation.commitment?.action).toBe('SWING');
  const measured=decision.calculation.commitment?.sampledTrajectoryV1;
  if(!measured)throw Error('original measured commitment required');
  const db=new Native(path,{readOnly:true});let throughTick;
  try{
    db.exec('PRAGMA query_only=1; BEGIN');
    const bat=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>readInitialBatEquipmentFromSqlite(db,prefix.initialBatReference)));
    const end=measured.startTick+(measured.frames.at(-1)!.tick-measured.frames[0].tick)/measured.sourceTicksPerSecond/measured.playbackRate*measured.ticksPerSecond;
    throughTick=Math.min(bat.binding.control.throughTick,Math.ceil(end)-1);
    db.exec('COMMIT');
  }finally{db.close();}
  const before=databaseCensusV139(path),beforeHeads=initialQualifiedHeadsV135(path);
  const source:AcceptedInitialPitchHandHoldV1={sourceId:'iqj139:pitcher-hold',sourceVersion:'explicit-synthetic-qualified-initial-joint-v139',
    capability:'owned_initial_pitch_hand_hold_v1',operationReference:prefix.decisionReference,throughTick};
  process.stdout.write('IQHP139-stage hand-owner-open-start\n');
  const owner=openSqliteInitialPitchHandHoldStore(path,{readAcceptedHandHold:id=>id===source.sourceId?source:null});
  try{
    process.stdout.write('IQHP139-stage hand-accept-start\n');
    let value;
    try{value=owner.accept(source.sourceId);}catch(error){
      process.stdout.write('IQHP139-original-error '+JSON.stringify(error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error))+'\n');
      throw error;
    }
    process.stdout.write('IQHP139-stage hand-accept-returned\n');
    expect(value.kind).toBe('initial_pitch_hand_hold_renewal_v1');
  }finally{process.stdout.write('IQHP139-stage hand-owner-close-start\n');owner.close();}
  const after=databaseCensusV139(path);
  for(const old of before.tables)deepStrictEqual(after.tables.find(t=>t.name===old.name),old);
  expect(after.tables.filter(t=>!before.tables.some(b=>b.name===t.name)).map(t=>t.name)).toEqual([initialPitchHandHoldTable]);
  expect(initialQualifiedHeadsV135(path)).toBe(beforeHeads);
  process.stdout.write('IQHP139-stage hand-probe-ready\n');
},60_000);
