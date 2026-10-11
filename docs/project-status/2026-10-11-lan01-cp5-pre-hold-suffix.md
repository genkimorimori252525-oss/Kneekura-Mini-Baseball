# LAN01-R3: correct the original hold before its acceptance

The cp11 continuation ended FAILED at 2026-10-11 08:06:11 UTC after
9,045.463 seconds. Call 14, `acceptPhysicalPitch('lan01:occupied:second-pitch')`,
committed no change: the accepted second-TAKE posture expired before the actual
physical duration. No resource guard fired, all nine pins stayed stable and
all processes closed. This remains a functional failure, not a LAN01 PASS.

- Terminal: `268f81c2c4109734473d56533fbf3e9e3a2b402ad5f80a200602914c7ab44ea9`
- Vitest report: `dafebb63b30883923c875c5061378da2837909021841d73be360d94a88597ace`
- Suffix result: `17e3238470d84c8d99c42bd0ffeb6c5a3bd1fc9beb5af28aaaebf50ad5a4dd5d`
- Final cp12 database: `be7a59ea31c5c387fc744ea67d9ded79d7de803812eba59e099319638a0d3364`

The production guard is correct. The original occupied hold was issued at
68,602,725 and expired at 88,602,725. First TAKE completed at 80,056,482.
Existing Core timing and fatigue math place second release at 90,844,797 and
second completion at 91,694,321, exceeding the hold by 3,091,596 ticks.
A later checkpoint cannot extend that immutable command: the owner admits one
original hold per enrollment/player and forbids retroactive acceptance after
physical consumption. QUICK also retains the ten-second base start interval.

## Exact recovery boundary

The one retained entry now accepts only LAN01-R1 cp5, returned after the occupied
zero-TOTAL view and immediately before the hold. Its source identity is still
`4d452cea7ee37d41ca4f517612ffa96a7bb878d2`, tree
`3dcc76c69323fdd3461d4af7ec7f61bafe646e2a`.

- Receipt: `9b8d372485d6c60e95794e0b58f6a5bae03f7e003a030e2c4c56d877c7bf285d`
- Gzip, 545,780 bytes: `fac97a92b42c858860babd827d975a693e1754f6498686edbd15928a3d612e6f`
- SQLite, 8,327,168 bytes: `9476906a4cfc2728c6b968baf90763fdf0a1bae58595d409a345016cc813f177`
- Schema/row census, 108 tables and 761 rows: `7f63e56005dac76e6596ae4e5586159a4e5b7ca67784936396301f482853c95d`
- View snapshot: `d6d7cd1cc61228cc13e68cc50e2310f3dda0cc55dd02d6af7396a1717c33452b`
- Returned view: `9a9d103cf75c54a7580bd4bd8140614afa4cfeb5baed006a7566aef1b77bf10e`

The completed walk, settlement/release/transition, next actor and models,
baseline, enrollment, empty prefix, eleven zero TOTALs and view are preserved.
Their existing owners authenticate them and retained rows are compared after
the suffix. The runner-hold table and occupied dispatch/initial-Play/pitch rows
must be absent. The entry invokes the shared original tail directly before the
hold; it never reruns the walk or the five retained occupied writer calls.

The earlier successful occupied first TAKE, retry/readback, genesis and anchor
are preserved as evidence of the failed descendant run. They cannot be reused
as a corrected prefix because their identities include the insufficient hold.
R3 must execute those dependent actions again under the newly accepted command.
The result explicitly distinguishes that history, and always reports
`wholeCasePass: false`. No stage selector or alternate checkpoint is admitted.

## Coherent temporal correction

LAN explicitly declares a finite 60-second original runner hold, covering its
three planned pitch windows and subsequent field/appeal work. The single-TAKE
PL fixture retains its original 20-second input. No production owner, guard,
model, release formula, velocity or official result changes.

Before the hold writer, a bounded check reads the actual original timing,
release and response policy under a query-only transaction. Existing Core
workload math projects the fixture's cumulative effort 2 from its reserved
state for both later pitches; it does not accumulate that TOTAL twice. Existing
Core delivery and TAKE math then check both TAKE completions, third release,
motor window and the declared field/transfer/reception search horizons.
The check writes no accepted Source or execution result.

