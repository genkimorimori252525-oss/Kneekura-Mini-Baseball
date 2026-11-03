import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveSourceBattedFieldAcquisitionV1 } from '../../core/sim/ball/SourceBattedFieldAcquisitionV1';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { readSamePaSourceMotorPrefixV1 } from './SamePlateAppearanceSourceMotorFieldV1';
import { assertSamePaFieldBallPhysicsStep, SAME_PA_AERO_GROUND_ACQUISITION_FIELD_STEP_SOURCE_VERSION as VERSION,
  SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION as MOTOR } from './SamePlateAppearanceBallPhysics';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalFieldRoot,SamePaPhysicalFieldStep,SamePaPhysicalFieldStepSource,SamePaFieldBallSolverEvidenceAcquisitionV1 } from './SamePlateAppearancePhysicalEpisode';
type Field=SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep;
type Input=Readonly<{source:SamePaPhysicalFieldStepSource;root:SamePaPhysicalFieldRoot;previous:Field;history:readonly Field[]}>;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('same-PA Source acquisition original history differs');};
const ref=(f:Field)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
const copied=(raw:Input):Input=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw))||Object.getOwnPropertySymbols(raw).length)
    throw new Error('invalid Source acquisition envelope');
  const d:Record<string,PropertyDescriptor>=Object.getOwnPropertyDescriptors(raw);
  if(Object.keys(d).sort().join('|')!=='history|previous|root|source'||Object.values(d).some(v=>!('value'in v)||!v.enumerable))
    throw new Error('invalid Source acquisition properties');
  const rows=d.history.value;
  if(!Array.isArray(rows)||Object.getOwnPropertySymbols(rows).length)throw new Error('invalid Source acquisition history');
  const entries=Object.getOwnPropertyDescriptors(rows) as unknown as Record<string,PropertyDescriptor>,length=entries.length.value;
  if(!Number.isSafeInteger(length)||length<1||length>512||Object.keys(entries).length!==length+1
    ||Array.from({length},(_,i)=>entries[String(i)]).some(v=>!v||!('value'in v)||!v.enumerable))throw new Error('invalid Source acquisition records');
  return{source:cloneInert(d.source.value),root:cloneInert(d.root.value),previous:cloneInert(d.previous.value),
    history:Array.from({length},(_,i)=>cloneInert(entries[String(i)].value))};
};

/** Native authenticates all original rows/current view before this composition.
 * Reconstruct free Source/motors and the sole actual glove candidate, then let
 * the existing timed energy/fence kernel own every capture delta. No saved
 * plan, cursor, candidate payload or completed possession is accepted as input. */
export const deriveSamePaSourceAcquisitionFieldV1=(raw:Input)=>{
  const{source,root,previous,history}=copied(raw);
  if(source.sourceVersion!==VERSION)throw new Error('Source acquisition requires its explicit version');
  same(history[0],root);same(history.at(-1),previous);
  const first=history.findIndex(f=>f.source.sourceVersion===VERSION),cut=first<0?history.length:first;
  const candidate=history[cut-1];
  if(!candidate||candidate.kind!=='same_pa_physical_field_step_v1'||candidate.source.sourceVersion!==MOTOR)
    throw new Error('Source acquisition requires the immediate original motor candidate');
  const prefix=readSamePaSourceMotorPrefixV1({root,history:history.slice(0,cut)}),candidateReference=ref(candidate);
  const priorCaptures=history.slice(cut),captureSources=[...priorCaptures.map(f=>f.source as SamePaPhysicalFieldStepSource),source];
  const elapsed:number[]=[];
  for(const[i,s]of captureSources.entries()){
    const prior=i===0?candidate:priorCaptures[i-1],a=s.action;
    assertSamePaFieldBallPhysicsStep(s,root.source,prior.source,false);
    if(s.sourceVersion!==VERSION||a?.kind!=='capture_checkpoint_v1')throw new Error('Source acquisition accepts capture progress only');
    same(s.previousFieldReference,ref(prior));same(s.previousOperationReference,s.previousFieldReference);
    same(s.fieldRootReference,ref(root));same(s.launchReference,root.source.launchReference);same(a.candidateReference,candidateReference);
    if(s.throughTick!==quantizeEventTick(prefix.initial.cursor.moment.originTick,a.throughElapsedSeconds,root.response.world.parameters.ticksPerSecond))
      throw new Error('Source acquisition quantized horizon differs from exact capture time');
    if(i<priorCaptures.length){const f=priorCaptures[i];
      if(f.kind!=='same_pa_physical_field_step_v1'||f.operationOrdinal!==prior.operationOrdinal+1||f.physicalPitchSourceId!==root.physicalPitchSourceId)
        throw new Error('Source acquisition original progress is not consecutive');
      same(f.lineage,root.lineage);same(f.timeline,prior.timeline);
    }
    elapsed.push(a.throughElapsedSeconds);
  }
  const replay=deriveSourceBattedFieldAcquisitionV1({initial:prefix.initial,actions:prefix.actions,captureThroughElapsedSeconds:elapsed});
  same(replay.freeTrace,prefix.trace);
  const evidence=(count:number):SamePaFieldBallSolverEvidenceAcquisitionV1=>({solverVersion:'source_field_acquisition_v1',freeSolverVersion:'source_field_motor_motion_v1',
    impulseCertificates:prefix.ballSolverEvidence.impulseCertificates,escapedIntervals:prefix.ballSolverEvidence.escapedIntervals,
    captureAdvances:replay.steps.slice(0,count).map((s,captureStepIndex)=>({captureStepIndex,throughElapsedSeconds:s.throughElapsedSeconds,
      kind:s.progress.kind,worldMoment:s.progress.world.moment,remainingEnergyJ:s.progress.transport.remainingEnergyJ}))});
  for(const[i,f]of priorCaptures.entries()){
    const s=replay.steps[i];same(f.field,s.field);same(f.ballSolverEvidence,evidence(i+1));
    same((f as SamePaPhysicalFieldStep).actionResult,{kind:'capture_checkpoint_v1',candidateReference,progress:s.progress});
    if(f.evaluationTick!==s.field.motion.world.moment.ball.tick)throw new Error('Source acquisition stored exact progress clock differs');
  }
  const progress=replay.progress;if(!progress)throw new Error('Source acquisition current capture progress missing');
  return freeze({field:replay.field,actionResult:{kind:'capture_checkpoint_v1' as const,candidateReference,
    progress},evaluationTick:progress.world.moment.ball.tick,timeline:previous.timeline,ballSolverEvidence:evidence(replay.steps.length)});
};
