# Single-gate numerical execution and runner motion implementation plan

> **For agentic workers:** Use superpowers:executing-plans task by task. Preserve the explicit no-UI session scope.

**Goal:** Consume accepted emotion effects once from an emotion-free baseline, and demonstrate causal runner decision/motion through existing Core owners.
**Architecture:** Recompute PR36 appraisal through the existing gate; derive bounded decision inputs without modifying permanent ratings. Return one proposal binding source frame, gate receipt and decision inputs; acceptance recomputes against a current authoritative request. An optional runner execution source uses existing RunnerDecision and RunnerMotion, never an outcome sampler.
**Tech Stack:** TypeScript; native Vitest; supplemental Node22/tsc5.8 where native dependencies are unavailable.
**Spec:** Approved `docs/game-design/05-psychology-emotion.md` §§2,3.1,7,8,12,13 at design SHA `782f6b8ef2406839de5678b00040001111cd8f77`; source appraisal PR36 and two-strike PR35. Execution parent `fd5c8b10fbd3c64bed02ec444fde3a9eee5e383f`.

## Global constraints
- No design/UI/rendering connection, no new swing engine, no existing core owner edits, no shared-branch merge.
- No inactive pressure, Trait-label, club-name or result-probability bonuses. Neutral returns baseline; clear returns to the fresh baseline, not an inverse of prior modifications.
- One existing gate, same accepted influence for execution and future observation. Never use candidate offers directly.
- World-first timing: never create a decision before its source/evidence/current frame or past a supplied window while pretending it was executable.
- Caller-supplied versioned calibration; no production numeric defaults or scientific validation claim.

## Review focus
1. Double application and stale baseline/world/model substitution: fresh baseline only; exact recomputation on acceptance.
2. Timing overflow and earliest-feasible constraints; expired windows must be visible, never silently clamped backwards.
3. Neutral/cleared equality; irrelevance of other emotional channels to a particular runner decision.
4. Future/stale perception, pre-issued decisions and body/time mismatch: reject before returning an adoptable motion.
5. Pure atomic failures: return no partial state; reject malformed/getter/cyclic payloads and unrepresentable output.

## Rulings / scope
- Verified production swing `7b1b84aafa5d79499740d556fd44cef63b4f2c26` exposes `timingOffsetTicks` as whole rigid-trajectory shift. `swingDecisionShiftTicks` is decision commitment timing, not that mechanical phase offset. Do NOT blindly map them. Swing observation cut-off/commit semantics are separate integration work.
- This slice consumes six numerical channels into decision inputs; only runner risk is connected through a concrete Core decision and motion here. Throw intent/replan/swing commitment times and aggression remain typed outputs, not claimed full physical integration.
- Positive runningRiskDelta reduces required safety margin by signed-rounded delta*caller scale; range constrained to nonnegative caller maximum. This is a documented calibration choice, not a frozen coefficient.
- Earliest timing is a physical/information constraint; late beyond latest returns MISSED_WINDOW. No fabricated fallback or motion.
- In-memory acceptance is a compare/recompute proposal, not a database transaction. Host must CAS world/gate state and globally deduplicate IDs.

### Task 1: numerical single-gate consumer
- [x] Write tests for neutral equality, one active channel, timing bounds/overflow, clear/reset, no input mutation.
- [x] Observe assertion RED; implement types, validation and pure numerical application; observe GREEN.
- Produces prepareEmotionExecution(request), carrying complete normalized request + PR36 gate output + realized deltas.

### Task 2: existing runner integration
- [x] Write tests for identical physical inputs producing advance vs hold, unchanged skill/physics, forced advance/tag-up/coach precedence and current observation binding.
- [x] Observe RED; invoke existing decideRunnerMotionIntent/buildRunnerMotionTrajectory; observe GREEN.
- No duplicated runner AI, no possession/base/out/rule authority in this module.

### Task 3: coherent acceptance/replay check
- [x] Write tests for exact repeat, tampered output, changed current source/world/policy, reuse after accepted revision, no partial adoption and deep immutable outputs.
- [x] Observe RED; implement acceptance recomputing entire proposal against current request; observe GREEN.
- Produces acceptance receipt with before/after world and gate revisions, all actions/sources together.

### Task 4: review and delivery
- [x] Inline adversarial review; reproduce/fix defects with regression tests. No independent-agent claim.
- [ ] Native full repository npm ci/npm run verify at exact published head; inspect logs and bind exported paths.
- [ ] API + handoff; publish dedicated branch/PR only. Report remaining consumer/host responsibilities.
