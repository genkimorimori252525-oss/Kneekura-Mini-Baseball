import { describe, expect, it } from 'vitest';
import { rotatePitchMaterialPhaseV159 } from './PitchMaterialPhaseV159';
import { validatePitchRepertoireV78, validatePitchSnapshotV78, type PitchSnapshotV78 } from './LivePitchAuthoringV78';

// Synthetic V78 authoring boundary; no measured player, flight, or force claim.
const pitchFixture = ():PitchSnapshotV78 => ({
  pitchId:'material-phase-owned', name:'Material phase boundary', pitchType:'curve',
  source:{ kind:'original', id:'material-phase-library', revision:3 },
  releaseSpeedMps:35.3, spinRadPerSecond:{ x:60, y:80, z:0 },
  releaseOrientation:{ w:Math.SQRT1_2, x:0, y:0, z:Math.SQRT1_2 },
  seamForce:{ version:'baseball_seam_force_v1', coefficientScale:.8 },
  movementV92:{ version:'pitch_movement_v92', level:4,
    referenceSpinRadPerSecond:{ x:120, y:160, z:0 },
    referenceSeamForce:{ version:'baseball_seam_force_v1', coefficientScale:1.75 } },
});

function expectFrozen(value:unknown):void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(expectFrozen);
}

function expectOnlyOrientationChanged(before:PitchSnapshotV78, after:PitchSnapshotV78):void {
  const { releaseOrientation:_before, ...originalSettings } = before,
    { releaseOrientation:_after, ...resultSettings } = after;
  expect(resultSettings).toStrictEqual(originalSettings);
  expect(Object.keys(after).sort()).toStrictEqual(Object.keys(before).sort());
}

