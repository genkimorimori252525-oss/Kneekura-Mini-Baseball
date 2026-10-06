# Native batting model: current integration qualification

Recorded 2026-10-06 08:02 UTC. The current integrated Source passed full TypeScript compilation and all **162 selected cases**, with zero failed, pending or todo cases. This is focused qualification; the whole suite and non-design plan remain incomplete.

The model owner binds an accepted original Person/body/pose to six explicit batting parameter Sources, preserves immutable archives and historical read/retry, selects applicable accepted history and rejects conflicting ownership. It generates no calibration, stance, perception or swing by itself.

## Exact current evidence

- Tested commit: `7a067cce318867719022a61abf50a99e2414d36b`
- Tested full tree: `0be0a3a5f74f95019ee7c86c9b3ad2b5de2afa32`
- Source tree: `5c1efd4419364781af02b8565e8dd9e558c80b50`
- [Complete raw terminal and exact stage/case inventory](2026-10-06-current-native-batting-model/terminal.json): SHA-256 `e32913fef0ccda029e2c6ca672abf26c983aa6ce7868f235471b60b25ed49166`
- Reviewed controller/configuration: `7935f2669909a4d50991c9573252649f002d3f23a3c1a25da344f02515a8090a` / `3a6c042979a15b9f80b88a13a8d4eaaa2192181c85bc87ddd4c22507e1c21229`

The five stages are compiler, preservation 14, model 30 plus four reviewed ownership regressions, related body 64 plus Person-link 3, and partial-runner Core 47. Every selected case was rerun on this integration. The terminal records exact file/name inventories, actual runtime/heap, finite resource bounds, unchanged Source/dependencies/controls and complete process reaping. Session 66864 ended with exit0 at 07:57:08 UTC. Subsequent publication documentation preserves this source tree.

The integration retains all 13 changed PR334 paths byte-for-byte and adds the exact 16 model/contract paths from author 24ee242; the path sets do not overlap. [Author qualification](../project-status/2026-10-06-native-batting-model-author-qualification.md) is a separate 115-case result at src `b86826778ead4e60ca33efd7899bef1d8e58a916`, terminal `301ee80be799defe60057e6feb55f4466c529459d7b7b591f1bce12b9a9d281b`. Those historical counts were not substituted for this rerun.

## Regression and remaining boundaries

The original real-body prerequisite and missing-model RED were observed on recovered ce9b7e88. Four further regressions demonstrate nested body/pose ownership, moved same-day SQL identity with fresh parameter IDs, and explicit invalid viscosity without a coefficient profile. Their first wrapper attempt failed because Vitest serializes assertion values as strings; that failed terminal `84760447e02a180f000527ebbc71818e6d680352df5a1113eca0ba03c2aedafc` remains failed. A separately reviewed exact string classifier observed all four intended RED assertions at 5ade13b8, terminal `e7b4e0827530450dc127080e9b00407f2560e3ec8e4ef873a479ed8608a433e2`. All four cases passed in the current 162 run.

The current gate holds all 23 stance cases. A separate single missing-stance RED was later observed on author docs-only 9952dfb after genuine body/model acceptance (terminal `532d84f87eba2639094f64670fe887c6159cbb20b13d29af62542fbc13bee2ab`, one selected and 22 held). That establishes the next missing owner, not stance GREEN, and is not a current integration result. General batting sensing/decision/motor, runner Native semantics/settlement, current cumulative coverage and the remaining confirmed non-design scope are still pending.

This checkpoint contains code, synthetic test metadata and result documentation. It includes no database or private domain payload. The earlier environment-loss accounting remains in the [remaining-plan matrix](../project-status/2026-10-05-nonvisual-remaining-matrix.md).
