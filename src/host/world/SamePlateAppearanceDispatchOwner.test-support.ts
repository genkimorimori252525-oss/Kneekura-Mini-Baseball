import { vi } from 'vitest';
import { enrollmentFixture } from './SamePlateAppearanceEnrollment.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import * as timing from './SqlitePlayerPitchTimingStore';
import * as release from './SqlitePlayerReleaseGeometryStore';
import * as policy from './SqlitePitchFatiguePolicyStore';
import * as batting from './PlayerBattingModelEvidence';
import * as observation from './SqlitePlayerObservationModelStore';
import * as decision from './SqlitePlayerDecisionModelStore';
import * as locomotion from './SqlitePlayerLocomotionModelStore';
import * as persons from './SqlitePlayerPersonLinkStore';

/** Native dispatch and reservation ownership tests only. Original actor/model
 * evidence readers are explicitly mocked. Numerical values are the approved
 * parser-only synthetic declarations, never genuine dispatch qualification. */
export const dispatchOwnerFixture = () => {
  const f = enrollmentFixture();
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  f.actor.world.defenders.forEach((d, i) => Object.assign(d, { registeredPosition: positions[i] }));
  Object.assign(f.actor.world, { tick: 100 }); Object.assign(f.actor.match, { balls: 0, strikes: 0 }); f.persistActor();
  const enrollmentSource = { ...f.source, actorReference: reference('physical_plate_appearance_actors', f.actor) };
  const enrollments = openSqliteSamePlateAppearanceEnrollmentStore(f.path, { readAcceptedEnrollment: () => enrollmentSource });
  const enrollment = enrollments.accept(enrollmentSource.sourceId); enrollments.close(); if (enrollment.kind !== 'reserved') throw new Error('fixture enrollment missing');
  const sources = new Map<string, any>();
  const execution = openSqliteSamePlateAppearanceExecutionStore(f.path, { readAcceptedPrefix: id => sources.get(id), readAcceptedTotal: id => sources.get(id), readAcceptedView: id => sources.get(id) });
  const prefixSource = { sourceId: 'prefix', sourceVersion: 'fixture-v1', capability: 'reserved_same_pa_empty_prefix_v1', enrollmentReference: reference('same_pa_enrollments', enrollment) };
  sources.set('prefix', prefixSource); const prefix = execution.acceptPrefix('prefix'); if (prefix.kind !== 'empty_prefix') throw new Error('fixture prefix missing');
  const totalSources = enrollment.participants.map(p => ({ sourceId: 'total:' + p.binding.playerId, sourceVersion: 'fixture-v1', capability: 'reserved_same_pa_cumulative_total_v1',
    enrollmentReference: prefixSource.enrollmentReference, prefixReference: reference('reserved_pa_work_prefixes', prefix),
    participantReference: prefix.lineage.participantReferences.find(r => r.playerId === p.binding.playerId), effortUnits: 0,
    provenance: { assessmentSourceId: 'fixture-total:' + p.binding.playerId, assessmentVersion: 'fixture-v1', calibrationSourceId: 'fixture-zero', calibrationVersion: 'fixture-v1' } }));
  totalSources.forEach(s => sources.set(s.sourceId, s)); const totals = execution.acceptTotalSet(totalSources.map(s => s.sourceId)); if (totals.kind !== 'total_set') throw new Error('fixture TOTALs missing');
  const viewSource = { sourceId: 'view', sourceVersion: 'fixture-v1', capability: 'reserved_same_pa_cumulative_view_v1', enrollmentReference: prefixSource.enrollmentReference,
    prefixReference: reference('reserved_pa_work_prefixes', prefix), participantTotalReferences: totals.participantTotalReferences };
  sources.set('view', viewSource); const view = execution.acceptView('view'); execution.close(); if (view.kind !== 'basis_prepared') throw new Error('fixture view missing');
  const roles = deriveSamePaDispatchRoles(f.actor, view), values = dispatchCalibrationValues();
  const common = { careerId: 'career-a', playerId: 'home-1', personLinkSourceId: 'intake-home-1', acceptedAtDay: 1, sourceVersion: 'fixture-v1' };
  const timingSource = { ...common, sourceId: 'timing', profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000,
    quickSpeedFactor: 1.5, cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.7, naturalVariationUs: 50_000,
    normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const timingValue = { careerId: 'career-a', playerId: 'home-1', createdAtDay: 1, effectiveDay: 1, revision: 0, profile: timingSource.profile, records: [] };
  const releaseSource = { ...common, sourceId: 'release', body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' as const },
    profile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9, releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 }, tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const releaseValue = { careerId: 'career-a', playerId: 'home-1', revision: 0, tierBoundaries: releaseSource.tierBoundaries,
    baseline: { sourceId: 'release', sourceVersion: 'fixture-v1', effectiveDay: 1, body: releaseSource.body, profile: releaseSource.profile }, changes: [] };
  const policyValue = { sourceId: 'policy', sourceVersion: 'fixture-v1', policyId: 'response', version: 'v1', availableAtDay: 1,
    motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 };
  const originalPersons = [f.actor.person, ...f.actor.defenderPersons];
  vi.spyOn(persons, 'playerPersonLinkEvidenceFromSqlite').mockReturnValue({ readLink: id => originalPersons.find(p => p.sourceId === id) ?? null });
  const links = { readAcceptedPlayerPersonLink: (id: string) => originalPersons.find(p => p.sourceId === id) ?? null };
  const timingOwner = timing.openSqlitePlayerPitchTimingStore(f.path, links, { readAcceptedBaseline: () => timingSource, readAcceptedLearning: () => null });
  const releaseOwner = release.openSqlitePlayerReleaseGeometryStore(f.path, links, { readAcceptedBaseline: () => releaseSource, readAcceptedChange: () => null });
  const policyOwner = policy.openSqlitePitchFatiguePolicyStore(f.path, { readAcceptedPolicy: () => policyValue });
  timingOwner.initialize(timingSource.sourceId); releaseOwner.initialize(releaseSource.sourceId); policyOwner.accept(policyValue.sourceId);
  timingOwner.close(); releaseOwner.close(); policyOwner.close();
  const ownerRef = (owner: string, source: { sourceId: string }, value: unknown) => ({ owner, sourceId: source.sourceId, sourceHash: hash(source), snapshotHash: hash(value) });
  const tr = ownerRef('world_pitch_timing_baselines', timingSource, timingValue), rr = ownerRef('world_player_release_baselines', releaseSource, releaseValue), pr = ownerRef('world_pitch_fatigue_policies', policyValue, policyValue);
  const validateRef = (ref: unknown, expected: unknown) => { if (hash(ref) !== hash(expected)) throw new Error('mock original nominal reference differs'); };
  vi.spyOn(timing, 'selectPlayerPitchTimingProfileFromSqlitePrefix').mockImplementation((_db, ref) => { validateRef(ref, tr); return timingValue.profile; });
  vi.spyOn(timing, 'assertCurrentPlayerPitchTimingPrefixFromSqlite').mockImplementation((_db, ref) => { validateRef(ref, tr); });
  vi.spyOn(release, 'assertCurrentPlayerReleaseGeometryPrefixFromSqlite').mockImplementation((_db, ref) => { validateRef(ref, rr); });
  vi.spyOn(timing, 'readPlayerPitchTimingPrefixFromSqlite').mockImplementation((_db, ref) => { validateRef(ref, tr); return timingValue; });
  vi.spyOn(release, 'readPlayerReleaseGeometryPrefixFromSqlite').mockImplementation((_db, ref) => { validateRef(ref, rr); return releaseValue; });
  vi.spyOn(policy, 'readPitchFatiguePolicyFromSqlite').mockImplementation((_db, ref) => { validateRef(ref, pr); return policyValue; });
  const batterScope = { careerId: 'career-a', playerId: 'away-2', personId: 'person-away-2', personLinkSourceId: 'intake-away-2', acceptedAtDay: 1 };
  const parameter = (sourceId: string, v: unknown) => ({ sourceId, sourceVersion: 'fixture-v1', ...batterScope, values: v });
  const model: any = { source: { sourceId: 'batting-model', sourceVersion: 'fixture-v1', ...batterScope }, person: f.actor.person,
    bodyMaterialization: { source: { sourceId: 'body', sourceVersion: 'fixture-v1', ...batterScope, atDay: 1, role: 'batter' }, person: f.actor.person,
      body: { sourceId: 'body-measures', sourceVersion: 'fixture-v1', ...batterScope, physicalProfile: { heightMeters: 1.8 } }, pose: { sourceId: 'pose', sourceVersion: 'fixture-v1', ...batterScope } },
    observationCalibration: parameter('batting-observation', values.batter_observation), decisionModel: parameter('batting-decision', values.batter_decision),
    capability: parameter('batting-motor', values.batter_motor), repertoire: parameter('batting-swing', values.batter_swing),
    equipment: parameter('equipment', { ball: { radiusM: 0.0366 } }), predictionCalibration: parameter('prediction', { parameters: { ticksPerSecond: 1_000_000 } }) };
  const models = new Map<string, any>([[model.source.sourceId, model]]);
  vi.spyOn(batting, 'playerBattingModelEvidenceFromSqlite').mockReturnValue({ read: (id: string) => models.get(id) ?? null, selectAtDay: () => model } as any);
  const parameters: Record<string, string> = { batter_observation: 'observationCalibration', batter_decision: 'decisionModel', batter_motor: 'capability', batter_swing: 'repertoire' };
  const fieldModels = new Map<string, any>();
  for (const role of roles.slice(1)) for (const route of role.routes.filter(r => r !== 'pitch_delivery')) {
    const playerId = role.member.playerId, person = f.actor.defenderPersons.find(p => p.playerId === playerId)!;
    const s = { ...common, sourceId: 'model:' + playerId + ':' + route, playerId, personLinkSourceId: person.sourceId, calibration: values[route as keyof typeof values] };
    fieldModels.set(s.sourceId, { source: s, fieldingModel: { source: { ...s, sourceId: 'fielding:' + playerId }, person } });
  }
  for (const [module, key] of [[observation, 'playerObservationModelEvidenceFromSqlite'], [decision, 'playerDecisionModelEvidenceFromSqlite'], [locomotion, 'playerLocomotionModelEvidenceFromSqlite']] as const) {
    vi.spyOn(module as any, key).mockReturnValue({ read: (id: string) => fieldModels.get(id) ?? null, selectAtDay: (_career: string, player: string) => [...fieldModels.values()].find(v => v.source.playerId === player && v.source.sourceId.endsWith(key.includes('Observation') ? 'defender_observation' : key.includes('Decision') ? 'defender_decision' : 'defender_locomotion')) });
  }
  for (const table of ['world_player_batting_models', 'world_player_observation_models', 'world_player_decision_models', 'world_player_locomotion_models']) f.db.exec('CREATE TABLE ' + table + '(source_id TEXT PRIMARY KEY)');
  const base = { sourceVersion: 'fixture-owner-v1', enrollmentReference: prefixSource.enrollmentReference, viewReference: reference('reserved_pa_execution_views', view), firstPhysicalPitchSourceId: f.source.firstPhysicalPitchSourceId };
  const action: any = { ...base, sourceId: 'action', capability: 'same_pa_first_pitch_action_v1', variant: 'declared_take_v1', pitcherPlayerId: 'home-1', batterPlayerId: 'away-2',
    nominalPitch: { delivery: { matchSeed: 19, moundReference: { x: 0, y: 0, z: 18 }, outingId: 'outing-1', readyAtUs: 100, timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
      flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } }, batter: { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } },
    timingReference: tr, releaseReference: rr, pitchResponseReference: pr, batterModelReference: reference('world_player_batting_models', model), geometryReference: { kind: 'action_source_take_geometry_v1' } };
  const calibrations: any[] = roles.flatMap(role => role.routes.map(route => {
    const nominal = route === 'pitch_delivery' ? tr : parameters[route] ? reference('world_player_batting_models', model) : reference(route === 'defender_observation' ? 'world_player_observation_models' : route === 'defender_decision' ? 'world_player_decision_models' : 'world_player_locomotion_models', fieldModels.get('model:' + role.member.playerId + ':' + route));
    const p = model[parameters[route]], sourceId = 'calibration:' + role.member.playerId + ':' + route;
    return { ...base, sourceId, capability: 'same_pa_execution_calibration_v1', member: role.member, route, nominalReference: nominal,
      nominalParameterReference: p ? { parameterKey: parameters[route], sourceId: p.sourceId, sourceVersion: p.sourceVersion, sourceHash: hash(p) } : null,
      acceptedAtDay: 2, provenance: { assessmentSourceId: 'assessment:' + sourceId, assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'declaration:' + sourceId, calibrationVersion: 'fixture-only-v1' },
      response: route === 'pitch_delivery' ? { kind: 'accepted_pitch_response_v1', policyReference: pr } : { kind: 'accepted_execution_values_v1', values: values[route as keyof typeof values] } };
  }));
  const accepted = new Map<string, any>([[action.sourceId, action], ...calibrations.map(s => [s.sourceId, s] as [string, any])]);
  const authority = { readAcceptedAction: (id: string) => accepted.get(id) ?? null, readAcceptedCalibration: (id: string) => accepted.get(id) ?? null,
    readAcceptedConsumerSet: (id: string) => accepted.get(id) ?? null, readAcceptedEpisode: (id: string) => accepted.get(id) ?? null, readAcceptedRight: (id: string) => accepted.get(id) ?? null };
  return { ...f, enrollment, prefix, view, roles, base, action, calibrations, accepted, authority, model, models, fieldModels };
};
