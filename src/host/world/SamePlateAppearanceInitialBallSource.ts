import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { BaseTouchRegion } from '../../core/sim/running/BaseTouch';
import { ballWorldVenueLegalPolicyInput, type BallWorldVenueLegalPolicy } from '../../core/rules/BallWorldVenueLegalCoverage';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaAcceptedOfficialSourceReference } from './SamePlateAppearanceCatchCommunicationSource';
export const initialBallTables = { setup: 'pa_initial_ball_v1_setups', play: 'pa_initial_ball_v1_plays' } as const;
export type SamePaInitialPlayReference = SamePaReference<typeof initialBallTables.play>;
export type AcceptedSamePaInitialVenue = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_initial_ball_venue_v1';
  careerId: string; gameId: string; playId: number; fixtureEventId: string; venueId: string; availableAtDay: number;
  pitcherPlate: Readonly<{ region: BaseTouchRegion; surfaceHeightMeters: number }>; rulePolicy: BallWorldVenueLegalPolicy }>;
/** This is explicit initial physical state, accepted before any pitch. Secure
 * custody is supplied by that initial-state authority, never inferred from contact. */
export type AcceptedSamePaInitialBallSetup = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_initial_ball_setup_v1';
  enrollmentReference: SamePaReference<'same_pa_enrollments'>; viewReference: SamePaReference<'reserved_pa_execution_views'>;
  actionReference: SamePaReference<'pa_dispatch_v1_action_plans'>; postureReference: SamePaReference<'batting_observation_v1_postures'>;
  venueReference: SamePaAcceptedOfficialSourceReference; firstPhysicalPitchSourceId: string; pitcherPlayerId: string;
  custody: Readonly<{ kind: 'explicit_initial_secure_custody_v1'; role: 'glove' | 'tag_hand'; ball: Readonly<{ tick: number; position: Vec3; velocity: Vec3; spin: Vec3 }> }> }>;
/** Play is a separate original plate-umpire action at the owned initial cut. */
export type AcceptedSamePaInitialPlay = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_initial_play_v1';
  setupReference: SamePaReference<typeof initialBallTables.setup>; assignmentReference: SamePaAcceptedOfficialSourceReference;
  officialId: string; personId: string; declaration: 'play' }>;
export type SamePaInitialBallAuthority = Readonly<{ readAcceptedSetup?(id: string): unknown; readAcceptedVenue?(id: string): unknown;
  readAcceptedPlay?(id: string): unknown; readAcceptedAssignment?(id: string): unknown; readAcceptedOfficialPerson?(id: string): unknown }>;
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const vector = (v: unknown) => fields(v, ['x', 'y', 'z']) && Object.values(v).every(n => typeof n === 'number' && Number.isFinite(n));
const originalRef = (v: unknown) => fields(v, ['sourceId', 'sourceVersion', 'sourceHash']) && text(v.sourceId) && text(v.sourceVersion) && samePaHash(v.sourceHash);
export const samePaInitialVenueInput = (raw: unknown): AcceptedSamePaInitialVenue => {
  const s = cloneInert(raw) as AcceptedSamePaInitialVenue, p = s?.pitcherPlate, r = p?.region;
  if (!fields(s, ['sourceId','sourceVersion','capability','careerId','gameId','playId','fixtureEventId','venueId','availableAtDay','pitcherPlate','rulePolicy'])
    || s.capability !== 'same_pa_initial_ball_venue_v1' || ![s.sourceId,s.sourceVersion,s.careerId,s.gameId,s.fixtureEventId,s.venueId].every(text)
    || !tick(s.playId) || !tick(s.availableAtDay) || !fields(p,['region','surfaceHeightMeters']) || !fields(r,['center','halfSize','rotationRadians'])
    || !fields(r?.center,['x','z']) || !fields(r?.halfSize,['x','z'])
    || ![p.surfaceHeightMeters,r.rotationRadians,...Object.values(r.center),...Object.values(r.halfSize)].every(Number.isFinite)
    || r.halfSize.x <= 0 || r.halfSize.z <= 0) throw new Error('invalid initial ball venue Source');
  ballWorldVenueLegalPolicyInput(s.rulePolicy); return freeze(s);
};
export const samePaInitialSetupInput = (raw: unknown, id?: string): AcceptedSamePaInitialBallSetup => {
  const s = cloneInert(raw) as AcceptedSamePaInitialBallSetup, c = s?.custody;
  if (!fields(s,['sourceId','sourceVersion','capability','enrollmentReference','viewReference','actionReference','postureReference','venueReference','firstPhysicalPitchSourceId','pitcherPlayerId','custody'])
    || s.capability !== 'same_pa_initial_ball_setup_v1' || ![s.sourceId,s.sourceVersion,s.firstPhysicalPitchSourceId,s.pitcherPlayerId].every(text)
    || id !== undefined && s.sourceId !== id || !ref(s.enrollmentReference,'same_pa_enrollments') || !ref(s.viewReference,'reserved_pa_execution_views')
    || !ref(s.actionReference,'pa_dispatch_v1_action_plans') || !ref(s.postureReference,'batting_observation_v1_postures') || !originalRef(s.venueReference)
    || !fields(c,['kind','role','ball']) || c.kind !== 'explicit_initial_secure_custody_v1' || !['glove','tag_hand'].includes(c.role)
    || !fields(c.ball,['tick','position','velocity','spin']) || !tick(c.ball.tick) || ![c.ball.position,c.ball.velocity,c.ball.spin].every(vector)
    || Object.values(c.ball.velocity).some(n => n !== 0) || Object.values(c.ball.spin).some(n => n !== 0)) throw new Error('invalid initial physical ball setup Source');
  return freeze(s);
};
export const samePaInitialPlayInput = (raw: unknown, id?: string): AcceptedSamePaInitialPlay => {
  const s = cloneInert(raw) as AcceptedSamePaInitialPlay;
  if (!fields(s,['sourceId','sourceVersion','capability','setupReference','assignmentReference','officialId','personId','declaration'])
    || s.capability !== 'same_pa_initial_play_v1' || ![s.sourceId,s.sourceVersion,s.officialId,s.personId].every(text)
    || id !== undefined && s.sourceId !== id || !ref(s.setupReference,initialBallTables.setup) || !originalRef(s.assignmentReference)
    || s.declaration !== 'play') throw new Error('invalid original initial Play Source');
  return freeze(s);
};
