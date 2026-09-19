# Club State Lifecycle — Static, Slow, Seasonal & Derived

更新日: 2026-09-20  
状態: **設計承認候補版。Club Pennant長期Simulationの保存境界。実装前。**

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

Season開始〜終了で大きく変化する経営状態。

```ts
type ClubSeasonState = {
  seasonId: SeasonId;

  finance: {
    openingCash: Money;
    projectedRevenue: Money;
    payrollBudget: Money;
    transferBudget: Money;
    academyBudget: Money;
    scoutingBudget: Money;
    facilityBudget: Money;
  };

  objectives: ClubSeasonObjectives;
  managerId: PersonId;
  sportingDirectorId?: PersonId;
  registeredRoster: ClubRosterRegistration;
  competitionEntries: CompetitionEntry[];
};
```

Season開始時にBoard / Owner / EconomyからBudgetを承認する。

---

# 10. L3 — Live State

Season中に常時変動する。

例:

- current cash
- actual revenue received
- wages already paid
- transfer spending
- debt drawdown
- roster
- contracts
- injuries
- standings
- current form
- current fan demand
- current manager confidence
- transfer negotiations
- current rivalry threat
- title threat
- postseason odds estimate

概念:

```ts
type ClubLiveState = {
  cash: Money;
  currentDebt: Money;
  currentRoster: ClubRosterState;
  standingsState: StandingsState;
  currentRevenue: ClubRevenueLedger;
  currentCommitments: ClubCommitmentLedger;
  fanDemandState: FanDemandState;
  relationState: DirectedClubRelationState[];
};
```

Save/Loadはこの現在値を保持する。

---

# 11. L4 — Derived View

保存しなくてよい、またはcache扱いにする。

例:

- Economic Band
- PayrollPowerRatio
- TransferPowerRatio
- ClubPower
- Title Threat
- Current Giant
- Selling Club
- Dynasty label
- Encirclement
- Richest Club ranking
- Academy Club label

```text
current state
   ↓
derived UI label
```

とする。

禁止:

```text
MEGA
 -> next season budget forced to MEGA
```

`MEGA` は結果を表すラベルであり、原因ではない。

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

# 14. RivalryもStatic + Dynamicへ分ける

Rivalry全体を一つの変動値にしない。

```ts
type DirectedClubRivalryState = {
  fromClubId: ClubId;
  toClubId: ClubId;

  historicalBase: number;
  culturalInertia: number;

  competitiveThreat: number;
  recentHistory: number;
  incidentWeight: number;

  effectiveIntensity: number;
};
```

## historicalBase

Slow / almost static。

例:

- El Clásico
- Old Firm
- Derby della Madonnina
- local derby

数十年低迷しても完全には消えにくい。

## competitiveThreat

Dynamic。

```text
same title race
repeated postseason meeting
dominant club
direct CL berth rival
```

等で上下。

したがって:

```text
Barcelona -> Real Madrid
historicalBase high
competitiveThreat medium

Rennes -> PSG
historicalBase low
competitiveThreat very high
```

のような違いを作れる。

---

# 15. Dominant Club TargetはDerived / Dynamic

`DOMINANT_CLUB_TARGET` を固定Traitにしない。

League内の:

- recent titles
- current table
- payroll dominance
- repeated elimination
- title threat
- media attention

等から各Clubが相手をどう見るかで発生する。

```text
Bayern dominates
↓
Dortmund -> Bayern high
Leverkusen -> Bayern high
Freiburg -> Bayern medium
Bayern -> Freiburg low
```

数十年後に別Clubが支配すればTargetも移る。

---

# 16. Traditional RivalryはSeedとして残す

実在Football rivalryは初期Seedとして利用する。

ただし:

```text
Real-world rivalry
 -> initial historicalBase
```

まで。

Pennant開始後のintensityはSave内の歴史で更新する。

現実世界の2028年Derby事件等を後からSaveへ注入しない。

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

# 18. StaffはClub属性ではなくPerson

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

である。

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

# 20. 74 Europe Clubsへの適用

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

History UIでは、

```text
2041 New owner
2044 Training complex expansion
2052 New baseball stadium
2077 Club rename
```

等を表示できる。

---

# 22. Season Snapshot

毎Season終了時にClub summaryを保存する。

```ts
type ClubSeasonSnapshot = {
  seasonId: SeasonId;
  revenue: Money;
  wageBill: Money;
  transferSpend: Money;
  transferIncome: Money;
  closingCash: Money;
  closingDebt: Money;
  economicBand: ClubEconomicBand;
  domesticFinish: number;
  domesticChampion: boolean;
  continentalResult?: CompetitionResult;
  managerId: PersonId;
  rosterSummary: RosterSummary;
  fanbaseSummary: FanbaseSummary;
};
```

300年後でも:

> 2030年代はPSG、2050年代はMarseille、2080年代はRennesがFranceの経済大国

のような歴史を追える。

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

---

# 24. UIで「なぜ強いか」を説明する

Club画面ではDerived Bandだけでなく、その原因を出す。

例:

```text
FC Bayern München
Economic Band: MEGA

Recurring Revenue       238% of league median
Player Wage Budget      221%
Transfer Capacity       194%
Commercial Reach        247%
Academy Investment      165%
Debt Pressure            42%
```

10年後に弱くなれば、この数字も実際に変わる。

「名門補正」という説明は使わない。

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
| historical rivalry base | Institution / Relation | Very slow |
| rivalry competitive threat | Live Relation | Yes |
| reputation | Seasonal / Live | Yes |
| economic band | Derived | Yes, recalculated |
| revenue | Seasonal / Live | Yes |
| payroll budget | Seasonal | Yes |
| transfer budget | Seasonal | Yes |
| cash / debt | Live | Yes |
| manager / staff | Live Person links | Yes |
| roster | Live | Yes |
| standings | Live | Yes |
| title-threat / encirclement label | Derived | Yes |

---

# 26. 今回確定する事項

1. Club dataをIdentity / Institution / Seasonal / Live / Derivedへ分ける
2. 実在Club財務はInitial Seedであり永久能力ではない
3. Career開始後は現実世界データと切り離す
4. Economic Bandは毎年変化可能
5. Owner / Stadium / Academy / Scouting / FanbaseはSlow State
6. Budget / Revenue / Cash / Rosterは可変State
7. Historical RivalryとCurrent Rivalry Threatを分離
8. Dominant Club Target / EncirclementはDerived / Dynamic
9. StaffはClub固定能力ではなくPerson
10. Structural changeはEvent履歴を残す
11. SeasonごとにClubSnapshotを保存
12. Catalog更新で既存Saveを再初期化しない
