# Time, Running, Catching, Perception, and Umpire Design

更新日: 2026-09-17
状態: 設計承認済み。実装前。

## 1. 目的

Mini Baseball / 将来の Natural Baseball の共有 Match Core において、次の5領域を同一の因果設計へ統一する。

1. Simulation Clock と精密イベント時刻
2. 走者の個人判断と身体運動
3. 捕球の幾何・保持モデル
4. 選手ごとの知覚世界
5. 審判判定・誤審・リクエスト / リプレイ検証

全領域で共通する恒久原則は以下とする。

```text
Canonical Physical Truth
        ↓
人間・選手・審判が観測できる情報
        ↓
個人判断 / 判定
        ↓
行動 / 公式判定
```

Core の正史世界は真の位置・速度・接触時刻・規則状態を保持するが、選手・監督・審判がその真値を直接読むことは禁止する。

---

## 2. Simulation Clock

### 2.1 正史時間は整数で保持する

正史時刻は浮動小数点秒の累積ではなく、整数の時間単位で保持する。

基準候補はマイクロ秒とする。

```ts
type SimulationTime = bigint; // microseconds
```

実装言語・性能要件により内部表現を最適化してよいが、論理上の正史時刻は整数で比較できなければならない。

### 2.2 ハイブリッド時間方式

通常運動は決定論的な固定ステップで進める。

初期候補:

```text
base step = 2 ms
```

ただし、この値は最終固定値ではない。精度・性能試験により変更可能とする。

重要イベントは base step 境界へ丸めない。

```text
4000 us ---------------- 6000 us
              ↑
           5237 us
        actual contact
```

以下のイベントは区間内の発生時刻を求める対象とする。

- bat-ball contact
- ground / wall collision
- glove-ball contact
- secure catch成立
- throw release
- tag contact
- base touch
- force / appeal に必要な物理接触
- その他、前後関係が規則結果へ影響するイベント

### 2.3 イベント時刻探索

イベント時刻探索には、決定論を壊しやすい可変反復数の数値法を避ける。

優先順位:

1. 解析的に解ける場合は解析式
2. swept collision / continuous collision detection
3. 固定反復回数の deterministic refinement

同一入力・同一Coreバージョンで、異なるCPU・描画FPS・Mini/Natural renderer によってイベント時刻が変化してはならない。

### 2.4 表示時間との分離

Simulation Clock と Presentation Clock を完全分離する。

Mini の 55ms / display step は Presentation cadence であり、物理ステップではない。

```text
Simulation
  0us ... 5237us contact ...

Presentation
  0ms, 55ms, 110ms, ...
```

重要イベントを表示で飛ばさないため、Presentation は contact / catch / tag / base touch などの正史イベントフレームを追加保持してよい。

---

## 3. 同時イベントと物理真実

### 3.1 物理Coreは差を保持する

クロスプレーで時刻差が存在するなら、審判の判定とは無関係に正史へ保持する。

例:

```text
ball secured at first base: 4,281,732 us
runner base touch:           4,284,091 us
```

これにより、本来の規則結果と人間審判の判定を分離できる。

### 3.2 完全同時

量子化後の正史時刻が完全に一致した場合、物理Coreは `simultaneous` を失わず保持する。

その後の競技上の扱いは RuleEngine / RuleProfile が決定する。

Rendererやイベント配列順、JavaScriptオブジェクト順などで勝手に先後を作らない。

### 3.3 四層分離

```text
Physical Truth
  ↓
Correct Rule Result
  ↓
Human Umpire Call
  ↓
Final Official Ruling
```

この4層を混同しない。

---

## 4. 走者は個人判断型とする

### 4.1 中央走塁AIを置かない

走者は、正史世界の真値を直接読み取る中央AIに操られない。

```text
Canonical World
      ↓
Runner Perceived World
      ↓
Runner Decision
      ↓
Runner Intent
      ↓
Physical Movement
```

### 4.2 RunnerPerceivedWorldState

