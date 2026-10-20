import { describe, expect, it } from 'vitest';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { createReferenceAerodynamicPhysicalSource } from './NativeAerodynamicReferenceFixture';
import { createNativeAerodynamicSession } from './NativeAerodynamicSession';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';

const actorsAtTick = (_tick: number): Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'> => ({
  defenders: [], runners: [],
});

const command = (attackZone: 'inside' | 'outside', approach: 'take' | 'aggressive') => ({
  pitcher: { attackZone, verticalPlan: 'middle' as const, aggression: 'balanced' as const },
  batter: { approach, swingBias: 'neutral' as const },
  runners: { posture: 'balanced' as const },
});
const session = () => createNativeAerodynamicSession({
  match: {
    ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null },
    score: { away: 0, home: 0 }, playId: 7,
  },
  startedAtTick: 0, matchSeed: 11003,
  batterRunnerId: 'reference-batter', batterHandedness: 'L', pitcherHandedness: 'R',
});

it('targets a declared sweet-spot band with small reproducible grip variation instead of a fixed midpoint', () => {
  const source = createReferenceAerodynamicPhysicalSource({ actorsAtTick, pitchSpeedMps: 40, batterAction: 'swing',
    sweetSpotBand: { minimumT: 0.65, maximumT: 0.78 } });
  const pa = session(), accepted = pa.acceptNextCommand(command('inside', 'aggressive'));
  const run = (ordinal: number) => source({ commandSession: accepted, ordinal, count: { balls: 0, strikes: 0 },
    lastEventTick: 0, previousFlightEndTick: null, match: {
      ruleProfileId: asRuleProfileId('npb-2026'), inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
      bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 7 } }).pitch;
  const aims = Array.from({ length: 20 }, (_, i) => {
    const pitch = run(i + 1);
    if (pitch.action.kind !== 'swing' || !pitch.action.swing.kinematicsV1) throw new Error('rigid kinematic swing required');
    const k = pitch.action.swing.kinematicsV1;
    expect(k.sweetSpotT).toBeGreaterThanOrEqual(0.65);
    expect(k.sweetSpotT).toBeLessThanOrEqual(0.78);
    return k.sweetSpotT;
  });
  expect(new Set(aims).size).toBeGreaterThan(1);
  const first = run(1), replay = run(1);
  if (first.action.kind !== 'swing' || replay.action.kind !== 'swing') throw new Error('swing required');
  expect(first.action.swing.kinematicsV1).toEqual(replay.action.swing.kinematicsV1);
  expect(first.trajectory).toEqual(replay.trajectory);
  expect(() => createReferenceAerodynamicPhysicalSource({ actorsAtTick, pitchSpeedMps: 40, batterAction: 'swing',
    sweetSpotBand: { minimumT: 0.8, maximumT: 0.7 } })).toThrow();
});

it('can aim the reference rigid bat at the actual plate trajectory and continue its real collision', () => {
  const pa = session();
  pa.acceptNextCommand(command('inside', 'aggressive'));
  const actual = pa.issue(createReferenceAerodynamicPhysicalSource({ actorsAtTick, pitchSpeedMps: 40, batterAction: 'swing',
    sweetSpotBand: { minimumT: 0.65, maximumT: 0.78 }, aimAtPlate: true }));
  expect(actual.phase).toBe('batted_ball_pending');
  expect(actual.result.rigidContact?.normalImpulseNs).toBeGreaterThan(0);
  expect(actual.result.requiresOfficialLiveBallResolution).toBe(true);
});

it('uses explicit measured aerodynamic coefficient and spin-decay inputs on the actual pitch', () => {
  const pa = session();
  pa.acceptNextCommand(command('inside', 'take'));
  const result = pa.issue(createReferenceAerodynamicPhysicalSource({ actorsAtTick, pitchSpeedMps: 40, batterAction: 'take',
    spinVectorRadPerSec: { x: 200, y: 0, z: 0 }, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }));
  expect(result.result.samples.at(-1)!.world.ball!.spin.x).toBeLessThan(200);
});

