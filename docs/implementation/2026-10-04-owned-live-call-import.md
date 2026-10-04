# Original live-call import into post-play adjudication

## Implemented boundary

`recordOwnedLiveCallImport` adds an `OwnedLiveCallImported` ledger event. The ledger event tick remains the monotonic post-play recording time. The embedded `OnFieldCall.tick` remains the original call time and may precede physical PlayEnd. No event or physical history is retimed, and no null-PlayEnd workaround is used.

The explicit `owned_live_call_import_v1` provenance carries the original game/play/pitch identity; one common original clock; exact called, available and imported elapsed times; and owner-qualified Source ID/version/source-hash/snapshot-hash references for the call, perceived play, policy, correct-rule evidence and optional communication reception. Availability is compared before quantization, including distinct exact times assigned to the same integer tick. Hashes and Source references are identity bindings, not proof of their own authenticity.

This bounded version imports the original live call before any other ledger call or review. It rejects a second original-call import instead of silently choosing an ordering for multiple live calls. Later ordinary calls and reviews retain their existing APIs. A historical call may bind an older already registered correct-rule snapshot, but remains stale relative to newer evidence until a legitimate current-evidence call/review resolves that staleness. Importing the old call never satisfies a later same-tick appeal-call obligation.

Recording and serialized replay validate the new inert shapes, finite safe clock, exact availability, play identity, unique event/call ordering and original rule-basis identity. The existing legacy event formats and serialized output shapes are unchanged.

## Native connection still required

This is a pure Core import contract, not an umpire, a Native authenticated call owner or a completed official closure. A Native importer must rederive each reference from the correct same-connection owner, bind the actual game/pitch and physical end, prove exact current availability, preserve original perception/policy/rule evidence, and enforce transactional/current-source guards. Core cannot authenticate the supplied hash strings or infer complete call history from their presence.

No production perception-error calibration, default umpire behavior, new review/challenge rule, true-OUT shortcut, or global PlayEnd certificate is introduced. Existing supported official-window and closed-state application gates remain authoritative.

## Verification scope

Tests cover a call at tick400 imported at tick500, retained exact availability, unresolved original evidence, stale historical evidence and later review, wrong Source/clock/root metadata, same-tick future availability, duplicate/reordered import, inert-input integrity, appeal separation and serialized replay.

The pre-import legacy call→review→closure fixture was generated from immutable `8eac874f95fe845bd7694032dd72506b08f701dd`: 2,278 bytes, SHA256 `d0170ec820ccd8545bc3bfb7716144831c45447f52a805d6bc4368d2f62139e3`. The committed regression test requires identical bytes under the new code without depending on a workspace artifact.

Final source commit `5869ebbf3815fe534f43769eceb85dae922427ca`, src tree `bb3903b4a00bdc25e84540a4795c34d9f662fdc6`: Node26 typecheck and 17 files / 122 tests passed in 4.75 seconds; all 1,830 tracked hashes remained unchanged. Independent review passed typecheck, 16 files / 118 tests and 33 separate adversarial tests, including 240 original-base legacy trace-prefix comparisons. No Critical/Important findings remained. Draft PR #281 publishes the exact reviewed tree. This is not a cumulative whole run or completion of the Native call/official pipeline.
