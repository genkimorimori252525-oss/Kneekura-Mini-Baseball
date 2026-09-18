import { describe, expect, it } from 'vitest';
import {
  evaluateObservationGeometry,
  type ObservationGeometryParameters,
  type ObserverViewState,
  type ObservationTargetTruth,
} from './ObservationGeometry';

const parameters: ObservationGeometryParameters = {
  fullQualityHalfAngleRadians: Math.PI / 9, // 20 deg
  maxVisibleHalfAngleRadians: Math.PI / 3, // 60 deg
  fullQualityDistanceMeters: 10,
  maxObservableDistanceMeters: 50,
  fullQualityRelativeSpeedMps: 5,
  maxRelativeSpeedMps: 25,
};

const observer: ObserverViewState = {
  position: { x: 0, y: 1.7, z: 0 },
  forward: { x: 0, y: 0, z: 1 },
  velocity: { x: 0, y: 0, z: 0 },
};

const targetAtAngle = (
  angleRadians: number,
  distanceMeters: number,
  velocity = { x: 0, y: 0, z: 0 },
): ObservationTargetTruth => ({
  position: {
    x: Math.sin(angleRadians) * distanceMeters,
    y: 1.7,
    z: Math.cos(angleRadians) * distanceMeters,
  },
  velocity,
});

describe('evaluateObservationGeometry', () => {
  it('gives full geometry quality to a nearby stationary target straight ahead', () => {
    const result = evaluateObservationGeometry(
      observer,
      targetAtAngle(0, 10),
      parameters,
    );

    expect(result.distanceMeters).toBeCloseTo(10, 12);
    expect(result.offAxisAngleRadians).toBeCloseTo(0, 12);
    expect(result.relativeSpeedMps).toBeCloseTo(0, 12);
    expect(result.fovQuality).toBe(1);
    expect(result.distanceQuality).toBe(1);
    expect(result.relativeSpeedQuality).toBe(1);
  });

  it('interpolates FOV quality between full-quality and maximum half-angles', () => {
    const result = evaluateObservationGeometry(
      observer,
      targetAtAngle(Math.PI / 6, 10), // 30 deg
      parameters,
    );

    expect(result.offAxisAngleRadians).toBeCloseTo(Math.PI / 6, 12);
    expect(result.fovQuality).toBeCloseTo(0.75, 12);
  });

  it('makes a target outside the configured FOV causally invisible', () => {
    const result = evaluateObservationGeometry(
      observer,
      targetAtAngle((70 * Math.PI) / 180, 10),
      parameters,
    );

    expect(result.fovQuality).toBe(0);
  });

  it('degrades distance quality only after the configured full-quality distance', () => {
    const result = evaluateObservationGeometry(
      observer,
      targetAtAngle(0, 30),
      parameters,
    );

    expect(result.distanceQuality).toBeCloseTo(0.5, 12);
  });

  it('degrades relative-speed quality from physical relative velocity', () => {
    const result = evaluateObservationGeometry(
      observer,
      targetAtAngle(0, 10, { x: 15, y: 0, z: 0 }),
      parameters,
    );

    expect(result.relativeSpeedMps).toBeCloseTo(15, 12);
    expect(result.relativeSpeedQuality).toBeCloseTo(0.5, 12);
  });

  it('rejects a zero observer forward vector', () => {
    expect(() => evaluateObservationGeometry(
      { ...observer, forward: { x: 0, y: 0, z: 0 } },
      targetAtAngle(0, 10),
      parameters,
    )).toThrow('observer forward vector must be non-zero');
  });
});
