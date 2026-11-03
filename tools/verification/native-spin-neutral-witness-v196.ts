import assert from 'node:assert/strict';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { actorHash as hash, actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot, battedVenueLegalPolicyEvidenceFromSqlite } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite, readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { battedWorldFieldCalibrationEvidenceFromSqlite } from '../../src/host/world/BattedWorldFieldCalibrationEvidenceFromSqlite';
import { battedWorldContactEvidenceFromSqlite } from '../../src/host/world/SqliteBattedWorldContactStore';
import { battedContactResponseEvidenceFromSqlite } from '../../src/host/world/SqliteBattedContactResponseStore';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from '../../src/host/world/SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { deriveSamePaVenueLegalCoverageFromPair } from '../../src/host/world/SamePlateAppearanceVenueLegalCoverage';
import { readSamePaLiveBallHistoryFromSqlite } from '../../src/host/world/SamePlateAppearanceLiveBallStateFromSqlite';
import { samePaLiveBallStateTable } from '../../src/host/world/SamePlateAppearanceLiveBallStateSource';
import { readSamePaCatchWorkFromSqlite } from '../../src/host/world/SamePlateAppearanceCatchWorkFromSqlite';
import { samePaOfficialSourceReference } from '../../src/host/world/SamePlateAppearanceCatchCommunicationSource';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';

type Input = Readonly<{ viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>; actorReference: SamePaReference<'physical_plate_appearance_actors'>;
  resolutionReference: SamePaReference<'pa_physical_v1_resolutions'>; launchReference: SamePaReference<'pa_physical_v1_launches'>;
  postureReference: SamePaReference<'batting_observation_v1_postures'> }>;
type RowLocator = Readonly<{ owner: string; sourceId: string; rowid: string }>;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V196 original scoped witness differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V196 original witness missing'); return value; };
const missing = (reason: string, nextOwner: string | null = null) => ({ status: 'UNAVAILABLE' as const, reason, nextOwner });

/** Explicit current-pitch inventory only. Raw metadata finds bounded locators;
 * only existing normal readers authenticate witness values. No Source is authored. */
