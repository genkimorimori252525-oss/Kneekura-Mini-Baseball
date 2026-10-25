# 球場設計室 v3 継続入口

最新追加は [CURRENT-crowd.md](CURRENT-crowd.md)。以下のsurface-mask/gold-lines hashは履歴であり、現在のHTML hashには使わない。

2026-10-24 JST / `MB-20261024-BALLPARK-STUDIO-3` / IMPLEMENTED_AND_VERIFIED（設計室のみ、本人の外観最終承認は未確認）。

本人の最新指示に従い、ロゴ単独の精密pixel overlayを撤去し、芝生＋画像の素材合成と局所光点密度へ差し替える。PLAN-v3とtools/ballpark-studio/AGENTSが根拠。v2は比較用に保存する。共有src/distとV115 CURRENTは他chatの担当で触らない。

保持する要件: 赤青金・12万人想定・可動屋根・右翼105m中堅128m・仮の左翼105m/壁1.3m、張出した内野席と固定内野/コーチ箱、最後の全体金色狼を画像加工したPNG。架空の手描き輪郭案は本人が拒否したため再使用しない。

現在の加工素材: assets/wolf-gold-cutout-v1.png、SHA `b9181b700e184697d1d8dc7397d0eda4aceb1a481a311778e8203d45d8d153f4`。プロンプト/出典はgold-wolf-asset.json。画像は生成加工であり元画像の画素完全同一切抜きではない。

v2の最終生成物（密度変更前）: `outputs/球場設計室_v2_開閉式ドーム.html`。gold-image-blend build/ChromeはPASS（`8a76ec4136fd473986019f7ccbd510a3` / `c34bf1d525954bf8a6c6fdd75300a34b`）。SHA `766a3495443c7480c33a38f7d2c51e55f49278fafa24fdbc306740efcf4173a5`。旧v2のPASSを、本人が要求した局所密度の完成証拠にしてはならない。

## 最終実装と証跡

最新追記 gold-lines: 本人の「白線を球場テーマより少し明るい金色」指定で、線だけを `#debe71`（テーマ金色＋白20%）へ変更。テーマ変更に連動しcache keyにも金色を追加。位置・太さ・光点・本塁/塁/投手板の色は維持。建築設定のない旧球場は元の白線。

現在のHTMLは45,796,751 bytes、SHA `916e9cad7e1cf782f0bf828207c1c552ebed41e73a57b75f7e883e04abc90d9d`。build PASS `178e9c7aabe34968aba93d0b845207e8`、6視点等Chrome回帰 PASS `f2d211f657264f14ae396ab452d56571`、色変更前後の画像検査 PASS `70064cbda91a4d7592a41d589f522f0a`（点の占有範囲と固定geometry同一、変化は白→金の色のみ、テーマcache往復一致）、17 SHA読戻し PASS `baa5d7faa3b841d0b8fa4fd6a123f302`。証跡は `evidence/build-gold-lines.json`、`dome-gold-lines/`、`gold-lines.json`、`source-pins-gold-lines.json`。変更前は `outputs/球場設計室_v3_局所密度版_金線変更前.html` に保存。以下のsurface-mask証跡/hashは変更前の履歴で、最新HTML hashではない。

本人の追加指定「最低限の領域」に合わせ、画像の可視alphaから距離場を生成し、輪郭近傍だけを細分化。初期値factor3・余白0.6m・移行0.8m。芝生と画像を先に素材合成し、両方を同じ円形光点で描く。外接矩形は走査上限だけで、領域そのものではない。設定/inspect/APIは人間とAIで共通。

- v3 HTML: `outputs/球場設計室_v3_局所密度版.html`、45,796,430 bytes、SHA `b87062c7dc5d2a9e0691bee81138125603390b4d70e3a3057f3bb908c8d22406`。
- unit22/22 PASS、receipt `39c4c0878fb749d48cf496697b051ed9`。
- build surface-mask PASS `bd041fe13cf641d685a24b4a33146674`。Core SHA `3d0ef3a2477816a3157e59f9a8235e1459913fa35f74f791541c8cee8e885a37` 不変、renderer逆変換と構文確認。
- Chromeドーム検査 PASS `5859f43e7cca4da299ebd061fd7a1b91`。6視点・1280/390/320幅、素材/密度/cache、屋根閉鎖画像一致、内野固定・コーチ箱余白、保存・履歴。画像 `evidence/dome-surface-mask/` を目視済み。
- Chrome通常編集回帰 PASS `c00b5e2f4d2c4be68300b70d017c936a`。追加/削除/drag、無効入力、取消、JSON/ブラウザ保存/再読込、旧renderer画素一致、idle再描画なし。`evidence/browser-surface-mask/report.json`。
- 独立ray-triangle屋根遮蔽 PASS `ead1377286ff40a9a2930b527e355928`。検査した赤色席/レール光点1160、漏れ0。`evidence/roof-depth-surface-mask.json`。
- 最終13入力＋元V114＋v1＋v2＋成果物の17 SHA読戻し PASS `885eb4fdd4de4eac8d148b1d22fb7a40`。`evidence/source-pins-surface-mask.json`。
- 現行JSON例 `examples/russian-dome-v3.json`、持出し用 `outputs/球場構想_v1/球場設計_ドーム_v3.json`。旧例は履歴として保持。

receiptは `docs/ai-continuity/verification-receipts/MB-20261024-BALLPARK-STUDIO-3_<末尾>.json`。command/log SHAとtask-IDへ結び付ける。

## 原FAIL・不採用の保持

- surface-first Chrome FAIL `a9700b56844b4cc7bb0529c2ce68828c`。粗格子の屋根の端から細分地面の光点が漏れ画像比較不一致。細分点を遅延して深度mask、建築cellのdevice pixel clear、cache queue/report保存で修正。原 `evidence/dome-surface-first/report.json` を保持。
- surface-depth build/Chrome PASS（`458c0890fa524b419b1f44f56b0698c8` / `efdcac24b99f4560ad2817fecedb6388`）だが、広い矩形領域の見た目は本人が不採用。PASSをデザイン承認として扱わない。
- 最小mask初回unit FAIL `edc297dc28cc453abbf30bf90a9e10d6`。mock projectionが粗く0.8m移行のalpha<0.4をsampleしなかった。mockを4px/mへ修正し22件PASS。productionの移行幅はこの理由では変えていない。
- より古いFAILと不採用理由はCURRENT/CURRENT-v2/原receiptに保持。拒否された手描き案・未採用白黒素材・途中hashを現行扱いしない。

## 境界・次手順・復旧

通常試合の非対称壁/屋根衝突・守備/HR裁定・HRキャッチは未接続（`DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED`）。端末FPS向上は未計測。遠景の狼の細部は拡大時ほど判読できない。本人の外観最終承認は未確認。

復旧は保存した元V114/v1/v2を開く。共有src/dist/メーカー/V115 CURRENTは他chatの担当。CCG checkpoint commandは共通CURRENTのactive taskを置換するため、同時作業中はこの専用CURRENTをmilestone checkpointとし固有receiptを記録。原承認条件/FAILは保持する。

次は本人の表示確認と局所調整。README-v3/RENDERING-POLICY/専用AGENTSを開発入口とする。GitHub判断記録はgithub-decision-v3.md、投稿先は [PR380判断記録](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6375221684)。ソースのcommit/push/merge/deployは行っていない。
