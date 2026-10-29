import { expect, it } from 'vitest';
import { createSamePaInitialDefenderObservationModelV214, createSamePaInitialDefenderObservationViewsV214,
  type SamePaInitialDefenderObservationInputV214 } from './SamePaInitialDefenderObservationViewV214';

const fixture = () => {
  const positions = [{ x: 12, z: 18 }, { x: -12, z: 18 }, { x: 20, z: 32 }, { x: -20, z: 32 }, { x: 0, z: 40 },
    { x: 40, z: 70 }, { x: -40, z: 70 }, { x: 0, z: 90 }, { x: 0, z: -2 }];
  const defenders: SamePaInitialDefenderObservationInputV214[] = positions.map((prePitchPosition, index) => ({ playerId: 'existing-defender-' + index,
    heightMeters: 1.8 + index * 0.01, bodyOriginHeightMeters: 0.9, bodyPrimitiveOffset: { x: 0.1, y: 0.2, z: -0.1 }, prePitchPosition }));
  return { model: createSamePaInitialDefenderObservationModelV214('explicit-nominal-initial-view-v214'), defenders, homePlate: { x: 0, z: 0 } };
};

it('IDV214-01 declares an uncalibrated initial-only model and preserves every existing defender ID and order', () => {
  const f = fixture(), result = createSamePaInitialDefenderObservationViewsV214(f.model, f.defenders, f.homePlate);
  expect(result.model).toEqual({ sourceId: 'explicit-nominal-initial-view-v214', sourceVersion: 'same_pa_initial_defender_observation_view_v214',
    evidenceAuthority: 'EXPLICIT_UNCALIBRATED_GAME_NOMINAL_INITIAL_VIEW', empiricallyCalibrated: false, scope: 'INITIAL_VIEW_ONLY',
    params: { eyeHeightRatio: 0.92, eyeHorizontalOffsetMeters: { x: 0, z: 0 }, crouchMeters: 0,
      forwardPolicy: 'PRE_PITCH_HOME_PLATE_CORE_ATAN2_SIN_COS', attentionPolicy: 'KNOWN_BALL_INTENT' } });
  expect(result.views.map(value => value.playerId)).toEqual(f.defenders.map(value => value.playerId));
  for (const value of result.views) {
    expect(Object.keys(value.view).sort()).toEqual(['attentionTarget', 'bodyRelativeEyeOffset', 'forward', 'poseVersion']);
    expect(value.view.poseVersion).toBe(f.model.sourceId + ':' + f.model.sourceVersion);
    expect(value.view.attentionTarget).toEqual({ kind: 'ball' });
  }
});

it('IDV214-02 places each nominal eye at height times .92 after applying offset to its body primitive center', () => {
  const f = fixture(), result = createSamePaInitialDefenderObservationViewsV214(f.model, f.defenders, f.homePlate);
  for (const [index, value] of result.views.entries()) {
    const body = f.defenders[index], offset = value.view.bodyRelativeEyeOffset;
    const center = { x: body.prePitchPosition.x + body.bodyPrimitiveOffset.x,
      y: body.bodyOriginHeightMeters + body.bodyPrimitiveOffset.y, z: body.prePitchPosition.z + body.bodyPrimitiveOffset.z };
    expect(center.x + offset.x).toBeCloseTo(body.prePitchPosition.x, 12);
    expect(center.y + offset.y).toBeCloseTo(body.heightMeters * 0.92, 12);
    expect(center.z + offset.z).toBeCloseTo(body.prePitchPosition.z, 12);
  }
});

it('IDV214-03 faces horizontal known home geometry without a ball or cursor input', () => {
  const f = fixture(), result = createSamePaInitialDefenderObservationViewsV214(f.model, f.defenders, f.homePlate);
  for (const [index, value] of result.views.entries()) {
    const position = f.defenders[index].prePitchPosition, dx = f.homePlate.x - position.x, dz = f.homePlate.z - position.z, norm = Math.hypot(dx, dz);
    expect(value.view.forward.x).toBeCloseTo(dx / norm, 14); expect(value.view.forward.y).toBe(0); expect(value.view.forward.z).toBeCloseTo(dz / norm, 14);
    expect(Math.hypot(value.view.forward.x, value.view.forward.y, value.view.forward.z)).toBeCloseTo(1, 14);
  }
});

