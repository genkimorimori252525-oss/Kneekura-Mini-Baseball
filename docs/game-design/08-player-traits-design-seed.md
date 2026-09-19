# 特殊能力 / Trait System 設計計画

更新日: 2026-09-20  
状態: **特殊能力システムMaster Plan。Player Trait部分は設計承認済み。Team Traitは設計中。Team Mood / Manager Ability / Popularityは後続設計。実装前。**  
目的: Mini Baseballの「得能」系UIを、Player / Team / Manager / Careerの複数source-of-truthへ安全に接続するMaster Plan。Player Traitカタログは `09-player-trait-catalog.md`、Team Trait設計は `34-team-traits-and-relationship-network-DRAFT.md`、Team Traitカタログは `35-team-trait-catalog-DRAFT.md` を参照する。


## 0. 2026-09-20 Master Plan Expansion

従来この文書はPlayer Traitのみを対象としていたが、設計範囲を「特殊能力システム全体」へ拡張する。

UI上は得能として並ぶ場合があっても、内部では以下を分離する。

```text
SPECIAL ABILITY PRESENTATION
        │
        ├─ Player Traits
        │    └─ 個人の技能 / 特性 / 行動 / Context
        │
        ├─ Team Traits
        │    └─ 集団関係 / 共有経験 / 連携 / 一時Team State
        │
        ├─ Team Mood
        │    └─ チーム全体の心理・雰囲気
        │
        ├─ Manager Ability
        │    └─ 監督本人の判断・戦術・人心掌握・運用能力
        │
        └─ Popularity / Reputation
             └─ Career / Fan / Media / Presentation
```

**得能UIが共通でも、source of truthを共通化しない。**

---

### 0.1 Current Design Order

2026-09-20時点の設計順:

1. Player Traits — 基本設計 / Catalog完了
2. Team Traits + Player Relationship — 設計中
3. Team Mood — 基本設計承認済み
4. Manager Ability / Philosophy — 設計中
5. Popularity / Reputation — 設計開始

---

### 0.2 Team Trait Color Contract

Team TraitはPlayer Traitより絞り、UI色は:

- **Blue**: 有利な一時Team Trait
- **Red**: 不利な一時Team Trait
- **Gold**: Blue Familyの最高Tier

を採用する。

Team TraitへGreen / Blue-Redを無理に持ち込まない。

Goldと同FamilyのBlueは二重適用しない。

---

### 0.3 Player Relationship Contract

Player間Relationshipは:

```text
好感 / Affinity
信頼 / Trust
連携 / Coordination
```

の3軸へ分離する。

- 好感: 親しさ / positive emotional contagion
- 信頼: 相手への期待 / 判断を任せる感覚
- 連携: 共同作業のshared timing / procedure familiarity

特に:

```text
bad relationship
 -> batting rating debuff
```

は禁止。

打撃では好感 / 信頼をpositive-sideの共鳴へ使う。
守備等の共同作業では信頼 / 連携の低さが実際のcoordination errorへつながり得る。

---

### 0.4 Team Trait Scope

Team Traitは必ずしもTeam全員へ作用しない。

候補scope:

```text
TEAM_ALL
BATTING_UNIT
PITCHING_UNIT
DEFENSE_UNIT
PAIR
CLUSTER
CONTEXTUAL_ELIGIBLE
```

ON砲型の共鳴はPAIR / CLUSTER。
守備連携はDEFENSE_UNIT。
逆境オーラはTEAM_ALL / CONTEXTUAL_ELIGIBLE。

---

### 0.5 Batting Resonance Rule

仲間の成功内容をコピーしない。

```text
teammate success
+ strong affinity / trust
        ↓
positive emotional stimulus
        ↓
receiver's own offensive profile determines expression
```

Power hitterならPower系共鳴、Contact hitterならContact系共鳴へ翻訳する。

Relationが本来ない能力を作ってはいけない。

---

### 0.6 Temporary Team State

Team Traitは原則恒久ではない。

```text
EVIDENCE
 -> CANDIDATE
 -> ACTIVE
 -> FADING
 -> EXPIRED
```

Pennant中に付与 / 消失できる。

Historical Club IdentityとTeam Traitを混同しない。

---

## 1. この文書の位置づけ

本設計は、パワプロ系の「特殊能力」という分かりやすい表現を参考にしつつ、Kneekura Mini Baseball の因果的シミュレーションへ再解釈して導入するための承認済み設計原則である。

これは現時点の実装仕様ではない。

特に以下は未設計または設計途上である。

- ペナント / Career World
- 選手成長・衰退
- トレーニング
- シーズン間更新
- 選手獲得・移籍
- 対戦履歴と長期学習
- 得能の獲得・消失・昇格条件
- 得能間の具体的な作用量・優先度
- Trait獲得・消失の具体的な統計閾値

したがって、先に得能システムを完成させて後からペナントへ押し込むのではなく、将来これらを設計するときに本書の要求を入力として扱う。

## 2. 承認済みの基本分類

UI上の基本分類:

- **金**: 青系の上位段階。青と同時に二重適用しない。
- **青**: 有利な技術・特性・状況適性。
- **赤**: 不利な技術・特性・状況適性。
- **青赤**: 恩恵と代償が不可分な特性。
- **緑**: 強振多用、ミート多用、速球中心、変化球中心など、能力上昇ではなく選択傾向・思考傾向を表す。

この「色」は主にプレイヤー向けの意味分類であり、内部実装上の発動方式とは分離する。

内部Mechanism候補:

- Descriptor / Capability: 細かな内部能力・物理量・再現性を、人間が理解しやすい言葉へ圧縮表示する。原則として追加Buffを持たない
- Context: カウント、走者、回、点差、代打など局面依存
- Technique: 引っ張り、流し、低球、高球など特定技術依存
- PhysicalStyle: 球質、打球生成、送球など身体動作依存
- Behavior: 打撃・投球・走塁・守備の選択傾向
- Tradeoff: 利得と代償が同時に発生
- Relationship: 特定球団、特定選手、特定対戦条件との関係
- Derived: 元能力、学習状態、実績などから表示される称号・要約。追加補正を持たないもの

内部Mechanismの細分は後続実装設計で変更可能だが、UI色分類と因果・二重計上禁止の原則は本設計を正とする。

## 3. 恒久原則候補: 得能は結果を直接作らない

既存Coreと同じく、得能は原則として試合結果を後付けで変更しない。

避けたい例:

```text
チャンス○ -> 打率 + .050
アーチスト -> 本塁打率 + 20%
守備職人 -> アウト率 + 15%
```

優先する考え方:

```text
Trait
  + Context
  + Player Intent
  + Base / Hidden Ratings
        ↓
意味のある中間量が変化
        ↓
通常の因果シミュレーション
        ↓
結果として成績差が生じる
```

作用先の例:

- pitch recognition latency
- swing decision timing
- contact precision
- bat path control
- power transfer
- launch tendency
- release reproducibility
- command variance
- pitch selection prior
- reaction / replanning timing
- transfer time
- throwing error
- steal / extra-base decision threshold

ただし全得能を無理に数値補正へ変換する必要はない。

**物理的・技能的・心理的・学習的な原因を説明できない「謎の能力Buff」は禁止する。**
Trait名そのものを原因として結果を良化・悪化させず、必ず正史状態、内部能力、行動傾向、学習状態、Contextのいずれかへ因果的に接続する。

## 4. 発動条件は因果関係を要求する

各得能は「持っているだけで常時総合能力を上げる」構造を避ける。

例:

```text
強振系の長打Trait
  -> POWER_SWING を実際に選択した場合のみ候補
  -> ミート打ちでは発動しない

流し打ちTrait
  -> opposite-field intent / 対応する打撃動作が存在するときのみ候補

初球Trait
  -> 打席の初球のみ

満塁Trait
  -> bases loaded のときのみ
```

空振り、見逃し、バントなど、得能と因果的に接続しない行動では発動させない。

将来の設計では全Traitについて最低限以下を定義する。

```text
activation condition
affected subsystem
affected intermediate variables
non-applicable conditions
stacking / exclusion rule
evidence source
```

## 5. Descriptor Trait: 細かな能力を人間向けに圧縮表示する

特殊能力には、試合中に新たなBuffを発生させるものだけでなく、細かな内部能力・物理量・再現性をユーザーへ分かりやすく伝えるUI的役割を持たせる。

代表候補:

