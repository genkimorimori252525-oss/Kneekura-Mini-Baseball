import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
import {forecastObservedPitchV151,type ObservedPitchPositionV151} from './ObservedPitchForecastV151';
type Input=Readonly<{originTick:number;ticksPerSecond:number;cutoffTick:number;planeZ:number;maximumAfterReleaseSeconds:number;observations:readonly ObservedPitchPositionV151[]}>;
export type ObservedPitchForecastPolicyV246=Readonly<{version:'observed_pitch_forecast_policy_v246';maximumExtrapolationRatio:number;minimumQrDiagonalRatio:number;minimumForwardSpeedMps:number;maximumRootBracketTicks:number;maximumPlaneResidualMeters:number}>;
const axes=['x','y','z'] as const;
const fields=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const valueAt=(c:readonly number[],u:number)=>c.reduceRight((a,x)=>a*u+x,0);
function qrFit(u:readonly number[],samples:readonly number[],minimumRatio:number):Readonly<{coefficients:number[];reason:null}|{coefficients:null;reason:'QR_CONDITION'|'NONFINITE_COEFFICIENT'}> {
 const q:number[][]=[],r=Array.from({length:4},()=>Array<number>(4).fill(0));
 for(let j=0;j<4;j++){
  const v=u.map(t=>t**j);for(let pass=0;pass<2;pass++)for(let k=0;k<j;k++){const dot=q[k].reduce((a,x,i)=>a+x*v[i],0);r[k][j]+=dot;for(let i=0;i<v.length;i++)v[i]-=dot*q[k][i];}
  const length=Math.hypot(...v);if(!Number.isFinite(length))return {coefficients:null,reason:'NONFINITE_COEFFICIENT'};if(length===0)return {coefficients:null,reason:'QR_CONDITION'};r[j][j]=length;q.push(v.map(x=>x/length));
 }
 const diagonal=r.map((row,i)=>row[i]);if(Math.min(...diagonal)/Math.max(...diagonal)<minimumRatio)return {coefficients:null,reason:'QR_CONDITION'};
 const y=q.map(col=>col.reduce((a,x,i)=>a+x*samples[i],0)),result=Array<number>(4).fill(0);
 for(let j=3;j>=0;j--){let v=y[j];for(let k=j+1;k<4;k++)v-=r[j][k]*result[k];result[j]=v/r[j][j];if(!Number.isFinite(result[j]))return {coefficients:null,reason:'NONFINITE_COEFFICIENT'};}
 return {coefficients:result,reason:null};
}
function derivativeRoots(c:readonly number[]):number[]|null {
 let a=3*c[3],b=2*c[2],d=c[1];const scale=Math.max(Math.abs(a),Math.abs(b),Math.abs(d));if(!Number.isFinite(scale))return null;if(scale===0)return [];a/=scale;b/=scale;d/=scale;
 if(a===0)return b===0?[]:[-d/b];const discriminant=b*b-4*a*d;if(!Number.isFinite(discriminant))return null;if(discriminant<0)return [];const root=Math.sqrt(discriminant),q=-.5*(b+(b<0?-root:root));return q===0?[-b/(2*a)]:[q/a,d/q];
}
/** Explicit local experiment. V151 remains the untouched fallback and default. */
export function forecastObservedPitchV246(raw:Input,rawPolicy:ObservedPitchForecastPolicyV246){
 const policy=cloneInert(rawPolicy);if(!fields(policy,['version','maximumExtrapolationRatio','minimumQrDiagonalRatio','minimumForwardSpeedMps','maximumRootBracketTicks','maximumPlaneResidualMeters'])||policy.version!=='observed_pitch_forecast_policy_v246'||![policy.maximumExtrapolationRatio,policy.minimumQrDiagonalRatio,policy.minimumForwardSpeedMps,policy.maximumRootBracketTicks,policy.maximumPlaneResidualMeters].every(x=>Number.isFinite(x)&&x>0)||policy.minimumQrDiagonalRatio>1)throw Error('observed pitch forecast v246: invalid explicit policy');
 // Inspect only delivery timestamps before the causal boundary. Undelivered payloads never enter either model.
 const inputKeys=['originTick','ticksPerSecond','cutoffTick','planeZ','maximumAfterReleaseSeconds','observations'];
 if(!fields(raw,inputKeys)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))return forecastObservedPitchV151(raw) as never;
 const descriptors=Object.getOwnPropertyDescriptors(raw);if(inputKeys.some(key=>!descriptors[key]?.enumerable||!('value' in descriptors[key])))return forecastObservedPitchV151(raw) as never;
 const observedValues=descriptors.observations.value,cutoff=descriptors.cutoffTick.value as number;if(!Array.isArray(observedValues))return forecastObservedPitchV151(raw) as never;
 const delivered:{observation:ObservedPitchPositionV151;observedTick:number}[]=[],deliveredTicks=new Set<number>();
 for(const observation of observedValues){
  const observed=observation&&Object.getOwnPropertyDescriptor(observation,'observedTick'),available=observation&&Object.getOwnPropertyDescriptor(observation,'availableTick');
  if(!observed||!available||!('value' in observed)||!('value' in available)||!Number.isSafeInteger(observed.value)||!Number.isSafeInteger(available.value)||available.value<observed.value)return forecastObservedPitchV151(raw) as never;
  if(observed.value<=cutoff&&available.value<=cutoff){if(deliveredTicks.has(observed.value))return forecastObservedPitchV151(raw) as never;deliveredTicks.add(observed.value);delivered.push({observation,observedTick:observed.value});}
 }
 const causalInput={originTick:descriptors.originTick.value,ticksPerSecond:descriptors.ticksPerSecond.value,cutoffTick:cutoff,planeZ:descriptors.planeZ.value,maximumAfterReleaseSeconds:descriptors.maximumAfterReleaseSeconds.value,observations:delivered.sort((a,b)=>a.observedTick-b.observedTick).slice(-7).map(x=>x.observation)} as Input;
 // V151 validates the delivered boundary and retains its own error behavior.
 const legacy=forecastObservedPitchV151(causalInput),input=cloneInert(causalInput);
 const base={requestedModel:'CUBIC_QR_V246' as const,cutoffTick:input.cutoffTick,humanCalibration:'NOT_MEASURED' as const,futureSourceUsed:false as const,policy};
 const fallback=(fallbackReason:string,usedIds:readonly string[]=[],attemptedWindowTicks:number|null=null)=>{
  const oldPoints=legacy.usedObservationIds.map(id=>input.observations.find(point=>point.observationId===id)!),oldWindow=oldPoints.length>=2?oldPoints[oldPoints.length-1].observedTick-oldPoints[0].observedTick:null,
    anchorTick=legacy.prediction?input.originTick+legacy.prediction.arrivalAfterReleaseSeconds*input.ticksPerSecond:null,
    extrapolationTicks=anchorTick!==null&&legacy.observedThroughTick!==null?anchorTick-legacy.observedThroughTick:null;
  return {forecast:legacy,diagnostics:{...base,effectiveModel:'V151' as const,usedObservationIds:legacy.usedObservationIds,attemptedObservationIds:usedIds,anchorTick,observationWindowTicks:oldWindow,attemptedObservationWindowTicks:attemptedWindowTicks,extrapolationTicks,extrapolationRatio:extrapolationTicks!==null&&oldWindow!==null&&oldWindow>0?extrapolationTicks/oldWindow:null,fallbackReason}};
 };
 const points=input.observations.filter(o=>o.observedTick<=input.cutoffTick&&o.availableTick<=input.cutoffTick).sort((a,b)=>a.observedTick-b.observedTick).slice(-7),ids=points.map(p=>p.observationId);
 if(points.length<4)return fallback('INSUFFICIENT_OBSERVATIONS',ids);const last=points[points.length-1],windowTicks=last.observedTick-points[0].observedTick;if(!(windowTicks>0))return fallback('QR_CONDITION',ids,windowTicks);
 const u=points.map(p=>(p.observedTick-last.observedTick)/windowTicks),fx=qrFit(u,points.map(p=>p.position.x),policy.minimumQrDiagonalRatio),fy=qrFit(u,points.map(p=>p.position.y),policy.minimumQrDiagonalRatio),fz=qrFit(u,points.map(p=>p.position.z),policy.minimumQrDiagonalRatio);if(!fx.coefficients||!fy.coefficients||!fz.coefficients)return fallback(fx.reason??fy.reason??fz.reason??'QR_CONDITION',ids,windowTicks);const cx=fx.coefficients,cy=fy.coefficients,cz=fz.coefficients;
 const start=0,horizon=(input.originTick+input.maximumAfterReleaseSeconds*input.ticksPerSecond-last.observedTick)/windowTicks,end=Math.min(policy.maximumExtrapolationRatio,horizon);
 if(!Number.isFinite(start)||!Number.isFinite(end))return fallback('NONFINITE_EXTRAPOLATION',ids,windowTicks);if(end<=start)return fallback('EXTRAPOLATION_LIMIT',ids,windowTicks);
 const atStart=valueAt(cz,start)-input.planeZ;if(!Number.isFinite(atStart))return fallback('NONFINITE_EXTRAPOLATION',ids,windowTicks);if(atStart<=0)return fallback('PLANE_ALREADY_PASSED',ids,windowTicks);
 const roots=derivativeRoots(cz);if(!roots||roots.some(x=>!Number.isFinite(x)))return fallback('UNCERTAIN_CROSSING',ids,windowTicks);
 const intervals=[start,...roots.filter(x=>x>start&&x<end).sort((a,b)=>a-b),end];let crossing:number|null=null,rootLo:number|null=null,rootHi:number|null=null;
 for(let i=0;i<intervals.length-1;i++){
  let lo=intervals[i],hi=intervals[i+1],fLo=valueAt(cz,lo)-input.planeZ,fHi=valueAt(cz,hi)-input.planeZ;if(!Number.isFinite(fLo)||!Number.isFinite(fHi))return fallback('NONFINITE_EXTRAPOLATION',ids,windowTicks);
  const boundarySpeed=(cz[1]+2*cz[2]*hi+3*cz[3]*hi*hi)*input.ticksPerSecond/windowTicks;
  if(i<intervals.length-2&&Math.abs(fHi)<=policy.maximumPlaneResidualMeters&&Math.abs(boundarySpeed)<policy.minimumForwardSpeedMps)return fallback('UNCERTAIN_CROSSING',ids,windowTicks);
  if(fLo>0&&fHi<=0){for(let k=0;k<96;k++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;const f=valueAt(cz,mid)-input.planeZ;if(!Number.isFinite(f))return fallback('NONFINITE_EXTRAPOLATION',ids,windowTicks);if(f>0)lo=mid;else hi=mid;}
   const velocity=(cz[1]+2*cz[2]*hi+3*cz[3]*hi*hi)*input.ticksPerSecond/windowTicks,residual=Math.abs(valueAt(cz,hi)-input.planeZ);
   if(!Number.isFinite(velocity)||!Number.isFinite(residual)||(hi-lo)*windowTicks>policy.maximumRootBracketTicks||residual>policy.maximumPlaneResidualMeters||velocity>-policy.minimumForwardSpeedMps)return fallback('UNCERTAIN_CROSSING',ids,windowTicks);crossing=hi;rootLo=lo;rootHi=hi;break;
  }
 }
 if(crossing===null||rootLo===null||rootHi===null)return fallback(end===policy.maximumExtrapolationRatio?'EXTRAPOLATION_LIMIT':'NO_FORWARD_CROSSING',ids,windowTicks);
 const cutoffRatio=(input.cutoffTick-last.observedTick)/windowTicks,cutoffInsideBracket=cutoffRatio>=rootLo&&cutoffRatio<=rootHi;
 // This floating-point fit does not certify mathematical equality at cutoff; retain V151 instead.
 if(cutoffInsideBracket)return fallback('UNCERTAIN_CROSSING_AT_CUTOFF',ids,windowTicks);
 const arrivalTick=last.observedTick+crossing*windowTicks,extrapolationTicks=arrivalTick-last.observedTick,anchorRatio=extrapolationTicks/windowTicks,factor=input.ticksPerSecond/windowTicks,coefficients={x:cx,y:cy,z:cz},position={x:0,y:0,z:0},estimatedVelocity={x:0,y:0,z:0},estimatedAcceleration={x:0,y:0,z:0};
 if(arrivalTick===input.cutoffTick)return fallback('UNCERTAIN_CROSSING_AT_CUTOFF',ids,windowTicks);
 if(cutoffRatio>rootHi)return fallback(input.cutoffTick-arrivalTick<=policy.maximumRootBracketTicks?'UNCERTAIN_CROSSING_AT_CUTOFF':'FIRST_CROSSING_BEFORE_CUTOFF',ids,windowTicks);
 if(!Number.isFinite(arrivalTick)||anchorRatio>policy.maximumExtrapolationRatio||Math.abs(valueAt(cz,anchorRatio)-input.planeZ)>policy.maximumPlaneResidualMeters)return fallback('UNCERTAIN_CROSSING',ids,windowTicks);
 for(const axis of axes){const c=coefficients[axis];position[axis]=valueAt(c,anchorRatio);estimatedVelocity[axis]=(c[1]+2*c[2]*anchorRatio+3*c[3]*anchorRatio*anchorRatio)*factor;estimatedAcceleration[axis]=(2*c[2]+6*c[3]*anchorRatio)*factor*factor;}
 if(!Number.isFinite(arrivalTick)||!axes.every(axis=>Number.isFinite(position[axis])&&Number.isFinite(estimatedVelocity[axis])&&Number.isFinite(estimatedAcceleration[axis])))return fallback('NONFINITE_EXTRAPOLATION',ids,windowTicks);
 const forecast={version:'observed_pitch_forecast_v246' as const,status:'PREDICTED' as const,cutoffTick:input.cutoffTick,observedThroughTick:last.observedTick,availableAtTick:Math.max(...points.map(p=>p.availableTick)),usedObservationIds:ids,prediction:{position,arrivalAfterReleaseSeconds:(arrivalTick-input.originTick)/input.ticksPerSecond,estimatedVelocity,estimatedAcceleration},model:'POSITION_SAMPLES_CUBIC_QR_EXTRAPOLATION' as const,humanCalibration:'NOT_MEASURED' as const,opponentPrivateStateUsed:false as const,futureSourceUsed:false as const};
 return {forecast,diagnostics:{...base,effectiveModel:'CUBIC_QR_V246' as const,usedObservationIds:ids,attemptedObservationIds:ids,anchorTick:arrivalTick,observationWindowTicks:windowTicks,extrapolationTicks,extrapolationRatio:anchorRatio,fallbackReason:null}};
}
