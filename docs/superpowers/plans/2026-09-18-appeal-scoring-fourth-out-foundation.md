# Appeal Scoring and Advantageous Fourth-Out Foundation Plan

**Status:** IMPLEMENTATION COMPLETE; full repository CI remains blocked before workflow steps start.

**Goal:** Resolve inning-ending tag-up appeal scoring with runner precedence and support an advantageous apparent fourth out without collapsing appeal outs into generic time plays.

## Rule basis

Current Official Baseball Rules require two special behaviors beyond ordinary time-play scoring:

- a third out on appeal against a **following** runner can behave as a time play for a preceding runner who already touched home;
- if the inning appears to have ended but another appeal on the same play is sustained, the appeal decision can take precedence as an apparent fourth out; when multiple appeals are available, the defense may elect the advantageous out;
- a run cannot count when the effective third out is an appeal out against that scoring runner, or when the effective third out is an appeal out against a **preceding** runner for a base/tag-up violation.

This phase is intentionally scoped to sustained tag-up appeal outs. Generic missed-base appeals remain later work.

## Architecture

```text
play-start BaseOccupancy + batterRunnerId
        ↓
RunnerPrecedence
(origin rank: batter=0, first=1, second=2, third=3)
        +
home-touch facts
        +
sustained tag-up appeal out
        ↓
AppealOutScoring
        ↓
scored / suppressed runs for that effective inning-ending out

apparent inning-ending out option
        +
zero or more later sustained appeal-out options
        ↓
AdvantageousFourthOut
        ↓
minimum-runs scoring result
+ all equally advantageous out options
```

## Permanent constraints

- Higher play-start origin base means **preceding** runner for this caught-fly/tag-up foundation.
- Runner precedence is rule metadata; it does not alter physical movement.
- A sustained appeal against the scoring runner suppresses that runner's own run regardless of appeal timestamp.
- A sustained appeal against a runner **preceding** a scoring runner suppresses that following runner's run regardless of timestamp.
- A sustained appeal against a **following** runner uses time-play ordering for a preceding scorer: home touch strictly before appeal out may score, strictly after does not, equal tick remains unresolved.
- Apparent fourth-out selection optimizes the rule consequence (fewest counted runs), not physical event chronology.
- If multiple options are equally advantageous, Core preserves all tied options instead of inventing an arbitrary winner from array order/serialization sequence.
- Only already-sustained appeal outs enter fourth-out evaluation. Appeal timing/validity remains the responsibility of `TagUpAppealRule`.
- This phase creates Correct Rule Result only. Human umpire call and official appeal-choice presentation remain downstream.

### Task 1: Runner precedence

Create `RunnerPrecedence.ts`.

Input:
- play-start `BaseOccupancy`;
- batter-runner id.

Output:
- immutable runner origin records for virtual base 0 and occupied bases 1..3.

Functions:
- lookup by runner id;
- compare two runners -> `preceding | following | same`.

Tests:
- runner from third precedes runner from second, first, and batter;
- runner from first follows runner from third;
- duplicate ids rejected;
- unknown runner comparison rejected.

### Task 2: Sustained tag-up appeal scoring

Create `AppealOutScoring.ts`.

Input:
- runner precedence;
- sustained `TagUpAppealResult.kind === 'out'`;
- home-touch facts.

Per home-touch runner:
1. same runner as appealed runner -> suppressed;
2. appealed runner precedes scorer -> suppressed;
3. appealed runner follows scorer:
   - home tick < appeal out tick -> scored;
   - home tick > appeal out tick -> suppressed;
   - same tick -> simultaneous unresolved.

Return:
- effective out;
- scored;
- suppressed;
- simultaneous.

### Task 3: Advantageous apparent fourth out

Create `AdvantageousFourthOut.ts`.

Input:
- two or more inning-ending scoring options already evaluated:
  - the apparent third-out option;
  - any later sustained appeal options from the same continuing appeal window.

Behavior:
- compare counted-run totals;
- minimum counted runs = defensive advantage;
- return all tied advantageous options;
- if any candidate has unresolved same-tick scoring, do not silently rank it against resolved candidates; return `unresolved` until that candidate is adjudicated.

Acceptance:
- apparent third out is appeal at first on runner from first after runner from third scored -> one run counts;
- later timely sustained appeal at third on the scoring runner -> zero runs;
- advantageous fourth-out evaluator selects the zero-run consequence.

Tie companion:
- two appeals both suppress the same runs -> preserve both as tied advantageous candidates.

### Task 4: RuleEngine integration boundary

Add helpers to:
- convert sustained `TagUpAppealRule` outs into appeal-scoring options;
- evaluate fourth-out alternatives without mutating physical facts.

Do not yet implement defensive AI deciding whether to request a second appeal; Core only exposes the rule consequence.

### Task 5: Core API + local verification

Export precedence/scoring/fourth-out foundation from `src/core/index.ts`.
Run local TypeScript/runtime fixtures.
Retry P0 Core CI; do not claim full repository GREEN while Actions jobs still fail before steps.


---

## Implementation Evidence

Implemented through HEAD `9dc3b2ff33d4750d7b5ea8e2a7fb7b8ada45199a`:
- immutable play-start runner precedence metadata;
- precedence-aware sustained tag-up appeal scoring;
- appealed runner's own run suppression;
- preceding-runner appeal suppression of following-runner runs;
- following-runner appeal handled as a time play for preceding scorers;
- exact same-tick scoring preserved as unresolved;
- advantageous apparent fourth-out evaluator minimizing counted runs;
- tied advantageous options preserved without array-order tie breaking;
- unresolved scoring options block automatic advantageous selection;
- generic support for a normal apparent third out followed by an appeal fourth out;
- RuleEngine adapters for normal third-out and sustained-appeal scoring options;
- shared Core API exports.

Independent verification:
- TypeScript 5.8 local source-level rules typecheck: success;
- appeal-only fourth-out runtime fixture: success;
- normal time-play third out -> later appeal fourth out runtime fixture: success;
- example consequence: apparent third out leaves 1 run; later appeal against scoring runner yields 0 runs and is selected as advantageous.

Rule basis verified against current official material:
- appeal decisions can take precedence over the apparent third out in the same inning-ending play;
- multiple inning-ending appeals permit the defense to elect the advantageous out;
- runner precedence matters for appeal-scoring exceptions.

Repository CI:
- P0 Core run `35307181500` at HEAD still failed before workflow steps were created;
- full repository GREEN remains intentionally unclaimed.
