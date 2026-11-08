import { afterEach, expect, it, vi } from 'vitest';
import * as field from '../../core/sim/fielding/LiveFieldPlayV1';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, type LivePitchCommandV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

const command = { batting: 'balanced', pitchType: 'auto', location: 'auto', managedTeam: 0 } as const;
afterEach(() => vi.restoreAllMocks());

it.each([
  ['conservative', .60], ['balanced', .35], ['aggressive', .10],
] as const)('projects %s into the actual runner decision input without changing motor limits', (baserunning, expected) => {
  const input = liveMatchFixture(1234), before = JSON.stringify(input), spy = vi.spyOn(field, 'simulateLiveFieldPlayV1');
  const record = createLiveBaseballMatchV1(input).issuePitch({ ...command, baserunning });
  expect(spy).toHaveBeenCalledOnce();
  const runner = spy.mock.calls[0][0].runners[0], source = input.players.find(p => p.playerId === runner.runnerId)!.physical ?? LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1;
  expect(runner.advanceSafetyMarginSeconds).toBeCloseTo(expected, 10);
  expect(runner.topSpeedMps).toBe(source.topSpeedMps);
  expect(runner.accelerationMps2).toBe(source.accelerationMps2);
  expect(runner.reactionSeconds).toBe(source.reactionSeconds);
  expect(record.play.diagnostics).toMatchObject({ managerBaserunning: { instruction: baserunning, appliedToOffense: true } });
  expect(JSON.stringify(input)).toBe(before);
});

it('keeps old omitted instructions equivalent to balanced and never applies a defensive manager order to the opponent', () => {
  const spy = vi.spyOn(field, 'simulateLiveFieldPlayV1');
  const old = createLiveBaseballMatchV1(liveMatchFixture(1234)).issuePitch(command);
  const balanced = createLiveBaseballMatchV1(liveMatchFixture(1234)).issuePitch({ ...command, baserunning: 'balanced' });
  expect(balanced.play).toEqual(old.play);
  createLiveBaseballMatchV1(liveMatchFixture(1234)).issuePitch({ ...command, managedTeam: 1, baserunning: 'aggressive' });
  expect(spy.mock.calls[2][0].runners).toEqual(spy.mock.calls[0][0].runners);
});

it.each([[0, 'aggressive', 0], [3, 'conservative', 3]] as const)('bounds the instruction around existing individual margin %s', (base, baserunning, expected) => {
  const raw = liveMatchFixture(1234), input = { ...raw, players: raw.players.map(p => ({ ...p, physical: { ...(p.physical ?? LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1), baserunningSafetyMarginSeconds: base } })) };
  const spy = vi.spyOn(field, 'simulateLiveFieldPlayV1');
  createLiveBaseballMatchV1(input).issuePitch({ ...command, baserunning });
  expect(spy.mock.calls[0][0].runners[0].advanceSafetyMarginSeconds).toBe(expected);
});

it('rejects unknown running instructions before issuing a pitch', () => {
  const host = createLiveBaseballMatchV1(liveMatchFixture());
  expect(() => host.issuePitch({ ...command, baserunning: 'always-run' } as unknown as LivePitchCommandV1)).toThrow('invalid manager baserunning command');
  expect(host.inspect().pitchCount).toBe(0);
});
