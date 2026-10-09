# Reserved same-PA field rule bridge

This is a bounded non-design implementation component. It does not complete the
reserved fair-ball terminal/official/scoring path.

## Implemented

`readSamePaFieldRuleEvidenceFromSqlite` takes only an original lifecycle view
reference plus an explicit `current` or `historical` read mode. In the existing
Native query-only read phase it replays the complete lifecycle work prefix,
selects the current physical pitch's original field root and consecutive steps,
and binds the result to the exact view cut and coverage hash. A historical read
never borrows a current head. A current read keeps the normal lifecycle complete
work/current-head checks. There is no new mutable owner, table or write API.

`deriveSamePaFieldRuleEvidence` projects that authenticated physical prefix into
existing Core contracts:

- original field geometry, ball contacts, base companion contacts and executed
  ground intervals for `BallWorldFieldTerritory`;
- actual all-player, both-foot body segments for `BallWorldPlayerBaseContactHistory`;
- confirmed scheduled capture and release-exclusive custody intervals for
  `BallWorldControlledBaseContacts`;
- existing `BallWorldFieldFirstBaseRaceWithPossessionEvidence` for territory,
  actual catch interpretation and the bounded empty-base first-base race.

Capture energy completion or a future motor horizon does not become possession.
Pending capture retains its original uncertainty bound until its recorded-tick
fence completes. Throw planning remains zero-time; actual release excludes the
release instant from the outgoing carrier's custody. Receiver possession needs
its own real acquisition. Rules consume only actual executed intervals, never
future runner arrival. The current reserved batter body is stationary unless a
separate physical owner has actually supplied different curves.

The reader currently supports an active empty-base field cut only. It returns
explicit pending states for a non-field/closed cut or unsupported nonempty-base
participation. Non-defender contact remains an unresolved existing Core policy.

## Explicit terminal boundary

A resolved fair territory, fly catch or first-base rule result is not a
`PlayEndFact`, an operative umpire call, or an official scoring record. Every
bridge result therefore retains `reserved_live_play_end_owner_missing` with
`physicalEnd: null`. The bridge neither changes the canonical PA timeline nor
writes Match state, official ledger, score or workload heads.

The existing ActualLive first-base terminal owner requires its own admitted
causal runtime, complete physical generation cut, consumption/observer/controller
coverage, operative umpire retirement, emitted and consumed call communication,
and terminal seal. Reserved physical rows do not provide those owner receipts.
Relabeling them as ActualLive rows would manufacture ownership. The next bounded
implementation needs a reserved live-play-end owner that proves those real
obligations from the reserved producer graph. Only then can live adjudication,
official closure and `classifyClosedPlayForOfficialScoring` consume that outcome.
The existing count/foul endpoint and non-live terminal transition are unchanged.

This preserves the five-result separation and the two distinct closure boundaries
in `docs/game-design/07-world-first-adjudication-contracts.md`, sections 1 and 3.
No new numerical model, contact result, runner action, official call or fixture
outcome is introduced.

## Verification scope

Seven short calculation tests cover actual Core-produced glove capture/fence,
fair-ground/no-first-base-event, throw release, incomplete or foreign prefixes,
both-foot coverage, and non-defender contact. Their fixture Sources are explicitly
synthetic and do not claim Native admission.

The existing IFN01 Native scenario has additive assertions for the new reader:
exact final field cut, all nine defender histories, read-only row accounting,
explicit pending terminal boundary, and directed historical/current reads. These
are intended for the single consolidated compiler/review/meaningful test batch;
no separate long Native run was started while authoring this component.

UI, presentation, protected runner/contact-wait behavior, DRAFT32, production
score models, home-PC CI, merge, deploy and public artifacts are outside this delta.
