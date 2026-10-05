import assert from 'node:assert/strict';
import { NPB_2026_RULE_PROFILE, getRuleProfile } from '../../core/rules/RuleProfile';
import { evaluateRosterParticipation } from '../../core/world/roster/RosterQueries';
import { createPlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import { assertInitialOfficialWorldEvidence, readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import { derivePhysicalPlateAppearanceActor, actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { assertNoLegacyPitchWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { physicalPitchActionInput } from './PhysicalPitchEvidenceFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** Setup prerequisites only. No original pitch, long physical graph, official
 * application, role assessment/settlement or next-play actor is accepted here. */
export const verifyActualKnownProfileSetup = () => {
  const selected = { ruleProfileId: NPB_2026_RULE_PROFILE.id };
  const x = physicalPlateAppearanceActorFixture(undefined, undefined, selected), f = x.f;
  const checked: string[] = [];
  const count = (table: string) => Number(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n);
  try {
    const original = f.initial.match, state = f.official.getMatch('game-1'); assert(state);
    assert.deepEqual(original, { ruleProfileId: NPB_2026_RULE_PROFILE.id, inning: 1, half: 'top', outs: 0,
      balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 7 });
    assert.equal(state.durableRevision, 0); assert.equal(state.activation, null); assert.equal(state.finalResult, null);
    assert.deepEqual(state.matchState, original); assert.equal(f.initial.world.defenders.length, 9); assert.deepEqual(f.initial.world.runners, []);
    withSqliteReadTransaction(f.db, () => assertInitialOfficialWorldEvidence(f.db, f.initial, true));
    assert.deepEqual(f.initial.fixture, f.official.getOfficialFixture('game-1'));
    checked.push('original Match/World/fixture identity, scope and empty occupancy');

    const policy = { sourceId: 'explicit-fixture-official-policy', sourceVersion: 'fixture-v1', ruleProfileId: selected.ruleProfileId,
      officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } };
    assert.equal(getRuleProfile(original.ruleProfileId), NPB_2026_RULE_PROFILE);
    assert.deepEqual(actualLiveAdjudicationProfile(original.ruleProfileId, null).officialWindows, { appeal: { available: true } });
    assert.deepEqual(actualLiveAdjudicationProfile(original.ruleProfileId, policy).officialWindows, policy.officialWindows);
    checked.push('registered base profile and explicit supplemental windows; absent review/challenge remain absent without policy');

    const actor = x.actors.accept(x.source.sourceId); assert.equal(actor.source.playerId, 'away-1');
    const bindings = [actor.binding, ...actor.defenderBindings].sort((a, b) => a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0);
    const ids = ['away-1', 'home-1', 'home-2', 'home-3', 'home-4', 'home-5', 'home-6', 'home-7', 'home-8', 'p2'];
    assert.deepEqual(bindings.map(value => value.playerId), ids);
    const persons = withSqliteReadTransaction(f.db, () => bindings.map(binding => {
      assert.equal(binding.careerId, 'career-a'); assert.equal(binding.gameId, 'game-1'); assert.equal(binding.gameDay, 10);
      assert.equal(binding.fixtureEventId, 'fixture-1'); assert.equal(binding.rosterRevision, 0);
      assert.equal(binding.clubId, binding.playerId === 'away-1' ? 'club-b' : 'club-a');
      assert.equal(binding.side, binding.playerId === 'away-1' ? 'AWAY' : 'HOME');
      assert.equal(binding.personLinkSourceId, `intake-${binding.playerId}`);
      const person = readOfficialActorPersonLink(f.db, binding); assert(person.acceptedAtDay <= binding.gameDay); return person;
    }));
    assert.equal(new Set(persons.map(value => value.personId)).size, 10);
    assert.equal(count('official_participant_bindings'), 18);
    checked.push('ten original Player/Person/Club identities in exact workload order');

    const heads = withSqliteReadTransaction(f.db, () => bindings.map(binding => {
      assertNoLegacyPitchWorkloadCharge(f.db, { careerId: binding.careerId, gameId: binding.gameId, playId: original.playId, playerId: binding.playerId });
      return readActualRoleWorkloadState(f.db, binding.careerId, binding.playerId, undefined, binding.personLinkSourceId);
    }));
    assert.deepEqual(heads.map((head, index) => head ? ids[index] : null).filter(Boolean), ['p2']);
    const pitcher = heads.at(-1); assert(pitcher); assert.equal(pitcher.revision, 0); assert.equal(pitcher.effectiveDay, 1); assert.equal(pitcher.fatigue, 0);
    assert.equal(count('world_player_workload_baselines'), 2); assert.equal(count('world_player_workload_heads'), 2);
    assert.equal(count('world_player_workload_activities'), 0);
    const baseline = JSON.parse(String(f.db.prepare('SELECT source_json FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get('career-a', 'p2')!.source_json));
    assert.deepEqual(baseline.policy, pitcher.policy); assert(baseline.createdAtDay <= 10);
    const explicitAddedPolicy = { policyId: 'explicit-role-workload-fixture', version: 'fixture-v1', availableAtDay: 0,
      workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 };
    const plannedBaseline = createPlayerWorkloadRecovery({ careerId: 'career-a', playerId: 'away-1', createdAtDay: 10,
      fatigue: 0.1, recoveryCapacity: 0.5, policy: explicitAddedPolicy });
    assert.equal(plannedBaseline.fatigue, 0.1); assert.deepEqual(plannedBaseline.policy, explicitAddedPolicy);
    checked.push('sparse unchanged workload BEFORE, exact retained policy, explicit future baseline/rate inputs, zero legacy charges');

    const away = f.participation.readPregameBinding('game-1', 'away-2'); assert(away);
    assert.equal(away.side, 'AWAY'); assert.equal(away.clubId, 'club-b'); assert.equal(away.gameDay, 10);
    assert.equal(away.fixtureEventId, 'fixture-1'); assert.equal(away.rosterRevision, 0);
    const awayPerson = withSqliteReadTransaction(f.db, () => readOfficialActorPersonLink(f.db, away));
    assert(!persons.some(person => person.personId === awayPerson.personId));
    const roster = f.roster.readHead('career-a', 'club-b'); assert(roster);
    const eligibility = evaluateRosterParticipation(roster.roster, { playerId: 'away-2', clubId: 'club-b', competitionEditionId: 'league-season-1' });
    assert.equal(eligibility.scope, 'ROSTER_ONLY'); assert.equal(eligibility.eligible, true); assert.deepEqual(eligibility.reasons, []);
    const derivedAway = withSqliteReadTransaction(f.db, () => derivePhysicalPlateAppearanceActor(f.db,
      { ...x.source, sourceId: 'setup-only-away-2', playerId: 'away-2' }));
    assert.equal(derivedAway.binding.playerId, 'away-2'); assert.equal(derivedAway.binding.personId, awayPerson.personId);
    assert.equal(count('physical_plate_appearance_actors'), 1);
    checked.push('away-2 roster/Person/side eligibility and read-only origin derivation; no next actor accepted');

    const timing = f.timing.selectProfileAtDay('career-a', 'p2', 10), release = f.release.selectAtDay('career-a', 'p2', 10);
    const timingSource = JSON.parse(String(f.db.prepare('SELECT source_json FROM world_pitch_timing_baselines WHERE career_id=? AND player_id=?').get('career-a', 'p2')!.source_json));
    assert(timingSource.acceptedAtDay <= 10); assert.equal(timingSource.personLinkSourceId, 'intake-p2'); assert.deepEqual(timing, timingSource.profile);
    assert(release.effectiveDay <= 10); assert.equal(release.sourceId, 'release');
    const fatigue = f.policies.readAcceptedPolicy('response'); assert(fatigue); assert.deepEqual(fatigue, f.response); assert(fatigue.availableAtDay <= 10);
    const effort = f.stores.effortPolicies.readAcceptedPolicy('effort'); assert(effort); assert.deepEqual(effort, f.effort); assert(effort.availableAtDay <= 10);
    assert.equal(effort.effortUnitsPerPhysicalPitch, 2);
    checked.push('current timing/release/fatigue/effort Sources, original Person, day eligibility and retained workload policy');

    const action = continuousPitchAction(f, 0, 0); assert.deepEqual(physicalPitchActionInput(action, action.sourceId), action);
    const nextTake = { action: { kind: 'take' as const }, plateZ: 0,
      strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 };
    assert.deepEqual(action.request.batter, nextTake);
    for (const value of [nextTake.plateZ, ...Object.values(nextTake.strikeZone), nextTake.ballRadiusMeters]) assert(Number.isFinite(value));
    assert(nextTake.strikeZone.halfWidth > 0 && nextTake.strikeZone.upperY > nextTake.strikeZone.lowerY && nextTake.ballRadiusMeters > 0);
    const position = f.release.positionAtDay('career-a', 'p2', 10, action.request.delivery.moundReference);
    assert.equal(action.request.delivery.physics.velocity.z, -30); assert.equal(fatigue.velocityRetentionAtFullFatigue, 0.5);
    assert.deepEqual(action.request.flight.acceleration, { x: 0, y: 0, z: 0 });
    assert(position.z > nextTake.plateZ && position.z + action.request.delivery.physics.velocity.z * fatigue.velocityRetentionAtFullFatigue * action.request.flight.durationUs / 1_000_000 < nextTake.plateZ);
    checked.push('exact take/request schema and conservative plate-crossing input feasibility; no pitch outcome claimed');

    for (const table of ['physical_pitch_progress_actions', 'physical_pitch_progress_heads', 'applications', 'world_player_workload_activities']) assert.equal(count(table), 0);
    checked.push('zero accepted pitch/actions, official applications and workload effects after setup');
    return { kind: 'known_profile_setup_preflight', checked, initialRuleProfileId: original.ruleProfileId,
      ruleProfileSha256: actorHash(NPB_2026_RULE_PROFILE), originalMatch: original, fixture: f.initial.fixture,
      originalParticipants: bindings, personReferences: persons.map(person => ({ sourceId: person.sourceId, personId: person.personId })),
      roleEffortFixtureInputs: ids.map((playerId, effortUnits) => ({ playerId, effortUnits })),
      existingRoleBaselinePlayerIds: ['p2'], missingRoleBaselinePlayerIds: ids.filter(id => id !== 'p2'),
      retainedPitcherBaseline: baseline, explicitAddedPolicy, explicitAddedBaseline: { fatigue: 0.1, recoveryCapacity: 0.5 },
      nextBatterPlayerId: 'away-2', nextRosterEligibility: eligibility, nextTake,
      acceptedPhysicalPitchActions: 0, acceptedOfficialApplications: 0, acceptedWorkloadActivities: 0, acceptedNextActors: 0,
      pureFirstInputPitchCalculationsOccurred: true,
      pendingOwnerGates: ['genuine grounded fair OUT and unique touch', 'operative original call and current rule', 'physical end/seal and whole-history evidence',
        'official closure/application and unsupported scoring check', 'ten end-bound assessments and exact frozen BEFORE/AFTER',
        'actual next activation, accepted actor, physical take and close/reopen/retry', 'fresh known-profile producer lineage and same-run seal rollback witness'],
      wholePipelinePassed: false };
  } finally { f.close(); }
};
