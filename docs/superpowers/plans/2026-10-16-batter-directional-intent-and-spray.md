# Batter Directional Intent & Causal Spray — 実装計画 v1

> **日付:** 2026-10-16（JST）
>
> **状態:** USER-APPROVED DIRECTION / IMPLEMENTATION PLAN / NOT IMPLEMENTED
>
> **対象リポジトリ:** `genkimorimori252525-oss/Kneekura-Mini-Baseball`、作業ブランチ `jolly/core-foundation-plan-2026-09-17`
>
> **作成時監査HEAD:** `de76e88dbffd54a23ebd1677a9bd2ec99affcf79`。実装者は着手直前にHEAD・作業ツリー・並行作業者を再確認すること。
>
> **位置付け:** [Batter Anticipation, Intent & Adaptive Swing](2026-10-16-batter-anticipation-intent-adaptive-swing.md) の `APPROACH / INTENT` と `SwingTrajectorySampler` を具体化する補助計画。同じ `BatterApproachPolicy` / `BatterIntentTypes` / `SwingTrajectorySampler` は一組だけ実装する。既存 `09-player-trait-catalog.md` 等のCANONICALを黙って変更しない。
>
> **実装運用:** 汎用ソースと因果的な実装を一括完成・一括検証する。個別打者専用パッチ、先に打球方向を抽選する簡易エンジン、独立したもう一つのMatch Coreは作らない。

## 0. 依頼と設計の大原則

ユーザーが求めるのは、引っ張り／センター／流し打ちの**狙い頻度**と、既存のプルヒッター／引っ張り屋、流し打ち／芸術的流し打ち、広角打法などの**方向別の技術**を分離すること。そして、実際の打球方向は意思ではなく現実のバット・ボール接触から決まること。

必須要件:

1. 打者ごとに「方向を選ぶとき、引っ張り／センター／流しをどの割合で狙うか」を設定できる。例: 35/40/25、70/25/5、85/15/0。数値は例示で、史実選手の実測値ではない。
2. 引っ張り狙い0％、流し打ち狙い0％を明示的に**許容する**。ゼロを自動的に小さな正の値へ平滑化しない。ただしゼロは「意図的に狙う頻度」のゼロであり、「実際の打球結果」のゼロではない。
3. 流し打ちを狙わない極端な打者でも、差し込まれ・接触遅延・打球方向の物理的変動から流し方向へ打球が飛ぶ可能性がある。「逆方向へ打てない」禁止技能にはしない。
4. 既存の `プルヒッター / 引っ張り屋`、`流し打ち / 芸術的流し打ち`、`広角打法 / 広角砲` を**打撃技術または技術の表示**として再利用する。技術の有無だけで意図割合を0/100にしたり、直接打球方向を曲げたりしない。
5. `CENTER` という明示的な中堅方向狙いと、`REACTIVE / NO_DIRECTION`（方向を決めず、投球に合わせて打つ）を区別する。
6. 打者の狙い方はミート・パワー・選球眼・リーグ相対査定から独立したSlow Preferenceである。技術が高い＝いつも引っ張る、技術が低い＝流し打ちを狙わない、という規則を作らない。
7. 球種・コース・高さ・速さ・投球の認識、カウント、アウト、走者、守備位置、本人方針、監督命令、打席内の観測によって、当該打席/球の方向Intentを選択し直せる。ただし本人の長期好みを書き換えたり、ゼロを暗黙に強制正値にしたりしない。
8. 監督や野手は本人のPrivate Direction Intentを知れず、観測可能な打球履歴やスカウティングから推定する。結果分布を意図分布と同一視しない。
9. 実際の打球はバット姿勢・相対速度・接触点・角速度・ボールの球道から決まる。意図と同じ方向に飛ぶ保証はない。
10. 右打者/左打者のPULL/OPPOSITE定義、連続角度と守備位置、ファウル/インプレーなどの境界を取り違えない。
11. 王貞治型やバリー・ボンズ型は「引っ張り重視」の**設計上の参照イメージ**にすぎず、真の狙い割合が0％だったと断定して史実データとして採用しない。

## 1. 軽量互換性監査（作成時）

