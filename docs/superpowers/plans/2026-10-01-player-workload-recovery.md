# Causal Player workload and recovery

**Approved source:** foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, frozen document14 sections2.4/11/fixed decisions, document32 health/development and document53 actual practice exposure. User authorization covers all confirmed nonvisual implementation. No UI connection, old candidate plans, merges or production calibration defaults.

**Gap:** existing practice exposure consumes caller-supplied fatigue/health values; no production owner derives fatigue from accepted actual workload, travel and recovery. A calendar off-day must not reset fatigue. This slice connects a causal state to the existing real Native pitch-timing learning consumer.

**Architecture:** Core owns immutable Player state and explicit accepted MATCH/PRACTICE effort, TRAVEL distance, RECOVERY hours/quality/medical availability. A complete explicit versioned calibration supplies workload/travel rates and recovery rate. Recovery also consumes the Player's accepted recovery capacity. Bounded finite fatigue is a consequence of activity facts, never a schedule-density/league/win modifier. Missing days do not synthesize rest. Activities advance nonbackdated day and revision.

Native owns an accepted baseline linked to an actual persisted Player Person, immutable activity before/after snapshots, CAS head and replay validation. Policy ID/version is frozen across Players. Transactions persist an activity and its head together; retries return the original state without live activity authority. Replay verifies the complete journal and detects corruption. Exact practice Source IDs bind fatigue from the archived BEFORE state and health availability from that accepted practice. Later same-day/rest facts cannot rewrite earlier exposure. A production helper supplies the existing exact practice bundle shape from those snapshots; it does not add fields to the established learning DTO.

**Verification:** Core causal workload/travel/rest arithmetic, no implicit off-day reset, chronology/scope/overflow/inert input; Native actual Person linkage, persistence/reopen/exactly-once/stale revision/changed Source/corrupt journal/rollback; actual Native pitch-timing learning is suppressed by exhausted practice and accepted after real recovery and fresh practice, with old Source values unchanged. Calibration and physical/match runtime fatigue consumers remain explicit later audit work, not completion claims.

- [x] Add Core RED tests, then implement causal transitions.
- [x] Add Native RED tests, then persist/replay activity state and bind practice evidence.
- [x] Verify actual Native learning consumer, focused tests and typecheck.
- [x] One fresh read-only review (no findings) and whole-suite verification (526 files / 3,131 tests, 657.61 seconds).
- [ ] Commit/push stacked on PR231, attempt attachment once and verify P0 exact SHA.
- [ ] Continue the remaining approved national-pool and full Career/runtime integration.
