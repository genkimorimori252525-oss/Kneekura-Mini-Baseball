# Player Development Trajectory & Breakthrough Architecture v1 — CANONICAL

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

監査:
- `docs/game-design/54-player-development-breakthrough-adversarial-audit.md`

関連:
- `docs/game-design/05-psychology-emotion.md`
- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/09-player-trait-catalog.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/32-roster-development-architecture-DRAFT.md`
- `docs/game-design/37-team-mood-architecture.md`
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`
- `docs/game-design/52-star-superstar-genesis-v1.md`

---

# 1. Product Goal

Playerの成長を:

```text
年齢になった
 -> 能力+X
```

や:

```text
覚醒イベント発生
 -> 全能力+10
```

で作らない。

採用する原則:

> **人生で何が起きたか -> 本人がどう受け取ったか -> 何を試したか -> 何が再現・定着したか -> 能力 / Behavior / Traitへ表面化したか**

偶然の好結果もCanonical World Eventであるため、Player本人にとって大きな意味を持てば、その後のLearning / Confidence / Technical changeのCatalystになり得る。

ただし偶然の結果そのものを能力へ直接変換しない。

---

# 2. Frozen Principles

1. Developmentはage curveだけで決まらない。
2. 高校 / 大学 / 社会人 / Academy等のPathway Labelは直接成長Buffを持たない。
3. 成長曲線は能力加算表ではなく、主に**Development Receptivity / Peak Timing Prior / Decline Pressure**を表す。
4. Actual developmentはtraining / coaching / game repetitions / challenge fit / health / fatigue / motivation / psychology / opportunityから因果的に発生する。
5. Player生成時にHidden `DevelopmentTrajectoryProfile` と `DevelopmentCatalystProfile` を持てる。
6. 生来のCatalyst Profileは「何に反応しやすいか」であり、将来Eventや成功を保証しない。
7. Catalyst Eventを踏んだだけでは成長しない。
8. BreakthroughはResponse -> Hypothesis -> Repetition -> Consolidationを必要とする。
9. `覚醒` は原因Flagではなく、**期待軌道を大きく上回る定着成長を後から要約するDerived Career Event**。
10. 大怪我はまず損傷 / 離脱 / Rehabとして扱う。怪我そのものに成長報酬を付けない。
11. Match RNGで生じた幸運な結果も正史Eventだが、能力が過去から存在したことにはしない。成長はEvent後に始まる。
12. Trait acquisitionは09のSource Stateが本当に変わったか、または十分なEvidenceでRecognitionされた場合だけ。
13. Trait Labelから能力を作らない。
14. Pressure / Confidence / ActiveEmotionの同一原因をTraitとEmotionで二重加算しない。
15. User / CPUはHidden growth curve / catalyst trigger / true future potentialを読まない。
16. Career development RNGはMatch Physics RNGから分離し、version / seed / provenanceを保存する。

---

# 3. Pathway != Development Destiny

高校生、大学生、社会人、Academy、Reserve、その他Pathwayは、その時点までの:
- age
- physical maturation
- game repetitions
- coaching history
- competition exposure
- medical history
- observed evidence

を変える。

しかし:

```text
高校卒 -> 晩成
大学卒 -> 普通
社会人 -> 成長終了
```

のような固定変換は禁止。

高校生の超早熟も、社会人の超晩成も成立可能。

---

# 4. DevelopmentTrajectoryProfile — 5 Timing x 3 Shape = 15 Templates

Person生成時にHidden Profileを持つ。

```ts
type DevelopmentTrajectoryProfile = {
  maturityTiming:
    | "VERY_EARLY"
    | "EARLY"
    | "NORMAL"
    | "LATE"
    | "VERY_LATE";
  curveShape:
    | "SHARP_PEAK"
    | "BROAD_PLATEAU"
    | "STEPWISE_WAVES";
  domainOffsets: DevelopmentDomainOffsets;
  profileVersion: string;
};
```

## 4.1 Maturity Timing

v1 nominal prior:

| Timing | 全盛期が来やすいAge prior | 意味 |
| --- | --- | --- |
| 超早熟 / VERY_EARLY | 18–23 | 非常に早くDevelopment Receptivityが高まりやすい |
| 早熟 / EARLY | 21–26 | 若年で主成長波が来やすい |
| 普通 / NORMAL | 24–30 | 標準的な主成長・Peak prior |
| 晩成 / LATE | 27–33 | 成熟後に主成長波が来やすい |
| 超晩成 / VERY_LATE | 30–37+ | 遅い時期まで大きなLearning / adaptation余地が残りやすい |

これはHard Age Gateではない。分布は重なり、個人差 / Domain差 / Injury / Opportunity / Breakthroughで外れる。

## 4.2 Curve Shape

### SHARP_PEAK
- riseが比較的急
- high-receptivity windowが狭い
- Peak後のdecline pressureも比較的早く出やすい

### BROAD_PLATEAU
- riseが比較的滑らか
- Peak周辺の高原期間が長い
- 一度の停滞を即 decline とみなさない

### STEPWISE_WAVES
- 成長 -> 停滞 -> 再成長の段階を持ちやすい
- secondary wave / role change / technical breakthroughが見えやすい
- ただしCatalyst発生率を直接BuffするCurveではない

