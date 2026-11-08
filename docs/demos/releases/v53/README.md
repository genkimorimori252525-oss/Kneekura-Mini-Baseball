# v53 — 飛球走塁・帰塁裁定と悪球打ち得能

- [通常試合HTML](game.html)：単体でオフライン実行できます。
- [選手・実測バットメーカー](maker.html)：選手作成の得能欄へ悪球打ちを移しました。
- [初期20選手JSON](live-game-roster-v3.json) / [内部能力定義](live-game-roster-catalog-v3.json)
- [原因・変更・回帰・限界](../../../reports/2026-10-18-v53-airborne-running.md) / [得能接続の監査](../../../reports/2026-10-18-v53-trait-source-audit.md)
- [通常9回の実記録](../../../verification/releases/v53/game/normal-game-records.json) / [検証報告](../../../verification/releases/v53/game/game-check.json)
- [正確なCore入力とコンパイル済コード](tested-core-inputs.zip) / [SHA256一覧](SHA256.json)

## 変更

飛球が落ちる前でも、観測から安打性と読んだ走者は進塁します。既存reaction・判断余裕で個性を保ち、監督の走塁指示（保守的／バランス／積極的）も反映します。身体の速さを采配で上げません。捕られた時は現在の速度から制動し、通過した塁を逆順に帰塁します。実離塁とfirst-touchを使い、明示appeal・実送球／タッチを裁定につなぎます。未帰塁のまま次の打席へ切りません。

悪球打ちは公開数値から得能へ移動。公開10項目と内部44項目を編集できます。保有なしは実行値0、付け直すと保存した技術を復元します。選球や悪球を振る積極性を勝手に変えません。旧v1/v2 JSONは無変換で読み、未査定表示を維持します。メーカーで「試合用能力JSON」を保存し、試合の「選手メーカーの能力を読み込む」へ指定後、「新しい試合」で適用します。

青・緑・赤・金の全得能は未接続です。今回保有編集を実働接続したのは悪球打ちだけです。故障・育成・心理等、通常試合に元システムがないものも今回含めるかの確認を残しています。定義の一覧や色だけを実装済みと呼びません。

## 新規検証

- 39ファイル・346テストPASS。全体TypeScript型検査PASS。
- このHTMLの112 Source入力を照合。320球、9回表3アウトまで通常試合で完走。例外・旧結果fallbackなし。
- 実試合で着地前進塁の判断26件、通常live終端の未帰塁0。実appealアウトはこの1試合で0件であり、専用の実経路回帰で成立を検証しています。
- 130守備プレー・17,169描画frameの野手身体の重なり0、最小中心距離0.500113m。連続発行commandの回避回帰もPASS。全身体衝突を実装したという意味ではありません。
- PC1200／390px、20人・公開10／詳細44、ON/OFF・JSON保存再読込・通常試合import、pageerror・外部通信0。
- v52の打者／投手カメラhelperを同じbytesで維持。現在のCoreを埋めたv49／v52参照HTMLと12実球のCore／bat・左右・他視点・停止／再生を比較。

HTML SHA256: `1113fc83ad2fb0dee470dc3152ec9430da650c65098fed503c61e674fbf7e7d1`
Maker SHA256: `48e60a46ae57f8b1b4735cbb69d68569b2164537587ee3e56bf4459d4da5c26e`
Native browser Core SHA256: `40b4ad4dca0bf6bd91fcc202bbf499cabe26dd477fbcc684fbed471e86857e62`

## 再生成

Node依存を既存環境で利用し、repository rootから実行します。

```powershell
node tools/browser-bridge/check-v53-ai.mjs
node node_modules/typescript/bin/tsc --noEmit --pretty false
node tools/browser-bridge/build-v53-artifacts.mjs
node tools/browser-bridge/check-v53-release.mjs
```

`build-v53-artifacts.mjs` はworkspaceのoutputsへ作成し、過去のrelease HTMLを上書きしません。Source ZIPは実際にテスト・buildしたraw bytesを保存します。Gitの改行正規化で無断に書き換えてから証拠を流用しないでください。

## 残件

元の全計画はIN_PROGRESSです。read誤差・個別SI・統計分布は未校正。Native認証連続world、全得能、全公式H/E、lead／slide、走者同士の衝突、身体反発、新100試合、実機スマートフォン等は別途必要です。390pxはブラウザ検証で実機ではありません。外部Charter承認HOLDと全原FAIL/UNKNOWNを保持。既存作業ブランチ／Draft PR380へ保存し、mainへはマージしません。
