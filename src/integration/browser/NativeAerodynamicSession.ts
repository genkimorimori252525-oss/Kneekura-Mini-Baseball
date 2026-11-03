import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { PitchCountState } from '../../core/rules/PitchCountRule';
import { createPlateAppearanceCommand, type PlateAppearanceCommand } from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import {
  assertCommandSessionCanDriveTimeline,
  createPlateAppearanceCommandSession,
  type PlateAppearanceCommandSession,
} from '../../core/sim/plateAppearance/PlateAppearanceCommandSession';
import {
  createCanonicalPlateAppearanceTimeline,
  type CanonicalPlateAppearanceTimeline,
} from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  applyStrikeoutPlateAppearanceToMatchState,
  applyWalkPlateAppearanceToMatchState,
} from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import {
  resolveAndRecordAerodynamicRigidPitchAgainstBatter,
  type AerodynamicRigidPitchAgainstBatterInput,
} from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import {
  observeNativeAerodynamicPitch,
  type NativeAerodynamicObservation,
} from './NativeAerodynamicObserver';

/**
 * The producer supplies an actual production aerodynamic flight and rigid-bat
 * action. It may use the accepted command and match seed to construct those
 * physical inputs, but this session invents no ratings, target, velocity,
 * batter decision, contact coefficients, actors, or official result.
 */
export type NativeAerodynamicPhysicalPitchSource = (
  request: Readonly<{
    commandSession: PlateAppearanceCommandSession;
    ordinal: number;
    /** Native Core's current pitch count, unchanged by Presentation. */
    count: PitchCountState;
    /** Canonical evidence already accepted before this pitch is generated. */
    lastEventTick: number;
    /** Last issued flight's full physical end, even when the call was earlier. */
    previousFlightEndTick: number | null;
    match: CanonicalMatchState;
  }>,
) => Readonly<{
  pitch: AerodynamicRigidPitchAgainstBatterInput;
  actorsAtTick: (tick: number) => Pick<CanonicalWorldSnapshot, 'defenders' | 'runners'>;
}>;

export type NativeAerodynamicSessionInput = Readonly<{
  match: CanonicalMatchState;
  startedAtTick: number;
  matchSeed: number;
  batterRunnerId: string;
  batterHandedness: 'R' | 'L';
  pitcherHandedness: 'R' | 'L';
  camera?: 'BATTER_POV' | 'PITCHER_POV';
}>;

export type NativeAerodynamicSessionPhase =
  | 'active'
  | 'walk'
  | 'strikeout'
  | 'batted_ball_pending'
  | 'unresolved';

export type NativeAerodynamicSessionSnapshot = Readonly<{
  phase: NativeAerodynamicSessionPhase;
  count: PitchCountState | null;
  pitches: number;
  pendingCommand: PlateAppearanceCommandSession | null;
  previousFlightEndTick: number | null;
  /** Only the existing Native Match Core can advance these terminal results. */
  nextMatchState: CanonicalMatchState | null;
}>;

export type NativeAerodynamicIssuedPitch = Readonly<{
  ordinal: number;
  commandSession: PlateAppearanceCommandSession;
  result: NativeAerodynamicObservation;
  eventKinds: readonly NativeAerodynamicObservation['events'][number]['kind'][];
  phase: NativeAerodynamicSessionPhase;
  count: PitchCountState | null;
  nextMatchState: CanonicalMatchState | null;
}>;

export type NativeAerodynamicSession = Readonly<{
  /** Locks a validated command to exactly the next physical pitch. */
  acceptNextCommand: (command: PlateAppearanceCommand) => PlateAppearanceCommandSession;
  /** Issues one real source pitch against the current canonical count. */
  issue: (physicalSource: NativeAerodynamicPhysicalPitchSource) => NativeAerodynamicIssuedPitch;
  inspect: () => NativeAerodynamicSessionSnapshot;
}>;

function isTick(tick: number): boolean {
  return Number.isSafeInteger(tick) && tick >= 0;
}

function observablePhase(
  status: CanonicalPlateAppearanceTimeline['status']['kind'],
): Exclude<NativeAerodynamicSessionPhase, 'unresolved'> {
  switch (status) {
    case 'active':
    case 'walk':
    case 'strikeout':
    case 'batted_ball_pending':
      return status;
    default:
      throw new Error('Native aerodynamic one-PA requires separate real fielding and umpire adjudication.');
  }
}

function immutableCommand(command: PlateAppearanceCommand): PlateAppearanceCommand {
  const validated = createPlateAppearanceCommand(command);
  return Object.freeze({
    pitcher: Object.freeze({ ...validated.pitcher }),
    batter: Object.freeze({ ...validated.batter }),
    runners: Object.freeze({ ...validated.runners }),
  });
}

/**
 * Exactly one canonical plate appearance, with an explicit physical-source
 * boundary. A swing contact or an unresolved take stops here until external
 * Native fielding/umpire evidence exists; no result is inferred from flight.
 *
 * The source is synchronous so both physical resolution and presentation
 * observation finish before the canonical cursor is committed. A thrown
 * physical source or missing actor evidence leaves the pending pitch intact.
 */
