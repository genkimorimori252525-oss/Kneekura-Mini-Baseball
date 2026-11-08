# v83 — ホームラン見送り時間

通常HTML: [game.html](../../../demos/releases/v83/game.html)。調整室: [camera-workbench.html](../../../demos/releases/v83/camera-workbench.html)。

投手目線から守備目線へ移行済みのHRで、既存Coreのフェンス越え時刻から**1.75秒**、同じ守備者からスタンド方向を見続ける。Sourceの現在の死球sampleがある間は表示用copyを観測する。球の保持/捕球には適用しない。守備へ移らない決定的HR、他視点、非HRは従来どおり。得点/HR表示を遅らせず、走者の進行と公式結果を変えない。

主因はCoreで越え確定後に球がdead/非表示になり、視線のtargetが失われること、およびbench/守備機会なし条件が守備カメラより先に適用されること。fieldHoldMs一律増加では解決しない。新helperは既存カメラの過去の成立条件を使って、この窓内だけ視点とtargetを保持する。

`node tools/browser-bridge/build-home-run-watch-v83.mjs` で再生成。凍結v81のNative Core SHA `a25f2da5d941219a3038e9c27ac0a49cc4cdd79ac0e50d0203a5603e1264e4bd` をそのまま継承する。新規Sourceは `home-run-watch-v83.js`、`home-run-watch-patch-v83.mjs`、builder。過去のSource manifestを現ソースのhashに書き換えない。

## 実検証

- Unit9件PASS。端点、逆seek、別record、Source時計1/1000/1e6、未来payload非読取、決定的HR、他視点/捕球、bench flag省略、Source不変、格子外の越え時刻。receipt `MB-20261020-HR-WATCH-V83-UNIT_9ed4db23adeb4e13a1c6a87f38685e58.json`。
- [実ブラウザー](browser-final/report.json): headless Chromeの1200/390pxで通常の第39球HRを生成。越え後100/500/1000/1499/1749msは守備目線、1750/2000msで従来カメラへ戻る。現在Source球とtarget一致、死球は表示copyのみ、逆seek、他視点、非HR、history不変、ページ例外/外部通信/横溢れなし。receipt `MB-20261020-HR-WATCH-V83-BROWSER-FINAL_d5a1d8e662da4c06a2cadf3567eca5f0.json`。
- [従来場面](pixels/report.json): 144場面のRGBA・Core観測がv81と一致。receipt `MB-20261020-HR-WATCH-V83-PIXELS_e300f8435701417f85826b9fd75ca60f.json`。
- [全試合記録](history/report.json): 9回320球と別seed3回82球を完走し、全canonical history JSON hash・最終matchがv81と完全一致。全field complete、成績保存/JSON往復/重複拒否も確認。receipt `MB-20261020-HR-WATCH-V83-HISTORY_c0276bf815114c0ba9081acf86e6fcb1.json`。
- [再生成](rebuild.json): 通常/調整室HTMLと両metadataの4ファイルがbyte一致。
- [調整室](lab/report.json): 60場面の描画/観測がv81と一致。設定・session往復、成績帳の無記録、PC/390幅を確認。receipt `MB-20261020-HR-WATCH-V83-LAB_300b050fc0c94947b88c3324db5e1054.json`。

未実装REDは `MB-20261020-HR-WATCH-V83-RED_3c3b157bf8e5404fb6ab1e04915b5d9b.json`。初回helperは確認flagを越え時刻以前だけから探しており、保存frame間の越えでは発火しなかった。回帰テストを追加し、過去カメラは越え以前、確認は現在までの観測prefix、という分離で修正した。原作業logは [unit-crossing-red.log](unit-crossing-red.log) にbyte保存。初回builderの旧script ID不一致も修正済み。

実機検証は未実施。FPS2倍/画質1.2/二足移動への差し替えは別の回答待ち項目で、この版には含めない。元Charter承認HOLD、Native認証、100試合校正、元の機能残件を解決済みとはしない。
