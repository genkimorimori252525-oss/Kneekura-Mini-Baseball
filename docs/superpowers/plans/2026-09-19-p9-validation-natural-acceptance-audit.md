# P9 Validation / Natural Boundary Acceptance Audit — 2026-09-19

**Status:** IMPLEMENTATION COMPLETE FOR FOUNDATION; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P9 — statistical validation and Natural transition boundary.

## Acceptance map

| Requirement | State | Evidence | Boundary |
| --- | --- | --- | --- |
| canonical evidence serialization | **implemented** | `CanonicalEvidenceFingerprint` | sorted object keys, ordered arrays, exact integer ticks, finite numbers only |
| deterministic regression fingerprint | **implemented** | 16-hex regression fingerprint | regression identity only; not cryptographic security |
| fixed-seed corpus contract | **implemented** | `FixedSeedRegressionCorpus` | scenario data separated from expected results |
| fixed-seed corpus runner | **implemented** | `FixedSeedRegressionRunner` | reports unfrozen / match / mismatch without rewriting baseline |
| causal debug trace | **implemented** | `CausalDebugTrace` | ordered input→perception→strategy→decision→execution→rules→final evidence |
| same-contact alignment comparison | **implemented** | `SameContactAlignmentComparison` | exact same canonical contact set reused across alignments |
| evaluator mutation guard | **implemented** | canonical clone + pre/post fingerprint | alignment/contact evidence cannot be altered to create a false shift effect |
| batch aggregate statistics | **implemented** | `BatchValidationStatistics` | outs/hits/TB/runs/extra bases/fieldable hit rate |
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

Expected fingerprints remain `null` until the repository verify job actually executes successfully.

This is intentional.

A pre-step CI failure is not enough evidence to freeze a baseline.

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

## CI caveat

Latest GitHub Actions evidence:

- run `35368386921`;
- head `c03a42ae96371a7ccf8e242694ec70bb7c4dca89`;
- verify job `105676242863`;
- `steps=[]`.

The workflow still fails before repository commands execute.

Therefore:
- repository GREEN is **not** claimed;
- expected fixed-seed fingerprints remain unfrozen;
- source-level P0-P9 foundation is considered implemented, but runtime verification remains externally blocked.

## Roadmap completion

P0 through P9 now have source implementations and acceptance fixtures for their planned foundation boundaries.

Further work is post-roadmap calibration and expansion rather than another missing foundational phase.

Recommended next work after CI execution becomes available:

1. run full `npm run verify`;
2. repair any real type/test failures;
3. run representative fixed-seed corpus;
4. freeze fingerprints only after verified reproducibility;
5. expand contact corpus size;
6. measure large-batch throughput;
7. calibrate statistical distributions against intended baseball behavior;
8. begin Natural renderer work against the frozen read-only contract.
