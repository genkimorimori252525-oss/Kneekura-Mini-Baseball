import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualFieldObservationInput, actualObservationId as id, type AcceptedActualFieldObservation,
  type ActualFieldObservationReceipt } from './ActualFieldObservation';
import { sampleExecutedFieldObservation } from './ExecutedFieldObservation';
import { ownedRunnerFieldPiecesPhysicalPrefix } from './OwnedRunnerFieldPiecesPhysicalPrefix';
import { battedWorldFieldEvidenceFromSqlite, withBattedWorldFieldReadTraversal } from './SqliteBattedWorldFieldStore';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type OwnedRunnerFieldObservationSource = Readonly<{
  kind: 'owned_runner_field_observation_v1'; sourceId: string; sourceVersion: string; physicalPitchSourceId: string;
  playerId: string; fieldSourceId: string; prePitchRunnerSourceId: string; observationModelSourceId: string;
  view: AcceptedActualFieldObservation['view'];
}>;
/** An unpersisted sensory projection, not an owned observation or consumed-signal receipt. */
export type OwnedRunnerFieldObservationProjection = Readonly<{
  version: 'owned_runner_field_observation_v1'; source: OwnedRunnerFieldObservationSource; playerId: string; personId: string;
  prePitchRunnerSourceId: string; motionRevision: number; receipt: ActualFieldObservationReceipt;
  dependencyHashes: Readonly<{ field: string; physicalPrefix: string; physicalPitch: string; model: string }>;
  originalPublicContext: Readonly<{ kind: 'original_official_occupancy_v1'; startingBase: 1 | 2 | 3; normalNextBase: 2 | 3 | 4;
    actorSourceId: string; officialRevision: number; matchHash: string; availableAtTick: number }>;
  knowledge: Readonly<{ status: 'pending'; knownContext: null; force: 'unavailable'; tagUp: 'unavailable'; cueGeneration: 'unavailable';
    consumedSignals: readonly never[]; perceivedCues: readonly never[] }>;
}>;
type Db = Pick<DatabaseSync, 'prepare'>;
const fields = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const input = (raw: OwnedRunnerFieldObservationSource) => {
  const source = cloneInert(raw);
  if (!fields(source, ['kind', 'sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'fieldSourceId', 'prePitchRunnerSourceId',
    'observationModelSourceId', 'view']) || source.kind !== 'owned_runner_field_observation_v1'
    || ![source.sourceId, source.sourceVersion, source.physicalPitchSourceId, source.playerId, source.fieldSourceId,
      source.prePitchRunnerSourceId, source.observationModelSourceId].every(id)) throw new Error('invalid owned runner sensory projection Source');
  // Reuse the exact existing view validator. This internal calculation shape is
  // not an accepted legacy Source, persisted observation or new execution.
  const sensory = actualFieldObservationInput({ sourceId: source.sourceId, sourceVersion: source.sourceVersion,
    physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId, baseFieldSourceId: source.fieldSourceId,
    executionSourceId: null, observationModelSourceId: source.observationModelSourceId, previousObservationSourceId: null, view: source.view }, source.sourceId);
  return { source, sensory };
};

/** Internal shared calculation on an authenticated physical read snapshot. The
 * history owner must rederive previous; this helper grants no saved observation,
 * signal-consumption or decision authority. Public projection callers get no
 * predecessor input. */
