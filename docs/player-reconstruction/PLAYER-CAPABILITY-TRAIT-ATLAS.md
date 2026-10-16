# 選手再現部 — 公開能力・隠し技能・青/金/赤/緑Trait 全参照台帳

> **STATUS:** COMPLETE **DOCUMENT NAVIGATION OF CURRENT CANONICAL CATEGORIES** / NOT A CLAIM OF ALL GAME IMPLEMENTATIONS. 2026-10-16.
>
> **This is a **reconstruction operator's map**, not a new approved trait catalog.** 正本は [02 公開/隠し能力](../game-design/02-rules-ratings-defense.md)、[04 守備内部能力](../game-design/04-defense-ratings.md)、[08 原則/状態](../game-design/08-player-traits-design-seed.md)、**[09 Trait/Rating Catalog CANONICAL v1](../game-design/09-player-trait-catalog.md)**、[05 心理](../game-design/05-psychology-emotion.md)、[53 育成](../game-design/53-player-development-trajectory-breakthrough-v1.md)。新規の[打者認知BAT](../superpowers/plans/2026-10-16-batter-anticipation-intent-adaptive-swing.md)、[方向Intent DIR](../superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md)、[捕手知能CATCH](../superpowers/plans/2026-10-16-catcher-game-intelligence-system.md)は**未実装計画**。記録資料で確定できない性格・知能・腕の動きを勝手に「史実」としない。

## 0. 正式尺度とTrait lifecycle — まずこれを守る

### 公開Rating

| 表示 | 公開尺度/出典 | Match Coreでの役割 |
| --- | --- | --- |
| `☆000〜999` | Playerのrole-aware Headline Rating。`☆500`が現在の比較Contextのベンチマーク。 | **表示要約だけ**。☆を実試合へ入力しない。 |
| `ミート / パワー / 選球眼 / バント / 守備力 / 制球`等 | 原因となる技能/物理と`LeagueRatingReference`から計算した0〜100、S〜G。 | 表示を変更してもSource不変なら正史結果不変。 |
| `走力 / 肩力 / 球速 / スタミナ`等 | `ABSOLUTE_PHYSICAL`、可能なら実測の走速度・球速・身体持続性から導出。 | 実験上のTrue Physical Sourceが別に存在。 |
| `守備位置適性 / 投手役割適性` | `SUITABILITY`、役割特有の技術・判断・慣れ。 | 他の身体技能の加算を二重適用しない。 |
| 投打左右・守備位置・年齢・身長・体重・球種 | 本人の事実・属性。 | 出典と日付・年代を付けて直接保存可能なものと計測不能なものを区別。 |

09正本のS〜G:
- **S=90–100**、**A=80–89**、**B=70–79**、**C=60–69**、**D=50–59**、**E=40–49**、**F=20–39**、**G=0–19**。
- 相対Ratingはパーセンタイルではなく、対象選手集団による基準。現在リーグの水準が変化すると同じTrue Skillでも比較Ratingは変わる。**固定OBカードとの表示衝突は[OB原則P-001](PRINCIPLES.md)の未決定契約**であり、後日固定Snapshotカードと比較ビューの分離を検討。
- 公開0〜100、内部0〜10000高精度Projection、A〜G/金特は**True Abilityそのものではない**。Sourceがあり得る限り、内部物理量・能力発揮過程に一度だけ接続。

### Trait color / lifecycle / mutually exclusive variants

| 区分 | 正本意味と注意 |
| --- | --- |
| **Blue／青** | Positive Skill/Technique/Descriptor。Named Masteryは本人の技能Source/実際の行動から導出。所持だけで成績直接Buffなし。 |
| **Gold／金** | 関連するBlue/Graded FamilyのMaster Tier。**A+Gold**や同Family複数Gradeを二重付与禁止。動的Grade Goldは源技能の変化で上下し得る。技能習得型Named MasteryはPersistentになり得る。 |
| **Red／赤** | Negative Skill/Behavior/Execution/Evidence（Graded FamilyのF/Gは赤）。「一発」「三振」等は個別の因果源から導出。失敗結果の強制ではない。 |
| **Green／緑** | Slow Default Policy、行動選択の傾向。「積極打法」は選球眼を直接下げない。相反するBehavior Familyは排他。 |
| **Blue-Red／青赤** | 実在する恩恵・代償を伴うTradeoff。強みだけ適用/弱みだけ適用は禁止。 |
| **Neutral/other** | 方向/球質の説明、Role、心理、Career historyなど。Match Traitとして不採用/MOVE/REJECTの名称を当てずっぽうで復活させない。 |

