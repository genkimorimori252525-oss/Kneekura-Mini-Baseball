# TBD vs LAD — First playable match integration slice

Date: 2026-10-14
Status: IMPLEMENTATION PLAN / NOT YET VERIFIED
Owner intent: first playable nine-inning game, home Tambov Dragons (TBD), away Los Angeles Dodgers (LAD).

## Canonical requirements
- TBD home; LAD away. TBD lineup and Ti-ka-o from `docs/roster-seeds/2026-10-14-nlb-tambov-dragons-v1.md`.
- LAD roster must be a **versioned season snapshot**, not invented current players or fabricated performance. Resolve season and eligible roster before official opponent integration; provisional fixtures must be clearly marked.
- One authoritative Match Core for desktop/mobile; do not replace causal physics with outcome lottery or reintroduce the v17 stand-alone simplified engine as canonical.
- Presentation remains the approved PNG baseline. Increase **pitch and batted-ball visual sampling/interpolation by 2x**; never advance canonical ticks twice, never interpolate into rule adjudication, and never imply 120 distinct screen refreshes on a 60Hz device.
- Browser standalone/offline runtime should bundle browser-safe Core and adapter, with persistence interface separate from Node/SQLite. Node runtime may remain as a development/verification host.
- Same seed + same input log => identical canonical events, scores, and official records with mobile/desktop render profile, 30/60fps, high-frequency ball sampling, replay, or headless.
- If cross-device simultaneous connection is enabled, one authority owns commands, clients observe; offline independent sessions remain supported.

## Integration tasks
1. Audit branch HEAD, pending concurrent workers, source exports and current full-match gates; avoid editing shared integration worktrees or merging protected branches.
2. Define `TeamIdentity {id:'TBD'|'LAD', homeAway}`, versioned team roster adapter, lineup and pitching staff; preserve TBD handedness and GG/trait semantics.
3. LAD season snapshot: verify year, actual roster, batting order/rotation and provenance; no fictitious players; calibrate true player attributes from evidence, not league-name buffs.
4. Feed actual Match Core through lineup -> pitcher -> pitch -> bat/body -> contact -> fielders/runners -> adjudication -> official ledger -> next plate appearance -> innings -> game closure.
5. Implement visual ball resampling only in Presentation using canonical positions/ticks; unchanged approved PNG image assets and field cameras.
6. Browser build and offline persistence; deterministic save/resume and replay. Phone/mobile and desktop input/viewport profiles.
7. Verify unit + cross-runtime fixed seed + 9-inning completion + baserunner/rule edge cases + 2x ball interpolation invariance + PNG asset hash unchanged; report PASS/FAIL/NOT_RUN accurately.

## Acceptance
- A user can play TBD home against LAD away for nine innings with real command input, see score/outs/count/bases and official final record.
- No silent fallback to scripted score or simulated-only match outcome.
- Phone and desktop run same canonical code, no required online service for local play.
- Distinct quality settings change only Presentation, not physics or rules.
- Tests must finish and report actual measured results; partial LAN01 gates remain explicitly unverified until passing.

## Open choices
- Which historical/current LAD season to snapshot (default not assumed).
- TBD SS position for Rai-poa, Li Jiangjun's .305? and 162-game NLB season remain provisional until confirmed.
