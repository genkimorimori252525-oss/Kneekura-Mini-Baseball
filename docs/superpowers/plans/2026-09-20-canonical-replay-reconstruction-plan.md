# Canonical Replay Reconstruction — Future Implementation Plan

**Date:** 2026-09-20  
**Status:** **FUTURE REFERENCE PLAN — NOT IMPLEMENTATION-AUTHORIZED**  
**Scope:** Replay Core / persistence / deterministic reconstruction  
**Not owned by:** ChatGPT Work visual design  
**Implementation trigger:** explicit future user approval only

---

## 1. Purpose

This document preserves the replay architecture idea for future implementation.

It does **not** select replay as the next task and does **not** authorize an implementation agent to begin coding it.

The core idea is:

> **A replay should preserve enough canonical numeric truth to reconstruct the baseball world, then let a Presentation renderer observe that reconstructed world again.**

The replay system should not primarily save a video, and it should not regenerate a plausible animation from only the final play result.

```text
canonical match truth
        ↓
durable replay evidence
        ↓
world reconstruction / seek
        ↓
renderer-neutral replay observation
        ├─ Mini: Drone-Art / 4px / 55ms
        └─ future Natural: 3D renderer
```

---

## 2. Replay truth versus presentation

Replay truth belongs below Presentation.

The authoritative replay source should come from canonical simulation evidence such as:

- versioned match/replay metadata;
- deterministic simulation inputs;
- seeded randomness identity;
- canonical events;
- periodic canonical world snapshots/checkpoints;
- actor/world identities and state needed to continue reconstruction.

Presentation data may be stored as convenience metadata, but it must never become the authority that decides what physically happened.

A replay renderer may choose a camera, HUD, speed, zoom, or visual treatment. Those choices do not modify:

- canonical positions;
- canonical event times;
- possession;
- base touches;
- tags;
- OUT/SAFE;
- runs;
- official rulings;
- final match state.

---

## 3. Result summaries are insufficient

A box score or play summary is useful for indexing, but it is not sufficient for faithful replay.

For example, these facts:

```text
batter: single
runner: scored
RBI: 1
```

do not uniquely determine:

- the ball path;
- bounce locations;
- defender routes;
- throw path;
- runner timing;
- exact close-play margins;
- where every actor was during the play.

Therefore future replay implementation must not reconstruct a supposedly canonical replay from result labels alone.

A generated "single animation" or "flyout animation" is presentation fiction unless it is backed by the original canonical play evidence.

---

## 4. Recommended persistence model

The preferred future model is a **hybrid event-log + checkpoint/snapshot architecture**.

### 4.1 Match/replay metadata

Persist enough identity to interpret the replay safely:

- replay format version;
- game/build/simulation version;
- rules profile version;
- ballpark identity/profile version;
- roster/player identity versions as required;
- deterministic RNG seed/state identity;
- match identity;
- canonical time origin;
- compatibility/fingerprint information.

Exact schema is intentionally deferred until implementation.

### 4.2 Deterministic inputs

Persist external decisions/inputs that can affect canonical simulation, for example:

- manager commands;
- pitch/batter intent inputs where externally selected;
- defensive alignment changes;
- substitutions;
- approved debug/replay-relevant discontinuities if the production game allows them.

Do not infer these later from outcomes when they are required to reproduce causality.

### 4.3 Canonical event log

Persist immutable or append-only canonical events required to describe what happened, including relevant physical and rule/adjudication events.

Examples may include:

- pitch release/contact;
- bat-ball contact;
- ball-ground/fence/actor collisions;
- catches and secured possession;
- throws/receptions;
- runner/base touches;
- tags;
- PlayEnd;
- official adjudication/closure once those systems exist.

The exact event vocabulary should reuse production canonical contracts rather than create a replay-only parallel truth.

### 4.4 Periodic world checkpoints

Persist periodic canonical world snapshots/checkpoints so replay does not need to recompute the entire match from pitch one every time a user seeks.

A checkpoint should contain enough canonical state to resume deterministic replay reconstruction from that time boundary.

