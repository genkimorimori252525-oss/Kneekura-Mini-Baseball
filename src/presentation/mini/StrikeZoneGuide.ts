import type {
  Vec3,
} from '../../core/model/geometry';
import type {
  StrikeZoneRegion,
} from '../../core/sim/pitching/TakenPitchPhysicalResult';
import type {
  ProjectedPoint,
} from './BatterPovCamera';

export type StrikeZoneGuideGeometry = Readonly<{
  /**
   * Canonical world-space z plane used for the guide.
   * This should match the plate-crossing plane used by the pitch solver.
   */
  plateZ: number;
  region: StrikeZoneRegion;
}>;

export type ProjectedStrikeZoneGuide = Readonly<{
  source: StrikeZoneGuideGeometry;
  upperLeft: ProjectedPoint;
  upperRight: ProjectedPoint;
  lowerRight: ProjectedPoint;
  lowerLeft: ProjectedPoint;
}>;

export type StrikeZoneProjector = (
  point: Vec3,
) => ProjectedPoint | null;

const validateGuide = (
  guide: StrikeZoneGuideGeometry,
): void => {
  if (!Number.isFinite(guide.plateZ)) {
    throw new Error(
      'strike-zone guide plateZ must be finite',
    );
  }
  const { region } = guide;
  if (
    !Number.isFinite(region.centerX)
    || !Number.isFinite(region.halfWidth)
    || region.halfWidth <= 0
    || !Number.isFinite(region.lowerY)
    || !Number.isFinite(region.upperY)
    || region.upperY <= region.lowerY
  ) {
    throw new Error(
      'strike-zone guide region must be valid',
    );
  }
};

export const projectStrikeZoneGuide = (
  guide: StrikeZoneGuideGeometry,
  project: StrikeZoneProjector,
): ProjectedStrikeZoneGuide | null => {
  validateGuide(guide);

  const leftX = (
    guide.region.centerX
    - guide.region.halfWidth
  );
  const rightX = (
    guide.region.centerX
    + guide.region.halfWidth
  );

  const upperLeft = project({
    x: leftX,
    y: guide.region.upperY,
    z: guide.plateZ,
  });
  const upperRight = project({
    x: rightX,
    y: guide.region.upperY,
    z: guide.plateZ,
  });
  const lowerRight = project({
    x: rightX,
    y: guide.region.lowerY,
    z: guide.plateZ,
  });
  const lowerLeft = project({
    x: leftX,
    y: guide.region.lowerY,
    z: guide.plateZ,
  });

  if (
    upperLeft === null
    || upperRight === null
    || lowerRight === null
    || lowerLeft === null
  ) {
    return null;
  }

  return {
    source: guide,
    upperLeft,
    upperRight,
    lowerRight,
    lowerLeft,
  };
};