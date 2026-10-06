import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBodyCompositionTransaction } from './BodyMaterializationSqliteOwnership';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite, type BodyMaterializationParameters } from './PlayerBodyCapabilityMaterializationEvidence';
import { battedBodyModelMaterializationEvidenceFromSqlite, battedBodyModelAssemblyInput } from './BattedBodyModelMaterializationEvidence';
import { bodySourceId, bodyMaterializationSourceInput, type BodyMaterializationAuthority, type BodyMaterializationStore,
  type BodyMaterializationRequest } from './PlayerBodyCapabilityMaterialization';

/** Composition archives only: no Person copies, body heads, defaults, growth or physical result authority. */
export const openSqlitePlayerBodyCapabilityMaterializationStore = (
  path: string, authority?: BodyMaterializationAuthority,
): BodyMaterializationStore => {
  if (!bodySourceId(path) || authority !== undefined && (typeof authority.readAcceptedMaterialization !== 'function'
    || typeof authority.readAcceptedBody !== 'function' || typeof authority.readAcceptedPose !== 'function'
    || typeof authority.readAcceptedReachCalibration !== 'function'
    || authority.readAcceptedModelAssembly !== undefined && typeof authority.readAcceptedModelAssembly !== 'function')) {
    throw new Error('invalid body composition authority');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS main.world_player_body_materializations (
        source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,career_id TEXT NOT NULL,player_id TEXT NOT NULL,person_id TEXT NOT NULL,
        person_link_source_id TEXT NOT NULL,at_day INTEGER NOT NULL,role TEXT NOT NULL,
        source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS main.world_batted_body_materializations (
        source_id TEXT PRIMARY KEY,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL
      );`);
    const actors = playerBodyCapabilityMaterializationEvidenceFromSqlite(db), models = battedBodyModelMaterializationEvidenceFromSqlite(db);
    let closed = false;
    const check = (sourceId: string) => { if (closed || !bodySourceId(sourceId)) throw new Error('invalid or closed body composition identity'); };
    const parameters = (source: BodyMaterializationRequest): BodyMaterializationParameters => ({
      body: source.bodyRef === null ? null : cloneInert(authority!.readAcceptedBody(source.bodyRef.sourceId)),
      pose: source.poseRef === null ? null : cloneInert(authority!.readAcceptedPose(source.poseRef.sourceId)),
      reachCalibration: source.reachCalibrationRef === null ? null : cloneInert(authority!.readAcceptedReachCalibration(source.reachCalibrationRef.sourceId)),
    });
    return Object.freeze({
      read(sourceId: string) { check(sourceId); return withBodyCompositionTransaction(db, false, () => actors.read(sourceId)); },
      accept(sourceId: string) {
        check(sourceId);
        return withBodyCompositionTransaction(db, true, () => {
          const prior = actors.readArchive(sourceId);
          if (prior) {
            if (authority) {
              const raw = authority.readAcceptedMaterialization(sourceId);
              if (raw === null) throw new Error('accepted retry materialization Source is missing');
              const source = bodyMaterializationSourceInput(raw, sourceId);
              if (json(source) !== json(prior.source)) throw new Error('body materialization Source is frozen differently');
              const result = actors.derive(source, parameters(source), prior.releaseProof);
              if (result.kind !== 'materialized' || json(result.archive) !== json(prior)) throw new Error('body materialization retry inputs changed');
            }
            const current = actors.readArchive(sourceId);
            if (json(current) !== json(prior)) throw new Error('original body materialization changed during retry');
            return { kind: 'materialized' as const, value: actors.read(sourceId)! };
          }
          const raw = authority?.readAcceptedMaterialization(sourceId) ?? null;
          if (raw === null) throw new Error('accepted materialization Source is missing');
          const source = bodyMaterializationSourceInput(raw, sourceId), inputs = parameters(source), result = actors.derive(source, inputs);
          if (result.kind === 'pending') return result;
          actors.assertParameterPins(result.archive);
          db.prepare('INSERT INTO main.world_player_body_materializations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(sourceId, source.sourceVersion, source.careerId, source.playerId, source.personId, source.personLinkSourceId,
              source.atDay, source.role, json(source), hash(source), json(result.archive), hash(result.archive));
          // New admission rechecks today's original selection; replay alone may legitimately accept a later history append.
          const admission = actors.derive(source, inputs), saved = actors.readArchive(sourceId);
          if (admission.kind !== 'materialized' || json(admission.archive) !== json(result.archive) || json(saved) !== json(result.archive)) {
            throw new Error('body composition original owners changed during write');
          }
          return { kind: 'materialized' as const, value: result.value };
        });
      },
      readAcceptedModel(sourceId: string) { check(sourceId); return withBodyCompositionTransaction(db, false, () => models.read(sourceId)); },
      acceptModel(sourceId: string) {
        check(sourceId);
        return withBodyCompositionTransaction(db, true, () => {
          const prior = models.read(sourceId), raw = authority?.readAcceptedModelAssembly?.(sourceId) ?? null;
          if (prior) {
            if (authority?.readAcceptedModelAssembly) {
              if (raw === null) throw new Error('accepted retry body model assembly is missing');
              const source = battedBodyModelAssemblyInput(raw, sourceId);
              const row = db.prepare('SELECT source_json FROM main.world_batted_body_materializations WHERE source_id=?').get(sourceId)!;
              if (row.source_json !== json(source) || json(models.derive(source)) !== json(prior)) {
                throw new Error('body model assembly is frozen differently');
              }
            }
            const current = models.read(sourceId);
            if (json(current) !== json(prior)) throw new Error('body model original evidence changed during retry');
            return current!;
          }
          if (raw === null) throw new Error('accepted body model assembly is missing');
          const source = battedBodyModelAssemblyInput(raw, sourceId), value = models.derive(source);
          db.prepare('INSERT INTO main.world_batted_body_materializations VALUES (?,?,?,?,?)')
            .run(sourceId, json(source), hash(source), json(value), hash(value));
          const saved = models.read(sourceId);
          if (json(saved) !== json(value)) throw new Error('body model original evidence changed during write');
          return saved!;
        });
      },
      close() { if (!closed) { db.close(); closed = true; } },
    });
  } catch (error) { db.close(); throw error; }
};
