import { battingModelStanceFixture } from './NativeBattingModelStanceFixtures.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { openSqlitePlayerFieldingModelStore } from './SqlitePlayerFieldingModelStore';
import { openSqlitePlayerObservationModelStore } from './SqlitePlayerObservationModelStore';
import { openSqlitePlayerDecisionModelStore } from './SqlitePlayerDecisionModelStore';
import { openSqlitePlayerLocomotionModelStore } from './SqlitePlayerLocomotionModelStore';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';

/** Source-only synthetic Native fixture. All actors, Persons, body/model inputs,
 * reserved states and accepted32 rows use their unchanged real Native owners.
 * Numerical declarations reuse the existing explicit fixture values; no mock,
 * genuine donor, model default or production fatigue calibration is involved. */
export const directNativeDispatchFixture = () => {
  const f = battingModelStanceFixture(), db = f.x.f.db, track = f.x.f.track;
  try {
    const actor = f.actor, batting = f.modelStore.accept(f.source.sourceId), values = dispatchCalibrationValues();
    // Existing continuous fixture baseline/policy and effortUnits=2 are explicit
    // synthetic inputs. Work is accepted before the new PA reservation exists.
    const activity = { sourceEventId: 'prior-independent-native-fixture-work', sourceVersion: 'fixture-only-v1', evidenceId: 'prior-independent-fixture',
      careerId: 'career-a', playerId: 'p2', atDay: actor.binding.gameDay, kind: 'MATCH' as const, effortUnits: 2 };
    f.x.f.activities.set(activity.sourceEventId, activity); f.x.f.workload.apply(activity.sourceEventId, 0);
    const bindings = [actor.binding, ...actor.defenderBindings];
    for (const b of bindings) {
      if (b.playerId === 'p2') continue;
      const source = { ...f.x.f.baseline, sourceId: 'native-baseline:' + b.playerId, playerId: b.playerId, personLinkSourceId: b.personLinkSourceId };
      track(openSqlitePlayerWorkloadRecoveryStore(f.x.f.path, f.x.f.links, { readAcceptedBaseline: id => id === source.sourceId ? source : null,
        readAcceptedActivity: () => null })).initialize(source.sourceId);
    }
    const fieldModels = new Map<string, any>();
    for (const b of actor.defenderBindings) {
      // Exact published PlayerFieldingModelFixtures numerical declaration.
      const source = { sourceId: 'native-fielding:' + b.playerId, sourceVersion: 'fixture-only-v1', careerId: b.careerId, playerId: b.playerId,
        personLinkSourceId: b.personLinkSourceId, acceptedAtDay: b.gameDay,
        ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
          firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5, armStrength: 0.5,
          throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
        transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
        throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
      const fielding = track(openSqlitePlayerFieldingModelStore(f.x.f.path, { readAcceptedModel: id => id === source.sourceId ? source : null })).accept(source.sourceId);
      const common = { sourceVersion: 'fixture-only-v1', careerId: b.careerId, playerId: b.playerId, personLinkSourceId: b.personLinkSourceId,
        fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: b.gameDay };
      const observation = { ...common, sourceId: 'native-observation:' + b.playerId, calibration: values.defender_observation };
      const decision = { ...common, sourceId: 'native-decision:' + b.playerId, calibration: values.defender_decision };
      const locomotion = { ...common, sourceId: 'native-locomotion:' + b.playerId, capability: 'defender_locomotion_v1' as const, calibration: values.defender_locomotion };
      fieldModels.set(b.playerId + ':defender_observation', track(openSqlitePlayerObservationModelStore(f.x.f.path, { readAcceptedModel: id => id === observation.sourceId ? observation : null })).accept(observation.sourceId));
      fieldModels.set(b.playerId + ':defender_decision', track(openSqlitePlayerDecisionModelStore(f.x.f.path, { readAcceptedModel: id => id === decision.sourceId ? decision : null })).accept(decision.sourceId));
      fieldModels.set(b.playerId + ':defender_locomotion', track(openSqlitePlayerLocomotionModelStore(f.x.f.path, { readAcceptedModel: id => id === locomotion.sourceId ? locomotion : null })).accept(locomotion.sourceId));
    }
    const enrollmentSource = { sourceId: 'native-enrollment', sourceVersion: 'fixture-only-v1', capability: 'reserved_same_pa_enrollment_v1' as const,
      actorReference: reference('physical_plate_appearance_actors', actor), firstPhysicalPitchSourceId: 'native-first-pitch', executionBasis: 'reserved_cumulative_actual_role_total_v1' as const,
      participantBaselineReferences: bindings.map(b => {
        const state = readActualRoleWorkloadState(db, b.careerId, b.playerId)!;
        const row = db.prepare('SELECT source_id FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(b.careerId, b.playerId)!;
        return { playerId: b.playerId, baselineSourceId: String(row.source_id), revision: state.revision, stateHash: hash(state) };
      }) };
    const enrollment = track(openSqliteSamePlateAppearanceEnrollmentStore(f.x.f.path, { readAcceptedEnrollment: () => enrollmentSource })).accept(enrollmentSource.sourceId);
    if (enrollment.kind !== 'reserved') throw new Error('real Native fixture reservation pending');
    const sources = new Map<string, unknown>(), execution = track(openSqliteSamePlateAppearanceExecutionStore(f.x.f.path, {
      readAcceptedPrefix: id => sources.get(id), readAcceptedTotal: id => sources.get(id), readAcceptedView: id => sources.get(id) }));
    const prefixSource = { sourceId: 'native-prefix', sourceVersion: 'fixture-only-v1', capability: 'reserved_same_pa_empty_prefix_v1', enrollmentReference: reference('same_pa_enrollments', enrollment) };
    sources.set(prefixSource.sourceId, prefixSource); const prefix = execution.acceptPrefix(prefixSource.sourceId);
    if (prefix.kind !== 'empty_prefix') throw new Error('real Native fixture prefix pending');
    const totals = enrollment.participants.map(p => ({ sourceId: 'native-total:' + p.binding.playerId, sourceVersion: 'fixture-only-v1', capability: 'reserved_same_pa_cumulative_total_v1',
      enrollmentReference: prefixSource.enrollmentReference, prefixReference: reference('reserved_pa_work_prefixes', prefix),
      participantReference: prefix.lineage.participantReferences.find(r => r.playerId === p.binding.playerId), effortUnits: 0,
      provenance: { assessmentSourceId: 'native-total-assessment:' + p.binding.playerId, assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'explicit-empty-fixture', calibrationVersion: 'fixture-only-zero-total-v1' } }));
    totals.forEach(s => sources.set(s.sourceId, s)); const set = execution.acceptTotalSet(totals.map(s => s.sourceId));
    if (set.kind !== 'total_set') throw new Error('real Native fixture TOTAL set pending');
    const viewSource = { sourceId: 'native-view', sourceVersion: 'fixture-only-v1', capability: 'reserved_same_pa_cumulative_view_v1',
      enrollmentReference: prefixSource.enrollmentReference, prefixReference: reference('reserved_pa_work_prefixes', prefix), participantTotalReferences: set.participantTotalReferences };
    sources.set(viewSource.sourceId, viewSource); const view = execution.acceptView(viewSource.sourceId);
    if (view.kind !== 'basis_prepared') throw new Error('real Native fixture view pending');
    const roles = deriveSamePaDispatchRoles(actor, view), base = { sourceVersion: 'fixture-only-v1', enrollmentReference: prefixSource.enrollmentReference,
      viewReference: reference('reserved_pa_execution_views', view), firstPhysicalPitchSourceId: enrollmentSource.firstPhysicalPitchSourceId };
    const nominalRef = (owner: string, table: string, id: string, value: unknown) => {
      const source = JSON.parse(String(db.prepare(`SELECT source_json FROM ${table} WHERE source_id=?`).get(id)!.source_json));
      return { owner, sourceId: id, sourceHash: hash(source), snapshotHash: hash(value) };
    };
    const timing = nominalRef('world_pitch_timing_baselines', 'world_pitch_timing_baselines', 'timing', f.x.f.timing.readHead('career-a', 'p2'));
    const release = nominalRef('world_player_release_baselines', 'world_player_release_baselines', 'release', f.x.f.release.readHead('career-a', 'p2'));
    const policy = { owner: 'world_pitch_fatigue_policies', sourceId: f.x.f.response.sourceId, sourceHash: hash(f.x.f.response), snapshotHash: hash(f.x.f.response) };
    const { careerId: _career, playerId: _player, gameDay: _day, playId: _play, pitchIndex: _index, ...delivery } = f.x.f.input.delivery;
    const action = { ...base, sourceId: 'native-action', capability: 'same_pa_first_pitch_action_v1', variant: 'declared_take_v1', pitcherPlayerId: 'p2', batterPlayerId: actor.binding.playerId,
      nominalPitch: { delivery, flight: f.x.f.input.flight, batter: { ...f.x.f.input.batter, ballRadiusMeters: batting.equipment.values.ball.radiusM } },
      timingReference: timing, releaseReference: release, pitchResponseReference: policy, batterModelReference: reference('world_player_batting_models', batting), geometryReference: { kind: 'action_source_take_geometry_v1' } };
    const parameters = { batter_observation: 'observationCalibration', batter_decision: 'decisionModel', batter_motor: 'capability', batter_swing: 'repertoire' } as const;
    const calibrations = roles.flatMap(role => role.routes.map(route => {
      const key = parameters[route as keyof typeof parameters], parameter = key ? batting[key] : null;
      const nominal = route === 'pitch_delivery' ? timing : parameter ? reference('world_player_batting_models', batting)
        : reference(route === 'defender_observation' ? 'world_player_observation_models' : route === 'defender_decision' ? 'world_player_decision_models' : 'world_player_locomotion_models', fieldModels.get(role.member.playerId + ':' + route));
      const id = 'native-calibration:' + role.member.playerId + ':' + route;
      return { ...base, sourceId: id, capability: 'same_pa_execution_calibration_v1', member: role.member, route, nominalReference: nominal,
        nominalParameterReference: parameter ? { parameterKey: key, sourceId: parameter.sourceId, sourceVersion: parameter.sourceVersion, sourceHash: hash(parameter) } : null,
        acceptedAtDay: actor.binding.gameDay, provenance: { assessmentSourceId: 'assessment:' + id, assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'declaration:' + id, calibrationVersion: 'fixture-only-v1' },
        response: route === 'pitch_delivery' ? { kind: 'accepted_pitch_response_v1', policyReference: policy } : { kind: 'accepted_execution_values_v1', values: values[route as keyof typeof values] } };
    }));
    sources.set(action.sourceId, action); calibrations.forEach(s => sources.set(s.sourceId, s));
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(f.x.f.path, { readAcceptedAction: id => sources.get(id), readAcceptedCalibration: id => sources.get(id) }));
    const acceptedAction = dispatch.acceptAction(action.sourceId), acceptedCalibrations = dispatch.acceptCalibrationSet(calibrations.map(s => s.sourceId));
    if (acceptedAction.kind !== 'action_prepared' || acceptedCalibrations.kind !== 'execution_calibration_set') throw new Error('real Native fixture dispatch prerequisite pending');
    const pitchCalibration = acceptedCalibrations.calibrations.find(c => c.source.route === 'pitch_delivery')!;
    return { ...f, db, path: f.x.f.path, actor, view, dispatch, acceptedAction, acceptedCalibrations, pitchCalibration,
      request: { actionReference: reference('pa_dispatch_v1_action_plans', acceptedAction), calibrationReference: reference('pa_dispatch_v1_execution_calibrations', pitchCalibration) } };
  } catch (error) { f.close(); throw error; }
};