| Source of Truth | 既存内容 | 本計画の扱い |
| --- | --- | --- |
| `docs/game-design/09-player-trait-catalog.md` `5.1` | `プルヒッター/引っ張り屋` = pull-side power-transfer technique、`流し打ち/芸術的流し打ち` = opposite-field technique、`広角打法/広角砲` = multi-direction hard-contact technique | いずれも技術Source/表示であり、Direction Intent確率を支配する別Traitへ勝手に改名しない。 |
| `docs/game-design/08-player-traits-design-seed.md` `4/5` | 流し打ち技術はopposite-field intent/対応する動作にだけ接続。実際の接触・スプレー分布から表示を導出。直接Buffなし。 | Intent → motor action → contact physics → observed spray → UI投影の向きを守り、trait名→結果への再入力禁止。 |
| `docs/game-design/01-manager-experience.md` `5` | 「流し打ち」は打球角度・方向の意図へ作用する監督命令。結果は保証しない。 | Soft Directiveを本人のSlow Preference/試合状況に合成。具体的Hard命令は既存49の理解・受諾に従う。 |
| `docs/game-design/02-rules-ratings-defense.md` `4.2 / 5.2` | 方向適性は内部打撃能力。打者の球種・コース・カウント別打球傾向と、守備監督の `ScoutingEstimate.directionDistribution` を分離。 | 真のDirection Preferenceと観測されたBatted-Ball Sprayを分け、守備は推定のみ利用。 |
| [Batter Anticipation & Adaptive Swing](2026-10-16-batter-anticipation-intent-adaptive-swing.md) | `BatterPitchBelief`、`priorReliance`、`targetSelectivity`、`zoneChaseWillingness`、制約つきSwing Controllerを計画。 | 方向Preferenceは新しい公開能力ではなく、既存 `BatterApproachPolicy` の独立軸/出力を拡張。球種×コース予測と連携するが同じ確率として混同しない。 |
| `docs/superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md` | Pitch + BatterSwingStateから物理接触。意図は始動/軌道/速度/面へ作用し、接触後の打球結果を直接変えない。 | Direction Intentが目標スイング軌道にのみ関与する。連続接触の実装はBatter本体計画に依存。 |
| `src/core/sim/contact/BatBallContact.ts` | 球と棒状バットの単一時点接触の `resolveBatBallContact` は実装済み。Intentや方向選択器、時系列Swing Producerは未実装。 | 既存solverを保全し、前段にStrategy → Motor Targetを追加。単一時点contactテストをFull Matchの成功と混同しない。 |
| `docs/game-design/49-manager-architecture-v1.md` と [Catcher Intelligence](2026-10-16-catcher-game-intelligence-system.md) | 指示Hard/Soft、Belief、observed opponent、PitchCallの所有権が別。 | 監督が流し指示したら必ず流し打球、としない。捕手がPrivate打者方向Intentを読むことも禁止。 |

**結論:** 既存正式Traitや物理を作り直す必要はない。未定義なのは「方向Intentの選択頻度」「目標スイングと実接触の接続」「出力打球分布と意図の分離」の実装契約である。これを本計画で追加する。数値重み・閾値・打者の史実方向Intentは未校正のままにする。

## 2. 4つの異なる概念

| 概念 | 対象 | 内容 |
| --- | --- | --- |
| `DirectionalApproach` | 長期の本人Preference | 方向を狙って選ぶ習慣と、その場合のPULL/CENTER/OPPOSITEの分布 |
| `DirectionIntent` | この一打席／一球の意思 | 明示的に狙う3方向のいずれか、または方向を指定しない `REACTIVE` |
| `DirectionalExecutionSkill` | 既存の真の技術Source | 実際に特定方向へバットを通し、接触品質を維持できる技能 |
| `ActualBattedBallDirection` | 接触後の正史物理の観測結果 | 連続角度/接触後ベクトルから派生する実打球方向。守備・記録が観測するもの |

**不変:** `P(意図としてOPPOSITE)=0` は `P(実際の逆方向打球)=0` を意味しない。ソフトウェアに自動の意図→出力同期・固定スプレー率補正・「逆方向へ飛べない」flagを入れない。

## 3. 狙い頻度の階層モデル

確率分布を **2段階** に分ける。3方向の割合は「方向を意図的に決める場合」にのみ適用する。

