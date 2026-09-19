# Rivalry Lifecycle Model — DRAFT FOR USER APPROVAL

更新日: 2026-09-20  
状態: **承認候補。USER APPROVAL REQUIRED。未確定。**

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/30-initial-directed-rivalry-graph.md`
- `docs/game-design/00-current-design-handoff.md`

---

# 1. Design Goal

長期Pennantで:

```text
all clubs eventually become rivals with everyone
```

になることを防ぎながら、

- 伝統的Rivalryは消えない
- 新しい因縁は歴史から自然発生する
- 後天的因縁は放置されれば薄れる
- 同じ相手との新しい事件で再燃する
- A -> B と B -> A は別々に育つ

を同時に満たす。

---

# 2. Two-Layer Rivalry

Rivalryを二層に分ける。

```ts
type DirectedRivalryState = {
  fromClubId: ClubId;
  toClubId: ClubId;

  permanentHistoricalEdge: boolean;
  historicalFloor: number;

  memories: readonly RivalryMemory[];
  currentCompetitiveThreat: number;

  effectiveIntensity: number; // derived
};
```

## Historical Core

Career開始時から30のInitial Rivalry Graphに存在するEdge。

- permanent
- never deleted
- historicalFloorを持つ
- 時代が変わっても完全には消えない

## Emergent Rivalry

Career開始後にGame World内の出来事から生まれる。

- historicalFloor = 0
- event memoryが無くなれば減衰
- 条件を満たせば完全削除可能

---

# 3. Important Separation — Threat is not Rivalry Memory

強豪だから狙われること自体を永久Rivalryへしない。

```text
Bayern dominates league
        ↓
currentCompetitiveThreat rises
        ↓
Manager may prioritize Bayern
        ↓
BUT no permanent rivalry memory yet
```

実際に:

- title race
- direct elimination
- repeated high-stake meetings
- controversial incident
- transfer grievance

等が起きて初めてRivalryMemoryを作る。

これがWorld-wide rivalry inflationの主要防止策。

---

# 4. Rivalry Memory Event

```ts
type RivalryMemory = {
  sourceEventId: EventId;
  kind: RivalryMemoryKind;
  initialWeight: number;
  createdSeason: SeasonId;
  halfLifeSeasons: number;
};
```

各記憶は時間で薄れる。

```text
remainingContribution
 =
 initialWeight
 x 0.5 ^ (ageInSeasons / halfLifeSeasons)
```

つまり「消えるか消えないか」の二択ではなく、自然に忘れていく。

---

# 5. Dynamic Score

```text
rawDynamic
 = sum(all remaining RivalryMemory contributions)

dynamicScore
 = min(100, rawDynamic)
```

Historical Rivalryは:

```text
effectiveIntensity
 =
 historicalFloor
 + dynamicScore * (100 - historicalFloor) / 100
```

Emergent Rivalryは:

```text
historicalFloor = 0

effectiveIntensity
 = dynamicScore
```

例:

```text
historicalFloor = 60
dynamicScore = 50

effective
= 60 + 50 * 0.40
= 80
```

伝統は最低60残り、最近の出来事で80まで熱くなる。

---

# 6. Initial Historical Rivalries

30の現在Seed値は `historicalFloor` そのものにしない。

現在Seed:

```text
Yankees -> Red Sox = 98
```

は:

```text
permanent historical core
+
2026 current-context memory
```

として初期化する。

これにより何十年も大きな出来事が無ければ98からHistorical Floorへ徐々に下がる。

しかしEdge自体は消えない。

---

# 7. Historical Floor Candidate

初期EdgeのReasonを使ってFloorを作る。

初期標準候補:

| Initial reason | Historical Floor |
| --- | ---: |
| iconic historical / century rivalry | 65 |
| HISTORICAL_RIVAL | 55 |
| LOCAL_DERBY | 50 |
| NATIONAL_RIVAL | 45 |
| CONTINENTAL_RIVAL | 40 |
| initial COMPETITIVE_RIVAL | 30 |

特別な世界的Rivalryはmanual overrideを許可。

例候補:

- Celtic / Rangers
- Real Madrid / Barcelona
- Yankees / Red Sox
- Caracas / Magallanes
- Al Ahly / Zamalek

等は65〜70。

Floorは`関係が存在し続ける最低値`であり、現在の熱量ではない。

---

# 8. Initial Context Memory

30のInitial Effective Seedを維持するため、Career開始時にsynthetic memoryを作る。

```text
INITIAL_CONTEXT
half-life = 4 seasons
```

historicalFloorと合成した結果が現在のSeed intensityになるようinitialWeightを決める。

これにより:

```text
2026 rivalry heat = current real-world inspired seed

