import { afterEach, expect, it } from 'vitest';
import { practiceActivityId } from './PitchPracticeAttempt';
import { practiceFixture } from './PitchPracticeAttempt.test-support';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
import { openSqlitePlayerRunnerDecisionMotionModelStore } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { openSqliteStandalonePracticeStore, type AcceptedStandalonePracticeAssessment } from './SqliteStandalonePracticeStore';
import { executeStandalonePracticeMotion, type StandalonePracticeMotionFrame, type AcceptedStandalonePractice } from './StandalonePracticeMotion';
import { openSqliteDevelopmentPracticeExposureStore, readNativeDevelopmentPracticeExposureFromSqlite, type AcceptedDevelopmentPracticeExposure } from './SqliteDevelopmentPracticeExposureStore';
import type { BodyMaterializationRequest, AcceptedBodySource, AcceptedPoseSource, AcceptedReachSource } from './PlayerBodyCapabilityMaterialization';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = async () => {
  const f = await practiceFixture(cleanup), sourceVersion = 'explicit-test-v1';
  const scope = { careerId: 'career-a', playerId: 'p1', personId: 'person-p1', personLinkSourceId: 'intake-p1' };
  const body: AcceptedBodySource = { ...scope, sourceId: 'runner-body', sourceVersion, acceptedAtDay: 12, physicalProfile: { heightMeters: 1.8 } };
  const pose: AcceptedPoseSource = { ...scope, sourceId: 'runner-pose', sourceVersion, acceptedAtDay: 12,
    bodyRef: { sourceId: body.sourceId, sourceVersion }, primitives: [
      { role: 'body', radius: 0.2, offset: { x: 0, y: 0, z: 0 } },
      { role: 'glove', radius: 0.08, offset: { x: 0.3, y: 0.15, z: 0.1 } },
      { role: 'tag_hand', radius: 0.06, offset: { x: -0.3, y: 0.1, z: 0 } },
      { role: 'left_foot', radius: 0.07, offset: { x: -0.1, y: -0.88, z: 0 } },
      { role: 'right_foot', radius: 0.07, offset: { x: 0.1, y: -0.88, z: 0 } },
    ] };
  const reach: AcceptedReachSource = { sourceId: 'runner-reach', sourceVersion, acceptedAtDay: 12,
    baseline: { bodyOriginHeightMeters: 0.95, maximumLegReachMeters: 1.5, maximumGloveReachMeters: 1.3, maximumTagReachMeters: 1.1 } };
  const request: BodyMaterializationRequest = { ...scope, sourceId: 'runner-materialization', sourceVersion, atDay: 12, role: 'runner',
    bodyRef: { sourceId: body.sourceId, sourceVersion }, poseRef: { sourceId: pose.sourceId, sourceVersion },
    reachCalibrationRef: { sourceId: reach.sourceId, sourceVersion }, fieldingModelRef: null, releaseGeometryRef: null };
  const bodies = openSqlitePlayerBodyCapabilityMaterializationStore(f.path, {
    readAcceptedMaterialization: id => id === request.sourceId ? request : null, readAcceptedBody: id => id === body.sourceId ? body : null,
    readAcceptedPose: id => id === pose.sourceId ? pose : null, readAcceptedReachCalibration: id => id === reach.sourceId ? reach : null,
  }); cleanup.push(bodies.close); expect(bodies.accept(request.sourceId).kind).toBe('materialized');
  const models = openSqlitePlayerRunnerDecisionMotionModelStore(f.path, { readAcceptedModel: id => id === 'runner-model' ? {
    sourceId: id, sourceVersion, careerId: scope.careerId, playerId: scope.playerId, personLinkSourceId: scope.personLinkSourceId,
    acceptedAtDay: 12, capability: 'runner_decision_motion_v1', decision: { minimumCueConfidence: 0.5, coachTrust: 0.5,
      minimumAdvanceSafetyMarginTicks: 1, decisionAbility: 0.5, timingParameters: { minimumDecisionDelayTicks: 1, maximumDecisionDelayTicks: 2, fixedRecognitionOffsetTicks: 1 } },
    motion: { ticksPerSecond: 1000, reactionDelayTicks: 50, accelerationMps2: 4, brakingMps2: 8, slideDecelerationMps2: 5, topSpeedMps: 7 },
  } : null }); cleanup.push(models.close); models.accept('runner-model');
  const source: AcceptedStandalonePractice = { sourceId: 'drill', sourceVersion, opportunityId: 'running-drill',
    careerId: scope.careerId, playerId: scope.playerId, personLinkSourceId: scope.personLinkSourceId,
    atDay: 13, startTick: 1000, endTick: 2000, ticksPerSecond: 1000, workloadRevision: 0, bodySourceId: request.sourceId,
    modelSourceId: 'runner-model', episodeId: 'episode', episodeRevision: 2, domain: 'TECHNICAL', command: { kind: 'RUNNING_MOTION',
      initial: { tick: 1000, routeDistanceMeters: 0, speedMps: 0, driveDirection: 0, bodyMode: 'upright' },
      intent: { kind: 'advance', issuedTick: 1000 }, routeOrigin: { x: 1, y: 0.95, z: 2 }, routeDirection: { x: 1, z: 0 } } };
  const commands = new Map([[source.sourceId, source]]), assessments = new Map<string, AcceptedStandalonePracticeAssessment>();
  const owner = openSqliteStandalonePracticeStore(f.path, f.sources.episodes, { readAcceptedPractice: id => commands.get(id) ?? null,
    readAcceptedAssessment: id => assessments.get(id) ?? null }); cleanup.push(owner.close);
  const assess = (relevant = true) => {
    const current = owner.read(source.sourceId)!;
    const value: AcceptedStandalonePracticeAssessment = { sourceId: 'drill-assessment', sourceVersion, opportunitySourceId: source.sourceId,
      physicalProofHash: current.physicalProofHash!, effortUnits: 2, relevant,
      factors: { trainingStimulus: 1, coachingFit: 1, challengeFit: 1, healthAvailability: 0.8, motivation: 1, opportunity: 1, novelty: 1 },
      provenance: { assessmentSourceId: 'independent-coach-assessment', assessmentVersion: 'v1', calibrationSourceId: 'explicit-effort-calibration', calibrationVersion: 'v1' } };
    assessments.set(value.sourceId, value); const result = owner.assess(value.sourceId);
    if (result.event) f.learningEvents.set(result.event.sourceEventId, result.event);
    return result;
  };
  return { ...f, source, commands, pitchOwner: f.owner, pitchAssess: f.assess, owner, assess, assessments };
};

