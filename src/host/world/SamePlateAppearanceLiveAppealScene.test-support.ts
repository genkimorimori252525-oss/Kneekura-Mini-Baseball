import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import type { BallWorldVenueLegalPolicy } from '../../core/rules/BallWorldVenueLegalCoverage';
import { physicalThrowSceneFixture } from './SamePlateAppearancePhysicalThrowScene.test-support';

/** One explicitly synthetic venue, declared before the original World and all
 * bodies. The short diamond puts the existing receiver at first without changing
 * IFN01's accepted throw poses or physics. This does not qualify IFN01 or PL01.
 * Bag extents reuse BattedWorldBaseContactFixtures; the top plane is the exact
 * existing Native measurement (body height .95 plus foot offset -.88). */
export const liveAppealSceneFixture = () => ({
  originalBaseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } },
  bags: { halfSize: { x: .2, z: .2 }, surfaceHeightMeters: .95 - .88 },
  pitcherPlate: { region: { center: { x: 0, z: 0 }, halfSize: { x: .4, z: .2 }, rotationRadians: 0 }, surfaceHeightMeters: .95 - .88 },
  // Existing SamePlateAppearanceDefenderDeparture interior recipe. An accepted
  // interior certificate is not inferred from collision geometry.
  rulePolicy: { version: 'closed_interior_venue_legal_regions_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id,
    rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision, regions: [{ regionId: 'explicit-native-appeal-interior',
      classification: 'inside_playable_region', minimum: { x: -100, y: -10, z: -100 }, maximum: { x: 100, y: 10, z: 100 } }] } satisfies BallWorldVenueLegalPolicy,
  throwScene: physicalThrowSceneFixture(),
});
