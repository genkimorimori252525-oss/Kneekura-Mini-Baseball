import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../core/adjudication/OfficialWindowPolicy';
import { activateNextNonLivePlateAppearance } from '../core/adjudication/NonLiveOfficialApplication';
import { prepareBetweenPlayWorld } from '../core/adjudication/BetweenPlayWorldReset';
import { deriveOfficialPendingNonLiveResult } from './OfficialPendingPostPlay';
import { officialStateSerialized as json, officialStateHash as hash } from './OfficialStateEncoding';
import { actualFoulTerminalApplicationInput, type FoulTerminalApplicationProposal } from './world/ActualFoulTerminalApplication';
import { actualFoulTerminalPostPlaySetupInput } from './world/ActualFoulTerminalPostPlaySetup';
import type { DurableFoulTerminalCompletedApplication, FoulTerminalPostPlayCompletion,
  FoulTerminalPostPlayCompletionReference, PersistOfficialCompletedTerminalResult } from './world/ActualFoulTerminalPostPlayCompletion';
import { deriveFoulTerminalAcknowledgedResult } from './world/FoulTerminalAcknowledgementResult';
import { assertFoulTerminalApplicationStorage } from './world/ActualFoulTerminalApplicationStorage';
import { foulTerminalApplicationIdentityRows, foulTerminalApplicationClaims, foulTerminalPostPlaySetupIdentityRows,
  type FoulTerminalApplicationScope } from './world/ActualFoulTerminalApplicationOwnership';
import { officialApplicationOwnershipClaims, officialMatchTerminalOwnershipClaims, officialApplicationHasTerminalStageClaim, officialApplicationPostPlaySetupIdentityClaims } from './OfficialApplicationOwnershipFromSqlite';
import { actorFreeze as freeze } from './world/PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Db=Pick<DatabaseSync,'prepare'>;
type MatchRow={durable_revision:number;state_json:string;activation_json:string|null};
const version='actual_foul_terminal_post_play_completion_v1';
const fields=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)
  &&json(Object.keys(v).sort())===json([...keys].sort());
const id=(v:unknown):v is string=>typeof v==='string'&&!!v&&v===v.trim();
const tick=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a:unknown,b:unknown,message:string)=>{if(json(a)!==json(b))throw new Error('terminal completion '+message);};
const parse=(v:unknown,label:string):unknown=>{
  if(typeof v!=='string')throw new Error('terminal completion '+label+' encoding missing');
  const parsed=cloneInert(JSON.parse(v));if(json(parsed)!==v)throw new Error('terminal completion '+label+' must be canonical');return parsed;
};
export const foulTerminalCompletionReference=(c:FoulTerminalPostPlayCompletion):FoulTerminalPostPlayCompletionReference=>freeze({
  version,completionId:c.completionId,terminalSourceId:c.terminalReference.sourceId,setupSourceId:c.source.sourceId,sourceHash:c.sourceHash,snapshotHash:c.snapshotHash,
});
export const foulTerminalCompletedOfficial=(official:import('./OfficialPendingPostPlay').PersistOfficialPendingNonLiveResult,c:FoulTerminalPostPlayCompletion):PersistOfficialCompletedTerminalResult=>freeze({
  ...official,completion:foulTerminalCompletionReference(c),activation:c.activation,nextWorld:c.nextWorld,
});
export const foulTerminalCompletionScope=(p:FoulTerminalApplicationProposal):FoulTerminalApplicationScope=>({
  official:{sourceId:p.officialReference.sessionSourceId,gameId:p.gameId,playId:p.playId,physicalPitchSourceId:p.physicalPitchSourceId,
    physicalEndSourceId:p.physicalEndReference.sourceId,consumptionSourceId:p.consumptionReference.sourceId,
    officialObligationKey:p.officialObligation.obligationKey,originalSuccessorKey:p.originalSuccessorKey},
  applicationSourceId:p.source.sourceId,applicationId:p.source.applicationId,closureId:p.source.sourceId,
  firstPhysicalPitchSourceId:p.firstPhysicalPitchSourceId,runtimeSourceId:p.runtimeSourceId,scopeId:p.scopeId,
  selectedHeadSourceId:p.officialReference.headSourceId,intentSourceId:p.callIntent.sourceId,
});
const moment=(v:unknown)=>fields(v,['originTick','elapsedSeconds','tick'])&&tick(v.originTick)&&tick(v.tick)
  &&typeof v.elapsedSeconds==='number'&&Number.isFinite(v.elapsedSeconds)&&v.elapsedSeconds>=0;
