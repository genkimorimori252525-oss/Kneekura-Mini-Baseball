# Simple Surface, Deep Simulation — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。ゲーム全体UX原則。実装前。**

> **「一見シンプルだが、奥深い。」をKneekura Mini Baseballの最上位Product / UX PrincipleとしてFreezeする。**
> Simulationの深さは許すが、その複雑さをUser操作数へそのまま転写しない。

関連:
- `docs/game-design/06-future-systems.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/19-club-structural-dominance-and-decline.md`

---

# 1. スローガン

> **一見シンプルだが、奥深い。**

Kneekura Mini Baseballでは、内部Simulationの現実性と、ユーザー操作の複雑さを分離する。

ユーザーに世界の全パラメータを操作させない。

内部では複雑な因果を計算してよいが、ユーザーが触る操作は一般的な野球ゲームで理解しやすい範囲に制限する。

---

# 2. Core UX Principle

```text
Simple User Action
        ↓
Deep Hidden Simulation
        ↓
Understandable Baseball Result
```

例:

```text
ユーザー:
「FAでこの投手を獲る」

内部:
budget
wage structure
club reputation
player preference
competition status
other offers
agent demand
market scarcity
        ↓
契約交渉結果
```

ユーザーは財務モデルそのものを管理しない。

---

# 2.1 Surface Authority Rules — CANONICAL

恒久ルール:

1. Userが直接触るのは、野球チームをどう使い、組み、戦うかというBaseball Decisionを中心とする。
2. Finance / commerce / debt / sponsor / accounting / infrastructure administrationはBackground Simulationへ置く。
3. LegalなHUMAN_OVERRIDEをManager / Board AIが勝手に別Decisionへ差し替えない。
4. Background Simulationはbudget / injury / registration / contract / availability等を通じて**legal action spaceを制約**してよい。
5. UserがDelegationを選んだDomainだけ、Manager / Club AIがCanonical Decision Engineで決める。
6. Detail / Audit Viewを一度も開かなくても通常Gameplayで不利にならない。
7. Deep Simulationの存在は、daily chore / extra button / spreadsheet workを追加する理由にならない。

```text
legal Human choice
 -> execute exactly

background constraints
 -> may limit what choices are legal/available

delegated domain
 -> AI decides using canonical agent rules
```

---
# 3. User-controllable Baseball Actions

初期標準でUserが直接操作可能なのは、一般的な野球ゲームとして理解しやすい範囲。

## Roster / Team
- active roster / reserve / development assignment where legal
- starting lineup / batting order
- defensive position / bench assignment
- pitching rotation / bullpen role
- closer / setup assignment
- player rest / usage
- Priority Development / simple development emphasis

## Match Management
- starter selection
- pinch hitter / pinch runner
- defensive substitution
- pitching change
- steal / bunt / hit-and-run等
- intentional walk
- defensive positioning
- challenge / replay decision where rules permit

## Player Market / Team Building
- trade
- free-agent acquisition
- transfer / loan where League permits
- release
- contract renewal
- posting / sale where League permits
- draft / trial / scouting request
- prospect shortlist

## Staff
- manager / coach hiring and replacement
- scouting staff assignment

重要:

> **Userが触るのは「野球チームをどうするか」。会社をどう経営するかはBackground。**

32のRoster / Development、31のScouting / Recruitment、49のManager Architecture等が詳細Source of Truth。

---
# 4. User-does-not-manage Economic Detail

ユーザーへ直接操作させない。

- sponsor negotiation
- individual commercial contracts
- bank loans
- debt refinancing
- bond issuance
- stadium financing structure
- merchandise pricing optimisation
- broadcast-right negotiation
- owner capital injection amount
- tax strategy
- accounting policy
- detailed operating budget allocation
- commercial-network expansion
- brand campaign spending
- infrastructure depreciation
- financial regulation compliance calculations

これらはWorld / Club AIが背景で処理する。

---

# 5. Economy Exists, But as Constraint

Userは経済を「操作する」のではなく、野球上の制約として感じる。

通常Club Surfaceは次の**5軸だけ**を基本表示する。

```text
資金力
人気
育成
スカウト
球場・設備
```

これらはcurrent stateから導出されるReadable Viewであり、Match Buffではない。

# 6. Detail / Offseason Brief

必要な時だけ、詳細ボタンまたはオフシーズン開始時のBriefで次を表示できる。

```text
補強予算
人件費余裕
財政状態
```

Userに必要なのは「この選手を獲れるか」「今季どこまで補強できるか」を把握すること。

