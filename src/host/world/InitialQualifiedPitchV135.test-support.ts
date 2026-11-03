import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { initialQualifiedSpinFixtureV133 } from './InitialQualifiedSpinV133.test-support';
import { reserveAuthoredNativePlateAppearanceV1 } from '../../integration/native-game/AuthoredNativeReservationV1';
import { prepareAuthoredNativeObservedPitchV1, type AuthoredNativePitchPreparationV1 } from '../../integration/native-game/AuthoredNativePitchPreparationV1';
import { readAuthoredNativeMatchV1, type AuthoredNativeMatchReadPinsV1 } from '../../integration/native-game/AuthoredNativeMatchV1';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { openSqliteSamePlateAppearanceInitialBallStore } from './SqliteSamePlateAppearanceInitialBallStore';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { openSqliteInitialBatEquipmentStore, initialBatEquipmentTable } from './SqliteInitialBatEquipmentStore';
import { openSqliteObservedInitialPitchStore, observedInitialOperations, type ObservedInitialSource, type ObservedInitialSpinDecisionSourceV123 } from './SqliteObservedInitialPitchStore';
import { openSqliteBattingEmotionStore } from './SqliteBattingEmotionStore';
import { openSqliteBattingEmotionExecutionStore } from './SqliteBattingEmotionExecutionStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { battingEmotionFrame, type AcceptedInitialBattingEmotionExecution } from './NativeBattingEmotionExecution';
import type { AcceptedBattingEmotionGenesis } from './NativeBattingEmotion';
import { openSqliteSpinControlMasteryV123 } from './SqliteSpinControlMasteryV123';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as officialReference } from './SamePlateAppearanceCatchCommunicationSource';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { EMOTIONS } from '../../core/world/psychology/EmotionTypes';
import { SITUATION_AXES, RESPONSE_AXES, type AppraisalInput } from '../../core/world/psychology/appraisal/AppraisalTypes';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import type { MeasuredContactAimV138 } from '../../core/world/psychology/batting/MeasuredBattingTrajectoryV1';

const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const ns = 'iqp135', version = 'explicit-synthetic-qualified-initial-v135', zero = { x: 0, y: 0, z: 0 };
type Stage = (name: string) => void;
const requireValue = <T>(v: T | null | undefined, message: string): T => { if (v == null) throw Error(message); return v; };
export type InitialQualifiedPrefixV135 = Readonly<{
  version: 'same_database_qualified_initial_prefix_v135'; path: string; genesisPins: AuthoredNativeMatchReadPinsV1;
  actorReference: SamePaReference<'physical_plate_appearance_actors'>; modelReference: SamePaReference<'world_player_batting_models'>;
  qualificationReference: SamePaReference<'world_spin_mastery_v123'>; enrollmentReference: SamePaReference<'same_pa_enrollments'>;
  launchReference: SamePaReference<'pa_dispatch_v1_pitch_actions'>; initialBatReference: SamePaReference<typeof initialBatEquipmentTable>;
  decisionReference: SamePaReference<typeof observedInitialOperations>;
}>;

/** Logical original-head census only. New Owner tables are deliberately not a
 * second World event and never turn an empty PA TOTAL into zero Career work. */
export function initialQualifiedHeadsV135(path: string) {
  const db = new Native(path, { readOnly: true });
  try { return hash(['world_control_heads', 'world_decision_revision_events', 'pa_observed_initial_v1_heads', 'world_player_workload_heads'].map(table => {
    const exists = db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(table);
    return [table, exists ? db.prepare('SELECT * FROM main.' + table + ' ORDER BY rowid').all() : []];
  })); } finally { db.close(); }
}

/** Stage A: every accepted result is produced by its real Owner in this same
 * database. Numeric emotion/response/flight inputs are synthetic declarations,
 * not Native receipts, empirical people or another database's accepted data. */
