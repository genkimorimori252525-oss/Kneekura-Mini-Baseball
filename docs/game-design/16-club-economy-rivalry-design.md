# Club Economy, Identity & Directed Rivalry Design — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> 本書はClub Economy / Identity / economic causalityの親設計。
> Club sourceの地域別決定は21、State lifecycleは18、Structural dominance / declineは19、initial gameplay seedは26–30、Rivalry lifecycleは33、Manager decisionは49をSource of Truthとする。

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/12-competition-identity-hosting.md`
- `docs/game-design/15-season-events-and-deadlines.md`
- `docs/game-design/17-europe-real-club-catalog.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/19-club-structural-dominance-and-decline.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`

---

# 1. 目的

球団の強さ・弱さ・歴史・因縁を、固定された「名門補正」や「強豪Buff」ではなく、

- money
- player acquisition
- retention
- staff
- facilities
- academy / farm
- scouting
- fanbase
- reputation
- history
- relationships

から因果的に発生させる。

特にFootball-inspired Leagueでは、現実のサッカー強豪に見られる「資金力による長期支配」を、能力補正ではなく経済状態で説明可能にする。

またClub Rivalryは**有向関係**として保持し、一方的なライバル視を正式に許可する。

---

# 1.1 Responsibility Boundary — CANONICAL

本書に残すSource of Truth:
- Club strength is causal, never a single hidden buff
- economy state and financial causality
- money -> acquisition / retention / staff / facilities / development opportunity
- economic power never directly modifies Match Core ability
- user-facing economy surface boundary
- rivalry is directional and never a direct ability buff
- encirclement is an observed result of independent decisions, never a debuff state

後継Canonicalへ委譲:
- League-by-League Club source policy -> `21-world-club-source-policy.md`
- Club L0-L4 state ownership / save lifecycle -> `18-club-state-lifecycle.md`
- giant persistence / decline / recovery capacity -> `19-club-structural-dominance-and-decline.md`
- simple user surface -> `20-simple-surface-deep-simulation.md`
- initial 5-axis seeds -> `26` through `30`
- Rivalry memory / historical floor / decay / dormancy / labels -> `33-rivalry-lifecycle-model.md`
- Manager opponent prioritization / resource allocation -> `49-manager-architecture-v1.md`

後継文書と矛盾する古い式・候補値は後継を優先する。

---
# 2. Club Source Policy — PRINCIPLE ONLY

球団の着想元を二系統に分ける。

**地域別の現在Source Matrix・Club数・explicit overrideは21を正とする。**

## 2.1 REAL_BASEBALL_CLUB

野球文化・既存のプロ野球クラブが十分に存在するLeagueでは、実在野球球団を基本とする。

初期対象:

- Japan
- Korea
- Taiwan
- North America
- Mexico
- Dominican
- Venezuela
- Puerto Rico
- Cuba
- Australia

ゲーム世界のClub数と実在League構成が一致しない場合だけ、追加Club / League再編を個別設計する。

## 2.2 REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB

野球が主要競技ではない地域では、実在Football Clubを**同名・同都市・同経済規模・同ブランド階層の野球Club**として使用する。

初期対象:

- Europe 7 leagues
- China
- West / South Asia
- Pan-African League
- New Zealand / Pacific

Europeでは「Bayern-like」「PSG-like」「Real-like」のような別名motifを作らず、原則として実在Club名そのものを使う。

例:

```text
FC Bayern München
Paris Saint-Germain
Real Madrid CF
FC Barcelona
Liverpool FC
Manchester United
Juventus
FC Internazionale Milano
```

### Private-project policy

本Projectは現時点で私的利用を前提としているため、設計データでは実在Club名をそのまま使用する。

将来配布・公開・商用化する場合だけ、名称・ロゴ・商標・ライセンスを別途見直す。

## 2.3 Economyも実在Clubをreference sourceにする

Football-inspired Clubの経済を架空の「Bayern型」数値で作らない。

```text
real football club financial snapshot
 -> baseball-world initial economy seed
