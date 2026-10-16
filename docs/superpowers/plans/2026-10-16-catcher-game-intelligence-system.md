# Catcher Game Intelligence System v1 — 実装計画

> **状態:** IMPLEMENTATION PLAN / PROPOSED / NOT IMPLEMENTED
>
> **作成日:** 2026-10-16（JST）
>
> **対象:** Kneekura Mini Baseball、共有 Match Core（将来の Natural Baseball と共用）
>
> **監査基準:** `jolly/core-foundation-plan-2026-09-17` の `7993518eff216382543abe7636adee7bca277058`。実装開始前には作業ツリー・HEAD・他作業者・既存統合テストを再確認すること。
>
> **作業境界:** この文書は新たな実装提案であり、既存の CANONICAL / DESIGN FROZEN 文書を上書きしない。承認前にランク、能力、物理、規則を変更しない。
>
> **実装者へ:** 現行ブランチで契約を照合し、依存する機能が未実装なら pure な Headless Decision Slice とテストを先に完成させ、正式な Match Core 統合を偽装しない。実装・検証は関連モジュールを一括で完成させる方針。段階表は依存順序であり、無用に細切れの暫定機能を本番投入する指示ではない。

## 0. 目的・非目的

### 目的

現実の捕手と打者が行う「場面を読む → 投手・相手を理解する → 次球を予想する → 球種とコースを選ぶ → 互いの読みを修正する」という因果的な思考を、単一の汎用 Decision System として表現する。

要求される振る舞い:

1. 満塁3ボールなら、押し出し四球の損失を理解してゾーンへ投げさせる方向を検討できる。しかし、機械的に必ず真ん中を要求するわけではない。
2. 捕手は投手の球種・制球・疲労・当日の再現性、打者の傾向と不確実性、カウント・得点・アウト・回・走者、監督方針、直前の投球履歴から候補を比較する。
3. 打者も同じ公知の試合状況を理解し、捕手・投手の過去の行動から次球を予測する。捕手の隠し意図や確定したサインを読むわけではない。
4. 捕手の内部技能7領域の違いが候補発見・状況理解・推定精度・更新速度・連携品質に現れ、既存の `キャッチャー G〜A / 球界の頭脳` はその Source State から導出する。
5. 監督の通常哲学／Game Plan／Immediate Command と、捕手本人の長期的な好みを分離し、既存の Soft Directive と Hard Sign の扱いを守る。
6. 「裏をかく」は万能ボーナスにせず、相手が予想している候補・予想精度・対策可能性を推定したうえで選択できる。高能力でも読み負ける。
7. 既存の PitchCall / CadencePlan、投手主導権、投球・打撃・物理・審判・公式記録の Source of Truth を変更しない。

### 非目的

- 捕手Traitから投手球速・回転・制球・打者ミート・被打率・勝率等への直接Buffを追加しない。
- 成功・失敗の結果を先に抽選して、それらしい投球やスイングを後付けしない。
- 「3-0なら真ん中」「フルカウントなら直球」といったカウント専用ハードコードで場面を処理しない。
- 毎球LLM/APIを呼ばない。通常運用はローカルで再現可能な TypeScript の決定論的 Decision Engine とする。
- 先にUIを複雑化しない。監督の通常操作は理解しやすい方針選択を維持する。
- 本計画だけで未完成の9回完走、RuleEngine、完全な投球物理、オフライン保存、Natural描画を実装済みと主張しない。

## 1. 軽量互換性監査（2026-10-16）

| 現行正史・確認事項 | 判定 | 本計画が守る境界 |
| --- | --- | --- |
| `09-player-trait-catalog.md` は Trait Family / Lifecycle の正本。`キャッチャー G〜A / 球界の頭脳` は pitcher handling / game-calling / communication の Graded Family + Gold。Gold は Dynamic Current Master Tier。 | 適合 | 同一家族の排他表示。能力原因 → 決定 → 証拠 → Grade。Grade を入力としてBuffしない。 |
| `49-manager-architecture-v1.md` は監督判断の正本。Default Philosophy / Game Plan / Immediate Command、Hard/Soft、六Forecast Channels、Decision Log を規定。 | 適合・要接続 | 新しい捕手AIが監督Agentを複製・改変しない。指示の受信・理解・実行を Player Response として扱う。 |
| `08-player-traits-design-seed.md` はGreenを Slow Default Preference とし、指示の強さと本人傾向を別入力とする。 | 適合 | 監督方針で捕手のGreenを永久変更しない。判断の危険選好は知能とは別軸。 |
| `2026-09-23-pitch-timing-cadence-quick-delivery.md` は `PitchCall`（球種・コース・目的）と `CadencePlan`（始動・間合い）を分離し、`CATCHER_LED` / `PITCHER_LED` / 将来 `NEGOTIATED` を定義。 | 衝突注意 | 受理されたPitchCallをテンポ技能が改変しない。主導権は既存のバッテリー契約に従う。 |
| `2026-10-07-pitch-arsenal-development-system.md` は PLANNED。球種数ではなく球質・差別化・信頼性・戦術的利用が価値を決める。 | 適合 | 持っていない球種を要求しない。球種数への固定知能ボーナスは禁止。 |
| `05-psychology-emotion.md` と Perceived World 契約は心理・知覚を真実から分離し、ActiveEmotion以外の通常の感情Buffを禁止。 | 適合・要接続 | 「重要局面の認識」は通常の意思決定。「恐怖で技能低下」は既存の発火ゲートを経由。 |
| 実リポジトリの `src/core/index.ts` はまだ `src/core/sim/pitch` をexportしておらず、`CanonicalMatchState` は count/outs/bases/score を保持。10/14の実戦統合文書も `NOT YET VERIFIED`。 | 未実装依存あり | 既存実装と未実装の計画を区別し、独立 Headless Decision Slice で検証した後に正規 Pitch Pipeline へ接続。 |

