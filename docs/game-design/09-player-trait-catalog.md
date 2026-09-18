# Player Rating / Trait Catalog — 最終候補ドラフト

更新日: 2026-09-19  
状態: **最終候補ドラフト。ユーザー承認前。実装禁止。**  
親設計: `docs/game-design/08-player-traits-design-seed.md`

## 1. 目的

08で確立した因果原則を、公開能力ランクと具体的Traitカタログへ落とす。

本書で参照するパワプロ系名称は、ユーザー提供の候補一覧を監査するための**参照ラベル**であり、Kneekura Mini Baseball の最終名称をそのまま確定するものではない。

各候補は最低限、次のいずれかへ分類する。

- **ADOPT**: 因果的に採用可能
- **REINTERPRET**: アイデアは残すが、直接Buff等を廃止し因果的に再解釈
- **MERGE**: 別Trait Family / Graded Family / Tierへ統合
- **MOVE**: Psychology / Career / Relationship / Role Suitability / Presentation等へ移す
- **REJECT**: Match Traitとして採用しない

---

## 2. 公開0〜100 / G〜S境界 最終候補

| Rank | Public value | 基本意味 |
| --- | ---: | --- |
| S | 90〜100 | 極端に突出した水準 |
| A | 80〜89 | 一流 |
| B | 70〜79 | 明確に優秀 |
| C | 60〜69 | 平均より上〜良好 |
| D | 50〜59 | 基準域 / 標準 |
| E | 40〜49 | やや弱い |
| F | 20〜39 | 明確な弱点 |
| G | 0〜19 | 極端な弱点 |

### 2.1 LEAGUE_RELATIVE

- リーグ基準域は概ね50〜55付近を中心候補とする。
- 50 = 常に厳密な平均、とは固定しない。分布の歪み・対象能力・シーズン基準により多少ずれてよい。
- Sは「上位10%」等の順位ラベルではない。
- 0〜100はパーセンタイルではなく、リーグ基準からの能力差を圧縮したPresentation Projectionとする。
- 同じ真能力でもリーグ尺度が異なれば公開値は変わり得る。
- 一軍 / 二軍、守備位置、先発 / 中継ぎ / 抑えは原則として尺度変更ではなく比較フィルタ。

### 2.2 ABSOLUTE_PHYSICAL / SUITABILITY

同じG〜S境界を表示に再利用してよいが、0〜100の生成元は異なる。

```text
LEAGUE_RELATIVE
  true skill + league calibration
    -> 0..100
    -> G..S

ABSOLUTE_PHYSICAL
  physical / measurable values
    -> absolute projection
    -> 0..100
    -> G..S

SUITABILITY
  role-specific mastery / fit
    -> suitability projection
    -> 0..100
    -> G..S
```

Rank文字自体をMatch Coreへ入力しない。

---

## 3. A〜G型Trait Family

A〜G型Traitは一つの正負を持つFamilyとする。

| Grade | UI色 |
| --- | --- |
| A | 青 |
| B | 青 |
| C | 通常 |
| D | 通常 |
| E | 通常 |
| F | 赤 |
| G | 赤 |

対応する上位Traitが存在するFamilyでは、GoldをAより上のMaster Tierとして持てる。

### 3.1 投手 Graded Family

- 対ピンチ
- 対左打者
- 打たれ強さ
- ノビ
- クイック

### 3.2 野手 Graded Family

- チャンス
- 対左投手
- キャッチャー
- 盗塁
- 走塁
- 送球
- ケガしにくさ
- 回復

UI上のA〜Gが共通でも、内部source of truthはFamilyごとに異なる。

---

# 4. 投手Trait カタログ候補

