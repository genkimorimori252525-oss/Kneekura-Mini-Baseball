import { describe, expect, it } from 'vitest';
import { resolveLivePitchReleasePlanV168, type LivePitchReleasePlanV168 } from './LivePitchReleasePlanV168';
import type { PitchSnapshotV78 } from './LivePitchAuthoringV78';

const pitchFixture = ():PitchSnapshotV78 => ({
  pitchId:'release-plan-owned', name:'Release plan boundary', pitchType:'curve',
  source:{ kind:'original', id:'release-plan-library', revision:3 },
  releaseSpeedMps:35.3, spinRadPerSecond:{ x:60, y:-0, z:80 },
  releaseOrientation:{ w:Math.SQRT1_2, x:-0, y:0, z:Math.SQRT1_2 },
  seamForce:{ version:'baseball_seam_force_v1', coefficientScale:.8 },
  movementV92:{ version:'pitch_movement_v92', level:4,
    referenceSpinRadPerSecond:{ x:120, y:0, z:160 },
    referenceSeamForce:{ version:'baseball_seam_force_v1', coefficientScale:1.75 } },
});
const planFixture = (selected:PitchSnapshotV78):LivePitchReleasePlanV168 => ({
  version:'live_pitch_release_plan_v168', pitchId:selected.pitchId, qualityState:'KIRE_CIRCLE',
  expectedBase:{ releaseSpeedMps:selected.releaseSpeedMps, spinRadPerSecond:{ ...selected.spinRadPerSecond },
    ...(selected.releaseOrientation === undefined ? {} : { releaseOrientation:{ ...selected.releaseOrientation } }),
    ...(selected.seamForce === undefined ? {} : { seamForce:{ ...selected.seamForce } }) },
  nominal:{ spinRadPerSecond:{ x:-4, y:-0, z:3 },
    releaseOrientation:{ w:.5, x:-.5, y:.5, z:-.5 } },
});
function expectFrozen(value:unknown):void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);Object.values(value).forEach(expectFrozen);
}
function expectMutable(value:unknown):void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(false);Object.values(value).forEach(expectMutable);
}

