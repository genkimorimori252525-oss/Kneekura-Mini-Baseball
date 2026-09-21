# Kneekura Mini Baseball — Current Design Handoff

更新日: 2026-09-20  
対象branch: `jolly/core-foundation-plan-2026-09-17`

この文書は、新しいChatGPT / Jolly sessionが設計思想を最短で復元するためのhandoff。

## Document Lifecycle / Source Precedence Guard — 2026-09-22

このhandoffでは、**ファイル名ではなく文書内の現在Statusと後継Canonical文書を優先**する。

AI / Agent向け強制ルール:

1. ファイル名に `-DRAFT` が残っていても、それだけで「未確定」と判定しない。
2. `ARCHIVED` / `SUPERSEDED` / `旧計画` は履歴資料であり、現在の設計候補・未確定計画として数えない。
3. `VALIDATION CATALOG` は検証資料であり、現在の設計計画として数えない。
4. 後継 `CANONICAL / DESIGN FROZEN` 文書がある場合、旧DRAFTより後継を優先する。
5. 「まだ実装されていない」「数値校正が残っている」「Future Referenceである」ことと、「設計が未確定」であることを混同しない。

### 現在、USER REVIEW REQUIREDとして残る設計

**なし。**

2026-09-22時点で、今回整理対象だった `32 / 34 / 35 / 38 / 41 / 42` はすべてユーザー承認済みで、**CANONICAL / DESIGN FROZEN v1** へ昇格した。

### 第二段階の最終Freeze監査 — 2026-09-22

「方向性は承認済みだが、文書上の候補Statusや校正項目を最終整理する」対象を順次Freezeする。

完了:
- `11-world-competition-architecture.md` — **CANONICAL / DESIGN FROZEN v1**
- `12-competition-identity-hosting.md` — **CANONICAL / DESIGN FROZEN v1**
- `13-domestic-league-championships.md` — **CANONICAL / DESIGN FROZEN v1**
- `14-regular-season-calendar-and-volume.md` — **CANONICAL / DESIGN FROZEN v1**
- `15-season-events-and-deadlines.md` — **CANONICAL / DESIGN FROZEN v1**
- `16-club-economy-rivalry-design.md` — **CANONICAL / DESIGN FROZEN v1**
- `18-club-state-lifecycle.md` — **CANONICAL / DESIGN FROZEN v1**
- `19-club-structural-dominance-and-decline.md` — **CANONICAL / DESIGN FROZEN v1**
- `20-simple-surface-deep-simulation.md` — **CANONICAL / DESIGN FROZEN v1**
- `26-club-initial-seed-rating-model.md` — **CANONICAL / DESIGN FROZEN v1**
- `31-scouting-recruitment-system.md` — **CANONICAL / DESIGN FROZEN v1**

残る最終監査対象:
**なし。第二段階の最終Freeze監査は完了。**

これらは白紙の未承認案ではない。既存の採用方向を監査し、Architectureとcalibration/contentを分離してFreezeするための対象。

### 旧計画 / 後継へ統合済み

以下は **旧計画**。未確定計画一覧へ入れない。

- `39-manager-philosophy-and-command-architecture-DRAFT.md`
- `40-manager-ratings-era-and-strategy-evolution-DRAFT.md`
- `43-manager-strategy-evolution-architecture-DRAFT.md`
- `45-manager-decision-engine-and-temperament-DRAFT.md`
- `46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`
- `47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`

これらの後継Source of Truthは:

- `49-manager-architecture-v1.md` — **CANONICAL / DESIGN FROZEN v1**

`44-manager-real-world-tactical-stress-tests-DRAFT.md` は **VALIDATION CATALOG** であり、未確定計画ではない。

### ファイル名だけDRAFTが残るCanonical文書

以下はファイル名に `-DRAFT` が残っているが、内容は **CANONICAL / DESIGN FROZEN v1**。未確定計画として数えない。

- `32-roster-development-architecture-DRAFT.md`
- `34-team-traits-and-relationship-network-DRAFT.md`
- `35-team-trait-catalog-DRAFT.md`
- `38-team-mood-manager-interventions-DRAFT.md`
- `41-manager-appointment-and-incompetence-DRAFT.md`
- `42-manager-market-and-front-office-selection-DRAFT.md`
- `50-popularity-reputation-architecture-DRAFT.md`
- `51-star-superstar-big-stage-architecture-DRAFT.md`

補足:
- `52-star-superstar-genesis-v1.md` はCanonical supplement。
- 古い節に `CURRENT DRAFT` 等の時系列記録が残っていても、この節のSource Precedenceを優先する。

---

# 0.1 CANONICAL — World Competition Architecture v1

2026-09-22 user approved and froze:
- `docs/game-design/11-world-competition-architecture.md`

Key additions at freeze:
- variable rules such as cup-tied are versioned CompetitionProfile / RuleProfile policy
- competition expansion/reform creates a new CompetitionFormatVersion for future editions
- every Competition Edition retains a snapshot of format/rules/qualification/host/calendar provenance
- exact dates, money, roster counts, coefficient weights and branding remain calibration/content, not open architecture

---
# 0.2 CANONICAL — Competition Identity / Hosting / Draw v1

2026-09-22 user approved and froze:
- `docs/game-design/12-competition-identity-hosting.md`

Key freeze decisions:
- Host hierarchy is Region → Nation → City/Hub → Venue.
- Host selection is Eligibility → Suitability → Rotation/Recency.
- WBC-class World Championship finals are always hosted in the **United States**; only US cities/hubs/venues vary by Edition.
- WBC Global Qualifier pods remain eligible for worldwide hosting.
- Draw uses Hard/Soft Constraints with deterministic relaxation order and provenance.
- Home balancing is a Competition-specific fairness ledger, not a permanent club entitlement.
- Awards use versioned evidence-based selection policies.
- Prestige evolves historically but does not automatically rewrite canonical competition role.
- explicit Competition Reform / Succession is required to transfer a canonical role.
- hosting/draw/award/prestige provenance is retained in the Competition Edition snapshot.

---
# 0.3 CANONICAL — Domestic Championships & Continental Qualification v1

2026-09-22 user approved and froze:
- `docs/game-design/13-domestic-league-championships.md`

Key freeze decisions:
- the documented domestic format of all 21 Full Leagues is LeagueCompetitionProfile v1.
- RegularSeasonChampion and DomesticChampion may coexist as separate canonical titles.
- League coefficient determines berth count; domestic profile determines candidate order.
- DomesticChampion has an automatic route but still passes normal eligibility.
- duplicate/ineligible berths cascade deterministically with stored qualification provenance.
- postseason series structures in the document are v1 rules, not deferred guesses.
- tiebreak / qualification / home-field policies are versioned.
- reforms create new LeagueCompetitionProfile versions for future seasons.
- each season stores a snapshot of the historical domestic competition rules and qualification provenance.

---
# 0.4 CANONICAL — Regular Season Calendar & Game Volume v1

2026-09-22 user approved and froze:
- `docs/game-design/14-regular-season-calendar-and-volume.md`

Key freeze decisions:
- all 21 documented Regular Season game counts are official LeagueCalendarProfile v1 values.
- Full Simulation Leagues retain a v1 floor of 100 Regular Season games.
- World/continental windows take priority without silently reducing domestic game counts.
- schedule density never directly modifies player ability; fatigue is causal from actual calendar/travel/recovery.
- schedule generation separates Hard and Soft Constraints.
- impossible Hard Constraints produce Schedule Validation Failure rather than hidden game-count reduction.
- each season freezes a Base Schedule Snapshot; later changes are ScheduleRevisionEvents.
- CalendarProfile / opponent matrix / generator are versioned and historical schedules are never regenerated under new rules.
- arithmetic fixes at freeze: West/South Asia 5/5, Dominican 10/10, Puerto Rico 10/10, Cuba 4/4 home-away per opponent; Mexico window April–August.
- All-Star / deadline / roster-expansion event policy belongs to doc 15.

---
# 0.5 CANONICAL — Season Events & Deadlines v1

2026-09-22 user approved and froze:
- `docs/game-design/15-season-events-and-deadlines.md`

