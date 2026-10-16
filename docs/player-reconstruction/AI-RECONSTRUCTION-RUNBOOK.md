# 選手再現部 — AI-first NPB historical reconstruction runbook v1

> **Date:** 2026-10-16 JST. **Status:** AUTOMATION-READY RESEARCH / IMPLEMENTATION PLAN PROPOSAL / NO HISTORICAL DATA IMPORT OR GAME-CALIBRATION EXECUTED. AIが一次調査・異常検出・能力校正・反証検証・文書反映の中心となる。Owner承認済みのOB原則を変更しない。
>
> **入口:** [部署README](README.md) → [史実資料台帳](NPB-SOURCE-ATLAS-1936-2026.md) → [ERA Environment](NPB-HISTORICAL-ENVIRONMENT-MODEL.md) → [全公開/非公開/Trait台帳](PLAYER-CAPABILITY-TRAIT-ATLAS.md) → [OB原則](PRINCIPLES.md) → [史実→能力推定法](METHOD-V1-PROPOSAL.md)。

## 0. AIが主役でも、史実と推論は混ぜない

**目標:** 1936年のリーグ創設期から現代まで、公式年度記録が存在する全時代・全球団/選手を、事実に基づいた統一データモデルで検索し、AIが`PRIME_COMPOSITE`、単年`SEASON_SNAPSHOT`、研究用`UNCERTAIN_PROFILE`を必要な証拠から生成できる環境。二軍/育成以下は第一段階で必須としない。

**最低条件:**
- 年度・競技・春秋・リーグ・球団・球場・Person・RuleのIDを正規化する。
- 年次球団/打撃/投球/守備等の史実を一次源で優先的に確かめる。
- 公開/隠し技能と正/負/緑/青赤/金のFamily・Tierを**既存09正本**と同じ判断体系で扱う。
- 現代測定のない時代は`UNKNOWN`または`MODEL_CALIBRATED`で残し、幻のRPM、打球速度、コース別真傾向を史実として捏造しない。
- OBのTrue Skillと固定カードは年をまたいで不変、実行状態・対戦相手・試合環境から年間成績が変化。
- 模擬試合の物理は単一Match Core。年次HR/AVG/防御率を後から注入しない。
- 史実の多人数データを無断転載・スクレイピング・OOTP限定素材を複製しない。資料収集権限がないときは**出典URLと抽出計画・利用申請**までで止める。

## 1. 最短のAI作業フロー — 検証のために開発を止めない

> **2026-10-16ユーザー修正:** 以前記載した「全球団・全年度の細かな歴史差の照合」「全16 ENV Gate必須」「毎回の敵対監査」は**過剰**。ここでは資料を参考に試合環境と選手を作ることが主役。既知の局所的な誤りは一行注記/補正し、他全件を監査せず作業を続ける。`R0–R6`は参考の作業分野であり、各段階のGate通過を全選手に強制しない。

### R0. Legal & evidence source discovery

Inputs:
- [Source registry (machine-readable)](sources/npb-evidence-source-registry.json)
- [League/year index (machine-readable)](sources/npb-official-season-index.json)
- live NPB year/player/venue pages and source owner terms.

AI does:
1. For every source verify owner / upstream provenance / year coverage / permitted operation / revision; record observed timestamp. **A URL existing is not permission to mass-copy its data.**
2. Compile `allowedArtifacts`: reference link, minimal factual metadata, manually verified statistic, licensed/importable dataset, art asset (separate license).
3. If dataset licensing unclear, label `LICENSE_BLOCKED_FOR_BULK_IMPORT`. AI may still document source structure and analytical methodology; it must not silently run a bulk crawler or mirror the database.
4. 既知の後楽園1936問題は該当箇所に短く注記し、必要なら球場を代替する。それだけで作業続行。新たな矛盾を探すための全件調査は行わない。

**実務:** 出典URLを残す。権利確認は大量インポート/配布時など実際に必要な場合に行い、個別の参照調査まで止めない。

### R1. Competition / era / league reconstruction

1. Use NPB official year index to enumerate 1936 initial / autumn; 1937/38 spring–autumn; JBL 1939–44 and 1946–49; 1945 no official league; CL/PL 1950–2025; 2026 as-of snapshot with unknown final status.
2. Resolve team-season/franchise-year IDs without assuming 12 teams or single home stadium.
3. Create versioned historical rules, actual PA/games/opponents, recognized schedule/formats, home/away and game venue. DH, split standings, interleague and exceptional-season rules must be year-accurate.
4. Source-tag incomplete profiles: `OFFICIAL / SECONDARY / INFERRED / UNKNOWN`. Do not manufacture a fake historical roster name. In a research-only simulation, `GENERIC_ENVIRONMENT_PLACEHOLDER` may be used as an explicit league-calibrated stand-in, **never claimed as a real historical player**.
5. まず必要な年代・選手・球団を復元する。年度索引を再利用し、全時代の代表年を逐一照合してからでなければ次に進めない、という工程は設けない。

