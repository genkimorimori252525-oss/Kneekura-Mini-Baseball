import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { RecordedDevelopmentInitiation } from '../../core/world/development/DevelopmentInitiationHistory';
import { resolveDevelopmentEpisodeFromAcceptedAppraisal, type AcceptedDevelopmentAppraisal,
  type AcceptedDevelopmentPolicies } from './DevelopmentEpisodeFromAcceptedAppraisal';
import type { DevelopmentInitiationSourceRequest } from './SqliteDevelopmentInitiationStore';
import type { PracticeInitiationRow } from './PracticeDevelopmentOrigin';
import { managerRosterEvidenceFromSqlite } from './SqliteManagerRosterDecisionStore';
import { personGenesisEvidenceFromSqlite } from './SqlitePersonGenesisStore';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type RosterDevelopmentOrigin = Readonly<{ request: DevelopmentInitiationSourceRequest;
  appraisal: AcceptedDevelopmentAppraisal; policies: AcceptedDevelopmentPolicies;
  prior: readonly RecordedDevelopmentInitiation[] }>;
const table = 'world_development_roster_origins';
export const rosterDevelopmentOriginSchema = `CREATE TABLE IF NOT EXISTS ${table}(
  episode_id TEXT PRIMARY KEY,appraisal_source_id TEXT NOT NULL UNIQUE,origin_json TEXT NOT NULL,origin_hash TEXT NOT NULL)`;
export const captureRosterDevelopmentOrigin = (request: DevelopmentInitiationSourceRequest,
  appraisal: AcceptedDevelopmentAppraisal, policies: AcceptedDevelopmentPolicies,
  prior: readonly RecordedDevelopmentInitiation[]): RosterDevelopmentOrigin => freeze(cloneInert({ request, appraisal, policies, prior }));

export const resolveRosterDevelopmentOrigin = (db: DatabaseSync, origin: RosterDevelopmentOrigin): RecordedDevelopmentInitiation => {
  assertBodyCompositionNativeConnection(db);
  if (!db.isTransaction) throw new Error('roster development requires a Native read transaction');
  return resolveDevelopmentEpisodeFromAcceptedAppraisal({ roster: managerRosterEvidenceFromSqlite(db), person: personGenesisEvidenceFromSqlite(db),
    appraisal: { readAcceptedAppraisal: id => id === origin.appraisal.sourceId ? origin.appraisal : null },
    policies: { readAcceptedPolicies: id => id === origin.policies.sourceId ? origin.policies : null },
    history: { readAcceptedPrior: () => origin.prior } }, origin.request);
};

export const readRosterDevelopmentOrigin = (db: DatabaseSync, episodeId: string): RosterDevelopmentOrigin | null => {
  assertBodyCompositionNativeConnection(db);
  if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(table)) return null;
  const rows = db.prepare(`SELECT * FROM ${table} WHERE episode_id=$id OR ${claim('origin_json', ['request', 'episodeId'], '$id')}
    OR ${claim('origin_json', ['appraisal', 'episodeId'], '$id')}`).all({ id: episodeId });
  if (rows.length > 1 || rows.length === 1 && rows[0].episode_id !== episodeId) throw new Error('roster development original Source ownership differs');
  const row = rows[0]; if (!row) return null;
  const origin = JSON.parse(String(row.origin_json)) as RosterDevelopmentOrigin;
  if (json(origin) !== json(captureRosterDevelopmentOrigin(origin.request, origin.appraisal, origin.policies, origin.prior))
    || row.origin_json !== json(origin) || row.origin_hash !== hash(origin) || origin.request.episodeId !== episodeId
    || row.appraisal_source_id !== origin.request.appraisalSourceId || origin.appraisal.sourceId !== row.appraisal_source_id) {
    throw new Error('roster development original source archive differs');
  }
  const peers = db.prepare(`SELECT episode_id FROM ${table} WHERE appraisal_source_id=$id
    OR ${claim('origin_json', ['request', 'appraisalSourceId'], '$id')}
    OR ${claim('origin_json', ['appraisal', 'sourceId'], '$id')}`).all({ id: origin.request.appraisalSourceId });
  if (peers.length !== 1 || peers[0].episode_id !== episodeId) throw new Error('roster development appraisal Source ownership differs');
  return freeze(origin);
};

/** Inputs are independently accepted, but the executed roster/Person/seed proof
 * is always reconstructed on this connection. Legacy episode bytes stay exact. */
export const readRosterDevelopmentBoundary = (db: DatabaseSync, row: PracticeInitiationRow) => {
  const origin = readRosterDevelopmentOrigin(db, row.episode_id);
  if (!origin) throw new Error('roster development original appraisal/policy archive is missing');
  const initial = resolveRosterDevelopmentOrigin(db, origin);
  if (row.request_json !== json(origin.request) || row.prior_json !== json(origin.prior)
    || row.career_id !== initial.assessment.careerId || row.player_id !== initial.assessment.playerId
    || row.at_day !== initial.assessment.atDay || row.assessment_json !== json(initial.assessment)
    || row.initial_json !== json(initial.episode)) throw new Error('roster development original result differs');
  return freeze({ saved: origin, initial });
};
