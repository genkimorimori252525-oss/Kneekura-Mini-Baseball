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

## 1. Research pipeline — evidence-gated stages

### R0. Legal & evidence source discovery

Inputs:
- [Source registry (machine-readable)](sources/npb-evidence-source-registry.json)
- [League/year index (machine-readable)](sources/npb-official-season-index.json)
- live NPB year/player/venue pages and source owner terms.

AI does:
1. For every source verify owner / upstream provenance / year coverage / permitted operation / revision; record observed timestamp. **A URL existing is not permission to mass-copy its data.**
2. Compile `allowedArtifacts`: reference link, minimal factual metadata, manually verified statistic, licensed/importable dataset, art asset (separate license).
3. If dataset licensing unclear, label `LICENSE_BLOCKED_FOR_BULK_IMPORT`. AI may still document source structure and analytical methodology; it must not silently run a bulk crawler or mirror the database.
4. Record contradictory facts explicitly; NPB official Korakuen opened 1937, while one OOTP repo labels 1936 records with Korakuen. A conflicting park/geometry input is **not valid** historical world truth.

**Gate:** Source metadata + provenance/rights exists; unanswered legal/terms issues visible.

### R1. Competition / era / league reconstruction

1. Use NPB official year index to enumerate 1936 initial / autumn; 1937/38 spring–autumn; JBL 1939–44 and 1946–49; 1945 no official league; CL/PL 1950–2025; 2026 as-of snapshot with unknown final status.
2. Resolve team-season/franchise-year IDs without assuming 12 teams or single home stadium.
3. Create versioned historical rules, actual PA/games/opponents, recognized schedule/formats, home/away and game venue. DH, split standings, interleague and exceptional-season rules must be year-accurate.
4. Source-tag incomplete profiles: `OFFICIAL / SECONDARY / INFERRED / UNKNOWN`. Do not manufacture a fake historical roster name. In a research-only simulation, `GENERIC_ENVIRONMENT_PLACEHOLDER` may be used as an explicit league-calibrated stand-in, **never claimed as a real historical player**.
5. Small anchor audit first: 1936, 1939, 1945, 1950, 1964, 1973, 1975, 1988, 2011, 2020, 2025. Then full year index.

**Gate:** [ENV-01..16](NPB-HISTORICAL-ENVIRONMENT-MODEL.md) plus legal per-year source trace.

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

**Gate:** source years/selection rules/holdout/uncertainty and future Year Window frozen for experiment reproducibility.

### R4. Skill-source inference — use every existing lever, not every label

1. Read [capability atlas](PLAYER-CAPABILITY-TRAIT-ATLAS.md) and current authoritative 09/02/04/08/05/53. Start with real per-person source-backed facts, not final batting average desired or a pile of S/Gold traits.
2. Map real performance/behavior to **raw underlying** pitch recognition, swing/motor, contact/power, discipline, direction, baserunning, fielding, pitching arsenal, command, catcher cognition, learning, fatigue and role skills.
3. Record `InferenceMethod / Confidence / Identifiability`. Stats alone rarely distinguish pitch selection intelligence from contact power or ballpark/opponent variance. Never treat an identified career-HR record as independently identifying swing launch angle.
4. Construct public 0..100 and S..G grades, ☆, Green preference and Blue/Gold/Red **derived projections** from sources. Gold and A from the same Family are mutually exclusive; negative F/G vs positive named candidates are based on same Family when canonical.
5. Cross-check direction bias: pull intent and actual spray must be separate; red/green behavior not raw stats. Do not give every great batter 広角打法 automatically.
6. Build every `player_recreation_case` from [case template](cases/TEMPLATE.md); missing negative traits or source data are `UNKNOWN` not “none” unless evidence.

**Gate:** no hidden-stat oracle, no double-count, ability labels never backfeed into physics.

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

**Gate:** [REC-01..14](METHOD-V1-PROPOSAL.md) + ENV gates; actual run receipts with match-Core HEAD and seed/version.

### R6. Automatic adversarial audit and release

Check:
- period mismatch, missing years/unknown fields, 1936 stadium anachronism;
- legal source provenance + allowed operation;
- bad numerator/denominator or sample selection; IBBS mixed with walks;
- ability overfitting/HR scripted, 1-year peak forced yearly;
- Green/Gold/Red trait conflicts, family double count, magical plate appearances;
- Trait G..A/GOLD label/weight changed but true Source unchanged => physical results identical;
- UI image/camera/FPS changed => official results identical;
- old PNG only; no pixel experiment adoption; local dirty tree safe.

Save reproducible `source_manifest_revision`, `era_profile_revision`, `player_skill_revision`, `core_version`, `seed_ranges`, `calibration_code_version`, test receipts and exceptions. Report **PASS / FAIL / NOT RUN / NOT CONNECTED / RIGHTS_PENDING** without conflation.

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
3. Source quality tests including Korakuen anachronism, franchise team name collision and WW2 gap.
4. Ability-Source mapper to 02/04/09 (no redundant ranks), with `UNKNOWN`.
5. Case study Oh and one independently chosen multi-year/one-year-comparison hitter, multi-seed/observed-period holdouts.
6. **Only then** expand E0 to every official first-team year and each player; expand E1/E2/E3 according to evidence, not a blanket 100% complete claim.

## 4. AI review and logging structure

Record each research iteration as:
- **Question:** source/fact/skill/season under investigation.
- **Evidence:** primary link (NPB), independent cross-check, as-of dates, extraction rights.
- **Alternative interpretations:** e.g. dramatic season from role/PA/park vs mechanical improvement, not just chosen theory.
- **Proposed state:** player skill/era input with causal affected variables; full confidence/uncertainty.
- **Contradiction tests:** who else should behave differently under the same model.
- **Acceptance:** number of seasons/simulations, fixed seeds, historical central/peak/low tail/season sample.
- **User impact:** no manual micromanagement to create every old player; AI performs the analytical work, user reviews rare substantive policy choices.
- **Status:** DRAFT/RESEARCHED/CALIBRATED/VERIFIED, with root pointers. No status inflation.

**Limitations remain real:** Verified at the repository research stage are public **source discovery and the explicit existing ability catalog**. An actual all-player historical environment, permission-cleared full database, numeric skills for every player, measured old-era spin/motion, fully working baseball Match Core and seeded historical yearly runs **are not yet verified in this branch**.
