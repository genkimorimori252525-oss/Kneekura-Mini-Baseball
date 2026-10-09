// STRUCTURAL Native storage/dispatch coverage. Original physical closure and
// National origin readers below are substituted. This is not genuine physics
// or tournament-membership qualification; their real owners have separate tests.
import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteOfficialParticipationStore, type OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import * as live from './ActualLivePlayClosureEvidenceFromSqlite';
import * as terminal from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import * as national from './NationalMatchOriginFromSqlite';
import { readActualLiveOriginalFixture } from './ActualLiveOriginalFixtureFromSqlite';
import { captureClinicalGameRows } from './HealthRehabEvidenceFromSqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const cleanup: (() => void)[] = [];
afterEach(() => { vi.restoreAllMocks(); while (cleanup.length) cleanup.pop()!(); });

const fixture = (kind: 'live' | 'foul', final = false) => {
  const path = join(mkdtempSync(join(tmpdir(), 'national-participation-dispatch-')), 'fixture.sqlite');
  const store = new SqliteOfficialParticipationStore(path), db = new DatabaseSync(path);
  cleanup.push(() => store.close(), () => db.close());
  db.exec(`CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);
    CREATE TABLE applications(application_id TEXT,match_id TEXT,closure_id TEXT,request_hash TEXT,result_json TEXT);
    CREATE TABLE actual_live_play_closures(source_id TEXT,application_id TEXT,game_id TEXT,play_id INTEGER,source_json TEXT,proposal_json TEXT,result_json TEXT);
    CREATE TABLE world_player_person_links(source_id TEXT,career_id TEXT,player_id TEXT,person_id TEXT,roster_revision INTEGER,accepted_at_day INTEGER,source_json TEXT);
    CREATE TABLE fixture_original_national(valid INTEGER); INSERT INTO fixture_original_national VALUES(1);`);
  const bindings: OfficialParticipantBinding[] = Array.from({ length: 10 }, (_, i) => ({ gameId: 'game', careerId: 'career',
    competitionEditionId: 'edition', gameDay: 121, clubId: i ? 'JP' : 'KR', side: i ? 'HOME' : 'AWAY',
    playerId: `p${i}`, personId: `person${i}`, personLinkSourceId: `link${i}`, rosterRevision: 1, fixtureEventId: 'fixture',
    nationalRegistrationEventId: `call${i}`, nationalRosterSnapshotId: 'roster' }));
  const actors = bindings.map(binding => {
    const person = { sourceId: binding.personLinkSourceId, careerId: 'career', playerId: binding.playerId, personId: binding.personId,
      sourceRecordId: `intake:${binding.playerId}`, sourceVersion: 'fixture-v1', acceptedRevision: 1, acceptedAtDay: 100, rosterRevision: 1 };
    db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('game', binding.playerId, json(binding));
    db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(person.sourceId, 'career', person.playerId, person.personId, 1, 100, json(person));
    return { binding, person };
  });
  const original = { source: { gameId: 'game' }, fixture: { careerId: 'career', competitionEditionId: 'edition', gameDay: 121,
    homeClubId: 'JP', awayClubId: 'KR', fixtureEventId: 'fixture' }, participants: bindings.map(binding => ({ binding })) };
  const proof = vi.spyOn(national, 'assertNationalMatchBindings').mockImplementation((connection, values) => {
    if (connection.prepare('SELECT valid FROM fixture_original_national').get()!.valid !== 1) throw new Error('original National proof changed');
    for (const value of values) expect(value).toEqual(bindings.find(b => b.playerId === value.playerId));
    return original as unknown as national.DurableNationalMatchOrigin;
  });
  const applied = { playId: 8, half: 'bottom' }, receipt = { applicationId: 'apply', closureId: 'close', previousPlayId: 7, durableRevision: 1, appliedMatchState: applied };
  // Successor is deliberately the opposite half. It cannot provide participants.
  const activation = { applicationId: 'apply', closureId: 'close', previousPlayId: 7, nextMatchState: applied };
  const nextWorld = { defenders: [{ playerId: 'incoming-unbound' }] }, result = { applicationId: 'apply', closureId: 'close', gameId: 'game' };
  const official = final ? { receipt, result } : { receipt, activation, nextWorld };
  const application = { applicationId: 'apply', matchId: 'game', expectedDurableRevision: 0, match: { playId: 7, half: 'top' } };
  const seasonFixture = { careerId: 'career', seasonId: 'edition', game: { gameId: 'game', homeClubId: 'JP', awayClubId: 'KR' } };
  const p = { source: { sourceId: 'close' }, gameId: 'game', playId: 7, application, expectedOfficial: official,
    fixture: { fixture_event_id: 'fixture' }, seasonFixture, actors,
    workload: { participants: bindings.map((b, i) => ({ playerId: b.playerId, personId: b.personId, clubId: b.clubId,
      role: i ? 'DEFENDER' : 'BATTER_RUNNER' })) } };
  db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?,?,?,?,?)').run('close', 'apply', 'game', 7, json(p.source), json(p), json({ official }));
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply', 'game', 'close', hash(application), json(official));
  db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game', 1, json(applied), json(final ? { finalResult: result } : { activation, nextWorld }));
  vi.spyOn(live, 'actualLivePlayClosureEvidenceFromSqlite').mockReturnValue({ read: () => ({ proposal: p,
    status: 'OFFICIAL_APPLIED', officialApplied: true, result: { official } }) } as unknown as ReturnType<typeof live.actualLivePlayClosureEvidenceFromSqlite>);
  vi.spyOn(terminal, 'foulTerminalPostPlayCompletionEvidenceFromSqlite').mockReturnValue({ read: () => ({
    proposal: { gameId: 'game', playId: 7, source: { sourceId: 'close', applicationId: 'apply' }, originalOfficialRevision: 0,
      applicationBody: { match: application.match }, seasonFixture: { ...seasonFixture, competitionEditionId: 'edition' },
      participants: bindings.map((binding, i) => ({ binding, role: i ? 'defender' : 'batter' })) },
    result: { official: { receipt }, completion: final ? { finalResult: result } : { activation, nextWorld } },
  }) } as unknown as ReturnType<typeof terminal.foulTerminalPostPlayCompletionEvidenceFromSqlite>);
  const confirm = (player = 'p0', owner = store) => kind === 'live' ? owner.confirmNationalActualLivePlayed('game', player, 'close')
    : owner.confirmNationalFoulTerminalPlayed('game', player, 'close');
  const domestic = () => kind === 'live' ? store.confirmActualLivePlayed('game', 'p2', 'close') : store.confirmFoulTerminalPlayed('game', 'p2', 'close');
  return { db, store, path, confirm, domestic, bindings, proof };
};