**実務:** [歴史環境の最小限の注意](NPB-HISTORICAL-ENVIRONMENT-MODEL.md)を参考にし、判明済みのミスだけ補正する。旧ENV-01..16の全件合格は要求しない。

### R2. Player identity, documented facts and missing-data handling

Each `Person` stores stable identity, names/aliases, handedness, role, team/seasons, source IDs and exactly what was observed for every field.

No silent substitution:
- **unknown vs 0**: unknown stolen-base success/missed pitch type must not turn into 0.
- **registered vs appeared**: roster-listed player without official game appearance is not an NPB official-game participant.
- **team change vs new player**: avoid multiplying the same athlete across aliases/teams.
- **1964 vs 1974 era**: different PA and parks, not interchangeable.
- **named trait**: Blue/Gold/Red/Green should only be emitted after proper Source-backed evidence.

For fields without good historical measurements, emit estimated range with confidence rather than fabricated exact numeric skill.

### R3. Training/holdout and Prime Window selection

1. Choose the `PRIME_COMPOSITE` candidate interval in advance (prefer contiguous multi-year window grounded by career profile).
2. Aggregate correct denominators: `ΣH/ΣAB`, `ΣHR/ΣPA`, `ΣBB/ΣPA` with `IBB` separate, `ΣSO/ΣPA`; use proper SF/HBP calculations for OBP, no annual percentages averaged equally.
3. Normalize historical game count, rules, player opportunity, league pitching/defense, park geometry/era differences with uncertainty.
4. Keep a **holdout**: do not tune solely on the exact best year that is later used as acceptance. Test ordinary years and peak-year attainability separately.
5. Check window sensitivity by nearby-year expansions; if selection of only excellent years raises estimated ratings materially, adjust uncertainty and show selection bias, not secretly delete poorer years.
6. For actual one-year standout players, use the standout year with before/after years to identify exceptional expression; **do not label a real active player a definitive 'one-hit wonder' merely because 2025 differed from adjacent years**.

**実務:** 全盛期の選定年・主な出典は記録する。代表的な成績が再現できるなら、余分な比較資料が揃うまで停止しない。

### R4. Skill-source inference — use every existing lever, not every label

1. Read [capability atlas](PLAYER-CAPABILITY-TRAIT-ATLAS.md) and current authoritative 09/02/04/08/05/53. Start with real per-person source-backed facts, not final batting average desired or a pile of S/Gold traits.
2. Map real performance/behavior to **raw underlying** pitch recognition, swing/motor, contact/power, discipline, direction, baserunning, fielding, pitching arsenal, command, catcher cognition, learning, fatigue and role skills.
3. Record `InferenceMethod / Confidence / Identifiability`. Stats alone rarely distinguish pitch selection intelligence from contact power or ballpark/opponent variance. Never treat an identified career-HR record as independently identifying swing launch angle.
4. Construct public 0..100 and S..G grades, ☆, Green preference and Blue/Gold/Red **derived projections** from sources. Gold and A from the same Family are mutually exclusive; negative F/G vs positive named candidates are based on same Family when canonical.
5. Cross-check direction bias: pull intent and actual spray must be separate; red/green behavior not raw stats. Do not give every great batter 広角打法 automatically.
6. Build every `player_recreation_case` from [case template](cases/TEMPLATE.md); missing negative traits or source data are `UNKNOWN` not “none” unless evidence.

**守ること:** 実能力と得能の二重補正をしない。これはゲーム設計の基本条件で、史実の全件再検証とは別。

### R5. Season & match simulation for actual calibration

**Must use existing one authoritative Match Core.**

- Build same-era sample schedule/roster/park/RuleProfile and actor skills; run many deterministic seeded seasons and record authoritative ball/bat/field/runner/umpire events and official HR/AVG/BB/K/R.
- Compare:
  a) player multi-year central performance,
  b) top peak-year upper tail,
  c) legitimate underperforming years,
  d) MLB-era/NPB cross-era context only as a **separately labeled comparison**,
  e) learned hitter/pitcher interaction, role/PA and opponent roster quality.
- If 1973 Oh skill template cannot approach true peak, investigate contextual/physical motor model. **Do not automatically set `hrProbability += X` until it does.** 
- If annual spreads too narrow/broad, first test ordinary day-by-day Condition and actual opponent/park/physics variance. Only then consider the [proposed coherent Season Execution Context](SEASON-EXPRESSION-PROPOSAL.md), where the varying inputs have genuine movement/technique causes. No magic yearly “good season” multiplier.
- Keep original source and calibration change logs; source-data holdout prevents one-test overfitting. Multi-player aggregate fit (league and teams) is part of acceptance, not just Oh's 55HR.

**実務:** 代表選手と対象リーグの大まかな成績が妥当か試験する。旧REC/ENV全項目合格を毎回の必須条件にしない。実行していないテストをPASSとは書かない。

### R6. 最小限の結果確認と記録（過剰な敵対監査を廃止）

