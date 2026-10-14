# Reserved PA terminal settlement and release component

This component starts from integration commit `e0c9c9dbfdb5c634884d4fb8f2ef6187cea1161c`. It closes the reserved-family workload/release gap; the existing foul-terminal ten-role workload and half/final owners are not rewritten.

`openSqliteSamePlateAppearanceTerminalSettlementStore` consumes a reference-only accepted Source naming the new terminal endpoint owner. `freeze` authenticates the final complete coverage and ten TOTAL projections against the original reserved participants. `settle` applies each exact final-view activity through the existing connection-bound Player workload writer and its CAS, from reserved BEFORE to projected AFTER. An interrupted partial settlement retains all reservation fences; retry authenticates and skips the already applied effects.

The dependency order is terminal endpoint, settlement, completed Match transition, then release. The settlement reader never descends into transition/release. Release requires the independently authenticated completed transition and all ten exact durable effects. It archives the original ten member rows and retires exactly those ten active leases in one transaction. The immutable enrollment and closed-PA causal claims remain. A separately named historical enrollment reader authenticates original actor, Person, baseline Source and reserved revisions; a later distinct PA can acquire new active leases. Ordinary global workload remains blocked until the release proof succeeds.

Release/settlement namespaces reject malformed partial installations, aliases, extra schema objects and temp shadows. Opening and reading install nothing. Uncertain commit durability retires the private owner without compensating repair. No workload/calibration defaults, game policy, player selection or physical outcome is generated.

## Component dependency

The separate same-PA component owns `SamePlateAppearanceTerminalEndpoint.ts`, its real Native endpoint/transition readers, and the lifecycle/physical/terminal namespace collector. The agreed terminal Source is `SamePaReference<'pa_terminal_v1_endpoints'>`; its final view belongs to `pa_lifecycle_v1_execution_views`. The transition consumes only `readSamePaTerminalSettlementFromSqlite`, whose result is `applying` or `settled`; release is authenticated separately. These shared dependency paths are intentionally excluded from this component commit.

## Bounded author evidence

The structural Native tests mock original actor and physical/official terminal proof. They exercise real workload histories, ten normal activity writes, CAS, private transactions, active reservations and release archives. They do not establish a genuine terminal physical result.

- Nine cases passed on the complete settlement/release implementation cut: terminal SHA-256 `51db8d185a35a9358a8a4af8f50e661d26c6c27aa9d438c98d8cc0073c40f53e`; source group `289c24628a4b809589d33f78af245b9d0ab2e3e605c40f7ee91bee18b3b48d6a`. Coverage includes partial settlement retry, rollback after reaching the fourth real lease DELETE, release retry/reopen, unchanged historical enrollment, later normal workload, distinct next-PA enrollment, raw duplicate release rejection, and partial-schema refusal.
- A final added baseline-Source integrity check passed separately, with the preceding nine cases deliberately skipped: terminal `f902238725bb5f02556209ef6394f5b54e94ff7e7f99434dfc2cb25c1d0888b5`; source group `5cb1ceb07ba56e8f086b5bfe98553af11d4a7406f799cfbc546a0ecac1bb46ac`. It rejects changing an opaque historical baseline Source version even when workload values remain identical.
- Both runs exited zero, were fully reaped with no survivors, and preserved all four input groups. Each used the bounded 120-second author profile: 512 MiB old space, measured 608 MiB heap limit, 1024 MiB RSS, RSS plus 4096 MiB prelaunch admission and continuous 4096 MiB reserve.

The author-only module alias supplies throwing endpoint exports that tests explicitly mock while the other component is developed. It is not a production fallback or accepted input. Consolidated type checking, real endpoint/transition composition and representative genuine integration remain pending. No A1 database, physical pitch or nine-inning fixture was replayed or generated here.