```ts
type AimDirection = 'PULL' | 'CENTER' | 'OPPOSITE';

type DirectionalApproach = Readonly<{
  directionCommitment: number; // [0,1]。方向を意図的に選ぶ基準傾向
  preferredWhenCommitted: Readonly<{
    pull: number;
    center: number;
    opposite: number;
  }>; // 3値≥0、合計1。exact 0 is legal
  persistence: number;  // Slow defaultが球ごとに乱高下しない性質。既存好みと重複なら共通化
}>;

type DirectionIntent =
  | Readonly<{
      kind: 'AIMED';
      direction: AimDirection;
      selectedAtTick: number;
      source: 'OWN_STYLE' | 'TACTICS' | 'ACCEPTED_MANAGER_COMMAND';
    }>
  | Readonly<{
      kind: 'REACTIVE';
      selectedAtTick: number;
      source: 'OWN_STYLE' | 'TACTICS' | 'ACCEPTED_MANAGER_COMMAND';
    }>;
```

- `directionCommitment=0` なら常に方向を固定せず反応する。`CENTER` を暗黙の既定値にしない。
- `directionCommitment=1` なら意図的な方向選択が通常。`preferredWhenCommitted.pull=0.85, center=0.15, opposite=0` の選手は「自分の標準方針では流しを意図的に狙わない」。
- `preferredWhenCommitted.pull=0, center=0.7, opposite=0.3` の選手、`pull=0, center=1, opposite=0` の選手も合法。確率の末尾に強制epsilonやclip後の正規化を加えてゼロを破壊しない。重みが非負かつ合計1であることを検証し、不正入力なら明示失敗/バージョンつき妥当化する（無言の修復禁止）。
- 3方向がすべて0は方向選択時の正規化分布としては不正。`directionCommitment=0` のときは分布を保存していても選択に使わない。Intentが `REACTIVE` の場合は3方向を選ばない。
- 割合は単なる一律の振り分けロトではなく、球種・コース・左右打者・カウント・アウト・走者・守備配置・戦術指示・本人の打撃技術/実行可能性から、その球に適用する**条件つき候補選択**のslow prior。
- 本人の長期0%はその本人が自主的にその方向を狙わないことを意味する。Soft Directiveや状況変化で行動する場合は、指示の受諾・その時点の方針変更を明示記録し、長期Preferenceの書換えと混同しない。特に自己方針を守る極端型では、空いた逆方向の守備区域が見えただけで0が自動的に正値にならない。
- `REACTION` で球道を見て打つ場合、打者の最終の物理運動は逆方向に適応してもよい。**方向を事前に狙う頻度**へ、結果方向から後付けしてカウントしない。
- `priorReliance`（球種・コース予測への依存度）と `directionCommitment`（打球方向を明確に狙う頻度）は**別の軸**。「直感的に投球へ対応しながら、引っ張りを狙う」「狙い球を決めていても方向は固定しない」の両方を許す。
- `targetSelectivity`（狙い球種/コースの絞り込み度）と `direction selectivity`（方向分布の狭さ）も同じ量として扱わない。選択候補を少なくする＝身体能力不足、ではない。

## 4. 連続スプレー角度と左右打者の座標

3カテゴリは**意思選択や表示を簡単にするため**の分類であり、物理を3方向へ量子化するものではない。

- Fieldに固定されたWorld Coordinateで、ホームから中堅方向を相対方位0、左右の外野方向を連続角度に定義する。
- `PULL` は打者の利き側から見た引っ張り方位、`OPPOSITE` は逆方向。右打者と左打者で符号の関係が逆転する。`CENTER` は打者の左右にかかわらず中堅方向。
- `worldToBatterRelativeSprayAngle` / `batterRelativeToWorldAngle` の変換は投打左右が変わっても整合し、左右反転テストで鏡像になる。実Pitch座標系を流用して攻守を反転させない。
- 接触後 `exitVelocity` の地面投影から `actualSprayAngle` を計算する。接触がなければ実打球方向は存在しない。例外（真上/ほぼ水平ゼロの水平成分、極小速度）は `undefined/indeterminate` を許容する。意図方向から埋めない。
- PULL/CENTER/OPPOSITEの「観測分類」の境界角は統計用の校正パラメータ。近接する角度を3点へスナップして物理を動かさない。ファウルの可能性、フェア判定、外野/内野の別はRule / physicsで判定。
- 中堅狙いも「絶対0度の打球」を要求しない。意図は目標角度の範囲/打ちたいギャップ/許容幅として記述し、実際の方向分散は認識・実行技術・接触に由来する。

