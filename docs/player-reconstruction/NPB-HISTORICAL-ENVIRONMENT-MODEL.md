# NPB 1936–現代 — 史実リーグ環境復元モデル / AI向け契約

> **STATUS:** DESIGN / DATA MODEL / IMPLEMENTATION PLAN PROPOSAL / NOT IMPLEMENTED. 2026-10-16.
>
> **対象:** 一軍一リーグ時代（1936〜1949、1945の公式リーグ空白あり）と1950以降のセ・パ。二軍・教育リーグ・少年/社会人は**第一段階の必須対象ではない**。時代環境はOB選手の結果を強制するBuffではなく、同一因果Match CoreへのRule・Ball・Park・Roster・Opponentなどの物理/戦術入力。

## 0. 何を復元すれば選手能力を比較できるか

「王貞治に55本を打てる能力を持たせる」と言うためには、本人の打席、**相手投手の水準と球種、球場のフェンス・広さ、選球/敬遠、試合数、リーグの得点環境、守備の質**を整合した文脈で検証する必要がある。1964年の55HRを2005年・2025年の現行12球団にそのまま移植して合否を決めるのは不公平。

**2本の軸を分離:**

- **Historical Environment Replay:** 歴史的な対象Seasonを版つきで仮説復元して実際のMatch Coreを動かす。DataはEvidenceを持ち、不確実な要素は仮のProfileを別管理。
- **Frozen OB Player Template:** 複数の全盛期年から推定した元Skill/身体/認知/思考傾向はペナント中**固定**。相手・球場・当日の状態・運動の現実的なばらつきと機会により成績は変わり得る。選手の見た目数値を物理へ再入力しない。

## 1. NPBの時代区分 — 正確なCompetitionSeason単位

| Era / Season | 史実・データ処理 | 実装上の契約 |
| --- | --- | --- |
| 1934〜1935 | 1934東京巨人の前史があるが、**1936の7球団リーグ創設と区別**。 | 今回のNPB公式シーズン履歴の起点は1936。1934をリーグ年度と捏造しない。 |
| **1936初期大会 / 1936秋** | NPB公式は**第1回日本職業野球リーグ戦の大会**と秋季を別ページ化。 | 同じ`year=1936`を単一通年リーグ成績として扱わず、`phase=INITIAL_TOURNAMENT / FALL` を保持。 |
| **1937春・秋 / 1938春・秋** | 公式索引が前期・後期それぞれの年度成績を持つ。 | `year + phase`の複合キーにする。年度合計と春秋をダブル計上しない。 |
| **1939〜1943** | 日本野球連盟の単一リーグ公式シーズン。 | リーグ`JBL`で年度別成績・球団ID・全体のRA/PAを校正。 |
| **1944** | 戦時の短縮・中断。公式記録あり。 | 短縮年度を普通の130試合ペナントとして扱わない。 |
| **1945** | 通常のリーグ公式戦は中断。終戦後の東西対抗等は通常ペナントではない。 | **No official regular league season**。架空公式優勝者・通算年度成績を生成しない。 |
| **1946〜1949** | プロ野球復活、引き続き一リーグ。 | 戦前〜戦後の競技環境と球団/球場変化を年度別に管理。 |
| **1950以降** | **セ・パ二リーグ制**。各`CL_YEAR`と`PL_YEAR`を別々に記録し、同年・同リーグ・相手Rosterとの比較を行う。 | 1950初期のチーム数は現代12球団固定ではない。合併・参入・退出をCompetitionTeam Season単位で扱う。 |
| **1973〜1982 パ** | パ・リーグ2シーズン制。 | 規則/順位/プレーオフ期のコンペ構造と、個人成績の通年集計を分離。2期の結果を2回カウントしない。 |
| **1975〜 パ** | パ・リーグDH導入。 | リーグ・年度の指名打者、投手打席/野手起用の選択機会を`RuleProfile`で変える。セまで無条件適用しない。 |
| **1988〜** | 後楽園から東京ドームなど球場変遷。 | 同一球団の本拠変更を球場ID/年版で記録。 |
| **1993〜** | FA制度導入等、Roster movementの制度変更。 | 歴史的Roster再現と「途中で移籍した場合」のCareerシステムを区別。 |
| **2005〜** | セ・パ交流戦開始、球団再編（2004再編後）。 | interleague schedule・DH適用などを年度/試合単位で扱う。各球団固有のリーグ所属は年月でSnapshot。 |
| **2011〜** | 統一球導入。 | 球の物理的性質と球質評価の変化を検討するが、係数は公式・測定Evidenceなしに固定しない。 |
| **2020** | パンデミックによる日程短縮・運用変更。 | 通常年143試合を前提にせず、実際のschedule/PAに従う。 |
| **2021〜2025** | 近年の12球団・143試合を含む時代。詳細スケジュールや現代PF源が多い。 | 保存済みの完了年度SnapshotでQA、球場/Rule差/打撃分布を検証。 |
| **2026（作業時点）** | 最新データは日付で変わる。 | **必ず取得日時/as-of/試合消化完了状況を付ける**。2025等の完了年度と混同しない。 |

