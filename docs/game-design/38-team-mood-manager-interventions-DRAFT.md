# Team Mood — Manager Intervention Layer — DRAFT

更新日: 2026-09-20  
状態: **設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/37-team-mood-architecture.md`
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
- `docs/game-design/35-team-trait-catalog-DRAFT.md`
- `docs/game-design/01-manager-experience.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`

---

# 1. Goal

Team Moodをユーザーが直接操作するSystemにはしない。

禁止:

```text
[チームミーティング]
 -> Cohesion +10

[檄を飛ばす]
 -> Energy +15

[ムード改善]
 -> Tension -20
```

ユーザーはMoodではなく、**Moodを生んでいる原因へ野球監督として介入する**。

---

# 2. Intervention Principle

```text
Mood Problem
 -> Diagnose likely cause
 -> Baseball / personnel action
 -> Players appraise action
 -> Relationship / Role / Trust changes
 -> Mood changes over time
```

即時回復ボタンを置かない。

---

# 3. Core User Actions

## 3.1 役割を明確にする

対象:
- Role Harmony低下
- closer / setup混乱
- batting-order不満
- position competition
- star hierarchy ambiguity

ユーザーAction:

```text
「この選手は今季ここで使う」
「抑えはA」
「Bは代打の切り札」
「Cは二軍で毎日出す」
```

Potential benefit:
- Role Harmony上昇
- uncertainty低下
- tactical trust上昇

Tradeoff:
- 外された選手の不満
- flexibility低下
- injury時に再調整必要

---

## 3.2 個別面談

対象:
- 不満
- conflict
- confidence loss
- role dissatisfaction
- newcomer isolation

ユーザーは数十種類の会話文を管理しない。

簡易方針だけ選ぶ。

```text
[励ます]
[役割を説明]
[競争を促す]
[休養を勧める]
[本人に任せる]
```

結果は:
- Player personality
- manager trust
- current performance
- role expectation

で変わる。

同じ選択が全員に効くわけではない。

---

## 3.3 リーダーへ任せる

Captain / veteran / clubhouse central playerをmediatorとして使う。

```text
Manager
 -> asks Leader A
 -> Leader A talks to Cluster B/C
 -> effect depends on trust network
```

Potential:
- Cohesion recovery
- newcomer integration
- conflict mediation

Risk:
- Leaderが当事者から信頼されていない
- faction化
- leader本人の負担

---

## 3.4 起用を固定して共有経験を作る

対象:
- low Coordination
- defensive miscommunication
- battery distrust
- lineup chemistry未形成

Action:
- same SS/2B pairを継続
- catcher-pitcher pairingを固定
- outfield unitを安定させる
- batting-order clusterを一定期間継続

Effect:
- shared reps
- coordination
- trust
- role clarity

Tradeoff:
- matchup flexibility低下
- bench opportunity減少
- fatigue risk

---

## 3.5 休ませる / 一度外す

対象:
- high Tension
- fatigue
- repeated failure spiral
- conflict escalation

Action:
- day off
- bench
- reserve / rehab / reset

Potential:
- tension cooling
- emotional reset
- role reassessment

Risk:
- Player interprets as punishment
- role dissatisfaction
- star hierarchy conflict

---

## 3.6 新しい血を入れる

対象:
- Energy低下
- stagnation
- complacency

Action:
- prospect call-up
- bench reshuffle
- trade / signing
- new reliever role

Potential:
- Energy rises
- Hope signal
- competition increases
- new social links

Risk:
- Role Harmony worsens
- veteran frustration
- newcomer integration delay

---

## 3.7 競争を促す

対象:
- low Energy
- complacency
- weak role accountability

Action:

```text
「ポジションは競争」
```

Potential:
- Energy / focus上昇
- effort上昇

Risk:
- Tension上昇
- Cohesion低下
- role uncertainty

競争は万能Positiveではない。

---

## 3.8 あえて触らない

重要なAction。

小さな不調 / 小さなconflictに毎回介入すると逆に悪化し得る。

```text
[様子を見る]
```

が正解になる場合を作る。

自然回復:
- time
- ordinary wins
- peer support
- conflict cooling

を許可。

---

# 4. No Perfect Diagnosis

ユーザーはMood Stateの内部真値を完全には見ない。

UI候補:

```text
チームムード: 不穏

