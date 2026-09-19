import type {
  BatterRunnerWorldTimeline,
} from '../running/BatterRunnerWorldTimeline';
import type {
  CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';

/**
 * Prevents a physical batter-runner trajectory from being replayed against a different
 * plate appearance. The runner model remains authoritative physical evidence, but its
 * time origin must be the same bat-ball contact that opened this live-ball play.
 */
export const assertBatterRunnerTimelineMatchesPlateAppearance = (
  timeline: CanonicalPlateAppearanceTimeline,
  runner: BatterRunnerWorldTimeline,
): void => {
  if (timeline.status.kind !== 'live_ball') {
    throw new Error(
      'batter-runner evidence binding requires a fair live-ball timeline',
    );
  }

  const contactTick = timeline.status.contactTick;
  if (
    runner.startTick !== contactTick
    || runner.recovery.startTick !== contactTick
  ) {
    throw new Error(
      'batter-runner timeline must start at the authoritative bat-ball contact tick',
    );
  }

  if (
    runner.recovery.endTick
      !== runner.recovery.transition.launchTick
    || runner.launchState.tick
      !== runner.recovery.transition.launchTick
  ) {
    throw new Error(
      'batter-runner timeline launch boundary must remain internally canonical',
    );
  }
};