5 Timing x 3 Shapeで15 Templateを作る。

## 4.3 Domain Offsets

一人のPlayerでも全能力が同じ年齢曲線を使うとは限らない。

主Domain:
- physical / maturation
- technical mechanics
- recognition / cognitive
- role / tactical understanding
- behavioral preference
- recovery / durability adaptation

例:

```text
physical peak earlier
recognition / sequencing peak later
```

を許可する。

`domainOffsets` は同じPlayer内の時期差を表す。各能力へ年齢だけで自動加点しない。

---

# 5. Development Receptivity Is Not Ability

概念:

```text
underlying learning potential
x current domain receptivity
x training stimulus
x coaching fit
x meaningful repetitions
x challenge fit
x health / recovery availability
x attention / role opportunity
x motivation / appraisal
+ bounded micro-variation
        ↓
actual adaptation
        ↓
source state change
```

`maturityTiming` / `curveShape` は主に `current domain receptivity` と decline pressureのPriorへ作用する。

禁止:

```text
age 27 reached
 -> contact +5
```

---

# 6. DevelopmentCatalystProfile — Hidden at Person Generation

User指定どおり、PlayerはPerson生成時から「何が転機になりやすいか」の個人差を持つ。

```ts
type DevelopmentCatalystProfile = {
  sensitivityByFamily: Partial<Record<CatalystFamily, number>>;
  signatureMotifs: readonly CatalystMotifId[];
  profileVersion: string;
};
```

`signatureMotifs` は0..NのHidden affinity。通常は少数でよい。

例:
- high-leverage success
- humiliation / being passed over
- injury-rehab reconstruction
- mentor bond
- elite-player exposure
- role promotion
- demotion / career threat
- technical accident / discovery

重要:

> **生まれつき「デッドボールを受けたら覚醒する」と決まっているのではない。**

ProfileはEventのSalience / response likelihoodを変えるだけで、Event発生・response polarity・breakthrough成功を保証しない。

Personality / Confidence / mental traits等が既に同じ情報を持つ場合は重複Statを増やさず、それらをAppraisal入力として利用する。

---

# 7. Catalyst Families

v1で扱う主要Family:

| Family | 具体例 |
| --- | --- |
| UNEXPECTED_SUCCESS | 3者連続三振、初HR、初完封、まぐれの好守、強打者を抑える |
| FAILURE_HUMILIATION | 大炎上、決勝エラー、三振連発、降格、スタメン落ち |
| COMPETITIVE_PROVOCATION | 前打者敬遠、自分への敬遠、ライバルに完敗、ポジション争い |
| INJURY_REHAB | 大怪我、手術、長期離脱、Rehab、身体制約によるフォーム再構築 |
| TECHNICAL_DISCOVERY | 偶然ハマった握り、打撃point発見、投球位置変更、新球種の手応え |
| COACH_MENTOR | 相性の良いCoach、Veteran指導、恩師との再会、Mentorとの深い学習 |
| ELITE_EXPOSURE | Star加入、All-Star、代表、国際大会、一流Playerの観察 |
| ROLE_CHANGE | 4番任命、Closer転向、先発転向、代打専任、守備位置転向 |
| RESPONSIBILITY_TRUST | Captain、継続起用、重要場面を任される、後輩の指導役 |
| ROSTER_COMPETITION | 若手台頭、Roleを奪われる、Competition勝利 / 敗北 |
| PROMOTION_DEMOTION | 一軍昇格、Farm降格、Loan、Reserveからの抜擢 |
| ENVIRONMENT_CHANGE | 移籍、海外挑戦、新League、新Manager、新Staff |
| MAJOR_STAGE | Postseason、Final、All-Star、国際大会、優勝争い |
| RELATIONSHIP_TRANSITION | Mentor引退、相棒移籍、尊敬する先輩退団、新しい相棒との出会い |
| CAREER_THREAT | 戦力外危機、契約最終年、Role喪失、復帰期限 |
| MILESTONE_RECOGNITION | 初勝利、100安打、タイトル争い、代表初選出 |
| TEACHING_LEADERSHIP | 後輩へ教える、技術を言語化、自分のSkillを他者に説明する |
| OPPONENT_PUZZLE | 同じ相手に繰り返し負ける / 抑えられる、対策を試す |
| DATA_INSIGHT | video / tracking / analyticsから自分の癖を発見する |

Catalyst Family自体はBuffを持たない。

---

# 8. Salience and Appraisal

Eventから直接成長判定をしない。

```text
Canonical Event
+ unexpectedness
+ novelty
+ MatchImportance
+ PersonalStake
+ role relevance
+ relationship weight
+ current career context
+ Catalyst affinity
        ↓
Catalyst Salience
        ↓
05 Appraisal
        ↓
possible temporary response
```

同じEventでも:
- 自信になる
- 怒りになる
- 恐怖になる
- 技術探索へ向かう
- 何も残らない

がPlayerごとに異なる。

---

# 9. Breakthrough Pipeline

Major developmentは一発抽選で完成させない。

