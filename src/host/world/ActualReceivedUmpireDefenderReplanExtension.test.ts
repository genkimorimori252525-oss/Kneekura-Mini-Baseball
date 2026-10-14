import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { ReceivedUmpireDefenderReplanInput } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';
import { receivedCallPrerequisiteConditions } from './ActualReceivedCallControllerFixtures.test-support';
import { actualDefensiveBoundary } from './ActualDefensiveContext';
import { actualPlayerKinematicsFromPrefix, actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedWorldFieldExecutionStore, battedWorldFieldExecutionEvidenceFromSqlite,
  withBattedWorldPhysicalReadTraversal, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { openSqliteActualFirstBaseUmpireStore, actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { openSqliteActualCommunicationStore, actualCommunicationEvidenceFromSqlite } from './SqliteActualCommunicationStore';
import { actualCommunicationObservationAt, type AcceptedActualCommunicationModel, type AcceptedActualCallCommunication } from './ActualCallCommunication';
import { openSqliteActualFieldObservationStore, actualFieldObservationEvidenceFromSqlite, type DurableActualFieldObservation } from './SqliteActualFieldObservationStore';
import type { AcceptedActualFieldObservation } from './ActualFieldObservation';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { actualDefensivePlanEvidenceFromSqlite } from './SqliteActualDefensivePlanStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import type { AcceptedActualReceivedUmpireDefenderReplan } from './ActualReceivedUmpireDefenderReplanInput';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { receivedArtifactSha as sha, receivedOwnerStageInput, receivedFreshOutput,
  receivedStageCensus, assertReceivedStageDelta } from './ActualReceivedUmpireDefenderReplanGenuine.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const selected = process.env.BASEBALL_RECEIVED_CALL_STAGE_INPUT && process.env.BASEBALL_RECEIVED_CALL_STAGE_OUTPUT;
// Only the selected receive and after-observation have reviewed 600-second gates.
// Every other continuation retains its independently supervised 300-second cap.
const testTimeout = selected && ['receive', 'after-observation'].includes(JSON.parse(readFileSync(process.env.BASEBALL_RECEIVED_CALL_STAGE_INPUT!, 'utf8')).step)
  ? 600_000 : 300_000;

it.runIf(!!selected)('extends the authenticated public origin through genuine scheduled and received observations without rewriting history', () => {
  const startedAt = process.hrtime.bigint();
  const previous = receivedOwnerStageInput(), directory = receivedFreshOutput(); mkdirSync(directory, { mode: 0o700 });
  const path = join(directory, 'received.sqlite'); writeFileSync(path, previous.bytes, { flag: 'wx', mode: 0o600 });
  const db = new DatabaseSync(path), closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(value: T): T => { closables.push(value); return value; };
  const read = <T>(work: () => T): T => {
    db.exec('BEGIN');
    try { const changes = db.prepare('SELECT total_changes() AS n').get();
      const value = withBattedWorldPhysicalReadTraversal(db, work);
      expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes); db.exec('COMMIT'); return value;
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  };
  const progress = (name: string) => writeSync(1, JSON.stringify({ schema: 'received_owner_stage_timing_v1',
    step: previous.input.step, name, elapsedSeconds: Number(process.hrtime.bigint() - startedAt) / 1e9 })+'\n');
  let closed = false;
  try {
    const before = receivedStageCensus(db); expect(hash(before)).toBe(previous.receipt.finalCensusHash);
    const ids = previous.origin.identities as Record<string, string>, playerId = ids.player;
    const prefix = (through: string) => {
      const execution = battedWorldFieldExecutionEvidenceFromSqlite(db).readWithExecutions(through);
      if (!execution) throw new Error('qualified physical prefix is missing');
      const baseField = execution.value.baseField;
      return { baseField, fields: battedWorldFieldEvidenceFromSqlite(db).scope(baseField, baseField.source.sourceId), executions: execution.executions };
    };
    progress('authenticate-original-context');
    const context = read(() => {
      const runtime = actualLiveRuntimeEvidenceFromSqlite(db).read('live-play-runtime');
      if (!runtime) throw new Error('original live runtime is missing');
      expect(hash(runtime)).toBe(previous.origin.hashes.runtime);
      const originalPrefix = prefix(ids.execution), baseField = originalPrefix.baseField;
      const players = runtime.membership.participants.map(p => p.playerId);
      const initial = actualPlayersKinematicsFromPrefix(players, originalPrefix);
      expect(hash(initial.find(p => p.playerId === playerId))).toBe(previous.origin.hashes.self);
      const coverage = Math.min(...initial.flatMap(s => [s.activeCommand.acceptedThroughTick,
        s.ownedMotionCoverage?.rootAuthority.acceptedThroughTick ?? Infinity, ...s.roles.map(r => r.canonicalActor.primitive.endTick),
        ...(s.ownedMotionCoverage?.roleAuthorities.map(r => r.acceptedThroughTick) ?? [])]));
      expect(coverage).toBe(previous.origin.minimumActualCoverageThroughTick);
      return { runtime, baseField, players, initial, coverage,
        tps: baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond };
    });
    const { runtime, baseField, players, initial, coverage, tps } = context, pitchId = ids.physicalPitch;
    const step = previous.input.step;
    const additions: Record<string, number> = {}, heads: string[] = [], newTables: string[] = [];
    let expected: unknown;
    if (step === 'call-due' || step === 'reception-cut') {
      const previousId = step === 'call-due' ? ids.execution : 'received-input-call-due';
      const throughTick = step === 'call-due' ? initial[0].at.tick + 3 : read(() => {
        const sent = actualCommunicationEvidenceFromSqlite(db).read('received-input-send');
        const recipient = sent?.recipients.find(r => r.playerId === playerId);
        if (!sent || recipient?.kind !== 'scheduled') throw new Error('genuine scheduled recipient is missing');
        return actualDefensiveBoundary({ originTick: sent.clock.originTick,
          elapsedSeconds: recipient.reception.receivedAtElapsedSeconds, tick: recipient.reception.received.receivedAt }, tps);
      });
      expect(throughTick).toBeLessThan(coverage);
      progress('derive-retained-contributions');
      const action = read(() => ({ kind: 'owned_motion_v2' as const,
        checkpoint: { kind: step === 'call-due' ? 'retained_quantizer_bucket_v1' as const : 'motion' as const, throughTick },
        knownWork: ownedMotionKnownWorkFromSqlite(db, pitchId, players),
        contributions: actualPlayersKinematicsFromPrefix(players, prefix(previousId))
          .map(s => ({ kind: 'retained' as const, playerId: s.playerId, command: s.activeCommand })) }));
      const source: AcceptedBattedWorldFieldExecution = { sourceId: 'received-input-'+step, sourceVersion: 'public-origin-v1',
        baseFieldSourceId: baseField.source.sourceId, previousExecutionSourceId: previousId, action };
      const writer = track(openSqliteBattedWorldFieldExecutionStore(path, battedWorldFieldEvidenceFromSqlite(db),
        { readAcceptedExecution: id => id === source.sourceId ? source : null }));
      progress('accept-physical-owner'); writer.accept(source.sourceId); progress('physical-owner-accepted');
      Object.assign(additions, { batted_world_field_executions: 1, actual_live_play_admissions: 1 }); heads.push('batted_world_field_execution_heads');
    } else if (step === 'operative-call') {
      const waiting = read(() => actualFirstBaseUmpireEvidenceFromSqlite(db).readCall('received-input-call-scheduled'));
      if (!waiting || waiting.schedule.kind !== 'scheduled') throw new Error('qualified scheduled call is missing');
      const source = { ...waiting.source, sourceId: 'received-input-operative-call', currentExecutionSourceId: 'received-input-call-due' };
      const owner = track(openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => null,
        readAcceptedObservation: () => null, readAcceptedCall: id => id === source.sourceId ? source : null }));
      progress('accept-operative-call'); expect(owner.advanceCall(source.sourceId).schedule).toMatchObject({ kind: 'called', call: 'out' });
      Object.assign(additions, { actual_first_base_umpire_calls: 1, actual_live_play_admissions: 1 });
    } else if (step === 'send' || step === 'receive') {
      const model: AcceptedActualCommunicationModel = { sourceId: 'received-input-communication-model', sourceVersion: 'public-origin-v1',
        gameId: runtime.gameId, physicalPitchSourceId: pitchId, parameters: { version: 'fixed_receiver_conditions_v1',
          timing: 'exact_sent_plus_core_delay_ticks_v1', receivers: players.map(playerId => ({ playerId, conditions: receivedCallPrerequisiteConditions })) } };
      const source: AcceptedActualCallCommunication = { sourceId: step === 'send' ? 'received-input-send' : 'received-input-received',
        sourceVersion: 'public-origin-v1', callSourceId: 'received-input-operative-call', modelSourceId: model.sourceId,
        currentExecutionSourceId: step === 'send' ? 'received-input-call-due' : 'received-input-reception-cut',
        previousCommunicationSourceId: step === 'send' ? null : 'received-input-send' };
      const owner = track(openSqliteActualCommunicationStore(path, { readAcceptedModel: id => id === model.sourceId ? model : null,
        readAcceptedCommunication: id => id === source.sourceId ? source : null }));
      if (step === 'send') {
        progress('accept-communication-model'); owner.acceptModel(model.sourceId);
        Object.assign(additions, { actual_communication_models: 1, actual_call_communication_heads: 1 });
        newTables.push('actual_communication_models', 'actual_call_communications', 'actual_call_communication_heads');
      } else heads.push('actual_call_communication_heads');
      progress('accept-communication'); const value = owner.accept(source.sourceId);
      expect(value.recipients.find(r => r.playerId === playerId)?.kind).toBe(step === 'send' ? 'scheduled' : 'received');
      Object.assign(additions, { actual_call_communications: 1, actual_live_play_admissions: 1 });
    } else if (step === 'before-observation' || step === 'after-observation') {
      const prior = read(() => actualFieldObservationEvidenceFromSqlite(db).read(step === 'before-observation' ? ids.observation : 'received-input-before'));
      if (!prior) throw new Error('qualified prior observation is missing');
      const source: AcceptedActualFieldObservation = { ...prior.source,
        sourceId: step === 'before-observation' ? 'received-input-before' : 'received-input-after', sourceVersion: 'public-origin-v1',
        previousObservationSourceId: prior.source.sourceId,
        executionSourceId: step === 'before-observation' ? 'received-input-call-due' : 'received-input-reception-cut',
        communicationSourceId: step === 'before-observation' ? 'received-input-send' : 'received-input-received' };
      const owner = track(openSqliteActualFieldObservationStore(path, { readAcceptedObservation: id => id === source.sourceId ? source : null }));
      progress('accept-recipient-observation'); const value = owner.accept(source.sourceId);
      expect(value.receipt.communicationEvidence?.result.kind).toBe(step === 'before-observation' ? 'scheduled' : 'received');
      expect(value.receipt.perceived.communications).toHaveLength(step === 'before-observation' ? 0 : 1);
      Object.assign(additions, { actual_field_observations: 1, actual_live_play_admissions: 1 }); heads.push('actual_field_observation_heads');
    } else if (step === 'expected-input') {
      progress('derive-independent-core-input');
      expected = read(() => {
        const decision = actualDefensiveDecisionEvidenceFromSqlite(db).read(ids.decision)!;
        const motor = actualLocomotionEvidenceFromSqlite(db).read(ids.motor)!;
        const observations = actualFieldObservationEvidenceFromSqlite(db), original = observations.read(ids.observation)!;
        const before = observations.read('received-input-before')!, after = observations.read('received-input-after')!;
        expect(hash(decision)).toBe(previous.origin.hashes.decision); expect(hash(motor)).toBe(previous.origin.hashes.motor);
        expect(hash(original)).toBe(previous.origin.hashes.observation);
        const communicationOwner = actualCommunicationEvidenceFromSqlite(db), sent = communicationOwner.read('received-input-send')!;
        const received = communicationOwner.read('received-input-received')!;
        const call = actualFirstBaseUmpireEvidenceFromSqlite(db).readCall('received-input-operative-call')!;
        const adopted = prefix('received-input-reception-cut').executions.find(v => v.source.sourceId === ids.adoption)!;
        if (adopted.execution.kind !== 'owned_motion_v2') throw new Error('original adoption missing');
        const adoptedAt = adopted.execution.adoption.adoptedAt;
        const decisionModel = playerDecisionModelEvidenceFromSqlite(db).read(decision.source.decisionModelSourceId)!;
        const plan = actualDefensivePlanEvidenceFromSqlite(db).read(decision.source.planSourceId)!;
    const make = (observed: DurableActualFieldObservation, communication: typeof received, executionId: string) => {
      const self = actualPlayerKinematicsFromPrefix(playerId, prefix(executionId)), ratings = decisionModel.fieldingModel.source.ratings;
      const reception = actualCommunicationObservationAt(communication, playerId, observed.receipt.at);
      if (reception.kind !== 'scheduled' && reception.kind !== 'received') throw new Error('expected authentic reception');
      const source: AcceptedActualReceivedUmpireDefenderReplan = { sourceId: observed.source.sourceId+'-replan', sourceVersion: 'public-origin-v1',
        capability: 'received_umpire_defender_replan_v1', physicalPitchSourceId: pitchId, playerId, observationSourceId: observed.source.sourceId,
        currentExecutionSourceId: executionId, predecessorDecisionSourceId: decision.source.sourceId, predecessorMotorSourceId: motor.source.sourceId,
        predecessorAdoptionSourceId: adopted.source.sourceId, policySourceId: null, previousReplanSourceId: null };
      const input: ReceivedUmpireDefenderReplanInput = { processSourceId: source.sourceId, physicalPitchSourceId: pitchId, playerId,
        receiverRole: 'defender', ticksPerSecond: tps, currentCut: self.at,
        communication: { sourceId: communication.source.sourceId, hash: hash(communication), originCommunicationSourceId: communication.originCommunicationSourceId, callSourceId: call.source.sourceId },
        observation: { sourceId: observed.source.sourceId, hash: hash(observed), at: observed.receipt.at, perceived: observed.receipt.perceived,
          reception: reception.kind === 'scheduled' ? { kind: 'scheduled', dueAt: reception.dueAt }
            : { kind: 'received', receivedAt: reception.receivedAt, received: reception.received, order: null } },
        predecessor: { originDecisionSourceId: decision.receipt.originDecisionSourceId, originObservationSourceId: original.source.sourceId,
          originObservationHash: hash(original), availability: decision.receipt.availability, informationOrder: null,
          observationSourceId: decision.source.observationSourceId, observationHash: decision.observationHash,
          observedThrough: decision.receipt.observedThrough, decisionTick: decision.receipt.scheduling.decisionTick,
          issuedAt: decision.receipt.lifecycle.issuedAt!, command: { sourceId: decision.source.sourceId, hash: hash(decision), selected: decision.receipt.selected, target: decision.receipt.target },
          motor: { sourceId: motor.source.sourceId, hash: hash(motor), adoptionSourceId: adopted.source.sourceId, adoptedAt } },
        model: { sourceId: decisionModel.source.sourceId, hash: hash(decisionModel), situationalAwareness: ratings.situationalAwareness,
          firstStepAbility: ratings.firstStep, ...decisionModel.source.calibration },
        contextualPlan: { sourceId: plan.source.sourceId, hash: hash(plan), priorities: plan.source.priorities }, policy: null, previous: null };
      return { source, input };
    };

        return { before: make(before, sent, 'received-input-call-due'), after: make(after, received, 'received-input-reception-cut') };
      });
    } else throw new Error('unsupported received owner continuation');
    progress('verify-exact-delta');
    const after = receivedStageCensus(db); assertReceivedStageDelta(before, after, additions, heads, newTables);
    const finalCensusHash = hash(after);
    for (const owner of closables.reverse()) owner.close(); db.close(); closed = true;
    const reopened = new DatabaseSync(path, { readOnly: true });
    try { expect(hash(receivedStageCensus(reopened))).toBe(finalCensusHash); } finally { reopened.close(); }
    expect(existsSync(path+'-wal') ? statSync(path+'-wal').size : 0).toBe(0);
    expect(sha(readFileSync(previous.checkpoint.database.path))).toBe(previous.checkpoint.database.sha256);
    writeFileSync(join(directory, 'extension.json'), JSON.stringify({
      schema: step === 'expected-input' ? 'received_call_prospective_extension_v1' : 'received_call_owner_continuation_v1',
      completedStep: step, predecessorReceiptSha256: previous.checkpoint.receipt.sha256,
      originalDatabaseSha256: previous.origin.originalDatabaseSha256,
      originalAuthenticationReceiptSha256: previous.input.originAuthentication.sha256,
      outputDatabaseSha256: sha(readFileSync(path)), finalCensusHash, ...(expected ? { expected } : {}),
      bridgeCredit: 0, recoveredPR350Credit: 0 }, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
    progress('closed');
  } finally { if (!closed) { for (const owner of closables.reverse()) owner.close(); if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } }
}, testTimeout);
