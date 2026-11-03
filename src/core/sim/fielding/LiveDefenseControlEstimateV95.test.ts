import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { estimateLiveDefenseControlV95, createLiveDefenseControlMemoV95, type LiveDefenseControlEstimateInputV95 } from './LiveDefenseControlEstimateV95';
import type { LiveRelayActorV1 } from './LiveRelayPlanV1';
import { quantizeEventTick } from '../ExactEventTime';
import { estimateLiveFieldArrivalV84 } from './LiveFieldArrivalV84';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const actor = (playerId: string, z: number, throwSpeedMps = 34): LiveRelayActorV1 => ({ playerId,
  position: v(0, 1, z), velocity: v(), homePosition: v(0, 1, z), glovePosition: v(0, 1.3, z), gloveVelocity: v(),
  topSpeedMps: 7, accelerationMps2: 6, throwSpeedMps, remainingReactionSeconds: 0,
  gloveSpeedMps: 11, gloveReachMeters: 1.35, gloveRadiusMeters: .1, transferSeconds: .25, throwBackspinRadPerSecond: 120 });
const input = (distance = 20): LiveDefenseControlEstimateInputV95 => ({ observedAtSeconds: 10, nowSeconds: 10,
  snapshotKey: 'observed-10', actors: [actor('holder', 0), actor('receiver', distance)],
  sources: [{ playerId: 'holder', point: v(0, 1.3, 0), readySeconds: 0, kind: 'held', holderTransferRemainingSeconds: 0 }],
  target: { base: 4, position: v(0, 1, distance), forced: true },
  physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1e6, integrationStepTicks: 5000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1e6, gravityMps2: 9.81,
    radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .2,
    material: { restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .36, normalSpinDecayPerSecond: .18 } } } });

const postActorV120 = (a: LiveRelayActorV1, recovery: number, endpoint = a.position): LiveRelayActorV1 => {
  const clock = { originTick: 41, ticksPerSecond: 1e6 }, nowSeconds = 10,
    tick = (t: number) => quantizeEventTick(clock.originTick, t, clock.ticksPerSecond);
  return { ...a, athleticRecoverySecondsV116: 50, postActionV120: { clock, scopeId: 'runner-play', nowSeconds, nowTick: tick(nowSeconds),
    knownAction: { readySeconds: nowSeconds + recovery, readyTick: tick(nowSeconds + recovery), position: endpoint,
      velocity: v(), uncertaintySeconds: .1, provenance: { kind: 'observed', scopeId: 'runner-play', actorId: a.playerId,
        sourceId: 'observation-' + a.playerId, revision: 1, observedSeconds: nowSeconds, observedTick: tick(nowSeconds), validThroughSeconds: 50 } } } };
};

