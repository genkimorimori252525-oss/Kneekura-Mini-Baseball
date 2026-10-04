import { assertDefensiveMetadataUnambiguous as unambiguous, defensiveMetadataId as metadataId, defensiveMetadataScope as metadataScope } from './ActualDefensiveMetadata';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { ActualObservationMoment } from './ActualFieldObservation';

export type DefensiveDb = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
export const defensiveFields = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && JSON.stringify(Object.keys(v).sort()) === JSON.stringify([...keys].sort());
export const defensiveTick = (n: number) => Number.isSafeInteger(n) && n >= 0;
/** No effective-integer tolerance: prove a scheduling boundary is at or after the exact relative physical instant. */
export const actualDefensiveBoundary = (at: ActualObservationMoment, ticksPerSecond: number): number => {
  if (!defensiveTick(at.originTick) || !Number.isFinite(at.elapsedSeconds) || at.elapsedSeconds < 0
    || !Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) throw new Error('invalid actual defensive clock');
  // Search relative safe integer offsets using the physical clock comparison itself.
  // Multiplication/ceil can round exact boundaries up, even past MAX_SAFE_INTEGER.
  let lower = 0, upper = Number.MAX_SAFE_INTEGER - at.originTick;
  if (upper / ticksPerSecond < at.elapsedSeconds) throw new Error('actual defensive boundary overflow');
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (middle / ticksPerSecond >= at.elapsedSeconds) upper = middle;
    else lower = middle + 1;
  }
  return at.originTick + lower;
};
/** All live dependencies are rederived on the caller's own DB; only observation data reaches the choice algorithm. */
export const actualDefensiveContextFromSqlite = (db: DefensiveDb) => {
  const observations = actualFieldObservationEvidenceFromSqlite(db), fields = battedWorldFieldEvidenceFromSqlite(db), models = playerObservationModelEvidenceFromSqlite(db);
  const read = (observationSourceId: string, pitchId: string, playerId: string, current = false) => {
    const rows = db.prepare(`SELECT source_id FROM actual_field_observations WHERE source_id=?
      OR ${metadataId('source_json', ['sourceId'])} OR ${metadataId('snapshot_json', ['source', 'sourceId'])}
      OR ${metadataId('snapshot_json', ['history', { array: 'last' }, 'sourceId'])}`)
      .all(observationSourceId, observationSourceId, observationSourceId, observationSourceId);
    if (rows.length !== 1 || rows[0].source_id !== observationSourceId) throw new Error('actual defensive observation identity differs');
    // The original observation owner replays the bounded prefix. First make sure an archived
    // history mirror cannot hide a duplicate dependency under another indexed Player/pitch.
    const historyOwners = db.prepare(`SELECT source_id,physical_pitch_source_id,player_id,source_json,snapshot_json FROM actual_field_observations
      WHERE (physical_pitch_source_id=? AND player_id=?) OR ${metadataScope('source_json')}
        OR ${metadataScope('snapshot_json', ['source'])} OR ${metadataScope('snapshot_json', ['history', { array: 'all' }])}`)
      .all(pitchId, playerId, pitchId, playerId, pitchId, playerId, pitchId, playerId);
    if (historyOwners.some(row => row.physical_pitch_source_id !== pitchId || row.player_id !== playerId)) {
      throw new Error('actual defensive observation history scope differs');
    }
    for (const row of historyOwners) unambiguous(db, 'observation', row.source_json as string, row.snapshot_json as string);
    const observation = observations.read(observationSourceId);
    if (!observation || observation.source.physicalPitchSourceId !== pitchId || observation.source.playerId !== playerId
      || observation.receipt.perceived.observerId !== playerId) throw new Error('actual defensive original observation scope differs');
    const field = fields.read(observation.source.baseFieldSourceId)!, world = field.response.touch.worldContact;
    const actor = world.modelActorEvidence.find(a => a.binding.playerId === playerId);
    const defender = world.flight.physicalPitch.frame.world.defenders.find(d => d.playerId === playerId);
    const model = models.read(observation.source.observationModelSourceId);
    if (!actor || !defender || !model || model.source.playerId !== playerId || model.source.careerId !== actor.binding.careerId
      || model.source.personLinkSourceId !== actor.binding.personLinkSourceId || json(model.fieldingModel.person) !== json(actor.person)
      || model.source.acceptedAtDay > actor.binding.gameDay) throw new Error('actual defensive Player/Person/fielding/day differs');
    if (current) observations.current(observation);
    return { observation, fieldingModel: model.fieldingModel, binding: actor.binding,
      self: { playerId, registeredPosition: defender.registeredPosition, positionConvention: 'identity_only_no_position_consumed' as const },
      ticksPerSecond: world.flight.source.execution.ballFlightParameters.ticksPerSecond };
  };
  return { read };
};
