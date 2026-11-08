import type { Vec3 } from '../../core/model/geometry';
import { simulateLiveFieldPlayV1, type LiveFieldFactV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import { diagnoseLiveFieldPlayV1 } from '../../core/sim/fielding/LiveFieldPlayDiagnosticsV1';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_BASES_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { buildLiveFieldPlayInputV95 } from './LiveFieldInputV95';

const freeze = <T>(v: T): T => { if (v && typeof v === 'object' && !Object.isFrozen(v)) {
  Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const armUrl = 'https://baseballsavant.mlb.com/leaderboard/arm-strength?minThrows=100&pos=arm_2b&team=&type=player&year=2025';
const speedUrl = 'https://baseballsavant.mlb.com/leaderboard/sprint_speed?max_season=2025&min=10&min_season=2025&position=&sort=5&sortDir=desc&team=';
const unknown = (definition: string) => ({ status: 'NOT_OBTAINED' as const, value: null, definition });

/** Observations are comparison columns, never role-specific ability buffs. */
export const AVERAGE_FIELD_REFERENCE_V95 = freeze({ season: 2025, gameType: 'regular' as const,
  armStrengthByPositionMph: { status: 'PUBLISHED_2025_POSITION_SPECIFIC_MAX_EFFORT' as const, source: armUrl,
    definition: '1B top 1%; 2B/3B/SS top 5%; OF top 10% throws. Not all-throw means or identical exertion conditions.',
    values: { '1B': 78.3, '2B': 79.3, '3B': 85.6, SS: 85.7, LF: 87.1, CF: 89.6, RF: 90.5 } },
  sprintSpeedMps: { status: 'PUBLISHED_GENERIC_REFERENCE_NOT_RECOMPUTED_2025_MEAN' as const, value: 27 * .3048,
    source: speedUrl, definition: 'Fastest one-second window, selected competitive runs, upper approximately two-thirds. Not acceleration or average base-path speed.',
    comparisonRangeMps: [23 * .3048, 30 * .3048] },
  overallArmMph: unknown('2025 all-position arm_all population mean and weighting not obtained; do not average position means.'),
  homeToFirstSeconds: unknown('2025 opportunity-weighted R/L bat-contact-to-first averages not obtained.'),
  infieldOutfieldExchangeSeconds: unknown('2025 position/action-specific glove-to-release means not obtained.'),
  directRfToFirst: { status: 'PINNED_RETROSHEET_RESEARCH_NOT_OPPORTUNITY_RATE' as const,
    source: 'https://www.retrosheet.org/events/2025eve.zip', games: 2430, directBasicPlay93: 1,
    sourceSha256: '5ece2be6c8ec5b47b9d8d90f2ca533ceca7eee915c7e0997f9bd6d64b879303c',
    rfGroundOpportunityDenominator: null, opportunityRate: null },
});

const provisional = (unit: string, bounds: readonly [number, number], source: string) => ({
  status: 'PROVISIONAL' as const, unit, bounds, source, definition: 'Authored SI research starting point; no measured MLB population mean claimed.' });
export const AVERAGE_FIELD_PROFILE_V95 = freeze({
  id: 'uniform-reference-player-v95', claim: 'UNIFORM_REFERENCE_PLAYER_WITH_PROVISIONAL_SI_NOT_MLB_VALIDATED' as const,
  samePhysicalForEveryActor: true, traits: 'NONE' as const, teamPolicy: 'balanced' as const,
  physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, topSpeedMps: 27 * .3048,
    defensiveDecisionSeconds: .04, fieldingPursuitCostWeight: 1, throwDirectionStdRadians: .011,
    baserunningSafetyMarginSeconds: .35, baserunningTurnRadiusMeters: 4.5,
    baserunningLateralAccelerationMps2: 1.5 * LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.accelerationMps2 },
  parameterBasis: {
    topSpeedMps: { status: 'REFERENCE_DERIVED_PROVISIONAL_MAPPING' as const, unit: 'm/s', bounds: [23 * .3048, 30 * .3048], source: speedUrl,
      definition: 'Simulation speed ceiling starts at the published sprint reference; equality to a measured fastest one-second running window is not yet established.' },
    throwSpeedMps: provisional('m/s', [25, 45], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.throwSpeedMps'),
    transferSeconds: provisional('s', [0, 1.5], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.transferSeconds'),
    throwEffortBuildSecondsV103: provisional('s', [0, 5], 'LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds'),
    reactionSeconds: provisional('s', [0, .6], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.reactionSeconds'),
    defensiveDecisionSeconds: provisional('s', [0, .3], 'explicit neutral research decision latency'),
    accelerationMps2: provisional('m/s^2', [2, 10], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.accelerationMps2'),
    gloveSpeedMps: provisional('m/s', [1, 20], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.gloveSpeedMps'),
    gloveReachMeters: provisional('m', [.5, 2], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.gloveReachMeters'),
    gloveRadiusMeters: provisional('m', [.05, .25], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.gloveRadiusMeters'),
    retentionCapacityJ: provisional('J', [1, 300], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.retentionCapacityJ'),
    captureDissipationPowerW: provisional('W', [100, 6000], 'LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.captureDissipationPowerW'),
    throwDirectionStdRadians: provisional('rad', [0, .12], 'explicit angular motor error, not a scored-error probability'),
    fieldingPursuitCostWeight: provisional('ratio', [.25, 4], 'neutral pursuit weight'),
    baserunningSafetyMarginSeconds: provisional('s', [0, 3], 'shared Host balanced manager margin'),
    baserunningTurnRadiusMeters: provisional('m', [.5, 10], 'shared Host turn default'),
    baserunningLateralAccelerationMps2: provisional('m/s^2', [.5, 20], 'shared Host lateral default'),
  },
});

export type AverageFieldCaseV95 = Readonly<{ id: string; category: 'rf_ground' | 'infield_ground' | 'multiple_runners' | 'tag_up' | 'gap';
  position: Vec3; velocity: Vec3; spin?: Vec3; bases?: readonly (1 | 2 | 3)[]; outs?: 0 | 1 | 2 }>;
/** Independent authored interventions; not a replay sample or MLB frequency mix.
 * Unlike the old canonical fixture, this has no ability tiers, stagger, or
 * minimum-out expectation. Outcomes are observations of a physical race. */
export const AVERAGE_FIELD_CASES_V95: readonly AverageFieldCaseV95[] = freeze([
  { id: 'RF_ground_pull', category: 'rf_ground', position: v(0, .4, .3), velocity: v(22, -1.8, 35) },
  { id: 'RF_ground_line', category: 'rf_ground', position: v(0, .4, .3), velocity: v(27, -1.5, 31) },
  { id: 'SS_ground', category: 'infield_ground', position: v(0, .4, .3), velocity: v(-8.5, -1.8, 26) },
  { id: 'second_force', category: 'multiple_runners', position: v(0, .4, .3), velocity: v(8, -2, 27), bases: [1] },
  { id: 'RF_gap_runner_second', category: 'gap', position: v(0, .8, .3), velocity: v(18, 12, 36), spin: v(-100, 25, 0), bases: [2] },
  { id: 'RF_tag_second_to_third', category: 'tag_up', position: v(0, .9, .3), velocity: v(13, 22, 30), spin: v(-130, 40, 0), bases: [2], outs: 1 },
  { id: 'LCF_gap_multiple', category: 'gap', position: v(0, .8, .3), velocity: v(-15, 13, 38), spin: v(-110, -30, 0), bases: [1, 2] },
  // Authored probe confirmed an actual RF catch, unlike the earlier nominal
  // tag case which lands first. Neutral runner holds second; no forced advance
  // or claim that a successful second-to-third advance has been calibrated.
  { id: 'RF_caught_tag_second', category: 'tag_up', position: v(0, .9, .3), velocity: v(13, 21, 24), spin: v(-130, 40, 0), bases: [2], outs: 1 },
  // Same neutral actors and independent deep-fly input as the preserved probe.
  // A carry-only result after failed hand-continuity proof is unknown, not a
  // safe advance: the proved relay margin is below the neutral runner margin.
  { id: 'RF_deep_caught_tag_second', category: 'tag_up', position: v(0, .9, .3), velocity: v(17, 22, 25), spin: v(-130, 40, 0), bases: [2], outs: 1 },
]);
const roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const placements = freeze({ P: v(0, .9, 18.44), C: v(0, .85, -1.5), '1B': v(23, .9, 25), '2B': v(13, .9, 36),
  '3B': v(-23, .9, 25), SS: v(-13, .9, 36), LF: v(-46, .9, 76), CF: v(0, .9, 91), RF: v(46, .9, 76) });
export const AVERAGE_FIELD_VARIANTS_V95 = ['baseline', 'throw_yaw_left', 'throw_yaw_right', 'weak_pocket', 'wide_throws',
  'weaker_arm', 'stronger_arm', 'aggressive', 'conservative'] as const;
export type AverageFieldVariantV95 = typeof AVERAGE_FIELD_VARIANTS_V95[number];
export type AverageFieldCaseRequestV95 = Readonly<{ caseId: string; seed: number; bats: 'R' | 'L'; parkRadiusMeters: number;
  variant?: AverageFieldVariantV95; maxPlaySeconds?: number }>;

export function buildAverageFieldCaseV95(request: AverageFieldCaseRequestV95) {
  const scenario = AVERAGE_FIELD_CASES_V95.find(c => c.id === request.caseId), variant = request.variant ?? 'baseline';
  if (!scenario) throw Error('average field harness: unknown case ' + request.caseId);
  if (!(AVERAGE_FIELD_VARIANTS_V95 as readonly string[]).includes(variant)) throw Error('average field harness: unknown variant');
  if (!Number.isSafeInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) throw Error('average field harness: invalid seed');
  if (!Number.isFinite(request.parkRadiusMeters) || request.parkRadiusMeters < 95 || request.parkRadiusMeters > 140) throw Error('average field harness: park research bounds 95..140m');
  if (!['R', 'L'].includes(request.bats)) throw Error('average field harness: batting side required');
  const physical = { ...AVERAGE_FIELD_PROFILE_V95.physical,
    ...(variant === 'wide_throws' ? { throwDirectionStdRadians: .055 } : {}),
    ...(variant === 'weak_pocket' ? { retentionCapacityJ: 30, captureDissipationPowerW: 900 } : {}),
    ...(variant === 'weaker_arm' ? { throwSpeedMps: 29 } : {}), ...(variant === 'stronger_arm' ? { throwSpeedMps: 39 } : {}) };
  const players = [...roles.map(role => ({ playerId: 'def-' + role, physical })),
    ...[0, 1, 2, 3].map(n => ({ playerId: 'runner-' + n, physical }))];
  const defense = Object.fromEntries(roles.map(role => [role, 'def-' + role])) as Record<typeof roles[number], string>;
  const occupiedBases = { first: scenario.bases?.includes(1) ? 'runner-1' : null,
    second: scenario.bases?.includes(2) ? 'runner-2' : null, third: scenario.bases?.includes(3) ? 'runner-3' : null };
  const input = buildLiveFieldPlayInputV95({
    ball: { originTick: 1_000_000, elapsedSeconds: .4, ball: { tick: 1_400_000,
      position: scenario.position, velocity: scenario.velocity, spin: scenario.spin ?? v() } },
    physics: LIVE_MATCH_PHYSICS_V1, seed: request.seed,
    field: { bases: LIVE_MATCH_BASES_V1, fenceRadiusMeters: request.parkRadiusMeters, fenceHeightMeters: 3 },
    outs: scenario.outs ?? 0, maxPlaySeconds: request.maxPlaySeconds ?? 45,
    defense, placements, players, batterRunnerId: 'runner-0', batterPosition: v(request.bats === 'R' ? .85 : -.85, 0, -.2),
    occupiedBases, baserunning: variant === 'aggressive' ? 'aggressive' : variant === 'conservative' ? 'conservative' : 'balanced',
  });
  const execution = variant === 'throw_yaw_left' || variant === 'throw_yaw_right';
  return { input: execution ? { ...input, executionPerturbationsV95: { throwErrors: [{ releaseOrdinal: 0,
    yawRadians: variant === 'throw_yaw_left' ? -.08 : .08, pitchRadians: 0 }] } } : input,
  roleMap: Object.fromEntries(roles.map(role => ['def-' + role, role])),
  context: { caseId: scenario.id, category: scenario.category, seed: request.seed, bats: request.bats,
    parkRadiusMeters: request.parkRadiusMeters, variant,
    purpose: variant === 'baseline' ? 'AUTHORED_AVERAGE_REFERENCE_CORPUS_NOT_LEAGUE_FREQUENCY' as const
      : execution ? 'PAIRED_EXECUTION_ERROR_WITH_FIXED_ABILITIES' as const : 'PARAMETER_SENSITIVITY_NOT_MLB_CALIBRATION' as const } };
}

/** A diagnostic measurement, not a physical controller or official Statcast
 * implementation. The frame sampling/interpolation limitation remains visible. */
export function measureSampledRunnerSprintV95(frames: readonly Readonly<{ elapsedSeconds: number;
  runners: readonly Readonly<{ runnerId: string; position: Vec3 }>[] }>[], runnerId: string) {
  const points: { t: number; x: number; z: number; distance: number }[] = [];
  let missingFrameCount = 0, maximumSampleIntervalSeconds = 0;
  for (const frame of frames) {
    const runner = frame.runners.find(r => r.runnerId === runnerId);
    if (!runner) { missingFrameCount++; continue; }
    const previous = points.at(-1);
    if (previous && frame.elapsedSeconds <= previous.t) continue;
    if (previous) maximumSampleIntervalSeconds = Math.max(maximumSampleIntervalSeconds, frame.elapsedSeconds - previous.t);
    points.push({ t: frame.elapsedSeconds, x: runner.position.x, z: runner.position.z,
      distance: (previous?.distance ?? 0) + (previous ? Math.hypot(runner.position.x - previous.x, runner.position.z - previous.z) : 0) });
  }
  const from = points[0]?.t ?? 0, through = points.at(-1)?.t ?? 0;
  let fastestOneSecondMps: number | null = null;
  if (through - from >= 1) {
    const distanceAt = (time: number) => {
      let lo = 0, hi = points.length - 1;
      while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (points[mid].t <= time) lo = mid; else hi = mid; }
      const a = points[lo], b = points[hi];
      return a.distance + (b.distance - a.distance) * (time - a.t) / (b.t - a.t);
    };
    // Extrema of the piecewise-linear window difference occur when either
    // window endpoint crosses a sample. No display rate is made authoritative.
    const starts = points.flatMap(p => [p.t, p.t - 1]).filter(t => t >= from && t + 1 <= through);
    fastestOneSecondMps = Math.max(...starts.map(t => distanceAt(t + 1) - distanceAt(t)));
  }
  return { runnerId, basis: 'READONLY_PIECEWISE_LINEAR_FRAME_PATH_ONE_SECOND_WINDOW' as const,
    fastestOneSecondMps, maximumSampleIntervalSeconds, missingFrameCount };
}

/** This observed pattern requires tactical review, not a fabricated mandatory
 * out or a claim that every decision to retain possession is wrong. */
export function findHeldMultipleAdvancesV95(input: Readonly<{ facts: readonly LiveFieldFactV1[];
  throughSeconds: number; overFenceAward: boolean }>) {
  const reviews: { kind: 'HOLDER_RETAINED_BALL_DURING_MULTIPLE_BASE_ADVANCES'; playerId: string; runnerId: string;
    fromSeconds: number; throughSeconds: number; bases: number[] }[] = [];
  if (input.overFenceAward) return reviews;
  const facts = [...input.facts].sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  for (let i = 0; i < facts.length; i++) {
    const secured = facts[i];
    if (secured.kind !== 'catch_secured' || !secured.playerId) continue;
    const next = facts.slice(i + 1).find(f => f.kind === 'throw_release' || f.kind === 'catch_secured'),
      through = next?.elapsedSeconds ?? input.throughSeconds;
    const touches = facts.filter(f => f.kind === 'runner_base_touch' && f.runnerId && f.base
      && f.elapsedSeconds > secured.elapsedSeconds && f.elapsedSeconds <= through);
    for (const runnerId of new Set(touches.map(t => t.runnerId!))) {
      const runnerTouches = touches.filter(t => t.runnerId === runnerId), bases = [...new Set(runnerTouches.map(t => t.base!))];
      if (bases.length >= 2 && bases.at(-1)! > bases[0]) reviews.push({
        kind: 'HOLDER_RETAINED_BALL_DURING_MULTIPLE_BASE_ADVANCES', playerId: secured.playerId, runnerId,
        fromSeconds: secured.elapsedSeconds, throughSeconds: through, bases });
    }
  }
  return reviews;
}

export function runAverageFieldTrialV95(request: AverageFieldCaseRequestV95) {
  const built = buildAverageFieldCaseV95(request), started = Date.now(), result = simulateLiveFieldPlayV1(built.input),
    diag = diagnoseLiveFieldPlayV1(built.input, result, built.roleMap), telemetry = result.diagnostics.aiTelemetry;
  const releases = result.facts.filter(f => f.kind === 'throw_release'), firstRelease = releases[0]?.elapsedSeconds ?? null,
    firstTouch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === 'runner-0' && f.base === 1),
    rfRelease = releases.find(f => f.playerId === 'def-RF' && f.base === 1),
    firstControl = result.ruleFacts.controlledBaseContacts.find(c => c.base === 1 && c.defenderId === rfRelease?.receiverPlayerId),
    batter = result.finalRunners.find(r => r.runnerId === 'runner-0')!;
  const targetMiss = firstRelease === null || !diag.throws[0] ? null : diag.throws[0].receptionOutcome !== 'glove_secured';
  const runnerActions = telemetry.runnerMotions.map(m => ({ elapsedSeconds: m.elapsedSeconds, runnerId: m.runnerId,
    throughBases: m.throughBases, position: m.position, velocity: m.velocity }));
  return { ...built.context, status: result.end.complete ? 'COMPLETE' as const : 'UNFINISHED' as const,
    wallMilliseconds: Date.now() - started, end: result.end, anomalies: diag.anomalies,
    reviewObservations: findHeldMultipleAdvancesV95({ facts: result.facts, throughSeconds: result.end.elapsedSeconds,
      overFenceAward: result.ruleFacts.overFence?.fair === true }),
    firstTouchRole: diag.firstTouchRole, firstCatchRole: diag.firstCatchRole, finalRunners: result.finalRunners,
    flyCatch: result.ruleFacts.flyCatch, firstGroundContactTick: result.ruleFacts.firstGroundContactTick,
    directRfToFirstRetirement: !!rfRelease && !!firstControl && batter.retired && result.ruleFacts.flyCatch === null
      && result.ruleFacts.firstGroundContactTick !== null && (!firstTouch || firstControl.tick < firstTouch.tick),
    homeToFirstSeconds: firstTouch ? firstTouch.elapsedSeconds - built.input.ball.elapsedSeconds : null,
    homeToFirstCensoredByRetirement: !firstTouch && batter.retired,
    retentionFailureCount: telemetry.contactDiagnostics.filter(d => d.retention?.outcome === 'live-ball').length,
    missedReceptionCount: diag.throws.filter(t => t.receptionOutcome !== 'glove_secured').length,
    firstReleaseSeconds: firstRelease, targetReceptionMissObserved: targetMiss,
    interventionObservation: built.context.purpose !== 'PAIRED_EXECUTION_ERROR_WITH_FIXED_ABILITIES' ? 'NOT_EXECUTION_INTERVENTION' as const
      : firstRelease === null ? 'NO_TARGET_RELEASE' as const : targetMiss ? 'MISSED_RECEPTION_OBSERVED' as const : 'APPLIED_NO_MISSED_RECEPTION_OBSERVED' as const,
    throws: diag.throws, throwDirections: result.diagnostics.throwDirectionCommands,
    eventTrace: result.facts,
    catchContacts: telemetry.contactDiagnostics, holderDecisions: telemetry.holderDecisions, relayPlans: telemetry.relayPlans,
    runnerObservationsV95: telemetry.runnerObservationsV95,
    observerWork: { estimateCount: telemetry.runnerObservationsV95.length,
      aerodynamicSolves: telemetry.runnerObservationsV95.reduce((sum, o) => sum + o.aerodynamicSolves, 0),
      cacheHits: telemetry.runnerObservationsV95.filter(o => o.cacheHit).length,
      unknownEstimates: telemetry.runnerObservationsV95.filter(o => o.controlSeconds === null).length },
    observedSprintWindows: built.input.runners.map(r => measureSampledRunnerSprintV95(result.frames, r.runnerId)),
    observedThrowSpeeds: result.diagnostics.throwDirectionCommands.map(c => ({ elapsedSeconds: c.elapsedSeconds,
      worldMps: Math.hypot(c.actual.velocity.x, c.actual.velocity.y, c.actual.velocity.z),
      bodyRelativeMps: Math.hypot(c.actual.velocity.x - c.bodyVelocity.x, c.actual.velocity.y - c.bodyVelocity.y,
        c.actual.velocity.z - c.bodyVelocity.z) })),
    observedCatchToReleaseSeconds: releases.flatMap(release => {
      const caught = result.facts.filter(f => f.kind === 'catch_secured' && f.playerId === release.playerId
        && f.elapsedSeconds <= release.elapsedSeconds).at(-1);
      return caught ? [{ playerId: release.playerId, releaseSeconds: release.elapsedSeconds,
        catchToReleaseSeconds: release.elapsedSeconds - caught.elapsedSeconds,
        basis: 'OBSERVED_TOTAL_CATCH_TO_RELEASE_INCLUDING_DECISION_PREPARATION' as const }] : [];
    }),
    runnerActions, runnerDecisions: telemetry.runnerDecisions,
    closure: result.diagnostics.playClosure,
  };
}

export type AverageFieldMatrixRequestV95 = Readonly<{ caseIds: readonly string[]; seeds: readonly number[];
  parks: readonly number[]; sides: readonly ('R' | 'L')[]; variants: readonly AverageFieldVariantV95[]; maxPlaySeconds?: number }>;
export function runAverageFieldMatrixV95(request: AverageFieldMatrixRequestV95, onTrial?: (trial: unknown) => void) {
  const trials: (ReturnType<typeof runAverageFieldTrialV95> | { caseId: string; category: AverageFieldCaseV95['category'] | null; seed: number; bats: 'R' | 'L'; parkRadiusMeters: number;
    variant: AverageFieldVariantV95; status: 'THROWN'; error: string })[] = [];
  for (const values of [request.caseIds, request.seeds, request.parks, request.sides, request.variants])
    if (!values.length || new Set<string | number>(values).size !== values.length) throw Error('average field harness: nonempty unique matrix axes required');
  for (const caseId of request.caseIds) for (const seed of request.seeds) for (const parkRadiusMeters of request.parks)
    for (const bats of request.sides) for (const variant of request.variants) {
      try { trials.push(runAverageFieldTrialV95({ caseId, seed, parkRadiusMeters, bats, variant, maxPlaySeconds: request.maxPlaySeconds })); }
      catch (error) { trials.push({ caseId, category: AVERAGE_FIELD_CASES_V95.find(c => c.id === caseId)?.category ?? null,
        seed, parkRadiusMeters, bats, variant, status: 'THROWN',
        error: error instanceof Error ? error.message : String(error) }); }
      onTrial?.(trials.at(-1));
    }
  const complete = trials.filter(t => t.status === 'COMPLETE'), unfinished = trials.filter(t => t.status === 'UNFINISHED'),
    thrown = trials.filter(t => t.status === 'THROWN'), failures = trials.filter(t => t.status !== 'COMPLETE' || t.anomalies.length > 0);
  const observations = trials.filter((t): t is ReturnType<typeof runAverageFieldTrialV95> => t.status !== 'THROWN');
  const pairs = observations.filter(t => t.purpose === 'PAIRED_EXECUTION_ERROR_WITH_FIXED_ABILITIES').map(t => {
    const baseline = observations.find(b => b.variant === 'baseline' && b.caseId === t.caseId && b.seed === t.seed
      && b.bats === t.bats && b.parkRadiusMeters === t.parkRadiusMeters), onset = t.firstReleaseSeconds;
    const prefix = (trial: typeof t) => trial.runnerActions.filter(a => onset !== null && a.elapsedSeconds < onset);
    return { caseId: t.caseId, seed: t.seed, bats: t.bats, parkRadiusMeters: t.parkRadiusMeters, variant: t.variant,
      baselineAvailable: !!baseline, targetReceptionMissObserved: t.targetReceptionMissObserved,
      interventionObservation: t.interventionObservation,
      preReleaseRunnerActionsIdentical: baseline && onset !== null ? JSON.stringify(prefix(t)) === JSON.stringify(prefix(baseline)) : null,
      runnerActionTraceChanged: baseline ? JSON.stringify(t.runnerActions) !== JSON.stringify(baseline.runnerActions) : null,
      finalRunnersChanged: baseline ? JSON.stringify(t.finalRunners) !== JSON.stringify(baseline.finalRunners) : null,
      endChanged: baseline ? JSON.stringify(t.end) !== JSON.stringify(baseline.end) : null };
  });
  return { version: 95, scope: 'SHARED_HOST_MAPPING_AUTHORED_CORPUS_FIXED_AVERAGE_AND_EXPLICIT_INTERVENTIONS' as const,
    profile: AVERAGE_FIELD_PROFILE_V95, reference: AVERAGE_FIELD_REFERENCE_V95, matrix: request,
    mlbCalibrationClaim: 'NOT_ESTABLISHED' as const, rfGroundOpportunityRateClaim: null,
    structuralPass: failures.length === 0,
    reviewRequired: observations.some(t => t.reviewObservations.length > 0),
    denominators: { planned: request.caseIds.length * request.seeds.length * request.parks.length * request.sides.length * request.variants.length,
      attempted: trials.length, complete: complete.length, unfinished: unfinished.length, thrown: thrown.length,
      anomalyTrials: observations.filter(t => t.anomalies.length > 0).length,
      reviewTrials: observations.filter(t => t.reviewObservations.length > 0).length,
      rfGroundTrials: trials.filter(t => t.category === 'rf_ground').length,
      rfGroundComplete: observations.filter(t => t.status === 'COMPLETE' && t.category === 'rf_ground').length,
      executionPairs: pairs.length, executionPairsWithMissedReception: pairs.filter(p => p.targetReceptionMissObserved === true).length,
      executionPairsWithoutTargetRelease: pairs.filter(p => p.interventionObservation === 'NO_TARGET_RELEASE').length },
    observations: { directRfToFirstRetirements: observations.filter(t => t.directRfToFirstRetirement).length,
      retentionFailures: observations.reduce((sum, t) => sum + t.retentionFailureCount, 0),
      missedReceptions: observations.reduce((sum, t) => sum + t.missedReceptionCount, 0),
      homeToFirstSamples: observations.filter(t => t.homeToFirstSeconds !== null).length,
      homeToFirstCensored: observations.filter(t => t.homeToFirstCensoredByRetirement).length },
    failures: failures.map(t => ({ caseId: t.caseId, seed: t.seed, bats: t.bats, parkRadiusMeters: t.parkRadiusMeters,
      variant: t.variant, status: t.status, ...(t.status === 'THROWN' ? { error: t.error } : { end: t.end, anomalies: t.anomalies }) })),
    pairs, trials };
}
