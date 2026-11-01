// 投手スタミナ（M4）。`PlayerRatings.stamina` は定義済みだが未使用だったので、
// ここで「状態としての残量」を導入する。設計書 2026-07-30-m4-pitching-design.md §3。
//
// 疲労は数値の悪化だけでなく**操作難度**にも出す（リリース窓が狭まる）——
// 「疲れると自分の指で難しくなる」ことを体感させるにーくら方針。
//
// 適用範囲: M4では憑依投手（ブルペン）のみ。AI投手の疲労は継投AI（M6監督モード）と
// セットでM5/M6へ回す——継投なしにAI先発が疲れ続けると「悪くなるだけで交代しない」
// 不整合になり、M2/M3で固定した試合フィクスチャも全て動くため。

export const STAMINA = {
  /** 空になる球数の下限（スタミナ0の投手）。M7較正対象 */
  EMPTY_BASE: 60,
  /** スタミナ1ptあたり伸びる球数。M7較正対象 */
  EMPTY_PER_RATING: 0.9,
  /** 全力宣言時の消費倍率（親スペック§5.2-6「スタミナ大量消費」）。M7較正対象 */
  FULL_POWER_COST: 3,
  /** 空(fatigue=1)での球速低下率。実測は平均0.28mph/イニング＝9回で約4km/h。M7較正対象 */
  VELOCITY_LOSS: 0.05,
  /** 空での制球σ拡大（1+この値倍）。M7較正対象 */
  SIGMA_GAIN: 0.8,
  /** 空でのリリース窓の縮小率。M7較正対象 */
  WINDOW_LOSS: 0.25,
} as const;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** この投手がスタミナを使い切るまでに投げられる球数（通常投球） */
export function pitchesToEmpty(staminaRating: number): number {
  return STAMINA.EMPTY_BASE + STAMINA.EMPTY_PER_RATING * staminaRating;
}

/** 1球あたりのスタミナ消費[pt]（残量は0..100スケール） */
export function staminaCost(staminaRating: number, fullPower: boolean): number {
  const cost = 100 / pitchesToEmpty(staminaRating);
  return fullPower ? cost * STAMINA.FULL_POWER_COST : cost;
}

/** 疲労度 0（元気）..1（空） */
export function fatigueOf(staminaLeft: number): number {
  return clamp01(1 - staminaLeft / 100);
}

/** 球速倍率（疲労で落ちる） */
export function velocityScale(staminaLeft: number): number {
  return 1 - STAMINA.VELOCITY_LOSS * fatigueOf(staminaLeft);
}

/** 制球誤差σの倍率（疲労で広がる） */
export function controlSigmaScale(staminaLeft: number): number {
  return 1 + STAMINA.SIGMA_GAIN * fatigueOf(staminaLeft);
}

/** リリース窓の倍率（疲労で狭まる＝操作が難しくなる） */
export function releaseWindowScale(staminaLeft: number): number {
  return 1 - STAMINA.WINDOW_LOSS * fatigueOf(staminaLeft);
}
