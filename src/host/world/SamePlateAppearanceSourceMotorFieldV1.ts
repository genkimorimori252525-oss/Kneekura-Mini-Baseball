import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BattedWorldFieldMotion, BattedWorldFieldMotionAdoptionInput } from '../../core/sim/ball/BattedWorldFieldMotion';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { deriveFieldIntegerBoundaryV1 } from '../../core/sim/ball/SourceFieldIntegerBoundaryV1';
import { deriveSourceBattedFieldMotorMotionV1, type SourceBattedFieldMotorActionV1, type SourceBattedFieldMotorTraceV1 } from '../../core/sim/ball/SourceBattedFieldMotorMotionV1';
import { assertSamePaFieldBallPhysicsStep, samePaSourceFieldMetadataActionV3, SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT,
  SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION as MOTOR } from './SamePlateAppearanceBallPhysics';
import { originalTeamMotorSelectionsV1 } from './SamePlateAppearanceTeamMotorSelectionV1';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldActionResult } from './SamePlateAppearancePhysicalFieldAction';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Motor = Extract<SamePaPhysicalFieldActionResult, {kind:'defender_motion_v1'}>;
type Input = Readonly<{source:SamePaPhysicalFieldStepSource;root:SamePaPhysicalFieldRoot;previous:Field;history:readonly Field[]}>;
type PrefixInput = Readonly<{root:SamePaPhysicalFieldRoot;history:readonly Field[]}>;
const same = (a:unknown,b:unknown) => {if(json(a)!==json(b))throw new Error('same-PA Source motor original history differs');};
const ref = (f:Field) => reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
/** New version retains the index key spelling, with ordered action indices. */
const evidence = <V extends 'source_field_motor_motion_v1'|'source_field_contact_escape_v3'>(trace:SourceBattedFieldMotorTraceV1,index:number,version:V) => ({solverVersion:version,
  impulseCertificates:trace.impulseCertificates.filter(c=>c.afterActionIndex<=index).map(c=>({afterStepIndex:c.afterActionIndex,diagnostic:c.diagnostic})),
  escapedIntervals:trace.escapedIntervals.filter(c=>c.actionIndex<=index).map(c=>({stepIndex:c.actionIndex,advance:c.advance}))});
const free = (root:SamePaPhysicalFieldRoot,field:BattedWorldFieldMotion,terminal=false) => {
  const m=field.motion,c=m.cursor;
  if(m.carrierPlayerId!==null)throw new Error('same-PA Source motor does not admit custody');
  if(terminal&&m.response.kind==='capture_candidate'&&c===null&&m.world.kind==='boundary')return;
  if(!c?.sourceCurve||!root.response.world.sourceCurve||!['incoming','outgoing'].includes(c.sourceSide??''))throw new Error('same-PA Source motor requires a resolved free cursor');
  same(c.sourceCurve.profile,root.response.world.sourceCurve.profile);
  if(c.moment.originTick!==root.response.world.sourceCurve.initial.originTick||c.moment.elapsedSeconds!==m.world.moment.elapsedSeconds||c.moment.ball.tick!==m.world.moment.ball.tick)
    throw new Error('same-PA Source motor exact clock differs');
  same(createSourceFreeBallKernel(c.sourceCurve).evaluateAt(c.moment.elapsedSeconds,c.sourceSide).moment,c.moment);
};
const adoption = (source:SamePaPhysicalFieldStepSource,prior:Field,prefix:readonly Field[],value:Motor):SourceBattedFieldMotorActionV1 => {
  const a=source.action;
  if(a?.kind!=='defender_motion_v1'||value.kind!==a.kind||value.motors.length!==9||new Set(value.motors.map(m=>m.self.playerId)).size!==9
    ||!originalTeamMotorSelectionsV1(prefix,a.selections,a.selections.map(s=>s.member.playerId)))throw new Error('same-PA Source motor requires the complete owned team');
  const motion=prior.field.motion,at=motion.world.moment;
  const coverage=Math.min(...motion.actors.map(a=>a.primitive.endTick),...value.motors.map(m=>m.coverageEndTick));
  if(coverage!==value.coverageThroughTick||source.throughTick<=prior.evaluationTick||source.throughTick>coverage)
    throw new Error('same-PA Source motor finite coverage differs');
  for(const m of value.motors){
    if(m.command.playerId!==m.self.playerId||!a.selections.some(s=>s.member.playerId===m.self.playerId)||m.segment.startTick!==at.ball.tick
      ||m.startAt.originTick!==at.originTick||m.startAt.elapsedSeconds!==at.elapsedSeconds||m.startAt.tick!==at.ball.tick)
      throw new Error('same-PA Source motor original self or start differs');
    same(m.self.physicalCutReference,ref(prior));
    if(m.command.primitiveMotions.length!==5||new Set(m.command.primitiveMotions.map(r=>r.role)).size!==5)throw new Error('same-PA Source motor role coverage differs');
  }
  const commands=motion.actors.map(a=>{
    const m=value.motors.find(m=>m.self.playerId===a.playerId),r=m?.command.primitiveMotions.find(r=>r.role===a.primitive.role);
    if(m&&!r)throw new Error('same-PA Source motor primitive command missing');
    return{playerId:a.playerId,role:a.primitive.role,acceleration:m&&r?{x:m.command.bodyAcceleration.x+r.offsetAcceleration.x,
      y:m.command.bodyAcceleration.y+r.offsetAcceleration.y,z:m.command.bodyAcceleration.z+r.offsetAcceleration.z}:a.primitive.acceleration};
  });
  return{kind:'adopt',availableAtTick:value.motors[0].segment.startTick,coverageThroughTick:coverage,commands};
};

