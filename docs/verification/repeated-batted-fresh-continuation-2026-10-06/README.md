# Fresh closed-snapshot continuation: four recorded phases

Compiler, raw input preflight, Native physical-end reauthentication and official
application passed on the fixed Source
`f244a0c0065b783510b4607051c01b9818df35e0`. Each bounded supervisor invocation
exited with code 0, reaped its owned processes, preserved its input/control/Source
pins and qualified its phase checkpoint. Official finished at
`2026-10-06T09:43:32.872891+00:00`.

Role settlement and the next away-2 TAKE have not run in this record. Whole fresh
continuation remains pending. No repeated-batted geometry RED is established.

## Origin and attribution

The input is the published known-profile-ended closed snapshot, SHA-256
`585ab7862ab93991e97cd5032ba8d520e113635559aa0019b5dd9bd43257a04a`,
3,362,816 bytes. Its existing publication manifest is a projection of a persisted
state. It supplies no historical raw-producer admission, original construction
proof, original seal rollback proof or lost receipt inheritance. Current-source
Native reauthentication supplies a new prerequisite receipt before the fresh
official helper runs.

The tested production `src` tree is
`5f553f22ff2e371a3eedd47ed275e1434e248be5`, inherited from PR333 Source
`936a07033b47208b87aaf2fdefcb9eef057e3c49`. The LOCAL candidate is a
documentation descendant of fixed local `f244a0c`; its later local commit is not
the Source on which these results ran. Connector publication will use remote
PR333 `936a07033b47208b87aaf2fdefcb9eef057e3c49` as its actual remote parent.
The tested local `f244a0c` attribution does not claim identical metadata or
ancestry for a later API-created remote commit. The exact tested launcher and
production `src` bytes remain matched. [The run manifest](run-manifest.json)
records those distinct attributions, all full pins and the phase ancestry.

The six launcher files remain byte-exact at the reviewed `f244a0c` hashes:
`run.py`, `phase.ts`, `preflight.py`, `process-identity-reviewed.fragment.py`, the
launcher `README.md` and root `tsconfig.fresh-continuation.json`. The original
raw-producer entrypoint and its guards are unchanged.

The copied [configuration](configuration.json), [input manifest](input-manifest.json),
[Source manifest](source.sha256) and [dependency manifest](dependencies.json) are
the exact recorded controls. Their absolute paths describe the original private
execution environment. The recorded configuration requires an exact `f244a0c`
checkout and complete Source manifest; it will reject this documentation
descendant. The preparation review, static audit, dependency binding and launch
template retain their earlier preparation-time status fields. Their original
`executionPerformed:false` or held labels are not the current result status;
the phase checkpoints and supervisor terminals below are the execution record.

## Recorded results

| Phase | Observed result | Seconds | Peak aggregate RSS KiB |
| --- | --- | ---: | ---: |
| Compiler | Focused TypeScript compilation passed | 9.556 | 493,608 |
| Raw | Read-only closed input/schema/model preflight passed | 0.966 | 46,112 |
| Reauthenticate | Native persisted physical end reauthenticated under npb-2026 | 87.660 | 404,756 |
| Official | Existing official helper passed both INSERT faults, retry/reopen and exactly-once application | 2,075.660 | 488,512 |

The official receipt reports unchanged original physical tables, closed/reopened
connections, exactly one official application and a still-pending workload with
ten participants. Its explicit synthetic fixture policy remains identified as
such. Official scoring remains unsupported in this fixture/chain. The two witnessed rollback
obligations are `adjudicationDependencyAfterInsert` and
`officialApplicationAfterInsert`.

Each dependent checkpoint names the exact preceding checkpoint hash. Each
supervisor terminal preserves the externally supplied predecessor pin and the
captured chain. The official chain is compiler `90ba8e18` → raw `42ef97e7` →
reauthenticate `5aaebc41` → official `ddfdc02b`; the manifest holds the complete
SHA-256 values. Every published terminal has `freshContinuationVerified:false`
and `wholePipelinePassed:false`.

## Published evidence boundary

All four [phase checkpoints](checkpoints/) and [supervisor terminals](supervisor/)
are complete byte-exact copies. They contain process/control attribution and
proof hashes, without domain row payloads. The original receipt paths remain in
those unmodified records as attribution only; they do not identify published
receipt files.

[Raw](proofs/raw-preflight.projection.json),
[reauthentication](proofs/reauthenticate.projection.json) and
[official](proofs/official.projection.json) domain results are compact, explicitly
marked publication projections. Their new hashes identify their projected bytes.
Their `originalReceiptSha256` fields identify the separately retained original
proof bytes, as pinned by the phase checkpoints. A projection cannot serve as
raw producer admission, a replayable receipt or a phase predecessor input.

The official projection is built from an explicit whitelist of proof/ancestry
hashes, booleans and counts. It omits all row payloads, adjudication ledger,
timeline, Match/World snapshots, physical history and participant details. No
SQLite archive, pending private database, runtime log or process telemetry trace
is included. [The publication byte audit](publication-byte-audit.json) records
the metadata checks and credential scan over every new publication file and
the six exact launcher files.

Role and next remain separately scheduled complete helper phases on the fixed
Source, each requiring an independently captured preceding terminal hash. Their
closed checkpoints may be retained between coordinator-owned runtime slots.
Whole fresh continuation requires all six phases and closed outputs on the
declared Source/configuration/input/dependency pins. The separately reviewed
fresh repeated-batted input adaptation remains held for a real future next-TAKE
receipt, fresh artifact pin and raw census.

This publication preparation read JSON and source bytes only. It opened no
SQLite connection and launched no Node/compiler/test/helper/supervisor process
or shared runtime lock.