```text
1. Catalyst Event
2. Personal Appraisal / Response
3. Learning Hypothesis / Behavior Experiment
4. Relevant Repetitions
5. Feedback / Coaching / Self-correction
6. Consolidation
7. Source State actually changes
8. Public Rating / Trait is re-projected
```

例:

```text
偶然3者連続三振
 -> 'この高めの直球は通用するかもしれない'
 -> confidence + technical hypothesis
 -> bullpen / gameで再試行
 -> release / pitch-shape再現性が本当に改善
 -> source state grows
 -> ノビFamily projection may rise
```

最初の3者連続三振は完全なまぐれでもよい。

その後のPlayer自身の反応とLearningによって、まぐれがCareer上の転機になる。

---

# 10. Awakening / 覚醒 Is a Derived Career Event

内部原因として:

```text
AWAKENED = true
 -> ability +X
```

を持たない。

代わりに:

```text
expected trajectory
vs
actual sustained source-state growth
        ↓
unusually large + persistent positive deviation
        ↓
Derived Career Event: 覚醒 / Breakthrough
```

とする。

覚醒Labelの候補条件:
- source stateが実際に変化している
- short hot streakだけではない
- relevant Skill / Behaviorが一定期間再現される
- expected Development Trajectoryを大きく上回る
- causal Catalyst / consolidation provenanceを説明できる

exact threshold / durationはcalibration。

覚醒は能力を追加しない。すでに起きた成長をCareer History上で要約する。

Micro breakthroughは比較的普通に起こり得るが、UIで「覚醒」と呼ぶMajor breakthroughは非常に稀。

複数回のMajor覚醒は許可するが例外的。

---

# 11. Rarity / Hazard Control

高頻度Actionごとの単純rollを禁止する。

禁止:

```text
every training repetition:
  0.01% awakening roll
```

Trainingは回数が非常に多いため、Career全体では覚醒が大量発生する危険がある。

採用:

```text
eligible learning episode
x personal catalyst affinity
x current receptivity
x novelty
x salience
x unresolved learning state
x consolidation capacity
x bounded career RNG
        ↓
breakthrough initiation chance
```

さらに:
- repeated same stimulus saturation
- novelty decay
- refractory / cooldown
- unresolved hypothesis cap
- opportunity cost

を持たせる。

exact probabilityはlong-run soakでcalibrationする。

希少性順:

```text
ordinary adjustment > minor breakthrough > major awakening > repeated major awakening
```

---

# 12. Injury / Rehab Special Rule

大怪我は正式なCatalyst候補。

ただし:

> **怪我をした方が期待成長が高くなるゲームにはしない。**

因果:

```text
injury
 -> actual physical damage / absence / lost repetitions
 -> Rehab
 -> old movement may be unavailable
 -> reconstruction / role reconsideration opportunity
 -> rare compatible discovery
 -> possible consolidation
```

結果候補:
- permanent decline
- recovery to previous level
- changed style with similar value
- role conversion
- rare technical breakthrough

例:
- 球速を失いcommand / sequencingへ転換
- 肩故障後に守備位置転向
- 脚故障後にsteal aggressionが慎重化
- Rehab中に新しいフォーム / 球種を獲得

Injury Eventそのものへpositive stat bonusを付与しない。

User / CPUが意図的にInjuryを狙うことで期待値を上げられる構造を禁止する。

---

# 13. Elite Exposure / Mentor / Major Stage

Star加入 / All-Star / International Tournament / MentorはAura Buffを配らない。

```text
elite person / high-salience environment
 -> observation / interaction opportunity
 -> attention / relationship / curiosity
 -> model learning / new hypothesis
 -> practice / application
 -> possible consolidation
```

相性が悪い /理解できない / opportunityがない場合は何も起きなくてよい。

国際大会参加だけで成長率を上げない。

Mentor引退 / teammate departure等の別れは:
- responsibility shift
- identity change
- motivation
- remembered teaching

等のCatalystになり得るが、必ずpositiveとは限らない。

---

# 14. Role Change Can Change Behavior Faster Than Ability

Green / Neutral BehaviorはPhysical Skillより比較的変化しやすい。

例:

```text
4番へ
+ long-ball role
+ repeated successful power approach
 -> Swing Mode Preference may shift
 -> 強振多用
```

```text
1番へ
+ OBP role
+ repeated take / count-control success
 -> Plate Aggression may shift
 -> 慎重打法
```

ただしManager命令を受けただけで本人Preferenceを書き換えない。

継続的な実行・本人Appraisal・内在化Evidenceが必要。

---

# 15. Negative Learning / Maladaptation

Developmentはpositiveだけではない。

Catalystにより:
- fear avoidance
- over-aggression
- bad mechanical compensation
- stale habit
- confidence collapse
- unsafe effort allocation

が定着する可能性もある。

ただしNegative TraitもEvent罰ではなく、実際にSource State / Behaviorが変化した場合だけ。

後に再学習・環境変更・Coach介入で戻ることも可能。

---

# 16. Trait Acquisition Contract

09の各Trait Familyは取得方法を次のContractで定義する。

