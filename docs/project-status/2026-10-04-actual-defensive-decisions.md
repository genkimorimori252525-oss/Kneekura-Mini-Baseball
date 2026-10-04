# Actual individual defensive decision receipts

## Implemented boundary

Native can import one immutable contextual defensive priority plan per physical pitch and defender, then own one individual decision process and its pending/issued receipt chain. This is an additive observation-to-intent seam. It neither advances physics nor supplies motor commands, team assignments, actor settlement, official scoring or PlayEnd.

The accepted plan's provenance is `accepted_at_actual_observation`. The owner requires that designated actual observation and its physical dependencies to be current for a new import, and derives its availability from that receipt. The priorities reuse the existing Core `PrePlayDefensivePlan` shape; the import does **not** assert that pre-play planning was executed or that the priorities were known before the pinned actual receipt. They remain separate from immutable Player ratings and decision calibration.

Each decision Source names its original physical pitch, Player, actual observation, exact Player decision model, exact contextual plan and predecessor. Native reconstructs these dependencies on its own SQLite connection and checks original career, Person link, fielding model, game day, defender identity and observation lineage. There is no caller-supplied clock, candidate, confidence, target, outcome, semantic cue or contextual outs/base state.

## Choice and coordinates

The additive Core input seam accepts an unknown/null known context and identity-only self without changing legacy candidate/choice/timing behavior. Current Core candidate generation consumes no self position. The receipt records `identity_only_no_position_consumed` and the defender's original registered position; no body-primitive center is represented as a Player root.

The owner supplies the actual receipt's perception, explicit priorities and pinned calibration to existing Core candidate generation and selection. Initial actual communications and semantic cues are absent. Only perceived-ball pursuit and hold can result. A pursuit target is copied from the selected receipt's perceived ball estimate, never from canonical ball coordinates. A hold has no movement target and does not settle the actor. Legacy `pre_play_plan` evidence labels become `accepted_contextual_priorities` in the receipt to preserve the import's actual provenance.

## Exact availability, evidence age and lifecycle

The original supporting sample time is retained separately from the new receipt's availability. Remembered ball evidence cannot backdate new cognition.

The scheduling basis is the **least safe integer boundary whose relative time is at or after the exact observation availability**:

`(boundary - originTick) / ticksPerSecond >= elapsedSeconds`

A bounded integer search uses this comparison directly. It does not trust an effectively rounded observation tick, add a tolerance or rely on multiplying/ceiling floating-point time, which can accidentally add a tick even at an exact authoritative boundary. Safe nonzero/near-maximum origins are supported; an unrepresentable boundary is rejected. This is an explicit integer scheduling convention, not a new sensory-latency calibration. Current observations still use instantaneous capture.

Existing decision-delay and first-step-delay functions independently consume the pinned situational-awareness and first-step ratings. The receipt distinguishes:

- `pending_decision`: cognition deadline not yet reached
- `pending_first_step`: cognition complete, first-step eligibility deadline not yet reached
- `issued`: the owned observed physical horizon has reached motor eligibility

A later Source must reference a genuinely later observation in the original observation lineage and exact physical clock, with the original model/plan. It advances the original process without reselecting the candidate, moving the perceived target, restarting deadlines or changing evidence age. Two different exact physical instants can share a quantized tick and still remain before the eligible boundary. Re-reading or retrying a Source is immutable; a new successor after issuance is rejected. Replanning or later independent decisions require a separately owned policy and are not supplied here.

`issuedAt` records the actual later observation moment that established eligibility, not a fictional execution at a prior deadline. No receipt means that a body, glove, ball, base contact or official result actually changed.

## Persistence and current/historical reads

The plan is an immutable per-pitch/per-Player baseline. Decisions are an additive per-pitch/per-Player chain with an explicit head. New writes require current observation/physical dependencies and the current own predecessor. Original input, derived receipt and dependency hashes are checked before and inside `BEGIN IMMEDIATE`, then the saved row, dependency state and own head are revalidated before commit.

Ownership queries cover index, Source and snapshot mirrors, pinned original observation metadata and decision-history ownership. Valid future Source/snapshot **identity metadata** is checked against the complete indexed chain, but future receipt payloads are not parsed into domain inputs or executed when reading an earlier revision. An opaque/unreadable future payload cannot become evidence for the older receipt. Gaps, foreign pointers, moved heads and hidden duplicates are rejected. Immutable retries re-read the original after the authority callback.

This slice depends on the separately repaired fielding/observation model owners' full identity/snapshot mirror checks (PR268); it does not duplicate or rewrite those owners. Existing physical, observation and official archives remain unchanged by plan/decision acceptance.

The metadata follow-up uses shared duplicate-preserving SQLite node enumeration for plan/decision and contextual observation discovery. SQLite's first-key lookup cannot silently disagree with JavaScript's last-key parsing: all configured ownership occurrences participate in discovery, and relevant rows reject duplicate keys/containers or wrong container types. Decision history and identity mirrors use typed scalar metadata tuples; an object-shaped array or string-encoded Source is not accepted as history. Future view, candidate and scheduling payloads remain opaque, and unrelated foreign partial/opaque rows are not globally validated. The correction is scoped to these consumers, with the original observation owner repaired separately; it is not a claim that every SQLite archive reader has been changed. Source/receipt serialization and valid archive bytes are unchanged.


## Verification and remaining dependencies

Focused tests cover current import availability; inert/closed input scope; perception-only pursuit/hold; independent rating delays; remembered evidence; exact and near-safe-clock boundaries; same-tick exact instants; pending preservation and one-time issue; immutable retries/reopen; bounded historical payloads with complete metadata; hidden identity/history mirrors; and WAL pre-BEGIN, inside-BEGIN and postinsert rollback.

No production calibration values are introduced. Test fixture priorities, collision timing, observation noise and delays are explicitly synthetic.

Actual motor adoption still requires owned movement/reach policy, exact root/relative-pose reconstruction, retained pending-acquisition rules, and complete ten-Player × five-primitive command coverage. This owner supplies none of those commands and cannot fill missing actors with zeros. Actual semantic communication, explicit replanning, autonomous perception-only throws, registry/watermark closure, all actor dispositions and true PlayEnd remain separate dependencies.
