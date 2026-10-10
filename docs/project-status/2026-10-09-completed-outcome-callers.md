# Completed-game outcome callers

This closes the caller connection for original nonvisual checkpoint §5 area 9.
The completed-Match attribution owner remains
`SqliteOfficialPlayerOutcomeStore.applyCompletedGame`; completion drivers now
invoke it through an injected `outcomes` owner instead of requiring callers to
submit every completed game separately.

## Domestic completion

The physical, actual-live, released same-PA and completed-foul adapters in
`DomesticSeasonRuntime` deliver outcomes after their existing durable World
settlement, before the outbox completion CAS for new requests. Their returned `playerOutcomes` includes the original game's
per-play outcome results and explicit aggregate coverage. The original final,
including its fixture, must exactly equal the outcome owner's authenticated
final.

New requests persist `outcomeDelivery = required_completed_match_outcomes_v1`
inside the existing request JSON. If outcome delivery throws, World effects may
already be durable but the same outbox entry stays PENDING. Both existing
`listPending` arms can discover it after reopen; `resume` replays the existing
World operation and required outcome owner before marking completion. Reopening
without that owner returns `outcome_authority_missing` and retains PENDING.
Delivered partial/unsupported coverage is an honest completed delivery, distinct
from an exception or missing required owner. Financial effects and workload are
not reapplied. No second journal is added and the table format is unchanged.

Legacy requests without that commitment and all stored World result bytes stay
unchanged. Previously completed legacy entries are not silently rewritten or
re-enrolled. Those entries support explicit idempotent outcome delivery through
the completion adapter; an outcome failure on that compatibility path does not
create a pending scan entry. No automatic recovery is claimed for that case.
`readCompletedDomesticSeason` remains read-only.

## National completion

`completeWorldBoundWbcFinals` delivers the existing knockout evidence's group,
round-of-16, quarterfinal, semifinal and final results after historical/ranking
settlement. `completeWorldBoundWbcQualifier` delivers the pod evidence's semifinal
and final results after qualification history, hosting history and berth
settlement. Selection comes from those existing `readEvidence` contracts.

The established contracts contain 51 finals games and 12 qualifier games. No new
schedule or participant selection is introduced. Original National identities
are passed unchanged to the outcome owner, which already authenticates National
participant bindings. Qualifier outcomes retain the qualifier edition ID, rather
than borrowing the eventual WBC finals edition ID.

Every outcome write receives a fresh competition read phase and invalidates an
enclosing phase's cached proofs. Explicit retries replay the existing durable
owners. WBC automatic restart discovery remains unimplemented: both existing
`readEvidence` methods require their stored competition outcome first, and no
pending competition-completion owner or drain retains the later player-outcome
step. Reordering these calls alone cannot retain an unfinished competition
transition. No tournament-level outcome journal or background job is added.

## Explicit delivery status and verification

Existing store compositions may omit the outcome owner. Such calls return
`playerOutcomes.kind = unavailable` and `reason = outcome_authority_missing` with
the selected game IDs. New domestic requests remain discoverable as PENDING in
that case. An injected owner is called on first completion and every
retry. Its existing missing/ambiguous/unsupported per-play results remain visible
as `attributed_supported_plays_only`; only full attribution across every selected
game reports `all_official_plays_attributed`. Original evidence corruption or a
different delivered final rejects the call.

Focused author verification: `CompletedDomesticGameSettlement.test.ts` (40 cases)
and `CompletedNationalOutcomeCallers.test.ts` (9 cases), 49 passed in 6.94 seconds.
Domestic cases retain real Native Match/World/outbox ownership while substituting
the original physical and outcome owners. National cases are structural driver
tests with explicit evidence/owner substitutions. They check all six caller
routes, ordering, interruption/retry, missing authority, partial coverage, exact
final/fixture agreement, competition scope invalidation, and incomplete National
competitions. They do not qualify genuine physical or National play production.
The compiler and combined review/selection remain with central integration.

Recovery correction verification: 42 completed-domestic cases, 3 legacy outbox
cases and 9 National caller cases, 54 passed in 8.27 seconds. The four domestic
interruption cases recover through persisted `listPending` → `resume`, including
reopen without the required owner, rather than relying on a manual adapter retry
to rediscover a completed outbox item. Two compatibility cases retain historical
completed legacy request/result bytes and their narrower explicit-retry limit.