it('V120 carry overlaps pending acquisition and recovery, then ages the immutable estimate once', () => {
  const raw = input(4), endpoint = v(0, 1, 1), holder = postActorV120(raw.actors[0], 3, endpoint),
    args = { ...raw, actors: [holder], sources: [{ ...raw.sources[0], kind: 'pending' as const, readySeconds: 1.2 }] },
    memo = createLiveDefenseControlMemoV95(), result = estimateLiveDefenseControlV95(args, memo),
    movement = estimateLiveFieldArrivalV84({ ...holder, position: endpoint, velocity: v(), remainingReactionSeconds: 0 }, raw.target.position);
  expect(result.route).toBe('carry'); expect(result.readyAtSeconds).toBe(13 + movement);
  const aged = estimateLiveDefenseControlV95({ ...args, nowSeconds: 10.3 }, memo);
  expect(aged.diagnostics.cacheHit).toBe(true); expect(aged.readyAtSeconds).toBe(result.readyAtSeconds);
  expect(aged.controlSeconds).toBe(result.readyAtSeconds! - 10.3);
  expect(() => estimateLiveDefenseControlV95({ ...args, nowSeconds: 50.1 }, memo)).toThrow();
});
it('V120 runner routes use the same recovery gate at holder release and receiver arrival, without two-hop repayment', () => {
  const raw = input(20), held = estimateLiveDefenseControlV95({ ...raw,
    actors: [postActorV120(raw.actors[0], 3), raw.actors[1]] });
  expect(held.route).toBe('direct'); expect(held.legs[0].releaseDelaySeconds).toBeGreaterThanOrEqual(3);
  expect(held.legs[0].releaseDelaySeconds).toBeLessThan(3.1);
  const relay = estimateLiveDefenseControlV95({ ...input(90), actors: [actor('holder', 0, 16),
    postActorV120(actor('cutoff', 20, 38), 3), actor('receiver', 90)] });
  expect(relay.route).toBe('relay'); expect(relay.legs).toHaveLength(2);
  expect(relay.legs[0].receiverArrivalSeconds).toBeGreaterThanOrEqual(3);
  expect(relay.legs[1].releaseDelaySeconds).toBeLessThan(1);
});
it('V120 completed action context gives the same no-action estimate and rejects a different snapshot clock', () => {
  const raw = input(), ordinary = estimateLiveDefenseControlV95(raw), actors = raw.actors.map(a => postActorV120(a, 0));
  expect(estimateLiveDefenseControlV95({ ...raw, actors })).toEqual(ordinary);
  const forecast = { ...raw, sources: [{ ...raw.sources[0], kind: 'forecast' as const, point: v(2, 1.3, 3), readySeconds: 1 }] };
  expect(estimateLiveDefenseControlV95({ ...forecast, actors })).toEqual(estimateLiveDefenseControlV95(forecast));
  const bad = postActorV120(raw.actors[0], 3), context = bad.postActionV120!;
  expect(() => estimateLiveDefenseControlV95({ ...raw, actors: [{ ...bad, postActionV120: { ...context,
    nowSeconds: 9, nowTick: quantizeEventTick(context.clock.originTick, 9, context.clock.ticksPerSecond) } }, raw.actors[1]] })).toThrow();
});
it('V120 a later forecast acquisition keeps its own hypothetical pickup point after the known action', () => {
  const raw = input(4), ordinary = { ...raw, actors: [raw.actors[0]],
    sources: [{ ...raw.sources[0], kind: 'forecast' as const, point: v(0, 1.3, 2), readySeconds: 5 }] },
    result = estimateLiveDefenseControlV95({ ...ordinary, actors: [postActorV120(raw.actors[0], 3, v(0, 1, 1))] });
  expect(result.route).toBe('carry');
  expect(result.readyAtSeconds).toBe(estimateLiveDefenseControlV95(ordinary).readyAtSeconds);
});

it('uses the actual holder shoulder, preparation, receiving time and aerodynamic flight without mutating its snapshot', () => {
  const raw = input(), before = JSON.stringify(raw), r = estimateLiveDefenseControlV95(raw);
  expect(r.kind).toBe('estimated'); expect(r.route).toBe('direct'); expect(r.legs).toHaveLength(1);
  expect(r.legs[0].preparationSeconds).toBeGreaterThan(0); expect(r.legs[0].flightSeconds).toBeGreaterThan(20 / 34);
  expect(r.controlSeconds).toBeCloseTo(r.legs[0].readySeconds, 10);
  expect(r.diagnostics).toMatchObject({ actualSourceRead: false, actualCatchGuaranteed: false, replanAfterReceiptRequired: true });
  expect(JSON.stringify(raw)).toBe(before); expect(Object.isFrozen(raw.target.position)).toBe(false);
});
it('keeps extreme capacity finite on selected output and credits elapsed charge only to an observed held source',()=>{
  const raw=input(40),actors=raw.actors.map(a=>a.playerId==='holder'?{...a,throwEffortBuildSecondsV103:5}:a),
    ordinary=estimateLiveDefenseControlV95({...raw,actors}),
    held=estimateLiveDefenseControlV95({...raw,actors,sources:raw.sources.map(s=>({...s,holderChargeElapsedSecondsV103:5}))}),
    pending=estimateLiveDefenseControlV95({...raw,actors,sources:raw.sources.map(s=>({...s,kind:'pending' as const,holderChargeElapsedSecondsV103:5}))});
  expect(held.controlSeconds!).toBeLessThan(ordinary.controlSeconds!);expect(pending.controlSeconds).toBe(ordinary.controlSeconds);
  const extreme=estimateLiveDefenseControlV95({...raw,actors:actors.map(a=>({...a,throwSpeedMps:300_000}))});
  expect(extreme.route).toBe('direct');expect(extreme.legs[0].commandSpeedMps).toBeLessThanOrEqual(120);
  expect(extreme.legs[0].flightSeconds).toBeGreaterThan(.05);expect(extreme.legs[0].effort).toBeLessThan(1e-6);
});

