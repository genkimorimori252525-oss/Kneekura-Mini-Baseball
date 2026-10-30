import type { BattedBallInitialState } from '../contact/BatBallContact';
import type { AerodynamicPitchTrajectoryParameters } from '../pitching/AerodynamicPitchTrajectory';
import { BASEBALL_SEAM_DIRECTION_LIPSCHITZ_V1, BASEBALL_SEAM_MAX_COEFFICIENT_V1, validateBaseballSeamForceV1 } from './BaseballSeamForceV1';

const maximumSlope = (knots: readonly Readonly<{ x: number; y: number }>[]) => Math.max(0,
  ...knots.slice(1).map((k, i) => Math.abs((k.y - knots[i].y) / (k.x - knots[i].x))));

/** Conservative norm bound for the derivative of the original RK4 position
 * evaluation inside one Source cell. This bounds the dense numerical curve,
 * including its intermediate velocity/spin stages; it does not substitute a
 * constant-acceleration trajectory for Core Aero. */
export const sourceRk4PositionBounds = (ball: BattedBallInitialState, seconds: number,
  parameters: AerodynamicPitchTrajectoryParameters): Readonly<{ maximumSpeedMps: number; linearDeviationMps2: number; maximumAccelerationMps2: number }> => {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('invalid nonlinear Source cell duration');
  const p = parameters.aerodynamics, r = p.ballRadiusM, wind = Math.hypot(p.windVelocityMps.x, p.windVelocityMps.y, p.windVelocityMps.z);
  const v0 = Math.hypot(ball.velocity.x - p.windVelocityMps.x, ball.velocity.y - p.windVelocityMps.y, ball.velocity.z - p.windVelocityMps.z);
  const w0 = Math.hypot(ball.spin.x, ball.spin.y, ball.spin.z), g = Math.abs(parameters.gravityY);
  const c = 0.5 * p.airDensityKgM3 * Math.PI * r * r / p.ballMassKg;
  const coefficient = p.coefficientProfile;
  const seam = p.seamForce === undefined ? 0 : BASEBALL_SEAM_MAX_COEFFICIENT_V1 * validateBaseballSeamForceV1(p.seamForce).coefficientScale;
  let cd = p.dragCoefficient, cl = 0, cdSpinSlope = 0, cdVelocitySlope = 0, clSpinSlope = 0;
  if (coefficient) {
    // A discontinuous nonzero lift at zero spin cannot have this derivative bound.
    if (coefficient.spinKnots[0].liftCoefficient !== 0) throw new Error('nonlinear Source lift must be continuous at zero spin');
    const baseCd = Math.max(...coefficient.spinKnots.map(k => k.dragCoefficientAtReferenceRe));
    const correction = Math.max(1, ...coefficient.reynoldsKnots.map(k => k.dragCorrectionFactorAtLowSpin));
    const deviation = Math.max(...coefficient.reynoldsKnots.map(k => Math.abs(k.dragCorrectionFactorAtLowSpin - 1)));
    cd = baseCd * correction;
    cl = Math.max(...coefficient.spinKnots.map(k => k.liftCoefficient));
    cdSpinSlope = correction * maximumSlope(coefficient.spinKnots.map(k => ({ x: k.spinFactor, y: k.dragCoefficientAtReferenceRe })))
      + baseCd * deviation / (coefficient.reynoldsCorrectionZeroAtSpinFactor - coefficient.reynoldsCorrectionFullThroughSpinFactor);
    cdVelocitySlope = baseCd * maximumSlope(coefficient.reynoldsKnots.map(k => ({ x: k.reynoldsNumber, y: k.dragCorrectionFactorAtLowSpin })))
      * 2 * r / p.airKinematicViscosityM2PerSecond!;
    clSpinSlope = maximumSlope(coefficient.spinKnots.map(k => ({ x: k.spinFactor, y: k.liftCoefficient })));
  }
  const acceleration = (v: number, w: number) => g + c * (coefficient
    ? (cd + cl + seam) * v * v : (cd + 0.09 + seam) * v * v + 1.5 * r * w * v);
  const velocityGradient = (v: number, w: number) => c * (coefficient
    ? 2 * (cd + cl) * v + (3 * cdSpinSlope + 4 * clSpinSlope) * r * w + cdVelocitySlope * v * v
    : (2 * cd + 0.18) * v + 1.5 * r * w) + c * seam * (2 + BASEBALL_SEAM_DIRECTION_LIPSCHITZ_V1) * v;
  const phaseGradient = (v: number) => c * seam * (1 + BASEBALL_SEAM_DIRECTION_LIPSCHITZ_V1) * v * v;
  const spinGradient = (v: number) => c * r * v * (coefficient ? cdSpinSlope + 2 * clSpinSlope : 1.5);
  const decayScale = p.spinDecay ? 1 / (p.spinDecay.referenceSpeedMps * p.spinDecay.timeConstantSecondsAtReferenceSpeed) : 0;
  const a0 = acceleration(v0, w0), s0 = v0 * w0 * decayScale;
  const v2 = v0 + seconds * a0 / 2, w2 = w0 + seconds * s0 / 2, dv2 = a0 / 2, dw2 = s0 / 2;
  const a2 = acceleration(v2, w2), da2 = velocityGradient(v2, w2) * dv2 + spinGradient(v2) * dw2 + phaseGradient(v2) * w0 / 2;
  const s2 = v2 * w2 * decayScale, ds2 = (w2 * dv2 + v2 * dw2) * decayScale;
  const v3 = v0 + seconds * a2 / 2, w3 = w0 + seconds * s2 / 2;
  const dv3 = a2 / 2 + seconds * da2 / 2, dw3 = s2 / 2 + seconds * ds2 / 2;
  const a3 = acceleration(v3, w3), da3 = velocityGradient(v3, w3) * dv3 + spinGradient(v3) * dw3 + phaseGradient(v3) * (w2 + seconds * dw2) / 2;
  const v4 = v0 + seconds * a3, dv4 = a3 + seconds * da3;
  const bound = wind + (v0 + 2 * v2 + 2 * v3 + v4) / 6 + seconds * (2 * dv2 + 2 * dv3 + dv4) / 6;
  if (!Number.isFinite(bound) || bound < 0) throw new Error('nonlinear Source derivative bound overflows');
  const linearDeviationMps2 = (a0 + a2 + a3) / 6 * (1 + 128 * Number.EPSILON);
  if (!Number.isFinite(linearDeviationMps2)) throw new Error('nonlinear Source position deviation bound overflows');
  const w4=w0+seconds*v3*w3*decayScale;
  const maximumAccelerationMps2=Math.max(a0,a2,a3,acceleration(v4,w4))*(1+128*Number.EPSILON);
  if(!Number.isFinite(maximumAccelerationMps2))throw new Error('nonlinear Source acceleration bound overflows');
  return { maximumSpeedMps: bound * (1 + 128 * Number.EPSILON), linearDeviationMps2, maximumAccelerationMps2 };
};

export const boundSourceRk4PositionSpeed = (ball: BattedBallInitialState, seconds: number,
  parameters: AerodynamicPitchTrajectoryParameters): number => sourceRk4PositionBounds(ball, seconds, parameters).maximumSpeedMps;
