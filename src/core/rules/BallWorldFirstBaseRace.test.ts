import { expect, it } from 'vitest';
import { resolveBallWorldFirstBaseRace } from './BallWorldFirstBaseRace';
import type { BallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import { quantizeEventTick } from '../sim/ExactEventTime';

const history = (playerId: string, at: number | null, endElapsedSeconds = 4): BallWorldPlayerBaseContactHistory => ({
  playerId, originTick: 0, ticksPerSecond: 1_000_000, startElapsedSeconds: 0, endElapsedSeconds,
  contactAtStart: at === 0, contactAtHorizon: at === endElapsedSeconds,
  episodes: at === null ? [] : [{ startElapsedSeconds: at, endElapsedSeconds: at }],
  events: at === null ? [] : [{ kind: 'touch', originTick: 0, elapsedSeconds: at, tick: quantizeEventTick(0, at, 1_000_000) },
    ...(at < endElapsedSeconds ? [{ kind: 'departure' as const, originTick: 0, elapsedSeconds: at, tick: quantizeEventTick(0, at, 1_000_000) }] : [])],
});
const input = (runnerAt: number | null = 3, controlAt: number | null = 2) => ({
  outsAtStart: 0, batterRunnerId: 'batter', defenderIds: ['defender'], originTick: 0, ticksPerSecond: 1_000_000, horizonElapsedSeconds: 4,
  runnerHistory: history('batter', runnerAt), defenders: [{ history: history('defender', controlAt),
    controlledContacts: controlAt === null ? [] : [{ playerId: 'defender', originTick: 0, elapsedSeconds: controlAt, tick: quantizeEventTick(0, controlAt, 1_000_000) }] }],
});
it('proves an early OUT with complete no-touch history without inventing a future arrival', () => {
  const result = resolveBallWorldFirstBaseRace(input(null));
  expect(result.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'out', outTick: 2_000_000, runnerTouchTick: null }, outsAfter: 1 });
  expect(result.physicalFacts.batterRunnerTouch).toBe(null);
});
it('proves SAFE without inventing later defender control', () => {
  const result = resolveBallWorldFirstBaseRace(input(1, null));
  expect(result.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'safe', touchTick: 1_000_000, defenderControlTick: null }, outsAfter: 0 });
  expect(result.physicalFacts.defenderControl).toBe(null);
});
it.each([[2, 3, 'safe'], [3, 2, 'out'], [2, 2, 'simultaneous']] as const)('uses actual %s/%s arrival order: %s', (runnerAt, controlAt, kind) => {
  expect(resolveBallWorldFirstBaseRace(input(runnerAt, controlAt)).correctRuleResult.batterRunnerFirstBase.kind).toBe(kind);
});
it('keeps distinct physical moments ordered when recorded ticks coincide', () => {
  const result = resolveBallWorldFirstBaseRace(input(2.0000002, 2.0000001));
  expect(result.physicalFacts.batterRunnerTouch?.tick).toBe(result.physicalFacts.defenderControl?.tick);
  expect(result.correctRuleResult.batterRunnerFirstBase.kind).toBe('out');
});
it('does not turn a no-contact execution horizon into a result or PlayEnd', () => {
  const result = resolveBallWorldFirstBaseRace(input(null, null));
  expect(result.correctRuleResult).toMatchObject({ kind: 'unresolved', outsAfter: 0 });
  expect(result).not.toHaveProperty('playEnd');
});
it('chooses the earliest actual owned defender instead of the requested array order', () => {
  const original = input(3, 2), other = history('earlier', 1);
  const result = resolveBallWorldFirstBaseRace({ ...original, defenderIds: ['defender', 'earlier'], defenders: [...original.defenders,
    { history: other, controlledContacts: [{ playerId: 'earlier', originTick: 0, elapsedSeconds: 1, tick: 1_000_000 }] }] });
  expect(result.physicalFacts.defenderControl).toMatchObject({ defenderId: 'earlier', tick: 1_000_000 });
});
it('preserves ambiguous simultaneous defender control instead of selecting a desired defender', () => {
  const original = input(null), other = history('other', 2);
  const result = resolveBallWorldFirstBaseRace({ ...original, defenderIds: ['defender', 'other'], defenders: [...original.defenders,
    { history: other, controlledContacts: [{ playerId: 'other', originTick: 0, elapsedSeconds: 2, tick: 2_000_000 }] }] });
  expect(result.correctRuleResult).toMatchObject({ kind: 'unresolved', batterRunnerFirstBase: { reason: 'simultaneous_defender_control' } });
});
it('retains the actual third-out consequence without fabricating a final closure', () => {
  const result = resolveBallWorldFirstBaseRace({ ...input(null), outsAtStart: 2 });
  expect(result.correctRuleResult).toMatchObject({ kind: 'resolved', outsAfter: 3, thirdOut: true });
  expect(result).not.toHaveProperty('officialClosure');
});
it.each(['partial', 'clock', 'horizon', 'missing_defender', 'wrong_batter', 'control_outside', 'injected_result'] as const)(
  'rejects %s outside complete original race history', (kind) => {
    const original = input();
    const changed = kind === 'partial' ? { ...original, runnerHistory: { ...original.runnerHistory, startElapsedSeconds: 1 } }
      : kind === 'clock' ? { ...original, originTick: 1 }
        : kind === 'horizon' ? { ...original, horizonElapsedSeconds: 5 }
          : kind === 'missing_defender' ? { ...original, defenders: [] }
            : kind === 'wrong_batter' ? { ...original, batterRunnerId: 'other' }
              : kind === 'control_outside' ? { ...original, defenders: [{ ...original.defenders[0], controlledContacts: [{ playerId: 'defender', originTick: 0, elapsedSeconds: 1, tick: 1_000_000 }] }] }
                : { ...original, out: true };
    expect(() => resolveBallWorldFirstBaseRace(changed)).toThrow();
  });
