# Batter Anticipation, Intent & Adaptive Swing — 実装計画 v1

> **日付:** 2026-10-16（JST）
>
> **状態:** USER-APPROVED DIRECTION / IMPLEMENTATION PLAN / NOT IMPLEMENTED。打者の「予測と狙い」「実際に振る意思」「振り始めてからの対応」を分離する方向はユーザー承認。内部数値・映射式・動作制約は未Freezeで、検証を経て校正する。
>
> **リポジトリ:** `genkimorimori252525-oss/Kneekura-Mini-Baseball`
>
> **主作業ブランチ:** `jolly/core-foundation-plan-2026-09-17`
>
> **監査したBranch HEAD:** `664cad5b46af1575e91debef827c49aed982f9d1`（2026-10-16）。実装着手前に再確認。
>
> **対象:** Mini / Natural 共通の因果的 Match Core。描画専用のスイングアニメーションや結果後付けエンジンを新設しない。
>
> **所有関係:** 前計画 [Catcher Game Intelligence System v1](2026-10-16-catcher-game-intelligence-system.md) の `Task E / BatterPitchBelief` を具体化する伴走実装計画。二つの別々の `BatterPitchBelief` を作らない。`09-player-trait-catalog.md`・`49-manager-architecture-v1.md`・既存物理/正史契約を優先する。

## 0. ユーザー要求と到達目標

現実の打者には「狙い球を絞る」人も「次球を予想はしても投球軌道を見て柔軟に反応する」人もおり、両者に先験的な優劣はない。ストレート75％・カーブ25％などは打者の主観的な次球予想であり、相手バッテリーの内部の真の投球確率ではない。

要求:
1. 球種、コース（左右・高さ・ゾーン境界/外側）、球速帯、球道、テンポの**結合した主観的予測**を持つ。
2. 同じ主観的予測でも、事前に狙いを固定して準備するか、投球を見てから軌道へ対応するかは打者の**行動スタイル**と当該局面での意図により変わる。ミート・パワー・リーグ基準値と直結させない。
3. 狙った球が来た場合は準備が間に合い、良いバット軌道を実行できる余地が増える。ただし「予想が当たればミート率+X」の結果補正にしない。
4. 外角際どい球を想定していたのに中央へ来る等の極端な予想外では、良い球でも判断/姿勢の切替に間に合わず見逃し得る。一方、反応力と動作修正が十分なら想定外の球へ対応し、接触/強打し得る。
5. スイング始動後にも時間・姿勢・身体運動に**現実的な修正可能範囲**を設け、時間的な再調整、空間的なバット軌道修正、振り止め/ハーフスイングを表現する。アドリブだから必中/ヒット保証は禁止。
6. ボール球を追いかける意思（積極/慎重）と、ボール球を見極める技能（選球眼）と、ゾーン外へ実際にバットを届かせ制御する技能（悪球打ち等）は別に扱う。
7. 現在の公開能力 `ミート / パワー / 選球眼 / バント` と既存のGreen・Blue/Gold Traitの**下位にある原因技能**を再利用する。新しい見せかけの公開能力・得能・謎の一律確率Buffを増やさない。
8. バッテリーもこの打者の傾向を観測情報から推測し、捕手・打者それぞれが相手の次手を考える。捕手は打者の真のPrivate Beliefを読まない。

## 1. 軽量監査の結論