const command=(v:unknown):boolean=>fields(v,['kind','owner','sourceId','sourceVersion','sourceHash','adoptionSourceId','adoptionSourceHash',
  'adoptedAt','executedThrough','acceptedThroughTick'])&&['contact','field','owned_motion_v1','owned_motion_v2','motion','motion_checkpoint_v1','throw','throw_advance'].includes(String(v.kind))
  &&['batted_world_contacts','batted_world_field_actions','batted_world_field_executions'].includes(String(v.owner))
  &&[v.sourceId,v.sourceVersion,v.adoptionSourceId].every(id)&&[v.sourceHash,v.adoptionSourceHash].every(digest)
  &&moment(v.adoptedAt)&&moment(v.executedThrough)&&tick(v.acceptedThroughTick);
const coverage=(v:unknown):boolean=>v===null||fields(v,['compositionSourceId','physicalThroughTick','rootAuthority','roleAuthorities'])
  &&id(v.compositionSourceId)&&tick(v.physicalThroughTick)&&fields(v.rootAuthority,['owner','sourceId','sourceHash','adoptionOwner','adoptionSourceId','adoptionSourceHash','acceptedThroughTick'])
  &&['batted_world_contacts','batted_world_field_actions','batted_world_field_executions','actual_locomotion_receipts'].includes(String(v.rootAuthority.owner))
  &&['batted_world_contacts','batted_world_field_actions','batted_world_field_executions'].includes(String(v.rootAuthority.adoptionOwner))
  &&[v.rootAuthority.sourceId,v.rootAuthority.adoptionSourceId].every(id)&&[v.rootAuthority.sourceHash,v.rootAuthority.adoptionSourceHash].every(digest)
  &&tick(v.rootAuthority.acceptedThroughTick)&&Array.isArray(v.roleAuthorities)&&v.roleAuthorities.every(r=>fields(r,['role','command','acceptedThroughTick'])
    &&['glove','body','tag_hand','left_foot','right_foot'].includes(String(r.role))&&command(r.command)&&tick(r.acceptedThroughTick));