09 Lifecycle: `GRADED_DYNAMIC` / `LEARNED_MASTERY_PERSISTENT` / `GREEN_SLOW_PREFERENCE` / `DYNAMIC_DESCRIPTOR` / `CAUSAL_NEGATIVE_DYNAMIC` / `RELATIONSHIP_CONTEXTUAL` / `CAREER_HISTORY_DESCRIPTOR`。**同じFamilyは有効な表示状態1つ**。Greenは短期で上下させない。能力タグを所有すること自体が物理パラメータ上昇を意味しない。

## 1. 真の選手Source → 公開値の対応表（設定できる/推定するもの）

| 能力/Source Family | 史料/計測で使えるEvidence | 真の因果作用 | 公開/派生 |
| --- | --- | --- | --- |
| **打撃 Contact**: barrel path control, contact precision, temporal/spatial correction, swing timing reproducibility | 安打・三振・打球種/動画/打撃技術解説（時代で計測差） | 実際の始動、バット面・芯・接触時刻、打球品質 | ミート、安打製造機/アベレージ、悪球打ちなど、元Sourceと対応 |
| **Raw Power / Bat Speed** | HR・長打/打席、本人の身長体重・映像、現代なら打球速度等 | バット速度/加速/力の伝達 | パワー、パワーヒッター/アーチスト |
| **Eye/recognition/decision** | BB vs IBB、SO、見逃し/Chase（ある年代のみ）、映像 | ゾーン認識、投球見極め、振る/見送る判断時刻 | 選球眼。慎重打法の性格からは決めない |
| **Bunt technique** | バント試行/成功、映像、場面（数値不足の年あり） | バントの構え、接触位置、減速・方向 | バント、バント○/職人（同Sourceを二度適用しない） |
| **Batted-ball direction technique** | 方向別強打と映像/技術資料、投打左右 | PULL/CENTER/OPPOSITEへの実Motor、接触品質 | プルヒッター/引っ張り屋、流し打ち/芸術的、広角打法/広角砲 |
| **Directional Approach (planned)** | 本人の打撃方針・映像/発言・相手守備の適応 | 狙う時のPULL/CENTER/OPPOSITE頻度、方向を決めないREACTIVE | **Greenとは別の本人のSlow Preference候補**。Intent0% ≠ 実打球0%。 |
| **Pitch-family/plate anticipation (planned)** | 対戦投手の履歴・映像・スカウティング・カウント | 本人の球種×コース予測、priorReliance、狙いの絞り込み、修正余地 | 狙い球型/反応型はミート等の強弱ではない。新Blueの直Buffにしない |
| **Plate aggression (planned/refined)** | Swing/Take/chase見極め資料、Green Behavior | 本当に振る意思を持つ球、ゾーン外へ意図的に手を出す傾向 | 積極/慎重打法。悪球打ちのSkillと別 |
| **Baserunning true skills** | 実測走力/タイム、盗塁試行/成功、送り/進塁/映像 | start/route/acceleration/slide/状況判断 | 走力、盗塁A〜G/電光石火、走塁A〜G/高速ベースラン |
| **Defensive physical and technique** | 年度守備位置/刺殺補殺失策、出場イニング、映像、近代UZR等 | 打球初動、経路、捕球、送球・タッグ | 守備力、肩力、守備適性、守備職人/魔術師、送球A〜G |
| **Pitch execution and repertoire** | 球速・球種の実証、奪三振・四球・投球回・被HR、映像/球種資料 | リリース、球道、command error/variance、spin/shape、決め球、体力 | 球速、制球、変化、球種、スタミナ、投手Trait |
| **Catcher cognition / battery skill (planned)** | 投手の変化・リード/配球の状況・実戦配球資料 | situationReasoning, batterReading, pitcherUnderstanding, sequenceConstruction, strategicCounterplay, evidenceAdaptation, communicationExecution | キャッチャーG〜A / 球界の頭脳は7技能の表示要約 |
| **Condition/current states** | 健康/出場負荷/フォーム、試合時期、記録と説明 | 当日の実際の身体・技術の発揮、疲労・回復 | 公開能力カード/技術Sourceは直接変更せず、次の実行へ一度だけ作用 |

