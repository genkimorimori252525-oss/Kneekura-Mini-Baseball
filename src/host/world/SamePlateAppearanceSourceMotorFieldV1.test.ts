import { sourceHostMotorFixture } from './SamePlateAppearanceSourceMotorFieldV1.test-support';
import { beforeEach, expect, it, vi } from 'vitest';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { samePaPhysicalDefenderSelf } from './SamePlateAppearancePhysicalFieldMotor';
import { deriveSamePaSourceFieldMetadataV3 } from './SamePlateAppearanceSourceFieldV3';
import { assertSamePaFieldBallPhysicsStep,
  SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as OLD, SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION as INTEGER } from './SamePlateAppearanceBallPhysics';
import { deriveSamePaSourceMotorFieldMotionV1 } from './SamePlateAppearanceSourceMotorFieldV1';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
const MOTOR = 'same_pa_field_step_aero_ground_motor_v1';
const mocked = vi.hoisted(() => ({ calibrations: new Map<string, any>(), models: new Map<string, any>(), posture: null as any }));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({ readSamePaLifecycleCalibrationFromSqlite: (_: unknown, r: {sourceId:string}) => mocked.calibrations.get(r.sourceId),
  readCurrentSamePaLifecycleCalibrationFromSqlite: (_: unknown, r: {sourceId:string}) => mocked.calibrations.get(r.sourceId) }));
