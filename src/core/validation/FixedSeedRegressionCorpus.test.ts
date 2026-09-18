import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../model/RuleProfileRef';
import {
  createFixedSeedRegressionCorpus,
} from './FixedSeedRegressionCorpus';

const startingMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top' as const,
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 1,
};

describe('FixedSeedRegressionCorpus', () => {
  it('stores reproducible scenario inputs without requiring a pre-frozen result hash', () => {
    expect(createFixedSeedRegressionCorpus([
      {
        scenarioId: 'pa-take-walk',
        matchSeed: 20260919,
        startingMatchState,
        scenarioBuilderId:
          'p9:plate-appearance:take-walk:v1',
        evidenceClass: 'plate_appearance',
        expectedFingerprint: null,
      },
    ])).toEqual({
      version: 1,
      scenarios: [{
        scenarioId: 'pa-take-walk',
        matchSeed: 20260919,
        startingMatchState,
        scenarioBuilderId:
          'p9:plate-appearance:take-walk:v1',
        evidenceClass: 'plate_appearance',
        expectedFingerprint: null,
      }],
    });
  });

  it('uses the same unsigned 32-bit seed domain as the deterministic RNG', () => {
    expect(() => createFixedSeedRegressionCorpus([
      {
        scenarioId: 'negative-seed',
        matchSeed: -1,
        startingMatchState,
        scenarioBuilderId: 'builder:v1',
        evidenceClass: 'rules',
        expectedFingerprint: null,
      },
    ])).toThrow(
      'matchSeed must be an unsigned 32-bit integer',
    );

    expect(() => createFixedSeedRegressionCorpus([
      {
        scenarioId: 'wrapped-seed',
        matchSeed: 0x1_0000_0000,
        startingMatchState,
        scenarioBuilderId: 'builder:v1',
        evidenceClass: 'rules',
        expectedFingerprint: null,
      },
    ])).toThrow(
      'matchSeed must be an unsigned 32-bit integer',
    );
  });

  it('returns a recursively frozen corpus so regression identity cannot drift after creation', () => {
    const corpus = createFixedSeedRegressionCorpus([
      {
        scenarioId: 'immutable',
        matchSeed: 42,
        startingMatchState,
        scenarioBuilderId: 'builder:v1',
        evidenceClass: 'rules',
        expectedFingerprint: null,
      },
    ]);

    expect(Object.isFrozen(corpus)).toBe(true);
    expect(Object.isFrozen(corpus.scenarios)).toBe(true);
    expect(Object.isFrozen(corpus.scenarios[0])).toBe(true);
    expect(Object.isFrozen(
      corpus.scenarios[0].startingMatchState,
    )).toBe(true);
    expect(Object.isFrozen(
      corpus.scenarios[0].startingMatchState.score,
    )).toBe(true);
  });

  it('requires unique scenario IDs and stable builder IDs', () => {
    expect(() => createFixedSeedRegressionCorpus([
      {
        scenarioId: 'same',
        matchSeed: 1,
        startingMatchState,
        scenarioBuilderId: 'builder:a:v1',
        evidenceClass: 'rules',
        expectedFingerprint: null,
      },
      {
        scenarioId: 'same',
        matchSeed: 2,
        startingMatchState,
        scenarioBuilderId: 'builder:b:v1',
        evidenceClass: 'fielding',
        expectedFingerprint: null,
      },
    ])).toThrow(
      'fixed-seed scenarioIds must be unique',
    );

    expect(() => createFixedSeedRegressionCorpus([
      {
        scenarioId: 'scenario',
        matchSeed: 1,
        startingMatchState,
        scenarioBuilderId: '',
        evidenceClass: 'rules',
        expectedFingerprint: null,
      },
    ])).toThrow(
      'scenarioBuilderId must not be empty',
    );
  });

  it('requires the scenario start state playId to be the canonical play id', () => {
    expect(() => createFixedSeedRegressionCorpus([
      {
        scenarioId: 'bad-play',
        matchSeed: 1,
        startingMatchState: {
          ...startingMatchState,
          playId: -1,
        },
        scenarioBuilderId: 'builder:v1',
        evidenceClass: 'rules',
        expectedFingerprint: null,
      },
    ])).toThrow(
      'startingMatchState.playId must be a non-negative safe integer',
    );
  });

  it('accepts only the canonical fingerprint format when an expectation is frozen', () => {
    expect(() => createFixedSeedRegressionCorpus([
      {
        scenarioId: 'bad-fingerprint',
        matchSeed: 1,
        startingMatchState,
        scenarioBuilderId: 'builder:v1',
        evidenceClass: 'rules',
        expectedFingerprint: 'deadbeef',
      },
    ])).toThrow(
      'expectedFingerprint must be null or a 16-digit lowercase hexadecimal fingerprint',
    );
  });

  it('preserves scenario order as part of the corpus contract', () => {
    const corpus = createFixedSeedRegressionCorpus([
      {
        scenarioId: 'first',
        matchSeed: 1,
        startingMatchState,
        scenarioBuilderId: 'builder:first:v1',
        evidenceClass: 'rules',
        expectedFingerprint: null,
      },
      {
        scenarioId: 'second',
        matchSeed: 2,
        startingMatchState: {
          ...startingMatchState,
          playId: 2,
        },
        scenarioBuilderId: 'builder:second:v1',
        evidenceClass: 'baserunning',
        expectedFingerprint: null,
      },
    ]);

    expect(corpus.scenarios.map(
      (scenario) => scenario.scenarioId,
    )).toEqual(['first', 'second']);
  });
});