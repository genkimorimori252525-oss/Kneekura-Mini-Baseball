import type {
  PlayerPhysicalProfile,
} from '../../model/PlayerPhysicalProfile';
import type {
  StrikeZoneRegion,
} from './TakenPitchPhysicalResult';

/**
 * Physical width of home plate: 17 inches.
 */
export const HOME_PLATE_WIDTH_METERS = 0.4318 as const;

/**
 * Current provisional Mini Baseball strike-zone policy.
 *
 * These ratios intentionally mirror the 2026 MLB ABS height-based zone
 * because the project has not yet committed to simulating batting-stance
 * body landmarks for every hitter. They are a deterministic product
 * approximation, not a claim that NPB's human rulebook zone is defined
 * by these percentages.
 */
export const HEIGHT_RATIO_V1_TOP_FRACTION = 0.535 as const;
export const HEIGHT_RATIO_V1_BOTTOM_FRACTION = 0.27 as const;

export type HeightRatioStrikeZoneInput = Readonly<{
  plateCenterX: number;
  playerPhysicalProfile: PlayerPhysicalProfile;
  homePlateWidthMeters?: number;
  topFraction?: number;
  bottomFraction?: number;
}>;

export type BatterStrikeZoneLandmarks = Readonly<{
  /**
   * World-space height of the top of the batter's shoulders while
   * prepared to swing at the pitch.
   */
  shoulderTopY: number;
  /**
   * World-space height of the top of the batter's uniform pants while
   * prepared to swing at the pitch.
   */
  uniformPantsTopY: number;
  /**
   * World-space height of the bottom of the batter's kneecap while
   * prepared to swing at the pitch.
   */
  kneecapBottomY: number;
}>;

export type LandmarkStrikeZoneInput = Readonly<{
  plateCenterX: number;
  landmarks: BatterStrikeZoneLandmarks;
  homePlateWidthMeters?: number;
}>;

/**
 * Backward-compatible name for the higher-fidelity batting-stance
 * landmark resolver. Current manager mode uses Height-Ratio V1 by
 * default, but this remains available for a future form-aware policy.
 */
export type RulebookStrikeZoneInput =
  LandmarkStrikeZoneInput;

export type StrikeZoneGeometryPolicyInput =
  | Readonly<{
      policy: 'height_ratio_v1';
      plateCenterX: number;
      playerPhysicalProfile: PlayerPhysicalProfile;
      homePlateWidthMeters?: number;
    }>
  | Readonly<{
      policy: 'batting_stance_landmarks';
      plateCenterX: number;
      landmarks: BatterStrikeZoneLandmarks;
      homePlateWidthMeters?: number;
    }>;

const validateFinite = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`);
  }
};

const resolveHalfWidth = (
  homePlateWidthMeters:
    number | undefined,
): number => {
  const width = (
    homePlateWidthMeters
    ?? HOME_PLATE_WIDTH_METERS
  );

  if (
    !Number.isFinite(width)
    || width <= 0
  ) {
    throw new Error(
      'homePlateWidthMeters must be finite and positive',
    );
  }

  return width / 2;
};

export const resolveHeightRatioStrikeZoneRegion = (
  input: HeightRatioStrikeZoneInput,
): StrikeZoneRegion => {
  validateFinite(
    'plateCenterX',
    input.plateCenterX,
  );

  const heightMeters =
    input.playerPhysicalProfile.heightMeters;
  if (
    !Number.isFinite(heightMeters)
    || heightMeters <= 0
  ) {
    throw new Error(
      'playerPhysicalProfile.heightMeters must be finite and positive',
    );
  }

  const topFraction = (
    input.topFraction
    ?? HEIGHT_RATIO_V1_TOP_FRACTION
  );
  const bottomFraction = (
    input.bottomFraction
    ?? HEIGHT_RATIO_V1_BOTTOM_FRACTION
  );

  if (
    !Number.isFinite(topFraction)
    || !Number.isFinite(bottomFraction)
    || topFraction <= bottomFraction
    || bottomFraction < 0
  ) {
    throw new Error(
      'strike-zone height fractions must be finite with topFraction > bottomFraction >= 0',
    );
  }

  return {
    centerX: input.plateCenterX,
    halfWidth: resolveHalfWidth(
      input.homePlateWidthMeters,
    ),
    lowerY:
      heightMeters * bottomFraction,
    upperY:
      heightMeters * topFraction,
  };
};

const validateLandmarks = (
  landmarks: BatterStrikeZoneLandmarks,
): void => {
  validateFinite(
    'shoulderTopY',
    landmarks.shoulderTopY,
  );
  validateFinite(
    'uniformPantsTopY',
    landmarks.uniformPantsTopY,
  );
  validateFinite(
    'kneecapBottomY',
    landmarks.kneecapBottomY,
  );

  if (
    landmarks.shoulderTopY
    <= landmarks.uniformPantsTopY
  ) {
    throw new Error(
      'shoulderTopY must be greater than uniformPantsTopY',
    );
  }

  if (
    landmarks.uniformPantsTopY
    <= landmarks.kneecapBottomY
  ) {
    throw new Error(
      'uniformPantsTopY must be greater than kneecapBottomY',
    );
  }
};

/**
 * Higher-fidelity future/form-aware resolver.
 *
 * The upper limit is the midpoint between shoulder top and uniform-pants
 * top; the lower limit is the kneecap bottom. It intentionally produces
 * the same StrikeZoneRegion contract as Height-Ratio V1 so downstream
 * pitch adjudication, umpire logic, replay and Presentation do not care
 * which source policy produced the zone.
 */
export const resolveLandmarkStrikeZoneRegion = (
  input: LandmarkStrikeZoneInput,
): StrikeZoneRegion => {
  validateFinite(
    'plateCenterX',
    input.plateCenterX,
  );
  validateLandmarks(input.landmarks);

  const upperY = (
    input.landmarks.shoulderTopY
    + input.landmarks.uniformPantsTopY
  ) / 2;
  const lowerY =
    input.landmarks.kneecapBottomY;

  if (upperY <= lowerY) {
    throw new Error(
      'resolved strike zone upperY must be greater than lowerY',
    );
  }

  return {
    centerX: input.plateCenterX,
    halfWidth: resolveHalfWidth(
      input.homePlateWidthMeters,
    ),
    lowerY,
    upperY,
  };
};

/**
 * Backward-compatible alias for the previously implemented landmark
 * resolver. Prefer the explicitly named policy resolver in new code.
 */
export const resolveRulebookStrikeZoneRegion =
  resolveLandmarkStrikeZoneRegion;

export const resolveStrikeZoneRegion = (
  input: StrikeZoneGeometryPolicyInput,
): StrikeZoneRegion => {
  if (input.policy === 'height_ratio_v1') {
    return resolveHeightRatioStrikeZoneRegion({
      plateCenterX: input.plateCenterX,
      playerPhysicalProfile:
        input.playerPhysicalProfile,
      homePlateWidthMeters:
        input.homePlateWidthMeters,
    });
  }

  return resolveLandmarkStrikeZoneRegion({
    plateCenterX: input.plateCenterX,
    landmarks: input.landmarks,
    homePlateWidthMeters:
      input.homePlateWidthMeters,
  });
};