import { beforeEach,expect,it,vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sourceHostMotorFixture } from './SamePlateAppearanceSourceMotorFieldV1.test-support';
import { readSamePaSourceMotorPrefixV1 } from './SamePlateAppearanceSourceMotorFieldV1';
import { deriveSamePaSourceAcquisitionFieldV1 } from './SamePlateAppearanceSourceAcquisitionFieldV1';
import { deriveSourceBattedFieldAcquisitionV1 } from '../../core/sim/ball/SourceBattedFieldAcquisitionV1';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { deriveSamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldActionFromSqlite';
import { assertSamePaFieldBallPhysicsStep } from './SamePlateAppearanceBallPhysics';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const VERSION='same_pa_field_step_aero_ground_acquisition_v1';
const mocked=vi.hoisted(()=>({calibrations:new Map<string,any>(),models:new Map<string,any>(),posture:null as any}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite',()=>({readSamePaLifecycleCalibrationFromSqlite:(_:unknown,r:{sourceId:string})=>mocked.calibrations.get(r.sourceId),
  readCurrentSamePaLifecycleCalibrationFromSqlite:(_:unknown,r:{sourceId:string})=>mocked.calibrations.get(r.sourceId)}));
vi.mock('./SqlitePlayerLocomotionModelStore',()=>({playerLocomotionModelEvidenceFromSqlite:()=>({read:(id:string)=>mocked.models.get(id)})}));
vi.mock('./SqliteBattingPerceptionStore',()=>({readBattingPerceptionFromSqlite:()=>mocked.posture}));
beforeEach(()=>{mocked.calibrations.clear();mocked.models.clear();mocked.posture=null;});
// Ancestry/model bindings are structural fixtures. Source ball, all nine rated
// motors and timed glove acquisition use production physics, not Native proof.
const fixture=(wallX?:number)=>{
  const h=sourceHostMotorFixture(mocked,true,{capturePowerW:10000,...(wallX===undefined?{}:{wallX})});
  const candidate=h.append(h.motorSource,h.run());
  const prefix=readSamePaSourceMotorPrefixV1({root:h.root,history:h.history});
  const original=deriveSourceBattedFieldAcquisitionV1({initial:prefix.initial,actions:prefix.actions,captureThroughElapsedSeconds:[]});
  const candidateReference=reference('pa_physical_v1_field_steps',candidate);
  const source=(throughElapsedSeconds:number)=>h.source(VERSION,{kind:'capture_checkpoint_v1',candidateReference,throughElapsedSeconds},
    quantizeEventTick(original.plan.contactMoment.originTick,throughElapsedSeconds,1e6));
  const run=(throughElapsedSeconds:number)=>{const previous=h.history.at(-1)!;
    const view={...h.basis.view,cut:{...h.basis.view.cut,evaluationTick:previous.evaluationTick}};
    const s={...source(throughElapsedSeconds),viewReference:reference('pa_lifecycle_v1_execution_views',view)};
    const result=deriveSamePaPhysicalFieldAction({} as DatabaseSync,s,h.root,previous,h.action,{...h.basis,view},h.history,false);
    return h.append(s,result);};
  return{...h,candidate,prefix,original,candidateReference,source,run};
};

it('reads the real terminal motor prefix without a fake future Source and keeps caller replacement state closed',()=>{
  const h=fixture();expect(h.prefix.trace.field).toEqual(h.candidate.field);
  expect(h.original.freeTrace.field).toEqual(h.candidate.field);
  expect(h.prefix.actions.filter(a=>a.kind==='adopt')).toHaveLength(1);
  let reads=0;
  expect(()=>readSamePaSourceMotorPrefixV1({root:h.root,get history(){reads++;return h.history;}})).toThrow();expect(reads).toBe(0);
  expect(()=>readSamePaSourceMotorPrefixV1({...{root:h.root,history:h.history},cursor:{}} as never)).toThrow();
});

