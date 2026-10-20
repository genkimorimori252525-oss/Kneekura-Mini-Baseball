# v85 メーカー設定解説と比較切替

[maker.html](maker.html) をダウンロードしてブラウザーで開く。自己完結HTML。v84継承のメーカー限定版で、通常試合HTMLはv84を継続する。

投手・打者・バット・保管庫に具体例付き解説を追加。灰色の無回転比較は初期OFFで、7つの図をまとめて切り替える。物理計算・保存精度・通常試合rendererは変更していない。

- [設定監査とモデルの限界](../../../design/2026-10-21-v85-pitch-settings-audit.md)
- [検証と再実行](../../../verification/releases/v85/README.md)
- [SHA-256](SHA256.json) / [Sourceと証拠の対応](source-contract.json)

ビルド: `node tools/browser-bridge/build-maker-release-v85.mjs`。元CharterHOLDと既存未完、縫い目モデルの未校正、v84の実FPSに関する限界を保持する。
