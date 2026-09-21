import type {
  BallSurfaceContactParameters,
} from './BallSurfaceContact';
import {
  resolveBallSurfaceResponse,
  validateBallSurfaceResponseProfile,
  type BallSurfaceResponseKnot,
} from './BallSurfaceResponseProfile';

export type BallSurfaceAngleResponseRow = Readonly<{
  incidenceAngleRadians: number;
  speedKnots: readonly BallSurfaceResponseKnot[];
}>;

export type BallSurfaceResponseGrid = Readonly<{
  profileId: string;
  version: string;
  angleRows: readonly BallSurfaceAngleResponseRow[];
}>;

const lerp = (
  a: number,
  b: number,
  t: number,
): number => (
  a + (b - a) * t
);

const interpolateContact = (
  a: BallSurfaceContactParameters,
  b: BallSurfaceContactParameters,
  t: number,
): BallSurfaceContactParameters => ({
  normalRestitution: lerp(
    a.normalRestitution,
    b.normalRestitution,
    t,
  ),
  tangentialRestitution: lerp(
    a.tangentialRestitution,
    b.tangentialRestitution,
    t,
  ),
  frictionCoefficient: lerp(
    a.frictionCoefficient,
    b.frictionCoefficient,
    t,
  ),
});

export const validateBallSurfaceResponseGrid = (
  grid: BallSurfaceResponseGrid,
): void => {
  if (grid.profileId.length === 0) {
    throw new Error(
      'surface response grid profileId must not be empty',
    );
  }
  if (grid.version.length === 0) {
    throw new Error(
      'surface response grid version must not be empty',
    );
  }
  if (grid.angleRows.length === 0) {
    throw new Error(
      'surface response grid requires at least one incidence-angle row',
    );
  }

  let previousAngle = -Infinity;
  for (const row of grid.angleRows) {
    if (
      !Number.isFinite(
        row.incidenceAngleRadians,
      )
      || row.incidenceAngleRadians <= 0
      || row.incidenceAngleRadians > Math.PI / 2
      || row.incidenceAngleRadians
        <= previousAngle
    ) {
      throw new Error(
        'surface response incidence angles must be finite, within (0, pi/2], and strictly increasing',
      );
    }

    validateBallSurfaceResponseProfile({
      profileId:
        `${grid.profileId}:angle:${row.incidenceAngleRadians}`,
      version: grid.version,
      knots: row.speedKnots,
    });

    previousAngle =
      row.incidenceAngleRadians;
  }
};

const resolveRow = (
  grid: BallSurfaceResponseGrid,
  row: BallSurfaceAngleResponseRow,
  incidentSpeedMps: number,
): BallSurfaceContactParameters => (
  resolveBallSurfaceResponse(
    {
      profileId:
        `${grid.profileId}:angle:${row.incidenceAngleRadians}`,
      version: grid.version,
      knots: row.speedKnots,
    },
    incidentSpeedMps,
  )
);

/**
 * Deterministic bilinear-style calibration lookup.
 *
 * Speed is interpolated inside each surrounding angle row, then contact
 * parameters are interpolated across incidence angle. Inputs outside the
 * calibrated angle/speed ranges clamp to the nearest edge; they are never
 * silently extrapolated.
 */
export const resolveBallSurfaceResponseGrid = (
  grid: BallSurfaceResponseGrid,
  incidentSpeedMps: number,
  incidenceAngleRadians: number,
): BallSurfaceContactParameters => {
  validateBallSurfaceResponseGrid(grid);

  if (
    !Number.isFinite(incidentSpeedMps)
    || incidentSpeedMps < 0
  ) {
    throw new Error(
      'surface response grid incidentSpeedMps must be finite and non-negative',
    );
  }
  if (
    !Number.isFinite(
      incidenceAngleRadians,
    )
    || incidenceAngleRadians < 0
    || incidenceAngleRadians > Math.PI / 2
  ) {
    throw new Error(
      'surface response grid incidence angle must be finite within [0, pi/2]',
    );
  }

  const first = grid.angleRows[0]!;
  if (
    incidenceAngleRadians
    <= first.incidenceAngleRadians
  ) {
    return resolveRow(
      grid,
      first,
      incidentSpeedMps,
    );
  }

  const last =
    grid.angleRows[
      grid.angleRows.length - 1
    ]!;
  if (
    incidenceAngleRadians
    >= last.incidenceAngleRadians
  ) {
    return resolveRow(
      grid,
      last,
      incidentSpeedMps,
    );
  }

  for (
    let index = 1;
    index < grid.angleRows.length;
    index += 1
  ) {
    const right =
      grid.angleRows[index]!;
    if (
      incidenceAngleRadians
      > right.incidenceAngleRadians
    ) {
      continue;
    }

    const left =
      grid.angleRows[index - 1]!;
    const leftContact =
      resolveRow(
        grid,
        left,
        incidentSpeedMps,
      );
    const rightContact =
      resolveRow(
        grid,
        right,
        incidentSpeedMps,
      );

    const t = (
      incidenceAngleRadians
      - left.incidenceAngleRadians
    ) / (
      right.incidenceAngleRadians
      - left.incidenceAngleRadians
    );

    return interpolateContact(
      leftContact,
      rightContact,
      t,
    );
  }

  throw new Error(
    'unreachable surface response grid interval',
  );
};
