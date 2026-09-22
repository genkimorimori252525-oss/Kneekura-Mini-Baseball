import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { classifyTwoStrikeWeakness, prepareTwoStrikeInput } from './index';
import { code, input, request, value, withEmotion } from './TwoStrikeFixtures.test-support';

describe('two-strike classification integrity', () => {
  for (const [name, mutate, expected] of [
    ['foreign source player', (q: any) => q.source.scope.playerId = 'other', 'SCOPE_MISMATCH'],
    ['foreign observation career', (q: any) => q.observations[0].scope.careerId = 'other', 'SCOPE_MISMATCH'],
    ['source owner substitution', (q: any) => q.source.owner = 'CAREER_HISTORY', 'INVALID_INPUT'],
    ['future source', (q: any) => q.source.time.day = 13, 'BACKDATED_EVALUATION'],
    ['future observation', (q: any) => q.observations[0].time.day = 13, 'BACKDATED_EVALUATION'],
    ['future season', (q: any) => q.observations[0].time.season = 2, 'BACKDATED_EVALUATION'],
    ['decreasing seasons', (q: any) => q.observations[2].time.season = 0, 'INCONSISTENT_STATE'],
    ['duplicate event', (q: any) => q.observations[1].eventId = q.observations[0].eventId, 'INCONSISTENT_STATE'],
    ['duplicate instant', (q: any) => q.observations[1].time = q.observations[0].time, 'INCONSISTENT_STATE'],
    ['one-strike evidence', (q: any) => q.observations[0].strikes = 1, 'INVALID_INPUT'],
    ['negative timing residual', (q: any) => q.observations[0].recognitionErrorTicks = -1, 'INVALID_INPUT'],
    ['fractional simulation ticks', (q: any) => q.observations[0].recognitionErrorTicks = 0.5, 'INVALID_INPUT'],
    ['unsafe timing residual', (q: any) => q.observations[0].recognitionErrorTicks = Number.MAX_SAFE_INTEGER + 1, 'INVALID_INPUT'],
    ['NaN adjustment', (q: any) => q.observations[0].adjustmentErrorM = NaN, 'INVALID_INPUT'],
    ['infinite adjustment', (q: any) => q.observations[0].adjustmentErrorM = Infinity, 'INVALID_INPUT'],
    ['negative adjustment', (q: any) => q.observations[0].adjustmentErrorM = -1, 'INVALID_INPUT'],
    ['empty identity', (q: any) => q.classificationId = ' ', 'INVALID_INPUT'],
    ['sparse observations', (q: any) => delete q.observations[1], 'INVALID_INPUT'],
    ['hidden invalid old sample', (q: any) => { q.observations[0].recognitionErrorTicks = NaN; q.model.windowDays = 3; }, 'INVALID_INPUT'],
    ['zero red threshold', (q: any) => q.model.redRecognitionTicks = 0, 'INVALID_INPUT'],
    ['unordered timing tiers', (q: any) => q.model.extremeRecognitionTicks = 5, 'INVALID_INPUT'],
    ['unordered spatial tiers', (q: any) => q.model.extremeAdjustmentM = 0.01, 'INVALID_INPUT'],
    ['zero spatial threshold', (q: any) => q.model.redAdjustmentM = 0, 'INVALID_INPUT'],
    ['zero red incidence', (q: any) => q.model.redEpisodeFraction = 0, 'INVALID_INPUT'],
    ['invalid extreme incidence', (q: any) => q.model.extremeEpisodeFraction = 2, 'INVALID_INPUT'],
    ['weaker extreme evidence fraction', (q: any) => q.model.extremeEpisodeFraction = 0.25, 'INVALID_INPUT'],
    ['weaker extreme episode minimum', (q: any) => { q.model.minimumFailedEpisodes = 4; q.model.minimumExtremeEpisodes = 3; }, 'INVALID_INPUT'],
    ['one-opportunity activation policy', (q: any) => q.model.minimumEpisodes = 1, 'INVALID_INPUT'],
    ['no elapsed evidence policy', (q: any) => q.model.minimumDays = 0, 'INVALID_INPUT'],
    ['impossible span in day-count window', (q: any) => q.model.minimumDays = q.model.windowDays, 'INVALID_INPUT'],
  ] as const) it('rejects ' + name, () => { const q = request(); mutate(q); code(classifyTwoStrikeWeakness(q), expected); });
  it('does not invoke a root getter', () => {
    const q = request(); let called = false;
    Object.defineProperty(q, 'observations', { enumerable: true, get() { called = true; return []; } });
    code(classifyTwoStrikeWeakness(q), 'INVALID_INPUT'); assert.equal(called, false);
  });
  it('does not invoke an array index getter', () => {
    const q = request(); let called = false;
    Object.defineProperty(q.observations, '0', { enumerable: true, get() { called = true; return null; } });
    code(classifyTwoStrikeWeakness(q), 'INVALID_INPUT'); assert.equal(called, false);
  });
  it('rejects inherited observation state', () => {
    const q = request(); q.observations[0] = Object.create(q.observations[0]); code(classifyTwoStrikeWeakness(q), 'INVALID_INPUT');
  });
  it('does not clear a likely weakness when repeated-failure evidence is insufficient', () => {
    const q = request(); q.observations = q.observations.slice(2); q.observations.forEach(o => o.recognitionErrorTicks = 20);
    Object.assign(q.model, { minimumEpisodes: 2, minimumDays: 1, minimumFailedEpisodes: 3, minimumExtremeEpisodes: 4 });
    const r = value(classifyTwoStrikeWeakness(q)); assert.equal(r.status, 'UNAVAILABLE');
    assert.ok(r.reasons.includes('INSUFFICIENT_FAILURE_EVIDENCE'));
  });
});

