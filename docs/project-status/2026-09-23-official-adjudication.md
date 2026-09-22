# 2026-09-23 — Official adjudication and closure

Base: PR43 `384945b725e81b6751033edb712b77929cd5204b`.

This slice implements the post-physical adjudication boundary as a separate append-only ledger.

Implemented:

- physical PlayEnd remains separate from official closure;
- revisioned replay-validated adjudication events;
- monotonic correct-rule evidence snapshots;
- appeal/review/challenge window records;
- on-field calls that may differ from correct rule truth;
- review confirmation/stands/overturn without rewriting prior calls;
- stale call/review detection after newer correct-rule evidence;
- OfficialPlayClosure only when every recorded official-state window is closed;
- official MatchState delta derived from final ruling;
- durable live-ball MatchState derivation only after closure;
- hostile-input/replay tampering checks;
- public adjudication API seam.

Checkpoint `9e87bf6` native run `35792546764` passed **306 files / 2,453 tests**, including 9 ledger behavior tests + 4 integrity tests + the public seam, with frozen P9 fingerprints unchanged.

Author self-review only; no independent reviewer agent is available in this harness.

Still outside this slice:

- actual RuleProfile-specific appeal/review/challenge availability rules;
- appeal attempt orchestration/provenance generation;
- direct durable MatchState application for non-live walk/strikeout/HBP closures;
- official scoring classification;
- persistent exactly-once/atomic storage transaction;
- next-play activation fence/orchestrator;
- UI/design/rendering.

Final exact-head verification is recorded in the stacked PR after the evidence workflow completes.
