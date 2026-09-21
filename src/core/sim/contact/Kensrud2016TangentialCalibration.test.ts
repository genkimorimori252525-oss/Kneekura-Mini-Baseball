import { describe, expect, it } from 'vitest';
import {
  KENSRUD_2016_BASEBALL_TANGENTIAL_COR_REFERENCES,
  KENSRUD_2016_GAME_SPEED_CONTEXT,
  findKensrud2016TangentialReference,
} from './Kensrud2016TangentialCalibration';

describe('Kensrud/Nathan/Smith game-speed tangential calibration evidence', () => {
  it('records the baseball-average tangential COR from swinging-bat experiments', () => {
    const average =
      findKensrud2016TangentialReference(
        'all_baseball_bats',
      );

    expect(
      average.tangentialRestitution,
    ).toBeCloseTo(0.405, 12);
    expect(average.standardError)
      .toBeCloseTo(0.010, 12);
  });

  it('preserves the measured wood-bat tangential response separately from metal bats', () => {
    const wood =
      findKensrud2016TangentialReference(
        'wood',
      );
    const rough =
      findKensrud2016TangentialReference(
        'metal_rough',
      );
    const smooth =
      findKensrud2016TangentialReference(
        'metal_smooth',
      );

    expect(
      wood.tangentialRestitution,
    ).toBeCloseTo(0.464, 12);
    expect(
      wood.tangentialRestitution,
    ).toBeGreaterThan(
      rough.tangentialRestitution,
    );
    expect(
      wood.tangentialRestitution,
    ).toBeGreaterThan(
      smooth.tangentialRestitution,
    );
  });

  it('records the game-representative swing-speed context and only a friction lower bound', () => {
    expect(
      KENSRUD_2016_GAME_SPEED_CONTEXT
        .minimumBatSpeedMps,
    ).toBe(28);
    expect(
      KENSRUD_2016_GAME_SPEED_CONTEXT
        .maximumBatSpeedMps,
    ).toBe(39);
    expect(
      KENSRUD_2016_GAME_SPEED_CONTEXT
        .frictionCoefficientLowerBound,
    ).toBe(0.15);
  });

  it('does not disguise the evidence registry as a complete friction/contact preset', () => {
    for (
      const reference
      of KENSRUD_2016_BASEBALL_TANGENTIAL_COR_REFERENCES
    ) {
      expect(
        Object.prototype.hasOwnProperty.call(
          reference,
          'frictionCoefficient',
        ),
      ).toBe(false);
    }
  });
});
