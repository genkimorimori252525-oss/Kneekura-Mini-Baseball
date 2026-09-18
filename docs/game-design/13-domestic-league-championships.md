# Domestic League Championships & Continental Qualification

更新日: 2026-09-19  
状態: **設計承認候補版。実装前。正確な試合数・ロスター人数・日付は後続校正。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/11-world-competition-architecture.md`
- `docs/game-design/12-competition-identity-hosting.md`

---

# 1. 目的

21 Full Leaguesについて、

- 国内王者をどう決めるか
- Regular Seasonの価値をどう残すか
- Postseasonをどの形式にするか
- Continental Champions League出場クラブをどう決めるか

を定義する。

全リーグを一つの形式へ統一しない。League Culture / Market Structureと同様、Competition Cultureにも違いを持たせる。

---

# 2. 恒久原則

## 2.1 Domestic titleとRegular Season titleを分離できる

Postseasonを持つLeagueでは、

```text
RegularSeasonWinner
DomesticChampion
```

を別の正史タイトルとして保存する。

Regular Season 1位がPostseasonで敗退しても、その年のRegular Season titleは消えない。TABLE_TITLE型では両者が同じClubになる。

## 2.2 Continental berthの「数」と「誰が出るか」を分離する

```text
Continental League Coefficient
  -> how many berths the domestic league receives

Domestic Competition Results
  -> which clubs fill those berths
```

LeagueCoefficientが高いからClubの能力値が上がることはない。

## 2.3 Domestic Championは原則Continental automatic berth

Asia / Americas / Europeでは、各Full LeagueのDomesticChampionが次回Continental CL本大会へのautomatic berthを持つ。Africa / Oceaniaは11で定義した地域固有枠に従う。

## 2.4 Duplicate berthは次順位へcascade

同じClubがdefending continental champion、domestic champion、coefficient berth position等を重複取得した場合、余ったdomestic route berthは次のeligible clubへ回す。

## 2.5 PostseasonはLeague-relative Ratingを変更しない

国内優勝・Regular Season順位・Playoff敗退は選手のtrue abilityや公開Ratingへ直接補正しない。Career / reputation / finance / history / MatchImportanceへは作用可能。

---

# 3. Domestic Championship Archetypes

## 3.1 TABLE_TITLE

年間順位表1位がDomesticChampion。Postseasonなし。

狙い:
- サッカー型クラブ文化との親和性
- 一年間の安定性を最大評価
- Continental berth順位が直感的

ContinentalQualificationOrder:

```text
1st
2nd
3rd
4th
5th ...
```

## 3.2 TOP4_SERIES

Regular Season上位4ClubがPostseason。

初期標準:

```text
Semifinal
1st vs 4th  best-of-5
2nd vs 3rd  best-of-5

Final
best-of-7
```

DomesticChampion = Final winner。

Qualification priority:

```text
1. DomesticChampion
2. RegularSeasonWinner
3. ChampionshipRunnerUp
4. remaining clubs by Regular Season standing
```

重複Clubはskipする。

## 3.3 CONFERENCE_SERIES

複数League / Conference / Zoneから代表を決め、国内Championship Seriesを行う。

共通qualification priority:

```text
1. DomesticChampion
2. ChampionshipRunnerUp
3. Regular-season conference / league / zone winners
4. remaining clubs by normalized Regular Season performance
```

同一Club重複はskip。異なるconferenceで試合数等が違う場合、単純勝数ではなくwinning percentage + defined tiebreakを使う。

## 3.4 LADDER

Regular Season順位がPostseason開始位置へ強く影響。

```text
4th vs 5th
 -> winner vs 3rd
 -> winner vs 2nd
 -> winner vs 1st
```

Qualification priority:

```text
1. DomesticChampion
2. RegularSeasonWinner
3. ChampionshipRunnerUp
4. remaining clubs by Regular Season standing
```

## 3.5 WINTER_ROUND_ROBIN

短いRegular Seasonの後、上位ClubだけでChampionship Roundを行う。

```text
Regular Season
 -> top 4

