import type { DatabaseSync } from 'node:sqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, memoSamePaLifecycleRead, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaSuccessorTakePitchFromSqlite } from './SamePlateAppearanceTakeSuccessorFromSqlite';
import { readSamePaContinuationOriginalPitchFromSqlite } from './SamePlateAppearanceContinuationFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { samePaPhysicalOperationOwners, type SamePaPhysicalOperationReference, type SamePaPhysicalOperation } from './SamePlateAppearancePhysicalEpisode';
import { readSamePaRestartPlaysFromSqlite } from './SqliteSamePlateAppearanceRestartPlayStore';
import { bindSamePaRestartPlayToPitch } from './SamePlateAppearanceRestartPlayProof';
import { samePaRestartPlayTable } from './SamePlateAppearanceRestartPlaySource';
import type { SamePaPhysicalRight } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleWorkReference } from './SamePlateAppearanceLifecycle';
const same = (a: unknown,b: unknown) => { if (json(a)!==json(b)) throw new Error('initial live continuation original transition differs'); };
const pending = (reason: string) => freeze({kind:'pending' as const,reason});
/** A narrow supported transition language. Existing owners supply actual
 * records, complete ordering and retained TAKE/body cuts, never a new hand curve. */
export const samePaInitialLiveTransitionBoundary = (currentPitchSourceId: string,
  transitions: readonly Readonly<{ reference: SamePaLifecycleWorkReference; physical: SamePaPhysicalOperation | null; livePitchSourceId?: string }>[]) => {
  let previousTaken = true, selected = false;
  for (const {reference:ref,physical,livePitchSourceId} of transitions) {
    if (ref.owner === 'pa_lifecycle_v1_outcomes' || ref.owner === 'pa_lifecycle_v1_resets') return 'initial_live_continuation_after_official_outcome_requires_original_restart';
    if (ref.owner === 'pa_live_ball_v1_actions' && livePitchSourceId !== currentPitchSourceId)
      return 'initial_live_continuation_after_prior_play_or_time_requires_original_restart';
    if (!physical) continue;
    if (physical.kind === 'same_pa_physical_launch_v1') {
      if (!previousTaken || selected) return 'initial_live_continuation_requires_completed_taken_predecessor';
      previousTaken = false; selected = physical.source.sourceId === currentPitchSourceId;
    } else if (!selected && physical.kind === 'same_pa_physical_resolution_v1') {
      if (physical.resolution.kind !== 'recorded_take' || physical.timeline.status.kind !== 'active')
        return 'initial_live_continuation_requires_nonterminal_taken_predecessor';
      previousTaken = true;
    } else if (!selected && (physical.kind === 'same_pa_physical_field_root_v1' || physical.kind === 'same_pa_physical_field_step_v1'))
      return 'initial_live_continuation_after_prior_field_requires_original_restart';
  }
  return selected ? null : 'initial_live_continuation_current_launch_missing';
};

/** The accepted first Play carries through the already authoritative bounded
 * stationary TAKE continuation. A foul/reset/prior field excursion is a separate
 * restart obligation; a later Play cannot be projected backwards through it. */