## 5. Direction Intent → 実際のスイングへの影響

```text
Observed game + PrePitch Batter Belief + Slow Direction Preference
+ accepted manager policy / plan + handedness + defensive estimate
                │
                ▼
      BatterApproachPolicy（狙い/REACTIVEの候補）
                │
                ▼
    DirectionIntent（PULL / CENTER / OPPOSITE / REACTIVE）
                │
                ▼
  Pitch recognition + available time + contact feasibility
                │
                ▼
  MotorTarget / SwingPlan
  - contact timing window
  - target bat path and bat orientation
  - feasible bat angular/linear velocity
  - attempt to pull / center / opposite if physically achievable
                │
                ▼
  BatterSwingController + SwingTrajectorySampler（物理制約）
                │
                ▼
  Actual bat pose/velocity × actual ball position/velocity/spin
                │
                ▼
  resolveBatBallContact / future swept collision adapter
                │
                ▼
  Actual exit velocity/spin / official fair/foul / observed spray
```

実装上の注意:

1. DirectionIntentは `MotorTarget` を選ぶための**目標**であり、`BatBallContactResult.exitVelocity` を書き換えるものではない。
2. 引っ張り・流し・センターは球道と打者の可動域によって難易度が異なる。内角球を流す、外角球を無理に引っ張る等では、現実的な姿勢・タイミング・バット面・バットスピードのTradeoffが発生し得る。ただし「流し打ちは必ず減速」「引っ張りは常に強打」等のハードコード禁止。
3. 一度方向を選んでも、投球認識後に `REACTIVE` な対応や実行可能な再プランを行える。既存Batter計画の意思変更/動作途中修正窓と時間を統一する。選べない方向を意図で強制接触させない。
4. プルヒッター所持者でも `OPPOSITE` Intentは合法（本人の方針・監督命令・状況が許せば）。流し打ちTrait所持者でも `PULL` / `CENTER` / `REACTIVE` が合法。
5. 「技術の適用」は対応する実際のMotor Techniqueと元のSkill Sourceに結びつける。**結果として引っ張り方向に飛んだ**という事後ラベルだけでプル技術を発火させない。`流し打ち` Tierも同じ。同一の技術Sourceをミート/広角打法と別Buffとして二重入力しない。
6. `広角打法` は複数方向へ実際に強い打球を生成する元技術のまとめであり、「必ず3方向を均等に狙う」「3方向の意図に下限を付ける」Traitではない。引っ張り特化かつ広角技術が優秀という組合せも合法。
7. 狙い方向と無関係に、意図せず逆方向へ打球が出る機会を人工的な「流し球発生率」で付与しない。投球・バット軌道と接触点の物理から、条件が揃えば逆方向へ飛ぶ。あらゆる1球・極端な状態で反対方向打球>0を**強制**する必要はない。
8. 結果に合うように `BatterSwingState` を後付け生成しない。フルのSwingTrajectory Producer / Continuous Contactは[元打者計画](2026-10-16-batter-anticipation-intent-adaptive-swing.md)Task E/Fが所有し、共通時刻と同一物理境界に接続する。
9. 練習で方向打ちの技術が改善する場合は既存Player Developmentへ委譲。方向Preference変更は本人の戦術的学習や指導によるSlow Stateの変化として、技術向上と分ける。

## 6. 監督・捕手・守備・記録との連携

### 監督指示

- `流し打ち`、`引っ張り意識`、`センター返し` などの傾向指示は、基本的に `49 Manager Architecture` のSoft Directive / Game Planを通す。長期DirectionalApproachを上書きせず、当該打席のIntent候補へ反映。
- 明示されたHard Signを扱う場合も、理解/受諾/実行可能性の既存境界を通す。`流し打ち` の言語的指示だけで物理的な右方向打球を必ず生成してはいけない。
- 同じ打者でもカウント・投手左右・進塁目的・守備状況で選択が変わることは認める。ただし本人の強い方針によって空いている反対方向をあえて狙わない例も成立する。
- バント/送り/進塁打や右打ち等は別の作戦とし、intentのモード・合法性・動作を記録。進塁打ボタンが打球を所定方向へ後付けすることは禁止。

