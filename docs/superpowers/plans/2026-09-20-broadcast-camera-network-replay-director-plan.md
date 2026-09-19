# Broadcast Camera Network + Replay Director — Future Plan

**Date:** 2026-09-20  
**Status:** **FUTURE REFERENCE PLAN — NOT IMPLEMENTATION-AUTHORIZED**  
**Scope:** virtual ballpark camera rigs / replay shot selection / replay presentation orchestration  
**Depends on:** `2026-09-20-canonical-replay-reconstruction-plan.md`  
**Does not own:** canonical physics, rules, official adjudication, replay truth  
**Implementation trigger:** explicit future user approval only

---

## 1. Purpose

This plan preserves a future replay-presentation architecture inspired by professional baseball broadcasting.

The central idea is:

> **Do not create one omnipotent replay camera. Build a virtual broadcast camera network around the ballpark, then let a Replay Director choose the clearest combination of angles for the canonical play that actually happened.**

The system is analogous to a real television production:

```text
Canonical Replay World
        ↓
Virtual Broadcast Camera Network
        ↓
candidate views of the same historical truth
        ↓
Replay Director
        ↓
shot sequence / speed / crop / zoom instructions
        ↓
Mini Drone-Art or future Natural renderer
```

This layer may explain the play more clearly.

It may never decide what the play was.

---

## 2. Real broadcast practice used as design evidence

Professional baseball replay is fundamentally multi-angle.

MLB describes its Replay Operations Center as receiving a high-home camera and batter cameras, plus broadcast feeds that can include super-slow-motion and many isolated cameras. The replay operation selects useful angles for the disputed play rather than relying on one universal view.

MLB's replay documentation also explicitly describes slow motion, zoom and multiple angles as replay tools.

Club replay workflows likewise use multi-camera grids to scan for the clearest view before examining one or two decisive angles in depth.

These practices support four transferable principles:

1. **camera specialization beats one universal camera;**
2. **wide/context views and tight/decisive views serve different jobs;**
3. **the best angle depends on what event must be understood;**
4. **replay editing should select evidence, not invent action.**

### Research references

- MLB, “What happens during MLB replay reviews”
  - high-home + batter cameras;
  - up to four super-slow-motion and 17 isolated camera feeds when available.
  - https://www.mlb.com/news/what-happens-during-mlb-replay-reviews
- MLB, “Instant replay review FAQ”
  - multi-camera replay access and stadium high-home camera.
  - https://www.mlb.com/news/instant-replay-review-faq/c-70189582
- MLB, “Looking inside instant-replay review”
  - operators find the angle that gives the best look, then use pause/rewind/slow motion.
  - https://www.mlb.com/news/instant-replay-review-explained-by-reds-director-of-video-scouting/c-87855702
- MLB, “All systems go with expanded replay review”
  - HD, slow motion, zoom and multiple angles as replay tools.
  - https://www.mlb.com/news/all-systems-go-with-expanded-instant-replay-for-major-league-baseball/c-70050812

These sources are design references, not normative game rules.

---

## 3. Why virtual cameras fit Mini Baseball especially well

A real camera can miss a play because the operator pointed elsewhere.

Mini Baseball does not need that limitation.

The replay source is the reconstructed canonical world, not captured video.

Therefore every registered virtual camera can observe the same historical world after the match has finished.

```text
historical canonical play
        ↓
reconstruct time T
        ↓
evaluate CAM-HOME-HIGH
evaluate CAM-1B-HIGH
evaluate CAM-3B-HIGH
evaluate CAM-CF
...
        ↓
choose useful views
```

The game does **not** need to render and save every camera feed live.

It may save canonical replay truth once and render only the selected camera views when the replay is requested.

This preserves the lightweight product philosophy.

---

## 4. Ballpark Camera Rig

Each ballpark should eventually expose a **BroadcastCameraRig**.

A rig defines camera roles in ballpark/world coordinates.

The roles are stable across stadiums; exact coordinates and framing vary by stadium geometry.

Example future roles:

| Camera role | Primary replay purpose |
| --- | --- |
| `CF_MAIN` | pitcher/batter relationship, pitch and contact context |
| `CF_TIGHT` | tighter batter/pitcher/contact or outfield detail |
| `HOME_HIGH` | whole-play geometry, runner/defender placement |
| `HOME_LOW` | plate plays, batter/catcher, foul-line context |
| `1B_LOW` | first-base close plays and nearby runner action |
| `1B_HIGH` | first/second-base geometry, throw + runner relationship |
| `3B_LOW` | third-base close plays and nearby runner action |
| `3B_HIGH` | second/third-base geometry, tag and relay relationship |
| `LF_LINE_HIGH` | left-field line, wall, foul/fair and deep-flight context |
| `RF_LINE_HIGH` | right-field line, wall, foul/fair and deep-flight context |
| `FIELD_WIDE` | multi-runner / multi-defender story of the whole play |
| `BATTER_POV` | approved special subjective view |
| `CATCHER_BEHIND` | approved pitcher-operation / special replay view |

These names are future architectural roles, not final user-facing labels.

### 4.1 Role, not fixed universal coordinate

