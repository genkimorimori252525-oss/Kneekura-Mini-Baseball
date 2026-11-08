// ══════════════════════════════════════════════════════════════
// **球種＝ボールの回転そのもの**（にーくら 2026-08-09
//   「変化球は、固定の軌道にこだわりたくない。ボールの回転で、軌道が決まるようにしたい」）
// ══════════════════════════════════════════════════════════════
//
// 軌道のキーフレームはどこにもない。`PitchFlightSolver` が 1/240 秒ごとに
// **マグヌス力＋抗力＋重力**を足して積分した結果が軌道になる。ここに書くのは
// **その球がどう回っているか**だけ。
//
// ──────────────────────────────────────────────
// ★★★**原因を書く。結果を書かない**（2026-08-09 の書き直しの理由）
// ──────────────────────────────────────────────
// 前の形は `breakDirDeg`（＝**どっちへ曲げたいか**）と `spinRpm` を持っていて、
// そこから回転軸を**逆算**していた。物理そのものは正しかったが、入口が逆を向いていた
// ——「こう曲がってほしい」から回転を作るのは、**結果から原因を作る**形。
// いまは「軸をどこへ向け、どれだけ回すか」だけを書き、変化量は測って出す。
//
// ★数値は動いていない。同じ回転を別の言葉で書き直しただけで、10種の総回転・回転効率は
//   1e-13 の丸め誤差の中で一致する（`pitchTypes.test.ts` が見張っている）。
//
// ──────────────────────────────────────────────
// **回転軸は「時計の針」で言う**（投球界の世界標準・調査 2026-08-09）
// ──────────────────────────────────────────────
//   12時 = 真上（バックスピン＝ホップ）  3時 = 投手の腕側（右投手なら三塁側 +x）
//    6時 = 真下（トップスピン＝ドロップ） 9時 = グラブ側
//   **1時間 = 30°、1分 = 0.5°**（360°/12h・360°/720min）
//
// 実測との答え合わせ（この規約で書いた値を、実際に投げて測った）:
//   ストレート 12:54 … 文献「右投手の速球は12時〜2時」
//   カーブ      6:54 … 文献「カーブは7時方向」
//   スイーパー  9:08 … 文献「ちょうど9時＝完全な横回転」
//
// ──────────────────────────────────────────────
// **ジャイロ角と回転効率**（Driveline）
// ──────────────────────────────────────────────
//   **回転効率 = cos(ジャイロ角)**。★線形ではない——45°は効率50%ではなく **71%**。
//   現場でも最も多い誤解だと名指しされている。ジャイロ成分（フットボール回転）は
//   速度と平行なのでマグヌス力を生まない。「3000rpm でも曲がらないスライダー」の正体。
//
// ──────────────────────────────────────────────
// **変化レベル 1〜10**（にーくら指定・2026-08-09「回転量の目盛り」を選択）
// ──────────────────────────────────────────────
//   レベル → **有効回転数**（＝変化に使われる回転）。**1 = 500rpm … 10 = 5000rpm**
//   （にーくら 2026-08-09「変化量を5000rpmまで設定できるようにして」で 300→500 へ）。
//   ★**原因側の目盛り**なので、同じレベルでも球種で変化量は変わる——遅い球は
//   飛んでいる時間が長いぶん大きく曲がる。それは物理として正しい姿。
//   ★★変化量を直接指定する形（結果側）は**採らなかった**。回転が原因で変化が結果、
//   という向きを保つため（にーくら選択）。
//
// ──────────────────────────────────────────────
// **揺れ（ナックル）**（調査 2026-08-09）
// ──────────────────────────────────────────────
//   ナックルは「無回転」ではない。**1/4〜1/2回転**が理想（完全な無回転より良い）。
//   縫い目が剥離域へ入ったり出たりして後流が左右に飛び移り、力の向きが
//   **およそ1秒に1回**反転する。飛行は0.45秒なので「1球のあいだに向きが1回変わるかどうか」。
//
//   ★`wobble` は「**回転を揺れに置き換える割合**」。0 なら普通の球、1 なら完全なナックル。
//     これにすると **レベルを上げれば揺れも大きくなる**——にーくらの「1〜10で変化量に差」が
//     ナックルでも成立する。途中の値（0.3 など）は「揺れながら落ちるフォーク」になる。
//   ★★揺れは**乱数ではなく回転位相の関数**。理由は2つ:
//     ・`determinism-guard` のとおり、同じ球は必ず同じ軌道でなければリプレイが壊れる
//     ・乱数の揺れは打者にとってただの理不尽。位相なら「回転を変えると揺れ方が変わる」
//       という因果があり、チューナーで作り込める（`ballAero.wobbleAccel`）