Revenue / debt / owner funding / financing access / commercial network等はOptional Detail / Audit Viewへ置く。

# 7. No Spreadsheet Management Requirement

ゲーム進行のために以下を要求しない。
- 損益計算書を読む
- 資金繰り表を作る
- 借入金利を比較する
- sponsor契約を大量処理する
- detailed operating budgetを細かく配賦する
- accounting / tax / complianceを管理する

内部では必要な因果Simulationを行ってよい。

# 8. Progressive Disclosure — CANONICAL

```text
Level 1 — 普通に遊ぶ
  5 public club axes
  baseball decisions

Level 2 — 必要な理由を見る
  補強予算 / 人件費余裕 / 財政状態
  recruitment / player / roster detail

Level 3 — Simulationを検証する
  revenue / debt / structural capital
  evidence / uncertainty / audit data
```

Level 2 / 3を一度も開かなくても通常Gameplay上不利にならない。

---
# 9. AI Handles Club Survival — NOT USER BASEBALL OVERRIDE

ユーザーが監督 / GMとして遊ぶ場合でも、Clubそのものの存続経営はBoard AIが担当する。

例えば:

```text
revenue falls
debt rises
        ↓
Board AI
        ↓
budget reduction
player sales pressure
contract approval becomes stricter
```

ユーザーへは:

> 今季は財政上、大型補強が難しい

とだけ伝えてもよい。

Board AIはbudget / approval / availability等の**制約**を作れるが、Userが選択可能な合法Baseball Actionを勝手に別Actionへ変更しない。

---

# 10. User Cannot Prevent Every Structural Consequence

経営詳細を操作できない代わりに、ユーザーが全てを完全制御できる設計にもならない。

例:

- Owner changes
- Board tightens budget
- Stadium renovation happens
- Commercial revenue falls
- Sponsor loss
- League financial rule changes

等はWorld Eventとして発生可能。

ユーザーはその結果として与えられた野球上の条件へ対応する。

---

# 10.1 User Plays Baseball; Mood / Relationships Happen Underneath

38のCanonical ruleをゲーム全体UX原則へ昇格する。

User向けに以下の専用maintenance loopを作らない。
- team meeting
- pep talk / encourage
- one-on-one relationship maintenance
- role-explanation chore
- gift / social spam
- mood improvement button
- weekly relationship task

実際のBaseball Action――起用、ベンチ、昇降格、休養、Role変更、Development方針等――がWorld EventとしてPlayerに観測され、Background Appraisal / Relationship / Moodへ影響する。

```text
Baseball Decision
 -> actual world consequence
 -> appraisal / relationship / mood
```

逆方向の `Mood UI -> magic correction` は作らない。

---
# 11. Baseball Decisions Remain Meaningful

内部自動化がユーザーの野球判断を奪わない。

ユーザーが決める主要部分:

```text
誰を使うか
誰を獲るか
誰を放出するか
誰を育てるか
どう戦うか
いつ休ませるか
どの投手をどこへ当てるか
```

ゲームの主役は経営会計ではなくBaseball Decision。

---

# 11.1 Development / Scouting Surface Boundary

Developmentは:
- Priority Development
- assignment / promotion / demotion
- actual playing opportunity
- simple emphasis / role choice

等のBaseball decisionまでUser Surfaceへ出す。

日ごとのtraining minute配分等のMicromanagementを要求しない。

Scoutingは:
- player / region scouting request
- prospect shortlist
- acquisition candidate selection

等をSurfaceへ出し、Scout skill / coverage / evidence / uncertainty / bias / projection計算はBackgroundへ置く。

詳細は32 / 31をSource of Truthとする。

---
# 12. Club AI Uses Same Rules

CPU Clubも、ユーザーClubと同じ経済制約の上で動く。

```text
Club Economy
 -> Board Budget
 -> GM / Manager decisions
 -> Roster
 -> Match Core
```

CPUだけ無限資金にしない。

CPUだけWorld Truth・hidden budget・hidden player abilityを読める特権も与えない。AgentごとのCanonical information boundaryに従う。

ただしDifficulty設定で意思決定品質を変える場合も、隠し能力Buffではなく:

- scouting quality
- decision quality
- planning horizon

等へ作用させる。

---

# 13. Strong Clubs Stay Strong Without User Complexity

Real / Bayern / PSG等の巨大Clubが強い理由は16 / 18 / 19のBackground Simulationで因果的に計算する。

通常画面では5軸だけでよい。

```text
資金力      S
人気        S
育成        A
スカウト    A
球場・設備  A
```

