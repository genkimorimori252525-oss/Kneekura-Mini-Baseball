# 球場設計室 v2 — 開閉式ドーム

履歴資料。最新の描画・設定・検証は [README-v3.md](README-v3.md)。v2途中のhash/試験件数を現在の成果物の証拠に流用しない。v2最終保存物はgold-image-blend、SHA `766a3495443c7480c33a38f7d2c51e55f49278fafa24fdbc306740efcf4173a5`。本人がロゴ単独の精密overlayを指摘したため、v3で素材合成＋共通光点へ差し替えた。

2026-10-24 JST / `MB-20261024-BALLPARK-STUDIO-2`。

成果物は `outputs/球場設計室_v2_開閉式ドーム.html`。初期状態に本人指定の赤・青・金、120,000人想定の5層観客席、左右スライド式の屋根、右翼105m・中堅128mを設定した。生成画像を背景として貼る方式ではなく、球場の立体座標を既存の投影・格子・深度buffer・dotで描画する。

## 操作

- 「観客席と屋根」で定員・3色・屋根の開度0〜100%を編集する。定員は設計値であり12万体のactorを生成しない。初期値では17,280の光点が観客群を表す。
- 「球場全景」は建築全体を見るカメラ。従来の俯瞰・捕手・投手・打者・外野の5視点も維持している。右ドラッグで回転、ホイール/スライダーで拡大。
- 「手前の屋根を省略」は高いカメラから内部を確認する断面表示。屋根の開度自体は変えない。完全に閉じた屋根の外観は、開度0%にして省略のチェックを外す。
- 「外野の距離と壁」や図の点で外周を編集する。右翼105m・中堅128mは本人指定。**左翼105mとフェンス高1.3mは暫定初期値**。左中間/右中間と追加点はこれらをつなぐ初期曲線。
- 「赤・青・金のドームに戻す」で指定案を再適用。「現行球場に戻す」は建築なしの元の円形球場へ戻す。いずれも取り消せる。
- JSON保存・読込、ブラウザ保存、最大80操作の取消/やり直し、人間/AIモードはv1と同じ。v2は別の保存領域 `kneekura_ballpark_studio_v2` を使い、v1を上書きしない。
- 読込用の初期設定は `outputs/球場構想_v1/球場設計_ドーム_v2.json`、開発用コピーは `examples/russian-dome-v2.json`。

塁・投手板・本塁・打席・固定白線の配置は編集不可。観客席や屋根の設定を変えても内野を拡大・移動・回転させない。

## AI・開発

新形式は `kneekura_ballpark_design_v2`。geometryの項目に任意の `architecture` を追加する。建築データ自身も `version:1` を持つ。旧v1 JSONはそのまま読め、建築を勝手に追加しない。v1 schemaのまま新しい建築項目を送ると、日本語のschemaエラーとして拒否する。人間の編集は新schemaへ移る。

```js
const state = BallparkStudio.inspect();
const next = structuredClone(state.design);
next.architecture.roof.openingPercent = 50;
const result = BallparkStudio.setDesign(next);
// result.ok と、描画後の renderedRevision === revision を確認
BallparkStudio.inspect().architectureRender;
// capacity / tiers / roof / primitive counts / renderer / integration boundary
```

`setDesign()` は不正データを適用しない。UIの編集中エラーは入力を保持し、直前の有効なプレビューを表示する。表示の成否と入力検証は別々にinspectできる。

```powershell
node tools/ballpark-studio/cli.mjs dome my-dome.json
node tools/ballpark-studio/cli.mjs check my-dome.json
node --test tools/ballpark-studio/model.test.mjs tools/ballpark-studio/architecture.test.mjs
node tools/ballpark-studio/build.mjs unique-label
node tools/ballpark-studio/check-dome.mjs unique-label
node tools/ballpark-studio/check-browser.mjs unique-label
node tools/ballpark-studio/probe-roof-depth.mjs unique-label
```

`check-browser` は現在のv2で従来機能を回帰検査する。`check-dome` は建築/開閉/旧JSON/同じカメラでの外周cache更新等を検査する。`probe-roof-depth` は閉じた屋根で観客席等の光点が屋根越しに残らないことを独立したray/triangle交差計算で検査する。ブラウザ検査の環境パスはv1 READMEのとおり。

## 実装の位置

| ファイル | 責任 |
|---|---|
| `architecture.mjs` | 建築初期値と入力検証 |
| `model.mjs` | 外周と固定契約、v1互換、ドームpreset、境界cache key |
| `stadium-mesh.mjs` | 席・通路・壁・狼の意匠・トラス・可動屋根の世界座標と格子raster |
| `geometry-window.mjs` | コピーrendererへ共有query/建築描画を公開 |
| `renderer-patch.mjs` | 凍結コピーだけへの接続と完全逆変換証明 |
| `preview-bridge.js` | 既存world/カメラとの接続、表示上の断面設定 |
| `studio.mjs/html/css` | 編集UI・履歴・保存・AI inspect |
| `build.mjs` | SHA保護、元Core/元HTML不変、別名v2出力 |

屋根も既存 `paintWorldCell` の深度と `flushWorld` のdotを通るため、手前の屋根は後ろの席や選手を遮る。三角形の走査は `grid.range()` の整数格子indexで行い、小数stepの加算誤差で端の行を落とさない。観客/建築は有効geometry単位でキャッシュする。元park cacheは建築の有無と外周値のkeyを区別する。色や開度だけの変更では外周keyを変えない。操作のない間の再描画ループは追加しない。

**設計室だけの実装であり、通常試合の衝突・守備経路・HR裁定は未接続。** 屋根の球との衝突やグラウンドルール、低い壁でのHRキャッチ成功条件も追加していない。`DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED` を維持する。12万人という指定は席の配置・避難動線等の建築認可を保証するものではない。

元V114と設計室v1は保存。復旧は旧ファイルを開く。規則・共通の保存/API説明・元の検証経緯はv1 READMEとCURRENT、今回の証拠はCURRENT-v2を参照。
