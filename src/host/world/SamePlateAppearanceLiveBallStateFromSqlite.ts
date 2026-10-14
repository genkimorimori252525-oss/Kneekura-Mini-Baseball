import type { DatabaseSync } from 'node:sqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, memoSamePaLifecycleRead, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { deriveSamePaVenueLegalCoverageFromPair } from './SamePlateAppearanceVenueLegalCoverage';
import { readSamePaInitialLiveContinuationFromSqlite } from './SamePlateAppearanceInitialLiveContinuationFromSqlite';
import { assertNoSamePaCatchReviewSeal } from './SamePlateAppearanceCatchReviewSeal';
import { assertSamePaLiveBallStateStorage as storage } from './SamePlateAppearanceLiveBallStateStorage';
import { samePaLiveBallStateTable as table, samePaLiveBallActionInput, samePaLiveBallOriginalsInput,
  type AcceptedSamePaLiveBallAction, type SamePaLiveBallOriginals, type SamePaLiveBallStateReference } from './SamePlateAppearanceLiveBallStateSource';
import { deriveSamePaLiveBallPlayProof, deriveSamePaLiveBallPostPlayStatus, samePaLiveBallPending as pending,
  type SamePaLiveBallState, type SamePaLiveBallPending } from './SamePlateAppearanceLiveBallState';
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA live-ball original ownership or cut differs'); };
export const samePaLiveBallStateRow = (v: SamePaLiveBallState): Record<string, string | number> => ({
  source_id: v.source.sourceId, source_version: v.source.sourceVersion, career_id: v.lineage.careerId, game_id: v.lineage.gameId,
  play_id: v.lineage.playId, enrollment_source_id: v.lineage.enrollmentReference.sourceId, actor_source_id: v.lineage.actorReference.sourceId,
  first_pitch_source_id: v.lineage.firstPhysicalPitchSourceId, physical_pitch_source_id: v.physicalPitchReference.sourceId,
  physical_operation_identity: json(v.physicalOperationReference), assignment_source_id: v.originalInputs.assignment.sourceId,
  view_source_id: v.source.viewReference.sourceId, source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v),
});
const row = (db: DatabaseSync, id: string) => {
  if (!samePaText(id)) throw new Error('invalid live-ball action identity');
  const rows = storage(db) ? db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
    OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id }) : [];
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== id) throw new Error('live-ball action Source alias differs');
  return rows[0] ?? null;
};
const prefixFor = (db: DatabaseSync, view: ReturnType<typeof readHistoricalSamePaLifecycleViewFromSqlite>['view']) => {
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('live-ball original complete lifecycle prefix missing');
  same(reference('pa_lifecycle_v1_work_prefixes', prefix), view.source.prefixReference); return prefix;
};

/** All journal actions are authenticated, including other physical pitches.
 * A current view's existing lifecycle census rejects omitted or orphan work. */
