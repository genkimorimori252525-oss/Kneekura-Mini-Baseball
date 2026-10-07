# Domestic League Championships & Continental Qualification — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> 21 Full LeaguesのDomestic Championship方式・Continental Qualification順・Title保存境界はv1としてFreeze済み。
> exact Regular Season game count / calendar / rainout / roster expansion等は14 / 15 / LeagueProfile calibrationであり、open architectureではない。

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/11-world-competition-architecture.md`
- `docs/game-design/12-competition-identity-hosting.md`
- `docs/game-design/14-regular-season-calendar-and-volume.md`
- `docs/game-design/15-season-events-and-deadlines.md`

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

Asia-Pacific / Americas / Europeでは、各Full LeagueのDomesticChampionが次回Continental CL本大会へのautomatic berthを持つ。Africaは11で定義した地域固有枠に従う。

## 2.4 Duplicate berthは次順位へcascade

同じClubがdefending continental champion、domestic champion、coefficient berth position等を重複取得した場合、余ったdomestic route berthは次のeligible clubへ回す。

## 2.5 PostseasonはLeague-relative Ratingを変更しない

国内優勝・Regular Season順位・Playoff敗退は選手のtrue abilityや公開Ratingへ直接補正しない。Career / reputation / finance / history / MatchImportanceへは作用可能。

---

# 2.6 LeagueCompetitionProfile — CANONICAL

各Full Leagueの優勝決定方式・Postseason構造・qualification orderはversioned `LeagueCompetitionProfile` として保持する。

概念:

```ts
type LeagueCompetitionProfile = {
  version: string;
  championshipFormat: DomesticChampionshipArchetype;
  postseasonSeriesPolicy: PostseasonSeriesPolicy;
  qualificationOrderPolicy: QualificationOrderPolicy;
  standingsTiebreakPolicyVersion: string;
  homeFieldPolicyVersion: string;
};
```

初期21 Leagueの本書記載方式を **v1 Profile** として採用する。

将来のClub数変更・League改革・Postseason変更はProfileをin-place mutationせず、新versionとして次Season以降へ適用する。

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

## 3.2.1 EURO_TOP4

欧州用の「年間順位表重視 + 短いPostseason」型。

Regular Season 1位を独立した正史タイトルとして保存する。

```text
Regular Season
 -> 1st = RegularSeasonChampion

top 4
 -> SF: 1st vs 4th  best-of-3
 -> SF: 2nd vs 3rd  best-of-3
 -> Final best-of-5
 -> DomesticChampion
```

Regular Seasonの価値を消さないため、上位seedへ以下を与える。

- semifinal home-field advantage
- Final home-field priority
- Continental qualification priority
- RegularSeasonChampion title / historical record

Continental qualification priority:

```text
1. DomesticChampion
2. RegularSeasonChampion
3. ChampionshipRunnerUp
4+. Regular Season standing
```

同一Club重複はskipする。

Postseasonは「年間順位を無意味にするリセット」ではなく、上位4だけが進めるSeason Finaleとして扱う。

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

## 3.6 TOP2_FINAL

小規模4Club League向け。

```text
Regular Season
 -> top 2

Final
 -> best-of-5
```

Regular Season 1位は独立した `RegularSeasonChampion`。

DomesticChampion = Final winner。

Continental qualification priority:

```text
1. DomesticChampion
2. RegularSeasonChampion
3+. Regular Season standing
```


---

# 4. Asia-Pacific — Asian subregion

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

APBCL qualification priority:

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

APBCL priority:

```text
1. DomesticChampion
2. RegularSeasonWinner
3. ChampionshipRunnerUp
4+. Regular Season standing
```

## 4.3 Taiwan League — TOP4_SERIES

6 clubs、Single annual table。

- 1st vs 4th: best-of-5
- 2nd vs 3rd: best-of-5
- Final: best-of-7

Split-season champion制は初期標準にしない。将来Competition Reformとして導入可能。

APBCL qualificationはTOP4_SERIES共通order。

Taiwan seasonはNovemberまでを許すが、APBCL windowと衝突するeditionでは11のFlex Windowを使う。

## 4.4 China League — TOP4_SERIES

10 clubs。

- SF best-of-5
- Final best-of-7

APBCL qualificationはTOP4_SERIES共通order。

14Club以上へ拡大した場合はTop6化をCompetition Reform候補とする。

## 4.5 West / South Asia League — TABLE_TITLE

12 clubs。初期標準ではPostseasonなし。

年間table 1位がDomesticChampion。

APBCL qualification:

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

# 6. Europe — EURO_TOP4 Family

欧州7 Full Leaguesは、初期Competition Cultureとして **EURO_TOP4** を共通採用する。

対象:
- Netherlands
- Germany
- France
- Spain
- United Kingdom
- Italy
- Russia

## Regular Season

各Leagueは年間順位表を持ち、1位を **RegularSeasonChampion** として正史保存する。

これはPostseason結果とは独立したタイトル。

## Postseason

上位4Clubのみ進出。

```text
Semifinal
1st vs 4th  best-of-3
2nd vs 3rd  best-of-3

