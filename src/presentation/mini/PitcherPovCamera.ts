import type {
  Vec3,
} from '../../core/model/geometry';
import {
  MINI_LOGICAL_HEIGHT,
  MINI_LOGICAL_WIDTH,
  type BatPose,
} from './model';
import type {
  ProjectedBatPose,
  ProjectedPoint,
} from './BatterPovCamera';

export type PitcherPovCamera = Readonly<{
  eye: Vec3;
  focalLength: number;
  centerX: number;
  centerY: number;
  yaw: number;
  pitch: number;
}>;

export const createPitcherPovCamera = (
): PitcherPovCamera => ({
  eye: {
    x: 0,
    y: 1.28,
    z: -2.4,
  },
  focalLength: 68,
  centerX: MINI_LOGICAL_WIDTH / 2,
  centerY: 54,
  yaw: 0,
  pitch: 0.08,
});

export const projectWorldToPitcherPov = (
  point: Vec3,
): ProjectedPoint | null => {
  const camera = createPitcherPovCamera();

  const x = point.x - camera.eye.x;
  const y = point.y - camera.eye.y;
  const z = point.z - camera.eye.z;

  const sinYaw = Math.sin(camera.yaw);
  const cosYaw = Math.cos(camera.yaw);
  const sinPitch = Math.sin(camera.pitch);
  const cosPitch = Math.cos(camera.pitch);

  const side = cosYaw * x - sinYaw * z;
  const ahead = sinYaw * x + cosYaw * z;
  const up = cosPitch * y + sinPitch * ahead;
  const depth = (
    -sinPitch * y
    + cosPitch * ahead
  );

  if (depth < 0.1) {
    return null;
  }

  return {
    x: Math.round(
      camera.centerX
      + camera.focalLength * side / depth,
    ),
    y: Math.round(
      camera.centerY
      - camera.focalLength * up / depth,
    ),
    depth,
    apparentScale:
      camera.focalLength / depth,
  };
};

export const projectBatPoseToPitcherPov = (
  pose: BatPose,
): ProjectedBatPose => ({
  grip: projectWorldToPitcherPov(pose.grip),
  tip: projectWorldToPitcherPov(pose.tip),
});

export const isInsidePitcherPov = (
  point: ProjectedPoint,
): boolean => (
  point.x >= 0
  && point.x < MINI_LOGICAL_WIDTH
  && point.y >= 0
  && point.y < MINI_LOGICAL_HEIGHT
);
