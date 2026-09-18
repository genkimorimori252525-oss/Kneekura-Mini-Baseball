# P9 Validation / Natural Boundary Acceptance Audit — 2026-09-19

**Status:** P0-P9 FOUNDATION VERIFIED; FIXED-SEED BASELINE FROZEN; INITIAL BATCH CALIBRATION VERIFIED.

**Parent roadmap:** P9 — statistical validation and Natural transition boundary.

## Acceptance map

| Requirement | State | Evidence | Boundary |
| --- | --- | --- | --- |
| canonical evidence serialization | **implemented** | `CanonicalEvidenceFingerprint` | sorted object keys, ordered arrays, exact integer ticks, finite numbers only |
| deterministic regression fingerprint | **implemented** | 16-hex regression fingerprint | regression identity only; not cryptographic security |
| fixed-seed corpus contract | **implemented + hardened** | `FixedSeedRegressionCorpus` | uint32 seed domain, recursive freeze, scenario data separated from expected results |
| fixed-seed corpus runner | **implemented** | `FixedSeedRegressionRunner` | reports unfrozen / match / mismatch without rewriting baseline |
| causal debug trace | **implemented** | `CausalDebugTrace` | ordered input→perception→strategy→decision→execution→rules→final evidence |
| same-contact alignment comparison | **implemented** | `SameContactAlignmentComparison` | exact same canonical contact set reused across alignments |
| evaluator mutation guard | **implemented + hardened** | canonical clone + recursive freeze + pre/post fingerprint | transient or persistent alignment/contact mutation cannot be used to create a false shift effect |
| batch aggregate statistics | **implemented + verified** | `BatchValidationStatistics` | outs/hits/TB/runs/extra bases/fieldable hit rate |
| deterministic batch calibration probe | **implemented + verified** | `P9BatchCalibration` | same 1,024 canonical contacts through real `DefenderMotion`; validation-only result buckets; no Presentation input |
| performance measurement | **implemented** | `ValidationPerformanceHarness` | wall clock is measurement-only and never passed into scenario execution |
| Natural read-only contract | **implemented** | `NaturalReadOnlySnapshot` | canonical clone + deep runtime freeze |
| renderer OFF / Mini / Natural isolation | **implemented source acceptance** | `P9PresentationIsolationAcceptance.test.ts` | canonical fingerprint unchanged by renderer path/settings |
| Mini dot-size recalibration isolation | **implemented** | P9 presentation acceptance | render diameter changes only Presentation state |
| Natural metadata/model-scale isolation | **implemented** | P9 presentation acceptance | 3D display metadata cannot change source fingerprint |

## Canonical regression evidence

The regression envelope may contain:

```text
match seed
play id
starting CanonicalMatchState
scenario builder id
canonical events
canonical world samples
final state
debug evidence
        ↓
stable canonical serialization
        ↓
regression fingerprint
```

Object insertion order does not affect serialization.

Arrays preserve semantic order.

Unsupported evidence includes:
- `undefined`;
- NaN / Infinity;
- functions;
- non-plain objects.

This prevents renderer/runtime objects from leaking into canonical regression evidence.

## Fixed-seed corpus policy

A corpus entry records:

- scenario ID;
- match seed;
- starting match state;
- scenario builder ID;
- evidence class;
- optional expected fingerprint.

Expected fingerprints were intentionally kept `null` until full repository verification actually executed successfully.

After two successful executions of the exact same unfrozen source head, the three representative fingerprints were frozen:

- fielding perception: `0d6e8aefd4601e9a`;
- baserunning motion: `8c3db4d6447bcad5`;
- tag-up appeal rules: `d49f585e4b33fb17`.

The freeze commit is `c3a409cffd6aa1950deb83f5efd38da5946664d8`. A post-freeze full verify run confirmed all three scenarios as `match`.

## Causal debug trace

Representative stages:

```text
input
  -> perception
  -> strategy
  -> decision
  -> execution
  -> baserunning
  -> rules
  -> final_state
```

Every entry owns:
- authoritative availability tick;
- stable sequence number;
- stage;
- kind;
- canonical evidence.

The trace fingerprint changes when an intermediate causal fact changes even if the final label happens to remain the same.

This allows a future unexpected result to be traced back to:
- input;
- seed;
- scouting;
- alignment;
- local perception;
- coverage choice;
- movement;
- catch/throw/tag execution;
- runner decision;
- rule adjudication.

