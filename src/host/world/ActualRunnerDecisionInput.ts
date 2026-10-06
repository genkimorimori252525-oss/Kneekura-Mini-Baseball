import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertOriginalRunnerPublicKnowledgeCurrent } from './OriginalRunnerPublicKnowledge';
import { originalRunnerPublicKnowledgeEvidenceFromSqlite } from './SqliteOriginalRunnerPublicKnowledgeStore';
import { ownedRunnerFieldObservationHistoryEvidenceFromSqlite } from './SqliteOwnedRunnerFieldObservationStore';
import { playerRunnerDecisionMotionModelEvidenceFromSqlite } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
import { battedWorldFieldEvidenceFromSqlite, withBattedWorldFieldReadTraversal } from './SqliteBattedWorldFieldStore';

/** References only. Caller knowledge, a selected action and motor parameters are never inputs. */
export type ActualRunnerDecisionInputSource = Readonly<{
  kind: 'owned_runner_decision_input_v1'; sourceId: string; sourceVersion: string;
  physicalPitchSourceId: string; playerId: string; fieldSourceId: string;
  observationSourceId: string; publicKnowledgeSourceId: string; decisionMotionModelSourceId: string;
}>;
export type ActualRunnerDecisionInputEvidence = Readonly<{
  version: 'owned_runner_decision_input_v1'; source: ActualRunnerDecisionInputSource;
  playerId: string; personId: string; motionRevision: number;
  at: Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
  dependencyHashes: Readonly<{ publicKnowledge: string; observation: string; model: string; self: string }>;
  status: 'pending'; pendingReasons: readonly ['runner_live_context_unavailable'];
  decisionInput: null; decision: null; motor: null;
}>;
export type ActualRunnerDecisionInputReader = Readonly<{
  derive(source: ActualRunnerDecisionInputSource, current?: boolean): ActualRunnerDecisionInputEvidence;
}>;
const keys = ['kind', 'sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'fieldSourceId',
  'observationSourceId', 'publicKnowledgeSourceId', 'decisionMotionModelSourceId'];
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const input = (raw: ActualRunnerDecisionInputSource): ActualRunnerDecisionInputSource => {
  const source = cloneInert(raw);
  if (!source || typeof source !== 'object' || Array.isArray(source)
    || Object.keys(source).sort().join('|') !== [...keys].sort().join('|') || source.kind !== 'owned_runner_decision_input_v1'
    || ![source.sourceId, source.sourceVersion, source.physicalPitchSourceId, source.playerId, source.fieldSourceId,
      source.observationSourceId, source.publicKnowledgeSourceId, source.decisionMotionModelSourceId].every(id)) {
    throw new Error('invalid owned runner decision-input Source');
  }
  return freeze(source);
};

/** Internal readiness bridge on the caller's native connection. It creates no
 * durable owner and supplies no force/tag-up, selected decision or motor authority. */
