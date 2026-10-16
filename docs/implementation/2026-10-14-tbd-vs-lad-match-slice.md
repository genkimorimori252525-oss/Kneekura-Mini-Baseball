# TBD vs LAD — First playable match integration slice

Date: 2026-10-14
Status: IMPLEMENTATION PLAN / NOT YET VERIFIED

**2026-10-16 USER-DIRECTED PRESENTATION CORRECTION (supersedes the original 2×-ball wording below):** Rendering frequency / effective display FPS is **scene-adaptive**, chosen for pitching, batted-ball flight, defensive play and quieter scenes as appropriate. The owner reports higher drawing frequency already used during pitching and batted-ball scenes in local work; do not claim its exact implementation was verified on this GitHub branch. **No ball-only image-quality enhancement, isolated ball FPS/resolution upscale, or blanket mandatory 2× rule.** The 55ms baseline is not a fixed per-scene cap. Each displayed scene frame observes the appropriate same canonical world time; no change to physics, official results, original PNG quality, or supported camera. [Authoritative clarification](../architecture/WORLD-FIRST-BROADCAST.md).
Owner intent: first playable nine-inning game, home Tambov Dragons (TBD), away Los Angeles Dodgers (LAD).

## Canonical requirements
- TBD home; LAD away. TBD lineup and Ti-ka-o from `docs/roster-seeds/2026-10-14-nlb-tambov-dragons-v1.md`.
- LAD roster must be a **versioned season snapshot**, not invented current players or fabricated performance. Resolve season and eligible roster before official opponent integration; provisional fixtures must be clearly marked.
- One authoritative Match Core for desktop/mobile; do not replace causal physics with outcome lottery or reintroduce the v17 stand-alone simplified engine as canonical.
- Presentation remains the approved PNG baseline. **Use scene-appropriate display sampling cadence (≒ effective FPS)**: pitching and batted-ball scenes may be drawn more frequently than quiet moments, as already described by the owner. Inspect and preserve existing local scene-specific drawing changes first. Do not upsample the ball alone, change ball-only image quality, insist on fixed 2× sampling or invent tween positions. Never advance canonical ticks twice, feed presentation into rules, or claim more refreshes than a device actually displays.
- Browser standalone/offline runtime should bundle browser-safe Core and adapter, with persistence interface separate from Node/SQLite. Node runtime may remain as a development/verification host.
- Same seed + same input log => identical canonical events, scores, and official records with mobile/desktop presentation cadence profiles, 30/60fps, scene-adaptive sampling, replay, or headless.
- If cross-device simultaneous connection is enabled, one authority owns commands, clients observe; offline independent sessions remain supported.

## Integration tasks
1. Audit branch HEAD, pending concurrent workers, source exports and current full-match gates; avoid editing shared integration worktrees or merging protected branches.
2. Define `TeamIdentity {id:'TBD'|'LAD', homeAway}`, versioned team roster adapter, lineup and pitching staff; preserve TBD handedness and GG/trait semantics.
3. LAD season snapshot: verify year, actual roster, batting order/rotation and provenance; no fictitious players; calibrate true player attributes from evidence, not league-name buffs.
4. Feed actual Match Core through lineup -> pitcher -> pitch -> bat/body -> contact -> fielders/runners -> adjudication -> official ledger -> next plate appearance -> innings -> game closure.
5. Inspect existing local pitching/batted-ball scene frame-density logic; adapt **scene-level Presentation cadence** where needed using canonical snapshots or Core-defined motion, keeping all visible actors/ball consistent to the selected scene time. Do not add ball-only quality/resolution enhancements or independent ball-frame-rate code. Preserve approved PNG assets and field cameras.
6. Browser build and offline persistence; deterministic save/resume and replay. Phone/mobile and desktop input/viewport profiles.
7. Verify unit + cross-runtime fixed seed + 9-inning completion + baserunner/rule edge cases + **scene-adaptive presentation cadence invariance** + absence of ball-only quality treatment + PNG asset hash unchanged; report PASS/FAIL/NOT_RUN accurately.

## Acceptance
- A user can play TBD home against LAD away for nine innings with real command input, see score/outs/count/bases and official final record.
- No silent fallback to scripted score or simulated-only match outcome.
- Phone and desktop run same canonical code, no required online service for local play.
- Distinct quality settings change only Presentation, not physics or rules.
- Tests must finish and report actual measured results; partial LAN01 gates remain explicitly unverified until passing.

## Open choices
- Which historical/current LAD season to snapshot (default not assumed).
- TBD SS position for Rai-poa, Li Jiangjun's .305? and 162-game NLB season remain provisional until confirmed.
