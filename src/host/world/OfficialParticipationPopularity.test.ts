import { expect, it } from 'vitest';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { openSqlitePopularityHistoryStore, type PopularityStoreRequest } from './SqlitePopularityHistoryStore';
import { SqliteOfficialParticipationStore, officialParticipationEvidenceFromSqlite } from './SqliteOfficialParticipationStore';

const request = (eventId: string, playerId = 'p2'): PopularityStoreRequest => ({
  eventId, careerId: 'career-a', personId: `person-${playerId}`, playerId, expectedRevision: 0, asOfDay: 10,
  policy: { policyId: 'explicit-audience-fixture', version: 'v1', availableAtDay: 0,
    initialAwareness: 0, initialFavorability: 0.5, awarenessRate: 0.3, favorabilityRate: 0.2,
    maximumAwarenessStep: 0.1, maximumFavorabilityStep: 0.05 },
  evidence: [{ evidenceId: `audience-${playerId}`, sourceCareerEventId: eventId,
    audience: { kind: 'NATIONAL', scopeId: 'fixture-nation' }, observedAtDay: 10, availableAtDay: 10, reach: 0.8, response: 0.9 }],
});
const fixture = (initialClubId: string | null = 'club-a') => {
  const f = officialPitchWorkloadFixture(false);
  const receipt = f.participation.confirmPlayed('game-1', 'p2', 'DEFENDER', 'application-1', 'application-2');
  const store = f.track(openSqlitePopularityHistoryStore(f.path));
  store.initialize('career-a', 'person-p2', initialClubId);
  return { ...f, receipt, store, input: request(receipt.receiptId) };
};

it('persists original game exposure, borrows a query-only receipt reader, and retries after reopen without live authority', () => {
  const f = fixture();
  try {
    const original = f.db.prepare('SELECT * FROM official_participation_receipts').all();
    f.db.exec('PRAGMA query_only=ON');
    const reader = officialParticipationEvidenceFromSqlite(f.db);
    expect(Object.keys(reader)).toEqual(['readReceipt']);
    expect(reader.readReceipt(f.receipt.receiptId)).toEqual(f.receipt);
    f.db.exec('PRAGMA query_only=OFF');
    const saved = f.store.applyOfficialParticipation(f.input);
    expect(saved.source).toEqual({ kind: 'OFFICIAL_GAME', participationReceiptId: f.receipt.receiptId,
      personLinkSourceId: 'intake-p2', gameId: 'game-1', competitionEditionId: 'league-season-1' });
    expect(saved.history.processedEvents).toHaveLength(1);
    const event = f.participation.readAcceptedPopularityEvent(f.receipt.receiptId)!;
    expect(saved.history.processedEvents[0]).toMatchObject({ eventId: event.eventId, kind: event.kind,
      sourceRecordId: event.sourceRecordId, acceptedRevision: event.acceptedRevision, acceptedAtDay: event.acceptedAtDay });
    expect(saved.history.transfers).toEqual([]);
    expect(saved.history.observations.map(x => x.value)).toEqual([0.1, 0.55]);
    const reopened = f.track(openSqlitePopularityHistoryStore(f.path));
    expect(reopened.applyOfficialParticipation(f.input)).toEqual(saved);
    expect(reopened.readApplication(f.input.eventId)).toEqual(saved);
    expect(reopened.readHead('career-a', 'person-p2')).toEqual(saved.history);
    expect(() => reopened.apply(f.input)).toThrow('official participation');
    expect(() => reopened.applyOfficialParticipation({ ...f.input, asOfDay: 11 })).toThrow('different');
    expect(f.db.prepare('SELECT * FROM official_participation_receipts').all()).toEqual(original);
  } finally { f.close(); }
});

it('rejects absent participation, identity drift, stale revisions and missing observed exposure without writing', () => {
  const f = fixture();
  try {
    for (const invalid of [ { ...f.input, eventId: 'missing' }, { ...f.input, playerId: 'foreign' },
      { ...f.input, expectedRevision: 1 }, { ...f.input, evidence: [] }, { ...f.input, asOfDay: 9 } ]) {
      expect(() => f.store.applyOfficialParticipation(invalid)).toThrow();
      expect(f.store.readHead('career-a', 'person-p2')?.revision).toBe(0);
    }
    expect(f.store.readApplication(f.input.eventId)).toBeNull();
  } finally { f.close(); }
});

