import type { RosterState, RosterTransitionEvent } from '../roster/RosterTypes';
import type { DevelopmentCatalystProfile } from './DevelopmentCatalyst';
import { DEVELOPMENT_DOMAINS,
  type DevelopmentDomain } from './DevelopmentTrajectory';
import { deriveRosterDevelopmentCatalyst,
  type RosterDevelopmentCatalyst } from './RosterDevelopmentCatalyst';

export type DevelopmentLearningPolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  minimumPracticeEvents: number;
  minimumFeedbackEvents: number;
  minimumElapsedDays: number;
}>;
export type DevelopmentLearningStage = 'CATALYST' | 'ENGAGED'
  | 'HYPOTHESIS' | 'PRACTICING' | 'CONSOLIDATED' | 'ABANDONED';
export type DevelopmentLearningEventKind = 'CATALYST'
  | 'APPRAISAL_ENGAGED' | 'APPRAISAL_DISMISSED'
  | 'HYPOTHESIS_FORMED' | 'PRACTICE_RECORDED'
  | 'FEEDBACK_RECORDED' | 'CONSOLIDATION_RECORDED';
export type DevelopmentLearningEvent = Readonly<{
  eventId: string;
  sourceEventId: string;
  atDay: number;
  kind: DevelopmentLearningEventKind;
  domain?: DevelopmentDomain;
}>;
export type DevelopmentLearningEventInput = DevelopmentLearningEvent;
export type PracticeDevelopmentCatalyst = Readonly<{
  family: 'TECHNICAL_DISCOVERY'; careerId: string; playerId: string;
  occurredAtDay: number; sourceEventId: string; causeEventId: string; motifId: string;
}>;
export type NationalExposureDevelopmentCatalyst = Readonly<{
  family: 'ELITE_EXPOSURE'; careerId: string; playerId: string;
  occurredAtDay: number; sourceEventId: string; competitionEditionId: string; motifId: string;
}>;
export type DevelopmentLearningEpisode = Readonly<{
  episodeId: string;
  careerId: string;
  playerId: string;
  profileVersion: string;
  revision: number;
  startedAtDay: number;
  effectiveDay: number;
  catalyst: RosterDevelopmentCatalyst | PracticeDevelopmentCatalyst | NationalExposureDevelopmentCatalyst;
  policy: DevelopmentLearningPolicy;
  stage: DevelopmentLearningStage;
  domain: DevelopmentDomain | null;
  practiceSourceEventIds: readonly string[];
  feedbackSourceEventIds: readonly string[];
  events: readonly DevelopmentLearningEvent[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));

/** Starts only from a replayed roster event; it does not decide personal response. */
export const startDevelopmentLearningEpisode = (
  episodeId: string,
  before: RosterState,
  after: RosterState,
  rosterEvent: RosterTransitionEvent,
  playerId: string,
  profile: Pick<DevelopmentCatalystProfile,
    'careerId' | 'playerId' | 'createdAtDay' | 'profileVersion'>,
  policy: DevelopmentLearningPolicy,
): DevelopmentLearningEpisode => {
  const catalyst = deriveRosterDevelopmentCatalyst(before,
    after, rosterEvent, playerId);
  if (!catalyst) {
    throw new Error('development learning episode requires a roster catalyst');
  }
  return startEpisode(episodeId, catalyst, playerId, profile, policy);
};

/** Host admission must authenticate the actual completed practice before calling. */
export const startPracticeDevelopmentLearningEpisode = (
  episodeId: string,
  discovery: Omit<PracticeDevelopmentCatalyst, 'family'>,
  profile: Pick<DevelopmentCatalystProfile, 'careerId' | 'playerId' | 'createdAtDay' | 'profileVersion'>,
  policy: DevelopmentLearningPolicy,
): DevelopmentLearningEpisode => {
  if (!fields(discovery, ['careerId', 'playerId', 'occurredAtDay', 'sourceEventId', 'causeEventId', 'motifId'])
    || ![discovery.careerId, discovery.playerId, discovery.sourceEventId, discovery.causeEventId, discovery.motifId].every(id)
    || !day(discovery.occurredAtDay) || discovery.sourceEventId === discovery.causeEventId) {
    throw new Error('invalid accepted practice discovery catalyst');
  }
  return startEpisode(episodeId, Object.freeze({ family: 'TECHNICAL_DISCOVERY', ...discovery }), discovery.playerId, profile, policy);
};

