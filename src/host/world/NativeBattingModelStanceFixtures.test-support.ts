import { expect } from 'vitest';
import * as runtime from './PlayerMaterializationRuntime';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { BodySourceRef, BodyMaterializationReceipt, AcceptedBodySource, AcceptedPoseSource,
  AcceptedReachSource, BodyMaterializationRequest } from './PlayerBodyCapabilityMaterialization';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import type { BattingSource } from '../../core/world/psychology/batting/BattingTypes';
import type { PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import type { AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY } from '../../core/sim/contact/RigidBatBallContact';

// Proposed owner contracts only. No new production module, store implementation,
// prediction, sensing result or emotion receipt is manufactured by this fixture.
type Scope = Readonly<{ careerId: string; playerId: string; personId: string; personLinkSourceId: string }>;
type AcceptedParameter<T> = BodySourceRef & Scope & Readonly<{ acceptedAtDay: number; values: T }>;
export type AcceptedBattingCapability = AcceptedParameter<Pick<BattingSource,
  'motorLatencyTicks' | 'technicalTimingOffsetTicks' | 'maximumSweetSpotSpeedMps'>>;
export type AcceptedBattingRepertoire = AcceptedParameter<Pick<BattingSource, 'repertoireId' | 'repertoireVersion' | 'profiles'>>;
export type AcceptedBattingDecisionModel = AcceptedParameter<BattingSource['decisionModel']>;
export type AcceptedBattingEquipment = AcceptedParameter<Pick<BattingSource, 'batPhysical' | 'ball'>>;
export type AcceptedBattingObservationCalibration = AcceptedParameter<Readonly<{
  calibration: PlayerObservationCalibration; deliveryLatencyTicks: number;
}>>;
export type AcceptedBattingPredictionCalibration = AcceptedParameter<Readonly<{
  algorithm: 'observed_motion_with_pinned_aerodynamic_priors_v1'; horizonTicks: number;
  observerKnownSpinPrior: Readonly<{ x: number; y: number; z: number }>;
  parameters: AerodynamicPitchTrajectory['parameters'];
}>>;
export type AcceptedPlayerBattingModelV1 = BodySourceRef & Scope & Readonly<{
  acceptedAtDay: number; bodyMaterializationRef: BodySourceRef; bodyRef: BodySourceRef; poseRef: BodySourceRef;
  capabilityRef: BodySourceRef; repertoireRef: BodySourceRef; decisionModelRef: BodySourceRef;
  equipmentRef: BodySourceRef; observationCalibrationRef: BodySourceRef; predictionCalibrationRef: BodySourceRef;
}>;
export type DurablePlayerBattingModelV1 = Readonly<{
  source: AcceptedPlayerBattingModelV1; person: DurablePlayerPersonLink; bodyMaterialization: BodyMaterializationReceipt;
  capability: AcceptedBattingCapability; repertoire: AcceptedBattingRepertoire; decisionModel: AcceptedBattingDecisionModel;
  equipment: AcceptedBattingEquipment; observationCalibration: AcceptedBattingObservationCalibration;
  predictionCalibration: AcceptedBattingPredictionCalibration;
}>;
export type BattingModelAuthority = Readonly<{
  readAcceptedModel(id: string): AcceptedPlayerBattingModelV1 | null;
  readAcceptedCapability(id: string): AcceptedBattingCapability | null;
  readAcceptedRepertoire(id: string): AcceptedBattingRepertoire | null;
  readAcceptedDecisionModel(id: string): AcceptedBattingDecisionModel | null;
  readAcceptedEquipment(id: string): AcceptedBattingEquipment | null;
  readAcceptedObservationCalibration(id: string): AcceptedBattingObservationCalibration | null;
  readAcceptedPredictionCalibration(id: string): AcceptedBattingPredictionCalibration | null;
}>;
export type BattingModelStore = Readonly<{
  accept(id: string): DurablePlayerBattingModelV1;
  read(id: string): DurablePlayerBattingModelV1 | null;
  selectAtDay(careerId: string, playerId: string, atDay: number): DurablePlayerBattingModelV1;
  close(): void;
}>;
export type AcceptedBattingStanceV1 = BodySourceRef & Scope & Readonly<{
  acceptedAtDay: number; gameId: string; fixtureEventId: string; playId: number;
  physicalActorSourceId: string; modelRef: BodySourceRef; initialWorldSourceId: string;
  startedAtTick: number; ticksPerSecond: number; handedness: BattingSource['handedness'];
  centerOfMass: BattingSource['centerOfMass']; eyePosition: BattingSource['centerOfMass'];
  bodyReadyTick: number; latestMotorStartTick: number; validUntilTick: number;
  plateZ: number; strikeZone: BattingSource['strikeZone'];
}>;
export type DurableBattingStanceV1 = Readonly<{
  source: AcceptedBattingStanceV1; model: DurablePlayerBattingModelV1; actor: DurablePhysicalPlateAppearanceActor;
  physicalState: Readonly<{ startTick: number; centerOfMass: BattingSource['centerOfMass']; eyePosition: BattingSource['centerOfMass'] }>;
}>;
export type BattingStanceStore = Readonly<{
  accept(id: string): DurableBattingStanceV1; read(id: string): DurableBattingStanceV1 | null; close(): void;
}>;
type OpenModel = (path: string, authority?: BattingModelAuthority) => BattingModelStore;
type OpenStance = (path: string, authority?: Readonly<{ readAcceptedStance(id: string): AcceptedBattingStanceV1 | null }>) => BattingStanceStore;
export const ref = (s: BodySourceRef): BodySourceRef => ({ sourceId: s.sourceId, sourceVersion: s.sourceVersion });

/** This is the existing real body owner in the registered batter's own database.
 * Its combined gate must pass before these tests are eligible to establish batting RED. */
export const registeredBatterBodyFixture = (materializationDay?: number, profile?: Parameters<typeof physicalPlateAppearanceActorFixture>[2]) => {
  const x = physicalPlateAppearanceActorFixture(undefined, undefined, profile);
  try {
    const actor = x.actors.accept(x.source.sourceId), person = actor.person;
    const scope: Scope = { careerId: person.careerId, playerId: person.playerId,
      personId: person.personId, personLinkSourceId: person.sourceId };
    const day = actor.binding.gameDay, parameterDay = materializationDay ?? day;
    const body: AcceptedBodySource = { sourceId: 'batting-body', sourceVersion: 'test-measurements-v1', ...scope,
      acceptedAtDay: parameterDay, physicalProfile: { heightMeters: 1.8 }, displayLabel: 'explicit test body' };
    const pose: AcceptedPoseSource = { sourceId: 'batting-pose', sourceVersion: 'test-pose-v1', ...scope,
      acceptedAtDay: parameterDay, bodyRef: ref(body), primitives: [
        { role: 'body', radius: 0.2, offset: { x: 0, y: 0, z: 0 } },
        { role: 'glove', radius: 0.08, offset: { x: 0.3, y: 0.15, z: 0.1 } },
        { role: 'tag_hand', radius: 0.06, offset: { x: -0.3, y: 0.1, z: 0.1 } },
        { role: 'left_foot', radius: 0.07, offset: { x: -0.1, y: -0.88, z: 0 } },
        { role: 'right_foot', radius: 0.07, offset: { x: 0.1, y: -0.88, z: 0 } },
      ] };
    const reach: AcceptedReachSource = { sourceId: 'batting-reach', sourceVersion: 'test-reach-v1', acceptedAtDay: parameterDay,
      baseline: { bodyOriginHeightMeters: 0.95, maximumLegReachMeters: 1.5, maximumGloveReachMeters: 1.3, maximumTagReachMeters: 1.1 } };
    const request: BodyMaterializationRequest = { sourceId: 'batting-body-materialization', sourceVersion: 'body-composition-v1', ...scope,
      atDay: parameterDay, role: 'batter', bodyRef: ref(body), poseRef: ref(pose), reachCalibrationRef: ref(reach),
      fieldingModelRef: null, releaseGeometryRef: null };
    const requests = new Map([[request.sourceId, request]]), bodies = new Map([[body.sourceId, body]]), poses = new Map([[pose.sourceId, pose]]);
    const materializations = x.f.track(runtime.openSqlitePlayerBodyCapabilityMaterializationStore(x.f.path, {
      readAcceptedMaterialization: id => requests.get(id) ?? null,
      readAcceptedBody: id => bodies.get(id) ?? null, readAcceptedPose: id => poses.get(id) ?? null,
      readAcceptedReachCalibration: id => id === reach.sourceId ? reach : null,
    }));
    const result = materializations.accept(request.sourceId);
    expect(result.kind, 'BODY_PREREQUISITE: registered batter body must materialize before batting-owner assertions').toBe('materialized');
    if (result.kind !== 'materialized') throw new Error('BODY_PREREQUISITE: actual body receipt is pending');
    const receipt = result.value;
    expect(receipt.source).toEqual(request);
    expect(receipt.person).toEqual(person);
    expect(receipt.actor.playerId).toBe('away-1');
    expect(receipt.actor.personId).toBe('person-away-1');
    expect(receipt.source.atDay).toBe(parameterDay);
    expect(receipt.source.atDay).toBeLessThanOrEqual(actor.binding.gameDay);
    expect(receipt.fieldingModel).toBeNull();
    expect(receipt.releaseGeometry).toBeNull();
    expect(materializations.read(request.sourceId)).toEqual(receipt);
    expect(x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions').all()).toEqual([]);
    return { x, actor, person, scope, day, parameterDay, body, pose, reach, request, receipt, requests, bodies, poses, materializations,
      close: () => x.f.close() };
  } catch (error) { x.f.close(); throw error; }
};

export const battingModelStanceFixture = (options: Readonly<{ modelDay?: number; profile?: Parameters<typeof physicalPlateAppearanceActorFixture>[2] }> = {}) => {
  const f = registeredBatterBodyFixture(options.modelDay, options.profile);
  try {
    const exports = runtime as unknown as { openSqlitePlayerBattingModelStore?: OpenModel; openSqliteBattingStanceStore?: OpenStance };
    expect(typeof exports.openSqlitePlayerBattingModelStore,
      'BATTING_MODEL_OWNER_MISSING: real body prerequisite succeeded; Native model composition is required').toBe('function');
    const openModel = exports.openSqlitePlayerBattingModelStore!;
    // Each number is an explicit synthetic accepted Source input for this test.
    // No generated Player default, observed pitch or emotion fixture is used.
    const common = { ...f.scope, acceptedAtDay: f.parameterDay };
    const capability: AcceptedBattingCapability = { sourceId: 'batting-capability', sourceVersion: 'test-motor-v1', ...common,
      values: { motorLatencyTicks: 20_000, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 } };
    const repertoire: AcceptedBattingRepertoire = { sourceId: 'batting-repertoire', sourceVersion: 'test-repertoire-v1', ...common,
      values: { repertoireId: 'explicit-test-repertoire', repertoireVersion: 'v1', profiles: [{ minimumAggression: 0, profile: {
        profileId: 'explicit-test-course', version: 'v1', batLengthM: 0.84, sweetSpotT: 0.72,
        centerContactDepthM: 20.1 * 0.0254, contactDepthPopulationStdDevM: 7.2 * 0.0254,
        insideOutsideDepthGainM: 0.075, heightDepthGainM: 0.035,
        baseContactSweetSpotSpeedMps: 31, contactDepthSpeedGainMpsPerM: 4, basePreContactSeconds: 0.165,
        insideOutsideTimingGainSeconds: 0.01, heightTimingGainSeconds: 0.004, followThroughSeconds: 0.135,
        highAttackAngleDeg: 7, middleAttackAngleDeg: 9, lowAttackAngleDeg: 16,
        courseAttackDirectionGainDeg: 6, nominalContactSurfaceDistanceM: 0.0696,
      } }] } };
    const decision: AcceptedBattingDecisionModel = { sourceId: 'batting-decision', sourceVersion: 'test-decision-v1', ...common,
      values: { modelId: 'explicit-test-decision', version: 'v1', threshold: 0.5, aggressionWeight: 0.5 } };
    const equipment: AcceptedBattingEquipment = { sourceId: 'batting-equipment', sourceVersion: 'test-equipment-v1', ...common,
      values: { batPhysical: { massKg: 0.9, centerOfMassT: 0.58, transverseMomentOfInertiaKgM2: 0.055,
        axialMomentOfInertiaKgM2: 0.0005, radiusProfile: { knots: [{ t: 0, radiusM: 0.025 }, { t: 0.55, radiusM: 0.031 }, { t: 1, radiusM: 0.033 }] } },
        ball: REALISTIC_BASEBALL_RIGID_BODY } };
    const calibration = playerObservationCalibrationFixture();
    const observation: AcceptedBattingObservationCalibration = { sourceId: 'batting-sensor-calibration', sourceVersion: 'test-sensor-v1', ...common,
      values: { calibration: { ...calibration, memoryDecayParameters: { ...calibration.memoryDecayParameters, ticksPerSecond: 1_000_000 } },
        deliveryLatencyTicks: 10_000 } };
    const prediction: AcceptedBattingPredictionCalibration = { sourceId: 'batting-prediction-prior', sourceVersion: 'test-prior-v1', ...common,
      values: { algorithm: 'observed_motion_with_pinned_aerodynamic_priors_v1', horizonTicks: 800_000,
        observerKnownSpinPrior: { x: 0, y: 0, z: 0 }, parameters: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000,
          gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS } } };
    const source: AcceptedPlayerBattingModelV1 = { sourceId: 'batting-model', sourceVersion: 'native-batting-model-v1', ...common,
      bodyMaterializationRef: ref(f.receipt.source), bodyRef: ref(f.receipt.body), poseRef: ref(f.receipt.pose),
      capabilityRef: ref(capability), repertoireRef: ref(repertoire), decisionModelRef: ref(decision), equipmentRef: ref(equipment),
      observationCalibrationRef: ref(observation), predictionCalibrationRef: ref(prediction) };
    const models = new Map([[source.sourceId, source]]), capabilities = new Map([[capability.sourceId, capability]]),
      repertoires = new Map([[repertoire.sourceId, repertoire]]), decisions = new Map([[decision.sourceId, decision]]),
      equipments = new Map([[equipment.sourceId, equipment]]), observations = new Map([[observation.sourceId, observation]]),
      predictions = new Map([[prediction.sourceId, prediction]]);
    const authority: BattingModelAuthority = {
      readAcceptedModel: id => models.get(id) ?? null, readAcceptedCapability: id => capabilities.get(id) ?? null,
      readAcceptedRepertoire: id => repertoires.get(id) ?? null, readAcceptedDecisionModel: id => decisions.get(id) ?? null,
      readAcceptedEquipment: id => equipments.get(id) ?? null, readAcceptedObservationCalibration: id => observations.get(id) ?? null,
      readAcceptedPredictionCalibration: id => predictions.get(id) ?? null,
    };
    const modelStore = f.x.f.track(openModel(f.x.f.path, authority));
    const stance: AcceptedBattingStanceV1 = { sourceId: 'batting-stance', sourceVersion: 'native-batting-stance-v1', ...common, acceptedAtDay: f.day,
      gameId: f.actor.source.gameId, fixtureEventId: f.actor.binding.fixtureEventId, playId: f.actor.match.playId,
      physicalActorSourceId: f.actor.source.sourceId, modelRef: ref(source), initialWorldSourceId: 'initial-world',
      startedAtTick: f.actor.world.tick, ticksPerSecond: 1_000_000, handedness: 'R',
      centerOfMass: { x: -0.78, y: 1, z: -0.16 }, eyePosition: { x: -0.78, y: 1.6, z: -0.16 },
      bodyReadyTick: 100_000, latestMotorStartTick: 500_000, validUntilTick: 600_000,
      plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2159, lowerY: 0.5, upperY: 1.1 } };
    const stances = new Map([[stance.sourceId, stance]]);
    const openStance = (): OpenStance => {
      expect(typeof exports.openSqliteBattingStanceStore,
        'BATTING_STANCE_OWNER_MISSING: accepted model prerequisite must precede prospective stance ownership').toBe('function');
      return exports.openSqliteBattingStanceStore!;
    };
    return { ...f, source, capability, repertoire, decision, equipment, observation, prediction, authority,
      models, capabilities, repertoires, decisions, equipments, observations, predictions, modelStore, openModel,
      stance, stances, openStance,
      stanceStore: () => f.x.f.track(openStance()(f.x.f.path, { readAcceptedStance: id => stances.get(id) ?? null })) };
  } catch (error) { f.close(); throw error; }
};
export type BattingModelFixture = ReturnType<typeof battingModelStanceFixture>;
export const modelRows = (f: BattingModelFixture) => f.x.f.db.prepare('SELECT * FROM world_player_batting_models ORDER BY source_id').all();
export const stanceRows = (f: BattingModelFixture) => f.x.f.db.prepare('SELECT * FROM world_batting_stances ORDER BY source_id').all();
export const originalRows = (f: ReturnType<typeof registeredBatterBodyFixture>) => Object.fromEntries([
  'world_player_person_links', 'world_roster_heads', 'world_season_heads', 'matches', 'official_fixtures',
  'official_participant_bindings', 'official_initial_world_sources', 'physical_plate_appearance_actor_games',
  'physical_plate_appearance_actors', 'world_player_body_materializations', 'physical_pitch_progress_actions', 'physical_pitch_progress_heads',
].map(table => [table, f.x.f.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
export const unchangedOriginal = (f: ReturnType<typeof registeredBatterBodyFixture>, before: ReturnType<typeof originalRows>) =>
  expect(json(originalRows(f))).toBe(json(before));
