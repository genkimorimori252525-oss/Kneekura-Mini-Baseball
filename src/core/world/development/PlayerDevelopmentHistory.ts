import type { DevelopmentLearningEpisode,
  DevelopmentLearningEvent } from './DevelopmentLearningEpisode';
import type { PlayerPitchTimingSource,
  PitchTimingSourceChange } from './PlayerPitchTimingSource';

export type PlayerDevelopmentHistoryEvent = Readonly<{
  eventId: string;
  careerId: string;
  playerId: string;
  episodeId: string;
  occurredAtDay: number;
  kind: 'CATALYST' | 'HYPOTHESIS_FORMED'
    | 'CONSOLIDATION_PROGRESS' | 'SOURCE_STATE_CHANGED';
  domain: DevelopmentLearningEpisode['domain'];
  sourceEventIds: readonly string[];
  profileVersion: string;
}>;

const sameIds = (left: readonly string[],
  right: readonly string[]): boolean =>
  left.length === right.length
    && left.every((value, index) => value === right[index]);

const validateLink = (source: PlayerPitchTimingSource,
  record: PitchTimingSourceChange,
  episode: DevelopmentLearningEpisode): void => {
  if (episode.careerId !== source.careerId
    || episode.playerId !== source.playerId) {
    throw new Error('development history scope mismatch');
  }
  const first = episode.events[0];
  const hypothesis = episode.events.filter((event) =>
    event.kind === 'HYPOTHESIS_FORMED');
  const last = episode.events.at(-1);
  if (record.episodeId !== episode.episodeId
    || record.effectiveDay !== episode.effectiveDay
    || record.profileVersion !== episode.profileVersion
    || !sameIds(record.practiceSourceEventIds,
      episode.practiceSourceEventIds)
    || episode.stage !== 'CONSOLIDATED'
    || episode.domain !== 'TECHNICAL'
    || !Array.isArray(episode.events)
    || episode.events.length !== episode.revision + 1
    || first?.kind !== 'CATALYST'
    || first.sourceEventId !== episode.catalyst.sourceEventId
    || hypothesis.length !== 1
    || last?.kind !== 'CONSOLIDATION_RECORDED'
    || last.sourceEventId !== record.consolidationSourceEventId
    || last.atDay !== record.effectiveDay
    || episode.events.filter((event) =>
      event.kind === 'PRACTICE_RECORDED').map((event) =>
      event.sourceEventId).join('\u0000')
        !== episode.practiceSourceEventIds.join('\u0000')
    || episode.events.filter((event) =>
      event.kind === 'FEEDBACK_RECORDED').map((event) =>
      event.sourceEventId).join('\u0000')
        !== episode.feedbackSourceEventIds.join('\u0000')) {
    throw new Error('development episode and source history mismatch');
  }
};

/** Replays important Career provenance; these records never apply ability or Trait effects. */
export const derivePitchTimingDevelopmentHistory = (
  source: PlayerPitchTimingSource,
  episodes: readonly DevelopmentLearningEpisode[],
): readonly PlayerDevelopmentHistoryEvent[] => {
  if (!Array.isArray(source?.records)
    || source.revision !== source.records.length
    || !Array.isArray(episodes)
    || episodes.length !== source.records.length
    || new Set(episodes.map((episode) => episode?.episodeId)).size
      !== episodes.length
    || new Set(source.records.map((record) => record?.episodeId)).size
      !== source.records.length) {
    throw new Error('development history requires one episode per source record');
  }
  const history: PlayerDevelopmentHistoryEvent[] = [];
  let previous: PitchTimingSourceChange | null = null;
  for (const record of source.records) {
    const episode = episodes.find((candidate) =>
      candidate.episodeId === record.episodeId);
    if (!episode) {
      throw new Error('missing development episode for source record');
    }
    validateLink(source, record, episode);
    if ((previous && (record.effectiveDay < previous.effectiveDay
      || record.beforeQuickSpeedFactor
        !== previous.afterQuickSpeedFactor
      || record.beforeNormalMotionToReleaseUs
        !== previous.afterNormalMotionToReleaseUs))
      || !Number.isFinite(record.beforeQuickSpeedFactor)
      || !Number.isFinite(record.afterQuickSpeedFactor)
      || !Number.isSafeInteger(record.beforeNormalMotionToReleaseUs)
      || !Number.isSafeInteger(record.afterNormalMotionToReleaseUs)
      || record.changeKind !== (
        record.beforeQuickSpeedFactor === record.afterQuickSpeedFactor
        && record.beforeNormalMotionToReleaseUs
          === record.afterNormalMotionToReleaseUs
          ? 'NO_SOURCE_CHANGE' : 'SOURCE_CHANGED')) {
      throw new Error('invalid development source history');
    }
    previous = record;
    const first = episode.events[0];
    const hypothesis = episode.events.find((event: DevelopmentLearningEvent) =>
      event.kind === 'HYPOTHESIS_FORMED')!;
    const last = episode.events.at(-1)!;
    const shared = { careerId: source.careerId,
      playerId: source.playerId, episodeId: episode.episodeId,
      domain: episode.domain,
      profileVersion: episode.profileVersion };
    const add = (eventId: string, occurredAtDay: number,
      kind: PlayerDevelopmentHistoryEvent['kind'],
      ids: readonly string[]) => {
      history.push(Object.freeze({ ...shared, eventId,
        occurredAtDay, kind,
        sourceEventIds: Object.freeze([...ids]),
      }));
    };
    add(first.eventId, first.atDay, 'CATALYST',
      [first.sourceEventId]);
    add(hypothesis.eventId, hypothesis.atDay,
      'HYPOTHESIS_FORMED', [hypothesis.sourceEventId]);
    const consolidationIds = [...episode.practiceSourceEventIds,
      ...episode.feedbackSourceEventIds, last.sourceEventId];
    add(last.eventId, last.atDay, 'CONSOLIDATION_PROGRESS',
      consolidationIds);
    if (record.changeKind === 'SOURCE_CHANGED') {
      add(`${episode.episodeId}:source-state-changed`,
        record.effectiveDay, 'SOURCE_STATE_CHANGED',
        consolidationIds);
    }
  }
  if (previous && (previous.afterQuickSpeedFactor
    !== source.profile.quickSpeedFactor
    || previous.afterNormalMotionToReleaseUs
      !== source.profile.normalMotionToReleaseUs
    || previous.effectiveDay !== source.effectiveDay)) {
    throw new Error('invalid development source history');
  }
  const order = { CATALYST: 0, HYPOTHESIS_FORMED: 1,
    CONSOLIDATION_PROGRESS: 2, SOURCE_STATE_CHANGED: 3 };
  return Object.freeze(history.sort((left, right) =>
    left.occurredAtDay - right.occurredAtDay
    || order[left.kind] - order[right.kind]
    || left.eventId.localeCompare(right.eventId)));
};
