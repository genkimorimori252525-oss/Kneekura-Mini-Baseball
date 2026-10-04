import { expect, it } from 'vitest';
import { createPlayerDecisionCalibration } from './PlayerDecisionCalibration';
import { playerDecisionCalibrationFixture as fixture } from './PlayerDecisionCalibrationFixtures.test-support';
import { resolveDefensiveDecisionTiming } from './DefensiveDecisionTiming';
import { resolveDefenderFirstStepTiming } from './DefenderFirstStepTiming';
import { generateDefensiveIntentCandidates, type DefensiveDecisionInput } from './DefensiveDecision';

it('owns detached immutable explicit calibration while ratings and contextual plans keep their existing owners', () => {
  const raw = fixture(), value = createPlayerDecisionCalibration(raw);
  expect(value).toEqual(raw); expect(value).not.toBe(raw);
  expect(value.decisionTimingParameters).not.toBe(raw.decisionTimingParameters);
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value.decisionTimingParameters)).toBe(true);
  expect(Object.isFrozen(value.firstStepTimingParameters)).toBe(true);
  (raw.decisionTimingParameters as { maximumDecisionDelayTicks: number }).maximumDecisionDelayTicks = 999;
  expect(value.decisionTimingParameters.maximumDecisionDelayTicks).toBe(100);
  expect(Object.keys(value).sort()).toEqual(['communicationTrust', 'decisionTimingParameters', 'firstStepTimingParameters', 'minimumCueConfidence']);
});
it('feeds the existing timing algorithms with independent awareness and first-step abilities', () => {
  const c = createPlayerDecisionCalibration(fixture());
  const slow = resolveDefensiveDecisionTiming(1000, 0, c.decisionTimingParameters);
  const fast = resolveDefensiveDecisionTiming(1000, 1, c.decisionTimingParameters);
  expect(slow.decisionTick).toBe(1105); expect(fast.decisionTick).toBe(1025);
  expect(resolveDefenderFirstStepTiming(slow.decisionTick, 1, c.firstStepTimingParameters).movementStartTick).toBe(1117);
  expect(resolveDefenderFirstStepTiming(fast.decisionTick, 0, c.firstStepTimingParameters).movementStartTick).toBe(1077);
});
it('passes explicit cue confidence and communication trust to the existing local candidate algorithm', () => {
  const c = createPlayerDecisionCalibration(fixture());
  const input: DefensiveDecisionInput = {
    perceivedWorld: { observerId: 'player-a', observationTime: 100, ball: null, players: [], attention: { target: { kind: 'ball' }, focusedSinceTick: 0 },
      knownContext: { outs: 0, occupiedBases: [] }, communications: [{ receivedAt: 90, confidence: 0.5,
        event: { sourceId: 'call', issuedAt: 80, targetScope: { kind: 'player', playerId: 'player-a' },
          kind: 'callout', content: { kind: 'cover_base', base: 1 } } }] },
    self: { playerId: 'player-a', registeredPosition: '1B', position: { x: 0, z: 0 } },
    prePlayPlan: { ballPursuitPriority: 1, baseCoverPriorities: [{ base: 1, priority: 1 }],
      relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 }, perceivedCues: [],
    minimumCueConfidence: c.minimumCueConfidence, communicationTrust: c.communicationTrust,
  };
  expect(generateDefensiveIntentCandidates(input).find((v) => v.intent.kind === 'base_cover')?.localPriority).toBe(0.4);
  expect(generateDefensiveIntentCandidates({ ...input, minimumCueConfidence: 0.6 }).map((v) => v.intent.kind)).toEqual(['hold']);
});

