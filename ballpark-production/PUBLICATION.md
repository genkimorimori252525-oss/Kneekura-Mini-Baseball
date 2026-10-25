# 公開判断と引継ぎ checkpoint

2026-10-25 JST / MB-20261025-BALLPARK-PUBLICATION。

## 対象と本人指示

本人が球場制作で得たロゴ技術・設計法・制作法の全体を、既存のKneekura-Mini-Baseballへ「球場制作部」として上げるよう直接依頼した。公開ソース・素材・手引き・検証・制作履歴をまとめるscopeの根拠とする。前段ではデザイン完成と芝生ロゴ0.8倍を明示採用済み。

実際のremoteは `genkimorimori252525-oss/Kneekura-Mini-Baseball`、公開repository。mainは旧記録のため、設計資料を管理する `jolly/core-foundation-plan-2026-09-17`（開始SHA `a71c017d085bb6213a1facfc6eee6aba17723d78`）から独立した公開用コピーと `codex/ballpark-production-department-2026-10-25` を作った。通常試合の開発ブランチや共有CURRENTには触れない。

## 判断・影響・代案

断片的なコメントだけでは将来の担当が再制作できないため、実装ソースと素材・凍結入力・完成HTML・portableな再現コマンドも同梱する。77MB程度の既存素材/証拠/圧縮HTMLに加え、手引きとlockfile。数百枚の重複画像や私的な生会話・実行生ログをgitへ一括投入せず、各技術の最終/比較画像と全JSON report、原記録のhashを残す。

rootの依存設定・試合Core・データ形式・ゲーム挙動を変更しない。esbuild0.21.5は既存技術で、制作部のpackage内に固定する。元buildの相対配置を専用.build内で再現することで、production sourceの描画処理を変更せずに別PCで再buildできる。

ソースの公開適応はbrowser checkのmodule解決とChrome環境変数、不要な個人パスの除去に限定。元と公開ファイルの両hashを保存する。素材は生成加工と参照原画を区別し、新たな第三者利用許諾を捏造しない。

公開検査でGitの自動改行変換がhash検証を壊す可能性を確認したため、制作部の3領域だけ `-text` のGit属性を追加。共有の案内文書4件はLFで保存する。通常試合sourceへの属性変更はしない。

初回のindex検査ではroot向けAGENTS.md属性が同名の子ファイルにも適用され、byte hash不一致を検出した。属性のroot指定を先頭 `/` で限定して修正し、再stageと全件照合を行う。原FAILは公開用コピーの固有receiptに保持し、試合Coreや描画sourceを変更して回避しない。

## 検証・復旧

公開用コピーでmanifest、全JSON、archive展開hash、44 unit、採用HTMLと同一hashのbuild、9視点browser smoke、内部リンクとcredentialパターンを検査する。具体的結果はvalidation/publication-report.json。

公開は通常branchへのcommit/pushとレビュー用PR。無断merge、force push、deployは行わない。問題があればPRの当該commitをrevertし、既存のデザインbranchと元の作業ツリーはそのまま維持できる。ローカルの原証拠を公開加工で上書きしない。

## 保持する境界

球場デザイン完成・制作環境の実装/検証と、通常試合の壁/屋根衝突・守備・HR・公式スコア接続は別。後者は `NOT CONNECTED`。実機モバイル/Safari/長時間FPSは `NOT VERIFIED`。本人の制作部公開依頼を、これらの自動実装や共通Charter承認へ拡張しない。

旧FAIL/UNKNOWN/未接続を過去docs/reportに保持。共有CCG復元では別担当のV120作業と未承認Charterが見えたが、この独立した資料公開をそれらの完了・承認と扱わない。
