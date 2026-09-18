import { describe, expect, it } from 'vitest';
import {
  createInfieldBoundaryRegion,
  isFootDiscFullyInsideInfieldBoundary,
} from './InfieldBoundaryRegion';

describe('infield boundary region', () => {
  const square = () => createInfieldBoundaryRegion([
    { x: -5, z: -5 },
    { x: 5, z: -5 },
    { x: 5, z: 5 },
    { x: -5, z: 5 },
  ]);

  it('accepts a finite foot disc that is completely inside the stadium boundary', () => {
    expect(isFootDiscFullyInsideInfieldBoundary(
      square(),
      { x: 0, z: 0 },
      0.15,
    )).toBe(true);
  });

  it('rejects a foot disc whose center is inside but whose edge crosses the boundary', () => {
    expect(isFootDiscFullyInsideInfieldBoundary(
      square(),
      { x: 4.9, z: 0 },
      0.15,
    )).toBe(false);
  });

  it('rejects a point exactly on the boundary even with zero contact radius', () => {
    expect(isFootDiscFullyInsideInfieldBoundary(
      square(),
      { x: 5, z: 0 },
      0,
    )).toBe(false);
  });

  it('rejects degenerate stadium boundary geometry', () => {
    expect(() => createInfieldBoundaryRegion([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
    ])).toThrow('infield boundary polygon must have non-zero area');
  });

  it('rejects negative foot contact radius', () => {
    expect(() => isFootDiscFullyInsideInfieldBoundary(
      square(),
      { x: 0, z: 0 },
      -0.1,
    )).toThrow('footContactRadiusMeters must be finite and non-negative');
  });
});