A second related issue was corrected in the swing helper: its fresh posture
was incorrectly capped by the preceding TAKE's posture interval. It now reads
the original runner hold in a query-only transaction and caps its own new
20-second interval by that hold. Under the exact accepted inputs:

- first TAKE release/completion: 79,313,148 / 80,056,482
- second TAKE release/completion: 90,844,797 / 91,694,321
- third release and motor deadline: 102,464,647 / 103,464,647
- third posture deadline: 111,694,321
- declared trajectory/field/transfer/reception search horizon: 106,064,957
- original runner hold deadline: 128,602,725

The old second posture deadline, 100,056,482 even under the longer hold, would
still expire before third release. The new pitch's independent posture fixes
that declaration without widening a previously accepted posture.
Actual swing contact, capture, throw, appeal, closure and scoring still require
the remaining Native run. Timing consistency alone does not prove their results.
The audit found their finite search/coverage inputs come from the current
posture/actor curves; journal and official acceptance use reached ticks rather
than adding another pitch cadence. All original twenty callback assertions are
byte-identical, including the original swing velocity and throw/appeal inputs.

## Bounded verification

A Core-only regression first reproduced the failure exactly:
91,694,321 was outside the original 88,602,725 hold. Tests cover the corrected
three-pitch declaration, rejection of the old hold, rejection of a hold ending
before the declared field search, and the stale preceding-posture error. A seam
test stops at the first hold writer, verifies the whole-recipe check happens
first, and makes any retained prefix writer an error.

The prior LAN body hash assertion was already stale on the incoming branch:
reviewed PL commit `32d744b9` extracted two original readback assertions into
`finishSamePaOccupiedPitchReadback`. The current shared post-right body is
3,906 bytes, SHA-256 `c690551b62745929558c15efa9a3c904b3c9bee5e5ad70d046fb7b8a6dac2049`,
with thirteen direct assertions and the same two readback assertions in the
shared helper. This batch preserves that exact body and updates its test's
provenance. Completed PL Native work is not rerun.

The exact cp5 materializer passed on an exclusive private destination. An
immutable cp5 copy also supplied the accepted inputs for the Core-only timing
figures above; no original or running database was opened.

No Native long gate or full compiler is run during this authoring step.
Consolidated compiler/review and genuine R3 execution remain separate evidence.

Author's final selected run passed all 20 tests across six files, with no failure
or skipped case. It covers timing, both retained seams, exact input/callback/body
checks, query-only scope restoration including the new swing read, and the
existing in-flight timing regression. Report SHA-256:
`141bc98acfb8d733bb25ec73e7846a93c679c48b081f492e42ebae39f1faa6b6`.
This is bounded fixture/input evidence, not a Native physical or official pass.
## Integrated qualification

The first central compiler run on `4685465e`, source tree `7905bb87`, failed
in 32.712 seconds because the timing helper spread an activity union without
narrowing it to MATCH. That failure remains preserved; no finite run followed.
An explicit MATCH check now precedes the read/projection. It changes no accepted
MATCH calculation and does not invent a replacement activity.

Independent review of the complete fifteen-file batch and the final MATCH
narrowing is CLEAR: exact cp5 provenance, retained prefix conservation, declared
timing sufficiency, original assertions/order and cleanup were checked.

On corrected integrated code `8fc56b545eb9da5551d0caeb614dd81f9e9e262d`, source
subtree `f1543cc585cc2181c40e39a17bb4731f49268f2d`, the full compiler passed in
34.407 seconds. The combined run passed all 20 selected tests in six files in
8.470 seconds, zero skipped. All source/dependency/runtime/control pins remained
stable; no guard or surviving process remained. Formal report SHA-256:
`f192f39e68ef120662a4d549103ef9c5689dc934a3f1148394cabd4527e42aa5`.

The genuine corrected cp5 continuation remains unexecuted at this checkpoint.
