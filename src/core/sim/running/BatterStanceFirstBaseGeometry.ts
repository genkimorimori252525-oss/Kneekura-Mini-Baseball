import type { Vec2 } from '../../model/geometry';
import type { RunnerRoute } from './RunnerRoute';

export type ResolvedBatterSide = 'left' | 'right';

export type BatterRunnerFirstBaseFrame = Readonly<{
  homePlateReferencePoint: Vec2;
  firstBaseCenter: Vec2;
  towardPitcherUnit: Vec2;
  towardFirstBaseSideUnit: Vec2;
  homePlateHalfWidthMeters: number;
}>;

export type BatterStanceGeometry = Readonly<{
  side: ResolvedBatterSide;
  /**
   * Body-center distance from the inside edge of home plate on the
   * batter's occupied side.
   */
  distanceOffPlateMeters: number;
  /**
   * Signed body-center offset from the frame's home-plate reference
   * point. Positive is toward the pitcher.
   */
  towardPitcherOffsetMeters: number;
}>;

const UNIT_TOLERANCE = 1e-9;
const EPSILON = 1e-12;

const validateVec2 = (
  name: string,
  value: Vec2,
): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(`${name} coordinates must be finite`);
  }
};

const vectorLength = (value: Vec2): number => Math.hypot(
  value.x,
  value.z,
);

const dot = (first: Vec2, second: Vec2): number => (
  first.x * second.x + first.z * second.z
);

const validateFrame = (
  frame: BatterRunnerFirstBaseFrame,
): void => {
  validateVec2(
    'homePlateReferencePoint',
    frame.homePlateReferencePoint,
  );
  validateVec2('firstBaseCenter', frame.firstBaseCenter);
  validateVec2('towardPitcherUnit', frame.towardPitcherUnit);
  validateVec2(
    'towardFirstBaseSideUnit',
    frame.towardFirstBaseSideUnit,
  );

  const pitcherLength = vectorLength(frame.towardPitcherUnit);
  const firstSideLength = vectorLength(
    frame.towardFirstBaseSideUnit,
  );
  const axesDot = dot(
    frame.towardPitcherUnit,
    frame.towardFirstBaseSideUnit,
  );
  if (
    Math.abs(pitcherLength - 1) > UNIT_TOLERANCE
    || Math.abs(firstSideLength - 1) > UNIT_TOLERANCE
    || Math.abs(axesDot) > UNIT_TOLERANCE
  ) {
    throw new Error(
      'batter field-frame axes must be orthonormal',
    );
  }

  if (
    !Number.isFinite(frame.homePlateHalfWidthMeters)
    || frame.homePlateHalfWidthMeters <= 0
  ) {
    throw new Error(
      'homePlateHalfWidthMeters must be finite and positive',
    );
  }

  const firstBaseDelta = {
    x: frame.firstBaseCenter.x - frame.homePlateReferencePoint.x,
    z: frame.firstBaseCenter.z - frame.homePlateReferencePoint.z,
  };
  if (vectorLength(firstBaseDelta) <= EPSILON) {
    throw new Error(
      'firstBaseCenter must differ from homePlateReferencePoint',
    );
  }
  if (dot(firstBaseDelta, frame.towardFirstBaseSideUnit) <= 0) {
    throw new Error(
      'firstBaseCenter must lie on the declared first-base side',
    );
  }
};

const validateStance = (
  stance: BatterStanceGeometry,
): void => {
  if (stance.side !== 'left' && stance.side !== 'right') {
    throw new Error("batter side must be 'left' or 'right'");
  }
  if (
    !Number.isFinite(stance.distanceOffPlateMeters)
    || stance.distanceOffPlateMeters < 0
  ) {
    throw new Error(
      'distanceOffPlateMeters must be finite and non-negative',
    );
  }
  if (!Number.isFinite(stance.towardPitcherOffsetMeters)) {
    throw new Error(
      'towardPitcherOffsetMeters must be finite',
    );
  }
};

