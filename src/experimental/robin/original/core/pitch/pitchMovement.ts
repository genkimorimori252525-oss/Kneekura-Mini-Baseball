import { vec3 } from '../math/vec3';
import {
  PitchTypeDef,
  activeSpinOf,
  spinAxisFor,
  spinRpmOf,
  tiltWithSswOf,
  wobbleClOf,
} from './pitchTypes';
import { ReleaseState, solvePitchPath } from './PitchFlightSolver';
import { releasePointFor } from './releasePoint';

import { WOBBLE } from '../physics/ballAero';

// ══════════════════════════════════════════════════════════════
// **その球が実際にどれだけ曲がるか**（＝球種の唯一の物差し）
// ══════════════════════════════════════════════════════════════
//
// 誘導変化（induced break）= 同じ初速で「回転あり」と「回転なし（重力＋抗力だけ）」を
// 飛ばし、本塁での到達点の差。Statcast の IVB / HB と同じ定義。
//
// ★★★**この関数が、変化量の唯一の出どころ**。以前はこの計算が
//   `pitchMovement.test.ts` の中にだけ書かれていて、**チューナーは別の式で表示していた**。
//   `handModel.test.ts` で学んだのと同じ形の穴——「守る側が押す点」と「検査が測る点」が
//   別々になると、片方だけ直しても気づけない。
//
// ★★もうひとつ直したもの: 旧テストは `vec3(0.25, 1.8, PITCH_DISTANCE - 1.8)` という
//   **リリース点の写し**を持っていた。`releasePoint.ts` の墓に「★★★座標をここ以外に
//   書かない」と書いてあるのに、4か所目が残っていた（1.8m は 2026-08-09 に 1.4m へ
//   変わった値なので、**すでに古かった**）。いまは `releasePointFor` を呼ぶだけ。

const M2IN = 39.3701;

export interface InducedBreak {
  /** 誘導縦変化[m]（+ = 重力に逆らって浮く） */
  ivbM: number;
  /** 誘導横変化[m]（+ = 三塁側 = 右投手の腕側） */
  hbM: number;
  /** 誘導縦変化[inch]（Statcast と同じ単位） */
  ivbIn: number;
  /** 誘導横変化[inch] */
  hbIn: number;
  /** 本塁到達までの時間[秒] */
  timeSec: number;
  /**
   * **実際に曲がった向き**[度]（時計表記と同じ規約: 0=12時, 90=3時）。
   * ★これが球種に書いた `tiltDeg` と合っているかが、球種版の「見た目＝物理の一致」。
   */
  dirDeg: number;
  /** 合成変化量[cm]（縦横の大きさ） */
  totalCm: number;
  /**
   * **本塁に着いたときの速さ**[m/s]。★揚力が飽和する回転数はこれで決まる（発射の速さではない）
   * ——`pitchInvariants.spinStillCurves` が使う。
   */
  plateSpeedMs: number;
}

/**
 * **その球種を実際に投げて、変化量を測る**（右投手・ど真ん中へ真っ直ぐ投げた場合）。
 *
 * ★制球誤差もマグヌス補正も通さない**素の物理**を見る——`executePitch` は
 * 「投手が自分の球の変化を織り込んで狙いを戻す」ので、そこを通すと変化が打ち消えて測れない。
 */
export function inducedBreakOf(
  def: PitchTypeDef,
  throws: 'R' | 'L' = 'R',
  wobblePhase: number = WOBBLE.PHASE0
): InducedBreak {
  return measure(def, throws, wobblePhase, true);
}

/**
 * **回転だけが作る変化**（揺れを切って測る）。
 *
 * ★★不変条件⑨（書いた軸の向きへ曲がる）が見るのは**こちら**。ナックルの 25.8cm は
 * 全部揺れが作ったもので、**その向きは1球ごとに変わる**——「軸を12時と書いたのに
 * 344°へ曲がった」と責めても意味がない。`tiltDeg` が約束しているのは
 * **回転が生む変化の向き**だけなので、そこだけを取り出して突き合わせる。
 * ★純粋なナックルはこれがゼロになり、⑨は「向きに意味なし」として見送る。
 */
export function spinBreakOf(def: PitchTypeDef, throws: 'R' | 'L' = 'R'): InducedBreak {
  return measure(def, throws, WOBBLE.PHASE0, false);
}

/**
 * **投げた1球**の誘導変化（回転が無かったら通ったはずの道からのずれ）。
 *
 * ★`inducedBreakOf` が測るのは**球種の定義**、こちらが測るのは**実際に投げた1球**
 * （制球誤差も狙いの補正も乗ったあとのリリース）。見るものは違うが、
 * **式は1本**——チューナーが自前で「回転数0でもう一度飛ばす」を書き直すと、
 * 定義の変化量と1球の変化量が別の物差しになる。
 */
