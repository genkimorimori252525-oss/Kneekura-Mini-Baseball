import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot } from '../core/adjudication/PlayAdjudicationLedger';
import type { OfficialFairBallScoringEvidence } from
  '../core/adjudication/OfficialScoring';
import type { BetweenPlayWorldSetup } from
  '../core/adjudication/BetweenPlayWorldReset';
import type { CanonicalMatchState } from '../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../core/model/RuleProfileRef';
import { createPlayEndFact } from '../core/rules/PhysicalRuleFacts';
import { resolveBatBallContact } from '../core/sim/contact/BatBallContact';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact,
  recordCountedPitch, recordFoulBattedBall,
  recordFairBattedBall, recordLiveBallPlayEnd } from
  '../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { SqliteOfficialStateStore,
  type PersistOfficialFinalInput,
  type PersistOfficialPlayInput } from './SqliteOfficialStateStore';
import { openSqliteOfficialScoringStore } from
  './SqliteOfficialScoringStore';

const directories: string[] = [];
const databasePath = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-scoring-'));
  directories.push(directory);
  return join(directory, 'official.sqlite');
};
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-scoring-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const setup = (judgment: OfficialFairBallScoringEvidence['judgment']) => {
  const match: CanonicalMatchState = {
    ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 4, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: 'r1', second: null, third: null },
    score: { away: 2, home: 1 }, playId: 7,
  };
  const contact = resolveBatBallContact(
    { tick: 150, position: { x: 0, y: 1, z: 0.06 },
      velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 } },
    { pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
      linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 } },
  );
  if (contact === null) throw new Error('fixture must produce contact');
  const playEnd = createPlayEndFact(500, 'live_action_complete');
  const physicalTimeline = recordLiveBallPlayEnd(recordFairBattedBall(
    recordBatBallContact(createCanonicalPlateAppearanceTimeline(match, 100), contact),
    200,
  ), playEnd);
  const fieldersChoice = judgment.kind === 'fielders_choice';
  let adjudication = createPlayAdjudicationLedger({
    playId: 7, ruleProfileId: match.ruleProfileId, playEnd,
  });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
    eventId: 'rule', tick: 501, snapshotId: 'snapshot', evidenceRevision: 1,
    ruling: { outsAfter: fieldersChoice ? 1 : 0,
      basesAfter: { first: 'batter',
        second: fieldersChoice ? null : 'r1', third: null },
      scoredRunnerIds: [] },
  });
  adjudication = closeOfficialPlay(adjudication, 1, {
    eventId: 'close', closureId: 'closure-1', tick: 502,
  });
  const worldSetup: BetweenPlayWorldSetup = {
    baseCenters: { first: { x: 27, z: 0 },
      second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
    defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const).map(
      (registeredPosition, index) => ({ playerId: `defender-${index}`,
        registeredPosition, position: { x: index, z: index } })),
    activePreviousPlayControllerIds: [],
  };
  const officialApplication: PersistOfficialPlayInput = {
    kind: 'live_ball', matchId: 'game-1', applicationId: 'official-1',
    expectedDurableRevision: 0, match, physicalTimeline,
    adjudication, nextStartedAtTick: 503, worldSetup,
  };
  const evidence: OfficialFairBallScoringEvidence = {
    schemaVersion: 1,
    sourceEventId: `scorer-${judgment.kind}`,
    sourceKind: 'official_scorer_judgment', scorerId: 'scorer-1',
    ruleProfileId: match.ruleProfileId,
    playId: 7, closureId: 'closure-1', basisRulingId: 'snapshot',
    recordedAtTick: 503, contactSequence: 0, fairSequence: 1,
    batterRunnerId: 'batter', judgment,
  };
  return { officialApplication, evidence };
};