| 既存の正本/実装 | 確認できた内容 | 本計画の扱い |
| --- | --- | --- |
| `docs/game-design/02-rules-ratings-defense.md` `4.0–4.4 | 打撃公開能力はミート/パワー/選球眼/バント。打撃隠し査定としてゾーン認識・スイング判断・芯に当てる精度・方向適性・打球角度傾向。公開0–100/G–S/☆は表示用Projectionで、Coreに入力しない。 | 新しい認知・動作モデルをこれらの原因に接続し、能力値やLeague基準ラベルを直接Buffにしない。 |
| `docs/game-design/09-player-trait-catalog.md`（2026-10-14更新、CANONICAL） | 対直球/対変化球、内外/高低の打撃技術、悪球打ち（無理な体勢の軌道保持）、初球、粘り打ち/カット打ち。Greenは積極打法/慎重打法と強振多用/ミート多用を別Familyとして扱う。 | 能力/技術/行動好みのSource of Truthを保持し、重複効果禁止。 |
| `docs/game-design/08-player-traits-design-seed.md` | Traitと公開能力は原因状態を要約。GreenはSlow Default Preferenceであり監督Soft/Hard指示を消さない。`KnowledgeEstimate` は真値と本人が知る状態を区別。 | 直感型/狙い球型は新たな得能Tierではなく、本人のSlow Preference + 球ごとのIntent。 |
| `docs/superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md` | `BatterSwingState` の開始時刻・姿勢・角速度・意図と、接触からの打球初速/回転を因果的に扱う方針。 | スイング方針 → 実際の時系列バット運動 → 既存接触物理を正とする。 |
| `src/core/sim/contact/BatBallContact.ts` | 現行の型は `BatterSwingState {pose, linearVelocity, angularVelocity}`。`resolveBatBallContact` は**単一時点**の球位置・バット姿勢から距離・相対速度を評価。時間連続の運動修正は未実装。 | 既存衝突解決の数式をむやみに置換せず、前段へ `SwingTrajectory` を新設。連続接触検出は別の依存Gateとする。 |
| `src/core/sim/plateAppearance/ContactVerticalSlice.ts` | 初期球・単一Swingを与える接触Vertical Slice。すべての打席の知覚/選球/空振り/見逃しは扱わない。 | フィクスチャの成功を完全試合実装と誤認せず、ヘッドレス意思決定の後に接続する。 |
| `docs/superpowers/plans/2026-10-16-catcher-game-intelligence-system.md` | 別々の捕手/打者Belief、独立した打者予測、コース/球種/テンポを前提。`src/core/decision/pitching/BatterPitchBelief.ts` は提案先。 | Belief型・Memory・時刻順を**共同所有**。Batter Action/Movementの実装だけを本計画で具体化する。 |
| `docs/game-design/49-manager-architecture-v1.md` | Default Philosophy / Game Plan / Immediate Command。SoftとHardの権限・信頼/理解の分離。 | 打席方針の監督指示は打者のSlow Preferenceを改変せず、この既存契約に接続する。 |
| `docs/game-design/05-psychology-emotion.md` | 通常の感情は能力/意思決定を勝手に変えない。`ActiveEmotion`成立時にだけ感情由来の実行・判断変化。 | 予測違いによる**通常の認識・運動時間差**は感情Buffではない。パニック等の特別な歪みは既存心理ゲートに委譲。 |
| `docs/implementation/2026-10-14-tbd-vs-lad-match-slice.md` | 9回完走/ブラウザ・PC・スマホの統合計画は `NOT YET VERIFIED`。採用PNG表示を維持。 | 新たな見た目のためにCoreを変更せず、Headlessで先行検証。完全試合未達なら `NOT CONNECTED` を明記。 |

### 監査上の重要な修正

- 「ミートAだから直感型」「選球眼Sだから待球型」は**禁止**。思考の予測依存度・ゾーン外への積極性・強振好みは本人の意図/好みであって、公開能力を固定の性格へ変換しない。
- 「アドリブ力」という新しい万能Buffを加えない。既存ミートの原因となる時間的/空間的制御技能と、必要に応じた別技能の根拠から、**実際に実行可能な修正**を計算する。
- `選球眼` の認識品質と `積極打法` の振る意思は独立。同じボール球を「ボールと認識しながら振る」「ストライクと誤認して振る」の両方を説明する。
- 同じ `悪球打ち` sourceは無理な姿勢での時間/空間の制御へ一度だけ使う。悪球打ち→追いかけ率/出塁率/ヒット率の直接変化は禁止。
- 発生した意思決定の時刻が、観測できた球道の時刻**より前**になってはならない。動作への補正も発生前の姿勢を遡及して書き換えない。
- 既存の定義済み接触solverは単一時刻。見逃し・空振り・途中修正を扱うためには、**時系列のバット運動と空間接触探索が統合の必須条件**。描画アニメーションだけで再現済みとは言わない。

## 2. 3つの責任と既存能力の因果対応

```text
A. KNOWLEDGE / EXPECTATION（本人に見えている情報からの予測）
   public count/score/outs/runners + observed pitch/cadence
   + matchup familiarity + scouting + learned patterns
    -> P(pitch family, velocity band, plate target, movement | observations)
    -> confidence / uncertainty

B. APPROACH / INTENT（どの球を狙い、振るか・見送るか）
   belief + own batting philosophy/Green + manager instruction
   + current count/score/out/bases + own reachable/strong area estimate
    -> pre-pitch target attention, expectation reliance,
       pitch-by-pitch TAKE/SWING criteria, preparation and commitment

C. PERCEPTION / MOTOR EXECUTION（実際に観測し、身体を動かす）
   observations at actual timestamps + skill & geometry
   + motor state / preparation / constraints
    -> swing start / update / brake / cancel / bat pose & velocities over time
    -> real collision / miss / take
    -> existing ball flight / rules / official ledger
