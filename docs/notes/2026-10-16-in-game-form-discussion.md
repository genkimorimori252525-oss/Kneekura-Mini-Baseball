# 隠し「流れ」／試合中調子 — 2026-10-16 Discussion Record

> **Status:** USER IDEA + ASSISTANT ANALYSIS / **DECISION NOT FROZEN / NOT AN APPROVED IMPLEMENTATION PLAN / NOT IMPLEMENTED**.
>
> This note exists so a future AI **finds** the fourth conversation topic without falsely presenting it as the fourth finalized implementation plan. Before code, reconcile canonical Condition/Psychology/Team Mood and obtain a specific design decision.

## User-intended experience (from this conversation)

- A hidden, small, **within-game four-stage form** would change subtly as the match unfolds.
- User's proposed cues include a pitcher retiring the side in order (**三者凡退**) and several other distinct baseball moments where “the flow turns.”
- It should be **separate** from existing more influential **pre-game condition** (user describes “1〜4 + 絶好調・スランプ”). Within-game changes should be **much smaller** than pre-game condition and not normally visible in the normal UI.
- This is meant to make baseball's evolving rhythm believable, not for the player to micromanage.
- The user did **not** approve any numerical coefficients, automatic +1 for a specific outcome, memory-decay thresholds, exact bonus percentages or a team-wide multiplier.

## What the prior assistant proposed (not approved as final spec)

The preferred conceptual direction is **In-Game Form** as small observed changes in release/contact timing, execution reproducibility and technical adjustment, while “流れ” is the spectator's *derived description*, not a hidden team-wide luck meter. Possible catalysts: three-up-three-down, three consecutive strikeouts, escaping bases loaded, hard contact despite an out, or repeated strongly hit balls that prompt the pitcher to notice mechanical problems.

The **cause of perceived success** matters: three-up-three-down due to weak swings by a batter is not necessarily new pitching precision. Subjective confidence/pressure may update Appraisal; technical execution should only change if physical or learned execution sources actually change. One success should not automatically alter all teammates' hidden contact ability.

These are illustrations, **not** mandatory event-to-grade rules. No timer/counter is frozen.

## Conflicts requiring a genuine future design decision

1. [Trait seed 08, §15.12 and §15.21](../game-design/08-player-traits-design-seed.md) currently says initial `Condition = 1..5`, with 1 very good and 5 very poor. It describes actual short-term condition as exercise/body/technique/repeatability. The user's newer verbal description uses pre-game 1..4 plus named extremes. **Do not silently rename, remap or replace canonical state until the exact layers are reconciled.**
2. [Psychology 05](../game-design/05-psychology-emotion.md) freezes the rule that untriggered ordinary emotions have **no match-performance effect**. Only an actual `ActiveEmotion` threshold can affect performance/decisions from emotional pressure. A hidden normal “flow” stage cannot smuggle small emotional buffs around this gate.
3. [Trait seed 08 §15.36](../game-design/08-player-traits-design-seed.md) forbids double-applying Condition, CurrentFatigue, WorkCapacity/Stamina, Recovery. A “fatigue worsens condition worsens pitching twice” implementation is invalid.
4. [Team Mood 37/38](../game-design/37-team-mood-architecture.md) treats routine team feeling as no meaningful direct match effect; only extreme psychological/social state may influence Appraisal, communication, role decisions, not raw offense/defense stats. A normal team-wide “momentum +5%” conflicts.
5. [Development 53](../game-design/53-player-development-trajectory-breakthrough-v1.md) discusses success as a possible catalyst for longer career learning (e.g. three strikeouts may provoke a new hypothesis). Do not apply that career growth instantly as a new within-game buff.

## Safe next design task, if the user requests this as a new plan

- Resolve whether the proposed in-game four-stage display is a **derived quantization** of independently modeled short-lived mechanical/rhythm evidence or an entirely separate factor. Prefer one underlying physical source.
- Reconcile named pregame labels and the existing `Condition=1..5` contract without modifying 08 before user approval.
- Define explicit source inputs and evidence provenance for each eligible moment; `three_up_three_down` may cause Appraisal or mechanical self-assessment, **never** automatic luck/velocity/contact buff.
- Separate **pitcher skill adaptation, batter timing adaptation, confidence Appraisal, ActiveEmotion, fatigue and Team Mood**. Do not create self-reinforcing loops.
- Ensure within-game effect remains smaller than pre-game by justified, calibratable bounds on **intermediate execution variables**, not directly on strikeout/batting outcomes.
- Test same event with different underlying evidence, positive/negative/no form change, different pitchers, unchanged physical state, long multi-game decay, tied game and context, and no emotion-trigger circumstances.
- Preserve user-facing invisibility of ordinary internal numeric form, while respecting existing requirement that a genuinely active emotional change must show its valid icon. Developer trace may expose causal state without altering Core.
- Create a **separate** implementation plan and acceptance suite only after the unresolved choices are explicitly settled.

**Bottom line:** The idea is important and not forgotten. As of this record it remains a **discussion**, not part of the three approved 2026-10-16 implementation-plan files.
