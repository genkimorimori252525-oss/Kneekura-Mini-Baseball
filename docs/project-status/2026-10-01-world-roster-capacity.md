# Native world roster capacity — 2026-10-01

## Approved scope

Approved foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, document 32 and the existing global roster/intake/Person/national/contract contracts. Visual design and merges are excluded. Population counts, exact profiles, legal facts and prior distributions below are explicit test inputs, not production League calibration or imported real-player abilities.

## Measured failure and implementation

The actual 234-Club catalog with 50 Players per Club produces a 11,700-Player global roster containing 212,668 inert nodes. The complete Club creation request, including all Player state references, contains 51,020 nodes and fits the existing creation budget. Native roster persistence failed under its former 100,000-node evidence guard. Follow-up gates reproduced the same failure in national snapshot capture, Player intake, Player-Person link reads, national callup serialization, Person genesis and free-agent contract application before modifying each affected path.

`RosterEvidenceJson` retains 100,000 nodes for ordinary evidence and depth64 for all inputs. Only complete inert, Core-validated `RosterState` subtrees receive a separate 1,000,000-node budget; a composite has an absolute 4,000,000-node cap. These are transport limits, not roster quotas. Fake roster shapes, unknown fields discarded by the Core schema, accessors, sparse arrays, symbols, cycles, nonfinite values and unsupported prototypes are rejected. The generic `OfficialWindowPolicy.cloneInert` remains unchanged.

Affected Native owners use this bounded roster transport for full-roster content. Small intake facts and Person policies retain their existing guard. Existing canonical JSON bytes/order, saved DTO shapes, snapshot hashes, identity checks, accepted Source readers, shared Career head and CAS semantics are preserved.

## Verification evidence

- Actual Native catalog and atomic creation persist all 234 Clubs with all initial Player references. The global roster contains 11,700 Players, 21 explicit League profiles, and FIRST_TEAM/RESERVE assignments. First and last Club readers consume the same single Career head.
- An accepted existing Player-Person link, explicit Native Nation/legal facts and accepted WBC selection permit a real national registration using the full historical global snapshot. Later intake advances the head to 11,701 Players without changing existing assignments or the registration's pinned snapshot.
- Native Person genesis materializes the new accepted Person using a pinned Career seed and explicit synthetic policies. No Club target rank creates Player ability.
- A real Native Manager opportunity/execution advances the shared roster to revision2 and the decision World revision to1. Other Players remain unchanged. Reopened readers replay the execution and old national snapshots; corrupt historical snapshots invalidate both snapshot and callup reads.
- A separate 11,700-Player free-agent gate applies one accepted contract, retains all other Players and replays after reopening. Its unassigned population is a scale fixture.
- Focused affected owners: 9 files / 37 tests passed; typecheck passed. The subsequently strengthened codec gate passed all 4 tests, including composite-budget rejection. Temporary node-count logging was removed before the final gate.

One fresh independent read-only review completed with no findings. Final `npm run verify` passed catalog generation, typecheck and all 521 files / 3,113 tests in 655.04s. The actual registered regional Match gate took 650.364s; roster validation adds work when historical callup evidence is repeatedly replayed. No test timeout or game result was changed to obtain this result.

## Remaining scope

The verified population scale is an explicit fixture, not a calibrated new-Career population generator. Numeric League profiles, initial historical content and independent intake authority remain explicit inputs. Broader population/facility initialization, career-clock orchestration and physical/runtime integration are part of the continuing approved nonvisual audit. The overall goal remains active.