it.each([
  [{ kind: 'base_hit' } as const, 1, 0],
  [{ kind: 'reached_on_error', chargedFielderId: 'fielder-3' } as const, 0, 1],
  [{ kind: 'fielders_choice', retiredPriorRunnerId: 'r1' } as const, 0, 0],
])('persists accepted %j scoring through official Match application and restart',
  (judgment, hits, errors) => {
    const path = databasePath();
    const { officialApplication, evidence } = setup(judgment);
    const official = new SqliteOfficialStateStore(path);
    official.initializeMatch('game-1', officialApplication.match);
    official.applyAndActivate(officialApplication);
    official.close();
    const authority = { readAcceptedOfficialScoringEvidence: (sourceEventId: string) =>
      sourceEventId === evidence.sourceEventId ? evidence : null };
    const scoring = openSqliteOfficialScoringStore(path, authority);
    const request = { scoringApplicationId: 'scoring-1',
      officialApplication, sourceEventId: evidence.sourceEventId };
    const saved = scoring.apply(request);
    expect(saved.record).toMatchObject({ classification: judgment.kind,
      hitsCredited: hits, errorsCharged: errors });
    scoring.close();
    const reopened = openSqliteOfficialScoringStore(path);
    expect(reopened.readApplication('scoring-1')).toEqual(saved);
    expect(reopened.apply(request)).toEqual(saved);
    expect(() => reopened.apply({ ...request, sourceEventId: 'other' }))
      .toThrow('scoringApplicationId');
    reopened.close();
  });

it('rejects scoring that is not tied to the exact durable official request or accepted source', () => {
  const path = databasePath();
  const { officialApplication, evidence } = setup({ kind: 'base_hit' });
  const official = new SqliteOfficialStateStore(path);
  official.initializeMatch('game-1', officialApplication.match);
  official.applyAndActivate(officialApplication);
  official.close();
  const withoutAuthority = openSqliteOfficialScoringStore(path);
  expect(() => withoutAuthority.apply({
    scoringApplicationId: 'unaccepted-first-apply', officialApplication,
    sourceEventId: evidence.sourceEventId,
  })).toThrow('accepted scoring evidence');
  withoutAuthority.close();
  const scoring = openSqliteOfficialScoringStore(path, {
    readAcceptedOfficialScoringEvidence: (sourceEventId: string) =>
      sourceEventId === evidence.sourceEventId ? evidence : null,
  });
  expect(() => scoring.apply({ scoringApplicationId: 'fair-without-scorer',
    officialApplication })).toThrow('unsupported');
  expect(() => scoring.apply({ scoringApplicationId: 'bad-request',
    officialApplication: { ...officialApplication, nextStartedAtTick: 504 },
    sourceEventId: evidence.sourceEventId,
  })).toThrow('official application');
  expect(() => scoring.apply({ scoringApplicationId: 'bad-source',
    officialApplication, sourceEventId: 'unknown',
  })).toThrow('accepted scoring evidence');
  expect(scoring.readApplication('bad-request')).toBeNull();
  expect(scoring.readApplication('bad-source')).toBeNull();
  scoring.close();
});

it('allows one scoring decision per closure and replays stored accepted provenance', () => {
  const path = databasePath();
  const { officialApplication, evidence } = setup({ kind: 'base_hit' });
  const official = new SqliteOfficialStateStore(path);
  official.initializeMatch('game-1', officialApplication.match);
  official.applyAndActivate(officialApplication);
  official.close();
  let accepted = evidence;
  const scoring = openSqliteOfficialScoringStore(path, {
    readAcceptedOfficialScoringEvidence: (sourceEventId: string) =>
      sourceEventId === evidence.sourceEventId ? accepted : null,
  });
  const request = { scoringApplicationId: 'scoring-1',
    officialApplication, sourceEventId: evidence.sourceEventId };
  scoring.apply(request);
  expect(() => scoring.apply({ ...request,
    scoringApplicationId: 'scoring-2' })).toThrow('UNIQUE constraint');
  accepted = { ...evidence, judgment: {
    kind: 'reached_on_error', chargedFielderId: 'fielder-3' } };
  expect(scoring.readApplication('scoring-1')?.record.classification)
    .toBe('base_hit');
  accepted = evidence;
  expect(scoring.readApplication('scoring-1')?.record.classification)
    .toBe('base_hit');
  scoring.close();
});

