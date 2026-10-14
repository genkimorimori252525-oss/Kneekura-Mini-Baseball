import { expect, it } from 'vitest';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { foulTerminalFinalCompletionTableSql } from './ActualFoulTerminalApplicationStorage';
import { deriveCompletedPlayParticipationEvidence } from './CompletedPlayParticipationEvidenceFromSqlite';

it('records original physical pitcher and batter facts and reopens their Career events without a live authority', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId); x.close();
    const pitcher = x.f.participation.confirmPhysicalPlayed('game-1', 'p2', 'close-1');
    const batter = x.f.participation.confirmPhysicalPlayed('game-1', 'away-1', 'close-1');
    expect(pitcher).toMatchObject({ evidenceKind: 'PHYSICAL_PLAY_V1', actorKind: 'DEFENDER', playedPlayId: x.f.initial.match.playId, durableRevision: 1 });
    expect(batter).toMatchObject({ evidenceKind: 'PHYSICAL_PLAY_V1', actorKind: 'BATTER', binding: { personId: 'person-away-1' } });
    expect(() => x.f.participation.confirmPhysicalPlayed('game-1', 'away-2', 'close-1')).toThrow('original');
    const before = x.f.db.prepare('SELECT * FROM official_participation_receipts ORDER BY receipt_id').all();
    const reopened = x.f.track(new SqliteOfficialParticipationStore(x.f.path));
    expect(reopened.readReceipt(batter.receiptId)).toEqual(batter);
    expect(reopened.confirmPhysicalPlayed('game-1', 'p2', 'close-1')).toEqual(pitcher);
    expect(reopened.readAcceptedPopularityEvent(batter.receiptId)).toMatchObject({ kind: 'OFFICIAL_GAME', personId: 'person-away-1', occurredAtDay: 10 });
    expect(x.f.db.prepare('SELECT * FROM official_participation_receipts ORDER BY receipt_id').all()).toEqual(before);
    expect(() => reopened.confirmActualLivePlayed('game-1', 'p2', 'close-1')).toThrow('recorded differently');
  } finally { x.f.close(); }
});

it('keeps accepted historical bytes after a later actual play while requiring the current completion for first admission', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId); x.close();
    const original = x.f.participation.confirmPhysicalPlayed('game-1', 'p2', 'close-1');
    const bytes = x.f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(original.receiptId);
    x.accepted.set('batter-2', { sourceId: 'batter-2', sourceVersion: 'fixture-v1', gameId: 'game-1', playerId: 'away-2', activationApplicationId: 'application-1' });
    x.actors.accept('batter-2');
    let tick = x.f.official.getMatch('game-1')!.nextWorld!.tick;
    for (let i = 0; i < 3; i++) {
      const { initialWorldSourceId: _initial, ...recipe } = continuousPitchAction(x.f, i, tick) as AcceptedPhysicalPitchActionSource & { initialWorldSourceId: string };
      const source = { ...recipe, sourceId: `second-pitch-${i}`, activationApplicationId: 'application-1', request: { ...recipe.request, workloadRevision: 1 } };
      x.actions.set(source.sourceId, source); tick = x.pitches.accept(source.sourceId, i).result.pitch.resolution.timeline.lastEventTick;
    }
    const closing = { ...x.closeInput(tick, 'second-pitch-2'), sourceId: 'close-2', applicationId: 'application-2', scoringApplicationId: 'scoring-2', snapshotId: 'rule-2' };
    x.closes.set(closing.sourceId, closing); x.closure.submit(closing.sourceId);
    const reopened = x.f.track(new SqliteOfficialParticipationStore(x.f.path));
    expect(reopened.readReceipt(original.receiptId)).toEqual(original);
    expect(reopened.confirmPhysicalPlayed('game-1', 'p2', 'close-1')).toEqual(original);
    expect(() => reopened.confirmPhysicalPlayed('game-1', 'home-1', 'close-1')).toThrow('current Match');
    expect(() => reopened.confirmPhysicalPlayed('game-1', 'p2', 'close-2')).toThrow('recorded differently');
    expect(reopened.confirmPhysicalPlayed('game-1', 'away-2', 'close-2').actorKind).toBe('BATTER');
    expect(x.f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(original.receiptId)).toEqual(bytes);
  } finally { x.f.close(); }
});