```

独立した思考スタイルの3軸候補:
- `priorReliance`: 事前予測をどれだけ強く打撃準備へ反映するか。反応重視〜決め打ち重視の**連続値**。正解/不正解の序列ではない。
- `targetSelectivity`: 狙いをどれほど狭く絞るか。狙い狭い＝必ず慎重、ではない。
- `zoneChaseWillingness`: 規則上ボールと認識した球でも振る意思。`積極打法/慎重打法` 等と整合する本人好み/その場のIntent。
補助的Slow Preferenceとして `preparationCommitment` や修正時の慎重さを候補にしてよいが、上の既存軸で表現できるなら重複能力にしない。

**重要:** `priorReliance` は `confidence` と別。75%ストレートと予測していても、反応型はストレートへ固く決め打ちしない。狙い球型でも、球種が外れたと分かった後で修正できる。

## 3. 既存公開能力・Traitへの正確なマッピング

| 既存UI / Trait | 参照すべき真の原因Source | 実装で変わる中間量 | 明確な禁止事項 |
| --- | --- | --- | --- |
| **ミート**（リーグ文脈の表示Projection） | contact precision、barrel path control、接触時刻再現性、既に実証されている動作内の時間/空間制御技能 | 始動時刻誤差、バット軌道位置/面の誤差、物理的に可能な途中修正の精度、芯との実接触 | ミートBなら「直感型」、ヒット率+X、予想を常に的中させる |
| **パワー**（リーグ文脈の表示Projection） | bat speed、angular acceleration、力の伝達、身体状態 | スイング速度、加速・減速可能な範囲、接触時の相対速度、打球へのエネルギー伝達 | パワーが高いほど積極的に振る/読みが鋭い、予測的中で打球パワーに加算 |
| **選球眼**（リーグ文脈の表示Projection） | zone perception、actual-pitch recognition quality、swing/take discrimination、必要なら decision timing/inhibition | 観測に基づくゾーン推定・そのconfidence、誤認/見極め、判断実行時刻 | 高選球眼だから慎重打法、ボール球を物理的に振れない、四球率+X |
| **バント** | bunt用接触/ポーズ/姿勢維持のSource（既存Familyと同一） | バント専用のbat action/pose/transfer | 通常打撃のミートを無条件に二重適用、バント結果を先抽選 |
| **積極打法 / 慎重打法**（Green） | batting approachのSlow Default Preference | 追いかけ許容度、振る判断の事前基準、カウント別意思決定 | 球道認識・身体的バット到達範囲・生ミート能力を直接変える |
| **強振多用 / ミート多用**（Green） | preferred swing mode | POWER / CONTACT intentと事前準備の採用傾向 | パワー/ミートの真Source変更、結果の増減をラベルから直適用 |
| **対ストレート○ / 対変化球○** | ball familyを観測してからの認識・速度推定・タイミング合わせ技能 | 関連球種の認識latency/推定誤差/実行安定性 | 球種名を見た瞬間の強打Buff、未来の球種の正解通知 |
| **内角/外角/高め/低めヒッター** | 当該領域における本来の打撃技術/身体制御 | 実際の姿勢とバット面・軌道の再現性 | 本来存在しない予測情報、領域ごとの固定安打率 |
| **悪球打ち**（2026-10-14正本） | ゾーン外/窮屈な姿勢で狙った軌道を保持する実行技術 | 限界内の姿勢維持、バット面・時刻再現性 | ボール球へのスイング増加、届かない球への射程延長、ヒット結果Buff |
| **初球○ / 粘り打ち / カット打ち / two-strike系** | 対応する打席方針・技術の元Source | 初球の準備、追い込まれた状態での中止/当て直し/球を長く見る判断と動作 | 初球安打率加算、結果からの強制ファウル化 |
| **対左投手 / チャンス / ActiveEmotion** | `09` のFamily/心理/経験の既存Source | 左右投手への習熟、既存Emotion発火時の判断/動作修正 | 特殊能力ラベルで直接打率上昇、ActiveEmotionなしで心理Buff |
| **対戦Exposure / Familiarity** | 過去観測・相手の可視球道/配球/リズムの蓄積 | 次球Belief、準備と修正予測の校正、相手変更時の不確実性 | 相手の隠しPitchCall/True Skillの直読 |

ルール: **実在する内部Source → 一回だけDecision/Movementへ影響 → 公開Rating/特能は同Sourceの別Projection**。UIミート数値やTrait文字列を正史に入力しない。独立した動作技能を新設する場合も、既存Sourceでは説明不能な差・識別可能な測定指標・テストを条件とする。

移行期に既存データが「ミート80」の表示しか持たない場合、それを逆変換して**証拠のない真の身体能力を確定しない**。暫定 seed adapter には `provisional / estimated / source version` を必ず付け、正式な能力Source/統計の校正ができるまで実物データとして扱わない。

## 4. 主観的な球種×コースの結合予測

打者の事前信念を実際のバッテリー内部状態と分離する。

```ts
type BatterPitchBelief = Readonly<{
  observedThroughTick: number;
  pitchFamilyAndRegion: readonly Readonly<{
    pitchFamilyId: string;   // fastball / curve など。実在Arsenalの推定
    regionId: string;        // 高低左右・内外/ボール領域の共有plate frame
    probability: number;     // 打者の主観、normalized
  }>[];
  expectedVelocityBand?: readonly number[];
  cadenceExpectation?: Readonly<{ expectedUs: number | null }>;
  confidence: number;       // 主観的確信とEvidence量は別の値
  evidenceRefs: readonly string[];
}>;
```

- `P(pitch family, region)` を第一級の結合分布とし、球種とコースを無条件に独立抽選しない。
- 例: `P(ストレート)=0.75 / P(カーブ)=0.25`。さらに `P(内高|ストレート)` と `P(内高|カーブ)` は異なり得る。すべて合計1になることを検証。
- 球速帯・移動量・テンポは関連した条件付きモデルへ追加できる。全組合せの指数的増大を防ぐためsparse/hierarchical beliefや有限の表示粒度を選び、ビン数は校正する。
- ストライクゾーンとボールの位置はplate基準で表し、左右打者の見え方に応じて内外を解釈する。打者視点で塁やworldを丸ごと左右反転しない。
- 戦術上の記憶は打者が本当に見た投球・証拠に限定。新球種/未知投手/捕手交代は不確実性を増やす。事前確率を固定した“いつも75%直球”にはしない。
- Captured `BatterPrePitchBelief` は**実球種が決まる前かつ実PitchCallを知らない状態**で凍結。投球後に新Evidenceで次の一球用のBeliefを更新する。
- 「捕手は何を要求した？」という予測と「打者は何を狙っている？」という捕手側推定を対称な真値として共用せず、各自の `KnowledgeEstimate` を分離する。


### 4.1 部分的的中・予想差の方向/距離・残された修正時間

予測の一致を `正解 / 不正解` の1ビットへ潰さない。次の4条件を、同じ投手・打者・身体能力・seedで対照する。

| 球種予想 | コース予想 | 準備・対応の解釈 |
| --- | --- | --- |
| 的中 | 的中 | 球速/変化と到達位置の準備が一致してよいが接触は保証されない |
| 的中 | 外れ | 始動テンポの準備は使える可能性。位置/スイング平面・バット面の修正が必要 |
| 外れ | 的中 | 予定位置は使える可能性。球速・時間・変化の予測を修正する必要がある |
| 外れ | 外れ | 双方の再予測が必要。ただし必ず上の二つの不利の単純和になるとは限らない |

`mismatch` は、主観的な狙いコースの中心と実観測した打点の**連続的な幾何・時間差**として扱う。plate座標での距離（横/高さ）、移動方向（内→外、高→低）、実投球の速度・変化、すでに行った準備、観測から修正可能な時間を組み合わせる。たとえば外角低め待ちで真ん中への球は、静的な「真ん中は打ちやすい」という判断と、急な狙い変更による遅れが両立する。

誤差が大きいほど必要な動作修正量が増えることは検証するが、**遠い＝必ず見逃し / 小さい＝必ずヒット** の単調な結果規則は作らない。初期予測は点1つではなく確率分布と注意・準備の広がりを持ち、強く絞り込まない打者には複数の候補に反応する余地を残す。

## 5. ストライクゾーン、狙い領域、到達可能領域

1. **Official Strike Zone**: 大会RuleProfileと打者の合法姿勢による判定領域。スイングの可否や接触可能性を保証しない。
2. **Preferred Target Region / Attention**: 球種・速度・位置のどこへ準備を向けるか。ゾーン外の得意球を狙う打者も成立。
3. **Physically Reachable / Feasible Bat Region**: 身長、スタンス、可動域、バット長、身体の現在状態、時間と速度から計算される実接触可能範囲。静的円形でもゾーン矩形でもなく動的。

重要: 狙い球が一致しても、実際に到達できなければ空振りする。ボール球でも到達可能なら当てられ得る。`悪球打ち` は物理的リーチを無制限に広げない。

### ボール球に振る理由

独立の判断原因をトレースする:
- `CHOSEN_CHASE`: ゾーン外と推定したが、自分の得意領域/カウント/方針から意図的に振る。
- `MISREAD_ZONE`: ゾーン内と推定して振り、実際は外。
- `PRECOMMITTED`: 事前に強く始動し、途中で外と気付いても物理/時間のため止められない。
- `OVERRIDDEN_BY_DIRECTIVE`: 理解した監督の明示的な作戦を採用。
- 実際に振った原因は戦術intent + timed observation + motor state。説明ラベルだけを確率抽選してはならない。


### 意図的な見送りと、予想外で手が出ない見逃しを分離

`no swing` だけでは「ボール球を見極めて見送った」「3-0だから意図して見送った」「打つと判断したが始動可能時間を過ぎた」「球道認識が遅れた」を説明できない。履歴とDecisionTraceには、少なくとも次の別原因を保持する。

- `CHOSEN_TAKE`: 観測・カウントと本人の方針から自発的に見送った。
- `RECOGNITION_LATE`: 振る判断に必要な観測が間に合わなかった。
- `DECISION_TOO_LATE`: 「振る」が採択されても物理的な始動可能期限を過ぎていた。
- `CANCELLED_BEFORE_SWING`: 振る準備から観測更新で見送る判断へ変更し、実際に停止できた。
- `PHYSICALLY_STOPPED_CHECK`: 既に始動していたが減速し、RuleEngine/Umpireへハーフスイング判定を委譲する。

説明用Reasonは、観測・判断・運動の**実時刻列から派生**させる。Reasonラベルを先に抽選して見逃しにすることは禁止。3-0の一球で打者が自発的に見送る場合と、真ん中で驚いて手が出なかった場合を、同じ表示結果でも区別できる。

## 6. 時間に沿う Batter Decision / Swing Controller

```text
t0 PRE_PITCH:
  subjective belief + strategy + count -> approach/target attention
  -> preparation readiness (no knowledge of the actual future pitch)