- ノビ / 怪童: ストレートの回転、軌道、速度維持、リリース特性等の要約
- キレ / 驚異の切れ味: 変化球の変化開始、軌道品質、再現性等の要約
- ナチュラルシュート / 真っスラ: ストレートに恒常的に存在する横変化の要約
- 球速安定: 球速分散・再現性の要約
- 球持ち / ディレイドアーム: release / extension / visibility等の要約
- リリース: 直球と変化球のフォーム差・release差の小ささの要約
- クイック / 牽制: 該当動作を行う際の恒常的技能の要約
- 送球 / レーザー系: 送球速度、精度、transfer、軌道等の要約
- 走塁 / 盗塁: スタート、判断、加速、スライディング等の技能群の要約
- ラインドライブ、広角、プル系: swing path / contact point / launch tendency等の打撃特性の要約

概念:

```text
Internal physical / skill state
  -> actual simulation behavior
  -> human-readable projection
  -> Trait display
```

例:

```text
spin / movement / release characteristics
  -> 実際のストレート軌道
  -> 「ノビA」と表示
```

この場合、

```text
ノビAを持っている
  -> さらにストレート性能を上げる
```

という再加算は禁止する。

得能が既存の公開能力・隠し能力をもう一度加算するだけにならないよう、将来的に各Traitへ `sourceOfTruth` を持たせる案を採用候補とする。

候補:

- `RATING_DERIVED`: 内部能力・物理量の表示
- `FAMILIARITY_DERIVED`: 学習・対戦経験状態の表示
- `CONTEXT_EFFECT`: 特定Contextでのみ意味のある中間量へ作用
- `BEHAVIOR`: 意思決定傾向へ作用
- `CONDITION_DERIVED`: 一時状態の要約
- `RELATIONSHIP_DERIVED`: 相手との学習・相性状態の要約

一つの現象に複数システムが同じ補正を重ねない。

```text
underlying ability -> Trait label -> same ability buff
```

という循環を禁止する。

### 5.1 Progressive Baseball Disclosure: 表面は簡潔、奥は深く

本作の選手情報は、内部情報量を減らすのではなく、**必要な人だけが段階的に深く掘れる構造**を目指す。

固定レイアウトや画面デザインは本書で決めない。ここで決めるのは情報の階層と、表示が正史データへどう接続されるべきかだけである。

概念:

```text
Canonical / Career Player State
        ↓
Presentation Projection
        ├─ Level 1: 一目で理解できる主要能力・主要Trait
        ├─ Level 2: 球種図、得意領域、行動傾向など視覚的要約
        ├─ Level 3: 根拠となる詳細能力・代表値・分布
        └─ Level 4: 対戦履歴、時系列、条件別分析、Evidence
```

ユーザーは深い数値を見る**権利**を持てるが、通常プレイのために深い数値を見る**義務**を負わない。

重要原則:

- Level 1だけでも選手像を理解して運用できる。
- 深い階層へ進むほど、上位表示の根拠が確認できる。
- 上位表示と詳細データは同じsource of truthから導出し、互いに矛盾させない。
- 詳細画面を見たことで新しい能力Buffが発生することはない。
- 情報量を隠すためではなく、人間が理解できる密度へ圧縮するためにTrait・段階評価・図を使う。

### 5.2 Visualizationも正史データから導出する

変化球方向・変化量、打球傾向、送球傾向などを図示する場合も、図そのものをゲーム内能力の原因にしない。

例:

```text
actual pitch trajectory / movement distribution
        ↓
projection / quantization
        ↓
human-readable pitch movement diagram
```

「変化量4だから実軌道を4相当にする」のではなく、**実際の軌道を解析した結果としてUI上の変化量4相当へ要約する**方向を原則とする。

同様に、

```text
actual swing / contact distribution
  -> spray / launch summary

actual throwing behavior
  -> arm / accuracy / laser-style summary

actual baserunning behavior
  -> steal / running descriptor
```

のように、UI表現はSimulation / Career stateのprojection（投影・要約）とする。

### 5.3 Presentation Projection Contract候補

将来、Traitや能力表示ごとに最低限以下を説明できるようにする。

```text
display id
source of truth
projection inputs
projection method / version
scope
time basis
confidence / uncertainty policy
drill-down source
```

これにより、同じ内部状態から「能力ランク」「Trait」「図」「詳細統計」が別々のロジックで矛盾することを防ぐ。

## 6. 金特は青特の上位Tier候補

金と対応する青が存在する場合は、同一TraitFamilyの異なるTierとして扱う案を優先する。

```text
TraitFamily: clutch_hitting

BLUE
  -> standard level

GOLD
  -> master level
```

金を持つ選手へ青と金を同時適用しない。

```text
effectiveTier = GOLD
```

表示も原則として最高Tierのみとする。

ただし、すべての金特が必ず青特と一対一対応するかは未確定。

## 7. 青赤特は不可分のTradeoff

青赤Traitは、メリットだけ・デメリットだけを別々に発動できない一つの特性として扱う。

例:

```text
球威 / movement quality ↑
command variance ↑
```

または

```text
aggressive swing decision ↑
zone discipline ↓
```

同じTraitEffectの一部として適用し、都合の良い側だけを取得する処理を禁止する。

具体的な青赤Trait一覧とバランスは未確定。

## 8. 緑特は意思決定層へ接続する

緑Traitは原則として基礎能力を変更しない。

例:

```text
強振多用
  -> POWER_SWING candidate weight ↑

ミート多用
  -> CONTACT_SWING candidate weight ↑

速球中心
  -> fastball-family pitch selection prior ↑

変化球中心
  -> breaking / off-speed selection prior ↑

積極走塁
  -> extra-base attempt threshold ↓

慎重盗塁
  -> steal attempt threshold ↑
```

したがって、強振多用を持っているだけでPowerが上昇することはない。

監督指示、チーム戦術、本人のTraitを別入力として保持し、監督が強振を命じたことと本人が強振多用であることを混同しない。

### 監督指示との衝突

監督指示は緑Traitを上書きしない。

```text
player tendency
+ manager instruction
+ tactical understanding
+ trust / compliance
+ personality
+ game context
      ↓
final decision
```

したがって、本人が「強振多用」で監督がミート重視を指示しても、強振多用Trait自体は消えない。選手によっては監督指示を優先し、別の選手は自分の判断を優先し得る。

命令に従わないこと自体を一回で「ムード×」へ変換しない。反復する独断、チームメイトとの摩擦、監督との信頼低下、集団への実際の悪影響などが蓄積した場合に、将来のRelationship / Team Chemistry設計から「ムード×」相当のDescriptorまたはBehavior Traitが成立する余地を残す。

逆に、独断が常に悪いとも固定しない。高い状況判断や経験に基づく自主判断が結果的に正しい場合も表現できるようにする。

## 9. Relationship Trait / ○○キラー

球団ごとに固定IDを大量定義するのではなく、対象をパラメータ化する。

概念例:

```ts
type RelationshipTrait = {
  traitId: 'team_killer';
  targetTeamId: string;
};
```

UIは対象チーム名を解決して「○○キラー」と表示できる。

### 暫定採用判断: キラーは追加Buffではなく学習・相性状態の要約とする

```text
actual matchup history
  -> Familiarity / learned predictive model / matchup adaptation
  -> 対象への実際の認識・判断・タイミング等が改善
  -> 十分なEvidenceが揃う
  -> 「○○キラー」と表示
```

「対戦実績が良かったのでキラーを取得し、そのTraitが未来の能力をさらに上げる」という自己強化ループは採用しない。

キラー表示の原因候補:

- 対象球団の投手・打者群へのFamiliarity
- pitch / swing / tactical patternへの学習
- 特定タイプへの適応
- 球場・環境経験
- 個別matchupの蓄積

キラーは主に `RELATIONSHIP_DERIVED` として扱い、Trait名自体から追加の魔法的補正を出さない。

将来的には同じ仕組みを、特定選手、投球タイプ、打撃タイプ等へ一般化できる。ただしどの粒度までUIへ公開するかは未確定。

チーム改称・再編時に表示名だけで関係を追跡しない。Career設計では永続的なidentityを持たせ、単なる改称と完全な新組織を区別できる構造を要求する。

## 10. Career / Pennant設計へ要求する情報

得能の長期変化を可能にするため、将来のCareer / Pennant側では少なくとも以下を検討する。

- シーズン・試合・打席・投球・守備プレー単位の正史Evidence
- opponent team / player identity
- sample size
- opportunity / role
- age / physical development
- injury history
- training / coaching
- position / role changes
- exposure / familiarity
- repeated action tendencies
- season boundaries
- transfers and team identity history
- rule / league / environment context