export function breakOfRelease(release: ReleaseState): InducedBreak {
  const on = solvePitchPath(release);
  // 基準は「重力と抗力だけ」。★揺れも切る——揺れは変化の一部なので基準側に残さない
  const off = solvePitchPath({ ...release, spinRpm: 0, wobbleCl: 0 });
  const ivbM = on.plate.y - off.plate.y;
  const hbM = on.plate.x - off.plate.x;
  const deg = (Math.atan2(hbM, ivbM) * 180) / Math.PI;
  return {
    ivbM,
    hbM,
    ivbIn: ivbM * M2IN,
    hbIn: hbM * M2IN,
    timeSec: on.plate.t,
    dirDeg: ((deg % 360) + 360) % 360,
    totalCm: Math.hypot(ivbM, hbM) * 100,
    plateSpeedMs: Math.hypot(on.plate.vx, on.plate.vy, on.plate.vz),
  };
}

function measure(
  def: PitchTypeDef,
  throws: 'R' | 'L',
  wobblePhase: number,
  useWobble: boolean
): InducedBreak {
  const pos = releasePointFor(throws);
  const speed = def.speedKmh / 3.6;
  const vel = vec3(0, 0, -speed);
  const rawDir = tiltWithSswOf(def);
  // カタログは右投手基準。左投手は左右反転する（`executePitch` と同じ規約）
  const dir = throws === 'L' ? 360 - rawDir : rawDir;
  const spinAxis = spinAxisFor(dir, activeSpinOf(def));
  // ★揺れを切っても**回転数は据え置く**——「その球が実際に持っている回転」で測るため。
  //   `{...def, wobble: 0}` にすると回転が復活してしまい、別の球を測ることになる
  const wobbleCl = useWobble ? wobbleClOf(def) : 0;
  return breakOfRelease({ pos, vel, spinAxis, spinRpm: spinRpmOf(def), wobbleCl, wobblePhase });
}

/** 揺れる球の「毎回どれくらい違うか」 */
export interface WobbleSpread {
  /** 変化量の最小[cm] */
  minCm: number;
  /** 変化量の最大[cm] */
  maxCm: number;
  /**
   * **着弾点がどれだけ散るか**[cm]（2球の到達点が最も離れる距離）。
   *
   * ★★★**これがナックルの読めなさの本体**。実測してみると、揺れの**大きさ**は
   * 23〜26cm でほとんど変わらず、変わるのは**向き**だった——だから
   * 「変化量が何cm」を見ていると「毎回ほぼ同じ球」に見えてしまう。
   * 打者にとって効くのは**どこへ来るか**なので、そこを測る。
   */
  spreadCm: number;
  /** 変化の向きが散る幅[度]（360 に近いほど「どこへ飛ぶか読めない」） */
  dirSpreadDeg: number;
}

/**
 * **その球が1球ごとにどれだけ違うか**を測る（縫い目の向きを一周ぶん振ってみる）。
 *
 * ★★★揺れる球に**変化量の数を1つだけ出すのは嘘**になる——ナックルは
 * 「毎回違う」ことが球種そのものだから。チューナーは幅で見せる。
 * ★揺れない球は幅がゼロになる（縫い目の向きは何の意味も持たない）。
 */
export function wobbleSpreadOf(def: PitchTypeDef, throws: 'R' | 'L' = 'R', samples = 12): WobbleSpread {
  let minCm = Infinity;
  let maxCm = -Infinity;
  const dirs: number[] = [];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const m = inducedBreakOf(def, throws, (2 * Math.PI * i) / samples);
    minCm = Math.min(minCm, m.totalCm);
    maxCm = Math.max(maxCm, m.totalCm);
    pts.push({ x: m.hbM * 100, y: m.ivbM * 100 });
    if (m.totalCm > 1) dirs.push(m.dirDeg);
  }
  // 着弾点が最も離れる2球の距離＝打者から見た「読めなさ」
  let spreadCm = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      spreadCm = Math.max(spreadCm, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    }
  }
  // 向きの散らばり: 一番大きな「隙間」の外側＝実際に散っている角度
  let spread = 0;
  if (dirs.length > 1) {
    const sorted = [...dirs].sort((a, b) => a - b);
    let gap = sorted[0] + 360 - sorted[sorted.length - 1];
    for (let i = 1; i < sorted.length; i++) gap = Math.max(gap, sorted[i] - sorted[i - 1]);
    spread = 360 - gap;
  }
  return { minCm, maxCm, spreadCm, dirSpreadDeg: spread };
}
