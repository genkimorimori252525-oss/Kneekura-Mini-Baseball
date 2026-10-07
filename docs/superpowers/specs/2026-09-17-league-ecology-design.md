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
+ slow cultural priors
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
  - slow LeagueCultureState
  - current LeagueTacticalTrend
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

## 6. League Culture と Tactical Trend

「パワーバッターが評価される」「バントを多用する」「フォーク系を決め球として好む」などの文化は試合中の直接バフにしない。

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

### 6.1 LeagueCultureState: 長期文化層

文化は短期成績では簡単に変えない。数年から数十年単位で残る、強い慣性を持つ prior として扱う。

概念例:

```ts
type LeagueCultureState = {
  pitchDevelopmentPreferences: PreferenceDistribution;
  hitterDevelopmentPreferences: PreferenceDistribution;
  scoutingPreferences: PreferenceDistribution;
  tacticalPriors: PreferenceDistribution;
  coachingTraditions: CoachingTraditionState;
  institutionalInertia: number;
};
```

文化層が影響するのは、主に以下である。

- どの球種・投球スタイルを若手へ教えやすいか
- どのタイプの選手を高く評価しやすいか
- どの能力をドラフト・補強で重視しやすいか
- どの戦術を初期候補として採用しやすいか
- 成功した元選手・指導者の考えが次世代へ継承される度合い

文化そのものを「フォーク+10」「高め速球-10」の試合補正へ変換してはならない。

### 6.2 LeagueTacticalTrend: 短中期の流行層

その時代に有効と観測された戦術は、文化より速く変化できる。

例:

```text
league hitters currently struggle with high fastballs
      ↓
pitchers / teams observe the exploit
      ↓
high-fastball usage increases
      ↓
hitters accumulate exposure and counter-adjust
```

`LeagueTacticalTrend` は概ねシーズン内から数年単位の適応を表す。

概念例:

```ts
type LeagueTacticalTrend = {
  observedExploits: readonly TacticalExploit[];
  pitchUsageTrends: TrendDistribution;
  offensiveTrends: TrendDistribution;
  defensiveTrends: TrendDistribution;
  confidence: number;
  observedAt: SeasonTime;
};
```

TrendはMatch Coreへの直接能力補正ではない。チーム・選手AIが戦術候補を選ぶ際の情報・priorとして使う。

### 6.3 文化と流行を混同しない

短期的な成功だけでLeagueCultureStateを書き換えない。

```text
one elite pitcher succeeds with high fastball
      ↓
Tactical Trend may move quickly
      ↓
Culture remains mostly unchanged
```

文化が本当に変化するには、複数年にわたる持続的成功や、複数球団への普及、育成・スカウト・コーチングへの浸透などを必要とする。

概念フロー:

```text
repeated multi-season success
+ adoption across organizations
+ player-development adoption
+ coaching turnover / diffusion
      ↓
slow cultural update
```

### 6.4 文化にはヒステリシスと自己保存性を持たせる

文化層は単純な移動平均ではなく、履歴依存性を持つ。

```text
successful local tradition
      ↓
players copy it
      ↓
coaches teach it
      ↓
scouts value it
      ↓
more players of that type enter the league
      ↓
tradition reinforces itself
```

この自己強化により、リーグらしい特徴が長期間残り得る。

一方で、文化を永久固定もしない。十分に大きく長い外力があればゆっくり変化できる。

### 6.5 珍しい戦術のライフサイクル

リーグ内で珍しい球種・配球・打撃戦術が成功した場合は、次の順序を基本とする。

```text
rare tactic enters league
      ↓
low familiarity -> initial advantage
      ↓
opponents identify the pattern
      ↓
tactical adoption / countermeasures spread
      ↓
familiarity increases
      ↓
only robust advantages remain
      ↓
if success persists for years, culture may slowly absorb it
```

これにより「珍しいから効く」「流行する」「対策される」「それでも強いものだけ文化に残る」を因果的に再現する。

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

### 8.1 対外大会・国際大会では公開リーグ評価を再基準化しない

リーグへ移籍せず、一時的に別Competitionへ参加するだけでは、選手の `LEAGUE_RELATIVE` 公開評価の基準リーグを変更しない。

対象例:

- 地域別クラブ大会
- 大陸クラブ大会
- 国際クラブ大会
- 代表戦
- WBSC系国際大会
- WBC級の世界大会

概念:

```text
player affiliation league
        ↓
RatingContextLeagueId
        ↓
public LEAGUE_RELATIVE ratings

temporary Competition participation
        ↓
does NOT replace RatingContextLeagueId
```