```ts
type TraitAcquisitionProfile = {
  traitFamilyId: string;
  acquisitionKinds: readonly TraitAcquisitionKind[];
  eligibleCatalystFamilies: readonly CatalystFamily[];
  sourceStateRequirements: readonly SourceStateRequirement[];
  evidencePolicy: TraitEvidencePolicy;
  consolidationPolicy?: ConsolidationPolicy;
  coachTeachability: "NONE" | "INDIRECT" | "DIRECT";
  experienceLearnability: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  reversible: boolean;
  goldTierRule?: GoldTierRule;
};
```

AcquisitionKind:
- RECOGNITION — source stateは既にあり、Evidenceが増えて表示される
- TECHNICAL_DEVELOPMENT — mechanics / recognition / techniqueが実際に変化
- EXPERIENCE_ADAPTATION — relevant game experienceからstable responseが変化
- BEHAVIOR_PREFERENCE — decision / role preferenceが安定して変化
- PHYSICAL_DEVELOPMENT — maturation / training / recovery等のphysical sourceが変化
- ROLE_SUITABILITY — specific role repetition / routine適応
- RELATIONSHIP_FAMILIARITY — specific opponent / partner / teamへのEvidence

一つのFamilyが複数Kindを持ってよい。

---

# 17. Trait Acquisition Matrix — Pitcher

| Trait Family / UI | Kind | 主なCatalyst | Source / 定着条件 | Coach | Experience |
| --- | --- | --- | --- | --- | --- |
| **ノビ G〜A -> Gold 怪童** | TECHNICAL + RECOGNITION | technical discovery, mentor, rehab reconstruction, successful fastball hypothesis | fastball movement / velocity retention / release sourceが実際に改善し再現 | INDIRECT/DIRECT | MEDIUM |
| 軽い球 / 重い球 -> 怪物球威 | RECOGNITION + TECHNICAL | form / pitch-shape change, strength change | actual velocity / movement / approach-angle / contact-quality source | INDIRECT | MEDIUM |
| ジャイロ / ハイスピンジャイロ | RECOGNITION + TECHNICAL | grip discovery, coach, data insight | stable spin-axis / trajectory source | DIRECT | MEDIUM |
| ナチュラルシュート / 真っスラ / シュート回転 | RECOGNITION + TECHNICAL | form evolution, grip, injury compensation | stable pitch-shape evidence; Neutral where defined | DIRECT | MEDIUM |
| 球速安定 | TECHNICAL + PHYSICAL | routine, conditioning, mechanics | velocity variance / reproducibility improves | DIRECT | MEDIUM |
| キレ -> 驚異の切れ味 | TECHNICAL + RECOGNITION | grip, release discovery, mentor | breaking-ball movement / late movement / reproducibility | DIRECT | HIGH |
| 球持ち -> ディレイドアーム | TECHNICAL + RECOGNITION | mechanics, coach, rehab | extension / visibility / release source | DIRECT | MEDIUM |
| リリース○ | TECHNICAL | coach, video/data insight | pitch-type release similarity improves | DIRECT | HIGH |
| 低め○ -> 精密機械 | TECHNICAL | command training, coach, repeated execution | low-zone command source improves | DIRECT | HIGH |
| 内角攻め -> 内角無双 | TECHNICAL + BEHAVIOR | role, catcher/coach, success/failure | inside command + willingness / sequencing stable | DIRECT | HIGH |
| クロスファイヤー -> クロスキャノン | TECHNICAL | release geometry discovery | diagonal command technique stable | DIRECT | MEDIUM |
| 一発 / 逃げ球 -> 本塁打厳禁 | TECHNICAL + RECOGNITION | miss review, coach, failure catalyst | dangerous-miss distribution actually changes | DIRECT | HIGH |
| 抜け球 | RECOGNITION / NEGATIVE DEVELOPMENT | injury, fatigue habit, mechanics failure | recurrent specific release-failure pattern | INDIRECT | MEDIUM |
| 乱調 | RECOGNITION / NEGATIVE DEVELOPMENT | stress, mechanics inconsistency | short-window command/release variance source persists enough | INDIRECT | MEDIUM |
| 四球 | RECOGNITION + BEHAVIOR | repeated nibbling / count failures | zone-entry / count behavior remains walk-prone beyond raw control | INDIRECT | HIGH |
| ボール先行 / ストライク先行 | BEHAVIOR_PREFERENCE | catcher/coach plan, role, repeated outcomes | early-count approach becomes stable preference | DIRECT | HIGH |
| 緩急○ -> 変幻自在 | TECHNICAL + EXPERIENCE | elite exposure, sequencing success, coach | speed separation + sequencing skill improve | DIRECT | HIGH |
| 奪三振 -> ドクターK | TECHNICAL + EXPERIENCE | two-strike success/failure, opponent puzzle | put-away pitch selection / execution becomes stable | DIRECT | HIGH |
| 対強打者 -> 主砲キラー | EXPERIENCE + RELATIONSHIP | repeated elite matchups | learned high-quality opponent response; not `Star` label bonus | INDIRECT | HIGH |
| 対ピンチ G〜A -> 強心臓 / ノミの心臓 | EXPERIENCE_ADAPTATION | high leverage, blown lead, escape, comeback | stable pressure appraisal / execution evidence across opportunities | INDIRECT | HIGH |
| 打たれ強さ G〜A -> 不屈の魂 | EXPERIENCE_ADAPTATION | HR allowed, error behind pitcher, comeback inning | negative-event reset / execution recovery becomes stable | INDIRECT | HIGH |
| 対左打者 G〜A -> 左キラー | TECHNICAL + EXPERIENCE | repeated platoon matchup | pitch mix / execution / recognition evidence | DIRECT | HIGH |
| ギアチェンジ | BEHAVIOR + EXPERIENCE | role demand, leverage exposure | context-dependent effort allocation stable | INDIRECT | HIGH |
| 全開 / 完全燃焼 | BEHAVIOR + ROLE | emergency / major stage / short outing role | max-effort policy + fatigue tradeoff actually used | INDIRECT | HIGH |
| 力配分 | BEHAVIOR + ROLE | long season, starter role, fatigue management | output-saving policy stable | DIRECT | HIGH |
| 根性 -> ド根性 | PHYSICAL + EXPERIENCE | fatigue exposure, workload adaptation | mechanical execution resilience under fatigue improves | INDIRECT | MEDIUM |
| 尻上がり -> 終盤力 | ROLE + EXPERIENCE | starter repetitions | pacing / late-game maintenance evidence | DIRECT | HIGH |
| スロースターター / 立ち上がり -> トップギア | RECOGNITION + TECHNICAL | warm-up routine, early-inning evidence | early-game readiness source changes / stabilizes | DIRECT | HIGH |
| 回またぎ | ROLE_SUITABILITY | relief multi-inning usage | actual workload/readiness adaptation | DIRECT | HIGH |
| 緊急登板 | ROLE_SUITABILITY | emergency entry repetitions | rapid warm-up / entry routine stable | DIRECT | HIGH |
| 火消し | ROLE + EXPERIENCE | inherited-runner emergencies | pressure + readiness performance persists | INDIRECT | HIGH |
| 回復 G〜A -> ガソリンタンク | PHYSICAL + RECOGNITION | workload, rehab, conditioning | actual RecoveryCapacity source changes / evidenced | INDIRECT | MEDIUM |
| 投手調子極端 / 安定 -> 鉄腕 | RECOGNITION + PHYSICAL/ROUTINE | routine, workload, conditioning | Condition response distribution source changes | INDIRECT | MEDIUM |
| クイック G〜A -> 走者釘付 | TECHNICAL | runner pressure, coach, repeated steal attempts | set-position release / repeatability improves | DIRECT | HIGH |
| 牽制○ | TECHNICAL | runner exposure, coach | pickoff technique actually improves | DIRECT | HIGH |
| 対ランナー○ | EXPERIENCE + TECHNICAL | repeated runner-on-base situations | attention allocation / execution stability | DIRECT | HIGH |
| 打球反応○ | TECHNICAL + PHYSICAL | pitcher-fielding reps | reaction / first move / fielding source improves | DIRECT | HIGH |
| 短気 | BEHAVIOR / PSYCHOLOGY RECOGNITION | provocation, repeated frustration | stable anger-appraisal tendency evidenced; no direct command debuff label | NONE | HIGH |
| 闘志 / 闘魂 | PSYCHOLOGY RECOGNITION | rivalry, major stage, comeback | stable motivational appraisal pattern; effects route through Emotion | NONE | HIGH |
| 速球中心 / 変化球中心 | BEHAVIOR_PREFERENCE | catcher/coach plan, pitch success | pitch-selection preference stable | DIRECT | HIGH |
| テンポ○ | BEHAVIOR / ROUTINE | role, coach, success | pace/routine preference stable | DIRECT | HIGH |
| 荒れ球 | RECOGNITION | actual stuff + command-variance combination | both benefit/cost sources evidenced; label itself is not learned | NONE | MEDIUM |

