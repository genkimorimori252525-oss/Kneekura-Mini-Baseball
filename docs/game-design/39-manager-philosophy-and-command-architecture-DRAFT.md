# Manager Philosophy & Command Architecture — DRAFT

更新日: 2026-09-20  
状態: **初期設計候補。USER REVIEW REQUIRED。実装前。**

関連:
- `docs/game-design/01-manager-experience.md`
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/31-scouting-recruitment-system.md`
- `docs/game-design/37-team-mood-architecture.md`
- `docs/game-design/38-team-mood-manager-interventions-DRAFT.md`

---

# 1. Core Principle

監督を一つの「采配力」へ圧縮しない。

```text
Manager
├─ Philosophy
│   └─ 何を好むか
├─ Skill
│   └─ その考えをどれだけ上手く実行するか
├─ Knowledge
│   └─ 何を知っているか / どう推定しているか
├─ Authority / Trust
│   └─ 指示がどれだけ理解・受容されるか
└─ Adaptation
    └─ 新Evidenceを受けて考えをどれだけ変えるか
```

Philosophy自体にGood / Badを付けない。

例:

```text
盗塁重視
 != 名将

盗塁軽視
 != 愚将
```

ContextとRosterに合うか、実行品質が高いかで結果が変わる。

---

# 2. Human / CPU Symmetry

恒久原則候補:

> **ユーザー監督ができる野球的アプローチは、CPU監督も同じDecision Spaceから選べる。**

禁止:

- CPUだけが使える隠し采配
- CPUだけがTrue Abilityを読む
- Userだけが使える特殊な勝利補正
- DifficultyによるCPU能力Buff

共通入力:

```text
Known roster state
Scouting estimates
Recent game evidence
Match context
Manager philosophy
Manager skills
Player state
```

CPUはこの情報からActionを選ぶ。

Human Userは同じActionを手動選択する。

---

# 3. Human Manager Control Boundary

User本人の思考をManager AI能力値で上書きしない。

禁止:

```text
User chooses correct steal situation
Manager IQ = D
 -> game changes order to bunt