it('revalidates the private original receipt and Person on application, retry and historical head reads', () => {
  const f = fixture();
  try {
    f.store.applyOfficialParticipation(f.input);
    const row = f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(f.receipt.receiptId)!;
    f.db.prepare("UPDATE official_participation_receipts SET receipt_json=json_set(receipt_json,'$.playedPlayId',999)").run();
    for (const read of [() => f.store.readApplication(f.input.eventId), () => f.store.readHead('career-a', 'person-p2'),
      () => f.store.applyOfficialParticipation(f.input)]) expect(read).toThrow();
    f.db.prepare('UPDATE official_participation_receipts SET receipt_json=? WHERE receipt_id=?').run(row.receipt_json, f.receipt.receiptId);
    const link = f.db.prepare("SELECT source_json FROM world_player_person_links WHERE source_id='intake-p2'").get()!;
    f.db.prepare("UPDATE world_player_person_links SET person_id='foreign' WHERE source_id='intake-p2'").run();
    expect(() => f.store.readHead('career-a', 'person-p2')).toThrow();
    f.db.prepare("UPDATE world_player_person_links SET person_id='person-p2',source_json=? WHERE source_id='intake-p2'").run(link.source_json);
    expect(f.store.readHead('career-a', 'person-p2')?.revision).toBe(1);
  } finally { f.close(); }
});

it('rolls back the real head and receipt when an INSERT trigger changes original participation evidence', () => {
  const f = fixture();
  try {
    f.db.exec(`CREATE TRIGGER replace_original AFTER INSERT ON popularity_event_applications BEGIN
      UPDATE official_participation_receipts SET receipt_json=json_set(receipt_json,'$.playedPlayId',999); END;`);
    expect(() => f.store.applyOfficialParticipation(f.input)).toThrow();
    expect(f.store.readHead('career-a', 'person-p2')?.revision).toBe(0);
    expect(f.store.readApplication(f.input.eventId)).toBeNull();
    expect(f.participation.readReceipt(f.input.eventId)).toEqual(f.receipt);
    f.db.exec('DROP TRIGGER replace_original');
    expect(f.store.applyOfficialParticipation(f.input).history.revision).toBe(1);
  } finally { f.close(); }
});

it('persists an ordinary physical batter receipt through the same original tagged owner', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId); x.close();
    const receipt = x.f.participation.confirmPhysicalPlayed('game-1', 'away-1', 'close-1');
    const store = x.f.track(openSqlitePopularityHistoryStore(x.f.path));
    store.initialize('career-a', 'person-away-1', 'club-b');
    const saved = store.applyOfficialParticipation(request(receipt.receiptId, 'away-1'));
    expect(saved.history.processedEvents[0].kind).toBe('OFFICIAL_GAME');
    expect(store.readApplication(receipt.receiptId)).toEqual(saved);
    expect(store.applyOfficialParticipation(request(receipt.receiptId, 'away-1'))).toEqual(saved);
  } finally { x.f.close(); }
});

