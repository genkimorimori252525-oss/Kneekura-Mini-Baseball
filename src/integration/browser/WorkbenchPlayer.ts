import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { REALISTIC_BASEBALL_RIGID_BODY, sampleBatRadius } from '../../core/sim/contact/RigidBatBallContact';
import { EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import type { BattingSource } from '../../core/world/psychology/batting/BattingTypes';

export const WORKBENCH_TICKS_PER_SECOND = 1_000_000 as const;
export type WorkbenchLeagueId = 'NPB' | 'MLB' | 'NLB' | 'KBO' | 'CUSTOM';
export type WorkbenchPlayer = Readonly<{
  schemaVersion: 1;
  identity: Readonly<{ playerId: string; name: string; leagueId: WorkbenchLeagueId; bats: 'R' | 'L'; throws: 'R' | 'L' }>;
  body: Readonly<{ heightMeters: number; massKg: number }>;
  capability: Readonly<{ maximumSweetSpotSpeedMps: number; motorLatencyTicks: number; technicalTimingOffsetTicks: number;
    runSpeedMps: number; throwSpeedMps: number; pitchSpeedMps: number; positionErrorMeters: number; timingErrorTicks: number }>;
  bat: Readonly<{ lengthM: number; massKg: number; sweetSpotT: number }>;
  swing: Readonly<{ speedMps: number; attackAngleDeg: number; pullAngleDeg: number; preContactSeconds: number;
    followThroughSeconds: number; contactDepthM: number; loadAngleDeg: number; finishAngleDeg: number; handTravelM: number }>;
  decision: Readonly<{ threshold: number; aggressionWeight: number; approach: 'AUTO' | 'TAKE' | 'SWING' }>;
  traits: Readonly<{ badBallControl: number; labels: readonly string[] }>;
}>;

const leagues: readonly WorkbenchLeagueId[] = ['NPB', 'MLB', 'NLB', 'KBO', 'CUSTOM'];
const inputRanges = {
  'body.heightMeters': [.8, 3], 'body.massKg': [15, 300],
  'capability.maximumSweetSpotSpeedMps': [.1, 90], 'capability.motorLatencyTicks': [1, 2_000_000],
  'capability.technicalTimingOffsetTicks': [-500_000, 500_000], 'capability.runSpeedMps': [.1, 20],
  'capability.throwSpeedMps': [.1, 80], 'capability.pitchSpeedMps': [.1, 80],
  'capability.positionErrorMeters': [0, 1], 'capability.timingErrorTicks': [0, 500_000],
  'bat.lengthM': [.2, 3], 'bat.massKg': [.05, 5], 'bat.sweetSpotT': [.65, .9],
  'swing.speedMps': [.1, 90], 'swing.attackAngleDeg': [-80, 80], 'swing.pullAngleDeg': [-80, 80],
  'swing.preContactSeconds': [.005, 2], 'swing.followThroughSeconds': [.005, 2],
  'swing.contactDepthM': [.001, 2], 'swing.loadAngleDeg': [-179, 179], 'swing.finishAngleDeg': [-179, 179],
  'swing.handTravelM': [0, 1], 'decision.threshold': [0, 1], 'decision.aggressionWeight': [0, 1], 'traits.badBallControl': [0, 1],
} as const;
/** Input limits only. Dynamic swing-speed coupling remains checked by the validator. */
export function getWorkbenchInternalValueLimitsV82(path: string) {
  if (typeof path !== 'string' || !Object.hasOwn(inputRanges, path)) return null;
  const limits = inputRanges[path as keyof typeof inputRanges];
  return Object.freeze({ minimum: limits[0], maximum: limits[1], minimumInclusive: true, maximumInclusive: true,
    integer: path.endsWith('Ticks') });
}
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const fields = (value: unknown, keys: readonly string[], path: string): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw new Error(`invalid workbench fields: ${path}`);
};
const text = (value: unknown, path: string): void => {
  if (typeof value !== 'string' || !value.length || value.trim() !== value || value.length > 160) throw new Error(`invalid workbench text: ${path}`);
};
const range = (value: number, low: number, high: number, path: string): void => {
  if (!Number.isFinite(value) || value < low || value > high) throw new Error(`invalid workbench range: ${path}`);
};
const ticks = (value: number, low: number, high: number, path: string): void => {
  range(value, low, high, path);
  if (!Number.isSafeInteger(value)) throw new Error(`workbench ticks must be integers: ${path}`);
};

/** Detached, inert SI/tick authoring data. Bounds are workbench input limits,
 * not league regulations, player scouting, or a probability of baseball results. */