no new history for many seasons
 -> gradually approaches historical floor
```

となる。

---

# 9. Event Weights — Candidate v1

数値はSimulation Testで校正可能だが、初期設計候補を置く。

| Event | Primary direction | Weight | Half-life |
| --- | --- | ---: | ---: |
| same-season title race | both | +10 | 3 seasons |
| championship / pennant decided head-to-head | loser -> winner | +14 | 4 |
| postseason elimination | loser -> winner | +16 | 5 |
| championship final elimination | loser -> winner | +22 | 6 |
| winner after eliminating rival | winner -> loser | +7 | 4 |
| repeated elimination bonus | victim -> opponent | +8 | 6 |
| continental / world knockout elimination | loser -> winner | +18 | 6 |
| major controversial incident | affected -> opponent | +15 to +30 | 6–10 |
| star transfer grievance | former club -> destination | +12 | 5 |
| manager / staff poaching grievance | former club -> destination | +8 | 4 |
| repeated high-stake close series | both | +6 | 3 |
| humiliating high-stake defeat | loser -> winner | +6 | 2 |

Regular Seasonの普通の1勝1敗だけではRivalryMemoryを作らない。

---

# 10. Directionality

同じEventでも左右同量にしない。

例:

```text
Club A eliminates Club B in Final

B -> A
 +22

A -> B
 +7
```

B側は「またあいつらにやられた」という因縁が強く残る。

A側は重要な相手として認識するが、同じ強度を強制しない。

---

# 11. Repeated Elimination

同じ相手から一定期間に複数回敗退した場合、追加Memoryを作る。

候補:

```text
same opponent eliminates club
2+ times within 4 seasons
 -> REPEATED_ELIMINATION +8
```

3回目以降も加算可能だが、同Seasonに無制限stackさせない。

これにより自然に:

> 「またこいつらか」

が形成される。

---

# 12. Event Aggregation / Anti-Spam

100試合以上あるLeagueで普通の試合を毎回加点しない。

同一pair / seasonで:

- TITLE_RACE は最大1件
- CLOSE_SERIES は最大1件
- HUMILIATING_RESULT は最大1件
- DOMINANT_TARGET単独ではMemoryを作らない

とする。

Postseason elimination / major incident等の明確なEventは別。

通常戦の大量対戦数だけで宿敵化しない。

---

# 13. Emergent Rivalry Birth

初回EventだけでいきなりUIに「宿敵」と表示しない。

内部Candidate EdgeはEvent発生時に作成可能。

Active Rivalryとして表面化する条件候補:

```text
effectiveIntensity >= 30
AND
(
  at least 2 meaningful events within 4 seasons
  OR
  one severe event with weight >= 25
)
```

つまり:

- 一度だけ普通のPOで負けた
- 一回だけ接戦した

程度では必ずしも新Rivalryにならない。

---

# 14. Emergent Rivalry Decay

後天的RivalryにはHistorical Floorが無い。

Memoryが減衰すれば自然にIntensityも下がる。

候補削除条件:

```text
effectiveIntensity < 15
AND
no meaningful rivalry event for 5 seasons
AND
not permanentHistoricalEdge
        ↓
delete rivalry edge
```

これによりDatabaseも疎なGraphのまま保てる。

---

# 15. Dormant Rivalry

`15 <= intensity < 30` のEmergent Edgeは:

```text
DORMANT
```

扱い候補。

- 通常UIでは「ライバル」と強調しない
- Memoryは保持
- 再戦や新事件で簡単に再燃可能

完全削除前に薄い記憶層を一段置く。

---

# 16. Historical Rivalry Never Deletes

`permanentHistoricalEdge = true` は:

- intensityがFloorまで下がっても削除しない
- League separationしても残す
- 何十年対戦が無くてもHistoryとして残す

ただし現在のMatchImportanceは:

```text
historicalFloor
+ current context
```

で作るため、100年前のDerbyが常に現在の優勝決定戦と同じ熱量になるわけではない。

---

# 17. No Automatic Historical Promotion

Career中に生まれたEmergent Rivalryを自動でPermanent Historicalへ昇格させない。

理由:

- centuries-long saveで永久Edgeが増え続ける問題を再発させる
- ユーザー案の「初期Rivalryは恒久、後天Rivalryは増減」を明確に保つ

後天的Rivalryは100年続いても、Eventが続く限り高Intensityを維持できる。

しかし出来事が途絶えればいつか薄れる。

将来、ユーザーが明示的に`歴史化`を欲しがった場合だけ別設計する。

---

# 18. Current Competitive Threat

`currentCompetitiveThreat` はRivalryとは別のFast State。

入力候補:

- same title race
- direct playoff / qualification contention
- repeated current-season meetings
- opponent dominance
- standings leverage

Season終了で大幅にreset / recalc。

これにより:

```text
dominant Club
 -> many clubs prioritize it this year
