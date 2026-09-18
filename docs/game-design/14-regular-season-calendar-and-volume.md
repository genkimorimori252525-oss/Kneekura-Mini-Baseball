# Regular Season Calendar & Game Volume

更新日: 2026-09-19  
状態: **設計承認候補版。実装前。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/11-world-competition-architecture.md`
- `docs/game-design/12-competition-identity-hosting.md`
- `docs/game-design/13-domestic-league-championships.md`

---

# 1. 目的

21 Full Leaguesについて、Regular Seasonの:

- 試合数
- 開催期間
- 週あたり試合密度
- series構成
- Postseason用window
- Continental / National Competitionとの接続

を定義する。

設計目標は「全リーグを同じ長さにする」ことではない。

Leagueごとに:

```text
season length
+ competition culture
+ climate / geography
+ postseason structure
+ continental calendar
```

を組み合わせ、異なる年間リズムを持たせる。

---

# 2. 恒久原則

## 2.1 Season WindowとRegular Season Windowは分ける

例えば:

```text
League season: March–October

Regular Season: March–September
Postseason: October
```

のように扱う。

`LeagueSeasonWindow` はRegular Seasonだけでなく、Postseason / tiebreak / make-up dateを含む。

## 2.2 World Competition Windowが優先

11で定義した優先順位を維持する。

WBC / Club World / Premier 12 / Regional National Championship等と衝突する場合:

- Opening Day shift
- scheduled league break
- makeup date
- continental flex window

で解消する。

試合を二重登録しない。

## 2.3 International participationで国内試合数を自動削減しない

CLへ出場したClubだけRegular Seasonを少なくする方式は採らない。

必要な休養・移動はcalendar breakとoff-dayで吸収する。

## 2.4 Fatigueは日程から因果的に発生する

```text
dense schedule
 -> less recovery time
 -> fatigue state
 -> actual player decisions / movement / performance
```

とする。

`gamesPerWeek`を直接能力Debuffへ変換しない。

## 2.5 試合数はLeague Identity

162-game leagueと42-game leagueは同じ「年間成績」の意味を持たない。

記録比較では:

- raw totals
- rate stats
- era / league context
- games played

を区別する。

---

# 3. Schedule Density Classes

## LONG_DENSE

目安:
- 5.5〜6.5 games / week
- 長いRegular Season
- rotation depth / bench depthの価値が高い

対象:
- North America

## STANDARD_DENSE

目安:
- 4.5〜5.5 games / week

対象:
- Japan
- Korea
- Mexico
- Cuba

## STANDARD

目安:
- 3.5〜4.5 games / week

対象:
- Taiwan
- China
- West / South Asia
- Dominican
- Venezuela
- Puerto Rico
- Pan-Africa

## WEEKEND_SERIES

目安:
- 2.5〜3.5 games / week
- 3-game weekend series中心

対象:
- Europe
- Australia
- New Zealand / Pacific

これはschedule generation用のtargetであり、毎週必ず同じ試合数にする規則ではない。

---

# 4. Asia

## 4.1 Japan League

- clubs: 12
- Regular Season games / club: **120**
- Regular Season: **late March–late September**
- Postseason: **October**
- ABCL: **November**
- density: **STANDARD_DENSE**
- target: 約4.4 games / week

Two-league schedule:

```text
same-league opponents:
5 x 18 = 90

other-league opponents:
6 x 5 = 30

total = 120
```

同一League opponentはhome 9 / away 9。

Interleagueのhome / away不均衡は複数seasonでrotationする。

### Series rhythm

主に3-game series。

原則:
- Tuesday–Thursday
- Friday–Sunday
- Monday rest / travel

ただし全週6試合にはせず、calendar上に追加off-dayを配置する。

### Cycle Year 2 WBC

March WBC終了後にOpening Day。

WBC参加選手へhidden fatigue resetは与えない。

---

## 4.2 Korea League

- games: **126**
- Regular Season: **late March–September**
- Postseason: **October**
- ABCL: **November**
- density: **STANDARD_DENSE**
- target: 約4.7 games / week

Balanced schedule:

```text
9 opponents x 14
= 126
```

7 home / 7 away per opponent。

主に3-game series。

---

## 4.3 Taiwan League

- games: **98**
- Regular Season: **March–October**
- Postseason: **late October–early November**
- ABCL: **November Flex Window**
- density: **STANDARD**
- target: 約3.2 games / week

Balanced:

```text
7 opponents x 14
= 98
```

7 home / 7 away。

ABCL出場Clubの日程が重なる場合、ABCLをlate November / early Decemberへshift可能。

---

## 4.4 China League

- games: **90**
- Regular Season: **April–August**
- Postseason: **September**
- ABCL preparation: **October**
- ABCL: **November**
- density: **STANDARD**
- target: 約4.0 games / week

Balanced:

```text
9 opponents x 10
= 90
```

5 home / 5 away。

---

## 4.5 West / South Asia League

- games: **66**
- Regular Season: **late November–March**
- postseason: none
- density: **STANDARD**
- target: 約3.5〜4.0 games / week

Balanced:

```text
11 opponents x 6
= 66
```

3 home / 3 away。

### ABCL conflict

ABCLは原則November。

このLeagueのABCL参加Clubについては:

```text
ABCL
 -> delayed domestic opening
 -> protected makeup windows
