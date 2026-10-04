import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerDecisionCalibration, type PlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerFieldingModelEvidenceFromSqlite, type DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

/** All values are explicit accepted inputs; sourceVersion identifies calibration provenance, not a latest-version selector. */
export type AcceptedPlayerDecisionModel = Readonly<{
  sourceId: string;
  sourceVersion: string;
  careerId: string;
  playerId: string;
  personLinkSourceId: string;
  fieldingModelSourceId: string;
  acceptedAtDay: number;
  calibration: PlayerDecisionCalibration;
}>;
export type DurablePlayerDecisionModel = Readonly<{
  source: AcceptedPlayerDecisionModel;
  fieldingModel: DurablePlayerFieldingModel;
}>;
export type SqlitePlayerDecisionModelStore = Readonly<{
  accept(sourceId: string): DurablePlayerDecisionModel;
  read(sourceId: string): DurablePlayerDecisionModel | null;
  selectAtDay(careerId: string, playerId: string, atDay: number): DurablePlayerDecisionModel;
  close(): void;
}>;
type Authority = Readonly<{ readAcceptedModel(sourceId: string): AcceptedPlayerDecisionModel | null }>;
type Row = {
  source_id: string; source_version: string; career_id: string; player_id: string;
  person_link_source_id: string; fielding_model_source_id: string; accepted_at_day: number;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, names: readonly string[]): boolean => value !== null && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...names].sort());
const input = (raw: AcceptedPlayerDecisionModel, sourceId?: string): AcceptedPlayerDecisionModel => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'careerId', 'playerId', 'personLinkSourceId', 'fieldingModelSourceId', 'acceptedAtDay', 'calibration'])
    || sourceId !== undefined && source.sourceId !== sourceId
    || ![source.sourceId, source.sourceVersion, source.careerId, source.playerId, source.personLinkSourceId, source.fieldingModelSourceId].every(id)
    || !day(source.acceptedAtDay)) throw new Error('invalid accepted Player decision model Source');
  return { ...source, calibration: createPlayerDecisionCalibration(source.calibration) };
};

