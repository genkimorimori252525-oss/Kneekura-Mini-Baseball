import type { Vec3 } from '../../core/model/geometry';
import {
  MINI_LOGICAL_HEIGHT,
  MINI_LOGICAL_WIDTH,
  type BatPose,
  type BatterHandedness,
} from './model';

export type BatterPovCamera = Readonly<{
  eye: Vec3;
  focalLength: number;
  centerX: number;
  centerY: number;
  yaw: number;
  pitch: number;
}>;

export type ProjectedPoint = Readonly<{
  x: number;
  y: number;
  depth: number;
  apparentScale: number;
}>;

export type ProjectedBatPose = Readonly<{
  grip: ProjectedPoint | null;
  tip: ProjectedPoint | null;
}>;

export function createBatterPovCamera(handedness: BatterHandedness): BatterPovCamera {
  const eyeX = handedness === 'R' ? -0.62 : 0.62;
  return {
    eye: { x: eyeX, y: 1.62, z: -1.8 },
    focalLength: 65,
    centerX: MINI_LOGICAL_WIDTH / 2,
    centerY: 52,
    yaw: Math.atan2(-eyeX, 6),
    pitch: 0.25,
  };
}

export function projectWorldToBatterPov(
  point: Vec3,
  handedness: BatterHandedness,
): ProjectedPoint | null {
  const camera = createBatterPovCamera(handedness);
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
  const depth = -sinPitch * y + cosPitch * ahead;

  if (depth < 0.1) return null;

  return {
    x: Math.round(camera.centerX + (camera.focalLength * side) / depth),
    y: Math.round(camera.centerY - (camera.focalLength * up) / depth),
    depth,
    apparentScale: camera.focalLength / depth,
  };
}

export function projectBatPoseToBatterPov(
  pose: BatPose,
  handedness: BatterHandedness,
): ProjectedBatPose {
  return {
    grip: projectWorldToBatterPov(pose.grip, handedness),
    tip: projectWorldToBatterPov(pose.tip, handedness),
  };
}

export function isInsideBatterPov(point: ProjectedPoint): boolean {
  return point.x >= 0 && point.x < MINI_LOGICAL_WIDTH && point.y >= 0 && point.y < MINI_LOGICAL_HEIGHT;
}