/** Internal composition after the original Native owner independently rederives
 * every Source/model/calibration/decision/physical row. No stored certificate
 * or caller target restores authority; all original actions are replayed. */
const replay = (input:Input|PrefixInput,mode:'motor'|'metadata'|'advance'|'prefix',motor?:Motor) => {
  const{root,history}=input,source='source'in input?input.source:null,previous='previous'in input?input.previous:history.at(-1)!;
  if((mode!=='prefix'&&source?.sourceVersion!==MOTOR)||root.source.sourceVersion!==ROOT||!history.length)throw new Error('same-PA Source motor requires original versioned history');
  same(history[0],root);same(history.at(-1),previous);free(root,previous.field,mode==='prefix');
  const curve=root.response.world.sourceCurve;if(!curve)throw new Error('same-PA Source motor original curve missing');
  same(curve.profile,root.source.ballPhysics);same(curve.initial.ball,root.response.world.flight.initialBall);same(root.response.world.parameters,root.source.parameters);
  const initial:BattedWorldFieldMotionAdoptionInput={response:root.response,geometry:root.geometry,actors:root.response.world.actors,carrierPlayerId:null,
    cursor:{moment:curve.initial,sourceCurve:curve,sourceSide:'incoming',previousContacts:[]},availableAtTick:curve.initial.ball.tick,
    coverageThroughTick:Math.min(...root.response.world.actors.map(a=>a.primitive.endTick)),
    commands:root.source.commands.flatMap(c=>c.primitiveMotions.map(p=>({playerId:c.playerId,role:p.role,acceleration:{
      x:c.bodyAcceleration.x+p.offsetAcceleration.x,y:c.bodyAcceleration.y+p.offsetAcceleration.y,z:c.bodyAcceleration.z+p.offsetAcceleration.z}})))};
  const actions:SourceBattedFieldMotorActionV1[]=root.source.throughTick>curve.initial.ball.tick?[{kind:'advance',throughTick:root.source.throughTick}]:[];
  const indices=[actions.length-1];
  const links=(s:SamePaPhysicalFieldStepSource,p:Field)=>{
    assertSamePaFieldBallPhysicsStep(s,root.source,p.source,p.kind==='same_pa_physical_field_root_v1');same(s.fieldRootReference,ref(root));
    same(s.previousFieldReference,ref(p));same(s.previousOperationReference,s.previousFieldReference);same(s.launchReference,root.source.launchReference);
  };
  for(let i=1;i<history.length;i++){
    const f=history[i],p=history[i-1];
    if(f.kind!=='same_pa_physical_field_step_v1'||f.operationOrdinal!==p.operationOrdinal+1||f.physicalPitchSourceId!==root.physicalPitchSourceId)
      throw new Error('same-PA Source motor original prefix is not consecutive');
    links(f.source,p);same(f.lineage,root.lineage);free(root,p.field);
    if(samePaSourceFieldMetadataActionV3(f.source.action)){
      if(f.source.throughTick!==p.evaluationTick||f.evaluationTick!==p.evaluationTick||f.actionResult?.kind!==f.source.action?.kind)
        throw new Error('same-PA Source motor metadata changed its cut');
      same(f.field,p.field);same(f.timeline,p.timeline);same(f.ballSolverEvidence,p.ballSolverEvidence);
    }else{
      if(f.source.action?.kind==='defender_motion_v1'){
        if(f.source.sourceVersion!==MOTOR||f.actionResult?.kind!=='defender_motion_v1')throw new Error('same-PA Source motor original motor missing');
        actions.push(adoption(f.source,p,history.slice(0,i),f.actionResult));
      }else if(f.source.action?.kind==='source_integer_boundary_checkpoint_v1'){
        const c=p.field.motion.cursor!,boundary=deriveFieldIntegerBoundaryV1({originTick:c.moment.originTick,elapsedSeconds:c.moment.elapsedSeconds,ticksPerSecond:root.response.world.parameters.ticksPerSecond});
        if(f.source.throughTick!==p.evaluationTick||boundary.boundaryTick!==p.evaluationTick||!(boundary.waitSeconds>0)
          ||f.field.motion.world.moment.elapsedSeconds<=c.moment.elapsedSeconds||f.field.motion.world.moment.elapsedSeconds>boundary.boundaryElapsedSeconds)
          throw new Error('same-PA Source motor original integer wait differs');
        same(f.actionResult,{kind:'source_integer_boundary_checkpoint_v1',boundary,status:f.field.motion.world.kind==='boundary'?'physical_boundary':'checkpoint_reached'});
      }else if(Object.hasOwn(f.source,'action')||f.actionResult!==undefined||f.source.throughTick<=p.evaluationTick)
        throw new Error('unsupported same-PA Source motor physical history');
      actions.push({kind:'advance',throughTick:f.source.throughTick});
    }
    indices.push(actions.length-1);
  }
  if(mode!=='prefix'){
  if(!source)throw new Error('Source motor current Source missing');
  links(source,previous);
  if(mode==='metadata'){
    if(!samePaSourceFieldMetadataActionV3(source.action)||source.throughTick!==previous.evaluationTick)throw new Error('same-PA Source motor metadata cannot advance');
  }else{
    if(mode==='motor'){
      if(!motor)throw new Error('same-PA Source motor current owned receipts missing');
      actions.push(adoption(source,previous,history,motor));
    }else if(Object.hasOwn(source,'action')||source.throughTick<=previous.evaluationTick)throw new Error('invalid Source motor free checkpoint');
    actions.push({kind:'advance',throughTick:source.throughTick});
  }
  }
  const trace=deriveSourceBattedFieldMotorMotionV1({initial,actions});
  for(const[i,f]of history.entries()){
    const index=indices[i],field=index<0?trace.initial:trace.steps[index].field;
    same(f.field,field);same(f.ballSolverEvidence,evidence(trace,index,f.source.sourceVersion===MOTOR?'source_field_motor_motion_v1':'source_field_contact_escape_v3'));
    if(f.evaluationTick!==field.motion.world.moment.ball.tick)throw new Error('same-PA Source motor historical clock differs');
    free(root,field,true);
  }
  free(root,trace.field,true);
  return freeze({field:trace.field,ballSolverEvidence:evidence(trace,actions.length-1,'source_field_motor_motion_v1'),initial,actions,trace});
};
/** Each immutable owner record retains the ordinary inert-node/depth limit.
 * A complete nine-actor history is a collection of those records, not one
 * serialized Source. Validate its envelope without executing active properties. */
