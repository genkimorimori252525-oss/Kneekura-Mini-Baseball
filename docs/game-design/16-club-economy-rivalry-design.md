# Club Economy, Identity & Directed Rivalry Design

更新日: 2026-09-19  
状態: **設計承認候補版。球団個別カタログ作成前。実装前。**

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/12-competition-identity-hosting.md`
- `docs/game-design/15-season-events-and-deadlines.md`

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

# 2. Club Source Policy

球団の着想元を二系統に分ける。

## 2.1 REAL_BASEBALL_REFERENCE

野球文化・既存のプロ野球クラブが十分に存在するLeagueでは、実在野球球団をworking referenceとして使える。

初期候補:

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

球団数がゲーム世界のLeague規模と一致しない場合は、統合・追加・架空Expansionで調整可能。

## 2.2 FOOTBALL_INSPIRED_FICTIONAL

野球が主要競技ではない地域では、その地域のFootball Club Cultureを野球へ移植した架空球団を作る。

初期対象:

- Europe 7 leagues
- China
- West / South Asia
- Pan-African League
- New Zealand / Pacific

特にEuropeでは、

- Real Madrid-like
- Barcelona-like
- Bayern-like
- PSG-like
- Manchester / Liverpool-like
- Milan / Turin-like
- Dutch academy-powerhouse-like

等の勢力構造・都市・クラブ哲学・経済モデルをモチーフにできる。

重要:

> モチーフは能力補正ではない。

Runtimeが`BAYERN_LIKE`等のlabelを読んで強くすることは禁止する。

### Public-release note

開発中のworking referenceとして実在球団名を使うことと、公開製品で名称・ロゴ・紋章をそのまま使用することは別問題。

配布・商用化時は権利関係に応じて、必要なら架空名称・独自ロゴへ置換する。

---

# 3. Club Source of Truth

Clubは一枚の`overallStrength`をsource of truthにしない。

概念:

```ts
type ClubProfile = {
  clubId: ClubId;
  leagueId: LeagueId;
  homeRegionId: RegionId;
  homeCityId?: CityId;
  stadiumId: StadiumId;
  identity: ClubIdentity;
  ownershipModel: OwnershipModel;
  developmentModel: DevelopmentModel;
  marketModel: ClubMarketModel;
  foundedSeason: SeasonId;
};

type ClubWorldState = {
  economy: ClubEconomyState;
  organization: ClubOrganizationState;
  facilities: ClubFacilityState;
  fanbase: ClubFanbaseState;
  reputation: ClubReputationState;
  roster: ClubRosterState;
  relationships: DirectedClubRelation[];
  history: ClubHistoryState;
};
```

`ClubPower`のような総合値はUI用のDerived Summaryなら許可するが、試合結果の入力には使わない。

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

# 7. Economic Powerをユーザーへ数値で説明する

強豪を「なんとなく名門」と表示しない。

UIで少なくとも以下を比較可能にする。

- annual revenue
- player wage bill
- transfer budget
- net transfer spend
- cash
- debt
- commercial revenue
- matchday revenue
- academy spending
- scouting spending
- facility spending
- League median比

Derived指標候補:

```text
PayrollPowerRatio
  = club player wage budget / league median player wage budget

TransferPowerRatio
  = club approved transfer budget / league median

RecurringRevenueRatio
  = recurring revenue / league median

SquadInvestmentCapacity
  = available cash
  + approved owner funding
  + projected operating surplus
  - committed costs
  - minimum reserve
