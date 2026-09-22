# Source-backed Trait Projection Implementation Plan

> Execute inline with test-driven-development and verification-before-completion.

**Goal:** Complete a headless projection boundary for examples of the four remaining canonical Trait lifecycle classes, preserving current-source ownership and unknown-vs-absent semantics.
**Base:** PR32 `06428e50f96bbf49bd91aa1c5842ecb94750350b`.
**Spec:** Approved design snapshot `782f6b8ef2406839de5678b00040001111cd8f77`, doc09 §§2.3–2.7,4.1/4.2/4.7/4.9/5.10/10.1/15 and doc53 §§18.1/20/21.4. Source owners classify their own physical/technical/statistical evidence; this module validates applicability, not raw physics or mastery.
**Architecture:** Eight explicitly registered example families in the remaining four classes. Pure request-to-projection and request-pair-to-difference functions; no independent mutable descriptor source and no new save schema for the existing TraitState. Reuse existing inert-input validation. Dynamic data is always re-derived; insufficient or stale evidence is not a confirmed cure/loss.
**Tech:** Existing TypeScript/Vitest, no dependencies.

## Global constraints

- No UI, rendering, Match Core, swing, probability or flat ability modification.
- Existing PR30/31/32 work is recovered, not rewritten. Separate swing PR25/27 remains separate.
- Registry classification is explicit and source-cited. Audit reference names are not finalized UI names. This is an example subset, not every candidate from the catalog.
- No trait names/colors used to choose lifecycle, no fixed total trait cap, no inferred permanent mastery.
- Source identities bind career, owner, subject, key, revision, snapshot and time; target-specific evidence binds current opponent roster/pitch/tactics/familiarity.
- Classification model IDs/versions and recognition thresholds are supplied, not invented production calibration. Cause/evidence authenticity remains host-owned.
- Success objects are detached/deeply frozen. Failure is structured; no partial mutation or external I/O.

## Rulings

1. Use stateless derived projections rather than extend persistent TraitState v1. These four classes follow current sources/history/context, and must not become another truth store. Existing learned/Green save contracts remain unchanged.
2. Register line-drive, pitching contact-distribution, gyro shape, wild-stuff tradeoff, directional release miss, command instability, team matchup and pitcher result-history examples only. Do not infer all named families' lifecycles or duplicate existing two-strike/pressure families across registries.
3. Accept owner-produced classifications with explicit source dependencies. Calculating classifications from raw trajectory/statistics is a separate calibrated owner task. This slice must not masquerade as an automatic trait-discovery engine.
4. History descriptors are retrospective only. Team matchup is one parameterized family in the requested target context, not one permanent family per club.

## Review focus

- A stale snapshot with the same numeric revision but a different ID cannot grant or clear a descriptor.
- Missing/unqualified evidence yields unavailable/unassessed, not absence or recovery.
- Wild-stuff needs both real pitch-quality and command-variance sources; no variance-only advantage.
- Opponent roster changes invalidate old matchup evidence; another target cannot borrow the descriptor.
- Mutable caller input, accessors, sparse arrays, duplicate roles/IDs and conflicting revision identities are rejected or detached.

## Task 1: Explicit registry and current-source projection

Files: `src/core/world/traits/sources/SourceTraitTypes.ts`, `SourceTraitFamilies.ts`, `SourceTraitValidation.ts`, `SourceTraitProjection.ts`, `SourceTraitFixtures.test-support.ts`, `SourceTraitProjection.test.ts`, `index.ts`.
Interface: `getSourceTraitFamilies(): readonly SourceTraitFamily[]`; `projectSourceTraits(input: unknown): TraitResult<SourceTraitProjection>`.

- [x] Write tests for all eight families, exact source roles, unknown-vs-absent, evidence thresholds and immutable output. Example: `assert.equal(value(projectSourceTraits(request())).entries.find(x=>x.familyId==='line_drive')?.status,'PRESENT')`.
- [x] Run tests with missing-feature stub. Expected: real assertions fail, not a false passing stub.
- [x] Implement explicit registry + strict parsing + eligibility projection. `status = missingAssessment ? 'UNASSESSED' : unavailable ? 'UNAVAILABLE' : stateId === null ? 'ABSENT' : 'PRESENT'`.
- [x] Run all inherited/new local Trait tests. Expected: zero failures. Commit.

## Task 2: Changes, context and historical boundaries

Files: `SourceTraitChanges.ts`, `SourceTraitChanges.test.ts`; export from sources/index.ts.
Interface: `compareSourceTraitRequests(before: unknown, after: unknown): TraitResult<SourceTraitDifference>`.

- [x] Write tests: present->current-null gives CLEARED; present->stale gives BECAME_UNAVAILABLE; absent->present gives APPEARED; variant change gives CHANGED; target/career/player switches reject comparison; source revisions cannot go backward under the same namespace.
- [x] Run RED, implement pure comparison from independently recomputed projections, then GREEN.
- [x] Do not label an unavailable assessment as improvement or erase actual underlying history. Commit.

## Task 3: Adversarial review and delivery

Files: `SourceTraitIntegrity.test.ts`, API/status documents and dedicated branch-only verification workflow.

- [x] Add tests for conflicting snapshot identities, future-dated data, stale models, raw-control misuse, dynamic/negative disappearance, history-only route, unsupported duplicate families and data mutation.
- [x] Fix reproduced defects only after seeing assertion RED; full local Trait suite237/237.
- [ ] Native repository-wide `npm ci` / `npm run verify` on the final published SHA.
- [ ] Verify exact Git blobs and remote diff; report native warnings/limitations. No independent review agent is available; identify review as inline.
- [ ] Open a stacked PR against PR32, no merge. Record next source-owner/consumer work; do not claim all Trait or physics integration complete.

Local execution ledger:140/168 RED ->168/168 GREEN;173/189 RED ->189/189 GREEN; review234/237 RED ->237/237 GREEN. Native completion is recorded on the exact-head PR verification record.
