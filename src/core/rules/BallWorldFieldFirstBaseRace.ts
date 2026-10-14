import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import { battedWorldBaseSurfaceId } from '../sim/ball/BattedWorldFieldMotion';
import type { BallWorldBattedRuleEvidence } from './BallWorldBattedRuleEvidence';
import { deriveBallWorldBattedRuleChronology } from './BallWorldBattedRuleChronology';
import { deriveBallWorldFieldTerritory, type BallWorldFieldTerritory, type BallWorldFieldTerritoryInput } from './BallWorldFieldTerritory';
import { resolveBallWorldFirstBaseRace, type BallWorldFirstBaseRaceInput } from './BallWorldFirstBaseRace';
import { deriveGroundedPlayableWallEvidence, type GroundedPlayableWallInput, type GroundedPlayableWallEvidence } from './BallWorldGroundedPlayableWall';

export type BallWorldFieldPendingContact = Readonly<{ elapsedSeconds: number; tick: number;
  reason: 'simultaneous_contact' | 'surface_policy_pending' | 'non_defender_contact' | 'physical_contact_pending' | 'base_policy_pending' }>;
export type BallWorldFieldBattedRuleEvidence = Extract<BallWorldBattedRuleEvidence, { kind: 'fly_catch' }>
  | (Omit<Extract<BallWorldBattedRuleEvidence, { kind: 'grounded' }>, 'pendingContacts'>
    & Readonly<{ pendingContacts: readonly BallWorldFieldPendingContact[] }>)
  | Readonly<{ kind: 'unresolved'; reason: BallWorldFieldPendingContact['reason'] | 'fair_foul_pending' | 'catch_pending' | 'ground_contact_pending' }>;
export type BallWorldFieldFirstBaseRaceInput = Readonly<{ field: BallWorldFieldTerritoryInput; race: BallWorldFirstBaseRaceInput;
  playableWalls?: GroundedPlayableWallInput }>;
