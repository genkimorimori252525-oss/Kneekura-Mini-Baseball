import { expect, it } from 'vitest';
import * as decisions from './RunnerDecision';
import type { RunnerDecisionInput } from './RunnerDecision';
import type { RunnerPartialTagUpWaitInput } from './RunnerPartialTagUpWaitContracts.test-support';
import { corePartialWaitInput, requireCorePartialWait } from './RunnerPartialTagUpWaitFixture.test-support';

// Core interoperability/validation only. No sensor, available Native receipt or adopted motor is asserted here.
it('selects the complete existing hold and timing result with explicitly unavailable force and cues', () => {
  const choose = requireCorePartialWait(decisions), input = corePartialWaitInput();
  expect(choose(input)).toEqual({ motionIntent: { kind: 'hold', issuedTick: 2_070_000 }, reason: 'tag_up_wait',
    evidenceAvailableAt: 2_000_000, decisionTick: 2_070_000, perceivedRaceMarginTicks: null });
});

it.each([true, false] as const)('matches legacy tag-up priority even when the legacy force boolean is %s', forcedToAdvance => {
  const choose = requireCorePartialWait(decisions), input = corePartialWaitInput();
  const legacy: RunnerDecisionInput = { runnerId: input.runnerId,
    perceivedWorld: { ...input.perceivedWorld, knownContext: { currentBase: 1, nextBase: 2,
      forcedToAdvance, tagUp: { kind: 'awaiting_first_touch' } }, communications: [{
      event: { sourceId: 'core-test-coach', targetScope: { kind: 'player', playerId: input.runnerId },
        kind: 'coach_signal', issuedAt: 1_900_000, content: { kind: 'runner_action', action: 'advance' } },
      receivedAt: 1_950_000, confidence: 1 }] },
    perceivedCues: [{ kind: 'current_base_threat', observedAt: 1_980_000, confidence: 1,
      runnerReturnTick: 2_200_000, defenderTagTick: 2_100_000 },
    { kind: 'next_base_race', observedAt: 1_980_000, confidence: 1, runnerArrivalTick: 2_100_000, defenderControlTick: null }],
    minimumCueConfidence: input.minimumCueConfidence, coachTrust: input.coachTrust,
    minimumAdvanceSafetyMarginTicks: input.minimumAdvanceSafetyMarginTicks, decisionAbility: input.decisionAbility,
    timingParameters: input.timingParameters };
  expect(choose(input)).toEqual(decisions.decideRunnerMotionIntent(legacy));
});

it('uses actual consumption time rather than an earlier remembered sample time for the wait decision', () => {
  const choose = requireCorePartialWait(decisions), input = corePartialWaitInput();
  const remembered: RunnerPartialTagUpWaitInput = { ...input, perceivedWorld: { ...input.perceivedWorld,
    ball: { estimate: { position: { x: 0, y: 1, z: 2 }, velocity: { x: 0, y: 1, z: 1 } },
      sourceObservedAt: 1_000_000, predictedAt: 2_000_000, confidence: 0.8 } } };
  expect(choose(remembered)).toEqual(choose(input));
  expect(choose(remembered).evidenceAvailableAt).toBe(2_000_000);
});

it('shifts evidence and cognitive decision together when actual consumption is later', () => {
  const choose = requireCorePartialWait(decisions), first = choose(corePartialWaitInput()), later = choose(corePartialWaitInput(2_050_000));
  expect(later.motionIntent.kind).toBe('hold'); expect(later.reason).toBe('tag_up_wait');
  expect(later.evidenceAvailableAt - first.evidenceAvailableAt).toBe(50_000);
  expect(later.decisionTick - first.decisionTick).toBe(50_000);
  expect(later.motionIntent.issuedTick).toBe(later.decisionTick);
});

it('changes only existing cognitive timing with decision ability and never turns wait into settlement', () => {
  const choose = requireCorePartialWait(decisions), input = corePartialWaitInput();
  const slow = choose({ ...input, decisionAbility: 0 }), fast = choose({ ...input, decisionAbility: 1 });
  expect(slow).toEqual({ motionIntent: { kind: 'hold', issuedTick: 2_190_000 }, reason: 'tag_up_wait',
    evidenceAvailableAt: 2_000_000, decisionTick: 2_190_000, perceivedRaceMarginTicks: null });
  expect(fast).toEqual({ motionIntent: { kind: 'hold', issuedTick: 2_040_000 }, reason: 'tag_up_wait',
    evidenceAvailableAt: 2_000_000, decisionTick: 2_040_000, perceivedRaceMarginTicks: null });
  for (const key of ['settledForPlay', 'playEnd', 'retirement', 'safe', 'controller', 'motor', 'adoption']) {
    expect(slow).not.toHaveProperty(key); expect(fast).not.toHaveProperty(key);
  }
});