Key freeze decisions:
- six common event families exist, but no League is forced to enable all of them.
- real leagues prioritize official year-specific rules/dates; World Defaults are reference values.
- LeagueSeasonEventProfile is versioned.
- market windows may be TRADE / REGISTRATION / HYBRID and may be absent or multiple.
- roster expansion and competition eligibility cutoffs are optional Profile rules.
- roster counts remain owned by LeagueRosterProfile.
- All-Star/Awards are evidence-based and never direct ability buffs.
- Market Window events trigger Club AI; BUY/SELL strategy remains Club/Front Office responsibility.
- AwardSelectionPolicy is versioned.
- each season stores event-profile provenance, actual dates, eligibility snapshots and award-policy version.
- user surface remains a few meaningful season notifications, not an event-management chore loop.

---
# 0.6 CANONICAL — Club Economy / Identity v1

2026-09-22 user approved and froze:
- `docs/game-design/16-club-economy-rivalry-design.md`

Key freeze decisions:
- Club strength is causal and never a single hidden buff.
- money influences acquisition/retention/staff/facilities/development opportunity, never direct Match ability.
- Club source specifics are owned by 21; lifecycle by 18; structural persistence by 19; initial seeds by 26–30; rivalry lifecycle by 33; manager decisions by 49.
- real-world finance/ownership is Career-start ExternalReferenceSeed only and never live-synced into an existing Save.
- FinancialRegulationProfile is versioned by League/season.
- normal Club UI shows only: `資金力 / 人気 / 育成 / スカウト / 球場・設備`.
- `補強予算 / 人件費余裕 / 財政状態` may appear in detail view or an offseason brief.
- deeper revenue/debt/financing information is optional detail/audit UI.
- rivalry remains directional, but current competitive threat is separate from rivalry memory.
- encirclement is an analytic descriptor from independent club decisions, never a debuff.
- current initial world count is 234 Clubs.

---
# 0.7 CANONICAL — Club State Lifecycle v1

2026-09-22 user approved and froze:
- `docs/game-design/18-club-state-lifecycle.md`

Key freeze decisions:
- Club state layers are ExternalReferenceSeed + L0 Identity + L1 Institutional + L2 Seasonal + L3 Live + L4 Derived.
- real-world seed data is Career-creation-only and never live-synced into existing Saves.
- Club lineage events distinguish rename/relocation from extinction/split/merge/phoenix continuity changes.
- L2 holds season plans/snapshots; L3 holds mutable current state.
- Manager/Staff are Global Persons linked to the Club, not fixed Club attributes.
- Roster internals are owned by 32; ClubState stores references/snapshots instead of copies.
- Rivalry internals are owned by 33 and Current Competitive Threat is separate from Rivalry Memory.
- L4 current public view is the five-axis `資金力 / 人気 / 育成 / スカウト / 球場・設備` summary.
- `補強予算 / 人件費余裕 / 財政状態` are detail/offseason summaries.
- structural changes preserve provenance using Current Snapshot + Event Log/checkpoints.
- ClubSeasonSnapshot is historical, not live authority.
- catalog/seed versions are pinned per Save; migration never rewrites Save history.

---
# 0.8 CANONICAL — Club Structural Dominance & Decline v1

2026-09-22 user approved and froze:
- `docs/game-design/19-club-structural-dominance-and-decline.md`

Key freeze decisions:
- giant persistence is caused by multiple L1 structural states, never a single hidden giant/big-club stat.
- Structural Revenue Base is persistent but mutable through long-term causal history.
- Recovery Capacity / Economic Band / Crisis Level / Giant / Dynasty are Derived evaluations/descriptors.
- Crisis Levels never generate penalties themselves.
- sustained collapse requires real financial/institutional/supporter/staff/facility deterioration.
- random drift cannot directly collapse a giant; stochastic world events are allowed only through concrete causal state changes.
- named clubs have different initial structural compositions, not permanent club-name rules.
- challengers can become giants by compounding their own success without hidden debuffs to incumbents.
- Fast/Medium/Slow are characteristic timescales, not fixed timers.
- structural rise/decline is explainable through 18's structural event provenance and season snapshots.
- normal UI remains the five public axes; budget/wage room/financial state are detail/offseason summaries.

---
# 0.9 CANONICAL — Simple Surface, Deep Simulation v1

2026-09-22 user approved and froze:
- `docs/game-design/20-simple-surface-deep-simulation.md`

Top-level Product Rule:
> **一見シンプルだが、奥深い。**

Key freeze decisions:
- User controls understandable Baseball Decisions; accounting/company management stays background.
- normal Club surface is only the five axes `資金力 / 人気 / 育成 / スカウト / 球場・設備`.
- `補強予算 / 人件費余裕 / 財政状態` are detail/offseason summaries; deeper finance is optional audit.
- opening no detail/audit views must never disadvantage normal play.
- User plays baseball; Mood/Relationships happen underneath with no dedicated social chore loop.
- Development surface uses priority/assignment/usage, not training micromanagement.
- Scouting surface uses requests/shortlists while evidence/uncertainty stays background.
- legal HUMAN_OVERRIDE is never silently replaced by Manager/Board AI.
- background simulation may constrain legal action space through actual budgets/rules/injury/availability.
- Delegation/policy presets reduce input burden; they are not buffs.
- CPU clubs use the same world/economy/baseball rules and proper information boundaries.
- notifications are limited to actionable or significant changes.
- all future user-facing features must pass the Feature Admission Gate.

---
# 0.10 CANONICAL — Club Initial Seed Rating Model v1

2026-09-22 user approved and froze:
- `docs/game-design/26-club-initial-seed-rating-model.md`

Key freeze decisions:
- five axes are Career Creation seed targets/calibration summaries, not runtime club abilities.
- Career creation flows Seed -> causal initial state; after Pennant begins the direction is current State -> L4 five-axis view.
- public axes remain `資金力 / 人気 / 育成 / スカウト / 球場・設備`, raw seed 0-100 with S-G display.
- league baselines are initial priors/fallbacks, never league buffs.
- club overrides require evidence/provenance; no fixed ±15 architecture cap.
- Economic Band -> Finance conversion is initial-seed-only.
- Seed dataset/source/transform/confidence/override provenance is retained.
- docs 27-29 are Initial Seed Dataset v1 data for 234 Clubs, not unresolved architecture.
- dataset updates apply only to new Careers; existing Saves are never re-seeded.
- rivalry seed/lifecycle belongs to 30/33, not 26.
- initial seed values and S-G views never become runtime causal stats.

---
# 0.11 CANONICAL REFINEMENT — Person Headline Rating Contract

2026-09-22 user approved:

### Players
- all active / draft / recruitment-target Players may use `☆000〜999` as the one-glance Headline Player Rating.
- `☆500` is the current Rating Context average benchmark.
- `☆501〜999` uses a dark-red semantic text treatment so above-average players are immediately recognizable.
- exact RGB / typography is Presentation-owned.
- `☆` is a role-aware Derived Summary from public ability projections / suitability; it is not a Match Core stat.
- detailed 0–100 / G–S projections remain available.
- League-relative reference is generated from the **actual player population**, never from a hard-coded League-name strength modifier.
- if a League's actual player quality changes across a long Save, its Rating Reference changes accordingly.
- affiliated Players normally keep `ratingContextLeagueId = affiliationLeagueId`; temporary international competition does not rebase ratings.
- draft / recruitment targets are evaluated in the destination/evaluating Club's League context unless an explicit comparison context is selected.
- scouted target `☆` / detailed ratings come from that Club's Knowledge Estimate, not Hidden True State; low confidence may show `?` / ranges.

### Non-player Persons
- Manager / Scout / Coach / GM and other non-player staff may expose a Public Overall S–G.
- Overall is a role-specific Derived Summary of observed detailed skills, never a new true ability stat.
- Overall never directly modifies win probability, scout accuracy, player ability or any Core result.
- detailed staff skills remain available for users who want depth.

Current detailed contract: `docs/game-design/02-rules-ratings-defense.md` Section 4.0.

---
# 0.12 CANONICAL — Scouting & Recruitment v1

2026-09-22 user approved and froze:
- `docs/game-design/31-scouting-recruitment-system.md`
- `docs/game-design/53-player-development-trajectory-breakthrough-v1.md`
- `docs/game-design/54-player-development-breakthrough-adversarial-audit.md`

