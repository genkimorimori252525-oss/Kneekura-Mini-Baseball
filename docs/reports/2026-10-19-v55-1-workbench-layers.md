# v55.1 調整室のバット・ボールの描画漏れ

人間から「調整室でバットとボールが見えない」と指摘された。通常試合の物理やカメラの問題ではなく、調整室の合成漏れだった。

## 根因と修正

通常HTMLは `#field`、`#bat-overlay`、`#ball-overlay` をDOM順に重ねる。各backingは1200×864で、共通の論理600×432を描画している。調整室の `copyCanvas()` は `#field` しかコピーしておらず、実際のPNGバットと物理球を描いた透明レイヤーが欠けていた。通常と同じ順・同じ大きさ・source-overで3枚を合成する。

元の検査はCore／バット軌道とobserver診断値を照合したが、最終比較画像の全レイヤーを照合していなかった。この検査の不足をピクセル単位の比較で補う。任意の強調マーカーや架空の球を足して修正を代用しない。所持球非表示など、通常rendererの既存制御を継承する。

同じ経路で見つかった任意の打者視線ガイドの倍率も修正。ガイドのみ論理座標からbackingへ2倍で描画し、打者視点に限定した。ガイドを無効にすれば通常の3層合成と全ピクセルが一致することを検査する。

変更: `camera-workbench-v55.js`、`camera-workbench-v55.html`、`build-v55.mjs` と専用pixel checker。版は調整室v55.1。既存outputs/v55も修正版へ更新し、v55_1という明示名を追加する。公開済みv55配布を改変しない。通常v55のHTML本体、camera helper、Core113入力、物理・実測バット・AI・裁定・メーカー・JSON schemaは維持する。

## 検証

- BUILD9622b51b PASS、0.186秒。通常HTMLのSHAは `02644793d8c6e41b66d5330fe37cc0ce8d2fa7756ad6bc139b045fbef38d3b17` のまま。
- RED549100a9 FAIL（意図した旧版再現）、41.250秒。旧調整室ad40f783の120 side-samples中96件不一致、76件はfield-only画像と一致。左右の実バット・投球／打球layerにalphaがあることも確認し、コピー漏れを再現。
- GREENe08325e2 PASS、50.422秒。PC1200/390px・5視点・左右swing／投球／打球／所持・任意guideを含む120枚で、3層合成のRGBA全pixel一致、欠落0。実球とバットのalphaを確認し、所持球alpha0。12球のCore／bat hashは操作前後・旧新版で一致。例外／外部通信0。
- 初回GREENfa85a4cdは半透明境界のRGB±1でFAIL。Canvas readbackによるGPU/CPU backend切替を分離し、`--disable-accelerated-2d-canvas`で同一software backendに固定して厳密比較した。許容差へ緩めていない。製品Sourceを変えず最終PASS。初回reportも保全。通常backendでの数値丸め差と、旧版の層欠落を混同しない。
- PACKAGEc8adb946 PASS、0.360秒。新旧alias一致、通常HTMLと公開済みv55全ファイルのSHA不変、Core113入力のraw bytes、新driver/template hash、RED/GREEN artifact SHAを照合。

[全receipt](../ai-continuity/verification-receipts/)の `MB-20261019-V55-LAYERS-*`、[GREEN画像検査](../verification/releases/v55.1/green/layers-check.json)、[復元後の画面](../verification/releases/v55.1/visible-bat-ball.png)、[配布説明](../demos/releases/v55.1/README.md)を参照。

修正版SHA `838dc1f05b9ec4c8c013d76c7e06bb769e177884d08c8563d7564ae735493d10`。旧RED／初回GREEN原FAILとmachine receiptを保持する。Coreとカメラを変更しない今回の修正で、過去368テストや9回試合を新規実施したとは扱わない。以前の全FAIL/UNKNOWN/Charter HOLDと元全計画を保持する。
