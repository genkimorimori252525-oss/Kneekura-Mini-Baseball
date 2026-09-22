# 2026-09-22 — Approved club catalog / career assembly continuation

## Scope and recovery

User requested continuation after interruption, retaining the session's no-design/UI/rendering-integration boundary. This slice builds on PR29 head `869c8af7c7be2c6f9dca096cc37301177283ab08`. Dedicated branch `jolly/confirmed-headless-catalog-2026-09-22` initially contained only verification setup/fix commits `36f6a57` and `e7398f7`. Interrupted uncommitted draft tree `ad0a56abcf23373bc187c68f32f0bc17a025bced` contained the runtime skeleton and offline compiler but lacked registry, generated data and tests. Its five runtime file blobs were recovered exactly; no previous completed implementation is falsely assumed.

## Delivered boundary

- Persistent explicit 234-club / 21-league identity registry.
- Twelve exact pinned source snapshots and source manifest; all 1170 numeric seed cells traced to approved sources at design SHA `782f6b8ef2406839de5678b00040001111cd8f77`.
- Reproducible offline literal generation through existing npm typecheck/test pre-hooks; no new dependency or lockfile change.
- Immutable validated catalog and explicit alias lookup, including ambiguity outcomes.
- Atomic complete new-career proposal reusing existing ClubSeed and RivalryLifecycle owners.
- 148 directed inputs -> 141 historical edges + 7 competitive-threat signals, without automatic reverse edges or new formulas.
- Career-scoped reference IDs, pinned provenance, season/league/profile coherence and caller input immutability.
- Public API and integration responsibilities in `docs/core/world-club-catalog-v1-headless-api.md`.

Current numeric money, person/player/place IDs and actual stadium geometry still come from the host. The test setups are synthetic, not a calibrated 234-club ready-to-play world. This slice does not finish the full economy/career simulation.

## Verification record

Supplementary local check: TypeScript5.8.3/Node22.16.0, temporary test copies changing only Vitest runner imports to node:test. Product code/assertions unchanged. This covers 79 new tests plus 156 existing club/control tests (235 total), not the repository-wide native suite.

Inline review reproduced two failing compiler assertions: NUL-containing club ID and origin ID were accepted by the offline compiler although runtime rejects them. Fixed by applying the same identifier grammar on registry ingestion; green afterward. One additional failing build-hook assertion exposed missing standalone typecheck/test generation hooks; both hooks were added and checked green. Initial recovered runtime code predated this session's tests; no claim it was test-first. A final integration review also reproduced the missing watch-test preparation hook (234/235 passing); added pretest:watch and checked fresh generation plus 235/235 passing. There was no independent reviewer agent.

Native verification must use the exact published branch head. The associated PR verification comment and Actions check are the authoritative exact-SHA record; do not infer native success merely from local supplementary output. Initial setup run `35670817400` failed because Windows PowerShell log redirection converted npm stderr warnings to NativeCommandError. Prior fix `e7398f7` preserves native exit codes through cmd; its run `35671234171` succeeded. Warnings were not suppressed or granted new approvals.

Known prior warning: unchanged dependencies report 5 vulnerabilities (3 moderate,1 high,1 critical). Individual causes/exploitability are not audited here. Functional test success is not a security audit.

## Boundaries / remaining queue

No existing Match Core, physics, swing, rules, roster/control/rivalry owner or presentation source is edited. Generated data is build-time-only. package.json changes only npm pre-hooks; .gitignore and .gitattributes handle derived output/provenance; the new branch-specific workflow stays read-only.

Remaining in club/world group: explicit production country/city/venue/person/monetary setup assembly, economic calibration and automatic flows, financial-rule enforcement, whole-world persistence transactions and integrations. Do not invent exact money from S-rank or seed an existing save.

The independently completed Swing Kinematics and active production migration remain separate PR25/27; previously inspected migration head `7b1b84aafa5d79499740d556fd44cef63b4f2c26` passed its exact-head check. Recheck its current ref before later integration; never reintroduce the legacy first-order swing path.

Next dependency review: the approved psychology/player-trait causal-state and lifecycle contracts (05/08/09 and successors), taking the independent completed swing input boundary into account; no direct label-to-hit/probability bonuses. Also retain team traits, competitions/calendar, scouting/development and manager AI/market in the queue. No shared-branch merge is performed by this slice.