export function readNativeSpinNeutralWitnessInventoryV196(db: DatabaseSync, input: Input, emit: (name: string, value?: unknown) => void) {
  return withBattedVenueLegalReadSnapshot(db, () => {
    const visited: RowLocator[] = [];
    const namespace = (owner: string) => {
      const rows = db.prepare('SELECT name,type FROM main.sqlite_master WHERE lower(name)=lower(?)').all(owner);
      if (!rows.length) return { available: false as const, reason: 'NAMESPACE_ABSENT' };
      if (rows.length !== 1 || rows[0].name !== owner || rows[0].type !== 'table') return { available: false as const, reason: 'NAMESPACE_NOT_ITS_ORIGINAL_TABLE' };
      return { available: true as const, reason: null };
    };
    const visit = (owner: string, sourceId: string) => {
      const query = db.prepare(`SELECT rowid native_rowid FROM main.${owner} WHERE source_id=?`); query.setReadBigInts(true);
      const row = must(query.get(sourceId)); const found = { owner, sourceId, rowid: String(row.native_rowid) };
      if (!visited.some(v => v.owner === owner && v.sourceId === sourceId)) visited.push(found);
    };
    const fullref = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
      visit(owner, sourceId);
      const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main.${owner} WHERE source_id=?`).get(sourceId));
      return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
    };
    const anchor = withSamePaLifecycleReadPhase(db, () => {
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.viewReference);
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, input.actorReference.sourceId));
      same(reference('physical_plate_appearance_actors', actor), input.actorReference); same(current.actor, actor);
      same(current.view.cut.physicalOperationReference, input.resolutionReference);
      const resolution = readSamePaPhysicalOperationFromSqlite(db, input.resolutionReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, input.launchReference);
      if (resolution.record.kind !== 'same_pa_physical_resolution_v1' || launch.record.kind !== 'same_pa_physical_launch_v1') throw Error('V196 original physical kinds differ');
      same(resolution.actor, actor); same(resolution.lineage, launch.lineage); same(resolution.physicalPitchReference, input.launchReference);
      same(resolution.record.source.launchReference, input.launchReference);
      const action = readSamePaPhysicalActionFromSqlite(db, launch.record.source.actionReference);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', input.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V196 original posture kind differs');
      same(posture.lineage, launch.lineage); same(posture.source.actionReference, launch.record.source.actionReference);
      same(posture.source.modelReference, action.source.batterModelReference); same(posture.source.viewReference, action.source.viewReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V196 complete current prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference);
      for (const ref of [input.viewReference, input.actorReference, input.resolutionReference, input.launchReference, input.postureReference, launch.record.source.actionReference, current.view.source.prefixReference]) visit(ref.owner, ref.sourceId);
      return { current, actor, resolution, launch, action, posture, prefix };
    });
    emit('current-pitch-anchor-authenticated', anchor);
    const actor = anchor.actor, game = actor.source.gameId, pitch = input.launchReference.sourceId, enrollment = anchor.current.view.lineage.enrollmentReference.sourceId;
    const scope = { careerId: actor.binding.careerId, gameId: game, playId: actor.match.playId, physicalPitchSourceId: pitch,
      fixtureEventId: actor.binding.fixtureEventId, gameDay: actor.binding.gameDay, ruleProfileId: actor.match.ruleProfileId };
    const bodies = [anchor.posture.model.bodyMaterialization, ...anchor.posture.sceneBodies];

    const candidates = <T>(owner: string, predicate: string, values: SQLInputValue[], read: (id: string) => T | null,
      validate: (value: T) => void, ref: (value: T) => unknown, nextOwner: string) => {
      const installed = namespace(owner);
      if (!installed.available) return { ...(installed.reason === 'NAMESPACE_ABSENT' ? missing(installed.reason, nextOwner)
        : { status: 'UNAUTHENTICATED' as const, reason: installed.reason, nextOwner }), owner, discovery: 'SCOPED_LOCATORS_ONLY' };
      // Third locator only detects an uninspected tail. At most two values are
      // authenticated; an ambiguous inventory never implies global absence.
      let rows;
      try { rows = db.prepare(`SELECT source_id FROM main.${owner} WHERE ${predicate} ORDER BY rowid LIMIT 3`).all(...values); }
      catch (error) { return { status: 'UNAUTHENTICATED' as const, owner, reason: 'SCOPED_LOCATOR_QUERY_REJECTED: ' + String(error), nextOwner }; }
      if (!rows.length) return { ...missing('NO_SCOPED_STORED_LOCATOR', nextOwner), owner, discovery: 'INDEXED_SCOPE_ONLY_NOT_GLOBAL_ABSENCE_PROOF' };
      const items = rows.slice(0, 2).map(row => {
        const id = String(row.source_id); visit(owner, id);
        try {
          const value = withSamePaLifecycleReadPhase(db, () => must(read(id))); validate(value);
          return { status: 'AVAILABLE' as const, reference: ref(value), evidence: value };
        } catch (error) { return { status: 'UNAUTHENTICATED' as const, sourceId: id, reason: String(error) }; }
      });
      return { status: rows.length > 1 ? 'AMBIGUOUS' : items[0].status, owner, candidateCountAtLeast: rows.length,
        uninspectedCandidatesRemain: rows.length > 2, items, nextOwner };
    };
    const modelScope = (value: { gameId: string; careerId: string; fixtureEventId: string; availableAtDay: number }) => {
      assert.equal(value.gameId, game); assert.equal(value.careerId, scope.careerId); assert.equal(value.fixtureEventId, scope.fixtureEventId);
      assert(value.availableAtDay <= scope.gameDay);
    };
    const fieldGeometry = candidates('batted_world_field_geometries', 'game_id=?', [game], id => {
      const owner = battedWorldFieldCalibrationEvidenceFromSqlite(db), value = owner.readGeometry(id); if (value) owner.historicalGeometry(value); return value;
    }, value => { assert.equal(value.baseGeometry.fixture.game_id, game); assert.equal(value.baseGeometry.fixture.fixture_event_id, scope.fixtureEventId);
      assert.equal(hash(value.baseGeometry.fixture), actor.fixtureHash); assert(value.baseGeometry.source.availableAtDay <= scope.gameDay); },
    value => reference('batted_world_field_geometries', value), 'openSqliteBattedWorldFieldStore.acceptGeometry');
    const fieldModel = candidates('batted_world_models', 'game_id=?', [game], id => battedWorldContactEvidenceFromSqlite(db).readModel(id), value => {
      modelScope(value); assert.equal(value.kind, 'body_materialized_batted_model_v1');
      assert.equal(value.actors.length, bodies.length); for (const body of bodies) same(value.actors.find(a => a.playerId === body.source.playerId), body.actor);
    }, value => ({ owner: 'batted_world_models', sourceId: value.sourceId, sourceHash: hash(value), snapshotHash: hash(value) }), 'openSqliteBattedWorldContactStore.accept (accepted model dependency)');
    const responseModel = candidates('batted_contact_response_models', 'game_id=?', [game], id => battedContactResponseEvidenceFromSqlite(db).readModel(id), value => {
      modelScope(value); assert.equal(value.actors.length, bodies.length);
      for (const body of bodies) assert.equal(value.actors.find(a => a.playerId === body.source.playerId)?.personId, body.person.personId);
    }, value => ({ owner: 'batted_contact_response_models', sourceId: value.sourceId, sourceHash: hash(value), snapshotHash: hash(value) }), 'openSqliteBattedContactResponseStore.accept (accepted response model dependency)');
    const freshCalibration = candidates('pa_physical_v1_field_calibrations', 'enrollment_source_id=? AND physical_pitch_source_id=?', [enrollment, pitch],
      id => readSamePaPhysicalFieldCalibrationFromSqlite(db, fullref('pa_physical_v1_field_calibrations', id)), value => {
        same(value.source.actionReference, reference('pa_physical_v1_action_plans', anchor.action)); same(value.source.postureReference, input.postureReference);
        same(value.lineage, anchor.launch.lineage);
      }, value => reference('pa_physical_v1_field_calibrations', value), 'openSqliteSamePlateAppearancePhysicalEpisodeStore.acceptFieldCalibration');
    const fieldRoots = candidates('pa_physical_v1_field_roots', 'enrollment_source_id=? AND physical_pitch_source_id=?', [enrollment, pitch],
      id => readSamePaPhysicalOperationFromSqlite(db, fullref('pa_physical_v1_field_roots', id)), value => {
        same(value.lineage, anchor.launch.lineage); same(value.physicalPitchReference, input.launchReference);
        if (value.record.kind !== 'same_pa_physical_field_root_v1') throw Error('V196 field root kind differs');
      }, value => value.reference, 'openSqliteSamePlateAppearancePhysicalEpisodeStore.acceptOperation (same_pa_physical_field_root_v1)');
    emit('bounded-field-witnesses-authenticated', { fieldGeometry, fieldModel, responseModel, freshCalibration, fieldRoots });

    const fieldPair = withSamePaLifecycleReadPhase(db, () => readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, input.viewReference, 'current'));
    const venue = fieldPair.kind === 'pending' ? missing(fieldPair.reason, 'normal field-root/field-step admission before venue coverage')
      : withSamePaLifecycleReadPhase(db, () => deriveSamePaVenueLegalCoverageFromPair(fieldPair));
    const liveHistory = withSamePaLifecycleReadPhase(db, () => readSamePaLiveBallHistoryFromSqlite(db, input.viewReference, 'current'));
    const liveOriginals = liveHistory.actions.slice(0, 2).map(value => {
      same(value.physicalPitchReference, input.launchReference); same(value.lineage, anchor.launch.lineage); visit(samePaLiveBallStateTable, value.source.sourceId);
      return { nativeReference: reference(samePaLiveBallStateTable, value), assignment: value.originalInputs.assignment, person: value.originalInputs.person };
    });
    const catchWitnesses = candidates('pa_catch_v1_work', 'enrollment_source_id=? AND physical_pitch_source_id=?', [enrollment, pitch],
      id => readSamePaCatchWorkFromSqlite(db, fullref('pa_catch_v1_work', id)), value => {
        same(value.physicalPitchReference, input.launchReference); same(value.lineage, anchor.launch.lineage);
      }, value => reference('pa_catch_v1_work', value), 'openSqliteSamePlateAppearanceCatchWorkStore.accept');
    const catchOriginals = 'items' in catchWitnesses ? (catchWitnesses.items ?? []).flatMap(item => item.status === 'AVAILABLE'
      ? [{ nativeReference: item.reference, originalInputs: item.evidence.originalInputs }] : []) : [];
    const original = liveOriginals[0];
    const plateAssignment = original ? { status: 'AVAILABLE' as const, reference: samePaOfficialSourceReference(original.assignment), evidence: original.assignment }
      : missing('SCOPED_PLATE_ASSIGNMENT_SOURCE_NOT_PROVIDED_OR_ADMITTED', 'SamePaLiveBallStateAuthority.readAcceptedAssignment');
    const person = original?.person ?? catchOriginals.find(value => value.originalInputs.person)?.originalInputs.person;
    const officialPerson = person ? { status: 'AVAILABLE' as const, reference: samePaOfficialSourceReference(person), evidence: person,
      provenance: original ? 'NORMAL_LIVE_BALL_ORIGINAL_INPUTS' : 'NORMAL_CATCH_WORK_ORIGINAL_INPUTS', plateAssignmentNotImplied: true }
      : missing('SCOPED_OFFICIAL_PERSON_SOURCE_NOT_PROVIDED_OR_ADMITTED', 'SamePaLiveBallStateAuthority.readAcceptedOfficialPerson');
    const livePolicy = original ? { status: 'AVAILABLE' as const, evidence: original.assignment.policy }
      : missing('SCOPED_LIVE_BALL_POLICY_SOURCE_NOT_PROVIDED_OR_ADMITTED', 'accepted original plate assignment.policy');
    const standaloneVenuePolicies = candidates('batted_venue_legal_policies', 'game_id=? AND career_id=? AND physical_pitch_source_id=?', [game, scope.careerId, pitch],
      id => battedVenueLegalPolicyEvidenceFromSqlite(db).read(id), value => {
        assert.equal(value.source.gameId, game); assert.equal(value.source.careerId, scope.careerId); assert.equal(value.physicalPitchSourceId, pitch); assert.equal(value.playId, scope.playId);
      }, value => reference('batted_venue_legal_policies', value), 'openSqliteBattedVenueLegalPolicyStore.accept (standalone owner; not SamePA embedded policy)');
    emit('scoped-official-and-venue-witnesses-read', { liveHistory, liveOriginals, catchWitnesses, catchOriginals, plateAssignment, officialPerson, livePolicy, venue, standaloneVenuePolicies });
    return { boundary: 'NATIVE_READONLY_SCOPED_WITNESS_INVENTORY_ONLY', scope, anchorReferences: input,
      field: { fieldGeometry, fieldModel, responseModel, freshCalibration, fieldRoots,
        candidateMeaning: 'AUTHENTICATED_SCOPED_INPUT_ONLY_NOT_A_COMPLETE_FIELD_ROOT',
        participantBodies: { status: 'AVAILABLE', count: bodies.length, references: bodies.map(body => reference('world_player_body_materializations', body)) },
        declaredPostureCoverage: { evaluationTick: anchor.current.view.cut.evaluationTick, validUntilTick: anchor.posture.source.geometry.validUntilTick,
          coversCurrentCut: anchor.posture.source.geometry.validUntilTick >= anchor.current.view.cut.evaluationTick }, fieldRuleEvidence: fieldPair },
      official: { plateAssignment, officialPerson, livePolicy, liveHistory, liveOriginals, catchWitnesses, catchOriginals,
        uninspectedLiveOriginalsRemain: liveHistory.actions.length > 2,
        catchPersonIsNotPlateAssignment: true, imaginaryRegistrySearched: false }, venue: { samePaLegalCoverage: venue, standaloneVenuePolicies },
      nextAdmissionConstraints: [
        'Field root requires authenticated existing geometry/model/response refs or a fresh calibration, plus explicit commands and parameters.',
        'Fresh calibration is tied to the original action/posture view; post-contact admission is UNCONFIRMED and must pass the normal owner.',
        'Plate assignment/person/policy are separately provided accepted originals; no player Person or catch assignment substitutes a plate assignment.',
        'LiveBallState Play requires an owned active field cut, legal venue/pitcher-plate coverage and actual pitcher custody/position proof.',
      ],
      nextRequiredOwnerInputs: [
        { owner: 'openSqliteSamePlateAppearancePhysicalEpisodeStore.acceptOperation', capability: 'same_pa_physical_field_root_v1',
          requires: ['original resolution/launch/posture refs', 'authenticated reusable field refs OR prior fresh calibration', 'explicit commands/parameters and original posture coverage'] },
        { owner: 'openSqliteSamePlateAppearancePhysicalEpisodeStore.acceptFieldCalibration', capability: 'same_pa_physical_field_calibration_v1',
          requires: ['original action/posture view', 'accepted body-model assembly, geometry, response model and parameters'], postContactAdmission: 'UNCONFIRMED' },
        { owner: 'openSqliteSamePlateAppearanceLiveBallStateStore.accept', capability: 'same_pa_explicit_live_ball_action_v1',
          requires: ['separately supplied accepted plate assignment/OfficialPerson/policy', 'active field cut', 'original venue legal/pitcher-plate coverage', 'actual pitcher custody and position'] },
      ],
      visitedRowLocators: visited, newSourcesAuthored: 0, newWriterCalls: 0, newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0,
      scopeCompleteness: 'CURRENT_PREFIX_AND_BOUNDED_SCOPED_CANDIDATES_ONLY', classification: null, performancePass: false };
  });
}
