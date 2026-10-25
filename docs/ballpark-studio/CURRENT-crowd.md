# 観客・LED応援 checkpoint

次段階は [CURRENT-visual-tuning.md](CURRENT-visual-tuning.md)。この段階のhash/人数/旧ペン長/ループを現行仕様へ流用しない。本人の追加指示で密度・描き込み・LED実寸・ループを変更した。

2026-10-24 / MB-20261024-BALLPARK-CROWD / IMPLEMENTED_AND_VERIFIED（設計室）。

根拠は本人の最新指示: チーム色LED、タンボフ赤青、2〜3コマ、通常常時/安打等で速く振る。対象/影響/検証/復旧判断はPLAN-crowd。通常試合の新球場未導入境界は維持。共有src/dist/メーカー/他chat CURRENTは変更しない。共通CURRENTを上書きするcheckpoint commandの代わりに、この専用checkpointと固有receiptを使用。

## 実装

既存の17,280観客群に身体/頭/LEDをnative dot・投影・深度で追加。チーム色は現在の球場テーマ赤青。群ごとの位相をhashでずらし、3コマは0→1→2→1、2コマは0→1。通常400ms、安打95ms/2.4秒、本塁打80ms/4.5秒、アウト140ms/1.4秒、失策120ms/1.8秒。

clockはイベントID重複抑止・期限・優先度・明示停止/非表示停止・reduced-motionを扱う。画像cache最大3枚を設計/カメラ等の変更時だけ生成し、再生ではdrawImageだけ。再生中にworld再計算しない。内野/色付き線/狼/屋根/Coreを維持。JSON形式不変。コマ数や再生状態は一時設定で保存対象ではない。

主な変更: tools/ballpark-studio/crowd.mjs、studio.mjs/html/css、stadium-mesh.mjs、preview-bridge.js、renderer-patch.mjs、build.mjs、テストと専用資料。変更前は `outputs/球場設計室_v3_観客追加前.html`（gold-lines SHA `916e9cad7e1cf782f0bf828207c1c552ebed41e73a57b75f7e883e04abc90d9d`）を保存。

現在の成果物: `outputs/球場設計室_v3_局所密度版.html`、45,806,431 bytes、SHA `e4146e04b6abe29ded33344b6e0127dcc45824c0a79dd4a228b4d42d91143180`。

## 実検証

task-ID付きreceiptは `docs/ai-continuity/verification-receipts/MB-20261024-BALLPARK-CROWD_<ID>.json` と対応log。

- unit26/26 PASS `5a42876a95b647559d4361ab73a0afac`。
- build crowd-final PASS `62048e8efb714ec98650619c33fa6498`、Core不変・逆変換・構文確認。証跡 `evidence/build-crowd-final.json`。
- 観客実Chrome PASS `81a9949ddb9f4ea480d66d681d2179ed`。`evidence/crowd-final/report.json`。3種類の画素hash、650msで通常1回/安打7回の切替、その間sceneRenders増加なし。停止、hidden、2コマ、theme更新、観客非表示、旧球場timer停止、320/390幅、reduced-motionを検証。
- ドームChrome回帰 PASS `37cb03fad7924478af8bb6c88f4eeecb`。`evidence/dome-crowd-final/`。6視点、屋根開閉/ロゴ/密度/cache、内野固定、JSON/保存/取消、元renderer画素一致。観客を明示停止して静止比較。旧noIdleRedrawは「scene再計算なし」であり、動作有効時のblit停止を意味しない。
- 通常編集Chrome回帰 PASS `2a116fc6c0004ff680d8fc4d693f0fb3`。`evidence/browser-crowd-final/`。旧入力/履歴/点追加削除/保存/再読込等。
- 独立屋根遮蔽 PASS `94d0f2f61c0a4aeb929ec496f0c2ce27`。`evidence/roof-depth-crowd-final.json`、光点1160、漏れ0。
- 14入力＋元V114/v1/v2＋成果物の18 SHA読戻し PASS `3beb77b58c1748318e4752252224e2cb`。`evidence/source-pins-crowd-final.json`。

先行版observedもPASS（観客 `1a54c7135d4844c4b3b5f4d8ff0f9530`、ドーム `eb4c4e6d6811416ba978b8d93d61b2b7`、屋根 `205e390ce6dd4383a5baea9556d8b780`）。最終版で群の位相をhash化し、縦列の同期を緩和した。先行版の通常650ms=2回は計測窓の位相差で、最終計測は1回。過去の局所密度/金色線のFAIL・承認条件はCURRENT-v3以前と原receiptに保持し、消去していない。今回実行した検証は全PASS。

## 未接続・次手順

DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED。新球場の通常試合導入、公式試合イベントからの自動反応、敵味方の応援区画/歓声出分けは未接続。静止scene cacheは設計室限定で、通常試合の球や選手へ流用しない。端末FPSと全端末のメモリ安定性は未計測。視覚の本人最終承認は未確認。

次は本人の設計室表示確認。必要に応じて応援速度/振幅/色を局所調整する。README-crowdと専用AGENTSを開発入口にする。復旧は観客追加前HTMLを開く。commit/push/merge/deployは行わない。GitHub判断記録はPR380の既存commentに集約する。