A camera role is semantic.

For example:

```text
Koshien.1B_HIGH  -> stadium-specific world transform
Ballpark_B.1B_HIGH -> another world transform
```

The role stays “high first-base-side coverage.”

The physical mounting point may change to suit:

- grandstand geometry;
- foul territory;
- wall shape;
- roof/obstruction;
- readable line of sight;
- the stadium's visual identity.

### 4.2 Camera rig must not change ballpark physics

Camera placement is observational metadata.

A virtual camera does not become a collision object unless an explicitly modeled gameplay object is separately defined in canonical ballpark geometry.

---

## 5. Camera capability metadata

Each future camera may advertise capabilities used by the Replay Director.

Possible metadata:

- role;
- transform / position / orientation;
- allowed pan/tilt range;
- base field of view;
- min/max zoom;
- targetable world region;
- expected occlusion zones;
- preferred event families;
- whether it is suitable for wide context or decisive close-up;
- whether it supports an approved slow-motion presentation profile.

This metadata is Presentation-side evidence.

It must not contain baseball-result shortcuts such as:

- `shows_out = true`;
- `winner = runner`;
- `force_play_result = safe`.

---

## 6. Replay Subject

The Replay Director should receive a renderer-neutral description of **what must be explained**.

Example concept:

```text
ReplaySubject
  subjectType: TAG_AT_SECOND
  decisiveTime: T
  decisiveRegion: SECOND_BASE
  involvedActors:
    - runner
    - shortstop
    - ball
  contextWindow:
    before: ...
    after: ...
```

This subject is derived from canonical replay events.

It is not a replacement for them.

Useful future subject families may include:

- pitch/contact;
- catch attempt;
- wall/foul-pole event;
- tag play;
- force play;
- base touch race;
- home-plate play;
- diving fielding play;
- relay;
- rundown;
- multi-runner scoring play;
- home run;
- unusual bounce/collision.

The exact taxonomy should be derived from implemented canonical event contracts when this plan becomes active.

---

## 7. Candidate camera evaluation

The Replay Director may score or rank candidate views using presentation-only criteria.

Possible criteria:

- decisive actors visible;
- ball visible;
- base / wall / line visible where relevant;
- decisive event not occluded;
- useful apparent size of the subject;
- useful angle between relevant motion vectors;
- context coverage;
- continuity with prior shot;
- redundancy penalty;
- whether the angle adds new explanatory information.

Conceptually:

```text
score(camera, replaySubject, timeWindow)
  = visibility
  + event legibility
  + context
  + subject size
  + angle usefulness
  - occlusion
  - redundancy
```

This scoring must never influence the canonical result.

A camera may receive a low score because it cannot show the tag clearly.

That does not mean the tag did not happen.

---

## 8. Replay shot grammar

A replay should not simply cycle through cameras.

A useful default grammar is:

> **context -> decisive action -> detail**

### 8.1 Close play at first

Possible structure:

```text
HOME_HIGH / FIELD_WIDE
  establish runner + throw + base
        ↓
1B_HIGH
  show relative arrival geometry
        ↓
1B_LOW / tight crop
  slow decisive glove/base/runner moment
```

### 8.2 Tag at second

```text
FIELD_WIDE
  explain how the play developed
        ↓
1B_HIGH or 3B_HIGH
  show throw + runner + fielder
        ↓
best tight angle
  slow tag/base-contact moment
```

### 8.3 Home run

```text
CF_MAIN
  contact
        ↓
HOME_HIGH / FIELD_WIDE
  flight and field context
        ↓
LF_LINE_HIGH or RF_LINE_HIGH
  wall / pole / landing
        ↓
optional actor reaction view
```

### 8.4 Diving catch

```text
HOME_HIGH / FIELD_WIDE
  ball destination and route
        ↓
best outfield-side angle
  approach
        ↓
tight slow view
  glove/ball/contact with ground
```

These are future templates, not canned animations.

The shot grammar chooses **how to observe the original canonical event window**.

---

## 9. Slow motion

Slow motion changes replay observation time, not canonical history.

If a canonical event occurred at time T, slow motion must still place the event at T in replay-world time.

Presentation may:

- sample more densely;
- hold frames/samples;
- map canonical time to slower presentation time;
- expose exact event boundaries.

Presentation may not:

- move the tag earlier;
- delay a base touch;
- alter the ball path;
- create an intermediate state inconsistent with canonical reconstruction.

For Mini, the normal 55ms cadence remains the baseline broadcast identity.

Replay slow motion may intentionally use a different approved observation cadence because it is a replay mode, but samples must remain canonical-derived.

---

## 10. Zoom / close-up

Zoom is a camera operation.

It may enlarge the decisive region without changing world coordinates.

Useful future behavior:

- determine a world-space focus region from ReplaySubject;
- choose a camera that sees the region;
- crop/zoom within capability limits;
- ensure required context remains visible;
- avoid hiding the very comparison the replay is meant to explain.

Example:

A force play at first often needs both:

- ball/glove or possession evidence;
- runner/base-contact evidence.

A close-up that shows only the fielder's face is visually dramatic but evidentially poor.