export function createWorkbenchPlayer(raw: unknown): WorkbenchPlayer {
  const player = cloneInert(raw) as WorkbenchPlayer;
  fields(player, ['schemaVersion', 'identity', 'body', 'capability', 'bat', 'swing', 'decision', 'traits'], 'player');
  if (player.schemaVersion !== 1) throw new Error('unsupported workbench player schema');
  fields(player.identity, ['playerId', 'name', 'leagueId', 'bats', 'throws'], 'identity');
  text(player.identity.playerId, 'playerId'); text(player.identity.name, 'name');
  if (!leagues.includes(player.identity.leagueId) || !['R', 'L'].includes(player.identity.bats)
    || !['R', 'L'].includes(player.identity.throws)) throw new Error('invalid workbench identity');
  fields(player.body, ['heightMeters', 'massKg'], 'body');
  range(player.body.heightMeters, ...inputRanges['body.heightMeters'], 'heightMeters'); range(player.body.massKg, ...inputRanges['body.massKg'], 'body.massKg');
  fields(player.capability, ['maximumSweetSpotSpeedMps', 'motorLatencyTicks', 'technicalTimingOffsetTicks', 'runSpeedMps',
    'throwSpeedMps', 'pitchSpeedMps', 'positionErrorMeters', 'timingErrorTicks'], 'capability');
  const c = player.capability;
  range(c.maximumSweetSpotSpeedMps, ...inputRanges['capability.maximumSweetSpotSpeedMps'], 'maximumSweetSpotSpeedMps');
  ticks(c.motorLatencyTicks, ...inputRanges['capability.motorLatencyTicks'], 'motorLatencyTicks');
  ticks(c.technicalTimingOffsetTicks, ...inputRanges['capability.technicalTimingOffsetTicks'], 'technicalTimingOffsetTicks');
  range(c.runSpeedMps, ...inputRanges['capability.runSpeedMps'], 'runSpeedMps'); range(c.throwSpeedMps, ...inputRanges['capability.throwSpeedMps'], 'throwSpeedMps');
  range(c.pitchSpeedMps, ...inputRanges['capability.pitchSpeedMps'], 'pitchSpeedMps'); range(c.positionErrorMeters, ...inputRanges['capability.positionErrorMeters'], 'positionErrorMeters');
  ticks(c.timingErrorTicks, ...inputRanges['capability.timingErrorTicks'], 'timingErrorTicks');
  fields(player.bat, ['lengthM', 'massKg', 'sweetSpotT'], 'bat');
  range(player.bat.lengthM, ...inputRanges['bat.lengthM'], 'bat.lengthM'); range(player.bat.massKg, ...inputRanges['bat.massKg'], 'bat.massKg');
  // Measured model points six inches from a 34-inch tip are at T≈.824.
  // Keep the authored value; the older image-only .78 limit excluded them.
  range(player.bat.sweetSpotT, ...inputRanges['bat.sweetSpotT'], 'sweetSpotT (declared barrel reference)');
  fields(player.swing, ['speedMps', 'attackAngleDeg', 'pullAngleDeg', 'preContactSeconds', 'followThroughSeconds',
    'contactDepthM', 'loadAngleDeg', 'finishAngleDeg', 'handTravelM'], 'swing');
  const s = player.swing;
  range(s.speedMps, inputRanges['swing.speedMps'][0], c.maximumSweetSpotSpeedMps, 'swing speed envelope');
  range(s.attackAngleDeg, ...inputRanges['swing.attackAngleDeg'], 'attackAngleDeg'); range(s.pullAngleDeg, ...inputRanges['swing.pullAngleDeg'], 'pullAngleDeg');
  range(s.preContactSeconds, ...inputRanges['swing.preContactSeconds'], 'preContactSeconds'); range(s.followThroughSeconds, ...inputRanges['swing.followThroughSeconds'], 'followThroughSeconds');
  range(s.contactDepthM, ...inputRanges['swing.contactDepthM'], 'contactDepthM'); range(s.loadAngleDeg, ...inputRanges['swing.loadAngleDeg'], 'loadAngleDeg');
  range(s.finishAngleDeg, ...inputRanges['swing.finishAngleDeg'], 'finishAngleDeg'); range(s.handTravelM, ...inputRanges['swing.handTravelM'], 'handTravelM');
  fields(player.decision, ['threshold', 'aggressionWeight', 'approach'], 'decision');
  range(player.decision.threshold, ...inputRanges['decision.threshold'], 'threshold'); range(player.decision.aggressionWeight, ...inputRanges['decision.aggressionWeight'], 'aggressionWeight');
  if (!['AUTO', 'TAKE', 'SWING'].includes(player.decision.approach)) throw new Error('invalid workbench approach');
  fields(player.traits, ['badBallControl', 'labels'], 'traits'); range(player.traits.badBallControl, ...inputRanges['traits.badBallControl'], 'badBallControl');
  if (!Array.isArray(player.traits.labels) || player.traits.labels.length > 32) throw new Error('invalid workbench trait labels');
  player.traits.labels.forEach(label => text(label, 'trait label'));
  if (new Set(player.traits.labels).size !== player.traits.labels.length) throw new Error('duplicate workbench trait label');
  return freeze(player);
}

