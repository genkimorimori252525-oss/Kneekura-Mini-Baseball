import type {Vec3} from '../../model/geometry';

export type RobustScenarioV247 = Readonly<{ordinal:number;weight:number;timingSeconds:number;aim:Vec3}>;
export type RobustEvaluationV247 = Readonly<{status:'FOUND';component:number}> | Readonly<{status:'MISS'|'UNRESOLVED';reason:string}>;
export type RobustCandidateV247 = Readonly<{ordinal:number;delta:Vec3;norm:number}>;

/** Axis-only, caller-declared finite scenarios; neither a probability nor a calibration. */
export function robustScenariosV247(sigma:Readonly<{timingSeconds:number;aim:Vec3}>):readonly RobustScenarioV247[] {
 const values=[sigma?.timingSeconds,sigma?.aim?.x,sigma?.aim?.y,sigma?.aim?.z];
 if(!values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))throw Error('invalid declared effective sigma');
 const out:RobustScenarioV247[]=[{ordinal:0,weight:1/3,timingSeconds:0,aim:{x:0,y:0,z:0}}];
 for(let axis=0;axis<4;axis++)for(const sign of [-1,1]){const v=[0,0,0,0];v[axis]=sign*Math.sqrt(6)*values[axis]!;out.push({ordinal:out.length,weight:1/12,timingSeconds:v[0],aim:{x:v[1],y:v[2],z:v[3]}});}
 return out;
}

/** Scores only the already-certified nominal candidates; incomplete evaluation never selects. */
export function evaluateRobustContactFrameAimV247(input:Readonly<{
 sigma:Readonly<{timingSeconds:number;aim:Vec3}>; candidates:readonly RobustCandidateV247[];
 thresholds:Readonly<{minimumComponent:number;minimumImprovement:number}>; maximumEvaluations:number;
 evaluate:(scenario:RobustScenarioV247,delta:Vec3)=>RobustEvaluationV247;
}>) {
 const scenarios=robustScenariosV247(input.sigma),required=scenarios.length*(1+input.candidates.length);
 const assumptions={finiteAxisOnly:true,simultaneousDeviationsCovered:false,probability:false,calibrated:false,earnedQualification:false} as const;
 if(!input.candidates.length)return {status:'NO_TARGET' as const,reason:'NO_NOMINAL_ELIGIBLE_CANDIDATES',required,evaluations:0,assumptions};
 if(!Number.isSafeInteger(input.maximumEvaluations)||input.maximumEvaluations<required)return {status:'UNRESOLVED' as const,reason:'EVALUATION_BUDGET_INSUFFICIENT',required,evaluations:0,assumptions};
 const normal=scenarios.map(s=>input.evaluate(s,{x:0,y:0,z:0}));
 const candidates=input.candidates.map(candidate=>{
  const results=scenarios.map((scenario,i)=>{const baseline=normal[i],trial=input.evaluate(scenario,candidate.delta);
   const unresolved=baseline.status==='UNRESOLVED'||trial.status==='UNRESOLVED';
   const component=trial.status==='FOUND'?trial.component:null,improvement=baseline.status==='FOUND'&&component!==null?component-baseline.component:null;
   const success=!unresolved&&component!==null&&improvement!==null&&component>=input.thresholds.minimumComponent&&improvement>=input.thresholds.minimumImprovement;
   return {scenario,baseline,trial,component,improvement,success,unresolved};});
  return {...candidate,scenarios:results,successWeight:results.reduce((sum,s)=>sum+(s.success?s.scenario.weight:0),0),
   weightedComponent:results.reduce((sum,s)=>sum+(s.component??0)*s.scenario.weight,0),weightedImprovement:results.reduce((sum,s)=>sum+(s.improvement??0)*s.scenario.weight,0)};
 });
 const evaluations=required;
 if(candidates.some(c=>c.scenarios.some(s=>s.unresolved)))return {status:'UNRESOLVED' as const,reason:'SCENARIO_UNRESOLVED',normal,candidates,required,evaluations,assumptions};
 const ranked=[...candidates].sort((a,b)=>b.successWeight-a.successWeight||b.weightedComponent-a.weightedComponent||b.weightedImprovement-a.weightedImprovement||a.norm-b.norm||a.ordinal-b.ordinal);
 if(ranked[0].successWeight===0)return {status:'NO_TARGET' as const,reason:'NO_SUCCESSFUL_SCENARIO',normal,candidates,required,evaluations,assumptions};
 return {status:'PLANNED' as const,selected:ranked[0],normal,candidates,required,evaluations,assumptions};
}