Key freeze decisions:
- Scout is a Global Person; Scouting Department is a Club institution.
- scouting changes Club Knowledge, never Player Truth.
- Discovery recognizes existing Global Players; it does not generate them.
- PlayerKnowledgeRecord preserves observation time, evidence, evaluator, estimate, confidence and freshness.
- RecruitmentDecisionRecord snapshots decision-time Knowledge / Need / Budget / Fit / Market / Offer context.
- CPU/User Clubs never use hidden True Player State for recruitment.
- Outcome != Scout correctness; post-hoc results do not rewrite original evaluation quality.
- scouting budget acts through staff/coverage/travel/data/timeliness, not direct accuracy buffs.
- Reports/organizational memory can become stale.
- Recruitment Authority is governance-defined; Manager supplies need/fit/usage input.
- User surface remains Director / simple emphasis / focused Player or Region request / shortlist.
- Scout/Director Public Overall S–G is a Derived Summary; detailed skills/specialties remain the source.
- recruitment targets may show `☆000〜999` from Club Knowledge in the dynamic League Rating Context.
- 26 Scouting Seed is Career Creation-only; current Scouting Rank derives from actual Department state.
- recruitment success/failure labels are analytic descriptors and do not assign automatic blame/buffs.

---
# 0.13 CANONICAL — Player Development Trajectory & Breakthrough v1

2026-09-22 user approved and adversarial audit passed:
- `docs/game-design/53-player-development-trajectory-breakthrough-v1.md`
- `docs/game-design/54-player-development-breakthrough-adversarial-audit.md`

Key freeze decisions:
- Development timing has five priors: `超早熟 / 早熟 / 普通 / 晩成 / 超晩成`.
- each timing combines with `SHARP_PEAK / BROAD_PLATEAU / STEPWISE_WAVES`, producing 15 v1 trajectory templates.
- timing/shape control development receptivity / peak prior / decline pressure, never age-based direct ability buffs.
- pathway labels such as high school / university / company baseball do not directly modify growth.
- each Player may have hidden catalyst sensitivities/signature motifs from Person generation, but they never guarantee a future event or awakening.
- real Career events such as surprise success, failure, injury/rehab, mentor, elite exposure, role change, rivalry, promotion/demotion, major stage and technical discovery may become catalysts.
- catalyst -> Appraisal -> learning hypothesis -> repetitions -> consolidation -> actual source-state change.
- `覚醒` is a rare Derived Career Event summarizing unusually large sustained development; it is never `AWAKENED=true -> ability buff`.
- per-training-repetition awakening rolls are prohibited; episode hazard uses novelty/saturation/cooldown and long-run calibration.
- major injury is a real cost first; rare Rehab reconstruction may become a catalyst, but injury receives no growth reward.
- Trait acquisition uses family-specific Acquisition Profiles; Recognition and Development are separate.
- Pressure traits require repeated stable relevant evidence; one walk-off / one lucky outing is only a catalyst.
- Green traits require stable behavior/preference change; one Manager instruction does not rewrite the Player.
- Gold is the Master Tier of the same Trait Family.
- **ノビ is G〜A; Gold tier is 怪童. `ノビ○` is not canonical.**
- User/CPU never reads hidden trajectory/catalyst/future-potential truth.
- Awakening does not automatically grant Star/Superstar status.

Audit result: **PASS**.

---
# 1. Game Slogan

> **一見シンプルだが、奥深い。**

表面の操作を複雑にしない。

内部Simulationは現実的・因果的にしてよい。

```text
Simple User Action
        ↓
Deep Hidden Simulation
        ↓
Understandable Baseball Result
```

---

# 2. Match Philosophy

Match CoreはOutcome-firstではなくCausal。

```text
Pitch World State
+ Batter Swing State
 -> Bat-Ball Contact
 -> Batted Ball Initial State
 -> Ball Physics
 -> Defender Perception / Movement
 -> Baseball Result
```

PresentationはMatch Coreを観測するだけ。

ASCII / Drone-Artを正史にしない。

---

# 3. No Magic Modifier

絶対原則。

```text
label
 -> direct ability buff
```

を禁止する。

例:

```text
Bayernだから強い
Rivalだから+10
LeagueがMLBだから能力+5
金持ちだからcontact+5
```

は禁止。

必ず中間因果を通す。

---

# 4. Player / Trait Philosophy

RatingやTraitは可能な限り:

- perception
- timing
- acceleration
- accuracy
- decision
- recognition
- trajectory prediction
- appraisal
- ActiveEmotion

等の中間変数へ接続する。

Gold / Blue / Red等のTrait displayはsource of truthではない。

---

# 5. Psychology

Emotionは常時Buffではない。

```text
context
 -> PersonalStake
 -> Appraisal
 -> EmotionPressure
 -> threshold
 -> ActiveEmotion
 -> behavior / execution
```

Rivalryもここへ接続する。

---

# 6. League Ecology

League名による能力補正は禁止。

Leagueの個性は:

- player population
- development
- scouting
- tactical tendencies
- exposure / familiarity
- stadium / environment
- rules
- history

からEmergentに作る。

---

# 7. Competition Regions

国際大会上のRegionは4つ。

```text
ASIA_PACIFIC
AMERICAS
EUROPE
AFRICA
```

Australia / New Zealand / Pacificは:

```text
geographicRegion = OCEANIA
competitionRegion = ASIA_PACIFIC
```

APBCLへ参加する。

---

# 8. World Club Source Policy

原則:

```text
major baseball club culture exists
 -> real baseball clubs

baseball is not the major club culture
 -> real football clubs as baseball clubs
```

Explicit exception:

- ChinaはBaseball Leagueが存在してもFootball Club sourceを使う

Europe / Russia / West-South Asia / China / NZ-Pacific / Pan-AfricaはFootball-derived。

Japan / Korea / Taiwan / North America / Mexico / Caribbean / Cuba / AustraliaはBaseball-derived。

---

# 9. Current World Scale

Full Leagues: 21

Current initial clubs: **234**

```text
Asia-Pacific  7 leagues / 62 clubs
Americas      6 / 86
Europe        7 / 74
Africa        1 / 12
```

Taiwan:
- current CPBL 6 clubs
- 100-game Regular Season

Australia:
- current 2026 ABL 4 clubs
- 108-game Regular Season
- Top-2 Final

All Full Simulation Leagues:
- minimum 100 Regular Season games

---

# 10. Club Philosophy

Club strength is not a single source-of-truth value.

Club data lifecycle:

```text
L0 Identity
L1 Institutional Slow State
L2 Seasonal State
L3 Live State
L4 Derived View
```

Real-world financial / club data is Initial Seed only.

Career begins:

```text
real-world snapshot
 -> initial world seed
 -> simulation starts
 -> real world disconnected
```

Existing Save must never be rewritten by future real-world changes.

---

# 11. Structural Giants

Real Madrid / Bayern / PSG / Barcelona等が長期的に強い理由はStructural Capital。

Examples:

- supporter capital
- brand capital
- commercial network
- stadium / assets
- institutional know-how
- recruitment network
- academy know-how
- financing access
- ownership backing

One bad season does not destroy these.

A giant becoming sustained bottom-tier requires explainable historic collapse.

Every `MEGA -> LOW` transition must be explainable from Club History.

---

# 12. Simple Surface Club UI

通常UIは原則5軸。

```text
資金力
人気
育成
スカウト
球場・設備
```

内部は0–100。

通常表示はS〜G。

These values are Initial Seeds / current summaries, never Match Core Buffs.

---

# 13. Club Initial Seed Files

- `26-club-initial-seed-rating-model.md`
- `27-asia-pacific-club-initial-seeds.md`
- `28-americas-club-initial-seeds.md`
- `29-europe-africa-club-initial-seeds.md`

All 234 clubs have initial five-axis seeds.

---

# 14. Rivalry

Rivalry is directional.

```text
A -> B
B -> A
```

are independent.

Traditional Rivalry:
- Slow historical base

Current Competitive Threat:
- Dynamic

Dominant Club targeting:
- Dynamic

Encirclement:
- observation of many independent Club decisions
- NOT a special Debuff

Numeric initial graph:
- `30-initial-directed-rivalry-graph.md`

---

# 15. Manager Strategy Boundary

Future Tactical Design will handle:

- ace targeting
- throwaway games
- direct-rival priority
- title-race priority
- anti-dominant-club encirclement

These must emerge from Manager AI decisions.

No League-level forced anti-giant mechanic.

---

# 16. Scouting

Scout is a Person Staff.

Scouting Department is an Institution.

Critical rule:

```text
Scout changes Knowledge
Scout does NOT change Player Truth
```

