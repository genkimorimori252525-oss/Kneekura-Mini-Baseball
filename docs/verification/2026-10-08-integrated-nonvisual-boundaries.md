# Integrated nonvisual owners: bounded current qualification

This candidate combines the existing recovered owners on the preserved PR359 baseline and fixes one demonstrated interaction between activation readiness and terminal pending state. It is a code integration checkpoint, not completion of the nine-part plan or a whole-game result.

## Exact source and preservation

Baseline local commit `d2f8aa24d2716c817eb42c7430eec9c6210b8017` has source tree `b3b4e9aa53c142d26a1534a8ffdb0f5b9fdaf1a7`, matching [PR359](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/359). The fresh final qualification is on `f4422c39dc8599ca078c0c93eb0ab26b39cd62a4`, source tree `f1dd4d37cc446ed095034e1ab02d62e4c529461b`. This note is added afterward without changing source.

The scoped import comprises 81 source paths: 58 additions and 23 modifications, with no deletions. It includes PR352 paired-prefix, [PR354 readiness](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/354), PR351 projection/PR353 queue, [PR355 journal](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/355), [PR357 shared writer](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/357), [PR358 pending application](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/358), [PR360 acknowledgement](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/360), [PR356 participation](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/356) and [PR361 episode binding](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/361).

The immutable endpoint donors are PR354 `ff33cbc915bb8938df5010fd40d65f9260d0fde0`, geometry `5395c8023b3fb71c6b9686ed00fee1a67df42d0b`, acknowledgement `c89a120dbfc3a08495ef23de90a90a996be66754`, and participation `41524921ea8f3ec1acd3160c1f16389145a3c0b1`. Later acknowledgement test-only changes and PR362's Native received-call bridge are not included. Eighty imported paths retain exact donor blobs. Only `ActualLivePlayClosureEvidenceFromSqlite.ts` combines independent changes.

An additional integration test, two narrow legacy test/support repairs and one focused compiler config make 84 changed source paths plus one config. All 18 protected stance/runner paths retain their baseline bytes. PR359's Manager, practice and received-call Core work remain intact; no older complete source tree was overlaid. Independent source review found no blocking issue and verified the exact donor/preservation boundaries.

## Demonstrated routing defect and repair

The readiness change introduced a shared private checker used by activation inside a caller-owned Native transaction. A mechanical merge placed the pending-terminal guard only in the older public assertion. That left the paired route able to return an absent activation despite a surviving terminal or pending claim.

The new real in-memory SQLite regression observed exactly three intended missing-throw failures on the bare-transaction route, while 13 public/autocommit/clean/historical controls passed. Moving the existing guard to the shared checker before its early return made all 16 pass. The tests cover a sole pending application, escaped duplicate-array acknowledgement ownership, damaged application identity retaining original Match/PA scope, unrelated later-PA state, missing/null controls, unchanged row/schema bytes, transaction ownership, query-only restoration and read-frame cleanup. They fabricate no successful physical or official result.

The first full-root compiler then found four diagnostics in old fixture types: `Omit` had erased the new root variant relationship, and one legacy Source spread had not excluded the episode opt-in. The repair narrows only those two test/support files to their intended legacy variant. Production unions, parsers and authority checks remain strict; no cast or compiler suppression was added.

## Fresh final validation

On final source `f4422c39`, the unchanged full root TypeScript compiler passed with exit 0. It used pinned Node 26.10.0 / TypeScript 5.6.3, `--noEmit --incremental false`, a 300-second wall cap, 1408 MiB oldspace, measured 1504 MiB heap and 2048 MiB aggregate RSS. Peak RSS was 1,602,408 KiB. Its owned process was reaped, no descendants remained, and source/dependency/control/runtime snapshots were unchanged.

The combined guard batch then passed **131/131 cases in nine complete files**, with no skips, suite/unhandled errors or surviving owned processes:

- 31 existing activation-readiness pairing/transaction controls
- 60 pending/acknowledgement metadata, schema and public-admission controls
- 24 shared official-writer parity/rollback/retry-ordering controls
- 16 integration routing cases, rerun on this final source

This private batch used existing synthetic/raw/tiny-SQLite fixtures, one worker, 512 MiB oldspace, measured 608 MiB heap, 768 MiB aggregate RSS and a 180-second cap. It completed in 36.93 seconds with peak RSS 390,732 KiB. All four input groups stayed unchanged. The earlier 16-case GREEN overlaps this final 131; it is not added again.

| Evidence | Terminal SHA-256 |
| --- | --- |
| Routing RED, three intended failures | `543bc29450a228bd0e2dcbae87fbca564f7664d96f02acae9ada1d9739c3e26e` |
| Initial routing GREEN, 16 cases | `ac9459034d208910b3a7a0a90932f162624fefd5d4bdcbf1c39b013ed0f950f2` |
| Failed pre-repair root compiler | `8da4a482fa09d9f0421cfd1b20ab6af964cfadb7f61b660c00422ac6d21f3afd` |
| Final full-root compiler | `1b751acd4414c9515b57b09ca5748986e2dfa24c738910c74128a78285f7c49c` |
| Final 131-case guard batch | `71cdbe701643ba742f60e7c03d3ff739aa8eea4f79dbf0040bd973ea9564d29a` |

The final test report SHA-256 is `4fc79225bc35178b55922d014d2b32f2f93ac44dbe92728c6dcd25654b78d831`. Failed attempts remain failed; expected RED assertions are not GREEN credit. Private raw reports, database files, manifests and telemetry are not included in this note.

## Remaining scope

The imported participation artifact helper retains its donor-only config references (`vitest.participation-admission.config.ts`, `vitest.participation-initial-artifact.config.ts`, and `tsconfig.participation-admission.json`). Those three configs are not in this source-only integration, so its genuine participation artifact gates cannot run here unchanged. Their prior results remain donor evidence; the full compiler and selected 131 guards do not use that artifact-helper entry.

The imported cuts' standalone genuine results retain their original source attribution. They are not new combined-source acceptance: the six-phase continuation, terminal application/acknowledgement, participation and episode-binding physical consumers have not been broadly rerun here. Whole-current, full Positive, original construction, actual same-PA foul resume, repeated batted play, real SAFE/review, general autonomy and Career remain unfinished. Terminal scoring/workload/completion and the Native received-call bridge are separate active cuts. Held runner semantic capture and inherited-Proxy work, UI/design and PitchArsenal remain outside this integration.

No home-PC workflow dispatch, merge, deployment, visibility change or private artifact publication is part of this checkpoint.
