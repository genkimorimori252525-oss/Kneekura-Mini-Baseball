import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { deriveOfficialPlayerOutcomeFromSqlite as derive } from './OfficialPlayerOutcomeEvidenceFromSqlite';

// Dispatch/attribution tests substitute lower owners explicitly. Genuine
// National proof remains in NAT-N01, not in these tiny database examples.
const state = vi.hoisted(() => ({ values: new Map<string, unknown>(), completed: vi.fn(), foulPair: vi.fn(), live: vi.fn(), scored: vi.fn(), scorerRead: vi.fn() }));
vi.mock('./PhysicalPlayClosureEvidenceFromSqlite', () => ({ readPhysicalClosureProposal: () => state.values.get('physical') }));
vi.mock('./CompletedPlayParticipationEvidenceFromSqlite', () => ({ deriveCompletedPlayParticipationEvidence: (...args: unknown[]) => {
  state.completed(...args); return { receipt: { original: 'completed-proof' } };
}, deriveCompletedFoulBatterParticipationWithOriginal: (...args: unknown[]) => {
  state.foulPair(...args); return { original: state.values.get('foul'), evidence: { receipt: { original: 'completed-proof' } } };
} }));
vi.mock('./ActualLiveParticipationEvidenceFromSqlite', () => ({ deriveActualLiveParticipationEvidence: (...args: unknown[]) => {
  state.live(...args); return { receipt: { original: 'live-proof' } };
} }));
vi.mock('./ActualLivePlayClosureEvidenceFromSqlite', () => ({ actualLivePlayClosureEvidenceFromSqlite: () => ({ read: () => state.values.get('live') }) }));
vi.mock('./ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite', () => ({ foulTerminalPostPlayCompletionEvidenceFromSqlite: () => ({ read: () => state.values.get('foul') }) }));
vi.mock('./SamePlateAppearanceTerminalTransitionFromSqlite', () => ({ readSamePaTransitionArchive: () => state.values.get('transition'),
  readSamePaTerminalTransitionFromSqlite: () => state.values.get('transition-proof') }));
vi.mock('./SamePlateAppearanceTerminalEndpointFromSqlite', () => ({ readSamePaTerminalEndpointFromSqlite: () => state.values.get('endpoint') }));
vi.mock('./SamePlateAppearanceTerminalSettlementFromSqlite', () => ({ readSamePaTerminalReleaseFromSqlite: () => state.values.get('release') }));
vi.mock('./PhysicalPlateAppearanceActorEvidenceFromSqlite', async importOriginal => ({
  ...await importOriginal<typeof import('./PhysicalPlateAppearanceActorEvidenceFromSqlite')>(),
  readPhysicalActorForPlayFromSqlite: () => state.values.get('actor'),
}));
vi.mock('./SqliteOfficialInitialWorldStore', () => ({ readOfficialActorPersonLink: (_db: unknown, b: OfficialParticipantBinding) => ({ personId: b.personId }) }));
vi.mock('./NationalMatchOriginFromSqlite', () => ({ nationalBinding: (b: OfficialParticipantBinding) => 'nationalRegistrationEventId' in b,
  assertNationalMatchBindings: () => null }));
