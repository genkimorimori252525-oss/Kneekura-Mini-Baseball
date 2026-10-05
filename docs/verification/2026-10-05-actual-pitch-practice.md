# Actual pitching practice verification

One durable practice owner now consumes the existing Player delivery phases,
freezes original body/release/timing/workload inputs, and adopts an independently
accepted completion-bound effort/health assessment through the existing PRACTICE
workload owner. An eligible existing development episode receives the original
practice event exactly once. No Match is fabricated for standalone practice.

The accepted opportunity, local Player/day clock, previous attempt, physical
inputs and numerical policies remain explicit. A second opportunity cannot evade
unfinished Player ownership or unsettled workload. Retry/reopen keeps original
history, and the downstream workload/episode guards authenticate on their own
transaction connections. Raw timing is not a standardized capability measurement
and this change does not automatically generate feedback or ability gains.

## Integrated acceptance

The fixed source `6e6919f5f45dc8da9ee6261de3e65c68d77a69dd` passed:

- 5 files / **55 tests**, zero skips, exit 0, in 15.759 seconds
- Full TypeScript compiler, exit 0, in 27.757 seconds
- Catalog consistency check

The 55 cases comprise the 49 real practice/storage cases, the existing durable
initiation, roster episode and accepted-appraisal controls, and three Core
episode cases. They cover consumed phase chronology, current admission versus
historical replay, workload/learning interruption, aliases, cross-opportunity
ownership, prior-clock corruption, same-connection source mutation rollback and
bounded earlier-evidence replay. The canonical roster fix from PR306 is included
as a prerequisite and preserves array/value checks while accepting object key
order changes caused by canonical persistence.

The exact complete `src` tree is
`58540a7188fe74e4d423a89bcb2241fb4933e68d`. Published code and tests use that
same tree. Later verification-tool and documentation additions account for other
tree differences; they are not represented as another full regression run.

Node 26.10.0 used actual 480 MiB test heaps and 1,504 MiB compiler heap. Peak
aggregate RSS was 355,300 KiB for tests and 1,381,976 KiB for the compiler. No
resource guard fired. Every owned process was reaped, and all source, control and
runtime hashes were unchanged.

Source manifest SHA-256:
`40a9146df1102e2b2db4b3af1cb15babf48663dcedf072b8b6d6addf5502b588`.
Terminal receipt SHA-256:
`e8cbae04e74c4dad379d3c1b9816e7201d2cb6938c2e0139d1ad7fa8fc3939da`.

## Prior review evidence and remaining scope

The original absent-owner tests and subsequent review regressions were preserved.
Review exposed consumer-local input mutation, a learning receipt alias and
repeated earlier-proof recursion. The repair passed all 49 author-source cases
and its compiler before the integrated acceptance above; those are separate
source-qualified results, not additive test totals.

The next adapter from actual original practice and prospective NORMAL/QUICK
probes into explicitly accepted standardized measurement and existing timing
learning is still under implementation. Shared Match/practice scheduling,
general-role practice, autonomous opportunity generation and full Career
execution are not established by this bounded owner. Latest cumulative whole
verification remains PR277; a later integrated cumulative run is still required.
