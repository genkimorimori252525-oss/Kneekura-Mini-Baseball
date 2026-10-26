# Kneekura Mini Baseball — 選手由来シグネチャー得能・リーグ文化生成 実装計画 v1

> **2026-10-26 本人回答で実装段階を確定:** このSIGN v1とSPIN v2が依頼対象の2計画であることは確認済み。同じ対象確認を繰り返さない。SIGNの自動認定・自動名付け・Career文化生成は**ペナント実装時**に行う。現在の実装はSource分離・公式context Evidence・凍結ID/時刻/表示契約などの**基盤のみ**であり、自動名付けを現在のgoal完了条件に含めない。本人がペナント実装を依頼した段階で後半の認定・命名を進める。名称から物理/真能力へのBuff禁止とDRAFT32の個別fenceは維持。[範囲確定の判断記録](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6412388620)。

> **作成:** 2026-10-26 (JST)  
> **状態:** **USER-APPROVED DESIGN DIRECTION / FUTURE IMPLEMENTATION PLAN / NOT IMPLEMENTED**。本会話で確定した趣旨をまとめる計画。アルゴリズムの閾値、校正係数、名称デザイン、UI詳細、史実選手の扱いは未Freeze。  
> **対象:** `genkimorimori252525-oss/Kneekura-Mini-Baseball`。長期ペナント／現役選手／引退後の歴史／後継者。Mini/Natural共通のWorld-first Match Coreを変更せず利用。  
> **文書Branch:** `jolly/core-foundation-plan-2026-09-17`（監査開始時のGitHub HEAD: `ef0e516a32d3e810039ea229720f526592457773`）。PCの未push変更・並行実装はこの監査からは不明。  
> **優先関係:** 本書は承認済みの**将来方向と実装計画**であり、既存CANONICALを黙って上書きしない。個別の試合仕様、Trait Family、Development、Star称号のSource of Truthは既存正本にある。すでに実装された証拠ではない。

## 0. ゴール：ペナント自身が、新しい野球文化を生み出す

**まれにしか現れない選手の、突出した複合技能・身体能力・本人固有の判断・実際の成績が、長期にわたって一つのプレースタイルとして認識される。現役中でも野球界が本人の名前を冠した「シグネチャー得能」を生み、後世にその歴史と技術が残る。**

1. 名前付き得能は**史実名を事前登録するガチャ景品でも、Goldの単純な上位階級でもない**。当該セーブ世界で選手のCareerから新しく誕生する`World-owned Signature`。
2. **金特一つ、得能一つ、単純な能力値の高さ、多数の得能を持つだけ**では絶対に命名されない。高水準の**複数の独立した原因**、突出した組合せの独自性、長期の実行・成績、社会的な認知が必要。
3. 新しい名前に多数の重複得能を「統合表示」できる。ただし**基礎Skill・習得Source・独立した効果・各Familyの正しいLifecycleは消去しない**。同じ原因のBuffは一度だけ。
4. その選手の**実際に確認された状況別の特徴**（走者なし、走者あり、カウント、球種・守備配置、局面など）を固有得能の説明・効果に織り込める。ただし成績の相関から「走者なしならパワー+10」を後付けすることは禁止。
5. 条件付きのプレーを起こす**真正の状況別Policy・技能・運動・情報処理**がすでにあるなら、それを名前付き得能にまとめて表示する。独立した新技能が実際に習得された場合に限って`53`のSource変化→定着→認識を通す。**命名イベント自体はスキルを増やさない**。
6. **現役中の認定ができる。** 引退・殿堂入り・Superstar認定は必要条件ではない。一方、現役で付いた称号と後世の`Legacy`は分離する。
7. 希少性は**ポケモンの色違い級の「滅多に出会えない」体感**を目指すが、1試合ごとの`1/4096`抽選や「各年代に一人」の定員制度は採用しない。観測Evidenceの多段階Gateと長期Soakによって**結果として希少**にする。
8. 同じ名称の人物、改名、移籍、現役中の浮き沈み、何百年後の後継者にも耐える**不変ID・時刻・世代・定義Version・証拠**を残す。
9. AIのスカウトや他選手は、未来の真能力を知って「この人は命名予定」と判断できない。世界が知った**当時までの観測**から評価する。
10. 表示は**一見シンプルだが奥深い**。通常はひとつの名前付き得能と短い説明、詳細を開けば内訳・認知の経緯・条件別傾向・習得系譜を読める。ユーザーへ膨大な手動査定を要求しない。

