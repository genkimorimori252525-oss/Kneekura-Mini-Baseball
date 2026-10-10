# Standalone physical practice motion

Area 8 now has an additive standalone owner for three explicitly prescribed
motion families: `DRY_SWING`, `DEFENDER_FOOTWORK`, and `RUNNING_MOTION`.
This follows the original nonvisual implementation scope and the existing
learning contract. It does not infer a learning domain, relevance, effort,
health, or ability change from a drill name.

`openSqliteStandalonePracticeStore` admits one accepted prospective command for
an original Player/Person, owned body, dated capability model, workload revision
and earlier HYPOTHESIS/PRACTICING episode revision. Native readers reconstruct
those originals on the consumer's SQLite snapshot. Fresh admission checks the
current dated model and episode/workload heads. Reopening keeps the original
pins. One canonical Player/opportunity identity and workload-revision reservation
prevents aliases from charging the same admitted drill twice. Earlier standalone
work must have its actual completion, workload and applicable learning receipt;
new commands cannot overlap its same-day consumed interval. Pitching and these
standalone motion families check each other’s original consumed/settled work and
same-day clocks before admitting a new command.

Execution uses existing Core laws: runner reaction/acceleration/braking,
rated defender acceleration and bounded integration, and the selected batting
repertoire's swing trajectory with the original capability speed ceiling and
motor latency/technical timing. Defender integration boundaries are fixed by the prescribed
interval, so a partial consumption call cannot change its earlier acceleration.
The accepted initial kinematics and spatial frame remain explicit inputs.
No physiology, action-selection, coaching or assessment formula is added.

`begin` owns the prospective command and initial state. Only `advance` adopts a
strictly forward consumed physical prefix, guarded by the original workload
head and an append-only progress revision. Every read recomputes that prefix;
exact retries return their original cut. Full prescribed-interval consumption
creates the completion hash. It denotes completion of this bounded drill, not
Match closure, ball contact, possession, a catch, a run, or success at a target.
A dry swing's contact-named trajectory knot is an intended geometric knot only.

An independently accepted assessment pins the completion hash, explicit effort,
health availability, relevance, exposure factors and assessment/calibration
provenance. Only an assessed relevant, actually moving repetition can enter the
existing learning writer. Stationary work may retain an explicit effort
assessment, but cannot produce a motion-learning event. `settle` first applies
one original PRACTICE workload receipt through the existing global workload
writer, then the pinned learning revision. If the learning CAS cannot proceed,
the actual workload remains charged and an exact retry resumes the same event.
No second workload charge or fabricated learning application is introduced.

Fixed dispatch authenticates this family in the generic learning reader/writer,
Native development prefixes, later pitch-practice episode reads, and mixed
practice exposure. The existing workload writer also validates this family's
original consumed proof and exact PRACTICE receipt on write, post-write and
retry. Closed-owner exposure/capability readers can reconstruct these originals
without a live intake callback. Later consolidation and explicit capability
reassessment remain their own existing boundaries.

## Finite author verification

The focused file `src/host/world/StandalonePracticeMotion.test.ts` covers a real
Native running body/model, consumed running work, three exactly-once PRACTICE
receipts, learning/consolidated exposure, old-cut retry, reopened practice, a
stationary relevance rejection and trigger rollback. Its small dry-swing and
footwork tests exercise the real Core functions using explicit synthetic
capability inputs; they do not qualify Native original-model admission for those
two families. The first run exposed test-fixture variable shadowing, which was
corrected before the passing selection. No full compiler, whole/archive suite,
long Native game gate, home-PC CI or publication ran in this author slice.

The six-case selection passed in 22.24 seconds. After the final dry-swing
connection reused the existing technical-offset/motor-start calculation, its
one affected case passed in 5.56 seconds. Targeted semantic diagnostics for all
nine changed TypeScript files reported zero diagnostics. The protected 18 blobs
match the supplied recovery manifest, and the whitespace check is clean. These
are finite author checks; the integration owner retains consolidated review and
whole/archive qualification.

## Concrete remainder

Standalone bat/ball contact, thrown-ball/glove contact, catching/possession and
other drill families still need an original standalone ball/execution owner and
its contact/completion adapters. This motion-only owner cannot be relabeled as
one of those repetitions. Autonomous prescription, appraisal, standardized
measurements and new physiological or ability calibration remain independently
accepted inputs until their producers are defined. UI/design, new arsenals and
unapproved design 32 are outside this change.

## Consolidated-review corrections

The batch review found that cross-family admission checked physical completion
and workload but omitted an applicable original learning application. An
interruption after the workload commit could therefore let the opposite family
reserve the unchanged learning revision. Both directions now authenticate the
original learning receipt before proceeding. Pitch applicability is decided by
the existing pitching owner against its pinned episode; no-episode or otherwise
inapplicable learning is not turned into a fabricated obligation.

The review also found that dry-swing commands could mix caller tick frequency
with the batting model's motor timing units. Admission and execution now require
both original observation and prediction calibration clocks, without rescaling
or default values.

One bounded affected selection passed four cases in 8.03 seconds: actual
settlement interruption, blocked cross-family admission, successful original
retry and subsequent completed repetition in each direction; the existing
stationary/no-learning crossing; and the positive dry swing plus mismatched-clock
rejection. The interruptions deliberately abort the learning INSERT after the
workload commit. No separate pre-fix author run, full compiler or long Native
gate was performed for this corrective delta. Consolidated review/verification
remains the integration owner's step.

## 統合後の結果

[統合バッチのreview・compiler・有限選択結果](2026-10-10-practice-capability-roster-batch.md#一括検証と修正範囲)を参照。author時点の途中結果は履歴として残し、最新の資格付けと区別する。