export function prepareInitialQualifiedDecisionV135(stage: Stage = () => {}, options: Readonly<{ contactAimV138?: MeasuredContactAimV138; controlledObservationV139?: true }> = {}) {
  stage('qualified-practice-start');
  const physical = { ticksPerSecond: 1_000_000, integrationStepTicks: 2000, gravityY: -9.81,
    aerodynamics: { ...REFERENCE_BASEBALL_AERODYNAMICS, airDensityKgM3: 0 } };
  const f = initialQualifiedSpinFixtureV133(stage, { predictionParametersV135: physical,
    ...(options.contactAimV138 ? { contactAimV138: options.contactAimV138 } : { fieldRegistrationV137: true }),
    ...(options.controlledObservationV139 ? { controlledObservationV139: true } : {}) }), { path, genesis, actor, batting } = f;
  const handles: { close(): void }[] = [], keep = <T extends { close(): void }>(v: T): T => { handles.push(v); return v; };
  const sources = new Map<string, unknown>();
  const save = <T extends { sourceId: string }>(s: T): T => { sources.set(s.sourceId, s); return s; };
  const get = <T>(id: string): T | null => (sources.get(id) ?? null) as T | null;
  try {
    strictEqual(genesis.models.length, 18); strictEqual(actor.defenderBindings.length, 9);
    stage('reservation-start');
    const reserved = reserveAuthoredNativePlateAppearanceV1(path, f.reservationDeclaration);
    strictEqual(reserved.enrollment.participants.length, 10);
    stage('reservation-ready');
    const pitcher = requireValue(actor.world.defenders.find(p => p.registeredPosition === 'P'), 'original pitcher missing');
    const timing = requireValue(f.feederTimingBaselineV133, 'original accepted feeder timing declaration missing');
    strictEqual(timing.playerId, pitcher.playerId);
    const response = { sourceId: ns + ':pitch-response', sourceVersion: version, policyId: ns + ':pitch-response', version: 'v1', availableAtDay: 10,
      motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: .5, spinRetentionAtFullFatigue: .75 };
    const responseReference: SamePaReference<'world_pitch_fatigue_policies'> = { owner: 'world_pitch_fatigue_policies', sourceId: response.sourceId,
      sourceHash: hash(response), snapshotHash: hash(response) };
    const provenance = (name: string) => ({ assessmentSourceId: ns + ':' + name, assessmentVersion: version,
      calibrationSourceId: ns + ':synthetic-current-workload-response', calibrationVersion: version });
    const calibration = (playerId: string, route: string, value: unknown) => ({ sourceId: ns + ':cal:' + playerId + ':' + route,
      sourceVersion: version, playerId, route, acceptedAtDay: 10, provenance: provenance(playerId + ':' + route), response: value });
    const calibrations: unknown[] = [];
    for (const [route, key] of Object.entries({ batter_observation: 'observationCalibration', batter_decision: 'decisionModel', batter_motor: 'capability', batter_swing: 'repertoire' } as const)) {
      calibrations.push(calibration(actor.binding.playerId, route, { kind: 'accepted_execution_values_v1', values: batting[key].values }));
    }
    for (const defender of actor.world.defenders) {
      const m = requireValue(genesis.models.find(m => m.playerId === defender.playerId), 'original defender models missing');
      for (const [route, model] of [['defender_observation', m.observation], ['defender_decision', m.decision], ['defender_locomotion', m.locomotion]] as const) {
        calibrations.push(calibration(defender.playerId, route, { kind: 'accepted_execution_values_v1', values: model.source.calibration }));
      }
      if (defender.playerId === pitcher.playerId) calibrations.push(calibration(defender.playerId, 'pitch_delivery', { kind: 'accepted_pitch_response_v1', policyReference: responseReference }));
    }
    const strikeZone = { centerX: 0, halfWidth: .2159, lowerY: .5, upperY: 1.1 };
    const declaration: AuthoredNativePitchPreparationV1 = { version: 'authored_native_observed_pitch_preparation_v1', namespace: ns, sourceVersion: version,
      genesisPins: genesis.readPins, enrollmentReference: reference('same_pa_enrollments', reserved.enrollment), battingModelReference: f.reservationDeclaration.battingModelReference,
      timing, pitchResponse: response, nominalPitch: { delivery: { matchSeed: 19, moundReference: { ...pitcher.position, y: 0 }, outingId: ns + ':outing', readyAtUs: actor.world.tick,
        timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, physics: { velocity: { x: 0, y: 3, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
      flight: { durationUs: 1_500_000 }, batter: { plateZ: 0, strikeZone, ballRadiusMeters: batting.equipment.values.ball.radiusM } },
      actualFlightParameters: batting.predictionCalibration.values.parameters,
      emptyTotalProvenance: reserved.enrollment.participants.map(p => ({ playerId: p.binding.playerId, provenance: provenance('empty-pa-prefix:' + p.binding.playerId) })),
      calibrations: calibrations as AuthoredNativePitchPreparationV1['calibrations'] };
    stage('thirty-two-calibrations-start');
    const prepared = prepareAuthoredNativeObservedPitchV1(path, declaration);
    strictEqual(prepared.acceptedCalibrations.calibrations.length, 32); stage('thirty-two-calibrations-ready');
    const perception = keep(openSqliteBattingPerceptionStore(path, { readAcceptedPosture: get }));
    const initial = keep(openSqliteSamePlateAppearanceInitialBallStore(path, { readAcceptedSetup: get, readAcceptedVenue: get, readAcceptedPlay: get, readAcceptedAssignment: get, readAcceptedOfficialPerson: get }));
    const dispatch = keep(openSqliteSamePlateAppearanceDispatchStore(path, { readAcceptedConsumerSet: get, readAcceptedEpisode: get, readAcceptedRight: get, readAcceptedPhysicalPitch: get }));
    const equipment = keep(openSqliteInitialBatEquipmentStore(path, { readAcceptedInitialBat: get }));
    const base = { sourceVersion: version, enrollmentReference: declaration.enrollmentReference, viewReference: reference('reserved_pa_execution_views', prepared.view),
      firstPhysicalPitchSourceId: prepared.enrollment.source.firstPhysicalPitchSourceId };
    const postureSource = save({ sourceVersion: version, viewReference: base.viewReference, sourceId: ns + ':posture', capability: 'owned_batting_invocation_posture_v1', member: prepared.roles[0].member,
      actionReference: prepared.request.actionReference, modelReference: declaration.battingModelReference,
      sceneBodyReferences: actor.world.defenders.map(d => ({ playerId: d.playerId, bodyReference: reference('world_player_body_materializations',
        requireValue(genesis.materializations.find(b => b.source.playerId === d.playerId && b.source.role !== 'batter'), 'original scene body missing')) })),
      geometry: { kind: 'stationary_pre_pitch_scene_v1', startedAtTick: actor.world.tick, validUntilTick: prepared.calculation.calculation.trajectory.endTick + 500_000,
        ticksPerSecond: 1_000_000, handedness: batting.repertoire.values.sampledProfiles![0].handedness,
        // The new model pins the same first-base-positive field basis as the
        // diamond: a recorded R batter stands on the negative-X third-base side.
        centerOfMass: { x: -.78, y: 1, z: -.16 }, eyePosition: { x: -.72, y: 1.55, z: -.28 }, observerForward: { x: 0, y: 0, z: 1 },
        attention: { target: { kind: 'ball' }, focusedSinceTick: actor.world.tick }, bodyReadyTick: actor.world.tick,
        latestMotorStartTick: prepared.calculation.calculation.trajectory.endTick, plateZ: 0, strikeZone }, provenance: provenance('stance') });
    const posture = perception.acceptPosture(postureSource.sourceId); if (posture.kind !== 'batting_invocation_posture') throw Error('actual posture pending');
    const pitcherBody = requireValue(posture.sceneBodies.find(b => b.source.playerId === pitcher.playerId), 'actual pitcher body missing');
    const hand = requireValue(pitcherBody.actor.primitives.find(p => p.role === 'tag_hand'), 'actual hand missing');
    const foot = requireValue(pitcherBody.actor.primitives.find(p => p.role === 'left_foot'), 'actual foot missing');
    const venue = save({ sourceId: ns + ':venue', sourceVersion: version, capability: 'same_pa_initial_ball_venue_v1', careerId: actor.binding.careerId,
      gameId: actor.source.gameId, playId: actor.match.playId, fixtureEventId: actor.binding.fixtureEventId, venueId: f.declaration.fixture.venueId, availableAtDay: 10,
      pitcherPlate: { region: { center: pitcher.position, halfSize: { x: .4, z: .2 }, rotationRadians: 0 }, surfaceHeightMeters: pitcherBody.actor.bodyOriginHeightMeters + foot.offset.y },
      rulePolicy: { version: 'closed_interior_venue_legal_regions_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id, rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision,
        regions: [{ regionId: ns + ':interior', classification: 'inside_playable_region', minimum: { x: -100, y: -1, z: -5 }, maximum: { x: 100, y: 10, z: 150 } }] } });
    const setupSource = save({ ...base, sourceId: ns + ':setup', capability: 'same_pa_initial_ball_setup_v1', actionReference: prepared.request.actionReference,
      postureReference: reference('batting_observation_v1_postures', posture), venueReference: officialReference(venue), pitcherPlayerId: pitcher.playerId,
      custody: { kind: 'explicit_initial_secure_custody_v1', role: 'tag_hand', ball: { tick: actor.world.tick,
        position: { x: pitcher.position.x + hand.offset.x, y: pitcherBody.actor.bodyOriginHeightMeters + hand.offset.y, z: pitcher.position.z + hand.offset.z }, velocity: zero, spin: zero } } });
    const setup = initial.acceptSetup(setupSource.sourceId); if (setup.kind !== 'same_pa_initial_ball_setup_v1') throw Error('actual initial setup pending');
    const grasp = batting.repertoire.values.sampledProfiles![0], ownHand = requireValue(batting.bodyMaterialization.actor.primitives.find(p => p.role === 'tag_hand'), 'batter hand missing');
    const handCenter = { x: posture.source.geometry.centerOfMass.x + ownHand.offset.x, y: batting.bodyMaterialization.actor.bodyOriginHeightMeters + ownHand.offset.y,
      z: posture.source.geometry.centerOfMass.z + ownHand.offset.z };
    const gearSource = save({ sourceId: ns + ':initial-bat', sourceVersion: version, capability: 'owned_initial_bat_equipment_v1', setupReference: reference('pa_initial_ball_v1_setups', setup),
      profileId: grasp.profileId, custody: 'explicit_initial_secure_bat_grasp_v1', throughTick: posture.source.geometry.validUntilTick,
      pose: { grip: { x: handCenter.x, y: handCenter.y - grasp.measured.handReferenceFromKnobM, z: handCenter.z }, orientation: { ...zero, w: 1 } }, provenance: provenance('held-bat') });
    const gear = equipment.accept(gearSource.sourceId); if (gear.kind !== 'initial_bat_equipment_v1') throw Error('actual initial bat pending');
    const officialPerson = save({ sourceId: ns + ':umpire', sourceVersion: version, capability: 'accepted_original_umpire_person_v1', careerId: actor.binding.careerId,
      personId: ns + ':umpire-person', officialId: ns + ':plate-umpire' });
    const assignment = save({ sourceId: ns + ':assignment', sourceVersion: version, capability: 'same_pa_explicit_live_ball_assignment_v1', role: 'plate_umpire',
      enrollmentReference: base.enrollmentReference, gameId: actor.source.gameId, playId: actor.match.playId, physicalPitchSourceId: base.firstPhysicalPitchSourceId,
      officialId: officialPerson.officialId, personId: officialPerson.personId, personReference: officialReference(officialPerson),
      policy: { sourceId: ns + ':play-policy', sourceVersion: version, ruleProfileId: actor.match.ruleProfileId, kind: 'accepted_original_live_ball_action_v1' } });
    const playSource = save({ sourceId: ns + ':play', sourceVersion: version, capability: 'same_pa_initial_play_v1', setupReference: reference('pa_initial_ball_v1_setups', setup),
      assignmentReference: officialReference(assignment), officialId: assignment.officialId, personId: officialPerson.personId, declaration: 'play' });
    const play = initial.acceptPlay(playSource.sourceId); if (play.kind !== 'same_pa_initial_play_v1') throw Error('actual Play pending');
    const consumersSource = save({ ...base, sourceId: ns + ':consumers', capability: 'same_pa_consumer_set_v1', actionReference: prepared.request.actionReference,
      participantInputs: prepared.roles.map(role => ({ member: role.member, calibrationReferences: role.routes.map(route => ({ route,
        calibrationReference: reference('pa_dispatch_v1_execution_calibrations', prepared.acceptedCalibrations.calibrations.find(c => c.source.member.playerId === role.member.playerId && c.source.route === route)!) })) })) });
    const consumers = dispatch.acceptConsumerSet(consumersSource.sourceId); if (consumers.kind !== 'consumer_set_prepared') throw Error('actual consumers pending');
    const episodeSource = save({ ...base, sourceId: ns + ':episode', capability: 'same_pa_first_pitch_episode_v1', actionReference: prepared.request.actionReference,
      consumerSetReference: reference('pa_dispatch_v1_consumer_sets', consumers) });
    const episode = dispatch.acceptEpisode(episodeSource.sourceId); if (episode.kind !== 'prospective_episode_prepared') throw Error('actual episode pending');
    const rightSource = save({ ...episodeSource, sourceId: ns + ':right', capability: 'same_pa_first_pitch_right_v1',
      episodeReference: reference('pa_dispatch_v1_episodes', episode), prefixReference: prepared.view.source.prefixReference });
    const right = dispatch.acceptRight(rightSource.sourceId); if (right.kind !== 'immutable_right_prepared') throw Error('actual launch right pending');
    const release = prepared.calculation.calculation.delivery.release, radius = hand.radius + setup.ballRadiusMeters;
    const releaseHand = { ...release.position, z: release.position.z + radius };
    const motion = { version: 'controlled_held_pitch_v1', ticksPerSecond: 1_000_000, initialOrientation: { ...zero, w: 1 }, held: [
      { tick: actor.world.tick, handCenter: setup.source.custody.ball.position, handVelocity: zero, ballOffset: zero, ballOffsetVelocity: zero, spin: zero },
      { tick: release.releaseAtUs - 40_000, handCenter: { x: pitcher.position.x - .3, y: 1.45, z: pitcher.position.z + .3 }, handVelocity: zero, ballOffset: { x: 0, y: 0, z: -radius }, ballOffsetVelocity: zero, spin: zero },
      { tick: release.releaseAtUs, handCenter: releaseHand, handVelocity: release.velocity, ballOffset: { x: 0, y: 0, z: -radius }, ballOffsetVelocity: zero, spin: release.spin }],
    followThrough: [{ tick: release.releaseAtUs, handCenter: releaseHand, handVelocity: release.velocity },
      { tick: release.releaseAtUs + 50_000, handCenter: { x: release.position.x, y: release.position.y, z: pitcher.position.z - .67 }, handVelocity: zero },
      { tick: prepared.calculation.calculation.delivery.timeline.followThroughEndUs, handCenter: { x: release.position.x, y: release.position.y, z: pitcher.position.z - .67 }, handVelocity: zero }] };
    const launchSource = save({ sourceId: base.firstPhysicalPitchSourceId, sourceVersion: version, capability: 'same_pa_observed_physical_pitch_with_bat_v2',
      rightReference: reference('pa_dispatch_v1_rights', right), actionReference: prepared.request.actionReference, initialPlayReference: reference('pa_initial_ball_v1_plays', play),
      custodyMotion: motion, initialBatReference: reference(initialBatEquipmentTable, gear) });
    stage('observed-launch-start');
    const launch = dispatch.acceptObservedPitch(launchSource.sourceId); if (launch.kind !== 'same_pa_first_pitch_launched_v1') throw Error('actual observed launch pending');
    stage('observed-launch-ready');
    const observed = keep(openSqliteObservedInitialPitchStore(path, { readAcceptedOperation: get }));
    const launchReference = reference('pa_dispatch_v1_pitch_actions', launch);
    const cal = (route: string) => reference('pa_dispatch_v1_execution_calibrations', requireValue(prepared.acceptedCalibrations.calibrations.find(c => c.source.route === route), 'actual route missing'));
    const ballPhysics = { kind: 'aero_ground_v1', air: launch.result.trajectory.parameters,
      ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: batting.equipment.values.ball.radiusM, inertiaRatio: .378, restingVerticalSpeedMps: .15,
        material: { restitution: .4, slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } } as const;
    const observedBase = { sourceVersion: version, launchReference };
    const accept = <T extends ObservedInitialSource>(s: T) => { save(s); return observed.accept(s.sourceId); };
    const cut = accept({ ...observedBase, sourceId: ns + ':cut1', capability: 'same_pa_observed_initial_cut_v1', previousOperationReference: null,
      throughTick: release.releaseAtUs + 20_000, ballPhysics }); if (cut.kind !== 'observed_initial_cut_v1') throw Error('actual cut missing');
    const capture = accept({ ...observedBase, sourceId: ns + ':capture1', capability: 'same_pa_observed_initial_capture_v1', previousOperationReference: reference(observedInitialOperations, cut),
      calibrationReference: cal('batter_observation') }); if (capture.kind !== 'observed_initial_capture_v1' || !capture.calculation.sample) throw Error('actual captured sample missing');
    const cut2 = accept({ ...observedBase, sourceId: ns + ':cut2', capability: 'same_pa_observed_initial_cut_v1', previousOperationReference: reference(observedInitialOperations, capture),
      throughTick: capture.calculation.availableTick!, ballPhysics }); if (cut2.kind !== 'observed_initial_cut_v1') throw Error('actual delivery cut missing');
    const delivery = accept({ ...observedBase, sourceId: ns + ':delivery', capability: 'same_pa_observed_initial_delivery_v1', previousOperationReference: reference(observedInitialOperations, cut2),
      captureReference: reference(observedInitialOperations, capture), calibrationReference: cal('batter_observation') }); if (delivery.kind !== 'observed_initial_delivery_v1') throw Error('actual delivery missing');
    const prediction = accept({ ...observedBase, sourceId: ns + ':prediction', capability: 'same_pa_observed_initial_prediction_v1', previousOperationReference: reference(observedInitialOperations, delivery),
      deliveryReference: reference(observedInitialOperations, delivery) }); if (prediction.kind !== 'observed_initial_prediction_v1') throw Error('actual prediction missing');
    stage('observed-forecast-ready');
    const opportunity = accept({ ...observedBase, sourceId: ns + ':opportunity', capability: 'same_pa_observed_initial_opportunity_v1', previousOperationReference: reference(observedInitialOperations, prediction),
      predictionReference: reference(observedInitialOperations, prediction) }); if (opportunity.kind !== 'observed_initial_opportunity_v1') throw Error('actual opportunity missing');
    const emotion = initialEmotionV135(path, prepared.view, prepared.roles[0].member, actor, capture, delivery, opportunity, launchReference, keep, save, get);
    stage('initial-emotion-ready');
    const control = keep(openSqliteWorldControlStore(path)), world = requireValue(control.readHead(actor.binding.careerId), 'actual World missing');
    const source: ObservedInitialSpinDecisionSourceV123 = { ...observedBase, sourceId: ns + ':qualified-decision', capability: 'same_pa_observed_initial_decision_v123',
      previousOperationReference: reference(observedInitialOperations, opportunity), opportunityReference: reference(observedInitialOperations, opportunity),
      emotionReference: reference('batting_emotion_execution_v1_executions', emotion), decisionCalibrationReference: cal('batter_decision'),
      motorCalibrationReference: cal('batter_motor'), repertoireCalibrationReference: cal('batter_swing'),
      expectedWorld: { careerId: actor.binding.careerId, worldRevision: world.worldRevision, controlRevision: world.control.revision, controlHash: hash(world.control) }, attempt: 'ordinary_swing',
      spinBindingV123: { kind: 'fixed_native_spin_binding_v123', modelReference: declaration.battingModelReference,
        intent: { technique: 'BACKSPIN', selectedAtTick: opportunity.evaluationTick }, qualificationReferences: [f.qualificationReference] } };
    const before = initialQualifiedHeadsV135(path);
    for (const bad of [
      { ...source, sourceId: ns + ':future-intent', spinBindingV123: { ...source.spinBindingV123, intent: { ...source.spinBindingV123.intent, selectedAtTick: opportunity.evaluationTick + 1 } } },
      { ...source, sourceId: ns + ':duplicate-ref', spinBindingV123: { ...source.spinBindingV123, qualificationReferences: [f.qualificationReference, f.qualificationReference] } },
      { ...source, sourceId: ns + ':bad-hash', spinBindingV123: { ...source.spinBindingV123, qualificationReferences: [{ ...f.qualificationReference, snapshotHash: '0'.repeat(64) }] } },
    ]) { save(bad); throws(() => observed.accept(bad.sourceId)); strictEqual(initialQualifiedHeadsV135(path), before); }
    // A genuinely admitted later appraisal of the SAME real practice. The
    // immutable gameDay10 Actor cannot use its declared day11 qualification.
    const future = { ...f.qualification.source, sourceId: ns + ':future-qualification', acceptedAtDay: 11 };
    const futureOwner = keep(openSqliteSpinControlMasteryV123(path, { readAcceptedMastery: id => id === future.sourceId ? future : null,
      readAcceptedCalibration: id => id === f.qualification.calibration.sourceId ? f.qualification.calibration : null }));
    const futureQualification = futureOwner.accept(future.sourceId);
    const futureDecision = { ...source, sourceId: ns + ':future-qualification-decision', spinBindingV123: { ...source.spinBindingV123,
      qualificationReferences: [reference('world_spin_mastery_v123', futureQualification)] } };
    save(futureDecision); throws(() => observed.accept(futureDecision.sourceId), /day/); strictEqual(initialQualifiedHeadsV135(path), before);
    stage('qualified-decision-start');
    const decision = accept(source); if (decision.kind !== 'observed_initial_decision_v1') throw Error('actual qualified decision missing');
    strictEqual(decision.calculation.status, 'READY'); strictEqual(decision.calculation.commitment?.action, 'SWING');
    if (decision.calculation.algorithm !== 'batting-spin-execution-calculation-v123') throw Error('explicit spin calculation missing');
    strictEqual(decision.calculation.spinMotorPlanV123?.selectedIntent, 'BACKSPIN'); strictEqual(decision.calculation.spinMotorPlanV123?.fallbackReason, null);
    deepStrictEqual(decision.calculation.spinMotorPlanV123?.selectedQualificationRef, { sourceId: f.qualification.source.sourceId, sourceVersion: f.qualification.source.sourceVersion });
    strictEqual(decision.calculation.commitment?.sampledTrajectoryV1?.frames.length, 137);
    const acceptedHeads = initialQualifiedHeadsV135(path); deepStrictEqual(observed.accept(source.sourceId), decision); strictEqual(initialQualifiedHeadsV135(path), acceptedHeads);
    strictEqual(control.readHead(actor.binding.careerId)!.worldRevision, world.worldRevision);
    stage('qualified-decision-ready');
    const prefix: InitialQualifiedPrefixV135 = { version: 'same_database_qualified_initial_prefix_v135', path, genesisPins: genesis.readPins,
      actorReference: reference('physical_plate_appearance_actors', actor), modelReference: declaration.battingModelReference, qualificationReference: f.qualificationReference,
      enrollmentReference: declaration.enrollmentReference, launchReference, initialBatReference: reference(initialBatEquipmentTable, gear), decisionReference: reference(observedInitialOperations, decision) };
    const manifestPath = process.env.BASEBALL_INITIAL_QUALIFIED_MANIFEST_V135 ?? join(dirname(path), 'stage-a-v135.json');
    writeFileSync(manifestPath, json(prefix), { flag: 'wx' }); stage('prefix-manifest-saved:' + manifestPath);
    return { prefix, manifestPath, decision };
  } finally { handles.reverse().forEach(h => h.close()); f.close(); }
}

function initialEmotionV135(path: string,
  view: ReturnType<typeof prepareAuthoredNativeObservedPitchV1>['view'], member: ReturnType<typeof prepareAuthoredNativeObservedPitchV1>['roles'][number]['member'],
  actor: ReturnType<typeof initialQualifiedSpinFixtureV133>['actor'],
  capture: Extract<import('./SqliteObservedInitialPitchStore').ObservedInitialRecord, { kind: 'observed_initial_capture_v1' }>,
  delivery: Extract<import('./SqliteObservedInitialPitchStore').ObservedInitialRecord, { kind: 'observed_initial_delivery_v1' }>,
  opportunity: Extract<import('./SqliteObservedInitialPitchStore').ObservedInitialRecord, { kind: 'observed_initial_opportunity_v1' }>,
  launchReference: InitialQualifiedPrefixV135['launchReference'], keep: <T extends { close(): void }>(h: T) => T,
  save: <T extends { sourceId: string }>(s: T) => T, get: <T>(id: string) => T | null) {
  const genesisOwner = keep(openSqliteBattingEmotionStore(path, { readAcceptedGenesis: get })), emotionOwner = keep(openSqliteBattingEmotionExecutionStore(path, { readAcceptedExecution: get }));
  const control = keep(openSqliteWorldControlStore(path)), careerId = actor.binding.careerId;
  control.initialize({ careerId, worldRevision: 0, control: { schemaVersion: 1, revision: 0, controllerId: ns + ':ai', controlledClubId: null, domainIds: ['BATTING'], manualDomainIds: [] } });
  const provenance = (name: string) => ({ assessmentSourceId: ns + ':' + name, assessmentVersion: version, calibrationSourceId: ns + ':synthetic-neutral-' + name, calibrationVersion: version });
  const policy = { policyId: ns + ':emotion-policy', version, clearAfterCalmEvents: 3, thresholds: EMOTIONS.map(emotion => ({ emotion, activation: .8, sustain: .5 })) };
  const genesisSource: AcceptedBattingEmotionGenesis = save({ sourceId: ns + ':emotion-genesis', sourceVersion: version, capability: 'owned_batting_emotion_genesis_v1',
    viewReference: reference('reserved_pa_execution_views', view), member, policy, provenance: provenance('genesis') });
  const genesis = genesisOwner.acceptGenesis(genesisSource.sourceId); if (genesis.kind !== 'batting_emotion_genesis') throw Error('actual emotion genesis missing');
  const head = requireValue(control.readHead(careerId), 'original World missing'), time = { tick: opportunity.evaluationTick, sequence: opportunity.operationOrdinal };
  const source: AcceptedInitialBattingEmotionExecution = { sourceId: ns + ':emotion-execution', sourceVersion: version, capability: 'owned_initial_batting_emotion_execution_v1',
    executionId: ns + ':emotion-1', viewReference: reference('reserved_pa_execution_views', view), member,
    observationReference: reference(observedInitialOperations, capture), deliveryReference: reference(observedInitialOperations, delivery),
    genesisReference: reference('batting_emotion_v1_geneses', genesis), previousExecutionReference: null, physicalPitchReference: launchReference,
    physicalOperationReference: reference(observedInitialOperations, opportunity), expectedWorld: { careerId, worldRevision: head.worldRevision, controlRevision: head.control.revision, controlHash: hash(head.control) },
    appraisalAssessment: null as unknown as AppraisalInput, baseline: { basis: 'WITHOUT_EMOTION', sourceId: ns + ':baseline', revision: 0,
      swingDecision: { tick: time.tick, earliestTick: time.tick, latestTick: time.tick }, throwIntent: { tick: time.tick, earliestTick: time.tick, latestTick: time.tick },
      defenseReplan: { tick: time.tick, earliestTick: time.tick, latestTick: time.tick }, swingAggression: .5, throwAggression: .5, minimumAdvanceSafetyMarginTicks: 0 },
    executionModel: { modelId: ns + ':execution', version, runningRiskTicksPerUnit: 0, maximumAdvanceSafetyMarginTicks: 1 }, provenance: provenance('execution') };
  const frame = battingEmotionFrame(source, actor, { head, controlJson: JSON.stringify(head.control) }, time);
  const scope = { careerId, matchId: actor.source.gameId, playerId: actor.binding.playerId }, clubId = actor.binding.clubId;
  const game = actor.worldFixture.game, opponentClubId = clubId === game.homeClubId ? game.awayClubId : game.homeClubId;
  const stamp = (name: string) => ({ sourceId: ns + ':' + name, revision: 0, time });
  const zeroEffects = { swingDecisionShiftTicks: 0, throwIntentShiftTicks: 0, defenseReplanShiftTicks: 0, swingAggressionDelta: 0, throwAggressionDelta: 0, runningRiskDelta: 0 };
  const appraisal: AppraisalInput = { importance: { scope, contextId: frame.contextId, time, clubId, opponentClubId,
    competition: { stamp: stamp('competition'), careerId, matchId: scope.matchId, clubId, opponentClubId, competitionId: actor.binding.competitionEditionId,
      kind: 'REGULAR_SEASON', stage: 'LEAGUE', participantCount: 2, remainingGamesAfterMatch: 0,
      win: { rank: 1, opponentRank: 2, champion: false, qualified: false, eliminated: false }, loss: { rank: 2, opponentRank: 1, champion: false, qualified: false, eliminated: false } },
    personal: { stamp: stamp('personal'), scope, clubId, recordStake: 0, returnStake: 0, historyStake: 0, clubIdentification: 0 },
    rivalry: { stamp: stamp('rivalry'), careerId, fromClubId: clubId, toClubId: opponentClubId, intensity: 0 },
    model: { modelId: ns + ':importance', version, maxSourceAgeTicks: 1_000_000, kindLevels: { REGULAR_SEASON: 0, POSTSEASON: 0, INTERNATIONAL: 0 },
      stageLevels: { LEAGUE: 0, GROUP: 0, ROUND: 0, SEMIFINAL: 0, FINAL: 0 }, weights: { stage: 1, standings: 0, championship: 0, qualification: 0, elimination: 0, matchup: 0, urgency: 0, personal: 0 } } },
    appraisalId: ns + ':appraisal', bundleId: ns + ':appraisal-bundle', evidenceEventIds: [delivery.source.sourceId], expectedRevision: 0, policy,
    player: { stamp: stamp('player'), scope, response: { judgment: .5, experience: .5, concentration: .5, stability: .5, confidence: .5, competitiveness: .5, selfFocus: .5, aggression: .5 }, longTermStrain: 0 },
    event: { stamp: { sourceId: delivery.source.sourceId, revision: delivery.operationOrdinal, time: { tick: delivery.evaluationTick, sequence: delivery.operationOrdinal } },
      scope, contextId: frame.contextId, eventId: delivery.source.sourceId, expectedOutcome: 0, perceivedOutcome: 0, tacticalDeviation: 0, localLeverage: 0, recentSuccess: 0, recentFailure: 0, hostility: 0 },
    model: { modelId: ns + ':appraisal-model', version, maxSourceAgeTicks: 1_000_000, importanceGain: 0, impactTickScale: 1,
      rows: EMOTIONS.map(emotion => ({ emotion, bias: 0, situationWeights: Object.fromEntries(SITUATION_AXES.map(k => [k, 0])) as AppraisalInput['model']['rows'][number]['situationWeights'],
        responseWeights: Object.fromEntries(RESPONSE_AXES.map(k => [k, 0])) as AppraisalInput['model']['rows'][number]['responseWeights'], stabilityDamping: 0, effectsAtFullPressure: zeroEffects })) } };
  save({ ...source, appraisalAssessment: appraisal });
  const result = emotionOwner.accept(source.sourceId); if (result.kind !== 'batting_emotion_execution') throw Error('actual initial emotion missing');
  strictEqual(control.readHead(careerId)!.worldRevision, 1);
  return result;
}

/** Manifest is only a locator/pin set. Every returned record comes from actual
 * Owners after reopen; raw manifest data never impersonates a Native proof. */
export function readInitialQualifiedDecisionV135(manifestPath: string) {
  const prefix = JSON.parse(readFileSync(manifestPath, 'utf8')) as InitialQualifiedPrefixV135;
  strictEqual(prefix.version, 'same_database_qualified_initial_prefix_v135');
  const genesis = readAuthoredNativeMatchV1(prefix.path, prefix.genesisPins);
  deepStrictEqual(reference('physical_plate_appearance_actors', genesis.actor), prefix.actorReference);
  const owner = openSqliteObservedInitialPitchStore(prefix.path);
  try {
    const decision = requireValue(owner.read(prefix.decisionReference.sourceId), 'original decision missing');
    if (decision.kind !== 'observed_initial_decision_v1') throw Error('original decision kind differs');
    deepStrictEqual(reference(observedInitialOperations, decision), prefix.decisionReference);
    return { prefix, genesis, decision };
  } finally { owner.close(); }
}
