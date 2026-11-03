import { describe, expect, it } from 'vitest';
import { appendPitchLibraryRevisionV78, createPitchSnapshotFromLibraryV78, validatePitchLibraryV78,
  validatePitchSnapshotV78 } from './LivePitchAuthoringV78';
import { inspectPitchMovementV92, setPitchMovementLevelV92 } from './PitchMovementV92';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { pitchSpinFromControlsV77, pitchSpinToControlsV77 } from './LivePitchAuthoringV77';

const original = { pitchId: 'custom-slider', name: '独自スライダー', pitchType: 'slider' as const,
  releaseSpeedMps: 35, spinRadPerSecond: { x: 100, y: -200, z: 300 },
  releaseOrientation: { w: 1, x: 0, y: 0, z: 0 },
  seamForce: { version: 'baseball_seam_force_v1' as const, coefficientScale: 1 },
  source: { kind: 'original' as const, id: 'custom', revision: 1 } };
const metadata = { version: 'pitch_movement_v92' as const, level: 4,
  referenceSpinRadPerSecond: original.spinRadPerSecond, referenceSeamForce: original.seamForce };

describe('V92 optional movement authoring history', () => {
  it('accepts movement history in snapshots and immutable library copies without changing legacy packets', () => {
    const before = JSON.stringify(original);
    expect(validatePitchSnapshotV78(original)).toEqual(original);
    expect(JSON.stringify(original)).toBe(before);
    const pitch = { ...original, movementV92: metadata };
    expect(validatePitchSnapshotV78(pitch)).toEqual(pitch);
    const { pitchId: _id, source: _source, ...settings } = pitch;
    const added = appendPitchLibraryRevisionV78({ library: { version: 'pitch_library_v78', records: [] },
      originalId: 'custom', ...settings });
    expect(validatePitchLibraryV78(JSON.parse(JSON.stringify(added.library)))).toEqual(added.library);
    expect(createPitchSnapshotFromLibraryV78({ library: added.library, originalId: 'custom', revision: 1,
      pitchId: original.pitchId })).toEqual(pitch);
  });
  it('rejects unknown and malformed metadata without reading accessors', () => {
    for (const bad of [{ ...metadata, extra: true }, { ...metadata, version: 'future' },
      { ...metadata, level: 1.5 }, { ...metadata, level: 8 }, { ...metadata, level: '4' },
      { ...metadata, referenceSpinRadPerSecond: { x: NaN, y: 0, z: 0 } },
      { ...metadata, referenceSpinRadPerSecond: { x: 1201, y: 0, z: 0 } },
      { ...metadata, referenceSpinRadPerSecond: { x: 1, y: 0, z: 0, extra: true } },
      { ...metadata, referenceSeamForce: { version: 'baseball_seam_force_v1', coefficientScale: 2.1 } },
      { ...metadata, referenceSpinRadPerSecond: { x: 0, y: 0, z: 0 }, referenceSeamForce: { ...original.seamForce, coefficientScale: 0 } }]) {
      expect(() => validatePitchSnapshotV78({ ...original, movementV92: bad })).toThrow();
      const { pitchId: _id, source: _source, ...settings } = original;
      expect(() => validatePitchLibraryV78({ version: 'pitch_library_v78', records: [{ ...settings,
        originalId: 'custom', revision: 1, movementV92: bad }] })).toThrow();
    }
    let reads = 0;
    expect(() => validatePitchSnapshotV78({ ...original, movementV92: { ...metadata,
      get referenceSpinRadPerSecond() { reads++; return original.spinRadPerSecond; } } })).toThrow();
    expect(reads).toBe(0);
  });
});