主な兆候
- 抑え役割への不満
- 新加入選手がまだ孤立
- 直近5試合で逆転負け3回

監督メモ
「役割整理が必要かもしれない」
```

原因候補を提示するが、100%断定しない。

---

# 5. Mood Problems Need Time

Action即時解決は禁止。

例:

```text
役割を明確化
 -> Role Harmony candidate improves
 -> 2〜10 gamesでPlayers appraise
 -> trust / acceptance形成
 -> Mood changes
```

重大Conflictは数週間〜数か月かかり得る。

---

# 6. Severity Tiers

## Mild

- short slump
- newcomer awkwardness
- small role uncertainty

1〜2 actions + timeで改善可能。

## Moderate

- repeated conflict
- closer instability
- strong losing-streak pressure
- subgroup split

複数週間 / several actions。

## Severe

- central stars in conflict
- manager distrust
- large factionalization
- repeated public disputes
- role structure collapse

単一Actionでは解決しない。

Roster move / role redesign / manager changeまで必要になる場合がある。

---

# 7. Intervention Cost / Tradeoff

Mood actionに無料万能解を作らない。

```text
stability
<-> flexibility

competition
<-> security

rest
<-> playing time

star protection
<-> fairness

veteran leadership
<-> youth opportunity

new blood
<-> continuity
```

ユーザーは「どの問題を優先するか」を選ぶ。

---

# 8. Manager Skill Interaction

後続のManager Ability設計へ接続。

ManagerはActionの成否を直接保証しない。

候補Manager skills:

- communication
- conflict mediation
- role clarity
- emotional reading
- leadership credibility
- tactical consistency

例:

```text
same "役割を説明" action

Manager A:
  clear communicator
  high trust
 -> acceptance likely

Manager B:
  poor communicator
  low trust
 -> Player may feel sidelined
```

---

# 9. User Experience Goal

ユーザーに求めるのはMood管理Spreadsheetではない。

基本Loop:

```text
1. 「最近なんか噛み合ってない」
2. Mood summaryを見る
3. 1つか2つの野球的なActionを選ぶ
4. 数試合〜数週間様子を見る
5. 改善 / 悪化 / 別問題が見える
```

これが中心。

---

# 10. Why Mood Matters

Moodが意味を持つのは、**勝敗を直接いじるからではなく、監督に「人を扱う仕事」を発生させるから**。

野球監督の仕事を:

```text
打順
継投
守備位置
```

だけにしない。

しかし:

```text
心理カウンセラーゲーム
```

にもならない。

中間に置く。

---

# 11. Anti-cheese

禁止:

- meeting spam
- captain spam
- all Mood Makers roster
- same dialogue always correct
- action cooldown onlyで機械的に管理
- hidden guaranteed +Mood choices

必要:

- context
- personality
- tradeoffs
- time
- uncertainty
- role consequence

---

# 12. Suggested UI

```text
TEAM MOOD
不穏

自信      C
結束      B
活気      C
緊張      A
役割調和  D

気になる点
• 抑え役が定まっていない
• 新加入2名がまだ孤立
• 主力Aが起用法に不満

監督アクション
[役割を整理]
[個別面談]
[リーダーに任せる]
[起用を固定]
[休ませる]
[様子を見る]
```

ユーザーは内部数式を知らなくてよい。

---

# 13. Design Target

Team Moodは:

> **簡単には治らない。だが、監督として何もできないわけでもない。**

を狙う。

- Mildなら数試合
- Moderateなら数週間
- Severeなら構造変更

という時間差を持たせる。

---

# 14. Review Candidate

ユーザー監修候補:

1. Moodへ直接作用するボタンは禁止
2. 監督Actionは原因へ作用
3. ActionにはTradeoff
4. 一部は「様子を見る」が正解
5. Mood recoveryには時間が必要
6. Severityで必要介入量を変える
7. Manager Abilityは同じActionの成功確率 / 受け止められ方へ影響
8. UIは原因候補と少数Actionだけ提示
