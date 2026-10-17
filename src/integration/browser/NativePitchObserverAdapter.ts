import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { PlateAppearanceCommandSession } from '../../core/sim/plateAppearance/PlateAppearanceCommandSession';
import type { CommandPitchEnvironment } from '../../core/sim/plateAppearance/PlateAppearanceCommandPitchAdapter';
import type { PitchAgainstBatterInput, PitchAgainstBatterResolution } from '../../core/sim/pitching/PitchAgainstBatter';
import type { CanonicalPresentationSample, MiniPresentationFrame } from '../../presentation/mini/model';
import { MINI_PRESENTATION_CADENCE_MICROS } from '../../presentation/mini/model';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { createCommandedPitchAgainstBatterInput } from '../../core/sim/plateAppearance/PlateAppearanceCommandPitchAdapter';
import { assertCommandSessionCanDriveTimeline } from '../../core/sim/plateAppearance/PlateAppearanceCommandSession';
import { resolveAndRecordPitchAgainstBatter } from '../../core/sim/pitching/PitchAgainstBatter';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { sampleBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { applyWalkPlateAppearanceToMatchState, applyStrikeoutPlateAppearanceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import { buildMiniPresentationTimeline, createMiniPresentationSampleSchedule } from '../../presentation/mini/MiniPresentationTimeline';

/** Only recorded canonical facts enter the renderer; never guess a batted-ball outcome. */
export type NativePitchObservation = Readonly<{
  authority: 'NATIVE_CORE_PHYSICAL_PITCH';
  kind: 'recorded' | 'unresolved';
  result: PitchAgainstBatterResolution;
  events: CanonicalPlateAppearanceTimeline['events'];
  samples: readonly CanonicalPresentationSample[];
  frames: readonly MiniPresentationFrame[];
  nextMatchState: CanonicalMatchState | null;
  /** A batted-ball play is NOT complete until real fielding and umpire evidence is accepted. */
  requiresOfficialLiveBallResolution: boolean;
}>;

export type NativePitchObserveInput = Readonly<{
  match: CanonicalMatchState;
  timeline?: CanonicalPlateAppearanceTimeline;
  startedAtTick: number;
  pitch: PitchAgainstBatterInput;
  batterRunnerId: string;
  batterHandedness: 'R' | 'L';
  pitcherHandedness: 'R' | 'L';
  /** Read from authoritative world; this adapter never invents fielders or runner trajectories. */
  actorsAtTick: (tick: number) => Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'>;
  camera?: 'BATTER_POV' | 'PITCHER_POV';
}>;

const validTick = (tick: number): boolean => Number.isSafeInteger(tick) && tick >= 0;

function nativeBatPose(input: PitchAgainstBatterInput, tick: number): CanonicalPresentationSample['batter'] {
  if (input.action.kind === 'take') {
    return { handedness: 'R', action: 'idle', bat: null };
  }
  const swing = input.action.swing;
  const clampedTick = Math.max(swing.startTick, Math.min(swing.endTick, tick));
  const pose = sampleBatterSwingState(swing.stateAtStart, clampedTick - swing.startTick).pose;
  return { handedness: 'R', action: 'normal_swing', bat: pose };
}

/**
 * Existing Native Core judges the physical pitch. Mini only samples THAT SAME
 * trajectory/events; it cannot change a call or conjure a base/out outcome.
 */
export function observeNativePitch(input: NativePitchObserveInput): NativePitchObservation {
  const timeline = input.timeline ?? createCanonicalPlateAppearanceTimeline(input.match, input.startedAtTick);
  if (timeline.playId !== input.match.playId || timeline.status.kind !== 'active') {
    throw new Error('Native bridge requires the same active canonical playId.');
  }
  if (!input.batterRunnerId || !['R', 'L'].includes(input.batterHandedness)
    || !['R', 'L'].includes(input.pitcherHandedness)) {
    throw new Error('Native bridge requires actual player identities and handedness.');
  }
  const { trajectory } = input.pitch;
  if (!validTick(trajectory.start.tick) || !validTick(trajectory.endTick)
    || trajectory.start.tick < timeline.lastEventTick) {
    throw new Error('Native pitch must start after the accepted current timeline boundary.');
  }
  const resolved = resolveAndRecordPitchAgainstBatter(timeline, input.pitch);
  const newlyAcceptedEvents = resolved.timeline.events.slice(timeline.events.length);
  if (resolved.timeline.events.length < timeline.events.length
    || !timeline.events.every((event, i) => resolved.timeline.events[i] === event)) {
    throw new Error('Native bridge cannot rewrite a committed pitch prefix.');
  }
  // A contacted pitch changes velocity/spin at impact. The pre-contact
  // trajectory is no longer authoritative after this exact event tick.
  const contactTick = resolved.kind === 'recorded'
    && resolved.physical.kind === 'swing'
    && resolved.physical.result.kind === 'contact'
    ? resolved.physical.result.contact.tick
    : null;
  const observationEndTick = contactTick ?? trajectory.endTick;
  const eventTicks = createMiniPresentationSampleSchedule(
    trajectory.start.tick, observationEndTick, MINI_PRESENTATION_CADENCE_MICROS, newlyAcceptedEvents,
  );
  const samples: CanonicalPresentationSample[] = eventTicks.map(tick => {
    const body = input.actorsAtTick(tick);
    if (!body || !Array.isArray(body.defenders) || !Array.isArray(body.runners)) {
      throw new Error('Missing authoritative actor observation at tick ' + tick);
    }
    const ball = samplePitchTrajectorySegment(trajectory, tick);
    const bat = nativeBatPose(input.pitch, tick);
    return {
      world: {
        tick,
        defenders: body.defenders,
        runners: body.runners,
        ball: { position: ball.position, velocity: ball.velocity, spin: ball.spin },
      },
      batter: { ...bat, handedness: input.batterHandedness },
      pitcherHandedness: input.pitcherHandedness,
    };
  });
  const frames = buildMiniPresentationTimeline(samples, newlyAcceptedEvents, input.camera ?? 'BATTER_POV');
  let nextMatchState: CanonicalMatchState | null = null;
  switch (resolved.timeline.status.kind) {
    case 'walk':
      nextMatchState = applyWalkPlateAppearanceToMatchState(input.match, resolved.timeline, input.batterRunnerId);
      break;
    case 'strikeout':
      nextMatchState = applyStrikeoutPlateAppearanceToMatchState(input.match, resolved.timeline);
      break;
    // No synthetic hit, ground-rule double, catch or out on contact.
    default: break;
  }
  return {
    authority: 'NATIVE_CORE_PHYSICAL_PITCH',
    kind: resolved.kind,
    result: resolved,
    events: newlyAcceptedEvents,
    samples,
    frames,
    nextMatchState,
    requiresOfficialLiveBallResolution: resolved.timeline.status.kind === 'batted_ball_pending',
  };
}

export type NativeCommandPitchInput = Omit<NativePitchObserveInput, 'pitch'> & Readonly<{
  commandSession: PlateAppearanceCommandSession;
  environment: CommandPitchEnvironment;
}>;

/** Only at this boundary is the accepted manager command issued as the next pitch. */
export function issueNativeCommandPitch(input: NativeCommandPitchInput): NativePitchObservation & Readonly<{
  commanded: ReturnType<typeof createCommandedPitchAgainstBatterInput>;
}> {
  const timeline = input.timeline ?? createCanonicalPlateAppearanceTimeline(input.match, input.startedAtTick);
  assertCommandSessionCanDriveTimeline(input.commandSession, timeline);
  const commanded = createCommandedPitchAgainstBatterInput({
    session: input.commandSession, environment: input.environment,
  });
  const observed = observeNativePitch({ ...input, timeline, pitch: commanded.input });
  return { ...observed, commanded };
}
