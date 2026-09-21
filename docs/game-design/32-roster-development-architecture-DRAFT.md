# Roster / Reserve / Farm / Academy Architecture — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> **FILENAME LEGACY NOTE**  
> ファイルパスの `-DRAFT` は履歴上残っているだけ。この文書は未確定Draftではない。Roster / Development Architecture v1のSource of Truthとして扱う。

関連:
- `docs/game-design/00-current-design-handoff.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/31-scouting-recruitment-system.md`

---

# 1. 目的

Club側へ:

- first team
- active roster
- reserve / second team
- farm
- development players
- academy
- loan
- rehabilitation

を接続する。

目標:

> 表面では一般的な野球ゲームの「一軍 / 二軍 / 育成 / 若手」程度に見える。
> 内部では、実際の出場機会・指導・設備・契約・競争・スカウト情報によって選手Careerが動く。

---

# 2. 絶対原則 — Playerは一人だけ存在する

Roster / League / AssignmentごとにPlayer copyを作らない。

```text
Global Player Person
      ↓
Club Rights
      ↓
Registration
      ↓
Assignment
      ↓
Availability
```

Playerのtrue stateは一つ。

```ts
type PlayerClubState = {
  playerId: PlayerId;
  clubRights: ClubPlayerRights;
  contractId?: ContractId;
  registration: PlayerRegistrationState;
  assignment: PlayerAssignment;
  availability: PlayerAvailabilityState;
};
```

一軍へ上げても二軍へ落としても、LoanしてもRehabへ入っても同一Player。

`Rights`、`Registration`、`Assignment`、`Availability` は別責務とする。

---

# 3. Canonical Assignment Kinds — 5種類の意味、5個の固定箱ではない

共通Coreは、配置の意味を次の5種類へ整理する。

```text
FIRST_TEAM
RESERVE
DEVELOPMENT
ACADEMY
EXTERNAL
```

ただし、これは「Clubに最大5個のRoster箱がある」という意味ではない。

一つのClub / Leagueが同じKindのAssignment Unitを複数持てる。

例:

```text
DEVELOPMENT
 ├─ Level A
 ├─ Level B
 └─ Level C
```

Canonical概念例:

```ts
type AssignmentUnit = {
  unitId: AssignmentUnitId;
  kind: "FIRST_TEAM" | "RESERVE" | "DEVELOPMENT" | "ACADEMY" | "EXTERNAL";
  competitionId?: CompetitionId;
  developmentLevel?: number;
};

type PlayerAssignment = {
  unitId: AssignmentUnitId;
  assignedClubId: ClubId;
};
```

これにより、North America型の複数Farm階層、二軍、B Team、Academy、Loan先などを同じ境界で扱う。

Leagueごとに存在しないKindがあってよい。

---

# 4. FIRST TEAM

トップチーム。

First Team内の出場可否や登録状態を、Assignment階層と混同しない。

```text
Assignment = FIRST_TEAM
Registration = active / inactive / competition-specific eligibility
Availability = healthy / injured / rehab / other
```

User-facingでは基本:

```text
一軍
控え
故障
```

程度でよい。

Active人数等のexact limitは `LeagueRosterProfile` の年度別規定として与える。

---

# 5. RESERVE / SECOND TEAM

Professional contractを持つが、一軍Activeではない選手の主要配置先。

役割:

- regular playing time
- readiness maintenance
- first-team depth
- injury return
- young player development
- fringe player evaluation

二軍に置くだけでXPが増える設計は禁止。

```text
actual practice
+ actual reserve-game repetitions
+ coaching
+ health
+ competition
+ player learning
       ↓
development evidence
```

Reserve / Second Teamは「成績を抽選する育成箱」ではない。

公式戦が存在するLeagueでは実際にSeasonを戦ち、勝敗・順位・個人成績を残す。

---

# 6. DEVELOPMENT / FARM

League / Club CultureによりReserveと別組織を持てる。

主に:

- lower-level professional prospects
- physically immature prospects
- role conversion
- long-term projects
- recently acquired raw players

