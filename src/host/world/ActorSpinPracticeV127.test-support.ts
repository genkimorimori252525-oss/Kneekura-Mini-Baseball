import type { battingModelStanceFixture } from './NativeBattingModelStanceFixtures.test-support';
import { CATALYST_FAMILIES } from '../../core/world/development/DevelopmentCatalyst';
import { DEVELOPMENT_DOMAINS } from '../../core/world/development/DevelopmentTrajectory';
import { STAR_GENESIS_POTENTIALS } from '../../core/world/development/StarGenesis';
import type { DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import { planCourseAwareSwingKinematicsV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import { openSqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import { openSqlitePlayerPitchTimingStore, type AcceptedPitchTimingBaseline } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore, type AcceptedReleaseGeometryBaseline } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { openSqlitePitchPracticeAttemptStore, type SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import type { PitchPracticeOpportunity, PitchPracticeAssessment, PitchPracticeAttempt } from './PitchPracticeAttempt';
import { acceptedPracticeDiscoveryFixture } from './PracticeOriginDevelopment.test-support';
import { openSqliteStandalonePracticeStore, type AcceptedStandalonePracticeAssessment } from './SqliteStandalonePracticeStore';
import type { AcceptedStandalonePractice } from './StandalonePracticeMotion';
import type { StandaloneBattingContactCommand } from './StandalonePracticeContact';
import { openSqliteDevelopmentPracticeExposureStore, type AcceptedDevelopmentPracticeExposure } from './SqliteDevelopmentPracticeExposureStore';
import { openSqliteSpinControlMasteryV123, type AcceptedSpinMasteryCalibrationV123, type AcceptedSpinMasteryV123 } from './SqliteSpinControlMasteryV123';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { DurablePlayerBattingModelV1 } from './PlayerBattingModel';
import { registeredMeasuredMotorBindingV133, planStandaloneMeasuredPracticeV133 } from './StandaloneMeasuredPracticeV133';
import type { AerodynamicPitchTrajectoryParameters } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2 } from '../../core/world/psychology/batting/MeasuredBattingTrajectoryV1';

type Fixture = ReturnType<typeof battingModelStanceFixture>;
export type ActorSpinPracticeContextV127 = Readonly<{ fixture: Fixture; batting: ReturnType<Fixture['modelStore']['accept']> }>;
/** Explicit authored-world opt-in. Each owner below is the real owner of this
 * same persisted database, not an adapter impersonating the old fixture. */
export type AuthoredActorSpinPracticeContextV133 = Readonly<{
  runtime: Pick<Fixture['x']['f'], 'path' | 'track' | 'links' | 'roster' | 'workload'>;
  actor: Fixture['actor']; batting: DurablePlayerBattingModelV1;
  feeder: Readonly<{ playerId: string; personLinkSourceId: string }>;
  measuredMotorV133: true;
  gravitySoftTossV135?: AerodynamicPitchTrajectoryParameters;
}>;
const defaultPrefix = 'actor-spin-v127:';
export type ActorSpinPracticeDrillV193 = Readonly<{ sourcePrefix: string; technique: 'BACKSPIN' | 'TOPSPIN'; discoveryDay: number }>;
const requireValue = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined) throw new Error(message);
  return value;
};

/** Synchronous pre-enrollment fixture only. All numerical appraisals, effort,
 * genetics and skill thresholds are explicitly synthetic. Every delivery,
 * practice, workload, episode, exposure and qualification is admitted by the
 * original Native owner in the Actor's own database. No donor DB, receipt,
 * model or Actor is imported and no Match/roster Source is changed. */