## 1. 既存CANONICALとの接続

| 既存Source | 本計画との関係と非重複の境界 |
| --- | --- |
| [Trait Catalog 09](../../game-design/09-player-trait-catalog.md)、[Trait Seed 08](../../game-design/08-player-traits-design-seed.md) | Traitは真のCauseの投影。同一Family排他、`GRADED_DYNAMIC`／`LEARNED_MASTERY_PERSISTENT`／`GREEN_SLOW_PREFERENCE`／`DYNAMIC_DESCRIPTOR`などのSource/Lifecycleを維持。**新しい名前で同じ効果をもう一度かけない。** |
| [Development 53](../../game-design/53-player-development-trajectory-breakthrough-v1.md) と[Adversarial Audit 54](../../game-design/54-player-development-breakthrough-adversarial-audit.md) | `RECOGNITION`と`DEVELOPMENT`を区別。発見→仮説→反復→定着、時刻とSourceの証拠を保持。命名は主に**Career Recognition**であり、本人の技能の発生時刻より後。`53`のhidden `signatureMotifs`はCatalyst傾向であり、本計画の**名前付き得能を意味しない**。 |
| [Star/Superstar 51](../../game-design/51-star-superstar-big-stage-architecture-DRAFT.md)、[Genesis 52](../../game-design/52-star-superstar-genesis-v1.md) | Star/Superstarは競技的・社会的な称号。**名前付き得能はその下位Tierでも上位Tierでもなく、突出したプレースタイルの独自性を示す別軸**。高い競技価値・認知は必要だがStar/Superstar真偽だけで付与しない。 |
| [Simple Surface, Deep Simulation 20](../../game-design/20-simple-surface-deep-simulation.md) | 世界内部の詳細な検証を操作画面へ全部露出させず、選手カードとリーグ史のシンプルな説明へ投影。 |
| [BAT](2026-10-16-batter-anticipation-intent-adaptive-swing.md)、[DIR](2026-10-16-batter-directional-intent-and-spray.md)、[SWG](2026-10-26-batter-swing-capacity-intent-context.md) | 打撃Intent／認識／運動の正史を再利用。シグネチャー表示のため別の打者AI、バット物理、安打率エンジンを作らない。 |
| [SPIN-GOLD v2](2026-10-26-rare-intentional-batted-ball-spin-mastery.md) | 落合型の複数の回転操作技術は**独立して習得した真の技能**。名前付き得能はその実在する熟達や他の特徴をさらに社会的にまとめたもの。Gold一つの所有だけでは命名不可。 |
| [Manager 49](../../game-design/49-manager-architecture-v1.md)、[Roster 32](../../game-design/32-roster-development-architecture-DRAFT.md) | 監督方針と本人のSlow Preferenceは別。チームを離れても本人の技能史は消えない。成績・出場機会は所属／リーグ／時代に条件付けて評価。 |

**責任の切り分け:** `Match Core`が実動作・物理・公式結果を決定し、`Career/Statistics`が確定した結果を集計し、`Recognition/World History`が得能の名称・認知・継承史を生成する。Historyから過去のMatch結果へ書き戻さない。

## 2. 「技能」「得能」「シグネチャー」「継承」を区別する

| 層 | 役割 | できないこと |
| --- | --- | --- |
| **Underlying Source** | バット操作、守備位置判断、走塁初動、技術習得、打席別判断、身体能力等の真の原因 | 選手カードの名前や称号から逆算して強化 |
| **通常の得能** | Sourceの技能・状況特性・Preferenceを単位別に投影 | 同じ原因を何種類ものBuffにする |
| **名前付きシグネチャー得能** | 少数の例外的な選手に成立した**複数Causeの独特な組合せと統計的特徴をまとめて命名** | Gold・元得能への加算Buff、独立エンジン、命名だけによる突然の能力獲得 |
| **Historical Legacy** | 創始者のID、認知の日時、プレーの定義、記録、後継者の習得系譜 | 引退時の自動削除、過去対戦結果の再解釈 |