```

を原則とする。

可能なら以下をsnapshotとして保存する。

- annual operating revenue
- wage / payroll scale
- transfer spending capacity
- cash / debt pressure
- commercial scale
- matchday scale
- ownership funding capacity
- academy / scouting investment scale
- stadium / fanbase scale

数値のsnapshot year / sourceを記録する。

公開情報が確認できない項目を、精密な実額のように捏造しない。

確認不能項目は:

```text
UNKNOWN
or
RELATIVE_BAND_ONLY
```

として保持し、後続データ入力で埋める。

RuntimeがClub名を読んで能力Buffを与えることは禁止する。

現実財務・Ownership・Fanbase等はCareer開始時の `ExternalReferenceSeed` にのみ使用する。
Pennant開始後のSaveは現実世界と切り離し、後年の現実データを既存Saveへ自動同期しない。
このLifecycle境界は18を正とする。


---

# 3. Club Source of Truth

Clubは一枚の`overallStrength`をsource of truthにしない。

概念:

```ts
type ClubIdentityCore = {
  clubId: ClubId;
  canonicalOriginId: string;
  sourceArchetype: ClubSourceArchetype;
  foundingIdentity: ClubFoundingIdentity;
};

type ClubWorldState = {
  institutional: ClubInstitutionalState;
  season: ClubSeasonState;
  live: ClubLiveState;
  history: ClubHistoryState;
};
```

`ClubPower`のような総合値はUI用のDerived Summaryなら許可するが、試合結果の入力には使わない。

Club Stateの固定/可変境界は `docs/game-design/18-club-state-lifecycle.md` を正とする。

---

# 4. Economic Source of Truth

球団の資金力は実金額・契約・収支から作る。

概念:

```ts
type ClubEconomyState = {
  cash: Money;
  debt: Money;

  revenue: {
    matchday: Money;
    broadcasting: Money;
    commercial: Money;
    merchandise: Money;
    prizeMoney: Money;
    transferIncome: Money;
    ownerFunding: Money;
    other: Money;
  };

  commitments: {
    playerWages: Money;
    staffWages: Money;
    transferPayments: Money;
    debtService: Money;
    stadiumOperations: Money;
    academyOperations: Money;
    scoutingOperations: Money;
    medicalOperations: Money;
  };

  approvedBudgets: {
    payroll: Money;
    transfers: Money;
    academy: Money;
    scouting: Money;
    coaching: Money;
    medical: Money;
    facilities: Money;
  };

  minimumCashReserve: Money;
};
```

「資金力S」はsource of truthではない。

---

# 5. Financial Strength is Causal

金持ちClubが強くなりやすい因果:

```text
large recurring revenue
+ owner funding capacity
+ cash / borrowing capacity
        ↓
larger payroll / transfer budget
        ↓
better players can be acquired
better players can be retained
        ↓
better staff can be hired
facilities can be improved
        ↓
stronger actual roster / development pipeline
        ↓
more wins
```

禁止:

```text
richClub = true
 -> contact +10
 -> velocity +5
