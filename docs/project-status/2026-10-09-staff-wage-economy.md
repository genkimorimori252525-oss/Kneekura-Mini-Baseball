# Accepted Manager hire into durable staff wage payment

This continues original area 9 by connecting the existing scheduled staff wage
kernel to actual Club economy persistence. Canonical document 18 §§9–10 keeps
season plans, live cash and commitments distinct. The existing
`club-world-v1-headless-api.md` accounting contract requires authoritative wage
schedules and distinguishes recording a liability from paying it.

`SqliteManagerHireStore` already persists an accepted bilateral appointment,
staff commitment and annual salary schedule. Its additive
`captureStaffWageReference` provides the original application ID and hashes of
the request and saved before/result evidence. Its existing application replay
is shared with a consumer-connection reader requiring actual Native SQLite.
That reader also authenticates the exact original accepted observation prefix;
later observations, including later entries on the same day, do not replace it.

`STAFF_WAGE` now passes through `ClubEconomyOperationDriver`,
`applyClubEconomyBatch` and `SqliteClubEconomyStore`. The existing
`applyScheduledStaffWagePayment` owns the amount, due-day semantics, annual
remainder, receipt identity and accounting event. No payment formula changes.
Staff payments remain coaching expenses and do not become player wage-cap
allocations.

The Native writer requires the actual current wage ledger at admission. Reads
and retries retain its exact original prefix and hiring reference rather than
substituting later evidence. Original Club history, hiring observations,
commitment identity and wage provenance are checked on the writer's connection.
Post-INSERT checks authenticate the captured request bytes and original sources
before commit, so source mutation rolls back the payment and Club journal.
The existing application table, Club CAS and journal remain the persistence
owners. Legacy source serialization is unchanged.

The payroll-run event ID and `AnnualWagePaymentPolicy` remain explicit accepted
inputs. This does not generate payroll runs, choose payment dates, negotiate
contracts or schedule Career work. The new reference currently binds Manager
hires; it does not invent hiring producers for other staff roles.

## Bounded checks

The first new-file run failed six cases at the missing reference API. The first
connected selection passed 22 cases. Final history coverage initially supplied
an invalid structural-revenue capacity revision in its later-event fixture;
binding that fixture to the actual saved revision corrected the setup.

The final selection passed all 24 cases in six files, with no exclusions:

- `StaffWageEconomy.test.ts`: 8
- `SqliteClubEconomyStore.test.ts`: 4
- `ClubEconomyOperationDriver.test.ts`: 4
- `SqliteManagerHireStore.test.ts`: 1
- `ClubEconomyBatch.test.ts`: 5
- `ScheduledStaffWagePayment.test.ts`: 2

The Native cases create a real accepted Manager hire and verify saved cash,
commitment, receipt and journal effects, duplicate-payment rejection, original
source checks during admission/retry/history, hiring and wage INSERT-trigger
rollback, later Club/observation history, reopen and non-Native facade rejection.
Existing Manager fixture construction was moved into shared test support.

Checks used Node 26, one worker, disabled cache, an external cache directory,
a 512 MiB heap and a 35-second wall cap. Full compiler and combined review remain
with the parent integration batch. Private databases and raw reports are excluded.
