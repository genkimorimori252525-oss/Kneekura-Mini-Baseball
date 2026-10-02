import type { Vec3 } from '../../model/geometry';
import type {
  BallSurfaceContactParameters,
} from './BallSurfaceContact';
import {
  resolveBallSurfaceResponse,
  type BallSurfaceResponseProfile,
} from './BallSurfaceResponseProfile';
import {
  resolveBallSurfaceResponseGrid,
  type BallSurfaceResponseGrid,
} from './BallSurfaceResponseGrid';

export type BallSurfaceMaterialResponse =
  | Readonly<{
      kind: 'static';
      contact:
        BallSurfaceContactParameters;
    }>
  | Readonly<{
      kind: 'speed_profile';
      profile:
        BallSurfaceResponseProfile;
    }>
  | Readonly<{
      kind: 'angle_speed_grid';
      grid:
        BallSurfaceResponseGrid;
    }>;

export type BallSurfaceMaterialProfile = Readonly<{
  materialId: string;
  version: string;
  response:
    BallSurfaceMaterialResponse;
  /**
   * Optional post-impact sliding friction used by ground motion. Wall
   * materials can leave this absent.
   */
  slidingFrictionCoefficient?: number;
  /**
   * Optional rolling resistance represented as horizontal COM deceleration.
   * Only meaningful for supporting ground surfaces.
   */
  rollingDecelerationMps2?: number;
}>;

const magnitude = (
  value: Vec3,
): number => Math.hypot(
  value.x,
  value.y,
  value.z,
);

const dot = (
  a: Vec3,
  b: Vec3,
): number => (
  a.x * b.x
  + a.y * b.y
  + a.z * b.z
);

const normalize = (
  value: Vec3,
): Vec3 => {
  const length = magnitude(value);
  if (
    !Number.isFinite(length)
    || length <= 1e-12
  ) {
    throw new Error(
      'surface material normal must have finite non-zero length',
    );
  }
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
};

export const calculateSurfaceIncidenceAngleRadians = (
  incidentVelocity: Vec3,
  surfaceNormal: Vec3,
): number => {
  const speed = magnitude(
    incidentVelocity,
  );
  if (
    !Number.isFinite(speed)
    || speed <= 1e-12
  ) {
    throw new Error(
      'surface incidence angle requires non-zero finite incident velocity',
    );
  }

  const normal = normalize(
    surfaceNormal,
  );
  const inwardNormalSpeed =
    Math.max(
      0,
      -dot(
        incidentVelocity,
        normal,
      ),
    );
  const tangentSpeed =
    Math.sqrt(
      Math.max(
        0,
        speed * speed
        - inwardNormalSpeed
          * inwardNormalSpeed,
      ),
    );

  return Math.atan2(
    inwardNormalSpeed,
    tangentSpeed,
  );
};

export const validateBallSurfaceMaterialProfile = (
  material:
    BallSurfaceMaterialProfile,
): void => {
  if (material.materialId.length === 0) {
    throw new Error(
      'surface materialId must not be empty',
    );
  }
  if (material.version.length === 0) {
    throw new Error(
      'surface material version must not be empty',
    );
  }
  if (
    material.slidingFrictionCoefficient
      !== undefined
    && (
      !Number.isFinite(
        material.slidingFrictionCoefficient,
      )
      || material.slidingFrictionCoefficient
        < 0
    )
  ) {
    throw new Error(
      'surface material slidingFrictionCoefficient must be finite and non-negative',
    );
  }
  if (
    material.rollingDecelerationMps2
      !== undefined
    && (
      !Number.isFinite(
        material.rollingDecelerationMps2,
      )
      || material.rollingDecelerationMps2
        < 0
    )
  ) {
    throw new Error(
      'surface material rollingDecelerationMps2 must be finite and non-negative',
    );
  }
};

export const resolveBallSurfaceMaterialContact = (
  material:
    BallSurfaceMaterialProfile,
  incidentVelocity: Vec3,
  surfaceNormal: Vec3,
): BallSurfaceContactParameters => {
  validateBallSurfaceMaterialProfile(
    material,
  );

  const incidentSpeedMps =
    magnitude(incidentVelocity);
  if (
    !Number.isFinite(
      incidentSpeedMps,
    )
    || incidentSpeedMps <= 0
  ) {
    throw new Error(
      'surface material response requires positive incident speed',
    );
  }

  switch (
    material.response.kind
  ) {
    case 'static':
      return material.response.contact;

    case 'speed_profile':
      return resolveBallSurfaceResponse(
        material.response.profile,
        incidentSpeedMps,
      );

    case 'angle_speed_grid':
      return resolveBallSurfaceResponseGrid(
        material.response.grid,
        incidentSpeedMps,
        calculateSurfaceIncidenceAngleRadians(
          incidentVelocity,
          surfaceNormal,
        ),
      );

    default:
      throw new Error(
        'unreachable surface material response kind',
      );
  }
};
