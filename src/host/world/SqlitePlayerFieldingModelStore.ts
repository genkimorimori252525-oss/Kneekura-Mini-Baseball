import { createRequire } from 'node:module';
import { assertPhysicalCapabilityDevelopment, physicalCapabilityDevelopmentInput, withPhysicalCapabilityReplay, type AcceptedPhysicalCapabilityDevelopment } from './AcceptedPhysicalCapabilityDevelopment';
import { bodyCompositionTableInstalled, withBodyCompositionTransaction } from './BodyMaterializationSqliteOwnership';
import { sqliteJsonMetadataNodes as metadataNodes } from './SqliteOwnershipMetadata';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createDefensiveRatings, type DefensiveRatings } from '../../core/model/DefensiveRatings';
import type { BallTransferTimingParameters } from '../../core/sim/fielding/BallTransferTiming';
import type { ThrowLaunchCalibration } from '../../core/sim/fielding/ThrowLaunch';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { isAcceptedPlayerIntakeSource, type DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';

export type AcceptedPlayerFieldingModel = Readonly<{
  sourceId: string; sourceVersion: string; careerId: string; playerId: string; personLinkSourceId: string; acceptedAtDay: number;
  developmentProvenance?: AcceptedPhysicalCapabilityDevelopment;
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
// Keep Player pairs in the same exact owner container while enumerating every
// duplicate leaf/container. Canonical archive validation below rejects ambiguity.
const playerClaim = (document: string, path: readonly string[]): string => `EXISTS (
  SELECT 1 FROM (${metadataNodes(document, path)}) owner,
    json_each(CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END) career,
    json_each(CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END) player
  WHERE career.key='careerId' AND career.type='text' AND career.atom=?
    AND player.key='playerId' AND player.type='text' AND player.atom=?)`;
const id = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const day = (value: number) => Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, expected: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
const input = (raw: AcceptedPlayerFieldingModel, sourceId?: string): AcceptedPlayerFieldingModel => {
  const source = cloneInert(raw), ratings = source?.ratings, transfer = source?.transferParameters, throwing = source?.throwCalibration;
  if (!fields(source, ['sourceId', 'sourceVersion', 'careerId', 'playerId', 'personLinkSourceId', 'acceptedAtDay', 'ratings', 'transferParameters', 'throwCalibration',
    ...(source && Object.hasOwn(source, 'developmentProvenance') ? ['developmentProvenance'] : [])])
    || sourceId !== undefined && source.sourceId !== sourceId || ![source.sourceId, source.sourceVersion, source.careerId, source.playerId, source.personLinkSourceId].every(id)
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
  if (Object.hasOwn(source, 'developmentProvenance')) physicalCapabilityDevelopmentInput(source.developmentProvenance!, 'fielding');
  return { ...source, ratings: createDefensiveRatings(ratings) };
};

const baselineTable = 'world_player_fielding_models';
const developmentTable = 'world_player_fielding_model_developments';
type HistoryRow = Row & { owner_table: string };
/** Baseline bytes remain immutable. Tagged additions replay their original
 * development prefix and dated predecessor on this same connection. */
export const playerFieldingModelEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const tables = () => [baselineTable, ...(bodyCompositionTableInstalled(db, developmentTable) ? [developmentTable] : [])];
  const claims = (row: HistoryRow) => {
    const source = input(JSON.parse(row.source_json), row.source_id), archived = JSON.parse(row.snapshot_json) as DurablePlayerFieldingModel;
    if (!fields(archived, ['source', 'person']) || json(archived.source) !== json(source)
      || row.career_id !== source.careerId || row.player_id !== source.playerId || row.person_link_source_id !== source.personLinkSourceId
      || row.accepted_at_day !== source.acceptedAtDay || archived.person?.careerId !== source.careerId
      || archived.person.playerId !== source.playerId || archived.person.sourceId !== source.personLinkSourceId
      || row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(archived)
      || row.snapshot_hash !== hash(archived) || (row.owner_table === developmentTable) !== !!source.developmentProvenance) {
      throw new Error('corrupt original Player fielding model archive');
    }
    return { row, source };
  };
  const scope = (careerId: string, playerId: string) => {
    const rows = tables().flatMap(table => db.prepare(`SELECT *, '${table}' AS owner_table FROM ${table} WHERE (career_id=? AND player_id=?)
      OR ${playerClaim('source_json', [])} OR ${playerClaim('snapshot_json', ['source'])} OR ${playerClaim('snapshot_json', ['person'])}`)
      .all(careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId) as HistoryRow[]);
    const values = rows.map(claims).sort((a, b) => a.source.acceptedAtDay - b.source.acceptedAtDay);
    for (const [index, value] of values.entries()) {
      const prior = values[index - 1], p = value.source.developmentProvenance;
      if (value.source.careerId !== careerId || value.source.playerId !== playerId
        || (!prior ? !!p : !p || prior.source.acceptedAtDay >= value.source.acceptedAtDay
          || p.originalModelRef.sourceId !== prior.source.sourceId || p.originalModelRef.sourceVersion !== prior.source.sourceVersion
          || p.originalModelSourceHash !== prior.row.source_hash || p.originalModelSnapshotHash !== prior.row.snapshot_hash)) {
        throw new Error('Player fielding baseline scope or development history differs');
      }
    }
    return values;
  };
  const derive = (raw: AcceptedPlayerFieldingModel): DurablePlayerFieldingModel => {
    const source = input(raw);
    return withPhysicalCapabilityReplay(db, 'fielding', source.sourceId, () => {
      const row = db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').get(source.personLinkSourceId) as LinkRow | undefined;
      const person = row ? JSON.parse(row.source_json) as DurablePlayerPersonLink : null;
      if (!row || !isAcceptedPlayerIntakeSource(person, source.personLinkSourceId) || row.source_json !== json(person)
        || row.source_id !== person.sourceId || row.career_id !== person.careerId || row.player_id !== person.playerId || row.person_id !== person.personId
        || row.roster_revision !== person.rosterRevision || row.accepted_at_day !== person.acceptedAtDay
        || person.careerId !== source.careerId || person.playerId !== source.playerId || source.acceptedAtDay < person.acceptedAtDay) {
        throw new Error('Player fielding model original Person scope differs');
      }
      const value = freeze({ source, person });
      if (source.developmentProvenance) {
        const prior = read(source.developmentProvenance.originalModelRef.sourceId);
        if (!prior) throw new Error('original fielding development model is missing');
        assertPhysicalCapabilityDevelopment(db, source, prior, 'fielding');
      }
      return value;
    });
  };
  const read = (sourceId: string): DurablePlayerFieldingModel | null => {
    if (!id(sourceId)) throw new Error('invalid Player fielding model scope');
    const rows = tables().flatMap(table => db.prepare(`SELECT *, '${table}' AS owner_table FROM ${table} WHERE source_id=?
      OR EXISTS (SELECT 1 FROM (${metadataNodes('source_json', ['sourceId'])}) claim WHERE claim.type='text' AND claim.atom=?)
      OR EXISTS (SELECT 1 FROM (${metadataNodes('snapshot_json', ['source', 'sourceId'])}) claim WHERE claim.type='text' AND claim.atom=?)`)
      .all(sourceId, sourceId, sourceId) as HistoryRow[]);
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('Player fielding Source ownership scope differs');
    if (!rows.length) return null;
    const { source } = claims(rows[0]); scope(source.careerId, source.playerId);
    const value = derive(source);
    if (rows[0].snapshot_json !== json(value)) throw new Error('corrupt original Player fielding model archive');
    return value;
  };
  const selectAtDay = (careerId: string, playerId: string, atDay: number): DurablePlayerFieldingModel => {
    if (!id(careerId) || !id(playerId) || !day(atDay)) throw new Error('invalid Player fielding model day');
    const selected = scope(careerId, playerId).filter(value => value.source.acceptedAtDay <= atDay).at(-1);
    if (!selected) throw new Error('accepted Player fielding baseline is missing or from a future day');
    return read(selected.source.sourceId)!;
  };
  const before = (raw: DurablePlayerFieldingModel) => {
    const value = cloneInert(raw);
    input(value.source);
    const current = scope(value.source.careerId, value.source.playerId).at(-1), p = value.source.developmentProvenance;
    if (p ? !current || current.source.sourceId !== p.originalModelRef.sourceId || current.source.acceptedAtDay >= value.source.acceptedAtDay : !!current) {
      throw new Error('Player fielding baseline already exists or development predecessor differs');
    }
    if (json(derive(value.source)) !== json(value)) throw new Error('Player fielding original changed before write');
  };
  const after = (raw: DurablePlayerFieldingModel) => {
    const value = cloneInert(raw);
    input(value.source);
    if (scope(value.source.careerId, value.source.playerId).at(-1)?.source.sourceId !== value.source.sourceId) {
      throw new Error('accepted model history changed during insertion');
    }
  };
  const snapshot = <T>(body: () => T): T => {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    return db instanceof DatabaseSync ? withBodyCompositionTransaction(db, false, body) : body();
  };
  return { derive, before, after, read: (id: string) => snapshot(() => read(id)),
    selectAtDay: (career: string, player: string, day: number) => snapshot(() => selectAtDay(career, player, day)) };
};

/** Append-only accepted development keeps the original baseline table and bytes. */
export const openSqlitePlayerFieldingModelStore = (path: string, authority?: Authority): SqlitePlayerFieldingModelStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedModel !== 'function') throw new Error('invalid Player fielding model sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_fielding_models (source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,player_id));
    CREATE TABLE IF NOT EXISTS world_player_fielding_model_developments (source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,player_id,accepted_at_day));`);
  const own = playerFieldingModelEvidenceFromSqlite(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed Player fielding model store'); };
  return Object.freeze({ read(sourceId) { check(); return own.read(sourceId); }, selectAtDay(careerId, playerId, atDay) { check(); return own.selectAtDay(careerId, playerId, atDay); },
    accept(sourceId) {
      check(); return withBodyCompositionTransaction(db, true, () => {
        const prior = own.read(sourceId), raw = authority?.readAcceptedModel(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
        if (prior) {
          if (source && json(source) !== json(prior.source)) throw new Error('Player fielding Source is frozen differently');
          const original = own.read(sourceId);
          if (!original || json(original) !== json(prior)) throw new Error('Player fielding original changed during retry');
          return original;
        }
        if (!source) throw new Error('accepted Player fielding model Source is missing');
        const value = own.derive(source); own.before(value);
        const table = source.developmentProvenance ? developmentTable : baselineTable;
        db.prepare(`INSERT INTO ${table} VALUES (?,?,?,?,?,?,?,?,?)`).run(sourceId, source.careerId, source.playerId,
          source.personLinkSourceId, source.acceptedAtDay, json(source), hash(source), json(value), hash(value));
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('Player fielding original changed during write');
        own.after(saved); return saved;
      });
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