it('shares the existing history with prior transfer exposure without rewriting legacy application bytes', () => {
  const f = officialPitchWorkloadFixture(false);
  try {
    const receipt = f.participation.confirmPlayed('game-1', 'p2', 'DEFENDER', 'application-1', 'application-2');
    const store = f.track(openSqlitePopularityHistoryStore(f.path, { readAcceptedFreeAgentRightsEvent: () => ({
      personId: 'person-p2', playerId: 'p2', personLinkSourceId: 'intake-p2', rightsEvent: {
        type: 'FREE_AGENT_RIGHTS_ACQUIRED', eventId: 'rights-p2', careerId: 'career-a', clubId: 'club-a', playerId: 'p2',
        contractId: 'contract-p2', decisionId: 'decision-p2', acceptanceId: 'acceptance-p2', sourceClubEventId: 'club-event-p2',
        effectiveDay: 5, beforeRevision: 0, afterRevision: 1, beforeRights: { rightsHolderClubId: null, contractId: null },
        afterRights: { rightsHolderClubId: 'club-a', contractId: 'contract-p2' },
      },
    }) }));
    store.initialize('career-a', 'person-p2', null);
    const transfer = store.apply({ ...request('rights-p2'), evidence: [{ ...request('rights-p2').evidence[0], evidenceId: 'transfer-audience' }] });
    const before = f.db.prepare("SELECT * FROM popularity_event_applications WHERE event_id='rights-p2'").get();
    const game = store.applyOfficialParticipation({ ...request(receipt.receiptId), expectedRevision: 1 });
    expect(game.history.transfers).toEqual(transfer.history.transfers);
    expect(game.history.processedEvents.map(event => event.kind)).toEqual(['TRANSFER', 'OFFICIAL_GAME']);
    expect(store.readApplication('rights-p2')).toEqual(transfer);
    expect(store.readHead('career-a', 'person-p2')).toEqual(game.history);
    expect(f.db.prepare("SELECT * FROM popularity_event_applications WHERE event_id='rights-p2'").get()).toEqual(before);
    expect(() => store.applyOfficialParticipation({ ...request('rights-p2'), expectedRevision: 0 })).toThrow('different');
  } finally { f.close(); }
});

const transferAfterGameFixture = () => {
  const f = fixture(null);
  const game = f.store.applyOfficialParticipation(f.input);
  const store = f.track(openSqlitePopularityHistoryStore(f.path, { readAcceptedFreeAgentRightsEvent: () => ({
    personId: 'person-p2', playerId: 'p2', personLinkSourceId: 'intake-p2', rightsEvent: {
      type: 'FREE_AGENT_RIGHTS_ACQUIRED', eventId: 'later-rights-p2', careerId: 'career-a', clubId: 'club-b', playerId: 'p2',
      contractId: 'contract-later-p2', decisionId: 'later-decision', acceptanceId: 'later-acceptance', sourceClubEventId: 'later-club-event',
      effectiveDay: 11, beforeRevision: 1, afterRevision: 2, beforeRights: { rightsHolderClubId: null, contractId: null },
      afterRights: { rightsHolderClubId: 'club-b', contractId: 'contract-later-p2' },
    },
  }) }));
  const input = { ...request('later-rights-p2'), expectedRevision: 1, asOfDay: 11,
    evidence: [{ ...request('later-rights-p2').evidence[0], evidenceId: 'later-transfer-audience', observedAtDay: 11, availableAtDay: 11 }] };
  return { ...f, game, transferStore: store, transferInput: input };
};

