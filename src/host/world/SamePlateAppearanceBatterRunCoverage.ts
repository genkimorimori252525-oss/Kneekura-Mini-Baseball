import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Request = Extract<SamePaPhysicalFieldAction, {kind:'batter_run_motion_v1'}>;
const key = (playerId:string,role:string)=>json([playerId,role]);
const ref = (f:Field)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
/** Native supplies its rederived original prefix. A runner-only rebase may
 * shorten a foreign curve's stored horizon without cancelling that actor's
 * original longer command. Other replacements reset the retained horizon. */
export const samePaBatterRunForeignCoverage=(root:SamePaPhysicalFieldRoot,previous:Field,prefix:readonly Field[],runnerId:string,
  continuations:Request['stationaryHoldContinuations']):number=>{
  if(!prefix.length||json(ref(prefix[0]))!==json(ref(root))||json(ref(prefix.at(-1)!))!==json(ref(previous)))throw new Error('batter-run command continuation prefix differs');
  const horizons=new Map(root.field.motion.actors.filter(a=>a.playerId!==runnerId).map(a=>[key(a.playerId,a.primitive.role),a.primitive.endTick]));
  for(let i=1;i<prefix.length;i++){
    const before=prefix[i-1],field=prefix[i],action=field.kind==='same_pa_physical_field_step_v1'?field.source.action:undefined;
    const runner=field.kind==='same_pa_physical_field_step_v1'&&(field.actionResult?.kind==='batter_run_motion_v1'||field.actionResult?.kind==='batter_catch_motion_v1'||field.actionResult?.kind==='occupied_runner_catch_motion_v1')&&field.actionResult.playerId===runnerId;
    for(const a of field.field.motion.actors.filter(a=>a.playerId!==runnerId)){
      const id=key(a.playerId,a.primitive.role),old=before.field.motion.actors.find(o=>key(o.playerId,o.primitive.role)===id);
      if(!old||!horizons.has(id))throw new Error('batter-run command continuation participant differs');
      if(!runner&&json(a)!==json(old))horizons.set(id,a.primitive.endTick);
      const hold=action?.kind==='batter_run_motion_v1'?action.stationaryHoldContinuations?.find(c=>c.playerId===a.playerId):undefined;
      if(runner&&hold)horizons.set(id,hold.throughTick);
    }
  }
  const moment=previous.field.motion.world.moment;
  for(const c of continuations??[]){
    // A received caught response supersedes the old ordinary hold, including
    // while its sensory/decision/first-step work still awaits motor adoption.
    const decision=[...prefix].reverse().find(f=>f.kind==='same_pa_physical_field_step_v1'
      &&(f.actionResult?.kind==='defender_decision_v1'||f.actionResult?.kind==='defender_catch_response_v1')&&f.actionResult.playerId===c.playerId);
    const result=decision?.kind==='same_pa_physical_field_step_v1'?decision.actionResult:undefined;
    const actors=previous.field.motion.actors.filter(a=>a.playerId===c.playerId);
    if(c.playerId===runnerId||!decision||json(ref(decision))!==json(c.decisionReference)||result?.kind!=='defender_decision_v1'
      ||result.calculation.selected.intent.kind!=='hold'||result.target!==null||result.calculation.scheduling.movementStartTick>moment.ball.tick
      ||decision.evaluationTick>moment.ball.tick||c.throughTick<=moment.ball.tick||actors.length!==5||new Set(actors.map(a=>a.primitive.role)).size!==5)
      throw new Error('batter-run stationary hold requires the latest due owned decision');
    for(const a of actors){
      const state=samplePiecewiseFieldActor(a,moment),id=key(a.playerId,a.primitive.role),old=horizons.get(id);
      if(old===undefined||c.throughTick<=old||moment.elapsedSeconds>(a.primitive.endTick-moment.originTick)/a.primitive.ticksPerSecond
        ||Object.values(state.velocity).some(n=>n!==0)||Object.values(a.primitive.acceleration).some(n=>n!==0))
        throw new Error('batter-run stationary hold cannot renew moving or exhausted physical state');
      horizons.set(id,c.throughTick);
    }
  }
  return Math.min(...horizons.values());
};
