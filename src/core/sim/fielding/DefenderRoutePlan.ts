import type {
  Vec2,
} from '../../model/geometry';

export type DefenderRoutePlanCalibration = Readonly<{
  maximumLateralDetourMeters: number;
}>;

export type DefenderRoutePlan = Readonly<{
  start: Vec2;
  target: Vec2;
  waypoints: readonly Vec2[];
  directDistanceMeters: number;
  plannedDistanceMeters: number;
  lateralDetourMeters: number;
}>;

export type DefenderRoutePlanInput = Readonly<{
  start: Vec2;
  target: Vec2;
  routeEfficiency: number;
  preferredSide: -1 | 1;
  calibration: DefenderRoutePlanCalibration;
}>;

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

const distance = (
  a: Vec2,
  b: Vec2,
): number => Math.hypot(
  b.x - a.x,
  b.z - a.z,
);

export const planDefenderRoute = (
  input: DefenderRoutePlanInput,
): DefenderRoutePlan => {
  validateVec2('start', input.start);
  validateVec2('target', input.target);

  if (
    !Number.isFinite(input.routeEfficiency)
    || input.routeEfficiency < 0
    || input.routeEfficiency > 1
  ) {
    throw new Error(
      'routeEfficiency must be finite and within [0, 1]',
    );
  }
  if (
    input.preferredSide !== -1
    && input.preferredSide !== 1
  ) {
    throw new Error(
      'preferredSide must be -1 or 1',
    );
  }
  if (
    !Number.isFinite(
      input.calibration.maximumLateralDetourMeters,
    )
    || input.calibration.maximumLateralDetourMeters < 0
  ) {
    throw new Error(
      'maximumLateralDetourMeters must be finite and non-negative',
    );
  }

  const dx = input.target.x - input.start.x;
  const dz = input.target.z - input.start.z;
  const directDistanceMeters = Math.hypot(dx, dz);

  if (
    directDistanceMeters <= 1e-12
    || input.routeEfficiency >= 1
    || input.calibration.maximumLateralDetourMeters <= 0
  ) {
    return {
      start: input.start,
      target: input.target,
      waypoints: [input.target],
      directDistanceMeters,
      plannedDistanceMeters: directDistanceMeters,
      lateralDetourMeters: 0,
    };
  }

  const lateralDetourMeters = (
    input.calibration.maximumLateralDetourMeters
    * (1 - input.routeEfficiency)
  );

  const normalX = (
    -dz / directDistanceMeters
    * input.preferredSide
  );
  const normalZ = (
    dx / directDistanceMeters
    * input.preferredSide
  );

  const midpoint: Vec2 = {
    x: (input.start.x + input.target.x) / 2,
    z: (input.start.z + input.target.z) / 2,
  };
  const detour: Vec2 = {
    x: midpoint.x + normalX * lateralDetourMeters,
    z: midpoint.z + normalZ * lateralDetourMeters,
  };
  const waypoints: readonly Vec2[] = [
    detour,
    input.target,
  ];
  const plannedDistanceMeters = (
    distance(input.start, detour)
    + distance(detour, input.target)
  );

  return {
    start: input.start,
    target: input.target,
    waypoints,
    directDistanceMeters,
    plannedDistanceMeters,
    lateralDetourMeters,
  };
};
