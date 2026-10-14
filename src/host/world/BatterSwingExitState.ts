import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { sampleDefenderPhysicalPrimitiveSegment, type DefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import type { SwingExitBodyState } from '../../core/sim/running/BatterSwingExitRunTransition';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as id, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
export type AcceptedBatterSwingExitState = Readonly<{
  sourceId:string;sourceVersion:string;capability:'same_pa_batter_swing_exit_state_v1';
  fieldReference:SamePaReference<'pa_physical_v1_field_roots'|'pa_physical_v1_field_steps'>;
  transitionModelReference:SamePaReference<'world_player_batter_run_transition_models'>;
  /** Independent accepted physical direction, never a bat axis or velocity heading. */
  bodyForwardUnit:SwingExitBodyState['bodyForwardUnit'];
}>;
const unit=(v:unknown):v is SwingExitBodyState['bodyForwardUnit']=>fields(v,['x','z'])&&Object.values(v).every(Number.isFinite)
  &&Math.abs(Math.hypot(Number(v.x),Number(v.z))-1)<=1e-9;
export const batterSwingExitStateInput=(raw:unknown,sourceId?:string):AcceptedBatterSwingExitState=>{
  const s=cloneInert(raw) as AcceptedBatterSwingExitState;
  if(!fields(s,['sourceId','sourceVersion','capability','fieldReference','transitionModelReference','bodyForwardUnit'])
    ||!id(s.sourceId)||!id(s.sourceVersion)||sourceId!==undefined&&s.sourceId!==sourceId||s.capability!=='same_pa_batter_swing_exit_state_v1'
    ||!(ref(s.fieldReference,'pa_physical_v1_field_roots')||ref(s.fieldReference,'pa_physical_v1_field_steps'))
    ||!ref(s.transitionModelReference,'world_player_batter_run_transition_models')||!unit(s.bodyForwardUnit))throw new Error('invalid accepted batter swing-exit Source');
  return freeze(s);
};
export type BatterSwingExitProjectionInput=Readonly<{
  at:Readonly<{originTick:number;elapsedSeconds:number;tick:number}>;contactTick:number;ticksPerSecond:number;
  bodyPrimitive:DefenderPhysicalPrimitiveSegment;startElapsedSeconds?:number;bodyOffset:Readonly<{x:number;y:number;z:number}>;bodyForwardUnit:SwingExitBodyState['bodyForwardUnit'];
}>;
/** Pure projection only. Native must supply the original body primitive and its
 * separately accepted static offset. This derives neither facing nor intent. */
export const projectBatterSwingExitState=(raw:BatterSwingExitProjectionInput)=>{
  const s=cloneInert(raw),tick=(n:number)=>Number.isSafeInteger(n)&&n>=0;
  if(!fields(s,['at','contactTick','ticksPerSecond','bodyPrimitive','bodyOffset','bodyForwardUnit',...(Object.hasOwn(s,'startElapsedSeconds')?['startElapsedSeconds']:[])])||!fields(s.at,['originTick','elapsedSeconds','tick'])
    ||![s.at.originTick,s.at.tick,s.contactTick].every(tick)||!tick(s.ticksPerSecond)||s.ticksPerSecond===0
    ||!Number.isFinite(s.at.elapsedSeconds)||s.at.elapsedSeconds<0||s.at.tick<s.contactTick
    ||s.at.elapsedSeconds!==(s.at.tick-s.at.originTick)/s.ticksPerSecond||s.bodyPrimitive.role!=='body'
    ||s.bodyPrimitive.ticksPerSecond!==s.ticksPerSecond||!fields(s.bodyOffset,['x','y','z'])||!Object.values(s.bodyOffset).every(Number.isFinite)
    ||!unit(s.bodyForwardUnit))throw new Error('batter swing-exit requires an exact supported body cut');
  const checked=sampleDefenderPhysicalPrimitiveSegment(s.bodyPrimitive,s.at.tick),offset=s.startElapsedSeconds??0;
  const dt=(s.at.tick-s.bodyPrimitive.startTick)/s.ticksPerSecond-offset,p=s.bodyPrimitive;
  if(!Number.isFinite(offset)||offset<0||dt<0)throw new Error('batter swing-exit retained primitive start differs');
  const vector=(f:(axis:'x'|'y'|'z')=>number)=>({x:f('x'),y:f('y'),z:f('z')});
  const body={...checked,center:vector(a=>p.startCenter[a]+p.startVelocity[a]*dt+0.5*p.acceleration[a]*dt*dt),velocity:vector(a=>p.startVelocity[a]+p.acceleration[a]*dt)};
  if(![...Object.values(body.center),...Object.values(body.velocity)].every(Number.isFinite))throw new Error('batter swing-exit body arithmetic overflow');
  if(body.velocity.y!==0||body.acceleration.y!==0)throw new Error('batter planar recovery cannot discard vertical motion');
  const state:SwingExitBodyState={tick:s.at.tick,planarVelocity:{x:body.velocity.x,z:body.velocity.z},bodyForwardUnit:s.bodyForwardUnit};
  return freeze({state,root:{position:{x:body.center.x-s.bodyOffset.x,y:body.center.y-s.bodyOffset.y,z:body.center.z-s.bodyOffset.z},velocity:body.velocity}});
};
