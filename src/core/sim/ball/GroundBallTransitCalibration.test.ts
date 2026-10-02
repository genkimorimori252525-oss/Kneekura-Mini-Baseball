import { describe, expect, it } from 'vitest';
import {
  KSTATE_2017_TALL_FESCUE_GROUND_BALL_TRANSIT_TARGETS,
  groundBallMeanTransitSpeedMps,
} from './GroundBallTransitCalibration';

describe('K-State tall-fescue ground-ball transit calibration', () => {
  it('preserves the published 30.5 m transit-time evidence', () => {
    expect(
      KSTATE_2017_TALL_FESCUE_GROUND_BALL_TRANSIT_TARGETS
        .map(
          (target) => [
            target.mowingHeightCm,
            target.meanTransitSeconds,
          ],
        ),
    ).toEqual([
      [2.5, 1.77],
      [5.0, 2.08],
      [7.6, 1.88],
    ]);
  });

  it('keeps the 5 cm mowing-height condition slower than the 2.5 cm condition without inventing a rolling-friction coefficient', () => {
    const [short, medium] =
      KSTATE_2017_TALL_FESCUE_GROUND_BALL_TRANSIT_TARGETS;

    expect(
      groundBallMeanTransitSpeedMps(
        medium!,
      ),
    ).toBeLessThan(
      groundBallMeanTransitSpeedMps(
        short!,
      ),
    );
  });

  it('records the pitching-machine setting as protocol context, not the assumed post-bounce rolling speed', () => {
    for (
      const target
      of KSTATE_2017_TALL_FESCUE_GROUND_BALL_TRANSIT_TARGETS
    ) {
      expect(
        target.pitchingMachineSettingKph,
      ).toBe(112.6);
    }
  });
});
