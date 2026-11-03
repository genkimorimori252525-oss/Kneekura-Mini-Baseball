# v43 — スイング終了まで打点を注視

打者視点では、実測スイングの開始から終了まで、打者が狙った打点へ視線を固定する。終了した時点で既存の走者／打球追尾カメラへ戻る。物理シミュレーションは注視中も進む。

## 変更ファイル

- `tools/browser-bridge/live-batter-gaze.js`: Core の `zoneJudgment.observedForecastPosition + aimErrorMeters` を予定打点として読み取り、`referenceStartTick`〜`referenceThroughTick` の有限区間だけ返す。実際の衝突点や結果を参照しない。見送り・バント・ベンチ移行では適用しない。停止した物理フレームの後も既存の Presentation 時計で終了する。
- `tools/browser-bridge/v43-live-presentation.mjs`: 区間中だけ打者カメラを維持して予定打点へ向ける。従来の眼の位置、焦点距離、左右打者の扱いは保つ。走者への役割変更後も本人を描かず、既存の近接身体クリッピングをこの注視にも適用し、捕手の巨大なビルボードによる遮蔽を防ぐ。区間外と他の視点は従来処理を使う。
- `tools/browser-bridge/build-v43.mjs`: 現在の v41 と同じ Core、103 入力、能力データ、実測スイング、承認済み画像・フォントから別 HTML を生成する。v41 と未追跡の v42 プロトタイプは保持。
- `tools/browser-bridge/check-live-batter-gaze.mjs`、`check-v43-batter-gaze.mjs`: 時計境界・予定打点・読取専用性、および通常 HTML の回帰検証。

成果物: ワークスペース `outputs/ばせぼーるlv43_TBD_vs_LAD_打者の打点注視版.html`。SHA256 `7b05c8dd2600a92e5d53ad534478a13be68d500ddf5c3ccb3bd922d333778a0d`、3,398,443 bytes。オフライン単独 HTML。打者視点を選択すると適用される。メーカーは変更していない。

## 検証

- Helper PASS: `MB-20261018-BATTER-GAZE-HELPER_2e35e95db46a4a1c8d862eb5974700ce`。開始／終了の境界、小数終了時刻、停止・進行済みフレーム、見送り、バント、ベンチ、巻き戻し、異なる Source 時計、非破壊性。
- 最終ビルド PASS: `MB-20261018-BATTER-GAZE-BUILD_01d9ba98e009477c993ae91f45d23421`。承認済み PNG/font と旧計算処理の同一性ガードを含む。
- 最終 Chrome 検証 PASS: `MB-20261018-BATTER-GAZE-BROWSER_aa26f5a4566f4a4988ddce9171b09e9f`、22.015 秒。1200px/390px、実際の左右打者、自動俯瞰 ON/OFF、接触直後／途中／終了直前の固定打点、終了時の従来カメラへの復帰、本人と近接捕手の遮蔽回避、巻き戻し、次球の準備、見送り、他の選択可能カメラと自動守備切替の同一性。画面を実際に確認した。
- 現在の v41 (`bd1802d52a01920ef47e149555a7605c3d0cb83c7c15ba2e2288004c9bef7061`) と両画面幅で同じ12球を生成し、各球の `frames/play/events/match` SHA256 がすべて一致。全103入力の SHA256 と埋込 Core の同一性を照合。新旧 Core は `f29aeeb7ed1e54c5f668a8ededa569d44880b0f2826197be1fd64d8c57fb6aaa` のまま。
- 詳細と4画面: ワークスペース `outputs/verification-v43-batter-gaze-v5/`。

初回実ブラウザ検証の FAIL `e40088f5fd4c44d28b02f2604c80d697` は終了時刻の減算丸めが原因。絶対 Presentation 時刻との比較へ修正し、回帰検証を追加した。次の FAIL `d8cbb9474d09411d92cdcd08094685eb` は存在しない手動守備カメラボタンを検証が選択したため。検証を実際の自動切替へ修正した。その後の PASS v3/v4 でも画像確認で近接身体による遮蔽が見つかり、最終 v5 で解消した。全記録を保持。

## 範囲と限界

終了時刻は固定秒数ではなく、その選手の実測スイングの有限終了。静止したフォローポーズの保持時間は加算しない。最初の左右例では接触後およそ69ms/75msで既存追尾へ戻る。新しい実測軌道、人体モデル、視線の生体計測は追加していない。実機スマートフォンと新しい9回通し／100試合は未実施。今回12球には実際の空振り例がない。Core は変更しておらず、原計画の Native・裁定・公式記録・能力較正などの未完事項は本修正の完了と別に継続する。

GitHub への新規 push/merge、設定、lockfile、依存関係、secret、DB の変更は行っていない。元の Charter HOLD と履歴を保持する。
