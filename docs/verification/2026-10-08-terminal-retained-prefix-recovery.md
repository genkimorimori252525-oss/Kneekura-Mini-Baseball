# Retained one-pitch recovery: test-only source preparation

The three-pitch P1 gate stopped at its unchanged 3600-second cap with no aggregate credit. Read-only inspection of a separate copy found one committed TAKE-0 row and a revision-1 physical head; that observation is not an authenticated closed checkpoint. The qualified A0 input and exact failed main/WAL/SHM tuple remain preserved.

This helper prepares a distinct recovery boundary. It copies every nonempty tuple member, compares the committed SQL view against a private A0 baseline, then authenticates the retained Source/result through existing original readers. It admits no pitch and does not initialize a World, actor, calibration or workload. Production files and the old three-pitch harness are unchanged.

The normal-owner derivation inventory is deliberately finite:

1. Current terminal readiness, including original completion and settlement, once.
2. Original physical recipe prefix, once, bound to that terminal's archived Source hash.
3. Retained physical history for game-1/play 8, once, requiring exactly TAKE-0 and actual count 0–1. Its existing original actor validator supplies the A0 actor proof; there is no separate top-level actor replay.
4. Current pitcher workload, once, matching the authenticated physical frame.

Those reads share one owned query-only transaction and the existing venue/physical traversal scope. Each reader retains its nested validation semantics. Timings describe complete top-level calls; nested calls are not falsely counted as independently timed derivations.

Synchronous bounded JSONL spans record a start before each relevant operation and fsync its record. Completed calls alone receive elapsed time. Failed or unfinished spans never become completed timing. The trace has fixed labels, at most 128 events and 64 KiB; the final receipt is written exclusively and fsynced only after all SQLite handles close and input preservation checks pass.

Normal WAL recovery and checkpointing occur only on the private copy. Exact raw row/schema censuses are persisted for A0, the recovered committed view, the checkpointed view and the reopened view. The only allowed delta from A0 is TAKE-0 plus its head. The full original proof occurs once; checkpoint and close/reopen must conserve that exact SQL view. The output is a closed main file after SQLite checkpointing, so its byte hash need not equal the input main file. The authoritative input remains the complete pinned main/WAL/SHM tuple, which is rechecked byte/stat-exact afterward.

Six new structural cases cover strict/inert controls, release refusal, complete nonempty WAL input, one-pitch row conservation, synchronous timing persistence and owner-error preservation. They do not fabricate any successful original Native reader. The absent helper API produced six intended RED failures. The six cases then passed; the combined recovery and affected continuation inventory has sixteen cases. Full and focused compiler receipts accompany the frozen source checkpoint.

The proposed genuine recovery gate selects TR-N01 only, with 1024 MiB old space, 1120 MiB measured heap, 2048 MiB RSS and an 1800-second wall cap. It retains a 6144 MiB immediate-prelaunch floor and continuous 4096 MiB available-memory reserve. This is a separate necessary one-pitch readback, not a rerun or cap extension of P1. No genuine recovery case has run at this source checkpoint. Further pitches remain separately held closed stages; recipe tuning, skipped owner checks and private-artifact publication are excluded.

## Frozen finite receipts

- recovery-red: config `b6c7481159e8cc83dde3a78872a1603436cad545565b992df94edb6f803aa737`, supervisor PASS, child exit 1, 0 passed / 6 expected RED.
- recovery-green: config `1ba09a9310847a3bd61e2c4bf5f2b1006394e62ea6b50638fb5ca3720fe6b276`, supervisor PASS, child exit 0, 6 passed / 0 expected RED.
- recovery-final-green: config `b79fcd6e2f1d4446fe9d68b5d5bf39e422a36cc318c9f3b7e5f86f0483164ef1`, supervisor PASS, child exit 0, 16 passed / 0 expected RED.
- recovery-final-root: config `6caf30af55f531fd94d603bce200f2268226702e954fb56852e395d3ea972b27`, supervisor PASS, child exit 0, empty compiler diagnostics.
- recovery-final-focused: config `379cb6f80ffa8f6d007af4d0b67803bba5e0cb5cb3d0320de9641dc64d4bf2cf`, supervisor PASS, child exit 0, empty compiler diagnostics.
