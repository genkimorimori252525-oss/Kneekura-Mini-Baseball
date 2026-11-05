import type { BaseballGroundMaterial } from './BaseballGroundDynamics';

/** Provisional authored baselines, not measured MLB/stadium constants. Keep
 * surface response separate from airborne forces and player ability. Explicit
 * callers may provide their own full material without losing legacy replay. */
export const BASEBALL_SURFACES_V101: Readonly<Record<'grass' | 'dirt' | 'legacy', BaseballGroundMaterial>> = Object.freeze({
  grass: Object.freeze({ restitution: .48, slidingFriction: .24, rollingDecelerationMps2: 1.2, normalSpinDecayPerSecond: .18 }),
  dirt: Object.freeze({ restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .65, normalSpinDecayPerSecond: .18 }),
  legacy: Object.freeze({ restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .36, normalSpinDecayPerSecond: .18 }),
});

/** 2026-11-03: a grounder through the infield now dies in the outfield instead of reaching the wall.
 * Air drag on a rolling ball is not simulated, so it is carried in this rolling term. */
/** The infield dirt arc of the rules: 95 ft from the centre of the pitcher's plate, whose front edge is 60 ft 6 in from the
 * back point of home plate (the field's origin) and which is 6 in deep. Beyond it the floor is grass (park.grassMaterialV1). */
export const MLB_INFIELD_DIRT_ARC_V1 = Object.freeze({ centerX: 0, centerZ: (60.5 + .25) * .3048, radiusM: 95 * .3048 });

export const LIVE_MATCH_GRASS_V3: BaseballGroundMaterial = Object.freeze({ restitution: .42, slidingFriction: .45, rollingDecelerationMps2: 9, normalSpinDecayPerSecond: .18 });

/** Match grass from 2026-11-02: a grounder bleeds speed on bounce and roll. Provisional until the league calibration. */
export const LIVE_MATCH_GRASS_V2: BaseballGroundMaterial = Object.freeze({ restitution: .42, slidingFriction: .45, rollingDecelerationMps2: 5, normalSpinDecayPerSecond: .18 });