を置く。

```text
Reserve = first-team-adjacent
Development / Farm = longer-term professional development
```

Development / Farmは複数Levelを持てる。

```text
DEVELOPMENT Level 1
DEVELOPMENT Level 2
DEVELOPMENT Level 3
...
```

Level数や名称を世界共通で固定しない。League Profileが実際の育成構造を定義する。

---

# 7. ACADEMY / REGIONAL PRE-PRO PATHWAY

Academyは世界共通の新人生成方式ではない。

地域ごとに実際のProfessional Intake経路を表現する。

```text
World / Regional Talent Population
        ↓
regional pre-pro pathway
        ↓
scouting / recruitment / eligibility
        ↓
Tracked Prospect
        ↓
professional intake mechanism
        ↓
Global Player Person
```

Academyを持つ地域では:

```text
regional youth population
        ↓
academy recruitment reach
+ scouting
+ club attraction
+ local eligibility
        ↓
academy intake
        ↓
coaching / competition / facilities
        ↓
professional contract candidate
```

とする。

日本型ではAcademyを無理に中心へ置かず、高校・大学・社会人等の経路からDraft / 契約へ接続する。

重要:

- `academyQuality -> star generated`は禁止
- `高校卒 -> 成長Buff`は禁止
- `大学卒 -> 即戦力Buff`は禁止
- 出身経路は、その時点までに得た年齢・身体成熟・実戦経験・指導履歴・観測Evidence・Projection uncertaintyへ反映する
- 若い選手は成長余地が大きい場合がある一方、指導・負荷・役割・健康・環境によってCareerが大きく分岐し得る
- 大学・社会人等で多くの競技Evidenceを持つ選手は、現在能力を比較的評価しやすく即戦力になり得るが、Label自体が能力を与えない

世界中の未成年全員をPlayer Personとして常時保存する必要はない。
候補として具体化・追跡される段階でGlobal Player Personへ昇格させる。

---

# 8. EXTERNAL ASSIGNMENT

代表例:

```text
LOAN_OUT
LOAN_IN
TEMPORARY_REGISTRATION
AFFILIATE_ASSIGNMENT
```

Football-derived LeagueではLoanを重要なdevelopment routeにできる。

Baseball-derived LeagueでもLeague Profileが許可する場合のみ使用する。

Loan先での:

- actual playing time
- coaching
- competition level
- role
- adaptation

が成長へ作用する。

`Loan = development +X`は禁止。

既にProfessional Playerである者を別Clubへ再配置する制度は、Amateur / Youth Intakeとは別のTransaction Pathとして扱う。

---

# 9. League Roster / Development Profile

世界中を同じ二軍・Farm・Academy制度にしない。

```ts
type LeagueRosterProfile = {
  profileSeason: number;
  assignmentUnits: readonly AssignmentUnitDefinition[];
  intakePathways: readonly IntakePathwayDefinition[];
  transactionPathways: readonly TransactionPathwayDefinition[];

  rosterRules: RosterRuleSet;
  registrationRules: RegistrationRuleSet;
  eligibilityRules: EligibilityRuleSet;

  allowsLoans: boolean;
  usesDevelopmentContracts: boolean;
};
```

Canonical policy:

1. **実在する本格的な野球Leagueがある地域**  
   その年度の実際のRoster / Registration / Draft / Development / Transaction制度を第一参照にする。
2. **対応する実在野球Leagueがない地域**  
   World Default Profileを基礎にし、地域のClub文化に沿った小さな特徴を与える。
3. 規定値はLeague名による能力Buffではない。
4. Career開始時のRule/Profile versionをSaveへ保存し、現実世界の翌年変更で既存Saveを勝手に書き換えない。

exact人数・年数・Quota等は、各Profile作成時に公式規定を調査して校正する。

---

# 10. Canonical Regional Pathway Families

## Japan / NPB-like

Conceptual pathway:

```text
High School ─┐
University ──┼→ Amateur / Draft Eligibility → Professional Draft / Contract
Company /    │
Industrial ──┘
```

高校・大学・社会人等を同じ「新人生成箱」に潰さない。

それぞれ、それまでの:

- age
- physical maturation
- game experience
- coaching history
- role history
- competition evidence
- scouting confidence
- future projection uncertainty

が異なる。

既存Professional Playerを対象とする再配置制度（例: 現役選手向けDraft型制度）は新人Intakeではなく、Club間Transaction Pathとして扱う。

## North America-like

```text
High School / College / Other Amateur
        ↓
Draft / International Intake
        ↓
Professional Rights
        ↓
multi-level Development / Farm
        ↓
First Team
```

Farm階層を複数Assignment Unitとして表現できる。

## Football-derived baseball world

```text
Regional Youth Population
        ↓
Academy / B Team
        ↓
Professional Contract
        ↔
Loan / Transfer
        ↓
First Team
```

Academy・Loanを重要経路にできるが、TalentそのものをClubが魔法生成しない。

## Other regions

可能な限り現実のBaseball / Amateur / Club recruitment文化を調査してProfile化する。
十分な実在制度がない場合のみWorld Defaultを使う。

---

# 11. Club RightsとAssignmentを分ける

重要:

```text
Who owns / controls rights?
```

と:

```text
Where is player currently playing?
```

を別データにする。

例:

```text
Club A owns contract
Player is loaned to Club B

rightsHolder = Club A
assignment = Club B
```

これによりLoanやRehabを自然に扱える。

---

# 12. RegistrationとRosterを分ける

PlayerがClub契約下でも、全Competitionへ自動出場可能とは限らない。

```text
Contract
 != Domestic Registration
 != Continental Registration
 != Match Active Roster
```

CompetitionごとにEligibilityを判定する。

Season Event設計のPostseason Eligibility Cutoffとも接続する。

---

# 13. Development is Opportunity-dependent

選手成長は「年齢曲線だけ」でも「施設Buffだけ」でもない。

候補:

```text
underlying learning potential
+ physical maturation
+ coaching fit
+ training stimulus
+ game repetitions
+ competition challenge
+ health / fatigue
+ role stability
+ motivation / psychology
        ↓
actual adaptation
```

成長量を直接Club Development Ratingから与えない。

---

# 14. Playing Time Matters

若手を良いClubに置くだけでは育たない。

```text
elite first team
but no playing time
 -> limited game-learning evidence
```

```text
weaker reserve / loan club
but regular meaningful role
 -> potentially better development route
```

があり得る。

これによりLoan、二軍、昇格タイミングに意味を持たせる。

---

# 15. Competition Level is not direct XP

高いCompetition Levelでプレーしたから自動的に大量成長、は禁止。

正しくは:

```text
difficulty of task
vs
current player capability
+ successful / failed repetitions
+ coaching feedback
+ adaptation
```

で学習機会が変わる。

レベルが高すぎて全く対応できない場合、必ずしも最適成長環境ではない。

---

# 16. Player Knowledge Inside Own Club

自Club選手についてはScoutより高い観測量を持つ。

理由:

- daily practice
- medical data
- coaching observations
- reserve games
- training data

ただしFuture Potentialを完全には知らない。

```text
Own Player
 -> present ability confidence high
 -> future projection still uncertain
```

CPUも同様。

自軍だからHidden Future Truthを直接読めるわけではない。

---

# 17. Promotion / Demotion Decision

CPU Clubは:

```text
current knowledge
+ roster need
+ player readiness estimate
+ development objective
+ contract / registration
+ manager trust
+ playing-time availability
```

から昇降格を決める。

Hidden true potentialで決めない。

---

# 18. Human Control Overlay — ユーザー監督と元監督を両立する

PennantのUserは、操作ClubのManager Agentを削除・置換しない。

内部では元のManager Agentが常に存在する。

```text
Canonical Manager Agent
        ↓
Manager Decision Engine
        ↓
Human Control Overlay
```

