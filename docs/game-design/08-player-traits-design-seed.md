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

- Context: カウント、走者、回、点差、代打など局面依存
- Technique: 引っ張り、流し、低球、高球など特定技術依存
- PhysicalStyle: 球質、打球生成、送球など身体動作依存
- Behavior: 打撃・投球・走塁・守備の選択傾向
- Tradeoff: 利得と代償が同時に発生
- Relationship: 特定球団、特定選手、特定対戦条件との関係
- Derived: 元能力や実績から表示される称号で、追加補正を持たないもの

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

## 5. 公開能力との二重計上を避ける

得能が既存の公開能力・隠し能力をもう一度加算するだけにならないようにする。

例:

- 肩力と送球精度が非常に高い結果として「強肩送球」系の表示Traitを持つ
- 元能力の高さをTraitでもう一度上乗せしない

一部Traitは `Derived Trait` とし、能力そのものではなく「その選手の特徴を人間に理解しやすく見せるラベル」として存在できる。

将来の設計では、

```text
Trait causes performance
```

と

```text
underlying ability causes Trait label
```

を明確に区別する。

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

これにより架空球団、リーグ再編、移籍、追加リーグにも対応できる。

ただし重要な未決事項がある。

### 未決事項A: キラーは原因か観測ラベルか

案1:

```text
対戦実績が突出
  -> team_killer を取得
  -> 将来対戦へ追加効果
```

これは過去の好成績が未来の好成績を自己強化する危険がある。

案2:

```text
Familiarity / matchup / learned model が実際に成長
  -> 対象球団へ強くなる
  -> 十分な証拠が揃うと「○○キラー」と表示
```

この場合、キラーは主にDerived / Relationship labelとなり、追加の魔法的補正を持たない。

現行のLeague Ecology / Familiarity設計とは案2の方が整合しやすいが、**まだ確定しない**。

将来のペナント設計時に必ず再検討する。

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

## 15. 将来設計で必ず再検討する問題

この節はTODOではなく、**設計開始時に捨ててはいけない論点一覧**である。

1. 赤特の意味を「青の逆」に限定するか、それとも独立した欠点・癖も含むか。
2. 金特と青特の対応関係をどこまで厳密にするか。
3. Derived Traitと実際に作用するTraitをUI上で区別するか。
4. Traitを公開情報にするか、スカウト推定対象を含めるか。
5. 新人・外国人・未知リーグ選手のTraitをどこまで観測できるか。
6. 得能獲得は技能成長なのか、観測ラベルの更新なのか。
7. 成績ベースTraitが自己強化ループを作らないか。
8. ○○キラーを実効能力にするか、Familiarity等の結果表示にするか。
9. 特定選手キラー、球種キラー、球場適性などRelationship Traitをどこまで一般化するか。
10. 一人が持てるTrait数に上限を置くか。
11. 相反するTraitを同時保持できるか。
12. 青赤と緑が同じ行動へ作用するときの優先順位。
13. 監督指示と本人の行動傾向が衝突したときの解決。
14. 怪我・疲労・Condition・ActiveEmotionとの合成順序。
15. Exposure / Familiarityとの二重計上。
16. 公開能力・隠し能力との二重計上。
17. Traitの成長速度・減衰速度・忘却。
18. オフシーズンでの更新。
19. 移籍後もRelationship Traitを保持するか。
20. 球団消滅・改称・再編時のtarget identity。
21. 架空リーグ生成時の初期Trait生成。
22. CPU選手とプレイヤー管理選手で同じ更新則を使えるか。
23. 自動試合と描画試合で完全に同じTrait処理を使えるか。
24. 過去試合Replayで当時のTrait stateを再現する方法。
25. バランス調整でTrait Definitionが変わった際、既存セーブをどう扱うか。
26. Trait名称・説明文をどこまで独自化するか。
27. パワプロ由来の具体的名称・効果をそのまま依存しないための最終的な独自カタログ設計。

## 16. 現時点で決めないこと

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

## 17. 設計開始時の入口

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