### 監査で確定する修正

- **7技能は「汎用IQ×7」の追加ではない。** 互いに異なる役割を持つ Domain Skills の分解であり、既存の技術・経験・知覚・連携から形成される。重複する原因を二重入力しない。
- **A / Gold ≠ 未来予知。** 高評価の捕手は平均的には質の高い情報処理が可能だが、誤認・裏目・強打・制球ミスは起き得る。
- **大胆さ ≠ 頭のよさ。** リスク選好・新しい配球への好み・方針の固執は別のSlow Preferenceに置く。Gでも合理的な正解を選べ、Goldでも保守的な選択をし得る。
- **捕手と打者は別々の知識世界を持つ。** 選択されたPitchCallや打者の真の待ち球を相手に漏らさない。
- **軽量プレビューと実試合は別。** 候補のForecastを比較しても、その結果で物理やOfficial Resultを上書きしない。

### 現行参照文書（優先順位）

1. [Current Design Handoff](../../game-design/00-current-design-handoff.md) — 文書Status・Source Precedence・不変原則。
2. [Trait Catalog](../../game-design/09-player-trait-catalog.md) — 捕手Graded Family・Gold・Lifecycleの正本。
3. [Manager Architecture v1](../../game-design/49-manager-architecture-v1.md) — 監督方針・命令・Decision Recordの正本。
4. [Player Trait Design Seed](../../game-design/08-player-traits-design-seed.md) — PreferenceとCommandの境界。
5. [Pitch Timing / Battery Authority](2026-09-23-pitch-timing-cadence-quick-delivery.md) — PitchCallとCadencePlanの境界。
6. [Pitch Arsenal Development](2026-10-07-pitch-arsenal-development-system.md) — PLANNED 球種・武器・習熟。
7. [Time, Running, Catching, Perception, Umpire](../specs/2026-09-17-time-running-catching-perception-umpire-design.md) — perceived vs canonical truth。
8. [Psychology](../../game-design/05-psychology-emotion.md) — ActiveEmotion境界。
9. [First Playable Match Slice](../../implementation/2026-10-14-tbd-vs-lad-match-slice.md) — 実戦結合・未検証依存。

## 2. 統合アーキテクチャ

```text
CanonicalMatchState（公知スコア、アウト、カウント、走者）
 + ObservedPitchHistory（見えていた過去球・打席履歴）
 + Team/Scouting KnowledgeEstimate（根拠・不確実性・時刻つき）
 + ObservedPitcher/Batter State（投捕それぞれが知る範囲）
 + Manager Pitch Directive（優先度・有効範囲・指示内容）
 + Catcher Cognitive Source / Slow Preference / Battery Relationship
                      │
                      ▼
  [Catcher Belief Builder]（全知禁止、履歴の古さと不確実性）
                      │
                      ▼
  [Candidate Generator]（保有・実行可能球種 × 実行可能照準 × 目的）
                      │
                      ▼
  [Batter Response Forecaster]（打者の「予想」を捕手が推定）
                      │
                      ▼
  [Bounded Candidate Comparison]（四球・強打・空振り・制球の危険）
                      │
                      ▼
  [Battery PitchCall Authority]（CATCHER/PITCHER/NEGOTIATED）
                      │
                      ▼
         Accepted PitchCall（読み取り専用）
              + Separate CadencePlan
                      │
                      ▼
         Existing Pitch Execution / Canonical Flight
                      │
                      ▼
           Batter Observed Pitch / Recognition
       + Batter's own Pre-pitch Pitch Belief
                      │
                      ▼
            Swing / Take Decision / Contact Physics
                      │
                      ▼
       Official Rules, outcome, separate perception evidence
                      │
                      ▼
       Next-pitch Catcher/Batter memory and uncertainty update
```

**鍵:** 捕手側の Forecaster に与える打者モデルは捕手の推定であり、打者本人の内部 `BatterPitchBelief` ではない。両者を同じオブジェクトにしない。打者の予測は当該投球の実際のサイン確定前、公開情報と観測履歴のみから構築する。リリース後の軌道認識は別途更新してよいが、サインや未来の球道は見せない。

