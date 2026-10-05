# Actual-live legal handoff checkpoint

Base: `5998db4a6fc4fa898d9867f17b925dce917a8365`.

This continues the approved nonvisual scope recorded in
[the recovery checkpoint](2026-10-04-nonvisual-recovery-checkpoint.md).
Contract authority is `docs/game-design/07-world-first-adjudication-contracts.md`
§§3, 5, 8–10; the connected implementation-branch copy was rechecked before this change.

## Implemented bounded seam

- The existing `OfficialGameCompletion` owner exposes its shared legal stop/continue
  decision independently of the complete line score. Its final-result API still
  requires that line score; no H/E totals are inferred
- An actual-live closure may supply an explicit versioned game policy. Continuing
  half-inning changes use the supplied defensive setup and existing pregame
  Player/Person/Club bindings, including the new defensive side
- Live and non-live closure paths share the frozen per-game completion-policy registry
- The original ten actors remain the workload participants. Physical history,
  controller identities and future-work evidence are retained; a new lineup does
  not receive the old play's workload
- Known final/walkoff fences remain named scoring-pending rather than activating
  another play. The accepted aggregate scorer-context/finalization connection is
  the next part of this same scope, using contract §10.2
- Legacy same-half proposals without new policy fields retain their old serialized
  shape and the captured pre-change fingerprint

## Verification and open review corrections

Two narrowly selected files were run with physical owners mocked; the actual legal
ledger, official SQLite writer, identity rows, rollback and reopen were exercised.
RED: 15 expected failures / 7 passes. GREEN: 22/22 tests, zero skips, 4.85 seconds.
The GREEN aggregate process-group peak was 311,984 KiB; every observed Node26
process had the verified 288 MiB total heap limit. Source hashes were unchanged
and all owned processes were reaped. No physical replay or large artifact was used.

Independent static review identified two pending P2 corrections at this checkpoint:

1. Reject noncanonical next-defender binding JSON and invalid/missing roster revision
2. Limit missing-policy go-ahead refusal to fresh admission so previously accepted
   legacy same-half archives remain readable without permitting new unguarded activation

Full typecheck, broader focused integration, physical/Native acceptance and the
full test suite have not run on this change. They must not be inferred from the
light tests. No workflow, package, UI, merge or publication change is included.

## Accepted aggregate finalization and review closure

The continuation adds `AcceptedActualLiveFinalScoring` as an explicit nested
accepted input to the closure authority. It has its own Source ID/version,
`official_scorer_aggregate` provenance, scorer identity, game/season/closure/play/
revision binding, original adjudication snapshot hash, recorded tick, exact
fixture, and complete `CanonicalLineScoreSnapshot`. Contract §10.2 allows this
externally supplied official scoring aggregate; it does not make it physical
truth or a supported per-play H/E judgment.

For a final candidate, `worldSetup` and `nextStartedAtTick` are both `null`.
An absent aggregate remains named scoring-pending. An accepted complete aggregate
is checked against the official run totals, current-half run delta and existing
inning/null semantics, then passed to the existing `deriveOfficialFinalResult`
and `applyAndFinalize`. No next lineup/world is required or activated. The frozen
proposal exposes the original final application for the existing season/outbox
consumers; this change does not supply attendance, economy inputs or run those
consumers.

`readReadiness` reports `game_final` whether the original ten-role settlement is
pending or complete. The workload owners remain unchanged. Terminal Match
revision/state/final-result payload are authenticated on every read/retry, and
physical activation remains forbidden after settlement. Aggregate Source alias
claims, changed accepted input and writer-local source/Match corruption fail
closed. The original physical, call/review, controller and future-work identities
remain bound to the same closed play.

The first-slice P2s are fixed. New defenders require canonical raw binding JSON
and a valid roster revision. Already-applied legacy same-half archives remain
readable; new current admission across a policy-free possible walkoff requires
an accepted policy from the existing registry, and a final fence remains pending.
This does not rewrite a legacy proposal or convert a historical activation into
a legal final record.

The expanded RED run observed 10 failures / 43 passes. Independent review then
found terminal historical-head and legacy current-admission gaps; the targeted
RED observed 3 failures / 54 passes before those fixes. Final light GREEN passed
**57/57**, zero skips, in **6.35 seconds**, including real ten-role workload
settlement and subsequent physical-activation rejection. Aggregate process-group
peak was **340,752 KiB**, each observed process had a verified **288 MiB** total
heap, all source hashes were unchanged and all owned processes were reaped.
Final source-manifest SHA-256:
`0e202741fbabcb80536a3e1b9115c92e81f20324deb28704dde3670c91da76d0`.

A fresh independent static delta review found no remaining blockers after these
fixes. It did not execute tests or a compiler. Full typecheck, broader focused
integration, original-chain Native/physical acceptance and the full suite remain
unrun on this source. The added helper narrowing and stage-fixture type updates
also await that integrated gate. No publication, merge or deployment is claimed.

## Fixed-source compiler and adjacent gate

Immutable source `94fc8ab892909deeb4b12fc1a539235fb70a7256` subsequently passed catalog compilation, complete `tsc --noEmit`, and **21 selected files / 154 tests**, with zero failures or skips, on 2026-10-05 02:50:48–02:51:40 UTC. The 21 files cover existing official completion/scoring, legal activation/reset, real tiny SQLite official/outbox owners, mocked-physical handoff and real ten-role workload boundaries. They do not construct the large original physical graph.

All **2,071** tracked/generated source hashes remained unchanged; manifest SHA-256 `23b61a7be6761a609eb1b4eac9dd706ab04174bab499684dcb398c0aab67358d`. Runtime and control hashes were unchanged and every process was reaped without a guard event or straggler. Compiler duration was 24.29 seconds, verified actual Node 26.10.0 heap 1,504 MiB (1,408 MiB old-space requested), peak aggregate RSS 1,313,392 KiB. The single-worker test stage took 27.52 seconds with verified 1,120 MiB heap and peak aggregate RSS 412,880 KiB.

Source tree remains `ded973d61938db403351dc0cda4d75175a169bb4`. This later documentation does not change the verified source. Original-chain actual-live official/workload/next-pitch, real legal-final physical integration and the current cumulative whole gate remain separately pending. The earlier full physical-end success on source 9e27dc8 does not extend to this newer legal code automatically.
