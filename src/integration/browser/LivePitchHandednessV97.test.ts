import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateBaseballAerodynamics, REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { normalizeQuaternion } from '../../core/sim/pitching/BaseballOrientation';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { resolvePitcherRepertoireV77 } from './LivePitchAuthoringV77';
import { createPitchSnapshotFromPresetV78, resolvePitcherRepertoireV78, type PitchRepertoireV78 } from './LivePitchAuthoringV78';
import { mirrorPitcherPhysicalHandV97 } from './LivePitchHandednessV97';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';

const axial = (v: { x: number; y: number; z: number }) => ({ x: v.x, y: -v.y, z: -v.z });
const polar = (v: { x: number; y: number; z: number }) => ({ x: -v.x, y: v.y, z: v.z });
const physical = { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, spinRadPerSecond: { x: 210, y: 22, z: -31 } };

describe('v97 explicit pitcher hand conversion and generated fallback directions', () => {
  it('mirrors only un-authored nonfastball fallback axes, once, with the right-handed default unchanged', () => {
    const right = resolvePitcherRepertoireV77(physical), left = resolvePitcherRepertoireV77(physical, 'L');
    expect(resolvePitcherRepertoireV77(physical, 'R')).toEqual(right);
    for (const row of right) {
      const changed = left.find(p => p.pitchType === row.pitchType)!;
      expect(changed.spinRadPerSecond).toEqual(row.pitchType === 'fastball' ? row.spinRadPerSecond : axial(row.spinRadPerSecond));
      expect(changed.releaseSpeedMps).toBe(row.releaseSpeedMps);
    }
    const v78 = resolvePitcherRepertoireV78(physical, 'L');
    for (const row of left) expect(v78.find(p => p.pitchType === row.pitchType)!.spinRadPerSecond).toEqual(row.spinRadPerSecond);
    const custom = { pitchType: 'slider' as const, releaseSpeedMps: 31, spinRadPerSecond: { x: 7, y: 8, z: 9 } };
    const legacy = { ...physical, pitchRepertoire: [custom] };
    expect(resolvePitcherRepertoireV77(legacy, 'L').find(p => p.pitchType === 'slider')!.spinRadPerSecond).toEqual(custom.spinRadPerSecond);
    expect(resolvePitcherRepertoireV78(legacy, 'L').find(p => p.pitchType === 'slider')!.spinRadPerSecond).toEqual(custom.spinRadPerSecond);
    expect(() => resolvePitcherRepertoireV77(physical, 'invalid' as 'R')).toThrow();
    expect(() => resolvePitcherRepertoireV78(physical, 'invalid' as 'R')).toThrow();
  });

  it('materializes and mirrors old owned pitches only on explicit hand changes, preserving the canonical baseline and other physical values', () => {
    const before = JSON.stringify(physical), original = resolvePitcherRepertoireV78(physical, 'R'),
      left = mirrorPitcherPhysicalHandV97(physical, 'R', 'L');
    expect(left.spinRadPerSecond).toEqual(physical.spinRadPerSecond);
    expect(left.pitchRepertoireV78!.pitches).toHaveLength(7);
    for (const row of original) expect(left.pitchRepertoireV78!.pitches.find(p => p.pitchId === row.pitchId)!.spinRadPerSecond).toEqual(axial(row.spinRadPerSecond));
    const rightAgain = mirrorPitcherPhysicalHandV97(left, 'L', 'R');
    for (const row of original) expect(rightAgain.pitchRepertoireV78!.pitches.find(p => p.pitchId === row.pitchId)!.spinRadPerSecond).toEqual(row.spinRadPerSecond);
    expect(JSON.stringify(physical)).toBe(before);
    expect(Object.isFrozen(left.pitchRepertoireV78!.pitches)).toBe(true);
    const unchanged = mirrorPitcherPhysicalHandV97(physical, 'L', 'L');
    expect(unchanged).toEqual(physical); expect(unchanged).not.toBe(physical);
    expect(unchanged).not.toHaveProperty('pitchRepertoireV78');
  });

  it('preserves custom pitch metadata, movement reference spin and scalar seam settings through both conversion directions', () => {
    const seed = createPitchSnapshotFromPresetV78({ presetId: 'slider', pitchId: 'custom', physical }),
      q = normalizeQuaternion({ w: .7, x: -.2, y: .3, z: .4 }),
      row = { ...seed, name: '独自の球', source: { kind: 'original' as const, id: 'original-slider', revision: 3 },
        releaseOrientation: q, spinRadPerSecond: { x: 90, y: -110, z: 70 },
        movementV92: { version: 'pitch_movement_v92' as const, level: 4, referenceSpinRadPerSecond: { x: 130, y: -160, z: 100 },
          referenceSeamForce: { version: 'baseball_seam_force_v1' as const, coefficientScale: .73 } } },
      authored = { ...physical, pitchRepertoireV78: { version: 'pitch_repertoire_v78' as const, pitches: [row] }, extraSI: { limit: 17 } },
      before = JSON.stringify(authored), left = mirrorPitcherPhysicalHandV97(authored, 'R', 'L'), l = left.pitchRepertoireV78!.pitches[0],
      twice = mirrorPitcherPhysicalHandV97(left, 'L', 'R').pitchRepertoireV78!.pitches[0];
    expect(l.spinRadPerSecond).toEqual(axial(row.spinRadPerSecond));
    expect(l.movementV92!.referenceSpinRadPerSecond).toEqual(axial(row.movementV92.referenceSpinRadPerSecond));
    expect(l.movementV92!.referenceSeamForce).toEqual(row.movementV92.referenceSeamForce);
    expect(l.seamForce).toEqual(row.seamForce); expect(l.source).toEqual(row.source); expect(l.name).toBe(row.name);
    expect(left.extraSI).toEqual(authored.extraSI);
    expect(resolvePitcherRepertoireV78(left, 'L')[0].spinRadPerSecond).toEqual(l.spinRadPerSecond);
    expect(twice.spinRadPerSecond).toEqual(row.spinRadPerSecond);
    for (const key of ['w', 'x', 'y', 'z'] as const) expect(twice.releaseOrientation![key]).toBeCloseTo(q[key], 13);
    const velocity = { x: 1.3, y: -.7, z: -36 }, aero = { ...LIVE_MATCH_PHYSICS_V1.air.aerodynamics, seamForce: row.seamForce },
      forceR = calculateBaseballAerodynamics(velocity, row.spinRadPerSecond, aero, q),
      forceL = calculateBaseballAerodynamics(polar(velocity), l.spinRadPerSecond, aero, l.releaseOrientation);
    for (const key of ['x', 'y', 'z'] as const) expect(forceL.totalAcceleration[key]).toBeCloseTo(polar(forceR.totalAcceleration)[key], 10);
    expect(JSON.stringify(authored)).toBe(before);
  });

  it('retains zero-spin owned pitches and legacy custom axes without requiring new schema fields', () => {
    const legacy = { ...physical, pitchRepertoire: [{ pitchType: 'curve' as const, releaseSpeedMps: 22, spinRadPerSecond: { x: 0, y: 0, z: 0 } }] },
      old = JSON.stringify(legacy), next = mirrorPitcherPhysicalHandV97(legacy, 'R', 'L');
    expect(next).not.toHaveProperty('pitchRepertoire');
    expect(next.pitchRepertoireV78!.pitches.find(p => p.pitchId === 'curve')!.spinRadPerSecond).toEqual({ x: 0, y: -0, z: -0 });
    expect(JSON.stringify(legacy)).toBe(old);
    const snapshot = next.pitchRepertoireV78 as PitchRepertoireV78;
    expect(resolvePitcherRepertoireV78({ ...physical, pitchRepertoireV78: snapshot }, 'L')[2].spinRadPerSecond).toEqual(snapshot.pitches[2].spinRadPerSecond);
  });

  it('rejects invalid hand names and accessor data without evaluating it or mutating input', () => {
    expect(() => mirrorPitcherPhysicalHandV97(physical, 'Q' as 'R', 'L')).toThrow();
    expect(() => mirrorPitcherPhysicalHandV97(physical, 'R', 'Q' as 'L')).toThrow();
    let reads = 0;
    const input = { ...physical }; Object.defineProperty(input, 'spinRadPerSecond', { enumerable: true, get() { reads++; return physical.spinRadPerSecond; } });
    expect(() => mirrorPitcherPhysicalHandV97(input, 'R', 'L')).toThrow(); expect(reads).toBe(0);
  });

  it('uses the same seven left-handed un-authored fallback spins in actual pitch execution', () => {
    const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[],
      input: LivePitchInputV1 = { originTick: 1234567, seed: 3,
        batter: { heightMeters: 1.8, bats: 'R', batLengthM: .84, batMassKg: .88, swingRate: 1, timingStdSeconds: 0, aimStdMeters: 0, chaseMarginMeters: .2 },
        pitcher: { releaseSpeedMps: 42, spinRadPerSecond: { x: 230, y: 0, z: 0 }, commandStdMeters: 0, throws: 'L' },
        measuredClips: clips, batting: 'take', pitchType: 'slider', location: 'zone', physics: { kind: 'aero_ground_v1',
          air: { ticksPerSecond: 1e6, integrationStepTicks: 5000, gravityY: -9.81, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
          ground: { ticksPerSecond: 1e6, gravityMps2: 9.81, radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .2,
            material: { restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .36, normalSpinDecayPerSecond: .18 } } } },
      expected = resolvePitcherRepertoireV77(input.pitcher, 'L');
    for (const row of expected) {
      const result = simulateLivePitchV1({ ...input, pitchType: row.pitchType });
      expect(result.frames[0].ball.spin).toEqual(row.spinRadPerSecond);
    }
    expect(expected.find(p => p.pitchType === 'slider')!.spinRadPerSecond.y).toBeGreaterThan(0);
  });
});
