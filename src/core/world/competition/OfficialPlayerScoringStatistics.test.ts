import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { closeOfficialPlay, createPlayAdjudicationLedger, getOfficialPlayClosure, recordCorrectRuleSnapshot } from '../../adjudication/PlayAdjudicationLedger';
import type { SupportedOfficialScoringRecord } from '../../adjudication/OfficialScoring';
import { aggregateOfficialPlayerScoring, deriveOfficialPlayerScoringContribution } from './OfficialPlayerScoringStatistics';
import type { AttributedOfficialPlayerOutcome } from './OfficialPlayerOutcomeStatistics';

const closed = (classification: SupportedOfficialScoringRecord['classification'], options: {
  outs?: number; retired?: number; runs?: number; occupied?: boolean;
} = {}) => {
  const match: CanonicalMatchState = { ruleProfileId: asRuleProfileId('npb-2026'), inning: 9, half: 'top', outs: options.outs ?? 0,
    balls: 0, strikes: 0, bases: options.occupied ? { first: 'r1', second: 'r2', third: 'r3' } : { first: null, second: null, third: null },
    score: { away: 0, home: 0 }, playId: 1 };
  const retired = options.retired ?? (['strikeout', 'foul_out', 'fly_out', 'ground_out'].includes(classification) ? 1 : 0);
  const runs = options.runs ?? 0;
  const ledger = recordCorrectRuleSnapshot(createPlayAdjudicationLedger({ playId: 1, ruleProfileId: match.ruleProfileId, playEnd: null }), 0,
    { eventId: 'rule', tick: 1, snapshotId: 'ruling', evidenceRevision: 1,
      ruling: { outsAfter: match.outs + retired, basesAfter: match.bases, scoredRunnerIds: Array.from({ length: runs }, (_, i) => `scored-${i}`) } });
  const closure = getOfficialPlayClosure(closeOfficialPlay(ledger, 1, { eventId: 'closed', closureId: 'closure', tick: 2 }))!;
  const record: SupportedOfficialScoringRecord = { playId: 1, closureId: 'closure', basisRulingId: 'ruling', classification,
    battingTeam: 'away', runsScored: runs, hitsCredited: classification === 'base_hit' ? 1 : 0, errorsCharged: classification === 'reached_on_error' ? 1 : 0 };
  return { match, closure, record };
};
const scope = { careerId: 'career', competitionEditionId: 'edition', playerId: 'player', asOfDay: 5 };
const outcome = (id: string, batting: boolean): AttributedOfficialPlayerOutcome => ({ attributionId: id, careerId: 'career',
  competitionEditionId: 'edition', gameId: id, playId: 1, gameDay: 5, classification: 'strikeout',
  batterPlayerId: batting ? 'player' : 'batter', pitcherPlayerId: batting ? 'pitcher' : 'player' });

