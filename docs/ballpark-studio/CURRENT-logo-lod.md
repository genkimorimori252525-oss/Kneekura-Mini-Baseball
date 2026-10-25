# 壁面ロゴ遠近 / 制作環境 checkpoint

2026-10-24 JST / MB-20261024-BALLPARK-LOGO-LOD / IMPLEMENTED_AND_VERIFIED（設計室）。前段は [CURRENT-architecture.md](CURRENT-architecture.md)。本人は全体を好意的に評価したうえで中央ロゴの遠近を指摘。今回の修正後の見た目について人間の確認は未取得。

## 指示・原因・変更

直接の人間指示: 中央のロゴが遠くでも鮮明で違和感があるため確認すること、細部にロゴ技術を使うこと/視点切替で品質を保つ構造など制作方法を環境へ残すこと。完全な正解とは限らず自己改善を認める。判断はPLAN-logo-lod。

位置投影/縮小/傾き/透視補正UV/深度は既に有効。問題は壁面素材の細分6倍/brightness1.7/glow.15/原画最近傍sampleが固定で、周囲の情報量に対して強調が残ること。カメラ・看板サイズ/位置/球場geometryは変更せず、壁面sample/細分と強調だけを調整。

- material-lod.mjs: 投影短辺/傾き/camera depthから密度・強調・発光・contrastを連続計算。2〜8の保存値は上限。UIも「細かさ（上限）」へ変更。閾値80px/深度70〜420は暫定の美術調整で、空気散乱の実測/物理定数ではない。
- texture-filter.mjs: 採用PNGを一度だけ縮小階層化し、透明度を考慮して色/coverageを平均。bilinear/trilinear sampleで縮小時の細部を馴染ませる。元RGBA/芝生sampleは保持。追加mip画像は11枚、RGBA合計2,102,544 bytes（元PNG展開/マスクは別）。
- ground-logo.mjs / stadium-mesh.mjs: 壁面共用UV経路へ接続。ロゴ/看板の下地を同じ局所格子で描き、既存のworld depthを通す。ロゴを画面に貼る処理は作らない。
- STADIUM-AUTHORING.mdを制作の入口に追加。AGENTS、RENDERING-POLICY、READMEから参照。本人の目的と暫定手段を分け、近遠/全視点/負荷/保存の検証、失敗保持、改善候補の比較手順を記録。

最終HTML: outputs/球場設計室_v3_局所密度版.html / 45,834,614 bytes / SHA `72eb3584a2d74a59e9b88127c0c336235b77e4ff1e9ebdb1a458aa06dbbbd5fd`。
復旧先: outputs/球場設計室_v3_ロゴ遠近調整前.html / SHA `65940c5fd59397689ed25c99e76fc4df081c25dfba2d09ed549f9b896f0a6af0`。旧素材/形状/過去FAIL/証跡は削除しない。

## 検証と候補比較

- unit40/40 PASS `b527bf82980d4c38bc273ad5d49ef02f`。近遠/斜め/連続変化/同じ投影サイズでも異なる深度、透明縁の金色保持、checker縮小とmip遷移、既存35件。
- 最終build logo-lod-a2 PASS `dbfafb04cb894d07a0d423c185dff937`。コピー内rendererだけ変更、Core不変、構文/完全逆変換。21 SHA読戻し PASS `1e2ecd0c68334b389c886c14cbafd0a9`（17入力+元V114/v1/v2+製品）。
- ロゴの0.5/1/2倍比較と旧製品の同一カメラ/同一geometry、芝生の画素一致 Chrome PASS `6aa2b24190c3497aaeea855b38983ded`。evidence/logo-lod-logo-lod-a2/report.json / before-interior.png / after-interior.png。中央depth253.52、投影短辺30.98→61.96→123.92pxに対し密度2.27→4.30→4.79（上限6）。画像を目視確認。
- 8視点/回転/屋根/建築設定・保存/旧JSON/モバイル Chrome PASS `826ddc6ee50b48de91d2b522b9c5a48d`。精密点2894 samplesの独立world ray/triangle漏れ0。evidence/architecture-logo-lod-a2/。
- 従来dome編集/6視点等 Chrome PASS `5e490536126142d5b5214728223c1dbd`。群衆の発光/満員/空席/屋根/保存/芝生比較 Chrome PASS `be3f4d7c461a4d92b423824d83eac6e0`。
- a1はunit/技術検証PASSだが、画像を見て大きな看板の強調が残ると判断し不採用。投影サイズだけのLODでは不十分と記録し、a2でdepth由来のcontrast/強調調整を追加。テストPASSを見た目の正解としない例として比較原画像を保持。製品の実検証は全PASS。最終文書監査 `61e163e61197486ba1868723c5349e64` は制作指針の字面「負荷」を要求してFAIL（既に「軽さ」として説明）。原FAILを保持し、主文書に独立した描画負荷の予算/確認項目を追記。製品コードの不具合を示すFAILではない。

## 改善余地と境界

本人の見た目の確認が次。遠近のcontrast調整は美術的な暫定手段で、暗さやぼかし過ぎは比較画像で再調整してよい。非常に斜めの面の異方性sample、建物全体の露出/照明の整合、端末実測は今後の候補。現在の方式を唯一の正解に固定しない。具体的な本人の禁止/固定内野/採用PNG/所有境界は保持する。

**DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED**。新球場の通常試合の衝突/守備/HR/イベント接続は別工程。実機スマホ/Safari/全設定組合せの全保証はしていない。通常試合/Core/他chatのsrc/dist/共有CURRENTは変更しない。専用CURRENT/固有receiptでcheckpoint。判断は既存PR380へ集約し、commit/push/merge/deployは行わない。

最終監査 PASS `ae20deb92d1c4115903df14ff7c97a18`。evidence/logo-lod-final-audit.jsonで製品/復旧hash、geometry/camera/Core/PNG不変、入力pins、40件unit原log、全回帰reportの製品SHA、原監査FAILを含むlog SHA、制作指針とAGENTSからの入口、GitHub既存commentとローカル本文の一致を確認。判断記録はGitHub同期済み。UI再表示はqueuedであり表示済みとは扱わない。