vi.mock('../SqliteOfficialScoringWriter', () => ({ createSqliteOfficialScoringWriter: () => ({ readAcceptedPlay: () => state.values.get('scored-play') }) }));
vi.mock('./ActualLiveScoringEvidenceFromSqlite', () => ({ actualLiveScoringEvidenceFromSqlite: () => ({ readSource: (sourceId: string) => {
  state.scorerRead(sourceId); return state.values.get('scorer');
} }),
  assertActualLiveScoringStage: (...args: unknown[]) => state.scored(...args) }));

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const databases: InstanceType<typeof DatabaseSync>[] = [];
beforeEach(() => { state.values.clear(); vi.clearAllMocks(); });
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const fixture = () => {
  const db = new DatabaseSync(':memory:'); databases.push(db);
  const binding = (playerId: string, side: 'HOME' | 'AWAY'): OfficialParticipantBinding => ({ gameId: 'game', careerId: 'career',
    competitionEditionId: 'season', gameDay: 5, clubId: side, side, playerId, personId: 'person-' + playerId,
    personLinkSourceId: 'link-' + playerId, rosterRevision: 0, fixtureEventId: 'fixture' });
  const batter = binding('batter', 'AWAY'), pitcher = binding('pitcher', 'HOME');
  const actor = { binding: batter, defenderBindings: [pitcher], world: { defenders: [{ playerId: 'pitcher', registeredPosition: 'P' }] } };
  const score = { scoringApplicationId: 'score', matchId: 'game', officialApplicationId: 'application', closureId: 'closure', sourceEventId: 'scorer',
    record: { playId: 7, closureId: 'closure', basisRulingId: 'ruling', classification: 'strikeout', battingTeam: 'away', runsScored: 0, hitsCredited: 0, errorsCharged: 0 } };
  const official = { receipt: { durableRevision: 1 } };
  state.values.set('actor', actor);
  const read = (owner: Parameters<typeof derive>[1]['owner']) => {
    db.exec('BEGIN');
    try { return derive(db, { owner, sourceId: 'closure' }); } finally { db.exec('ROLLBACK'); }
  };
  return { db, batter, pitcher, actor, score, official, read };
};
it('attributes the original batter and pitcher rather than successor-world actors', () => {
  const f = fixture();
  state.values.set('physical', { row: { status: 'COMPLETED' }, proposal: { physicalPitch: { frame: { gameId: 'game', batterActor: f.actor } },
    actors: [{ binding: { playerId: 'incoming-pitcher' } }], expectedScoring: f.score, expectedOfficial: f.official } });
  expect(f.read('physical_play_closures')).toMatchObject({ kind: 'attributed', batterPlayerId: 'batter', pitcherPlayerId: 'pitcher', classification: 'strikeout' });
  expect(state.completed.mock.calls[0].slice(1)).toEqual(['game', 'batter', 'closure', 'PHYSICAL_PLAY_V1']);
  const original = state.values.get('physical') as { proposal: { physicalPitch: { frame: { batterActor: unknown } } } };
  original.proposal.physicalPitch.frame.batterActor = null;
  expect(f.read('physical_play_closures')).toMatchObject({ kind: 'unavailable', reason: 'original_batter_missing' });
});
it('routes original National membership without domestic relabeling', () => {
  const f = fixture(); Object.assign(f.batter, { nationalRegistrationEventId: 'registration', nationalRosterSnapshotId: 'roster' });
  state.values.set('physical', { row: { status: 'COMPLETED' }, proposal: { physicalPitch: { frame: { gameId: 'game', batterActor: f.actor } },
    expectedScoring: f.score, expectedOfficial: f.official } });
  f.read('physical_play_closures');
  expect(state.completed.mock.calls[0][4]).toBe('NATIONAL_PHYSICAL_PLAY_V1');
});
it('requires the completed terminal scoring row and its exact original participants', () => {
  const f = fixture();
  f.db.exec('CREATE TABLE official_scoring_applications(scoring_application_id TEXT,result_json TEXT)');
  f.db.prepare('INSERT INTO official_scoring_applications VALUES(?,?)').run('score', json(f.score));
  const row = f.db.prepare('SELECT * FROM official_scoring_applications').get()!;
  state.values.set('foul', { proposal: { gameId: 'game', playId: 7, source: { applicationId: 'application' },
    scoring: { ...f.score.record, basisRulingId: 'different-physical-oracle-ruling' },
    participants: [{ role: 'batter', binding: f.batter }, { role: 'defender', registeredPosition: 'P', binding: f.pitcher }] },
    result: { official: f.official, completion: { scoringReference: { scoringApplicationId: 'score', rowHash: hash(row) } } } });
  expect(f.read('actual_foul_terminal_applications')).toMatchObject({ kind: 'attributed', classification: 'strikeout' });
  expect(state.foulPair).toHaveBeenCalledTimes(1);
  expect(state.foulPair).toHaveBeenCalledWith(f.db, 'closure');
  expect(state.completed).not.toHaveBeenCalled();
  f.db.prepare("UPDATE official_scoring_applications SET result_json='{}'").run();
  expect(() => f.read('actual_foul_terminal_applications')).toThrow('terminal scoring differs');
});
it('keeps an actual-live closure without supported scoring explicitly unavailable', () => {
  const f = fixture(); state.values.set('live', { status: 'OFFICIAL_APPLIED', result: {}, proposal: {
    gameId: 'game', playId: 7, application: { applicationId: 'application' }, expectedOfficial: f.official } });
  expect(f.read('actual_live_play_closures')).toMatchObject({ kind: 'unavailable', reason: 'supported_official_scoring_missing' });
});
it('requires a separately owned actual-live scoring record', () => {
  const f = fixture(), application = { applicationId: 'application' };
  f.db.exec('CREATE TABLE official_scoring_applications(scoring_application_id TEXT,official_application_id TEXT,request_json TEXT,result_json TEXT)');
  f.db.prepare('INSERT INTO official_scoring_applications VALUES(?,?,?,?)').run('score', 'application', json({ input: { officialApplication: application } }), json(f.score));
  state.values.set('live', { status: 'OFFICIAL_APPLIED', result: {}, proposal: { gameId: 'game', playId: 7, application, expectedOfficial: f.official } });
  state.values.set('scored-play', { application, scoring: f.score });
  state.values.set('scorer', { status: 'SCORED', result: f.score, proposal: { original: 'scorer-proof' } });
  expect(f.read('actual_live_play_closures')).toMatchObject({ kind: 'attributed', pitcherPlayerId: 'pitcher' });
  expect(state.scored).toHaveBeenCalledOnce();
  state.values.set('scorer', null);
  expect(() => f.read('actual_live_play_closures')).toThrow('accepted scorer owner is missing');
});
it('rejects deleted scoring when an original SCORED owner still requires it', () => {
  const f = fixture(), application = { applicationId: 'application' };
  f.db.exec('CREATE TABLE actual_live_scoring_sources(source_id TEXT,closure_id TEXT,official_application_id TEXT,source_json TEXT,proposal_json TEXT,result_json TEXT,game_id TEXT,play_id INTEGER)');
  f.db.prepare('INSERT INTO actual_live_scoring_sources VALUES(?,?,?,?,?,?,?,?)').run('scorer', 'closure', 'application',
    json({ closureReference: { sourceId: 'closure' } }), json({ application }), json(f.score), 'game', 7);
  state.values.set('live', { status: 'OFFICIAL_APPLIED', result: {}, proposal: { gameId: 'game', playId: 7, application, expectedOfficial: f.official } });
  const proposal = { application, playId: 7 };
  state.values.set('scorer', { source: { gameId: 'game', closureReference: { sourceId: 'closure' } }, status: 'SCORED', result: f.score, proposal });
  state.scored.mockImplementationOnce(() => { throw new Error('owned SCORED application is missing'); });
  expect(() => f.read('actual_live_play_closures')).toThrow('owned SCORED application is missing');
  expect(state.scored.mock.calls[0][2]).toBe(true);
});
it.each(['game_play_indexes', 'proposal_source', 'expected_score', 'original_receipt'] as const)(
  'authenticates surviving %s scorer ownership before reporting an absent score', remaining => {
    const f = fixture(), application = { applicationId: 'application' };
    f.db.exec('CREATE TABLE actual_live_scoring_sources(source_id TEXT,closure_id TEXT,official_application_id TEXT,source_json TEXT,proposal_json TEXT,result_json TEXT,game_id TEXT,play_id INTEGER)');
    const proposal = remaining === 'proposal_source' ? { source: { closureReference: { sourceId: 'closure' } } }
      : remaining === 'expected_score' ? { expectedScoring: { officialApplicationId: 'application' } }
        : remaining === 'original_receipt' ? { originalReceipt: { receipt: { closureId: 'closure' } } } : {};
    f.db.prepare('INSERT INTO actual_live_scoring_sources VALUES(?,?,?,?,?,?,?,?)').run('scorer', 'remapped-closure', 'remapped-application',
      '{}', json(proposal), '{}', remaining === 'game_play_indexes' ? 'game' : 'other', remaining === 'game_play_indexes' ? 7 : 99);
    state.values.set('live', { status: 'OFFICIAL_APPLIED', result: {}, proposal: { gameId: 'game', playId: 7, application, expectedOfficial: f.official } });
    state.scorerRead.mockImplementationOnce(() => { throw new Error('original scorer archive is corrupt'); });
    expect(() => f.read('actual_live_play_closures')).toThrow('original scorer archive is corrupt');
    expect(state.scorerRead).toHaveBeenCalledWith('scorer');
  });
