import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { type PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { battingCapabilityValuesInput, battingRepertoireValuesInput, battingDecisionValuesInput, battingObservationValuesInput } from './PlayerBattingExecutionCalibration';
import { sampleBatRadius, sampleBatEffectiveMass } from '../../core/sim/contact/RigidBatBallContact';
import { validateBaseballAerodynamicCoefficientProfile } from '../../core/sim/ball/BaseballAerodynamicCoefficientProfile';
import { validateBaseballSpinDecayParameters } from '../../core/sim/ball/BaseballSpinDecay';
import type { AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import type { BattingSource } from '../../core/world/psychology/batting/BattingTypes';
import { bodySourceId as id, bodySourceDay as day, bodySourceFields as fields, validBodySourceRef,
  type BodySourceRef, type BodyMaterializationReceipt } from './PlayerBodyCapabilityMaterialization';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';

type Scope = Readonly<{ careerId: string; playerId: string; personId: string; personLinkSourceId: string }>;
type Parameter<T> = BodySourceRef & Scope & Readonly<{ acceptedAtDay: number; values: T }>;
export type AcceptedBattingCapability = Parameter<Pick<BattingSource,
  'motorLatencyTicks' | 'technicalTimingOffsetTicks' | 'maximumSweetSpotSpeedMps'>>;
export type AcceptedBattingRepertoire = Parameter<Pick<BattingSource, 'repertoireId' | 'repertoireVersion' | 'profiles'>>;
export type AcceptedBattingDecisionModel = Parameter<BattingSource['decisionModel']>;
export type AcceptedBattingEquipment = Parameter<Pick<BattingSource, 'batPhysical' | 'ball'>>;
export type AcceptedBattingObservationCalibration = Parameter<Readonly<{
  calibration: PlayerObservationCalibration; deliveryLatencyTicks: number;
}>>;
export type AcceptedBattingPredictionCalibration = Parameter<Readonly<{
  algorithm: 'observed_motion_with_pinned_aerodynamic_priors_v1'; horizonTicks: number;
  observerKnownSpinPrior: Readonly<{ x: number; y: number; z: number }>;
  parameters: AerodynamicPitchTrajectory['parameters'];
}>>;
/** An explicit accepted reassessment, never an exposure-to-ability formula.
 * Assessment/calibration identifiers are accepted provenance, not measurements
 * produced by this owner. Original owners authenticate both evidence pins. */
export type AcceptedBattingDevelopmentProvenance = Readonly<{
  kind: 'accepted_batting_capability_development_v1';
  originalModelRef: BodySourceRef; originalModelSourceHash: string; originalModelSnapshotHash: string;
  exposureRef: BodySourceRef; exposureSourceHash: string; exposureSnapshotHash: string;
  assessmentRef: BodySourceRef; calibrationRef: BodySourceRef; replacementCapabilityHash: string;
}>;
export type AcceptedPlayerBattingModelV1 = BodySourceRef & Scope & Readonly<{
  acceptedAtDay: number; bodyMaterializationRef: BodySourceRef; bodyRef: BodySourceRef; poseRef: BodySourceRef;
  capabilityRef: BodySourceRef; repertoireRef: BodySourceRef; decisionModelRef: BodySourceRef;
  equipmentRef: BodySourceRef; observationCalibrationRef: BodySourceRef; predictionCalibrationRef: BodySourceRef;
  developmentProvenance?: AcceptedBattingDevelopmentProvenance;
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
export const battingModelParameterKeys = ['capability', 'repertoire', 'decisionModel', 'equipment',
  'observationCalibration', 'predictionCalibration'] as const;
export type BattingModelParameters = Pick<DurablePlayerBattingModelV1, typeof battingModelParameterKeys[number]>;
const scopeFields = ['careerId', 'playerId', 'personId', 'personLinkSourceId'] as const;
const parameterFields = ['sourceId', 'sourceVersion', ...scopeFields, 'acceptedAtDay', 'values'];
const referenceKeys = ['bodyMaterializationRef', 'bodyRef', 'poseRef', 'capabilityRef', 'repertoireRef',
  'decisionModelRef', 'equipmentRef', 'observationCalibrationRef', 'predictionCalibrationRef'] as const;
const requireFields = (value: unknown, required: readonly string[], optional: readonly string[] = []): void => {
  const present = value !== null && typeof value === 'object' ? optional.filter(key => Object.hasOwn(value, key)) : [];
  if (!fields(value, [...required, ...present])) throw new Error('invalid accepted batting model fields');
};
const positive = (value: number): boolean => Number.isFinite(value) && value > 0;
const positiveTick = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const unit = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
const vector = (value: Readonly<{ x: number; y: number; z: number }>): void => {
  requireFields(value, ['x', 'y', 'z']);
  if (![value.x, value.y, value.z].every(Number.isFinite)) throw new Error('invalid accepted batting vector');
};

export const battingModelSourceInput = (raw: AcceptedPlayerBattingModelV1, sourceId: string): AcceptedPlayerBattingModelV1 => {
  const source = cloneInert(raw);
  requireFields(source, ['sourceId', 'sourceVersion', ...scopeFields, 'acceptedAtDay', ...referenceKeys], ['developmentProvenance']);
  if (source.sourceId !== sourceId || ![source.sourceId, source.sourceVersion, ...scopeFields.map(key => source[key])].every(id)
    || !day(source.acceptedAtDay) || !referenceKeys.every(key => validBodySourceRef(source[key]))) {
    throw new Error('invalid accepted Player batting model Source');
  }
  if (Object.hasOwn(source, 'developmentProvenance')) {
    const p = source.developmentProvenance;
    requireFields(p, ['kind', 'originalModelRef', 'originalModelSourceHash', 'originalModelSnapshotHash',
      'exposureRef', 'exposureSourceHash', 'exposureSnapshotHash', 'assessmentRef', 'calibrationRef', 'replacementCapabilityHash']);
    if (!p || p.kind !== 'accepted_batting_capability_development_v1'
      || ![p.originalModelRef, p.exposureRef, p.assessmentRef, p.calibrationRef].every(validBodySourceRef)
      || p.originalModelRef.sourceId === source.sourceId
      || ![p.originalModelSourceHash, p.originalModelSnapshotHash, p.exposureSourceHash,
        p.exposureSnapshotHash, p.replacementCapabilityHash].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))) {
      throw new Error('invalid accepted batting development provenance');
    }
  }
  return source;
};

/** Only explicit calibration inputs: this validates no observation, trajectory, emotion or completed swing. */
export const battingModelParametersInput = (raw: BattingModelParameters, source: AcceptedPlayerBattingModelV1): BattingModelParameters => {
  const values = cloneInert(raw);
  requireFields(values, battingModelParameterKeys);
  for (const key of battingModelParameterKeys) {
    const parameter = values[key], refKey = `${key}Ref` as const, pin = source[refKey];
    requireFields(parameter, parameterFields);
    if (!id(parameter.sourceId) || !id(parameter.sourceVersion) || parameter.sourceId !== pin.sourceId
      || parameter.sourceVersion !== pin.sourceVersion || !scopeFields.every(field => parameter[field] === source[field])
      || !day(parameter.acceptedAtDay) || parameter.acceptedAtDay > source.acceptedAtDay) {
      throw new Error('accepted batting parameter scope, version or day differs');
    }
  }
  battingCapabilityValuesInput(values.capability.values);

  battingRepertoireValuesInput(values.repertoire.values);

  battingDecisionValuesInput(values.decisionModel.values);

  const equipment = values.equipment.values;
  requireFields(equipment, ['batPhysical', 'ball']);
  const bat = equipment.batPhysical, ball = equipment.ball;
  requireFields(bat, ['massKg', 'centerOfMassT', 'transverseMomentOfInertiaKgM2', 'axialMomentOfInertiaKgM2', 'radiusProfile'], ['normalEffectiveMassProfile']);
  requireFields(ball, ['massKg', 'radiusM', 'rotationalInertiaFactor']);
  if (![bat.massKg, bat.transverseMomentOfInertiaKgM2, bat.axialMomentOfInertiaKgM2, ball.massKg, ball.radiusM, ball.rotationalInertiaFactor].every(positive)
    || !unit(bat.centerOfMassT)) throw new Error('invalid accepted batting equipment');
  requireFields(bat.radiusProfile, ['knots']);
  if (!Array.isArray(bat.radiusProfile.knots)) throw new Error('invalid accepted bat radius profile');
  bat.radiusProfile.knots.forEach(knot => requireFields(knot, ['t', 'radiusM']));
  sampleBatRadius(bat.radiusProfile, 0.5);
  if (Object.hasOwn(bat, 'normalEffectiveMassProfile')) {
    requireFields(bat.normalEffectiveMassProfile, ['knots']);
    if (!Array.isArray(bat.normalEffectiveMassProfile!.knots)) throw new Error('invalid accepted bat effective mass profile');
    bat.normalEffectiveMassProfile!.knots.forEach(knot => requireFields(knot, ['t', 'effectiveMassKg']));
    sampleBatEffectiveMass(bat.normalEffectiveMassProfile!, 0.5);
  }
  battingObservationValuesInput(values.observationCalibration.values);

  const prediction = values.predictionCalibration.values;
  requireFields(prediction, ['algorithm', 'horizonTicks', 'observerKnownSpinPrior', 'parameters']); vector(prediction.observerKnownSpinPrior);
  if (prediction.algorithm !== 'observed_motion_with_pinned_aerodynamic_priors_v1' || !positiveTick(prediction.horizonTicks)) {
    throw new Error('invalid accepted batting prediction calibration');
  }
  const parameters = prediction.parameters;
  requireFields(parameters, ['ticksPerSecond', 'integrationStepTicks', 'gravityY', 'aerodynamics']);
  if (!positiveTick(parameters.ticksPerSecond) || !positiveTick(parameters.integrationStepTicks) || !Number.isFinite(parameters.gravityY)) {
    throw new Error('invalid accepted batting prediction clock');
  }
  const aero = parameters.aerodynamics;
  requireFields(aero, ['ballMassKg', 'ballRadiusM', 'airDensityKgM3', 'windVelocityMps', 'dragCoefficient'],
    ['coefficientProfile', 'airKinematicViscosityM2PerSecond', 'spinDecay']); vector(aero.windVelocityMps);
  if (!positive(aero.ballMassKg) || !positive(aero.ballRadiusM) || !Number.isFinite(aero.airDensityKgM3) || aero.airDensityKgM3 < 0
    || !Number.isFinite(aero.dragCoefficient) || aero.dragCoefficient < 0 || aero.ballMassKg !== ball.massKg || aero.ballRadiusM !== ball.radiusM) {
    throw new Error('invalid accepted batting aerodynamic equipment identity');
  }
  if (Object.hasOwn(aero, 'airKinematicViscosityM2PerSecond') && !positive(aero.airKinematicViscosityM2PerSecond!)) {
    throw new Error('explicit accepted aerodynamic viscosity must be finite and positive');
  }
  if (Object.hasOwn(aero, 'spinDecay')) {
    requireFields(aero.spinDecay, ['referenceSpeedMps', 'timeConstantSecondsAtReferenceSpeed']);
    validateBaseballSpinDecayParameters(aero.spinDecay!);
  }
  if (Object.hasOwn(aero, 'coefficientProfile')) {
    const profile = aero.coefficientProfile!;
    requireFields(profile, ['profileId', 'version', 'referenceReynoldsNumber', 'spinKnots', 'reynoldsKnots',
      'reynoldsCorrectionFullThroughSpinFactor', 'reynoldsCorrectionZeroAtSpinFactor']);
    if (!id(profile.profileId) || !id(profile.version) || !Array.isArray(profile.spinKnots) || !Array.isArray(profile.reynoldsKnots)) {
      throw new Error('invalid accepted batting aerodynamic coefficient profile');
    }
    profile.spinKnots.forEach(knot => requireFields(knot, ['spinFactor', 'dragCoefficientAtReferenceRe', 'liftCoefficient']));
    profile.reynoldsKnots.forEach(knot => requireFields(knot, ['reynoldsNumber', 'dragCorrectionFactorAtLowSpin']));
    validateBaseballAerodynamicCoefficientProfile(profile);
    if (!positive(aero.airKinematicViscosityM2PerSecond!)) throw new Error('accepted aerodynamic coefficient profile requires positive viscosity');
  }
  return values;
};