例えば台湾国内リーグ所属選手が、その所属リーグ基準である能力をSと評価されているなら、代表招集されて世界大会へ出場しても、その表示はSのままとする。

大会参加によって、

```text
Taiwan league S
  -> international tournament C
```

のような自動再査定は行わない。

国際大会でより強い相手へ苦戦した場合、その差は以下から実際の試合結果として現れる。

- opponent true ability
- actual pitch / batted-ball physics
- Exposure / Familiarity
- Stadium / ball / environment
- RuleProfile / umpire environment
- Condition / fatigue
- Pressure / ActiveEmotion
- tactical matchup

つまり、国際大会そのものを「世界基準能力値への変換装置」にしない。

### 8.2 公開評価の所属文脈はCompetitionではなくAffiliationに紐づく

公開リーグ相対評価の基準は、原則として選手の現在の所属リーグに紐づける。

概念候補:

```ts
type PlayerRatingContext = {
  affiliationLeagueId: LeagueId;
  ratingContextLeagueId: LeagueId;
};
```

通常は:

```text
ratingContextLeagueId = affiliationLeagueId
```

とする。

代表招集や短期大会登録はAffiliationを変更しないため、RatingContextも変わらない。

一方、実際の移籍により所属リーグが変わった場合は、新しいリーグをRatingContextへ切り替える。

ただし既存設計どおり、移籍直後の新リーグ評価はKnowledge / Fitの観測不足を持ち得る。

```text
permanent / registered transfer
      ↓
affiliation league changes
      ↓
rating context changes
      ↓
new-league projection may begin with uncertainty
      ↓
evidence accumulates
      ↓
confidence increases
```

したがって「現実を見る」のは対外大会へ出た瞬間ではなく、所属環境そのものを移した後である。

### 8.3 異なるリーグ尺度の選手が同一大会に共存してよい

代表チームや国際大会では、異なる所属リーグ基準の公開値を持つ選手が同じRosterに存在してよい。

例えば:

```text
Player A: Taiwan league Power S
Player B: NPB Power A
Player C: MLB Power B
```

これらの文字ランクは同一の世界絶対尺度ではないため、単純な大小比較を保証しない。

UIでは必要に応じて小さく評価文脈を示せる。

```text
Power S  [CPBL基準]
Power A  [NPB基準]
Power B  [MLB基準]
```

ただし大会参加中に一つの「世界共通G〜S」へ上書きしない。

世界比較が必要な分析画面では、別のScout Estimate、absolute metrics、または専用比較Projectionを表示してよいが、所属リーグ基準のHeadline Ratingを置換しない。

---

### 8.4 世界のリーグ層は Full 21 を基準とする

Competition設計へ進む前提として、初期世界の詳細シミュレーション対象リーグ数を **21 Full Leagues** とする。

これは「世界に21リーグしか存在しない」という意味ではない。

```text
World Baseball Ecosystem
  ├─ Full Simulation Leagues: 21
  │    ├─ full roster
  │    ├─ full player development
  │    ├─ full transfer market
  │    ├─ full League Ecology
  │    ├─ full history / records
  │    └─ continental club competition eligibility
  │
  ├─ Lightweight Regional Leagues
  │    ├─ simplified roster / results
  │    ├─ prospect generation
  │    ├─ national-team player pool
  │    └─ optional competition qualification
  │
  └─ National Baseball Pools
       ├─ no full domestic league simulation required
       └─ national-team / scouting candidate generation
```

初期地域配分の基準:

| Region | Full Leagues |
| --- | ---: |
| Asia | 5 |
| Americas | 6 |
| Europe | 7 |
| Africa | 1 |
| Oceania | 2 |
| **Total** | **21** |

具体的な21リーグ、初期球団数、開催時期、Culture Seed、Player Marketは `docs/game-design/10-world-league-catalog.md` を正とする。

### 8.5 冬季リーグも主所属リーグとして扱う

開催時期が冬であることを理由に、リーグを副次所属・短期所属・補助リーグ扱いしない。

```text
league season timing
  != affiliation priority
```

冬季開催リーグでも、選手がそのリーグへ登録されているなら、

```text
affiliationLeagueId = winterLeagueId
ratingContextLeagueId = winterLeagueId
```

とできる。

したがって、冬季リーグ所属選手も通常のFull League所属選手として以下を持つ。

- league-relative public ratings
- club affiliation
- season statistics
- player development
- transfer history
- League Ecology / Culture / Tactical Trend
- continental club competition eligibility

「夏リーグが本所属で、冬季リーグは自動的に副所属」という特別ルールは設けない。

同一選手が別リーグへ移る場合は、季節に関係なく通常のTransfer / Loan / Temporary Registration等の別制度として明示的に扱う。

