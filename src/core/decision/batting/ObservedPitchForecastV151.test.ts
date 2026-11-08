import { expect, it } from 'vitest';
import { forecastObservedPitchV151, type ObservedPitchPositionV151 } from './ObservedPitchForecastV151';

const originTick = 4000000, ticksPerSecond = 1000000;
const sample = (id:string, seconds:number, position:ObservedPitchPositionV151['position'], delaySeconds = .01):ObservedPitchPositionV151 => ({
  observationId:id, observedTick:originTick + Math.round(seconds * ticksPerSecond),
  availableTick:originTick + Math.round((seconds + delaySeconds) * ticksPerSecond), position,
});
const input = (observations:readonly ObservedPitchPositionV151[]) => ({ originTick, ticksPerSecond, cutoffTick:4360000,
  planeZ:0, maximumAfterReleaseSeconds:2.5, observations });
const linear = [sample('a', .05, { x:.2, y:1.85, z:18 }), sample('b', .18, { x:.46, y:1.46, z:12.8 }),
  sample('c', .3, { x:.7, y:1.1, z:8 })];

it('predicts a known linear arrival from unequal sample times without a true velocity input', () => {
  const result = forecastObservedPitchV151(input(linear));
  expect(result).toMatchObject({ version:'observed_pitch_forecast_v151', status:'PREDICTED', cutoffTick:4360000,
    observedThroughTick:4300000, availableAtTick:4310000, usedObservationIds:['a', 'b', 'c'],
    model:'POSITION_SAMPLES_CONSTANT_ACCELERATION_EXTRAPOLATION', humanCalibration:'NOT_MEASURED', opponentPrivateStateUsed:false, futureSourceUsed:false });
  expect(result.prediction!.arrivalAfterReleaseSeconds).toBeCloseTo(.5, 12);
  expect(result.prediction!.position.x).toBeCloseTo(1.1, 12);
  expect(result.prediction!.position.y).toBeCloseTo(.5, 12);
  expect(result.prediction!.position.z).toBe(0);
  expect(result.prediction!.estimatedVelocity.z).toBeCloseTo(-40, 10);
  expect(result.prediction!.estimatedAcceleration.y).toBeCloseTo(0, 10);
});

it('fits a known three-dimensional acceleration at unequal actual times and reports arrival velocity', () => {
  // x=1+2t+3t², y=2-4t+t², z=15-25t-10t²; the first plate crossing is t=.5.
  const observations = [sample('one', .07, { x:1.1547, y:1.7249, z:13.201 }),
    sample('two', .19, { x:1.4883, y:1.2761, z:9.889 }), sample('three', .34, { x:2.0268, y:.7556, z:5.344 })],
    result = forecastObservedPitchV151(input(observations));
  expect(result.status).toBe('PREDICTED');
  expect(result.prediction!.arrivalAfterReleaseSeconds).toBeCloseTo(.5, 12);
  expect(result.prediction!.position.x).toBeCloseTo(2.75, 11);
  expect(result.prediction!.position.y).toBeCloseTo(.25, 11);
  expect(result.prediction!.estimatedVelocity.x).toBeCloseTo(5, 11);
  expect(result.prediction!.estimatedVelocity.y).toBeCloseTo(-3, 11);
  expect(result.prediction!.estimatedVelocity.z).toBeCloseTo(-35, 11);
  expect(result.prediction!.estimatedAcceleration.x).toBeCloseTo(6, 11);
  expect(result.prediction!.estimatedAcceleration.y).toBeCloseTo(2, 11);
  expect(result.prediction!.estimatedAcceleration.z).toBeCloseTo(-20, 11);
});

it('falls back to a two-position line and preserves a large exact clock without rounding its input', () => {
  const base = 9000000000000000, source = { originTick:base, ticksPerSecond, cutoffTick:base + 320001,
    planeZ:0, maximumAfterReleaseSeconds:1, observations:[
      { observationId:'first', observedTick:base + 120000, availableTick:base + 130000, position:{ x:.34, y:1.64, z:15.2 } },
      { observationId:'last', observedTick:base + 310000, availableTick:base + 320000, position:{ x:.72, y:1.07, z:7.6 } }] },
    result = forecastObservedPitchV151(source);
  expect(result.status).toBe('PREDICTED');
  expect(result.cutoffTick).toBe(base + 320001);
  expect(source.cutoffTick).toBe(base + 320001);
  expect(result.prediction!.arrivalAfterReleaseSeconds).toBeCloseTo(.5, 12);
  expect(result.prediction!.estimatedAcceleration).toEqual({ x:0, y:0, z:0 });
});

