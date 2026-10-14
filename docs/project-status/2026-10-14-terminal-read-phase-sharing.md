# Terminal transition and release: shared ancestry within one read

Qualified source tree: `b8e99a25cb5aa9afce821f27071687d13893c225`.

## Change

Two existing pure readers repeatedly reconstruct the same completed endpoint
ancestry inside one connection and one read transaction:

- deriveSamePaTerminalTransition reads the endpoint directly and again through
  settlement, for two traversals.
- readSamePaTerminalReleaseFromSqlite reads it through settlement and transition,
  for three traversals.

Both readers now use one existing lifecycle read phase around those sequential
calls. Native/input checks remain before the phase. Release archive lookup and
the null return remain before it as well. The original derivation bodies are
unchanged apart from the scope wrapper. All endpoint, current coverage,
workload, Match, scoring, effect and claim checks still run. Only completed
lower ancestry can be reused. Nothing survives a write, transaction boundary,
independent invocation or retry.

The retained loader's five terminal-owner reads use four private connections;
settlement.read and readRelease share a connection but use separate transactions.
The fixture's direct final-view read uses another connection. An outer scope
around that entire loader would therefore not provide the intended sharing.
The other examined cut, dispatch, second-TAKE and continuation groups already
have suitable scopes and are unchanged.

## Consolidated verification

Independent source review is CLEAR. Full compiler passed in 34.514 seconds.
The first finite selection reached its 180-second ceiling without a complete
case report; it remains a failed, incomplete attempt with no inferred case count.
An older completed measurement already showed that the settlement fixtures were
substantial, so the same selection was retried once with a 360-second ceiling.
The successful compiler was reused after exact source, dependency and runtime
comparison; no code or test content changed between attempts.

All 43 declared cases passed in 199.469 seconds, with exact case names, no skips
and unchanged source/dependency/runtime/control inputs. The selected files were
TerminalTransition, fourteen cases, and TerminalSettlement, twenty-nine cases.
The two added cases cover real Native memo sharing, fresh independent invocation,
current/historical use, Native-first rejection, null release and DB/settings
invariance. Existing cases retain official/scoring writes, rollback, malformed
ownership, mutation, current coverage and retry coverage.

The completed file durations were 43.794 and 149.509 seconds respectively.
These are test-fixture durations, not a before/after performance benchmark.

## Remaining measurement boundary

The optimization's elapsed-time benefit and its contribution to the earlier
approximately 3,656-second retained initialization have not been measured.
Static traversal counts do not establish speedup. The smallest proposed later
comparison is the same accepted input's original public transition.read and
settlement.readRelease operations, with full return and DB equality and the
same rejection/transaction guarantees. The interrupted original composite case
remains unverified; this finite qualification does not replace it.
