import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  simulateBaseballSurfacePace,
} from './BaseballSurfacePaceModel';

describe('baseball surface pace model', () => {
  it('converts internal normal/tangential contact parameters into the published total-speed-ratio observable', () => {
    const angle = 0.44;
    const normalCor = 0.5;
    const result =
      simulateBaseballSurfacePace({
        incidentSpeedMps: 40,
        incidenceAngleRadians:
          angle,
        ball:
          REFERENCE_BASEBALL_RIGID_BODY,
        contact: {
          normalRestitution:
            normalCor,
          tangentialRestitution: 0,
          frictionCoefficient: 0,
        },
      });

    const expected = Math.hypot(
      Math.cos(angle),
      normalCor * Math.sin(angle),
    );

    expect(result.speedRatio)
      .toBeCloseTo(expected, 12);
  });

  it('lets spin-coupled friction change surface pace rather than treating published pace as normal COR', () => {
    const frictionless =
      simulateBaseballSurfacePace({
        incidentSpeedMps: 31,
        incidenceAngleRadians:
          0.61,
        ball:
          REFERENCE_BASEBALL_RIGID_BODY,
        contact: {
          normalRestitution: 0.4,
          tangentialRestitution: 0,
          frictionCoefficient: 0,
        },
      });
    const rough =
      simulateBaseballSurfacePace({
        incidentSpeedMps: 31,
        incidenceAngleRadians:
          0.61,
        ball:
          REFERENCE_BASEBALL_RIGID_BODY,
        contact: {
          normalRestitution: 0.4,
          tangentialRestitution: 0,
          frictionCoefficient: 0.5,
        },
      });

    expect(rough.speedRatio)
      .toBeLessThan(
        frictionless.speedRatio,
      );
    expect(
      Math.abs(
        rough.contact.exitSpin.z,
      ),
    ).toBeGreaterThan(0);
  });
});
