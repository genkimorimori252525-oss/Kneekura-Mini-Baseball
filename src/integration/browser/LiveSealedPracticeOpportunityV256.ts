import {encodeLiveSpinPracticeProofV239,hashLiveSpinPracticeProofV239} from './LiveSpinPracticeProofV239';

type SlotV256=Readonly<{slotId:string;configuration:unknown;before:unknown;revision:number;seed:number;policy:unknown;source:unknown;normalCommand:unknown;trialCommand:unknown;latePossible:boolean}>;
type PlanV256=Readonly<{version:'sealed_practice_plan_v256';initialBefore:unknown;initialRevision:number;slots:readonly SlotV256[]}>;
type ProofV256=Readonly<{planner:'PLANNED'|'NO_TARGET'|'UNRESOLVED';execution:'VERIFIED'|'NOT_APPLICABLE'|'RATE_CHANGED'|'START_CHANGED'|'RAMP_CHANGED'|'LATE_POSSIBLE'|'OTHER_UNPROVEN';reason:string}>;
type UnknownProofV258=Readonly<{version:'sealed_practice_unknown_proof_v258';planner:'UNKNOWN';execution:'NOT_APPLICABLE';reason:string}>;
type EvidenceV256=Readonly<{proof:ProofV256|UnknownProofV258;normalRecord:unknown|null;trialRecord:unknown|null;normalAfter:unknown|null;trialAfter:unknown|null}>;
type OutcomeV256=Readonly<{version:'sealed_practice_outcome_v256';slotId:string;opportunityId:string;status:'HOLD'|'READY'|'UNKNOWN'|'COMMITTED';reason:string;evidence:EvidenceV256|null}>;
type SlotStateV256=Readonly<{declaration:SlotV256;opportunityId:string;status:'PENDING'|'OBSERVING'|'HOLD'|'READY'|'UNKNOWN'|'COMMITTED';outcome:OutcomeV256|null}>;
type SnapshotV256=Readonly<{version:'sealed_practice_snapshot_v256';authority:'CALLER_DECLARED_NOT_AUTHENTICATED';initialBefore:unknown;initialRevision:number;before:unknown;revision:number;slots:readonly SlotStateV256[]}>;
const fields=(x:unknown,k:readonly string[])=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(y=>Object.hasOwn(x,y));
const text=(x:unknown):x is string=>typeof x==='string'&&x.length>0&&x.length<=200&&x.trim()===x;
const validRevision=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&!Object.is(x,-0);
const same=(a:unknown,b:unknown)=>encodeLiveSpinPracticeProofV239(a)===encodeLiveSpinPracticeProofV239(b);
const freeze=<T>(x:T):T=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
const copy=<T>(x:T):T=>{encodeLiveSpinPracticeProofV239(x);return freeze(structuredClone(x))};
const identity=(x:SlotV256)=>({configuration:x.configuration,before:x.before,revision:x.revision,seed:x.seed,policy:x.policy,source:x.source,normalCommand:x.normalCommand,trialCommand:x.trialCommand,latePossible:x.latePossible});
const physicalIdentity=(x:SlotV256)=>({configuration:x.configuration,before:x.before,revision:x.revision,seed:x.seed});
function assertSlot(x:SlotV256){if(!fields(x,['slotId','configuration','before','revision','seed','policy','source','normalCommand','trialCommand','latePossible'])||!text(x.slotId)||!validRevision(x.revision)||!Number.isSafeInteger(x.seed)||x.seed<0||x.seed>0xffffffff||Object.is(x.seed,-0)||typeof x.latePossible!=='boolean')throw Error('sealed practice v256: invalid slot');encodeLiveSpinPracticeProofV239(identity(x));}
function checkEvidence(raw:unknown):EvidenceV256{
 const x=copy(raw) as EvidenceV256,p=x?.proof;
 if(!fields(x,['proof','normalRecord','trialRecord','normalAfter','trialAfter']))throw Error('sealed practice v256: invalid evidence');
 if(p?.planner==='UNKNOWN'){if(!fields(p,['version','planner','execution','reason'])||p.version!=='sealed_practice_unknown_proof_v258'||p.execution!=='NOT_APPLICABLE'||!text(p.reason))throw Error('sealed practice v256: invalid unknown proof');return x}
 if(!fields(p,['planner','execution','reason'])||!['PLANNED','NO_TARGET','UNRESOLVED'].includes(p.planner)||!['VERIFIED','NOT_APPLICABLE','RATE_CHANGED','START_CHANGED','RAMP_CHANGED','LATE_POSSIBLE','OTHER_UNPROVEN'].includes(p.execution)||!text(p.reason))throw Error('sealed practice v256: invalid proof');
 if(p.planner==='PLANNED'&&p.execution==='NOT_APPLICABLE'||p.planner!=='PLANNED'&&p.execution!=='NOT_APPLICABLE')throw Error('sealed practice v256: inconsistent proof');return x;
}
/** Local trial scaffold. The injected executor and identities are caller-declared,
 * not a Native authority or proof of real execution. */
