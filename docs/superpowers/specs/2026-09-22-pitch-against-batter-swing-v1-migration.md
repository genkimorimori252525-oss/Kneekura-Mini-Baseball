# PitchAgainstBatter -> Swing Kinematics v1 Migration

Date: 2026-09-22

Status: **implementation-authorized migration plan**

Base:

```text
Swing Kinematics v1 frozen head:
3d93500d39779760b02ff5d6583094ed3a9acf89
```

## 1. Product decision

Mini Baseball uses numerical player attributes / ratings plus Swing Kinematics
as the batting-motion authority.

This migration MUST NOT add:

- skeletal dynamics;
- joint torque simulation;
- muscle/tendon simulation;
- ground-reaction-force simulation;
- player-specific mocap as runtime authority.

The migration exists only to remove the remaining historical first-order bat
motion from active plate-appearance flow.

## 2. Legacy call graph found

The remaining legacy production-adjacent path is:

```text
CommandedPlateAppearanceSequence
  -> PlateAppearanceCommandPitchAdapter
  -> PitchAgainstBatter
  -> SwingingPitchPhysicalResult
  -> sampleCompatibilityBatterSwingState

CatcherLedPlateAppearanceSequence
  -> CatcherLeadCommandAdapter
  -> PlateAppearanceCommandPitchAdapter
  -> PitchAgainstBatter
  -> SwingingPitchPhysicalResult
  -> sampleCompatibilityBatterSwingState
```

The generic historical sequence also remains:

```text
PlateAppearancePitchSequence
  -> PitchAgainstBatter
```

That generic sequence is retained as compatibility-only and is not a production
Swing Kinematics v1 claim.

Separately, these older aerodynamic-but-non-rigid modules remain compatibility
or test surfaces:

- AerodynamicPitchAgainstBatter;
- AerodynamicSwingingPitchPhysicalResult;
- AnticipationAwareAerodynamicSwing in its historical BatterSwingWindow form.

## 3. Existing production-capable pieces to reuse

Do not build another swing or contact engine.

Use:

- `AerodynamicPitchTrajectory`;
- `CourseAwareSwingKinematicsV1`;
- `SwingKinematicsV1`;
- `createRigidBatSwingWindowFromKinematicsV1`;
- `resolveAerodynamicRigidBatSwing`;
- `AerodynamicRigidPitchAgainstBatter`;
- `RigidBatBallContact`;
- the frozen Nathan 2012 wood local-contact response.

Catcher-led pitch execution already has a modern physical path:

```text
CatcherLedPhysicalPitch
  -> CatcherCalledPitchSkillFlight
  -> PitchSkillFlightSample
  -> PitchReleaseFlightSlice
  -> AerodynamicPitchTrajectory
```

That aerodynamic trajectory should feed the migrated batter resolver directly.

## 4. New production batter input boundary

Production plate-appearance code needs numerical input only:

```ts
type SwingKinematicsV1BatterRuntime = {
  handedness: 'R' | 'L';
  centerOfMass: Vec3;
  batPhysical: RigidBatPhysicalProperties;
  ball: RigidBaseballProperties;
  contactParameterResolver:
    RigidBatBallContactParameterResolver;
  swingProfile?: SwingKinematicsCourseProfileV1;
};
```

No body-joint state belongs here.

Batter tactical input remains numerical:

- take / balanced / aggressive decision probability;
- early / neutral / late timing bias;
- anticipation recognition delay where present.

These values alter decision/timing or the versioned swing profile. They never
declare contact, hit type or outcome.

## 5. Production resolver contract

Create one canonical plate-appearance boundary for a physical pitch:

```text
actual/predicted AerodynamicPitchTrajectory
             +
strike zone
             +
numerical batter runtime
             +
take or swing decision
             ↓
Swing Kinematics v1 pitch resolver
             ↓
take:
  aerodynamic plate crossing -> canonical called ball/strike

swing:
  course-aware v1 plan
  -> whole-trajectory timing shift
  -> rigid tapered bat contact search
  -> canonical contact or swinging strike
```

The resolver records directly into `CanonicalPlateAppearanceTimeline`.

## 6. Timing rule

Early/late command bias and anticipation delay MUST move the entire physical
Swing Kinematics trajectory:

```text
startTick   += delta
contactTick += delta
endTick     += delta
```

The 3D positions/axes at corresponding swing phase are unchanged.

Do not shift only the search interval around an unshifted trajectory.

This makes timing error causal: the bat arrives earlier/later relative to the
same actual pitch.

## 7. Commanded plate-appearance migration

The existing `CommandedPlateAppearanceSequence` / coordinator names remain the
active public sequence names, but their active environment becomes an
aerodynamic physical-pitch environment.

A production environment supplies:

- actual aerodynamic pitch trajectory;
- optional predicted trajectory if perception differs;
- plate/strike-zone data;
- numerical batter runtime;
- existing deterministic batter decision calibration.

The old `PlateAppearanceCommandPitchAdapter` exact-target +
`PitchTrajectorySegment` generator remains compatibility-only. It must not be
called by the migrated production sequence.

Pitcher/catcher physical generation is upstream of this resolver. In the
catcher-led flow it comes from existing pitch-skill physics.

## 8. Catcher-led migration

The existing active catcher-led sequence should use
`simulateCatcherLedPhysicalPitch()`, not `CatcherLeadCommandAdapter`.

For each pitch:

```text
manager macro
 -> catcher call
 -> optional pitcher sign override
 -> pitch skill physical execution
 -> AerodynamicPitchTrajectory
 -> batter decision / anticipation timing
 -> Swing Kinematics v1
 -> canonical timeline
```

This preserves the already-designed causal pitching path.

## 9. Compatibility boundary

The following may remain for old fixtures/history but are not allowed imports
from migrated production sequence/coordinator modules:

- `PitchAgainstBatter`;
- `SwingingPitchPhysicalResult`;
- `AerodynamicSwingingPitchPhysicalResult`;
- historical `BatterSwingWindow` production use;
- `sampleCompatibilityBatterSwingState`.

A source-level regression test should enforce this boundary.

## 10. Definition of migration complete

Migration is complete when:

1. Commanded sequence/coordinator swing pitches use the v1 rigid path.
2. Catcher-led active sequence uses physical aerodynamic pitch skill output plus
   v1 rigid swing.
3. whole-trajectory timing shifts cover command bias and anticipation;
4. take/walk/strikeout/contact/miss canonical behavior stays deterministic;
5. production modules have no legacy first-order imports;
6. compatibility modules stay explicitly labeled and tested;
7. exact-head P0 Core is green.