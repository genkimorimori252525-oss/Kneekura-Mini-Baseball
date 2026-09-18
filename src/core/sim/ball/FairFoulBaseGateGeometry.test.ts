import { describe, expect, it } from 'vitest';
import {
  classifyPointBeyondFirstThirdBaseGates,
  createFairFoulBaseGateGeometry,
} from './FairFoulBaseGateGeometry';

const bases = createFairFoulBaseGateGeometry({
  homePlate: { x: 0, z: 0 },
  firstBase: { x: 27.432, z: 27.432 },
  secondBase: { x: 0, z: 54.864 },
  thirdBase: { x: -27.432, z: 27.432 },
});

describe('FairFoulBaseGateGeometry', () => {
  it('keeps a point between home and the first/third gates before both gates', () => {
    expect(classifyPointBeyondFirstThirdBaseGates(
      bases,
      { x: 0, z: 10 },
    )).toEqual({
      firstBase: false,
      thirdBase: false,
    });
  });

  it('detects first-base-side passage independently from third-base-side passage', () => {
    expect(classifyPointBeyondFirstThirdBaseGates(
      bases,
      { x: 20, z: 40 },
    )).toEqual({
      firstBase: true,
      thirdBase: false,
    });

    expect(classifyPointBeyondFirstThirdBaseGates(
      bases,
      { x: -20, z: 40 },
    )).toEqual({
      firstBase: false,
      thirdBase: true,
    });
  });

  it('detects a deep center-field point as beyond both gates', () => {
    expect(classifyPointBeyondFirstThirdBaseGates(
      bases,
      { x: 0, z: 70 },
    )).toEqual({
      firstBase: true,
      thirdBase: true,
    });
  });

  it('does not treat a point exactly on a gate as already beyond it', () => {
    expect(classifyPointBeyondFirstThirdBaseGates(
      bases,
      { x: 20, z: 34.864 },
    )).toEqual({
      firstBase: false,
      thirdBase: false,
    });
  });

  it('rejects degenerate gate geometry', () => {
    expect(() => createFairFoulBaseGateGeometry({
      homePlate: { x: 0, z: 0 },
      firstBase: { x: 1, z: 1 },
      secondBase: { x: 1, z: 1 },
      thirdBase: { x: -1, z: 1 },
    })).toThrow(
      'firstBase and secondBase must define a non-degenerate gate',
    );
  });
});
