import { expect, it } from 'vitest';
import { deriveSamePaDefensiveSupportGeometry } from './SamePlateAppearanceDefensiveSupportGeometry';
import { fixture } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';

const receipt = () => ({ at: { originTick: 0, elapsedSeconds: 0.1, tick: 100 }, perceived: {
  observerId: 'support', observationTime: 100, ball: { estimate: { position: { x: 12, y: 2, z: 20 }, velocity: { x: 0, y: 0, z: 0 } },
    sourceObservedAt: 80, predictedAt: 100, confidence: 0.9 }, players: [], communications: [], knownContext: null,
} } as never);
it('SG01 derives support targets from owned perceived ball and field geometry without caller coordinates', () => {
  const geometry = fixture().geometry;
  const value = deriveSamePaDefensiveSupportGeometry({ kind: 'perceived_ball_support_geometry_v1', base: 1 }, receipt(), geometry, null);
  expect(value.cues.map(c => c.kind)).toEqual(['relay_needed', 'backup_needed', 'deep_coverage_needed']);
  expect(value.targetByRole.base_cover).toEqual({ x: geometry.bases.first.region.center.x, z: geometry.bases.first.region.center.z });
  expect(value.cues.every(c => c.observedAt === 100 && c.confidence === 0.9)).toBe(true);
  expect(value).not.toHaveProperty('physicalOuts');
});
it('SG02 requires observed executed teammate commitment before base-cover evidence can exist', () => {
  const observed: any = receipt(); observed.perceived.players.push({ playerId: 'handler', memory: { sourceObservedAt: 90, predictedAt: 100, confidence: 0.7,
    estimate: { position: { x: 20, z: 20 }, velocity: { x: -1, z: 0 } } } });
  const commitment = { playerId: 'handler', issuedAtTick: 85 };
  const value = deriveSamePaDefensiveSupportGeometry({ kind: 'perceived_ball_support_geometry_v1', base: 2 }, observed, fixture().geometry, commitment);
  expect(value.cues.slice(-2)).toEqual([{ kind: 'teammate_ball_commitment', playerId: 'handler', observedAt: 100, confidence: 0.7 },
    { kind: 'base_needs_cover', base: 2, observedAt: 100, confidence: 0.7 }]);
  expect(() => deriveSamePaDefensiveSupportGeometry({ kind: 'perceived_ball_support_geometry_v1', base: 2 }, receipt(), fixture().geometry, commitment)).toThrow(/visible/);
  expect(() => deriveSamePaDefensiveSupportGeometry({ kind: 'perceived_ball_support_geometry_v1', base: 2 }, observed, fixture().geometry, { ...commitment, issuedAtTick: 101 })).toThrow(/future/);
  observed.perceived.players[0].memory.estimate.velocity.x = 0;
  expect(() => deriveSamePaDefensiveSupportGeometry({ kind: 'perceived_ball_support_geometry_v1', base: 2 }, observed, fixture().geometry, commitment)).toThrow(/visibly approaching/);
});
it('SG03 rejects future, foreign and missing perception rather than consulting canonical ball truth', () => {
  for (const mutation of [(r: any) => r.perceived.observerId = 'foreign', (r: any) => r.perceived.ball = null,
    (r: any) => r.perceived.ball.sourceObservedAt = 101, (r: any) => r.perceived.ball.predictedAt = 99]) {
    const r: any = receipt(); mutation(r);
    expect(() => deriveSamePaDefensiveSupportGeometry({ kind: 'perceived_ball_support_geometry_v1', base: 1 }, r, fixture().geometry, null, 'support')).toThrow();
  }
});
