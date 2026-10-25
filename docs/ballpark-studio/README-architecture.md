最新の承認画像に基づく中央スコアボードとロゴの軽い遠近は [README-scoreboard.md](README-scoreboard.md)、現在の検証は [CURRENT-scoreboard.md](CURRENT-scoreboard.md)。旧の深度減光は撤回済み。

最新の作業指針（自己改善可）は [STADIUM-AUTHORING.md](STADIUM-AUTHORING.md)、壁面ロゴの遠近調整と現行証跡は [CURRENT-logo-lod.md](CURRENT-logo-lod.md)。従来の固定密度の記述は履歴として読む。

# 球場の立体構造と壁面素材

2026-10-24 / MB-20261024-BALLPARK-ARCHITECTURE。成果物は従来と同じ `outputs/球場設計室_v3_局所密度版.html`。最新の証跡/復旧先は [CURRENT-architecture.md](CURRENT-architecture.md)。

視点の「外観」「スタンドから」を追加。右ドラッグで立体を回転できる。「手前の屋根を省略」は内部を見る断面表示で、外観へ切り替えると解除する。屋根開閉、満員/無観客、芝生の設定は従来どおり利用する。

「建築の細部」で壁面の狼、外装装飾、狼パネル周囲の密度2〜8倍を編集する。芝生の密度とは独立。JSONのoptionalな `architecture.details={factor,logos,ornaments}` に保存する。旧JSONは欠落時に6倍/表示を採用し、自動追記しない。新しい初期例は [russian-dome-v3-architecture.json](examples/russian-dome-v3-architecture.json)。

## 世界座標の構造

`stadium-mesh.mjs` が同じ世界座標に次を構築する。外観画像を背景へ貼る方式ではない。

- 元の1,920群衆区画を維持した5層席と、各層の前壁・歩廊・金色の縁。
- 全周を閉じる丸い外装、赤青の壁面、金のV形装飾、ガラス色の基壇、入口階段。
- 曲面を分割した銀の固定屋根、青い縁、金のトラスとレール、左右の可動屋根。
- 客席センターと外側入口の狼パネル。

外形は席の最大範囲から決める。可動屋根の幅は、前後端での外形幅の小さい方から算出し、全開でも角が外へはみ出さない。元の内野/塁/白線/PNG/フェンス寸法は変更しない。定員12万人は設計値で、避難/通路/座席数の建築認可を保証しない。

## 素材から局所光点への共通経路

1. `ground-logo.mjs:sampleLogoUV()` が承認済み金色狼PNGを読み取り専用でsampleする。芝生の数式とPNG画素はそのまま保持。
2. 壁面のUVから画像と下地色を `blendMaterial()` で合成する。狼/周囲の紺色パネルを同じ細分格子にする。芝生は従来のalpha輪郭距離マスクを維持。壁面は看板自体の範囲に限定する。
3. 外装のV形帯と細かな格子模様も面のUVから素材色として求め、外装面だけ2倍の格子で描く。既存の太い構造物/手すりは元の光点格子。
4. 精密点の位置を投影三角形の24px区画索引で調べ、手前の建築面に隠れる点を除く。その後、元のworld depth/選手などの遮蔽と、同じ円形dot primitiveを通す。線やPNGを画面へ直接重ねない。
5. 同じ精密格子の重複点は深度で1点にまとめる。LEDの発光統計と建築素材の発光を混同しない。通常の観客再生は最大3枚の静止scene cacheを使い続ける。

別の素材を増やす際は、mesh faceの `material`、UVによる色のsample、局所密度、共有深度の順で追加する。近景全体やCanvas全体の密度を一括で引き上げない。`BallparkStudio.inspect().architectureRender.detail` でfineCells/emblemCells/fineGeometryOccluded/visibleFineCellsを確認できる。

## 検証の扱い

建築全体の形を変更したため、旧版との球場全画素一致は成立しない。旧証跡は保持し、旧check-crowd-tilesの全景比較を「建築は変わる、承認済み芝生領域は一致」に明示変更。check-attendanceは同じrendererの元座席material経路と永続無観客の画素一致を比較する。変更理由はPLANとCURRENTに残す。

`check-architecture.mjs <label>` は8視点、回転、開閉、独立ray/triangle深度、壁面素材/密度の切替、芝生の旧版画素一致、入場状態、履歴/保存/旧JSON、390/320幅を検証する。従来のdome/crowd/browser/visual-tuning検証も維持。実Chromeの編集後3scene生成時間は測るが、通常試合のFPSや全端末の性能保証へ読み替えない。

境界は **DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED**。通常試合の壁/屋根衝突・守備・HR判定・イベント自動反応への導入は別工程。元V114/Coreを凍結した専用設計室である。
