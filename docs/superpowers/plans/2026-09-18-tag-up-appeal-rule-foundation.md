# Tag-Up Appeal Rule Foundation Plan

**Status:** IMPLEMENTATION COMPLETE; appeal scoring/fourth-out handling intentionally deferred to the next rule phase.

**Goal:** Convert an outstanding tag-up violation into a Correct Rule Result only when the defense makes a timely, explicit appeal.

## Architecture

```text
TagUpCompliance
  compliant
  appealable_early_departure
        +
DefensiveAppealAttemptFact
        +
AppealWindowState
        ↓
TagUpAppealRule
  no violation
  timely appeal -> OUT
  expired appeal -> no out
  close/appeal same tick -> simultaneous_unresolved
```

## Permanent constraints

- Early departure is not an automatic out.
- The appeal attempt is separate from the underlying violation.
- The appeal window is separate from the appeal attempt.
- This phase does not infer appeal intent from an arbitrary base touch.
- Presentation input cannot create an appeal.
- Same authoritative tick between appeal and appeal-window closing remains simultaneous/unresolved.
- Tag-up appeal outs are not yet fed into third-out run scoring in this phase; appeal scoring and fourth-out handling require their own rule layer.

### Task 1: Defensive appeal attempt fact

Extend `PhysicalRuleFacts.ts` with `DefensiveAppealAttemptFact`:
- defender id;
- runner id;
- appealed base;
- appeal reason = `tag_up_early_departure`;
- authoritative tick.

This is an explicit defensive act/intent fact, not yet a valid appeal ruling.

### Task 2: Appeal window state

Create `AppealWindow.ts`.

State:
- openedAtTick;
- closedAtTick | null;
- close reason | null.

Initial supported close reasons:
- `next_pitch_or_play`;
- `defense_left_field`.

Pure evaluation:
- appeal before close -> timely;
- appeal after close -> expired;
- same tick -> simultaneous_unresolved;
- no close -> timely if at/after open.

The coordinator supplies the close event; this module does not guess when a pitch/play began.

### Task 3: TagUpAppealRule

Create `TagUpAppealRule.ts`.

Input:
- TagUpComplianceResult;
- DefensiveAppealAttemptFact;
- AppealWindowState.

Result:
- compliance already legal -> `no_violation`;
- appeal target runner/base mismatch -> reject;
- violation + timely appeal -> runner OUT at appeal tick;
- violation + expired appeal -> `appeal_expired`;
- simultaneous window close -> `simultaneous_unresolved`.

### Task 4: Vertical slice

Fixture:
- first fielder touch 1.000000 s;
- runner departed 0.990000 s and did not retouch;
- explicit appeal at original base 1.300000 s;
- next pitch/play closes appeal window at 1.500000 s;
- runner is out at 1.300000 s.

Companions:
- appeal 1.600000 s -> expired/no out;
- retouch at 1.010000 s -> no violation even if defense appeals;
- arbitrary controlled base touch without an appeal fact cannot enter this rule.

### Task 5: Core API + local verification; retry P0 CI without claiming full repository GREEN while jobs remain pre-step blocked.

## Deferred

- appeal third-out scoring;
- advantageous fourth-out appeal;
- missed-base appeals unrelated to tag-up;
- dead-ball appeal procedures;
- human umpire recognition/call error for appeal plays.


---

## Implementation Evidence

Implemented through HEAD `4ff357837e89b64e04b9151d43857b9d31d9fc25`:
- explicit defensive appeal attempt fact;
- immutable appeal-window state and close reasons;
- exact timely / expired / simultaneous-close timing;
- tag-up appeal rule separated from the underlying early-departure violation;
- timely explicit appeal produces a Correct Rule Result out;
- expired appeal produces no out;
- same-tick close/appeal remains unresolved;
- compliant/retouched runner remains `no_violation`;
- shared Core API exports.

Independent verification:
- TypeScript 5.8 source-level rules typecheck: success;
- runtime timely appeal fixture: success;
- runtime expired appeal fixture: success;
- runtime retouch/no-violation fixture: success.

Scoring boundary discovered during verification:
- a tag-up appeal third out cannot be reduced to a generic timestamp comparison in every case;
- Rule 5.08(a) has a preceding-runner missed-base exception;
- advantageous apparent-fourth-out appeals can supersede the apparent third out;
- therefore appeal scoring is explicitly deferred rather than approximated.

Repository CI:
- full repository GREEN remains intentionally unclaimed while P0 Core jobs continue to fail before workflow steps are created.
