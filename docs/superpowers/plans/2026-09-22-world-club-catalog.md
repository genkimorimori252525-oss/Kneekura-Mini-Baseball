# World Club Catalog / New Career Assembly Implementation Plan

> For agentic workers: use superpowers:executing-plans for this already-approved queue continuation.

**Goal:** Compile the approved 234 clubs into stable identities and create an atomic, renderer-free club-world initialization proposal.
**Architecture:** Fixed source snapshots plus a persistent identity registry compile to TypeScript literals offline. Runtime validates detached data, resolves only explicit names, then invokes existing club creation and directed rivalry owners.
**Tech Stack:** existing TypeScript / Vitest; Node built-ins only in offline tools/tests.
**Spec:** doc21,26–30,33 at `782f6b8ef2406839de5678b00040001111cd8f77`; club lifecycle/API from PR29.

## Global Constraints
No UI, screen, button or rendering connections. No player/manager copies. No current-world synchronization or reseeding running careers. No name/rank ability buffs. No fabricated real money, locations or stadium geometry. Keep partial/full boundaries explicit. Stable IDs survive names/order/data-version changes.

## Review Focus
Sparse/malformed input must reject without invoking getters. Ambiguous aliases must not silently choose a club. Whole-world initial setup must have exact coverage, coherent season and profile versions. All historical relationships remain directional and distinct from competitive threat. No partial bundle or mutation of caller-owned setup is permitted.

### Task 1: Restore compiler, add persistent identities and exact literal data
- Recover interrupted offline compiler and pinned snapshots; verify each original Git blob SHA.
- Assign explicit opaque IDs once in identity-registry.json; do not derive IDs at runtime or on recompilation.
- Generate ignored runtime literals via pretypecheck/pretest (no new dependency), then compile and assert 21 leagues / 234 clubs / 1170 numeric seeds / 148 directed source rows. Treat contradictory decorative rank labels as non-authoritative; preserve raw files unchanged.
- Add a compiler test that checks output against originals and fails on registry/source drift, missing or duplicate identities. Regenerate before checking.

### Task 2: Restore and test runtime catalog boundary
- Recover CatalogTypes, ClubCatalog and DefaultClubCatalog from prior draft.
- Test real/default data and exact multilingual aliases; reject malformed records, unknown references, duplicate IDs, invalid numbers and graph endpoints.
- Assert ambiguity instead of fuzzy or first-match resolution; reorder registry/catalog inputs without changing semantic output.
- Fix any reproduced defects only after a failing assertion; keep strict parsing and immutable outputs.

### Task 3: Restore and test new-career assembly
- Recover NewCareerClubs; supply actual caller-provided money, identity links, profiles, references and geometry.
- Use createClubFromSeed and adaptInitialDirectedRivalrySeed; never duplicate their state machines.
- Test full 234-club assembly, exact asymmetric initial intensities, threat separation, frozen provenance, no player/ability writes, different future dataset isolation, running/existing-career refusal.
- Test sparse/duplicate/unknown/missing setup rows, profile/season conflict, all-or-nothing rejection and source input immutability.
- Use deterministic reordered-input equality and a fixed large-season case. Do not claim full-world multi-century simulation.

### Task 4: Verification and delivery
- Run strict local supplementary compile/tests; disclose Node/Vitest environment distinctions.
- Publish into existing dedicated catalog branch only, stacked PR on PR29. Full locked npm ci + npm run verify in native runner; inspect exact head and logs.
- Check source blobs on published tree, document all warnings/failures and integration limits.
- Leave next approved queue location and latest independent swing status without merging either stream.
