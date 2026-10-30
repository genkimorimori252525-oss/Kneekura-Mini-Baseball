import type { DefensivePerceivedCue, DefensiveIntent } from '../../core/sim/fielding/DefensiveDecision';
import type { BattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { Vec2 } from '../../core/model/geometry';
import type { ActualFieldObservationReceipt } from './ActualFieldObservation';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Explicit opt-in geometric policy. Inputs identify a known original bag and
 * optional actually executed teammate command; callers supply no cue or target.
 * This is movement intent evidence, never reception, custody or an OUT. */
export type SamePaDefensiveSupportGeometry = Readonly<{
  kind: 'perceived_ball_support_geometry_v1'; base: 1 | 2 | 3 | 4;
  teammateMotionReference?: SamePaReference<'pa_physical_v1_field_steps'>;
}>;
export const deriveSamePaDefensiveSupportGeometry = (request: SamePaDefensiveSupportGeometry,
  receipt: ActualFieldObservationReceipt, geometry: BattedWorldFieldGeometry,
  commitment: Readonly<{ playerId: string; issuedAtTick: number }> | null, playerId = receipt.perceived.observerId) => {
  const perceived = receipt.perceived, ball = perceived.ball, at = receipt.at.tick;
  if (request.kind !== 'perceived_ball_support_geometry_v1' || ![1, 2, 3, 4].includes(request.base)
    || perceived.observerId !== playerId || perceived.observationTime !== at || !ball
    || ball.predictedAt !== at || ball.sourceObservedAt > at) throw new Error('support geometry requires original available ball perception');
  const baseId = ({ 1: 'first', 2: 'second', 3: 'third', 4: 'home' } as const)[request.base];
  const base = geometry.bases[baseId].region.center, home = geometry.bases.home.region.center;
  const point = { x: ball.estimate.position.x, z: ball.estimate.position.z };
  const finite = (v: Vec2) => { if (!Object.values(v).every(Number.isFinite)) throw new Error('support geometry target arithmetic overflow'); return v; };
  const targetByRole = { base_cover: finite({ ...base }), relay: finite({ x: (base.x + point.x) / 2, z: (base.z + point.z) / 2 }),
    backup: finite({ x: 2 * base.x - point.x, z: 2 * base.z - point.z }),
    deep_coverage: finite({ x: 2 * point.x - home.x, z: 2 * point.z - home.z }) };
  const cues: DefensivePerceivedCue[] = (['relay', 'backup', 'deep_coverage'] as const).map(role => ({
    kind: `${role}_needed` as 'relay_needed' | 'backup_needed' | 'deep_coverage_needed',
    target: targetByRole[role], observedAt: at, confidence: ball.confidence,
  }));
  if (commitment) {
    if (commitment.playerId === playerId || !Number.isSafeInteger(commitment.issuedAtTick)
      || commitment.issuedAtTick > at) throw new Error('support geometry cannot use a foreign or future commitment');
    const visible = perceived.players.find(p => p.playerId === commitment.playerId)?.memory;
    if (!visible || visible.predictedAt !== at || visible.sourceObservedAt < commitment.issuedAtTick
      || visible.sourceObservedAt > at) throw new Error('support geometry commitment must be visible after actual execution');
    const velocity = visible.estimate.velocity, position = visible.estimate.position;
    const approach = velocity.x * (point.x - position.x) + velocity.z * (point.z - position.z);
    if (!Number.isFinite(approach) || approach <= 0) throw new Error('support geometry commitment requires visibly approaching teammate motion');
    const confidence = Math.min(ball.confidence, visible.confidence);
    cues.push({ kind: 'teammate_ball_commitment', playerId: commitment.playerId, observedAt: at, confidence },
      { kind: 'base_needs_cover', base: request.base, observedAt: at, confidence });
  }
  return freeze({ kind: request.kind, baseId, targetByRole, cues });
};
export const samePaSupportIntentTarget = (intent: DefensiveIntent,
  support: ReturnType<typeof deriveSamePaDefensiveSupportGeometry>, receipt: ActualFieldObservationReceipt): Vec2 | null => {
  if (intent.kind === 'hold') return null;
  if (intent.kind === 'ball_handler') {
    if (!receipt.perceived.ball) throw new Error('support pursuit requires original ball perception');
    return { x: receipt.perceived.ball.estimate.position.x, z: receipt.perceived.ball.estimate.position.z };
  }
  if (intent.kind === 'base_cover') {
    const cue = support.cues.find(c => c.kind === 'base_needs_cover' && c.base === intent.base);
    if (!cue) throw new Error('support cover requires original available base cue');
    return support.targetByRole.base_cover;
  }
  return intent.target;
};
