# Explicit command coverage and actual physical checkpoints

Date: 2026-10-04
Scope: additive, nonvisual prerequisite for individual motor execution

## Contract

The existing `SqliteBattedWorldFieldExecutionStore` remains the only field-execution physical owner. Its existing immutable Source chain, transaction, rederivation, ownership fence, and historical read rules also own these two versioned actions:

- `motion_checkpoint_v1`: explicit `availableAtTick`, `coverageThroughTick`, `checkpointThroughTick`, and the existing complete ten-Player × five-role commands
- `retained_motion_checkpoint_v1`: only `checkpointThroughTick`; no replacement command, availability, or extended coverage is accepted

A new command adopts root and relative accelerations at the exact preceding physical cursor. It rebases canonical actors once and sets their accepted end to `coverageThroughTick`. The ball and collisions execute only toward `checkpointThroughTick`; first actual contact can end execution earlier. No future coverage is queried and then trimmed into a supposed current result.

A retained checkpoint keeps the original canonical actor curves, start instants, end ticks, and active command identity. Kinematics samples the original anchored root/relative curves and advances only their executed-through record. It does not accumulate actor integration drift or invent another adoption. Ball position and velocity continue from the actual cursor under the existing kernel's numerical behavior; this change does not introduce an original-ball trajectory anchor or promise byte-identical paused/unpaused ball arithmetic. A carrying glove's velocity is sampled at the current exact instant, rather than read from the curve's original start velocity.

Exact comparisons govern availability, prior actor coverage, positive requested progress, and checkpoint/coverage ordering. A fractional cursor can advance to the immediately following integer boundary even when both share the same quantized ball tick. Reaching the last covered endpoint is allowed; further retained motion is rejected. An exhausted endpoint may receive explicitly new complete commands, which are a new adoption rather than retention.

For a contact-free result only, the requested endpoint is recorded exactly after the physical kernel samples its trajectory. This follows the existing scheduled-acquisition endpoint convention. Collision instants, including contacts at the initial instant or precisely at coverage end, are never rounded into a free endpoint.

## Consumers and compatibility

Physical predecessor selection, field prefix, whole-play history, actual Player kinematics, observations, and physical rule readers recognize both actions. Whole-play history uses an additive retained-motion step to distinguish unchanged original curves from an actor rebase. New-command kinematics records `acceptedThroughTick = coverageThroughTick`; retained execution does not replace that provenance.

Legacy raw `motion`, scheduled operations, acquisition and throw retain their original Source shapes and archived semantics. No schema, migration, calibration default, geometry authority, motor receipt, or second actor owner is introduced.

## Explicit limits

These Sources request bounded external physical execution. They are not an autonomous scheduler and do not claim that independently due work is absent. A later owned compositor must bound execution by every known due contributor before invoking the physical owner.

Pending acquisition and transfer still exclude both checkpoint actions. This change does not provide piecewise command changes during capture/transfer, actual batter/runner policy, autonomous motor adoption, PlayEnd, official settlement, or Presentation behavior.

## Verification scope

Focused Core and real SQLite Native tests cover separate future command coverage, ordinary contact-free advancement to owned decision/first-step deadlines, exact fractional availability and integer endpoints, unchanged retained curves and nonzero root/relative commands, carried ball, first/same-time/coverage-edge contacts, malformed or expired coverage, prefix/history/rule consumption, original bounded reads, transaction rollback and competing WAL ownership. Final single-worker verification passed 76 tests across eight focused files, plus TypeScript checking and `git diff --check`. Independent review found no actionable issues; its additional checks reproduced pinned original acquisition/observation/history archive hashes and compared legacy field/motion JSON against the frozen base. No full suite, home-PC CI, publishing, workflow, package-lock or configuration change is part of this slice.