## 4.1 球質 / 軌道 / Release

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| ノビ A〜G / 怪童 | MERGE | fastball movement / velocity retention / release等から導出するGraded Descriptor + Gold Tier |
| 重い球 / 怪物球威 | REINTERPRET | velocity・movement・approach angle等がcontact qualityへ与える実際の影響を要約。Traitから打球を直接減速しない |
| ジャイロボール / ハイスピンジャイロ | ADOPT | spin axis / trajectory由来のPhysical Descriptor |
| ナチュラルシュート | REINTERPRET | fastballの恒常的arm-side runを表すNeutral Descriptor候補。青Buffとはしない |
| 真っスラ | REINTERPRET | fastballの恒常的glove-side movementを表すNeutral Descriptor候補 |
| 球速安定 | ADOPT | velocity variance / reproducibility Descriptor |
| キレ○ / 驚異の切れ味 | MERGE | breaking-ball movement quality / late movement / reproducibilityのFamily |
| 球持ち○ / ディレイドアーム | MERGE | extension / visibility / release deception Descriptor |
| リリース○ | ADOPT | pitch-type間のrelease差・form差の小ささ |

## 4.2 Command / Miss Pattern

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| 低め○ / 精密機械 | MERGE | low-zone command skill Family |
| 内角攻め / 内角無双 | MERGE | inside command skill Family |
| クロスファイヤー / クロスキャノン | REINTERPRET | release geometry + diagonal command technique |
| 逃げ球 / 本塁打厳禁 | REINTERPRET | miss distributionが危険中央へ集まりにくい特性 |
| 一発 | ADOPT |失投時に危険中央へ集まりやすいmiss distribution |
| 抜け球 | ADOPT | delivery failure時の特定方向へのmiss pattern |
| 乱調 | ADOPT | command / release reproducibilityの短期的高variance |
| 四球 | REINTERPRET | raw controlとは別に、zone entry / nibbling / count behaviorから生じるwalk-prone特性。制球との二重計上禁止 |
| ボール先行 | REINTERPRET | early-count zone-entry tendency。BehaviorとCommandを分離 |
| ストライク先行 | REINTERPRET | early-count strike-seeking tendency。必要なら緑Behaviorへ移す |
| シュート回転 | REINTERPRET | 単なるside movementならNeutral Descriptor。意図せぬ harmful release errorの場合のみNegative候補 |

## 4.3 Sequencing / Put-away / Context Execution

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| 緩急○ / 変幻自在 | MERGE | pitch-speed separationとsequencing skill |
| 奪三振 / ドクターK | REINTERPRET | two-strike put-away pitch selection / execution Family |
| 対強打者○ / 主砲キラー | REINTERPRET | 強打者ラベルによるBuffではなく、高難度相手へのDecision / pressure response / learned matchup |
| 要所○ | REINTERPRET | high-leverage execution stability |
| 安全圏○ | MOVE | Pressure / Psychology側へ。独立Traitとして必要か再検討 |
| ギアチェンジ | REINTERPRET | opponent/contextに応じたeffort allocation / pitch usage |
| 完全燃焼 / 全開 | MERGE | max-effort output上昇とfatigue costが不可分なTradeoff Family |
| 力配分 | ADOPT | output節約とfatigue savingのTradeoff / Behavior |

## 4.4 Stamina / Role / Readiness

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| 根性○ / ド根性 | MERGE | fatigue下でのmechanical execution resilience。疲労そのものを消さない |
| 尻上がり / 終盤力 | MERGE | pacing / late-game quality maintenance |
| 立ち上がり○ / トップギア | MERGE | warm-up / early-game readiness |
| 回またぎ○ | MOVE | relief multi-inning Role Suitability / workload handling |
| 緊急登板○ | MOVE | rapid warm-up / emergency-entry Role Suitability |
| 火消し | REINTERPRET | inherited-runner / emergency-entry pressure + readiness |
| ガソリンタンク | MERGE | Recovery A〜GのGold Tier候補。RecoveryCapacityから導出 |
| 鉄腕 | MERGE | Condition sensitivity / 投手調子安定のMaster Tier候補 |

