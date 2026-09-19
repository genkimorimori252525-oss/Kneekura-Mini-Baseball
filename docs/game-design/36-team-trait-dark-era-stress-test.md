# Team Trait Dark-Era Stress Test

更新日: 2026-09-20  
状態: **設計検証用。Historical factsとGame-model interpretationを分離する。**

関連:
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/19-club-structural-dominance-and-decline.md`
- `docs/game-design/31-scouting-recruitment-system.md`
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
- `docs/game-design/35-team-trait-catalog-DRAFT.md`

---

# 1. Stress-Test Principle

Team TraitはDark Eraの**近接状態 / 表れ方**を説明する。

Team Traitだけで10年・20年の低迷を作ってはいけない。

```text
Institution / Economy / Scouting / Development / Roster
        ↓
Manager / Role / Relationship / Team Mood
        ↓
Blue / Red Team Traits
        ↓
Actual Games
        ↓
Standings / Dark Era Narrative
```

長期Dark Eraほど上流原因が必要。

---

# 2. Case A — Chunichi Dragons 2022–2024

## Historical observation

- 2022: Central League 6th, 66–75–2
- 2023: 6th, 56–82–5
- 2024: 6th, 60–75–8
- 2022 runs scored: 414, league-low
- 2023 runs scored: 390, league-low
- 2024 runs scored: 373, league-low
- team ERA:
  - 2022: 3.28
  - 2023: 3.08
  - 2024: 2.99

特に2023はteam ERAがCentral League 2位ながら最下位。

## Game-model interpretation

Primary root:

```text
offensive run-creation weakness
```

Team Traitが表現できる候補:

- タイムリー欠乏症
- あと一本病
- 好投見殺し
- 投打不協和 ※game-level evidenceがある場合のみ
- 終盤焦燥 / 逆転負け癖 ※実際のevent evidence次第

重要:

`投打不協和` は原因ではなくDerived Descriptor。

## Verdict

**Team Trait systemが特に得意なCase。**

ただし3年連続最下位そのものは、毎年のoffensive roster / lineup construction / usage等の上流原因も必要。

---

# 3. Case B — Hanshin Tigers 1987–2001

## Historical observation

15 seasonsで:

- B-class 14回
- last place 10回
- top classは1992年の1度

当時の球団関係者による回顧では、優勝時主力の衰え後に新旧交代がうまく進まなかったこと等が長期低迷原因として挙げられている。

## Game-model interpretation

これはTeam Trait主体にしてはいけない。

Primary roots:

- aging core
- poor succession
- roster construction
- scouting / draft outcomes
- development pipeline
- organizational instability

その結果としてSeasonごとに:

- 連敗病
- タイムリー欠乏症
- ブルペン不信
- 新戦力ぎこちない
- 失点引きずり
- Team Mood deterioration

等が再発し得る。

## Prohibited explanation

```text
1987 暗黒Trait取得
 -> 2001まで能力低下
