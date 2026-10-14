import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveReceivedUmpireDefenderReplan, type ReceivedUmpireDefenderReplanInput,
  type ReceivedUmpireDefenderReplan } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';
import { actualObservationId as id } from './ActualFieldObservation';
import { actualDefensiveContextFromSqlite, defensiveFields as fields } from './ActualDefensiveContext';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualDefensivePlanEvidenceFromSqlite } from './SqliteActualDefensivePlanStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { actualCommunicationEvidenceFromSqlite } from './SqliteActualCommunicationStore';
import { actualCommunicationObservationAt } from './ActualCallCommunication';
import { actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** References only. No accepted call-policy or durable replan owner exists yet. */
export type AcceptedActualReceivedUmpireDefenderReplan = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'received_umpire_defender_replan_v1';
  physicalPitchSourceId: string; playerId: string; observationSourceId: string; currentExecutionSourceId: string;
  predecessorDecisionSourceId: string; predecessorMotorSourceId: string; predecessorAdoptionSourceId: string;
  policySourceId: null; previousReplanSourceId: null;
}>;
/** An authenticated read projection, never a persisted decision, motor or adoption. */
export type ActualReceivedUmpireDefenderReplanInputEvidence = Readonly<{
  source: AcceptedActualReceivedUmpireDefenderReplan;
  dependencyHashes: Readonly<{ observation: string; communication: string; call: string; decision: string;
    originObservation: string; motor: string; adoption: string; currentExecution: string; self: string;
    decisionModel: string; contextualPlan: string }>;
  input: ReceivedUmpireDefenderReplanInput; replan: ReceivedUmpireDefenderReplan;
}>;
const sourceKeys = ['sourceId', 'sourceVersion', 'capability', 'physicalPitchSourceId', 'playerId', 'observationSourceId',
  'currentExecutionSourceId', 'predecessorDecisionSourceId', 'predecessorMotorSourceId', 'predecessorAdoptionSourceId',
  'policySourceId', 'previousReplanSourceId'];
const accepted = (raw: AcceptedActualReceivedUmpireDefenderReplan) => {
  const source = cloneInert(raw);
  if (!fields(source, sourceKeys) || source.capability !== 'received_umpire_defender_replan_v1'
    || ![source.sourceId, source.sourceVersion, source.physicalPitchSourceId, source.playerId, source.observationSourceId,
      source.currentExecutionSourceId, source.predecessorDecisionSourceId, source.predecessorMotorSourceId,
      source.predecessorAdoptionSourceId].every(id)) throw new Error('invalid received-call defender input Source');
  if (source.policySourceId !== null || source.previousReplanSourceId !== null) {
    throw new Error('unsupported received-call policy or previous replan reference');
  }
  return freeze(source);
};

/** Reauthenticate original owners on the caller's native main snapshot. The
 * information cut stays pinned even when later owner metadata is visible. */
