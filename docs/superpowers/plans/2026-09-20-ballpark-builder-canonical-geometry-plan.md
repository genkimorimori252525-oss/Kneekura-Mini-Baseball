# Ballpark Builder / Canonical Ballpark Geometry — Future Plan

**Date:** 2026-09-20  
**Status:** **FUTURE REFERENCE PLAN — NOT IMPLEMENTATION-AUTHORIZED**  
**Scope:** editable ballpark geometry / validation / persistence boundary  
**Not owned here:** final UI, stadium art, model appearance, interaction design  
**Implementation trigger:** explicit future user approval only

---

## 1. Purpose

This document preserves a future architecture for a player-facing **Ballpark Builder**.

The user should eventually be able to choose a stadium presentation model and freely configure baseball-relevant field geometry such as:

- left-field distance;
- center-field distance;
- right-field distance;
- intermediate outfield shape;
- fence shape;
- fence height;
- foul territory;
- other approved playable-boundary geometry.

The important requirement is not merely customization.

> **A custom ballpark must become real canonical baseball space, not a cosmetic background or a result modifier.**

A shallow left field should physically place the wall closer.

A tall wall should physically block balls below its top.

A large foul territory should create more physical room in which defenders can chase foul balls.

No subsystem should apply shortcuts such as:

- `homeRunRate += 10%`;
- `largeFoulTerritory = moreOuts`;
- `model7 = pitcherFriendly`.

The geometry itself should cause the baseball consequences.

---

## 2. Relationship to existing design

The repository already contains a pre-implementation `StadiumProfile` concept with:

- `outfieldFence`;
- `foulTerritory`;
- `wallHeightAt`;
- `surface`;
- `wind`.

That direction remains valid.

This future plan extends the concept into an editable, versioned builder architecture while preserving the existing world-first rule:

```text
ballpark exists as canonical geometry
        ↓
ball / players / runners interact with it
        ↓
rules interpret physical events
        ↓
Presentation observes the same geometry
```

This plan does not authorize replacing current physics or Presentation code.

---

## 3. Four-way architecture split

The future builder should separate four responsibilities.

```text
BallparkBuildConfig
        ↓
BallparkValidationPolicy
        ↓
Canonical BallparkGeometry
        ↓
Match Core / Replay / Presentation
        │
        └───────────── BallparkPresentationModel
```

### 3.1 BallparkBuildConfig

Represents **editable user intent before canonical validation**.

Possible future concepts:

```ts
type BallparkBuildConfig = {
  presentationModelId: 1 | 2 | 3 | 4 | 5
    | 6 | 7 | 8 | 9 | 10;

  outfieldShape: OutfieldBuildShape;
  fence: FenceBuildConfig;
  foulTerritory: FoulTerritoryBuildConfig;

  surfaceRegions?: SurfaceBuildRegion[];
  futureEnvironment?: FutureEnvironmentConfig;
};
```

This is not canonical Match Core truth until validated and compiled into `BallparkGeometry`.

### 3.2 BallparkValidationPolicy

Validates whether a proposed build can become legal/safe canonical geometry.

It owns:

- structural geometry validity;
- hard engine safety bounds;
- competition-specific legality;
- warnings for unusual but allowed geometry.

It does **not** modify a requested stadium silently to make it legal.

### 3.3 BallparkGeometry

The validated, immutable baseball-space contract used by the simulation.

Conceptually:

```ts
type BallparkGeometry = {
  geometryId: string;
  geometryVersion: number;

  homePlate: Vec2;
  foulLines: readonly FoulLine[];
  fairTerritory: Polygon;
  foulTerritory: Polygon;
  playableTerritory: Polygon;
  outOfPlayBoundary: Boundary;

  outfieldFence: readonly FenceSegment[];

  surfaceRegions?: readonly SurfaceRegion[];
};
```

This plan intentionally does not freeze exact TypeScript names or serialization shape.

The principle is what matters:

> **one validated geometry source must drive both play and observation.**

### 3.4 BallparkPresentationModel

Represents visual stadium identity only.

The initial future product concept reserves **10 presentation model slots**:

```text
MODEL_1
MODEL_2
...
MODEL_10
```

Their exact architecture, stands, roof, scoreboard, crowd treatment, materials, color language and interaction are **not decided by this plan**.

Those visual definitions belong to future Work design.

Changing Presentation Model 3 to Presentation Model 8 must not, by itself, change:

- fence distance;
- fence height;
- fair/foul geometry;
- ball collision;
- home-run truth;
- player pathing;
- replay truth.

---

## 4. Model 1-10 and field geometry must remain independent

Do not bind stadium appearance to one fixed baseball shape.

Bad coupling:

```text
MODEL_3
  = left 100m
  = center 122m
  = right 100m
  = wall 3m
```

Preferred separation:

```text
Presentation Model 3
        +
Custom Ballpark Geometry A
```

and also:

```text
Presentation Model 3
        +
Custom Ballpark Geometry B
```

should both be valid if each geometry passes validation.

This allows the same visual stadium family to host different physical fields, and the same physical field to be observed through a different stadium visual shell.

---

## 5. Outfield shape

### 5.1 Simple semantic anchors

The builder data model should support easy semantic dimensions such as:

- LEFT;
- LEFT-CENTER;
- CENTER;
- RIGHT-CENTER;
- RIGHT.

At the simplest future configuration level, a park may be describable by three main distances:

```text
LEFT
CENTER
RIGHT
```

Intermediate points can then be generated by a defined builder policy.

However, canonical physics must not be permanently limited to only three radial values.

### 5.2 Advanced control points

The underlying representation should support a variable number of outfield-fence control points.

Conceptually:

```text
LF foul pole
  ↓
point
  ↓
point
  ↓
LCF
  ↓
point
  ↓
CF
  ↓
point
  ↓
RCF
  ↓
point
  ↓
RF foul pole
```

Each accepted control point contributes to a continuous fence path.

This permits future asymmetric parks without special-case code.

Examples:

- shallow left field, deep center;
- deep left-center gap;
- short right-field porch;
- abrupt wall-angle changes;
- non-symmetric professional-style shapes.

### 5.3 Canonical storage should use geometry, not labels

`LEFT=98m` is useful builder intent.

The Match Core should ultimately receive validated world geometry such as points / segments.

This lets physics ask:

> “Where is the fence?”

instead of:

> “What is the nominal center-field distance?”

---

## 6. Fence representation

The outfield wall should be represented as physical segments.

Conceptually:

```ts
type FenceSegment = {
  start: Vec2;
  end: Vec2;
  heightMeters: number;

  materialId?: string;
  presentationTags?: readonly string[];
};
```

### 6.1 Per-segment height

Fence height should not be one global value.

Different regions may have different wall heights.

For example, a future custom park may legally have:

```text
LF      tall wall
LCF     medium wall
CF      low wall
RCF     low wall
RF      medium wall
```

The exact values must pass validation.

### 6.2 Material metadata

A future wall may carry material identity.

However, material must not affect bounce physics until an approved physical material contract exists.

Until then, `materialId` should be treated as metadata / Presentation input only.

Do not silently make:

```text
brick = high bounce
padding = low bounce
```

without a separately approved physical model.

---

## 7. Foul territory and playable space

Foul territory should not ultimately be represented by one global “small / medium / large” modifier.

The canonical world should support a geometric region.

Conceptually:

```text
Ballpark playable space
├─ fair territory
├─ foul territory
└─ out-of-play space
```

This permits:

- different first-base and third-base foul-space widths;
- deep foul territory behind home plate;
- asymmetric foul territory;
- future special stadium geometry.

The physical consequence should emerge naturally:

```text
foul fly
   ↓
ball remains in playable foul territory
   ↓
defender has enough time / path
   ↓
catch
   ↓
out
```

Do not encode the consequence as:

```text
largeFoulTerritory -> outChanceBonus
```

---

## 8. Infield geometry boundary

The initial Ballpark Builder plan focuses on **stadium-dependent geometry**, especially:

- outfield distances;
- outfield wall;
- foul territory;
- playable boundary;
- approved surface regions.

The following should remain Rule / Competition geometry unless a later user decision explicitly expands the builder:

- base spacing;
- home-plate geometry;
- mound / plate relationship;
- other regulation infield dimensions.

This prevents “custom stadium” from silently becoming “custom baseball rules.”

A future Sandbox profile may deliberately relax additional geometry, but that is a separate product decision.

---

## 9. Validation architecture

The builder needs limits, but they should not all live in one hard-coded number table.

Use three validation layers.

### 9.1 Structural validity

Geometry that is mathematically or topologically unusable is invalid regardless of competition.

Examples:

- NaN / Infinity;
- zero or negative physical dimensions where impossible;
- negative wall height;
- self-intersecting fence path where unsupported;
- fence crossing home plate;
- reversed or invalid foul-line topology;
- malformed polygon;
- disconnected playable region where unsupported;
- impossible out-of-play boundary ordering.

These should be rejected before Match Core use.

### 9.2 Engine hard safety limits

The engine should define broad finite bounds that protect:

- numeric stability;
- collision/query cost;
- pathfinding cost;
- snapshot/replay size;
- camera/projection assumptions;
- indexing/storage.

Exact numbers are **not decided by this plan**.

They must be chosen using:

1. real ballpark dimension research;
2. stress testing;
3. physics precision limits;
4. performance measurements.

The user explicitly wants nonsense such as a **500m center field** rejected. Therefore future acceptance must prove that extreme geometry outside intended bounds cannot become a normal canonical professional ballpark.

This plan does not invent the final maximum merely to satisfy that example.

### 9.3 Competition-specific limits

A `CompetitionProfile` may impose tighter limits than the engine.

Conceptually:

```text
Engine Hard Safety
        ↓
Competition Validation
        ↓
Accepted Ballpark
```

Possible future profiles:

- NPB-like competition;
- fictional professional competition;
- amateur / historical profile;
- Sandbox.

A Sandbox may relax competition limits but must still obey engine hard safety and structural validity.

---

## 10. Minimum and maximum research gate

Before implementation of public editing, establish evidence-backed ranges for at least:

- LF / CF / RF distance;
- intermediate outfield radial distance;
- wall height;
- foul-territory extent;
- total playable-area extent;
- control-point count;
- minimum segment length;
- maximum geometry complexity.

The research should distinguish:

- observed real-world range;
- desired game-supported professional range;
- sandbox range;
- hard engine range.

Do **not** confuse “real stadiums usually fall here” with “the simulation cannot support anything outside here.”

---

## 11. Physics authority

The built geometry must affect outcomes through physical causality.

### 11.1 Wall collision

```text
canonical ball trajectory
        ↓
fence intersection
        ↓
compare ball height with wall height
        ├─ clears applicable boundary
        │      ↓
        │   rule interpretation
        │
        └─ hits wall
               ↓
          canonical collision response
               ↓
            live ball continues
```

The exact HR rule and out-of-play interpretation remain RuleEngine responsibilities.

### 11.2 Defensive movement

Defenders should react to the actual field.

A deep gap means:

- farther travel;
- different intercept time;
- different relay geometry;
- different backup responsibilities.

The game should not compensate by boosting or reducing defender stats.

### 11.3 Foul-space effects

Large foul territory changes outcomes because defenders physically have more playable space and time to reach balls.

### 11.4 Surface

Surface regions may eventually affect:

- bounce;
- rolling resistance;
- traction;
- warning-track behavior.

But only after those physical effects are explicitly approved and implemented.

Until then, a surface region may exist as geometry / metadata without hidden outcome bonuses.

---

## 12. No stadium “result personality” shortcut

A stadium may become hitter-friendly or pitcher-friendly statistically.

But that identity should be **derived from geometry and environment over many plays**.

Preferred:

```text
short wall
+ low fence
+ actual batted-ball distribution
        ↓
more balls physically clear wall
        ↓
more home runs
```

Not:

```text
stadium.homeRunModifier = 1.12
```

Derived metrics such as park factors may be computed later for analytics, scouting or UI.

They must not feed back as unexplained probability multipliers unless a separate physical cause requires it.

---

## 13. Presentation contract

### 13.1 Mini Drone-Art

Mini should project the same canonical geometry.

```text
BallparkGeometry
        ↓
Drone-Art camera
        ↓
4px display representation
```

If left field is shallow in Core, it must look shallow when projected.

If center field bulges outward, it must look deeper.

If one wall is taller, any approved height cue must derive from that wall geometry.

Presentation must not maintain a separate decorative fence used for baseball outcomes.

### 13.2 Future Natural

Natural should observe the same `BallparkGeometry` through a richer renderer.

```text
same BallparkGeometry
├─ Mini observer
└─ Natural observer
```

The ballpark does not become a different physical park when the renderer changes.

---

## 14. Relationship to stadium visual models 1-10

The ten planned models are Presentation templates.

A future `BallparkPresentationModel` may provide visual assets / descriptors such as:

- stand silhouette;
- roof family;
- scoreboard family;
- light-tower family;
- concourse massing;
- decorative landmarks.

This plan deliberately does **not** decide what Models 1–10 look like.

Work should eventually receive those visual-design decisions separately.

The Presentation model may adapt visually to the validated geometry, but it cannot rewrite that geometry.

---

## 15. Replay compatibility

A replay of a historical game must be able to reconstruct the same park.

Replay metadata should eventually identify at least the canonical ballpark geometry revision used by the match.

Conceptually:

```text
Replay
├─ canonical match evidence
├─ ballparkGeometryId
└─ ballparkGeometryVersion
```

If the user edits the stadium after the match, the old replay must not silently adopt the new fence.

This implies **immutable match-bound geometry revisions**.

---

## 16. Camera-network compatibility

The future Broadcast Camera Network uses ballpark-specific camera rigs.

Ballpark Builder therefore needs a clean boundary:

```text
validated BallparkGeometry
        ↓
camera-rig placement / validation
        ↓
Broadcast Camera Network
```