**一次資料:** [NPB年度別](https://npb.jp/bis/yearly/) ／ [NPB公式歴史](https://npb.jp/archives/japanesebaseball150th/history/) ／ [パ・リーグ略史](https://npb.jp/pl/history.html)。これは再構成を始めるためのレジストリであり、すべての細かな年度RuleProfileを調べ尽くしたと主張しない。

## 2. Era/League/Team/Park/Playerを混同しない識別子

```ts
type CompetitionSeasonKey = Readonly<{
  year: number;
  leagueId: 'JBL' | 'CL' | 'PL';
  phase: 'INITIAL_TOURNAMENT' | 'SPRING' | 'FALL' | 'FULL';
  seasonRulesRevisionRef: string;
}>;

type HistoricalLeagueSeason = Readonly<{
  key: CompetitionSeasonKey;
  status: 'COMPLETE' | 'IN_PROGRESS' | 'SUSPENDED' | 'RESEARCH_GAP';
  seasonSnapshotVersion: string;
  observedScheduleRefs: readonly string[];
  clubSeasonIds: readonly string[];
  officialBattingAndPitchingSummaryRefs: readonly string[];
  rateCalibration?: Readonly<{
    rawRunsPerGame?: number;
    rawHomeRunsPerPlateAppearance?: number;
    rawWalksPerPlateAppearance?: number;
    rawStrikeoutsPerPlateAppearance?: number;
    groundBallEvidenceLevel: 'OBSERVED' | 'INFERRED' | 'UNKNOWN';
  }>;
  evidenceRefs: readonly string[];
}>;

type HistoricalClubSeason = Readonly<{
  immutableClubIdentity: string;
  historicalTeamName: string;
  franchiseContinuityRef: string;   // mergers/name changes require evidence
  competitionSeasonRef: string;
  activePlayerSeasonIds: readonly string[];
  pitcherUseAndRosterEvidenceRefs: readonly string[];
  homeParkId?: string;              // default/preference only, not game-location truth
  evidenceRefs: readonly string[];
}>;

type HistoricalGameVenue = Readonly<{
  ballparkId: string;
  effectiveGeometryVersion: string;
  sourceGameId: string;
  date: string;
  isHomeDesignated: boolean;
  neutralOrTouringContext?: string;
  surface?: string;
  evidenceRefs: readonly string[];
}>;
```

- 同じ球団でも名前/本拠地を年に応じて変え得るが、**name = franchise ID**にはしない。1950年代の解散/合併は仮の同一IDに安易に統合しない。
- **GameVenueはHomeTeamフランチャイズとは別**。戦前は甲子園や西宮等で中立的な/変則の主催試合がある。1936〜49で特定球団の全試合を現代と同じ本拠地に割り当てない。NPBの[甲子園100周年球場史](https://npb.jp/news/detail/20240920_02.html)には一リーグ時代の分布・先攻ホーム開催例がある。
- 選手はPerson ID/本人の真Source + YearlyStatEvidence + 固定OB Prime Templateを別々に保持。YearlyStatRowがその年ごとに新しい「真の人物」コピーを生まない。

## 3. 球場とボール — 時代物理を資料から作る

| Layer | 項目 | 注意 |
| --- | --- | --- |
| **Actual Park Geometry** | 球場毎のグラウンドの形、方向別のフェンス距離・高さ、ファウルゾーン、壁面、土・芝等。 | 1937後楽園は両翼78m→1958約90m。モデル内で1936後楽園使用は誤り。単なる本拠地の名称変更と形状変更は別。 |
| **Ball / Air / Surface** | 使用球の回復係数/飛び、重力/空気、風・温湿度、地面反発、投球球質。 | 歴史年度の正確なBall Physical parametersが不明なら`UNKNOWN / HYPOTHESIS`。HR数から「年度HR Buff」を直接作らない。 |
| **Statistical Park Effects** | HR・安打・得点PF（必要なら投打左右別）とシーズン間の推定誤差。 | PFは歴史の結果**指標**であり、球場の壁へ魔法Buffを加えるparameterではない。物理を先に再現し、得られたPFと史実を比較して校正する。 |
| **Nonstandard Venues** | 遠征、地方球場、相手と実開催球場の組み合わせ。 | 球団の通常本拠地を全試合にコピーしない。 |
| **Source Reliability** | 開場年月日、改修適用日、メートル/feet変換、用途、座標系。 | 複数年平均の球場距離は適用してはいけない。後楽園/甲子園などはNPB一次資料で確認。 |

**具体検証** [NPB公式 後楽園コラム](https://npb.jp/news/detail/20180518_01.html) は**1937年9月開場**、当初両翼78m、1949ネット、1958拡張、1987まで/1988東京ドームと記録。[OOTP historical dataの1936`Teams.csv`](https://github.com/lebronisbest/OOTP_NPB_Historical/blob/main/stats/Teams.csv)が1936東京巨人=後楽園とするのは事実と一致しない。**「データがある」と「当時の環境として正しい」は別**というAI検証の代表失敗fixtureにする。

## 4. リーグ環境正規化（選手の固定能力に直接マイナスを掛けない）

過去の得点環境は各年/リーグ/打席/球場の差がある。

- 年度原数: `PA, AB, H, 2B, 3B, HR, BB, IBB, SO, HBP, SF, Runs, Innings` 等。1910sにないmodern statはUNKNOWN。
- 同じリーグの各年度のチーム合計を**試合数・打席/イニング数で正規化**し、相手の投手品質と打席機会の違いを明示する。
- **リーグ基準を固定係数にしない**: 1964セにおける「HR/PA」は観測された現実の分布。ゲーム内ではSeasonRule/球場/ボール/投打Skill/守備/戦術/起用を整えて、観測分布へ近づくか検査。`EraHRBuff ×1.3` 等で打球結果を書き換えない。
- 推定の不確実性: 戦前の球種・守備出場位置・試合球や風の欠測は`unknownRanges`として残し、相互に矛盾する資料は`CONFLICTED`。
- **Simulated contemporary comparison**: 「王を現代の打者と同じリーグで起用」は別の問い。同じ固定Raw Skillで2025投手を相手にした結果が違っても、1964の再現失敗とは限らない。所属リーグ相対公開数値も固定OBカードと別スナップショットを参照する。
- 同一選手の全盛期時代再現と現代移植成績を両方出せるよう、`Source Player Identity`、`Historical Era Calibration Context`、`Runtime Competition` を混ぜない。

## 5. 段階的な環境再現範囲 — 無い資料は擬似再現で明示

| Stage | 必須 | 成果 | その段階でまだ再現していないもの |
| --- | --- | --- | --- |
| **E0: official yearly facts** | 全年度/リーグ/phase、公式歴史的球団、年度選手打撃/投手成績、実出場試合数 | **1936–2025の年次母集団とリーグ得点環境** | 規則・球場の物理、1球実行、完全な能力Source |
| **E1: venue/rules/schedule** | 年版RuleProfile、ゲーム/球場/PA数、対戦品質、実3D球場の根拠 | 同年代の合理的な試合舞台/球場打球条件 | 同日風・球種別計測・実況全貌 |
| **E2: historical games/opponents** | Boxスコア/打順/投手起用、実対戦/遠征、必要に応じて球場改修履歴 | 年間試合・選手機会の実像へ接近 | 打席の各球コース、投球回転の正確な実測 |
| **E3: Player skill inference** | 多年の選手成績、動画/証言、打撃/投手技術のEvidence、不確実性付推定 | 王/長嶋/戦前〜現代の`PRIME_COMPOSITE`候補を生成 | すべての隠し技能が史実の真値であるとは言えない |
| **E4: causal long-run calibration** | 現行Match Core、物理・知覚・守備・RuleEngine、同じ時代/相手、多seed season sweeps | OB全盛期の代表分布と突出年の到達を検証 | 史実一試合一投の完全再演、失われた測定事実 |

**二軍再現はE0–E4の前提ではない。** 二軍出場しかない選手や育成選手は、第一段階の一軍実績から`UNKNOWN`へ落とし、存在自体を消すわけではない。将来のファーム拡張は権利/資料が許すところから実施。

## 6. 実装責務（現行共通Coreを分岐しない）

```text
licensed/approved raw evidence + source identifiers
    -> historical source registry / field-level provenance
    -> season/team/player/venue entity resolution
    -> era context with uncertainty and versioned Rule/Park source
    -> player recreation evidence/calibration (`PRIME_COMPOSITE`)
    -> existing one authoritative Match Core
    -> actual physical events and official results
    -> longitudinal calibration reports
```

推奨モジュール候補:
- `src/data/historical/`: 史実のversioned league/year/team/player/ballpark IDsとEvidenceRef。権利付き原データは許可なく入れない。
- `src/core/model/`: 既存Player World/RuleProfileへの適切なadapter契約、**新しい史実専用結果エンジンは作らない**。
- `src/research/player-reconstruction/` または既存Laboratory領域: 非本番の統計校正/大量seed比較、型チェック・根拠照合。
- `docs/player-reconstruction/sources/`: 出典の所在/利用制限/既知URL構造。事実データ自体の無断転載ではない。

## 7. 最小限の確認と既知誤りの注記（2026-10-16 USER CORRECTION）

**原則: 完璧な歴史考証より、選手・リーグ環境の再現を前へ進める。** 全年度・全球団・全球場・全資料の突き合わせや、細かな不整合を洗い出す専用の16項目Gateを**必須にしない**。

- 基礎の年・リーグ区分だけ使う（1936年の春秋等、1950年の二リーグ、1945年公式リーグ戦なし等）。既存の年度索引を再利用し、同じ事項を何度も検証しない。
- 史実と異なる点を**実際に発見した場合**は、使用する設定に一行の補正・注記（例: `1936年の後楽園表記は史実と違うため開催球場を簡易代替`）を残して続行する。すべての球場や年度へ波及調査しない。
- 球場形状・風・当時の球など詳細が不明でも、`APPROXIMATE` と明記して同時代の代表環境を使える。存在しない記録や計測値を「公式の真実」とだけ断定しない。
- 能力値の検証で重要なのは**同じ設定・seedで結果が再現できること、リーグ全体の大まかな成績分布、王のような全盛期選手の到達可能性**。必要な試作時に代表年を少数確認する。全員を設定する前に全データが完全一致する必要はない。
- 出所の権利確認はデータの**大量コピーや配布**など、実際に必要になったときに行う。単なる参考ページのリンクや個別の史実確認を停止するための過剰な審査にしない。

### 取り扱い例 — 後楽園球場

[NPB公式の後楽園球場史](https://npb.jp/news/detail/20180518_01.html)では1937年開場、一方で参照OOTPデータは1936年の球団設定に後楽園を含む。**当該データだけ修正／代替して注記**。これを理由にリポジトリ全体の検証・その他球場全部の再調査・作業停止は要求しない。

**旧 `ENV-01..16` は2026-10-16のユーザー修正で一括必須検証から撤回。** 既に記録された史実情報や研究資料はそのまま参考にできる。今後のAIは検証が必要な実装箇所と、単なる研究上の近似を区別し、前へ進めることを優先する。
