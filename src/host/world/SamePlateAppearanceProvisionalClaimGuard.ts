import { samePaPlayerClaimCanProceed } from './SamePlateAppearanceSettlementAdmission';
import type { DatabaseSync } from 'node:sqlite';
import { assertNoPaDispatchPlayerClaim, assertNoPaDispatchWorkClaim, assertFreshPaDispatchEnrollment } from './SamePlateAppearanceDispatchClaimGuard';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaId as id, type ReservedSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollment';
import { assertSamePaStorage, authenticateSamePaRow, samePaEnrollmentRow, samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { assertReservedPaStorage, reservedPaSchema } from './SamePlateAppearanceExecutionStorage';
import { assertSamePaAssessmentOwnership } from './SamePlateAppearanceAssessmentOwnership';

type Db = Pick<DatabaseSync, 'prepare'>;
type Row = Record<string, unknown>;
type Reference = { owner: string; sourceId: string; sourceHash: string; snapshotHash: string };
type Participant = { playerId: string; bindingHash: string; personHash: string; baselineSourceId: string; revision: number; stateHash: string };
type Lineage = { enrollmentReference: Reference; actorReference: Reference; careerId: string; gameId: string; playId: number; firstPhysicalPitchSourceId: string; participantReferences: Participant[] };
type Source = { sourceId: string; sourceVersion: string; capability: string; enrollmentReference: Reference; prefixReference?: Reference;
  participantReference?: Participant; effortUnits?: unknown; provenance?: unknown; participantTotalReferences?: { playerId: string; assessmentReference: Reference }[] };
type RecordValue = { source: Source; lineage: Lineage; kind: string; physicalRevision?: number; effortUnits?: unknown };
type Claim = { owner: keyof typeof reservedPaSchema; row: Row; source: Source; value: RecordValue; lineage: Lineage };
const fail = (detail: string): never => { throw new Error('same-PA provisional claim ' + detail); };
const fields = (value: unknown, names: string[]): boolean => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value,name));
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const reference = (value: unknown, owner: string): Reference => {
  if (!fields(value, ['owner', 'sourceId', 'sourceHash', 'snapshotHash'])) fail('reference fields differ');
  const ref = value as Reference;
  if (ref.owner !== owner || !id(ref.sourceId) || !sha(ref.sourceHash) || !sha(ref.snapshotHash)) fail('reference identity differs');
  return ref;
};
/** A byte-canonical check rejects every duplicate/escaped key and NULL/type
 * laundering before JSON.parse can make one identity hide another. All rows
 * are inspected before scope selection; malformed owner storage fails closed. */
const document = <T>(raw: unknown): T => {
  if (typeof raw !== 'string') fail('document type differs');
  const value: unknown = JSON.parse(raw as string);
  if (!value || typeof value !== 'object' || Array.isArray(value) || json(value) !== raw) fail('raw identity metadata is not canonical');
  return value as T;
};
const authorityTable = (db: Db, name: string): void => {
  const main = db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(name);
  const temp = db.prepare('SELECT 1 FROM temp.sqlite_master WHERE lower(name)=lower(?)').all(name);
  if (temp.length || main.length !== 1 || main[0].type !== 'table' || main[0].name !== name) fail('original authority storage differs');
};
/** Reference discovery follows only typed owner identities, retaining raw
 * duplicate-key occurrences until canonical validation rejects them. A moved
 * index is corruption, not permission to forget its original authority. */
