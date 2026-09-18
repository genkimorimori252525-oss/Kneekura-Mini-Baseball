import {
  findPitchPlateCrossing,
  type PitchPlateCrossing,
  type PitchTrajectorySegment,
} from './PitchTrajectory';

export type StrikeZoneRegion = Readonly<{
  centerX: number;
  halfWidth: number;
  lowerY: number;
  upperY: number;
}>;

export type TakenPitchPhysicalResult = Readonly<{
  kind: 'ball' | 'called_strike';
  crossing: PitchPlateCrossing;
  geometry: Readonly<{
    overlapsHorizontalZone: boolean;
    overlapsVerticalZone: boolean;
  }>;
}>;

export type TakenPitchPhysicalInput = Readonly<{
  trajectory: PitchTrajectorySegment;
  plateZ: number;
  strikeZone: StrikeZoneRegion;
  ballRadiusMeters: number;
}>;

const validateZone = (
  zone: StrikeZoneRegion,
): void => {
  if (
    !Number.isFinite(zone.centerX)
    || !Number.isFinite(zone.halfWidth)
    || zone.halfWidth <= 0
  ) {
    throw new Error(
      'strike zone centerX/halfWidth must be finite and halfWidth positive',
    );
  }
  if (
    !Number.isFinite(zone.lowerY)
    || !Number.isFinite(zone.upperY)
    || zone.upperY <= zone.lowerY
  ) {
    throw new Error(
      'strike zone upperY must be greater than lowerY',
    );
  }
};

export const resolveTakenPitchPhysicalResult = (
  input: TakenPitchPhysicalInput,
): TakenPitchPhysicalResult | null => {
  validateZone(input.strikeZone);

  if (
    !Number.isFinite(input.ballRadiusMeters)
    || input.ballRadiusMeters <= 0
  ) {
    throw new Error(
      'ballRadiusMeters must be finite and positive',
    );
  }

  const crossing = findPitchPlateCrossing(
    input.trajectory,
    input.plateZ,
  );
  if (crossing === null) {
    return null;
  }

  const horizontalMin = (
    input.strikeZone.centerX
    - input.strikeZone.halfWidth
  );
  const horizontalMax = (
    input.strikeZone.centerX
    + input.strikeZone.halfWidth
  );

  const overlapsHorizontalZone = (
    crossing.position.x + input.ballRadiusMeters
      >= horizontalMin
    && crossing.position.x - input.ballRadiusMeters
      <= horizontalMax
  );
  const overlapsVerticalZone = (
    crossing.position.y + input.ballRadiusMeters
      >= input.strikeZone.lowerY
    && crossing.position.y - input.ballRadiusMeters
      <= input.strikeZone.upperY
  );

  return {
    kind: (
      overlapsHorizontalZone
      && overlapsVerticalZone
    )
      ? 'called_strike'
      : 'ball',
    crossing,
    geometry: {
      overlapsHorizontalZone,
      overlapsVerticalZone,
    },
  };
};
