# Club State Lifecycle — Static, Slow, Seasonal & Derived — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> ClubのExternal Seed / L0-L4保存境界・Snapshot・Structural Event provenanceをv1としてFreezeする。
> Roster内部構造は32、Rivalry lifecycleは33、Structural dominance/declineは19、Simple Surfaceは20をSource of Truthとする。

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/17-europe-real-club-catalog.md`
- `docs/game-design/19-club-structural-dominance-and-decline.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`

---

# 1. 目的

ペナントを数十年〜数百年回しても、Clubの初期設定と現在状態が混ざらないようにする。

Club dataを以下の5層へ分離する。

```text
L0  Identity Core        原則固定
L1  Institutional State  数年〜数十年単位で変化
L2  Seasonal State       seasonごとに大きく変化
L3  Live State           season中に常時変化
L4  Derived View         保存せず再計算
```

さらに現実Clubから取り込んだ2024/25等のデータは、Simulation開始用の `ExternalReferenceSeed` として隔離する。

---

# 1.1 Responsibility Boundary — CANONICAL

本書は **Club stateをどの時間層で保存・更新・導出するか** を所有する。

```text
ExternalReferenceSeed  Career creation only
L0 Identity Core       identity continuity
L1 Institutional       slow multi-season state
L2 Seasonal            season-plan / season-open snapshot state
L3 Live                mutable in-season current state
L4 Derived View        recomputable summaries / labels
```

詳細責務:
- Roster / Rights / Registration / Assignment / Availability -> 32
- Rivalry Memory / decay / dormancy / label provenance -> 33
- Giant persistence / decline / recovery capacity -> 19
- User-facing surface hierarchy -> 20
- Initial five-axis seed values -> 26–30
- Manager/Staff internal person state -> Person / Manager architecture, including 49

本書は後継SubsystemのSource of Truthを複製しない。

---
# 2. 最重要原則 — 現実データはInitial Seedでしかない

Europeの実在Football Club財務等は、Career / Pennant開始時の初期値を作るEvidenceとして使う。

```text
Real-world snapshot
      ↓
ExternalReferenceSeed
      ↓
Career creation
      ↓
Initial ClubWorldState
      ↓
simulation starts
      ↓
REAL WORLD IS NO LONGER CONSULTED
```

例えば2026開始CareerのFC Bayern Münchenは、その時点の財務snapshotから初期経済を生成する。

2035年になって現実世界のBayernに新オーナーや新売上が発生しても、既存Saveへ自動同期しない。

Save内のBayernは、そのSave内の歴史だけで変化する。

Catalog / finance snapshot / seed-transform versionはSave metadataへ固定し、Catalog更新は既存Saveへretroactiveに適用しない。

---

# 3. L0 — Identity Core

原則として変化しないClubの正体。

```ts
type ClubIdentityCore = {
  clubId: ClubId;
  canonicalOriginId: string;
  foundingIdentity: ClubFoundingIdentity;
  originCountryId: CountryId;
  historicalHomeCityId: CityId;
  sourceArchetype:
    | "REAL_BASEBALL_CLUB"
    | "REAL_FOOTBALL_CLUB_AS_BASEBALL_CLUB";
};
```

## 固定するもの

- `clubId`
- 元になった実在Club reference
- founding identity
- historical origin country
- historical home city
- Club Historyの連続性

これらを変える場合は「同じClubの通常変化」ではなく、Franchise extinction / phoenix club / split / merge等の特殊World Eventとして扱う。

それらは通常のrename / relocationと区別した **Club Lineage Event** として、旧Club / 新Club / history continuity ruleを明示する。

---

# 4. 名前はIdentityではあるが絶対固定とは限らない

Display Nameは長期Simulationでは変更可能にする。

```ts
type ClubBrandState = {
  displayName: string;
  shortName: string;
  crestAssetId?: AssetId;
  brandVersion: number;
};
```

通常は実在名称から開始する。

例:

```text
FC Bayern München
```

ただし100年後にSponsor naming / legal reorganization等で名称変更が発生してもよい。

重要:

```text
displayName changes
  != new clubId
