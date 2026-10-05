# Actual next pitch: terminal and original-stage ancestry

Recorded 2026-10-05 20:34 UTC. The registered-profile original physical play,
official application, all-ten role workload and next physical pitch have now
passed as a sequential real-artifact chain with authenticated stage handoffs.
The final next stage was confirmed passed and reaped at 20:27 UTC. This document
publishes result descriptions and hash references only, with no database or raw
receipt payload.

## Fixed-source next result

The actual next source was `0b28f1a4b622b2002a15c546697659df0a84d18c`, full
tree `e6e86849a2b2d9dfbd36644d0e4f81d1064fc45b`, src tree
`8d10956204db362f9de772a00613b80190dbeb07`. Its 2,181-file manifest SHA-256
was `e3d8c69f40035eaea1d781d0a7a005a1cd8d80a8e0936e5cfc83bb5632d414b2`;
configuration SHA-256 was
`898d395cd94977e2e1aebffdcbe9b421045596457bee3574b9b32a3dc3a2b89d`.

The helper admitted the explicit `away-2` actor for physical play 8 and accepted
one new physical take. The pitch used the actual settled `p2` workload at
revision 1, fatigue 0.9, and added two timeline events. That fatigue is derived
from explicit synthetic fixture effort/policy inputs, not an inferred or
calibrated real-player assessment. The output added one actor, one physical
pitch and zero workload activities. Its totals are two actors, two physical
pitches, ten MATCH activities and zero RECOVERY activities.

The wrong-activation rejection and the real actor INSERT/readiness corruption
rollback both passed. Clean acceptance, same-connection actor and pitch retries,
closing every connection, and fresh reopened actor/pitch readback all passed.
The original physical, official and role artifacts remained unchanged. All
thirty inherited raw pins, Source and control checks passed, with no remaining
SQLite handles or owned processes.

The owned outer attempt completed in **5,704.338 seconds**, peak aggregate RSS
**498,352 KiB**, under the original 14,400-second / 1,536-MiB envelope. Node
26.10.0 used an observed 1,120-MiB heap limit. Both process exits and reap checks
passed without a guard. The stage terminal was written at
`2026-10-05T20:26:34.654Z`; the later outer confirmation includes final audits.
The 3,657,728-byte output main file was closed with an empty/absent WAL.

| Final next evidence | SHA-256 |
|---|---|
| Phase receipt | `5af4961b92dacb5534b6dec0be51ea92f1f1c0f5758abf06cd2df44f02326e1a` |
| Stage terminal | `5b3d87a58e95ba1af5c80db3af253fe3c0ae084291a3dc82aef334d5269463e1` |
| Supervisor process terminal | `9b011577f5ff948a9aceff650cb1d8302d68267ae520fdb15ad2c32ece4467a6` |
| Outer exit/reap terminal | `05f1172603b4e0b0ef94b9764cccdbf6290accd6b46d34cf56daf11bc26c3a0b` |
| Closed output main file | `32978dbf7accf15c29f27e8208800eb7638094224ee84dad79eb4770b492e721` |

`wholePipelinePassed:false` records that this process ran the standalone next
stage. Its counts are zero newly executed official/role helpers and one next
helper, with both original domain receipts inherited. It does **not** mean the
demonstrated sequential chain failed. It also does not claim a single complete
rerun on one source cut or completion of the remaining project plan.

## Receipt-bound ancestry

The next receipt retains the original stage identities and two distinct checked
read-replay carries. No original fault is relabeled as newly executed.

| Stage or compatibility read | Exact source commit | Original receipt/terminal SHA-256 |
|---|---|---|
| Registered-profile physical end/seal producer | `56d96a7728d21dc3b250e4e0bb5d8722fbc023c7` | `02531e471eb2130a800c76e44e1e5f6d6daa108049c5ceb25357cc1b4c4eaa0a` |
| Original official application | `6eb9dd6d6d46d6c6e9f8f2282b9b5ab45129bade` | `53d5db37bab135b14cd308ec804bbd084fdf219a1290c72f783e83b5b6fa3171` |
| Checked official-read replay | `25a12f005dc8bc736c6848244fecc6f3e1d70aa5` | `b04c45400f344d8feebc3024d06e0b6c320cdf7f06ae029dcef18dab19bab7aa` |
| Original ten-role settlement | `1c9581007c03b9a21e1370a80bb3e30e8b0700a2` | `062f62d4d228cf19e4689e2b28bd898e39dec802b505ba4466b2ea7849c3b0a6` |
| Checked settled-role read replay | `416da3bff5a32fe6682ad5df601b904ac84303e1` | `0eea054fe38d71f8759bdb45eb106a490c14803ebd6f6d0a346f58274b9fe690` |

