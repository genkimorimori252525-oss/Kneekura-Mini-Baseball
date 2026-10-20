# v73 スイング分類と全体角度

[選手メーカー](maker.html) / [通常試合](game.html) / [カメラ調整室](camera-workbench.html) / [実装・検証](../../../reports/2026-10-19-v73-whole-arc-trajectory.md) / [SHA256](SHA256.json)

メーカーの「バット軌道」で、選手と元の打ち方を選ぶ。「元の打ち方の種類」でダウン・水平／レベル・アッパー等から絞り込める。元の角度・匿名選手ID・試行番号も表示する。

「軌道の変え方」で「弧全体を傾ける」を選ぶ。弾道1〜4の初期値は下表のとおり。元フォームの曲線と振る速さを保ち、弧全体の傾きを変える。角度を編集すると分類名も変わる。

| 弾道 | 初期の分類 | 当たる瞬間の芯の進行角 |
|---|---|---:|
| 1 | ダウン | −10° |
| 2 | 水平・レベル | 0° |
| 3 | アッパー | ＋10° |
| 4 | 強いアッパー | ＋20° |

「試合用能力JSONを保存」で保存し、通常試合v73の能力JSON読込から反映する。打球は同じ条件の比較を再実行して確認できる。バット角度と打球の飛び出す角度は異なる。弾道1でも必ずゴロになる指定ではない。

旧JSONは旧方式のまま読み込むため、新方式を使いたい選手は方式を選び直して保存する。初期20選手は一括変更しない。旧再現セッションはCoreが異なるため使えないが、選手の設定JSONは読み込める。

```text
node tools/browser-bridge/build-native.mjs
node tools/browser-bridge/build-v73.mjs
node tools/browser-bridge/build-maker.mjs ../../outputs/にーくら野球メーカー_v73_スイング分類と全体角度版.html --executable-traits --measured-library --ball-comparison --batter-comparison --bat-orbit --player-swing-preview --whole-arc --match-renderer=../../outputs/ばせぼーるlv73_TBD_vs_LAD_全体スイング角度版.html --roster=docs/demos/live-game-roster-v62.json --catalog=docs/demos/live-game-roster-catalog-v62.json
```
