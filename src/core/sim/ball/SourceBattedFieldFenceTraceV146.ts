import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
import {createSourceFreeBallKernel,type SourceFreeBallDescriptorV2} from './SourceFreeBallKernel';
import {deriveSourceBattedFieldMotionV145,type SourceBattedFieldMotionTraceV145} from './SourceBattedFieldMotionV145';
import {querySourceFenceOverflightV146,type SourceFenceOverflightQueryInputV146,type SourceFenceOverflightQueryResultV146} from './SourceFenceOverflightV146';
import type {BallWorldMoment} from './BallWorldContinuation';
import {querySourceFreeBallWorldWithPolesV136} from './SourceFreeBallWorldQuery';

type PhysicalInput=Parameters<typeof deriveSourceBattedFieldMotionV145>[0];
type FenceDefinition=Pick<SourceFenceOverflightQueryInputV146,'fence'|'policy'>;
type OrderUnproved=Omit<Extract<SourceFenceOverflightQueryResultV146,{kind:'unresolved'}>,'reason'>&Readonly<{reason:'physical_boundary_order_unproved'}>;
export type SourceFieldFenceResultV146=SourceFenceOverflightQueryResultV146|OrderUnproved;
export type SourceBattedFieldFenceTraceV146=Readonly<{
  version:'source_batted_field_fence_trace_v146';physical:SourceBattedFieldMotionTraceV145;
  intervals:readonly Readonly<{afterStepIndex:number;descriptor:SourceFreeBallDescriptorV2;moment:BallWorldMoment;side:'incoming'|'outgoing';
    checkpointFromElapsedSeconds:number;throughElapsedSeconds:number;physicalBoundaryFirstPossibleElapsedSeconds:number|null;
    results:readonly SourceFieldFenceResultV146[]}>[];
}>;
const exact=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)
  &&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const canonical=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)
  ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value);
const same=(a:unknown,b:unknown)=>{if(canonical(a)!==canonical(b))throw Error('Source field fence original geometry or curve differs');};
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const floatBits=new DataView(new ArrayBuffer(8));
const previousFloat=(n:number)=>{
  if(n===0)return-Number.MIN_VALUE;
  floatBits.setFloat64(0,n);floatBits.setBigUint64(0,floatBits.getBigUint64(0)+(n>0?-1n:1n));return floatBits.getFloat64(0);
};
const basisKey=({throughElapsedSeconds:_,...basis}:SourceFreeBallDescriptorV2)=>canonical(basis);

/** Re-derives the actual physical trace from raw Source. Saved traces/proofs
 * are not inputs. Each mathematical fence query stops at its next actual
 * physical cut; it cannot inspect a hypothetical future past an earlier hit.
 * Ordinary checkpoints extend the same uninterrupted basis window. A new
 * impulse starts a new window, but cannot erase the trace's first ground.
 * This pure result grants no Native ownership, fair/foul, HR or official end. */