it('scores a fair final play after the game-final application is durable', () => {
  const path = databasePath();
  const { officialApplication, evidence } = setup({ kind: 'fielders_choice',
    retiredPriorRunnerId: 'r1' });
  if (officialApplication.kind !== 'live_ball') throw new Error('fixture');
  const before: CanonicalMatchState = { ...officialApplication.match,
    inning: 9, outs: 2, score: { away: 1, home: 2 } };
  const playEnd = officialApplication.adjudication.playEnd;
  if (playEnd === null) throw new Error('fixture');
  let adjudication = createPlayAdjudicationLedger({ playId: 7,
    ruleProfileId: before.ruleProfileId, playEnd });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
    eventId: 'rule', tick: 501, snapshotId: 'snapshot', evidenceRevision: 1,
    ruling: { outsAfter: 3,
      basesAfter: { first: 'batter', second: null, third: null },
      scoredRunnerIds: [] },
  });
  adjudication = closeOfficialPlay(adjudication, 1, {
    eventId: 'close', closureId: 'closure-1', tick: 502,
  });
  const venueBinding = { gameId: 'game-1', venueId: 'neutral',
    fixtureEventId: 'fixture-1', fixtureRevision: 1 };
  const finalInput: PersistOfficialFinalInput = {
    kind: 'live_ball', matchId: 'game-1', applicationId: 'official-1',
    expectedDurableRevision: 0, match: before,
    physicalTimeline: officialApplication.physicalTimeline,
    adjudication,
    game: { seasonId: 'season-1', homeClubId: 'home', awayClubId: 'away',
      venueBinding,
      policy: { version: 'game-v1', minimumInnings: 9, tiesAllowed: false },
      lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
        inning: index + 1, awayRuns: index === 0 ? 1 : 0,
        homeRuns: index === 0 ? 2 : index === 8 ? null : 0,
      })), totals: { away: { runs: 1, hits: 4, errors: 0 },
        home: { runs: 2, hits: 5, errors: 0 } } },
    },
  };
  const official = new SqliteOfficialStateStore(path);
  official.registerOfficialFixture(venueBinding);
  official.initializeMatch('game-1', before);
  official.applyAndFinalize(finalInput);
  official.close();
  const scoring = openSqliteOfficialScoringStore(path, {
    readAcceptedOfficialScoringEvidence: (sourceEventId: string) =>
      sourceEventId === evidence.sourceEventId ? evidence : null,
  });
  const saved = scoring.apply({ scoringApplicationId: 'scoring-final',
    officialApplication: finalInput, sourceEventId: evidence.sourceEventId });
  expect(saved.record.classification).toBe('fielders_choice');
  expect(scoring.readApplication('scoring-final')).toEqual(saved);
  scoring.close();
});

