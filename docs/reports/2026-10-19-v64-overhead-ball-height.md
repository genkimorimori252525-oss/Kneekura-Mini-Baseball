# v64 俯瞰専用の高さによる球サイズ

## 変更

俯瞰の実光学サイズは高さで変わっていたが、小さいSource球を1.25pxの可視白点へ補う処理によって、大半のゴロとフライが同じ表示サイズになっていた。

新しい表示専用パラメータ `ballDisplay.overheadHeightEmphasis` を通常試合と調整室へ追加した。初期値1、範囲1〜8。既存の俯瞰全体の倍率とは独立する。初期値1では旧サイズ演算をそのまま使い、旧描画のpixelsを維持する。ユーザーが1.5を指定すると、地面球の大きさは維持し、現在の観測高さに応じて最大1.5倍へ拡大する。

表示係数は次式で、球中心y=.0366m以下では1、20m以上では指定倍率となる。

```text
高さの割合 = clamp((現在の球中心y − .0366) / (20 − .0366), 0, 1)
表示係数 = 1 + (指定倍率 − 1) × 高さの割合
描画直径 = 従来の描画直径 × 表示係数
```

20mは表示用の作者設定であり、現実の光学や野球の判定基準ではない。「高い球を最大1.5倍」と「既存の遠近差だけを1.5倍」のどちらかを任意の質問として提示し、未回答時の実装仮定を前者と明示した。未回答を人間の承認として記録しない。

球の中心位置、光学投影、物理半径、速度、回転・向き、衝突、捕球、投球・打球・送球、バット、裁定、AI、能力値は変更しない。未来の打球やフライ判定ではなく、いま描く球の観測高さだけを使う。他の全視点は表示係数1。保持球は従来どおり早期returnして描かない。4px格子と既存の球材質、名前の前への描画を継承する。

旧設定JSON／同一Coreの再現sessionは新項目を1で補完し、旧表示を維持する。新項目は保存・再読できる。球の初期設定へ戻す操作では全体倍率と高さ倍率をともに1へ戻す。

## 検証

- BUILD `eb2f7094` PASS.171秒。通常／調整室と114入力のraw SHAを照合。Native Coreはv62／v63と同じ `865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00`。
- CADENCE `6093109f` PASS7.984秒。投球22ms／他55ms、保持球の高速更新なし、ループ再生の一致を維持。
- 実v63の同一6球を基準として、全5視点×3場面のfield／bat／ball RGBAと従来の球診断を初期値1で厳密比較しPASS。世界Sourceと実バットも厳密一致。
- 設定1／1.5／8で実ゴロy=.0366のサイズ・pixelsを保持し、実高球y約16.27mの描画直径だけを拡大。投影サイズ・現在位置・field／bat pixelsは維持。他の視点への影響なし、全視点の保持球非表示、19の高さ・境界probe、通常UI／調整室UI、旧新JSON／session、範囲外の原子的拒否をPC1200px／390pxで確認しPASS。

[ブラウザ記録](../verification/releases/v64/ball-height/ball-height-check.json)、[配布照合](../verification/releases/v64/release-check.json)。正式コマンドと原logは `docs/ai-continuity/verification-receipts/MB-20261019-V64-*`。

新たな9回完走やTypeScript型検査を行ったとは主張しない。今回はJSの描画係数と設定欄の変更で、既存のCore・打者視点v63・投手v62を維持する。

## ファイルと残件

新helper `live-ball-display-controls-v64.js`、調整室v64 driver／template、生成・検証・配布スクリプト、凍結HTMLと記録。既存のhelperや旧凍結HTMLは書き換えない。新しい能力値や依存、設定／lock／secret／DBは変更しない。

この拡大は高さを見分ける表示上の目印で、実物理・現実の遠近投影の変更ではない。元全計画・未達・原FAIL/UNKNOWN・Charter未承認HOLDと、ユーザーのAGENTS変更を保持する。main未マージ。

最終BROWSER `f23aefdd` PASS58.734秒。初回 `d7eb96ff` のPASS履歴も保持し、最終版ではUIを必ず1→1.5に変更して検証した。実高球y16.2708mでは係数1.406598、描画直径1.758248px。PACKAGE `e5c2db69` PASS1.390秒。通常SHA `0c1b76a49dd0b06b2472a5206d6ef14b69374017f6bf3ac61da9d4bddb2c420b`、調整室SHA `9485093d726aad5a9300af56452924146fba6d7276daa9b00f2c2d80feae4302`。

## GitHub保存

製品コミット `86f7151dbbe03e9716c570b93bac30a032bddaf1` を既存ブランチ／Draft PR380へ保存。STAGING `48781f7c` と追加記録の最終照合で46ファイルのGit blobと試験済みraw byteが一致、credential pattern0、非log whitespace PASS、AGENTS除外。PUBLICATION `69b3db62` PASS3.422秒でremote／PR head一致、Draft OPEN、公開raw12ファイルのbyte一致を確認。[公開証拠](../verification/releases/v64/publication.json)。後続コミットは記録のみで製品byteを変更せず、mainは未マージ。
