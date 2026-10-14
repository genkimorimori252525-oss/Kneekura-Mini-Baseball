import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY, type RigidBatPhysicalProperties } from '../../core/sim/contact/RigidBatBallContact';
import { createSwingKinematicsTrajectoryV1, sampleSwingStateV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { CanonicalPlateAppearanceEvent } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordAerodynamicRigidPitchAgainstBatter, type AerodynamicRigidPitchAgainstBatterInput } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import { sampleAerodynamicPitchTrajectory, type AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { multiplyQuaternions, quaternionFromAxisAngle } from '../../core/sim/pitching/BaseballOrientation';
import { observeNativeAerodynamicPitch, type NativeAerodynamicObserveInput } from './NativeAerodynamicObserver';

const START_TICK = 1_000_000;

const match = (balls = 0, strikes = 0): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1, half: 'top', outs: 0, balls, strikes,
  bases: { first: null, second: null, third: null },
  score: { away: 0, home: 0 }, playId: 70,
});

const trajectory = (durationTicks = 6_000): AerodynamicPitchTrajectory => ({
  start: {
    tick: START_TICK,
    position: { x: 0, y: 1, z: 0.2 },
    velocity: { x: 0, y: 0, z: -60 },
    spin: { x: 30, y: 90, z: 10 },
  },
  endTick: START_TICK + durationTicks,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 100,
    gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
  },
});

const actors: Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'> = {
  defenders: [{
    playerId: 'native-pitcher', registeredPosition: 'P',
    position: { x: 0, z: 0.2 }, velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  }],
  runners: [{ playerId: 'native-runner', position: { x: 10, z: 5 }, velocity: { x: 0, z: 0 } }],
};

const bat: RigidBatPhysicalProperties = {
  massKg: 0.9, centerOfMassT: 0.6,
  transverseMomentOfInertiaKgM2: 0.06,
  axialMomentOfInertiaKgM2: 0.00055,
  radiusProfile: { knots: [{ t: 0, radiusM: 0.033 }, { t: 1, radiusM: 0.033 }] },
};

const flatSwing = (startTick = START_TICK, endTick = START_TICK + 6_000) => ({
  startTick, endTick, ticksPerSecond: 1_000_000,
  stateAtStart: {
    pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
    linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 },
  },
  physical: bat,
});

const take = (durationTicks = 6_000): AerodynamicRigidPitchAgainstBatterInput => ({
  action: { kind: 'take' }, trajectory: trajectory(durationTicks), plateZ: 0,
  strikeZone: { centerX: 0, halfWidth: 0.25, lowerY: 0.5, upperY: 1.5 },
  ballRadiusMeters: REALISTIC_BASEBALL_RIGID_BODY.radiusM,
});

function observe(
  pitch: AerodynamicRigidPitchAgainstBatterInput,
  balls = 0,
  strikes = 0,
  spinOptions: Pick<NativeAerodynamicObserveInput, 'spinFrameTicks' | 'spinShutterTicks'> = {},
) {
  const timelineBefore = createCanonicalPlateAppearanceTimeline(match(balls, strikes), 900_000);
  const resolution = resolveAndRecordAerodynamicRigidPitchAgainstBatter(timelineBefore, pitch);
  const observation = observeNativeAerodynamicPitch({
    timelineBefore, resolution, pitch,
    batterHandedness: 'L', pitcherHandedness: 'R', actorsAtTick: () => actors,
    ...spinOptions,
  });
  return { timelineBefore, resolution, observation };
}

