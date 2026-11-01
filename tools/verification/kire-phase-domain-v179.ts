import {cloneInert} from '../../src/core/adjudication/OfficialWindowPolicy';
import type {Vec3} from '../../src/core/model/geometry';
import {createSourceFreeBallKernel,type SourceFreeBallDescriptorV2} from '../../src/core/sim/ball/SourceFreeBallKernel';
import {multiplyQuaternions,normalizeQuaternion,quaternionFromAxisAngle,type Quaternion} from '../../src/core/sim/pitching/BaseballOrientation';
import {observePitchTrajectoryShapeV172,type PitchTrajectoryShapeObservationV172} from '../../src/integration/browser/PitchTrajectoryShapeV172';
import type {TimedPitchState} from '../../src/integration/browser/PitchBreakTiming';

const states=['KIRE_CIRCLE','KIRE_DOUBLE_CIRCLE','THREATENING_DOUBLE_CIRCLE'] as const;
const phases=[0,45,90,135,180,225,270,315] as const;
type State=typeof states[number];
type Kernel=ReturnType<typeof createSourceFreeBallKernel>;
export type PhaseParentV179=Readonly<{
  presetId:'slider'|'splitter';qualityState:State;originalPhaseDegrees:number;
  descriptor:SourceFreeBallDescriptorV2;baseMaterialOrientation:Quaternion;nominalSpinRadPerSecond:Vec3;
  referenceElapsedSeconds:number;measurementPlaneZ:number;parentOwnElapsedSeconds:number;
}>;
export type PhaseCaseV179=Readonly<{
  id:string;presetId:'slider'|'splitter';qualityState:State;phaseDegrees:number;originalPhaseDegrees:number;
  descriptor:SourceFreeBallDescriptorV2;referenceElapsedSeconds:number;measurementPlaneZ:number;isParentPhase:boolean;
}>;
function requireValue(value:unknown,message:string):asserts value {if(!value)throw Error('kire phase v179: '+message);}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const axes=['x','y','z'] as const;
const sameVector=(a:Vec3,b:Vec3)=>axes.every(key=>Object.is(a[key],b[key]));

/** This factory rotates only the authored material basis. The actual parent
 * position, velocity, spin, profile and Source clock remain byte-value exact.
 * Run it in the measured Chrome, never precompute its trigonometry in Node. */
export function createKirePhaseCasesV179(raw:readonly PhaseParentV179[]){
  const parents=cloneInert(raw);requireValue(parents.length===3,'three ordered parent states required');
  const presetId=parents[0].presetId,referenceElapsedSeconds=parents[0].referenceElapsedSeconds,
    measurementPlaneZ=parents[0].measurementPlaneZ,cases:PhaseCaseV179[]=[];
  requireValue(['slider','splitter'].includes(presetId),'fixed two-preset domain required');
  for(const [index,parent]of parents.entries()){
    requireValue(parent.presetId===presetId&&parent.qualityState===states[index]
      &&parent.originalPhaseDegrees===[225,0,270][index],'fixed ordered state and original phase required');
    requireValue(parent.referenceElapsedSeconds===referenceElapsedSeconds&&parent.measurementPlaneZ===measurementPlaneZ,
      'one fixed parent reference clock and plane required');
    requireValue(parent.descriptor.initial.elapsedSeconds===0&&referenceElapsedSeconds>0
      &&referenceElapsedSeconds<=parent.descriptor.throughElapsedSeconds,'release-rooted Source and bounded fixed reference required');
    requireValue(sameVector(parent.descriptor.initial.ball.spin,parent.nominalSpinRadPerSecond),
      'parent actual and nominal spin must be exact for the q-only Owner control');
    for(const phaseDegrees of phases){
      const materialOrientationAtStart=phaseDegrees===0?parent.baseMaterialOrientation:
        normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(parent.nominalSpinRadPerSecond,phaseDegrees*Math.PI/180),parent.baseMaterialOrientation));
      cases.push({id:presetId+':'+parent.qualityState+':phase-'+phaseDegrees,presetId,qualityState:parent.qualityState,
        phaseDegrees,originalPhaseDegrees:parent.originalPhaseDegrees,descriptor:{...parent.descriptor,materialOrientationAtStart},
        referenceElapsedSeconds,measurementPlaneZ,isParentPhase:phaseDegrees===parent.originalPhaseDegrees});
    }
  }
  return freeze({version:'kire_phase_cases_v179',presetId,qualityStates:states,phases,referenceElapsedSeconds,measurementPlaneZ,cases,
    sourceKernelConstructions:0,onlyMaterialOrientationChanged:true,nativeAdmission:false,skillAdmission:false});
}