it('persists a non-live strikeout from the durable official application without scorer evidence', () => {
  const path = databasePath();
  const { officialApplication } = setup({ kind: 'base_hit' });
  const before = { ...officialApplication.match, strikes: 2 };
  const timeline = recordCountedPitch(
    createCanonicalPlateAppearanceTimeline(before, 1000), 1100,
    { kind: 'swinging_strike' },
  );
  let adjudication = createPlayAdjudicationLedger({
    playId: 7, ruleProfileId: before.ruleProfileId, playEnd: null,
  });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
    eventId: 'strikeout-rule', tick: 1101, snapshotId: 'strikeout-rule',
    evidenceRevision: 1, ruling: { outsAfter: 1,
      basesAfter: before.bases, scoredRunnerIds: [] },
  });
  adjudication = closeOfficialPlay(adjudication, 1, {
    eventId: 'strikeout-close', closureId: 'strikeout-closure', tick: 1102,
  });
  if ('game' in officialApplication) throw new Error('fixture');
  const nonLive: PersistOfficialPlayInput = {
    kind: 'non_live', matchId: 'game-1', applicationId: 'strikeout-1',
    expectedDurableRevision: 0, match: before, timeline, adjudication,
    context: { kind: 'strikeout' }, nextStartedAtTick: 1103,
    worldSetup: officialApplication.worldSetup,
  };
  const official = new SqliteOfficialStateStore(path);
  official.initializeMatch('game-1', before);
  official.applyAndActivate(nonLive);
  official.close();
  const request = { scoringApplicationId: 'score-strikeout',
    officialApplication: nonLive };
  const scoring = openSqliteOfficialScoringStore(path);
  const saved = scoring.apply(request);
  expect(saved.record).toMatchObject({ classification: 'strikeout',
    hitsCredited: 0, errorsCharged: 0, runsScored: 0 });
  scoring.close();
  const reopened = openSqliteOfficialScoringStore(path);
  expect(reopened.readApplication('score-strikeout')).toEqual(saved);
  expect(reopened.apply(request)).toEqual(saved);
  expect(() => reopened.apply({ ...request,
    scoringApplicationId: 'score-strikeout-duplicate' }))
    .toThrow('UNIQUE constraint');
  reopened.close();
});

it('persists a caught foul out from the durable official ruling without scorer evidence', () => {
  const path = databasePath();
  const { officialApplication } = setup({ kind: 'base_hit' });
  if (officialApplication.kind !== 'live_ball'
    || 'game' in officialApplication) throw new Error('fixture');
  const before = officialApplication.match;
  const contact = resolveBatBallContact(
    { tick: 150, position: { x: 0, y: 1, z: 0.06 },
      velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 } },
    { pose: { grip: { x: -0.42, y: 1, z: 0 },
      tip: { x: 0.42, y: 1, z: 0 } },
      linearVelocity: { x: 0, y: 0, z: 22 },
      angularVelocity: { x: 0, y: 0, z: 0 } },
  );
  if (!contact) throw new Error('fixture requires contact');
  const playEnd = createPlayEndFact(500, 'live_action_complete');
  const timeline = recordLiveBallPlayEnd(recordFoulBattedBall(
    recordBatBallContact(createCanonicalPlateAppearanceTimeline(before, 100),
      contact), 300, false, { kind: 'caught', batterRunnerId: 'batter',
      firstFielderTouchTick: 250, outTick: 300, secureCatchTick: 300 },
  ), playEnd);
  let adjudication = createPlayAdjudicationLedger({ playId: before.playId,
    ruleProfileId: before.ruleProfileId, playEnd });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
    eventId: 'foul-rule', tick: 501, snapshotId: 'foul-rule',
    evidenceRevision: 1, ruling: { outsAfter: 1,
      basesAfter: before.bases, scoredRunnerIds: [] },
  });
  adjudication = closeOfficialPlay(adjudication, 1, {
    eventId: 'foul-close', closureId: 'foul-closure', tick: 502,
  });
  const application: PersistOfficialPlayInput = {
    ...officialApplication, physicalTimeline: timeline,
    adjudication,
  };
  const official = new SqliteOfficialStateStore(path);
  official.initializeMatch('game-1', before);
  official.applyAndActivate(application);
  official.close();
  const scoring = openSqliteOfficialScoringStore(path);
  const request = { scoringApplicationId: 'score-foul',
    officialApplication: application };
  const saved = scoring.apply(request);
  expect(saved.record).toMatchObject({ classification: 'foul_out',
    hitsCredited: 0, errorsCharged: 0 });
  scoring.close();
  const reopened = openSqliteOfficialScoringStore(path);
  expect(reopened.readApplication('score-foul')).toEqual(saved);
  expect(reopened.apply(request)).toEqual(saved);
  reopened.close();
});