```ts
type RunnerPerceivedWorldState = {
  observedBall: ObservedBallState | null;
  observedDefenders: readonly ObservedDefenderState[];
  observedCoaches: readonly CoachSignal[];
  knownOuts: number;
  knownScoreContext: KnownScoreContext;
  currentBaseContext: RunnerBaseContext;
  recentCommunication: readonly CommunicationEvent[];
  observationTime: SimulationTime;
};
```

走者は以下から判断する。

- 打球の見え方
- 捕球された / されそうという推定
- 野手の見える位置
- アウト数・得点状況
- 自分の走力・加速・走塁判断能力
- 事前戦術
- ベースコーチから得た情報
- 自分が最後に観測した情報と記憶

### 4.3 走塁身体モデル

最低限、以下を正史運動として扱う。

- reaction delay
- acceleration
- top speed
- braking
- base rounding
- direction reversal / retreat
- slide initiation
- base touch timing

脚の一歩一歩や筋骨格シミュレーションまでは行わない。

能力は「成功率+X%」ではなく、中間量へ作用させる。

### 4.4 三塁コーチ

三塁コーチは、特に本塁突入・停止判断に重要な外部情報源とする。

```text
ThirdBaseCoach perception
      ↓
CoachSignal
      ↓
Runner receives / interprets
      ↓
Runner decision
```

コーチの指示は強い情報だが、走者の身体運動や知覚を直接上書きしない。

### 4.5 一塁コーチ

一塁コーチも存在するが、初期実装では三塁コーチより低い優先度とする。

主な役割候補:

- 一塁到達後の情報補助
- 牽制・帰塁に関する声掛け
- 外野返球やボール位置に関する補助情報
- 次プレーへ向けた事前共有

一塁コーチを中央司令塔にはしない。

走者本人の判断を自動的に置換する機構も持たせない。

---

## 5. 捕球モデル

### 5.1 捕球は二段階に分ける

捕球は少なくとも以下へ分離する。

```text
1. Contact Feasibility
   ボールへ物理的に触れられるか

2. Secure Possession
   接触後に保持できるか
```

### 5.2 Contact Feasibility

入力候補:

- defender body position
- defender velocity
- body orientation
- glove reachable region
- glove target position
- ball position / velocity / spin
- reaction / route / acceleration
- jump / dive derived capability when needed

野手の中心座標が捕球点へ到達しただけで捕球成立とはしない。

### 5.3 catching能力

`catching` は直接成功率ではない。

主に以下へ作用する。

- glove target error
- body-control error
- difficult-pose stability
- secure-possession tolerance
- impact / spinへの耐性

概念例:

```text
elite fielder:
  small glove-position error

poor fielder:
  larger glove-position error
```

数値幅は実データ・統計検証から校正し、設計段階で固定しない。

### 5.4 捕球失敗後もlive ball

捕球失敗時にボールを消して結果だけ返してはならない。

```text
ball hits glove edge
      ↓
new velocity / spin
      ↓
ball remains live
```

弾いた球、前へ落とした球、後逸などを正史物理として続行する。

### 5.5 グラブ変形は正史計算しない

バット・ボール接触と同様、グラブ革の高自由度変形体計算は正史Coreへ入れない。

必要な保持特性は、有効接触領域・減衰・保持許容量などの校正パラメータへ圧縮する。

---

## 6. 選手知覚モデル

### 6.1 全知禁止

Coreは全真値を持つが、選手AIはそれを直接読まない。

```text
Canonical World != Perceived World
```

### 6.2 AttentionState

各選手・走者は、その瞬間に何へ注意を向けているかを持つ。

例:

```text
attention = ball
attention = runner
attention = base
attention = teammate
```

注意対象は高頻度かつ高精度で更新される。

注意外の対象は、低頻度・低精度または記憶予測となる。

### 6.3 ObservationSample

```ts
type ObservationSample<T> = {
  estimate: T;
  observedAt: SimulationTime;
  confidence: number;
};
```

観測精度は最低限、以下から決める。

- attention direction
- field of view
- distance
- occlusion
- relative speed
- observation duration
- player perception / awareness abilities

完全な光学レンダリングや毎tickのレイトレーシングは要求しない。

