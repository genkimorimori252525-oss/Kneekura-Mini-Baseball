# Owned initial defender locomotion receipt

Scope: the approved perceived-individual-decision to bounded actual-motor dependency map, sections 3–4 and 10. This additive capability owns one command receipt per physical pitch and Player. It does not execute actors, acquire custody, settle a play, advance a route, or replan.

## Implementation/check plan

- [x] Isolate the worktree and integrate exact original decision, self-kinematics, locomotion-model and ownership-metadata dependencies
- [x] RED: new same-connection Native owner is absent
- [x] GREEN: derive one first-waypoint Core integration segment or null-target braking from an actually issued decision
- [x] Verify exact time, complete retained pose coverage, independent calibration effects, inert input and finite derived arithmetic
- [x] Verify immutable original retry/reopen and bounded dependency histories
- [x] Verify typed duplicate-preserving ownership mirrors, same-connection writes, WAL races and rollback
- [x] Independently review final sources and run targeted tests/typecheck

## Ownership and timing

`AcceptedActualLocomotion` pins the exact decision, locomotion model, base field and execution cut. It accepts no caller positions, velocities, target, acceleration or clock. Capability `initial_defender_step_v1` admits only the first receipt for a Player/pitch. Further steps require explicit route-progress/replan/continuation ownership.

The calculation consumes the decision's frozen target, actual `issuedAt`, and exact current self state. It requires a real integer physical boundary at or after both issuance and the original first-step deadline. It never privately extrapolates to such a boundary. The original decision/observation and explicit calibration hashes are retained.

The command changes only root acceleration. All five declared relative accelerations, original adoption references, accepted coverage and canonical actors are retained. Nonzero acceleration rounding residuals are rejected by this capability; position/velocity residuals remain part of the authoritative canonical state. Command coverage ends at the first Core integration-segment end or earliest retained-role coverage end. An exhausted checkpoint does not authorize extending a relative command: admission fails until a separately owned capability supplies valid coverage.

`receipt.self` retains both reconstructed root/relative state and the original canonical actor primitives. A later compositor must preserve canonical centers/velocities and must not reconstruct/re-round physical actor starts from the decomposition.

## Honest boundary

The immutable receipt remains `adoption_pending`, with `executedThrough: null`. Admission verifies and pins an unblocked original physical cursor, rejecting unresolved contact and pending acquisition/transfer even behind observer-only rows. This does not complete all ten Player contributions, consume an issued decision, or support command changes inside pending capture/transfer. Existing field execution remains the physical owner and must revalidate current availability, all contributions and adoption ownership when adoption is implemented. A carried-ball fixture is used only to establish a real exact boundary with retained coverage, not to claim a new pursuit/custody controller.

All numeric test values are synthetic; no production defaults or empirical realism claim is introduced. No UI, presentation, home CI, merge or deployment is part of this slice. Publication and later cumulative verification are recorded in the continuation checkpoint.

## Persistence boundary

The same-connection Native reader rederives original decision/observation, immutable Player model, exact self cut and physical availability. Writes compare these before BEGIN, inside BEGIN IMMEDIATE and after both receipt/head inserts. Historical reads replay their own bounded dependencies; future physical/observation domain payloads remain opaque.

Typed duplicate-preserving metadata discovery checks Source, snapshot, initial history, self/cut, command Player and underlying decision claims. Valid v1 histories retain last-entry Source-ID semantics; malformed v1 histories have no legitimate ancestors, so hidden IDs in any malformed history entry are discovered and rejected. String-encoded objects are never decoded as ownership metadata.

## Verified boundaries

- Before checkpoint integration: 6 focused files / 16 tests passed in 792.62 seconds, plus typecheck. All 1,434 source-file hashes stayed unchanged; manifest SHA-256 `4edb30d15e73fc87f2e4a0de190b293efa09e42af0af5fc7980edaf616988a7f`. This gate used the dependency tree `53982941bc2fd43a7409777a8cc353183d58d892` plus this receipt slice.
- Added the separately reviewed motion-coverage/checkpoint dependency `1f6faec74463127e2d3471bbd77ab51d2fc812d6`. The ordinary integration first failed on the original owner's unsupported new action, then passed without changing receipt production code.
- Final combined Source: 4 focused files / 8 tests passed in 334.20 seconds, plus typecheck. The gate covers ordinary deadline-to-issued-decision-to-receipt, existing pursuit/hold/reopen behavior, pending-operation rejection and duplicate-preserving metadata. All 1,439 source-file hashes stayed unchanged; manifest SHA-256 `654bc08bb6c365f8a157abfe27b699cd9a2e2e990b36f87a9fd70cb079d89c23`.
- Independent review found two metadata-discovery gaps; both received RED→GREEN regressions. Final source and the checkpoint integration review had no remaining findings.

The 16-test pre-checkpoint gate and 8-test final combined gate are separate results, not a claim that all 16 were rerun against the new dependency tree. No whole-repository suite, home/self-hosted CI, publication, merge or deployment was performed in this task.

## Published integration

[Draft PR277](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/277) contains [implementation e93bf5dc](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/e93bf5dc3cfab034895a5642b8be3d919ef4c17c). The parent integration passed typecheck and three focused files / seven tests in 3m49.202s with unchanged tracked hashes. Its exact Source and cumulative-gate boundary are recorded in [the continuation checkpoint](2026-10-04-nonvisual-continuation-checkpoint.md).
