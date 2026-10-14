import type { DatabaseSync } from 'node:sqlite';
import { actualFoulPlayEndInput, type FoulEndSource, type FoulEndEvaluation, type FoulOwnerReference,
  type FoulDispositionObligations, type FoulPhysicalAcknowledgement } from './ActualFoulPlayEnd';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { actualSettledFoulStopProducerEvidenceFromSqlite } from './SqliteActualSettledFoulStopProducerStore';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { deriveOriginalSettledFoulEndRuntimeMembership } from './ActualLivePlayRuntime';
import { actualLiveAdmissionOwners } from './ActualLivePlayFence';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { battedWorldPhysicalPrefixAndWholePlayHistory } from './WholePlayPhysicalHistoryFromPrefix';
import { battedVenueLegalPolicyEvidenceFromSqlite, withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { actualFoulGovernedOwnerCensus, actualFoulOwnerReference as reference } from './ActualFoulPlayEndOwnership';
import { buildActualFoulPhysicalProof } from './ActualFoulPlayEndProof';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledMotionArchiveHash, ownedScheduledWholeHistoryArchiveEncoding } from './OwnedScheduledMotionArchive';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { createLivePlayRegistry, resolveLivePlayRegistry } from '../../core/sim/liveAction/LivePlayRegistry';

/** A proposal reconstructs the physical premises in one original-owner snapshot.
 * Durable authority additionally requires the dedicated receipt and seal reader. */