## 4.5 Runner Control / Pitcher Defense

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| クイック A〜G / 走者釘付 | MERGE | set-position release time / repeatability Graded Family + Gold |
| 牽制○ | ADOPT | pickoff technique |
| 対ランナー○ | REINTERPRET | runner-on-base時のexecution stability / attention allocation |
| 打球反応○ | ADOPT | pitcher fielding reaction skill |

**Source conflict:** ユーザー提供の赤特一覧にも「対ランナー」があり、説明文は「ランナーがいると能力が上がる」と正方向になっている。赤分類と説明が矛盾するため、この赤版だけは効果を推測修正せず保留する。

## 4.6 Pressure / Emotion / Relationship

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| 対ピンチ A〜G / 強心臓 / ノミの心臓 | MERGE | pressure-context executionのGraded Family + Gold / Negative extreme |
| 打たれ強さ A〜G / 不屈の魂 | MERGE | negative-event後のemotional / execution recovery Family |
| 対左打者 A〜G / 左キラー | MERGE | platoon matchup Family。左右ラベルだけの魔法Buffは禁止 |
| 短気 | REINTERPRET | Appraisal -> anger / ActiveEmotion -> executionへの因果経路 |
| 闘志 / 闘魂 | MOVE | Psychology / Behavior Descriptor。無条件能力Buffにはしない |
| 威圧感(投手) / 存在感(投手) | MOVE | reputation / opponent appraisal。相手能力を直接下げない |

## 4.7 Career / Match Traitから外すもの

| 参照候補 | 判定 | 理由 |
| --- | --- | --- |
| 勝ち運 / 勝利の星 / 負け運 | MOVE | team win/lossを直接呼び込む因果は採用しない。Career / historical Descriptor候補 |
| 投打躍動 / 超投打躍動 | MOVE | 一方の結果が他方を直接Buffする形は不採用。将来Confidence / Emotion / adaptationで再検討 |
| フレーミング◎ | MOVE | 捕手Traitへ移動 |

## 4.8 投手 Green / Neutral Behavior

**Green採用候補**
- 速球中心
- 変化球中心
- テンポ○
- 投手調子安定
- 投手調子極端

**Neutral / setup候補**
- 投球位置左
- 投球位置右

投球位置は能力上昇ではなくrelease geometryの選択 / setupとして扱う。

## 4.9 投手 Blue-Red候補

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| 荒れ球 | REINTERPRET | stuff / unpredictability benefitとcommand variance costのTradeoff |
| 全開 | MERGE | 完全燃焼Family |
| 力配分 | ADOPT | output reduction ↔ fatigue saving |
| ゴロピッチャー | MOVE | actual batted-ball distributionから導出するNeutral Descriptor |
| フライボールピッチャー | MOVE | actual batted-ball distributionから導出するNeutral Descriptor |
| ポーカーフェイス | MOVE | Psychology visibility / Green-Neutral Descriptor |

## 4.10 投手 Named Red候補

**採用 / 再解釈**
- 一発
- 軽い球
- 四球
- 抜け球
- スロースターター
- 寸前
- 短気
- 乱調
- ノミの心臓
- ボール先行

**Neutralへ再解釈候補**
- シュート回転

**Match Traitから外す**
- 負け運

**Source conflict保留**
- 赤版 対ランナー

---

# 5. 野手 / 打者 / 捕手Trait カタログ候補

## 5.1 Contact / Power / Batted-ball Skill

| 参照候補 | 判定 | Kneekuraでの扱い |
| --- | --- | --- |
| アベレージヒッター / 安打製造機 | MERGE | contact precision / batted-ball quality Descriptor Family |
| パワーヒッター / アーチスト | MERGE | power swing時のexit velocity + launch generation Family |
| 流し打ち / 芸術的流し打ち | MERGE | opposite-field technique Family |
| 広角打法 / 広角砲 | MERGE | multi-direction hard-contact technique |
| プルヒッター / 引っ張り屋 | MERGE | pull-side power-transfer technique |
| ラインドライブ | REINTERPRET | actual launch distributionから導出するNeutral / Positive Descriptor。直接弾道Buffにしない |
| カット打ち | ADOPT | late contact / foul extension technique |
| 粘り打ち | ADOPT | two-strike adjustment / foul survival skill |

