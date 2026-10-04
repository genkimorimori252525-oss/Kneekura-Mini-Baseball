# Exact retained field checkpoints V1

Approved V1-B Core-only physical seam. This adds no Native owner, persistence,
command adoption, event-generation receipt, watermark, rule decision or PlayEnd.

## Additive entry points

- `deriveExactBallWorldFieldContinuationV1` accepts the ordinary complete field
  query with `throughElapsedSeconds` in place of `throughTick`. It selects the
  existing free airborne, rolling or resting physics. Ordinary rolling/resting
  motion is never represented as a constrained accelerated path.
- `deriveExactAcceleratedBallWorldFieldMotionV1` preserves the existing explicit
  acceleration contract used by carried motion. It does not invent a glove joint
  or exclude any collider.
- `advanceBattedWorldFieldMotionExactCheckpointV1` accepts the retained field
  checkpoint with `checkpointThroughElapsedSeconds` in place of
  `checkpointThroughTick`. It uses the accepted actor curves unchanged, including
  fractional anchors and original end coverage. Replacement commands and new
  coverage fields are rejected. There is no exact-time adoption API in this slice.

The result retains the existing field motion/response/cursor shape. Its integer
`throughTick`, where present, is the endpoint's recorded quantized tick; it does
not assert completion of that entire tick bucket. The actual endpoint is
`world.moment.elapsedSeconds`.

## Physical and numeric contract

The exact branch validates every actor's continuous requested coverage against
`(endTick - originTick) / ticksPerSecond`, then samples its original polynomial
at that exact requested endpoint. A query a little beyond mathematical T can
still quantize to T, but an actor ending at mathematical T cannot cover it. An
original T+1 curve can cover the tail; the checkpoint never extends a curve.

The existing horizon-independent piecewise contact solvers are selected
independently of joint ownership. The supporting
`findExactBallWorldBaseBoundaryCandidatesV1` seam preserves raw composed base
root times, including face/edge/corner roots exactly at a local endpoint. It
returns candidates for the owning field query to reconcile; it does not normalize
them to the requested absolute horizon. Both existing base query exports retain
their original endpoint normalization.

The exact owner also passes its original local duration directly to this seam,
including durations clipped by free ground, rolling stop or constrained ground.
That local duration is finite, nonnegative and bounded by the original requested
interval. The absolute request is retained separately for clock validation and
fail-closed occurrence checks. There is no local-to-absolute-to-local round trip
that can shorten the base search or admit a later collider after a phase boundary. Every ordinary actor, panel and base remains a
collider. Ground and rolling-stop boundaries retain the ordinary free-motion
phase and first-boundary behavior. Contacts are ordered by exact physical time;
distinct fractional events sharing one integer tick are not merged. Actual
simultaneous sets and continuing prior contacts preserve unresolved/null-cursor
response semantics.

Only a contact-free result owns the exact requested endpoint. Its elapsed time
and recorded tick are normalized without changing sampled position or velocity.
A real contact is never normalized. If composing a local physical root with the
current elapsed time rounds past the exact absolute horizon, the exact query
fails closed with `exact ball World boundary exceeds requested horizon` before
selecting the simultaneous set or producing a response. A valid earlier boundary
is still returned before a later unrepresentable candidate. The query
neither adopts that outside event nor certifies contact-free coverage. Existing
numeric overflow/unsupported precision errors likewise remain failures.

Retained checkpoints require strictly positive continuous progress. A first
actual contact at the current moment still returns that contact and its real
response, rather than fabricated progress. Carried queries continue the existing
retained-glove velocity checks and pending behavior when competing contact occurs.

## Compatibility and verification boundary

Old exports keep their previous integer/accelerated/joint paths and serialized
shapes. Archive hashes cover ordinary free and field motion, legacy same-tick
grouping, simultaneous physical contacts, gravity/rolling, acceleration, a real
piecewise glove constraint and the legacy retained integer checkpoint. They were
captured from the unmodified prerequisite `94b953595943cc154d271b75a45486f0123b75d4`.
A separate original/piecewise base-endpoint archive hash covers all three feature
types and retains that old normalization byte-for-byte.

The new Core suites cover exact tail events, real continuous coverage, sequential
same-bucket rebounds, actor anchors, airborne/rolling/resting phases, rolling
stop, panels/bases/actors, simultaneous/prior contacts, carried motion, endpoints,
zero progress, non-binary and large-origin clocks, inert input and overflow. The
face/edge/corner matrix checks actor/panel/base combinations under both ordinary
and constrained exact queries. The review regression ensures an outside rounded
base candidate cannot suppress a simultaneous actor and fabricate a rebound cursor.
The clipped-interval family covers different nonzero origins, both directions of
add/subtract roundoff, mixed face/edge/corner/actor/panel sets, nonzero gravity and
constrained floor turnaround, valid earlier contacts and contact-free cuts. A later
base root which rounds to the same absolute time as ground is not admitted past
the original local phase cut.

This seam alone cannot certify complete producer generation or consumption. It
does not generate actor-foot/base history independently and does not advance past
unknown contacts or due decisions. Current Native scheduling/motor adoption is
not universally valid at fractional cuts; no new Native support is claimed.
Native and whole-project execution verification are deliberately outside this
Core-only slice and remain for separately scheduled integration verification.

## Fixed-source review result

The final worker source `c45ac72794b2f5170886c772fe78ada6eea44d35`
passed catalog/typecheck and 54 Core files / 827 tests with unchanged hashes.
Independent review reproduced and closed both precision findings, then passed
catalog/typecheck and 58 Core/probe files / 853 tests. All three legacy archive
hashes were also verified against the original `94b9535` source. No remaining
Critical/Important finding was identified for this Core-only slice. Earlier
review-rejected intermediate commits are not treated as accepted versions.
