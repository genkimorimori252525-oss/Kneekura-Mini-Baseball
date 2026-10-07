# Flight private-read transaction qualification

The flight store now gives each private read group a fresh read transaction and
physical traversal, releasing it before authority and peer callbacks. Existing
caller transactions stay caller-owned. The original evidence checks and writer
revalidation remain unchanged. The accompanying ten cases cover snapshot
ownership, WAL visibility, callback mutation, failure cleanup and writer exclusion.

## Qualified author source

Source `36824996b267ed51c35d7fd69cfc99942d058c11`, with `src` tree
`0e41fe392ec58743890e34b5449f91cb144b6f5e`, completed compiler and catalog checks
and all 66 cases in six complete files: flight private reads 10, flight baseline 6,
flight WAL 12, original prefix 2, next private reads 12 and physical traversal 24.
There were no failures, skips or excluded cases; the bounded controller reported
all owned processes reaped. The author GREEN terminal SHA-256 is
`ee5e1713af316bb6e414975d59b1e4e8f68c9b078e44379d84db334b246b93c8`.

The preceding RED source `460ac2d817fbbd9b845ef9a5c79ebea2ed31af70` passed its
one selected Native flight baseline case and failed its one selected private-read
case at the exact transaction-state assertion. Its other 14 cases were excluded
from that RED selection. Its terminal SHA-256 is
`2ef3c3299eee98910cbb214637bc25eb4dac9984b2696e2b36f5f941a13bc425`.

## Qualified integration

This candidate preserves PR #340 parent
`d2d0ce960b65a510dd2529cca475262014eeacb9` and changes only the flight store,
its private-read test and this note. Both source files match the qualified author
source byte for byte. The parent has additional Native batting, foul and runner
work, so the complete integrated `src` tree differs from the qualified author tree.

A separate run on integration source
`59377748a3a8b8c89620b415a2c9be125fe9a958`, with `src` tree
`df8e05e3406dbbcea16b0c1ba358a019a4b4a86d` and full tree
`e1249d6f4bcf3b53b206762419a7c8949c75e3da`, completed at
2026-10-07 04:08:52 UTC. Compiler, catalog and all six complete files passed:
66 cases, zero failures, skips or exclusions. All eight stages exited zero and
reaped their owned processes; source, dependencies and controls remained unchanged.
The integration terminal SHA-256 is
`9a2580e13e4085cfcebd672b14c5224171520271c383343b322bb6a5f515ff03`.
This publication adds only this result-note update after that run and preserves
the exact tested `src` tree. The original author run and this integration run
remain separately attributed; they are not a combined 132-case qualification.

Scope is local flight private-read transaction/traversal behavior. This result
does not establish original SWING completion, repeated batted-play completion,
performance improvement or whole-project success, and is not added to the fixed
cumulative run. Raw logs, manifests, runtime controls and database/domain payloads
are excluded from this change.
