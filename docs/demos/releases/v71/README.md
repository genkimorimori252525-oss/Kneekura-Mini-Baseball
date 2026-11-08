# 選手メーカーv71：バット軌道の角度調整

[メーカーHTML](maker.html) / [実装と検証](../../../reports/2026-10-19-v71-bat-preview-orbit.md) / [SHA256](SHA256.json)

黒いバット画面では、右ボタンを押しながらドラッグするとバットを回り込んで見られる。左ドラッグは表示移動、ホイールは拡大。「角度と全体表示を戻す」で初期状態へ戻る。白い3方向の弾道比較図も各図を右ドラッグで回転でき、「3つの図の向きを戻す」で戻せる。

角度変更は表示専用・セッション内の操作。軌道、能力、時刻、物理、保存JSONは変わらない。元の打ち方と弾道1〜4には、各図で共通の投影を使う。打者視点の右ドラッグもv70から維持する。通常試合と調整室はv68のまま。

```text
node tools/browser-bridge/build-maker.mjs ../../outputs/にーくら野球メーカー_v71_バット軌道の角度調整版.html --executable-traits --measured-library --ball-comparison --batter-comparison --bat-orbit --roster=docs/demos/live-game-roster-v62.json --catalog=docs/demos/live-game-roster-catalog-v62.json
```
