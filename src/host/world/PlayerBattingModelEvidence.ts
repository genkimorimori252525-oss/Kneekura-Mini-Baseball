import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from './PlayerBodyCapabilityMaterializationEvidence';
import { bodySourceId as id, bodySourceDay as day, bodySourceFields as fields } from './PlayerBodyCapabilityMaterialization';
import { assertBodyCompositionNativeConnection, bodyCompositionTableInstalled, bodyCompositionSourceClaim as claim,
  type BodyCompositionDb } from './BodyMaterializationSqliteOwnership';
import { sqliteJsonMetadataNodes } from './SqliteOwnershipMetadata';
import { battingModelSourceInput, battingModelParametersInput, battingModelParameterKeys,
  type AcceptedPlayerBattingModelV1, type BattingModelParameters, type DurablePlayerBattingModelV1 } from './PlayerBattingModel';

type Row = {
  source_id: string; source_version: string; career_id: string; player_id: string; person_id: string; person_link_source_id: string;
  accepted_at_day: number; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
const table = 'world_player_batting_models';
const playerClaim = (document: string, path: readonly string[]): string => `EXISTS (
  SELECT 1 FROM (${sqliteJsonMetadataNodes(document, path)}) owner,
    json_each(CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END) career,
    json_each(CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END) player
  WHERE career.key='careerId' AND career.type='text' AND career.atom=?
    AND player.key='playerId' AND player.type='text' AND player.atom=?)`;

/** Original body/Person evidence on the caller's main connection; archive replay needs no live authority. */
export const playerBattingModelEvidenceFromSqlite = (db: BodyCompositionDb) => {
  const bodies = playerBodyCapabilityMaterializationEvidenceFromSqlite(db);
  const derive = (source: AcceptedPlayerBattingModelV1, raw: BattingModelParameters): DurablePlayerBattingModelV1 => {
    assertBodyCompositionNativeConnection(db);
    const inputs = battingModelParametersInput(raw, source), body = bodies.read(source.bodyMaterializationRef.sourceId);
    if (!body || body.source.sourceVersion !== source.bodyMaterializationRef.sourceVersion || body.source.role !== 'batter'
      || body.source.careerId !== source.careerId || body.source.playerId !== source.playerId || body.source.personId !== source.personId
      || body.source.personLinkSourceId !== source.personLinkSourceId || body.source.atDay > source.acceptedAtDay
      || body.person.sourceId !== source.personLinkSourceId || body.person.acceptedAtDay > source.acceptedAtDay
      || body.body.sourceId !== source.bodyRef.sourceId || body.body.sourceVersion !== source.bodyRef.sourceVersion
      || body.pose.sourceId !== source.poseRef.sourceId || body.pose.sourceVersion !== source.poseRef.sourceVersion
      || battingModelParameterKeys.some(key => inputs[key].acceptedAtDay < body.person.acceptedAtDay)) {
      throw new Error('Player batting model original Person/body scope, version or day differs');
    }
    return freeze({ source, person: body.person, bodyMaterialization: body, ...inputs });
  };
  const parseRow = (row: Row): DurablePlayerBattingModelV1 => {
    const source = battingModelSourceInput(JSON.parse(row.source_json) as AcceptedPlayerBattingModelV1, row.source_id);
    const archived = JSON.parse(row.snapshot_json) as DurablePlayerBattingModelV1;
    if (!fields(archived, ['source', 'person', 'bodyMaterialization', ...battingModelParameterKeys])) {
      throw new Error('invalid original Player batting model snapshot');
    }
    const parameters = Object.fromEntries(battingModelParameterKeys.map(key => [key, archived[key]])) as BattingModelParameters;
    const value = derive(source, parameters);
    if (row.source_version !== source.sourceVersion || row.career_id !== source.careerId || row.player_id !== source.playerId
      || row.person_id !== source.personId || row.person_link_source_id !== source.personLinkSourceId || row.accepted_at_day !== source.acceptedAtDay
      || row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
      throw new Error('corrupt original Player batting model archive or native dependency');
    }
    return value;
  };
  const assertParameterPins = (value: DurablePlayerBattingModelV1): void => {
    for (const key of battingModelParameterKeys) {
      const parameter = value[key], ref = `${key}Ref`;
      const rows = db.prepare(`SELECT * FROM main.${table} WHERE ${claim('snapshot_json', [key, 'sourceId'])}
        OR ${claim('source_json', [ref, 'sourceId'])} OR ${claim('snapshot_json', ['source', ref, 'sourceId'])}`)
        .all(parameter.sourceId, parameter.sourceId, parameter.sourceId) as Row[];
      for (const row of rows) {
        if (json(parseRow(row)[key]) !== json(parameter)) throw new Error('accepted batting parameter Source was reused with different bytes');
      }
    }
  };
  const read = (sourceId: string): DurablePlayerBattingModelV1 | null => {
    assertBodyCompositionNativeConnection(db);
    if (!id(sourceId)) throw new Error('invalid Player batting model identity');
    if (!bodyCompositionTableInstalled(db, table)) return null;
    const rows = db.prepare(`SELECT * FROM main.${table} WHERE source_id=? OR ${claim('source_json', ['sourceId'])}
      OR ${claim('snapshot_json', ['source', 'sourceId'])}`).all(sourceId, sourceId, sourceId) as Row[];
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('Player batting model Source ownership differs');
    if (!rows.length) return null;
    const value = parseRow(rows[0]); assertParameterPins(value); return value;
  };
  const history = (careerId: string, playerId: string): readonly DurablePlayerBattingModelV1[] => {
    assertBodyCompositionNativeConnection(db);
    if (!id(careerId) || !id(playerId)) throw new Error('invalid Player batting model history scope');
    const paths = [['source'], ['person'], ['bodyMaterialization', 'source'], ['bodyMaterialization', 'person'],
      ['bodyMaterialization', 'body'], ['bodyMaterialization', 'pose'],
      ...battingModelParameterKeys.map(key => [key])];
    const rows = !bodyCompositionTableInstalled(db, table) ? [] : db.prepare(`SELECT * FROM main.${table} WHERE (career_id=? AND player_id=?)
      OR ${playerClaim('source_json', [])} OR ${paths.map(path => playerClaim('snapshot_json', path)).join(' OR ')}`)
      .all(careerId, playerId, careerId, playerId, ...paths.flatMap(() => [careerId, playerId])) as Row[];
    const values = rows.map(row => {
      const value = parseRow(row);
      if (value.source.careerId !== careerId || value.source.playerId !== playerId) throw new Error('Player batting model history scope differs');
      assertParameterPins(value); return value;
    });
    const days = new Set<number>();
    for (const value of values) {
      if (days.has(value.source.acceptedAtDay)) throw new Error('ambiguous Player batting model day');
      days.add(value.source.acceptedAtDay);
    }
    return values;
  };
  const assertHistory = (careerId: string, playerId: string): void => { history(careerId, playerId); };
  const selectAtDay = (careerId: string, playerId: string, atDay: number): DurablePlayerBattingModelV1 => {
    if (!day(atDay)) throw new Error('invalid Player batting model day');
    const selected = history(careerId, playerId).filter(value => value.source.acceptedAtDay <= atDay)
      .sort((a, b) => b.source.acceptedAtDay - a.source.acceptedAtDay)[0];
    if (!selected) throw new Error('applicable accepted Player batting model is missing');
    return selected;
  };
  return Object.freeze({ derive, assertParameterPins, assertHistory, read, selectAtDay });
};
