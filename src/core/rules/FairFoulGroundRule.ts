import type { Vec2 } from '../model/geometry';
import {
  classifyPointAgainstFairTerritory,
  type FairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';
import type {
  FirstGroundContactTerritory,
} from '../sim/ball/FirstGroundContactTerritory';

export type FairFoulBaseGateGeometry = Readonly<{
  firstBase: Vec2;
  secondBase: Vec2;
  thirdBase: Vec2;
}>;

export type UntouchedGroundContactBeyondBasesInput = Readonly<{
  firstGroundContact: FirstGroundContactTerritory;
  field: FairTerritoryWedge;
  bases: FairFoulBaseGateGeometry;
  noPriorFielderTouch: true;
}>;

export type UntouchedGroundContactBeyondBasesResult =
  | Readonly<{
      kind: 'resolved';
      territory: 'fair' | 'foul';
      decisiveTick: number;
      decisivePosition: Vec2;
      beyond: Readonly<{
        firstBase: boolean;
        thirdBase: boolean;
      }>;
    }>
  | Readonly<{
      kind: 'not_decisive';
      reason:
        'first_ground_contact_not_beyond_first_or_third';
      beyond: Readonly<{
        firstBase: boolean;
        thirdBase: boolean;
      }>;
    }>;

const EPSILON = 1e-10;

const validateVec2 = (
  name: string,
  value: Vec2,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const subtract = (
  first: Vec2,
  second: Vec2,
): Vec2 => ({
  x: first.x - second.x,
  z: first.z - second.z,
});

const cross = (
  first: Vec2,
  second: Vec2,
): number => (
  first.x * second.z
  - first.z * second.x
);

const lineSide = (
  start: Vec2,
  end: Vec2,
  point: Vec2,
): number => (
  cross(
    subtract(end, start),
    subtract(point, start),
  )
);

const isStrictlyBeyondGateFromHome = (
  home: Vec2,
  gateStart: Vec2,
  gateEnd: Vec2,
  point: Vec2,
): boolean => {
  const homeSide = lineSide(
    gateStart,
    gateEnd,
    home,
  );
  const pointSide = lineSide(
    gateStart,
    gateEnd,
    point,
  );

  if (Math.abs(homeSide) <= EPSILON) {
    throw new Error(
      'home plate must not lie on a first/third-base beyond gate',
    );
  }

  return (
    Math.abs(pointSide) > EPSILON
    && Math.sign(pointSide) !== Math.sign(homeSide)
  );
};

export const resolveUntouchedGroundContactBeyondBases = (
  input: UntouchedGroundContactBeyondBasesInput,
): UntouchedGroundContactBeyondBasesResult => {
  if (input.noPriorFielderTouch !== true) {
    throw new Error(
      'ground-contact fair/foul resolution requires no prior fielder touch',
    );
  }

  validateVec2(
    'firstBase',
    input.bases.firstBase,
  );
  validateVec2(
    'secondBase',
    input.bases.secondBase,
  );
  validateVec2(
    'thirdBase',
    input.bases.thirdBase,
  );
  validateVec2(
    'firstGroundContact.position',
    input.firstGroundContact.position,
  );

  const home = input.field.homePlate;
  const point = input.firstGroundContact.position;

  const beyondFirstBase = isStrictlyBeyondGateFromHome(
    home,
    input.bases.firstBase,
    input.bases.secondBase,
    point,
  );
  const beyondThirdBase = isStrictlyBeyondGateFromHome(
    home,
    input.bases.thirdBase,
    input.bases.secondBase,
    point,
  );
  const beyond = {
    firstBase: beyondFirstBase,
    thirdBase: beyondThirdBase,
  } as const;

  if (!beyondFirstBase && !beyondThirdBase) {
    return {
      kind: 'not_decisive',
      reason:
        'first_ground_contact_not_beyond_first_or_third',
      beyond,
    };
  }

  const territory = classifyPointAgainstFairTerritory(
    input.field,
    point,
  );

  return {
    kind: 'resolved',
    territory: territory.kind === 'inside_fair_wedge'
      ? 'fair'
      : 'foul',
    decisiveTick: input.firstGroundContact.tick,
    decisivePosition: point,
    beyond,
  };
};
