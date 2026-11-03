import { observePitchTrajectoryShapeV172 } from '../../src/integration/browser/PitchTrajectoryShapeV172';
export { measurePitchBreakLowSpinCaseV158 } from './pitch-break-low-spin-v158';
export { observePitchTrajectoryShapeV172 };

type V3={x:number;y:number;z:number};
type Row={elapsedSeconds:number;position:V3;velocity:V3;phase:'airborne'|'sliding'|'rolling'|'resting'};
type Ground={actualGroundObserved:boolean;actualMarkedCounterfactual:boolean;actualGroundEventSeconds:number[]};
const xyz=['x','y','z'] as const,dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
function requireValue(value:unknown,message:string):asserts value {if(!value)throw Error('net kire v176: '+message);}
function actualGround(parent:Ground|undefined,end:number){
  if(!parent||typeof parent.actualGroundObserved!=='boolean'||typeof parent.actualMarkedCounterfactual!=='boolean'||
    !Array.isArray(parent.actualGroundEventSeconds))return {status:'UNKNOWN' as const,parent:parent??null};
  const events=parent.actualGroundEventSeconds.filter(t=>t<=end);
  return {status:parent.actualMarkedCounterfactual?'ACTUAL_COUNTERFACTUAL' as const:events.length?'GROUND_REPORTED' as const:
    parent.actualGroundObserved?'GROUND_REPORTED_WITHOUT_EARLIEST_EVENT' as const:'NO_ACTUAL_GROUND_REPORTED' as const,
    parent,eventSecondsThroughEndpoint:events,analyticBaselineFlagsAreNotActualBallFlags:true};
}
function endpoint(position:V3,t:number,frame:ReturnType<typeof observePitchTrajectoryShapeV172>['frame']){
  requireValue(Number.isFinite(t)&&t>0&&xyz.every(k=>Number.isFinite(position[k])),'finite endpoint required');
  const displacement={x:position.x-frame.origin.x-frame.initialVelocity.x*t,y:position.y-frame.origin.y-frame.initialVelocity.y*t,
    z:position.z-frame.origin.z-frame.initialVelocity.z*t},along=dot(displacement,frame.unitTangent),
    normalDisplacementWorld={x:displacement.x-frame.unitTangent.x*along,y:displacement.y-frame.unitTangent.y*along,
      z:displacement.z-frame.unitTangent.z*along},
    normalCoordinates={u:dot(normalDisplacementWorld,frame.normalU),v:dot(normalDisplacementWorld,frame.normalV)};
  return {elapsedSeconds:t,position,normalDisplacementWorld,normalCoordinates,amountMeters:Math.hypot(normalCoordinates.u,normalCoordinates.v)};
}
export function observeSavedNetRecordV176(record:any){
  const net=observePitchTrajectoryShapeV172({sourceSamples:record.observation.sourceSamples,
    referenceElapsedSeconds:record.observation.referenceElapsedSeconds}),own=record.observation.ownPlate,
    ownEndpoint=own?.metrics?.platePosition?endpoint(own.metrics.platePosition,own.metrics.flightSeconds,net.frame):null;
  return {id:record.id,category:'FIXED_PV_SAVED_REFINEMENT_NET_OBSERVATION',common:net,
    commonGround:actualGround(record.observation.timingAtReference?.groundClassification,net.referenceElapsedSeconds),
    own:{status:'POINT_MEASURED_TIMING_NOT_OBSERVED',endpoint:ownEndpoint,timing:null,
      ground:actualGround(own?.timingAtOwnPlate?.groundClassification,ownEndpoint?.elapsedSeconds??0)},
    skillAdmission:false,nativeAdmission:false};
}
/** Reads the exact sampler closures returned by the public Workbench call.
 * No Source is recreated here and no sample field is reordered/projected. */