## 3. 内部技能・好み・現在状態の定義

```ts
type CatcherCognitiveSource = Readonly<{
  situationReasoning: number;     // 得点・カウント・アウト・失点コストの理解
  batterReading: number;          // 打者の狙い/反応を証拠から推定
  pitcherUnderstanding: number;   // 投手のArsenal/制球/疲労/信頼性の把握
  sequenceConstruction: number;   // 前球と次球をつなぐ配球構築
  strategicCounterplay: number;   // 相手の予測・裏読みへの対処
  evidenceAdaptation: number;     // 新たな打席Evidenceへの更新
  communicationExecution: number; // 意図伝達・投手との意思疎通
}>;

type CatcherDecisionPreference = Readonly<{
  riskAppetite: number;          // 高リスク許容（知能ではない）
  edgeAttackPreference: number; // 境界を攻める習慣
  noveltyPreference: number;    // 配球変化への積極性
  policyPersistence: number;    // 従来方針への固執度
}>;
```

- `number` は例示的な連続source。初期データ作成・テストでは正規化値を使ってよいが、Grade境界・係数・閾値をこの文書だけで確定しない。
- 7領域の内部処理に独立した原因が見いだせなければ既存sourceを共有する。見かけ上7つの別Buffを重ねない。`communicationExecution` は投手のSkillを書き換えず、理解・伝達・受諾・実行再現性の途中に作用する。
- 知識は技能とは別。未対戦の強打者にGold捕手が誤認する余地、経験豊富なG捕手が特定の投手をよく理解する余地を残す。
- `CatcherDecisionPreference` は数球の結果だけでは永久変更しない（Slow State）。
- `pitcherConfidence` や `trust` を固定された捕手知能に混ぜない。監督・投手・捕手の関係Stateから受け取る。
- プレッシャーは通常の損失評価と区別する。感情による判断能力の歪みは `ActiveEmotion` 成立時のみ既存Psychologyから入力する。

## 4. 情報・記憶・不確実性

### CatcherPerceivedPitchContext

最小契約:

- `publicGame`：現在の回、表裏、点差、アウト、カウント、走者占有、大会のルール/局面（公知）。
- `pitcherObservation`：本人が知る球種集合、最近の制球傾向、疲労の兆候、捕手が実際に観測した投球信頼性。真の乱数や未来の制球誤差は渡さない。
- `batterEstimate`：過去の打席・動画/スカウティング・投球に対する反応から作った `KnowledgeEstimate`（根拠数、古さ、不確実性）。
- `pitchHistory`：実際に認識できた球種/コース/結果/テンポの時刻付き記録。認識失敗と遅延も表現可能。
- `directive`：監督方針と有効範囲・伝達状態。
- `battery`：主導権、関係、既知の投手Preferences。

### BatterPrePitchBelief

別Sourceとして:

- 公知カウント・得点・走者、投手/捕手の可視履歴、対戦経験、味方のスカウティング情報を入力。
- 次球の `pitchFamily / region / approximate speed / timing` を確率・不確実性つきで予想。
- 高い知覚/経験があっても、捕手の未公開サイン、生成中の乱数、PitchCall object、Canonical futureを読めない。
- 打者は予測だけでなく、3-0で四球を取る価値・得意ゾーン・スイングリスクから `TAKE / SWING` 方針を選ぶ。実行スイングは別の身体・認識・打撃技術に従う。
- ゾーン外打撃が成立しても `悪球打ち` を直接接触Buffとして呼び出さない。2026-10-14の正本に従って実際のバット軌道保持へ接続する。

### 記憶更新

- `PrePitchBeliefSnapshot` → PitchCall確定 → 投球 → 公開・観測できたEvidence → `PostPitchBeliefUpdate` の順序を固定。
- 新Evidenceでの変化は適応技能と証拠の信頼性に依存。単発の偶然を確実な法則にしない。古い・相反する証拠の重みを下げ、学習忘却は根拠がある範囲で校正。
- 先読みの深さを無制限に再帰させない。Routineは少数の反応モデル、重要局面のみ上限付き追加比較。Grade固定の「Aなら3手読める」は採用しない。
- 情報が欠けた場合は不確実性の高い事前分布へフォールバックし、相手の真値を読んで穴埋めしない。

## 5. 監督指示を球種・コースの選択へ翻訳

実装層は `49 Manager Architecture v1` の出力のみを受ける。監督の内部Belief/Skillを捕手Decision内で再計算しない。

```ts
type ManagerPitchDirective = Readonly<{
  source: 'DEFAULT_PHILOSOPHY' | 'GAME_PLAN' | 'IMMEDIATE';
  strength: 'SOFT' | 'HARD';
  scope: 'SEASON' | 'GAME' | 'PLATE_APPEARANCE' | 'NEXT_PITCH';
  receivedAtTick: number;
  intent: Readonly<{
    zoneEntryPreference?: 'AGGRESSIVE' | 'BALANCED' | 'AVOID';
    locationPreference?: 'CENTER_SAFE' | 'EDGE' | 'OUTSIDE_ZONE';
    pitchFamilyPreference?: 'FASTBALL' | 'BREAKING' | 'BALANCED';
    explicitCall?: Readonly<{ pitchId: string; targetRegion: string }>;
    tacticalReason?: string;
  }>;
}>;
```