import { Vec3, vec3 } from '../math/vec3';
import { WOBBLE } from '../physics/ballAero';

/**
 * **球種の定義＝ボールの回転**。
 *
 * ★ここに「どう曲がるか」は書かない。書くのは**どう回るか**だけ。
 *   変化量は `PitchFlightSolver` で積分した結果として出る（`pitchMovement.test.ts` が測る）。
 */
export interface PitchTypeDef {
  id: string;
  name: string;
  /** リーグ平均球速[km/h] */
  speedKmh: number;
  /**
   * **回転軸の時計表記**[度]。0=12時（ホップ）／90=3時（投手の腕側）／
   * 180=6時（ドロップ）／270=9時（グラブ側）。**右投手基準**——左投手は
   * `executePitch` が左右反転する（腕側が一塁側になる）。
   */
  tiltDeg: number;
  /**
   * **ジャイロ角**[度] 0..90。**回転効率 = cos(gyroDeg)**。
   * 0°＝回転が全部変化に使われる／90°＝完全なジャイロ回転＝まったく曲がらない。
   */
  gyroDeg: number;
  /**
   * **変化のレベル** 1..10（1=500rpm … 10=5000rpm）。→ 有効回転数[rpm]（`effectiveRpmOf`）。
   * ★10種の値がきりのいい数でないのは、**Statcast の実測に合わせた較正値**だから。
   *   見た目のために丸めない（`docs/やってはいけない.md`「実測に合わせた値をきりのいい数で上書きする」）。
   */
  breakLevel: number;
  /**
   * **揺れ** 0..1。回転を揺れに置き換える割合。0=普通の球／1=ナックル。
   * 中間は「揺れながら落ちる」球になる。
   */
  wobble: number;
  /** Seam-Shifted Wake（縫い目）による軸のずれ[度]。回転軸がこの分だけ回る */
  sswDeviationDeg: number;
}

/**
 * レベル1段ぶんの有効回転数[rpm]。**レベル1=500rpm … レベル10=5000rpm**。
 *
 * ★にーくら 2026-08-09「変化量を5000rpmまで設定できるようにして」で 300→500 にした。
 *   実在の最高は約3200rpm（総回転）なので、5000 は**この世界の誇張ぶんを含んだ天井**
 *   ——球速200km/h と同じ判断。
 * ★★**目盛りを伸ばしただけで、既存の球の物理は1ビットも動いていない**——
 *   10種の `breakLevel` を 0.6倍して**有効回転数を据え置いた**（`pitchTypes.test.ts` の
 *   LEGACY 表が見張っている）。動いたのは「レベルいくつと呼ぶか」だけ。
 */
export const BREAK_RPM_PER_LEVEL = 500;

/** 変化レベルの上限（にーくら指定の「1〜10」の 10）。★揺れの強さもこの目盛りで測る */
export const MAX_BREAK_LEVEL = 10;

/**
 * **揺れの揚力係数**。★レベルが上がるほど大きく揺れる——だから
 * にーくらの「レベル1〜10で変化量に差が現れる」が**ナックルでも成立する**。
 * 揺れない球（`wobble`=0）は 0 を返し、物理は 2026-08-09 以前と1ビットも変わらない。
 */
