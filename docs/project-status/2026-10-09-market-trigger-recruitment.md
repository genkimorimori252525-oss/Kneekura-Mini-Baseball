# Original market trigger into accepted recruitment

This connects an explicitly accepted calendar association to the existing
persisted recruitment and free-agent contract path. Canonical Foundation
`44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, document 15 §11, assigns the market
notification to Calendar and the actual choice to Front Office. Document 31
§§7.1–9.1 requires decision-time evidence and the actual acquisition authority.

## Existing calendar authority

`SqliteDomesticScheduleStore.marketTriggersOnDay` derives the exact trigger
from the persisted season-event profile and snapshot. The additive
`captureMarketTriggerReference(careerId, trigger)` authenticates that output
against the existing calendar and World season, then returns:

- owner `world_league_season_events` and Career identity;
- the original base-calendar hash;
- the original season-event profile/snapshot hash;
- the exact season, League, window, type, day and policy-version trigger.

The existing schedule/event parsers are shared with the new consumer-connection
reader. No trigger ledger or alternate calendar is introduced. The reference
pins the immutable base calendar and event snapshot; later accepted schedule
revisions remain valid without replacing that original trigger.

## Explicit adoption and actual consumer

An accepted `AcceptedRecruitmentSource` may include `marketOrigin`. Its existing
source ID and decision ID identify the specific associated decision. Equal
dates alone do not add this field. Ordinary sources retain their original
encoding and do not require calendar tables.

Recruitment admission and complete history replay authenticate the reference
on their own SQLite connection, including original Club membership and season
identity. The decision day must be on or after its explicitly adopted trigger.
The existing contract consumer already calls that reader during admission,
retry and historical reads, so the same origin proof reaches actual atomic
Club/roster/wage/rights updates. An earlier market decision also remains checked
when a later ordinary decision is the contract's direct reference.

This is accepted trigger adoption. It does not produce the decision, establish
transaction eligibility, infer bilateral acceptance, rank candidates, choose
BUY/SELL, advance a Career clock or send notifications. Those responsibilities
are not supplied by a calendar event.

## Bounded verification

The initial affected run failed six cases at the absent capture API while the
thirteen existing/ordinary cases passed. After implementation and the complete
history extension, both affected files passed: 20 cases in
`AcceptedRecruitmentContract.test.ts` and 2 in
`SqliteDomesticScheduleStore.test.ts`, 22 total, with no exclusions.

Coverage includes actual calendar output through a signed contract, later
rainout/reopen, changed accepted associations, missing events, future and forged
triggers, same-day ordinary decisions, valid-looking original-snapshot
substitution, both decision and contract INSERT-trigger rollback, and an earlier
market association behind a later ordinary decision. A base-calendar replacement
that leaves the trigger and event snapshot unchanged is still rejected.

Checks used Node 26, one worker, disabled cache, an external cache directory,
a 512 MiB heap and a 35-second wall cap. Full compiler and consolidated review
remain with the parent batch. Private databases and raw receipts are excluded.
