# 将来システム設計メモ

更新日: 2026-09-17
状態: 将来実装候補。優先順位未確定。現在のP0〜P9試合Coreロードマップを膨らませないため、外側のサブシステムとして整理する。

## 1. 目的

今後追加したい要素を、試合Coreへ直接埋め込まず、責務ごとに分離して保持する。

```text
Career / League World
  ├─ Competition
  ├─ Scouting / Draft
  ├─ Coach / Condition Estimate
  ├─ Player Motivation / Relationships
  └─ Incidents
          ↓
      Match Inputs
          ↓
     Shared Match Core
          ↓
   Canonical Events / Results
          ↓
Career / League World + Presentation
```

Mini Baseball と将来の Natural Baseball は、同じ Match Core を使用する。大会、長期運営、心理、オンライン表示などはCoreの外側から入力を与え、結果を受け取る。

## 2. 審判・ストライク判定・ABS / チャレンジ

### 真のゾーンと人間判定を分離する

```text
RuleStrikeZone
  + PitchWorldState
        ↓
TrueCall

UmpireModel
  + count
  + league/circuit call profile
  + pitch presentation
        ↓
CalledResult
```

- 公式ルール上のストライクゾーンと、審判が実際にコールする確率分布を分離する。
- カウントによる変化は、原則として公式ゾーンそのものではなく境界球に対する人間審判のコール傾向へ作用させる。
- リーグごとの差も、ルールそのものと審判集団の傾向を分けて表現できるようにする。
- 審判に不確実性は持たせるが、描画側から判定を変えない。

### ABS / リクエスト

チャレンジ可能回数は `ChallengePolicy` で大会別に設定する。ゲーム内の特定プロファイルで「1試合2回」などを採用できるが、Coreへ固定値を埋め込まない。

```text
CalledResult
  ↓
Player/Manager Estimate of Error
  ↓
challenge threshold
  ↓
ChallengeIntent
  ↓
ABS / replay review truth
```

- 優秀な捕手・打者・監督だから機械判定の真実が変わることはない。
- 能力差は「今の判定が誤りである可能性」を見抜く精度へ作用させる。
- 自信過剰、自己中心的、短気などの性格はチャレンジ要求閾値を下げ得る。
- 優秀な監督は、限られたチャレンジを使う価値、成功見込み、試合状況をより正確に比較できる。

## 3. 投手の癖・読みやすさ

投手には、投球前動作や球種ごとの差から生じる `TellVisibility` のような潜在情報を持たせられる。

- 投手側: 癖の強さ、再現性、球種ごとの差
- 打者/走者/コーチ側: 観察、読み、対戦経験、スカウティング

「癖がある = 常に球種がバレる」にはせず、観測情報から相手が推定する問題として扱う。

## 4. 本当の調子とコーチ予想

選手には真の `ConditionState` が存在し得るが、監督画面が直接真値を見る設計にはしない。

```text
ConditionState (truth)
   ↓ observable evidence
practice / recent play / body signals
   ↓
CoachEstimate + uncertainty
```

- コーチ能力が高いほど推定が正確になる。
- 「絶好調予想」が外れることもある。
- 真の調子と推定調子を分離する考え方は、監督のスカウティング推定と共通化する。
- `ConditionState` と `CurrentFatigue` は別状態とする。Conditionは当日の発揮状態、CurrentFatigueは累積負荷の結果であり、同じ原因を二重に能力低下へ掛けない。
- Stamina / WorkCapacity、FatigueResistance、RecoveryCapacityは選手本人の絶対身体能力として扱い、リーグ移籍だけで再スケールしない。

## 5. リプレイ・ハイライト・年間ベストプレー

試合をスキップしても、後から重要プレーを再生できるようにする。

### Play Capsule

単にシードだけを保存して現在のコードで再計算すると、将来計算式が変わったとき昔のプレーが変化し得る。そのため、再現用データはバージョン付きの正史情報として保持する。

```text
PlayCapsule
  ├─ coreProtocolVersion
  ├─ initialState / required snapshot
  ├─ participants
  ├─ StadiumProfile id/version
  ├─ seed/input
  ├─ canonical TimedMatchEvent[]
  └─ 必要に応じて圧縮keyframe
```

- リプレイは保存済み正史を読む。
- 現行アルゴリズムでプレー結果を再抽選しない。
- Miniの点描表示でもNaturalの3D表示でも同じPlayCapsuleを描ける契約を目指す。

### HighlightIndex

年間検索用には重いプレーデータを毎回読むのではなく、小さい特徴量を別途保存する。

例:

- 試合重要度
- 勝率/得点期待値への影響
- 捕球難度
- 守備移動距離
- 送球難度
- 打球速度/飛距離
- 逆転・サヨナラ性
- 珍しさ

