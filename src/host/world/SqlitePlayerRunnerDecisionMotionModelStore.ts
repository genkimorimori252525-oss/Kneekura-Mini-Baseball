import { createRequire } from 'node:module';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { playerRunnerDecisionMotionModelInput as input, runnerModelId as id, runnerModelDay as day,
  type AcceptedPlayerRunnerDecisionMotionModel } from './PlayerRunnerDecisionMotionModel';
export type { AcceptedPlayerRunnerDecisionMotionModel } from './PlayerRunnerDecisionMotionModel';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerPersonLinkEvidenceFromSqlite, type DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';

export type DurablePlayerRunnerDecisionMotionModel = Readonly<{
  source: AcceptedPlayerRunnerDecisionMotionModel;
  person: DurablePlayerPersonLink;
}>;
export type SqlitePlayerRunnerDecisionMotionModelStore = Readonly<{
  accept(sourceId: string): DurablePlayerRunnerDecisionMotionModel;
  read(sourceId: string): DurablePlayerRunnerDecisionMotionModel | null;
  selectAtDay(careerId: string, playerId: string, atDay: number): DurablePlayerRunnerDecisionMotionModel;
  close(): void;
}>;
type Authority = Readonly<{ readAcceptedModel(sourceId: string): AcceptedPlayerRunnerDecisionMotionModel | null }>;
type Row = {
  source_id: string; source_version: string; capability: string; career_id: string; player_id: string;
  person_link_source_id: string; accepted_at_day: number;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
// Ownership discovery enumerates decoded duplicate scalar/container occurrences. json_extract's
// first-value choice is not the same interpretation as JSON.parse's last-value choice.
const scopeClaim = (column: string, path: readonly string[]): string => {
  const object = "CASE WHEN owner.type='object' THEN owner.value ELSE '{}' END";
  return `EXISTS (SELECT 1 FROM (${nodes(column, path)}) owner
    WHERE EXISTS (SELECT 1 FROM (${nodes(object, ['careerId'])}) claim WHERE claim.type='text' AND claim.atom=?)
      AND EXISTS (SELECT 1 FROM (${nodes(object, ['playerId'])}) claim WHERE claim.type='text' AND claim.atom=?))`;
};
const sourceClaim = (column: string, path: readonly string[]): string =>
  `EXISTS (SELECT 1 FROM (${nodes(column, path)}) claim WHERE claim.type='text' AND claim.atom=?)`;

/** Reconstructs explicit runner parameters and their original Player/Person link; no defender model or live truth dependency. */
export const playerRunnerDecisionMotionModelEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const derive = (raw: AcceptedPlayerRunnerDecisionMotionModel): DurablePlayerRunnerDecisionMotionModel => {
    const source = input(raw);
    const person = playerPersonLinkEvidenceFromSqlite(db).readLink(source.personLinkSourceId);
    if (!person || person.sourceId !== source.personLinkSourceId || person.careerId !== source.careerId
      || person.playerId !== source.playerId || source.acceptedAtDay < person.acceptedAtDay) {
      throw new Error('runner decision-motion model original Person scope or day differs');
    }
    return freeze({ source, person });
  };
  const metadata = (row: Row): void => {
    const source = { sourceId: row.source_id, sourceVersion: row.source_version, capability: row.capability,
      careerId: row.career_id, playerId: row.player_id, personLinkSourceId: row.person_link_source_id,
      acceptedAtDay: row.accepted_at_day };
    const check = (column: string, path: readonly string[], expected: Readonly<Record<string, string | number>>): void => {
      const owners = nodes(column, path);
      const entry = db.prepare(`SELECT
        (SELECT count(*) FROM (${owners})) AS n,
        (SELECT owner.type FROM (${owners}) owner) AS type,
        (SELECT CASE WHEN owner.type='object' THEN ${projection('owner.value', Object.keys(expected))} END
          FROM (${owners}) owner) AS identity
        FROM world_player_runner_decision_motion_models WHERE source_id=?`)
        .get(row.source_id) as { n: number; type: string; identity: string | null } | undefined;
      if (!entry || entry.n !== 1 || entry.type !== 'object' || !matches(entry.identity, expected)) {
        throw new Error('Player runner decision-motion ownership metadata differs');
      }
    };
    check('source_json', [], source);
    check('snapshot_json', ['source'], source);
    check('snapshot_json', ['person'], { sourceId: row.person_link_source_id,
      careerId: row.career_id, playerId: row.player_id });
  };
  const scope = (careerId: string, playerId: string): readonly DurablePlayerRunnerDecisionMotionModel[] => {
    // Each ownership mirror participates; only matching rows cross the full archive read boundary.
    const rows = db.prepare(`SELECT * FROM world_player_runner_decision_motion_models WHERE (career_id=? AND player_id=?)
      OR ${scopeClaim('source_json', [])}
      OR ${scopeClaim('snapshot_json', ['source'])}
      OR ${scopeClaim('snapshot_json', ['person'])}`)
      .all(careerId, playerId, careerId, playerId, careerId, playerId, careerId, playerId) as Row[];
    if (rows.length > 1) throw new Error('Player runner decision-motion baseline scope differs');
    return rows.map((row) => {
      metadata(row);
      const source = input(JSON.parse(row.source_json) as AcceptedPlayerRunnerDecisionMotionModel, row.source_id), value = derive(source);
      if (source.careerId !== careerId || source.playerId !== playerId || row.career_id !== careerId || row.player_id !== playerId
        || row.source_version !== source.sourceVersion || row.capability !== source.capability || row.person_link_source_id !== source.personLinkSourceId
        || row.accepted_at_day !== source.acceptedAtDay
        || row.source_json !== json(source) || row.source_hash !== hash(source)
        || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original Player runner decision-motion model archive');
      return value;
    });
  };
  const read = (sourceId: string): DurablePlayerRunnerDecisionMotionModel | null => {
    if (!id(sourceId)) throw new Error('invalid Player runner decision-motion model scope');
    const rows = db.prepare(`SELECT * FROM world_player_runner_decision_motion_models WHERE source_id=?
      OR ${sourceClaim('source_json', ['sourceId'])}
      OR ${sourceClaim('snapshot_json', ['source', 'sourceId'])}`)
      .all(sourceId, sourceId, sourceId) as Row[];
    if (rows.length > 1) throw new Error('Player runner decision-motion Source ownership scope differs');
    const row = rows[0];
    if (!row) return null;
    if (row.source_id !== sourceId) throw new Error('Player runner decision-motion Source identity mirror differs');
    metadata(row);
    const source = input(JSON.parse(row.source_json) as AcceptedPlayerRunnerDecisionMotionModel, sourceId);
    const value = scope(source.careerId, source.playerId)[0];
    if (!value || value.source.sourceId !== sourceId) throw new Error('Player runner decision-motion model is outside its own baseline');
    return value;
  };
  const selectAtDay = (careerId: string, playerId: string, atDay: number): DurablePlayerRunnerDecisionMotionModel => {
    if (!id(careerId) || !id(playerId) || !day(atDay)) throw new Error('invalid Player runner decision-motion model day');
    const value = scope(careerId, playerId)[0];
    if (!value) throw new Error('accepted Player runner decision-motion baseline is missing');
    if (value.source.acceptedAtDay > atDay) throw new Error('Player runner decision-motion model is from a future day');
    return value;
  };
  const before = (raw: DurablePlayerRunnerDecisionMotionModel): void => {
    const value = cloneInert(raw);
    const source = input(value.source);
    if (scope(source.careerId, source.playerId).length) throw new Error('Player runner decision-motion baseline already exists');
    if (json(derive(source)) !== json(value)) throw new Error('Player runner decision-motion original changed before write');
  };
  return { derive, read, selectAtDay, before };
};

/** One immutable accepted baseline per Player. Later development needs its own validated history, not an overwrite. */
export const openSqlitePlayerRunnerDecisionMotionModelStore = (path: string, authority?: Authority): SqlitePlayerRunnerDecisionMotionModelStore => {
  if (!id(path) || authority != null && typeof authority.readAcceptedModel !== 'function') throw new Error('invalid Player runner decision-motion model sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_player_runner_decision_motion_models (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, capability TEXT NOT NULL, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    person_link_source_id TEXT NOT NULL, accepted_at_day INTEGER NOT NULL,
    source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,player_id));`);
  const own = playerRunnerDecisionMotionModelEvidenceFromSqlite(db);
  let closed = false;
  const check = (): void => { if (closed) throw new Error('closed Player runner decision-motion model store'); };
  return Object.freeze({
    read(sourceId) { check(); return own.read(sourceId); },
    selectAtDay(careerId, playerId, atDay) { check(); return own.selectAtDay(careerId, playerId, atDay); },
    accept(sourceId) {
      check();
      const prior = own.read(sourceId), raw = authority?.readAcceptedModel(sourceId) ?? null;
      const source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('Player runner decision-motion Source is frozen differently');
        const original = own.read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('Player runner decision-motion original changed during retry');
        return original;
      }
      if (!source) throw new Error('accepted Player runner decision-motion model Source is missing');
      const value = own.derive(source);
      own.before(value);
      db.exec('BEGIN IMMEDIATE');
      try {
        own.before(value);
        db.prepare('INSERT INTO world_player_runner_decision_motion_models VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion, source.capability,
          source.careerId, source.playerId, source.personLinkSourceId, source.acceptedAtDay,
          json(source), hash(source), json(value), hash(value));
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('Player runner decision-motion original changed during write');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
