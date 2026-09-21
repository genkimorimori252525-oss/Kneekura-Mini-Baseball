import {
  BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
  type BaseballPhysicsArchitectureVersion,
} from './BaseballPhysicsV1';
import {
  createAtmosphericBaseballAerodynamics,
  type BaseballAtmosphere,
} from './BaseballAtmosphere';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
  type BallFlightParameters,
} from './BallFlight';
import type {
  BallSurfaceMaterialProfile,
} from './BallSurfaceMaterial';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
  type RigidBaseballProperties,
  type RigidBatBallContactParameterResolver,
} from '../contact/RigidBatBallContact';
import {
  resolveWoodBatSpeedResponse,
  validateWoodBatSpeedResponseProfile,
  type WoodBatSpeedResponseProfile,
} from '../contact/WoodBatSpeedResponseProfile';

export type BaseballRealityFieldMaterialsV1 = Readonly<{
  infieldDirt: BallSurfaceMaterialProfile;
  naturalGrass: BallSurfaceMaterialProfile;
  artificialTurf?: BallSurfaceMaterialProfile;
  warningTrack: BallSurfaceMaterialProfile;
  wall: BallSurfaceMaterialProfile;
}>;

export type BaseballRealityProfileV1 = Readonly<{
  architectureVersion:
    BaseballPhysicsArchitectureVersion;
  ball: RigidBaseballProperties;
  atmosphere: BaseballAtmosphere;
  woodBat:
    WoodBatSpeedResponseProfile;
  field:
    BaseballRealityFieldMaterialsV1;
  flightParameters:
    BallFlightParameters;
  woodBatParameterResolver:
    RigidBatBallContactParameterResolver;
}>;

export type BaseballRealityProfileV1Input =
  Readonly<{
    atmosphere: BaseballAtmosphere;
    woodBat:
      WoodBatSpeedResponseProfile;
    field:
      BaseballRealityFieldMaterialsV1;
    ball?: RigidBaseballProperties;
    integrationStepTicks?: number;
    ticksPerSecond?: number;
    gravityY?: number;
  }>;

const assertEvidenceIds = (
  name: string,
  evidenceIds: readonly string[],
): void => {
  if (
    evidenceIds.length === 0
    || evidenceIds.some(
      (id) => id.trim().length === 0,
    )
  ) {
    throw new Error(
      `${name} requires explicit evidenceIds`,
    );
  }
};

const validateMaterial = (
  name: string,
  material: BallSurfaceMaterialProfile,
): void => {
  if (
    material.materialId.length === 0
    || material.version.length === 0
  ) {
    throw new Error(
      `${name} material id/version must not be empty`,
    );
  }
};

export const createBaseballRealityProfileV1 = (
  input: BaseballRealityProfileV1Input,
): BaseballRealityProfileV1 => {
  validateWoodBatSpeedResponseProfile(
    input.woodBat,
  );
  assertEvidenceIds(
    'woodBat',
    input.woodBat.evidenceIds,
  );

  validateMaterial(
    'infieldDirt',
    input.field.infieldDirt,
  );
  validateMaterial(
    'naturalGrass',
    input.field.naturalGrass,
  );
  validateMaterial(
    'warningTrack',
    input.field.warningTrack,
  );
  validateMaterial(
    'wall',
    input.field.wall,
  );
  if (
    input.field.artificialTurf
    !== undefined
  ) {
    validateMaterial(
      'artificialTurf',
      input.field.artificialTurf,
    );
  }

  const ball =
    input.ball
    ?? REALISTIC_BASEBALL_RIGID_BODY;

  const aerodynamics =
    createAtmosphericBaseballAerodynamics({
      atmosphere:
        input.atmosphere,
      ballMassKg: ball.massKg,
      ballRadiusM: ball.radiusM,
    });

  const flightParameters:
    BallFlightParameters = {
      ...DEFAULT_BALL_FLIGHT_PARAMETERS,
      ticksPerSecond:
        input.ticksPerSecond
        ?? DEFAULT_BALL_FLIGHT_PARAMETERS
          .ticksPerSecond,
      integrationStepTicks:
        input.integrationStepTicks
        ?? DEFAULT_BALL_FLIGHT_PARAMETERS
          .integrationStepTicks,
      gravityY:
        input.gravityY
        ?? DEFAULT_BALL_FLIGHT_PARAMETERS
          .gravityY,
      ballRadius: ball.radiusM,
      aerodynamics,
      /**
       * Ground material remains contextual. A specific simulation selects
       * dirt/grass/turf from this reality bundle instead of silently using one
       * universal field surface.
       */
      groundSurfacePhysics: null,
    };

  return {
    architectureVersion:
      BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
    ball,
    atmosphere:
      input.atmosphere,
    woodBat:
      input.woodBat,
    field:
      input.field,
    flightParameters,
    woodBatParameterResolver:
      (kinematics) =>
        resolveWoodBatSpeedResponse(
          input.woodBat,
          kinematics
            .normalApproachSpeedMps,
        ),
  };
};

export const createRealityGroundFlightParameters = (
  profile: BaseballRealityProfileV1,
  material:
    BallSurfaceMaterialProfile,
): BallFlightParameters => ({
  ...profile.flightParameters,
  groundSurfacePhysics: {
    ball: profile.ball,
    material,
  },
});