it('dispatches actual candidate through absorption and recorded fence while retaining timeline and Source evidence',()=>{
  const h=fixture(),p=h.original.plan,timeline=JSON.stringify(h.candidate.timeline);
  expect(h.candidate.timeline.status.kind).toBe('batted_ball_pending');
  expect(h.candidate.timeline.events.filter(event=>event.kind==='BattedBallFirstGroundContact')).toHaveLength(1);
  const pending=h.run((p.contactMoment.elapsedSeconds+p.secureElapsedSeconds)/2);
  expect(pending.field.motion.response.kind).toBe('capture_pending');expect(pending.field.motion.carrierPlayerId).toBeNull();
  const fence=h.run(p.secureElapsedSeconds);expect(fence.actionResult?.kind).toBe('capture_checkpoint_v1');
  if(fence.actionResult?.kind!=='capture_checkpoint_v1')throw new Error('capture progress required');
  expect(fence.actionResult.progress.kind).toBe(p.fenceElapsedSeconds>p.secureElapsedSeconds?'fence_pending':'secured');
  const secured=p.fenceElapsedSeconds>p.secureElapsedSeconds?h.run(p.fenceElapsedSeconds):fence;
  expect(secured.field.motion.response.kind).toBe('carried');expect(secured.field.motion.carrierPlayerId).toBe(p.acquirerPlayerId);
  expect(secured.field.motion.cursor!.moment.elapsedSeconds).toBe(p.fenceElapsedSeconds);
  expect(secured.field.motion.cursor!.sourceCurve).toBeUndefined();
  expect(JSON.stringify(secured.timeline)).toBe(timeline);
  expect(secured.ballSolverEvidence).toMatchObject({solverVersion:'source_field_acquisition_v1',freeSolverVersion:'source_field_motor_motion_v1'});
  expect(()=>h.run(p.fenceElapsedSeconds+.001)).toThrow('terminal');
});

it('rederives atomic capture identically and rejects changed candidate refs, clocks, progress and legacy transitions',()=>{
  const h=fixture(),p=h.original.plan,source=h.source(p.fenceElapsedSeconds);
  const result=deriveSamePaSourceAcquisitionFieldV1({source,root:h.root,previous:h.candidate,history:h.history});
  expect(result.field).toEqual(deriveSourceBattedFieldAcquisitionV1({initial:h.prefix.initial,actions:h.prefix.actions,captureThroughElapsedSeconds:[p.fenceElapsedSeconds]}).field);
  expect(()=>deriveSamePaSourceAcquisitionFieldV1({source:{...source,throughTick:source.throughTick+1},root:h.root,previous:h.candidate,history:h.history})).toThrow();
  expect(()=>deriveSamePaSourceAcquisitionFieldV1({source:{...source,action:{...source.action!,candidateReference:{...h.candidateReference,snapshotHash:'f'.repeat(64)}} as never},root:h.root,previous:h.candidate,history:h.history})).toThrow();
  for(const action of [undefined,{kind:'defender_motion_v1'},{kind:'defender_observation_v1'}])expect(()=>assertSamePaFieldBallPhysicsStep({...source,...(action?{action}:{}),action},h.root.source,h.candidate.source,false)).toThrow();
  const partial=h.run((p.contactMoment.elapsedSeconds+p.secureElapsedSeconds)/2),forged=structuredClone(partial);
  if(forged.actionResult?.kind!=='capture_checkpoint_v1')throw new Error('capture progress required');
  (forged.actionResult.progress.transport as any).remainingEnergyJ+=1;
  const next={...h.source(p.fenceElapsedSeconds),previousFieldReference:reference('pa_physical_v1_field_steps',forged),previousOperationReference:reference('pa_physical_v1_field_steps',forged)};
  expect(()=>deriveSamePaSourceAcquisitionFieldV1({source:next,root:h.root,previous:forged,history:[...h.history.slice(0,-1),forged]})).toThrow();
  for(const version of ['same_pa_field_step_aero_ground_motor_v1','same_pa_field_step_aero_ground_integer_boundary_v1','same_pa_field_step_aero_ground_escape_v3'])
    expect(()=>assertSamePaFieldBallPhysicsStep({...next,sourceVersion:version},h.root.source,partial.source,false)).toThrow();
});

it('retains a real competing wall as interrupted and never promotes it to possession',()=>{
  const base=fixture(),p=base.original.plan,dt=p.secureElapsedSeconds-p.contactMoment.elapsedSeconds;
  const wallX=p.contactMoment.ball.position.x+.0366+Math.max(1e-7,p.initialConstraintMoment.ball.velocity.x*dt/4);
  mocked.calibrations.clear();mocked.models.clear();const h=fixture(wallX),end=h.run(h.original.plan.fenceElapsedSeconds);
  expect(end.field.motion.response.kind).toBe('capture_interrupted');expect(end.field.motion.carrierPlayerId).toBeNull();expect(end.field.motion.cursor).toBeNull();
  expect(end.field.motion.world.kind).toBe('boundary');
  expect(()=>h.run(h.original.plan.fenceElapsedSeconds+.001)).toThrow('terminal');
});