const authorityRow = (db: Db, table: string, sourceId: string, snapshot: boolean): Row => {
  authorityTable(db, table);
  const rows = db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}${snapshot ? ` OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}` : ''}`).all({ id: sourceId });
  if (rows.length !== 1 || rows[0].source_id !== sourceId) fail('original authority identity is missing or moved');
  return rows[0];
};
const authenticatedLineage = (db: Db, ref: Reference): Lineage => {
  if (!assertSamePaStorage(db)) fail('original enrollment storage is missing');
  const row = samePaEnrollmentRow(db, ref.sourceId);
  if (!row || row.source_hash !== ref.sourceHash || row.snapshot_hash !== ref.snapshotHash) fail('original enrollment reference differs');
  const root: ReservedSamePlateAppearanceEnrollment = authenticateSamePaRow(db, row!);
  const actorRef = root.source.actorReference, actor = authorityRow(db, 'physical_plate_appearance_actors', actorRef.sourceId, true);
  const actorSource = document<{ sourceId: string; gameId: string; playerId: string }>(actor.source_json);
  const actorValue = document<{ source: unknown; binding: { careerId: string; playerId: string }; match: { playId: number }; defenderBindings: unknown[] }>(actor.snapshot_json);
  if (actor.source_hash !== actorRef.sourceHash || actor.snapshot_hash !== actorRef.snapshotHash
    || actor.source_hash !== hash(actorSource) || actor.snapshot_hash !== hash(actorValue) || json(actorValue.source) !== json(actorSource)
    || actorSource.sourceId !== actorRef.sourceId || actorSource.gameId !== root.gameId || actorValue.match.playId !== root.playId
    || actorValue.binding.careerId !== root.careerId || actor.game_id !== root.gameId || actor.play_id !== root.playId
    || actor.player_id !== actorSource.playerId || actorSource.playerId !== actorValue.binding.playerId
    || json([actorValue.binding, ...actorValue.defenderBindings].sort((a, b) => String((a as { playerId: string }).playerId).localeCompare(String((b as { playerId: string }).playerId)))) !== json(root.participants.map(p => p.binding).sort((a, b) => a.playerId.localeCompare(b.playerId)))) fail('original actor authority differs');
  const participantReferences = root.participants.map(p => {
    const baseline = authorityRow(db, 'world_player_workload_baselines', p.baselineSourceId, false);
    const source = document<{ sourceId: string; careerId: string; playerId: string }>(baseline.source_json);
    const initial = document<{ careerId: string; playerId: string }>(baseline.initial_json);
    if (baseline.career_id !== root.careerId || baseline.player_id !== p.binding.playerId || source.sourceId !== p.baselineSourceId
      || source.careerId !== root.careerId || source.playerId !== p.binding.playerId || initial.careerId !== root.careerId
      || initial.playerId !== p.binding.playerId || hash(source) !== p.baselineSourceHash) fail('original baseline authority differs');
    return { playerId: p.binding.playerId, bindingHash: hash(p.binding), personHash: p.personHash,
      baselineSourceId: p.baselineSourceId, revision: p.state.revision, stateHash: hash(p.state) };
  });
  return { enrollmentReference: ref, actorReference: actorRef, careerId: root.careerId, gameId: root.gameId, playId: root.playId,
    firstPhysicalPitchSourceId: root.source.firstPhysicalPitchSourceId, participantReferences };
};
/** Invocation-local structural authentication only. The execution owners still
 * rederive the genuine actor, workload and empty prefix inside each private
 * read proof; no context or exception survives this guard invocation. */
const claims = (db: Db): Claim[] => {
  if (!assertReservedPaStorage(db)) return [];
  const lineages = new Map<string, Lineage>(), records: Claim[] = [];
  for (const owner of Object.keys(reservedPaSchema) as (keyof typeof reservedPaSchema)[]) {
    for (const row of db.prepare(`SELECT * FROM main.${owner}`).all()) {
      const source = document<Source>(row.source_json), value = document<RecordValue>(row.snapshot_json);
      const ref = reference(source.enrollmentReference, 'same_pa_enrollments');
      if (!id(source.sourceId) || !id(source.sourceVersion) || row.source_id !== source.sourceId || row.source_hash !== hash(source)
        || row.snapshot_hash !== hash(value) || json(value.source) !== json(source)) fail('immutable Source/result identity differs');
      const key = json(ref); let lineage = lineages.get(key);
      if (!lineage) { lineage = authenticatedLineage(db, ref); lineages.set(key, lineage); }
      if (json(value.lineage) !== json(lineage) || row.enrollment_source_id !== ref.sourceId || row.career_id !== lineage.careerId
        || row.game_id !== lineage.gameId || row.play_id !== lineage.playId || row.actor_source_id !== lineage.actorReference.sourceId
        || row.first_pitch_source_id !== lineage.firstPhysicalPitchSourceId) fail('indexed or raw lineage differs');
      if (owner === 'reserved_pa_work_prefixes') {
        if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference']) || source.capability !== 'reserved_same_pa_empty_prefix_v1'
          || value.kind !== 'empty_prefix' || row.physical_revision !== 0 || value.physicalRevision !== 0) fail('empty prefix identity differs');
      } else {
        const prefix = reference(source.prefixReference, 'reserved_pa_work_prefixes');
        if (row.prefix_source_id !== prefix.sourceId) fail('prefix identity differs');
        if (owner === 'reserved_pa_total_assessments') {
          if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', 'prefixReference', 'participantReference', 'effortUnits', 'provenance'])
            || source.capability !== 'reserved_same_pa_cumulative_total_v1' || value.kind !== 'cumulative_total'
            || source.effortUnits !== 0 || value.effortUnits !== 0
            || !fields(source.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
            || !Object.values(source.provenance as Record<string, unknown>).every(id)
            || !source.participantReference || !lineage.participantReferences.some(p => json(p) === json(source.participantReference))
            || row.player_id !== source.participantReference.playerId || row.baseline_source_id !== source.participantReference.baselineSourceId) fail('TOTAL participant identity differs');
          assertSamePaAssessmentOwnership(db,{sourceId:source.sourceId,provenance:source.provenance as {assessmentSourceId:string}});
        } else {
          if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', 'prefixReference', 'participantTotalReferences'])
            || source.capability !== 'reserved_same_pa_cumulative_view_v1' || value.kind !== 'basis_prepared'
            || !Array.isArray(source.participantTotalReferences) || source.participantTotalReferences.length !== 10
            || new Set(source.participantTotalReferences.map(p => p.playerId)).size !== 10
            || source.participantTotalReferences.some(p => !fields(p, ['playerId', 'assessmentReference']) || !lineage!.participantReferences.some(r => r.playerId === p.playerId))
            || row.assessment_set_hash !== hash([...source.participantTotalReferences].sort((a, b) => a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0))) fail('view assessment set differs');
        }
      }
      records.push({ owner, row, source, value, lineage });
    }
  }
  const linked = (raw: unknown, owner: keyof typeof reservedPaSchema, origin: Claim): Claim => {
    const ref = reference(raw, owner), found = records.filter(record => record.owner === owner && record.source.sourceId === ref.sourceId);
    if (found.length !== 1 || found[0].row.source_hash !== ref.sourceHash || found[0].row.snapshot_hash !== ref.snapshotHash
      || json(found[0].lineage) !== json(origin.lineage)) fail('linked owner is missing, foreign or corrupt');
    return found[0];
  };
  for (const record of records) {
    if (record.owner !== 'reserved_pa_work_prefixes') linked(record.source.prefixReference, 'reserved_pa_work_prefixes', record);
    if (record.owner === 'reserved_pa_execution_views') for (const p of record.source.participantTotalReferences!) {
      const total = linked(p.assessmentReference, 'reserved_pa_total_assessments', record);
      if (total.source.participantReference!.playerId !== p.playerId || json(total.source.prefixReference) !== json(record.source.prefixReference)) fail('view TOTAL linkage differs');
    }
  }
  return records;
};
const inspect = (db: Db): Claim[] => {
  try { return claims(db); } catch (error) {
    if (error instanceof Error && /same-PA/.test(error.message)) throw error;
    return fail('owner metadata or dependency is malformed');
  }
};
/** The optional own identity is only for existing dependency read proofs. No
 * fresh workload, charge or causal-work writer supplies this exemption. */
export const assertNoReservedPaPlayerClaim = (db: Db, scope: Readonly<{ careerId: string; playerId: string }>, ownEnrollmentSourceId?: string): void => {
  if (ownEnrollmentSourceId === undefined) assertNoPaDispatchPlayerClaim(db, scope);
  else assertFreshPaDispatchEnrollment(db, ownEnrollmentSourceId);
  if (inspect(db).some(record => record.lineage.enrollmentReference.sourceId !== ownEnrollmentSourceId && record.lineage.careerId === scope.careerId
    && record.lineage.participantReferences.some(p => p.playerId === scope.playerId)
    && !samePaPlayerClaimCanProceed(db, record.lineage.enrollmentReference.sourceId, scope))) fail('blocks new global Player workload');
};
export const assertNoReservedPaWorkClaim = (db: Db, scope: Readonly<{ gameId: string; playId: number; physicalPitchSourceId?: string }>, ownEnrollmentSourceId?: string): void => {
  if (ownEnrollmentSourceId === undefined) assertNoPaDispatchWorkClaim(db, scope);
  else assertFreshPaDispatchEnrollment(db, ownEnrollmentSourceId);
  if (inspect(db).some(record => record.lineage.enrollmentReference.sourceId !== ownEnrollmentSourceId
    && (record.lineage.gameId === scope.gameId && record.lineage.playId === scope.playId
      || scope.physicalPitchSourceId !== undefined && record.lineage.firstPhysicalPitchSourceId === scope.physicalPitchSourceId))) fail('blocks fresh causal work');
};
/** Owner reads inspect surviving links even when the requested Source is absent.
 * Independently accepted prefixes/TOTALs need no not-yet-accepted view or TOTAL. */
export const assertReservedPaClaims = (db: Db): void => { inspect(db); };
/** Complete scoped census, including abandoned prospective prerequisites. */
export const readReservedPaClaimRows = (db: Db, enrollmentSourceId: string) => inspect(db)
  .filter(record => record.lineage.enrollmentReference.sourceId === enrollmentSourceId)
  .map(record => ({ table: record.owner, row: record.row }));
