# Initial Directed Rivalry Graph

更新日: 2026-09-20  
状態: **Career開始時の有向Rivalry Seed v1。Pennant開始後は左右独立に変化。**

関連:
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/26-club-initial-seed-rating-model.md`

---

# 1. 目的

Catalog内の `very high / high / medium` 等を、実装可能な0〜100へ変換する。

通常UIでは:

```text
因縁: 強
```

程度でよい。

内部では:

```ts
type InitialDirectedRivalrySeed = {
  from: ClubId;
  to: ClubId;
  intensity: number;
  reason: RivalryReason;
};
```

を持つ。

---

# 2. Intensity Guide

| 表示 | Internal |
| --- | ---: |
| 最大級 | 95–100 |
| 非常に強い | 90–94 |
| 強い | 75–89 |
| 中程度 | 50–74 |
| 弱い | 25–49 |

`A <-> B` は必ず2本の有向edgeへ展開する。

---

# 3. Japan

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| 阪神タイガース | 読売ジャイアンツ | 94 | HISTORICAL_RIVAL |
| 読売ジャイアンツ | 阪神タイガース | 92 | HISTORICAL_RIVAL |
| 埼玉西武ライオンズ | 福岡ソフトバンクホークス | 80 | HISTORICAL_RIVAL |
| 福岡ソフトバンクホークス | 埼玉西武ライオンズ | 68 | HISTORICAL_RIVAL |
| オリックス・バファローズ | 阪神タイガース | 55 | LOCAL_DERBY |
| 阪神タイガース | オリックス・バファローズ | 55 | LOCAL_DERBY |
| 横浜DeNAベイスターズ | 読売ジャイアンツ | 55 | COMPETITIVE_RIVAL |
| 読売ジャイアンツ | 横浜DeNAベイスターズ | 42 | COMPETITIVE_RIVAL |

---

# 4. Korea

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| LG Twins | Doosan Bears | 94 | LOCAL_DERBY |
| Doosan Bears | LG Twins | 94 | LOCAL_DERBY |
| KIA Tigers | Samsung Lions | 80 | HISTORICAL_RIVAL |
| Samsung Lions | KIA Tigers | 80 | HISTORICAL_RIVAL |
| Lotte Giants | NC Dinos | 80 | LOCAL_DERBY |
| NC Dinos | Lotte Giants | 80 | LOCAL_DERBY |
| SSG Landers | Kiwoom Heroes | 55 | COMPETITIVE_RIVAL |
| Kiwoom Heroes | SSG Landers | 55 | COMPETITIVE_RIVAL |
| Hanwha Eagles | KIA Tigers | 55 | COMPETITIVE_RIVAL |

---

# 5. Taiwan

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Wei Chuan Dragons | CTBC Brothers | 94 | HISTORICAL_RIVAL |
| CTBC Brothers | Wei Chuan Dragons | 80 | HISTORICAL_RIVAL |
| CTBC Brothers | Uni-President 7-Eleven Lions | 80 | HISTORICAL_RIVAL |
| Uni-President 7-Eleven Lions | CTBC Brothers | 80 | HISTORICAL_RIVAL |
| Rakuten Monkeys | CTBC Brothers | 68 | COMPETITIVE_RIVAL |
| CTBC Brothers | Rakuten Monkeys | 68 | COMPETITIVE_RIVAL |

---

# 6. China

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Shanghai Port | Shanghai Shenhua | 94 | LOCAL_DERBY |
| Shanghai Shenhua | Shanghai Port | 94 | LOCAL_DERBY |
| Beijing Guoan | Shandong Taishan | 80 | HISTORICAL_RIVAL |
| Shandong Taishan | Beijing Guoan | 80 | HISTORICAL_RIVAL |
| Beijing Guoan | Shanghai Shenhua | 80 | HISTORICAL_RIVAL |
| Shanghai Shenhua | Beijing Guoan | 80 | HISTORICAL_RIVAL |
| Chengdu Rongcheng | Beijing Guoan | 55 | COMPETITIVE_RIVAL |

---

# 7. West / South Asia

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Al Hilal | Al Nassr | 94 | LOCAL_DERBY |
| Al Nassr | Al Hilal | 94 | LOCAL_DERBY |
| Al Ittihad | Al Ahli | 94 | LOCAL_DERBY |
| Al Ahli | Al Ittihad | 94 | LOCAL_DERBY |
| Al Sadd | Al Duhail | 80 | LOCAL_DERBY |
| Al Duhail | Al Sadd | 80 | LOCAL_DERBY |
| Mohun Bagan Super Giant | East Bengal FC | 98 | HISTORICAL_RIVAL |
| East Bengal FC | Mohun Bagan Super Giant | 98 | HISTORICAL_RIVAL |
| Persepolis FC | Esteghlal FC | 98 | HISTORICAL_RIVAL |
| Esteghlal FC | Persepolis FC | 98 | HISTORICAL_RIVAL |
| Al Ain | Shabab Al Ahli | 68 | COMPETITIVE_RIVAL |
| Shabab Al Ahli | Al Ain | 68 | COMPETITIVE_RIVAL |

---

# 8. Europe

## Spain

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Real Madrid CF | FC Barcelona | 98 | HISTORICAL_RIVAL |
| FC Barcelona | Real Madrid CF | 98 | HISTORICAL_RIVAL |
| Atlético de Madrid | Real Madrid CF | 88 | LOCAL_DERBY |
| Real Madrid CF | Atlético de Madrid | 76 | LOCAL_DERBY |
| Real Betis Balompié | Sevilla FC | 95 | LOCAL_DERBY |
| Sevilla FC | Real Betis Balompié | 95 | LOCAL_DERBY |

## Germany

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Borussia Dortmund | FC Bayern München | 88 | TITLE_RIVAL |
| FC Bayern München | Borussia Dortmund | 74 | TITLE_RIVAL |
| Bayer 04 Leverkusen | FC Bayern München | 76 | DOMINANT_CLUB_TARGET |
| RB Leipzig | FC Bayern München | 70 | DOMINANT_CLUB_TARGET |
| VfB Stuttgart | FC Bayern München | 64 | DOMINANT_CLUB_TARGET |
| Eintracht Frankfurt | FC Bayern München | 60 | DOMINANT_CLUB_TARGET |

## France

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Olympique de Marseille | Paris Saint-Germain | 92 | HISTORICAL_RIVAL |
| Paris Saint-Germain | Olympique de Marseille | 88 | HISTORICAL_RIVAL |
| Olympique Lyonnais | Paris Saint-Germain | 72 | DOMINANT_CLUB_TARGET |
| AS Monaco | Paris Saint-Germain | 62 | DOMINANT_CLUB_TARGET |
| LOSC Lille | Paris Saint-Germain | 58 | DOMINANT_CLUB_TARGET |

## United Kingdom

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Manchester United | Manchester City | 92 | LOCAL_DERBY |
| Manchester City | Manchester United | 92 | LOCAL_DERBY |
| Liverpool FC | Manchester United | 97 | HISTORICAL_RIVAL |
| Manchester United | Liverpool FC | 97 | HISTORICAL_RIVAL |
| Arsenal | Tottenham Hotspur | 97 | LOCAL_DERBY |
| Tottenham Hotspur | Arsenal | 97 | LOCAL_DERBY |
| Celtic FC | Rangers FC | 100 | HISTORICAL_RIVAL |
| Rangers FC | Celtic FC | 100 | HISTORICAL_RIVAL |
| Chelsea | Arsenal | 72 | LOCAL_DERBY |
| Newcastle United | Manchester City | 58 | COMPETITIVE_RIVAL |

## Italy

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| FC Internazionale Milano | AC Milan | 97 | LOCAL_DERBY |
| AC Milan | FC Internazionale Milano | 97 | LOCAL_DERBY |
| Juventus | Torino FC | 92 | LOCAL_DERBY |
| Torino FC | Juventus | 92 | LOCAL_DERBY |
| AS Roma | SS Lazio | 100 | LOCAL_DERBY |
| SS Lazio | AS Roma | 100 | LOCAL_DERBY |
| FC Internazionale Milano | Juventus | 88 | HISTORICAL_RIVAL |
| Juventus | FC Internazionale Milano | 88 | HISTORICAL_RIVAL |
| AC Milan | Juventus | 84 | HISTORICAL_RIVAL |
| Juventus | AC Milan | 84 | HISTORICAL_RIVAL |

---

# 9. North America

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| New York Yankees | Boston Red Sox | 98 | HISTORICAL_RIVAL |
| Boston Red Sox | New York Yankees | 98 | HISTORICAL_RIVAL |
| New York Yankees | New York Mets | 82 | LOCAL_DERBY |
| New York Mets | New York Yankees | 86 | LOCAL_DERBY |
| Los Angeles Dodgers | San Francisco Giants | 98 | HISTORICAL_RIVAL |
| San Francisco Giants | Los Angeles Dodgers | 98 | HISTORICAL_RIVAL |
| Chicago Cubs | St. Louis Cardinals | 95 | HISTORICAL_RIVAL |
| St. Louis Cardinals | Chicago Cubs | 95 | HISTORICAL_RIVAL |
| New York Mets | Philadelphia Phillies | 84 | HISTORICAL_RIVAL |
| Philadelphia Phillies | New York Mets | 84 | HISTORICAL_RIVAL |
| Houston Astros | Texas Rangers | 84 | LOCAL_DERBY |
| Texas Rangers | Houston Astros | 84 | LOCAL_DERBY |
| Los Angeles Angels | Los Angeles Dodgers | 55 | LOCAL_DERBY |
| Athletics | San Francisco Giants | 68 | LOCAL_DERBY |
| San Diego Padres | Los Angeles Dodgers | 82 | COMPETITIVE_RIVAL |
| Baltimore Orioles | New York Yankees | 80 | HISTORICAL_RIVAL |

---

# 10. Mexico

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Diablos Rojos del México | Tigres de Quintana Roo | 95 | HISTORICAL_RIVAL |
| Tigres de Quintana Roo | Diablos Rojos del México | 95 | HISTORICAL_RIVAL |
| Sultanes de Monterrey | Toros de Tijuana | 80 | COMPETITIVE_RIVAL |
| Toros de Tijuana | Sultanes de Monterrey | 80 | COMPETITIVE_RIVAL |
| Leones de Yucatán | Pericos de Puebla | 68 | COMPETITIVE_RIVAL |
| Pericos de Puebla | Leones de Yucatán | 55 | COMPETITIVE_RIVAL |
| Charros de Jalisco | Sultanes de Monterrey | 68 | COMPETITIVE_RIVAL |

---

# 11. Caribbean

## Dominican

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Tigres del Licey | Leones del Escogido | 98 | LOCAL_DERBY |
| Leones del Escogido | Tigres del Licey | 98 | LOCAL_DERBY |
| Tigres del Licey | Águilas Cibaeñas | 98 | HISTORICAL_RIVAL |
| Águilas Cibaeñas | Tigres del Licey | 98 | HISTORICAL_RIVAL |
| Águilas Cibaeñas | Gigantes del Cibao | 80 | COMPETITIVE_RIVAL |
| Estrellas Orientales | Toros del Este | 80 | LOCAL_DERBY |

## Venezuela

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Leones del Caracas | Navegantes del Magallanes | 100 | HISTORICAL_RIVAL |
| Navegantes del Magallanes | Leones del Caracas | 100 | HISTORICAL_RIVAL |
| Cardenales de Lara | Navegantes del Magallanes | 80 | COMPETITIVE_RIVAL |
| Tigres de Aragua | Leones del Caracas | 80 | COMPETITIVE_RIVAL |
| Águilas del Zulia | Cardenales de Lara | 68 | COMPETITIVE_RIVAL |

## Puerto Rico

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Cangrejeros de Santurce | Criollos de Caguas | 95 | HISTORICAL_RIVAL |
| Criollos de Caguas | Cangrejeros de Santurce | 95 | HISTORICAL_RIVAL |
| Indios de Mayagüez | Cangrejeros de Santurce | 80 | HISTORICAL_RIVAL |
| Leones de Ponce | Criollos de Caguas | 68 | COMPETITIVE_RIVAL |
| Senadores de San Juan | Cangrejeros de Santurce | 80 | LOCAL_DERBY |

---

# 12. Cuba

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Industriales | Santiago de Cuba | 98 | HISTORICAL_RIVAL |
| Santiago de Cuba | Industriales | 98 | HISTORICAL_RIVAL |
| Industriales | Pinar del Río | 80 | HISTORICAL_RIVAL |
| Pinar del Río | Industriales | 94 | HISTORICAL_RIVAL |
| Villa Clara | Industriales | 80 | HISTORICAL_RIVAL |
| Las Tunas | Granma | 80 | COMPETITIVE_RIVAL |
| Matanzas | Industriales | 68 | COMPETITIVE_RIVAL |

---

# 13. Australia / Pacific

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Sydney Blue Sox | Brisbane Bandits | 80 | COMPETITIVE_RIVAL |
| Brisbane Bandits | Sydney Blue Sox | 80 | COMPETITIVE_RIVAL |
| Perth Heat | Adelaide Giants | 68 | COMPETITIVE_RIVAL |
| Adelaide Giants | Perth Heat | 68 | COMPETITIVE_RIVAL |
| Auckland FC | Wellington Phoenix FC | 80 | NATIONAL_RIVAL |
| Wellington Phoenix FC | Auckland FC | 80 | NATIONAL_RIVAL |
| Auckland City FC | Auckland FC | 68 | LOCAL_DERBY |
| Auckland FC | Auckland City FC | 55 | LOCAL_DERBY |
| Rewa FC | Auckland City FC | 68 | CONTINENTAL_RIVAL |
| Central Coast FC | Auckland City FC | 68 | CONTINENTAL_RIVAL |
| Galaxy FC | Auckland City FC | 68 | CONTINENTAL_RIVAL |

---

# 14. Pan-Africa

| From | To | Seed | Reason |
| --- | --- | ---: | --- |
| Al Ahly SC | Zamalek SC | 100 | LOCAL_DERBY |
| Zamalek SC | Al Ahly SC | 100 | LOCAL_DERBY |
| Orlando Pirates | Kaizer Chiefs | 98 | LOCAL_DERBY |
| Kaizer Chiefs | Orlando Pirates | 98 | LOCAL_DERBY |
| Wydad AC | Raja CA | 98 | LOCAL_DERBY |
| Raja CA | Wydad AC | 98 | LOCAL_DERBY |
| Simba SC | Young Africans SC | 98 | LOCAL_DERBY |
| Young Africans SC | Simba SC | 98 | LOCAL_DERBY |
| Mamelodi Sundowns | Orlando Pirates | 80 | COMPETITIVE_RIVAL |
| Orlando Pirates | Mamelodi Sundowns | 80 | COMPETITIVE_RIVAL |
| Espérance Sportive de Tunis | Al Ahly SC | 68 | CONTINENTAL_RIVAL |
| TP Mazembe | Al Ahly SC | 68 | CONTINENTAL_RIVAL |

---

# 15. Dynamic Dominant-Club Targeting

上表はHistorical / Initial Seedのみ。

Pennant中の:

- repeated titles
- repeated postseason eliminations
- financial dominance
- direct qualification competition
- recent incidents

による `DOMINANT_CLUB_TARGET` は別のDynamic component。

例:

```text
Bayern wins 6 of 8 seasons
        ↓