## 5.2 Zone / Pitch-type Skill

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| インコースヒッター / 内角必打 | MERGE | inside-zone technique Family |
| アウトコースヒッター / 外角必打 | MERGE | outside-zone technique Family |
| ハイボールヒッター / 高球必打 | MERGE | high-zone technique Family |
| ローボールヒッター / 低球必打 | MERGE | low-zone technique Family |
| 対ストレート○ | ADOPT | fastball-family recognition / timing skill |
| 対変化球○ | ADOPT | breaking/off-speed recognition / adjustment skill |
| 初球○ / 一球入魂 | MERGE | first-pitch approach / execution Family |

## 5.3 Two-strike / Failure Adaptation

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| 窮地○ / ヒートアップ | REINTERPRET | two-strike adaptation / execution under narrowing options |
| 三振 / 扇風機 | MERGE | two-strike recognition / adjustment weaknessのNegative Family |
| リベンジ / 逆襲 | REINTERPRET | previous-AB outcomeそのものではなく、in-game matchup learning / adjustment speed |
| 固め打ち / メッタ打ち | MOVE | 単なる「ヒット後Buff」は不採用。Confidence / timing stateとして将来再検討 |
| マルチ弾 | MOVE | HR後の直接Power Buffは不採用。Confidence / approach stateで再検討 |

## 5.4 Pressure / Match Context

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| チャンス A〜G / 勝負師 | MERGE | pressure-context hitting Graded Family + Gold |
| 満塁男 / 恐怖の満塁男 | MERGE | Clutch Familyのbases-loaded specialization候補。Trait過多なら統合 |
| サヨナラ男 / 伝説のサヨナラ男 | MERGE | high-leverage / walk-off context。Clutch Familyへ統合候補 |
| 決勝打 / 渾身の決勝打 | MERGE | high-leverage execution。Clutch Familyへ統合候補 |
| 逆境○ / 火事場の馬鹿力 | REINTERPRET | trailing-game pressure / motivation response |
| 対エース○ / エースキラー | REINTERPRET | 「エース」ラベルBuffではなく高品質pitch / learned matchupへの適応 |
| 代打○ / 代打の神様 | MERGE | pinch-hit readiness / Role Suitability Family |
| ダメ押し | REJECT | 大量リードという結果状態から直接能力上昇する必要性が薄い |
| 帳尻合わせ | REJECT | 成績帳尻のための直接Buffは因果原則に合わない |
| 意外性 / 大番狂わせ | MOVE | Career / highlight Descriptor候補。Match能力Buffとしては曖昧 |
| いぶし銀 | MOVE | Style / Career Descriptor候補。因果効果が曖昧 |

## 5.5 Platoon

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| 対左投手 A〜G / 左腕キラー | MERGE | platoon matchup Graded Family + Gold |

## 5.6 Bunt / Running

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| バント○ / バント職人 | MERGE | bunt contact / placement technique |
| 内野安打○ / ロケットスタート | MERGE | bat-to-run transition / first-step acceleration Descriptor |
| 盗塁 A〜G / 電光石火 | MERGE | lead / start / acceleration / slide Graded Family + Gold |
| 走塁 A〜G / 高速ベースラン | MERGE | route / read / extra-base decision Graded Family + Gold |
| ヘッドスライディング / 気迫ヘッド | MOVE | slide-style Behavior / Green-Neutral候補。無条件speed Buffにしない |
| かく乱 / トリックスター | REINTERPRET | runner threatがpitcher/catcherのattention allocationへ与える実際の圧力 |
| プレッシャーラン | MOVE | legality / opponent error inductionをRule + Psychologyへ分離 |
| ホーム突入 / 重戦車 | MOVE | collision rule依存。Competition / RuleProfile側でのみ成立候補 |

