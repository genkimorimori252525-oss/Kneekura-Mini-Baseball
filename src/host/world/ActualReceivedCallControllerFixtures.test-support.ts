import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { expect } from 'vitest';
import { actualFirstBaseUmpireFixture } from './ActualFirstBaseUmpireFixtures.test-support';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import { ownedScheduledMotionPhase } from './OwnedScheduledMotionTiming.test-support';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { actualDefensiveBoundary } from './ActualDefensiveContext';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';
import { actualCommunicationObservationAt, type AcceptedActualCommunicationModel, type AcceptedActualCallCommunication } from './ActualCallCommunication';
import { openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import type { AcceptedActualFieldObservation } from './ActualFieldObservation';
import { openSqliteActualDefensiveDecisionStore } from './SqliteActualDefensiveDecisionStore';
import { openSqliteActualLocomotionStore } from './SqliteActualLocomotionStore';
import { openSqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const phase = <T>(name: string, run: () => T) => ownedScheduledMotionPhase(`received-call-prerequisite:${name}`, run);

// Existing communication test values, fixed before any row is accepted. This is
// a prospective synthetic fixture, never a rewrite of an old accepted artifact.
export const receivedCallPrerequisiteConditions = Object.freeze({ propagationDelayTicks: 2, recognitionBaseDelayTicks: 3,
  maxAdditionalRecognitionDelayTicks: 2, audibility: 0.9, recognition: 0.8, attention: 0.7, minimumRecognizableQuality: 0.1 });
// One is the least positive integer deadline: exercise actual pending -> issued
// ownership before reception, without tuning a deadline around a PlayEnd target.
const initialDecisionDelayTicks = 1;
const motorCoverageTicks = playerLocomotionCalibrationFixture().maxIntegrationStepTicks;
const originalExtraCoverageTicks = initialDecisionDelayTicks + motorCoverageTicks;
const primitiveRoles = ['body', 'glove', 'left_foot', 'right_foot', 'tag_hand'];

type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
const requireValue = <T>(value: T | null | undefined, name: string): T => {
  if (value === null || value === undefined) throw new Error(`received-call prerequisite missing ${name}`);
  return value;
};
const saved = (db: Db, table: string, sourceId: string) => requireValue(db.prepare(
  `SELECT source_json,snapshot_json FROM ${table} WHERE source_id=?`).get(sourceId), `${table}:${sourceId}`);

/** No mocked reader or caller-authored receipt. All writes use original Native
 * owners. Call semantics/replan/renewal are deliberately absent from this input. */
export const actualReceivedCallControllerFixture = () => {
  const c = receivedCallPrerequisiteConditions;
  if (originalExtraCoverageTicks <= c.propagationDelayTicks + c.recognitionBaseDelayTicks + c.maxAdditionalRecognitionDelayTicks + 1) {
    throw new Error('received-call prerequisite original coverage cannot include its reception boundary');
  }
  const path = join(mkdtempSync(join(tmpdir(), 'actual-received-call-prerequisite-')), 'state.sqlite');
  const x = phase('race-fixture', () => actualFirstBaseUmpireFixture(undefined, 0.04, 0.08, 0.1, path, {
    sourceId: 'received-call-covered-feet', coverageAfterCheckpointTicks: originalExtraCoverageTicks, phase,
  }));
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    expect(x.f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(path);
    if (x.move.action.kind !== 'motion_checkpoint_v1' || x.race.execution.kind !== 'first_base_race'
      || x.acquired.execution.kind !== 'acquisition' || x.acquired.execution.acquisition.kind !== 'secured') {
      throw new Error('received-call prerequisite covered physical race is missing');
    }
    const coverageThroughTick = x.move.action.coverageThroughTick, raceTick = x.move.action.checkpointThroughTick;
    const holderId = x.acquired.execution.acquisition.acquirerPlayerId;
    const frame = x.physical.frame, batter = requireValue(frame.batterActor, 'original batter');
    const playerIds = [batter.binding.playerId, ...batter.defenderBindings.map(b => b.playerId)];
    const playerId = requireValue(batter.defenderBindings.find(b => b.playerId !== holderId)?.playerId, 'non-holder defender');
    const pitchId = x.physical.source.sourceId;
    const prefix = (executionSourceId: string, db: Db = x.f.db) => {
      const fields = battedWorldFieldEvidenceFromSqlite(db), baseField = requireValue(fields.read(x.baseField.source.sourceId), 'base field');
      return { baseField, fields: fields.scope(baseField, baseField.source.sourceId),
        executions: battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField, executionSourceId) };
    };
    const selves = (executionSourceId: string) => phase(`kinematics:${executionSourceId}`,
      () => actualPlayersKinematicsFromPrefix(playerIds, prefix(executionSourceId)));
    const step = (sourceId: string, previousExecutionSourceId: string, throughTick: number, adoptMotor = false) => {
      const known = ownedMotionKnownWorkFromSqlite(x.f.db, pitchId, playerIds);
      const action: OwnedMotionV2Action = { kind: 'owned_motion_v2', checkpoint: { kind: 'motion', throughTick }, knownWork: known,
        contributions: selves(previousExecutionSourceId).map(s => adoptMotor && s.playerId === playerId
          ? { kind: 'motor', playerId, motorSourceId: requireValue(known.find(w => w.playerId === playerId)?.motorSourceId, 'motor head') }
          : { kind: 'retained', playerId: s.playerId, command: s.activeCommand }) };
      const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId, previousExecutionSourceId, action };
      x.sources.set(sourceId, source);
      return phase(`physical:${sourceId}`, () => x.executions.accept(sourceId));
    };
    const call = phase('umpire-call', () => {
      x.umpires.acceptSetup(x.setup.sourceId); x.umpires.observe(x.observation.sourceId);
      return x.umpires.advanceCall(x.call.sourceId);
    });
    if (call.schedule.kind !== 'called') throw new Error('received-call prerequisite operative call is missing');
    const originalRows = {
      race: saved(x.f.db, 'batted_world_field_executions', x.race.source.sourceId),
      feet: saved(x.f.db, 'batted_world_field_executions', x.move.sourceId),
      call: saved(x.f.db, 'actual_first_base_umpire_calls', call.source.sourceId),
    };
    const model: AcceptedActualCommunicationModel = { sourceId: 'received-call-communication-model', sourceVersion: 'synthetic-v1',
      gameId: frame.gameId, physicalPitchSourceId: pitchId, parameters: { version: 'fixed_receiver_conditions_v1',
        timing: 'exact_sent_plus_core_delay_ticks_v1', receivers: playerIds.map(playerId => ({ playerId, conditions: c })) } };
    const sendSource: AcceptedActualCallCommunication = { sourceId: 'received-call-send', sourceVersion: 'synthetic-v1',
      callSourceId: call.source.sourceId, modelSourceId: model.sourceId, currentExecutionSourceId: x.race.source.sourceId,
      previousCommunicationSourceId: null };
    const communicationSources = new Map([[sendSource.sourceId, sendSource]]);
    const communications = x.f.track(openSqliteActualCommunicationStore(path, { readAcceptedModel: id => id === model.sourceId ? model : null,
      readAcceptedCommunication: id => communicationSources.get(id) ?? null }));
    const sent = phase('schedule-communication', () => { communications.acceptModel(model.sourceId); return communications.accept(sendSource.sourceId); });
    const scheduled = requireValue(sent.recipients.find(r => r.playerId === playerId), 'scheduled receiver');
    if (scheduled.kind !== 'scheduled') throw new Error('received-call prerequisite must start before reception');
    const initial = selves(x.race.source.sourceId);
    const chain = phase('initial-decision', () => installOwnedScheduledDecision(x, playerId, x.race.source.sourceId,
      initialDecisionDelayTicks, motorCoverageTicks));
    const dueTick = chain.decision.receipt.scheduling.movementStartTick;
    const atDeadline = step('received-call-initial-decision-deadline', x.race.source.sourceId, dueTick);
    const issued = phase('issue-decision', () => chain.revise(atDeadline.source.sourceId, 'received-call-due'));
    const motor = phase('issue-motor', () => chain.issue(atDeadline.source.sourceId));
    const beforeAdoption = selves(atDeadline.source.sourceId);
    const adopted = step('received-call-adopt-initial-motor', atDeadline.source.sourceId, dueTick, true);
    const adoptedSelves = selves(adopted.source.sourceId);
    const incumbentRows = { decision: saved(x.f.db, 'actual_defensive_decisions', issued.source.sourceId),
      motor: saved(x.f.db, 'actual_locomotion_receipts', motor.source.sourceId),
      adoption: saved(x.f.db, 'batted_world_field_executions', adopted.source.sourceId),
      sent: saved(x.f.db, 'actual_call_communications', sent.source.sourceId) };
    const beforeSource: AcceptedActualFieldObservation = { ...chain.observer.observationSource, sourceId: 'received-call-before-reception-observation',
      previousObservationSourceId: issued.source.observationSourceId, executionSourceId: adopted.source.sourceId, communicationSourceId: sent.source.sourceId };
    chain.observer.observationSources.set(beforeSource.sourceId, beforeSource);
    const before = phase('before-reception-observation', () => chain.observer.observations.accept(beforeSource.sourceId));
    const receivedAt = { originTick: sent.clock.originTick, elapsedSeconds: scheduled.reception.receivedAtElapsedSeconds,
      tick: scheduled.reception.received.receivedAt };
    // This is the least executable integer boundary covering the actual scheduled
    // reception. It is not a caller-supplied reception timestamp or tuned latency.
    const receptionThroughTick = actualDefensiveBoundary(receivedAt, sent.clock.ticksPerSecond);
    const advanced = step('received-call-retain-incumbent-through-reception', adopted.source.sourceId, receptionThroughTick);
    const receiveSource: AcceptedActualCallCommunication = { ...sendSource, sourceId: 'received-call-reception',
      currentExecutionSourceId: advanced.source.sourceId, previousCommunicationSourceId: sent.source.sourceId };
    communicationSources.set(receiveSource.sourceId, receiveSource);
    const received = phase('receive-communication', () => communications.accept(receiveSource.sourceId));
    const recipient = requireValue(received.recipients.find(r => r.playerId === playerId), 'received defender');
    if (recipient.kind !== 'received') throw new Error('received-call prerequisite actual receiver pose/reception is missing');
    const afterSource: AcceptedActualFieldObservation = { ...beforeSource, sourceId: 'received-call-after-reception-observation',
      previousObservationSourceId: beforeSource.sourceId, executionSourceId: advanced.source.sourceId, communicationSourceId: received.source.sourceId };
    chain.observer.observationSources.set(afterSource.sourceId, afterSource);
    const after = phase('received-observation', () => chain.observer.observations.accept(afterSource.sourceId));
    const finalSelves = selves(advanced.source.sourceId);
    return { ...x, path, playerIds, playerId, holderId, pitchId, coverageThroughTick, raceTick, prefix, call, originalRows,
      model, communications, sent, scheduled, initial, chain, dueTick, atDeadline, issued, motor, beforeAdoption, adopted, adoptedSelves,
      incumbentRows, before, receivedAt, receptionThroughTick, advanced, received, recipient, after, finalSelves };
  } catch (error) { x.f.close(); throw error; }
};