重要なのは、Career側が単純な累積成績しか保存しない設計を先に確定しないこと。

将来Trait獲得を設計するとき、生のイベント全保存が必要とは限らないが、少なくともTrait Evidenceを再計算・更新できる十分な履歴または集約状態を残す必要がある。

## 11. Trait Evidence の候補概念

得能獲得を実装するときは、いきなり「打率.350以上で取得」のような単一閾値へ固定しない。

概念候補:

```ts
type TraitEvidenceState = {
  traitFamilyId: string;
  opportunities: number;
  evidenceStrength: number;
  uncertainty: number;
  persistence: number;
  lastUpdatedAt: SeasonTime;
};
```

考慮候補:

- 機会数
- 本人の通常期待値との差
- 相手の質
- 球場・環境
- 複数年の持続
- 最近性
- 技術そのものの変化
- 偶然の短期成績

ただし具体式・閾値は未確定。

## 12. 獲得・消失・昇格は未設計

将来候補:

```text
latent tendency / skill
      ↓
evidence accumulation
      ↓
blue Trait
      ↓
further stable mastery
      ↓
gold Trait
```

また、

- 加齢
- 故障
- フォーム変更
- 長期間の不使用
- 技術改善
- 役割変更

などによりTraitが変化または消失する可能性も残す。

しかし、Traitが技能そのものなのか、技能を表すラベルなのかによって更新方式は異なるため、現時点では一律ルールを作らない。

## 13. Trait Resolver候補

得能ロジックをPitch / Batting / Fieldingなどへ個別に散らさない。

将来の境界候補:

```text
Player Match State
+ Match Context
+ Current Intent / Action
+ Trait Definitions
        ↓
Trait Resolver
        ↓
Active Trait Effects / Decision Biases
        ↓
各Simulation Subsystem
```

Resolverは最低限、以下を説明可能にする。

- どのTraitが評価されたか
- 発動したか
- 発動しなかった理由
- どの中間量へ作用したか
- どのTraitと排他だったか
- どのTierが採用されたか

Activation Traceをデバッグ可能にする案を強く推奨する。

## 14. Determinism

Trait Systemを導入しても、同じPlayer/Career state、Match input、seed、Core versionなら同じ結果を再現可能にする。

- Trait acquisition用乱数をMatch Physics RNGへ混ぜない
- Career progression更新を明示的なseason state transitionとして扱う
- 表示Traitが物理へ暗黙フィードバックしない
- Trait Definition versionを将来的に保存できる余地を残す
- Activationは正史Contextから決定できるようにする

## 15. 暫定採用した設計判断（2026-09-19）

以下は承認済みの設計判断である。具体的な式・閾値・保存形式は後続実装設計で詰める。

### 15.1 得能取得は「成長」と「観測」を分ける

得能取得を一種類のイベントとして扱わない。

- **Recognition型**: 既に存在する内部能力・球質・行動傾向等が、十分なEvidenceによってUI上で認識・表示される
- **Development型**: 練習、経験、身体変化、フォーム変更等によって原因側の内部能力そのものが変化し、その結果Trait条件を満たす

例:

```text
release / spin characteristics が徐々に改善
  -> actual fastball behavior changes
  -> descriptor threshold / classification changes
  -> 「ノビ○」が表示される
```

Traitを取得した瞬間に原因不明の能力上昇を発生させない。

### 15.2 二重計上は source of truth で防ぐ

公開能力、隠し能力、Familiarity、Condition、Emotion、Traitのどれが現象の原因なのかを明示する。

Descriptor Traitは原因状態を再加算しない。

Condition / ActiveEmotionが一時的に能力発揮へ影響する場合も、その結果を同じTraitでさらに増幅しない。

### 15.3 Trait競合は単純な排他表だけにしない

競合を最低限以下へ分ける。

1. **Family competition**: 青と金など同一系列のTier競合。最高有効Tierのみ採用
2. **Physical incompatibility**: 物理・動作上同時成立しない状態
3. **Double-count prevention**: 同一原因を複数Traitが再加算することの禁止

別々の原因・作用先を持つTraitは、条件を同時に満たせば共存可能とする。

### 15.4 監督指示と本人傾向は独立入力

監督指示で緑Traitを消去・上書きしない。

選手の本人傾向、監督指示、戦術理解、監督への信頼、遵守傾向、性格、Contextから最終意思決定を生成する。

独断が繰り返され、実際にチーム関係へ悪影響を及ぼした場合は、将来のTeam Chemistry / Relationship Evidenceを通じて「ムード×」相当へつながり得る。ただし一回の命令無視に対する自動罰として付与しない。

### 15.5 加齢・怪我・フォーム変更は原因側を更新する

Traitを直接削除することを基本動作にしない。

```text
aging / injury / form change
  -> physical / technical / reproducibility state changes
  -> actual simulation behavior changes
  -> Trait再評価
```

移籍だけでは身体技能Traitを自動変更しない。Relationship / Familiarityは対戦環境の変化に応じて別途更新する。

### 15.6 Replayは当時の原因状態を固定する

現在のPlayerProfileから過去試合のTraitを再計算して試合結果を作り直さない。

Match開始時またはPlayCapsuleに、再現に必要な当時の状態を固定する。

候補:

- base / hidden ratings
- physical / technical state
- Familiarity / Relationship state
- Condition
- behavior tendencies
- Trait definition / descriptor version
- 必要に応じて当時のdisplay Trait IDs

正史結果の原因は保存された内部状態とCanonical Eventsであり、表示Traitそのものではない。

### 15.7 架空選手・新人は能力からTraitを導出する

```text
player generation
  -> body / technique / cognition / behavior parameters
  -> actual abilities and tendencies
  -> Trait projection
```

「20%でノビ○」のようにTraitを先に抽選して能力を後付けしない。

新人・未知選手については、真のTrait相当状態が存在していても、スカウトや監督がまだ観測できていないためUIでは未判明という状態を許容する。

### 15.8 ○○キラーはRelationship状態の要約

本書9章の方針を採用する。

キラーTrait自体を未来成績への追加Buffにせず、実際のFamiliarity / learned model / matchup adaptation等が原因となり、その状態を人間向けに要約表示する。

### 15.9 選手情報は段階的開示を採用する

UIの具体的な見た目・配置は別設計へ委譲するが、情報設計として以下を暫定採用する。

- 最上位では主要能力・主要Trait・視覚的要約だけで選手像を理解できるようにする
- ユーザーが望めば、その表示の根拠となる内部データや履歴へ段階的に掘り下げられる
- 能力ランク、Trait、球種図等は同一の内部状態から導出する
- 図やランクは正史能力の入力ではなく、正史状態のhuman-readable projectionとする
- 表示に使うprojectionルールは将来version管理できる構造にする

特に変化球図などは、内部の実軌道・分布を簡略化して見せる役割とし、図上の段階値を先に決めて物理を合わせる方式を原則禁止する。

### 15.10 公開能力ランクはリーグ文脈を持つ

公開ランク（A/B/C等）は、世界共通の絶対尺度に固定せず、所属・対象リーグの競技レベルや選手分布を反映できる相対的なPresentation Projectionとする方向を採用する。

同じ内部能力値でも、異なるリーグでは公開ランクが変わり得る。

ただし、内部の真能力・物理量そのものをリーグ名で変更してはならない。

```text
true ability / physical state
        ↓
league-specific comparison context
        ↓
public rating projection
```

具体的にどの分布・統計・基準値を使ってランクへ投影するかは未確定とする。

### 15.11 変化球図は「どれくらい曲がるか」を主表示とする

変化球図の主要責務は、球種ごとの代表的な変化方向と変化量を直感的に示すこととする。

球種名が軌道タイプの大まかな違いを説明し、必要な追加特徴はDescriptor Traitや詳細データで補う。

```text
actual pitch movement
  -> representative direction / amount
  -> simple movement diagram
```

過度に細かな軌道特性を一枚の図へ詰め込まず、詳細を知りたいユーザーだけが下位階層へ進める設計を優先する。

変化量の厳密な物理定義（総変位、gravity-relative movement等）は後続のPitch Physics設計と合わせて確定する。

### 15.12 Descriptor表示は恒常能力を表し、試合当日の調子とは分離する

ノビ、球持ち、送球等のDescriptor Traitや公開能力ランクは、原則として恒常的な能力・技能状態を表す。

