# Versioned atomic release custody compatibility

**Approved scope:** Correct the verified zero-delay atomic throw boundary without reinterpreting an archived Source. The approved compatibility seam is the explicit optional `custodyPolicy: 'release_exclusive_v1'` field on `base_touch_history` and `first_base_race` actions. Release ends custody exclusively; no new rule or outcome is selected.

**Architecture:** The existing Native execution owner remains authoritative. Omitted policy retains the original physical-prefix interpretation for stored reads and retries. Explicit policy closes earlier inclusive carrier windows ending exactly at an atomic release. Fresh omitted-policy observations reject when corrected custody windows differ. Source hashing includes an explicit policy; existing result shape, schema, raw physical archives and scheduled behavior stay unchanged.

**Spec:** `2026-10-04-nonvisual-field-rules.md` custody and archive invariants; verified acquisition → carried motion through `secureTick + 1000` → zero-delay atomic throw at elapsed `0.011001`. This reproduces stale custody, not a demonstrated incorrect OUT/SAFE.

## Interfaces and files

- `BattedWorldFieldPhysicalPrefix.ts`: export the policy type and accept its optional value on the prefix input. Validate runtime values; preserve all omitted-policy output. Correct atomic release windows only under explicit policy
- `SqliteBattedWorldFieldExecutionStore.ts`: exact optional action field validation, forward the policy into observations, and fail closed in fresh `derive` when omission would retain a stale inclusive endpoint. Historical `scope` / `read` and immutable retry keep original derivation
- `BattedWorldReleaseCustodyCompatibility.test.ts`: Native exact-release fixture and archived row contract, explicit-policy correction, no-policy fresh rejection, wrong policy/tamper rejection, physical same-time foot facts, bounded reads and WAL/currentness

## TDD and verification

- [x] Record the real Native zero-delay stale endpoint and a pre-correction archived observation hash
- [x] RED: explicit corrected prefix and fresh omitted-policy admission rejection; archived contract tests remain valid
- [x] GREEN: minimal versioned policy correction and fresh-only guard
- [x] Prove old Source/snapshot JSON and hashes remain unchanged through retry/reopen and corrupted future payloads
- [x] Prove exact-time physical foot contact remains while released custody/control facts disappear, without inventing an OUT/SAFE or closure
- [x] Prove malformed policy/tampering, source freeze, currentness and late WAL mutations reject
- [x] Focused Node26 one-worker tests, typecheck and independent review; record exact results before local commit

## Constraints and review focus

No second Source registry, schema migration, archive rewrite, Core/controller/UI/art/Presentation behavior, config/workflow/lock edit or home CI. Omission is a compatibility interpretation, not permission for new unsafe observations. A scheduled release remains exclusive with either interpretation. Prefix reads keep bounded payload validation plus complete metadata/head checks. Unknown policy cannot silently fall back. Future actor movement and requested coverage never create a foot contact or result.

## Verification record

- RED at base `4de724a`: a real Native release at elapsed `0.011001` retained `[true, false]` endpoint flags; both fresh omitted-policy observer kinds admitted the ambiguous prefix. The independent synthetic foot probe retained an exact-time control fact. The final regression replaces that isolated probe with a fully Native admitted foot-motion case.
- The pre-correction Native `base_touch_history` archive was checked against its reconstructed legacy shape. Snapshot SHA256: `282d93ebac8f07d676dcc4248e074115b62583d9f8be61567df8ac9d400cd210`; Source SHA256: `28cf49952957ccd3b4e24748e0a5d472f40dbafafb94c4aa215f56f437177b88`. Both are literal regression expectations.
- Initial GREEN pass established corrected windows, unsafe fresh rejection, explicit observer admission, immutable Source identity, archived reads, policy rejection and WAL rollback. Two test expectations were corrected: a point contact at the horizon does not prove departure; changing a future revision can invalidate the head before row metadata validation. No production changes were needed for those expectations.
- Test routing is deliberately focused and one-worker; cumulative Source whole-suite verification remains a separate gate.

## Caller migration

For a new affected observation, set `action.custodyPolicy` to `release_exclusive_v1` on a new Source identity whose predecessor is the current execution head. Do not add the field to an existing archived Source: immutable retry must reject that identity change. Unaffected fresh omitted-policy observations remain valid. Neither observation policy changes physical throw execution or declares an official result.

## Native forwarding regression

The final Native regression supplies a synthetic foot motor command before adoption so that p2's foot reaches the real first-base top plane exactly at release `0.011001`. The original interpretation retains the point touch plus one controlled-base fact. A seeded historical observer retains those original bytes. Both new versioned observer kinds retain the exact foot history while excluding released control. No actor snapshot or accepted motor is rewritten to arrange the contact, and no OUT/SAFE or play closure is asserted. Temporarily removing Native policy forwarding makes this test fail with the stale controlled-base fact (RED); the production forwarding was restored before final verification.

## Final targeted gates

- Node26 `vitest run` with `--maxWorkers=1 --minWorkers=1`: five existing regression files passed all 34 cases (`BattedWorldFieldPhysicalPrefix`, `SqliteBattedWorldFieldRules`, `BattedWorldFieldRulesWal`, `ScheduledFieldThrowHistory`, `BattedWorldFieldPersistentContact`).
- Final `BattedWorldReleaseCustodyCompatibility.test.ts`: 13/13 passed after replacing the isolated foot probe with the actual admitted Native case. Together the final targeted set covers 47 distinct passing tests across six files.
- `npm run typecheck` passed, including catalog verification (234 identities, 1170 seed values, 21 leagues, 148 directed source rows). `git diff --check` passed.
- No full suite or home CI was started in this worktree. Cumulative Source whole-suite verification and remote publication remain separate follow-on gates.

- Independent read-only review found no blocking or non-blocking issues. Its selected rerun passed the Native same-time foot regression and immediate scheduled-release equivalence (2/2; 15 intentionally skipped), with `git diff --check` clean.
