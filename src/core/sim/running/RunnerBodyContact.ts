import type { Vec2 } from '../../model/geometry';
import type { RunnerMotionState } from './RunnerMotion';
import { sampleRunnerRoute, type RunnerRoute } from './RunnerRoute';

export type RunnerBodyContactParameters = Readonly<{
  uprightLeadMeters: number;
  slideLeadMeters: number;
}>;

export type RunnerPhysicalTouchPoint = Readonly<{
  kind: 'foot' | 'hand';
  routeDistanceMeters: number;
  position: Vec2;
  velocity: Vec2;
}>;

const validateLead = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be finite and non-negative`);
  }
};

const canonicalZero = (value: number): number => value === 0 ? 0 : value;

export const sampleRunnerPhysicalTouchPoint = (
  motion: RunnerMotionState,
  route: RunnerRoute,
  parameters: RunnerBodyContactParameters,
): RunnerPhysicalTouchPoint => {
  validateLead('uprightLeadMeters', parameters.uprightLeadMeters);
  validateLead('slideLeadMeters', parameters.slideLeadMeters);

  const kind = motion.bodyMode === 'sliding' ? 'hand' : 'foot';
  const leadMeters = motion.bodyMode === 'sliding'
    ? parameters.slideLeadMeters
    : parameters.uprightLeadMeters;
  const travelDirection = Math.sign(motion.speedMps);
  const routeDistanceMeters = motion.routeDistanceMeters + travelDirection * leadMeters;
  const routeSample = sampleRunnerRoute(route, routeDistanceMeters);

  return {
    kind,
    routeDistanceMeters,
    position: routeSample.position,
    velocity: {
      x: canonicalZero(routeSample.tangent.x * motion.speedMps),
      z: canonicalZero(routeSample.tangent.z * motion.speedMps),
    },
  };
};