## 5.7 Fielding / Throwing / Catcher

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| 守備職人 / 魔術師 | MERGE | advanced fielding technique / route / transfer Family |
| 高速チャージ | ADOPT | bunt / slow-ball charging technique |
| 送球 A〜G / ストライク送球 | MERGE | throwing accuracy Graded Family + Gold |
| レーザービーム / 高速レーザー | REINTERPRET | arm velocity / trajectoryのDescriptor。肩力を再Buffしない |
| ホーム死守 / 鉄の壁 | MERGE | catcher / fielder tag-and-block execution Family |
| ブロッキング | ADOPT | catcher block technique |
| フレーミング○ / フレーミング◎ | MERGE | receiving / called-strike influence。RuleProfile依存 |
| キャッチャー A〜G / 球界の頭脳 | MERGE | pitcher handling / game-calling / communication Graded Family + Gold。投手能力を直接上げない |
| バズーカ送球 | REINTERPRET | catcher pop-time + throw velocity + accuracy Descriptor |

## 5.8 Durability / Recovery

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| ケガしにくさ A〜G / 鉄人 | MERGE | injury-resistance Graded Family + Gold |
| 回復 A〜G | ADOPT | RecoveryCapacity Graded Family。投手/野手共通能力候補 |

## 5.9 Team / Reputation / Psychology

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| ムード○ / 精神的支柱 / ムード× | MOVE | Relationship / Trust / Team Chemistry Descriptor。全員への直接Buff禁止 |
| 威圧感(野手) / 存在感(野手) | MOVE | reputation / opponent appraisal。投手能力を直接下げない |
| ささやき戦術 / ささやき破り | MOVE | Catcher Psychology / Communication。独立システム採用時のみ復活候補 |
| 人気者 | MOVE | Career / Presentation |
| チャンスメーカー / 切り込み隊長 | MOVE | batting-order role / Career Descriptor候補。結果ラベルを能力にしない |

## 5.10 Team Killer

各球団名付きキラーTraitは個別固定Traitにしない。

```text
Relationship / Familiarity Evidence
  -> targetTeamId
  -> current roster / pitch-shape / tactic overlap
  -> Descriptor
  -> 「○○キラー」
```

元候補の各球団キラーはすべて **MERGE -> parameterized Relationship Trait** とする。

---

# 6. Green Trait カタログ候補

## 6.1 投手

**Green採用**
- 速球中心
- 変化球中心
- テンポ○
- 投手調子安定
- 投手調子極端

**Neutral setupへ移動**
- 投球位置左
- 投球位置右

## 6.2 野手

**Green採用**
- 強振多用
- ミート多用
- 積極打法
- 慎重打法
- 積極盗塁
- 慎重盗塁
- 積極走塁
- 積極守備
- チームプレイ○
- チームプレイ×
- フル出場
- 野手調子安定
- 野手調子極端
- 春男
- 夏男
- 秋男

**Greenから外す**
- 選球眼 -> actual recognition / discipline ability
- 人気者 -> Career / Presentation
- 国際大会○ -> Competition / Pressure Context
- お祭り男 -> 定義が大会・イベント依存のためCompetition / Condition側へ再設計

Greenは能力値上昇ではなくDecision / preference / condition-distribution tendencyへ作用する。

---

# 7. Blue-Red Trait カタログ候補

## 7.1 投手

- 荒れ球 -> stuff / unpredictability benefit ↔ command variance cost
- 全開 / 完全燃焼 -> max effort ↔ fatigue cost
- 力配分 -> output saving ↔ immediate quality cost

