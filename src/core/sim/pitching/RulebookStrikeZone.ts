import type {
  StrikeZoneRegion,
} from './TakenPitchPhysicalResult';

export const HOME_PLATE_WIDTH_METERS = 0.4318 as const;

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

export type RulebookStrikeZoneInput = Readonly<{
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
 * Resolves the rulebook strike-zone geometry from the batter's actual
 * batting-stance body landmarks.
 *
 * The upper limit is the midpoint between the top of the shoulders and
 * the top of the uniform pants. The lower limit is the bottom of the
 * kneecap. Horizontal extent is the physical width of home plate.
 *
 * This geometry is shared by physical pitch adjudication and read-only
 * Presentation. Presentation must never feed a modified guide back into
 * this resolver or into pitch adjudication.
 */
export const resolveRulebookStrikeZoneRegion = (
  input: RulebookStrikeZoneInput,
): StrikeZoneRegion => {
  validateFinite(
    'plateCenterX',
    input.plateCenterX,
  );
  validateLandmarks(input.landmarks);

  const homePlateWidthMeters = (
    input.homePlateWidthMeters
    ?? HOME_PLATE_WIDTH_METERS
  );

  if (
    !Number.isFinite(homePlateWidthMeters)
    || homePlateWidthMeters <= 0
  ) {
    throw new Error(
      'homePlateWidthMeters must be finite and positive',
    );
  }

  const upperY = (
    input.landmarks.shoulderTopY
    + input.landmarks.uniformPantsTopY
  ) / 2;
  const lowerY = input.landmarks.kneecapBottomY;

  if (upperY <= lowerY) {
    throw new Error(
      'resolved strike zone upperY must be greater than lowerY',
    );
  }

  return {
    centerX: input.plateCenterX,
    halfWidth: homePlateWidthMeters / 2,
    lowerY,
    upperY,
  };
};