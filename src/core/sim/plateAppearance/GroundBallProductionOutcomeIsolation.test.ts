import {
  readFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import { describe, expect, it } from 'vitest';

const coordinatorSource = (): string => (
  readFileSync(
    join(
      process.cwd(),
      'src',
      'core',
      'sim',
      'plateAppearance',
      'GroundBallProductionOutcomeCoordinator.ts',
    ),
    'utf-8',
  )
);

describe('GroundBallProductionOutcomeCoordinator isolation', () => {
  it('keeps advisory throw probabilities out of authoritative outcome resolution', () => {
    const source = coordinatorSource();
    const forbiddenDirectDecisionFields = [
      '.outProbability',
      '.scoreProbability',
      '.expectedExtraBasesAllowed',
    ];

    for (const token of forbiddenDirectDecisionFields) {
      expect(
        source.includes(token),
        `production coordinator directly consumes advisory field ${token}`,
      ).toBe(false);
    }

    expect(source.includes('selectThrowPlanForCoverage'))
      .toBe(true);
  });

  it('does not import validation buckets or presentation state into production truth', () => {
    const source = coordinatorSource();
    const forbiddenSubsystemTokens = [
      'P9BatchCalibration',
      'BatchValidationStatistics',
      '../../validation/',
      '../validation/',
      '/presentation/',
      '../presentation/',
      '../../presentation/',
      '../../../presentation/',
    ];

    for (const token of forbiddenSubsystemTokens) {
      expect(
        source.includes(token),
        `production coordinator contains forbidden subsystem token ${token}`,
      ).toBe(false);
    }
  });
});