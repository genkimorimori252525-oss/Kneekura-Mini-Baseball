import type {NativeContactRosterExportV264} from './native-contact-roster-export-v264';

type Node = unknown[];
const fail=():never=>{throw Error('invalid V266 contact data')};
const dangerous=new Set(['__proto__','prototype','constructor']);
const limit=100_000,depthLimit=64,textLimit=10_000_000;
const byteLength=(text:string)=>new TextEncoder().encode(text).byteLength;
const dense=(value:unknown):value is unknown[]=>{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>limit)return false;
 const keys=Reflect.ownKeys(value);if(keys.length!==value.length+1||keys[value.length]!=='length')return false;
 for(let i=0;i<value.length;i++){if(keys[i]!==String(i))return false;const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!('value' in d))return false}return true;
};
/** Wire adds node arrays, payload arrays and object pair arrays per data level. */
const assertInertWire=(root:unknown):void=>{
 type Frame={v:unknown;depth:number;exit?:boolean};
 const stack:Frame[]=[{v:root,depth:0}],active=new Set<unknown[]>();let count=0;const budget=limit*6+4;
 while(stack.length){const {v,depth,exit}=stack.pop()!;
  if(exit){active.delete(v as unknown[]);continue}
  if(++count>budget||depth>depthLimit*3+4)fail();
  if(Array.isArray(v)){
   if(active.has(v)||!dense(v))fail();
   // Check before allocating pending frames, including the matching exit sentinel.
   if(count+stack.length+v.length+1>budget)fail();
   active.add(v);stack.push({v,depth,exit:true});
   for(let i=v.length-1;i>=0;i--)stack.push({v:Object.getOwnPropertyDescriptor(v,String(i))!.value,depth:depth+1});
  } else if(v!==null&&typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean')fail();
 }
};
/** Generic typed nodes: object key/value pairs make user-key/tag collisions impossible. */
export function encodeContactNodeV266(input:unknown):Node {
 const ancestors=new Set<object>();let count=0;
 const walk=(v:unknown,depth:number):Node=>{
  if(++count>limit||depth>depthLimit)return fail();
  if(v===null)return ['null'];if(v===undefined)return ['undefined'];
  if(typeof v==='string'||typeof v==='boolean')return [typeof v,v];
  if(typeof v==='number'){if(!Number.isFinite(v))return fail();return Object.is(v,-0)?['negative-zero']:['number',String(v)]}
  if(typeof v!=='object'||ancestors.has(v))return fail();ancestors.add(v);
  const arr=Array.isArray(v),proto=Object.getPrototypeOf(v);if(arr?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)return fail();
  const keys=Reflect.ownKeys(v);if(arr&&!dense(v))return fail();
  const entries:unknown[]=[];
  for(const key of keys){if(arr&&key==='length')continue;if(typeof key!=='string'||dangerous.has(key))return fail();const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!d.enumerable||!('value'in d))return fail();entries.push(arr?walk(d.value,depth+1):[key,walk(d.value,depth+1)])}
  ancestors.delete(v);return [arr?'array':'object',entries];
 };return walk(input,0);
}
export function decodeContactNodeV266(input:unknown):unknown {
 assertInertWire(input); // Wire expansion has its own bounded inertness check.
 let count=0;const walk=(node:unknown,depth:number):unknown=>{
  if(++count>limit||depth>depthLimit||!Array.isArray(node))return fail();const [tag,payload]=node;
  if(tag==='null'&&node.length===1)return null;if(tag==='undefined'&&node.length===1)return undefined;if(tag==='negative-zero'&&node.length===1)return -0;
  if(node.length!==2)return fail();if(tag==='string'&&typeof payload==='string'||tag==='boolean'&&typeof payload==='boolean')return payload;
  if(tag==='number'&&typeof payload==='string'){const n=Number(payload);if(!Number.isFinite(n)||String(n)!==payload)return fail();return n}
  if(tag==='array'&&Array.isArray(payload)){if(payload.length>limit)return fail();return payload.map(v=>walk(v,depth+1))}
  if(tag==='object'&&Array.isArray(payload)){if(payload.length>limit)return fail();const o:Record<string,unknown>={},keys=new Set<string>();for(const p of payload){if(!Array.isArray(p)||p.length!==2||typeof p[0]!=='string'||dangerous.has(p[0])||keys.has(p[0]))return fail();keys.add(p[0]);Object.defineProperty(o,p[0],{value:walk(p[1],depth+1),enumerable:true,writable:true,configurable:true})}return o}
  return fail();
 };return walk(input,0);
}
const object=(v:unknown,keys:string):Record<string,any>=>{if(!v||typeof v!=='object'||Array.isArray(v))return fail();const o=v as Record<string,any>,expected=keys.split(' ');if(Object.keys(o).length!==expected.length||expected.some(k=>!Object.hasOwn(o,k)))return fail();return o};
const str=(v:unknown):string=>typeof v==='string'&&v.length>0&&v.trim()===v?v:fail();
const int=(v:unknown):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0)?v:fail();
const arr=(v:unknown):any[]=>Array.isArray(v)?v:fail();
const eq=(a:unknown,b:unknown)=>{if(a!==b)fail()};
const strings=(v:unknown)=>arr(v).forEach(str);
const hash=(v:unknown)=>{if(v!==null&&(typeof v!=='string'||!/^[0-9a-f]{64}$/.test(v)))fail()};
const time=(v:unknown)=>{const t=object(v,'season day sequence');int(t.season);int(t.day);int(t.sequence)};
const scope=(v:unknown,career:string,player:string)=>{const s=object(v,'careerId playerId');eq(s.careerId,career);eq(s.playerId,player)};
const source=(v:unknown,career:string,player:string)=>{if(v===null)return;const s=object(v,'careerId owner subjectId sourceKey revision snapshotId time');eq(s.careerId,career);eq(s.owner,'BATTING_CONTACT');eq(s.subjectId,player);str(s.sourceKey);int(s.revision);str(s.snapshotId);time(s.time)};
function distribution(v:unknown,career:string,player:string,status:string,reasons:unknown):void {
 const d=object(v,'version boundary scope status reasons source inventoryHash totalContacts bandCount boundary25Count fraction contacts populationCoverage timeSemantics reference directionStatus physicsEffects modelAuthority');
 eq(d.version,'native-contact-distribution-v262');eq(d.boundary,'READ_ONLY_SUPPORTED_NATIVE_CONTACT_DISTRIBUTION');scope(d.scope,career,player);eq(d.status,status);strings(d.reasons);if(JSON.stringify(d.reasons)!==JSON.stringify(reasons))fail();source(d.source,career,player);hash(d.inventoryHash);
 eq(d.populationCoverage,'SUPPORTED_NATIVE_INVENTORY_ONLY');eq(d.timeSemantics,'AS_OF_LATEST_REGISTERED_CONTACT');eq(d.reference,'MLB_LA_GENERAL_GUIDELINE');eq(d.directionStatus,'UNASSESSED');eq(d.physicsEffects,'NONE');eq(d.modelAuthority,'NOT_USED');
 if(status==='UNKNOWN'){if(!d.reasons.length||[d.totalContacts,d.bandCount,d.boundary25Count,d.fraction,d.contacts].some(x=>x!==null))fail();return}
 if(status!=='OBSERVED'||d.reasons.length||d.source===null||d.inventoryHash===null)fail();const contacts=arr(d.contacts);int(d.totalContacts);int(d.bandCount);int(d.boundary25Count);if(!contacts.length||d.totalContacts!==contacts.length)fail();let band=0,boundary=0;let latest:{season:number;day:number;sequence:number}|null=null;const events=new Set<string>(),episodes=new Set<string>();
 for(const item of contacts){const c=object(item,'eventId episodeId time launchAngleDeg label');const event=str(c.eventId),episode=str(c.episodeId);if(events.has(event)||episodes.has(episode))fail();events.add(event);episodes.add(episode);time(c.time);if(latest===null||c.time.day>latest.day||c.time.day===latest.day&&c.time.sequence>latest.sequence)latest=c.time;const a=c.launchAngleDeg;if(typeof a!=='number'||!Number.isFinite(a)||a < -90||a>90)fail();const label=a===25?'BOUNDARY_25':a>=10&&a<25?'LINE_DRIVE_BAND':'OUTSIDE';eq(c.label,label);if(label!=='OUTSIDE')band++;if(label==='BOUNDARY_25')boundary++}
 if(d.bandCount!==band||d.boundary25Count!==boundary||d.fraction!==band/contacts.length)fail();if(!latest||d.source.time.season!==latest.season||d.source.time.day!==latest.day||d.source.time.sequence!==latest.sequence)fail();
}
/** Strict structural and internal-consistency checks, never a Native authority assertion. */
export function validateContactRosterV264(v:unknown):asserts v is NativeContactRosterExportV264 {
 const p=object(v,'version boundary batch subjectLinks');eq(p.version,'native-contact-roster-export-v264');eq(p.boundary,'LOCAL_READ_ONLY_NATIVE_ROSTER_EXPORT');
 const b=object(p.batch,'version boundary careerId requestedRosterSnapshotId status reasons roster rows populationBoundary producerCoverage asOfSemantics directionStatus physicsEffects');eq(b.version,'native-contact-distribution-batch-v263');eq(b.boundary,'READ_ONLY_NATIVE_ROSTER_CONTACT_BATCH');const career=str(b.careerId);str(b.requestedRosterSnapshotId);strings(b.reasons);
 eq(b.populationBoundary,'EXPLICIT_GLOBAL_ROSTER_SNAPSHOT_ONLY');eq(b.producerCoverage,'SUPPORTED_NATIVE_INVENTORY_ONLY');eq(b.asOfSemantics,'ROSTER_CHECKPOINT_AND_LATEST_REGISTERED_CONTACT_AT_SAME_DB_SNAPSHOT');eq(b.directionStatus,'UNASSESSED');eq(b.physicsEffects,'NONE');
 if(b.rows===null){if(b.status!=='UNKNOWN'||b.roster!==null||p.subjectLinks!==null||!b.reasons.length)fail();return}
 const rows=arr(b.rows),links=arr(p.subjectLinks),r=object(b.roster,'snapshotId revision effectiveDay playerCount');eq(r.snapshotId,b.requestedRosterSnapshotId);int(r.revision);int(r.effectiveDay);int(r.playerCount);if(rows.length!==links.length||rows.length!==r.playerCount)fail();
 if(!rows.length){if(b.status!=='UNKNOWN'||!b.reasons.length)fail();return}if(b.reasons.length)fail();const ids=new Set<string>(),people=new Set<string>(),linkSources=new Set<string>();let all=true;
 rows.forEach((value,index)=>{const row=object(value,'playerId status reasons distribution currentInventoryHash producerAvailability'),id=str(row.playerId);if(ids.has(id))fail();ids.add(id);if(!['UNKNOWN','OBSERVED'].includes(row.status))fail();strings(row.reasons);hash(row.currentInventoryHash);if(row.status==='UNKNOWN'){all=false;if(!row.reasons.length)fail()}else if(row.reasons.length)fail();
 const l=object(links[index],'playerId identity');eq(l.playerId,id);if(row.distribution===null){if(row.status!=='UNKNOWN'||l.identity!==null||row.currentInventoryHash!==null||row.producerAvailability!==null||row.reasons.length!==1||!['SUBJECT_LINK_MISSING','SUBJECT_LINK_AMBIGUOUS'].includes(row.reasons[0]))fail();return}
 const identity=object(l.identity,'careerId playerId personId sourceId');eq(identity.careerId,career);eq(identity.playerId,id);const person=str(identity.personId),linkSource=str(identity.sourceId);if(people.has(person)||linkSources.has(linkSource))fail();people.add(person);linkSources.add(linkSource);const availability=object(row.producerAvailability,'physical_pitch_progress_actions pa_physical_v1_resolutions pa_initial_joint_v1_executions');Object.values(availability).forEach(x=>{if(x!=='PRESENT'&&x!=='ABSENT')fail()});distribution(row.distribution,career,id,row.status,row.reasons);if(row.distribution.inventoryHash!==null)eq(row.currentInventoryHash,row.distribution.inventoryHash);
 });eq(b.status,all?'OBSERVED_FOR_SNAPSHOT_ROSTER':'PARTIAL');
}
export function serializeContactRosterV266(value:NativeContactRosterExportV264):string {const node=encodeContactNodeV266(value),decoded=decodeContactNodeV266(node);validateContactRosterV264(decoded);const json=JSON.stringify(['native-contact-roster-json-v266',node]);if(byteLength(json)+1>textLimit)fail();return json+'\n'}
export type ParsedContactRosterV266=Readonly<{version:'native-contact-roster-parsed-v266';provenance:'NOT_AUTHENTICATED_BY_JSON';payload:NativeContactRosterExportV264}>;
export function parseContactRosterV266(text:string):ParsedContactRosterV266 {if(typeof text!=='string'||text.length>textLimit||byteLength(text)>textLimit)fail();let root:unknown;try{root=JSON.parse(text)}catch{return fail()}if(!Array.isArray(root)||root.length!==2||root[0]!=='native-contact-roster-json-v266')return fail();const result=decodeContactNodeV266(root[1]);validateContactRosterV264(result);return {version:'native-contact-roster-parsed-v266',provenance:'NOT_AUTHENTICATED_BY_JSON',payload:result}}
