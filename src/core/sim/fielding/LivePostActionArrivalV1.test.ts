import { describe, expect, it } from 'vitest';
import { quantizeEventTick } from '../ExactEventTime';
import { estimateLiveFieldArrivalV84 } from './LiveFieldArrivalV84';
import { estimateLiveReceiverArrivalV106 } from './LiveReceiverArrivalV106';
import { createLiveObservedPostActionV1, estimateLivePostActionArrivalV1, resolveLivePostActionReadinessV1,
  type LiveKnownPostActionV1, type LivePostActionArrivalInputV1 } from './LivePostActionArrivalV1';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const clock = { originTick: 71, ticksPerSecond: 1_000_000 };
const tick = (seconds: number) => quantizeEventTick(clock.originTick, seconds, clock.ticksPerSecond);
const actor = { position: v(), velocity: v(2), topSpeedMps: 7, accelerationMps2: 6, remainingReactionSeconds: .2 };
const input = (overrides: Partial<LivePostActionArrivalInputV1> = {}): LivePostActionArrivalInputV1 => ({
  clock, scopeId: 'play-1', actorId: 'f0', nowSeconds: 2, nowTick: tick(2), actor, target: v(5), arrivalMode: 'receiver', ...overrides,
});
const action = (overrides: Partial<LiveKnownPostActionV1> = {}): LiveKnownPostActionV1 => ({
  readySeconds: 2.8, readyTick: tick(2.8), position: v(1), velocity: v(.5), uncertaintySeconds: .1,
  provenance: { kind: 'observed', scopeId: 'play-1', actorId: 'f0', sourceId: 'observation-1', revision: 4,
    observedSeconds: 1.9, observedTick: tick(1.9), validThroughSeconds: 4 }, ...overrides,
});

