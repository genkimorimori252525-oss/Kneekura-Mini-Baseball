import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { resolveLiveBattingSetupV94 } from '../../core/sim/pitching/BattingSetupV94';
import { hashLiveSpinPracticeProofV239,encodeLiveSpinPracticeProofV239 } from './LiveSpinPracticeProofV239';
import { validateLiveSpinMotorV239,validateLiveSpinPracticeCriterionV239,resolveLiveSpinMotorPracticeV239,evaluateLiveSpinMotorPracticeV239,type LiveSpinMotorV239,type LiveSpinPracticeCriterionV239,type LiveSpinPracticeCohortV239,type LiveSpinPracticeTrialV239 } from './LiveSpinMotorPracticeV239';
import {
  cloneMatchInputWithMeasuredCatalogV68, createLiveBaseballMatchWorkerV116,resolveLiveMatchPlayerPhysicalV98,isLiveBaseballUnresolvedV239,type LiveBaseballUnresolvedV239,
  type LiveIssuedPitchV1, type LiveMatchContinuationV116, type LiveMatchInputV1, type LivePitchCommandV1,
} from './LiveBaseballMatchV1';

/** Only the current offense is managed. Opponent pitch selection remains AUTO. */
export type LiveBattingPracticeRequestV150 = Readonly<Pick<LivePitchCommandV1, 'batting'> &
  Pick<LivePitchCommandV1, 'swingInstructionV121'|'battingDirectionRequestV149'|'observedSpinTrialV236'|'spinMotorPracticePolicyV239'|'managerCommunicationV122'|'batterEvidenceV122'|'baserunning'|'randomnessV152'>>;
export type LiveBattingPracticeCandidateV150 = Readonly<{
  version:'live_batting_practice_candidate_v150';revision:number;acceptedPitchCount:number;
  record:LiveIssuedPitchV1;beforeContinuation:LiveMatchContinuationV116;afterContinuation:LiveMatchContinuationV116;
}>;
/** Local debug data, not Native authentication. Observer history is saved separately. */
export type LiveBattingPracticeCaptureV150 = Readonly<{
  version:'live_batting_practice_capture_v150';configuration:LiveMatchInputV1;continuation:LiveMatchContinuationV116;revision:number;
  spinMotorPracticeV239?:LiveSpinPracticeSidecarV239;
}>;
export type LiveSpinPracticePlanV239=Readonly<{version:'live_spin_practice_plan_v239';scopeId:string;pitchOrdinals:readonly number[];motor:LiveSpinMotorV239;criterion:LiveSpinPracticeCriterionV239|null;normalRequest:LiveBattingPracticeRequestV150}>;
type SpinEntryV239=Readonly<{kind:'COMPLETE'|'HOLD';before:LiveMatchContinuationV116;normalRequest:LiveBattingPracticeRequestV150;trialRequest:LiveBattingPracticeRequestV150;normalCommand:LivePitchCommandV1;trialCommand:LivePitchCommandV1;
 normalRecord:LiveIssuedPitchV1|null;trialRecord:LiveIssuedPitchV1|null;normalAfter:LiveMatchContinuationV116|null;trialAfter:LiveMatchContinuationV116|null;
 hold:Readonly<{attempt:'NORMAL'|'TRIAL';unresolved:LiveBaseballUnresolvedV239}>|null;trial:LiveSpinPracticeTrialV239;hashes:Readonly<{before:string;normalRequest:string;trialRequest:string;normalCommand:string;trialCommand:string;normalRecord:string;trialRecord:string;normalAfter:string;trialAfter:string;hold:string}>}>;