it('rolls back a legacy transfer when its INSERT corrupts an earlier official participation source', () => {
  const f = transferAfterGameFixture();
  try {
    const snapshot = () => JSON.stringify(['popularity_heads', 'popularity_event_applications', 'official_participation_receipts']
      .map(table => f.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
    const before = snapshot();
    f.db.exec(`CREATE TRIGGER corrupt_earlier_game AFTER INSERT ON popularity_event_applications
      WHEN NEW.event_id='later-rights-p2' BEGIN
      UPDATE official_participation_receipts SET receipt_json=json_set(receipt_json,'$.playedPlayId',999); END;`);
    expect(() => f.transferStore.apply(f.transferInput)).toThrow();
    expect(snapshot()).toBe(before);
    expect(f.transferStore.readHead('career-a', 'person-p2')).toEqual(f.game.history);
    expect(f.transferStore.readApplication(f.transferInput.eventId)).toBeNull();
    f.db.exec('DROP TRIGGER corrupt_earlier_game');
    const transfer = f.transferStore.apply(f.transferInput);
    expect(transfer.history.revision).toBe(2);
    expect(f.transferStore.apply(f.transferInput)).toEqual(transfer);
  } finally { f.close(); }
});

it('reauthenticates the original official prefix on legacy application reads and exact retries after reopen', () => {
  const f = transferAfterGameFixture();
  try {
    const transfer = f.transferStore.apply(f.transferInput);
    const original = f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(f.receipt.receiptId)!;
    const transferBytes = f.db.prepare('SELECT * FROM popularity_event_applications WHERE event_id=?').get(f.transferInput.eventId);
    const reopened = f.track(openSqlitePopularityHistoryStore(f.path));
    expect(reopened.readApplication(f.transferInput.eventId)).toEqual(transfer);
    expect(reopened.apply(f.transferInput)).toEqual(transfer);
    f.db.prepare("UPDATE official_participation_receipts SET receipt_json=json_set(receipt_json,'$.playedPlayId',999)").run();
    expect(() => reopened.readHead('career-a', 'person-p2')).toThrow();
    expect(() => reopened.readApplication(f.transferInput.eventId)).toThrow();
    expect(() => reopened.apply(f.transferInput)).toThrow();
    expect(f.db.prepare('SELECT * FROM popularity_event_applications WHERE event_id=?').get(f.transferInput.eventId)).toEqual(transferBytes);
    f.db.prepare('UPDATE official_participation_receipts SET receipt_json=? WHERE receipt_id=?').run(original.receipt_json, f.receipt.receiptId);
    expect(reopened.readApplication(f.transferInput.eventId)).toEqual(transfer);
    expect(reopened.apply(f.transferInput)).toEqual(transfer);
    expect(f.db.prepare('SELECT * FROM popularity_event_applications WHERE event_id=?').get(f.transferInput.eventId)).toEqual(transferBytes);
  } finally { f.close(); }
});

it('authenticates earlier official games when reading, retrying or inserting a later official application', () => {
  const f = fixture();
  try {
    const first = f.store.applyOfficialParticipation(f.input);
    f.official.registerOfficialFixture({ ...f.fixtureBinding, gameId: 'game-2', fixtureEventId: 'fixture-2' });
    const participation = f.track(new SqliteOfficialParticipationStore(f.path, { ...f.authority, readGame: gameId => {
      const original = f.authority.readGame('game-1');
      return gameId === 'game-2' && original ? { ...original, fixtureEventId: 'fixture-2' } : null;
    } }));
    participation.bindPregame({ ...f.receipt.binding, gameId: 'game-2', fixtureEventId: 'fixture-2' });
    f.official.initializeMatch('game-2', f.initial);
    // The same tiny scripted two-play input is submitted to the actual second
    // Match owner with distinct application identities; no receipt is copied.
    for (const [index, original] of [f.firstInput, f.secondInput].entries()) {
      const input = JSON.parse(JSON.stringify(original).replaceAll(`application-${index + 1}`, `second-application-${index + 1}`));
      f.official.applyAndActivate({ ...input, matchId: 'game-2' });
    }
    const second = participation.confirmPlayed('game-2', 'p2', 'DEFENDER', 'second-application-1', 'second-application-2');
    const input = { ...request(second.receiptId), expectedRevision: 1,
      evidence: [{ ...request(second.receiptId).evidence[0], evidenceId: 'second-game-audience' }] };
    f.db.exec(`CREATE TRIGGER corrupt_first_game AFTER INSERT ON popularity_event_applications WHEN NEW.from_revision=1 BEGIN
      UPDATE official_participation_receipts SET receipt_json=json_set(receipt_json,'$.playedPlayId',999) WHERE game_id='game-1'; END;`);
    expect(() => f.store.applyOfficialParticipation(input)).toThrow();
    expect(f.store.readHead('career-a', 'person-p2')).toEqual(first.history);
    expect(f.store.readApplication(second.receiptId)).toBeNull();
    f.db.exec('DROP TRIGGER corrupt_first_game');
    const saved = f.store.applyOfficialParticipation(input);
    expect(saved.history.revision).toBe(2);
    f.db.exec("UPDATE official_participation_receipts SET receipt_json=json_set(receipt_json,'$.playedPlayId',999) WHERE game_id='game-1'");
    expect(participation.readReceipt(second.receiptId)).toEqual(second);
    expect(() => f.store.readApplication(second.receiptId)).toThrow();
    expect(() => f.store.applyOfficialParticipation(input)).toThrow();
  } finally { f.close(); }
});
