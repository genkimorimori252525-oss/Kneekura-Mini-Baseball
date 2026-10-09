# Genuine received renewal adoption

The genuine Native zero-horizon adoption is qualified. The physical owner adopted the received renewal motor at the existing cut, advanced its ownership head from revision 10 to 11 and left `physical_continuation` explicitly pending. Elapsed time, ball state, custody and all fifty actor positions/velocities remain unchanged.

The tested harness is `6bcc543873eeee65ae892fe29db9bf9ba0e3bdf2`, source tree `71b99c9452fa83ba6f6a68dbbd55e58e59148a05`. Production ownership remains the reviewed `45ff861d` boundary. The case uses actual Native model, self, received and physical owners. Its caller provides only references; no prior producer or C/D/M acceptance is repeated.

## Closed result

- One case passed in **1,202.081 seconds**, exit 0, with no surviving owned processes. Peak aggregate RSS was **660,012 KiB**.
- Exactly **four Native row changes** occurred on one connection: physical execution INSERT, physical-head revision 10→11 CAS, renewal-head stage 3→4 CAS and fourth renewal journal INSERT. Ten reference-only Source callbacks ran.
- The output has **80 tables and 154 rows**, with identical schema. Every previous physical execution, renewal owner and journal entry remains exact. The original physical-head CAS is the declared exception to prior-row conservation; all other original rows/heads and twenty-four legacy admissions remain unchanged.
- The actual stored discriminator is `received_renewal_adoption_snapshot_v1`. The receiver's new root authority names the renewal motor; the other nine root commands/authorities and all fifty retained role authorities remain intact. Full actor-key equality excludes duplicated or missing Player/role pairs.
- Adoption and executed-through timestamps both equal the complete authenticated existing clock tuple. Accepted command coverage remains bounded by the existing model and each role's separately owned authority. No positive-time movement is claimed.
- The family counts remain separate: nine old received claims, eight renewal-table claims and one new physical-action claim. Both game/play-only and pitch-scoped legacy ingress remain fenced.

Terminal: `9a7ed0deabef36edf3b49fe71cee699597f6289a40e9f2b264afa83b84684989`.
Independent inspection: `72b1733932ef817080a792937d3f08f955902dfa61773367bf4cdc5dd3d4ff8d`.
Closed checkpoint: `14246c9a10da06b7e518c347275b59459785016d87e88a27d7ca231be92ab74b`.

Independent inspection used raw tuple copies and immutable SQLite reads. It checked every preserved row/schema, the physical archive and lineage, exact head changes and journal hash, all ten contributions and all fifty actor continuities. Seven fsynced milestones closed: acceptance start, four explicitly uncommitted write observations, actual owner return and the final closed receipt. The private Native connection closed cleanly with restored transaction/query-only state.

## Controls and remaining boundary

The gate retained **2,400 seconds wall / 2,340 seconds test**, **1,024 MiB requested heap / 1,120 MiB measured limit / 2,048 MiB aggregate RSS**, **6,400 MiB launch headroom** and a **4,096 MiB live reserve**. Eight renewal derivations authenticate 32 old received envelopes; adoption also performs six outer physical traversals, two old-cut qualifications and two adopted physical-current checks. Those operations were inventoried separately. All source, dependency, runtime and control groups remained stable.

All four genuine renewal write stages now have their concrete **3/3/3/4** boundaries qualified. The earlier eight received stages and their original attribution remain closed. Separate callback-free cold reopen/retry and public pending-work projection checks remain to qualify this adopted endpoint. Positive physical continuation, SAFE/game closure and production calibration receive no credit here. Private databases, logs and control manifests remain outside the repository.
