import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { BaseballSeamForceV1 } from '../../core/sim/ball/BaseballSeamForceV1';
import { validatePitchSnapshotV78, type LivePitchTypeV78, type PitchMovementHistoryV92,
  type PitchPhysicalSettingsV78 } from './LivePitchAuthoringV78';

export type PitchMovementPitchV92 = PitchPhysicalSettingsV78 & Readonly<{ pitchType: LivePitchTypeV78 }>;
export type PitchMovementInspectionV92 = Readonly<{
  status: 'unconfigured' | 'level' | 'manual' | 'unsupported'; level: number | null; multiplier: number | null;
  clamped: boolean; spinClamped: boolean; seamClamped: boolean; notes: readonly string[];
}>;
const multipliers = [0, .25, .5, .75, 1, 1.25, 1.5, 1.75] as const;
const norm = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function assert(value: unknown, message: string): asserts value { if (!value) throw Error('変化量設定：' + message); }
function validatePitch(pitch: PitchMovementPitchV92) {
  assert(pitch && typeof pitch === 'object' && !Array.isArray(pitch), '球の設定を指定してください。');
  // Project only physical fields: both owned snapshots and library drafts keep their own identities.
  const optional = Object.fromEntries(['releaseOrientation', 'seamForce', 'movementV92']
    .filter(key => Object.hasOwn(pitch, key)).map(key => [key, pitch[key as keyof typeof pitch]]));
  validatePitchSnapshotV78({ pitchId: 'movement-v92', name: '変化量検証', pitchType: pitch.pitchType,
    releaseSpeedMps: pitch.releaseSpeedMps, spinRadPerSecond: pitch.spinRadPerSecond, ...optional,
    source: { kind: 'original', id: 'movement-v92', revision: 1 } });
}
function expectedPhysical(pitchType: LivePitchTypeV78, history: PitchMovementHistoryV92) {
  const multiplier = multipliers[history.level], reference = history.referenceSpinRadPerSecond,
    spinMultiplier = history.level === 0 ? 0 : pitchType === 'knuckleball' ? 1 : multiplier,
    requestedMagnitude = norm(reference) * spinMultiplier, spinClamped = requestedMagnitude > 1200,
    // Leave the exact reference untouched at level four; only a capped result needs roundoff headroom.
    ratio = spinClamped ? 1200 * (1 - 4 * Number.EPSILON) / norm(reference) : spinMultiplier,
    spinRadPerSecond = ratio === 0 ? { x: 0, y: 0, z: 0 } : ratio === 1 ? { ...reference }
      : { x: reference.x * ratio, y: reference.y * ratio, z: reference.z * ratio },
    requestedSeam = (history.referenceSeamForce?.coefficientScale ?? 0) * multiplier,
    seamClamped = requestedSeam > 2,
    seamForce: BaseballSeamForceV1 | undefined = history.level === 0
      ? { version: 'baseball_seam_force_v1', coefficientScale: 0 }
      : history.referenceSeamForce ? { ...history.referenceSeamForce, coefficientScale: Math.min(2, requestedSeam) } : undefined,
    notes = [
      ...(spinClamped ? ['回転数は物理設定の上限1200 rad/sで制限されています。'] : []),
      ...(seamClamped ? ['縫い目の強度は物理設定の上限2で制限されています。'] : []),
    ];
  return { spinRadPerSecond, seamForce, multiplier, spinClamped, seamClamped, notes };
}
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b));
function inspectValidated(pitch: PitchMovementPitchV92): PitchMovementInspectionV92 {
  const empty = { level: null, multiplier: null, clamped: false, spinClamped: false, seamClamped: false, notes: [] };
  if (pitch.pitchType === 'fastball') return { ...empty, status: 'unsupported' };
  const history = pitch.movementV92;
  if (!history) return { ...empty, status: 'unconfigured' };
  const expected = expectedPhysical(pitch.pitchType, history), sameSpin = (['x', 'y', 'z'] as const)
    .every(axis => close(pitch.spinRadPerSecond[axis], expected.spinRadPerSecond[axis])),
    sameSeam = pitch.seamForce === undefined ? expected.seamForce === undefined
      : expected.seamForce !== undefined && close(pitch.seamForce.coefficientScale, expected.seamForce.coefficientScale);
  if (!sameSpin || !sameSeam) return { ...empty, status: 'manual' };
  return { status: 'level', level: history.level, multiplier: expected.multiplier,
    clamped: expected.spinClamped || expected.seamClamped, spinClamped: expected.spinClamped,
    seamClamped: expected.seamClamped, notes: expected.notes };
}
/** Observe edit history only. Never replaces the physical fields used by runtime simulation. */
export function inspectPitchMovementV92(raw: PitchMovementPitchV92): PitchMovementInspectionV92 {
  const pitch = cloneInert(raw); validatePitch(pitch); return freeze(inspectValidated(pitch));
}
/** An edit strength, not a measured centimetre target or a monotonic movement guarantee. */
export function setPitchMovementLevelV92<T extends PitchMovementPitchV92>(raw: Readonly<{
  pitch: T; level: number; referencePitch?: PitchMovementPitchV92;
}>): T & Readonly<{ movementV92: PitchMovementHistoryV92 }> {
  const request = cloneInert(raw);
  assert(request && typeof request === 'object' && !Array.isArray(request)
    && Object.keys(request).every(key => ['pitch', 'level', 'referencePitch'].includes(key)), '指定した設定項目を確認してください。');
  assert(Number.isInteger(request.level) && request.level >= 0 && request.level <= 7, '0から7の整数を指定してください。');
  const pitch = request.pitch; validatePitch(pitch);
  assert(pitch.pitchType !== 'fastball', 'ストレートはこの変化量設定の対象ではありません。');
  if (Object.hasOwn(request, 'referencePitch')) {
    assert(request.referencePitch !== undefined, '参考球を指定してください。'); validatePitch(request.referencePitch);
    assert(request.referencePitch.pitchType === pitch.pitchType, '同じ球種の参考球を指定してください。');
  }
  let history = inspectValidated(pitch).status === 'level' ? pitch.movementV92 : undefined;
  if (history && request.level > 0 && norm(history.referenceSpinRadPerSecond) === 0
    && !(history.referenceSeamForce?.coefficientScale)) history = undefined;
  if (!history) {
    let reference: PitchMovementPitchV92 = pitch;
    if (norm(reference.spinRadPerSecond) === 0 && !(reference.seamForce?.coefficientScale)
      && (request.level > 0 || request.referencePitch !== undefined)) {
      assert(request.referencePitch !== undefined, '基準の回転・縫い目設定がありません。方向を持つ参考球を明示して選んでください。');
      reference = request.referencePitch;
    }
    assert(request.level === 0 || norm(reference.spinRadPerSecond) > 0 || (reference.seamForce?.coefficientScale ?? 0) > 0,
      '基準の回転・縫い目設定がありません。別の参考球を選んでください。');
    assert(!(reference.seamForce?.coefficientScale) || pitch.releaseOrientation !== undefined,
      '参考球の縫い目を使うには、この球の材料姿勢を明示してください。');
    history = { version: 'pitch_movement_v92', level: request.level,
      referenceSpinRadPerSecond: { ...reference.spinRadPerSecond },
      ...(reference.seamForce ? { referenceSeamForce: { ...reference.seamForce } } : {}) };
  }
  const movementV92: PitchMovementHistoryV92 = { ...history, level: request.level },
    physical = expectedPhysical(pitch.pitchType, movementV92), result = { ...pitch, movementV92,
      spinRadPerSecond: physical.spinRadPerSecond } as T & { movementV92: PitchMovementHistoryV92; seamForce?: BaseballSeamForceV1 };
  assert(!(physical.seamForce?.coefficientScale) || pitch.releaseOrientation !== undefined,
    '縫い目の変化を戻すには、この球の材料姿勢を明示してください。');
  if (physical.seamForce) result.seamForce = physical.seamForce; else delete result.seamForce;
  validatePitch(result); return freeze(result);
}