Final
best-of-5
```

Final勝者がDomesticChampion。

Regular Season上位にはhome-field advantageを与える。

## EBCL qualification

CoefficientによるそのLeagueのberth数に応じて:

```text
1. DomesticChampion
2. RegularSeasonChampion
3. ChampionshipRunnerUp
4+. Regular Season standing
```

重複Clubはskipする。

例:

```text
2 berths:
DomesticChampion
RegularSeasonChampion

3 berths:
+ ChampionshipRunnerUp

4 berths:
+ highest remaining Regular Season club
```

## 理由

欧州ではFootball influenceを残しながら、野球ゲームとしてのSeason Finaleも持たせる。

- 年間tableの価値を残す
- 1位には独立タイトルが残る
- Top 4以外はPSへ進めない
- 短いseriesで野球らしい投手層・rotationも問える
- EBCL出場争いがRegular Season終盤まで続く
- 国内王者と年間1位が別Clubになる歴史も生まれる

Domestic Cupは将来候補だが、初期設計には入れない。

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

# 8. Asia-Pacific — Oceania subregion

## 8.1 Australia League — TOP2_FINAL

4 clubs。2026 ABL実在Club構成へ合わせる。

```text
Regular Season
 -> top 2

Final
 -> best-of-5
```

Regular Season 1位は独立したRegularSeasonChampion。

APBCL qualification priority:

```text
1. DomesticChampion
2. RegularSeasonChampion
3+. Regular Season standing
```

DomesticChampionはautomatic APBCL berth。

## 8.2 New Zealand / Pacific League — TABLE_TITLE

8 clubs。Postseasonなし。

年間table 1位がDomesticChampion。

APBCL qualification:

```text
1st = DomesticChampion automatic berth
2nd+ = coefficient berth candidates
```

New Zealand / Pacificも他のAsia-Pacific Full Leagueと同じAPBCL qualification contractを使う。

---

# 9. 21-League Summary

| Region | League | Clubs | Domestic format |
| --- | --- | ---: | --- |
| Asia-Pacific | Japan | 12 | Conference Series |
| Asia-Pacific | Korea | 10 | Ladder |
| Asia-Pacific | Taiwan | 6 | Top-4 Series |
| Asia-Pacific | China | 10 | Top-4 Series |
| Asia-Pacific | West / South Asia | 12 | Table Title |
| Americas | North America | 30 | Conference Series |
| Americas | Mexico | 20 | Conference Series |
| Americas | Dominican | 6 | Winter Round Robin |
| Americas | Venezuela | 8 | Top-4 Series |
| Americas | Puerto Rico | 6 | Top-4 Series |
| Americas | Cuba | 16 | Conference Series |
| Europe | Netherlands | 10 | Europe Top-4 |
| Europe | Germany | 12 | Europe Top-4 |
| Europe | France | 10 | Europe Top-4 |
| Europe | Spain | 10 | Europe Top-4 |
| Europe | United Kingdom | 10 | Europe Top-4 |
| Europe | Italy | 12 | Europe Top-4 |
| Europe | Russia | 10 | Europe Top-4 |
| Africa | Pan-African | 12 | Table Title |
| Asia-Pacific | Australia | 4 | Top-2 Final |
| Asia-Pacific | New Zealand / Pacific | 8 | Table Title |

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
- Japan / Korea postseason -> November APBCL
- Americas summer + winter qualification seasons -> February AmBCL
- Pan-Africa -> April AfBCL
- Australia / NZ-Pacific -> November APBCL, using the preceding completed domestic `QualificationSeasonId`; active domestic season takes a Continental Break

台湾やWest/South Asia等でwindowが衝突する場合は11のFlex Window / Continental Breakを使う。

---

# 13.1 Continental Qualification Provenance — CANONICAL

Continental berthは最終出場Clubだけでなく、**なぜそのClubが出場したか**を保存する。

概念:

```ts
type ContinentalQualificationProvenance = {
  competitionEditionId: CompetitionEditionId;
  leagueId: LeagueId;
  sourceType:
    | "DOMESTIC_CHAMPION"
    | "REGULAR_SEASON_CHAMPION"
    | "RUNNER_UP"
    | "LEAGUE_COEFFICIENT_BERTH"
    | "DEFENDING_CHAMPION_CASCADE"
    | "OTHER_PROFILE_DEFINED";
  originalCandidateClubId: ClubId;
  eligibilityResult: EligibilityResult;
  cascadeReason?: string;
  finalRecipientClubId: ClubId;
};
```

DomesticChampionは原則automatic qualification routeを持つが、通常のCompetition eligibility checkは通す。

```text
Domestic Champion
 -> automatic route
 -> eligibility check
 -> entrant
    or deterministic cascade
