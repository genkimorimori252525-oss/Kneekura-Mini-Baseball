# League Ecology and Cross-League Adaptation Design

更新日: 2026-09-17
状態: 設計承認済み。実装前。

## 1. 目的

Mini Baseball / 将来の Natural Baseball において、MLB、NPB、KBOなど各リーグの特徴を「リーグ固有の能力補正」として直接与えず、選手層、育成、対戦経験、球場、使用球、戦術、審判傾向などの積み重ねから自然発生させる。

恒久原則:

```text
League Identity != direct gameplay modifier

League Identity =
  player population
+ player development
+ scouting / roster selection
+ tactical tendencies
+ accumulated exposure / familiarity
+ stadium distribution
+ ball / environment
+ rules / umpire environment
+ history
```

したがって、以下のような処理を禁止する。

```text
MLB batter -> high fastball penalty -10
NPB batter -> splitter penalty -10
KBO batter -> power bonus +15
league strength 75 -> all ratings x 0.75
```

リーグを移籍しただけで選手の真能力や物理法則を直接変更してはならない。

---

## 2. 世界共通の選手能力

選手能力はリーグ別に分けない。

例:

```text
Pitch Recognition
  - velocity recognition
  - vertical movement recognition
  - horizontal movement recognition
  - release / spin cue recognition
  - timing prediction
  - zone prediction

Swing / Contact
  - bat speed
  - swing path control
  - contact precision
  - adjustment ability
  - power transfer
```

同じ選手がどのリーグへ移っても、基礎の真能力は原則同じである。

リーグ移籍で変化するのは、対戦相手、物理環境、経験の偏り、戦術、学習履歴、役割期待などである。

---

## 3. Exposure / Familiarity

### 3.1 経験はリーグラベルではなく実際の対戦履歴から蓄積する

打者・投手・走者・守備選手は、実際に遭遇した刺激への経験量を保持できる。

概念例:

```ts
type PitchExposureProfile = {
  velocityBands: ExposureDistribution;
  verticalBreakBands: ExposureDistribution;
  horizontalBreakBands: ExposureDistribution;
  releaseHeightBands: ExposureDistribution;
  releaseSideBands: ExposureDistribution;
  pitchShapeClusters: ExposureDistribution;
  locationClusters: ExposureDistribution;
};
```

リーグ名そのものは入力にしない。

例えば元MLB打者が高めの高品質速球を大量に経験していたなら、その球へのFamiliarityは高くなり得る。

逆に、同じ元MLB打者でも特定タイプへの対戦経験が少なければ、その球種・軌道へ苦戦し得る。

したがって、

```text
former MLB player -> high fastball weakness
```

のような固定ルールは禁止する。

### 3.2 Familiarityの作用先

Familiarityは打率や長打率を直接補正しない。

主に以下の中間量へ作用させる。

- pitch recognition latency
- trajectory prediction error
- swing timing prediction
- expected movement model
- recognition confidence
- adjustment speed after repeated exposure

例:

```text
unfamiliar high fastball
      ↓
slower / less accurate recognition
      ↓
late or mislocated swing
      ↓
contact point changes
      ↓
physical contact quality changes
```

結果は通常の因果的Bat-Ball Contact Coreから発生する。

---

## 4. 適応

リーグ移籍後に選手は固定された弱点を持ち続けるとは限らない。

```text
new league exposure
      ↓
observations accumulate
      ↓
familiarity / predictive model updates
      ↓
adaptation
```

適応速度は、経験、学習能力、認識能力、年齢、コーチング、出場量などから決められる。

「移籍直後に苦戦したが、数か月後に対応した」を再現できるようにする。

適応は万能ではない。基礎能力が足りなければ、慣れても対応し切れないことがある。

---

## 5. League Ecology

リーグそのものは、選手能力へ直接補正するのではなく、選手と環境の分布を持つ。

概念構造:

```text
LeagueEcologyProfile
  - pitcher population distribution
  - batter population distribution
  - defender population distribution
  - development tendencies
  - scouting / roster selection tendencies
  - tactical tendencies
  - stadium distribution
  - ball / environment profile
  - umpire / zone environment
  - competition / roster rules
```

### 5.1 Pitcher population

集計候補:

- fastball velocity distribution
- pitch-shape distribution
- spin / movement distribution
- command distribution
- release distributions
- pitch-mix distribution
- elite-pitch frequency

これらはリーグ内に実際に所属する投手たちから集計することを優先する。

### 5.2 Batter population

集計候補:

- bat-speed distribution
- recognition distribution
- power distribution
- swing-path distribution
- contact precision distribution
- exposure / familiarity distribution

### 5.3 Environment

- StadiumProfile distribution
- altitude / climate
- wind tendencies
- surface
- official ball profile
- RuleProfile
- UmpireProfile population

環境は必要に応じて正史物理へ入力される。

---

## 6. League Culture

「パワーバッターが評価される」「バントを多用する」などの文化は試合中の直接バフにしない。

文化は主に外側の選択へ作用する。

```text
league / organization preference
      ↓
scouting
player acquisition
roster selection
playing time
coaching / development
strategy
      ↓
population changes over seasons
      ↓
observed league style changes
```

例:

```text
power is highly valued
      ↓
power hitters are selected / developed more often
      ↓
more power hitters receive playing time
      ↓
league HR environment changes
```

これにより、リーグ文化は長期的に自己強化・変化し得る。

---

## 7. League Strength

単一の `leagueStrength` を選手能力への倍率として使わない。

