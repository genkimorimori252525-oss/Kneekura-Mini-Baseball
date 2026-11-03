import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { createPlateAppearanceCommand } from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import type { PlateAppearanceCommand } from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import { createPlateAppearanceCommandSession } from '../../core/sim/plateAppearance/PlateAppearanceCommandSession';
import type { CommandPitchEnvironment } from '../../core/sim/plateAppearance/PlateAppearanceCommandPitchAdapter';
import { issueNativeCommandPitch, type NativePitchObservation } from './NativePitchObserverAdapter';

export type NativeDemoPitch = Readonly<{
  ordinal: number;
  intendedTarget: Readonly<{ x: number; y: number; z: number }>;
  result: NativePitchObservation;
  /** Native trace frames, serialized without choosing an OUT/SAFE or a batted-ball result. */
  eventKinds: readonly string[];
  count: Readonly<{ balls: number; strikes: number }> | null;
  phase: 'active' | 'walk' | 'strikeout' | 'batted_ball_pending' | 'unresolved';
}>;

export type NativeSinglePaSession = Readonly<{
  /** Issue a real native physical pitch, using the accepted command at this boundary. */
  issue: (command: PlateAppearanceCommand) => NativeDemoPitch;
  inspect: () => Readonly<{ phase: string; count: Readonly<{ balls: number; strikes: number }> | null; pitches: number }>;
}>;

const EMPTY_ACTORS = Object.freeze({
  defenders: Object.freeze([]),
  runners: Object.freeze([]),
});

/** Intentionally one PA: browser-safe genuine Core slice, NOT a full-game emulator. */
export function createNativeSinglePaSession(seed: number): NativeSinglePaSession {
  if (!Number.isSafeInteger(seed)) throw new Error('Native session seed must be a safe integer.');

  // The exhibition's exact international rule profile has not been approved.
  // Reuse only the existing and tested NPB pitch-count fixture rule here.
  const match: CanonicalMatchState = {
    ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null },
    score: { away: 0, home: 0 }, playId: 0,
  };
  let timeline: CanonicalPlateAppearanceTimeline =
    createCanonicalPlateAppearanceTimeline(match, 1_000_000);
  let ordinal = 0;
  let lastFlightEndTick = 1_000_000;

  const inspect = () => ({
    phase: timeline.status.kind,
    count: timeline.status.kind === 'active'
      ? { balls: timeline.status.count.balls, strikes: timeline.status.count.strikes }
      : null,
    pitches: ordinal,
  });

  const issue = (requested: PlateAppearanceCommand): NativeDemoPitch => {
    if (timeline.status.kind !== 'active') {
      throw new Error('Native PA is finished or awaiting the genuine fielding/umpire path; no substitute result will be invented.');
    }
    const committed = createPlateAppearanceCommand(requested);
    // A command change applies to the next unissued pitch only.
    const commandSession = createPlateAppearanceCommandSession({
      playId: match.playId, batterRunnerId: 'lad-2025-ohtani',
      acceptedAtTick: timeline.lastEventTick, matchSeed: seed, command: committed,
    });
    const pitchStartTick = Math.max(lastFlightEndTick + 100_000, timeline.lastEventTick + 100_000);
    const environment: CommandPitchEnvironment = {
      pitchStartTick, pitchOrdinal: ordinal, ticksPerSecond: 1_000_000,
      // 18m travel in ~470ms: example flight under Tikao's stated 151km/h max.
      // This is a documented fixture, NOT a calibrated NLB pitcher model.
      pitchDurationTicks: 470_000,
      releasePosition: { x: 0, y: 1.8, z: 18 },
      acceleration: { x: 0, y: -9.8, z: 0 },
      plateZ: 0,
      strikeZone: { centerX: 0, halfWidth: 0.22, lowerY: 0.55, upperY: 1.15 },
      ballRadiusMeters: 0.0366,
      insideXDirection: 1,
      targetCalibration: {
        challengeHorizontalZoneFraction: 0.45, balancedHorizontalZoneFraction: 0.8,
        wasteHorizontalZoneFraction: 1.3, lowVerticalZoneFraction: 0.2,
        middleVerticalZoneFraction: 0.5, highVerticalZoneFraction: 0.8,
      },
      batterCalibration: {
        balancedSwingProbability: 0.5, aggressiveSwingProbability: 1,
        earlyTimingOffsetTicks: -30_000, lateTimingOffsetTicks: 30_000,
        swingWindowHalfWidthTicks: 70_000,
      },
      swingStateAtWindowStart: {
        pose: { grip: { x: -0.5, y: 1, z: 0.3 }, tip: { x: 0.4, y: 1, z: 0.3 } },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 12, z: 0 },
      },
    };
    const issued = issueNativeCommandPitch({
      match, timeline, startedAtTick: 1_000_000, commandSession, environment,
      batterRunnerId: 'lad-2025-ohtani', batterHandedness: 'L',
      pitcherHandedness: 'R', actorsAtTick: () => EMPTY_ACTORS,
    });
    timeline = issued.result.timeline;
    lastFlightEndTick = environment.pitchStartTick + environment.pitchDurationTicks;
    if (timeline.status.kind === 'live_ball' || timeline.status.kind === 'caught_foul_live'
      || timeline.status.kind === 'live_ball_complete') {
      throw new Error('Full live-ball completion needs its separate physical fielding and umpire producer.');
    }
    return {
      ordinal: ordinal++,
      intendedTarget: issued.commanded.targetPlatePosition,
      result: {
        authority: issued.authority, kind: issued.kind, result: issued.result,
        events: issued.events, samples: issued.samples, frames: issued.frames,
        nextMatchState: issued.nextMatchState,
        requiresOfficialLiveBallResolution: issued.requiresOfficialLiveBallResolution,
      },
      eventKinds: issued.events.map(event => event.kind),
      count: timeline.status.kind === 'active'
        ? { balls: timeline.status.count.balls, strikes: timeline.status.count.strikes }
        : null,
      phase: issued.kind === 'unresolved' ? 'unresolved' : timeline.status.kind,
    };
  };
  return Object.freeze({ issue, inspect });
}
