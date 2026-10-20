# v86 メーカー入力確定・近接エラー 検証

2026-10-21。配布は `docs/demos/releases/v86/maker.html`、38,851,184 bytes。
SHA-256: `93d5342fe1b00748dbf6650865442de737c6ba76cd1adfb9a7bb64b2379da4f2`。

[原因・修正と変更ファイル](../../../design/2026-10-21-v86-maker-validation.md)。最終Source/reportのhashは `docs/demos/releases/v86/source-contract.json`。

## 最終結果

| 検証 | 結果・証跡 |
| --- | --- |
| 未反映/確定不能 | 1200/390pxの8種類×2幅=16ケースPASS。複数pending独立訂正、縫い目/数値draft保持、別欄/選手選択、球と公開能力の同時編集、近接error解除。`drafts-browser-final2/report.json` |
| 全数値欄の復帰 | 投手/打者×2幅。各71欄（公開能力10・内部46・実働得能強度15）=284往復PASS。空欄時canonical不変、訂正後pending/customValidity/aria/error解除。`field-matrix-final2/report.json` |
| 操作経路 | 保管庫の空欄→取消/訂正保存、seed空欄→訂正、コースと新規シーズンの独立確定、試打回数訂正。2幅で10経路PASS。`actions-final2/report.json` |
| バット | Vitest 2件（実Chrome含む）PASS。実HTMLを置換せず、同値/前後ms/個別取消/複数raw/選手別保持/他選手設定混入なしを確認。`swing-final2/proof.json` |
| 回転と表示 | unit4件PASS。解説・全7図のOFF/ON・左右/DPR・実球/縮尺/metrics不変。`guides-final2/report.json`, `comparison-final2/report.json` |
| v82既存操作 | 日本語エラー/自動調整/境界候補/取消/cm/SI/小数精度/比較集団、球削除/取消/最後の球保護/同一JSON読込後undo失効、17得能独立性PASS。`maker-recovery-final2/`, `pitch-recovery-final/`, `traits-final2/` |
| オフライン | 最終browserでpageerror・意図しない外部requestなし。主要16ケースは横overflowなし |
| 再build | HTML/build.json/bundle-inputs.jsonの3ファイルbyte一致。`rebuild.json` |
| 継承 | authoring Core `89c78290…`、673実測軌道/20選手、v84通常rendererと埋込renderer byte一致。凍結v82/v84/v85全SHA維持。package PASS |

PC保管庫エラーとスマホ複数投手エラーを目視確認済み。独立担当レビューで、選択通知の抑止による旧選手設定混入リスクと取消後表示残留を指摘し、修正後の実ブラウザー確認まで実施した。

## 原FAILと検証の補正

v85のdraft専用16ケースは16件ともREDで、入力消失/相互拒否/近接表示不足を再現。原receipt/log/reportを保持する。swingの未保存表示残留も旧sourceでREDを記録した。

初期v86実装では共有field表示の変数名を誤り `input is not defined` が出た。修正後に全入力マトリクスと実ブラウザーで確認。探索時の原状態は `initial-v86-probe-runtime-error.json`（正式PASS証拠ではない）。

既存v82球種回帰は、同一JSON読込後に旧undoが残るため初回FAIL。sourceReplaced通知を追加して再検証PASS。初回の単純な実変更イベント抑止だけでは不十分だった。

旧v85比較harnessをv86へ適用した初回は、意図どおりのv86 sourceに対して旧v85 pinを要求してFAIL。v86 sourceを厳密照合する専用harnessへ更新し、試投/画素/座標/同一性の全検査を保持してPASS。

入力マトリクス初回は、途中で再生成された得能欄の古いDOM参照をスキップしていた。各IDで現行DOMを再取得するようharnessを修正し、公開/内部/得能を各71欄すべて検証した。中間hashのPASSを最終hashの証拠へ昇格していない。

## 再実行

```powershell
node tools/browser-bridge/build-maker-release-v86.mjs
node node_modules/vitest/vitest.mjs run tools/browser-bridge/maker-guides-v85.test.mjs tools/browser-bridge/pitcher-comparison-v86.test.mjs
node tools/browser-bridge/check-maker-drafts-v86.mjs ../../outputs/にーくら野球メーカー_v86_入力確定とエラー復帰版.html docs/verification/releases/v86/drafts-browser-final2
node tools/browser-bridge/check-maker-field-matrix-v86.mjs ../../outputs/にーくら野球メーカー_v86_入力確定とエラー復帰版.html docs/verification/releases/v86/field-matrix-final2
node tools/browser-bridge/check-maker-actions-v86.mjs ../../outputs/にーくら野球メーカー_v86_入力確定とエラー復帰版.html docs/verification/releases/v86/actions-final2
node tools/browser-bridge/check-rebuild-v86.mjs
py -3.10 -X utf8 -B tools/browser-bridge/package-maker-v86.py
```

実コマンド/log SHA付きreceiptは `docs/ai-continuity/verification-receipts/MB-20261021-V86-*`。バットの実artifact試験は `SWING_RECOVERY_ARTIFACT` に最終HTMLを指定し `swing-input-recovery-v86.test.mjs` をVitestで実行する。

物理/通常試合はbyte不変なのでCore845試験・9回完走をv86で再実行したとは扱わない。未知の入力・JSON組合せや実機での無欠陥を保証しない。元CharterHOLD・旧FAILUNKNOWN・Native/100試合/実機・v84実FPS未達は保持する。

継続記録auditは既存の `CHARTER_UNAPPROVED`（1件）と旧handoff等の警告を返した。今回の実装試験PASSと混同せず、原HOLDを維持。最新AGENTSのchat承認方式を妨げないが、今回の発言からCharter承認を推定していない。

## GitHub保存

製品commit `f0b8551` を既存branch `jolly/tbd-lad-native-browser-core-2026-10-14` とDraft PR #380へpush。`PUBLICATION_0c130fc9` receiptでremote/PR head一致、公開Source/artifact Gitblob128件一致を実読確認。`publication.json`。mainは未merge。
