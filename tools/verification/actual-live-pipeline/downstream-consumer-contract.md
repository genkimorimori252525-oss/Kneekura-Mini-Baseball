# Bounded downstream handoff consumer

This is a source-reviewed continuation draft. The entry points still reject role-only and next-only execution. The semantic contract passed 464 Node cases and 20 Python methods after its observed RED; the strict file boundary passed all 256 cases after its separate 12-pass/244-feature-failure RED. These pure controls establish their bounded admission behavior, not execution of an actual role or next stage. Neither domain stage has run.

The role-only input must explicitly pin eight distinct files: successful official handoff, outer terminal, stage terminal, supervisor terminal, official receipt, original run configuration, prior frozen Source manifest and closed official output. Byte/hash/WAL metadata loading precedes domain helper import. The outer receipt must confirm actual supervisor exit zero, validated handoff existence/hash, successful reap and no surviving process. The official handoff/receipts must match exact Source and producer lineage, both witnessed INSERT faults, one original official application, zero new physical pitch actions and exactly one official helper execution.

Prior Source bytes must remain pinned and unchanged. The new and inherited manifests must have identical production Source file names/hashes; only explicitly reviewed test/helper/tooling changes may differ. Source identity is carried separately for each stage. A new orchestration cut cannot silently relabel an earlier receipt as belonging to its own Source.

The consumer records the official receipt as inherited evidence. Its current-run counters start at zero and may increase only for its selected role or next helper. A stage result stays distinct from a complete all-stage run. Each new stage must preserve an independently audited closed output and a hashed handoff so that continuation never rebuilds an already passed expensive stage.

The existing explicit all-ten effort vector, accepted baseline Sources and calibration rates, isolated recovery/stale copies, actual INSERT rollback witnesses, all-close/reopen/retry requirements and explicit next batter/take inputs remain unchanged. No domain owner changes, automatic retries, fabricated completion flags or implicit missing policy defaults are allowed.

The downstream helper read placement draft reuses the previously tested synchronous read-transaction utility around initial role context, next readiness before/after rollback, original pitch reading and final reopened actor/pitch readings. Actual writes remain outside those groups. It still requires a scheduled test/typecheck and independent static review before execution.

## Concrete continuation boundaries

Role-only execution inherits exactly one official receipt and executes the existing all-ten workload helper once. Its output handoff pins the supervisor and stage terminals, the current role receipt, the closed output and the prior official binding. The two isolated regression artifacts are bound through the role receipt and the next continuation's explicit input binding. The handoff is written after the supervisor terminal; the outer terminal is written last and pins the handoff. Therefore, a stage terminal alone cannot authorize the next stage: the outer owner must observe actual supervisor exit zero, complete reap, the handoff bytes and all referenced closed artifacts.

Next-only execution inherits the original official and role receipts and executes the next-actor/pitch helper once. Its current counters cannot include either inherited helper. Its final receipt must match the supervisor's audited receipt list and retain the two inherited references in their original order. A successful final continuation remains `wholePipelinePassed: false`: it proves one new stage plus authenticated prior evidence, rather than three helpers executed in the same attempt.

The strict Node file/semantic admission must check inherited evidence before using its output as a helper input. After execution, the supervisor and outer owner independently recheck retained hashes and WAL metadata. Canonical absolute paths must retain their resolved identity before reads. Prior Source verification includes the original commit/tree, clean tracked bytes, the full file census and rejection of Source symlinks. The Node loader and outer JSON pin checks decode the same bytes that were hashed.

The next receipt retains `physicalWorldRecoveryProven: false`. The bounded path uses the existing authenticated rule-system world setup outside the closed live action. This flag does not claim physical return trajectories, and it does not remove the required closure, terminal, workload-head, actor and next-world bindings.

## Remaining execution gates

1. Preserve the separately passed semantic and file-boundary gates and their observed RED evidence.
2. The role owner's accepted-activity read transaction has passed its four new controls plus thirteen adjacent cases and the full compiler. Because that is a production change, keep ordinary Source equality strict and review the separate [read-replay transition proposal](official-read-replay-transition-contract.md). Both runtime holds stay in place until that route has its own observed RED/GREEN and review.
3. Freeze one combined continuation Source with the reviewed helper read brackets, exact required wrapper files and compiler/import/control evidence. Admit the actual original eight-file official proof and new replay proof through the strict byte/semantic boundary, then run the positive supervisor/lock smoke and bounded real-artifact measurement.
4. Bind the successful original official output and explicit replay proof to one reviewed, budgeted role-only attempt. After its complete terminal/reap/handoff audit, bind its fresh evidence to one next-only attempt. Neither step retries automatically or rebuilds the accepted official stage.