it('does not lend an unrelated catcher shoulder to an outfielder holding the ball', () => {
  const base = input(90), actors = [actor('holder', 0, 16), actor('receiver', 90), actor('unrelated-catcher', -10, 8)],
    ordinary = estimateLiveDefenseControlV95({ ...base, actors }),
    strong = estimateLiveDefenseControlV95({ ...base, actors: actors.map(a => a.playerId === 'unrelated-catcher' ? { ...a, throwSpeedMps: 40 } : a) });
  expect(ordinary.controlSeconds).toBe(strong.controlSeconds); expect(ordinary.route).toBe(strong.route);
  expect(ordinary).toMatchObject({ kind: 'estimated', route: 'carry' });
  expect(ordinary.diagnostics.budgetExhausted).toBe(false);
  expect(ordinary.legs.map(l => l.throwerPlayerId)).not.toContain('unrelated-catcher');
});

it('uses a weak holder through an actually reachable stronger cutoff, charging both legs and the cutoff transfer', () => {
  const base = input(90), actors = [actor('holder', 0, 16), actor('cutoff', 20, 38), actor('receiver', 90)],
    r = estimateLiveDefenseControlV95({ ...base, actors });
  expect(r.route).toBe('relay'); expect(r.legs).toHaveLength(2);
  expect(r.legs.map(l => [l.throwerPlayerId, l.receiverPlayerId])).toEqual([['holder', 'cutoff'], ['cutoff', 'receiver']]);
  expect(r.legs[1].transferSeconds).toBe(.25);
  expect(r.controlSeconds!).toBeGreaterThan(r.legs[0].readySeconds + .25 + r.legs[1].flightSeconds);
  const noCutoff = estimateLiveDefenseControlV95({ ...base, actors: actors.filter(a => a.playerId !== 'cutoff') });
  expect(noCutoff.route).toBe('carry'); expect(r.controlSeconds!).toBeLessThan(noCutoff.controlSeconds!);
});

it('charges holder transfer, forecast acquisition, receiver arrival and nonforce tag distance independently', () => {
  const base = input(), ordinary = estimateLiveDefenseControlV95(base),
    transfer = estimateLiveDefenseControlV95({ ...base, sources: [{ ...base.sources[0], holderTransferRemainingSeconds: .8 }] }),
    pickup = estimateLiveDefenseControlV95({ ...base, sources: [{ ...base.sources[0], kind: 'forecast', readySeconds: 2 }] }),
    tag = estimateLiveDefenseControlV95({ ...base, target: { ...base.target, forced: false, tagPoint: v(1, 1, 20) } }),
    receiver = estimateLiveDefenseControlV95({ ...base, actors: base.actors.map(a => a.playerId === 'receiver'
      ? { ...a, position: v(20, 1, 20), glovePosition: v(20, 1.3, 20) } : a) });
  expect(transfer.controlSeconds! - ordinary.controlSeconds!).toBeCloseTo(.8, 10);
  expect(pickup.controlSeconds! - ordinary.controlSeconds!).toBeCloseTo(2, 10);
  expect(tag.tagPreparationSeconds).toBeCloseTo(.72 / 11, 10);
  expect(tag.controlSeconds! - ordinary.controlSeconds!).toBeCloseTo(tag.tagPreparationSeconds, 10);
  expect(receiver.controlSeconds!).toBeGreaterThan(ordinary.controlSeconds!);
});