export function wobbleClOf(d: Pick<PitchTypeDef, 'wobble' | 'breakLevel'>): number {
  const w = Math.min(1, Math.max(0, d.wobble));
  if (w <= 0) return 0;
  // ★★揺れは**目盛りの何割か**で決まる（rpm では決まらない）——完全なナックルは
  //   マグヌスの回転が 0 なので、rpm を物差しにすると揺れが常に 0 になってしまう。
  //   だから 1段が何rpmかを変えても（300→500）、**揺れの強さは動かない**
  return w * WOBBLE.CL_MAX * Math.min(1, Math.max(0, d.breakLevel / MAX_BREAK_LEVEL));
}

/**
 * **揺れる球が回っている速さ**[rpm]。
 * ★調査値: ナックルは飛行(約0.45秒)のあいだに **1/4〜1/2回転**するのが理想。
 *   1/2回転なら約67rpm、1/4回転なら約33rpm——その中間。
 *   この回転が**揺れの位相を進める**（速く回るほど揺れの向きが早く変わる）。
 */
export const WOBBLE_SPIN_RPM = 50;

/** 回転効率（0..1）＝ cos(ジャイロ角)。★線形ではない（45°→0.71） */
export function activeSpinOf(d: Pick<PitchTypeDef, 'gyroDeg'>): number {
  return Math.cos((clampGyroDeg(d.gyroDeg) * Math.PI) / 180);
}

/** ジャイロ角[度]を 0..90 へ収める（効率が負になるのを防ぐ） */
export function clampGyroDeg(deg: number): number {
  return Math.min(90, Math.max(0, deg));
}

/**
 * **有効回転数**[rpm]＝マグヌス力を生む回転。
 * ★`wobble` のぶんは回転から引かれ、揺れに回る（ナックルは 0 になる）。
 */
export function effectiveRpmOf(d: Pick<PitchTypeDef, 'breakLevel' | 'wobble'>): number {
  const w = Math.min(1, Math.max(0, d.wobble));
  return Math.max(0, d.breakLevel) * BREAK_RPM_PER_LEVEL * (1 - w);
}

/**
 * **総回転数**[rpm]＝ジャイロ成分も含めた全回転。
 * ★揺れる球は、マグヌスぶんが無くても**揺れを進めるだけの低回転**で回っている。
 */
export function spinRpmOf(d: PitchTypeDef): number {
  const w = Math.min(1, Math.max(0, d.wobble));
  const active = activeSpinOf(d);
  const magnus = active > 1e-9 ? effectiveRpmOf(d) / active : 0;
  return magnus + w * WOBBLE_SPIN_RPM;
}

/**
 * **回転軸が向いている先**[度]（＝マグヌス力の向き）。時計表記に SSW のずれを足したもの。
 * ★SSW は非マグヌス力を別に足すのではなく**軸のずれ**として畳み込む——実務上の観測量
 *   （計測軸と変化から逆算した軸の偏差）と1対1で対応するため（設計書§1.3）。
 */
export function tiltWithSswOf(d: Pick<PitchTypeDef, 'tiltDeg' | 'sswDeviationDeg'>): number {
  return d.tiltDeg + d.sswDeviationDeg;
}

/** 有効回転数[rpm] → 変化レベル（チューナーの表示用の逆写像） */
export function breakLevelForRpm(effectiveRpm: number): number {
  return effectiveRpm / BREAK_RPM_PER_LEVEL;
}

