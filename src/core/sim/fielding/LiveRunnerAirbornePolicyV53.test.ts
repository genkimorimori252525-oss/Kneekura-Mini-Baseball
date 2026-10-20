import { expect, it } from 'vitest';
import { decideLiveRunnerAdvanceV1, type LiveRunnerAdvanceInputV1 } from './LiveRunnerAdvancePolicyV1';
const fixture = (): LiveRunnerAdvanceInputV1 => ({ nowSeconds: 1, playStartedAtSeconds: 0, currentBase: 1,
  distanceToNextBaseMeters: 27.432, targetOccupied: false, runner: { topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .2 },
  forced: true, outs: 0, firstGroundContactElapsedSeconds: null, firstFielderTouchElapsedSeconds: null,
  defenderControlSeconds: 9, airborneAssessment: { observedAtSeconds: .8, catchMarginSeconds: -.5 } });
it('commits to a physically reachable next bag on an observed airborne hit read without awaiting landing', () => {
  expect(decideLiveRunnerAdvanceV1(fixture())).toMatchObject({ advance: true, reason: 'airborne_hit_read_advance', readyAtElapsedSeconds: .2 });
});
it('keeps catch-risk and running race risk separate, and uses existing individual/coach safety margin', () => {
  const raw = fixture();
  expect(decideLiveRunnerAdvanceV1({ ...raw, airborneAssessment: { ...raw.airborneAssessment!, catchMarginSeconds: .1 } }))
    .toMatchObject({ advance: false, reason: 'airborne_catch_risk_hold' });
  expect(decideLiveRunnerAdvanceV1({ ...raw, policy: { safetyMarginSeconds: .6 } }).advance).toBe(false);
  expect(decideLiveRunnerAdvanceV1({ ...raw, policy: { safetyMarginSeconds: .1 } }).advance).toBe(true);
  expect(decideLiveRunnerAdvanceV1({ ...raw, defenderControlSeconds: 1 }).advance).toBe(false);
});
it('does not turn a missing forecast or future observation into permission to advance', () => {
  expect(decideLiveRunnerAdvanceV1({ ...fixture(), airborneAssessment: undefined })).toMatchObject({ advance: false, reason: 'awaiting_legal_departure' });
  expect(() => decideLiveRunnerAdvanceV1({ ...fixture(), airborneAssessment: { observedAtSeconds: 2, catchMarginSeconds: -1 } })).toThrow();
});
