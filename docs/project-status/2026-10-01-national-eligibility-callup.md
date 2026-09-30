# National eligibility, call-up and official participation

Authoritative scope: `origin/jolly/core-foundation-plan-2026-09-17`,
`docs/game-design/11-world-competition-architecture.md`, section 19.
Canonical design ref at implementation: `560670be519a01f07e2e4b7dd12a1ca3821c88a4`.
No visual/UI connection or PR merge is included.

## Implemented boundary

- Core evaluates dated citizenship, birth, ancestry and residence evidence under an
  explicitly supplied versioned eligibility policy. It enforces one representative
  per Player/Edition, policy-controlled nation switching and senior appearance locks.
- Native legal evidence is bound to accepted Player/Person and Nation sources. Its
  journal supports revocation and exact historical prefix reads. Later evidence,
  including evidence on the same day, does not rewrite an accepted call-up.
- Native roster checkpoints capture a real accepted global roster. A later roster
  head cannot be substituted for a missing historical checkpoint.
- Native call-ups preserve Club rights, assignment, registration and availability.
  Affiliation, rating context and ability are not modified. An unaffiliated Player
  may be called up; `releaseClubId` is then null.
- Explicit edition policy supplies roster capacity, initial registration deadline,
  injury replacement cutoff and allowed player refusals. There are no numerical
  production defaults. Replacement consumes an active injured Player's place and
  preserves that Player's representation history. Declined calls do not create
  representation or a releasing Club obligation.
- Official participation has a tagged National authority path alongside the existing
  domestic path. The Native authority resolves accepted WBC finals, Premier12 and
  regional fixtures/schedules, active representative registration, current legal
  eligibility, global Player/Person identity and the current roster checkpoint.
  It does not invent National Club assignments.
- A senior appearance requires an actual durable official participation receipt and
  its activation/closure play actor proof. An unused registered substitute does not
  acquire a senior appearance. Appearance adoption and call-up replay use bounded
  accepted journal prefixes.
- Native country roster eligibility derives an accepted snapshot from registered,
  legally eligible Players and an explicit minimum roster policy. Historical snapshots
  pin legal and call-up prefixes. Qualifier selection can consume this Native source
  and rejects a caller list that differs from it or belongs to another Edition.

## Verification boundary

Tests exercise actual Native World selection, Nation, Player/Person, roster,
call-up, schedule/fixture and official play application owners, including restart,
retry, source corruption, future evidence exclusion, refusal, replacement, legal
revocation and unchanged Club state.

Final `npm run verify`: catalog validation/compilation and type check succeeded;
509 test files, 3,083 tests passed (275.89 seconds). A fresh read-only review found
no Critical, Important or Minor issues.

The official actor test uses a supplied canonical timeline/adjudication fixture.
It proves durable participant identity and appearance adoption; it does not prove
physical ball trajectories or complete Career execution.

## Remaining whole-plan integration

This slice does not close the complete nonvisual implementation goal. Remaining work
includes National Pool/population initialization and qualifier call-up edition
binding; production regional entrant/draw/hosting assembly; first-career WBC history
bootstrap under an approved rule; year-round Career scheduling; physical Match,
travel/recovery and Player/Career/economy integration and long-career acceptance gates.
Design/UI remains disconnected.