これにより「年間ベスト守備」「年間最大逆転プレー」「最長本塁打」などを簡易集計できる。

## 6. 音響物理

ボールや送球が空気を切る音は、固定効果音を状況無視で鳴らすのではなく、可能な範囲で正史物理からパラメータを得る。

入力候補:

- ボール速度
- 観測者に対する相対速度
- 回転
- 空気密度・風
- 距離

Audio Renderer は音を生成・選択するだけで、音側からボール速度や試合結果を変更しない。

## 7. 乱闘・事件・集団反応

乱闘は将来の `IncidentSystem` として扱う。

- 死球、危険球、挑発、過去の因縁などが事件候補を作る。
- 発生した事件は各選手が個別にAppraisalする。
- 感情マークとの接続は `05-psychology-emotion.md` を正とする。
- チーム全員へ同じ怒り補正を一括配布しない。
- 退場・警告・出場停止など競技上の処分は、対応する `RuleProfile` / Competition側へ委譲する。

## 8. 長期モチベーション・移籍欲求・個人成績志向

長期状態として以下を保持できる構造にする。

- 移籍欲求
- チーム満足度
- 監督への信頼/不満
- 個人成績志向
- タイトルへの執着
- チーム優先度

これらは打席結果を直接上書きしない。

例: タイトルを強く意識している選手

```text
CareerMotivation
  ↓
DecisionBias
  ↓
長打狙い・盗塁判断・犠打受容などの選択傾向
  ↓
通常の投球/打撃/走塁Core
```

チームが負けても本人が気にしない、監督命令への遵守度が下がる、無理に個人成績を狙って打撃を崩す、といった差は意思決定の積み重ねとして出す。

## 9. ドラフト・世界スカウト

ドラフト候補探索は将来の `ScoutingSystem` とする。

初期ゲーム案:

- スカウトへ依頼し、世界中から推薦候補を最大3人提示させるモード
- プレイヤー自身が国/地域を指定し、その地域の候補約10人から選ぶモード
- 基本周期は3か月ごと＋オフシーズン1回を候補とする

ただし人数・周期はリーグ/ゲームモード設定へ逃がし、Coreへ固定しない。

スカウトは候補の真能力を直接表示しない。監督スカウティングと同様、能力推定値と不確実性を返す。

## 9.1 World League Catalog

Full Simulation対象の21リーグ、初期球団数、開催時期、Culture Seed、Player Marketは以下を正とする。

- `docs/game-design/10-world-league-catalog.md`

初期構成:

```text
Asia       5
Americas   6
Europe     7
Africa     1
Oceania    2
----------------
Full      21
Clubs    240
```

野球が主要競技ではない地域では、Academy / Transfer Fee / Loan / Training Compensation / Solidarity / Trial等のサッカー型Player MarketをCareer Economyへ採用可能とする。

これらは能力補正ではなく、選手移動・育成投資・Knowledge・Exposureを介してLeague Ecologyへ作用する。

## 10. 大会・リーグ

ペナント、国際大会、地域別クラブ大会、独自の高難度大会などは `CompetitionProfile` として表現する。

```text
CompetitionProfile
  ├─ schedule
  ├─ qualification
  ├─ roster rules
  ├─ game RuleProfile
  ├─ challenge policy
  ├─ importance model parameters
  └─ rewards / records
```

大会体系の具体案は以下の設計候補版へ分離する。

- `docs/game-design/11-world-competition-architecture.md`
- `docs/game-design/12-competition-identity-hosting.md`
- `docs/game-design/14-regular-season-calendar-and-volume.md`

内容はContinental Club Champions、Club World、Regional National Championships、Premier 12-class、WBC-class、および4年周期Calendarを対象とする。

特定の大会名をMatch Coreの条件分岐に埋め込まない。

また、`CompetitionProfile` は選手の所属リーグ基準の公開能力値を上書きしない。

- 代表招集
- 地域 / 大陸クラブ大会
- 国際クラブ大会
- WBSC系大会
- WBC級世界大会

等への一時参加では、選手の `ratingContextLeagueId` は所属リーグのままとする。

国際大会Rosterでは異なるリーグ基準の選手カードが混在してよい。必要なら表示上で基準リーグを注記するが、一つの大会基準へ自動換算しない。

実際に所属リーグが変わる移籍時のみRating Contextを切り替え、新リーグでの評価不確実性はKnowledgeEstimate側で扱う。

## 11. 永久保存選手 / 特殊キャリア制度

40歳を超えて現役であり、各地域の厳しい審査を通過した選手を「永久保存選手」にする案は、一般野球ルールではなく独自キャリア制度として扱う。

