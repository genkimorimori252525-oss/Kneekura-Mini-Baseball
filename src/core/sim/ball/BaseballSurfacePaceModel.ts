import type { Vec3 } from '../../model/geometry';
import type {
  RigidBaseballProperties,
} from '../contact/RigidBatBallContact';
import {
  calculateSurfacePaceSpeedRatio,
} from './BaseballSurfacePaceCalibration';
import {
  resolveBallSurfaceContact,
  type BallSurfaceContactParameters,
  type BallSurfaceContactResult,
} from './BallSurfaceContact';

export type SurfacePaceSimulationInput = Readonly<{
  incidentSpeedMps: number;
  incidenceAngleRadians: number;
  ball: RigidBaseballProperties;
  contact: BallSurfaceContactParameters;
  incomingSpin?: Vec3;
}>;

export type SurfacePaceSimulationResult = Readonly<{
  incidentVelocity: Vec3;
  contact: BallSurfaceContactResult;
  reboundSpeedMps: number;
  speedRatio: number;
}>;

/**
 * Pennbounce-compatible planar observation helper.
 *
 * incidenceAngleRadians is measured above the horizontal playing surface,
 * matching the published 0.44 / 0.61 rad test geometry.
 */
export const simulateBaseballSurfacePace = (
  input: SurfacePaceSimulationInput,
): SurfacePaceSimulationResult => {
  if (
    !Number.isFinite(input.incidentSpeedMps)
    || input.incidentSpeedMps <= 0
  ) {
    throw new Error(
      'surface pace incidentSpeedMps must be finite and positive',
    );
  }
  if (
    !Number.isFinite(input.incidenceAngleRadians)
    || input.incidenceAngleRadians <= 0
    || input.incidenceAngleRadians >= Math.PI / 2
  ) {
    throw new Error(
      'surface pace incidence angle must lie strictly between 0 and pi/2',
    );
  }

  const incidentVelocity = {
    x:
      input.incidentSpeedMps
      * Math.cos(
        input.incidenceAngleRadians,
      ),
    y:
      -input.incidentSpeedMps
      * Math.sin(
        input.incidenceAngleRadians,
      ),
    z: 0,
  };

  const contact =
    resolveBallSurfaceContact({
      tick: 0,
      ballCenter: {
        x: 0,
        y: input.ball.radiusM,
        z: 0,
      },
      ballVelocity:
        incidentVelocity,
      ballSpin:
        input.incomingSpin
        ?? {
          x: 0,
          y: 0,
          z: 0,
        },
      ball: input.ball,
      surfaceNormal: {
        x: 0,
        y: 1,
        z: 0,
      },
      parameters:
        input.contact,
    });

  if (contact === null) {
    throw new Error(
      'surface pace fixture must approach the playing surface',
    );
  }

  const reboundSpeedMps =
    Math.hypot(
      contact.exitVelocity.x,
      contact.exitVelocity.y,
      contact.exitVelocity.z,
    );

  return {
    incidentVelocity,
    contact,
    reboundSpeedMps,
    speedRatio:
      calculateSurfacePaceSpeedRatio(
        input.incidentSpeedMps,
        reboundSpeedMps,
      ),
  };
};