### 2.1 重複得能の「合体」はSourceではなくPresentation / Recognition上で行う

- 既存得能AとBが同じSkill Sourceに由来するなら、元Ownerの`09`で決めたFamily排他・合併規則を優先する。
- 原因が独立する複数の得能は**内部では併存**し、名前付き得能に`coversSourceRefs`として関連付ける。UIだけ、既存得能のうち**名前付き得能が包括するもの**を折りたたみ表示してよい。詳細で元のFamily／精度／習得時刻を復元可能にする。
- 含まれない能力（例：球速、故障耐性、別の守備技術等）は無関係に隠さない。技能の検証・練習・移籍後の評価・引退後の再計算を壊さない。
- 2種類以上の条件効果が**同じ原因**から生まれたときは、`effectOwnerKey`／`sourceEffectIdentity`を使って**1回だけ**実行する。名前付き得能＋元Gold＋元Blueで三重加算するバグを禁止。
- `SignatureDefinition`はFrozen版と原因Source参照を持つ。元得能の機能・TraitDefinition Versionを黙ってマージ・削除しない。

### 2.2 一人だけの非常に独特なプレーであっても、単一技術からの自動命名は禁止

必要な証拠の種類は**技術・身体能力・判断・行動方針の複数の独立要因、条件別の因果的プレー差、継続的な競技実績、他者との比較、社会的な認知**。複数の得能の名前が必要十分条件ではなく、正史で別々に働くSourceを確認する。

- 「ミート100になった」「金特を1つ取った」「新技術を1つ身につけた」だけでは命名しない。
- 「金特を5つ持つ」だけでも命名しない。似た原因の寄せ集めや、当該プレーに独自性がなければ不適格。
- 反対にGoldが0個でも、**複数の独立した異常な能力・判断・高精度な技能の組合せと継続実績**が揃う極稀な選手は候補になれる。
- 他選手が同じ結果を出しても、異なる運動・技能で達成したなら同じ技術と決めつけない。

## 3. 状況別成績を、根拠ある「その選手らしい効果」に変える

例：「走者なしでは長打を狙う比率が高い／走者ありでは狙いを変える／バットと走塁を素早く切り替える」等の**実際に成立している条件付き方針・技術の組合せ**を、名前付き得能の説明と効果一覧に反映する。

### 3.1 観測数字は発見の入口であり、Buffの根拠そのものではない

- `basesEmpty`、`runnersOn`、`twoStrikes`、球速帯、左右、打点深さ、球種、守備配置、点差、投球前の主観予測等、**試合時に存在するContext**を条件として使う。事後の「この打席がHRだった」等は条件にしない。
- 公式成績だけでなく、行動選択・バット速度・軌道・打点・反応・守備・走塁の**時刻付き中間Evidence**を使う。試合時に本人・監督が利用可能だった情報と区別する。
- 単一シーズンの「走者なし打率.400」のような差は、球場、相手投手、球種、左右、守備、時代平均、十分な打席数、選択効果を補正。**強い成績差が本人の方針・実行技能の違いか、偶然か**を識別する。
- 何百通りもの条件を探索すると偶然の外れ値が出る。条件探索の自由度を制限し、検証用の別期間・別相手による**out-of-sample**の再現を要求する。異常結果一度では条件効果にしない。
- ある条件で**独立した運動・認知能力Source**が実際に改善したことが証明されれば、`53`のDevelopmentで真技能を更新。単なるRecognitionなら**既存Sourceの働きを説明するだけ**で、命名で追加の真能力値を付与しない。

### 3.2 名前付き得能の条件効果は「オーナー付きの因果説明」

