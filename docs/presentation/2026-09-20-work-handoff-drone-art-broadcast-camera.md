# ChatGPT Work Handoff — Drone-Art Broadcast Camera

> **Work更新（改訂13）:** 配球履歴は球種・方向別の記号をゾーン上に残す配球図。採用B1・カメラ・白球・スコア等を[試合形式HTML](2026-09-21-integrated-match-preview.md)へ統合。固定の架空観測入力であり、実Core接続は未完了。

> **Work更新（改訂12）:** ストライクゾーンは黄色。確定した投球の番号・位置・球速・球種・結果を表示し、次の打席開始時にリセットする。[配球履歴の入力契約と試作状態](2026-09-21-pitch-history-presentation-contract.md)を確認する。

> **Work更新（改訂11）:** 白球＋赤い縫い目、重なった球をストライクゾーンより優先する。[観測姿勢の受け取り口と未接続事項](2026-09-21-observed-baseball-surface-contract.md)を確認する。Coreの物理・結果・Canonical型は変更していない。


**Date:** 2026-09-20  
**Status:** **APPROVED PRESENTATION DESIGN BRIEF**  
**Owner for visual/UI realization:** ChatGPT Work  
**Applies to:** Mini Baseball Presentation  
**Does not own:** Match Core physics, rules, AI truth, canonical timing, official result authority

---

## 1. One-sentence product definition

> **Mini Baseball shows a numerically simulated real baseball world through an intentionally coarse Drone-Art broadcast camera.**

The world is not Drone-Art.

The baseball game exists first as canonical numeric state: ballpark geometry, players, runners, ball, bat, positions, velocities, contacts, decisions, rules and events.

Mini then observes that world through a deliberately limited presentation camera.

```text
Canonical Baseball World
  continuous / numeric / causal
          ↓
Drone-Art Broadcast Camera
          ↓
4px display-grid sampling
+
55ms standard presentation cadence
          ↓
intentionally coarse live broadcast
```

This distinction is permanent unless the user explicitly changes it.

---

## 2. Why the image is intentionally coarse

The coarse image is not a temporary placeholder and not a failure to achieve full 3D.

It is an intentional product decision.

The design goal is:

```text
deep physical simulation
+ low rendering cost
+ readable baseball motion
+ distinctive broadcast identity
```

Mini Baseball spends computation on the baseball world rather than on fully rendered 3D presentation.

The underlying world may calculate precise physical and decision state numerically. Presentation is allowed to show only a compact sampled view of that truth.

Therefore the desired experience is similar to watching a specialized low-resolution sports broadcast, radar feed, electronic scoreboard, or telemetry camera: coarse on the surface, but observing a real underlying event.

---

## 3. Confirmed visual/broadcast requirements

These are **confirmed inputs to Work**, not optional suggestions.

### 3.1 Drone-Art

Mini uses **Drone-Art** as its presentation direction.

Drone-Art means a lightweight visual language built from points, compact marks, discrete trails, simple field geometry and other deliberately economical screen primitives.

Work may refine the composition and visual language, but must preserve the sense that the viewer is observing a real baseball world through a specialized coarse broadcast system.

### 3.2 4px fixed display grid

The baseline Mini image uses a **4px-equivalent fixed display grid**.

Canonical world positions are projected into Presentation space and then quantized for display.

```text
canonical world coordinate
        ↓
camera projection
        ↓
4px-equivalent display quantization
        ↓
visible mark
```

The 4px grid is a visual sampling rule.

It is **not**:

- the unit of Match Core geometry;
- the accuracy of player movement;
- a collision grid;
- a physics timestep;
- a rule-engine measurement unit.

### 3.3 55ms standard cadence

The standard Mini broadcast cadence is **55ms per presentation sample**.

This produces the intended discrete broadcast feel instead of conventional 60fps character animation.

The canonical simulation continues independently between display samples.

```text
Canonical simulation:
continuous deterministic world/event evolution

Mini broadcast:
0ms → 55ms → 110ms → 165ms → ...
```

Existing exact-event Presentation requirements may expose an exact canonical event boundary when necessary, but they must never change the underlying event time.

55ms is therefore Presentation sampling, not the Simulation Clock.

### 3.4 No fake movement to make the image smoother

The desired visual identity is discrete.

Do not turn the system into conventional smooth 3D/2D animation by inventing movement that does not exist in canonical evidence.

Where an intermediate visual position is needed, it must come from canonical world state or an approved deterministic canonical motion sample, not from a result-driven animation.

The intended feel is:

> many truthful coarse samples, not a smooth fictional animation.

---

## 4. Ballpark reproduction

The ballpark should be understood as **world geometry first, image second**.

A stadium is not primarily a background illustration behind the baseball simulation.

The physical baseball space should be numerically representable: for example, the locations/shapes of home plate, bases, mound, foul lines, infield/outfield regions, fence boundary, wall height, warning-track/surface regions and other gameplay-relevant geometry as the Core/world model supports them.

The broadcast camera then projects that geometry into the Drone-Art image.

```text
Canonical Ballpark Geometry
        ↓
same space used by the baseball world
        ↓
Drone-Art camera projection
        ↓
4px display representation
```

The important consequence is:

> **the fence that affects the baseball play and the fence the player sees should describe the same underlying geometry.**

A wide foul territory should look wide because the canonical ballpark is wide.  
An asymmetric outfield should look asymmetric because its geometry is asymmetric.  
A shifted defender should appear where the defender really is, not at the registered position label.

### 4.1 What must be physically faithful

Work should preserve visual faithfulness to gameplay-relevant world geometry and motion:

- bases and their spatial relation;
- mound/home relation;
- foul lines / fair territory;
- fence shape and distance where represented by the world;
- player locations and movement;
- runner locations and movement;
- ball position and canonical height-derived cues;
- throws, contacts and live-ball movement.

### 4.2 What may remain visually abstract

The Drone-Art broadcast does not need full architectural reconstruction of every stadium detail.

Grandstand structure, individual seats, tiny signage, spectators, concourses and decorative architecture may be simplified heavily unless a later approved Work design assigns them gameplay/readability value.

The target is:

> **recognizable baseball space and stadium identity, not a miniature photorealistic stadium.**

Work may use silhouette, boundary shape, major landmarks and economical decoration to convey stadium identity while retaining the lightweight broadcast character.

---

## 5. Ball and other sub-pixel objects

Physical scale and display scale are intentionally separate.

A baseball is too small to remain readable at true visual scale in this camera.

Therefore the ball may be represented as an enlarged visual marker while its **position and events remain canonical**.

```text
physical baseball
precise canonical position
        ↓
Presentation glyph / marker
readable on coarse display
```

The same principle applies to trails, shadows, height indicators and other observational aids.

These are camera/display aids.

They must not become physical truth.

---

## 6. Camera interpretation

The most useful mental model for Work is:

> **This is a broadcast camera, not the universe.**

Mini does not ask, “How should a single/out/flyout animation look?”

It asks:

> “What does the canonical play look like when observed through this Drone-Art camera?”

That means no pre-baked animation may override the actual play.

Examples:

- a center fielder appears in the gap because the actor actually moved there;
- an unusual defensive shift appears unusual because canonical positions are unusual;
- a bounce appears because the ball physically bounced;
- a close play looks close because the canonical arrival/contact times were close;
- stadium shape appears through projection of the actual ballpark geometry.

---

## 7. Camera roles already fixed

Work should preserve the already-established camera-role contract:

- offensive at-bat observation: **Batter POV**;
- defensive/pitcher-operation observation: **catcher-behind Pitcher POV**;
- fair-ball/live field action: **field / overhead observation**.

Work owns the exact composition, visual hierarchy, typography, framing, polish and interaction treatment within those roles.

These roles do not authorize the camera to alter the canonical world.

---

## 8. Lightweight-performance intent

The performance strategy is architectural.

Instead of requiring full 3D scene rendering for every simulated object and stadium detail, Mini can retain rich numeric simulation and display only a compact sampled representation.

Conceptually:

```text
expensive presentation path:
complex 3D geometry
+ materials
+ animation rigs
+ lighting
+ dense scene rendering

Mini path:
canonical numeric simulation
+ compact projection
+ simple marks
+ sparse discrete samples
```

This does **not** mean the Match Core is “fake 2D baseball.”

The Core may remain much richer than the visible image.

The coarse Presentation is deliberately throwing away visual information after the simulation has produced the underlying truth.

---

## 9. Natural Baseball relationship

This design must preserve the ability to observe the same play through a different renderer later.

```text
                     ┌─ Mini
Canonical Match Core ├─ Drone-Art / 4px / 55ms broadcast
                     │
                     └─ Natural
                        continuous 3D presentation
```

A ground ball, throw, catch or base touch does not become a different baseball event because Natural renders it more smoothly.

Mini and Natural differ in observation, not in baseball truth.

---

## 10. Work freedom versus fixed constraints

### Fixed — Work must preserve

- world-first / canonical-world-first architecture;
- Drone-Art as the Mini presentation direction;
- 4px-equivalent fixed display grid;
- 55ms standard Presentation cadence;
- intentionally coarse/discrete broadcast character;
- no Presentation authority over physics/rules/results;
- player/ball/runner/ballpark representation derived from canonical world truth;
- Batter POV / catcher-behind Pitcher POV / field-overhead role contract;
- same Match Core compatibility with future Natural presentation.

### Work may design

- exact visual composition;
- typography;
- panel layout;
- information density;
- border/frame treatment;
- field line styling;
- point/glyph shapes;
- team-color treatment within established readability constraints;
- stadium silhouette/detail treatment;
- transitions between camera roles;
- how to communicate ball height/visibility within the canonical-data constraint;
- final visual polish and usability.

Work should not “modernize away” the coarse broadcast identity.

---

## 11. Acceptance question for Work

A Work design is aligned when the answer to all of these is yes:

1. Does it look like a specialized coarse camera observing baseball rather than a pre-baked baseball animation?
2. Can the same canonical play be shown without changing its physics or result?
3. Are 4px spatial sampling and 55ms temporal sampling still perceptible parts of the presentation identity?
4. Can unusual real world states — extreme shifts, odd bounces, close plays, nonstandard routes — appear naturally without needing a custom animation?
5. Can stadium geometry be projected from numeric world data rather than requiring the simulation to conform to a background picture?
6. Would the same underlying play still make sense if a future Natural 3D renderer observed it instead?

If yes, the design is preserving the intended Mini Baseball presentation architecture.


## 12. Work amendment — 2026-09-21

Apply [Observed motion / B1 / name plates / field markings](2026-09-21-observed-motion-b1-field-markings-principles.md) for the user-directed concrete rendering design. B1 is a faceless body style; actual observed grip/tip positions drive the bat and hand placement. Six pitching and four batting base poses do not limit the number of observed motion samples. Names use perspective-scaled translucent black plates. Both batter boxes and regulation field markings are projected from shared geometry.

The amendment records independent HTML prototype revision 8 and its known limits. It does not claim production Core integration, complete ballpark compliance, or authorization to implement Ballpark Builder.