以下はBlue-RedではなくNeutral / other systemへ移動:
- ゴロピッチャー -> Neutral batted-ball Descriptor
- フライボールピッチャー -> Neutral batted-ball Descriptor
- ポーカーフェイス -> Psychology visibility

## 7.2 野手

- 悪球打ち -> expanded contact/chase behavior benefit ↔ chase / weak-contact risk
- 死球集中 -> plate-crowding / avoidance tendencyへREINTERPRET。Blue-Redに残すかNeutral Behaviorにするか最終監査対象

---

# 8. Named Red Trait カタログ候補

## 8.1 投手

**Match Traitとして残す候補**
- 一発
- 軽い球
- 四球
- 抜け球
- スロースターター
- 寸前
- 短気
- 乱調
- ノミの心臓
- ボール先行

**Neutral Descriptorへ再解釈候補**
- シュート回転

**Careerへ移動**
- 負け運

**Source conflict**
- 赤版 対ランナー

## 8.2 野手

| 参照候補 | 判定 | 扱い |
| --- | --- | --- |
| エラー | REINTERPRET | scoring-position等のpressure下fielding execution weakness。通常守備力との二重計上禁止 |
| 三振 / 扇風機 | MERGE | two-strike adjustment Negative Family |
| 併殺 | REINTERPRET | ground-contact tendency + running speed + contextから生じるDescriptor。併殺結果を直接増やさない |
| ムード× | MOVE | Team Chemistry / Relationship Descriptor |

---

# 9. 現時点で明確にMatch Traitへしない候補

直接結果Buff / Debuffになりやすいため、少なくとも現形ではMatch Traitへ入れない。

- 勝ち運
- 勝利の星
- 負け運
- 大番狂わせ
- 意外性
- ダメ押し
- 帳尻合わせ
- 投打躍動
- 超投打躍動

また以下は別システムへ移す。

- 人気者 -> Presentation / Career
- 精神的支柱 / ムード○ / ムード× -> Relationship / Team Chemistry
- 威圧感 / 存在感 -> Psychology / Reputation
- ささやき戦術 / ささやき破り -> Communication / Psychology
- ホーム突入 / 重戦車 -> RuleProfile-dependent running
- ゴロピッチャー / フライボールピッチャー -> Neutral Descriptor

---

# 10. Trait Familyの量を抑える統合方針

元候補の状況Traitを一対一で全部残すとTrait数が膨張する。

以下は統合優先候補。

```text
チャンス
満塁
サヨナラ
決勝打
要所
  -> Pressure / High-Leverage family + optional specialization evidence

初球
追い込まれ
  -> count-specific execution families

固め打ち
メッタ打ち
マルチ弾
  -> direct outcome buffとしては削除
  -> confidence / adaptation systemへ

○○キラー
  -> parameterized Relationship family
```

ユーザーが表面で理解しやすいことを優先しつつ、内部Evidenceは細分化可能とする。

---

# 11. 最終承認前の残件

1. G〜S境界 `G 0-19 / F 20-39 / E 40-49 / D 50-59 / C 60-69 / B 70-79 / A 80-89 / S 90-100` を確定するか。
2. LEAGUE_RELATIVEの基準域を50〜55周辺とするか。
3. Pressure系（チャンス / 満塁 / サヨナラ / 決勝打等）をどこまで一Familyへ統合するか。
4. 「軽い球 / 重い球」を独立Traitとして残すか、球質詳細のDescriptorだけにするか。
5. 「シュート回転」をNegativeではなくNeutral pitch-shape Descriptorとするか。
6. 赤版「対ランナー」の元効果矛盾をどう扱うか。
7. 「死球集中」をBlue-Redとして残すか、plate-crowding Neutral Behaviorへ移すか。
8. 最終UI名称を参照元名称からどこまで独自化するか。

これらを確定し、敵対監査を通過した時点で08 / 09を承認候補版へ昇格できる。
