# Paired closure authentication and original role continuation

This is a reviewed, source-qualified Draft checkpoint. It does not establish a
complete workload/next-pitch pipeline or a cumulative whole pass.

## Concrete change

A closure proposal previously authenticated the same physical end twice and
entered its physical-prefix reader repeatedly. The existing real-transaction
read traversal now supplies the freshly authenticated adjudication, sealed end
and prefix as one internal pair. Ordinary public read values and encoded bytes
remain unchanged. Caller-provided proof pairs are not accepted. Nontransaction
and proxy paths keep their original validation, and independent operations,
connection changes and writes retain fresh checks. No global cache is added.

The role-only artifact continuation verifies six raw read-replay files and the
original eight official-stage files before importing its helper. It rechecks
source identities, byte pins, replay controls, matching observations and the
closed input database. A read-only prerequisite check confirms the actual
registered rule profile, Match activation, ten original actors/Persons, existing
baselines and the exact explicit test assessment/baseline recipe. It creates no
assessment, workload activity or physical execution.

The existing complete role helper retains all ten participants, three real INSERT
rollback witnesses, stale-head rejection, interrupted settlement, historical
retry, full close/reopen and isolated recovery checks. The wrapper now carries
read-replay provenance independently of actual helper-call counts and requires
a real supervisor exit and hashed role handoff. Progress messages distinguish
starting an authentication from its actual return. Next-pitch execution remains
explicitly unavailable in this caller until its role-consumer admission is wired.

All effort, baseline and recovery quantities in this verification recipe are
explicit synthetic test inputs. They are not production calibration defaults.

## Observed evidence on immutable sources

- `de4c899467e73344f021cc6db9de6dff6e294b2e`: 68 Native cases and full
  TypeScript compilation passed for the paired read change, including transaction,
  mutation, connection and original proof protections
- `25a12f005dc8bc736c6848244fecc6f3e1d70aa5`: two fresh read-only connections
  authenticated the same real official-stage artifact in 100.715 and 98.459
  seconds. The outer attempt completed in 212.750 seconds, peak RSS 440,740 KiB,
  exit zero, all connections and owned processes closed. Both observation hashes
  equal `ef6d5de22635e3ffb4246aaf6c3fa475edd17508a8cf84a3e7d1b883c951c9ff`,
  exactly matching the preceding unoptimized read on `9350c20`. Original database,
  WAL and input/source bytes remained unchanged; no writes occurred. This is a
  measured comparison of this artifact, not a general performance guarantee
- `1c9581007c03b9a21e1370a80bb3e30e8b0700a2`: full compiler, 1,497 Node
  controls, 42 Python controls, admitted helper import, protected SQLite-free
  fourteen-file admission, the real read-only prerequisite check and preload
  rejection all passed. The small supervisor smoke then exited zero in 3.761
  seconds with all owned processes reaped

The paired replay raw terminal SHA-256 is
`b04c45400f344d8feebc3024d06e0b6c320cdf7f06ae029dcef18dab19bab7aa`.
The final caller preflight terminal SHA-256 is
`02af4ba7be3f61539f4655444c9f34a4d140cdc97e2e1ef1cc092ae3b82b7831`.
Its source-manifest SHA-256 is
`6827887fa4648c5342c85d056405a471ef3697bff733cb4d42ed2677ea73fe23`.
The original official INSERT/application proof remains separately tied to
`6eb9dd6`; none of these later read-only gates repeats that write proof.

## Current integration and outstanding gates

The reviewed 17 code/test/tool paths were applied to the latest practice/runner
stack as `bf94f9c381fa3d7b62b3d80892f416993d8e6ba2`. Every transferred path
matches the reviewed `1c95810` bytes, unrelated current source is preserved, and
`git diff --check` passes. The complete integrated source tree is
`bbef31471318e5bf179c8709c324bc3030490f8b`. Publication adds this documentation
only. The combined branch's focused tests/compiler have not yet run; the exact
source-qualified results above must not be transferred to it as a full pass.

The original ten-player role attempt began at 2026-10-05 12:54 UTC on frozen
`1c95810`, with a bounded 18,000-second wall limit, 1,536 MiB aggregate RSS cap,
1,120 MiB observed heap and a 7 GiB launch reserve. It is a single owned attempt
with no automatic retry. At this checkpoint the original closure and initial
pending settlement reads returned; no role success receipt or next-pitch result
exists yet. Preserve any eventual failed/interrupted outcome separately.

The latest completed cumulative whole remains PR #277. Later cumulative
verification, the current eight-case runner regression interrupted at its wall
limit, the 40-piece archive acceptance and the remaining nonvisual production
connections retain separate open gates. No new database or raw receipt is
included in this publication.