/** Actual National participation supplies an opportunity, never an automatic response or ability change. */
export const startNationalExposureDevelopmentLearningEpisode = (
  episodeId: string,
  exposure: Omit<NationalExposureDevelopmentCatalyst, 'family'>,
  profile: Pick<DevelopmentCatalystProfile, 'careerId' | 'playerId' | 'createdAtDay' | 'profileVersion'>,
  policy: DevelopmentLearningPolicy,
): DevelopmentLearningEpisode => {
  if (!fields(exposure, ['careerId', 'playerId', 'occurredAtDay', 'sourceEventId', 'competitionEditionId', 'motifId'])
    || ![exposure.careerId, exposure.playerId, exposure.sourceEventId, exposure.competitionEditionId, exposure.motifId].every(id)
    || !day(exposure.occurredAtDay)) throw new Error('invalid accepted National exposure catalyst');
  return startEpisode(episodeId, Object.freeze({ family: 'ELITE_EXPOSURE', ...exposure }), exposure.playerId, profile, policy);
};

const startEpisode = (
  episodeId: string, catalyst: DevelopmentLearningEpisode['catalyst'], playerId: string,
  profile: Pick<DevelopmentCatalystProfile, 'careerId' | 'playerId' | 'createdAtDay' | 'profileVersion'>,
  policy: DevelopmentLearningPolicy,
): DevelopmentLearningEpisode => {
  if (!id(episodeId) || !fields(profile,
    ['careerId', 'playerId', 'createdAtDay', 'profileVersion'])
    || profile.careerId !== catalyst.careerId
    || profile.playerId !== playerId
    || !id(profile.profileVersion)
    || !day(profile.createdAtDay)
    || profile.createdAtDay > catalyst.occurredAtDay
    || !fields(policy, ['policyId', 'version', 'availableAtDay',
      'minimumPracticeEvents', 'minimumFeedbackEvents',
      'minimumElapsedDays'])
    || !id(policy.policyId) || !id(policy.version)
    || !day(policy.availableAtDay)
    || policy.availableAtDay > catalyst.occurredAtDay
    || !Number.isSafeInteger(policy.minimumPracticeEvents)
    || policy.minimumPracticeEvents <= 0
    || !Number.isSafeInteger(policy.minimumFeedbackEvents)
    || policy.minimumFeedbackEvents <= 0
    || !Number.isSafeInteger(policy.minimumElapsedDays)
    || policy.minimumElapsedDays <= 0) {
    throw new Error('invalid development learning profile or policy');
  }
  const pinnedPolicy = Object.freeze({ ...policy });
  const catalystEvent: DevelopmentLearningEvent = Object.freeze({
    eventId: `${episodeId}:catalyst`,
    sourceEventId: catalyst.sourceEventId,
    atDay: catalyst.occurredAtDay, kind: 'CATALYST',
  });
  return Object.freeze({ episodeId, careerId: catalyst.careerId,
    playerId, profileVersion: profile.profileVersion,
    revision: 0, startedAtDay: catalyst.occurredAtDay,
    effectiveDay: catalyst.occurredAtDay,
    catalyst, policy: pinnedPolicy, stage: 'CATALYST',
    domain: null, practiceSourceEventIds: Object.freeze([]),
    feedbackSourceEventIds: Object.freeze([]),
    events: Object.freeze([catalystEvent]),
  });
};

