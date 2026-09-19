# Simple Surface, Deep Simulation

更新日: 2026-09-20  
状態: **設計承認候補版。ゲーム全体UX原則。実装前。**

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

# 3. User-controllable Baseball Actions

初期標準でユーザーが直接操作可能なのは、一般的な野球ゲームの範囲。

## Roster / Team

- active roster入替
- reserve / farm昇降格
- starting lineup
- batting order
- defensive position
- bench assignment
- pitching rotation
- bullpen role
- closer / setup assignment
- player rest

## Match Management

- starter selection
- pinch hitter
- pinch runner
- defensive substitution
- pitching change
- steal / bunt / hit-and-run等の戦術
- intentional walk
- defensive positioning
- challenge / replay decision where rules permit

## Player Market

- trade
- free-agent acquisition
- transfer / loan where League permits
- release
- contract renewal
- posting / sale where League permits

## Talent Acquisition

- draft
- scouting request
- trial
- academy / youth promotion
- prospect shortlist

## Staff

- manager / coach hiring and replacement
- scouting staff assignment
- simple development emphasis

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

ユーザーは経済を「操作する」のではなく、「結果として感じる」。

例:

```text
Club A
Available Player Budget: ¥ / € / $
Wage Room: low
Transfer Room: medium

Club B
Available Player Budget: very high
Wage Room: high
Transfer Room: very high
```

ユーザーに必要なのは:

> この選手を獲れるか？

であり、

> このClubのEBITDA Marginをどう最適化するか？

ではない。

---

# 6. Board / Owner AI

複雑な経営はClub AI / Board AIへ委譲する。

概念:

```ts
type BoardDecisionOutput = {
  payrollBudget: Money;
  acquisitionBudget: Money;
  developmentBudgetBand: BudgetBand;
  staffBudgetBand: BudgetBand;
  financialRestrictionFlags: readonly FinancialRestriction[];
};
```

ユーザーへ返すのは結果だけ。

例:

```text
今季の補強予算: €42m
人件費残枠: €8m
大型契約: 要承認
財政状態: 安定
```

裏では19のStructural Capital / Revenue / Debt等から算出する。

---

# 7. No Spreadsheet Management Requirement

ゲーム進行のために、

- 損益計算書を読む
- 資金繰り表を作る
- 借入金利を比較する
- スポンサー契約を何十件も処理する

ことを要求しない。

詳細財務画面を将来追加する場合も、原則**閲覧用**。

興味のあるユーザーは:

> なぜPSGはこんなに補強できるのか

を確認できる。

しかし理解しなくても普通に遊べる。

---

# 8. Progressive Disclosure

情報は必要な深さだけ見せる。

## Level 1 — 普通のプレー

```text
補強予算: 大
人件費余裕: 中
球団人気: S
育成環境: A
```

## Level 2 — 詳細を見る

```text
年間収入
人件費
移籍収支
現金
負債
アカデミー
スカウト
```

## Level 3 — 検証 / Hardcore View

```text
structural revenue base
supporter capital
commercial network
financing access
rolling revenue
debt-service burden
```

Level 3を理解しなくてもGameplayに支障はない。

---

# 9. AI Handles Club Survival

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

ただしDifficulty設定で意思決定品質を変える場合も、隠し能力Buffではなく:

- scouting quality
- decision quality
- planning horizon

等へ作用させる。

---

# 13. Strong Clubs Stay Strong Without User Complexity

Real / Bayern / PSG等が強い理由は裏で計算される。

ユーザー画面では例えば:

```text
FC Bayern München

資金力      S
人気        S
育成        A
スカウト    A
人件費余裕  S
```

程度でも十分。

裏では:

- structural revenue base
- supporter capital
- commercial contracts
- financing access
- historic brand
- stadium income
- ownership structure

が動いている。

---

# 14. Rivalry Also Uses Simple Surface

ユーザー表示:

```text
vs Bayern
因縁: 強
注目度: 高
```

内部:

```text
historicalBase
competitiveThreat
recentHistory
fanExpectation
player identification
        ↓
PersonalStake
        ↓
Appraisal
```

ユーザーはRivalry intensityを手動調整しない。

---

# 15. Manager Tactical Depth is Optional Surface

将来の:

- 捨て試合
- エースを強豪へ当てる
- 包囲網
- 直接対決優先

等も、最終的には簡単な選択肢へ落とす。

例:

```text
ローテ方針:
○ 通常
○ 重要戦優先
○ 休養優先
○ 手動
```

内部ではOpponentPrioritySignalを使って複雑に判断してよい。

ユーザーに数式を入力させない。

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

# 17. Feature Admission Rule

新しい経営機能をユーザー操作として追加するには、少なくとも次のどれかを満たす必要がある。

- 明確なBaseball decisionになる
- 一般的な野球ゲームで理解しやすい
- 選択結果が短時間で把握できる
- 既存操作では表現できない重要な判断である

満たさない場合はBackground AIへ委譲する。

---

# 18. 今回確定する事項

1. スローガンは「一見シンプルだが、奥深い」
2. Simulation depthとUser control depthを分離する
3. 財務・商業・借入等は背景Simulation
4. Userは一般的な野球ゲーム範囲の操作へ集中する
5. Economyは主に予算・制約として表面化する
6. Board / Owner AIがDetailed Managementを担当する
7. 詳細財務は原則閲覧用
8. Progressive Disclosureを使う
9. Rivalry / Structural Capital等の内部値を手動操作させない
10. CPU Clubも同じ経済ルールを使う
11. 新機能は「必要なSimulationか」と「Userが触る必要があるか」を別判定する
12. Baseball Decisionをゲームの主役にする


World club source / East Asia catalogs:
- `docs/game-design/21-world-club-source-policy.md`
- `docs/game-design/22-east-asia-club-catalog.md`


Club initial gameplay seeds:
- `docs/game-design/26-club-initial-seed-rating-model.md`
- `docs/game-design/27-asia-pacific-club-initial-seeds.md`
- `docs/game-design/28-americas-club-initial-seeds.md`
- `docs/game-design/29-europe-africa-club-initial-seeds.md`
- `docs/game-design/30-initial-directed-rivalry-graph.md`


Scouting / recruitment system:
- `docs/game-design/31-scouting-recruitment-system.md`


Unapproved roster / development draft (USER REVIEW REQUIRED):
- `docs/game-design/32-roster-development-architecture-DRAFT.md`


Team traits / player relationship design candidate (USER REVIEW REQUIRED):
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
