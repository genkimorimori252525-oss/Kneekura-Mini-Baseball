import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { openSqliteNationalMatchOriginStore, readNationalMatchOrigin } from './NationalMatchOriginFromSqlite';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { appendPopularityExposure, createPopularityHistory } from '../../core/world/popularity/PopularityObservationSource';
import { expect, it } from 'vitest';
import { nationalPhysicalPregameFixture, nationalPhysicalFixture } from './NationalPhysicalMatchFixtures.test-support';

it('captures the accepted Regional fixture and immutable original National membership without changing Club assignments', () => {
  const f = nationalPhysicalPregameFixture();
  try {
    const before = f.roster.readHead('career-a', 'club-a');
    const origin = f.origins.capture(f.source);
    expect(origin.fixture).toMatchObject({ competitionScope: 'NATIONAL', homeClubId: 'JP', awayClubId: 'KR', gameDay: 121 });
    expect(origin.participants).toHaveLength(19);
    expect(origin.participants[0].eligibility.decision.eligible).toBe(true);
    expect(f.origins.capture(f.source)).toEqual(origin);
    expect(f.roster.readHead('career-a', 'club-a')).toEqual(before);
  } finally { f.close(); }
});

it('plays an ordinary physical National plate appearance and adopts its original batter and defender facts once', () => {
  const f = nationalPhysicalFixture();
  try {
    const before = f.roster.readHead('career-a', 'club-a');
    expect(f.closePlay().scoring.record.classification).toBe('strikeout');
    const batter = f.participation.confirmNationalPhysicalPlayed(f.source.gameId, 'p9', 'close-1');
    const defender = f.participation.confirmNationalPhysicalPlayed(f.source.gameId, 'p0', 'close-1');
    expect(batter.actorKind).toBe('BATTER'); expect(defender.actorKind).toBe('DEFENDER');
    expect(batter.evidenceKind).toBe('NATIONAL_PHYSICAL_PLAY_V1');
    expect(() => f.participation.confirmNationalPhysicalPlayed(f.source.gameId, 'p18', 'close-1')).toThrow('absent');
    expect(() => f.participation.confirmPhysicalPlayed(f.source.gameId, 'p1', 'close-1')).toThrow('domestic');
    const request = { eventId: 'national-appearance', careerId: 'career-a', receiptId: batter.receiptId, acceptedAtDay: 121 };
    const originalHash = f.db.prepare('SELECT snapshot_hash FROM world_national_match_origins').get();
    const fault = witnessSqliteWrite(/INSERT INTO world_national_callups/, db => {
      expect(db.isTransaction).toBe(true);
      db.prepare("UPDATE world_national_match_origins SET snapshot_hash='changed'").run(); return true;
    });
    try { expect(() => f.callups.adoptAppearance(request)).toThrow(); expect(fault.wasReached()).toBe(true); }
    finally { fault.close(); }
    expect(f.db.prepare('SELECT count(*) AS n FROM world_national_callups').get()).toEqual({ n: 19 });
    expect(f.db.prepare('SELECT snapshot_hash FROM world_national_match_origins').get()).toEqual(originalHash);
    const appearance = f.callups.adoptAppearance(request);
    expect(appearance.source.receipt).toEqual(batter);
    expect(f.callups.adoptAppearance(request)).toEqual(appearance);
    expect(f.callups.readRepresentation('career-a', 'p9', 121)[0].seniorOfficialAppearanceDay).toBe(121);
    expect(f.callups.readRepresentation('career-a', 'p18', 121)[0].seniorOfficialAppearanceDay).toBeNull();
    expect(f.origins.read(f.source.gameId)).toEqual(f.origin);
    expect(f.roster.readHead('career-a', 'club-a')).toEqual(before);
    const event = f.participation.readAcceptedPopularityEvent(batter.receiptId)!;
    expect(event).toMatchObject({ kind: 'OFFICIAL_GAME', personId: 'person-9', acceptedRevision: 1, occurredAtDay: 121 });
    const popularity = appendPopularityExposure(createPopularityHistory('career-a', 'person-9', 'club-a'), 0, event,
      [{ evidenceId: 'audience', sourceCareerEventId: event.eventId, audience: { kind: 'NATIONAL', scopeId: 'KR' },
        observedAtDay: 121, availableAtDay: 121, reach: 0.4, response: 0.7 }],
      { policyId: 'popularity', version: 'fixture-v1', availableAtDay: 0, initialAwareness: 0.1, initialFavorability: 0.5,
        awarenessRate: 0.1, favorabilityRate: 0.1, maximumAwarenessStep: 0.05, maximumFavorabilityStep: 0.05 }, 121);
    expect(popularity.processedEvents[0].sourceRecordId).toBe(batter.receiptId);
    expect(f.workload.readHead('career-a', 'p0')!.fatigue).toBeCloseTo(0.6);

    // Later revisions on the very same day must not rewrite the original legal or active-roster proof.
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-9', active: false,
      fact: { evidenceId: 'revoke-later', playerId: 'p9', personId: 'person-9', nationId: 'KR', basis: 'CITIZENSHIP', effectiveFromDay: 121 } });
    f.changeAvailability('p0', 'INJURED', 121);
    f.callups.register({ ...f.request(19), editionId: f.source.editionId, registeredAtDay: 121, replacementOf: 'call-0',
      callupPolicy: { ...f.request(19).callupPolicy, rosterLimit: 10, initialRegistrationCutoffDay: 120, replacementCutoffDay: 124 } });
    expect(f.callups.readActiveRoster('career-a', f.source.editionId, 'JP', 121).some(e => e.input.playerId === 'p0')).toBe(false);
    const later = f.callups.adoptAppearance({ ...request, eventId: 'defender-appearance', receiptId: defender.receiptId });
    expect(later.source.registrationSnapshotId).toBe(f.origin.participants.find(p => p.binding.playerId === 'p0')!.registrationSnapshotId);
    const reopened = f.track(openSqliteNationalCallupStore(f.path, f.callupSources));
    expect(reopened.adoptAppearance(request)).toEqual(appearance);
    expect(f.participation.confirmNationalPhysicalPlayed(f.source.gameId, 'p9', 'close-1')).toEqual(batter);
    expect(f.track(openSqliteNationalMatchOriginStore(f.path)).capture(f.source)).toEqual(f.origin);
  } finally { f.close(); }
});