| 表示文言の例 | 実際のGame Coreで生じること | 禁止 |
| --- | --- | --- |
| 「走者なし：長打を狙う打撃傾向」 | 本人の条件付き`SwingApproachPolicy`が、この場面で実際に長打型のMotor目標を選びやすい。物理制約と接触結果はそのまま | `basesEmpty => power += 10` |
| 「走者あり：コンタクト重視へ切替」 | 習熟した本人の状況別Intentがコンパクトな軌道候補を選ぶ。全打者がそうなるわけではない | 「走者あり⇒安打確定」 |
| 「打撃直後の一歩が異常に速い」 | 真のbat-to-run transition/加速Sourceが短い移行時間を実現 | 「内野安打率＋20%」 |
| 「追い込まれても独特の打ち分け」 | 真のBelief・timing・Motorの再計画、方向・回転制御源が条件内で働く | 「2ストライク⇒成功判定を改変」 |
| 「特定の守備配置に適応」 | 見えている守備位置と本人のIntentから実打球運動を選ぶ | AIが観測していない裏の配置や未来の正解を読む |

**原則:** エフェクトは**既に存在するCauseの適用領域・複数技能の相互作用の説明**。実行Source側に識別可能な新規相互作用が必要なら、`source-owner`で独立した技術・意思能力として検証・学習済みの変更を先に成立させる。`namedTraitActive=true`や「効果文言」は正史に入力しない。

## 4. 発見から命名まで：現役中に成立する6段階

1. **発現／形成:** 本人の身体、既存技術、育成による習得、珍しい判断・フォームが、競技の通常の因果経路で組み合わさる。デビュー時に「後で名前付きになる運命」という`predestined Signature flag`は付けない。
2. **観測と候補化:** 打席・守備・走塁のSource履歴と成績から、一般のTrait Familyだけでは簡潔に表現できない独自パターンを、Career Analystが**後から**発見する。発見自体は`PRIVATE CANDIDATE`でありまだ公認ではない。
3. **独自性の照合:** 時代、リーグ、球場、出場位置、投手/打者環境、過去世代と比較し、複数の独立原因に基づく新規性を確認。類似選手の単なる上位互換ではなく、プレーの**組合せ**が特徴的か評価する。
4. **持続・再現性の検証:** 偶然の好調、サンプル不足、短い連勝を除外。**複数の時期と多様な相手で**一貫したプレーを示す。検証窓長と例外は要Calibration。
5. **リーグ内の認知と命名:** 選手・指導者・報道・ファンの、その時点までの観測に基づく評価が蓄積。**現役中でも**十分な証拠が揃えば命名してよい。本人の名が表示名になるが、`playerId`がシグネチャーの不変な起源を決める。
6. **歴史化・継承:** 認知日・確定定義・元Skill Sourceの証拠・当時の成績・所属・社会的な経緯をEvent Logへ刻む。引退後もLegacyに残り、指導・模倣・再発明による後継者は`53`に従って**一部の技術を実際に習得**できる。名を冠した本人の全能力がコピーされるわけではない。

**現役中の表示:** 認定した瞬間、その時点以降の選手カード・新聞／ニュース／リーグ史に称号を表示。**認定以前の試合にその名称を遡及記入しない**。引退前提の「殿堂」待ちを設けない。

**失速時:** 認定済みの歴史は残る。一方「現在もそのスタイルを同じ水準で実行できる」という説明は、加齢・怪我・真Source状態から再評価する。`CURRENT EXPRESSION`と`HISTORICAL LEGACY`の2軸を持つ。原理なく名前を取り消したり、衰えを無視して永遠に強くしない。

## 5. シグネチャーの希少性：色違い級、ただし抽選ではない

**希望する体感:** 長期プレーで忘れられない極少数の選手にしか出会えない。何十年も誰も現れないセーブ、数世代目に初めて生まれるセーブ、例外的に同時代の二人が現れるセーブのいずれも成立。

