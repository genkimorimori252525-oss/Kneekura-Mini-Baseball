import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { actualLiveAdjudicationInput } from './ActualLiveAdjudicationSource';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedFoulOfficialSession, AcceptedFoulOfficialEvent, AcceptedFoulOfficialIntent,
  FoulOfficialProjection } from './ActualFoulOfficial';

export const foulOfficialRevision = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
export const foulOfficialDigest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const deriveFoulOfficialOpeningClock = (input: Readonly<{ originTick: number; throughTick: number; ticksPerSecond: number }>): FoulOfficialProjection['cursor'] => {
  const boundary = deriveQuantizerClosedGenerationBoundary(input);
  if (boundary.firstExcludedTick === null) throw new Error('foul official opening exceeds the safe clock range');
  return freeze({ originTick: boundary.originTick, ticksPerSecond: boundary.ticksPerSecond,
    openingTick: boundary.firstExcludedTick, openingElapsedSeconds: boundary.firstExcludedElapsedSeconds,
    tick: boundary.firstExcludedTick, offsetTicks: 0 });
};
export const foulOfficialSessionInput = (raw: unknown, sourceId: string): AcceptedFoulOfficialSession => {
  const s = cloneInert(raw) as AcceptedFoulOfficialSession;
  if (!fields(s, ['sourceId','sourceVersion','capability','physicalEndReference','assignment','officialPolicy'])
    || s.sourceId !== sourceId || s.capability !== 'actual_post_play_foul_official_session_v1'
    || ![s.sourceId,s.sourceVersion].every(id)) throw new Error('invalid foul official session Source');
  const r = s.physicalEndReference, a = s.assignment;
  if (!fields(r, ['owner','sourceId','sourceVersion','sourceHash','snapshotHash']) || r.owner !== 'actual_foul_play_ends'
    || ![r.sourceId,r.sourceVersion].every(id) || ![r.sourceHash,r.snapshotHash].every(foulOfficialDigest)) {
    throw new Error('invalid foul official physical end reference');
  }
  if (!fields(a, ['sourceId','sourceVersion','gameId','playId','physicalPitchSourceId','officialIds','schedulerId','clock','openingTrigger'])
    || ![a.sourceId,a.sourceVersion,a.gameId,a.physicalPitchSourceId,a.schedulerId].every(id) || !foulOfficialRevision(a.playId)
    || !Array.isArray(a.officialIds) || !a.officialIds.length || !a.officialIds.every(id)
    || new Set(a.officialIds).size !== a.officialIds.length || a.clock !== 'post_play_discrete_tick_v1'
    || a.openingTrigger !== 'sealed_foul_physical_end') throw new Error('invalid foul official assignment Source');
  actualLiveAdjudicationInput({ sourceId:s.sourceId, sourceVersion:s.sourceVersion, physicalEndSourceId:r.sourceId, policy:s.officialPolicy }, sourceId);
  return freeze(s);
};
export const foulOfficialEventInput = (raw: unknown, sourceId: string): AcceptedFoulOfficialEvent => {
  const s = cloneInert(raw) as AcceptedFoulOfficialEvent;
  if (!fields(s, ['sourceId','sourceVersion','capability','sessionSourceId','expectedRevision','parent','action'])
    || s.sourceId !== sourceId || s.capability !== 'actual_post_play_foul_official_event_v1'
    || ![s.sourceId,s.sourceVersion,s.sessionSourceId].every(id) || !foulOfficialRevision(s.expectedRevision)
    || !fields(s.parent, ['sourceId','snapshotHash']) || !id(s.parent.sourceId) || !foulOfficialDigest(s.parent.snapshotHash)) {
    throw new Error('invalid foul official event Source or parent revision');
  }
  const a = s.action;
  if (a?.kind === 'record_call') {
    if (!fields(a, ['kind','intentSourceId']) || !id(a.intentSourceId)) throw new Error('invalid foul official call Source');
  } else if (a?.kind === 'advance_tick' || a?.kind === 'next_pitch_fence') {
    if (!fields(a, ['kind','schedulerId']) || !id(a.schedulerId)) throw new Error('invalid foul official scheduler Source');
  } else throw new Error('invalid foul official event action');
  return freeze(s);
};
export const foulOfficialIntentInput = (raw: unknown, sourceId: string): AcceptedFoulOfficialIntent => {
  const s = cloneInert(raw) as AcceptedFoulOfficialIntent;
  if (!fields(s, ['sourceId','sourceVersion','capability','sessionSourceId','gameId','playId','physicalPitchSourceId','assignmentSourceId','officialId','judgment'])
    || s.sourceId !== sourceId || s.capability !== 'actual_post_play_foul_official_intent_v1'
    || ![s.sourceId,s.sourceVersion,s.sessionSourceId,s.gameId,s.physicalPitchSourceId,s.assignmentSourceId,s.officialId].every(id)
    || !foulOfficialRevision(s.playId) || !['foul','fair'].includes(s.judgment)) throw new Error('invalid foul official intent Source');
  return freeze(s);
};