it.each(['live', 'foul'] as const)('retains original %s participants across a half change, historical retry and reopen', kind => {
  const f = fixture(kind), first = f.confirm(), defender = f.confirm('p1');
  expect(first.actorKind).toBe(kind === 'live' ? 'BATTER_RUNNER' : 'BATTER');
  expect(defender.actorKind).toBe('DEFENDER');
  expect(first.evidenceKind).toBe(kind === 'live' ? 'NATIONAL_ACTUAL_LIVE_V1' : 'NATIONAL_FOUL_TERMINAL_V1');
  expect(() => f.confirm('incoming-unbound')).toThrow('absent');
  expect(() => f.domestic()).toThrow('domestic');
  const bytes = f.db.prepare('SELECT * FROM official_participation_receipts ORDER BY receipt_id').all();
  f.db.prepare('UPDATE matches SET durable_revision=2,state_json=?').run(json({ later: true }));
  const reopened = new SqliteOfficialParticipationStore(f.path); cleanup.push(() => reopened.close());
  expect(f.confirm('p0', reopened)).toEqual(first);
  expect(reopened.readReceipt(first.receiptId)).toEqual(first);
  expect(() => f.confirm('p2', reopened)).toThrow(kind === 'live' ? 'written Match differs' : 'current Match');
  expect(f.db.prepare('SELECT * FROM official_participation_receipts ORDER BY receipt_id').all()).toEqual(bytes);
  f.db.exec('UPDATE fixture_original_national SET valid=0');
  expect(() => reopened.readReceipt(first.receiptId)).toThrow('original National proof changed');
  expect(() => f.confirm('p0', reopened)).toThrow('original National proof changed');
  expect(f.proof).toHaveBeenCalled();
});

it.each(['live', 'foul'] as const)('rolls back %s receipt admission if its original National proof changes inside INSERT', kind => {
  const f = fixture(kind);
  f.db.exec('CREATE TRIGGER corrupt_original AFTER INSERT ON official_participation_receipts BEGIN UPDATE fixture_original_national SET valid=0; END');
  expect(() => f.confirm()).toThrow('original National proof changed');
  expect(f.db.prepare('SELECT * FROM official_participation_receipts').all()).toEqual([]);
  expect(f.db.prepare('SELECT valid FROM fixture_original_national').get()).toEqual({ valid: 1 });
});

it.each(['live', 'foul'] as const)('keeps final %s original participants and refuses domestic rehabilitation', kind => {
  const f = fixture(kind, true), receipt = f.confirm();
  expect(receipt.binding.side).toBe('AWAY');
  expect(() => captureClinicalGameRows(f.db, { careerId: 'career', playerId: 'p0' } as never, receipt.receiptId, 'roster'))
    .toThrow('eligible domestic REHAB fixture');
  f.db.exec('UPDATE matches SET durable_revision=2');
  expect(() => f.store.readReceipt(receipt.receiptId)).toThrow(/Match differs/);
});

it('uses the original National fixture without requiring a domestic season table', () => {
  const f = fixture('live');
  expect(readActualLiveOriginalFixture(f.db, 'game', f.bindings)).toEqual({ careerId: 'career', seasonId: 'edition',
    game: { gameId: 'game', homeClubId: 'JP', awayClubId: 'KR' } });
  f.db.exec('UPDATE fixture_original_national SET valid=0');
  expect(() => readActualLiveOriginalFixture(f.db, 'game', f.bindings)).toThrow('original National proof changed');
});