- `zoneEntryPreference=AGGRESSIVE` は「ストライクゾーンへ投げる確率 +X%」ではない。要求する照準・球種・リスク評価の事前方針を変える。
- `AVOID` / `OUTSIDE_ZONE` はボール先行・誘い球・明示的外し球などの意図を表せる。`zoneEntryPreference` と `locationPreference` は必要に応じて分離。
- `CENTER_SAFE` でも実際の投球が真ん中になる保証はない。打者との接触後の結果は正史物理。
- DefaultとGame Planは本人Preferenceに重ねるが、局面が危険になれば合理的に方針を修正できる。`ボール先行` を「3-0でも強制して四球を出す」と解釈しない。
- `IMMEDIATE + HARD` は伝達・理解・受諾・合法性を確認して原則優先する。反発/首振りを実装する際は明示イベントで追跡し、知らぬ間に無効化しない。
- 監督のハード指示が「外せ」であれば、たとえ満塁3-0でも認識・受諾した場合は外す要求が成立し得る。結果上の不合理は監督判断の責務であり、捕手AIが密かに書き換えない。
- 指示と他方針が衝突した場合は `source` / `strength` / `scope` / `issuedAt` をもとに解決し、決定記録に残す。既存の `Hard Sign vs Soft Directive` を優先。
- 監督入力を知らない CPU 側にも同じAction Spaceを使う。人間プレイヤーの命令をAIの「賢さ」によって勝手に上書きしない。

## 6. 配球候補と評価

### 候補

`PitchCandidate = (available pitch ID/family, plate-fixed target, tactical purpose, planned precision/effort constraints)`

- Pitcherの実在するArsenal/投球可能状態から候補生成。球種名・成長段階だけで自動的に有利と判定しない。
- 目標コースは現在の規則・打者・身体・投手フォームに適合するplate座標系で指定。既存 `55-pitch-release-geometry-v1.md` のRelease Geometryは変更しない。
- 「ゾーン中央」「内外低高」「ストライク/ボール境界」「明示的に外す」「決め球」「見せ球」は候補カテゴリとして評価可能。ただし結果を決めるラベルではない。
- 投手の実際のコマンド分布（不確実性つき）を用いて、要求位置と実際の通過位置のずれを予測する。
- 例: 3-0で制球が荒れる投手なら、境界を要求する損失が上がる。しかし3-0=必ず中央要求とはならない。

### 候補比較

現行Manager v1の六チャネル比較と整合し、試合に関係する項目だけを活性化:

1. **Competitive Outcome**: count遷移、walk/strikeout/接触の可能性、失点・得点差・勝敗への影響。押し出し四球は実Rule Profileに従う。
2. **Execution Feasibility**: 投手の対象球種・コースでの再現性、疲労、捕手の理解・伝達・受球可能性。
3. **Opponent Response / Information**: 打者の待球/積極スイング、得意ゾーン、現在の予想、情報を見せることの将来価値。
4. **Resource / Health**: 必要な場合のみ球数・疲労・長期登板への影響。
5. **Human / Relationship**: 指示受諾・投手の意思・信頼の実際の連携。
6. **Exceptional Objective**: 指示された大会・局面だけで意味がある場合。

全項目を常に足し合わせる巨大なスカラーUtilityを新設しない。必要なチャネルだけで候補を比較し、合法性/実行可能性フィルタ、Dominance Pruning、許容差のある候補間のリスク・個性選択を行う。

Forecasterは精度を落とせる近似でよいが、count・walk・アウト・得点の整合性は Rule Profile と実験資料で検査する。Forecastした安打/アウト/本塁打を実際のMatch結果として注入しない。

### ルーティン・重要局面

- Routineは常用Policyから小さな候補群を比較するFast Path。
- 押し出し危険、9回僅差、3-2、打者の予想外な適応等は、上限付きの追加候補・比較を許可。
- 候補数・再帰深度・相手反応分岐数・使用メモリには厳密な決定論的上限を設ける。初期チューニング例はRoutine 16候補／重要局面48候補（**未Freeze、性能検証で校正**）。
- 高知能は候補の質・証拠の解釈・誤差校正を改善し得るが、評価結果へ直接勝率ボーナスを掛けない。
- 意外な球を投げること自体に得点しない。相手の予測と準備に実際のずれが出た場合にのみ、その先の認識・打撃が変わり得る。
- 打者が裏読みを読んだ場合、意外性がゼロまたは逆効果にもなり得る。

## 7. バッテリー主導権 / Cadence / 物理境界

