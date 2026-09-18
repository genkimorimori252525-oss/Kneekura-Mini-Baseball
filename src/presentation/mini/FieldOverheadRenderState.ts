import type {
  DefensiveAssignment,
  DefensivePosition,
} from '../../core/model/CanonicalWorldSnapshot';
import {
  REFERENCE_PLAYER_HEIGHT_METERS,
  type PlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';
import type {
  Vec2,
  Vec3,
} from '../../core/model/geometry';
import type {
  CanonicalPresentationSample,
} from './model';
import {
  DEFAULT_MINI_PLAYER_DOT_SIZE_CALIBRATION,
  deriveMiniPlayerDotPresentationProfile,
  type MiniPlayerDotSizeCalibration,
} from './PlayerDotProfile';

export type MiniScreenPoint = Readonly<{
  x: number;
  y: number;
}>;

export type FieldOverheadCameraCalibration = Readonly<{
  worldOrigin: Vec2;
  viewportCenter: MiniScreenPoint;
  logicalPixelsPerMeter: number;
}>;

export type FieldOverheadDefenderPoint = Readonly<{
  playerId: string;
  registeredPosition: DefensivePosition;
  worldPosition: Vec2;
  screenPosition: MiniScreenPoint;
  assignment: DefensiveAssignment;
  diameterPixels: number;
  sizeSource: 'reference' | 'physical_profile';
}>;

export type FieldOverheadRunnerPoint = Readonly<{
  playerId: string;
  worldPosition: Vec2;
  screenPosition: MiniScreenPoint;
  diameterPixels: number;
  sizeSource: 'reference' | 'physical_profile';
}>;

export type FieldOverheadBallPoint = Readonly<{
  worldPosition: Vec3;
  screenPosition: MiniScreenPoint;
  altitudeMeters: number;
  heightTier: MiniBallHeightTier;
  diameterPixels: number;
}>;

export type FieldOverheadRenderState = Readonly<{
  tick: number;
  defenders: readonly FieldOverheadDefenderPoint[];
  runners: readonly FieldOverheadRunnerPoint[];
  ball: FieldOverheadBallPoint | null;
}>;

export type FieldOverheadRenderStateInput = Readonly<{
  sample: CanonicalPresentationSample;
  camera: FieldOverheadCameraCalibration;
  playerPhysicalProfiles?: Readonly<
    Partial<Record<string, PlayerPhysicalProfile>>
  >;
  dotCalibration?: MiniPlayerDotSizeCalibration;
  ballHeightCalibration?: MiniBallHeightCalibration;
}>;

const validateFinite = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${name} must be finite`,
    );
  }
};

const validateCamera = (
  camera: FieldOverheadCameraCalibration,
): void => {
  validateFinite(
    'camera.worldOrigin.x',
    camera.worldOrigin.x,
  );
  validateFinite(
    'camera.worldOrigin.z',
    camera.worldOrigin.z,
  );
  validateFinite(
    'camera.viewportCenter.x',
    camera.viewportCenter.x,
  );
  validateFinite(
    'camera.viewportCenter.y',
    camera.viewportCenter.y,
  );
  if (
    !Number.isFinite(camera.logicalPixelsPerMeter)
    || camera.logicalPixelsPerMeter <= 0
  ) {
    throw new Error(
      'camera.logicalPixelsPerMeter must be finite and positive',
    );
  }
};

export const projectFieldOverheadWorldPoint = (
  world: Vec2,
  camera: FieldOverheadCameraCalibration,
): MiniScreenPoint => ({
  x: (
    camera.viewportCenter.x
    + (
      world.x - camera.worldOrigin.x
    ) * camera.logicalPixelsPerMeter
  ),
  y: (
    camera.viewportCenter.y
    - (
      world.z - camera.worldOrigin.z
    ) * camera.logicalPixelsPerMeter
  ),
});

const diameterForPlayer = (
  playerId: string,
  profiles: FieldOverheadRenderStateInput[
    'playerPhysicalProfiles'
  ],
  calibration: MiniPlayerDotSizeCalibration,
): Readonly<{
  diameterPixels: number;
  sizeSource: 'reference' | 'physical_profile';
}> => {
  const profile = profiles?.[playerId];
  if (profile !== undefined) {
    return {
      diameterPixels:
        deriveMiniPlayerDotPresentationProfile(
          profile,
          calibration,
        ).diameterPixels,
      sizeSource: 'physical_profile',
    };
  }

  const referenceProfile:
    PlayerPhysicalProfile = {
      heightMeters:
        REFERENCE_PLAYER_HEIGHT_METERS,
    };
  const reference =
    deriveMiniPlayerDotPresentationProfile(
      referenceProfile,
      calibration,
    );

  return {
    diameterPixels: reference.diameterPixels,
    sizeSource: 'reference',
  };
};

export const buildFieldOverheadRenderState = (
  input: FieldOverheadRenderStateInput,
): FieldOverheadRenderState => {
  validateCamera(input.camera);

  const dotCalibration = (
    input.dotCalibration
    ?? DEFAULT_MINI_PLAYER_DOT_SIZE_CALIBRATION
  );

  const defenders = input.sample.world.defenders.map(
    (defender) => {
      const size = diameterForPlayer(
        defender.playerId,
        input.playerPhysicalProfiles,
        dotCalibration,
      );

      return {
        playerId: defender.playerId,
        registeredPosition:
          defender.registeredPosition,
        worldPosition: {
          x: defender.position.x,
          z: defender.position.z,
        },
        screenPosition: projectFieldOverheadWorldPoint(
          defender.position,
          input.camera,
        ),
        assignment: defender.assignment,
        ...size,
      };
    },
  );

  const runners = input.sample.world.runners.map(
    (runner) => {
      const size = diameterForPlayer(
        runner.playerId,
        input.playerPhysicalProfiles,
        dotCalibration,
      );

      return {
        playerId: runner.playerId,
        worldPosition: {
          x: runner.position.x,
          z: runner.position.z,
        },
        screenPosition: projectFieldOverheadWorldPoint(
          runner.position,
          input.camera,
        ),
        ...size,
      };
    },
  );

  const ball = input.sample.world.ball === null
    ? null
    : (() => {
        const height =
          deriveMiniBallHeightPresentationProfile(
            input.sample.world.ball.position.y,
            input.ballHeightCalibration
              ?? DEFAULT_MINI_BALL_HEIGHT_CALIBRATION,
          );

        return {
          worldPosition: {
            x: input.sample.world.ball.position.x,
            y: input.sample.world.ball.position.y,
            z: input.sample.world.ball.position.z,
          },
          screenPosition: projectFieldOverheadWorldPoint(
            {
              x: input.sample.world.ball.position.x,
              z: input.sample.world.ball.position.z,
            },
            input.camera,
          ),
          altitudeMeters:
            input.sample.world.ball.position.y,
          heightTier: height.heightTier,
          diameterPixels: height.diameterPixels,
        };
      })();

  return {
    tick: input.sample.world.tick,
    defenders,
    runners,
    ball,
  };
};
