import type {
  DefenderWorldState,
  DefensiveAssignment,
  DefensivePosition,
} from '../../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../../model/geometry';
import type { DefensiveIntent } from './DefensiveDecision';
import type { DefenderMotionState } from './DefenderMotion';

const normalizeZero = (value: number): number => (
  Object.is(value, -0) ? 0 : value
);

const normalizeVec2 = (value: Vec2): Vec2 => ({
  x: normalizeZero(value.x),
  z: normalizeZero(value.z),
});

const projectAssignment = (
  intent: DefensiveIntent,
): DefensiveAssignment => {
  switch (intent.kind) {
    case 'ball_handler':
      return { kind: 'ball_handler' };
    case 'base_cover':
      return { kind: 'base_cover', base: intent.base };
    case 'relay':
      return { kind: 'relay', target: normalizeVec2(intent.target) };
    case 'backup':
      return { kind: 'backup', target: normalizeVec2(intent.target) };
    case 'deep_coverage':
      return {
        kind: 'deep_coverage',
        target: normalizeVec2(intent.target),
      };
    case 'hold':
      return { kind: 'hold' };
  }
};

export const projectDefenderWorldState = (
  playerId: string,
  registeredPosition: DefensivePosition,
  motion: DefenderMotionState,
  intent: DefensiveIntent,
): DefenderWorldState => ({
  playerId,
  registeredPosition,
  position: normalizeVec2(motion.position),
  velocity: normalizeVec2(motion.velocity),
  assignment: projectAssignment(intent),
});