CPU Clubs must never read hidden true ability directly.

CPU recruitment must use:

```text
Club Knowledge Estimate
+ roster needs
+ manager preference
+ budget
+ contract demand
+ market competition
+ development plan
```

Scouts can:

- grow
- adapt
- gain experience
- build / lose network freshness
- be hired
- be poached
- be fired
- retire

Age alone must not equal decline.

Detailed design:
- `31-scouting-recruitment-system.md` — **CANONICAL / DESIGN FROZEN v1**

---

# 17. User Scouting Surface

Do not turn the game into staff-management spreadsheet.

Normal User interaction:

- hire / renew Scouting Director
- choose simple scouting emphasis
- request priority report on Player
- request priority Region
- view shortlist

Example:

```text
Scouting policy
○ Balance
○ Domestic Youth
○ International Youth
○ Immediate Help
```

Department details run in Background Simulation.

---

# 18. Recruitment Philosophy

Rich Club may fail badly.

Small Club may discover undervalued stars.

Recruitment chain:

```text
Scout / Analyst
 -> Knowledge
 -> Scouting Director
 -> GM / Sporting Director
 -> Manager fit input
 -> Negotiation
 -> Acquisition
 -> Usage / Development
 -> Outcome
```

A good Scout Report can still be ignored.

A good Player can still be a bad signing due to price / fit / usage.

---

# 19. CPU Club Principle

CPU must play by the same world rules.

No hidden infinite budget.

No hidden true-player knowledge.

No direct difficulty ability Buff.

CPU differences may come from:

- decision quality
- scouting quality
- planning horizon
- risk tolerance
- organizational quality

---

# 20. Competition Philosophy

Domestic postseason may use series.

International knockout:
- single-game elimination from knockout stage

Continental CL:
- Group Stage = 3-game series
- Knockout = single-game

Club World:
- same

Current Club World qualification:
- 4 Regional Champions
- defending Club World Champion
- host-region berth
- 10 performance berths
= 16

---

# 21. Key Documents

Recommended reading order for a new session:

1. `00-current-design-handoff.md`
2. `20-simple-surface-deep-simulation.md`
3. `16-club-economy-rivalry-design.md`
4. `18-club-state-lifecycle.md`
5. `19-club-structural-dominance-and-decline.md`
6. `21-world-club-source-policy.md`
7. `26-club-initial-seed-rating-model.md`
8. `30-initial-directed-rivalry-graph.md`
9. `31-scouting-recruitment-system.md`
10. competition docs 10–15 as needed

---

# 22. Do Not Regress

Do not:

- reintroduce ASCII as Match Core
- use direct league buffs
- make rivalry a direct ability buff
- make giant clubs collapse by random drift
- make Economic Band permanent
- give CPU true-player omniscience
- turn scouting into fixed Club-only number
- force User to manage accounting / sponsors / loans
- reduce Full League seasons below 100 games
- split Australia back out of Asia-Pacific competitions
- change international knockout back to long series without explicit redesign
- overwrite existing Save with future real-world updates

---

# 23. Next Natural Design Topics

Current natural next candidates:

1. Roster / Active / Reserve / Farm / Academy structure
2. Contract system
3. GM / Sporting Director / Manager authority split
4. Staff system beyond scouting
5. Draft / FA / Transfer / Loan integration
6. Player generation / amateur intake
7. CPU roster-building strategy
8. Manager tactical resource allocation

Use the same rule:

> Simulation may be deep. User control should remain simple.

---

# 24. CANONICAL — Roster / Development Architecture v1

2026-09-22 user approved and froze:

- `docs/game-design/32-roster-development-architecture-DRAFT.md`

The filename retains `-DRAFT` only for history. The document is now **CANONICAL / DESIGN FROZEN v1**.

Frozen architecture:

- one Global Player Person; no roster copies
- separate Club Rights / Registration / Assignment / Availability
- five Assignment Kinds are semantic categories, not five fixed roster boxes
- multiple Development / Farm levels are supported
- injuries / rehab are Availability + Registration state, not a roster tier
- official Reserve / Farm / Academy games use the same Canonical Match Core as First Team games
- lower-tier games retain real standings, results and player statistics; performance is not randomly generated without games
- speed comes from Renderer OFF / accelerated execution / bounded persistence, not an alternate outcome engine
- regional Pre-Pro / Intake pathways are modeled separately
- Japan-like pathways may include high school / university / company-amateur routes into Draft / contract
- existing-pro reallocation mechanisms are transaction paths, not rookie intake
- Academy is used where culturally appropriate and never directly generates stars
- background Youth Population becomes concrete Global Player Persons when tracked / recruited / contracted
- development arises causally from opportunity, coaching, maturation, health, role, competition and adaptation
- priority development uses finite coaching attention, not magic fixed slots
- Pennant User uses a Human Control Overlay over the original Manager Agent
- delegated decisions still use the original manager's Skill / Philosophy / Temperament / Belief / Strategy Memory
- HUMAN_OVERRIDE decisions are not learned into the original manager's Strategy Memory as self-chosen strategy evidence
- real baseball leagues use season-specific real regulations as the primary Roster / Intake Profile reference
- regions without a matching real baseball league use World Default plus modest regional identity

Remaining exact roster counts, service-time rules, quotas, draft eligibility and numeric formulas are implementation / League Profile calibration, not unresolved architecture.

---

# 25. APPROVED — Rivalry Lifecycle

次にユーザーが詰めたいテーマ。

2026-09-20にユーザー承認。

ユーザー案:

```text
initial / historical rivalry
 -> permanent historical core

later-emergent rivalry
 -> event-driven increase
 -> can also decay over time
 -> eventually may disappear if no longer meaningful
```

狙い:
- 後天的Rivalryが増え続けて全Clubが宿敵になるのを防ぐ
- 伝統的Derbyは消えない
- Title race / elimination / incident等から新しい因縁を作れる
- 後天的因縁は無関係な年月が続けば薄れる

**正式設計は `docs/game-design/33-rivalry-lifecycle-model.md` を正とする。**

重要追加原則:
- 初期Real-world rivalryと後天Game-world rivalryを同じ歴史Labelで表示しない
- Emergent Rivalryは強くても「近年の宿敵 / 因縁」と表示する
- Historical / Traditional LabelはInitial Seed由来だけに許可する
- 異地域間Rivalryも実際のSave Historyが十分なら成立可能


Rivalry lifecycle design (APPROVED):
- `docs/game-design/33-rivalry-lifecycle-model.md`