Camera metadata remains Presentation-side.

A bad camera angle must never modify geometry to make the shot work.

Future builder validation may warn when a selected visual stadium model / camera rig has severe occlusion or impossible mounting geometry, but that is separate from baseball legality.

---

## 17. Versioning and match freeze

A custom ballpark should have stable identity.

Future concepts:

- `ballparkBuildId`;
- `geometryVersion`;
- `presentationModelVersion`;
- `validationProfileId`.

Once a match begins:

> **the exact canonical geometry for that match is frozen.**

Editing the stadium creates a new revision.

Do not mutate an active or historical match's geometry in place.

This is necessary for:

- determinism;
- replay;
- statistics;
- debugging;
- saved seasons.

---

## 18. Future environment extension

The builder architecture may reserve a future environment layer for:

- altitude;
- temperature;
- air density;
- wind;
- roof/open-air state where physically relevant.

However, this plan does not authorize those systems.

If present before physical support exists, they must not secretly change outcomes.

A future approved environment model may feed canonical ball physics explicitly.

---

## 19. Builder input levels without fixing UI

The data model should support both easy and advanced editing without deciding the final interface.

### Simple data intent

Possible simple inputs:

- LEFT distance;
- CENTER distance;
- RIGHT distance;
- broad fence-height presets or numeric values;
- broad foul-territory configuration.

### Advanced data intent

Possible advanced inputs:

- extra fence control points;
- per-control-point / per-segment height;
- asymmetric foul-territory boundary;
- surface-region geometry.

This is an architecture requirement only.

The actual screens, sliders, drag handles, top-down editor and interaction model are Work-owned future design.

---

## 20. Adversarial architecture tests for a future implementation

A future implementation should eventually prove at least the following.

1. **Presentation model isolation**  
   Switching Model 1 -> Model 10 with identical `BallparkGeometry` cannot change Match Core outcomes.

2. **Geometry causality**  
   The same contact / seed played in two physically different accepted parks may produce different wall interactions only because geometry differs.

3. **Asymmetry**  
   A legal asymmetric outfield does not require hard-coded left/right stadium branches.

4. **Tall-wall behavior**  
   A ball below the local wall top collides; a ball above the applicable boundary can proceed to rule interpretation.

5. **Foul territory**  
   Larger playable foul space affects catch opportunities through movement / ball location, not an out-probability modifier.

6. **Extreme rejection**  
   Nonsensical professional geometry such as the user's 500m-center example is rejected by the appropriate validation layer once numeric limits are calibrated.

7. **Structural rejection**  
   Self-intersecting / malformed unsupported geometry never reaches Match Core.

8. **Arbitrary defense compatibility**  
   Existing flexible defensive positioning still works in accepted custom parks.

9. **Presentation truth**  
   Mini and Natural render the same accepted fence / territory geometry used by physics.

10. **Replay stability**  
    Editing a saved park later does not change a historical replay's geometry revision.

11. **Render isolation**  
    Renderer OFF / Mini / Natural do not alter physical stadium interactions.

12. **Complexity bound**  
    Builder geometry remains within evidence-backed simulation / pathfinding / replay performance limits.

---

## 21. Future implementation sequence

Only after explicit user approval:

1. research real ballpark dimension distributions and edge cases;
2. define `BallparkBuildConfig`;
3. define structural validation and calibrated hard bounds;
4. define CompetitionProfile ballpark constraints;
5. define immutable canonical `BallparkGeometry`;
6. connect existing wall / foul / surface physical contracts without parallel truth;
7. add persistence / geometry revision identity;
8. prove custom-geometry deterministic physics;
9. expose renderer-neutral geometry to Mini / replay / Natural;
10. define camera-rig compatibility;
11. hand final builder UI / stadium Models 1–10 appearance to Work.

This sequence is a future reference, not current authorization.

---

## 22. Explicit non-goals of this plan

This document does **not** decide:

- final minimum / maximum field dimensions;
- exact real-world league legality values;
- the visual appearance of Models 1–10;
- the builder UI;
- editor interaction;
- stadium economics;
- construction cost;
- attendance/capacity systems;
- crowd simulation;
- exact wall-material physics;
- weather physics;
- roof physics;
- custom basepath / mound-rule editing.

Those require separate future approval and/or research.

---

## 23. Saved architectural principle

> **The player edits the baseball world, not a stadium-result modifier.**

A custom ballpark is accepted canonical geometry.

The ball, fielders, runners, cameras and replay system all encounter that same geometry.

If arbitrary but valid custom parks continue to produce coherent baseball without stadium-specific result hacks, that is evidence that the Match Core is genuinely flexible rather than tuned to one fixed field.