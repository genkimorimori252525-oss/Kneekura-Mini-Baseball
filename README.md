# Kneekura-Mini-Baseball

軽量な自動試合エンジンを土台に、采配と野球らしい結果の因果関係を中心に据える野球ゲームです。

現在は **P0〜P9のロードマップ基盤まで実装・CI検証済み** で、ロードマップ後の最初のproduction causal live-ball結果境界（無走者ゴロ→一塁フォースアウト）と、runner controller / explicit rebase基盤まで実装済みです。一方、一般multi-runner、ActionFrontier / OfficialPlayClosure、完成ゲームUI、心理・Trait・ペナント/世界リーグ等は未実装または設計段階です。最新の区分は [2026-09-20 03:30 JST Current State Snapshot](docs/project-status/2026-09-20-0330-current-state.md) を参照してください。

Mini Baseball は Natural Baseball の簡易ルール版ではなく、将来の Natural Baseball でも再利用できる試合計算Coreを先に磨く製品です。Miniは同じ正史ワールド状態を軽量なPresentationで観測し、将来は同じ状態をNaturalの3D描画へ接続できる設計を目指します。具体的な見た目・画面構成・演出はCore仕様ではなく、承認済みのWorkデザインに従います。

## 設計文書

- [設計の決定記録](docs/game-design/00-decisions.md)
- [試合体験・監督モード・表示設計](docs/game-design/01-manager-experience.md)
- [NPB規則・能力査定・守備シミュレーション設計](docs/game-design/02-rules-ratings-defense.md)
- [実装ロードマップと検証計画](docs/game-design/03-roadmap.md)
- [守備能力・運動モデル設計](docs/game-design/04-defense-ratings.md)
- [心理・性格・感情マーク設計](docs/game-design/05-psychology-emotion.md)
- [将来システム設計メモ](docs/game-design/06-future-systems.md)
- [Drone-Art・細密グリッド表示の確定デザイン要件](docs/game-design/07-drone-art-presentation.md)
- [ChatGPT Work向け Drone-Art Broadcast Camera 引き継ぎ](docs/presentation/2026-09-20-work-handoff-drone-art-broadcast-camera.md)
- [将来Replay Core計画 — Canonical Replay Reconstruction](docs/superpowers/plans/2026-09-20-canonical-replay-reconstruction-plan.md)（将来参照・未実装）
- [将来Replay演出計画 — Broadcast Camera Network + Replay Director](docs/superpowers/plans/2026-09-20-broadcast-camera-network-replay-director-plan.md)（将来参照・未実装）

## AI / デザイン作業境界

UI/UX・ビジュアル・Presentationのデザイン方向は **ChatGPT Work担当** とし、通常の実装エージェントは独自に再設計しません。詳細は [AGENTS.md](AGENTS.md) を参照してください。**ASCIIは廃止**ですが、**Drone-Art・4px固定グリッド・55ms標準表示テンポはWorkへ渡す確定デザイン要件**です。

## 現在の方針

- 競技規則の初期プロファイルは **NPB 2026** とする。
- プレイヤーの入力は一打席単位でも、内部では投球を一球ずつ正史として計算する。
- 試合計算は表示やカメラと独立した一つの正史状態（canonical state）と固定シミュレーション時間軸で進める。
- 守備側9人をワールド座標上で動かし、処理野手以外も塁カバー、中継、バックアップ、後方カバーへ移動する。
- 守備位置名と現在座標を分離し、中堅手を二遊間付近へ置くような極端な守備シフトも同じAIで扱う。
- 監督は打者傾向の真値を読まず、スカウティングから得た推定と不確実性に基づいて守備配置を決める。
- 守備シフトの効果は安打率への直接補正ではなく、野手の初期位置と到達時間の違いから自然に成績へ反映する。
- 選手能力は、分かりやすい公開査定と、現実のプレー差を担保する隠し査定に分離する。
- 守備内部能力は、既存案に `acceleration` と `situationalAwareness` を追加し、それ以外の細分化は独立した必要性を検証してから行う。
- 守備判断は、チーム性格ではなく勝敗条件を最優先する共通方針とする。サヨナラ負けになる失点を「許容する」判断は作らない。
- 感情は常時能力を揺らさない。通常は感情マークなし・能力影響なしとし、感情が発火して **感情マークが表示された時に初めて** 能力発揮・判断へ影響する。
- 感情マークは監督の実用情報であり、演出用の偽マークは出さない。表示は原則1人1個で、最も強く行動へ影響している感情を示す。
- ポストシーズン、国際大会、優勝直前、首位攻防などの重要度は手動フラグではなく、大会段階・順位・残り試合・優勝/敗退条件などから自動算出し、感情発火のしやすさへ反映する。
- ABS/チャレンジ、乱闘、PlayCapsule/ハイライト、調子予測、移籍欲求、ドラフト、大会、音響、マルチコメントなどはMatch Coreへ直書きせず、将来の独立サブシステムとして接続する。
- Mini/Naturalの表示は正史World/Eventを読む **observer** とする。画面都合で選手・ボール・アウト/セーフ・得点を作り直さない。
- **ASCII表現は現行方針ではない。** 一方、**Drone-Art、基準4px固定グリッド、標準55ms/表示コマは確定したPresentationデザイン要件**としてWorkへ引き渡す。これらをCoreの物理刻み・正史座標・結果判定へ逆流させない。
- Batter POV / catcher-behind Pitcher POV / fair-ball後のfield-overheadというカメラ役割は保持するが、具体的な構図・色・密度・補間・演出・UIレイアウトはWorkのデザイン領域とする。
- ボールや選手の可視化はCanonical Worldの位置・速度・高さ・イベントから導出する。表示用の加工は正史へ逆流させない。