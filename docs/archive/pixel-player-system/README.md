# Pixel Player System — archive

状態: **ARCHIVED / ON HOLD**
更新日: 2026-10-01

ユーザー判断で計画と今日の実験を保留した。現行方針は [採用済みPNG原画方式の継続](../../presentation/2026-10-01-png-player-continuation.md)。ここにある資料を実装対象・現在採用中の設計として数えない。再開にはユーザーの明示的な指示が必要。

## 保存した文書

- [設計・実装計画](2026-10-01-pixel-player-system.md)
- [first-player slice実装記録](2026-10-01-pixel-player-system-v1-slice.md)
- [B1描き直し/v2確認版の記録](2026-10-01-b1-quality-recovery.md)

元の文書パスにはリンクを保つためのARCHIVED案内を残した。全文中の承認・採用・制作順は当時の記録であり、この保留Statusを優先する。

## 保存した実験コード・素材

次の場所は履歴保存用。通常のMini公開exportからは外した。

- `src/presentation/mini/pixel-player/`: model/compiler/projection/replay/検証。
- `assets/pixel-players/`: prototype、v1、v2の構造化セル原本。
- `tools/pixel-player/authoring.ts` と `scripts/pixel-player.mjs`: CLI。
- `scripts/pixel-preview-v1.mjs`: v1確認版。
- `scripts/pixel-preview.mjs` と `scripts/pixel-review-raster.mjs`: v2比較版。
- 作成済みの `kneekura-pixel-player-v1.html` / `kneekura-pixel-player-v2.html`: 保存された実験成果物。現行の試合表示基準ではない。

履歴を再現する必要がある場合だけ:

```sh
npm run archive:pixel:compile
npm run archive:pixel:preview
```

再現は計画の再開・素材の再採用を意味しない。検証テストを残すことも、実験方式を本番へ接続する指示ではない。

## 保存時点

- 計画: `dca4c050df0a4a7c6ee4c8b2ce2ff6c0f4ef1d6e`
- first-player slice: `61351bba579ec8f2467875fcccd151f3e233eb20`
- quality recovery/v2: `505ce3e10a6d47658e36b89e72d720835325247e`

Coreや他担当の実装を巻き戻すgit reset/revertは行っていない。