- **初期校正の参考帯:** `おおむね数千選手キャリアに一件前後、ないしそれ以下`という稀さを候補とする。これはユーザーの「色違いポケモン級」の**体感目標**であって、確定発生率でも「全員1/4096の抽選」でもない。実測Soak後に調整。
- **母数:** 生涯シグネチャーを実際に認定されたUnique Player / 一定条件のPro Career cohort。稼働選手やSeason回数を混ぜて頻度を高く見せない。追加で`per player-season`、現役同時人数、世代別分布も報告。
- **希少性の原因:** 複数の独立したSource、出場機会、長期実績、Context別パターン、社会的認知、比較集団での突出性、復元可能な裏付けが**同時に満たされること**。一回のランダム抽選、固定確率乗算、同時保有者定員、必須時代補充、Team枠は使わない。
- **年代補正:** 弱いリーグの相対トップというだけでは超希少扱いしない。絶対技能・同時代との比較・競技価値・他リーグでの評価不確実性を別々に扱う。
- **超能力化禁止:** 類似の能力を複数持つだけ、長期育成で得能数が増えるだけ、毎年活躍するだけで最終的に全員取得することはCalibration Failure。
- **社会的認知の独立性:** 真技能の高さと「そのプレーが名前になるほど認知されたか」は別。あまりに短い一軍活動、露出不足、記録の少なさ、世間に伝わらない特殊技術は、たとえ能力が凄くても認定されない場合がある。
- **再現テスト:** 100〜300年以上・多数のCareer Seedで`zero occurrence`も観測、Goldの乱発・得能収集インフレ・既存Star／Superstarとの相関・海外移籍・同一人物の重複認定を検証。校正は閾値とEvidence品質で行い、人口に合わせた強制出現数を置かない。

**希少なだけでは不十分:** 名前付き得能の登場によって、選手の人格や野球史を知りたくなる**説明可能性と記録の奥行き**を成立させる。

## 6. 新しい能力の誕生と「後継者」を混同しない

- **Origin:** `signatureId`と`originPlayerId`を世界史へ登録。同姓同名の別選手でもIDが違えば同じシグネチャーではない。認定時の`displayNameAtRecognition`を固定し、改名・移籍・引退で名の由来が変わらない。現代の表示名・別名はAliasとして管理。
- **Definition:** 「元選手の技能と状況別パターンの何が特別だったか」を`SignatureDefinitionVersion`として凍結。名称は説明だが、定義は原因Sourceと検証済み証拠に結びつく。
- **Transfer:** 後継者は練習・直接指導・記録研究等の機会から、**技術Sourceを実際に新たに身につけられた範囲だけ**継承。「高瀬の後継者」と呼ばれても元本人の全Skillや生涯成績はコピーされない。
- **Naming:** 模倣者は`INHERITED_STYLE`／`STUDENT_OF`等の来歴を表示してもよい。**創始者の同名技術が一般化しただけで、各後継者の新しい個人名得能を量産しない**。完全に異なる複合プレーの確立・高水準の実績・社会的な新規認定がある場合だけ別名の創出候補。
- **History:** 複数の人物が同じ手法を独立再発明したら、史料に基づき`INDEPENDENT_DISCOVERY`とし、過去人物の技能を奪って名前を書き換えない。
- **UI/検索:** 登場年、誰の名に由来するか、レパートリー/効果の内訳、印象的なSeason、現在の継承者、年代別記録を確認できる。由来を同姓同名の現役へ誤帰属しない。
- **史実モデル:** 実在選手名を使う場合は個別に実際の競技Evidenceと表示権利等を確認する。`「イチロー」`は**構造を考える参照例**であって、現時点で本ゲームに本人の新能力を自動付与する確定指示ではない。

## 7. アーキテクチャ：動的定義を独立したWorld Registryに保存

以下は**概念上の契約**。実際のSource Owner、データ型、最適化APIは実装着手時に既存システムから選び、同じ台帳を重複作成しない。

```ts
type SignatureId = string; // career/world-safe, immutable
type NamedSignatureEvidence = Readonly<{
  playerId: string;
  evidenceTimeRange: readonly [number, number];
  evidenceEventRefs: readonly string[];  // accepted World/Career events
  independentCauseSourceRefs: readonly string[];
  traitFamilyRefs: readonly string[];
  contextualComparisons: readonly {
    contextKey: string; // e.g. 'bases_empty'
    exposureCount: number;
    observedPattern: string; // versioned, sourced analytic digest
    physicalOrDecisionOwnerRef: string | null;
    confounderReviewRef: string;
    outOfSampleReviewRef: string;
  }[];
  eraLeagueComparisonRef: string;
  publicRecognitionEvidenceRefs: readonly string[];
}>;
type NamedSignatureDefinition = Readonly<{
  signatureId: SignatureId;
  originPlayerId: string;
  displayNameAtRecognition: string;
  recognitionAtDay: number;
  definitionVersion: string;
  coveredSourceRefs: readonly string[]; // no ownership transfer
  coveredTraitFamilyRefs: readonly string[];
  contextualEffectOwnerRefs: readonly string[]; // read-only references
  evidenceDigestRef: string;
  statusAtRecognition: 'ACTIVE_PLAYER' | 'RETIRED_PLAYER';
}>;
```