## Same-contact defensive alignment comparison

`SameContactAlignmentComparison` takes:

- one immutable contact-evidence corpus;
- multiple `DefensiveAlignment` candidates;
- one alignment evaluator.

The harness itself never applies a hit/out modifier.

For every alignment it:

1. canonical-clones the contact input;
2. canonical-clones the alignment;
3. runs the evaluator;
4. verifies neither clone was mutated;
5. fingerprints evaluator evidence;
6. aggregates physical outcomes.

Therefore a shift difference must emerge from the evaluator's actual:
- geometry;
- movement;
- catch;
- throw;
- base contact;
- runner/rule execution.

The test fixture demonstrates a difference using existing `DefenderMotion` from different starting geometry.

No batter debuff exists.

## Aggregate validation statistics

Reusable batch statistics include:

- samples;
- outs;
- singles/doubles/triples/HR;
- errors;
- fielder's choices;
- hits;
- total bases;
- runs allowed;
- extra bases allowed;
- fieldable balls;
- hits on fieldable balls;
- fieldable hit rate;
- out rate;
- runs allowed per sample.

Home runs are excluded from the fieldable-hit-rate denominator because they are not useful evidence of ordinary defensive alignment reach.

The statistics module only aggregates supplied canonical outcomes. It does not decide baseball outcomes.

### Initial deterministic batch calibration

`P9BatchCalibration` adds a validation-only probe over 1,024 deterministic contacts generated from seed `20260919`.

The same immutable contact corpus is evaluated through two defensive alignments using real `DefenderMotion`. Presentation, Mini, Natural metadata, point size, camera state, and render timing are absent from the canonical inputs.

The validation-only classification buckets are deliberately not the production hit/result engine. They exist to turn physical reach evidence into stable aggregate calibration evidence without introducing batter debuffs or a hidden result modifier.

Verified run `35396396378` on source head `8b306a155ff6bf802ad8866dc3c0e516adef23b6` produced:

| Alignment | Outs | Hits | XBH | Runs allowed | Out rate | Calibration evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| normal | 624 | 400 | 225 | 119 | 0.609375 | evaluation fingerprint `bf334bb3105106fc` |
| pull-heavy | 527 | 497 | 353 | 185 | 0.5146484375 | evaluation fingerprint `c9dfd271c5b04152` |

Shared contact fingerprint: `2f545c9acac3ab71`.

Whole calibration fingerprint: `f5058efd2d23784c`.

The acceptance test executes the entire 1,024-contact batch twice and requires exact result equality. The measured difference is therefore a consequence of the supplied geometry plus Core movement under this synthetic contact distribution, not a claim that one real-world alignment is universally better or worse.

## Performance boundary

`ValidationPerformanceHarness` reads a measurement clock only:

```text
read clock
   ↓
execute deterministic scenario batch
   ↓
read clock
```

The clock value is never passed into scenario execution.

Two runs with identical scenario evidence but different measured runtime produce:

- different duration metadata;
- identical evidence;
- identical evidence fingerprint.

Thus performance measurement cannot become simulation input.

## Natural read-only boundary

Natural receives a frozen snapshot containing:

- `CanonicalMatchState`;
- `CanonicalWorldSnapshot`;
- `TimedMatchEvent[]`;
- optional canonical public metadata;
- source fingerprint.

The snapshot is:
- canonical-cloned;
- non-aliased from Core source objects;
- recursively frozen at runtime.

Natural cannot legitimately:
- rerun physics;
- rerun AI;
- alter Core coordinates;
- feed skeleton/bone contacts back into Core;
- replace numeric physical primitives.

This matches the Mini/Natural architecture:

```text
Shared Match Core
       ↓
Canonical state/events
       ├── Mini point renderer
       └── Natural 3D renderer
```

Both renderers are observers.

## Physical-body / rendering boundary

The earlier body design remains intact.

Core uses numeric physical state:
- body origin;
- glove reach;
- tag-hand reach;
- foot reach;
- velocity / acceleration;
- radii;
- exact contact ticks.

Mini may render only:
- defender point;
- runner point;
- ball;
- bat in batting view.

Natural may later render:
- meshes;
- bones;
- full 3D animation.

Neither point size nor 3D bone location is an input to canonical collision/rule results.

