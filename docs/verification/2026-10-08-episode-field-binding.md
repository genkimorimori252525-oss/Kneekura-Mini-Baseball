# Episode field binding qualification — 2026-10-08

The bounded geometry prerequisite is implemented and qualified: an immutable, references-only `batted_episode_field_binding_v1` owner and its explicitly selected field consumers. This does not establish a second pitch, repeated foul execution, a same-PA reset, workload coverage, or a next-pitch admission right. Those remain the separate lifecycle owner's responsibility.

## Implementation

- One main-table receipt owns each original physical pitch/response. Its Source names only the original response and accepted field calibration. The writer rederives Player/Person, fixture, day, original newly appended BatBallContact, accepted models, orientation and authenticated base centers on its own connection.
- Historical calibration reads use a calibration-only factory and retain the original flight/archive unchanged. New admission requires the response's exact current flight head and open physical frame. Historical binding replay remains readable after an actual same-pitch flight advance.
- Field actions opt in with `episodeFieldBinding: { version, sourceId }`. Their durable root carries `rootKind: 'episode_field_binding_v1'` and the complete receipt. Legacy Source/snapshot shapes and v1 geometry/model uniqueness stay unchanged. Both runner field variants reject this opt-in.
- Root cache keys and every field prefix preserve binding mode and Source identity. Pure physical/territory projections additionally compare complete receipt bytes. Field execution, owned scheduled motion, observations, umpire, physical end and closure geometry use the shared checked selector.
- Venue policy keeps its existing calibration hashes and physical-pitch ownership. Only a bound root adds `episodeFieldBindingHash`; the requested legal-observation cut must match it.
- Evidence reads install no schema and preserve caller transactions/settings. TEMP/attached authority, moved/duplicated Source claims, nested dynamic identity claims, corrupt dependencies and extra INSERT effects reject. Immutable retry works with no authority supplied; when authority is supplied, conflicting Source content still rejects.

## Observed qualification

The qualified implementation/test/compiler files are individually SHA-256 pinned in a private verification index. The final local implementation commit is `5395c8023b3fb71c6b9686ed00fee1a67df42d0b`, src tree `1be9e27254f69af950abcfdcdfe93bd753a0ab15`. The admitted pre-documentation source-tree hash was `647ee377a987ce6c49715b6bd6a607f08c9a345c0ff00bd629f49e7562ed06f6`. Only this verification document and the private result index were added after the final gates. The detailed index remains private; its SHA-256 is `585e25d8543545ebf7d345349c2d9c8d54f1ce9b189a88d8b9645f632e1826e2`. This publication contains concise source/result metadata only.

All 223 selected cases passed, without final exclusions:

| Gate | Passed cases |
| --- | ---: |
| Immutable binding contract | 32 |
| Admission, history, identity, own getters and Person dependencies | 10 |
| Writer-local WAL, rollback, main-only reads and complete reopen | 10 |
| Explicit field consumers, raw/owned motion and venue observation | 17 |
| Two-action replay/reopen, warm/nested caches and pure-prefix receipt integrity | 8 |
| Existing base geometry | 17 |
| Existing World contact | 13 |
| Existing contact response | 14 |
| Existing field store | 12 |
| Existing field WAL | 14 |
| Existing physical prefix | 12 |
| Existing body-materialized models | 20 |
| Existing venue policy | 37 |
| Existing venue boundary | 7 |

The nine existing preservation test files are byte-unchanged from `3fbd3a41513d20e2415c12f809d1c96ef1d8c891`. Strict focused compilation with `tsconfig.episode-field-binding.json` passed. This is focused qualification, not a whole-project `npm test` or `npm run verify` result.

Each gate used Node 26.10.0, one threads worker for Vitest (compiler child0), 512 MiB old space, the verified 608 MiB V8 heap limit, a 768 MiB aggregate child-RSS ceiling and a 120-second external cap. Dynamic monitoring required at least 2 GiB system headroom. The maximum observed RSS was 468.51 MiB; the slowest stage was the existing body-materialization suite at 119.53 seconds. Every final terminal has exit 0, unchanged source/dependency/control/runtime snapshots and no remaining owned processes.

All SQLite fixtures and outputs were newly created in private run directories; no retained database was used as input. Private copied controls/locks isolated these gates from the coordinator's shared lanes. The original held first-RED config and original controls retained their recorded hashes. No CI, merge, deployment, publication, private database upload, UI/design change, or held shared runner/Proxy repair occurred.

## Test-first evidence and corrected attempts

Five scoped RED gates observed six intended behavioral failures after genuine physical setup: missing binding acceptance, missing consumer opt-in, mixed complete receipt bytes, two hidden nested ownership claims, and direct Source-identity getter evaluation. Their exact reports/config hashes and explicit zero-credit exclusions are recorded in the retained private index. Neither a longer flight horizon nor a second field action was represented as another physical pitch.

Three earlier attempts were not credited as final qualification:

1. The first RED reached the intended scaffold assertion, but Chai shortened its JSON failure message. The strict supervisor rejected the report. A private reporter setting disabled truncation, and a fresh run qualified the unchanged assertion.
2. The first consumer GREEN had 15 passes and one fixture mismatch: the venue policy requested NPB while the original fixture used `test-rules`. The test now accepts the NPB profile at original fixture creation; the final full consumer suite passes.
3. The first focused compiler found a conditional-spread union inference error. Returning the explicit legacy/bound branches fixed it; strict compilation and all final runtime gates then passed.


Representative final terminal hashes: focused compiler `54bb7be33b4e8e4255d77da1b9b38a3aefa5e4897b3fa9d80b0b6e7e6bb38c63`; owner contract `95f5258ff3b52bca89d016bf859af2c213ca712eafd010ae517766b6b96f98b7`; full consumers `9aee98c4527dc4cb202b0707c834deec64ed792e902f748e9d12589277c51d9c`; WAL/reopen `8ef7f3990d1241d60c51b55c258418b3cb9725750b436d00c5c646ba4acbf9a2`; cache/prefix supplement `6c3ae56edac5a2c08967e52d9dcbbeb43242d0800f85efe257ebdfabab2a2558`. All 15 final terminals and their test reports were independently rechecked before publication. Private databases, raw logs, control manifests and the detailed result index are excluded.
