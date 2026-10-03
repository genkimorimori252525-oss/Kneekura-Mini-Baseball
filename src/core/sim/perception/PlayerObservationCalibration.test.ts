import { expect, it } from 'vitest';
import { createPlayerObservationCalibration } from './PlayerObservationCalibration';
import { playerObservationCalibrationFixture as fixture } from './PlayerObservationCalibrationFixtures.test-support';
import { isObservationRefreshDue } from './Observation';
import { evaluateObservationGeometry } from './ObservationGeometry';
import { composeObservationQuality } from './ObservationQuality';
import { captureSpatialObservation } from './ObservationCapture';
import { predictSpatialObservationMemory } from './ObservationMemory';
import { DeterministicRng } from '../../rng/DeterministicRng';

it('owns a detached deeply immutable calibration without ratings or live observer state', () => {
  const raw = fixture(), value = createPlayerObservationCalibration(raw);
  expect(value).toEqual(raw); expect(value).not.toBe(raw);
  expect(value.qualityParameters.weights).not.toBe(raw.qualityParameters.weights);
  expect(Object.isFrozen(value)).toBe(true);
  for (const field of Object.values(value)) if (typeof field === 'object') expect(Object.isFrozen(field)).toBe(true);
  expect(Object.isFrozen(value.qualityParameters.weights)).toBe(true);
  (raw.qualityParameters.weights as { ability: number }).ability = 9;
  expect(value.qualityParameters.weights.ability).toBe(1);
  expect(value).not.toHaveProperty('ratings'); expect(value).not.toHaveProperty('situationalAwareness');
  expect(value).not.toHaveProperty('attention'); expect(value).not.toHaveProperty('view');
});
it('feeds the existing refresh, geometry, quality, capture and memory algorithms without defaults', () => {
  const c = createPlayerObservationCalibration(fixture());
  expect(isObservationRefreshDue({ target: { kind: 'ball' }, attention: { target: { kind: 'ball' }, focusedSinceTick: 0 },
    lastObservedAt: 0, currentTick: 10, policy: c.refreshPolicy })).toBe(true);
  const truth = { position: { x: 5, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
  const geometry = evaluateObservationGeometry({ position: { x: 0, y: 0, z: 0 },
    forward: { x: 1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }, truth, c.geometryParameters);
  const quality = composeObservationQuality({ ...geometry, occlusionVisibility: 1, attentionQuality: 0.5,
    observationDurationSeconds: 0.5, perceptionAbility: c.perceptionAbility }, c.qualityParameters);
  expect(quality.totalQuality).toBeCloseTo(0.796);
  const sample = captureSpatialObservation(truth, 10, quality.totalQuality, new DeterministicRng(42), c.errorParameters)!;
  expect(sample).toEqual(captureSpatialObservation(truth, 10, quality.totalQuality, new DeterministicRng(42), c.errorParameters));
  expect(sample.estimate).not.toEqual(truth);
  expect(predictSpatialObservationMemory(sample, 1010, c.memoryDecayParameters).confidence).toBeCloseTo(0.696);
  expect(truth.position).toEqual({ x: 5, y: 0, z: 0 });
});

const paths = [
  ['perceptionAbility'],
  ['refreshPolicy', 'attendedIntervalTicks'], ['refreshPolicy', 'peripheralIntervalTicks'],
  ['geometryParameters', 'fullQualityHalfAngleRadians'], ['geometryParameters', 'maxVisibleHalfAngleRadians'],
  ['geometryParameters', 'fullQualityDistanceMeters'], ['geometryParameters', 'maxObservableDistanceMeters'],
  ['geometryParameters', 'fullQualityRelativeSpeedMps'], ['geometryParameters', 'maxRelativeSpeedMps'],
  ['qualityParameters', 'instantaneousDurationQuality'], ['qualityParameters', 'fullQualityObservationDurationSeconds'],
  ['qualityParameters', 'minimumAbilityQuality'],
  ...['distance', 'relativeSpeed', 'attention', 'duration', 'ability'].map((key) => ['qualityParameters', 'weights', key]),
  ['errorParameters', 'minimumDetectionQuality'], ['errorParameters', 'minimumPositionErrorMeters'],
  ['errorParameters', 'maximumPositionErrorMeters'], ['errorParameters', 'minimumVelocityErrorMps'], ['errorParameters', 'maximumVelocityErrorMps'],
  ['memoryDecayParameters', 'ticksPerSecond'], ['memoryDecayParameters', 'confidenceLossPerSecond'], ['memoryDecayParameters', 'confidenceFloor'],
];
const edit = (path: string[], value: unknown, remove = false) => {
  const source = fixture(); let parent = source as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[path.at(-1)!]; else parent[path.at(-1)!] = value;
  return source;
};
it.each(paths)('requires every explicit numeric parameter: %j', (...path) => {
  expect(() => createPlayerObservationCalibration(edit(path, null, true))).toThrow();
  expect(() => createPlayerObservationCalibration(edit(path, NaN))).toThrow();
  expect(() => createPlayerObservationCalibration(edit(path, Infinity))).toThrow();
  expect(() => createPlayerObservationCalibration(edit(path, '0.5'))).toThrow();
});
it.each([
  [['perceptionAbility'], -0.01], [['perceptionAbility'], 1.01],
  [['refreshPolicy', 'attendedIntervalTicks'], 0], [['refreshPolicy', 'peripheralIntervalTicks'], 1.5],
  [['geometryParameters', 'fullQualityHalfAngleRadians'], -1], [['geometryParameters', 'maxVisibleHalfAngleRadians'], Math.PI + 0.01],
  [['geometryParameters', 'maxVisibleHalfAngleRadians'], Math.PI / 6], [['geometryParameters', 'maxObservableDistanceMeters'], 10],
  [['geometryParameters', 'fullQualityDistanceMeters'], -1], [['geometryParameters', 'maxRelativeSpeedMps'], 2],
  [['geometryParameters', 'fullQualityRelativeSpeedMps'], -1],
  [['qualityParameters', 'instantaneousDurationQuality'], 1.01], [['qualityParameters', 'minimumAbilityQuality'], -0.01],
  [['qualityParameters', 'fullQualityObservationDurationSeconds'], 0], [['qualityParameters', 'weights', 'attention'], -1],
  [['errorParameters', 'minimumDetectionQuality'], -0.01], [['errorParameters', 'minimumPositionErrorMeters'], -1],
  [['errorParameters', 'maximumPositionErrorMeters'], -1], [['errorParameters', 'minimumVelocityErrorMps'], -1],
  [['errorParameters', 'maximumVelocityErrorMps'], -1], [['memoryDecayParameters', 'ticksPerSecond'], 0],
  [['memoryDecayParameters', 'ticksPerSecond'], Number.MAX_SAFE_INTEGER + 1],
  [['memoryDecayParameters', 'confidenceLossPerSecond'], -0.01], [['memoryDecayParameters', 'confidenceFloor'], 1.01],
] as [string[], number][])('rejects out-of-domain %j = %s', (path, value) => {
  expect(() => createPlayerObservationCalibration(edit(path, value))).toThrow();
});
it.each([0, Number.MAX_VALUE])('rejects a nonpositive or overflowing quality-weight total: %s', (weight) => {
  const raw = fixture(); Object.keys(raw.qualityParameters.weights).forEach((key) => {
    (raw.qualityParameters.weights as unknown as Record<string, number>)[key] = weight;
  });
  expect(() => createPlayerObservationCalibration(raw)).toThrow(/weight/i);
});
it.each(['', 'refreshPolicy', 'geometryParameters', 'qualityParameters', 'errorParameters', 'memoryDecayParameters'])('rejects extra fields at %s', (key) => {
  const raw = fixture();
  const target = (key ? (raw as unknown as Record<string, unknown>)[key] : raw) as Record<string, unknown>;
  target.result = 'safe'; expect(() => createPlayerObservationCalibration(raw)).toThrow();
});
it('rejects missing groups, combined names, executable properties and substituted ratings', () => {
  const raw = fixture();
  expect(() => createPlayerObservationCalibration({ ...raw, qualityParameters: null } as unknown as typeof raw)).toThrow();
  expect(() => createPlayerObservationCalibration({ ...raw, qualityParameters: { ...raw.qualityParameters,
    weights: { 'ability|attention|distance|duration|relativeSpeed': 1 } } } as unknown as typeof raw)).toThrow();
  const { perceptionAbility: _omitted, ...rest } = raw;
  expect(() => createPlayerObservationCalibration({ ...rest, situationalAwareness: 0.8 } as unknown as typeof raw)).toThrow();
  let accessed = false;
  Object.defineProperty(raw, 'perceptionAbility', { enumerable: true, get() { accessed = true; return 0.8; } });
  expect(() => createPlayerObservationCalibration(raw)).toThrow(); expect(accessed).toBe(false);
});
it('checks weight overflow in the consuming algorithm order regardless of caller key order', () => {
  const raw = fixture(), small = 2 ** 969;
  const reordered = { ...raw, qualityParameters: { ...raw.qualityParameters,
    weights: { ability: Number.MAX_VALUE, distance: small, relativeSpeed: small, attention: small, duration: small } } };
  expect(() => createPlayerObservationCalibration(reordered)).toThrow(/weight/i);
});
