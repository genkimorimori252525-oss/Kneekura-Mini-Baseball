# 2026-09-23 — Non-live official durable application

Base: PR45 `b0ff6ec0cd7408942ce455f748b5064a97ced140`.

Implemented strikeout and walk through:

`terminal timeline -> OfficialPlayClosure -> official MatchState derivation -> durable application receipt -> next active timeline`.

No new strikeout/walk rules were written; existing MatchState transition helpers remain authoritative.

Self-review found a non-live-specific causality hole: because these ledgers use `playEnd: null`, an OfficialPlayClosure could be timestamped before the terminal pitch event. RED run `35843366830` failed exactly the new chronology regression while 2,469 existing tests passed. Commit `f23ed88` added the minimal closure-vs-timeline check; GREEN run `35843657282` then passed **311 files / 2,470 tests** with P9 fixed fingerprints unchanged.

Still excluded:
- HBP/other non-live terminal types;
- RuleProfile-specific appeal/review/challenge policy;
- actual appeal attempt generation;
- official scoring;
- persistent exactly-once storage;
- UI/design/rendering.

Final exact-head verification is recorded in the stacked PR after evidence-workflow publication.