/** Shared authentication for the standalone prerequisite and a later separately
 * selected missing-entry RED. Success proves fixture ownership only. */
export const qualifyActualReceivedCallPrerequisite = () => {
  const x = actualReceivedCallControllerFixture(); let closed = false;
  try {
    phase('authenticate-prerequisite', () => {
      expect(new Set(x.playerIds).size).toBe(10);
      expect(x.playerId).not.toBe(x.holderId); expect(x.playerId).not.toBe(x.physical.frame.batterActor!.binding.playerId);
      expect(x.physical.frame.prePitchRunner).toBeUndefined();
      expect(x.pitches.readAcceptedPitch(x.pitchId)).toEqual(x.physical);
      for (const binding of [x.physical.frame.batterActor!.binding, ...x.physical.frame.batterActor!.defenderBindings]) {
        expect(x.f.links.readLink(binding.personLinkSourceId)).toMatchObject({ playerId: binding.playerId, personId: binding.personId });
        const self = requireValue(x.initial.find(s => s.playerId === binding.playerId), 'original self');
        expect(self).toMatchObject({ personId: binding.personId, personLinkSourceId: binding.personLinkSourceId,
          physicalPitchSourceId: x.pitchId, gameDay: binding.gameDay, gameId: binding.gameId });
        expect(self.roles.map(r => r.role).sort()).toEqual(primitiveRoles);
        expect(self.activeCommand).toMatchObject({ kind: 'motion_checkpoint_v1', sourceId: x.move.sourceId,
          acceptedThroughTick: x.coverageThroughTick });
        expect(self.roles.every(r => r.canonicalActor.primitive.endTick === x.coverageThroughTick)).toBe(true);
      }
      if (x.race.execution.kind !== 'first_base_race') throw new Error('first-base race');
      expect(x.race.execution.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair' });
      expect(x.race.execution.groundRule?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'out' } });
      const chronology = requireValue(x.race.execution.groundRule?.actualChronology, 'race chronology');
      expect(chronology.firstDefenderControls).toHaveLength(1);
      expect(chronology.firstDefenderControls[0].playerId).toBe(x.holderId);
      expect(chronology.firstDefenderControls[0].elapsedSeconds).toBeLessThan(requireValue(chronology.runnerTouch, 'runner touch').elapsedSeconds);
      expect(x.call.schedule.kind).toBe('called'); expect(x.call.observation.physicalPitchSourceId).toBe(x.pitchId);
      expect(x.sent.callHash).toBe(hash(x.call)); expect(x.received.callHash).toBe(hash(x.call));
      expect(x.sent.emitted?.kind).toBe('callout'); expect(x.received.emitted).toEqual(x.sent.emitted);
      expect(x.sent.emitted?.content).toMatchObject({ callSourceId: x.call.source.sourceId, onFieldCall: x.call.onFieldCall });
      expect(x.initial[0].at.tick).toBe(x.raceTick);
      expect(x.initial[0].at.elapsedSeconds).toBe((x.raceTick - x.initial[0].at.originTick) / x.initial[0].ticksPerSecond);
      const feetStart = requireValue(x.feetStart, 'prospective feet integer start');
      expect(feetStart.moment.elapsedSeconds).toBe((feetStart.moment.ball.tick - feetStart.moment.originTick) / x.initial[0].ticksPerSecond);
      if (x.move.action.kind !== 'motion_checkpoint_v1') throw new Error('prospective covered feet');
      expect(x.move.action.availableAtTick).toBe(feetStart.moment.ball.tick);
      expect(x.move.previousExecutionSourceId).toBe(feetStart.executionSourceId);
      expect(x.chain.decision.receipt.lifecycle.status).toBe('pending_decision');
      expect(x.issued.receipt.lifecycle.status).toBe('issued');
      expect(x.dueTick).toBe(x.raceTick + initialDecisionDelayTicks);
      expect(x.issued.receipt.originObservationSourceId).toBe(x.chain.observation.source.sourceId);
      expect(x.issued.receipt.availability).toEqual(x.chain.observation.receipt.at);
      expect(x.chain.observation.receipt.perceived.communications).toEqual([]);
      expect(x.motor.decisionHash).toBe(hash(x.issued)); expect(x.motor.originDecisionHash).toBe(hash(x.chain.decision));
      expect(x.motor.receipt.startAt).toEqual(x.issued.receipt.lifecycle.issuedAt);
      expect(x.motor.receipt.coverageEndTick).toBe(x.coverageThroughTick);
      expect(x.motor.receipt.retainedRoles).toHaveLength(5);
      expect(x.motor.receipt.retainedRoles.every(r => r.command.sourceId === x.move.sourceId && r.acceptedThroughTick === x.coverageThroughTick)).toBe(true);
      for (const self of x.adoptedSelves) {
        const prior = requireValue(x.beforeAdoption.find(s => s.playerId === self.playerId), 'pre-adoption self');
        expect(self.root.position).toEqual(prior.root.position); expect(self.root.velocity).toEqual(prior.root.velocity);
        expect(self.roles.map(r => r.declaredPose)).toEqual(prior.roles.map(r => r.declaredPose));
        expect(self.ownedMotionCoverage?.roleAuthorities.every(r => r.command.sourceId === x.move.sourceId && r.acceptedThroughTick === x.coverageThroughTick)).toBe(true);
        if (self.playerId === x.playerId) {
          expect(self.ownedMotionCoverage?.rootAuthority).toMatchObject({ owner: 'actual_locomotion_receipts', sourceId: x.motor.source.sourceId,
            adoptionSourceId: x.adopted.source.sourceId, acceptedThroughTick: x.coverageThroughTick });
          expect(self.adoptions).toHaveLength(prior.adoptions.length + 1);
        } else { expect(self.activeCommand).toEqual(prior.activeCommand); expect(self.adoptions).toEqual(prior.adoptions); }
      }
      expect(x.before.receipt.communicationEvidence?.result.kind).toBe('scheduled');
      expect(x.before.receipt.perceived.communications).toEqual([]);
      expect(json(x.before.receipt.communicationEvidence)).not.toContain('onFieldCall');
      expect(x.receivedAt.elapsedSeconds).toBeGreaterThan(x.issued.receipt.lifecycle.issuedAt!.elapsedSeconds);
      expect(x.receivedAt.elapsedSeconds).toBeGreaterThan(x.before.receipt.at.elapsedSeconds);
      expect(x.recipient.reception).toEqual(x.scheduled.reception);
      expect(x.recipient.reception.received.event).toEqual(x.sent.emitted);
      expect(x.after.receipt.communicationEvidence).toEqual({ sourceId: x.received.source.sourceId, snapshotHash: hash(x.received),
        result: { playerId: x.playerId, kind: 'received', receivedAt: x.receivedAt,
          received: x.recipient.reception.received, receiverPosition: x.recipient.receiverPosition } });
      expect(x.after.receipt.perceived.communications).toEqual([x.recipient.reception.received]);
      expect(x.after.receipt.at.elapsedSeconds).toBeGreaterThanOrEqual(x.receivedAt.elapsedSeconds);
      expect(x.after.receipt.at.tick).toBe(x.receptionThroughTick);
      // Genuine immutable reception projected across exact instants in one
      // recorded tick. These projections are not additional Native observations
      // or evidence that the old initial decision consumed any call semantics.
      const beforeElapsed = ((x.receivedAt.tick - x.receivedAt.originTick - 1) / x.sent.clock.ticksPerSecond + x.receivedAt.elapsedSeconds) / 2;
      const sameTickBefore = { ...x.receivedAt, elapsedSeconds: beforeElapsed,
        tick: quantizeEventTick(x.receivedAt.originTick, beforeElapsed, x.sent.clock.ticksPerSecond) };
      expect(sameTickBefore.tick).toBe(x.receivedAt.tick); expect(beforeElapsed).toBeLessThan(x.receivedAt.elapsedSeconds);
      expect(actualCommunicationObservationAt(x.received, x.playerId, sameTickBefore).kind).toBe('scheduled');
      expect(actualCommunicationObservationAt(x.received, x.playerId, x.receivedAt).kind).toBe('received');
      const finalPrefix = x.prefix(x.advanced.source.sourceId), physical = battedWorldFieldPhysicalPrefix(finalPrefix);
      expect(physical.segments.at(-1)!.actors).toHaveLength(50);
      for (const self of x.finalSelves) {
        const adopted = requireValue(x.adoptedSelves.find(s => s.playerId === self.playerId), 'adopted self');
        // executedThrough advances; command origin, source, coverage and adoption
        // identity remain unchanged for every retained contribution.
        const { executedThrough: _a, ...beforeCommand } = adopted.activeCommand;
        const { executedThrough: _b, ...afterCommand } = self.activeCommand;
        expect(afterCommand).toEqual(beforeCommand);
        expect(self.ownedMotionCoverage?.rootAuthority).toEqual(adopted.ownedMotionCoverage?.rootAuthority);
        expect(self.ownedMotionCoverage?.roleAuthorities).toEqual(adopted.ownedMotionCoverage?.roleAuthorities);
        expect(self.roles.map(r => r.role).sort()).toEqual(primitiveRoles);
        expect(self.roles.every(r => r.canonicalActor.primitive.endTick === x.coverageThroughTick)).toBe(true);
      }
      const at = x.receivedAt.elapsedSeconds;
      const segment = requireValue(physical.segments.filter(s => s.startElapsedSeconds <= at && s.endElapsedSeconds >= at).at(-1), 'receiver segment');
      const body = requireValue(segment.actors.find(a => a.playerId === x.playerId && a.primitive.role === 'body'), 'receiver body');
      const p = body.primitive, dt = (x.receivedAt.originTick - p.startTick) / p.ticksPerSecond + at - (body.startElapsedSeconds ?? 0);
      for (const axis of ['x', 'y', 'z'] as const) expect(x.recipient.receiverPosition[axis]).toBe(
        p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt);
      expect(saved(x.f.db, 'batted_world_field_executions', x.race.source.sourceId)).toEqual(x.originalRows.race);
      expect(saved(x.f.db, 'batted_world_field_executions', x.move.sourceId)).toEqual(x.originalRows.feet);
      expect(saved(x.f.db, 'actual_first_base_umpire_calls', x.call.source.sourceId)).toEqual(x.originalRows.call);
      expect(saved(x.f.db, 'actual_defensive_decisions', x.issued.source.sourceId)).toEqual(x.incumbentRows.decision);
      expect(saved(x.f.db, 'actual_locomotion_receipts', x.motor.source.sourceId)).toEqual(x.incumbentRows.motor);
      expect(saved(x.f.db, 'batted_world_field_executions', x.adopted.source.sourceId)).toEqual(x.incumbentRows.adoption);
      expect(saved(x.f.db, 'actual_call_communications', x.sent.source.sourceId)).toEqual(x.incumbentRows.sent);
    });
    x.f.close(); closed = true;
    phase('close-all-and-reopen', () => {
      const stores: { close(): void }[] = [], track = <T extends { close(): void }>(s: T) => { stores.push(s); return s; };
      try {
        const db = track(new DatabaseSync(x.path));
        expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
        expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(x.path);
        expect(readOriginalPhysicalPitchPrefixFromSqlite(db, x.pitchId).at(-1)).toEqual(x.physical);
        const links = track(openSqlitePlayerPersonLinkStore(x.path));
        for (const self of x.initial) expect(links.readLink(self.personLinkSourceId)).toMatchObject({ playerId: self.playerId, personId: self.personId });
        const calls = track(openSqliteActualFirstBaseUmpireStore(x.path));
        expect(calls.readCall(x.call.source.sourceId)).toEqual(x.call);
        const decisions = track(openSqliteActualDefensiveDecisionStore(x.path)), motors = track(openSqliteActualLocomotionStore(x.path));
        expect(decisions.read(x.chain.decision.source.sourceId)).toEqual(x.chain.decision);
        expect(decisions.read(x.issued.source.sourceId)).toEqual(x.issued);
        expect(motors.read(x.motor.source.sourceId)).toEqual(x.motor);
        const communications = track(openSqliteActualCommunicationStore(x.path)), observations = track(openSqliteActualFieldObservationStore(x.path));
        expect(communications.read(x.sent.source.sourceId)).toEqual(x.sent);
        expect(communications.read(x.received.source.sourceId)).toEqual(x.received);
        expect(observations.read(x.before.source.sourceId)).toEqual(x.before);
        expect(observations.read(x.after.source.sourceId)).toEqual(x.after);
        const reopenedPrefix = x.prefix(x.advanced.source.sourceId, db);
        expect(reopenedPrefix.executions.find(v => v.source.sourceId === x.race.source.sourceId)).toEqual(x.race);
        expect(reopenedPrefix.executions.find(v => v.source.sourceId === x.adopted.source.sourceId)).toEqual(x.adopted);
        expect(actualPlayersKinematicsFromPrefix(x.playerIds, reopenedPrefix)).toEqual(x.finalSelves);
      } finally { for (const store of stores.reverse()) store.close(); }
    });
    return { databasePath: x.path, playerId: x.playerId, physicalPitchSourceId: x.pitchId, callSourceId: x.call.source.sourceId,
      initialDecisionSourceId: x.issued.source.sourceId, initialMotorSourceId: x.motor.source.sourceId,
      adoptionSourceId: x.adopted.source.sourceId, communicationSourceId: x.received.source.sourceId,
      observationSourceId: x.after.source.sourceId, receivedAt: x.receivedAt, observationAvailableAt: x.after.receipt.at,
      inputHash: hash({ model: x.model, coveredMotion: x.move, decision: x.chain.decision.source }),
      // The summary is a bounded digest manifest. Do not concatenate authentic
      // nested snapshots into a new generic inert document or change v2's own
      // archive hash convention merely for diagnostics.
      evidenceHash: hash({ call: hash(x.call), decision: hash(x.issued), motor: hash(x.motor),
        adoption: ownedScheduledMotionArchiveHash(x.adopted), received: hash(x.received), observed: hash(x.after) }) };
  } finally { if (!closed) x.f.close(); }
};
