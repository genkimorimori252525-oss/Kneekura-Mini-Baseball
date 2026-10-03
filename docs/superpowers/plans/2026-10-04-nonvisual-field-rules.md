# Actual field physical history and first-base interpretation

> **For agentic workers:** Use the normal TDD and independent-review workflow. Execute only the approved remaining nonvisual scope.

**Goal:** Connect the actual field-action/execution prefix to player foot/base histories, controlled base contact, chronological capture/territory and true-elapsed first-base race.

**Architecture:** Add a field-native physical-prefix adapter instead of constructing fake legacy owners. Reuse owner-neutral foot-history, custody-intersection and actual race kernels. Add bounded observation Sources to the existing new field-execution owner; observations do not advance motion or reset custody. Field-aware rule composition retains both compatible surface contacts and explicit base provenance.

**Tech Stack:** TypeScript, Node SQLite, Vitest; unchanged dependencies/configuration.

**Spec:** Consolidated checkpoint `docs/project-status/2026-10-04-nonvisual-implementation-checkpoint.md` §5 item3, World-first contracts05/06/07. Predecessor field-execution implementation943d18cbfaaec0d2cfd269a12f46642d41c5ffcf is frozen in a separate whole-verification worktree.

## Constraints

- Complete original field geometry and Player/Person ownership; no caller afterWorld, touch/control, territory, catch or OUT/SAFE.
- Build from elapsed0 through all actual field/execution/acquisition windows. Requested horizon, forecast and observation are not physical facts.
- Secure custody starts only at actual security; release/interruption closes it exclusively. Both feet and real rebase continuity remain authoritative.
- Keep all base/contact provenance. An actual first/third bag can establish fair territory but does not invent ground; do not erase a pre-catch impact to manufacture eligible fly catch.
- Unknown surface/legal/nondefender/simultaneous contact remains pending. Later unsupported facts cannot erase an already supported earlier rule decision.
- Foul-side airborne contact remains catch-pending unless actual catch or ground evidence resolves it. No injected count/bunt flags or next-pitch/official closure.
- Legacy archives unchanged. Historical payload reads bounded; complete metadata/head still verified. Fresh write/late WAL guards preserved.
- No UI/art/Presentation, home CI, workflow/config/lock change, merges or force pushes.

## Review focus

1. Observation rows between security and movement must not discard secured custody
2. A released throw has a retained transfer interval, then free flight; ground-path evidence cannot run through both as one free segment
3. Base provenance and unknown-contact blockers remain intact after initial fair territory is known
4. Same recorded tick retains true elapsed ordering; exact tie stays unresolved
5. Missing/foreign prefix or late Player/geometry/source mutation cannot create a new result

## Tasks

- [x] RED→GREEN: add `BattedWorldFieldPhysicalPrefix` and foot/custody helper with real field/native fixture coverage
- [x] RED→GREEN: add `deriveBallWorldFieldFirstBaseRace({field,race})` using explicit field contacts and actual physical chronology
- [x] RED→GREEN: add Native `base_touch_history` and `first_base_race` observation Sources, scan last physical action across observations, rederive all original evidence
- [x] Verify new and legacy Core/Native/WAL/type gates, obtain one independent read-only review and correct material findings with regression tests
- [ ] Freeze Source for whole verify, publish stacked draft, and record remaining legal/closure/controller/Career scope honestly

## Interfaces

`battedWorldFieldPhysicalPrefix({baseField,fields,executions})` supplies `{field:BallWorldFieldTerritoryInput,segments,controlWindows}` using only the bounded original prefix. `battedWorldFieldBaseTouchHistoryFromPrefix({...prefix,playerId,base,baseSurfaceHeightMeters})` returns `{history,controlledContacts}`. Native observation Sources own the requested Player/base identity and derive first-base histories for the original batter and every active defender.