it('leaves unavailable knowledge and the original perceived input unchanged across repeated choices', () => {
  const choose = requireCorePartialWait(decisions), input = corePartialWaitInput(), original = structuredClone(input);
  expect(choose(input)).toEqual(choose(input)); expect(input).toEqual(original);
  expect(input.perceivedWorld.knownContext.forceKnowledge).toEqual({ status: 'unavailable', reason: 'fair_foul_unresolved' });
  expect(input.cueKnowledge).toEqual({ status: 'unavailable', reason: 'producer_not_connected' });
});

it.each(['unknown_version', 'tag_none', 'tag_retouch', 'force_missing', 'force_known_true', 'force_known_false',
  'cue_completed', 'force_boolean', 'inline_cues', 'scheduled_state', 'observer_mismatch', 'nonadjacent_base',
  'fractional_time', 'settled_result'] as const)
('rejects %s without reaching force, coach, race or no-action fallback', mutation => {
  const choose = requireCorePartialWait(decisions), raw: any = structuredClone(corePartialWaitInput());
  if (mutation === 'unknown_version') raw.version = 'runner_partial_tag_up_wait_v2';
  if (mutation === 'tag_none') raw.perceivedWorld.knownContext.tagUp = { kind: 'none' };
  if (mutation === 'tag_retouch') raw.perceivedWorld.knownContext.tagUp = { kind: 'must_retouch', originBase: 1 };
  if (mutation === 'force_missing') delete raw.perceivedWorld.knownContext.forceKnowledge;
  if (mutation === 'force_known_true' || mutation === 'force_known_false') {
    raw.perceivedWorld.knownContext.forceKnowledge = { status: 'known', forcedToAdvance: mutation === 'force_known_true' };
  }
  if (mutation === 'cue_completed') raw.cueKnowledge = { status: 'complete', cues: [] };
  if (mutation === 'force_boolean') raw.perceivedWorld.knownContext.forcedToAdvance = false;
  if (mutation === 'inline_cues') raw.perceivedCues = [{ kind: 'next_base_race', defenderControlTick: null }];
  if (mutation === 'scheduled_state') raw.sensorState = 'scheduled';
  if (mutation === 'observer_mismatch') raw.perceivedWorld.observerId = 'foreign';
  if (mutation === 'nonadjacent_base') raw.perceivedWorld.knownContext.nextBase = 3;
  if (mutation === 'fractional_time') raw.perceivedWorld.observationTime += 0.5;
  if (mutation === 'settled_result') raw.settledForPlay = true;
  expect(() => choose(raw as RunnerPartialTagUpWaitInput)).toThrow();
});

it.each(['version', 'forceKnowledge', 'timing'] as const)('rejects a %s accessor before invoking it', location => {
  const choose = requireCorePartialWait(decisions), raw: any = structuredClone(corePartialWaitInput()); let calls = 0;
  const target = location === 'version' ? raw : location === 'forceKnowledge' ? raw.perceivedWorld.knownContext : raw.timingParameters;
  const key = location === 'timing' ? 'minimumDecisionDelayTicks' : location;
  Object.defineProperty(target, key, { enumerable: true, get() { calls += 1; return location === 'timing' ? 30_000 : null; } });
  expect(() => choose(raw as RunnerPartialTagUpWaitInput)).toThrow(); expect(calls).toBe(0);
});

it('rejects an aliased root key instead of accepting a different partial shape', () => {
  const choose = requireCorePartialWait(decisions), raw: any = structuredClone(corePartialWaitInput());
  delete raw.runnerId; delete raw.cueKnowledge; raw['runnerId|cueKnowledge'] = 'runner';
  expect(() => choose(raw as RunnerPartialTagUpWaitInput)).toThrow();
});

it('rejects cognitive tick overflow at an actual nonzero near-limit consumption time', () => {
  const choose = requireCorePartialWait(decisions), raw = corePartialWaitInput(Number.MAX_SAFE_INTEGER - 60_000);
  expect(() => choose(raw)).toThrow();
});

it.each(['ability', 'timing'] as const)('rejects invalid required %s calibration without choosing a default wait', field => {
  const choose = requireCorePartialWait(decisions), input = corePartialWaitInput();
  const invalid = field === 'ability' ? { ...input, decisionAbility: NaN }
    : { ...input, timingParameters: { ...input.timingParameters, minimumDecisionDelayTicks: 0.5 } };
  expect(() => choose(invalid)).toThrow();
});
