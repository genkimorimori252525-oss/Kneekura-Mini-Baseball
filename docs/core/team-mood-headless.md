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
win probability. Season carryover, extreme-state gameplay gates, manager intervention,
conflict severity and Team Trait projection remain separate work.
