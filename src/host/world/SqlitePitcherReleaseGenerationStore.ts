import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { generatePitcherReleaseGeometry, type GeneratedPitcherReleaseGeometry,
  type PitcherReleaseBody, type PitcherReleaseGenerationPolicy } from '../../core/world/development/PitcherReleaseGeneration';
import type { SqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import type { AcceptedReleaseGeometryBaseline, PlayerReleaseGeometryHistory,
  SqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';

/** The independent creation owner accepts body evidence and the versioned prior together. */
export type AcceptedPitcherReleaseCreation = Readonly<{
  sourceId: string; sourceVersion: string; careerId: string; playerId: string;
  personSourceId: string; bodySourceId: string; createdAtDay: number;
  body: PitcherReleaseBody; policy: PitcherReleaseGenerationPolicy;
}>;
export type DurablePitcherReleaseGeneration = Readonly<{
  input: AcceptedPitcherReleaseCreation; geometry: GeneratedPitcherReleaseGeometry;
  baseline: AcceptedReleaseGeometryBaseline;
}>;
export type SqlitePitcherReleaseGenerationStore = Readonly<{
  initialize(sourceId: string): DurablePitcherReleaseGeneration;
  readGeneration(sourceId: string): DurablePitcherReleaseGeneration | null;
  readAcceptedBaseline(sourceId: string): AcceptedReleaseGeometryBaseline | null;
  close(): void;
}>;
type Row = { source_id: string; career_id: string; player_id: string; person_source_id: string; created_at_day: number;
  request_json: string; generated_json: string; baseline_json: string; record_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = (request: string, generated: string, baseline: string): string => createHash('sha256').update(JSON.stringify([request, generated, baseline])).digest('hex');
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Archives once-only World creation provenance; Match reads the separate frozen release owner. */
export const openSqlitePitcherReleaseGenerationStore = (databasePath: string,
  person: Pick<SqlitePersonGenesisStore, 'read' | 'readDevelopmentSeed'>,
  authority?: Readonly<{ readAcceptedCreation(sourceId: string): AcceptedPitcherReleaseCreation | null }> | null,
): SqlitePitcherReleaseGenerationStore => {
  if (!id(databasePath) || !person || typeof person.read !== 'function' || typeof person.readDevelopmentSeed !== 'function'
    || authority != null && typeof authority.readAcceptedCreation !== 'function') throw new Error('invalid Pitcher release generation sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_pitcher_release_generation_policies (
    career_id TEXT NOT NULL, policy_id TEXT NOT NULL, version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY(career_id, policy_id, version)
  );
  CREATE TABLE IF NOT EXISTS world_pitcher_release_generations (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL, person_source_id TEXT NOT NULL,
    created_at_day INTEGER NOT NULL, request_json TEXT NOT NULL, generated_json TEXT NOT NULL,
    baseline_json TEXT NOT NULL, record_hash TEXT NOT NULL, UNIQUE(career_id, player_id)
  );`);
  const get = db.prepare('SELECT * FROM world_pitcher_release_generations WHERE source_id=?');
  const getPolicy = db.prepare('SELECT policy_json FROM world_pitcher_release_generation_policies WHERE career_id=? AND policy_id=? AND version=?');
  let closed = false;
  const scope = (sourceId: string): void => { if (closed || !id(sourceId)) throw new Error('invalid Pitcher creation source scope'); };
  const project = (raw: AcceptedPitcherReleaseCreation, sourceId: string): DurablePitcherReleaseGeneration => {
    const input = cloneInert(raw);
    if (!input || Object.keys(input).sort().join('|') !== 'body|bodySourceId|careerId|createdAtDay|personSourceId|playerId|policy|sourceId|sourceVersion'
      || input.sourceId !== sourceId || !id(input.sourceVersion) || !id(input.careerId) || !id(input.playerId)
      || !id(input.personSourceId) || !id(input.bodySourceId) || !Number.isSafeInteger(input.createdAtDay) || input.createdAtDay < 0) throw new Error('invalid accepted Pitcher creation record');
    const accepted = person.read(input.personSourceId);
    const careerSeed = person.readDevelopmentSeed(input.careerId);
    if (!accepted || accepted.sourceId !== input.personSourceId || accepted.careerId !== input.careerId || accepted.playerId !== input.playerId
      || accepted.priors.createdAtDay !== input.createdAtDay || careerSeed === null) throw new Error('Pitcher generation requires the exact accepted Player Person and Career seed');
    const geometry = generatePitcherReleaseGeometry({ careerId: input.careerId, playerId: input.playerId, createdAtDay: input.createdAtDay,
      careerSeed, body: input.body, policy: input.policy });
    const baseline: AcceptedReleaseGeometryBaseline = { sourceId, sourceVersion: input.sourceVersion, careerId: input.careerId, playerId: input.playerId,
      personLinkSourceId: input.personSourceId, acceptedAtDay: input.createdAtDay, body: geometry.body, profile: geometry.profile, tierBoundaries: geometry.tierBoundaries };
    return freeze({ input, geometry, baseline });
  };
  const readGeneration = (sourceId: string): DurablePitcherReleaseGeneration | null => {
    scope(sourceId);
    const row = get.get(sourceId) as Row | undefined;
    if (!row) return null;
    try {
      const expected = project(JSON.parse(row.request_json) as AcceptedPitcherReleaseCreation, sourceId);
      const policy = getPolicy.get(expected.input.careerId, expected.input.policy.policyId, expected.input.policy.version) as { policy_json: string } | undefined;
      if (row.career_id !== expected.input.careerId || row.player_id !== expected.input.playerId || row.person_source_id !== expected.input.personSourceId
        || row.created_at_day !== expected.input.createdAtDay || json(expected.input) !== row.request_json || json(expected.geometry) !== row.generated_json
        || json(expected.baseline) !== row.baseline_json || hash(row.request_json, row.generated_json, row.baseline_json) !== row.record_hash
        || policy?.policy_json !== json(expected.input.policy)) throw new Error('Pitcher release generation replay differs');
      return expected;
    } catch (cause) { throw new Error(`corrupt Pitcher release generation for ${sourceId}`, { cause }); }
  };
  return Object.freeze({
    initialize(sourceId: string): DurablePitcherReleaseGeneration {
      scope(sourceId);
      if (!authority) {
        const saved = readGeneration(sourceId);
        if (saved) return saved;
        throw new Error('accepted Pitcher creation authority is missing');
      }
      const raw = authority.readAcceptedCreation(sourceId);
      if (!raw) throw new Error('accepted Pitcher creation record is missing');
      const accepted = cloneInert(raw);
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = project(accepted, sourceId);
        const saved = readGeneration(sourceId);
        if (saved) {
          if (json(saved.input) !== json(result.input)) throw new Error('Pitcher creation source is already frozen differently');
          db.exec('COMMIT'); return saved;
        }
        const duplicate = db.prepare('SELECT source_id FROM world_pitcher_release_generations WHERE career_id=? AND player_id=?')
          .get(result.input.careerId, result.input.playerId);
        if (duplicate) throw new Error('Player Pitcher creation is already frozen differently');
        const policy = getPolicy.get(result.input.careerId, result.input.policy.policyId, result.input.policy.version) as { policy_json: string } | undefined;
        const policyJson = json(result.input.policy);
        if (policy && policy.policy_json !== policyJson) throw new Error('Pitcher generation policy version is already frozen differently');
        if (!policy) db.prepare('INSERT INTO world_pitcher_release_generation_policies VALUES (?, ?, ?, ?)')
          .run(result.input.careerId, result.input.policy.policyId, result.input.policy.version, policyJson);
        const requestJson = json(result.input), generatedJson = json(result.geometry), baselineJson = json(result.baseline);
        db.prepare(`INSERT INTO world_pitcher_release_generations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, result.input.careerId, result.input.playerId, result.input.personSourceId, result.input.createdAtDay,
            requestJson, generatedJson, baselineJson, hash(requestJson, generatedJson, baselineJson));
        db.exec('COMMIT'); return result;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readGeneration,
    readAcceptedBaseline: (sourceId: string): AcceptedReleaseGeometryBaseline | null => readGeneration(sourceId)?.baseline ?? null,
    close: () => { if (!closed) { db.close(); closed = true; } },
  });
};

/** Two idempotent stages; retry after a crash between commits. */
export const materializeGeneratedPitcherRelease = (stores: Readonly<{
  generation: Pick<SqlitePitcherReleaseGenerationStore, 'initialize'>;
  release: Pick<SqlitePlayerReleaseGeometryStore, 'initialize'>;
}>, sourceId: string): Readonly<{ baseline: AcceptedReleaseGeometryBaseline; history: PlayerReleaseGeometryHistory }> => {
  const { baseline } = stores.generation.initialize(sourceId);
  const history = stores.release.initialize(sourceId);
  if (history.careerId !== baseline.careerId || history.playerId !== baseline.playerId || history.baseline.sourceId !== baseline.sourceId
    || history.baseline.sourceVersion !== baseline.sourceVersion || history.baseline.effectiveDay !== baseline.acceptedAtDay
    || json(history.baseline.body) !== json(baseline.body) || json(history.baseline.profile) !== json(baseline.profile)
    || json(history.tierBoundaries) !== json(baseline.tierBoundaries)) throw new Error('Pitcher generation and accepted release history diverged');
  return Object.freeze({ baseline, history });
};