Team traits / player relationship architecture (CANONICAL / DESIGN FROZEN v1):
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`


Team Trait Catalog (CANONICAL / DESIGN FROZEN v1):
- `docs/game-design/35-team-trait-catalog-DRAFT.md`


---

# 26. CANONICAL — Team Traits / Player Relationship Architecture v1

2026-09-22 user approved and froze `34-team-traits-and-relationship-network-DRAFT.md`.

Current Source of Truth:
- Public axes: 好感 / 信頼 / 連携
- Affinity / Trust = directional sparse Relationship edges
- Coordination = role/task-specific joint-action state
- bad relationship alone never lowers raw batting ability
- batting resonance = the batter can express their own existing batting strength more fully
- no direct HR / hit / walk modifier; no relationship-created Plate Discipline
- Pair / Cluster scopes are derived, not magical permanent groups
- Team Trait labels never become Source of Truth
- Gold is a master-tier descriptor, not a multiplier
- evidence double-counting is prohibited
- synchrony labels such as 投打不協和 are ANALYTIC_DESCRIPTOR only and add zero gameplay effect
- Relationship carries across seasons; Coordination may decay with dormant shared experience retained
- Mood/Trait direct feedback loops are prohibited
- no routine social-maintenance chores for the User

`35-team-trait-catalog-DRAFT.md` is now CANONICAL v1. Exact thresholds / duration days / decay rates remain calibration tasks, not open architecture.

Historical 2026-09-20 development notes follow:

2026-09-20 current work:

- `08-player-traits-design-seed.md` was expanded into the Special Ability / Trait System Master Plan.
- Player Relationship axes approved: `Affinity / Trust / Coordination`.
- Team Trait colors approved: `Blue / Red / Gold`.
- Negative relationship alone must not lower batting true ability.
- Batting resonance expresses the receiver's own archetype; teammate success never grants an incompatible ability.
- Defensive coordination may degrade from low coordination / communication because defense is joint action.
- Team Traits are temporary Pennant states and may be acquired / fade / expire.
- Team Trait Catalog draft contains 91 candidates across offense, pitching, defense, context, environment, relationship and negative team-state families.

Current files:
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
- `docs/game-design/35-team-trait-catalog-DRAFT.md`

Next intended design order:
1. review / trim Team Trait Catalog
2. Team Mood
3. Manager Ability
4. Popularity / Reputation


---

# 27. APPROVED — Anti-Monocausal Principle

2026-09-20 ユーザー承認。

重要な恒久原則:

> **一つの便利なSystemだけで、複雑な長期現象を全部説明しない。**

特にTeam Traitは:

```text
proximate-state layer
= 今どう噛み合っている / 崩れているか
```

であり、

```text
universal root cause
= なぜ10年・20年弱いか
```

ではない。

長期低迷は:

- Scouting
- Development
- Roster Construction
- Manager / Front Office
- Economy / Institutional State
- Player Retention / Succession

等の上流原因を必要とする。

この原則をTeam Mood / Manager Ability / Popularity設計にも適用する。


Team Mood design (APPROVED):
- `docs/game-design/37-team-mood-architecture.md`


---

# 28. APPROVED — Team Mood

2026-09-20 approved design:

- Team Mood is a social-psychological environment, not a team ability buff.
- Mood is a vector: Confidence / Cohesion / Energy / Tension / Role Harmony.
- Mood Maker is a **catalyst, not a battery**.
- A star arrival may create Hope, but sustained mood change requires actual performance + credibility + social integration + diffusion.
- Once positive state diffuses into collective confidence / relationships / routines, the catalyst can be absent without instant collapse.
- Public Popularity is separate from Clubhouse Influence.
- Multiple Mood Makers have diminishing returns; they may also conflict.
- Team Mood feeds Player Appraisal / emotional contagion / recovery / communication willingness, never raw batting or pitching ratings.
- Team Mood and Team Traits must not create circular self-amplifying modifiers.
- Anti-Monocausal Principle applies: Team Mood alone never explains a 100-loss turnaround or star-heavy collapse.

Canonical:
- `docs/game-design/37-team-mood-architecture.md`

The five Mood axes and Mood Maker catalyst model are already approved.
Remaining UI wording / carryover rates are implementation calibration, not open architecture.


Team Mood baseball-decision consequence layer (CANONICAL / DESIGN FROZEN v1):
- `docs/game-design/38-team-mood-manager-interventions-DRAFT.md`


---

# 29. CANONICAL — Team Mood as Baseball Decision Consequence Layer

2026-09-22 user rejected the remaining Social / Mood-management game loop.

Canonical:
- `docs/game-design/38-team-mood-manager-interventions-DRAFT.md`

Core rule:

> **User plays Pennant baseball. Relationship / Mood happens underneath.**

User-facing Mood-specific actions are not part of v1.

Rejected as dedicated buttons / chores:
- individual meeting
- encourage / pep talk
- explain role
- delegate mediation to leader
- encourage competition
- Mood-specific wait/observe action
- Team meeting / Mood improvement action
- routine social maintenance

Normal Baseball / Roster / Development decisions such as lineup, usage, pitching, defense, rest, promotion/demotion and training become actual World events.
Players Appraise those events; Relationship / Manager Trust / Role Harmony / Team Mood then change in background simulation.

HUMAN_OVERRIDE decisions execute exactly; their social consequences remain in World history, but the original manager does not learn the override as self-chosen Strategy Memory.
MANAGER_DELEGATED continues to use the original manager AI.

Mood may be shown passively when significant, but it is not a management meter and exposes no Mood-action menu.

This is a direct application of the project slogan:

> **一見シンプルだが、奥深い。**

---
# 30. APPROVED — Team Mood Rarity Boundary

2026-09-20 ユーザー承認。

重要原則:

> **Team Moodは勝敗の主役にしない。**

- most teams / most days = normal mood, no meaningful Match effect
- ordinary friendship / friction does not change winning ability
- only exceptional cohesion or serious dysfunction can materially affect Appraisal / contagion / communication / recovery
- raw player ability is never changed by Mood
- Team Traits remain the main baseball-facing proximate state
- Mood alone cannot grant Blue / Red Team Traits; independent baseball evidence is required
- Mood intervention should be rare enough not to become routine management work
- long-term winners / dark eras are still explained primarily by roster, scouting, development, manager, economy and Team Traits

Team Mood is a rare **social-psychological exception layer**, not a second team-rating system.


---

# 31. APPROVED — No Social Chore Principle

2026-09-20 ユーザー承認。

重要原則:

> **人間関係は“育てる義務”ではなく、“時々起こる意味のある出来事”として扱う。**

- ordinary relationships maintain themselves in background simulation
- no weekly meeting chores
- no hidden affection decay because the user did not click social actions
- no “keep everyone happy” optimization loop
- most relationship fluctuations do not require user action
- manager intervention appears only for meaningful dysfunction / opportunity

Team Mood / Relationship should add human texture without turning entertainment into social-maintenance labor.


Historical manager philosophy / command draft (SUPERSEDED / 旧計画):
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`


---

# 32. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20 current design work:

Core split:

```text
Manager Philosophy = what the manager prefers
Manager Skill      = how well the manager executes it
Manager Knowledge  = what the manager knows / believes
Manager Authority  = how well instructions are understood / accepted
Manager Adaptation = how the manager updates from new evidence
```

Important candidate principles:
- User and CPU managers use the same legal baseball action space.
- CPU has no hidden True Ability access.
- Human user's tactical choice is not overwritten by a fake Manager IQ roll.
- Manager philosophy is not inherently good/bad: aggressive steals, complete-game preference, data-heavy, intuition-heavy, youth-first, veteran-first etc. are context-dependent.
- Instructions have three levels: Default Philosophy / Game Plan / Immediate Command.
- Player final intent derives from manager instruction + player tendency + trust + tactical understanding + autonomy + context + emotion.
- Instructions never create player abilities the player does not possess.
- Manager traits do not directly add win probability or raw batting/pitching ability.

Initial philosophy families include:
- offense: running aggression, steal emphasis, power/contact, patience, small ball, lineup stability, platoon use, hot hand vs track record
- pitching: starter leash, bullpen role model, matchup relief, zone/chase, fastball/breaking, inside/outside, intentional walk
- defense: shift aggression, data positioning, run-prevention posture, arm/range preference
- roster: veteran/youth, promotion-demotion churn, rest policy, star privilege/equality, development/win-now
- information: data/intuition, pregame/adaptive, opponent/self-style, evidence patience, risk tolerance
- human management: autonomy/control, role stability/competition, intervention/hands-off, public accountability

Draft:
- `docs/game-design/39-manager-philosophy-and-command-architecture-DRAFT.md`