describe('Native production aerodynamic pitch read-only observation', () => {
  it('samples the real aero RK4 world, preserving exact accepted take/call events and original timeline', () => {
    const pitch = take();
    const { timelineBefore, resolution, observation } = observe(pitch);
    expect(observation.authority).toBe('NATIVE_CORE_AERODYNAMIC_RIGID_PITCH');
    expect(observation.kind).toBe('recorded_take');
    expect(observation.events.map(event => event.kind)).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    expect(observation.events[0]).toBe(resolution.timeline.events[0]);
    expect(observation.events[1]).toBe(resolution.timeline.events[1]);
    expect(observation.frames.flatMap(frame => frame.events)).toEqual(observation.events);
    expect(observation.spinFrames.map(frame => frame.tick))
      .toEqual(observation.samples.map(sample => sample.world.tick));
    expect(observation.spinFrames.every(frame => frame.authority === 'PRESENTATION_ONLY_NATIVE_SPIN')).toBe(true);
    for (const sample of observation.samples) {
      const flight = sampleAerodynamicPitchTrajectory(pitch.trajectory, sample.world.tick);
      expect(sample.world.ball).toEqual({ position: flight.position, velocity: flight.velocity, spin: flight.spin });
      expect(sample.world.defenders).toBe(actors.defenders);
      expect(sample.world.runners).toBe(actors.runners);
      expect(sample.batter).toEqual({ handedness: 'L', action: 'idle', bat: null });
      expect(sample.pitcherHandedness).toBe('R');
      const spin = observation.spinFrames.find(frame => frame.tick === sample.world.tick)!;
      expect(spin.angularVelocityWorldRadPerSecond).toEqual(flight.spin);
      expect(spin.orientationProvenance).toBe('identity_display_convention_uncalibrated');
      expect(spin.hasSourceReleaseOrientation).toBe(false);
      expect(spin.shutter.angularTravelRadians).toBe(0);
    }
    expect(observation.samples.map(s => s.world.tick)).toContain(observation.events[0].tick);
    expect(observation.result).toBe(resolution);
    expect(timelineBefore.events).toEqual([]);
    expect(timelineBefore.status.kind).toBe('active');
    expect(observation.nextMatchState).toBeNull();
    expect(observation.requiresOfficialLiveBallResolution).toBe(false);
  });

  it('leaves even an already accepted fourth-ball walk entirely to canonical Match Core', () => {
    const pitch = { ...take(), strikeZone: { centerX: 99, halfWidth: 0.25, lowerY: 0.5, upperY: 1.5 } };
    const { resolution, observation } = observe(pitch, 3, 1);
    expect(resolution.timeline.status.kind).toBe('walk');
    expect(observation.events.map(event => event.kind)).toEqual(['TakenPitchPlateCrossed', 'PitchAdjudicated']);
    expect(observation.nextMatchState).toBeNull();
    expect(observation.requiresOfficialLiveBallResolution).toBe(false);
  });

  it('converts the presentation cadence using the trajectory physical clock', () => {
    const base = trajectory(200);
    const pitch: AerodynamicRigidPitchAgainstBatterInput = {
      ...take(),
      trajectory: {
        ...base,
        parameters: { ...base.parameters, ticksPerSecond: 1_000, integrationStepTicks: 1 },
      },
    };
    const { observation } = observe(pitch);
    expect(observation.samples.map(sample => sample.world.tick)).toEqual(expect.arrayContaining([
      START_TICK, START_TICK + 55, START_TICK + 110, START_TICK + 165, START_TICK + 200,
    ]));
    expect(observation.samples.map(sample => sample.world.tick)).toContain(observation.events[0].tick);
  });

  it('cuts off the former pitch at exact REAL rigid bat impact and shows canonical exit impulse only on that tick', () => {
    let contactResolverCalls = 0;
    const pitch: AerodynamicRigidPitchAgainstBatterInput = {
      action: { kind: 'swing', swing: flatSwing() },
      trajectory: trajectory(), ball: REALISTIC_BASEBALL_RIGID_BODY,
      parameterResolver: () => {
        contactResolverCalls += 1;
        return { normalRestitution: 0.5, tangentialRestitution: 0.3, frictionCoefficient: 0.2 };
      },
    };
    const before = createCanonicalPlateAppearanceTimeline(match(), 900_000);
    const resolution = resolveAndRecordAerodynamicRigidPitchAgainstBatter(before, pitch);
    expect(resolution.kind).toBe('recorded_swing');
    if (resolution.kind !== 'recorded_swing' || resolution.physical.kind !== 'contact') throw new Error('Physical collision fixture failed');
    expect(contactResolverCalls).toBeGreaterThan(0);
    const callsBeforeObservation = contactResolverCalls;
    const acceptedBeforeObservation = JSON.stringify(resolution.timeline);
    const observed = observeNativeAerodynamicPitch({
      timelineBefore: before, resolution, pitch,
      batterHandedness: 'L', pitcherHandedness: 'R', actorsAtTick: () => actors,
      spinShutterTicks: 4_000,
    });
    const contact = resolution.physical.contact;
    expect(contactResolverCalls).toBe(callsBeforeObservation);
    expect(JSON.stringify(resolution.timeline)).toBe(acceptedBeforeObservation);
    expect(observed.rigidContact).toBe(contact);
    expect(observed.events.map(e => e.kind)).toEqual(['BatBallContact']);
    expect(observed.events[0]).toBe(resolution.timeline.events[0]);
    expect(observed.samples.at(-1)?.world.tick).toBe(contact.tick);
    expect(observed.samples.every(sample => sample.world.tick <= contact.tick)).toBe(true);
    expect(observed.spinFrames.at(-1)?.tick).toBe(contact.tick);
    expect(observed.spinFrames.every(frame => frame.tick <= contact.tick)).toBe(true);
    expect(observed.spinFrames.at(-1)?.angularVelocityWorldRadPerSecond)
      .toEqual(sampleAerodynamicPitchTrajectory(pitch.trajectory, contact.tick).spin);
    expect(observed.spinFrames.at(-1)?.shutter.closeTick).toBe(contact.tick);
    expect(observed.spinFrames.at(-1)?.shutter.openTick).toBeLessThan(contact.tick);
    expect(observed.spinFrames.at(-1)?.shutter.angularTravelRadians).toBeGreaterThan(0);
    expect(observed.samples.at(-1)?.world.ball).toEqual({
      position: contact.ballCenter, velocity: contact.exitVelocity, spin: contact.exitSpin,
    });
    expect(observed.samples[0].world.ball).toEqual({
      position: pitch.trajectory.start.position,
      velocity: pitch.trajectory.start.velocity,
      spin: pitch.trajectory.start.spin,
    });
    expect(observed.samples.at(-1)?.batter.bat).toEqual(flatSwing().stateAtStart.pose);
    expect(observed.requiresOfficialLiveBallResolution).toBe(true);
    expect(observed.nextMatchState).toBeNull();
    expect(resolution.timeline.status.kind).toBe('batted_ball_pending');
    expect(observed.frames.flatMap(f => f.events)).toEqual(observed.events);
    expect(() => observeNativeAerodynamicPitch({
      timelineBefore: before, resolution, pitch,
      batterHandedness: 'L', pitcherHandedness: 'R', actorsAtTick: () => actors,
      spinFrameTicks: [contact.tick + 1],
    })).toThrow('inside the true source flight through physical contact');
  });

  it('reuses production Swing Kinematics v1 for a physical miss without drawing invented pre/post window swings', () => {
    const far = { x: 5, y: 1, z: 0 };
    const axis = { x: 1, y: 0, z: 0 };
    const still = { x: 0, y: 0, z: 0 };
    const swingKinematics = createSwingKinematicsTrajectoryV1({
      startTick: START_TICK + 10_000,
      contactTick: START_TICK + 70_000,
      endTick: START_TICK + 120_000,
      ticksPerSecond: 1_000_000, batLengthM: 0.84, sweetSpotT: 0.5,
      start: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
      contact: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
      finish: { sweetSpotPosition: far, sweetSpotVelocity: still, batAxis: axis },
    });
    const pitch: AerodynamicRigidPitchAgainstBatterInput = {
      action: { kind: 'swing', swing: createRigidBatSwingWindowFromKinematicsV1(swingKinematics, bat) },
      trajectory: trajectory(130_000), ball: REALISTIC_BASEBALL_RIGID_BODY,
      parameterResolver: () => { throw new Error('No physical collision: resolver must not be called'); },
    };
    const { resolution, observation } = observe(pitch, 0, 2);
    expect(resolution.kind).toBe('recorded_swing');
    expect(resolution.timeline.status.kind).toBe('strikeout');
    expect(observation.events.map(e => e.kind)).toEqual(['SwingCompletedWithoutContact', 'PitchAdjudicated']);
    expect(observation.events[0].tick).toBe(START_TICK + 120_000);
    expect(observation.frames.flatMap(frame => frame.events)).toEqual(observation.events);
    expect(observation.rigidContact).toBeNull();
    expect(observation.nextMatchState).toBeNull();
    expect(observation.requiresOfficialLiveBallResolution).toBe(false);
    const first = observation.samples[0];
    const during = observation.samples.find(sample => sample.world.tick === START_TICK + 55_000);
    const after = observation.samples.at(-1);
    expect(first.batter).toEqual({ handedness: 'L', action: 'idle', bat: null });
    expect(during?.batter.bat).toEqual(sampleSwingStateV1(swingKinematics, START_TICK + 55_000).pose);
    expect(during?.batter.action).toBe('normal_swing');
    expect(after?.batter).toEqual({ handedness: 'L', action: 'idle', bat: null });
  });

  it('reports a flight without real plate crossing as unresolved, without manufacturing a ball or strike', () => {
    const { timelineBefore, resolution, observation } = observe(take(1_000));
    expect(resolution.kind).toBe('unresolved');
    expect(resolution.timeline).toBe(timelineBefore);
    expect(observation.events).toEqual([]);
    expect(observation.frames.every(frame => frame.events.length === 0)).toBe(true);
    expect(observation.nextMatchState).toBeNull();
    expect(observation.requiresOfficialLiveBallResolution).toBe(false);
  });

  it('fails closed on missing native actors, stale prefixes, or an injected official event', () => {
    const pitch = take();
    const before = createCanonicalPlateAppearanceTimeline(match(), 900_000);
    const resolution = resolveAndRecordAerodynamicRigidPitchAgainstBatter(before, pitch);
    const base = {
      timelineBefore: before, pitch, resolution,
      batterHandedness: 'L' as const, pitcherHandedness: 'R' as const,
      actorsAtTick: () => actors,
    };
    expect(() => observeNativeAerodynamicPitch({
      ...base, actorsAtTick: () => null as unknown as typeof actors,
    })).toThrow('Missing authoritative native actor');
    expect(() => observeNativeAerodynamicPitch({
      ...base, timelineBefore: { ...before, lastEventTick: START_TICK + 1 },
    })).toThrow('preserved active canonical timeline');
    const injected: CanonicalPlateAppearanceEvent = {
      kind: 'BattedBallDeclaredFair', tick: resolution.timeline.lastEventTick,
      sequence: resolution.timeline.nextSequence, payload: { contactTick: START_TICK },
    };
    const forged = {
      ...resolution,
      timeline: { ...resolution.timeline, events: [...resolution.timeline.events, injected], nextSequence: resolution.timeline.nextSequence + 1 },
    };
    expect(() => observeNativeAerodynamicPitch({ ...base, resolution: forged })).toThrow('real aerodynamic plate crossing');
  });

  it('rejects a contact event whose canonical exit velocity contradicts the rigid collision', () => {
    const pitch: AerodynamicRigidPitchAgainstBatterInput = {
      action: { kind: 'swing', swing: flatSwing() }, trajectory: trajectory(),
      ball: REALISTIC_BASEBALL_RIGID_BODY,
      parameterResolver: () => ({ normalRestitution: 0.5, tangentialRestitution: 0.3, frictionCoefficient: 0.2 }),
    };
    const before = createCanonicalPlateAppearanceTimeline(match(), 900_000);
    const result = resolveAndRecordAerodynamicRigidPitchAgainstBatter(before, pitch);
    const original = result.timeline.events[0];
    if (original.kind !== 'BatBallContact') throw new Error('Expected physical contact');
    const altered: CanonicalPlateAppearanceEvent = {
      ...original, payload: {
        ...original.payload,
        contact: { ...original.payload.contact, exitVelocity: { x: 999, y: 999, z: 999 } },
      },
    };
    const resolution = { ...result, timeline: { ...result.timeline, events: [altered] } };
    expect(() => observeNativeAerodynamicPitch({
      timelineBefore: before, pitch, resolution,
      batterHandedness: 'L', pitcherHandedness: 'R', actorsAtTick: () => actors,
    })).toThrow('exact rigid contact');
  });
});

