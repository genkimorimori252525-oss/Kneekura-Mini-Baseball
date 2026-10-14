# Completed domestic Match settlement connections

This continues the approved original non-design Match-to-season/Career work in
section 5 of the October 4 checkpoint. The original final owners are reused;
no statistics, attendance, economic policy or physiology formula is invented.

## Connected final owners

- `settlePhysicalDomesticGame` reads the completed physical non-live closure,
  its original final application, scoring and authenticated historical workload.
  It feeds the existing domestic outbox without repeating workload.
- `settleSamePaDomesticGame` reads the completed reserved terminal transition
  and requires the exact authenticated settlement release. The transition,
  settlement, endpoint and enrollment references must agree before World intake.
  Both normal non-live and the existing supported fair-catch final receipts use
  this path.
- `settleFoulTerminalDomesticGame` reads the completed foul-terminal owner. Its
  pending-post-play input, request hash, official receipt and completed final
  result stay distinct from ordinary finalization. The new typed
  `completedTerminal` arm of `SqliteOfficialWorldSettlementOutbox` writes only
  World effects. It never passes a relabeled pending request to
  `applyAndFinalize`.

The existing `settleActualLiveDomesticGame` uses the same common domestic input
assembly. All paths require the accepted gate fact, original fixture and schedule,
accepted wage ledger and revenue policy, complete official final and current
season/Club CAS on first admission. Retries retain the original World basis,
including its schedule prefix, after later legitimate Club, workload or schedule
changes. No final result or workload is reconstructed from a caller scoreboard.

The new outbox arm shares the existing table and unique application-ID namespace.
Its typed `read`, `listPending`, `resume` and `submit` preserve the original
pending/completion representation. The legacy methods retain their existing
request/result types and enumerate their own pending arm. A shared application ID
cannot be admitted through both arms. Interrupted World writes and interrupted
outbox completion updates use the existing durable retry/CAS pattern. Completed
terminal retries reauthenticate the original owner and persisted World result;
a missing World application is not silently recreated.

The existing pure terminal receipt-envelope helpers now live in
`OfficialTerminalPostPlayReceipt` and remain re-exported from their previous
module. Stored bytes and existing callers are unchanged. Keeping these pure
formatters separate also avoids importing the full physical ownership graph
into an ordinary World outbox.

## Verification scope

The new adapter tests explicitly substitute original closure/transition/terminal
proof readers. Their Match, attendance, outbox and World settlement are real
Native owners. They cover historical retry/reopen, stale first CAS, changed
retry economics, missing/incomplete final owners, exact same-PA release, typed
outbox recovery, application-ID collision, retained pending hash and missing
World-application rejection. They do not qualify a genuine full physical game.

The bounded author runs use Node 26, one Vitest worker, a 512 MiB heap limit,
`--no-cache`, an external cache directory and a 35-second external wall cap.
The first three-file selection passed 34 tests in 9.15 seconds. The expanded
five-file selection passed 41 tests in 11.21 seconds. After extracting the pure
receipt helpers, the final five-file selection passed all 41 tests in 12.28
seconds. One selected existing actual-live settlement happy path also passed in
9.23 seconds, with the other 34 cases in that file explicitly skipped.

Two wider selections containing the entire older actual-live integration file
reached the 35-second external cap without a terminal case report. They are
unqualified. The second run reached actual fixture work; it is not a completed
file result. The 42 distinct successful cases above do not replace its remaining
checks. Full compiler, consolidated original-owner composition and whole/archive
qualification remain part of consolidated integration qualification.

All 18 protected source/test blobs were verified unchanged. No dependency
mutation, home-PC CI, PR, merge, deployment or private database/log publication
was performed for this component.

## Remaining original plan

These adapters close defined final delivery seams into the existing season and
Club consumers. They do not produce missing games, choose event opportunities,
automatically dispatch the Career clock or supply incomplete individual scoring
responsibility. Existing season completion and advance owners remain in place;
full long-running autonomous Career execution and integrated qualification are
still open.