**表記確定:** `ノビ` は `G〜A` Graded Family。`ノビ○` はCanonical表記に使わない。Aより上のGold Tierは **怪童**。

---

# 18. Trait Acquisition Matrix — Batter / Fielder / Catcher

| Trait Family / UI | Kind | 主なCatalyst | Source / 定着条件 | Coach | Experience |
| --- | --- | --- | --- | --- | --- |
| アベレージヒッター -> 安打製造機 | TECHNICAL + RECOGNITION | coach, role, repeated contact success | contact precision / batted-ball quality technique | DIRECT | HIGH |
| パワーヒッター -> アーチスト | TECHNICAL + PHYSICAL + RECOGNITION | strength/form development, role | power-swing launch / transfer source improves | DIRECT | HIGH |
| 流し打ち -> 芸術的流し打ち | TECHNICAL | outside-pitch struggle, coach, opponent puzzle | opposite-field timing / bat path improves | DIRECT | HIGH |
| 広角打法 -> 広角砲 | TECHNICAL | pitch-location challenge, elite model | multi-direction hard-contact technique stable | DIRECT | HIGH |
| プルヒッター / 引っ張り屋 | TECHNICAL + BEHAVIOR | role, success, coach | pull-side transfer + preference stable | DIRECT | HIGH |
| ラインドライブ | RECOGNITION + TECHNICAL | swing change | launch distribution source evidenced | INDIRECT | MEDIUM |
| カット打ち | TECHNICAL | two-strike failure, coach | late-contact / foul-extension skill improves | DIRECT | HIGH |
| 粘り打ち | TECHNICAL + EXPERIENCE | repeated two-strike battles | foul-survival / adjustment skill improves | DIRECT | HIGH |
| 内角 / 外角 / 高球 / 低球 Family -> Master tier | TECHNICAL + EXPERIENCE | repeated location challenge, coach | zone-specific timing / mechanics improve | DIRECT | HIGH |
| 対ストレート○ / 対変化球○ | TECHNICAL + EXPERIENCE | repeated failures, video, elite exposure | pitch-family recognition / timing / adjustment source improves | DIRECT | HIGH |
| 初球○ -> 一球入魂 | BEHAVIOR + TECHNICAL | role, first-pitch success/failure | first-pitch approach + execution stable | DIRECT | HIGH |
| 窮地○ -> ヒートアップ | EXPERIENCE_ADAPTATION | two-strike pressure / comeback AB | narrowing-option adaptation stable | INDIRECT | HIGH |
| 三振 -> 扇風機 | RECOGNITION / NEGATIVE DEVELOPMENT | repeated two-strike failure | recognition / adjustment weakness persists | INDIRECT | HIGH |
| リベンジ / 逆襲 | EXPERIENCE_ADAPTATION | previous-AB failure, opponent puzzle | in-game adjustment speed / learned matchup improves | INDIRECT | HIGH |
| チャンス G〜A -> 勝負師 | EXPERIENCE_ADAPTATION | scoring-position/high-leverage repetitions | stable Pressure-response evidence; Emotion double-count forbidden | INDIRECT | HIGH |
| 満塁男 -> 恐怖の満塁男 | EXPERIENCE_SPECIALIZATION | repeated bases-loaded opportunities | persistent bases-loaded specialization beyond generic Pressure evidence | NONE | HIGH |
| サヨナラ男 -> 伝説のサヨナラ男 | EXPERIENCE_SPECIALIZATION | walk-off opportunities / success/failure | repeated extreme-leverage response; one walk-off is only a Catalyst | NONE | HIGH |
| 決勝打 -> 渾身の決勝打 | EXPERIENCE_SPECIALIZATION | tie/go-ahead opportunities | persistent go-ahead execution evidence, no direct result buff | NONE | HIGH |
| 逆境○ -> 火事場の馬鹿力 | EXPERIENCE_ADAPTATION | trailing games, comeback, humiliation | challenge-oriented appraisal / execution becomes stable | INDIRECT | HIGH |
| 対エース○ -> エースキラー | EXPERIENCE + RELATIONSHIP | repeated high-quality opponent exposure | actual high-quality pitch adaptation / matchup evidence | INDIRECT | HIGH |
| 代打○ -> 代打の神様 | ROLE_SUITABILITY + EXPERIENCE | bench role, emergency chances | pinch-hit readiness / routine / evidence stable | DIRECT | HIGH |
| 対左投手 G〜A -> 左腕キラー | TECHNICAL + EXPERIENCE | platoon matchup repetitions | matchup technique / recognition source improves | DIRECT | HIGH |
| バント○ -> バント職人 | TECHNICAL | role demand, coach | bunt contact / placement source improves | DIRECT | HIGH |
| 内野安打○ -> ロケットスタート | RECOGNITION + TECHNICAL/PHYSICAL | sprint/start training, usage | bat-to-run transition / first-step source improves | DIRECT | MEDIUM |
| 盗塁 G〜A -> 電光石火 | TECHNICAL + EXPERIENCE | attempts, catcher/pitcher study, coach | lead / start / acceleration / slide source improves | DIRECT | HIGH |
| 走塁 G〜A -> 高速ベースラン | TECHNICAL + EXPERIENCE | baserunning repetitions | route / read / extra-base decision improves | DIRECT | HIGH |
| ヘッドスライディング / 気迫ヘッド | BEHAVIOR_PREFERENCE | role, mentor, success/failure | slide-style preference stable; no speed bonus | INDIRECT | HIGH |
| かく乱 -> トリックスター | TECHNICAL + BEHAVIOR | runner role, opponent reaction evidence | threat / timing / deception behavior stable | INDIRECT | HIGH |
| 守備職人 -> 魔術師 | TECHNICAL + EXPERIENCE | huge fielding reps, mentor, position role | route / first move / transfer / decision improves | DIRECT | HIGH |
| 高速チャージ | TECHNICAL | bunt/slow-ball reps | charge/read/transfer technique improves | DIRECT | HIGH |
| 送球 G〜A -> ストライク送球 | TECHNICAL | coach, error, position reps | throwing accuracy / transfer source improves | DIRECT | HIGH |
| レーザービーム -> 高速レーザー | RECOGNITION + TECHNICAL/PHYSICAL | throwing development | arm velocity / trajectory / transfer evidence | INDIRECT | MEDIUM |
| ホーム死守 -> 鉄の壁 | TECHNICAL + EXPERIENCE | tag/block situations | tag-and-block execution source improves | DIRECT | HIGH |
| ブロッキング | TECHNICAL | catcher training | block technique / read source improves | DIRECT | HIGH |
| フレーミング -> upper tier | TECHNICAL + RECOGNITION | receiving coach, game reps | receiving / call-influence source improves; RuleProfile aware | DIRECT | HIGH |
| キャッチャー G〜A -> 球界の頭脳 | TECHNICAL + COGNITIVE + EXPERIENCE | game calling, pitcher relationships, mentor | handling / communication / game-calling source improves | DIRECT | HIGH |
| バズーカ送球 | RECOGNITION + TECHNICAL/PHYSICAL | catcher throw training | pop-time + velocity + accuracy source evidenced | DIRECT | MEDIUM |
| ケガしにくさ G〜A -> 鉄人 | PHYSICAL + RECOGNITION | conditioning / medical history | actual injury-resistance source; injury itself does not grant it | INDIRECT | LOW |
| 回復 G〜A | PHYSICAL + RECOGNITION | workload / rehab / conditioning | actual RecoveryCapacity source | INDIRECT | MEDIUM |
| Team Killer / ○○キラー | RELATIONSHIP_FAMILIARITY | repeated specific opponent meetings | current opponent overlap + familiarity evidence; roster changes can invalidate | NONE | HIGH |

