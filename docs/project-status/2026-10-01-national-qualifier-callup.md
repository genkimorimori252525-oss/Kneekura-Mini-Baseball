# Native WBC qualifier call-up and participation

Authoritative scope: approved `docs/game-design/11-world-competition-architecture.md`
and `12-competition-identity-hosting.md` on
`origin/jolly/core-foundation-plan-2026-09-17` at
`560670be519a01f07e2e4b7dd12a1ca3821c88a4`.

## Implementation

- National call-up accepts a Native WBC Qualifier Edition source, pins its compact
  snapshot identity, parent WBC, selected entrants, selection day and actual window.
  A hosting Nation gains no participation entitlement. Future selection proof and
  registration/replacement beyond the qualifier window are rejected.
- Qualifier representation uses its actual Edition identity. Parent WBC registration
  remains a separate record; registering for a qualifier does not overwrite it.
- The Native participation authority validates existing accepted qualifier Pods,
  Schedule and Match fixture through a read-only adapter. Senior appearance requires
  the same durable activation/closure actor proof as other National participation.
  An unused bound substitute receives no senior appearance.
- Source memoization is confined to one synchronous read operation. Call-up and
  appearance writes start fresh phases and invalidate caller proof caches. Existing
  regular selection DTOs and call-up hash bases remain unchanged.
- Earlier country roster eligibility pins its accepted call-up/legal prefixes.
  Later qualifier registration and appearance do not create a dependency cycle or
  rewrite the earlier selected entrants. Reading a later call-up still revalidates
  its actual qualifier Edition and rejects corruption.

## Verification

Targeted four files / fourteen tests passed in 37.59 seconds; type check passed.
A fresh independent read-only review reported no Critical, Important or Minor issues.
Final `npm run verify`: catalog validation/compilation and type check succeeded;
510 test files / 3,085 tests passed in 268.53 seconds.

The integration fixture exercises sixteen Native Players, legal facts, representative
registrations, country roster eligibility, qualifier selection, facilities/access,
Edition, Pods, Schedule, accepted fixture and official play actor receipts. Initial
historical direct berths/ranking, legal facts, population and numeric policies are
explicit fixtures. This is not an approved first-career history bootstrap or a
production National Pool initializer. Supplied canonical physical/adjudication
timelines prove actor identity, not physical trajectory generation.

## Remaining whole-plan work

Production National Pool/population and facility initialization, regional entrant /
regional ranking / draw / hosting assembly, approved first-career historical sources,
year-round Career scheduling, physical Match / travel / recovery / development /
economy integration and long-career acceptance remain open. This slice does not close
the complete nonvisual goal. Design/UI remains disconnected; no PR merge is included.