describe('V92 edit strength translates to explicit physical inputs', () => {
  it('restores an independent custom axis and seam after zero and JSON round trips', () => {
    const before = JSON.stringify(original), zero = setPitchMovementLevelV92({ pitch: original, level: 0 });
    expect(zero.spinRadPerSecond).toEqual({ x: 0, y: 0, z: 0 });
    expect(zero.seamForce?.coefficientScale).toBe(0);
    const seven = setPitchMovementLevelV92({ pitch: JSON.parse(JSON.stringify(zero)), level: 7 });
    expect(seven.spinRadPerSecond).toEqual({ x: 175, y: -350, z: 525 });
    expect(seven.seamForce?.coefficientScale).toBe(1.75);
    const again = setPitchMovementLevelV92({ pitch: seven, level: 0 }), restored = setPitchMovementLevelV92({ pitch: again, level: 4 });
    const { movementV92: _history, ...physical } = restored;
    expect(physical).toEqual(original);
    expect(inspectPitchMovementV92(restored)).toMatchObject({ status: 'level', level: 4, multiplier: 1, clamped: false });
    expect(JSON.stringify(original)).toBe(before);
    expect(Object.isFrozen(restored.movementV92?.referenceSpinRadPerSecond)).toBe(true);
  });
  it('measures no Magnus or seam acceleration at zero while gravity still lowers the ball', () => {
    const zero = setPitchMovementLevelV92({ pitch: original, level: 0 }), velocity = { x: 0, y: 0, z: -35 },
      air = { ...LIVE_MATCH_PHYSICS_V1.air, aerodynamics: { ...LIVE_MATCH_PHYSICS_V1.air.aerodynamics, seamForce: zero.seamForce } },
      forces = calculateBaseballAerodynamics(velocity, zero.spinRadPerSecond, air.aerodynamics, zero.releaseOrientation),
      initial = { tick: 0, position: { x: 0, y: 2, z: 17 }, velocity, spin: zero.spinRadPerSecond },
      later = sampleAerodynamicPitchStateAtElapsedSeconds(initial, .1, air, zero.releaseOrientation);
    expect(forces.liftAcceleration).toEqual({ x: 0, y: 0, z: 0 });
    expect(forces.seamAcceleration).toBeUndefined();
    expect(later.position.y).toBeLessThan(2);
    expect(later.velocity.y).toBeLessThan(0);
    expect(later.position.x).toBe(0);
    expect(zero.releaseSpeedMps).toBe(35);
    expect(zero.releaseOrientation).toEqual(original.releaseOrientation);
  });
  it('treats physical manual edits as authoritative and starts a fresh reference when changing the level', () => {
    const two = setPitchMovementLevelV92({ pitch: original, level: 2 }), manual = { ...two,
      spinRadPerSecond: { x: -80, y: 40, z: -20 }, seamForce: { ...original.seamForce, coefficientScale: .6 } };
    expect(inspectPitchMovementV92(manual)).toMatchObject({ status: 'manual', level: null });
    expect(validatePitchSnapshotV78(manual).spinRadPerSecond).toEqual({ x: -80, y: 40, z: -20 });
    const six = setPitchMovementLevelV92({ pitch: manual, level: 6 });
    expect(six.spinRadPerSecond).toEqual({ x: -120, y: 60, z: -30 });
    expect(six.seamForce?.coefficientScale).toBeCloseTo(.9);
    expect(six.movementV92.referenceSpinRadPerSecond).toEqual(manual.spinRadPerSecond);
    expect(inspectPitchMovementV92(six).status).toBe('level');
    const { seamForce: _removedSeam, ...withoutSeam } = two;
    expect(inspectPitchMovementV92(withoutSeam).status).toBe('manual');
  });
  it('does not require a historical seam orientation after manual editing removes the active seam force', () => {
    const two = setPitchMovementLevelV92({ pitch: original, level: 2 }),
      { seamForce: _removedSeam, releaseOrientation: _removedOrientation, ...manual } = two;
    expect(inspectPitchMovementV92(manual).status).toBe('manual');
    const four = setPitchMovementLevelV92({ pitch: manual, level: 4 });
    expect(four).not.toHaveProperty('seamForce');
    expect(four).not.toHaveProperty('releaseOrientation');
    expect(four.spinRadPerSecond).toEqual(manual.spinRadPerSecond);
  });
  it('retains its level after the existing UI rounds all spin controls to twelve significant digits', () => {
    const seven = setPitchMovementLevelV92({ pitch: original, level: 7 }), controls = pitchSpinToControlsV77(seven.spinRadPerSecond),
      spinRadPerSecond = pitchSpinFromControlsV77({ spinRpm: Number(controls.spinRpm.toPrecision(12)),
        breakDirectionDegrees: Number(controls.breakDirectionDegrees.toPrecision(12)), gyroFraction: Number(controls.gyroFraction.toPrecision(12)) });
    expect(inspectPitchMovementV92({ ...seven, spinRadPerSecond })).toMatchObject({ status: 'level', level: 7 });
    const four = setPitchMovementLevelV92({ pitch: { ...seven, spinRadPerSecond }, level: 4 });
    expect(four.spinRadPerSecond).toEqual(original.spinRadPerSecond);
  });
  it('keeps knuckleball spin and axis unchanged at nonzero levels, scaling seam strength only', () => {
    const knuckle = { ...original, pitchType: 'knuckleball' as const, spinRadPerSecond: { x: 2, y: -3, z: 1 } };
    const one = setPitchMovementLevelV92({ pitch: knuckle, level: 1 }), seven = setPitchMovementLevelV92({ pitch: one, level: 7 });
    expect(one.spinRadPerSecond).toEqual({ x: 2, y: -3, z: 1 });
    expect(one.seamForce?.coefficientScale).toBe(.25);
    expect(seven.spinRadPerSecond).toEqual(knuckle.spinRadPerSecond);
    expect(seven.seamForce?.coefficientScale).toBe(1.75);
    expect(setPitchMovementLevelV92({ pitch: seven, level: 0 }).spinRadPerSecond).toEqual({ x: 0, y: 0, z: 0 });
  });
  it('reports physical caps and restores the uncapped reference exactly at level four', () => {
    const strong = { ...original, spinRadPerSecond: { x: 600, y: 800, z: 0 },
      seamForce: { ...original.seamForce, coefficientScale: 1.6 } }, seven = setPitchMovementLevelV92({ pitch: strong, level: 7 }),
      observed = inspectPitchMovementV92(seven);
    expect(Math.hypot(seven.spinRadPerSecond.x, seven.spinRadPerSecond.y, seven.spinRadPerSecond.z)).toBeLessThanOrEqual(1200);
    expect(seven.spinRadPerSecond.x / seven.spinRadPerSecond.y).toBeCloseTo(.75);
    expect(seven.seamForce?.coefficientScale).toBe(2);
    expect(observed).toMatchObject({ status: 'level', clamped: true, spinClamped: true, seamClamped: true });
    expect(observed.notes.length).toBeGreaterThan(0);
    const restored = setPitchMovementLevelV92({ pitch: seven, level: 4 });
    expect(restored.spinRadPerSecond).toEqual(strong.spinRadPerSecond);
    expect(restored.seamForce).toEqual(strong.seamForce);
  });
  it('requires an explicit same-type reference for an initially powerless ball and preserves its other physical fields', () => {
    const powerless = { ...original, spinRadPerSecond: { x: 0, y: 0, z: 0 }, seamForce: { ...original.seamForce, coefficientScale: 0 } };
    expect(() => setPitchMovementLevelV92({ pitch: powerless, level: 2 })).toThrow(/基準/);
    const changed = setPitchMovementLevelV92({ pitch: powerless, level: 2, referencePitch: { ...original, releaseSpeedMps: 40 } });
    expect(changed.spinRadPerSecond).toEqual({ x: 50, y: -100, z: 150 });
    expect(changed.releaseSpeedMps).toBe(35);
    expect(changed.releaseOrientation).toEqual(powerless.releaseOrientation);
    expect(changed.source).toEqual(powerless.source);
    expect(() => setPitchMovementLevelV92({ pitch: powerless, level: 2,
      referencePitch: { ...original, pitchType: 'curve' } })).toThrow();
    const { releaseOrientation: _removedOrientation, ...noOrientation } = powerless;
    expect(() => setPitchMovementLevelV92({ pitch: noOrientation, level: 2, referencePitch: original })).toThrow(/姿勢/);
  });
  it('accepts level zero on an initially powerless ball without inventing a reference axis', () => {
    const powerless = { ...original, spinRadPerSecond: { x: 0, y: 0, z: 0 }, seamForce: { ...original.seamForce, coefficientScale: 0 } },
      zero = setPitchMovementLevelV92({ pitch: powerless, level: 0 });
    expect(inspectPitchMovementV92(zero)).toMatchObject({ status: 'level', level: 0 });
    expect(zero.movementV92.referenceSpinRadPerSecond).toEqual({ x: 0, y: 0, z: 0 });
    expect(zero.spinRadPerSecond).toEqual(powerless.spinRadPerSecond);
    expect(zero.seamForce).toEqual(powerless.seamForce);
  });
  it('requires an explicit reference when raising a zero-only history after JSON import', () => {
    const powerless = { ...original, spinRadPerSecond: { x: 0, y: 0, z: 0 }, seamForce: { ...original.seamForce, coefficientScale: 0 } },
      zero = JSON.parse(JSON.stringify(setPitchMovementLevelV92({ pitch: powerless, level: 0 })));
    expect(() => setPitchMovementLevelV92({ pitch: zero, level: 1 })).toThrow(/基準/);
    const seven = setPitchMovementLevelV92({ pitch: zero, level: 7, referencePitch: original });
    expect(seven.spinRadPerSecond).toEqual({ x: 175, y: -350, z: 525 });
    expect(inspectPitchMovementV92(seven)).toMatchObject({ status: 'level', level: 7 });
  });
  it('rejects fastballs, invalid levels and unsafe inputs while leaving unconfigured pitches unchanged', () => {
    expect(inspectPitchMovementV92(original)).toMatchObject({ status: 'unconfigured', level: null });
    const fastball = { ...original, pitchType: 'fastball' as const };
    expect(inspectPitchMovementV92(fastball).status).toBe('unsupported');
    expect(() => setPitchMovementLevelV92({ pitch: fastball, level: 4 })).toThrow(/ストレート/);
    expect(() => validatePitchSnapshotV78({ ...fastball, movementV92: metadata })).toThrow();
    for (const level of [-1, 8, .5, NaN, '4']) expect(() => setPitchMovementLevelV92({ pitch: original, level } as never)).toThrow();
    expect(() => setPitchMovementLevelV92({ pitch: original, level: 4, extra: true } as never)).toThrow();
    let reads = 0;
    expect(() => setPitchMovementLevelV92({ pitch: original, get level() { reads++; return 4; } })).toThrow();
    expect(reads).toBe(0);
  });
});