**Event-chain:** `CANONICAL_MATCH_EVENT → CAREER_AGGREGATION → SIGNATURE_CANDIDATE_REVIEW → SIGNATURE_RECOGNIZED → WORLD_LEGACY_LOG`。登録前に過去Eventを静的参照する。`SIGNATURE_RECOGNIZED`は**成績・投球選択・身体能力を変更する書き込みではない**。

**実行Boundary:** Match Consumerは、`NamedSignatureDefinition`を入力しなくても同じ試合を再現できなければならない。実際の技術・方針・Source参照は、本人の本来のSource Ownerだけが実行する。`contextualEffectOwnerRefs`は効果の説明・監査と重複防止のためのリンクであり、実行指令や追加倍率ではない。

**性能:** すべての投球・打球フレームで全キャリアの希少判定を回さない。通算・Season単位で条件別Aggregateを継続保存し、命名候補のみ精査し、`CareerEvent`への保存と重いレポート生成を分ける。年表・統計はVersioned Aggregate＋Checkpointを用い、数百年Saveのメモリと時間を計測。

## 8. 実装計画（段階的・非visualから進める）

### Task A — Source/Status 監査・責任者決定
- [ ] 実作業ツリー、ローカル未push変更、並行PR/Workflowを確認。`09/20/51/52/53/54`と受理済みWorld Event、統計Owner、Career Event、Trait投影の既存接続を調査。
- [ ] `Star/Superstar`、`覚醒`、`Gold`、`本人署名`を別ID・別責務へ分ける。Hidden`signatureMotifs`との名称衝突も監査。

### Task B — 再現可能な統計・状況別Evidence
- [ ] 試合結果（公式成績）と前段の判断・Motor・技能Sourceの時刻付き証拠を所有者から得る。母数、Opponent/League/Era/Park条件、変数選択、サンプル不足、分散と不確実性を保存。
- [ ] `basesEmpty`等の既知Contextに加え、事後スコア・未来情報を候補選択の説明変数として流さない。条件探索の多重検定と別期間検証を用意。
- [ ] 生のEvent大量永久保存を強制せず、必要な精密Evidenceは参照可能なArchiveへ。Aggregate・proofが欠けた場合は`UNVERIFIED`。

### Task C — Signature Candidate / Recognition Policy
- [ ] 複数独立Cause＋希少な組合せ＋継続実績＋広範な比較＋社会的認知を合わせた`Eligibility`。金特1個や単なるTrait個数で認定できないテストを先に作る。
- [ ] 認定は現役中も可能。習得した日／条件付きの実プレーが成立した日／認知され命名された日を区別する。人数を強制補充しない。
- [ ] 過去/未来・当日の主観知識・監督への公開範囲を守ったWorld-side検証。Recognition失敗も記録可能。

### Task D — 1名前に重複得能を集約（物理Buffなし）
- [ ] 既存各Trait Familyの`sourceEffectIdentity`を通じて、同じ原因を二重評価しない`SignatureDisplayProjection`を実装。**Source削除やGoldと別の倍率効果を増設しない**。
- [ ] 条件別の説明は実在する`effectOwnerKey`／能力Sourceへリンクし、元得能と名前付き得能の同時存在時も同seedのMatch結果が不変。
- [ ] 独立した新技能が本当に発生した場合は、`53`の別Source成長・認定・Matchテストを先に通し、Signature名を理由に付与しない。

### Task E — Career保存・歴史・現役表示
- [ ] 同姓同名／改名／移籍／複数世代／退団／引退／記録消去不可事件に強い`signatureId`、Frozen定義、認定Eventを作る。
- [ ] 通常は1行の「選手名」＋効果の要点＋詳細ドリルダウン。登場時にCareer Newsを作り、ペナントの年表・記録室から追えるようにする。
- [ ] 後継者の実習得は`53`の独立過程。創始者の全技能Copyや名前だけの伝承Buffは禁止。

