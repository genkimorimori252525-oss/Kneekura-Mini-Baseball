import { describe, expect, it } from 'vitest';
import {
  composeObservationQuality,
  type ObservationQualityParameters,
} from './ObservationQuality';

const parameters: ObservationQualityParameters = {
  instantaneousDurationQuality: 0.25,
  fullQualityObservationDurationSeconds: 0.4,
  minimumAbilityQuality: 0.2,
  weights: {
    distance: 1,
    relativeSpeed: 1,
    attention: 1,
    duration: 1,
    ability: 1,
  },
};

describe('composeObservationQuality', () => {
  it('keeps causal visibility separate from measurement fidelity', () => {
    const result = composeObservationQuality({
      fovQuality: 0.8,
      distanceQuality: 0.6,
      relativeSpeedQuality: 0.8,
      occlusionVisibility: 0.5,
      attentionQuality: 1,
      observationDurationSeconds: 0.2,
      perceptionAbility: 0.5,
    }, parameters);

    expect(result.visibilityQuality).toBeCloseTo(0.4, 12);
    expect(result.durationQuality).toBeCloseTo(0.625, 12);
    expect(result.abilityQuality).toBeCloseTo(0.6, 12);
    expect(result.fidelityQuality).toBeCloseTo(0.725, 12);
    expect(result.totalQuality).toBeCloseTo(0.29, 12);
  });

  it('makes complete occlusion a hard visibility gate', () => {
    const result = composeObservationQuality({
      fovQuality: 1,
      distanceQuality: 1,
      relativeSpeedQuality: 1,
      occlusionVisibility: 0,
      attentionQuality: 1,
      observationDurationSeconds: 1,
      perceptionAbility: 1,
    }, parameters);

    expect(result.fidelityQuality).toBe(1);
    expect(result.totalQuality).toBe(0);
  });

  it('makes outside-FOV visibility zero without erasing diagnostic fidelity factors', () => {
    const result = composeObservationQuality({
      fovQuality: 0,
      distanceQuality: 0.9,
      relativeSpeedQuality: 0.8,
      occlusionVisibility: 1,
      attentionQuality: 0.7,
      observationDurationSeconds: 0.4,
      perceptionAbility: 0.9,
    }, parameters);

    expect(result.visibilityQuality).toBe(0);
    expect(result.fidelityQuality).toBeGreaterThan(0);
    expect(result.totalQuality).toBe(0);
  });

  it('maps perception ability through an explicit non-blind floor', () => {
    const low = composeObservationQuality({
      fovQuality: 1,
      distanceQuality: 1,
      relativeSpeedQuality: 1,
      occlusionVisibility: 1,
      attentionQuality: 1,
      observationDurationSeconds: 0.4,
      perceptionAbility: 0,
    }, parameters);
    const high = composeObservationQuality({
      fovQuality: 1,
      distanceQuality: 1,
      relativeSpeedQuality: 1,
      occlusionVisibility: 1,
      attentionQuality: 1,
      observationDurationSeconds: 0.4,
      perceptionAbility: 1,
    }, parameters);

    expect(low.abilityQuality).toBe(0.2);
    expect(high.abilityQuality).toBe(1);
    expect(low.totalQuality).toBeLessThan(high.totalQuality);
  });

  it('rejects an all-zero fidelity weight set', () => {
    expect(() => composeObservationQuality({
      fovQuality: 1,
      distanceQuality: 1,
      relativeSpeedQuality: 1,
      occlusionVisibility: 1,
      attentionQuality: 1,
      observationDurationSeconds: 0.4,
      perceptionAbility: 1,
    }, {
      ...parameters,
      weights: {
        distance: 0,
        relativeSpeed: 0,
        attention: 0,
        duration: 0,
        ability: 0,
      },
    })).toThrow('observation quality weights must have a positive total');
  });
});