```

Moneyは選手のbat speedやpitch velocityを直接変更しない。

巨大Clubの持続性・Recovery Capacity・Historic Collapse条件は `docs/game-design/19-club-structural-dominance-and-decline.md` を正とする。

---

# 6. Strong-club Dominance Without Magic

Football-inspired Leagueでは、強豪による長期支配を再現可能にする。

そのため、初期標準では強いSalary Capによる完全均衡化を行わない。

Leagueは`FinancialRegulationProfile`を持つ。

概念:

```ts
type FinancialRegulationProfile = {
  hardPayrollCap?: Money;
  luxuryTaxThreshold?: Money;
  squadCostRatioLimit?: number;
  revenueSharingRate: number;
  insolvencyRule: InsolvencyRule;
  ownerFundingPolicy: OwnerFundingPolicy;
};
```

Football-inspired Leagueでは、

- hard capなし
- limited revenue sharing
- solvency / registration checkあり
- owner funding allowanceあり
- transfer fee marketあり

を基本候補とする。

これによりRich ClubとSmall Clubの差を残す。

---

# 6.1 Financial Regulation Profile — CANONICAL

`FinancialRegulationProfile` はLeague / season ruleとしてversion管理する。

```ts
type FinancialRegulationProfile = {
  version: string;
  hardPayrollCap?: Money;
  luxuryTaxThreshold?: Money;
  squadCostRatioLimit?: number;
  revenueSharingRate: number;
  insolvencyRule: InsolvencyRule;
  ownerFundingPolicy: OwnerFundingPolicy;
};
```

実在Leagueでは対象年度の実規定を第一参照する。
Football-derived Leagueでは本書のno-hard-cap / limited-sharing / solvency-check / owner-funding-allowed方針をWorld Defaultとして使える。

制度改定は新Profile versionとして将来Seasonから適用し、過去Seasonへretroactiveに適用しない。

---
# 7. User-facing Club Economy — SIMPLE SURFACE

通常のClub画面では、経済・組織状態を**5軸だけ**で表示する。

```text
資金力
人気
育成
スカウト
球場・設備
```

Public表示は26の5-axis modelをSource of Truthとし、S〜G等の読みやすいRankでよい。

通常Gameplayでannual revenue / debt / debt service / commercial revenue / owner funding等の詳細財務を理解することを要求しない。

## 7.1 Detail / Offseason Surface

必要な時だけ、詳細ボタンまたはオフシーズン開始時のSeason briefで次の3項目を追加表示できる。

```text
補強予算
人件費余裕
財政状態
```

`財政状態` は別能力ではなく、cash / debt / commitments / recurring revenue / owner backing等から導出されるDerived Summary。
`資金力` も内部Economy Stateの要約であり、Match Core入力ではない。

より詳細な:
- annual revenue
- wage bill
- cash
- debt
- revenue breakdown
- structural revenue base
- financing access

等はOptional detail / audit viewに限定する。

原則:

> **Userは経済モデルを操作するのではなく、野球上の制約として理解する。**

---
# 8. Real Football Economy Snapshot — INITIAL SEED EVIDENCE

欧州Clubの初期経済は実在Football Clubの財務snapshotを参照する。

基準snapshotの初期候補は **2024/25 season / 2026 published financial sources**。

Deloitte Football Money League 2026で確認できる代表例:

| Club | 2024/25 revenue |
| --- | ---: |
| Real Madrid CF | €1,161m |
| FC Barcelona | €974.8m |
| FC Bayern München | €860.6m |
| Paris Saint-Germain | €837.0m |
| Liverpool FC | €836.1m |
| Manchester City | €829.3m |
| Arsenal | €821.7m |
| Manchester United | €793.1m |
| Tottenham Hotspur | €672.6m |
| Chelsea | €584.1m |
| FC Internazionale Milano | €537.5m |
| Borussia Dortmund | €531.3m |
| Atlético de Madrid | €454.5m |
| Aston Villa | €450.2m |
| AC Milan | €410.4m |
| Juventus | €401.7m |
| Newcastle United | €398.4m |
| VfB Stuttgart | €296.3m |

この差をそのまま初期経済格差のEvidenceとして利用できる。

ただしFootball revenueをそのままBaseball player wageへ1:1変換する必要はない。

```text
RealFootballFinancialSnapshot
 -> EconomyNormalization
 -> BaseballWorldBudget
```

という変換層を置く。

重要なのは**相対的な資金力・継続収入・負債・投資余力の差を保存すること**。

下位Clubについて確かな実額が未取得の場合は、実額を推測で埋めず、real-club reference + relative bandで開始する。


---

# 9. Virtuous and Vicious Cycles

強豪は成功からさらに収益を得られる。

```text
wins
 -> continental qualification
 -> prize / broadcast / audience
 -> reputation / commercial revenue
 -> more investment capacity
 -> better roster
```

これは許可する。

ただし自己強化が永久固定にならないよう、

- bad recruitment
- expensive failed contracts
- aging roster
- debt
- missed continental qualification
- weak academy generation
- manager / staff failure
- rival club investment

等で崩壊可能にする。

Small Clubも、

```text
academy success
 -> player sale
 -> reinvestment
 -> scouting / academy improvement
```

によって上昇可能。

---

# 10. Facilities

Moneyの使い道をRoster Acquisitionだけにしない。

候補:

```ts
type ClubFacilityState = {
  trainingQuality: number;
  academyQuality: number;
  scoutingInfrastructure: number;
  medicalQuality: number;
  analyticsInfrastructure: number;
  stadiumOperationsQuality: number;
};
```

ただしFacility値も「チーム総合+5」にはしない。

例:

```text
better scouting
 -> more / better evidence
 -> better recruitment decisions