it('consumes original running work, settles one PRACTICE charge and authenticates learning/exposure after reopening', async () => {
  const f = await fixture(), admitted = f.owner.begin('drill');
  expect(admitted.complete).toBe(false);
  expect(f.owner.settle('drill').kind).toBe('pending');
  const prefix = f.owner.advance('drill', 0, 1250);
  const completed = f.owner.advance('drill', 1, 2000);
  expect(f.owner.advance('drill', 0, 1250)).toEqual(prefix);
  expect(completed.complete).toBe(true);
  expect(completed.progress.execution.kind).toBe('RUNNING_MOTION');
  if (completed.progress.execution.kind !== 'RUNNING_MOTION') throw new Error('wrong motion family');
  expect(completed.progress.execution.trajectory.endState.routeDistanceMeters).toBeCloseTo(1.805);
  const assessed = f.assess(); expect(assessed.repetition?.fatigue).toBe(0.2);
  const settled = f.owner.settle('drill'); expect(settled.kind).toBe('complete');
  expect(f.owner.settle('drill')).toEqual(settled);
  expect(f.sources.workload.readHead('career-a', 'p1')).toMatchObject({ revision: 1, fatigue: 0.4 });
  expect(f.db.prepare('SELECT COUNT(*) n FROM world_player_workload_activities').get()!.n).toBe(1);
  expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toEqual([assessed.event!.sourceEventId]);
  for (let index = 1; index < 3; index++) {
    const command = f.source.command;
    if (command.kind !== 'RUNNING_MOTION') throw new Error('wrong fixture family');
    const startTick = 1000 + index * 2000, next: AcceptedStandalonePractice = { ...f.source, sourceId: `drill-${index}`,
      opportunityId: `running-drill-${index}`, workloadRevision: index,
      episodeRevision: f.sources.episodes.read('episode')!.episode.revision, startTick, endTick: startTick + 1000,
      command: { ...command, initial: { ...command.initial, tick: startTick }, intent: { ...command.intent, issuedTick: startTick } } };
    f.commands.set(next.sourceId, next); f.owner.begin(next.sourceId);
    const completedNext = f.owner.advance(next.sourceId, 0, next.endTick);
    const nextAssessment = { ...assessed.assessment, sourceId: `assessment-${index}`, opportunitySourceId: next.sourceId,
      physicalProofHash: completedNext.physicalProofHash! };
    f.assessments.set(nextAssessment.sourceId, nextAssessment);
    const accepted = f.owner.assess(nextAssessment.sourceId);
    f.learningEvents.set(accepted.event!.sourceEventId, accepted.event!); f.owner.settle(next.sourceId);
  }
  for (const [eventId, kind, atDay] of [['feedback', 'FEEDBACK_RECORDED', 15], ['consolidation', 'CONSOLIDATION_RECORDED', 16]] as const) {
    f.learningEvents.set(eventId, { eventId, sourceEventId: eventId, kind, atDay, domain: 'TECHNICAL' });
    f.sources.episodes.advance('episode', eventId, f.sources.episodes.read('episode')!.episode.revision);
  }
  const episode = f.sources.episodes.read('episode')!.episode;
  expect(episode.stage).toBe('CONSOLIDATED');
  const exposureSource: AcceptedDevelopmentPracticeExposure = { sourceId: 'standalone-exposure', sourceVersion: 'test-v1',
    episodeId: episode.episodeId, episodeRevision: episode.revision,
    policy: { policyId: 'explicit-exposure', version: 'v1', availableAtDay: 10, selfDirectedShare: 0.5,
      minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1 },
    prior: { careerId: 'career-a', playerId: 'p1', atDay: 11, domain: 'TECHNICAL', receptivity: 1,
      profileVersion: 'v1', policyId: 'explicit-prior', policyVersion: 'v1' }, pitchFactors: [],
    provenance: { assessmentSourceId: 'explicit-exposure-assessment', assessmentVersion: 'v1', calibrationSourceId: 'explicit-exposure-calibration', calibrationVersion: 'v1' } };
  const exposures = openSqliteDevelopmentPracticeExposureStore(f.path, { development: f.sources.episodes }, {
    readAcceptedExposure: id => id === exposureSource.sourceId ? exposureSource : null }); cleanup.push(exposures.close);
  const exposure = exposures.accept(exposureSource.sourceId);
  expect(exposure.assessment.eligible).toBe(true);
  expect(exposure.bundle.repetitions.map(value => value.fatigue)).toEqual([0.2, 0.4, 0.6000000000000001]);
  expect(exposure.proofs).toHaveLength(3);
  f.owner.close();
  f.db.exec('BEGIN');
  try { expect(readNativeDevelopmentPracticeExposureFromSqlite(f.db, exposureSource.sourceId)).toEqual(exposure); }
  finally { f.db.exec('ROLLBACK'); }
  const reopened = openSqliteStandalonePracticeStore(f.path, f.sources.episodes); cleanup.push(reopened.close);
  expect(reopened.begin('drill')).toEqual(completed);
  expect(reopened.settle('drill')).toEqual(settled);
});

