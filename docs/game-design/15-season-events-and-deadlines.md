# Season Events & Deadlines — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> Season EventのFamily / Profile境界 / Deadline責務はv1としてFreeze済み。
> exact日付・Roster人数・Vote比率・Waiver細則等はLeagueProfile / LeagueRosterProfile / implementation calibrationであり、open architectureではない。

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/13-domestic-league-championships.md`
- `docs/game-design/14-regular-season-calendar-and-volume.md`

---

# 1. 目的

100試合以上を戦うFull Leagueに、年間を区切る分かりやすい節目を持たせる。

シーズン中イベントは増やしすぎない。

初期標準は以下の6系統。

1. Opening Day
2. All-Star Break
3. Midseason Market Deadline
4. Late-season Roster Expansion
5. Postseason Eligibility Cutoff
6. Season Awards

これらはLeague Calendar / Career World側の仕組みであり、Match Coreへ直接能力補正を掛けない。

---

# 2. World Default Event Timing — CANONICAL

Season Eventは共通Familyを持つが、全Leagueへ全Eventを強制しない。

実在野球Leagueでは対象年度の公式制度・日付を第一参照する。
実在Leagueがない / football-derived等のLeagueではWorld Defaultを基礎にする。

World Default:

```text
0%      Opening Day
50%     All-Star reference point
72%     Market reference point
85%     Roster Expansion reference point
90%     Postseason Eligibility reference point
100%    Regular Season ends
```

実際の日付はLeagueCalendarProfile / LeagueSeasonEventProfileから決める。
WBC / Premier / Club World等との衝突時はWorld Competition Windowを優先する。

> **Profileごとの実規定・ON/OFFがWorld Defaultより優先する。**

## 2.1 LeagueSeasonEventProfile — CANONICAL

Season Eventの採用可否・時期・Policyはversioned Profileで持つ。

```ts
type MarketWindowType = "TRADE_DEADLINE" | "REGISTRATION_WINDOW_CLOSE" | "HYBRID";

type MarketWindowPolicy = {
  type: MarketWindowType;
  progress?: number;
  calendarDate?: CalendarDate;
  policyVersion: string;
};

type LeagueSeasonEventProfile = {
  version: string;
  allStarEnabled: boolean;
  allStarProgress?: number;
  marketWindows: readonly MarketWindowPolicy[];
  rosterExpansionEnabled: boolean;
  rosterExpansionProgress?: number;
  postseasonEligibilityPolicyVersion?: string;
  awardSelectionPolicyVersion: string;
};
```

Market Window自体を持たないLeagueは `marketWindows = []` で表現する。
単一enumへ世界を押し込めず、Leagueによって複数Market Windowを持つ余地を残す。

Profile変更は新versionとして将来Seasonから適用し、過去SeasonのEvent履歴を書き換えない。

---
# 3. Opening Day

Regular Seasonの公式開始日。

保存するもの:

- seasonId
- opening date
- opening matchup
- starting roster snapshot
- manager / coaching staff snapshot
- initial club objectives
- initial standings state

Opening Day時点のRosterは、そのSeasonの最初の公式Club状態として履歴保存する。

ただし、その後の移籍・怪我・昇格・降格は通常どおり発生する。

---

# 4. All-Star Break

World DefaultではFull LeagueにAll-Star Eventを持たせるが、`allStarEnabled` によりLeagueごとにOFFを許可する。

World Default開催時期はRegular Season 50%前後。
実在Leagueでは年度公式日程を優先し、Profileで個別設定する。

## 4.1 Format

最初は単純にする。

- All-Star Game: 1試合
- optional Home Run Derby-like event
- optional Pitching / Skills eventは将来候補

All-Star Game自体はLeague公式記録とは別。

選手のRegular Season Statsへ混ぜない。

## 4.2 Selection

選出候補:

```text
fan vote component
+ player / coach vote
+ statistical selection
```

正確な比率は後続校正。

選手の公開Ratingだけで自動選出しない。

実際のSeason Performanceを主要Evidenceにする。

## 4.3 All-Starは能力Buffではない

選出:

- reputation
- career achievement
- popularity
- contract / market value
- historical record

等へ影響可能。

true abilityへ直接Buffしない。

---

# 5. Market Windows

リーグごとの市場文化に合わせ、Market Windowを0..N個持てる。

主要v1種類:
- TRADE_DEADLINE
- REGISTRATION_WINDOW_CLOSE
- HYBRID

Market Windowが存在しないLeagueも許可する。

HYBRIDはTrade / Registration / Loan / FA等の複数制限が同時または段階的に発効するProfile。

## 5.1 TRADE_DEADLINE

対象例:

- North America
- Japan
- Korea
- Taiwan
- Mexico
- Caribbean Hybrid leagues
- Australia

World Default referenceはRegular Season 72%付近。
実在Leagueでは年度公式日付を優先する。

締切後:

- Club-to-Club trade不可
- deadline-trade acquisition不可
- minor / reserve promotionは可
- injury replacementは可
- free agent signingはLeagueProfile次第

Trade Deadline前には:

```text
contender
 -> buy

