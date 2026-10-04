# Actual Player kinematics from an owned physical cut

This bounded Native prerequisite implements no motor policy, world advance, route,
compositor, runner intent, or play-end decision. It changes no original physical,
observation, or execution archive and creates no new state table.

## Read contract

`openSqliteActualPlayerKinematicsReader(path).read(cut)` opens an existing database
read-only and uses a read transaction for a consistent snapshot. The cut contains
exactly `physicalPitchSourceId`, `playerId`, `baseFieldSourceId`,
`executionSourceId` (or null), and `mode` (`original` or `current`). It does not
accept a time, transported actors, guessed root, or caller-derived outcome.

The same-connection `actualPlayerKinematicsEvidenceFromSqlite(db).read(cut)` is
available to a future physical owner inside its own transaction. Callers requiring
atomic check-and-bind must use that connection/transaction; a separately opened
reader's result is not a lease on the current head.

Both paths rederive dependencies with the existing field/execution readers.
`original` reads only the bounded original payload prefix while preserving owner
metadata/head validation. `current` additionally checks the current field,
execution and underlying physical ownership. The result identifies the cut and
hashes its dependencies. The physical-prefix digest is a manifest with version
`actual_player_kinematics_prefix_v1`, a base-field reference, and ordered field and
execution reference arrays. Every reference contains the explicit Native owner
(`batted_world_field_actions` or `batted_world_field_executions`), Source ID,
revision, and individually validated snapshot hash, rather than one duplicated
aggregate object exceeding the existing inert-object size limit. It is specific
to this adapter, not the observation receipt's physical-prefix hash format.

Only the requested Player's identity, model/Person/day basis, root, five role
states, command provenance and five canonical primitives are returned. No ball,
teammate state, perception output or decision-context field is added. The pure
helper is an internal derivation over an already own-reader-validated complete
prefix, not an alternative authority for caller-supplied truth.

## Original state and numerical decomposition

A defender root replays the exact Core World-to-contact projection, including
pre-contact root acceleration and model root height. Relative poses and their
velocities begin at contact. The batter root instead uses actual sampled swing
grip minus the model grip offset and actual swing linear velocity. The body
primitive is one of five roles and is never substituted for the root. There is
no inferred orientation.

Each role exposes:

- `declaredPose`: integration of original model offset and Source relative
  velocity/acceleration, updated only when a command is actually adopted
- `canonicalRoundingResidual`: the separately retained correction introduced by
  the original Core primitive composition's explicit near-zero cleanup
- `offset`, `relativeVelocity`, `relativeAcceleration`: the effective declared
  state plus that residual, usable relative to the actual root
- `canonicalActor`: the unchanged authoritative primitive and exact stored
  start clock (`startTick` plus optional `startElapsedSeconds`)

The original composition is replayed exactly before any residual is recognized.
Position and velocity residuals propagate through subsequent motion; acceleration
residual becomes zero when a later raw-flattened command is adopted. Later command
flattening does not repeat initial composition cleanup. This prevents either
silently erasing the declared pose or pretending the canonical primitive retained
a value that Core explicitly cleaned.

Recomposition at segment starts and executed ends must agree with canonical
center, velocity and acceleration under the existing physical prefix's
32 × machine-epsilon, coordinate-scale tolerance. Role/radius, clock and original
coverage must agree too. The adapter never replaces canonical primitive starts,
widens tolerances, or normalizes a material mismatch. Floating-point cancellation
that cannot be reconciled under this discipline is rejected. A future compositor
must still rebase from those authoritative primitive starts/velocities; it must
not round-trip them through root/relative arithmetic and teleport the actor.

## Actual adoption and coverage

The replay pairs the canonical executed segments with original Source semantics:

- Contact establishes the original root/pose convention
- Each field action and execution `motion` adopts at the preceding actual cursor
- Atomic `throw` adopts at transfer start, not at later release
- `throw_plan` changes no actual command; its first `throw_advance` adopts at the
  original plan cursor, including a zero-elapsed-time first release
- Subsequent transfer advances retain that same adoption
- Atomic/scheduled acquisition, the confirmation fence and all three physical
  observers introduce no actor command

Retained state is sampled from the command's adoption anchor, so intermediate
capture/transfer checkpoints cannot accumulate incremental-integration rounding.
Only executed endpoints are sampled; accepted future coverage is never treated
as executed time. Exact origin tick and elapsed seconds stay separate throughout.

Each adoption identifies the original command Source/version/hash, actual
adoption Source/hash, exact adoption time, actual executed-through time, and
accepted coverage end tick. A scheduled throw's plan Source and its first advance
Source are therefore distinct. All five roles share that complete original
per-Player command coverage; no missing limb is zero-filled. Contact or an
unresolved cursor may end actual execution before accepted coverage ends. The
returned coverage does not authorize continuation or imply readiness/settlement.

## Verification scope

Focused Native/pure tests exercise nonzero root/relative motion, all five roles,
batter/defender bases, multiple command changes, fractional and zero-time throw
adoption, retained capture/fence motion, observers, original/current cuts,
bounded future-payload independence, identity/head/hash corruption, input guards,
canonical mismatch, finite arithmetic, explicit cleanup and unchanged archives.
These checks establish this read-only prerequisite only; they do not establish
full independent motor execution, empirical calibration or completion of the
remaining nonvisual runtime plan.
