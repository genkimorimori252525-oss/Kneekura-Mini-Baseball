export type ObservationQualityInput = Readonly<{
  fovQuality: number;
  distanceQuality: number;
  relativeSpeedQuality: number;
  occlusionVisibility: number;
  attentionQuality: number;
  observationDurationSeconds: number;
  perceptionAbility: number;
}>;

export type ObservationQualityWeights = Readonly<{
  distance: number;
  relativeSpeed: number;
  attention: number;
  duration: number;
  ability: number;
}>;

export type ObservationQualityParameters = Readonly<{
  instantaneousDurationQuality: number;
  fullQualityObservationDurationSeconds: number;
  minimumAbilityQuality: number;
  weights: ObservationQualityWeights;
}>;

export type ObservationQualityResult = Readonly<{
  fovQuality: number;
  distanceQuality: number;
  relativeSpeedQuality: number;
  occlusionVisibility: number;
  attentionQuality: number;
  durationQuality: number;
  abilityQuality: number;
  visibilityQuality: number;
  fidelityQuality: number;
  totalQuality: number;
}>;

const validateUnit = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be finite and within [0, 1]`);
  }
};

const validateParameters = (parameters: ObservationQualityParameters): number => {
  validateUnit(
    'instantaneousDurationQuality',
    parameters.instantaneousDurationQuality,
  );
  validateUnit('minimumAbilityQuality', parameters.minimumAbilityQuality);
  if (
    !Number.isFinite(parameters.fullQualityObservationDurationSeconds)
    || parameters.fullQualityObservationDurationSeconds <= 0
  ) {
    throw new Error(
      'fullQualityObservationDurationSeconds must be finite and positive',
    );
  }

  const weights = parameters.weights;
  for (const [name, value] of Object.entries(weights)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`observation quality weight ${name} must be finite and non-negative`);
    }
  }

  const totalWeight = (
    weights.distance
    + weights.relativeSpeed
    + weights.attention
    + weights.duration
    + weights.ability
  );
  if (totalWeight <= 0) {
    throw new Error('observation quality weights must have a positive total');
  }
  return totalWeight;
};

export const composeObservationQuality = (
  input: ObservationQualityInput,
  parameters: ObservationQualityParameters,
): ObservationQualityResult => {
  validateUnit('fovQuality', input.fovQuality);
  validateUnit('distanceQuality', input.distanceQuality);
  validateUnit('relativeSpeedQuality', input.relativeSpeedQuality);
  validateUnit('occlusionVisibility', input.occlusionVisibility);
  validateUnit('attentionQuality', input.attentionQuality);
  validateUnit('perceptionAbility', input.perceptionAbility);
  if (
    !Number.isFinite(input.observationDurationSeconds)
    || input.observationDurationSeconds < 0
  ) {
    throw new Error('observationDurationSeconds must be finite and non-negative');
  }

  const totalWeight = validateParameters(parameters);
  const durationProgress = Math.min(
    1,
    input.observationDurationSeconds
      / parameters.fullQualityObservationDurationSeconds,
  );
  const durationQuality = (
    parameters.instantaneousDurationQuality
    + (1 - parameters.instantaneousDurationQuality) * durationProgress
  );
  const abilityQuality = (
    parameters.minimumAbilityQuality
    + (1 - parameters.minimumAbilityQuality) * input.perceptionAbility
  );

  const fidelityQuality = (
    input.distanceQuality * parameters.weights.distance
    + input.relativeSpeedQuality * parameters.weights.relativeSpeed
    + input.attentionQuality * parameters.weights.attention
    + durationQuality * parameters.weights.duration
    + abilityQuality * parameters.weights.ability
  ) / totalWeight;

  const visibilityQuality = input.fovQuality * input.occlusionVisibility;

  return {
    fovQuality: input.fovQuality,
    distanceQuality: input.distanceQuality,
    relativeSpeedQuality: input.relativeSpeedQuality,
    occlusionVisibility: input.occlusionVisibility,
    attentionQuality: input.attentionQuality,
    durationQuality,
    abilityQuality,
    visibilityQuality,
    fidelityQuality,
    totalQuality: visibilityQuality * fidelityQuality,
  };
};
