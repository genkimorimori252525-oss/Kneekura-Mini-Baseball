# Regional national registered-player Match lifecycle — 2026-10-01

## Scope

The confirmed Regional National Edition and national eligibility/callup/appearance architectures are connected through actual Native owners. No UI/design or merge is included. Explicit test population, policies, accepted intake and initial prior ranking history remain fixtures; this is not new-career population generation or physical trajectory generation.

## Implemented

- The assembly fixture supports multiple actual Players per Nation while preserving the existing one-player assembly gates. The integrated case uses 90 global roster Players, 80 accepted registrations, 8 qualified Nations and a separate unqualified cohost.
- All 15 games in a generated eight-country tournament use actual registered HOME/AWAY defenders. The scripted nine-inning helper switches the nine defender identities at the next activated half, including three-out transitions. Its original fixed-identity mode is unchanged.
- Accepted World fixtures, roster/person links and National registrations authorize pregame participation. Actual Match activation/closure applications produce durable defender receipts and official senior appearance records; an unused registered reserve cannot claim a receipt or appearance.
- Read-only regional fixture verification reuses the same projection as actual adoption, verifies the exact accepted Match fixture and preserves the enclosing read scope. Actual adoption retains a fresh writer phase.
- Callup journal replay reuses only immutable prefixes in one operation, keyed by Career/day/revision. The roster-capability owner supplies root read scopes and fresh writer phases. Proof reads are discarded after writes and after each operation; changed/corrupt prefixes are revalidated. Existing serialized DTO/hash formats are unchanged.

## Evidence

The integrated test completes all 15 actual official games, retains the pre-cutoff capability proof after appearances/later citizenship, checks unused reserves and senior Nation locks, reopens downstream/participation/callup owners, and adopts all 15 results into actual regional ranking history. Global Club assignments remain unchanged. Focused integrated gate: 1 test passed in 462.43 seconds with 90 actual roster Players. Typecheck passed before this gate. Callup/eligibility focused tests also passed (9 + 1 tests) during the performance investigation.

An independent read-only review reported no findings for the actor/lifecycle/prefix changes. Final `npm run verify`, after removing temporary profiling output: catalog compilation/typecheck succeeded; 517 files / 3,102 tests passed in 490.37 seconds. No rereview was performed. The read-only fixture helper adds an explicit pure boundary to the existing shared fixture projection; existing accepted-fixture checks remain in place and their tests passed in the final suite.

## Remaining

Production catalog/facility/population initialization and broader approved career/calendar/physics integrations require further audit and connection. Initial historical content and numeric policies remain explicit inputs. The overall nonvisual goal remains active.