Championship Round
 -> double round robin

top 2
 -> Championship Series best-of-7
```

---

# 4. Asia

## 4.1 Japan League — CONFERENCE_SERIES

12 clubs。

```text
League A: 6 clubs
League B: 6 clubs
```

各LeagueでRegular Season pennantを争う。

Postseason:

```text
each league:
2nd vs 3rd
 -> best-of-3

winner vs 1st
 -> best-of-5

League A Champion vs League B Champion
 -> Japan Championship Series best-of-7
```

正史タイトル:
- League A Pennant
- League B Pennant
- League A Champion
- League B Champion
- Japan Domestic Champion

ABCL qualification priority:

```text
1. Japan Domestic Champion
2. League A Regular Season Pennant winner
3. League B Regular Season Pennant winner
4. Japan Championship Runner-Up
5+. remaining clubs by Regular Season winning percentage
```

重複はskip。

## 4.2 Korea League — LADDER

10 clubs、Single table。

Postseason:

```text
4th vs 5th
 -> best-of-3

winner vs 3rd
 -> best-of-5

winner vs 2nd
 -> best-of-5

winner vs 1st
 -> Korean Championship Series best-of-7
```

Regular Season 1位はFinalへ直行。

ABCL priority:

```text
1. DomesticChampion
2. RegularSeasonWinner
3. ChampionshipRunnerUp
4+. Regular Season standing
```

## 4.3 Taiwan League — TOP4_SERIES

8 clubs、Single annual table。

- 1st vs 4th: best-of-5
- 2nd vs 3rd: best-of-5
- Final: best-of-7

Split-season champion制は初期標準にしない。将来Competition Reformとして導入可能。

ABCL qualificationはTOP4_SERIES共通order。

Taiwan seasonはNovemberまでを許すが、ABCL windowと衝突するeditionでは11のFlex Windowを使う。

## 4.4 China League — TOP4_SERIES

10 clubs。

- SF best-of-5
- Final best-of-7

ABCL qualificationはTOP4_SERIES共通order。

14Club以上へ拡大した場合はTop6化をCompetition Reform候補とする。

## 4.5 West / South Asia League — TABLE_TITLE

12 clubs。初期標準ではPostseasonなし。

年間table 1位がDomesticChampion。

ABCL qualification:

```text
1st
2nd
3rd
4th
5th
```

Coefficientで与えられたberth数まで上から取得。

---

# 5. Americas

## 5.1 North America Major League — CONFERENCE_SERIES

30 clubs。

```text
American Conference: 15
National Conference: 15

each:
  3 divisions x 5 clubs
```

各Conference 6 playoff clubs:
- 3 division winners
- 3 wild cards

Postseason:

```text
Wild Card Round
 -> best-of-3

Division Round
 -> best-of-5

Conference Championship
 -> best-of-7

North America Championship
 -> best-of-7
```

AmBCL qualification:

```text
1. DomesticChampion
2. ChampionshipRunnerUp
3+. best Regular Season records among remaining clubs
```

Division titleはseeding価値を持つが、Continental berthで高勝率Clubを恒久的に飛び越える仕組みにはしない。

## 5.2 Mexico League — CONFERENCE_SERIES

20 clubs。

```text
North Zone: 10
South Zone: 10
```

各Zone上位4がPostseason。

- Zone Semifinals: best-of-5
- Zone Final: best-of-7
- Mexico Championship: best-of-7

AmBCL qualification:

```text
1. DomesticChampion
2. ChampionshipRunnerUp
3. North Regular Season winner
4. South Regular Season winner
5+. remaining clubs by Regular Season performance
```

## 5.3 Dominican League — WINTER_ROUND_ROBIN

6 clubs。

```text
Regular Season
 -> top 4

Championship Round
 -> double round robin

top 2
 -> Final best-of-7
