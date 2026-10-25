# 群衆タイル checkpoint

本人がこの見た目を「すばらしい。最高」と承認し、無観客/満員の切替を追加指定した。次段階は [CURRENT-attendance.md](CURRENT-attendance.md)。以下のhashは前段の履歴。

2026-10-24 / MB-20261024-BALLPARK-CROWD-TILES / IMPLEMENTED_AND_VERIFIED（設計室）。

本人の最新指定: ロゴは大満足で対象外。観客は無観客に見え、LEDが光っていない。1人ずつではなく塊をコマ送りし、スタンドへ隙間なく敷く。直接の実装指示を承認根拠とする。PLAN-crowd-tilesに対象/理由/影響/検証/復旧を記録。

## 現在の実装

共有16×12の群衆atlas3コマを全1,920stand quadのUVへ敷く。個別観客の位置生成/描画は廃止。LED密度を下げても群衆背景は占有率100%。通路/手すり/屋根の配置とnative深度を維持。発光島は複数の7cm LEDの群であり、1本の長い線ではない。可視LED cellだけに光芯/native glowを適用。

初期LED密度75%/簡素/模様サイズ100%/明るさ100%/光り方70%。保存された外観値は保持。密度の意味を個別観客の割合からLED量へ変更したのは本人指示による。2コマ2周→3コマ1周、イベント反応、停止/背景/reduced-motion、scene cache最大3枚を保持。ロゴsource/settings/素材は変更しない。

主な変更: crowd-tiles.mjs、stadium-mesh.mjs、renderer-patch.mjs、crowd/architecture既定値とoptional glow、studioの外観設定ラベル/光り方、build入力pin、テスト・専用docs。共有src/dist/メーカー/他chat CURRENTは触らない。

成果物 `outputs/球場設計室_v3_局所密度版.html`、45,816,430 bytes、SHA `6b2ebaf869e8c11c3015e2f27db5efb52b1e7cf7eb46743709f3d53bb31f6d99`。復旧は `outputs/球場設計室_v3_群衆タイル変更前.html`（前段SHA `cffdb8988a5eb89c43d3a9f2883f8d99e250b24419e8dd23ebcbdfdae211ec0b`）を開く。

## 実検証

receiptは `docs/ai-continuity/verification-receipts/MB-20261024-BALLPARK-CROWD-TILES_<ID>.json` と対応command/log SHA。

- unit33/33 PASS `ca43a652747f4d0bb684b3ae8957510b`。全区画・不透明atlas・LED発光/密度・3コマ・UV境界/拡縮・旧JSON等。
- build crowd-tiles-lit PASS `f922b2c8c0064588b75af6edf6b417c0`。`evidence/build-crowd-tiles-lit.json`、Core不変・コピーrenderer逆変換・構文・source pins。
- 新群衆のChrome PASS `87f65a44c2a64218b6b4ca5a396116fe`。`evidence/crowd-blocks-lit-proof/report.json`。1920区画/coverage1/個別world objects0、候補LED774/可視753（俯瞰の一例）。実発光の画像変化、密度を下げても満員、観客OFF全画素一致、ロゴON領域画素一致、最大発光の閉屋根遮蔽、glow保存、モバイル。packed-glowing画像を目視した。
- 観客再生Chrome PASS `9b70b71265b44dacbc4ba37bd98a6277`。`evidence/crowd-tiles-lit/report.json`。3コマ差、650msに通常2回/安打7回の切替、その間scene再計算なし、停止・hidden・2コマ・色・旧球場・reduced-motion等。
- ドーム6視点Chrome PASS `858f3f1fe573402daa40aca27111459c`。`evidence/dome-crowd-tiles-lit/`。旧renderer画素一致、固定内野、屋根/ロゴ/密度/cache、保存/取消、320/390/1280幅。
- 既存外観設定Chrome PASS `90fb932efa514bafb789d74fd921e023`。`evidence/visual-tuning-tiled-crowd/report.json`。ロゴ5〜8倍/発光と観客の調整、保存/旧JSON。密度の期待を「LED量だけ変わり区画は一定」へ本人指示に従い更新。
- 一般編集Chrome PASS `7d87872be18544f5b5cc94ddd3695792`。`evidence/browser-crowd-tiles-lit/`。入力/点追加削除/履歴/保存等。
- 独立屋根ray-triangle PASS `c3d77f8d029f4dc18b2d9e6e9373b9a7`。`evidence/roof-depth-crowd-tiles-lit.json`、調べた赤色cell1160、漏れ0。
- 15入力＋元V114/v1/v2＋成果物の19 SHA読戻し PASS `6597830a5f78460f8d16511e0ba0813f`。`evidence/source-pins-crowd-tiles-lit.json`。

## 履歴・注意

最初のタイル版もunit/build/ChromeはPASSだったが、表示確認でLED面積が約2%しかなく暗いと主担当が判断し、群の発光島と光芯を増やした。最初の可視LED193に対し最終例753。最終productを光芯調整後に再検証した。技術PASSを本人の見た目の承認とはみなさない。

最初のcrowd-tiles checkerと一般crowd checkerの出力prefixが重なり、report.jsonが上書きされた。両commandの原receipt/logは保持。専用checkerをcrowd-blocks prefixへ修正し、87f65...で独立したreportを新規実行して確保した。旧上書きreportを専用checkerの完成証拠に使わない。製品の不具合ではない。前段のFAIL/本人不採用（間引き観客、長い棒、旧カメラ検査誤り等）は旧CURRENTと原receiptに残す。

通常試合の新球場/公式イベント自動反応は未接続（DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED）。全端末FPS/長時間メモリは未計測。本人の外観確認は未取得。次は本人の確認と観客だけの必要な調整。ロゴは変更対象に戻さない。

専用CURRENTと固有receiptをmilestone checkpointとして使い、他chatのCCG共通CURRENTを置換しない。commit/push/merge/deployはしない。判断は既存PR380 commentへ集約。
