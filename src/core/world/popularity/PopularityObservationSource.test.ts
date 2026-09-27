import { describe, expect, it } from 'vitest';
import { projectFanFavorite } from './FanFavorite';
import { adaptFreeAgentRightsEvent, appendPopularityExposure,
  createPopularityHistory,
  readFanFavoriteInputAt, type AcceptedPublicCareerEvent,
  type AudienceResponseEvidence, type PopularityUpdatePolicy,
} from './PopularityObservationSource';

const policy: PopularityUpdatePolicy = { policyId: 'popularity-update',
  version: 'v1', availableAtDay: 0, initialAwareness: 0,
  initialFavorability: 0.5, awarenessRate: 0.3,
  favorabilityRate: 0.2, maximumAwarenessStep: 0.1,
  maximumFavorabilityStep: 0.05 };
const event = (kind: AcceptedPublicCareerEvent['kind'] = 'OFFICIAL_GAME',
  eventId = 'event-1'): AcceptedPublicCareerEvent => ({ eventId,
  careerId: 'career-a', personId: 'person-a', kind,
  sourceRecordId: `accepted-${eventId}`, acceptedRevision: 1,
  occurredAtDay: 10, acceptedAtDay: 11, transfer: null });
const response = (eventId = 'event-1', evidenceId = 'reach-1',
  reach = 0.8, favorability = 0.9): AudienceResponseEvidence => ({
  evidenceId, sourceCareerEventId: eventId,
  audience: { kind: 'CLUB_FANS', scopeId: 'club-a' },
  observedAtDay: 11, availableAtDay: 12,
  reach, response: favorability,
});
const descriptorPolicy = { policyId: 'fan-favorite', version: 'v1',
  effectiveDay: 0, minimumAwareness: 0.7,
  minimumFavorability: 0.8 };

