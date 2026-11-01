import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { createLiveRunnerMotionV1 } from '../running/LiveRunnerMotionV1';
import { reducePlayableMatchV1 } from '../../../integration/browser/PlayableMatchRulesV1';
import { asRuleProfileId } from '../../model/RuleProfileRef';

const fixture = (): LiveFieldPlayInputV1 => JSON.parse(readFileSync('docs/verification/releases/v95-investigation/throw/RF-34-43.json', 'utf8')).input;
const rfOutOpportunity = (): LiveFieldPlayInputV1 => {
  const raw = fixture();
  // V103's default .60s charge lets the actual release solve miss this old
  // race after the holder brakes. Use an explicit faster preparation for the
  // genuine out/error opportunity; ordinary 34m/s overrun cases keep defaults.
  return { ...raw, fielders: raw.fielders.map(f => ({ ...f, throwSpeedMps: 46, throwEffortBuildSecondsV103: .5 })) };
};
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const resultFor = (arm: number, battingSide: -1 | 1 = 1, blockSecond = false) => {
  const raw = fixture(), input: LiveFieldPlayInputV1 = { ...raw, frameSeconds: .02,
    fielders: raw.fielders.map(f => ({ ...f, throwSpeedMps: arm })),
    runners: [...raw.runners.map(r => ({ ...r, position: { ...r.position!, x: battingSide * Math.abs(r.position!.x) } })),
      ...(blockSecond ? [{ runnerId: 'stationary-second-control', initialBase: 2 as const, position: raw.field.bases.second,
        topSpeedMps: .1, accelerationMps2: 1, reactionSeconds: .18 }] : [])] };
  return { input, result: simulateLiveFieldPlayV1(input) };
};

