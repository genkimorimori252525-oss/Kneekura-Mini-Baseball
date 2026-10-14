# Reserved PA terminal transition component

This component follows settlement checkpoint `06d88592b5e7b108bdfe99de8c46b6012b8a4773`, based on integration `e0c9c9dbfdb5c634884d4fb8f2ef6187cea1161c`. It completes the production connection from an independently authenticated terminal endpoint and ten settled normal workload activities to official Match/scoring, controller retirement, continuing activation or final result, and reservation release.

## Production contract

`openSqliteSamePlateAppearanceTerminalTransitionStore` accepts an explicit versioned Source. It contains exact endpoint and settlement references, official/scoring application IDs, the accepted game identity/policy, and rule-system retirement. The continuing arm requires an explicit next-start tick and complete world setup. The final arm requires a completion tick and accepts no activation/world setup.

The endpoint owner supplies the original actor, complete final work/TOTAL view, closed official ledger/context, physical completion tick, original ten-player controller commands and venue calibration. No caller snapshot supplies this authority. Fresh transition, post-write and committed proofs require current terminal coverage and exact projected workload heads. Historical reads retain original revisions after later Match or workload progression.

One private transaction uses the existing connection-bound official and scoring writers. Its four row changes are the Match update, official application insert, scoring insert and completed transition insert. A reached final-insert failure rolls back all earlier effects. Uncertain commit durability retires the owner without compensating repair. Open/read never install or upgrade storage.

The existing Core decides same-half, half-change and final boundaries. Half-change authenticates the explicitly selected incoming nine defenders, Persons and accepted workload revisions; missing baselines remain missing. Same-half preserves defender identities/positions. The final branch authenticates earlier scoring revisions only, appends the current score once, and creates no activation. No innings, score, workload or effort defaults are introduced.

The shared activation and historical-scoring fences now require the matching same-PA completed transition and reservation release when ordinary application bytes belong to a reserved root. Release archives an exact scoped claim census, including abandoned preparation. A later added, moved or modified claim cannot borrow an old release. The structural member archive stays below full release authentication, preserving the endpoint → settlement → transition → release dependency direction.

Settlement writes now request current endpoint coverage while reconstructing original reserved BEFORE revisions historically. Partial normal settlement still resumes without repeating committed activities.

## Focused author evidence

All runs used the existing finite 120-second supervisor profile: 512 MiB old space, measured 608 MiB heap limit, 1024 MiB RSS limit, admission at RSS plus 4096 MiB available memory, and a continuous 4096 MiB reserve. The reported successful runs exited zero, reaped every owned process and retained all four input groups unchanged.

| Cut | Result | Terminal SHA-256 |
| --- | --- | --- |
| Initial transition cases | 8 passed | `139a37d6205c02826c49636597b74b2d19c4851e843a044f2f74cc85d97999f1` |
| Positive half/final dispatch and metadata checks | 10 passed | `e876034180e41d80bcc17aa930bb5117011608d9dfcf2658eb68645e390180d3` |
| Transition plus settlement/release compatibility and claim census | 21 passed | `7afed5a6591712166b1e2c0054fe97862aa14d793953c8abce76dd2c2e965a50` |
| Added current-coverage case, initial controller expectation | Test: 1 passed, 21 skipped; controller failed on suite-count expectation | `da1d69d03a6de40079f19a0524efb511754a508bc966fc2aa2d2bdad9733d5c9` |
| Same source and single case with corrected suite accounting | 1 passed, 21 explicitly skipped | `f03c5e674de301e9d95e220ab00cdd5df3d3a3143690eb9eaf9b22c9e686bd07` |

The failed controller receipt remains failed. Vitest reports the skipped file as a passed suite while its cases are skipped; the initial controller expected a pending suite. The corrected tiny run had already started when the request to avoid bookkeeping-only repeats arrived. No further repeat was queued. A prepared 20-case configuration was never launched.

There are 22 distinct covered cases across these attributed cuts, not a final all-22 rerun. The final one-case source group was `cd8c8a75c3d2112bb497bd0b4a31e1f423ec1cd68dfd9d6f72a97430c62bf41a`; the 21-case group was `b43ce2a5bb47cfea246eb3f1e06e4c86c9993cbe76280cf21df4feea1465ddfd`. This note was added after code checks.

## Limits and integration dependencies

These are isolated structural Native fixtures. The endpoint/original actor proofs and transition-suite settled workload proof are explicitly mocked; Match/scoring writes, rollback, retry, schema checks and retirement archives are real. The settlement suite uses real normal workload activities. The final dispatch case substitutes an explicitly labeled complete historical line score under the unchanged nine-inning policy. It does not qualify a nine-inning physical game or a genuine final-history chain.

The same-PA component owns `SamePlateAppearanceTerminalEndpoint.ts`, `SamePlateAppearanceTerminalEndpointFromSqlite.ts`, `SamePlateAppearanceLifecycleOutcome.ts`, lifecycle claim collection and the shared terminal/lifecycle/physical storage declarations. These staged imports remain integration dependencies; they are not part of this component commit. The author alias exists only to substitute explicit structural mocks while those components are assembled. No standalone full compiler or genuine gate is claimed. Independent component review and the parent's consolidated compiler/integration verification remain required.

The qualified away-3 donor, its actual 18-player catalogs, nine-inning policy and every earlier failed/interrupted receipt remain unchanged. Genuine later input preparation stays with the consolidated plan; seven absent away-2 through away-8 workload baselines still require explicit accepted Sources.
