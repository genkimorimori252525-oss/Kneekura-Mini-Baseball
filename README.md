# Kneekura Mini Baseball

> **新しいAI・Codex・人間の共同開発者へ:** まず [AGENTS.md](AGENTS.md) → [AI設計ナビゲーション](docs/AI-INDEX.md) → [設計正本・優先順位](docs/game-design/00-current-design-handoff.md) → [実装計画一覧](docs/PLAN-REGISTER.md) を読むこと。**GitHub既定の `main` は古いブートストラップ状態**であり、`jolly/core-foundation-plan-2026-09-17` にこのドキュメント群がある。家のPCの未コミット・未push作業はGitHubだけでは見えない。

## ゲームの根本思想 — 試合が存在し、中継がそれを映す

**野球の試合は画面の外にも、独立した精密な世界として存在する。** 投手、打者、バット、ボール、走者、守備側9人、球場の地形と衝突、個人の知覚・判断・動作、野球規則と公式記録が同じ正史で進む。**カメラと低FPSの中継は、その世界を観測するだけ。**

- **計算は精密、映像は粗い。** 打球・接触・アウト・得点の真実は描画FPS、画面格子、コマ送りから決まらない。
- **World First / Render Second.** `Match Core → CanonicalWorldSnapshot / Events → Presentation Adapter → Camera / Broadcast` の一方向。
- **MiniとNaturalは同じ野球の正史Coreを使う。** 将来Naturalで3D描画しても、同じ選手・ボール・球場・判定・公式記録であること。
- **野球は因果で解く。** 打撃・捕球・走塁の成功率を先に抽選し、あとから絵や軌道を捏造しない。
- **人物AIは全知ではない。** 捕手・打者・投手・野手・審判・監督は各自が観測できた情報から判断し、誤ることもある。
- **能力値・特殊能力は結果を直接Buffしない。** 実際の知覚・技能・身体動作・戦術に作用させ、公開RatingやTraitは原因状態を要約する。
- **描画は既存承認PNG原画を継続。** 4px細密格子・55msは表示側の標準**基準**であり全場面の固定FPSではない。投球・打球などでは場面に応じて中継全体の描画頻度を上げる。**ボールだけ画質・解像度・FPSを特別扱いしない。** Pixel Player JSON/実験は `ARCHIVED / ON HOLD`。

詳しくは [World-First / Broadcast 契約](docs/architecture/WORLD-FIRST-BROADCAST.md)。過去の「ボールだけを2倍にサンプリングする」と誤読される案は、2026-10-16の**場面別の描画頻度調整・ボール単独画質強化なし**というユーザー指示に合わせて修正済みや。投球・打球場面で既に増えているというローカル描画更新は、GitHub上のコードだけで検証できないので実環境を照合する。

## 実装についての正確な見方

- この作業ブランチのGitHubには、決定論的な共有Core基盤や `src/core/sim/contact/`、`src/core/sim/plateAppearance/` 等の一部コードがある。
- **このREADMEや計画書は9回完走の試合がすでに検証済みという証明ではない。** [2026-10-14初の試合統合計画](docs/implementation/2026-10-14-tbd-vs-lad-match-slice.md) の記載も `NOT YET VERIFIED`。
- 複数の `codex/*` 等のGitHubブランチや、所有者のローカル未反映ファイルに、より進んだ実装が存在する可能性がある。**既存の作業ツリーを確認せず上書き・初期化・統合しない。**
- 現場の状態調査は [GitHub vs Local 状態・保護ガイド](docs/implementation/GITHUB-LOCAL-STATUS.md) を優先。テスト結果は `PASS` / `FAIL` / `NOT RUN` / `NOT CONNECTED` で報告。

## すぐ見つけるべき2026年10月16日の計画・議論

| テーマ | 正本リンク | 状態 |
| --- | --- | --- |
| 捕手の頭脳・配球・監督指示・裏読み | [Catcher Game Intelligence v1](docs/superpowers/plans/2026-10-16-catcher-game-intelligence-system.md) | **実装計画 / 未実装** |
| 打者の球種・コース予測、狙い、アドリブ打撃 | [Batter Anticipation & Adaptive Swing v1](docs/superpowers/plans/2026-10-16-batter-anticipation-intent-adaptive-swing.md) | **実装計画 / 未実装** |
| 引っ張り・センター・流しの意図と実打球方向の分離 | [Directional Intent & Causal Spray v1](docs/superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md) | **実装計画 / 未実装** |
| 隠し「流れ」・試合中の微小な調子変化 | [試合中調子の議論ノート](docs/notes/2026-10-16-in-game-form-discussion.md) | **未確定の議論、実装計画ではない** |

