# Public episode-binding read phases

The public binding store used its bare immutable snapshot without enrolling in
the existing binding derivation phase. Fresh acceptance therefore derived the
same binding twice before the write transaction, once before insertion, and
twice after insertion. The associated venue/physical proof scope was also absent.

Each public read bracket now composes the existing binding phase with the
existing venue snapshot, which installs physical traversal. The empty prior
lookup remains separate. The accepted-source callback, write transaction,
insertion and independent retry still separate all proofs. Identity and scope
queries, current flight/response checks, exact archive mirrors, mutation stamps,
write accounting and transaction cleanup retain their original calls.

One small genuine v1 fixture test passively observes the real calibration owner.
It failed first with five derivations and five null physical frames. After the
connection, it passes with three derivations in three distinct physical frames,
two fresh frames around a retry callback, and a fresh independent read. A peer
callback's archive corruption still rejects; transaction and query-only state
restore correctly. No fake dependency result is supplied to the binding owner.

The 13 existing binding read-phase cases and 10 existing WAL, trigger, namespace
and reopen cases pass. The new case and focused transitive TypeScript check pass;
all 18 protected blobs remain exact. This is light owner-mechanics verification,
not an end-to-end National timing result or a full-project compiler run.

A later completed comparison may use an exact read or retry of the already
committed genuine v3 binding on preserved copies. It must retain the accepted row
and distinguish that narrower read/retry scope from fresh admission. No retained
National database, accepted posture, fixture declaration or live run was changed
or executed for this patch.

## Matched retained public read

A completed comparison used identical preserved copies of the genuine committed
v3 National binding. Baseline local `5e96bf83f49b03bf1f5a771e9f4c243374670c6d`
and candidate `90da89a509177dc71a9026ea5066dd3b85460a08` each executed exactly one
public read, sequentially under matched controls. The operation took 41.214 and
15.634 seconds; prepares fell from 108,628 to 47,770. Both returned the identical
138,780-byte result, SHA-256
`f29af12fa435dadf526693c04d453b0041e3b826a51a104b833fa1cf6c92c2df`.

Both total_changes values stayed zero. All 77 tables, schema, row identities and
values were unchanged; each closed database remained byte-identical to the
original input. Donor database/WAL/SHM tuples stayed unchanged. Source, dependency,
runtime and control pins were stable; both processes exited zero with no
survivors. No retries or admission deletion were used.

Comparison receipt SHA-256:
`4884b23dfb11e28b02f8abfcb34b9aa24868f065089db09a5b735890886a002c`.
This is one historical public-read comparison. It does not measure fresh
admission or establish a completed National tail or whole-game speedup.