export async function createSealedPracticeOwnerV256(raw:PlanV256,execute:(slot:SlotV256)=>Promise<EvidenceV256>) {
 const plan=copy(raw);if(!fields(plan,['version','initialBefore','initialRevision','slots'])||plan.version!=='sealed_practice_plan_v256'||!validRevision(plan.initialRevision)||!Array.isArray(plan.slots)||plan.slots.length===0||typeof execute!=='function')throw Error('sealed practice v256: invalid plan');
 const ids=new Set<string>(),hashes=new Set<string>(),physicalHashes=new Set<string>(),states:SlotStateV256[]=[];for(const slot of plan.slots){assertSlot(slot);if(ids.has(slot.slotId))throw Error('sealed practice v256: duplicate slot');ids.add(slot.slotId);const opportunityId=await hashLiveSpinPracticeProofV239(identity(slot));const physicalHash=await hashLiveSpinPracticeProofV239(physicalIdentity(slot));if(hashes.has(opportunityId)||physicalHashes.has(physicalHash))throw Error('sealed practice v256: duplicate opportunity');hashes.add(opportunityId);physicalHashes.add(physicalHash);states.push({declaration:slot,opportunityId,status:'PENDING',outcome:null})}
 let current=plan.initialBefore,revision=plan.initialRevision;const inFlight=new Map<string,Promise<OutcomeV256>>(),tickets=new Map<string,{settle:(outcome:OutcomeV256)=>void}>(),authority=new WeakMap<object,{slotId:string;opportunityId:string}>();
 const locate=(slotId:string)=>{const i=states.findIndex(s=>s.declaration.slotId===slotId);if(i<0)throw Error('sealed practice v256: unknown slot');return i};
 const guard=(state:SlotStateV256,view:Readonly<{before:unknown;revision:number}>)=>{if(!fields(view,['before','revision'])||!validRevision(view.revision)||view.revision!==revision||state.declaration.revision!==revision||!same(view.before,current)||!same(state.declaration.before,current))throw Error('sealed practice v256: before or revision differs')};
 const seal=(index:number,status:'HOLD'|'READY'|'UNKNOWN',reason:string,evidence:EvidenceV256|null)=>{const old=states[index],outcome=copy({version:'sealed_practice_outcome_v256' as const,slotId:old.declaration.slotId,opportunityId:old.opportunityId,status,reason,evidence});states[index]=freeze({...old,status,outcome});authority.set(outcome,{slotId:old.declaration.slotId,opportunityId:old.opportunityId});return outcome};
 function preview(slotId:string,view:Readonly<{before:unknown;revision:number}>):Promise<OutcomeV256>{
  const i=locate(slotId),state=states[i];guard(state,view);if(state.outcome)return Promise.resolve(state.outcome);const pending=inFlight.get(slotId);if(pending)return pending;
  if(state.declaration.latePossible)return Promise.resolve(seal(i,'HOLD','UNRESOLVED_LATE_POSSIBLE',null));
  let settle!:(outcome:OutcomeV256)=>void;const promise=new Promise<OutcomeV256>(resolve=>{settle=resolve}),ticket={settle};
  tickets.set(slotId,ticket);inFlight.set(slotId,promise);states[i]=freeze({...state,status:'OBSERVING'});
  const finish=(outcome:OutcomeV256)=>{if(tickets.get(slotId)!==ticket)return;tickets.delete(slotId);inFlight.delete(slotId);settle(outcome)};
  const unknown=()=>{if(tickets.get(slotId)===ticket)finish(seal(i,'UNKNOWN','EXECUTION_OR_EVIDENCE_UNKNOWN',null))};
  try{Promise.resolve(execute(state.declaration)).then(rawResult=>{if(tickets.get(slotId)!==ticket)return;try{const e=checkEvidence(rawResult),p=e.proof;
   if(p.planner==='UNKNOWN'){finish(seal(i,'UNKNOWN',p.reason,e));return}
   if(p.planner==='UNRESOLVED'||p.planner==='PLANNED'&&p.execution!=='VERIFIED'){finish(seal(i,'HOLD',p.planner==='PLANNED'?p.execution:p.reason,e));return}
   if(e.normalRecord===null||e.trialRecord===null||e.normalAfter===null||p.planner==='PLANNED'&&e.trialAfter===null)throw Error('sealed practice v256: incomplete paired evidence');
   finish(seal(i,'READY',p.reason,e));
  }catch{unknown()}},unknown)}catch{unknown()}
  return promise;
 }
 function interrupt(slotId:string){const i=locate(slotId),s=states[i];if(s.outcome)return s.outcome;const ticket=tickets.get(slotId);tickets.delete(slotId);inFlight.delete(slotId);const outcome=seal(i,'UNKNOWN','INTERRUPTED_OR_RESULT_UNKNOWN',null);ticket?.settle(outcome);return outcome}

 function commit(candidate:OutcomeV256,view:Readonly<{before:unknown;revision:number}>){
  const token=authority.get(candidate);if(!token)throw Error('sealed practice v256: foreign candidate');const i=locate(token.slotId),s=states[i];guard(s,view);
  if(s.outcome!==candidate||s.status!=='READY'||!candidate.evidence)throw Error('sealed practice v256: candidate not committable');const p=candidate.evidence.proof,after=p.planner==='NO_TARGET'?candidate.evidence.normalAfter:candidate.evidence.trialAfter;if(after===null)throw Error('sealed practice v256: after missing');if(!validRevision(revision+1))throw Error('sealed practice v256: revision overflow');
  current=copy(after);revision++;const committed=copy({...candidate,status:'COMMITTED' as const});states[i]=freeze({...s,status:'COMMITTED',outcome:committed});authority.delete(candidate);return current;
 }
 function snapshot():SnapshotV256{return copy({version:'sealed_practice_snapshot_v256' as const,authority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,initialBefore:plan.initialBefore,initialRevision:plan.initialRevision,before:current,revision,slots:states})}
 function inspect(){return freeze({before:current,revision,planned:states.length,committed:states.filter(s=>s.status==='COMMITTED').length,unresolved:states.filter(s=>s.status==='HOLD'||s.status==='UNKNOWN').length,pending:states.filter(s=>s.status==='PENDING'||s.status==='OBSERVING'||s.status==='READY').length,authority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const})}
 return Object.freeze({preview,interrupt,commit,snapshot,inspect});
}
/** A saved JSON snapshot is an unauthenticated view only; it cannot issue or commit. */
export async function readSealedPracticeSnapshotV256(raw:unknown){
 const s=copy(raw) as SnapshotV256;if(!fields(s,['version','authority','initialBefore','initialRevision','before','revision','slots'])||s.version!=='sealed_practice_snapshot_v256'||s.authority!=='CALLER_DECLARED_NOT_AUTHENTICATED'||!validRevision(s.initialRevision)||!validRevision(s.revision)||s.revision<s.initialRevision||!Array.isArray(s.slots)||!s.slots.length)throw Error('sealed practice v256: invalid snapshot');
 const ids=new Set<string>(),hashes=new Set<string>(),physicalHashes=new Set<string>(),slots:SlotStateV256[]=[];for(const item of s.slots){if(!fields(item,['declaration','opportunityId','status','outcome']))throw Error('sealed practice v256: invalid saved slot');assertSlot(item.declaration);const id=await hashLiveSpinPracticeProofV239(identity(item.declaration));const physicalHash=await hashLiveSpinPracticeProofV239(physicalIdentity(item.declaration));if(id!==item.opportunityId||ids.has(item.declaration.slotId)||hashes.has(id)||physicalHashes.has(physicalHash))throw Error('sealed practice v256: saved identity differs');ids.add(item.declaration.slotId);hashes.add(id);physicalHashes.add(physicalHash);
  if(!['PENDING','OBSERVING','HOLD','READY','UNKNOWN','COMMITTED'].includes(item.status))throw Error('sealed practice v256: invalid saved status');
  if(item.status==='PENDING'||item.status==='OBSERVING'){if(item.outcome!==null)throw Error('sealed practice v256: invalid pending evidence');slots.push(item.status==='OBSERVING'?{...item,status:'UNKNOWN',outcome:{version:'sealed_practice_outcome_v256',slotId:item.declaration.slotId,opportunityId:id,status:'UNKNOWN',reason:'RESTORED_UNFINISHED',evidence:null}}:item);continue}
  const o=item.outcome;if(!fields(o,['version','slotId','opportunityId','status','reason','evidence'])||o!.version!=='sealed_practice_outcome_v256'||o!.slotId!==item.declaration.slotId||o!.opportunityId!==id||o!.status!==item.status||!text(o!.reason))throw Error('sealed practice v256: invalid saved outcome');if(o!.evidence!==null)checkEvidence(o!.evidence);slots.push(item);
 }
 return copy({version:'sealed_practice_snapshot_view_v256' as const,authority:'SELF_REPORTED_NOT_AUTHENTICATED' as const,initialBefore:s.initialBefore,initialRevision:s.initialRevision,before:s.before,revision:s.revision,slots,planned:slots.length,committed:slots.filter(x=>x.status==='COMMITTED').length,unresolved:slots.filter(x=>x.status==='HOLD'||x.status==='UNKNOWN').length,pending:slots.filter(x=>x.status==='PENDING'||x.status==='READY').length});
}
