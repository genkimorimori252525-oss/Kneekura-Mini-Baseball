# 2026-09-22 — Human Control Overlay / decision attribution

## Scope and pins

Continuation of the user's confirmed-plan execution queue. No design/UI/Work/rendering connections. The accepted design is doc32 §18 and canonical 38/42/49 at `782f6b8ef2406839de5678b00040001111cd8f77`.

Source parent: PR #26 head `062cf366db8a878c666b3d55bbc0e9e83c8e2d5f`; baseline tree `268150f7520be20e545f39c0652fc81ea52b7b90`. The old PR remains separate and unmerged. This continuation must be reviewed as a stacked change, not silently merged with physics or swing branches.

## Implemented boundary

- Detached, immutable single-human control policy over host-registered existing baseball domains; atomic changes, stale-request/overflow checks and no-op handling.
- Explicit human-required/delegated/autonomous routing using the **current supplied manager appointment**, never a manager copy frozen at overlay activation.
- Exact legal action selection for human or manager through the same supplied action set; no manager-skill override or silent fallback on a manual domain.
- Selection-time attribution bound to decision/context/control/world revisions, controller and manager tenure; historical restore validates internally consistent origins.
- Separate actual-execution evidence join. All origins retain canonical world evidence; only manager-selected origins supply self-chosen strategy AND manager decision-quality/skill evidence.
- Public API and caller responsibilities documented in `docs/core/human-control-v1-headless-api.md`.

This does not implement the Manager Agent, market/retirement simulation, strategy learning, skill evaluation, world persistence, action execution, legal-action generation, physical simulation or a UI. These services must consume the boundary correctly before it affects a running game.

## Execution / review ledger

1. Before product code, native test files were written. Local TypeScript failed with missing `ControlTypes` / `index` modules (exit 2): missing-feature RED, not a claimed passing test.
2. First implementation passed 62 local tests with strict compilation.
3. Inline adversarial review reproduced **three failing tests for two defects**: a submission could be associated with another decision/context sharing the same revisions, and delimiter-joined opaque domain IDs could make different policies look like a no-op.
4. Added mandatory submission decision/context IDs and checked them. Review run: 64/65 passing, one remaining no-op failure.
5. Replaced delimiter joining with length-and-element array equality. Review run: **65/65 passing**, zero failures.

Review is inline; no independent reviewer agent was available. These are real assertion tests of the production source, not mocked behavior.

Local tooling: Node 22.16.0 and TypeScript 5.8.3. For local execution only, temporary copies change the test-runner import from Vitest to Node's test runner; assertions and product code are unchanged. The repository's native files still import Vitest. **This supplementary run is not the repository-wide Node 26 / TypeScript 5.6 / Vitest verification.**

## Publication / native verification

Dedicated branch: `jolly/confirmed-headless-control-2026-09-22`, stacked on the PR #26 branch. No existing source files are changed. A narrowly scoped additive `.github/workflows/headless-control-verify.yml` runs the existing `npm ci` / `npm run verify` commands only for pushes to this branch. It retains read-only contents permission and the repository-specific Windows `minibaseball` runner labels, with no pull-request trigger. Existing `p0-core.yml` is untouched.

At the time of this initial publication document, native full-repository verification is **pending**. Record the resulting exact commit/run/job and actual totals before declaring it verified. The baseline's successful #1498 run must not be reused as evidence for these new files.

## Remaining queue and next slice

The previous queue remains in `docs/project-status/2026-09-22-confirmed-headless-implementation.md`.

- Roster administrative foundation: PR #26, separate review/integration.
- Human Control Overlay / attribution: this functional boundary; game-service wiring, persistence and consumers remain explicit integration work.
- Next dependency-ready nonvisual group: **club state lifecycle / institutional economy / initial seed application** (18,16,19,26–30). Read current canonical contracts and inspect existing Rivalry Lifecycle before implementing; do not duplicate players, reseed existing saves or apply club labels as ability buffs.
- Physics/live-ball closure and separate swing work must be checked at their exact current branches/PRs before integration. They are not silently included here.
- Player psychology/special abilities and team traits (05,08/09,34/35,37/38) remain visible in the queue. Implement causal source states and evidence, not direct outcome-probability or label bonuses. This session does not complete them.
- Competitions, calendar, scouting, manager AI/market, development, popularity/stars retain their separate dependency and approval boundaries. No random lower-tier result engine is authorized.
