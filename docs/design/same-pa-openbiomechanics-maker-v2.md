# 実測スイングへの切替 — 2026-10-16

最新の人間指示に従い、メーカーの参照元を MMD から OpenBiomechanics に置き換えた。旧 MMD HTML・素材・検証記録は履歴として保全し、新メーカーには MMD の軌道・骨格・連結モーションを組み込まない。通常 Core の解析スイング試験は独立した比較試験として残す。

## 実装と出典

- importer: `tools/browser-bridge/import-openbiomechanics-bats.mjs`
- 原データ: OpenBiomechanics commit `44b98dae05cceb016f080ab39d105c85b8639084`、release `dataset-v1` の打撃 landmarks と同 commit の metadata / bat model。ダウンロード済み原本と SHA256 検証 manifest を照合する。
- `docs/demos/measured-bat-motions.json`: 677試行の索引、左右各6種類の原測定軌道、計1,644原標本。左右それぞれを記録速度で並べ、0/20/40/60/80/100%位置から選択する。元の欠損5行を補完せず、欠損試行は候補から除外する。全677試行をゲームへ取り込んだという意味ではない。
- 範囲: 記録された接触時刻の前0.30秒～後0.08秒。原小数時刻を正確な microsecond tick に変換する。名目360Hzから時刻を再生成しない。原 CSV 行・文字列と、選抜規則・元 SHA・公開モデル SHA を保持する。
- 座標: lab `(X,Y,Z)` → world `(Y,Z,X)`、m、行列式+1。元の +X は本塁→投手、+Y は右打者ボックス、+Z は上。自動平行移動、左右ミラー、ボールへの接触合わせは行わない。
- バットの軸: 手元基準点→芯の方向。芯の標本を固定し、公称バット長、tip→sweet 0.1524m、knob→hand-reference 0.17145m を宣言して剛体を構成する。選択した12試行の最大手元残差は約8.08mm（拒否上限20mm）。ノブ・先端の厳密な実測復元とは主張しない。軸まわり回転は未測定で、最小回転輸送を宣言する。
- 原標本間の Core 接触試験は既存 `ReferenceBatKinematicsV1` の線形グリップ / 最短 SO(3) 補間。中間姿勢・速度まで実測であるとは主張しない。表示再生速度と実スイング時間倍率を分離する。

新メーカーは実測表示で起動し、12軌道の比較、5視点・同時刻3方向表示、世界回転・取り付け調整、バット長、ゴロ／ライナー／フライの目標タグ別保存、JSON再読込を使える。タグで打球結果を固定しない。実測参照設定の時間フィールドは `startTimeSeconds` / `endTimeSeconds`。旧 MMD 設定は意味を変えて自動変換せず、明示エラーとする。参照を含まない旧選手 JSON は従来の Core 試験として読める。

原資料の CC BY-NC-SA 4.0 と upstream 独自の利用制限を保持し、新 HTML 内に原 license 文を同梱する。実測データをコードの MIT license と混同しない。データ集団は特定リーグの標準母集団ではない。

## 検証

`tools/browser-bridge/check-measured-maker.mjs` は原 CSV 全行から選択標本を独立照合する。時刻、右手系座標、芯の完全一致、剛体長、手元残差、未測定 roll 表記を確認する。実 Chrome 1200px / 390px で12軌道×5視点、長さ、校正の原資料不変性、調整保存、JSON読込、旧 MMD 設定拒否を検証する。

接触試験は実測軌道と本物の Core 投球を明示的な研究配置で合わせ、共通の剛体衝突・空力・地面物理へ渡す。出力打球の速度・回転が接触計算と一致し、身体能力上限超過を拒否することを検証する。配置は研究入力であり、元データのボール軌道や実試合の成功率の再現ではない。

実行例（repository cwd、必要な引数は絶対パス）:

```powershell
node tools/browser-bridge/import-openbiomechanics-bats.mjs 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/outputs/参考データ/openbiomechanics'
node tools/browser-bridge/build-maker.mjs 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/outputs/にーくら野球メーカー_実測スイング版.html'
node tools/browser-bridge/check-measured-maker.mjs 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/outputs/にーくら野球メーカー_実測スイング版.html' 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/outputs/参考データ/openbiomechanics' 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/outputs/measured-maker-evidence'
```

最初のブラウザー試験は閉じた details 内入力へのアクセスで失敗（15709f...）。次は試験配置の始動が選手の反応時間より早く、正当に拒否された（ac8969...）。試験操作・配置だけを修正し、能力 guard は維持した。原失敗の receipt を保全した。

## 元の計画と残作業

この変更は調整器の参照切替である。Native の身体動作採用、球の保持・送球、走者、審判・公式記録を完成させたことにはならない。本線は「同一物理世界→合理的9人守備→走者・裁定→同じ世界の粗いカメラ描画→実打球混合9回→100試合以上の記録監査→PC/実機スマホ・オフライン検証」のまま。

選手ごとの実測に根拠を置く変形は、能力の物理上限・身体到達範囲・実時間を守って後段で接続する。取得済み投球411試行も未接続。球の回転、厳密なリリース速度・投球能力を手の軌道だけから捏造しない。通常 v31 は旧近似試合のままで、正式 Native 実打球混合9回は未達。

## Shared production Core sampled rigid window

`RigidBatSwingWindow.sampledKinematicsV1` と `createRigidBatSwingWindowFromSampledV1` を追加し、正式な `resolveAerodynamicRigidBatSwing` / `resolveAndRecordAerodynamicRigidPitchAgainstBatter` が全sampled keysの並進・SO(3)回転から実接触/打球/正規timelineを計算できるようにした。旧3-knot V1/compatibilityは同じ計算経路を維持し、二つのkinematic modelの同時指定を拒否する。

接触探索のLipschitz速度上限は、全key区間のmaximumGripSpeed＋maximumAngularSpeed×(length＋maximumRadius)から導出し、丸めたendcapも含める。sampled時の球は元の投球trajectoryから各tickでsampleし、任意の探索stepで再積分した別の球を描画しない。seed/clockの差替えを拒否し、Native canonical JSONのobject key順序だけの差は許容。前後のheld poseを含める場合は呼出元が明示intervalを渡す。

MeasuredBatAxisReferenceV1をCoreへ移し、browser側は同じexportのre-exportへ変更。ReferenceBattingWorkbenchの独立した接触探索を削除し、この共通Coreへ統一した。描画・接触・打球は同じreference/physical stateを使う。軸回り回転は未計測でminimum-rotation、key間補間は数学モデル、身体到達/筋力torque/反動は未連成のまま明示する。Nativeのintent/commitment/clip保存はまだ旧3-knot経路なので、Native game adoptionを主張しない。

新14試験は制御されたcollision geometry（12本は元の実測手元/芯keys、2本は曲線/拒否試験）。12本の入力投球を測定keyに交差するよう配置した試験であり、実選手のヒット率・打球分布の統計ではない。全83試験PASSa3bdf9129f5f417baa12ce7f88253612、wholeTSCa73cd7cc0eef40c9b592f4f9c21ba53a。初回TSCFAIL5b8a1853...はtestのreadonly vectorを意図的にmutationする箇所で、test側castのみ修正し原FAILを保持。

最終offline maker SHA cbd809fb2ccd1942483238eb4366958dd0ed9230600ecea4cfab1c5f171da6fd/4,232,452bytes、build456a1197...、Chrome browser3a5cd083f35141c9ba14f03ef10bf9e5 PASS25.202s。677trials/12clips/1644original keys不変、1200/390幅・12×5views・長さ/calibration/JSON/contact・通信0/error0。390幅は実スマホではない。source cbaa0c99...の旧HTMLはwork/archives/measured-maker-before-shared-core-<sha>.htmlに保全。最初のbrowser PASSa895f97f...はkey順序修正前のbuildで、final build/browserを別receiptで検証した。
