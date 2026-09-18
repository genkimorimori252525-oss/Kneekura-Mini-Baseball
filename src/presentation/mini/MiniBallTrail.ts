import type {
  Vec3,
} from '../../core/model/geometry';
import type {
  CanonicalPresentationSample,
} from './model';
import {
  projectFieldOverheadWorldPoint,
  type FieldOverheadCameraCalibration,
  type MiniScreenPoint,
} from './FieldOverheadProjection';

export type MiniBallTrailPoint = Readonly<{
  tick: number;
  worldPosition: Vec3;
  screenPosition: MiniScreenPoint;
  altitudeMeters: number;
}>;

export type MiniBallTrailInput = Readonly<{
  history: readonly CanonicalPresentationSample[];
  currentTick: number;
  camera: FieldOverheadCameraCalibration;
  maximumTrailPoints: number;
}>;

export const buildMiniBallTrail = (
  input: MiniBallTrailInput,
): readonly MiniBallTrailPoint[] => {
  if (
    !Number.isSafeInteger(input.currentTick)
    || input.currentTick < 0
  ) {
    throw new Error(
      'currentTick must be a non-negative safe integer',
    );
  }
  if (
    !Number.isSafeInteger(input.maximumTrailPoints)
    || input.maximumTrailPoints < 0
  ) {
    throw new Error(
      'maximumTrailPoints must be a non-negative safe integer',
    );
  }
  if (input.maximumTrailPoints === 0) {
    return [];
  }

  const eligible = input.history
    .filter((sample) => (
      sample.world.tick < input.currentTick
      && sample.world.ball !== null
    ))
    .sort((first, second) => (
      first.world.tick - second.world.tick
    ))
    .slice(-input.maximumTrailPoints);

  return eligible.map((sample) => {
    const ball = sample.world.ball;
    if (ball === null) {
      throw new Error(
        'filtered trail sample unexpectedly lost ball state',
      );
    }

    return {
      tick: sample.world.tick,
      worldPosition: {
        x: ball.position.x,
        y: ball.position.y,
        z: ball.position.z,
      },
      screenPosition:
        projectFieldOverheadWorldPoint(
          {
            x: ball.position.x,
            z: ball.position.z,
          },
          input.camera,
        ),
      altitudeMeters: ball.position.y,
    };
  });
};