/** Same cell query/bisection convention as PitcherWorkbenchV77's plate query.
 * It queries this single actual kernel; no second Source or flight is built. */
function ownPlaneTime(kernel:Kernel,plane:number):number|null {
  for(const cell of kernel.cells){
    const from=kernel.evaluateAt(cell.fromElapsedSeconds).moment.ball.position.z,
      through=kernel.evaluateAt(cell.throughElapsedSeconds).moment.ball.position.z;
    if(from<plane||through>plane)continue;
    let lo=cell.fromElapsedSeconds,hi=cell.throughElapsedSeconds;
    for(let n=0;n<60&&hi-lo>1e-12;n++){
      const mid=(lo+hi)/2;if(kernel.evaluateAt(mid).moment.ball.position.z<=plane)hi=mid;else lo=mid;
    }
    return hi;
  }
  return null;
}
function actualSamples(kernel:Kernel,end:number){
  return Array.from({length:641},(_,index)=>{
    const elapsedSeconds=index===640?end:end*index/640,observation=kernel.evaluateAt(elapsedSeconds),ball=observation.moment.ball;
    // The Owner sampler's original property order and signed values are kept.
    return {...ball,elapsedSeconds,orientation:observation.materialOrientation??observation.orientation,phase:observation.phase};
  });
}
function ground(samples:readonly TimedPitchState[],end:number,eventTimes:readonly number[],basis:string,
  parentObserved=false,parentCounterfactual=false){
  const actualGroundEventSeconds=eventTimes.filter(t=>t<=end),phaseGroundObserved=samples.some(row=>row.phase!=='airborne'),
    actualMarkedCounterfactual=parentCounterfactual||samples.some(row=>row.counterfactualGroundIgnored===true),
    actualGroundObserved=phaseGroundObserved||actualGroundEventSeconds.length>0||parentObserved;
  return {status:actualMarkedCounterfactual?'ACTUAL_COUNTERFACTUAL':actualGroundObserved?'ACTUAL_GROUND_REPORTED':'NO_ACTUAL_GROUND_REPORTED',
    actualGroundObserved,phaseGroundObserved,actualMarkedCounterfactual,actualGroundEventSeconds,
    eventCoverageThroughElapsedSeconds:end,basis,analyticReferenceFlagsNotAppliedToActualBall:true};
}
function compact(net:PitchTrajectoryShapeObservationV172|null){
  if(net===null)return {status:'NO_FINITE_PLANE_CROSSING',referenceElapsedSeconds:null,p10:null,p50:null,p90:null,width:null,
    late20:null,amountMeters:null,normalDisplacementWorld:null};
  return {status:net.status,referenceElapsedSeconds:net.referenceElapsedSeconds,
    p10:net.timing.percentTimes.p10?.elapsedSeconds??null,p50:net.timing.percentTimes.p50?.elapsedSeconds??null,
    p90:net.timing.percentTimes.p90?.elapsedSeconds??null,width:net.timing.transitionIntervalSeconds,
    late20:net.timing.late20Percent.projectedFraction,amountMeters:net.timing.finalNormalDisplacementMeters,
    normalDisplacementWorld:net.raw.at(-1)!.normalDisplacementWorld};
}
function assemble(item:PhaseCaseV179,sourceSamples:ReturnType<typeof actualSamples>,ownSourceSamples:ReturnType<typeof actualSamples>|null,
  ownElapsedSeconds:number|null,eventTimes:readonly number[],basis:string,parentObserved=false,parentCounterfactual=false){
  const common=observePitchTrajectoryShapeV172({sourceSamples,referenceElapsedSeconds:item.referenceElapsedSeconds}),
    own=ownSourceSamples===null||ownElapsedSeconds===null?null:observePitchTrajectoryShapeV172({sourceSamples:ownSourceSamples,
      referenceElapsedSeconds:ownElapsedSeconds}),
    commonGround=ground(sourceSamples,item.referenceElapsedSeconds,eventTimes,basis,parentObserved,parentCounterfactual),
    ownGround=ownSourceSamples===null||ownElapsedSeconds===null?null:ground(ownSourceSamples,ownElapsedSeconds,eventTimes,basis,parentObserved,parentCounterfactual);
  return freeze({version:'kire_phase_measurement_v179',id:item.id,presetId:item.presetId,qualityState:item.qualityState,
    phaseDegrees:item.phaseDegrees,descriptor:item.descriptor,referenceElapsedSeconds:item.referenceElapsedSeconds,
    measurementPlaneZ:item.measurementPlaneZ,sourceSamples,ownSourceSamples,ownElapsedSeconds,common,own,commonGround,ownGround,
    commonTimeFollowsOwnPlane:ownElapsedSeconds===null?null:item.referenceElapsedSeconds>ownElapsedSeconds,
    commonClockMeaning:'SAME_RELEASE_DESCRIPTOR_ELAPSED_TIME_NOT_SAME_PLANE_OR_ACTUAL_WORLD_AFTER_CATCH',
    summary:{id:item.id,presetId:item.presetId,qualityState:item.qualityState,phaseDegrees:item.phaseDegrees,common:compact(common),own:compact(own),
      commonGround,ownGround,ownElapsedSeconds,commonTimeFollowsOwnPlane:ownElapsedSeconds===null?null:item.referenceElapsedSeconds>ownElapsedSeconds},
    nativeAdmission:false,skillAdmission:false});
}