```

は禁止。

## Verdict

**Team Traitだけでは説明不能であることが正しい。**

15年Dark EraはInstitution + Player Pipeline + annual team-stateの複合。

---

# 4. Case C — Yokohama BayStars 2008–2011

## Historical observation

- 2008: 48–94, last
- 2009: 51–93, last
- 2010: 48–95, last
- 2011: 47–86–11, last

Team ERA:
- 2008: 4.74, Central League worst
- 2009: 4.36, worst
- 2010: 4.88, worst
- 2011: 3.87, worst

2008 offense itselfは552 runsで、投手側ほど極端なリーグ最下層ではなかった。

## Game-model interpretation

Primary root:

```text
sustained run-prevention weakness
```

Possible Red states if actual evidence supports them:

- ブルペン不信
- 継投迷走
- 失点引きずり
- 四球連鎖
- バッテリー不信
- 中継混線
- 逆転負け癖

しかしraw pitching quality / depthが不足している場合、それはTeam TraitではなくRoster Truth。

## Verdict

**Team Traitは「どう崩れるか」を説明する。**
**Rosterは「なぜそもそも失点しやすいか」を説明する。**

この分離が必要。

---

# 5. Case D — Detroit Tigers 2003

## Historical observation

- 43–119
- 591 runs scored
- 928 runs allowed
- run differential -337
- Pythagorean recordも49–113相当

## Game-model interpretation

これはTeam Traitで説明してはいけない代表例。

Primary:

- severe overall roster performance weakness
- insufficient run creation
- insufficient run prevention

Red Trait:

- 連敗病
- 失点引きずり
- ブルペン不信
- タイムリー欠乏症

等はSeason内で派生してよい。

しかしそれらを除去しても、Underlying Rosterが弱ければ大幅負け越しは残る。

## Verdict

**System must be able to say: “これは空気ではなく、戦力が弱い。”**

これを言えなければTeam Traitが過剰。

---

# 6. Case E — Baltimore Orioles 2018–2021

## Historical observation

2018:
- 47–115
- 622 runs scored
- 892 runs allowed
- franchise worst record at the time
- offenseはAL最下位級
- starters / relieversともに5.51 ERA
- season中に主力複数をtradeしrebuildへ移行

2017–2021ではMLBで最も多く敗れた球団だったとMLB公式が整理している。

## Game-model interpretation

Primary roots:

- intentional / structural rebuild
- roster teardown
- weak current MLB roster
- organization reconstruction

Team Traits may describe:

- 連敗病
- ブルペン不信
- 新戦力ぎこちない
- 守備連携低下
- Team Mood stress

だが、rebuildをRed Traitで表現してはいけない。

## Verdict

**Dark Eraでも“失敗”とは限らない。**

短期の大量敗戦と、長期Organization strategyを区別できる必要がある。

---

# 7. Case F — Pittsburgh Pirates 1993–2012

## Historical observation

20 consecutive losing seasons。

MLB公式はNorth American professional team sports recordとして紹介している。

## Game-model interpretation

20年をTeam Traitで持続させるのは明確に禁止。

Primary roots must live in:

- finance / market constraints
- player retention
- scouting
- development
- roster-building
- front-office decision quality
- organizational change

各Season内ではRed Traitsが発生・消失する。

```text
1998 Red Trait
 -> season end reset

1999 same organizational roots remain
 -> different events
 -> similar Red Traits may reappear
```

## Verdict

**このCaseこそSeason Boundary Policyの理由。**

長期低迷が続くのはTraitが永久だからではなく、上流原因が毎年似たTeam Stateを再生成するから。

---

# 8. Dark-Era Taxonomy

以上からDark Eraを4種類に分ける。

## Type A — Roster Weakness

例:
- Detroit 2003

```text
Player / roster qualityが主因
```

Team Traitは副作用。

## Type B — Unit Imbalance

例:
- Chunichi 2022–2024
- Yokohama 2008–2011

```text
good pitching + weak offense
or
adequate offense + weak pitching
```

Team Synchrony / Unit Red Traitが説明力を持つ。

## Type C — Organizational Dark Era

例:
- Hanshin 1987–2001
- Pittsburgh 1993–2012

```text
scouting / development / succession / retention / organization
```

Team TraitはSeasonごとの症状。

## Type D — Rebuild Dark Era

例:
- Baltimore 2018–2021

```text
deliberate future-oriented organization state
 -> current roster weak
```

単なる“悪い空気”として扱わない。

---

# 9. Important Model Conclusion

Dark Eraを説明する式:

```text
Long-term structural causes
+ current roster truth
+ manager / roster usage
+ relationships / coordination
+ team mood
+ temporary Team Traits
+ ordinary baseball variance
        ↓
actual repeated losses
        ↓
Dark Era Narrative
```

Team Traitは一つの層にすぎない。

---

# 10. Validation Criteria

この設計を現実的と認めるための条件:

1. Strong roster can have bad Team Traits without automatically becoming worst team.
2. Weak roster remains weak even if Team Traits are neutral.
3. Team Traits explain *how* a team repeatedly fails.
4. Structural systems explain *why* failure can persist for many seasons.
5. Team Synchrony is derived from actual game timing, not a hidden loss modifier.
6. Season reset prevents 20-year magical curses.
7. Persistent upstream problems can regenerate similar Red Traits next season.
8. Rebuild seasons are distinguishable from organizational incompetence.
9. Dark Era is a Derived Narrative, never one universal debuff.
10. Historical case reconstruction should be possible without inventing direct outcome modifiers.

---

# 11. Stress-Test Result

**PASS, with one important condition:**

Team Trait must remain a **proximate-state layer**, not the universal root cause of losing.

The architecture is realistic precisely because some famous Dark Eras are highly explainable by Team Traits, while others require Roster / Scouting / Development / Economy / Management layers.
