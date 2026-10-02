import { describe, expect, it } from 'vitest';
import {
  createPublishedCoefficientRegressionCases,
  evaluatePublishedCoefficientRegressionCorpus,
} from './PublishedBaseballPhysicsValidationCorpus';

describe('published baseball-physics coefficient regression corpus', () => {
  it('keeps every target tied to an explicit source and tolerance', () => {
    const cases =
      createPublishedCoefficientRegressionCases();

    expect(cases.length)
      .toBeGreaterThanOrEqual(7);

    for (const validationCase of cases) {
      for (
        const target
        of validationCase.targets
      ) {
        expect(target.sourceId.length)
          .toBeGreaterThan(0);
        expect(
          target.absoluteTolerance,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('passes the current published coefficient anchors deterministically', () => {
    const first =
      evaluatePublishedCoefficientRegressionCorpus();
    const second =
      evaluatePublishedCoefficientRegressionCorpus();

    expect(first).toEqual(second);
    expect(first.passed).toBe(true);
    expect(first.fingerprint)
      .toMatch(/^[0-9a-f]{16}$/);
  });

  it('does not masquerade as the final end-to-end physics corpus', () => {
    const result =
      evaluatePublishedCoefficientRegressionCorpus();

    expect(result.version)
      .toBe(
        'published-coefficient-regression-v1',
      );
  });
});