```

は可能。

しかし:

```text
everyone permanently hates dominant Club
```

にはならない。

---

# 19. Dominant Club Target

`DOMINANT_CLUB_TARGET` は原則:

```text
currentCompetitiveThreat
```

へ入れる。

それ単独ではRivalryMemoryを作らない。

ただしdominant Clubと:

- title決定戦
- repeated postseason elimination
- controversial incident

が起きれば、それらのEventがMemoryを作る。

これで「包囲網」と「宿敵」を分離する。

---

# 20. UI Thresholds

通常UI候補:

| Effective | UI |
| --- | --- |
| 0–14 | none |
| 15–29 | hidden / dormant |
| 30–49 | 因縁あり |
| 50–69 | ライバル |
| 70–84 | 強いライバル |
| 85–100 | 宿敵 |

Permanent Historical EdgeはFloorが30以上なので最低でも`因縁あり`として残る。

---

# 21. Explanation UI

詳細画面で「なぜこのIntensityか」を説明できる。

例:

```text
Leverkusen -> Bayern
因縁: 78

歴史的基盤             30
2034 優勝争い          +8.1 remaining
2035 PO敗退            +13.9 remaining
2037 PO敗退            +15.0 remaining
Repeated elimination   +7.4 remaining
Current threat         separate
```

ユーザーへ数式理解を要求しない。

興味がある人だけ履歴を見られる。

---

# 22. Player Psychology Connection

effectiveIntensityをPlayerへ直接コピーしない。

既存設計どおり:

```text
Club Rivalry
+ Club Identification
+ Player Personal History
+ Personality
+ Match Importance
       ↓
PersonalStake
       ↓
Appraisal
       ↓
EmotionPressure
       ↓
ActiveEmotion if threshold crossed
```

Rivalry 100でも全員が好調にはならない。

---

# 23. Manager AI Connection

Manager AIには:

- effective rivalry
- current competitive threat
- title leverage
- postseason leverage
- fan expectation
- fatigue / rotation state

を別々に入力する。

同じ`title race`をRivalryとStandingsで二重に即時加点しないよう、RivalryMemoryはEvent発生後のHistoryとして扱う。

---

# 24. Save / Replay

RivalryMemoryはClub Historyの一部。

Saveに:

- sourceEventId
- event kind
- createdSeason
- initialWeight
- halfLife

を残す。

過去SeasonをReplayしてRivalryを再抽選しない。

---

# 25. Performance

234 Clubs全pairのDense Matrixを毎日更新しない。

```text
permanent initial edges
+
event-created sparse edges
```

だけ保存。

Decayは毎日tickせず、Season boundary / relevant access時に経過SeasonからDerived計算できる。

---

# 26. Test Principles

- ordinary regular-season games alone do not make every opponent a rival
- dominant-club targeting alone does not create permanent rivalry
- historical initial edges never delete
- emergent edges can decay and delete
- repeated elimination naturally raises rivalry
- one-sided rivalry remains possible
- no-event years reduce emergent intensity
- new event can revive dormant rivalry
- current title threat can be high while long-term rivalry remains low
- rivalry never directly buffs player true ability
- 300-year simulation keeps graph sparse rather than approaching complete graph

---

# 27. Approval Candidate

今回の中心案:

1. Initial RivalryだけPermanent Historical Edge
2. Permanent EdgeはHistorical Floorを持つ
3. 現在Seedの高さはPermanent Floor + decaying Initial Contextに分離
4. Career後のRivalryはEvent Memoryの合計で形成
5. MemoryはEvent種別ごとのHalf-lifeで自然減衰
6. Emergent Rivalryは30以上で表面化
7. 15未満 + 5season無事件でEmergent Edge削除
8. Dominant Club TargetはFast Threatであり、それ単独ではRivalryMemoryを作らない
9. repeated title race / elimination / incident / transfer等だけがMemoryを作る
10. Emergent Rivalryを自動で永久Historicalへ昇格させない
11. Directionalityを維持
12. RivalryはPsychology / Manager Priorityへの入力であり能力Buffではない