史実の集計しかない年に `batSpeed=48m/s` など正確な値を捏造するな。欠測は `UNKNOWN` / `HISTORICAL_ESTIMATE`、実シミュレーションからの最適化値は `MODEL_CALIBRATED` とする。

## 2. 守備系の**実際の内部能力**（04にある11候補）

| source name（04正本） | 本人の再現に使う作用 |
| --- | --- |
| `positionSuitability` | 守備位置の技術習熟、足運び/受け渡しのRole固有差 |
| `firstStep` | 実打球の知覚後、初動までの反応 |
| `acceleration` | 初動後の加速、変向/到達時間 |
| `battedBallRead` | 実打球の方向、落下点/跳ねの観測推定 |
| `routeEfficiency` | 実世界の移動経路、追い方 |
| `catching` | グラブ到達・実捕球/確保の技術 |
| `transfer` | 捕球→送球への動作移行 |
| `armStrength` | 実送球速度の元Source |
| `throwingAccuracy` | 実着点/送球の誤差と再現性 |
| `situationalAwareness` | 塁/走者/他野手の戦術的判断、バックアップ |
| `tagSkill` | タッグの位置・タイミング・動作 |

04 `4では「方向転換・俊敏性」「フットワーク」「ジャンプ/ダイブ」「壁際守備」「中継技術」「併殺技術」「コミュニケーション」を初期に独立査定へ無条件追加しない。既存Sourceの組合せを優先する。

## 3. 投手Source（再現対象が投手のときに必須）

- **Pitch Arsenal:** 球種実在証拠、球速帯、実spin/trajectory、同球種内variant、投法・利き腕。球種数そのものに能力Buffや固定上限を作らず、2球種の超一流と多球種の多彩さの両方を認める（[Arsenal計画](../superpowers/plans/2026-10-07-pitch-arsenal-development-system.md)、現時点計画）。
- **Command:** Pitch-target accuracy/error distribution（内外・高低・center vs edge）、delivery/release reproducibility、glove setupの誤認/伝達/投手受諾を分離。
- **Pitch Quality:** Stuff/movement・ball speed・extension、pitch type間で誤認可能なrelease。単に奪三振/勝利から決めない。
- **Pitcher physical:** WorkCapacity / Stamina、FatigueResistance、RecoveryCapacity、当日のCondition、怪我。救援のwarm-up/quick/pickoff/牽制を個別に。
- **Cognitive/Behavior:** count/zone/strike-first vs ball-first、effort allocation、cadence manipulation、対走者/ピンチ学習、信頼/通信。全部を「制球」「球威」へ押し込まない。

## 4. 投手・青/金Trait（09 `4：**元の判定を維持**）

| 作用分野 | Named Trait / Graded Family（MERGE・ADOPTなどは09参照） | 現実の発生Source |
| --- | --- | --- |
| Fastball | ノビG〜A／**怪童**、軽い球／重い球／**怪物球威** | movement/velocity retention/contact qualityの技術/物理 |
| Pitch shape | ジャイロボール／ハイスピンジャイロ、ナチュラルシュート、真っスラ、球速安定 | spin axis、恒常的movement、velocity reproducibility。Neutral Descriptor含む |
| Breaking/release | キレ○／**驚異の切れ味**、球持ち○／**ディレイドアーム**、リリース○ | 曲がり方/タイミング、extension、球種間フォーム差 |
| Command | 低め○／**精密機械**、内角攻め／**内角無双**、クロスファイヤー／**クロスキャノン** | target再現、release Geometryとzone technique |
| Dangerous miss | 一発／逃げ球／**本塁打厳禁** | 危険な甘い球が集まる、避ける精度（同一Family負・正・金） |
| Sequencing | 緩急○／**変幻自在**、奪三振／**ドクターK**、対強打者○／**主砲キラー** | 投球始動間合い、two-strike候補、相手別戦術。ball speed/Spinを直接Buffしない |
| Effort / fatigue | ギアチェンジ、全開／完全燃焼、力配分、根性○／**ド根性**、尻上がり／終盤力 | 本人の出力配分と実疲労・mechanical stability |
| Early-game readiness | スロースターター／立ち上がり○／**トップギア** | warm-up / early-game再現性、排他Family |
| Role / recovery | 回またぎ○、緊急登板○、火消し、ガソリンタンク、**鉄腕** | 通常Role Suitability / recovery / Condition Sensitivity。移動対象・候補有 |
| Running game | クイックG〜A／**走者釘付**、牽制○、対ランナー○、打球反応○ | motion/release times, pickup, fielding |
| High leverage | 対ピンチG〜A／**強心臓**、打たれ強さG〜A／**不屈の魂**、対左打者G〜A／**左キラー** | Emotion Appraisal, execution recovery, learned matchups |
| Other | 要所○、安全圏○、闘志／闘魂、威圧感／存在感 | 09ではPressure/心理/評判への統合・移動候補。無条件Match buffは禁止 |