/** Exact local wire validation, not original physical/effect authentication. */
export const validateFoulTerminalCompletionWire=(raw:unknown,p:FoulTerminalApplicationProposal,
  original:ReturnType<typeof deriveFoulTerminalAcknowledgedResult>):FoulTerminalPostPlayCompletion=>{
  const c=cloneInert(raw) as FoulTerminalPostPlayCompletion;
  if(!fields(c,['version','completionId','source','sourceHash','terminalReference','officialReference','scoringReference','workloadReference','controllerRetirement','activation','nextWorld','snapshotHash'])
    ||c.version!==version||!digest(c.snapshotHash))throw new Error('terminal completion archive envelope differs');
  const source=actualFoulTerminalPostPlaySetupInput(c.source,c.source.sourceId);
  same(c.sourceHash,hash(source),'setup Source hash differs');
  same(c.completionId,json([version,p.source.sourceId,source.sourceId]),'identity differs');
  const ref={owner:'actual_foul_terminal_applications',sourceId:p.source.sourceId,sourceVersion:p.source.sourceVersion,sourceHash:hash(p.source),proposalHash:hash(p)};
  same(c.terminalReference,ref,'original reference differs');same(source.terminalReference,ref,'setup reference differs');
  same(c.officialReference,{applicationId:original.official.receipt.applicationId,receiptHash:hash(original.official.receipt),
    pendingPostPlayHash:hash(original.official.pendingPostPlay),acknowledgementHash:hash(original.acknowledgement)},'official reference differs');
  if(!fields(c.scoringReference,['scoringApplicationId','rowHash'])||c.scoringReference.scoringApplicationId!==json(['actual_foul_terminal_scoring_v1',p.source.sourceId])
    ||!digest(c.scoringReference.rowHash)||!fields(c.workloadReference,['terminalSourceId','planHash','participantEffects'])
    ||c.workloadReference.terminalSourceId!==p.source.sourceId||!digest(c.workloadReference.planHash)||!Array.isArray(c.workloadReference.participantEffects))throw new Error('terminal completion effect reference differs');
  const effects=c.workloadReference.participantEffects;
  if(effects.length!==10||effects.some(e=>!fields(e,['playerId','activitySourceId','beforeRevision','afterRevision','activityHash','afterHash'])
    ||![e.playerId,e.activitySourceId].every(id)||![e.activityHash,e.afterHash].every(digest)||!tick(e.beforeRevision)||!tick(e.afterRevision)||e.afterRevision!==e.beforeRevision+1)
    ||new Set(effects.map(e=>e.playerId)).size!==10||new Set(effects.map(e=>e.activitySourceId)).size!==10)throw new Error('terminal completion exact ten effects differ');
  same(effects.map(e=>e.playerId),effects.map(e=>e.playerId).sort(),'effect order differs');
  const retirement=c.controllerRetirement;
  if(!fields(retirement,['version','kind','sourceId','previousPlayId','nextPlayId','atTick','physicalEndReference','retired','retainedOriginalFutureWork'])
    ||retirement.version!=='actual_foul_terminal_controller_retirement_v1'||retirement.kind!=='rule_system_retire_original_play'
    ||retirement.sourceId!==source.sourceId||retirement.previousPlayId!==p.playId||retirement.nextPlayId!==p.nextMatch.playId
    ||retirement.atTick!==source.nextStartedAtTick||!Array.isArray(retirement.retired)||retirement.retired.length!==10
    ||retirement.retired.some(r=>!fields(r,['playerId','personId','activeCommand','ownedMotionCoverage'])||![r.playerId,r.personId].every(id)||!command(r.activeCommand)||!coverage(r.ownedMotionCoverage))
    ||!fields(retirement.retainedOriginalFutureWork,['controllers'])||!Array.isArray(retirement.retainedOriginalFutureWork.controllers)
    ||retirement.retainedOriginalFutureWork.controllers.some(r=>!fields(r,['playerId','sourceId','dueTick'])||![r.playerId,r.sourceId].every(id)||!tick(r.dueTick)))throw new Error('terminal completion retirement shape differs');
  same(retirement.physicalEndReference,p.physicalEndReference,'retirement physical reference differs');
  same(retirement.retired.map(r=>[r.playerId,r.personId]),[...p.participants].sort((a,b)=>a.binding.playerId<b.binding.playerId?-1:a.binding.playerId>b.binding.playerId?1:0)
    .map(a=>[a.binding.playerId,a.person.personId]),'retired original participants differ');
  same(retirement.retired.map(r=>r.playerId),effects.map(e=>e.playerId),'effect and retirement membership differs');
  const body=p.applicationBody,receipt=original.official.receipt,progression=original.official.pendingPostPlay.gameProgression;
  if(progression.kind==='GAME_FINAL_PENDING_SCORING'||body.match.inning!==receipt.appliedMatchState.inning||body.match.half!==receipt.appliedMatchState.half
    ||Object.values(body.match.bases).some(v=>v!==null)||Object.values(receipt.appliedMatchState.bases).some(v=>v!==null)
    ||source.nextStartedAtTick<p.clock.closureTick)throw new Error('terminal completion requires same-half empty-base continuing setup');
  const activation=activateNextNonLivePlateAppearance({match:body.match,timeline:body.timeline,adjudication:body.adjudication,context:body.context,
    application:receipt,nextStartedAtTick:source.nextStartedAtTick});
  same(c.activation,activation,'activation derivation differs');
  same(c.nextWorld,prepareBetweenPlayWorld(activation.nextMatchState,source.nextStartedAtTick,source.worldSetup),'world derivation differs');
  const {snapshotHash,...payload}=c;same(snapshotHash,hash(payload),'snapshot hash differs');return freeze(c);
};

/** Local three-mirror decoding only. Full original physical/scoring/workload
 * owners must still authenticate every successful completion/readiness read. */