better academy
 -> better development environment

better medical
 -> diagnosis / recovery management quality

better analytics
 -> better tactical / scouting information
```

という中間過程を通す。

---

# 11. Directed Club Rivalry — BOUNDARY ONLY

Rivalryは有向であり、相互性を要求しない。

```text
A -> B
B -> A
```

は独立してよい。

ただし詳細なState model / historical floor / event memory / decay / dormancy / emergent activation / label provenanceは **33 Rivalry Lifecycle Model** をSource of Truthとする。

## 11.1 Threat is not Rivalry Memory

強豪だから現在狙われていることを、永久Rivalryへ自動変換しない。

```text
dominant club
 -> current competitive threat rises
 -> Manager may prioritize opponent
 != permanent rivalry memory
```

Title race / repeated elimination / transfer grievance / controversial incident等のGame World historyが生じた時だけ、33のRivalry Memory ruleに従ってEmergent Rivalryへ育ち得る。

## 11.2 Rivalry is not a direct Buff

禁止:

```text
rivalry intensity
 -> all attributes +X
```

許可される接続は既存Psychology経由。

```text
Directed Rivalry / Personal History / Club Identification
 -> PersonalStake
 -> Appraisal
 -> EmotionPressure
 -> threshold crossed?
 -> ActiveEmotion
 -> actual decision / execution effects
```

同じRivalryでも、選手ごとに反応は異なる。

## 11.3 Manager Decision Boundary

Opponent priority / ace allocation / rest / sacrifice-game-like resource allocationは49 Manager ArchitectureのDecision Engineへ委譲する。

Rivalry / current threat / standings leverage / fatigue / future schedule等は入力になり得るが、

```text
rivalry high
 -> always use ace
```

の固定ルールにはしない。

## 11.4 Encirclement is an Analytic Descriptor

複数Clubが独立判断した結果として、dominant Clubへ強い先発・主力が集中することは許可する。

その観測結果をUIで `Encirclement / 包囲網` 等と呼ぶことはできる。

禁止:

```text
ENCIRCLEMENT state
 -> target club ability -X
```

包囲網は原因ではなく、複数の独立した因果判断から生じた観測Descriptor。

---
# 20. Club Reputation and Fanbase

ReputationとFanbaseもAbility Buffにしない。

概念:

```ts
type ClubReputationState = {
  domesticPrestige: number;
  continentalPrestige: number;
  globalPrestige: number;
};

type ClubFanbaseState = {
  localSupport: number;
  nationalSupport: number;
  internationalSupport: number;
  attendanceDemand: number;
};
```

作用先:

- commercial revenue
- merchandise
- matchday revenue
- player recruitment attractiveness
- sponsor interest
- fan expectation
- MatchImportance

へ接続可能。

`reputation 90 -> contact +5`は禁止。

---

# 21. Initial Club Catalog Workflow

現在の初期World 234 Clubを一気に適当に命名しない。

順序:

```text
1. Club system / economy / rivalry rules
2. League-by-league club source policy
3. initial economic hierarchy
4. city / stadium
5. club names / motifs
6. rivalry graph
7. historical seed
8. initial roster generation / real reference mapping
```

特にEuropeはLeagueごとに:

- giant
- upper challenger
- established mid-table
- academy seller
- local traditional club
- small-market club

等のeconomic roleを先に割り当て、その後Football motifを当てる。

これにより「名前だけReal Madrid風だが中身は全Club同額」を避ける。

---

# 22. Example: European League Power Structure — ILLUSTRATIVE CALIBRATION

10-club League例:

```text
1 giant
  PayrollPowerRatio 2.5–3.0

1 rich challenger
  1.8–2.3

2 upper clubs
  1.3–1.7

3 middle clubs
  0.8–1.2

2 selling / academy clubs
  0.6–0.9

1 small-market club
  0.4–0.7
