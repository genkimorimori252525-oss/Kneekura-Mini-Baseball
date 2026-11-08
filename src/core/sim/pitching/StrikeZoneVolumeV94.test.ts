import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import type { SourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { createStrikeZoneVolumeV94, distanceToStrikeZoneVolumeV94, findSourceStrikeZoneContactV94 } from './StrikeZoneVolumeV94';

const volume = createStrikeZoneVolumeV94({ centerX: 0, halfWidth: .2159, lowerY: .5, upperY: 1.2 });
const path = (position: (t: number) => Vec3, speed: number, ground?: number): SourceFreeBallKernel => ({
  cells: [{ fromElapsedSeconds: 0, throughElapsedSeconds: 1, maximumPositionSpeedMps: speed, positionRoundingBoundMeters: 0 }],
  boundaries: ground === undefined ? [] : [{ kind: 'ground', elapsedSeconds: ground }],
  evaluateAt: (t: number) => ({ moment: { ball: { position: position(t) } }, phase: ground !== undefined && t >= ground ? 'rolling' : 'airborne' }),
}) as unknown as SourceFreeBallKernel;
const contact = (position: (t: number) => Vec3, speed = 10, ground?: number) => findSourceStrikeZoneContactV94({ kernel: path(position, speed, ground), volume, ballRadiusMeters: .01, throughElapsedSeconds: 1 });

describe('V94 continuous sphere / home-plate prism intersection', () => {
  it('owns a five-sided fixed plate and its real tapered rear tip', () => {
    expect(volume.platePolygon).toEqual([{ x: 0, z: 0 }, { x: .2159, z: .2159 }, { x: .2159, z: .4318 }, { x: -.2159, z: .4318 }, { x: -.2159, z: .2159 }]);
    expect(distanceToStrikeZoneVolumeV94({ x: .18, y: .8, z: .05 }, volume)).toBeGreaterThan(.01);
    expect(distanceToStrikeZoneVolumeV94({ x: .18, y: .8, z: .3 }, volume)).toBe(0);
  });

  it('rejects separate-axis corner false positives and includes sphere edge tangency', () => {
    const r = .0366;
    expect(distanceToStrikeZoneVolumeV94({ x: .2159 + .9 * r, y: 1.2 + .9 * r, z: .3 }, volume)).toBeGreaterThan(r);
    expect(distanceToStrikeZoneVolumeV94({ x: .2159 + r, y: .8, z: .3 }, volume)).toBeCloseTo(r, 12);
    expect(contact(t => ({ x: .224, y: .8, z: .8 - t }))).toMatchObject({ kind: 'hit' });
  });

  it('certifies ordinary side/top and simultaneous side-top corner tangencies as hits', () => {
    // Binary-exact offsets make genuine geometric equality distinguishable
    // from a near tangent that remains numerically unresolved.
    const r = 1 / 32, query = (position: (t: number) => Vec3, radius = r) => findSourceStrikeZoneContactV94({
      kernel: path(position, 3), volume, ballRadiusMeters: radius, throughElapsedSeconds: 1 });
    expect(query(t => ({ x: .2159 + r, y: .8, z: .8 - t }))?.kind).toBe('hit');
    expect(query(t => ({ x: 0, y: 1.2 + r, z: .8 - t }))?.kind).toBe('hit');
    expect(query(t => ({ x: .2159 + 3 / 128, y: 1.2 + 4 / 128, z: .8 - t }), 5 / 128)?.kind).toBe('hit');
    const diagonal = query(() => ({ x: 5 / 32, y: .8, z: 3 / 32 }), Math.SQRT2 / 32);
    expect(diagonal?.kind).toBe('hit');
  });

  it('finds front-only, back-only and intermediate-only paths, independently of a measurement plane', () => {
    const front = contact(t => ({ x: 0, y: .8 + 4 * Math.max(0, t - .37), z: .8 - t }));
    const back = contact(t => ({ x: 0, y: 2.67 - 2 * t, z: .8 - t }));
    const middle = contact(t => ({ x: 0, y: .8 + 40 * (t - .65) ** 2, z: .8 - t }), 55);
    for (const hit of [front, back, middle]) expect(hit?.kind).toBe('hit');
    if (front?.kind !== 'hit' || back?.kind !== 'hit' || middle?.kind !== 'hit') throw Error('expected continuous contact');
    expect(front.position.z).toBeGreaterThan(.4); expect(back.position.z).toBeLessThan(.15);
    expect(middle.position.z).toBeGreaterThan(.15); expect(middle.position.z).toBeLessThan(.4318);
    expect(contact(t => ({ x: .27, y: .8, z: .8 - t }))).toBeNull();
  });

  it('excludes a pitch that first intersects the zone after touching the ground', () => {
    expect(contact(t => ({ x: 0, y: .8, z: .8 - t }), 10, .2)).toBeNull();
    expect(contact(t => ({ x: 0, y: .8, z: .8 - t }), 10, .6)?.kind).toBe('hit');
  });

  it('retains unresolved tangencies rather than deciding a false ball', () => {
    const result = contact(t => ({ x: .2259 + (t - .53) ** 2, y: .8, z: .8 - t }), 3);
    expect(result).not.toBeNull(); expect(['hit', 'unresolved']).toContain(result!.kind);
  });
});