### 捕手・投手・守備

- 捕手は過去の観測できた `ActualBattedBallDirection`、スイング時刻/観測され得るフォーム、打席で見えた反応、相手スカウティングから「本人が何を狙いそうか」を不確実性付きで推定する。打者の真の `DirectionalApproach` / `DirectionIntent` は読めない。
- 守備監督の `ScoutingEstimate.directionDistribution` は実際の打球の条件付き分布を推定する。**打者の意図方向分布を直通で使わない**。サンプル不足、フォーム変化、相手投手の球種/左右・状況による偏りを不確実性として持つ。
- 打者は守備シフトが視認できれば、本人のObservationとして `BatterApproachPolicy` に入力できる。シフトが存在するだけで必ず逆方向へ打つ/意図変更する、という知能の強制は禁止。
- 捕手の配球が打者の狙い球/コース・方向に影響する場合も、投手のPitchCall確定情報を打者へ透視させない。
- 表示やReplayは `intendedDirection` を真値として打球へ反映しない。開発者向けDecision Traceのみ、当時の意図・情報・時刻を保持。

## 7. 監査・テスト用の記録形式

```ts
type DirectionalDecisionTrace = Readonly<{
  batterId: string;
  plateAppearanceId: string;
  pitchOrdinal: number;
  chosenAtTick: number;
  observedThroughTick: number;
  styleSourceId: string;
  directiveRef?: string;
  prePitchBeliefRef: string;
  directionIntent: DirectionIntent;
  legalAndFeasibleCandidates: readonly AimDirection[];
  motorTargetRef?: string;
  // actual contact & spray are appended as separate later observed events,
  // never used as fields for an earlier decision.
}>;
```

- 方針/Intentは物理プレーより前の確定情報を使って保存。事後結果で理由を書き換えない。
- `NONE/REACTIVE` は正式なIntentであり、事後に引っ張り方向へ飛んだから「引っ張りを狙った」に修正しない。
- 実際の打球と意図の一致率は分析専用。短期の極端な見かけ割合を基礎Preferenceへ即反映しない。
- Full詳細ログは必要場面/研究fixtureに絞り、常時全Pitchの巨大履歴を保存しない。既存DecisionTraceとイベントIDで参照関係を一元化。
- 同じ入力/seed/バージョンでは、方向Intent、実際のバットトレース、打球初期状態、観測/公式記録が決定論的に再現する。

## 8. 実装ファイルの責務（提案パス）

既存 [打者AI計画](2026-10-16-batter-anticipation-intent-adaptive-swing.md) の予約ファイルへ**追記**する。競合ファイルや並行実装がある場合は再利用し、重複Coreを作らない。

```text
src/core/decision/batting/
  BatterApproachPolicy.ts         # 既存予約。DirectionPreferenceとManager指示を追加
  BatterIntentTypes.ts            # 既存予約。DirectionIntentとsource/provenanceを追加
  BatterDirectionPolicy.ts        # 追加候補。条件付き方向選択（必要ならApproachPolicyに統合）
  BatterDirectionTrace.ts         # 追加候補。未観測情報を含まないDecision Trace
  BatterDirectionPolicy.test.ts
  BatterDirectionalIntent.acceptance.test.ts

src/core/sim/batter/
  BatterSwingController.ts        # 既存予約。方向目標を実行可能な運動へ変換
  SwingTrajectorySampler.ts       # 既存予約。時間・姿勢・バット速度の正史Producer
  SwingContactWindowAdapter.ts    # 既存予約。Contact検出（本計画と共同fixture）
  BatterDirectionalSwing.integration.test.ts

src/core/analysis/
  BattedBallSprayProjection.ts    # 追加候補。接触後のベクトルから観測方向へProjection
  BattedBallSprayProjection.test.ts

docs/superpowers/plans/
  2026-10-16-batter-directional-intent-and-spray.md
```

`src/core/analysis` の配置は提案であり、既存の打球統計・野手Scoutingに相当するOwnerがある場合はそこへ統合。新しい統計用Projectionは意図/確率の選択や物理を変更しない。

## 9. Codex実装タスク（依存順、一括統合）