const descriptorsOf = (raw:object,keys:readonly string[]) => {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getOwnPropertySymbols(raw).length)throw new Error('invalid Source motor replay envelope');
  const prototype=Object.getPrototypeOf(raw);
  if(prototype!==Object.prototype&&prototype!==null)throw new Error('Source motor replay requires a plain inert envelope');
  const descriptors:Record<string,PropertyDescriptor>=Object.getOwnPropertyDescriptors(raw);
  if(Object.keys(descriptors).sort().join('|')!==[...keys].sort().join('|')||Object.values(descriptors).some(d=>!('value'in d)||!d.enumerable))
    throw new Error('invalid Source motor replay properties');
  return descriptors;
};
const copiedHistory = (rows:unknown):readonly Field[] => {
  if(!Array.isArray(rows)||Object.getOwnPropertySymbols(rows).length)throw new Error('invalid Source motor history');
  const entries=Object.getOwnPropertyDescriptors(rows) as unknown as Record<string,PropertyDescriptor>,length=entries.length.value;
  if(!Number.isSafeInteger(length)||length<1||length>512||Object.keys(entries).length!==length+1
    ||Array.from({length},(_,i)=>entries[String(i)]).some(d=>!d||!('value'in d)||!d.enumerable))throw new Error('invalid Source motor history records');
  return Array.from({length},(_,i)=>cloneInert(entries[String(i)].value));
};
const copied = (raw:Input,withMotor=false):Input&Readonly<{actionResult?:Motor}> => {
  const descriptors=descriptorsOf(raw,['source','root','previous','history',...(withMotor?['actionResult']:[])]);
  return{source:cloneInert(descriptors.source.value),root:cloneInert(descriptors.root.value),previous:cloneInert(descriptors.previous.value),
    history:copiedHistory(descriptors.history.value),...(withMotor?{actionResult:cloneInert(descriptors.actionResult.value)}:{})};
};
const physicalResult=(result:ReturnType<typeof replay>)=>freeze({field:result.field,ballSolverEvidence:result.ballSolverEvidence});
export const deriveSamePaSourceMotorFieldMotionV1=(raw:Input&Readonly<{actionResult:Motor}>)=>{const input=copied(raw,true);return physicalResult(replay(input,'motor',input.actionResult));};
export const deriveSamePaSourceMotorMetadataV1=(raw:Input)=>{const{ballSolverEvidence}=replay(copied(raw),'metadata');return freeze({ballSolverEvidence});};
export const deriveSamePaSourceMotorFieldStepV1=(raw:Input)=>physicalResult(replay(copied(raw),'advance'));
/** Internal original-prefix projection for acquisition. No prospective Source,
 * saved cursor, plan or certificate is accepted. Native authenticates the rows;
 * this function independently rebuilds their complete Source/motor trajectory. */