### 6.4 Memory

選手は最後に観測した対象を即座に忘れない。

```text
last observation
+ elapsed time
+ remembered velocity / intent
      ↓
predicted current state
```

時間経過によりconfidenceは低下する。

これにより、Canonical Worldでは走者が既にスタートしていても、野手は古い情報を元に判断することがある。

### 6.5 CommunicationEvent

味方の声・コーチ指示は知覚情報であり、中央命令ではない。

```ts
type CommunicationEvent = {
  sourceId: string;
  targetScope: CommunicationTargetScope;
  kind: CommunicationKind;
  issuedAt: SimulationTime;
  content: CommunicationContent;
};
```

受信には以下を考慮できる。

- 距離
- 発声時刻
- crowd / environment noise profile
- attention
- hearing / recognition delay

受信者は情報を自分の観測と統合し、最終判断は本人が行う。

---

## 7. 審判モデル

### 7.1 真実と判定を分離する

審判は物理Coreの真値を直接読む存在ではない。

```text
Canonical Physical Truth
      ↓
Umpire Perception
      ↓
OnFieldCall
```

### 7.2 UmpirePerceivedPlay

判定難度は、最低限以下から発生させる。

- true event time difference
- umpire position
- viewing angle
- occlusion
- player / ball speed
- type of play
- attention / anticipation
- umpire skill / consistency

`umpireSkill = 80 -> 80% correct` のような固定成功率にはしない。

明白なプレーは低能力審判でもほぼ正しく、時間差が小さく遮蔽されたプレーほど能力差が出る。

### 7.3 誤審

物理真実と正しい規則結果は保持したまま、審判が誤ったOnFieldCallを出すことを許可する。

```text
Physical Truth: OUT
Correct Rule Result: OUT
OnFieldCall: SAFE
```

これにより誤審は演出ではなく、人間知覚の失敗として因果的に発生する。

---

## 8. リクエスト / チャレンジ

### 8.1 監督は真実を直接読まない

監督は以下から誤審可能性を推定する。

- 自分が見たプレー
- 選手の反応
- ベンチ / コーチからの情報
- 利用可能な映像情報
- 残りチャレンジ回数
- 試合状況
- 監督の推定能力

```text
OnFieldCall
    ↓
Manager Estimate of Error
    ↓
Challenge Value Estimate
    ↓
ChallengeIntent
```

監督能力は判定真実を変更しない。

### 8.2 通常リプレイ検証

通常の映像リプレイは、Canonical Truth を直接参照しない。

ReviewSystem が使えるのは設定されたカメラ・角度・フレーム・遮蔽などから構成される証拠とする。

```text
Replay Evidence
      ↓
Is there sufficient evidence to overturn?
```

したがって、真実として誤審でも映像証拠が不足すれば判定維持があり得る。

### 8.3 ABS / 機械判定

ABS等の機械判定が採用される Rule / Competition Profile では、許可された正史計測値を直接用いてよい。

ただし、ABS truthそのものを監督能力・捕手能力・性格などで変化させない。

### 8.4 ChallengePolicy

チャレンジ回数・成功時の回数保持・対象プレーなどは `ChallengePolicy` としてCompetition / RuleProfile側で定義する。

Coreへ大会固有値を直書きしない。

---

## 9. RuleEngineとの境界

RuleEngine は物理真実を使って「本来の規則結果」を決定できる。

審判が誤審する場合でも、正しい規則結果を失わない。

概念データ:

```ts
type AdjudicatedPlay = {
  physicalTruth: PhysicalPlayFacts;
  correctRuleResult: RuleResult;
  onFieldCall: UmpireCall;
  review?: ReviewResult;
  officialResult: OfficialRuling;
};
```

公式試合状態へ最終的に反映するのは `officialResult` である。

ただしデバッグ・リプレイ・誤審分析のため、他の層も保存可能にする。

---

## 10. 決定論

誤審・個人判断・知覚誤差を入れても、同一入力・同一seed・同一Core versionでは再現可能でなければならない。