export function createNativeAerodynamicSession(input: NativeAerodynamicSessionInput): NativeAerodynamicSession {
  if (!Number.isSafeInteger(input.matchSeed)) {
    throw new Error('Native aerodynamic session matchSeed must be a safe integer.');
  }
  if (typeof input.batterRunnerId !== 'string' || input.batterRunnerId.trim().length === 0) {
    throw new Error('Native aerodynamic session requires an actual batter-runner ID.');
  }
  if ((input.batterHandedness !== 'R' && input.batterHandedness !== 'L')
    || (input.pitcherHandedness !== 'R' && input.pitcherHandedness !== 'L')) {
    throw new Error('Native aerodynamic session requires actual batter and pitcher handedness.');
  }
  const match: CanonicalMatchState = Object.freeze({
    ...input.match,
    bases: Object.freeze({ ...input.match.bases }),
    score: Object.freeze({ ...input.match.score }),
  });
  let timeline: CanonicalPlateAppearanceTimeline = createCanonicalPlateAppearanceTimeline(
    match, input.startedAtTick,
  );
  let ordinal = 0;
  let pendingCommand: PlateAppearanceCommandSession | null = null;
  let previousFlightEndTick: number | null = null;
  let unresolved = false;
  let issuing = false;
  let nextMatchState: CanonicalMatchState | null = null;

  const phase = (): NativeAerodynamicSessionPhase => (
    unresolved ? 'unresolved' : observablePhase(timeline.status.kind)
  );
  const count = (): PitchCountState | null => (
    timeline.status.kind === 'active'
      ? { balls: timeline.status.count.balls, strikes: timeline.status.count.strikes }
      : null
  );
  const inspect = (): NativeAerodynamicSessionSnapshot => ({
    phase: phase(),
    count: count(),
    pitches: ordinal,
    pendingCommand,
    previousFlightEndTick,
    nextMatchState,
  });
  const assertAcceptingPitch = (): void => {
    if (unresolved || timeline.status.kind !== 'active') {
      throw new Error('Native aerodynamic PA is stopped or awaiting real physical/umpire evidence; another pitch is forbidden.');
    }
    if (issuing) {
      throw new Error('Native aerodynamic PA cannot reenter an in-progress physical issue.');
    }
  };

  const acceptNextCommand = (requested: PlateAppearanceCommand): PlateAppearanceCommandSession => {
    assertAcceptingPitch();
    if (pendingCommand !== null) {
      throw new Error('A Native aerodynamic next-pitch command is already accepted and must be issued first.');
    }
    const accepted = Object.freeze(createPlateAppearanceCommandSession({
      playId: match.playId,
      batterRunnerId: input.batterRunnerId,
      acceptedAtTick: timeline.lastEventTick,
      matchSeed: input.matchSeed,
      command: immutableCommand(requested),
    }));
    assertCommandSessionCanDriveTimeline(accepted, timeline);
    pendingCommand = accepted;
    return accepted;
  };

  const issue = (source: NativeAerodynamicPhysicalPitchSource): NativeAerodynamicIssuedPitch => {
    assertAcceptingPitch();
    if (pendingCommand === null) {
      throw new Error('Native aerodynamic pitch requires an accepted next-pitch command.');
    }
    if (typeof source !== 'function') {
      throw new Error('Native aerodynamic pitch requires an explicit physical source.');
    }
    if (!Number.isSafeInteger(ordinal + 1)) {
      throw new Error('Native aerodynamic pitch ordinal has exceeded the safe integer range.');
    }
    const accepted = pendingCommand;
    assertCommandSessionCanDriveTimeline(accepted, timeline);
    if (accepted.acceptedAtTick !== timeline.lastEventTick) {
      throw new Error('Native aerodynamic next-pitch command has a stale timeline acceptance tick.');
    }

    issuing = true;
    try {
      const actual = source(Object.freeze({
        commandSession: accepted,
        ordinal,
        count: Object.freeze(count()!),
        lastEventTick: timeline.lastEventTick,
        previousFlightEndTick,
        match,
      }));
      if (!actual || !actual.pitch || typeof actual.actorsAtTick !== 'function'
        || !actual.pitch.trajectory || !actual.pitch.trajectory.start) {
        throw new Error('Native aerodynamic physical source must supply a real pitch and actor sampler.');
      }
      const { pitch } = actual;
      const { start, endTick } = pitch.trajectory;
      if (!isTick(start.tick) || !isTick(endTick) || endTick < start.tick
        || start.tick < timeline.lastEventTick
        || (previousFlightEndTick !== null && start.tick <= previousFlightEndTick)) {
        throw new Error('Native aerodynamic physical flight must follow the accepted count and all previous flights.');
      }

      const before = timeline;
      const resolution = resolveAndRecordAerodynamicRigidPitchAgainstBatter(before, pitch);
      const observation = observeNativeAerodynamicPitch({
        timelineBefore: before,
        pitch,
        resolution,
        actorsAtTick: actual.actorsAtTick,
        batterHandedness: input.batterHandedness,
        pitcherHandedness: input.pitcherHandedness,
        camera: input.camera,
      });
      const next = resolution.timeline.status.kind === 'walk'
        ? applyWalkPlateAppearanceToMatchState(match, resolution.timeline, input.batterRunnerId)
        : resolution.timeline.status.kind === 'strikeout'
          ? applyStrikeoutPlateAppearanceToMatchState(match, resolution.timeline)
          : null;
      const issuedPhase: NativeAerodynamicSessionPhase = resolution.kind === 'unresolved'
        ? 'unresolved' : observablePhase(resolution.timeline.status.kind);

      // The only mutation is AFTER Core physics, event acceptance, the observer,
      // and genuine terminal Match Core application have all succeeded.
      timeline = resolution.timeline;
      previousFlightEndTick = endTick;
      nextMatchState = next;
      pendingCommand = null;
      ordinal += 1;
      unresolved = resolution.kind === 'unresolved';
      return {
        ordinal: ordinal - 1,
        commandSession: accepted,
        result: observation,
        eventKinds: observation.events.map(event => event.kind),
        phase: issuedPhase,
        count: count(),
        nextMatchState,
      };
    } finally {
      issuing = false;
    }
  };

  return Object.freeze({ acceptNextCommand, issue, inspect });
}
