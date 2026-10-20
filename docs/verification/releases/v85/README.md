# v85 メーカー解説・無回転比較の検証

2026-10-21。対象はメーカーのみ。最新版v84の物理・通常試合・描画を継承し、旧v82を上書きしない。

- 配布: `docs/demos/releases/v85/maker.html`（自己完結HTML、38,840,053 bytes）
- SHA-256: `c34cb0234c20df08eb9a219cf4cb2c6624d34e8ccee3fafebbe11cd23c8aad4c`
- 設計・科学的限界: [投球設定の監査](../../../design/2026-10-21-v85-pitch-settings-audit.md)
- 現在Source 116件と最終report 6件: `docs/demos/releases/v85/source-contract.json`

## 実装

投手の回転・ジャイロ・縫い目・リリース・図の読み方、打者の能力・得能、バット軌道・比較方法、球の保管庫へ具体例付きの解説を追加した。説明タブ、キーボード操作、入力に対応した説明の自動表示を備える。PCでは余白、スマホでは同じ列に配置する。既存の1秒hover/?説明を保持する。

灰の無回転比較は初期OFF。1つのOFF/ONで6軌道図と本塁図の計7図の灰線・灰点を切り替える。緑の実投球・縮尺・試投結果・数値・保存値は変わらない。OFFでも比較計算は数値のために維持する。

ガイドの数値だけ小数1桁へ整形する。入力、保存JSON、物理演算は切り捨てない。ジャイロ比率からの数値は「設定時の目安」であり実測Active Spinではない。縫い目作用は未校正の作者モデルである。

## 最終検証

| 検証 | 結果・証跡 |
| --- | --- |
| unit | Vitest 2ファイル・4件PASS。`MB-20261021-V85-UNIT-FINAL-CORRECT` receipt |
| 解説 | 1200px/DPR1・390px/DPR2、4カード全説明、keyboard/aria、入力フォーカス、横溢れなし。`guides-browser-final/report.json` |
| 小数精度 | 入力2400.123456789rpm、gyro −0.0319468845395を保存。誤差1e−8/1e−12以内、未保存/エラーなし。説明のみ2400.1rpmと表示 |
| 比較 | 1200/390px×左右投手の4ケースと8 lifecycle。全7図・fit両設定・球種/選手切替。実球座標/scale/Source/metrics/input/rosterとtrialの同一性不変。`comparison-browser-final/report.json` |
| OFF復帰 | 実投球後のraw PNGと描画commandが完全一致。試投前side/topだけ透明→CSSと同色の背景へ再塗りされるが合成した可視画素は同一。元のFAILも保持 |
| 既存入力復帰 | 1200/390幅の日本語エラー、境界に近い自動調整、取消、cm/SI、比較集団削除/復帰。`maker-recovery/maker-internal-recovery-check.json` |
| 既存球種編集 | 1200/390幅、削除/取消、最後の球保護、未保存保護、オリジナル球保管。`pitch-recovery/report.json` |
| 得能 | 既存17実働得能・基礎能力との独立性の既存browser回帰PASS。`traits/traits-check.json` |
| オフライン | 上記browserでpage error・意図しない外部requestなし |
| 再現性 | 再buildでHTML/build.json/bundle-inputs.jsonの3ファイルbyte一致。`rebuild.json` |
| 継承 | authoring Core `89c78290…`、673実測軌道、20選手、通常renderer `b68c9541…`、埋込試合/投手renderer byte一致。凍結v82/v84全SHA維持。package receipt PASS |

ブラウザーが生成したPC投手解説、スマホ選手解説と比較図は目視確認済み。独立担当のソースレビューで重大事項なし。実機性能検証とは扱わない。

## 失敗と修正

原receipt/logを削除しない。unit REDは未実装確認。初回比較browserは試投前canvasの透明度差を可視差と混同してFAILし、試投後のraw厳密比較は維持したまま、空状態のみ背景合成比較を併記した。

解説browser初回は、バット説明を折畳み済み旧研究欄へ置いて見えなかった。現行バットタブの見出し直下へ修正した。次は閉じた縫い目details内のinputへfocusしようとしたためFAILし、harnessでdetailsを開いて実操作条件を満たした。最終browserは両幅PASS。

最終unitの初回はVitest用テストを誤って `node --test` で実行したrunner選択ミスでFAIL。製品を変更せず、正しいVitest runnerで4件PASS。`UNIT-FINAL` と `UNIT-FINAL-CORRECT` の両receiptを保持する。

## 再実行

```powershell
node tools/browser-bridge/build-maker-release-v85.mjs
node node_modules/vitest/vitest.mjs run tools/browser-bridge/maker-guides-v85.test.mjs tools/browser-bridge/pitcher-comparison-v85.test.mjs
node tools/browser-bridge/check-maker-guides-v85.mjs ../../outputs/にーくら野球メーカー_v85_設定解説と比較切替版.html docs/verification/releases/v85/guides-browser-final
node tools/browser-bridge/check-pitch-comparison-v85.mjs ../../outputs/にーくら野球メーカー_v85_設定解説と比較切替版.html docs/verification/releases/v85/comparison-browser-final
node tools/browser-bridge/check-rebuild-v85.mjs
py -3.10 -X utf8 -B tools/browser-bridge/package-maker-v85.py
```

receipt経由のコマンドと実出力は `docs/ai-continuity/verification-receipts/MB-20261021-V85-*` に保存。Core/通常renderer不変のため、v85で845件Core試験や9回完走の再実行はしていない。元CharterHOLD、旧FAIL/UNKNOWN、Native認証・100試合監査・実機、v84の全場面実FPS2倍未達は解消したと扱わない。