/** Generic authoring reference, never an actual TBD/LAD player or league cohort. */
export function defaultWorkbenchPlayer(): WorkbenchPlayer {
  const profile = EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1;
  return createWorkbenchPlayer({ schemaVersion: 1,
    identity: { playerId: 'workbench-new-player', name: '新規選手', leagueId: 'CUSTOM', bats: 'R', throws: 'R' },
    body: { heightMeters: 1.8, massKg: 80 },
    capability: { maximumSweetSpotSpeedMps: 45, motorLatencyTicks: 140_000, technicalTimingOffsetTicks: 0,
      runSpeedMps: 7, throwSpeedMps: 35, pitchSpeedMps: 40, positionErrorMeters: 0.006, timingErrorTicks: 8_000 },
    bat: { lengthM: profile.batLengthM, massKg: 0.9, sweetSpotT: profile.sweetSpotT },
    swing: { speedMps: profile.baseContactSweetSpotSpeedMps, attackAngleDeg: profile.middleAttackAngleDeg, pullAngleDeg: 0,
      preContactSeconds: profile.basePreContactSeconds, followThroughSeconds: profile.followThroughSeconds,
      contactDepthM: profile.centerContactDepthM, loadAngleDeg: -70, finishAngleDeg: 65, handTravelM: 0.22 },
    decision: { threshold: 0.5, aggressionWeight: 0.5, approach: 'AUTO' }, traits: { badBallControl: 0, labels: [] },
  });
}

export type WorkbenchLeagueMetricKey = 'maximumSweetSpotSpeedMps' | 'swingSpeedMps' | 'runSpeedMps' | 'throwSpeedMps'
  | 'pitchSpeedMps' | 'positionErrorMeters' | 'timingErrorTicks' | 'motorLatencyTicks';
export type WorkbenchLeaguePreview = Readonly<{
  leagueId: WorkbenchLeagueId; sampleCount: number; available: boolean; policyId: 'workbench-population-preview-v1';
  metrics: readonly Readonly<{ key: WorkbenchLeagueMetricKey; label: string; unit: 'm/s' | 'm' | 'tick';
    actual: number; mean: number | null; stddev: number | null; rating: number | null }>[];
}>;
const metrics: readonly Readonly<{ key: WorkbenchLeagueMetricKey; label: string; unit: 'm/s' | 'm' | 'tick';
  direction: 1 | -1; value: (player: WorkbenchPlayer) => number }>[] = [
  { key: 'maximumSweetSpotSpeedMps', label: '芯の最大速度', unit: 'm/s', direction: 1, value: p => p.capability.maximumSweetSpotSpeedMps },
  { key: 'swingSpeedMps', label: '設定スイング速度', unit: 'm/s', direction: 1, value: p => p.swing.speedMps },
  { key: 'runSpeedMps', label: '走速度', unit: 'm/s', direction: 1, value: p => p.capability.runSpeedMps },
  { key: 'throwSpeedMps', label: '送球初速', unit: 'm/s', direction: 1, value: p => p.capability.throwSpeedMps },
  { key: 'pitchSpeedMps', label: '投球初速', unit: 'm/s', direction: 1, value: p => p.capability.pitchSpeedMps },
  { key: 'positionErrorMeters', label: '位置誤差', unit: 'm', direction: -1, value: p => p.capability.positionErrorMeters },
  { key: 'timingErrorTicks', label: 'タイミング誤差', unit: 'tick', direction: -1, value: p => p.capability.timingErrorTicks },
  { key: 'motorLatencyTicks', label: '運動遅延', unit: 'tick', direction: -1, value: p => p.capability.motorLatencyTicks },
];

/** Descriptive 50 + 20z preview from the supplied actual cohort. The SD uses
 * the whole cohort (N), not an estimated population or a league-name multiplier. */
export function previewLeagueRatings(rawPlayer: WorkbenchPlayer, population: readonly WorkbenchPlayer[],
  leagueId: WorkbenchLeagueId): WorkbenchLeaguePreview {
  const player = createWorkbenchPlayer(rawPlayer);
  if (!leagues.includes(leagueId) || !Array.isArray(population)) throw new Error('invalid workbench preview population');
  const members = population.map(createWorkbenchPlayer);
  if (new Set(members.map(p => p.identity.playerId)).size !== members.length) throw new Error('duplicate workbench population player');
  const cohort = members.filter(p => p.identity.leagueId === leagueId);
  const projected = metrics.map(metric => {
    let mean = 0, variance = 0;
    cohort.forEach((member, index) => { const value = metric.value(member), delta = value - mean;
      mean += delta / (index + 1); variance += delta * (value - mean); });
    const stddev = cohort.length ? Math.sqrt(Math.max(0, variance / cohort.length)) : null;
    const actual = metric.value(player);
    const rating = cohort.length >= 2 && stddev !== null && stddev > 0
      ? Math.max(0, 50 + 20 * metric.direction * (actual - mean) / stddev) : null;
    return { key: metric.key, label: metric.label, unit: metric.unit, actual,
      mean: cohort.length ? mean : null, stddev, rating };
  });
  return freeze({ leagueId, sampleCount: cohort.length, available: projected.some(metric => metric.rating !== null),
    policyId: 'workbench-population-preview-v1' as const, metrics: projected });
}

