# v87 検証索引

状態：最終63区画の形・凍結配布照合PASS。GitHub公開照合待ち。最終HTMLのSHAは `docs/demos/releases/v87/SHA256.json`、公開確認は `publication.json` を正本とする。

## 変更と原因

v86で保存後のrefresh断線は再現しなかった。数値変更中の図が動かず、保存後も色が3段階、方向のSVGは割合に関係なく同じ形だったため、編集の効果が伝わりにくかった。入力プレビュー・明示保存/取消・割合で面積が変わる図へ変更した。新しい13区画の打率と旧63区画の認識を別schemaにし、旧設定を精度の低い認識値へ読み替えない。

内部63の最初のUIは横長ボタン格子となり、元画像の正方形・中央赤枠が失われた。人間の追加指示で元画像を確認し、makerだけの表示を戻す。番号・3役の設定・保存契約を変更しない。

## 実検証

| 対象 | 結果と証拠 |
|---|---|
| 共有データ | 新9テスト、旧profile/physical/season/scoring関連59テストPASS。旧scoringの9回157球完走を含む |
| 認識と動作 | 主要9ファイル75テスト、最終対象4ファイル34テストPASS。3役bias/uncertainty/targetWeight、手動制約、強制見送り/スイング、neutral互換、future data不使用、入力不変更 |
| 全src型検査 | `node node_modules/typescript/bin/tsc --noEmit` PASS、receipt `TSC-FINAL_8120a267…` |
| 通常HTML | `normal-nine-final/report.json`：9回343球・123守備プレー、別seed3回54球・23守備プレー。全field complete、fallbackなし、保存/JSON再読/重複記録拒否/練習で公開成績不変 |
| 通常／調整室 | `integration/report.json`：1200/390幅の4ケースPASS。作者JSONを新試合で適用、3役診断と実通過位置を分離、デバッグでhistory不変、13区画、673軌道、A/B同時刻 |
| メーカー | `course-authoring-grid-final/report.json`：13区画、入力preview/確定/取消、方向の面積、読取専用比較、全3役・境界拒否、旧63保持/解除、練習→今季対応、0AB欠測、MLB原値 |
| 旧入力回帰 | `v86-field-matrix-grid-final/report.json` 284項目、`v86-drafts-grid-final/report.json` 16ケース、`v86-actions-grid-final/report.json` 10経路。既存harnessは無変更 |
| 描画継承 | `presentation-grid-final/report.json`：通常/lab/maker、1200/390・DPR1/2の9ケース。全scene同時刻、Core/history/roster/metrics観測不変、外部通信なし |
| MLB資料 | 公式14JSONのraw archiveを保存。重複・page不足・season/sport/split違い・不正H/ABを拒否するPython4テストPASS。オフライン再集計でJSON/ZIP byte一致 |
| 再生成 | `rebuild.json`：通常/調整室/メーカーとmetadata/inputsの8ファイルbyte一致を確認する |

中間候補の試験は最終候補の証拠へ昇格しない。receiptは `docs/ai-continuity/verification-receipts/MB-20261021-V87-*`。最終reportは対象artifact SHAを検査し、package時にも再照合する。

## 原FAILと修正

新schemaのRED、未接続旧v86のUI REDを保存。初回のHost回帰はoptionalをundefinedのまま追加したため検証拒否となり、存在時のみ投影するよう修正した。新test fixtureの不完全physical型をdefaultsで補正。既存9回試験の外部120秒timeoutは360秒上限で再実行しPASS、timeoutを製品エラーや解決済みの性能問題へ読み替えない。`-0/+0`のstrict比較は近接比較へ修正し、元FAILを保持した。

独立レビューで、公開helperが入力positionをfreezeする副作用を指摘し、copyして返す形へ修正・試験を追加。通常builderの旧9区画metadata/旧helpersを更新し、Labの表示元SHAも現v87に合わせた。PowerShellでの管理文書更新1回はquote誤りで実行失敗し、ファイル変更前だったためapply_patchで訂正した。

package初回は継承metadataのbasename形式の性能helperをrepo相対パスと誤認してFAIL。既存tools/browser-bridgeを補い、Source SHA検査を保持して再実行PASS（原receipt `PACKAGE_097b89ab…`、最終 `PACKAGE-FINAL_3229cccd…`）。

## MLB2025の意味と限界

[MLB公式の区画別API](https://statsapi.mlb.com/api/v1/stats?stats=statSplits&sitCodes=zn05&group=hitting&season=2025&sportIds=1&playerPool=ALL&limit=5000&gameType=R)と[シーズンAPI](https://statsapi.mlb.com/api/v1/stats?stats=season&group=hitting&season=2025&sportIds=1&playerPool=ALL&limit=5000&gameType=R)を使用。全体40,138安打／163,664打数、13区画40,128／163,601、不明10／63。個々の丸め済み打率を平均せず、安打・打数を加重集計する。打席終端のコース別打率であり、BABIPや自動的な安打確率ではない。

元データは `docs/data/mlb-2025/mlb2025-zones-source-v87.zip`、URL/SHA/集計値は `docs/demos/mlb-2025-course-reference-v87.json`。Savant一括CSVのアクセスはtimeout/403となり、公式StatsAPIの完結した13区画資料を代替にした。方向の割合は母数未確認のため比較値を作らない。2025年と2026年ABSの測定面の差は[公式CSV説明](https://baseballsavant.mlb.com/csv-docs)を参照し、公式判定のzoneを本資料で変更しない。

## 再実行

```powershell
node tools/browser-bridge/build-course-v87.mjs
node tools/browser-bridge/build-maker-release-v87.mjs
node node_modules/typescript/bin/tsc --noEmit
py -3.10 -X utf8 -B tools/browser-bridge/test-mlb-course-reference-v87.py
py -3.10 -X utf8 -B tools/browser-bridge/import-mlb-course-reference-v87.py --audit-only
node tools/browser-bridge/check-rebuild-v87.mjs
py -3.10 -X utf8 -B tools/browser-bridge/package-course-v87.py
```

headless PC/390幅は実機ではない。全100試合監査・統計校正・Native認証、旧CHARTER_UNAPPROVED、原FAIL/BLOCKED/UNKNOWNとv84実FPS未達を維持する。

継続記録auditは旧CHARTER_UNAPPROVEDを返す。旧形式のamendment pending情報を今回の直接チャット承認の否定と解釈しない。今回の承認原文はAMENDMENTSに記録済みであり、Charter全体承認は別件として原HOLDを保持する。
