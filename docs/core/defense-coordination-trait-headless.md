# Defense coordination trait — headless pair projection

Sources: approved frozen game-design docs 34 and 35. No design or UI integration.

`deriveDefenseCoordinationTrait` considers an active club pair in one defensive
joint task. Both directions need recent joint evidence. The weaker of their two
task coordination states determines a Red, Blue or Gold descriptor under a
versioned threshold policy. A missing task edge, one-sided evidence, a departed
player, or stale evidence produces no descriptor. The result retains the source
event IDs and is eligible for revalidation across seasons.

The descriptor does not alter fielding ability, grant a win modifier, or replace
the underlying task state. Actual ambiguous-play behavior and the broader 15
causal family lifecycle remain separate work. Thresholds and evidence windows
need long-run calibration.
