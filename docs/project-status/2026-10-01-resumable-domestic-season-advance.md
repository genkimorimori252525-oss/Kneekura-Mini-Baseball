# Resumable domestic season advance — 2026-10-01

## Approved scope

Current foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, frozen documents11/14/15/18 and existing Core/Native owners. All confirmed nonvisual work is user-authorized. Design, Presentation, archived plans and merges are excluded.

## Implementation

- `SqliteClubSeasonTransitionStore.applyBatch` adopts distinct member boundaries in one Career in a single SQLite transaction. All independently accepted Sources are read and detached before any head write. Failure at a later member rolls back every head/event/application/snapshot. Exact original retries survive later seasons and reopen without a live authority.
- `SqliteDomesticSeasonAdvanceStore` archives an exact independently accepted request before side effects. It consumes the actual Native completed domestic championship reader, original Club history and accepted World cycle. It validates complete membership, exact League/edition identity, each existing Core CLOSE/OPEN plan, unchanged-profile game volume, previous actual last regular-game day and generated calendar/standings/event profile. It accepts no caller current Club state.
- The saved request supplies immutable boundary Sources to the existing Native Club owner. The atomic Club phase precedes the existing World-bound domestic initializer's World/schedule/event writes. Pending progress resumes missing stages from the original archive without a live advance authority. Different advance identities cannot own the same previous or next edition.
- Pending and completed reads validate saved request/child Sources, the actual previous competition and original generated calendar. Completed reads also validate every accepted Club transition and current calendar/archive/event evidence; legitimate later games, revisions and Club seasons do not rewrite the original result.
- A reviewed World-only interrupted-stage gap was reproduced and fixed: its World schedule is compared against the original generated schedule before Club writes, even if the archive is missing. With an archive, accepted revisions determine the current expected schedule. Enqueue also checks already existing stages. An unchanged calendar profile cannot silently rewrite official game volume.

## Evidence

Separate batch/missing-module RED, cross-connection Source-phase lock RED, profile-volume RED, World-only stage RED and official chronology RED were captured before their corresponding changes. Typecheck/catalog compilation succeeded.

The actual Native connection gate uses frozen `league-006`: 4 Clubs, 108 regular games per Club (216 actual Native official finals), and the first 3 decided games of its approved best-of-five championship. No mocked championship projection or claimed caller results are used. Explicit near-final Match fixtures test official persistence/competition progression; they do not claim full autonomous Match play or production calibration.

The gate rejects unfinished championship, incomplete membership, incorrect League/closing reference/currency, stale member, insufficient dates, unchanged-profile volume changes and a boundary before the actual League's final regular game. It injects failure at the second member, retains pending progress with all original heads, rejects changed accepted Source, then injects event-phase interruption after World/schedule adoption. Reopen without authority completes the missing event stage; later Club seasons retain original progress. A damaged result fails replay. Numeric fixture days retain their original explicit Career-day anchor; the next World-bound calendar preserves the actual WBC reservation.

One fresh read-only reviewer found one Important issue in World-only schedule validation. The reproduced issue was fixed and the same reviewer confirmed no remaining Critical/Important/Minor findings. Independent gates passed 2 files / 5 tests in 24.35 seconds. Final parent gates after all fixes passed 5 files / 12 tests in 30.36 seconds; final typecheck/catalog compilation passed. Whole `npm run verify` passed 529 files / 3,141 tests in 1,026.75 seconds.

Published stacked PR234 on PR233, commit `ac8fba88a666aa5dc3c211431ce59d110104a7f9`. P0 run36840342634 succeeded at this exact SHA. App attachment was attempted once and rejected by its 100-attachment cap.

## Remaining approved work

This progress owner requires independently accepted next plans and roster/fanbase summary references. It does not invent competition winners, budgets, population/physical profiles, fanbase evidence, sleep/rest or a complete autonomous Career/game loop. Actual Source generation, population/calibration and physical/runtime consumers remain in the active overall goal.
