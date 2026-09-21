export type TallFescueGroundBallTransitTarget = Readonly<{
  mowingHeightCm: number;
  courseDistanceM: number;
  pitchingMachineSettingKph: number;
  meanTransitSeconds: number;
  source: string;
  note: string;
}>;

/**
 * K-State 2016/2017 simulated infield validation evidence.
 *
 * These are end-to-end 30.5 m ground-ball transit times from a pitching
 * machine set to 112.6 kph. They are NOT converted into a single rolling
 * deceleration coefficient because the published protocol includes launch,
 * bounce/skid/roll and turf interaction together.
 */
export const KSTATE_2017_TALL_FESCUE_GROUND_BALL_TRANSIT_TARGETS:
  readonly TallFescueGroundBallTransitTarget[] =
  Object.freeze([
    {
      mowingHeightCm: 2.5,
      courseDistanceM: 30.5,
      pitchingMachineSettingKph: 112.6,
      meanTransitSeconds: 1.77,
      source:
        'Knudson & Hoyle 2017, Influence of Tall Fescue Baseball Infield Mowing Height on Ground Ball Speed',
      note:
        'Fastest of the three published mowing-height means.',
    },
    {
      mowingHeightCm: 5.0,
      courseDistanceM: 30.5,
      pitchingMachineSettingKph: 112.6,
      meanTransitSeconds: 2.08,
      source:
        'Knudson & Hoyle 2017, Influence of Tall Fescue Baseball Infield Mowing Height on Ground Ball Speed',
      note:
        'Slowest of the three published mowing-height means.',
    },
    {
      mowingHeightCm: 7.6,
      courseDistanceM: 30.5,
      pitchingMachineSettingKph: 112.6,
      meanTransitSeconds: 1.88,
      source:
        'Knudson & Hoyle 2017, Influence of Tall Fescue Baseball Infield Mowing Height on Ground Ball Speed',
      note:
        'Intermediate published transit time.',
    },
  ]);

export const groundBallMeanTransitSpeedMps = (
  target: TallFescueGroundBallTransitTarget,
): number => {
  if (
    !Number.isFinite(target.courseDistanceM)
    || target.courseDistanceM <= 0
    || !Number.isFinite(
      target.meanTransitSeconds,
    )
    || target.meanTransitSeconds <= 0
  ) {
    throw new Error(
      'ground-ball transit target distance and time must be finite and positive',
    );
  }

  return target.courseDistanceM
    / target.meanTransitSeconds;
};
