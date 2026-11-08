# 複数追球・連続ダイビング・守備意欲の計画判断

日時: 2026-10-25 JST。Task: `MB-20261025-PURSUIT-EMOTION-PLAN`。

## 対象と判断

本人の「改善計画を立てて」「感情値にも連動」「意見も聞きたい」という依頼に対する計画作成。今回は製品Source・能力・物理・HTMLを変更せず、実装を承認済みと扱わない。既存の個人判断設計とAUDITを継承し、formationの図は参考資料として扱う。

1. 心理OFFで、先行者の追球と後続者の追加捕球価値を別々に評価する。人数・位置・送球順を固定しない。
2. 近い二人の連続diveを妨げる到達円の保守性は、半径の一律縮小ではなく、採用済み進路・身体・着地/再起の連続clearanceとcommand改訂検証で解消する。危険・不明な同時動作は通さない。
3. 再起後の位置・速度・準備完了時刻を予測へ共通接続する。現行の実motor制約を緩めない。
4. その後、既存Appraisal/ActiveEmotionへLiveの状況入力と守備専用寄与を接続する。能力値や物理ではなく、危険を引き受ける判断を変える。非発火の寄与は厳密に0、重要度の直接倍率は禁止。既存の緑得能は二重適用しない。
5. 個人・信頼・球場差を維持し、複数の捕球/失敗、危険な交差、再起と進塁、心理非発火、Worker/replay/旧JSON/3HTMLを段階検証する。

代案の「追球は一人」「最大二人」「大差なら全員消極的」「重要試合は全員能力上昇」は採用しない。大差でも個人の挑戦意欲が残り、緊張時にも挑戦・ためらい・平静の違いが残る設計とする。

## 根拠と未確定事項

- V118再現監査で、一塁dive後の自力触塁と、二人の通常追球・先行失敗後の後続捕球は確認済み。二人の連続diveは未実証であり、現行guardの保守性と回復中carry予測の不整合を改修候補として維持する。
- 既存headless心理実装は存在するが、現在のLive守備へ未接続。未承認の育成DRAFTや未接続機能を完成済みへ昇格しない。
- 一次研究は状況の受け止め方と競技動作が個人で異なる設計の参考。MLBの点差・大会・順位別のdive頻度係数は未取得。数値は今後の校正仮説であり、実測値として導入しない。
- 接続済み心理入力の欠損/失効は拒否と状態保全、初めから未接続の旧データはNOT_CONNECTEDと区別する。心理の本番有効化前に入力校正と既存Work所有の単一マーク表示を整合させる。

## 検証・復旧・公開範囲

Spec/Planと調査根拠は下記に保存した。既存Sol一名の限定レビュー5所見を反映。計画の参照・未実装表示・既存3253入力/9配置file/7原文書の不変を実検証した。製品テストを実行したとは主張しない。将来の実装は別工程であり、旧V118/元JSONを保持して別名出力し、段階ごとに復旧可能にする。

- `docs/superpowers/specs/2026-10-25-cooperative-pursuit-and-defensive-willingness-design.md`
- `docs/superpowers/plans/2026-10-25-cooperative-pursuit-and-defensive-willingness-plan.md`
- `docs/verification/defense-willingness-plan-2026-10-25/verification.json`
- `docs/verification/defense-willingness-plan-2026-10-25/research.md`
- `docs/verification/defense-willingness-plan-2026-10-25/REVIEW.md`

本人の判断記録方針に従い、実在する同repo・同branchの公開Draft PR380へ計画要約のみ同期する。ローカルの未commit文書をGitHub保存済みとは扱わない。個人path・生会話・非公開入力・守備図・医療情報は投稿しない。Source commit/push/merge/deployは行わない。同期の成否は同証拠folderのreadbackで記録する。