### Task F — 超希少性・歴史の密度をSoak校正
- [ ] 多数Seed、100〜300年以上、キャリア数千〜数万規模で命名率／ゼロ世代／同時重複／稀な複数例／選手属性バイアス／強さと独自性の差を監査。
- [ ] 1/4096試合抽選、Teamごと定員、時代補填を禁止。希少体感を満たさず高頻度ならEvidence Gateの品質を調整。
- [ ] 長期保存容量、復元時間、コンディション別集計負荷、Headless/描画FPSによる正史不変を計測。

### Task G — 敵対レビュー・検証と版管理
- [ ] 物理/得能/Star/名誉史の二重Source、偶然の成績差を技術と誤認、時代を跨ぐ見せかけ独自性、名前の大量発行などを敵対監査。
- [ ] 実テストは`PASS / FAIL / NOT RUN / NOT CONNECTED`を区別。単にMDをコミットしただけで実装済みとしない。
- [ ] 将来`09`や`51/52/53`に変更が必要な場合は、当該CANONICALの版・必要Source修正を明記してから更新。本文書だけで無断に仕様を置換しない。

## 9. 受け入れ試験 SIGN-01〜SIGN-38

| ID | 合格条件 |
| --- | --- |
| SIGN-01 | 金特1個・得能1個・高能力値1個だけでは命名不可。 |
| SIGN-02 | Goldが複数あるだけ・Trait数が多いだけでも命名不可。 |
| SIGN-03 | 複数の独立原因（技能／身体／行動／判断）と継続実績を持つ例は候補になれる。 |
| SIGN-04 | Gold未取得でも、十分な独立Cause・競技価値・認知がある極稀な例は候補になれる。 |
| SIGN-05 | 同一Sourceを複数Traitとして水増ししても独立原因数が増えない。 |
| SIGN-06 | Candidateは命名済みTraitではない。未来の名誉を選手の真能力へ注入しない。 |
| SIGN-07 | キャリア前半の偶然の好成績だけで即命名しない。 |
| SIGN-08 | 走者なし／走者ありの成績差はサンプル・投手・球場・時代・左右等の影響を検査。 |
| SIGN-09 | 大量のContext切り分けによる偶然の外れ値は別期間検証で除外できる。 |
| SIGN-10 | 特徴的な成績があっても、原因となる実行Policy/技能Sourceがなければ新たな結果Buffなし。 |
| SIGN-11 | `basesEmpty`時の狙いの変化は元のSwingApproach Sourceが決め、名札から`power +10`を作らない。 |
| SIGN-12 | 非認定時と認定後で、真のSource・seed・状況が同一なら接触／打球／得点不変。 |
| SIGN-13 | 重複するTrait表示を折りたたんでも、内部Source／全Lifecycle／再学習記録は保持。 |
| SIGN-14 | 既存Gold＋元Blue＋名前付き得能による二重／三重効果がゼロ。 |
| SIGN-15 | 名前に含まれない独立した技能は誤って非表示・削除されない。 |
| SIGN-16 | 同じ能力原因でも違う表示言語・Trait名によりゲーム結果が変わらない。 |
| SIGN-17 | 本人の名が現役中にも認定・表示され、引退まで待つことを強制しない。 |
| SIGN-18 | 本人が現役引退／能力低下しても歴史上の認定記録は保持。 |
| SIGN-19 | 歴史的創始者の能力記憶と現在の身体能力を混同しない。 |
| SIGN-20 | 認定日に初めてラベルが現れ、過去試合の当時表示／Replayが遡及変更されない。 |
| SIGN-21 | 改名・移籍後も起源は`originPlayerId`で固定される。 |
| SIGN-22 | 同姓同名の別人／次世代選手の`signatureId`は混同されない。 |
| SIGN-23 | 「高瀬」が生み出した技能を別人が学習しても、本人と同じ全能力を獲得しない。 |
| SIGN-24 | 後継者の継承は`53`の練習・証拠・定着を通り、単なる「弟子」ラベルではBuffなし。 |
| SIGN-25 | 後継者が一部を獲得しても創始者のSignature定義／Originを奪わない。 |
| SIGN-26 | 実際のNew Styleが他選手へ広まっても、名称が無条件に人数分新しく生えない。 |
| SIGN-27 | Star／Superstarそのものの取得と名前付きシグネチャーの認定は別。 |
| SIGN-28 | Starでない選手が名前付きになれるなら、独立要件の稀な実力・認知Evidenceが必要。 |
| SIGN-29 | 300年等の歴史で何十年もゼロ件、同時代に例外的に複数件があることを許す。 |
| SIGN-30 | 数千Player Careerに対する認定率を実測し、Season回数で水増ししない。 |
| SIGN-31 | いかなるSeedにも「必ず何人か認定」の世代／Team quotaがない。 |
| SIGN-32 | 年齢上昇／長期ペナント継続だけでは万人が順番に名前付きにならない。 |
| SIGN-33 | 既存`09`のGoldや`53`の技術習得を上書きせず、認定はCareer ownerが行う。 |
| SIGN-34 | Player本人／AIはその時点で未認知の候補や、未来の認定真実を読めない。 |
| SIGN-35 | セーブ・リロード・多世代Replay後もFrozen定義・Event時刻・能力Source参照が一致。 |
| SIGN-36 | 数百年SaveでもboundedなAggregateとCheckpointで過度な再計算／メモリ増を避ける。 |
| SIGN-37 | Mini/Natural/FPS/観客用UIから認定率や実際の試合結果が変化しない。 |
| SIGN-38 | 年表の見た目、歴史的名称の誤表記、統計Archiveの不足を実装成功と偽らず`NOT CONNECTED`にできる。 |

