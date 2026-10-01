# Batted World contact execution — next implementation brief

Authority: latest Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d confirmed32 same actual Player/Match simulation; latest Realism4f0a60a3818926327b6bf5877ab3dec456a76530 contracts05/06/07 World owns actor primitives, ball, surfaces and contacts; no outcomes drive physics. User authorizes all confirmed nonvisual execution/publication. Continue inline with TDD, one fresh readonly review, bounded/final verification and normal stacked publication. No UI/merge/default numeric content.

Current base: PR243 /260eeef2f598ce040a358cbc512a45bfc5118139, branch codex/batted-world-contact-2026-10-02. PR243 exact P0run36898411540 rerun SUCCESS; initial worker exit did not indicate a failed test assertion. PR242 exact P0run36892991868 SUCCESS. Do not repeat their completed implementation.

## Required deliverable

Use actual durable contact/flight and original Player/Person/world rather than an accepted fair/foul/catch/result boolean. Execute all actual defender primitives plus batter physical context and accepted venue geometry; preserve simultaneous contacts. A forecast ground must not outrank an earlier glove/body/wall contact. Rules and workload remain downstream.

### 1. Core physical contact executor

- New Core BattedBallWorldContacts.ts/.test.ts; reuse BallFlight, DefenderBodyKinematics, DefenderPhysicalPrimitive and AcceleratedSphereContact.
- Ball starts from original contact flight; microsecond horizon must be safe. Actor primitive sphere motion must cover the interval and use the same scale. Validate identity/role uniqueness and finite geometry before searching, including later unused malformed entries.
- Earliest ground, glove, body/foot/hand and supported static venue-surface contact, returning every simultaneous earliest fact. Explicit airborne/unresolved horizon remains live; no first-fielder ID tie-break/ruling/count/scoring.
- Static rectangular vertical surface collision should reuse accelerated sphere solver for face, finite edges and corners, avoiding frame-step tunnelling. Geometry is accepted data, not a caller-provided absence/result flag. Test first face/edge/corner, earlier actor vs ground/wall, simultaneous contacts and short horizons.
- Sample ball and actors at the physical event tick, retaining event/collision proof. Do not silently finalize unsupported interpretation. Preserve current bounded no-pre-pitch-runner production scope until all runner body sources are present; broader runner physics remains existing next owner.

### 2. Native actual actor/environment execution

- New Native SqliteBattedWorldContactStore.ts/.test.ts and real disk WAL tests. Reference the actual immutable accepted flight and original frame on own SQLite; reject stale peer results/altered sources before/after writes and retries.
- Independently accepted model parameters provide versioned finite actor body/glove/foot/hand shapes and actual venue surfaces, scoped to actual pregame Player/Person/fixture/gameDay. Independently accepted motion commands provide acceleration/local pose motion, not world positions, contacts or outcomes. Derive world anchors from original actual defenders and batter swing/contact context. Every actual defender and batter must be represented; no missing actor inferred by defaults. Freeze original per-game geometry; keep motion/history ordered and preserve originals after later legitimate facts.
- Profile numeric data remain explicit inputs. No arbitrary inferred country/date/numeric content; no new injury or ability rule. Existing pitcher body/release evidence remains authoritative where used. If a required true geometry/source cannot be reconstructed, reject fresh execution or expose an explicit unsupported boundary rather than inventing it.
- Source archives store full physical original/proof and derived contacts with SQL mirrors/hashes. No caller canonical timeline/result. No rule or Match/workload writes until downstream actual-contact interpretation is integrated.
- RED actual Native bat contact -> all actual actors/surfaces -> first physical contact/reopen; malformed/wrong-player/changed-model/late SQL/head/Source callback cases, historical recovery, independent review.

### 3. Actual contact interpretation/integration

- Consume derived contacts through existing BattedBallTimelinePhysicalAdapter / FielderTouchTimelinePhysicalAdapter / FairFoul adapters only when complete original physical coverage proves their required first/no-prior conditions. Never blindly pass noPriorFielderTouch or isFirstFielderTouch from caller data.
- Reuse the existing supported no-pre-pitch-runner GroundBallProductionOutcomeCoordinator pickup/transfer/throw/reception/base/race route. Actual undecided, failed pickup, simultaneous or unsupported events stay explicit live/unsupported, not forced OUT/SAFE/foul or arbitrary timeout.
- Closed supported result then existing official/scoring/workload outbox; add original batter participation and preserve immutable physical history. Later uncaught foul requires its durable actual extension in the own Native pitch replay before accepting a next pitch.

## Specific known next checks

- Current Core PlayerPhysicalProfile contains height only; Native use outside pitcher release is absent. GroundBallProductionOutcomeCoordinator currently has no Host caller; deriveGroundBallPickup is private and already derives true contact/retention. Reuse/export narrow pure physical evidence if needed, with compatibility coverage rather than duplicating Core math.
- Current Native physical pitch reader assumes continuous pitch-only beforeTimeline. Durable foul/contact extensions will need owned replay integration, not caller timeline injection.
- Current bounded production explicitly rejects pre-pitch runners (Realism05 lines559). Do not invent broader supported results while building its real Native path.

## Execution evidence — 2026-10-02

- Steps 1 and 2 implemented in this branch. Static finite surfaces use continuous contact time for feature bounds and retain authoritative quantized event ticks; relative seconds are never converted through fractional absolute ticks. Existing collision tick APIs preserve their calculations.
- Native execution archives independently accepted per-game geometry and Player/Person evidence for the registered model roster, including inactive actors. Motion execution selects the actual nine defenders and original selected batter only. Defender anchors come from original World; batter anchor comes from original swing grip and explicit relative-body calibration. The model and commands cannot change across an airborne extension.
- Step 3 started: only World-proven sole first ground contact is passed to the existing physical timeline adapter. Earlier/simultaneous actor/surface contacts remain physical Source facts; no forecast ground is inserted and no fair/foul/result is forced.
- Fresh readonly review found four Important issues (continuous wall feature range, fractional absolute tick precision, inactive binding revision, future Person intake); tracked reproductions failed before fixes and passed afterward. Final review has no remaining Critical/Important or deferred Minor findings.
- Targeted gate: 5 files / 49 tests including 6 unpublished review regressions GREEN; typecheck GREEN. Final whole-branch `npm run verify -- -- --maxWorkers=2 --minWorkers=1`: exit 0, 563 files / 3,368 tests in 2,803.28 seconds. Published Source accounts for 556 files / 3,346 tests; seven unpublished scratch review files account for 22 tests. The bounded workers avoid low-memory Windows process creation failure; no persistent configuration change was made.
- An earlier whole gate hit C: disk exhaustion in the existing WBC lifecycle test. Only the verified own failed test process and its descendants were stopped. The successful fresh whole gate used process-local K: TMP/TEMP; Source code remained frozen throughout verification. User separately authorized cleanup; 1,569 obsolete closed test SQLite directories (1,583,019,792 bytes, across two preserved reports) were deleted after prefix/path/age/reparse/file-type/exclusive-open checks. Additional old review DB removal was rejected by automatic approval review (`blocked by policy`) and not executed.
- Step 3 downstream interpretation, continuous contact response/pickup/throw/running, official closure, and broader nonvisual plans remain required. This record does not claim the overall user objective is complete.