type SpinSlotV239=Readonly<{status:'PENDING'|'BOUND';pitchOrdinal:number;subjectId:string;motorId:string;motorVersion:string;domain:LiveSpinMotorV239['domain'];opportunity:LiveSpinPracticeTrialV239['opportunity']|null}>;
type PendingSpinEvaluationV239=Readonly<{status:'HOLD';reason:'COHORT_PENDING';earnedQualification:false;humanCalibration:'NOT_MEASURED'}>;
type SpinNormalTailV239=Readonly<{request:LiveBattingPracticeRequestV150;before:LiveMatchContinuationV116;record:LiveIssuedPitchV1;after:LiveMatchContinuationV116}>;
export type LiveSpinPracticeSidecarV239=Readonly<{version:'live_spin_practice_sidecar_v239';hashEncoding:'live-spin-proof-ieee754-v239';configurationHash:string;anchor:LiveMatchContinuationV116;
 phase:'ACTIVE'|'CLOSED'|'INTERRUPTED';closeBoundary:Readonly<{continuation:LiveMatchContinuationV116;physicsRevision:number;sidecarRevision:number}>|null;normalTail:readonly SpinNormalTailV239[];normalTailHashAuthority:'NOT_HASHED';
 plan:LiveSpinPracticePlanV239;slots:readonly SpinSlotV239[];cohort:LiveSpinPracticeCohortV239|null;sidecarRevision:number;entries:readonly SpinEntryV239[];evaluation:ReturnType<typeof evaluateLiveSpinMotorPracticeV239>|PendingSpinEvaluationV239}>;
export type LiveSpinPracticeCandidateV239=Readonly<{version:'live_spin_practice_candidate_v239';physicsRevision:number;sidecarRevision:number;entry:SpinEntryV239}>;
type SpinCandidateOwnerV239=Readonly<{session:object;physicsRevision:number;sidecarRevision:number;entry:SpinEntryV239;inspection:HostInspection|null}>;
const spinCandidatesV239=new WeakMap<LiveSpinPracticeCandidateV239,SpinCandidateOwnerV239>();
type HostInspection = ReturnType<ReturnType<typeof createLiveBaseballMatchWorkerV116>['inspect']>;
type CandidateOwner = Readonly<{
  session:object;revision:number;record:LiveIssuedPitchV1;continuation:LiveMatchContinuationV116;inspection:HostInspection;request:LiveBattingPracticeRequestV150;before:LiveMatchContinuationV116;sidecar:LiveSpinPracticeSidecarV239|undefined;
}>;
const candidates = new WeakMap<LiveBattingPracticeCandidateV150, CandidateOwner>();
const frozen = <T>(value:T):T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(frozen);Object.freeze(value);
  }
  return value;
};
function assert(condition:unknown, message:string):asserts condition {
  if (!condition) throw new Error('live batting practice v150: ' + message);
}
/** Both trees have already crossed the inert boundary; compare every field,
 * including the full measured catalog, without depending on property order. */
function sameConfiguration(one:unknown, two:unknown):boolean {
  if (Object.is(one, two)) return true;
  if (!one || !two || typeof one !== 'object' || typeof two !== 'object' || Array.isArray(one) !== Array.isArray(two)) return false;
  const left = Object.keys(one), right = Object.keys(two);
  return left.length === right.length && left.every(key => Object.hasOwn(two, key) &&
    sameConfiguration((one as Record<string, unknown>)[key], (two as Record<string, unknown>)[key]));
}
function readCapture(raw:unknown):LiveBattingPracticeCaptureV150 {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(raw)), 'inert capture required');
  const configuration = Object.getOwnPropertyDescriptor(raw, 'configuration'), rest = {};
  assert(configuration?.enumerable && 'value' in configuration, 'inert capture configuration required');
  for (const key of Reflect.ownKeys(raw)) if (key !== 'configuration') Object.defineProperty(rest, key, Object.getOwnPropertyDescriptor(raw, key)!);
  const header = cloneInert(rest) as Omit<LiveBattingPracticeCaptureV150, 'configuration'>;
  assert(Object.keys(header).sort().join('|') === 'continuation|revision|version' &&
    header.version === 'live_batting_practice_capture_v150' && Number.isSafeInteger(header.revision) && header.revision >= 0,
  'invalid capture');
  return { ...header, configuration:cloneMatchInputWithMeasuredCatalogV68(configuration.value) };
}
const requestFields = ['batting', 'swingInstructionV121', 'battingDirectionRequestV149', 'observedSpinTrialV236', 'spinMotorPracticePolicyV239', 'managerCommunicationV122', 'batterEvidenceV122', 'baserunning', 'randomnessV152'];
function commandFor(raw:LiveBattingPracticeRequestV150, offense:0|1):LivePitchCommandV1 {
  const request = cloneInert(raw);
  assert(request && typeof request === 'object' && !Array.isArray(request) &&
    Object.keys(request).every(key => requestFields.includes(key)), 'offense-only request required');
  return { ...request, managedTeam:offense, pitchType:'auto', location:'auto' };
}