必要な時だけOffseason / Detailで補強予算・人件費余裕・財政状態を提示する。

Structural Capital等の内部値をユーザーに操作させない。

---
# 14. Rivalry Also Uses Simple Surface

User表示はreadable summaryだけ。

```text
vs Rival Club
因縁: 強
注目度: 高
```

内部Rivalry Lifecycleは33をSource of Truthとし、Historical Memory / Emergent Memory / Current Competitive Threat等をUserが手動調整しない。

Rivalryから直接能力Buffを与えない。

---
# 15. Manager Tactical Depth / Delegation Surface

Human Control Overlayは32 / 49をSource of Truthとする。

```text
HUMAN_OVERRIDE
 -> legal User decision executes exactly

MANAGER_DELEGATED
 -> Manager Agent decides
```

Policy shortcut例:

```text
ローテ方針
○ 通常
○ 重要戦優先
○ 休養優先
○ 手動
```

これは新しいAbility Buffではなく、Userが毎試合入力する量を減らすDelegation / Policy Interface。

Userが当日手動指定した合法ActionはPolicy shortcutより優先する。

---
# 16. Simulation Complexity Budget

新システムを追加するときは必ず二つを分ける。

```text
Does simulation need this?
Does player need to control this?
```

前者がYes、後者がNoならBackground Simulationへ置く。

「現実に存在するから」という理由だけで操作項目を増やさない。

---

# 16.1 Notification Budget — CANONICAL

Deep Simulationの内部変化をすべて通知しない。

User通知は原則:
- Baseball上Actionable
- significant state change
- upcoming meaningful deadline / decision

のいずれかへ絞る。

例:
- 主力Player injury
- Market Deadline approaching
- prospect recommended for promotion
- offseason budget changed materially

非推奨:
- tiny relationship delta
- minor commercial fluctuation
- hidden state tick
- routine background bookkeeping

---
# 17. Feature Admission Gate — CANONICAL

新しいUser操作を追加する前に必ず確認する。

```text
1. これはBaseball Decisionか？
2. User自身が決めることが楽しいか？
3. 結果を理解できるか？
4. 既存操作では表現できないか？
5. Background Simulation / Delegationで十分ではないか？
```

さらに新Systemごとに:

```text
Does simulation need this?
Does player need to control this?
```

を別判定する。

`Simulation = Yes / User Control = No` ならBackgroundへ置く。

「現実に存在するから」という理由だけでButton / Menu / Daily Taskを増やさない。

このGateは将来機能にも適用する恒久Product Rule。

---
# 18. Final Approved Decisions — v1

1. `一見シンプルだが、奥深い。` を最上位Product / UX Principleとして固定する。
2. Simulation depthとUser control depthを分離する。
3. User操作はRoster / Lineup / Pitching / Defense / Usage / Market / Recruitment / Development priority / Staff等のBaseball Decision中心。
4. 財務・商業・借入・Sponsor・Infrastructure accounting等はBackground Simulation。
5. 通常Club Surfaceは `資金力 / 人気 / 育成 / スカウト / 球場・設備` の5軸だけ。
6. `補強予算 / 人件費余裕 / 財政状態` はDetail / Offseason Brief。さらに深い財務はOptional Audit。
7. Detail / Audit Viewを一度も開かなくても通常Gameplayで不利にならない。
8. User plays baseball; Mood / Relationships happen underneath。専用Social chore UIを作らない。
9. DevelopmentはPriority / Assignment / Usage / simple emphasisまで。training Micromanagementを要求しない。
10. ScoutingはRequest / Shortlist等をSurfaceとし、Evidence / uncertainty / bias計算はBackground。
11. HUMAN_OVERRIDEの合法User DecisionをManager / Board AIが勝手に別Decisionへ変更しない。
12. Background Simulationはbudget / injury / registration / contract等を通じてlegal action spaceを制約できる。
13. Delegation / Policy presetは操作を省略するInterfaceでありAbility Buffではない。
14. CPU Clubも同じWorld / Economy / Baseball rulesと情報境界を使う。
15. NotificationはActionableまたは重大な状態変化へ絞る。
16. 新User操作はFeature Admission Gateを通す。
17. Internal Simulation complexityはUI complexityを増やす理由にならない。

---

# 19. Final v1 Status

**Simple Surface, Deep Simulation v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

この文書はKneekura Mini Baseball全体のUser Surface / Background Simulation境界に対するTop-level Product Rule。

旧末尾にあった `32 / 34 = USER REVIEW REQUIRED` 等のstatus pointerはobsolete。各Canonical文書の現在Statusを優先する。