import type {ObservedPitchPositionV151} from '../../src/core/decision/batting/ObservedPitchForecastV151';
type Vec=Readonly<{x:number;y:number;z:number}>;
type Input=Readonly<{originTick:number;ticksPerSecond:number;cutoffTick:number;planeZ:number;maximumAfterReleaseSeconds:number;observations:readonly ObservedPitchPositionV151[]}>;
type Prediction=Readonly<{status:'PREDICTED';degree:2|3;lastTick:number;windowTicks:number;arrivalTick:number;coefficients:Readonly<{x:readonly number[];y:readonly number[];z:readonly number[]}>;usedObservationIds:readonly string[];boundary:'CAUSAL_UNCALIBRATED_PILOT'}>;
const axes=['x','y','z'] as const;
const evaluate=(c:readonly number[],u:number)=>c.reduceRight((v,n)=>v*u+n,0);
function derivativeRoots(c:readonly number[]):number[]{const a=3*(c[3]??0),b=2*c[2],d=c[1];if(a===0)return b===0?[]:[-d/b];const disc=b*b-4*a*d;if(!(disc>=0))return [];const root=Math.sqrt(disc),q=-.5*(b+(b<0?-root:root));return q===0?[-b/(2*a)]:[q/a,d/q];}
/** Modified Gram-Schmidt with a second orthogonalization pass, on scaled time. */
function fitColumns(u:readonly number[],values:readonly number[],degree:2|3):number[]|null {
 const q:number[][]=[],r=Array.from({length:degree+1},()=>Array<number>(degree+1).fill(0));
 for(let j=0;j<=degree;j++){
  const v=u.map(x=>x**j);for(let pass=0;pass<2;pass++)for(let k=0;k<j;k++){const dot=q[k].reduce((a,x,i)=>a+x*v[i],0);r[k][j]+=dot;for(let i=0;i<v.length;i++)v[i]-=dot*q[k][i];}
  const length=Math.hypot(...v);if(!Number.isFinite(length)||length<=1e-11)return null;r[j][j]=length;q.push(v.map(x=>x/length));
 }
 const y=q.map(col=>col.reduce((a,x,i)=>a+x*values[i],0)),coefficients=Array<number>(degree+1).fill(0);
 for(let j=degree;j>=0;j--){let n=y[j];for(let k=j+1;k<=degree;k++)n-=r[j][k]*coefficients[k];coefficients[j]=n/r[j][j];if(!Number.isFinite(coefficients[j]))return null;}
 return coefficients;
}
/** Diagnostic fits use only points delivered by cutoff; no actual future enters. */
export function fitCausalForecastV245(input:Input,degree:2|3):Prediction|Readonly<{status:'UNASSESSED';reason:string;degree:2|3;usedObservationIds:readonly string[]}> {
 const none=(reason:string,usedObservationIds:readonly string[]=[])=>({status:'UNASSESSED' as const,reason,degree,usedObservationIds});
 if(!input||![2,3].includes(degree)||!Number.isSafeInteger(input.originTick)||!Number.isSafeInteger(input.cutoffTick)||input.cutoffTick<input.originTick||!Number.isSafeInteger(input.ticksPerSecond)||input.ticksPerSecond<=0||!Number.isFinite(input.planeZ)||!Number.isFinite(input.maximumAfterReleaseSeconds)||input.maximumAfterReleaseSeconds<=0||!Array.isArray(input.observations))return none('INVALID_INPUT');
 const ids=new Set<string>(),ticks=new Set<number>();for(const o of input.observations){if(!o||typeof o.observationId!=='string'||!o.observationId||ids.has(o.observationId)||!Number.isSafeInteger(o.observedTick)||o.observedTick<input.originTick||ticks.has(o.observedTick)||!Number.isSafeInteger(o.availableTick)||o.availableTick<o.observedTick||!o.position||!axes.every(k=>Number.isFinite(o.position[k])))return none('INVALID_OBSERVATION');ids.add(o.observationId);ticks.add(o.observedTick);}
 const points=input.observations.filter(o=>o.observedTick<=input.cutoffTick&&o.availableTick<=input.cutoffTick).sort((a,b)=>a.observedTick-b.observedTick).slice(-7),used=points.map(x=>x.observationId);
 if(points.length<degree+1)return none('INSUFFICIENT_OBSERVATIONS',used);const last=points[points.length-1],windowTicks=last.observedTick-points[0].observedTick;if(!(windowTicks>0))return none('RANK_DEFICIENT',used);
 const u=points.map(p=>(p.observedTick-last.observedTick)/windowTicks),x=fitColumns(u,points.map(p=>p.position.x),degree),y=fitColumns(u,points.map(p=>p.position.y),degree),z=fitColumns(u,points.map(p=>p.position.z),degree);if(!x||!y||!z)return none('RANK_DEFICIENT',used);
 const start=(input.cutoffTick-last.observedTick)/windowTicks,end=(input.originTick+input.maximumAfterReleaseSeconds*input.ticksPerSecond-last.observedTick)/windowTicks;
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return none('HORIZON_EXHAUSTED',used);
 if(!(evaluate(z,start)>input.planeZ))return none('PLANE_ALREADY_PASSED',used);
 const breaks=[start,...derivativeRoots(z).filter(t=>Number.isFinite(t)&&t>start&&t<end).sort((a,b)=>a-b),end];let crossing:number|null=null;
 for(let i=0;i<breaks.length-1;i++){let lo=breaks[i],hi=breaks[i+1],fLo=evaluate(z,lo)-input.planeZ,fHi=evaluate(z,hi)-input.planeZ;if(![fLo,fHi].every(Number.isFinite))return none('NONFINITE_EXTRAPOLATION',used);if(fLo>0&&fHi<=0){for(let k=0;k<80;k++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;if(evaluate(z,mid)>input.planeZ)lo=mid;else hi=mid;}const slope=z[1]+2*z[2]*hi+3*(z[3]??0)*hi*hi;if(slope<0){crossing=hi;break;}}}
 if(crossing===null)return none('NO_FORWARD_CROSSING',used);const arrivalTick=last.observedTick+crossing*windowTicks;if(!Number.isFinite(arrivalTick)||arrivalTick<=input.cutoffTick||arrivalTick>input.originTick+input.maximumAfterReleaseSeconds*input.ticksPerSecond)return none('NO_FORWARD_CROSSING',used);
 return {status:'PREDICTED',degree,lastTick:last.observedTick,windowTicks,arrivalTick,coefficients:{x,y,z},usedObservationIds:used,boundary:'CAUSAL_UNCALIBRATED_PILOT'};
}
export function positionAtCausalForecastV245(forecast:Prediction,tick:number):Vec {
 if(!Number.isFinite(tick))throw Error('invalid forecast tick');const u=(tick-forecast.lastTick)/forecast.windowTicks,result={x:evaluate(forecast.coefficients.x,u),y:evaluate(forecast.coefficients.y,u),z:evaluate(forecast.coefficients.z,u)};if(!axes.every(k=>Number.isFinite(result[k])))throw Error('nonfinite forecast position');return result;
}