### Task A — HEAD / 契約 / ソース監査

- [ ] 最新作業ブランチ、未コミット・並行作業を確認。既存BatterApproachPolicy、SwingTrajectory、Spray Scouting、Contact solverの実態とOwnerを記録。
- [ ] `08/09/01/02/49` と元打者計画のSource precedenceを照合。プル/流し/広角Traitは新たな方向Intent変数の直接操作因子にしない。
- [ ] 特殊能力/Green/ミート・パワー表示からの物理・選択への二重入力禁止、Intent/outcome分離、同seed再現性のテストを先行。

**完成:** 既存正史と競合しない変更面が明確。未実装依存は明示 `NOT CONNECTED`。

### Task B — Slow Preferenceと条件付き方向選択

- [ ] `directionCommitment + preferredWhenCommitted` の型、入力検証、値0/1境界、左右打者を問わない意味契約。
- [ ] `AIMED(PULL/CENTER/OPPOSITE)` / `REACTIVE` を独立のDecision Outputとして生成。
- [ ] 球種/コースの主観予測・打席Context・認識した守備配置・既存Green/Manager指示を条件付き候補選択に接続。
- [ ] 極端な0%好み、センター限定、柔軟なReact型、同ミート/選球眼でも異なるスタイルを fixture で検証。
- [ ] 既存Slow Preferenceの成長/移行/持続性を使い、1打席失敗で本人の打撃哲学が変わらないようにする。

**完成:** 本人の意図割合は0を保持し、全員に中堅/逆方向の強制的な下限を付けない。戦術指示や状況変化の効果は意思決定時に追跡可能。

### Task C — 連続角度、打席左右、物理的目標

- [ ] World-coordinate射出方向角とbatter-relative PULL/CENTER/OPPOSITE、右/左打者の完全対称性。
- [ ] AimDirection → feasible timing/pose/bat-face/trajectory targetへ変換。Contextに合わせて球種・コースと残り時間を解釈し、姿勢/角速度制約を守る。
- [ ] `REACTIVE` は方向を強制せず投球を認識してから対応。意図的CENTERとは別のtraceになる。
- [ ] 既存Swing Controllerが未完成なら純粋なfixture adapterを先に作り、接触結果やスプレー実装済みと誤表示しない。

**完成:** 「流し打ちを狙え」だけでは打球初速/角度が確定しない。自然な打球分布を作るための真のバット運動へ接続できる。

### Task D — 技能Sourceとの結合・既存Trait保全

- [ ] pull-side technique / opposite-field technique / multi-direction technique / generic contact precision / body power のSourceIDと作用先を明確化。
- [ ] 対応Motor Techniqueが実際に使用される場合だけ技能が働き、筋力・ミート・反応・広角の同じSourceを二重に適用しない。
- [ ] 既存 `09` のPull/流し/広角Trait TierやDisplayだけを変更してもIntent/バット運動/出力が変わらない比較テスト。
- [ ] 「プルヒッター保持かつ意図的に流しを狙う」「流し打ち所持かつPULL/REACTIVE」「広角技能に優れるが狙いはPULLのみ」をテスト。

**完成:** 技術と意図は別次元。既存Traitのラベルから0%制約・自動打球変化が発生しない。

### Task E — 実打球方向・Scouting・守備シフト連携

- [ ] 実際の接触点/exit velocityから連続スプレー角を導出し、区間分類は後処理に限定。
- [ ] 方向Intent 0％でも、成り立つ物理条件で反対方向打球を観測できるfixtureを追加。逆方向を保証する偽乱数にはしない。
- [ ] `ScoutingEstimate.directionDistribution` は実際のBIP実績/統計を観測・条件づけ・不確実性推定し、Private DirectionIntentを直読みしない。
- [ ] 守備シフト側は予測と位置選択まで。打球結果を方向確率/守備位置に合わせて後から改変しない。
- [ ] 守備シフトを見た打者が逆方向を選ぶ・選ばない両方の合理的Fixtureを追加。

**完成:** 王シフト型の守備判断を観測結果から学べるが、球の正史出力や本人の真の長期Preferenceをオラクル参照しない。

### Task F — 一括受け入れ・性能・保存互換性

