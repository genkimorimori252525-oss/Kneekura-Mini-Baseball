import { expect, it } from 'vitest';
import { DeterministicRng } from '../../rng/DeterministicRng';
import { SeedRoot } from '../../rng/SeedRoot';
import { quantizeEventTick } from '../ExactEventTime';
import { playerObservationCalibrationFixture } from './PlayerObservationCalibrationFixtures.test-support';
import { captureTemporalObservation } from './ObservationCapture';
import { createFirstBaseUmpireCalibration, perceiveFirstBasePlay, classifyPerceivedFirstBasePlay,
  resolveFirstBaseCallSchedule, type FirstBaseUmpireCalibration, type FirstBasePerceptionInput } from './FirstBaseUmpirePerception';

const calibration = (error = 0): FirstBaseUmpireCalibration => {
  const p = playerObservationCalibrationFixture();
  return { version: 'first_base_timing_triangular_v1', perceptionAbility: 0.8,
    geometryParameters: p.geometryParameters, qualityParameters: p.qualityParameters,
    timingErrorParameters: { minimumDetectionQuality: 0.1, minimumTimeErrorSeconds: error, maximumTimeErrorSeconds: error },
    callDelaySeconds: 0.0000001 };
};
const input = (control = 0.0625001, touch = 0.0625002): FirstBasePerceptionInput => ({
  clock: { originTick: 50, ticksPerSecond: 1_000_000 }, observedAtElapsedSeconds: Math.max(control, touch) + 0.0000001,
  calibration: calibration(), view: { position: { x: 0, y: 2, z: 0 }, forward: { x: 0, y: 0, z: 1 }, velocity: { x: 0, y: 0, z: 0 } },
  attention: { control: 1, touch: 1 }, events: {
    control: { elapsedSeconds: control, target: { position: { x: 0, y: 0.1, z: 5 }, velocity: { x: 0, y: 0, z: 0 } }, occluders: [] },
    touch: { elapsedSeconds: touch, target: { position: { x: 0, y: 0.1, z: 5 }, velocity: { x: 4, y: 0, z: 0 } }, occluders: [] },
  },
});
const perceive = (value = input(), seed = 7) => {
  const root = new SeedRoot(seed);
  return perceiveFirstBasePlay(value, { control: root.streamRng(2, 'perception', 'umpire:control'),
    touch: root.streamRng(2, 'perception', 'umpire:touch') });
};

it('captures seconds-domain error with the established symmetric-triangular law and no zero-noise default', () => {
  const rng = new DeterministicRng(7), expected = (rng.nextFloat() - rng.nextFloat()) * 0.15;
  const actual = captureTemporalObservation(2, 100, 0.5, new DeterministicRng(7), {
    minimumDetectionQuality: 0.1, minimumTimeErrorSeconds: 0.1, maximumTimeErrorSeconds: 0.2,
  });
  expect(actual).toEqual({ estimate: 2 + expected, observedAt: 100, confidence: 0.5 });
  expect(() => captureTemporalObservation(2, 100, 0.5, new DeterministicRng(7), undefined as never)).toThrow();
});

it.each([[0.0625001, 0.0625002, 'out'], [0.0625002, 0.0625001, 'safe'], [0.0625001, 0.0625001, 'simultaneous']] as const)(
  'classifies only perceived exact ordering %s/%s as %s even inside one authoritative tick', (control, touch, kind) => {
    const result = perceive(input(control, touch));
    expect(result.kind).toBe('perceived');
    expect(classifyPerceivedFirstBasePlay(result)).toBe(kind);
    expect(quantizeEventTick(50, control, 1_000_000)).toBe(quantizeEventTick(50, touch, 1_000_000));
    expect(result).not.toHaveProperty('correctRuleResult'); expect(result).not.toHaveProperty('trueEventDifference');
  });

it('can reproducibly miscall a close play without altering any event truth or another RNG stream', () => {
  const value = { ...input(), calibration: calibration(0.01) }, bytes = JSON.stringify(value);
  const root = new SeedRoot(11), physics = root.streamRng(2, 'batted_ball', 'physical');
  const first = physics.nextFloat();
  const samples = Array.from({ length: 30 }, (_, seed) => perceive(value, seed));
  expect(samples.some(sample => classifyPerceivedFirstBasePlay(sample) === 'safe')).toBe(true);
  expect(samples.some(sample => classifyPerceivedFirstBasePlay(sample) === 'out')).toBe(true);
  expect(perceive(value, 7)).toEqual(perceive(value, 7)); expect(JSON.stringify(value)).toBe(bytes);
  const unchanged = root.streamRng(2, 'batted_ball', 'physical');
  expect(unchanged.nextFloat()).toBe(first); expect(physics.nextFloat()).toBe(unchanged.nextFloat());
  const obvious = { ...input(1, 2), calibration: calibration(0.01) };
  expect(Array.from({ length: 30 }, (_, seed) => classifyPerceivedFirstBasePlay(perceive(obvious, seed))))
    .toEqual(Array(30).fill('out'));
});

