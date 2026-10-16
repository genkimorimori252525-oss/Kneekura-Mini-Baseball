# Pitch Release Geometry v1 — CANONICAL / DESIGN FROZEN

更新日: 2026-09-23
状態: **CANONICAL / DESIGN FROZEN v1**
対象: Shared Match Core（Mini / Natural 共通）

関連:
- docs/game-design/02-rules-ratings-defense.md
- docs/game-design/09-player-trait-catalog.md
- docs/superpowers/plans/2026-09-23-pitch-timing-cadence-quick-delivery.md

## 1. 目的

投手ごとの「どこからボールが空間へ放たれるか」を、投球フォーム名や特殊能力のBuffではなく、選手固有の正史幾何として保持する。

狙い:

- OVERHANDに近いほど高いリリースになりやすい
- UNDERHANDに近いほど低いリリースになりやすい
- 同じOVERHANDでも選手ごとに高さが違う
- 高い投手は本当に高所から投げ下ろす軌道になる
- 低い投手は本当に低所から投げ上げるような進入幾何になる
- 投球ごとにrelease pointをランダム移動させない
- 表示フォームではなく、実座標からPitch Physicsを開始する

「屋根から落ちてくる」「地面から生えてくる」はPresentation上の感覚として再現し得るが、Core座標は身体的に到達可能な実在範囲を守る。

---

## 2. Source of Truth

Canonical sourceはフォーム名ではなく PitcherReleaseGeometryProfile。

~~~ts
type ArmSlotClass =
  | 'OVERHAND'
  | 'THREE_QUARTER'
  | 'SIDEARM'
  | 'UNDERHAND';

type ReleaseHeightTier =
  | 'VERY_LOW'
  | 'LOW'
  | 'LOW_MID'
  | 'MID'
  | 'HIGH_MID'
  | 'HIGH'
  | 'VERY_HIGH';

type PitcherReleaseGeometryProfile = Readonly<{
  armSlotClass: ArmSlotClass;
  releaseHeightTier: ReleaseHeightTier;

  releaseHeightRatio: number;
  releaseLateralRatio: number;
  releaseExtensionRatio: number;

  armSlotElevationDeg: number;
  armSlotAzimuthDeg: number;
}>;
~~~

Tier / armSlotClass は人間向け分類・生成priorであり、Match Coreが読む真値はbody-relative continuous geometry。

---

## 3. Arm Slotは範囲の傾向であり、固定座標表ではない

禁止:

~~~text
OVERHAND -> releaseY = 2.00m
THREE_QUARTER -> releaseY = 1.75m
UNDERHAND -> releaseY = 1.05m
~~~

採用:

~~~text
body dimensions
+ armSlotClass prior
+ player-specific delivery geometry
      ↓
fixed body-relative release geometry
      ↓
absolute world release position
~~~

同じOVERHANDでも、選手AとBでrelease heightが異なってよい。

~~~text
OVERHAND / VERY_HIGH
OVERHAND / HIGH
OVERHAND / HIGH_MID
~~~

THREE_QUARTERの高い選手が、低いOVERHANDと近いabsolute heightになることも許す。

分類境界は連続現象を人間向けに要約するだけで、物理へ段差を作らない。

---

## 4. Release Height Tier

Height Tierは生成・表示・検索用のProjection。

順序は固定:

~~~text
VERY_LOW
  < LOW
  < LOW_MID
  < MID
  < HIGH_MID
  < HIGH
  < VERY_HIGH
~~~

ただしCore計算はTier文字列を直接使わない。

~~~text
releaseHeightRatio
 -> absolute release Y
 -> trajectory
 -> optional tier projection
~~~

Tier境界のexact数値はCalibrationで決める。

---

## 5. Body Dimensionsとの接続

absolute release pointは身長だけで決めない。

最低限:

- body height
- shoulder / arm reach proxy
- delivery posture
- arm slot
- extension
- player-specific release geometry

を使う。

概念:

~~~text
PlayerBodyProfile
+ PitcherReleaseGeometryProfile
+ fixed mound reference
      ↓
CanonicalReleasePosition
~~~

例:

~~~ts
type CanonicalReleasePosition = Readonly<{
  x: number;
  y: number;
  z: number;
}>;
~~~

---

## 6. Pitch-to-pitch randomizationは禁止

本v1ではrelease geometryは選手固有の確定値。

禁止:

~~~text
pitch 1 releaseY = 1.92
pitch 2 releaseY = 1.86
pitch 3 releaseY = 1.97
~~~

を「自然な揺らぎ」として入れること。

