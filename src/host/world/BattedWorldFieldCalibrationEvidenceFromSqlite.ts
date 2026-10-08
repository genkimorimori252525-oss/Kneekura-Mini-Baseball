import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createBattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldBaseGeometryEvidenceFromSqlite } from './SqliteBattedWorldBaseGeometryStore';
import type { AcceptedBattedWorldFieldGeometry, DurableBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type GeometryRow = { source_id: string; base_geometry_source_id: string; game_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const id = (v: unknown): v is string => typeof v === 'string' && !!v.length && v === v.trim();
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
export const acceptedBattedWorldFieldGeometryInput = (raw: AcceptedBattedWorldFieldGeometry, sourceId: string) => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'baseGeometrySourceId', 'baseModels']) || s.sourceId !== sourceId
    || ![sourceId, s.sourceVersion, s.baseGeometrySourceId].every(id)) throw new Error('invalid accepted actual field calibration Source');
  return s;
};

/** Calibration-only dependency factory: historical proof never requires the old flight to remain current. */
export const battedWorldFieldCalibrationEvidenceFromSqlite = (db: Db) => {
  const ownBases = battedWorldBaseGeometryEvidenceFromSqlite(db);
  const deriveGeometry = (source: AcceptedBattedWorldFieldGeometry): DurableBattedWorldFieldGeometry => {
    const baseGeometry = ownBases.read(source.baseGeometrySourceId);
    if (!baseGeometry) throw new Error('actual field original fixture geometry is missing');
    const geometry = createBattedWorldFieldGeometry({ baseGeometry: baseGeometry.geometry, baseModels: source.baseModels });
    return freeze({ source, baseGeometry, geometry });
  };
  const checkGeometryRow = (row: GeometryRow, value: DurableBattedWorldFieldGeometry) => {
    if (row.source_id !== value.source.sourceId || row.base_geometry_source_id !== value.source.baseGeometrySourceId
      || row.game_id !== value.baseGeometry.fixture.game_id || row.source_json !== json(value.source) || row.source_hash !== hash(value.source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt own actual field calibration');
  };
  const readGeometry = (sourceId: string): DurableBattedWorldFieldGeometry | null => {
    if (!id(sourceId)) throw new Error('invalid actual field calibration scope');
    const row = db.prepare('SELECT * FROM batted_world_field_geometries WHERE source_id=?').get(sourceId) as GeometryRow | undefined;
    if (!row) return null;
    const value = deriveGeometry(acceptedBattedWorldFieldGeometryInput(JSON.parse(row.source_json) as AcceptedBattedWorldFieldGeometry, sourceId));
    checkGeometryRow(row, value); return value;
  };
  const historicalGeometry = (value: DurableBattedWorldFieldGeometry) => {
    if (json(deriveGeometry(value.source)) !== json(value)) throw new Error('original actual field calibration changed');
    const rows = db.prepare(`SELECT * FROM batted_world_field_geometries WHERE game_id=? OR base_geometry_source_id=?
      OR CASE WHEN json_valid(source_json) THEN json_extract(source_json,'$.baseGeometrySourceId') END=?
      OR CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'$.baseGeometry.fixture.game_id') END=?`)
      .all(value.baseGeometry.fixture.game_id, value.source.baseGeometrySourceId, value.source.baseGeometrySourceId, value.baseGeometry.fixture.game_id) as GeometryRow[];
    if (rows.length > 1) throw new Error('actual field has competing original calibration owners');
    for (const row of rows) checkGeometryRow(row, value);
  };
  const currentGeometry = (value: DurableBattedWorldFieldGeometry) => {
    ownBases.current(value.baseGeometry); historicalGeometry(value);
  };
  return { deriveGeometry, readGeometry, historicalGeometry, currentGeometry };
};