it('bounds solves and cache storage, reuses an immutable observation at later times, and invalidates changed material input', () => {
  const memo = createLiveDefenseControlMemoV95(2), raw = input(), initial = estimateLiveDefenseControlV95(raw, memo);
  let solves = initial.diagnostics.aerodynamicSolveCount;
  for (let i = 1; i <= 100; i++) {
    const r = estimateLiveDefenseControlV95({ ...raw, nowSeconds: 10 + i * .001 }, memo);
    expect(r.diagnostics.cacheHit).toBe(true); expect(r.controlSeconds).toBeCloseTo(initial.controlSeconds! - i * .001, 10);
    solves += r.diagnostics.aerodynamicSolveCount;
  }
  expect(solves).toBe(1);
  const nextObservation = estimateLiveDefenseControlV95({ ...raw, snapshotKey: 'next-observation', observedAtSeconds: 10.2, nowSeconds: 10.2 }, memo);
  expect(nextObservation.diagnostics.cacheHit).toBe(false); expect(nextObservation.diagnostics.aerodynamicSolveCount).toBe(0);
  expect(nextObservation.diagnostics.aerodynamicCacheHits).toBe(1);
  const changed = estimateLiveDefenseControlV95({ ...raw, actors: raw.actors.map(a => ({ ...a, throwSpeedMps: a.throwSpeedMps / 2 })) }, memo);
  expect(changed.diagnostics.cacheHit).toBe(false); expect(changed.controlSeconds!).toBeGreaterThan(initial.controlSeconds!);
  estimateLiveDefenseControlV95({ ...raw, snapshotKey: 'new-event' }, memo); expect(memo.entries.size).toBe(2);
  expect(memo.aerodynamicEntries.size).toBeLessThanOrEqual(8);
  const zero = estimateLiveDefenseControlV95({ ...raw, limits: { maximumAeroSolves: 0 } });
  expect(zero).toMatchObject({ kind: 'unknown', controlSeconds: null, route: null });
  expect(zero.diagnostics.budgetExhausted).toBe(true); expect(zero.diagnostics.aerodynamicSolveCount).toBe(0);
});

it('returns unknown when the observer has no source and rejects future or malformed observations', () => {
  expect(estimateLiveDefenseControlV95({ ...input(), sources: [] })).toMatchObject({ kind: 'unknown', controlSeconds: null, route: null });
  expect(() => estimateLiveDefenseControlV95({ ...input(), nowSeconds: 9 })).toThrow(/observer snapshot/);
  expect(() => estimateLiveDefenseControlV95({ ...input(), sources: [{ ...input().sources[0], playerId: 'future-fielder' }] })).toThrow(/observer snapshot/);
});

it('reports an uncertified hand transition separately from an unreachable aerodynamic throw without inventing a release', () => {
  const raw = input(38.78), holder: LiveRelayActorV1 = { ...actor('holder', 86.25409387619827, 32),
    position: v(.9677336672698297, 1, 86.25409387619827), velocity: v(1.2946606332644737, 0, -5.359383224038181),
    glovePosition: v(1.3115997891250295, .9981324248244619, 85.00039854795014),
    gloveVelocity: v(1.3297275725520687, -.0002981915825897962, -5.349751254800176),
    gloveSpeedMps: 6, gloveReachMeters: 1.3 }, result = estimateLiveDefenseControlV95({ ...raw,
      actors: [holder, actor('receiver', 38.78)], sources: [{ playerId: 'holder', point: holder.glovePosition,
        readySeconds: 0, kind: 'held', holderTransferRemainingSeconds: 0 }], limits: { maximumRelays: 0 } });
  expect(result).toMatchObject({ kind: 'unknown', controlSeconds: null, route: null }); expect(result.legs).toEqual([]);
  expect(result.diagnostics.unknownReason).toBe('UNPROVEN_THROW_HAND_PREPARATION');
  expect(result.diagnostics.fallbackCarryReadyAtSeconds).not.toBeNull();
  expect(result.diagnostics.handPreparationFailures).toEqual([{ throwerPlayerId: 'holder', receiverPlayerId: 'receiver',
    reason: 'NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS' }]);
  expect(result.diagnostics.aerodynamicSolveCount).toBe(0);
  expect(result.diagnostics.aerodynamicallyUnreachableLegCount).toBe(0);
});