Pitch Timingの±50ms jitterとは完全に別。

~~~text
Timing
  -> pitch-to-pitch natural variation allowed

Release Geometry
  -> fixed player delivery geometry
~~~

フォーム変更・身体変化等のCareer eventが正式に成立した場合のみProfileそのものを更新できる。

一球ごとの乱数でProfileを変えない。

---

## 7. World-space release point

各投球のBallFlight開始位置は、固定profileから導出した同じworld release pointを使う。

~~~text
motionStart
  ...
releaseUs
  + CanonicalReleasePosition
  + releaseVelocity
  + spin
      ↓
BallFlight
~~~

releaseUs はPitch Timingの責任。
CanonicalReleasePosition はRelease Geometryの責任。

~~~text
when?  -> Pitch Timing
where? -> Release Geometry
how?   -> Pitch Physics
~~~

を混ぜない。

---

## 8. Release Geometryは本当に軌道を変える

禁止:

~~~text
UNDERHAND label
 -> batter difficulty +10

OVERHAND label
 -> downward break +5
~~~

採用:

~~~text
fixed release position
+ fixed/derived launch direction
+ actual velocity
+ actual spin / aerodynamics
+ gravity
      ↓
actual trajectory
~~~

高いreleaseではplateまでのvertical geometry、必要なinitial direction、actual approach angle、打者視点のball emergence位置が変わる。

低いreleaseでは低い位置から視界へ現れ、same pitch parametersでもplateへの進入geometryが変わり、下から伸び上がるような知覚が自然に生じ得る。

これは結果Buffではなく物理差。

---

## 9. 「屋根から落ちる / 地面から生える」感覚

極端な高低フォームの価値はTraitで演出しない。

~~~text
VERY_HIGH actual release
 -> high visual origin
 -> trajectory descends through batter's view
 -> 「屋根から落ちてくる」ような感覚

VERY_LOW actual release
 -> low visual origin
 -> trajectory enters from below usual expectation
 -> 「地面から生えてくる」ような感覚
~~~

ただしCoreはliteral roof / ground coordinatesを生成しない。

身体のkinematic envelope（身体的に到達可能な範囲）外へrelease pointを置くことは禁止する。

---

## 10. Lateral / Extension geometry

高さだけを孤立させず、v1 contractには以下も固定値として持たせる。

- lateral offset
- extension
- arm-slot elevation
- arm-slot azimuth

これにより同じrelease heightでも、より横から出る、より打者へ近い位置で放す、左右の見え方が異なる、を将来正しく表現できる。

ただし本v1の最優先Calibrationはrelease height。

---

## 11. 投球位置左 / 右との境界

投球位置左 / 投球位置右 を一球ごとのrandom setup変更にはしない。

v1では選手のCanonical Delivery Setupの一部として固定する。

将来、明示的なrubber-position strategyを導入する場合は:

~~~text
Base Release Geometry
+ explicit Setup Choice
 -> effective release position
~~~

と別層にする。

その場合でもrandom pitch-to-pitch driftは禁止し、実際の戦術Decision / setup change eventが必要。

本v1ではその戦術変更は未実装。

---

## 12. Pitch-typeとの境界

原則、選手のBase Release Geometryは球種で変えない。

同じ投球フォームから fastball / slider / changeup 等を放つ。

リリース○ Trait / descriptorはpitch-type間のフォーム差・release差の小ささを表すが、Base Release Geometryへ追加Buffを与えない。

将来、球種ごとの実在する微小なrelease差をモデル化する場合も:

~~~text
Base Release Geometry
+ measured pitch-type execution deviation
~~~

として別層にし、Base Profile自体は固定する。

---

## 13. Presentation contract

PresentationはCoreのrelease pointを観測する。

- Pitcher POV
- Batter POV
- catcher-behind view
- replay
- Natural Baseball

すべて同じCanonicalReleasePositionを使う。

描画がrelease pointを作ってはいけない。

4コマ投球フォームでは:

- Timing速度変更は既存契約どおりframes 2–4のみ
- release frame / marker位置はCoreのrelease eventへ整合
- sprite上の腕位置とcanonical ball originが大きく矛盾しないようPresentation adapterが合わせる

ただしPresentationの誤差をCoreへ戻さない。

---

## 14. Player Generation

新規Pitcher生成時は:

~~~text
body profile
 -> arm-slot prior
 -> player-specific continuous geometry sample
 -> physical plausibility validation
 -> frozen PitcherReleaseGeometryProfile
~~~

とする。

重要:

- armSlotClass 内でも広い個体差を許す。
- class境界近くの選手を自然に作れる。
- Tierを先に引いて物理値を強制するのではなく、continuous sourceからTierを投影する方を優先する。
- Career start後、通常の一球ごとには再抽選しない。

---

## 15. Career change

通常の試合では固定。

変更を許可する原因候補:

- explicit pitching-form rebuild
- long-term coaching / mechanical change
- major injury recovery that genuinely changes delivery
- deliberate career-level arm-slot conversion

禁止:

~~~text
bad outing -> release height random reroll
good condition -> arm slot suddenly higher
~~~

フォーム改造はCareer eventとして履歴を残す。

---

## 16. Batter Perception

打者は ArmSlotClass labelを読んで補正を受けない。

~~~text
CanonicalReleasePosition
+ ball trajectory
+ visibility / occlusion
+ batter perception / familiarity
      ↓
ObservedPitch
~~~

結果として高い / 低いreleaseが認識・timing・trajectory predictionへ影響する。

UNDERHAND -> batter penalty の直接処理は禁止。

---

## 17. Trait / Rating boundary

Release Geometryそのものは原則Neutral Physical / Delivery Fact。

Traitが同じ原因を再加算しない。

例:

- 球持ち○ / ディレイドアーム
  - extension / visibility等の結果を要約可能
- クロスファイヤー
  - release geometry + diagonal command techniqueを要約可能
- リリース○
  - pitch-type間のrelease差・form差の小ささ

geometry -> Trait label -> geometry buff という循環は禁止。

---

## 18. Required invariants

1. Same Player + unchanged delivery profile -> same Base Release Geometry every pitch.
2. Timing jitter never changes release position.
3. QUICK never changes Base Release Geometry.
4. DELIBERATE cadence never changes Base Release Geometry.
5. 緩急○ never changes Base Release Geometry.
6. Same physics inputs except release height -> trajectory may differ because initial position differs.
7. ArmSlotClass label alone never changes batter ability.
8. ReleaseHeightTier is monotonic in underlying release height.
9. Body plausibility envelope cannot be exceeded.
10. Presentation cannot overwrite Core release point.
11. Mini / Natural share the same release geometry.
12. Career form-change event may version the profile; ordinary pitches may not.

---

## 19. Adversarial tests

### A. Same player, repeated pitches

100+ pitches from unchanged profile:

~~~text
releasePosition == exactly same base geometry
~~~

Timing may differ; geometry does not.

### B. Same OVERHAND, different players

Two OVERHAND pitchers with different continuous heights produce different canonical Y positions.

### C. Class overlap

High THREE_QUARTER and low OVERHAND may have nearby absolute heights without error.

### D. High vs low release physics

Keep velocity, spin, target intent and environment controlled, vary only canonical release geometry.

BallFlight must start at different coordinates and produce the corresponding geometric trajectory difference.

### E. No magic difficulty

Changing only display label OVERHAND / UNDERHAND while keeping canonical geometry identical must not change Match result.

### F. Timing isolation

QUICK / DELIBERATE / ±50ms timing changes must not alter release position.

### G. Presentation isolation

Changing sprite / camera / 4-frame timing does not alter release geometry.

### H. Physical envelope

Impossible release coordinates outside the body model fail validation.

---

## 20. Implementation boundary

Recommended new Core contracts:

~~~text
src/core/sim/pitch/
  PitcherReleaseGeometry.ts
  PitcherReleaseGeometry.test.ts
  CanonicalPitchRelease.ts
  CanonicalPitchRelease.test.ts
~~~

Potential output:

~~~ts
type CanonicalPitchRelease = Readonly<{
  releaseAtUs: number;
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;
~~~

This becomes the boundary into BallFlight.

releaseAtUs comes from Pitch Timing.
position comes from Release Geometry.
velocity / spin come from Pitch Physics / execution.

---

## 21. DESIGN FROZEN decisions

The following are frozen for v1:

- OVERHAND / THREE_QUARTER / SIDEARM / UNDERHAND classification exists.
- classification is not the physics source of truth.
- each pitcher has a fixed player-specific continuous release geometry.
- release height is player-specific even inside the same arm-slot class.
- height tier is a projection over continuous height.
- higher arm slots tend higher; lower arm slots tend lower, without hard non-overlapping buckets.
- release geometry is not randomized pitch-to-pitch.
- timing jitter and release geometry are separate.
- extreme high / low trajectories emerge from real starting coordinates.
- no direct form-label difficulty buff.
- no Trait double counting.
- changes require an explicit long-term delivery-change event.
- Core release point is shared by Mini and Natural.