試合単位の一時変動によって毎試合Traitやランクを書き換えない。

当日の発揮状態は別の `Condition / Form` レイヤーで管理する。

初期案:

```text
Condition = 1..5
1 = very good
2 = good
3 = normal
4 = poor
5 = very poor
```

UIでは細かな「球質↓」等を並べるのではなく、簡潔な調子マーク等で表現できる。

調子安定 / 調子極端 / 春男 / 夏男 / 秋男等のTraitは、Conditionの発生傾向・季節性・振幅等へ作用する候補とし、Trait自体が直接打率や球速を上げる設計にはしない。

### 15.13 公開済み選手能力は原則として正直に見せる

既知の一軍選手・対戦相手等の通常選手情報は、ゲーム上の盛り上がりと比較可能性を重視し、原則としてユーザーへ正直に表示する方向を採用する。

「相手選手だから能力を意図的に隠す」ことを通常ルールにはしない。

ただしScouting対象は別扱いとする。

新人、無名選手、海外候補、未知リーグ選手等については、真能力とScout Estimateを分離し、スカウト能力・情報量・観測履歴によって推定精度が変化し得る設計を残す。

```text
true ability
  -> observable evidence
  -> scout skill / coverage / uncertainty
  -> estimated player profile
```

優秀なスカウトほど、表面的な成績や評判に引きずられず、未知の実力者を発見しやすい構造を目指す。

### 15.14 Trait / 公開能力の再評価は月次を基本候補とする

Descriptor Trait、公開能力ランク、主要なProjection表示は、細かな内部値変動へ即時追従させず、原則として月1回程度の評価更新を基本候補とする。

目的:

- 境界値付近でA/BやTrait有無が頻繁に揺れることを防ぐ
- ユーザーに「評価が更新された」という自然な時間感覚を与える
- 大量選手のProjection再計算コストを抑える
- 日々の調子変動と恒常能力変化を分離する

ただし、重大な怪我、明確なフォーム変更、ポジション転向等の大きな状態変化では臨時再評価を許容する余地を残す。

月次評価の具体的なタイミング、対象リーグ、オフシーズン処理はCareer設計で確定する。

### 15.15 Trait数は「少なさ」自体を目的にしない

Traitを増やしすぎて選手画面を読めなくすることは避けるが、単純化しすぎて選手差が説明不能になることも避ける。

採用基準候補:

- 既存公開能力だけでは説明しづらい独立した特徴がある
- シミュレーション上の実在する内部差へ対応する
- ユーザーが選手像を理解する助けになる
- 既存Traitとの意味重複が過大でない
- 深い内部数値を見る必要を減らす価値がある

Trait数の固定上限を先に決めず、情報密度と意味の独立性を優先する。

### 15.16 数値データは必要なら深い階層で閲覧可能にする

月次の公開能力・Trait・図を基本表示としつつ、ユーザーが望む場合は根拠となる具体的な数値・履歴へアクセスできる設計を維持する。

数値を見た結果の解釈は必要以上に自動化せず、ユーザー自身が「この投手は最近変化量が落ちている」「この打者は特定条件で強い」等を考えられる余地を残す。

### 15.17 UI上はTraitカラーを主分類として見せる

ユーザー向けの通常UIでは、金・青・赤・青赤・緑のカラー分類を主に見せる。

Descriptor / Context / Behavior / Relationship等の内部Mechanism分類は、通常画面でユーザーへ意識させる必須情報にはしない。

目的は、内部構造の正確さを保ちつつ、表面上の認知負荷を下げること。

必要であれば詳細説明画面や開発・分析モードでMechanismを参照可能にする余地は残す。

### 15.18 リーグ相対評価は扱いやすい絞り込みを前提にする

リーグ相対評価は一つの巨大な母集団だけで比較せず、ユーザーが扱いやすい単位へ絞り込める構造を採用する。

候補:

- 一軍 / 二軍
- 守備位置
- 投手役割: 先発 / 中継ぎ / 抑え
- 必要に応じてリーグ / チーム / 年代

UI側ではタブやフィルタ等で自然に切り替えられることを期待するが、具体的なデザインは別設計へ委譲する。

内部の真能力は変えず、どの比較母集団を使って公開ランクを投影したかを保持できる構造にする。

### 15.19 移籍後の相対評価は新環境での観測により明らかにする

リーグ移籍直後に、旧リーグの公開ランクを新リーグ尺度へ即時完全換算しない。

```text
transfer
  -> true abilityは保持
  -> new league play / observation accumulates
  -> public projection confidence increases
  -> 新リーグ文脈での評価が明らかになる
```

これにより、「前リーグでは強打者評価だったが、新リーグでは実際にプレーすると相対的に非力だった」等を、リーグ名による直接デバフではなく、相手・環境・観測結果から表現する。

通常の既知選手情報を意図的に隠す方針とはしないが、移籍直後の新リーグ相対評価については観測不足を持ち得る。

### 15.20 変化球図の変化量は“実際にどれだけ曲がったか”を基本とする

変化球図の主要な矢印は、リリース時の進行方向をそのまま延長した基準軌道に対し、ホームプレート到達時の実際の投球位置がどれだけズレたかを基本量とする案を採用する。

```text
release position + release direction
        ↓
straight reference trajectory
        ↓
actual pitch trajectory
        ↓
plate-plane displacement
        ↓
arrow direction / magnitude
```

この指標は「打者から見てどれくらい曲がったか」を直感的に示すためのPresentation値であり、内部物理の原因分解そのものではない。

より深い階層では必要に応じて、

- gravity-relative movement
- spin-induced movement
- seam / aerodynamic contribution
- velocity dependence
- release position
- trajectory variance

等を別情報として表示できる。

月次の恒常能力表示では、原則としてCondition=normal相当の代表Pitch Profileから図を導出し、当日の調子で矢印表示を毎試合変えない。

厳密な基準軌道、測定面、単位、量子化方式はPitch Physics設計時に確定する。

### 15.21 Conditionは“発揮しやすい能力”へ作用し、恒常適性とは分離する

Condition 1〜5は、練習量、疲労、身体状態、当日の感覚等で現実的に変化しやすい能力発揮へ主に作用させる。

候補:

- batting power expression
- contact execution
- bat speed / timing reproducibility
- pitching velocity expression
- pitch movement expression
- command reproducibility
- fielding movement / transfer reproducibility

一方、以下のような比較的恒常的・長期的な適性や傾向は、通常のConditionで直接上下させない方向を採用する。

- チャンスへの強さ
- ピンチへの強さ
- 長期的な性格・判断傾向
- Relationship / Familiarityの蓄積
- 生得的または長期形成されたContext耐性

ただし、これらもActiveEmotionや怪我等の別システムから影響を受け得るため、「絶対に変動しない能力」とは定義しない。

### 15.22 Scout能力は内部的に分解し、UIは簡潔にする

Scoutingは一つの万能値に固定せず、内部では複数軸へ分解できる構造を採用する方向とする。

候補:

- 発掘力
- 評価力
- 地域知識
- ポジション / 役割知識
- 情報更新速度
- サンプル評価力

ただしスカウト自身のUIは、選手情報画面ほど複雑にしない。

ユーザー向けには、

```text
発掘力 A
評価力 B
地域知識 C
...
```

程度の分かりやすい要約を優先し、必要以上にスカウト管理へ注意を奪わない。

### 15.23 Trait説明はクリック等で簡潔に理解できるようにする

特殊能力名だけでは意味が分からない場合に備え、Traitを選択すると平易な説明を表示できる情報契約を持たせる。

例:

```text
アーチスト
強振時に高品質な長打性打球を生みやすい打撃特性。
詳細を見る -> 根拠データ / 関連能力
```

最上位の説明は専門用語を避け、ユーザーが「この選手は何が得意なのか」を理解できることを優先する。

必要なユーザーだけが、さらに内部能力・Evidence・時系列へ掘り下げられる。

### 15.24 長期履歴は価値が高いため保持を目標とする

長期ペナントでは、選手能力、Trait、成績、投球・打球傾向等の履歴を後から振り返れること自体を重要なゲーム価値とみなす。

300年規模の長期進行でも、履歴保持が試合進行やUI応答の大きな性能低下を引き起こさないことを理想目標とする。

ただし、具体的な保存方式、圧縮、集約、階層化、オンデマンド展開方式は現時点では保留する。

### 15.25 公開表示は一律のリーグ相対尺度にしない

