# Received positive-time continuation implementation plan

**Goal:** Execute the existing received renewal motor through one actual positive-time physical checkpoint, retain its ownership, and verify original and reopened owners in one integrated batch.

**Architecture:** A distinct `received_renewal_continuation_v1` physical Source carries only the renewal enrollment and adopted physical Source references. A separate `actual_received_umpire_continuations` admission binds this one successor; it does not extend either existing journal or remove their fences. The physical row, physical-head CAS and continuation admission are three atomic writes. Only that acceptance installs its one-table schema, in the same transaction.

**Baseline:** Consolidated `1a52f1ece913d441c325fe31380c7fb0d307cd8e`. Existing genuine C/D/M/A checkpoints remain immutable. Queued callback-free cases are integrated, not launched as separate long gates.

- [ ] Add bounded Source/schema/claim and physical-step counterexamples; run light targeted checks during authoring.
- [ ] Implement one references-only continuation owner with strict first-adoption predecessor, immutable original graph and independent current admission/readback.
- [ ] Extend physical action/archive/metadata, kinematics and current-work dispatch as one coherent batch.
- [ ] Integrate continuation, rollback/uncertainty, original owner reads and callback-free reopen/retry cases, then perform one consolidated meaningful validation and full compiler.

## Exact behavior and boundaries

The predecessor must be the authenticated zero-horizon renewal adoption. Historical replay reuses its already bounded physical prefix; current physical, current nonphysical and original known-work heads are checked separately. No historical reader calls a current physical projection. All full cut components are compared. The initial cut is an exact integer locomotion boundary; an actual Core boundary may occur at fractional elapsed time and is preserved without snapping.

The original ten participants and fifty actor curves are retained, with no rebase or new command/adoption event. Advance uses `advanceBattedWorldFieldMotionCheckpoint`, capped by the accepted adoption coverage and earlier original pending decision/first-step work. The renewed receiver's previous issued command remains historical; its actual adopted renewal is the active authority. Every other issued motor must already have been adopted. Original known-work references come from the authenticated predecessor history, and current discovery must still match those references before and after admission.

A physical boundary reports pending boundary handling. A known-work bound reports pending decision work. Accepted coverage exhaustion reports pending command renewal. None closes SAFE, possession/rules or the persistent fence. The existing two journals keep their family-specific censuses; union fresh-ingress discovery includes the separate admission and physical continuation even when prior families are absent. Case aliases, orphan rows, moved scopes and reference-only survivors reject.

The Native transaction retains spanning ownership sentinel, staged write count and full storage conservation, exact callback identity, post-COMMIT original dependency proofs and retirement on uncertain completion or cleanup. Injected real COMMIT never implies pristine rollback or row repair. Read/open/immutable retry creates no schema and needs no accepted Source callback.

## Verification focus

Tests cover unsupported/forked Source, moved or aliased claims, ordinary rollback and forced-commit retirement, no actor rebase, exact physical time progress and retained role authority, old-family journal conservation, bounded old reads with a later continuation present, current-work after the new head, and callback-free close/reopen retries. Genuine validation consumes a new private copy of the already qualified adoption endpoint; it never rebuilds C/D/M/A or old received stages. No unrelated full-suite or per-API long verification runs are added during authoring.
