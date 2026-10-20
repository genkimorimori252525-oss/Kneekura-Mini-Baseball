import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY, type RigidBatPhysicalProperties } from '../../core/sim/contact/RigidBatBallContact';
import { createSwingKinematicsTrajectoryV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import type { AerodynamicRigidPitchAgainstBatterInput } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { sampleAerodynamicPitchTrajectory, type AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { createNativeAerodynamicSession, type NativeAerodynamicPhysicalPitchSource } from './NativeAerodynamicSession';

const START = 1_000_000;
const match = (balls = 0, strikes = 0, loaded = false): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1, half: 'top', outs: 1, balls, strikes,
  bases: loaded
    ? { first: 'runner-one', second: 'runner-two', third: 'runner-three' }
    : { first: null, second: null, third: null },
  score: { away: 0, home: 0 }, playId: 51,
});

const actors: Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'> = {
  defenders: [{
    playerId: 'native-pitcher', registeredPosition: 'P',
    position: { x: 0, z: 0.2 }, velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  }],
  runners: [{ playerId: 'runner-one', position: { x: 10, z: 0 }, velocity: { x: 0, z: 0 } }],
};

const command = (side: 'inside' | 'outside' = 'inside') => ({
  pitcher: { attackZone: side, verticalPlan: 'middle' as const, aggression: 'balanced' as const },
  batter: { approach: 'balanced' as const, swingBias: 'neutral' as const },
  runners: { posture: 'balanced' as const },
});

const trajectory = (start: number, x = 0, duration = 6_000): AerodynamicPitchTrajectory => ({
  start: {
    tick: start,
    position: { x, y: 1, z: 0.2 },
    velocity: { x: 0, y: 0, z: -60 },
    spin: { x: 30, y: 90, z: 10 },
  },
  endTick: start + duration,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 100,
    gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
  },
});

const take = (start: number, x = 0, duration = 6_000): AerodynamicRigidPitchAgainstBatterInput => ({
  action: { kind: 'take' },
  trajectory: trajectory(start, x, duration),
  plateZ: 0,
  strikeZone: { centerX: 0, halfWidth: 0.25, lowerY: 0.5, upperY: 1.5 },
  ballRadiusMeters: REALISTIC_BASEBALL_RIGID_BODY.radiusM,
});

const physical: RigidBatPhysicalProperties = {
  massKg: 0.9, centerOfMassT: 0.6,
  transverseMomentOfInertiaKgM2: 0.06,
  axialMomentOfInertiaKgM2: 0.00055,
  radiusProfile: { knots: [{ t: 0, radiusM: 0.033 }, { t: 1, radiusM: 0.033 }] },
};

const misses = (start: number): AerodynamicRigidPitchAgainstBatterInput => {
  const still = { x: 0, y: 0, z: 0 };
  const axis = { x: 1, y: 0, z: 0 };
  const far = { x: 4, y: 1, z: 0 };
  return {
    action: {
      kind: 'swing',
      swing: createRigidBatSwingWindowFromKinematicsV1(createSwingKinematicsTrajectoryV1({
        startTick: start, contactTick: start + 3_000, endTick: start + 6_000,
        ticksPerSecond: 1_000_000, batLengthM: 0.84, sweetSpotT: 0.5,
        start: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
        contact: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
        finish: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
      }), physical),
    },
    trajectory: trajectory(start, 0, 7_000),
    ball: REALISTIC_BASEBALL_RIGID_BODY,
    parameterResolver: () => { throw new Error('A genuine physical miss cannot request impact parameters'); },
  };
};

const contact = (start: number): AerodynamicRigidPitchAgainstBatterInput => ({
  action: {
    kind: 'swing',
    swing: {
      startTick: start, endTick: start + 6_000, ticksPerSecond: 1_000_000,
      stateAtStart: {
        pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      },
      physical,
    },
  },
  trajectory: trajectory(start),
  ball: REALISTIC_BASEBALL_RIGID_BODY,
  parameterResolver: () => ({ normalRestitution: 0.5, tangentialRestitution: 0.3, frictionCoefficient: 0.2 }),
});