it('attributes a completed reserved fair catch only after its original release', () => {
  const f = fixture(), reference = { owner: 'pa_terminal_v1_transitions', sourceId: 'closure' };
  const scoring = { ...f.score, record: { ...f.score.record, classification: 'fly_out' } };
  state.values.set('transition', { source: { terminalReference: {} }, lineage: { enrollmentReference: { sourceId: 'enrollment' } }, scoring });
  state.values.set('transition-proof', { kind: 'completed', reference, durableRevision: 1 });
  state.values.set('release', { transitionReference: reference });
  state.values.set('endpoint', { actor: f.actor });
  expect(f.read('pa_terminal_v1_transitions')).toMatchObject({ kind: 'attributed', classification: 'fly_out' });
  state.values.set('release', null);
  expect(() => f.read('pa_terminal_v1_transitions')).toThrow('reserved terminal is incomplete');
});
it('rejects cross-person or cross-fixture original attribution and non-Native readers', () => {
  const f = fixture(); Object.assign(f.pitcher, { fixtureEventId: 'other' });
  state.values.set('physical', { row: { status: 'COMPLETED' }, proposal: { physicalPitch: { frame: { gameId: 'game', batterActor: f.actor } },
    expectedScoring: f.score, expectedOfficial: f.official } });
  expect(() => f.read('physical_play_closures')).toThrow('participant scope differs');
  expect(() => derive({} as never, { owner: 'physical_play_closures', sourceId: 'closure' })).toThrow('owned Native transaction');
});
