# v56 投球FPSと打者の追従調整

人間の最新訂正に従い、2.5倍は投球のボールのFPSとして実装する。表示倍率の初期値は通常視点・俯瞰とも1。球の物理半径と描画格子4pxは変えない。

## 実装

通常試合v55では全体を55ms間隔で描いており、古いHTMLに残ったball専用rAFは通常Hostでは停止されていた。v56は通常Hostの1つの再生時計から投球だけ22ms、背景・選手・バット・打球・送球は55msを目標に描く。更新の余剰時間を持ち越し、60Hzで単純なnowリセットが2倍止まりになる問題を避ける。遅れた回数だけ架空のフレームを追いつき描画することはしない。実表示頻度はrAFと端末負荷に依存する。

投球はOriginal Sourceのmaterial historyから位置・速度・姿勢を読取専用で取得する。線形補間や別の物理積分を導入しない。prefix時刻で自由な投球だけを許可し、打球／送球／所持球を高速レーンへ混入させない。打球接触と捕手first-contactを境に自由Sourceの観測を終了し、その後の捕球制約は既存55msフレームへ戻す。所持球は非表示。

投球追従の新2項目は構えの向きを基準にする。角度差から許容範囲を引き、追従率を掛ける。現在の頭の向きを基準に繰返し圧縮して最後に密着へ戻る設計ではない。初期値は追従率0.15、許容範囲0.02rad（約1.15°）。1/0radで旧v55の姿勢・制御に完全一致する。既存ミート・選球眼と角速度・角加速度制限は維持し、スイングへの境界は連続に解除する。新しい選手能力は増やさない。

調整室はAが従来値1/0、Bが改善初期値。左右の固有投影を使った透明canvasに投球だけ高速で重ねる。停止・seek時はv55.1のfield→bat→ball全3層合成を保つ。区間loop逆行時は終点の球のcacheを破棄し始点を読み直す。設定／再現sessionには任意のballDisplayを追加し、旧JSONは倍率1と追従1/0を補完する。読込時に画面・保存JSON・ブラウザ保存を同期する。

ゾーンの幅0.4318mと高さ身長比0.270〜0.535は既にCoreと一致していた。描画面だけz=0、実判定面はz=.15mだったため、ライブ描画面を.15へ合わせる。Coreの裁定と球半径は変えない。球中心が枠のわずかに外でも球の半径でストライクになり得る従来判定は継承する。俯瞰ではフィールドの枠と横の配球図を隠し、他視点で復帰する。配球履歴リストは保持する。

## 検証と証拠

正式結果はv56のmachine receiptsと[配布検査](../verification/releases/v56/release-check.json)、[表示検査](../verification/releases/v56/display/display-check.json)、[周期検査](../verification/releases/v56/cadence/cadence-check.json)を参照。

- Ball display unit: a21e79d7 PASS。通常/俯瞰別倍率、初期値1、不正入力の原子的拒否。
- Tracking unit: 2c6beb98 PASS、5.389秒。1/0のv55完全一致、25不正値、左右、1:10、長時間creepなし、release高さ、seek/rewind、fractional swing境界と速度・加速度、実12球8contactのSource/バット不変。
- Source sampler unit: 06375cc4 PASS、9.516秒。12実record、550正規時点・550中間時点、1078非投球拒否、元の姿勢、出力copy・未来payload拒否、Source/バットhash不変。
- 最終build: 18d5373c PASS、0.202秒。Core113入力のraw SHAとfrozen v55を固定して2つの自己完結HTMLを生成。
- 表示・保存: f5e7af45 PASS、94.500秒。1200/390pxで通常5視点の倍率と既存optical45点、保持非表示、ゾーン四隅の独立投影と俯瞰復帰、追従UI、旧/新JSON・session・download/import/reloadと保存同期、不正8件、停止3層pixel60枚。正規v55の12球とframes/play/events/match/bat全hash一致。例外/外部通信0。
- 配布照合: 46b81545 PASS、1.530秒。2HTMLと唯一の埋込試合、現113入力、各helper/driver/template/transformのraw hash、両browser reportの最終SHA、過去v54/v55/v55.1配布の不変を確認。
- 周期・loop: e94f57d3 PASS、8.968秒。60Hzの手動時計で両HTMLとも1秒でscene18／投球sample45、非投球の高速更新0。100ms区間を3回巻戻し、A/Bの始点球とRGBA全体がSource＋各投影に一致。参考実時間825.8msではscene15／sample34で、手動時計の周期証拠とは区別する。初回検査のselect値`.25`によるFAILは`0.25`へ訂正し、製品を変えずPASS。

先行unit FAILは原receiptに保持する。追従のaimWeight二値分岐でfractional seekが不連続になる点を発見し、圧縮の解除量と非identity時のbracing解除を連続化した。identity1/0は旧分岐のまま残す。Source検査側のSHA literal誤読・VM realm比較失敗は検査の不具合として分ける。

## 範囲と残件

Native CoreのSHAは `4a581b262a71530ef67503ba76e71849d52c394a2b7c113852a461b423486279`、113入力不変。物理・実測スイング・AI・能力・裁定・メーカーは変更していない。従来9回完走や368テストの証拠は同Coreの過去証拠として参照し、今回新たに実施したとは扱わない。カメラの初期係数と選手の実SI・成績分布は未校正。実端末の主観的操作感、最新100試合の全監査、Native全体の原計画、既存FAIL/UNKNOWN/Charter HOLDを保持する。

再生成: `node tools/browser-bridge/build-v56.mjs`。編集元は `v56-live-presentation.mjs`、`live-pitch-ball-cadence-v56.js`、`live-camera-tuning-batter-view-v56.js`、`live-ball-display-controls-v56.js`、`camera-workbench-v56.js/html`。旧版の公開HTMLやbuilderは上書きしない。

通常HTML SHA256: `331f5f9a3bafb78ba2ae5009ba25fb795eeb08d5f42c85db3844c2d186ec32c5`。調整室: `90e955f8fb1fa6432de563c7a44afab2b1e4ec644ec973c76cd395a0edcbebea`。CCG auditは原来のCHARTER_UNAPPROVEDでHOLD（exit1）を維持し、製品試験PASSへ読み替えない。