```

これらは説明・AI意思決定用。

Match Coreへ直接Buffしない。

---

# 8. Football-inspired Economic Archetypes

以下は**実在クラブの現在値ではなく、ゲーム開始時のモチーフ用economic seed例**。

## 8.1 Bayern-like — Self-sustaining Giant

```text
RecurringRevenueRatio   2.5
PayrollPowerRatio       2.2
TransferPowerRatio      2.0
CommercialStrength      very high
DebtPressure            low
AcademyInvestment       high
OwnerInjectionReliance  low–medium
```

強さの源:

- 大規模商業収入
- 強い国内ブランド
- 継続的CL収入
- 高い選手保持力
- 安定経営

## 8.2 PSG-like — Capital-backed Giant

```text
RecurringRevenueRatio   2.0
PayrollPowerRatio       3.0
TransferPowerRatio      4.0
OwnerFundingCapacity    very high
CommercialStrength      very high
AcademyInvestment       high
```

強さの源:

- owner capital
- star acquisition
- very high wages
- global brand growth

## 8.3 Real-like — Global Commercial Giant

```text
RecurringRevenueRatio   3.0
PayrollPowerRatio       2.6
TransferPowerRatio      2.7
MatchdayRevenueRatio    very high
GlobalReputation        very high
OwnerInjectionReliance  low
```

## 8.4 Barcelona-like — Giant with Financial Risk

```text
RecurringRevenueRatio   2.6
PayrollPowerRatio       2.5
AcademyInvestment       very high
DebtPressure            high
CommercialStrength      very high
```

強豪でもDebt / bad contractsによって補強余力を失い得る。

したがって「名門だから永久に強い」にはならない。

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

# 11. Directed Club Rivalry

Rivalryは対称行列にしない。

```ts
type DirectedClubRivalry = {
  fromClubId: ClubId;
  toClubId: ClubId;
  intensity: number; // 0..100
  reasons: readonly RivalryReason[];
  historicalWeight: number;
  currentCompetitiveThreat: number;
  lastUpdatedAt: SeasonTime;
};
```

例:

```text
Club A -> Club B = 90
Club B -> Club A = 15
```

を合法とする。

つまりAはBを宿敵と思っているが、BはAをそこまで意識していなくてもよい。

---

# 12. Rivalry Reasons

初期候補:

- LOCAL_DERBY
- HISTORICAL_RIVAL
- TITLE_RIVAL
- REPEATED_PLAYOFF_LOSS
- CONTINENTAL_RIVAL
- PLAYER_TRANSFER_GRIEVANCE
- MANAGER_HISTORY
- RECENT_INCIDENT
- DOMINANT_CLUB_TARGET
- UPSET_TARGET
- FAN_HOSTILITY

複数理由を同時に持てる。

`DOMINANT_CLUB_TARGET` は特に重要。

Leagueを長期間支配するClubには、多数のClubから一方向Rivalryが集まり得る。

```text
Club B dominates league for years
        ↓
A -> B 75
C -> B 60
D -> B 85
E -> B 40
...
```

Bが全Clubを同じ強さでライバル視する必要はない。

---

# 13. Rivalry is not a direct Buff

禁止:

```text
rivalryIntensity 80
 -> all attributes +8
```

正しい接続:

```text
directed rivalry
+ player club attachment
+ tenure
+ personality
+ recent history
+ standings leverage
        ↓
PersonalStake
        ↓
Appraisal
        ↓
EmotionPressure
        ↓
threshold crossed?
        ↓ yes
ActiveEmotion
        ↓
actual decision / execution changes
```

つまりユーザーが希望する、

> ライバル戦では調子が上がりやすい

は、

> `やる気`等のActiveEmotionが発火しやすくなる

として表現する。

全員が必ず好調になるわけではない。

同じRivalryでも:

- やる気になる
- 怒る
- 焦る
- 恐怖を感じる
- 何も発火しない

が選手ごとにあり得る。

---

# 14. Club RivalryとPlayer Attachment

Club-level rivalryを全選手へ同じ強さでコピーしない。

候補:

```text
EffectivePersonalRivalryStake
 =
 ClubDirectedRivalry
 x ClubIdentification
 x PlayerSensitivity
 + PersonalHistory