- perception RNG は対象・選手・play id等から独立streamを導出する
- umpire RNG も独立streamを使用する
- manager challenge decision の乱数が打球物理や守備RNGへ波及しない
- rendererの有無で知覚結果は変化しない
- Mini/Naturalで同じ正史プレーを使う限り、同じOfficial Rulingを再現できる

---

## 11. テスト方針

### 11.1 時間

- 同一入力でイベント時刻が完全一致する
- base step変更の許容範囲を検証し、正史結果が不当に反転しない
- 重要接触がbase step境界へ丸められない
- Presentation cadence変更で正史イベントが変化しない

### 11.2 走塁

- 同じ身体能力でも判断開始時刻の差で進塁結果が変わる
- 三塁コーチsignalの受信有無で判断が因果的に変わり得る
- 一塁コーチは走者本人の判断を強制上書きしない
- タッグアップは捕球認識時刻＋帰塁/スタート運動から決まる

### 11.3 捕球

- 到達不能球はcatching値だけで捕球できない
- glove reachable regionに入った球でも姿勢・相対速度・誤差により失敗し得る
- catchingだけを変えると身体最高速度ではなく捕球誤差・保持性が主に変化する
- 弾いた球はlive ballとして次の正史物理へ続く

### 11.4 知覚

- Canonical Truthを変更せず、知覚遅延だけで判断が変わる
- attention対象と非対象でObservationSample更新頻度が異なる
- 古い観測はconfidenceが低下する
- CommunicationEventによりPerceivedWorldStateが更新される

### 11.5 審判・リクエスト

- 明白なプレーは誤審率が低い
- 僅差・遮蔽・悪角度で誤審可能性が上がる
- Physical TruthとOnFieldCallを別々に保存できる
- 真実は誤審でも、リプレイ証拠不足なら判定維持が可能
- ABSプロファイルでは許可されたtruth計測を使い、監督能力で結果が変わらない
- 同一seedで誤審・challenge・review結果まで再現できる

---

## 12. 今回確定した事項

- Simulation Clockは整数正史時間＋固定更新＋精密イベント時刻のハイブリッドとする
- 通常運動の初期候補は2ms base stepだが、性能・精度試験で校正する
- 重要接触はbase stepへ丸めず区間内時刻を決める
- 走者は守備と同じく個人判断型とする
- 走塁は加速・最高速・減速・ベース回り・帰塁・スライディング・ベースタッチ時刻を正史化する
- 三塁コーチは重要な情報源とする
- 一塁コーチも存在するが、初期は補助的情報源とし、中央司令にはしない
- 捕球はContact FeasibilityとSecure Possessionへ分離する
- catchingは直接成功率ではなく、位置誤差・身体制御・保持許容量等へ作用する
- 捕球失敗後のボールも正史物理として継続する
- 選手・走者はAttention / Observation / Memory / CommunicationからPerceivedWorldStateを作る
- 選手AIはCanonical Truthを直接読まない
- 審判もCanonical Truthを直接読まず、人間知覚からOnFieldCallを出す
- Physical Truth / Correct Rule Result / OnFieldCall / Official Rulingを分離する
- 誤審を許可する
- 監督は誤審可能性とチャレンジ価値を推定してChallengeIntentを出す
- 通常映像リプレイは証拠のみを見て覆すか決め、Canonical Truthを直接読むとは限らない
- ABS等の機械判定はRule/Competition Profileに応じて許可されたtruth計測を利用できる
- 全系で同一seed・同一Core versionの決定論的再現を維持する

## 13. 後続実装で校正する事項

本仕様の原則を変えず、後続フェーズで数値・具体アルゴリズムを決定する。

- base stepの最終値
- 各イベントのcontinuous collision / refinement方式
- Runner movement parameters
- glove reachable volumeの近似形状
- catching誤差分布・保持許容量
- Attention切替条件
- 視野角・遮蔽・Observation confidenceモデル
- Communication遅延・聞こえやすさ
- umpire能力軸
- umpire positioning model
- challenge decision threshold
- replay camera / evidence model
- CompetitionごとのChallengePolicy