describe('reference-only physical source, not a player ability', () => {
  it('feeds a true 18m aerodynamic pitch, with real physics and original Native count, into read-only presentation', () => {
    const pa = session();
    pa.acceptNextCommand(command('inside', 'take'));
    const actual = pa.issue(createReferenceAerodynamicPhysicalSource({
      actorsAtTick, pitchSpeedMps: 40, batterAction: 'take',
    }));
    expect(actual.eventKinds).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    expect(actual.result.authority).toBe('NATIVE_CORE_AERODYNAMIC_RIGID_PITCH');
    expect(actual.result.samples.length).toBeGreaterThan(8);
    expect(actual.result.samples[0].world.ball?.position.z).toBe(18);
    expect(actual.result.samples.at(-1)?.world.ball?.position.z).toBeLessThan(0);
    expect(actual.result.requiresOfficialLiveBallResolution).toBe(false);
    expect(['active', 'walk', 'strikeout']).toContain(actual.phase);
  });

  it('honors next-pitch command without changing the accepted prefix; same seed is deterministic', () => {
    const run = () => {
      const pa = session();
      const physics = createReferenceAerodynamicPhysicalSource({
        actorsAtTick, pitchSpeedMps: 40, batterAction: 'take',
      });
      pa.acceptNextCommand(command('outside', 'take'));
      const first = pa.issue(physics);
      pa.acceptNextCommand(command('inside', 'take'));
      const second = pa.issue(physics);
      return [first, second] as const;
    };
    const [first, second] = run();
    expect(first).toEqual(run()[0]);
    expect(second).toEqual(run()[1]);
    expect(first.result.samples[0].world.ball?.velocity.x).toBeLessThan(0);
    expect(second.result.samples[0].world.ball?.velocity.x).toBeGreaterThan(0);
    expect(second.result.result.timeline.events.slice(0, first.result.result.timeline.events.length))
      .toEqual(first.result.result.timeline.events);
  });

  it('computes either genuine rigid contact or genuine swinging miss, never a made-up official hit/out', () => {
    const pa = session();
    pa.acceptNextCommand(command('inside', 'aggressive'));
    const contact = pa.issue(createReferenceAerodynamicPhysicalSource({
      actorsAtTick, pitchSpeedMps: 40, batterAction: 'swing',
    }));
    expect(contact.eventKinds).toEqual(contact.result.events.map(x => x.kind));
    expect(contact.result.nextMatchState).toBeNull();
    expect(['batted_ball_pending', 'active', 'strikeout']).toContain(contact.phase);
    if (contact.phase === 'batted_ball_pending') {
      expect(contact.result.rigidContact?.normalImpulseNs).toBeGreaterThan(0);
      expect(contact.result.requiresOfficialLiveBallResolution).toBe(true);
    } else {
      expect(contact.eventKinds).toContain('SwingCompletedWithoutContact');
      expect(contact.result.requiresOfficialLiveBallResolution).toBe(false);
    }
  });

  it('fails closed on non-physical reference inputs and does not invent ratings', () => {
    expect(() => createReferenceAerodynamicPhysicalSource({
      actorsAtTick, pitchSpeedMps: 50, batterAction: 'take',
    })).toThrow('<= 151 km/h');
    expect(() => createReferenceAerodynamicPhysicalSource({
      actorsAtTick, pitchSpeedMps: 0, batterAction: 'take',
    })).toThrow();
    expect(() => createReferenceAerodynamicPhysicalSource({
      actorsAtTick, pitchSpeedMps: 40, batterAction: 'take',
      spinVectorRadPerSec: { x: Number.NaN, y: 1, z: 0 },
    })).toThrow('source angular velocity');
    expect(() => createReferenceAerodynamicPhysicalSource({
      actorsAtTick, pitchSpeedMps: 40, batterAction: 'take',
      spinVectorRadPerSec: { x: 0, y: 1000, z: 0 },
    })).toThrow('<= 5000rpm');
  });

  it('different declared REAL angular velocity changes the actual RK4 flight, not only visual seam RPM', () => {
    const run = (rpm: number) => {
      const pa = session();
      pa.acceptNextCommand(command('inside', 'take'));
      const source = createReferenceAerodynamicPhysicalSource({
        actorsAtTick, pitchSpeedMps: 40, batterAction: 'take',
        spinVectorRadPerSec: { x: 0, y: rpm * Math.PI * 2 / 60, z: 0 },
        releaseOrientation: { w: 1, x: 0, y: 0, z: 0 },
      });
      return pa.issue(source);
    };
    const low = run(800);
    const high = run(2200);
    expect(low.eventKinds).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    expect(high.eventKinds).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    expect(low.result.samples[0].world.ball?.spin.y)
      .toBeCloseTo(800 * Math.PI * 2 / 60, 10);
    expect(high.result.samples[0].world.ball?.spin.y)
      .toBeCloseTo(2200 * Math.PI * 2 / 60, 10);
    expect(high.result.samples.at(-1)?.world.ball?.position.x)
      .not.toBe(low.result.samples.at(-1)?.world.ball?.position.x);
    expect(run(2200)).toEqual(high);
  });
});
