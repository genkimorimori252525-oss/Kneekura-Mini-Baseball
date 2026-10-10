import { deriveDefenderPhysicalReachCalibration } from '../../core/sim/fielding/DefenderPhysicalProfileCalibration';
import { createRequire } from 'node:module';
import { memoSamePaContinuationRead, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { playerFieldingModelEvidenceFromSqlite } from './SqlitePlayerFieldingModelStore';
import { playerReleaseGeometryEvidenceFromSqlite, type PlayerReleaseGeometryProof } from './SqlitePlayerReleaseGeometryStore';
import { assertBodyCompositionNativeConnection, bodyCompositionTableInstalled, bodyCompositionSourceClaim as claim, type BodyCompositionDb } from './BodyMaterializationSqliteOwnership';
import { bodySourceId, bodySourceFields, bodyMaterializationSourceInput, acceptedBodyMaterializationInput,
  acceptedPoseMaterializationInput, acceptedReachMaterializationInput,
  type BodyMaterializationRequest, type BodyMaterializationReceipt, type BodyMaterializationResult,
  type AcceptedBodySource, type AcceptedPoseSource, type AcceptedReachSource } from './PlayerBodyCapabilityMaterialization';

export type BodyMaterializationParameters = Readonly<{
  body: AcceptedBodySource | null; pose: AcceptedPoseSource | null; reachCalibration: AcceptedReachSource | null;
}>;
export type ArchivedBodyMaterialization = BodyMaterializationReceipt & Readonly<{ releaseProof: PlayerReleaseGeometryProof | null }>;
export type BodyMaterializationDerivation = Readonly<{ kind: 'materialized'; value: BodyMaterializationReceipt; archive: ArchivedBodyMaterialization }>
  | Extract<BodyMaterializationResult, { kind: 'pending' }>;
type Row = {
  source_id: string; source_version: string; career_id: string; player_id: string; person_id: string; person_link_source_id: string;
  at_day: number; role: string; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string;
};
const table = 'world_player_body_materializations';
const receiptFields = ['source', 'person', 'body', 'pose', 'reachCalibration', 'fieldingModel', 'releaseGeometry', 'actor', 'reach', 'releaseProof'];
const receiptValue = (archive: ArchivedBodyMaterialization): BodyMaterializationReceipt => {
  const { releaseProof: _proof, ...value } = archive; return freeze(value);
};

/** Original immutable actor composition on the caller's connection; no schema or peer reads. */
export const playerBodyCapabilityMaterializationEvidenceFromSqlite = (db: BodyCompositionDb) => {
  const identities = (sourceId: string): readonly Row[] => !bodyCompositionTableInstalled(db, table) ? [] :
    db.prepare(`SELECT * FROM main.${table} WHERE source_id=? OR ${claim('source_json', ['sourceId'])}
      OR ${claim('snapshot_json', ['source', 'sourceId'])}`).all(sourceId, sourceId, sourceId) as Row[];
  const derive = (s: BodyMaterializationRequest, parameters: BodyMaterializationParameters,
    pinnedRelease?: PlayerReleaseGeometryProof | null, current = true): BodyMaterializationDerivation => {
    assertBodyCompositionNativeConnection(db);
    if (!bodyCompositionTableInstalled(db, 'world_player_person_links') || !bodyCompositionTableInstalled(db, 'world_roster_heads')) {
      throw new Error('original body Person/roster owner is missing');
    }
    const person = playerPersonLinkEvidenceFromSqlite(db).readLink(s.personLinkSourceId);
    if (!person || person.sourceId !== s.personLinkSourceId || person.careerId !== s.careerId || person.playerId !== s.playerId
      || person.personId !== s.personId || s.atDay < person.acceptedAtDay) throw new Error('body materialization original Person scope differs');
    const body = s.bodyRef === null ? null : parameters.body === null ? null
      : acceptedBodyMaterializationInput(parameters.body, s.bodyRef, s, person);
    const pose = s.poseRef === null ? null : parameters.pose === null ? null
      : acceptedPoseMaterializationInput(parameters.pose, s.poseRef, s, person);
    const calibration = s.reachCalibrationRef === null ? null : parameters.reachCalibration === null ? null
      : acceptedReachMaterializationInput(parameters.reachCalibration, s.reachCalibrationRef, s);
    if (s.bodyRef !== null && !body || s.poseRef !== null && !pose || s.reachCalibrationRef !== null && !calibration) {
      throw new Error('nonnull accepted body/pose/calibration Source is missing');
    }
    let fieldingModel: BodyMaterializationReceipt['fieldingModel'] = null;
    if (s.fieldingModelRef !== null) {
      if (!bodyCompositionTableInstalled(db, 'world_player_fielding_models')) throw new Error('original body fielding owner is missing');
      const owner = playerFieldingModelEvidenceFromSqlite(db);
      fieldingModel = owner.read(s.fieldingModelRef.sourceId);
      if (!fieldingModel || fieldingModel.source.sourceVersion !== s.fieldingModelRef.sourceVersion
        || json(fieldingModel.person) !== json(person)
        || fieldingModel.source.acceptedAtDay > s.atDay
        || current && json(owner.selectAtDay(s.careerId, s.playerId, s.atDay)) !== json(fieldingModel)) {
        throw new Error('body materialization applicable fielding Source differs');
      }
    }
    let releaseGeometry: BodyMaterializationReceipt['releaseGeometry'] = null, releaseProof: PlayerReleaseGeometryProof | null = null;
    if (s.releaseGeometryRef !== null) {
      const owner = playerReleaseGeometryEvidenceFromSqlite(db);
      if (pinnedRelease === undefined) {
        const pinned = owner.pinAtDay(s.careerId, s.playerId, s.atDay);
        releaseGeometry = pinned.snapshot; releaseProof = pinned.proof;
      } else {
        if (pinnedRelease === null) throw new Error('original body release proof is missing');
        releaseGeometry = owner.replayPinned(pinnedRelease, s.careerId, s.playerId, s.atDay); releaseProof = pinnedRelease;
      }
      if (releaseGeometry.sourceId !== s.releaseGeometryRef.sourceId || releaseGeometry.sourceVersion !== s.releaseGeometryRef.sourceVersion
        || releaseGeometry.effectiveDay !== s.releaseGeometryRef.effectiveDay || releaseProof.baseline.personLinkSourceId !== s.personLinkSourceId
        || body && releaseGeometry.body.heightMeters !== body.physicalProfile.heightMeters) {
        throw new Error('body materialization pinned release/body Source differs');
      }
    } else if (pinnedRelease != null) throw new Error('unexpected archived release proof');
    const reach = body && calibration ? deriveDefenderPhysicalReachCalibration(body.physicalProfile, calibration.baseline) : null;
    if (reach && (!Object.values(reach).every(Number.isFinite) || reach.bodyOriginHeightMeters > body!.physicalProfile.heightMeters)) {
      throw new Error('derived body origin/reach is outside accepted actor geometry');
    }
    const missing: Extract<BodyMaterializationResult, { kind: 'pending' }>['missing'][number][] = [];
    if (s.bodyRef === null) missing.push('body');
    if (s.poseRef === null) missing.push('pose');
    if (s.reachCalibrationRef === null) missing.push('reachCalibration');
    if (['defender', 'pitcher'].includes(s.role) && s.fieldingModelRef === null) missing.push('fieldingModel');
    if (s.role === 'pitcher' && s.releaseGeometryRef === null) missing.push('releaseGeometry');
    if (missing.length) return freeze({ kind: 'pending', missing });
    if (!body || !pose || !calibration || !reach) throw new Error('accepted body parameters are incomplete');
    const value: BodyMaterializationReceipt = freeze({ source: s, person, body, pose, reachCalibration: calibration,
      fieldingModel, releaseGeometry, actor: { playerId: s.playerId, personId: s.personId, heightMeters: body.physicalProfile.heightMeters,
        bodyOriginHeightMeters: reach.bodyOriginHeightMeters, primitives: pose.primitives }, reach });
    return { kind: 'materialized', value, archive: freeze({ ...value, releaseProof }) };
  };
  const parseRow = (row: Row): ArchivedBodyMaterialization => {
    const source = bodyMaterializationSourceInput(JSON.parse(row.source_json) as BodyMaterializationRequest, row.source_id);
    const archived = JSON.parse(row.snapshot_json) as ArchivedBodyMaterialization;
    if (!bodySourceFields(archived, receiptFields)) throw new Error('invalid original body composition snapshot');
    const result = derive(source, archived, archived.releaseProof, false);
    if (result.kind !== 'materialized' || row.source_version !== source.sourceVersion || row.career_id !== source.careerId
      || row.player_id !== source.playerId || row.person_id !== source.personId || row.person_link_source_id !== source.personLinkSourceId
      || row.at_day !== source.atDay || row.role !== source.role || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(result.archive) || row.snapshot_hash !== hash(result.archive)) {
      throw new Error('corrupt original body composition archive or native dependencies');
    }
    return result.archive;
  };
  const assertParameterPins = (archive: ArchivedBodyMaterialization): void => {
    for (const key of ['body', 'pose', 'reachCalibration'] as const) {
      const source = archive[key];
      const refKey = `${key}Ref`;
      const rows = db.prepare(`SELECT * FROM main.${table} WHERE ${claim('snapshot_json', [key, 'sourceId'])}
        OR ${claim('source_json', [refKey, 'sourceId'])} OR ${claim('snapshot_json', ['source', refKey, 'sourceId'])}`)
        .all(source.sourceId, source.sourceId, source.sourceId) as Row[];
      for (const row of rows) {
        // A later body can share measurements while pinning a developed
        // fielding model. Its parameter claim is not an authority for this
        // earlier body's physical/development ancestry.
        const original = JSON.parse(row.snapshot_json) as ArchivedBodyMaterialization;
        const bodySource = bodyMaterializationSourceInput(JSON.parse(row.source_json), row.source_id);
        if (!bodySourceFields(original, receiptFields) || json(original.source) !== json(bodySource)
          || row.source_version !== bodySource.sourceVersion || row.career_id !== bodySource.careerId || row.player_id !== bodySource.playerId
          || row.person_id !== bodySource.personId || row.person_link_source_id !== bodySource.personLinkSourceId || row.at_day !== bodySource.atDay || row.role !== bodySource.role
          || row.source_json !== json(bodySource) || row.source_hash !== hash(bodySource)
          || row.snapshot_json !== json(original) || row.snapshot_hash !== hash(original)) throw new Error('corrupt body parameter Source claim');
        if (json(original[key]) !== json(source)) throw new Error('accepted body parameter Source was reused with a different payload');
      }
    }
  };
  const authenticateArchive = (sourceId: string): ArchivedBodyMaterialization | null => {
    if (!bodySourceId(sourceId)) throw new Error('invalid body materialization identity');
    const rows = identities(sourceId);
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('original body materialization Source ownership differs');
    const row = rows[0]; if (!row) return null;
    const archive = parseRow(row); assertParameterPins(archive); return archive;
  };
  /** Sibling Native readers may share only the complete immutable archive.
   * Main-owner checks still run on every access; writes and independent proofs
   * keep their original authentication path and never inherit this evidence. */
  const readArchive = (sourceId: string): ArchivedBodyMaterialization | null => {
    const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    if (!(db instanceof Native) || !db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) return authenticateArchive(sourceId);
    return withSamePaContinuationReadPhase(db, () => {
      if (!bodySourceId(sourceId)) throw new Error('invalid body materialization identity');
      assertBodyCompositionNativeConnection(db);
      return memoSamePaContinuationRead(db, 'body-materialization-archive:' + sourceId, () => authenticateArchive(sourceId));
    });
  };
  return Object.freeze({ derive, assertParameterPins, readArchive,
    read: (sourceId: string): BodyMaterializationReceipt | null => {
      const archive = readArchive(sourceId); return archive ? receiptValue(archive) : null;
    },
  });
};