```

Historyは同じClubへ連続する。

初期実装ではrename eventを無効化してもよい。

---

# 5. L1 — Institutional State

数年〜数十年単位で変化する。

例:

- owner / ownership model
- board / governance
- home city / relocation
- stadium
- training complex
- academy infrastructure
- scouting network
- medical infrastructure
- analytics infrastructure
- long-term fanbase
- commercial reach
- long-term club philosophy

概念:

```ts
type ClubInstitutionalState = {
  ownerState: ClubOwnerState;
  governanceState: ClubGovernanceState;
  homeCityId: CityId;
  stadiumState: ClubStadiumState;
  facilityState: ClubFacilityState;
  academyState: ClubAcademyState;
  scoutingNetworkState: ScoutingNetworkState;
  longTermFanbaseState: LongTermFanbaseState;
  commercialReachState: CommercialReachState;
};
```

これらは毎日乱高下させない。

---

# 6. Ownershipは動く

実在Football Clubの現在Ownershipは初期Seed。

Pennant中は変更可能。

```text
owner sells club
new investor enters
supporter ownership reform
corporate acquisition
financial collapse
public listing / delisting
```

等をWorld Eventとして扱える。

Ownerが変わると:

- owner funding capacity
- acceptable debt
- risk tolerance
- long-term budget policy
- facility investment preference

等が変化し得る。

ただし:

```text
new rich owner
 -> player ability +10
```

は禁止。

---

# 7. StadiumはSlow State

Stadiumは頻繁には変えない。

```ts
type ClubStadiumState = {
  stadiumId: StadiumId;
  capacity: number;
  quality: number;
  age: number;
  ownedByClub: boolean;
  leaseCost?: Money;
  renovationLevel: number;
};
```

変化:

- renovation
- capacity expansion
- replacement
- relocation
- temporary ground share

Stadium変更はMatch Physics / attendance / matchday revenueへ実際に作用する。

「大球場だから能力+5」は禁止。

---

# 8. Facilities / AcademyはInvestmentで動く

Facilityは永久属性ではない。

```text
academyQuality = 90
```

をClubに固定しない。

```text
investment
+ staff
+ maintenance
+ infrastructure age
+ accumulated know-how
        ↓
current academy environment
```

として更新する。

設備は:

- build
- improve
- decay
- underfund
- rebuild

が可能。

伝統的Academy Clubには初期値やknow-how inertiaを与えてよいが、永久保証しない。

---

# 9. L2 — Seasonal State

Season開始時に確定・承認され、そのSeasonの計画・基準点として保持する状態。

例:
- season objectives
- approved payroll / acquisition / development / scouting / facility budgets
- competition entries
- season policy/profile references
- Opening Day / opening registration snapshot references
- initial board expectations

概念:

```ts
type ClubSeasonState = {
  seasonId: SeasonId;
  approvedBudgets: ApprovedClubBudgets;
  objectives: ClubSeasonObjectives;
  competitionEntries: CompetitionEntry[];
  openingRegistrationSnapshotId?: string;
  openingManagerPersonId?: PersonId;
  policyVersionRefs: ClubSeasonPolicyRefs;
};
```

`openingManagerPersonId` はSeason開始時Snapshotの履歴値であり、現在ManagerのSource of Truthではない。

Manager / Coach / ScoutはGlobal Personであり、Season途中で就任・退任・異動し得る。

Roster内部構造は32を正とし、L2はOpening / Competition Registration Snapshotへの参照だけを持つ。

---
# 10. L3 — Live State

Season中に常時変動する現在状態。

例:
- current cash / debt
- actual revenue received / commitments
- standings
- current fan demand
- current PlayerClubState references
- injuries / availability links
- current Person-role / employment links
- transfer / contract negotiations
- current title / postseason threat estimates
- current competitive-opponent threat references

概念:

```ts
type ClubLiveState = {
  cash: Money;
  currentDebt: Money;
  standingsState: StandingsState;
  currentRevenue: ClubRevenueLedger;
  currentCommitments: ClubCommitmentLedger;
  fanDemandState: FanDemandState;
  playerClubStateRefs: readonly PlayerClubStateRef[];
  currentStaffRoleLinks: readonly ClubPersonRoleLink[];
  relationStateRefs: readonly DirectedClubRelationStateRef[];
};
```

RosterをClub側へcopyして二重Source of Truthにしない。Player Rights / Registration / Assignment / Availabilityは32のGlobal Player stateを参照する。

Manager / StaffもClub固定能力ではなくGlobal Personへの現在Role linkとして保持する。

Save/Loadはこの現在値と必要なSubsystem stateを保持する。

---
# 11. L4 — Derived View

L4は保存原因ではなく、L0-L3 / Subsystem stateから再計算可能な表示・分析用View。

代表例:
- current public five-axis Club view
- Economic Band
- PayrollPowerRatio / TransferPowerRatio
- Title Threat
- Current Giant
- Selling Club
- Dynasty label
- Encirclement
- Richest Club ranking
- Academy Club label

通常Club UIの現在5軸:

```text
資金力
人気
育成
スカウト
球場・設備
```

26の数値はCareer開始時Seed。L4の現在5軸は、Save内のcurrent institutional/economic stateから再計算する。

例:

```text
2026 Finance Seed = S
 -> years of debt / owner change / revenue decline
 -> Current Finance View = B