it('requires original completion and rejects a raw same-game/play alias without treating next actors as participants', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId); x.close();
    const row = x.f.db.prepare('SELECT * FROM physical_play_closures WHERE source_id=?').get('close-1')!;
    x.f.db.prepare("UPDATE physical_play_closures SET status='PENDING', result_json=NULL WHERE source_id='close-1'").run();
    expect(() => x.f.participation.confirmPhysicalPlayed('game-1', 'p2', 'close-1')).toThrow('completed original');
    x.f.db.prepare("UPDATE physical_play_closures SET status='COMPLETED', result_json=? WHERE source_id='close-1'").run(row.result_json);
    const foreign = { ...row, source_id: 'foreign-source', application_id: 'foreign-application', scoring_application_id: 'foreign-scoring',
      game_id: 'foreign-game', play_id: 900, source_json: '{}', proposal_json: '{"application":{"matchId":"game-1","match":{"playId":7}}}', result_json: '{}' };
    const keys = Object.keys(foreign);
    x.f.db.prepare(`INSERT INTO physical_play_closures (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
      .run(...keys.map(key => foreign[key as keyof typeof foreign]));
    expect(() => x.f.participation.confirmPhysicalPlayed('game-1', 'p2', 'close-1')).toThrow('ownership');
    expect(x.f.db.prepare('SELECT count(*) AS n FROM official_participation_receipts').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it.each(['POST_PLAY_COMPLETED_CONTINUING', 'POST_PLAY_COMPLETED_FINAL'])('rejects forged %s without manufacturing terminal participation', status => {
  const f = officialPitchWorkloadFixture(false, true);
  try {
    f.db.exec(foulTerminalFinalCompletionTableSql);
    f.db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      'terminal', 'game-1', 7, 'terminal-application', 'pitch', 'end', 'obligation', status, '{}', 'bad', '{}', 'bad', '{}');
    expect(() => f.participation.confirmFoulTerminalPlayed('game-1', 'p2', 'terminal')).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM official_participation_receipts').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('rejects a structural SQLite lookalike before any completed-owner read', () => {
  let reads = 0;
  expect(() => deriveCompletedPlayParticipationEvidence({ prepare() { reads++; throw new Error('unexpected read'); } },
    'game', 'player', 'closure', 'PHYSICAL_PLAY_V1')).toThrow('Native owner transaction');
  expect(reads).toBe(0);
});

it('rolls back participation when original completion changes after its real receipt INSERT', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId); x.close();
    const mutation = witnessSqliteWrite(/INSERT INTO official_participation_receipts/, db => {
      db.prepare("UPDATE physical_play_closures SET status='PENDING', result_json=NULL WHERE source_id='close-1'").run();
      return true;
    });
    try {
      expect(() => x.f.participation.confirmPhysicalPlayed('game-1', 'p2', 'close-1')).toThrow();
      expect(mutation.wasReached()).toBe(true);
    } finally { mutation.close(); }
    expect(x.f.db.prepare('SELECT count(*) AS n FROM official_participation_receipts').get()).toEqual({ n: 0 });
    expect(x.closure.read('close-1')!.status).toBe('COMPLETED');
    expect(x.f.participation.confirmPhysicalPlayed('game-1', 'p2', 'close-1').actorKind).toBe('DEFENDER');
  } finally { x.f.close(); }
});

it('does not infer a batter identity or running action from a pitch-only original frame', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.close();
    expect(x.f.participation.confirmPhysicalPlayed('game-1', 'p2', 'close-1').actorKind).toBe('DEFENDER');
    expect(() => x.f.participation.confirmPhysicalPlayed('game-1', 'away-1', 'close-1')).toThrow('absent from original');
  } finally { x.f.close(); }
});
