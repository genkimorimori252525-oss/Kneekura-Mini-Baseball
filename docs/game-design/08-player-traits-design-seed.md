# 選手特殊能力 / Trait System 設計シード

更新日: 2026-09-19  
状態: **探索中。設計未承認・実装禁止。**  
目的: 将来の選手データ、ペナント、育成、試合Core設計を始める際に参照する設計種。具体的な効果量・獲得条件・一覧はまだ確定しない。

## 1. この文書の位置づけ

本案は、パワプロ系の「特殊能力」という分かりやすい表現を参考にしつつ、Kneekura Mini Baseball の因果的シミュレーションへ再解釈して導入するための探索メモである。

これは現時点の実装仕様ではない。

特に以下は未設計または設計途上である。

- ペナント / Career World
- 選手成長・衰退
- トレーニング
- シーズン間更新
- 選手獲得・移籍
- 対戦履歴と長期学習
- 得能の獲得・消失・昇格条件
- 得能間の競合・相互作用
- 得能の完全な一覧

したがって、先に得能システムを完成させて後からペナントへ押し込むのではなく、将来これらを設計するときに本書の要求を入力として扱う。

## 2. 現時点で維持したい分類

UI上の基本分類候補:

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

この分類自体も今後の設計レビューで変更可能とする。

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

以下は探索中の文書内ではあるが、現時点で方向性を採用する。具体的な式・閾値・保存形式は後続設計で詰める。

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

## 16. 将来設計で必ず再検討する問題

この節はTODOではなく、**設計開始時に捨ててはいけない論点一覧**である。

1. 赤特の意味を「青の逆」に限定するか、それとも独立した欠点・癖も含むか。
2. 金特と青特の対応関係をどこまで厳密にするか。
3. Derived Traitと実際に作用するTraitをUI上で区別するか。
4. Traitを公開情報にするか、スカウト推定対象を含めるか。
5. 新人・外国人・未知リーグ選手のTraitをどこまで観測できるか。
6. Recognition型とDevelopment型を、具体的なTraitカタログでどう分類するか。
7. 成績Evidenceを観測へ使う際、自己強化ループを起こさない具体的な統計設計。
8. ○○キラー表示のEvidence閾値、減衰、Relationship粒度をどう定義するか。
9. 特定選手キラー、球種キラー、球場適性などRelationship Traitをどこまで一般化するか。
10. 一人が持てるTrait数に上限を置くか。
11. 相反するTraitを同時保持できるか。
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
26. Trait名称・説明文をどこまで独自化するか。
27. パワプロ由来の具体的名称・効果をそのまま依存しないための最終的な独自カタログ設計。

## 17. 現時点で決めないこと

以下は今この文書で確定しない。

- 得能一覧
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
- 赤特一覧
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
```

本書はその時点で更新・分割・破棄してよい。

重要なのは現在の案を永久固定することではなく、**後から設計余地が必要だったと気づいた時には既にデータ構造が閉じていた、という失敗を防ぐこと**である。
