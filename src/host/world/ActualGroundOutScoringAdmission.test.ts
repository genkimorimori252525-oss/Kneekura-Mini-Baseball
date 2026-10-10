// Small Native contracts. Original registration, Match, scoring transactions,
// and archive consumers are real; the complete physical closure and sidecar
// readers below are explicitly substituted. NAT-N01 owns genuine composition.
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { actualGroundOutScoringFixture } from '../../core/adjudication/ActualGroundOutScoring.test-support';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore } from './SqlitePhysicalPlateAppearanceActorStore';
import { openSqliteOfficialScoringStore, type OfficialGroundOutScoringEvidence } from '../SqliteOfficialScoringStore';
import type { PersistOfficialPlayInput } from '../SqliteOfficialStateStore';
import { openSqliteActualLiveScoringStore } from './SqliteActualLiveScoringStore';
import { actualLiveScoringInput, type AcceptedActualLiveScoringSource } from './ActualLiveScoringSource';
import { readPhysicalClosureScoringHistory } from './PhysicalPlayClosureEvidenceFromSqlite';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as closureOwner from './ActualLivePlayClosureEvidenceFromSqlite';
import * as groundOwner from './ActualGroundOutScoringEvidenceFromSqlite';
import * as adjudicationOwner from './ActualPostPlayReviewClosureFromSqlite';
import { assertFoulTerminalPriorActivation, withFoulTerminalOriginalScope } from './FoulTerminalCompletionAncestryGuard';

const cleanup: (() => void)[] = [];
afterEach(() => { try { while (cleanup.length) cleanup.pop()!(); } finally { vi.restoreAllMocks(); } });
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'kneekura-ground-score-')), 'owner.sqlite');
  const f = officialPitchWorkloadFixture(false, true, path, true, undefined, { ruleProfileId: asRuleProfileId('npb-2026') });
  cleanup.push(f.close);
  const core = actualGroundOutScoringFixture(0, 3, 2, { match: f.initial, batterId: 'away-1', defenderId: 'p2' });
  const application: PersistOfficialPlayInput = { kind: 'live_ball', matchId: 'game-1', applicationId: 'ground-application',
    expectedDurableRevision: 0, match: core.match, physicalTimeline: core.timeline, adjudication: core.adjudication,
    nextStartedAtTick: 5_000_004, worldSetup: f.firstInput.worldSetup };
  const evidence: OfficialGroundOutScoringEvidence = { schemaVersion: 1, sourceKind: 'owned_ground_out',
    sourceEventId: 'ground-source', ground: core.evidence };
  const request = { scoringApplicationId: 'ground-score', officialApplication: application, sourceEventId: evidence.sourceEventId };
  return { f, core, application, evidence, request };
};
const actualFixture = () => {
  const h = fixture(), { f } = h, official = f.official.applyAndActivate(h.application);
  const closureSource = { sourceId: 'closure-1', applicationId: h.application.applicationId };
  const proposal = { source: closureSource, gameId: 'game-1', playId: h.core.match.playId, application: h.application,
    expectedOfficial: official, physicalEndReference: { sourceId: 'fixture-end', snapshotHash: 'a'.repeat(64) },
    wholeHistoryReference: { sourceId: 'fixture-history', snapshotHash: 'b'.repeat(64) },
    adjudicationReference: { sourceId: 'fixture-adjudication', snapshotHash: 'c'.repeat(64) },
    workload: { participants: [{ role: 'BATTER_RUNNER', playerId: 'away-1' }, { role: 'DEFENDER', playerId: 'p2' }] } };
  f.db.exec(`CREATE TABLE actual_live_play_closures(source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,
    source_json TEXT,proposal_json TEXT,result_json TEXT);
    CREATE TABLE fixture_ground_sidecar(evidence_json TEXT NOT NULL);`);
  f.db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?,?,?,?,?)').run('closure-1', 'game-1', h.core.match.playId,
    h.application.applicationId, json(closureSource), json(proposal), json({ sourceId: 'closure-1', official }));
  f.db.prepare('INSERT INTO fixture_ground_sidecar VALUES(?)').run(json(h.evidence));
  vi.spyOn(closureOwner, 'actualLivePlayClosureEvidenceFromSqlite').mockImplementation(db => ({ read: sourceId => {
    const row = db.prepare('SELECT source_json,proposal_json FROM actual_live_play_closures WHERE source_id=?').get(sourceId);
    // Deliberately substituted lower physical owner, not genuine source proof.
    return row ? { source: JSON.parse(String(row.source_json)), proposal: JSON.parse(String(row.proposal_json)),
      status: 'OFFICIAL_APPLIED', officialApplied: true, result: {} } as NonNullable<ReturnType<ReturnType<typeof closureOwner.actualLivePlayClosureEvidenceFromSqlite>['read']>> : null;
  } }));
  vi.spyOn(groundOwner, 'deriveActualGroundOutScoringEvidence').mockImplementation(db => {
    const row = db.prepare('SELECT evidence_json FROM fixture_ground_sidecar').get();
    if (!row) throw new Error('fixture original sidecar missing');
    return JSON.parse(String(row.evidence_json)) as OfficialGroundOutScoringEvidence;
  });
  const source: AcceptedActualLiveScoringSource = { sourceId: h.evidence.sourceEventId, sourceVersion: 'fixture-ground-v1',
    gameId: 'game-1', scoringApplicationId: 'ground-score', closureReference: { sourceId: 'closure-1', proposalHash: hash(proposal) },
    evidence: { schemaVersion: 1, sourceKind: 'owned_ground_out', sourceEventId: h.evidence.sourceEventId,
      playId: h.core.match.playId, closureId: 'closure-1', batterRunnerId: 'away-1' } };
  const owner = f.track(openSqliteActualLiveScoringStore(f.path, { readAcceptedScoringSource: () => source }));
  return { ...h, source, owner };
};