## 10. 敵対監査：この設計を台無しにする失敗

| リスク | 禁止する短絡 |
| --- | --- |
| **名前の強制付与** | 「3年連続首位打者だから名前Trait」「Goldが5つあるから認定」。必ず多面的な独立原因・成績・認知を確認。 |
| **秘密のガチャ化** | 毎試合`roll(1/4096)`、強運でCandidate生成、通常選手の固有化をRNGで後付け。 |
| **結果からCauseを逆生成** | 「走者なしの本塁打が多かったから走者なしパワー+10」を付与して次季さらに本塁打が増える自己増幅。 |
| **同じSourceの複利** | ミートSrc→青効果→Gold効果→名前効果の3重適用。Source Effectsは一度のみ。 |
| **過剰な条件発見** | 球場、月、左右、点差、球種、走者などを無数に探索して都合の良い有意差だけ採用。Holdout必須。 |
| **歴史を汚染** | 命名時点より前の試合・年表・過去の選手カードを上書きしてその名称を遡及所持させる。 |
| **スターの別名化** | Superstar=trueならNamed=true。逆にRare Nameで突然Superstar認定。両制度の責任を守る。 |
| **継承による増殖** | コーチが教えた瞬間、弟子に無条件で「高瀬」が付く。技術を自分で習得した量だけ残す。 |
| **長期Save破綻** | 300年×全試合の全Context組み合わせを毎描画で再計算。Season aggregation＋Evidence索引で圧縮。 |
| **史実人格の捏造** | 歴史資料の成績だけから本人の全身運動・主観Intentを真測定値として決定する。出自・不確実性を明記。 |

## 11. 完成の定義と実装非対象

**完成:** 当該セーブ世界の現役選手が、**複数の実在する原因技能と長期の特異な実プレー**を根拠に、極めて稀に自分の名前を冠した得能として認定される。名前は内包Traitを重複なく統合表示し、走者なし等の条件付き特徴は真正の原因Sourceへ結びつき、保存・引退・後世の継承でも野球史の一部として残る。**表示・認定イベントが試合物理や結果を二重に強化しない**ことが合格条件。

**今はしない:** 自動名付けのコード実装、勝率・本塁打率への直接的な魔法補正、実在人物の決め打ちハードコード、固定`1/4096`入手抽選、人数Quota、過去のSource正本の破壊、メディアによる無条件Star化、背景処理をUI操作の義務にすること。

**最終原則:** **「その選手の名を持つから特別になる」のではなく、「その選手が実際に特別だったから、その世界の野球界が後から名を与える」。その名が現役中に生まれ、数百年後のペナントでも生き続ける。**
