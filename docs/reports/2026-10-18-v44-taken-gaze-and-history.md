# v44 見送り視線の修正と開発史

## 変更内容・原因

打者視点の見送りは、旧エンジンの`localTick>=38`（release後550ms）から`41`まで動かす処理だった。現在の実Coreでは捕球がそれより早い球がある。最初の12球の見送り6例には、release後約487/492/525msで捕球する例もあり、固定開始時刻では追尾できない。

遅い球では少し角度が動いても、条件に`observed.ball`を使っていたため、捕球で球を非表示にするとカメラも元へ戻った。これは所持球を描かない方針の誤りではなく、視線を可視球の存在に依存させた表示設計の問題だった。

現在までの実投球がplate前1mへ来たことを開始にし、165msの小さな視線移動を使う。旧来のyaw±.40rad、pitch±.18rad、視線targetのz≥−.42m、わずかなzoomを維持する。捕球後は最後の可視位置を視線用にだけ保持し、球を描かない。次球の準備・巻戻し・スイング・ベンチで解除。他の視点とv43の打点注視・終了後の追尾は従来処理を使う。

## 変更ファイル

- `tools/browser-bridge/live-taken-pitch-gaze.js`: 現時刻までの投球prefixだけを読む、状態を持たないobserver。
- `tools/browser-bridge/v44-live-presentation.mjs`: 打者視点だけでobserverの向きを使い、旧固定時刻の見送り処理を無効化。
- `tools/browser-bridge/build-v44.mjs`: v43＋同じCore・能力・OBPデータ・画像から単独HTMLを生成。
- `tools/browser-bridge/check-live-taken-pitch-gaze.mjs`、`check-v44-taken-gaze.mjs`: 非破壊性・prefix・時計・ブラウザ回帰試験。
- `docs/history/README.md`、`TIMELINE.md`、`INCIDENTS.md`: 元の要求史・各版報告・Native資料への索引、16事例の原因と改善、訂正・未知・未完を整理。
- `docs/handoffs/LATEST.md`と既存入口: 最新状態と履歴へ誘導。古い文書本文は当時の記録として保持。
- `docs/demos/releases/v43/`、`v44/`、`docs/verification/releases/v43/`、`v44/`: 前回の未公開v43も含めたHTML・manifest・ライセンス・限定証拠。v41と未追跡v42プロトタイプは上書きしない。

## 実検証

- Helper PASS `MB-20261018-TAKEN-GAZE-HELPER_b215eadfc07146a8bf5ca108339cf8d7`。
- Build PASS `MB-20261018-V44-BUILD_6c9e33dd87ee4926919d8dcfb1dbdeb8`。承認PNG/font/旧計算処理の不変ガードを含む。
- Browser PASS `MB-20261018-V44-BROWSER_34c97bd1868942a4b2e1dd3fab193e07`、17.952秒。1200px/390px各12球、左右6見送り、捕球後の非表示と角度維持、角度制限、巻戻し・準備、左右スイング中と終了後のv43カメラ一致、他の4選択視点、実時間再生。画像を確認。pageerror/外部通信なし。
- 全103Core入力とbundleを照合。12球すべての`frames/play/events/match` SHAはv43と一致。現在のCore bundleは`f29aeeb7ed1e54c5f668a8ededa569d44880b0f2826197be1fd64d8c57fb6aaa`のまま。
- 旧v43の初期確認 `8d394ce52368475a944ed06d5e12161b` は「一度でも角度が動く」だけを見てPASSした。捕球時の維持を追加した旧版再現はFAIL `9f88ffb508ce4fc7aa242d5d93e1aceb`。両記録を保存。弱かった確認を最初から十分な回帰検証だったとは扱わない。
- [生QAと画面](../verification/releases/v44/)、[v43の最終生QA](../verification/releases/v43/)を保存。
- 配布・文書検査 PASS `MB-20261018-V44-RELEASE_46128d5c53644c23a1e72046d77b5e9c`。変更した入口・履歴の相対リンク、v43/v44の配布SHA・元HTMLとのbyte一致・同じCore、v41を上書きしていないことを照合。

HTML SHA256 `def5e0c9e4a27ad99422a615c10e58f9f4cf9e3e778b6f58c7336457c383cee5`。ワークスペース版とGitHub配布版をbyte単位で照合して保存する。

## 残る範囲

1m/165ms/角度制限は既存の控えめな視線移動を再接続する表示規約であり、人間の視線計測により校正したものではない。Core・能力・ルールは変更していないため、今回新たな9回・100試合・全体TypeScript検査は実行していない。実機スマホは未確認。元計画のNative連続世界、公式記録、未完ルール、全得能、実能力と分布校正は別に継続する。

本履歴は報告・Source・receiptを結び直す作業であり、昔の全実験を再実行した監査ではない。原因未確定のNative timeoutや過去のHOLDを成功へ書き換えない。ローカルAGENTS、個人設定、secret、lockfile、DB、v42の他作業は公開対象に含めない。