```

必要時のDetail / Offseason View:

```text
補強予算
人件費余裕
財政状態
```

さらにRevenue / Debt / Financing Access等はOptional detail / audit view。

禁止:

```text
Derived label
 -> future causal state forced by the label
```

`MEGA / S / Dynasty / Encirclement` 等は結果を説明するLabelであり、原因ではない。

---
# 12. Economic Bandは動くが、単年度では崩れない

17で使っている:

- MEGA
- ELITE
- HIGH
- UPPER
- MID
- LOW

は**初期snapshotの説明用**。

Pennant中は現在状態から再計算するが、単年度Revenueだけでは決めない。

正しい入力は:

- rolling multi-year recurring revenue
- cash / debt burden
- financing access
- owner backing
- supporter / brand capital
- commercial network
- stadium revenue capacity
- committed wage burden

等。

したがって:

```text
one bad year
 -> MEGA remains plausible

multi-year sporting + financial + institutional decline
 -> gradual downgrade
```

とする。

例:

```text
2026 PSG = MEGA
2040 PSG = ELITE
2065 PSG = MID
```

まで落ちるなら、その間にStructural Capitalを削る履歴が必要。

逆にRennesが長期成功と投資を積み上げればUPPER -> ELITE -> MEGAへ成長可能。

詳細な強豪持続・崩壊条件は19を正とする。

---

# 13. ReputationとFanbaseはSlow + Seasonalの二層

Fanbaseを単一値にしない。

```ts
type LongTermFanbaseState = {
  localBase: number;
  nationalBase: number;
  internationalBase: number;
  historicalLoyalty: number;
};

type FanDemandState = {
  attendanceDemand: number;
  merchandiseDemand: number;
  mediaAttention: number;
};
```

LongTermFanbaseはゆっくり変わる。

FanDemandは:

- recent wins
- title race
- star players
- rivalry match
- ticket price
- stadium
- economy

等でSeason中にも動く。

数試合負けただけで100年のSupporter Baseが消えることはない。

---

# 14. Rivalry / Competitive Threat Boundary

Rivalry内部StateのSource of Truthは33 `Rivalry Lifecycle Model`。

本書ではClub state層として、relation stateへの参照と時間層だけを扱う。

恒久分離:

```text
Historical Rivalry Memory
!=
Current Competitive Threat
```

Dominant Clubだから狙われる状態はcurrent threat / opponent priorityへ入り得るが、それだけでRivalry Memoryを生成しない。

Real-world rivalryはCareer creation時のInitial Historical Seedまで。
Pennant開始後の新しい現実世界の事件をSaveへ注入しない。

RivalryがUser/Playerへ与える具体的なMemory / decay / dormancy / label provenanceは33を優先する。

Encirclement / dominant-target等の観測LabelはL4 Derived Viewであり、能力Debuffや永続Traitにしない。

---
# 17. Club Philosophyも二層

```ts
type ClubPhilosophyState = {
  institutionalPrior: ClubPhilosophyVector;
  currentLeadershipPolicy: ClubPhilosophyVector;
};
```

例:

- academy-oriented tradition
- star-buying tradition
- local-player preference
- analytics preference
- veteran preference

InstitutionalPriorはSlow。

Manager / Sporting Director / Ownerの変更でCurrentPolicyは比較的速く変わる。

最終行動は両方から生じる。

---

# 18. StaffはClub属性ではなくGlobal Person — CANONICAL

Manager / Coach / Scoutを:

```text
Bayern coaching = 90
```

のように固定しない。

StaffはPersonとして移籍・退任・成長・引退する。

Club側が持つのは:

- hiring budget
- staff slots
- facilities
- reputation / attractiveness
- institutional know-how
- current Person-role / employment links

である。

ManagerのDecision Engine / Strategy Memory等のPerson内部状態は49を正とし、Club属性へコピーしない。

---

# 19. Academy StrengthもPlayer Generation確率への魔法Buffにしない

正しい因果:

```text
academy facilities
+ academy staff
+ scouting reach
+ youth intake population
+ recruitment competition
+ development philosophy
        ↓