```

ユーザーのDecisionはそのまま採用する。

Manager AbilityがUser側へ影響してよいのは:

- 得られる情報の質
- tactical suggestionの質
- 選手への伝達
- player acceptance
- role clarity
- conflict mediation
- game-plan preparation
- adaptation support

等。

CPU監督では、DecisionそのものもManager Skill / Philosophyから生成する。

---

# 4. Manager Philosophy Families

以下は能力値ではなく「考え方」。

一人のManagerが複数軸を同時に持つ。

---

# 5. Offensive Philosophy

## 5.1 Running Aggression

```text
慎重走塁 <-> 積極走塁
```

影響:

- steal attempt threshold
- extra-base attempt threshold
- hit-and-run frequency
- runner pressure

盗塁成功率そのものは上げない。

---

## 5.2 Steal Emphasis

```text
盗塁軽視 <-> 盗塁重視
```

Running Aggressionと完全同義ではない。

三塁進塁は積極的でも盗塁は嫌う監督も成立する。

---

## 5.3 Power vs Contact

```text
単打 / Contact重視 <-> 長打 / Power重視
```

影響:

- lineup construction
- swing-policy preference
- role assignment
- pinch-hitter selection

Powerを直接上げない。

---

## 5.4 Plate Discipline

```text
早打ち <-> 待球 / 四球重視
```

影響:

- early-count swing permission
- zone selectivity policy
- pitcher workload strategy

待球型でも甘い初球を必ず見逃すわけではない。

---

## 5.5 Small Ball

```text
アウト温存 <-> バント / 進塁重視
```

影響:

- sacrifice bunt usage
- squeeze usage
- productive-out preference
- runner movement calls

---

## 5.6 Lineup Stability

```text
固定打順 <-> 流動打順
```

固定型:
- role clarity
- continuity
- shared experience

流動型:
- matchup exploitation
- hot/cold adjustment
- flexibility

どちらにもTradeoffがある。

---

## 5.7 Platoon Usage

```text
左右を気にしない <-> Platoon重視
```

例:

- 右投手へ左打者
- 左投手へ右打者
- reverse split evidenceを考慮

単純な左右だけでなく、Manager Knowledgeがmatchup estimateを作る。

---

## 5.8 Hot Hand vs Track Record

```text
長期実績重視 <-> 直近状態重視
```

直近成績をどの程度起用へ反映するか。

Recency biasになり得るので、Skill / Evidence Handlingと分離。

---

# 6. Pitching Philosophy

## 6.1 Starter Leash

```text
早め継投 <-> 完投 / 長いイニング重視
```

影響:

- starter pull threshold
- third-time-through tolerance
- fatigue tolerance
- bullpen workload

---

## 6.2 Bullpen Style

```text
固定役割 <-> Leverage運用
```

固定:
- closer / setup / 7th roles明確
- Role Harmonyを作りやすい

Leverage:
- strong relieverを重要局面へ柔軟投入
- role uncertaintyが出る場合あり

---

## 6.3 Matchup Relief

```text
投手継続重視 <-> 対左右 / matchup細分
```

継投回数・specialist使用傾向。

---

## 6.4 Pitching Attack Style

```text
ゾーン勝負 <-> かわす / chase重視
```

影響:

- pitch-zone target prior
- walk tolerance
- contact-risk tolerance

---

## 6.5 Fastball vs Breaking Preference

```text
速球中心 <-> 変化球中心
```

Manager game planのprior。

Pitcher本人のGreen Trait / repertoireと別入力。

---

## 6.6 Inside vs Outside

```text
外中心 <-> 内角攻め
```

ただし各Pitcherのcommand / movement / batter profileで最終判断。

---

## 6.7 Intentional Walk / Avoidance

```text
勝負重視 <-> 敬遠 / 勝負回避を使う
```

Star batter、base state、next batter等を考慮。

---

# 7. Defensive Philosophy

## 7.1 Shift Aggression

```text
標準守備 <-> 強い守備シフト
```

Manager Knowledge / scouting uncertaintyから配置を決める。

正解位置を知っているわけではない。

---

## 7.2 Data Positioning

```text
選手感覚重視 <-> データ配置重視
```

Data-heavyでもデータ品質が低ければ失敗する。

---

## 7.3 Run Prevention Posture

```text
深め / 長打警戒 <-> 前進 / 一点阻止
```

Score / inning / runner contextで変化。

---

## 7.4 Arm / Range Preference

```text
堅実性重視 <-> 守備範囲 / 肩重視
```

守備交代・position assignmentへ影響。

---

# 8. Roster Management Philosophy

## 8.1 Veteran vs Youth

```text
ベテラン重視 <-> 若手重視
```

能力Buffではない。

影響:

- close competitionで誰を優先するか
- call-up threshold
- development playing time
- patience with mistakes

---

## 8.2 Promotion / Demotion Churn

```text
一軍固定気味 <-> 入れ替え活発
```

安定型:
- continuity
- role clarity

活発型:
- hot prospect chance
- quick accountability
- instability risk

---

## 8.3 Rest Policy

```text
固定メンバー <-> 積極休養 / Rotation
```

fatigue / continuity / playing-time expectationのTradeoff。

---

## 8.4 Star Privilege vs Role Equality

```text
全員同基準 <-> Star裁量大
```

Starへ自由度を与えるか。

Role Harmony / fairness appraisalに関係し得る。

---

## 8.5 Development vs Win-Now

```text
将来重視 <-> 今季勝利重視
```

若手起用、rehab patience、veteran acquisition等へ影響。

---

# 9. Information Philosophy

## 9.1 Data vs Intuition

```text
直感重視 <-> データ主義
```

これは能力ではない。

### Data-heavy

- larger sample emphasis
- matchup model reliance
- scouting report weight
- structured decision rules

### Intuition-heavy

- live observation
- body language / timing cues
- recent in-game pattern
- experiential pattern recognition

どちらも優秀 / 下手があり得る。

---

## 9.2 Pregame Plan vs In-game Adaptation

```text
事前計画堅持 <-> 臨機応変
```

Plan-heavy:
- consistency
- role clarity
- overreaction防止

Adaptive:
- new evidenceへの追従
- small sample overreaction risk

---

## 9.3 Opponent-first vs Self-style

```text
自分たちの野球 <-> 相手対策重視
```

相手に合わせる程度。

---

## 9.4 Evidence Patience

```text
早く判断 <-> サンプルを待つ
```

同じData Managerでもここが違う。

---

## 9.5 Risk Tolerance

```text
保守的 <-> リスク選好
```

盗塁、継投、守備シフト、若手抜擢など複数領域へ共通するMeta-axis。

---

# 10. Human-management Philosophy

## 10.1 Autonomy vs Control

```text
選手裁量 <-> 細かい指示
```

Autonomy:
- player tendencyを尊重
- experienced playersと相性が良い場合

Control:
- game plan consistency
- young / inexperienced unitへ有効な場合

どちらもContext依存。

---

## 10.2 Role Stability vs Competition

```text
役割保証 <-> 常時競争
```

Team Mood / Role Harmonyと接続。

---

## 10.3 Direct Intervention vs Hands-off

```text
問題へ早く介入 <-> 選手間に任せる
```

Team Mood interventionに接続。

---

## 10.4 Public Accountability

```text
内部処理 <-> 公開で責任明確化
```

将来のMedia / Popularity設計と接続可能。

---

# 11. Manager Skill — Philosophyとは別

初期候補:

```ts
type ManagerSkillState = {
  gameReading: number;
  tacticalPlanning: number;
  adaptation: number;
  communication: number;
  roleManagement: number;
  conflictMediation: number;
  playerEvaluation: number;
  workloadManagement: number;
};
```

## gameReading

試合中の状態変化をどれだけ正しく捉えるか。

## tacticalPlanning

事前Game PlanをRoster / Opponentへ合わせる能力。

## adaptation

新しいEvidenceからPlanを修正する能力。

## communication

指示を誤解なく伝える能力。

## roleManagement

起用役割を納得可能な形で整理する能力。

## conflictMediation

重大Conflictへ介入する能力。

## playerEvaluation

現在状態 / fit / readinessを観測情報から見積もる能力。

True Ability読取ではない。

## workloadManagement

疲労・連投・先発負荷を運用する能力。

---

# 12. Manager Knowledge Boundary

ManagerもHidden Truthを読めない。

```text
Scouting Knowledge
+ staff reports
+ game observation
+ statistical evidence
+ uncertainty
        ↓