it.each(['strikeout', 'foul_out', 'fly_out', 'ground_out', 'base_hit'] as const)('credits the defined no-run %s AB and original outs', classification => {
  const facts = closed(classification), result = deriveOfficialPlayerScoringContribution(facts);
  expect(result).toEqual({ atBats: { kind: 'known', value: 1 }, runsBattedIn: { kind: 'known', value: 0 },
    hitBases: classification === 'base_hit' ? { kind: 'unavailable', reason: 'credited_hit_value_missing' } : { kind: 'known', value: 0 },
    pitchingOuts: classification === 'base_hit' ? 0 : 1 });
});
it('credits the actual forced walk run as RBI without an AB or pitching out', () => {
  expect(deriveOfficialPlayerScoringContribution(closed('base_on_balls', { occupied: true, runs: 1 }))).toEqual({
    atBats: { kind: 'known', value: 0 }, runsBattedIn: { kind: 'known', value: 1 }, hitBases: { kind: 'known', value: 0 }, pitchingOuts: 0 });
});
it('keeps scoring catches and occupied H/E/FC judgments explicit', () => {
  for (const classification of ['foul_out', 'reached_on_error', 'fielders_choice'] as const) {
    const result = deriveOfficialPlayerScoringContribution(closed(classification, { occupied: true, runs: 1,
      retired: classification === 'foul_out' ? 1 : 0 }));
    expect(result.atBats).toEqual({ kind: 'unavailable', reason: 'sacrifice_judgment_missing' });
    expect(result.runsBattedIn).toEqual({ kind: 'unavailable', reason: 'rbi_judgment_missing' });
  }
  expect(deriveOfficialPlayerScoringContribution(closed('base_hit', { occupied: true, runs: 2 })).runsBattedIn.kind).toBe('unavailable');
  expect(deriveOfficialPlayerScoringContribution(closed('reached_on_error', { occupied: true })).runsBattedIn).toEqual({ kind: 'known', value: 0 });
});
it('recognizes that a sacrifice is impossible with empty bases or two outs', () => {
  expect(deriveOfficialPlayerScoringContribution(closed('reached_on_error')).atBats).toEqual({ kind: 'known', value: 1 });
  expect(deriveOfficialPlayerScoringContribution(closed('reached_on_error', { occupied: true, outs: 2 })).atBats).toEqual({ kind: 'known', value: 1 });
});
it('aggregates exact pitching outs across inning ends and keeps missing batting facts out of totals', () => {
  const data = [
    { outcome: outcome('bat-known', true), contribution: deriveOfficialPlayerScoringContribution(closed('strikeout')) },
    { outcome: outcome('bat-missing', true), contribution: deriveOfficialPlayerScoringContribution(closed('foul_out', { occupied: true, runs: 1 })) },
    ...[2, 2, 1].map((retired, i) => ({ outcome: outcome(`pitch-${i}`, false),
      contribution: deriveOfficialPlayerScoringContribution(closed('fielders_choice', { occupied: true, retired, outs: 3 - retired })) })),
  ];
  const result = aggregateOfficialPlayerScoring(data, scope);
  expect(result.batting.atBats).toEqual({ value: null, knownSubtotal: 1,
    unavailable: [{ attributionId: 'bat-missing', reason: 'sacrifice_judgment_missing' }] });
  expect(result.batting.runsBattedIn.value).toBeNull();
  expect(result.pitching).toEqual({ outsRecorded: 5, inningsPitched: { completeInnings: 1, remainderOuts: 2 } });
  expect(aggregateOfficialPlayerScoring([...data].reverse(), scope)).toEqual(result);
  expect(aggregateOfficialPlayerScoring(data, { ...scope, asOfDay: 4 }).pitching.outsRecorded).toBe(0);
  expect(() => aggregateOfficialPlayerScoring([data[0], data[0]], scope)).toThrow('duplicate');
});
it('rejects mismatched original identities, run counts and impossible classified retirements', () => {
  const facts = closed('strikeout');
  expect(() => deriveOfficialPlayerScoringContribution({ ...facts, record: { ...facts.record, closureId: 'other' } })).toThrow('scope');
  expect(() => deriveOfficialPlayerScoringContribution({ ...facts, record: { ...facts.record, runsScored: 1 } })).toThrow('scope');
  expect(() => deriveOfficialPlayerScoringContribution(closed('strikeout', { retired: 0 }))).toThrow('classification');
  expect(() => deriveOfficialPlayerScoringContribution(closed('base_on_balls', { retired: 1 }))).toThrow('classification');
});
it('aggregates only explicit accepted RBI and hit-value awards, preserving legacy unknown hit values', () => {
  const original = closed('base_hit', { occupied: true, runs: 2 });
  const values = [1, 2, 3, 4].map((hitBases, i) => ({ outcome: outcome(`hit-${i}`, true),
    contribution: deriveOfficialPlayerScoringContribution({ ...original, record: { ...original.record,
      playerStatistics: { runsBattedIn: 1, hitBases: hitBases as 1 | 2 | 3 | 4 } } }) }));
  const known = aggregateOfficialPlayerScoring(values, scope).batting;
  expect(known.runsBattedIn.value).toBe(4); expect(known.totalBases.value).toBe(10);
  for (const field of ['singles', 'doubles', 'triples', 'homeRuns'] as const) expect(known[field].value).toBe(1);
  const withLegacy = aggregateOfficialPlayerScoring([...values, { outcome: outcome('legacy-hit', true),
    contribution: deriveOfficialPlayerScoringContribution(original) }], scope).batting;
  expect(withLegacy.totalBases).toEqual({ value: null, knownSubtotal: 10,
    unavailable: [{ attributionId: 'legacy-hit', reason: 'credited_hit_value_missing' }] });
  expect(withLegacy.runsBattedIn.value).toBeNull();
});

it('uses an explicit accepted sacrifice judgment without imputing one from an error', () => {
  const original = closed('reached_on_error', { occupied: true });
  expect(deriveOfficialPlayerScoringContribution(original).atBats.kind).toBe('unavailable');
  for (const sacrifice of ['none', 'bunt'] as const) {
    const facts = deriveOfficialPlayerScoringContribution({ ...original, record: { ...original.record,
      playerStatistics: { runsBattedIn: 0, sacrifice } } });
    expect(facts.atBats).toEqual({ kind: 'known', value: sacrifice === 'none' ? 1 : 0 });
  }
});
