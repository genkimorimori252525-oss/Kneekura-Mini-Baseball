import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, readPhysicalPlateAppearanceActorFromSqlite, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { paDispatchSchema, assertPaDispatchStorage } from './SamePlateAppearanceDispatchStorage';
import { samePaDispatchSourceInput, assertSamePaDispatchSourceBasis, type SamePaDispatchBase, type AcceptedSamePaFirstPitchAction, type AcceptedSamePaExecutionCalibration } from './SamePlateAppearanceDispatchSource';
import { deriveSamePaDispatchRoles, samePaDispatchPrerequisites, type SamePaDispatchRoleBinding, type SamePaDispatchRoute } from './SamePlateAppearanceDispatchRoles';
import { dispatchRow, dispatchTables, dispatchCapabilities, type DispatchKind, type SamePaDispatchRecord, type SamePaPreparedAction,
  type SamePaPreparedCalibration, type SamePaDispatchPending, type SamePaCalibrationSet, type SamePaPreparedConsumers,
  type SamePaPreparedEpisode, type SamePaPreparedRight } from './SamePlateAppearanceDispatchRecords';
import { proveSamePaExecution, samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { assertFreshPaDispatchEnrollment } from './SamePlateAppearanceDispatchClaimGuard';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaText, samePaFields, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';
import { nominalTable } from './DispatchNominalSqliteOwnership';
import { readPlayerPitchTimingPrefixFromSqlite, selectPlayerPitchTimingProfileFromSqlitePrefix, assertCurrentPlayerPitchTimingPrefixFromSqlite } from './SqlitePlayerPitchTimingStore';
import { readPlayerReleaseGeometryPrefixFromSqlite, assertCurrentPlayerReleaseGeometryPrefixFromSqlite } from './SqlitePlayerReleaseGeometryStore';
import { readPitchFatiguePolicyFromSqlite } from './SqlitePitchFatiguePolicyStore';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { resolvePitcherReleasePosition } from '../../core/sim/pitch/PitcherReleaseGeometry';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';
import { resolveCanonicalPitchDelivery } from '../../core/sim/pitch/CanonicalPitchDelivery';
import { createPitchTrajectoryFromRelease } from '../../core/sim/pitch/CanonicalPitchRelease';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordPitchAgainstBatter } from '../../core/sim/pitching/PitchAgainstBatter';
import { calculateSamePaOriginalConsumerFromSqlite, readSamePaOriginalConsumerIdentityFromSqlite } from './SamePlateAppearanceOriginalConsumerCalculation';
// Invocation inputs are separate from the prepared all-ten model/calibration set.
// These operations and their calculations never leave the private owner API.
type NativeOperation = Readonly<{ calibrationReference: SamePaReference<'pa_dispatch_v1_execution_calibrations'> }> & (
  | Readonly<{ route: 'pitch_delivery'; actionReference: SamePaReference<'pa_dispatch_v1_action_plans'> }>
  | Readonly<{ route: 'defender_observation'; originalReference: SamePaReference<'actual_field_observations'> }>
  | Readonly<{ route: 'defender_decision'; originalReference: SamePaReference<'actual_defensive_decisions'> }>
  | Readonly<{ route: 'defender_locomotion'; originalReference: SamePaReference<'actual_locomotion_receipts'> }>);
type Authority = Readonly<{ readAcceptedAction?(id: string): unknown; readAcceptedCalibration?(id: string): unknown;
  readAcceptedConsumerSet?(id: string): unknown; readAcceptedEpisode?(id: string): unknown; readAcceptedRight?(id: string): unknown }>;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA dispatch frozen dependency or write accounting differs'); };
const pending = (ids: readonly string[] = [], prerequisites: SamePaDispatchPending['prerequisites'] = []): SamePaDispatchPending =>
  freeze({ kind: 'pending', missingAcceptedSourceIds: [...new Set(ids)], prerequisites });
const parsed = (kind: DispatchKind, raw: unknown, id?: string) => {
  const source = samePaDispatchSourceInput(raw, id);
  if (source.capability !== dispatchCapabilities[kind] || !('enrollmentReference' in source)) throw new Error('same-PA dispatch Source owner differs');
  return source;
};
type Source = ReturnType<typeof parsed>;

/** Private Native owner. No connection, callback proof, actor or currentness
 * exemption is accepted from a caller. This stage owns no execution writes. */