prospect intake
        ↓
actual development opportunities
        ↓
future first-team players
```

`Ajaxだから毎年天才生成`は禁止。

Ajaxが将来Academy投資を怠れば弱くなり得る。

---

# 20. Catalogs Are Initial Seeds

17のClub Catalogは**Initial Seed Catalog**と位置付ける。

その表にある:

- Club name
- City
- 2024/25 finance reference
- initial Economic Band

はCareer creation時の入力。

Pennant開始後:

```text
Club name              usually stable
historical origin      fixed
finance reference      frozen metadata
Economic Band          recalculated
owner                   mutable
stadium                 slow mutable
academy                 slow mutable
scouting                slow mutable
fanbase                 slow mutable
reputation              mutable
rivalry current threat  mutable
roster                  highly mutable
budget                  seasonal
cash                    live
```

---

# 21. Event Sourcing for Structural Change

Slow Stateを上書きして歴史を失わない。

例:

```ts
type ClubStructuralEvent =
  | { type: "OWNER_CHANGED"; ... }
  | { type: "STADIUM_RENOVATED"; ... }
  | { type: "STADIUM_REPLACED"; ... }
  | { type: "CLUB_RELOCATED"; ... }
  | { type: "BRAND_RENAMED"; ... }
  | { type: "ACADEMY_EXPANDED"; ... }
  | { type: "FACILITY_DECLINED"; ... }
  | { type: "GOVERNANCE_REFORMED"; ... };