0〜100 / G〜S等の見た目を共有していても、すべての表示項目を同じ意味の尺度へ押し込まない。

表示項目ごとに `ProjectionKind` を持たせ、何に対して評価された数字・段階なのかを明示できる設計を採用する。

候補:

```text
LEAGUE_RELATIVE
  -> 所属リーグ水準に対する能力評価

ABSOLUTE_PHYSICAL
  -> km/h、実変化量等の物理的絶対値または絶対値からの簡略表示

SUITABILITY
  -> 守備位置・投手役割など、本人と役割の適合性

BEHAVIOR / DESCRIPTOR
  -> 行動傾向・内部特徴の人間向け要約

STATE
  -> Condition、怪我、疲労等の現在状態

KNOWLEDGE_ESTIMATE
  -> Scout / Coach等が持つ推定値と不確実性

HISTORICAL
  -> 成績・実績・履歴という事実
```

同じA評価でも、ProjectionKindが異なれば意味は異なる。

### 15.26 守備位置適性はリーグレベルから独立させる

守備位置適性は、その選手が特定ポジションの要求動作・判断・経験へどれだけ適合しているかを表す。

例:

- 捕手適性
- 一塁適性
- 二塁適性
- 三塁適性
- 遊撃適性
- 左翼 / 中堅 / 右翼適性

これらはリーグ平均との比較ではなく、本人とポジション要求との適合性として評価する。

```text
same player
  + same experience / technique
  + different league
        ↓
position suitability itself remains the same
```

ただし、そのポジションで実際にどこまで通用するかは別問題である。

例:

```text
SS suitability = A
but
range / arm / reaction are below new league standard
        ↓
「遊撃として自然に動けるが、そのリーグでは守備能力が足りない」
```

を表現できるようにする。

適性は能力の代用品にしない。

### 15.27 投手役割適性もリーグレベルから独立させる

先発 / 中継ぎ / 抑え適性は、本人がその役割をどれだけ自然にこなせるかを表すRole Suitabilityとする。

候補となる内部要因:

- 絶対スタミナ / 疲労耐性をその役割でどう使えるか
- 登板準備・ルーティンへの適応
- 登板間隔に対する運用適合性
- 短時間でのウォームアップ適性
- 短い登板で出力を高める特性
- 球種構成の深さ
- 左右・打順巡回への対応
- 高レバレッジ状況への長期的耐性
- 連投への適性
- 登板準備の再現性

```text
role suitability
!=
league-relative pitching strength
```

例えば、

```text
先発適性 A
投手能力 C
```

は成立してよい。

これは「先発としての使い方は合っているが、そのリーグでは投手能力自体は平均以下」を意味する。

逆に、

```text
投手能力 A
先発適性 D
中継ぎ適性 A
```

のような選手も成立できる。

役割適性を理由に謎の能力Buffを加えず、原因となる疲労・回復・球種構成・準備特性等から実際の試合挙動を発生させる。

### 15.28 リーグ相対評価から除外する候補

現時点で、次の情報はリーグ相対Projectionへ入れない方向を優先する。

- 守備位置適性
- 先発 / 中継ぎ / 抑え適性
- 投打左右
- 守備位置登録
- 球種の存在そのもの
- 投球フォーム / 打撃フォームの種類
- 球速のkm/h表示
- 変化球の0〜10表示
- 身長 / 体重 / 年齢
- Condition
- 怪我状態
- 緑Trait等の行動傾向
- Relationship Traitの対象
- Career成績・実績

これらは、リーグ比較よりも「本人の事実・状態・適合性」を示す。

一方で、ミート、パワー、守備力、制球等の公開総合能力はリーグ文脈を持つProjection候補とする。肩力・走力・球速・スタミナ等、物理量や身体性能へ直接接続できる能力はABSOLUTE_PHYSICALとして扱う。

ただし各能力について本当にリーグ相対にすべきかは、能力カタログ設計時に個別レビューする。

### 15.29 内部0〜10000はユーザー向け表示にしない

0〜10000の内部指数は、システムが高精度に能力状態を扱うための中間表現とし、通常UIや深掘りUIでも原則として直接表示しない。

ユーザーが詳細を掘った先では、可能な限り現実の野球として意味のある値を示す。

例:

```text
Power internal index 7348
```

ではなく、

- bat speed
- average / max exit velocity
- launch distribution
- power transfer characteristics
- pull / opposite-field output
- condition-independent baseline

等を表示する。

```text
real baseball data
  -> internal model / index
  -> public 0..100 projection
```

という双方向の説明可能性を持たせるが、内部指数そのものをゲーム上の「真実の数値」としてユーザーへ強制しない。

### 15.30 絶対身体能力は物理量・実測可能量を基準にする

リーグ相対評価へ入れない絶対身体能力は、可能な限り物理的・実測可能な量をsource of truthとする。

例:

- 球速: km/h
- 送球能力: 送球初速、到達時間、距離維持、軌道
- 変化量: 実軌道から導出した変位
- 走力: 加速、最高速度、区間タイム
- 身体サイズ: 身長、体重等
- ジャンプ / 到達能力: 実到達高・移動性能
- 投球 / 送球回転: spin rate / axis等

公開UIで0〜100やG〜Sへ簡略化する場合も、リーグ平均との差ではなく、これらの絶対的な物理量・身体性能から投影する。

```text
physical / measurable state
        ↓
absolute capability projection
        ↓
human-readable rating
```

このProjectionはリーグ移籍だけでは変化しない。

例えば肩力が同じ物理性能なら、NPBから別リーグへ移籍しても肩力表示そのものは維持される。

一方、同じ肩力でも、そのリーグでどれほど相対的に優れているかはランキング・比較画面で別途示せる。

絶対能力とリーグ相対評価を一つの数字へ混ぜない。

### 15.31 スタミナは絶対身体能力、疲労は状態として分離する

スタミナはリーグ相対評価ではなく、選手本人が持つ絶対的なWork Capacity（仕事量を維持できる身体能力）として扱う。

スタミナのsource of truth候補:

- 一定品質を維持できる投球量 / 運動量
- 出力低下が始まるまでの持続力
- 疲労蓄積速度
- 疲労下での身体出力維持
- 回復能力と組み合わせた連戦耐性

一方、`CurrentFatigue` は能力ではなく、その時点の状態とする。

```text
Stamina / FatigueResistance / RecoveryCapacity
+ workload
+ rest interval
+ injury / condition
        ↓
CurrentFatigue
        ↓
effective velocity / movement / command / execution quality
```

リーグや大会の試合数・移動・登板間隔が厳しくても、スタミナ表示そのものをリーグ尺度で再評価しない。

代わりに、要求されるWorkloadが大きい環境では、低スタミナ・低回復の選手ほど `CurrentFatigue` を蓄積しやすく、本調子を維持しにくくする。

```text
same player
same absolute stamina
      ↓
lighter schedule -> fatigueを回復しやすい
heavier schedule -> fatigueが残りやすい
```

したがって、別リーグへ移籍しただけでスタミナBがSになるような表示変更は行わない。

リーグ環境が作るのは「能力値の換算」ではなく、その能力に対する要求水準と実際の疲労結果である。

### 15.32 スタミナ・疲労耐性・回復力を一つへ潰しすぎない

公開UIでは「スタミナ」の一項目へ分かりやすく要約してもよいが、内部では少なくとも以下を分離できる余地を残す。

- `WorkCapacity`: 一度の登板・試合でどれだけ出力を維持できるか
- `FatigueResistance`: 負荷に対してどれだけ疲労が蓄積しにくいか
- `RecoveryCapacity`: 試合後・登板後にどれだけ早く戻るか
- `CurrentFatigue`: 現在どれだけ疲れているかというState

これにより、

- 一試合では長く投げられるが回復が遅い
- 一度の登板は短いが連投には強い
- スタミナは高いが、疲労時に制球だけ先に崩れる

といった差を表現できる。

「回復」系Traitは `RecoveryCapacity` の人間向けDescriptor候補とし、Trait名から直接疲労を消す魔法的処理にはしない。

### 15.33 役割適性は絶対身体能力を変更せず、発揮の適合性へ作用する

先発 / 中継ぎ / 抑え適性が低い役割で起用されても、スタミナ、球速上限、身体出力等の絶対能力そのものを書き換えない。

役割不適合による差は、例えば以下へ現れ得る。