/** Evidence advances learning; only an external source owner can change ability. */
export const appendDevelopmentLearningEvent = (
  state: DevelopmentLearningEpisode,
  expectedRevision: number,
  input: DevelopmentLearningEventInput,
): DevelopmentLearningEpisode => {
  if (expectedRevision !== state.revision) {
    throw new Error('stale development episode revision');
  }
  if (!Array.isArray(state.events)
    || state.revision !== state.events.length - 1
    || state.events[0]?.kind !== 'CATALYST'
    || state.events[0]?.sourceEventId !== state.catalyst.sourceEventId
    || state.effectiveDay !== state.events.at(-1)?.atDay) {
    throw new Error('invalid development episode history');
  }
  const domainRequired = input?.kind === 'HYPOTHESIS_FORMED'
    || input?.kind === 'PRACTICE_RECORDED'
    || input?.kind === 'FEEDBACK_RECORDED'
    || input?.kind === 'CONSOLIDATION_RECORDED';
  if (!fields(input, domainRequired
    ? ['eventId', 'sourceEventId', 'atDay', 'kind', 'domain']
    : ['eventId', 'sourceEventId', 'atDay', 'kind'])
    || !id(input.eventId) || !id(input.sourceEventId)
    || !day(input.atDay) || input.atDay < state.effectiveDay
    || !['APPRAISAL_ENGAGED', 'APPRAISAL_DISMISSED',
      'HYPOTHESIS_FORMED', 'PRACTICE_RECORDED',
      'FEEDBACK_RECORDED', 'CONSOLIDATION_RECORDED'].includes(input.kind)
    || (domainRequired
      && !DEVELOPMENT_DOMAINS.includes(input.domain!))
    || state.events.some((event) => event.eventId === input.eventId
      || event.sourceEventId === input.sourceEventId)) {
    throw new Error('invalid or duplicate development learning evidence');
  }
  let stage: DevelopmentLearningStage = state.stage;
  let domain = state.domain;
  let practice = state.practiceSourceEventIds;
  let feedback = state.feedbackSourceEventIds;
  if (input.kind === 'APPRAISAL_ENGAGED'
    || input.kind === 'APPRAISAL_DISMISSED') {
    if (stage !== 'CATALYST') throw new Error('invalid development stage');
    stage = input.kind === 'APPRAISAL_ENGAGED'
      ? 'ENGAGED' : 'ABANDONED';
  } else if (input.kind === 'HYPOTHESIS_FORMED') {
    if (stage !== 'ENGAGED') throw new Error('invalid development stage');
    stage = 'HYPOTHESIS';
    domain = input.domain!;
  } else if (input.kind === 'PRACTICE_RECORDED') {
    if ((stage !== 'HYPOTHESIS' && stage !== 'PRACTICING')
      || domain !== input.domain) {
      throw new Error('invalid development stage or domain');
    }
    stage = 'PRACTICING';
    practice = Object.freeze([...practice, input.sourceEventId]);
  } else if (input.kind === 'FEEDBACK_RECORDED') {
    if (stage !== 'PRACTICING' || domain !== input.domain
      || practice.length === 0) {
      throw new Error('invalid development stage or domain');
    }
    feedback = Object.freeze([...feedback, input.sourceEventId]);
  } else {
    if (stage !== 'PRACTICING' || domain !== input.domain) {
      throw new Error('invalid development stage or domain');
    }
    if (practice.length < state.policy.minimumPracticeEvents
      || feedback.length < state.policy.minimumFeedbackEvents
      || input.atDay - state.startedAtDay
        < state.policy.minimumElapsedDays) {
      throw new Error('insufficient development consolidation evidence');
    }
    stage = 'CONSOLIDATED';
  }
  const record: DevelopmentLearningEvent = Object.freeze({ ...input });
  return Object.freeze({ ...state, revision: state.revision + 1,
    effectiveDay: input.atDay, stage, domain,
    practiceSourceEventIds: practice,
    feedbackSourceEventIds: feedback,
    events: Object.freeze([...state.events, record]),
  });
};