it('keeps unfinished/stationary work separate from relevance and prevents duplicate workload reservations', async () => {
  const f = await fixture();
  const command = f.source.command;
  if (command.kind !== 'RUNNING_MOTION') throw new Error('wrong fixture');
  f.commands.set('drill', { ...f.source, command: { ...command, intent: { ...command.intent, kind: 'hold' } } });
  f.owner.begin('drill');
  expect(() => f.pitchOwner.begin('opportunity-0')).toThrow('blocks a new pitch');
  f.commands.set('alias', { ...f.source, sourceId: 'alias', opportunityId: 'alias' });
  expect(() => f.owner.begin('alias')).toThrow('already reserved');
  f.owner.advance('drill', 0, 2000);
  expect(() => f.assess()).toThrow('stationary');
  f.assess(false);
  expect(f.owner.settle('drill')).toMatchObject({ kind: 'complete', episode: null });
  expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toEqual([]);
  expect(f.sources.workload.readHead('career-a', 'p1')!.revision).toBe(1);
  expect(() => f.pitchOwner.begin('opportunity-0')).toThrow('overlaps');
  f.opportunities.set('opportunity-0', { ...f.opportunity, workloadRevision: 1, readyAtUs: 2_000_000, episode: null });
  expect(f.pitchOwner.begin('opportunity-0').status).toBe('IN_PROGRESS');
});