/** A speculative worker owns each preview. Only accepting its authentic,
 * current-revision candidate installs the Host-captured continuation.
 * acceptedRecords/history cover this instance only; capture does not restore them. */
export function createLiveBattingPracticeV150(rawInput:LiveMatchInputV1, rawResume?:unknown) {
  const configuration = frozen(cloneMatchInputWithMeasuredCatalogV68(rawInput)), session = {},
    resume = rawResume === undefined ? undefined : readCapture(rawResume);
  assert(resume === undefined || sameConfiguration(configuration, resume.configuration), 'resume configuration differs');
  const initialHost = createLiveBaseballMatchWorkerV116(configuration, resume?.continuation);
  let continuation = initialHost.captureContinuationV116(), inspection = initialHost.inspect(), revision = resume?.revision ?? 0,
    acceptedRecords:readonly LiveIssuedPitchV1[] = Object.freeze([]),spin:LiveSpinPracticeSidecarV239|undefined;
  let configurationHashV239:Promise<string>|undefined;
  assert(revision === continuation.pitchCount, 'capture revision differs from accepted pitch count');

  function preview(raw:LiveBattingPracticeRequestV150):LiveBattingPracticeCandidateV150 {
    assert(!spin||spin.phase!=='ACTIVE','spin practice requires paired preview');
    const request=spin?cloneInert(raw):raw,command = commandFor(request, continuation.match.half === 'top' ? 0 : 1),
      worker = createLiveBaseballMatchWorkerV116(configuration, continuation), record = worker.issuePitch(command),
      afterContinuation = worker.captureContinuationV116(), afterInspection = worker.inspect(),
      candidate:LiveBattingPracticeCandidateV150 = Object.freeze({ version:'live_batting_practice_candidate_v150', revision,
        acceptedPitchCount:continuation.pitchCount, record, beforeContinuation:continuation, afterContinuation });
    candidates.set(candidate, { session, revision, record, continuation:afterContinuation, inspection:afterInspection,request,before:continuation,sidecar:spin });
    return candidate;
  }
  function accept(candidate:LiveBattingPracticeCandidateV150):LiveIssuedPitchV1 {
    assert(!spin||spin.phase!=='ACTIVE','spin practice requires paired accept');
    const owned = candidates.get(candidate);
    assert(owned?.session === session && owned.revision === revision&&owned.sidecar===spin, 'candidate is foreign, stale or already accepted');
    const nextRecords = Object.freeze([...acceptedRecords, owned.record]);
    const nextSpin=spin?frozen({...spin,sidecarRevision:spin.sidecarRevision+1,normalTail:[...spin.normalTail,{request:owned.request,before:owned.before,record:owned.record,after:owned.continuation}]}):undefined;
    // All throwing simulation/validation work completed in preview. Publish together.
    continuation = owned.continuation;inspection = owned.inspection;acceptedRecords = nextRecords;revision++;spin=nextSpin;
    return owned.record;
  }
  function capture():LiveBattingPracticeCaptureV150 {
    return Object.freeze({ version:'live_batting_practice_capture_v150', configuration, continuation, revision,...(spin?{spinMotorPracticeV239:spin}:{}) });
  }
  function inspect() {
    return Object.freeze({ ...inspection, practiceVersion:'live_batting_practice_v150' as const, configuration, continuation,
      revision, acceptedRecords, history:acceptedRecords });
  }
  async function startSpinMotorPractice(raw:LiveSpinPracticePlanV239):Promise<void>{
    assert(!spin,'spin practice already started');const beforeRevision=revision,before=continuation,plan=cloneInert(raw);
    assert(plan&&Object.keys(plan).sort().join('|')==='criterion|motor|normalRequest|pitchOrdinals|scopeId|version'&&plan.version==='live_spin_practice_plan_v239'
      &&typeof plan.scopeId==='string'&&plan.scopeId.trim()===plan.scopeId&&plan.scopeId.length>0&&Array.isArray(plan.pitchOrdinals)&&plan.pitchOrdinals.length>0
      &&plan.pitchOrdinals.every((n,i)=>Number.isSafeInteger(n)&&n===revision+i+1),'invalid spin practice plan');
    const motor=validateLiveSpinMotorV239(plan.motor);assert(motor.subjectId===inspection.batterPlayerId,'spin practice subject differs');
    const player=configuration.players.find(p=>p.playerId===motor.subjectId);assert(player,'spin practice original player missing');
    const physical=resolveLiveMatchPlayerPhysicalV98(player),clip=configuration.measuredClips.find(c=>c.id===motor.clip.id&&c.side===motor.clip.bats&&c.source.sha256===motor.clip.sourceSha256);
    assert(player.bats===motor.clip.bats&&physical.clipId===motor.clip.id&&clip,'spin practice fixed clip differs');
    assert(Object.is(resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats}).contactPlaneZ,motor.domain.plateZ),'spin practice fixed domain differs');
    assert(!Object.hasOwn(plan.normalRequest,'observedSpinTrialV236')&&!Object.hasOwn(plan.normalRequest,'spinMotorPracticePolicyV239'),'spin practice normal request cannot contain trial or policy');commandFor(plan.normalRequest,continuation.match.half==='top'?0:1);
    const selected=resolveLiveSpinMotorPracticeV239({mode:'PRACTICE_EXPLICIT',subjectId:motor.subjectId,technique:motor.technique,clip:motor.clip,domain:motor.domain,motors:[motor]});
    assert(selected.status==='READY_PRACTICE','spin practice motor unavailable');
    if(plan.criterion!==null)validateLiveSpinPracticeCriterionV239(plan.criterion);
    configurationHashV239??=hashLiveSpinPracticeProofV239(configuration);const configurationHash=await configurationHashV239;
    assert(!spin&&revision===beforeRevision&&sameConfiguration(continuation,before),'spin practice state changed while starting');
    const slots=plan.pitchOrdinals.map(pitchOrdinal=>({status:'PENDING' as const,pitchOrdinal,subjectId:motor.subjectId,motorId:motor.motorId,motorVersion:motor.motorVersion,domain:motor.domain,opportunity:null}));
    spin=frozen({version:'live_spin_practice_sidecar_v239',hashEncoding:'live-spin-proof-ieee754-v239',configurationHash,anchor:before,phase:'ACTIVE',closeBoundary:null,normalTail:[],normalTailHashAuthority:'NOT_HASHED',plan:{...plan,motor},slots,cohort:null,sidecarRevision:0,entries:[],
      evaluation:{status:'HOLD',reason:'COHORT_PENDING',earnedQualification:false,humanCalibration:'NOT_MEASURED'}});
  }
  async function previewSpinMotorPractice():Promise<LiveSpinPracticeCandidateV239>{
    const state=spin;assert(state?.phase==='ACTIVE','spin practice is not active');const slot=state.slots.find(v=>v.pitchOrdinal===revision+1);
    assert(slot&&!state.entries.some(e=>e.kind==='COMPLETE'&&e.trial.opportunity.pitchOrdinal===slot.pitchOrdinal),'spin practice has no pending opportunity');
    const before=continuation,physicsRevision=revision,sidecarRevision=state.sidecarRevision,motor=state.plan.motor;
    assert(inspection.batterPlayerId===motor.subjectId,'spin practice opportunity changed');
    const selection=resolveLiveSpinMotorPracticeV239({mode:'PRACTICE_EXPLICIT',subjectId:motor.subjectId,technique:motor.technique,clip:motor.clip,domain:motor.domain,motors:[motor]});assert(selection.status==='READY_PRACTICE','spin practice motor unavailable');
    const policy={version:'live_spin_motor_practice_policy_v239' as const,subjectId:motor.subjectId,motorId:motor.motorId,motorVersion:motor.motorVersion,clip:motor.clip},
      normalRequest={...state.plan.normalRequest,spinMotorPracticePolicyV239:policy},trialRequest={...normalRequest,observedSpinTrialV236:selection.request},offense=before.match.half==='top'?0:1,
      normalCommand=commandFor(normalRequest,offense),trialCommand=commandFor(trialRequest,offense),
      pitchFingerprint=await hashLiveSpinPracticeProofV239({version:'live-spin-opportunity-v239',configurationHash:state.configurationHash,before,normalCommand}),
      opportunity={configurationBinding:state.configurationHash,pitchOrdinal:slot.pitchOrdinal,pitchFingerprint};
    assert(!slot.opportunity||sameConfiguration(slot.opportunity,opportunity),'spin practice opportunity fingerprint differs');
    assert(spin===state&&revision===physicsRevision&&spin.sidecarRevision===sidecarRevision&&sameConfiguration(continuation,before),'spin practice state changed during preview');
    let normalRecord:LiveIssuedPitchV1|null=null,trialRecord:LiveIssuedPitchV1|null=null,normalAfter:LiveMatchContinuationV116|null=null,trialAfter:LiveMatchContinuationV116|null=null,hold:SpinEntryV239['hold']=null,trialInspection:HostInspection|null=null;
    try{const normal=createLiveBaseballMatchWorkerV116(configuration,before);normalRecord=normal.issuePitch(normalCommand);normalAfter=normal.captureContinuationV116()}
    catch(error){if(!isLiveBaseballUnresolvedV239(error))throw error;hold={attempt:'NORMAL',unresolved:error.unresolvedV239}}
    if(!hold)try{const trialHost=createLiveBaseballMatchWorkerV116(configuration,before);trialRecord=trialHost.issuePitch(trialCommand);trialAfter=trialHost.captureContinuationV116();trialInspection=trialHost.inspect()}
    catch(error){if(!isLiveBaseballUnresolvedV239(error))throw error;hold={attempt:'TRIAL',unresolved:error.unresolvedV239}}
    let outcome:LiveSpinPracticeTrialV239['outcome']='UNRESOLVED';
    if(!hold){assert(normalRecord&&trialRecord&&normalAfter&&trialAfter&&trialInspection,'spin practice pair missing');
      const nd=normalRecord.play.diagnostics as {sourceDescriptor:unknown},td=trialRecord.play.diagnostics as {sourceDescriptor:unknown;observedSpinComposeV238?:{version:string;status:string;subjectId:string;technique:string;clip:unknown;requestedDelta:unknown}},diagnostic=td.observedSpinComposeV238;
      assert(diagnostic&&diagnostic.version==='live_observed_spin_compose_result_v238'&&['NO_TARGET','PLANNED'].includes(diagnostic.status)
        &&diagnostic.subjectId===motor.subjectId&&diagnostic.technique===motor.technique&&sameConfiguration(diagnostic.clip,motor.clip)&&sameConfiguration(diagnostic.requestedDelta,motor.delta),'spin practice diagnostic differs');
      assert(sameConfiguration(normalRecord.command.spinMotorPracticePolicyV239,policy)&&sameConfiguration(trialRecord.command.spinMotorPracticePolicyV239,policy),'spin practice policies differ');
      assert(normalRecord.batterPlayerId===trialRecord.batterPlayerId&&normalRecord.pitcherPlayerId===trialRecord.pitcherPlayerId&&sameConfiguration(normalRecord.beforeMatch,trialRecord.beforeMatch)
        &&sameConfiguration(nd.sourceDescriptor,td.sourceDescriptor),'spin practice paired pitch differs');
      outcome=diagnostic.status==='NO_TARGET'?'NO_TARGET':trialRecord.play.contact===null?'MISS':'CONTACT';
    }
    const spinValue=(record:LiveIssuedPitchV1|null)=>{if(!record||record.play.contact===null)return null;const c=record.play.contact as {exitVelocity:{x:number;y:number;z:number};exitSpin:{x:number;y:number;z:number}};return {velocityMps:c.exitVelocity,spinRadPerSecond:c.exitSpin,bats:motor.clip.bats}};
    const direction=(record:LiveIssuedPitchV1|null)=>{const v=spinValue(record)?.velocityMps;return v&&Math.hypot(v.x,v.z)>0?Math.atan2(v.x,v.z)*180/Math.PI:null},
      requested=(trialRecord?.play.diagnostics as {battingDirectionV149?:{direction?:{fieldAngleDegrees?:number|null}}}|undefined)?.battingDirectionV149?.direction?.fieldAngleDegrees??null;
    const trial:LiveSpinPracticeTrialV239={opportunity,motorId:motor.motorId,motorVersion:motor.motorVersion,motorSnapshot:motor,outcome,normal:spinValue(normalRecord),actual:outcome==='CONTACT'?spinValue(trialRecord):null,
      direction:{requestedDegrees:requested,normalDegrees:direction(normalRecord),actualDegrees:direction(trialRecord)}};
    const keys={before,normalRequest,trialRequest,normalCommand,trialCommand,normalRecord,trialRecord,normalAfter,trialAfter,hold},names=Object.keys(keys) as (keyof typeof keys)[],values=await Promise.all(names.map(k=>hashLiveSpinPracticeProofV239(keys[k]))),hashes=Object.fromEntries(names.map((k,i)=>[k,values[i]])) as SpinEntryV239['hashes'];
    assert(spin===state&&revision===physicsRevision&&spin.sidecarRevision===sidecarRevision&&sameConfiguration(continuation,before),'spin practice state changed during preview');
    const entry=frozen({kind:hold?'HOLD' as const:'COMPLETE' as const,...keys,trial,hashes}),candidate=frozen({version:'live_spin_practice_candidate_v239' as const,physicsRevision,sidecarRevision,entry});
    spinCandidatesV239.set(candidate,{session,physicsRevision,sidecarRevision,entry,inspection:trialInspection});return candidate;
  }
  async function acceptSpinMotorPractice(candidate:LiveSpinPracticeCandidateV239):Promise<LiveIssuedPitchV1|null>{
    const owned=spinCandidatesV239.get(candidate),state=spin;assert(owned&&state?.phase==='ACTIVE'&&owned.session===session&&owned.physicsRevision===revision&&owned.sidecarRevision===state.sidecarRevision,'spin practice candidate is foreign or stale');
    const proof=await hashLiveSpinPracticeProofV239(owned.entry);assert(spin===state&&revision===owned.physicsRevision&&spin.sidecarRevision===owned.sidecarRevision&&sameConfiguration(continuation,owned.entry.before),'spin practice candidate became stale');
    assert(proof===await hashLiveSpinPracticeProofV239(candidate.entry),'spin practice candidate changed');assert(spin===state&&revision===owned.physicsRevision&&spin.sidecarRevision===owned.sidecarRevision,'spin practice candidate became stale');
    const entries=[...state.entries,owned.entry],slots=state.slots.map(slot=>slot.pitchOrdinal===owned.entry.trial.opportunity.pitchOrdinal?{...slot,status:'BOUND' as const,opportunity:owned.entry.trial.opportunity}:slot),
      completeSlots=slots.every(slot=>slot.opportunity!==null),cohort:LiveSpinPracticeCohortV239|null=completeSlots?{version:'live_spin_practice_cohort_v239',scopeId:state.plan.scopeId,motorId:state.plan.motor.motorId,motorVersion:state.plan.motor.motorVersion,motorSnapshot:state.plan.motor,opportunities:slots.map(slot=>slot.opportunity!)}:null,
      latest=slots.flatMap(slot=>{const found=[...entries].reverse().find(e=>e.trial.opportunity.pitchOrdinal===slot.pitchOrdinal);return found?[found.trial]:[]}),
      evaluation=cohort?evaluateLiveSpinMotorPracticeV239({motor:state.plan.motor,cohort,criterion:state.plan.criterion,trials:latest}):{status:'HOLD' as const,reason:'COHORT_PENDING' as const,earnedQualification:false as const,humanCalibration:'NOT_MEASURED' as const},
      next=frozen({...state,sidecarRevision:state.sidecarRevision+1,slots,cohort,entries,evaluation});
    if(owned.entry.kind==='HOLD'){spin=next;return null}
    assert(owned.entry.trialAfter&&owned.entry.trialRecord&&owned.inspection,'spin practice completed pair missing');const nextRecords=Object.freeze([...acceptedRecords,owned.entry.trialRecord]);
    continuation=owned.entry.trialAfter;inspection=owned.inspection;acceptedRecords=nextRecords;revision++;spin=next;return owned.entry.trialRecord;
  }
  function closeSpinMotorPractice():LiveSpinPracticeSidecarV239 {
    const state=spin;assert(state?.phase==='ACTIVE','spin practice is already closed or not active');
    const completed=state.slots.every(slot=>state.entries.some(entry=>entry.kind==='COMPLETE'&&entry.trial.opportunity.pitchOrdinal===slot.pitchOrdinal));
    const next=frozen({...state,phase:completed?'CLOSED' as const:'INTERRUPTED' as const,sidecarRevision:state.sidecarRevision+1,closeBoundary:{continuation,physicsRevision:revision,sidecarRevision:state.sidecarRevision+1}});spin=next;return next;
  }
  const issuePitch = (request:LiveBattingPracticeRequestV150) => accept(preview(request));
  return Object.freeze({ preview, accept, issuePitch, inspect, capture, startSpinMotorPractice, previewSpinMotorPractice, acceptSpinMotorPractice, closeSpinMotorPractice });
}

