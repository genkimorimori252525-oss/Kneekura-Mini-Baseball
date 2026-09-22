# Trait Lifecycle v1 — headless API

## Authority and extent

Implements a **subset** of the approved canonical09 family/lifecycle registry and canonical53 development contract, pinned to design commit `782f6b8ef2406839de5678b00040001111cd8f77`. Parent is PR31 / `b155ad7827da9014c5628deeb7b0f82ab2377b46`.

The registry explicitly includes all13 graded families, seven named learned families, and seven Green preference families. Other classes are declared in the type vocabulary but are **not supported by the registry/reducer yet**: dynamic descriptors, causal negatives outside represented graded tiers, contextual relationships, and career-history descriptors. No family is classified by color, Japanese substring or a guessed Gold label. Reference names are specification audit labels, not approved UI copy.

This module never changes a Player's skill, health, age, velocity, physical swing, or a Match Core result. It neither implements full development nor calculates consolidated source skills. A Trait is a lifecycle-controlled projection; the real source owner remains authoritative. Recovery is included at G–A; this subset does not promote the catalog's candidate Recovery Gold mapping into a runtime family rule.

## Public operations

Import from `src/core/world/traits/index.ts`.

| Operation | Input | Result |
| --- | --- | --- |
| `getTraitFamilies()` | none | immutable explicit registry |
| `createTraitState(input)` | `{scope:{careerId,playerId}, policy}` | empty scoped state; no automatic grants |
| `restoreTraitState(input)` | checkpoint | validated, detached, deeply frozen state |
| `evaluateTrait(state, evaluation)` | one family assessment with scope, revisions and evidence | `{state,receipt}` |
| `getTraitPortfolio(state)` | current state | lifecycle-only family projection and current source references |
| `resolvePreferenceIntent(input)` | numeric preferences, same legal action set and current directive | normalized intent weights or exact hard intent |
| `replayTraitEvents(checkpoint, receipts)` | compact checkpoint plus ordered accepted tail | recomputed state, or explicit mismatch |

Except registry access, operations return `{ok:true,value}` or `{ok:false,reason:{code,path}}`. Rejection does not return or mutate a partly updated state. Successful values are independent frozen data. Inputs are inert plain data/JSON; getters, custom prototypes, sparse arrays and symbols are rejected. Arbitrary JavaScript Proxy objects are not a supported serialization format.

There is no I/O, timer, RNG, network, disk access, screen/button decision or rendering dependency.

## Evidence and clock contract

`TraitTime` has `season`, `day`, `sequence`. **day is a career-global monotonically increasing ordinal**, not a day-of-season. Same-day observations require a greater sequence; seasons cannot go backwards.

An evaluation binds career/player, exact policy ID/version, expected state revision, evaluation ID and family ID. Each family's source has a stable `sourceKey`, physical/technical `sourceRevision` and `sourceSnapshotId`, plus an independent `evidenceRevision`, meaningful `episodeId` and nonempty `eventIds`.

- `RECOGNITION`: subsequent source revision and snapshot stay unchanged; new evidence can correct its projection.
- `DEVELOPMENT` / `BOTH`: subsequent source revision increases and snapshot changes. The module records that claim, but does not perform or authenticate the underlying development.
- Evidence revisions must increase. Reuse of IDs still visible in the checkpoint is refused; replay also rejects duplicate evaluation IDs and family/episode pairs throughout its tail.
- Separate assessments cannot turn one episode into unlimited practice. **Deduplication of older episodes beyond a compact checkpoint and authentication of external event IDs are host responsibilities.** Episode provenance has to represent real exposure, not every animation frame or repeated observation of the same play.

Known checkpoint proofs are checked for matching player/family/policy, source continuity, internally consistent snapshot/revision identity and strict chronological order. Same global revision cannot identify different accepted evaluations. Replay verifies every output receipt, not just final totals. It is consistency checking, not a cryptographic proof of authentic history.

## Graded versus learned lifecycle

`CURRENT_SOURCE` assessments can change G–A and supported extreme/master tiers in either direction or remove the projection. One effective state per family prevents stacking several grades. The13 canonical families are registered explicitly, not implemented only for ノビ.

