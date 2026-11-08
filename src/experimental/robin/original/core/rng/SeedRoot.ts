import { DeterministicRng, fmix32, fnv1a32 } from './DeterministicRng';

export type PhaseName =
  | 'pitch' | 'recognition' | 'batter' | 'collision'
  | 'batted' | 'fielding' | 'baserun' | 'rule'
  // 'pitch_execute' = 投球実行（制球誤差）専用ストリーム；'recognition' は M2 打者認知のため予約済み・現在未使用。
  | 'pitch_execute'
  // 'batter_react' = 打者の**見た目の反応**（三振で天を仰ぐかうつむくか）専用ストリーム。
  // ★★判定には1ミリも効かない量だが、**絵の側で乱数を引くと決定論が壊れる**ので、
  //   ここを通す（同じシードなら同じ試合＝同じ絵）。`batter` とは別の列にして、
  //   絵の都合で引く回数が変わっても判定の乱数列がずれないようにする
  | 'batter_react'
  // 'batter_hand' = 空振りで**片手をバットから離すか**（右手／左手／離さない）専用ストリーム。
  // ★★★**`batter_react` を使い回してはいけない**。`phaseRng` は呼ぶたびに
  //   `new DeterministicRng(phaseSeed(...))` を返す（下）ので、**同じ列名を2回呼ぶと
  //   まったく同じ値が返る**——顔の向き（`lookUp`）と離す手が完全に同値になり、
  //   「天を仰いだ球は必ず右手が離れる」になる。列が別なら、そもそも起こらない
  | 'batter_hand'
  /** バット投げを振り抜きの終わりから何秒前にするか（`batting/batFlipTiming.ts`） */
  | 'batter_flip'
  /** 確信ホームランで、打球の余裕をどれだけ見誤るか（`batting/homerConviction.ts`） */
  | 'batter_convict';

// 試合シード→プレーシード→フェーズシードの階層導出。
// ステートレス（純関数）なので呼び出し順に依存しない。
// あるフェーズの実装が乱数を何回引こうと、他フェーズの列は不変——リプレイ互換の生命線。
export class SeedRoot {
  constructor(readonly matchSeed: number) {}

  playSeed(playId: number): number {
    return fmix32((this.matchSeed ^ Math.imul(playId + 1, 0x9e3779b9)) >>> 0);
  }

  phaseSeed(playId: number, phase: PhaseName): number {
    return fmix32((this.playSeed(playId) ^ fnv1a32(phase)) >>> 0);
  }

  phaseRng(playId: number, phase: PhaseName): DeterministicRng {
    return new DeterministicRng(this.phaseSeed(playId, phase));
  }
}