export const sampleOwnedRunnerFieldObservationWithPrevious = (db: Db, raw: OwnedRunnerFieldObservationSource,
  previous: Readonly<{ source: AcceptedActualFieldObservation; receipt: ActualFieldObservationReceipt }> | null): OwnedRunnerFieldObservationProjection => {
  const fieldsOwner = battedWorldFieldEvidenceFromSqlite(db), models = playerObservationModelEvidenceFromSqlite(db);
  const project = (source: OwnedRunnerFieldObservationSource, sensory: AcceptedActualFieldObservation): OwnedRunnerFieldObservationProjection => {
    const field = fieldsOwner.read(source.fieldSourceId);
    if (!field || field.source.kind !== 'owned_runner_field_pieces_v1'
      || field.response.touch.worldContact.flight.source.physicalPitchSourceId !== source.physicalPitchSourceId) {
      throw new Error('owned runner sensory projection field or original pitch differs');
    }
    const chain = fieldsOwner.scope(field, source.fieldSourceId), physical = ownedRunnerFieldPiecesPhysicalPrefix(chain);
    const world = field.response.touch.worldContact, frame = world.flight.physicalPitch.frame, runner = frame.prePitchRunner!, actor = frame.batterActor!;
    if (source.playerId !== runner.binding.playerId || source.prePitchRunnerSourceId !== runner.source.sourceId
      || !tick(frame.officialRevision) || actor.officialRevision !== frame.officialRevision
      || json(actor.match) !== json(frame.match) || !tick(frame.world.tick) || !Number.isFinite(frame.matchSeed)) {
      throw new Error('owned runner sensory projection original actor or public context differs');
    }
    const originalBases = ([['first', 1, 2], ['second', 2, 3], ['third', 3, 4]] as const)
      .filter(([key]) => actor.match.bases[key] === source.playerId);
    if (originalBases.length !== 1 || Object.values(actor.match.bases).filter(player => player !== null).length !== 1) {
      throw new Error('owned runner original official occupancy differs');
    }
    const model = models.read(source.observationModelSourceId);
    if (!model || model.source.playerId !== source.playerId || model.source.careerId !== runner.binding.careerId
      || model.source.personLinkSourceId !== runner.binding.personLinkSourceId || json(model.fieldingModel.person) !== json(runner.person)
      || model.source.acceptedAtDay > runner.binding.gameDay) throw new Error('owned runner sensory projection Player/Person/model or day differs');
    const receipt = sampleExecutedFieldObservation(sensory, { at: physical.at, ticksPerSecond: physical.ticksPerSecond,
      matchSeed: frame.matchSeed, playId: frame.match.playId, playerIds: physical.participants.map(player => player.playerId),
      actors: physical.segments.at(-1)!.actors, surfaces: world.model.surfaces, bases: Object.values(field.geometry.geometry.bases),
      ballMoment: field.field.motion.cursor?.moment ?? null }, model, previous);
    return freeze({ version: 'owned_runner_field_observation_v1', source, playerId: source.playerId, personId: runner.person.personId,
      prePitchRunnerSourceId: runner.source.sourceId, motionRevision: runner.source.motionRevision, receipt,
      dependencyHashes: { field: hash(field), physicalPrefix: hash(physical), physicalPitch: hash(world.flight.physicalPitch), model: hash(model) },
      originalPublicContext: { kind: 'original_official_occupancy_v1', startingBase: originalBases[0][1], normalNextBase: originalBases[0][2],
        actorSourceId: actor.source.sourceId, officialRevision: actor.officialRevision, matchHash: hash(actor.match), availableAtTick: frame.world.tick },
      knowledge: { status: 'pending', knownContext: null, force: 'unavailable', tagUp: 'unavailable', cueGeneration: 'unavailable',
        consumedSignals: [], perceivedCues: [] } });
  };
  const { source, sensory } = input(raw);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('owned runner sensory projection requires its native read connection');
  const read = () => withBattedWorldFieldReadTraversal(db, () => project(source, sensory));
  if (db.isTransaction) return read();
  db.exec('BEGIN');
  try { const value = read(); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
};

/** One-shot public projection. The separate history owner supplies only its own
 * rederived predecessor to the shared internal calculation above. */
export const ownedRunnerFieldObservationEvidenceFromSqlite = (db: Db) => Object.freeze({
  derive: (source: OwnedRunnerFieldObservationSource): OwnedRunnerFieldObservationProjection =>
    sampleOwnedRunnerFieldObservationWithPrevious(db, source, null),
});
