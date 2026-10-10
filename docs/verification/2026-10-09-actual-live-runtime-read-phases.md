# Actual-live runtime immutable read phases

The runtime registration owner reconstructed the original physical pitch five
times during fresh acceptance. Its preflight derive/current pair and its
post-insert current/read pair had no enclosing physical read traversal, so the
existing paired pitch proof could not reuse their successful replay.

The owner now installs the existing `withBattedWorldPhysicalReadTraversal` around
each uninterrupted read group: public read/retry snapshots, the preflight
derive/current pair, the pre-insert current check, and the post-insert
current/read/admission/fence checks. Preflight uses a real SQLite snapshot.
The authority callback, write-transaction entry, INSERT and COMMIT remain outside
those groups. All original current-state, identity, metadata, archive, admission
and registration-fence checks still execute. No new cache is introduced.

`ActualLiveRuntimeReadPhase.test.ts` uses the existing original Native actor/pitch
fixture and passively delegates the real actor authentication. Before the change
it failed at five replay calls with absent frames. After the change it observes
three distinct frames for fresh registration, two fresh frames around an
independent retry callback, and a fresh frame for public read. A real INSERT
trigger corrupts the physical pitch archive; post-write verification rejects it
and rolls back both writes. Peer callback corruption is also rejected.

Author checks on Node 26.10.0, one worker, no result cache, external cache directory:

- New owner regression: 1 passed, 5.33 seconds including transforms.
- Existing runtime registration and transaction tests: 48 passed, 6.17 seconds.
- Protected 18 source blobs unchanged.

These replay counts establish phase-local reuse and preservation of the tested
boundaries. They do not establish a wall-time improvement for National runtime
registration. No full physical scenario or timing comparison was run for this
change; assembled compiler and review belong to the combined batch.

## Following bound-field operation

The field owner's nonlegacy `readPhase` already installs a binding read scope
around prepare, current checks and saved-output verification. It now composes
the same existing physical traversal inside that scope. Legacy routing and the
separate peer response callback, field/head writes, admission recording and fence
checks are unchanged.

`BattedFieldBindingReadPhase.test.ts` uses the existing explicit synthetic field
fixture with real Native owners. Before the change, all three binding derivations
lacked a surrounding physical frame. The corrected case passes with three
distinct frames and confirms every writer-side pitch replay belongs to its
corresponding phase. The real peer response reader runs outside the writer's
read phase. A real INSERT trigger corrupts the original pitch; verification
rejects it and rolls back pitch, field and head rows. Independent retry/read
preserve the accepted output. This one author case passed in 8.63 seconds
including transforms; it is not a performance comparison.
