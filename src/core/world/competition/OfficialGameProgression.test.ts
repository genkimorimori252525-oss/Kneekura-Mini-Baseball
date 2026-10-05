import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import * as completion from './OfficialGameCompletion';
const fixture = (half: 'top' | 'bottom', away: number, home: number, inning = 9) => {
  const prior: CanonicalMatchState = { ruleProfileId: asRuleProfileId('npb-2026'), inning, half, outs: 2, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away, home }, playId: 7 };
  const after: CanonicalMatchState = { ...prior, inning: half === 'top' ? inning : inning + 1, half: half === 'top' ? 'bottom' : 'top', outs: 0, playId: 8 };
  return { gameId: 'game', seasonId: 'season', homeClubId: 'home', awayClubId: 'away',
    policy: { version: 'explicit-policy', minimumInnings: 9, tiesAllowed: false }, priorMatch: prior,
    application: { applicationId: 'apply', closureId: 'closure', previousPlayId: 7, durableRevision: 1, appliedMatchState: after } };
};
// This decision is only the legal stop/continue fence, never a completed box score.
const progression = (input: ReturnType<typeof fixture>) => (completion as any).resolveOfficialGameProgression(input);
it.each([
  ['top', 1, 2, 'HOME_LEADS_AFTER_TOP'],
  ['bottom', 1, 2, 'BOTTOM_COMPLETE'],
] as const)('recognizes the %s final fence independently of H/E classification', (half, away, home, completionReason) => {
  expect(progression(fixture(half, away, home))).toEqual({ kind: 'GAME_FINAL_PENDING_SCORING', completionReason });
});
it('recognizes a walkoff without requesting the next pitch or inventing H/E totals', () => {
  const input = fixture('bottom', 2, 2);
  input.application.appliedMatchState = { ...input.priorMatch, playId: 8, score: { away: 2, home: 3 } };
  expect(progression(input)).toEqual({ kind: 'GAME_FINAL_PENDING_SCORING', completionReason: 'WALK_OFF' });
});
it('continues both early innings and the tied ninth under the explicit policy', () => {
  for (const input of [fixture('top', 1, 2, 8), fixture('bottom', 2, 2)]) {
    expect(progression(input)).toEqual({ kind: 'GAME_CONTINUES', nextMatchState: input.application.appliedMatchState });
  }
});
it('uses the accepted tie limit and never supplies a default completion policy', () => {
  const input = fixture('bottom', 2, 2);
  expect(progression({ ...input, policy: { ...input.policy, maximumInnings: 9, tiesAllowed: true } } as any))
    .toEqual({ kind: 'GAME_FINAL_PENDING_SCORING', completionReason: 'TIE_LIMIT' });
  expect(() => progression({ ...input, policy: undefined } as any)).toThrow();
  expect(() => progression({ ...input, policy: { ...input.policy, maximumInnings: 8 } } as any)).toThrow(/policy/);
});
it('rejects wrong-play, invalid half transition, decreasing score and fielding-team score', () => {
  const input = fixture('top', 1, 2), after = input.application.appliedMatchState;
  for (const patch of [{ playId: 99 }, { inning: 11 }, { score: { away: 0, home: 2 } }, { score: { away: 1, home: 3 } }]) {
    expect(() => progression({ ...input, application: { ...input.application, appliedMatchState: { ...after, ...patch } } })).toThrow();
  }
});