**注意:** この表は元候補を見つけられるようにする**索引**であり、各Named Tierの採用確定や発動条件を一括承認するものではない。09 `4の`ADOPT/MERGE/MOVE/REINTERPRET` と最新版Refinementが最終的な判定。

## 5. 打者・走者・野手・捕手の青/金Trait（09 `5）

| 作用分野 | Trait family / 名称 | Source・区分 |
| --- | --- | --- |
| Contact | アベレージヒッター／**安打製造機** | contact precision / quality Descriptor。直接打率Buffでない |
| Long ball | パワーヒッター／**アーチスト** | POWER_SWING時のlaunch/transfer技能。Raw Powerの再加算なし |
| Direction | 流し打ち／**芸術的流し打ち**、広角打法／**広角砲**、プルヒッター／**引っ張り屋** | opposite / multi-direction / pull技術。PULL/CENTER/OPPOSITE意図の選択率ではない |
| Batted-ball descriptor | ラインドライブ | 実打球角度分布から派生するNeutral/Positive Descriptor、直接弾道Buff禁止 |
| Two-strike | カット打ち、粘り打ち、窮地○／ヒートアップ、リベンジ／逆襲 | late-contact technique, two-strike adaptation, learning |
| Zone/pitch | インコースヒッター／**内角必打**、アウトコースヒッター／**外角必打**、ハイボールヒッター／**高球必打**、ローボールヒッター／**低球必打** | 対応コースでの運動技能の再現 |
| Pitch recognition | 対ストレート○、対変化球○、初球○／**一球入魂** | 実際に球を認識・スイングする時刻/技術 |
| Bad-ball technique | **悪球打ち** | ボール球/窮屈な姿勢でも**狙ったバット軌道を保持**。Chase意思と独立、固定罰則なし。2026-10-14更新でBlue-Redから外す |
| Pressure | チャンスG〜A／**勝負師**、満塁男／恐怖の満塁男、サヨナラ男／伝説のサヨナラ男、決勝打／渾身の決勝打、逆境○／火事場の馬鹿力 | Pressureは既存Appraisal/ActiveEmotionとの因果一致が必要。状況同義語のFamily重複を避ける |
| Matchups/role | 対エース○／エースキラー、対左投手G〜A／**左腕キラー**、代打○／**代打の神様** | skill/matchup exposure/role readiness |
| Bunt/runner | バント○／**バント職人**、内野安打○／**ロケットスタート**、盗塁G〜A／**電光石火**、走塁G〜A／**高速ベースラン** | バント操作/first-step, lead/slide, route/decision |
| Fielder | 守備職人／**魔術師**、高速チャージ、送球G〜A／**ストライク送球**、レーザービーム／高速レーザー | first step/route, transfer/throw, true arm, descriptor |
| Catcher | ホーム死守／**鉄の壁**、ブロッキング、フレーミング○／フレーミング◎、キャッチャーG〜A／**球界の頭脳**、バズーカ送球 | physical tag/block/receiving, intelligence (7 domains), pop-time. 投手直接Buffは禁止 |
| Durability | ケガしにくさG〜A／**鉄人**、回復G〜A（ガソリンタンク候補） | injury resistance/recovery, same-source once |

**王貞治の再現特記事項:** 第一候補は **引っ張り屋（プルヒッターと同じFamily）**、広角打法保留。史実の右方向打球偏りはPULL Intent確率の直接実測ではない。高い選球眼/Powerだけで悪球打ち・勝負師・対左等を自動所持させない。個別の[王ケース](cases/sadaharu-oh-prime.md)を参照。