/** Replays all retained pairs before publishing a resumed owner. */
export async function resumeLiveBattingPracticeSpinV239(configuration:LiveMatchInputV1,raw:unknown) {
 assert(raw&&typeof raw==='object'&&!Array.isArray(raw)&&[Object.prototype,null].includes(Object.getPrototypeOf(raw)),'spin practice saved capture invalid');
 const descriptors=Object.getOwnPropertyDescriptors(raw),keys=Reflect.ownKeys(raw);assert(keys.every(k=>typeof k==='string')&&keys.map(String).sort().join('|')==='configuration|continuation|revision|spinMotorPracticeV239|version','spin practice saved capture fields differ');
 const get=(name:string)=>{const d=descriptors[name];assert(d?.enumerable&&'value' in d,'spin practice saved capture descriptor differs');return d.value};
 const version=get('version'),savedConfiguration=cloneMatchInputWithMeasuredCatalogV68(get('configuration')),savedContinuation=cloneInert(get('continuation')) as LiveMatchContinuationV116,savedRevision=get('revision'),rawSide=get('spinMotorPracticeV239');
 assert(version==='live_batting_practice_capture_v150'&&Number.isSafeInteger(savedRevision)&&savedRevision>=0,'spin practice saved capture header differs');
 encodeLiveSpinPracticeProofV239(rawSide);const snapshot=structuredClone(rawSide) as LiveSpinPracticeSidecarV239;assert(snapshot.version==='live_spin_practice_sidecar_v239'&&snapshot.hashEncoding==='live-spin-proof-ieee754-v239'&&Array.isArray(snapshot.entries)&&Array.isArray(snapshot.normalTail)&&['ACTIVE','CLOSED','INTERRUPTED'].includes(snapshot.phase),'invalid spin practice sidecar');
 const saved={version,configuration:savedConfiguration,continuation:savedContinuation,revision:savedRevision,spinMotorPracticeV239:snapshot};
 assert(sameConfiguration(configuration,savedConfiguration),'spin practice saved configuration differs');
 const anchor={version:'live_batting_practice_capture_v150' as const,configuration,continuation:snapshot.anchor,revision:snapshot.anchor.pitchCount},owner=createLiveBattingPracticeV150(configuration,anchor);
 await owner.startSpinMotorPractice(snapshot.plan);const initial=owner.capture().spinMotorPracticeV239;assert(initial&&initial.configurationHash===snapshot.configurationHash,'spin practice original plan differs');
 for(const entry of snapshot.entries){const candidate=await owner.previewSpinMotorPractice();assert(sameConfiguration(candidate.entry,entry),'spin practice replay differs');await owner.acceptSpinMotorPractice(candidate)}
 if(snapshot.phase!=='ACTIVE'){const closed=owner.closeSpinMotorPractice();assert(closed.phase===snapshot.phase&&sameConfiguration(closed.closeBoundary,snapshot.closeBoundary),'spin practice close boundary differs');
  for(const tail of snapshot.normalTail){const candidate=owner.preview(tail.request);assert(sameConfiguration(candidate.beforeContinuation,tail.before)&&sameConfiguration(candidate.record,tail.record)&&sameConfiguration(candidate.afterContinuation,tail.after),'spin practice normal tail differs');owner.accept(candidate)}}
 const final=owner.capture();assert(sameConfiguration(final,saved),'spin practice capture differs');return owner;
}
