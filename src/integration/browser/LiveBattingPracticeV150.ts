import {parsePracticeSwingDecisionV241} from './PracticeSwingDecisionV241';
import {declareSpinPracticeEpisodesV242,deriveSpinEpisodeConfigurationV242,type LiveSpinEpisodePlanV242} from './LiveSpinPracticeEpisodesV242';
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
  Pick<LivePitchCommandV1, 'swingInstructionV121'|'battingDirectionRequestV149'|'observedSpinTrialV236'|'spinMotorPracticePolicyV239'|'practiceSwingDecisionV241'|'managerCommunicationV122'|'batterEvidenceV122'|'baserunning'|'randomnessV152'>>;
export type LiveBattingPracticeCandidateV150 = Readonly<{
  version:'live_batting_practice_candidate_v150';revision:number;acceptedPitchCount:number;
  record:LiveIssuedPitchV1;beforeContinuation:LiveMatchContinuationV116;afterContinuation:LiveMatchContinuationV116;
}>;
/** Local debug data, not Native authentication. Observer history is saved separately. */
export type LiveBattingPracticeCaptureV150 = Readonly<{
  version:'live_batting_practice_capture_v150';configuration:LiveMatchInputV1;continuation:LiveMatchContinuationV116;revision:number;
  spinMotorPracticeV239?:LiveSpinPracticeSidecarV239;
  spinPracticeEpisodesV242?:LiveSpinEpisodesSidecarV242;
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
type EpisodeStepV242=Readonly<{kind:'PREFIX'|'TARGET'|'PA_TAIL'|'HOLD';before:LiveMatchContinuationV116;after:LiveMatchContinuationV116|null;normalAfter:LiveMatchContinuationV116|null;normalRecord:LiveIssuedPitchV1|null;trialRecord:LiveIssuedPitchV1|null;hold:Readonly<{attempt:'NORMAL'|'TRIAL';unresolved:LiveBaseballUnresolvedV239}>|null;physicalFingerprint:string|null;identity:string|null}>;
type EpisodeSlotV242=Readonly<{index:number;seed:number;episodeId:string;initial:LiveMatchContinuationV116|null;transition:Readonly<{fromIndex:number;fromContinuation:LiveMatchContinuationV116;toInitial:LiveMatchContinuationV116}>|null;steps:readonly EpisodeStepV242[];ended:boolean}>;
export type LiveSpinEpisodesSidecarV242=Readonly<{version:'live_spin_practice_episodes_sidecar_v242';baseConfigurationHash:string;planHash:string;plan:LiveSpinEpisodePlanV242;normalRequest:LiveBattingPracticeRequestV150;phase:'ACTIVE'|'ENDED'|'CLOSED'|'INTERRUPTED';globalRevision:number;globalAcceptedPitchCount:number;activeIndex:number;slots:readonly EpisodeSlotV242[];normalTail:readonly SpinNormalTailV239[];evaluation:ReturnType<typeof evaluateLiveSpinMotorPracticeV239>|PendingSpinEvaluationV239;earnedQualification:false;nativeQualification:false}>;
export type LiveSpinEpisodeCandidateV242=Readonly<{version:'live_spin_episode_candidate_v242';globalRevision:number;step:EpisodeStepV242}>;
const episodeCandidatesV242=new WeakMap<LiveSpinEpisodeCandidateV242,Readonly<{session:object;sidecar:LiveSpinEpisodesSidecarV242;inspection:HostInspection|null}>>();
type SpinCandidateOwnerV239=Readonly<{session:object;physicsRevision:number;sidecarRevision:number;entry:SpinEntryV239;inspection:HostInspection|null}>;
const spinCandidatesV239=new WeakMap<LiveSpinPracticeCandidateV239,SpinCandidateOwnerV239>();
type HostInspection = ReturnType<ReturnType<typeof createLiveBaseballMatchWorkerV116>['inspect']>;
type CandidateOwner = Readonly<{
  session:object;revision:number;record:LiveIssuedPitchV1;continuation:LiveMatchContinuationV116;inspection:HostInspection;request:LiveBattingPracticeRequestV150;before:LiveMatchContinuationV116;sidecar:LiveSpinPracticeSidecarV239|undefined;episodes:LiveSpinEpisodesSidecarV242|undefined;
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
const requestFields = ['batting', 'swingInstructionV121', 'battingDirectionRequestV149', 'observedSpinTrialV236', 'spinMotorPracticePolicyV239', 'practiceSwingDecisionV241', 'managerCommunicationV122', 'batterEvidenceV122', 'baserunning', 'randomnessV152'];
function commandFor(raw:LiveBattingPracticeRequestV150, offense:0|1):LivePitchCommandV1 {
  const request = cloneInert(raw);
  assert(request && typeof request === 'object' && !Array.isArray(request) &&
    Object.keys(request).every(key => requestFields.includes(key)), 'offense-only request required');
  if(request.practiceSwingDecisionV241!==undefined){const decision=parsePracticeSwingDecisionV241(request.practiceSwingDecisionV241);
    assert(request.managerCommunicationV122===undefined&&!(decision.mode==='SWING'&&request.batting==='take'),'conflicting swing decision');}
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
    acceptedRecords:readonly LiveIssuedPitchV1[] = Object.freeze([]),spin:LiveSpinPracticeSidecarV239|undefined,episodes:LiveSpinEpisodesSidecarV242|undefined,activeConfiguration=configuration;
  let configurationHashV239:Promise<string>|undefined;
  assert(revision === continuation.pitchCount, 'capture revision differs from accepted pitch count');

  function preview(raw:LiveBattingPracticeRequestV150):LiveBattingPracticeCandidateV150 {
    assert(!spin||spin.phase!=='ACTIVE','spin practice requires paired preview');assert(!episodes||episodes.phase==='CLOSED'||episodes.phase==='INTERRUPTED','episode practice requires episode preview');
    const request=spin||episodes?cloneInert(raw):raw,command = commandFor(request, continuation.match.half === 'top' ? 0 : 1),
      worker = createLiveBaseballMatchWorkerV116(activeConfiguration, continuation), record = worker.issuePitch(command),
      afterContinuation = worker.captureContinuationV116(), afterInspection = worker.inspect(),
      candidate:LiveBattingPracticeCandidateV150 = Object.freeze({ version:'live_batting_practice_candidate_v150', revision,
        acceptedPitchCount:continuation.pitchCount, record, beforeContinuation:continuation, afterContinuation });
    candidates.set(candidate, { session, revision, record, continuation:afterContinuation, inspection:afterInspection,request,before:continuation,sidecar:spin,episodes });
    return candidate;
  }
  function accept(candidate:LiveBattingPracticeCandidateV150):LiveIssuedPitchV1 {
    assert(!spin||spin.phase!=='ACTIVE','spin practice requires paired accept');assert(!episodes||episodes.phase==='CLOSED'||episodes.phase==='INTERRUPTED','episode practice requires episode accept');
    const owned = candidates.get(candidate);
    assert(owned?.session === session && owned.revision === revision&&owned.sidecar===spin&&owned.episodes===episodes, 'candidate is foreign, stale or already accepted');
    const nextRecords = Object.freeze([...acceptedRecords, owned.record]);
    const nextSpin=spin?frozen({...spin,sidecarRevision:spin.sidecarRevision+1,normalTail:[...spin.normalTail,{request:owned.request,before:owned.before,record:owned.record,after:owned.continuation}]}):undefined;
    const nextEpisodes=episodes?frozen({...episodes,globalRevision:episodes.globalRevision+1,globalAcceptedPitchCount:episodes.globalAcceptedPitchCount+1,normalTail:[...episodes.normalTail,{request:owned.request,before:owned.before,record:owned.record,after:owned.continuation}]}):undefined;
    // All throwing simulation/validation work completed before publication.
    continuation = owned.continuation;inspection = owned.inspection;acceptedRecords = nextRecords;revision++;spin=nextSpin;episodes=nextEpisodes;
    return owned.record;
  }
  function capture():LiveBattingPracticeCaptureV150 {
    return Object.freeze({ version:'live_batting_practice_capture_v150', configuration, continuation, revision,...(spin?{spinMotorPracticeV239:spin}:{}),...(episodes?{spinPracticeEpisodesV242:episodes}:{}) });
  }
  function inspect() {
    return Object.freeze({ ...inspection, practiceVersion:'live_batting_practice_v150' as const, configuration, continuation,
      revision, acceptedRecords, history:acceptedRecords });
  }
  async function startSpinMotorPractice(raw:LiveSpinPracticePlanV239):Promise<void>{
    assert(!spin&&!episodes,'spin practice already started');const beforeRevision=revision,before=continuation,plan=cloneInert(raw);
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
  async function startEpisodePracticeV242(rawPlan:LiveSpinEpisodePlanV242,rawRequest:LiveBattingPracticeRequestV150):Promise<void>{
    assert(!spin&&!episodes&&revision===0,'episode practice requires a fresh owner');
    const plan=cloneInert(rawPlan),verified=declareSpinPracticeEpisodesV242({scopeId:plan.scopeId,motor:plan.motor,criterion:plan.criterion,episodeSeeds:plan.episodes.map(x=>x.seed)});
    assert(sameConfiguration(plan,verified),'episode plan differs from declaration');const request=cloneInert(rawRequest);
    assert(!Object.hasOwn(request,'observedSpinTrialV236')&&!Object.hasOwn(request,'spinMotorPracticePolicyV239'),'episode normal request contains trial');commandFor(request,0);
    const nextConfiguration=deriveSpinEpisodeConfigurationV242(plan,0,configuration),host=createLiveBaseballMatchWorkerV116(nextConfiguration),initial=host.captureContinuationV116();
    const semanticPlan={version:plan.version,motor:{version:plan.motor.version,subjectId:plan.motor.subjectId,technique:plan.motor.technique,clip:plan.motor.clip,domain:plan.motor.domain,delta:plan.motor.delta,trainingOpportunities:plan.motor.trainingOpportunities},criterion:plan.criterion,selection:plan.selection,start:plan.start,timeScope:plan.timeScope,memoryPrior:plan.memoryPrior,workload:plan.workload,episodes:plan.episodes};
    const [baseConfigurationHash,planHash]=await Promise.all([hashLiveSpinPracticeProofV239(configuration),hashLiveSpinPracticeProofV239(semanticPlan)]);
    assert(!spin&&!episodes&&revision===0,'episode practice changed while starting');
    const slots=plan.episodes.map((e,i)=>({index:e.index,seed:e.seed,episodeId:baseConfigurationHash+':'+planHash+':'+e.index+':'+e.seed,initial:i===0?initial:null,transition:null,steps:[],ended:false}));
    activeConfiguration=nextConfiguration;continuation=initial;inspection=host.inspect();episodes=frozen({version:'live_spin_practice_episodes_sidecar_v242',baseConfigurationHash,planHash,plan,normalRequest:request,phase:'ACTIVE',globalRevision:0,globalAcceptedPitchCount:0,activeIndex:0,slots,normalTail:[],evaluation:{status:'HOLD',reason:'COHORT_PENDING',earnedQualification:false,humanCalibration:'NOT_MEASURED'},earnedQualification:false,nativeQualification:false});
  }
  function inspectEpisodePracticeV242():LiveSpinEpisodesSidecarV242 {assert(episodes,'episode practice is not started');return episodes;}
  async function previewEpisodeStepV242():Promise<LiveSpinEpisodeCandidateV242>{
    const state=episodes;assert(state?.phase==='ACTIVE','episode practice is not active');const slot=state.slots[state.activeIndex],before=continuation,localRevision=revision;
    assert(slot&&!slot.ended&&slot.initial,'episode slot is unavailable');const hasTarget=slot.steps.some(x=>x.kind==='TARGET'),isCurrentTarget=inspection.batterPlayerId===state.plan.motor.subjectId,isTarget=!hasTarget&&isCurrentTarget;
    const kind:EpisodeStepV242['kind']=isTarget?'TARGET':hasTarget?'PA_TAIL':'PREFIX',offense=before.match.half==='top'?0:1,motor=state.plan.motor;
    const policy={version:'live_spin_motor_practice_policy_v239' as const,subjectId:motor.subjectId,motorId:motor.motorId,motorVersion:motor.motorVersion,clip:motor.clip};
    // The fixed intent belongs only to the selected person; another batter's prefix remains ordinary Core.
    const {practiceSwingDecisionV241:targetIntent,...ordinaryRequest}=state.normalRequest;
    const normalRequest=isCurrentTarget?{...state.normalRequest,spinMotorPracticePolicyV239:policy}:ordinaryRequest;
    const normalCommand=commandFor(normalRequest,offense);let normalRecord:LiveIssuedPitchV1|null=null,trialRecord:LiveIssuedPitchV1|null=null,after:LiveMatchContinuationV116|null=null,normalAfter:LiveMatchContinuationV116|null=null,afterInspection:HostInspection|null=null,hold:EpisodeStepV242['hold']=null;
    try{const host=createLiveBaseballMatchWorkerV116(activeConfiguration,before);normalRecord=host.issuePitch(normalCommand);normalAfter=host.captureContinuationV116();after=normalAfter;afterInspection=host.inspect()}
    catch(error){if(!isLiveBaseballUnresolvedV239(error))throw error;hold={attempt:'NORMAL',unresolved:error.unresolvedV239}}
    if(isTarget&&!hold){const selection=resolveLiveSpinMotorPracticeV239({mode:'PRACTICE_EXPLICIT',subjectId:motor.subjectId,technique:motor.technique,clip:motor.clip,domain:motor.domain,motors:[motor]});assert(selection.status==='READY_PRACTICE','episode motor unavailable');
      try{const host=createLiveBaseballMatchWorkerV116(activeConfiguration,before);trialRecord=host.issuePitch(commandFor({...normalRequest,observedSpinTrialV236:selection.request},offense));after=host.captureContinuationV116();afterInspection=host.inspect()}
      catch(error){if(!isLiveBaseballUnresolvedV239(error))throw error;hold={attempt:'TRIAL',unresolved:error.unresolvedV239};after=null;afterInspection=null}
    }
    let physicalFingerprint:string|null=null,identity:string|null=null;
    if(isTarget&&!hold){assert(normalRecord&&trialRecord,'episode pair missing');
      const normalDiagnostics=normalRecord.play.diagnostics as {sourceDescriptor?:unknown},trialDiagnostics=trialRecord.play.diagnostics as {sourceDescriptor?:unknown;observedSpinComposeV238?:{version:string;status:string;subjectId:string;technique:string;clip:unknown;requestedDelta:unknown}},diagnostic=trialDiagnostics.observedSpinComposeV238;
      assert(diagnostic&&diagnostic.version==='live_observed_spin_compose_result_v238'&&['NO_TARGET','PLANNED'].includes(diagnostic.status)&&diagnostic.subjectId===motor.subjectId&&diagnostic.technique===motor.technique&&sameConfiguration(diagnostic.clip,motor.clip)&&sameConfiguration(diagnostic.requestedDelta,motor.delta),'episode diagnostic differs');
      assert(normalRecord.batterPlayerId===motor.subjectId&&trialRecord.batterPlayerId===motor.subjectId&&normalRecord.pitcherPlayerId===trialRecord.pitcherPlayerId&&sameConfiguration(normalRecord.beforeMatch,trialRecord.beforeMatch)&&sameConfiguration(normalDiagnostics.sourceDescriptor,trialDiagnostics.sourceDescriptor),'episode pair differs');
      assert(sameConfiguration(normalRecord.command.spinMotorPracticePolicyV239,policy)&&sameConfiguration(trialRecord.command.spinMotorPracticePolicyV239,policy),'episode policies differ');
      const descriptor=(normalRecord.play.diagnostics as {sourceDescriptor?:unknown}).sourceDescriptor;assert(descriptor!==undefined,'episode physical descriptor missing');
      physicalFingerprint=await hashLiveSpinPracticeProofV239({descriptor,pitcherId:normalRecord.pitcherPlayerId});
      assert(!state.slots.some(other=>other.index!==slot.index&&other.steps.some(x=>x.kind==='TARGET'&&x.physicalFingerprint===physicalFingerprint)),'episode physical pitch was copied');
      identity=await hashLiveSpinPracticeProofV239({baseConfigurationHash:state.baseConfigurationHash,planHash:state.planHash,index:slot.index,seed:slot.seed,before,physicalFingerprint});
    }
    assert(episodes===state&&revision===localRevision&&sameConfiguration(continuation,before),'episode preview became stale');
    const step:EpisodeStepV242=frozen({kind:hold?'HOLD':kind,before,after:hold?null:after,normalAfter,normalRecord,trialRecord,hold,physicalFingerprint,identity}),candidate=frozen({version:'live_spin_episode_candidate_v242' as const,globalRevision:state.globalRevision,step});
    episodeCandidatesV242.set(candidate,{session,sidecar:state,inspection:afterInspection});return candidate;
  }
  function evaluateEpisodesV242(state:LiveSpinEpisodesSidecarV242,slots:readonly EpisodeSlotV242[]):LiveSpinEpisodesSidecarV242['evaluation'] {
    if(!slots.every(slot=>slot.ended))return {status:'HOLD',reason:'COHORT_PENDING',earnedQualification:false,humanCalibration:'NOT_MEASURED'};
    const motor=state.plan.motor,trials:LiveSpinPracticeTrialV239[]=slots.map(slot=>{
      const entry=slot.steps.find(x=>x.kind==='TARGET');assert(entry?.identity&&entry.physicalFingerprint&&entry.normalRecord&&entry.trialRecord,'episode target evidence missing');
      const diagnostic=(entry.trialRecord.play.diagnostics as {observedSpinComposeV238:{status:string}}).observedSpinComposeV238;
      const outcome:LiveSpinPracticeTrialV239['outcome']=diagnostic.status==='NO_TARGET'?'NO_TARGET':entry.trialRecord.play.contact===null?'MISS':'CONTACT';
      const spinValue=(record:LiveIssuedPitchV1)=>{if(record.play.contact===null)return null;const c=record.play.contact as {exitVelocity:{x:number;y:number;z:number};exitSpin:{x:number;y:number;z:number}};return {velocityMps:c.exitVelocity,spinRadPerSecond:c.exitSpin,bats:motor.clip.bats}};
      const direction=(record:LiveIssuedPitchV1)=>{const v=spinValue(record)?.velocityMps;return v&&Math.hypot(v.x,v.z)>0?Math.atan2(v.x,v.z)*180/Math.PI:null};
      const requested=(entry.trialRecord.play.diagnostics as {battingDirectionV149?:{direction?:{fieldAngleDegrees?:number|null}}}).battingDirectionV149?.direction?.fieldAngleDegrees??null;
      return {opportunity:{configurationBinding:entry.identity,pitchOrdinal:entry.before.pitchCount+1,pitchFingerprint:entry.physicalFingerprint},motorId:motor.motorId,motorVersion:motor.motorVersion,motorSnapshot:motor,outcome,normal:spinValue(entry.normalRecord),actual:outcome==='CONTACT'?spinValue(entry.trialRecord):null,direction:{requestedDegrees:requested,normalDegrees:direction(entry.normalRecord),actualDegrees:direction(entry.trialRecord)}};
    });
    return evaluateLiveSpinMotorPracticeV239({motor,criterion:state.plan.criterion,cohort:{version:'live_spin_practice_cohort_v239',scopeId:state.plan.scopeId,motorId:motor.motorId,motorVersion:motor.motorVersion,motorSnapshot:motor,opportunities:trials.map(x=>x.opportunity)},trials});
  }
  async function acceptEpisodeStepV242(candidate:LiveSpinEpisodeCandidateV242):Promise<LiveIssuedPitchV1|null>{
    const owned=episodeCandidatesV242.get(candidate),state=episodes;assert(owned&&state===owned.sidecar&&owned.session===session&&candidate.globalRevision===state.globalRevision&&state.phase==='ACTIVE','episode candidate is foreign or stale');
    const step=candidate.step,record=step.kind==='TARGET'?step.trialRecord:step.normalRecord,slot=state.slots[state.activeIndex];
    if(step.kind==='HOLD'){const slots=state.slots.map((x,i)=>i===state.activeIndex?{...x,steps:[...x.steps,step]}:x);episodes=frozen({...state,globalRevision:state.globalRevision+1,slots});return null}
    assert(record&&step.after&&owned.inspection,'episode accepted record missing');assert('batterAdvanced' in record.play.rules,'episode rule result unresolved');const ended=(step.kind==='TARGET'||step.kind==='PA_TAIL')&&record.play.rules.batterAdvanced;
    const slots=state.slots.map((x,i)=>i===state.activeIndex?{...x,steps:[...x.steps,step],ended}:x),next=frozen({...state,globalRevision:state.globalRevision+1,globalAcceptedPitchCount:state.globalAcceptedPitchCount+1,slots,evaluation:evaluateEpisodesV242(state,slots),phase:ended?'ENDED' as const:'ACTIVE' as const});
    continuation=step.after;inspection=owned.inspection;revision++;acceptedRecords=Object.freeze([...acceptedRecords,record]);episodes=next;return record;
  }
  function advanceEpisodeV242():void {
    const state=episodes;assert(state?.phase==='ENDED','episode plate appearance has not ended');const index=state.activeIndex+1;assert(index<state.slots.length,'episode schedule exhausted');
    const nextConfiguration=deriveSpinEpisodeConfigurationV242(state.plan,index,configuration),host=createLiveBaseballMatchWorkerV116(nextConfiguration),initial=host.captureContinuationV116(),slots=state.slots.map((x,i)=>i===index?{...x,initial,transition:{fromIndex:state.activeIndex,fromContinuation:continuation,toInitial:initial}}:x);
    activeConfiguration=nextConfiguration;continuation=initial;inspection=host.inspect();revision=0;episodes=frozen({...state,activeIndex:index,slots,phase:'ACTIVE',globalRevision:state.globalRevision+1});
  }
  function closeEpisodePracticeV242():LiveSpinEpisodesSidecarV242 {
    const state=episodes;assert(state&&(state.phase==='ACTIVE'||state.phase==='ENDED'),'episode practice is not open');const complete=state.slots.every(x=>x.ended);
    episodes=frozen({...state,phase:complete?'CLOSED':'INTERRUPTED',globalRevision:state.globalRevision+1});return episodes;
  }
  function closeSpinMotorPractice():LiveSpinPracticeSidecarV239 {
    const state=spin;assert(state?.phase==='ACTIVE','spin practice is already closed or not active');
    const completed=state.slots.every(slot=>state.entries.some(entry=>entry.kind==='COMPLETE'&&entry.trial.opportunity.pitchOrdinal===slot.pitchOrdinal));
    const next=frozen({...state,phase:completed?'CLOSED' as const:'INTERRUPTED' as const,sidecarRevision:state.sidecarRevision+1,closeBoundary:{continuation,physicsRevision:revision,sidecarRevision:state.sidecarRevision+1}});spin=next;return next;
  }
  const issuePitch = (request:LiveBattingPracticeRequestV150) => accept(preview(request));
  return Object.freeze({ preview, accept, issuePitch, inspect, capture, startSpinMotorPractice, previewSpinMotorPractice, acceptSpinMotorPractice, closeSpinMotorPractice,startEpisodePracticeV242,inspectEpisodePracticeV242,previewEpisodeStepV242,acceptEpisodeStepV242,advanceEpisodeV242,closeEpisodePracticeV242 });
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
/** Full replay before publishing a resumed episode owner. */
export async function resumeLiveBattingPracticeEpisodesV242(configuration:LiveMatchInputV1,raw:unknown){
 assert(raw&&typeof raw==='object'&&!Array.isArray(raw),'episode capture required');
 const keys=Reflect.ownKeys(raw);assert(keys.every(k=>typeof k==='string')&&keys.map(String).sort().join('|')==='configuration|continuation|revision|spinPracticeEpisodesV242|version','invalid episode capture fields');
 const descriptors=Object.getOwnPropertyDescriptors(raw),get=(name:string)=>{const d=descriptors[name];assert(d?.enumerable&&'value' in d,'invalid episode capture descriptor');return d.value};
 const copiedConfiguration=cloneMatchInputWithMeasuredCatalogV68(get('configuration')),rawSide=get('spinPracticeEpisodesV242');encodeLiveSpinPracticeProofV239(rawSide);const side=structuredClone(rawSide) as LiveSpinEpisodesSidecarV242;
 const input:LiveBattingPracticeCaptureV150={version:get('version'),configuration:copiedConfiguration,continuation:cloneInert(get('continuation')),revision:get('revision'),spinPracticeEpisodesV242:side};
 assert(input.version==='live_batting_practice_capture_v150'&&Number.isSafeInteger(input.revision)&&input.revision>=0,'invalid episode capture header');
 assert(sameConfiguration(configuration,copiedConfiguration)&&side.version==='live_spin_practice_episodes_sidecar_v242'&&Array.isArray(side.slots)&&Array.isArray(side.normalTail),'invalid episode source');
 const owner=createLiveBattingPracticeV150(configuration);await owner.startEpisodePracticeV242(side.plan,side.normalRequest);
 for(let index=0;index<side.slots.length;index++){
  const slot=side.slots[index];if(!slot.initial){assert(slot.steps.length===0&&!slot.ended,'unstarted episode has evidence');continue}
  if(index>0)owner.advanceEpisodeV242();assert(sameConfiguration(owner.capture().continuation,slot.initial),'episode initial state differs');
  for(const step of slot.steps){const candidate=await owner.previewEpisodeStepV242();assert(sameConfiguration(candidate.step,step),'episode replay differs');await owner.acceptEpisodeStepV242(candidate)}
 }
 if(side.phase==='CLOSED'||side.phase==='INTERRUPTED'){owner.closeEpisodePracticeV242();for(const tail of side.normalTail){const candidate=owner.preview(tail.request);assert(sameConfiguration(candidate.beforeContinuation,tail.before)&&sameConfiguration(candidate.record,tail.record)&&sameConfiguration(candidate.afterContinuation,tail.after),'episode normal tail differs');owner.accept(candidate)}}
 assert(sameConfiguration(owner.capture(),input),'episode final capture differs');return owner;
}