export type BallWorldFieldFirstBaseRace = Readonly<{
  fieldTerritory: BallWorldFieldTerritory; ballEvidence: BallWorldFieldBattedRuleEvidence;
  ballDecisionMoment: BallWorldMoment | null; firstGroundMoment: BallWorldMoment | null;
  pendingContacts: readonly BallWorldFieldPendingContact[]; groundRule: ReturnType<typeof resolveBallWorldFirstBaseRace> | null;
  playableWallEvidence?: GroundedPlayableWallEvidence;
}>;
const fields = (value: unknown, names: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...names].sort().join('|');
const baseIds = ['home', 'first', 'second', 'third'] as const;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Interpret the same owned field/Player prefix. A bag can establish territory, never ground, possession or play closure. */
export const deriveBallWorldFieldFirstBaseRace = (raw: BallWorldFieldFirstBaseRaceInput): BallWorldFieldFirstBaseRace => {
  const input = cloneInert(raw), field = input?.field, ball = field?.evidence, race = input?.race;
  if (!fields(input, ['field', 'race', ...('playableWalls' in input ? ['playableWalls'] : [])]) || !ball || !race || !Array.isArray(ball.defenderIds) || !Array.isArray(race.defenderIds)
    || ball.originTick !== race.originTick || ball.ticksPerSecond !== race.ticksPerSecond
    || ball.horizon?.elapsedSeconds !== race.horizonElapsedSeconds || ball.batterRunnerId !== race.batterRunnerId
    || JSON.stringify([...ball.defenderIds].sort()) !== JSON.stringify([...race.defenderIds].sort())) {
    throw new Error('actual field first-base original scope differs');
  }
  // This validates every original frame and both directions of base provenance,
  // including metadata for contacts later than an already decisive rule moment.
  const fieldTerritory = deriveBallWorldFieldTerritory(field);
  const physicalMoments = [ball.horizon, ...ball.contacts.map((frame) => frame.moment), ...field.baseContacts.map((contact) => contact.moment),
    ...ball.acquisitions.flatMap((acquisition) => [acquisition.contactMoment, acquisition.kind === 'secured' ? acquisition.moment : acquisition.world.moment])];
  if (physicalMoments.some((moment) => !fields(moment, ['originTick', 'elapsedSeconds', 'ball'])
    || !fields(moment.ball, ['tick', 'position', 'velocity', 'spin'])
    || (['position', 'velocity', 'spin'] as const).some((key) => !fields(moment.ball[key], ['x', 'y', 'z'])))) {
    throw new Error('actual field first-base physical moment metadata differs');
  }
  const chronology = deriveBallWorldBattedRuleChronology(ball), actualRace = resolveBallWorldFirstBaseRace(race);
  const playableWallEvidence = input.playableWalls === undefined ? undefined
    : deriveGroundedPlayableWallEvidence(input.playableWalls, field, fieldTerritory, chronology.firstGroundMoment);
  if ('playableWalls' in input && playableWallEvidence === undefined) throw new Error('grounded playable-wall evidence is missing');
  const optionalWallEvidence = playableWallEvidence === undefined ? {} : { playableWallEvidence };
  const pendingContacts: BallWorldFieldPendingContact[] = ball.contacts.flatMap((frame, contactIndex) => {
    const contact = frame.contacts[0], baseId = contact.kind === 'surface'
      ? baseIds.find((base) => battedWorldBaseSurfaceId(base) === contact.surfaceId) : undefined;
    const base = baseId ? field.baseContacts.find((value) => value.baseId === baseId && value.moment.elapsedSeconds === frame.moment.elapsedSeconds)! : null;
    const secureTie = ball.acquisitions.some((acquisition) => acquisition.kind === 'secured'
      && acquisition.moment.elapsedSeconds === frame.moment.elapsedSeconds
      && acquisition.contactMoment.elapsedSeconds !== frame.moment.elapsedSeconds);
    const reason = frame.contacts.length !== 1 || secureTie ? 'simultaneous_contact' as const
      : base?.normal === null || base?.continuing ? 'physical_contact_pending' as const
        : baseId === 'second' ? 'base_policy_pending' as const
          : contact.kind === 'surface' && !baseId && !playableWallEvidence?.contacts.some(c => c.contactIndex === contactIndex) ? 'surface_policy_pending' as const
            : contact.kind === 'actor' && !ball.defenderIds.includes(contact.playerId) ? 'non_defender_contact' as const : null;
    return reason ? [{ elapsedSeconds: frame.moment.elapsedSeconds, tick: frame.moment.ball.tick, reason }] : [];
  });
  const firstGroundMoment = chronology.firstGroundMoment;
  // Catch eligibility deliberately consumes the unfiltered physical history.
  // Removing a known bag here would manufacture an untouched airborne catch.
  if (chronology.ballEvidence.kind === 'fly_catch'
    && !pendingContacts.some((contact) => contact.elapsedSeconds <= chronology.ballDecisionMoment!.elapsedSeconds)) {
    return freeze({ fieldTerritory, ...chronology, pendingContacts, groundRule: null, ...optionalWallEvidence });
  }
  const touched = ball.contacts.find((frame) => frame.contacts.some((contact) => contact.kind === 'actor' && ball.defenderIds.includes(contact.playerId)));
  const fielder = touched?.contacts[0];
  const firstFielderTouch = touched?.contacts.length === 1 && fielder?.kind === 'actor'
    ? { fielderId: fielder.playerId, tick: touched.moment.ball.tick, ballCenter: touched.moment.ball.position } : null;
  let ballEvidence: BallWorldFieldBattedRuleEvidence;
  let ballDecisionMoment: BallWorldMoment | null = null;
  let groundRule: ReturnType<typeof resolveBallWorldFirstBaseRace> | null = null;
  if (firstGroundMoment && fieldTerritory.kind === 'resolved') {
    ballDecisionMoment = fieldTerritory.moment;
    ballEvidence = { kind: 'grounded', territory: fieldTerritory.territory, decisiveTick: fieldTerritory.moment.ball.tick,
      firstGroundContactTick: firstGroundMoment.ball.tick, firstFielderTouch, pendingContacts };
    const decisionSeconds = Math.max(fieldTerritory.moment.elapsedSeconds, firstGroundMoment.elapsedSeconds,
      actualRace.actualChronology.decisionMoment?.elapsedSeconds ?? ball.horizon.elapsedSeconds);
    if (fieldTerritory.territory === 'fair' && !pendingContacts.some((contact) => contact.elapsedSeconds <= decisionSeconds)) groundRule = actualRace;
  } else {
    ballEvidence = { kind: 'unresolved', reason: fieldTerritory.kind === 'unresolved' ? fieldTerritory.reason
      : pendingContacts[0]?.reason ?? (field.baseContacts.length ? 'ground_contact_pending' : firstFielderTouch ? 'catch_pending' : 'fair_foul_pending') };
  }
  return freeze({ fieldTerritory, ballEvidence, ballDecisionMoment, firstGroundMoment, pendingContacts, groundRule, ...optionalWallEvidence });
};
