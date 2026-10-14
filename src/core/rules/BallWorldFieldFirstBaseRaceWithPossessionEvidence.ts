import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import { deriveBallWorldFieldFirstBaseRace, type BallWorldFieldFirstBaseRace, type BallWorldFieldFirstBaseRaceInput } from './BallWorldFieldFirstBaseRace';

export type PendingFieldPossession = Readonly<{
  planSourceId: string;
  playerId: string;
  contactElapsedSeconds: number;
  phase: 'capturing' | 'fence_pending' | 'contact_policy_pending';
  /** An uncertainty lower bound, never an adopted control moment or contact. */
  earliestPotentialControlElapsedSeconds: number;
}>;
export type BattedWorldPossessionEvidence = Readonly<{
  policy: 'scheduled_capture_confirmation_v1';
  originTick: number;
  ticksPerSecond: number;
  throughElapsedSeconds: number;
  pending: readonly PendingFieldPossession[];
}>;
export type BaseTouchCustodyEvidence = Readonly<{
  status: 'confirmed_contacts_only' | 'bounded_unconfirmed';
  originTick: number;
  ticksPerSecond: number;
  throughElapsedSeconds: number;
  pending: readonly PendingFieldPossession[];
}>;
export type BallWorldFieldFirstBaseRaceWithPossessionEvidenceInput = BallWorldFieldFirstBaseRaceInput & Readonly<{
  possessionEvidence: BattedWorldPossessionEvidence;
}>;
export type BallWorldFieldFirstBaseRaceWithPossessionEvidence = BallWorldFieldFirstBaseRace & Readonly<{
  possessionEvidence: BattedWorldPossessionEvidence;
  possessionGuard: Readonly<{ blocked: boolean; earliestPotentialControlElapsedSeconds: number | null }>;
}>;

const fields = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const id = (value: string) => typeof value === 'string' && value.length > 0 && value === value.trim();
const elapsed = (value: number) => Number.isFinite(value) && value >= 0;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/**
 * Qualify the unchanged actual race with bounded possession uncertainty.
 * Native must prove the referenced plans, progress and original retention deadlines:
 * this envelope validates scope and chronology, never grants Source authority.
 */
export const deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence = (
  raw: BallWorldFieldFirstBaseRaceWithPossessionEvidenceInput,
): BallWorldFieldFirstBaseRaceWithPossessionEvidence => {
  const input = cloneInert(raw);
  if (!fields(input, ['field', 'race', 'possessionEvidence', ...('playableWalls' in input ? ['playableWalls'] : [])])) throw new Error('invalid actual field possession wrapper scope');

  // Keep all legacy field/contact/Player/chronology validation even when the new
  // guard will withhold its result. Never pass the qualifier into strict race records.
  const original = deriveBallWorldFieldFirstBaseRace({ field: input.field, race: input.race,
    ...('playableWalls' in input ? { playableWalls: input.playableWalls } : {}) });
  const ball = input.field.evidence, evidence = input.possessionEvidence;
  if (!fields(evidence, ['policy', 'originTick', 'ticksPerSecond', 'throughElapsedSeconds', 'pending'])
    || evidence.policy !== 'scheduled_capture_confirmation_v1'
    || evidence.originTick !== ball.originTick || evidence.ticksPerSecond !== ball.ticksPerSecond
    || !elapsed(evidence.throughElapsedSeconds) || evidence.throughElapsedSeconds !== ball.horizon.elapsedSeconds
    || !Array.isArray(evidence.pending)) throw new Error('actual field possession envelope clock or horizon differs');

  const plans = new Set<string>(), players = new Set<string>();
  for (const pending of evidence.pending) {
    if (!fields(pending, ['planSourceId', 'playerId', 'contactElapsedSeconds', 'phase', 'earliestPotentialControlElapsedSeconds'])
      || !id(pending.planSourceId) || !id(pending.playerId) || !ball.defenderIds.includes(pending.playerId)
      || plans.has(pending.planSourceId) || players.has(pending.playerId)
      || !['capturing', 'fence_pending', 'contact_policy_pending'].includes(pending.phase)
      || !elapsed(pending.contactElapsedSeconds) || pending.contactElapsedSeconds > evidence.throughElapsedSeconds
      || !elapsed(pending.earliestPotentialControlElapsedSeconds)
      || pending.earliestPotentialControlElapsedSeconds < pending.contactElapsedSeconds) {
      throw new Error('actual field pending possession scope or chronology differs');
    }
    // Admission itself does not execute capture. At zero load its future-work
    // cutoff can equal the current horizon before the first physical advance.
    if (pending.phase === 'capturing' ? pending.earliestPotentialControlElapsedSeconds < evidence.throughElapsedSeconds
      : pending.earliestPotentialControlElapsedSeconds > evidence.throughElapsedSeconds) {
      throw new Error('actual field pending possession phase differs from its horizon');
    }
    const contact = ball.contacts.find((frame) => frame.moment.elapsedSeconds === pending.contactElapsedSeconds);
    if (!contact?.contacts.some((value) => value.kind === 'actor' && value.playerId === pending.playerId && value.role === 'glove')) {
      throw new Error('actual field pending possession glove contact is missing');
    }
    plans.add(pending.planSourceId); players.add(pending.playerId);
  }
  const earliestPotentialControlElapsedSeconds = evidence.pending.length
    ? Math.min(...evidence.pending.map((pending) => pending.earliestPotentialControlElapsedSeconds)) : null;
  const decisionSeconds = original.groundRule ? Math.max(
    original.groundRule.actualChronology.decisionMoment?.elapsedSeconds ?? evidence.throughElapsedSeconds,
    original.firstGroundMoment!.elapsedSeconds, original.ballDecisionMoment!.elapsedSeconds,
  ) : null;
  const blocked = decisionSeconds !== null && earliestPotentialControlElapsedSeconds !== null
    && decisionSeconds >= earliestPotentialControlElapsedSeconds;
  return freeze({ ...original, groundRule: blocked ? null : original.groundRule,
    possessionEvidence: evidence, possessionGuard: { blocked, earliestPotentialControlElapsedSeconds } });
};
