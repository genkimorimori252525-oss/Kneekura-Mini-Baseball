import type { BattedWorldAcquisition } from '../../core/sim/ball/BattedWorldAcquisition';
import { afterEach, expect, it } from 'vitest';
import { contactFixture } from './StandalonePracticeContact.test-support';
import { openSqliteStandalonePracticeStore, type AcceptedStandalonePracticeAssessment } from './SqliteStandalonePracticeStore';
import { executeStandalonePracticeMotion, type AcceptedStandalonePractice } from './StandalonePracticeMotion';
import type { StandaloneGloveReceiveCommand, StandaloneBattingContactCommand } from './StandalonePracticeContact';
import { planCourseAwareSwingKinematicsV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import { readNativeDevelopmentEpisodeFromSqlite } from './NativeDevelopmentEpisodeFromSqlite';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const open = (f: Awaited<ReturnType<typeof contactFixture>>, source: AcceptedStandalonePractice) => {
  const commands = new Map([[source.sourceId, source]]), assessments = new Map<string, AcceptedStandalonePracticeAssessment>();
  const owner = openSqliteStandalonePracticeStore(f.path, f.sources.episodes, {
    readAcceptedPractice: id => commands.get(id) ?? null, readAcceptedAssessment: id => assessments.get(id) ?? null,
  }); cleanup.push(owner.close);
  const assess = () => {
    const assessment: AcceptedStandalonePracticeAssessment = { sourceId: 'contact-assessment', sourceVersion: 'test-v1',
      opportunitySourceId: source.sourceId, physicalProofHash: owner.read(source.sourceId)!.physicalProofHash!, effortUnits: 2, relevant: true,
      factors: { trainingStimulus: 1, coachingFit: 1, challengeFit: 1, healthAvailability: 0.8, motivation: 1, opportunity: 1, novelty: 1 },
      provenance: { assessmentSourceId: 'independent-contact-assessment', assessmentVersion: 'v1', calibrationSourceId: 'explicit-effort', calibrationVersion: 'v1' } };
    assessments.set(assessment.sourceId, assessment); const result = owner.assess(assessment.sourceId);
    f.learningEvents.set(result.event!.sourceEventId, result.event!); return result;
  };
  return { owner, commands, assess };
};
const sourceFor = (f: Awaited<ReturnType<typeof contactFixture>>, command: StandaloneGloveReceiveCommand | StandaloneBattingContactCommand,
  startTick: number, endTick: number): AcceptedStandalonePractice => ({ sourceId: 'contact-drill', sourceVersion: 'test-v1',
  opportunityId: 'contact-opportunity', careerId: 'career-a', playerId: 'p1', personLinkSourceId: 'intake-p1', atDay: 13,
  startTick, endTick, ticksPerSecond: 1_000_000, workloadRevision: 0, episodeId: 'episode', episodeRevision: 2, domain: 'TECHNICAL',
  bodySourceId: command.kind === 'BATTING_CONTACT' ? f.batting.bodyMaterialization.source.sourceId : f.defenderRequest.sourceId,
  modelSourceId: command.kind === 'BATTING_CONTACT' ? f.batting.source.sourceId : f.fieldingModel.source.sourceId, command });

it('receives an actually released practice pitch, adopts uninterrupted capture and retries one original workload/learning application', async () => {
  const f = await contactFixture(cleanup), release = f.pitch.plannedDelivery.release;
  const command: StandaloneGloveReceiveCommand = { kind: 'STATIONARY_GLOVE_RECEIVE', pitchAttemptId: f.pitch.attemptId,
    calibrationRef: { sourceId: 'explicit-catching-physics', sourceVersion: 'v1' },
    rootPosition: { x: release.position.x, y: release.position.y - 0.15, z: release.position.z - 2 },
    parameters: { ticksPerSecond: 1_000_000, gravityY: 0, ballRadius: 0.0366, groundRestitution: 0.35, groundFriction: 0.78,
      groundRollingDecelerationMps2: 4, integrationStepTicks: 2000, restingVerticalSpeed: 0.5 }, surfaces: [],
    glove: { pocketCenterOffset: { x: 0, y: 0, z: 0.1166 }, bodyStability: 1,
      retention: { ticksPerSecond: 1_000_000, ballMassKg: 0.145, ballRadiusMeters: 0.0366, pocketRadiusMeters: 0.2,
        centerRetentionCapacityJ: 1000, captureDissipationPowerW: 1000, failedContactRestitution: 0.4, failedTangentialDamping: 0.5, failedSpinDamping: 0.5 },
      skill: { lowAbilityCenterRetentionCapacityMultiplier: 0.8, highAbilityCenterRetentionCapacityMultiplier: 1.2,
        lowAbilityCaptureDissipationPowerMultiplier: 0.8, highAbilityCaptureDissipationPowerMultiplier: 1.2 } },
    otherBodyMaterial: { restitution: 0.2, tangentialDamping: 0.5, spinDamping: 0.5 } };
  const source = sourceFor(f, command, 0, release.releaseAtUs + 300000), { owner, commands, assess } = open(f, source);
  commands.set('late-start', { ...source, sourceId: 'late-start', opportunityId: 'late-start', startTick: release.releaseAtUs + 40000 });
  expect(() => owner.begin('late-start')).toThrow('must start no later than original release');
  expect(owner.read('late-start')).toBeNull();
  const reserved = owner.begin(source.sourceId); expect(reserved.complete).toBe(false);
  const partialTick = release.releaseAtUs + 40000;
  expect(() => owner.advance(source.sourceId, 0, partialTick)).toThrow('release has not been consumed');
  expect(owner.read(source.sourceId)!.progress.revision).toBe(0);
  f.owner.advance(f.pitch.attemptId, 0, release.releaseAtUs);
  commands.set('late', { ...source, sourceId: 'late', opportunityId: 'late' });
  expect(() => owner.begin('late')).toThrow('must precede consumed pitch release');
  const partial = owner.advance(source.sourceId, 0, partialTick);
  expect(partial.progress.execution).toMatchObject({ kind: command.kind, state: 'capturing', repetitionOccurred: true, completionAllowed: false });
  expect(owner.settle(source.sourceId).kind).toBe('pending');
  const pitch = f.owner.advance(f.pitch.attemptId, 1, f.pitch.plannedDelivery.timeline.followThroughEndUs);
  f.assess(pitch); f.owner.settle(pitch.attemptId);
  expect(owner.advance(source.sourceId, 0, partialTick)).toEqual(partial);
  const completed = owner.advance(source.sourceId, 1, source.endTick);
  expect(completed.complete).toBe(true);
  expect(completed.progress.execution).toMatchObject({ state: 'secured', repetitionOccurred: true });
  const acquisitionOf = (value: ReturnType<typeof executeStandalonePracticeMotion>) => {
    if (value.kind !== 'STATIONARY_GLOVE_RECEIVE') throw new Error('wrong fixture family');
    const event = value.events.find(item => !!item && typeof item === 'object' && 'acquisition' in item) as { acquisition: BattedWorldAcquisition } | undefined;
    if (!event || event.acquisition.kind !== 'secured') throw new Error('fixture has no actual secure acquisition');
    return event.acquisition;
  };
  const actual = acquisitionOf(completed.progress.execution);
  // Explicit test calibration places the continuous deadline inside the same
  // tick whose twice-quantized retention estimate would be one tick later.
  const edgeSource = { ...source, command: { ...command, glove: { ...command.glove, retention: { ...command.glove.retention,
    captureDissipationPowerW: actual.retention.diagnostics.retentionLoadJ / 0.0600001 } } } };
  const edge = acquisitionOf(executeStandalonePracticeMotion(edgeSource, reserved.reservation.frame, source.endTick));
  expect(edge.archivedCandidateSecureTick).toBe(edge.secureTick + 1);
  expect(executeStandalonePracticeMotion({ ...edgeSource, endTick: edge.secureTick }, reserved.reservation.frame, edge.secureTick))
    .toMatchObject({ state: 'secured', completionAllowed: true });
  expect(executeStandalonePracticeMotion({ ...edgeSource, endTick: edge.secureTick - 1 }, reserved.reservation.frame, edge.secureTick - 1))
    .toMatchObject({ state: 'capturing', completionAllowed: false });
  const failed = executeStandalonePracticeMotion({ ...source, command: { ...command, glove: { ...command.glove,
    retention: { ...command.glove.retention, centerRetentionCapacityJ: 0.001 } } } }, reserved.reservation.frame, source.endTick);
  expect(failed).toMatchObject({ state: 'free', repetitionOccurred: true });
  const assessed = assess();
  f.db.exec("CREATE TRIGGER interrupt_contact_learning BEFORE INSERT ON world_development_learning_events BEGIN SELECT RAISE(ABORT,'contact learning interrupted'); END;");
  expect(() => owner.settle(source.sourceId)).toThrow('contact learning interrupted');
  expect(f.sources.workload.readHead('career-a', 'p1')!.revision).toBe(1);
  f.db.exec('DROP TRIGGER interrupt_contact_learning');
  const settled = owner.settle(source.sourceId); expect(settled.kind).toBe('complete');
  expect(owner.settle(source.sourceId)).toEqual(settled);
  expect(f.db.prepare("SELECT COUNT(*) n FROM world_player_workload_activities WHERE player_id='p1'").get()!.n).toBe(1);
  owner.close();
  const reopened = openSqliteStandalonePracticeStore(f.path, f.sources.episodes); cleanup.push(reopened.close);
  expect(reopened.read(source.sourceId)).toEqual(completed); expect(reopened.settle(source.sourceId)).toEqual(settled);
  f.db.exec('BEGIN');
  try { expect(readNativeDevelopmentEpisodeFromSqlite(f.db, 'episode', 3)!.episode.practiceSourceEventIds).toEqual([assessed.event!.sourceEventId]); }
  finally { f.db.exec('ROLLBACK'); }
});

it('executes an original model bat against the consumed release, preserving actual contact and outgoing free-ball state', async () => {
  const f = await contactFixture(cleanup), release = f.pitch.plannedDelivery.release;
  const profile = f.batting.repertoire.values.profiles[0].profile;
  const plan = { handedness: 'R' as const, batterCenterOfMass: { x: release.position.x - 0.8, y: 0.95, z: 0 },
    targetBallCenterAtPlate: { x: release.position.x, y: release.position.y, z: 0 },
    strikeZone: { centerX: release.position.x, halfWidth: 0.22, lowerY: 0.5, upperY: 1.8 }, contactTick: release.releaseAtUs + 600000 };
  const depth = planCourseAwareSwingKinematicsV1({ ...plan, ticksPerSecond: 1_000_000, profile }).preferredContactDepthM;
  plan.contactTick = release.releaseAtUs + Math.round((release.position.z - depth) / -release.velocity.z * 1_000_000);
  const trajectory = planCourseAwareSwingKinematicsV1({ ...plan, ticksPerSecond: 1_000_000, profile }).trajectory;
  const command: StandaloneBattingContactCommand = { kind: 'BATTING_CONTACT', pitchAttemptId: f.pitch.attemptId,
    calibrationRef: { sourceId: 'explicit-actual-flight', sourceVersion: 'v1' }, issuedTick: 0, bodyReadyTick: 0,
    profileId: profile.profileId, profileVersion: profile.version, plan, parameters: { ticksPerSecond: 1_000_000, integrationStepTicks: 2000,
      gravityY: 0, aerodynamics: { ballMassKg: 0.145, ballRadiusM: 0.0366, airDensityKgM3: 0, windVelocityMps: { x: 0, y: 0, z: 0 }, dragCoefficient: 0 } } };
  const source = sourceFor(f, command, trajectory.startTick, trajectory.endTick), { owner, assess } = open(f, source);
  owner.begin(source.sourceId);
  expect(() => owner.advance(source.sourceId, 0, source.endTick)).toThrow('release has not been consumed');
  const pitch = f.owner.advance(f.pitch.attemptId, 0, f.pitch.plannedDelivery.timeline.followThroughEndUs); f.assess(pitch); f.owner.settle(pitch.attemptId);
  const completed = owner.advance(source.sourceId, 0, source.endTick);
  expect(completed.complete).toBe(true);
  const execution = completed.progress.execution;
  if (execution.kind !== 'BATTING_CONTACT') throw new Error('wrong contact family');
  expect(execution.contact).not.toBeNull(); expect(execution.repetitionOccurred).toBe(true);
  expect(execution.ball!.velocity).toEqual(execution.contact!.exitVelocity);
  expect(execution.ball!.tick).toBe(execution.contact!.tick);
  assess(); const settled = owner.settle(source.sourceId);
  expect(settled.kind).toBe('complete'); expect(owner.settle(source.sourceId)).toEqual(settled);
  expect(f.sources.workload.readHead('career-a', 'p1')).toMatchObject({ revision: 1, fatigue: 0.4 });
});
