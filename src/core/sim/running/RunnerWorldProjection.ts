import type { BaserunnerWorldState } from '../../model/CanonicalWorldSnapshot';
import type { RunnerMotionState } from './RunnerMotion';
import { sampleRunnerRoute, type RunnerRoute } from './RunnerRoute';

const canonicalZero = (value: number): number => value === 0 ? 0 : value;

export const projectRunnerWorldState = (
  playerId: string,
  motion: RunnerMotionState,
  route: RunnerRoute,
): BaserunnerWorldState => {
  const sample = sampleRunnerRoute(route, motion.routeDistanceMeters);

  return {
    playerId,
    position: sample.position,
    velocity: {
      x: canonicalZero(sample.tangent.x * motion.speedMps),
      z: canonicalZero(sample.tangent.z * motion.speedMps),
    },
  };
};