- [ ] `npm run typecheck`、`npm test`、`npm run verify` と重点fixture群を一括実行。
- [ ] 2球種打者/未知投手/上下左右コース/異なる打席姿勢を含む多seed実行でDirectionIntent・実バット軌道・接触・球道の再現性を検査。
- [ ] 右/左打者、境界角、センター連続角、ファウル、空振り/見逃し、方向Intent0、REACTIVEとCENTERの混同をテスト。
- [ ] Mini/Natural/PNG/Batter POV/30/60fps/描画OFFの変更がCanonical Intent/Contact/Official Resultを変えないことを確認。
- [ ] 未実装物理・Scouting Ownerの統合は `NOT CONNECTED` として報告。Headless Test PASSを9回完走PASSにしない。
- [ ] 大量試合/長期キャリアでの方向偏り・個性・Performance/セーブサイズを観測し、任意係数はCalibration項目として別管理。

**完成:** 既存P0/Contact/Catcher/Batter不変テストと、本計画の追加ケースが非回帰で再現可能。

## 10. DIR-01〜DIR-26 必須受け入れテスト

| ID | 条件 | 検証 |
| --- | --- | --- |
| DIR-01 | `directionCommitment=1`、方向35/40/25 | PULL/CENTER/OPPOSITEの3方向を意図として選択可能。分布の検証が通る。 |
| DIR-02 | preferred=85/15/0、self-policyのみ | OPPOSITE意図を選ばない。勝手なepsilon追加はなし。 |
| DIR-03 | preferred=0/70/30、self-policyのみ | PULL意図ゼロ、センター/流し狙い有効。 |
| DIR-04 | preferred=0/100/0、commitment=1 | CENTER意図だけ。REACTIVE/他方向の区別を保持。 |
| DIR-05 | commitment=0、任意の3方向preferred | DirectionIntent=REACTIVE。CENTERとして扱わない。 |
| DIR-06 | commitmentが中間値、75%ストレート予測を共有 | 事前の球種予測依存度と方向Intent選択頻度を独立変更できる。 |
| DIR-07 | 3方向合計≠1、負数、NaN、全0 | 入力は明示的に拒否/検証される。無言で不正データを有効化しない。 |
| DIR-08 | exact OPPOSITE intent 0％だが、差し込まれる投球と実Bat Contactを与える | 有効な物理条件なら逆方向の打球を生成できる。意図結果同期禁止。 |
| DIR-09 | pull intent=100%でも、打点/面/始動時刻を変える | 物理的な接触差からCENTER/OPPOSITEの実方向も起こり得る。指定角スナップ禁止。 |
| DIR-10 | プルヒッターのTechnique Source固定、本人のDirection Preferenceだけ変更 | 意図割合は変わり得るが、Traitから固定打球結果を生まない。 |
| DIR-11 | Preference固定、pull-side Skill Sourceだけ変える | Motor Trajectory / 接触時相対速度等のみ変わり、選択Intent確率は変わらない。 |
| DIR-12 | 流し打ちTraitの表示名/Tier文字だけ変更、真の技術Source固定 | 同seed同入力でIntent/実Bat Contact/打球方向が完全一致。 |
| DIR-13 | 流し打ち技術が高い本人のPULL Intent | PULLも実行可能。流し技術で自動にOPPOSITE固定しない。 |
| DIR-14 | pull-side技術に長ける打者のOPPOSITE Intent | 試みられる。技能に応じた実際の軌道品質の差だけ生じる。 |
| DIR-15 | 広角技術が高いがPULL preferred=100% | 意図の偏りは残る。多方向技術があるからといって分布が均等にならない。 |
| DIR-16 | 同じIntentでも球種・コース/高さ・速度を変更 | 可動域・タイミングから目標Motorを変更。方向意図だけで瞬間打球速度を決めない。 |
| DIR-17 | 同能力・同Intentで右打者から左打者へ鏡像 | relative pull/oppositeが入れ替わりworld角が鏡像になる。CENTERは中堅方向を維持。 |
| DIR-18 | CENTER IntentとREACTIVEの2名が結果的に中堅へ打つ | 実打球が同じでもDecisionTraceの狙い理由が異なる。 |
| DIR-19 | 実Contactなし（見逃し/空振り） | batted-ball方向を作らない。Intentは事前ログとして存在可。 |
| DIR-20 | 横成分が極小の打球/ファウル/内野ゴロ | 不定方向・ファウル・連続角・Rule判定を無理に3方向へ変換せず処理。 |
| DIR-21 | 監督が流し打ちSoft Directive | 本人Preferredを保持したまま当該打席の意図候補が変化可能。流し打球を保証しない。 |
| DIR-22 | 守備が逆方向を空ける。極端な引っ張り固執 vs 柔軟型 | 見えている情報から意図変更する型、変更しない型の両方が成立。 |
| DIR-23 | 同じTrue Player、違う守備側ScoutingEstimate | 守備の配置予測は変化しても、打者のPrivate意図・真能力・投球/打球物理を直改変しない。 |
| DIR-24 | 打者のPrivate Direction Preferenceと同じ実打球実績から作ったScouting | 守備側は実打球Evidenceしか見ず、本人の真のIntentは読めない。 |
| DIR-25 | 最新技術/Green/リーグ相対表示を変更せず観測Projectionだけ変更 | 同一入力seedの真正史Intents・Swing・Contact・Official Result不変。 |
| DIR-26 | 30/60fps・描画OFF・リプレイ・同seed/入力 | 投球と同じCore時刻・Intent履歴・実打球初期状態・公式結果が一致。 |