rebuilding club
 -> sell
```

という市場行動が発生可能。

ただしStandingsだけで機械的にBuy/Sellを決めず、

- playoff probability estimate
- club finances
- age curve
- contract years
- owner / front-office policy
- roster needs

等を使う。

## 5.2 REGISTRATION_WINDOW_CLOSE

対象例:

- Europe
- West / South Asia
- Pan-African
- China等のTransfer型League

TradeではなくPlayer Registration Windowを閉じる。

締切後は原則:

- transfer fee acquisition不可
- loan registration不可
- cross-club permanent registration不可

ただし:

- youth promotion
- emergency goalkeeper相当の野球用emergency replacement
- severe injury replacement

等の例外をLeagueProfileへ持てる。

Football Transfer市場を参考にするが、ルールはBaseball Calendarへ合わせる。

---

## 5.3 HYBRID

Trade / Registration / Loan / FA等の複数Market restrictionを一つのLeague文化として扱うProfile。

例:
- Trade deadline closes club-to-club trade
- Registration window remains open for limited free agents
- Loan window may close on a separate date

HYBRIDは魔法の別市場ではなく、複数の既存Transaction Ruleをversioned Market Window Policyとして束ねる。

---
# 6. Late-season Roster Expansion

Roster Expansionは**Optional League Rule**。

World Default referenceはRegular Season 85%付近だが、全Leagueへ強制しない。
実在Leagueでは年度の公式Roster規定を第一参照する。

目的:

- 若手prospectの一軍経験
- playoff contenderのdepth確認
- fatigue management
- injury coverage

初期設計では具体人数をまだ固定しない。

```ts
type LateSeasonRosterExpansion = {
  enabled: boolean;
  startsAtSeasonProgress: number; // default 0.85
  extraActiveSlots: number;
};
```

正確なActive Roster人数・増加数・eligible assignmentは `LeagueRosterProfile` の年度別規定をSource of Truthとする。

重要:

> Roster Expansionは選手能力を上げる仕組みではなく、登録可能人数が増えるだけ。

---

# 7. Competition Eligibility Cutoff — OPTIONAL / SCOPED

Postseason Eligibility Cutoffは全League共通Hard Ruleにしない。

World Default referenceはRegular Season 90%付近。
実在Leagueでは年度公式規定を優先する。

EligibilityはCompetition scopeを分ける。

```text
DOMESTIC_POSTSEASON
CONTINENTAL
OTHER_COMPETITION
```

各scopeで:

```text
registered before applicable cutoff
 -> eligible candidate

registered after cutoff
 -> normally ineligible unless profile exception