export const deriveSourceBattedFieldFenceTraceV146=(raw:PhysicalInput&Readonly<{fences:readonly FenceDefinition[]}>):SourceBattedFieldFenceTraceV146=>{
  const q=cloneInert(raw);
  if(!exact(q,['initial','throughTicks','parkEquipment','fences'])||!Array.isArray(q.fences)
    ||!q.initial?.cursor?.sourceCurve||q.initial.cursor.sourceSide!=='incoming')throw Error('invalid explicit Source field fence input');
  const ids=new Set<string>(),surfaces=new Set<string>();
  for(const definition of q.fences){
    if(!exact(definition,['fence','policy']))throw Error('invalid explicit Source field fence definition');
    // Zero-time validation only. It issues no positive-time pole-blind query.
    querySourceFenceOverflightV146({descriptor:q.initial.cursor.sourceCurve,moment:q.initial.cursor.moment,side:'incoming',
      throughElapsedSeconds:q.initial.cursor.moment.elapsedSeconds,...definition});
    const fence=definition.fence;
    if(ids.has(fence.boundaryId)||surfaces.has(fence.surface.surfaceId))throw Error('duplicate explicit Source field fence identity');
    ids.add(fence.boundaryId);surfaces.add(fence.surface.surfaceId);
    const original=q.initial.response.world.surfaces.filter(s=>s.surfaceId===fence.surface.surfaceId);
    if(original.length!==1)throw Error('Source field fence is not an original physical surface');
    same(fence.surface,original[0]);
  }
  const physical=deriveSourceBattedFieldMotionV145({initial:q.initial,throughTicks:q.throughTicks,parkEquipment:q.parkEquipment}),
    intervals:SourceBattedFieldFenceTraceV146['intervals'][number][]=[];
  // Read the actual versioned search-resolution header at zero time, not a
  // separately invented tolerance or a positive-time pole-blind search. Real
  // rebound diagnostics below retain their tighter original contact bracket.
  const header=querySourceFreeBallWorldWithPolesV136({poles:q.parkEquipment.poles.map(p=>p.geometry),world:{
    descriptor:q.initial.cursor.sourceCurve,moment:q.initial.cursor.moment,side:'incoming',throughElapsedSeconds:q.initial.cursor.moment.elapsedSeconds,
    actors:q.initial.actors,surfaces:q.initial.response.world.surfaces,bases:q.initial.geometry.bases}});
  if(header.kind==='unresolved')throw Error('Source field fence search-resolution header unresolved');
  let previous=physical.initial;
  let start:Readonly<{key:string;moment:BallWorldMoment;side:'incoming'|'outgoing'}>|undefined;
  let firstGround=physical.initial.motion.world.kind==='boundary'&&physical.initial.motion.world.contacts.some(c=>c.kind==='ground')
    ?physical.initial.motion.world.moment:null;
  for(const [afterStepIndex,step]of physical.steps.entries()){
    const prior=previous.motion.cursor,current=step.field.motion.world;
    if(!prior?.sourceCurve||!prior.sourceSide)throw Error('Source field fence requires its actual free prefix');
    const through=current.moment.elapsedSeconds;
    if(through<prior.moment.elapsedSeconds)throw Error('Source field fence actual prefix reversed');
    const key=basisKey(prior.sourceCurve);
    if(start?.key!==key)start={key,moment:prior.moment,side:prior.sourceSide};
    const windowStart=start;
    if(through>prior.moment.elapsedSeconds){
      const requested=Math.max(prior.moment.elapsedSeconds,(step.throughTick-prior.moment.originTick)/q.initial.response.world.parameters.ticksPerSecond),
        descriptor={...prior.sourceCurve,throughElapsedSeconds:Math.max(prior.sourceCurve.throughElapsedSeconds,requested)};
      same(createSourceFreeBallKernel(descriptor).evaluateAt(through,current.kind==='boundary'?'incoming':'outgoing').moment,current.moment);
      const diagnostic=physical.impulseCertificates.find(c=>c.afterStepIndex===afterStepIndex)?.diagnostic;
      const boundaryFirst=current.kind==='boundary'?diagnostic?.firstPossibleElapsedSeconds
        ??Math.max(windowStart.moment.elapsedSeconds,previousFloat(through-header.numericalResolution.contactBracketSeconds)):null;
      const results:SourceFieldFenceResultV146[]=q.fences.map(definition=>{
        if(firstGround)return{authority:'SOURCE_NONLINEAR_FENCE_TRANSIT_RESEARCH',boundaryId:definition.fence.boundaryId,
          window:{fromElapsedSeconds:windowStart.moment.elapsedSeconds,throughElapsedSeconds:through},kind:'blocked_by_ground',moment:firstGround};
        const result=querySourceFenceOverflightV146({descriptor,moment:windowStart.moment,side:windowStart.side,throughElapsedSeconds:through,...definition});
        if(result.kind!=='witness'||boundaryFirst===null||result.exit.witnessElapsedSeconds<boundaryFirst)return result;
        return{authority:result.authority,boundaryId:result.boundaryId,window:result.window,kind:'unresolved',reason:'physical_boundary_order_unproved',
          interval:{from:result.exit.firstPossibleElapsedSeconds,through}};
      });
      intervals.push({afterStepIndex,descriptor,moment:windowStart.moment,side:windowStart.side,checkpointFromElapsedSeconds:prior.moment.elapsedSeconds,
        throughElapsedSeconds:through,physicalBoundaryFirstPossibleElapsedSeconds:boundaryFirst,results});
    }
    if(!firstGround&&current.kind==='boundary'&&current.contacts.some(c=>c.kind==='ground'))firstGround=current.moment;
    previous=step.field;
  }
  return freeze({version:'source_batted_field_fence_trace_v146',physical,intervals});
};
