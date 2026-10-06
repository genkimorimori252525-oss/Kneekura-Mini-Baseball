import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { acceptedBattedWorldModelInput, type AcceptedBattedWorldModel, type MaterializedBattedWorldModel } from './BattedWorldModel';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from './PlayerBodyCapabilityMaterializationEvidence';
import { bodySourceId, bodySourceDay, bodySourceFields, validBodySourceRef, type BattedBodyModelAssembly } from './PlayerBodyCapabilityMaterialization';
import { assertBodyCompositionNativeConnection, bodyCompositionTableInstalled, bodyCompositionSourceClaim as claim, type BodyCompositionDb } from './BodyMaterializationSqliteOwnership';

type Row = { source_id: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const table = 'world_batted_body_materializations';
export const battedBodyModelAssemblyInput = (raw: BattedBodyModelAssembly, sourceId: string): BattedBodyModelAssembly => {
  const s = cloneInert(raw);
  if (!bodySourceFields(s, ['sourceId', 'sourceVersion', 'gameId', 'careerId', 'fixtureEventId', 'venueId', 'availableAtDay',
      'actors', 'batterGripOffset', 'surfaces', 'kind', 'atDay'])
    || s.kind !== 'body_materialized_batted_model_v1' || s.sourceId !== sourceId
    || ![sourceId, s.sourceVersion, s.gameId, s.careerId, s.fixtureEventId, s.venueId].every(bodySourceId)
    || !bodySourceDay(s.atDay) || !bodySourceDay(s.availableAtDay) || s.availableAtDay > s.atDay
    || !Array.isArray(s.actors) || s.actors.length < 10 || new Set(s.actors.map(a => a?.playerId)).size !== s.actors.length
    || new Set(s.actors.map(a => a?.personId)).size !== s.actors.length
    || s.actors.some(a => !bodySourceFields(a, ['playerId', 'personId', 'materializationRef']) || !bodySourceId(a.playerId)
      || !bodySourceId(a.personId) || !validBodySourceRef(a.materializationRef))) throw new Error('invalid accepted body model assembly');
  return s;
};

/** Immutable model-to-original-actor relationship; shares the contact writer/replayer connection. */
export const battedBodyModelMaterializationEvidenceFromSqlite = (db: BodyCompositionDb) => {
  const identities = (sourceId: string): readonly Row[] => !bodyCompositionTableInstalled(db, table) ? [] :
    db.prepare(`SELECT * FROM main.${table} WHERE source_id=? OR ${claim('source_json', ['sourceId'])}
      OR ${claim('snapshot_json', ['sourceId'])} OR ${claim('snapshot_json', ['materializationSourceId'])}`)
      .all(sourceId, sourceId, sourceId, sourceId) as Row[];
  const derive = (source: BattedBodyModelAssembly): MaterializedBattedWorldModel => {
    assertBodyCompositionNativeConnection(db);
    if (!bodyCompositionTableInstalled(db, 'official_fixtures') || !bodyCompositionTableInstalled(db, 'official_participant_bindings')) {
      throw new Error('original body model fixture/participant owner is missing');
    }
    const fixture = db.prepare('SELECT fixture_event_id,venue_id FROM main.official_fixtures WHERE game_id=?').get(source.gameId);
    if (!fixture || fixture.fixture_event_id !== source.fixtureEventId || fixture.venue_id !== source.venueId) {
      throw new Error('body model original official fixture differs');
    }
    const ownActors = playerBodyCapabilityMaterializationEvidenceFromSqlite(db);
    const actors = source.actors.map(a => {
      const receipt = ownActors.read(a.materializationRef.sourceId);
      const row = db.prepare('SELECT binding_json FROM main.official_participant_bindings WHERE game_id=? AND player_id=?')
        .get(source.gameId, a.playerId) as { binding_json: string } | undefined;
      const binding = row ? JSON.parse(row.binding_json) as OfficialParticipantBinding : null;
      if (!receipt || receipt.source.sourceVersion !== a.materializationRef.sourceVersion || receipt.source.careerId !== source.careerId
        || receipt.source.atDay !== source.atDay || receipt.source.playerId !== a.playerId || receipt.source.personId !== a.personId
        || !binding || JSON.stringify(binding) !== row!.binding_json || binding.gameId !== source.gameId || binding.playerId !== a.playerId
        || binding.personId !== a.personId || binding.careerId !== source.careerId || binding.fixtureEventId !== source.fixtureEventId
        || binding.gameDay !== source.atDay || !bodySourceId(binding.competitionEditionId) || !bodySourceId(binding.clubId)
        || !bodySourceDay(binding.rosterRevision) || !['HOME', 'AWAY'].includes(binding.side)
        || json(readOfficialActorPersonLink(db, binding)) !== json(receipt.person)) {
        throw new Error('body model original registered actor receipt differs');
      }
      return receipt.actor;
    });
    const { atDay: _day, actors: _refs, ...geometry } = source;
    return freeze(acceptedBattedWorldModelInput({ ...geometry, materializationSourceId: source.sourceId, actors }, source.sourceId) as MaterializedBattedWorldModel);
  };
  const read = (sourceId: string): MaterializedBattedWorldModel | null => {
    if (!bodySourceId(sourceId)) throw new Error('invalid body model identity');
    const rows = identities(sourceId);
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('original body model Source ownership differs');
    const row = rows[0]; if (!row) return null;
    const source = battedBodyModelAssemblyInput(JSON.parse(row.source_json) as BattedBodyModelAssembly, sourceId), value = derive(source);
    if (row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(value)
      || row.snapshot_hash !== hash(value)) throw new Error('corrupt original body model manifest or actor receipts');
    return value;
  };
  const assertModel = (model: AcceptedBattedWorldModel): void => {
    const original = read(model.sourceId);
    if (!original) {
      if (model.kind === 'body_materialized_batted_model_v1') throw new Error('original body model manifest is missing');
      return;
    }
    if (model.kind !== 'body_materialized_batted_model_v1' || model.materializationSourceId !== model.sourceId
      || json(model) !== json(original)) throw new Error('body model manifest cannot be downgraded or replaced by caller geometry');
  };
  return Object.freeze({ derive, read, assertModel });
};