```

怪我人代替等の例外はLeague / Competition Profileに置く。

目的:
- Postseason直前だけ大量補強する抜け道を防ぐ
- Seasonを通じたRoster構築を評価する
- Cup-tied / Competition roster rulesとの整合

国内PSを持たないTABLE_TITLE LeagueへDomestic Postseason Cutoffを無理に作らない。
Continental roster eligibilityは別scopeのCompetition ruleとして定義する。

---
# 8. Waiver / Free Agent after Deadline

初期設計では複雑なWaiver市場を主役にしない。

Market Deadline後も最低限:

- released player
- uncontracted free agent
- emergency injury replacement

を扱える。

ただし、Postseason Eligibility Cutoff後に加入したPlayerがPSへ出られるかはLeagueProfileで制限する。

将来詳細なWaiver Rulesを追加可能だが、初期実装の必須要件にはしない。

---

# 9. All-Star Breakと休養

All-Star Breakは2〜4日のLeague Break候補。

非選出選手は通常のrest / recovery時間を得る。

選出選手はGame / travelがあるため、全員一律完全回復にはしない。

```text
not selected
 -> ordinary break recovery

selected
 -> travel + event workload + recovery
```

Fatigue Stateから因果的に処理する。

---

# 10. Season Awards

Regular Season終了後、またはDomestic Championship終了後にAward votingを行う。

League共通候補:

- Most Valuable Player
- Best Pitcher
- Rookie / Best Young Player
- Best Defender by position
- Best Batter by position
- Manager of the Year
- Comeback Player
- All-League Team

## 10.1 Evidence

Awardは:

- Season statistics
- workload
- fielding contribution
- baserunning
- leverage
- team context
- voting / media component

等から選ぶ。

公開Ratingだけで決めない。

## 10.2 Regular SeasonとPostseason

初期標準:

- League MVP等 = Regular Season中心
- Postseason MVP = 別Award
- Championship Series MVP = 別Award
- Continental / World tournament awards = 12の大会Awards

と分離する。

---

# 10.3 Award Selection Policy — CANONICAL

League Awardの選考文化はversioned `AwardSelectionPolicy` として持つ。

入力候補:
- Season statistics
- workload
- fielding
- baserunning
- leverage
- team context
- expert / media / fan component

exact weightsはCalibration。

過去SeasonのMVP等を現在の選考Policyで再判定しない。
Award受賞LabelからPlayer true abilityへBuffを与えない。

---
# 11. Market Decision Trigger Boundary

15が所有するのは、Market Windowが近づいた / 開いた / 閉じたという**Calendar Trigger**まで。

```text
Season Event / Market Window
 -> Club AI receives MarketDecisionTrigger
```

実際のBUY / HOLD / SELL / DEVELOP、target selection、negotiationはClub / Front Office / Recruitment system側が決める。

判断入力候補:
- standings / postseason chance estimate
- roster needs
- prospect depth
- contracts
- finances
- owner / front-office policy
- long-term club objective

順位だけの固定if文にしない。

```text
4th place
 -> BUY
