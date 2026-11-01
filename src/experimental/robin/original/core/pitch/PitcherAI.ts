import { vec3 } from '../math/vec3';
import { FIELD } from '../geometry/FieldConstants';
import { DeterministicRng } from '../rng/DeterministicRng';
import { PlayerRecord } from '../model/types';
import {
  PitchTypeDef,
  activeSpinOf,
  spinAxisFor,
  spinRpmOf,
  tiltWithSswOf,
  wobbleClOf,
} from './pitchTypes';
import { ReleaseState, solvePitchFlight } from './PitchFlightSolver';
import { releasePointFor } from './releasePoint';
import { breakOfRelease } from './pitchMovement';
import { PitchInput, RELEASE, releaseBiasY, releaseSpinScale } from './PitchInput';
import { velocityScale, controlSigmaScale } from './PitcherStamina';

export interface PitchIntent {
  pitchType: PitchTypeDef;
  targetX: number;
  targetY: number;
}

/** 投げる前のカウント。配球はこれで変わる（無指定なら 0-0 相当） */
export interface PitchCount {
  balls: number;
  strikes: number;
}

/**
 * **ゾーンを狙う確率**。
 *
 * ★2026-08-03 較正: それまで一律 0.65 で、結果として**実際にゾーンへ入った球が 65.1%**
 * だった（実測 MLB Zone% は約 48%）。**投手が入れすぎていた。**
 *
 * ★★このとき**スイング率だけは 46.4%（実測 47%）と合っていた**——ゾーンが多すぎるぶんと、
 * ボール球を追いかけなさすぎるぶん（chase 14.4% 対 実測 31%）が**打ち消し合っていた**だけ。
 * 合計が合っているから内訳も合っている、と読んではいけない
 * （`docs/やってはいけない.md`「接触率が実測どおりだから打撃は正しい、と読む」と同じ形）。
 *
 * カウントで動かす: 3ボールなら入れざるを得ず、2ストライクなら**釣り球**を投げる。
 * 実測（MLB, Baseball Savant のカウント別 Zone%）でも 3-0 は約 65%、0-2 は約 35%。
 */
export const ZONE_INTENT = { base: 0.45, behind: 0.2, ahead: -0.15, min: 0.2, max: 0.75 } as const;

/**
 * **投手が自分の球の変化を織り込める割合**（にーくら 2026-08-09「投手の補正を弱める」）。
 *
 * 1.0 ＝ 完璧に織り込む。それだと**どの球種も寸分たがわず同じ点に着く**ので、
 * 打者から見た球種の差が消える（実測: ど真ん中狙いで全球種が x=3.2〜5.4cm の **1cm 幅**に収まった）。
 * 残したぶんは「その球が曲がる向き」へ流れる——曲がる球ほど狙いが甘くなる。
 *
 * ★★★**制球の能力値で決まる**。一律 0.72 にしたら、制球の良い投手でも
 * **ストレートが 11.3cm 浮いてゾーンを出た**——「どんな投手も自分の球を読み違える」
 * のは嘘で、実際は**そこが上手さそのもの**。制球100なら完璧に織り込み、
 * 制球40なら曲がる球ほど狙いから流れる。
 * ★重力は**この割合の外**（`executePitch` を見よ）——重力は毎球同じで、読み違えようがない。
 */
export const AIM_COMP = { base: 0.55, perControl: 0.45 } as const;

export function aimCompensationFor(control: number): number {
  const c = Math.max(0, Math.min(100, control));
  return AIM_COMP.base + AIM_COMP.perControl * (c / 100);
}

export function zoneIntentProb(count?: PitchCount): number {
  let p = ZONE_INTENT.base;
  if (count) {
    if (count.balls >= 3) p += ZONE_INTENT.behind;
    if (count.strikes >= 2) p += ZONE_INTENT.ahead;
  }
  return Math.max(ZONE_INTENT.min, Math.min(ZONE_INTENT.max, p));
}

export function choosePitchIntent(
  pitcher: PlayerRecord,
  rng: DeterministicRng,
  count?: PitchCount
): PitchIntent {
  const pitchType = pitcher.pitchTypes[rng.nextInt(pitcher.pitchTypes.length)];
  // M1簡易配球: ゾーン内一様 or 際どい外周。配球AI本実装はM5。
  let targetX: number;
  let targetY: number;
  if (rng.nextFloat() < zoneIntentProb(count)) {
    targetX = rng.nextRange(-FIELD.SZ_HALF_WIDTH * 0.9, FIELD.SZ_HALF_WIDTH * 0.9);
    targetY = rng.nextRange(FIELD.SZ_BOTTOM + 0.05, FIELD.SZ_TOP - 0.05);
  } else {
    const edge = rng.nextInt(4);
    const off = rng.nextRange(0.02, 0.18);
    if (edge === 0) { targetX = rng.nextRange(-0.15, 0.15); targetY = FIELD.SZ_TOP + off; }
    else if (edge === 1) { targetX = rng.nextRange(-0.15, 0.15); targetY = FIELD.SZ_BOTTOM - off; }
    else if (edge === 2) { targetX = FIELD.SZ_HALF_WIDTH + off; targetY = rng.nextRange(0.55, 1.0); }
    else { targetX = -(FIELD.SZ_HALF_WIDTH + off); targetY = rng.nextRange(0.55, 1.0); }
  }
  return { pitchType, targetX, targetY };
}

