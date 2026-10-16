# Pixel Player System v1 — first-player presentation slice
状態: **ARCHIVED / ON HOLD — 2026-10-01 ユーザー判断で保留**

現行方針は、今日のPixel Player変更前に採用されたPNG原画方式の継続。
この文書は歴史資料であり、現在の採用計画・実装待ちタスクではない。
以下に残る承認・採用・実装予定などの記述は保留前の記録。現在Statusを優先する。
再開にはユーザーからの明示的な指示が必要。
現行方針: `docs/presentation/2026-10-01-png-player-continuation.md`。


2026-10-01 / branch `jolly/core-foundation-plan-2026-09-17`

承認計画: `docs/superpowers/plans/2026-10-01-pixel-player-system.md`

## 実装の範囲

Task 1の「1人・1方向・idle 1frame」から始め、1人のPresentation vertical sliceまで実装した。

- 原本: `assets/pixel-players/fixtures/b1-prototype.pixel.json`、`assets/pixel-players/players/b1-test.pixel.json`。
- palette / named parts / frame / direction / handedness / root / body bounds / bat metadataを持つJSON row maps。
- B1の小顔・顔なし・厚い体格をセルから新規authoring。歴史的な採用画像をpixelation/samplingしていない。
- 打撃4コマR/L、投球4コマR/L、必要なFRONT/BACK、走行最小2コマ、fielding/idle、バント各pose。
- 近景24×24 canvasの人物本体は約10×16 cells。遠景用6×10 canvasは別authoring。全action×8方向の量産はしない。
- body/equipment partsを独立して編集できる。unsafeなbat / glove / throw / text / logo等のmirrorを禁止。
- deterministic RGBA compiler、PNG atlas/metadata/export。PNGは原本ではない。
- projected anchor / depth / apparent sizeを受ける離散LOD。full spriteは1×または2×の整数scale。nearest-neighborのみ。
- 一般の方向はcanonical facingとcamera vectorで選択。compact LODはFRONT/BACKの粗い方向coverageへ落とす。
- depthの大きい順に描画し、同depthはplayerIdで決定論的に並べる。
- nameは黒72% opacity枠。距離で離散文字scaleを選択し、指定されたzone矩形へ重なる場合は枠を横へ退避、画面に収まらなければ非表示。
- `BatterPresentationState.bat`はread-onlyの投影観測として保持する。可視セルには出さず、選手素材内のbatだけを表示。
- exact BatBallContactではevent pointを投影し、実際のbatパーツのセルからの距離が1 logical cell以内のcontact-compatible frameを選ぶ。合う素材がなければエラー。Coreへ補正を返さない。
- pitch motion markersのread-only structural consumer。frame 1はmotionStartから55ms固定、frames 2–4は正史markersを観測。releaseをcadenceへ丸めない。
- 既存Mini timelineを消費するreplay adapter。live contact exact tickで既存のinstant overhead cutを保持。

原本・生成物・runtimeの流れ:

`JSON named parts -> validate -> deterministic compile -> runtime.json / atlas.png / atlas.json -> observer renderer`

runtimeでsourceを制作・AI生成しない。authoring/build時だけcompilerを使う。

## camera coverage matrix

既存`MiniCameraMode`のBATTER_POV / FIELD_OVERHEADは変更しない。Pixel review cameraは追加の固定校正fixture。制作中の球場camera networkを置き換えない。

| Pixel review camera | batter | pitcher | fielders / runners | required coverage |
|---|---|---|---|---|
| BATTER_POV | full body hidden; first-person hands/bat optional（このsliceは省略） | depth由来LOD1、4-frame compact pitching | LOD0/1 | pitcher FRONT; own bodyなし |
| CATCHER_POV（捕手後方） | full body hidden（既存近接POV制約） | depth由来LOD1 | LOD0/1 | pitcher FRONT; catcher bodyなし |
| PITCHER_POV（このreviewではmoundからhomeを見る） | LOD2、R FRONT_LEFT / L FRONT_RIGHT | camera clippingに従う | depth由来 | right/left explicit stance、4 bat frames |
| FIELD_OVERHEAD | 主にLOD0 identity mark | 主にLOD0 | 主にLOD0/1 | close bodyを無理に縮小しない |

カメラの語義を既存正式仕様へ接続する際は、捕手後方とmound視点を明示的に区別する。R/Lを理由にworldをmirrorしない。

