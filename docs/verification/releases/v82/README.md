# v82 メーカー：削除・入力復帰

配布物は [maker.html](../../../demos/releases/v82/maker.html)。単体offline HTMLで、通常の選手・打者・投手メーカーとして使う。試合用能力JSONは既存の通常試合へ読み込める。通常試合そのものはv81から変更していない。

最終HTML SHA-256: `5c4ab2836fff35957f4480afb48e7d0a6096879184fccb6b997e635dbb582edf`。

## 使い方

- 投手調整の所持球一覧のそばに「選択した球を削除」「削除を取り消す」「未確定の入力を戻す」。最後の1球は残す。
- 選手の内部値は項目横で日本語の理由と具体的な修正量を確認。「自動調整」で候補を表示し、適用または取消。取消は入力値を保持する。個別・全選手の未確定入力を戻す操作もある。
- 身長・バット全長はcm。許容範囲を表示し、保存は従来のm。
- 比較集団は選手を選んで個別に外せる。直前の除去を取消できる。後続の確定編集や読込後は古い取消を使えない。

設計・原因・所有境界は [設計記録](../../../design/2026-10-20-maker-recovery-v82.md)。再生成は `node tools/browser-bridge/build-maker-release-v82.mjs`、配布物の照合・凍結は `py -3.10 -X utf8 -B tools/browser-bridge/package-maker-v82.py`。

## 最終検証

各reportのartifact hashは上記の最終HTMLと一致。receiptは `docs/ai-continuity/verification-receipts/` 内、共通prefixは `MB-20261020-V82-MAKER-`。

|検証|結果・原記録|
|---|---|
|Core|4ファイル87 tests PASS、新規12件。`RECOVERY-CORE-GREEN-FINAL_6bae661ee3bc4cecb40d366dcaf14b41.json`。TSC PASS `RECOVERY-CORE-TSC-FINAL_162e3219c4744f2eb34efdc98305aa23.json`|
|内部値・復帰|1200/390px、各8群。候補・取消・適用、cm/SI、任意精度、別選手pending、研究用選手、名前/ID空欄、参考接触再計算、比較集団、保存。[report](maker-recovery-release/maker-internal-recovery-check.json)。`RECOVERY-RELEASE_2ed307ad568546ef85fceed99092dff4.json`|
|球削除・取消|両幅2ケース、最後1球/dirty/stale/他選手/保管庫/成績帳の保護。[report](pitch-recovery-release/report.json)。`RECOVERY-PITCH-RELEASE_536196da57fc49ac95fdfd87ac9ca5a2.json`|
|球種メニュー|両幅×左右の4ケース、24候補、矢印、方向、32球、キー操作。[report](pitch-menu-release/report.json)。`RECOVERY-MENU-RELEASE_576ed37241e145eead3ff58debd719b5.json`|
|投球図・試投|両幅×2球種の4ケース、継承した4方向図とCore試投。[report](pitch-views-release/pitch-views-check.json)。`RECOVERY-VIEWS-RELEASE_e0f5c1165ba341339c23822c248ded74.json`|
|無劣化継承|v81と同時刻64場面のRGBA hash・試投・rosterが一致。全673保持。[report](pixels-release/report.json)。`RECOVERY-PIXELS-RELEASE_bd620e39ea0948d38a7014c85ec7c4a8.json`|
|コース・成績|63コース、練習、閉幕、保存/再読、既存320球の成績取込。[report](course-release/report.json)。`RECOVERY-COURSE-RELEASE_95465ca266194d6d973c957d0d55b49b.json`|
|得能|独立17系統、基礎/公開能力不変、JSON往復。[report](traits-release/traits-check.json)。`RECOVERY-TRAITS-RELEASE_66ca4b66623b4a3fb601fb312ced9195.json`|
|再生成|HTML・build metadata・95入力manifestがbyte一致。[report](rebuild.json)。`RECOVERY-REBUILD_9e49018b80234eb89d747608814e0558.json`|
|凍結|最終7report、現Source、旧v81不変、別bundle境界を確認。`RECOVERY-PACKAGE_895a8f0f17f747a986bf098a3a01e0dd.json`|

ブラウザーはheadless Chrome、1200/390px。実スマートフォンの検証ではない。ページ例外・外部通信・横はみ出しなし。補正候補の390px画像は [表示例](maker-recovery-release/target-proposal-panel-390.png)。

## 失敗の記録と修正

- 未実装のCore/APIを使う初回REDは `RECOVERY-CORE-RED_1f1b521aefd34af0b151ceb2a6c4ceb7.json`、`RECOVERY-UI-RED_1e894114073046d39da369608e5fee7f.json` に保持。
- 旧コース試験は同じ球の再選択を暗黙の入力破棄に使っていたためFAIL。`RECOVERY-COURSE_f94b3b12d0cd447c868d975357f1c907.json`。v82試験は明示 `discardPendingInputs()` に変更。他の検証は削除していない。
- 新UIの数値以外の途中入力が数値専用control探索へ入り、未捕捉例外になった。名前/IDを空欄にするRED `TEXT-RECOVERY-RED_ad6a150e6b7f48c899fa5f5982c7e2ea.json` を残し、汎用エラー処理へ修正。
- 参考接触研究中の自動調整が通常試打だけを再計算し、古い参考結果を表示していた。`REVIEW-REGRESSION-RED_0bdd5cb76cc44d7fafc644a76294da8e.json`。既存実験経路を使う修正後、質量10→5kgの入力と結果を再計算して完全一致を確認。

旧凍結v81 rendererと現メーカーCoreは別bundle。共有ソース2件のauthoring accessor追加による履歴hash差は最終reportの `native.sourcePinsAtEnd.currentSourceDifferences` に保存。旧bundle・manifestを現在ソースのhashに書き換えていない。

元Charter独立承認HOLD、Native認証、100試合校正、実機/熱/電力/オンライン、元の機能残件は継続する。シーズン確定履歴の削除や全体Undoは今回実装していない。
