# 非デザイン継続: 未解決の正しい判定とofficial callの分離

> 最新続報: [original pitchからwhole-play physical historyへの接続と検証結果](2026-10-04-whole-play-history-continuation.md)。以下の実行中・次段予定の記述は当時の記録として保持する。

更新: 2026-10-04 JST（2026-10-03 UTC）

[PR261](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/261) のactual field履歴・一塁判定に続き、canonical `07-world-first-adjudication-contracts.md` §6.2の不足を既存adjudication engineへ追加した。

## 実装

- `UnresolvedCorrectRuleSnapshot` と専用event/recording APIを追加。理由は `exact_simultaneity` または `insufficient_evidence`。このsnapshotにgameplay rulingを格納しない
- OnFieldCall / ReviewDecisionは、未解決の根拠snapshotにもIDとevidence revisionで結び付く。正しいOUT/SAFEを捏造してAPIに通す必要をなくした
- 未解決truthしかない状態では、correct-rule fallbackからofficial closureを作れない。偽のclosed eventをreplayする経路も拒否する
- 明示的なcallがある場合は、そのcallやreviewの結果をofficial rulingとして別に保持する。元の未解決truthや最初のcallを書き換えない
- 新しいevidenceによる旧call/reviewのstaleness、open window、物理履歴/時刻順序の境界を維持する
- 既存resolved snapshot/event/APIのserialized valueとNative SQLite schemaを保持する。Open-state consumerは新しいevidence unionをnarrowしてからrulingを読む

## 検証

- 新API/event不在のRED: 21 failuresを確認
- Bounded Core/Native regression: **20 files / 142 tests PASS**、94.98秒。Adjudication/integrity/window-policy、SQLite official state/scoring、Native archive/WAL、World settlementを含む
- Field-rule stackへ統合後: **2 files / 35 tests PASS**、1.03秒。新unresolved suiteとSQLite restart suiteを実行
- Typecheck / diff check: PASS
- Fresh independent review: material findingなし。35 focused testsを独立再実行してPASS
- 旧resolved JSON fixtureはbyte-equivalent

Whole suiteは独立した固定Sourceの検証待ち。前段#259/#260/#261のwholeはそれぞれ別checkoutで実行しているため、それらの結果をこの新しいSourceの全体成功へ流用しない。

## まだ接続していないもの

これはpost-physical adjudicationのCore契約差分であり、Native fieldからの自動審判生成やin-play call-information channelではない。元のPlayEnd gateを維持し、field horizonや一塁結果をPlayEndへ置換しない。

NPB2026の既存window/defaultは変更していない。Review/challengeの有効化、deadline、challenge count等には、そのcompetitionの明示的policyが必要。Venue surface/dead/out-of-play/interference policyも推測で追加していない。

次は元pitch/contactと実際のfield/Player/throw履歴を、古いpitch timelineを改変せず一つの所有されたcausal historyへ結ぶ。全体の公式closure/scoring/workload、next-play、一般body/controller、自律Careerは残計画として続く。

## 公開

PR261上のstacked draftとして保存する。デザイン/UI/art/Presentation、自宅/self-hosted CI、workflow/config/lock、merge/force pushには触れない。全計画完成や現SourceのCI合格は申告しない。