export const readSamePaInitialLiveContinuationFromSqlite = (db: DatabaseSync,
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>, mode: 'current' | 'historical') => withSamePaLifecycleReadPhase(db,() =>
  memoSamePaLifecycleRead(db,'initial_live_continuation:'+json([viewReference,mode]),() => {
  if (!['current','historical'].includes(mode)) throw new Error('invalid initial live continuation mode');
  const b=(mode==='current'?readCurrentSamePaLifecycleViewFromSqlite:readHistoricalSamePaLifecycleViewFromSqlite)(db,viewReference);
  const prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',b.view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind!=='same_pa_lifecycle_prefix') throw new Error('initial live continuation complete prefix missing');
  same(reference('pa_lifecycle_v1_work_prefixes',prefix),b.view.source.prefixReference);
  const firstRef=prefix.source.eventReferences[0];
  if (firstRef.owner!=='pa_take_successor_v1_pitch_actions') throw new Error('initial live continuation second TAKE anchor missing');
  const second=readSamePaSuccessorTakePitchFromSqlite(db,{...firstRef,owner:'pa_take_successor_v1_pitch_actions'});
  const original=readSamePaContinuationOriginalPitchFromSqlite(db,second.pitch.previousPitchReference), first=original.pitch;
  const binding=first.initialLiveBallBinding;
  same(first.lineage,b.view.lineage); same(second.pitch.lineage,b.view.lineage);
  const resetReferences=prefix.source.eventReferences.filter(ref=>ref.owner==='pa_lifecycle_v1_resets').map(ref=>({...ref,owner:'pa_lifecycle_v1_resets' as const}));
  const plays=readSamePaRestartPlaysFromSqlite(db,b.view.lineage.enrollmentReference,resetReferences);
  // Preserve old archive hashes until an explicit new restart owner exists.
  if(!binding&&!plays.length)return null;
  if ([first,second.pitch].some(p=>p.result.resolution.kind!=='recorded' || p.result.resolution.physical.kind!=='taken'
    || p.result.resolution.timeline.status.kind!=='active')) return pending('initial_live_continuation_requires_two_original_nonterminal_takes');
  if (b.view.cut.physicalPitchReference.owner!=='pa_physical_v1_launches' || b.view.cut.stage!=='field_active')
    return pending('initial_live_continuation_current_field_required');
  const currentPitch=b.view.cut.physicalPitchReference;
  const transitions=prefix.source.eventReferences.slice(1).map(ref => {
    if (samePaPhysicalOperationOwners.some(owner=>owner===ref.owner)) {
      const proof=readSamePaPhysicalOperationFromSqlite(db,ref as SamePaPhysicalOperationReference); same(proof.lineage,b.view.lineage);
      return {reference:ref,physical:proof.record};
    }
    // The lifecycle reader has already authenticated these complete journal
    // entries. Only their physical-pitch identity is needed for this boundary.
    const livePitchSourceId=ref.owner==='pa_live_ball_v1_actions'
      ? String(db.prepare('SELECT physical_pitch_source_id FROM main.pa_live_ball_v1_actions WHERE source_id=?').get(ref.sourceId)?.physical_pitch_source_id) : undefined;
    return {reference:ref,physical:null,...(livePitchSourceId===undefined?{}:{livePitchSourceId})};
  });
  // A restart establishes a new known live interval even when the old first
  // pitch archive predates initial Play. It never rewrites that earlier history.
  const resetIndex=prefix.source.eventReferences.reduce((latest,ref,index)=>ref.owner==='pa_lifecycle_v1_resets'?index:latest,-1);
  if(resetIndex>=0){
    const resetReference=prefix.source.eventReferences[resetIndex];
    const candidates=plays.filter(play=>json(play.resetReference)===json(resetReference));
    if(candidates.length>1)throw new Error('initial live continuation duplicate restart Play');
    const play=candidates[0];if(!play)return pending('initial_live_continuation_after_official_outcome_requires_original_restart');
    same(play.lineage,b.view.lineage);
    const tail=transitions.slice(resetIndex),unsupported=samePaInitialLiveTransitionBoundary(currentPitch.sourceId,tail);
    if(unsupported)return pending(unsupported);
    const firstLaunch=tail.find(t=>t.physical?.kind==='same_pa_physical_launch_v1')?.physical;
    if(!firstLaunch||firstLaunch.kind!=='same_pa_physical_launch_v1')return pending('restart_live_continuation_actual_launch_missing');
    const restartPrefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',play.prefixReference.sourceId);
    if(!restartPrefix||restartPrefix.kind!=='same_pa_lifecycle_prefix')throw new Error('restart live continuation original complete prefix missing');
    same(reference('pa_lifecycle_v1_work_prefixes',restartPrefix),play.prefixReference);
    same(restartPrefix.source.eventReferences,prefix.source.eventReferences.slice(0,resetIndex+1));
    // The physical launch reader above has already re-derived this owned right.
    // Keep the exact action/posture binding rather than trusting only pitch ID.
    const rightRow=db.prepare('SELECT snapshot_json FROM main.pa_physical_v1_rights WHERE source_id=?').get(firstLaunch.source.rightReference.sourceId);
    if(!rightRow)throw new Error('restart live continuation original launch right missing');
    const right=JSON.parse(String(rightRow.snapshot_json)) as SamePaPhysicalRight;
    const restartBinding=bindSamePaRestartPlayToPitch(play,firstLaunch,right);
    const value={kind:'same_pa_restart_live_continuation_v1' as const,lineage:b.view.lineage,viewReference,restartBinding,
      playReference:restartBinding.playReference,playDeclaration:restartBinding.playDeclaration,occurredAt:restartBinding.occurredAt,physicalPitchReference:currentPitch,
      physicalOperationReference:b.view.cut.physicalOperationReference,coveredThroughTick:b.view.cut.evaluationTick,
      prefixReference:b.view.source.prefixReference,prefixCoverageHash:prefix.coverageHash,
      transitionReferences:[second.pitch.previousPitchReference,reference('pa_take_successor_v1_action_plans',second.action),
        reference('pa_take_successor_v1_setups',second.setup),...prefix.source.eventReferences],
      restartReferences:plays.filter(p=>prefix.source.eventReferences.some(r=>json(r)===json(p.resetReference))).map(p=>reference(samePaRestartPlayTable,p))};
    return freeze({...value,continuationReference:{owner:value.kind,sourceId:prefix.source.sourceId,sourceVersion:prefix.source.sourceVersion,
      sourceHash:hash(prefix.source),snapshotHash:hash(value)}});
  }
  if(!binding)return null;
  const unsupported=samePaInitialLiveTransitionBoundary(currentPitch.sourceId,transitions); if (unsupported) return pending(unsupported);
  const value={kind:'same_pa_initial_live_continuation_v1' as const,lineage:b.view.lineage,viewReference,initialBinding:binding,
    playReference:binding.playReference,occurredAt:binding.occurredAt,physicalPitchReference:currentPitch,
    physicalOperationReference:b.view.cut.physicalOperationReference,coveredThroughTick:b.view.cut.evaluationTick,
    prefixReference:b.view.source.prefixReference,prefixCoverageHash:prefix.coverageHash,
    transitionReferences:[second.pitch.previousPitchReference,reference('pa_take_successor_v1_action_plans',second.action),
      reference('pa_take_successor_v1_setups',second.setup),...prefix.source.eventReferences],
    retainedTakeCompletion:{first:second.action.bodyCut.completedAtTick,second:Math.max(second.pitch.result.resolution.timeline.lastEventTick,second.pitch.result.delivery.timeline.followThroughEndUs)}};
  return freeze({...value,continuationReference:{owner:value.kind,sourceId:prefix.source.sourceId,sourceVersion:prefix.source.sourceVersion,
    sourceHash:hash(prefix.source),snapshotHash:hash(value)}});
}));
