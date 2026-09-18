import type {
  DefensivePosition,
} from '../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../model/geometry';

export type DefenderFootPlacementFact = Readonly<{
  kind: 'defender_foot_placement';
  playerId: string;
  registeredPosition: DefensivePosition;
  tick: number;
  leftFoot: Vec2;
  rightFoot: Vec2;
}>;

export type SecondBaseDivisionReference = Readonly<{
  secondBaseCenter: Vec2;
  firstBaseSideUnit: Vec2;
}>;

const UNIT_TOLERANCE = 1e-9;

const validateVec2 = (
  name: string,
  value: Vec2,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(`${name} coordinates must be finite`);
  }
};

export const createDefenderFootPlacementFact = (
  playerId: string,
  registeredPosition: DefensivePosition,
  tick: number,
  leftFoot: Vec2,
  rightFoot: Vec2,
): DefenderFootPlacementFact => {
  if (playerId.length === 0) {
    throw new Error('playerId must not be empty');
  }
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      'foot-placement tick must be a non-negative safe integer',
    );
  }
  validateVec2('foot', leftFoot);
  validateVec2('foot', rightFoot);

  return {
    kind: 'defender_foot_placement',
    playerId,
    registeredPosition,
    tick,
    leftFoot,
    rightFoot,
  };
};

export const createSecondBaseDivisionReference = (
  secondBaseCenter: Vec2,
  firstBaseSideUnit: Vec2,
): SecondBaseDivisionReference => {
  validateVec2('secondBaseCenter', secondBaseCenter);
  validateVec2('firstBaseSideUnit', firstBaseSideUnit);

  const length = Math.hypot(
    firstBaseSideUnit.x,
    firstBaseSideUnit.z,
  );
  if (Math.abs(length - 1) > UNIT_TOLERANCE) {
    throw new Error('firstBaseSideUnit must be a unit vector');
  }

  return {
    secondBaseCenter,
    firstBaseSideUnit,
  };
};
