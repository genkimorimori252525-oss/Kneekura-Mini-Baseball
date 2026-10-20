import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { LiveMeasuredClipV1 } from './LivePitchV1';

export type MeasuredClipValidationLimitsV81 = Readonly<{
  maximumCatalogClips:number;maximumCatalogFrames:number;minimumClipFrames:number;maximumClipFrames:number;sourceRepository:string;
}>;
export const MEASURED_CLIP_VALIDATION_LIMITS_V81:MeasuredClipValidationLimitsV81=Object.freeze({
  maximumCatalogClips:1000,maximumCatalogFrames:150000,minimumClipFrames:2,maximumClipFrames:1000,
  sourceRepository:'https://github.com/drivelineresearch/openbiomechanics',
});
type DataObject=Record<PropertyKey,unknown>;
/** Alternating original/owned objects. No per-node property lists duplicate the catalog. */
type ImmutableProof=readonly object[];
type Entry=Readonly<{catalog:readonly LiveMeasuredClipV1[];proof:ImmutableProof}>;
const cache=new WeakMap<object,Map<string,Entry>>();
const assert=(condition:unknown,message:string):void=>{if(!condition)throw Error('live baseball match: '+message);};
function policy(raw:MeasuredClipValidationLimitsV81){
  const limits=cloneInert(raw),keys=Object.keys(MEASURED_CLIP_VALIDATION_LIMITS_V81);
  assert(Object.keys(limits).length===keys.length&&keys.every(key=>Object.hasOwn(limits,key)),'invalid measured catalog validation limits');
  assert(['maximumCatalogClips','maximumCatalogFrames','minimumClipFrames','maximumClipFrames'].every(key=>Number.isSafeInteger(limits[key as keyof typeof limits])&&Number(limits[key as keyof typeof limits])>0)
    &&limits.maximumClipFrames>=limits.minimumClipFrames&&typeof limits.sourceRepository==='string'&&limits.sourceRepository.length>0,'invalid measured catalog validation limits');
  // All semantic validator dependencies are explicit, primitive and included.
  return {limits,key:JSON.stringify(keys.map(key=>limits[key as keyof typeof limits]))};
}
function sameOwnedTree(one:unknown,two:unknown):boolean{
  if(Object.is(one,two))return true;
  if(!one||!two||typeof one!=='object'||typeof two!=='object'||Array.isArray(one)!==Array.isArray(two))return false;
  const left=Reflect.ownKeys(one),right=Reflect.ownKeys(two);
  return left.length===right.length&&left.every((key,i)=>key===right[i]&&sameOwnedTree((one as DataObject)[key],(two as DataObject)[key]));
}
/** A frozen top-level object is insufficient. Inspect every descriptor without
 * reading getters; Proxy traps still run, including on warm hits. Frozen data
 * descriptors and nonextensibility are enforced by JavaScript Proxy invariants. */
function frozenNode(source:object,owned:object):PropertyKey[]|null{
  if(Object.isExtensible(source)||Array.isArray(source)!==Array.isArray(owned))return null;
  if(Array.isArray(source)){
    // cloneInert reads length as well; do not conceal a revoked/throwing Proxy.
    if(source.length!==(owned as unknown[]).length)return null;
  }else{
    const prototype=Object.getPrototypeOf(source);if(prototype!==Object.prototype&&prototype!==null)return null;
  }
  const keys=Reflect.ownKeys(source),expected=Reflect.ownKeys(owned);
  if(keys.length!==expected.length||keys.some((key,i)=>key!==expected[i]))return null;
  for(const key of keys){
    const descriptor=Object.getOwnPropertyDescriptor(source,key),length=Array.isArray(source)&&key==='length';
    if(!descriptor||!('value'in descriptor)||descriptor.configurable||descriptor.writable||descriptor.enumerable===length)return null;
  }
  return keys;
}
function makeProof(source:unknown,owned:unknown):ImmutableProof|null{
  const pairs:object[]=[],seen=new Map<object,object>();
  function visit(raw:unknown,copy:unknown):boolean{
    if(raw===null||typeof raw!=='object')return Object.is(raw,copy);
    if(!copy||typeof copy!=='object')return false;
    const prior=seen.get(raw);if(prior)return sameOwnedTree(prior,copy);
    const keys=frozenNode(raw,copy);if(!keys)return false;
    seen.set(raw,copy);pairs.push(raw,copy);
    return keys.every(key=>visit(Object.getOwnPropertyDescriptor(raw,key)!.value,Object.getOwnPropertyDescriptor(copy,key)!.value));
  }
  return visit(source,owned)?pairs:null;
}
function proofStillInert(proof:ImmutableProof):boolean{
  // Frozen graphs cannot change data/identity, but revocable or stateful Proxy
  // traps may stop working. Recheck all objects rather than claiming O(1).
  for(let i=0;i<proof.length;i+=2)if(!frozenNode(proof[i],proof[i+1]))return false;
  return true;
}
function freezeOwned(value:unknown):void{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeOwned);Object.freeze(value);}
}

/** Internal Host catalog boundary. Mutable/partial inputs retain the ordinary
 * detached validation path. Never freezes caller-owned data or subsets clips. */
export function cloneValidatedMeasuredCatalogV81(raw:unknown,rawLimits:MeasuredClipValidationLimitsV81=MEASURED_CLIP_VALIDATION_LIMITS_V81):readonly LiveMeasuredClipV1[]{
  const {limits,key}=policy(rawLimits);
  assert(Array.isArray(raw)&&raw.length>0&&raw.length<=limits.maximumCatalogClips&&Reflect.ownKeys(raw).length===raw.length+1,'bounded dense measured catalog required');
  const catalog=raw as unknown[],prior=cache.get(catalog)?.get(key);
  if(prior&&proofStillInert(prior.proof))return prior.catalog;
  const measuredClips:LiveMeasuredClipV1[]=[];let totalFrames=0;
  for(let i=0;i<catalog.length;i++){
    const descriptor=Object.getOwnPropertyDescriptor(catalog,String(i));
    assert(descriptor&&descriptor.enumerable&&'value'in descriptor,'inert measured catalog entries required');
    const clip=cloneInert(descriptor!.value) as LiveMeasuredClipV1;
    assert(clip&&typeof clip==='object'&&typeof clip.id==='string'&&clip.id.startsWith('obp-')&&['R','L'].includes(clip.side)
      &&clip.source?.repository===limits.sourceRepository&&/^[a-f0-9]{64}$/.test(clip.source.sha256)
      &&Number.isFinite(clip.contactTimeSeconds)&&Array.isArray(clip.frames)&&clip.frames.length>=limits.minimumClipFrames&&clip.frames.length<=limits.maximumClipFrames
      &&(clip.defaultSelection===undefined||typeof clip.defaultSelection==='boolean'),'invalid measured catalog clip');
    totalFrames+=clip.frames.length;assert(totalFrames<=limits.maximumCatalogFrames,'measured catalog frame budget exceeded');
    assert(clip.frames.every((frame,j)=>Number.isSafeInteger(frame.tick)&&frame.tick>=0&&(!j||frame.tick>clip.frames[j-1].tick)),'invalid measured catalog clock');
    measuredClips.push(clip);
  }
  assert(new Set(measuredClips.map(clip=>clip.id)).size===measuredClips.length,'duplicate measured clip identity');
  const proof=makeProof(catalog,measuredClips);
  if(proof){freezeOwned(measuredClips);let byPolicy=cache.get(catalog);if(!byPolicy){byPolicy=new Map();cache.set(catalog,byPolicy);}byPolicy.set(key,{catalog:measuredClips,proof});}
  return measuredClips;
}