```

将来Club消滅 / registration failure / sanction / rule-profile上のineligibility等があっても、資格を無理に貫通させない。

Duplicate berthのskip / cascadeもprovenanceへ残す。

---

# 13.2 Domestic Competition Season Snapshot — CANONICAL

各League Seasonは、その年の制度を再現できるSnapshotを保持する。

概念:

```ts
type DomesticCompetitionSeasonSnapshot = {
  seasonId: SeasonId;
  leagueId: LeagueId;
  competitionProfileVersion: string;
  clubMembershipSnapshot: readonly ClubId[];
  alignmentSnapshot: unknown;
  postseasonFormatVersion: string;
  standingsTiebreakPolicyVersion: string;
  qualificationPolicyVersion: string;
  regularSeasonTitleSnapshot: unknown;
  domesticChampionSnapshot: unknown;
  continentalQualificationProvenance: readonly ContinentalQualificationProvenance[];
};
```

現在のLeague制度変更で過去Seasonを再計算・再解釈しない。

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

# 15. Competition Reform — VERSIONED

World simulation中にLeague expansion / contractionが起きた場合、Domestic formatは明示的なCompetition Reformで変更可能。

Reformは必ず新しい `LeagueCompetitionProfile.version` を作り、原則として将来Seasonから適用する。
過去Season Snapshotを新制度へ書き換えない。

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
2. Asia-Pacific / Americas / EuropeのDomesticChampionはContinental automatic berth
3. LeagueCoefficientがberth数、Domestic Resultが出場clubを決める
4. Europe 7 leaguesはEURO_TOP4。Regular Season 1位を独立タイトルとして残し、上位4で短期Postseason
5. West/South Asia、Pan-Africa、NZ/PacificはTABLE_TITLE
6. Japan / North America / Mexico / CubaはCONFERENCE_SERIES
7. KoreaはLADDER
8. DominicanはWINTER_ROUND_ROBIN
9. Taiwan / China / Venezuela / Puerto RicoはTOP4_SERIES。Australiaは4ClubのTOP2_FINAL
10. Domestic postseasonはseries制を許し、国際Knockoutのsingle-game philosophyとは分離
11. CL qualification duplicateはnext eligible clubへcascade
12. Regular Season上位の価値をhome-field / bye / qualification orderで保証
13. Domestic title / pennant / continental qualificationを長期履歴として別保存
14. 21 Full Leaguesの現行Domestic formatをversioned LeagueCompetitionProfile v1として固定
15. Continental berthはqualification source / eligibility / cascade provenanceを保存
16. DomesticChampion automatic berthはeligibility checkを通す
17. Tiebreak / qualification / home-field policyはLeagueCompetitionProfileでversion管理
18. Competition Reformは新Profile versionを将来Seasonから適用
19. 各Seasonは当時のCompetition Profile / alignment / title / qualification provenanceをSnapshot保存

---

## 16.1 Europe Postseason safeguard

欧州PS導入後も、Regular Seasonを無価値化しない。

最低条件:

- PS進出は上位4のみ
- 1位はRegularSeasonChampionとして独立記録
- 1位はSFのhome-field advantage
- 1位はEBCL qualification orderで上位
- 1位とDomesticChampionが別Clubでも両方を歴史上評価する

これにより「一年の順位表」と「最後の短期決戦」の両方を楽しめる。

# 17. Implementation / Calendar Calibration — NOT OPEN ARCHITECTURE

- exact regular-season game counts
- balanced vs unbalanced schedules
- future division / conference realignment details (current v1 alignment is preserved until explicit reform)
- Japan two-league names
- North America conference / division names
- series home-game patterns
- rainout / suspended-game policy
- exact postseason calendar
- roster expansion rules
- tiebreak-game scheduling
- future domestic cups

---

# 18. Final v1 Status

**Domestic League Championships & Continental Qualification v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

Frozen core:
- 21 Full Leaguesの本書記載Domestic Championship方式をLeagueCompetitionProfile v1として採用
- RegularSeasonChampionとDomesticChampionを必要に応じて別Titleとして保存
- LeagueCoefficientはberth数、LeagueCompetitionProfileは出場候補順を決定
- DomesticChampionは原則automatic route + eligibility check
- duplicate / ineligible berthはdeterministic cascade + provenance保存
- Domestic postseasonのv1 Series length / structureは本書記載値を採用
- Regular Season上位の価値はtitle / bye / home-field / qualification priorityで保持
- home-fieldは実環境のみで作用しhidden ability buffは禁止
- Tiebreak / qualification / home-field ruleはversioned LeagueCompetitionProfile policy
- Reformはnew profile versionとして将来Seasonから適用
- DomesticCompetitionSeasonSnapshotで過去制度・タイトル・qualification provenanceを保存

Remaining exact Regular Season game counts / calendar / rainout / roster expansion等は14 / 15 / implementation calibrationでありopen architectureではない。