export const readFoulTerminalCompletionMirrors=(db:Db,sourceId:string,current=false)=>{
  if(!id(sourceId)||db.prepare('PRAGMA main.user_version').get()!.user_version!==3
    ||!assertFoulTerminalApplicationStorage(db as DatabaseSync,'completion'))throw new Error('terminal completion exact storage prerequisite missing');
  const rows=foulTerminalApplicationIdentityRows(db,sourceId);
  if(rows.length!==1||rows[0].source_id!==sourceId)throw new Error('terminal completion original ownership missing or ambiguous');
  const row=rows[0];if(row.status!=='POST_PLAY_COMPLETED_CONTINUING')throw new Error('terminal completion remains pending');
  const source=actualFoulTerminalApplicationInput(parse(row.source_json,'original Source'),sourceId);
  const p=parse(row.proposal_json,'proposal') as FoulTerminalApplicationProposal;
  if(p?.kind!=='terminal_non_live_projected'||p.officialApplied!==false||!p.applicationBody||!p.clock||!Array.isArray(p.participants))throw new Error('terminal completion proposal shape differs');
  same(p.source,source,'proposal Source differs');same(row.source_hash,hash(source),'original Source hash differs');same(row.proposal_hash,hash(p),'proposal hash differs');
  same([row.game_id,row.play_id,row.application_id,row.physical_pitch_source_id,row.physical_end_source_id,row.official_obligation_key],
    [p.gameId,p.playId,source.applicationId,p.physicalPitchSourceId,p.physicalEndReference.sourceId,p.officialObligation.obligationKey],'cached original scope differs');
  const request={...p.applicationBody,origin:{owner:'actual_foul_terminal_applications' as const,sourceId,sourceVersion:source.sourceVersion,sourceHash:hash(source),snapshotHash:hash(p)}};
  const official=deriveOfficialPendingNonLiveResult(request,p.originalOfficialRevision+1),original=deriveFoulTerminalAcknowledgedResult(p,official);
  const result=parse(row.result_json,'result');
  if(!fields(result,['sourceId','official','acknowledgement','completion']))throw new Error('terminal completion result shape differs');
  same({sourceId:result.sourceId,official:result.official,acknowledgement:result.acknowledgement},original,'original acknowledged bytes differ');
  const completion=validateFoulTerminalCompletionWire(result.completion,p,original),applicationResult=foulTerminalCompletedOfficial(official,completion);
  const application=db.prepare('SELECT * FROM main.applications WHERE application_id=?').get(source.applicationId);
  same(application,{application_id:source.applicationId,match_id:p.gameId,closure_id:sourceId,request_hash:official.pendingPostPlay.requestHash,result_json:json(applicationResult)},'application mirror differs');
  const match=db.prepare('SELECT * FROM main.matches WHERE match_id=?').get(p.gameId);
  if(!match||!tick(match.durable_revision)||match.durable_revision<official.receipt.durableRevision)throw new Error('terminal completion Match revision differs');
  const expectedMatch={match_id:p.gameId,durable_revision:official.receipt.durableRevision,state_json:json(official.receipt.appliedMatchState),
    activation_json:json({activation:completion.activation,nextWorld:completion.nextWorld})};
  if(current||match.durable_revision===official.receipt.durableRevision)same(match,expectedMatch,'Match mirror differs');
  same(foulTerminalApplicationClaims(db,foulTerminalCompletionScope(p)),[row],'raw original ownership differs');
  same(foulTerminalPostPlaySetupIdentityRows(db,completion.source.sourceId),[row],'raw setup ownership differs');
  const claims=officialApplicationOwnershipClaims(db,foulTerminalCompletionScope(p));
  same(claims,[{table:'applications',row:application},{table:'matches',row:match}],'raw official ownership differs');
  const setupClaims=officialApplicationPostPlaySetupIdentityClaims(db,completion.source.sourceId);
  if(!setupClaims.some(c=>c.table==='applications'&&json(c.row)===json(application))||setupClaims.some(c=>
    !(c.table==='applications'&&json(c.row)===json(application))&&!(c.table==='matches'&&json(c.row)===json(expectedMatch))))throw new Error('terminal completion raw setup official mirror differs');
  const archive:DurableFoulTerminalCompletedApplication=freeze({source,proposal:p,status:'POST_PLAY_COMPLETED_CONTINUING',officialApplied:true,
    result:{...original,completion}});
  return freeze({archive,applicationResult,row,application:application!,match});
};

/** Called before getMatch's legacy fallback. A legacy-shaped wrapper cannot
 * hide pending, completed-but-damaged, or orphan terminal claims. */
export const readOfficialCompletedTerminalMatch=(db:Db,matchId:string,row:MatchRow):PersistOfficialCompletedTerminalResult|null=>{
  const envelope=row.activation_json===null?null:cloneInert(JSON.parse(row.activation_json));
  if(envelope&&typeof envelope==='object'&&!Array.isArray(envelope)&&Object.hasOwn(envelope,'pendingPostPlay'))return null;
  const state=JSON.parse(row.state_json),previous=typeof state?.playId==='number'?state.playId-1:null;
  const current={table:'matches' as const,row:{match_id:matchId,...row}};
  const census=officialMatchTerminalOwnershipClaims(db,matchId,current.row,previous);
  const claim=census.terminal.length>0||officialApplicationHasTerminalStageClaim(db,current)
    ||census.official.some(entry=>officialApplicationHasTerminalStageClaim(db,entry));
  if(!claim)return null;
  if(census.terminal.length!==1||typeof census.terminal[0].source_id!=='string')throw new Error('terminal completion local claim is missing or ambiguous');
  const decoded=readFoulTerminalCompletionMirrors(db,census.terminal[0].source_id,true);
  same(decoded.match,{match_id:matchId,...row},'selected Match differs');return decoded.applicationResult;
};