- 結果が明らかにおかしい場合にだけ原因を調べ、具体的な誤りや近似条件を短く注記する。
- 代表的な選手数名と数シーズンを使い、通常年と最高年への到達可能性を確かめる。毎回すべての年代・全球場・全選手の監査はしない。
- 必ず守るのは「OBの基礎能力が固定」「打撃/投球結果の直接Buffなし」「使っていない資料を使ったと言わない」「権利のない素材を複製しない」の基本原則。
- 史実の欠測を数値で補うなら `APPROXIMATE` と示す。作業記録は必要最小限（対象選手・時代・出典・補正点・結果）。
- **修正可能な小誤りを発見しても全工程を止めず、修正して続きを進める。**

## 2. Minimum source-backed data contracts (proposed)

```ts
type ResearchConfidence = 'OFFICIAL_OBSERVED' | 'SECONDARY_CORROBORATED'
  | 'HISTORICAL_ESTIMATE' | 'MODEL_CALIBRATED' | 'UNKNOWN'
  | 'CONFLICTED' | 'LICENSE_BLOCKED';

type PlayerFact<T> = Readonly<{
  playerId: string;
  fieldId: string;
  seasonKey?: string; // including JBL spring/autumn distinctions
  value: T | null;     // null when UNKNOWN, never silently 0
  sourceRef: string | null;
  status: ResearchConfidence;
  extractionVersion: string;
  confidence?: number;
  uncertaintyNotes?: string;
}>;

type ObReconstructionReceipt = Readonly<{
  playerId: string;
  frozenVariantId: string;
  primeWindowIds: readonly string[];
  trueSkillRevision: string;
  comparisonLeagueProfileId: string;
  actualRuleAndParkSnapshotRef: string;
  officialStatEvidenceRefs: readonly string[];
  approvedSourceRightsRef: string;
  testedSeeds: readonly string[];
  matchedOutcomes: readonly string[];
  gates: Readonly<Record<string, 'PASS'|'FAIL'|'NOT_RUN'|'NOT_CONNECTED'|'RIGHTS_PENDING'>>;
}>;
```

**Never** attach the current year's hidden physical skill to another era simply by changing the player's public G..S or adjusting static LeagueName. A player's true state and a league/environment state are different objects; only the actual simulation can combine them.

## 3. Planned implementation files and boundaries

Proposed ownership—not existing implementation:
- `src/data/historical/npb/`: season/league/player/team/park ID registry from **lawfully sourced** facts and provenance.
- `src/research/player-reconstruction/`: deterministic, file-based research lab adapters for annual league/simulator calibration and reporting.
- `docs/player-reconstruction/sources/`: source metadata and machine-readable **reference URLs**, not unauthorized raw databases.
- `docs/player-reconstruction/cases/`: player-specific evidence, all traits/skills, uncertainty and multi-year test receipts.
- `src/core`: **not to be forked**; the existing physical engine owns all pitch, contact, defense, runner, official outcomes. A new historical adapter can supply inputs, but it cannot insert pre-rolled scores.
- `docs/PLAN-REGISTER.md` and `docs/AI-INDEX.md`: discovery and status; new agents must read both before game/attribute work.

First practical delivery stage to implement in code (once data use is cleared):
1. Runtime-independent, typechecked `HistoricalSeasonKey` and `SourceEvidenceRegistry` with valid 1936 split + 1945 exclusion.
2. Official year/player/club IDs and sample normalized league environments for 1936/1950/1964/1973/1975/2025 (only legal/licensed source import).
3. 既知の後楽園1936誤記は短い注記またはデータ側補正だけで対処。全球場・全リーグの一律監査工程を新設しない。
4. Ability-Source mapper to 02/04/09 (no redundant ranks), with `UNKNOWN`.
5. Case study Oh and one independently chosen multi-year/one-year-comparison hitter, multi-seed/observed-period holdouts.
6. **Only then** expand E0 to every official first-team year and each player; expand E1/E2/E3 according to evidence, not a blanket 100% complete claim.

## 4. AI review and logging structure

Record each research iteration as:
- **Question:** source/fact/skill/season under investigation.
- **Evidence:** 参照した主な出典と必要な補正だけを短く残す。独立した複数サイト照合は必要と判断したときのみ。
- **Alternative interpretations:** e.g. dramatic season from role/PA/park vs mechanical improvement, not just chosen theory.
- **Proposed state:** player skill/era input with causal affected variables; full confidence/uncertainty.
- **Contradiction tests:** who else should behave differently under the same model.
- **Acceptance:** number of seasons/simulations, fixed seeds, historical central/peak/low tail/season sample.
- **User impact:** no manual micromanagement to create every old player; AI performs the analytical work, user reviews rare substantive policy choices.
- **Status:** DRAFT/RESEARCHED/CALIBRATED/VERIFIED, with root pointers. No status inflation.

**現況:** 公開資料と能力カタログの入口は整備済み。全時代・全選手の実データインポート/能力校正/長期試合実行は未完了。過剰な史実監査を増やすより、利用できる資料を使った選手・環境の実装を優先する。