初期設計では複雑さを避けるため、Full League所属は原則1つのprimary affiliationを持つ。

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

ただし短期の弱点発見はまず `LeagueTacticalTrend` へ作用し、LeagueCultureStateは十分な持続性と普及が確認されるまで大きく変更しない。

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
  cultureSummary: CultureSummary;
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
  ├─ slow culture
  └─ tactical trend
      ↓
players + learned exposure + environment + tactical priors
      ↓
Match Inputs
      ↓
Shared Match Core
      ↓
Canonical Physical / Rule Results
```

Match Coreは「MLB」「NPB」「KBO」という名前を見て能力補正を掛けない。

Coreが読むのは具体的な選手能力、経験状態、球場、ボール、ルール、審判、戦術、試合状態である。

文化やTrendは、試合中の物理値を直接書き換えず、外側で育成・獲得・戦術候補・事前方針へ作用する。

---

## 12. 決定論

League Ecologyを導入しても同一season state / player state / match input / seed / Core versionなら同一試合結果を再現できなければならない。

- exposure更新は正史イベントから決定論的に行う
- season progressionの乱数streamをMatch Physicsと分離する
- roster / development乱数が試合中のphysics RNGへ波及しない
- league aggregationは試合結果を後付け補正しない
- culture / trend更新はseason stateの明示的な更新として行い、試合途中に暗黙変更しない

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
- Tactical Trendは短期の戦術候補・usageを変え得るが、true abilityを直接変えない
- 1シーズンの極端な成功だけではLeagueCultureStateが急変しない
- 複数年の成功・複数球団採用・育成浸透が揃うと、定義された遅い速度でCultureが変化し得る
- Culture変更は短期の能力補正ではなく、長期の選手獲得・育成・起用・戦術priorへ作用する
- 同じculture stateと同じseason inputsなら、culture/trendの更新結果を再現できる
- 同じ選手を代表戦・国際大会へ登録しただけではLEAGUE_RELATIVE公開値が変化しない
- 同じ代表Roster内で異なるratingContextLeagueIdを持つ選手が共存できる
- CompetitionProfileを変えてもplayer affiliationが同じならRatingContextは変化しない
- 冬季開催という理由だけでaffiliationLeagueIdが別リーグへ置換されない
- Full League所属選手は原則一つのprimary affiliationを持つ

---

## 14. 今回確定した事項

- リーグ固有の直接能力補正を禁止する
- 世界共通の真能力を使用する
- リーグ移籍で真能力を自動倍率変更しない
- Exposure / Familiarityは実際の対戦履歴から蓄積する
- Familiarityは成績を直接補正せず、認識・予測・タイミング等の中間量へ作用する
- リーグ特徴はLeague Ecologyから自然発生させる
- League Cultureはスカウト、育成、起用、戦術等を通じて長期的に人口分布へ作用する
- LeagueCultureStateは数年〜数十年単位の強い慣性を持つ長期層とする
- LeagueTacticalTrendはシーズン内〜数年単位で動ける短中期層とする
- 短期の成功だけで文化を上書きしない
- 文化変化には持続的成功、複数組織への普及、育成・コーチングへの浸透を要求する
- 文化にはヒステリシスと自己保存性を持たせる
- 珍しい戦術は、初期優位→流行→対策→定着/衰退というライフサイクルを持ち得る
- League Strengthを単一倍率として使わない
- LeagueObservedProfileは結果の集計であり原因ではない
- Cross-League Transferでは能力と経験履歴を保持し、相手・環境だけが変わる
- 代表戦・国際大会・大陸大会等への一時参加では所属リーグ基準の公開Ratingを再基準化しない
- RatingContextはCompetitionではなくAffiliationへ紐づける
- 異なる所属リーグ尺度の選手が同一国際大会Rosterへ共存することを許す
- 初期世界のFull Simulation Leagueは21を基準とする
- 冬季リーグも開催時期に関係なく主所属リーグになり得る
- リーグ全体の弱点は時代・選手人口・経験分布から観測され、固定定義しない
- Mini / Naturalは同じLeague Ecology入力とShared Match Coreを利用する

## 15. 後続実装で校正する事項

- Exposureの表現粒度
- Familiarityの減衰・保持期間
- 適応速度と年齢・経験・コーチングの関係
- pitch-shape clustering方式
- league population集計周期
- Culture update cadence / inertia係数
- Tactical Trendの観測窓と減衰速度
- 文化変化に必要な普及率・持続年数の具体値
- coaching lineage / tradition伝播モデル
- development / scouting preferenceモデル
- park / ball / climateデータの出典
- 実在リーグの年度別ObservedProfileの生成方法