## 6. 緑Trait — 採用 / 排他 / Slow Preference

### 投手 Green 採用
`速球中心`、`変化球中心`、`テンポ○`、`投手調子安定`、`投手調子極端`。`投球位置左 / 右` は**Neutral setup**であって能力Buffではない。`投手調子安定/極端/鉄腕(Gold)`は同じCondition Sensitivity Family。

### 野手 Green 採用
`強振多用`、`ミート多用`、`積極打法`、`慎重打法`、`積極盗塁`、`慎重盗塁`、`積極走塁`、`積極守備`、`チームプレイ○`、`チームプレイ×`、`野手調子安定`、`野手調子極端`、`春男`、`夏男`、`秋男`。

排他Variant Family: `Swing Mode Preference`（強振/バランス/ミート）、`Plate Aggression`（積極/バランス/慎重）、`Steal Aggression`、`Team-play Preference`、`Batter Condition Response`、`Pitch Approach`（投手速球/バランス/変化）、`Pitcher Condition Response`。本人の指示の好みとマネージャー命令を合成し、Greenを一球で消したり永遠のBuffとして扱わない。

**Green不採用/他領域:** 選球眼は技能Ratingであり緑ではない。人気者はCareer/Presentation、フル出場は起用/Role、国際大会○はPressure context。方向のPULL率と広角技能は別、OBではその基礎好みも固定Profileの一部。

## 7. 青赤・赤（本当に再現対象にできる範囲だけ）

### 投手 Blue-Red
- `荒れ球`: 観測可能なpitch quality/movement上のbenefitと制球ばらつきcostの同時原因。予測困難が独立追加Buffではない。
- `全開 / 完全燃焼`: 高い出力と実疲労コスト。
- `力配分`: 出力を抑えることと消耗の抑制。
- `ゴロピッチャー/フライボールピッチャー`はNeutral batted-ball Descriptor、`ポーカーフェイス`は心理可視性。**Blue-Redではない**。

### 打者 Blue-Red
**正本09 v2026-10-14では悪球打ちはBlue-Redから除外済み。** 悪球打ち保持で自動Chase/弱打が増える罰則は禁止。`死球集中`もBlue-Redから外し、plate crowding/avoidanceのNeutral Behavior候補。

### Named Red / 負のFamily（投手）
- `一発`（Dangerous Miss negative）
- `軽い球`（Pitch Contact Quality negative）
- `四球`（実CommandとBehaviorから）
- `抜け球`（release失敗方向）
- `スロースターター`（Early-game Readiness negative）
- `寸前`（終盤・pressure等の因果原因を要検証）
- `短気`（Appraisal→anger/ActiveEmotion）
- `乱調`（一時制球・release variance）
- `ノミの心臓`（Pressure negative）
- `ボール先行`（Early-count Behavior Variant）

`シュート回転`はNeutral pitch shape、`負け運`はCareer Descriptor（Match Red禁止）、赤版`対ランナー`はSOURCE CONFLICT・保留。

### Named Red / 負のFamily（野手）
- `エラー`: pressure下の守備実行弱点、通常守備力を二重罰しない。
- `三振 / 扇風機`: two-strike adjustmentの弱点。
- `併殺`: Ground tendency +走力+状況から派生、併殺確率を直接増やさない。
- `ムード×`: **Team Chemistry/RelationshipへMOVE**、野手に恒久的な打撃能力マイナスを適用しない。

### 導入しない/別システムへ移すもの（例示は09 `9正本）
- `勝ち運 / 勝利の星 / 負け運`、`投打躍動 / 超投打躍動`、`ダメ押し`、`帳尻合わせ`、`意外性 / 大番狂わせ`は現状Match Traitとして不採用または保留。得点/勝敗を後付けで捏造するため。
- `ムード○ / 精神的支柱 / 人気者 / 威圧感 / 存在感` はSocial/Psychology/Reputation/Careerへ移す。相手能力・味方能力を直接変更しない。
- `ささやき戦術/ささやき破り`はCommunication/Psychology、`ホーム突入/重戦車`はRule依存、`ヘッドスライディング`はBehavior/Neutral等への移動対象。
- 単語があるだけで採用してはいけない。必ず09の`MERGE / ADOPT / REINTERPRET / MOVE / REJECT / CONFLICTED`を読み、最新の変更を優先。