/** 時計表記[度] → "1:15" 形式。★1度=2分（720分/360度） */
export function tiltClockOf(tiltDeg: number): string {
  const deg = ((tiltDeg % 360) + 360) % 360;
  const totalMin = Math.round(deg * 2) % 720;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h === 0 ? 12 : h}:${String(m).padStart(2, '0')}`;
}

/** "1:15" 形式 → 時計表記[度]。読めない文字列は 0（12時）にする */
export function clockToTiltDeg(clock: string): number {
  const m = /^\s*(\d{1,2})\s*:\s*(\d{1,2})\s*$/.exec(clock);
  if (!m) return 0;
  const h = Number(m[1]) % 12;
  const min = Math.min(59, Number(m[2]));
  return ((h * 60 + min) / 2) % 360;
}

// ══════════════════════════════════════════════════════════════
// **回転軸の作り方**（2026-08-09 に `PitcherAI` から移した）
// ══════════════════════════════════════════════════════════════
// ★軸の話は球種の話なので、住所はここが正しい。移した実際の理由はもう一つあって、
//   `PitcherAI` に置いたままだと `pitchMovement`→`PitcherAI`→`pitchMovement` の
//   **循環 import** になり、投球の狙いが「変化量の持ち主」を呼べなかった。

// 変化方向(捕手視点: 0=上,90=三塁側=+x,180=下,270=一塁側)→回転軸。（Task 8.5: 三塁=+xへ規約変更）
// 導出: v̂≈(0,0,-1)。マグヌス力方向 = ŝ×v̂。(sx,sy,0)×(0,0,-1) = (-sy, sx, 0)。
// 望む力方向 d=(dx,dy) に対し sx=dy, sy=-dx。
// d = (sin θ, cos θ)（θ=breakDirDeg, 0度=上=+y, 90度=+x）
// **この軸は速度と垂直なので active spin 100% 相当**。ジャイロ成分を持つ球種は
// spinAxisFor を使う（この関数は activeSpin=1 の特殊形として残す）。
export function spinAxisForBreak(breakDirDeg: number): Vec3 {
  const th = (breakDirDeg * Math.PI) / 180;
  const dx = Math.sin(th);
  const dy = Math.cos(th);
  return vec3(dy, -dx, 0);
}

/**
 * 変化方向と回転効率（active spin）から回転軸を作る。
 * 速度方向(-z)の成分がジャイロ成分になり、その分だけマグヌス力を生まない。
 * 「スライダーは2450rpmだが32%しか変化に使われない」がこれで物理として表現される。
 */
export function spinAxisFor(breakDirDeg: number, activeSpin: number): Vec3 {
  const a = Math.max(0, Math.min(1, activeSpin));
  const t = spinAxisForBreak(breakDirDeg); // 速度と垂直な成分（|t|=1）
  const gyro = Math.sqrt(Math.max(0, 1 - a * a));
  // -z が投球の進行方向。ジャイロ成分をそこへ乗せる（符号はマグヌスに寄与しないので任意）
  return vec3(t.x * a, t.y * a, -gyro);
}

// ══════════════════════════════════════════════════════════════
// **標準10種**（AI投手が持ち、球種ホイールに出る）
// ══════════════════════════════════════════════════════════════
// ★★この10種の**内容も順序も変えない**。`sampleTeams` がここから持ち球を配っているので、
//   足したり並べ替えたりすると**全投手の持ち球が変わり、試合の結果が全部動く**。
//   新しい型は下の `EXTRA_PITCH_TYPES` へ足すこと。
//
// 数値はMLBリーグ平均（2024-2025 Statcast 実測）。すべて M7較正対象。
//   回転効率: FF 90.2% / SI 84.6% / CH 87.5% / FS 83.4% / CU 71.5% / SV 55.3% /
//             ST 51.2% / FC 47.9% / SL 32.0%
//   回転数: 4シーム約2400rpm、スライダー/カーブ 2430〜2530rpm、
//           **スイーパーは全球種で最高の約2800rpm**、チェンジアップ約1750rpm、
//           **スプリット約1350rpm（最少）**
//   時計: 実測の (IVB, HB) から `atan2(HB, IVB)` で逆算した値がそのまま時計表記になる
//
// **重要**: 実測ではカーブ以外ほぼ全球種の IVB が正（＝上向きの揚力を持つ）。
// スプリットやチェンジアップが「落ちる」のは下向きのマグヌスではなく、
// **上向きの揚力が小さくて重力が勝つ**から。
export const PITCH_TYPE_CATALOG: readonly PitchTypeDef[] = [
  // ── 速球系 ──
  { id: 'fastball', name: 'ストレート', speedKmh: 151, tiltDeg: 27, gyroDeg: 25.841932763167126, breakLevel: 4.32, wobble: 0, sswDeviationDeg: 0 },
  { id: 'shuuto', name: 'シュート', speedKmh: 140, tiltDeg: 55, gyroDeg: 34.91520624744419, breakLevel: 3.444, wobble: 0, sswDeviationDeg: 6 },
  { id: 'sinker', name: 'シンカー', speedKmh: 150, tiltDeg: 62, gyroDeg: 31.78833061705162, breakLevel: 3.655, wobble: 0, sswDeviationDeg: 8 },
  { id: 'cutter', name: 'カッター', speedKmh: 143, tiltDeg: 339, gyroDeg: 61.31459798588107, breakLevel: 2.304, wobble: 0, sswDeviationDeg: 0 },
  // ── 変化球系 ──
  { id: 'slider', name: 'スライダー', speedKmh: 137, tiltDeg: 277, gyroDeg: 71.33707511505752, breakLevel: 1.568, wobble: 0, sswDeviationDeg: 0 },
  { id: 'sweeper', name: 'スイーパー', speedKmh: 130, tiltDeg: 270, gyroDeg: 59.33617025761403, breakLevel: 2.856, wobble: 0, sswDeviationDeg: 4 },
  { id: 'slurve', name: 'スラーブ', speedKmh: 133, tiltDeg: 249, gyroDeg: 56.63298703076825, breakLevel: 2.75, wobble: 0, sswDeviationDeg: 0 },
  { id: 'curve', name: 'カーブ', speedKmh: 130, tiltDeg: 207, gyroDeg: 43.945519562308846, breakLevel: 3.6, wobble: 0, sswDeviationDeg: 0 },
  // ── 緩球系（回転が少ないので上向きの揚力が小さく、重力が勝って落ちる） ──
  { id: 'changeup', name: 'チェンジアップ', speedKmh: 138, tiltDeg: 65, gyroDeg: 28.35763657632798, breakLevel: 3.08, wobble: 0, sswDeviationDeg: 8 },
  { id: 'fork', name: 'フォーク', speedKmh: 137, tiltDeg: 72, gyroDeg: 33.901261996866275, breakLevel: 2.241, wobble: 0, sswDeviationDeg: 6 },
] as const;

// ══════════════════════════════════════════════════════════════
// **型の見本市**（にーくら 2026-08-09「ナックルやフォークなど既存の型をはめこんで完成させる」）
// ══════════════════════════════════════════════════════════════
// 日本で使われる31球種を洗って、標準10種に無いものを足した。
//
// ★★**これらは私の設計値**——標準10種と違い、Statcast の実測に一対一で当てた値ではない
//   （日本独自の球種は回転の実測が公開されていない）。文献の球速・変化の向き・
//   「回転が多い/少ない」という定性の記述から私が当てた。**にーくらがチューナーで
//   直すことが前提**。実測と設計を混ぜて報告しないため、ここに明記しておく。
//
// ★ここへ足しても AI投手の持ち球には入らない（`sampleTeams` は `PITCH_TYPE_CATALOG` を見る）。
//   投手に持たせるのは、にーくらがチューナーで選んでから。
export const EXTRA_PITCH_TYPES: readonly PitchTypeDef[] = [
  // ── 速球系 ──
  { id: 'twoseam', name: 'ツーシーム', speedKmh: 147, tiltDeg: 45, gyroDeg: 30, breakLevel: 3.72, wobble: 0, sswDeviationDeg: 5 },
  { id: 'oneseam', name: 'ワンシーム', speedKmh: 145, tiltDeg: 70, gyroDeg: 35, breakLevel: 3.24, wobble: 0, sswDeviationDeg: 10 },
  { id: 'hard_shuuto', name: '高速シュート', speedKmh: 148, tiltDeg: 45, gyroDeg: 33, breakLevel: 3.6, wobble: 0, sswDeviationDeg: 4 },
  // ★ジャイロボール＝回転はあるのに曲がらない球。効率 cos(85°)=8.7%
  { id: 'gyroball', name: 'ジャイロボール', speedKmh: 145, tiltDeg: 0, gyroDeg: 85, breakLevel: 0.33, wobble: 0, sswDeviationDeg: 0 },
  // ── スライダー系 ──
  { id: 'hard_slider', name: '高速スライダー', speedKmh: 145, tiltDeg: 275, gyroDeg: 68, breakLevel: 1.8, wobble: 0, sswDeviationDeg: 0 },
  { id: 'vert_slider', name: '縦スライダー', speedKmh: 138, tiltDeg: 240, gyroDeg: 60, breakLevel: 2.52, wobble: 0, sswDeviationDeg: 0 },
  // ── カーブ系 ──
  { id: 'power_curve', name: 'パワーカーブ', speedKmh: 138, tiltDeg: 200, gyroDeg: 40, breakLevel: 4.08, wobble: 0, sswDeviationDeg: 0 },
  { id: 'drop_curve', name: 'ドロップカーブ', speedKmh: 125, tiltDeg: 180, gyroDeg: 28, breakLevel: 3.96, wobble: 0, sswDeviationDeg: 0 },
  // ★スローカーブは遅い＝飛んでいる時間が長い＝同じ回転でも大きく曲がる
  { id: 'slow_curve', name: 'スローカーブ', speedKmh: 105, tiltDeg: 195, gyroDeg: 30, breakLevel: 3.9, wobble: 0, sswDeviationDeg: 0 },
  { id: 'knuckle_curve', name: 'ナックルカーブ', speedKmh: 132, tiltDeg: 195, gyroDeg: 35, breakLevel: 4.5, wobble: 0, sswDeviationDeg: 0 },
  // ── フォーク系 ──
  // ★SFF はフォークより速く、回転も多い（フォーク1350rpm に対し約1600rpm）
  { id: 'splitter', name: 'スプリット', speedKmh: 143, tiltDeg: 80, gyroDeg: 32, breakLevel: 2.76, wobble: 0, sswDeviationDeg: 5 },
  // ★パームは極端に回転が少なく、遅い。チェンジアップより更に緩い
  { id: 'palm', name: 'パーム', speedKmh: 115, tiltDeg: 60, gyroDeg: 35, breakLevel: 1.44, wobble: 0, sswDeviationDeg: 0 },
  // ── チェンジアップ系 ──
  { id: 'circle_change', name: 'サークルチェンジ', speedKmh: 133, tiltDeg: 80, gyroDeg: 25, breakLevel: 3.18, wobble: 0, sswDeviationDeg: 10 },
  { id: 'vulcan_change', name: 'バルカンチェンジ', speedKmh: 132, tiltDeg: 72, gyroDeg: 28, breakLevel: 3, wobble: 0, sswDeviationDeg: 8 },
  { id: 'fast_change', name: '高速チェンジアップ', speedKmh: 145, tiltDeg: 60, gyroDeg: 26, breakLevel: 3.36, wobble: 0, sswDeviationDeg: 6 },
  // ── シンカー系 ──
  // ★スクリューは腕側へ真横（3時）。山本昌・内海
  { id: 'screw', name: 'スクリュー', speedKmh: 125, tiltDeg: 90, gyroDeg: 30, breakLevel: 3.24, wobble: 0, sswDeviationDeg: 0 },
  // ── 揺れる球・その他 ──
  // ★★ナックル: `wobble: 1` で回転が全部揺れに変わる。レベルが揺れの大きさを決める
  { id: 'knuckle', name: 'ナックル', speedKmh: 105, tiltDeg: 0, gyroDeg: 0, breakLevel: 8, wobble: 1, sswDeviationDeg: 0 },
  // ★イーファス＝超スローの山なり。打者の打ち気を削ぐ球
  { id: 'eephus', name: 'イーファス', speedKmh: 80, tiltDeg: 190, gyroDeg: 35, breakLevel: 2.4, wobble: 0, sswDeviationDeg: 0 },
] as const;

/**
 * **チューナーがはめこめる型の全部**（標準10種＋見本市）。
 * ★配球には使わない——AI投手の持ち球は `PITCH_TYPE_CATALOG` から配られる。
 */
export const PITCH_TYPE_PRESETS: readonly PitchTypeDef[] = [
  ...PITCH_TYPE_CATALOG,
  ...EXTRA_PITCH_TYPES,
];
