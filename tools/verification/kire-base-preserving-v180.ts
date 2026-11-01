import {cloneInert} from '../../src/core/adjudication/OfficialWindowPolicy';
import type {Vec3} from '../../src/core/model/geometry';
import {createSourceFreeBallKernel,type SourceFreeBallDescriptorV2} from '../../src/core/sim/ball/SourceFreeBallKernel';
import {multiplyQuaternions,normalizeQuaternion,quaternionFromAxisAngle,type Quaternion} from '../../src/core/sim/pitching/BaseballOrientation';
import {observePitchTrajectoryShapeV172,type PitchTrajectoryShapeObservationV172} from '../../src/integration/browser/PitchTrajectoryShapeV172';
import type {TimedPitchState} from '../../src/integration/browser/PitchBreakTiming';

const angles=[0,90,180,270] as const;
type Kernel=ReturnType<typeof createSourceFreeBallKernel>;
export type BaseParentV180=Readonly<{
  presetId:'slider'|'splitter';descriptor:SourceFreeBallDescriptorV2;baseMaterialOrientation:Quaternion;
  referenceElapsedSeconds:number;measurementPlaneZ:number;
}>;
export type BaseCaseV180=BaseParentV180&Readonly<{id:string;aDegrees:number;bDegrees:number;isIdentity:boolean}>;
function requireValue(value:unknown,message:string):asserts value {if(!value)throw Error('kire base preserving v180: '+message);}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const axes=['x','y','z'] as const;
const sameVector=(a:Vec3,b:Vec3)=>axes.every(key=>Object.is(a[key],b[key]));

/** Called only inside the measured Chrome. Identity retains the exact original
 * q, including its signed values. Other rotations postmultiply local x then y. */
