# 採用選手原画集

原画PNGのバイト列は変更していません。manifest.jsonに元ファイル名・SHA-256・役割を記録しています。

## 肌色バリエーション

- `originals-white/` は採用済みのライトスキン版（白人選手用）です。
- `originals/` は既存参照との互換性を保つため残した白人版コピーです。
- `originals-black/` は黒人選手用の褐色肌版です。各画像は `originals/` と同じファイル名で対応します。
- 黒人版では露出した肌色を変更し、ポーズ、B1体型、ユニフォーム、道具、コマ配置を維持しています。
- 機械的な対応ルールは `manifest.json` の `playerVariants` を参照してください。白人版・黒人版とも24枚で、ファイル名が対応します。
- 描画プレビューでは肌色を白人／黒人から選び、グローブ色を赤・青・黒・黄色・茶から選べます。グローブ色は専用マスクを描画時に置換するため、色ごとのPNGは不要です。
- 打撃の低め／真ん中／高めはインパクトの第3コマ（0始まりの index 2）だけ切り替えます。低め・高めは左右打者別にあり、それ以外の3コマは既存素材を使います。

左投げオーバースローの独立した最終採用原画は、今回の画像と承認履歴の照合では確定できていません。原画として補作せず、未確認のまま残しています。中継での左オーバーは右原画の反転を用いる暫定表示です。

## 収録

- B1 基本の見た目 — `originals/b1-base.png`
- 右打者・4コマ — `originals/bat-right.png`
- 左打者・4コマ — `originals/bat-left.png`
- 右打者・低めインパクト — `originals/bat-right-low.png`
- 右打者・高めインパクト — `originals/bat-right-high.png`
- 左打者・低めインパクト — `originals/bat-left-low.png`
- 左打者・高めインパクト — `originals/bat-left-high.png`
- 右投げ・オーバースロー — `originals/pitch-over-right.png`
- 左投げ・アンダースロー — `originals/pitch-under-left.png`
- 右投げ・アンダースロー — `originals/pitch-under-right.png`
- 右投げ・サイドスロー — `originals/pitch-side-right.png`
- 左投げ・サイドスロー — `originals/pitch-side-left.png`
- 走る・1コマ目 — `originals/run-cycle-2-frame-1.png`
- 走る・2コマ目 — `originals/run-cycle-2-frame-2.png`
- 守備・逆シングル・送球 — `originals/fielding-v2.png`
- 背面・待機・走行・送球 — `originals/back-view-v1.png`
- 背面・グローブ可視の守備12コマ — `originals/back-defense-v1.png`
- 背面・グローブ遮蔽の守備9コマ — `originals/back-occluded-v1.png`
- 守備・上方捕球 — `originals/catch-high-v1.png`
- 守備・正面捕球 — `originals/catch-line-v1.png`
- 守備・タグ・1コマ目 — `originals/tag-cycle-2-frame-1.png`
- 守備・タグ・2コマ目 — `originals/tag-cycle-2-frame-2.png`
- 盗塁・スライディング・1コマ目 — `originals/slide-cycle-2-frame-1.png`
- 盗塁・スライディング・2コマ目 — `originals/slide-cycle-2-frame-2.png`

`originals-black/` には24素材すべての褐色肌版を同名で収録しています。
