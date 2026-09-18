import type { Vec2 } from '../../model/geometry';

export type FairTerritoryWedge = Readonly<{
  homePlate: Vec2;
  firstBaseLineUnit: Vec2;
  thirdBaseLineUnit: Vec2;
}>;

export type FairTerritoryPointClassification = Readonly<{
  kind: 'inside_fair_wedge' | 'outside_fair_wedge';
  firstBaseLineSignedSide: number;
  thirdBaseLineSignedSide: number;
}>;

const UNIT_TOLERANCE = 1e-9;
const SIDE_TOLERANCE = 1e-10;

const length = (
  value: Vec2,
): number => Math.hypot(value.x, value.z);

const cross = (
  first: Vec2,
  second: Vec2,
): number => (
  first.x * second.z
  - first.z * second.x
);

const subtract = (
  first: Vec2,
  second: Vec2,
): Vec2 => ({
  x: first.x - second.x,
  z: first.z - second.z,
});

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

export const createFairTerritoryWedge = (
  input: FairTerritoryWedge,
): FairTerritoryWedge => {
  validateVec2('homePlate', input.homePlate);
  validateVec2(
    'firstBaseLineUnit',
    input.firstBaseLineUnit,
  );
  validateVec2(
    'thirdBaseLineUnit',
    input.thirdBaseLineUnit,
  );

  if (
    Math.abs(length(input.firstBaseLineUnit) - 1)
      > UNIT_TOLERANCE
    || Math.abs(length(input.thirdBaseLineUnit) - 1)
      > UNIT_TOLERANCE
  ) {
    throw new Error(
      'fair-territory foul-line vectors must be unit length',
    );
  }

  if (
    cross(
      input.firstBaseLineUnit,
      input.thirdBaseLineUnit,
    ) <= SIDE_TOLERANCE
  ) {
    throw new Error(
      'thirdBaseLineUnit must be counterclockwise from firstBaseLineUnit',
    );
  }

  return {
    homePlate: {
      x: input.homePlate.x,
      z: input.homePlate.z,
    },
    firstBaseLineUnit: {
      x: input.firstBaseLineUnit.x,
      z: input.firstBaseLineUnit.z,
    },
    thirdBaseLineUnit: {
      x: input.thirdBaseLineUnit.x,
      z: input.thirdBaseLineUnit.z,
    },
  };
};

export const classifyPointAgainstFairTerritory = (
  field: FairTerritoryWedge,
  point: Vec2,
): FairTerritoryPointClassification => {
  validateVec2('point', point);
  const normalizedField = createFairTerritoryWedge(field);
  const relative = subtract(
    point,
    normalizedField.homePlate,
  );

  const firstBaseLineSignedSide = cross(
    normalizedField.firstBaseLineUnit,
    relative,
  );
  const thirdBaseLineSignedSide = cross(
    relative,
    normalizedField.thirdBaseLineUnit,
  );

  return {
    kind: (
      firstBaseLineSignedSide >= -SIDE_TOLERANCE
      && thirdBaseLineSignedSide >= -SIDE_TOLERANCE
    )
      ? 'inside_fair_wedge'
      : 'outside_fair_wedge',
    firstBaseLineSignedSide,
    thirdBaseLineSignedSide,
  };
};