## authoring commands

```sh
npm install
npm run verify
npm run pixel:compile
npm run pixel:preview
node scripts/pixel-player.mjs validate assets/pixel-players/players/b1-test.pixel.json
node scripts/pixel-player.mjs new assets/pixel-players/fixtures/b1-prototype.pixel.json /tmp/new-player.json new-player
node scripts/pixel-player.mjs edit assets/pixel-players/fixtures/b1-prototype.pixel.json idle-front-R leg-right 13 16 U /tmp/edited-player.json
node scripts/pixel-player.mjs compare assets/pixel-players/fixtures/b1-prototype.pixel.json /tmp/edited-player.json idle-front-R leg-right
node scripts/pixel-player.mjs clone-part assets/pixel-players/players/b1-test.pixel.json idle-FRONT-R-0 torso idle-BACK-R-0 /tmp/shared-player.json
```

`edit`はtarget frame/partのrows以外が変わらないことをvalidateする。`clone-part`はsafe shared partだけを複製する。利き手依存の道具は複製/mirrorしない。

生成物は`.pixel-build/`。PNG、atlas metadata、runtime raster、self-contained HTMLを再現できる。生成画像だけを手修正しない。

## verification / limitations

既存baselineは35 tests。追加testsはcompiler、validation、safe mirror、targeted edit、LOD、depth order、directions、四コマ、contact、pitch release、projection、replay、CLIを検証する。

物理結果不変の実行テストは、このbranchに実装済みの`simulateContactVerticalSlice`を使う。描画前後のsnapshots/events/contact/initialBallが一致し、exact contact sampleとcutも保たれる。

**全試合のMatch結果・outs/runs/decisionsに対する最終acceptanceは未実施。** このbranchにはそのfull Match runner、PitchMotionTimelineのCore実装、Canonical球場builderのruntimeがまだない。Presentationのためにそれらを発明していない。

`buildPixelPlayerReplay`へ渡すactor observations / stance facing / batting phases / pitch timelineは、productionではCore/既存adapterのread-only factsからjoinする。review scriptの座標・phase・打席参照線を正史へ逆輸入しない。defender/runner位置は`CanonicalWorldSnapshot`がcontext位置に優先する。

HTMLは短い描画fixtureで、以前の一球速報形式試合v16を置換しない。球場形状・ボールsurface・配球履歴の本番実装をこの素材previewで完了扱いにしない。first-person visible batはこのsliceにはまだない。Over/Under/Side等の全採用素材も、今後のstructured authoringへ順に移行する。

採用済み画像は参考・履歴として保存されたまま。この新規test player自体の最終見た目承認は、検証HTMLを見て判断する。

## implementation decisions

- JSON named-part row mapsを採用。TS sourceは実行評価が必要、bare row-mapはmetadataが不足するため。
- Core timingが未実装なので、承認計画と同じmarker namesのread-only structural inputだけを用意。
- 真正Pixel Artへの移行なので、以前の画像からmaskを抽出しない。
- compact pitchingも専用authoringにした。static silhouetteでは遠い投手の動きが失われるため。
- v1の接触許容距離は1 logical cell。fail-closedで、不整合があればasset/camera mappingの修正が必要。
- LOD thresholdはapparent body heightの4 / 12 / 32 cells（初期校正）。Full pixelsを連続resizeしない。将来cameraごとにreadabilityの再校正は可能。

## remaining production acceptance

1. 実Core timingとactor metadataへのjoin（Core実装が入った後）。
2. full Match / production replayのrenderer on/off不変性。
3. production canonical ballparkの全camera・各stanceについてbox/zone/name/contact整合。
4. first-person bat-only authored coverage、投球フォームのUnder/Side移行、必要方向の追加。
5. 使用するruntime asset versionとrenderer buildをreplay manifestへ固定。

## Review follow-up

- R/Lのcanonical idle -> swing -> exact contactをreplay経由で検証し、mound側のidle stance coverageを追加。
- contact validationはpart原本だけでなく、composite後のvisible bat ownership maskを使う。後のopaque layerに隠れたbat cellsを数えない。
- Minor deferred: 汎用authoring HTMLは非正方形canvasを96×96へ表示するため縦横比が変わる。PNG/runtime rasterは原寸で正しい。現在の通常24×24 player確認HTMLには影響しないが、compact単体等のauthoring previewは未修正。
