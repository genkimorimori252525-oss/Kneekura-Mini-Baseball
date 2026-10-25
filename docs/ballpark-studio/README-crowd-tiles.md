# 満員の群衆と光るペンライト

2026-10-24 / MB-20261024-BALLPARK-CROWD-TILES。

現在の `outputs/球場設計室_v3_局所密度版.html` を再読み込みする。観客だけを作り直した。スタンドの1,920区画へ共有の群衆模様を隙間なく敷く。個別観客のworld位置・actor・描画ループは使わない。通路/手すり/屋根は既存の配置と深度で描く。

プレビュー下の「観客席」で満員/無観客を選ぶ。無観客では群衆とLEDを外して元の赤青座席色に戻り、観客アニメーションを停止する。切替は取消/やり直し・JSON・ブラウザ保存/再読込に対応。optionalなarchitecture.crowd.attendanceでfull/emptyを保存する。旧JSONの欠落時はfullで、勝手に追記しない。setCrowdPlayback({visible:false})は従来どおり一時非表示で、保存する試合状態の指定とは分離する。ロゴを含む他設定は変更しない。

「観客の見え方」のLED密度は、満員の群衆の中で光る部分の量を変える。低くしても観客背景は消えない。塊の描き込み・模様の大きさ・LED明るさ・LED光り方を調整可能。初期値はLED密度75%/簡素/模様100%/明るさ100%/光り方70%。以前保存した値は保持し、未設定の光り方は70%で表示する。ロゴを含む既存設定を勝手にresetしない。

赤青の発光島と明るい光芯は、複数の短いLEDが集まった表現。1本の棒を人より長く伸ばす線は描かない。実寸参照値0.07mは維持し、タイルを個別のペンの測定図として使わない。遠景の群衆は塊の模様として見る。

共通の16×12のatlasを3枚用意し、区画ごとに位相/左右反転を変えて敷く。動作は2コマ×2周→3コマ×1周。安打等では速く切替え、その後通常へ戻る。停止・背景停止・reduced-motion・最大3枚のscene画像再利用を維持。

## 開発入口

- `crowd-tiles.mjs`: 不透明の群衆色とLED発光を持つ3コマatlas。模様生成は最初の固定サイズだけ。runtimeはタイルsampleであり、観客1人ごとの3D配置ではない。
- `stadium-mesh.mjs`: 既存stand quadのUVをperspective補間しatlasをsample。近面clipでもUVを補間。全quadを覆うので密度と占有率は独立。
- `renderer-patch.mjs`: `paintWorldCell(...,glow=0)` で発光をdepth mapへ運ぶ。近い屋根等に置換されたcellは発光しない。opaqueのcell描画後に可視LEDへnative glowを適用する。Core/元HTMLを直接変えない。
- `crowd.mjs`: 既存のread-only clock/7コマ/イベントID/停止を再利用。旧crowdSymbol/includeCrowdは互換参照で、現行スタンド描画には呼ばない。
- `BallparkStudio.inspect().architectureRender.crowd`: mode=tiled_clusters、groups=1920、coverage=1、individualWorldObjects=0。candidateLedCellsは遮蔽前、visibleLedCellsはnative depthを通過した発光cell数。

JSONのarchitecture.crowd.glowはoptional。旧crowd.densityの意味を、個別観客の割合からLED量へ変更したのは本人の最新指示による。互換の値は保持し、旧JSONを自動追記しない。新しい初期JSONはexamples/russian-dome-v3-crowd-tiles.json。

ロゴの素材/細分/明るさ/発光設定は触っていない。観客OFF時の旧HTMLとの全画素一致と、観客ON時のロゴ領域の画素一致を検証した。通常試合の新球場/自動反応はまだ未接続。scene cacheは静止した設計室専用で、試合の球や選手を固定する目的では使わない。
