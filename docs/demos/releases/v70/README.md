# 選手メーカー v70：打者視点で打球比較

- [選手メーカー](maker.html)
- [通常試合v68](../v68/game.html) / [カメラ調整室v68](../v68/camera-workbench.html)
- [変更・検証・限界](../../../reports/2026-10-19-v70-batter-comparison.md)
- [配布SHA256](SHA256.json)

「弾道ごとの打球比較へ」から、選手・打ち方・投球を選び「同じ球で4段階を計算」を押す。打者視点では「強調する弾道」の1〜4を切り替えて、同じ投球開始からの時刻のバットと球を確認できる。横／上の比較図と時間を共有し、切替時に投球を計算し直さない。

打者画面上で右ボタンを押しながらドラッグすると視線の向きを変えられる。角度の入力欄でも調整でき、リセットすると通常の打者カメラへ戻る。拡大と角度変更は表示だけに作用し、能力・投球・接触・飛翔・保存ロスターを変更しない。

通常試合v68のフィールド・バット・球の描画と打者カメラを再利用する。比較は打席からの研究用観測で、守備・走塁・フェンス・公式の安打／本塁打裁定は実行しない。球を持った状態では従来どおり非表示。空振りや見送りもそのまま表示する。

```text
node tools/browser-bridge/build-maker.mjs ../../outputs/にーくら野球メーカー_v70_打者視点比較版.html --executable-traits --measured-library --ball-comparison --batter-comparison --roster=docs/demos/live-game-roster-v62.json --catalog=docs/demos/live-game-roster-catalog-v62.json
```

通常試合・調整室・Native Core・初期20選手はv68を維持する。元の全計画・未達・全FAIL／UNKNOWN／Charter HOLDは継続する。
