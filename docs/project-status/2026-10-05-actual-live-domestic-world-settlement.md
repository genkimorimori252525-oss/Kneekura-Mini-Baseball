# Actual-live domestic World settlement checkpoint

Base: `94fc8ab892909deeb4b12fc1a539235fb70a7256`.

This bounded connection continues the approved nonvisual scope in
[the recovery checkpoint](2026-10-04-nonvisual-recovery-checkpoint.md).
The accepted final-scoring contract is unchanged.

## Existing-owner connection

`settleActualLiveDomesticGame` reads the accepted final closure, authenticates its
original ten workload effects, and reuses its exact `PersistOfficialFinalInput`.
It reads the accepted attendance fact by identity. World season standings policy,
results, Club state and accepted Club history come from their existing owners;
revenue policy, wage ledger, finalization day and expected revisions are explicit
inputs. It uses the existing domestic settlement, durable outbox and official
World driver. It neither constructs a second season engine nor reapplies workload.

The existing pure settlement function validates initial economy inputs before
outbox admission, so malformed policy/wages/day values cannot freeze an unusable
application. Retry compares the supplied inputs with the retained request,
rederives its settlement, and checks the durable application and revision bindings.
The retained full standings policy must match the season owner's immutable policy,
including changes that would not alter the particular game's calculated output.

## Retry boundary

When the World application already exists, exact retry keeps the original request,
Club/history/results and accepted historical schedule prefix. Later accepted Club
revenue, Player recovery, a second game, or an unrelated rainout do not rewrite that
historical basis. This includes a crash after the World commit but before the outbox
completion marker.

Before the first World commit, the existing World owner's current revision,
result-history and standings preconditions still apply. If a later rainout changes
those preconditions, the original request remains pending and unchanged; retry
fails closed without new World or workload effects. Automatic rebasing is outside
this connection. The World persistence/CAS owner is unchanged.

## Verification status

The initial first-fixture RED reached the missing adapter (1 failed, 27 excluded).
Two earlier full 28-case attempts hit their 384 MiB aggregate limit without a
result and are resource-capped attempts, not RED passes.

The first complete review RED ran 33 cases: 28 passed and 5 failed for the intended
malformed-initial-input and completed-request-authentication gaps. After the fixes,
the first GREEN attempt ran 32/33: the remaining test expected a different error
category, while the existing validator correctly rejected forged Club cash with
`STATE_INCONSISTENT: finance.balances`. Its assertion was corrected to include that
precise diagnostic. These attempts are retained separately.

A second review RED ran **34 passed / 1 failed** across 35 cases, exposing
outcome-neutral policy tampering. After the full immutable-policy binding, final
focused GREEN passed **35/35**, zero skips, in **51.11 seconds** with a
**428,036 KiB** aggregate process-group peak. All observed Node 26.10.0 processes
had the verified **480 MiB** total heap limit. Source, runtime and controller hashes
were unchanged, and all owned processes were reaped. The focused-run source
manifest (before this documentation) is
`8ecfb696952f5510d604a5fcb373ff2aa5b69721a329a65d68a111712b9a69b2`.

Independent static rereview found no remaining actionable findings. The source
checkpoint preceded the integrated verification recorded below. Full-suite
and original-chain physical acceptance are not claimed. The focused fixtures mock
physical/adjudication input boundaries while exercising real SQLite closure,
ten-role workload, attendance, outbox, Match and World owners. Numeric scoring,
attendance, workload and revenue values in those fixtures are synthetic test data,
not production calibration. No UI, workflow, dependency, merge or deployment change
is included.

## Integrated verification

Exact source commit `d034ea21dbd863635e6c7c8302a065a050e87902`, source tree
`1e068a26278e2aa00ab9c6e910cdfb09d4e223a0`, passed catalog generation,
full `tsc --noEmit`, and **28 files / 208 tests**, zero failures or skips.
The exact file membership and per-file counts were checked: the prior 21-file /
154-test legal gate, 35 adapter cases, and 19 adjacent economy, World, schedule
and domestic-season cases. Vitest's nested suite count is not the file count.

The compiler completed in **22.35 seconds**, with a **1,285,632 KiB** aggregate
peak and a verified **1,504 MiB** heap limit. The one-worker test stage completed
in **100.51 seconds**, with a **430,088 KiB** aggregate peak and verified
**1,120 MiB** heap limits. Source, controller and runtime hashes stayed unchanged;
all owned processes were reaped. The integrated source-manifest SHA-256 is
`ec08738c67d5e1c92fb86ef3b1451d756ce9434f294192a31e108c5ba783e336`.

This verification record is a documentation-only addition after that exact-source
gate. The full project suite and original-chain Native/physical acceptance remain
outside these results. No merge, deployment or publication is claimed here.