The Replay Director should prefer explanatory framing over arbitrary spectacle.

---

## 11. Multiple angles should add information

A second angle should normally answer something the first angle could not.

Possible informational progression:

1. **Where did the play happen?**
2. **Which actors converged?**
3. **What was the decisive contact/touch/catch?**
4. **Was there an obstruction or unusual geometry?**

Avoid:

- three almost identical angles;
- cuts so rapid that spatial understanding is lost;
- excessive zoom before context is established;
- dramatic views that hide the decisive event.

---

## 12. Camera network versus free camera

A future free/debug camera can still exist.

It should not replace the Broadcast Camera Network.

The network exists because stable camera roles provide:

- recognizable television language;
- predictable framing;
- easier testing;
- ballpark-specific broadcast identity;
- deterministic replay selection;
- easier Work design.

A free camera is useful for:

- debugging;
- inspection;
- special approved cinematics;
- future manual replay exploration.

Default automatic replay should prefer named camera roles.

---

## 13. Deterministic Replay Director

The Replay Director should be reproducible from the same inputs where practical.

A future selection contract could depend on:

- replay subject;
- canonical event window;
- ballpark camera rig version;
- presentation policy version;
- deterministic tie-breaking.

This makes replay packages testable.

Given the same canonical play, camera rig and director policy, the automatic replay should not randomly choose unrelated angles unless an explicitly approved aesthetic variation mode is introduced later.

---

## 14. Separation from ChatGPT Work

This plan defines the **architecture and evidence boundary**, not final visual design.

Implementation/Core-facing responsibilities:

- camera role identifiers;
- ballpark camera transforms;
- renderer-neutral visibility queries;
- ReplaySubject contract;
- deterministic selection/sequence policy;
- replay-time mapping;
- canonical isolation tests.

ChatGPT Work owns the eventual player-facing treatment:

- exact framing polish;
- camera-transition style;
- replay stinger;
- typography;
- borders/panels;
- zoom animation feel;
- replay indicator;
- timeline controls;
- optional cinematic styling.

Work must receive the rule:

> **The Replay Director may choose what canonical view to show. It may not invent the play.**

---

## 15. Mini versus Natural

Both renderers should consume the same selected camera semantics where useful.

```text
Canonical Replay
      ↓
Replay Subject
      ↓
Replay Director
      ↓
Camera role + time mapping
      ├─ Mini Drone-Art renderer
      └─ Natural 3D renderer
```

The exact camera transform may be adapted per renderer if necessary, but the historical baseball truth remains identical.

This allows a future Natural version to replay an old Mini game without changing what happened.

---

## 16. Storage implications

The replay file does not need to store video for every camera.

Preferred future approach:

```text
canonical replay evidence
+ ballpark camera-rig identity/version
+ optional original broadcast cut list
```

Then automatic replay can be regenerated later.

An optional cut list may preserve the exact broadcast originally shown:

```text
shot 1: HOME_HIGH, t0..t1, 1.0x
shot 2: 1B_HIGH, t2..t3, 0.5x
shot 3: 1B_LOW, t4..t5, 0.25x, zoom profile A
```

That cut list remains Presentation metadata, not canonical truth.

---

## 17. Failure behavior

If no camera clearly exposes the decisive event:

- choose the least-occluded useful context view;
- do not fabricate a perfect angle;
- optionally mark the replay as lacking a decisive close-up;
- preserve canonical truth regardless.

Because cameras are virtual, future implementation may choose generous camera coverage, but it should still test occlusion and legibility rather than assume every angle is perfect.

---

## 18. Future implementation sequence

Only after explicit user approval:

1. re-audit current replay/canonical contracts;
2. define `BroadcastCameraRole`;
3. define per-ballpark `BroadcastCameraRig`;
4. implement read-only projection/visibility queries;
5. define `ReplaySubject` from canonical events;
6. implement candidate camera evaluation;
7. implement a bounded deterministic Replay Director for one play family;
8. add context -> decisive -> detail shot grammar;
9. add replay-time slow-motion mapping;
10. add zoom/crop metadata;
11. verify no renderer/director influence on canonical replay;
12. then hand the player-facing replay visual treatment to Work.

This sequence is a future reference, not current authorization.

---

## 19. Future acceptance criteria

A future implementation should prove:

1. multiple named virtual camera roles observe the same canonical play;
2. camera transforms are ballpark-specific but role semantics remain stable;
3. automatic selection chooses useful angles from evidence rather than result labels;
4. close-play replays can combine context and decisive-detail views;
5. slow motion changes presentation time only;
6. zoom/crop changes framing only;
7. replay with automatic director ON/OFF produces identical canonical history;
8. the same replay can be re-rendered later without stored multi-camera video;
9. a changed camera rig or director version is identifiable/versioned;
10. Mini and future Natural can consume the same replay subject and camera-role semantics.

---

## 20. Saved architectural principle

> **Put many cameras around the simulated ballpark, not many truths inside the simulation.**

There is one historical canonical play.

The Broadcast Camera Network provides many ways to observe it.

The Replay Director's job is to turn those truthful views into an understandable baseball replay.