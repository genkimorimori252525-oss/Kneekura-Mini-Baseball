import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { actorHash as hash, actorJson as json, physicalActorInput } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { physicalPitchActionInput } from '../../../src/host/world/PhysicalPitchEvidenceFromSqlite';
import { readActualRoleWorkloadState } from '../../../src/host/world/ActualRoleWorkloadState';
import { assertNoLegacyPitchWorkloadCharge } from '../../../src/host/world/ActualRoleWorkloadChargeGuard';
import { readOfficialActorPersonLink } from '../../../src/host/world/SqliteOfficialInitialWorldStore';
import { actualLiveAdjudicationProfile } from '../../../src/host/world/ActualLiveAdjudicationSource';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from '../../../src/core/rules/RuleProfile';
import { prepareBetweenPlayWorld } from '../../../src/core/adjudication/BetweenPlayWorldReset';
import { createRosterState } from '../../../src/core/world/roster/RosterState';
import { evaluateRosterParticipation } from '../../../src/core/world/roster/RosterQueries';
import { createPlayerPitchTimingSource, selectPlayerPitchTimingProfile } from '../../../src/core/world/development/PlayerPitchTimingSource';
import { applyPitchFatigueToExecution } from '../../../src/core/sim/pitch/PitchFatigueExecution';
import { projectReleaseHeightTier, resolvePitcherReleasePosition } from '../../../src/core/sim/pitch/PitcherReleaseGeometry';
import type { ActualLivePlayClosureProposal } from '../../../src/host/world/ActualLivePlayClosureEvidenceFromSqlite';
import type { actualRoleWorkloadEvidenceFromSqlite } from '../../../src/host/world/ActualRoleWorkloadEvidenceFromSqlite';
import type { AcceptedActualRoleWorkloadAssessment } from '../../../src/host/world/ActualRoleWorkloadAssessment';
import type { AcceptedPlayerWorkloadBaseline } from '../../../src/host/world/SqlitePlayerWorkloadRecoveryStore';
import type { AcceptedPitchTimingBaseline } from '../../../src/host/world/SqlitePlayerPitchTimingStore';
import type { AcceptedReleaseGeometryBaseline } from '../../../src/host/world/SqlitePlayerReleaseGeometryStore';
import type { AcceptedPitchFatiguePolicy } from '../../../src/host/world/SqlitePitchFatiguePolicyStore';
import type { AcceptedPhysicalPitchActionSource, DurablePhysicalPitch } from '../../../src/host/world/SqlitePhysicalPitchProgressStore';
import type { OfficialParticipantBinding } from '../../../src/host/world/SqliteOfficialParticipationStore';
import type { OriginalOfficialReplayReceipt, ReplayArtifactFacts } from './official-read-replay-helper';

type Settlement = ReturnType<ReturnType<typeof actualRoleWorkloadEvidenceFromSqlite>['readSettlement']>;
type RoleReceipt = Readonly<{ output: ReplayArtifactFacts; settlement: Settlement; acceptedInputManifest: Readonly<{
  assessments: readonly AcceptedActualRoleWorkloadAssessment[];
  baselineEvidence: readonly Readonly<{ source: AcceptedPlayerWorkloadBaseline; sourceHash: string }>[] }> }>;
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const closed = (path: string, expected: string) => {
  assert(isAbsolute(path) && normalize(path) === path && realpathSync(path) === path);
  assert(!existsSync(`${path}-wal`) || statSync(`${path}-wal`).size === 0); assert.equal(fileHash(path), expected);
};
/** Fixture prerequisites after the caller admits all 24 raw pins. These cheap
 * archive reads make no physical/closure/readiness replay or acceptance claim. */
