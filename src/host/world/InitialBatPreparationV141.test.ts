import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
import {readInitialQualifiedDecisionV135,initialQualifiedHeadsV135} from './InitialQualifiedPitchV135.test-support';
import {openSqliteMeasuredBattingBodyReferenceStore,measuredBattingBodyReferenceTable} from './SqliteMeasuredBattingBodyReferenceStore';
import {openSqliteInitialPitchHandHoldStore} from './SqliteInitialPitchHandHoldStore';
import {readInitialBatEquipmentFromSqlite} from './SqliteInitialBatEquipmentStore';
import {readInitialCoupledMeasuredBatControlPreparation} from './InitialMeasuredBatControlFromSqlite';
import {samePaExecutionReference as reference} from './SamePlateAppearanceExecutionFromSqlite';
import {withBattedWorldPhysicalReadTraversal} from './SqliteBattedWorldFieldExecutionStore';
import {withSamePaLifecycleReadPhase} from './SamePlateAppearanceLifecycleFromSqlite';
import {databaseCensusV139} from './InitialQualifiedJointV139.test-support';
import {createCoupledHeldMeasuredBatBodyControlV1} from '../../core/sim/contact/HeldToMeasuredBatControlV1';
import {createReferenceBatKinematicsV1} from '../../core/sim/contact/ReferenceBatKinematicsV1';

const manifest=process.env.BASEBALL_INITIAL_QUALIFIED_MANIFEST_V139;
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
/** Read-only preparation certificate, not a right or contact. The prospective
 * elevated author pose is fixed here before any physical ball query. */
it.skipIf(!manifest)('IBP141 certifies the explicit preparation pose with the original measured motion and all original Native body limits',()=>{
  if(!manifest)throw Error('explicit original qualified manifest required');
  const original=readInitialQualifiedDecisionV135(manifest),{prefix,decision}=original,{path}=prefix;
  const measured=decision.calculation.commitment?.sampledTrajectoryV1;
  if(!measured)throw Error('original measured commitment required');
  const before=databaseCensusV139(path),heads=initialQualifiedHeadsV135(path);
  const db=new Native(path,{readOnly:true});let bat;
  try{db.exec('PRAGMA query_only=1; BEGIN');
    bat=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>readInitialBatEquipmentFromSqlite(db,prefix.initialBatReference)));
    db.exec('COMMIT');
  }finally{db.close();}
  const bodyOwner=openSqliteMeasuredBattingBodyReferenceStore(path);let body;
  try{body=bodyOwner.read('iqj139:body');}finally{bodyOwner.close();}
  if(!body)throw Error('original body required; no repair');
  const handOwner=openSqliteInitialPitchHandHoldStore(path);let hand;
  try{hand=handOwner.read('iqj139:pitcher-hold');}finally{handOwner.close();}
  if(!hand)throw Error('original hand successor required; no repair');
  expect(hand.source.operationReference).toEqual(prefix.decisionReference);
  const measuredEnd=measured.startTick+(measured.frames.at(-1)!.tick-measured.frames[0].tick)
    /measured.sourceTicksPerSecond/measured.playbackRate*measured.ticksPerSecond;
  expect(hand.source.throughTick).toBe(Math.min(bat.binding.control.throughTick,Math.ceil(measuredEnd)-1));
  const bridgeStartTick=Math.max(decision.calculation.nominalRequest.source.bodyReadyTick,
    decision.evaluationTick+decision.calculation.effectiveValues.motor.motorLatencyTicks);
  const request={initialBatReference:prefix.initialBatReference,decisionReference:prefix.decisionReference,bridgeStartTick,
    throughTick:hand.source.throughTick,bodyControlReference:reference(measuredBattingBodyReferenceTable,body),
    preparationV141:{version:'explicit_bat_preparation_waypoints_v141' as const,
      waypoints:[{tick:Math.floor((bridgeStartTick+measured.startTick)/2),
        grip:{...bat.binding.control.grip,y:1.45},orientation:bat.binding.control.orientation}]}};
  process.stdout.write('IBP141-stage body-safe-preparation-start\n');
  const prepared=readInitialCoupledMeasuredBatControlPreparation(path,request);
  expect(prepared.motionIssued).toBe(false);expect(prepared.control.bat.version).toBe('held_to_measured_bat_control_v141');
  expect(prepared.control.bat.measured).toEqual(measured);
  expect(prepared.control.bat.initial).toEqual(bat.binding.control);
  const coupled=createCoupledHeldMeasuredBatBodyControlV1(prepared.control),raw=createReferenceBatKinematicsV1(measured);
  for(const tick of [measured.startTick,(measured.startTick+request.throughTick)/2,request.throughTick])
    expect(coupled.sampleContinuous(tick).state).toEqual(raw.sampleContinuous(tick).state);
  expect(databaseCensusV139(path)).toEqual(before);expect(initialQualifiedHeadsV135(path)).toBe(heads);
  process.stdout.write('IBP141-stage body-safe-preparation-ready\n');
},60_000);
