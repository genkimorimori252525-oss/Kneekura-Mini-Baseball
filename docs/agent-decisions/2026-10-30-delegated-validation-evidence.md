# 分業した検証の永続証拠

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。本人の全CCG agentへの反復防止整備、既存handle／結果確認、確認済み検証を繰り返さない依頼に基づく変更。

V240の担当は局所テストを直接toolで実行してPASSと報告したが、task付きreceipt／永続logを作成していなかった。Rootはこの報告を正式receipt確認済みへ昇格せず、同commandの再実行で形式だけを補わない。不足はUNKNOWN／正式receipt未確認として原報告を保持し、新しいSource／入力／runtimeに必要な検証を実行前からrunnerへ通す。

共通`C:/Users/genki/.agents/skills/continuity-guard/SKILL.md`へ、依頼側がproject絶対path／完全task ID／runner入口を明記する一項目だけを追加した。before SHA `4b661653eb95ebff5b28ad81ec9ab7ad16278e71f287dff184666084cb01c578`、after `9b2e23553245b274267aceb3e3276cc5af20718a5dd1b0512c0c1ab77739083b`。

挿入項目以外の全bytes一致と編集前backupを確認。`151c9924572a4d59ade018828d27d383`で新Sourceのquick_validate PASS125ms。復旧先は`C:/Users/genki/.codex/tools/continuity-guard/backups/20261030-delegated-validation-receipts/SKILL.before.md`。Core／Hooks／TeamChat／設定／Charter／他projectは変更していない。

共通ファイル自体はこのGit repoにないためローカル保全であり、新repo作成や認証変更はしない。本projectの判断記録を通常作業branchへ含め、対象担当へもrunnerを直接通知した。既存全active agentへ自動hot reload済みとは主張しない。

receiptは実commandとlogの証拠であり、試験範囲／Source／実artifact／未完をRootが確認して初めて機能の受入へ使う。新しいgenuineのPASSを、以前の不十分な単体証拠や全Goalの完了へ置き換えない。
