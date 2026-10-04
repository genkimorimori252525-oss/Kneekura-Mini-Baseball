import type { OwnedMotionComposition, OwnedMotionAdoption } from './OwnedBattedWorldMotion';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Read-only projection of one rederived physical adoption. This is partial source-local
 * work, with no queue coverage, actor disposition, global settlement or rule consumption. */
export const ownedMotionLiveWork = (composition: OwnedMotionComposition, adoption: OwnedMotionAdoption) => {
  if (adoption.compositionHash !== hash(composition) || adoption.physicalPitchSourceId !== composition.physicalPitchSourceId
    || adoption.executedThrough.originTick !== composition.at.originTick
    || adoption.executedThrough.elapsedSeconds < composition.at.elapsedSeconds
    || adoption.executedThrough.elapsedSeconds > (composition.coverageThroughTick - composition.at.originTick) / composition.ticksPerSecond) {
    throw new Error('owned motion live-work adoption scope differs');
  }
  // Reaching a pinned deadline does not consume the decision owner's revision.
  // Compare exact instants: a contact just before the deadline may share its tick.
  const pendingDecisionHandoffs = composition.knownWork.flatMap(w => {
    if (w.dueTick === null || w.decisionSourceId === null
      || w.phase !== 'pending_decision' && w.phase !== 'pending_first_step') return [];
    const elapsedSeconds = (w.dueTick - composition.at.originTick) / composition.ticksPerSecond;
    if (elapsedSeconds > adoption.executedThrough.elapsedSeconds) return [];
    return [{ owner: 'actual_defensive_decisions' as const, playerId: w.playerId, decisionSourceId: w.decisionSourceId,
      handoffId: json(['owned_motion_decision_handoff_v1', composition.physicalPitchSourceId, w.playerId,
        'actual_defensive_decisions', w.decisionSourceId, 'batted_world_field_executions', adoption.executionSourceId, adoption.executionRevision]),
      kind: w.phase === 'pending_decision' ? 'decision_revision' as const : 'first_step_revision' as const,
      status: 'pending' as const, dueAt: { originTick: composition.at.originTick, elapsedSeconds, tick: w.dueTick } }];
  });
  const unresolvedContact = adoption.physicalBoundary?.cursorAvailable === false;
  const coverageExhausted = adoption.executedThrough.elapsedSeconds
    === (composition.coverageThroughTick - composition.at.originTick) / composition.ticksPerSecond;
  const contributors = composition.contributors.map(c => {
    const consumed = adoption.contributors.find(a => a.playerId === c.playerId);
    if (!consumed) throw new Error('owned motion live-work contributor is missing');
    const known = composition.knownWork.find(w => w.playerId === c.playerId)!;
    return { playerId: c.playerId,
      workId: json(['owned_motion_physical_work_v1', composition.physicalPitchSourceId, c.playerId,
        'batted_world_field_executions', adoption.executionSourceId, adoption.executionRevision]),
      status: unresolvedContact ? 'physical_contact_handoff' as const
        : pendingDecisionHandoffs.some(h => h.playerId === c.playerId) ? 'decision_revision_handoff' as const
        : coverageExhausted ? 'controller_coverage_handoff' as const : 'admitted_physical_coverage' as const,
      actualExecutedThrough: adoption.executedThrough, acceptedThroughTick: composition.coverageThroughTick,
      rootAuthority: c.rootAuthority, roleAuthorities: c.roleAuthorities,
      motorAdoption: consumed.motorAdoptionEventId === null ? null : { status: 'adopted' as const,
        motorSourceId: consumed.motorSourceId!, eventId: consumed.motorAdoptionEventId, at: adoption.adoptedAt },
      knownWork: known,
      unexecutedTail: adoption.executedThrough.elapsedSeconds < (composition.coverageThroughTick - composition.at.originTick) / composition.ticksPerSecond
        ? { after: adoption.executedThrough, throughTick: composition.coverageThroughTick, status: 'not_executed' as const } : null };
  });
  return freeze({ version: 'owned_motion_live_work_v1' as const, executionSourceId: adoption.executionSourceId,
    executionRevision: adoption.executionRevision, physicalPitchSourceId: composition.physicalPitchSourceId,
    at: adoption.executedThrough, sourceCoverage: 'explicit_known_sources_only' as const, queue: null,
    contributors, pendingDecisionHandoffs, unresolvedSuccessor: unresolvedContact ? 'physical_contact_owner' as const
      : pendingDecisionHandoffs.length ? 'actual_defensive_decision_owner' as const
      : coverageExhausted ? 'next_owned_controller_command' as const
      : adoption.physicalBoundary !== null ? 'next_owned_physical_checkpoint' as const : null });
};
export type OwnedMotionLiveWork = ReturnType<typeof ownedMotionLiveWork>;