Historical manager ratings / era / strategy draft (SUPERSEDED / 旧計画):
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`


---

# 33. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20 design direction:

Public CPU Manager ratings are proposed as six simple S–G grades:

```text
采配 / 分析 / 適応 / 選手眼 / 運用 / 統率
```

Internal values remain 0–100 and project to the same S–G boundaries as Player Ratings.

Important candidate principles:
- no overall Manager rating
- Philosophy and Skill are separate
- Era is Context, not Ability
- old-era managers are not inherently weaker
- each Era changes information availability, rules, staff tools, league priors and Meta
- managers may be ahead of their time through Analysis + Adaptation + experimentation + correct hypothesis + roster fit
- tactics are built from atomic decision primitives rather than only named historical classes
- CPU can form Strategy Hypotheses, test them, update beliefs, and gradually create new tactical patterns
- successful innovations can diffuse through assistants, coaching trees and opponent observation
- opponents can imitate and counter, causing Strategy Edge to shrink over time
- a user who copies a causally strong CPU Manager strategy should be able to improve when roster/context fit, but copying does not guarantee success
- future baseball should emerge from the strategy search space rather than a hard-coded 2100 meta

Draft:
- `docs/game-design/40-manager-ratings-era-and-strategy-evolution-DRAFT.md`


---

# 34. CANONICAL — Manager Competence & Special Ability Architecture v1

2026-09-22 user approved and froze:
- `docs/game-design/41-manager-appointment-and-incompetence-DRAFT.md`

Core:
- Manager employment does not guarantee competence.
- six public axes remain 采配 / 分析 / 適応 / 選手眼 / 運用 / 統率; a Public Overall S–G is now allowed as a Derived one-glance summary.
- D/E/F/G can genuinely exist; Active Manager has no hard skill floor.
- low Skill never directly modifies win probability.
- weak managers still use the normal Manager Decision Engine and make explainable mistakes through bad beliefs / candidate generation / evaluation / adaptation.
- True Skill / Public Grade / Reputation are separate.
- first-time managers may show `?` or low-confidence public ratings.
- competence and roster/philosophy/staff fit are separate.
- Staff supplies information / support but does not directly buff Manager True Skill.
- age itself does not cause decline; old priors + low Adaptation can create obsolescence.
- HUMAN_OVERRIDE is never changed by Manager Rating; MANAGER_DELEGATED uses the original manager.

Manager Special Ability layer:
- six skills remain the underlying source; Blue / Red / Gold are readable derived descriptors.
- Red examples: 頑固親父 / 恐怖政治 / 珍采配 / 負け運 / 聞く耳持たず / 結果論者 / 実績偏重 / 左右病 / バント病 / 完投病 / 固定観念 / 早とちり.
- Blue examples: 柔軟采配 / 臨機応変 / 適材適所 / 慧眼 / 抜擢上手 / 用兵上手 / 継投巧者 / 修正上手 / データ活用 / 参謀活用 / 勝負所察知 / 役割運用○ / 育成眼 / 切替上手 / クジ運○.
- Gold is rare; initial examples include 変幻自在 / 神算 / 名伯楽 / 用兵の魔術師 / 千里眼 / 不世出の策士 / 未来予知.
- 負け運 is analytic only and never causes losses.
- クジ運○ and its Gold counterpart 未来予知 are derived only from actual lottery history and never alter RNG.
- descriptor names may be added later if existing canonical sources explain them; new labels must not create duplicate gameplay stats.

Hiring / retention / firing / OB preference / ownership / market selection are delegated to doc 42.

Manager Market / Front Office selection is now CANONICAL / DESIGN FROZEN v1:
- `docs/game-design/42-manager-market-and-front-office-selection-DRAFT.md`

---
# 35. CANONICAL — Manager Market & Front Office Selection v1

2026-09-22 user approved and froze:
- `docs/game-design/42-manager-market-and-front-office-selection-DRAFT.md`

Core:
- Manager True Skill != Hiring Value != Reputation != Public Grade.
- Club never reads hidden Manager True Skill directly.
- Manager Market is bilateral: Club chooses Manager and Manager may accept / reject Club.
- Candidate Pool is dynamic across long saves: former players, coaches, assistants, farm managers, analysts, external managers and low-profile candidates can enter.
- OB / former-star visibility can influence hiring information and preference, never Manager Skill.
- Front Office uses imperfect estimates; better evaluation reduces uncertainty/bias rather than revealing Truth.
- Interviews / references are evidence, not an oracle.
- first-time managers retain high uncertainty.
- hiring styles are derived from Club history / ownership / supporter / organizational context rather than magic archetype buffs.
- contract length / salary / firing cost matter internally but do not become a contract-management minigame.
- retain / extend / fire is expectation-adjusted, not standings-only.
- failed managers may be re-hired elsewhere and can succeed in a different fit.
- internal succession pipelines persist across generations.
- User surface remains simple: appointment news + optional detailed profile.

Human Control Overlay:
- HUMAN_OVERRIDE outcomes remain real World history.
- HUMAN_OVERRIDE decisions are not credited or blamed as the underlying manager's own decision-quality evidence.
- only MANAGER_AUTONOMOUS / MANAGER_DELEGATED are primary manager-skill evidence.
- during long User control, the underlying Delegate Manager is not frozen forever; contracts, retirement and market succession continue.
- when User leaves a Club, the then-current Delegate Manager becomes the visible Manager.

Status:
> **The six USER REVIEW REQUIRED designs identified on 2026-09-22 are now all DESIGN FROZEN.**

---
Historical emergent-strategy draft (SUPERSEDED / 旧計画):
- `docs/game-design/43-manager-strategy-evolution-architecture-DRAFT.md`


---

# 36. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20 current design:

The remaining Manager evolution topics are organized as one seven-layer causal architecture:

```text
Baseball Environment
 -> Tactical Primitives
 -> Manager Belief Model
 -> Strategy Hypotheses
 -> Experiment / Learning
 -> Strategy Diffusion / Lineage
 -> League Meta / Counter-Strategy
 -> future hypotheses
```

Key candidate principles:
- future tactics are not hard-coded named unlocks
- a Strategy is a set of Context -> Action / Threshold policy rules
- named tactics such as opener are descriptors over actual policies
- CPU managers hold uncertain beliefs, not World Truth
- invention is bounded local mutation / recombination of existing policies, not random genius
- Experiment Budget prevents constant gimmick play
- evidence updates intermediate baseball outcomes, not only win/loss
- Analysis reads evidence; Adaptation changes beliefs/policies; Tactical Judgment chooses actions now
- Strategy lifecycle: IDEA -> HYPOTHESIS -> LIMITED_TRIAL -> PROVISIONAL -> ESTABLISHED -> DEFAULT -> OBSOLETE/DORMANT
- user-created repeated policies can be observed and imitated by CPU
- CPU-created policies can be copied by user
- Coaching Tree transfers ideas / priors, never Manager Skill
- League Meta is a derived distribution of actual strategies, not a global buff
- widespread strategies provoke counter-strategies
- future baseball emerges from rules, player population, information technology, economics and accumulated tactical knowledge
- innovations may fail; League Meta can temporarily follow bad ideas
- strategy history / lineage can be recorded as optional Save history
- computational search is sparse and local, not exhaustive

Draft:
- `docs/game-design/43-manager-strategy-evolution-architecture-DRAFT.md`

Recommended approval order:
1. Tactical Primitives + Context Patterns
2. Manager Beliefs + Strategy Hypothesis lifecycle
3. bounded Experiment / Learning
4. Diffusion + Coaching Tree
5. League Meta + Counter-Strategy
6. historical reconstruction + future-emergence soak


Manager real-world tactical stress tests (VALIDATION CATALOG / not an open plan):
- `docs/game-design/44-manager-real-world-tactical-stress-tests-DRAFT.md`


---

# 37. VALIDATION CATALOG — NOT A CURRENT PLAN

2026-09-20:

Historical stress tests were added for Manager Architecture.

Key cases:
- 栗山英樹: 1番・投手 大谷翔平
- 落合博満: 山井8回完全 -> 岩瀬9回
- 星野仙一: 前日160球の田中将大をGame 7の9回へ
- 渡辺久信: 岸孝之を中2日Long Relief
- 長嶋茂雄: 10.8三本柱継投
- 梨田昌孝: 代打・北川博敏
- 原辰徳: 内野5人シフト
- 工藤公康: 第2先発 / 日替わりLineup / 強打者Bunt
- Bobby Valentine: extreme lineup variation / YFK
- 岡田彰布: JFK
- 近藤貞雄: スーパーカートリオ / Green Light
- 緒方孝市: タナキクマル / Role Clarity / buster / squeeze / double steal
- 野村克也: 遠山・葛西の投手↔一塁switch / 松井-specific role development
- 王貞治: no-hit pitcherへ代打してplanned bullpen
- 西本幸雄: 江夏の21球でのsqueeze decision

Major architecture requirements revealed:
- Series Horizon
- secondary objectives such as records / symbolism
- Player willingness as advisory input
- arbitrary defensive coordinates
- between-pitch alignment changes
- opponent counter-action
- era-specific substitution legality
- pitcher-field-position switches when legal
- Green Light autonomy directives
- role reassignment
- sign inference / deception

Draft:
- `docs/game-design/44-manager-real-world-tactical-stress-tests-DRAFT.md`


Historical manager decision-engine / temperament draft (SUPERSEDED / 旧計画):
- `docs/game-design/45-manager-decision-engine-and-temperament-DRAFT.md`


---

# 38. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20:

Manager personality is now explicitly separated from ability and baseball philosophy.

```text
Skill       = how well the manager reasons / executes
Philosophy  = what kind of baseball the manager prefers
Temperament = how the manager decides under uncertainty / pressure
```

Candidate Temperament axes:
- decisiveness
- conviction
- composure
- openness
- consultative style

These do not provide direct buffs.

Decision Engine candidate flow:

```text
Decision Trigger
 -> Observed Situation
 -> Manager Belief Slice
 -> Legal Action Set
 -> Candidate Generation
 -> Manager Forecast
 -> Objective / Horizon Evaluation
 -> Risk + Philosophy + Temperament
 -> Bounded Decision
 -> Instruction Encoding
 -> Player Interpretation
 -> Canonical Match Simulation
 -> Decision Memory / Learning
