import { describe, expect, it } from 'vitest';
import {
  createManagerDefensiveStrategyRatings,
  deriveManagerScoutingParameters,
} from './ManagerDefensiveStrategy';

describe('ManagerDefensiveStrategy', () => {
  it('creates separate normalized manager strategy abilities', () => {
    expect(createManagerDefensiveStrategyRatings({
      informationUpdate: 0.8,
      sampleEvaluation: 0.7,
      alignmentComparison: 0.9,
    })).toEqual({
      informationUpdate: 0.8,
      sampleEvaluation: 0.7,
      alignmentComparison: 0.9,
    });
  });

  it('maps information update and sample evaluation into scouting parameters without touching player physics', () => {
    const low = deriveManagerScoutingParameters(
      createManagerDefensiveStrategyRatings({
        informationUpdate: 0,
        sampleEvaluation: 0,
        alignmentComparison: 0.5,
      }),
      {
        lowInformationUpdateRecencyDecay: 0.02,
        highInformationUpdateRecencyDecay: 0.3,
        lowSampleEvaluationPriorWeight: 0.5,
        highSampleEvaluationPriorWeight: 4,
      },
    );
    const high = deriveManagerScoutingParameters(
      createManagerDefensiveStrategyRatings({
        informationUpdate: 1,
        sampleEvaluation: 1,
        alignmentComparison: 0.5,
      }),
      {
        lowInformationUpdateRecencyDecay: 0.02,
        highInformationUpdateRecencyDecay: 0.3,
        lowSampleEvaluationPriorWeight: 0.5,
        highSampleEvaluationPriorWeight: 4,
      },
    );

    expect(low).toEqual({
      priorWeight: 0.5,
      recencyDecayPerObservation: 0.02,
    });
    expect(high).toEqual({
      priorWeight: 4,
      recencyDecayPerObservation: 0.3,
    });
  });

  it('rejects invalid ratings and inverted calibration endpoints', () => {
    expect(() => createManagerDefensiveStrategyRatings({
      informationUpdate: 1.1,
      sampleEvaluation: 0.5,
      alignmentComparison: 0.5,
    })).toThrow(
      'informationUpdate must be finite and within [0, 1]',
    );

    expect(() => deriveManagerScoutingParameters(
      createManagerDefensiveStrategyRatings({
        informationUpdate: 0.5,
        sampleEvaluation: 0.5,
        alignmentComparison: 0.5,
      }),
      {
        lowInformationUpdateRecencyDecay: 0.3,
        highInformationUpdateRecencyDecay: 0.1,
        lowSampleEvaluationPriorWeight: 0.5,
        highSampleEvaluationPriorWeight: 4,
      },
    )).toThrow(
      'highInformationUpdateRecencyDecay must be at least lowInformationUpdateRecencyDecay',
    );
  });
});