t1 PITCH OBSERVED:
  actual observable delivery/cadence + visual ball samples at time t
  -> noisy/delayed ObservedPitchState
  -> estimated current trajectory / intercept distribution
  -> update prepared targets and swing decision

t2 DECISION:
  TAKE vs SWING intent and timing, reason logged
  -> INITIATE only when physically feasible, no retrospective initiation

t3 IN_MOTION:
  with each new actually-observed sample
  -> assess remaining time, motor state and correction feasibility
  -> bounded timing acceleration/braking/trajectory adjustment or cancellation

t4 CONTACT WINDOW:
  actual ball physics vs actual bat pose/linear/angular velocity
  -> collision: contact OR no contact (miss/take/check)
  -> canonical ball/world/rule state

t5 AFTER PITCH:
  observed evidence, decision latency, contact/miss/take
  -> separate current intention learning / next pitch belief update
```

- 事前準備が正解ならスイング時刻/初期姿勢/目標バット経路が適合しやすいが、正解ラベルから成果補正はしない。
- 予想が大きく外れた場合でも**見逃し固定ではない**。残り時間、認識遅延、準備固着、判断変更、身体制御によりTake/late swing/corrected contactが分かれる。
- 一度SWING意図が立っても物理的にまだ止められるならスイング中止/ハーフスイングを許す。始動後すぐに完全停止/ワープする動作は禁止。ハーフスイングの競技上の判定はRule/Umpire側に委譲。
- `temporalCorrection` は始動時刻の巻き戻しでなく現在の角速度/加速度・相対タイミング修正。
- `spatialCorrection` は実バット姿勢・速度・関節/体幹の制限内での経路修正。ユーザー向けの運動学的最適化に筋骨格フルモデルは不要。ただし物理的な速度・加速度・移動限界は必須。
- 対応できなかったときには自然な空振り・当て損ない・ゴロ・ファウル・見逃しが起こる。任意の「成功率」や結果ラベルから軌道を作らない。
- どんなミート技能でも時間不足・到達不能な球への強制接触はない。
- 高Powerは必要なspeed/accelerationsを供給できる可能性があるが、事前Belief/意思決定技能へ直接波及させない。強振/当てにいくモード間に実際のバット速度・制御のTradeoffがあれば物理/技術から現れるようにする。
- 認識情報は **ObservedPitchState** からのみ取得。正史の未来座標・確定の接触時刻・バッテリーの狙い球をフィードしてはいけない。
- 思考・身体・投球物理の更新時刻はSimulation Clockを共有し、カメラFPSと完全に独立する。

## 7. 現行Contact Solverとの統合方針（重要Gate）

現行 `resolveBatBallContact(pitch, swing)` は単一時点の棒/球接触を解く。`ContactVerticalSlice` もcontactがすでに成立する入力を想定しており、投球を見ながら空振り/見逃しを解く時間経路を持っていない。

### 実装する最小の正史増分

- `BatterSwingController`: サンプル時刻における進行中のモーターステート。観測時刻、判定時刻、スイング始動時刻、制御対象、実現した姿勢/速度を返す。
- `SwingTrajectorySampler`: 運動制約下で単調な時刻列のBatPose / linearVelocity / angularVelocityを出力する。各フレーム独立の見た目ポーズではなく、運動として一貫する。
- `SwingContactWindowAdapter`: 実PitchTrajectoryとSwingTrajectoryを共有tick/イベント時刻で重ね、候補接触区間を計算し、既存の `resolveBatBallContact` へその時点の実姿勢・速度を供給。
- **連続衝突検出 Gate**: サンプル間の球/バットすり抜けを防ぐため、swept collision/決定論的な固定反復refinementなどを検討する。既存 `09-17` のSimulation Clock設計と一致させ、区間内接触を丸めて誤った結果にしない。
- Miss / Take / Cancel は `resolveBatBallContact` が `null` のケースを本流として許す。現行VerticalSliceの「接触なしはthrow」仕様を新しい本流全体へコピーしない。VerticalSlice本体の用途・旧テストは保全。
- 衝突があった場合にのみ `BatBallContactResult` → `BattedBallInitialState` → BallFlightを通す。衝突時刻やbat poseが補間されても、rendererの推定値から公式イベントを生成しない。

**段階的受入:** 首振り/任意の身体制御/完全な実球道Producerなど上流が未完成の場合、決定論的なheadless trajectory fixturesで現在の担当分だけPASSを認める。ただしFull MatchとしてPASSにはしない。

## 8. 計画する責任分離とTypeScript配置

本計画は新しい独立試合Coreではなく既存 `src/core` 内の純粋モジュールのみを追加する。予定パスは既存ツリーと衝突する場合、実装時の正本に統合して一本化。

```text
src/core/decision/pitching/
  BatterPitchBelief.ts             # 前Catcher計画Task Eの唯一の共通所有先
  BatterPitchBelief.test.ts        # 確率・provenance・不確実性・非全知検査