`PlayerPhysicalProfile` can independently feed:
- Core physical calibration;
- Presentation size/model calibration.

Presentation is never the source of physical dimensions.

## Renderer isolation acceptance

The P9 acceptance fixture compares the same canonical source through:

1. renderer OFF;
2. Mini field-overhead renderer;
3. Natural read-only snapshot;
4. different Mini camera scale;
5. different Mini point-size calibration;
6. different Natural presentation metadata.

The canonical source fingerprint remains identical.

This closes the core requirement that rendering does not influence baseball results.

## Post-foundation determinism hardening

Before the first expected fingerprint was frozen, the P9 validation boundary was tightened further.

Candidate source head after hardening:

- `15e3add70d71b2bde29d3969cf48a374a302f019`

Changes:

1. canonical object keys no longer use `localeCompare`; ordering now uses locale-independent JavaScript string code-unit comparison;
2. fixed-seed builders receive recursively frozen canonical clones rather than writable clones;
3. same-contact alignment evaluators receive recursively frozen contact/alignment clones;
4. post-evaluation fingerprints remain as a second mutation-detection layer;
5. fixed-seed `matchSeed` is restricted to the same unsigned 32-bit domain consumed by Core RNG;
6. constructed fixed-seed corpora are recursively frozen so baseline identity cannot drift after creation.

These were source hardening changes made before the behavioral baseline was frozen.

### Historical partial local validation

Before the self-hosted GitHub Actions path was restored, a bounded local check was performed from source files read at exact head `15e3add7...`.

The checked subset included:

- `CanonicalEvidenceFingerprint`;
- `FixedSeedRegressionCorpus`;
- `FixedSeedRegressionRunner`;
- `SameContactAlignmentComparison`;
- their real direct Core type dependencies.

Evidence:

- TypeScript 5.8.3 strict/no-unused local subset typecheck: **PASS**;
- Node runtime smoke for locale-independent canonical ordering: **PASS**;
- recursive fixed-seed corpus freeze: **PASS**;
- fixed-seed builder mutation rejection: **PASS**;
- alignment evaluator mutation rejection: **PASS**;
- uint32 wrapped-seed rejection: **PASS**;
- smoke marker: `P9_SMOKE_OK`.

This historical smoke evidence was deliberately **not** treated as `npm run verify`, Vitest full-suite acceptance, or repository GREEN. It has now been superseded by successful full repository verification.

## CI recovery and verified baseline

The earlier GitHub billing / spending-limit pre-step blocker was real, but it is no longer the active verification state.

Verified CI evidence:

- run `35394466844`, attempt 1, head `83d01d52650bbfac9d5b8e8390ecf9af9d9da32f`: **228 test files / 1065 tests passed** with the unfrozen fixed-seed corpus;
- run `35394466844`, attempt 2, exact same head: **228 test files / 1065 tests passed** and the same three observed fingerprints were reproduced;
- freeze commit `c3a409cffd6aa1950deb83f5efd38da5946664d8`;
- run `35395593056` on the freeze commit: **228 test files / 1065 tests passed**, all three fixed-seed scenarios reported `expectation: "match"`;
- run `35396396378`, attempt 1, head `8b306a155ff6bf802ad8866dc3c0e516adef23b6`: **229 test files / 1068 tests passed**, including the 1,024-contact batch calibration probe.

Therefore:

- full repository GREEN is established for the validated source head;
- representative fixed-seed fingerprints are frozen and checked;
- the first deterministic large-contact calibration evidence is recorded;
- renderer / Presentation state remains outside canonical regression and calibration inputs.

The old billing failure remains useful historical evidence, but it is no longer a current blocker.

## Roadmap completion

P0 through P9 now have source implementations and acceptance fixtures for their planned foundation boundaries.

Further work is post-roadmap calibration and expansion rather than another missing foundational phase.

Recommended next work:

1. replace validation-only single/double/triple buckets with broader production outcome paths only when the causal Core can actually resolve them;
2. expand canonical contact corpora and compare statistical distributions against explicit baseball targets;
3. add full-game / season-scale throughput measurement on top of the existing wall-clock-isolated harness;
4. preserve the frozen fixed-seed corpus as a regression tripwire while calibration changes;
5. begin Natural renderer work against the already frozen read-only contract;
6. keep all Natural / Mini presentation parameters outside canonical simulation inputs.