---

# 19. Green / Neutral Behavior Acquisition Matrix

| Family | Main Catalysts | Required stabilization |
| --- | --- | --- |
| Pitch Approach: 速球中心 / Balanced / 変化球中心 | catcher/coach plan, pitch success/failure, role | repeated voluntary/accepted pitch-selection pattern |
| Swing Mode: 強振多用 / Balanced / ミート多用 | lineup role, coach, success/failure | stable swing-mode preference |
| Plate Aggression: 積極打法 / Balanced / 慎重打法 | OBP role, strikeout/walk history, coach | stable take/swing decision tendency |
| Steal Aggression | steal success/failure, manager trust, role | stable attempt preference; speed itself unchanged |
| 積極走塁 | extra-base success/failure, role | stable baserunning decision preference |
| 積極守備 | position role, coach, successful aggressive plays | stable fielding aggression preference |
| チームプレイ○ / Neutral / × | role, relationship, team context | repeated decision preference; no team-wide buff |
| 投手 / 野手 調子安定・極端 | routine, health, career evidence | Condition-response distribution source must actually change / be evidenced |
| 春男 / 夏男 / 秋男 | multi-season condition/performance pattern | repeated seasonal evidence; one hot month is insufficient |
| 投球位置 左 / 中央 / 右 | coach, matchup, mechanics | stable setup/release-geometry choice; Neutral setup |