export const verifyActualNextInputPrerequisites = (input: Readonly<{ artifactPath: string; artifactSha256: string;
  roleReceipt: RoleReceipt; originalReceipt: OriginalOfficialReplayReceipt; nextBatterPlayerId: string;
  nextTake: Extract<AcceptedPhysicalPitchActionSource['request']['batter'], { action: { kind: 'take' } }> }>) => {
  const role = input.roleReceipt, settlement = role.settlement, original = input.originalReceipt;
  assert.deepEqual(input.nextTake, { action: { kind: 'take' }, plateZ: 0,
    strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 });
  assert.equal(settlement.kind, 'complete'); if (settlement.kind !== 'complete') throw new Error('next fixture requires complete roles');
  assert.equal(role.output.path, input.artifactPath); assert.equal(role.output.sha256, input.artifactSha256);
  closed(input.artifactPath, input.artifactSha256); const db = new DatabaseSync(input.artifactPath, { readOnly: true });
  let report;
  try { report = withSqliteReadTransaction(db, () => {
    assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1); assert.equal(db.isTransaction, true);
    assert.equal(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file, input.artifactPath);
    assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => String(row.name));
    const rowCounts = Object.fromEntries(names.map(name => [name, Number(db.prepare(`SELECT count(*) AS n FROM "${name.replaceAll('"', '""')}"`).get()!.n)]));
    assert.deepEqual(rowCounts, role.output.rowCounts);
    for (const name of ['actual_role_workload_assessments', 'world_player_workload_activities']) assert.equal(rowCounts[name], 10);
    for (const name of ['actual_role_workload_settlements', 'applications', 'actual_first_base_play_ends', 'actual_live_play_fences', 'physical_plate_appearance_actors', 'physical_pitch_progress_actions']) assert.equal(rowCounts[name], 1);
    const kinds = db.prepare("SELECT json_extract(source_json,'$.kind') AS kind,count(*) AS n FROM world_player_workload_activities GROUP BY kind ORDER BY kind").all().map(row => ({ kind: row.kind, n: row.n }));
    assert.deepEqual(kinds, [{ kind: 'MATCH', n: 10 }]); assert.deepEqual(kinds, role.output.workloadActivityKinds);
    const row = db.prepare('SELECT * FROM actual_live_play_closures WHERE source_id=?').get(settlement.closureSourceId); assert(row);
    const p = JSON.parse(String(row.proposal_json)) as ActualLivePlayClosureProposal, source = JSON.parse(String(row.source_json));
    assert.equal(row.source_json, json(source)); assert.equal(row.source_hash, hash(source)); assert.deepEqual(source, p.source);
    assert.equal(row.proposal_json, json(p)); assert.equal(row.proposal_hash, hash(p)); assert.equal(row.proposal_hash, settlement.closureProposalHash);
    assert.equal(row.status, 'OFFICIAL_APPLIED'); assert.equal(row.application_id, original.applicationId);
    assert.equal(p.source.sourceId, original.closureSourceId); assert.equal(p.application.applicationId, settlement.closureApplicationId);
    assert.deepEqual(p.physicalEndReference, settlement.physicalEndReference); assert.deepEqual(p.wholeHistoryReference, settlement.wholeHistoryReference);
    assert('activation' in p.expectedOfficial, 'next fixture cannot follow a final game');
    assert.deepEqual(p.expectedOfficial.receipt, original.officialReceipt); assert.equal(p.scoring.kind, 'unsupported');
    const match = db.prepare('SELECT * FROM matches WHERE match_id=?').get(p.gameId); assert(match);
    assert.equal(match.durable_revision, p.expectedOfficial.receipt.durableRevision);
    assert.equal(match.state_json, json(p.expectedOfficial.activation.nextMatchState));
    assert.equal(match.activation_json, json({ activation: p.expectedOfficial.activation, nextWorld: p.expectedOfficial.nextWorld }));
    assert.equal(getRuleProfile(p.application.match.ruleProfileId), NPB_2026_RULE_PROFILE);
    assert.equal(p.expectedOfficial.activation.nextMatchState.ruleProfileId, p.application.match.ruleProfileId);
    const adjudication = db.prepare('SELECT source_json FROM actual_live_adjudications WHERE source_id=?').get(p.source.adjudicationSourceId); assert(adjudication);
    const profile = actualLiveAdjudicationProfile(p.application.match.ruleProfileId, JSON.parse(String(adjudication.source_json)).policy);
    assert.deepEqual(profile.officialWindows, { appeal: { available: true }, review: { available: false }, challenge: { available: false } });
    assert.equal(p.controllerReset.kind, 'rule_system_retire_original_play'); assert.equal(p.controllerReset.retired.length, 10);
    assert.deepEqual(p.controllerReset.physicalEndReference, settlement.physicalEndReference); assert.equal(p.controllerReset.previousPlayId, settlement.playId);
    assert(p.source.worldSetup && p.source.nextStartedAtTick !== null);
    assert.deepEqual(prepareBetweenPlayWorld(p.expectedOfficial.activation.nextMatchState, p.source.nextStartedAtTick, p.source.worldSetup), p.expectedOfficial.nextWorld);
    assert.equal(p.expectedOfficial.nextWorld.runners.length, 0); assert.equal(p.expectedOfficial.activation.nextMatchState.half, 'top');
    const planRow = db.prepare('SELECT * FROM actual_role_workload_settlements WHERE closure_source_id=?').get(settlement.closureSourceId); assert(planRow);
    const frozen = { ...settlement, kind: 'frozen', participants: settlement.participants.map(({ applied: _applied, ...participant }) => participant) };
    assert.equal(planRow.plan_json, json(frozen)); assert.equal(planRow.plan_hash, hash(frozen));
    const heads = settlement.participants.map((participant, index) => {
      const actor = p.actors.find(value => value.binding.playerId === participant.playerId); assert(actor);
      assert.equal(actor.person.personId, participant.personId); assert.equal(actor.binding.clubId, participant.clubId); assert.equal(participant.applied, true);
      const accepted = role.acceptedInputManifest.assessments[index]; assert.equal(accepted.sourceId, participant.assessmentSourceId);
      assert.equal(accepted.participantReference.bindingHash, hash(actor.binding)); assert.equal(accepted.participantReference.personHash, hash(actor.person));
      const assessment = db.prepare('SELECT * FROM actual_role_workload_assessments WHERE source_id=?').get(participant.assessmentSourceId); assert(assessment);
      assert.equal(assessment.source_json, json(accepted)); assert.equal(assessment.source_hash, hash(accepted));
      assert.equal(assessment.snapshot_hash, hash(JSON.parse(String(assessment.snapshot_json))));
      assert.equal(assessment.snapshot_hash, settlement.assessmentHashes.find(value => value.sourceId === participant.assessmentSourceId)!.hash);
      assertNoLegacyPitchWorkloadCharge(db, { careerId: settlement.careerId, gameId: settlement.gameId, playId: settlement.playId, playerId: participant.playerId });
      const head = readActualRoleWorkloadState(db, settlement.careerId, participant.playerId, undefined, actor.binding.personLinkSourceId);
      assert.deepEqual(head, participant.after);
      const baseline = role.acceptedInputManifest.baselineEvidence[index]; assert.equal(baseline.sourceHash, hash(baseline.source));
      assert.equal(db.prepare('SELECT source_json FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(settlement.careerId, participant.playerId)!.source_json, json(baseline.source));
      const activity = db.prepare('SELECT * FROM world_player_workload_activities WHERE source_id=?').get(participant.activity.sourceEventId); assert(activity);
      assert.equal(activity.source_json, json(participant.activity)); assert.equal(activity.before_json, json(participant.before)); assert.equal(activity.after_json, json(participant.after));
      return head!;
    });
    assert.equal(input.nextBatterPlayerId, 'away-2');
    const bindingRow = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get(p.gameId, input.nextBatterPlayerId); assert(bindingRow);
    const binding = JSON.parse(String(bindingRow.binding_json)) as OfficialParticipantBinding, person = readOfficialActorPersonLink(db, binding);
    assert.equal(binding.side, 'AWAY'); assert.equal(binding.clubId, 'club-b'); assert.equal(binding.careerId, settlement.careerId);
    assert.equal(binding.gameDay, settlement.gameDay); assert.equal(binding.fixtureEventId, 'fixture-1'); assert.equal(binding.rosterRevision, 0);
    assert(!p.actors.some(actor => actor.person.personId === person.personId));
    assert(!Object.values(p.expectedOfficial.activation.nextMatchState.bases).includes(binding.playerId));
    const rosterRow = db.prepare('SELECT * FROM world_roster_heads WHERE career_id=?').get(settlement.careerId); assert(rosterRow);
    const roster = createRosterState(JSON.parse(String(rosterRow.roster_json))); assert.equal(rosterRow.roster_json, json(roster)); assert.equal(rosterRow.revision, roster.revision);
    const eligibility = evaluateRosterParticipation(roster, { playerId: binding.playerId, clubId: binding.clubId, competitionEditionId: binding.competitionEditionId });
    assert.equal(eligibility.eligible, true); assert.deepEqual(eligibility.reasons, []);
    const actorInput = physicalActorInput({ sourceId: 'fixture-next-actual-batter', sourceVersion: 'fixture-v1', gameId: p.gameId,
      playerId: binding.playerId, activationApplicationId: p.application.applicationId }, 'fixture-next-actual-batter');
    for (const table of ['physical_plate_appearance_actors', 'physical_pitch_progress_actions', 'physical_pitch_progress_heads'])
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE game_id=? AND play_id=?`).get(p.gameId, p.playId + 1)!.n, 0);
    const pitchRow = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=?').get(p.gameId, p.playId); assert(pitchRow);
    const pitch = JSON.parse(String(pitchRow.snapshot_json)) as DurablePhysicalPitch;
    assert.equal(pitchRow.snapshot_json, json(pitch)); assert.equal(pitchRow.snapshot_hash, hash(pitch));
    assert.equal(pitchRow.source_json, json(pitch.source)); assert.equal(pitchRow.source_hash, hash(pitch.source));
    assert.equal(pitch.progressRevision, 1); assert.equal(pitchRow.progress_revision, 1); assert.equal(pitch.frame.gameId, p.gameId); assert.equal(pitch.frame.match.playId, p.playId);
    const pitchHead = db.prepare('SELECT * FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?').get(p.gameId, p.playId); assert(pitchHead);
    assert.equal(pitchHead.revision, 1); assert.equal(pitchHead.last_source_id, pitch.source.sourceId);
    const delivery = pitch.source.request.delivery, workload = heads.find(value => value.playerId === delivery.playerId); assert(workload);
    assert.equal(delivery.playerId, 'p2'); assert.equal(delivery.careerId, settlement.careerId); assert.equal(delivery.gameDay, settlement.gameDay);
    assert.equal(p.expectedOfficial.nextWorld.defenders.filter(value => value.registeredPosition === 'P').length, 1);
    assert.equal(p.expectedOfficial.nextWorld.defenders.find(value => value.registeredPosition === 'P')!.playerId, delivery.playerId);
    const timingRow = db.prepare('SELECT * FROM world_pitch_timing_baselines WHERE career_id=? AND player_id=?').get(delivery.careerId, delivery.playerId); assert(timingRow);
    const timingSource = JSON.parse(String(timingRow.source_json)) as AcceptedPitchTimingBaseline;
    assert.equal(rowCounts.world_pitch_timing_updates, 0); assert.equal(timingSource.personLinkSourceId, 'intake-p2'); assert(timingSource.acceptedAtDay <= delivery.gameDay);
    const timingState = createPlayerPitchTimingSource({ careerId: delivery.careerId, playerId: delivery.playerId, createdAtDay: timingSource.acceptedAtDay, profile: timingSource.profile });
    assert.equal(timingRow.initial_json, json(timingState)); assert.equal(db.prepare('SELECT state_json FROM world_pitch_timing_heads WHERE career_id=? AND player_id=?').get(delivery.careerId, delivery.playerId)!.state_json, json(timingState));
    assert.deepEqual(selectPlayerPitchTimingProfile(timingState, delivery.playerId, delivery.gameDay), pitch.frame.timing);
    const releaseRow = db.prepare('SELECT source_json FROM world_player_release_baselines WHERE career_id=? AND player_id=?').get(delivery.careerId, delivery.playerId); assert(releaseRow);
    const release = JSON.parse(String(releaseRow.source_json)) as AcceptedReleaseGeometryBaseline; assert.equal(rowCounts.world_player_release_changes, 0);
    assert.equal(release.personLinkSourceId, 'intake-p2'); assert(release.acceptedAtDay <= delivery.gameDay);
    const releaseSnapshot = { sourceId: release.sourceId, sourceVersion: release.sourceVersion, effectiveDay: release.acceptedAtDay, body: release.body, profile: release.profile };
    assert.deepEqual(releaseSnapshot, pitch.frame.release); assert.equal(projectReleaseHeightTier(release.profile.releaseHeightRatio, release.tierBoundaries), release.profile.releaseHeightTier);
    const releaseHead = { careerId: delivery.careerId, playerId: delivery.playerId, revision: 0, tierBoundaries: release.tierBoundaries, baseline: releaseSnapshot, changes: [] };
    assert.equal(db.prepare('SELECT state_json FROM world_player_release_heads WHERE career_id=? AND player_id=?').get(delivery.careerId, delivery.playerId)!.state_json, json(releaseHead));
    const policyRow = db.prepare('SELECT * FROM world_pitch_fatigue_policies WHERE source_id=?').get(pitch.source.request.policySourceId); assert(policyRow);
    const policy = JSON.parse(String(policyRow.source_json)) as AcceptedPitchFatiguePolicy; assert.deepEqual(policy, pitch.frame.policy);
    assert.equal(policyRow.source_hash, hash(policy)); const { sourceId: _sourceId, sourceVersion: _sourceVersion, ...response } = policy;
    assert.equal(policyRow.policy_json, json(response));
    assert.deepEqual(pitch.source.effortPolicy, { sourceId: 'effort', sourceVersion: 'fixture-v1', policyId: 'effort', version: 'v1', availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 });
    const nextPitchInput = physicalPitchActionInput({ sourceId: 'fixture-next-actual-pitch', sourceVersion: 'fixture-v1', gameId: p.gameId,
      activationApplicationId: p.application.applicationId, effortPolicy: pitch.source.effortPolicy,
      request: { ...pitch.source.request, workloadRevision: workload.revision,
        delivery: { ...delivery, readyAtUs: p.expectedOfficial.nextWorld.tick }, batter: input.nextTake } }, 'fixture-next-actual-pitch');
    const adjusted = applyPitchFatigueToExecution(pitch.frame.timing, delivery.physics, workload.fatigue, response, delivery.gameDay);
    const releasePosition = resolvePitcherReleasePosition({ ...release.body, moundReference: delivery.moundReference }, release.profile);
    assert.deepEqual(pitch.source.request.flight.acceleration, { x: 0, y: 0, z: 0 });
    assert(releasePosition.z > input.nextTake.plateZ && releasePosition.z + adjusted.physics.velocity.z * pitch.source.request.flight.durationUs / 1_000_000 < input.nextTake.plateZ);
    assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0);
    const recipe = { actorInput, nextPitchInput, workload, nextWorld: p.expectedOfficial.nextWorld };
    return { kind: 'actual_next_prerequisites_only', wholePipelinePassed: false, readOnly: true, physicalContextReads: 0,
      readinessReads: 0, acceptedActors: 0, acceptedPitches: 0, workloadActivitiesWritten: 0, rowCounts,
      registeredRuleProfileId: profile.id, ruleSystemSetupVerified: true, physicalWorldRecoveryProven: false,
      recipe, recipeSha256: hash(recipe), pendingObligations: ['both next-actor faults', 'real actor admission/retry', 'real pitch/retry', 'all-close/reopen'] };
  }); assert.equal(db.isTransaction, false); } finally { db.close(); }
  closed(input.artifactPath, input.artifactSha256); assert.equal(db.isOpen, false);
  return { ...report, allConnectionsClosed: true, originalArtifactUnchanged: true };
};
