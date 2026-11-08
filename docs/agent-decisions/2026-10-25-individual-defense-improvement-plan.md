# 守備AI改善計画の判断記録

日時: 2026-10-25 JST。Task `MB-20261025-DEFENSE-IMPROVEMENT-PLAN`。

本人の直接依頼「改善計画を立ててくれ」に基づき、前回の参考守備図監査のR1〜R3を改善する計画を作成する。今回の承認scopeは計画作成であり、中央役割割当から個人判断へ実経路を切り替えるアーキテクチャ変更はまだ実行しない。

対象: ローカルV117の認識・役割・連携と診断。根拠は承認済み個人守備設計と `docs/verification/defense-reference-audit-2026-10-25/AUDIT.md`。サイトは参考であり正解表にしない。未承認の育成ドラフト、新研究室UI、MLB再校正へ広げない。

判断: 主担当が実装する段階移行を推奨。ログ→個人認識→候補評価をまず副作用のない比較経路に作り、通信と本人の採否を経て初めて実動作を切り替える。中央DPの重み調整だけでは個人認識／採否が実現せず、全物理再実装は既存保証を失うため採用しない。既存のperception／communication／intent／causal traceをLive adapterで再利用し、別体系を複製しない。

調査分担は既存Sol担当1名の読取限定。新agent・Luna・コード編集・広試験は依頼しない。計画の自己点検は主担当で行う。能力・得能・個人・信頼・球場差、実物理と公式裁定、表示、旧JSON、先読みの境界を守る。

影響・復旧: 本回は新規計画・記録・計画検証のみ。製品Source・Native・HTML・能力・原JSONを変更しない。既存監査文書と原FAIL／UNKNOWNを保持する。製品の復旧操作は不要。実装時は固定V117から別名成果物へ進め、工程ゲートと局所復旧を設ける。共有workspaceのreset／clean・他担当の巻戻しは禁止。

検証: 計画の参照先・工程・依存・受入条件・未実装表記を点検し、160 Native inputs・3244 V117 captured inputs・9配置成果物・原JSON・前回監査文書のhashを照合する。今回はproduct testを再実行せず、製品改善のPASSを主張しない。新計画は `docs/superpowers/plans/2026-10-25-individual-defense-improvement-plan.md`。

GitHub: 公開repoと既存PR380の所在・branch・HEADを読取確認。公開可能な計画要約だけを既存PRへ集約し、ローカルpath・私的入力・生ログを載せない。Source commit／push／merge／deployは行わない。公開後のURLと実検証結果は計画検証directoryへ記録する。

結果: ローカル参照・無変更検証 `7d68c5c95e1a4af4bc1c4e6a8dbbcfdd` PASS。6工程・30以上の検証step・既存5文書参照・予定4moduleの未実装、160 Native inputs／3244 captured inputs／9成果物／元JSON／原監査不変を確認。公開計画要約は既存PRの https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6388584604 へ同期。計画本文はローカルのみ、commit／pushなし。最終readbackは計画検証directoryの `final-integrity.json` へ保存する。