export function measureKirePhaseCaseV179(raw:PhaseCaseV179){
  const item=cloneInert(raw);requireValue(item.referenceElapsedSeconds>0&&item.referenceElapsedSeconds<=item.descriptor.throughElapsedSeconds,
    'fixed reference inside original Source horizon required');
  const kernel=createSourceFreeBallKernel(item.descriptor),ownElapsedSeconds=ownPlaneTime(kernel,item.measurementPlaneZ),
    sourceSamples=actualSamples(kernel,item.referenceElapsedSeconds),ownSourceSamples=ownElapsedSeconds===null?null:actualSamples(kernel,ownElapsedSeconds),
    eventTimes=kernel.boundaries.filter(row=>row.kind==='ground').map(row=>row.elapsedSeconds);
  return freeze({...assemble(item,sourceSamples,ownSourceSamples,ownElapsedSeconds,eventTimes,'ACTUAL_SHARED_SOURCE_KERNEL_BOUNDARIES'),
    execution:'ONE_NEW_SHARED_SOURCE_KERNEL',sourceKernelConstructions:1});
}

export function observeSavedKirePhaseCaseV179(raw:Readonly<{
  item:PhaseCaseV179;sourceSamples:ReturnType<typeof actualSamples>;ownSourceSamples:ReturnType<typeof actualSamples>;
  parentOwnElapsedSeconds:number;parentGround:Readonly<{actualGroundObserved:boolean;actualMarkedCounterfactual:boolean;actualGroundEventSeconds:readonly number[]}>;
}>){
  const input=cloneInert(raw),{item,sourceSamples,ownSourceSamples,parentOwnElapsedSeconds,parentGround}=input;
  requireValue(item.isParentPhase&&sourceSamples.length===641&&ownSourceSamples.length===641
    &&sourceSamples[0].elapsedSeconds===0&&ownSourceSamples[0].elapsedSeconds===0
    &&sourceSamples.at(-1)!.elapsedSeconds===item.referenceElapsedSeconds&&ownSourceSamples.at(-1)!.elapsedSeconds===parentOwnElapsedSeconds,
    'exact saved parent grids and clocks required');
  requireValue(item.referenceElapsedSeconds<=parentOwnElapsedSeconds&&Number.isFinite(parentOwnElapsedSeconds),
    'saved parent boundary coverage must cover both observation clocks');
  for(const sample of [sourceSamples[0],ownSourceSamples[0]])
    requireValue(sameVector(sample.position,item.descriptor.initial.ball.position)&&sameVector(sample.velocity,item.descriptor.initial.ball.velocity)
      &&sameVector(sample.spin,item.descriptor.initial.ball.spin),'saved parent release PV/spin differs');
  requireValue(typeof parentGround.actualGroundObserved==='boolean'&&typeof parentGround.actualMarkedCounterfactual==='boolean'
    &&Array.isArray(parentGround.actualGroundEventSeconds),'explicit saved actual-ground coverage required');
  return freeze({...assemble(item,sourceSamples,ownSourceSamples,parentOwnElapsedSeconds,parentGround.actualGroundEventSeconds,
    'SAVED_PARENT_ACTUAL_WORKBENCH_BOUNDARY_FLAGS',parentGround.actualGroundObserved,parentGround.actualMarkedCounterfactual),
    execution:'SAVED_PARENT_SERIES_READ_ONLY',sourceKernelConstructions:0});
}

