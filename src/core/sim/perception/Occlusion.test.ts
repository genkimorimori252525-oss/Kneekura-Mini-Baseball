import { describe, expect, it } from 'vitest';
import {
  estimateOcclusionVisibility,
  type SphericalOccluder,
} from './Occlusion';

const observer = { x: 0, y: 1.7, z: 0 };
const target = { x: 0, y: 1.7, z: 10 };

it('resolves a thin bat capsule without hiding the empty space in its large enclosing sphere',()=>{
  const start={x:.3,y:1,z:1},end={x:.3,y:2,z:1};
  expect(estimateOcclusionVisibility(observer,target,[{shape:'capsule',start,end,radiusMeters:.034}])).toBe(1);
  expect(estimateOcclusionVisibility(observer,target,[{shape:'capsule',start:{...start,x:0},end:{...end,x:0},radiusMeters:.034}])).toBe(0);
});
it('handles capsule endpoints, parallel segments and reversed viewing directions',()=>{
  const cap={shape:'capsule' as const,start:{x:0,y:1.7,z:5},end:{x:0,y:1.7,z:7},radiusMeters:.034};
  expect(estimateOcclusionVisibility(observer,target,[cap])).toBe(0);
  expect(estimateOcclusionVisibility(target,observer,[cap])).toBe(0);
  expect(estimateOcclusionVisibility(observer,target,[{...cap,start:{...cap.start,x:.1},end:{...cap.end,x:.1}}])).toBe(1);
  expect(estimateOcclusionVisibility(observer,target,[{...cap,start:{x:0,y:1.72,z:10.02},end:{x:0,y:2,z:11}}])).toBe(0);
});

describe('estimateOcclusionVisibility', () => {
  it('returns full visibility when no blocker exists', () => {
    expect(estimateOcclusionVisibility(observer, target, [])).toBe(1);
  });

  it('returns zero when a spherical blocker intersects the observer-target segment', () => {
    const blockers: SphericalOccluder[] = [{
      center: { x: 0, y: 1.7, z: 5 },
      radiusMeters: 0.5,
    }];

    expect(estimateOcclusionVisibility(observer, target, blockers)).toBe(0);
  });

  it('does not occlude when the blocker misses the sight line', () => {
    const blockers: SphericalOccluder[] = [{
      center: { x: 1, y: 1.7, z: 5 },
      radiusMeters: 0.5,
    }];

    expect(estimateOcclusionVisibility(observer, target, blockers)).toBe(1);
  });

  it('does not occlude from a blocker beyond the target or behind the observer', () => {
    const beyond: SphericalOccluder = {
      center: { x: 0, y: 1.7, z: 12 },
      radiusMeters: 0.5,
    };
    const behind: SphericalOccluder = {
      center: { x: 0, y: 1.7, z: -2 },
      radiusMeters: 0.5,
    };

    expect(estimateOcclusionVisibility(observer, target, [beyond])).toBe(1);
    expect(estimateOcclusionVisibility(observer, target, [behind])).toBe(1);
  });

  it('returns zero when any one of multiple blockers occludes', () => {
    expect(estimateOcclusionVisibility(observer, target, [
      { center: { x: 3, y: 1.7, z: 4 }, radiusMeters: 0.5 },
      { center: { x: 0.2, y: 1.7, z: 7 }, radiusMeters: 0.3 },
    ])).toBe(0);
  });

  it('rejects non-positive blocker radii', () => {
    expect(() => estimateOcclusionVisibility(observer, target, [{
      center: { x: 0, y: 1.7, z: 5 },
      radiusMeters: 0,
    }])).toThrow('radiusMeters must be finite and positive');
  });
});

it('includes spherical overlap at the eye or target even if the sphere center projects outside the segment', () => {
  expect(estimateOcclusionVisibility(observer, target, [{ center: { ...observer, z: -0.1 }, radiusMeters: 1 }])).toBe(0);
  expect(estimateOcclusionVisibility(observer, target, [{ center: { ...target, z: 10.1 }, radiusMeters: 1 }])).toBe(0);
  expect(estimateOcclusionVisibility(observer, target, [{ center: { ...observer, x: 1 }, radiusMeters: 1 }])).toBe(0);
});