multiple Germany clubs:
competitiveThreat -> Bayern rises
```

固定Rivalry tableを書き換える必要はない。

---

# 16. User-facing View

通常表示:

```text
vs 読売
因縁: 非常に強い
注目度: 高い
```

ユーザーへ `94` を必ず見せる必要はない。

数値はBackground Simulation / debug / detailed inspection用。

---

# 17. 実装原則

- rivalry intensityはMatch能力へ直接加算しない
- Player PersonalStake / Appraisalへ入力する
- A -> B と B -> A は独立
- Dynamic threatはPennant履歴から更新
- 伝統RivalryはSlow State
- 「包囲網」はmultiple directed threatの観測結果

---

# 18. PENDING USER DECISION — Emergent Rivalry Lifecycle

状態: **未決定 / 未承認。**

ユーザーから次の設計候補が提示されている。

```text
Historical Initial Rivalry
 -> permanent core / permanent floor

Emergent Rivalry
 -> events raise score
 -> inactivity / irrelevance can reduce score
 -> may decay to zero and disappear
```

目的は、Pennantを長期間進めた結果:

> 全世界のClubが全員ライバル

になることを防ぐこと。

候補Event:
- repeated title race
- postseason elimination
- controversial incident
- major transfer grievance
- humiliating defeat
- repeated close games
- dominant-club targeting

候補Decay要因:
- many seasons without meaningful meetings
- competitive separation
- no title / qualification relevance
- generation turnover
- no new incidents

ただし:
- 初期Historical Rivalryの永久floorを何点にするか
- emergent scoreの半減期
- eventごとの加点
- threshold以下edgeを削除するか
- geographic derbyを全て永久扱いするか

は**ユーザーと次回相談してから決定する。**


Rivalry lifecycle approval candidate (USER APPROVAL REQUIRED):
- `docs/game-design/33-rivalry-lifecycle-model-DRAFT.md`