- ウォームアップ / 登板準備の再現性
- 立ち上がりのrelease再現性
- pitch mixの使い方
- 長い打順巡回への対応
- 短時間最大出力への適応
- 連投・待機ルーティンへの適応
- 疲労下での技術実行
- high-leverage状況でのDecision / Emotion反応

```text
absolute physical capability
        +
role suitability
        +
current fatigue / condition
        ↓
actual performance expression
```

したがって、役割適性が低いからスタミナ値を下げるのではなく、同じ身体能力をその役割でどれだけ安定して発揮できるかを変える。

### 15.34 Capability Projection と Observed League Fit を分離する

リーグ相対の公開能力値と、実際の新環境への適応度を同じ概念へ混ぜない。

- `CapabilityProjection`: 真の基礎能力を、そのリーグの能力分布へ照らして人間向けに換算した評価
- `ObservedLeagueFit`: 実戦、Exposure / Familiarity、環境適応、役割、観測サンプルを含めて「そのリーグで現在どれだけ力を発揮できているか」を表す観測・適応側の状態

```text
true capability
      ↓
CapabilityProjection
      ↓
league-relative public rating

true capability
+ exposure / familiarity
+ environment
+ role / usage
+ observed games
      ↓
ObservedLeagueFit / Estimate
```

CapabilityProjectionをMatch Coreへの能力補正として使わない。

移籍直後に「新リーグでどれだけ通用するか」が未知でも、真能力そのものは既に存在する。未知なのは主にKnowledge / Fit側である。

最終UIでどの値を主要0〜100として見せるかはPresentation設計で選べるが、内部データモデルでは両者を分離して保持できるようにする。

### 15.35 リーグ相対能力の尺度と一覧フィルタを分離する

一軍 / 二軍、守備位置、先発 / 中継ぎ / 抑え等は、原則として能力尺度そのものを変える母集団ではなく、一覧・ランキング・比較のフィルタとして扱う。

```text
same league rating scale
  ├─ all players
  ├─ first team
  ├─ farm / reserve
  ├─ catcher
  ├─ shortstop
  └─ starter / reliever / closer
```

これにより、昇格・降格・役割変更だけでパワー72が85になるような再スケールを避ける。

必要であれば「捕手内2位」「先発内上位10%」等を補助情報として表示する。

### 15.36 Condition / Fatigue / Stamina / Recovery は別原因として一度だけ作用させる

同じ原因を複数レイヤーから再加算しない。

- `Condition`: 当日の身体・技術の噛み合い、感覚、短期的な発揮状態
- `CurrentFatigue`: 累積負荷の結果として現在残っている疲労
- `WorkCapacity / Stamina`: 一度の活動で出力を維持する絶対身体能力
- `RecoveryCapacity`: 活動後に回復する絶対身体能力

禁止例:

```text
fatigue accumulates
  -> velocity decreases
  -> Condition also worsens only because of the same fatigue
  -> velocity decreases again
```

採用する考え方:

```text
independent causes
  -> distinct state updates
  -> composed once into effective execution
```

疲労がConditionへ影響する設計を将来採用する場合も、同じ原因を二重に性能へ掛けない因果グラフを要求する。

### 15.37 Suitability は汎用身体能力を再加算しない

守備位置適性・投手役割適性は、走力、肩力、スタミナ等の汎用能力をもう一度補正する値にしない。

Suitabilityの主対象は、その役割固有の習熟・判断・ルーティン・技術運用とする。

例:

- 遊撃適性: 遊撃固有の読み、足運び、ベースカバー、送球選択、併殺動作
- 捕手適性: 捕手固有の受球、ブロッキング、配球理解、投手連携
- 先発適性: ペース配分、打順巡回への対応、長い登板の組み立て
- 中継ぎ適性: 短い準備時間、登板時刻の不確実性、短時間出力への適応
- 抑え適性: 終盤ルーティン、高レバレッジ下の準備・意思決定

```text
generic physical ability
+ role-specific suitability
      ↓
actual execution
```

という構造にし、同じスタミナ不足を「スタミナ」と「先発適性」の両方で罰しない。

### 15.38 公開スタミナは一登板・一活動の持続力を主意味とする

公開UIの「スタミナ」は、主に一度の登板・試合で品質をどれだけ長く維持できるかを表す絶対身体能力として扱う。

回復速度は別の内部能力 `RecoveryCapacity` とし、必要に応じて「回復○」等のDescriptor Traitで要約する。

これにより、

- 一度は長く投げられるが回復が遅い
- 一度の登板は短いが連投には強い

を区別できる。

年間を通じた耐久性は、スタミナ・回復力・日程・起用・CurrentFatigueの相互作用から自然発生させる。

### 15.39 Presentation Projection Invariance を必須テストにする

UI用ProjectionはMatch Coreへ逆流してはならない。

以下のみを変更した比較実行で、同一true state・同一Match input・同一seedならCanonical Eventsと最終結果が完全一致することを要求する。

- 0〜100への換算式
- G〜S境界
- Trait表示名
- Trait色
- リーグ比較母集団
- 説明文
- 表示順
- UI上の変化量量子化

これはPresentation Projectionの安全柵として、将来のAcceptance Testへ追加する。

### 15.40 Trait Admission / Reject Gate を設ける

特殊能力カタログへ新Traitを追加する際は、「元ネタに存在する」「ゲームとして分かりやすい」だけでは採用しない。

最低限、以下を説明できることを要求する。

```text
real-world cause
  -> internal state / skill / behavior / context
  -> affected intermediate quantity
  -> observable baseball difference
  -> human-readable Trait
```

説明できない候補は、

- 不採用
- Descriptor Traitへ再解釈
- Behavior Traitへ再解釈
- Relationship / Contextへ移動
- 別の実在能力へ統合

のいずれかを選ぶ。

またRuleProfile依存性を確認し、ルール環境が変われば意味を失うTraitは自動Buffとして残さない。

### 15.41 変化量0〜10の厳密な基準軌道はPitch Physicsまで保留する

ユーザー向けには「どれくらい曲がるか」を0〜10で簡潔に示す方針を維持する。

ただし、厳密な基準軌道は現時点で固定しない。

比較候補:

- release directionをそのまま延長した幾何学的直線
- 同初速・同release条件でspin / aerodynamic movementを除いた基準球
- gravity-only reference trajectory

遅い球で単なる重力落下を過大に「変化」と数えないこと、フォーク等の直感的な「落ち」を損なわないことの両方を検証し、Pitch Physics設計時に決定する。

### 15.42 Relationship Trait は対象名ではなく構成Evidenceから生じる

「○○キラー」のUI表示は球団名等を使ってよいが、原因側を単一Team IDへ閉じ込めない。

原因Evidence候補:

- 実際に対戦した選手群
- pitch / swing shape clusters
- tactical patterns
- stadium / environment
- coaching / roster tendencies
- recent matchup history

ロースターや戦術が大きく変化すれば、過去のFamiliarityが自然に有効性を失うようにする。

Team identityは表示・履歴の対象であり、魔法的な相性Buffのsource of truthにはしない。

### 15.43 KnowledgeEstimate を共通境界として使う

新人、外国人、移籍直後、ドラフト候補、スカウト対象等で別々の「???システム」を作らず、TruthとKnowledgeを共通構造で分離する。

概念:

```ts
type KnowledgeEstimate<T> = {
  estimate: T;
  uncertainty: number;
  evidenceCount: number;
  observedAt: SeasonTime;
  source: KnowledgeSource;
};
```

用途:

- Scout Estimate
- Coach Estimate
- 移籍後の新リーグ評価
- 未知選手の能力推定
- 相手傾向のScoutingEstimate

「能力が低い」と「まだ分からない」を同じ低評価へ潰さない。

### 15.44 0〜10000指数もsource of truthではなく高精度Projectionとする

0〜10000は生成・保存・比較・補間に便利な高精度指数として利用してよいが、万能な真能力値としてMatch Physicsへ直接戻さない。

例:

```text
bat speed / swing path / power transfer / body state
        ↓
high-resolution ability index (0..10000)
        ↓
public projection (0..100 / G..S)
```

試合計算のsource of truthは、可能な限り原因となる物理・技能・認知・行動状態である。

0〜10000値を変更しただけで、対応する原因状態なしに物理結果が変化する設計は避ける。

### 15.45 Graded Trait Family はA〜Gの正負を色で表現する

A〜G段階を持つTraitは、「青Traitの中にA〜Gを並べる」のではなく、一つの連続Trait Familyとして扱う。

UI分類候補:

```text
A -> 青
B -> 青
C -> 通常
D -> 通常
E -> 通常
F -> 赤
G -> 赤
```

