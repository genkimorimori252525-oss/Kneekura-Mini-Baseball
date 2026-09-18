import type { Vec2 } from '../../model/geometry';

export type FairFoulBaseGateGeometry = Readonly<{
  homePlate: Vec2;
  firstBase: Vec2;
  secondBase: Vec2;
  thirdBase: Vec2;
}>;

export type FirstThirdBaseGateClassification = Readonly<{
  firstBase: boolean;
  thirdBase: boolean;
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
    throw new Error(
      `${name} must contain finite coordinates`,
    );
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

const validateGate = (
  name: string,
  start: Vec2,
  end: Vec2,
): void => {
  if (
    Math.hypot(
      end.x - start.x,
      end.z - start.z,
    ) <= EPSILON
  ) {
    throw new Error(
      `${name} must define a non-degenerate gate`,
    );
  }
};

export const createFairFoulBaseGateGeometry = (
  input: FairFoulBaseGateGeometry,
): FairFoulBaseGateGeometry => {
  validateVec2('homePlate', input.homePlate);
  validateVec2('firstBase', input.firstBase);
  validateVec2('secondBase', input.secondBase);
  validateVec2('thirdBase', input.thirdBase);

  validateGate(
    'firstBase and secondBase',
    input.firstBase,
    input.secondBase,
  );
  validateGate(
    'thirdBase and secondBase',
    input.thirdBase,
    input.secondBase,
  );

  const firstHomeSide = lineSide(
    input.firstBase,
    input.secondBase,
    input.homePlate,
  );
  const thirdHomeSide = lineSide(
    input.thirdBase,
    input.secondBase,
    input.homePlate,
  );
  if (
    Math.abs(firstHomeSide) <= EPSILON
    || Math.abs(thirdHomeSide) <= EPSILON
  ) {
    throw new Error(
      'homePlate must not lie on a first/third-base gate',
    );
  }

  return {
    homePlate: {
      x: input.homePlate.x,
      z: input.homePlate.z,
    },
    firstBase: {
      x: input.firstBase.x,
      z: input.firstBase.z,
    },
    secondBase: {
      x: input.secondBase.x,
      z: input.secondBase.z,
    },
    thirdBase: {
      x: input.thirdBase.x,
      z: input.thirdBase.z,
    },
  };
};

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

  return (
    Math.abs(pointSide) > EPSILON
    && Math.sign(pointSide) !== Math.sign(homeSide)
  );
};

export const classifyPointBeyondFirstThirdBaseGates = (
  geometry: FairFoulBaseGateGeometry,
  point: Vec2,
): FirstThirdBaseGateClassification => {
  const normalized =
    createFairFoulBaseGateGeometry(geometry);
  validateVec2('point', point);

  return {
    firstBase: isStrictlyBeyondGateFromHome(
      normalized.homePlate,
      normalized.firstBase,
      normalized.secondBase,
      point,
    ),
    thirdBase: isStrictlyBeyondGateFromHome(
      normalized.homePlate,
      normalized.thirdBase,
      normalized.secondBase,
      point,
    ),
  };
};
