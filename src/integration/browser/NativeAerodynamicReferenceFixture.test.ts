import { describe, expect, it } from 'vitest';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { createReferenceAerodynamicPhysicalSource } from './NativeAerodynamicReferenceFixture';
import { createNativeAerodynamicSession } from './NativeAerodynamicSession';

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
  });
});