The checkpoint interval is **not fixed by this plan**. It should be selected later using:

- storage size;
- seek latency;
- reconstruction cost;
- compatibility requirements;
- corruption/recovery behavior.

### 4.5 Optional presentation metadata

A replay may optionally remember what the user originally watched, such as:

- active camera role;
- camera cut timestamp;
- HUD mode;
- broadcast bookmark/highlight markers.

This is useful for reproducing the original broadcast experience.

However, it is secondary metadata. The same canonical replay must remain observable from another approved renderer/camera.

---

## 5. Reconstruction model

A future replay reader should conceptually support:

```text
requested replay time T
        ↓
find latest valid checkpoint <= T
        ↓
restore canonical world from checkpoint
        ↓
apply/re-simulate canonical inputs/events deterministically
        ↓
reach canonical world at T
        ↓
expose read-only replay snapshot
        ↓
Presentation observes it
```

The implementation may use event application, deterministic resimulation, stored motion segments, or a bounded mixture of these methods depending on the canonical subsystem.

The requirement is not "always recompute everything."

The requirement is:

> **the reconstructed world at time T must be consistent with the original canonical play.**

---

## 6. Seeking, rewind, slow motion, and frame stepping

Replay should eventually be able to support:

- play-level jump;
- inning/plate-appearance jump;
- arbitrary seek where practical;
- rewind;
- pause;
- slow motion;
- canonical frame/sample stepping;
- bookmarks/highlights.

These controls belong above replay truth.

Rewind does not make canonical time run backward inside the original match. It means the replay reader restores/reconstructs an earlier canonical state and observes it again.

Slow motion similarly changes observation cadence, not historical event timing.

---

## 7. Mini Drone-Art replay

The existing Mini Presentation direction fits this architecture naturally.

```text
reconstructed canonical world
        ↓
Drone-Art broadcast camera
        ↓
4px display sampling
        ↓
55ms standard presentation cadence
```

For ordinary replay speed, the same Drone-Art rules may be reused.

For slow motion or frame inspection, Presentation may sample the reconstructed canonical world at another approved observation cadence, but must not invent physical positions or change event times.

A replay should therefore be able to show the same real play again without storing a video stream.

---

## 8. Future Natural replay

The same replay evidence should be suitable for a future Natural renderer.

```text
Canonical Replay Evidence
        ├─ Mini observer
        │    Drone-Art / 4px / 55ms
        │
        └─ Natural observer
             future continuous 3D
```

This is a major architectural reason to keep replay below Presentation.

A historical play should remain the same play regardless of which renderer observes it.

---

## 9. Compatibility and versioning

Deterministic replay can fail across software changes even when the original seed is preserved.

Future implementation must therefore treat versioning as part of replay correctness.

At minimum, design for:

- replay schema version;
- simulation/build identity;
- rules/profile identity;
- deterministic compatibility fingerprint where useful;
- explicit unsupported/incompatible replay classification.

Never silently replay an old record with a new simulation and claim it is the original play if the deterministic contract has changed.

Possible future compatibility strategies include:

1. migrate old stored replay evidence;
2. keep compatibility readers for selected old formats;
3. store sufficient canonical checkpoints/events to reduce dependence on old simulation code;
4. explicitly mark some legacy replays as summary-only when exact reconstruction is impossible.

The final policy should be chosen at implementation time.

---

## 10. Integrity and failure behavior

Future replay persistence should be designed to detect incomplete or corrupt records.

Potential mechanisms:

- per-chunk/checkpoint hashes;
- monotonic canonical timestamps;
- event sequence numbers;
- replay finalization marker;
- expected final MatchState fingerprint;
- checkpoint/event consistency checks.

If reconstruction fails, the system should not fabricate missing canonical action.

A replay may degrade to a summary or partial playable segment, but the failure must remain visible to the system/user.

---

## 11. Storage strategy

This plan intentionally does **not** require storing every canonical tick for every actor.

That would be simple but can waste storage.

The intended design space is:

```text
small metadata
+ canonical event log
+ periodic world checkpoints
+ deterministic reconstruction between checkpoints
```

Compression, checkpoint spacing, per-play segmentation, and long-term retention should be benchmarked later.

Useful future optimization candidates include:

- delta-encoded snapshots;
- per-play capsules;
- event compression;
- repeated/static state deduplication;
- separate archival and instant-seek replay profiles.

None are approved implementation requirements yet.

---

## 12. Relationship to PlayCapsule / highlights

The repository already contains future/highlight concepts around PlayCapsule.

A future replay implementation should avoid building an unrelated second history format if PlayCapsule or another canonical play record already becomes authoritative enough.

Likely separation:

- **full-match replay store:** durable reconstruction across the entire game;
- **PlayCapsule/highlight:** bounded indexed segment or derived package for one notable play.

A highlight should ideally reference or derive from canonical replay evidence rather than inventing a separate result animation.

This relationship must be reconciled against the actual implemented contracts when replay work begins.

---

## 12.1 Companion plan: Broadcast Camera Network + Replay Director

The future replay presentation/orchestration layer is recorded separately in:

`docs/superpowers/plans/2026-09-20-broadcast-camera-network-replay-director-plan.md`

That companion plan covers virtual ballpark camera rigs, multi-angle replay selection, slow motion, zoom/close-up and deterministic replay shot sequencing. It consumes reconstructed canonical replay truth and does not alter the persistence/reconstruction authority defined here.

Its existence does not authorize implementation.

---

## 13. Work boundary

This plan is **not a ChatGPT Work visual-design task**.

Replay persistence/reconstruction owns:

- canonical evidence format;
- snapshots/checkpoints;
- deterministic reconstruction;
- seeking semantics;
- versioning/compatibility;
- integrity/failure behavior.

Work may later design the player-facing replay experience:

- replay controls;
- timeline appearance;
- camera-selector UI;
- highlight browser;
- transition/polish.

The UI should consume a renderer-neutral replay API rather than define replay truth.

---

## 14. Future implementation order

When the user explicitly chooses replay as an implementation scope, first re-audit the then-current canonical contracts.

A safe implementation sequence would likely be:

1. define replay identity/version/finalization contract;
2. identify existing canonical events that are already replay-safe;
3. define minimal replay checkpoint state;
4. prove deterministic reconstruction for one bounded play;
5. add seek from checkpoint;
6. prove renderer isolation with Mini Presentation off/on;
7. add full-match segmentation/indexing;
8. add compatibility/integrity tests;
9. expose renderer-neutral replay API;
10. only then build player-facing replay UI.

This sequence is a future reference, not present authorization.

---

## 15. Acceptance criteria for a future replay implementation

A future implementation should not be considered complete until it can demonstrate all of the following:

1. A saved play can be reconstructed after the original live simulation is gone.
2. Reconstructed canonical state/events match the original accepted evidence.
3. Seeking from a checkpoint produces the same state as linear reconstruction.
4. Renderer OFF, Mini replay, and future renderer observers cannot alter replay truth.
5. Result summaries alone are never used as a substitute for missing physical history.
6. Old/incompatible replay formats fail explicitly rather than silently changing history.
7. The same canonical replay can feed both Mini and future Natural observation paths.
8. Replay storage remains bounded enough for practical match retention under an evidence-backed profile.

---

## 16. Non-goals of this saved plan

This document does not decide:

- the exact binary/JSON storage format;
- compression algorithm;
- checkpoint interval;
- replay UI;
- replay menu layout;
- highlight visual style;
- network/cloud sharing;
- replay editing tools;
- permanent archival policy.

Those decisions should be made only when replay implementation becomes an explicitly selected scope.

---

## 17. Saved architectural principle

The principle to carry forward is:

> **Do not save only what the player saw. Save enough canonical truth to let the game world be observed again.**

That allows a finished match to remain replayable even after the original live execution has ended, while keeping Mini Drone-Art and future Natural rendering as interchangeable observers of the same historical baseball truth.