const session = (initialMatch = match(), matchSeed = 42) => createNativeAerodynamicSession({
  match: initialMatch, startedAtTick: 900_000, matchSeed,
  batterRunnerId: 'batter-native', batterHandedness: 'L', pitcherHandedness: 'R',
});

const source = (pitch: AerodynamicRigidPitchAgainstBatterInput): NativeAerodynamicPhysicalPitchSource => () => ({
  pitch, actorsAtTick: () => actors,
});

describe('Native aerodynamic one-PA session with explicit real physical source', () => {
  it('locks a copied command before the next issue and makes no physical claim until source input arrives', () => {
    const pa = session();
    const request = command('inside');
    const accepted = pa.acceptNextCommand(request);
    expect(accepted).toEqual({
      playId: 51, batterRunnerId: 'batter-native', acceptedAtTick: 900_000,
      matchSeed: 42, command: command('inside'),
    });
    expect(Object.isFrozen(accepted.command.pitcher)).toBe(true);
    request.pitcher.attackZone = 'outside';
    expect(accepted.command.pitcher.attackZone).toBe('inside');
    expect(pa.inspect()).toMatchObject({ phase: 'active', count: { balls: 0, strikes: 0 }, pitches: 0 });
    expect(pa.inspect().pendingCommand).toBe(accepted);
    expect(() => pa.acceptNextCommand(command('outside'))).toThrow('already accepted');
    const result = pa.issue(({ commandSession, ordinal, count, lastEventTick, previousFlightEndTick, match }) => {
      expect(commandSession).toBe(accepted);
      expect(Object.isFrozen(commandSession.command)).toBe(true);
      expect(ordinal).toBe(0);
      expect(count).toEqual({ balls: 0, strikes: 0 });
      expect(lastEventTick).toBe(900_000);
      expect(previousFlightEndTick).toBeNull();
      expect(match.playId).toBe(51);
      return { pitch: take(START), actorsAtTick: () => actors };
    });
    expect(result.ordinal).toBe(0);
    expect(result.commandSession).toBe(accepted);
    expect(result.result.authority).toBe('NATIVE_CORE_AERODYNAMIC_RIGID_PITCH');
    expect(result.eventKinds).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    expect(result.phase).toBe('active');
    expect(result.count).toEqual({ balls: 0, strikes: 1 });
    expect(result.nextMatchState).toBeNull();
    expect(result.result.events[0]).toBe(result.result.result.timeline.events[0]);
    expect(pa.inspect().pendingCommand).toBeNull();
    expect(pa.inspect().previousFlightEndTick).toBe(START + 6_000);
    expect(result.result.samples[0].world.defenders).toBe(actors.defenders);
    const sample = result.result.samples.at(-1)!;
    expect(sample.world.ball).toEqual((() => {
      const aero = sampleAerodynamicPitchTrajectory(take(START).trajectory, sample.world.tick);
      return { position: aero.position, velocity: aero.velocity, spin: aero.spin };
    })());
  });

  it('allows revised commands only on later issued pitches; the supplied physical source interprets each one', () => {
    const pa = session();
    const actualSource: NativeAerodynamicPhysicalPitchSource = ({ commandSession, ordinal, previousFlightEndTick }) => {
      if (ordinal > 0) expect(previousFlightEndTick).toBe(START + 6_000);
      const horizontalOffset = commandSession.command.pitcher.attackZone === 'outside' ? 1 : 0;
      return { pitch: take(START + ordinal * 10_000, horizontalOffset), actorsAtTick: () => actors };
    };
    pa.acceptNextCommand(command('inside'));
    const first = pa.issue(actualSource);
    const firstBefore = JSON.stringify(first.result);
    expect(first.eventKinds).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    pa.acceptNextCommand(command('outside'));
    const second = pa.issue(actualSource);
    expect(second.ordinal).toBe(1);
    expect(second.commandSession.acceptedAtTick).toBe(first.result.result.timeline.lastEventTick);
    expect(first.count).toEqual({ balls: 0, strikes: 1 });
    expect(second.count).toEqual({ balls: 1, strikes: 1 });
    expect(JSON.stringify(first.result)).toBe(firstBefore);
    expect(first.result.result.timeline.events).toEqual(second.result.result.timeline.events.slice(0, 2));
    expect(second.result.events.map(e => e.sequence)).toEqual([2, 3]);
  });

  it('is deterministic for identical seed, accepted commands, and explicit production physics', () => {
    const first = session(match(0, 0), 1234);
    const second = session(match(0, 0), 1234);
    for (const pa of [first, second]) pa.acceptNextCommand(command('outside'));
    const a = first.issue(source(take(START, 1)));
    const b = second.issue(source(take(START, 1)));
    expect(a).toEqual(b);
    expect(first.inspect()).toEqual(second.inspect());
    expect(a.result.samples.every(s => s.world.ball !== null)).toBe(true);
  });

  it('uses native four-ball count and forced advancement; terminal phase cannot issue another pitch', () => {
    const pa = session(match(0, 0, true));
    for (let ordinal = 0; ordinal < 4; ordinal += 1) {
      pa.acceptNextCommand(command('outside'));
      const pitch = pa.issue(source(take(START + 10_000 * ordinal, 1)));
      expect(pitch.ordinal).toBe(ordinal);
      expect(pitch.eventKinds).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
      if (ordinal < 3) {
        expect(pitch.phase).toBe('active');
        expect(pitch.count).toEqual({ balls: ordinal + 1, strikes: 0 });
      } else {
        expect(pitch.phase).toBe('walk');
        expect(pitch.count).toBeNull();
        expect(pitch.nextMatchState).toMatchObject({
          playId: 52, balls: 0, strikes: 0, outs: 1,
          bases: { first: 'batter-native', second: 'runner-one', third: 'runner-two' },
          score: { away: 1, home: 0 },
        });
      }
    }
    expect(pa.inspect().phase).toBe('walk');
    expect(pa.inspect().nextMatchState?.score.away).toBe(1);
    expect(() => pa.acceptNextCommand(command())).toThrow('another pitch is forbidden');
  });

  it('uses native rigid-body Swing Kinematics v1 misses for a real strikeout', () => {
    const pa = session(match(0, 0));
    for (let ordinal = 0; ordinal < 3; ordinal += 1) {
      pa.acceptNextCommand(command());
      const issued = pa.issue(source(misses(START + ordinal * 10_000)));
      expect(issued.eventKinds).toEqual(['SwingCompletedWithoutContact', 'PitchAdjudicated']);
      expect(issued.result.rigidContact).toBeNull();
      if (ordinal < 2) expect(issued.count).toEqual({ balls: 0, strikes: ordinal + 1 });
      else {
        expect(issued.phase).toBe('strikeout');
        expect(issued.nextMatchState).toMatchObject({ outs: 2, playId: 52, balls: 0, strikes: 0 });
      }
    }
    expect(pa.inspect().phase).toBe('strikeout');
    expect(() => pa.acceptNextCommand(command())).toThrow('another pitch is forbidden');
  });

  it('stops at genuine rigid collision pending fielding/catch/umpire; no hit or out is invented', () => {
    const pa = session();
    pa.acceptNextCommand(command());
    const issued = pa.issue(source(contact(START)));
    expect(issued.phase).toBe('batted_ball_pending');
    expect(issued.eventKinds).toEqual(['BatBallContact']);
    expect(issued.count).toBeNull();
    expect(issued.nextMatchState).toBeNull();
    expect(issued.result.requiresOfficialLiveBallResolution).toBe(true);
    const rigidContact = issued.result.rigidContact;
    expect(rigidContact?.normalImpulseNs).toBeGreaterThan(0);
    expect(issued.result.samples.at(-1)?.world.tick).toBe(rigidContact?.tick);
    expect(issued.result.samples.at(-1)?.world.ball?.velocity).toEqual(rigidContact?.exitVelocity);
    expect(issued.result.frames.flatMap(f => f.events)).toEqual(issued.result.events);
    expect(() => pa.acceptNextCommand(command())).toThrow('another pitch is forbidden');
    expect(() => pa.issue(source(take(START + 10_000)))).toThrow('another pitch is forbidden');
  });

  it('stops at unresolved physical trajectory without adding a strike, ball, or official result', () => {
    const pa = session();
    pa.acceptNextCommand(command());
    const issued = pa.issue(source(take(START, 0, 1_000)));
    expect(issued.phase).toBe('unresolved');
    expect(issued.eventKinds).toEqual([]);
    expect(issued.result.result.timeline.events).toEqual([]);
    expect(issued.count).toEqual({ balls: 0, strikes: 0 });
    expect(issued.nextMatchState).toBeNull();
    expect(pa.inspect()).toMatchObject({ phase: 'unresolved', pitches: 1 });
    expect(() => pa.acceptNextCommand(command())).toThrow('another pitch is forbidden');
  });

  it('rejects missing physical evidence or overlapping flights without consuming the accepted command', () => {
    const pa = session();
    expect(() => pa.issue(source(take(START)))).toThrow('accepted next-pitch command');
    pa.acceptNextCommand(command());
    const originalPending = pa.inspect().pendingCommand;
    expect(() => pa.issue(() => { throw new Error('Physical source unavailable'); })).toThrow('Physical source unavailable');
    expect(() => pa.issue(() => ({ pitch: take(START), actorsAtTick: () => null as unknown as typeof actors })))
      .toThrow('Missing authoritative native actor');
    expect(pa.inspect()).toMatchObject({ phase: 'active', pitches: 0, previousFlightEndTick: null });
    expect(pa.inspect().pendingCommand).toBe(originalPending);
    pa.issue(source(take(START)));
    pa.acceptNextCommand(command());
    const secondPending = pa.inspect().pendingCommand;
    expect(() => pa.issue(source(take(START + 5_000)))).toThrow('follow the accepted count and all previous flights');
    expect(pa.inspect()).toMatchObject({ phase: 'active', pitches: 1, previousFlightEndTick: START + 6_000 });
    expect(pa.inspect().pendingCommand).toBe(secondPending);
    const second = pa.issue(source(take(START + 10_000)));
    expect(second.ordinal).toBe(1);
    expect(second.count).toEqual({ balls: 0, strikes: 2 });
  });

  it('blocks reentrant physical-source calls and commits a single canonical pitch', () => {
    const pa = session();
    pa.acceptNextCommand(command());
    const issued = pa.issue(() => {
      expect(() => pa.acceptNextCommand(command())).toThrow('reenter');
      expect(() => pa.issue(source(take(START + 10_000)))).toThrow('reenter');
      return { pitch: take(START), actorsAtTick: () => actors };
    });
    expect(issued.eventKinds).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    expect(pa.inspect().pitches).toBe(1);
  });

  it('validates required source identities and seed without choosing any physics or roster', () => {
    expect(() => createNativeAerodynamicSession({
      match: match(), startedAtTick: 900_000, matchSeed: 1.2,
      batterRunnerId: 'batter-native', batterHandedness: 'R', pitcherHandedness: 'L',
    })).toThrow('matchSeed must be a safe integer');
    expect(() => createNativeAerodynamicSession({
      match: match(), startedAtTick: 900_000, matchSeed: 42,
      batterRunnerId: ' ', batterHandedness: 'R', pitcherHandedness: 'L',
    })).toThrow('actual batter-runner ID');
    expect(() => createNativeAerodynamicSession({
      match: match(), startedAtTick: 900_000, matchSeed: 42,
      batterRunnerId: 'batter-native', batterHandedness: 'X' as 'R', pitcherHandedness: 'L',
    })).toThrow('handedness');
  });
});
