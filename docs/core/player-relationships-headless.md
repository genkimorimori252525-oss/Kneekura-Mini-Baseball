# Player relationships — headless network

Source: approved frozen game-design doc34. No design or UI integration.

`PlayerRelationships` stores directional player-pair affinity, trust and coordination
separately in a career-wide network. Evidence updates use a versioned calibration
policy and preserve shared-success and conflict memories across seasons. A single
source event can be observed in both directions, but cannot be counted twice for the
same ordered pair. Coordination changes only for authenticated joint practice or
joint execution evidence.

The host authenticates evidence source IDs and persists the state/event together.
Low affinity alone does not lower batting skill, and the network provides no ability
or direct win modifier. Club-specific active/dormant coordination, social diffusion,
team mood, and calibrated Team Traits remain separate consumers.
