# Original pre-pitch runner: owned contact and read-only self-state

Implementation base for this continuation: `308879402035fb0df2c17aa79b18117b1a0c2ef6`.
Authoritative scope remains the approved nonvisual continuation, with Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` and Realism `4f0a60a3818926327b6bf5877ab3dec456a76530` as the previously confirmed plan references. This is a bounded original-contact seam, not general runner gameplay or a new design policy.

## Recovery provenance

The unpublished original candidate was `f25f019456d8a1447dd248f75e968bfe9aa719c2`, source tree `6e12b7bb5024246c5908a43faf2d5a1cffc50cdc`, based on `6fd42e74135cc9f0ca544a7ca1333b3e7a1264be`. Its executor was lost. Complete retained text for its eight new code/test files and document, plus all four existing-file changes, was preserved before this continuation. The reconstructed existing-file postimages matched the retained Git blob prefixes `e858364`, `55b06b2`, and `0b5e483`; old full commit/tree objects and terminal logs were not recovered.

The original patch was reapplied to the current base, adjusting only import-order context. Current live-write fences and prior-closure readiness checks were preserved, including the current pitch-fence call signature. Original Native acceptance was never run. Earlier lost-workspace test/review reports are historical and are not reused as current verification.

## Supported source-to-physical connection

- Optional `prePitchRunner` in the accepted physical pitch action names `pre_pitch_upright_runner_v1`: the original accepted physical batter actor, one runner, straight route, start motion, intent, motion parameters/revision, coverage endpoint, body-origin height and all five explicit original primitive offsets/velocities/accelerations.
- Before pitch execution, the pitch owner derives root position, velocity and clock from the original canonical World. One occupied original Match base and exactly one matching World runner are required. Original Player, Person, side, Club, fixture, competition, day and roster evidence must agree. These values are frozen into the original pitch frame and authenticated on replay. Later pitch actions cannot replace or retrofit that Source.
- Existing `RunnerLocomotionController`, `RunnerMotion` and `RunnerRoute` algorithms remain authoritative. The contact interval must lie within one real analytic segment. Reaction, braking and top-speed boundaries are not flattened; coverage cannot be extended by extrapolation. Arcs, multiple route segments/runners, exhaustion and sliding/transitions remain unsupported.
- `owned_runner_contact_v1` consumes that frozen source. The existing ten batter/defender commands keep their exact cardinality and meaning. The runner has no caller-overridable contact-time root command. Its five relative primitives evolve from original World time through actual bat contact. The existing ball/contact kernel receives eleven real participants and 55 primitives.

## Bounded prefix and kinematics

`battedWorldOriginalContactPrefix` validates the original Source/frame/controller, exact eleven Player/Person identities, all 55 source-derived canonical primitives and the actual ball/contact result. It returns `owned_runner_original_contact_prefix_v1`, one physical segment ending at the actually executed contact horizon. A declared future coverage endpoint is not treated as executed time. This prefix contains no fabricated field action, rule evidence, custody window or PlayEnd.

`actualPlayerKinematicsFromOriginalContact` uses the existing root/relative-part contracts for the batter, nine defenders and original runner. The runner origin is explicitly `pre_pitch_runner_controller`, with original pitch ownership and the nested runner Source identity/hash. Primitive cleanup is recorded separately from the canonical root, so a nonzero root is not silently rounded into a rebase. The result is deliberately distinct from field motor-adoption state and cannot itself issue commands.

The existing SQLite kinematics reader exposes `readOriginalContact` with the exact cut `{ kind: 'owned_runner_contact_v1', physicalPitchSourceId, worldContactSourceId, playerId }`. It independently reads the original contact owner and returns dependency hashes for the physical prefix, pitch, contact and model. No sample tick or “current” mode can extend the cut. The public reader uses a read-only SQLite transaction; no receipt or schema is created. Historical bounded reads do not interpret future payloads, while current contact ownership metadata remains subject to validation.

## Explicit unsupported consumers

An explicit original-runner boundary now rejects first-fielder-touch production, contact response, continuation, response-to-motion inputs, motion renewal and the general field prefix. This closes the earlier response/continuation forwarding gap. The direct tests distinguish this deliberate unsupported boundary from accidental errors caused by incomplete geometry or models.

The legacy field-prefix and field-kinematics APIs remain unchanged in scope. General command renewal, field execution, observation/decision/motor pipelines, arbitrary routes/slides, multiple runners, base consequences, interference/adjudication, Native registry/watermarks/producer-consumer closure, disposition, scoring and PlayEnd remain unconnected. No ten-player guard was globally loosened. The new contact/self-state APIs provide physical facts and read-only state only.

## Verification gates

Current fixed-source gate: catalog compilation and whole-repository typecheck passed with the approved 1408 MiB heap; 13 files / 114 bounded tests passed with one worker and a 1024 MiB heap. Terminal exit was 0 and every before/after source SHA-256 remained unchanged. MemAvailable at admission was 8,974,108 KiB. No Native fixture was included. Tests include TDD failures before introducing the new prefix/reader and explicit consumer boundaries; all-five primitive evolution; real moving-body collision versus a stationary counterfactual; exact Player/Person/Club evidence; corrupted controller/root/parts; real tiny SQLite read-only/reopen and rehashed-source/snapshot tamper; future metadata versus opaque payload bounds; and nonzero canonical roots below primitive cleanup tolerance.

Legacy contact serialization is checked against complete snapshot hashes captured from unchanged `3088794`, including zero motion, nonzero root/relative motion, and cleanup-sensitive inputs. The original comparison was byte-for-byte; retained golden hashes keep the regression repeatable without duplicating the old production owner in test code.

`PrePitchRunnerNative.test.ts` remains authored but unrun until the coordinator grants a Native slot. It uses the legal four-ball walk → official closure → next-batter activation, prospectively accepted synthetic motion/body inputs, actual runner-body collision, stationary counterfactual, unchanged official Match, identity-trigger rollback at pitch/contact admission, reopen/retry, rehashed corruption, owned SQLite kinematics and an explicit rejected downstream touch. Synthetic inputs are not empirical calibration. Whole-suite verification, remote CI, general-runner completion and production calibration are not claimed.

No UI/Presentation, workflow/config/lockfile, merge, deployment, publication or home-PC CI changes are included. Current original-play closure remains the higher-priority integration path.

## Recovered connection and current verification

The initial candidate was recovered from preserved source text and three reconstructed integration postimages with retained original blob-prefix matches; the complete old commit/tree and Native evidence were unavailable. The current connection is newly tested source, not a transferred old Native pass.

The recovered source now exposes a versioned original-contact prefix and `readOriginalContact` on the read-only SQLite kinematics reader. Its horizon is the actual executed contact horizon, never caller time or future declared coverage. One prospectively owned pre-pitch runner joins the original ten actors as eleven identities and fifty-five canonical parts. Existing route/locomotion algorithms supply the runner root; each of its five relative parts preserves its original accepted identity and command.

The unsupported first-fielder-touch, response, continuation, motion-renewal and field-prefix consumers explicitly reject this path. This checkpoint does not implement general field execution, multiple runners, runtime registry, rule adjudication, scoring or PlayEnd for runners.

Independent bounded review on `873b0173d09d2e888f3440c0f0f01269ad5c36f5` found no Critical/Important defect. Ninety tests across ten files passed, including independent oblique advance/retreat/hold, reversal/exhaustion, geometry/source corruption and executed-versus-declared-horizon probes. Six independent comparisons against the original `3088794` contact owner preserved complete canonical legacy snapshot bytes exactly. Native remained unrun.

Current integration `6eb01d25fe19eef8a28c8680fcaab0db380bb071`, full tree `6389ffa707d6cf50bcb2d34dfce36f21dd7ea5f4`, source tree `05703b4f6b1237d06227a48b344c035a234040ca`, includes the latest reviewed constructor cleanup and physical fence hooks unchanged. A separate additive style commit removes one redundant trailing line from test support; no commit was amended.

Fresh immutable gate, 2026-10-04 22:15:16–22:15:50 UTC:

- Catalog and complete typecheck PASS
- 16 files / 129 bounded tests PASS, zero skips; 11.51 seconds
- Adjacent physical-pitch and constructor-cleanup regressions included
- All 2,042 tracked-file hashes unchanged; full manifest SHA256 `fd48f7422e17e896aa25dae6028f8c66d16baa78f6e4052505e558f3ad2ed86b`
- 1,670 source files; source manifest SHA256 `fa975b1db56a8ba8713ebe256c7bebe7ecc42b7d946bd059f277bf4975595221`
- Catalog, typecheck, tests, count, hash checks and owning process all exited 0

This documentation-only addition follows the verified source. The authored Native legal-walk/closure/next-batter/pitch/contact/read/retry/reopen/rollback case remains unrun; the running original ten-player gates use their own earlier immutable source and are not relabeled as this runner integration. Current whole-repository verification and the wider general-runner plan remain incomplete.
