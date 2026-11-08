import { Vec3, vec3, add, scale, length, normalize, cross } from '../math/vec3';
import { FIELD } from '../geometry/FieldConstants';

// 投球・打球共通のボール空力。PitchFlightSolverの元実装と同じ式・同じ計算順
// （リファクタで数値が1bitでも変わるとリプレイ互換が壊れるため、順序を変えないこと）。
export const PHYS = {
  DT: 1 / 240,
  GRAVITY: 9.81,
  AIR_RHO: 1.225,
  CD: 0.35,
} as const;

const AREA = Math.PI * FIELD.BALL_RADIUS * FIELD.BALL_RADIUS;

/**
 * 揚力（マグヌス）係数。**有効回転**（速度と垂直な成分 ω·sinθ）を渡すこと。
 * スピン因子 S = R·ω_eff / v。
 *
 * 値の決め方（にーくら野球の方針）: 文献の式をそのまま採るのではなく、
 * **Statcastの実測変化量（IVB/HB）を再現する係数に合わせる**。判定基準は係数ではなく
 * 観測量であるべきなので（原因主義）。文献の Cl は同じSでも 0.15〜0.25 とばらつきが大きく、
 * どれを採るかで球種の変化量が2倍変わってしまう。
 *
 * 実測2点（4シーム: S=0.197で合成変化17.9in / スライダー: S=0.079で8.1in）から解くと
 * **原点を通る直線 Cl ≈ 0.9·S** になった（両点を同時に満たす形は原点通過の直線のみ）。
 * 上限0.32は野球ボールのClの既知の最大値（旧実装の飽和値0.319と同じ根拠）。
 * 参考: S=0.2でCl=0.18。文献値は Sawicki 0.21 / Nathan 約0.22 で、やや低めを採っている。
 *
 * 旧実装 `0.319(1 − exp(−2.48S))` は S=0.19 で 0.120——実測変化量を再現するには
 * **42%不足**していた（4シームの誘導縦変化が12.0インチ、実測は15〜17インチ）。
 * Sawickiの区分線形（1.5S / 0.09+0.6S）は逆に低回転側で35%過大になり、
 * 「回転効率の低いスライダーが曲がりすぎる」結果になった。
 * 設計書 2026-07-30-pitch-physics-design.md §1.4 / §4-1。
 */
export const CL_SLOPE = 0.9;

/**
 * 揚力係数の上限。
 *
 * ★★★**0.32 は実物の値**（野球ボールの Cl の既知の最大値）。にーくらの指定
 * （2026-08-09「揚力の天井を上げる」）で **0.55** へ上げた——理由は測って出た事実:
 * 0.32 だと `Cl = 0.9·S` が **S ≥ 0.356 で頭打ち**になり、到達34m/s では
 * **有効約3150rpm から先、回しても1ミリも曲がらない**。
 * 「変化量を5000rpmまで設定できるように」（にーくら）と噛み合っていなかった。
 *
 * 0.55 の根拠: 有効5000rpm・到達34m/s のとき S=0.564 → Cl=0.507。**そこまで効かせる**値。
 * ★球速200km/h・回転5000rpm と同じ「実在の範囲に閉じない」判断の続き。
 * ★★打球にも同じ Cl が効く（同じボールなので分けない）。上げた前後は実測して記録した。
 */
export const CL_MAX = 0.55;
export function liftCoefficient(effectiveSpinRadPerSec: number, speed: number): number {
  if (speed < 1e-6) return 0;
  const s = (FIELD.BALL_RADIUS * Math.abs(effectiveSpinRadPerSec)) / speed;
  return Math.min(CL_SLOPE * s, CL_MAX);
}

/**
 * **揺れ（ナックル）**（にーくら 2026-08-09「ナックルやフォークなど既存の型をはめこんで」）。
 *
 * 調査（Borg & Morrissey / Illinois の軌道解析・Wikipedia）:
 * ナックルは**無回転ではない**——飛行(約0.45秒)のあいだに **1/4〜1/2回転**するのが理想で、
 * 完全な無回転より良い。縫い目が剥離域へ入ったり出たりして後流が左右に飛び移り、
 * **横力の向きがおよそ1秒に1回反転する**。だから「1球のあいだに向きが1回変わるかどうか」。
 *
 * ★★★**乱数にしない**。揺れは**回転位相の関数**にしてある。理由:
 *   ・`core/determinism-guard.test.ts` のとおり、同じ球は必ず同じ軌道でなければ
 *     リプレイが成立しない
 *   ・乱数の揺れは打者にとって**ただの理不尽**。位相なら「回転数を変えると揺れ方が変わる」
 *     という因果があり、にーくらがチューナーで作り込める
 * そして**物理としてもこちらが正しい向き**——文献の「1秒に1回向きが変わる」は、
 * まさに回転位相の関数だから起きる。
 */