```text
CATCHER_LED
 Catcher Decision → proposed PitchCall → pitcher acceptance
   → accepted PitchCall → separate pitcher CadencePlan → execution

PITCHER_LED
 Pitcher Decision (+ catcher advice, when communicated)
   → accepted PitchCall → separate CadencePlan → execution

NEGOTIATED (extension)
 proposed calls / shake-off / communication events
   → one final accepted PitchCall
   → separate CadencePlan → execution
```

- 2026-09-23計画が予約済みの `src/core/sim/pitch/BatteryPitchDecision.ts` を統合点とする。既に存在する場合は重複作成せず適合・再利用。
- `CATCHER_LED` でのみ捕手が最後の配球候補を選べる。`PITCHER_LED` で捕手は有用な助言を行えるが、投手の承認を黙って奪わない。
- `NEGOTIATED` を扱う場合も有限の交渉回数・タイムアウト・明示決着を規定し、正史ログにProposal / ShakeOff / Acceptanceを残す。初期統合未対応なら設計契約とテストfixtureのみを維持し、実装済みと表示しない。
- 配球主導権を変えても、**同じaccepted PitchCall、同じpitcher execution inputs、同じseed** ならPitch Physicsが変化しない。
- `緩急○` と `クイック` は PitchCallを上書きせず既存Cadence系を通す。打者のタイミングへの影響は実際に観測された準備のずれから発生。
- 捕手技能は捕逸/ブロッキング/フレーミング等の別システムへ無根拠に流用しない。指定された投球が捕球可能かの実行可能性だけは正しいSourceから参照する。

## 8. Trait Projection と学習

- 既存 `09` の `キャッチャー G/F/E/D/C/B/A/球界の頭脳` は同一Graded Familyの排他状態。`球界の頭脳` を A に加える二段Buffは禁止。
- Gradeは `pitcher handling / game-calling / communication` の役割に対応する現在の技能sourceから投影。7領域の単純平均を自動で採用せず、根拠ある役割・証拠を確認して集約する。
- Goldは `GRADED_DYNAMIC` の Current Master Tier。習熟・適応・衰え・役割変化に応じてgradeが上下し得る。ラベルから選択率・成績を強制補正しない。
- 熟練度と対戦経験/相手の知識は別。Goldの初対戦は不確実、Gでも特定相手の過去情報は豊富になり得る。
- 育成期間中の新たな学習・指導が実際の技能sourceに作用した場合のみGradeへ反映。単に配球が当たったから即Gold、打たれたから即Gとはしない。
- 成績は後からEvidenceになるが、打撃結果の偶然と意思決定の適切さを区別する。キャリア成長との接続は既存 `53-player-development-trajectory-breakthrough-v1.md` に委譲し、別育成エンジンを作らない。
- Grade閾値・各技能の校正値・Gold昇降のEvidence期間は試験結果と既存Lifecycleに従う。`09` の変更が必要になったら実装側が黙って書き換えず、別途レビューする。

## 9. 決定記録・説明可能性

```ts
type CatcherDecisionTrace = Readonly<{
  version: 1;
  playId: number;
  pitchOrdinal: number;
  preDecisionTick: number;
  catcherId: string;
  pitcherId: string;
  batterId: string;
  authority: 'CATCHER_LED' | 'PITCHER_LED' | 'NEGOTIATED';
  directiveProvenanceId?: string;
  beliefSnapshotId: string;  // 意思決定時に利用可能だったEvidenceのみ
  consideredCandidateIds: readonly string[];
  chosenPitchCallId: string;
  dominantTradeoffs: readonly string[];
  uncertaintyTags: readonly string[];
}>;
```

- 判断の **前に** 取得したBeliefと候補比較根拠を記録する。後から打たれた/抑えた結果を使って過去の「思考」を作文しない。
- 通常の大量Pitchは簡潔なdecision hash/provenanceだけ残し、特別な判断や検証対象は詳細ログを保持。長いキャリアで無制限にログ増加させない。
- 人間UIでは「押し出し警戒でゾーン重視」「3-0待球傾向を考慮」等の根拠だけを、公開してよい範囲で表示する。捕手の内部確率・相手の真技能・心理ゲージを通常UIに漏らさない。
- 同じ入力・同じseed・同じCore Versionから同じtrace/accepted callが再生されなければならない。

## 10. 実装ファイル配置（新規案、作業時HEADで照合）

現行 `src/core` はTypeScript ESM / Vitest。以下は **新規提案パス** であり、既存ファイル名を存在済みと誤認しない。

