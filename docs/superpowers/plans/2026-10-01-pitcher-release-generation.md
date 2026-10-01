# New Pitcher release generation

**Approved source:** foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, frozen document55 sections14/18/19: body profile -> arm-slot prior -> continuous geometry sample -> plausibility validation -> frozen profile. Existing accepted Player intake/Person genesis and Native release history remain authoritative. No visual connection, old draft or direct form-label buff.

**Gap:** the existing release store only accepts a completed profile; production code has no body-aware new-Pitcher generator. Person genesis already pins a Career seed and accepted Player identity.

**Architecture:** A new Core generator consumes a complete explicit versioned creation policy, body and derived per-Player Career seed. Select an arm-slot prior once, sample continuous ratios/angles, validate the existing physical envelope, and project the height tier. Bounded rejection sampling fails an impossible selected prior rather than clamping coordinates or silently changing class. Policy weights/ranges/attempt limit are caller-supplied calibration, with no production defaults or real-football Player abilities.

A Native generation owner consumes independently accepted creation records and actual persisted Person/seed. Archive the accepted record plus generated result, replay exactly and expose the existing accepted release-baseline interface. A sequential idempotent materialization function persists generation then initializes the existing Native release owner; replay closes a crash gap without cross-database atomicity claims. Match reads only the resulting frozen release history, never genesis seeds.

**Tests:** deterministic distinct Players; overlapping class priors; tier-from-continuous-value; valid envelope; impossible/reversed/future policy and invalid seed; actual Native intake/Person -> generation -> release -> physical trajectory; reopen/retry without live generation authority; changed Source/policy and corrupt records rejected; later form change does not reroll creation history.

- [x] Add Core and Native failing tests before production implementation.
- [x] Implement bounded continuous body-aware generation with explicit versioned priors.
- [x] Persist/replay accepted Native generation records and compose with the existing release owner.
- [x] Run focused tests/typecheck, one fresh read-only review and whole-suite verification (524 files / 3,123 tests).
- [x] Commit/push stacked on PR230: PR231, `312a8704acb6f61b9e7a680533b84d19594fd47c`; attachment attempted once (100-item limit); P0 run36828553033 attempt3 succeeded at that exact SHA. Its earlier checkout lock failure was resolved by the user-approved single CI lock removal.
- [x] Continue causal workload/recovery, national-pool and full Career integration audit.
