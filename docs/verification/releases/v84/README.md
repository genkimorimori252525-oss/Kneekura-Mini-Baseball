# v84 検証記録

通常試合・カメラ調整室・メーカーの全体目標描画頻度2倍／描画密度縦横1.2倍と、liveの接地・制動移動を反映した限定リリース。仕様は `docs/design/2026-10-21-v84-render-locomotion.md`。元プロジェクト全体の完成、実FPS2倍、実機、実測校正、Native公式world認証の達成を意味しない。

## 確定成果物

| 配布物 | SHA-256 |
| --- | --- |
| `game.html` | `b68c954154e7ce4b3af9f9d493329bc213fb7752789394cd11d74250dba2fb1a` |
| `camera-workbench.html` | `b03580808b530b1458a1027b3f52c28a2978ece2a2cea6b1a81800b2481e484e` |
| `maker.html` | `30c9de32e19b83099e997128c22a4f501d9b47023e17980073df16b259486e63` |

凍結先は `docs/demos/releases/v84`。Native Coreは`65c841a32fcd4bb4302b68a1aa8f6188b45c55b476e2c8d19597a2f43f840deb`／128 inputs。メーカーauthoring Coreは`89c782901927abe3a1cd615a0ca99fc77132623c72b8b2cd63c54395f4db4c85`のまま。Source契約は151件の現在byteを照合し、旧v81/v82/v83凍結物の不変も検査した。

## 最終検証

| 内容 | 観測結果 | 原証拠 |
| --- | --- | --- |
| Core回帰 | 119 testfiles／845 tests PASS | `MB-20261021-V84-CORE-FINAL_048abd8460244b478e2ba8210e0bbba8` |
| 型検査 | 全src `tsc --noEmit` PASS | `MB-20261021-V84-TYPECHECK-FINAL_9e86a031992e462ebdcf92e7a05cae4b` |
| 通常試合 | 9回343球／123守備、別条件3回54球／23守備、全field complete。保存往復・二重commit一回・重複拒否・練習・シーズン締めPASS | [normal-nine-final/report.json](normal-nine-final/report.json) |
| 描画 | 旧v83 Core同一fixtureで240場面の品質1.0 RGBA／名前／状態一致。最終v84は1200/390×DPR1/2、品質往復・捕球境界・逆seek・history不変PASS | [render-quality-final/report.json](render-quality-final/report.json) |
| 3成果物接続 | normal/lab/maker共通controls、A/B同時刻、全layer、673資料、試投・roster不変PASS | [presentation-surfaces-final/report.json](presentation-surfaces-final/report.json) |
| メーカー復帰 | 日本語エラー・最近傍候補・適用／取消・cm/SI・pending入力・個別比較削除／取消、両幅PASS | [maker-internal-recovery-check.json](maker-recovery-final/maker-internal-recovery-check.json) |
| 球種 | 所持球削除・取消・最後1球保護・dirty保護、両幅PASS | [maker-pitch-final/report.json](maker-pitch-final/report.json) |
| 得能 | 17系統の独立性・効果倍率・保存往復、両幅PASS | [traits-check.json](maker-traits-final/traits-check.json) |
| HR見送り | 実第39球、1200/390で確認済みcrossing＋1750ms、逆seek・他視点・Source不変PASS | [hr-watch/report.json](hr-watch/report.json) |
| 守備ハーネス | default全20場面complete／物理異常0、能力段階の進行テストPASS | [fielding-matrix-final/report.json](fielding-matrix-final/report.json) |
| パッケージ | 現在151 Source pin／10 report／埋込Core／lab同一game／旧凍結物不変PASS | `MB-20261021-V84-PACKAGE-FINAL_7c52b8812df8431aba4027e8bbafda57` |

receiptは `docs/ai-continuity/verification-receipts/<ID>.json` と同名log。描画17 unitのTDD証拠、走者82件、境界35件、helper／field reviewは同prefixのreceiptと [locomotion-review.md](locomotion-review.md) に保存する。