type Summary=ReturnType<typeof measureKirePhaseCaseV179>['summary'];
export function analyzeKirePhaseDomainV179(raw:readonly Summary[]){
  const rows=cloneInert(raw);requireValue(rows.length===24&&rows.every(row=>row.presetId===rows[0].presetId),'one fixed 24-case domain required');
  const byState=states.map(state=>rows.filter(row=>row.qualityState===state).sort((a,b)=>a.phaseDegrees-b.phaseDegrees));
  requireValue(byState.every(group=>group.length===8&&group.every((row,i)=>row.phaseDegrees===phases[i])),'all fixed state/phase combinations required');
  const T=rows[0].common.referenceElapsedSeconds;requireValue(rows.every(row=>row.common.referenceElapsedSeconds===T),'original fixed common clock required');
  const relativeAmount=(a:number|null,b:number|null)=>a===null||b===null||a<1e-6||b<1e-6?null:Math.abs(a-b)/((a+b)/2),
    angle=(a:Vec3|null,b:Vec3|null)=>{if(a===null||b===null)return null;const n=Math.hypot(a.x,a.y,a.z)*Math.hypot(b.x,b.y,b.z);
      return n>0?Math.acos(Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y+a.z*b.z)/n)))*180/Math.PI:null;},
    order=(items:readonly Summary[],which:'common'|'own')=>{
      const values=items.map(row=>row[which]),available=values.every(row=>[row.p10,row.p50,row.p90,row.width,row.late20].every(Number.isFinite)),
        within=available&&values.every(row=>row.p10!>=0&&row.p10!<=row.p50!&&row.p50!<=row.p90!&&row.p90!<=row.referenceElapsedSeconds!),
        P=available&&values[0].p10!<values[1].p10!&&values[1].p10!<values[2].p10!,
        D=available&&values[0].width!>values[1].width!&&values[1].width!>values[2].width!,
        L=available&&values[0].late20!<values[1].late20!&&values[1].late20!<values[2].late20!;
      return {available,within,P,D,L};
    },triples:any[]=[],pairs:any[]=[],pairCache=new Map<string,any>();
  function pair(a:Summary,b:Summary){
    const key=a.id+'|'+b.id;if(pairCache.has(key))return pairCache.get(key);
    const c=a.common,d=b.common,e=a.own,f=b.own,
      ca=c.amountMeters===null||d.amountMeters===null?null:Math.abs(c.amountMeters-d.amountMeters),cr=relativeAmount(c.amountMeters,d.amountMeters),
      cd=angle(c.normalDisplacementWorld,d.normalDisplacementWorld),oa=e.amountMeters===null||f.amountMeters===null?null:Math.abs(e.amountMeters-f.amountMeters),
      or=relativeAmount(e.amountMeters,f.amountMeters),od=angle(e.normalDisplacementWorld,f.normalDisplacementWorld),
      groundClear=[a.commonGround,b.commonGround,a.ownGround,b.ownGround].every(g=>g?.status==='NO_ACTUAL_GROUND_REPORTED'),
      commonClassified=c.status==='CLASSIFIED'&&d.status==='CLASSIFIED',
      Q=commonClassified&&groundClear&&ca!==null&&ca<=.02&&cr!==null&&cr<=.05&&cd!==null&&cd<=5
        &&oa!==null&&oa<=.02&&or!==null&&or<=.05&&od!==null&&od<=5,
      p50Difference=c.p50===null||d.p50===null||T===null?null:Math.abs(c.p50-d.p50)/T,
      lateDifference=c.late20===null||d.late20===null?null:Math.abs(c.late20-d.late20),result={caseIds:[a.id,b.id],Q,commonClassified,groundClear,
        commonAbsoluteAmountDifferenceMeters:ca,commonRelativeAmountDifference:cr,commonDirectionDifferenceDegrees:cd,
        ownAbsoluteAmountDifferenceMeters:oa,ownRelativeAmountDifference:or,ownDirectionDifferenceDegrees:od,
        p50FractionDifference:p50Difference,late20FractionDifference:lateDifference,
        legacyExploratoryScreen:(p50Difference!==null&&p50Difference>=.05)||(lateDifference!==null&&lateDifference>=.05)};
    pairCache.set(key,result);pairs.push(result);return result;
  }
  let selected:any=null;
  const better=(a:any,b:any)=>{
    if(b===null)return true;
    for(const [key,direction]of [['minimumAdjacentFourSeconds',1],['minimumAdjacentLate20Increase',1],['maximumPairRelativeAmountDifference',-1]] as const)
      if(a.score[key]!==b.score[key])return direction*(a.score[key]-b.score[key])>0;
    for(let i=0;i<3;i++)if(a.phases[i]!==b.phases[i])return a.phases[i]<b.phases[i];return false;
  };
  for(const a of byState[0])for(const b of byState[1])for(const c of byState[2]){
    const items=[a,b,c],ps=[pair(a,b),pair(a,c),pair(b,c)],common=order(items,'common'),own=order(items,'own'),Q=ps.every(p=>p.Q),
      commonQPDL=Q&&common.within&&common.P&&common.D&&common.L,
      candidate=commonQPDL&&own.within&&own.P&&own.D&&own.L,
      score=common.available?{minimumAdjacentFourSeconds:Math.min(b.common.p10!-a.common.p10!,c.common.p10!-b.common.p10!,
        a.common.width!-b.common.width!,b.common.width!-c.common.width!),minimumAdjacentLate20Increase:Math.min(b.common.late20!-a.common.late20!,c.common.late20!-b.common.late20!),
        maximumPairRelativeAmountDifference:ps.every(p=>p.commonRelativeAmountDifference!==null&&p.ownRelativeAmountDifference!==null)?
          Math.max(...ps.flatMap(p=>[p.commonRelativeAmountDifference,p.ownRelativeAmountDifference])):null}:null,
      row={caseIds:items.map(x=>x.id),phases:items.map(x=>x.phaseDegrees),Q,...common,commonQPDL,
        ownTimingOrder:own,candidate,legacyAdjacentScreen:ps[0].legacyExploratoryScreen&&ps[2].legacyExploratoryScreen,score};
    triples.push(row);if(candidate&&better(row,selected))selected=row;
  }
  requireValue(triples.length===512,'all fixed 8^3 combinations required');
  return freeze({version:'kire_phase_domain_analysis_v179',presetId:rows[0].presetId,referenceElapsedSeconds:T,caseCount:24,triples,pairs,
    nearTripleCount:triples.filter(x=>x.Q).length,commonQPDLCount:triples.filter(x=>x.commonQPDL).length,
    candidateCount:triples.filter(x=>x.candidate).length,alsoLegacyScreenCount:triples.filter(x=>x.candidate&&x.legacyAdjacentScreen).length,selected,
    rank:'MAX_MIN_ADJACENT_P10_DELAY_WIDTH_SHORTENING_THEN_MAX_MIN_LATE20_THEN_MIN_MAX_RELATIVE_AMOUNT_THEN_NUMERIC_PHASE_TUPLE_LEX',
    ownTimingIsSeparate:true,ownPDLRequiredForCandidate:true,newPerceptionThresholdAdded:false,forceTimerAdded:false,nativeAdmission:false,skillAdmission:false});
}