describe('physical first-base overrun integration V95', () => {
  it.each([-1, 1] as const)('touches first before ordinary RF control and returns legally from batting side %s', side => {
    const { input, result } = resultFor(34, side, true), runner = input.runners[0], id = runner.runnerId,
      plans = result.diagnostics.aiTelemetry.runnerMotions.filter(p => p.runnerId === id), first = plans[0],
      touch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === id && f.base === 1);
    expect(result.end, JSON.stringify(result.end)).toMatchObject({ complete: true, reason: 'live_action_complete' });
    expect(touch).toBeDefined(); expect(first.throughBases).toEqual([1]);
    const motion = createLiveRunnerMotionV1({ position: first.position, velocity: first.velocity,
      bases: [{ base: 1, position: input.field.bases.first }], topSpeedMps: runner.topSpeedMps,
      accelerationMps2: runner.accelerationMps2, terminalMode: 'first-base-overrun', baseTouchRadiusMeters: input.field.baseTouchRadiusMeters ?? .28 })!;
    expect(motion).not.toBeNull();
    expect(touch!.elapsedSeconds).toBeCloseTo(first.elapsedSeconds + motion.touches[0].elapsedSeconds, 9);
    expect(distance(touch!.position!, input.field.bases.first)).toBeLessThanOrEqual(input.field.baseTouchRadiusMeters ?? .28);
    expect(distance(motion.sampleAtElapsedSeconds(motion.touches[0].elapsedSeconds - 1e-7).position, input.field.bases.first)).toBeGreaterThan(input.field.baseTouchRadiusMeters ?? .28);
    expect(result.finalRunners.find(r => r.runnerId === id)).toMatchObject({ base: 1, retired: false, scored: false });
    expect(plans).toHaveLength(1);
    expect(result.end.elapsedSeconds).toBeGreaterThanOrEqual(first.elapsedSeconds + motion.durationSeconds - 1e-8);
    const final = result.frames.at(-1)!.runners.find(r => r.runnerId === id)!;
    expect(distance(final.position, input.field.bases.first)).toBeLessThan(1e-8);
    expect(final.velocity).toEqual({ x: 0, y: 0, z: 0 });
    const departure = result.facts.find(f => f.kind === 'runner_base_departure' && f.runnerId === id && f.base === 1);
    expect(departure).toBeDefined(); expect(departure!.elapsedSeconds).toBeGreaterThan(touch!.elapsedSeconds);
    expect(result.ruleFacts.runnerTouches.filter(f => f.runnerId === id).map(f => f.base)).toEqual([1, 1]);
    const returned = result.facts.filter(f => f.kind === 'runner_base_touch' && f.runnerId === id && f.base === 1)[1];
    expect(returned.elapsedSeconds).toBeCloseTo(first.elapsedSeconds + motion.firstBaseOverrunV95!.returnTouchElapsedSeconds, 9);
    expect(returned.elapsedSeconds).toBeGreaterThan(departure!.elapsedSeconds);
    expect(distance(returned.position!, input.field.bases.first)).toBeLessThanOrEqual(input.field.baseTouchRadiusMeters ?? .28);
    const official = reducePlayableMatchV1({ match: { ruleProfileId: asRuleProfileId('v95-first-overrun'), inning: 1, half: 'top', outs: input.outs,
      balls: 0, strikes: 0, bases: { first: null, second: 'stationary-second-control', third: null }, score: { away: 0, home: 0 }, playId: 0 },
    batterRunnerId: id, event: { kind: 'field_play', facts: result.ruleFacts } });
    expect(official.kind, JSON.stringify(official)).toBe('applied');
    if (official.kind === 'applied') expect(official.match.bases.first).toBe(id);
    expect(result.ruleFacts.controlledRunnerTags.filter(f => f.runnerId === id)).toEqual([]);
    const afterTouch = result.frames.filter(f => f.elapsedSeconds > touch!.elapsedSeconds && f.elapsedSeconds < first.elapsedSeconds + motion.durationSeconds);
    expect(afterTouch.some(f => distance(f.runners.find(r => r.runnerId === id)!.position, input.field.bases.first) > 1)).toBe(true);
    for (const frame of afterTouch) {
      const actual = frame.runners.find(r => r.runnerId === id)!, expected = motion.sampleAtElapsedSeconds(frame.elapsedSeconds - first.elapsedSeconds);
      expect(distance(actual.position, expected.position)).toBeLessThan(1e-8);
      expect(distance(actual.velocity, expected.velocity)).toBeLessThan(1e-8);
      expect(actual.retired).toBe(false);
    }
  }, 60000);

  it('retains a genuine RF-to-first out when the actual stronger throw reaches the base first', () => {
    const input = { ...rfOutOpportunity(), frameSeconds: .02 }, result = simulateLiveFieldPlayV1(input), runnerId = input.runners[0].runnerId;
    expect(result.end.complete).toBe(true);
    expect(result.facts.find(f => f.kind === 'catch_secured')?.playerId).toBe('def-RF');
    expect(result.facts.find(f => f.kind === 'throw_release'), JSON.stringify({ commands: result.diagnostics.throwEffortCommandsV103,
      cancellations: result.diagnostics.throwEffortCancellationsV103, decisions: result.diagnostics.throwDecisions,
      relay: result.diagnostics.aiTelemetry.relayPlans, holder: result.diagnostics.aiTelemetry.holderDecisions.slice(-5) })).toMatchObject({ playerId: 'def-RF', base: 1 });
    expect(result.ruleFacts.controlledBaseContacts.some(f => f.base === 1)).toBe(true);
    expect(result.finalRunners.find(r => r.runnerId === runnerId)).toMatchObject({ retired: true, scored: false });
    expect(result.ruleFacts.runnerTouches.filter(f => f.runnerId === runnerId && f.base === 1)).toEqual([]);
  }, 60000);

  it('replaces first-base return motion with an ordinary second-base leg after a physical throw error', () => {
    // Use the genuine RF-to-first opportunity tested above. V99 correctly
    // declines the old fixture's pointless containment throw after a 5m leg.
    const raw = rfOutOpportunity(), input: LiveFieldPlayInputV1 = { ...raw,
        executionPerturbationsV95: { throwErrors: [{ releaseOrdinal: 0, yawRadians: .25, pitchRadians: 0 }] },
        runners: raw.runners.map(r => ({ ...r, advanceSafetyMarginSeconds: 0 })) },
      result = simulateLiveFieldPlayV1(input), id = input.runners[0].runnerId,
      touch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === id && f.base === 1),
      plans = result.diagnostics.aiTelemetry.runnerMotions.filter(p => p.runnerId === id),
      commit = plans.find(p => p.throughBases[0] === 2 && p.elapsedSeconds > (touch?.elapsedSeconds ?? Infinity));
    expect(touch).toBeDefined();
    expect(result.facts.find(f => f.kind === 'throw_release')?.base).toBe(1);
    expect(commit, JSON.stringify({ plans: plans.map(p => ({ at: p.elapsedSeconds, bases: p.throughBases })), facts: result.facts.filter(f => f.runnerId === id), final: result.finalRunners })).toBeDefined();
    expect(plans[0].terminalMode).toBe('first-base-overrun');
    expect(commit!.terminalMode).not.toBe('first-base-overrun');
    const ordinary = createLiveRunnerMotionV1({ position: commit!.position, velocity: commit!.velocity,
      bases: commit!.throughBases.map(base => ({ base, position: input.field.bases.second })),
      topSpeedMps: input.runners[0].topSpeedMps, accelerationMps2: input.runners[0].accelerationMps2 })!;
    expect(ordinary.firstBaseOverrunV95).toBeUndefined();
    expect(ordinary.route).toEqual(commit!.route);
    for (const frame of result.frames.filter(f => f.elapsedSeconds >= commit!.elapsedSeconds)) {
      const actual = frame.runners.find(r => r.runnerId === id)!, expected = ordinary.sampleAtElapsedSeconds(frame.elapsedSeconds - commit!.elapsedSeconds);
      expect(distance(actual.position, expected.position)).toBeLessThan(1e-8);
      expect(distance(actual.velocity, expected.velocity)).toBeLessThan(1e-8);
    }
    expect(result.finalRunners.find(r => r.runnerId === id)).toMatchObject({ base: 2, retired: false });
  }, 60000);
});
