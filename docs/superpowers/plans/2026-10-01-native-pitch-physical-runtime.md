# Native pitch delivery into physical Match execution

**Approved source:** foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, document55 (frozen release geometry), existing pitch timing and world-first physical/adjudication contracts. Overall user authorization covers this nonvisual integration. No new design decision or visual connection.

**Measured gap:** `PlayerPitchDeliveryRuntime` reads Native timing and release history but stops at `CanonicalPitchDelivery`. `createPitchTrajectoryFromRelease` has no production consumer. Existing physical take/swing resolvers and Official state persistence already exist and must be reused.

**Implementation:** Extend the existing Host runtime with an additive function that reads accepted per-day histories, creates a microsecond trajectory from the actual canonical release, and resolves/records a physical batter action through the existing Core. The caller supplies velocity, spin, acceleration, flight duration and actual take/swing inputs; no outcome label, forced plate target or form-label buff is introduced. Reject mismatched play scope, stopped timelines, unsafe duration and a new ready time before the previous event. Return the delivery, trajectory and existing resolution so live-ball work can continue through its established owner.

**Verification:** A focused RED/GREEN gate uses actual Native roster, Player-Person link, pitch timing and release histories. Resolve 120 pitches through varied cadence with fixed geometry, verify an accepted later form change affects physical plate crossing while past-day queries remain unchanged, execute a real physical called-strike terminal into Native Official state, and reopen/retry it without a live source callback. Exercise physical swing contact/miss and unresolved flight through the same adapter; reject mismatched scope and invalid clocks. No manually supplied counted pitch event.

- [x] Add focused failing runtime/integration tests before production code.
- [x] Compose existing Native delivery and Core trajectory/batter resolution in the existing runtime.
- [x] Verify actual Native Official persistence, reopen/retry, historical isolation and input boundaries.
- [x] Run focused gates, typecheck, one fresh read-only review and final whole-suite verification.
- [ ] Commit/push a stacked PR on PR229, attempt attachment once and check P0 exact SHA.
- [ ] Continue remaining approved nonvisual work; overall goal stays active.
