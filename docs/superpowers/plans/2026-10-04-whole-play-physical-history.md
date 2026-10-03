# Bounded whole-play physical history

> **For agentic workers:** Implement this approved continuation with TDD, immutable Source ownership, and independent review before freezing the final integration gate.

**Goal:** Join the exact original pitch/contact timeline with actual field, Player, capture, carried and thrown-ball history through a bounded Native observation.

**Architecture:** Preserve the legacy canonical timeline unchanged inside an additive Core envelope. Retain raw field/acquisition/throw states, source-qualified references, phase-aware same-time frames, and separate observation links. Native composes only already rederived original pitch and bounded field/execution prefixes; the caller supplies only an observation Source identity/kind.

**Tech Stack:** Existing TypeScript, Node SQLite and Vitest.

**Spec:** Checkpoint §5 item5 and canonical World-first contracts05/06/07. The field execution/rule observations are the preceding dependencies; official closure remains a later contract.

## Constraints

- Pitch contact retains its existing integer precision. Field moments keep originTick/elapsedSeconds/quantized tick. Serialization order alone never decides physical precedence.
- Same physical instant can retain incoming and adopted response states with different velocity/spin. Do not collapse either or invent movement between them.
- Raw steps preserve rebound cursor, capture transport/interruption, carried state, transfer, releaseCursor/launch and every base companion.
- Source identity is owner-qualified. Equal field/execution Source strings are valid; each owner's revisions and predecessor chain remain contiguous.
- Rule/history observations do not advance time or recursively embed older history payloads. Rule results remain in their own immutable Source rows.
- Original pitch/flight/field archives are not rewritten. Historical replay stays bounded; current-write and WAL checks remain strict.
- No frontier/settlement/end/official ruling/closure/Match/scoring/workload is inferred from this history. End remains unestablished, even at zero velocity.
- No UI/art/Presentation, guessed calibration, home CI, workflow/config/lock edits, merge or force push.

## Review focus

1. Same-time post-response state must survive alongside incoming state, including persistent contact
2. Capture/transfer interruption must not manufacture security or release
3. Observation-only additions must not duplicate physical work, extend horizon or create recursive snapshots
4. Original bat contact, game/play/pitch and Player scope must bind every field/execution step
5. Later corrupt payloads must not poison an earlier bounded history; corrupt metadata or original dependency must still be rejected

## Tasks

- [x] Core RED→GREEN: add CanonicalWholePlayHistory contract and exact-time/source/phase validation using existing physics fixtures
- [x] Native RED→GREEN: add whole_play_history Source action, own-prefix adapter and reopen/retry/observation/currentness tests
- [x] Exercise original pitch, Person, geometry and own late WAL changes, raw-state/history preservation and future metadata corruption
- [x] Reproduce/fix the known zero-restitution continuing-contact projection defect before claiming the combined prefix complete
- [x] Run targeted Core/Native/type gates and independent review
- [ ] Freeze latest Source and finish one combined whole gate (record terminal result separately)
- [ ] Publish the corrected cumulative draft checkpoint and distinguish completed local Source proof from unrun CI and remaining closure/controller/Career work
