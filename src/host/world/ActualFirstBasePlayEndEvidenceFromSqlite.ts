import { withSqliteMetadataStatementScope } from './SqliteMetadataStatementScope';
import { retainActualLiveFutureControllerWork, actualLiveFutureControllerProducer, actualLiveFutureControllerDisposition } from './ActualLiveFutureControllerWork';
import { actualCommunicationEvidenceFromSqlite } from './SqliteActualCommunicationStore';
import { createLivePlayRegistry, resolveLivePlayRegistry, type LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { ownedScheduledWholeHistoryArchiveEncoding, ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actualObservationPhysicalPrefixEvidence } from './ActualObservationPhysicalPrefixHash';
import { deriveActualLiveObservationSchedule } from './ActualLiveObservationSchedule';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualDefensiveDecisionLiveWorkFromSqlite } from './SqliteActualDefensiveDecisionLiveWork';
import { actualLivePlayMotorAdopted } from './ActualLivePlayEvidenceFromSqlite';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { actualFirstBasePlayEndInput as input, type AcceptedActualFirstBasePlayEnd, type ActualFirstBasePlayEndEvidence } from './ActualFirstBasePlayEnd';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { actualLivePlayQueueConsumersFromSqlite } from './ActualLivePlayQueueConsumersFromSqlite';
import { actualLiveRuleConsumptionEvidenceFromSqlite } from './ActualLiveRuleConsumptionFromSqlite';
import { actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { actualLivePlayInventoryFromSqlite, actualLiveOwnerInstalled } from './ActualLivePlayInventoryFromSqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'> &
  Partial<Pick<import('node:sqlite').DatabaseSync, 'isTransaction'>>;
const pending = (source: AcceptedActualFirstBasePlayEnd, reasons: readonly string[]) => freeze({ source, kind: 'pending' as const,
  playEnd: null, pendingReasons: [...new Set(reasons)] });
/** This version handles one real empty-base, fair-ground first-base retirement.
 * Unknown autonomous renewal and other live-rule policies are never certified.
 * Every outcome and clock comes from the actual registered owner graph. */
export const actualFirstBasePlayEndEvidenceFromSqlite = (db: Db) => ({
  derive: (raw: AcceptedActualFirstBasePlayEnd, current = false): ActualFirstBasePlayEndEvidence => withSqliteMetadataStatementScope(db, () => {
    const source = input(raw, raw.sourceId);
    if (!actualLiveOwnerInstalled(db, 'actual_live_play_runtimes', 'actual_live_play_admissions')) return pending(source, ['causal_runtime_registration_missing']);
    const runtime = actualLiveRuntimeEvidenceFromSqlite(db).read(source.runtimeSourceId);
    if (!runtime) return pending(source, ['causal_runtime_registration_missing']);
    const physicalPitchSourceId = runtime.source.physicalPitchSourceId;
    const scopeSource = { sourceId: source.sourceId, sourceVersion: source.sourceVersion, capability: 'actual_live_play_scope_v1' as const,
      physicalPitchSourceId, cut: { kind: 'field_execution' as const, baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.executionSourceId } };
    const scopes = actualLivePlayEvidenceFromSqlite(db);
    const owned = db.isTransaction === true ? scopes.deriveWithPhysicalPrefix(scopeSource, current) : null;
    if (owned && !owned.prefix) throw new Error('actual PlayEnd original physical prefix is missing');
    const changes = owned ? db.prepare('SELECT total_changes() AS changes').get()!.changes : null;
    const scope = (owned ? owned.value : scopes.derive(scopeSource, current)).scope;
    if (scope.gameId !== runtime.gameId || scope.playId !== runtime.playId || scope.originalPitchHash !== runtime.originalPitchHash
      || scope.scopeId !== runtime.membership.scopeId || scope.participation !== 'supported_empty_base'
      || json(scope.participants.map(p => ({ playerId: p.playerId, personId: p.personId, role: p.role }))) !== json(runtime.membership.participants)
      || json(scope.producers.map(p => ({ producerId: p.producerId, domain: p.domain, playerId: p.playerId }))) !== json(runtime.membership.producers)) {
      throw new Error('actual PlayEnd original runtime participant/capability membership differs');
    }
    const admissions = actualLiveRuntimeEvidenceFromSqlite(db).admissions(runtime);
    // Registration is before any field output. Each original physical source
    // must be present in the transaction-owned journal; SQL absence alone is not coverage.
    for (const ref of scope.physicalReferences.filter(r => r.owner !== 'batted_world_contacts')) {
      if (!admissions.some(a => a.owner === ref.owner && a.sourceId === ref.sourceId && a.snapshotHash === ref.hash)) {
        throw new Error('actual PlayEnd physical producer bypassed runtime admission');
      }
    }
    const fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
    const baseField = owned ? owned.prefix!.baseField : fields.read(source.baseFieldSourceId)!;
    const prefix = owned ? owned.prefix! : { baseField, fields: fields.scope(baseField, source.baseFieldSourceId),
      executions: executions.scope(baseField, source.executionSourceId) };
    if (owned && (db.isTransaction !== true || db.prepare('SELECT total_changes() AS changes').get()!.changes !== changes)) {
      throw new Error('actual PlayEnd physical dependencies changed during read');
    }
    const ruleOwner = [...prefix.executions].reverse().find(e => e.execution.kind === 'first_base_race');
    if (!ruleOwner || ruleOwner.execution.kind !== 'first_base_race' || ruleOwner.source.action.kind !== 'first_base_race'
      || ruleOwner.source.action.custodyPolicy !== 'release_exclusive_v1') return pending(source, ['current_first_base_rule_coverage_pending']);
    const rule = ruleOwner.execution, wholeHistory = wholePlayPhysicalHistoryFromPrefix(prefix), physical = battedWorldFieldPhysicalPrefix(prefix);
    const ruleThrough = rule.field.motion.world.moment.elapsedSeconds;
    const suffix = prefix.executions.filter(e => e.revision > ruleOwner.revision);
    if (suffix.some(e => e.execution.kind !== 'owned_motion_v2' || e.execution.composition.mode !== 'retained'
      || e.execution.operation !== null || e.execution.adoption.status !== 'checkpoint_reached'
      || e.execution.field.motion.world.kind !== 'moving')) return pending(source, ['later_physical_rule_consumer_pending']);
    const at = scope.at, boundary = deriveQuantizerClosedGenerationBoundary({ originTick: at.originTick, throughTick: at.tick,
      ticksPerSecond: wholeHistory.origin.ticksPerSecond });
    const actual = [...prefix.executions].reverse().find(e => !['first_base_race', 'whole_play_history', 'base_touch_history'].includes(e.execution.kind));
    if (actual?.execution.kind !== 'owned_motion_v2' || actual.source.action.kind !== 'owned_motion_v2'
      || actual.source.action.checkpoint.kind !== 'retained_quantizer_bucket_v1'
      || actual.execution.adoption.status !== 'checkpoint_reached' || at.elapsedSeconds !== boundary.lastIncludedElapsedSeconds
      || json(actual.execution.composition.quantizerBoundary) !== json(boundary)) return pending(source, ['physical_quantizer_generation_pending']);
    if (rule.ballEvidence.kind !== 'grounded' || rule.ballEvidence.territory !== 'fair' || !rule.groundRule
      || rule.pendingContacts.length || wholeHistory.cursor === null || wholeHistory.carrierPlayerId === null) {
      return pending(source, ['live_contact_or_rule_policy_pending']);
    }
    const ids = scope.participants.map(p => p.playerId), selves = actualPlayersKinematicsFromPrefix(ids, prefix);
    if (selves.length !== scope.participants.length || selves.some(self => self.roles.length !== 5
      || self.at.elapsedSeconds !== at.elapsedSeconds || self.activeCommand.acceptedThroughTick <= at.tick
      || self.roles.some(role => (role.canonicalActor.primitive.endTick - at.originTick) / wholeHistory.origin.ticksPerSecond < at.elapsedSeconds))) {
      return pending(source, ['actual_controller_coverage_pending']);
    }
    const inventory = actualLivePlayInventoryFromSqlite(db, scope);
    const observationSchedules = scope.participants.map(player => {
      const rows = inventory.observations.filter(r => r.player_id === player.playerId);
      const observations = rows.map(row => {
        const value = actualFieldObservationEvidenceFromSqlite(db).read(row.source_id)!;
        const model = playerObservationModelEvidenceFromSqlite(db).read(value.source.observationModelSourceId)!;
        return { sourceId: value.source.sourceId, at: value.receipt.at, attentionTarget: value.source.view.attentionTarget,
          refreshPolicy: model.source.calibration.refreshPolicy, results: value.receipt.results };
      });
      return { playerId: player.playerId, ...deriveActualLiveObservationSchedule(observations) };
    });
    if (observationSchedules.some(s => s.pending.some(w => w.dueTick <= at.tick))) return pending(source, ['causal_observation_refresh_pending']);
    const decisionWork = scope.participants.flatMap(player => {
      const row = inventory.decisions.filter(r => r.player_id === player.playerId).at(-1);
      return row ? [actualDefensiveDecisionLiveWorkFromSqlite(db).read(row.source_id)!] : [];
    });
    for (const observation of inventory.observations.filter(r => inventory.observations.filter(o => o.player_id === r.player_id).at(-1) === r)) {
      const row = inventory.decisions.filter(d => d.player_id === observation.player_id).at(-1);
      if (!row) return pending(source, ['observed_actor_decision_consumer_pending']);
      const decision = actualDefensiveDecisionEvidenceFromSqlite(db).read(row.source_id)!;
      if (decision.source.observationSourceId !== observation.source_id) return pending(source, ['observed_actor_renewal_policy_pending']);
    }
    for (const work of decisionWork) {
      if (work.work.source.decisions.some(d => d.dueTick <= at.tick) || work.work.source.intents.some(d => d.dueTick <= at.tick)) {
        return pending(source, ['due_owned_decision_pending']);
      }
      if (work.work.handoff) {
        const motor = inventory.motors.find(m => m.decision_source_id === work.decisionSourceId);
        if (!motor || !actualLivePlayMotorAdopted(prefix, motor.source_id, motor.player_id)) return pending(source, ['issued_motor_adoption_pending']);
      }
    }
    const allowed = new Set(['batted_world_field_actions', 'batted_world_field_executions', 'actual_live_rule_consumptions',
      'actual_first_base_umpire_setups', 'actual_first_base_umpire_observations', 'actual_first_base_umpire_calls', 'actual_call_communications',
      'actual_field_observations', 'actual_defensive_plans', 'actual_defensive_decisions', 'actual_locomotion_receipts']);
    if (admissions.some(a => !allowed.has(a.owner))) return pending(source, ['admitted_runtime_capability_coverage_pending']);
    if (!actualLiveOwnerInstalled(db, 'actual_live_rule_consumptions')) return pending(source, ['canonical_rule_consumption_pending']);
    const consumption = actualLiveRuleConsumptionEvidenceFromSqlite(db).read(source.ruleConsumptionSourceId);
    if (!consumption) return pending(source, ['canonical_rule_consumption_pending']);
    if (consumption.physicalPitchSourceId !== physicalPitchSourceId || consumption.source.ruleExecutionSourceId !== ruleOwner.source.sourceId
      || consumption.consumption.availableAt.elapsedSeconds !== ruleThrough || ruleThrough > at.elapsedSeconds) throw new Error('actual PlayEnd canonical rule acknowledgement differs');
    if (!actualLiveOwnerInstalled(db, 'actual_first_base_umpire_calls')) return pending(source, ['operative_call_retirement_pending']);
    const umpire = actualFirstBaseUmpireEvidenceFromSqlite(db), call = umpire.readAvailableCall(source.umpireCallSourceId, at);
    if (!call) return pending(source, ['operative_call_retirement_pending']);
    const disposition = umpire.offensiveDisposition(source.umpireCallSourceId, at);
    if (disposition.kind !== 'retired') return pending(source, ['offensive_actor_still_active']);
    if (call.observation.physicalPitchSourceId !== physicalPitchSourceId || call.observation.source.ruleExecutionSourceId !== ruleOwner.source.sourceId
      || disposition.runnerId !== wholeHistory.origin.batterRunnerId) throw new Error('actual PlayEnd operative retirement scope differs');
    const queue = actualLivePlayQueueConsumersFromSqlite(db).derive(scopeSource);
    const custody = queue.successors.filter(s => s.original.kind === 'custody');
    if (custody.length !== 1 || queue.successors.some(s => s.consumption === null && s.original.kind !== 'custody')
      || queue.ruleResultSuccessors.length !== 1 || queue.ruleResultSuccessors[0].basisReceiptId !== consumption.consumption.receiptId) {
      return pending(source, ['canonical_successor_consumption_pending']);
    }
    // Communication owns every original recipient. A future delivery need not
    // delay legal retirement, but an unowned emission never counts as complete.
    if (!actualLiveOwnerInstalled(db, 'actual_call_communications')) return pending(source, ['call_information_generation_pending']);
    const communication = actualCommunicationEvidenceFromSqlite(db).read(source.communicationSourceId);
    if (!communication) return pending(source, ['call_information_generation_pending']);
    if (current) actualCommunicationEvidenceFromSqlite(db).current(communication);
    if (communication.physicalPitchSourceId !== physicalPitchSourceId || communication.source.callSourceId !== source.umpireCallSourceId
      || communication.source.currentExecutionSourceId !== source.executionSourceId
      || json(communication.evaluatedThrough) !== json(at)
      || json(communication.recipients.map(r => r.playerId).sort()) !== json([...ids].sort())) {
      throw new Error('actual PlayEnd communication scope or original recipient membership differs');
    }
    if (!communication.emitted || communication.pendingReason || communication.recipients.some(r => r.kind === 'pending')) {
      return pending(source, ['call_information_coverage_pending']);
    }
    if (communication.recipients.some(r => r.kind === 'received'
      || r.kind === 'scheduled' && r.reception.received.receivedAt <= at.tick)) {
      // Reception alone is not a player decision. This bounded capability has no
      // post-reception controller owner, so due deliveries require that owner.
      return pending(source, ['received_call_controller_consumption_pending']);
    }
    // Authenticate every admitted umpire progression, including its earlier
    // scheduled receipt. A terminal call never blesses an altered pending row.
    for (const admitted of admissions.filter(a => a.owner === 'actual_first_base_umpire_calls')) {
      const original = umpire.readCall(admitted.sourceId);
      if (!original || original.observation.physicalPitchSourceId !== physicalPitchSourceId
        || original.observation.source.sourceId !== call.observation.source.sourceId) throw new Error('actual PlayEnd prior call ownership differs');
    }
    const references = umpire.importReferences(source.umpireCallSourceId)!;
    const required = [
      { owner: 'actual_live_rule_consumptions', sourceId: consumption.source.sourceId },
      references.call, references.perception, references.policy,
      { owner: 'actual_call_communications', sourceId: communication.source.sourceId },
    ];
    for (const ref of required) if (!admissions.some(a => a.owner === ref.owner && a.sourceId === ref.sourceId)) {
      throw new Error('actual PlayEnd causal consumer bypassed runtime admission');
    }
    let unconsumedBaseFacts = false;
    const bodyBaseHistoryHashes = scope.participants.flatMap(player => (['home', 'first', 'second', 'third'] as const).map(base => {
      const bag = baseField.geometry.geometry.baseGeometry.bases[base];
      const history = deriveBallWorldPlayerBaseContactHistory({ segments: physical.segments, playerId: player.playerId,
        base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
      if (history.endElapsedSeconds !== at.elapsedSeconds) throw new Error('actual PlayEnd body/base generation cut differs');
      if (history.events.some(event => event.elapsedSeconds > ruleThrough)
        || player.role === 'batter' && (base === 'second' || base === 'third') && history.episodes.length
        || player.role === 'batter' && base === 'home' && history.events.some(event => event.kind === 'touch' && event.elapsedSeconds > 0)) unconsumedBaseFacts = true;
      return { playerId: player.playerId, base, hash: hash(history) };
    }));
    if (unconsumedBaseFacts) return pending(source, ['later_or_unsupported_base_rule_consumer_pending']);
    const futureWork = {
      ...retainActualLiveFutureControllerWork(decisionWork, at.tick),
      observations: observationSchedules.flatMap(s => s.pending.map(w => ({ playerId: s.playerId, sourceId: w.causeSourceId, dueTick: w.dueTick }))),
      controllers: selves.map(self => ({ playerId: self.playerId, sourceId: self.activeCommand.sourceId, dueTick: self.activeCommand.acceptedThroughTick })),
      communication: communication.recipients.flatMap(r => r.kind !== 'scheduled' ? [] : [{ playerId: r.playerId,
        dueTick: r.reception.received.receivedAt, dueElapsedSeconds: r.reception.receivedAtElapsedSeconds }]),
    };
    const sources: LivePlaySource[] = scope.producers.map(producer => {
      const observations = producer.domain === 'observation_scheduling' ? futureWork.observations.filter(w => w.playerId === producer.playerId) : [];
      const controllers = producer.domain === 'controller_renewal' ? futureWork.controllers.filter(w => w.playerId === producer.playerId) : [];
      const communicationWork = producer.domain === 'communication_ingress' ? futureWork.communication : [];
      const body = producer.domain === 'body_motion' ? selves.find(s => s.playerId === producer.playerId)! : null;
      const futureController = actualLiveFutureControllerProducer(producer.domain, producer.playerId, futureWork);
      const futureTicks = [...observations, ...controllers, ...communicationWork, ...futureController.decisions, ...futureController.intents].map(w => w.dueTick);
      return { sourceId: producer.producerId, revision: 1,
        queue: { sourceId: producer.producerId, settledThroughTick: at.tick, nextPendingTick: futureTicks.length ? Math.min(...futureTicks) : null },
        physical: body ? [{ workId: `${producer.producerId}:motion`, kind: body.playerId === disposition.runnerId ? 'runner_motion' : 'defender_motion',
          actorId: body.playerId, throughTick: body.activeCommand.acceptedThroughTick, actionKey: body.activeCommand.sourceId }] : [],
        intents: futureController.intents, decisions: [...futureController.decisions, ...controllers.map((w, i) => ({ workId: `${producer.producerId}:renewal:${i}`, kind: 'actor_decision' as const, actorId: w.playerId, dueTick: w.dueTick }))],
        information: [...observations.map((w, i) => ({ workId: `${producer.producerId}:refresh:${i}`, kind: 'in_flight_information' as const,
          actorId: w.playerId, dueTick: w.dueTick, causeEventId: w.sourceId })),
        ...communicationWork.map((w, i) => ({ workId: `${producer.producerId}:call:${i}`, kind: 'in_flight_information' as const,
          actorId: w.playerId, dueTick: w.dueTick, causeEventId: source.umpireCallSourceId }))], ruleWindows: [] };
    });
    const registry = resolveLivePlayRegistry(createLivePlayRegistry({ playId: scope.playId, revision: 1, sources }),
      { tick: at.tick, terminal: 'all_offense_terminal', actors: scope.participants.map(p => actualLiveFutureControllerDisposition(p.playerId, futureWork)) });
    if (registry.resolution.kind !== 'ended') throw new Error('complete Native first-base proof failed the existing Core finalizer');
    const wholeHistoryHash = ownedScheduledWholeHistoryArchiveEncoding(wholeHistory, physicalPitchSourceId, scope.gameId).hash;
    const physicalPrefixReference = actualObservationPhysicalPrefixEvidence(prefix);
    const firstBaseEvidenceApplicability = { version: 'owned_first_base_evidence_applicability_v1' as const,
      ownerSourceId: source.sourceId, rule: references.ruleEvidence, call: references.call, perception: references.perception,
      ruleEvidenceRevision: call.observation.ruleEvidenceRevision, from: consumption.consumption.availableAt, through: at,
      physicalCut: { baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.executionSourceId }, physicalPrefixReference,
      physicalSuffix: suffix.map(e => ({ owner: 'batted_world_field_executions', sourceId: e.source.sourceId,
        sourceVersion: e.source.sourceVersion, sourceHash: hash(e.source), snapshotHash: ownedScheduledMotionArchiveHash(e) })),
      bodyBaseHistoryHashes, coverage: 'no_new_rule_relevant_physical_or_base_facts' as const,
      fence: { owner: 'actual_first_base_play_ends' as const, sourceId: source.sourceId } };

    return freeze({ source, kind: 'ended', gameId: scope.gameId, playId: scope.playId, physicalPitchSourceId, scopeId: scope.scopeId,
      exactEnd: at, playEnd: registry.resolution.playEnd, wholeHistory, wholeHistoryHash,
      wholeHistoryHashConvention: 'owned_scheduled_whole_history_manifest_v1', physicalPrefixReference, firstBaseEvidenceApplicability,
      finalRuleReference: consumption.consumption.rule, operativeCallReferences: references, operativeRetirement: disposition, registry,
      generation: { boundary, admissionJournalHash: hash(admissions), producerIds: scope.producers.map(p => p.producerId), bodyBaseHistoryHashes,
        consumed: [...queue.queue.consumptions.map(c => ({ cause: c.eventKey, consumer: c.consumer.sourceId })),
          { cause: custody[0].original.successorKey, consumer: actual.source.sourceId },
          { cause: consumption.consumption.successorKey, consumer: consumption.source.sourceId },
          { cause: consumption.successor.successorKey, consumer: source.umpireCallSourceId },
          { cause: source.umpireCallSourceId, consumer: `operative_retirement:${disposition.runnerId}` },
          { cause: source.umpireCallSourceId, consumer: source.communicationSourceId },
          ...observationSchedules.flatMap(s => s.consumed.map(c => ({ cause: c.causeSourceId, consumer: c.consumerSourceId }))) ] },
      futureWork });
  }),
});
