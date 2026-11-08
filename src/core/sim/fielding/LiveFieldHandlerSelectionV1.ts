export type LiveFieldHandlerCandidateV1 = Readonly<{
  playerId: string; intercepted: boolean; interceptSeconds: number;
  /** Current acceleration/velocity/reaction-limited arrival at the forecast point. */
  arrivalSeconds: number; travelDistanceMeters: number;
  /** Provisional route/approach burden from observed incoming direction. */
  approachPenaltySeconds?: number;
  /** Authored tactical preference only; never changes reach or ball physics. */
  pursuitCostWeight?: number;
}>;

export const LIVE_FIELD_HANDLER_POLICY_V1 = Object.freeze({
  interceptionWindowSeconds: 0, switchBurdenSeconds: .25,
  minimumPursuitCostWeight: .25, maximumPursuitCostWeight: 4,
});

/** ETA to the ball is not the cost of reaching it. Two actors may share the
 * same descending-flight interception time despite very different routes.
 * Compare arrival burden only inside an explicit catch-time window (exact by
 * default), and never let a pursuit preference create a feasible catch. */
export function selectLiveFieldHandlerV1(input: Readonly<{
  candidates: readonly LiveFieldHandlerCandidateV1[]; previousPlayerId?: string | null;
  interceptionWindowSeconds?: number;
}>) {
  const window = input.interceptionWindowSeconds ?? LIVE_FIELD_HANDLER_POLICY_V1.interceptionWindowSeconds;
  if (!Number.isFinite(window) || window < 0 || window > .1
    || new Set(input.candidates.map(c => c.playerId)).size !== input.candidates.length
    || input.candidates.some(c => !c.playerId || typeof c.intercepted !== 'boolean'
      || ![c.interceptSeconds, c.arrivalSeconds, c.travelDistanceMeters].every(n => Number.isFinite(n) && n >= 0)
      || !Number.isFinite(c.approachPenaltySeconds ?? 0) || (c.approachPenaltySeconds ?? 0) < 0
      || !Number.isFinite(c.pursuitCostWeight ?? 1) || (c.pursuitCostWeight ?? 1) < .25 || (c.pursuitCostWeight ?? 1) > 4))
    throw new Error('invalid live field handler candidates/policy');
  const feasible = input.candidates.filter(c => c.intercepted), pool = feasible.length ? feasible : input.candidates;
  if (!pool.length) return Object.freeze({ playerId: null, intercepted: false, retained: false,
    earliestInterceptSeconds: null, arrivalBurdenSeconds: null, eligiblePlayerIds: Object.freeze([] as string[]) });
  const earliest = Math.min(...pool.map(c => c.interceptSeconds)), eligible = pool.filter(c => c.interceptSeconds <= earliest + window),
    burden = (c: LiveFieldHandlerCandidateV1) => (c.arrivalSeconds + (c.approachPenaltySeconds ?? 0)) * (c.pursuitCostWeight ?? 1),
    ranked = [...eligible].sort((a, b) => burden(a) - burden(b)
      || a.travelDistanceMeters * (a.pursuitCostWeight ?? 1) - b.travelDistanceMeters * (b.pursuitCostWeight ?? 1)),
    best = ranked[0], incumbent = eligible.find(c => c.playerId === input.previousPlayerId),
    chosen = incumbent && burden(incumbent) <= burden(best) + LIVE_FIELD_HANDLER_POLICY_V1.switchBurdenSeconds ? incumbent : best;
  return Object.freeze({ playerId: chosen.playerId, intercepted: chosen.intercepted,
    retained: chosen === incumbent, earliestInterceptSeconds: earliest, arrivalBurdenSeconds: burden(chosen),
    eligiblePlayerIds: Object.freeze(eligible.map(c => c.playerId)) });
}