it('rolls back consumed progress and PRACTICE settlement when a trigger changes original dependencies', async () => {
  const f = await fixture(); f.owner.begin('drill');
  f.db.exec(`CREATE TRIGGER break_progress AFTER INSERT ON standalone_practice_progress BEGIN
    UPDATE standalone_practice_commands SET source_json=json_set(source_json,'$.endTick',3000); END;`);
  expect(() => f.owner.advance('drill', 0, 2000)).toThrow('archive');
  expect(f.owner.read('drill')!.progress.revision).toBe(0);
  f.db.exec('DROP TRIGGER break_progress'); f.owner.advance('drill', 0, 2000); f.assess();
  const before = f.sources.workload.readHead('career-a', 'p1');
  f.db.exec(`CREATE TRIGGER break_work AFTER INSERT ON world_player_workload_activities BEGIN
    UPDATE standalone_practice_progress SET through_tick=1999; END;`);
  expect(() => f.owner.settle('drill')).toThrow('archive');
  expect(f.sources.workload.readHead('career-a', 'p1')).toEqual(before);
  expect(f.owner.read('drill')!.complete).toBe(true);
  f.db.exec('DROP TRIGGER break_work'); f.owner.settle('drill');
  f.db.exec("UPDATE standalone_practice_progress SET snapshot_hash='corrupt'");
  expect(() => f.sources.episodes.read('episode')).toThrow('archive');
});


it('keeps footwork integration boundaries fixed across partial consumption and executes only the accepted running model', async () => {
  const f = await fixture(), admitted = f.owner.begin('drill');
  const calibration = playerLocomotionCalibrationFixture();
  const source: AcceptedStandalonePractice = { ...f.source, command: { kind: 'DEFENDER_FOOTWORK',
    initial: { tick: f.source.startTick, position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }, target: { x: 10, z: 0 }, rootHeightMeters: 0.95 } };
  // Explicit synthetic capability inputs exercise Core consumption only. Native
  // original-model admission for this family is reserved for consolidated proof.
  const frame = { ...admitted.reservation.frame, kind: 'DEFENDER_FOOTWORK', model: { source: { calibration },
    fieldingModel: { source: { ratings: { acceleration: 0.5 } } } } } as unknown as StandalonePracticeMotionFrame;
  const partial = executeStandalonePracticeMotion(source, frame, 1005), full = executeStandalonePracticeMotion(source, frame, 2000);
  if (partial.kind !== 'DEFENDER_FOOTWORK' || full.kind !== partial.kind) throw new Error('wrong family');
  expect(partial.segments[0].acceleration).toEqual(full.segments[0].acceleration);
  expect(partial.endState.position.x).toBeGreaterThan(0); expect(full.moved).toBe(true);
});

it('consumes an explicitly selected dry-swing profile without declaring ball contact', async () => {
  const f = await fixture(), admitted = f.owner.begin('drill'), profile = EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1;
  const source: AcceptedStandalonePractice = { ...f.source, startTick: 1000, endTick: 1300, command: { kind: 'DRY_SWING',
    issuedTick: 950, bodyReadyTick: 0, profileId: profile.profileId, profileVersion: profile.version, plan: { handedness: 'R',
      batterCenterOfMass: { x: -0.8, y: 0.95, z: 0 }, targetBallCenterAtPlate: { x: 0, y: 0.95, z: 0 },
      strikeZone: { centerX: 0, halfWidth: 0.22, lowerY: 0.5, upperY: 1.4 }, contactTick: 1165 } } };
  const frame = { ...admitted.reservation.frame, kind: 'DRY_SWING', model: { repertoire: { values: { profiles: [{ profile }] } },
    capability: { values: { motorLatencyTicks: 20, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 } },
    predictionCalibration: { values: { parameters: { ticksPerSecond: 1000 } } },
    observationCalibration: { values: { calibration: { memoryDecayParameters: { ticksPerSecond: 1000 } } } },
  } } as unknown as StandalonePracticeMotionFrame;
  const start = executeStandalonePracticeMotion(source, frame, 1000), complete = executeStandalonePracticeMotion(source, frame, 1300);
  expect(start.moved).toBe(false); expect(complete.moved).toBe(true);
  expect(complete).not.toHaveProperty('contact');
  expect(complete).toMatchObject({ kind: 'DRY_SWING', consumedThroughTick: 1300, sample: { phase: 'follow_through' } });
  expect(() => executeStandalonePracticeMotion({ ...source, ticksPerSecond: 1_000_000 }, frame, 1000)).toThrow('model clock differs');
});