```

Current StateはEvent列からsnapshot化してよい。

長期Saveでは毎回全Eventを0からReplayすることを要求しない。

```text
Current Structural Snapshot
+ append-only Structural Event Log / provenance
```

を許可し、checkpoint後のEventだけを適用してCurrent Stateを再構築できる。

History UIでは、

```text
2041 New owner
2044 Training complex expansion
2052 New baseball stadium
2077 Club rename
```

等を表示できる。

---

# 22. Club Season Snapshot — HISTORY, NOT RUNTIME AUTHORITY

毎Season終了時にClub summaryを歴史記録として保存する。

```ts
type ClubSeasonSnapshot = {
  seasonId: SeasonId;
  revenue: Money;
  wageBill: Money;
  transferSpend: Money;
  transferIncome: Money;
  closingCash: Money;
  closingDebt: Money;
  publicFiveAxisSummary: ClubFiveAxisSummary;
  domesticResult: DomesticSeasonResult;
  continentalResult?: CompetitionResult;
  openingManagerPersonId?: PersonId;
  closingManagerPersonId?: PersonId;
  managerAppointmentEventIds: readonly EventId[];
  rosterSummary: RosterSummary;
  fanbaseSummary: FanbaseSummary;
};
```

これはRuntimeの現在StateのSource of Truthではなく、History UI / long-save analytics / provenance用のSeason-end snapshot。

300年後でもClub史を圧縮して追跡できるようにする。

---
# 23. Save Compatibility

ExternalReferenceSeed versionをSaveへ固定する。

```ts
type ClubSeedMetadata = {
  catalogVersion: string;
  financeSnapshotSeason: string;
  generatedAt: CalendarDate;
};
```

ゲーム本体のClub Catalogが後で更新されても、既存SaveのClub初期条件を再生成しない。

新規Careerだけ新しいCatalogを使用できる。

Save migrationはschema / reference compatibilityの変換であり、既存Saveの歴史・Seed・結果を現在Catalogへ合わせて書き換える処理にしない。

---

# 24. User-facing View Boundary

通常Club画面は16 / 20 / 26のSimple Surfaceに従い、5軸を基本表示する。

```text
資金力
人気
育成
スカウト
球場・設備
```

必要な時だけDetail / Offseason Briefで:

```text
補強予算
人件費余裕
財政状態
```

を表示する。

Recurring Revenue / Wage Budget / Transfer Capacity / Debt Pressure等の因果説明はOptional Detail / Audit Viewへ置く。

重要なのは、Userが詳細財務を理解しなくても「なぜ補強できる / できないか」を野球上の制約として理解できること。

---
# 25. 初期固定 / 可変一覧

| Data | Layer | Mutable? |
| --- | --- | --- |
| clubId | Identity | No |
| real-world source reference | Identity metadata | No |
| historical origin | Identity | No |
| display name | Institution | Rarely |
| league membership | Institution / World | Rarely |
| home city | Institution | Rarely |
| owner | Institution | Yes |
| stadium | Institution | Yes, slow |
| academy infrastructure | Institution | Yes, slow |
| scouting infrastructure | Institution | Yes, slow |
| long-term fanbase | Institution | Yes, slow |
| historical rivalry state ref | Relation / successor 33 | versioned / memory-based |
| current competitive threat ref | Live / Derived Relation | Yes |
| reputation | Seasonal / Live | Yes |
| economic band | Derived | Yes, recalculated |
| revenue | Seasonal / Live | Yes |
| payroll budget | Seasonal | Yes |
| transfer budget | Seasonal | Yes |
| cash / debt | Live | Yes |
| current manager / staff role links | Live Person links | Yes |
| player-club state references | Live reference to 32 | Yes |
| standings | Live | Yes |
| title-threat / encirclement label | Derived | Yes |

---

# 26. Final Approved Decisions — v1

1. Club dataをExternalReferenceSeed / L0 Identity / L1 Institutional / L2 Seasonal / L3 Live / L4 Derivedへ分離する。
2. ExternalReferenceSeedはCareer creation時のみ使用し、既存Saveを現実データへ再同期しない。
3. L0はClub continuityのSource of Truth。renameは同一Clubを維持し、extinction / split / merge / phoenix等は明示的Club Lineage Event。
4. L1はOwnership / Governance / Stadium / Facilities / Academy / Scouting / Long-term Fanbase / Commercial Reach等のSlow State。
5. L2はSeason objectives / approved budgets / competition entries / opening registration snapshot等。
6. L3はcash / debt / actual ledgers / standings / current PlayerClubState refs / current Person-role links等。
7. Manager / Coach / ScoutはGlobal Person。Season途中の交代を許可し、Club固定能力へ変換しない。
8. Roster内部構造は32をSource of Truthとし、ClubStateへcopyしない。
9. Rivalry内部Stateは33をSource of Truthとし、Current Competitive ThreatとRivalry Memoryを分離する。
10. L4はDerived Viewであり、現在の5軸 `資金力 / 人気 / 育成 / スカウト / 球場・設備` をcurrent stateから再計算する。
11. `補強予算 / 人件費余裕 / 財政状態` はDetail / Offseason View。より深い財務はOptional Audit。
12. Economic Band / Giant / Dynasty / Encirclement / five-axis Rank等のDerived Labelを原因へ逆流させない。
13. Structural changesはEvent provenanceを残す。長期SaveではCurrent Snapshot + Event Log checkpoint方式を許可する。
14. ClubSeasonSnapshotはSeason-end HistoryでありRuntime authorityではない。
15. Catalog / Seed / transform versionをSaveへ固定し、Catalog更新で既存Saveを再初期化しない。
16. Save migrationはschema互換変換でありSave historyを書き換えない。

---

# 27. Final v1 Status

**Club State Lifecycle v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

本書はClub stateの時間層・保存境界・Snapshot / Event provenanceをSource of Truthとする。
Roster / Rivalry / Structural dominance等のSubsystem内部ロジックは後継Canonical文書を優先する。