export const actualRunnerDecisionInputEvidenceFromSqlite = (db: DatabaseSync): ActualRunnerDecisionInputReader => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('runner decision input requires its native read connection');
  const derive = (raw: ActualRunnerDecisionInputSource, current = false): ActualRunnerDecisionInputEvidence => {
    const source = input(raw);
    if (typeof current !== 'boolean') throw new Error('invalid runner decision-input current mode');
    const fields = battedWorldFieldEvidenceFromSqlite(db), observations = ownedRunnerFieldObservationHistoryEvidenceFromSqlite(db);
    const field = fields.read(source.fieldSourceId);
    if (!field || field.source.kind !== 'owned_runner_field_pieces_v1'
      || field.response.touch.worldContact.flight.source.physicalPitchSourceId !== source.physicalPitchSourceId) {
      throw new Error('runner decision-input retained field or pitch differs');
    }
    const frame = field.response.touch.worldContact.flight.physicalPitch.frame, runner = frame.prePitchRunner, actor = frame.batterActor;
    const observation = observations.read(source.observationSourceId);
    const publicKnowledge = originalRunnerPublicKnowledgeEvidenceFromSqlite(db).read(source.publicKnowledgeSourceId);
    const models = playerRunnerDecisionMotionModelEvidenceFromSqlite(db), model = models.read(source.decisionMotionModelSourceId);
    if (!runner || !actor || !observation || !publicKnowledge || !model
      || runner.binding.playerId !== source.playerId || runner.source.physicalActorSourceId !== actor.source.sourceId
      || observation.source.physicalPitchSourceId !== source.physicalPitchSourceId || observation.source.playerId !== source.playerId
      || observation.source.baseFieldSourceId !== source.fieldSourceId
      || observation.source.prePitchRunnerSourceId !== runner.source.sourceId || observation.prePitchRunnerSourceId !== runner.source.sourceId
      || publicKnowledge.source.physicalPitchSourceId !== source.physicalPitchSourceId || publicKnowledge.source.playerId !== source.playerId
      || publicKnowledge.source.physicalActorSourceId !== actor.source.sourceId || publicKnowledge.source.prePitchRunnerSourceId !== runner.source.sourceId
      || publicKnowledge.recipient.gameId !== frame.gameId || publicKnowledge.recipient.playId !== frame.match.playId
      || publicKnowledge.recipient.careerId !== runner.binding.careerId || publicKnowledge.recipient.playerId !== source.playerId
      || publicKnowledge.original.actorHash !== hash(actor) || publicKnowledge.original.runnerHash !== hash(runner)
      || publicKnowledge.original.matchHash !== hash(frame.match) || publicKnowledge.original.officialRevision !== frame.officialRevision
      || publicKnowledge.original.physicalPitchHash !== hash(field.response.touch.worldContact.flight.physicalPitch)) {
      throw new Error('runner decision-input original actor, public baseline or sensory recipient differs');
    }
    const self = actualPlayerKinematicsEvidenceFromSqlite(db).readOwnedRunnerFieldPieces({ kind: 'owned_runner_field_pieces_v1',
      physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId, fieldSourceId: source.fieldSourceId });
    if (self.origin.kind !== 'pre_pitch_runner_controller' || self.origin.runnerSourceId !== runner.source.sourceId
      || self.gameId !== frame.gameId || self.gameDay !== runner.binding.gameDay
      || self.personId !== runner.binding.personId || self.personLinkSourceId !== runner.binding.personLinkSourceId
      || observation.playerId !== self.playerId || observation.personId !== self.personId || publicKnowledge.recipient.personId !== self.personId
      || observation.motionRevision !== runner.source.motionRevision || self.authority.motionRevision !== runner.source.motionRevision
      || json(observation.receipt.at) !== json(self.at) || observation.dependencyHashes.field !== hash(field)
      || observation.dependencyHashes.physicalPrefix !== self.dependencyHashes.physicalPrefix
      || observation.dependencyHashes.physicalPitch !== publicKnowledge.original.physicalPitchHash
      || observation.originalPublicContext.actorSourceId !== actor.source.sourceId
      || observation.originalPublicContext.officialRevision !== publicKnowledge.original.officialRevision
      || observation.originalPublicContext.matchHash !== publicKnowledge.original.matchHash
      || observation.originalPublicContext.availableAtTick !== publicKnowledge.availableAtTick
      || observation.originalPublicContext.startingBase !== publicKnowledge.known.startingBase
      || observation.originalPublicContext.normalNextBase !== publicKnowledge.known.normalNextBase
      || publicKnowledge.availableAtTick > self.at.tick
      || model.source.playerId !== self.playerId || model.source.careerId !== runner.binding.careerId
      || model.source.personLinkSourceId !== self.personLinkSourceId || json(model.person) !== json(runner.person)
      || model.source.motion.ticksPerSecond !== self.ticksPerSecond) {
      throw new Error('runner decision-input exact cut, Person, model or physical clock differs');
    }
    const selected = models.selectAtDay(runner.binding.careerId, self.playerId, self.gameDay);
    if (json(selected) !== json(model)) throw new Error('runner decision-input model is outside its accepted day baseline');
    if (current) {
      fields.current(field); observations.current(observation); assertOriginalRunnerPublicKnowledgeCurrent(db, publicKnowledge);
    }
    // Absence is explicitly unavailable knowledge. Never convert it to false,
    // no tag-up restriction, an uncovered-base cue, hold or settled-for-play.
    if (publicKnowledge.liveContext.status !== 'pending' || publicKnowledge.liveContext.knownContext !== null
      || observation.knowledge.status !== 'pending' || observation.knowledge.knownContext !== null) {
      throw new Error('runner decision-input live context requires its semantic consumer');
    }
    const value: ActualRunnerDecisionInputEvidence = { version: 'owned_runner_decision_input_v1', source, playerId: self.playerId, personId: self.personId,
      motionRevision: runner.source.motionRevision, at: self.at,
      dependencyHashes: { publicKnowledge: hash(publicKnowledge), observation: hash(observation), model: hash(model), self: hash(self) },
      status: 'pending', pendingReasons: ['runner_live_context_unavailable'], decisionInput: null, decision: null, motor: null };
    return freeze(value);
  };
  const snapshot = <T>(work: () => T): T => {
    const read = () => withBattedWorldFieldReadTraversal(db, work);
    if (db.isTransaction) return read();
    db.exec('BEGIN');
    try { const value = read(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return Object.freeze({ derive: (source: ActualRunnerDecisionInputSource, current = false) => snapshot(() => derive(source, current)) });
};