```text
src/core/decision/pitching/
  PitchDecisionTypes.ts           # 候補・target・intent・decision context
  CatcherCognitiveState.ts        # 7 skills + 慎重/大胆 preference（原因の重複禁止）
  CatcherPitchMemory.ts           # pre/post pitch evidence・忘却・uncertainty
  CatcherBeliefBuilder.ts         # 観測とScoutingから推定
  ManagerPitchDirective.ts        # 監督出力のコンパイル・Hard/Soft解決
  PitchCandidateGenerator.ts      # 合法/実行可能Arsenalとtarget
  BatterResponseForecast.ts       # 捕手が推定する打者の反応
  PitchCandidateEvaluator.ts      # 条件付きチャネル評価・bounded search
  CatcherGameCaller.ts            # proposed PitchCall作成
  CatcherTraitProjection.ts       # 正本09のGraded Familyへprojection
  PitchDecisionTrace.ts           # immutable pre-outcome evidence
  BatterPitchBelief.ts            # 打者本人の独立予測・認識連携
  *.test.ts                       # source-unit + adversarial tests

src/core/sim/pitch/
  BatteryPitchDecision.ts         # 既存09/23 planの予約された統合点
  BatteryPitchDecision.test.ts

src/core/decision/pitching/
  CatcherGameIntelligence.integration.test.ts
  CatcherGameIntelligence.acceptance.test.ts

docs/superpowers/plans/
  2026-10-16-catcher-game-intelligence-system.md
```

- 当該作業ブランチに同等既存モジュールがあれば統合・改名で一本化する。新しい平行CoreやLegacy独立試合エンジンは作らない。
- `CanonicalMatchState` の既存公知情報は読み取りだけに使い、RuleEngine確定前の未検証状態を正史に挿入しない。
- Match Coreが未実装の機能へ接続する場合は `Adapter` とfixtureで境界を定義し、未接続ステータスを明記する。
- `src/core/index.ts` からのexportは必要な純粋公開型・functionのみ。Presentation/DOM/network/日時などに依存しない。
- 主なテストコマンドは `npm run typecheck`、`npm test`、`npm run verify`。実行していないテストをPASSと記録しない。

## 11. Codex実装タスク（依存順、最終的には一括統合・一括検証）

### Task A — HEAD再監査と契約テスト

- [ ] HEAD/作業ツリー/並行実装を確認。既存 `BatteryPitchDecision`、Manager v1、RuleProfile、Batter Decision、Pitch Physics の実物実装を再確認。
- [ ] 現在の正本09/49/09-23との依存グラフを検査し、この計画書のProposed Typesと衝突する既存実装があれば後継でなく Adapter を優先。
- [ ] 不変テスト先行: Grade逆流禁止、Accepted PitchCall変更禁止、時刻/seed不変、True Stateリーク禁止、描画無関係、Hard/Soft優先。
- [ ] 実装依存が未完成の箇所を `NOT IMPLEMENTED` と記録。既存合格ゲートへ偽fixtureのPASSを混ぜない。

**完了条件:** 正史に対する変更境界と、先行依存の実装状態をテストで説明できる。

### Task B — Catcher Source、Memory、Knowledge契約

- [ ] 7技能 + Slow Preference + observed state を独立に生成・保存・ロードできる純粋モデルとして導入。
- [ ] Evidence（試合中履歴・相手Knowledge・投手理解）に source/age/confidence を含める。
- [ ] 初対戦、情報不足、前打席の観測誤り、対戦後適応をテスト。無情報を隠れ真値で補填しない。
- [ ] 技能だけ/知識だけ/好みだけ/信頼だけを入れ替える反事実テストを追加。

**完了条件:** 同じGradeでも異なるタイプの捕手が生じ、過去データの有無に応じて判断根拠が変わる。

### Task C — Manager InstructionとBattery主導権

- [ ] Default/GamePlan/ImmediateとHard/SoftをTyped Directiveに変換。
- [ ] 「ゾーン重視」「ボール先行」「外角中心」「次の一球は外す」「敬遠」等の指示を候補生成・実行制約へ接続。
- [ ] 範囲満了、衝突、誤伝達、理解不能、プレーヤーの明示命令をテスト。
- [ ] `CATCHER_LED` / `PITCHER_LED` に基づき誰が提案し誰がacceptしたかを保存。`NEGOTIATED` は結合可能な明示契約を用意。
- [ ] 投球開始テンポは別Resolverへ渡すだけ。accepted PitchCallは読み取り専用で固定。

**完了条件:** Hard Signが暗黙に消されず、Softは通常の意図に統合され、主導権を変えても同じ受理callの物理は同一。

### Task D — 候補生成・局面評価・bounded search

- [ ] 実在Arsenal/制球信頼性/target legality/RuleProfileに沿った候補を生成。
- [ ] 走者・アウト・カウント・勝敗への影響を目的として評価（特別な満塁パッチは禁止）。
- [ ] 打者の予測・カウント別スイング傾向を相手のKnowledgeEstimateから予測し、近似Forecasterへ入力。
- [ ] 大胆さと技能がそれぞれ候補選択へ影響することを反事実テストで確認。
- [ ] Routine fast path、high-leverage bounded comparison、候補 tie-break と Named Seed Streamを実装。
- [ ] フォアキャストと真のMatch Resultを分離する。候補採択だけを正史Actionに出力。

**完了条件:** 同じ満塁3-0でも、投手の制球、打者の待球傾向、点差、指示で選択が合理的に変わり、常に真ん中になる単一分岐を持たない。

