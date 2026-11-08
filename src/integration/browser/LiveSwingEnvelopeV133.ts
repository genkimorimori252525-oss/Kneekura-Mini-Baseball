import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assertReferenceBatEnvelopeV133, type ReferenceBatEnvelopeV133 } from '../../core/sim/contact/ReferenceBatEnvelopeV133';
import { validateSwingExecutionV122 } from './LiveSwingExecutionV122';

/** Local author Source only. The poses remain in original registered clip
 * coordinates; Live resolves height and the known stance offset once, never
 * the saved JSON or the current ball's forecast/aim transform. */
export function validateLiveSwingEnvelopeV133(raw: unknown, execution: unknown): ReferenceBatEnvelopeV133 {
  if (execution === undefined) throw Error('準備・回復にはC1の明示した加速度上限を設定してください。');
  validateSwingExecutionV122(execution);
  let p: ReferenceBatEnvelopeV133;
  try {
    const value = cloneInert(raw);
    assertReferenceBatEnvelopeV133(value);
    p = value;
  } catch {
    throw Error('準備・回復の詳細JSONを確認してください。versionと空でないsourceId、preparation/recoveryのdurationSeconds（0より大きく10秒以下）、grip（m）、orientation（単位quaternion）を指定してください。');
  }
  for (const pose of [p.preparation, p.recovery]) { Object.freeze(pose.grip); Object.freeze(pose.orientation); Object.freeze(pose); }
  return Object.freeze(p);
}
export function scaleLiveSwingEnvelopeV133(p: ReferenceBatEnvelopeV133, heightScale: number, stanceOffsetZ = 0): ReferenceBatEnvelopeV133 {
  const pose = (v: ReferenceBatEnvelopeV133['preparation']) => ({ ...v,
    grip: { x: v.grip.x * heightScale, y: v.grip.y * heightScale, z: v.grip.z * heightScale + stanceOffsetZ }, orientation: { ...v.orientation } });
  return { ...p, preparation: pose(p.preparation), recovery: pose(p.recovery) };
}
/** Fixed boundary durations introduce nonmonotone bounds. Only actually
 * certified candidates are retained; this never claims a global maximum. */
export function selectLiveSwingEnvelopeRateV133(requestedRate: number, feasible: (rate: number) => boolean) {
  if (!Number.isFinite(requestedRate) || requestedRate < .01 || requestedRate > 20) throw Error('invalid requested envelope rate');
  const candidates: number[] = [];
  const check = (rate: number) => { candidates.push(rate); return feasible(rate); };
  const result = (rate: number) => ({ rate, requestedRate, candidates: Object.freeze([...candidates]),
    method: 'FINITE_DESCENDING_16_PARTITIONS_AND_8_LOCAL_REFINEMENTS' as const, globalMaximumGuaranteed: false as const });
  if (check(requestedRate)) { if (!check(requestedRate)) return null; return result(requestedRate); }
  let higher = requestedRate;
  for (let i = 1; i <= 16; i++) {
    const rate = i === 16 ? .01 : requestedRate - (requestedRate - .01) * i / 16;
    if (check(rate)) {
      let lo = rate, hi = higher;
      for (let n = 0; n < 8; n++) { const mid = (lo + hi) / 2; if (check(mid)) lo = mid; else hi = mid; }
      if (!check(lo)) return null;
      return result(lo);
    }
    higher = rate;
  }
  return null;
}