describe('V168 author-supplied nominal release plan', () => {
  it('retains nonidentity q/-q, signed zero and permitted unit-rounding exactly, owning only its frozen result', () => {
    for (const sign of [1, -1]) {
      const selected = pitchFixture(), request = planFixture(selected),
        q = { w:sign * .5 * (1 + 2e-10), x:sign * -.5 * (1 + 2e-10),
          y:sign * .5 * (1 + 2e-10), z:sign * -.5 * (1 + 2e-10) },
        plan = { ...request, nominal:{ ...request.nominal, releaseOrientation:q } },
        input = { selected, request:plan, maximumPitchSpeedMps:35.3 }, before = structuredClone(input),
        result = resolveLivePitchReleasePlanV168(input);
      expect(result).toStrictEqual({ pitchId:selected.pitchId, qualityState:plan.qualityState,
        spinRadPerSecond:plan.nominal.spinRadPerSecond, releaseOrientation:q,
        authority:'AUTHOR_SUPPLIED_NOMINAL_RELEASE_NOT_QUALIFIED_SKILL' });
      expect(Object.is(result.spinRadPerSecond.y, -0)).toBe(true);
      for (const key of ['w', 'x', 'y', 'z'] as const) expect(Object.is(result.releaseOrientation[key], q[key])).toBe(true);
      expect(result.spinRadPerSecond).not.toBe(plan.nominal.spinRadPerSecond);
      expect(result.releaseOrientation).not.toBe(q);
      expectFrozen(result);expect(input).toStrictEqual(before);expectMutable(input);
      expect(selected.movementV92).toStrictEqual(before.selected.movementV92);
    }
  });

  it('does not derive physical changes from a name, provenance, movement history or quality-state identifier', () => {
    const selected = pitchFixture(), request = planFixture(selected), before = structuredClone(selected),
      renamed:PitchSnapshotV78 = { ...selected, name:'Different name', source:{ kind:'original', id:'other-source', revision:9 },
        movementV92:{ ...selected.movementV92!, level:7 } }, renamedBefore = structuredClone(renamed);
    for (const qualityState of ['KIRE_CIRCLE', 'KIRE_DOUBLE_CIRCLE', 'THREATENING_DOUBLE_CIRCLE'] as const) {
      const result = resolveLivePitchReleasePlanV168({ selected:renamed, request:{ ...request, qualityState } });
      expect(result.qualityState).toBe(qualityState);
      expect(result.spinRadPerSecond).toStrictEqual(request.nominal.spinRadPerSecond);
      expect(result.releaseOrientation).toStrictEqual(request.nominal.releaseOrientation);
    }
    expect(selected).toStrictEqual(before);expect(renamed).toStrictEqual(renamedBefore);
    expectMutable(selected);expectMutable(renamed);
  });

  it('rejects stale speed, spin, quaternion, seam and either pitch-ID binding without changing the caller', () => {
    const selected = pitchFixture(), request = planFixture(selected),
      base = request.expectedBase, q = base.releaseOrientation!;
    const stale = [
      { ...request, expectedBase:{ ...base, releaseSpeedMps:base.releaseSpeedMps + 1 } },
      { ...request, expectedBase:{ ...base, spinRadPerSecond:{ ...base.spinRadPerSecond, x:61 } } },
      { ...request, expectedBase:{ ...base, spinRadPerSecond:{ ...base.spinRadPerSecond, y:0 } } },
      { ...request, expectedBase:{ ...base, releaseOrientation:{ w:-q.w, x:-q.x, y:-q.y, z:-q.z } } },
      { ...request, expectedBase:{ ...base, releaseOrientation:{ ...q, x:0 } } },
      { ...request, expectedBase:{ ...base, seamForce:{ ...base.seamForce!, coefficientScale:.9 } } },
      { ...request, pitchId:'other-pitch' },
    ];
    for (const bad of stale) {
      const input = { selected, request:bad }, before = structuredClone(input);
      expect(() => resolveLivePitchReleasePlanV168(input)).toThrow();
      expect(input).toStrictEqual(before);expectMutable(input);
    }
    expect(() => resolveLivePitchReleasePlanV168({ selected:{ ...selected, pitchId:'other-pitch' }, request })).toThrow();
  });

  it('matches optional material/seam presence exactly and accepts a legacy base without either field', () => {
    const full = pitchFixture(), { releaseOrientation:_q, seamForce:_seam, ...legacy } = full,
      legacyRequest = planFixture(legacy), fullRequest = planFixture(full),
      { releaseOrientation:_expectedQ, ...noExpectedQ } = fullRequest.expectedBase,
      { seamForce:_expectedSeam, ...noExpectedSeam } = fullRequest.expectedBase;
    expect(resolveLivePitchReleasePlanV168({ selected:legacy, request:legacyRequest }).releaseOrientation)
      .toStrictEqual(legacyRequest.nominal.releaseOrientation);
    for (const input of [
      { selected:full, request:{ ...fullRequest, expectedBase:noExpectedQ } },
      { selected:full, request:{ ...fullRequest, expectedBase:noExpectedSeam } },
      { selected:legacy, request:{ ...legacyRequest, expectedBase:{ ...legacyRequest.expectedBase, releaseOrientation:full.releaseOrientation } } },
      { selected:legacy, request:{ ...legacyRequest, expectedBase:{ ...legacyRequest.expectedBase, seamForce:{ version:'baseball_seam_force_v1', coefficientScale:0 } } } },
      { selected:legacy, request:{ ...legacyRequest, expectedBase:{ ...legacyRequest.expectedBase, releaseOrientation:undefined } } },
      { selected:legacy, request:{ ...legacyRequest, expectedBase:{ ...legacyRequest.expectedBase, seamForce:undefined } } },
    ]) expect(() => resolveLivePitchReleasePlanV168(input as never)).toThrow();
  });

  it('delegates finite spin, spin-limit and unit-quaternion checks to the existing V78 snapshot boundary', () => {
    const selected = pitchFixture(), request = planFixture(selected);
    for (const nominal of [
      { ...request.nominal, spinRadPerSecond:{ x:NaN, y:0, z:0 } },
      { ...request.nominal, spinRadPerSecond:{ x:0, y:Infinity, z:0 } },
      { ...request.nominal, spinRadPerSecond:{ x:1200, y:0, z:1 } },
      { ...request.nominal, releaseOrientation:{ w:NaN, x:0, y:0, z:0 } },
      { ...request.nominal, releaseOrientation:{ w:1, x:1, y:0, z:0 } },
      { ...request.nominal, releaseOrientation:{ w:1.000001, x:0, y:0, z:0 } },
    ]) {
      const input = { selected, request:{ ...request, nominal } }, before = structuredClone(input);
      expect(() => resolveLivePitchReleasePlanV168(input)).toThrow();
      expect(input).toStrictEqual(before);expectMutable(input);
    }
    const nominal = { ...request.nominal, spinRadPerSecond:{ x:1200, y:0, z:0 } };
    expect(resolveLivePitchReleasePlanV168({ selected, request:{ ...request, nominal } }).spinRadPerSecond).toStrictEqual(nominal.spinRadPerSecond);
  });

  it('retains the selected speed and enforces the existing individual speed limit', () => {
    const selected = pitchFixture(), request = planFixture(selected);
    expect(() => resolveLivePitchReleasePlanV168({ selected, request, maximumPitchSpeedMps:35.3 })).not.toThrow();
    for (const maximumPitchSpeedMps of [35.299, 14, 86, NaN])
      expect(() => resolveLivePitchReleasePlanV168({ selected, request, maximumPitchSpeedMps })).toThrow();
    expect(() => resolveLivePitchReleasePlanV168({ selected:{ ...selected, releaseSpeedMps:86 },
      request:{ ...request, expectedBase:{ ...request.expectedBase, releaseSpeedMps:86 } } })).toThrow();
  });

  it('rejects unknown fields, alternate force/timing/trace inputs and malformed plan identities', () => {
    const selected = pitchFixture(), request = planFixture(selected), nominal = request.nominal;
    for (const badNominal of [
      { ...nominal, releaseSpeedMps:40 }, { ...nominal, seamForce:selected.seamForce },
      { ...nominal, forceScale:2 }, { ...nominal, timer:.4 }, { ...nominal, trace:[] },
      { ...nominal, spinRadPerSecond:{ ...nominal.spinRadPerSecond, extra:0 } },
      { ...nominal, releaseOrientation:{ ...nominal.releaseOrientation, extra:0 } },
      { spinRadPerSecond:nominal.spinRadPerSecond }, null,
    ]) expect(() => resolveLivePitchReleasePlanV168({ selected, request:{ ...request, nominal:badNominal } } as never)).toThrow();
    for (const badRequest of [
      { ...request, extra:0 }, { ...request, version:'live_pitch_release_plan_v169' },
      { ...request, qualityState:'UNKNOWN' }, { ...request, qualityState:null },
      { ...request, expectedBase:{ ...request.expectedBase, extra:0 } },
      { ...request, expectedBase:{ ...request.expectedBase, seamForce:{ ...request.expectedBase.seamForce, extra:0 } } },
      null,
    ]) expect(() => resolveLivePitchReleasePlanV168({ selected, request:badRequest } as never)).toThrow();
    expect(() => resolveLivePitchReleasePlanV168({ selected, request, extra:0 } as never)).toThrow();
    expect(() => resolveLivePitchReleasePlanV168({ selected:{ ...selected, extra:0 }, request } as never)).toThrow();
  });
});
