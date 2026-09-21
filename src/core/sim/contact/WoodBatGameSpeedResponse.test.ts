import { describe, expect, it } from 'vitest';
import {
  WOOD_BAT_BBCOR_REFERENCE,
  WOOD_BAT_GAME_SPEED_MAX_MPS,
  WOOD_BAT_GAME_SPEED_MIN_MPS,
  createWoodBatGameSpeedContactCandidate,
  resolveWoodBatGameSpeedNormalRestitution,
} from './WoodBatGameSpeedResponse';

describe('wood bat game-speed response', () => {
  it('preserves the measured 60.8 m/s wood-bat anchor', () => {
    expect(
      resolveWoodBatGameSpeedNormalRestitution(
        60.8,
      ),
    ).toBeCloseTo(
      WOOD_BAT_BBCOR_REFERENCE
        .normalRestitution,
      12,
    );
  });

  it('decreases restitution with impact speed inside the evidence-supported high-speed range', () => {
    const slow =
      resolveWoodBatGameSpeedNormalRestitution(
        33,
      );
    const fast =
      resolveWoodBatGameSpeedNormalRestitution(
        67,
      );

    expect(slow).toBeGreaterThan(fast);
    expect(slow).toBeCloseTo(
      0.5004607718441699,
      12,
    );
    expect(fast).toBeCloseTo(
      0.4447437949875647,
      12,
    );
  });

  it('clamps rather than extrapolates beyond the measured high-speed regime', () => {
    expect(
      resolveWoodBatGameSpeedNormalRestitution(
        1,
      ),
    ).toBeCloseTo(
      resolveWoodBatGameSpeedNormalRestitution(
        WOOD_BAT_GAME_SPEED_MIN_MPS,
      ),
      12,
    );
    expect(
      resolveWoodBatGameSpeedNormalRestitution(
        100,
      ),
    ).toBeCloseTo(
      resolveWoodBatGameSpeedNormalRestitution(
        WOOD_BAT_GAME_SPEED_MAX_MPS,
      ),
      12,
    );
  });

  it('combines high-speed normal response with swinging-wood tangential evidence and conservative friction', () => {
    const candidate =
      createWoodBatGameSpeedContactCandidate({
        relativeImpactSpeedMps: 50,
      });

    expect(
      candidate.normalRestitution,
    ).toBeCloseTo(
      0.466975429949152,
      12,
    );
    expect(
      candidate.tangentialRestitution,
    ).toBeCloseTo(0.464, 12);
    expect(
      candidate.frictionCoefficient,
    ).toBeCloseTo(0.15, 12);
  });
});