it('IDV214-04 scales eye geometry and retains facing under a common world translation', () => {
  const f = fixture(), first = createSamePaInitialDefenderObservationViewsV214(f.model, f.defenders, f.homePlate), scale = 2;
  const scaled = f.defenders.map(body => ({ ...body, heightMeters: body.heightMeters * scale, bodyOriginHeightMeters: body.bodyOriginHeightMeters * scale,
    bodyPrimitiveOffset: { x: body.bodyPrimitiveOffset.x * scale, y: body.bodyPrimitiveOffset.y * scale, z: body.bodyPrimitiveOffset.z * scale },
    prePitchPosition: { x: body.prePitchPosition.x * scale + 8, z: body.prePitchPosition.z * scale - 16 } }));
  const second = createSamePaInitialDefenderObservationViewsV214(f.model, scaled, { x: 8, z: -16 });
  for (const [index, value] of second.views.entries()) {
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(value.view.bodyRelativeEyeOffset[axis]).toBeCloseTo(first.views[index].view.bodyRelativeEyeOffset[axis] * scale, 12);
      expect(value.view.forward[axis]).toBeCloseTo(first.views[index].view.forward[axis], 14);
    }
  }
});

it('IDV214-05 rejects finite inputs whose direction arithmetic overflows', () => {
  const f = fixture();
  const overflow = f.defenders.map((body, index) => index === 0 ? { ...body, prePitchPosition: { x: -Number.MAX_VALUE, z: 1 } } : body);
  expect(() => createSamePaInitialDefenderObservationViewsV214(f.model, overflow, { x: Number.MAX_VALUE, z: 0 })).toThrow();
});

it('IDV214-06 rejects incomplete or duplicate scopes and undeclared model changes', () => {
  const f = fixture(); expect(() => createSamePaInitialDefenderObservationViewsV214(f.model, f.defenders.slice(1), f.homePlate)).toThrow();
  expect(() => createSamePaInitialDefenderObservationViewsV214(f.model, [f.defenders[0], ...f.defenders.slice(0, 8)], f.homePlate)).toThrow();
  for (const model of [{ ...f.model, empiricallyCalibrated: true }, { ...f.model, scope: 'CONTINUOUS_GAZE' },
    { ...f.model, evidenceAuthority: 'MEASURED_EYE_POSITION' }, { ...f.model, params: { ...f.model.params, eyeHeightRatio: 0.93 } }])
    expect(() => createSamePaInitialDefenderObservationViewsV214(model, f.defenders, f.homePlate)).toThrow();
});

it('IDV214-07 leaves body, model and geometry unchanged and never reads ambient current-ball fields', () => {
  const f = fixture(), before = JSON.stringify(f);
  for (const body of f.defenders) {
    Object.defineProperty(body, 'currentBall', { get: () => { throw Error('current ball must not be consulted'); } });
    Object.defineProperty(body, 'cursor', { get: () => { throw Error('current cursor must not be consulted'); } });
    Object.freeze(body.bodyPrimitiveOffset); Object.freeze(body.prePitchPosition); Object.freeze(body);
  }
  Object.freeze(f.defenders); Object.freeze(f.homePlate);
  const first = createSamePaInitialDefenderObservationViewsV214(f.model, f.defenders, f.homePlate);
  const second = createSamePaInitialDefenderObservationViewsV214(f.model, f.defenders, f.homePlate);
  expect(first).toEqual(second); expect(JSON.stringify(f)).toBe(before);
});

it('IDV214-08 matches Core atan2 sin cos initialization at ordinary, coincident and signed-zero positions', () => {
  const f = fixture(), coincident = f.defenders.map((body, index) => index === 0 ? { ...body, prePitchPosition: { x: 0, z: 0 } } : body);
  const result = createSamePaInitialDefenderObservationViewsV214(f.model, coincident, f.homePlate);
  expect(result.views[0].view.forward).toEqual({ x: 0, y: 0, z: 1 });
  const ordinary = createSamePaInitialDefenderObservationViewsV214(f.model, f.defenders, f.homePlate);
  for (const [index, value] of ordinary.views.entries()) {
    const position = f.defenders[index].prePitchPosition, yaw = Math.atan2(f.homePlate.x - position.x, f.homePlate.z - position.z);
    expect(value.view.forward).toEqual({ x: Math.sin(yaw), y: 0, z: Math.cos(yaw) });
  }
  const signed = createSamePaInitialDefenderObservationViewsV214(f.model, coincident, { x: -0, z: 0 });
  expect(Object.is(signed.views[0].view.forward.x, -0)).toBe(true);
  expect(signed.views[0].view.forward).toEqual({ x: Math.sin(Math.atan2(-0, 0)), y: 0, z: Math.cos(Math.atan2(-0, 0)) });
});