const paths = [
  ['decisionTimingParameters', 'minimumDecisionDelayTicks'], ['decisionTimingParameters', 'maximumDecisionDelayTicks'],
  ['decisionTimingParameters', 'fixedProcessingOffsetTicks'], ['firstStepTimingParameters', 'minimumFirstStepDelayTicks'],
  ['firstStepTimingParameters', 'maximumFirstStepDelayTicks'], ['firstStepTimingParameters', 'fixedMotorOffsetTicks'],
  ['minimumCueConfidence'], ['communicationTrust'],
];
const edit = (path: string[], value: unknown, remove = false) => {
  const raw = fixture(); let parent = raw as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[path.at(-1)!]; else parent[path.at(-1)!] = value;
  return raw;
};
it.each(paths)('requires every explicit finite numeric parameter: %j', (...path) => {
  expect(() => createPlayerDecisionCalibration(edit(path, null, true))).toThrow();
  for (const value of [NaN, Infinity, -Infinity, '0', null, undefined, -1]) {
    expect(() => createPlayerDecisionCalibration(edit(path, value))).toThrow();
  }
});
it.each(paths.slice(0, 6))('requires safe integer timing: %j', (...path) => {
  for (const value of [0.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => createPlayerDecisionCalibration(edit(path, value))).toThrow();
});
it.each(['minimumCueConfidence', 'communicationTrust'])('rejects out-of-unit %s', (key) => {
  expect(() => createPlayerDecisionCalibration(edit([key], 1.01))).toThrow();
});
it.each([
  ['decisionTimingParameters', 'minimumDecisionDelayTicks', 101],
  ['firstStepTimingParameters', 'minimumFirstStepDelayTicks', 51],
] as const)('rejects inverted range %s', (group, key, value) => {
  expect(() => createPlayerDecisionCalibration(edit([group, key], value))).toThrow();
});
it.each(['decision', 'first-step', 'combined'] as const)('rejects unsafe derived %s delay using actual timing arithmetic', (kind) => {
  const zero = {
    decisionTimingParameters: { minimumDecisionDelayTicks: 0, maximumDecisionDelayTicks: 0, fixedProcessingOffsetTicks: 0 },
    firstStepTimingParameters: { minimumFirstStepDelayTicks: 0, maximumFirstStepDelayTicks: 0, fixedMotorOffsetTicks: 0 },
    minimumCueConfidence: 0, communicationTrust: 1,
  };
  if (kind === 'decision') Object.assign(zero.decisionTimingParameters, { maximumDecisionDelayTicks: Number.MAX_SAFE_INTEGER, fixedProcessingOffsetTicks: 1 });
  if (kind === 'first-step') Object.assign(zero.firstStepTimingParameters, { maximumFirstStepDelayTicks: Number.MAX_SAFE_INTEGER, fixedMotorOffsetTicks: 1 });
  if (kind === 'combined') {
    zero.decisionTimingParameters.maximumDecisionDelayTicks = Number.MAX_SAFE_INTEGER;
    zero.firstStepTimingParameters.maximumFirstStepDelayTicks = 1;
  }
  expect(() => createPlayerDecisionCalibration(zero)).toThrow(/safe integer/);
});
it('allows zero delay and the safe arithmetic boundary without an invented magnitude limit', () => {
  const raw = { decisionTimingParameters: { minimumDecisionDelayTicks: 0, maximumDecisionDelayTicks: Number.MAX_SAFE_INTEGER, fixedProcessingOffsetTicks: 0 },
    firstStepTimingParameters: { minimumFirstStepDelayTicks: 0, maximumFirstStepDelayTicks: 0, fixedMotorOffsetTicks: 0 },
    minimumCueConfidence: 0, communicationTrust: 1 };
  expect(createPlayerDecisionCalibration(raw)).toEqual(raw);
  raw.decisionTimingParameters.maximumDecisionDelayTicks = 0;
  expect(createPlayerDecisionCalibration(raw)).toEqual(raw);
});
it.each(['', 'decisionTimingParameters', 'firstStepTimingParameters'])('rejects extra, missing, array and delimiter-aliased fields at %s', (group) => {
  for (const kind of ['extra', 'missing', 'array', 'alias']) {
    const raw = fixture(), target = (group ? (raw as unknown as Record<string, unknown>)[group] : raw) as Record<string, unknown>;
    if (kind === 'extra') target.prePlayPlan = {};
    if (kind === 'missing') delete target[Object.keys(target)[0]];
    if (kind === 'alias') {
      const key = Object.keys(target).sort().join('|'); Object.keys(target).forEach((name) => delete target[name]); target[key] = 0;
    }
    const value = kind === 'array' ? group ? { ...raw, [group]: [] } : [] : raw;
    expect(() => createPlayerDecisionCalibration(value as never)).toThrow();
  }
});
it('rejects executable, symbolic, non-enumerable, inherited and cyclic input without invoking accessors', () => {
  const raw = fixture(); let called = false;
  Object.defineProperty(raw.decisionTimingParameters, 'maximumDecisionDelayTicks', { enumerable: true, get() { called = true; return 100; } });
  expect(() => createPlayerDecisionCalibration(raw)).toThrow(); expect(called).toBe(false);
  expect(() => createPlayerDecisionCalibration(Object.assign(Object.create({ hidden: true }), fixture()))).toThrow();
  const hidden = fixture(); Object.defineProperty(hidden, 'hidden', { value: 1 });
  expect(() => createPlayerDecisionCalibration(hidden)).toThrow();
  const symbol = fixture(); Object.assign(symbol, { [Symbol('hidden')]: 1 });
  expect(() => createPlayerDecisionCalibration(symbol)).toThrow();
  const cyclic = fixture(); Object.assign(cyclic, { cycle: cyclic });
  expect(() => createPlayerDecisionCalibration(cyclic)).toThrow();
});
