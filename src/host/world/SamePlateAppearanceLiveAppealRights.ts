import type { OwnedLiveAppealRightsEvidence, OwnedLiveCallSourceReference } from '../../core/adjudication/PlayAdjudicationLedger';
import type { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import type { readSamePaLiveBallHistoryFromSqlite } from './SamePlateAppearanceLiveBallStateFromSqlite';
import type { readSamePaVenueLegalCoverageFromPair } from './SamePlateAppearanceVenueLegalCoverage';
import type { SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { deriveSamePaOrdinaryPlayAttempts } from './SamePlateAppearanceOrdinaryPlay';
import { deriveSamePaDefenderDepartureEvidence } from './SamePlateAppearanceDefenderDeparture';

type Pair = Extract<ReturnType<typeof readSamePaFieldRuleEvidenceWithInputsFromSqlite>, {kind:'same_pa_field_rule_read_pair_v1'}>;
type History = ReturnType<typeof readSamePaLiveBallHistoryFromSqlite>;
type Venue = Extract<ReturnType<typeof readSamePaVenueLegalCoverageFromPair>, {kind:'same_pa_venue_legal_coverage_v1'}>;
const pending = (reason:string) => freeze({kind:'pending' as const,reason});
const same = (a:unknown,b:unknown) => { if(json(a)!==json(b)) throw new Error('live appeal rights original physical or legal cut differs'); };
const actionRef = (action:History['actions'][number]):OwnedLiveCallSourceReference => ({...reference('pa_live_ball_v1_actions',action),sourceVersion:action.source.sourceVersion});
export const samePaVenueRightsReference = (venue:Venue):OwnedLiveCallSourceReference => ({owner:venue.kind,
  sourceId:venue.policyReference.sourceId,sourceVersion:venue.policyReference.sourceVersion,
  sourceHash:venue.policyReference.policyHash,snapshotHash:hash(venue)});

/** Only authenticated current-cut facts enter this projection. Complete absence
 * of a declaration is unknown, and a later Play never fills an earlier interval.
 * Interior containment is sufficient positive evidence; unresolved boundaries
 * remain an explicit obligation, including carried-ball entry semantics. */
export const deriveSamePaLiveAppealRights = (pair:Pair,history:History,venue:Venue,receipt:SamePaPhysicalFieldStep) => {
  const result=receipt.actionResult;
  if(result?.kind!=='appeal_contact_v1' || result.execution.kind!=='executed' || receipt.source.action?.kind!=='appeal_contact_v1')
    throw new Error('live appeal rights require the original executed contact');
  const execution=result.execution, at=execution.moment, first=execution.complianceEvidence.firstTouch;
  same(history.viewReference,receipt.source.viewReference); same(history.lineage,pair.view.lineage);
  same(history.physicalPitchReference,pair.value.physicalPitchReference);
  same(history.physicalOperationReference,pair.value.physicalOperationReference);
  same(history.evaluatedThrough,at); same(pair.value.physicalOperationReference,receipt.source.previousFieldReference);
  same(venue.policyReference.throughReference,pair.value.physicalOperationReference);
  if(venue.input.originTick!==at.originTick || first.originTick!==at.originTick
    || pair.value.evidence.physical.field.evidence.horizon.elapsedSeconds!==at.elapsedSeconds)
    throw new Error('live appeal rights original clock differs');
  const venueReference=samePaVenueRightsReference(venue);
  const initial=history.initialLiveContinuation&&history.initialLiveContinuation.kind!=='pending' ? history.initialLiveContinuation : null;
  if(initial){
    same(initial.lineage,history.lineage); same(initial.physicalPitchReference,history.physicalPitchReference);
    same(initial.physicalOperationReference,history.physicalOperationReference);
    if(initial.occurredAt.elapsedSeconds!==0 || initial.occurredAt.tick!==initial.occurredAt.originTick
      || initial.occurredAt.tick>at.originTick || initial.coveredThroughTick!==at.tick)
      throw new Error('initial live continuation original clock differs');
  }
  const legalStateReference:OwnedLiveCallSourceReference={owner:history.kind,sourceId:pair.view.source.sourceId,
    sourceVersion:pair.view.source.sourceVersion,sourceHash:hash(pair.view.source),snapshotHash:hash(history)};
  const certainFreeDead = (from:number,through:number) => venue.coverage.intervals.flatMap((interval,index)=>{
    if(venue.fieldSegments[index].constraint!=='free') return [];
    return [[interval.startElapsedSeconds,interval.start],[interval.endElapsedSeconds,interval.end]] as const;
  }).filter(([time,point])=>time>from && time<=through && point.classification==='out_of_play')
    .sort((a,b)=>a[0]-b[0])[0]?.[0];
  const stateAt=(through:number):OwnedLiveAppealRightsEvidence['liveAtExecution']=>{
    const actions=history.actions.filter(a=>a.occurredAt.elapsedSeconds<=through), latest=actions.at(-1);
    // Same-time declarations and physical events have no independent exact order.
    if(latest?.occurredAt.elapsedSeconds===through) return {kind:'unknown',reason:'original_live_ball_coverage_required'};
    if(latest?.state==='dead') return {kind:'dead',cause:actionRef(latest),at:latest.occurredAt};
    const start=latest?.occurredAt.elapsedSeconds ?? -1, dead=certainFreeDead(start,through);
    if(dead!==undefined) return {kind:'dead',cause:venueReference,at:{originTick:at.originTick,elapsedSeconds:dead,
      tick:quantizeEventTick(venue.input.originTick,dead,venue.input.ticksPerSecond)}};
    if(!latest&&!initial) return {kind:'unknown',reason:'initial_live_ball_owner_missing'};
    const spans=venue.coverage.intervals.filter(i=>i.endElapsedSeconds>start && i.startElapsedSeconds<through);
    const carrier=venue.carrierCoverage.flatMap(c=>c.coverage.intervals).filter(i=>i.endElapsedSeconds>start && i.startElapsedSeconds<through);
    if(!spans.length || !latest&&initial&&spans[0].startElapsedSeconds!==0 || spans.some(i=>i.classification!=='inside_playable_region')
      || carrier.some(i=>i.classification!=='inside_playable_region')
      || venue.unresolvedCarrierSpans.some(s=>s.endElapsedSeconds>start&&s.startElapsedSeconds<through))
      return {kind:'unknown',reason:'original_live_ball_coverage_required'};
    return latest ? {kind:'live',playDeclaration:actionRef(latest),at:latest.occurredAt,coveredThroughElapsedSeconds:through}
      : {kind:'live',playDeclaration:initial!.kind==='same_pa_initial_live_continuation_v1'
        ? initial!.initialBinding.playDeclaration : initial!.playDeclaration,at:initial!.occurredAt,
        coveredThroughElapsedSeconds:through,initialContinuation:initial!.continuationReference};
  };
  const ownedRef=(ref:Venue['appealThrows'][number]['planReference']):OwnedLiveCallSourceReference=>{
    const field=pair.fields.find(f=>f.source.sourceId===ref.sourceId);
    if(!field) throw new Error('live appeal rights original purpose Source missing');
    const original=reference(field.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',field);
    same(original,ref); return {...original,sourceVersion:field.source.sourceVersion};
  };
  const forfeitures:OwnedLiveAppealRightsEvidence['appealThrowForfeitures'][number][]=[];
  let unresolvedThrow=false;
  for(const thrown of venue.appealThrows){
    if(!thrown.release || !thrown.coverage) continue;
    const releasedAt=thrown.release.moment.elapsedSeconds, releaseState=stateAt(releasedAt);
    if(releaseState.kind==='dead') continue;
    // An unsuccessful glove constraint does not end the original throw's
    // purpose. Only unheld intervals can supply its certain dead-ball point.
    const dead=thrown.coverage.intervals.flatMap((interval,index)=>index===0
      || venue.fieldSegments[thrown.segmentIndexes[index-1]].constraint==='free'
      ? [[interval.startElapsedSeconds,interval.start],[interval.endElapsedSeconds,interval.end]] as const : [])
      .filter(([time,point])=>time>releasedAt&&point.classification==='out_of_play').sort((a,b)=>a[0]-b[0])[0]?.[0];
    const timeBeforeDead=dead===undefined ? undefined : history.actions.find(a=>a.state==='dead'
      && a.occurredAt.elapsedSeconds>releasedAt&&a.occurredAt.elapsedSeconds<=dead);
    if(timeBeforeDead){
      const stoppedAt=timeBeforeDead.occurredAt.elapsedSeconds;
      const beforeTime=thrown.coverage.intervals.filter(i=>i.endElapsedSeconds>releasedAt&&i.startElapsedSeconds<stoppedAt);
      // An actual Time cuts off this live throw. Geometry reached only later
      // cannot attribute dead ball to the throw. Incomplete earlier coverage or
      // equal occurrence still cannot establish which cause came first.
      if(stoppedAt===dead || !beforeTime.length || beforeTime.at(-1)!.endElapsedSeconds!==stoppedAt
        || beforeTime.some(i=>i.classification!=='inside_playable_region')) unresolvedThrow=true;
      continue;
    }
    if(dead!==undefined && dead<at.elapsedSeconds && releaseState.kind==='live'){
      forfeitures.push({indication:ownedRef(thrown.indicationReference),throwPlan:ownedRef(thrown.planReference),
        legalCoverage:venueReference,firstCertainDeadAtElapsedSeconds:dead});
    }else if(dead!==undefined || thrown.coverage.kind==='pending' || releaseState.kind==='unknown') unresolvedThrow=true;
  }
  forfeitures.sort((a,b)=>a.firstCertainDeadAtElapsedSeconds-b.firstCertainDeadAtElapsedSeconds);
  const live=stateAt(at.elapsedSeconds), firstLive=stateAt(first.elapsedSeconds),
    unresolvedWindow={kind:'unresolved' as const,reason:'original_live_appeal_window_owner_required' as const};
  let window:OwnedLiveAppealRightsEvidence['window']=unresolvedWindow;
  // A completed fly catch opens this supported early-departure opportunity.
  // Actual ordinary-play release owns attempted play only with explicit prior
  // purpose and proved live state. An unclassified throw retains its obligation.
  const catchMoment=pair.value.evidence.physical.field.evidence.acquisitions.find(a=>a.kind==='secured')?.moment;
  const nonAppealThrow=pair.fields.some(f=>f.kind==='same_pa_physical_field_step_v1'
    && f.actionResult?.kind==='throw_plan_v1'&&!f.actionResult.appealIndicationReference&&!f.actionResult.ordinaryPlayPurpose);
  const hasOrdinaryPurpose=pair.fields.some(f=>f.kind==='same_pa_physical_field_step_v1'
    && (f.actionResult?.kind==='throw_plan_v1'&&f.actionResult.ordinaryPlayPurpose
      || f.source.action?.kind==='throw_plan_v1'&&f.source.action.ordinaryPlayPurpose));
  const root=pair.fields[0];
  const ordinary=hasOrdinaryPurpose ? deriveSamePaOrdinaryPlayAttempts(pair.fields,{actor:pair.actor,physicalPitchSourceId:root.physicalPitchSourceId}) : [];
  const ordinaryStates=catchMoment ? ordinary.filter(play=>play.moment.elapsedSeconds>=catchMoment.elapsedSeconds)
    .map(play=>({play,state:stateAt(play.moment.elapsedSeconds),atOpening:play.moment.elapsedSeconds===catchMoment.elapsedSeconds})) : [];
  const closingPlay=ordinaryStates.find(value=>!value.atOpening&&value.state.kind==='live')?.play;
  const unresolvedOrdinaryPlay=ordinaryStates.some(value=>value.state.kind==='unknown');
  const unresolvedOrdinaryOrder=ordinaryStates.some(value=>value.atOpening);
  if(catchMoment && pair.actor.match.outs<2 && !nonAppealThrow)
    window={openedAtElapsedSeconds:catchMoment.elapsedSeconds,closedAtElapsedSeconds:null,closeReason:null};
  if(catchMoment && closingPlay) window={openedAtElapsedSeconds:catchMoment.elapsedSeconds,
    closedAtElapsedSeconds:closingPlay.moment.elapsedSeconds,closeReason:'next_pitch_or_play'};
  const hasDeparturePurpose=pair.fields.some(f=>f.kind==='same_pa_physical_field_step_v1'
    && (f.source.action?.kind==='defender_departure_purpose_v1'||f.actionResult?.kind==='defender_departure_purpose_v1'));
  const departure=hasDeparturePurpose ? deriveSamePaDefenderDepartureEvidence(pair) : null;
  if(catchMoment && pair.actor.match.outs===2 && departure?.kind==='same_pa_defense_departure_bound_v1'
    && departure.closedNoLaterThan.elapsedSeconds>catchMoment.elapsedSeconds
    && firstLive.kind==='live' && !closingPlay) {
    window={kind:'closed_by',openedAtElapsedSeconds:catchMoment.elapsedSeconds,
      closedNoLaterThanElapsedSeconds:departure.closedNoLaterThan.elapsedSeconds,closeReason:'defense_left_field',
      evidenceReference:{...ownedRef(departure.fieldReference),owner:departure.kind,snapshotHash:hash(departure)}};
  }
  const expired='kind'in window ? window.kind==='closed_by'&&window.closedNoLaterThanElapsedSeconds<at.elapsedSeconds
    : window.closedAtElapsedSeconds!==null&&window.closedAtElapsedSeconds<at.elapsedSeconds;
  const negative=forfeitures.length>0 || live.kind==='dead'&&live.at.elapsedSeconds<at.elapsedSeconds || expired;
  if(!negative){
    if(live.kind!=='live') return pending(live.kind==='unknown'
      ? history.initialLiveContinuation?.kind==='pending'&&!history.actions.length ? history.initialLiveContinuation.reason : live.reason
      : 'original_live_ball_exact_order_required');
    if(firstLive.kind!=='live' || (firstLive.initialContinuation
      ? firstLive.at.tick===first.originTick&&first.elapsedSeconds===0 : firstLive.at.elapsedSeconds>=first.elapsedSeconds))
      return pending('original_live_state_before_first_fielder_touch_required');
    if(unresolvedThrow) return pending('original_complete_appeal_throw_rights_coverage_required');
    // Later Play cannot decide whether an earlier ordinary release occurred
    // while live. Retain that obligation unless another fact proves ineligible.
    // Equal catch/release occurrences also lack a proved window-closing order.
    if(unresolvedOrdinaryOrder) return pending('original_appeal_window_exact_order_required');
    if(unresolvedOrdinaryPlay) return pending('original_ordinary_play_live_state_required');
    if('kind'in window) return pending(nonAppealThrow?'original_nonappeal_play_rights_owner_required':'original_defense_departure_history_required');
    if(window.openedAtElapsedSeconds===at.elapsedSeconds) return pending('original_appeal_window_exact_order_required');
    if(window.closedAtElapsedSeconds===at.elapsedSeconds) return pending('original_appeal_window_exact_order_required');
  }
  // A real restart governs execution while the original earlier Play governs
  // first contact. Preserve both occurrences without claiming the Time interval
  // was live, and without creating an appeal-window or forfeiture event.
  const separateFirst=live.kind==='live'&&firstLive.kind==='live'
    && json(live.playDeclaration)!==json(firstLive.playDeclaration) ? firstLive : null;
  const evidence:OwnedLiveAppealRightsEvidence={version:separateFirst||'kind'in window&&window.kind==='closed_by'||live.kind==='live'&&live.initialContinuation
    ?'owned_live_appeal_rights_evidence_v2':'owned_live_appeal_rights_evidence_v1',
    liveAtExecution:live,...(separateFirst?{liveAtFirstTouch:separateFirst}:{}),window,appealThrowForfeitures:forfeitures};
  return freeze({kind:'ready' as const,evidence,legalStateReference,venueReference});
};