it('replays the exact ground sidecar through next-batter activation and later scoring history', () => {
  const h = fixture(), { f } = h;
  const setupSource = { sourceId: 'initial-world', sourceVersion: 'fixture-v1', gameId: 'game-1', fixtureEventId: 'fixture-1',
    startedAtTick: 0, worldSetup: f.firstInput.worldSetup };
  const initialWorlds = f.track(openSqliteOfficialInitialWorldStore(f.path, { matches: f.official, participation: f.participation },
    { readAcceptedSetup: () => setupSource }));
  initialWorlds.accept(setupSource.sourceId);
  const first = { sourceId: 'first-batter', sourceVersion: 'fixture-v1', gameId: 'game-1', playerId: 'away-1', initialWorldSourceId: setupSource.sourceId };
  const next = { sourceId: 'next-batter', sourceVersion: 'fixture-v1', gameId: 'game-1', playerId: 'away-2', activationApplicationId: h.application.applicationId };
  const sources = { matches: f.official, participation: f.participation, initialWorlds };
  const actors = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, sources,
    { readAcceptedActor: id => id === first.sourceId ? first : id === next.sourceId ? next : null }));
  actors.accept(first.sourceId);
  const official = f.official.applyAndActivate(h.application);
  const scoring = f.track(openSqliteOfficialScoringStore(f.path, { readAcceptedOfficialScoringEvidence: () => h.evidence }));
  const saved = scoring.apply(h.request);
  expect(saved.record).toMatchObject({ classification: 'ground_out', basisRulingId: 'assigned-call', hitsCredited: 0, errorsCharged: 0 });
  const history = () => readPhysicalClosureScoringHistory(f.db, { gameId: 'game-1', officialRevision: 1 });
  const row = f.db.prepare('SELECT request_json FROM official_scoring_applications WHERE scoring_application_id=?').get('ground-score')!;
  f.db.prepare("UPDATE official_scoring_applications SET request_json=json_set(request_json,'$.evidence.ground.race.outsAtStart',1)").run();
  expect(() => actors.accept(next.sourceId)).toThrow(/ground-out/);
  expect(() => history()).toThrow(/ground-out/);
  expect(() => scoring.apply(h.request)).toThrow(/corrupt/);
  f.db.prepare('UPDATE official_scoring_applications SET request_json=?').run(String(row.request_json));
  const activated = actors.accept(next.sourceId);
  expect(activated.match).toEqual(official.activation.nextMatchState);
  expect(history()).toMatchObject([{ scoring: saved }]);
  const reopened = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, sources));
  expect(reopened.read(next.sourceId)).toEqual(activated);
  const reopenedScorer = f.track(openSqliteOfficialScoringStore(f.path));
  expect(reopenedScorer.readApplication('ground-score')).toEqual(saved);
  expect(reopenedScorer.apply(h.request)).toEqual(saved);
});