```

Important additions:
- Fast Policy Path for routine decisions
- Deliberative Search for high-leverage / unusual situations
- Decision Horizon Stack: pitch / at-bat / game / series / season / development
- Objective Vector: win-now / future resources / health / development / role stability / milestone / symbolic value
- low Manager Skill creates plausible reasoning defects, never random idiocy rolls
- Manager Forecast uses Beliefs, never Match Core hidden truth
- opponent responses are modeled sequentially
- hidden signs remain hidden; opponent may infer from observable cues
- outcome quality and decision quality are separated
- CPU decision reasons can be surfaced in simple user-facing explanations

Draft:
- `docs/game-design/45-manager-decision-engine-and-temperament-DRAFT.md`


Historical rare-tactics / psychological-play / Decision Log draft (SUPERSEDED / 旧計画):
- `docs/game-design/46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`


---

# 39. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20:

Historical motif verified in public reporting:
Ichiro later asked Sadaharu Oh about being intentionally walked from the first inning during his BlueWave period; Oh explained that if the unusual treatment disturbed Ichiro's normal composure, that itself would benefit the Hawks.

Design consequence:
- Manager tactics may have uncertain psychological / information objectives in addition to direct baseball objectives.
- No action directly applies an opponent mental debuff.
- Visible unusual actions become stimuli; the opponent Player's own Appraisal / Emotion system determines reaction.
- Psychological targeting may work, do nothing, or backfire.
- Deliberative Search gets at most one bounded Rare Candidate; no random "crazy move" roll.
- Surprise decays as opponents observe repeated use.

New Manager Decision Log:
- stores trigger, observed context, manager beliefs, candidates, expected benefits/costs, objectives, horizon, philosophy/temperament influence, chosen action, opponent response, outcome, and learning update.
- User-facing log exposes reasons, not hidden World Truth.
- Opponent full thought logs are postgame by default; live full traces are reserved for optional Spectator / Research Mode.
- Important decisions are surfaced via a derived Importance score rather than dumping every routine decision.

Draft:
- `docs/game-design/46-manager-rare-tactics-psychological-play-and-decision-log-DRAFT.md`


Historical candidate-evaluation / gimmick-control draft (SUPERSEDED / 旧計画):
- `docs/game-design/47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`


---

# 40. HISTORICAL DRAFT — SUPERSEDED BY Manager Architecture v1

2026-09-20:

Candidate actions are evaluated from Manager Belief, never World Truth.

Subjective valuation includes:
- immediate baseball value
- future resource value
- health cost
- roster opportunity cost
- role/social cost
- opponent response risk
- uncertainty
- complexity
- information gain
- surprise
- psychological value
- symbolic value

Important distinction:
```text
Candidate Admission = does the manager think of the option?
Candidate Selection = does the manager actually choose it?
```

New personality tendency:
- Novelty Seeking = tendency to admit unfamiliar / unusual candidates
- it is not a Skill

A derived "gimmick addiction" pattern can emerge from:
```text
high Novelty Seeking
+ high Decisiveness
+ high Experimentation
+ low Analysis
+ poor uncertainty calibration
+ Result Bias
```

Such a manager can make several unusual decisions in one game, but there is no random comedy roll and no fixed hidden penalty.

Repeated weird tactics naturally lose Surprise and can accumulate execution complexity / opponent-learning costs.

Draft:
- `docs/game-design/47-manager-candidate-evaluation-and-gimmick-control-DRAFT.md`


---

# 41. CANONICAL — Manager Architecture v1

2026-09-20 adversarial audit completed.

Audit:
- `docs/game-design/48-manager-architecture-adversarial-audit.md`

Canonical design:
- `docs/game-design/49-manager-architecture-v1.md`

Status:
> **Manager Architecture v1 is DESIGN FROZEN.**

The adversarial audit found that the core causal direction was sound, but normalized several overlapping concepts before freeze.

Final Manager source of truth:

```text
STATIC / SLOW
  Skill
  Philosophy
  Temperament

DYNAMIC
  Belief State
  Strategy Memory

EXTERNAL
  Rules / Environment
  Staff Advice
  Manager-Player Relationships
  Match / Series / Season Context
```

Public six skills remain:
```text
采配 / 分析 / 適応 / 選手眼 / 運用 / 統率
```

Important corrections from the audit:
- Adaptation is a Skill, not a duplicate top-level system.
- Knowledge is the dynamic Belief State.
- Authority / Trust is relationship-derived, not a personal Manager stat.
- Temperament is frozen to five value-neutral axes:
  Risk Appetite / Decision Pace / Policy Persistence / Novelty Appetite / Consultation Style.
- Openness / Experimentation / Novelty Seeking are merged into Novelty Appetite.
- Giant 12-term scalar utility is rejected. Candidate comparison uses six forecast channels + dominance pruning + context/horizon evaluation.
- `Rare Candidate` is no longer a special action class. Unusualness is candidate metadata.
- in-world `Experiment Budget` is removed. Exploration uses a causal Exploration Gate.
- Surprise is not a standalone reward; it affects opponent uncertainty / preparation.
- psychological tactics must route through the existing Player Appraisal / ActiveEmotion architecture.
- Manager Decision Log is immutable structured trace from decision time, never post-hoc narrative invention.
- full routine traces are not permanently stored; only meaningful / key decisions persist.
- public S–G Manager skill ratings and Public Overall are observed estimates of hidden detailed skill evidence, so first-time managers can remain uncertain.
- automatic strategy invention is constrained by a Tactical Grammar and RuleEngine legality.
- League Meta is a derived description, not a global tactical buff.
- Coaching Tree transfers ideas / priors, never Manager Skill.
- User / CPU same Legal Action Space and no direct Manager buffs are frozen principles.

Historical Stress Test remains a validation catalog:
- `docs/game-design/44-manager-real-world-tactical-stress-tests-DRAFT.md`

Pre-freeze draft files 39 / 40 / 43 / 45 / 46 / 47 are archived design work. Their useful detail may remain as rationale, but 49 is authoritative where conflicts exist.

Required future validation before implementation sign-off:
- 10 / 50 / 100+ season multi-seed soak tests
- tactical diversity / convergence
- rare tactic frequency
- manager identity stability
- meta turnover
- manager-vs-roster contribution
- compute / save growth

Manager Competence doc 41 and Manager Market doc 42 are both CANONICAL / DESIGN FROZEN v1.


---

# 42. CANONICAL REFINEMENT — League-local Doctrine Diffusion

2026-09-20 user requested that manager doctrine / tactical ideas should diffuse much more easily inside a league than across leagues.

This is now part of Manager Architecture v1.

Canonical rule:

```text
same club / staff tree
 -> strongest transfer

same league / frequent opponents
 -> strong

same competition region
 -> medium

cross-league / cross-region
 -> weak by default
```

Cross-league spread requires actual bridges such as:
- manager / coach movement
- player movement
- analyst / staff movement
- international competition
- public video / statistical evidence
- deliberate study
- independent rediscovery

Imported doctrine is always re-evaluated under local:
- rules
- player population
- ball / park environment
- roster construction
- opponent meta
- available information

League tactical culture is Derived from actual policies, never a hard-coded buff or permanent identity.

This allows one league to remain bunt / small-ball heavy while another becomes air-ball / power oriented, without preventing later convergence or independent tactical discovery.

Canonical file:
- `docs/game-design/49-manager-architecture-v1.md`

Canonical refinement commit:
- `4379927cdae5b337b3f74b50f878608e9894acf7`


---

# 43. CANONICAL v1 — Popularity / Reputation

2026-09-20 design started.

Canonical v1 (legacy filename retains `-DRAFT`):
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`

Core separation:

```text
Exposure / Awareness
= how widely a person is known

Public Favorability
= how positively a specific audience sees the person

Reputation
= what observers believe the person is like

Clubhouse Influence
= internal social influence; separate Team Mood / Relationship source
```

