import { expect, it } from 'vitest';
import { deriveBallWorldGroundFirstBaseRace } from './BallWorldGroundFirstBaseRace';
import type { BallWorldBattedRuleEvidenceInput } from './BallWorldBattedRuleEvidence';
import type { BallWorldFirstBaseRaceInput } from './BallWorldFirstBaseRace';
import { quantizeEventTick } from '../sim/ExactEventTime';

const moment = (elapsedSeconds: number) => ({ originTick: 0, elapsedSeconds, ball: { tick: quantizeEventTick(0, elapsedSeconds, 1_000_000),
  position: { x: 0, y: 0.036, z: 60 }, velocity: { x: 1, y: 0, z: 1 }, spin: { x: 0, y: 0, z: 0 } } });
const field = { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 }, thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } };
const ball = (pendingAt: number | null): BallWorldBattedRuleEvidenceInput => ({ batterRunnerId: 'batter', defenderIds: ['defender'], originTick: 0, ticksPerSecond: 1_000_000,
  field, bases: { homePlate: field.homePlate, firstBase: { x: 27, z: 27 }, secondBase: { x: 0, z: 54 }, thirdBase: { x: -27, z: 27 } },
  ballRadiusMeters: 0.036, horizon: moment(4), acquisitions: [], contacts: [{ moment: moment(1), contacts: [{ kind: 'ground' }] },
    ...(pendingAt === null ? [] : [{ moment: moment(pendingAt), contacts: [{ kind: 'surface' as const, surfaceId: 'wall' }] }])] });
const history = (playerId: string, at: number | null): BallWorldFirstBaseRaceInput['runnerHistory'] => ({ playerId, originTick: 0, ticksPerSecond: 1_000_000,
  startElapsedSeconds: 0, endElapsedSeconds: 4, contactAtStart: false, contactAtHorizon: false,
  episodes: at === null ? [] : [{ startElapsedSeconds: at, endElapsedSeconds: at }], events: at === null ? [] : ['touch', 'departure'].map((kind) => ({
    kind: kind as 'touch' | 'departure', originTick: 0, elapsedSeconds: at, tick: quantizeEventTick(0, at, 1_000_000) })) });
const race = (controlAt = 2): BallWorldFirstBaseRaceInput => ({ outsAtStart: 0, batterRunnerId: 'batter', defenderIds: ['defender'], originTick: 0, ticksPerSecond: 1_000_000,
  horizonElapsedSeconds: 4, runnerHistory: history('batter', null), defenders: [{ history: history('defender', controlAt),
    controlledContacts: [{ playerId: 'defender', originTick: 0, elapsedSeconds: controlAt, tick: quantizeEventTick(0, controlAt, 1_000_000) }] }] });
it.each([[1.5, false], [2, false], [3, true], [null, true]] as const)('bounds pending legal contact at %s through the actual race decision', (pendingAt, resolved) => {
  const result = deriveBallWorldGroundFirstBaseRace({ ball: ball(pendingAt), race: race() });
  expect(result.ballEvidence.kind).toBe('grounded');
  expect(result.groundRule !== null).toBe(resolved);
  if (resolved) expect(result.groundRule?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'out', runnerTouchTick: null } });
});
it('preserves a completed race before a later legal contact sharing its recorded tick', () => {
  const result = deriveBallWorldGroundFirstBaseRace({ ball: ball(2.0000002), race: race(2.0000001) });
  expect(result.groundRule?.actualChronology.decisionMoment?.tick).toBe(quantizeEventTick(0, 2.0000002, 1_000_000));
  expect(result.groundRule?.correctRuleResult.kind).toBe('resolved');
});
it('requires actual ground as well as earlier territory and runner touch before resolving a ground-ball race', () => {
  const original = ball(null), earlier = { moment: moment(0.5), contacts: [{ kind: 'actor' as const, playerId: 'defender', role: 'glove' as const }] };
  const pending = { moment: moment(0.8), contacts: [{ kind: 'surface' as const, surfaceId: 'wall' }] };
  const runnerFirst = { ...race(), runnerHistory: history('batter', 0.75) };
  const result = deriveBallWorldGroundFirstBaseRace({ ball: { ...original, contacts: [earlier, pending, ...original.contacts] }, race: runnerFirst });
  expect(result.ballDecisionMoment?.elapsedSeconds).toBe(0.5);
  expect(result.firstGroundMoment?.elapsedSeconds).toBe(1);
  expect(result.groundRule).toBe(null);
});
it.each(['clock', 'horizon', 'batter', 'defenders'])('rejects a %s mismatch between original ball and complete Player race histories', (kind) => {
  const original = race(), changed = kind === 'clock' ? { ...original, originTick: 1 } : kind === 'horizon' ? { ...original, horizonElapsedSeconds: 5 }
    : kind === 'batter' ? { ...original, batterRunnerId: 'other' } : { ...original, defenderIds: ['other'] };
  expect(() => deriveBallWorldGroundFirstBaseRace({ ball: ball(null), race: changed })).toThrow();
});
