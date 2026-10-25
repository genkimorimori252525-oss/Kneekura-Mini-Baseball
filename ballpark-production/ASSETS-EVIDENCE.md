# 素材・原記録・公開証拠

## 同梱内容

- `tools/ballpark-studio/`: このセッションの実装モジュール、UI、単体テスト、browser check、audit、CLIと描画パッチ。
- 同assets: 元の参照、最初の狼加工、採用された完全な金色狼の参照、採用透過PNG。過去素材を現行採用と混同しない。
- `docs/ballpark-studio/`: 全34件の技術/計画/継続文書、例JSON、全JSON検証report、スコアボード承認イメージ。ローカルの個人パスは公開用に置換。
- 同evidence: 最終の建築9視点・開閉/回転/モバイル、表示盤、群衆、ロゴLODの比較画像を選んで収録。数百枚の重複した中間画像をすべてgitへ積むことは避けたが、方法と不採用の経緯は文書・reportに残す。元画像はローカルで保持している。
- `history/verification-receipts.json`: 制作部だけの過去receiptを公開用にまとめたもの。元logのSHAを保持するが、生ログや生会話は公開していない。receiptの存在だけで未接続機能を完成と扱わない。
- `artifacts/`: buildに必要な凍結V114 HTMLと採用0.8倍の完成HTMLをgzipで同梱。gitで見るための通常ソースは別に収録。

元の採用HTMLとV114は、同梱アーカイブを展開すると元のSHAと一致する。従って、これらの凍結バイナリ内部には既存の試合Coreとゲーム素材も含まれる。球場制作部がそのCoreを再設計・最新版へ統合したという意味ではない。素材の再利用可能性や第三者の権利を一律に新たに許諾するものでもない。

## ファイルの対応

`SOURCE-MANIFEST.json` は収録310ファイルのpath/bytes/SHAと元ファイルのSHAを記録する。制作PCの個人パスの除去、browser checkのPlaywright解決を通常のmodule名へ変更、Chrome実行パスの環境変数化は公開時の適応であり、描画アルゴリズムは変えていない。変更のあったファイルは `sanitized: true`。凍結アーカイブには圧縮前のSHAもある。

`PACKAGE-MANIFEST.json` は今回追加した手引き・再現コマンド・lockfileを含む公開package全体のhash索引。manifest自身と今回の最終検証reportは循環hashを避けるため除外し、gitのcommitがそれらを固定する。`verify-publication.mjs` でhash・相対リンク・個人パス・既知のcredentialパターン・同梱内容を検査する。パターン検査は完全な秘密情報検出を保証するものではなく、公開対象の目視確認も行う。

## 検証状態の読み方

| 状態 | 意味 |
|---|---|
| 完成確認 | 2026-10-25、本人が球場のデザイン完成と芝生0.8倍を採用 |
| 過去PASS/FAIL | 制作中の実行記録。新しい公開検証へ付け替えない |
| 今回PASS | 公開用コピーでverify、44 unit、buildと採用HTML hash一致、browser smoke、公開package検査を実行した結果 |
| NOT CONNECTED | 新球場の通常試合Core接続、公式スコア、壁/屋根の試合衝突、守備/HR/ホームランキャッチ接続 |
| NOT VERIFIED | 実機スマホ/Safari全保証、極端な全設定組合せ、長時間FPS向上 |

今回の具体的な結果は `validation/publication-report.json`（公開用に個人パスを含めない要約）。実機とdesktopの狭いviewportを混同しない。古いCURRENTの「外観未承認」や「8視点」は当時の状態であり、現在の採用状態と9視点は制作部READMEを優先する。
