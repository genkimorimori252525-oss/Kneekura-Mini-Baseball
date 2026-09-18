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

import {
  projectFieldOverheadWorldPoint,
  validateFieldOverheadCamera,
  type FieldOverheadCameraCalibration,
  type MiniScreenPoint,
} from './FieldOverheadProjection';

export type {
  FieldOverheadCameraCalibration,
  MiniScreenPoint,
} from './FieldOverheadProjection';

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
  ballTrail: readonly MiniBallTrailPoint[];
}>;

export type FieldOverheadRenderStateInput = Readonly<{
  sample: CanonicalPresentationSample;
  camera: FieldOverheadCameraCalibration;
  playerPhysicalProfiles?: Readonly<
    Partial<Record<string, PlayerPhysicalProfile>>
  >;
  dotCalibration?: MiniPlayerDotSizeCalibration;
  ballHeightCalibration?: MiniBallHeightCalibration;
  historySamples?: readonly CanonicalPresentationSample[];
  maximumBallTrailPoints?: number;
}>;

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
  validateFieldOverheadCamera(input.camera);

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

  const ballTrail = buildMiniBallTrail({
    history: input.historySamples ?? [],
    currentTick: input.sample.world.tick,
    camera: input.camera,
    maximumTrailPoints:
      input.maximumBallTrailPoints ?? 4,
  });

  return {
    tick: input.sample.world.tick,
    defenders,
    runners,
    ball,
    ballTrail,
  };
};