Manager Belief State
```

ManagerはBeliefから判断する。

Data Managerでも間違う。

Intuition Managerでも当たる。

---

# 13. Three Levels of Manager Instruction

## Level A — Philosophy

Seasonを通じたDefault。

例:

- 盗塁重視
- 若手重視
- 継投早め
- 待球重視

毎打席Userが指定しなくてもDefault priorになる。

## Level B — Game Plan

試合単位。

例:

- 今日の相手は左投手中心なので右打者多め
- 相手捕手の送球が弱いと推定し盗塁積極
- Aceなので球数を投げさせる
- bullpen消耗につき先発を長め

## Level C — Immediate Command

打席 / 局面単位。

例:

- 盗塁
- 送りバント
- 強振
- 待て
- 内角攻め
- 敬遠
- 前進守備
- 投手交代

この3層を重ねる。

---

# 14. Player Decision Pipeline

監督指示はPlayerの思考へ入力される。

```text
Manager Philosophy
+ Game Plan
+ Immediate Command
+ Player own tendency
+ Player perception
+ tactical understanding
+ trust in manager
+ compliance / autonomy
+ current emotion
+ game context
        ↓
Final Intent
        ↓
Physical execution
```

監督指示から結果を直接生成しない。

---

# 15. Instruction Strength

Commandごとに強さを分ける。

## Hard Sign

明確な作戦指示。

例:

- 送りバント
- 盗塁Sign
- 敬遠
- 守備シフト
- 投手交代

Playerは原則従う。

ただし:

- sign misunderstanding
- impossible late recognition
- safety abort
- execution failure

はあり得る。

## Soft Directive

方針。

例:

- 待球気味
- 長打を狙え
- 右方向意識
- 積極走塁
- 低め中心

Player本人の判断余地が大きい。

## Default Philosophy

監督の普段の野球。

直接命令ではなくDecision Priorへ弱く作用。

---

# 16. Compliance is not Obedience Stat

選手が監督指示へどう反応するかを単一の「従順度」にしない。

候補入力:

- manager trust
- tactical understanding
- experience
- personality / autonomy
- Player Trait tendency
- perceived situation
- instruction clarity
- past success of plan

例:

```text
Manager: 待球
Player: aggressive first-pitch hitter
Trust high
Understanding high
        ↓
本人傾向は残るが、普段より待つ

Trust low
Understanding low
        ↓
本人の積極性が強く残る
```

---

# 17. Player Skill Feasibility

指示がPlayer能力を作らない。

```text
Manager: 長打狙い
Contact-only hitter
        ↓
Power does NOT increase
```

本人が実行可能なSwing / Intent範囲で強振寄りになるだけ。

同様に:

```text
Manager: 盗塁積極
slow runner
        ↓
Speed does NOT increase
```

試行が増えるだけなので、失敗も増え得る。

---

# 18. Manager-Player Fit

同じManagerでもRosterによって適性が変わる。

例:

```text
aggressive steal manager
+ fast / smart runners
 -> philosophy can work

aggressive steal manager
+ slow roster
 -> outs may rise
```

```text
high-autonomy manager
+ experienced veterans
 -> may work well

high-autonomy manager
+ tactically inexperienced young roster
 -> execution inconsistency possible
```

「名将だから全Rosterで強い」は禁止。

---

# 19. CPU Manager Decision Architecture

```text
World / Match State
        ↓
Manager Belief State
        ↓
Legal Actions
        ↓
Policy preferences
        ↓
Expected consequences
        ↓
Risk / evidence / philosophy weighting
        ↓