it('pose, attention, duration, ability and relative speed affect uncertainty through existing quality', () => {
  const base = { ...input(), calibration: { ...calibration(), timingErrorParameters: {
    minimumDetectionQuality: 0, minimumTimeErrorSeconds: 0, maximumTimeErrorSeconds: 0.1,
  } } }, result = perceive(base);
  if (result.kind !== 'perceived') throw new Error('synthetic visible input');
  const lower = perceive({ ...base, attention: { control: 0, touch: 0 }, calibration: { ...base.calibration, perceptionAbility: 0 } });
  if (lower.kind !== 'perceived') throw new Error('synthetic still detectable input');
  expect(lower.control.confidence).toBeLessThan(result.control.confidence);
  expect(Math.abs(lower.control.estimate - base.events!.control.elapsedSeconds)).toBeGreaterThan(
    Math.abs(result.control.estimate - base.events!.control.elapsedSeconds));
  const blind = perceive({ ...base, view: { ...base.view!, forward: { x: 0, y: 0, z: -1 } } });
  expect(blind).toEqual({ kind: 'undetectable', cue: 'control' });
  expect(perceive({ ...base, events: { ...base.events!, touch: { ...base.events!.touch,
    occluders: [{ center: { x: 0, y: 1, z: 2.5 }, radiusMeters: 1 }] } } })).toEqual({ kind: 'undetectable', cue: 'touch' });
});

it.each(['calibration', 'view', 'attention', 'events'] as const)('withholds a call for missing %s rather than using truth or perfect defaults', (key) => {
  const result = perceive({ ...input(), [key]: null });
  expect(result.kind).toBe('pending'); expect(classifyPerceivedFirstBasePlay(result)).toBeNull();
});

it('requires explicit complete inert calibration and rejects correctness-rate/ruling injection', () => {
  expect(createFirstBaseUmpireCalibration(calibration())).toEqual(calibration());
  expect(Object.isFrozen(createFirstBaseUmpireCalibration(calibration()).timingErrorParameters)).toBe(true);
  for (const changed of [{ ...calibration(), correctnessRate: 0.9 }, { ...calibration(), callDelaySeconds: -1 },
    { ...calibration(), timingErrorParameters: { minimumDetectionQuality: 0.1, minimumTimeErrorSeconds: 1, maximumTimeErrorSeconds: 0 } }]) {
    expect(() => createFirstBaseUmpireCalibration(changed)).toThrow();
  }
  expect(() => perceive({ ...input(), correctRuleResult: 'out' } as never)).toThrow();
  expect(() => classifyPerceivedFirstBasePlay({ ...perceive(), ruling: 'out' } as never)).toThrow();
  let read = false;
  const getter = Object.defineProperty({}, 'version', { enumerable: true, get() { read = true; return 'first_base_timing_triangular_v1'; } });
  expect(() => createFirstBaseUmpireCalibration(getter as never)).toThrow(); expect(read).toBe(false);
});

it('separates pair occurrence, observation availability, scheduled call and exact adopted call availability', () => {
  const value = input(), perceived = perceive(value), due = value.observedAtElapsedSeconds + value.calibration!.callDelaySeconds;
  const pending = resolveFirstBaseCallSchedule(perceived, value.calibration!, value.clock, due - 0.00000001);
  expect(pending).toMatchObject({ kind: 'scheduled', calledAtElapsedSeconds: due });
  const called = resolveFirstBaseCallSchedule(perceived, value.calibration!, value.clock, due);
  expect(called).toEqual({ kind: 'called', call: 'out', calledAtElapsedSeconds: due,
    availableAtElapsedSeconds: due, tick: quantizeEventTick(50, due, 1_000_000) });
  expect(quantizeEventTick(50, due - 0.00000001, 1_000_000)).toBe(called.kind === 'called' ? called.tick : -1);
  expect(() => perceive({ ...value, observedAtElapsedSeconds: value.events!.control.elapsedSeconds })).toThrow(/availability/);
  expect(resolveFirstBaseCallSchedule(perceive(input(1, 1)), calibration(), value.clock, 10))
    .toEqual({ kind: 'pending', reason: 'perceived_simultaneity' });
});
