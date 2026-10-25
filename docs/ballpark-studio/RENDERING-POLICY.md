最新の承認画像に基づく中央スコアボードとロゴの軽い遠近は [README-scoreboard.md](README-scoreboard.md)、現在の検証は [CURRENT-scoreboard.md](CURRENT-scoreboard.md)。旧の深度減光は撤回済み。

最新の作業指針（自己改善可）は [STADIUM-AUTHORING.md](STADIUM-AUTHORING.md)、壁面ロゴの遠近調整と現行証跡は [CURRENT-logo-lod.md](CURRENT-logo-lod.md)。従来の固定密度の記述は履歴として読む。

# 球場素材と局所光点の共通経路

本人の2026-10-24指示を恒久化する。精密な素材だけを線やpixelで重ねず、元の点で構成された画面に合わせる。

1. 参照画像を加工したRGBA素材を用意する。今回の採用素材は `assets/wolf-gold-cutout-v1.png`。生成加工の来歴は `gold-wolf-asset.json`。元画像の完全同一切抜きではない。拒否された手描きglyphや未採用の白黒画像へ戻さない。
2. `ground-logo.mjs` がworld座標で画像をsampleする。読み込み時に可視alphaの距離場を一度だけ生成する。
3. `surface-layers.mjs` が芝生と画像の色を先に合成する。可視輪郭からの距離で細分領域を決定する。外接矩形は走査の上限であり、密度領域そのものではない。
4. 元と同じdot primitiveを細分格子・比例半径で使う。狼と近傍の芝生を同じ格子で描き、外縁だけ元密度へ滑らかに戻す。
5. 深度とfield marksで遮蔽する。選手・白線・屋根より手前へ素材を上書きしない。park cacheには素材設定・細分点queue・reportも保存する。

初期値: factor3 / margin0.6m / feather0.8m。これらは表示設定で、物理精度や捕球範囲を変えない。設定/inspect/APIは人間とAIで共用する。別素材の導入時もこの経路を拡張し、ロゴ専用の画面overlayや広い矩形patchを再導入しない。

操作時だけ再描画を予約する。細分化は局所に限り、屋根・観客を含む全世界の格子を上げない。画像maskの再生成や不要なidle loopを追加しない。端末ごとのFPS改善は測定していないため保証しない。

検証: unit、通常編集フロー、全6視点/320・390・1280幅、屋根閉鎖時の画素比較、独立ray-triangle遮蔽検査、旧renderer画素一致、入力/source/旧HTMLのhash。変更後は新しいlabelで証跡を残す。過去FAILや本人が不採用とした案は削除しない。

対象は `tools/ballpark-studio` と専用docs/outputs。他chat所有のCore、メーカー、V115共有CURRENTは変更しない。球場デザインは通常試合の物理・裁定への導入を意味しない。

## 観客の群衆タイル

本人の追加指定により、観客はスタンド面の共有3コマの模様にする。crowd-tiles.mjsの小さなatlasを全stand quadのUVでsampleし、既存の格子/光点/深度へ渡す。1人ずつのworld位置・描画・疑似actorへ戻さない。LED密度は模様中の発光島だけに作用し、群衆背景を抜いて無観客にしない。光芯とnative glowは深度を通過した可視cellだけを描く。ロゴ経路へ変更を波及させない。詳細はREADME-crowd-tiles。

## 任意の立体面への拡張

2026-10-24の追加指定で、外装/客席/屋根を閉じた立体構造へ改修。内側センターと入口の狼は芝生と同じPNG/素材合成/円形光点を使用する。壁面では看板面の範囲だけを細分し、周囲の下地も同じ格子にする。芝生は従来の可視alpha距離マスクを維持する。外装のV形/格子もUV素材として描く。投影三角形の局所索引と共有world depthで遮蔽する。手描きの代替狼/画面overlayへ戻さない。構造/拡張方法と最新検証はREADME-architecture/CURRENT-architectureを参照。
