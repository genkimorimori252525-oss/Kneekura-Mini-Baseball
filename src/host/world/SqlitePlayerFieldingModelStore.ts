import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createDefensiveRatings, type DefensiveRatings } from '../../core/model/DefensiveRatings';
import type { BallTransferTimingParameters } from '../../core/sim/fielding/BallTransferTiming';
import type { ThrowLaunchCalibration } from '../../core/sim/fielding/ThrowLaunch';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { isAcceptedPlayerIntakeSource, type DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';

export type AcceptedPlayerFieldingModel = Readonly<{
  sourceId: string; sourceVersion: string; careerId: string; playerId: string; personLinkSourceId: string; acceptedAtDay: number;
  ratings: DefensiveRatings; transferParameters: BallTransferTimingParameters; throwCalibration: ThrowLaunchCalibration;
}>;
export type DurablePlayerFieldingModel = Readonly<{ source: AcceptedPlayerFieldingModel; person: DurablePlayerPersonLink }>;
export type SqlitePlayerFieldingModelStore = Readonly<{
  accept(sourceId: string): DurablePlayerFieldingModel; read(sourceId: string): DurablePlayerFieldingModel | null;
  selectAtDay(careerId: string, playerId: string, atDay: number): DurablePlayerFieldingModel; close(): void;
}>;
type Authority = Readonly<{ readAcceptedModel(sourceId: string): AcceptedPlayerFieldingModel | null }>;
type Row = { source_id: string; career_id: string; player_id: string; person_link_source_id: string; accepted_at_day: number;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type LinkRow = { source_id: string; career_id: string; player_id: string; person_id: string; roster_revision: number; accepted_at_day: number; source_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const day = (value: number) => Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, expected: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
const input = (raw: AcceptedPlayerFieldingModel, sourceId: string): AcceptedPlayerFieldingModel => {
  const source = cloneInert(raw), ratings = source?.ratings, transfer = source?.transferParameters, throwing = source?.throwCalibration;
  if (!fields(source, ['sourceId', 'sourceVersion', 'careerId', 'playerId', 'personLinkSourceId', 'acceptedAtDay', 'ratings', 'transferParameters', 'throwCalibration'])
    || source.sourceId !== sourceId || ![sourceId, source.sourceVersion, source.careerId, source.playerId, source.personLinkSourceId].every(id)
    || !day(source.acceptedAtDay) || !fields(ratings, ['positionSuitability', 'firstStep', 'acceleration', 'battedBallRead', 'routeEfficiency',
      'catching', 'transfer', 'armStrength', 'throwingAccuracy', 'situationalAwareness', 'tagSkill'])
    || !fields(ratings.positionSuitability, ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'])
    || !fields(transfer, ['minimumTransferDelayTicks', 'maximumTransferDelayTicks', 'fixedGripOffsetTicks'])
    || !Object.values(transfer).every(day) || transfer.minimumTransferDelayTicks > transfer.maximumTransferDelayTicks
    || !day(transfer.maximumTransferDelayTicks + transfer.fixedGripOffsetTicks)
    || !fields(throwing, ['minimumReleaseSpeedMps', 'maximumReleaseSpeedMps', 'minimumTargetErrorMeters', 'maximumTargetErrorMeters'])
    || !Object.values(throwing).every(Number.isFinite) || throwing.minimumReleaseSpeedMps <= 0
    || throwing.maximumReleaseSpeedMps < throwing.minimumReleaseSpeedMps || throwing.minimumTargetErrorMeters < 0
    || throwing.maximumTargetErrorMeters < throwing.minimumTargetErrorMeters) throw new Error('invalid accepted Player fielding model Source');
  return { ...source, ratings: createDefensiveRatings(ratings) };
};

/** The actual own immutable intake link establishes Player/Person provenance. A peer identity or profile is never authority. */
export const playerFieldingModelEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const derive = (source: AcceptedPlayerFieldingModel): DurablePlayerFieldingModel => {
    const row = db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').get(source.personLinkSourceId) as LinkRow | undefined;
    const person = row ? JSON.parse(row.source_json) as DurablePlayerPersonLink : null;
    if (!row || !isAcceptedPlayerIntakeSource(person, source.personLinkSourceId) || row.source_json !== json(person)
      || row.source_id !== person.sourceId || row.career_id !== person.careerId || row.player_id !== person.playerId || row.person_id !== person.personId
      || row.roster_revision !== person.rosterRevision || row.accepted_at_day !== person.acceptedAtDay
      || person.careerId !== source.careerId || person.playerId !== source.playerId || source.acceptedAtDay < person.acceptedAtDay) {
      throw new Error('Player fielding model original Person scope differs');
    }
    return freeze({ source, person });
  };
  const scope = (careerId: string, playerId: string): readonly DurablePlayerFieldingModel[] => {
    const rows = db.prepare("SELECT * FROM world_player_fielding_models WHERE (career_id=? AND player_id=?) OR (json_extract(source_json,'$.careerId')=? AND json_extract(source_json,'$.playerId')=?)")
      .all(careerId, playerId, careerId, playerId) as Row[];
    if (rows.length > 1) throw new Error('Player fielding baseline scope differs');
    return rows.map((row) => {
      const source = input(JSON.parse(row.source_json) as AcceptedPlayerFieldingModel, row.source_id), value = derive(source);
      if (source.careerId !== careerId || source.playerId !== playerId || row.career_id !== careerId || row.player_id !== playerId
        || row.person_link_source_id !== source.personLinkSourceId || row.accepted_at_day !== source.acceptedAtDay
        || row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
        throw new Error('corrupt original Player fielding model archive');
      }
      return value;
    });
  };
  const read = (sourceId: string): DurablePlayerFieldingModel | null => {
    if (!id(sourceId)) throw new Error('invalid Player fielding model scope');
    const row = db.prepare('SELECT * FROM world_player_fielding_models WHERE source_id=?').get(sourceId) as Row | undefined;
    if (!row) return null;
    const source = input(JSON.parse(row.source_json) as AcceptedPlayerFieldingModel, sourceId), value = scope(source.careerId, source.playerId)[0];
    if (!value || value.source.sourceId !== sourceId) throw new Error('Player fielding model is outside its own baseline');
    return value;
  };
  const selectAtDay = (careerId: string, playerId: string, atDay: number): DurablePlayerFieldingModel => {
    if (!id(careerId) || !id(playerId) || !day(atDay)) throw new Error('invalid Player fielding model day');
    const value = scope(careerId, playerId)[0];
    if (!value) throw new Error('accepted Player fielding baseline is missing');
    if (value.source.acceptedAtDay > atDay) throw new Error('Player fielding model is from a future day');
    return value;
  };
  const before = (value: DurablePlayerFieldingModel) => {
    if (scope(value.source.careerId, value.source.playerId).length) throw new Error('Player fielding baseline already exists');
    if (json(derive(value.source)) !== json(value)) throw new Error('Player fielding original changed before write');
  };
  return { derive, read, selectAtDay, before };
};

/** Immutable accepted baseline; learning/development must add its own validated history rather than overwrite this Source. */
export const openSqlitePlayerFieldingModelStore = (path: string, authority?: Authority): SqlitePlayerFieldingModelStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedModel !== 'function') throw new Error('invalid Player fielding model sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_fielding_models (source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,player_id));`);
  const own = playerFieldingModelEvidenceFromSqlite(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed Player fielding model store'); };
  return Object.freeze({ read(sourceId) { check(); return own.read(sourceId); }, selectAtDay(careerId, playerId, atDay) { check(); return own.selectAtDay(careerId, playerId, atDay); },
    accept(sourceId) {
      check(); const prior = own.read(sourceId), raw = authority?.readAcceptedModel(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('Player fielding Source is frozen differently');
        const original = own.read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('Player fielding original changed during retry');
        return original;
      }
      if (!source) throw new Error('accepted Player fielding model Source is missing');
      const value = own.derive(source); own.before(value);
      db.exec('BEGIN IMMEDIATE');
      try {
        own.before(value);
        db.prepare('INSERT INTO world_player_fielding_models VALUES (?,?,?,?,?,?,?,?,?)').run(sourceId, source.careerId, source.playerId,
          source.personLinkSourceId, source.acceptedAtDay, json(source), hash(source), json(value), hash(value));
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('Player fielding original changed during write');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