describe('V159 owned pitch material phase about the saved world spin axis', () => {
  it('left-multiplies a nonidentity material quaternion about current spin, distinct from body-right or world-Z rotation', () => {
    const pitch = pitchFixture(), before = structuredClone(pitch);
    for (const sign of [1, -1]) {
      const result = rotatePitchMaterialPhaseV159({ pitch, phaseDegrees:sign * 90 }), q = result.releaseOrientation!;
      // q0=Rz(90), omega/|omega|=(.6,.8,0). Left product is
      // (.5, +/-.7, +/-.1, .5); the positive body-right product is
      // (.5,-.1,.7,.5), while a positive world-Z turn gives (0,0,0,1).
      const expected = { w:.5, x:sign * .7, y:sign * .1, z:.5 };
      for (const key of ['w', 'x', 'y', 'z'] as const) expect(q[key]).toBeCloseTo(expected[key], 13);
      expect(Math.hypot(q.w, q.x, q.y, q.z)).toBeCloseTo(1, 14);
      expectOnlyOrientationChanged(pitch, result);
      expectFrozen(result);
    }
    expect(pitch).toStrictEqual(before);
    expect(Object.isFrozen(pitch)).toBe(false);
    expect(Object.isFrozen(pitch.releaseOrientation)).toBe(false);
  });

  it('keeps every zero-phase quaternion value exactly, freezes only its owned copy, and leaves the caller mutable', () => {
    // V78 permits this unit-rounding tolerance. Zero phase must not normalize it.
    const pitch:PitchSnapshotV78 = { ...pitchFixture(), releaseOrientation:{
      w:Math.SQRT1_2 * (1 + 2e-10), x:-0, y:0, z:Math.SQRT1_2 * (1 + 2e-10),
    } }, before = structuredClone(pitch), request = { pitch, phaseDegrees:0 },
      result = rotatePitchMaterialPhaseV159(request);
    expect(validatePitchSnapshotV78(pitch)).toStrictEqual(before);
    expect(result).toStrictEqual(before);
    expect(result).not.toBe(pitch);
    expect(result.releaseOrientation).not.toBe(pitch.releaseOrientation);
    expect(result.spinRadPerSecond).not.toBe(pitch.spinRadPerSecond);
    expect(result.source).not.toBe(pitch.source);
    expect(result.movementV92).not.toBe(pitch.movementV92);
    expect(Object.is(result.releaseOrientation!.x, -0)).toBe(true);
    expectFrozen(result);
    expect(pitch).toStrictEqual(before);
    for (const value of [request, pitch, pitch.releaseOrientation, pitch.spinRadPerSecond, pitch.source,
      pitch.seamForce, pitch.movementV92, pitch.movementV92!.referenceSpinRadPerSecond]) {
      expect(Object.isFrozen(value)).toBe(false);
    }
  });

  it('requires saved material and nonzero spin even at zero phase, and rejects nonfinite, out-of-range, or malformed authoring data', () => {
    const pitch = pitchFixture(), { releaseOrientation:_orientation, ...withoutOrientation } = pitch,
      missingMaterial = { ...withoutOrientation, seamForce:{ version:'baseball_seam_force_v1' as const, coefficientScale:0 } },
      zeroSpin = { ...pitch, spinRadPerSecond:{ x:0, y:0, z:0 } };
    // Both are legal legacy V78 snapshots, but neither qualifies for this helper.
    expect(validatePitchSnapshotV78(missingMaterial)).not.toHaveProperty('releaseOrientation');
    expect(validatePitchSnapshotV78(zeroSpin).spinRadPerSecond).toStrictEqual(zeroSpin.spinRadPerSecond);
    for (const bad of [missingMaterial, zeroSpin]) {
      const before = structuredClone(bad);
      for (const phaseDegrees of [0, 90]) expect(() => rotatePitchMaterialPhaseV159({ pitch:bad, phaseDegrees })).toThrow();
      expect(bad).toStrictEqual(before);
      expect(Object.isFrozen(bad)).toBe(false);
    }
    for (const phaseDegrees of [NaN, Infinity, -Infinity, 360.000001, -360.000001, '90', null, undefined]) {
      expect(() => rotatePitchMaterialPhaseV159({ pitch, phaseDegrees } as never)).toThrow();
    }
    for (const bad of [
      { ...pitch, unexpected:true },
      { ...pitch, releaseSpeedMps:86 },
      { ...pitch, releaseOrientation:{ w:1, x:1, y:0, z:0 } },
      { ...pitch, source:{ ...pitch.source, revision:0 } },
      { ...pitch, movementV92:{ ...pitch.movementV92!, level:8 } },
    ]) {
      const before = structuredClone(bad);
      expect(() => rotatePitchMaterialPhaseV159({ pitch:bad, phaseDegrees:90 })).toThrow();
      expect(bad).toStrictEqual(before);
      expect(Object.isFrozen(bad)).toBe(false);
    }
  });

  it('accepts inclusive full-turn bounds and saves ordinary V78 snapshots through the existing validator and JSON schema', () => {
    const pitch = pitchFixture(), before = structuredClone(pitch);
    for (const phaseDegrees of [-360, -27.5, 90, 360]) {
      const result = rotatePitchMaterialPhaseV159({ pitch, phaseDegrees }),
        restored = JSON.parse(JSON.stringify(result)) as unknown;
      expectOnlyOrientationChanged(pitch, result);
      expect(validatePitchSnapshotV78(restored)).toStrictEqual(result);
      expect(validatePitchRepertoireV78({ version:'pitch_repertoire_v78', pitches:[restored] }).pitches[0]).toStrictEqual(result);
      if (Math.abs(phaseDegrees) === 360) {
        const q = result.releaseOrientation!, q0 = pitch.releaseOrientation!;
        // q and -q encode the same material orientation after a complete turn.
        expect(Math.abs(q.w * q0.w + q.x * q0.x + q.y * q0.y + q.z * q0.z)).toBeCloseTo(1, 13);
      }
      expectFrozen(result);
    }
    expect(pitch).toStrictEqual(before);
  });
});