Manager instructionだけでGreen Traitを即時変更しない。

---

# 20. Recognition vs Development

Trait表示の変化は必ずどちらか、または両方としてprovenanceを残す。

```text
RECOGNITION
  source state already existed
  -> evidence/confidence crossed display threshold

DEVELOPMENT
  source state itself changed
  -> projection crossed Trait threshold
```

例:

```text
新人捕手
 -> 実はBlocking skill already high
 -> game evidence accumulates
 -> ブロッキング表示
```

はRecognition。

```text
Coach instruction
 -> repetitions
 -> blocking mechanics actually improve
 -> ブロッキング表示
```

はDevelopment。

---

# 21. Trait Loss / Downgrade / Gold Tier

Traitを直接削除するのではなくSource Stateを再評価する。

```text
aging / injury / disuse / role change / new evidence / technique loss
 -> source state changes
 -> Trait projection changes
```

Goldは同一FamilyのMaster Tier。

例:

```text
ノビ G ... A -> 怪童
クイック G ... A -> 走者釘付
盗塁 G ... A -> 電光石火
```

AとGoldを同時適用しない。

---

# 22. Development History & Provenance

重要なCareer developmentはEvent Logへ残す。

```ts
type DevelopmentEventRecord = {
  eventId: EventId;
  playerId: PlayerId;
  occurredAt: SeasonTime;
  kind:
    | "CATALYST"
    | "HYPOTHESIS_FORMED"
    | "CONSOLIDATION_PROGRESS"
    | "SOURCE_STATE_CHANGED"
    | "TRAIT_RECOGNIZED"
    | "TRAIT_CHANGED"
    | "MAJOR_BREAKTHROUGH";
  sourceEventIds: readonly EventId[];
  profileVersion: string;
  traitDefinitionVersion?: string;
};
```

すべてのTraining repを永久保存する必要はない。Long-saveではepisode aggregate / checkpointを許可する。

Major AwakeningはCareer Historyへ保存してよいが、Replay以前の能力を書き換えない。

---

# 23. Determinism / RNG Boundary

- Career development RNGはMatch Physics RNGと分離。
- 同じCareer state / event history / development seed / profile versionなら同じDevelopment transitionを再現可能にする。
- Match結果がCatalystになる場合、そのMatch結果自体は既にCanonical Eventとして確定後にDevelopment Systemへ渡す。
- Development SystemがMatch outcomeを後から書き換えない。
- Trait acquisition RNGがPitch / Contact / Fielding RNGへ混入しない。

---

# 24. User / CPU Information Boundary

Hidden:
- exact maturity timing
- exact curve shape
- catalyst sensitivities
- signature motifs
- true future potential
- breakthrough hazard

User / CPUが使える:
- age
- current observed ability
- playing / training evidence
- Coach / Scout estimates
- visible role / health / performance
- actual Career History