export function createKireBaseCasesV180(raw:BaseParentV180){
  const parent=cloneInert(raw);requireValue(['slider','splitter'].includes(parent.presetId),'fixed two-preset domain required');
  requireValue(parent.descriptor.initial.elapsedSeconds===0&&parent.referenceElapsedSeconds>0
    &&parent.referenceElapsedSeconds<=parent.descriptor.throughElapsedSeconds,'release-rooted bounded Source required');
  const cases:BaseCaseV180[]=[];
  for(const aDegrees of angles)for(const bDegrees of angles){
    const isIdentity=aDegrees===0&&bDegrees===0,materialOrientationAtStart=isIdentity?parent.baseMaterialOrientation:
      normalizeQuaternion(multiplyQuaternions(multiplyQuaternions(parent.baseMaterialOrientation,
        quaternionFromAxisAngle({x:1,y:0,z:0},aDegrees*Math.PI/180)),quaternionFromAxisAngle({x:0,y:1,z:0},bDegrees*Math.PI/180)));
    cases.push({...parent,id:parent.presetId+':a'+aDegrees+':b'+bDegrees,aDegrees,bDegrees,isIdentity,
      descriptor:{...parent.descriptor,materialOrientationAtStart}});
  }
  return freeze({version:'kire_base_cases_v180',presetId:parent.presetId,angles,cases,sourceKernelConstructions:0,
    rotationConvention:'q0 * Rx(a) * Ry(b)',onlyMaterialOrientationChanged:true,identityRenormalized:false,
    nativeAdmission:false,skillAdmission:false});
}
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
function assemble(item:BaseCaseV180,sourceSamples:ReturnType<typeof actualSamples>,ownSourceSamples:ReturnType<typeof actualSamples>|null,
  ownElapsedSeconds:number|null,eventTimes:readonly number[],basis:string,parentObserved=false,parentCounterfactual=false){
  const common=observePitchTrajectoryShapeV172({sourceSamples,referenceElapsedSeconds:item.referenceElapsedSeconds}),
    own=ownSourceSamples===null||ownElapsedSeconds===null?null:observePitchTrajectoryShapeV172({sourceSamples:ownSourceSamples,referenceElapsedSeconds:ownElapsedSeconds}),
    commonGround=ground(sourceSamples,item.referenceElapsedSeconds,eventTimes,basis,parentObserved,parentCounterfactual),
    ownGround=ownSourceSamples===null||ownElapsedSeconds===null?null:ground(ownSourceSamples,ownElapsedSeconds,eventTimes,basis,parentObserved,parentCounterfactual),
    ownEndpoint=ownSourceSamples?.at(-1)??null;
  return freeze({version:'kire_base_measurement_v180',id:item.id,presetId:item.presetId,aDegrees:item.aDegrees,bDegrees:item.bDegrees,
    isIdentity:item.isIdentity,descriptor:item.descriptor,referenceElapsedSeconds:item.referenceElapsedSeconds,
    measurementPlaneZ:item.measurementPlaneZ,sourceSamples,ownSourceSamples,ownElapsedSeconds,common,own,commonGround,ownGround,
    commonTimeFollowsOwnPlane:ownElapsedSeconds===null?null:item.referenceElapsedSeconds>ownElapsedSeconds,
    commonClockMeaning:'SAME_RELEASE_DESCRIPTOR_ELAPSED_TIME_NOT_SAME_PLANE_OR_ACTUAL_WORLD_AFTER_CATCH',
    summary:{id:item.id,presetId:item.presetId,aDegrees:item.aDegrees,bDegrees:item.bDegrees,isIdentity:item.isIdentity,
      common:compact(common),own:compact(own),commonGround,ownGround,ownElapsedSeconds,
      ownEndpoint:ownEndpoint===null?null:{position:ownEndpoint.position,velocity:ownEndpoint.velocity},
      commonTimeFollowsOwnPlane:ownElapsedSeconds===null?null:item.referenceElapsedSeconds>ownElapsedSeconds},
    nativeAdmission:false,skillAdmission:false});
}
export function measureKireBaseCaseV180(raw:BaseCaseV180){
  const item=cloneInert(raw);requireValue(!item.isIdentity,'identity must reuse saved ordinary series');
  requireValue(item.referenceElapsedSeconds>0&&item.referenceElapsedSeconds<=item.descriptor.throughElapsedSeconds,'fixed reference inside original horizon required');
  const kernel=createSourceFreeBallKernel(item.descriptor),ownElapsedSeconds=ownPlaneTime(kernel,item.measurementPlaneZ),
    sourceSamples=actualSamples(kernel,item.referenceElapsedSeconds),ownSourceSamples=ownElapsedSeconds===null?null:actualSamples(kernel,ownElapsedSeconds),
    eventTimes=kernel.boundaries.filter(row=>row.kind==='ground').map(row=>row.elapsedSeconds);
  return freeze({...assemble(item,sourceSamples,ownSourceSamples,ownElapsedSeconds,eventTimes,'ACTUAL_SHARED_SOURCE_KERNEL_BOUNDARIES'),
    execution:'ONE_NEW_SHARED_SOURCE_KERNEL',sourceKernelConstructions:1});
}
export function observeSavedKireBaseCaseV180(raw:Readonly<{
  item:BaseCaseV180;ownSourceSamples:ReturnType<typeof actualSamples>;
  parentGround:Readonly<{actualGroundObserved:boolean;actualMarkedCounterfactual:boolean;actualGroundEventSeconds:readonly number[]}>;
}>){
  const {item,ownSourceSamples,parentGround}=cloneInert(raw);
  requireValue(item.isIdentity&&ownSourceSamples.length===641&&ownSourceSamples[0].elapsedSeconds===0
    &&ownSourceSamples.at(-1)!.elapsedSeconds===item.referenceElapsedSeconds,'exact saved ordinary own clock required');
  const first=ownSourceSamples[0];requireValue(sameVector(first.position,item.descriptor.initial.ball.position)
    &&sameVector(first.velocity,item.descriptor.initial.ball.velocity)&&sameVector(first.spin,item.descriptor.initial.ball.spin),'saved release PV/fullspin differs');
  requireValue(['w','x','y','z'].every(key=>Object.is(first.orientation![key as keyof Quaternion],item.descriptor.materialOrientationAtStart![key as keyof Quaternion])),
    'saved release q0 differs');
  requireValue(typeof parentGround.actualGroundObserved==='boolean'&&typeof parentGround.actualMarkedCounterfactual==='boolean'
    &&Array.isArray(parentGround.actualGroundEventSeconds),'explicit saved actual-ground coverage required');
  return freeze({...assemble(item,ownSourceSamples,ownSourceSamples,item.referenceElapsedSeconds,parentGround.actualGroundEventSeconds,
    'SAVED_ORDINARY_OWNER_OWN_SERIES_ACTUAL_BOUNDARY_FLAGS',parentGround.actualGroundObserved,parentGround.actualMarkedCounterfactual),
    execution:'SAVED_ORDINARY_OWN_SERIES_READ_ONLY',sourceKernelConstructions:0});
}
type Summary=ReturnType<typeof measureKireBaseCaseV180>['summary'];
export function analyzeKireBaseDomainV180(raw:readonly Summary[]){
  const rows=cloneInert(raw).sort((a,b)=>a.aDegrees-b.aDegrees||a.bDegrees-b.bDegrees);
  requireValue(rows.length===16&&rows.every(row=>row.presetId===rows[0].presetId),'one fixed 16-case domain required');
  requireValue(rows.every((row,i)=>row.aDegrees===angles[Math.floor(i/4)]&&row.bDegrees===angles[i%4]),'fixed local-x/local-y grid required');
  const baseline=rows[0];requireValue(baseline.isIdentity,'ordinary identity is fixed stage zero');
  const T=baseline.common.referenceElapsedSeconds;requireValue(rows.every(row=>row.common.referenceElapsedSeconds===T),'original ordinary own common clock required');
  const relativeAmount=(a:number|null,b:number|null)=>a===null||b===null||a<1e-6||b<1e-6?null:Math.abs(a-b)/((a+b)/2),
    angle=(a:Vec3|null,b:Vec3|null)=>{if(a===null||b===null)return null;const n=Math.hypot(a.x,a.y,a.z)*Math.hypot(b.x,b.y,b.z);
      return n>0?Math.acos(Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y+a.z*b.z)/n)))*180/Math.PI:null;},
    order=(items:readonly Summary[],which:'common'|'own')=>{
      const v=items.map(row=>row[which]),available=v.every(row=>[row.p10,row.p50,row.p90,row.width,row.late20].every(Number.isFinite)),
        within=available&&v.every(row=>row.p10!>=0&&row.p10!<=row.p50!&&row.p50!<=row.p90!&&row.p90!<=row.referenceElapsedSeconds!),
        P=available&&v.slice(1).every((row,i)=>v[i].p10!<row.p10!),
        D=available&&v.slice(1).every((row,i)=>v[i].width!>row.width!),
        L=available&&v.slice(1).every((row,i)=>v[i].late20!<row.late20!);
      return {available,within,P,D,L};
    },roleRows:any[]=[],pairs:any[]=[],pairCache=new Map<string,any>();
  function pair(a:Summary,b:Summary){
    const ids=[a.id,b.id].sort(),key=ids.join('|');if(pairCache.has(key))return pairCache.get(key);
    const c=a.common,d=b.common,e=a.own,f=b.own,
      ca=c.amountMeters===null||d.amountMeters===null?null:Math.abs(c.amountMeters-d.amountMeters),cr=relativeAmount(c.amountMeters,d.amountMeters),
      cd=angle(c.normalDisplacementWorld,d.normalDisplacementWorld),oa=e.amountMeters===null||f.amountMeters===null?null:Math.abs(e.amountMeters-f.amountMeters),
      or=relativeAmount(e.amountMeters,f.amountMeters),od=angle(e.normalDisplacementWorld,f.normalDisplacementWorld),
      groundClear=[a.commonGround,b.commonGround,a.ownGround,b.ownGround].every(g=>g?.status==='NO_ACTUAL_GROUND_REPORTED'),
      commonClassified=c.status==='CLASSIFIED'&&d.status==='CLASSIFIED',ownClassified=e.status==='CLASSIFIED'&&f.status==='CLASSIFIED',
      Q=commonClassified&&ownClassified&&groundClear&&ca!==null&&ca<=.02&&cr!==null&&cr<=.05&&cd!==null&&cd<=5
        &&oa!==null&&oa<=.02&&or!==null&&or<=.05&&od!==null&&od<=5,
      p50Difference=c.p50===null||d.p50===null||T===null?null:Math.abs(c.p50-d.p50)/T,
      lateDifference=c.late20===null||d.late20===null?null:Math.abs(c.late20-d.late20),
      result={caseIds:ids,Q,commonClassified,ownClassified,groundClear,commonAbsoluteAmountDifferenceMeters:ca,
        commonRelativeAmountDifference:cr,commonDirectionDifferenceDegrees:cd,ownAbsoluteAmountDifferenceMeters:oa,
        ownRelativeAmountDifference:or,ownDirectionDifferenceDegrees:od,p50FractionDifference:p50Difference,late20FractionDifference:lateDifference,
        legacyExploratoryScreen:(p50Difference!==null&&p50Difference>=.05)||(lateDifference!==null&&lateDifference>=.05)};
    pairCache.set(key,result);pairs.push(result);return result;
  }
  let selected:any=null;
  const better=(a:any,b:any)=>{
    if(b===null)return true;
    for(const [key,direction]of [['minimumAdjacentSixSeconds',1],['minimumAdjacentLate20Increase',1],['maximumPairRelativeAmountDifference',-1]] as const)
      if(a.score[key]!==b.score[key])return direction*(a.score[key]-b.score[key])>0;
    for(let i=0;i<6;i++)if(a.angleTuple[i]!==b.angleTuple[i])return a.angleTuple[i]<b.angleTuple[i];return false;
  };
  for(const a of rows)for(const b of rows)for(const c of rows){
    if(a.id===b.id||a.id===c.id||b.id===c.id)continue;
    const items=[baseline,a,b,c],ps=[pair(items[0],items[1]),pair(items[0],items[2]),pair(items[0],items[3]),pair(a,b),pair(a,c),pair(b,c)],
      common=order(items,'common'),own=order(items,'own'),Q=ps.every(p=>p.Q),commonQPDL=Q&&common.within&&common.P&&common.D&&common.L,
      candidate=commonQPDL&&own.within&&own.P&&own.D&&own.L,
      score=common.available?{minimumAdjacentSixSeconds:Math.min(...items.slice(1).flatMap((row,i)=>[
        row.common.p10!-items[i].common.p10!,items[i].common.width!-row.common.width!])),
        minimumAdjacentLate20Increase:Math.min(...items.slice(1).map((row,i)=>row.common.late20!-items[i].common.late20!)),
        maximumPairRelativeAmountDifference:ps.every(p=>p.commonRelativeAmountDifference!==null&&p.ownRelativeAmountDifference!==null)?
          Math.max(...ps.flatMap(p=>[p.commonRelativeAmountDifference,p.ownRelativeAmountDifference])):null}:null,
      row={caseIds:items.map(x=>x.id),angleTuple:[a.aDegrees,a.bDegrees,b.aDegrees,b.bDegrees,c.aDegrees,c.bDegrees],Q,...common,commonQPDL,
        ownTimingOrder:own,candidate,legacyAdjacentScreen:[ps[0],ps[3],ps[5]].every(p=>p.legacyExploratoryScreen),score};
    roleRows.push(row);if(candidate&&better(row,selected))selected=row;
  }
  const delta=(a:Vec3,b:Vec3)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),magnitude=(v:Vec3)=>Math.hypot(v.x,v.y,v.z),
    ownEndpointDiagnostics=rows.map(row=>{
      const a=row.ownEndpoint,b=baseline.ownEndpoint;if(a===null||b===null)return {id:row.id,available:false};
      const positionDifferenceMeters=delta(a.position,b.position),velocityDifferenceMps=delta(a.velocity,b.velocity);
      return {id:row.id,available:true,positionDifferenceMeters,positionDistanceMeters:magnitude(positionDifferenceMeters),
        arrivalTimeDifferenceSeconds:row.ownElapsedSeconds!-baseline.ownElapsedSeconds!,velocityDifferenceMps,
        velocityDifferenceMagnitudeMps:magnitude(velocityDifferenceMps),speedDifferenceMps:magnitude(a.velocity)-magnitude(b.velocity),
        rawDiagnosticOnly:true,newGateAdded:false};
    });
  requireValue(roleRows.length===3360,'all fixed 16P3 role assignments required');
  return freeze({version:'kire_base_domain_analysis_v180',presetId:rows[0].presetId,referenceElapsedSeconds:T,caseCount:16,
    baselineCaseId:baseline.id,roleRows,pairs,ownEndpointDiagnostics,nearRoleCount:roleRows.filter(x=>x.Q).length,
    commonQPDLCount:roleRows.filter(x=>x.commonQPDL).length,candidateCount:roleRows.filter(x=>x.candidate).length,
    alsoLegacyScreenCount:roleRows.filter(x=>x.candidate&&x.legacyAdjacentScreen).length,selected,
    rank:'MAX_MIN_COMMON_SIX_ADJACENT_P10_DELAY_WIDTH_SHORTENING_THEN_MAX_MIN_LATE20_THEN_MIN_MAX_RELATIVE_AMOUNT_THEN_NUMERIC_AB_TUPLE_LEX',
    ownPDLRequiredForCandidate:true,ordinaryBaselineIncludedInEveryGate:true,p10IsForceOrPerceptionOnset:false,
    gridCoversAllSO3:false,newPerceptionThresholdAdded:false,forceTimerAdded:false,nativeAdmission:false,skillAdmission:false});
}
