import {resolveHalfInningTransition} from '../../../core/rules/HalfInningTransitionRule';
import {createInitialForceObligationState,deriveCurrentForceObligations,retireForceParticipant} from '../../../core/rules/ForceObligation';

/** Narrow first-base out adjudication from an already completed loose world.
 * No batted-ball/fair-ball facts are used as baseball rule authority. */
export function resolveUncaughtThirdFirstOutV1(x:{before:any;batterId:string;firstBase:{x:number;y:number;z:number};baseTouchRadiusMeters:number;field:any}){
 const {before,batterId,field}=x, f=field?.experimentalUncaughtThirdFacts??field?.runnerFacts,runner=field?.finalRunners?.[0];
 if((!Number.isInteger(before?.outs)||before.outs<0||before.outs>=2)||before?.strikes!==2||before?.balls>2||Object.values(before?.bases??{}).some(Boolean)||!batterId||!field?.end?.complete||field?.diagnostics?.unresolvedDetail||!f||field.finalRunners.length!==1)throw Error('HOLD: unsupported uncaught third scope');
 const obligation=deriveCurrentForceObligations(createInitialForceObligationState(before.bases,batterId)).find(o=>o.runnerId===batterId&&o.targetBase===1);
 if(!obligation||obligation.classification!=='batter_runner_before_first')throw Error('HOLD: first base obligation missing');
 const controls=f.controlledBaseContacts.filter((e:any)=>e.base===1),touches=f.runnerTouches.filter((e:any)=>e.runnerId===batterId&&e.base===1),tags=f.controlledRunnerTags.filter((e:any)=>e.runnerId===batterId);
 if(touches.length){const first=[...touches].sort((a:any,b:any)=>a.tick-b.tick)[0],touchFact=field.facts.filter((e:any)=>e.kind==='runner_base_touch'&&e.runnerId===batterId&&e.base===1&&e.tick===first.tick),distance=Math.hypot(runner.position.x-x.firstBase.x,runner.position.z-x.firstBase.z);
  if(touchFact.length!==1||first.tick<f.contactTick||first.tick>f.throughTick||controls.some((e:any)=>e.tick<=first.tick)||tags.length||runner.runnerId!==batterId||runner.retired||runner.scored||runner.base!==1||!Number.isFinite(distance)||distance>x.baseTouchRadiusMeters)throw Error('HOLD: unsupported safe first-base facts');
  return {kind:'applied' as const,match:{...before,bases:{...before.bases,first:batterId},balls:0,strikes:0,playId:before.playId+1},batterAdvanced:true,halfChanged:false,gameOver:false,winner:null,scoredRunnerIds:[],suppressedRunnerIds:[],outcomes:[],endedAtTick:field.end.tick,classification:'strikeout' as const};
 }
 if(controls.length!==1||tags.length||touches.length||!runner||runner.runnerId!==batterId||!runner.retired||runner.base!==0)throw Error('HOLD: unsupported first-base race facts');
 const control=controls[0],secured=field.facts.filter((e:any)=>e.kind==='catch_secured'&&e.playerId===control.defenderId&&e.tick===control.tick);
 if(secured.length!==1||control.tick<f.contactTick||control.tick>f.throughTick||control.tick>field.end.tick)throw Error('HOLD: base control not backed by same-tick custody');
 const dist=Math.hypot(runner.position.x-x.firstBase.x,runner.position.z-x.firstBase.z);
 if(!Number.isFinite(dist)||!(dist>x.baseTouchRadiusMeters))throw Error('HOLD: runner position at retirement not separated from first');
 const forceAfter=retireForceParticipant(createInitialForceObligationState(before.bases,batterId),batterId);
 if(deriveCurrentForceObligations(forceAfter).some(o=>o.runnerId===batterId))throw Error('HOLD: force not retired');
 const transition=resolveHalfInningTransition({inning:before.inning,half:before.half,outsAfterPlay:before.outs+1});if(transition.kind!=='half_inning_continues')throw Error('HOLD: third out out of scope');
 return {kind:'applied' as const,match:{...before,outs:transition.outs,balls:0,strikes:0,playId:before.playId+1},batterAdvanced:true,halfChanged:false,gameOver:false,winner:null,scoredRunnerIds:[],suppressedRunnerIds:[],outcomes:[{runnerId:batterId,tick:control.tick,classification:'batter_runner_before_first',cause:'base_control',defenderId:control.defenderId}],endedAtTick:field.end.tick,classification:'strikeout' as const};
}
