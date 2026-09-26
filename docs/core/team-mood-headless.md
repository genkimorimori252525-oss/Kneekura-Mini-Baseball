# Team mood — headless social state

Source: approved frozen game-design doc37. No design or UI integration.

`TeamMood` maintains confidence, cohesion, energy, tension and role harmony for the
assigned roster. A calibrated appraisal signal first affects its player. Other players
receive a bounded share only through their directional affinity/trust toward that
player in `PlayerRelationships`, adjusted by their own susceptibility. Isolated
players do not instantly move the whole team. Each axis drifts toward its pinned
baseline as days pass; an influential player's absence does not delete already
diffused state.

The appraisal owner must authenticate source IDs and determine the signed signal
from actual events, expectations and personal context. The host must persist the
returned state/event atomically. This state never modifies raw ability or direct
win probability.

`openTeamMoodSeason` replays the club's `OPEN_SEASON` command from a closed
club snapshot and requires an opening-day roster snapshot. A versioned,
season-specific policy carries each retained player's deviation from the previous
baseline toward the next baseline; new players start at the next baseline and
departed players leave the aggregate. The caller calibrates axis-specific retention:
Energy should largely reset, Confidence partly persist, Cohesion retain the most,
and Tension decay unless unresolved conflict is separately evidenced. Rates are
not fixed by the design. The host authenticates the closed club/roster snapshots
and persists the season event with the new state atomically. Role changes and
unresolved conflicts require their own source-state evidence.

Extreme-state gameplay gates, manager intervention, conflict severity and Team
Trait projection remain separate work.