各Decision DomainごとにOriginを分ける。

```ts
type DecisionOrigin =
  | "MANAGER_AUTONOMOUS"
  | "MANAGER_DELEGATED"
  | "HUMAN_OVERRIDE";
```

- Userが明示的に操作した判断 → `HUMAN_OVERRIDE`
- Userがおまかせした判断 → `MANAGER_DELEGATED`
- 非操作Club → `MANAGER_AUTONOMOUS`

`MANAGER_DELEGATED` は元監督のSkill / Philosophy / Temperament / Belief / Strategy Memoryで、他のCPU Clubと同じManager Architectureから判断する。

Userは全部を操作する必要はない。

例:

```text
Lineup = HUMAN_OVERRIDE
Bullpen = MANAGER_DELEGATED
Promotion / Demotion = MANAGER_DELEGATED
In-game command = HUMAN_OVERRIDE
```

操作Clubを変更した場合、前のClubは元監督の表示名・AI制御へ戻る。
元監督は内部では最初から消えていない。

### Strategy Memory attribution rule

**HUMAN_OVERRIDEの采配を、元監督自身が選択・実験したStrategyとしてStrategy Memoryへ学習させない。**

```text
Human chooses bunt 100 times
 != original manager becomes a bunt believer
```

試合結果そのものはWorld Evidenceとして観測可能だが、元監督の「自分が選んだStrategy Evidence」へ偽装しない。

これによりUserが別Clubへ移動した後も、元監督本来の野球観と学習履歴を維持できる。

---

# 19. Simple Development UI

例:

```text
山田 太郎  19歳  SS

所属        二軍
将来期待    A?
現在評価    C
出場機会    多
育成環境    A
状態        順調

[一軍昇格]
[重点育成]
[詳細]
```

`A?` はKnowledge Estimate。

True Potentialを表示しない。

---

# 20. Priority Development — 固定枠ではなく有限Attention

Userは:

```text
重点育成
```

を指定できる。

ただし、ゲーム共通の「重点育成3枠」のようなHard SlotをSource of Truthにしない。

実際の指導密度は:

```text
Coaching Staff Capacity
+ Facilities
+ Coach specialties
+ Existing priority players
+ Player needs
+ Player receptiveness
        ↓
available coaching attention
        ↓
actual training / evaluation opportunity
```

から決まる。

Priorityは能力Buffではない。

```text
priority
 -> attention allocation
 -> tailored practice / evaluation
 -> actual adaptation if successful
```

重点指定を増やしすぎれば、一人あたりのAttentionが薄くなることもある。

---

# 21. Depth Chart

一軍編成とReserve育成をつなぐ中心UI候補。

```text
C
  Starter
  Backup
  Reserve Prospect

1B
  Starter
  Backup
  Reserve Prospect

SP
  Rotation 1–5
  Depth 1–...
```

CPUもDepth Chartを持つ。

これが:

- promotion
- recruitment need
- trade expendability
- loan decision

の入力になる。

---

# 22. Roster Need

```ts
type RosterNeed = {
  positionGroup: PositionGroup;
  horizon: "NOW" | "NEXT_SEASON" | "LONG_TERM";
  urgency: number;
  requiredRole: PlayerRole;
};
```

Scout Systemへ接続。

例:

```text
starting catcher aging
        ↓
NEXT_SEASON Catcher Need rises
        ↓
Scouting Director prioritizes catcher reports
```

---

# 23. Prospect Blocking

巨大Clubが無限に若手を抱え込んでも無害、にはしない。

自然な制約:

- roster / registration capacity
- payroll / contract cost
- playing-time shortage
- player dissatisfaction
- contract expiration
- transfer / loan demand
- competing Club offers

によってTalentが流動する。

Hidden anti-hoarding penaltyは置かない。

---

# 24. Reserve / Farm / Academy Games — 同じCanonical Baseball

公式競技として行われる一軍・二軍・Farm・Academy等の試合について、**結果だけを作る別エンジンを作らない。**

原則:

```text
First Team ───────┐
Reserve / Second ─┤
Farm / Development├→ SAME CANONICAL MATCH CORE
Academy competition┘
```

同じ:

- baseball rules
- pitching
- batting
- fielding
- baserunning
- manager / player decision boundary
- physical / causal outcome chain

から試合を進める。

軽量化するのはBaseball TruthではなくExecution / Persistence / Presentation。

```text
First Team
 -> Canonical Match Core
 -> normal Presentation / replay policy

Reserve / Farm / Academy
 -> same Canonical Match Core
 -> Renderer OFF by default
 -> accelerated execution
 -> reduced replay/detail persistence where safe
```

保存する:

- actual games played
- standings
- team wins / losses
- PA / AB / H / HR / etc.
- IP / pitching outcomes
- fielding evidence
- role / usage
- fatigue / health evidence
- player season/career statistics

禁止:

```text
no match happened
 -> random batting average generated
```

二軍戦を重視するUserは成績・順位・選手の実際の出場履歴を追える。

---

# 25. Injuries / Rehab — Assignmentとは別のAvailability

怪我やRehabをRoster階層そのものにしない。

```text
Rights
Registration
Assignment
Availability
```

を分離する。

例:

```text
rightsHolder = Club A
assignment = Reserve
availability = REHAB
firstTeamRegistration = inactive
```

怪我中Playerの復帰をinstant resetにしない。

```text
medical recovery
 -> rehab training
 -> rehab games
 -> readiness
 -> first-team return
```

Rehab中にReserve gameへ参加しても、Player identityやClub Rightsは変わらない。

医療設備は回復を魔法で加速するのではなく、診断・rehab quality・再発管理等へ接続する。

---

# 26. Pre-Pro → Professional Transition

Academyだけを卒業経路としない。

地域Profileに応じて:

```text
High School
University
Company / Industrial
Academy
Other Amateur / Development Path
        ↓
evaluation / eligibility
        ↓
draft / offer / contract / other legal intake
        ↓
Professional Rights
        ↓
Reserve / Development / First Team
```

へ進む。

PlayerがProfessional入りできなければ:

- amateur / school / company path継続
- another club / league
- lower competition
- career exit

等へ進み得る。

入団経路Label自体が成長率や即戦力性を直接変更しない。

---

# 27. CPU Club Roster Building

CPUの年間流れ候補:

```text
Season review
 -> Depth Chart
 -> Roster Needs
 -> contract decisions
 -> scouting targets
 -> draft / transfer / FA
 -> assignment plan
 -> active roster
 -> in-season adjustment
```

全てClub Knowledgeを使う。

---

# 28. Club Philosophy Connection

Club PhilosophyはRoster BuildingのPreference。

例:

```text
Youth-oriented
 -> prospect opportunity threshold lower

Veteran-oriented
 -> experienced replacement preferred

Selling club
 -> develop + sell cycle more likely

Win-now
 -> immediate role value prioritized
```

直接能力補正は禁止。

---

# 29. Economy Connection

Board AIが:

```text
player payroll budget
development budget
academy budget
staff budget
```

を与える。

GM / Sporting sideがその制約内でRosterを作る。

ユーザーは細かい会計配分をしない。

---

# 30. Frozen Architecture vs Deferred League Calibration

v1で構造はFreezeする。

以下のexact値は、設計未確定ではなく**League Profile / implementation calibration**として後続で決める。

- exact active roster人数
- exact total contracted player limit
- reserve roster人数
- academy年齢帯
- development-contract人数
- option / waiver細則
- service time
- FA年数
- draft eligibility
- foreign-player quota
- homegrown quota
- loan人数
- reserve / farm schedule試合数
- exact growth formula
- exact training menu
- exact promotion AI thresholds

方針:

- 実在野球League → 対象年度の公式制度を第一参照
- 実在Leagueがない / football-derived世界 → World Default + modest regional identity
- Profile値はSaveへversion固定
- 数値をLeague strength Buffへ流用しない

---