export const readSamePaLiveBallHistoryFromSqlite = (db: DatabaseSync,
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>, mode: 'current' | 'historical') => withSamePaLifecycleReadPhase(db, () => {
  if (!samePaReferenceValid(viewReference, 'pa_lifecycle_v1_execution_views') || !['current', 'historical'].includes(mode))
    throw new Error('invalid live-ball history view request');
  storage(db);
  const b = (mode === 'current' ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, viewReference);
  const prefix = prefixFor(db, b.view), cut = b.view.cut;
  const all = prefix.source.eventReferences.filter(r => r.owner === table).map(r => readSamePaLiveBallStateFromSqlite(db, { ...r, owner: table }));
  for (const action of all) same(action.lineage, b.view.lineage);
  const actions = all.filter(a => json(a.physicalPitchReference) === json(cut.physicalPitchReference));
  const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, viewReference, mode);
  const at = pair.kind === 'same_pa_field_rule_read_pair_v1' ? pair.value.evidence.physical.field.evidence.horizon : null;
  const evaluatedThrough = at && { originTick: at.originTick, elapsedSeconds: at.elapsedSeconds, tick: at.ball.tick };
  let prior: SamePaLiveBallState | null = null;
  for (const action of actions) {
    same(action.priorStateReference, prior ? reference(table, prior) : null);
    if (!evaluatedThrough || action.occurredAt.originTick !== evaluatedThrough.originTick
      || action.occurredAt.elapsedSeconds > evaluatedThrough.elapsedSeconds
      || prior && action.occurredAt.elapsedSeconds < prior.occurredAt.elapsedSeconds)
      throw new Error('live-ball action history exceeds original physical cut');
    prior = action;
  }
  const initialLiveContinuation = readSamePaInitialLiveContinuationFromSqlite(db, viewReference, mode);
  const initialLive = initialLiveContinuation && initialLiveContinuation.kind !== 'pending' ? initialLiveContinuation : null;
  const latestDeclaredState = actions.at(-1)?.state ?? (initialLive ? 'live' : 'unknown');
  let status: 'unknown' | 'live' | 'dead' = latestDeclaredState;
  let statusReason: string | null = latestDeclaredState === 'unknown'
    ? initialLiveContinuation?.kind === 'pending' ? initialLiveContinuation.reason : 'initial_live_ball_owner_missing' : null;
  const venue = latestDeclaredState === 'live' && pair.kind === 'same_pa_field_rule_read_pair_v1'
    ? deriveSamePaVenueLegalCoverageFromPair(pair) : null;
  if (latestDeclaredState === 'live') {
    if (!venue || venue.kind === 'pending') {
      status = 'unknown'; statusReason = 'original_post_play_legal_coverage_required';
    } else {
      // The canonical continuation owns the interval up to this field origin.
      // This is its coverage boundary, never a substituted Play occurrence.
      const coverageFrom = actions.at(-1)?.occurredAt ?? { originTick: venue.input.originTick, elapsedSeconds: 0, tick: venue.input.originTick };
      const result = deriveSamePaLiveBallPostPlayStatus(venue, coverageFrom);
      status = result.status; statusReason = result.reason;
    }
  }
  const result = { kind: initialLiveContinuation ? 'same_pa_live_ball_history_v2' as const : 'same_pa_live_ball_history_v1' as const,
    ...(initialLiveContinuation ? { initialLiveContinuation } : {}), viewReference, lineage: b.view.lineage,
    physicalPitchReference: cut.physicalPitchReference, physicalOperationReference: cut.physicalOperationReference,
    evaluatedThrough, initialState: initialLive ? 'live' as const : 'unknown' as const,
    initialBoundary: initialLive?.kind === 'same_pa_restart_live_continuation_v1' ? 'owned_reset_play_continuation' as const
      : initialLive ? 'owned_canonical_take_continuation' as const : 'initial_live_ball_owner_missing' as const,
    coverageStart: initialLive?.occurredAt ?? actions[0]?.occurredAt ?? null, status, statusReason, latestDeclaredState,
    actions, executionReferences: actions.map(a => reference(table, a)) };
  return freeze({ ...result, coverageHash: hash(result) });
});

