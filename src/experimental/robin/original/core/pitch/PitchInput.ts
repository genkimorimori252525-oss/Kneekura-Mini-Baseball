// プレイヤーのリリース操作 → 投球結果への写像（M4の中核）。
// 設計書 2026-07-30-m4-pitching-design.md §2 / §4。
//
// 原因主義: リリースずれは「制球誤差の乱数を広げる」のではなく**符号付きの高低バイアス**
// という決定論的な因果として効かせる。だから「なぜ高めに浮いたか」が毎球説明でき、
// プレイヤーは上達できる。乱数σは制球能力・疲労由来のぶんだけ残す。
//
// 実測の裏付け: 到達点は release projection angle が1°変わるごとに約30cm動く
// （elevation 1°→約30cm、速度1m/s→約20cm、垂直リリース点1cm→1cm）。
// 早い＝腕が上を向いたまま離す＝高めに抜ける／遅い＝前で離す＝低めに引っかける。
//
// 現実との縮尺（誠実に明記）: 実際の投手のリリース許容はミリ秒級で、そのまま写すと
// 人間の指では不可能。窓 ±0.12s は「投手が体で覚えた再現性」を代理する抽象であり、
// **窓のどこで離したかを実測係数（1°≒30cm）で到達点に変換する接続だけが物理**。
// 窓幅そのものはUXの値。

import { releaseWindowScale } from './PitcherStamina';

export interface PitchInput {
  /** リリースずれ[秒]。負=早い / 正=遅い */
  releaseError: number;
  /** 全力宣言（ホイールのダブルタップ） */
  fullPower: boolean;
  /** スタミナ残量 0..100 */
  staminaLeft: number;
}

export const RELEASE = {
  /** 基準のリリース窓（片側・秒）。M7較正対象 */
  WINDOW: 0.12,
  /** 窓端でのバレル…ではなく到達点の高低バイアス[m]。0.55m＝角度換算1.8°。M7較正対象 */
  BIAS_Y_MAX: 0.55,
  /** 窓端での回転量の目減り（球質＝回転効率の低下）。M7較正対象 */
  SPIN_LOSS_MAX: 0.35,
  /** 全力宣言時のリリース窓倍率（リング高速化＝難化）。M7較正対象 */
  FULL_POWER_WINDOW: 0.65,
  /** 全力宣言時の球速倍率。同一投手の「reach back」は+2.5〜3mph。M7較正対象 */
  FULL_POWER_VELOCITY: 1.035,
  /** 全力宣言時の変化量倍率。M7較正対象 */
  FULL_POWER_SPIN: 1.1,
} as const;

/** コメントの段階境界（窓に対する相対値）。打撃の6段階と同じ語彙で揃える */
export const COMMENT_BOUNDS = { PERFECT: 0.12, SLIGHT: 0.35, MID: 1.0 } as const;

/** このリリースにおける許容窓[秒]（全力と疲労で狭まる。両者は乗算） */
export function releaseWindowFor(input: PitchInput): number {
  const full = input.fullPower ? RELEASE.FULL_POWER_WINDOW : 1;
  return RELEASE.WINDOW * full * releaseWindowScale(input.staminaLeft);
}

/**
 * 到達点の高低バイアス[m]。早い(負)→正（高めに抜ける）／遅い(正)→負（低めに引っかける）。
 * **窓外もこの直線をそのまま延長する**——窓の2倍ずれれば1.1mで、すっぽ抜けの高め暴投や
 * ワンバウンドが特別扱いなしに出る（暴投テーブルを作らない）。
 */
export function releaseBiasY(input: PitchInput): number {
  return -RELEASE.BIAS_Y_MAX * (input.releaseError / releaseWindowFor(input));
}

/** 回転量の倍率。ずれるほど「棒球」になる（下限は窓端の値でクリップ） */
export function releaseSpinScale(input: PitchInput): number {
  const ratio = Math.min(1, Math.abs(input.releaseError) / releaseWindowFor(input));
  return 1 - RELEASE.SPIN_LOSS_MAX * ratio;
}

/**
 * 6段階フィードバック（＋ドンピシャ）。打撃の「まじはやすぎ／…／まじおそすぎ」と
 * 同じ語彙にする——反省点が同じ言葉で読めることに価値がある。
 * 判定は窓に対する相対値（窓は疲労・全力で伸縮するため絶対秒では意味が変わる）。
 */
export function releaseComment(input: PitchInput): string {
  const r = Math.abs(input.releaseError) / releaseWindowFor(input);
  if (r < COMMENT_BOUNDS.PERFECT) return 'ドンピシャ';
  const early = input.releaseError < 0;
  if (r < COMMENT_BOUNDS.SLIGHT) return early ? 'ちょいはやい' : 'ちょいおそ';
  if (r < COMMENT_BOUNDS.MID) return early ? 'はやい' : 'おそい';
  return early ? 'まじはやすぎ' : 'まじおそすぎ';
}
