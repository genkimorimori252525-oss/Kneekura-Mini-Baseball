import type {
  Vec2,
} from '../../core/model/geometry';

export type MiniScreenPoint = Readonly<{
  x: number;
  y: number;
}>;

export type FieldOverheadCameraCalibration = Readonly<{
  worldOrigin: Vec2;
  viewportCenter: MiniScreenPoint;
  logicalPixelsPerMeter: number;
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

export const validateFieldOverheadCamera = (
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
