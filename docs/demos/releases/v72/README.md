# 選手メーカーv72：弾道と大画面の連動

[メーカーHTML](maker.html) / [実装と検証](../../../reports/2026-10-19-v72-player-swing-preview.md) / [SHA256](SHA256.json)

「バット軌道」タブで、調整する選手・打ち方・弾道1〜4を選ぶ。各弾道の「振り上げ方（度）」を変更すると、大きな黒い画面と白い3方向の図へすぐ反映する。プラスは上向き、マイナスは下向き。図と大画面は同じ時刻で再生・停止・5ms送りできる。

黒い画面は右ドラッグで角度、左ドラッグで表示移動、ホイールで拡大。白い3図の右ドラッグと打者目線の右ドラッグも維持する。「試合用能力JSONを保存」で選手の打ち方・弾道を保存し、通常試合で読み込む。設定を変えた後の実打球は、下の同条件比較を再実行する。

元の参考記録の細かな研究は「元の記録と接触の研究」へ折り畳んだ。軌道図は元測定の長さ・速さを基準にし、通常試合では本人の用具・体格・速さを反映する。通常試合・調整室はv68を使う。

```text
node tools/browser-bridge/build-maker.mjs ../../outputs/にーくら野球メーカー_v72_弾道と大画面の連動版.html --executable-traits --measured-library --ball-comparison --batter-comparison --bat-orbit --player-swing-preview --roster=docs/demos/live-game-roster-v62.json --catalog=docs/demos/live-game-roster-catalog-v62.json
```
