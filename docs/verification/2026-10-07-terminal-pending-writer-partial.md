# Terminal pending writer: bounded partial verification

The shared non-live pending writer, strict pending Match decoding and raw next-play rejection are implemented. They do not yet consume the genuine terminal queue: the application runner remains absent. No terminal acknowledgement, scoring/workload settlement, reset or next-play activation is claimed.

## Exact tested source

All final stages below ran against commit `cbab491a1dc4114dc6bfad51980faed6c6ad0976`, src tree `8d0d341213f0443f04e87ad8a298172cfd61db16`. This result note is a later documentation-only change. No remote publication, merge, workflow or deployment was performed.

- Focused compiler passed: terminal SHA-256 `caa9663bb898f9ab099b8061d6f36e6dace376563832ee39669e863ef206141a`
- Pending writer: 20 passed, five missing-runner cases explicitly excluded with zero credit: `34e56a127e64a4eabe88d16270ccf60aeeb90c120ea731c0cf6edce8a754de8d`
- Raw metadata and historical guards: 11 passed: `f842cc66349a5d4233cdbc5c4d9f4150b96ddeb498076225033887c36d3e38ad`
- Existing shared-writer parity: 24 passed: `9f2940404f4ec00daaca6ddb92929f71319446e2390b8de78880ac87b907a585`
- Existing official-store/actual-live compatibility: 17 passed: `4b186304c3dfab7c3aa2242e5dd1e432d3e2eb44548d8e909e1823501777d29f`

This is 72 unique selected passing cases across four fresh bounded stages, not the full project suite or a genuine terminal application pass. Every final stage observed child/controller exit zero, unchanged source/dependency/control/runtime inputs, and no surviving owned processes. The compiler had no project execution and enforced child0. The LIGHT test lane used private locks, one worker, 512 MiB old space, measured 608 MiB heap limit, 768 MiB aggregate RSS and 180-second outer caps. Shared Native coordination controls were not altered.

## Review repair and failed attempts

Review found that a game-only pending guard incorrectly blocked an earlier plate appearance's historical activation. Two targeted regression routes failed for the intended pending error, followed by a minimal original-previous-play scope repair. Direct application-ID mirrors still reject independently, and a same-PA damaged-ID control still blocks. No nextMatchState play number is used as original-play authority.

The initial writer GREEN controller rejected five exclusion labels (`pending` versus actual `skipped`); the first historical RED controller rejected a full-message needle truncated by Vitest JSON. Both failed controller stages retain zero qualification credit. Fresh corrected stages preserved the failed records; the historical cause was additionally checked against the full console Received message. The first focused compiler found three test-only imported-type/constructor name collisions; the exact type aliases were corrected before the final compiler and all 72 selected tests were rerun.

## Remaining gate

The genuine queued-bunt, old-process exit/private v3 cutover and rollback tests are explicit `.acceptance.ts` cases. They require their pinned opt-in configuration and controller provenance, so ordinary `npm test` cannot accidentally spawn their heavy producer. They have not run at this checkpoint. The five missing-runner unit cases remain unfinished; no whole-suite completion claim is made. Original-source rederivation, three-row application, close/reopen and real-writer rollback must be qualified before the functional terminal application slice can be called complete. A second genuine terminal origin remains a separate gate.
