/**
 * User-approved display-only enlargement for the same canonical physical ball.
 *
 * A small distant pitch, fly or throw must remain legible on an intentionally
 * coarse PNG/B1 broadcast. The ball's collision radius, speed, location,
 * spin, catchability and rule judgments remain authoritative Core data.
 *
 * Unlike an explicit minimum on-screen diameter, this strictly increasing
 * curve never has a plateau at finite positive physical projection sizes.
 * It approaches zero with projection size, preserving a depth cue, but
 * expands distant subpixel baseballs so their apparent path stays visible.
 */
export type OpticalBallCamera = 'batter' | 'pitcher' | 'runner' | 'catcher' | 'overhead';

export type OpticalBaseballGlyph = Readonly<{
  /** Display-only apparent diameter; not an actual source ball radius. */
  diameterPx: number;
  /** True if a seam direction can use canonical spin/material orientation. */
  showSeams: boolean;
  /** Explicitly a read-only visual, never a physics or umpire input. */
  authority: 'PRESENTATION_ONLY';
}>;

const OVERHEAD_GAIN = 1.12;

export function opticalBallDiameterPx(
  physicalProjectedDiameterPx: number,
  camera: OpticalBallCamera,
): number {
  if (!Number.isFinite(physicalProjectedDiameterPx) || physicalProjectedDiameterPx < 0) {
    throw new Error('Optical baseball requires a non-negative finite projected diameter.');
  }
  if (!['batter', 'pitcher', 'runner', 'catcher', 'overhead'].includes(camera)) {
    throw new Error('Unknown broadcast camera for optical baseball.');
  }
  if (physicalProjectedDiameterPx === 0) return 0;
  const d = physicalProjectedDiameterPx;
  // Exponential contrast support + strictly positive d derivative (>=1.30).
  const apparent = 1.30 * d + 3.70 * -Math.expm1(-6 * d);
  return apparent * (camera === 'overhead' ? OVERHEAD_GAIN : 1);
}

export function createOpticalBaseballGlyph(input: Readonly<{
  projectedDiameterPx: number;
  camera: OpticalBallCamera;
  /** Orientation is physical evidence, not synthesized visual motion. */
  hasCanonicalOrientation: boolean;
}>): OpticalBaseballGlyph {
  const diameterPx = opticalBallDiameterPx(input.projectedDiameterPx, input.camera);
  return {
    diameterPx,
    showSeams: input.camera !== 'overhead' && diameterPx >= 4.1
      && input.hasCanonicalOrientation,
    authority: 'PRESENTATION_ONLY',
  };
}
