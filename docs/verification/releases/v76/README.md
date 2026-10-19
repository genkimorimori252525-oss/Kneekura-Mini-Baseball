# v76 実検証索引

描画限定の修正。旧helperの失敗再現、純helper境界、最終3HTMLの実ブラウザ、配布物とSource一致を確認。

| task / receipt | 結果 | 秒 |
|---|---|---:|
| [MB-20261020-V76-BALL-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V76-BALL-BROWSER_4c976c8d985a4af3aae4e6c4cd74320f.json) | FAIL | 0.280 |
| [MB-20261020-V76-BALL-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V76-BALL-BROWSER_58e1e77935ee4259af80efcdfc436ad2.json) | FAIL | 45.750 |
| [MB-20261020-V76-BALL-BROWSER](../../../ai-continuity/verification-receipts/MB-20261020-V76-BALL-BROWSER_c01b5bff188f4d30a1939d17eab30bf8.json) | PASS | 74.265 |
| [MB-20261020-V76-BALL-SIZING-RED](../../../ai-continuity/verification-receipts/MB-20261020-V76-BALL-SIZING-RED_824833c8ee9442788a1a3b208ed273fb.json) | FAIL | 0.045 |
| [MB-20261020-V76-BALL-SIZING](../../../ai-continuity/verification-receipts/MB-20261020-V76-BALL-SIZING_4fc2887e1a464cb18c95900f79ce74be.json) | PASS | 0.079 |
| [MB-20261020-V76-PACKAGE](../../../ai-continuity/verification-receipts/MB-20261020-V76-PACKAGE_aec26b55c38b401bba4a98cc1658d167.json) | PASS | 4.547 |

[実ブラウザ詳細と原QA失敗](browser/README.md) · [配布照合](release-check.json)

低球42条件・高空48条件、設定1付近と高さ境界の連続性。1200/390の通常・調整室・メーカーで低球の1/2/8完全一致、高空2/8は旧v75一致、持球非表示、他4視点、全体倍率独立、設定/session新旧JSON/不正原子拒否。実6球の全Source/bat/field/裁定と同時刻カメラ/field/bat描画がv75一致。例外・外部通信・overflow0。

Native117/Maker84/union124の入力とbundle bytesはv75exact。旧224凍結物不変。今回はCore/AI/物理変更なしのため、新9回・TypeScript・100試合分布・実機スマホは再走していない。旧FAIL/UNKNOWNと原CharterHOLD、元計画の未達は維持。

STAGING [MB-20261020-V76-STAGING_57d7a723009b4ff38ca776771354c10d.json](../../../ai-continuity/verification-receipts/MB-20261020-V76-STAGING_57d7a723009b4ff38ca776771354c10d.json) PASS2.890秒。明示allowlistだけをstageし、全Git blob raw bytes・credential pattern0・whitespace0・ユーザーAGENTS除外を確認。