/**
 * 意図（球種・狙い）を実際のリリース状態へ落とす。
 *
 * `input` は憑依投手（M4のブルペン／将来の試合）のリリース操作。**未指定のときは
 * AI投手の現行挙動とビット同一**になるよう、全ての倍率が恒等（×1.0）になる値を使う
 * ——既存の試合テスト・スイープを1ビットも動かさないための約束（設計書§3）。
 */
export function executePitch(
  pitcher: PlayerRecord,
  intent: PitchIntent,
  rng: DeterministicRng,
  input?: PitchInput
): ReleaseState {
  // 憑依投手の操作ぶん。AI（input未指定）は疲労なし・全力なし・ずれなしと等価
  const staminaLeft = input ? input.staminaLeft : 100;
  const fullPower = input ? input.fullPower : false;
  const velocityBoost = fullPower ? RELEASE.FULL_POWER_VELOCITY : 1;
  const spinBoost = fullPower ? RELEASE.FULL_POWER_SPIN : 1;
  // リリースずれ由来の2つ: 高低バイアス（決定論的な因果）と回転効率の低下（棒球化）
  const biasY = input ? releaseBiasY(input) : 0;
  const spinScale = input ? releaseSpinScale(input) : 1;

  const speedMs =
    (intent.pitchType.speedKmh / 3.6) *
    (0.96 + (pitcher.ratings.velocity / 100) * 0.08) *
    velocityScale(staminaLeft) *
    velocityBoost;
  // 右投手のリリースは捕手から見て左＝三塁側(+x)。Task 8.5: 三塁=+xへ規約変更に伴い符号反転。
  // ★リリース高は**地面からの高さ**。ゾーンと同じ土俵に乗せる（`FIELD.GROUND_Y`）
  // ★★★**座標はここに書かない**（2026-08-08）。絵・リング・判定で4か所に書かれていて、
  // 地面を足していたのは判定だけ＝**絵は23cm低い所で離していた**。唯一の出どころは
  // `releasePoint.ts`。にーくらが投手チューナーで動かした値は `pitcher.release` で届く
  const releasePos = releasePointFor(pitcher.throws, pitcher.release);

  // 制球誤差: 制球0で標準偏差0.20m、制球100で0.045m（M7較正対象）
  // rng draws は必ずここで（補正計算の前に）行う: 補正の有無に関わらず消費される乱数の
  // 個数・順序を不変に保つため（決定論・リプレイ互換のため。Task 13 診断で確認済み）。
  // 疲労で制球が広がる（σの倍率。乱数を引く回数・順序は不変——σはただの係数なので
  // 先に掛けても消費順序に影響しない。input未指定なら倍率は厳密に1.0でビット同一）
  const sigma = (0.2 - (pitcher.ratings.control / 100) * 0.155) * controlSigmaScale(staminaLeft);
  const errX = rng.nextGaussian() * sigma;
  const errY = rng.nextGaussian() * sigma;
  // ★★★**リリースのずれが、縫い目の向きを決める**（ナックルが1球ごとに違う理由）。
  // 実物のナックルは「同じ握りでも縫い目の向きが少し違えば別の踊り方をする」から読めない。
  // ★**乱数をここで余計に引かない**——引く回数と順序が変われば、既存の試合が全部変わる
  //   （上の注記のとおり、rng の消費は errX/errY の2回のまま）。すでに引いた誤差から作る。
  //   物理としても筋が通る: リリースがずれれば指のかかり方も変わる。
  const wobblePhase = Math.atan2(errY, errX);

  const dist = releasePos.z;
  const t = dist / speedMs;
  const dropComp = 0.5 * 9.81 * t * t * 0.85; // 抗力減速ぶんを0.85で経験補正
  // ★★**回転はカタログから「導出」される**（2026-08-09）——球種が持っているのは
  //   軸の時計表記・ジャイロ角・変化レベルで、回転数はそこから出る。
  //   変化量補正（能力値）で±10%動かす
  const breakScale = (0.9 + (pitcher.ratings.breakBoost / 100) * 0.2) * spinScale * spinBoost;
  const spinRpm = spinRpmOf(intent.pitchType) * breakScale;
  // ★揺れ（ナックル）も同じ倍率で動く——「変化」の能力値が高いほど大きく踊り、
  //   リリースがずれた日は踊らない。回転する球とちぐはぐにしないため
  const wobbleCl = wobbleClOf(intent.pitchType) * breakScale;
  // 軸は「回転軸の時計表記＋SSW(縫い目)による偏差」を回転効率で傾けたもの。
  // SSWは非マグヌス力を別に足すのではなく**軸のずれ**として畳み込む——実務上の観測量
  // （計測軸と変化から逆算した軸の偏差）と1対1で対応するため（設計書§1.3）
  // カタログは右投手基準。左投手は変化方向を左右反転する（腕側が一塁側になる）
  const rawDir = tiltWithSswOf(intent.pitchType);
  const breakDir = pitcher.throws === 'L' ? 360 - rawDir : rawDir;
  const spinAxis = spinAxisFor(breakDir, activeSpinOf(intent.pitchType));

  const buildRelease = (aimX: number, aimY: number): ReleaseState => {
    const dirX = (aimX - releasePos.x) / dist;
    const dirY = (aimY + dropComp - releasePos.y) / dist;
    return {
      pos: releasePos,
      vel: vec3(dirX * speedMs, dirY * speedMs, -speedMs),
      spinAxis,
      spinRpm,
      wobbleCl,
      wobblePhase,
    };
  };

  // Task 13 較正修正（コントローラ承認・修正1）: マグヌス補正。
  // 従来は重力ドロップのみ一次近似補償し、変化球のマグヌス変位（横/縦）を全く見込んでいなかった
  // ため、変化球の実到達点が意図ゾーンから系統的に大きくズレ、ゾーン内到達率が崩壊して四球が
  // 激増していた（診断: 変化球のinZone率5.7〜8.7% vs 直球67.5%、四球率49.8%/打席）。
  // ここでは「誤差なしの狙い」で一度 solvePitchFlight を走らせて実到達点を測定し、
  // 意図ターゲットとのズレ（=このピッチのマグヌス変位＋dropComp近似残差）を求め、
  // その分だけ狙いを逆方向に補正してから制球誤差(errX/errY)を乗せて本番の初速を組み立てる。
  // 投手が「自分の球の変化を織り込んで腕を振る」ことに相当する。ソルバー呼び出しは決定論的・
  // 副作用なしなので2回呼んでも結果は不変であり、rng消費は上のerrX/errYの2回のみ（既存と同じ）。
  const probe = solvePitchFlight(buildRelease(intent.targetX, intent.targetY));
  // ══════════════════════════════════════════════════════════════
  // ★★★**重力ぶんと変化ぶんを分ける**（にーくら 2026-08-09「投手の補正を弱める」）
  // ══════════════════════════════════════════════════════════════
  // 弱めるのは**その球の変化**を織り込む力だけ。**重力は完全に織り込む**——
  // 投手が重力を読み違えることはない（毎球同じで、一生投げ続けている）。
  // ★分けずに一括で 0.72 倍したら、`dropComp` の近似残差（重力の15%）まで
  //   織り込み残しになり、**スローカーブが 28.6cm も低く**なった。それは別の話。
  // ★★分け方は**変化量の持ち主**に測らせる（`pitchMovement.breakOfRelease`）——
  //   ここで「回転を0にしてもう一度飛ばす」を書き写すと、**式が2本**になる。
  //   決定論・副作用なしなので rng の消費は増えない（errX/errY の2回のまま）。
  const brk = breakOfRelease(buildRelease(intent.targetX, intent.targetY));
  /** その球の**変化**が生むずれ。ここだけ織り込みきれない */
  const breakX = brk.hbM;
  const breakY = brk.ivbM;
  /** 重力（と抗力）だけで生じるずれ。**丸ごと織り込む** */
  const gravX = probe.x - breakX - intent.targetX;
  const gravY = probe.y - breakY - intent.targetY;
  const comp = aimCompensationFor(pitcher.ratings.control);
  const offsetX = gravX + breakX * comp;
  const offsetY = gravY + breakY * comp;

  // ★★★**投手は自分の球の変化を、完全には織り込めない**（にーくら 2026-08-09
  //   「投手の補正を弱める」）。1.0 だと**全球種が寸分たがわず同じ点に着き**、
  //   打者から見た球種の差が「道筋」だけになる——実測でど真ん中を狙ったとき、
  //   ストレート x=3.2cm ／ スライダー 4.1 ／ スイーパー 4.2 ／ カーブ 5.4cm と
  //   **1cm の中に全部が入っていた**。変化球が「同じものに見える」の正体。
  // ★★残したぶんは**変化の向きへ流れる**（スイーパーはグラブ側へ、シュートは腕側へ）。
  //   これは制球の悪化ではなく**球種の個性**——実際の投手も曲がる球ほど狙いが甘くなる。
  const aimX = intent.targetX - offsetX + errX;
  // biasYは補正（offsetY）の**外側**に足す: 投手は自分の球の変化は織り込めるが、
  // 自分のリリースのずれは織り込めない——だからずれはそのまま到達点に残る
  const aimY = intent.targetY - offsetY + errY + biasY;

  return buildRelease(aimX, aimY);
}
