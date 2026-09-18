import type {
  DefenderWorldState,
} from '../../model/CanonicalWorldSnapshot';
import type {
  DefensiveAlignment,
} from './DefensiveAlignment';

export const createDefenderWorldStatesFromAlignment = (
  alignment: DefensiveAlignment,
): readonly DefenderWorldState[] => (
  alignment.defenders.map((defender) => ({
    playerId: defender.playerId,
    registeredPosition:
      defender.registeredPosition,
    position: {
      x: defender.start.x,
      z: defender.start.z,
    },
    velocity: {
      x: 0,
      z: 0,
    },
    assignment: {
      kind: 'hold',
    },
  }))
);