export const WOBBLE = {
  /** 揺れの揚力係数の最大（`wobble`=1・変化レベル10のとき）。★実測で合わせた値 */
  CL_MAX: 0.16,
  /**
   * **リリースした瞬間に縫い目がどこを向いていたか**[rad]（既定値）。
   *
   * ★★★**1球ごとに違う**のがナックルの正体。同じ握りでも縫い目の向きが少し違えば
   * まったく別の踊り方をする——だから打者にも捕手にも読めない。
   * `executePitch` は**制球誤差から**この位相を作る（`atan2(errY, errX)`）:
   *   ・**乱数を1回も余計に引かない**——引く回数と順序が変わると、既存の試合が全部変わる
   *     （`PitcherAI` の注記。決定論とリプレイ互換の約束）
   *   ・**リリースのずれが縫い目の向きを決める**のは物理としても自然
   * ここに書いてある値は、誤差を渡さずに測るとき（チューナー・検査）の既定。
   */
  PHASE0: 0.9,
} as const;

/**
 * **揺れの加速度**。速度と垂直な平面の中で、力の向きが回転位相とともに回る。
 * @param wobbleCl 揺れの揚力係数（`pitchTypes.wobbleClOf`）
 * @param spinRpm  その球の総回転数（位相を進める速さ）
 * @param t        リリースからの経過[秒]
 * @param phase0   リリース時の縫い目の向き[rad]。★1球ごとに違う（上の注記）
 */
export function wobbleAccel(
  vel: Vec3,
  wobbleCl: number,
  spinRpm: number,
  t: number,
  phase0: number = WOBBLE.PHASE0
): Vec3 {
  const speed = length(vel);
  if (speed < 1e-9 || wobbleCl <= 0) return vec3(0, 0, 0);
  const vHat = normalize(vel);
  // 速度と垂直な平面の基底。★真っ直ぐ投げるとき right=+x（右投手の腕側）・upP=+y になる
  const rightRaw = cross(vHat, vec3(0, 1, 0));
  const right = length(rightRaw) < 1e-6 ? vec3(1, 0, 0) : normalize(rightRaw);
  const upP = cross(right, vHat);
  const phase = 2 * Math.PI * (Math.abs(spinRpm) / 60) * t + phase0;
  const mag = (0.5 * PHYS.AIR_RHO * wobbleCl * AREA * speed * speed) / FIELD.BALL_MASS;
  const c = Math.cos(phase);
  const s = Math.sin(phase);
  return vec3(
    (right.x * c + upP.x * s) * mag,
    (right.y * c + upP.y * s) * mag,
    (right.z * c + upP.z * s) * mag
  );
}

// spinRpmは負も許す（負=軸に対して逆回転。Cl計算は|ω|で行い、向きはマグヌス項の符号で反転する。
// 指数式に負のsを入れると発散するため、絶対値化は必須）
//
// ★`wobbleCl`/`t` は**省略できる**（既定 0）。省略したときの計算順は 2026-08-09 以前と
//   1ビットも変わらない——揺れの項は 0 のとき**足さない**（`add` を1回増やすだけで
//   浮動小数の丸めが動き、打球のゴールデン写しが動いてしまう）。
export function ballAcceleration(
  vel: Vec3,
  spinAxis: Vec3,
  spinRpm: number,
  wobbleCl = 0,
  t = 0,
  wobblePhase: number = WOBBLE.PHASE0
): Vec3 {
  const speed = length(vel);
  if (speed < 1e-9) return vec3(0, -PHYS.GRAVITY, 0);
  const vHat = normalize(vel);
  const dragMag = 0.5 * PHYS.AIR_RHO * PHYS.CD * AREA * speed * speed;
  const drag = scale(vHat, -dragMag / FIELD.BALL_MASS);
  const axis = normalize(spinAxis);
  const spinSign = spinRpm < 0 ? -1 : 1;
  const omega = (Math.abs(spinRpm) * 2 * Math.PI) / 60;
  // 回転軸と速度の外積: 向きがマグヌス力の方向、長さが sinθ（=有効回転の割合＝active spin）。
  // **Clは有効回転から出し、方向は正規化した外積を使う**——旧実装は全回転からClを出して
  // 正規化しない外積（sinθ倍）を掛けており、飽和領域で系統的に低く出ていた
  // （実測: スライダー(active35%)で21%低い＝到達点2.9cmの差）。
  const c = cross(axis, vHat);
  const sinTheta = length(c);
  let magnus = vec3(0, 0, 0);
  if (sinTheta > 1e-9) {
    const cl = liftCoefficient(omega * sinTheta, speed);
    const magnusMag = 0.5 * PHYS.AIR_RHO * cl * AREA * speed * speed;
    magnus = scale(c, (spinSign * magnusMag) / (sinTheta * FIELD.BALL_MASS));
  }
  const base = add(add(drag, magnus), vec3(0, -PHYS.GRAVITY, 0));
  // ★揺れが無いなら**ここで返す**。足し算を1回増やすだけで丸めが動く（上の注記）
  if (wobbleCl <= 0) return base;
  return add(base, wobbleAccel(vel, wobbleCl, spinRpm, t, wobblePhase));
}
