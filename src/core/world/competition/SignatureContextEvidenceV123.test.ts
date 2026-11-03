import { expect, it } from 'vitest';
import * as api from './SignatureContextEvidenceV123';

const scope = { careerId: 'career', competitionEditionId: 'edition', playerId: 'player', asOfDay: 10 };
const observation = (n: number, options: { occupied?: boolean; unknown?: boolean; pitching?: boolean; day?: number; hit?: boolean } = {}) => ({
  outcome: { attributionId: `play-${n}`, careerId: 'career', competitionEditionId: 'edition', gameId: 'game', playId: n,
    gameDay: options.day ?? 5, batterPlayerId: options.pitching ? 'opponent' : 'player', pitcherPlayerId: options.pitching ? 'player' : 'opponent',
    classification: options.hit ? 'base_hit' as const : 'reached_on_error' as const },
  before: { bases: { first: options.occupied ? 'runner' : null, second: null, third: null }, outs: 1, balls: 2, strikes: 2 },
  atBats: options.unknown ? { kind: 'unavailable' as const, reason: 'sacrifice_judgment_missing' as const } : { kind: 'known' as const, value: 1 },
  hits: { kind: 'known' as const, value: options.hit ? 1 : 0 },
});

it('SCTX01 fixed pre-play contexts retain exact AB/H subtotals and unknowns for both player roles', () => {
  const input = [observation(1, { hit: true }), observation(2, { occupied: true, unknown: true }), observation(3, { pitching: true })];
  const before = structuredClone(input), result = api.aggregateSignatureContextEvidenceV123(input, scope);
  expect(result.batting).toHaveLength(72); expect(result.pitching).toHaveLength(72);
  expect(result.batting.find(b => b.bases === 'basesEmpty' && b.outs === 1 && b.balls === 2 && b.strikes === 2)).toMatchObject({ plays: 1,
    atBats: { value: 1, knownSubtotal: 1, unknownCount: 0 }, hits: { value: 1, knownSubtotal: 1, unknownCount: 0 } });
  expect(result.batting.find(b => b.bases === 'runnersOn' && b.outs === 1 && b.balls === 2 && b.strikes === 2)).toMatchObject({ plays: 1,
    atBats: { value: null, knownSubtotal: 0, unknownCount: 1 }, hits: { value: 0, knownSubtotal: 0, unknownCount: 0 } });
  expect(result.pitching.reduce((total, row) => total + row.plays, 0)).toBe(1);
  expect(api.aggregateSignatureContextEvidenceV123([...input].reverse(), scope)).toEqual(result);
  expect(input).toEqual(before);
  expect(result.connections).toMatchObject({ leagueAdjustment: 'NOT_CONNECTED', parkAdjustment: 'NOT_CONNECTED',
    causalMotorEvidence: 'NOT_CONNECTED', sampleCalibration: 'UNVERIFIED', incrementalCheckpoint: 'NOT_CONNECTED' });
  expect(result).not.toHaveProperty('attributionIds');
});

it('SCTX02 a fixed output does not grow with history, does not select future results, and validates excluded evidence', () => {
  const result = api.aggregateSignatureContextEvidenceV123(Array.from({ length: 500 }, (_, n) => observation(n)), scope);
  expect(result.batting).toHaveLength(72); expect(result.pitching).toHaveLength(72);
  expect(result.batting.reduce((n, row) => n + row.plays, 0)).toBe(500);
  expect(api.aggregateSignatureContextEvidenceV123([observation(1, { day: 11 })], scope).batting.every(row => row.plays === 0)).toBe(true);
  expect(() => api.aggregateSignatureContextEvidenceV123([observation(1), observation(1)], scope)).toThrow(/duplicate/);
  const invalid = observation(2, { day: 11 }); invalid.before.strikes = 3;
  expect(() => api.aggregateSignatureContextEvidenceV123([invalid], scope)).toThrow();
  const postResult = { ...observation(1), before: { ...observation(1).before, scoreAfter: 9 } };
  expect(() => api.aggregateSignatureContextEvidenceV123([postResult], scope)).toThrow();
});
