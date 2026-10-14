import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,fsyncSync,mkdirSync,openSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {cloneInert} from '../../../src/core/adjudication/OfficialWindowPolicy';
import {actorJson} from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Pin=Readonly<{path:string;sha256:string}>;
export interface ReturnedOwnerObserver {returned(operation:string,args:readonly unknown[],result:unknown):void}
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
/** A separate frozen facade forwards every method to the real frozen owner.
 * Only an observation follows a successful original return; its identity and
 * exception are never replaced by a fixture result. */
export const forwardObservedOwner=<T extends object>(owner:T,labels:Readonly<Record<string,string>>,observer:ReturnedOwnerObserver):T=>{
 const descriptors=Object.getOwnPropertyDescriptors(owner);for(const name of Object.keys(labels))assert(typeof descriptors[name]?.value==='function','observed owner method is missing');
 const facade=Object.create(Object.getPrototypeOf(owner));
 for(const key of Reflect.ownKeys(descriptors)){
  const descriptor=Reflect.get(descriptors,key) as PropertyDescriptor;assert('value'in descriptor,'owner facade requires data properties');const original=descriptor.value;
  Object.defineProperty(facade,key,{...descriptor,value:typeof original==='function'?function(...args:unknown[]){const result=Reflect.apply(original,owner,args);const label=typeof key==='string'?labels[key]:undefined;if(label)observer.returned(label,args,result);return result;}:original});
 }
 return Object.freeze(facade) as T;
};
/** Private test evidence only. A failed post-return write cannot undo its owner. */
export const createReturnedOwnerObservation=(directory:string,options:Readonly<{sync?:(fd:number)=>void}>={})=>{
 assert(isAbsolute(directory),'observation directory must be absolute');mkdirSync(directory,{mode:0o700});assert(realpathSync(directory)===directory,'observation directory aliases');
 const sync=options.sync??fsyncSync,syncDirectory=()=>{const fd=openSync(directory,'r');try{sync(fd);}finally{closeSync(fd);}};
 const path=join(directory,'events.jsonl'),fd=openSync(path,'wx',0o600);let closed=false,sequence=0,receipt:Pin|undefined;
 try{sync(fd);syncDirectory();}catch(error){closeSync(fd);throw error;}
 const append=(event:Record<string,unknown>)=>{assert(!closed&&sequence<128,'owner observation is closed or exhausted');const line=JSON.stringify({sequence:sequence++,...event})+'\n';assert(Buffer.byteLength(line)<=8192,'owner observation metadata is too large');writeFileSync(fd,line);sync(fd);};
 const observer={
  returned(operation:string,args:readonly unknown[],result:unknown){
   try{
    assert(/^[a-z_]+(?:\.[a-zA-Z]+)?$/.test(operation),'owner observation operation differs');const value=actorJson(cloneInert(result));assert(typeof value==='string'&&Buffer.byteLength(value)<=1048576,'owner returned value is too large or absent');
    const resultPath=join(directory,String(sequence)+'-returned.json'),resultFd=openSync(resultPath,'wx',0o600);try{writeFileSync(resultFd,value);sync(resultFd);}finally{closeSync(resultFd);}syncDirectory();
    append({event:'owner_returned',operation,argumentsSha256:sha(actorJson(cloneInert(args))),result:{path:resultPath,sha256:sha(value)}});
   }catch(cause){throw new Error('observation failed after owner returned: '+operation,{cause});}
  },
  checkpoint(message:string){assert(typeof message==='string'&&message.length<=2048,'observation checkpoint differs');append({event:'checkpoint',message});},
  close():Pin{if(receipt)return receipt;assert(!closed,'owner observation close was incomplete');try{sync(fd);}finally{closed=true;closeSync(fd);}syncDirectory();receipt={path,sha256:sha(readFileSync(path))};return receipt;},
 };
 return Object.freeze(observer);
};
/** Prototype spies must preserve the caller's real class receiver. */
export const observeReturnedMethod=<T extends (...args:any[])=>any>(original:T,operation:string,observer:ReturnedOwnerObserver)=>
 function(this:unknown,...args:Parameters<T>):ReturnType<T>{const result=Reflect.apply(original,this,args) as ReturnType<T>;observer.returned(operation,args,result);return result;};
/** Register restoration immediately after each spy is created. */
export const installObservationHooks=(install:(register:(restore:()=>void)=>void)=>void):(()=>void)=>{
 const restores:(()=>void)[]=[];let done=false;const cleanup=()=>{if(done)return;done=true;const failures:unknown[]=[];while(restores.length)try{restores.pop()!();}catch(error){failures.push(error);}if(failures.length)throw new AggregateError(failures,'observation hook cleanup failed');};
 try{install(restore=>restores.push(restore));return cleanup;}catch(primary){try{cleanup();}catch(cleanupError){throw new AggregateError([primary,cleanupError],'observation hook installation and cleanup failed',{cause:primary});}throw primary;}
};
/** Compare separately captured real returns; never manufacture an earlier
 * observation from the final closure's expected-official/scoring mirrors. */
export const assertReturnedCompletion=(raw:readonly Readonly<{operation:string;value:unknown}>[])=>{
 const rows=cloneInert(raw),names=rows.map(r=>r.operation);assert(names.length===6&&['official.applyAndActivate','official.applyAndFinalize'].includes(names[0]),'ordinary completion owner return inventory differs');
 assert.equal(actorJson(names.slice(1)),actorJson(['scoring','effort','workload','completion','completion']),'ordinary completion owner return order differs');
 const [official,scoring,effort,workload,complete,retry]=rows.map(r=>r.value) as any[];const same=(a:unknown,b:unknown)=>assert.equal(actorJson(a),actorJson(b),'actual returned owner values differ');
 assert(complete?.sourceId==='terminal-continuation-k-close'&&complete.gameId==='game-1'&&complete.playId===8,'returned completion identity differs');
 assert(official?.receipt?.applicationId==='terminal-continuation-k-application'&&scoring?.scoringApplicationId==='terminal-continuation-k-score','returned application identities differ');
 assert(effort?.kind==='MATCH'&&effort.effortUnits===6&&workload?.careerId==='career-a'&&workload.playerId==='p2','returned role effort/workload differs');
 same(official,complete.official);same(scoring,complete.scoring);same(effort,complete.workload.activity);same(workload,complete.workload.after);same(retry,complete);
};