describe('post action tactical arrival', () => {
  it('no_action_matches_previous_eta including dormant, reverse and already-inside states', () => {
    for (const mode of ['first_entry', 'receiver'] as const) for (const velocity of [v(), v(7), v(-7), v(2, 0, 3)]) {
      for (const target of [v(.1), v(5), v(-10)]) {
        const a = { ...actor, velocity, remainingReactionSeconds: 60 }, i = input({ actor: a, target, arrivalMode: mode });
        const previous = mode === 'receiver' ? estimateLiveReceiverArrivalV106(a, target) : estimateLiveFieldArrivalV84(a, target);
        const result = estimateLivePostActionArrivalV1(i);
        expect(result.remainingSeconds).toBe(previous);
        expect(result.arrivalSeconds).toBe(i.nowSeconds + previous);
        expect(result.arrivalTick).toBe(tick(result.arrivalSeconds));
        expect(result.actionReadySeconds).toBeNull();
        expect(result.knowledge).toBe('not_provided');
      }
    }
  });

  it('carry_eta_cannot_precede_required_recovery even when already touching the target', () => {
    // Readiness times from the V118 lateral-one-meter 1B fixture. This is an
    // ETA-boundary regression, not a rerun or an assertion of a physical out.
    const nowSeconds = .5402779010004015, recoveryEnd = 1.3944115311756287;
    const known = action({ readySeconds: recoveryEnd, readyTick: tick(recoveryEnd), position: v(), velocity: v(),
      provenance: { ...action().provenance, observedSeconds: .52, observedTick: tick(.52) } });
    const result = estimateLivePostActionArrivalV1(input({ nowSeconds, nowTick: tick(nowSeconds),
      target: v(), arrivalMode: 'first_entry', knownAction: known }));
    expect(result.arrivalSeconds).toBe(recoveryEnd);
    expect(result.arrivalSeconds).toBeGreaterThan(1.3356500248961665);
    expect(result.arrivalTick).toBe(tick(recoveryEnd));
  });

  it('starts the old receiver motor at the supplied future boundary without discarding momentum', () => {
    const known = action(), target = v(5), result = estimateLivePostActionArrivalV1(input({ knownAction: known, target }));
    const expected = estimateLiveReceiverArrivalV106({ ...actor, position: known.position, velocity: known.velocity,
      remainingReactionSeconds: 0 }, target);
    expect(result.estimateFromSeconds).toBe(2.8);
    expect(result.locomotionSeconds).toBe(expected);
    expect(result.arrivalSeconds).toBe(2.8 + expected);
    expect(result.stateAtReady.position).toEqual(known.position);
    expect(result.stateAtReady.velocity).toEqual(known.velocity);
    expect(result.uncertaintySeconds).toBe(.1);
  });

  it('keeps residual recognition once and overlaps custody availability with recovery', () => {
    const known = action(), a = { ...actor, remainingReactionSeconds: 1.2 };
    const result = estimateLivePostActionArrivalV1(input({ actor: a, knownAction: known, notBeforeSeconds: 2.9 }));
    const expected = estimateLiveReceiverArrivalV106({ ...a, position: known.position, velocity: known.velocity,
      remainingReactionSeconds: Math.max(0, 1.2 - (2.8 - 2), 2.9 - 2.8) }, v(5));
    expect(result.estimateFromSeconds).toBe(2.8);
    expect(result.remainingSeconds).toBe((2.8 - 2) + expected);
  });

  it('does not rewind to an old action endpoint after readiness', () => {
    const known = action({ readySeconds: 1.8, readyTick: tick(1.8), position: v(-50) });
    const result = estimateLivePostActionArrivalV1(input({ knownAction: known }));
    expect(result.remainingSeconds).toBe(estimateLiveReceiverArrivalV106(actor, v(5)));
    expect(result.stateAtReady.position).toEqual(actor.position);
    expect(result.estimateFromSeconds).toBe(2);
  });

  it('observation_age_is_subtracted_once and carry_relay_runner_do_not_add_recovery_twice', () => {
    const provenance = { ...action().provenance, observedSeconds: 1, observedTick: tick(1) };
    const known = createLiveObservedPostActionV1({ clock, provenance, recoveryRemainingSeconds: .8,
      position: v(), velocity: v(), uncertaintySeconds: .15 });
    expect(known.readySeconds).toBe(1.8);
    for (const now of [1.3, 1.6, 1.8, 2]) {
      const args = input({ actor: { ...actor, velocity: v(), remainingReactionSeconds: 0 }, nowSeconds: now,
        nowTick: tick(now), target: v(), knownAction: known });
      const carry = estimateLivePostActionArrivalV1({ ...args, arrivalMode: 'first_entry' });
      const relay = estimateLivePostActionArrivalV1(args), runner = estimateLivePostActionArrivalV1(args);
      expect(carry.arrivalSeconds).toBe(Math.max(now, 1.8));
      expect(relay.arrivalSeconds).toBe(carry.arrivalSeconds);
      expect(runner.arrivalSeconds).toBe(carry.arrivalSeconds);
    }
    expect(estimateLivePostActionArrivalV1(input({ nowSeconds: 1.3, nowTick: tick(1.3), target: v(), knownAction: known })).remainingSeconds)
      .toBe(1.8 - 1.3);
  });

  it('preserves exact seconds beneath the clock quantum and input immutability', () => {
    const known = action({ readySeconds: 2.80000001, readyTick: tick(2.80000001) });
    const i = input({ knownAction: known, target: known.position }), before = JSON.stringify(i);
    const result = estimateLivePostActionArrivalV1(i);
    expect(result.arrivalSeconds).toBe(2.80000001);
    expect(result.arrivalTick).toBe(tick(2.80000001));
    expect(result.arrivalSeconds).not.toBe((result.arrivalTick - clock.originTick) / clock.ticksPerSecond);
    expect(JSON.stringify(i)).toBe(before);
    expect(Object.isFrozen(i.actor.position)).toBe(false);
  });

  it('preserves individual motor and translated park coordinates', () => {
    const known = action(), ordinary = estimateLivePostActionArrivalV1(input({ knownAction: known }));
    const slow = estimateLivePostActionArrivalV1(input({ actor: { ...actor, topSpeedMps: 4, accelerationMps2: 3 }, knownAction: known }));
    expect(slow.arrivalSeconds).toBeGreaterThan(ordinary.arrivalSeconds);
    const shift = (p: ReturnType<typeof v>) => v(p.x + 33, p.y, p.z - 57);
    const shifted = estimateLivePostActionArrivalV1(input({ actor: { ...actor, position: shift(actor.position) },
      target: shift(v(5)), knownAction: { ...known, position: shift(known.position) } }));
    expect(shifted.arrivalSeconds).toBeCloseTo(ordinary.arrivalSeconds, 14);
  });

  it('rejects inconsistent clocks, invalid motor inputs, stale or unowned knowledge', () => {
    for (const overrides of [{ nowTick: tick(2) + 1 }, { nowSeconds: NaN }, { scopeId: '' },
      { clock: { originTick: -1, ticksPerSecond: 100 } }, { actor: { ...actor, topSpeedMps: 0 } },
      { target: v(Infinity) }, { radiusMeters: -1 }, { notBeforeSeconds: NaN }]) {
      expect(() => estimateLivePostActionArrivalV1(input(overrides))).toThrow();
    }
    const known = action();
    const invalid = [action({ readyTick: known.readyTick + 1 }), action({ uncertaintySeconds: -1 }),
      action({ provenance: { ...known.provenance, scopeId: 'another-play' } }),
      action({ provenance: { ...known.provenance, actorId: 'another-player' } }),
      action({ provenance: { ...known.provenance, sourceId: '' } }),
      action({ provenance: { ...known.provenance, revision: -1 } }),
      action({ provenance: { ...known.provenance, validThroughSeconds: 1.99 } }),
      action({ provenance: { ...known.provenance, observedSeconds: 2.1, observedTick: tick(2.1) } })];
    for (const bad of invalid) expect(() => estimateLivePostActionArrivalV1(input({ knownAction: bad }))).toThrow();
    expect(() => estimateLivePostActionArrivalV1(input({ knownAction: known, expectedActionRevision: 5 }))).toThrow();
    expect(() => estimateLivePostActionArrivalV1(input({ knownAction: action({ provenance: {
      ...known.provenance, kind: 'received', receivedSeconds: 2.1, receivedTick: tick(2.1) } }) }))).toThrow();
  });

  it('accepts scoped self or delivered knowledge while keeping the declared uncertainty', () => {
    const known = action();
    for (const kind of ['self', 'received'] as const) {
      const provenance = { ...known.provenance, kind,
        ...(kind === 'received' ? { receivedSeconds: 1.95, receivedTick: tick(1.95) } : {}) };
      const result = estimateLivePostActionArrivalV1(input({ knownAction: { ...known, provenance }, expectedActionRevision: 4 }));
      expect(result.knowledge).toBe(kind);
      expect(result.actionReadySeconds).toBe(2.8);
      expect(result.uncertaintySeconds).toBe(.1);
    }
  });

  it('does not hide future observation or expired knowledge within a shared quantized tick', () => {
    const nowSeconds = 2.0000002, known = action(), args = input({ nowSeconds, nowTick: tick(nowSeconds) });
    const futureSeconds = 2.0000003;
    expect(tick(nowSeconds)).toBe(tick(futureSeconds));
    expect(() => estimateLivePostActionArrivalV1({ ...args, knownAction: { ...known, provenance: { ...known.provenance,
      observedSeconds: futureSeconds, observedTick: tick(futureSeconds) } } })).toThrow();
    expect(() => estimateLivePostActionArrivalV1({ ...args, knownAction: { ...known, provenance: { ...known.provenance,
      kind: 'received', receivedSeconds: futureSeconds, receivedTick: tick(futureSeconds) } } })).toThrow();
    expect(() => estimateLivePostActionArrivalV1({ ...args, knownAction: { ...known, provenance: { ...known.provenance,
      validThroughSeconds: 2.0000001 } } })).toThrow();
    const readySeconds = 2.0000003;
    const result = estimateLivePostActionArrivalV1({ ...args, target: known.position,
      knownAction: { ...known, readySeconds, readyTick: tick(readySeconds) } });
    expect(result.arrivalTick).toBe(args.nowTick);
    expect(result.arrivalSeconds).toBeGreaterThan(nowSeconds);
  });

  it('rejects invalid observation adapters rather than inventing known recovery', () => {
    const known = action(), observed = { clock, provenance: known.provenance, recoveryRemainingSeconds: .8,
      position: v(), velocity: v(), uncertaintySeconds: .1 };
    for (const bad of [{ ...observed, recoveryRemainingSeconds: -1 }, { ...observed, recoveryRemainingSeconds: Infinity },
      { ...observed, velocity: v(NaN) }, { ...observed, provenance: { ...known.provenance, sourceId: '' } },
      { ...observed, provenance: { ...known.provenance, observedTick: 0 } },
      { ...observed, provenance: { ...known.provenance, kind: 'self' as const } }])
      expect(() => createLiveObservedPostActionV1(bad)).toThrow();
  });
});

