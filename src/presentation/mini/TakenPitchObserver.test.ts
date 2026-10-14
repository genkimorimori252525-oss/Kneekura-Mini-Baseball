import { describe, expect, it } from 'vitest';
import { blendObservedBallGaze, lookAtObservedBall, observedTakenPitchProgress } from './TakenPitchObserver';

describe('taken pitch batter POV', () => {
  it('rotates toward real catcher-reception position behind the strike zone', () => {
    const eye = { x: 0, y: 1.55, z: -0.9 };
    const plate = lookAtObservedBall(eye, { x: -0.2, y: 0.82, z: 0 });
    const catcher = lookAtObservedBall(eye, { x: -0.2, y: 1.02, z: -1.9 });
    expect(Math.abs(catcher.yaw - plate.yaw)).toBeGreaterThan(2);
    expect(catcher.pitch).toBeGreaterThan(0);
    expect(observedTakenPitchProgress(38, 38, 43)).toBe(0);
    expect(observedTakenPitchProgress(43, 38, 43)).toBe(1);
    expect(observedTakenPitchProgress(50, 38, 43)).toBe(1);
    expect(blendObservedBallGaze(plate, catcher, 1)).toEqual(catcher);
  });
  it('always turns via the short direction and never mutates canonical ball', () => {
    const source = { yaw: Math.PI - 0.1, pitch: 0.05 };
    const destination = { yaw: -Math.PI + 0.1, pitch: 0.2 };
    const result = blendObservedBallGaze(source, destination, 0.5);
    expect(result.yaw).toBeGreaterThan(source.yaw);
    expect(result.pitch).toBeCloseTo(0.125);
    expect(source.yaw).toBe(Math.PI - 0.1);
    expect(() => observedTakenPitchProgress(3, 5, 5)).toThrow();
  });
});
