# NPB 2026 Inning Infield Side Assignment Lock Plan

**Goal:** Preserve the NPB 2026 requirement that the two infielders established on each side of second base for the inning cannot later switch to the opposite side, even if the raw 2+2 count remains legal.

## Rule dependency

The existing pitch-release side evaluator answers only:
- are there four registered infielders;
- are exactly two on each side;
- are both feet on the same side?

It does not know whether a particular infielder changed sides from the inning's established assignment.

## Architecture

```text
first legal pitch-release side result of half-inning
        ↓
InningInfieldSideAssignment
(playerId -> first/third-base side)
        ↓
later pitch-release side result
        ↓
InningInfieldSideLockRule
  same side -> compliant
  opposite side -> violation
  straddling -> violation
  changed participant set -> unsupported_participant_change
```

## Permanent constraints

- Assignment is established only from a legal 2+2/both-feet pitch-release result.
- Assignment is keyed by player id, not body center or current registered-position label alone.
- A later 2+2 count can still violate the rule if two players swapped sides.
- Straddling/on-divider remains a violation independently of the lock.
- A changed set of four infielders is **not** guessed through this module; substitutions/position changes require the future substitution rule layer.
- The assignment lives for the current half-inning only.
- Presentation order and event sequence never alter assignment.
- The separate infield-boundary requirement remains outside this module.

### Task 1: RuleProfile policy

Extend `defensiveAlignment.secondBaseSide` with:
- `assignmentLock.enabled = true`
- `assignmentLock.establishedAt = 'inning_first_pitch_release'`
- `assignmentLock.duration = 'half_inning'`

### Task 2: Assignment state

Create `InningInfieldSideAssignment.ts`.

Provide:
- `establishInningInfieldSideAssignment(result)`;
- immutable assignment records for the four player ids;
- reject non-legal initial alignment.

### Task 3: Later-pitch lock evaluation

Provide:
- `evaluateInningInfieldSideLock(assignment, currentResult)`.

Results:
- `compliant`;
- `violation` with moved/invalid player ids;
- `unsupported_participant_change` if current four player ids differ.

Fixtures:
- same four, same sides -> compliant;
- 2B/SS swap sides while still 2+2 -> violation;
- 3+1 -> violation;
- one player straddles -> violation;
- player substitution -> unsupported participant change.

### Task 4: Profile-aware match entry point

Add `evaluateInningInfieldSideLockForMatch`.
It validates:
- canonical match/profile binding;
- assignment-lock policy enabled;
- supported establishment/duration semantics.

### Task 5: Core API + verification

Export assignment/lock helpers, run strict TypeScript/runtime fixtures, retry P0 CI without claiming full repository GREEN while jobs remain pre-step blocked.