describe('source-backed popularity slow state', () => {
  it('uses reach and response, not event kind, and feeds FanFavorite', () => {
    const initial = createPopularityHistory('career-a', 'person-a', 'club-a');
    const game = appendPopularityExposure(initial, 0, event(),
      [response()], policy, 12);
    const award = appendPopularityExposure(initial, 0,
      event('AWARD'), [response()], policy, 12);
    expect(game.observations.map((item) => item.value))
      .toEqual([0.1, 0.55]);
    expect(award.observations.map((item) => item.value))
      .toEqual(game.observations.map((item) => item.value));
    expect(projectFanFavorite(readFanFavoriteInputAt(game, 12,
      descriptorPolicy)).audiences).toMatchObject([
      { awareness: 0.1, favorability: 0.55, fanFavorite: false },
    ]);
    expect(game.processedEvents[0]).toMatchObject({ eventId: 'event-1',
      sourceRecordId: 'accepted-event-1', policyVersion: 'v1' });
  });

  it('moves slowly with repeated independent evidence and keeps audience scopes separate', () => {
    const initial = createPopularityHistory('career-a', 'person-a', 'club-a');
    const first = appendPopularityExposure(initial, 0, event(),
      [response()], policy, 12);
    const second = appendPopularityExposure(first, 1,
      { ...event('OFFICIAL_GAME', 'event-2'),
        occurredAtDay: 13, acceptedAtDay: 13 },
      [{ ...response('event-2', 'reach-2'),
        observedAtDay: 13, availableAtDay: 14 },
      { ...response('event-2', 'regional-2'),
        audience: { kind: 'LOCAL_REGION', scopeId: 'region-a' },
        observedAtDay: 13, availableAtDay: 14 }], policy, 14);
    const projection = projectFanFavorite(readFanFavoriteInputAt(second,
      14, descriptorPolicy));
    const clubFans = projection.audiences.find((item) =>
      item.audience.kind === 'CLUB_FANS');
    const region = projection.audiences.find((item) =>
      item.audience.kind === 'LOCAL_REGION');
    expect(clubFans?.awareness).toBeCloseTo(0.2);
    expect(clubFans?.favorability).toBeCloseTo(0.6);
    expect(region?.awareness).toBeCloseTo(0.1);
    expect(region?.favorability).toBeCloseTo(0.55);
  });

  it('preserves old club affection after an accepted transfer', () => {
    const first = appendPopularityExposure(createPopularityHistory(
      'career-a', 'person-a', 'club-a'), 0, event(),
    [response()], policy, 12);
    const moved = appendPopularityExposure(first, 1, {
      ...event('TRANSFER', 'move-1'),
      occurredAtDay: 13, acceptedAtDay: 13,
      transfer: { fromClubId: 'club-a', toClubId: 'club-b' },
    }, [{ ...response('move-1', 'new-fans'),
      audience: { kind: 'CLUB_FANS', scopeId: 'club-b' },
      observedAtDay: 13, availableAtDay: 14 }], policy, 14);
    const projection = projectFanFavorite(readFanFavoriteInputAt(moved,
      14, descriptorPolicy));
    expect(projection.currentClubId).toBe('club-b');
    expect(projection.audiences.find((item) =>
      item.audience.scopeId === 'club-a')).toMatchObject({
      awareness: 0.1, favorability: 0.55 });
    expect(projection.audiences.find((item) =>
      item.audience.scopeId === 'club-b')).toMatchObject({
      awareness: 0.1, favorability: 0.55 });
  });

  it('rejects duplicate events, absent reach, future or mismatched response evidence', () => {
    const initial = createPopularityHistory('career-a', 'person-a', 'club-a');
    const first = appendPopularityExposure(initial, 0, event(),
      [response()], policy, 12);
    expect(() => appendPopularityExposure(first, 1, event(),
      [response('event-1', 'reach-new')], policy, 13)).toThrow();
    expect(() => appendPopularityExposure(initial, 0, event(),
      [response('other')], policy, 12)).toThrow();
    expect(() => appendPopularityExposure(initial, 0, event(),
      [{ ...response(), availableAtDay: 13 }], policy, 12)).toThrow();
    expect(() => appendPopularityExposure(initial, 0, event(),
      [{ ...response(), reach: 0 }], policy, 12)).toThrow();
  });

  it('adapts an accepted free-agent rights event as a club move source', () => {
    const adapted = adaptFreeAgentRightsEvent({
      type: 'FREE_AGENT_RIGHTS_ACQUIRED', eventId: 'rights-1',
      careerId: 'career-a', clubId: 'club-b', playerId: 'player-a',
      contractId: 'contract-1', decisionId: 'decision-1',
      acceptanceId: 'acceptance-1', sourceClubEventId: 'club-event-1',
      effectiveDay: 20, beforeRevision: 3, afterRevision: 4,
      beforeRights: { rightsHolderClubId: null, contractId: null },
      afterRights: { rightsHolderClubId: 'club-b', contractId: 'contract-1' },
    }, 'person-a', 'player-a');
    expect(adapted).toMatchObject({ kind: 'TRANSFER',
      eventId: 'rights-1', personId: 'person-a',
      transfer: { fromClubId: null, toClubId: 'club-b' } });
  });

  it('orders a delayed accepted response by transition time and retains source time', () => {
    const first = appendPopularityExposure(createPopularityHistory(
      'career-a', 'person-a', 'club-a'), 0, event(),
    [response()], policy, 12);
    const delayed = appendPopularityExposure(first, 1, {
      ...event('PUBLIC_EVENT', 'event-2'), acceptedAtDay: 19,
    }, [{ ...response('event-2', 'a-late'),
      availableAtDay: 12 }], policy, 20);
    const standing = projectFanFavorite(readFanFavoriteInputAt(delayed,
      20, descriptorPolicy)).audiences[0];
    expect(standing?.awareness).toBeCloseTo(0.2);
    expect(delayed.processedEvents[1]?.audienceEvidence[0])
      .toMatchObject({ evidenceId: 'a-late', observedAtDay: 11,
        availableAtDay: 12 });
  });
});
