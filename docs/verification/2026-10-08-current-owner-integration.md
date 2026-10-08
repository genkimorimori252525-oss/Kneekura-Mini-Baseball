# Current nonvisual owner integration

The reviewed current owner slices compile together, and 93 directly affected
admission, reservation, workload and terminal boundary cases pass on source
`b0439c7a3f7c8b0bec32862ba38bdf3c5b38bdff`, src tree
`2e16aa4f5d683d5ccbb2ee245e240178b27bbc0a`.
This is a bounded integration checkpoint, not a full-project suite or a new
genuine end-to-end artifact qualification.

## Integrated source

- PR368 current actor/TAKE test and readback source: local `909e97a91836df4723fc2ab316aa170f5fe7a903`, remote `b0b2dbdb937df1d3cddfa546adae4e0178ceab5b`.
- PR370 received enrollment, policy and replan owners plus genuine staged harness: local `a507475ff30212be17120a32ce6a496986703e6f`, remote `50070283dad2aef42f13c038bcdc042dbee9aa6b`.
- PR371 actual-live frame setup routing: local `67ba89681f6967d7af518939c21cee41791d790f`, remote `a9fe8a17f2abbffe1240a492ede798598428f78d`.
- PR372 half-change/final completion owners: local `f6808c51bb67dcfee76e921afb8af559a1fe26f3`, remote `06e7a8c949e71154ac944722f30475e829b1cc54`.
- PR373 prospective same-PA reservations: runtime/test source `93facd563d7afdef3ba6f3065477628ff78405f9`, remote `0eabca0d221b6e269acfabecfdb71824b06e1dc5`.

The shared live-admission conflict retains both guards. Same-PA reservation
exclusion applies to every route, including received extension open-state
qualification. The received-claim guard remains conditional on ordinary legacy
ingress so the explicit received extension can progress its own journal.
Neither guard grants physical execution or a new owner capability.

Independent source review found no additional integration blocker. Twelve new
Native raw-exclusion cases check absent, received, reserved and combined claims
for both routes, disjoint reservations, and reservations introduced after ordinary
admission or registration entry. These metadata fixtures do not substitute for
authenticated enrollment or original physical evidence. All 18 protected stance
and runner paths retain their original blob identities.

## Exact bounded verification

Full-root TypeScript compilation passed with no diagnostics and one reaped child.
The fixed compiler limits were 1664 MiB old space, 1760 MiB measured heap,
2304 MiB process RSS, 180 seconds and a 4096 MiB available-memory reserve.
Its terminal SHA-256 is
`88184af91284e637c1a106b964648b13678262fb7ef590d380d217bc54c47074`.

The following eight-file inventory passed 93/93 with no skips:

| Test file | Cases |
| --- | ---: |
| ActualLivePlayFenceComposition.test.ts | 12 |
| ActualLivePlayFence.test.ts | 12 |
| ActualReceivedUmpireDefenderIngress.test.ts | 4 |
| SamePlateAppearanceReservationGuard.test.ts | 24 |
| ActualRoleWorkloadChargeGuard.test.ts | 33 |
| ActualFoulTerminalBoundaryDispatch.test.ts | 3 |
| ActualFoulTerminalBoundaryReadiness.test.ts | 3 |
| FoulTerminalNextPlayReadiness.test.ts | 2 |

Both owned test processes exited zero and were reaped. Source, dependency,
control and runtime groups remained unchanged. The test limits were
1024/1120/2048 MiB, one worker, 240 seconds and the same reserve. Its terminal
SHA-256 is `c00d683c3d1a7c4ed5562d705c2961d6ec1e4cd4e7979b2cb9592bd09d19919c`.

An initial compiler exhausted the smaller 1408 MiB heap; it remains failed with
zero credit. An initial test run observed 93 passing cases but its controller
failed on missing suite-count configuration; it also retains zero aggregate
credit. The corrected fresh gate above provides the completed test result.

## Boundaries still open

Earlier genuine actor/TAKE, enrollment, geometry and workload results retain
their original source attribution. They were not rerun or transferred to this
combined source. The genuine received null-policy stage stopped at its fixed
600-second cap before any replan committed; its accepted enrollment is intact.
Prospective same-PA reservation still needs the actual new batter baseline before
genuine enrollment, followed by cumulative execution, ordinary-foul resume and
release. Changed-participant episode binding, terminal-origin geometry, genuine
third-out/final histories and broader existing plan work remain separate.

Private databases, logs, controls and manifests are excluded from this source,
test and documentation checkpoint. No home-PC CI was invoked.