会話では「4つの計画」という言及があったが、GitHub上で確認できる今回の新規**実装計画は3本**。4つ目に相当する「流れ」は議論の保存であり、勝手に正式仕様・実装対象へ昇格させない。関連した別時期のPitch Cadence / Pitch Arsenal等は [Plan Register](docs/PLAN-REGISTER.md) に掲載。

## 選手再現部 — 歴史的OBの能力値再現（2026-10-16新設）

将来のAIが王貞治などの実在OBを作るときは、[選手再現部の入口](docs/player-reconstruction/README.md)と[OB再現原則](docs/player-reconstruction/PRINCIPLES.md)を必ず参照する。

**最新の最優先方針:** [Miniだけで王貞治を独自再現](docs/player-reconstruction/OOTP-FIRST-OH-PILOT-PLAN.md)。**OOTP本体は絶対に起動不要**。OOTP由来の歴史的成績・時代傾向を参照し、[王と1972〜1976年のセ・リーグ相対基準](docs/player-reconstruction/cases/sadaharu-oh-1972-1976-league-reference.json)と[独立計算器](tools/player-reconstruction/compute-oh-mini-benchmark.mjs)を利用してMiniの本物のバット/投球物理へ接続する。OOTPの完成済みRatingは元ODBから未確認で、以前のEditor入力案は撤回。王がうまく行ったら指名選手だけ再現する。王の真能力値校正と実試合は未完了。

**1936年のリーグ創設期から現代までの資料環境**は [公式/二次/GitHub資料アトラス](docs/player-reconstruction/NPB-SOURCE-ATLAS-1936-2026.md)、[時代・球団・球場・規則モデル](docs/player-reconstruction/NPB-HISTORICAL-ENVIRONMENT-MODEL.md)、[全能力・隠し技能・得能（青・金・赤・緑・青赤）参照台帳](docs/player-reconstruction/PLAYER-CAPABILITY-TRAIT-ATLAS.md)、[AI主役の調査・検証手順](docs/player-reconstruction/AI-RECONSTRUCTION-RUNBOOK.md)に整理した。**現段階は資料・索引・実装計画の整備で、全選手の校正や完全なNPB試合実装は未完了。** 公式・外部データの再配布/大量取得には利用許諾確認が必要。

- **全盛期OBの基礎能力値はペナントの年次によって変動させない。** ただし日々の調子、技術の発揮、対戦相手、打席数、実際のプレーによってシーズン成績は変わる。
- **「55本塁打に到達できる王貞治」≠「毎年55本の王貞治」。** 同じ時代・リーグ条件に近ければ史実の最高年級を再現する機会を持ちつつ、最高結果を強制しない。
- **全盛期複数年の資料から代表能力を推定する。** ただし良い年だけを摘み食いすると過大評価するので、対象期間の根拠、前後の悪い年、打席/年/リーグ環境を含める。
- **王のTrait候補は「引っ張り屋」を優先、広角打法は保留。** 技術と狙いを分離し、流し狙い0％でも流し方向の実打球はあり得る。
- [シーズン間の成績差のモデル](docs/player-reconstruction/SEASON-EXPRESSION-PROPOSAL.md)は**検討中**であり、試合前調子だけで自動解決済みと扱わない。実装・校正は未着手。

## 設計分野別の入口

- [ゲーム全体の正本ハンドオフと文書ステータスの優先順位](docs/game-design/00-current-design-handoff.md)
- [設計決定記録（初期の原則）](docs/game-design/00-decisions.md)
- [能力・特殊能力カタログ（現在の正本09）](docs/game-design/09-player-trait-catalog.md)
- [監督AIアーキテクチャ（現在の正本49）](docs/game-design/49-manager-architecture-v1.md)
- [精密イベント時刻・走者・捕球・知覚・審判](docs/superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md)
- [因果的なバット・ボール接触と個人守備](docs/superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md)
- [現行PNG継続とアーカイブ区分](docs/presentation/2026-10-01-png-player-continuation.md)
- [すべての分野を横断するAIナビゲーション](docs/AI-INDEX.md)

## 技術と実行

作業ブランチはTypeScript / Vitest / ESM構成。定義済みコマンド: `npm run typecheck`、`npm test`、`npm run verify`。**GitHubの文書だけを読んでもテスト実行したことにはならない。** 実装を始める際は作業中PCの内容と他担当・別ブランチを照合してから、必要な範囲で一括実装・一括検証する。

このREADMEは案内であり、CANONICAL設計を上書きしない。新たなユーザー承認があれば [Design Handoff](docs/game-design/00-current-design-handoff.md)・[AI Index](docs/AI-INDEX.md)・[Plan Register](docs/PLAN-REGISTER.md) の対応する状態を根拠と共に更新する。