src/core/decision/batting/
  BatterApproachPolicy.ts          # Slow preference + game plan + swing/take intent
  BatterIntentTypes.ts             # neutral typed API, pre-pitch vs during-flight
  BatterObservedPitch.ts           # 観測サンプルとrecognition provenance
  BatterSwingDecision.ts           # 時刻依存Decision/Cancel、原因説明
  BatterSourceSkillAdapter.ts      # 元の技術Source → 各工程の実行パラメータ
  BatterDecisionTrace.ts           # belief/decision/evidence記録
  *.test.ts

src/core/sim/batter/
  BatterSwingController.ts         # 時系列motor stateとbounded correction
  SwingTrajectorySampler.ts        # real bat pose/angular velocity over time
  SwingContactWindowAdapter.ts     # real pitch+bat trajectory → contact
  *.test.ts

src/core/decision/batting/
  BatterCatcherInteraction.integration.test.ts
  BatterApproach.acceptance.test.ts

docs/superpowers/plans/
  2026-10-16-batter-anticipation-intent-adaptive-swing.md
```

**外部依存:**
- 始動/姿勢は `docs/superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md` と一致。
- 投球Cadence側は既存 `PitchCadenceHistory` で本人が観測したテンポを受け取る。別のサプライズBuffは新設しない。
- BatterBeliefは捕手計画Task Eと共同所有。捕手側の `BatterResponseForecast` は**捕手に見えたEvidence**から作り、打者本人のPrivate Beliefを直接参照しない。
- CanonicalMatchState/RuleEngine は count/plate appearance/umpire judgmentの正史。Presentationは受動的。
- 新規型名・位置は提案。未確認の既存Producerへ実装済みと仮定して依存させない。

## 9. Codex実装順（結合後一括検証）

### Task A — 現行HEAD・Owned Source・基礎テスト再監査

- [ ] 現行作業ブランチと並行作業者・未コミットツリーを確認。既存Batter Decision / Pitch Observer / Bat Motionを検索し、同じ責任を持つ実装の重複作成禁止。
- [ ] 02/08/09/49/心理/既存Catcher計画とOwner-mapを1枚の表に確定。各 Source が判断・動作へ一度のみ作用することを型/テストで検査。
- [ ] `src/core/sim/contact/BatBallContact.ts`、`ContactVerticalSlice.ts` と既存P0不変テストの現在の振る舞いを凍結fixture化。
- [ ] 上流のPitchTrajectory/RuleEngine/Battery authorityが未実装なら `NOT CONNECTED` を明示し、適切なadapter契約を作る。

**受入:** 重複するBatterPitchBelief、投球全知、公開Rating経由Buff、ContactVerticalSliceの回帰がない。

### Task B — Belief / Approach / 本人好み

- [ ] Pitch Family×Regionの有限結合分布とconfidence/evidence provenance、連続時刻の観測可能範囲を導入。
- [ ] `priorReliance` / `targetSelectivity` / `zoneChaseWillingness` を行動好みとし、予測精度・ミート・選球眼と分離。
- [ ] Soft Directive（見極めろ/積極的/特定コース待ち）とHard Sign（送りバント等）を既存`49` Player Response境界へ接続。Slow Greenは書き換えない。
- [ ] 打者のtarget region と physically-reachable region を区別した fixtureを用意。先験的な「直感型が弱い」Penaltyなし。

**受入:** 同じミート/選球眼/予測でも異なる意図、同じ好みでも相手の球種情報で異なる意図を再現できる。

### Task C — 視覚観測と判断時刻の正史契約

- [ ] 観測時刻・認識遅延・不確実性・投球軌道推定を `ObservedPitchState` 型へ分離。Canonical未来情報の参照禁止。
- [ ] TAKE / SWING / CANCEL / PRECOMMIT の発行時刻をMonotonic Eventとして記録。
- [ ] 投球の球種/コース誤認と、「認識したうえで振る」の原因を区別。
- [ ] 先行する投球テンポの予測は既存Cadence契約へ接続。二重surprise処理禁止。

**受入:** 未来の正史ボール座標を入力しなくても打撃方針が再現し、後続観測では過去の判断・姿勢が変わらない。

### Task D — 元技能と公開能力の結合（非二重計上）

- [ ] Source IDsでミート/選球眼/パワーと認識・始動・空間/時間修正・スイング速度の元技能関係を明示。
- [ ] Existing Trait 09 をeffect-sourceから導出。Greenは意図、Blue等は技術、ActiveEmotionだけ心理ゲートで扱う。
- [ ] 既存入力がpublic ratingだけの暫定データは `provisional` として隔離し、正史True Skillを黙って捏造しない。
- [ ] UI Rating / Grade / 色 / league projectionだけを変更するinvarianceテストと、原因技能を変更したときだけ該当中間量が変わる対照試験を導入。

**受入:** 「ミート高い = 直感型」「パワー高い = ボール球へ積極的」「選球眼高い = 振らない」が発生しない。

### Task E — 制約つき連続スイングとアドリブ

- [ ] バット動作について現実的な開始/加速/減速/可動域制約を持つ `BatterSwingController` を実装。
- [ ] 投球中のObservation updatesを受けて、一度開始したバットを合法な上限内で時間/空間的に修正可能にする。
- [ ] 想定外の真ん中ストレートに対する見逃し、遅れ、修正ヒット/ファウルを、別々の時間・運動原因から生成できることをfixtureで確認。
- [ ] Late impossible reversal/physically unreachable outside pitchは、技能最大でも無理に当てない。ハーフスイングの正規ルール判定はRuleEngine側に保持。
- [ ] 定量の修正可能量・時間窓・姿勢の限界は**未Freeze**。運動計測/実サンプルと性能テストによって校正。

**受入:** 実際の bat pose/angular velocity/time trace が生じ、修正能力はそのtraceの物理的変化を通じてのみ接触へ影響する。

### Task F — Actual Contact / Miss / Take接続

- [ ] 既存 Contact Solver と、新たなSwingTrajectoryをAdapter経由で接続。
- [ ] 中間サンプルのCCD/refinementと同時イベントtie-breakを実装/検査。旧ContactVerticalSliceの接触ケースも維持。
- [ ] カウントに合わせたTake/Strike/BB、空振り/ファウル/当て損ない、実球道による接触後BallFlightへ単一の正史経路で接続。
- [ ] 見た目/Png/Batter POVのスイングポーズやFPSは入力にしない。Official resultの確定は既存RuleEngine。
- [ ] 上流Coreや正式Pitch producerが未実装なら、ここはfixture-onlyとしてPARTIAL/NOT CONNECTEDを明記。

**受入:** 「アドリブ成功」フラグや「ミート正解」フラグから安打を付与せず、物理接触が成立して初めてボール飛翔に入る。

### Task G — 捕手AIとの読み合い統合

- [ ] 捕手 Forecasterが観測できた打者の見逃し・空振り・反応時刻・狙い傾向から、打者予測への依存度/狙い領域を不確実性付きで推定。
- [ ] Captured private BatterBeliefと catcher-estimated BatterBeliefを分離したまま、対戦結果で両者のmemoryを更新。
- [ ] 「相手は外角を待つはず」と捕手が予想して真ん中を要求 → 打者が見逃す/対応して打つ両方の成立をfixtureで確認。
- [ ] Captured Accepted PitchCallは打者側へ事前入力しない。バッテリーPitchCall authority/Cadenceと入力を混線させない。

**受入:** 双方の読み合いが成立しても、Neither side reads the other's private strategy or unseen future ball truth。

### Task H — 一括受け入れ・校正・結果報告

- [ ] 全Target Unit/Integrationを一括で `npm run typecheck` / `npm test` / `npm run verify`。
- [ ] 毎球decision trace・actual bat motion・contact/effective outs/runsが同一seed/inputsで一致するmulti-seed sweep。
- [ ] 同じ真能力での2打撃スタイルが場面ごとに異なるtradeoffを示すことを検証。強制的に片方が常勝になる誤った学習は失敗とする。
- [ ] Skill各Source別の反事実比較、観測/決定/軌道時刻の整合、Core/Png/Batter POV/FPS変化の非干渉を検査。
- [ ] 調整データが不足する係数はcalibration候補のまま記録。性能/精度/安打品質などの先験的な固定目標はでっち上げない。
- [ ] PASS / FAIL / NOT RUN / NOT CONNECTEDを区別してレポート。9回完走・手機実機は既存別計画に従って判定。

**受入:** 判定にかかわる値はすべて思考・観測・運動・接触・規則の因果系列から説明可能で、旧Core/決定論テストを壊さない。

## 10. 必須テスト行列（新規 BAT 系）

| ID | 統一fixture / 条件変更 | 必須の観測 |
| --- | --- | --- |
| BAT-01 | 同じ 75% fastball / 25% curve、同じ能力。`priorReliance` だけ変える | 異なる狙い/準備が成立。打率への固定直接加算なし。 |
| BAT-02 | 球種周辺確率は同じ、球種別コース相関だけ変更 | Target/注意領域が変わる。独立抽選への潰れなし。 |
| BAT-03 | 外角低め強狙い → 実際は真ん中 | 認識/切替が遅い場合の見逃しが正史時刻で説明できる。 |
| BAT-04 | BAT-03、認識/時間空間制御だけ改善 | 切替が間に合う場合のバット軌道改善。必ずヒット/必中にはしない。 |
| BAT-05 | BAT-03、既に物理的な変更限界を超過 | 技能最大でも無理な軌道ワープ/始動時刻遡及なし。 |
| BAT-06 | 強く狙っていた球種/コースが一致 | 準備・時刻・実バット軌道に利点が出得るが、ヒット率の直Buffはない。 |
| BAT-07 | public `ミート` 表示だけ変更 / underlying contact source固定 | 正史Swing/Contact/結果がbitwise同一。 |
| BAT-08 | Underlying contact controlだけ変更、予測・好み固定 | 実打撃軌道の再現精度は変わり得るが狙い球の予想確率は不変。 |
| BAT-09 | Underlying powerだけ変更 | 加速/バット速度/相対速度に作用。予測・Zone Chaseは不変。 |
| BAT-10 | Underlying zone recognitionだけ変更 | 推定ゾーン/判断時刻が変わる。自動的な慎重打法化はしない。 |
| BAT-11 | 積極/慎重Greenだけ変更、技能固定 | 実際の意図的Chase/take傾向が変わり得る。到達範囲/制球真値/スイング制御は不変。 |
| BAT-12 | 同じボール球への振りで `CHOSEN_CHASE` vs `MISREAD_ZONE` | 観測信念/意図の異なる理由がtraceから検証可能。 |
| BAT-13 | 悪球打ちSourceだけ改善、zone-chasePreference固定 | 窮屈な姿勢での軌道保持のみ変化。追いかけ率/腕の長さ/生Powerは不変。 |
| BAT-14 | 対直球/変化球sourceのみ変更 | 当該familyを実際に観測した後の認識/タイミング差。打率の直接Buffなし。 |
| BAT-15 | 強振多用/ミート多用のみ入替 | 選択するSwing Modeの傾向は変わり得るがraw Power/Contactは不変。 |
| BAT-16 | 3-0満塁、2ストライク、ランナー状況変更 | TAKE/SWINGの戦術的比較が変わり、RuleProfileと整合。カウントだけの固定結果なし。 |
| BAT-17 | Swing開始後に急な軌道認識更新 / Cancel可能窓ありなし | 止める/途中ハーフスイング/止められず振る、物理時刻から決まる。 |
| BAT-18 | 球種とコースの誤予測だがアドリブ上手/下手 | 可動域内でactual bat traceが変わり、接触可否/品質は物理に由来。 |
| BAT-19 | 打者Beliefを固定し、捕手の真のPitchCall・意図だけ変更 | Pitch release前のPrivate Beliefが変化しない（透視禁止）。 |
| BAT-20 | 捕手が打者狙いを外す/打者が読み返す | 打者が見逃す/強く打つ両方の原因ある局面を再現できる。 |
| BAT-21 | 同じseed/input/Core、FPS・PNG表示・描画OFFを変更 | Decision/actual bat trace/contact/event/rulingが同一。 |
| BAT-22 | ゾーン外の到達不能球に積極打法 + 高ミート/悪球打ち | 振ろうとする選択は可能、物理的な接触の捏造は禁止。 |
| BAT-23 | Pitch intentは正しいがバット始動後に新しい視覚情報 | Future Knowledge使用なし。過去のpose不変・現在からのみbounded correction。 |
| BAT-24 | 初対戦/対戦後/しばらく未対戦 | evidence age/confidenceに従うbelief更新、未来情報や隠し技術直読なし。 |

| BAT-25 | 球種のみ一致、コースのみ一致、双方一致、双方不一致を同一能力・seedで比較 | 本来の予測準備/始動・軌道補正の差を別々に説明。ヒット率直加算・結果先決めはない。 |
| BAT-26 | 横/高さの予測位置を近距離→中距離→遠距離と変える（残り時間・身体状態固定） | 要求される修正方向・距離と可動性が変化。単純な「大きな位置差なら自動見逃し」ではない。 |
| BAT-27 | 真ん中見逃しを意図的3-0 Take、認識遅延、判断期限超過、途中中止の別原因で再現 | 同じSTRIKE結果でも時刻・observed Evidence・decision reasonが異なる。 |
| BAT-28 | 同じ投手履歴でカウント/満塁/点差だけ変更 | 本人の予想分布、狙い方、Take/Chase戦術を再評価できる。状況ラベルによる強制球種予測なし。 |
| BAT-29 | ボールゾーンだが本人の狙い領域に含まれる球、規則上ストライクでも腕が届かない球 | 公式ゾーン/選好ゾーン/動的到達範囲の独立性が保たれる。意図的Chaseと物理的接触能力は別。 |

### 校正・監査指標（閾値未Freeze）

- Pitch family/region主観予測のcalibration、認識latency、Swing Decision timing、Take/Chase discriminability。
- Same-ability反事実での prior reliance × target selectivity × aggression の違い（命中時の準備優位と予測外時の不利を両方向に評価）。
- 時間/空間修正と実bat pathの残差、身体限界超過件数=0。
- ball vs legal zone / predicted zone / bat reachabilityの混同件数=0。
- 各Trait/公開Ratingの「同Source二重補正」件数=0。
- 投手の速度/変化量/球質/期待時刻を打者Beliefに漏洩させる違反=0。
- Headless determinism、1試合あたりCPUコスト、長期対戦でのメモリ増加。
- 表示ではなく実際の正史結果と観測ログから検証。現実の球種別傾向は資料の条件/母集団/年代を確認して校正。根拠のない数値を固定せず、過剰なモデル複雑化は縮退する。

## 11. 既存Catcher Game Intelligence計画との接続ルール

- 捕手計画は `BatterPitchBelief.ts` を新設予定としている。本計画はその**唯一のOwnerを引き継ぎ、型/APIとBatter側処理の具体化**を担当する。実装担当は両計画をまとめて読み、旧Task Eと新Task B/C/Gが重複していたら一つの実装/テストに統合する。
- Catcher側 `BatterResponseForecast` は観測した打者の行動から反応型/狙い球型を確率的に推測できるようにする。ただしPrivate Beliefや新打者Sourceを捕手に直接渡さない。
- `CATCHER_LED / PITCHER_LED / NEGOTIATED` の既存主導権は維持。プレー開始後のBatter motor actionは受理された投球実行と独立して動く。
- 将来の2人の賢さの相互作用は**一球のタイムライン**を破らずに、各人がその時点に観測できるものだけを使う。
- 捕手計画に「打者予測＝打者の思考スタイル」と読む記述がある場合、本計画の `Belief` と `Approach` を分離する精密化を優先するが、09/49等のCanonical変更権限を持つわけではない。

### 11.1 Directional Intent / Spray 追加実装契約（2026-10-16）

**本計画のAPPROACH / INTENTおよびSwingTrajectoryの実装時に、[Batter Directional Intent & Causal Spray — 実装計画 v1](2026-10-16-batter-directional-intent-and-spray.md) を必ず同時参照する。** 方向狙い用に新しい独立Match Coreやもう一組の `BatterApproachPolicy` / `BatterIntentTypes` / `SwingTrajectorySampler` を作らない。

- 3方向 `PULL / CENTER / OPPOSITE` に加え、方向を意図的に指定しない `REACTIVE` を区別。球種・コースへの `priorReliance` と、打球方向への `directionCommitment` は別軸。
- **流し打ち狙い0% ≠ 実際の流し方向打球0%**。引っ張り狙い0%も同様。厳密な0%を強制epsilonで破壊しない。センター狙いも流し/引っ張り結果を禁止しない。
- 既存のプルヒッター/引っ張り屋、流し打ち/芸術的流し打ち、広角打法は`09`に定める**身体/接触技術**であって、本人の方向Intent頻度を直接変更するフラグではない。試合内Intentと技術Source、接触後の連続的打球角度/observed sprayを分離。
- 方向Intentは目標Motor Actionにだけ接続し、すでに完成した物理的な打球の方向や安打率を補正しない。左右打者・フェア/ファウル・スイング中の対応変更は共通Coreの時刻/座標系を守る。
- 既存 `BAT-01..29` に加えて、新計画の `DIR-01..26` を一括検証する。別のライフサイクル管理・独自Traitを増やさず、Guardの矛盾/未実装依存を `NOT CONNECTED` と記録する。

## 12. 受入条件・最終報告

完了要件:
1. 「何が来ると思う」「どんな球を狙う」「いつ振り出す」「どう修正する」「実際に当たる」の原因が時系列で追跡できる。
2. 直感型と狙い球型を片方が常に有利な成績になる仕様へしない。予想の的中・失敗と相手・状況の違いから多様な結果が自然発生する。
3. ミート・パワー・選球眼とGreen/Blue系Traitの源技能は、名前ラベルではなく実態のSourceで反映。UI Rating/Grade変更は正史結果不変。
4. ボール球の自発的Chase・誤認によるChase・途中止められないChaseを記録から区別できる。
5. Actual bat motionが物理的に可能な範囲で修正され、届かない打球や時間遡及接触を作らない。
6. 受理されたPitchCall、既存RuleEngine、Official Ruling、PNG/Batter POV、描画FPSの境界が守られる。
7. `BAT-01..29` がPASS/FAIL/NOT RUNで明示され、`npm run typecheck`、`npm test`、`npm run verify` の実測がある。接触中CCDなど未実装依存は正直に `NOT CONNECTED`。
8. 計画を実装したときには、単一の共有 Core と同一seed/同一入力による再現性が保たれ、Headless fixture成功を9回完走成功と混同しない。

最終報告ではBranch/Before-After HEAD/変更ファイル・source契約・テスト実行コマンドと数・再現seed・各BAT gate・連続接触の検証結果・調整係数の未確定・旧試合/現行描画への非干渉を報告する。

**最後の設計原則:** 打者の頭脳は球を予想して準備する。本人の意思が振るかどうかを決める。そして**実際にどこまでバットを動かせるか**は既存の身体能力・技能と残り時間が決める。打撃の上手さは打者の「読み方」を固定せず、想定外にアドリブ対応できたかどうかは実在するバットの軌道と接触で判定する。
