import { readSamePaLifecycleClaimRows } from './SamePlateAppearanceLifecycleClaimGuard';
import { deriveSamePaCatchLifecycleOutcome } from './SamePlateAppearanceCatchLifecycleOutcomeFromSqlite';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { deriveBallWorldSettledFoulDeadEvidence } from '../../core/rules/BallWorldSettledFoulDeadEvidence';
import type { BallWorldFieldTerritoryInput } from '../../core/rules/BallWorldFieldTerritory';
import type { BallWorldBattedRuleContactFrame } from '../../core/rules/BallWorldBattedRuleEvidence';
import { recordFoulBattedBall } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { prepareBetweenPlayWorld } from '../../core/adjudication/BetweenPlayWorldReset';
import { createPlayEndFact } from '../../core/rules/PhysicalRuleFacts';
import { resolveWalkForcedAdvancement } from '../../core/rules/WalkAdvancementRule';
import { createPlayAdjudicationLedger,recordCorrectRuleSnapshot,recordOnFieldCall,closeOfficialPlay,getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { openRuleProfileOfficialStateWindow,advanceRuleProfileOfficialWindows } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaReferenceValid, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { readCurrentSamePaLifecycleViewFromSqlite,readHistoricalSamePaLifecycleViewFromSqlite,readSamePaLifecycleRecordFromSqlite,withSamePaLifecycleReadPhase,assertSamePaLifecycleReservedStateFromSqlite,assertSamePaLifecycleWorkCoverage } from './SamePlateAppearanceLifecycleFromSqlite';
import type { SamePaLifecyclePrefix,SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import type { SamePaPhysicalOperationReference,SamePaPhysicalFieldRoot,SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { readSamePaSuccessorTakePitchFromSqlite } from './SamePlateAppearanceTakeSuccessorFromSqlite';
import { assertSamePaLifecycleStorage,samePaLifecycleSchema } from './SamePlateAppearanceLifecycleStorage';
import { samePaStartingBaseCenters } from './SamePlateAppearanceLifecycleStartingGeometry';
import { samePaLifecycleOutcomeInput as input,type AcceptedSamePaLifecycleOutcome,type AcceptedSamePaLifecycleReset,
  type SamePaLifecycleOutcome,type SamePaLifecycleReset,type SamePaControllerCommand,type SamePaControllerRetirementBasis } from './SamePlateAppearanceLifecycleOutcome';
const tables={outcome:'pa_lifecycle_v1_outcomes',reset:'pa_lifecycle_v1_resets'} as const;
type Kind=keyof typeof tables;type Value=SamePaLifecycleOutcome|SamePaLifecycleReset;
type Pending=Readonly<{kind:'pending';reason:string}>;
const pending=(reason:string):Pending=>freeze({kind:'pending',reason});
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('lifecycle physical closure or official Source differs');};
const rowFor=(v:Value):Record<string,string|number>=>{const s=v.source,l=v.lineage,extra:Record<string,string|number>=v.kind==='same_pa_lifecycle_outcome'
  ?{physical_pitch_source_id:v.controllerRetirementBasis.physicalPitchReference.sourceId,official_head_source_id:v.source.official.events.at(-1)!.sourceId}:{outcome_source_id:v.source.outcomeReference.sourceId};
  return{source_id:s.sourceId,source_version:s.sourceVersion,career_id:l.careerId,game_id:l.gameId,play_id:l.playId,enrollment_source_id:l.enrollmentReference.sourceId,
    actor_source_id:l.actorReference.sourceId,first_pitch_source_id:l.firstPhysicalPitchSourceId,...extra,source_json:json(s),source_hash:hash(s),snapshot_json:json(v),snapshot_hash:hash(v)};};
const row=(db:DatabaseSync,kind:Kind,id:string)=>{
  const installed=assertSamePaLifecycleStorage(db),rows=installed?Object.values(samePaLifecycleSchema).map(ddl=>ddl.slice(13,ddl.indexOf('('))).flatMap(table=>
    db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')} OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({id}).map(row=>({table,row}))):[];
  if(rows.length>1||rows.length===1&&(rows[0].table!==tables[kind]||rows[0].row.source_id!==id))throw new Error('lifecycle closure identity alias differs');if(!rows.length)readSamePaLifecycleClaimRows(db);return rows[0]?.row??null;
};
export const samePaOutcomeFieldEvidence=(db:DatabaseSync,b:SamePaLifecycleViewBasis)=>{
  const prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',b.view.source.prefixReference.sourceId) as SamePaLifecyclePrefix;
  const fields:(SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep)[]=[],commands:SamePaControllerCommand[]=[];
  for(const ref of prefix.source.eventReferences){
    if(!['pa_physical_v1_launches','pa_physical_v1_commitments','pa_physical_v1_field_roots','pa_physical_v1_field_steps'].includes(ref.owner))continue;
    const op=readSamePaPhysicalOperationFromSqlite(db,ref as SamePaPhysicalOperationReference);
    if(op.physicalPitchReference.sourceId!==b.view.cut.physicalPitchReference.sourceId)continue;
    if(op.record.kind==='same_pa_physical_field_root_v1'||op.record.kind==='same_pa_physical_field_step_v1')fields.push(op.record);
    if(op.record.kind==='same_pa_physical_launch_v1')commands.push({kind:'pitch_delivery',sourceReference:ref,playerId:op.record.pitcherMember.playerId,role:'pitch_delivery',validThroughTick:op.record.delivery.timeline.followThroughEndUs,originalCommand:op.record.delivery.timeline,originalCommandHash:hash(op.record.delivery.timeline)});
    if(op.record.kind==='same_pa_physical_commitment_v1'&&op.record.commitment.trajectory)commands.push({kind:'batting_motor',sourceReference:ref,playerId:b.actor.binding.playerId,role:'batting_motor',validThroughTick:op.record.commitment.trajectory.endTick,originalCommand:op.record.commitment.trajectory,originalCommandHash:hash(op.record.commitment.trajectory)});
  }
  const root=fields[0],last=fields.at(-1);if(!root||root.kind!=='same_pa_physical_field_root_v1'||!last)throw new Error('lifecycle complete field root missing');
  const contacts:BallWorldBattedRuleContactFrame[]=[],baseContacts:BallWorldFieldTerritoryInput['baseContacts'][number][]=[],groundSegments:NonNullable<BallWorldFieldTerritoryInput['groundSegments']>[number][]=[];
  for(const [index,f] of fields.entries()){
    const boundary=f.field.motion.world,preceding=fields[index-1]?.field.motion.cursor?.moment;
    if(preceding&&f.field.motion.carrierPlayerId===null&&'phase'in boundary&&boundary.phase!=='resting'&&contacts.some(c=>c.contacts.some(c=>c.kind==='ground')))
      groundSegments.push({moment:preceding,throughElapsedSeconds:boundary.moment.elapsedSeconds,rollingDecelerationMps2:boundary.phase==='airborne'?0:root.source.parameters.groundRollingDecelerationMps2,...(boundary.phase==='airborne'?{gravityY:root.source.parameters.gravityY}:{})});
    if(boundary.kind!=='boundary')continue;
    const normalized=boundary.contacts.map(c=>c.kind==='actor'?{kind:c.kind,playerId:c.playerId,role:c.role}:c.kind==='surface'?{kind:c.kind,surfaceId:c.surfaceId}:{kind:c.kind});
    const prior=contacts.at(-1);if(prior?.moment.elapsedSeconds===boundary.moment.elapsedSeconds){same(prior.moment.ball.position,boundary.moment.ball.position);
      const extra=normalized.filter(c=>!prior.contacts.some(p=>json(p)===json(c)));if(extra.length)same(prior.moment,boundary.moment);contacts[contacts.length-1]={moment:prior.moment,contacts:[...prior.contacts,...extra]};}
    else contacts.push({moment:boundary.moment,contacts:normalized});
    for(const c of f.field.baseContacts)if(!baseContacts.some(p=>p.baseId===c.baseId&&p.moment.elapsedSeconds===c.moment.elapsedSeconds))baseContacts.push(c);
  }
  const rootRef=reference('pa_physical_v1_field_roots',root);
  for(const actor of root.field.motion.actors)commands.push({kind:'field_primitive',sourceReference:rootRef,playerId:actor.playerId,role:actor.primitive.role,validThroughTick:actor.primitive.endTick,originalCommand:actor.primitive,originalCommandHash:hash(actor.primitive)});
  for(const step of fields)if(step.kind==='same_pa_physical_field_step_v1'&&(step.actionResult?.kind==='defender_motion_v1'||step.actionResult?.kind==='batter_run_motion_v1'||step.actionResult?.kind==='batter_catch_motion_v1')){
    const stepRef=reference('pa_physical_v1_field_steps',step);
    for(const actor of step.field.motion.actors)commands.push({kind:'field_primitive',sourceReference:stepRef,playerId:actor.playerId,role:actor.primitive.role,
      validThroughTick:actor.primitive.endTick,originalCommand:actor.primitive,originalCommandHash:hash(actor.primitive)});
  }
  const acquisitions=fields.flatMap(step=>step.kind==='same_pa_physical_field_step_v1'&&step.actionResult?.kind==='capture_checkpoint_v1'&&step.actionResult.progress.acquisition
    ?[step.actionResult.progress.acquisition]:[]);
  const field:BallWorldFieldTerritoryInput={evidence:{batterRunnerId:b.actor.binding.playerId,defenderIds:b.actor.defenderBindings.map(d=>d.playerId),field:root.geometry.baseGeometry.field,bases:root.geometry.baseGeometry.gates,
    ballRadiusMeters:root.response.world.parameters.ballRadius,originTick:root.response.world.flight.initialBall.tick,ticksPerSecond:root.response.world.parameters.ticksPerSecond,
    horizon:last.field.motion.world.moment,contacts,acquisitions},baseContacts,groundSegments};
  return{field,commands,root,last};
};
export const samePaOutcomeRetirement=(b:SamePaLifecycleViewBasis,commands:readonly SamePaControllerCommand[],completedAtTick:number):SamePaControllerRetirementBasis=>freeze({
  kind:'same_pa_original_controller_retirement_basis_v1',physicalPitchReference:b.view.cut.physicalPitchReference,physicalOperationReference:b.view.cut.physicalOperationReference,
  completedAtTick,completeCoverageHash:b.view.coverageHash,participants:[b.actor.binding,...b.actor.defenderBindings].map(p=>({playerId:p.playerId,personId:p.personId,
    ownedCommands:commands.filter(c=>c.playerId===p.playerId)}))});
const outcome=(db:DatabaseSync,source:AcceptedSamePaLifecycleOutcome,current:boolean):SamePaLifecycleOutcome|Pending=>{
  const b=(current?readCurrentSamePaLifecycleViewFromSqlite:readHistoricalSamePaLifecycleViewFromSqlite)(db,source.viewReference),c=b.view.cut;
  same(source.enrollmentReference,b.view.lineage.enrollmentReference);same(source.physicalOperationReference,c.physicalOperationReference);
  if(c.outcomeReference||c.resetReference)throw new Error('lifecycle outcome already consumed');
  if(source.kind==='fair_catch')return deriveSamePaCatchLifecycleOutcome(db,source,b,current);
  let timeline=c.timeline,completed=c.evaluationTick,physicalEnd:SamePaLifecycleOutcome['physicalEnd']=null,proof:unknown,commands:SamePaControllerCommand[]=[];
  if(source.kind==='untouched_foul'){
    if(c.stage!=='field_active'||timeline.status.kind!=='batted_ball_pending')return pending('actual_untouched_field_cut_required');
    const owned=samePaOutcomeFieldEvidence(db,b);if(source.rulePolicy?.ruleProfileId!==b.actor.match.ruleProfileId)throw new Error('lifecycle foul policy differs from Match');
    const evidence=deriveBallWorldSettledFoulDeadEvidence({field:owned.field,count:timeline.status.count,policy:source.rulePolicy!});
    if(evidence.interpretation.kind!=='dead_ball')return pending(evidence.interpretation.reason);
    completed=evidence.interpretation.moment.ball.tick;if(completed!==c.evaluationTick)throw new Error('lifecycle physical stop must be the exact current cut');
    const prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',b.view.source.prefixReference.sourceId) as SamePaLifecyclePrefix;
    const commitments=prefix.source.eventReferences.filter(r=>r.owner==='pa_physical_v1_commitments').map(r=>readSamePaPhysicalOperationFromSqlite(db,r as SamePaPhysicalOperationReference))
      .filter(p=>p.physicalPitchReference.sourceId===c.physicalPitchReference.sourceId);
    if(commitments.length!==1||commitments[0].record.kind!=='same_pa_physical_commitment_v1')return pending('original_owned_batting_intent_required');
    timeline=recordFoulBattedBall(timeline,completed,commitments[0].record.originalIntent.attempt==='bunt',null);physicalEnd=createPlayEndFact(completed,'dead_ball');proof=evidence;commands=owned.commands;
  }else{
    if(timeline.status.kind!=='walk'&&timeline.status.kind!=='strikeout')return pending('terminal_original_count_required');
    if(c.physicalPitchReference.owner==='pa_take_successor_v1_pitch_actions'){
      const p=readSamePaSuccessorTakePitchFromSqlite(db,{...c.physicalPitchReference,owner:'pa_take_successor_v1_pitch_actions'}).pitch;
      commands=[{kind:'pitch_delivery',sourceReference:c.physicalPitchReference,playerId:p.frame.binding.playerId,role:'pitch_delivery',validThroughTick:p.result.delivery.timeline.followThroughEndUs,originalCommand:p.result.delivery.timeline,originalCommandHash:hash(p.result.delivery.timeline)}];
      completed=Math.max(completed,p.result.delivery.timeline.followThroughEndUs);proof=p.result;
    }else{
      const op=readSamePaPhysicalOperationFromSqlite(db,c.physicalOperationReference as SamePaPhysicalOperationReference);
      if(op.record.kind!=='same_pa_physical_resolution_v1')return pending('terminal_actual_resolution_required');
      const launch=readSamePaPhysicalOperationFromSqlite(db,op.physicalPitchReference).record;if(launch.kind!=='same_pa_physical_launch_v1')throw new Error('terminal physical launch missing');
      commands=[{kind:'pitch_delivery',sourceReference:op.physicalPitchReference,playerId:launch.pitcherMember.playerId,role:'pitch_delivery',validThroughTick:launch.delivery.timeline.followThroughEndUs,originalCommand:launch.delivery.timeline,originalCommandHash:hash(launch.delivery.timeline)}];
      const prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',b.view.source.prefixReference.sourceId) as SamePaLifecyclePrefix;
      for(const ref of prefix.source.eventReferences.filter(r=>r.owner==='pa_physical_v1_commitments')){const p=readSamePaPhysicalOperationFromSqlite(db,ref as SamePaPhysicalOperationReference);if(p.physicalPitchReference.sourceId===c.physicalPitchReference.sourceId&&p.record.kind==='same_pa_physical_commitment_v1'&&p.record.commitment.trajectory)
        commands.push({kind:'batting_motor',sourceReference:ref,playerId:b.actor.binding.playerId,role:'batting_motor',validThroughTick:p.record.commitment.trajectory.endTick,originalCommand:p.record.commitment.trajectory,originalCommandHash:hash(p.record.commitment.trajectory)});}
      completed=Math.max(completed,launch.delivery.timeline.followThroughEndUs,...commands.map(c=>c.validThroughTick));proof=op.record;
    }
  }
  const terminal=timeline.status.kind==='walk'||timeline.status.kind==='strikeout';if(!terminal&&timeline.status.kind!=='active')return pending('unsupported_original_outcome');
  const context=timeline.status.kind==='walk'?{kind:'walk' as const,batterRunnerId:b.actor.binding.playerId}:timeline.status.kind==='strikeout'?{kind:'strikeout' as const}:null;
  const profile=actualLiveAdjudicationProfile(b.actor.match.ruleProfileId,source.officialPolicy);
  for(const kind of ['appeal','review','challenge'] as const){if(!profile.officialWindows?.[kind])return pending('official_window_policy_unconfigured:'+kind);
    if(kind!=='appeal'&&profile.officialWindows[kind]!.available)return pending('owned_'+kind+'_decision_required');}
  const instructionIds=[source.official.assignment.sourceId,source.official.call.sourceId,...source.official.events.map(e=>e.sourceId)];
  for(const id of instructionIds){for(const table of Object.keys(samePaLifecycleSchema)){
    const conflicts=db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json',['official','sourceId'],'$id')} OR ${claim('source_json',['official','assignment','sourceId'],'$id')}
      OR ${claim('source_json',['official','call','sourceId'],'$id')} OR ${claim('source_json',['official','events',{array:'all'},'sourceId'],'$id')}
      OR ${claim('snapshot_json',['source','official','sourceId'],'$id')} OR ${claim('snapshot_json',['source','official','assignment','sourceId'],'$id')} OR ${claim('snapshot_json',['source','official','call','sourceId'],'$id')}
      OR ${claim('snapshot_json',['source','official','events',{array:'all'},'sourceId'],'$id')}`).all({id});
    if(conflicts.some(r=>table!==tables.outcome||r.source_id!==source.sourceId))throw new Error('original official instruction Source already has another owner');
  }}
  const a=source.official.assignment,call=source.official.call;if(a.gameId!==b.view.lineage.gameId||a.playId!==b.view.lineage.playId||a.physicalPitchSourceId!==c.physicalPitchReference.sourceId
    ||call.assignmentSourceId!==a.sourceId||!a.officialIds.includes(call.officialId)||call.judgment!==(source.kind==='untouched_foul'?'foul':'count_result'))throw new Error('lifecycle original official assignment or call differs');
  const advancement=context?.kind==='walk'?resolveWalkForcedAdvancement({bases:b.actor.match.bases,batterRunnerId:b.actor.binding.playerId}):null;
  const ruling={outsAfter:b.actor.match.outs+(context?.kind==='strikeout'?1:0),basesAfter:advancement?.bases??b.actor.match.bases,scoredRunnerIds:advancement?.scoredRunnerIds??[]};
  let ledger=createPlayAdjudicationLedger({playId:b.view.lineage.playId,ruleProfileId:profile.id,playEnd:physicalEnd}),tick=completed;
  const snapshotId=source.sourceId+':rule';ledger=recordCorrectRuleSnapshot(ledger,ledger.revision,{eventId:snapshotId,tick,snapshotId,evidenceRevision:c.pitchOrdinal,ruling});
  for(const kind of ['appeal','review','challenge'] as const)if(profile.officialWindows![kind]!.available)ledger=openRuleProfileOfficialStateWindow(ledger,ledger.revision,{profile,eventId:source.sourceId+':'+kind,tick,windowId:source.sourceId+':'+kind,windowKind:kind});
  ledger=recordOnFieldCall(ledger,ledger.revision,{eventId:call.sourceId,callId:call.sourceId,tick,basisSnapshotId:snapshotId,basisEvidenceRevision:c.pitchOrdinal,ruling});
  let fenced=false;
  for(const event of source.official.events){if(event.schedulerId!==a.schedulerId||fenced)throw new Error('lifecycle official scheduler or closed journal differs');
    if(event.kind==='advance_tick'){if(tick===Number.MAX_SAFE_INTEGER)throw new Error('lifecycle official clock overflow');tick++;}
    else{try{ledger=advanceRuleProfileOfficialWindows(ledger,ledger.revision,{profile,boundary:'next_play_fence',tick,eventIdPrefix:event.sourceId,inningEnding:ruling.outsAfter===3});}
      catch(error){if(error instanceof Error&&['official-state window remains open under RuleProfile','same-tick appeal boundary is unresolved'].includes(error.message))return pending(error.message);throw error;}
      if(getOfficialStateWindows(ledger).some(w=>w.closedAtTick===null))return pending('official_window_open');ledger=closeOfficialPlay(ledger,ledger.revision,{eventId:event.sourceId+':close',closureId:event.sourceId+':closure',tick});fenced=true;}}
  if(!fenced)return pending('official_next_pitch_fence_required');
  const baseCenters=c.bodyCut.worldReference.owner==='pa_lifecycle_v1_resets'?readSamePaLifecycleResetFromSqlite(db,{...c.bodyCut.worldReference,owner:'pa_lifecycle_v1_resets'}).source.worldSetup.baseCenters:samePaStartingBaseCenters(db,b.actor);
  return freeze({kind:'same_pa_lifecycle_outcome',source,lineage:b.view.lineage,actor:b.actor,disposition:terminal?'terminal':'ordinary_foul',timeline,evaluationTick:tick,physicalCompletedAtTick:completed,
    physicalEnd,physicalProofHash:hash(proof),officialLedger:ledger,context,controllerRetirementBasis:samePaOutcomeRetirement(b,commands,completed),baseCenters});
};
const reset=(db:DatabaseSync,source:AcceptedSamePaLifecycleReset,current:boolean):SamePaLifecycleReset|Pending=>{
  const b=(current?readCurrentSamePaLifecycleViewFromSqlite:readHistoricalSamePaLifecycleViewFromSqlite)(db,source.viewReference),out=readSamePaLifecycleOutcomeFromSqlite(db,source.outcomeReference);
  same(source.enrollmentReference,b.view.lineage.enrollmentReference);same(out.lineage,b.view.lineage);same(b.view.cut.outcomeReference,source.outcomeReference);
  if(out.disposition!=='ordinary_foul'||b.view.cut.stage!=='foul_official_pending'||out.timeline.status.kind!=='active')return pending('owned_ordinary_foul_handoff_required');
  if(source.nextStartedAtTick<out.evaluationTick||source.nextStartedAtTick<b.view.cut.evaluationTick)throw new Error('foul reset backdates actual physical/official cut');
  same(source.worldSetup.baseCenters,out.baseCenters);
  same(source.worldSetup.defenders.map(d=>({playerId:d.playerId,registeredPosition:d.registeredPosition})).sort((a,b)=>a.playerId.localeCompare(b.playerId)),b.actor.world.defenders.map(d=>({playerId:d.playerId,registeredPosition:d.registeredPosition})).sort((a,b)=>a.playerId.localeCompare(b.playerId)));
  const match={...b.actor.match,balls:out.timeline.status.count.balls,strikes:out.timeline.status.count.strikes},resetWorld=prepareBetweenPlayWorld(match,source.nextStartedAtTick,source.worldSetup);
  // Empty controller IDs are syntax only. This retirement retains every actual
  // old command and future extent derived from the complete physical endpoint.
  const retirementRecord={kind:'same_pa_episode_controllers_retired_v1' as const,atTick:source.nextStartedAtTick,basis:out.controllerRetirementBasis};
  return freeze({kind:'same_pa_lifecycle_reset',source,lineage:b.view.lineage,timeline:out.timeline,resetWorld,retirement:retirementRecord});
};
const read=(db:DatabaseSync,kind:Kind,id:string):Value|null=>withSamePaLifecycleReadPhase(db,()=>{
  const r=row(db,kind,id);if(!r)return null;const s=input(JSON.parse(String(r.source_json)),id);
  if((s.capability==='same_pa_lifecycle_outcome_v1'?'outcome':'reset')!==kind)throw new Error('lifecycle closure owner differs');const value=s.capability==='same_pa_lifecycle_outcome_v1'?outcome(db,s,false):reset(db,s,false);
  if(value.kind==='pending')throw new Error('accepted lifecycle closure lost prerequisite');same(r,rowFor(value));return value;
});
export const readSamePaLifecycleOutcomeFromSqlite=(db:DatabaseSync,ref:SamePaReference<'pa_lifecycle_v1_outcomes'>):SamePaLifecycleOutcome=>{
  if(!samePaReferenceValid(ref,tables.outcome))throw new Error('invalid lifecycle outcome reference');const v=read(db,'outcome',ref.sourceId);if(!v||v.kind!=='same_pa_lifecycle_outcome')throw new Error('lifecycle outcome missing');same(reference(tables.outcome,v),ref);return v;
};
export const readSamePaLifecycleResetFromSqlite=(db:DatabaseSync,ref:SamePaReference<'pa_lifecycle_v1_resets'>):SamePaLifecycleReset=>{
  if(!samePaReferenceValid(ref,tables.reset))throw new Error('invalid lifecycle reset reference');const v=read(db,'reset',ref.sourceId);if(!v||v.kind!=='same_pa_lifecycle_reset')throw new Error('lifecycle reset missing');same(reference(tables.reset,v),ref);return v;
};
export const openSqliteSamePlateAppearanceLifecycleOutcomeStore=(path:string,authority?:Readonly<{readAcceptedOutcome?(id:string):unknown;readAcceptedReset?(id:string):unknown}>)=>{
  if(!samePaText(path))throw new Error('invalid lifecycle closure owner');const{DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path),tx=battingInvocationTransaction(db,()=>assertSamePaLifecycleStorage(db));
  const rows=()=>assertSamePaLifecycleStorage(db)?Object.keys(samePaLifecycleSchema).map(t=>db.prepare('SELECT * FROM main.'+t+' ORDER BY rowid').all()):[];
  const accept=(kind:Kind,id:string):Value|Pending=>{if(!samePaText(id))throw new Error('invalid lifecycle closure identity');const raw=(kind==='outcome'?authority?.readAcceptedOutcome:authority?.readAcceptedReset)?.(id)??null,s=raw===null?null:input(raw,id);
    if(s&&(s.capability==='same_pa_lifecycle_outcome_v1'?'outcome':'reset')!==kind)throw new Error('lifecycle closure Source domain differs');
    const prior=tx.run(false,proof=>proof(()=>read(db,kind,id)),()=>{});if(prior){if(s)same(prior.source,s);return prior;}if(!s)return pending('accepted_'+kind+'_source_missing');
    const derive=()=>s.capability==='same_pa_lifecycle_outcome_v1'?outcome(db,s,true):reset(db,s,true);
    const before=tx.run(false,proof=>proof(()=>({value:derive(),rows:rows()})),()=>{});if(before.value.kind==='pending')return before.value;
    const v=before.value,r=rowFor(v),names=Object.keys(samePaLifecycleSchema),expected=before.rows.map(a=>[...a]);if(!expected.length)throw new Error('lifecycle prefix namespace missing');expected[names.indexOf(tables[kind])].push(r);
    const finalProof=()=>{const b=readHistoricalSamePaLifecycleViewFromSqlite(db,s.viewReference),prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',b.view.source.prefixReference.sourceId);if(!prefix||prefix.kind!=='same_pa_lifecycle_prefix')throw new Error('lifecycle prior complete prefix missing');
      assertSamePaLifecycleReservedStateFromSqlite(db,b);assertSamePaLifecycleWorkCoverage(db,s.enrollmentReference,prefix.source.anchorViewReference,[...prefix.source.eventReferences,reference(tables[kind],v)]);same(read(db,kind,id),v);same(rows(),expected);};
    return tx.run(true,(proof,step)=>{same(proof(()=>({value:derive(),rows:rows()})),before);
      const unique=kind==='outcome'?['enrollment_source_id','physical_pitch_source_id']:['enrollment_source_id','outcome_source_id'];
      if(db.prepare('SELECT 1 FROM main.'+tables[kind]+' WHERE '+unique.map(k=>k+'=?').join(' AND ')).get(...unique.map(k=>r[k])))throw new Error('lifecycle canonical closure alias rejected');
      step(()=>{const result=db.prepare('INSERT INTO main.'+tables[kind]+' VALUES('+Object.keys(r).map(()=>'?').join(',')+')').run(...Object.values(r));if(result.changes!==1)throw new Error('lifecycle closure row delta differs');},1);
      proof(finalProof);return v;},value=>{same(value,v);finalProof();});};
  return Object.freeze({acceptOutcome:(id:string)=>accept('outcome',id),acceptReset:(id:string)=>accept('reset',id),readOutcome:(id:string)=>tx.run(false,proof=>proof(()=>read(db,'outcome',id)),()=>{}),readReset:(id:string)=>tx.run(false,proof=>proof(()=>read(db,'reset',id)),()=>{}),close:tx.close});
};
