import type { Vec3 } from '../../model/geometry';

/** Tactical evidence available now. This is never a home-run ruling. */
export type LiveDefensiveOpportunityV1 = Readonly<{
  kind: 'none-decisive-over-fence'; availableAtTick: number; observationTick: number;
  predictedCarryMeters: number; carryBeyondFenceMeters: number; fenceClearanceMeters: number;
  predictedFenceSeconds: number; captureFeasibility: 'CONSERVATIVE_REACH_ENVELOPE_EXCLUDED';
  forecastBasis: 'EXPLICIT_SENSOR_PREDICTION_MODEL';
}>;

export const LIVE_DEFENSIVE_OPPORTUNITY_POLICY_V1 = Object.freeze({
  minimumCarryBeyondFenceMeters: 15, minimumFenceClearanceMeters: 2.5,
  minimumFairLineMarginMeters: 3, confirmationSeconds: .04,
  fenceSearchStepSeconds: .05, minimumExclusionIntervalSeconds: .001,
});

export type LiveDefensiveOpportunityInputV1 = Readonly<{
  availableAtTick: number; observationTick: number; ballRadiusMeters: number;
  home: Vec3; fenceCenter: Vec3; fenceRadiusMeters: number; fenceHeightMeters: number;
  prediction: Readonly<{ maximumSeconds: number; firstPredictedGroundSeconds: number;
    maximumPositionSpeedMps: number; sample: (seconds: number) => Readonly<{ position: Vec3; velocity: Vec3 }> }>;
  fielders: readonly Readonly<{ position: Vec3; velocity: Vec3; topSpeedMps: number;
    accelerationMps2: number; gloveReachMeters: number; gloveRadiusMeters: number; bodyRadiusMeters?: number }>[];
}>;

const flatDistance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

/** A conservative no-opportunity test on an observation-rooted hypothesis.
 * Every possible body direction is admitted, with no reaction delay or glove
 * travel cost. A positive/uncertain reachable interval rejects the cue. This
 * intentionally leaves unusual superhuman reach/speed and borderline flies
 * to the ordinary generic AI; neither player identity nor league is read.
 * No actual Source, outcome, future frame or scoring fact is accepted here. */
export function predictLiveDefensiveOpportunityV1(input: LiveDefensiveOpportunityInputV1): LiveDefensiveOpportunityV1 | null {
  const policy = LIVE_DEFENSIVE_OPPORTUNITY_POLICY_V1, prediction = input.prediction,
    ground = prediction.firstPredictedGroundSeconds;
  if (input.fielders.length !== 9 || !Number.isFinite(ground) || ground <= 0 || ground > prediction.maximumSeconds
    || !Number.isFinite(prediction.maximumPositionSpeedMps) || prediction.maximumPositionSpeedMps <= 0) return null;
  const radius = input.fenceRadiusMeters - input.ballRadiusMeters,
    fairMargin = (p: Vec3) => p.z - input.home.z - Math.abs(p.x - input.home.x),
    landing = prediction.sample(ground).position,
    carryBeyondFenceMeters = flatDistance(landing, input.fenceCenter) - radius;
  if (carryBeyondFenceMeters < policy.minimumCarryBeyondFenceMeters || fairMargin(landing) < policy.minimumFairLineMarginMeters
    || flatDistance(prediction.sample(0).position, input.fenceCenter) >= radius) return null;
  // Bracket an outward crossing in this same hypothesis before first ground.
  let lo = 0, hi = 0;
  for (let h = Math.min(policy.fenceSearchStepSeconds, ground); ; h = Math.min(ground, h + policy.fenceSearchStepSeconds)) {
    if (flatDistance(prediction.sample(h).position, input.fenceCenter) >= radius) { hi = h; break; }
    if (h === ground) return null;
    lo = h;
  }
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (flatDistance(prediction.sample(mid).position, input.fenceCenter) >= radius) hi = mid; else lo = mid;
  }
  const crossing = prediction.sample(hi), fenceClearanceMeters = crossing.position.y - input.ballRadiusMeters - input.fenceHeightMeters;
  if (fenceClearanceMeters < policy.minimumFenceClearanceMeters || fairMargin(crossing.position) < policy.minimumFairLineMarginMeters
    || (crossing.position.x - input.fenceCenter.x) * crossing.velocity.x
      + (crossing.position.z - input.fenceCenter.z) * crossing.velocity.z <= 0) return null;

  const reachableDistance = (f: LiveDefensiveOpportunityInputV1['fielders'][number], seconds: number) => {
    // Direction changes are free in this generous upper envelope. Actual
    // existing velocity is retained; no low-IQ estimate can hide a real catch.
    const speed = Math.max(Math.hypot(f.velocity.x, f.velocity.z), 0),
      cap = Math.max(speed, f.topSpeedMps), accelerate = Math.min(seconds, Math.max(0, (cap - speed) / f.accelerationMps2));
    return speed * accelerate + .5 * f.accelerationMps2 * accelerate ** 2 + cap * (seconds - accelerate);
  };
  const excluded = (f: LiveDefensiveOpportunityInputV1['fielders'][number], from: number, through: number): boolean => {
    const mid = (from + through) / 2, p = prediction.sample(mid).position,
      ballMovementBound = prediction.maximumPositionSpeedMps * (through - from) / 2,
      reach = Math.max(f.gloveReachMeters + f.gloveRadiusMeters, f.bodyRadiusMeters ?? 0) + input.ballRadiusMeters,
      rounding = 512 * Number.EPSILON * Math.max(1, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z), input.fenceRadiusMeters);
    // Body y is linear in this controller. These vertical and horizontal
    // upper envelopes cover every instant in the interval using the kernel's
    // speed bound, rather than sampling past a narrow line-drive catch window.
    if (p.y - ballMovementBound > f.position.y + Math.max(0, f.velocity.y) * through + reach + rounding
      || flatDistance(p, f.position) - ballMovementBound > reachableDistance(f, through) + reach + rounding) return true;
    if (through - from <= policy.minimumExclusionIntervalSeconds) return false;
    return excluded(f, from, mid) && excluded(f, mid, through);
  };
  if (!input.fielders.every(f => excluded(f, 0, hi))) return null;
  return Object.freeze({ kind: 'none-decisive-over-fence', availableAtTick: input.availableAtTick,
    observationTick: input.observationTick, predictedCarryMeters: flatDistance(landing, input.home), carryBeyondFenceMeters,
    fenceClearanceMeters, predictedFenceSeconds: hi, captureFeasibility: 'CONSERVATIVE_REACH_ENVELOPE_EXCLUDED',
    forecastBasis: 'EXPLICIT_SENSOR_PREDICTION_MODEL' });
}
