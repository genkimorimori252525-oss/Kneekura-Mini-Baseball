# Team Trait analytic descriptors — headless

Sources: approved frozen game-design docs 34 and 35. No design or UI integration.

`deriveTeamTraitAnalyticDescriptors` uses official game results checked against
official standings. It emits only `ANALYTIC_DESCRIPTOR` records for unusually
positive/negative offense-pitching alignment, repeated strong run prevention
without enough support to win, and repeated high run support lost to high runs
allowed. Each record keeps the official application IDs and a versioned policy.

The alignment comparison reuses `TeamSynchrony`'s independent pairing residual.
Minimum evidence counts, run thresholds and residual thresholds are calibration
inputs, not claims that all leagues share one numeric rule. No descriptor grants a
causal Team Trait, match modifier or ability change. The 15 causal families and
their source-state lifecycle remain separate work.