it('returns only a status and the used metadata when zero or one position has arrived', () => {
  expect(forecastObservedPitchV151(input([]))).toMatchObject({ status:'NO_DELIVERED_OBSERVATIONS', prediction:null,
    observedThroughTick:null, availableAtTick:null, usedObservationIds:[] });
  expect(forecastObservedPitchV151(input([linear[0]]))).toMatchObject({ status:'INSUFFICIENT_OBSERVATIONS', prediction:null,
    observedThroughTick:4050000, availableAtTick:4060000, usedObservationIds:['a'] });
});

it('ignores undelivered and future suffix positions even if those positions change', () => {
  const pending = sample('pending', .33, { x:100, y:100, z:-100 }, .1), future = sample('future', .5, { x:-500, y:-500, z:500 }),
    expected = forecastObservedPitchV151(input(linear)),
    first = input([...linear, pending, future]), second = input([...linear,
      { ...pending, position:{ x:-999, y:999, z:0 } }, { ...future, observedTick:4600000, availableTick:4700000, position:{ x:999, y:-999, z:-999 } }]);
  expect(forecastObservedPitchV151(first)).toEqual(expected);
  expect(forecastObservedPitchV151(second)).toEqual(expected);
});

it('uses the latest three delivered positions in chronological order independently of input order', () => {
  const old = sample('old', .01, { x:500, y:-500, z:500 }, .34), first = input([old, ...linear]),
    second = input([linear[2], old, linear[0], linear[1]]);
  expect(forecastObservedPitchV151(first)).toEqual(forecastObservedPitchV151(input(linear)));
  expect(forecastObservedPitchV151(second)).toEqual(forecastObservedPitchV151(input(linear)));
});

it.each([0, -1])('reports an already-passed plane for a latest observed z of %s', z => {
  expect(forecastObservedPitchV151(input([linear[0], { ...linear[1], position:{ x:0, y:1, z } }]))).toMatchObject({
    status:'PLANE_ALREADY_PASSED', prediction:null, usedObservationIds:['a', 'b'] });
});

it('does not claim a forward crossing for stationary, receding, too-late or already-expired estimates', () => {
  for (const z of [20, 21]) expect(forecastObservedPitchV151(input([
    sample('a', .1, { x:0, y:1, z:20 }), sample('b', .2, { x:0, y:1, z })]))).toMatchObject({ status:'NO_FORWARD_CROSSING', prediction:null });
  expect(forecastObservedPitchV151({ ...input(linear), maximumAfterReleaseSeconds:.49 }).status).toBe('NO_FORWARD_CROSSING');
  expect(forecastObservedPitchV151({ ...input(linear), cutoffTick:4600000 }).status).toBe('NO_FORWARD_CROSSING');
  // z=1+(t-.5)² never reaches planeZ=0.
  expect(forecastObservedPitchV151(input([sample('a', .1, { x:0, y:1, z:1.16 }),
    sample('b', .2, { x:0, y:1, z:1.09 }), sample('c', .3, { x:0, y:1, z:1.04 })])).status).toBe('NO_FORWARD_CROSSING');
});

it('chooses the first of two future quadratic roots and avoids small-root cancellation', () => {
  // z=(t-1)(t-2) has two roots; only the first is the forward crossing.
  const first = forecastObservedPitchV151(input([sample('a', .1, { x:0, y:1, z:1.71 }),
    sample('b', .2, { x:0, y:1, z:1.44 }), sample('c', .3, { x:0, y:1, z:1.19 })]));
  expect(first.prediction!.arrivalAfterReleaseSeconds).toBeCloseTo(1, 11);
  // In last-sample time tau: z=tau²-1e8*tau+1. The small root is approximately 1e-8.
  const stable = forecastObservedPitchV151({ ...input([sample('a', 0, { x:0, y:1, z:200000005 }, 0),
    sample('b', 1, { x:1, y:1, z:100000002 }, 0), sample('c', 2, { x:2, y:1, z:1 }, 0)]), cutoffTick:6000000, maximumAfterReleaseSeconds:3 });
  expect(stable.prediction!.arrivalAfterReleaseSeconds).toBeCloseTo(2.00000001, 12);
});

