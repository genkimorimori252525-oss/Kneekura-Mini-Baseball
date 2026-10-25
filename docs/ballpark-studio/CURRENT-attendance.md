# 無観客/満員 checkpoint

2026-10-24 / MB-20261024-BALLPARK-ATTENDANCE / IMPLEMENTED_AND_VERIFIED（設計室）。

本人が前段の群衆の見た目を承認し、客のいない場所は元の座席色を表示して無観客/満員を切り替えるよう直接指定。判断はPLAN-attendance。群衆/ロゴ/球場配置を改変せず、既存の群衆OFF描画へ明示選択と保存を接続。

## 変更と復旧

プレビュー下の「観客席」で満員/無観客を選択。optionalなarchitecture.crowd.attendance=full/empty。旧JSONの欠落時はfullで自動追記しない。無観客では元のstand material（赤青座席）をそのまま表示し、群衆/LED0、画像cache1枚、観客timer停止。満員へ戻すと元の群衆/発光/7コマを復元。JSON/ブラウザ保存・履歴へ接続し、再読込時にもmodeを復元。一時非表示APIは従来どおり保存とは分ける。

変更は専用architecture、stadium-meshの表示条件、studioの選択/保存・履歴連動、検証/専用資料、HTMLのみ。元V114/Core/共有src/dist/メーカー/他chat CURRENTは触らない。

成果物 `outputs/球場設計室_v3_局所密度版.html`、45,817,864 bytes、SHA `82f83110a3b09a33ce637795045a29ee1d092e76b048dff88b7f3d553dc82344`。復旧は `outputs/球場設計室_v3_観客席切替追加前.html`（SHA `6b2ebaf869e8c11c3015e2f27db5efb52b1e7cf7eb46743709f3d53bb31f6d99`）。

## 実検証

receiptは `docs/ai-continuity/verification-receipts/MB-20261024-BALLPARK-ATTENDANCE_<ID>.json` と対応log SHA。

- unit34/34 PASS `45c708c573bf44ee9d6401ff595d2b11`。
- build attendance PASS `3982838d63b047bbbfcaf3540f26f101`、Core不変・renderer逆変換・構文/pins。`evidence/build-attendance.json`。
- 切替Chrome PASS `a4d06f5bbbd340ad850c81a7a7698ba3`。`evidence/attendance-final/report.json`。無観客の座席画素が前版の元座席と完全一致、ロゴcrop/固定内野不変、LED0/観客timer停止、満員復帰画素一致、undo/redo、空席のtheme色更新、JSON/ブラウザ保存再読込、旧JSON無追記、390/320幅。無観客画像を目視済み。
- 群衆再生Chrome PASS `d0e84861a6aa4c738013fdb0d18c46e6`、`evidence/crowd-attendance/`。
- 群衆タイル/発光/屋根/前版画素一致Chrome PASS `8d81ed72be4842988de0fb551d0913ee`、`evidence/crowd-blocks-attendance/`。
- 6視点・既存保存等Chrome PASS `88edd03205914fbe941130a3384feaa0`、`evidence/dome-attendance/`。
- 19 SHA読戻し PASS `4ad3b4eb152d401296265470f9018c2b`、`evidence/source-pins-attendance.json`。15入力＋元V114/v1/v2＋成果物。

今回の検証は全PASS。前段のFAIL/不採用案/診断原本は旧CURRENTとreceiptへ保持。全体群衆の見た目の承認をCCG Charterや未接続の通常試合の承認へ昇格させない。

## 次と境界

本人の切替確認。通常試合への新球場/公式イベント自動反応は未接続。端末FPS/全端末の長時間安定性は未測定。専用CURRENTと固有receiptでcheckpointし、他chatのCCG共通CURRENTを上書きしない。commit/push/merge/deployは行わず、判断はPR380の既存commentへ集約する。
