# Completed Match to individual outcome delivery

This is the original nonvisual checkpoint §5 area 9 connection. It consumes
existing official scoring and original participant evidence; it adds no scoring
formula, player appraisal, award selection, learning policy or Match feedback.

`openSqliteOfficialPlayerOutcomeStore(...).applyCompletedGame({ careerId,
gameId })` now discovers and delivers the individual outcomes of a completed
game. Callers select the Match instead of enumerating each play's owner and
Source ID.

- The private Native transaction authenticates the durable final and its pinned
  fixture, the exact application count, contiguous official/scoring history,
  final application and full line score.
- Each play is matched against the four existing physical, actual-live,
  completed-foul and reserved same-PA owners. Raw identity mirrors participate
  in discovery; a wrong indexed identity cannot hide a competing raw claim.
- A unique owner uses the existing original evidence decoder and append-only
  attribution admission. Career, edition, game, play, revision, scoring and
  original fixture/Club bindings must agree with the completed Match census.
- Missing and ambiguous original owners, and the decoder's existing unavailable
  cases, are explicit per-play results. Coverage remains
  `attributed_supported_plays_only` unless every official play is attributed.
  Missing or corrupted official/scoring history rejects the operation; it is
  never substituted with zero statistics.
- All deliveries share one transaction and the existing edition history anchor.
  A fresh census and history traversal follow writes. Retry/reopen uses the
  original proofs again; a previously attributed play cannot become a silently
  missing or competing owner. No game receipt or second persistence journal is
  introduced.

The existing scoring-history implementation exposes a separate completed-game
entry. It accepts a final reserved transition only after its original release,
or a final foul completion only through its existing completion owner, at the
last revision of that exact final result. The foul pending request/hash and
completion envelope are preserved. The prior-play entry keeps its rejection of
a terminal final before another play. The shared raw ownership reader now
accepts digits after the first table-name character, permitting the existing
`pa_terminal_v1_transitions` owner without weakening identifier quoting rules.

Author verification: `CompletedMatchPlayerOutcomes.test.ts` (10 cases) and
`SqliteOfficialPlayerOutcomeStore.test.ts` (11 cases), 21 passed. The new finite
fixture writes six real official strikeouts, official scoring and a one-inning
tie final. Physical attribution, reserved release and terminal completion owners
are explicitly substituted; this is adapter/persistence coverage, not a genuine
physical game qualification. Cases cover all four discovery arms, partial
coverage, a raw competing identity, whole-game rollback, reopen, changed original
proof/owner/scoring/fixture, a write-trigger mutation, and the completed-foul
pending hash with unchanged prior-play rejection.

The integrated review found two omissions, now corrected: a competing physical
owner retained only through its raw result game/play mirrors could escape the
census (P1), and a later write could change an earlier unavailable outcome before
return without refreshing it (P2). Discovery now keeps each owner's existing
identity domains and uses the foul owner's shared application/scope metadata;
unavailable evidence is rederived after mutations alongside attributed history.
Both focused regressions failed before the corrections and require transaction
rollback afterward. The revised 12-case adapter file passed in 6.45 seconds.

Central integration at `1bf7fb336d2e57e5090c0a3848b0cabe4a100432` passed the
full nonvisual compiler and all 343 selected cases in 28 files. Independent
review is clear after the corrections below. See the
[combined receipt and genuine-execution limits](2026-10-09-occupied-motion-attribution-batch.md). Broader statistical categories still require
their declared original scoring evidence; this connection preserves the existing
eight classified-outcome counts and their stated coverage.
