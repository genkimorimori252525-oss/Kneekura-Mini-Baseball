# Club Initial Seed Rating Model — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。234 ClubのCareer Creation用Seed Calibration Contract。**

> 5軸はCareer開始時のInitial Seed Target / Calibration Summary。Pennant開始後のClub stateのSource of Truthではない。
> 現在5軸は18のL4 Derived ViewとしてSave内のcurrent causal stateから再計算する。

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

Career Creation / calibration用として0〜100のSeed Indexを持つ。Runtimeのcurrent Club abilityではない。

これらは**Match Core能力Buffではない**。

---

# 1.1 Seed Lifecycle Boundary — CANONICAL

```text
External Evidence / Catalog Data
+ League Prior
+ Club-specific Evidence
+ Five-axis Seed Target
+ Seed Transform Version
        ↓
Initial causal ClubWorldState
        ↓
Career / Pennant begins
        ↓
Initial Seed stops being runtime authority
        ↓
current L1/L2/L3 state
        ↓
L4 current five-axis Derived View
```

**Career開始時だけ Seed -> State。Pennant開始後は State -> View。**

Initial Seed値やS〜G Rankを、将来のBudget / Development / Match outcomeへ原因Statとして逆流させない。

---
# 2. Five Public Club Axes — INITIAL SEED TARGETS

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

`球場・設備` RankはPublic Summaryであり、実際のballpark geometry / surface / wall等の物理値を置き換えない。

---

# 3. Public Rank

ユーザー通常画面では数値を必須表示しない。

Career開始時はInitial Seedから、Pennant開始後は18のL4 current stateから同じS〜G表現へ変換できる。

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

# 4. Initial Economic Band Conversion — CAREER CREATION ONLY

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

Pennant開始後は19のEconomic BandがDerivedであることを優先し、Derived BandからFinance Seedへ再変換しない。

---

# 5. League Environment Priors — INITIAL FALLBACK

Finance以外は、Club個別Evidence + Leagueの初期環境からSeedする。

League値は**Initial Prior / fallback**であり、League所属による永久Buffではない。
Club-specific Evidenceがある場合はそちらを優先する。

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

# 6. Initial Seed Only — RUNTIME AUTHORITY ENDS AT CAREER CREATION

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

Catalog / Seed Datasetが後日更新されても既存Saveを再Seedしない。新Datasetは新規Careerにだけ使用する。

---

# 7. Seed Transform into Causal State — CAREER CREATION ONLY

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

この展開はInitial State生成時のSeed Transform。
Career開始後のcurrent state更新では、5軸から下位Stateを再生成しない。

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

# 9. Rivalry Responsibility Boundary

Rivalry Seed / Lifecycleは本書のSource of Truthから外す。

- Initial Directed Rivalry Data -> `30-initial-directed-rivalry-graph.md`
- Rivalry Memory / historical floor / decay / dormancy / emergent activation / label provenance -> `33-rivalry-lifecycle-model.md`

26はClub five-axis Initial Seedだけを所有する。

特に `Dominant Club Target = Rivalry Memory` のような古い解釈をしない。Current Competitive ThreatとRivalry Memoryは33に従って分離する。

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

# 12. Club-specific Overrides — EVIDENCE REQUIRED

個別overrideは「強くしたいから」ではなく、Initial Club identityを表現するEvidenceがある場合だけ使う。

候補Evidence:
- exceptional supporter scale
- academy / development history
- international scouting reach
- stadium / infrastructure scale
- owner-backed finance
- documented financial stress
- verified or supported Club-specific institutional information

固定の `±15` をArchitecture上限にはしない。幅はCalibration。
ただしoverrideにはsource / reason / confidence provenanceを残す。

---
# 13. Seed Provenance — CANONICAL

Initial Seedには再校正可能性を追跡するprovenanceを持たせる。

概念:

```ts
type ClubInitialSeedProvenance = {
  datasetVersion: string;
  sourceSnapshotIds: readonly string[];
  transformVersion: string;
  confidenceClass: SeedConfidence;
  overrideReason?: string;
};
```

`SeedConfidence` の具体分類はCalibrationでよいが、`VERIFIED / SUPPORTED / DESIGN_ESTIMATE` 等を利用できる。

通常User UIには表示しない。Debug / data audit / future recalibration用。

27〜29の234 Club値は **Initial Seed Dataset v1** として扱い、Architecture未決定ではない。

Dataset v2等へ更新しても既存Saveを再Seedしない。

---
# 14. Simple Surface Rule

通常Club UIは5軸だけで遊べる。

```text
資金力
人気
育成
スカウト
球場・設備
```

通常はS〜G等のRank表示。Initial raw seed数値 / Seed Provenanceは不要。

必要な時だけ20のDetail / Offseason Briefとして:

```text
補強予算
人件費余裕
財政状態
```

を表示する。

Structural Capital / financing access / commercial network / supporter inertia / seed confidence等はOptional Audit View。

---
# 15. Final Approved Decisions — v1

1. Club Initial Seed ModelはCareer Creation専用のSeed Calibration Contract。
2. Public five axesは `資金力 / 人気 / 育成 / スカウト / 球場・設備`。
3. Initial Seedは0〜100、通常表示はS〜G。
4. Five-axis SeedはInitial ClubWorldState生成時のみ使用し、Pennant開始後のSource of Truthにはしない。
5. Career CreationではExternal Evidence + Catalog Data + League Prior + Club-specific Evidence + Five-axis Seed Target + versioned Seed Transformから初期Causal Stateを生成する。
6. Pennant開始後の現在5軸は18のL4 Derived Viewとしてcurrent stateから再計算する。
7. League baselineはInitial Prior / fallbackでありLeague Buffではない。
8. Club-specific overrideにはEvidence / provenanceを要求し、固定±15制限はArchitectureにしない。
9. Economic Band -> Finance変換はInitial Seed専用。Pennant中のDerived BandからSeedへ逆変換しない。
10. Development / Scouting / Venue等からMatch Coreへの直接Buffは禁止。
11. `球場・設備` はPublic Summaryであり、actual ballpark geometry / facilities stateを置換しない。
12. Seed Dataset / source snapshot / transform version / confidence / override reasonをprovenanceとして保存する。
13. 27〜29の234 Club数値はInitial Seed Dataset v1。将来Dataset更新は新規Careerだけに適用する。
14. Rivalry Seed / Lifecycleは30 / 33をSource of Truthとし、26の責務から外す。
15. Initial Seed / S〜G Rank / five-axis ViewをRuntime原因Statへ逆流させない。

---

# 16. Final v1 Status

**Club Initial Seed Rating Model v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

Remaining exact baselines / transform weights / confidence labels / per-Club data corrections are Dataset / Calibration work, not open architecture.