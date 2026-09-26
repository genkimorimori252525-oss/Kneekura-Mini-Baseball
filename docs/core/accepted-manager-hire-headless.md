# Accepted manager hire — headless transaction

Sources: approved frozen game-design docs 42 and 49. No design or UI integration.

`applyAcceptedManagerHire` requires an open-season vacancy, a club-specific
candidate estimate reference, a signed offer and the manager's matching acceptance.
It replays the club change and verifies that one transaction records the staff-wage
commitment and manager role link, with all causal IDs cited. The associated wage
schedule must allocate the offered salary in each contract season and reconcile
exactly with the signed liability. Player payroll queries exclude staff wages;
staff allocations use the coaching budget. A salary commitment must fit the
current coaching budget. The club estimate is historical observed
evidence, never a true-skill oracle; the estimate and acceptance owners authenticate
their source records before calling this function.

This validates an agreed hire. Candidate discovery, comparison, negotiation,
rejection, firing, annual staff-wage settlement and the dynamic manager career
pool remain separate work. The host persists club state and the hire event together.