it('derives the archived sidecar on owned connections and preserves exact retry after reopen', () => {
  const { f, owner, source, evidence } = actualFixture();
  const original = f.db.prepare('SELECT * FROM actual_live_play_closures').get();
  const result = owner.submit(source.sourceId);
  expect(result.record.classification).toBe('ground_out');
  expect(f.db.prepare('SELECT * FROM actual_live_play_closures').get()).toEqual(original);
  expect(JSON.parse(String(f.db.prepare('SELECT request_json FROM official_scoring_applications').get()!.request_json)).evidence).toEqual(evidence);
  owner.close();
  const reopened = f.track(openSqliteActualLiveScoringStore(f.path));
  expect(reopened.submit(source.sourceId)).toEqual(result);
  f.db.prepare("UPDATE fixture_ground_sidecar SET evidence_json=json_set(evidence_json,'$.ground.race.outsAtStart',1)").run();
  expect(() => reopened.read(source.sourceId)).toThrow(/ground-out/);
  expect(() => reopened.submit(source.sourceId)).toThrow(/ground-out/);
});

it('rolls back a scorer INSERT that changes the original physical sidecar on the writer connection', () => {
  const { f, owner, source, evidence } = actualFixture();
  owner.enqueue(source.sourceId);
  f.db.exec(`CREATE TRIGGER corrupt_ground_sidecar AFTER INSERT ON official_scoring_applications BEGIN
    UPDATE fixture_ground_sidecar SET evidence_json=json_set(evidence_json,'$.ground.race.outsAtStart',1); END;`);
  expect(() => owner.resume(source.sourceId)).toThrow(/ground-out/);
  expect(f.db.prepare('SELECT count(*) AS n FROM official_scoring_applications').get()).toEqual({ n: 0 });
  expect(f.db.prepare('SELECT evidence_json FROM fixture_ground_sidecar').get()!.evidence_json).toBe(json(evidence));
  expect(owner.read(source.sourceId)?.status).toBe('QUEUED');
});

it('rejects caller-provided histories or a replacement judgment in the minimal owned source', () => {
  const { source, evidence } = actualFixture();
  expect(actualLiveScoringInput(source, source.sourceId)).toEqual(source);
  for (const extra of [{ ground: evidence.ground }, { judgment: { kind: 'base_hit' } }]) {
    expect(() => actualLiveScoringInput({ ...source, evidence: { ...source.evidence, ...extra } }, source.sourceId)).toThrow(/ground-out/);
  }
});

it('restores the original live frame while deriving scoring inside a later terminal proof', () => {
  const { f, core } = fixture();
  vi.spyOn(adjudicationOwner, 'deriveActualLiveClosureAdjudicationWithInputs').mockImplementation(db => {
    assertFoulTerminalPriorActivation(db, 'game-1', core.match.playId - 1, core.match.playId);
    throw new Error('original live ancestry reached');
  });
  // Only the scope boundary is exercised; no physical owner result is supplied.
  const closure = { source: { sourceId: 'prior-live' }, gameId: 'game-1', playId: core.match.playId } as
    Parameters<typeof groundOwner.deriveActualGroundOutScoringEvidence>[1];
  expect(() => withFoulTerminalOriginalScope(f.db, 'later-terminal', 'game-1', core.match.playId + 1,
    () => groundOwner.deriveActualGroundOutScoringEvidence(f.db, closure, 'ground-source')))
    .toThrow('original live ancestry reached');
});