it('does not turn an unfinished relay search into a safe carry-only ETA and completes both relay legs under the default budget', () => {
  const evidence = JSON.parse(readFileSync(new URL('../../../../docs/verification/releases/v95-investigation/runners/tagup-route-budget-before-fix.json', import.meta.url), 'utf8')) as {
    cases: { maximumAeroSolves: number; input: LiveDefenseControlEstimateInputV95 }[] };
  for (const row of evidence.cases.filter(c => c.maximumAeroSolves === 2)) {
    const limited = estimateLiveDefenseControlV95(row.input), ordinary = estimateLiveDefenseControlV95({ ...row.input, limits: undefined }),
      broad = estimateLiveDefenseControlV95({ ...row.input, limits: { maximumAeroSolves: 6 } });
    expect(limited).toMatchObject({ kind: 'unknown', route: null, controlSeconds: null });
    expect(limited.diagnostics.budgetExhausted).toBe(true);
    expect(ordinary.kind).toBe('estimated'); expect(ordinary.route).toBe('relay'); expect(ordinary.legs).toHaveLength(2);
    expect(ordinary.controlSeconds!).toBeLessThan(6); expect(ordinary.controlSeconds).toBe(broad.controlSeconds);
    expect(ordinary.diagnostics.aerodynamicSolveCount).toBeLessThanOrEqual(3);
    expect(ordinary.diagnostics.budgetExhausted).toBe(false);
  }
});

const unsettledGloveInputV115 = (distance: number): LiveDefenseControlEstimateInputV95 => {
  const base = input(distance), holder: LiveRelayActorV1 = { ...base.actors[0], glovePosition: v(0, 1, .35),
    gloveVelocity: v(0, 0, 5), gloveReachMeters: .5, gloveTossV110: { capacityMps: 11, buildSeconds: .1 } };
  return { ...base, actors: [holder, base.actors[1]],
    sources: [{ ...base.sources[0], point: holder.glovePosition, holderTransferRemainingSeconds: .8 }],
    limits: { maximumRelays: 0 } };
};
it('keeps an uncertified normal hand unknown when glove eligibility cannot provide a real long-range alternative', () => {
  const raw = unsettledGloveInputV115(90), before = JSON.stringify(raw), memo = createLiveDefenseControlMemoV95(),
    result = estimateLiveDefenseControlV95(raw, memo);
  expect(result).toMatchObject({ kind: 'unknown', controlSeconds: null, route: null, legs: [] });
  expect(result.diagnostics.unknownReason).toBe('UNPROVEN_THROW_HAND_PREPARATION');
  expect(result.diagnostics.handPreparationFailures).toEqual([{ throwerPlayerId: 'holder', receiverPlayerId: 'receiver',
    reason: 'NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS' }]);
  expect(result.diagnostics.aerodynamicallyUnreachableLegCount).toBe(0);
  expect(result.diagnostics.fallbackCarryReadyAtSeconds).not.toBeNull();
  const aged = estimateLiveDefenseControlV95({ ...raw, nowSeconds: 10.2 }, memo);
  expect(aged).toMatchObject({ kind: 'unknown', controlSeconds: null });expect(aged.diagnostics.cacheHit).toBe(true);
  expect(JSON.stringify(raw)).toBe(before);
});
it('retains a certified short glove alternative when the ordinary hand preparation is unavailable', () => {
  const raw = unsettledGloveInputV115(8), before = JSON.stringify(raw), result = estimateLiveDefenseControlV95(raw);
  expect(result).toMatchObject({ kind: 'estimated', route: 'direct' });expect(result.legs).toHaveLength(1);
  expect(result.diagnostics.handPreparationFailures).toEqual([]);
  expect(result.legs[0].commandSpeedMps).toBeLessThanOrEqual(11);
  expect(result.legs[0].releaseDelaySeconds).toBeLessThan(.8);
  expect(result.diagnostics.aerodynamicSolveCount).toBe(2);
  expect(JSON.stringify(raw)).toBe(before);
});
