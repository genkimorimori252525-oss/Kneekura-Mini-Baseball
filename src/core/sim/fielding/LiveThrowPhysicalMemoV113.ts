/** Synchronous, caller-owned lifetime. No cache survives a field/relay scope. */
type Kind='shooting'|'verification';
type Entry=Readonly<{kind:Kind;value:unknown}>;
export type LiveThrowPhysicalMemoOptionsV113=Readonly<{maximumEntries?:number;maximumVerificationEntries?:number;maximumNamespaces?:number}>;
export type LiveThrowPhysicalNamespaceV113=Readonly<{id:number;scope:object}>;
type Context={namespaces:Map<string,LiveThrowPhysicalNamespaceV113>;maximumNamespaces:number;nextNamespaceId:number;namespaceEvictions:number;entries:Map<string,Entry>;maximumEntries:number;maximumVerificationEntries:number;verificationEntries:number;
 hits:number;misses:number;evictions:number;shootingHits:number;verificationHits:number};
let active:Context|null=null;
const snapshot=(c:Context)=>Object.freeze({entries:c.entries.size,maximumEntries:c.maximumEntries,
 maximumVerificationEntries:c.maximumVerificationEntries,verificationEntries:c.verificationEntries,
 maximumNamespaces:c.maximumNamespaces,namespaceEntries:c.namespaces.size,namespaceEvictions:c.namespaceEvictions,
 hits:c.hits,misses:c.misses,evictions:c.evictions,shootingHits:c.shootingHits,verificationHits:c.verificationHits});
export function getLiveThrowPhysicalMemoStatsV113(){return active?snapshot(active):null;}
export function withLiveThrowPhysicalMemoV113<T>(run:(stats:()=>ReturnType<typeof snapshot>)=>T,options:LiveThrowPhysicalMemoOptionsV113={}):T{
 // Verification values retain only one incoming sample and physical boundaries,
 // not kernel cells/closures. Keep total entries fixed while retaining the
 // repeated route working set (V116 exact-key shadow audit).
 const maximumEntries=options.maximumEntries??2048,maximumVerificationEntries=options.maximumVerificationEntries??Math.min(128,maximumEntries),
  maximumNamespaces=options.maximumNamespaces??32;
 if(!Number.isSafeInteger(maximumEntries)||maximumEntries<1||maximumEntries>8192||!Number.isSafeInteger(maximumVerificationEntries)
  ||maximumVerificationEntries<1||maximumVerificationEntries>maximumEntries||!Number.isSafeInteger(maximumNamespaces)
  ||maximumNamespaces<1||maximumNamespaces>128)throw Error('live throw physical memo: invalid entry bound');
 const parent=active,context:Context={namespaces:new Map(),maximumNamespaces,nextNamespaceId:0,namespaceEvictions:0,entries:new Map(),maximumEntries,maximumVerificationEntries,verificationEntries:0,
  hits:0,misses:0,evictions:0,shootingHits:0,verificationHits:0};
 active=context;try{return run(()=>snapshot(context));}finally{active=parent;context.entries.clear();context.namespaces.clear();context.verificationEntries=0;}
}

/** Intern complete exact physics once per call, rather than copying it into
 * every state key. Evicted namespaces receive fresh ids on return; old entries
 * cannot alias a different physics profile. Tokens are valid only in their scope. */
export function internLiveThrowPhysicalNamespaceV113(key:()=>string):LiveThrowPhysicalNamespaceV113|null{
 const context=active;if(!context)return null;
 const exact=key(),cached=context.namespaces.get(exact);
 if(cached){context.namespaces.delete(exact);context.namespaces.set(exact,cached);return cached;}
 if(context.namespaces.size>=context.maximumNamespaces){
  context.namespaces.delete(context.namespaces.keys().next().value!);context.namespaceEvictions++;
 }
 const namespace=Object.freeze({id:++context.nextNamespaceId,scope:context});context.namespaces.set(exact,namespace);return namespace;
}

/** Encode finite values by their exact IEEE754 bits, including signed zero.
 * No rounding, tolerance bucket, input getter or external object identity. */
export function exactLiveThrowPhysicalKeyV113(input:unknown):string{
 const view=new DataView(new ArrayBuffer(8)),ancestors=new Set<object>();
 const encode=(v:unknown):string=>{
  if(typeof v==='number'){
   if(!Number.isFinite(v))throw Error('live throw physical memo: finite key required');
   view.setFloat64(0,v,false);return 'n'+view.getUint32(0,false).toString(16).padStart(8,'0')+view.getUint32(4,false).toString(16).padStart(8,'0');
  }
  if(v===undefined)return 'u';if(v===null)return 'z';if(typeof v==='boolean')return v?'t':'f';if(typeof v==='string')return 's'+JSON.stringify(v);
  if(typeof v!=='object'||ancestors.has(v))throw Error('live throw physical memo: inert acyclic key required');
  const array=Array.isArray(v),prototype=Object.getPrototypeOf(v);
  if(!array&&prototype!==Object.prototype&&prototype!==null)throw Error('live throw physical memo: plain key required');
  ancestors.add(v);const keys=Reflect.ownKeys(v).filter(k=>!(array&&k==='length'));
  if(keys.some(k=>typeof k!=='string')||array&&keys.length!==v.length)throw Error('live throw physical memo: dense inert key required');
  const entries=(keys as string[]).sort().map(k=>{
   const d=Object.getOwnPropertyDescriptor(v,k)!;
   if(!d.enumerable||!('value'in d))throw Error('live throw physical memo: data key required');
   return JSON.stringify(k)+':'+encode(d.value);
  });ancestors.delete(v);return(array?'a':'o')+'{'+entries.join(',')+'}';
 };return encode(input);
}
function freezeOwned<T>(v:T):T{
 if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freezeOwned);Object.freeze(v);}return v;
}
export function memoizeLiveThrowPhysicalV113<T>(kind:Kind,key:()=>string,compute:()=>T,namespace?:LiveThrowPhysicalNamespaceV113|null):T{
 const context=active;if(!context||namespace&&namespace.scope!==context)return compute();
 const id=kind+':'+(namespace?'n'+namespace.id+':':'k:')+key(),cached=context.entries.get(id);
 if(cached){context.entries.delete(id);context.entries.set(id,cached);context.hits++;
  if(kind==='shooting')context.shootingHits++;else context.verificationHits++;
  return cached.value as T;
 }
 context.misses++;const value=freezeOwned(compute());
 const remove=(entryKey:string)=>{const e=context.entries.get(entryKey)!;if(e.kind==='verification')context.verificationEntries--;
  context.entries.delete(entryKey);context.evictions++;};
 if(kind==='verification'&&context.verificationEntries>=context.maximumVerificationEntries){
  const oldest=[...context.entries].find(([,entry])=>entry.kind==='verification')!;remove(oldest[0]);
 }
 if(context.entries.size>=context.maximumEntries)remove(context.entries.keys().next().value!);
 context.entries.set(id,{kind,value});if(kind==='verification')context.verificationEntries++;
 return value;
}