export function prepareActorSpinPracticeV127(context: ActorSpinPracticeContextV127 | AuthoredActorSpinPracticeContextV133, onStage: (name: string) => void = () => {}, drill?: ActorSpinPracticeDrillV193) {
  const legacy = 'fixture' in context, batting = context.batting;
  const prefix = drill?.sourcePrefix ?? defaultPrefix, technique = drill?.technique ?? 'BACKSPIN', discoveryDay = drill?.discoveryDay ?? 2;
  const practiceDay = discoveryDay + 2, qualificationDay = discoveryDay + 7, lowerTechnique = technique.toLowerCase();
  if (!prefix.trim() || !['BACKSPIN', 'TOPSPIN'].includes(technique) || !Number.isSafeInteger(discoveryDay) || discoveryDay < 2 || !Number.isSafeInteger(qualificationDay)) throw Error('invalid explicit Actor spin drill');
  const runtime = legacy ? context.fixture.x.f : context.runtime, { path, track, links, roster } = runtime;
  const actor = legacy ? context.fixture.actor : context.actor, { careerId, playerId, personLinkSourceId } = actor.binding;
  const wrongGameDay = drill === undefined ? actor.binding.gameDay !== 10 : actor.binding.gameDay < qualificationDay;
  if (legacy && (careerId !== 'career-a' || playerId !== 'away-1' || personLinkSourceId !== 'intake-away-1' || wrongGameDay
    || batting.source.acceptedAtDay > 2 || batting.source.playerId !== playerId || batting.source.careerId !== careerId
    || batting.source.personLinkSourceId !== personLinkSourceId || json(batting.bodyMaterialization) !== json(context.fixture.receipt))) {
    throw new Error('actor spin practice requires the original early Actor/model/body and gameDay10');
  }
  if (!legacy && (wrongGameDay || batting.source.acceptedAtDay > 2 || batting.bodyMaterialization.source.atDay > 2
    || batting.source.playerId !== playerId || batting.source.careerId !== careerId || batting.source.personId !== actor.binding.personId
    || batting.source.personLinkSourceId !== personLinkSourceId || context.feeder.playerId === playerId)) throw Error('authored measured practice original scope differs');
  const softToss = !legacy ? context.gravitySoftTossV135 : undefined;
  const upright = !legacy && batting.repertoire.values.repertoireVersion === MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2;
  if (softToss && (softToss.gravityY !== -9.81 || softToss.aerodynamics.airDensityKgM3 !== 0)) throw Error('gravity soft-toss fixture requires its explicit constant-gravity zero-density calibration');
  // Check caller-owned prerequisites BEFORE opening/initializing training
  // namespaces. The Direct fixture must keep this outside its PA reservation.
  const initialBatterWorkload = runtime.workload.readHead(careerId, playerId);
  if (!initialBatterWorkload || initialBatterWorkload.effectiveDay > discoveryDay) throw new Error('pre-enrollment batter workload baseline is missing or future');
  const feederId = legacy ? 'p-away' : context.feeder.playerId, feederLinkId = legacy ? 'intake-p-away' : context.feeder.personLinkSourceId;
  requireValue(links.readLink(feederLinkId), 'original feeder Person link missing');
  const initialFeederWorkload = requireValue(runtime.workload.readHead(careerId, feederId), 'original feeder workload baseline missing');
  if (initialFeederWorkload.effectiveDay > practiceDay) throw new Error('original feeder workload baseline is future');
  onStage('original-actor-model-baselines-ready');

  const person = track(openSqlitePersonGenesisStore(path));
  if (person.readDevelopmentSeed(careerId) === null) {
    const genesisDay = legacy ? 1 : 0;
    const ones = { min: 1, max: 1 }, zero = { min: 0, max: 0 };
    const ranges = <T extends string>(keys: readonly T[], value: typeof ones) => Object.fromEntries(keys.map(key => [key, value])) as Record<T, typeof ones>;
    person.initializeCareer({ careerId, initializedAtDay: genesisDay, careerSeed: 12345, policies: {
      trajectory: { policyId: prefix + 'synthetic-trajectory', profileVersion: 'v1', availableAtDay: genesisDay,
        timingWeights: { VERY_EARLY: 0, EARLY: 0, NORMAL: 1, LATE: 0, VERY_LATE: 0 },
        shapeWeights: { SHARP_PEAK: 0, BROAD_PLATEAU: 1, STEPWISE_WAVES: 0 }, domainOffsetRanges: ranges(DEVELOPMENT_DOMAINS, zero) },
      catalyst: { policyId: prefix + 'synthetic-catalyst', profileVersion: 'v1', availableAtDay: genesisDay,
        sensitivityRanges: ranges(CATALYST_FAMILIES, ones), signatureMotifs: [], signatureMotifCount: 0 },
      star: { policyId: prefix + 'synthetic-star', profileVersion: 'v1', availableAtDay: genesisDay,
        tierWeights: { ORDINARY: 1, STAR_CANDIDATE: 0, SUPERSTAR_CANDIDATE: 0 }, potentialRanges: {
          ORDINARY: ranges(STAR_GENESIS_POTENTIALS, zero), STAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS, zero),
          SUPERSTAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS, zero) } } } });
  }
  person.materializeBatch([personLinkSourceId, feederLinkId]);
  const selfTiming: AcceptedPitchTimingBaseline = { sourceId: prefix + 'self-timing', sourceVersion: 'synthetic-v127', careerId, playerId, personLinkSourceId,
    acceptedAtDay: 1, profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000, quickSpeedFactor: 1.8,
      cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
      normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const feederTiming: AcceptedPitchTimingBaseline = { ...selfTiming, sourceId: prefix + 'authored-feeder-timing', playerId: feederId, personLinkSourceId: feederLinkId };
  const timing = track(openSqlitePlayerPitchTimingStore(path, links, { readAcceptedBaseline: id => id === selfTiming.sourceId ? selfTiming : !legacy && id === feederTiming.sourceId ? feederTiming : null,
    readAcceptedLearning: () => null }));
  if (drill === undefined || !timing.readHead(careerId, playerId)) timing.initialize(selfTiming.sourceId);
  const selfRelease: AcceptedReleaseGeometryBaseline = { sourceId: prefix + 'self-release', sourceVersion: 'synthetic-v127', careerId, playerId, personLinkSourceId,
    acceptedAtDay: 1, body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' },
    profile: { armSlotClass: 'OVERHAND', releaseHeightTier: 'HIGH', releaseHeightRatio: 0.9, releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2,
      armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 }, tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const release = track(openSqlitePlayerReleaseGeometryStore(path, links, { readAcceptedBaseline: id => id === selfRelease.sourceId ? selfRelease : null,
    readAcceptedChange: () => null }));
  if (legacy && drill === undefined || !release.readHead(careerId, playerId)) release.initialize(selfRelease.sourceId);
  if (!legacy && !timing.readHead(careerId, feederId)) timing.initialize(feederTiming.sourceId);
  requireValue(timing.readHead(careerId, feederId), 'original feeder timing missing');
  requireValue(release.readHead(careerId, feederId), 'original feeder release missing');
  const fatigue = { sourceId: prefix + 'fatigue', sourceVersion: 'synthetic-v127', policyId: prefix + 'fatigue', version: 'v1',
    availableAtDay: 1, motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.8, spinRetentionAtFullFatigue: 0.9 };
  const fatiguePolicies = track(openSqlitePitchFatiguePolicyStore(path, { readAcceptedPolicy: id => id === fatigue.sourceId ? fatigue : null }));
  fatiguePolicies.accept(fatigue.sourceId);
  let pitches: SqlitePitchPracticeAttemptStore | null = null;
  const workload = track(openSqlitePlayerWorkloadRecoveryStore(path, links, { readAcceptedBaseline: () => null,
    readAcceptedActivity: id => pitches?.readAcceptedActivity(id) ?? null }, (db, activity, phase) => {
    requireValue(pitches, 'actual pitch practice owner is missing').assertWorkloadEvidence(db, activity, phase);
  }));
  const bootstrapEpisodes = track(openSqliteDevelopmentInitiationStore(path, { roster, person,
    appraisal: { readAcceptedAppraisal: () => null }, policies: { readAcceptedPolicies: () => null } }));
  const opportunities = new Map<string, PitchPracticeOpportunity>(), pitchAssessments = new Map<string, PitchPracticeAssessment>();
  pitches = track(openSqlitePitchPracticeAttemptStore(path, { personLinks: links, person, timing, release, workload, policies: fatiguePolicies,
    episodes: bootstrapEpisodes }, { readAcceptedOpportunity: id => opportunities.get(id) ?? null, readAcceptedAssessment: id => pitchAssessments.get(id) ?? null }));
  const pitchOwner = pitches;
  const opportunity = (id: string, subject: string, link: string, atDay: number, ordinal = 0, previous: PitchPracticeAttempt | null = null): PitchPracticeOpportunity => ({
    sourceId: prefix + id, sourceVersion: 'synthetic-v127', opportunityId: prefix + (subject === playerId ? 'discovery-session' : 'feeder-session'), ordinal,
    previousAttemptId: previous?.attemptId ?? null, careerId, playerId: subject, personLinkSourceId: link, atDay,
    readyAtUs: previous ? previous.plannedDelivery.timeline.followThroughEndUs + 1 : 0,
    workloadRevision: requireValue(workload.readHead(careerId, subject), 'actual workload missing').revision,
    timingRevision: requireValue(timing.readHead(careerId, subject), 'actual timing missing').revision,
    releaseRevision: requireValue(release.readHead(careerId, subject), 'actual release missing').revision,
    fatiguePolicySourceId: fatigue.sourceId, practiceSeed: 31415, timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' },
    moundReference: { x: 0, y: 0, z: softToss ? 6 : 18 }, physics: { velocity: { x: 0, y: softToss ? 2 : 0, z: legacy ? -30 : -10 }, spin: { x: 0, y: 100, z: 0 } }, episode: null });
  const finishPitch = (begun: PitchPracticeAttempt) => {
    const completed = pitchOwner.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs);
    const completion = requireValue(completed.completionReference, 'actual pitch completion missing');
    const assessment: PitchPracticeAssessment = { sourceId: prefix + 'pitch-assessment:' + completed.attemptId, sourceVersion: 'synthetic-v127',
      attemptId: completed.attemptId, completionHash: completion.hash, effortUnits: 1, healthAvailability: 0.9,
      provenance: { assessmentSourceId: prefix + 'observed-effort:' + completed.attemptId, assessmentVersion: 'v1',
        calibrationSourceId: prefix + 'synthetic-effort-health', calibrationVersion: 'v1' } };
    pitchAssessments.set(assessment.sourceId, assessment);
    const assessed = pitchOwner.acceptAssessment(assessment.sourceId), settled = pitchOwner.settle(completed.attemptId);
    if (settled.kind !== 'complete' || settled.episode !== null) throw new Error('out-of-episode actual pitch did not settle');
    return assessed;
  };
  const discoveryOpportunity = opportunity('self-discovery', playerId, personLinkSourceId, discoveryDay);
  opportunities.set(discoveryOpportunity.sourceId, discoveryOpportunity);
  const discovery = finishPitch(pitchOwner.begin(discoveryOpportunity.sourceId));
  onStage('self-discovery-pitch-settled');

  // Reuse only the explicit numerical appraisal/policy template, populated from
  // THIS assessed Native pitch. Its actual completionReference is not copied.
  const template = acceptedPracticeDiscoveryFixture(discovery);
  const appraisal = { ...template.appraisal, sourceId: prefix + 'appraisal', episodeId: prefix + 'episode',
    appraisal: { ...template.appraisal.appraisal, sourceEventId: prefix + 'personal-appraisal', atDay: discoveryDay },
    discovery: { ...template.appraisal.discovery, sourceEventId: prefix + 'canonical-discovery', occurredAtDay: discoveryDay,
      motifId: prefix + 'explicit-' + lowerTechnique + '-discovery' } };
  const learningPolicies = { ...template.policies, sourceId: prefix + 'learning-policies',
    learning: { ...template.policies.learning, policyId: prefix + 'learning', availableAtDay: legacy ? 1 : 0 },
    receptivity: { ...template.policies.receptivity, policyId: prefix + 'receptivity', availableAtDay: legacy ? 1 : 0 },
    initiation: { ...template.policies.initiation, policyId: prefix + 'initiation', availableAtDay: legacy ? 1 : 0 } };
  const learningEvents = new Map<string, DevelopmentLearningEventInput>();
  const episodes = track(openSqliteDevelopmentInitiationStore(path, { roster, person, appraisal: { readAcceptedAppraisal: () => null },
    policies: { readAcceptedPolicies: id => id === learningPolicies.sourceId ? learningPolicies : null },
    practice: { attempts: pitchOwner, workload, readAcceptedAppraisal: id => id === appraisal.sourceId ? appraisal : null } },
  { readAcceptedLearningEvent: id => learningEvents.get(id) ?? null }));
  const initiation = episodes.applyPractice({ episodeId: appraisal.episodeId, playerId, personSourceId: personLinkSourceId,
    appraisalSourceId: appraisal.sourceId, policySourceId: learningPolicies.sourceId });
  if (initiation.episode.stage !== 'ENGAGED') throw new Error('actual practice discovery did not engage');
  learningEvents.set(prefix + 'hypothesis', { eventId: prefix + 'hypothesis', sourceEventId: prefix + 'hypothesis', kind: 'HYPOTHESIS_FORMED', atDay: discoveryDay + 1, domain: 'TECHNICAL' });
  episodes.advance(appraisal.episodeId, prefix + 'hypothesis', initiation.episode.revision);
  onStage('native-practice-hypothesis-ready');

  const commands = new Map<string, AcceptedStandalonePractice>(), assessments = new Map<string, AcceptedStandalonePracticeAssessment>();
  const practice = track(openSqliteStandalonePracticeStore(path, episodes, { readAcceptedPractice: id => commands.get(id) ?? null,
    readAcceptedAssessment: id => assessments.get(id) ?? null }));
  let lastFeeder: PitchPracticeAttempt | null = null;
  for (let index = 0; index < 3; index++) {
    const offered = opportunity('feeder-' + index, feederId, feederLinkId, practiceDay, index, lastFeeder);
    opportunities.set(offered.sourceId, offered);
    const begun = pitchOwner.begin(offered.sourceId), actualRelease = begun.plannedDelivery.release, profile = batting.repertoire.values.profiles[0].profile;
    // The gravity variant is a prospective fixed-physics drill, computed once
    // from its original release inputs. It never searches an actual contact or
    // changes a target after a miss. Legacy commands retain the original plan.
    const ballAtDepth = (z: number) => {
      const seconds = (actualRelease.position.z - z) / -actualRelease.velocity.z;
      return { x: actualRelease.position.x + actualRelease.velocity.x * seconds,
        y: actualRelease.position.y + actualRelease.velocity.y * seconds + (softToss?.gravityY ?? 0) * seconds * seconds / 2 + (technique === 'TOPSPIN' ? .02 : -.02), z };
    };
    // Raw Native upright uses the original OBP R-box side (+labY -> +X).
    // This is not the Browser's separate first-base-positive field conversion.
    const plan = { handedness: 'R' as const, batterCenterOfMass: { x: actualRelease.position.x + (upright ? 0.8 : -0.8), y: 0.95, z: 0 },
      targetBallCenterAtPlate: softToss ? ballAtDepth(0) : { x: actualRelease.position.x, y: actualRelease.position.y + (technique === 'TOPSPIN' ? .02 : -.02), z: 0 },
      strikeZone: { centerX: actualRelease.position.x, halfWidth: 0.22, lowerY: 0.5, upperY: 1.8 }, contactTick: actualRelease.releaseAtUs + 600000 };
    const depth = planCourseAwareSwingKinematicsV1({ ...plan, ticksPerSecond: 1_000_000, profile }).preferredContactDepthM;
    plan.contactTick = actualRelease.releaseAtUs + Math.round((actualRelease.position.z - depth) / -actualRelease.velocity.z * 1_000_000);
    const explicitPlan = softToss ? { ...plan, targetBallCenterAtContact: ballAtDepth(depth) } : plan;
    const trajectory = planCourseAwareSwingKinematicsV1({ ...explicitPlan, ticksPerSecond: 1_000_000, profile }).trajectory;
    const command: StandaloneBattingContactCommand = { kind: 'BATTING_CONTACT', pitchAttemptId: begun.attemptId,
      spinIntentV123: { technique, decidedTick: offered.readyAtUs }, calibrationRef: { sourceId: prefix + (softToss ? 'gravity-soft-toss-v135' : 'explicit-flight'), sourceVersion: softToss ? 'synthetic-v135' : 'synthetic-v127' },
      issuedTick: offered.readyAtUs, bodyReadyTick: offered.readyAtUs, profileId: profile.profileId, profileVersion: profile.version, plan: explicitPlan,
      ...(!legacy ? { measuredMotorV133: (() => {
        const b = registeredMeasuredMotorBindingV133(batting.repertoire.values, batting.equipment.values, { profileId: profile.profileId, version: profile.version });
        return { implementationV133: b.implementationV133, payloadHash: b.payloadHash };
      })() } : {}),
      parameters: softToss ?? { ticksPerSecond: 1_000_000, integrationStepTicks: 2000, gravityY: 0,
        aerodynamics: { ballMassKg: batting.equipment.values.ball.massKg, ballRadiusM: batting.equipment.values.ball.radiusM,
          airDensityKgM3: 0, windVelocityMps: { x: 0, y: 0, z: 0 }, dragCoefficient: 0 } } };
    const executed = command.measuredMotorV133 ? planStandaloneMeasuredPracticeV133({ ...command, measuredMotorV133: command.measuredMotorV133 }, 1_000_000, batting) : trajectory;
    const source: AcceptedStandalonePractice = { sourceId: prefix + 'contact-' + index, sourceVersion: 'synthetic-v127', opportunityId: prefix + 'contact-opportunity-' + index,
      careerId, playerId, personLinkSourceId, atDay: practiceDay, startTick: executed.startTick, endTick: executed.endTick, ticksPerSecond: 1_000_000,
      workloadRevision: requireValue(workload.readHead(careerId, playerId), 'actual batter workload missing').revision,
      episodeId: appraisal.episodeId, episodeRevision: requireValue(episodes.read(appraisal.episodeId), 'actual learning episode missing').episode.revision,
      domain: 'TECHNICAL', bodySourceId: batting.bodyMaterialization.source.sourceId, modelSourceId: batting.source.sourceId, command };
    commands.set(source.sourceId, source); practice.begin(source.sourceId);
    lastFeeder = finishPitch(begun);
    const completed = practice.advance(source.sourceId, 0, source.endTick);
    if (completed.progress.execution.kind !== 'BATTING_CONTACT' || !completed.progress.execution.contact) throw new Error('actual Actor practice contact missing');
    const assessment: AcceptedStandalonePracticeAssessment = { sourceId: prefix + 'contact-assessment-' + index, sourceVersion: 'synthetic-v127',
      opportunitySourceId: source.sourceId, physicalProofHash: requireValue(completed.physicalProofHash, 'actual contact proof missing'), effortUnits: 1, relevant: true,
      factors: { trainingStimulus: 1, coachingFit: 1, challengeFit: 1, healthAvailability: 0.8, motivation: 1, opportunity: 1, novelty: 1 },
      provenance: { assessmentSourceId: prefix + 'review-contact-' + index, assessmentVersion: 'v1', calibrationSourceId: prefix + 'synthetic-contact-effort', calibrationVersion: 'v1' } };
    assessments.set(assessment.sourceId, assessment);
    const assessed = practice.assess(assessment.sourceId);
    const event = requireValue(assessed.event, 'actual practice learning event missing'); learningEvents.set(event.sourceEventId, event);
    if (practice.settle(source.sourceId).kind !== 'complete') throw new Error('Actor practice contact did not settle');
    onStage('native-actor-contact-settled-' + index);
  }
  for (const [name, kind, atDay] of [['feedback', 'FEEDBACK_RECORDED', discoveryDay + 5], ['consolidation', 'CONSOLIDATION_RECORDED', discoveryDay + 6]] as const) {
    const sourceId = prefix + name; learningEvents.set(sourceId, { eventId: sourceId, sourceEventId: sourceId, kind, atDay, domain: 'TECHNICAL' });
    onStage('native-actor-' + name + '-revision-read-start');
    const revision = requireValue(episodes.read(appraisal.episodeId), 'actual learning episode missing').episode.revision;
    onStage('native-actor-' + name + '-revision-read-ready');
    onStage('native-actor-' + name + '-advance-start');
    episodes.advance(appraisal.episodeId, sourceId, revision);
    onStage('native-actor-' + name + '-advance-ready');
  }
  onStage('native-actor-exposure-revision-read-start');
  const exposureRevision = requireValue(episodes.read(appraisal.episodeId), 'actual consolidated episode missing').episode.revision;
  onStage('native-actor-exposure-revision-read-ready');
  const exposureSource: AcceptedDevelopmentPracticeExposure = { sourceId: prefix + 'exposure', sourceVersion: 'synthetic-v127', episodeId: appraisal.episodeId,
    episodeRevision: exposureRevision,
    policy: { policyId: prefix + 'explicit-exposure', version: 'v1', availableAtDay: 1, selfDirectedShare: 0.5, minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1 },
    prior: { careerId, playerId, atDay: discoveryDay, domain: 'TECHNICAL', receptivity: 1, profileVersion: 'v1', policyId: prefix + 'explicit-prior', policyVersion: 'v1' }, pitchFactors: [],
    provenance: { assessmentSourceId: prefix + 'reviewed-exposure', assessmentVersion: 'v1', calibrationSourceId: prefix + 'synthetic-exposure', calibrationVersion: 'v1' } };
  onStage('native-actor-exposure-owner-open-start');
  const exposures = track(openSqliteDevelopmentPracticeExposureStore(path, { development: episodes }, { readAcceptedExposure: id => id === exposureSource.sourceId ? exposureSource : null }));
  onStage('native-actor-exposure-owner-open-ready');
  onStage('native-actor-exposure-admit-start');
  const exposure = exposures.accept(exposureSource.sourceId);
  onStage('native-actor-exposure-ready');
  const calibration: AcceptedSpinMasteryCalibrationV123 = { sourceId: prefix + 'qualification-calibration', sourceVersion: 'synthetic-v127', acceptedAtDay: 1,
    technique, status: 'MODEL_VERIFIED', minimumIntentionalContacts: 3, minimumDirectionalSpinRadPerSecond: 0.001, minimumSuccessFraction: 0.5 };
  const source: AcceptedSpinMasteryV123 = { sourceId: prefix + 'mastery-' + lowerTechnique, sourceVersion: 'synthetic-v127', sourceEffectIdentity: prefix + (legacy ? 'away-1' : playerId) + '-' + lowerTechnique,
    careerId, playerId, personLinkSourceId, acceptedAtDay: qualificationDay, technique,
    exposureRef: { sourceId: exposure.source.sourceId, sourceVersion: exposure.source.sourceVersion, sourceHash: hash(exposure.source), snapshotHash: hash(exposure) },
    repertoireRef: batting.source.repertoireRef, calibrationRef: { sourceId: calibration.sourceId, sourceVersion: calibration.sourceVersion }, distinctiveness: 0.9,
    policy: { policyId: prefix + 'synthetic-mastery', version: 'v1', availableAtDay: 1, minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1, minimumDistinctiveness: 0.8 } };
  const masteries = track(openSqliteSpinControlMasteryV123(path, { readAcceptedMastery: id => id === source.sourceId ? source : null,
    readAcceptedCalibration: id => id === calibration.sourceId ? calibration : null }));
  onStage('native-actor-' + lowerTechnique + '-qualification-admit-start');
  const qualification = masteries.accept(source.sourceId);
  onStage('native-actor-' + lowerTechnique + '-qualified');
  return { qualification, qualificationReference: reference('world_spin_mastery_v123', qualification),
    ...(!legacy ? { feederTimingBaselineV133: feederTiming } : {}) };
}
