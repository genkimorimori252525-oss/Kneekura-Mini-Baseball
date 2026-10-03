# Owned scheduled field throw

**Approved scope:** Continue checkpoint §5 and World-first runtime06 §9 with actual durable physical work. The existing completed throw already admits the model, receiver and motor commands; this slice allows its transfer to be paused and resumed before the derived release.

**Architecture:** Add a Core prepared throw lifecycle, while retaining the existing completed-throw API and bytes. Extend the single Native field-execution owner with admission and bounded advancement. Preserve the original start, transfer due tick, accepted command coverage and stable RNG key. Store generated/adopted release or interruption receipts atomically with actual cursor and source-specific work/queue. Do not introduce a competing owner or a complete-play registry built from incomplete contributors.

## Invariants

- Pending plans are future work, never physical history. Only executed spans enter field/base/whole-play observations
- Pre-release progress follows actual accelerated carried geometry. Earlier or exact-time collisions interrupt; no release is fabricated
- A checkpoint past release processes the actual release boundary once, then hands off to real field ball continuation
- Reopen/resume cannot restart transfer or reseed from an advance identity
- Coverage is explicit; no extrapolation beyond admitted commands
- While transfer is pending, incompatible motion/acquisition/throw mutations reject. Observations remain physically neutral
- Source-specific event status does not certify whole-play settlement, actor disposition, legal terminal state or PlayEnd
- No new calibration constants, inferred foul/bunt/legal policies, UI/Presentation, home CI, workflow/config/lock changes

## TDD sequence

- [x] Core: prepare original plan; RED→GREEN before-release, resumable transfer, exact release/interruption, zero-delay and coverage/tamper tests
- [x] Native: admit→bounded advance→reopen→release, immutable retry and original model/Player/receiver/seed bindings
- [x] Project only actual progress into base/race/whole-play histories; retain pending transfer separately
- [x] Source-specific physical work/event receipts with atomic release-to-ball handoff; no caller watermark or completion fields
- [x] Native WAL/currentness, bounded future replay and competing-owner regressions
- [x] Focused regression, typecheck and independent review
- [ ] Reconcile the final cumulative Source whole gate before completion claims
- [ ] Publish a stacked Draft PR with precise completed behavior and remaining whole-play/controller/Career dependencies

## Remaining dependencies

Acquisition scheduling, actual ball/rule/perception/decision contributors, causal actor settlement, competition/venue policy and scoring/workload remain separate. Reuse the existing owners when their genuine input evidence becomes available. A stationary actor, secure glove, elapsed horizon or correct first-base result does not close the play.