export const deriveSamePaLiveBallStateFromSqlite = (db: DatabaseSync, source: AcceptedSamePaLiveBallAction,
  raw: SamePaLiveBallOriginals, current: boolean): SamePaLiveBallState | SamePaLiveBallPending => {
  const originalInputs = samePaLiveBallOriginalsInput(raw, source), { assignment, person } = originalInputs;
  const b = (current ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, source.viewReference);
  if (current) assertNoSamePaCatchReviewSeal(db, b.view.lineage.gameId, b.view.lineage.playId);
  same(source.enrollmentReference, b.view.lineage.enrollmentReference);
  if (assignment.gameId !== b.view.lineage.gameId || assignment.playId !== b.view.lineage.playId
    || assignment.physicalPitchSourceId !== b.view.cut.physicalPitchReference.sourceId
    || assignment.policy.ruleProfileId !== b.actor.match.ruleProfileId || person.careerId !== b.view.lineage.careerId)
    throw new Error('live-ball original bounded plate-umpire assignment differs');
  const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, source.viewReference, current ? 'current' : 'historical');
  // Initial actor.world has no actual ball custody. It cannot initialize Play.
  if (pair.kind !== 'same_pa_field_rule_read_pair_v1') return pending('actual_current_live_ball_cut_owner_required');
  const history = readSamePaLiveBallHistoryFromSqlite(db, source.viewReference, current ? 'current' : 'historical');
  same(source.priorStateReference, history.executionReferences.at(-1) ?? null);
  const horizon = pair.value.evidence.physical.field.evidence.horizon;
  const occurredAt = { originTick: horizon.originTick, elapsedSeconds: horizon.elapsedSeconds, tick: horizon.ball.tick };
  const last = history.actions.at(-1);
  if (last && (last.occurredAt.originTick !== occurredAt.originTick || last.occurredAt.elapsedSeconds > occurredAt.elapsedSeconds))
    throw new Error('live-ball transition precedes its original state');
  let playProof: SamePaLiveBallState['playProof'] = null;
  let venuePolicyReference: SamePaLiveBallState['venuePolicyReference'] = null;
  if (source.declaration === 'play') {
    const venue = deriveSamePaVenueLegalCoverageFromPair(pair);
    if (venue.kind === 'pending') return pending(venue.reason);
    if (!venue.pitcherPlate) return pending('original_pitcher_plate_geometry_required');
    if (venue.coverage.intervals.at(-1)?.end.classification !== 'inside_playable_region')
      return pending('original_current_playable_region_required');
    const pitchers = b.actor.world.defenders.filter(d => d.registeredPosition === 'P');
    if (pitchers.length !== 1 || !b.actor.defenderBindings.some(d => d.playerId === pitchers[0].playerId))
      throw new Error('live-ball original registered pitcher differs');
    const proof = deriveSamePaLiveBallPlayProof({ pitcherId: pitchers[0].playerId, field: pair.fields.at(-1)!,
      evidence: pair.value.evidence, plate: venue.pitcherPlate });
    if (proof.kind === 'pending') return proof;
    const currentSegment = venue.fieldSegments.at(-1)!.segmentIndex;
    const carrier = venue.carrierCoverage.filter(c => c.segmentIndex === currentSegment && c.playerId === pitchers[0].playerId);
    if (venue.unresolvedCarrierSpans.some(s => s.segmentIndex === currentSegment)
      || ['body', 'left_foot', 'right_foot'].some(role => carrier.filter(c => c.role === role
        && c.coverage.intervals.at(-1)?.end.classification === 'inside_playable_region').length !== 1))
      return pending('original_current_pitcher_playable_region_required');
    same(proof.moment, occurredAt); playProof = proof; venuePolicyReference = venue.policyReference;
  }
  return freeze({ kind: 'same_pa_live_ball_state_v1', source, lineage: b.view.lineage, originalInputs,
    physicalPitchReference: b.view.cut.physicalPitchReference, physicalOperationReference: b.view.cut.physicalOperationReference,
    evaluationTick: b.view.cut.evaluationTick, occurredAt, priorStateReference: source.priorStateReference,
    state: source.declaration === 'play' ? 'live' : 'dead', playProof, physicalCoverageHash: pair.value.coverageHash,
    priorHistoryHash: history.coverageHash, venuePolicyReference });
};
export const readSamePaLiveBallStateByIdFromSqlite = (db: DatabaseSync, id: string): SamePaLiveBallState | null =>
  memoSamePaLifecycleRead(db, table + ':' + id, () => {
    const r = row(db, id); if (!r) return null;
    const source = samePaLiveBallActionInput(JSON.parse(String(r.source_json)), id), saved = JSON.parse(String(r.snapshot_json));
    const value = deriveSamePaLiveBallStateFromSqlite(db, source, saved.originalInputs, false);
    if (value.kind === 'pending') throw new Error('owned live-ball action lost its original physical prerequisite');
    same(r, samePaLiveBallStateRow(value)); return value;
  });
export const readSamePaLiveBallStateFromSqlite = (db: DatabaseSync, ref: SamePaLiveBallStateReference): SamePaLiveBallState => {
  if (!samePaReferenceValid(ref, table)) throw new Error('invalid live-ball execution reference');
  const value = readSamePaLiveBallStateByIdFromSqlite(db, ref.sourceId);
  if (!value) throw new Error('live-ball execution owner missing'); same(reference(table, value), ref); return value;
};
