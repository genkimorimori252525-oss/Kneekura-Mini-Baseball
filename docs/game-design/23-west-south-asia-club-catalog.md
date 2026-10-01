# West / South Asia Real Football Club Catalog — 12 Clubs

更新日: 2026-09-20  
状態: **初期Club Seed Catalog v1。実在Football Clubを野球Clubとして使用。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/21-world-club-source-policy.md`

---

# 1. 方針

West / South Asia Leagueは複数国を跨ぐ12Club Full League。

この地域ではBaseball ClubよりFootball Club Cultureを初期Club sourceとして使う。

Footballの勝敗・選手能力は移植しない。

引き継ぐのは:

- club identity
- city
- supporter / brand scale
- ownership / funding character
- academy / scouting culture
- traditional rivalry
- initial economic hierarchy

のみ。

Economic BandはGame Seedであり監査済み財務順位ではない。

---

# 2. Initial 12 Clubs

| Club | Country / City | Initial Economic Seed | Structural Style |
| --- | --- | --- | --- |
| Al Hilal | Saudi Arabia / Riyadh | ELITE | capital-rich continental giant |
| Al Nassr | Saudi Arabia / Riyadh | ELITE | star-acquisition / global-brand expansion |
| Al Ittihad | Saudi Arabia / Jeddah | ELITE | large-market historic giant |
| Al Ahli | Saudi Arabia / Jeddah | ELITE | large-market capital-backed giant |
| Al Ain | UAE / Al Ain | HIGH | institutional / academy giant |
| Shabab Al Ahli | UAE / Dubai | HIGH | metropolitan capital-backed club |
| Al Sadd | Qatar / Doha | HIGH | institutional / national-market giant |
| Al Duhail | Qatar / Doha | HIGH | capital-backed modern giant |
| Mohun Bagan Super Giant | India / Kolkata | UPPER | enormous supporter / historic-brand club |
| East Bengal FC | India / Kolkata | UPPER | historic supporter giant |
| Persepolis FC | Iran / Tehran | HIGH | mass-support historic giant |
| Esteghlal FC | Iran / Tehran | HIGH | mass-support historic giant |

---

# 3. Why these 12

League全体を一国へ寄せず、

- Gulf capital
- Saudi large-market investment
- UAE / Qatar institutional clubs
- Indian supporter culture
- Iranian mass-support rivalry

を同一市場へ入れる。

これにより同じFootball-derived Leagueでも:

```text
money-rich buyer
historic supporter giant
academy-oriented club
capital-backed modern club
```

が共存する。

---

# 4. Initial Directed Rivalry Seeds

```text
Al Hilal -> Al Nassr          very high
Al Nassr -> Al Hilal          very high

Al Ittihad -> Al Ahli         very high
Al Ahli -> Al Ittihad         very high

Al Sadd -> Al Duhail          high
Al Duhail -> Al Sadd          high

Mohun Bagan -> East Bengal    very high
East Bengal -> Mohun Bagan    very high

Persepolis -> Esteghlal       very high
Esteghlal -> Persepolis       very high

Al Ain -> Shabab Al Ahli      medium-high
Shabab Al Ahli -> Al Ain      medium-high
```

Pennant開始後はCurrent Competitive Threatによって非対称化してよい。

---

# 5. Cross-border Rivalry Growth

同国内の伝統Rivalryだけでなく、このGame WorldのLeague歴史から新しい因縁を作る。

例:

```text
Al Hilal repeatedly eliminates Persepolis
        ↓
Persepolis -> Al Hilal competitiveThreat rises
```

```text
Mohun Bagan wins three straight titles
        ↓
multiple clubs -> Mohun Bagan DOMINANT_CLUB_TARGET
```

---

# 6. Market Identity

League Marketは:

```text
GROWTH_FRANCHISE_HYBRID
+
FOOTBALL_TRANSFER_ACADEMY
```

を維持。

- transfer fee
- loan
- free transfer
- academy
- trials
- agent negotiation
- locally-trained rules
- foreign-player registration
- training compensation
- solidarity / sell-on

を許可する。

---

# 7. User-facing Surface

通常画面は簡単にする。

例:

```text
Al Hilal
資金力      S
人気        S
育成        A
スカウト    A
補強余力    大
```

Ownership finance / commercial network等はBackground Simulation。

---

# 8. Source Snapshot Notes

2026 source confirmation:

- Saudi Pro League: Al Hilal / Al Nassr / Al Ittihad / Al Ahli are active clubs
- UAE Pro League: Al Ain / Shabab Al Ahli are active licensed clubs
- Qatar Stars League: Al Sadd / Al Duhail are active clubs
- Indian Super League: Mohun Bagan Super Giant / East Bengal FC are active clubs
- Iran league: Persepolis / Esteghlal are active clubs

Career開始後は外部現実データと同期しない。
