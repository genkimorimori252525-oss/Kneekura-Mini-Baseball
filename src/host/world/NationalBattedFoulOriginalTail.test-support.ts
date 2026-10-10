import assert from 'node:assert/strict';
import { assertNationalOriginalStatisticsBoundary, type NationalOriginalStatisticsBoundary } from './NationalBattedFoulOriginalStatisticsBoundary.test-support';
import { createRequire } from 'node:module';
import { expect } from 'vitest';
import type { nationalPhysicalFixture } from './NationalPhysicalMatchFixtures.test-support';
import { nationalBattedFieldFixture, type NationalBattedFieldContext } from './NationalBattedFieldFixtures.test-support';
import { attachActualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndFixtures.test-support';
import { attachActualFirstBaseOfficialFixture } from './ActualFirstBaseOfficialAttachment.test-support';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { nationalRegistrationEvidenceFromSqlite, readNationalMatchOrigin } from './NationalMatchOriginFromSqlite';
import { openSqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { nationalExposureAppraisal, nationalExposureGenesisPolicies, nationalExposurePolicies } from './NationalExposureDevelopment.test-support';
import type { NationalExposureOrigin, AcceptedNationalExposureAppraisal } from './NationalExposureDevelopmentOrigin';
import { openSqliteOfficialPlayerOutcomeStore } from './SqliteOfficialPlayerOutcomeStore';
import { openSqliteActualLiveScoringStore } from './SqliteActualLiveScoringStore';
import type { AcceptedActualLiveScoringSource } from './ActualLiveScoringSource';
import { actorJson as json, actorHash as hash, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { CompletedPlayParticipationReceipt } from './SqliteOfficialParticipationStore';
import type { DurableNationalAppearance } from './SqliteNationalCallupStore';
import type { OfficialPlayerOutcomeAttribution } from './OfficialPlayerOutcomeEvidenceFromSqlite';

export type NationalBattedFoulConsumerContext = Pick<ReturnType<typeof nationalPhysicalFixture>,
  'path' | 'db' | 'track' | 'close' | 'source' | 'roster' | 'callups' | 'facts' | 'participation'> & Readonly<{
    origins: Pick<ReturnType<typeof nationalPhysicalFixture>['origins'], 'read'>;
  }>;
export type NationalBattedFoulTailContext = NationalBattedFieldContext & NationalBattedFoulConsumerContext;
export type NationalBattedFoulFieldRoot = Omit<ReturnType<typeof nationalBattedFieldFixture>, 'f'> & Readonly<{
  f: Pick<NationalBattedFoulConsumerContext, 'path' | 'db' | 'track' | 'close'>;
}>;
type TailInput = Readonly<{
  nextActor: DurablePhysicalPlateAppearanceActor;
  foulTerminalSource: Readonly<{sourceId:string;applicationId:string}>;
  foulReceipt: CompletedPlayParticipationReceipt; adoptedFoul: DurableNationalAppearance;
  originBytes: string; clubBefore: ReturnType<NationalBattedFoulTailContext['roster']['readHead']>;
  progress: (phase:string)=>void; preservedFoulStatistics?: OfficialPlayerOutcomeAttribution;
  statisticsBoundary?: NationalOriginalStatisticsBoundary;
}>;
/** Fresh and pitch-retained callers still admit their original complete second-play prefix. */
export const continueNationalBattedFoulOriginalTail = (input: TailInput & Readonly<{ f: NationalBattedFoulTailContext }>) =>
  continueNationalBattedFoulOriginalTailFromField({ ...input,
    liveRoot: nationalBattedFieldFixture(input.f, input.nextActor, 'national-live', 'first_base') });

/** Default entry executes the original 37 assertions. A witnessed statistics
 * entry relies on the prior source-pinned run for its already completed checks.
 * Every retained domain value still comes from its real owner. */
export const continueNationalBattedFoulOriginalTailFromField = (input: TailInput & Readonly<{
  f: NationalBattedFoulConsumerContext; liveRoot: NationalBattedFoulFieldRoot; retainedPhysicalCut?: Parameters<typeof attachActualFirstBasePlayEndFixture>[3];
}>) => {
  const {f,nextActor,foulTerminalSource,foulReceipt,adoptedFoul,originBytes,clubBefore,progress,preservedFoulStatistics,liveRoot}=input;
  const path=f.path;
  const foulAppearance={eventId:'national-foul:appearance',careerId:'career-a',receiptId:foulReceipt.receiptId,acceptedAtDay:121};
  expect(liveRoot.physical.frame.initialWorld).toBeNull();
  expect(liveRoot.physical.frame.activationApplicationId).toBe(foulTerminalSource.applicationId);
  expect(liveRoot.forecastGroundElapsedSeconds).not.toBeNull();
  const physical = attachActualFirstBasePlayEndFixture(path, liveRoot, liveRoot.forecastGroundElapsedSeconds!, input.retainedPhysicalCut);
  progress('actual_second_play_capture_and_motion');
  const live = attachActualFirstBaseOfficialFixture(path, physical);
  expect(live.race.execution.kind).toBe('first_base_race');
  expect(live.end.kind).toBe('ended');
  expect(live.closure.official.receipt).toMatchObject({ durableRevision: 2, previousPlayId: nextActor.match.playId });
  const statistics = f.track(openSqliteOfficialPlayerOutcomeStore(path));
  const foulStatisticsSource = { owner: 'actual_foul_terminal_applications' as const, sourceId: foulTerminalSource.sourceId };
  let liveReceipt: ReturnType<NationalBattedFoulConsumerContext['participation']['confirmNationalActualLivePlayed']>;
  let attributedFoul: ReturnType<typeof statistics.apply>;
  if (input.statisticsBoundary) {
    assertNationalOriginalStatisticsBoundary(input.statisticsBoundary);
    const row = f.db.prepare('SELECT receipt_id FROM official_participation_receipts WHERE game_id=? AND player_id=?').get(f.source.gameId, 'p10');
    const receipt = row && f.participation.readReceipt(String(row.receipt_id));
    assert(receipt && 'evidenceKind' in receipt && receipt.evidenceKind === 'NATIONAL_ACTUAL_LIVE_V1'
      && receipt.closureSourceId === live.closureSource.sourceId, 'retained original live participation is missing');
    assert.equal(receipt.binding.playerId, 'p10'); liveReceipt = receipt;
    const appearance = { eventId: 'national-live:appearance', careerId: 'career-a', receiptId: liveReceipt.receiptId, acceptedAtDay: 121 };
    assert.equal(f.callups.readRepresentation('career-a', 'p10', 121)[0]?.seniorOfficialAppearanceDay, 121);
    const savedAppearance = f.db.prepare('SELECT entry_json FROM world_national_callups WHERE event_id=?').get(appearance.eventId);
    assert(savedAppearance); assert.equal(json(JSON.parse(String(savedAppearance.entry_json)).input), json(appearance), 'retained appearance Source differs');
    const attributed = statistics.readApplication(foulStatisticsSource);
    assert(attributed && attributed.kind === 'attributed', 'retained original foul statistics are missing'); attributedFoul = attributed;
    assert.equal(attributedFoul.source.sourceId, foulTerminalSource.sourceId);
    progress('verified_original_missing_scoring_assertion_boundary');
  } else {
    liveReceipt = f.participation.confirmNationalActualLivePlayed(f.source.gameId, 'p10', live.closureSource.sourceId);
    expect(liveReceipt).toMatchObject({ evidenceKind: 'NATIONAL_ACTUAL_LIVE_V1', actorKind: 'BATTER_RUNNER', durableRevision: 2,
      binding: { playerId: 'p10', nationalRegistrationEventId: 'call-10' } });
    const liveAppearance = { eventId: 'national-live:appearance', careerId: 'career-a', receiptId: liveReceipt.receiptId, acceptedAtDay: 121 };
    f.callups.adoptAppearance(liveAppearance);
    expect(f.callups.adoptAppearance(foulAppearance)).toEqual(adoptedFoul);
    expect(f.participation.confirmNationalFoulTerminalPlayed(f.source.gameId, 'p9', foulTerminalSource.sourceId)).toEqual(foulReceipt);
    expect(() => f.participation.confirmNationalActualLivePlayed(f.source.gameId, 'p9', live.closureSource.sourceId)).toThrow('recorded differently');
    expect(f.db.prepare('SELECT count(*) AS n FROM official_participation_receipts').get()).toEqual({ n: 2 });
    expect(json(f.origins.read(f.source.gameId))).toBe(originBytes);
    expect(f.roster.readHead('career-a', 'club-a')).toEqual(clubBefore);
    progress('two_original_participation_and_adoption_receipts');

    attributedFoul = preservedFoulStatistics ?? statistics.apply(foulStatisticsSource);
    expect(attributedFoul).toMatchObject({ kind: 'attributed', batterPlayerId: 'p9', pitcherPlayerId: 'p0', classification: 'strikeout' });
    // Classification remains unavailable until its owned original ground-out
    // sidecar is separately admitted by the existing scorer.
    expect(statistics.apply({ owner: 'actual_live_play_closures', sourceId: live.closureSource.sourceId }))
      .toMatchObject({ kind: 'unavailable', reason: 'supported_official_scoring_missing' });
    progress('original_missing_scoring_assertion_completed');
  }
  const groundSource: AcceptedActualLiveScoringSource = { sourceId: 'national-live:ground-out', sourceVersion: 'owned-ground-out-v1',
    gameId: f.source.gameId, scoringApplicationId: 'national-live:ground-out-score',
    closureReference: { sourceId: live.closureSource.sourceId, proposalHash: hash(live.queued.proposal) },
    evidence: { schemaVersion: 1, sourceKind: 'owned_ground_out', sourceEventId: 'national-live:ground-out',
      playId: nextActor.match.playId, closureId: live.closureSource.sourceId, batterRunnerId: 'p10' } };
  const originalClosure = f.db.prepare('SELECT * FROM actual_live_play_closures WHERE source_id=?').get(live.closureSource.sourceId);
  const groundScoring = f.track(openSqliteActualLiveScoringStore(path,
    { readAcceptedScoringSource: id => id === groundSource.sourceId ? groundSource : null }));
  const savedGround = input.statisticsBoundary ? groundScoring.read(groundSource.sourceId) : null;
  if (savedGround) assert.equal(json(savedGround.source), json(groundSource), 'retained ground scoring Source differs');
  const scoredGround = savedGround?.result ?? (savedGround ? groundScoring.resume(groundSource.sourceId) : groundScoring.submit(groundSource.sourceId));
  expect(scoredGround.record).toMatchObject({ classification: 'ground_out', runsScored: 0, hitsCredited: 0, errorsCharged: 0 });
  expect(f.db.prepare('SELECT * FROM actual_live_play_closures WHERE source_id=?').get(live.closureSource.sourceId)).toEqual(originalClosure);
  const liveStatisticsSource = { owner: 'actual_live_play_closures' as const, sourceId: live.closureSource.sourceId };
  const attributedGround = input.statisticsBoundary ? statistics.readApplication(liveStatisticsSource) ?? statistics.apply(liveStatisticsSource) : statistics.apply(liveStatisticsSource);
  expect(attributedGround).toMatchObject({ kind: 'attributed', batterPlayerId: 'p10', pitcherPlayerId: 'p0', classification: 'ground_out' });
  const statisticsScope = { careerId: 'career-a', competitionEditionId: foulReceipt.binding.competitionEditionId, playerId: 'p9', asOfDay: 121 };
  const originalStatistics = statistics.aggregate(statisticsScope);
  expect(originalStatistics).toMatchObject({ coverage: 'attributed_supported_plays_only', batting: { classifiedPlays: 1, outcomes: { strikeout: 1 } } });
  expect(statistics.aggregate({ ...statisticsScope, playerId: 'p0' }).pitching.outcomes.strikeout).toBe(1);
  expect(statistics.aggregate({ ...statisticsScope, playerId: 'p0' }).pitching.outcomes.ground_out).toBe(1);

  const person = f.track(openSqlitePersonGenesisStore(path));
  const genesis = { careerId: 'career-a', initializedAtDay: 10, careerSeed: 12345, policies: nationalExposureGenesisPolicies() };
  if (input.statisticsBoundary && person.readDevelopmentSeed(genesis.careerId) !== null) {
    const saved = f.db.prepare('SELECT initialized_at_day,career_seed,policies_json FROM world_person_genesis_careers WHERE career_id=?').get(genesis.careerId); assert(saved);
    assert.equal(saved.initialized_at_day, genesis.initializedAtDay); assert.equal(saved.career_seed, genesis.careerSeed);
    assert.equal(json(JSON.parse(String(saved.policies_json))), json(genesis.policies), 'retained genesis Source differs');
  } else person.initializeCareer(genesis);
  const savedPeople = input.statisticsBoundary ? ['link-9', 'link-10'].map(id => person.read(id)) : [];
  if (savedPeople.some(Boolean)) {
    assert(savedPeople.every(Boolean), 'retained original Person batch is incomplete');
    savedPeople.forEach((value, i) => assert.deepEqual([value!.careerId, value!.playerId, value!.personId, value!.sourceId],
      ['career-a', `p${i + 9}`, `person-${i + 9}`, `link-${i + 9}`]));
  } else person.materializeBatch(['link-9', 'link-10']);
  const policies = nationalExposurePolicies(), appraisals = new Map<string, AcceptedNationalExposureAppraisal>();
  const requests = [foulReceipt, liveReceipt].map(receipt => {
    const appraisal = nationalExposureAppraisal(receipt.binding.playerId, receipt.binding.gameDay);
    appraisals.set(appraisal.sourceId, appraisal);
    return { episodeId: appraisal.episodeId, playerId: receipt.binding.playerId, personSourceId: receipt.binding.personLinkSourceId,
      appraisalSourceId: appraisal.sourceId, policySourceId: policies.sourceId, participationReceiptId: receipt.receiptId };
  });
  const episodes = f.track(openSqliteDevelopmentInitiationStore(path, { roster: f.roster, person,
    appraisal: { readAcceptedAppraisal: () => null }, policies: { readAcceptedPolicies: id => id === policies.sourceId ? policies : null },
    nationalExposure: { readAcceptedAppraisal: id => appraisals.get(id) ?? null } }));
  const initiations = requests.map(request => {
    const saved = input.statisticsBoundary ? episodes.read(request.episodeId) : null;
    if (!saved) return episodes.applyNationalExposure(request);
    const row = f.db.prepare('SELECT origin_json FROM world_development_national_exposure_origins WHERE episode_id=?').get(request.episodeId); assert(row);
    const origin = JSON.parse(String(row.origin_json)) as NationalExposureOrigin;
    assert.equal(json(origin.request), json(request), 'retained exposure request differs');
    assert.equal(json(origin.appraisal), json(appraisals.get(request.appraisalSourceId)), 'retained exposure appraisal differs');
    assert.equal(json(origin.policies), json(policies), 'retained exposure policies differ');
    return saved;
  });
  for (const [i, initiation] of initiations.entries()) {
    expect(initiation.episode.catalyst).toMatchObject({ family: 'ELITE_EXPOSURE', sourceEventId: requests[i].participationReceiptId });
    expect(episodes.applyNationalExposure(requests[i])).toEqual(initiation);
  }
  const alias = nationalExposureAppraisal('p9', 121, '-same-game'); appraisals.set(alias.sourceId, alias);
  expect(() => episodes.applyNationalExposure({ ...requests[0], episodeId: alias.episodeId, appraisalSourceId: alias.sourceId })).toThrow('consumed');
  // A later legal fact does not revise either original representation snapshot.
  const revocation = { careerId: 'career-a', personLinkSourceId: 'link-9', active: false,
    fact: { evidenceId: 'national-later-revocation', playerId: 'p9', personId: 'person-9', nationId: 'KR', basis: 'CITIZENSHIP' as const, effectiveFromDay: 121 } };
  const savedRevocation = input.statisticsBoundary && f.db.prepare('SELECT entry_json FROM world_national_eligibility_facts WHERE evidence_id=?').get(revocation.fact.evidenceId);
  if (savedRevocation) {
    assert(f.facts.readFacts('career-a', 'p9', 121), 'retained eligibility facts missing');
    assert.equal(json(JSON.parse(String(savedRevocation.entry_json)).input), json(revocation), 'retained revocation Source differs');
  } else f.facts.record(revocation);
  const receiptRows = f.db.prepare('SELECT * FROM official_participation_receipts ORDER BY receipt_id').all();
  f.close(); progress('all_original_handles_closed');

  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path), participation = new SqliteOfficialParticipationStore(path);
  const reopenedEpisodes = openSqliteDevelopmentInitiationStore(path, { roster: { readDevelopmentRosterChange: () => null },
    person: { read: () => null, readDevelopmentSeed: () => null }, appraisal: { readAcceptedAppraisal: () => null }, policies: { readAcceptedPolicies: () => null } });
  const reopenedStatistics = openSqliteOfficialPlayerOutcomeStore(path);
  const reopenedScoring = openSqliteActualLiveScoringStore(path);
  try {
    for (const receipt of [foulReceipt, liveReceipt]) expect(participation.readReceipt(receipt.receiptId)).toEqual(receipt);
    expect(participation.confirmNationalFoulTerminalPlayed(f.source.gameId, 'p9', foulTerminalSource.sourceId)).toEqual(foulReceipt);
    expect(participation.confirmNationalActualLivePlayed(f.source.gameId, 'p10', live.closureSource.sourceId)).toEqual(liveReceipt);
    for (const [i, request] of requests.entries()) expect(reopenedEpisodes.applyNationalExposure(request)).toEqual(initiations[i]);
    const registrations = nationalRegistrationEvidenceFromSqlite(db);
    for (const player of ['p9', 'p10']) expect(registrations.readRepresentation('career-a', player, 121)[0].seniorOfficialAppearanceDay).toBe(121);
    expect(json(readNationalMatchOrigin(db, f.source.gameId))).toBe(originBytes);
    expect(db.prepare('SELECT * FROM official_participation_receipts ORDER BY receipt_id').all()).toEqual(receiptRows);
    if (!preservedFoulStatistics) {
      expect(reopenedStatistics.apply(foulStatisticsSource)).toEqual(attributedFoul);
      expect(reopenedStatistics.readApplication(foulStatisticsSource)).toEqual(attributedFoul);
    }
    expect(reopenedStatistics.aggregate(statisticsScope)).toEqual(originalStatistics);
    expect(reopenedScoring.submit(groundSource.sourceId)).toEqual(scoredGround);
    expect(reopenedStatistics.apply(liveStatisticsSource)).toEqual(attributedGround);
    expect(reopenedStatistics.aggregate({ ...statisticsScope, playerId: 'p10' }).batting.outcomes.ground_out).toBe(1);
    progress('reopened_original_receipt_membership_and_exposure');
  } finally { reopenedScoring.close(); reopenedStatistics.close(); reopenedEpisodes.close(); participation.close(); db.close(); }
};