export function observeOrdinaryNetV176(id:string,result:any,commonEnd:number,intervals:number){
  requireValue(Number.isSafeInteger(intervals)&&intervals>0,'positive observation grid required');
  const ownEnd=result.metrics.flightSeconds;
  requireValue(commonEnd>0&&commonEnd<=ownEnd,'common clock must stay within measured actual ground-event coverage');
  const sample=(end:number)=>Array.from({length:intervals+1},(_,index)=>{
    const t=index===intervals?end:end*index/intervals,state=result.sampleAtPitchElapsedSeconds(t);
    requireValue(state!==null&&Object.keys(state).sort().join('|')==='elapsedSeconds|orientation|phase|position|spin|tick|velocity',
      'exact actual Source sample schema required');return state as Row;
  }),sourceSamples=sample(commonEnd),ownSourceSamples=sample(ownEnd),
    common=observePitchTrajectoryShapeV172({sourceSamples,referenceElapsedSeconds:commonEnd}),
    own=observePitchTrajectoryShapeV172({sourceSamples:ownSourceSamples,referenceElapsedSeconds:ownEnd}),
    parent=result.metrics.breakTimingV155.commonTime.airlessGravity.groundClassification;
  return {id,category:'ORDINARY_SAME_TARGET_AFTER_ACTUAL_RELEASE_COMPENSATION',common,sourceSamples,
    commonGround:actualGround(parent,commonEnd),own:{status:'FULL_ACTUAL_SOURCE_TIME_SERIES_MEASURED',observation:own,
      sourceSamples:ownSourceSamples,endpoint:endpoint(ownSourceSamples.at(-1)!.position,ownEnd,own.frame),
      ground:actualGround(parent,ownEnd)},release:result.fixedInitial,releaseCommand:result.metrics.breakTimingV155.releaseCommand,
    metrics:result.metrics,skillAdmission:false,nativeAdmission:false};
}
export function assessNetTripletV176(rows:readonly any[]){
  requireValue(rows.length===3,'fixed triplet required');
  const T=rows[0].common.referenceElapsedSeconds;
  requireValue(rows.every(row=>row.common.referenceElapsedSeconds===T),'one common observation clock required');
  const fixedPV=rows.every(row=>row.category==='FIXED_PV_SAVED_REFINEMENT_NET_OBSERVATION'),
    amount=(row:any)=>row.common.timing.finalNormalDisplacementMeters,
    vector=(row:any)=>row.common.raw.at(-1).normalDisplacementWorld,
    relative=(a:number,b:number)=>a<1e-6||b<1e-6?null:Math.abs(a-b)/((a+b)/2),
    angle=(a:V3,b:V3)=>{const n=Math.hypot(...xyz.map(k=>a[k]))*Math.hypot(...xyz.map(k=>b[k]));
      return n>0?Math.acos(Math.max(-1,Math.min(1,dot(a,b)/n)))*180/Math.PI:null;},pairs=[];
  if(fixedPV)requireValue(rows.every(row=>['origin','initialVelocity','unitTangent','normalU','normalV'].every(key=>
    xyz.every(axis=>Object.is(row.common.frame[key][axis],rows[0].common.frame[key][axis])))),'fixed-PV frame equality required');
  for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
    const one=rows[a],two=rows[b],e=one.own.endpoint,f=two.own.endpoint,
      commonAngle=()=>{
        if(!fixedPV)return angle(vector(one),vector(two));
        const u=one.common.raw.at(-1).normalCoordinates,v=two.common.raw.at(-1).normalCoordinates;
        return angle({x:u.u/amount(one),y:u.v/amount(one),z:0},{x:v.u/amount(two),y:v.v/amount(two),z:0});
      },
      ownAngle=()=>{
        if(!e||!f)return null;
        if(!fixedPV)return angle(e.normalDisplacementWorld,f.normalDisplacementWorld);
        const frame=one.common.frame;
        return angle({x:dot(e.normalDisplacementWorld,frame.normalU)/e.amountMeters,y:dot(e.normalDisplacementWorld,frame.normalV)/e.amountMeters,z:0},
          {x:dot(f.normalDisplacementWorld,frame.normalU)/f.amountMeters,y:dot(f.normalDisplacementWorld,frame.normalV)/f.amountMeters,z:0});
      },
      ca=Math.abs(amount(one)-amount(two)),cr=relative(amount(one),amount(two)),cd=commonAngle(),
      oa=e&&f?Math.abs(e.amountMeters-f.amountMeters):null,or=e&&f?relative(e.amountMeters,f.amountMeters):null,
      od=ownAngle(),
      groundClear=[one.commonGround,two.commonGround,one.own.ground,two.own.ground].every(x=>x.status==='NO_ACTUAL_GROUND_REPORTED'),
      classified=one.common.status==='CLASSIFIED'&&two.common.status==='CLASSIFIED',
      Q=classified&&groundClear&&ca<=.02&&cr!==null&&cr<=.05&&cd!==null&&cd<=5&&oa!==null&&oa<=.02&&or!==null&&or<=.05&&od!==null&&od<=5,
      p50a=one.common.timing.percentTimes.p50?.elapsedSeconds,p50b=two.common.timing.percentTimes.p50?.elapsedSeconds,
      p50Difference=Number.isFinite(p50a)&&Number.isFinite(p50b)?Math.abs(p50a-p50b)/T:null,
      lateA=one.common.timing.late20Percent.projectedFraction,lateB=two.common.timing.late20Percent.projectedFraction,
      lateDifference=Number.isFinite(lateA)&&Number.isFinite(lateB)?Math.abs(lateA-lateB):null;
    pairs.push({indices:[a,b],caseIds:[one.id,two.id],classified,groundClear,Q,commonAbsoluteAmountDifferenceMeters:ca,
      commonRelativeAmountDifference:cr,commonDirectionDifferenceDegrees:cd,ownAbsoluteAmountDifferenceMeters:oa,
      ownRelativeAmountDifference:or,ownDirectionDifferenceDegrees:od,p50FractionDifference:p50Difference,
      late20FractionDifference:lateDifference,legacyExploratoryScreen:(p50Difference!==null&&p50Difference>=.05)||(lateDifference!==null&&lateDifference>=.05)});
  }
  const times=rows.map(row=>({id:row.id,p10:row.common.timing.percentTimes.p10?.elapsedSeconds??null,
    p50:row.common.timing.percentTimes.p50?.elapsedSeconds??null,p90:row.common.timing.percentTimes.p90?.elapsedSeconds??null,
    width:row.common.timing.transitionIntervalSeconds,late20:row.common.timing.late20Percent.projectedFraction})),
    available=times.every(row=>[row.p10,row.p50,row.p90,row.width,row.late20].every(Number.isFinite)),
    Q=pairs.every(row=>row.Q),P=available&&times[0].p10<times[1].p10&&times[1].p10<times[2].p10,
    D=available&&times[0].width>times[1].width&&times[1].width>times[2].width,
    L=available&&times[0].late20<times[1].late20&&times[1].late20<times[2].late20,
    within=available&&times.every(row=>0<=row.p10&&row.p10<=row.p50&&row.p50<=row.p90&&row.p90<=T),
    ownTimes=rows.map(row=>row.own.observation?.timing??null),ownFull=ownTimes.every(x=>x!==null),
    ownClassified=ownFull&&rows.every(row=>row.own.observation.status==='CLASSIFIED')&&ownTimes.every(t=>t.percentTimes.p10!==null&&t.percentTimes.p90!==null),
    ownTimingOrder=ownClassified?{P:ownTimes[0].percentTimes.p10.elapsedSeconds<ownTimes[1].percentTimes.p10.elapsedSeconds&&
      ownTimes[1].percentTimes.p10.elapsedSeconds<ownTimes[2].percentTimes.p10.elapsedSeconds,
      D:ownTimes[0].transitionIntervalSeconds>ownTimes[1].transitionIntervalSeconds&&ownTimes[1].transitionIntervalSeconds>ownTimes[2].transitionIntervalSeconds,
      L:ownTimes[0].late20Percent.projectedFraction<ownTimes[1].late20Percent.projectedFraction&&
        ownTimes[1].late20Percent.projectedFraction<ownTimes[2].late20Percent.projectedFraction}:null;
  return {fixedIds:rows.map(row=>row.id),Q,P,D,L,withinCasePercentileOrder:within,commonQPDL:Q&&P&&D&&L&&within,
    directionComparison:fixedPV?'COMMON_FIXED_PV_NORMAL_UV_FRAME':'WORLD_NORMAL_DISPLACEMENT_UNIT_VECTOR_DOT_EACH_CASE_HAS_OWN_INITIAL_TANGENT',
    legacyAdjacentScreen:pairs.filter(row=>row.indices[1]-row.indices[0]===1).every(row=>row.legacyExploratoryScreen),
    times,pairs,ownTimingStatus:ownFull?'FULL_ACTUAL_SOURCE_TIME_SERIES_MEASURED':'POINT_MEASURED_TIMING_NOT_OBSERVED',
    ownTimingClassified:ownClassified,ownTimingOrder,skillAdmission:false,nativeAdmission:false,uiAdmission:false};
}