/** Reconstructs the exact immutable fielding Source and its original Player/Person link, never a peer-supplied profile. */
export const playerDecisionModelEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const fielding = playerFieldingModelEvidenceFromSqlite(db);
  const derive = (raw: AcceptedPlayerDecisionModel): DurablePlayerDecisionModel => {
    const source = input(raw);
    const fieldingModel = fielding.read(source.fieldingModelSourceId);
    if (!fieldingModel || fieldingModel.source.careerId !== source.careerId || fieldingModel.source.playerId !== source.playerId
      || fieldingModel.source.personLinkSourceId !== source.personLinkSourceId || fieldingModel.person.sourceId !== source.personLinkSourceId
      || source.acceptedAtDay < fieldingModel.source.acceptedAtDay) throw new Error('Player decision model original fielding/Person scope differs');
    return freeze({ source, fieldingModel });
  };
  const scope = (careerId: string, playerId: string): readonly DurablePlayerDecisionModel[] => {
    // Each ownership mirror participates, including pinned nested fielding/Person snapshots.
    // Jointly changing the index and Source must not hide an archived original Player baseline.
    const rows = db.prepare(`SELECT * FROM world_player_decision_models WHERE (career_id=? AND player_id=?)
      OR (json_extract(source_json,'$.careerId')=? AND json_extract(source_json,'$.playerId')=?)
      OR (json_extract(snapshot_json,'$.source.careerId')=? AND json_extract(snapshot_json,'$.source.playerId')=?)
      OR (json_extract(snapshot_json,'$.fieldingModel.source.careerId')=? AND json_extract(snapshot_json,'$.fieldingModel.source.playerId')=?)
      OR (json_extract(snapshot_json,'$.fieldingModel.person.careerId')=? AND json_extract(snapshot_json,'$.fieldingModel.person.playerId')=?)`)
      .all(careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId) as Row[];
    if (rows.length > 1) throw new Error('Player decision baseline scope differs');
    return rows.map((row) => {
      const source = input(JSON.parse(row.source_json) as AcceptedPlayerDecisionModel, row.source_id), value = derive(source);
      if (source.careerId !== careerId || source.playerId !== playerId || row.career_id !== careerId || row.player_id !== playerId
        || row.source_version !== source.sourceVersion || row.person_link_source_id !== source.personLinkSourceId
        || row.fielding_model_source_id !== source.fieldingModelSourceId || row.accepted_at_day !== source.acceptedAtDay
        || row.source_json !== json(source) || row.source_hash !== hash(source)
        || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original Player decision model archive');
      return value;
    });
  };
  const read = (sourceId: string): DurablePlayerDecisionModel | null => {
    if (!id(sourceId)) throw new Error('invalid Player decision model scope');
    const rows = db.prepare(`SELECT * FROM world_player_decision_models WHERE source_id=?
      OR json_extract(source_json,'$.sourceId')=? OR json_extract(snapshot_json,'$.source.sourceId')=?`)
      .all(sourceId, sourceId, sourceId) as Row[];
    if (rows.length > 1) throw new Error('Player decision Source ownership scope differs');
    const row = rows[0];
    if (!row) return null;
    const source = input(JSON.parse(row.source_json) as AcceptedPlayerDecisionModel, sourceId);
    const value = scope(source.careerId, source.playerId)[0];
    if (!value || value.source.sourceId !== sourceId) throw new Error('Player decision model is outside its own baseline');
    return value;
  };
  const selectAtDay = (careerId: string, playerId: string, atDay: number): DurablePlayerDecisionModel => {
    if (!id(careerId) || !id(playerId) || !day(atDay)) throw new Error('invalid Player decision model day');
    const value = scope(careerId, playerId)[0];
    if (!value) throw new Error('accepted Player decision baseline is missing');
    if (value.source.acceptedAtDay > atDay) throw new Error('Player decision model is from a future day');
    return value;
  };
  const before = (raw: DurablePlayerDecisionModel): void => {
    const value = cloneInert(raw);
    if (scope(value.source.careerId, value.source.playerId).length) throw new Error('Player decision baseline already exists');
    if (json(derive(value.source)) !== json(value)) throw new Error('Player decision original changed before write');
  };
  return { derive, read, selectAtDay, before };
};

/** One immutable accepted baseline per Player. Later development needs its own validated history, not an overwrite. */
export const openSqlitePlayerDecisionModelStore = (path: string, authority?: Authority): SqlitePlayerDecisionModelStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedModel !== 'function') throw new Error('invalid Player decision model sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_decision_models (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL, fielding_model_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,player_id));`);
  const own = playerDecisionModelEvidenceFromSqlite(db);
  let closed = false;
  const check = (): void => { if (closed) throw new Error('closed Player decision model store'); };
  return Object.freeze({
    read(sourceId) { check(); return own.read(sourceId); },
    selectAtDay(careerId, playerId, atDay) { check(); return own.selectAtDay(careerId, playerId, atDay); },
    accept(sourceId) {
      check();
      const prior = own.read(sourceId), raw = authority?.readAcceptedModel(sourceId) ?? null;
      const source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('Player decision Source is frozen differently');
        const original = own.read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('Player decision original changed during retry');
        return original;
      }
      if (!source) throw new Error('accepted Player decision model Source is missing');
      const value = own.derive(source);
      own.before(value);
      db.exec('BEGIN IMMEDIATE');
      try {
        own.before(value);
        db.prepare('INSERT INTO world_player_decision_models VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion,
          source.careerId, source.playerId, source.personLinkSourceId, source.fieldingModelSourceId, source.acceptedAtDay,
          json(source), hash(source), json(value), hash(value));
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('Player decision original changed during write');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
