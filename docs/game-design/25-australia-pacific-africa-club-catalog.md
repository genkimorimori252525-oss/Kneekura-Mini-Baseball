# Australia / New Zealand-Pacific / Pan-Africa Club Catalog

更新日: 2026-09-20  
状態: **初期Club Seed Catalog v1。Australiaは実在Baseball Club、NZ/Pacific・Pan-Africaは実在Football Club。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/21-world-club-source-policy.md`

---

# 1. Australia League — Real ABL Clubs

2026 ABLは4-team competition。

本ゲームもReal League Count Principleに従い、旧8Club仮設定を廃止して現行4Clubを使う。

| Club | Home Identity | Initial Economic Seed |
| --- | --- | --- |
| Adelaide Giants | Adelaide | HIGH |
| Brisbane Bandits | Brisbane | HIGH |
| Perth Heat | Perth | HIGH |
| Sydney Blue Sox | Sydney | HIGH |

## 1.1 Schedule conversion

Full Simulation Leagueの最低100試合原則を維持する。

4Clubなので:

```text
3 opponents x 36 games
= 108 Regular Season games
```

各opponent:

```text
18 home
18 away
```

とする。

現実ABLの日程をそのまま再現するのではなく、Club identityを実在のまま長期Pennant用Calendarへ変換する。

## 1.2 Domestic Championship

4Club全てをPostseasonへ進ませる方式は避ける。

初期標準:

```text
Regular Season
 -> top 2

Championship Final
 -> best-of-5
```

Regular Season 1位は独立したRegularSeasonChampionとして記録。

Final winner = DomesticChampion。

## 1.3 APBCL qualification

```text
DomesticChampion
 -> automatic APBCL berth

RegularSeasonChampion
 -> first coefficient-berth candidate

remaining clubs
 -> Regular Season order
```

## 1.4 Rivalry Seeds

```text
Sydney -> Brisbane      high
Brisbane -> Sydney      high

Perth -> Adelaide       medium-high
Adelaide -> Perth       medium-high
```

長期Historyで変化する。

---

# 2. Australia Expansion Note

Baseball Australiaは2026を4Clubで運営し、2027の6Club再拡大を目標としている。

ただしCareer開始後は現実世界と自動同期しない。

したがって:

```text
real 2026 expansion intention
 -> optional World Governance Seed
 -> NOT guaranteed scripted expansion
```

とする。

Game World内でLeague expansionが成立する場合はCompetition Reform Eventを通す。

---

# 3. New Zealand / Pacific League — 8 Real Football Clubs

Baseballが主要Club Cultureではないため、実在Football Clubを野球Club化する。

| Club | Country / City | Initial Economic Seed | Source Identity |
| --- | --- | --- | --- |
| Auckland FC | New Zealand / Auckland | HIGH | professional NZ market |
| Wellington Phoenix FC | New Zealand / Wellington | HIGH | professional NZ market |
| Auckland City FC | New Zealand / Auckland | UPPER | Oceania continental giant |
| Rewa FC | Fiji / Nausori | MID | Fiji major club |
| Central Coast FC | Solomon Islands / Honiara | MID | Solomon Islands major club |
| Lae City FC | Papua New Guinea / Lae | MID | PNG major club |
| Galaxy FC | Vanuatu / Port Vila | MID | Vanuatu major club |
| AS Tiga Sport | New Caledonia | MID | New Caledonia major club |

## 3.1 Rivalry Seeds

```text
Auckland FC -> Wellington Phoenix     high
Wellington Phoenix -> Auckland FC     high

Auckland City -> Auckland FC          medium-high
Auckland FC -> Auckland City          medium

Rewa -> Auckland City                 medium-high
Central Coast -> Auckland City        medium-high
Galaxy -> Auckland City               medium-high
```

Auckland CityはOceaniaでの歴史的成功をHistoricalPrestige Seedとして持つが、Baseball能力Buffにはしない。

## 3.2 Market

```text
FOOTBALL_TRANSFER_ACADEMY
+
WINTER_OPEN_MARKET
```

- academy
- transfer
- loan
- trials
- training compensation
- solidarity
- short-term veteran import

を採用。

---

# 4. Pan-African League — 12 Real Football Clubs

Pan-African Leagueは複数国のFootball giantsを同一Baseball Leagueへ配置する。

| Club | Country / City | Initial Economic Seed | Structural Style |
| --- | --- | --- | --- |
| Al Ahly SC | Egypt / Cairo | ELITE | continental historic giant |
| Zamalek SC | Egypt / Cairo | HIGH | mass-support historic giant |
| Mamelodi Sundowns | South Africa / Pretoria | ELITE | capital / infrastructure giant |
| Orlando Pirates | South Africa / Johannesburg | HIGH | mass-support historic giant |
| Kaizer Chiefs | South Africa / Johannesburg | HIGH | mass-support commercial giant |
| Espérance Sportive de Tunis | Tunisia / Tunis | HIGH | institutional continental giant |
| Wydad AC | Morocco / Casablanca | HIGH | mass-support historic giant |
| Raja CA | Morocco / Casablanca | HIGH | mass-support historic giant |
| TP Mazembe | DR Congo / Lubumbashi | HIGH | continental historic giant |
| Simba SC | Tanzania / Dar es Salaam | UPPER | mass-support East African giant |
| Young Africans SC | Tanzania / Dar es Salaam | HIGH | mass-support East African giant |
| Enyimba FC | Nigeria / Aba | UPPER | West African historic club |

---

# 5. Pan-African Rivalry Seeds

```text
Al Ahly <-> Zamalek                    very high
Orlando Pirates <-> Kaizer Chiefs      very high
Wydad <-> Raja                         very high
Simba <-> Young Africans               very high

Sundowns -> Orlando Pirates            high
Orlando Pirates -> Sundowns            high

Espérance -> Al Ahly                   medium-high
TP Mazembe -> Al Ahly                  medium-high
```

同国DerbyとPan-African title rivalryを分けて保存する。

---

# 6. Pan-African Economy

各Clubの経済格差は:

- supporter base
- ownership / capital
- stadium / attendance potential
- sponsorship
- continental prize money
- commercial network
- academy / transfer income

から作る。

`AfricaClub = weak` のような地域Debuffは禁止。

Pan-African League自体の経済規模も成功・放映・大陸大会で長期成長できる。

---

# 7. Asia-Pacific Connection

Australia / NZ-Pacificは:

```text
geographicRegion = OCEANIA
competitionRegion = ASIA_PACIFIC
```

APBCLへ参加。

Australia DomesticChampionとNZ/Pacific DomesticChampionはAPBCL automatic berthを持つ。

---

# 8. Simple Surface

ユーザーへは:

```text
資金力
人気
育成
スカウト
補強余力
財政状態
```

程度に要約。

裏ではClub Economy / Structural Capitalを通常どおり計算する。

---

# 9. Source Snapshot Notes

2026確認:

- ABL: Adelaide Giants / Brisbane Bandits / Perth Heat / Sydney Blue Soxの4Club competition
- OFC Champions League 2026: Auckland City, Rewa, Central Coast, Lae City, Galaxy, AS Tiga Sport等が現役
- A-League 2026/27: Auckland FC / Wellington Phoenixが現役
- CAF 2026/27: Mamelodi Sundowns, Orlando Pirates, Espérance, Zamalek, TP Mazembe, Simba, Young Africans等が現役
- Al Ahly / Raja等もCAF interclub giantとして現役

Football成績はBaseball結果へコピーしない。
