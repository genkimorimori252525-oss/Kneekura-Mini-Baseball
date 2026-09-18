import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../model/RuleProfileRef';
import {
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';
import {
  createFixedSeedRegressionCorpus,
  type FixedSeedRegressionScenario,
} from './FixedSeedRegressionCorpus';
import {
  runFixedSeedRegressionCorpus,
} from './FixedSeedRegressionRunner';

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

const evidenceFor = (
  scenario: FixedSeedRegressionScenario,
) => ({
  events: [{
    tick: 1_000_000,
    sequence: 0,
    kind: 'Fixture',
    payload: {
      seed: scenario.matchSeed,
    },
  }],
  finalMatchState: {
    ...scenario.startingMatchState,
    playId:
      scenario.startingMatchState.playId + 1,
  },
});

const envelopeFor = (
  scenario: FixedSeedRegressionScenario,
) => ({
  version: 1,
  scenarioId: scenario.scenarioId,
  matchSeed: scenario.matchSeed,
  scenarioBuilderId:
    scenario.scenarioBuilderId,
  evidenceClass: scenario.evidenceClass,
  startingMatchState:
    scenario.startingMatchState,
  evidence: evidenceFor(scenario),
});

describe('FixedSeedRegressionRunner', () => {
  it('reports an unfrozen scenario without pretending it passed a baseline', () => {
    const corpus = createFixedSeedRegressionCorpus([
      {
        scenarioId: 'unfrozen',
        matchSeed: 42,
        startingMatchState,
        scenarioBuilderId: 'fixture:v1',
        evidenceClass: 'plate_appearance',
        expectedFingerprint: null,
      },
    ]);

    const result = runFixedSeedRegressionCorpus(
      corpus,
      {
        'fixture:v1': evidenceFor,
      },
    );

    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].expectation)
      .toBe('unfrozen');
    expect(result.scenarios[0].expectedFingerprint)
      .toBeNull();
    expect(result.scenarios[0].observedFingerprint)
      .toMatch(/^[0-9a-f]{16}$/);
  });

  it('reports a match only when the observed canonical envelope equals the frozen fingerprint', () => {
    const base = {
      scenarioId: 'frozen',
      matchSeed: 99,
      startingMatchState,
      scenarioBuilderId: 'fixture:v1',
      evidenceClass: 'rules' as const,
      expectedFingerprint: null,
    };
    const scenario =
      createFixedSeedRegressionCorpus([
        base,
      ]).scenarios[0];
    const expected =
      createCanonicalEvidenceFingerprint(
        envelopeFor(scenario),
      );

    const corpus = createFixedSeedRegressionCorpus([
      {
        ...base,
        expectedFingerprint: expected,
      },
    ]);

    const result = runFixedSeedRegressionCorpus(
      corpus,
      {
        'fixture:v1': evidenceFor,
      },
    );

    expect(result.scenarios[0].expectation)
      .toBe('match');
    expect(result.matched).toBe(1);
    expect(result.mismatched).toBe(0);
  });

  it('reports a mismatch without rewriting the expected fingerprint', () => {
    const corpus = createFixedSeedRegressionCorpus([
      {
        scenarioId: 'changed',
        matchSeed: 99,
        startingMatchState,
        scenarioBuilderId: 'fixture:v1',
        evidenceClass: 'rules',
        expectedFingerprint:
          '0000000000000000',
      },
    ]);

    const result = runFixedSeedRegressionCorpus(
      corpus,
      {
        'fixture:v1': evidenceFor,
      },
    );

    expect(result.scenarios[0].expectation)
      .toBe('mismatch');
    expect(result.scenarios[0].expectedFingerprint)
      .toBe('0000000000000000');
    expect(result.mismatched).toBe(1);
  });

  it('rejects a builder that mutates its scenario input without altering the corpus', () => {
    const corpus = createFixedSeedRegressionCorpus([
      {
        scenarioId: 'mutation-guard',
        matchSeed: 7,
        startingMatchState,
        scenarioBuilderId: 'mutating:v1',
        evidenceClass: 'rules',
        expectedFingerprint: null,
      },
    ]);

    expect(() => runFixedSeedRegressionCorpus(
      corpus,
      {
        'mutating:v1': (scenario) => {
          (scenario.startingMatchState.score as {
            away: number;
            home: number;
          }).away = 99;

          return {
            result: 'mutated',
          };
        },
      },
    )).toThrow(
      'fixed-seed scenario builder must not mutate scenario input',
    );

    expect(
      corpus.scenarios[0].startingMatchState.score.away,
    ).toBe(0);
  });

  it('fails explicitly when a corpus references an unregistered scenario builder', () => {
    const corpus = createFixedSeedRegressionCorpus([
      {
        scenarioId: 'missing-builder',
        matchSeed: 1,
        startingMatchState,
        scenarioBuilderId: 'missing:v1',
        evidenceClass: 'fielding',
        expectedFingerprint: null,
      },
    ]);

    expect(() => runFixedSeedRegressionCorpus(
      corpus,
      {},
    )).toThrow(
      'no fixed-seed scenario builder registered for missing:v1',
    );
  });
});