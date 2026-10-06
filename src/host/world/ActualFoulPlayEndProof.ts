import type { FoulEndSource, FoulOwnerReference, FoulPreCorePhysicalProof, FoulOwnerCensusEntry } from './ActualFoulPlayEnd';
import type { ActualLivePlayPrefix, ActualLivePlayScope } from './ActualLivePlayScope';
import type { DurableActualLivePlayRuntime } from './ActualLivePlayRuntime';
import type { DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import type { DurableActualSettledFoulStopProduction } from './ActualSettledFoulStopProducer';
import type { ActualFoulRuleConsumers, DurableActualFoulRuleConsumption } from './ActualFoulRuleConsumption';
import type { ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import type { CanonicalWholePlayHistory } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import type { QuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import type { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
export type ActualFoulPhysicalProofInputs = Readonly<{
  runtime: DurableActualLivePlayRuntime; pitch: DurablePhysicalPitch; production: DurableActualSettledFoulStopProduction;
  count: DurableActualFoulRuleConsumption; prefix: ActualLivePlayPrefix; scope: ActualLivePlayScope;
  boundary: QuantizerClosedGenerationBoundary; history: CanonicalWholePlayHistory; selves: readonly ActualPlayerKinematics[];
  baseHistories: readonly Readonly<{ playerId: string; base: string; hash: string }>[];
  admissions: ReturnType<ReturnType<typeof actualLiveRuntimeEvidenceFromSqlite>['admissions']>;
  census: ActualFoulRuleConsumers; ownerCensus: readonly FoulOwnerCensusEntry[];
}>;
import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledMotionArchiveHash, ownedScheduledWholeHistoryArchiveEncoding } from './OwnedScheduledMotionArchive';

/** Private proof construction over this operation's independently authenticated
 * original owners and complete raw census. No caller-supplied proof is admitted. */
export const buildActualFoulPhysicalProof = (facts: ActualFoulPhysicalProofInputs, source: FoulEndSource) => {
  const x = { runtime: facts.runtime, physical: facts.pitch, production: facts.production, count: facts.count,
    boundary: facts.boundary, moment: facts.prefix.baseField.field.motion.world.moment,
    executionSource: facts.prefix.executions.at(-1)!.source, endpoint: facts.prefix.executions.at(-1)! };
  const actual = { prefix: facts.prefix, history: facts.history, after: facts.selves, baseHistories: facts.baseHistories,
    admissions: facts.admissions, census: facts.census, ownerCensus: facts.ownerCensus };
  const reference = (owner: string, value: { source: { sourceId: string } }, snapshotHash = hash(value)): FoulOwnerReference =>
    ({ owner, sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash });
  const runtime = reference('actual_live_play_runtimes', x.runtime), pitch = reference('physical_pitch_progress_actions', x.physical);
  const stop = reference('actual_settled_foul_stop_productions', x.production), count = reference('actual_foul_rule_consumptions', x.count);
  const policy = x.production.basis.policyReference, at = { originTick: x.moment.originTick,
    elapsedSeconds: x.boundary.lastIncludedElapsedSeconds, tick: x.moment.ball.tick };
  const physicalCut = { baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.executionSourceId };
  const physicalOwners = [...actual.prefix.fields.map(v => reference('batted_world_field_actions', v)),
    ...actual.prefix.executions.map(v => reference('batted_world_field_executions', v, ownedScheduledMotionArchiveHash(v)))];
  const wholeHistoryHash = ownedScheduledWholeHistoryArchiveEncoding(actual.history, x.physical.source.sourceId, x.runtime.gameId).hash;
  const ownerCensus = actual.ownerCensus, ownerCensusHash = hash(ownerCensus), admissionJournalHash = hash(actual.admissions);
  const census = (...owners: string[]) => ownerCensus.filter(entry => owners.includes(entry.owner));
  const physicalChild = json(['actual_foul_disposition_obligation_v1', x.count.successor.successorKey, 'physical_end']);
  const officialChild = json(['actual_foul_disposition_obligation_v1', x.count.successor.successorKey, 'official_disposition']);
  const stopConsumptions = [
    { cause: x.production.event.eventKey, consumer: x.count.source.sourceId },
    { cause: x.production.successor.successorKey, consumer: x.count.source.sourceId },
  ];
  const contactOrigins = x.production.basis.contactOrigins;
  const ingressCut = { runtimeReference: runtime, physicalCut, at, ownerCensusHash, admissionJournalHash };
  const controllers = actual.after.map(self => ({ playerId: self.playerId, sourceId: self.activeCommand.sourceId,
    dueTick: Math.min(self.activeCommand.acceptedThroughTick, ...self.ownedMotionCoverage!.roleAuthorities.map(r => r.acceptedThroughTick)) }));
  const global: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    pitch_admission: { runtimeReference: runtime, pitchReference: pitch },
    bat_ball_field: { pitchReference: pitch, physicalOwners, contactOrigins },
    custody_successors: { wholeHistoryHash, carrierPlayerId: actual.history.carrierPlayerId, cursor: actual.history.cursor,
      ownedScheduledPlans: actual.history.ownedScheduledPlans ?? [], acquisitionPlans: actual.history.scheduledAcquisitionPlans ?? [],
      throwPlans: actual.history.scheduledThrowPlans ?? [], ownerCensus: census('batted_world_acquisitions', 'batted_world_executions', 'batted_world_field_executions'),
      representedSuccessors: actual.census.producer.base.successors },
    physical_rule_consumption: { policyReference: policy, stopReference: stop, consumptionReference: count,
      originalDispositionSuccessor: x.count.successor, pendingPhysicalChildKey: physicalChild, pendingOfficialChildKey: officialChild },
    communication_ingress: { ownerCensus: census('actual_communication_models', 'actual_call_communications'), initiatedDeliveries: [] },
    umpire_call: { ownerCensus: census('actual_first_base_umpire_setups', 'actual_first_base_umpire_observations', 'actual_first_base_umpire_calls'),
      acceptedFoulCall: null },
    operative_offense: { pitchReference: pitch, batter: x.runtime.membership.participants.find(p => p.role === 'batter'),
      consumptionReference: count, disposition: x.count.disposition, actorDisposition: 'acting' },
    live_rule_windows: { bodyBaseHistoryHashes: actual.baseHistories, contactOrigins, stopConsumptions,
      pendingPhysicalChildKey: physicalChild, pendingOfficialChildKey: officialChild },
    event_generation_consumption: { boundary: x.boundary, physicalOwners, ownerCensusHash, admissionJournalHash,
      generatedEvents: actual.census.producer.events.map(e => ({ eventKey: e.eventKey, owner: e.owner, occurredAt: e.occurredAt, availableAt: e.availableAt })),
      generatedSuccessors: actual.census.producer.successors.map(s => ({ successorKey: s.successorKey, basisEventKey: s.basisEventKey, owner: s.owner })),
      existingConsumptions: stopConsumptions },
    closure_fence: { acceptedEnd: { owner: 'actual_foul_play_ends', sourceId: source.sourceId,
      sourceVersion: source.sourceVersion, sourceHash: hash(source) }, ingressCut },
    settled_foul_stop: { policyReference: policy, stopReference: stop, consumptionReference: count,
      originalStopKey: x.production.originalStopKey, event: x.production.event, successor: x.production.successor },
  };
  const sources: LivePlaySource[] = [];
  const domainProofs = x.runtime.membership.producers.map(producer => {
    const self = producer.playerId === null ? null : actual.after.find(p => p.playerId === producer.playerId)!;
    const command = self?.activeCommand, roleAuthorities = self?.ownedMotionCoverage?.roleAuthorities;
    const future = self ? controllers.find(c => c.playerId === self.playerId)! : null;
    const bodyKey = producer.domain === 'body_motion' ? producer.producerId + ':motion' : null;
    const renewalKey = producer.domain === 'controller_renewal' ? producer.producerId + ':renewal:0' : null;
    let premises: Readonly<Record<string, unknown>>;
    if (producer.playerId === null) {
      premises = global[producer.domain];
      if (!premises) throw new Error('unmapped original foul global domain');
    } else if (producer.domain === 'body_motion') {
      premises = { playerId: self!.playerId, command, roleAuthorities, rootAuthority: self!.ownedMotionCoverage!.rootAuthority,
        physicalOwners, physicalThrough: at, futureThroughTick: future!.dueTick };
    } else if (producer.domain === 'observation_scheduling') {
      premises = { playerId: self!.playerId, runtimeReference: runtime, observationPolicy: x.runtime.membership.observationPolicy,
        ownerCensus: census('actual_field_observations'), initiatedSchedules: [] };
    } else if (producer.domain === 'observation_samples') {
      premises = { playerId: self!.playerId, ownerCensus: census('actual_field_observations'), physicalCut };
    } else if (producer.domain === 'actor_decision') {
      premises = { playerId: self!.playerId, participant: x.runtime.membership.participants.find(p => p.playerId === self!.playerId),
        ownerCensus: census('actual_field_observations', 'actual_defensive_plans', 'actual_defensive_decisions'),
        knownWork: x.executionSource.action.kind === 'owned_motion_v2' ? x.executionSource.action.knownWork.find(w => w.playerId === self!.playerId) : null,
        command, roleAuthorities, decisionInitiated: false };
    } else if (producer.domain === 'motor_issuance') {
      premises = { playerId: self!.playerId, ownerCensus: census('actual_defensive_decisions', 'actual_locomotion_receipts'),
        knownWork: x.executionSource.action.kind === 'owned_motion_v2' ? x.executionSource.action.knownWork.find(w => w.playerId === self!.playerId) : null,
        endpointReference: physicalOwners.at(-1), retainedContributor: x.endpoint.execution.kind === 'owned_motion_v2'
          ? x.endpoint.execution.composition.contributors.find(c => c.playerId === self!.playerId) : null };
    } else if (producer.domain === 'controller_renewal') {
      premises = { playerId: self!.playerId, controllerPolicy: x.runtime.membership.controllerPolicy,
        command, roleAuthorities, nextActualExpiryTick: future!.dueTick };
    } else throw new Error('unmapped original foul actor domain');
    const consumed = ['settled_foul_stop', 'physical_rule_consumption', 'event_generation_consumption'].includes(producer.domain) ? stopConsumptions : [];
    const futureWorkKeys = bodyKey ? [bodyKey] : renewalKey ? [renewalKey] : [];
    sources.push({ sourceId: producer.producerId, revision: 1,
      queue: { sourceId: producer.producerId, settledThroughTick: producer.domain === 'physical_rule_consumption' ? -1 : at.tick,
        nextPendingTick: renewalKey ? future!.dueTick : null },
      physical: bodyKey ? [{ workId: bodyKey, kind: x.runtime.membership.participants.find(p => p.playerId === self!.playerId)!.role === 'batter'
        ? 'runner_motion' : 'defender_motion', actorId: self!.playerId, throughTick: future!.dueTick, actionKey: command!.sourceId }] : [],
      decisions: renewalKey ? [{ workId: renewalKey, kind: 'actor_decision', actorId: self!.playerId, dueTick: future!.dueTick }] : [],
      intents: [], information: [], ruleWindows: producer.domain === 'physical_rule_consumption'
        ? [{ workId: physicalChild, kind: 'live_rule_window', windowId: physicalChild, openedAtTick: x.count.consumption.availableAt.tick }] : [] });
    return { producerId: producer.producerId, domain: producer.domain, playerId: producer.playerId,
      status: 'physical_dependencies_proved' as const, through: at, premises, consumed, futureWorkKeys };
  });
  const proof: FoulPreCorePhysicalProof = { version: 'actual_foul_pre_core_physical_proof_v1', runtimeReference: runtime,
    policyReference: policy, stopReference: stop, consumptionReference: count, physicalCut, boundary: x.boundary,
    admissionJournalHash, ownerCensus, ownerCensusHash, domainProofs, bodyBaseHistoryHashes: actual.baseHistories };
  return { proof, sources, futureWork: { controllers } };
};