**注意:** DIR-08/09は「関連した物理が可能なfixtureを作って、それが禁止されていないこと」を確認する。どんな1球でも意図の反対へ飛ぶことを保証するテストではない。

### 校正の指標（未Freeze）

- 意図的PULL/CENTER/OPPOSITE頻度と、結果としてのActual Spray頻度を**別々に観測**。
- 方向を固定しないREACTIVEの頻度・実出力、球種/コース/カウント/打席左右別の結果分布。
- 方向Intentの選択/変更時刻、時系列Motor実行可能性、狙いと実出力の角度差。
- Player Profileにより、引っ張り特化/センター特化/流し重視/反応重視が表現可能で、0%分布の固定が強制されないこと。
- Pull/流し/広角Skillを変更したときに元技能の作用が二重に積まれず、同SourceでDisplayを変えただけでは結果が変化しないこと。
- 実球の速度・スピン・バット面からの自然なスプレーと過度に強制された分布の乖離。実測資料を用いる場合は年/母集団/球種/打席左右/時代背景を区別。
- 意図分布の史実推定値は実打球分布から一意に逆算できない。実際のStatsから直接内部の真の意図割合を確定しない。

## 11. 完成判定・別計画との接続

1. `BatterPitchBelief` の球種/コース予想と方向の狙いは独立し、`BatterApproachPolicy` で関連づく。
2. DirectionIntent=0％が結果方向=0％に化けず、本人の意思を物理へ後戻りさせず、技術が結果/打球の補正表にならない。
3. `CENTER` 狙いと `REACTIVE` の違いは明確で、左右打者と連続角度の符号が安定する。
4. 監督命令/Green/既存Trait/守備Scoutingの権限・知識境界に違反しない。
5. 既存Batter計画の `BAT-01..29`、Catcher計画の `CATCH-01..25`、本計画 `DIR-01..26` が相互に非矛盾である。
6. 新モジュールを一つの共有Coreへ接続し、既存のContact Physics/RuleEngine/Presentationを改変する近道を作らない。
7. `npm run typecheck` / `npm test` / `npm run verify`、重点テスト、多seed/headless、デバイス/描画非依存テストを実行して実際のPASS/FAIL/NOT RUNを報告。
8. `SwingTrajectorySampler`・連続接触/Full Match/Scoutingなどが未実装であれば、該当受け入れを `NOT CONNECTED` と表示し、Fixture成功をフル試合完成と誤記しない。

最終報告はBranch/Before-After HEAD/既存と新規の変更ファイル/各SourceのOwner/テスト数と再現seed/負荷計測/回帰の有無/未校正事項/未接続依存を含める。内部数値・史実選手の打球方向や狙い率は後日Evidenceベースで校正する。

**最後の不変原則:** 「本人が引っ張りを狙うか」と「引っ張りへ打球が飛ぶか」は別。既存の引っ張り/流し/広角技能を実際の身体動作に一度だけ反映し、どの方向に打ったかは接触後のボール物理で確定する。
