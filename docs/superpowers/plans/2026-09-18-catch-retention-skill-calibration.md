# Catch Retention Skill Calibration Plan

**Goal:** Let catching ability influence secure-possession tolerance and settling speed through explicit calibrated physical parameters, without changing incoming ball energy and without adding direct catch probability.

**Source:** Approved catching design says catching ability acts on secure-possession tolerance and impact/spin tolerance rather than direct success percentage. Existing `CatchRetention` already resolves success/failure deterministically from contact energy, pocket centering, body stability, and retention capacity.

## Architecture

```text
base CatchRetentionParameters
        +
catching ability [0,1]
        +
external skill calibration
        ↓
SkillAdjustedCatchRetentionParameters
        ↓
existing evaluateCatchRetentionLoad / resolveCatchRetention
```

## Permanent constraints

- Incoming translational/rotational energy is physical truth and must not change with player ability.
- Skill may alter effective retention capability, not ball velocity/spin truth.
- No `catching -> success %`.
- Numerical multiplier ranges are caller-supplied calibration; Core does not hard-code player outcome widths.
- Same contact + same base parameters + same ability always yields identical adjusted parameters.
- Higher ability is monotonic when calibration endpoints are monotonic.
- Equipment/base glove parameters remain separable from player skill.
- This phase adjusts:
  - centered retention capacity;
  - capture-energy dissipation power.
- Separate spin-specific tolerance remains explicit future calibration rather than being hidden inside a probability roll.

### Task 1: Pure skill parameter derivation

Create `CatchRetentionSkill.ts` + tests.

Calibration:
- low/high ability multiplier for `centerRetentionCapacityJ`;
- low/high ability multiplier for `captureDissipationPowerW`.

Derive a new immutable parameter object.

Tests:
- ability 0 and 1 hit calibration endpoints;
- interpolation is continuous;
- physical constants and failed-contact coefficients remain unchanged;
- input object is not mutated;
- invalid ability/calibration is rejected.

### Task 2: Retention integration

With identical contact:
- `translationalEnergyJ`, `rotationalEnergyJ`, and physical `retentionLoadJ` stay identical;
- higher calibrated ability raises effective capacity;
- if both contacts retain, higher dissipation power secures at the same or earlier authoritative tick;
- a boundary fixture may naturally flip from live-ball to secured because capacity changed, with no random draw.

### Task 3: Core API and verification

Export the derivation through `src/core/index.ts`.
Run local source/type/numeric verification.
Retry P0 Core CI; only claim full repository GREEN if GitHub Actions actually creates steps and completes.
