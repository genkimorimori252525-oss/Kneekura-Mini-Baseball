import type { Vec2 } from '../../model/geometry';
import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import type { DefensiveIntent } from './DefensiveDecision';

export type DefensiveFieldLandmarks = Readonly<{
  basePositions: Readonly<Record<1 | 2 | 3 | 4, Vec2>>;
}>;

const validateVec2 = (name: string, value: Vec2): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

export const resolveDefensiveMovementTarget = <TKnownContext>(
  intent: DefensiveIntent,
  perceivedWorld: PlayerPerceivedWorldState<TKnownContext>,
  landmarks: DefensiveFieldLandmarks,
): Vec2 | null => {
  for (const base of [1, 2, 3, 4] as const) {
    validateVec2(`basePositions[${base}]`, landmarks.basePositions[base]);
  }

  switch (intent.kind) {
    case 'ball_handler': {
      const ball = perceivedWorld.ball;
      if (ball === null) return null;
      const target = {
        x: ball.estimate.position.x,
        z: ball.estimate.position.z,
      };
      validateVec2('perceived ball target', target);
      return target;
    }
    case 'base_cover':
      return landmarks.basePositions[intent.base];
    case 'relay':
    case 'backup':
    case 'deep_coverage':
      validateVec2(`${intent.kind} target`, intent.target);
      return intent.target;
    case 'hold':
      return null;
  }
};
