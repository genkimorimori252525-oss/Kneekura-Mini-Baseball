import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertActualLiveClosureStage, type ActualLivePlayClosureProposal } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
// This small fixture tests only the existing-writer stage guard, not physical/adjudication ownership.
const p = { source: { sourceId: 'closure' }, application: { applicationId: 'apply', matchId: 'game' },
  expectedOfficial: { receipt: { durableRevision: 1, appliedMatchState: { playId: 2 } }, activation: { nextMatchState: { playId: 2 } }, nextWorld: { tick: 2 } } } as unknown as ActualLivePlayClosureProposal;
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-official-stage-')), 'state.sqlite'), db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE applications(application_id TEXT,match_id TEXT,closure_id TEXT,request_hash TEXT,result_json TEXT);
    CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);`);
  if (!('activation' in p.expectedOfficial)) throw new Error('fixture requires next activation');
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply', 'game', 'closure', hash(p.application), json(p.expectedOfficial));
  db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game', 1, json(p.expectedOfficial.activation.nextMatchState),
    json({ activation: p.expectedOfficial.activation, nextWorld: p.expectedOfficial.nextWorld }));
  return { path, db };
};
it('does not let a writer-local trigger hide corrupt Match payload by raising the durable revision', () => {
  const x = fixture();
  try {
    expect(assertActualLiveClosureStage(x.db, p, true, true)).toBe(true);
    x.db.exec('BEGIN IMMEDIATE');
    x.db.prepare('UPDATE matches SET durable_revision=?,state_json=?,activation_json=?').run(2, '{}', '{}');
    expect(() => assertActualLiveClosureStage(x.db, p, true, true)).toThrow(/written Match/);
    x.db.exec('ROLLBACK');
    expect(assertActualLiveClosureStage(x.db, p, true, true)).toBe(true);
  } finally { x.db.close(); }
  const reopened = new DatabaseSync(x.path);
  try { expect(assertActualLiveClosureStage(reopened, p, true, true)).toBe(true); } finally { reopened.close(); }
});
it('historical evidence reads do not claim that a later current head is this original write', () => {
  const x = fixture(); try {
    x.db.prepare('UPDATE matches SET durable_revision=?').run(2);
    expect(assertActualLiveClosureStage(x.db, p, true)).toBe(true);
    expect(() => assertActualLiveClosureStage(x.db, p, true, true)).toThrow(/written Match/);
  } finally { x.db.close(); }
});
it('rolls back a real official-store applications INSERT trigger that corrupts the new Match revision and payload', async () => {
  const { SqliteOfficialStateStore, deriveOfficialPlayResult } = await import('../SqliteOfficialStateStore');
  const { asRuleProfileId } = await import('../../core/model/RuleProfileRef');
  const { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, closeOfficialPlay } = await import('../../core/adjudication/PlayAdjudicationLedger');
  const path = join(mkdtempSync(join(tmpdir(), 'actual-official-trigger-')), 'state.sqlite');
  const match = { ruleProfileId: asRuleProfileId('npb-2026'), inning: 1, half: 'top' as const, outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 1 };
  const playEnd = { kind: 'play_end' as const, tick: 10, reason: 'live_action_complete' as const };
  const root = createPlayAdjudicationLedger({ playId: 1, ruleProfileId: match.ruleProfileId, playEnd });
  const ruled = recordCorrectRuleSnapshot(root, 0, { eventId: 'rule', tick: 10, snapshotId: 'rule', evidenceRevision: 1,
    ruling: { outsAfter: 1, basesAfter: match.bases, scoredRunnerIds: [] } });
  const ledger = closeOfficialPlay(ruled, ruled.revision, { eventId: 'closed', closureId: 'closure', tick: 11 });
  const application = { kind: 'live_ball' as const, matchId: 'game', applicationId: 'apply', expectedDurableRevision: 0,
    match, adjudication: ledger, nextStartedAtTick: 12, physicalTimeline: { playId: 1, startedAtTick: 0, lastEventTick: 10, nextSequence: 1,
      status: { kind: 'live_ball_complete' as const, count: { balls: 0, strikes: 0 }, contactTick: 1, playEndTick: 10,
        disposition: { kind: 'fair' as const, fairDeterminationTick: 2 } },
      events: [{ kind: 'LiveBallPlayEnded' as const, sequence: 0, tick: 10, payload: { playEnd } }] },
    worldSetup: { baseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } },
      activePreviousPlayControllerIds: [], defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const)
        .map((registeredPosition, i) => ({ playerId: `p${i}`, registeredPosition, position: { x: i, z: i } })) } };
  const proposal = { source: { sourceId: 'closure' }, application, expectedOfficial: deriveOfficialPlayResult(application, 1) } as unknown as ActualLivePlayClosureProposal;
  const official = new SqliteOfficialStateStore(path, (db, _input, phase) => {
    if (phase === 'written') assertActualLiveClosureStage(db, proposal, true, true);
  });
  const db = new DatabaseSync(path);
  try {
    official.initializeMatch('game', match);
    db.exec("CREATE TRIGGER corrupt_after_application AFTER INSERT ON applications BEGIN UPDATE matches SET durable_revision=2,state_json='{}',activation_json='{}' WHERE match_id='game'; END;");
    expect(() => official.applyAndActivate(application)).toThrow(/written Match/);
    expect(db.prepare('SELECT * FROM applications').all()).toEqual([]);
    expect(official.getMatch('game')).toMatchObject({ durableRevision: 0, matchState: match, activation: null });
    db.exec('DROP TRIGGER corrupt_after_application');
    expect(official.applyAndActivate(application)).toEqual(proposal.expectedOfficial);
  } finally { db.close(); official.close(); }
  const reopened = new SqliteOfficialStateStore(path);
  try { expect(reopened.applyAndActivate(application)).toEqual(proposal.expectedOfficial); expect(reopened.getMatch('game')!.durableRevision).toBe(1); }
  finally { reopened.close(); }
});