## 原FAILと修正

未実装module、旧一定加速、旧b=aの制動上限をREDで確認した。短区間の二次根・距離反転・peakのULP差、野手の方向再構成、走者の再計画の上限丸め、微小event cutの速度差の桁落ちを個別に再現し修正。入力状態のclampや結果の場面別上書きは行わない。通常初回は28球目で走者境界例外となり、そのFAILと修正後343球完走を分けて保持する。

守備oracleにも旧一定加速が残っていたため、新速度帯による楽観的first-entry boundへ更新した。20場面の結果は内野11アウト／全15アウトで、旧12／17のfloorは新モデルの観測結果へ更新した。ゼロ物理異常・実接触の因果・能力段階比較は保持し、打球分布の現実校正と混同しない。same-holder tagの試験ではreceiver速度を7→7.2m/sとした入力で本来のcarry branchを保持し、production側の場面パッチはない。

パッケージ初回は検証器のreportファイル名が違いFAIL。実際の `maker-internal-recovery-check.json` へ訂正し、製品を変更せず再検証した。Node vmによるmatrix計測の初回はperformance未注入でFAIL、その後PASS。現在のharnessは通常Node realmで同結果を再確認する。原receiptは削除しない。

## 描画性能と限界

独立した順次比較は [cadence-idle-comparison/report.json](cadence-idle-comparison/report.json)。Chrome155／Windows headless、2D加速OFF、1200px／DPR1で各条件1回の参考値。実機の中継画面性能を保証しない。

| シーン | v83 | v84・品質1.0 | v84・既定1.2 |
| --- | ---: | ---: | ---: |
| 打者・準備 | 53.99 | 104.68 | 101.27 |
| 打者・投球 | 45.80 | 41.22 | 36.92 |
| 投手・準備 | 34.35 | 32.40 | 25.22 |
| 投手・投球 | 30.03 | 29.60 | 20.52 |

単位は実際に提出した全シーン／秒。目標頻度は通常109.1Hz／投球272.7Hz／打球218.2Hzだが、**全場面の実FPS2倍は未達**。準備で保存tickが1個でも表示時刻は多数あり、物理更新数の増加ではない。球だけのRAFは全条件0。全シーンでバット・球を同時に合成し、historyを変更しない。高密度な投手視点等のCPU負荷は今後の無劣化最適化の残件として保持する。

再buildでは8配布ファイルのbyte一致を確認した（`MB-20261021-V84-REBUILD_7025810c43f04a3aa86ccccab6ba5aad`）。表示・HR helperの最終unitもPASS（`MB-20261021-V84-PRESENTATION-UNIT-FINAL_a89c3c42055241539b1cbcaafae52be3`）。

## 実行

repo rootで `node tools/browser-bridge/build-render-locomotion-v84.mjs`。通常・lab・makerを同じ入力から生成する。受入後 `py -3.10 -X utf8 -B tools/browser-bridge/package-render-locomotion-v84.py`。既存凍結物と違うbyteで上書きしない。

元Charter独立承認HOLD、旧FAIL/BLOCKED/UNKNOWN、実機FPS・熱・電力、100試合の現実分布、Native world認証、Worker/GPU候補、元計画の残件は継続する。野手ETAは戦術近似で、実motorと完全同一の軌道ではない。制御係数と1.4m/poseは未校正である。

公開前のstage検査は151件の実Git blob、9件の凍結artifact blob、user所有ファイル・設定・secret・lockfileの除外、旧Native motor不変を確認した（`MB-20261021-V84-STAGING_850d37088bad4fbcb7a75326082b2f4a`）。CCG全体auditは元Charter独立承認不足1件でFAILのまま保持（`MB-20261021-V84-CCG-AUDIT_6df91bc805044362ac144496e951d420`）、今回の明示承認や製品検証と区別する。
