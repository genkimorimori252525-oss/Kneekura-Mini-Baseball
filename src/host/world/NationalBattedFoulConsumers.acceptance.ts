import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { nationalPhysicalFixture } from './NationalPhysicalMatchFixtures.test-support';
import { nationalBattedFieldFixture } from './NationalBattedFieldFixtures.test-support';
import { completeNationalFoulFixture } from './NationalFoulCompletionFixtures.test-support';
import { attachActualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndFixtures.test-support';
import { attachActualFirstBaseOfficialFixture } from './ActualFirstBaseOfficialAttachment.test-support';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { nationalRegistrationEvidenceFromSqlite, readNationalMatchOrigin } from './NationalMatchOriginFromSqlite';
import { openSqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { nationalExposureAppraisal, nationalExposureGenesisPolicies, nationalExposurePolicies } from './NationalExposureDevelopment.test-support';
import type { AcceptedNationalExposureAppraisal } from './NationalExposureDevelopmentOrigin';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** One fresh National registration/fixture root, two successive original plays.
 * No donor, mocked reader, rewritten identity, or persisted physical result is
 * supplied. This is a source-only candidate until the central Native run passes.
 * Ordinary National exposure→actual practice already has separate acceptance. */
it('NAT-N01 one National game connects original terminal foul and next batted play to owned adoption exposure and reopen', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'national-batted-foul-consumers-')), 'national.sqlite');
  const progress = (phase: string) => console.info('NATIONAL_BATTED_FOUL_PHASE', phase);
  console.info('NATIONAL_BATTED_FOUL_PRIVATE_DB', path);
  const f = nationalPhysicalFixture({ databasePath: path, profile: { ruleProfileId: NPB_2026_RULE_PROFILE.id } });
  let originalClosed = false;
  try {
    const originBytes = json(f.origin), clubBefore = f.roster.readHead('career-a', 'club-a')!;
    progress('original_national_registration_and_actor');
    const foulRoot = nationalBattedFieldFixture(f, f.actor, 'national-foul', 'terminal_foul');
    const foul = completeNationalFoulFixture(foulRoot, progress);
    const foulReceipt = f.participation.confirmNationalFoulTerminalPlayed(f.source.gameId, 'p9', foul.terminal.terminalSource.sourceId);
    expect(foulReceipt).toMatchObject({ evidenceKind: 'NATIONAL_FOUL_TERMINAL_V1', actorKind: 'BATTER', durableRevision: 1,
      binding: { playerId: 'p9', nationalRegistrationEventId: 'call-9' } });
    const foulAppearance = { eventId: 'national-foul:appearance', careerId: 'career-a', receiptId: foulReceipt.receiptId, acceptedAtDay: 121 };
    const adoptedFoul = f.callups.adoptAppearance(foulAppearance);
    expect(adoptedFoul.source.registrationSnapshotId).toBe(f.origin.participants.find(p => p.binding.playerId === 'p9')!.registrationSnapshotId);

    // The second original is admitted through the first play's real completed
    // activation. Its actor and pitch are newly owned, never rebound in place.
    const nextActorSource = { sourceId: 'national-live:batter', sourceVersion: 'fixture-v1', gameId: f.source.gameId,
      playerId: 'p10', activationApplicationId: foul.terminal.terminalSource.applicationId };
    f.actorInputs.set(nextActorSource.sourceId, nextActorSource);
    const nextActor = f.actors.accept(nextActorSource.sourceId);
    expect(nextActor.match).toMatchObject({ playId: f.actor.match.playId + 1, outs: 1, half: 'top' });
    progress('original_second_batter_after_foul');
    const liveRoot = nationalBattedFieldFixture(f, nextActor, 'national-live', 'first_base');
    expect(liveRoot.physical.frame.initialWorld).toBeNull();
    expect(liveRoot.physical.frame.activationApplicationId).toBe(foul.terminal.terminalSource.applicationId);
    expect(liveRoot.forecastGroundElapsedSeconds).not.toBeNull();
    const physical = attachActualFirstBasePlayEndFixture(path, liveRoot, liveRoot.forecastGroundElapsedSeconds!);
    progress('actual_second_play_capture_and_motion');
    const live = attachActualFirstBaseOfficialFixture(path, physical);
    expect(live.race.execution.kind).toBe('first_base_race');
    expect(live.end.kind).toBe('ended');
    expect(live.closure.official.receipt).toMatchObject({ durableRevision: 2, previousPlayId: nextActor.match.playId });
    const liveReceipt = f.participation.confirmNationalActualLivePlayed(f.source.gameId, 'p10', live.closureSource.sourceId);
    expect(liveReceipt).toMatchObject({ evidenceKind: 'NATIONAL_ACTUAL_LIVE_V1', actorKind: 'BATTER_RUNNER', durableRevision: 2,
      binding: { playerId: 'p10', nationalRegistrationEventId: 'call-10' } });
    const liveAppearance = { eventId: 'national-live:appearance', careerId: 'career-a', receiptId: liveReceipt.receiptId, acceptedAtDay: 121 };
    f.callups.adoptAppearance(liveAppearance);
    expect(f.callups.adoptAppearance(foulAppearance)).toEqual(adoptedFoul);
    expect(f.participation.confirmNationalFoulTerminalPlayed(f.source.gameId, 'p9', foul.terminal.terminalSource.sourceId)).toEqual(foulReceipt);
    expect(() => f.participation.confirmNationalActualLivePlayed(f.source.gameId, 'p9', live.closureSource.sourceId)).toThrow('recorded differently');
    expect(f.db.prepare('SELECT count(*) AS n FROM official_participation_receipts').get()).toEqual({ n: 2 });
    expect(json(f.origins.read(f.source.gameId))).toBe(originBytes);
    expect(f.roster.readHead('career-a', 'club-a')).toEqual(clubBefore);
    progress('two_original_participation_and_adoption_receipts');

    const person = f.track(openSqlitePersonGenesisStore(path));
    person.initializeCareer({ careerId: 'career-a', initializedAtDay: 10, careerSeed: 12345, policies: nationalExposureGenesisPolicies() });
    person.materializeBatch(['link-9', 'link-10']);
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
    const initiations = requests.map(request => episodes.applyNationalExposure(request));
    for (const [i, initiation] of initiations.entries()) {
      expect(initiation.episode.catalyst).toMatchObject({ family: 'ELITE_EXPOSURE', sourceEventId: requests[i].participationReceiptId });
      expect(episodes.applyNationalExposure(requests[i])).toEqual(initiation);
    }
    const alias = nationalExposureAppraisal('p9', 121, '-same-game'); appraisals.set(alias.sourceId, alias);
    expect(() => episodes.applyNationalExposure({ ...requests[0], episodeId: alias.episodeId, appraisalSourceId: alias.sourceId })).toThrow('consumed');
    // A later legal fact does not revise either original representation snapshot.
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-9', active: false,
      fact: { evidenceId: 'national-later-revocation', playerId: 'p9', personId: 'person-9', nationId: 'KR', basis: 'CITIZENSHIP', effectiveFromDay: 121 } });
    const receiptRows = f.db.prepare('SELECT * FROM official_participation_receipts ORDER BY receipt_id').all();
    f.close(); originalClosed = true; progress('all_original_handles_closed');

    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(path), participation = new SqliteOfficialParticipationStore(path);
    const reopenedEpisodes = openSqliteDevelopmentInitiationStore(path, { roster: { readDevelopmentRosterChange: () => null },
      person: { read: () => null, readDevelopmentSeed: () => null }, appraisal: { readAcceptedAppraisal: () => null }, policies: { readAcceptedPolicies: () => null } });
    try {
      for (const receipt of [foulReceipt, liveReceipt]) expect(participation.readReceipt(receipt.receiptId)).toEqual(receipt);
      expect(participation.confirmNationalFoulTerminalPlayed(f.source.gameId, 'p9', foul.terminal.terminalSource.sourceId)).toEqual(foulReceipt);
      expect(participation.confirmNationalActualLivePlayed(f.source.gameId, 'p10', live.closureSource.sourceId)).toEqual(liveReceipt);
      for (const [i, request] of requests.entries()) expect(reopenedEpisodes.applyNationalExposure(request)).toEqual(initiations[i]);
      const registrations = nationalRegistrationEvidenceFromSqlite(db);
      for (const player of ['p9', 'p10']) expect(registrations.readRepresentation('career-a', player, 121)[0].seniorOfficialAppearanceDay).toBe(121);
      expect(json(readNationalMatchOrigin(db, f.source.gameId))).toBe(originBytes);
      expect(db.prepare('SELECT * FROM official_participation_receipts ORDER BY receipt_id').all()).toEqual(receiptRows);
      progress('reopened_original_receipt_membership_and_exposure');
    } finally { reopenedEpisodes.close(); participation.close(); db.close(); }
  } finally { if (!originalClosed) f.close(); }
}, 3_600_000);
