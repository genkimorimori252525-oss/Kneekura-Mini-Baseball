# メーカーv69 検証索引

[機能・使い方](../../../demos/releases/v69/README.md) / [原因・設計・限界](../../../reports/2026-10-19-v69-ball-comparison-and-zoom.md)

- [比較APIの実行](../../../ai-continuity/verification-receipts/MB-20261019-V69-COMPARISON-FINAL_c72663b261254af0981bee7ff5590734.json)：関連19件／3ファイル。通常LivePitchとの左右4段階一致、同一Source・同じ誤差、真の接触時刻・飛翔・初着地、空振り・見送り・ファウル方向・速度上限。
- 全体TypeScript型検査PASS。最終Sourceとコマンドは下表のTSC receiptを参照。
- [黒い画面の局所検証](main-zoom/README.md)：18.266秒、1200／390×5視点の初期pixels／world一致、倍率0.25〜12、中心、drag／wheel／実2指pinch、Core／参考接触研究、旧新JSON、物理／時計／revision不変。v68にUIだけを差し替えたfixtureの範囲。
- [最終HTMLの実ブラウザー](maker/maker-check.json)：10.890秒、1200／390の同条件4ケース・独立Core数値一致、投球基準0.15／0.55秒の球とバット座標、共通縮尺、比較zoom／pan／level／実dragによる結果不変、実JSON保存2本、右打者とcurve、初期20不変、主画面zoomと新旧JSON、未確定能力入力拒否、説明ボタン、ページ例外・外部通信0。
- [説明UI再検証](maker-help/help-fixture-check.json)：6.296秒、47項目・1秒説明・focus／touch、495選択肢の見出し混入なし、値／ARIA／既存handler保持。旧v68の証拠は上書きしていない。
- [配布照合](release-check.json)：最終試験HTMLを同じbyteで凍結。Maker82入力と全UI、通常Native115入力の不変、旧配布SHA、100MB未満を照合。

## 原FAIL

ファウル用の最初のfixtureが実際には空振りだったため、製品を変更せず試験入力を訂正。初回mainzoom fixtureは同一script内のaddon結合を考慮せず抽出時点で停止し、製品実行前の試験側で修正した。

統合試験では説明のtooltipが小さなcheckboxだけを位置基準とし、下にある説明ボタンを覆ってpointerleaveで消える不具合を発見。実bbox・イベントで確認し、入力とボタンの両方の範囲外へ配置する最小修正を行った。後続の説明試験での失敗は、自動スクロール直後のscrollイベントがtooltipを閉じる試験条件だった。スクロール安定後に実クリックする手順へ修正し、製品は追加変更しなかった。全原本・後続PASSを下表に保持する。

通常試合はv68のまま。比較は守備／壁／公式裁定を含まない。元全計画・原FAIL／UNKNOWN・Charter未承認HOLDと既存微小角速度超過は継承する。

## 実コマンドreceipt

| task / receipt | 結果 | 秒 |
|---|---|---:|
| [COMPARISON-UNIT 35df7c49](../../../ai-continuity/verification-receipts/MB-20261019-V69-COMPARISON-UNIT_35df7c4923b64bb181d6ad7ed3f4977f.json) | PASS | 3.077 |
| [COMPARISON-FOUL 532b14d1](../../../ai-continuity/verification-receipts/MB-20261019-V69-COMPARISON-FOUL_532b14d10250422c9c5a8482f2e0a6b3.json) | FAIL | 1.655 |
| [COMPARISON-FOUL 7420444d](../../../ai-continuity/verification-receipts/MB-20261019-V69-COMPARISON-FOUL_7420444d39734fe482f7f0e9a9debd9c.json) | PASS | 1.75 |
| [MAIN-ZOOM f83ac88c](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAIN-ZOOM_f83ac88cfc274e0fbe4c7aca9b56ea32.json) | FAIL | 0.328 |
| [COMPARISON-FINAL c72663b2](../../../ai-continuity/verification-receipts/MB-20261019-V69-COMPARISON-FINAL_c72663b261254af0981bee7ff5590734.json) | PASS | 3.594 |
| [MAIN-ZOOM 0b8f7673](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAIN-ZOOM_0b8f7673657540c6b97933f3d3e88541.json) | PASS | 18.266 |
| [COMPARISON-TSC 829c763e](../../../ai-continuity/verification-receipts/MB-20261019-V69-COMPARISON-TSC_829c763e61604561aa64f9523c6844e9.json) | PASS | 27.532 |
| [MAKER-BUILD 6fdf6a8f](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAKER-BUILD_6fdf6a8f9fd545ba9c0f0682e17d9f64.json) | PASS | 2.188 |
| [MAKER-FINAL-BUILD 0731edbd](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAKER-FINAL-BUILD_0731edbd2ebb4070b993d47c3c5591fc.json) | PASS | 2.203 |
| [MAKER-UI-BUILD c3b33df8](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAKER-UI-BUILD_c3b33df80a5a4b4299b0220f061109fd.json) | PASS | 2.297 |
| [MAKER-GUARD-BUILD b1824c20](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAKER-GUARD-BUILD_b1824c2005354aa3ab7289fdf507345d.json) | PASS | 2.14 |
| [MAKER-BROWSER 70a252c3](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAKER-BROWSER_70a252c35f834c6ba9d45b063e8c886b.json) | FAIL | 6.234 |
| [MAKER-HELP-BUILD af4bdffe](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAKER-HELP-BUILD_af4bdffefd9d468fb93480a5cbaf2dbc.json) | PASS | 2.188 |
| [HELP fd6b2bf8](../../../ai-continuity/verification-receipts/MB-20261019-V69-HELP_fd6b2bf82726444bad14a6062825cec8.json) | PASS | 6.296 |
| [MAKER-BROWSER 83005725](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAKER-BROWSER_83005725c1744f83b8ae4791e904a444.json) | FAIL | 6.469 |
| [MAKER-BROWSER 7d8a7389](../../../ai-continuity/verification-receipts/MB-20261019-V69-MAKER-BROWSER_7d8a73895b0542d3a362998169e19c53.json) | PASS | 10.89 |
| [PACKAGE 6a1c3348](../../../ai-continuity/verification-receipts/MB-20261019-V69-PACKAGE_6a1c33485ab34218973a4d79a74aadad.json) | PASS | 1.421 |
| [STAGING 6cb2f6ff](../../../ai-continuity/verification-receipts/MB-20261019-V69-STAGING_6cb2f6ff13234e6f862416a9cb3b3d2c.json) | PASS | 1.688 |
| [PUBLICATION 889345b9](../../../ai-continuity/verification-receipts/MB-20261019-V69-PUBLICATION_889345b90a6b4bbb92f41a8e5a417916.json) | PASS | 108.530 |

[公開照合](publication.json)は製品コミットのremote／PR headと公開raw12ファイルの実byteを確認。記録のみの後続コミットで製品byteは変更しない。
