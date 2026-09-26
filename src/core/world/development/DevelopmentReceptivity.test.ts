import { expect, it } from 'vitest';
import { CURVE_SHAPES, DEVELOPMENT_DOMAINS,
  MATURITY_TIMINGS,
  type DevelopmentTrajectoryProfile } from './DevelopmentTrajectory';
import { evaluateDevelopmentReceptivity,
  type DevelopmentReceptivityPolicy } from './DevelopmentReceptivity';

const profile = (): DevelopmentTrajectoryProfile => ({
  careerId: 'career-1', playerId: 'player-1', createdAtDay: 10,
  profileVersion: 'trajectory-v1', maturityTiming: 'LATE',
  curveShape: 'STEPWISE_WAVES',
  domainOffsets: Object.fromEntries(DEVELOPMENT_DOMAINS.map((domain) =>
    [domain, domain === 'TECHNICAL' ? 2 : 0])) as
    DevelopmentTrajectoryProfile['domainOffsets'],
  generation: { rngVersion: 'development-xorshift32-v1',
    seed: 17, drawCount: 8, policyId: 'trajectory-policy' },
});

const policy = (): DevelopmentReceptivityPolicy => ({
  policyId: 'receptivity-v1', version: 'v1',
  profileVersion: 'trajectory-v1', availableAtDay: 10,
  templateCurves: Object.fromEntries(MATURITY_TIMINGS.map((timing) =>
    [timing, Object.fromEntries(CURVE_SHAPES.map((shape) =>
      [shape, [
        { ageYears: 18, receptivity: 0.2, declinePressure: 0.1 },
        { ageYears: 28, receptivity: 0.8, declinePressure: 0.2 },
        { ageYears: 38, receptivity: 0.3, declinePressure: 0.7 },
      ]]))])) as unknown as DevelopmentReceptivityPolicy['templateCurves'],
});

it('evaluates the pinned 5 x 3 prior and independent domain timing without changing ability', () => {
  const player = profile();
  const rules = policy();
  const technical = evaluateDevelopmentReceptivity(player,
    'TECHNICAL', 30, 100, rules);
  const physical = evaluateDevelopmentReceptivity(player,
    'PHYSICAL', 30, 100, rules);
  expect(technical).toMatchObject({
    careerId: 'career-1', playerId: 'player-1',
    timing: 'LATE', shape: 'STEPWISE_WAVES', domain: 'TECHNICAL',
    effectiveAgeYears: 28, receptivity: 0.8,
    declinePressure: 0.2, policyId: 'receptivity-v1',
  });
  expect(physical.effectiveAgeYears).toBe(30);
  expect(physical.receptivity).toBeCloseTo(0.7);
  expect(technical).not.toHaveProperty('ability');
  expect(Object.isFrozen(technical)).toBe(true);
  expect(player).toEqual(profile());
});

it('keeps out-of-template ages possible and respects template-specific calibration', () => {
  const rules = policy();
  const differing: DevelopmentReceptivityPolicy = { ...rules,
    templateCurves: { ...rules.templateCurves,
      VERY_EARLY: { ...rules.templateCurves.VERY_EARLY,
        SHARP_PEAK: [
          { ageYears: 18, receptivity: 0.9, declinePressure: 0.1 },
          { ageYears: 28, receptivity: 0.2, declinePressure: 0.8 },
        ] } } };
  const early = { ...profile(), maturityTiming: 'VERY_EARLY' as const,
    curveShape: 'SHARP_PEAK' as const };
  expect(evaluateDevelopmentReceptivity(early,
    'PHYSICAL', 18, 100, differing).receptivity).toBe(0.9);
  expect(evaluateDevelopmentReceptivity(early,
    'PHYSICAL', 40, 100, differing).receptivity).toBe(0.2);
  expect(evaluateDevelopmentReceptivity(profile(),
    'TECHNICAL', 60, 100, rules).receptivity).toBe(0.3);
});

it('rejects missing templates, zero-age gates, mismatched provenance and future policies', () => {
  const rules = policy();
  const player = profile();
  expect(() => evaluateDevelopmentReceptivity(player,
    'TECHNICAL', 30, 100, { ...rules,
      templateCurves: { ...rules.templateCurves, LATE: {
        ...rules.templateCurves.LATE, STEPWISE_WAVES: [] } } }))
    .toThrow('curve');
  expect(() => evaluateDevelopmentReceptivity(player,
    'TECHNICAL', 30, 100, { ...rules,
      templateCurves: { ...rules.templateCurves, LATE: {
        ...rules.templateCurves.LATE, STEPWISE_WAVES: [
          { ageYears: 18, receptivity: 0, declinePressure: 0 },
          { ageYears: 28, receptivity: 0.8, declinePressure: 0.2 },
        ] } } })).toThrow('receptivity');
  expect(() => evaluateDevelopmentReceptivity(player,
    'TECHNICAL', 30, 100, { ...rules,
      templateCurves: { ...rules.templateCurves, LATE: {
        ...rules.templateCurves.LATE, STEPWISE_WAVES: [
          { ageYears: -0.5, receptivity: 0.2, declinePressure: 0 },
          { ageYears: 28, receptivity: 0.8, declinePressure: 0.2 },
        ] } } })).toThrow('ages');
  expect(() => evaluateDevelopmentReceptivity(player,
    'TECHNICAL', 30, 100, { ...rules,
      profileVersion: 'unrelated' })).toThrow('version');
  expect(() => evaluateDevelopmentReceptivity(player,
    'TECHNICAL', 30, 100, { ...rules,
      availableAtDay: 11 })).toThrow('future');
  expect(() => evaluateDevelopmentReceptivity(player,
    'TECHNICAL', Number.NaN, 100, rules)).toThrow('age');
});
