import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerIntakeStore } from './SqlitePlayerIntakeStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteNationalEligibilityFactStore } from './SqliteNationalEligibilityFactStore';
import { openSqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';

it('pins Native Player/Person and Nation facts, supports revocation and cutoff replay without changing the roster', () => {
  const path = `file:national-eligibility-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const world = openSqliteWorldSettlementStore(path);
  const roster = openSqliteManagerRosterDecisionStore(path);
  const nations = openSqliteNationCompetitionRegionStore(path);
  const links = openSqlitePlayerPersonLinkStore(path);
  const intake = openSqlitePlayerIntakeStore(path, { readAcceptedPlayerIntake: () => ({ sourceId: 'intake-1',
    careerId: 'career-a', playerId: 'player-1', personId: 'person-1', sourceRecordId: 'person-record-1',
    sourceVersion: 'intake-v1', acceptedRevision: 1, acceptedAtDay: 10, rosterRevision: 1 }) });
  let facts: ReturnType<typeof openSqliteNationalEligibilityFactStore> | undefined;
  let snapshots: ReturnType<typeof openSqliteNationalRosterSnapshotStore> | undefined;
  try {
    world.initialize({ careerId: 'career-a', clubs: [state()], schedule: {
      seasonId: 'league-season-1', leagueId: 'league-a', memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [] },
      standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 5 } });
    roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null,
      roster: createRosterState({ careerId: 'career-a', effectiveDay: 10, profiles: [{ profileId: 'league',
        version: 'v1', season: 1, competitionEditionId: 'league-season-1', activeLimit: null,
        allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
        units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }], players: [] }) });
    intake.accept('intake-1');
    nations.record({ careerId: 'career-a', nationId: 'JP', region: 'ASIA_PACIFIC', effectiveFromDay: 0, sourceEventId: 'JP' });
    const sources = { personLinks: links, nations };
    facts = openSqliteNationalEligibilityFactStore(path, sources);
    const beforeRoster = roster.readHead('career-a', 'club-a')!.roster;
    snapshots = openSqliteNationalRosterSnapshotStore(path, { roster });
    const frozenRoster = snapshots.capture('career-a', 'club-a');
    expect(frozenRoster.roster).toEqual(beforeRoster);
    expect(snapshots.capture('career-a', 'club-a')).toEqual(frozenRoster);
    const request = { careerId: 'career-a', personLinkSourceId: 'intake-1', active: true, fact: {
      evidenceId: 'citizenship-1', playerId: 'player-1', personId: 'person-1', nationId: 'JP',
      basis: 'CITIZENSHIP' as const, effectiveFromDay: 10 } };
    const first = facts.record(request);
    expect(facts.record(request)).toEqual(first);
    const atTen = facts.readFacts('career-a', 'player-1', 10)!;
    expect(atTen.facts).toEqual([request.fact]);
    expect(facts.readFacts('career-a', 'player-1', 9)).toBeNull();
    facts.record({ ...request, active: false, fact: { ...request.fact, evidenceId: 'revoked', effectiveFromDay: 20 } });
    expect(facts.readFacts('career-a', 'player-1', 20)?.facts).toEqual([]);
    expect(facts.readFacts('career-a', 'player-1', 10)).toEqual(atTen);
    expect(roster.readHead('career-a', 'club-a')!.roster).toEqual(beforeRoster);
    snapshots.close();
    // Historical accepted checkpoints do not require traversal of a later live roster.
    snapshots = openSqliteNationalRosterSnapshotStore(path, { roster: { readHead: () => { throw new Error('future roster source unavailable'); } } });
    expect(snapshots.readSnapshot('career-a', frozenRoster.snapshotId)).toEqual(frozenRoster);
    expect(() => facts!.record({ ...request, fact: { ...request.fact, evidenceId: 'foreign-person', personId: 'forged' } })).toThrow('identity');
    expect(() => facts!.record({ ...request, fact: { ...request.fact, evidenceId: 'before-intake', effectiveFromDay: 9 } })).toThrow('identity');
    facts.close(); facts = openSqliteNationalEligibilityFactStore(path, sources);
    expect(facts.readFacts('career-a', 'player-1', 10)).toEqual(atTen);
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(path);
    try {
      db.prepare("UPDATE world_national_eligibility_facts SET entry_json='{}' WHERE evidence_id='citizenship-1'").run();
      expect(() => facts!.readFacts('career-a', 'player-1', 10)).toThrow('corrupt');
      db.prepare("UPDATE world_national_roster_snapshots SET snapshot_json='{}'").run();
      expect(() => snapshots!.readSnapshot('career-a', frozenRoster.snapshotId)).toThrow('corrupt');
    } finally { db.close(); }
  } finally { snapshots?.close(); facts?.close(); intake.close(); links.close(); nations.close(); roster.close(); world.close(); }
});