## 8. Condition / Hidden Cognition / 心理・育成・再現性

| 状態 | 正本 | 発生/影響と禁止 |
| --- | --- | --- |
| `Condition`（試合前） | 08 ``15.12,15.21` | 当日の身体/技術発揮。初期案1〜5。ユーザーが口頭で述べた「1〜4 + 絶好調/スランプ」との段階定義は**まだ仕様整理が必要**。 |
| `CurrentFatigue` | 08 `15.36 | 現在疲労、Stamina/WorkCapacity/Recoveryと別。疲労→Condition悪化→疲労を再度加算しない。 |
| `ActiveEmotion` | 05 | 内部感情値は通常影響0。閾値を超えた場合だけ実際の判断/実行へ作用し、ユーザーに感情マーク。OBに隠れた心理Buffを追加しない。 |
| `Team Mood / Relationship` | 37/38 | 通常の集団心理変化は能力を直接変更しない。極端な状態のみAppraisal/Communication等。 |
| `Familiarity / KnowledgeEstimate` | 08/02 | 実際の対戦・スカウト情報から理解が変化。知らない技能を真値透視しない。 |
| `DevelopmentTrajectoryProfile` | 53 | VERY_EARLY/EARLY/NORMAL/LATE/VERY_LATE × SHARP_PEAK/BROAD_PLATEAU/STEPWISE_WAVES等、長期Career成長の真Source。**固定OBモードでは年齢による能力書換えをしない**。 |
| `SeasonExecutionContext` | [OB変動提案](SEASON-EXPRESSION-PROPOSAL.md) | もし当日Conditionだけで長期ブレを説明できなければ、長く続く実技術の噛み合いを検討。未承認の追加ScalarBuff禁止。 |
| `In-game “流れ”` | [議論だけ](../notes/2026-10-16-in-game-form-discussion.md) | 成績再現に便利だからと勝手に「試合中調子1〜4」を正式実装しない。 |

### 試合前の隠し知能を勝手にAIへ与えない

[打者BAT](../superpowers/plans/2026-10-16-batter-anticipation-intent-adaptive-swing.md)の`BatterPitchBelief`は本人の観測による主観的確率、`priorReliance / targetSelectivity / zoneChaseWillingness`は実態能力から独立。 [方向DIR](../superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md)は`directionCommitment / pull-center-opposite preference`と`REACTIVE`。 [捕手CATCH](../superpowers/plans/2026-10-16-catcher-game-intelligence-system.md)は7 cognitive source。**いずれも計画のみ**。

## 9. AIによる選手一人の再現フォーム — Source責任表

| 必須欄 | 期待値 | 見つからなければ |
| --- | --- | --- |
| Person identity / era / league / handedness / position | official facts + source/version | `UNKNOWN`、名前だけで身体配置を捏造しない |
| Season multi-year regular and prime performance | PA/AB別のHit/HR/BB/IBB/K、投手/守備詳細 | 不明年を除外した根拠を明記、安易な単年高値合成禁止 |
| True Physical / Cognitive / Technical sources | 上記`1–3`から使うものだけ | `MODEL_CALIBRATED + Uncertainty` |
| All Trait families | 本文`4–7`と09最新版の実在Family定義・Tier・証拠 | `NOT_GRANTED / UNKNOWN / NEEDS_REVIEW`。金/青/赤を勝手に増やさない |
| Green / Direction / Count / Style | 本人の観測可能な選択・長期傾向、適切な推定 | `UNKNOWN`と通常Prior。単年成績から全確定しない |
| Condition/Season/Role/Fatigue | 正史の試合条件と必要時の補完 | OB Frozen Sourceとは別状態 |
| Player projection (☆/0..100/G..S) | source→league rating→UI, versioned | 暫定表示`PROVISIONAL` |
| QA | 一般[REC-01..14](METHOD-V1-PROPOSAL.md)と後続ENV/ATTR校正の結果 | `NOT RUN` / `NOT CONNECTED` |

**結論:** 「使用できる能力・得能がすべて見つかる」ようカタログへの入口を作る。ただし**名称を全部付けて最強選手を作る部署ではない**。一次資料と観測された技術のSourceから、必要なものだけ再現する。登録年・ファミリーのMaster/Red/Greenは**一つの技能の複数表現を二重にMatchへ返さない**。