```

ClubIdentificationへ影響し得るもの:

- club tenure
- academy graduate
- captaincy
- fan affinity
- childhood affiliation
- recent transfer
- loan status

加入したばかりの外国人選手は、100年続くDerbyでも当初はPersonalStakeが低い場合がある。

一方Academy出身Captainは非常に高くなり得る。

---

# 15. Rivalry Formation & Decay

Rivalryは初期Seedだけでなく歴史から変化する。

増加候補:

- repeated title races
- direct elimination
- controversial incidents
- star transfers
- frequent close games
- repeated humiliating losses
- opponent dynasty
- fan conflict

減少候補:

- long period without meaningful games
- league separation
- rivalry generation turnover
- competitive irrelevance

Local Derby / century-old rivalry等は高いhistorical inertiaを持てる。

---

# 16. Manager Strategy Boundary — Later Design

監督AIの具体的な先発割当・捨て試合・包囲網は**別設計**で詰める。

ただし入力境界だけ今決める。

```ts
type OpponentPrioritySignal = {
  directedRivalry: number;
  titleThreat: number;
  standingsLeverage: number;
  postseasonLeverage: number;
  recentIncidentWeight: number;
  fanExpectation: number;
};
```

将来Manager AIはこれに、

- rotation availability
- fatigue
- schedule density
- expected win value
- next opponents
- manager personality
- club objectives

を加えて資源配分を決める。

---

# 17. 「捨て試合」と「絶対勝ちたい」を自然発生させる

例1:

```text
Opponent = dominant club
Rivalry high
TitleThreat high
FanExpectation high
Ace available
        ↓
Manager may choose ace starter
```

例2:

```text
Opponent = dominant club
Rivalry low
Schedule tomorrow = direct playoff rival
Ace tired
Expected win probability low
        ↓
Manager may rest ace / use weaker lineup
```

どちらも正しい判断になり得る。

Rivalryが高くても、監督が常に感情的に最善投手を使うとは限らない。

---

# 18. Anti-dominant-club Encirclement

「みんなが首位Clubへ良い投手を当てる包囲網」をLeague全体の特殊効果にはしない。

自然発生:

```text
dominant Club X

Club A independently:
 Rivalry + title threat -> high priority

Club B independently:
 playoff leverage -> high priority

Club C independently:
 fan expectation -> high priority

Club D:
 low rivalry + tired ace -> low priority
        ↓
many opponents happen to allocate strong resources vs X
```

これを後から観測したものをUIで`Encirclement`等と呼ぶのはよい。

しかし`EncirclementState -> X team -10`は禁止。

---

# 19. Rivalry Reciprocity is Independent

Opponentが「応じる」かどうかは完全に独立。

```text
A -> B = 90
B -> A = 10
```

でもよい。

数年後にAがBを何度も倒せば、

```text
B -> A
```

も上昇する可能性がある。

逆にBがAを相手として重要視し続けなければ非対称のまま残る。

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

240 Clubを一気に適当に命名しない。

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

# 22. Example: European League Power Structure

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

# 24. 今回確定する事項

1. Baseball-strong regionsは実在野球Clubをworking referenceにできる
2. Baseball-minor regionsはFootball-inspired fictional baseball clubsを基本とする
3. Europe 7 Full Leaguesは特にFootball Club hierarchyを強く参照する
4. Club strengthを単一Buffで表現しない
5. Rich-club dominanceはRevenue / Payroll / Transfer / Facilities等の数値で説明する
6. Football-inspired Leagueはhard salary capを初期標準にしない
7. EconomicPowerはLeague median比をUIで可視化可能
8. Bayern / PSG / Real / Barcelona等はeconomic archetype motifとして扱う
9. Rivalryはdirectionalであり相互性を要求しない
10. Dominant Clubは多数Clubから一方向に狙われ得る
11. RivalryはPersonalStake -> Appraisal -> ActiveEmotionへ接続する
12. Rivalryによる直接`能力+X`は禁止
13. Managerのエース投入 / 捨て試合 / 包囲網は別Tactical Designで詰める
14. 包囲網は各Clubの独立判断の集積として自然発生させる
15. Club Catalogはeconomic hierarchyを先に作り、名前・モチーフを後から当てる

---

# 25. 次に決めるもの

次のClub設計では、Leagueごとの具体的な球団一覧へ進む。

最初はEuropeから:

- Netherlands 10
- Germany 12
- France 10
- Spain 10
- United Kingdom 10
- Italy 12
- Russia 10

計74球団について、

- home city
- football motif
- fictional baseball club name
- economic tier
- ownership style
- stadium scale
- academy strength
- initial rivalries

を決める。
