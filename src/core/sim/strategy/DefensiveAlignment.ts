import type {
  DefensivePosition,
} from '../../model/CanonicalWorldSnapshot';
import type {
  Vec2,
} from '../../model/geometry';

export type DefensiveAlignmentDefender = Readonly<{
  playerId: string;
  registeredPosition: DefensivePosition;
  start: Vec2;
}>;

export type DefensiveAlignment = Readonly<{
  defenders: readonly DefensiveAlignmentDefender[];
}>;

const DEFENSIVE_POSITIONS = [
  'P',
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
] as const satisfies readonly DefensivePosition[];

export const createDefensiveAlignment = (
  defenders: readonly DefensiveAlignmentDefender[],
): DefensiveAlignment => {
  if (defenders.length !== 9) {
    throw new Error(
      'defensive alignment must contain exactly nine defenders',
    );
  }

  const playerIds = new Set<string>();
  const positions = new Set<DefensivePosition>();

  for (const defender of defenders) {
    if (defender.playerId.length === 0) {
      throw new Error(
        'defensive alignment playerId must not be empty',
      );
    }
    if (playerIds.has(defender.playerId)) {
      throw new Error(
        'defensive alignment playerIds must be unique',
      );
    }
    playerIds.add(defender.playerId);

    if (positions.has(defender.registeredPosition)) {
      throw new Error(
        'defensive alignment must contain each registered defensive position exactly once',
      );
    }
    positions.add(defender.registeredPosition);

    if (
      !Number.isFinite(defender.start.x)
      || !Number.isFinite(defender.start.z)
    ) {
      throw new Error(
        'defender start coordinates must be finite',
      );
    }
  }

  if (
    DEFENSIVE_POSITIONS.some(
      (position) => !positions.has(position),
    )
  ) {
    throw new Error(
      'defensive alignment must contain each registered defensive position exactly once',
    );
  }

  return {
    defenders: defenders.map((defender) => ({
      playerId: defender.playerId,
      registeredPosition:
        defender.registeredPosition,
      start: {
        x: defender.start.x,
        z: defender.start.z,
      },
    })),
  };
};