describe('two-strike source assembly integrity', () => {
  for (const [name, mutate, expected] of [
    ['foreign frame player', (q: any) => q.frame.scope.playerId = 'other', 'SCOPE_MISMATCH'],
    ['foreign match', (q: any) => q.frame.matchId = 'other', 'SCOPE_MISMATCH'],
    ['stale trait revision', (q: any) => q.frame.expectedTraitRevision++, 'STALE_REVISION'],
    ['stale emotion revision', (q: any) => q.frame.expectedEmotionRevision++, 'STALE_REVISION'],
    ['wrong selected technical snapshot', (q: any) => q.frame.currentSource.snapshotId = 'other', 'SOURCE_CONFLICT'],
    ['future current technical source', (q: any) => q.current.source.time.day++, 'BACKDATED_EVALUATION'],
    ['future classification', (q: any) => q.classificationRequest.time.day++, 'BACKDATED_EVALUATION'],
    ['negative current spread', (q: any) => q.current.adjustmentSpreadM = -1, 'INVALID_INPUT'],
    ['unsafe current delay', (q: any) => q.current.recognitionDelayTicks = Infinity, 'INVALID_INPUT'],
    ['emotion-pre-adjusted baseline', (q: any) => q.current.source.effectBasis = 'AFTER_EMOTION', 'INVALID_INPUT'],
    ['duplicated technique', (q: any) => q.current.techniques[1] = q.current.techniques[0], 'INCONSISTENT_STATE'],
    ['missing technique status', (q: any) => q.current.techniques.pop(), 'INVALID_INPUT'],
    ['duplicate skill source', (q: any) => q.current.techniques[1].source.sourceKey = q.current.techniques[0].source.sourceKey, 'INCONSISTENT_STATE'],
    ['wrong mastery source', (q: any) => q.current.techniques[1].source.sourceKey = 'other', 'SOURCE_CONFLICT'],
    ['revision older than learned proof', (q: any) => q.current.techniques[1].source.revision = 0, 'SOURCE_CONFLICT'],
    ['same mastery revision mapped to different snapshot', (q: any) => q.current.techniques[1].source.revision = 1, 'SOURCE_CONFLICT'],
    ['new revision reusing old proof snapshot', (q: any) => q.current.techniques[1].source.snapshotId = 'proof/two_strike_adjustment', 'SOURCE_CONFLICT'],
    ['different baseline for classification', (q: any) => q.classificationRequest.source.sourceKey = 'other', 'SOURCE_CONFLICT'],
    ['different snapshot at same classification revision', (q: any) => q.classificationRequest.source.snapshotId = 'other', 'SOURCE_CONFLICT'],
    ['newer classification than selected source', (q: any) => { q.classificationRequest.source.revision++; q.classificationRequest.source.snapshotId = 'future'; }, 'SOURCE_CONFLICT'],
    ['same source ID with contradictory snapshot time', (q: any) => q.current.source.time.sequence++, 'SOURCE_CONFLICT'],
    ['current source revision with backdated snapshot', (q: any) => {
      q.current.source.revision++; q.current.source.snapshotId = 'new'; q.current.source.time.day--;
      q.frame.currentSource = { sourceKey: 'baseline', revision: 6, snapshotId: 'new' };
    }, 'SOURCE_CONFLICT'],
    ['post-strikeout count', (q: any) => q.frame.strikes = 3, 'INVALID_INPUT'],
    ['effect injection', (q: any) => q.directPressureBonus = 1, 'INVALID_INPUT'],
  ] as const) it('rejects ' + name, () => { const q = input(); mutate(q); code(prepareTwoStrikeInput(q), expected); });
  for (const active of [false, true]) {
    it('rejects stale appraisal context, even when active=' + active, () => {
      const q = input(); withEmotion(q, active); q.frame.contextId = 'other'; code(prepareTwoStrikeInput(q), 'SOURCE_CONFLICT');
    });
    it('rejects stale appraisal source, even when active=' + active, () => {
      const q = input(); withEmotion(q, active); q.frame.emotionSourceSnapshotId = 'other'; code(prepareTwoStrikeInput(q), 'SOURCE_CONFLICT');
    });
    it('rejects future appraisal time, even when active=' + active, () => {
      const q = input(); withEmotion(q, active); q.frame.emotionTime.tick = 99; code(prepareTwoStrikeInput(q), 'BACKDATED_EVALUATION');
    });
  }
  it('does not trust a forged empty active state', () => {
    const q = input(); withEmotion(q); q.emotion.active = null;
    code(prepareTwoStrikeInput(q), 'INCONSISTENT_STATE');
  });
  it('does not bypass validation outside two strikes', () => {
    const q = input(); q.frame.strikes = 0; q.classificationRequest!.observations[0]!.adjustmentErrorM = Infinity;
    code(prepareTwoStrikeInput(q), 'INVALID_INPUT');
  });
  it('retains separate scopes for delimiter-containing opaque IDs', () => {
    const q = input(false); q.frame.scope.careerId = 'career:player';
    code(prepareTwoStrikeInput(q), 'SCOPE_MISMATCH');
  });
  it('supports a real source evolution without copying proof into new skill state', () => {
    const q = input(); const a = value(prepareTwoStrikeInput(q));
    q.current.techniques[1]!.source = { sourceKey: 'skill/two_strike_adjustment', revision: 4, snapshotId: 'current/4' };
    q.current.techniques[1]!.feasible = false;
    const b = value(prepareTwoStrikeInput(q)); assert.deepEqual(a.learnedTechniques[1]!.masteryProof, b.learnedTechniques[1]!.masteryProof);
    assert.equal(b.learnedTechniques[1]!.feasible, false);
  });
});
