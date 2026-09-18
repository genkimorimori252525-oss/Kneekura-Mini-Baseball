# NPB 2026 Defensive Alignment Violation Penalty Plan

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

**Goal:** Resolve the NPB 2026 5.02(c) penalty from an already-established alignment violation, the first post-pitch infielder ball touch, and the natural play advancement result, without rewriting physical truth.

## Official 2026 penalty branches

1. If an infielder who violated 5.02(c) is the first infielder to touch the ball after the pitch:
   - baseline penalty award: batter to first safely, each pre-pitch runner one base safely;
   - if the batter naturally reaches first and **every** pre-pitch runner naturally advances at least one base, play continues independent of the violation;
   - otherwise the play is allowed to finish because the offensive manager may elect the play result after it ends.

2. If the violating infielder is **not** the first infielder to touch the ball after the pitch:
   - the pitch is called a ball;
   - the ball is dead.

## Architecture

```text
AlignmentViolation
  violatingPlayerIds
        +
FirstPostPitchInfielderTouchFact | null
        +
PrePitchOffenseState
        +
NaturalPlayAdvanceResult
        ↓
NPB2026AlignmentViolationPenalty
        ↓
  no_violation
  play_stands
  offense_choice_required {
    naturalPlay,
    penaltyAward
  }
  ball_and_dead_ball
```

The penalty result is a Correct Rule Result option set. It does not alter CanonicalWorldSnapshot.

## Permanent constraints

- The alignment evaluator and penalty evaluator remain separate.
- The penalty accepts a normalized list of violating registered infielder player ids from either:
  - raw pitch-release side violation;
  - half-inning side-lock violation;
  - future infield-boundary violation.
- The first-touch fact means the **first infielder** to touch the ball after the pitch, not first defender of any position.
- A shifted outfielder touching first does not satisfy "violating infielder first touches"; the later first infielder touch identity is what matters.
- If no infielder touch occurs, the violating infielder is not the first infielder toucher; this phase treats the rule consequence as the ball/dead-ball branch.
- Natural advancement is measured against **pre-pitch** offense state.
- A runner from third who scores has advanced one base.
- A runner already out in the natural play has not satisfied the "advanced at least one base safely" exception.
- Missing a base during an awarded/continued play remains a separate appeal issue; the 2026 penalty note says such runners are treated as having reached for this penalty analysis.
- Manager election is represented as a pending rule choice; Core does not invent the manager's choice.
- Human umpire call remains downstream.

### Task 1: Normalized alignment violation

Create `DefensiveAlignmentViolation.ts`.

Input adapters:
- `PitchReleaseInfieldSideResult`;
- `InningInfieldSideLockResult`.

Output:
- `no_violation`;
- `violation { violatingPlayerIds }`.

For side count violations with no straddler/moved identity (e.g. 3+1 raw result), derive violating ids by identifying players on the overpopulated side beyond their allowed side assignment only when assignment evidence is available. Therefore:
- raw side violation may expose `violationScope: 'team_alignment'` with zero/known invalid ids;
- side-lock violation exposes concrete moved/invalid ids.
Penalty evaluation that requires player identity must reject a team-only violation until identity evidence exists.

### Task 2: First post-pitch infielder touch fact

Create `FirstPostPitchInfielderTouchFact`:
- playerId;
- registeredPosition restricted to 1B/2B/3B/SS;
- tick.

Validate identity/tick.

### Task 3: Natural play advancement model

Create `OffenseAdvancementResult.ts`.

Input:
- prePitch `BaseOccupancy`;
- batterRunnerId;
- natural play result:
  - batterReachedFirstSafely;
  - per pre-pitch runner: safelyAdvancedBases (non-negative integer), or retired.

Provide `satisfiesAlignmentPenaltyAdvanceException`.

True only if:
- batterReachedFirstSafely;
- every pre-pitch runner is not retired and safelyAdvancedBases >= 1.

### Task 4: Penalty evaluator

Create `NPB2026AlignmentViolationPenalty.ts`.

Input:
- normalized concrete violation;
- first post-pitch infielder touch or null;
- pre-pitch offense state;
- natural advancement result.

Output:
- `no_violation`;
- `play_stands`;
- `offense_choice_required` with:
  - natural advancement;
  - deterministic penalty award description: batter first, each pre-pitch runner one base;
- `ball_and_dead_ball`.

Branch:
- first infielder toucher not in violating ids (or null) -> `ball_and_dead_ball`;
- first toucher violates and natural advance exception true -> `play_stands`;
- first toucher violates and exception false -> `offense_choice_required`.

### Task 5: Profile-aware RuleEngine boundary

Add `resolveDefensiveAlignmentViolationPenaltyForMatch`.

It validates:
- canonical match/profile binding;
- policy id = `npb_2026_5_02_c`;
- profile supports the implemented penalty semantics.

### Task 6: Core API + verification

Fixtures:
- violating SS first touches; batter/runner both naturally advance >=1 -> play stands;
- violating SS first touches; batter out / runner fails advance -> offense choice required;
- nonviolating 2B is first infielder touch -> ball + dead ball;
- no infielder touch -> ball + dead ball;
- concrete side-lock violation with 2B/SS swapped supports identity-aware penalty;
- team-only raw 3+1 violation cannot be penalty-resolved without identity evidence.

Run strict TypeScript/runtime verification and retry P0 CI without claiming full repository GREEN while jobs remain pre-step blocked.


---

## Completion evidence

Implemented through HEAD `259c0dface31e5615f267fb453bad57a85bcd779`:

- normalized concrete/team-only defensive-alignment violations;
- first-post-pitch infielder-touch facts;
- deterministic natural-play advancement analysis;
- NPB 2026 5.02(c) penalty resolution for play-stands, offense-choice, and ball/dead-ball branches;
- profile-aware `resolveDefensiveAlignmentViolationPenaltyForMatch` with explicit rejection of unsupported policy ids;
- shared Core API exports for the alignment-penalty foundation.

TDD checkpoints:
- `4f92d2b64069f677a4ca06b41d49c4837fed1372` added the profile-aware RED fixture;
- `aa6ee8e775470163e07cae4b17a770d8393732e7` implemented the RuleProfile-aware resolver;
- `69b927c5dd4f868fada0bffc2e6776e024a5ed7c` added Core API exposure requirements;
- `259c0dface31e5615f267fb453bad57a85bcd779` exported the penalty modules through Core.

Repository CI:
- P0 Core run `35312921359` for HEAD `259c0dfa...` failed before any workflow command executed;
- job `105498472963` reports `steps=[]`;
- therefore this phase does not claim full-repository GREEN.