describe('post action readiness dependency graph', () => {
  const gates = { clock, nowSeconds: 2, nowTick: tick(2), recoveryReadySeconds: 2.8,
    recognitionReadySeconds: 2.6, transferReadySeconds: 2.7 };
  it('parallel_wait_uses_max_not_sum and allows transfer-first charge to overlap recovery', () => {
    const result = resolveLivePostActionReadinessV1({ ...gates, charge: { durationSeconds: .3, startsAfter: 'transfer' } });
    expect(result.movementReadySeconds).toBe(2.8);
    expect(result.chargeReadySeconds).toBe(3);
    expect(result.releaseReadySeconds).toBe(3);
    expect(result.releaseReadyTick).toBe(tick(3));
  });
  it('honors a profile whose charge starts after recovery and transfer', () => {
    const result = resolveLivePostActionReadinessV1({ ...gates, charge: { durationSeconds: .3, startsAfter: 'recovery_and_transfer' } });
    expect(result.chargeReadySeconds).toBe(2.8 + .3);
    expect(result.releaseReadySeconds).toBe(2.8 + .3);
    const later = resolveLivePostActionReadinessV1({ ...gates, nowSeconds: 3, nowTick: tick(3),
      charge: { durationSeconds: .3, startsAfter: 'transfer' } });
    expect(later.chargeReadySeconds).toBe(3);
    expect(later.releaseReadySeconds).toBe(3);
  });
  it('keeps custody, posture and hand gates separate without making transfer delay locomotion', () => {
    const result = resolveLivePostActionReadinessV1({ ...gates, controlReadySeconds: 2.9,
      postureReadySeconds: 3, handReadySeconds: 3.5, transferReadySeconds: 3.2 });
    expect(result.movementReadySeconds).toBe(3);
    expect(result.releaseReadySeconds).toBe(3.5);
    expect(result.chargeReadySeconds).toBeNull();
    expect(() => resolveLivePostActionReadinessV1({ ...gates, charge: { durationSeconds: -1, startsAfter: 'transfer' } })).toThrow();
  });
  it('does not restart a no-action charge at each query or fabricate its absolute start', () => {
    const result = resolveLivePostActionReadinessV1({ clock, nowSeconds: 3, nowTick: tick(3), transferReadySeconds: 2.7,
      charge: { durationSeconds: .3, startsAfter: 'recovery_and_transfer' } });
    expect(result.chargeReadySeconds).toBe(3);
    expect(result.releaseReadySeconds).toBe(3);
    expect(() => resolveLivePostActionReadinessV1({ clock, nowSeconds: 3, nowTick: tick(3),
      charge: { durationSeconds: .3, startsAfter: 'transfer' } })).toThrow();
  });
});