```

は禁止。

---
# 12. User Interaction

ユーザーが球団を監督・GMとして操作する場合も、イベント数を増やしすぎない。

主な通知:

- All-Star selections
- Market Deadline approaching
- Deadline completed
- Roster expansion begins
- Postseason eligibility cutoff
- Awards announced

Host selectionのように、不要なWorld-side操作をユーザーへ押し付けない。

Market Deadlineではユーザー自身が補強判断を行える。

---

# 13. League Event Profile Application

`LeagueSeasonEventProfile` はSection 2.1をSource of Truthとする。

World Default reference:

```text
All-Star              50%
Market                 72%
Roster Expansion       85%
PS Eligibility         90%
```

ただし実在Leagueの年度規則・日付、およびProfileのenabled / disabledが優先する。
Eventを持たないLeagueへdummy eventを生成しない。

---
# 14. Market Type Mapping

初期の大分類:

| League family | Deadline type |
| --- | --- |
| North America | Trade Deadline |
| Japan / Korea / Taiwan | Trade Deadline |
| Mexico / Caribbean | Trade Deadline / Hybrid (Profile-defined) |
| Europe 7 | Registration Window Close |
| China | Registration Window Close |
| West / South Asia | Registration Window Close |
| Pan-African | Registration Window Close |
| Australia | Trade Deadline / Hybrid (Profile-defined) |
| NZ / Pacific | Registration Window Close |

細かなLoan / FA例外はPlayer Market実装時に決める。

---

# 15. Historical Records & Event Snapshot

Season Historyへ重要Eventを保存する。

- Opening Day roster snapshot
- All-Star selections / MVP
- actual market-window dates
- deadline trades / transfers
- roster expansion promotions where enabled
- eligibility roster snapshots by Competition scope
- awards
- manager / GM market posture snapshot where retained

さらに:

```ts
type LeagueSeasonEventSnapshot = {
  seasonId: SeasonId;
  leagueId: LeagueId;
  eventProfileVersion: string;
  actualOpeningDay: CalendarDate;
  allStarEventId?: string;
  marketWindowSnapshots: readonly MarketWindowSnapshot[];
  rosterExpansionSnapshot?: RosterExpansionSnapshot;
  eligibilitySnapshots: readonly CompetitionEligibilitySnapshot[];
  awardPolicyVersion: string;
};
```

14のLeague Season Calendar Snapshotとlinkし、制度変更後も過去SeasonのEvent timing / ruleを当時の状態で復元する。
300年SimulationでもSeason Summaryから重要Eventだけを圧縮保持可能にする。

---
# 16. Final Approved Decisions — v1

1. Opening Day / All-Star / Market Window / Roster Expansion / Eligibility Cutoff / Awardsを共通Event familyとして採用する。
2. 全Leagueへ全Eventを強制しない。
3. `LeagueSeasonEventProfile` をversion管理する。
4. 実在Leagueは年度ごとの公式制度・日付を第一参照する。
5. fictional / football-derived LeagueのWorld Default referenceは50% / 72% / 85% / 90%。
6. Market WindowはTRADE_DEADLINE / REGISTRATION_WINDOW_CLOSE / HYBRIDを扱え、0..N個持てる。
7. Roster ExpansionはOptionalで、人数・eligible rosterはLeagueRosterProfileがSource of Truth。
8. Eligibility CutoffはOptionalかつCompetition scope別。
9. All-Star / Awardsは公開Ratingだけで決めずactual performance等のEvidenceを使う。
10. All-Star Breakは全員完全回復Eventではない。
11. DeadlineはClub AIへのMarket Decision Triggerであり、BUY/SELL判断自体はClub / Front Office側が所有する。
12. Waiver詳細はv1必須要件にしない。
13. AwardSelectionPolicyをversion管理し、過去Awardを現行基準で再判定しない。
14. Userへは重要なSeason節目だけを通知し、Event management choreにしない。
15. 各SeasonのEvent Profile / actual dates / eligibility snapshots / award policyを履歴保存する。

---
# 17. Historical Next-phase Note

基礎設計:

- `docs/game-design/16-club-economy-rivalry-design.md`

この文書完了後、次の設計対象を**球団そのもの**へ移す。

候補:

- club identity
- city / home region
- stadium
- ownership
- budget class
- fanbase
- reputation
- front office
- manager / coaching staff
- active roster
- reserve / farm / academy
- scouting
- medical / training facilities
- philosophy
- rivalries
- club history
- expansion / relocation

ただし全部を一度に作らず、まず`ClubProfile`のsource-of-truth境界から決める。

---

# 18. Final v1 Status

**Season Events & Deadlines v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

Remaining exact dates / roster counts / vote weights / waiver rules are versioned LeagueProfile or implementation calibration, not open architecture.