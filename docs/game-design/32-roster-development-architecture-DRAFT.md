# Roster / Reserve / Farm / Academy Architecture — DRAFT

更新日: 2026-09-20  
状態: **仮設計。USER REVIEW REQUIRED。未承認。実装禁止。**

> IMPORTANT:
> この文書はユーザー監修前のJolly draft。
> 将来この設計へ触れる際は、**実装・正史化・詳細化の前に必ずユーザーへ「この仮設計を採用してよいか」確認すること。**
> 無言でapproved扱いしてはいけない。

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

RosterごとにPlayer copyを作らない。

```text
Global Player Person
      ↓
Club Rights
      ↓
Current Assignment
```

Playerのtrue stateは一つ。

```ts
type PlayerClubState = {
  playerId: PlayerId;
  clubRights: ClubPlayerRights;
  contractId?: ContractId;
  registration: PlayerRegistrationState;
  assignment: PlayerAssignment;
};
```

一軍へ上げても二軍へ落としても同一Player。

---

# 3. Club Player Layers

共通Coreでは5層を候補とする。

```text
A. FIRST TEAM
B. RESERVE / SECOND TEAM
C. FARM / DEVELOPMENT
D. ACADEMY
E. EXTERNAL ASSIGNMENT
```

Leagueによって使わない層があってよい。

---

# 4. A — First Team

トップチーム。

内部ではさらに:

```text
FIRST_TEAM_ACTIVE
FIRST_TEAM_INACTIVE
INJURED_LIST
REHAB_ASSIGNMENT
```

等へ分けられる。

User-facingでは基本:

```text
一軍
控え
故障
```

程度でよい。

Active人数等のexact limitは**未決定**。

LeagueRosterProfileで後から定義する。

---

# 5. B — Reserve / Second Team

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
+ actual reserve-game opportunities
+ coaching
+ health
+ competition
+ player learning
       ↓
development evidence
```

Reserve gameはBackground Simulation可能。

---

# 6. C — Farm / Development

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
Farm / Development = longer-term professional development
```

が概念上の違い。

ただし全Leagueへ強制しない。

---

# 7. D — Academy

Academyは「毎年Talentを生成する装置」ではない。

正しい流れ候補:

```text
regional / global youth population
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
development
        ↓
professional contract candidate
```

`academyQuality 95 -> star generated`は禁止。

Academyが強いClubは:

- more playersを見つけやすい
- good prospectsを獲得しやすい
- better learning environmentを提供しやすい
- talentをprofessional levelへ移行させやすい

のであって、Talentそのものを魔法生成しない。

---

# 8. E — External Assignment

候補:

```text
LOAN_OUT
LOAN_IN
TEMPORARY_REGISTRATION
AFFILIATE_ASSIGNMENT
```

Football-derived LeagueではLoanを重要なdevelopment routeにできる。

Baseball-derived LeagueでもLeague Profileが許可する場合のみ使用。

Loan先での:

- actual playing time
- coaching
- competition level
- role
- adaptation

が成長へ作用する。

Loan = development +X ではない。

---

# 9. League Development Path Profile

世界中を同じ二軍制度にしない。

```ts
type LeagueDevelopmentPathProfile = {
  usesReserveTeam: boolean;
  usesFarmSystem: boolean;
  usesAcademy: boolean;
  allowsLoans: boolean;
  usesDraftPipeline: boolean;
  usesDevelopmentContracts: boolean;

  activeRosterLimit: number;           // TBD
  firstTeamRegistrationLimit: number;  // TBD
  reserveLimit?: number;               // TBD
  academyRegistrationRule?: AcademyRule;
};
```

exact人数はUSER REVIEW後に決める。

---

# 10. Initial Family Candidates — NOT APPROVED

以下は実装値ではなく、構造候補。

## Baseball-established profile

Japan / Korea / Taiwan等:

```text
First Team
   ↕
Second / Reserve Team
   ↕
Development / Young Players
```

Academy / amateur intakeは別Pipelineから接続。

## North America profile

```text
Major Roster
   ↕
Farm Organization
   ↕
Development Prospects
   ↕
Amateur / International Intake
```

Minor organization詳細を全てPlayable Full Leagueとして持つ必要はない。

Background hierarchyとして持てる。

## Football-derived profile

```text
First Team
   ↕
Reserve / B Team
   ↕
Academy
   ↔ Loan
```

Transfer Marketと強く接続。

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

# 18. User Surface

通常ユーザー操作候補:

- 一軍へ昇格
- 二軍 / Reserveへ降格
- 故障者登録
- Rehab assignment
- 若手を重点育成対象へ指定
- Loan / transfer candidate指定
- Academyから昇格候補を見る

これ以上の細かな日次配置はBackground AIへ委譲する。

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

# 20. Priority Development

Userが全員の練習表を管理しなくてよいよう、

```text
重点育成
```

の少数枠を候補とする。

ただし意味は能力Buffではない。

```text
priority
 -> more coaching attention
 -> tailored practice
 -> more evaluation
```

へ接続。

exact人数は未決定。

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

# 24. Reserve / Academy Games

すべての試合をFull Match Coreで重くSimulationする必要はない。

候補:

```text
First Team
 -> Full Match Core

Reserve / Farm / Academy
 -> lightweight causal simulation
 -> actual PA / IP / fielding / role / fatigue evidence retained
```

ただし「試合をしていないのに成績だけ抽選」は避ける。

必要なDevelopment Evidenceを生成できるSimulationにする。

---

# 25. Injuries and Rehab

怪我中Playerの復帰をinstant resetにしない。

```text
medical recovery
 -> rehab training
 -> rehab games
 -> readiness
 -> first-team return
```

Rehab assignmentでReserve gameへ参加可能。

医療設備は回復を魔法で加速するのではなく、診断・rehab quality・再発管理等へ接続する。

---

# 26. Academy Graduation

Academy Playerが一定年齢で自動一軍入り、にはしない。

候補:

```text
academy
 -> evaluation
 -> professional offer?
 -> accept?
 -> Development / Reserve
 -> eventual First Team
```

契約できなければ:

- another club
- amateur / lower league
- release

へ進み得る。

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

# 30. What is intentionally NOT decided

USER REVIEW前なので、以下は決めない。

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
- minor / reserve schedule試合数
- exact growth formula
- exact training menu
- exact promotion AI thresholds

この文書を理由に勝手に確定しない。

---

# 31. Proposed Approval Questions for User

将来この計画を再開したら、まずユーザーへ以下を確認する。

1. 共通5層 `First / Reserve / Farm / Academy / External` でよいか
2. Leagueごとに不要層を無効化する方式でよいか
3. User操作は昇降格・重点育成程度に抑えるか
4. Reserve / Academy試合をlightweight causal simulationにするか
5. 重点育成枠を採用するか
6. Football-derived ClubでLoanを重要Development Routeにするか
7. AcademyをYouth PopulationからのRecruitment Pipelineとして扱うか
8. exact roster countを現実League寄せにするか、ゲーム共通値を優先するか

---

# 32. Current Draft Conclusion

仮の骨格:

```text
WORLD PLAYER
    ↓
CLUB RIGHTS
    ↓
REGISTRATION
    ↓
ASSIGNMENT
 ┌───────────────┬──────────────┬─────────────┐
 FIRST TEAM      RESERVE        DEVELOPMENT
                                      ↕
                                   ACADEMY
                                      ↔
                                LOAN / EXTERNAL
```

Developmentは:

```text
actual opportunity
+ coaching
+ environment
+ player adaptation
```

から生じる。

**この骨格は未承認。User確認前に実装してはいけない。**
