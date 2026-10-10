import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { OfficialFairBallScoringEvidence, OfficialCaughtFoulScoringEvidence } from '../../core/adjudication/OfficialScoring';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { createPlayEndFact } from '../../core/rules/PhysicalRuleFacts';
import { resolveBatBallContact } from '../../core/sim/contact/BatBallContact';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact, recordFairBattedBall,
  recordFoulBattedBall, recordLiveBallPlayEnd } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { SqliteOfficialStateStore, type PersistOfficialPlayInput } from '../SqliteOfficialStateStore';
import { openSqliteOfficialScoringStore } from '../SqliteOfficialScoringStore';
import { actualLiveScoringInput } from './ActualLiveScoringSource';
import { deriveOfficialPlayerScoringFromSqlite } from './OfficialPlayerScoringEvidenceFromSqlite';
import type { OfficialPlayerOutcomeAttribution } from './OfficialPlayerOutcomeEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

// Real Native official/scoring archives, explicit closed Core fixtures. Player
// attribution is substituted; this is not full physical-origin qualification.
const fixture = (kind: 'choice' | 'catch') => {
  const directory = mkdtempSync(join(tmpdir(), 'scorer-judgment-')), path = join(directory, 'official.sqlite');
  const match: CanonicalMatchState = { ruleProfileId: asRuleProfileId('npb-2026'), inning: 4, half: 'top', outs: 0,
    balls: 0, strikes: 0, bases: { first: 'r1', second: null, third: 'r3' }, score: { away: 0, home: 1 }, playId: 7 };
  const contact = resolveBatBallContact(
    { tick: 150, position: { x: 0, y: 1, z: 0.06 }, velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 } },
    { pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
      linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 } });
  if (!contact) throw new Error('explicit contact fixture missing');
  const touch = recordBatBallContact(createCanonicalPlateAppearanceTimeline(match, 100), contact);
  const playEnd = createPlayEndFact(500, 'live_action_complete');
  const timeline = recordLiveBallPlayEnd(kind === 'choice' ? recordFairBattedBall(touch, 200) : recordFoulBattedBall(touch, 300, false,
    { kind: 'caught', batterRunnerId: 'batter', firstFielderTouchTick: 250, outTick: 300, secureCatchTick: 300 }), playEnd);
  const ruling = kind === 'choice' ? { outsAfter: 0, basesAfter: { first: 'batter', second: 'r1', third: 'r3' }, scoredRunnerIds: [] }
    : { outsAfter: 1, basesAfter: { first: 'r1', second: null, third: null }, scoredRunnerIds: ['r3'] };
  const ruled = recordCorrectRuleSnapshot(createPlayAdjudicationLedger({ playId: 7, ruleProfileId: match.ruleProfileId, playEnd }), 0,
    { eventId: 'rule', tick: 501, snapshotId: 'ruling', evidenceRevision: 1, ruling });
  const adjudication = closeOfficialPlay(ruled, 1, { eventId: 'close', closureId: 'closure', tick: 502 });
  const application: PersistOfficialPlayInput = { kind: 'live_ball', matchId: 'game', applicationId: 'official', expectedDurableRevision: 0,
    match, physicalTimeline: timeline, adjudication, nextStartedAtTick: 503,
    worldSetup: { baseCenters: { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
      defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const).map((registeredPosition, i) => ({
        playerId: `defender-${i}`, registeredPosition, position: { x: i, z: i } })), activePreviousPlayControllerIds: [] } };
  const common = { sourceEventId: 'scorer', scorerId: 'accepted-scorer', ruleProfileId: match.ruleProfileId, playId: 7,
    closureId: 'closure', basisRulingId: 'ruling', recordedAtTick: 503, contactSequence: 0, batterRunnerId: 'batter' };
  const evidence: OfficialFairBallScoringEvidence | OfficialCaughtFoulScoringEvidence = kind === 'choice'
    ? { ...common, schemaVersion: 2, sourceKind: 'official_scorer_judgment', fairSequence: 1,
      judgment: { kind: 'fielders_choice', attemptedPriorRunnerId: 'r1' }, playerStatistics: { rbiRunnerIds: [], sacrifice: 'bunt' } }
    : { ...common, schemaVersion: 1, sourceKind: 'official_caught_foul_scorer_judgment', catchSequence: 1,
      catcherPlayerId: 'defender-6', catcherRole: 'outfielder', playerStatistics: { rbiRunnerIds: ['r3'], sacrifice: 'fly' } };
  const official = new SqliteOfficialStateStore(path); official.initializeMatch('game', match); official.applyAndActivate(application); official.close();
  const db = new DatabaseSync(path);
  const original = () => ({ matches: db.prepare('SELECT * FROM matches').all(), applications: db.prepare('SELECT * FROM applications').all() });
  const source = (e = evidence) => ({ sourceId: 'scorer', sourceVersion: 'accepted-v1', gameId: 'game', scoringApplicationId: 'score',
    closureReference: { sourceId: 'closure', proposalHash: 'a'.repeat(64) }, evidence: e });
  return { path, db, application, evidence, source, original, close: () => { db.close(); rmSync(directory, { recursive: true, force: true }); } };
};