Userは:
- 起用
- Assignment
- Priority Development
- Coach / Staff
- role
- training emphasis where supported

等を選べるが、「覚醒Triggerを踏みに行く」専用Buttonを持たない。

CPUもHidden Triggerを読まない。

---

# 25. Simple Surface

通常UI例:

```text
山田 太郎  20歳  SS
☆548

所属        二軍
将来期待    A?
出場機会    多
育成環境    A
状態        順調

[一軍昇格]
[重点育成]
[詳細]
```

成長曲線 `超晩成` やCatalyst triggerを直接表示しない。

大きなBreakthroughが定着し、Career Eventとして意味がある場合だけNews / Historyで:

```text
山田が今季、大きな成長を遂げている
``

等を表示可能。

内部の`覚醒率`ゲージは作らない。

---

# 26. Star / Superstar Boundary

覚醒しても自動Star / Superstarにはならない。

```text
breakthrough
 -> actual player state improves
 -> future Career evidence may improve
 -> Star / Superstar rules evaluate actual Career
```

52のStar Genesis Profile / candidate tendencyは別責務。

覚醒がStar候補でないPlayerをStar-levelへ押し上げることはあり得る。
ただしSuperstar Statusは51/52のCareer / high-stage / rarity条件を別途満たす必要がある。

---

# 27. Acceptance Tests

1. 同じTrajectory ProfileでもOpportunity / Coaching / Health差でCareerが大きく分岐する。
2. 高校 / 大学 / 社会人Labelだけを変えても直接成長率は変わらない。
3. 超早熟でも後年Technical breakthroughが起こり得る。
4. 超晩成でもOpportunityを失えば大成しない。
5. 3者連続三振がまぐれだけで終わるCareerが多数存在する。
6. 同Eventが一部PlayerにのみCatalystとなる。
7. Catalyst発生だけではTrait / abilityが上がらない。
8. Trainingを大量に回してもMajor Awakeningが頻発しない。
9. Injuryは平均的にCostであり、覚醒狙いのbeneficial strategyにならない。
10. Injury-RehabからRare role/technical breakthroughは発生可能。
11. Star加入だけで若手全員が成長しない。
12. International tournament参加だけで成長率が上がらない。
13. 一度のWalk-off HRだけでサヨナラ男を取得しない。
14. repeated high-leverage responseがSource Stateを変えた場合のみPressure Familyが変化する。
15. Coachに教わっただけでTechnique Traitが付かず、actual source state improvementを要求する。
16. Green TraitはManager命令一回で永久変更されない。
17. Recognition型Traitは表示だけ変わり、Match Core stateは変わらない。
18. Development型TraitはSource State変化が先に存在する。
19. Gold TierとA Tierを同時適用しない。
20. **ノビはG〜A、Gold怪童であり、ノビ○をCanonical tierとして生成しない。**
21. Awakening labelを削除しても同じsource stateならMatch結果は変わらない。
22. User / CPUはHidden Catalyst Profileを利用してDecisionしない。
23. Development RNG seed変更だけで過去Canonical Match Eventが変わらない。
24. Major Breakthrough HistoryからCatalyst -> learning -> consolidationを説明できる。

---

# 28. Final v1 Decisions

1. Development Timingは `超早熟 / 早熟 / 普通 / 晩成 / 超晩成` の5種類。
2. Curve Shapeは `SHARP_PEAK / BROAD_PLATEAU / STEPWISE_WAVES` の3種類。
3. 5 x 3 = 15 Development Trajectory Templateをv1採用。
4. Peak AgeはHard Gateではなくoverlapping prior。
5. CurveはDevelopment Receptivity / decline pressureを主に表し、直接能力加算しない。
6. Domainごとのtiming offsetを許可する。
7. Hidden DevelopmentCatalystProfileをPerson生成時から持てる。
8. Catalystは実際のWorld Eventからのみ発生する。
9. Surprise success / failure / injury / coach / mentor / Star exposure / role / major stage等をCatalystにできる。
10. BreakthroughはAppraisal -> Hypothesis -> Repetition -> Consolidation -> Source State changeを要求する。
11. `覚醒` はRare Derived Career Eventであり能力Buff Flagではない。
12. High-frequency per-repetition awakening rollは禁止。
13. Injury自体へのpositive bonusは禁止。Rehab reconstructionをRare Catalystとして扱う。
14. Trait AcquisitionはFamilyごとのAcquisition Profileを持つ。
15. Pressure Traitはrepeated experience / stable responseを要求し、one-result unlockを禁止。
16. Technique Traitはactual technical source changeを要求する。
17. Green Traitはstable Behavior / Preference changeを要求する。
18. RecognitionとDevelopmentを分離する。
19. Gold Tierは同一FamilyのMaster Tier。
20. **ノビはG〜A、Goldは怪童。**
21. Awakening / Trait / Rating表示はSource Stateへ逆流しない。
22. Exact curve coefficients / probabilities / thresholds / cooldownはimplementation calibration。

---

# 29. Final Status

**Player Development Trajectory & Breakthrough Architecture v1は2026-09-22にユーザー承認され、敵対監査PASS後にDESIGN FROZEN。**