export const actualFoulPlayEndEvidenceFromSqlite = (db: DatabaseSync) => {
  const derive = (raw: FoulEndSource, current = false): FoulEndEvaluation => withBattedVenueLegalReadSnapshot(db, () => {
    const source = actualFoulPlayEndInput(raw, raw.sourceId);
    const pending = (...pendingReasons: string[]): FoulEndEvaluation => freeze({ source, kind: 'pending', playEnd: null, pendingReasons });
    const consumers = actualFoulRuleConsumptionEvidenceFromSqlite(db), count = consumers.read(source.ruleConsumptionSourceId);
    if (!count) throw new Error('actual foul end original count owner is missing');
    const runtimes = actualLiveRuntimeEvidenceFromSqlite(db), runtime = runtimes.read(count.source.runtimeSourceId);
    if (!runtime || runtime.source.capability !== 'causal_original_settled_foul_end_runtime_v1'
      || runtime.membership.liveRulePolicy !== 'untouched_settled_foul_end_v1') throw new Error('actual foul end requires its pre-enrolled end runtime');
    const production = actualSettledFoulStopProducerEvidenceFromSqlite(db).read(count.source.stopProductionSourceId);
    if (!production || source.baseFieldSourceId !== production.source.baseFieldSourceId
      || production.source.executionSourceId !== null || production.source.runtimeSourceId !== runtime.source.sourceId
      || production.physicalPitchSourceId !== runtime.source.physicalPitchSourceId) throw new Error('actual foul end original stop cut differs');
    const cut = { kind: 'field_execution' as const, baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.executionSourceId };
    const { value, prefix } = actualLivePlayEvidenceFromSqlite(db).deriveWithPhysicalPrefix({ sourceId: source.sourceId,
      sourceVersion: source.sourceVersion, capability: 'actual_live_play_scope_v1', physicalPitchSourceId: count.physicalPitchSourceId, cut }, current);
    if (!prefix || value.scope.participation !== 'supported_empty_base'
      || json(deriveOriginalSettledFoulEndRuntimeMembership(value.scope)) !== json(runtime.membership)) throw new Error('actual foul end complete original membership differs');
    const pitches = readOriginalPhysicalPitchPrefixFromSqlite(db, count.physicalPitchSourceId), pitch = pitches.at(-1)!;
    const policy = battedVenueLegalPolicyEvidenceFromSqlite(db).read(production.source.policySourceId);
    if (!policy || pitch.frame.match.ruleProfileId !== 'npb-2026'
      || json(policy.source.rulePolicy) !== json({ version: 'untouched_settled_foul_dead_v1', ruleProfileId: 'npb-2026', rulesRevision: '2026' })
      || count.countEvidence.basis.evidence.interpretation.kind !== 'dead_ball') throw new Error('actual foul end original registered dead-ball cause differs');
    const endpoint = prefix.executions.at(-1)!, moment = prefix.baseField.field.motion.world.moment;
    const ticksPerSecond = prefix.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    const boundary = deriveQuantizerClosedGenerationBoundary({ originTick: moment.originTick, throughTick: moment.ball.tick, ticksPerSecond });
    const at = { originTick: moment.originTick, elapsedSeconds: boundary.lastIncludedElapsedSeconds, tick: moment.ball.tick };
    if (endpoint.execution.kind !== 'owned_motion_v2' || endpoint.source.action.kind !== 'owned_motion_v2'
      || endpoint.execution.operation !== null || endpoint.execution.composition.mode !== 'retained'
      || json(endpoint.execution.composition.quantizerBoundary) !== json(boundary)
      || json(endpoint.source.action.checkpoint) !== json({ kind: 'retained_quantizer_bucket_v1', throughTick: at.tick })
      || json(endpoint.execution.adoption.executedThrough) !== json(at)
      || quantizeEventTick(at.originTick, at.elapsedSeconds, ticksPerSecond) !== at.tick
      || quantizeEventTick(at.originTick, boundary.firstExcludedElapsedSeconds, ticksPerSecond) <= at.tick
      || production.event.availableAt.tick !== at.tick || count.consumption.availableAt.tick !== at.tick) {
      return pending('original_retained_quantizer_endpoint_unproved');
    }
    if (prefix.executions.some(e => e.execution.kind !== 'owned_motion_v2' || e.execution.operation !== null
      || e.execution.composition.mode !== 'retained' || e.source.action.kind !== 'owned_motion_v2'
      || e.source.action.contributions.some(c => c.kind !== 'retained'))) return pending('unsupported_physical_execution');
    const admissions = runtimes.admissions(runtime), expected = new Map<string, FoulOwnerReference[]>();
    const add = (owner: string, item: { source: { sourceId: string } }, snapshotHash = hash(item)) => {
      const refs = expected.get(owner) ?? [], ref = reference(owner, item, snapshotHash);
      if (!refs.some(r => r.sourceId === ref.sourceId)) refs.push(ref);
      expected.set(owner, refs);
    };
    for (const p of pitches) { add('physical_pitch_progress_actions', p); if (p.frame.batterActor) add('physical_plate_appearance_actors', p.frame.batterActor); }
    const response = prefix.baseField.response, touch = response.touch, contact = touch.worldContact;
    add('batted_ball_flights', contact.flight); add('batted_world_contacts', contact);
    add('batted_first_fielder_touches', touch); add('batted_contact_responses', response);
    for (const field of prefix.fields) add('batted_world_field_actions', field);
    for (const execution of prefix.executions) add('batted_world_field_executions', execution, ownedScheduledMotionArchiveHash(execution));
    add('actual_settled_foul_stop_productions', production); add('actual_foul_rule_consumptions', count);
    const discovered = actualFoulGovernedOwnerCensus(db, runtime, [...actualLiveAdmissionOwners, 'actual_communication_models'], expected, admissions);
    if (discovered.unsupported.length) return pending(...discovered.unsupported);
    const ordered = [...prefix.fields.map(f => reference('batted_world_field_actions', f)),
      reference('actual_settled_foul_stop_productions', production), reference('actual_foul_rule_consumptions', count),
      ...prefix.executions.map(e => reference('batted_world_field_executions', e, ownedScheduledMotionArchiveHash(e)))];
    if (json(admissions) !== json(ordered.map((r, i) => ({ sequence: i + 1, ...r })))) throw new Error('actual foul end generation/admission chronology differs');
    const census = consumers.census({ version: 'actual_foul_rule_consumers_v1', runtimeSourceId: runtime.source.sourceId, cut });
    if (json(census.producer.events.map(e => e.eventKey)) !== json([production.event.eventKey])
      || json(census.producer.successors.map(s => s.successorKey)) !== json([production.successor.successorKey])
      || json(census.acceptedConsumptions) !== json([count]) || json(census.dispositionSuccessors) !== json([count.successor])
      || census.successors.length !== 1 || json(census.successors[0].consumption) !== json(count.consumption)
      || census.futureConsumptionSourceIds.length || census.producer.producer.futureSourceIds.length) return pending('unconsumed_original_foul_generation');
    const ids = runtime.membership.participants.map(p => p.playerId), known = ownedMotionKnownWorkFromSqlite(db, pitch.source.sourceId, ids);
    if (json(known) !== json(ids.map(playerId => ({ playerId, decisionSourceId: null, motorSourceId: null })))) return pending('unsupported_initiated_actor_work');
    const { physical, history } = battedWorldPhysicalPrefixAndWholePlayHistory(prefix), selves = actualPlayersKinematicsFromPrefix(ids, prefix);
    const pairs = ids.flatMap(id => ['body', 'glove', 'left_foot', 'right_foot', 'tag_hand'].map(role => json([id, role]))).sort();
    if (ids.length !== 10 || new Set(ids).size !== 10 || selves.length !== 10 || !physical.segments.length
      || physical.segments.some(segment => json(segment.actors.map(a => json([a.playerId, a.primitive.role])).sort()) !== json(pairs))
      || history.horizon.elapsedSeconds !== at.elapsedSeconds || history.end.kind !== 'unestablished'
      || selves.some(self => self.roles.length !== 5 || self.at.elapsedSeconds !== at.elapsedSeconds
        || self.activeCommand.acceptedThroughTick <= at.tick || self.ownedMotionCoverage?.roleAuthorities.length !== 5
        || self.ownedMotionCoverage.roleAuthorities.some(role => role.acceptedThroughTick <= at.tick))) return pending('incomplete_original_actor_generation');
    const baseHistories: { playerId: string; base: string; hash: string }[] = [];
    for (const self of selves) for (const base of ['home', 'first', 'second', 'third'] as const) {
      const bag = prefix.baseField.geometry.geometry.baseGeometry.bases[base];
      const facts = deriveBallWorldPlayerBaseContactHistory({ segments: physical.segments, playerId: self.playerId,
        base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
      if (facts.endElapsedSeconds !== at.elapsedSeconds || facts.events.some(e => e.elapsedSeconds > moment.elapsedSeconds)) return pending('unconsumed_original_body_base_event');
      baseHistories.push({ playerId: self.playerId, base, hash: hash(facts) });
    }
    const { proof, sources, futureWork } = buildActualFoulPhysicalProof({ runtime, pitch, production, count, prefix, scope: value.scope,
      boundary, history, selves, baseHistories, admissions, census, ownerCensus: discovered.census }, source);
    // No proposed end, future stored snapshot or seal is a premise of this hash.
    const physicalProofHash = hash(proof), parent = count.successor.successorKey;
    const physicalKey = json(['actual_foul_disposition_obligation_v1', parent, 'physical_end']);
    const officialKey = json(['actual_foul_disposition_obligation_v1', parent, 'official_disposition']);
    const scope = { kind: 'physical_live_episode' as const, gameId: runtime.gameId, playId: runtime.playId,
      physicalPitchSourceId: pitch.source.sourceId, runtimeSourceId: runtime.source.sourceId, scopeId: runtime.membership.scopeId };
    const countReference = reference('actual_foul_rule_consumptions', count);
    const dispositionObligations: FoulDispositionObligations = { version: 'actual_foul_disposition_obligations_v1', consumptionReference: countReference,
      original: count.successor, physical: { obligationKey: physicalKey, originalSuccessorKey: parent, scope,
        causedAt: count.consumption.availableAt, throughTick: count.consumption.availableAt.tick },
      official: { obligationKey: officialKey, originalSuccessorKey: parent,
        scope: { ...scope, kind: 'post_play_official_disposition', firstPhysicalPitchSourceId: count.firstPhysicalPitchSourceId, consumptionReference: countReference },
        status: 'pending', consumer: null, pendingReason: count.disposition.kind === 'continue_same_pa' ? 'official_continuation_unowned'
          : count.disposition.kind === 'terminal_strikeout' ? 'terminal_official_closure_unowned' : 'original_batting_intent_missing',
        causedAt: count.consumption.availableAt, eligibleAfterPhysicalEndAt: at } };
    const acknowledgementId = json(['actual_foul_physical_end_acknowledgement_v1', physicalKey, source.sourceId]);
    const physicalAcknowledgement: FoulPhysicalAcknowledgement = { version: 'actual_foul_physical_end_acknowledgement_v1', acknowledgementId,
      originalSuccessorKey: parent, obligationKey: physicalKey, scope, status: 'consumed', consumer: { owner: 'actual_foul_play_ends',
        sourceId: source.sourceId, sourceVersion: source.sourceVersion, sourceHash: hash(source) },
      basisReceiptId: count.consumption.receiptId, physicalProofHash, causedAt: count.consumption.availableAt, consumedAt: at };
    const ruleId = runtime.membership.producers.find(p => p.domain === 'physical_rule_consumption')!.producerId;
    // Only the proved physical child is discharged. The immutable mixed parent
    // and its official child are neither consumed nor marked source-complete.
    const acknowledged = sources.map(s => s.sourceId !== ruleId ? s : { ...s,
      queue: { sourceId: s.sourceId, settledThroughTick: at.tick, nextPendingTick: null },
      ruleWindows: s.ruleWindows.filter(w => w.workId !== physicalAcknowledgement.obligationKey) });
    const registry = resolveLivePlayRegistry(createLivePlayRegistry({ playId: runtime.playId, revision: 1, sources: acknowledged }),
      { tick: at.tick, terminal: 'dead_ball', actors: runtime.membership.participants.map(p => ({ actorId: p.playerId, kind: 'acting' as const })) });
    if (registry.resolution.kind !== 'ended' || registry.resolution.reason !== 'dead_ball') return pending('original_foul_core_dependencies_pending');
    return freeze({ source, kind: 'ended', revision: 1, history: [source], gameId: runtime.gameId, playId: runtime.playId,
      physicalPitchSourceId: pitch.source.sourceId, firstPhysicalPitchSourceId: count.firstPhysicalPitchSourceId, scopeId: runtime.membership.scopeId,
      exactEnd: at, playEnd: registry.resolution.playEnd, wholeHistory: history,
      wholeHistoryHash: ownedScheduledWholeHistoryArchiveEncoding(history, pitch.source.sourceId, runtime.gameId).hash,
      wholeHistoryHashConvention: 'owned_scheduled_whole_history_manifest_v1', preCorePhysicalProof: proof, physicalProofHash,
      dispositionObligations, physicalAcknowledgement, registry,
      generation: { producerIds: runtime.membership.producers.map(p => p.producerId), admissionJournalHash: hash(admissions),
        consumed: [{ cause: production.event.eventKey, consumer: count.source.sourceId },
          { cause: production.successor.successorKey, consumer: count.source.sourceId }, { cause: physicalKey, consumer: acknowledgementId }],
        physicalRuleProjection: { producerId: ruleId, physicalObligationKey: physicalKey, acknowledgementId, remainingOfficialObligationKey: officialKey } },
      futureWork, pending: { officialDisposition: dispositionObligations.official,
        controllerRetirement: 'unowned', workloadSettlement: 'unowned', reset: 'unowned', samePaResume: 'unowned' } });
  });
  return { derive };
};