const createSqliteSamePlateAppearanceDispatchOwner = (path: string, authority?: Authority) => {
  if (!samePaText(path) || authority && Object.values(authority).some(v => typeof v !== 'function')) throw new Error('invalid same-PA dispatch owner');
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new Native(path);
  let closed = false, failed = false;
  const check = () => { if (closed || failed) throw new Error('same-PA dispatch owner closed or retired'); };
  const counters = () => ({ changes: Number(db.prepare('SELECT total_changes() AS n').get()!.n), main: Number(db.prepare('PRAGMA main.schema_version').get()!.schema_version),
    temp: Number(db.prepare('PRAGMA temp.schema_version').get()!.schema_version), user: Number(db.prepare('PRAGMA main.user_version').get()!.user_version) });
  const setting = () => Number(db.prepare('PRAGMA query_only').get()!.query_only);
  const retire = (error: unknown, cleanup: unknown[] = []): never => { failed = true; try { db.close(); closed = true; } catch (e) { cleanup.push(e); }
    throw new AggregateError([error, ...cleanup], 'same-PA dispatch owner retired after uncertain transaction state; committed effects cannot be rolled back', { cause: error }); };
  const run = <T>(write: boolean, body: (proof: <R>(fn: () => R) => R, step: (fn: () => void, rows: number, schemas?: number) => void) => T, verify?: (value: T) => void): T => {
    check(); if (db.isTransaction) return retire(new Error('same-PA dispatch unowned transaction'));
    const originalSetting = setting(), original = counters(), identity = 'dispatch_' + randomUUID().replaceAll('-', '');
    let expected = { ...original }, acquired = false, identityReady = false, committing = false, uncertain = false;
    const account = () => same(counters(), expected);
    const identityCheck = () => { if (!db.isTransaction || setting() !== originalSetting) throw new Error('same-PA dispatch transaction or setting changed');
      try { db.exec('RELEASE ' + identity); identityReady = false; db.exec('SAVEPOINT ' + identity); identityReady = true; } catch (e) { uncertain = true; throw e; } };
    const proof = <R>(fn: () => R): R => { identityCheck(); account(); db.exec('PRAGMA query_only=1');
      try { const value = withBattedWorldPhysicalReadTraversal(db, fn); if (!db.isTransaction || setting() !== 1) throw new Error('same-PA dispatch proof transaction changed'); account(); return value; }
      finally { db.exec('PRAGMA query_only=' + originalSetting); identityCheck(); account(); } };
    const step = (fn: () => void, rows: number, schemas = 0) => { identityCheck(); account(); fn(); expected = { ...expected, changes: expected.changes + rows, main: expected.main + schemas }; identityCheck(); account(); };
    try {
      db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN'); acquired = true; if (!db.isTransaction) throw new Error('same-PA dispatch acquisition changed');
      db.exec('SAVEPOINT ' + identity); identityReady = true; account(); proof(() => assertPaDispatchStorage(db));
      const value = body(proof, step); proof(() => assertPaDispatchStorage(db)); identityCheck(); account(); db.exec('RELEASE ' + identity); identityReady = false; committing = true; db.exec('COMMIT');
      if (db.isTransaction || setting() !== originalSetting) throw new Error('same-PA dispatch commit changed'); account();
      if (verify) { db.exec('BEGIN'); db.exec('SAVEPOINT ' + identity); identityReady = true; proof(() => verify(value)); identityCheck(); account();
        db.exec('RELEASE ' + identity); identityReady = false; db.exec('COMMIT'); if (db.isTransaction || setting() !== originalSetting) throw new Error('same-PA dispatch durable commit changed'); account(); }
      return value;
    } catch (error) {
      const cleanup: unknown[] = []; uncertain ||= committing;
      try { if (db.isTransaction) { if (identityReady) try { db.exec('ROLLBACK TO ' + identity); } catch (e) { uncertain = true; cleanup.push(e); } else uncertain = true; db.exec('ROLLBACK'); } else if (acquired) uncertain = true; } catch (e) { uncertain = true; cleanup.push(e); }
      try { if (setting() !== originalSetting) { uncertain = true; db.exec('PRAGMA query_only=' + originalSetting); } if (db.isTransaction) throw new Error('same-PA dispatch rollback retained transaction'); } catch (e) { uncertain = true; cleanup.push(e); }
      if (uncertain || cleanup.length) return retire(error, cleanup); throw error;
    }
  };
  const ownedRows = () => assertPaDispatchStorage(db) ? Object.keys(paDispatchSchema).map(t => db.prepare(`SELECT * FROM main.${t} ORDER BY rowid`).all()) : Object.keys(paDispatchSchema).map(() => []);
  const identityRow = (kind: DispatchKind, id: string) => {
    if (!assertPaDispatchStorage(db)) return null;
    const claims = Object.keys(paDispatchSchema).filter(table => table !== 'pa_dispatch_v1_pitch_heads').flatMap(table => db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
      OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id }).map(row => ({ table, row })));
    if (claims.length > 1 || claims.length === 1 && (claims[0].table !== dispatchTables[kind] || claims[0].row.source_id !== id)) throw new Error('same-PA dispatch raw Source identity alias differs');
    return claims[0]?.row ?? null;
  };

  // Every assembly is lexical to one read-only proof. No memo survives a DDL,
  // DML, transaction boundary, committed proof, or subsequent owner operation.
  const assemble = <T>(fresh: boolean, body: (read: (kind: DispatchKind, id: string) => SamePaDispatchRecord | null,
    derive: (kind: DispatchKind, source: Source) => SamePaDispatchRecord | SamePaDispatchPending, roles: (source: Source) => readonly SamePaDispatchRoleBinding[],
    calculate: (operation: NativeOperation) => unknown) => T): T => {
    if (!db.isTransaction || setting() !== 1) throw new Error('dispatch assembly requires a private read-only snapshot');
    type Basis = { actor: DurablePhysicalPlateAppearanceActor; view: SamePaExecutionView; sourceBasis: Pick<SamePaDispatchBase, 'enrollmentReference' | 'viewReference' | 'firstPhysicalPitchSourceId'> & { gameDay: number }; roles: readonly SamePaDispatchRoleBinding[] };
    const before = counters(), bases = new Map<string, Basis>(), values = new Map<string, SamePaDispatchRecord>();
    const assertActive = () => { if (!db.isTransaction || setting() !== 1) throw new Error('dispatch assembly expired'); same(counters(), before); };
    const basis = (source: SamePaDispatchBase): Basis => {
      assertActive(); const key = json(source.viewReference), prior = bases.get(key); if (prior) { assertSamePaDispatchSourceBasis(source, prior.sourceBasis); return prior; }
      const view = fresh ? proveSamePaExecution(db, { kind: 'view', sourceId: source.viewReference.sourceId }) as SamePaExecutionView | null
        : readHistoricalSamePaExecutionView(db, source.viewReference).view;
      if (!view || view.kind !== 'basis_prepared') throw new Error('same-PA dispatch original view missing'); same(reference('reserved_pa_execution_views', view), source.viewReference);
      const actor = readPhysicalPlateAppearanceActorFromSqlite(db, view.lineage.actorReference.sourceId); if (!actor) throw new Error('same-PA dispatch original actor missing');
      same(reference('physical_plate_appearance_actors', actor), view.lineage.actorReference);
      const sourceBasis = { enrollmentReference: view.lineage.enrollmentReference, viewReference: source.viewReference,
        firstPhysicalPitchSourceId: view.lineage.firstPhysicalPitchSourceId, gameDay: actor.binding.gameDay };
      assertSamePaDispatchSourceBasis(source, sourceBasis); const value = { actor, view, sourceBasis, roles: deriveSamePaDispatchRoles(actor, view) };
      if (fresh) assertFreshPaDispatchEnrollment(db, source.enrollmentReference.sourceId); bases.set(key, value); return value;
    };
    const batting = (ref: SamePaReference<'world_player_batting_models'>, source: SamePaDispatchBase) => {
      const b = basis(source); nominalTable(db, ref.owner); const owner = playerBattingModelEvidenceFromSqlite(db), model = owner.read(ref.sourceId);
      if (!model) throw new Error('same-PA dispatch original batting model missing'); same(reference(ref.owner, model), ref);
      const binding = b.actor.binding;
      if (model.source.careerId !== binding.careerId || model.source.playerId !== binding.playerId || model.source.personId !== binding.personId
        || model.source.personLinkSourceId !== binding.personLinkSourceId || model.source.acceptedAtDay > binding.gameDay
        || model.bodyMaterialization.source.role !== 'batter') throw new Error('same-PA dispatch batting model actor/body scope differs');
      same(model.person, b.actor.person); same(model.bodyMaterialization.person, b.actor.person);
      if (fresh) same(owner.selectAtDay(binding.careerId, binding.playerId, binding.gameDay), model); return model;
    };
    const pitcherPerson = (table: 'world_pitch_timing_baselines' | 'world_player_release_baselines', source: Source, playerId: string) => {
      const b = basis(source), original = b.actor.defenderPersons.find(p => p.playerId === playerId);
      nominalTable(db, table);
      const rows = db.prepare(`SELECT source_json FROM main.${table} WHERE (career_id=$career OR ${claim('source_json', ['careerId'], '$career')})
        AND (player_id=$player OR ${claim('source_json', ['playerId'], '$player')})`).all({ career: b.view.lineage.careerId, player: playerId });
      if (rows.length !== 1 || !original) throw new Error('dispatch nominal pitcher Person baseline differs');
      // The immediately preceding prefix replay authenticated these Source
      // bytes on this query-only connection; Person identity still needs its
      // explicit composition equality with the original actor.
      const baseline = JSON.parse(String(rows[0].source_json)), person = playerPersonLinkEvidenceFromSqlite(db).readLink(baseline.personLinkSourceId);
      if (!person || person.careerId !== original.careerId || person.playerId !== original.playerId
        || person.personId !== original.personId || person.sourceId !== original.sourceId) throw new Error('dispatch nominal pitcher original Person identity differs');
    };
    const canonical = (kind: DispatchKind, source: Source) => {
      if (!assertPaDispatchStorage(db)) return;
      const table = dispatchTables[kind]; let row;
      if (source.capability === 'same_pa_execution_calibration_v1') row = db.prepare(`SELECT source_id FROM main.${table} WHERE view_source_id=? AND player_id=? AND route=? AND nominal_parameter_identity=?`)
        .get(source.viewReference.sourceId, source.member.playerId, source.route, json(source.nominalParameterReference ?? source.nominalReference));
      else row = db.prepare(`SELECT source_id FROM main.${table} WHERE enrollment_source_id=? AND ${kind === 'consumer' ? 'view_source_id' : 'first_pitch_source_id'}=?`)
        .get(source.enrollmentReference.sourceId, kind === 'consumer' ? source.viewReference.sourceId : source.firstPhysicalPitchSourceId);
      if (row && row.source_id !== source.sourceId) throw new Error('same-PA dispatch canonical Source alias rejected');
    };
    const linked = (kind: DispatchKind, ref: SamePaReference, source: Source) => {
      const value = read(kind, ref.sourceId); if (!value) return null; same(reference(dispatchTables[kind], value), ref);
      assertSamePaDispatchSourceBasis(value.source, basis(source).sourceBasis); return value;
    };
    const authenticateActionInputs = (source: AcceptedSamePaFirstPitchAction) => {
      assertActive(); const b = basis(source), lineage = b.view.lineage, roles = b.roles;
      const pitcher = roles.find(r => r.role === 'P')!;
      if (source.pitcherPlayerId !== pitcher.member.playerId || source.batterPlayerId !== b.actor.binding.playerId
        || source.nominalPitch.delivery.readyAtUs < b.actor.world.tick) throw new Error('same-PA dispatch action original actors or chronology differ');
      const timing = readPlayerPitchTimingPrefixFromSqlite(db, source.timingReference), release = readPlayerReleaseGeometryPrefixFromSqlite(db, source.releaseReference), policy = readPitchFatiguePolicyFromSqlite(db, source.pitchResponseReference);
      pitcherPerson('world_pitch_timing_baselines', source, pitcher.member.playerId); pitcherPerson('world_player_release_baselines', source, pitcher.member.playerId);
      if ([timing, release].some(v => v.careerId !== lineage.careerId || v.playerId !== pitcher.member.playerId) || policy.availableAtDay > b.actor.binding.gameDay) throw new Error('same-PA dispatch delivery original Player or day differs');
      const timingProfile = selectPlayerPitchTimingProfileFromSqlitePrefix(db, source.timingReference, b.actor.binding.gameDay);
      if (fresh) { assertCurrentPlayerPitchTimingPrefixFromSqlite(db, source.timingReference, b.actor.binding.gameDay); assertCurrentPlayerReleaseGeometryPrefixFromSqlite(db, source.releaseReference, b.actor.binding.gameDay); }
      const geometry = release.changes.filter(c => c.effectiveDay <= b.actor.binding.gameDay).at(-1) ?? release.baseline;
      if (geometry.effectiveDay > b.actor.binding.gameDay) throw new Error('same-PA dispatch release geometry is future');
      resolvePitcherReleasePosition({ ...geometry.body, moundReference: source.nominalPitch.delivery.moundReference }, geometry.profile);
      const model = batting(source.batterModelReference, source);
      if (model.equipment.values.ball.radiusM !== source.nominalPitch.batter.ballRadiusMeters
        || model.observationCalibration.values.calibration.memoryDecayParameters.ticksPerSecond !== 1_000_000
        || model.predictionCalibration.values.parameters.ticksPerSecond !== 1_000_000) throw new Error('same-PA dispatch TAKE equipment or actor clock differs');
      assertActive();
      return { source, basis: b, pitcher, timing, timingProfile, release, geometry, policy, model };
    };
    // Keep actual typed owner values separate from their stable record projection.
    // These values never leave this assembly or become a caller-owned proof.
    const authenticateCalibrationInputs = (source: AcceptedSamePaExecutionCalibration) => {
      assertActive(); const b = basis(source), role = b.roles.find(r => r.member.playerId === source.member.playerId);
      if (!role || !role.routes.includes(source.route)) throw new Error('same-PA dispatch calibration original role differs'); same(source.member, role.member);
      const player = [b.actor.binding, ...b.actor.defenderBindings].find(p => p.playerId === source.member.playerId)!;
      const person = [b.actor.person, ...b.actor.defenderPersons].find(p => p.playerId === source.member.playerId)!;
      const participant = b.view.participants.find(p => p.playerId === source.member.playerId)!;
      const common = { basis: b, role, player, person, member: role.member,
        reservedState: participant.reservedState, projectedState: participant.projectedState };
      const authenticated = <T extends { route: SamePaDispatchRoute; nominal: unknown }>(input: T) => {
        for (const table of ['pa_dispatch_v1_execution_calibrations', 'reserved_pa_total_assessments', 'actual_role_workload_assessments']) {
          if (!db.prepare('SELECT 1 FROM main.sqlite_master WHERE name=?').get(table)) continue;
          const rows = db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
            OR ${claim('source_json', ['provenance', 'assessmentSourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'provenance', 'assessmentSourceId'], '$id')}`).all({ id: source.provenance.assessmentSourceId });
          if (rows.some(row => table !== dispatchTables.calibration || row.source_id !== source.sourceId)) throw new Error('dispatch calibration assessment provenance ownership differs');
        }
        assertActive(); return { kind: 'authenticated_calibration' as const, ...common, ...input };
      };
      if (source.route === 'pitch_delivery') {
        const timing = readPlayerPitchTimingPrefixFromSqlite(db, source.nominalReference), policy = readPitchFatiguePolicyFromSqlite(db, source.response.policyReference);
        pitcherPerson('world_pitch_timing_baselines', source, source.member.playerId);
        if (timing.careerId !== player.careerId || timing.playerId !== player.playerId || policy.availableAtDay > player.gameDay) throw new Error('dispatch calibration pitcher scope differs');
        const timingProfile = selectPlayerPitchTimingProfileFromSqlitePrefix(db, source.nominalReference, player.gameDay);
        if (fresh) assertCurrentPlayerPitchTimingPrefixFromSqlite(db, source.nominalReference, player.gameDay);
        const actionRow = assertPaDispatchStorage(db) ? db.prepare('SELECT source_id FROM main.pa_dispatch_v1_action_plans WHERE enrollment_source_id=? AND first_pitch_source_id=?').get(source.enrollmentReference.sourceId, source.firstPhysicalPitchSourceId) : null;
        if (!actionRow) return pending([], [{ playerId: source.member.playerId, route: 'pitch_delivery', reason: 'missing_action_plan' }]);
        const action = read('action', String(actionRow.source_id)) as SamePaPreparedAction;
        same(action.source.timingReference, source.nominalReference); same(action.source.pitchResponseReference, source.response.policyReference);
        return authenticated({ route: source.route, source, nominal: timing, timingProfile, effective: policy });
      }
      if (source.nominalParameterReference) {
        const model = batting(source.nominalReference, source), pin = source.nominalParameterReference, parameter = model[pin.parameterKey];
        same({ parameterKey: pin.parameterKey, sourceId: parameter.sourceId, sourceVersion: parameter.sourceVersion, sourceHash: hash(parameter) }, pin);
        switch (source.route) {
          case 'batter_observation': return authenticated({ route: source.route, source, model, nominal: model.observationCalibration, effective: source.response.values });
          case 'batter_decision': return authenticated({ route: source.route, source, model, nominal: model.decisionModel, effective: source.response.values });
          case 'batter_motor': return authenticated({ route: source.route, source, model, nominal: model.capability, effective: source.response.values });
          case 'batter_swing': return authenticated({ route: source.route, source, model, nominal: model.repertoire, effective: source.response.values });
        }
      }
      const ref = source.nominalReference; nominalTable(db, ref.owner);
      const original = <M extends NonNullable<ReturnType<ReturnType<typeof playerObservationModelEvidenceFromSqlite>['read']>>
        | NonNullable<ReturnType<ReturnType<typeof playerDecisionModelEvidenceFromSqlite>['read']>>
        | NonNullable<ReturnType<ReturnType<typeof playerLocomotionModelEvidenceFromSqlite>['read']>>>(owner: {
          read(id: string): M | null; selectAtDay(career: string, player: string, day: number): M;
        }): M => {
        const model = owner.read(ref.sourceId); if (!model) throw new Error('dispatch calibration original nominal model missing'); same(reference(ref.owner, model), ref);
        if (model.source.careerId !== player.careerId || model.source.playerId !== player.playerId || model.source.personLinkSourceId !== player.personLinkSourceId
          || model.source.acceptedAtDay > player.gameDay) throw new Error('dispatch calibration nominal Player or day differs');
        same(model.fieldingModel.person, person); if (fresh) same(owner.selectAtDay(player.careerId, player.playerId, player.gameDay), model); return model;
      };
      switch (source.route) {
        case 'defender_observation': return authenticated({ route: source.route, source, nominal: original(playerObservationModelEvidenceFromSqlite(db)), effective: source.response.values });
        case 'defender_decision': return authenticated({ route: source.route, source, nominal: original(playerDecisionModelEvidenceFromSqlite(db)), effective: source.response.values });
        case 'defender_locomotion': return authenticated({ route: source.route, source, nominal: original(playerLocomotionModelEvidenceFromSqlite(db)), effective: source.response.values });
      }
      throw new Error('dispatch calibration route differs');
    };
    const calibrationRecord = (input: Exclude<ReturnType<typeof authenticateCalibrationInputs>, SamePaDispatchPending>): SamePaPreparedCalibration =>
      freeze({ kind: 'execution_calibration_prepared', source: input.source, lineage: input.basis.view.lineage, role: input.role.role,
        nominalInputHash: hash(input.nominal), effectiveResponseHash: hash(input.source.response) });
    // Deriving a prospective calibration is never evidence that its accepted row
    // exists. Actual use independently authenticates the entire stored row here.
    const acceptedCalibrationInputs = (ref: SamePaReference<'pa_dispatch_v1_execution_calibrations'>) => {
      assertActive();
      if (!samePaReferenceValid(ref, 'pa_dispatch_v1_execution_calibrations')) throw new Error('invalid Native calibration reference');
      const row = identityRow('calibration', ref.sourceId); if (!row) throw new Error('Native invocation requires an accepted calibration row');
      const source = parsed('calibration', JSON.parse(String(row.source_json)), ref.sourceId);
      if (source.capability !== 'same_pa_execution_calibration_v1') throw new Error('Native calibration owner differs');
      canonical('calibration', source);
      const input = authenticateCalibrationInputs(source); if (input.kind === 'pending') throw new Error('Native accepted calibration is incomplete');
      const record = calibrationRecord(input); same(row, dispatchRow(record)); same(reference('pa_dispatch_v1_execution_calibrations', record), ref);
      assertActive(); return input;
    };
    const derive = (kind: DispatchKind, source: Source): SamePaDispatchRecord | SamePaDispatchPending => {
      assertActive(); canonical(kind, source); const b = basis(source), lineage = b.view.lineage, roles = b.roles;
      if (source.capability === 'same_pa_first_pitch_action_v1') {
        const input = authenticateActionInputs(source);
        return freeze({ kind: 'action_prepared', source, lineage, roles, timingProfileHash: hash(input.timingProfile), releaseGeometryHash: hash(input.geometry),
          bodyMaterializationHash: hash(input.model.bodyMaterialization), equipmentHash: hash(input.model.equipment) });
      }
      if (source.capability === 'same_pa_execution_calibration_v1') {
        const input = authenticateCalibrationInputs(source); if (input.kind === 'pending') return input;
        return calibrationRecord(input);
      }
      const missing: string[] = [], prerequisites: SamePaDispatchPending['prerequisites'][number][] = [];
      if (!linked('action', source.actionReference, source)) missing.push(source.actionReference.sourceId);
      if (source.capability === 'same_pa_consumer_set_v1') {
        prerequisites.push(...samePaDispatchPrerequisites(b.actor, b.view, source.participantInputs));
        for (const input of source.participantInputs) for (const ref of input.calibrationReferences) {
          const value = linked('calibration', ref.calibrationReference, source) as SamePaPreparedCalibration | null;
          if (!value) { missing.push(ref.calibrationReference.sourceId); prerequisites.push({ playerId: input.member.playerId, route: ref.route, reason: 'missing_accepted_calibration' }); }
          else { same(value.source.member, input.member); same(value.source.route, ref.route); }
        }
        if (missing.length || prerequisites.length) return pending(missing, prerequisites);
        return freeze({ kind: 'consumer_set_prepared', source, lineage, roles });
      }
      if (!linked('consumer', source.consumerSetReference, source)) missing.push(source.consumerSetReference.sourceId);
      prerequisites.push(...samePaDispatchPrerequisites(b.actor, b.view, roles.map(role => ({ member: role.member, calibrationReferences: [] }))).filter(p => p.reason === 'unsupported_core_adapter'));
      if (source.capability === 'same_pa_first_pitch_right_v1') {
        same(source.prefixReference, b.view.source.prefixReference);
        if (!linked('episode', source.episodeReference, source)) missing.push(source.episodeReference.sourceId);
        if (missing.length || prerequisites.length) return pending(missing, prerequisites);
        return freeze({ kind: 'immutable_right_prepared', source, lineage, roles, expectedProgressRevision: 0 });
      }
      if (missing.length || prerequisites.length) return pending(missing, prerequisites);
      return freeze({ kind: 'prospective_episode_prepared', source, lineage, roles });
    };
    const read = (kind: DispatchKind, id: string): SamePaDispatchRecord | null => {
      assertActive(); const key = kind + ':' + id, cached = values.get(key); if (cached) return cached;
      const row = identityRow(kind, id); if (!row) return null;
      const source = parsed(kind, JSON.parse(String(row.source_json)), id), value = derive(kind, source);
      if (value.kind === 'pending') throw new Error('same-PA dispatch saved prerequisite is unsupported or incomplete'); same(row, dispatchRow(value)); values.set(key, value); return value;
    };
    // Calculation composition only; no existing preparation operation calls this
    // path. A future owned append must first close its all-adapter/current-cut and
    // atomic replay gates. The narrow read-only seam grants no execution authority
    // and does not promote support.
    const calculateNative = (rawOperation: NativeOperation) => {
      assertActive(); const operation = cloneInert(rawOperation);
      if (!samePaFields(operation, ['route', 'calibrationReference', operation?.route === 'pitch_delivery' ? 'actionReference' : 'originalReference'])) {
        throw new Error('invalid Native consumer operation fields');
      }
      const input = acceptedCalibrationInputs(operation.calibrationReference);
      if (input.route !== operation.route) throw new Error('Native consumer calibration route differs');
      if (operation.route === 'pitch_delivery' && input.route === 'pitch_delivery') {
        if (!samePaReferenceValid(operation.actionReference, 'pa_dispatch_v1_action_plans')) throw new Error('invalid Native action reference');
        const action = read('action', operation.actionReference.sourceId);
        if (!action || action.kind !== 'action_prepared') throw new Error('Native pitch action missing');
        same(reference('pa_dispatch_v1_action_plans', action), operation.actionReference);
        const original = authenticateActionInputs(action.source), actor = original.basis.actor, source = original.source;
        assertSamePaDispatchSourceBasis(source, input.basis.sourceBasis); same(source.timingReference, input.source.nominalReference);
        same(source.pitchResponseReference, input.source.response.policyReference); same(original.policy, input.effective);
        same(original.pitcher.member, input.member); same(original.timing, input.nominal); same(original.timingProfile, input.timingProfile);
        const { sourceId: _sourceId, sourceVersion: _sourceVersion, ...response } = input.effective;
        const effective = applyPitchFatigueToExecution(original.timingProfile, source.nominalPitch.delivery.physics,
          input.projectedState.fatigue, response, input.player.gameDay);
        const timeline = createCanonicalPlateAppearanceTimeline(actor.match, actor.world.tick), nominal = source.nominalPitch;
        const delivery = resolveCanonicalPitchDelivery({ root: new SeedRoot(nominal.delivery.matchSeed), outingId: nominal.delivery.outingId,
          playId: actor.match.playId, pitchIndex: 0, readyAtUs: nominal.delivery.readyAtUs, timingIntent: nominal.delivery.timingIntent,
          timingProfile: effective.timingProfile, body: { ...original.geometry.body, moundReference: nominal.delivery.moundReference },
          releaseProfile: original.geometry.profile, physics: effective.physics });
        const trajectory = createPitchTrajectoryFromRelease(delivery.release, nominal.flight.acceleration, delivery.release.releaseAtUs + nominal.flight.durationUs);
        const resolution = resolveAndRecordPitchAgainstBatter(timeline, { ...nominal.batter, trajectory });
        if (resolution.kind !== 'recorded') throw new Error('Native same-PA TAKE calculation is unresolved');
        assertActive();
        return freeze({ kind: 'native_calculation_only' as const, route: operation.route, operation,
          frame: { kind: 'reserved_same_pa_pitch_frame_v1' as const, actorReference: input.basis.view.lineage.actorReference,
            viewReference: input.source.viewReference, member: input.member, binding: input.player, person: input.person,
            reservedActualState: input.reservedState, projectedExecutionState: input.projectedState,
            nominalTiming: original.timingProfile, nominalRelease: original.geometry, nominalBattingModel: original.model,
            acceptedPitchResponse: input.effective }, beforeTimeline: timeline, calculation: { delivery, trajectory, resolution } });
      }
      // The only presently implemented view covers the pre-pitch empty prefix.
      // A later original field operation cannot turn that cut into fresh coverage.
      // Historical reconstruction below is not permission to execute it now.
      if (fresh) throw new Error('Native defender invocation requires supported nonempty current-view coverage');
      if (operation.route === 'pitch_delivery') throw new Error('Native pitcher calibration route differs');
      const originalIdentity = readSamePaOriginalConsumerIdentityFromSqlite(db, operation.route === 'defender_observation'
        ? { route: operation.route, originalReference: operation.originalReference }
        : operation.route === 'defender_decision' ? { route: operation.route, originalReference: operation.originalReference }
          : { route: operation.route, originalReference: operation.originalReference });
      if (originalIdentity.original.source.playerId !== input.member.playerId
        || originalIdentity.original.source.physicalPitchSourceId !== input.source.firstPhysicalPitchSourceId) throw new Error('Native original operation member or pitch differs');
      same(originalIdentity.nominal, input.nominal); assertActive();
      const result = operation.route === 'defender_observation' && input.route === 'defender_observation'
        ? calculateSamePaOriginalConsumerFromSqlite(db, { route: operation.route, originalReference: operation.originalReference, effectiveCalibration: input.effective })
        : operation.route === 'defender_decision' && input.route === 'defender_decision'
          ? calculateSamePaOriginalConsumerFromSqlite(db, { route: operation.route, originalReference: operation.originalReference, effectiveCalibration: input.effective })
          : operation.route === 'defender_locomotion' && input.route === 'defender_locomotion'
            ? calculateSamePaOriginalConsumerFromSqlite(db, { route: operation.route, originalReference: operation.originalReference, effectiveCalibration: input.effective })
            : null;
      if (!result) throw new Error('unsupported Native consumer operation');
      if (result.original.source.playerId !== input.member.playerId
        || result.original.source.physicalPitchSourceId !== input.source.firstPhysicalPitchSourceId) throw new Error('Native original operation member or pitch differs');
      same(result.original, originalIdentity.original); same(result.nominal, input.nominal); assertActive();
      return freeze({ kind: 'historical_original_calculation_only' as const, route: result.route, operation,
        viewReference: input.source.viewReference, member: input.member, reservedActualState: input.reservedState,
        projectedExecutionState: input.projectedState, original: result.original, nominal: result.nominal, calculation: result.calculation });
    };
    try { const value = body(read, derive, source => basis(source).roles, calculateNative); assertActive(); return value; } finally { bases.clear(); values.clear(); }
  };
  const read = (kind: DispatchKind, id: string) => { check(); if (!samePaText(id)) throw new Error('invalid dispatch Source identity');
    return run(false, proof => proof(() => assemble(false, read => read(kind, id)))); };
  const accept = (kind: Exclude<DispatchKind, 'calibration'>, id: string): SamePaDispatchRecord | SamePaDispatchPending => {
    check(); if (!samePaText(id)) throw new Error('invalid dispatch Source identity');
    const reader = kind === 'action' ? authority?.readAcceptedAction : kind === 'consumer' ? authority?.readAcceptedConsumerSet : kind === 'episode' ? authority?.readAcceptedEpisode : authority?.readAcceptedRight;
    const raw = reader?.(id) ?? null, source = raw === null ? null : parsed(kind, raw, id), prior = read(kind, id);
    if (prior) { if (source) same(source, prior.source); return prior; } if (!source) return pending([id]);
    const preflight = run(false, proof => proof(() => ({ value: assemble(true, (_read, derive) => derive(kind, source)), rows: ownedRows() })));
    if (preflight.value.kind === 'pending') return preflight.value;
    const table = dispatchTables[kind], row = dispatchRow(preflight.value), expectedRows = preflight.rows.map(rows => [...rows]); expectedRows[Object.keys(paDispatchSchema).indexOf(table)].push(row);
    return run(true, (proof, step) => {
      same(proof(() => ({ value: assemble(true, (_read, derive) => derive(kind, source)), rows: ownedRows() })), preflight);
      if (!assertPaDispatchStorage(db)) { if (kind !== 'action') throw new Error('dispatch action namespace prerequisite missing'); for (const sql of Object.values(paDispatchSchema)) step(() => db.exec(sql), 0, 1);
        same(proof(() => assemble(true, (_read, derive) => derive(kind, source))), preflight.value); }
      step(() => { const changed = db.prepare(`INSERT INTO main.${table} VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row)); if (changed.changes !== 1) throw new Error('dispatch exact action row delta differs'); }, 1);
      proof(() => { same(assemble(true, read => read(kind, id)), preflight.value); same(ownedRows(), expectedRows); }); return preflight.value as SamePaDispatchRecord;
    }, value => { same(assemble(true, read => read(kind, id)), value); same(ownedRows(), expectedRows); });
  };
  const setIds = (ids: readonly string[]) => { if (!Array.isArray(ids) || ids.length !== 32 || ids.some(id => !samePaText(id)) || new Set(ids).size !== 32) throw new Error('dispatch calibration operation requires exact32 distinct Sources'); return [...ids]; };
  const setProof = (sources: readonly AcceptedSamePaExecutionCalibration[], fresh: boolean) => assemble(fresh, (read, derive, originalRoles) => {
    const roles = originalRoles(sources[0]);
    same(sources.map(s => [s.member.playerId, s.route]), roles.flatMap(role => role.routes.map(route => [role.member.playerId, route])));
    if (new Set(sources.map(s => s.provenance.assessmentSourceId)).size !== 32) throw new Error('dispatch calibration assessment provenance is duplicated');
    const values = sources.map(source => derive('calibration', source)), awaiting = values.filter((v): v is SamePaDispatchPending => v.kind === 'pending');
    if (awaiting.length) {
      if (sources.some(s => identityRow('calibration', s.sourceId))) throw new Error('dispatch saved calibration dependency is missing');
      return { value: pending(awaiting.flatMap(v => v.missingAcceptedSourceIds), awaiting.flatMap(v => v.prerequisites)), present: false };
    }
    const calibrations = values as SamePaPreparedCalibration[], first = calibrations[0];
    for (const s of sources) same({ enrollmentReference: s.enrollmentReference, viewReference: s.viewReference, firstPhysicalPitchSourceId: s.firstPhysicalPitchSourceId },
      { enrollmentReference: first.source.enrollmentReference, viewReference: first.source.viewReference, firstPhysicalPitchSourceId: first.source.firstPhysicalPitchSourceId });
    const present = calibrations.map(v => read('calibration', v.source.sourceId));
    if (present.some(Boolean) && present.some(v => !v)) throw new Error('dispatch calibration set has mixed existing rows; partial set cannot be repaired');
    present.forEach((v, i) => { if (v) same(v, calibrations[i]); });
    return { value: freeze({ kind: 'execution_calibration_set' as const, calibrations, calibrationReferences: calibrations.map(v => reference('pa_dispatch_v1_execution_calibrations', v)) }), present: present.every(Boolean) };
  });
  const acceptCalibrationSet = (rawIds: readonly string[]): SamePaCalibrationSet | SamePaDispatchPending => {
    check(); const ids = setIds(rawIds), missing: string[] = [], sources: AcceptedSamePaExecutionCalibration[] = [];
    for (const id of ids) { const raw = authority?.readAcceptedCalibration?.(id) ?? null; if (raw === null) missing.push(id); else sources.push(parsed('calibration', raw, id) as AcceptedSamePaExecutionCalibration); }
    if (missing.length) {
      const saved = run(false, proof => proof(() => assemble(false, read => ids.map(id => read('calibration', id)))));
      if (saved.some(Boolean) && saved.some(v => !v)) throw new Error('dispatch calibration set has mixed existing rows; partial set cannot be repaired');
      if (saved.every(Boolean)) {
        for (const supplied of sources) same(supplied, saved.find(v => v!.source.sourceId === supplied.sourceId)!.source);
        sources.splice(0, sources.length, ...saved.map(v => v!.source as AcceptedSamePaExecutionCalibration)); return run(false, proof => proof(() => setProof(sources, false).value));
      }
      return pending(missing);
    }
    const historical = run(false, proof => proof(() => ids.map(id => identityRow('calibration', id))));
    if (historical.some(Boolean) && historical.some(v => !v)) throw new Error('dispatch calibration set has mixed existing rows; partial set cannot be repaired');
    const preflight = run(false, proof => proof(() => ({ ...setProof(sources, !historical.every(Boolean)), rows: ownedRows() })));
    if (preflight.present || preflight.value.kind === 'pending') return preflight.value;
    const table = dispatchTables.calibration, rows = preflight.value.calibrations.map(dispatchRow), expectedRows = preflight.rows.map(values => [...values]); expectedRows[Object.keys(paDispatchSchema).indexOf(table)].push(...rows);
    return run(true, (proof, step) => {
      same(proof(() => ({ ...setProof(sources, true), rows: ownedRows() })), preflight);
      // One parameter-bound atomic DML boundary: all32 or no accepted set.
      step(() => { const result = db.prepare(`INSERT INTO main.${table} VALUES ${rows.map(row => '(' + Object.keys(row).map(() => '?').join(',') + ')').join(',')}`).run(...rows.flatMap(Object.values));
        if (result.changes !== 32) throw new Error('dispatch calibration exact32 row delta differs'); }, 32);
      proof(() => { const saved = setProof(sources, true); if (!saved.present) throw new Error('dispatch calibration accepted set missing'); same(saved.value, preflight.value); same(ownedRows(), expectedRows); }); return preflight.value;
    }, value => { const saved = setProof(sources, true); if (!saved.present) throw new Error('dispatch calibration durable set missing'); same(saved.value, value); same(ownedRows(), expectedRows); });
  };
  const store = Object.freeze({ acceptAction: (id: string) => accept('action', id) as SamePaPreparedAction | SamePaDispatchPending,
    readAction: (id: string) => read('action', id) as SamePaPreparedAction | null, acceptCalibrationSet,
    readCalibrationSet: (ids: readonly string[]) => { check(); const values = setIds(ids); return run(false, proof => proof(() => {
      const sources = assemble(false, read => values.map(id => { const v = read('calibration', id); if (!v) throw new Error('dispatch calibration required Source missing'); return v.source as AcceptedSamePaExecutionCalibration; }));
      const value = setProof(sources, false).value; if (value.kind === 'pending') throw new Error('dispatch calibration saved set is incomplete'); return value; })); },
    acceptConsumerSet: (id: string) => accept('consumer', id) as SamePaPreparedConsumers | SamePaDispatchPending,
    readConsumerSet: (id: string) => read('consumer', id) as SamePaPreparedConsumers | null,
    acceptEpisode: (id: string) => accept('episode', id) as SamePaPreparedEpisode | SamePaDispatchPending,
    readEpisode: (id: string) => read('episode', id) as SamePaPreparedEpisode | null,
    acceptRight: (id: string) => accept('right', id) as SamePaPreparedRight | SamePaDispatchPending,
    readRight: (id: string) => read('right', id) as SamePaPreparedRight | null,
    close() { if (!closed) { db.close(); closed = true; } } });
  const calculateFirstPitch = (raw: SamePaFirstPitchCalculationRequest) => {
    check(); const request = cloneInert(raw);
    if (!samePaFields(request, ['actionReference', 'calibrationReference'])
      || !samePaReferenceValid(request.actionReference, 'pa_dispatch_v1_action_plans')
      || !samePaReferenceValid(request.calibrationReference, 'pa_dispatch_v1_execution_calibrations')) throw new Error('invalid private pitch calculation input fields');
    return run(false, proof => proof(() => assemble(true, (_read, _derive, _roles, calculate) =>
      calculate({ route: 'pitch_delivery', actionReference: request.actionReference, calibrationReference: request.calibrationReference }))));
  };
  return { store, calculateFirstPitch };
};

export const openSqliteSamePlateAppearanceDispatchStore = (path: string, authority?: Authority) =>
  createSqliteSamePlateAppearanceDispatchOwner(path, authority).store;
export type SamePaFirstPitchCalculationRequest = Readonly<{
  actionReference: SamePaReference<'pa_dispatch_v1_action_plans'>;
  calibrationReference: SamePaReference<'pa_dispatch_v1_execution_calibrations'>;
}>;
/** Internal read-only calculation seam. It owns a fresh private Native proof,
 * accepts only already stored exact references, and returns no admission right.
 * It neither appends physical/consumer rows nor promotes public route support. */
export const readSamePaFirstPitchCalculation = (path: string, request: SamePaFirstPitchCalculationRequest) => {
  const owner = createSqliteSamePlateAppearanceDispatchOwner(path);
  try { return owner.calculateFirstPitch(request); } finally { owner.store.close(); }
};