it('refuses standalone admission while the same Player has unfinished pitching work', async () => {
  const f = await fixture(); f.pitchOwner.begin('opportunity-0');
  expect(() => f.owner.begin('drill')).toThrow('pitch practice remains unfinished');
  expect(f.owner.read('drill')).toBeNull();
});


it('preserves standalone learning across an interrupted settlement before crossing to pitching', async () => {
  const f = await fixture(); f.owner.begin('drill'); f.owner.advance('drill', 0, 2000);
  const assessed = f.assess();
  f.db.exec(`CREATE TRIGGER interrupt_learning BEFORE INSERT ON world_development_learning_events
    BEGIN SELECT RAISE(ABORT,'test settlement interruption'); END;`);
  expect(() => f.owner.settle('drill')).toThrow('test settlement interruption');
  expect(f.sources.workload.readHead('career-a', 'p1')!.revision).toBe(1);
  expect(f.sources.episodes.read('episode')!.episode.revision).toBe(2);
  f.opportunities.set('opportunity-0', { ...f.opportunity, workloadRevision: 1, readyAtUs: 2_000_000 });
  expect(() => f.pitchOwner.begin('opportunity-0')).toThrow('standalone learning receipt cardinality');
  f.db.exec('DROP TRIGGER interrupt_learning');
  expect(f.owner.settle('drill').kind).toBe('complete');
  f.opportunities.set('opportunity-0', { ...f.opportunities.get('opportunity-0')!, episode: { episodeId: 'episode', revision: 3, domain: 'TECHNICAL' } });
  const pitch = f.complete(); f.pitchAssess(pitch);
  expect(f.pitchOwner.settle(pitch.attemptId).kind).toBe('complete');
  expect(f.sources.workload.readHead('career-a', 'p1')!.revision).toBe(2);
  expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toEqual([assessed.event!.sourceEventId, practiceActivityId(pitch.attemptId)]);
});

it('preserves pitching learning across an interrupted settlement before crossing to standalone motion', async () => {
  const f = await fixture(), pitch = f.complete(); f.pitchAssess(pitch);
  f.db.exec(`CREATE TRIGGER interrupt_learning BEFORE INSERT ON world_development_learning_events
    BEGIN SELECT RAISE(ABORT,'test settlement interruption'); END;`);
  expect(() => f.pitchOwner.settle(pitch.attemptId)).toThrow('test settlement interruption');
  expect(f.sources.workload.readHead('career-a', 'p1')!.revision).toBe(1);
  expect(f.sources.episodes.read('episode')!.episode.revision).toBe(2);
  const command = f.source.command;
  if (command.kind !== 'RUNNING_MOTION') throw new Error('wrong fixture family');
  const startTick = Math.ceil(pitch.plannedDelivery.timeline.followThroughEndUs / 1000) + 1;
  const next = { ...f.source, workloadRevision: 1, startTick, endTick: startTick + 1000,
    command: { ...command, initial: { ...command.initial, tick: startTick }, intent: { ...command.intent, issuedTick: startTick } } };
  f.commands.set('drill', next);
  expect(() => f.owner.begin('drill')).toThrow('practice learning durable source identity');
  f.db.exec('DROP TRIGGER interrupt_learning');
  expect(f.pitchOwner.settle(pitch.attemptId).kind).toBe('complete');
  f.commands.set('drill', { ...next, episodeRevision: 3 });
  f.owner.begin('drill'); f.owner.advance('drill', 0, next.endTick); const assessed = f.assess();
  expect(f.owner.settle('drill').kind).toBe('complete');
  expect(f.sources.workload.readHead('career-a', 'p1')!.revision).toBe(2);
  expect(f.sources.episodes.read('episode')!.episode.practiceSourceEventIds).toEqual([practiceActivityId(pitch.attemptId), assessed.event!.sourceEventId]);
});
