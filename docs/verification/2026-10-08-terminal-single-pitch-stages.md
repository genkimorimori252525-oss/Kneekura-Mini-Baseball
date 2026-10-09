# Separately closed terminal continuation pitches

The next input is the genuinely qualified recovered TAKE-0 checkpoint, not the failed aggregate P1 output. TAKE-1 accepts only that closed one-pitch lineage. TAKE-2 accepts only the actual qualified closed TAKE-1 result. Each stage copies its exact predecessor exclusively and admits one existing-owner Source at the expected revision. Source IDs, delivery/effort values, calibration owners and nine-inning policy remain unchanged; the existing materializer derives chronology from the preceding accepted result.

The harness fsyncs an `owner_returned` observation immediately after each real accept and idempotent retry returns, before any later replay or close can fail. The observation includes the exact Source/result hashes and progress revision. It is evidence of a returned operation, not a closed-stage qualification. A later failure preserves those observations and the private output; it cannot undo a possibly committed write or promote P1 to PASS.

TAKE-1 must produce actual active count 0–2. TAKE-2 must produce actual strikeout. A full original readback then checks the result and exact Source, the one-row addition and existing-head advance, and all unchanged original rows/schema. Handles close, the output is synced, and ordinary Native query-only reopen proves exact raw conservation. No closure, official score, workload effect or actor selection is performed. Future admissions still authenticate original owners afresh.

The two stages use bounded synchronous timing plus returned-write events. The pending input and output identities, one selected case, all dependencies, source, runtime, controls, memory limits and predecessor qualifications belong in each separately reviewed Native packet. TAKE-2's input hash cannot exist until TAKE-1 passes and closes; preparation refuses to invent it or skip the predecessor.

Six new structural cases were observed RED for the absent helper API, then GREEN. The combined step, continuation and retained-recovery inventory has 22 passing cases. The tests cover strict/inert controls, release refusal before artifact access, predecessor order, exact row conservation, actual outcome guards, and durable observations surviving a later failure. They do not fabricate a successful original Native reader.

The proposed per-stage envelope preserves the existing 3600-second wall cap, 1024 MiB old space, 1120 MiB measured heap and 2048 MiB RSS. Prelaunch available memory must be at least 6144 MiB, and the 100 ms monitor continuously preserves 4096 MiB. Only one of the two Native cases may run per packet; the other receives zero skipped credit. No new pitch has run at this source checkpoint. The original P1 result remains failed with zero aggregate credit.

## Finite source receipts

- step-red: config `5638782d456c6e2c1b72a780e36fd8c2ee79769f97876cef5eba7e5fae73331a`, supervisor PASS, child exit 1, 0 passed / 6 expected RED.
- step-green: config `4bd1e6e381efc451902d15ec459e1a5d428c4845d43b3026cd5531be100c1ecb`, supervisor PASS, child exit 0, 6 passed / 0 expected RED.
- step-compat: config `12226f535d748597253310b961741e8c69374381676fed9615567ca920fa77c1`, supervisor PASS, child exit 0, 22 passed / 0 expected RED.
- step-root: config `f85d15266e4bf3eb22ff7f33453c4054596301354ef7cd10f18dd1ab5b7c0153`, supervisor PASS, child exit 0.
- step-focused: config `29c03b1a3f8c292b6a071537aa441c567eacf281e9cd4975f56f89c8b8f020fc`, supervisor PASS, child exit 0.
