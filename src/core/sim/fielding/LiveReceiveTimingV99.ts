/** Authored relationship controls affect commitment, never custody or outs.
 * Timing reserves are provisional controller policy, not measured MLB rates. */
export type FieldRelationshipV99 = Readonly<{ toPlayerId: string; trust: number; coordination: number }>;
export function validateFieldRelationshipsV99(raw: unknown): asserts raw is readonly FieldRelationshipV99[] {
  if (!Array.isArray(raw) || raw.length > 100 || raw.some(r => !r || typeof r !== 'object'
    || Object.keys(r).sort().join(',') !== 'coordination,toPlayerId,trust'
    || typeof r.toPlayerId !== 'string' || !r.toPlayerId.trim() || r.toPlayerId !== r.toPlayerId.trim() || r.toPlayerId.length > 160
    || ![r.trust, r.coordination].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100))
    || new Set(raw.map(r => r.toPlayerId)).size !== raw.length) throw Error('守備の信頼・連携は相手ごとに重複なく0〜100で設定してください');
}
export function decideLiveReceiveTimingV99(input: Readonly<{ seed: number; opportunityId: string; flightSeconds: number;
  receiverReadySeconds: number; receiverDistanceMeters: number; immediateReachMeters: number;
  trust: number; coordination: number; aggression: number }>) {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff || !input.opportunityId
    || ![input.flightSeconds, input.receiverReadySeconds, input.receiverDistanceMeters, input.immediateReachMeters].every(n => Number.isFinite(n) && n >= 0)
    || ![input.trust, input.coordination].every(n => Number.isFinite(n) && n >= 0 && n <= 100)
    || !Number.isFinite(input.aggression) || input.aggression < .25 || input.aggression > 4) throw Error('invalid receive timing observation');
  // Hash only the logical decision opportunity: repeated control frames do not
  // reroll willingness and the game's physical RNG stream is not consumed.
  let hash = (2166136261 ^ input.seed) >>> 0;
  for (let i = 0; i < input.opportunityId.length; i++) hash = Math.imul(hash ^ input.opportunityId.charCodeAt(i), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0;
  const draw = hash / 4294967296, marginSeconds = input.flightSeconds - input.receiverReadySeconds,
    uncertaintySeconds = .025 + .075 * (1 - input.coordination / 100),
    reserveSeconds = (.025 + .095 * (1 - input.trust / 100)) / Math.sqrt(input.aggression),
    routine = input.receiverDistanceMeters <= input.immediateReachMeters,
    probability = marginSeconds < 0 ? 0 : routine || marginSeconds >= reserveSeconds + uncertaintySeconds ? 1
      // Trust already changes the required reserve. A second amplitude
      // penalty made confidence jump to one at that reserve's boundary.
      : Math.min(1, marginSeconds / (reserveSeconds + uncertaintySeconds)),
    allow = probability === 1 || probability > 0 && draw < probability;
  return Object.freeze({ allow, probability, draw, marginSeconds, reserveSeconds, uncertaintySeconds,
    reason: marginSeconds < 0 ? 'receiver_cannot_arrive_before_ball' : allow ? 'anticipated_receiver_ready' : 'wait_for_receiver_confidence',
    basis: 'AUTHORED_TIMING_RESERVE_NOT_EMPIRICAL_SUCCESS_PROBABILITY' as const });
}
