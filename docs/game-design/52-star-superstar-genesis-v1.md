# Star / Superstar Genesis v1 — CANONICAL

更新日: 2026-09-20  
状態: **CANONICAL / DESIGN FROZEN v1。実装前。**

関連:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/08-player-traits-design-seed.md`

---

# 1. Core Decision

> **Star / Superstarという称号はCareerで証明される。だが、それになり得る稀な素質はPerson生成時から存在し得る。**

```text
Candidate
= rare hidden predisposition

Status
= later Career evidence / recognition
```

Candidateは運命ではない。

---

# 2. Candidate Is Not Destiny

禁止:

```text
SUPERSTAR_CANDIDATE = true
 -> automatically becomes Superstar
```

採用:

```text
rare generation predisposition
 -> unusual latent profile
 -> development / opportunity / injuries / era / luck
 -> actual Career evidence
 -> may or may not become Star / Superstar
```

Candidateでも一軍定着できず終わることがある。

---

# 3. Hidden Genesis Profile

候補v1:

```ts
type StarGenesisProfile = {
  spotlightPotential: number;
  pressureStabilityPotential: number;
  pressureConversionPotential: number;
  iconicPotential: number;
  publicMagnetismPotential: number;
};
```

これらは:
- raw Contact / Power / Velocityではない
- Match outcomeを直接変更しない
- Star / Superstar表示を直接付与しない
- 長期的な潜在傾向

---

# 4. Match Core Boundary

Hard rule:

```text
Match Core MUST NOT read
- STAR_CANDIDATE
- SUPERSTAR_CANDIDATE
```

Matchで使ってよいのは実現済みの状態だけ:
- current Spotlight Response
- Condition
- Appraisal
- ActiveEmotion
- actual baseball ability
- Match Salience

Candidate flagはGeneration / Development専用。

---

# 5. From Potential to Realized Response

```text
Star Genesis Profile
+ development
+ experience
+ personality
+ career history
        ↓
Realized Spotlight Response
```

同じCandidateでもCareerは分岐する。

```text
Candidate A
 -> develops well
 -> reaches major stages
 -> repeatedly performs
 -> Superstar possible

Candidate B
 -> injuries / no opportunity
 -> little major-stage evidence
 -> never becomes Star
```

---

# 6. Mostly Innate, Rarely Acquired

v1方針:
- Superstar級の極端な潜在Profileは主にPerson生成時に決まる
- Star級の性質は経験で伸び得る
- Spotlight Responseそのものは経験で改善可能
- Late-blooming Starは許可
- ordinary baselineからSuperstar級まで後天的に到達するのは極めて稀

つまり:

```text
Star / Superstar candidate tendency
= mainly innate

Star / Superstar status
= earned / evidenced
```

---

# 7. Luck Is Required

Superstar誕生は素質だけでは決まらない。

```text
latent predisposition
× baseball ability
× development
× opportunity
× major-stage access
× actual outcomes
× public reach
× era context
× variance / luck
        ↓
observed Career
```

強い潜在Profileを持っていても、大舞台に立てなければ歴史的Superstarにならないことがある。

---

# 8. Nagashima-type Emergence Requirement

Systemは以下をspecial-caseなしで生成できなければならない。

- 実力は明確にelite
- しかし必ずしも時代の統計的No.1ではない
- Spotlight Responseが極めて高い
- 高Salience Matchで良いCondition / positive activationへ寄りやすい
- 実際に大舞台で繰り返し結果を出す
- memorable / iconic momentsが蓄積する
- 観客・文化に強く記憶される

禁止:
- `clutch hit probability +X`
- Superstar labelからのBuff
- scripted championship moment
- 特定実在人物hard-code

概念:

```text
elite ability
+ exceptional genesis profile
+ strong realized Spotlight Response
+ real major-stage opportunities
+ repeated actual success
+ iconic public moments
        ↓
historically memorable Superstar
```

---

# 9. Dominant Superstar Requirement

同じEngineで:

```text
historic true ability
+ exceptional production
+ rare genesis profile
+ broad recognition
+ major-stage success
        ↓
Complete / Dominant Superstar
```

も生成可能でなければならない。

Iconic型とDominant型は同一Engine上の異なる形。

---

# 10. Candidate Rarity

exact probabilityはSoak前に固定しない。

設計意図:

```text
ordinary person generation
 -> overwhelming majority

Star-candidate-like profile
 -> rare

Superstar-candidate-like extreme profile
 -> extremely rare
```

Hard quotaは禁止。

可能:
- 長期間まともなSuperstar候補が生まれない
- Candidateが複数出ても誰も実現しない
- ごく稀にExceptional generationが重なる

---

# 11. User Discovery

Candidate flagは通常Userへ見せない。

望ましい体験:

```text
rookie
 -> ordinary / promising profile
 -> important games
 -> repeatedly unusual composure / activation
 -> user notices pattern
 -> evidence grows
 -> big-stage descriptor / Star appears
 -> much later Superstar may be earned
```

初日に「将来のSuperstar」と表示しない。

---

# 12. Final Causal Rule

> **Status is retrospective; potential can be pre-existing.**

これにより:
- 完全な運命論を避ける
- 後付け称号だけの空虚さも避ける
- 稀な人物差をCareer開始時から保持できる
- それでも最終的な歴史は実力・機会・結果・運で決まる

---

# 13. Acceptance Tests

1. Superstar candidate can fail to become even a Star.
2. non-candidate can rarely grow into Star-level status.
3. fully acquired Superstar from ordinary baseline is extremely rare.
4. Match Core never reads candidate flags.
5. big-stage advantage routes through realized Spotlight Response.
6. elite-but-not-best player can become an iconic Superstar.
7. historically dominant player can become a Complete Superstar.
8. no direct clutch probability bonus exists.
9. some generations produce no Superstar.
10. user discovers special players through Career evidence, not a visible destiny badge.
