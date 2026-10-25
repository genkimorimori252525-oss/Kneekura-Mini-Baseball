# ロゴ・観客調整 checkpoint

次段階は [CURRENT-crowd-tiles.md](CURRENT-crowd-tiles.md)。ロゴは本人が満足と明示。観客の間引き/個別描画は本人が拒否したので、現在のrendererは群衆タイル。以下のhash・群数・旧方式のPASSは履歴として保持する。

2026-10-24 / MB-20261024-BALLPARK-VISUAL-TUNING / IMPLEMENTED_AND_VERIFIED（設計室）。

対象/影響/復旧判断はPLAN-visual-tuning。本人の最新要件に基づき、細分5〜8倍、明るさ/発光、過密な観客の調整、2コマ×2周→3コマ×1周、LED7cmを実装。手/腕の動きと棒の長さを分離。会話の当初解釈「2・2・3拍保持」は本人の追記により採用していない。

## 現在の成果物

`outputs/球場設計室_v3_局所密度版.html`、45,813,279 bytes、SHA `cffdb8988a5eb89c43d3a9f2883f8d99e250b24419e8dd23ebcbdfdae211ec0b`。変更前は `outputs/球場設計室_v3_観客ロゴ調整前.html`（SHA `e4146e04b6abe29ded33344b6e0127dcc45824c0a79dd4a228b4d42d91143180`）で復旧できる。

初期: 細分6/brightness1.7/glow0.3、観客density0.25/simple/size1/brightness0.7。代表群4,321、5%では865、100%では17,280。定員12万人は不変。LEDは数学的に0.07mで、身体50〜180%でも長さ不変。間引きseedはコマ間で固定。ロゴは素材合成→同じ光点、発光はnative dotの影処理を利用。屋根・内野・金色線・Coreは保持。

新しいoptional値は旧JSONに自動追記しない。新例はrussian-dome-v3-tuned.json。ロゴ/観客外観は保存/履歴対象。再生状態/コマ選択/反応は一時設定のまま。最大3枚のscene cacheと背景停止は維持。

## 実検証

receiptは `docs/ai-continuity/verification-receipts/MB-20261024-BALLPARK-VISUAL-TUNING_<ID>.json` と対応log。

- unit30/30 PASS `ba2c931941f441e9a370440daed60d38`。7cm長・身体/手・間引き・7コマ・5〜8倍・発光・旧JSON/範囲検証。
- build PASS `f9cda7feb6594c6b81b65ca693f1a533`。`evidence/build-visual-tuning-first.json`。Core/原V114不変、renderer逆変換・構文・入力pin。
- 新しいUI/発光/外観Chrome PASS `05328d5e7b044d82baba84f74b215196`。`evidence/visual-tuning-roof-camera/report.json`。5/6/7/8倍、明暗/光の画素変化、最大発光の屋根遮蔽、密度5〜100%、3種の描き込み、サイズ変更でも7cm、LED明るさ、保存再読込/旧JSON保持、390/320幅。初期画像を目視済み。
- 観客再生Chrome PASS `06663b4e42ed4ca182d936cc25e62482`。`evidence/crowd-tuned-first/`。ループ/加速・停止・cacheでscene再計算なし・色変更等。
- 6視点ドームChrome PASS `b90c5b87318c4a56ba4a80590f1c2555`。`evidence/dome-tuned-first/`。元renderer画素一致、固定内野、屋根/ロゴ/cache、JSON/履歴、モバイル。
- 独立屋根ray-triangle PASS `6babfe2b7d36458d937e58a1cfbc34d9`。`evidence/roof-depth-visual-tuning.json`。
- 18 SHA読戻し PASS `059bc2e28a104ba3a767af6ffd7088cd`。`evidence/source-pins-visual-tuning-first.json`。14入力＋元V114/v1/v2＋成果物。
- 通常編集Chrome回帰 PASS `dc91108c9bf849108d37cea5f76a08c7`。`evidence/browser-visual-tuning/report.json`。点追加/削除/drag、無効入力、取消、保存/読込、旧renderer画素一致等。

## FAILと診断を保持

初回新UI検査 FAIL `3276a301711c4ebaa803c227eb86ee8e`、`evidence/visual-tuning-first/report.json`。「閉じた屋根でロゴ有無の画素一致」を屋根内側の俯瞰で要求していた。原cameraはeye.y=100m、roof.y=105.88m。診断 `glow-diagnostic-overhead.json` ではvisibleFineLogoPoints4359で正当に内側が見え、球場全景y260mではvisibleFineLogoPoints0、ロゴ有無差0（glow-diagnostic.json）。製品の光漏れではなく試験条件の誤り。試験を屋根外側の球場全景に修正し最大brightness3/glow1/factor8でPASS。これを理由に製品のカメラ/発光/屋根は変更していない。診断receipt `2ad501f82ddb4ac89258a07092d34034` / `870ce9e2349342d5838217c56dc2c362`。旧FAILは削除しない。

## 次手順と境界

本人の外観確認。旧保存JSONは保持するため、初期値を見る場合だけドームpresetを選ぶ。通常試合の球場導入/公式イベントの自動反応は未接続（DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED）。個別端末のFPS/最大8倍時の全端末メモリ安定性は未計測。最高設定は局所sampleが増えるが再生はcacheを使う。

共有src/dist/メーカー/他chat CURRENTは変更しない。この専用checkpoint/固有receiptを使いCCG共通CURRENTを上書きしない。旧承認条件・FAILはCURRENT-crowd/それ以前に保持。commit/push/merge/deployは行わない。判断はPR380の既存commentへ集約する。