したがって、例えば `チャンスG` を青Trait欄へ表示しない。

これは以下のようなA〜G型Traitへ適用候補とする。

投手:
- 対ピンチ
- 対左打者
- 打たれ強さ
- ノビ
- クイック

野手:
- チャンス
- 対左投手
- キャッチャー
- 盗塁
- 走塁
- 送球
- ケガしにくさ
- 回復

ただし、UI上の段階が共通でもsource of truthは別でよい。

例:

- ノビ -> fastball physical / release descriptor
- クイック -> set position / release-time technique
- 回復 -> RecoveryCapacity
- チャンス -> pressure-context execution stability

### 15.46 赤Traitは二系統を許す

赤Traitは次の二系統を許可する。

1. Graded Trait Familyの負側
   - 例: チャンスF / G、送球F / G、対ピンチF / G
2. 名前付きNegative Trait
   - 例: 一発、軽い球、四球、抜け球、スロースターター、短気、乱調、三振、扇風機、併殺、ムード×等

名前付きNegative TraitもAdmission Gateを通し、原因不明の直接デバフは禁止する。

例:

```text
抜け球
  -> delivery / release failure tendency
  -> specific miss direction
  -> observable high-arm-side miss

短気
  -> appraisal
  -> anger / ActiveEmotion
  -> command reproducibility changes

乱調
  -> inning-transition reproducibility instability

三振 / 扇風機
  -> two-strike recognition / adjustment / contact weakness
```

一方、`負け運` のように現実的な原因が説明できないものは、そのままMatch Traitへ採用しない。
必要ならCareer Descriptor / historical labelへ再解釈する。

`ムード×` はチーム全員への直接デバフではなく、Relationship / Trust / Conflict / Team Chemistry等の実在状態の要約候補とする。

### 15.47 Trait UI色の最終基本構造候補

```text
金
  -> 卓越した上位Tier / master-level Trait

青
  -> Named Positive Trait
  -> Graded Trait A / B

通常
  -> Graded Trait C / D / E

赤
  -> Named Negative Trait
  -> Graded Trait F / G

青赤
  -> Benefit + Cost が不可分

緑
  -> Behavior / Preference / Decision tendency
```

内部Mechanism分類とUI色分類は引き続き別物とする。

### 15.48 設計シード完成条件

本設計シードは、次を満たした時点で探索段階を終了し、Trait / Rating設計の承認候補版とする。

1. 公開G〜S境界を確定
2. 投手Traitを最終カタログへ仕分け
3. 野手Traitを最終カタログへ仕分け
4. 各Traitを `採用 / 再解釈 / 統合 / 別システムへ移動 / 不採用` のいずれかへ分類
5. A〜G Graded Familyの表示規則を確定
6. 名前付きNegative Traitの因果的再解釈を確認
7. Trait Admission / Reject Gateを全候補へ適用
8. 最終敵対監査で重大な二重計上・Projection逆流・リーグ補正の誤用がないことを確認

ここまで完了したら、具体的な効果量・閾値・数式・保存最適化は後続実装設計へ委譲し、この文書自身は「計画完了」として扱える。

**2026-09-19 完了確認:** 09の最終カタログ確定と敵対監査PASSにより、上記1〜8を満たした。本08は計画完了・設計承認済みとする。

### 15.49 同一Trait Familyは排他的な単一状態とする

同じFamilyに属する赤 / 通常 / 青 / 金、A〜G / Gold段階、Named Negative Extreme、または排他的Behavior Variantは同時に有効化しない。

```text
TraitFamily
  -> one effective state only
```

例:

```text
盗塁A -> 電光石火
ノビA -> 怪童
対ピンチA -> 強心臓
送球A -> ストライク送球
```

Goldへ到達した場合、下位の青・A表示は消える。

これは単なるUI省略ではなく、内部効果の二重適用も禁止する。

```text
bad:
盗塁A effect + 電光石火 effect

good:
effectiveTier = GOLD
```

同様に、同一Family内でAとB、FとG、正側と負側、または速球中心 / 変化球中心のような反対Variantを同時保持しない。Familyは順序Tier型と排他的Variant型の両方を許す。

独立したFamily同士は共存可能である。

### 15.50 Pressure TraitはActiveEmotionと二重計上しない

チャンス、対ピンチ、要所等のPressure系Traitを、重要場面だから直接能力を上下させる別Buffとして扱わない。

心理由来の差は `05-psychology-emotion.md` のAppraisal / EmotionPressure / ActiveEmotionへ接続する。

```text
stable pressure-response state
+ MatchImportance
+ PersonalStake
+ RecentHistory
      ↓
Appraisal / EmotionPressure
      ↓
ActiveEmotion
      ↓
defined behavior / execution change
```

同じ精神安定性、経験、勝負欲等をPressure TraitとActiveEmotionの双方から再加算しない。

### 15.51 公開RatingとTraitのsource of truthを共有できる

同じ能力を公開RatingとTraitの両方で説明する場合、simulation上は一つのsource of truthしか持たない。

例:

- 盗塁能力 ↔ 盗塁A〜G / 電光石火
- 走塁能力 ↔ 走塁A〜G / 高速ベースラン
- バント能力 ↔ バント○ / バント職人
- 回復能力 ↔ 回復A〜G / ガソリンタンク
- 肩力 ↔ レーザービーム系Descriptor

複数のUI Projectionが存在しても、Match Coreへ複数能力として入力しない。

### 15.52 最終Traitカタログは09へ分離する

具体的なG〜S境界、A〜G Graded Family、投手・野手・捕手・Green・Blue-Red・Named Red候補の全仕分けは、以下の伴走文書へ分離する。

- `docs/game-design/09-player-trait-catalog.md`

08は設計原則と完成条件を保持し、09は具体カタログ、Family対応、最終設計判断を保持する。

09は設計承認済みで、最終敵対監査もPASS済み。本08も設計承認済みとする。

## 16. 将来設計で必ず再検討する問題

この節はTODOではなく、**設計開始時に捨ててはいけない論点一覧**である。