it('rejects stale legal eligibility before first origin capture and stale global-roster admission', () => {
  const f = nationalPhysicalPregameFixture();
  try {
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-9', active: false,
      fact: { evidenceId: 'pregame-revocation', playerId: 'p9', personId: 'person-9', nationId: 'KR', basis: 'CITIZENSHIP', effectiveFromDay: 121 } });
    expect(() => f.origins.capture(f.source)).toThrow('legal eligibility');
    expect(f.origins.read(f.source.gameId)).toBeNull();
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-9', active: true,
      fact: { evidenceId: 'pregame-restoration', playerId: 'p9', personId: 'person-9', nationId: 'KR', basis: 'CITIZENSHIP', effectiveFromDay: 121 } });
    f.changeAvailability('p18', 'INJURED', 121);
    expect(() => f.origins.capture(f.source)).toThrow('roster is no longer current');
    expect(f.origins.read(f.source.gameId)).toBeNull();
  } finally { f.close(); }
});

it('authenticates original membership on the consuming connection and invalidates read reuse after an owner write', () => {
  const f = nationalPhysicalPregameFixture();
  try {
    const origin = f.origins.capture(f.source);
    f.db.exec('BEGIN');
    expect(withBattedVenueLegalReadSnapshot(f.db, () => {
      const first = readNationalMatchOrigin(f.db, f.source.gameId);
      expect(readNationalMatchOrigin(f.db, f.source.gameId)).toBe(first); return first;
    })).toEqual(origin);
    f.db.prepare("UPDATE world_national_callups SET entry_json='{}' WHERE event_id='call-0'").run();
    expect(() => readNationalMatchOrigin(f.db, f.source.gameId)).toThrow();
    f.db.exec('ROLLBACK');
    expect(f.origins.read(f.source.gameId)).toEqual(origin);
  } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); }
});

it('rolls back an origin capture whose real INSERT changes its original fixture', () => {
  const f = nationalPhysicalPregameFixture();
  const before = f.db.prepare('SELECT * FROM official_fixtures').all();
  const fault = witnessSqliteWrite(/INSERT INTO world_national_match_origins/, db => {
    db.prepare("UPDATE official_fixtures SET fixture_event_id='changed'").run(); return true;
  });
  try {
    expect(() => f.origins.capture(f.source)).toThrow(); expect(fault.wasReached()).toBe(true);
    expect(f.db.prepare('SELECT * FROM official_fixtures').all()).toEqual(before);
    expect(f.origins.read(f.source.gameId)).toBeNull();
  } finally { fault.close(); f.close(); }
});

it('rejects duplicate original registration metadata and raw game aliases without inventing new participants', () => {
  const f = nationalPhysicalPregameFixture();
  try {
    const binding = String(f.db.prepare("SELECT binding_json FROM official_participant_bindings WHERE player_id='p0'").get()!.binding_json);
    f.db.prepare("UPDATE official_participant_bindings SET binding_json=? WHERE player_id='p0'")
      .run(binding.replace('"nationalRegistrationEventId":', '"nationalRegistrationEventId":"other-call","nationalRegistrationEventId":'));
    expect(() => f.origins.capture(f.source)).toThrow('membership scope');
    f.db.prepare("UPDATE official_participant_bindings SET binding_json=? WHERE player_id='p0'").run(binding);
    const origin = f.origins.capture(f.source);
    f.db.prepare(`INSERT INTO world_national_match_origins SELECT 'alias-source','alias-game',career_id,edition_id,
      source_json,source_hash,snapshot_json,snapshot_hash FROM world_national_match_origins WHERE source_id=?`).run(f.source.sourceId);
    expect(() => f.origins.read(f.source.gameId)).toThrow('game ownership');
    f.db.prepare("DELETE FROM world_national_match_origins WHERE source_id='alias-source'").run();
    expect(f.origins.read(f.source.gameId)).toEqual(origin);
  } finally { f.close(); }
});