### Task E — 打者側の独立予測と対戦学習

> **2026-10-16 implementation supplement:** [Batter Anticipation, Intent & Adaptive Swing](2026-10-16-batter-anticipation-intent-adaptive-swing.md) が本Taskの詳細実装仕様。`BatterPitchBelief.ts` とその関連型は**両計画で一つだけ**実装し、打者の主観的予測・狙い方・実際の身体制御を分離する。既存公開能力ミート/パワー/選球眼とTraitの元Sourceを再利用し、Gradeや能力表示から直接結果を補正しない。

- [ ] 捕手と別の `BatterPrePitchBelief` を作り、公開状況と過去球から確率的に予測。
- [ ] 待球・スイング方針が予測と状況へ反応する。ただし実際のBall Recognition / Swing / Contact は既存実装に委譲。
- [ ] リリース前にPitchCallや未来のBallFlightを読めない契約テスト。
- [ ] 前球に対する適応、予想外投球、読まれた裏かき、待球/強振、予測更新の過敏さをテスト。

**完了条件:** 双方が不完全情報で読み合い、結果に直接Buffをかけず、別々のBeliefに基づく異なる判断を行える。

### Task F — Grade ProjectionとEvidence、決定Trace

- [ ] 正本09のCatcher Family定義を一か所から参照。新しい重複Grade定義を作らない。
- [ ] 7技能・役割source → 現在のG〜A/Goldへprojection。A+Gold二重発動禁止。
- [ ] Grade変更がPitchCallや物理への直接入力にならないテスト。
- [ ] 当時の知識・候補・指示・選択・不確実性のimmutable decision trace。
- [ ] 長期保存の圧縮方針とバージョニング。数値閾値はEvidenceが集まるまで校正対象。

**完了条件:** 「なぜその配球だったのか」を後知恵なしで再現でき、同じ技能Sourceから違うラベルの重複Buffが生じない。

### Task G — 物理Core結合・受け入れ検証

- [ ] 完成した Decision Slice を正式PitchPipelineへ接続。未実装のNative Producer/Full Matchはそれぞれ未接続ゲートとする。
- [ ] 投球の要求位置 → 物理的な実際のリリース・球道、打者予測 → 実際の認識/打撃、RuleEngine → Official Result の唯一の正史経路を維持。
- [ ] Mini/Natural/desktop/mobileのPresenterが変わってもPitchCall・DecisionTrace・Official Resultが同一になることを確認。
- [ ] 一括 `npm run verify`、重点Unit、seed sweep、長時間試合、cross-device exportのうち実行できたものをPASS/FAIL/NOT_RUNで分類。
- [ ] 計画・実装・検証を分けた正確な完了報告を作成し、Regressionがあれば修正して再検証。

**完了条件:** 既存の正史結果を変える裏経路・固定シナリオ処理・リプレイ違いがなく、全対象テストで決定の原因と結果が説明できる。

## 12. 必須受け入れシナリオと反証

| ID | シナリオ | 検証すべき性質 |
| --- | --- | --- |
| CATCH-01 | 満塁3-0、1点リード、2アウト | 四球の損失を評価しゾーン重視が有力になる。ただし中央固定でない。 |
| CATCH-02 | CATCH-01の投手だけ制球が悪い | 照準を広く/安全側に移す根拠が変わり得る。制球能力を直接上げない。 |
| CATCH-03 | CATCH-01の打者だけ3-0強振傾向が強い | 真ん中要求の価値が下がる可能性を評価。捕手は真の隠し傾向を読めない。 |
| CATCH-04 | CATCH-01の打者が高い四球選択傾向 | より安全なゾーン投球を選ぶ選択肢を理解できる。 |
| CATCH-05 | 同じ3-0でも序盤大量リード vs 9回同点 | カウント同一でも損失/勝敗文脈で判断が変わる。 |
| CATCH-06 | 3-1と3-2の満塁、二死 | ストライク・四球・ファウル・空振り・打球のcount推移が正規Ruleに従う。 |
| CATCH-07 | 監督が通常「ボール先行」、満塁3-0 | Soft方針でも局面で修正可能。Green書換えなし。 |
| CATCH-08 | 監督が明示「この球は外せ」（Hard） | 理解/受諾済みなら優先。勝手なストライク要求への置換なし。 |
| CATCH-09 | CATCHER_LEDで外角スライダー、投手に緩急○ | 球種/コースのacceptedCallは変わらず、間合いだけ変更可能。 |
| CATCH-10 | PITCHER_LEDに変更、捕手が別案を持つ | 捕手が主導権を強奪しない。AcceptedCall provenanceあり。 |
| CATCH-11 | Gold捕手が未知の打者、G捕手が既知の打者 | GoldでもKnowledge不足、Gでも局所知識を活用可能。 |
| CATCH-12 | B保守派とB積極派、技能同一 | Personalityだけで合法な近接候補の選び方が変わり得る。 |
| CATCH-13 | G捕手とGold捕手を大量同一対戦条件で比較 | 上級の平均判断品質の改善傾向を評価、勝率固定増加や毎球勝利保証は禁止。 |
| CATCH-14 | 捕手が裏をかく、打者もそれを予想 | Surpriseが無効/逆効果にもなる。 |
| CATCH-15 | 球種数2 vs 8、両者とも強い | 数だけで2球種型が不当に弱体化しない。 |
| CATCH-16 | ActiveEmotionなし vs 発火あり | 発火前は無根拠な心理補正なし。発火後のみ既存心理契約から作用。 |
| CATCH-17 | 同じPitchCall/同じ実行入力、捕手Gradeだけ変更 | Pitch Physics、飛翔、Spinが不変。Grade逆流なし。 |
| CATCH-18 | seed固定、30/60fps・描画OFF・リプレイ・端末差 | 提案Call、Trace、正史イベント、公式結果が一致。 |
| CATCH-19 | 未観測Pitch／不明な打者／失敗したスカウティング | 未知をOracleで埋めない。誤った予測と修正が再現可能。 |
| CATCH-20 | 長時間大量対戦、古いデータ、同一カード繰返し | 記憶無限肥大なし。読み合いが単一球種/中央固定へ崩壊しない。 |

