# RuleProfile NPB 2026 Foundation Plan

**Status:** IMPLEMENTATION COMPLETE; full repository CI remains blocked before workflow steps start.

**Goal:** Make the authoritative match explicitly bind to a versioned rules profile and move year/jurisdiction-sensitive rule policy out of implicit Core assumptions.

**Source:** Adopted project decision D-005 requires NPB 2026 as the initial rules profile and requires rules to be version-managed through `RuleProfile`. The 2026 NPB amendments also add/modify rules such as the infield positioning restriction in 5.02(c), demonstrating why the profile must be explicit.

## Architecture

```text
RuleProfileId
     ↓
CanonicalMatchState.ruleProfileId
     ↓
RuleProfileRegistry / resolveRuleProfile
     ↓
RuleContext
     ↓
profile-aware RuleEngine entry points
     ↓
pure low-level rule evaluators
```

Low-level physical/rule primitives may remain pure functions. Public match orchestration must carry a profile and fail on unsupported semantics instead of silently assuming a season.

## NPB 2026 profile policy fields

Metadata:
- id = `npb-2026`
- jurisdiction = `NPB`
- season = 2026
- rulesRevision = `2026`

Tag-up:
- legal release basis = `first_fielder_touch`
- early departure requires appeal = true

Appeal:
- next pitch/play closes appeal opportunity = true
- defense leaving field closes inning-ending appeal opportunity = true
- same-tick appeal/window-close remains unresolved
- advantageous apparent fourth out = defense may elect advantageous out

Third-out scoring:
- batter-runner-before-first suppresses runs
- force third out suppresses runs
- preceding-runner sustained appeal can suppress following runs

Defensive alignment:
- 4 infielders are subject to the pitch-release side restriction;
- minimum 2 infielders on each side of second base at pitch release;
- violation handling policy id = `npb_2026_5_02_c`.

The alignment policy is declared in this phase; detailed penalty execution is a later rule module.

### Task 1: Rule profile identity in canonical match state

Create `src/core/model/RuleProfileRef.ts`.

Add required `ruleProfileId: RuleProfileId` to `CanonicalMatchState`.

Keep the reference compact: replay/state carries the profile id; profile data is resolved from the registry.

### Task 2: RuleProfile + NPB 2026 registry

Create `src/core/rules/RuleProfile.ts`.

Provide:
- `RuleProfile` type;
- `NPB_2026_RULE_PROFILE`;
- `getRuleProfile(id)`;
- `isKnownRuleProfileId(id)`.

Unknown profile ids must fail explicitly.

### Task 3: RuleContext binding

Create `RuleContext.ts`.

Provide:
- `createRuleContext(profile)`;
- `assertMatchRuleProfile(match, context)`.

A match cannot be adjudicated under a profile different from the one recorded in canonical state.

### Task 4: Profile-aware current rule entry points

Add profile-aware wrappers without duplicating physics:
- tag-up compliance wrapper validates `first_fielder_touch` semantics;
- tag-up appeal wrapper validates explicit-appeal semantics/window policy;
- advantageous fourth-out wrapper validates that the profile enables defensive advantageous-out election.

Existing pure evaluators remain available internally/shared for focused tests, but match-level RuleEngine orchestration should use the profile-aware functions.

### Task 5: Core API + verification

Export RuleProfile/RuleContext.
Add API tests.
Run local TypeScript/runtime verification.
Retry P0 Core CI; do not claim full repository GREEN while Actions remains pre-step blocked.

## Deferred

- full 5.02(c) defensive-alignment penalty execution;
- DH/extra-inning/substitution profile differences;
- custom tournament profiles;
- migration tooling for replay files from future profile versions.


---

## Implementation Evidence

Implemented through HEAD `333293fd101717e744d04df1608e309039c1cde0`:
- branded `RuleProfileId` model reference with non-empty validation;
- required `CanonicalMatchState.ruleProfileId`;
- versioned `NPB_2026_RULE_PROFILE`;
- explicit NPB 2026 tag-up, appeal, third-out scoring, and defensive-alignment policy fields;
- profile registry with explicit failure for unsupported profile ids;
- `RuleContext` binding canonical state to adjudication profile;
- profile-aware tag-up compliance, tag-up appeal, and advantageous fourth-out entry points;
- explicit failure on unsupported semantics instead of silently applying NPB 2026 behavior;
- shared Core API exports.

Independent verification:
- TypeScript 5.8.3 strict source-level check of the RuleProfile boundary: success;
- runtime profile resolution: `npb-2026`;
- runtime canonical match/profile binding: success;
- runtime early-departure -> explicit appeal out: success;
- runtime advantageous-fourth-out profile gate: success.

Official 2026 profile evidence:
- NPB 2026 5.02(c) evaluates the four infielders when the pitch leaves the pitcher's hand;
- two infielders must be positioned on each side of second base with both feet on that side;
- violation handling differs based on whether the violating infielder first touches the pitched ball in play.

Repository CI:
- P0 Core run `35311110942` at HEAD failed before workflow steps were created;
- job `105493164348` had `steps=null`;
- full repository GREEN is intentionally not claimed.
