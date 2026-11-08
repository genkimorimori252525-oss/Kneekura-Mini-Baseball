# デザイン部から実装担当への引き継ぎ（2026-11-02）

試合UIと球場を次の版で統合するための一覧。数値の出所は `AMENDMENTS/2026-11-02-park-sound-performance.md`。

## 正本

| 対象 | 場所 | 状態 |
|---|---|---|
| 試合画面 | `outputs/ばせぼーるlv133_監督モード案1.html`、部品 `work/match-design-20261102/` | 本人承認済み。表示の記録で計算は無い。数字は見本 |
| 試合前画面 | `outputs/ばせぼーるlv133_試合前案2.html` | 本人承認済み |
| 要件 | `docs/ai-continuity/AMENDMENTS/2026-11-02-manager-mode-ui.md` | 未接続データの一覧を含む |
| 球場 | `tools/ballpark-studio/model.mjs`、`outputs/球場設計室_v26_軽量本塁打曲版.html` | v25と全60画像で一致 |

`work/match-design-20261102/`、`tools/ballpark-studio/studio.html`、`assets/` は git 未追跡。

## 1. スコアボードの実況連動（実装の担当範囲）

表示の設計は完了。残りは試合状態を読み取り専用で流し込む配線。

- 入力先: `architecture.scoreboard` の `teams[].name/innings/hits/errors`、`speedKmh`、`fieldDiagram`（`defenders`、`runners`）。変換の参考は `tools/ballpark-studio/scoreboard-field.mjs`。
- 入力元: `record.match` と `localScoringV100`。Coreへの書き込みは不要。
- 現状: 試合の球場は `DESIGN_SAMPLE` で固定表示。
- 注意: 球場セルは視点ごとに1回だけ作り、`032-script.js` の `stadiumLayerV2` が画像として保持する。掲示板を変えるたびに球場全体を作り直すと、1回150〜300msの引っかかりになる。掲示板のセルだけを別層で差し替えること。

## 2. 非円形フェンス（本人判断待ち）

Coreのフェンスは円1つで、本塁後方の距離は正の値が必須（`LiveFieldPlayV1.ts:227`）。実形状に対する誤差:

| 球場 | 中堅 | 両翼 | 壁 | 実形状との差（rms / 最大） |
|---|---|---|---|---|
| 福岡 | 122 | 100 | 4.2 | 3.91 / 6.11m |
| タンボフ | 128 | 105 | 1.3 | 0.46 / 0.73m |
| にーくら | 136.5（実142） | 101.7（実94.5） | 3 | 4.43 / 7.22m |
| 甲子園 | 118 | 95 | 3 | 2.89 / 6.15m |
| ドジャー | 120.396 | 100.584 | 2.4384 | 0.89 / 2.26m |

にーくらは 142/94.5 を円で表せないため、設計室の本塁後方8.2mを保つ最小二乗の円にした。ドジャーのポール際の低い壁1.397mはCoreに渡せない。

実形状にするなら、`fencePoints`（17点の角度・距離・高さ）と `foul` を5球場分渡せる。本塁打判定、フェンス当たり、守備の到達先、`032-script.js` の `liveFenceDistance` が対象。

## 3. ホームランサウンド

- 接続済み: `016-audio-runtime-v100.js`、音源は `release/game/assets/`（gitignore対象）。公開repoへ入れない。
- 規則: その球場のホームチームの本塁打だけ。6回まで TBD2、7回以降 サビ変、サヨナラは ALL3。延長はサビ変。
- 判定は `half==='bottom'`。ホームがTBD固定である前提。ホームチームが球場で変わる場合は `homeTheme()` にチームIDの判定を足す。
- 別チームの曲は `homeThemes` と設計室の `HOME_TEAMS` の両方へ足す。

## 4. 統合時に見る点

- `032-script.js`: `rasterCells` と `sceneDepth` は動くものだけを持つ。球場は `rasterBase`、`sceneDepthBase`。セルの遮蔽判定で両方を見ること。`actorCells` と `inspect()` の結果に球場セルは含まれなくなった。
- `drawParkV81(stadium)` は保持画像を使えた時に true を返す。
- `088-script.js` の `workerMain` は host を init まで再利用する。088 は gitignore 対象なので、部品を作り直す手順で失わないこと。
- `stadium-choice` は試合中も変更でき、描画と本塁打曲はその時点の値を読む。