export type WorkbenchPlayerSources = Readonly<{
  boundary: 'AUTHORING_VALUES_NOT_ACCEPTED_NATIVE_SOURCE'; ticksPerSecond: typeof WORKBENCH_TICKS_PER_SECOND;
  capability: Pick<BattingSource, 'motorLatencyTicks' | 'technicalTimingOffsetTicks' | 'maximumSweetSpotSpeedMps'>;
  repertoire: Pick<BattingSource, 'repertoireId' | 'repertoireVersion' | 'profiles'>;
  decision: BattingSource['decisionModel']; equipment: Pick<BattingSource, 'batPhysical' | 'ball'>;
  /** Retain every authored knob; these require their actual actor/model owners. */
  authoring: WorkbenchPlayer;
}>;

export function exportWorkbenchPlayerSources(raw: WorkbenchPlayer): WorkbenchPlayerSources {
  const player = createWorkbenchPlayer(raw);
  // Explicit generic wooden-bat silhouette. Dimensions/density distribution are
  // authoring references, not a measurement of a named player's equipment.
  const radiusProfile = { knots: [{ t: 0, radiusM: 0.024 }, { t: 0.04, radiusM: 0.014 },
    { t: 0.30, radiusM: 0.018 }, { t: 0.65, radiusM: 0.030 }, { t: 0.78, radiusM: 0.033 }, { t: 1, radiusM: 0.012 }] };
  const slices = Array.from({ length: 256 }, (_, index) => {
    const t = (index + 0.5) / 256, radiusM = sampleBatRadius(radiusProfile, t);
    return { t, radiusM, weight: radiusM * radiusM };
  });
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0);
  const centerOfMassT = slices.reduce((sum, slice) => sum + slice.t * slice.weight, 0) / total;
  const transverseMomentOfInertiaKgM2 = slices.reduce((sum, slice) => sum + player.bat.massKg * slice.weight / total
    * (((slice.t - centerOfMassT) * player.bat.lengthM) ** 2 + slice.radiusM ** 2 / 4 + (player.bat.lengthM / 256) ** 2 / 12), 0);
  const axialMomentOfInertiaKgM2 = slices.reduce((sum, slice) => sum + player.bat.massKg * slice.weight / total * slice.radiusM ** 2 / 2, 0);
  const reference = EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1;
  return freeze({ boundary: 'AUTHORING_VALUES_NOT_ACCEPTED_NATIVE_SOURCE' as const, ticksPerSecond: WORKBENCH_TICKS_PER_SECOND,
    capability: { motorLatencyTicks: player.capability.motorLatencyTicks, technicalTimingOffsetTicks: player.capability.technicalTimingOffsetTicks,
      maximumSweetSpotSpeedMps: player.capability.maximumSweetSpotSpeedMps },
    repertoire: { repertoireId: 'workbench-authored-swing', repertoireVersion: 'workbench-player-v1', profiles: [{ minimumAggression: 0,
      profile: { ...reference, profileId: 'workbench-authored-course', version: 'workbench-player-v1',
        batLengthM: player.bat.lengthM, sweetSpotT: player.bat.sweetSpotT, centerContactDepthM: player.swing.contactDepthM,
        baseContactSweetSpotSpeedMps: player.swing.speedMps, contactDepthSpeedGainMpsPerM: 0,
        basePreContactSeconds: player.swing.preContactSeconds, followThroughSeconds: player.swing.followThroughSeconds,
        highAttackAngleDeg: player.swing.attackAngleDeg, middleAttackAngleDeg: player.swing.attackAngleDeg,
        lowAttackAngleDeg: player.swing.attackAngleDeg, courseAttackDirectionGainDeg: player.swing.pullAngleDeg } }] },
    decision: { modelId: 'workbench-authored-decision', version: 'workbench-player-v1', threshold: player.decision.threshold,
      aggressionWeight: player.decision.aggressionWeight },
    equipment: { batPhysical: { massKg: player.bat.massKg, centerOfMassT, transverseMomentOfInertiaKgM2,
      axialMomentOfInertiaKgM2, radiusProfile }, ball: { ...REALISTIC_BASEBALL_RIGID_BODY } }, authoring: player,
  });
}
