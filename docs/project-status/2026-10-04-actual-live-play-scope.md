# Native live-play scope v1: pending-only boundary

This additive milestone implements the original empty-base scope/projection boundary only. It does not implement physical PlayEnd, queue sealing, umpire call generation, official application, or an autonomous full-play generator. Design, UI and Presentation are unchanged.

Authority: Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` current Canonical handoff; Realism `4f0a60a3818926327b6bf5877ab3dec456a76530` world-first architecture/runtime/adjudication contracts. Historical DRAFT filenames do not override that handoff.

## Source and identity

`actual_live_play_scope_v1` accepts only an immutable Source ID/version, physical pitch Source, and an explicit cut:

- `original_pitch`: observes the original physical pitch root. It does not mean latest field execution and does not fabricate body models
- `field_execution`: identifies the original field Source and an execution Source or an explicit no-execution cut

The deterministic scope ID binds game, play and physical pitch. Different immutable Source rows are observations of different cuts of that same scope. They are not competing play authorities or an exclusive admission head. An unsupported root-only view cannot prevent a later supported field view. No registration fences physical writers.

Own-reader replay derives the batter and all nine defenders from their original Player/Person/fixture bindings. Supported field views require all ten physical participants and every original five-role body model. Original runners/nonempty bases remain unsupported. Their original IDs remain visible as unsupported participants, without invented bodies or motion.

## Runtime manifest and evidence

`original_live_play_runtime_domains_v1` owns required producer membership independently of SQL output discovery. It includes original pitch admission, bat/ball/field, custody successors, physical-rule consumption, communication ingress, umpire call, operative offense, live-rule windows, event generation/consumption and closure fence. Each original Player also has body motion, observation scheduling/sampling, actor decision, motor issuance and controller renewal domains.

The manifest names missing generators explicitly. Existing SQL tables/rows are evidence to reconcile; neither absent rows nor an absent table prove that a domain cannot create work. Metadata scanning covers complete relevant ownership/head claims. Bounded own readers materialize admitted observations, decisions and motors only through the selected physical cut; future domain payloads remain opaque while future ownership metadata remains validated.

Evaluation is separate from the immutable scope archive, so later owner evidence cannot be erased by an earlier empty SQL result. The archive also preserves bounded physical local-work history, and evaluation retains existing local lifecycle and successor projections. Their local queue claims never certify the global producer manifest. Only actual causally established work may enter information/decision queues. A missing observation scheduler is a missing generator, not a hypothetical forever-pending observation event.

## Closure and archives

Evaluation always returns `pending`, `playEnd:null`, and uncertified coverage. It reuses the existing Core registry/frontier with `terminal:none` and explicitly unsettled producer queues. Core's empty-source/current-tick and `queue:null` shortcuts are not treated as Native terminal proof. Actor policy settlement is not invented.

Acceptance rederives current physical roots and producer evidence before and after its same-connection WAL write. A scalar metadata fingerprint also detects head/ownership changes beyond the selected payload bound without interpreting future domain payloads. Reopen/read/retry rederive the original cut. Existing physical/raw/owned Source archives remain unchanged. No physical, observation, decision or motor writer was modified by this milestone.

## Remaining connection gates

- V1-B: actual source-owned generated/consumed event receipts, successors, quantizer-closed exact-tick generation certificates, fixed-point processing and participating writer fences
- V1-C: independent owned umpire perception/call, bounded causal communication and operative offensive retirement
- V1-D: a genuinely source-derived positive terminal path and immutable physical PlayEnd receipt
- V1-E: preserve original call availability/time through adjudication import and exactly-once official application

Arithmetic quantizer-boundary work alone is not an owned generation certificate. A true first-base OUT alone is not operative retirement. Post-play adjudication remains separate from physical termination.

## Verification at this checkpoint

Implementation base: `412c49582b8959049a95431ebfe875c096026e20`. Verified final `src` tree: `bd56a6150b7c565ce10a148ee90833c641a8794a`.

- Typecheck: PASS, terminal exit 0
- Adjacent Core registry/frontier/watermark/defensive-decision/scheduled acquisition/throw: 6 files / 101 tests PASS, 2.61 seconds
- Native V1-A scope, inventory, unsupported participation, local-work, integrity and store tests plus the existing known-work metadata suite: 8 files / 54 tests PASS, 239.10 seconds
- Before/after SHA-256 manifests: zero source mismatches for both gates

Node 26.10.0; dependencies installed independently with the existing lockfile and offline cache. Gates used separate shared light/Native locks, one Vitest worker and a disk-backed temporary directory. Test logs include non-failing environment npm proxy/update notices.

The tests include real Native original participants/models, observation→decision→motor ownership, original walk→next-pitch runner rejection, physical-source preservation, reopen/retry, stale cuts, hidden metadata aliases, future opaque payload bounds, and same-connection post-insert rollback. Metadata-only adversaries are not physical-provenance claims.

Independent review subsequently passed: typecheck, 43 metadata/Core tests and one real Native rollback/adoption/archive probe (305.23 seconds), with all original source hashes unchanged and no remaining Critical/Important finding. On the #279 integration, typecheck and 43 Core/metadata tests also passed; an additional current-tree Native store gate remains queued and is not counted as passed. The separate scheduled-motion v2 integration must reconcile these additive readers against its final source, especially actual motor-adoption lineage. Cumulative whole verification belongs to the final integrated source and is not claimed here. Draft PR #280 subsequently published the reviewed files. No merge, deployment, home-PC CI, workflow/configuration/lockfile change, visual work or production calibration was performed.
