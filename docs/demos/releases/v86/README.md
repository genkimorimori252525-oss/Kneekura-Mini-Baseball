# v86 メーカー入力確定とエラー復帰

[maker.html](maker.html) をダウンロードしてブラウザーで開く。自己完結HTML。メーカー限定の新版で、通常試合はv84を継承する。

投手の複数エラー確定不能、タブ往復の未保存入力消失、バットの同値復帰、保管庫の取消後表示残留などを修正。原因欄・操作グループのすぐ下に日本語メッセージを表示する。旧v85の解説・灰色比較の初期OFFを継承する。

- [設計・変更ファイル](../../../design/2026-10-21-v86-maker-validation.md)
- [実行した検証と残件](../../../verification/releases/v86/README.md)
- [SHA-256](SHA256.json) / [Source・証拠対応](source-contract.json)

ビルド: `node tools/browser-bridge/build-maker-release-v86.mjs`。物理Core/保存形式/通常rendererは変更していない。
