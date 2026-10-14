import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { CanonicalMatchState, BaseOccupancy } from '../../model/CanonicalMatchState';
import { closeOfficialPlay, createPlayAdjudicationLedger, getOfficialPlayClosure, recordCorrectRuleSnapshot } from '../../adjudication/PlayAdjudicationLedger';
import { applyOfficialPitchingRunJudgment, deriveOfficialPitchingRuns, totalOfficialPitchingRuns,
  type OfficialPitchingRunPlay, type OfficialPitchingRunJudgment } from './OfficialPitchingRunResponsibility';
const bases = (first: string | null = null, second: string | null = null, third: string | null = null): BaseOccupancy => ({ first, second, third });
const series = () => {
  let state: CanonicalMatchState = { ruleProfileId: asRuleProfileId('npb-2026'), inning: 1, half: 'top', outs: 0,
    balls: 0, strikes: 0, bases: bases(), score: { away: 0, home: 0 }, playId: 0 };
  const plays: OfficialPitchingRunPlay[] = [];
  return { plays, add(batter: string, pitcher: string, classification: OfficialPitchingRunPlay['record']['classification'],
    nextBases: BaseOccupancy, scored: string[] = [], retired: string | null = null, missing = false) {
    const before = state, playId = before.playId, applicationId = `play-${playId}`, outsAfter = before.outs + (retired ? 1 : 0);
    let ledger = createPlayAdjudicationLedger({ playId, ruleProfileId: before.ruleProfileId, playEnd: null });
    ledger = recordCorrectRuleSnapshot(ledger, 0, { eventId: applicationId, tick: 1, snapshotId: applicationId, evidenceRevision: 1,
      ruling: { outsAfter, basesAfter: nextBases, scoredRunnerIds: scored } });
    const closure = getOfficialPlayClosure(closeOfficialPlay(ledger, 1, { eventId: `close-${playId}`, closureId: applicationId, tick: 2 }))!;
    const record: OfficialPitchingRunPlay['record'] = { playId, closureId: applicationId, basisRulingId: closure.finalRuling.rulingId, classification,
      battingTeam: 'away' as const, runsScored: scored.length, hitsCredited: classification === 'base_hit' ? 1 : 0,
      errorsCharged: classification === 'reached_on_error' ? 1 : 0 };
    state = { ...before, playId: playId + 1, bases: nextBases, outs: outsAfter, score: { away: before.score.away + scored.length, home: 0 } };
    plays.push({ applicationId, before, after: state, closure, record, retiredPriorRunnerId: retired,
      outcome: missing ? null : { attributionId: `attribution-${playId}`, careerId: 'career', competitionEditionId: 'edition',
        gameId: 'game', playId, gameDay: 1, classification, batterPlayerId: batter, pitcherPlayerId: pitcher } });
  } };
};
it('retains the entry pitcher when a reliever later allows the original runner to score', () => {
  const f = series(); f.add('A', 'Peter', 'base_on_balls', bases('A'));
  f.add('B', 'Roger', 'base_hit', bases('B'), ['A']);
  const runs = deriveOfficialPitchingRuns('game', f.plays);
  expect(runs[0]).toMatchObject({ runnerEntryApplicationId: 'play-0', responsibility: { pitcherPlayerId: 'Peter', entryApplicationId: 'play-0' } });
  expect(totalOfficialPitchingRuns(runs, 'Peter')).toMatchObject({ runsAllowed: { value: 1 }, earnedRuns: { value: null } });
  expect(totalOfficialPitchingRuns(runs, 'Roger').runsAllowed.value).toBe(0);
});
it('assigns FC inherited slots to a surviving prior runner, including a bases-loaded two-run result', () => {
  const f = series(); f.add('A', 'Peter', 'base_on_balls', bases('A'));
  f.add('B', 'Roger', 'base_on_balls', bases('B', 'A'));
  f.add('C', 'Roger', 'base_hit', bases('C', 'B', 'A'));
  f.add('D', 'Roger', 'fielders_choice', bases('D', 'C', 'B'), [], 'A');
  f.add('E', 'Roger', 'base_hit', bases('E', 'D'), ['C', 'B']);
  const runs = deriveOfficialPitchingRuns('game', f.plays);
  expect(runs.find(r => r.runnerId === 'B')?.responsibility).toMatchObject({ pitcherPlayerId: 'Peter', entryApplicationId: 'play-0', transferApplicationIds: ['play-3'] });
  expect(runs.find(r => r.runnerId === 'C')?.responsibility?.pitcherPlayerId).toBe('Roger');
  expect(totalOfficialPitchingRuns(runs, 'Peter').runsAllowed.value).toBe(1);
});
it('does not transfer a retired prior runner liability on a hit', () => {
  const f = series(); f.add('A', 'Peter', 'base_on_balls', bases('A'));
  f.add('B', 'Roger', 'base_hit', bases(null, 'B'), [], 'A');
  f.add('C', 'Roger', 'base_hit', bases('C'), ['B']);
  expect(deriveOfficialPitchingRuns('game', f.plays)[0].responsibility?.pitcherPlayerId).toBe('Roger');
});
it('preserves unknown attribution and unsupported FC precedence without assigning the current pitcher', () => {
  const f = series(); f.add('A', 'Peter', 'base_on_balls', bases('A'), [], null, true);
  f.add('B', 'Roger', 'base_hit', bases('B'), ['A']);
  expect(totalOfficialPitchingRuns(deriveOfficialPitchingRuns('game', f.plays), 'Roger').runsAllowed).toMatchObject({ value: null, knownSubtotal: 0 });
  const g = series(); g.add('A', 'Peter', 'base_on_balls', bases('A'));
  g.add('B', 'Roger', 'base_hit', bases('B', null, 'A'));
  g.add('C', 'Roger', 'fielders_choice', bases('B', 'C'), [], 'A');
  g.add('D', 'Roger', 'base_hit', bases('D'), ['B', 'C']);
  expect(deriveOfficialPitchingRuns('game', g.plays).every(r => r.unavailableReason === 'unsupported_liability_transfer')).toBe(true);
});
it('binds independent pitcher/team earned judgments to exact original run and liability origin', () => {
  const f = series(); f.add('A', 'Peter', 'base_on_balls', bases('A'));
  f.add('B', 'Roger', 'base_hit', bases('B'), ['A']);
  const runs = deriveOfficialPitchingRuns('game', f.plays), run = runs[0];
  const scope = { careerId: 'career', gameId: 'game', ruleProfileId: 'npb-2026', originalProofHash: 'proof' };
  const judgment: OfficialPitchingRunJudgment = { ...scope, schemaVersion: 1, sourceKind: 'official_pitching_run_scorer_judgment', sourceEventId: 'source', scorerId: 'scorer',
    runs: [{ runId: run.runId, runnerStintId: run.runnerStintId, responsiblePitcherId: 'Peter', responsibilityEntryApplicationId: 'play-0', pitcherEarned: true, teamEarned: false }] };
  const assessed = applyOfficialPitchingRunJudgment(runs, judgment, scope);
  expect(assessed[0]).toMatchObject({ pitcherEarned: true, teamEarned: false });
  expect(totalOfficialPitchingRuns(assessed, 'Peter').earnedRuns.value).toBe(1);
  expect(() => applyOfficialPitchingRunJudgment(runs, { ...judgment, runs: [{ ...judgment.runs[0], responsiblePitcherId: 'Roger' }] }, scope)).toThrow('original');
  expect(() => applyOfficialPitchingRunJudgment(runs, judgment, { ...scope, originalProofHash: 'changed' })).toThrow();
});
it('retains the direct unearned rule for an actual runner who reached on error', () => {
  const f = series(); f.add('A', 'Peter', 'reached_on_error', bases('A'));
  f.add('B', 'Roger', 'base_hit', bases('B'), ['A']);
  expect(deriveOfficialPitchingRuns('game', f.plays)[0]).toMatchObject({ pitcherEarned: false, teamEarned: false });
});

it('distinguishes a player reaching again from their earlier runner stint', () => {
  const f = series(); f.add('A', 'Peter', 'base_on_balls', bases('A'));
  f.add('B', 'Roger', 'base_hit', bases('B'), ['A']);
  f.add('A', 'Roger', 'base_hit', bases('A', 'B'));
  f.add('C', 'Roger', 'base_hit', bases('C'), ['B', 'A']);
  const twice = deriveOfficialPitchingRuns('game', f.plays).filter(run => run.runnerId === 'A');
  expect(new Set(twice.map(run => run.runnerStintId)).size).toBe(2);
  expect(twice.map(run => run.responsibility?.pitcherPlayerId)).toEqual(['Peter', 'Roger']);
});
