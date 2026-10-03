# Actual field observation boundary

This increment connects existing perception algorithms to the owned actual field/execution archive. It does not implement individual decisions, autonomous gaze, communication generation, calibrated production perception, or play completion.

## Accepted input and geometry ownership

`AcceptedActualFieldObservation` supplies immutable Source identity/version, physical pitch and Player references, a bounded field/execution prefix, the pinned observation model, a previous-observation link, and explicit view/attention inputs. Native derives time, available physical states, quality, noise and memory. Unknown fields, caller truth, estimates, confidence, focus-start times, outcomes and completion claims are rejected.

The eye baseline is an explicit translation from the actual `body` primitive center in world axes. Its `poseVersion` and `bodyRelativeEyeOffset` are fixed by the first Source in the Player/pitch chain. The physical body primitive moves that anchor. This is not an inferred anatomical eye height or reconstructed Player root. Forward direction and attention target remain explicit accepted inputs; neither velocity nor the true ball chooses gaze. A future owned pose-change contract is needed to change the baseline during a play.

Every receipt samples the ball and all other registered Players, ordered by Player ID. Player positions/velocities refer to actual body primitive centers, not Player roots or intended paths. Occlusion uses the other actually executed actor spheres; observer and target-Player primitives are excluded. Owned finite venue walls and base prisms are checked geometrically. An intersecting/tangent/endpoint sightline, or a below-ground endpoint, produces `surface_visibility_unavailable` and retains old memory: no optical transparency or opacity is inferred from collider material. Clear rays continue through the supported actor-sphere model. Head/eye geometry and calibrated optical materials require their own explicit contracts rather than invented shapes.

## Actual time and perceived output

The private sampler uses the exact executed `originTick + elapsedSeconds`, sampling the final executed actor segment and the adopted current ball cursor. An incoming boundary horizon is not a post-response ball state. A missing cursor leaves the ball unavailable, preserving any older memory. An admitted throw plan supplies no future actor/ball truth; partial transfer can be observed at its actual checkpoint without executing the remaining plan.

The receipt keeps exact evidence times separately from the existing integer-tick refresh and memory policy. Distinct instants can share a canonical tick; they are not collapsed into one physical instant, but no sub-tick memory precision or refresh is claimed. A fresh detection replaces only that target's sample. Nondetection, physical unavailability and refresh-not-due preserve old samples; predictions retain their original observation time and decay through the existing memory function.

Contiguous same-target accepted attention establishes `focusStartedAt`. Attention age does not establish uninterrupted visibility. Each capture is instantaneous (`observationDurationSeconds=0`) and uses the explicitly owned instantaneous-duration calibration. The attended/peripheral input is categorical 1/0, with its influence controlled by the owned quality weights. There is no awareness-to-success mapping.

The AI-facing `PlayerPerceivedWorldState` contains noisy observation memory and explicit attention only, with null known context and no communications. Physical prefix and model references/hashes are receipt provenance, not an AI truth feed. Decision scheduling and communication availability remain separate future integrations.

## Persistence and replay

Observation tables and their per-Player/per-pitch head are separate from physical ownership. Fresh writes require the current original actor/fixture and exact current physical prefix. Immutable retries and reopening replay only the originally pinned payload prefixes. Full indexed ownership/lineage metadata is still checked, including later field/execution and observation rows; malformed future payloads are not historical evidence.

Writes are transactional and rederive original dependencies on the store's own SQLite connection before and after insertion. The original pitch, field, execution and official state archives are never rewritten, and observing never advances canonical time or acquires physical ownership.

## Discovered sphere endpoint edge

The existing sphere occlusion kernel previously skipped a sphere whenever its center projected behind the observer or beyond the target. That incorrectly made the ray visible when the sphere's radius still enclosed an endpoint. The minimal correction clamps closest-point projection to the closed sight segment, preserving clear non-overlapping spheres and treating tangent contact consistently. This fixes the existing spherical-occluder geometry contract; it is separate from the unknown-optical-policy guard for venue walls and bases.

## Derived arithmetic boundary

Accepted coordinate fields are compared as exact sorted key arrays, so delimiter-containing property names cannot alias required axes. After capture and memory prediction, the complete receipt is validated as finite inert data before it is returned or frozen. Finite but very large calibration values remain legal inputs; arithmetic overflow fails closed instead of becoming nonfinite perceived output or JSON nulls. No arbitrary production magnitude cap is introduced.

## Verification at integration

- Pre-freeze breadth: 17 files / 198 tests passed. This is not a fixed final-Source gate.
- Final isolated delta: 14 files / 120 tests passed, with unchanged production hashes, typecheck and independent review.
- Above the versioned custody correction: 4 Native/history/WAL/compatibility files / 24 tests passed (376.10 seconds), with all tracked src hashes unchanged before/after.
- Integrated sampler/input/surface and existing perception regressions: 12 files / 113 tests passed (19.77 seconds); integrated typecheck and diff check passed.
- Exact cumulative whole verification is the next gate. Prior #262 whole passed 632 files / 4,326 tests on its own frozen Source; it does not certify these later changes.

See the [current nonvisual implementation and verification checkpoint](2026-10-04-nonvisual-continuation-checkpoint.md) for published dependencies, exact prior gates and remaining contracts.
