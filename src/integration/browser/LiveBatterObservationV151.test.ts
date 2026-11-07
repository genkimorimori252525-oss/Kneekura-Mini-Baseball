import { expect, it } from 'vitest';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { forecastObservedPitchV151, type ObservedPitchPositionV151 } from '../../core/decision/batting/ObservedPitchForecastV151';
import { LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { AUTHORED_LIVE_BATTER_OBSERVATION_V151, createLiveBatterPositionObserverV151,
  validateLiveBatterObservationPolicyV151, type LiveBatterObservationPolicyV151 } from './LiveBatterObservationV151';

const originTick = 1000000, policy = ():LiveBatterObservationPolicyV151 => ({ ...AUTHORED_LIVE_BATTER_OBSERVATION_V151,
  sourceId:'position-boundary-test', memoryPolicy:{ ...AUTHORED_LIVE_BATTER_OBSERVATION_V151.memoryPolicy } });
const source = (throughElapsedSeconds = .8, speed = -40) => createSourceFreeBallKernel({ kind:'aero_ground_continuous_source_kernel_v2',
  initial:{ originTick, elapsedSeconds:0, ball:{ tick:originTick, position:{ x:0, y:1.8, z:17 },
    velocity:{ x:.2, y:-.5, z:speed }, spin:{ x:-200, y:10, z:0 } } }, throughElapsedSeconds, profile:LIVE_MATCH_PHYSICS_V1 });
const position = (kernel:ReturnType<typeof source>, seconds:number) => {
  const sample = kernel.evaluateAt(seconds).moment.ball;return { tick:sample.tick, position:sample.position };
};

it('owns the release plane and clocks independently of caller changes and its cutoff cache', () => {
  const kernel = source(), input = { policy:policy(), originTick, planeZ:0 },
    observer = createLiveBatterPositionObserverV151(input, seconds => position(kernel, seconds)),
    first = observer.forecastAt(1140000);
  input.planeZ = 20;input.originTick = 7;input.policy = { ...policy(), decisionAfterReleaseTicks:1 };
  const after = observer.forecastAt(1160000), unchanged = createLiveBatterPositionObserverV151({ policy:policy(), originTick, planeZ:0 },
    seconds => position(kernel, seconds)).forecastAt(1160000);
  expect(observer.decisionTick).toBe(1140000);
  expect(observer.forecastAt(1140000)).toBe(first);
  expect(after).toEqual(unchanged);
  expect(after.prediction!.position.z).toBe(0);
});

it('requests only position times through cutoff minus positive delivery latency and excludes undelivered samples', () => {
  const kernel = source(), p = { ...policy(), deliveryLatencyTicks:30000 }, calls:number[] = [], cutoffTick = 1140000,
    observer = createLiveBatterPositionObserverV151({ policy:p, originTick, planeZ:0 }, seconds => { calls.push(seconds);return position(kernel, seconds); }),
    result = observer.forecastAt(cutoffTick);
  expect(observer.decisionTick).toBe(originTick + p.decisionAfterReleaseTicks);
  expect(calls).toEqual([.02, .04, .06, .08, .1]);
  expect(calls.every(seconds => seconds <= (cutoffTick - originTick - p.deliveryLatencyTicks) / p.ticksPerSecond)).toBe(true);
  expect(result.status).toBe('PREDICTED');
  expect(result.usedObservationIds).toEqual([1060000, 1080000, 1100000].map(tick => p.sourceId + ':' + tick));
  expect(result.availableAtTick).toBe(1130000);
  expect(result.humanCalibration).toBe('NOT_MEASURED');
});

it('honors a real Source canonical ceil tick one later than requested without delivering it one tick early', () => {
  const kernel = source(), p = { ...policy(), deliveryLatencyTicks:10000 }, calls:number[] = [],
    observer = createLiveBatterPositionObserverV151({ policy:p, originTick, planeZ:0 }, seconds => {
      calls.push(seconds);
      // The physical owner's sub-tick sample is real; its authoritative event tick is ceil, not the requested offset.
      return position(kernel, seconds + .25 / p.ticksPerSecond);
    }), before = observer.forecastAt(1070000);
  expect(calls).toEqual([.02, .04, .06]);
  expect(position(kernel, .06000025).tick).toBe(1060001);
  expect(before.usedObservationIds).toEqual([1020001, 1040001].map(tick => p.sourceId + ':' + tick));
  expect(before.observedThroughTick).toBe(1040001);
  expect(before.availableAtTick).toBe(1050001);
  const delivered = observer.forecastAt(1070001);
  expect(delivered.usedObservationIds).toEqual([1020001, 1040001, 1060001].map(tick => p.sourceId + ':' + tick));
  expect(delivered.availableAtTick).toBe(1070001);
});

it('stops at a finite Source window null and forecasts only its already retained positions', () => {
  const kernel = source(.055), p = policy(), calls:number[] = [],
    observer = createLiveBatterPositionObserverV151({ policy:p, originTick, planeZ:0 }, seconds => {
      calls.push(seconds);return seconds > kernel.descriptor.throughElapsedSeconds ? null : position(kernel, seconds);
    }), cutoffTick = 1140000, result = observer.forecastAt(cutoffTick), observations:ObservedPitchPositionV151[] = [.02, .04].map(seconds => {
      const sample = position(kernel, seconds);return { observationId:p.sourceId + ':' + sample.tick,
        observedTick:sample.tick, availableTick:sample.tick, position:sample.position };
    });
  expect(calls).toEqual([.02, .04, .06]);
  expect(kernel.descriptor.throughElapsedSeconds).toBe(.055);
  expect(result).toEqual(forecastObservedPitchV151({ originTick, ticksPerSecond:p.ticksPerSecond, cutoffTick, planeZ:0,
    maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds, observations }));
  expect(result.usedObservationIds).toHaveLength(2);
  expect(result.status).toBe('PREDICTED');
});

it('reuses an identical cutoff without new Source reads and is invariant to different future suffix positions', () => {
  const original = source(), different = source(.8, -15), p = { ...policy(), deliveryLatencyTicks:30000 }, cutoffTick = 1140000,
    calls:number[] = [], observer = createLiveBatterPositionObserverV151({ policy:p, originTick, planeZ:0 }, seconds => {
      calls.push(seconds);return position(original, seconds);
    }), alternate = createLiveBatterPositionObserverV151({ policy:p, originTick, planeZ:0 }, seconds =>
      position(seconds <= .11 ? original : different, seconds)), first = observer.forecastAt(cutoffTick), reads = calls.length;
  expect(position(original, .2)).not.toEqual(position(different, .2));
  expect(observer.forecastAt(cutoffTick)).toBe(first);
  expect(calls).toHaveLength(reads);
  expect(alternate.forecastAt(cutoffTick)).toEqual(first);
  expect(Object.isFrozen(first.prediction!.position)).toBe(true);
});

it('enforces explicit policy clocks, the 512-position budget and exact position-only fields', () => {
  const valid = policy();
  for (const candidate of [{ ...valid, ticksPerSecond:0 }, { ...valid, ticksPerSecond:1.5 }, { ...valid, decisionAfterReleaseTicks:0 },
    { ...valid, decisionAfterReleaseTicks:2500001 }, { ...valid, positionSampleIntervalTicks:0 }, { ...valid, positionSampleIntervalTicks:1 },
    { ...valid, positionSampleIntervalTicks:.5 }, { ...valid, deliveryLatencyTicks:-1 }, { ...valid, deliveryLatencyTicks:.5 },
    { ...valid, maximumForecastAfterReleaseSeconds:0 }, { ...valid, maximumForecastAfterReleaseSeconds:2.6 },
    { ...valid, ticksPerSecond:NaN }, { ...valid, sourceId:'' }, { ...valid, pitchType:'fastball' },
    { ...valid, velocity:{ x:0, y:0, z:-40 } }, { ...valid, spin:{ x:0, y:0, z:0 } }, { ...valid, futurePlateTime:.4 },
    { ...valid, memoryPolicy:{ ...valid.memoryPolicy, privatePitchCall:'curve' } }]) expect(() => validateLiveBatterObservationPolicyV151(candidate)).toThrow();
  expect(validateLiveBatterObservationPolicyV151({ ...valid, ticksPerSecond:512, decisionAfterReleaseTicks:1,
    positionSampleIntervalTicks:1, maximumForecastAfterReleaseSeconds:1 }).ticksPerSecond).toBe(512);
  expect(() => validateLiveBatterObservationPolicyV151({ ...valid, ticksPerSecond:513, decisionAfterReleaseTicks:1,
    positionSampleIntervalTicks:1, maximumForecastAfterReleaseSeconds:1 })).toThrow();
});

it('rejects unsafe origin/cutoff clocks and policy accessors without asking the Source for data', () => {
  let calls = 0, reads = 0;
  const callback = () => { calls++;return null; }, valid = policy(), accessor = { ...valid };
  Object.defineProperty(accessor, 'ticksPerSecond', { enumerable:true, get(){ reads++;return 1000000; } });
  expect(() => validateLiveBatterObservationPolicyV151(accessor)).toThrow();
  expect(reads).toBe(0);
  for (const input of [{ policy:valid, originTick:-1, planeZ:0 }, { policy:valid, originTick:Number.MAX_SAFE_INTEGER, planeZ:0 },
    { policy:valid, originTick, planeZ:NaN }]) expect(() => createLiveBatterPositionObserverV151(input, callback)).toThrow();
  const observer = createLiveBatterPositionObserverV151({ policy:valid, originTick, planeZ:0 }, callback);
  for (const cutoff of [originTick - 1, originTick + .5, Infinity]) expect(() => observer.forecastAt(cutoff)).toThrow();
  expect(calls).toBe(0);
});

it('checks the contact physics switches: post-contact hold, barrel ringing, undercut and vertical aim', () => {
  const valid = policy();
  for (const candidate of [{ ...valid, postContactHoldV1:1 }, { ...valid, barrelVibrationLossV1:[.1] }, { ...valid, barrelVibrationLossV1:[.1, .145, .35, 0] },
    { ...valid, barrelVibrationLossV1:[0, .145] }, { ...valid, barrelVibrationLossV1:[.1, 2] }, { ...valid, barrelVibrationLossV1:[.1, .145, 1] },
    { ...valid, undercutAimV1:-.01 }, { ...valid, undercutAimV1:.06 }, { ...valid, undercutAimV1:'0.02' },
    { ...valid, aimVerticalScaleV1:-.1 }, { ...valid, aimVerticalScaleV1:2.5 }]) expect(() => validateLiveBatterObservationPolicyV151(candidate)).toThrow();
  const accepted = validateLiveBatterObservationPolicyV151({ ...valid, postContactHoldV1:true, barrelVibrationLossV1:[.1, .145, .35], undercutAimV1:.02, aimVerticalScaleV1:.6 });
  expect([accepted.postContactHoldV1, accepted.barrelVibrationLossV1, accepted.undercutAimV1, accepted.aimVerticalScaleV1]).toEqual([true, [.1, .145, .35], .02, .6]);
  expect(validateLiveBatterObservationPolicyV151({ ...valid, barrelVibrationLossV1:[.1, .145] }).barrelVibrationLossV1).toEqual([.1, .145]);
});

it('accepts pitch familiarity only with the league reference pitches, and checks both', () => {
  const ref = { R:[{ pitchType:'fastball', spinRadPerSecond:{ x:200, y:-90, z:110 } }], L:[{ pitchType:'fastball', spinRadPerSecond:{ x:200, y:90, z:-110 } }] };
  expect(validateLiveBatterObservationPolicyV151({ ...policy(), pitchFamiliarityV1:[.3, .05, .9], leagueReferencePitchesV1:ref }).pitchFamiliarityV1).toEqual([.3, .05, .9]);
  expect(() => validateLiveBatterObservationPolicyV151({ ...policy(), pitchFamiliarityV1:[.3, .05, .9] })).toThrow(/familiarity/);
  expect(() => validateLiveBatterObservationPolicyV151({ ...policy(), pitchFamiliarityV1:[.3, .05, 1.2], leagueReferencePitchesV1:ref })).toThrow(/familiarity/);
  expect(() => validateLiveBatterObservationPolicyV151({ ...policy(), leagueReferencePitchesV1:{ R:ref.R } })).toThrow(/reference/);
  expect(() => validateLiveBatterObservationPolicyV151({ ...policy(), leagueReferencePitchesV1:{ ...ref, L:[{ pitchType:'fastball', spinRadPerSecond:{ x:1, y:2 } }] } })).toThrow(/reference/);
});
it('takes the read-bend seen weight as one share or a [side, vertical] pair, only with pitch recognition', () => {
  const valid = { ...policy(), pitchRecognitionV2:[6, 60] as [number, number] };
  expect(Object.hasOwn(AUTHORED_LIVE_BATTER_OBSERVATION_V151, 'readBendSeenWeightV1')).toBe(false);
  expect(validateLiveBatterObservationPolicyV151({ ...valid, readBendSeenWeightV1:.5 }).readBendSeenWeightV1).toBe(.5);
  expect(validateLiveBatterObservationPolicyV151({ ...valid, readBendSeenWeightV1:[1, 0] }).readBendSeenWeightV1).toEqual([1, 0]);
  for (const bad of [-.1, 1.1, [1], [1, 0, 0], [1, 1.2], ['1', 0]])
    expect(() => validateLiveBatterObservationPolicyV151({ ...valid, readBendSeenWeightV1:bad as never })).toThrow(/read bend/);
  expect(() => validateLiveBatterObservationPolicyV151({ ...policy(), readBendSeenWeightV1:.5 })).toThrow(/read bend/);
});
it('the load-before-commit switch is optional and only true', () => {
  const valid = policy();
  expect(Object.hasOwn(AUTHORED_LIVE_BATTER_OBSERVATION_V151, 'loadBeforeCommitV1')).toBe(false);
  expect(validateLiveBatterObservationPolicyV151({ ...valid, loadBeforeCommitV1:true }).loadBeforeCommitV1).toBe(true);
  for (const bad of [false, 1, 'true']) expect(() => validateLiveBatterObservationPolicyV151({ ...valid, loadBeforeCommitV1:bad })).toThrow();
});

it('accepts the optional contact-window shaping and swing plane inputs only within range', () => {
  const valid = policy();
  for (const key of ['noImpactFollowV1', 'handExtensionV1', 'swingTiltV1']) expect(Object.hasOwn(AUTHORED_LIVE_BATTER_OBSERVATION_V151, key)).toBe(false);
  expect(validateLiveBatterObservationPolicyV151({ ...valid, noImpactFollowV1:.06 }).noImpactFollowV1).toBe(.06);
  expect(validateLiveBatterObservationPolicyV151({ ...valid, handExtensionV1:[0, 3, .04] }).handExtensionV1).toEqual([0, 3, .04]);
  expect(validateLiveBatterObservationPolicyV151({ ...valid, swingTiltV1:[31, -21, .76, -10] }).swingTiltV1).toEqual([31, -21, .76, -10]);
  for (const bad of [.001, .5]) expect(() => validateLiveBatterObservationPolicyV151({ ...valid, noImpactFollowV1:bad })).toThrow();
  expect(validateLiveBatterObservationPolicyV151({ ...valid, handExtensionV1:[0, 3, .04, .5] }).handExtensionV1).toEqual([0, 3, .04, .5]);
  for (const bad of [[2, 3, .04], [0, 3], [0, 11, .04], [0, 3, .04, .1]]) expect(() => validateLiveBatterObservationPolicyV151({ ...valid, handExtensionV1:bad })).toThrow();
  for (const bad of [[90, -21, .76, -10], [31, -21, .76]]) expect(() => validateLiveBatterObservationPolicyV151({ ...valid, swingTiltV1:bad })).toThrow();
  expect(validateLiveBatterObservationPolicyV151({ ...valid, lateLookNoiseV1:[.01, .1] }).lateLookNoiseV1).toEqual([.01, .1]);
  expect(validateLiveBatterObservationPolicyV151({ ...valid, sweetSpotHoldV1:[.016, .1] }).sweetSpotHoldV1).toEqual([.016, .1]);
  for (const bad of [[.2, .1], [.016], [.016, 1]]) expect(() => validateLiveBatterObservationPolicyV151({ ...valid, sweetSpotHoldV1:bad })).toThrow();
  for (const bad of [[.1, .1], [.01], [.01, -1]]) expect(() => validateLiveBatterObservationPolicyV151({ ...valid, lateLookNoiseV1:bad })).toThrow();
});