`LEARNED_TECHNIQUE` assessments have a candidate tier and stage (`CATALYST`, `HYPOTHESIS`, `REPETITION`, `CONSOLIDATED`), relevant repetition count, practice-day count and source distinctiveness. **Only CONSOLIDATED with all supplied per-tier thresholds met** can acquire or upgrade a learned family. The policy must explicitly provide every supported tier and nondecreasing requirements; missing policy is rejected.

Persistent learned/master tiers retain their original qualifying proof after current expression declines or disappears. Lower current feasibility must still restrict actual execution in the source/physical owner. `MASTERED` does not override that owner. A retained learned trait is not evidence that the player can still execute at their younger physical level.

The reducer refuses two learned families granted from the same sourceKey. This is not a complete semantic distinctiveness or training-opportunity engine: the source owner must consolidate overlapping skills and account for finite practice/coaching/role opportunities. **No fixed total trait-count cap is implemented.** The all27-family test checks only absence of an arbitrary cap, not realistic population-wide trait density.

Pressure-family projections (`pitch_pressure`, `bat_pressure`, `setback_recovery`) report `PRESSURE_APPRAISAL`. They must not bypass the existing ActiveEmotion gate or be added again as a direct performance bonus. `SOURCE_EXECUTION` identifies the causal owner, not a command to apply a label-derived bonus.

## Green slow preference

Every Green family has one underlying neutral choice in the registry. No observed entry is created until evaluated. Family policy supplies `enterThreshold > leaveThreshold`, at least two distinct observations, and positive minimum elapsed days. **There are no production defaults.** Test values are deliberately synthetic.

A non-command, internalized voluntary/accepted observation qualifies only when incumbent support is at or below the leave threshold and another variant reaches the enter threshold. Highest support wins; equal support uses stable state ID ordering, not array order. All variants must be present in every assessment.

Pending evidence accumulates only for consecutive qualifying evaluations of the same family and target. A nonqualifying/command episode resets **pending recognition**, not stored preference. Assessments of other families do not reset it. Observation count saturates safely while waiting for elapsed time. Pending evidence may span seasons using global days. This conservative consecutive-observation rule is a kernel choice, not a claimed calibrated human-behavior model.

After both persistence conditions are met, one preference replaces the old one. The proof records the old/new states, first qualifying day, count and final evidence. The fifth and subsequent transition within a season emits `GREEN_CHURN_CALIBRATION`; it does not block the transition, hide it, or impose a hard cap. Production calibration/soak tests must prevent such frequent changes naturally. Season rollover resets diagnostics, not preference or persistent technical mastery.

## Manager directive arbitration

`resolvePreferenceIntent` consumes a **source-owned numerical default preference**, not a Trait label. It requires career/player, family, decision/context, source snapshot, legal action IDs and a complete nonzero set of player weights in [0,1]. Manager weights use exactly the same legal actions. Output sorts action IDs and normalizes distributions.

- `NONE`: current player distribution.
- `SOFT`: `(1 - managerInfluence) * player + managerInfluence * manager`, after each supplied distribution is normalized.
- `HARD`: an understood, accepted, legal action is returned as exact one-hot intent.

Unknown/illegal options, missing or duplicated weights, nonfinite values and all-zero distributions are rejected. Ununderstood/unaccepted directives return `COMMAND_NOT_ACCEPTED`; a caller must resolve that situation explicitly, not silently treat it as obedience or a fallback. Numeric influence is caller supplied, not an invented authority formula.

This output is an intent proposal. It does not sample an action, execute it, decide an outcome, update a Green state, or award a skill. A later request with no directive returns the unchanged player default. Bind it to the current authoritative decision opportunity and use the existing control attribution boundary; do not accept stale/forged context merely because this function echoes an ID.

## Host integration responsibilities

Authenticate source skills, consolidation/exposure, command producer/acceptance, exact policy versions and player/decision references. Atomically compare the expected revision and persist returned state plus receipt; apply cross-owner skill/world effects only through their actual owners. Keep immutable version mappings and globally unique evaluation/episode identities across checkpoints. Migration must not invent new mastery or rewrite historical evidence.

Consumers eventually need the same accepted state as future observation, but **no UI/renderer connection or live skill/intent consumer is added in this PR**. Missing downstream wiring is explicit, not a claim that the running game already applies every named special ability.
