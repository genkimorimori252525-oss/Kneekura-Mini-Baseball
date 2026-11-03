# SPIN / SIGNの実装範囲 — 本人回答による確定

2026-10-26 JST。Task `MB-20261026-TRAITS-SPIN-CONTINUATION-V123`。

**この件は回答済み。同じ対象確認・自動名付けの範囲確認を繰り返さない。**

## 対象の確定

本人が「この2本で合っている」と確認した対象は次の2計画。

- `docs/superpowers/plans/2026-10-26-rare-intentional-batted-ball-spin-mastery.md`（SPIN v2）
- `docs/superpowers/plans/2026-10-26-emergent-named-signature-traits-career-history.md`（SIGN v1）

原文はdesign branch `jolly/core-foundation-plan-2026-09-17`、固定commit `6d914ad7d9cd4c9dd6c8bb1378f8caa67cd7afaa`から取得済み。原文byte/hashは`../verification/traits-spin-continuation-v123/source-manifest.json`。原文を改変して承認状態を偽装しない。

## 今回とペナント段階の境界

本人の追加回答により、**自動認定・自動名付け、それらを稼働させるCareer文化生成はペナント実装時に行う。今回の完了条件には含めない。** SIGNはSource分離・公式成績/context Evidence・凍結ID/時刻/表示契約などの基盤を扱う。名称やラベルから物理効果・真能力・未習得技能を付与しない。基盤テストのPASSを自動命名やペナント実装の完成に読み替えない。

事前の主担当判断「命名も今回に含める」はこの本人回答で取り消された。回答前の判断・照会履歴は証跡として残し、現在scopeとして再利用しない。回答sourceは同チャットの`send_user_message_question_reply`、対象質問item `call_87645a5b67b0434098c1cec70c9cb9c6` / `call_1107ccd910074e3aa0728fb0e00748f3`。私的本文や生ログを外部へ転載しない。

## 継続・再開時

`../verification/traits-spin-continuation-v123/IMPLEMENTATION-SCOPE.json`とこの記録を参照し、未回答扱いに戻さない。ペナント実装が人間から依頼された段階でSIGN Task C/E/F等の自動認定・命名・社会認知・世代校正を実装対象へ戻す。今回のSPIN技能習得・回転実行と既存の承認済み残件は継続する。DRAFT32の個別fenceはこの範囲確定で解除されない。

## 検証・復旧

既存公開Draft PR #380の最新判断記録へ同期済み。投稿後のAPI再読で本文一致を確認: https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6412388620 。これは判断要約の公開で、ローカルSourceや記録文書本体のpush/mergeを示さない。

後続AIが計画本文を直接読んでも見逃さないよう、design branch上のSIGN計画冒頭にも同じ確定範囲を2行追記した。commit [db0ad7a9](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/db0ad7a9b15efae7a8839858b4b6d180a8643b01)、parentは固定元6d914ad7、変更fileは当該計画のみ（追加2/削除0）。content blobはd021c183d01cdd7773b2a5538cbc53e977b8f5c1。投稿後の本文API再読は送信した全文と一致。これは設計範囲の記録をGitHub優先で残す本人指示に基づく文書commitで、実装branchのコードpush/merge/deployではない。原文固定byte/manifestは6d914ad7版のまま保持する。

全入口のscope記録が一致するかを専用scriptで検証する。実装済みV124 HTMLと原計画byteは保持。未接続の表示契約はMatch入力へexportせず`nativeAdmission:false`のままにし、自動命名イベントを作らない。scopeの将来変更は新しい本人指示と追記で記録する。goalは、今回の対象と既存残件の実装・必要な検証がすべて完了するまでACTIVE。
