import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createCompetitionEdition,
  type CompetitionEditionInput,
  type CompetitionEditionSnapshot,
  type CompetitionFormatProfile } from
  '../../core/world/competition/CompetitionEdition';
import { snapshotCompetitionDrawPolicy,
  type CompetitionDrawPolicy,
  type CompetitionDrawPolicyRegistry } from
  '../../core/world/competition/CompetitionDraw';

export type SqliteCompetitionEditionStore = Readonly<{
  initialize(careerId: string, profile: CompetitionFormatProfile,
    input: CompetitionEditionInput,
    registry: CompetitionDrawPolicyRegistry): CompetitionEditionSnapshot;
  readEdition(careerId: string,
    editionId: string): CompetitionEditionSnapshot | null;
  close(): void;
}>;
export type AcceptedEditionQualificationAuthority = Readonly<{
  readSnapshot(careerId: string, editionId: string): Readonly<{
    qualificationSnapshotId: string;
    competitionEditionId: string;
    participantIds: readonly string[];
  }> | null;
}>;
type EditionRow = { request_json: string; snapshot_json: string };
type PolicyRow = { policy_json: string };
type StoredRequest = Readonly<{ profile: CompetitionFormatProfile;
  input: CompetitionEditionInput }>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Persist historical edition rules and draw policy without later reinterpretation. */
export const openSqliteCompetitionEditionStore = (
  databasePath: string,
  qualificationAuthority?: AcceptedEditionQualificationAuthority,
): SqliteCompetitionEditionStore => {
  if (!id(databasePath)) throw new Error('invalid edition database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_competition_draw_policies (
    career_id TEXT NOT NULL, policy_version TEXT NOT NULL,
    policy_json TEXT NOT NULL,
    PRIMARY KEY (career_id, policy_version)
  );
  CREATE TABLE IF NOT EXISTS world_competition_editions (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const getEdition = db.prepare(`SELECT request_json, snapshot_json
    FROM world_competition_editions WHERE career_id=? AND edition_id=?`);
  const getPolicy = db.prepare(`SELECT policy_json
    FROM world_competition_draw_policies
    WHERE career_id=? AND policy_version=?`);
  const editionRow = (careerId: string, editionId: string):
    EditionRow | null => (getEdition.get(careerId, editionId) as
      EditionRow | undefined) ?? null;
  const policyRow = (careerId: string, version: string):
    PolicyRow | null => (getPolicy.get(careerId, version) as
      PolicyRow | undefined) ?? null;
  const requireQualification = (careerId: string,
    input: CompetitionEditionInput): void => {
    if (!qualificationAuthority) return;
    const source = qualificationAuthority.readSnapshot(careerId,
      input.editionId);
    if (!source || source.competitionEditionId !== input.editionId
      || source.qualificationSnapshotId
        !== input.qualificationSnapshotId
      || canonicalJson(source.participantIds)
        !== canonicalJson(input.participantIds)) {
      throw new Error('Edition lacks accepted qualification snapshot');
    }
  };
  const parse = (careerId: string, editionId: string,
    row: EditionRow): CompetitionEditionSnapshot => {
    try {
      const request = JSON.parse(row.request_json) as StoredRequest;
      const snapshot = JSON.parse(row.snapshot_json) as
        CompetitionEditionSnapshot;
      const storedPolicy = policyRow(careerId,
        request.profile.drawPolicyVersion);
      if (!storedPolicy) throw new Error('draw policy is missing');
      const policy = JSON.parse(storedPolicy.policy_json) as
        CompetitionDrawPolicy;
      const checkedPolicy = snapshotCompetitionDrawPolicy(policy);
      requireQualification(careerId, request.input);
      const replayed = createCompetitionEdition(request.profile,
        request.input, { policies: [checkedPolicy] });
      if (request.input.editionId !== editionId
        || canonicalJson(request) !== row.request_json
        || canonicalJson(snapshot) !== row.snapshot_json
        || canonicalJson(checkedPolicy) !== storedPolicy.policy_json
        || canonicalJson(replayed) !== row.snapshot_json) {
        throw new Error('edition replay differs');
      }
      return replayed;
    } catch (cause) {
      throw new Error(`corrupt competition edition for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  return Object.freeze({
    initialize(careerId: string, rawProfile: CompetitionFormatProfile,
      rawInput: CompetitionEditionInput,
      registry: CompetitionDrawPolicyRegistry): CompetitionEditionSnapshot {
      if (closed || !id(careerId)) {
        throw new Error('invalid competition Edition Career scope');
      }
      const profile = cloneInert(rawProfile);
      const input = cloneInert(rawInput);
      requireQualification(careerId, input);
      const edition = createCompetitionEdition(profile, input,
        registry);
      const policy = snapshotCompetitionDrawPolicy(profile.drawPolicy);
      const requestJson = canonicalJson({ profile, input });
      const snapshotJson = canonicalJson(edition);
      const policyJson = canonicalJson(policy);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existingPolicy = policyRow(careerId,
          policy.version);
        if (existingPolicy && existingPolicy.policy_json !== policyJson) {
          throw new Error('draw policy version is already frozen differently');
        }
        const existing = editionRow(careerId, input.editionId);
        if (existing) {
          const prior = parse(careerId, input.editionId, existing);
          if (existing.request_json !== requestJson) {
            throw new Error('competition Edition is already frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        if (!existingPolicy) {
          db.prepare(`INSERT INTO world_competition_draw_policies
            (career_id, policy_version, policy_json)
            VALUES (?, ?, ?)`).run(careerId, policy.version,
            policyJson);
        }
        db.prepare(`INSERT INTO world_competition_editions
          (career_id, edition_id, request_json, snapshot_json)
          VALUES (?, ?, ?, ?)`).run(careerId, input.editionId,
          requestJson, snapshotJson);
        db.exec('COMMIT');
        return edition;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readEdition(careerId: string,
      editionId: string): CompetitionEditionSnapshot | null {
      if (closed || !id(careerId) || !id(editionId)) {
        throw new Error('invalid competition Edition read scope');
      }
      const stored = editionRow(careerId, editionId);
      return stored ? parse(careerId, editionId, stored) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
