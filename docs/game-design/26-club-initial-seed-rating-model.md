# Club Initial Seed Rating Model

更新日: 2026-09-20  
状態: **設計承認候補版。全234 ClubのCareer開始時Seedをゲーム用数値へ変換する。**

関連:
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/19-club-structural-dominance-and-decline.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/21-world-club-source-policy.md`

---

# 1. 目的

ユーザーへ複雑な経営操作を要求せず、各Clubの初期構造差を現実的に作る。

通常UIは5項目だけを基本表示する。

```text
資金力
人気
育成
スカウト
球場・設備
```

内部では0〜100のSeed Indexを持つ。

これらは**Match Core能力Buffではない**。

---

# 2. Five Public Club Axes

```ts
type ClubInitialSeed = {
  finance: number;      // 0..100
  popularity: number;   // 0..100
  development: number;  // 0..100
  scouting: number;     // 0..100
  venue: number;        // 0..100
};
```

## finance

初期の:

- sustainable revenue capacity
- payroll capacity
- acquisition budget capacity
- financing access
- owner backing

を要約。

## popularity

初期の:

- local supporter capital
- national supporter capital
- global supporter / brand reach
- attendance demand potential

を要約。

## development

初期の:

- academy / farm infrastructure
- development staff environment
- institutional development know-how
- training environment

を要約。

## scouting

初期の:

- domestic scouting reach
- international scouting reach
- data / analytics support
- recruitment network know-how

を要約。

## venue

初期の:

- stadium quality
- capacity / matchday potential
- training / medical physical infrastructure
- operational environment

を要約。

---

# 3. Public Rank

ユーザー通常画面では数値を必須表示しない。

Player Ratingと同じ読み方を使う。

| Rank | Internal |
| --- | ---: |
| S | 90–100 |
| A | 80–89 |
| B | 70–79 |
| C | 60–69 |
| D | 50–59 |
| E | 40–49 |
| F | 20–39 |
| G | 0–19 |

例:

```text
FC Bayern München

資金力      S
人気        S
育成        A
スカウト    S
球場・設備  A
```

通常プレーではこれだけ理解すればよい。

---

# 4. Initial Economic Band Conversion

既存CatalogのEconomic BandをFinance Seedの第一入力にする。

| Economic Band | Default finance seed |
| --- | ---: |
| MEGA | 96 |
| ELITE | 88 |
| HIGH | 78 |
| UPPER | 68 |
| MID | 58 |
| LOW | 45 |

verified finance / ownership evidenceがある場合は±5程度の個別校正を許可。

ただし`MEGA = 96`そのものをPennant中の状態へ固定しない。

---

# 5. League Environment Baselines

Finance以外は、Club個別Evidence + Leagueの初期環境からSeedする。

これはLeague Buffではない。

Career開始時に各Clubが持っている組織環境を作るための初期値。

| League | Development baseline | Scouting baseline | Venue baseline |
| --- | ---: | ---: | ---: |
| Japan | 82 | 82 | 84 |
| Korea | 78 | 77 | 80 |
| Taiwan | 72 | 72 | 76 |
| China | 67 | 68 | 77 |
| West / South Asia | 66 | 72 | 81 |
| North America | 88 | 91 | 91 |
| Mexico | 72 | 75 | 76 |
| Dominican | 77 | 79 | 70 |
| Venezuela | 76 | 77 | 70 |
| Puerto Rico | 74 | 76 | 69 |
| Cuba | 81 | 70 | 61 |
| Netherlands | 84 | 85 | 76 |
| Germany | 80 | 82 | 84 |
| France | 82 | 84 | 81 |
| Spain | 84 | 85 | 84 |
| United Kingdom | 80 | 86 | 89 |
| Italy | 78 | 82 | 83 |
| Russia | 70 | 73 | 75 |
| Australia | 71 | 74 | 74 |
| New Zealand / Pacific | 61 | 63 | 62 |
| Pan-African | 67 | 69 | 72 |

Club固有の育成文化・国際ネットワーク・施設規模が確認できる場合に個別overrideする。

---

# 6. Initial Seed Only

これらの数値はCareer開始時だけ。

例:

```text
2026 start
Ajax development = 94

Pennant begins
        ↓
investment / staff / facilities / history
        ↓
