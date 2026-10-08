# Participant inventory: failed close and bounded readback

The first inventory attempt at source `b6d7215bf4c4396c287abb85534458c687951db3`
failed and retains zero aggregate credit. Its synchronous returned checkpoint
follows the genuine owner-authentication assertions, unchanged complete census,
zero change comparison and transaction/query-only checks. The final reported
failure was an existing WAL sidecar after a read-only connection was closed.
Because the final cleanup assertion can mask an earlier close error, the original
Native close's success is explicitly unknown.

The retained main bytes still match the original closed donor. Its WAL is empty,
its shared-memory file is separately pinned, and all owned processes exited and
were reaped. Those facts permit a bounded recovery proposal; they do not turn the
failed test into a pass.

The separate `EPB-RC01` verifier pins the exact failed source, accepted config,
input, report, synchronous checkpoints, output/progress logs, process evidence
and main/WAL/SHM tuple. It admits only the observations covered by the returned
checkpoint. It never replays physical owner authentication or accepts any new
contact, touch, response, binding or runtime.

After checking the empty-WAL copy prerequisite, it creates an exclusive private
main-file copy and uses ordinary Native connections with `query_only=ON`.
Two bounded read transactions check the complete schema/rowid/value census and
five raw archive hashes against the completed observations. Each connection must
show zero changes, preserve query-only/transaction state, close without leftover
sidecars, and leave the main bytes unchanged. Donor sidecars are never deleted.

Its distinct recovery receipt preserves the failed original status, unknown
original close success and original source attribution, while recording the new
current-readback and close/reopen checks. The original inventory is never labeled
PASS. Compiler and readback execution received separate exact packet releases.
Their source-specific results follow; they do not change the original failure.

## Qualified source-specific result

At recovery source `c40c7fa4020a4882af5f52a3a8e9a77c2fb0fa0a` / `src`
`0ea5980b8670ab4af12ec43330fffdaa10432e20`, full-root compilation passed with
one original process, one zero exit/raw-wait record, no survivors and unchanged
inputs. Compiler terminal SHA-256:
`501397cff147bd09c845cd9f7efbd4aa209fc41f2fec7abc9c08e01e3d92e2b4`.

RC01 passed its single case in 148 ms, with peak RSS 336,728 KiB. Both owned processes
exited 0/raw 0, all were reaped, no survivors remained and all four input groups
were unchanged. Recovery terminal SHA-256:
`d73a33c45eded7187ae1d0d91aaf725695df1dbb6c7c81f0dfce8e0199abff01`.
The distinct recovery receipt SHA-256 is
`1b3178d221fde6f109d177ea96f99ba780e49be929731bc0e4471e1cae99ba26`.

The recovered inventory qualifies the audited completed semantic observations
and the new current-readback/cleanup assertions. The original P00 remains failed
with zero aggregate credit and its original close success remains unknown. The
binding-owner table is absent. No contact, touch, response or binding was accepted
by recovery. Private database paths, controls and logs are not published here.

## Next contact-owner preparation

The next contact test explicitly consumes that distinct recovery provenance. It
checks the exact complete input census, then calls the normal contact owner with
the already accepted ten-player command Source and frozen existing model. It
does not rerun the 308-second P00 authentication. Production owner checks, exact
contact/head write witnesses, old-row preservation, authority-free retry and a
fresh Native read remain required. The final read uses an ordinary Native
connection with query-only enabled so its own close can remove empty WAL/SHM.

Only the contact and its head may be added. Touch, response, binding, model
replacement, flight construction and runtime work remain outside this next
packet. Binding schema bootstrap is reserved for a later explicit review.

The contact harness at `ce9ce93ee1ec1d4bedbe5adb43c156fdce526285`, source tree
`c40a32b268260a66757e80bffbbbf4ea9a4c6f10`, passed its exact full-root
compiler and independent packet review. Compiler terminal SHA-256:
`939839c49130db60bf231bcf9068195d92c61b7d9b73537a172913ca87a72ad1`.
One original process exited zero with raw wait zero; no survivors or input changes
remained. P01 owner acceptance is a separate prospective gate.