1. **解決済み:** 赤はGraded Familyの負側と独立Named Negativeの両方を許す。09参照。
2. **解決済み:** 対応する金 / 青 / 赤 / A〜Gは同一Familyの排他的状態とし、独立Familyのみ共存可能。09参照。
3. Derived Traitと実際に作用するTraitをUI上で区別するか。
4. Traitを公開情報にするか、スカウト推定対象を含めるか。
5. 新人・外国人・未知リーグ選手のTraitをどこまで観測できるか。
6. Recognition型とDevelopment型を、具体的なTraitカタログでどう分類するか。
7. 成績Evidenceを観測へ使う際、自己強化ループを起こさない具体的な統計設計。
8. ○○キラー表示のEvidence閾値、減衰、Relationship粒度をどう定義するか。
9. 特定選手キラー、球種キラー、球場適性などRelationship Traitをどこまで一般化するか。
10. **方向性確定:** 固定上限は設けず、独立した実在差だけをAdmission Gateで追加する。具体的UI密度は後続Presentation設計で調整。
11. **解決済み:** 同一Familyの相反状態は共存不可。別Familyなら因果的に両立する限り共存可能。09参照。
12. 青赤と緑が同じ行動へ作用するときの優先順位。
13. 監督指示・本人傾向・信頼・遵守傾向を最終Decisionへ統合する具体式。
14. 怪我・疲労・Condition・ActiveEmotionとの合成順序。
15. Exposure / Familiarityとの二重計上。
16. 公開能力・隠し能力との二重計上。
17. Traitの成長速度・減衰速度・忘却。
18. オフシーズンでの更新。
19. 移籍後のRelationship / Familiarityをどの速度で保持・減衰させるか。
20. 球団消滅・改称・再編時の永続identity設計。
21. 架空リーグ生成時の内部能力・Trait投影・未知状態の生成方式。
22. CPU選手とプレイヤー管理選手で同じ更新則を使えるか。
23. 自動試合と描画試合で完全に同じTrait処理を使えるか。
24. 過去試合Replayで当時のTrait stateを再現する方法。
25. バランス調整でTrait Definitionが変わった際、既存セーブをどう扱うか。
26. **方向性確定:** internal family idとUI名称を分離し、一般野球語は維持可能、固有色の強い名称は独自化可能。09参照。
27. **解決済み:** 09でADOPT / REINTERPRET / MERGE / MOVE / REJECTへ仕分け。最終UI文言は後続ローカライズで確定。
28. リーグ相対0〜100を導出する際のリーグ全体分布・期間・基準点をどう定義するか。
29. 移籍後、新リーグ相対評価の観測不足をどの期間・サンプル数で解消するか。
30. 変化球図の基準軌道、plate-plane測定方法、単位、矢印量子化方式をどう定義するか。
31. 球種ごとの平均値だけを表示するか、ばらつき・再現性・疲労時変化までどの階層で見せるか。
32. 月次更新だけで十分か、重大イベント時の臨時再評価条件をどこまで許可するか。
33. Condition / CurrentFatigue / ActiveEmotion等を二重計上せず合成する具体的な因果グラフと感度をどう定義するか。
34. 調子安定 / 調子極端 / 季節TraitがCondition分布へどう作用するか。
35. Scouting対象の真能力・推定能力・不確実性をどの粒度で保存するか。
36. Scout内部能力をどの軸まで分解し、UIへどの軸だけ公開するか。
37. Traitの1段目説明と、さらに深いEvidence / provenance表示をどこまで分けるか。
38. 複数内部能力を一つのTraitへ圧縮する際の重み付けと、同じTraitでも異なる内部構成を許すか。
39. 同一原因を複数のTrait・ランク・図へ表示する際、ユーザーが独立した長所と誤認しないPresentation規則をどうするか。
40. 現在の真能力、月次評価値、直近実測、シーズン平均、キャリア傾向をどの階層で使い分けるか。
41. 過去シーズンの選手画面を開いた際、「当時の評価」を表示するか、現在のprojectionルールで再評価するか。
42. Projection Definition更新で同じ選手の表示ランクが変わる場合、セーブ・履歴・Replayでどのversionを正とするか。
43. 深い分析情報を全選手へ常時保存するか、集約統計・オンデマンド計算・PlayCapsule等へ分担するか。
44. Presentation Projection Invarianceテストをどのテスト階層・CIで恒常的に保証するか。
45. Scout Estimateで「能力が低い」と「まだ分からない」を明確に区別する表示・データ構造。
46. 通常UIではカラーのみを主表示とし、Mechanism分類を詳細画面や分析モードへどこまで露出するか。
47. 月次Projection更新を大量リーグ・大量選手へ適用しても軽量に保つキャッシュ / 差分更新設計。
48. 300年規模の履歴保持を目標に、詳細投球・打球・守備Evidenceをどこまで保持し、どこから集約・圧縮するか。
49. 各公開能力をLEAGUE_RELATIVE / ABSOLUTE_PHYSICAL / SUITABILITY等へ分類する最終カタログ。
50. 守備位置適性の内部要因を、経験・技術・判断・身体条件のどこまで含めるか。
51. 先発 / 中継ぎ / 抑え適性のうち、役割固有の習熟・判断・ルーティンをどこまで独立状態として持つか。
52. Role Suitabilityが複数高い選手（先発A / 中継ぎA等）をどのように表示・運用するか。
53. 適性Aだが能力不足、適性Dだが能力が非常に高い、といったケースをUIで誤解なく伝える方法。
54. 肩力・走力・スタミナ等の絶対身体能力を、どの物理量・複合指標から公開0〜100へ投影するか。公開スタミナはWorkCapacity中心とし、境界・尺度をどう定義するか。
55. 高精度0〜10000 Projectionを保存・生成・補間へ使う場合、各能力で同じ意味の距離尺度を保証する必要があるか。
56. CurrentFatigueの蓄積・回復を、試合数、登板間隔、移動、練習、睡眠等のどこまでモデル化するか。
57. 疲労時に球速・変化量・制球・守備実行等がどの順序・感度で崩れるかを個人差としてどう持つか。

## 17. 現時点で決めないこと

以下はカタログ方針確定後も、後続実装設計まで確定しない。

- 数値補正量
- 発動確率
- 獲得閾値
- 消失閾値
- 成長速度
- Trait数上限
- UIレイアウト
- スカウト表示方式
- ペナント更新周期
- 初期選手へのTrait割当方式
- CPU生成選手へのTrait生成方式
- セーブ互換方式
- 具体的なキラー判定式

これらを未確定のまま残すこと自体が、本設計シードの目的である。

## 18. 設計開始時の入口

将来、Player / Career / Pennant / Developmentのいずれかを本格設計するときは、本書を参照し、少なくとも次を確認する。

```text
この新設計は
  Trait Evidenceを失わないか
  TraitとRatingsを二重計上しないか
  Match Coreの因果性を壊さないか
  Behavior Traitを能力Buffへ変えていないか
  Relationship Traitを固定球団名へ焼き込んでいないか
  将来の獲得・消失・再評価を不可能にしていないか
  UIの段階評価・Trait・図が同じsource of truthから導出されているか
  UI用の簡略値をSimulationやAI判断へ逆流させていないか
  未知と低能力を混同していないか
  深掘り時に上位表示の根拠へ到達できる余地があるか
  Conditionが恒常能力・Context耐性を不自然に書き換えていないか
  リーグ相対ランクがtrue abilityを直接変更していないか
  Scouting UIが選手UI以上に複雑化していないか
  適性と能力を混同していないか
  リーグ相対にすべきでない事実・状態・適合性まで再スケールしていないか
  Capability ProjectionとObserved League Fitを混同していないか
  Condition / CurrentFatigue / Stamina / Recoveryを同じ原因で二重計上していないか
  Suitabilityが汎用身体能力を再加算していないか
  UI Projectionの変更だけでCanonical Eventsが変化していないか
  Trait候補に因果説明とAdmission Gateがあるか
  Team名そのものをRelationship Buffの原因にしていないか
  0〜10000指数を万能な真能力として物理へ戻していないか
```

本書はその時点で更新・分割・破棄してよい。

重要なのは現在の案を永久固定することではなく、**後から設計余地が必要だったと気づいた時には既にデータ構造が閉じていた、という失敗を防ぐこと**である。


Team traits / player relationship design candidate (USER REVIEW REQUIRED):
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`


---

## Anti-Monocausal Design Principle

Mini Baseballでは、複雑な長期現象を一つの便利なSystemだけで説明しない。

禁止例:

```text
20-year dark era
 -> Team Trait

all recruitment success
 -> Scouting

all winning
 -> Manager Ability

all player growth
 -> Development Facility
```

長期結果は複数層の因果連鎖から生じる。

```text
Institution / Economy
+ Scouting / Recruitment
+ Development
+ Roster Construction
+ Manager Decisions
+ Relationships / Team Mood
+ Temporary Team Traits
+ Player Ability
+ Variance
        ↓
Observed Team History
```

各Systemは、自分が説明すべき層だけを担当する。

特にTeam Traitは **proximate-state layer** とする。

```text
Team Trait
 = how the team is currently functioning / failing

NOT
 = universal root cause of long-term success or failure
```

この原則は今後のTeam Mood / Manager Ability / Popularity設計にも適用する。


Team Mood design (APPROVED):
- `docs/game-design/37-team-mood-architecture.md`


### 0.7 Team Mood Rarity Boundary

Team Moodはrare-impact layer。

通常の人間関係・普通のClubhouse fluctuationはMatchへ意味ある影響を与えない。

重大なpositive / negative stateのみGameplayへ接続し、Season内の勝敗説明ではTeam Traitを主役とする。

Team MoodはTeam Traitを単独生成できない。独立したBaseball Evidenceを必要とする。


Manager philosophy / command architecture (USER REVIEW REQUIRED):
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`


Manager ratings / era / strategy evolution (USER REVIEW REQUIRED):
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`


Popularity / Reputation architecture (USER REVIEW REQUIRED):
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`


---

## Popularity refinement 2026-09-20

User-approved direction:

- `人気者` is a fan-affection / presentation descriptor.
- `Star` and `Superstar` are separate statuses.
- Popularity does not feed Manager tactical decisions.
- Manager caution / intentional-walk / matchup decisions remain owned by Manager Belief, scouting, data and context.
- Popularity effects remain secondary: crowd reaction, attendance interest, merchandise / presentation.
- `人気者` does not improve Team Mood by itself.
- Reputation / 威圧感 is no longer owned by Popularity; it returns to a separate Scouting / Manager Belief / Psychology boundary.

Detailed draft:
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`


Star / Superstar high-pressure mechanics:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Boundary:
- `人気者` remains fan-facing.
- `Star / Superstar` may have Tactical Gravity and high-salience Condition behavior.
- no direct raw ability buff.
