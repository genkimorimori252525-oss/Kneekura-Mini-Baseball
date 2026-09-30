import { match, worldSetup, timeline, adjudication, applyTwo } from './OfficialParticipationPlayFixtures.test-support';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import { appendPopularityExposure, createPopularityHistory } from
  '../../core/world/popularity/PopularityObservationSource';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore,
  type OfficialParticipantBinding, type ParticipationAuthority } from './SqliteOfficialParticipationStore';

const directories: string[] = [];
const pathForTest = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-participation-'));
  directories.push(directory);
  return join(directory, 'official.sqlite');
};
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-participation-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const roster = (): RosterState => createRosterState({
  careerId: 'career-1', effectiveDay: 2, revision: 3,
  profiles: [{ profileId: 'profile-1', version: 'v1', season: 2026,
    competitionEditionId: 'league-2026', activeLimit: null,
    allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
  units: [{ unitId: 'home-first', clubId: 'home', kind: 'FIRST_TEAM' }],
  players: [{ playerId: 'home-0',
    clubRights: { rightsHolderClubId: 'home', contractId: 'contract-1' },
    assignment: { unitId: 'home-first', clubId: 'home' },
    registrations: [{ competitionEditionId: 'league-2026', clubId: 'home',
      status: 'ACTIVE', eligibility: 'ELIGIBLE', evidenceId: 'registration-1' }],
    availability: { status: 'AVAILABLE', evidenceId: 'availability-1' },
  }],
});
const binding = (): OfficialParticipantBinding => ({
  gameId: 'game-1', careerId: 'career-1', competitionEditionId: 'league-2026',
  gameDay: 3, clubId: 'home', side: 'HOME', playerId: 'home-0',
  personId: 'person-0', personLinkSourceId: 'person-link-1',
  rosterRevision: 3, fixtureEventId: 'fixture-1',
});
const authority = (): ParticipationAuthority => ({
  readGame: () => ({ careerId: 'career-1', competitionEditionId: 'league-2026',
    gameDay: 3, homeClubId: 'home', awayClubId: 'away',
    fixtureEventId: 'fixture-1' }),
  readRoster: () => roster(),
  readPersonLink: () => ({ personId: 'person-0', sourceId: 'person-link-1' }),
});
const setup = () => {
  const path = pathForTest();
  const official = new SqliteOfficialStateStore(path);
  official.registerOfficialFixture({ gameId: 'game-1', venueId: 'venue-1',
    fixtureEventId: 'fixture-1', fixtureRevision: 1 });
  const participation = new SqliteOfficialParticipationStore(path, authority());
  return { path, official, participation };
};
describe('durable official player participation', () => {
  it('requires a pregame binding and a completed play, then survives restart', () => {
    const { path, official, participation } = setup();
    expect(participation.bindPregame(binding())).toEqual(binding());
    expect(participation.bindPregame(binding())).toEqual(binding());
    expect(() => participation.bindPregame({ ...binding(), personId: 'other' }))
      .toThrow('already differs');
    official.initializeMatch('game-1', match());
    const first = official.applyAndActivate({ kind: 'live_ball',
      matchId: 'game-1', applicationId: 'application-1',
      expectedDurableRevision: 0, match: match(),
      physicalTimeline: timeline(7, 100, 500),
      adjudication: adjudication(7, 500, 'closure-1', 1),
      nextStartedAtTick: 503, worldSetup: worldSetup() });
    expect(() => participation.confirmPlayed('game-1', 'home-0', 'DEFENDER',
      'application-1', 'application-2')).toThrow('not durable');
    expect(participation.readAcceptedPopularityEvent('official-participation:unknown'))
      .toBeNull();
    official.applyAndActivate({ kind: 'live_ball', matchId: 'game-1',
      applicationId: 'application-2', expectedDurableRevision: 1,
      match: first.activation.nextMatchState,
      physicalTimeline: timeline(8, 503, 900),
      adjudication: adjudication(8, 900, 'closure-2', 2),
      nextStartedAtTick: 903, worldSetup: worldSetup() });
    const receipt = participation.confirmPlayed('game-1', 'home-0',
      'DEFENDER', 'application-1', 'application-2');
    expect(receipt).toMatchObject({ playedPlayId: 8, durableRevision: 2,
      binding: { personId: 'person-0' } });
    expect(participation.confirmPlayed('game-1', 'home-0', 'DEFENDER',
      'application-1', 'application-2')).toEqual(receipt);
    const accepted = participation.readAcceptedPopularityEvent(receipt.receiptId);
    expect(accepted)
      .toMatchObject({ kind: 'OFFICIAL_GAME', eventId: receipt.receiptId,
        personId: 'person-0', acceptedRevision: 2, occurredAtDay: 3 });
    expect(accepted).not.toBeNull();
    if (accepted) {
      const history = appendPopularityExposure(
        createPopularityHistory('career-1', 'person-0', 'home'), 0,
        accepted, [{ evidenceId: 'audience-1',
          sourceCareerEventId: accepted.eventId,
          audience: { kind: 'CLUB_FANS', scopeId: 'home' },
          observedAtDay: 3, availableAtDay: 3, reach: 0.4,
          response: 0.7 }],
        { policyId: 'popularity', version: 'v1', availableAtDay: 0,
          initialAwareness: 0.1, initialFavorability: 0.5,
          awarenessRate: 0.1, favorabilityRate: 0.1,
          maximumAwarenessStep: 0.05,
          maximumFavorabilityStep: 0.05 }, 3);
      expect(history.processedEvents[0]?.kind).toBe('OFFICIAL_GAME');
    }
    participation.close(); official.close();
    const reopened = new SqliteOfficialParticipationStore(path, authority());
    expect(reopened.readReceipt(receipt.receiptId)).toEqual(receipt);
    expect(reopened.readAcceptedPopularityEvent('unknown')).toBeNull();
    reopened.close();
  });

  it('rejects wrong actor, wrong side, absent binding and late binding', () => {
    const { official, participation } = setup();
    expect(() => participation.confirmPlayed('game-1', 'home-0', 'DEFENDER',
      'application-1', 'application-2')).toThrow('binding is absent');
    participation.bindPregame(binding());
    applyTwo(official);
    expect(() => participation.confirmPlayed('game-1', 'home-0', 'RUNNER',
      'application-1', 'application-2')).toThrow('absent from durable play actors');
    expect(() => participation.bindPregame({ ...binding(), playerId: 'home-1' }))
      .toThrow('lacks accepted');
    participation.close(); official.close();
  });

  it('does not accept a pregame binding after durable play has begun', () => {
    const { official, participation } = setup();
    applyTwo(official);
    expect(() => participation.bindPregame(binding()))
      .toThrow('lacks accepted fixture, roster, or person source');
    expect(() => participation.confirmPlayed('game-1', 'home-0', 'DEFENDER',
      'application-1', 'application-2')).toThrow('binding is absent');
    participation.close(); official.close();
  });
});
