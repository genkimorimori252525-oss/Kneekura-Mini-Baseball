import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { BatBallContactResult } from '../../core/sim/contact/BatBallContact';
import { sampleCompatibilityBatterSwingState } from '../../core/sim/contact/BatBallContact';
import type { RigidBatBallContactResult } from '../../core/sim/contact/RigidBatBallContact';
import { sampleSwingStateV1 } from '../../core/sim/contact/SwingKinematicsV1';
import type {
  CanonicalPlateAppearanceEvent,
  CanonicalPlateAppearanceTimeline,
} from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  AerodynamicRigidPitchAgainstBatterInput,
  AerodynamicRigidPitchAgainstBatterResolution,
} from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { sampleAerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { adaptRigidBatBallContactToCanonicalContact } from '../../core/sim/pitching/RigidBatContactCanonicalAdapter';
import type { CanonicalPresentationSample, MiniPresentationFrame } from '../../presentation/mini/model';
import { MINI_PRESENTATION_CADENCE_MICROS } from '../../presentation/mini/model';
import { buildMiniPresentationTimeline, createMiniPresentationSampleSchedule } from '../../presentation/mini/MiniPresentationTimeline';

/**
 * A renderer-neutral view of an ALREADY RESOLVED production aerodynamic pitch.
 * The observer never calls the pitch resolver, judges a collision, or advances
 * a canonical timeline. Consumers must obtain resolution from Native Core.
 */
export type NativeAerodynamicObserveInput = Readonly<{
  timelineBefore: CanonicalPlateAppearanceTimeline;
  pitch: AerodynamicRigidPitchAgainstBatterInput;
  resolution: AerodynamicRigidPitchAgainstBatterResolution;
  batterHandedness: 'R' | 'L';
  pitcherHandedness: 'R' | 'L';
  /** Actual actors supplied by Native Core at each observation tick. */
  actorsAtTick: (tick: number) => Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'>;
  camera?: 'BATTER_POV' | 'PITCHER_POV';
}>;

export type NativeAerodynamicObservation = Readonly<{
  authority: 'NATIVE_CORE_AERODYNAMIC_RIGID_PITCH';
  kind: AerodynamicRigidPitchAgainstBatterResolution['kind'];
  result: AerodynamicRigidPitchAgainstBatterResolution;
  /** The exact accepted canonical event objects, in original sequence order. */
  events: readonly CanonicalPlateAppearanceEvent[];
  samples: readonly CanonicalPresentationSample[];
  frames: readonly MiniPresentationFrame[];
  /** Physical rigid-body collision evidence, never an inferred batted-ball outcome. */
  rigidContact: RigidBatBallContactResult | null;
  /** Observation is never authorized to transition the Match Core state. */
  nextMatchState: null;
  /** True until Native fielding, ground/collision evidence, and umpire paths resolve the live ball. */
  requiresOfficialLiveBallResolution: boolean;
}>;

const isTick = (tick: number): boolean => Number.isSafeInteger(tick) && tick >= 0;

const sameVector = (
  a: Readonly<{ x: number; y: number; z: number }>,
  b: Readonly<{ x: number; y: number; z: number }>,
): boolean => a.x === b.x && a.y === b.y && a.z === b.z;

const sameContact = (actual: BatBallContactResult, expected: BatBallContactResult): boolean => (
  actual.tick === expected.tick
  && actual.segmentT === expected.segmentT
  && sameVector(actual.ballCenter, expected.ballCenter)
  && sameVector(actual.point, expected.point)
  && sameVector(actual.batPoint, expected.batPoint)
  && sameVector(actual.normal, expected.normal)
  && sameVector(actual.exitVelocity, expected.exitVelocity)
  && sameVector(actual.exitSpin, expected.exitSpin)
);

function assertCountedCall(
  call: CanonicalPlateAppearanceEvent | undefined,
  kind: 'ball' | 'called_strike' | 'swinging_strike',
  tick: number,
  before: CanonicalPlateAppearanceTimeline,
  after: CanonicalPlateAppearanceTimeline,
): void {
  if (call?.kind !== 'PitchAdjudicated'
    || call.tick !== tick
    || call.payload.adjudication.kind !== kind
    || before.status.kind !== 'active'
    || call.payload.countBefore.balls !== before.status.count.balls
    || call.payload.countBefore.strikes !== before.status.count.strikes) {
    throw new Error('Native aerodynamic observation requires the exact accepted pitch adjudication.');
  }
  const counted = call.payload.result;
  if (counted.kind === 'ball_in_play' || counted.cause !== kind
    || counted.kind !== after.status.kind && !(counted.kind === 'continue' && after.status.kind === 'active')) {
    throw new Error('Native aerodynamic observation has mismatched canonical pitch count status.');
  }
  if (counted.kind === 'continue' && after.status.kind === 'active'
    && (counted.count.balls !== after.status.count.balls
      || counted.count.strikes !== after.status.count.strikes)) {
    throw new Error('Native aerodynamic observation has mismatched live pitch count.');
  }
  if (counted.kind === 'walk' && after.status.kind === 'walk'
    && (counted.terminalCount.balls !== after.status.terminalCount.balls
      || counted.terminalCount.strikes !== after.status.terminalCount.strikes)) {
    throw new Error('Native aerodynamic observation has mismatched walk count.');
  }
  if (counted.kind === 'strikeout' && after.status.kind === 'strikeout'
    && (counted.terminalCount.balls !== after.status.terminalCount.balls
      || counted.terminalCount.strikes !== after.status.terminalCount.strikes)) {
    throw new Error('Native aerodynamic observation has mismatched strikeout count.');
  }
}

function acceptedPitchEvents(input: NativeAerodynamicObserveInput): Readonly<{
  events: readonly CanonicalPlateAppearanceEvent[];
  contact: RigidBatBallContactResult | null;
}> {
  const { timelineBefore: before, resolution, pitch } = input;
  const after = resolution.timeline;
  const { trajectory } = pitch;
  if (before.status.kind !== 'active' || before.playId !== after.playId
    || before.startedAtTick !== after.startedAtTick
    || !isTick(trajectory.start.tick) || !isTick(trajectory.endTick)
    || trajectory.endTick < trajectory.start.tick
    || trajectory.start.tick < before.lastEventTick
    || after.events.length < before.events.length
    || !before.events.every((event, index) => after.events[index] === event)) {
    throw new Error('Native aerodynamic observation requires a preserved active canonical timeline prefix.');
  }
  const events = after.events.slice(before.events.length);
  if (after.nextSequence !== before.nextSequence + events.length
    || events.some((event, index) => (
      !isTick(event.tick) || event.tick < trajectory.start.tick
      || event.tick > trajectory.endTick
      || event.sequence !== before.nextSequence + index
      || (index > 0 && event.tick < events[index - 1].tick)
    ))
    || (events.length > 0 && after.lastEventTick !== events[events.length - 1].tick)) {
    throw new Error('Native aerodynamic observation requires exact in-flight canonical event ticks and sequences.');
  }

  if (resolution.kind === 'unresolved') {
    if (pitch.action.kind !== 'take' || events.length !== 0
      || after.lastEventTick !== before.lastEventTick
      || JSON.stringify(after.status) !== JSON.stringify(before.status)) {
      throw new Error('Unresolved aerodynamic pitch cannot emit a canonical call.');
    }
    return { events, contact: null };
  }
  if (resolution.kind === 'recorded_take') {
    const crossing = events[0];
    if (pitch.action.kind !== 'take' || events.length !== 2
      || crossing?.kind !== 'TakenPitchPlateCrossed'
      || crossing.tick !== resolution.physical.crossing.tick
      || JSON.stringify(crossing.payload.result) !== JSON.stringify(resolution.physical)) {
      throw new Error('Native aerodynamic observation requires the real aerodynamic plate crossing.');
    }
    assertCountedCall(events[1], resolution.physical.kind, crossing.tick, before, after);
    return { events, contact: null };
  }
  if (pitch.action.kind !== 'swing' || events.length < 1) {
    throw new Error('Native aerodynamic observation requires the resolved rigid swing action.');
  }
  const { swing } = pitch.action;
  if (!isTick(swing.startTick) || !isTick(swing.endTick)
    || swing.startTick < trajectory.start.tick || swing.endTick > trajectory.endTick
    || swing.endTick < swing.startTick
    || swing.ticksPerSecond !== trajectory.parameters.ticksPerSecond
    || (swing.kinematicsV1 !== undefined
      && (swing.kinematicsV1.startTick !== swing.startTick
        || swing.kinematicsV1.endTick !== swing.endTick
        || swing.kinematicsV1.ticksPerSecond !== swing.ticksPerSecond))) {
    throw new Error('Native aerodynamic observation requires the actual bounded rigid swing window.');
  }
  if (resolution.physical.kind === 'swinging_miss') {
    const miss = events[0];
    if (events.length !== 2 || miss?.kind !== 'SwingCompletedWithoutContact'
      || miss.tick !== resolution.physical.adjudicationTick
      || miss.payload.result.kind !== 'swinging_miss'
      || miss.payload.result.adjudicationTick !== resolution.physical.adjudicationTick) {
      throw new Error('Native aerodynamic observation requires the physical swinging-miss event.');
    }
    assertCountedCall(events[1], 'swinging_strike', miss.tick, before, after);
    return { events, contact: null };
  }
  const contact = resolution.physical.contact;
  const event = events[0];
  if (events.length !== 1 || event?.kind !== 'BatBallContact'
    || event.tick !== contact.tick
    || !isTick(contact.tick) || contact.tick < swing.startTick || contact.tick > swing.endTick
    || after.status.kind !== 'batted_ball_pending'
    || after.status.contactTick !== contact.tick
    || !sameContact(event.payload.contact, adaptRigidBatBallContactToCanonicalContact(contact))) {
    throw new Error('Native aerodynamic observation requires the exact rigid contact and pending canonical event.');
  }
  return { events, contact };
}

function batterPose(input: NativeAerodynamicObserveInput, tick: number): CanonicalPresentationSample['batter'] {
  const handedness = input.batterHandedness;
  if (input.pitch.action.kind === 'take') return { handedness, action: 'idle', bat: null };
  const { swing } = input.pitch.action;
  if (tick < swing.startTick || tick > swing.endTick) return { handedness, action: 'idle', bat: null };
  const pose = swing.kinematicsV1 !== undefined
    ? sampleSwingStateV1(swing.kinematicsV1, tick).pose
    : sampleCompatibilityBatterSwingState(swing.stateAtStart, tick - swing.startTick, swing.ticksPerSecond).pose;
  return { handedness, action: 'normal_swing', bat: pose };
}

export function observeNativeAerodynamicPitch(input: NativeAerodynamicObserveInput): NativeAerodynamicObservation {
  if ((input.batterHandedness !== 'R' && input.batterHandedness !== 'L')
    || (input.pitcherHandedness !== 'R' && input.pitcherHandedness !== 'L')) {
    throw new Error('Native aerodynamic observation requires actual batter and pitcher handedness.');
  }
  const { events, contact } = acceptedPitchEvents(input);
  const { trajectory } = input.pitch;
  const ticksPerSecond = trajectory.parameters.ticksPerSecond;
  if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond <= 0) {
    throw new Error('Native aerodynamic observation requires physical ticksPerSecond.');
  }
  const cadenceTicks = Math.max(1, Math.round(MINI_PRESENTATION_CADENCE_MICROS * ticksPerSecond / 1_000_000));
  const stopTick = contact?.tick ?? trajectory.endTick;
  const ticks = createMiniPresentationSampleSchedule(trajectory.start.tick, stopTick, cadenceTicks, events);
  const samples: CanonicalPresentationSample[] = ticks.map(tick => {
    const actors = input.actorsAtTick(tick);
    if (!actors || !Array.isArray(actors.defenders) || !Array.isArray(actors.runners)) {
      throw new Error(`Missing authoritative native actor state at tick ${tick}.`);
    }
    const flight = sampleAerodynamicPitchTrajectory(trajectory, tick);
    // The impact tick is the genuine POST-impulse contact state. No later
    // ball location is sampled without an actual Native live-ball trajectory.
    const ball = contact !== null && tick === contact.tick
      ? { position: contact.ballCenter, velocity: contact.exitVelocity, spin: contact.exitSpin }
      : { position: flight.position, velocity: flight.velocity, spin: flight.spin };
    return {
      world: { tick, defenders: actors.defenders, runners: actors.runners, ball },
      batter: batterPose(input, tick),
      pitcherHandedness: input.pitcherHandedness,
    };
  });
  return {
    authority: 'NATIVE_CORE_AERODYNAMIC_RIGID_PITCH',
    kind: input.resolution.kind,
    result: input.resolution,
    events,
    samples,
    frames: buildMiniPresentationTimeline(samples, events, input.camera ?? 'BATTER_POV'),
    rigidContact: contact,
    nextMatchState: null,
    requiresOfficialLiveBallResolution: contact !== null,
  };
}
