import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { bodySourceFields as fields, bodySourceId as id, type BodySourceRef } from './PlayerBodyCapabilityMaterialization';
import { readNativeDevelopmentPracticeExposureFromSqlite } from './SqliteDevelopmentPracticeExposureStore';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type PhysicalCapabilityRoute = 'fielding' | 'runner_decision_motion' | 'defender_locomotion';
export type AcceptedPhysicalCapabilityDevelopment = Readonly<{
  kind: 'accepted_physical_capability_development_v1'; route: PhysicalCapabilityRoute;
  originalModelRef: BodySourceRef; originalModelSourceHash: string; originalModelSnapshotHash: string;
  exposureRef: BodySourceRef; exposureSourceHash: string; exposureSnapshotHash: string;
  assessmentRef: BodySourceRef; calibrationRef: BodySourceRef; replacementSourceHash: string;
}>;
export const physicalCapabilityDevelopmentInput = (raw: AcceptedPhysicalCapabilityDevelopment, route: PhysicalCapabilityRoute) => {
  const p = cloneInert(raw), digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
  const ref = (v: BodySourceRef) => fields(v, ['sourceId', 'sourceVersion']) && id(v.sourceId) && id(v.sourceVersion);
  if (!fields(p, ['kind', 'route', 'originalModelRef', 'originalModelSourceHash', 'originalModelSnapshotHash', 'exposureRef',
    'exposureSourceHash', 'exposureSnapshotHash', 'assessmentRef', 'calibrationRef', 'replacementSourceHash'])
    || p.kind !== 'accepted_physical_capability_development_v1' || p.route !== route
    || ![p.originalModelRef, p.exposureRef, p.assessmentRef, p.calibrationRef].every(ref)
    || ![p.originalModelSourceHash, p.originalModelSnapshotHash, p.exposureSourceHash, p.exposureSnapshotHash, p.replacementSourceHash].every(digest)) {
    throw new Error('invalid explicit physical capability development provenance');
  }
  return freeze(p);
};
type Source = BodySourceRef & Readonly<{ careerId: string; playerId: string; personLinkSourceId: string; acceptedAtDay: number;
  developmentProvenance?: AcceptedPhysicalCapabilityDevelopment }>;
/** Original values are explicit accepted inputs. This authenticates their
 * causal evidence, without deriving a gain or transferring pitch ability. */
export const assertPhysicalCapabilityDevelopment = (db: Pick<DatabaseSync, 'prepare'>, source: Source,
  original: Readonly<{ source: Source }>, route: PhysicalCapabilityRoute): void => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('physical capability history requires a Native transaction');
  const p = physicalCapabilityDevelopmentInput(source.developmentProvenance!, route);
  const { developmentProvenance: _, ...replacement } = source;
  if (source.sourceId === original.source.sourceId || original.source.sourceId !== p.originalModelRef.sourceId
    || original.source.sourceVersion !== p.originalModelRef.sourceVersion || hash(original.source) !== p.originalModelSourceHash
    || hash(original) !== p.originalModelSnapshotHash || hash(replacement) !== p.replacementSourceHash
    || ['careerId', 'playerId', 'personLinkSourceId'].some(key => source[key as keyof Source] !== original.source[key as keyof Source])
    || original.source.acceptedAtDay >= source.acceptedAtDay) throw new Error('physical capability original model or replacement differs');
  const exposure = readNativeDevelopmentPracticeExposureFromSqlite(db, p.exposureRef.sourceId);
  if (!exposure || exposure.source.sourceVersion !== p.exposureRef.sourceVersion || hash(exposure.source) !== p.exposureSourceHash
    || hash(exposure) !== p.exposureSnapshotHash || !exposure.assessment.eligible || exposure.episode.stage !== 'CONSOLIDATED'
    || exposure.episode.careerId !== source.careerId || exposure.episode.playerId !== source.playerId
    || exposure.assessment.atDay !== exposure.episode.effectiveDay || exposure.assessment.atDay > source.acceptedAtDay
    || original.source.acceptedAtDay > exposure.assessment.atDay) throw new Error('physical capability original exposure or effective day differs');
  const initiation = db.prepare('SELECT request_json FROM main.world_development_initiations WHERE episode_id=?').get(exposure.episode.episodeId);
  if (!initiation || JSON.parse(String(initiation.request_json)).personSourceId !== source.personLinkSourceId) {
    throw new Error('physical capability original initiation Person differs');
  }
};
const active = new WeakMap<object, Set<string>>();
export const withPhysicalCapabilityReplay = <T>(db: object, route: PhysicalCapabilityRoute | 'defender_observation' | 'defender_decision' | 'batter_run_transition', sourceId: string, body: () => T): T => {
  const key = json([route, sourceId]), seen = active.get(db) ?? new Set<string>();
  if (seen.has(key)) throw new Error('cyclic physical capability development evidence');
  seen.add(key); active.set(db, seen);
  try { return body(); } finally { seen.delete(key); if (!seen.size) active.delete(db); }
};
