# Actual-live readiness within one episode-binding snapshot

The bounded field diagnostic reached the correct 2 ms Core interval and
returned that derivation in milliseconds. Repeated prior-closure authentication
dominated binding reads and the unresolved first pre-write current check. See
the [closed diagnostic observations](2026-10-08-episode-field-diagnostic-result.md).

The repeated paths are `binding.derive -> response -> physical activation` and
`binding.derive -> battedWorldFrameBaseCenters`, followed by the same paths in
`binding.current -> flight/open-frame`, `response.current` and `derive`.

The correction gives each existing binding snapshot a separate private
readiness scope. It requires a real Native connection, an active query-only
transaction, main-only storage and no temp table/view authority. Its private
savepoint and total-changes/schema/database-list checks protect the full
synchronous lifetime. The caller's enclosing transaction and query-only setting
remain owned by the existing binding snapshot.

Only the readiness reader can add a value, after its ordinary physical
traversal and cleanup complete. It retains only complete frozen `ready`
results, keyed by exact closure Source and current-versus-historical mode.
Pending and game-final results remain fresh reads. There is no evidence setter,
caller-supplied proof, shared mutable context or global result cache.

Every separate or nested scope begins empty. Children do not promote values
to their parent. The map ends with the snapshot; pre-write, post-write, retry,
commit/readback and the next operation each reauthenticate. A bare Native
transaction or physical traversal alone does not enable reuse. Existing raw
ownership audits, current-head checks, binding hashes and write fences remain.

The private savepoint is necessary: counters alone cannot distinguish a
rollback followed by a new transaction. If the original savepoint no longer
exists, the whole scope fails before its result can escape. A fresh nested
scope after such replacement still authenticates from empty state.

The finite counterexample uses the existing Native activation/read-pair
fixture. Closure ownership, official archives, ten MATCH effects, settlement
authentication and readiness remain real. Five deeper physical/kinematics
seams are explicitly synthetic; this does not qualify a retained game artifact.
Two readiness reads returned identical frozen bytes and preserved all archives,
but authenticated the closure twice. The intended `2 -> 1` assertion failed,
with zero passing credit. RED source: `982447b0edd6ad9e228e9ff78312092bfa2a0246`;
terminal: `50a255a910fce27a43307d8e23a480df1da42eb821018299bd5e2667cafdc616`.

Finite regression coverage includes Source/mode separation, independent and
nested scopes/connections, peer WAL changes, ordinary/restored-byte mutations,
TEMP/attached authority, transaction replacement, failed cleanup, pending/final
behavior and normal binding snapshot entry/restoration. Existing activation,
readiness and v1 binding tests provide compatibility coverage. Source tests and
the full compiler must qualify before any retained-input field retry.

The change selects no new policy, calibration, model, clock, command or horizon.
It adds no terminal-origin route. Original F01 and the bounded diagnostic remain
failed attempts with zero field credit and unknown original close success.

## Qualified correction

Runtime/test source `b6fa423120d779c0f65921c1ff4f9f86ccd30c9a`, src `a4696d7f59aa10190067ef3ecca8bd528bef4e33`, passed 19 new scope cases, 38 existing readiness/activation cases and 3 selected legacy consumers. Fourteen literal legacy skips receive no new credit. The full compiler passed separately; all four stages had exit 0, unchanged source/dependency/control/runtime groups and no surviving owned process. The production delta is the readiness reader and one binding-snapshot call; 2,649 original files remain unchanged.

Terminals: scope `2b72cea81bdddcd98bf2c7a4bae4f9f02e53398acb7bbb7191e65dce91ea7943`; compatibility `5ca1df7bd9299c7c17c9127ee26c8cdf852702064906deaf7cedefdde51b3f13`; legacy `55a3e5873b90c744f567300441dd045d554399cf1ed7ce154ccddf7ee994ae69`; compiler `5a7e301fa102eced4d77ef2114a5dea033f31570d38de5724deb0f666b5bfb8a`. The separately pinned genuine field reattempt remains unqualified at this checkpoint.
