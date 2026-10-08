# Repeated-batted geometry prerequisite: episode field binding

This implements only the geometry prerequisite in the approved 2026-10-05 owned-batting-intent and same-PA foul-resume plan. A binding over the first real contact proves this prerequisite's provenance. It does not prove another admitted pitch, another foul episode, reset, participant accounting, or same-PA readiness.

## Staged contract

1. A references-only `batted_episode_field_binding_v1` Source names its own opaque Source identity, an original contact response, and an accepted field calibration. One immutable main-table row owns each physical pitch/response. It accepts no World, geometry values, model values, outcome, count, contact sequence, or next-pitch right.
2. Resolve the response, its exact zero-horizon original BatBallContact and original physical pitch, and the historical calibration on one real SQLite connection. Match game, career, fixture/revision, venue, accepted day, original batter and nine defender Player/Person bindings, empty bases and accepted model/body coverage. Recheck the new flight orientation and authenticated frame centers against the unchanged accepted calibration. No rotation, translation, substitute body, or rewritten archive is permitted.
3. Admission requires the new response's exact current flight head and open physical frame. Historical reads do not require today's head. Historical calibration verification must not call the old calibration's current-flight guard. The old public acceptance/current behavior is preserved.
4. Add an explicit `episodeFieldBinding: { version: 'batted_episode_field_binding_v1', sourceId }` field-action opt-in. Keep all legacy Source/snapshot bytes and v1 uniqueness. Do not mix this empty-bases opt-in with runner variants. The new durable root is discriminated by `rootKind: 'episode_field_binding_v1'` and carries the receipt. Its existing `geometry` is the unchanged historical calibration; its dynamic response and checked physical geometry come from the binding, never a counterfeit old geometry/flight object.
5. Field action and execution still use their existing concrete causal writer/fence. Every action in one prefix must have the same root variant and binding identity. Include that identity in private read cache keys. Root validation, physical prefix, territory, raw field execution, and owned scheduled motion all use one checked-geometry selector. Venue policy pins the binding hash on only the new arm and retains its own physical-pitch policy ownership.
6. Same-connection replay, canonical Source/snapshot hashes and scalar/JSON identity census reject moved/duplicate ownership and missing/corrupt dependencies. Read-only evidence installs no schema, preserves an enclosing transaction/settings, and rejects TEMP/attached substitution. Acceptance witnesses exactly its own insertion and rolls back all trigger side effects.

## Test order and qualification

- First RED: the exact-reference acceptance assertion after the existing real `battedWorldFieldFixture` has produced the real contact/response/calibration. A throwing-only scaffold makes absence visible without an import/compiler/fixture failure.
- Owner GREEN: immutable provenance/bytes, callbacks absent on retry, all-connections-close/reopen, strict inert references, model/Person/calibration corruption, hidden/moved/duplicate identity, trigger rollback and main-only writer-local WAL evidence.
- Consumer RED then GREEN: actual field action, prefix projection, execution and venue policy with the explicit binding arm; exact root-mode continuity; unsupported runner/missing/wrong binding rejection; legacy snapshots unchanged.
- Preserve existing base/field uniqueness, model replacement, field/prefix/response/venue and workload-current guards. Do not weaken their tests.

## Deferred proof

A genuine second admitted pitch with its own reset World must come from the separate lifecycle owner. Current frame centers and physical contact derivation cannot certify a not-yet-existing same-PA reset. A longer flight horizon is only a currentness negative test, never a second episode. No repeat-foul execution claim is made by this slice.
