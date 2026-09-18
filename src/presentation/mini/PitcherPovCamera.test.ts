import { describe, expect, it } from 'vitest';
import {
  createPitcherPovCamera,
  projectWorldToPitcherPov,
} from './PitcherPovCamera';

describe('PitcherPovCamera', () => {
  it('places the observation eye behind home plate and looks toward the mound/field', () => {
    const camera = createPitcherPovCamera();

    expect(camera.eye.x).toBe(0);
    expect(camera.eye.z).toBeLessThan(0);
    expect(camera.centerX).toBe(75);
  });

  it('projects a center-line pitcher-side point near the screen center', () => {
    const projected = projectWorldToPitcherPov({
      x: 0,
      y: 1.5,
      z: 18,
    });

    expect(projected).not.toBeNull();
    if (projected === null) {
      throw new Error('fixture must project');
    }

    expect(projected.x).toBe(75);
    expect(projected.depth).toBeGreaterThan(0);
  });

  it('makes an incoming ball appear larger as it approaches the catcher eye', () => {
    const far = projectWorldToPitcherPov({
      x: 0,
      y: 1,
      z: 15,
    });
    const near = projectWorldToPitcherPov({
      x: 0,
      y: 1,
      z: 2,
    });

    expect(far).not.toBeNull();
    expect(near).not.toBeNull();
    if (far === null || near === null) {
      throw new Error('fixtures must project');
    }

    expect(near.apparentScale)
      .toBeGreaterThan(far.apparentScale);
  });
});
