# Actual batted contact response — implementation brief

Authority: confirmed World-first task 3 in 2026-10-02-batted-world-contact.md; unchanged latest Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d and Realism4f0a60a3818926327b6bf5877ab3dec456a76530. User authorized all latest confirmed nonvisual implementation and normal stacked publication. This is an execution brief, not new game-design approval.

Base: PR245 /02216c9c0568129da9f8ff9c29c3f9a625f2eb36. Existing first-fielder territory does not imply catch, possession, OUT, play end or workload. Keep old original contact/flight archive replay unchanged.

## 1. Physical response

- RED tests for a ball's reflection/damping relative to a moving actual contact surface; no manufactured glove for body, hand, foot or venue surface. Reuse the same calculation for existing failed CatchRetention, preserving its supported semantics.
- Re-derive the actual earliest contact from full original World input. Derive the outward normal and collider motion at the continuous root before quantization; a high-speed ball may already have crossed the collider at the recorded tick. Do not infer geometry from sampled overlap or fractional absolute ticks.
- Body/foot/tag-hand and actual finite venue surfaces use independently explicit restitution/tangential/spin material data. Only an actual glove contact uses existing CatchRetention with explicit pocket geometry, pose stability and retention parameters. No success percentage, fake secure flag or production calibration defaults.
- Ground response reuses the already derived original ground state's BallFlight response. Airborne remains airborne. Same-tick multiple contacts stay unresolved with all facts; coincident centers cannot supply a normal. A retained result is only a capture candidate until subsequent World ownership proves the acquisition interval uninterrupted.
- RED/GREEN edge tests: moving body reflection; real glove retained/failed; wall face/edge/corner; crossed surface and huge absolute tick; malformed or incomplete profiles; simultaneous and degenerate contacts. Run existing collision/World/CatchRetention regressions.

## 2. Native original Source ownership

- Durable accepted response references own original first-fielder-touch Source plus independently accepted response model. No caller ball, contact, timeline, catch, territory or result.
- Response model is frozen per original game/fixture/venue/day and original Player/Person model roster, including unused registered actors. Complete five-role response profiles and every original venue surface; geometry/material/stability inputs remain explicit and finite. Glove radius/clock must match original physical execution.
- Own reader re-derives full original physical/touch/model Source and checks SQL mirrors, hashes and full snapshots; independent peer reads are comparisons, not evidence authority. Fresh execution requires current World and intact latest flight prefix/current actor-workload frame; original retry/history remains recoverable after legitimate later recovery.
- Before/after transaction, callbacks and identical retries re-read originals. Disk WAL tests inject late original/model/head/own-row changes and require rollback. Do not alter old archive meaning or accept caller physical result shortcuts.

## 3. Verification and continuation

- Fresh readonly whole-branch reviewer required by executing-plans; reproduce any Important finding RED before its fix. Relevant tests/typecheck, then one frozen whole gate with K: process-local TMP/TEMP and two workers. Normal commit/push/stacked PR; no merge/UI.
- Completed evidence: one Important finding reproduced in tracked body/wall tests and fixed using the original physical horizon; related6files59tests GREEN. Final local verify exit0: typecheck and572files3475tests GREEN,3928.81seconds (Source563/3450; unpublished scratch9/25), with all11 changed Source hashes unchanged and cached diff check GREEN.
- CI YAML patch is separately prepared and awaiting explicit human approval. Do not apply it without that answer.
- Subsequent actual ball continuation, uninterrupted acquisition, rolling pickup, transfer/throw/receiver/base/running, own foul replay and official/scoring/workload closure remain part of the same full user goal. This branch alone does not complete the goal.
