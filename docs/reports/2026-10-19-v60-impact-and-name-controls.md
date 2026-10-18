# v60 視線の安定調整と名前表示

v59の打者視点を維持し、安定開始の前後と微動の上限を比較できるようにする。球が選手名の文字/背景枠へ隠れ、俯瞰以外では名前が避け合って改行に見える表示も修正する。

## 変更内容

- 調整室のA/Bそれぞれに、予定インパクトに対する開始offset（−250〜＋150ms）、許容角度0〜.15rad、最大角速度0〜1.5rad/sを追加。初期0ms/.025rad/.18rad/sでv59と同じ。開始は意思決定からスイング終端の範囲、いずれかの微動制限が0なら完全固定。数値は身体の生体計測値ではなく表示係数。
- 早め/遅めのカーブ記録の選択ボタン。実記録の `timingErrorSeconds` の符号と大小から選び、打者の予測に対する誤差を表示する。打球やスイング時刻は編集しない。該当球がなければ追加生成を案内する。
- 全視点で名前を投影位置のまま重ね、走者名を赤色で上へ。打者名は走者になるまで隠す。通常HTMLと調整室に名前倍率.5〜2.5（初期1）を追加。文字と背景枠を一緒に拡縮する。
- 名前のDOM全体を独立した下位stacking contextへ置き、球overlayを上へ。調整室もfield→bat→名前→ballの順で合成し、停止時にも名前を確認できる。保持中の球非表示は継承。
- 旧調整/再現JSONには新設定と名前倍率の既定を補完する。新設定はJSONへ保存/再読できる。保存領域v60を使用。

Core113入力・球物理・スピン・実測バット・能力・AI・裁定・メーカー・投手100〜250msは維持。通常/調整室が同じ試合HTMLを内包する。新9回・100試合や元全計画の完成を主張しない。

## 検証

- IMPACT-UNIT2b478469 PASS4.875秒。左右×早振り/遅振りカーブ、5offset、厳密境界、1ms実角度/角速度制限、ゼロ固定、旧JSON/atomic設定/prefix/seek。実Core12球6接触6スイングで既定姿勢はv59と完全一致、Source/バット/113入力不変。
- NAMES-UNIT4e413f1e PASS.094秒。全6カメラの投影位置、重なり、走者優先/赤名/打者非表示、倍率/入力検証/読み取り専用canvas転記、球描画関数不変。
- BUILD5b9727ec PASS.187秒。frozen v59/113入力、5helper/名前transform/driver/templateを固定して生成。
- CADENCEff9509bc PASS7.938秒。60Hz手動時計のscene18/pitch45、非投球の高速更新0、loop始点pixel一致。

設定offsetのscene時刻をtickへ一旦戻すと、ちょうど開始点で1ULP手前になることを開発中に検出。計算済み開始秒とscene表示時刻を厳密一致で対応させ、誤差許容で判定を緩めず修正した。以前からの解除終端の微小段差は最大.0325論理pxで記録し、v59の既定視点を変更していない。

- BROWSERba307749 PASS52.577秒。1200/390pxで9数値設定の既定/変更、−100/+50msの開始、JSON75msのmarker更新、ゼロ固定/正の微動、旧新JSONとsession/name1.5の再現を確認。最初6球はv59のSource/バット/15時点の既定姿勢と一致。追加6球を通常Coreで生成し、早め−21.400ms/遅め＋2.987msのカーブ記録の選択を確認した。
- 全5視点の自然anchor、文字/枠の拡縮、実白球と不透明な名の重なり、保持球非表示、停止時field→bat→DOM名→ballのA/B最終RGBA一致を確認。実画面の同じpixelは球あり `[255,253,247,255]`、球なしの名枠 `[255,0,255,255]`。例外/外部通信0。走者赤名とz順はUNITで非ゼロ例を確認し、主browserの最初の走者frameでは名の可視例が0だったため、実走者の非ゼロ例は別補足検証として分ける。

通常HTML SHA256: `c4f50e430fbf04d2c1ef355d59fc8584583337221ffe03b43786cc40bd3c086f`。調整室: `661f38fef6b56e92a2eb571674e340c39af349441bb838ce10f2168f85b94e26`。

原browser FAIL74852987はCSSのfont serializationが31.3367/31.3368pxに丸められる検査条件で、font値のみ.0002px以内へした。FAIL036dc9bdは閉じたdetails内のbuttonを可視操作せずに待った検査手順、FAIL3ad73338はCSS縮小で落ちた元canvasの端pixelを実画面の白球と誤認した検査点だった。最終はdetailsを開き、球あり/なしの差分で実pixelを特定し、名枠の占有も確かめた。Source・姿勢・合成RGBAの厳密条件は緩和しない。設定JSONでmarkerが古いままになる問題は独立reviewで見つけて修正した。原FAILと中間receiptは保持する。

[実ブラウザ記録](../verification/releases/v60/presentation/presentation-check.json)、[配布照合](../verification/releases/v60/release-check.json)。機械receiptと実コマンドは `docs/ai-continuity/verification-receipts/MB-20261019-V60-*` に保存。

- RUNNER-LABELS549007ec PASS2.108秒。実走者が走り始めた500ms後を俯瞰で確認。1200/390pxそれぞれ10名中1名が実走者で、赤 `rgb(255,119,119)`、z3、守備9名z1の後へ配置される。観測前後のSourceは同一。[補足記録](../verification/releases/v60/presentation/runner-labels-check.json)。
- PACKAGE67a31248 PASS.796秒。上記ブラウザ/実走者補足/周期のSHA一致、113入力と5helper/transform/driver/template/builder、内包した通常HTMLと旧v54〜v59配布を照合。

## 主な変更ファイル

- `tools/browser-bridge/live-camera-tuning-batter-view-v60.js`: 調整値と開始境界。
- `camera-workbench-v60.js` / `.html`: A/B欄、マーカー、カーブ記録、名前倍率とJSON。
- `name-presentation-v60.mjs` / `live-name-display-controls-v60.js`: 全視点の名前と表示順/倍率。
- `build-v60.mjs` / `package-v60.py`: 固定入力からのHTML生成と配布照合。
- 4検査ファイル: `check-camera-impact-gaze-v60.mjs`、`check-name-presentation-v60.mjs`、`check-v60-presentation.mjs`、`check-v60-runner-labels.mjs`。

公開結果は以下へ記録する。実機の快適さと生体校正は別であり、原全計画・未達・原FAIL/UNKNOWN/CharterHOLDは保持する。

## GitHub保存

製品コミット `7d7602bf417d8e51edbfd90ddc37c31d32b6b8b4` を既存ブランチとDraft PR380へ保存。STAGING0bfeb1b1 PASS.906秒で76ファイルの実stage byte・credential pattern0・非log whitespaceを確認。PUBLICATIONcf41198f PASS4.016秒でremote/PR head・Draft OPEN・12件の公開raw byte一致を確認した。[公開記録](../verification/releases/v60/publication.json)。後続の記録のみのコミットは製品byteを変更しない。main未マージ。