リーグレベルは、所属選手と環境の集計結果として観測される。

```text
same batter
  + weaker opposing pitchers
  + weaker defense
  + favorable stadium distribution
      ↓
very strong statistics

same batter
  + elite opposing pitchers
  + better defense
  + different park / ball environment
      ↓
lower statistics
```

したがって、あるリーグで100本塁打級の成績を残した打者が、より強い投手・守備・環境のリーグで大幅に成績を落とすことは可能である。

ただし、その低下はリーグ名による直接デバフではなく、実際に対戦する相手と環境から発生しなければならない。

真に世界最高水準の打者なら、強いリーグへ移ってもリーグ名だけを理由に極端に能力を失わない。

---

## 8. Cross-League Transfer

移籍時に保持するもの:

- true player abilities
- career exposure / familiarity
- learned predictive models
- psychological / personality traits
- physical condition / age state
- historical experience

移籍時に変わるもの:

- opponent population
- pitch-shape frequencies
- tactical environment
- stadium / ball / surface environment
- umpire environment
- role / coaching / roster context

移籍直後は、旧リーグで形成された経験分布がそのまま残る。

これにより、

```text
old league familiar pitch -> immediately comfortable
new league common pitch   -> initial struggle
```

だけでなく、その逆も自然発生する。

---

## 9. 新しい弱点の発生

リーグ全体の弱点は固定定義せず、その時代の選手人口と経験分布から観測する。

例:

```text
few elite splitters in league
      ↓
low population exposure to elite splitters
      ↓
new elite splitter enters league
      ↓
many hitters initially struggle
      ↓
exposure / coaching accumulate
      ↓
league adaptation improves
```

投手側も打者の適応へ反応してpitch mixや配球を変え得る。

この相互作用によってリーグ環境は時間とともに進化する。

---

## 10. Observed League Profile

UI、スカウティング、分析用途では、リーグの現在特徴を集計して表示してよい。

```ts
type LeagueObservedProfile = {
  runEnvironment: DistributionSummary;
  pitchEnvironment: PitchEnvironmentSummary;
  batterEnvironment: BatterEnvironmentSummary;
  defenseEnvironment: DefenseEnvironmentSummary;
  parkEnvironment: ParkEnvironmentSummary;
  tacticalEnvironment: TacticalEnvironmentSummary;
};
```

これは原因ではなく観測結果である。

```text
League Ecology
      ↓
actual games
      ↓
statistics / observations
      ↓
LeagueObservedProfile
```

`LeagueObservedProfile` を試合結果へ直接フィードバックして補正ループを作らない。

---

## 11. Match Coreとの境界

```text
Career / League World
      ↓
League Ecology
      ↓
players + learned exposure + environment
      ↓
Match Inputs
      ↓
Shared Match Core
      ↓
Canonical Physical / Rule Results
```

Match Coreは「MLB」「NPB」「KBO」という名前を見て能力補正を掛けない。

Coreが読むのは具体的な選手能力、経験状態、球場、ボール、ルール、審判、戦術、試合状態である。

---

## 12. 決定論

League Ecologyを導入しても同一season state / player state / match input / seed / Core versionなら同一試合結果を再現できなければならない。

- exposure更新は正史イベントから決定論的に行う
- season progressionの乱数streamをMatch Physicsと分離する
- roster / development乱数が試合中のphysics RNGへ波及しない
- league aggregationは試合結果を後付け補正しない

---

## 13. テスト方針

- 同一選手を異なるリーグ名へ置くだけでは能力・物理結果が変わらない
- 相手投手populationだけを変えると、対戦内容の差から成績差が発生する
- StadiumProfileだけを変えると、物理差から成績が変化する
- unfamiliar pitch exposureを変えると、recognition / timing中間量が主に変化する
- Familiarityだけを変更してpowerやbat speedそのものが変化しない
- 同じ選手が新環境へ継続出場すると、定義された学習範囲で適応する
- 元MLB/元NPB等のリーグ履歴ラベルだけでは直接ボーナス・ペナルティが発生しない
- LeagueObservedProfileを変更しても、それが原因としてMatch Coreへ直接作用しない
- league culture変更は短期の能力補正ではなく、長期の選手獲得・育成・起用分布へ作用する

---

## 14. 今回確定した事項

- リーグ固有の直接能力補正を禁止する
- 世界共通の真能力を使用する
- リーグ移籍で真能力を自動倍率変更しない
- Exposure / Familiarityは実際の対戦履歴から蓄積する
- Familiarityは成績を直接補正せず、認識・予測・タイミング等の中間量へ作用する
- リーグ特徴はLeague Ecologyから自然発生させる
- League Cultureはスカウト、育成、起用、戦術等を通じて長期的に人口分布へ作用する
- League Strengthを単一倍率として使わない
- LeagueObservedProfileは結果の集計であり原因ではない
- Cross-League Transferでは能力と経験履歴を保持し、相手・環境だけが変わる
- リーグ全体の弱点は時代・選手人口・経験分布から観測され、固定定義しない
- Mini / Naturalは同じLeague Ecology入力とShared Match Coreを利用する

## 15. 後続実装で校正する事項

- Exposureの表現粒度
- Familiarityの減衰・保持期間
- 適応速度と年齢・経験・コーチングの関係
- pitch-shape clustering方式
- league population集計周期
- development / scouting preferenceモデル
- park / ball / climateデータの出典
- 実在リーグの年度別ObservedProfileの生成方法
