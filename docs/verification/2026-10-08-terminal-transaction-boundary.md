# Terminal transaction boundary repair

This is a non-design transaction-mechanics repair layered over acknowledgement test source `cf5f83fb2c454cba431dbbffb22e44a238ef6001`. It changes neither the receipt wire nor gameplay authority.

## Observed defect and narrow repair

A real SQLite read could return success after a COMMIT call was suppressed, replaced by COMMIT followed by BEGIN, or followed by a query-only setting change. A BEGIN call that executed and then threw escaped the operation's cleanup block with a transaction still open. The queue constructor also accepted the three COMMIT anomalies.

The runner and queue now include BEGIN in cleanup protection, verify acquisition before doing work, and verify idle/restored state after COMMIT. A BEGIN failure before execution still leaves an idle, usable handle. An unproved transaction boundary retires the handle after cleanup. Constructor commit checks occur before an owner is returned. The corresponding queue writer uses the same guards; the lightweight controls directly exercise public reads and constructors, not a fabricated successful queue write.

## Exact bounded evidence

The regression fixtures create empty exact schemas on private temporary files. They exercise real native SQLite and the real public openers without mocking owner evidence or manufacturing a genuine terminal application.

- Exact RED: 11 intended assertion failures and six passing controls. Supervisor terminal SHA-256 `e21419e9a0114e2b641458d9e65469518acb8f2bad404dd40886093ae89a5770`; report `2bf9163f4846b5df361c78bb7f9be387d69ad6772abe8eabe8dd928ee15e376c`.
- Final focused LIGHT: 80 passed, zero failed or skipped, across five files. This comprises 20 transaction-boundary controls and the unchanged 60 acknowledgement storage/metadata/public-fence controls. Terminal `acfffebf6f92bccce62378604f07c2115e2af58b50127fef7bceb9b5a83424be`; report `9392e2552bf20bfdacf290bcd30be27e907a087dd67b6e05ca2bb6e2b1363648`.
- Full acknowledgement-focused TypeScript project, including the new boundary tests: exit 0. Terminal `995176e3124fd579861792aae236d8f3bca5fbabb59b95e93ce866e8dfafb350`.

Each completed stage kept all source/dependency/control/runtime pins unchanged, used one worker or child-free compiler, 512 MiB old space, measured 608 MiB V8 heap, 768 MiB aggregate RSS, and a 180-second external wall cap. No owned process remained. Dedicated private LIGHT locks permitted these mechanics checks alongside a separate frozen Native qualification stream.

The first controller attempt was rejected before child launch because its LIGHT project option was invalid. The first collected RED controller expected two additional failures, but suppressed BEGIN was already rejected by later savepoint guards; its six-pass/11-fail report was retained without claiming an exact-controller pass. An initial focused compiler found one unused test callback parameter, corrected before the final compiler pass. These are not additional GREEN credit.

## Limits

The ongoing retained-artifact Native controls at `cf5f83f` retain that older source attribution and do not automatically qualify this repair. A genuine post-repair acknowledgement success/retry/reopen pass and relevant transaction-fault regression remain separate gates. A second independently genuine terminal origin is still missing. This record does not claim whole-project tests, a second origin, external monotonic history, UI work, new-pitch permission, home-PC CI, merge, or deployment.

Private databases, detailed logs, and runtime/control artifacts are not repository deliverables.

## Post-repair genuine regression

At commit `2cecbce67b381f23e51e571e51cdffa5961aa15a`, source tree `37e82fbb5f42934d68d454142bb480135b21e84c`, the separately pinned candidate Native lane passed:

- A01 actual terminal application and one-write acknowledgement, independent original E/C and official mirrors, exact retry routes, close/reopen authentication, unchanged original evidence, and both closed next-admission fences. Terminal `7c57c7734ab196fd0c9ad974c47cbef5326e9483bb93c176f7314081a75858d5`; report `4537fb063f9452efc4c378b6af49de6c0e24fd09d45be44142d8086816a1677e`.
- A18 fresh post-BEGIN evidence after a peer commit, A19 transaction replacement/handle retirement, and A20 primary-error preservation plus retirement after rollback cleanup failure. Three selected controls passed; ten unselected controls in that file received no credit. Terminal `6f663edf96e793e0eddd6554287d80ef5b1b29827f9f179281eb53f56df9a8d0`; report `2775b9dbd174cb9e261afb483b684f8cf6dcd2d8c1562b93da23c1814e010d3e`.

Both stages used explicitly pinned retained originals, fresh exclusive private copies, one worker, 1024 MiB old space, measured 1120 MiB V8 heap, 2048 MiB aggregate RSS, and a 2520-second external cap. All four input groups remained byte-identical, with no controller/runtime error or remaining owned process. The candidate did not regenerate physical prerequisites.

This closes the specific post-repair genuine gates named above. Other retained-artifact fault/wire/schema results still keep their original source attribution. Independent final review and the second-origin limitation remain distinct from these observed passes.

## Combined private-observer fixture repair

Commit `394ea995f58a689557f2c86d8c1436d1849945a8`, source tree `7da2a836b67a4c5e71ed93791a38960603f543f3`, adds the separately qualified test-only FK fault-injector repair to the reviewed production boundary repair. Both test files remain included in the focused compiler project. Production files are unchanged from `2cecbce`.

The defect was in private test setup/restoration: foreign-key enforcement blocked intentional deletion and delete/reinsert restoration of a referenced Match. A focused real-SQLite restoration RED was observed before repair. The helper now temporarily disables FK enforcement only on the private observer outside transactions, restores exact saved rowid/bytes, and restores/verifies the original FK setting before a production route can run. Production connection policy is unchanged.

On the exact combined source, 82 LIGHT controls passed with no failures or skips across six files, and the full acknowledgement-focused compiler exited 0. LIGHT terminal `a874b283296d49536262502d2974d22d674385354523a70655fb25eeb33a0096`, report `056ef00423cda308a62a6f5bcdea072ac28a5afe421e3b0b928709b24433686a`; compiler terminal `8dab292be49ce97b606d528d1c83670e671b8d2d9301f3a116d32bd14aec7a3d`. Both retained unchanged input pins and completely reaped owned processes under the 512/608/768 MiB, 180-second LIGHT envelope.

Genuine A01/A18–A20 evidence above retains its earlier source attribution. The retained-integrity inventory separately distinguishes its original 45-case cohort from the final 16-case test-helper-repair cohort; no full 61-case or whole-project pass is inferred for this combined source.
