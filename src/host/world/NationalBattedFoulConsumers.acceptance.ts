import { declareNationalBattedFixture, checkNationalBattedFixture } from './NationalBattedFixtureDeclaration.test-support';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { nationalPhysicalFixture } from './NationalPhysicalMatchFixtures.test-support';
import { nationalBattedFieldFixture } from './NationalBattedFieldFixtures.test-support';
import { completeNationalFoulFixture } from './NationalFoulCompletionFixtures.test-support';
import { continueNationalBattedFoulOriginalTail } from './NationalBattedFoulOriginalTail.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** One fresh National registration/fixture root, two successive original plays.
 * No donor, mocked reader, rewritten identity, or persisted physical result is
 * supplied. This is a source-only candidate until the central Native run passes.
 * Ordinary National exposure→actual practice already has separate acceptance. */
it('NAT-N01 one National game connects original terminal foul and next batted play to owned adoption exposure and reopen', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'national-batted-foul-consumers-')), 'national.sqlite');
  const progress = (phase: string) => console.info('NATIONAL_BATTED_FOUL_PHASE', phase);
  console.info('NATIONAL_BATTED_FOUL_PRIVATE_DB', path);
  const original = nationalPhysicalFixture({ databasePath: path, profile: { ruleProfileId: NPB_2026_RULE_PROFILE.id } });
  try {
    const battedFixtureDeclaration = declareNationalBattedFixture({ gameId: original.source.gameId, careerId: original.source.careerId,
      fixtureEventId: original.fixture.binding.fixtureEventId, venueId: original.fixture.binding.venueId, gameDay: original.origin.fixture.gameDay,
      roster: original.origin.participants.map(p => ({ playerId: p.binding.playerId, personId: p.binding.personId })),
      match: original.actor.match, setup: original.setup });
    const f = { ...original, battedFixtureDeclaration };
    checkNationalBattedFixture(battedFixtureDeclaration);
    progress('prospective_full_roster_and_both_core_scenes_checked');
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
    continueNationalBattedFoulOriginalTail({ f, nextActor, foulTerminalSource: foul.terminal.terminalSource,
      foulReceipt, adoptedFoul, originBytes, clubBefore, progress });
  } finally { original.close(); }
}, 3_600_000);