it.each(['choice', 'catch'] as const)('archives the explicit %s sacrifice and replays original AB/RBI after reopen', kind => {
  const f = fixture(kind); let store: ReturnType<typeof openSqliteOfficialScoringStore> | undefined;
  try {
    expect(actualLiveScoringInput(f.source(), 'scorer')).toEqual(f.source());
    const original = f.original();
    store = openSqliteOfficialScoringStore(f.path, { readAcceptedOfficialScoringEvidence: () => f.evidence });
    const request = { scoringApplicationId: 'score', officialApplication: f.application, sourceEventId: 'scorer' };
    const saved = store.apply(request);
    expect(saved.record).toMatchObject({ classification: kind === 'choice' ? 'fielders_choice' : 'foul_out',
      playerStatistics: { runsBattedIn: kind === 'choice' ? 0 : 1, sacrifice: kind === 'choice' ? 'bunt' : 'fly' } });
    const rows = f.db.prepare('SELECT * FROM official_scoring_applications').all(); store.close();
    store = openSqliteOfficialScoringStore(f.path);
    expect(store.apply(request)).toEqual(saved); expect(store.readAcceptedPlay('score')?.scoring).toEqual(saved);
    const attribution = { gameId: 'game', playId: 7, officialApplicationId: 'official', scoring: saved,
      classification: saved.record.classification, source: { owner: 'actual_live_play_closures', sourceId: 'closure' } } as OfficialPlayerOutcomeAttribution;
    f.db.exec('BEGIN');
    try {
      expect(deriveOfficialPlayerScoringFromSqlite(f.db, attribution)).toEqual({ atBats: { kind: 'known', value: 0 },
        runsBattedIn: { kind: 'known', value: kind === 'choice' ? 0 : 1 }, hitBases: { kind: 'known', value: 0 }, pitchingOuts: kind === 'choice' ? 0 : 1 });
    } finally { f.db.exec('ROLLBACK'); }
    expect(f.db.prepare('SELECT * FROM official_scoring_applications').all()).toEqual(rows); expect(f.original()).toEqual(original);
  } finally { store?.close(); f.close(); }
});
it('rejects unsuccessful FC without the original advancing runner and rejects legacy shape promotion', () => {
  const f = fixture('choice'); let store: ReturnType<typeof openSqliteOfficialScoringStore> | undefined;
  try {
    if (f.evidence.sourceKind !== 'official_scorer_judgment') throw new Error('fixture');
    const bad = { ...f.evidence, judgment: { kind: 'fielders_choice' as const, attemptedPriorRunnerId: 'r3' } };
    store = openSqliteOfficialScoringStore(f.path, { readAcceptedOfficialScoringEvidence: () => bad });
    expect(() => store!.apply({ scoringApplicationId: 'score', officialApplication: f.application, sourceEventId: 'scorer' }))
      .toThrow('unsuccessful choice');
    expect(f.db.prepare('SELECT * FROM official_scoring_applications').all()).toEqual([]);
    expect(() => actualLiveScoringInput({ ...f.source(), evidence: { ...f.evidence, schemaVersion: 1 } }, 'scorer')).toThrow();
  } finally { store?.close(); f.close(); }
});
it('rejects unsupported catch role, false runner awards and a mismatched original catch before scoring writes', () => {
  for (const patch of [{ catcherRole: 'other' }, { catchSequence: 0 }, { playerStatistics: { rbiRunnerIds: ['foreign'], sacrifice: 'fly' } }]) {
    const f = fixture('catch'); let store: ReturnType<typeof openSqliteOfficialScoringStore> | undefined;
    try {
      const bad = { ...f.evidence, ...patch } as OfficialCaughtFoulScoringEvidence;
      store = openSqliteOfficialScoringStore(f.path, { readAcceptedOfficialScoringEvidence: () => bad });
      expect(() => store!.apply({ scoringApplicationId: 'score', officialApplication: f.application, sourceEventId: 'scorer' }))
        .toThrow('caught-foul scorer');
      expect(f.db.prepare('SELECT * FROM official_scoring_applications').all()).toEqual([]);
    } finally { store?.close(); f.close(); }
  }
});