```

を使う。

全Leagueを止める必要はなく、参加Clubの日程だけ後ろへ再配置可能。

---

# 5. Americas

## 5.1 North America Major League

- games: **162**
- Regular Season: **late March–September**
- Postseason: **October**
- AmBCL: **February**
- density: **LONG_DENSE**
- target: 約6.0 games / week

Scheduleは意図的にunbalanced。

Division / Conference / inter-conference対戦を持つ。

正確なopponent matrixはschedule generator実装で固定するが、全Clubの総試合数は162で一致させる。

### Rhythm

典型:

- 3-game series
- 4-game series
- 1 off-day / week前後
- long road trips

travel distanceもCalendarStateへ残せる。

### WBC year

Cycle Year 2はWBC終了後にRegular Season開幕。

---

## 5.2 Mexico League

- games: **120**
- Regular Season: **April–August**
- Postseason: **September**
- AmBCL: **February next qualification window**
- density: **STANDARD_DENSE**
- target: 約5.3 games / week

Base matrix:

```text
19 opponents x 6 = 114
+ 6 zone / rivalry games
= 120
```

追加6試合のhome / awayはseason rotation。

---

## 5.3 Dominican League

- games: **50**
- Regular Season: **October–December**
- Championship Round + Final: **December–January**
- AmBCL: **February**
- density: **STANDARD**
- target: 約4.0〜4.5 games / week

Balanced:

```text
5 opponents x 10
= 50
```

5 home / 5 away。

---

## 5.4 Venezuela League

- games: **56**
- Regular Season: **October–December**
- Postseason: **January**
- AmBCL: **February**
- density: **STANDARD**
- target: 約4.5 games / week

Balanced:

```text
7 opponents x 8
= 56
```

4 home / 4 away。

---

## 5.5 Puerto Rico League

- games: **40**
- Regular Season: **November–December**
- Postseason: **January**
- AmBCL: **February**
- density: **STANDARD**
- target: 約4.5〜5.0 games / week

Balanced:

```text
5 opponents x 8
= 40
```

4 home / 4 away。

---

## 5.6 Cuba League

- games: **90**
- Regular Season: **September–December**
- Postseason: **January**
- AmBCL: **February**
- density: **STANDARD_DENSE**
- target: 約5.0〜5.5 games / week

Balanced:

```text
15 opponents x 6
= 90
```

3 home / 3 away。

ZoneはPostseason path / rivalry identityのために保持する。

---

# 6. Europe

欧州7LeagueはRegular Season + EURO_TOP4 Postseason。

基本リズムは**週末3連戦中心**。

平日試合は:

- makeup
- holiday fixture
- schedule compression
- special rivalry

で使用可能。

## 6.1 Netherlands

- clubs: 10
- games: **54**
- Regular Season: **April–August**
- Postseason: **September**
- EBCL: **October**
- density: **WEEKEND_SERIES**
- target: 約2.7 games / week

```text
9 opponents x 6
= 54
```

## 6.2 Germany

- clubs: 12
- games: **66**
- Regular Season: **April–August**
- Postseason: **September**
- EBCL: **October**
- density: **WEEKEND_SERIES**
- target: 約3.3 games / week

```text
11 x 6
= 66
```

## 6.3 France

- clubs: 10
- games: **54**
- Regular Season: **April–August**
- Postseason: **September**
- EBCL: **October**
- density: **WEEKEND_SERIES**

## 6.4 Spain

- clubs: 10
- games: **54**
- Regular Season: **late March–August**
- Postseason: **September**
- EBCL: **October**
- density: **WEEKEND_SERIES**

Cycle Year 2ではWBC後にOpening Dayをshift可能。

## 6.5 United Kingdom

- clubs: 10
- games: **54**
- Regular Season: **April–August**
- Postseason: **September**
- EBCL: **October**
- density: **WEEKEND_SERIES**

## 6.6 Italy

- clubs: 12
- games: **66**
- Regular Season: **March–August**
- Postseason: **September**
- EBCL: **October**
- density: **WEEKEND_SERIES**

Cycle Year 2はWBC windowを優先。

## 6.7 Russia

- clubs: 10
- games: **54**
- Regular Season: **May–August**
- Postseason: **September**
- EBCL: **October**
- density: **WEEKEND_SERIES**
- target: 約3.2 games / week

短いclimate windowのため、他の欧州Leagueより平日seriesを使用しやすい。

---

# 7. Africa

## 7.1 Pan-African League

- clubs: 12
- games: **66**
- Regular Season: **November–March**
- Postseason: none
- AfBCL: **April**
- density: **STANDARD**
- target: 約3.5 games / week

Balanced:

```text
11 x 6
= 66
```

長距離移動を抑えるため:

- 3-game series
- regional road-trip blocks
- consecutive nearby away series

をSchedule Generatorが優先する。

---

# 8. Oceania

## 8.1 Australia League

- clubs: 8
- games: **42**
- Regular Season: **November–January**
- Postseason: **February**
- OBCL: **March**
- density: **WEEKEND_SERIES**
- target: 約3.5 games / week

Balanced:

```text
7 x 6
= 42
```

3 home / 3 away。

## 8.2 New Zealand / Pacific League

- clubs: 8
- games: **42**
- Regular Season: **November–February**
- Postseason: none
- OBCL: **March**
- density: **WEEKEND_SERIES**
- target: 約2.7 games / week

Balanced:

```text
7 x 6
= 42
```

Pacific travelを考慮し、away seriesをblock化する。

---

# 9. 21-League Volume Summary

| Region | League | Games | Regular Season | Postseason |
| --- | --- | ---: | --- | --- |
| Asia | Japan | 120 | Mar–Sep | Oct |
| Asia | Korea | 126 | Mar–Sep | Oct |
| Asia | Taiwan | 98 | Mar–Oct | Oct–Nov |
| Asia | China | 90 | Apr–Aug | Sep |
| Asia | West / South Asia | 66 | Nov–Mar | none |
| Americas | North America | 162 | Mar–Sep | Oct |
| Americas | Mexico | 120 | Apr–Aug | Sep |
| Americas | Dominican | 50 | Oct–Dec | Dec–Jan |
| Americas | Venezuela | 56 | Oct–Dec | Jan |
| Americas | Puerto Rico | 40 | Nov–Dec | Jan |
| Americas | Cuba | 90 | Sep–Dec | Jan |
| Europe | Netherlands | 54 | Apr–Aug | Sep |
| Europe | Germany | 66 | Apr–Aug | Sep |
| Europe | France | 54 | Apr–Aug | Sep |
| Europe | Spain | 54 | Mar–Aug | Sep |
| Europe | United Kingdom | 54 | Apr–Aug | Sep |
| Europe | Italy | 66 | Mar–Aug | Sep |
| Europe | Russia | 54 | May–Aug | Sep |
| Africa | Pan-African | 66 | Nov–Mar | none |
| Oceania | Australia | 42 | Nov–Jan | Feb |
| Oceania | New Zealand / Pacific | 42 | Nov–Feb | none |

---

# 10. Series Scheduling

Domestic Leagueは原則series単位でscheduleする。

```ts
type DomesticSeries = {
  homeClubId: ClubId;
  awayClubId: ClubId;
  gameCount: 2 | 3 | 4;
  startDate: CalendarDate;
};
```

標準は3-game series。

例外:

- North America: 3 / 4-game
- domestic postseason: CompetitionProfile定義
- makeup: single-game
- compressed winter schedule: 2-game / 3-game
- special rivalry: 4-game

Schedule Generatorはgame単位でランダム配置せず、series blockを基本単位にする。

---

# 11. Rest & Recovery Calendar

各Leagueは`MinimumOffDayPolicy`を持つ。

初期原則:

## LONG_DENSE

- 原則7日間で最低1日off候補
- 連戦上限は例外を除き14日未満を目標

## STANDARD_DENSE

- 週1〜2 off-day
- 9〜12連戦を上限目標

## STANDARD

- 週2前後off-day
- 長距離移動後はadditional recovery候補

## WEEKEND_SERIES

- 平日をrest / training / travelへ使う
- makeupで平日試合が増える場合はfatigueへ自然反映

`off-day`は完全回復イベントではない。

RecoveryCapacity / travel / injury / sleep-like recovery model等の実状態から回復量を決める。

---

# 12. Rainout / Postponement Budget

Regular Season Window内に`MakeupReserveDates`を確保する。

試合中止時:

```text
postponed
 -> nearest valid reserve date
 -> doubleheader candidate if rules permit
 -> end-of-season reserve