export const createBatterRunnerFirstBaseFrame = (
  input: BatterRunnerFirstBaseFrame,
): BatterRunnerFirstBaseFrame => {
  validateFrame(input);
  return {
    homePlateReferencePoint: {
      x: input.homePlateReferencePoint.x,
      z: input.homePlateReferencePoint.z,
    },
    firstBaseCenter: {
      x: input.firstBaseCenter.x,
      z: input.firstBaseCenter.z,
    },
    towardPitcherUnit: {
      x: input.towardPitcherUnit.x,
      z: input.towardPitcherUnit.z,
    },
    towardFirstBaseSideUnit: {
      x: input.towardFirstBaseSideUnit.x,
      z: input.towardFirstBaseSideUnit.z,
    },
    homePlateHalfWidthMeters: input.homePlateHalfWidthMeters,
  };
};

export const createBatterStanceGeometry = (
  side: ResolvedBatterSide,
  distanceOffPlateMeters: number,
  towardPitcherOffsetMeters: number,
): BatterStanceGeometry => {
  const stance: BatterStanceGeometry = {
    side,
    distanceOffPlateMeters,
    towardPitcherOffsetMeters,
  };
  validateStance(stance);
  return stance;
};

export const resolveBatterStanceWorldPosition = (
  frame: BatterRunnerFirstBaseFrame,
  stance: BatterStanceGeometry,
): Vec2 => {
  validateFrame(frame);
  validateStance(stance);

  const sideSign = stance.side === 'left' ? 1 : -1;
  const lateralMeters = (
    frame.homePlateHalfWidthMeters
    + stance.distanceOffPlateMeters
  ) * sideSign;

  return {
    x: (
      frame.homePlateReferencePoint.x
      + frame.towardPitcherUnit.x
        * stance.towardPitcherOffsetMeters
      + frame.towardFirstBaseSideUnit.x * lateralMeters
    ),
    z: (
      frame.homePlateReferencePoint.z
      + frame.towardPitcherUnit.z
        * stance.towardPitcherOffsetMeters
      + frame.towardFirstBaseSideUnit.z * lateralMeters
    ),
  };
};

export const getBatterRunnerDistanceToFirstBase = (
  frame: BatterRunnerFirstBaseFrame,
  stance: BatterStanceGeometry,
): number => {
  const start = resolveBatterStanceWorldPosition(frame, stance);
  return Math.hypot(
    frame.firstBaseCenter.x - start.x,
    frame.firstBaseCenter.z - start.z,
  );
};

export const createBatterRunnerFirstBaseRoute = (
  frame: BatterRunnerFirstBaseFrame,
  stance: BatterStanceGeometry,
  runThroughFirstBaseMeters: number,
): RunnerRoute => {
  if (
    !Number.isFinite(runThroughFirstBaseMeters)
    || runThroughFirstBaseMeters <= 0
  ) {
    throw new Error(
      'runThroughFirstBaseMeters must be finite and positive',
    );
  }

  const start = resolveBatterStanceWorldPosition(frame, stance);
  const dx = frame.firstBaseCenter.x - start.x;
  const dz = frame.firstBaseCenter.z - start.z;
  const distanceToFirst = Math.hypot(dx, dz);
  if (distanceToFirst <= EPSILON) {
    throw new Error(
      'batter stance position must differ from firstBaseCenter',
    );
  }

  const unit = {
    x: dx / distanceToFirst,
    z: dz / distanceToFirst,
  };
  const end = {
    x: (
      frame.firstBaseCenter.x
      + unit.x * runThroughFirstBaseMeters
    ),
    z: (
      frame.firstBaseCenter.z
      + unit.z * runThroughFirstBaseMeters
    ),
  };

  return {
    segments: [{
      kind: 'line',
      start,
      end,
    }],
  };
};