Important candidate principles:
- Popularity is derived from Awareness + positive Favorability; not a raw baseball ability.
- Popularity is audience-specific rather than one global scalar.
- very famous + disliked and locally beloved + globally unknown are both possible.
- Reputation is observer belief, not Truth; it can be accurate, exaggerated, outdated, or wrong.
- `人気者` becomes a Career / Presentation descriptor derived from AudienceStanding.
- `威圧感 / 存在感` route through Reputation -> Opponent Appraisal / tactical response, never direct opponent ability debuff.
- Public Popularity remains separate from Clubhouse Influence.
- crowd reaction can become a Player Psychology stimulus, but Popularity never directly modifies batting/pitching ability.
- local / league / national / international awareness scopes are supported.
- transfers preserve audience history rather than resetting popularity.
- popularity / media maintenance chores are prohibited.

First open decision:
whether a slow `Public Appeal` person factor is needed to help explain why equally successful players can differ in fan popularity.


---

# 44. APPROVED DIRECTION — Fan Favorite / Star / Superstar Split

2026-09-20 user corrected the Popularity boundary.

Canonical direction for the ongoing Popularity design:

```text
人気者
= fan affection / lovable public figure

Star
= competitive prominence + broad recognition

Superstar
= exceptional, sustained, wide-scope Star status
```

These are not one progression ladder.

Important:
- a beloved role player can be `人気者` without being a Star
- an elite Star may not be a `人気者`
- a Superstar may be polarizing
- Popularity / Star labels never feed Manager tactical decisions
- opponent caution / intentional walks / matchup planning remain driven by scouting, data, opponent history and Manager Belief
- Popularity effects are secondary: attendance interest, cheers, fan presentation, merchandise / event salience
- no direct Match buff
- no automatic Team Mood increase
- Clubhouse Influence remains separate
- Reputation / 威圧感 is removed from Popularity ownership and deferred back to Scouting / Manager Belief / Psychology

Canonical v1 file (legacy filename retains `-DRAFT`):
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`

Refinement commit:
- `9f436e9a93ec70487162afddcee70164c4156c28`


---

# 45. APPROVED DIRECTION — Star / Superstar Big-stage Mechanics

2026-09-20 user clarified that Fan Favorite and Star/Superstar have different responsibilities.

```text
人気者 / Fan Favorite
= affection / crowd / secondary Career presentation

Star
= competitive prominence / tactical gravity

Superstar
= exceptional Star
 + broad recognition
 + iconic salience
 + strong high-stage evidence
```

Important:
- Fan Favorite does not affect Manager tactical decisions.
- Star / Superstar may influence opponent preparation and tactical attention through Manager Belief.
- Manager remains the owner of actual decisions such as intentional walk, matchup relief, defensive positioning, etc.
- Star / Superstar labels never directly modify raw ability.
- Big-stage performance uses a separate underlying `Spotlight Response` profile.
- high Match Salience (title-deciding games, elimination games, WBC/international, major rivalry, legacy moments) can shift Condition / Appraisal.
- strong Spotlight Response makes good Condition / positive activation more likely under pressure, but does not guarantee success.
- Superstar status is derived from elite competitive prominence + broad recognition + iconic/high-stage evidence. The label does not feed back as a magic buff.
- statistical greatness and iconic greatness must remain distinguishable.
- Shigeo Nagashima and Shohei Ohtani are validation motifs, not hard-coded persons.

Canonical v1 file (legacy filename retains `-DRAFT`):
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Commits:
- `eda18e2e4f900f150e04aee25e541e40612291cf`
- `a6246897d1eea914f1441356831212201a377454`


---

# 46. REFINEMENT — Superstar Archetypes

2026-09-20 user clarified that Superstar must not be framed as "iconicity instead of ability."

Superstar can include overwhelming competitive greatness.

Three useful derived archetypes:

```text
Dominant Superstar
= historic-level competitive ability / production
+ broad recognition

Iconic Superstar
= elite competitive level
+ exceptional cultural / memorable salience

Complete Superstar
= historic competitive dominance
+ broad / global recognition
+ iconic salience
+ repeated major-stage success
```

Important:
- Superstar is never a substitute for weak ability.
- A minimum Star-level competitive floor is required.
- publicity alone does not create Superstar.
- different Superstars can have different shapes across competitive dominance / iconic salience / spotlight evidence / public reach.
- Superstar label remains derived and never grants raw ability.

Updated draft:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Refinement commit:
- `d0080e55c7613abfb50cb75bd6e569d2d3ebe422`


---

# 47. REFINEMENT — Star / Superstar Rarity

2026-09-20 user clarified that even Star status should be difficult to earn, and Superstar should be extremely rare.

Design rule:

```text
Star
= rare competitive-center status

Superstar
= historically exceptional status
```

No hard quotas:

```text
one Star per club
one Superstar per league
top-N auto assignment
```

are prohibited.

Instead strict evidence gates create rarity.

Star Gate requires:
- high league-relative competitive prominence
- sustained high-level performance
- central competitive role
- meaningful opponent attention
- broad league awareness
- persistence

Superstar Gate requires Star-level foundation plus exceptional evidence such as:
- historic competitive dominance OR exceptional iconic salience
- sustained elite relevance
- broad / cross-audience recognition
- major-stage evidence
- historical persistence

Important:
- several years as a Star does not automatically create Superstar
- some eras may have no active Superstar
- rare eras may contain multiple overlapping Superstars
- most strong regular players remain non-Star
- Superstar rarity is calibrated through multi-season soak, not hard caps
- Star is mainly league-relative; Superstar requires broader historical / cross-league significance
- current Star/Superstar status can fade while Legacy status persists

Updated draft:
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Refinement commit:
- `5e9ad9b8d25709a42eac307b9050fba0d7bc07bd`


---

# 48. CANONICAL — Popularity / Star / Superstar v1

2026-09-20 user approved and froze the design.

Canonical files:
- `docs/game-design/50-popularity-reputation-architecture-DRAFT.md`
- `docs/game-design/51-star-superstar-big-stage-architecture-DRAFT.md`

Final distinction:

```text
人気者 / Fan Favorite
= affection / crowd / presentation

Star
= rare competitive-center status
+ tactical gravity

Superstar
= historically exceptional Star
+ broad recognition
+ iconic salience
+ strong high-stage evidence
```

Important:
- Fan Favorite does not affect tactical decisions.
- Star / Superstar can matter tactically, but actual decisions remain owned by Manager Belief / scouting / data / context.
- no label gives a raw ability buff.
- high-pressure performance uses Match Salience + Spotlight Response -> Condition / Appraisal.
- Star itself is rare; Superstar is extremely rare.
- no fixed quota; some eras may have zero Superstar.
- exceptional eras may contain multiple Superstars.
- Superstar is not compensation for weak ability.
- Current status and Legacy status may diverge.
- Clubhouse Influence remains separate from Popularity.

Remaining work is implementation and calibration, not architecture.


---

# 49. CANONICAL — Star / Superstar Genesis v1

2026-09-20 user approved the generation-first rare candidate model.

Canonical:
- `docs/game-design/52-star-superstar-genesis-v1.md`

Core rule:

```text
Star / Superstar Candidate
= rare hidden generation predisposition

Star / Superstar Status
= later Career evidence / recognition
```

Candidate is not destiny.

A rare genesis profile may bias:
- Spotlight Potential
- Pressure Stability Potential
- Pressure Conversion Potential
- Iconic Potential
- Public Magnetism Potential

Hard boundary:
- Match Core never reads STAR_CANDIDATE / SUPERSTAR_CANDIDATE.
- Match only reads realized Spotlight Response, Condition, Appraisal, ActiveEmotion, actual ability and Match Salience.

Superstar emergence:

```text
latent predisposition
× baseball ability
× development
× opportunity
× major-stage access
× actual outcomes
× public reach
× era context
× luck
 -> observed Career
```

Consequences:
- a Superstar candidate may never become a Star
- a non-candidate may rarely become a Star
- ordinary baseline -> fully acquired Superstar is extremely rare
- some eras may have no realized Superstar
- user normally discovers exceptional players through repeated Career evidence, not a visible destiny badge

This permits a Nagashima-type player:
elite but not necessarily the statistical #1, exceptional under spotlight, repeatedly successful on major stages, culturally iconic.

It also permits dominant Complete Superstars with historic true ability + production + broad recognition + major-stage success.

Canonical commit:
- `3097c562cda3bc67caf0a4bdebc956a86f900d4f`