### 校正指標（数値目標は未Freeze）

- decision-time forecastのCalibration / Brier等の誤差、根拠の新鮮さと更新速度。
- 同じ情報量で比較した候補評価品質（選択後の偶然の結果と切り分けたRegret推定）。
- Grade別・好み別・投手別の配球多様性、制球とwalk、3-ball zone target傾向、被長打と失点の分布。
- 新人・未知相手で過度な確信が出ないか、Goldが全知にならないか、Gが「常にハズレ」になる極端がないか。
- 被打率/四球率等を後付けに直接合わせず、候補選択→投球物理→打撃→規則の因果経路で検証。
- CPU予算・メモリ・セーブサイズの上限、1試合／複数シーズンのlong-run seed sweep。

## 13. 完了判定と報告書

### 完了と呼べる条件

1. 決定に関係する全てのSourceが指定され、禁止された隠し真値へのアクセスがない。
2. Trait / Gold / Manager / Communication の二重Buffや主導権破壊がない。
3. 3-0満塁だけでなく連続的なカウント・得点状況で汎用意思決定が成立する。
4. 捕手と打者の予測は互いに独立し、相手の隠しcallを読まない。
5. 同じseed/入力/VersionでDecisionと正史の再現性が保証される。
6. `npm run typecheck`、`npm test`、`npm run verify` と重点・seed sweepでの実測結果を提示できる。
7. 実戦Match Coreへの接続、Native公式結果、PC/モバイル完走が未成立なら、その範囲を `NOT RUN / NOT CONNECTED` として報告し、Headlessテスト成功をフル試合完成と呼ばない。

### 最終報告フォーマット

- Branch / Before HEAD / After HEAD / changed files / commits。
- Source of Truth参照と既存正史からの変更有無。
- CATCH-01〜20のPASS / FAIL / NOT RUN、再現seed、入力、原因。
- 実行したTypecheck/Vitest/Full-match/Device testsのコマンド、件数、失敗ログ。
- 計測された配球傾向・判断品質・速度・長期メモリ。
- 未実装依存・校正未確定項目・残るリスク。
- 現行PNG描画・Match Core物理・審判公式結果への非干渉証拠。

## 14. 今回の設計確定範囲と残す校正

**この実装計画が提案する確定候補:**
- 七つのCatcher Skill Domain と Slow Preferenceの独立。
- 公開ゲーム状態・相手の推定・監督指示・投手理解に基づく汎用Pitch Decision。
- 捕手と打者の分離された不完全情報Beliefと時刻順の証拠更新。
- 候補の上限付き比較と「裏をかく」因果経路。
- PitchCall Authority、Cadence、物理、RuleEngine、Trait Projectionの不変境界。
- 実装証拠・判断記録・20受け入れシナリオ。

**校正に残すもの:**
- 7技能のSourceごとの尺度と重複整理、Skill→推定誤差/候補認識の関数。
- G〜A/Goldの境界・集約重みと学習・低下速度（09/53正本に従う）。
- 相手予測の情報更新・confidenceモデルとforecast近似の誤差。
- Routine/重要局面の候補数、計算量の最終上限と多様性の校正。
- 実際のリーグ/大会ルール、ABS、有効ゾーン・制球パラメータ。
- 実装済みMatch/Pitch/Decisionに合わせた正確なAdapter位置。

いずれも既存CANONICALを変更する場合は別途明示レビューし、今回の計画が勝手に旧設計を上書きしたと扱わない。

**原則:** 「賢い捕手は未来を知る」のではない。観測した証拠を適切に扱い、打者・投手・監督の考えと折り合いをつけながら、リスクを比較できる。ミスも名リードも、同じ因果的仕組みから発生する。