```

これは固定順位ではない。

Rich Giantでも:

- bad contracts
- injuries
- poor manager decisions
- failed recruitment

で負けられる。

Small Clubもexcellent academy / scoutingで上昇できる。

---

# 23. Test Principles

将来実装時:

- Club name / motif labelだけを変えてもMatch Core結果は変わらない
- cashだけ増やしても現在Rosterのtrue abilityは即時上昇しない
- high budget clubがbetter playerを実際に獲得すると、そのRoster差から勝率が変化する
- failed expensive signingはMoney消費だけして期待した成果を出さない場合がある
- directed rivalry A->Bを変更してもB->Aは自動変更されない
- rivalryが閾値未満のEmotionPressureしか作らなければMatch Coreへ影響しない
- ActiveEmotionが成立した時だけ既存Psychology契約に従って挙動が変わる
- manager opponent-priority decisionはRivalryだけで固定されない
- multiple clubsが独立判断した結果としてdominant clubへのstrong-starter concentrationが発生可能
- observed encirclementを能力Debuffへフィードバックしない

---

# 24. Final Approved Decisions — v1

1. Club strengthを単一Overall / hidden Buffで表現しない。
2. Club Economyはcash / debt / revenue / commitments / approved budgets等の実状態から因果的に動く。
3. Rich Clubはacquisition / retention / staff / facilities / development opportunityへ資源を投入できるため長期的に強くなりやすい。MoneyからMatch abilityへの直接Buffは禁止。
4. League-by-League Club source policy / current Club countは21をSource of Truthとする。
5. 現実Clubの財務・ownership等はCareer開始時ExternalReferenceSeedのみ。Pennant開始後はSave内historyだけで進む。
6. Initial gameplay seedの具体値は26–30へ委譲する。
7. Club StateのL0-L4保存境界は18へ委譲する。
8. Giant Club persistence / recovery / structural declineは19へ委譲する。
9. Financial Regulationはversioned League `FinancialRegulationProfile`。
10. Facilities / academy / scouting / medical / analyticsは中間因果を通じて作用し、直接Team Ability Buffを与えない。
11. RivalryはDirected / asymmetric。詳細Lifecycleは33をSource of Truthとする。
12. Current Competitive ThreatをRivalry Memoryと混同しない。
13. RivalryのPlayer影響はPersonalStake -> Appraisal -> ActiveEmotionの既存Psychology経路。
14. Managerのopponent prioritization / ace allocationは49へ委譲する。
15. Encirclementは各Club独立判断の集積を観測したDescriptorであり、Debuffを持たない。
16. 通常Club UIは `資金力 / 人気 / 育成 / スカウト / 球場・設備` の5軸のみ。
17. `補強予算 / 人件費余裕 / 財政状態` は詳細表示またはオフシーズンbriefで提示可能。
18. Revenue / debt / financing等の詳細財務はOptional detail / audit view。
19. Userへspreadsheet managementを要求しない。
20. 現在の初期Worldは234 Club。

---

# 25. Successor Sources / Historical Handoff

本書作成後に以下が具体化・Canonical化されているため、それぞれの詳細は後継を優先する。

- Club source matrix / club counts: `21-world-club-source-policy.md` and regional catalogs
- Club initial five-axis gameplay seeds: `26`–`30`
- Club state lifecycle: `18-club-state-lifecycle.md`
- Structural dominance / decline: `19-club-structural-dominance-and-decline.md`
- Simple user surface: `20-simple-surface-deep-simulation.md`
- Scouting / recruitment: `31-scouting-recruitment-system.md`
- Roster / development: `32-roster-development-architecture-DRAFT.md` — **CANONICAL / DESIGN FROZEN v1**
- Rivalry lifecycle: `33-rivalry-lifecycle-model.md`
- Manager decision architecture: `49-manager-architecture-v1.md`

旧記述の「次にEurope Catalogを作る」「32はUSER REVIEW REQUIRED」等は履歴上obsoleteであり、現在状態を表さない。

---

# 26. Final v1 Status

**Club Economy, Identity & Directed Rivalry Design v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

本書のSource of TruthはClub Economy / Identity / economic causalityと、そのuser-facing boundary。
Rivalryの詳細計算やClub lifecycle等は上記後継Canonical文書を優先する。