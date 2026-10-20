import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { createPlateAppearanceCommand } from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import { createPlateAppearanceCommandSession } from '../../core/sim/plateAppearance/PlateAppearanceCommandSession';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { buildMiniPresentationTimeline } from '../../presentation/mini/MiniPresentationTimeline';
import { issueNativeCommandPitch, observeNativePitch } from './NativePitchObserverAdapter';

const match = (balls = 0, strikes = 0): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1, half: 'top', outs: 0, balls, strikes,
  bases: { first: 'lad-runner-1', second: 'lad-runner-2', third: 'lad-runner-3' },
  score: { away: 0, home: 0 }, playId: 1,
});

const actors: Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'> = {
  defenders: [{
    playerId: 'tbd-tikao', registeredPosition: 'P',
    position: { x: 0, z: 18 }, velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  }],
  runners: [{ playerId: 'lad-runner-1', position: { x: 18, z: 0 }, velocity: { x: 0, z: 0 } }],
};
const atTick = (_tick: number) => actors;

const command = (attackZone: 'inside' | 'outside' = 'outside',
                 aggression: 'balanced' | 'waste' = 'balanced') => createPlateAppearanceCommand({
  pitcher: { attackZone, verticalPlan: 'low', aggression },
  batter: { approach: 'take', swingBias: 'neutral' },
  runners: { posture: 'balanced' },
});

const environment = (pitchOrdinal = 0, pitchStartTick = 1_100_000) => ({
  pitchStartTick,
  pitchOrdinal,
  ticksPerSecond: 1_000_000,
  pitchDurationTicks: 400_000,
  releasePosition: { x: 0, y: 1.8, z: 18 },
  acceleration: { x: 0, y: -9.8, z: 0 },
  plateZ: 0,
  strikeZone: { centerX: 0, halfWidth: 0.22, lowerY: 0.55, upperY: 1.15 },
  ballRadiusMeters: 0.0366,
  insideXDirection: 1 as const,
  targetCalibration: {
    challengeHorizontalZoneFraction: 0.45,
    balancedHorizontalZoneFraction: 0.8,
    wasteHorizontalZoneFraction: 1.3,
    lowVerticalZoneFraction: 0.2,
    middleVerticalZoneFraction: 0.5,
    highVerticalZoneFraction: 0.8,
  },
  batterCalibration: {
    balancedSwingProbability: 0.5,
    aggressiveSwingProbability: 1,
    earlyTimingOffsetTicks: -30_000,
    lateTimingOffsetTicks: 30_000,
    swingWindowHalfWidthTicks: 70_000,
  },
  swingStateAtWindowStart: {
    pose: { grip: { x: -0.5, y: 1, z: 0.3 }, tip: { x: 0.4, y: 1, z: 0.3 } },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 12, z: 0 },
  },
});

function takePitch(m = match(), c = command()) {
  return issueNativeCommandPitch({
    match: m, startedAtTick: 1_000_000,
    commandSession: createPlateAppearanceCommandSession({
      playId: m.playId, batterRunnerId: 'lad-ohtani', acceptedAtTick: 1_000_000,
      matchSeed: 77, command: c,
    }),
    environment: environment(),
    batterRunnerId: 'lad-ohtani',
    batterHandedness: 'L', pitcherHandedness: 'R', actorsAtTick: atTick,
  });
}