```

正史タイトル:
- Regular Season Winner
- Championship Round Winner
- DomesticChampion

AmBCL qualification:

```text
1. DomesticChampion
2. Final Runner-Up
3. Championship Round 3rd
4. Championship Round 4th
5+. Regular Season standing
```

## 5.4 Venezuela League — TOP4_SERIES

8 clubs。

- SF best-of-5
- Final best-of-7

AmBCL qualificationはTOP4_SERIES共通order。

## 5.5 Puerto Rico League — TOP4_SERIES

6 clubs。Regular Season上位4。

- SF best-of-5
- Final best-of-7

Regular Season 1位にはhome-field priority、postseason seeding、Continental qualification priorityを持たせる。

## 5.6 Cuba League — CONFERENCE_SERIES

16 clubs。

```text
West Zone: 8
East Zone: 8
```

各Zone上位4。

- Zone semifinal: best-of-5
- Zone final: best-of-5
- Cuba Championship: best-of-7

AmBCL qualification:

```text
1. DomesticChampion
2. ChampionshipRunnerUp
3. West Regular Season winner
4. East Regular Season winner
5+. Regular Season performance
```

---

# 6. Europe — TABLE_TITLE Family

欧州7 Full Leaguesは初期Competition CultureとしてTABLE_TITLEを共通採用する。

対象:
- Netherlands
- Germany
- France
- Spain
- United Kingdom
- Italy
- Russia

各Leagueの年間table 1位がDomesticChampion。Postseasonなし。

EBCL qualification:

```text
1st -> automatic champion berth
2nd -> first coefficient berth
3rd -> second coefficient berth
4th -> third coefficient berth
5th -> fourth coefficient berth
```

理由:
- Player MarketだけでなくCompetition CultureにもFootball influenceを持たせる
- 一年間のleague tableに重みがある
- EBCL qualificationが直感的
- League title raceとContinental raceを同時に楽しめる

Domestic Cupは将来候補だが初期設計には入れない。

---

# 7. Africa

## 7.1 Pan-African League — TABLE_TITLE

12 clubs、跨国league。

年間table 1位がDomesticChampion。Postseasonなし。

AfBCL initial qualification:

```text
1st
2nd
3rd
4th
```

の4clubがAfBCLへ。残り4clubはAfrican regional qualifiersから。

---

# 8. Oceania

## 8.1 Australia League — TOP4_SERIES

8 clubs。

- SF best-of-3
- Final best-of-5

short-season leagueなのでAmericas / East Asiaよりseriesを短くする。

OBCL initial qualification: Australia 3 clubs。

Priority:

```text
1. DomesticChampion
2. RegularSeasonWinner
3. ChampionshipRunnerUp
```

重複時はRegular Season次順位。

## 8.2 New Zealand / Pacific League — TABLE_TITLE

8 clubs。Postseasonなし。

年間table 1位がDomesticChampion。

OBCL initial qualification:

```text
1st
2nd
3rd
```

---

# 9. 21-League Summary

| Region | League | Clubs | Domestic format |
| --- | --- | ---: | --- |
| Asia | Japan | 12 | Conference Series |
| Asia | Korea | 10 | Ladder |
| Asia | Taiwan | 8 | Top-4 Series |
| Asia | China | 10 | Top-4 Series |
| Asia | West / South Asia | 12 | Table Title |
| Americas | North America | 30 | Conference Series |
| Americas | Mexico | 20 | Conference Series |
| Americas | Dominican | 6 | Winter Round Robin |
| Americas | Venezuela | 8 | Top-4 Series |
| Americas | Puerto Rico | 6 | Top-4 Series |
| Americas | Cuba | 16 | Conference Series |
| Europe | Netherlands | 10 | Table Title |
| Europe | Germany | 12 | Table Title |
| Europe | France | 10 | Table Title |
| Europe | Spain | 10 | Table Title |
| Europe | United Kingdom | 10 | Table Title |
| Europe | Italy | 12 | Table Title |
| Europe | Russia | 10 | Table Title |
| Africa | Pan-African | 12 | Table Title |
| Oceania | Australia | 8 | Top-4 Series |
| Oceania | New Zealand / Pacific | 8 | Table Title |

---

# 10. Continental Qualification Contract

実装では大会固有if文を散らさず、各LeagueProfileがqualification orderを返す。

概念:

```ts
type DomesticQualificationResult = {
  domesticChampion: ClubId;
  regularSeasonWinner: ClubId;
  orderedContinentalCandidates: readonly ClubId[];
};

