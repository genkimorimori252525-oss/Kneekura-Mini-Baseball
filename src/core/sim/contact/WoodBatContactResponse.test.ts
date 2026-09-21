import { describe, expect, it } from 'vitest';
import {
  WOOD_BAT_CONTACT_RESPONSE_CANDIDATE_VERSION,
  createEvidenceBackedWoodBatContactParameters,
  resolveWoodBatNormalRestitution,
} from './WoodBatContactResponse';

describe('evidence-backed wood bat contact response', () => {
  it('preserves both measured normal-COR endpoints and clamps outside evidence', () => {
    expect(
      resolveWoodBatNormalRestitution(0),
    ).toBeCloseTo(0.63, 12);
    expect(
      resolveWoodBatNormalRestitution(4),
    ).toBeCloseTo(0.63, 12);
    expect(
      resolveWoodBatNormalRestitution(60.8),
    ).toBeCloseTo(0.452, 12);
    expect(
      resolveWoodBatNormalRestitution(100),
    ).toBeCloseTo(0.452, 12);
  });

  it('interpolates only inside the explicit evidence interval', () => {
    const midpoint =
      (4 + 60.8) / 2;

    expect(
      resolveWoodBatNormalRestitution(
        midpoint,
      ),
    ).toBeCloseTo(
      (0.63 + 0.452) / 2,
      12,
    );
  });

  it('combines the wood-bat tangential measurement with explicit friction rather than inventing friction', () => {
    const parameters =
      createEvidenceBackedWoodBatContactParameters({
        relativeImpactSpeedMps: 50,
        frictionCoefficient: 0.2,
      });

    expect(
      parameters.tangentialRestitution,
    ).toBeCloseTo(0.464, 12);
    expect(
      parameters.frictionCoefficient,
    ).toBeCloseTo(0.2, 12);
    expect(
      parameters.normalRestitution,
    ).toBeGreaterThan(0.452);
    expect(
      parameters.normalRestitution,
    ).toBeLessThan(0.63);
  });

  it('rejects friction below the game-speed experimental lower bound', () => {
    expect(() =>
      createEvidenceBackedWoodBatContactParameters({
        relativeImpactSpeedMps: 50,
        frictionCoefficient: 0.149,
      }),
    ).toThrow(
      'wood-bat frictionCoefficient must satisfy the game-speed experimental lower bound',
    );
  });

  it('is explicitly versioned as a provisional evidence synthesis', () => {
    expect(
      WOOD_BAT_CONTACT_RESPONSE_CANDIDATE_VERSION,
    ).toBe(
      'wood-bat-contact-evidence-synthesis-v1',
    );
  });
});
