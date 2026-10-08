# Native received renewal implementation plan

> **For agentic workers:** Use superpowers:executing-plans task by task. Independent review slices may run in isolated checkouts when a worker slot is available.

**Goal:** Consume one received renewal obligation through Native enrollment, decision, motor and zero-horizon physical adoption, leaving physical continuation pending.

**Architecture:** A separate fixed five-owner renewal family authenticates immutable received evidence and bounded physical prefixes. Fresh ingress uses a union claim census; historical family conservation stays separate. Adoption commits its actual physical owner and renewal journal together under the existing Native lifecycle guarantees.

**Tech stack:** TypeScript, Node 26 Native SQLite, Vitest; existing Core mathematics and accepted models.

**Spec:** `docs/superpowers/specs/2026-10-08-received-native-renewal-contract.md`, approved commit `16293f561b0b61be090f33bc0ac4978da475420e`.

## Global constraints

- Preserve the 18 recorded protected blobs, all v1 Source/snapshot formats and received family count arithmetic.
- Exact new writes: 3/3/3/4; first acceptance alone may bootstrap all five schemas. No old-family repair.
- Compare complete cut tuples and require exact integer boundaries. Preserve all fifty positions/velocities and each retained role authority.
- No genuine artifact access until a separately reviewed pinned packet. Existing eight-checkpoint donors and controls stay immutable.
- Finite isolated Native gates: 1024 MiB heap / 1120 measured / 2048 RSS, 6400 MiB launch floor / 4096 reserve. Full compiler may use the separately approved 1664 / 1760 / 2304 MiB envelope. No unbounded project test command or dependency regeneration.

## Review focus

- Renewal-only ownership when the old family is absent must block fresh ingress before bootstrap.
- A later adoption must never enter earlier-owner dependency replay or old current qualification.
- Equal quantized ticks with distinct elapsed instants must fail.
- A real COMMIT/rebegin or failed proof cleanup must retire with honest durable uncertainty.
- Global active-command equality must not hide mismatched role coverage or another Player's command.

## 1. Durable enrollment and union fencing

Files: new `ActualReceivedUmpireRenewal{,Schema,Claims,Transaction,Evidence,Journal}.ts`, `SqliteActualReceivedUmpireRenewalEnrollmentStore.ts`, isolated enrollment/claim tests and support; update fresh guard routing in `ActualLivePlayFence.ts`, both terminal stores and old enrollment pre-bootstrap admission only.

Interfaces: reference-only `RenewalEnrollmentSource`; `receivedRenewalEnrollmentEvidenceFromSqlite(db).derive(source)` supplies immutable frozen facts, `.qualifyCurrent(value)` independently checks fresh heads; `actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db).read(id)` authenticates historical rows; `openSqliteActualReceivedUmpireRenewalEnrollmentStore(path, authority?).accept/read/close` owns private Native transactions. `receivedUnionClaims` and reference variant discover both families without changing old census exports.

- [ ] Write REDs for inert open/read, atomic three-row acceptance, rollback/bootstrap, callback-free reopen, changed Source/dependency/cut, old-family count and renewal-only/moved/head/journal claims.
- [ ] Run the exact finite RED inventory; preserve its terminal/report.
- [ ] Implement fixed schema, same-connection evidence, per-family journal, lifecycle guards and pre-DDL union checks.
- [ ] Run GREEN plus relevant existing received/fence tests and full compiler; compare protected blobs; freeze and report the coherent source checkpoint before longer work.

## 2. Native decision and motor

Files: `SqliteActualReceivedUmpireRenewalDecisionStore.ts`, `SqliteActualReceivedUmpireRenewalMotorStore.ts`, `ActualReceivedUmpireRenewalMotor.ts`, dedicated Native/pure tests. Extend the renewal journal's consecutive heads, keeping later payloads opaque.

Interfaces: approved reference-only decision/motor Sources; dedicated immutable readers and private stores with the same read/accept/close API; motor derivation consumes the owned renewal decision, existing accepted locomotion model and exact bounded self.

- [ ] RED exact three changes at each stage, no fork/rebind, full cut mismatch, role-specific exhaustion/mutation, model identity and unchanged v1 outputs.
- [ ] Implement issuance from R2's selected result and existing Core route/rating/trajectory functions; no v1 casts or new calibration.
- [ ] GREEN finite regression and compiler; freeze source for review.

## 3. Actual zero-horizon adoption

Files: new renewal adoption/composition helpers and tests; explicit action variant in the physical execution Source/evidence owner, archive/metadata/causal rank, physical prefix, current kinematics and received work projection.

Interfaces: approved `received_renewal_adoption_v1` action, `received_renewal_adoption_snapshot_v1`; private same-connection staged grant for exact physical INSERT/head CAS and renewal head/journal writes. Historical readers consume only immutable replan.read and bounded predecessor scopes.

- [ ] RED exact four writes, all-ten/all-fifty zero-time conservation, stale heads, retained authority, rank-cycle/forbidden-current calls, adoption rollback and real COMMIT uncertainty.
- [ ] Implement the one literal action and its Native replay/metadata/command-adoption variant. Keep the fence and physical continuation obligation pending.
- [ ] GREEN finite regression, callback-free reopen and full compiler; freeze exact source and test-attribution note.

## 4. Qualification packet

- [ ] Review the complete diff and protected blobs, publish source-safe checkpoints through the parent.
- [ ] Inventory actual proof work; prepare new exact source/input/control pins and staged genuine proposal from the closed final received donor. No inherited release or automatic genuine execution.