type ContinentalBerthAllocation = {
  leagueId: LeagueId;
  berthCount: number;
  defendingChampionOverrides: readonly ClubId[];
};
```

処理:

```text
LeagueCoefficient
 -> berthCount

Domestic League Profile
 -> orderedContinentalCandidates

duplicate / already-qualified clubs skipped
 -> next eligible club

final continental entrants
```

---

# 11. Tiebreak Principles

TABLE_TITLEで同率の場合、初期標準:

1. head-to-head winning percentage
2. run differential with per-game cap
3. runs allowed
4. defined tiebreak game

優勝・CL出場が懸かる完全同率では、可能ならtiebreak gameを優先するCompetitionProfileも許可。

---

# 12. Domestic Home-field Advantage

Domestic PostseasonではRegular Season上位へhome-field advantageを与える。

```text
higher seed
 -> more home games / hosting right
```

であり、hidden ability buffではない。

Home advantageはStadiumProfile、travel、crowd、venue familiarityなど実際の環境から生じる。

---

# 13. Calendar Connection

Domestic seasonはContinental WindowまでにChampion / qualification orderを確定できるよう設計する。

- Europe domestic season ends -> October EBCL
- Japan / Korea postseason -> November ABCL
- Americas summer + winter qualification seasons -> February AmBCL
- Pan-Africa -> April AfBCL
- Australia / NZ-Pacific -> March OBCL

台湾やWest/South Asia等でwindowが衝突する場合は11のFlex Window / Continental Breakを使う。

---

# 14. Historical Records

国内記録として別々に保存する。

- Domestic Championships
- Regular Season titles / pennants
- Conference / Zone titles
- Postseason appearances
- Continental qualifications
- Continental qualification streaks
- table runner-up / playoff runner-up
- all-time domestic wins

これにより「20年間でDomesticChampionは3回だがRegular Season 1位は8回」のようなClub historyを残せる。

---

# 15. Competition Reform

World simulation中にLeague expansion / contractionが起きた場合、Domestic formatは明示的なCompetition Reformで変更可能。

例:

```text
China 10 -> 14 clubs
  -> Top4 remains initially
  -> later reform
  -> Top6 postseason
```

改革は能力値やLeague Strengthを理由に自動発動しない。League governance / calendar / commercial context側のWorld Eventとして扱う。

---

# 16. 今回の設計判断

1. DomesticChampionとRegularSeasonWinnerを必要に応じて分離
2. Asia / Americas / EuropeのDomesticChampionはContinental automatic berth
3. LeagueCoefficientがberth数、Domestic Resultが出場clubを決める
4. Europe 7 leaguesはTABLE_TITLE / no postseason
5. West/South Asia、Pan-Africa、NZ/PacificもTABLE_TITLE
6. Japan / North America / Mexico / CubaはCONFERENCE_SERIES
7. KoreaはLADDER
8. DominicanはWINTER_ROUND_ROBIN
9. Taiwan / China / Venezuela / Puerto Rico / AustraliaはTOP4_SERIES
10. Domestic postseasonはseries制を許し、国際Knockoutのsingle-game philosophyとは分離
11. CL qualification duplicateはnext eligible clubへcascade
12. Regular Season上位の価値をhome-field / bye / qualification orderで保証
13. Domestic title / pennant / continental qualificationを長期履歴として別保存

---

# 17. 後続校正

- exact regular-season game counts
- balanced vs unbalanced schedules
- division alignment
- Japan two-league names
- North America conference / division names
- series home-game patterns
- rainout / suspended-game policy
- exact postseason calendar
- roster expansion rules
- tiebreak-game scheduling
- future domestic cups