it('does not replace a past forward arrival by a later reversing root or a tangent touch', () => {
  const reversing = input([sample('a', .1, { x:0, y:1, z:1.71 }), sample('b', .2, { x:0, y:1, z:1.44 }),
    sample('c', .3, { x:0, y:1, z:1.19 })]);
  expect(forecastObservedPitchV151({ ...reversing, cutoffTick:5100000 }).status).toBe('NO_FORWARD_CROSSING');
  // z=(t-3)² only touches the plane with vz=0; it never passes toward decreasing z.
  expect(forecastObservedPitchV151({ ...input([sample('a', 0, { x:0, y:1, z:9 }, 0),
    sample('b', 1, { x:0, y:1, z:4 }, 0), sample('c', 2, { x:0, y:1, z:1 }, 0)]),
    cutoffTick:6000000, maximumAfterReleaseSeconds:3 }).status).toBe('NO_FORWARD_CROSSING');
});

it('includes an arrival exactly at the supplied cutoff and release horizon without changing either clock', () => {
  const source = { ...input([sample('a', .1, { x:0, y:1, z:4 }, 0), sample('b', .2, { x:0, y:1, z:3 }, 0)]),
    cutoffTick:4500000, maximumAfterReleaseSeconds:.5 }, result = forecastObservedPitchV151(source);
  expect(result.status).toBe('PREDICTED');
  expect(result.prediction!.arrivalAfterReleaseSeconds).toBe(.5);
  expect(result.cutoffTick).toBe(4500000);
  expect(source.maximumAfterReleaseSeconds).toBe(.5);
});

it('rejects ambiguous clocks/identities, nonfinite values and all private extra fields', () => {
  const valid = input(linear);
  for (const source of [{ ...valid, ticksPerSecond:0 }, { ...valid, originTick:-1 }, { ...valid, cutoffTick:4000000.5 },
    { ...valid, maximumAfterReleaseSeconds:Infinity }, { ...valid, planeZ:NaN }, { ...valid, velocity:{ x:0, y:0, z:-40 } },
    { ...valid, spin:{ x:0, y:0, z:0 } }, { ...valid, airProfile:{} }, { ...valid, plateTimeSeconds:.5 }, { ...valid, pitchType:'fastball' },
    { ...valid, observations:[linear[0], { ...linear[1], observationId:'a' }] },
    { ...valid, observations:[linear[0], { ...linear[1], observedTick:linear[0].observedTick }] },
    { ...valid, observations:[{ ...linear[0], observedTick:originTick - 1 }] },
    { ...valid, observations:[{ ...linear[0], availableTick:linear[0].observedTick - 1 }] },
    { ...valid, observations:[{ ...linear[0], observedTick:Number.MAX_SAFE_INTEGER + 1 }] },
    { ...valid, observations:[{ ...linear[0], position:{ x:0, y:1, z:1, velocity:1 } }] },
    { ...valid, observations:[{ ...linear[0], trueVelocity:{ x:0, y:0, z:-40 } }] }]) expect(() => forecastObservedPitchV151(source)).toThrow();
});

it('rejects accessors without reading them and returns detached deeply frozen data without changing source', () => {
  const source = input(linear.map(observation => ({ ...observation, position:{ ...observation.position } }))), before = JSON.stringify(source),
    result = forecastObservedPitchV151(source);
  expect(JSON.stringify(source)).toBe(before);
  expect(Object.isFrozen(source.observations[0].position)).toBe(false);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.usedObservationIds)).toBe(true);
  expect(Object.isFrozen(result.prediction!.position)).toBe(true);
  expect(Object.isFrozen(result.prediction!.estimatedVelocity)).toBe(true);
  expect(Object.isFrozen(result.prediction!.estimatedAcceleration)).toBe(true);
  (source.observations[2].position as { x:number }).x = 99;
  expect(result.prediction!.position.x).toBeCloseTo(1.1, 12);
  let reads = 0;
  const accessor = { ...source };
  Object.defineProperty(accessor, 'planeZ', { enumerable:true, get(){ reads++;return 0; } });
  expect(() => forecastObservedPitchV151(accessor)).toThrow();
  expect(reads).toBe(0);
});