export const actualReceivedUmpireDefenderReplanInputEvidenceFromSqlite = (db: DatabaseSync) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('received-call input requires its native read connection');
  const derive = (source: AcceptedActualReceivedUmpireDefenderReplan): ActualReceivedUmpireDefenderReplanInputEvidence => {
    const observations = actualFieldObservationEvidenceFromSqlite(db), observation = observations.read(source.observationSourceId);
    if (!observation) throw new Error('received-call original observation is missing');
    if (observation.source.physicalPitchSourceId !== source.physicalPitchSourceId || observation.source.playerId !== source.playerId
      || observation.source.communicationSourceId === undefined || observation.receipt.communicationEvidence === undefined) {
      throw new Error('received-call original observation recipient or communication differs');
    }
    const contexts = actualDefensiveContextFromSqlite(db);
    const context = contexts.read(source.observationSourceId, source.physicalPitchSourceId, source.playerId);
    const decisions = actualDefensiveDecisionEvidenceFromSqlite(db), decision = decisions.read(source.predecessorDecisionSourceId);
    if (!decision || decision.source.physicalPitchSourceId !== source.physicalPitchSourceId || decision.source.playerId !== source.playerId
      || decision.receipt.lifecycle.status !== 'issued' || decision.receipt.lifecycle.issuedAt === null
      || decision.receipt.lifecycle.issuedBySourceId !== decision.source.sourceId
      || !observation.history.some(s => s.sourceId === decision.source.observationSourceId)) {
      throw new Error('received-call original issued incumbent differs');
    }
    const origin = decisions.read(decision.receipt.originDecisionSourceId);
    if (!origin || origin.source.observationSourceId !== decision.receipt.originObservationSourceId) {
      throw new Error('received-call incumbent origin differs');
    }
    const original = contexts.read(origin.source.observationSourceId, source.physicalPitchSourceId, source.playerId);
    const model = playerDecisionModelEvidenceFromSqlite(db).read(decision.source.decisionModelSourceId);
    const plan = actualDefensivePlanEvidenceFromSqlite(db).read(decision.source.planSourceId);
    if (!model || !plan || decision.decisionModelHash !== hash(model) || decision.planHash !== hash(plan)
      || json(original.binding) !== json(context.binding) || json(original.fieldingModel) !== json(context.fieldingModel)
      || json(model.fieldingModel) !== json(original.fieldingModel) || json(plan.binding) !== json(original.binding)
      || original.ticksPerSecond !== context.ticksPerSecond) {
      throw new Error('received-call original Player/Person/day/model/plan differs');
    }
    const fieldOwner = battedWorldFieldEvidenceFromSqlite(db), baseField = fieldOwner.read(observation.source.baseFieldSourceId);
    if (!baseField) throw new Error('received-call original field is missing');
    const executions = battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField, source.currentExecutionSourceId);
    const current = executions.at(-1), adoption = executions.find(v => v.source.sourceId === source.predecessorAdoptionSourceId);
    const contains = (sourceId: string | null) => sourceId === null || executions.some(v => v.source.sourceId === sourceId);
    if (!current || current.source.sourceId !== source.currentExecutionSourceId || !adoption
      || !contains(observation.source.executionSourceId) || !contains(original.observation.source.executionSourceId)) {
      throw new Error('received-call observation or adoption is outside the executed prefix');
    }
    const prefix = { baseField, fields: fieldOwner.scope(baseField, baseField.source.sourceId), executions };
    if (!prefix.fields.some(value => value.source.sourceId === original.observation.source.baseFieldSourceId)) {
      throw new Error('received-call incumbent origin field is outside the original prefix');
    }
    const self = actualPlayerKinematicsFromPrefix(source.playerId, prefix), cut = self.at, binding = original.binding;
    const noLater = (at: typeof cut) => at.originTick === cut.originTick && at.elapsedSeconds <= cut.elapsedSeconds;
    if (self.physicalPitchSourceId !== source.physicalPitchSourceId || self.gameId !== binding.gameId || self.gameDay !== binding.gameDay
      || self.personId !== binding.personId || self.personLinkSourceId !== binding.personLinkSourceId
      || self.origin.kind !== 'defender_world_projection' || self.ticksPerSecond !== context.ticksPerSecond
      || !noLater(observation.receipt.at) || !noLater(decision.receipt.observedThrough) || !noLater(decision.receipt.lifecycle.issuedAt)) {
      throw new Error('received-call original body, clock or executed cut differs');
    }
    const motor = actualLocomotionEvidenceFromSqlite(db).read(source.predecessorMotorSourceId);
    if (!motor || motor.source.physicalPitchSourceId !== source.physicalPitchSourceId || motor.source.playerId !== source.playerId
      || motor.source.decisionSourceId !== decision.source.sourceId || motor.source.baseFieldSourceId !== baseField.source.sourceId
      || motor.decisionHash !== hash(decision) || motor.originDecisionHash !== hash(origin)
      || motor.originObservationHash !== hash(original.observation) || adoption.execution.kind !== 'owned_motion_v2') {
      throw new Error('received-call original motor or physical adoption differs');
    }
    const physical = adoption.execution, contributor = physical.composition.contributors.find(c => c.playerId === source.playerId);
    const adopted = physical.adoption.contributors.filter(c => c.playerId === source.playerId && c.motorSourceId === motor.source.sourceId);
    const root = self.ownedMotionCoverage?.rootAuthority;
    const active = self.activeCommand;
    if (!contributor || contributor.kind !== 'motor' || contributor.motorSourceId !== motor.source.sourceId
      || contributor.motorHash !== hash(motor) || contributor.personId !== self.personId || adopted.length !== 1
      || !physical.composition.knownWork.some(w => w.playerId === source.playerId && w.decisionSourceId === decision.source.sourceId
        && w.motorSourceId === motor.source.sourceId && w.decisionHash === hash(decision))
      || json(contributor.command) !== json(motor.receipt.command) || json(contributor.retainedRoles) !== json(motor.receipt.retainedRoles)
      || json(physical.adoption.adoptedAt) !== json(motor.receipt.startAt) || !noLater(physical.adoption.adoptedAt)
      || root?.owner !== 'actual_locomotion_receipts' || root.sourceId !== motor.source.sourceId || root.sourceHash !== hash(motor.source)
      || root.adoptionSourceId !== adoption.source.sourceId || root.adoptionSourceHash !== hash(adoption.source)
      // Root coverage metadata can survive a later legacy physical command.
      // Prove the selected adoption is still active, independently of the
      // semantic decision command passed to Core below.
      || active.kind !== 'owned_motion_v2' || active.owner !== 'batted_world_field_executions'
      || active.sourceId !== adoption.source.sourceId || active.sourceVersion !== adoption.source.sourceVersion
      || active.sourceHash !== hash(adoption.source) || active.adoptionSourceId !== adoption.source.sourceId
      || active.adoptionSourceHash !== hash(adoption.source) || json(active.adoptedAt) !== json(physical.adoption.adoptedAt)
      || json(active.executedThrough) !== json(cut) || active.acceptedThroughTick !== motor.receipt.coverageEndTick
      || json(self.ownedMotionCoverage?.roleAuthorities) !== json(contributor.roleAuthorities)) {
      throw new Error('received-call incumbent command, role authority or adoption differs');
    }
    const communication = actualCommunicationEvidenceFromSqlite(db).read(observation.source.communicationSourceId);
    const frame = baseField.response.touch.worldContact.flight.physicalPitch.frame;
    if (!communication || communication.physicalPitchSourceId !== source.physicalPitchSourceId
      || communication.gameId !== frame.gameId || communication.playId !== frame.match.playId
      || communication.clock.ticksPerSecond !== self.ticksPerSecond || !noLater(communication.evaluatedThrough)
      || !contains(communication.source.currentExecutionSourceId)) throw new Error('received-call communication original scope or cut differs');
    const call = actualFirstBaseUmpireEvidenceFromSqlite(db).readCall(communication.source.callSourceId);
    if (!call || communication.callHash !== hash(call) || call.observation.physicalPitchSourceId !== source.physicalPitchSourceId
      || !contains(call.source.currentExecutionSourceId)) throw new Error('received-call original call owner differs');
    const reception = actualCommunicationObservationAt(communication, source.playerId, observation.receipt.at);
    if (json(observation.receipt.communicationEvidence) !== json({ sourceId: communication.source.sourceId,
      snapshotHash: hash(communication), result: reception })) throw new Error('received-call observation communication hash or projection differs');
    if (reception.kind !== 'received' && reception.kind !== 'scheduled') throw new Error('received-call reception state is unavailable');
    if (reception.kind === 'received' && (!noLater(reception.receivedAt)
      || json(observation.receipt.perceived.communications) !== json([reception.received]))) {
      throw new Error('received-call recipient perception differs');
    }
    if (reception.kind === 'scheduled' && observation.receipt.perceived.communications.length !== 0) {
      throw new Error('received-call scheduled payload is unavailable');
    }
    const calibration = model.source.calibration, ratings = model.fieldingModel.source.ratings;
    const input: ReceivedUmpireDefenderReplanInput = {
      processSourceId: source.sourceId, physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId,
      receiverRole: 'defender', ticksPerSecond: self.ticksPerSecond, currentCut: cut,
      communication: { sourceId: communication.source.sourceId, hash: hash(communication),
        originCommunicationSourceId: communication.originCommunicationSourceId, callSourceId: call.source.sourceId },
      observation: { sourceId: observation.source.sourceId, hash: hash(observation), at: observation.receipt.at,
        perceived: observation.receipt.perceived, reception: reception.kind === 'scheduled' ? { kind: 'scheduled', dueAt: reception.dueAt }
          : { kind: 'received', receivedAt: reception.receivedAt, order: null, received: reception.received } },
      predecessor: { originDecisionSourceId: origin.source.sourceId, originObservationSourceId: original.observation.source.sourceId,
        originObservationHash: hash(original.observation), availability: decision.receipt.availability, informationOrder: null,
        observationSourceId: decision.source.observationSourceId, observationHash: decision.observationHash,
        observedThrough: decision.receipt.observedThrough, decisionTick: decision.receipt.scheduling.decisionTick,
        issuedAt: decision.receipt.lifecycle.issuedAt,
        command: { sourceId: decision.source.sourceId, hash: hash(decision), selected: decision.receipt.selected, target: decision.receipt.target },
        motor: { sourceId: motor.source.sourceId, hash: hash(motor), adoptionSourceId: adoption.source.sourceId, adoptedAt: physical.adoption.adoptedAt } },
      model: { sourceId: model.source.sourceId, hash: hash(model), situationalAwareness: ratings.situationalAwareness,
        firstStepAbility: ratings.firstStep, ...calibration },
      contextualPlan: { sourceId: plan.source.sourceId, hash: hash(plan), priorities: plan.source.priorities }, policy: null, previous: null,
    };
    return freeze({ source, dependencyHashes: { observation: hash(observation), communication: hash(communication), call: hash(call),
      decision: hash(decision), originObservation: hash(original.observation), motor: hash(motor), adoption: ownedScheduledMotionArchiveHash(adoption),
      currentExecution: ownedScheduledMotionArchiveHash(current), self: hash(self), decisionModel: hash(model), contextualPlan: hash(plan) },
      input, replan: deriveReceivedUmpireDefenderReplan(input) });
  };
  const mainOnly = () => {
    const databases = db.prepare('PRAGMA database_list').all();
    if (databases.filter(row => row.name === 'main').length !== 1 || databases.some(row => row.name !== 'main' && row.name !== 'temp')
      || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
      throw new Error('received-call input requires main-only authority storage');
    }
  };
  return Object.freeze({ derive(raw: AcceptedActualReceivedUmpireDefenderReplan): ActualReceivedUmpireDefenderReplanInputEvidence {
    const source = accepted(raw);
    const read = () => withBattedWorldPhysicalReadTraversal(db, () => { mainOnly(); const value = derive(source); mainOnly(); return value; });
    if (db.isTransaction) return read();
    db.exec('BEGIN');
    try { const value = read(); if (!db.isTransaction) throw new Error('received-call read transaction disappeared'); db.exec('COMMIT'); return value; }
    catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  } });
};