describe('real Native Match Core pitch → existing Mini PNG Presentation boundary', () => {
  it('uses the actual accepted Native physical events and the exact same ball trajectory at every renderer tick', () => {
    const observed = takePitch();
    expect(observed.authority).toBe('NATIVE_CORE_PHYSICAL_PITCH');
    expect(observed.kind).toBe('recorded');
    expect(observed.result.timeline.events.length).toBeGreaterThan(0);
    expect(observed.events.map(e => e.kind)).toContain('TakenPitchPlateCrossed');
    expect(observed.events.map(e => e.kind)).toContain('PitchAdjudicated');
    expect(observed.samples.length).toBeGreaterThan(5);
    const { trajectory } = observed.commanded.input;
    for (const sample of observed.samples) {
      expect(sample.world.ball?.position).toEqual(
        samplePitchTrajectorySegment(trajectory, sample.world.tick).position,
      );
      expect(sample.world.defenders).toBe(actors.defenders);
      expect(sample.world.runners).toBe(actors.runners);
      expect(sample.batter.handedness).toBe('L');
    }
    expect(observed.samples.map(s => s.world.tick))
      .toContain(observed.events[0].tick);
    expect(observed.frames.flatMap(f => f.events)).toEqual(observed.events);
    expect(observed.nextMatchState).toBeNull();
    expect(observed.requiresOfficialLiveBallResolution).toBe(false);
  });

  it('does not let a camera frame rate alter the accepted count or official events', () => {
    const a = takePitch();
    const differentCamera = buildMiniPresentationTimeline(a.samples, a.events, 'PITCHER_POV');
    expect(differentCamera.map(f => f.sample.world)).toEqual(a.frames.map(f => f.sample.world));
    expect(differentCamera.flatMap(f => f.events)).toEqual(a.events);
    expect(takePitch()).toEqual(a);
  });

  it('applies a real walk from the Native timeline including forced runner scoring', () => {
    const observed = takePitch(match(3, 1), command('outside', 'waste'));
    expect(observed.result.timeline.status.kind).toBe('walk');
    expect(observed.nextMatchState?.score.away).toBe(1);
    expect(observed.nextMatchState?.bases.first).toBe('lad-ohtani');
    expect(observed.nextMatchState?.bases.second).toBe('lad-runner-1');
    expect(observed.nextMatchState?.bases.third).toBe('lad-runner-2');
    expect(observed.nextMatchState?.playId).toBe(2);
  });

  it('accepts manager changes only for the NEXT unissued pitch, preserving the committed physical prefix', () => {
    const first = takePitch();
    expect(first.result.timeline.status.kind).toBe('active');
    const oldWorld = JSON.stringify(first.samples);
    const oldEvents = JSON.stringify(first.result.timeline.events);
    const second = issueNativeCommandPitch({
      match: match(), timeline: first.result.timeline, startedAtTick: 1_000_000,
      commandSession: createPlateAppearanceCommandSession({
        playId: 1, batterRunnerId: 'lad-ohtani',
        acceptedAtTick: first.result.timeline.lastEventTick,
        matchSeed: 77, command: command('inside'),
      }),
      environment: environment(1, 2_000_000),
      batterRunnerId: 'lad-ohtani', batterHandedness: 'L',
      pitcherHandedness: 'R', actorsAtTick: atTick,
    });
    expect(JSON.stringify(first.samples)).toBe(oldWorld);
    expect(JSON.stringify(first.result.timeline.events)).toBe(oldEvents);
    expect(second.commanded.targetPlatePosition.x)
      .not.toBe(first.commanded.targetPlatePosition.x);
    expect(second.result.timeline.events.slice(0, first.result.timeline.events.length))
      .toEqual(first.result.timeline.events);
    expect(() => issueNativeCommandPitch({
      match: match(), timeline: first.result.timeline, startedAtTick: 1_000_000,
      commandSession: createPlateAppearanceCommandSession({
        playId: 1, batterRunnerId: 'lad-ohtani', acceptedAtTick: first.result.timeline.lastEventTick + 1,
        matchSeed: 77, command: command('inside'),
      }),
      environment: environment(1, 2_000_000),
      batterRunnerId: 'lad-ohtani', batterHandedness: 'L',
      pitcherHandedness: 'R', actorsAtTick: atTick,
    })).toThrow('acceptance tick');
  });

  it('stops pitch observation at a true bat-ball contact; never draws the old pitch trajectory after impact', () => {
    const startTick = 1_000_000;
    const input = {
      action: { kind: 'swing' as const, swing: {
        startTick, endTick: startTick + 5_000, ticksPerSecond: 1_000_000,
        stateAtStart: {
          pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
          linearVelocity: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
        },
      } },
      trajectory: {
        start: { tick: startTick, position: { x: 0, y: 1, z: 0.2 },
          velocity: { x: 0, y: 0, z: -60 }, spin: { x: 0, y: 0, z: 0 } },
        acceleration: { x: 0, y: 0, z: 0 },
        endTick: startTick + 5_000, ticksPerSecond: 1_000_000,
      },
    };
    const result = observeNativePitch({
      match: match(0, 1), startedAtTick: 900_000, pitch: input,
      batterRunnerId: 'lad-ohtani', batterHandedness: 'L', pitcherHandedness: 'R',
      actorsAtTick: atTick,
    });
    expect(result.result.timeline.status.kind).toBe('batted_ball_pending');
    expect(result.requiresOfficialLiveBallResolution).toBe(true);
    expect(result.nextMatchState).toBeNull();
    expect(result.events.map(e => e.kind)).toContain('BatBallContact');
    const contactTick = result.events.find(e => e.kind === 'BatBallContact')?.tick;
    expect(result.samples.at(-1)?.world.tick).toBe(contactTick);
    expect(result.samples.every(sample => sample.world.tick <= (contactTick ?? 0))).toBe(true);
  });

  it('fails closed when authoritative actor states are unavailable', () => {
    expect(() => issueNativeCommandPitch({
      match: match(), startedAtTick: 1_000_000,
      commandSession: createPlateAppearanceCommandSession({
        playId: 1, batterRunnerId: 'lad-ohtani', acceptedAtTick: 1_000_000,
        matchSeed: 77, command: command(),
      }),
      environment: environment(), batterRunnerId: 'lad-ohtani',
      batterHandedness: 'L', pitcherHandedness: 'R',
      actorsAtTick: () => ({ defenders: null, runners: null }) as unknown as Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'>,
    })).toThrow('Missing authoritative actor');
  });
});