describe('Native aerodynamic rigid observation: physical material rotation for display', () => {
  const asRadiansPerSecond = (rpm: number) => rpm * 2 * Math.PI / 60;

  it.each([800, 2200])('preserves %i rpm Native spin with a source-authenticated release phase and unwrapped exposure', rpm => {
    const velocity = asRadiansPerSecond(rpm);
    const releaseOrientation = quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 5);
    const base = trajectory(32_000);
    const pitch: AerodynamicRigidPitchAgainstBatterInput = {
      ...take(32_000),
      trajectory: {
        ...base,
        start: { ...base.start, spin: { x: 0, y: velocity, z: 0 } },
        releaseOrientation,
      },
    };
    const highFrequencyTicks = [START_TICK + 1_000, START_TICK + 18_000, START_TICK + 30_000];
    const { observation, resolution } = observe(pitch, 0, 0, {
      spinFrameTicks: highFrequencyTicks,
      spinShutterTicks: 16_666,
    });
    expect(observation.result).toBe(resolution);
    expect(observation.spinFrames.map(f => f.tick)).toEqual(
      [...new Set([...observation.samples.map(s => s.world.tick), ...highFrequencyTicks])].sort((a, b) => a - b),
    );
    const initial = observation.spinFrames[0];
    const later = observation.spinFrames.find(f => f.tick === START_TICK + 18_000)!;
    expect(initial.orientationMaterialToWorld).toEqual(releaseOrientation);
    expect(later.orientationProvenance).toBe('native_source_release_orientation');
    expect(later.hasSourceReleaseOrientation).toBe(true);
    expect(later.spinAxisWorld).toEqual({ x: 0, y: 1, z: 0 });
    expect(later.angularSpeedRadPerSecond).toBeCloseTo(velocity, 11);
    expect(later.angularVelocityWorldRadPerSecond)
      .toEqual(sampleAerodynamicPitchTrajectory(pitch.trajectory, later.tick).spin);
    expect(later.angularTravelSinceReleaseRadians).toBeCloseTo(velocity * 0.018, 9);
    const expected = multiplyQuaternions(
      quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, velocity * 0.018),
      releaseOrientation,
    );
    const actual = later.orientationMaterialToWorld;
    const orientationDot = actual.w * expected.w + actual.x * expected.x
      + actual.y * expected.y + actual.z * expected.z;
    expect(Math.abs(orientationDot)).toBeCloseTo(1, 10);
    expect(later.shutter.openTick).toBe(START_TICK + 18_000 - 8_333);
    expect(later.shutter.closeTick).toBe(START_TICK + 18_000 + 8_333);
    expect(later.shutter.angularTravelRadians).toBeCloseTo(velocity * 0.016666, 8);
    expect(later.shutter.rotationsDuringExposure)
      .toBeCloseTo(velocity * 0.016666 / (2 * Math.PI), 9);
    expect(later.shutter.singleSamplePhaseAliasingRisk).toBe(rpm === 2200);
    expect(later.interframePhaseAliasingRisk).toBe(rpm === 2200);
    // The canonical crossing itself is an exact observation tick between the
    // two additional render frames, so it owns the previous-frame timestamp.
    expect(later.previousFrameTick).toBe(observation.events[0].tick);
    expect('rpm' in later).toBe(false);
    expect(JSON.parse(JSON.stringify(observation.spinFrames))).toEqual(observation.spinFrames);
    expect(Object.isFrozen(later.orientationMaterialToWorld)).toBe(true);
    expect(Object.isFrozen(later.shutter)).toBe(true);
  });

  it('labels a missing release phase as uncalibrated and never pins subsequent seam pose to identity', () => {
    const base = trajectory(30_000);
    const pitch: AerodynamicRigidPitchAgainstBatterInput = {
      ...take(30_000),
      trajectory: { ...base, start: { ...base.start, spin: { x: asRadiansPerSecond(800), y: 0, z: 0 } } },
    };
    const { observation } = observe(pitch, 0, 0, {
      spinFrameTicks: [START_TICK + 12_000],
    });
    const initial = observation.spinFrames[0];
    const later = observation.spinFrames.find(f => f.tick === START_TICK + 12_000)!;
    expect(initial.orientationMaterialToWorld).toEqual({ w: 1, x: 0, y: 0, z: 0 });
    expect(later.orientationProvenance).toBe('identity_display_convention_uncalibrated');
    expect(later.hasSourceReleaseOrientation).toBe(false);
    expect(later.orientationMaterialToWorld).not.toEqual(initial.orientationMaterialToWorld);
    expect(later.angularSpeedRadPerSecond).toBeCloseTo(asRadiansPerSecond(800), 11);
    expect(later.shutter.angularTravelRadians).toBe(0);
  });

  it('tracks real source spin decay while leaving the accepted pitch and core samples unchanged by display frames', () => {
    const base = trajectory(60_000);
    const omega = asRadiansPerSecond(2200);
    const pitch: AerodynamicRigidPitchAgainstBatterInput = {
      ...take(60_000),
      trajectory: {
        ...base,
        start: { ...base.start, spin: { x: 0, y: omega, z: 0 } },
        parameters: {
          ...base.parameters,
          integrationStepTicks: 1_000,
          gravityY: 0,
          aerodynamics: {
            ...REFERENCE_BASEBALL_AERODYNAMICS,
            airDensityKgM3: 0,
            dragCoefficient: 0,
            spinDecay: {
              referenceSpeedMps: 60,
              timeConstantSecondsAtReferenceSpeed: 0.06,
            },
          },
        },
      },
    };
    const plain = observe(pitch);
    const decorated = observe(pitch, 0, 0, {
      spinFrameTicks: [START_TICK + 10_000, START_TICK + 25_000, START_TICK + 40_000],
      spinShutterTicks: 10_000,
    });
    expect(JSON.stringify(decorated.observation.samples)).toBe(JSON.stringify(plain.observation.samples));
    expect(JSON.stringify(decorated.observation.frames)).toBe(JSON.stringify(plain.observation.frames));
    expect(JSON.stringify(decorated.resolution.timeline)).toBe(JSON.stringify(plain.resolution.timeline));
    const early = decorated.observation.spinFrames.find(f => f.tick === START_TICK + 10_000)!;
    const late = decorated.observation.spinFrames.find(f => f.tick === START_TICK + 40_000)!;
    expect(late.angularVelocityWorldRadPerSecond)
      .toEqual(sampleAerodynamicPitchTrajectory(pitch.trajectory, late.tick).spin);
    expect(late.angularSpeedRadPerSecond).toBeLessThan(early.angularSpeedRadPerSecond);
    expect(late.angularTravelSinceReleaseRadians).toBeGreaterThan(early.angularTravelSinceReleaseRadians);
    expect(late.angularTravelSinceReleaseRadians).toBeLessThan(omega * 0.04);
    expect(late.shutter.angularTravelRadians).toBeGreaterThan(0);
    expect(late.shutter.angularTravelRadians).toBeLessThan(omega * 0.01);
    expect(late.orientationMaterialToWorld).not.toEqual(early.orientationMaterialToWorld);
    const plainAtLate = plain.observation.spinFrames.find(f => f.tick === START_TICK + 40_000);
    // It may not be a canonical 55ms tick, but changing the source-clock
    // display schedule must never change original physical observations.
    expect(plainAtLate).toBeUndefined();
    expect(decorated.observation.spinFrames[0].orientationMaterialToWorld)
      .toEqual(plain.observation.spinFrames[0].orientationMaterialToWorld);
  });

  it('rejects nonphysical render ticks and invalid explicit shutter widths without modifying Core', () => {
    const pitch = take(6_000);
    expect(() => observe(pitch, 0, 0, { spinFrameTicks: [START_TICK + 20, START_TICK + 10] }))
      .toThrow('strictly increasing');
    expect(() => observe(pitch, 0, 0, { spinFrameTicks: [START_TICK + 6_001] }))
      .toThrow('inside the true source flight');
    expect(() => observe(pitch, 0, 0, { spinFrameTicks: [START_TICK + 0.5] }))
      .toThrow('inside the true source flight');
    expect(() => observe(pitch, 0, 0, { spinShutterTicks: -1 }))
      .toThrow('safe integer');
  });
});
