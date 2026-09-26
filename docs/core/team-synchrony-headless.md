# Team synchrony analysis — headless

Source: approved frozen game-design doc34 section 29. No design or UI integration.

`analyzeTeamSynchrony` checks one club's official game results against its season
standings row. It compares actual wins, counting a tie as half a win, with the exact
expectation from pairing every scored-runs value with every allowed-runs value in that
season. The returned residual is an integer numerator and denominator in wins; no
sampling or random seed is used. The analysis is season-local and has
`scope: DESCRIPTOR_ONLY`.

This result can explain whether offense and run prevention aligned on the same days.
It cannot change Match Core, ability, future win odds, mood, or a Team Trait by itself.
Named Trait thresholds and historical interpretation require separate calibrated
policies and source evidence.