| Ancestor Source manifest, as pinned by its receipt | SHA-256 |
|---|---|
| Physical producer | `d9a206f7b17c863584d1853cca41e15a1a0090259c7ef3fd17b9c13e1c08ad26` |
| Original official | `2b8b616ed8342af6005f6c3293c30c06a350a0f99addfee892fbb2db4bad0817` |
| Official-read replay | `f4ec2a41891aa86f447d1c8629b7f1f832ec4597feb54ff7b82dfb871d133d80` |
| Original ten-role settlement | `6827887fa4648c5342c85d056405a471ef3697bff733cb4d42ed2677ea73fe23` |
| Settled-role read replay | `212d62178551d031e1dd67ad78bc31008b3bd32ef2904f30b6478995c759378c` |

The producer's original pre-end input hash is
`64fc22bf43b656492aad85b6a8042e3862bd4fcf8132482cceca5f6109e8dc71`.
The closed file lineage is physical end
`585ab7862ab93991e97cd5032ba8d520e113635559aa0019b5dd9bd43257a04a`
→ official
`7d23d7006075f57685bbd3998ca8f92b5a01e3802d0f2c911a3e882b0032a953`
→ ten-role
`cc587072c7f7259b07e4dafb08452861121bbeb3a33f96c5689389b00b859a46`
→ the final next output above. The original end-seal INSERT witness remains
`85598590eba3406950a8dfbc11a5bb35741125396d1d11ab61f543c520fb2f76`.
Together with the two official, three role and one next-actor INSERT witnesses,
these retain all seven required write-fault boundaries on their own Sources.

The official replay admits only its exact three reviewed production pairs and
matches observation digest
`ef6d5de22635e3ffb4246aaf6c3fa475edd17508a8cf84a3e7d1b883c951c9ff`.
The settled-role replay admits only its exact four reviewed pairs and compares
two fresh read-only settlement observations against sealed DTO digest
`934b3d49b98a9314b723881fc0585c704873ea2002a8b4452871241bb237004d`.
Its reads took 85.456 and 90.161 seconds. Production equality is required from
each accepted replay to its continuation; ordinary continuation equality remains
strict. The next caller authenticates original official eight files, official
replay six, role eight plus two isolated regression artifacts, and role replay
six before importing the domain helper.

## Separate current-stack qualification

Integration `5054f44925c0261734450d3207b6067340feeeb4`, based on the public
#320 stack, separately passed the full compiler, **115 Native tests, 1,634 Node
controls and 56 Python controls**. Full tree:
`25c50a3dbf2d4b683b6654ee8c16bb676036b798`; src tree:
`8463baef3e59e76ebac4d868dff76a4805842efe`; 2,285-file manifest SHA-256:
`f2b461ac50bb7ed5b5628fb44082c12d5ab9d5fd31ec8660ce14e1c98e4677fd`.
Its successful qualification terminal is
`32da49d6918c1e36a5ed841ef70a2b30b4e6518dfa3764472123a7265ee7db1e`.
Source and controls remained unchanged; all steps exited zero and were reaped.

This integration retains the current original-batting-intent type additions.
Its fixture-only historical text reconstruction does not change the strict
runtime transition allowlist. The genuine `0b28f1a` result is not transferred to
`5054f44`: these are separately identified source-qualified results. This
publication checkpoint changes documentation only relative to qualified
`5054f44` and preserves its exact src tree.

## Remaining scope

Scoring for this bounded actual fixture/chain remains unsupported. `autonomousLineupSelection:false`,
`automaticEffortGeneration:false`, `physicalWorldRecoveryProven:false` and
`elapsedWorldRecoveryTimeProven:false` remain. The next world uses the accepted
`rule_system` discontinuous setup permitted by the adjudication contract; no
between-play walking trajectories or elapsed-time recovery are claimed.

The latest completed cumulative whole remains **#277: 697 files / 5,159 tests
plus typecheck**. Current cumulative whole, the 40-piece archive, same-PA foul
resume, next batted-ball episode/geometry, actual review and causal legal
branches, received-call controller consumption, general runner/player behavior,
Manager practice and wider competition/Career work retain their separate
remaining boundaries in the [nonvisual plan matrix](../project-status/2026-10-05-nonvisual-remaining-matrix.md).