2040 current development environment = 76
```

を許可する。

`Ajaxだからdevelopment 94へ戻す`ことは禁止。

---

# 7. Under-the-Hood Expansion

5項目は内部構造のSummary Seed。

例:

```text
Popularity Seed
 -> supporterCapital
 -> brandCapital
 -> attendanceDemand prior

Finance Seed
 -> sustainableRevenueCapacity
 -> financingAccess
 -> ownerBacking prior

Development Seed
 -> academyKnowHow
 -> trainingInfrastructure
 -> farm / youth environment

Scouting Seed
 -> recruitmentNetworkCapital
 -> knowledge acquisition capacity

Venue Seed
 -> stadiumAssetCapital
 -> matchdayCapacity
 -> physical infrastructure
```

細分値は小さなdeterministic varianceを許可するが、5項目のSummaryから大きく逸脱させない。

---

# 8. No Direct Match Modifier

禁止:

```text
finance 96
 -> team power +9.6

development 90
 -> player ability +5
```

正しい経路:

```text
finance
 -> budget
 -> acquisition / retention
 -> actual roster
 -> Match Core
```

```text
development
 -> environment
 -> actual player development over time
 -> player state
 -> Match Core
```

---

# 9. Rivalry Numeric Scale

Directed Rivalryは0〜100。

既存Catalogの文章表現を初期値へ変換する。

| Label | Seed |
| --- | ---: |
| very high | 92 |
| high | 80 |
| medium-high | 68 |
| medium | 55 |
| low-medium | 42 |
| low | 30 |

双方向表記 `A <-> B` は初期Seed作成時に:

```text
A -> B
B -> A
```

へ展開する。

Pennant開始後は左右独立に動く。

---

# 10. Rivalry Components

`effectiveIntensity` を永久保存しない。

初期Seed:

```ts
type InitialDirectedRivalrySeed = {
  fromClubId: ClubId;
  toClubId: ClubId;
  historicalBase: number;
  competitiveThreat: number;
};
```

原則:

```text
traditional derby
 -> historicalBase high

recent / dominant-club target
 -> competitiveThreat high
```

現在値は:

```text
historicalBase
+ current competitiveThreat
+ recentHistory
+ incidents
 -> effectiveIntensity
```

で作る。

---

# 11. Popularity is not Finance

同じFinanceでもPopularityは違ってよい。

例:

```text
capital-backed modern club
finance = S
popularity = A

historic mass-support club
finance = B
popularity = S
```

これによりPSG型、Bayern型、Celtic型、Mohun Bagan型などの違いを表現する。

---

# 12. Club-specific Overrides

個別overrideは「強くしたいから」ではなく、初期Club identityを表現するために使う。

候補:

- historically exceptional supporter scale
- exceptional academy reputation
- exceptional international scouting
- exceptional stadium / infrastructure
- owner-backed finance
- documented financial stress

Overrideは±15程度を上限目安とする。

---

# 13. Seed Confidence

デバッグ用に任意で保持可能。

```ts
type SeedConfidence =
  | "VERIFIED"
  | "SUPPORTED"
  | "DESIGN_ESTIMATE";
```

ユーザーUIには通常表示しない。

目的は後から現実Dataを追加した時に、どのSeedを再校正すべきか判断すること。

---

# 14. Simple Surface Rule

ユーザーに:

- structural capital
- financing access
- commercial network
- supporter inertia
- seed confidence

を理解させる必要はない。

通常UI:

```text
資金力      A
人気        S
育成        B
スカウト    A
球場・設備  A
```

だけで遊べる。

詳細画面は閲覧用。

---

# 15. 今回確定する事項

1. Clubの通常表示は5軸
2. 内部Seedは0〜100
3. 表示RankはS〜G
4. Financeは既存Economic Bandを主入力にする
5. Development / Scouting / VenueはLeague baseline + Club override
6. PopularityはFinanceと独立
7. 5軸はInitial Seedであり永久値ではない
8. Match Coreへの直接補正は禁止
9. Rivalryは0〜100の有向値
10. Catalogの文章強度を数値へ変換する
11. 詳細経営はBackground Simulation


Scouting / recruitment system:
- `docs/game-design/31-scouting-recruitment-system.md`