Chosen Action
```

CPUはHuman Userと同じLegal Actionsを使う。

Manager差は:

- Action候補の評価
- Evidence weighting
- Risk tolerance
- Philosophy preference
- Skillによる推定品質

から出す。

---

# 20. No Direct Manager Buff

禁止:

```text
名将
 -> team contact +5
 -> pitcher command +5
 -> win probability +10%
```

正しい方向:

```text
better observation
+ better plan
+ better timing
+ clearer communication
        ↓
better decisions more often
        ↓
actual players execute
        ↓
results
```

---

# 21. Tactical Identity Examples

固定Classではなく、VectorからUI LabelをDerivedできる。

例:

- 機動力野球
- 長打攻勢
- 出塁重視
- 小技重視
- 固定打線
- 日替わり打線
- 左右病 / Platoon型 ※UI名称は要検討
- 完投主義
- 継投マシンガン
- Leverage Bullpen
- データ野球
- 勘と経験
- 若手抜擢
- ベテラン信頼
- 守備シフト派
- 自主性尊重
- 管理型

これらはDescriptor。

追加Buffを持たない。

---

# 22. Philosophy Drift

監督の考えは完全固定にしない。

```text
career experience
+ repeated success / failure
+ staff influence
+ league environment
+ roster composition
        ↓
slow Philosophy drift
```

ただし人格が毎年180度変わらないようSlow Stateとする。

---

# 23. User UI Principle

ユーザーへ30本のSliderを要求しない。

通常UIでは少数の方針プリセット + 必要時詳細。

候補:

```text
攻撃
  走塁: 積極
  打撃: 出塁重視
  打順: 安定

投手
  継投: 早め
  救援: Leverage

起用
  若手: やや積極
  入替: 標準

判断
  データ: 重視
  試合中変更: 柔軟
```

内部ではContinuous vectorを持てる。

---

# 24. User Override

Userはいつでも個別局面でDefault Philosophyを上書き可能。

```text
Season Philosophy: 盗塁重視

Today:
opponent catcher strong
 -> User chooses steal conservative
```

これを許す。

「哲学を選んだから毎試合同じことをしなければならない」にはしない。

---

# 25. Team Mood Connection

Manager PhilosophyがTeam Moodを直接変えない。

```text
Manager philosophy
 -> repeated decisions / roles
 -> player appraisal
 -> trust / role harmony
 -> Team Mood
```

例:

頻繁な一軍二軍入替そのものにMood penaltyを付けない。

しかし:

```text
frequent churn
+ unclear explanation
+ players cannot predict roles
        ↓
Role Harmony may decline
```

逆に若手中心Rosterが競争を好めば問題にならない。

---

# 26. Team Trait Connection

Manager PhilosophyはTeam Traitを直接付与しない。

例:

```text
長打重視監督
 -> 黄金打線
```

は禁止。

実際に:

```text
power-capable roster
+ long-ball approach
+ successful execution
+ shared success evidence
        ↓
relevant Team Trait candidate
```

とする。

---

# 27. Anti-Monocausal Rule

監督一人だけでDynasty / Dark Eraを説明しない。

Managerは重要だが:

- roster
- scouting
- development
- health
- finance
- Team Traits
- variance

と組み合わさる。

名将でも弱いRosterでは限界がある。

悪い監督でも圧倒的Rosterなら勝てる場合がある。

---

# 28. Initial Review Questions

1. Philosophy / Skill / Knowledge / Authority / Adaptationの分離を採用するか
2. UserとCPUのAction Space完全共通を正式採用するか
3. Human UserのDecisionをManager IQ等で改変しない方針を採用するか
4. Philosophy軸の不足 / 過剰はないか
5. Hard Sign / Soft Directive / Default Philosophyの3層を採用するか
6. Player response pipelineを採用するか
7. Manager Skill 8軸をどう整理するか
8. PhilosophyのCareer driftを許すか
9. UIは少数summary + optional detailsでよいか


Manager ratings / era / strategy evolution (USER REVIEW REQUIRED):
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`


---

# 29. User-approved Core Decisions — 2026-09-20

以下を正式方向として採用する。

1. Managerを Philosophy / Skill / Knowledge / Authority / Adaptation に分ける。
2. 公開Manager Abilityは「好み」ではなく性能を表す。
3. PhilosophyとSkillを混同しない。
4. Default Philosophy / Game Plan / Immediate Command の3層を採用する。
5. Hard Sign / Soft Directive / Default Philosophyを区別する。
6. Player Final IntentはManager instructionだけでなく、Player tendency / trust / tactical understanding / autonomy / emotion / contextとの合成で決まる。
7. Manager指示がPlayer能力を新規生成することを禁止する。
8. Human Userの戦術選択をManager IQ rollで勝手に改変しない。
9. UserとCPUは同じLegal Baseball Action Spaceを使う。

具体式・内部Skill分解・UIは後続設計で調整可能。