```

の順に再配置。

Continental / World Competitionへ食い込む場合、その大会windowを優先し、国内試合を前倒しまたは別reserve dateへ送る。

未消化試合を「勝率補正」で消すことは原則しない。

---

# 13. WBC / Premier / Club World Interaction

## WBC — Cycle Year 2

March開催。

影響:
- Japan / Korea / North America / Spain / Italy等はOpening Dayを後ろへshift
- Spring preparationを短縮可能
- WBC参加選手はfatigue / injury stateをそのまま所属Clubへ戻す

## Premier 12 — Cycle Year 4

November開催。

影響:
- West / South Asia
- Dominican
- Venezuela
- Puerto Rico
- Pan-Africa
- Australia
- NZ / Pacific

等の冬季LeagueはOpening Weekを調整、またはofficial breakを設ける。

## Club World — Cycle Year 3

December開催。

qualified clubが所属する冬季Leagueはofficial Club World Breakを設定する。

---

# 14. Schedule Generation Contract

概念:

```ts
type LeagueCalendarProfile = {
  regularSeasonGamesPerClub: number;
  regularSeasonWindow: DateWindow;
  postseasonWindow?: DateWindow;
  densityClass: ScheduleDensityClass;
  preferredSeriesLength: number;
  opponentMatrix: OpponentMatrixPolicy;
  continentalWindows: readonly DateWindow[];
  nationalTeamWindows: readonly DateWindow[];
  minimumOffDayPolicy: MinimumOffDayPolicy;
  makeupReserveDates: readonly CalendarDate[];
};
```

生成順:

```text
World major competition windows
 -> Continental windows
 -> Domestic postseason
 -> Domestic regular-season series
 -> reserve / makeup dates
 -> travel / off-day optimization