vi.mock('./SqlitePlayerLocomotionModelStore', () => ({ playerLocomotionModelEvidenceFromSqlite: () => ({ read: (id: string) => mocked.models.get(id) }) }));
vi.mock('./SqliteBattingPerceptionStore', () => ({ readBattingPerceptionFromSqlite: () => mocked.posture }));
const ref = (f: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
beforeEach(() => { mocked.models.clear(); mocked.calibrations.clear(); mocked.posture = null; });

// Structural owner/model references, real original Source query and rated motor.
// This fixture does not authenticate Native Sources or measured player abilities.
const fixture = (catchAfterInteger = false) => sourceHostMotorFixture(mocked,catchAfterInteger);

it('connects complete owned team selections through real rated motor and Source replay, retaining all six roles and ball spin',()=>{
  const h=fixture(),before=h.history.at(-1)!.field.motion.cursor!,result=h.run();
  expect(result.actionResult.kind).toBe('defender_motion_v1');
  if(result.actionResult.kind!=='defender_motion_v1')throw new Error('motor missing');
  expect(result.actionResult.motors).toHaveLength(9);
  expect(new Set(result.actionResult.motors.map(m=>m.intent.kind)).size).toBe(6);
  if(!('ballSolverEvidence'in result)||!result.ballSolverEvidence||typeof result.ballSolverEvidence!=='object'||!('solverVersion'in result.ballSolverEvidence))throw new Error('Source solver evidence missing');
  expect(result.ballSolverEvidence!.solverVersion).toBe('source_field_motor_motion_v1');
  const cursor=result.field.motion.cursor!;
  expect(cursor.sourceCurve!.initial).toEqual(before.sourceCurve!.initial);
  expect(cursor.sourceCurve!.profile).toEqual(before.sourceCurve!.profile);
  expect(cursor.moment).toEqual(createSourceFreeBallKernel(cursor.sourceCurve!).evaluateAt(cursor.moment.elapsedSeconds,cursor.sourceSide).moment);
  const executed={...h.history.at(-1)!,...result,source:h.motorSource,kind:'same_pa_physical_field_step_v1',operationOrdinal:h.history.length} as SamePaPhysicalFieldStep;
  for(const motor of result.actionResult.motors){
    const actor=result.field.motion.actors.find(a=>a.playerId===motor.self.playerId&&a.primitive.role==='body')!;
    const dt=cursor.moment.elapsedSeconds-actor.startElapsedSeconds!;
    expect(actor.primitive.acceleration).toEqual(motor.command.bodyAcceleration);
    expect(actor.startElapsedSeconds).toBe(h.at.elapsedSeconds);
    const body=mocked.posture.sceneBodies.find((b:any)=>b.source.playerId===motor.self.playerId).actor;
    const self=samePaPhysicalDefenderSelf(h.action,h.root,executed,body);
    expect(Math.hypot(self.root.velocity.x,self.root.velocity.z)).toBeLessThanOrEqual(7);
    if(motor.intent.kind!=='hold'){
      expect(Math.hypot(actor.primitive.acceleration.x,actor.primitive.acceleration.z)*dt*dt/2).toBeGreaterThan(0);
      expect(self.root.position).not.toEqual(motor.self.root.position);
      expect(Math.hypot(self.root.velocity.x,self.root.velocity.z)).toBeGreaterThan(0);
    }else expect(self.root.position).toEqual(motor.self.root.position);
  }
});

it('preserves the real Source glove candidate as a terminal field without granting custody or allowing later free work',()=>{
  const h=fixture(true),result=h.run();
  expect(result.field.motion.response.kind).toBe('capture_candidate');
  expect(result.field.motion.cursor).toBeNull();expect(result.field.motion.carrierPlayerId).toBeNull();
  const field=h.append(h.motorSource,result),s=h.source(MOTOR,undefined,field.evaluationTick+1000);
  expect(()=>deriveSamePaPhysicalFieldStep(s,h.root,field,field.evaluationTick,false,h.history)).toThrow('concrete acquisition/response owner');
  expect(()=>deriveSamePaSourceFieldMetadataV3({...s,throughTick:field.evaluationTick,action:{kind:'defender_observation_v1'} as never},h.root,field,h.history)).toThrow('free cursor');
});

it('keeps per-record inert limits and rejects active, exotic, oversized or sparse replay envelopes',()=>{
  const h=fixture(),result=h.run();if(result.actionResult.kind!=='defender_motion_v1')throw new Error('motor result');
  const input={source:h.motorSource,root:h.root,previous:h.history.at(-1)!,history:h.history,actionResult:result.actionResult};
  let reads=0;
  expect(()=>deriveSamePaSourceMotorFieldMotionV1({...input,get history(){reads++;return h.history;}})).toThrow();expect(reads).toBe(0);
  expect(()=>deriveSamePaSourceMotorFieldMotionV1(Object.assign(new Date(),input))).toThrow();
  expect(()=>deriveSamePaSourceMotorFieldMotionV1({...input,history:Array(513).fill(h.root)})).toThrow();
  expect(()=>deriveSamePaSourceMotorFieldMotionV1({...input,history:Array(1)})).toThrow();
  expect(()=>deriveSamePaSourceMotorFieldMotionV1({...input,source:{...h.motorSource,oversized:Array(100001).fill(0)} as never})).toThrow('size limits');
});

it('replays later free/metadata history and rejects mutated original motors/evidence or returning to integer/old versions',()=>{
  const h=fixture(),motor=h.append(h.motorSource,h.run());
  const metadataSource=h.source(MOTOR,{kind:'defender_observation_v1'} as never);
  expect(deriveSamePaSourceFieldMetadataV3(metadataSource,h.root,motor,h.history).ballSolverEvidence).toEqual(motor.ballSolverEvidence);
  const s=h.source(MOTOR,undefined,motor.evaluationTick+1000),next=deriveSamePaPhysicalFieldStep(s,h.root,motor,motor.evaluationTick,false,h.history);
  expect(next.field.motion.world.kind).toBe('moving');
  for(const version of [INTEGER,OLD])expect(()=>assertSamePaFieldBallPhysicsStep({...s,sourceVersion:version},h.root.source,motor.source,false)).toThrow();
  const forged=structuredClone(motor);(forged.actionResult as any).motors[0].command.bodyAcceleration.x+=1;
  expect(()=>deriveSamePaPhysicalFieldStep({...s,previousFieldReference:ref(forged),previousOperationReference:ref(forged)},h.root,forged,forged.evaluationTick,false,[...h.history.slice(0,-1),forged])).toThrow();
});

it('rejects legacy/subset/stale team selections and future first-step or invalid body calibration before any Source movement',()=>{
  for(const edit of [
    (h:ReturnType<typeof fixture>)=>{(h.motorSource.action as any).selections.pop();},
    (h:ReturnType<typeof fixture>)=>{(h.motorSource.action as any).selections[0].decisionReference=ref(h.history[4]);},
    (h:ReturnType<typeof fixture>)=>{((h.history.at(-1)! as SamePaPhysicalFieldStep).actionResult as any).scheduling.movementStartTick+=1;},
    ()=>{mocked.calibrations.get('p1cal').source.response.values.topSpeedMps=-1;},
  ]){const h=fixture();edit(h);expect(h.run).toThrow();}
  const h=fixture();expect(()=>deriveSamePaSourceMotorFieldMotionV1({source:{...h.motorSource,sourceVersion:INTEGER},root:h.root,previous:h.history.at(-1)!,history:h.history,actionResult:{kind:'defender_motion_v1',motors:[],coverageThroughTick:0}})).toThrow();
});
