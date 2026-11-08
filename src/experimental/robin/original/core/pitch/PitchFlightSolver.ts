import { Vec3, add, scale } from '../math/vec3';
import { ballAcceleration, PHYS, WOBBLE } from '../physics/ballAero';
import { FIELD } from '../geometry/FieldConstants';

export { PHYS } from '../physics/ballAero';

export interface ReleaseState {
  pos: Vec3;
  vel: Vec3;
  spinAxis: Vec3; // 単位ベクトル想定（内部で正規化する）
  spinRpm: number;
  /**
   * **揺れの揚力係数**（ナックル系）。未指定＝0＝揺れない。
   * ★0 のときの計算は 2026-08-09 以前と1ビットも同じ（`ballAero.ballAcceleration` の注記）。
   */
  wobbleCl?: number;
  /**
   * **リリースした瞬間に縫い目がどこを向いていたか**[rad]。★これが1球ごとに違うから
   * ナックルは読めない。`executePitch` が制球誤差から作る（乱数は1回も余計に引かない）。
   */
  wobblePhase?: number;
}

export interface PlateCrossing {
  x: number;
  y: number;
  t: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface PitchPath {
  points: Vec3[];
  dt: number;
  plate: PlateCrossing;
  /** この時刻以降は球だけを隠す特殊球。経路と当たり判定はそのまま進む。 */
  hiddenAfterT?: number;
  /**
   * ★★**その球の回転**（軸・回転数）。物理で使ったリリースの値をそのまま持ち回る。
   * 絵のボールはこれを読んで回る（`BallVisual.setSpin`）——**絵だけ別の回転にしない**
   * ため（にーくら恒久原則「見た目＝物理の一致」）。変化の向きと回転の向きが
   * 食い違って見えたら、それは嘘をついている。
   */
  spinAxis: Vec3;
  spinRpm: number;
}

// solvePitchFlightと同一の積分をたどりながら各tick位置を記録する。
// （同一関数を共有せず並記すると将来ドリフトするので、solvePitchFlightは内部的に
// solvePitchPathを呼ぶ形に書き換える: plateだけ返す薄いラッパにする）
export function solvePitchPath(release: ReleaseState): PitchPath {
  let pos = release.pos;
  let vel = release.vel;
  const points: Vec3[] = [pos];
  let plate: PlateCrossing | null = null;
  for (let i = 0; i < 2000; i++) {
    // ★t を渡すのは揺れ（ナックル）の位相のため。揺れない球では第4引数が 0 なので
    //   `ballAcceleration` は即座に従来と同じ値を返す（丸めも動かない）
    const acc = ballAcceleration(
      vel,
      release.spinAxis,
      release.spinRpm,
      release.wobbleCl ?? 0,
      i * PHYS.DT,
      release.wobblePhase ?? WOBBLE.PHASE0
    );
    const nextVel = add(vel, scale(acc, PHYS.DT));
    const nextPos = add(pos, scale(nextVel, PHYS.DT));
    if (plate === null && nextPos.z <= 0) {
      // 判定の真実＝本塁通過点（z=0）。ここは従来と1ビットも変えない
      const f = pos.z / (pos.z - nextPos.z);
      const t = (i + f) * PHYS.DT;
      const ix = pos.x + (nextPos.x - pos.x) * f;
      const iy = pos.y + (nextPos.y - pos.y) * f;
      plate = { x: ix, y: iy, t, vx: nextVel.x, vy: nextVel.y, vz: nextVel.z };
    }
    pos = nextPos;
    vel = nextVel;
    points.push(pos);
    // 「ミットに収まるまでが1球」（にーくら原則 2026-07-30）。本塁通過後も捕手の
    // ミット位置まで積分を続け、経路をそこまで持たせる。判定に使うplateは上で
    // 確定済みなので結果は不変——延長されるのは見せる経路だけ。
    // 地面到達（ワンバウンド）は本塁通過後にだけ打ち切る: 通過前に打ち切ると
    // ワンバウンド球のplateが出せず不変条件を壊すため。
    if (plate !== null && (pos.z <= FIELD.CATCH_Z || pos.y <= FIELD.GROUND_Y + FIELD.BALL_RADIUS)) {
      // ★回転は**リリースの値をそのまま**持ち回る（絵が読む。`PitchPath.spinAxis` の注記）
      return { points, dt: PHYS.DT, plate, spinAxis: release.spinAxis, spinRpm: release.spinRpm };
    }
  }
  throw new Error('pitch flight did not reach the plate (invariant violation)');
}

export function solvePitchFlight(release: ReleaseState): PlateCrossing {
  return solvePitchPath(release).plate;
}
