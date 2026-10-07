# Received-call pure Core qualification — 2026-10-07

## Change

`deriveReceivedUmpireDefenderReplan` connects a received umpire call to the existing local defender chooser and timing kernels through explicit OUT/SAFE profiles. Original perception, owner bindings, cause and incumbent command remain stable across retries. Missing semantics or an unsupported winning intent stays pending. After timely cognition, reaching or passing the first-step boundary retains `renewal_due` and its original due tick; this does not certify later physical execution.

## Source and executed result

- Tested source: `e0bfaa78b6bd15a06e17b8a015fc5562df09f298`, based on `10934028ff85b00b38b37142dfeda45b9e3c0814`.
- Tested `src` tree: `f77286c72c8809ccf255da1bc9ea3d30fbcb701c`. Publication transports these source bytes unchanged onto the PR #340 documentation baseline.
- Completed at 2026-10-07 02:02:55 UTC: fresh compiler (34.337 s) and catalog checks passed, followed by 56 current and 36 adjacent Core cases: 92 PASS, 0 failures, 0 skipped/pending/todo.
- Current cases: 1 public-entry assertion, 52 adapter/control cases and 3 reached-renewal regressions. Adjacent cases cover defensive decision/replan, decision/first-step timing, perceived world and exact event time.
- All stages exited 0; owned processes were reaped. Source, dependencies and controls remained unchanged.
- GREEN receipt SHA256: `7a7bd746811fe262ddc2949d97b3e40a68fb6a9421e38bd5fcc9e0d01108071a`.

The prior missing-public-API RED at `93fc699` and three-case renewal-eligibility RED at `73a1226` are retained separately. In the latter, the exact first-step boundary passed while the later integer/fractional cuts exposed the incorrect missed-commitment phase. Their receipt SHA256 values are `495e4136fbdcc7f4454e11358751c20d68320c748edf309e5c283f2b60b56149` and `4b748350ccc256d276d5c920b0fbf63369f1039d8482ed2f66348a6da2b8ed8a`.

## Remaining boundary

The separate Native prerequisite at `dbb032dd43d6ce3856a9a6b921af63569b897215` passed compiler/catalog but reached the 1,200-second wall cap during its Native stage. The stage exited -15 and was reaped; no completed test count qualified. Its failed overall receipt SHA256 is `46d208de679be3ca45e7eaee31b8176dd6c930c65476bce9073b4984ccc5ae4e`. This is a failed qualification gate, not a passing or skipped Native test.

The pure Core result does not qualify the accepted policy Source validator, Native replan/renewal ownership, SQLite persistence, physical adoption, received-call controller consumption, PlayEnd integration or the whole plan. `received_call_controller_consumption_pending` remains a real boundary. Production release remains held.

The 92 cases belong only to the tested source above. They are not added to the separate cumulative run on fixed source `10934028`, and do not replace historical failures or incomplete gates. Publication preparation uses static byte/tree checks and does not rerun compiler, tests or Native stages. Raw logs, manifests, terminals and private database/domain artifacts are not part of this change.