# 31. Final Approved Decisions — 2026-09-22

User承認済み。

1. Player Personは世界に一人だけ存在する。
2. Rights / Registration / Assignment / Availabilityを分離する。
3. Five Assignment Kindsは採用するが、5個の固定Roster箱にはしない。
4. DEVELOPMENT等は複数Assignment Unit / Levelを持てる。
5. Leagueごとに不要なKindや独自の育成UnitをProfile化する。
6. Injury / RehabはRoster階層ではなくAvailability / RegistrationとAssignmentの組み合わせで表す。
7. Developmentはactual opportunity / coaching / environment / adaptationから因果的に発生する。
8. 二軍・Farm等の公式戦も一軍と同じCanonical Match Coreで実際に試合を行う。
9. 軽量化はRenderer OFF / 高速実行 / 保存密度で行い、別の結果抽選エンジンを作らない。
10. 二軍等も順位・勝敗・個人成績・出場履歴を保持する。
11. Academyを世界共通のTalent生成装置にしない。
12. 地域ごとの実際のPre-Pro / Draft / Academy / Transfer経路を再現する。
13. 日本型では高校・大学・社会人等をProfile上の別経路として扱える。
14. Professional Player再配置制度は新人Intakeとは別のTransaction Pathにする。
15. 出身経路Labelによる直接成長Buff / 即戦力Buffは禁止する。
16. 若さ、成熟、実戦経験、指導履歴、観測Evidence等が結果として成長余地・即戦力性・評価確度へ影響する。
17. 重点育成は固定人数枠ではなく有限Coaching Attentionを割り当てる。
18. Depth Chart / Roster Needを昇降格・補強・Loan・Scoutingへ接続する。
19. Prospect hoardingへHidden penaltyを置かず、出場機会・契約・不満・競争・移籍需要から自然に流動させる。
20. Pennant UserはManager Agentを消さずHuman Control Overlayで上書きする。
21. UserがおまかせしたDomainは元監督の能力・思想・性格・BeliefからAI判断する。
22. 操作Clubを変えたら前Clubは元監督の表示・自律制御へ戻る。
23. HUMAN_OVERRIDEの采配を元監督自身のStrategy Memoryへ「自分が選んだ戦術」として学習させない。
24. 実在野球Leagueは年度ごとの実規定を第一参照にRoster / Intake Profileを作る。
25. 実在野球Leagueがない地域はWorld Defaultを基礎に、過剰にならない地域差を与える。

---

# 32. Final v1 Summary — DESIGN FROZEN

Canonical structure:

```text
WORLD / REGIONAL TALENT POPULATION
              ↓
      PRE-PRO PATHWAY
  school / university / company
  academy / other amateur paths
              ↓
      PROFESSIONAL INTAKE
              ↓
      GLOBAL PLAYER PERSON
              ↓
          CLUB RIGHTS
              ↓
        REGISTRATION
              ↓
     ASSIGNMENT UNIT
      ├ FIRST_TEAM
      ├ RESERVE
      ├ DEVELOPMENT (0..N levels)
      ├ ACADEMY (where applicable)
      └ EXTERNAL
              │
              └ AVAILABILITY
                  healthy / injured / rehab / ...
```

Development:

```text
actual opportunity
+ coaching attention
+ competition evidence
+ physical maturation
+ health / fatigue
+ role
+ environment
+ player adaptation
        ↓
career development
```

Match truth:

```text
First Team / Reserve / Farm / Academy official games
        ↓
SAME CANONICAL MATCH CORE
        ↓
different presentation / execution / persistence policy only
```

Pennant control:

```text
Original Manager Agent remains alive
        ↓
Human Control Overlay
   ├ HUMAN_OVERRIDE
   └ MANAGER_DELEGATED
```

`HUMAN_OVERRIDE` is never falsely written into the original Manager's Strategy Memory as self-chosen strategy evidence.

**Roster / Development Architecture v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**
残るexact人数・年度規則・式はLeague Profile / implementation calibrationであり、open architecture questionではない。

---