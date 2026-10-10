import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaHash, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaAcceptedOfficialSourceReference } from './SamePlateAppearanceCatchCommunicationSource';
import type { AcceptedSamePaInitialBallSetup } from './SamePlateAppearanceInitialBallSource';
export const samePaRestartPlayTable = 'pa_restart_play_v1_actions' as const;
export type SamePaRestartPlayReference = SamePaReference<typeof samePaRestartPlayTable>;
/** An explicit prospective declaration at the owned rule-system reset. Custody
 * is accepted original physical setup, never inferred from a foul or contact. */
export type AcceptedSamePaRestartPlay = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_foul_restart_play_v1';
  enrollmentReference: SamePaReference<'same_pa_enrollments'>; viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  resetReference: SamePaReference<'pa_lifecycle_v1_resets'>; actionReference: SamePaReference<'pa_physical_v1_action_plans'>;
  postureReference: SamePaReference<'batting_observation_v1_postures'>; physicalPitchSourceId: string;
  venueReference: SamePaAcceptedOfficialSourceReference; pitcherPlayerId: string;
  custody: Omit<AcceptedSamePaInitialBallSetup['custody'],'kind'> & Readonly<{kind:'explicit_reset_secure_custody_v1'}>;
  assignmentReference: SamePaAcceptedOfficialSourceReference; officialId: string; personId: string; declaration: 'play' }>;
export type SamePaRestartPlayAuthority = Readonly<{ readAcceptedPlay(id: string): unknown; readAcceptedVenue(id: string): unknown;
  readAcceptedAssignment(id: string): unknown; readAcceptedOfficialPerson(id: string): unknown }>;
const originalRef = (v: unknown) => fields(v,['sourceId','sourceVersion','sourceHash']) && text(v.sourceId) && text(v.sourceVersion) && samePaHash(v.sourceHash);
const vector = (v: unknown) => fields(v,['x','y','z']) && Object.values(v).every(n=>typeof n==='number' && Number.isFinite(n));
export const samePaRestartPlayInput = (raw: unknown, id?: string): AcceptedSamePaRestartPlay => {
  const s=cloneInert(raw) as AcceptedSamePaRestartPlay,c=s?.custody;
  if(!fields(s,['sourceId','sourceVersion','capability','enrollmentReference','viewReference','resetReference','actionReference','postureReference',
    'physicalPitchSourceId','venueReference','pitcherPlayerId','custody','assignmentReference','officialId','personId','declaration'])
    || s.capability!=='same_pa_foul_restart_play_v1' || ![s.sourceId,s.sourceVersion,s.physicalPitchSourceId,s.pitcherPlayerId,s.officialId,s.personId].every(text)
    || id!==undefined && s.sourceId!==id || !ref(s.enrollmentReference,'same_pa_enrollments') || !ref(s.viewReference,'pa_lifecycle_v1_execution_views')
    || !ref(s.resetReference,'pa_lifecycle_v1_resets') || !ref(s.actionReference,'pa_physical_v1_action_plans') || !ref(s.postureReference,'batting_observation_v1_postures')
    || !originalRef(s.venueReference) || !originalRef(s.assignmentReference) || s.declaration!=='play'
    || !fields(c,['kind','role','ball']) || c.kind!=='explicit_reset_secure_custody_v1' || !['glove','tag_hand'].includes(c.role)
    || !fields(c.ball,['tick','position','velocity','spin']) || !Number.isSafeInteger(c.ball.tick) || c.ball.tick<0
    || ![c.ball.position,c.ball.velocity,c.ball.spin].every(vector) || Object.values(c.ball.velocity).some(n=>n!==0) || Object.values(c.ball.spin).some(n=>n!==0))
    throw new Error('invalid original foul restart Play Source');
  return freeze(s);
};