`LegendPreservationRule` のようなモード固有ルールとして、以下を設定可能にする。

- 年齢条件
- 現役条件
- 地域/大会ごとの審査基準
- 代表選出不可
- 特定リーグでの生涯出場権

この制度は通常の選手能力や試合物理を変更しない。

## 12. タイトル・実績の表示

三冠王などの実績により翌年の名前/フォント周囲を変える演出はPresentation層で行う。

```text
CareerAchievement
  ↓
PresentationBadge / FontDecoration
```

実績表示が能力へ直接補正を与えない限り、試合Coreへ入れない。

## 13. マルチプレイ・匿名コメント

マルチプレイの匿名コメント/ニコニココメント風オーバーレイはOnline Presentation層とする。

- コメントは試合Coreへ入力しない。
- 表示のON/OFF、遅延、匿名ID、モデレーションをCoreから分離する。
- 将来Naturalへ移行しても、同じオンラインコメントサービスを別Rendererへ重ねられる構造にする。

## 14. 選手写真・モブ画像

選手の写真/アイコンはAsset層で管理する。

- 基本は一選手一画像でよい。
- 感情マークは写真そのものを大量差分化せず、アイコン上へオーバーレイできる。
- モブ選手が正式登録された時に、候補画像プールから適切な一枚を割り当てる仕組みを採用できる。
- 画像選択は試合能力へ影響しない。

## 15. 共通設計原則

今回の将来案は、次の原則へ統一する。

### 真実と推定を分ける

- 打者の真傾向 vs 監督のScoutingEstimate
- 真のCondition vs CoachEstimate
- 真の投球位置/ルール判定 vs UmpireCall
- 真の誤審有無 vs 選手/監督のChallengeEstimate
- 真のドラフト能力 vs ScoutEstimate
- 真の能力 vs 移籍後の新リーグKnowledge / Fit Estimate

推定系は用途ごとに別実装へ分裂させず、将来的に共通の `KnowledgeEstimate<T>` 境界へ寄せる。

```ts
type KnowledgeEstimate<T> = {
  estimate: T;
  uncertainty: number;
  evidenceCount: number;
  observedAt: SeasonTime;
  source: KnowledgeSource;
};
```

新人、外国人、ドラフト候補、移籍直後の選手、対戦相手の傾向推定で、「能力が低い」と「まだ分からない」を同じ低評価へ潰さない。

### 結果を直接補正しない

「性格が悪いからエラー率+10%」「名監督だからリクエスト成功率+20%」のような直接補正を避け、情報、判断、時刻、意図、実行を変えて結果を発生させる。

### 表示は観測者

リプレイ、ハイライト、音、コメント、写真、タイトル装飾は正史データを観測・表現する。表示の都合で過去の試合結果を作り直さない。

公開0〜100、G〜S、Trait表示、リーグ相対Projection等も同じ原則に従う。表示式や境界を変更しただけでMatch CoreのCanonical Eventsが変化してはならない。

## 16. 実装順序

これらは現行P0〜P9より後、または既存フェーズへ明確に必要になった時点で個別サブプロジェクトとして設計・実装する。

一括実装しない。候補順は概ね以下とする。

1. 心理・感情マーク（別文書 `05-psychology-emotion.md`）
2. 審判・ABS/チャレンジ
3. PlayCapsule / HighlightIndex
4. Condition / CoachEstimate
5. 長期モチベーション・関係
6. Incident / 乱闘
7. Competition / Career / Scouting
8. Online Presentation / Asset / 音響拡張

この順序は確定ロードマップではなく、依存関係を示す整理である。


## 17. 選手特殊能力 / Trait System

選手の特殊能力・行動傾向・状況適性・Relationship Traitについては、承認済みの設計文書を別文書で保持する。

- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/09-player-trait-catalog.md`

設計原則とTraitカタログは承認済みだが、まだ実装仕様ではない。具体的な獲得閾値、効果量、成長・減衰式、保存形式はPlayer / Career / Pennant / Development実装設計で確定する。

将来 `Player / Career / Pennant / Development` を設計する際には、この設計シードを入力として参照し、得能のEvidence、獲得・消失、Relationship履歴を後から表現不能にするデータ構造を避ける。


Season events and deadlines:
- `docs/game-design/15-season-events-and-deadlines.md`


Club economy / football motif / directed rivalry:
- `docs/game-design/16-club-economy-rivalry-design.md`


Europe real club catalog:
- `docs/game-design/17-europe-real-club-catalog.md`


Club state lifecycle / pennant save boundary:
- `docs/game-design/18-club-state-lifecycle.md`


Club structural dominance / decline:
- `docs/game-design/19-club-structural-dominance-and-decline.md`
