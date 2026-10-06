import { actorJson as json, actorHash as hash, actorFreeze as freeze, readPhysicalPlateAppearanceActorFromSqlite,
  assertPhysicalActorOpenFrame } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { assertBodyCompositionNativeConnection, bodyCompositionTableInstalled, bodyCompositionSourceClaim as claim,
  type BodyCompositionDb } from './BodyMaterializationSqliteOwnership';
import { bodySourceId as id, bodySourceFields as fields } from './PlayerBodyCapabilityMaterialization';
import { sqliteJsonMetadataNodes } from './SqliteOwnershipMetadata';
import { battingStanceSourceInput, type AcceptedBattingStanceV1, type DurableBattingStanceV1 } from './BattingStance';

type Row = {
  source_id: string; source_version: string; career_id: string; player_id: string; person_id: string; person_link_source_id: string;
  accepted_at_day: number; game_id: string; fixture_event_id: string; play_id: number; physical_actor_source_id: string;
  model_source_id: string; initial_world_source_id: string; started_at_tick: number;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
const table = 'world_batting_stances';
const playClaim = (document: string, path: readonly string[]): string => `EXISTS (
  SELECT 1 FROM (${sqliteJsonMetadataNodes(document, path)}) owner,
    json_each(CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END) game,
    json_each(CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END) play
  WHERE game.key='gameId' AND game.type='text' AND game.atom=?
    AND play.key='playId' AND play.type='integer' AND play.atom=?)`;
// Keep each game claim tied to its own actor/match container, including duplicate containers.
const actorPlayClaim = (document: string, path: readonly string[]): string => `EXISTS (
  SELECT 1 FROM (${sqliteJsonMetadataNodes(document, path)}) actor_owner
  WHERE actor_owner.type='object' AND EXISTS (
    SELECT 1 FROM json_each(CASE WHEN actor_owner.type='object' THEN actor_owner.value ELSE '{}' END) match_owner,
      json_each(CASE WHEN match_owner.type='object' THEN match_owner.value ELSE '{}' END) play
    WHERE match_owner.key='match' AND play.key='playId' AND play.type='integer' AND play.atom=?)
  AND (EXISTS (
    SELECT 1 FROM json_each(CASE WHEN actor_owner.type='object' THEN actor_owner.value ELSE '{}' END) game_owner,
      json_each(CASE WHEN game_owner.type='object' THEN game_owner.value ELSE '{}' END) game
    WHERE game_owner.key IN ('source','binding') AND game.key='gameId' AND game.type='text' AND game.atom=?)
    OR EXISTS (
      SELECT 1 FROM json_each(CASE WHEN actor_owner.type='object' THEN actor_owner.value ELSE '{}' END) world_owner,
        json_each(CASE WHEN world_owner.type='object' THEN world_owner.value ELSE '{}' END) game_owner,
        json_each(CASE WHEN game_owner.type='object' THEN game_owner.value ELSE '{}' END) game
      WHERE world_owner.key='worldFixture' AND game_owner.key='game'
        AND game.key='gameId' AND game.type='text' AND game.atom=?)))`;


/** Original model/actor reconstruction on one main connection; historical replay is independent of new-write currentness. */
export const battingStanceEvidenceFromSqlite = (db: BodyCompositionDb) => {
  const models = playerBattingModelEvidenceFromSqlite(db);
  const derive = (source: AcceptedBattingStanceV1): DurableBattingStanceV1 => {
    assertBodyCompositionNativeConnection(db);
    const actor = readPhysicalPlateAppearanceActorFromSqlite(db, source.physicalActorSourceId), model = models.read(source.modelRef.sourceId);
    if (!actor || !model || model.source.sourceVersion !== source.modelRef.sourceVersion
      || actor.source.gameId !== source.gameId || actor.source.playerId !== source.playerId || actor.match.playId !== source.playId
      || !('initialWorldSourceId' in actor.source) || actor.source.initialWorldSourceId !== source.initialWorldSourceId
      || actor.binding.fixtureEventId !== source.fixtureEventId || actor.binding.gameDay !== source.acceptedAtDay
      || actor.binding.careerId !== source.careerId || actor.person.personId !== source.personId || actor.person.sourceId !== source.personLinkSourceId
      || model.source.careerId !== source.careerId || model.source.playerId !== source.playerId || model.source.personId !== source.personId
      || model.source.personLinkSourceId !== source.personLinkSourceId || model.source.acceptedAtDay > source.acceptedAtDay
      || json(model.person) !== json(actor.person) || actor.world.tick !== source.startedAtTick
      || model.predictionCalibration.values.parameters.ticksPerSecond !== source.ticksPerSecond
      || model.observationCalibration.values.calibration.memoryDecayParameters.ticksPerSecond !== source.ticksPerSecond) {
      throw new Error('batting stance original actor/model scope, origin, clock or day differs');
    }
    return freeze({ source, model, actor, physicalState: { startTick: actor.world.tick,
      centerOfMass: source.centerOfMass, eyePosition: source.eyePosition } });
  };
  const parseRow = (row: Row): DurableBattingStanceV1 => {
    const source = battingStanceSourceInput(JSON.parse(row.source_json) as AcceptedBattingStanceV1, row.source_id);
    const archived = JSON.parse(row.snapshot_json) as DurableBattingStanceV1;
    if (!fields(archived, ['source', 'model', 'actor', 'physicalState'])) throw new Error('invalid original batting stance snapshot');
    const value = derive(source);
    if (row.source_version !== source.sourceVersion || row.career_id !== source.careerId || row.player_id !== source.playerId
      || row.person_id !== source.personId || row.person_link_source_id !== source.personLinkSourceId || row.accepted_at_day !== source.acceptedAtDay
      || row.game_id !== source.gameId || row.fixture_event_id !== source.fixtureEventId || row.play_id !== source.playId
      || row.physical_actor_source_id !== source.physicalActorSourceId || row.model_source_id !== source.modelRef.sourceId
      || row.initial_world_source_id !== source.initialWorldSourceId || row.started_at_tick !== source.startedAtTick
      || row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
      throw new Error('corrupt original batting stance archive or native dependency');
    }
    return value;
  };
  const scopeRows = (source: AcceptedBattingStanceV1): readonly Row[] => db.prepare(`SELECT * FROM main.${table}
    WHERE physical_actor_source_id=? OR (game_id=? AND play_id=?)
      OR ${claim('source_json', ['physicalActorSourceId'])} OR ${claim('snapshot_json', ['source', 'physicalActorSourceId'])}
      OR ${claim('snapshot_json', ['actor', 'source', 'sourceId'])}
      OR ${playClaim('source_json', [])} OR ${playClaim('snapshot_json', ['source'])}
      OR ${actorPlayClaim('snapshot_json', ['actor'])}`)
    .all(source.physicalActorSourceId, source.gameId, source.playId, source.physicalActorSourceId, source.physicalActorSourceId,
      source.physicalActorSourceId, source.gameId, source.playId, source.gameId, source.playId,
      source.playId, source.gameId, source.gameId) as Row[];
  const assertScope = (source: AcceptedBattingStanceV1, accepted: boolean): void => {
    const rows = scopeRows(source);
    if (rows.length !== (accepted ? 1 : 0)) throw new Error('original physical actor already owns another batting stance');
    for (const row of rows) if (json(parseRow(row).source) !== json(source)) throw new Error('batting stance physical scope ownership differs');
  };
  const read = (sourceId: string): DurableBattingStanceV1 | null => {
    assertBodyCompositionNativeConnection(db);
    if (!id(sourceId)) throw new Error('invalid batting stance identity');
    if (!bodyCompositionTableInstalled(db, table)) return null;
    const rows = db.prepare(`SELECT * FROM main.${table} WHERE source_id=? OR ${claim('source_json', ['sourceId'])}
      OR ${claim('snapshot_json', ['source', 'sourceId'])}`).all(sourceId, sourceId, sourceId) as Row[];
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('batting stance Source identity ownership differs');
    if (!rows.length) return null;
    const value = parseRow(rows[0]); assertScope(value.source, true); return value;
  };
  const assertCurrent = (value: DurableBattingStanceV1): void => {
    assertPhysicalActorOpenFrame(db, value.actor);
    if (json(models.selectAtDay(value.source.careerId, value.source.playerId, value.actor.binding.gameDay)) !== json(value.model)) {
      throw new Error('new batting stance requires the current applicable model');
    }
    if (bodyCompositionTableInstalled(db, 'physical_pitch_progress_heads')
      && db.prepare('SELECT 1 FROM main.physical_pitch_progress_heads WHERE game_id=? LIMIT 1')
        .get(value.source.gameId)) throw new Error('new batting stance requires the original unstarted physical play');
    if (bodyCompositionTableInstalled(db, 'physical_pitch_progress_actions')
      // Initial-World stance proves an unplayed pregame Match: any original-game execution is too late.
      // Reuse the established raw pitch census game mirrors; SQL play movement cannot reopen that game.
      && db.prepare(`SELECT 1 FROM main.physical_pitch_progress_actions WHERE game_id=?
        OR ${claim('source_json', ['gameId'])} OR ${claim('snapshot_json', ['source', 'gameId'])}
        OR ${claim('snapshot_json', ['frame', 'gameId'])}
        OR ${actorPlayClaim('snapshot_json', ['frame', 'batterActor'])} LIMIT 1`)
        .get(value.source.gameId, value.source.gameId, value.source.gameId, value.source.gameId,
          value.source.playId, value.source.gameId, value.source.gameId)) {
      throw new Error('new batting stance requires the original unstarted physical play');
    }
  };
  return Object.freeze({ derive, read, assertScope, assertCurrent });
};