export const readSamePaSourceMotorPrefixV1=(raw:PrefixInput)=>{
  const d=descriptorsOf(raw,['root','history']),input:PrefixInput={root:cloneInert(d.root.value),history:copiedHistory(d.history.value)},last=input.history.at(-1)!;
  if(last.source.sourceVersion!==MOTOR||last.field.motion.response.kind!=='capture_candidate'||last.field.motion.cursor!==null||last.field.motion.carrierPlayerId!==null)
    throw new Error('Source motor prefix requires its original terminal capture candidate');
  const{initial,actions,trace,ballSolverEvidence}=replay(input,'prefix');return freeze({initial,actions,trace,ballSolverEvidence});
};
/** Internal original-prefix projection for the additive continuous controller.
 * Native authenticates every row before this independent physical replay. */
export const readSamePaSourceFreeMotorPrefixV1=(raw:PrefixInput)=>{
  const d=descriptorsOf(raw,['root','history']),input:PrefixInput={root:cloneInert(d.root.value),history:copiedHistory(d.history.value)};
  const{initial,actions,trace,ballSolverEvidence}=replay(input,'prefix');
  if(!trace.field.motion.cursor)throw new Error('Source continuous control requires a free original prefix');
  return freeze({initial,actions,trace,ballSolverEvidence});
};