```

この順序により、後から国際大会を国内scheduleへ無理やり挿入しない。

---

# 15. Calendar Determinism

同じ:

- World start year
- LeagueCalendarProfile
- Competition calendar
- club alignment
- schedule seed
- calendar generator version

なら同じScheduleを生成する。

Schedule RNGはMatch Physics RNGから完全分離する。

---

# 16. Design Audit

確認:

- Japan 120 = 90 same-league + 30 interleague
- Korea 126 = 9 x 14
- Taiwan 98 = 7 x 14
- China 90 = 9 x 10
- West / South Asia 66 = 11 x 6
- Mexico 120 = 114 base + 6 additional
- Dominican 50 = 5 x 10
- Venezuela 56 = 7 x 8
- Puerto Rico 40 = 5 x 8
- Cuba 90 = 15 x 6
- Europe 10-club leagues 54 = 9 x 6
- Europe 12-club leagues 66 = 11 x 6
- Pan-Africa 66 = 11 x 6
- Oceania 42 = 7 x 6
- Domestic Champions are decided before their target Continental window
- WBC / Premier / Club World have explicit domestic-calendar escape rules
- no schedule density directly modifies true ability

North America 162はunbalanced opponent matrixのため、詳細matrixをSchedule Generator設計へ委譲する。

重大な算術矛盾は現時点でない。

---

# 17. 今回の初期採用値

| League | Games |
| --- | ---: |
| Japan | 120 |
| Korea | 126 |
| Taiwan | 98 |
| China | 90 |
| West / South Asia | 66 |
| North America | 162 |
| Mexico | 120 |
| Dominican | 50 |
| Venezuela | 56 |
| Puerto Rico | 40 |
| Cuba | 90 |
| Netherlands | 54 |
| Germany | 66 |
| France | 54 |
| Spain | 54 |
| United Kingdom | 54 |
| Italy | 66 |
| Russia | 54 |
| Pan-African | 66 |
| Australia | 42 |
| New Zealand / Pacific | 42 |

---

# 18. 後続校正

- North America exact 162-game opponent matrix
- Mexico extra 6 rivalry-game allocation
- Taiwan / ABCL exact November collision handling
- rainout / doubleheader rules
- exact travel-cost optimization
- weekday / weekend preferences per league
- public holiday scheduling
- day / night game preferences
- All-Star break
- trade deadline
- roster expansion date
- minor / reserve league calendars
- national-team regional championship exact window
