import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, type LivePlayerPhysicalV1, type LivePlayerV1 } from './LiveBaseballMatchV1';
import { createWorkbenchPlayer, WORKBENCH_TICKS_PER_SECOND, type WorkbenchPlayer } from './WorkbenchPlayer';
import { validateLiveTraitProfileV1, type LiveTraitProfileV1 } from './LiveTraitProfilesV1';
import { validateImpactTrajectorySettingsV1, type ImpactTrajectorySettingsV1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';
import { validatePitchRepertoireV77, validatePitchingMotionV77, type PitchRepertoireV77, type PitchingMotionV77 } from './LivePitchAuthoringV77';
import { validatePitchRepertoireV78, type PitchRepertoireV78 } from './LivePitchAuthoringV78';
import { validateBatterCourseProfileV79, type BatterCourseProfileV79 } from './BatterCourseProfileV79';
import { validateBatterCourseProfileV87, type BatterCourseProfileV87 } from './BatterCourseProfileV87';
import { validateZoneRecognitionV87, type ZoneRecognitionV87 } from './ZoneRecognitionV87';

/** Explicit numerical controls, not conversions from a trait grade or league.
 * SI/tick authoring remains local input; this adapter grants no Native authority. */
export type LivePhysicalAbilityControlsV1 = Readonly<{
  maximumPitchSpeedMps?: number; maximumSweetSpotSpeedMps?: number; targetSweetSpotSpeedMps?: number;
  motorLatencySeconds?: number; technicalTimingOffsetSeconds?: number; sweetSpotT?: number;
  attackAngleDegrees?: number; pullAngleDegrees?: number; badBallControl?: number; defensiveDecisionSeconds?: number;
  /** Optional local measured-bat adjustment; omitted values preserve old paths. */
  impactTrajectory?: ImpactTrajectorySettingsV1;
  /** Course-estimate uncertainty, independent of willingness to chase/swing. */
  zoneJudgmentStdMeters?: number;
  /** Absolute 1–100 course-reading ability; never a league percentile. */
  plateVision?: number;
  /** Optional V79 course consistency and fixed-field direction intention. */
  batterCourseProfileV79?: BatterCourseProfileV79;
  /** Independent human-facing thirteen-region course response. Legacy author data is retained. */
  batterCourseProfileV87?: BatterCourseProfileV87;
  /** Separate hidden role perception; no change to official strike adjudication. */
  zoneRecognitionV87?: ZoneRecognitionV87;
  /** Release geometry in metres, above the rubber surface / handed side /
   * toward home from the rubber. Omitted values use local body-height ratios. */
  pitchReleaseHeightMeters?: number; pitchReleaseSideMeters?: number; pitchReleaseExtensionMeters?: number;
  pitchRepertoire?: PitchRepertoireV77; pitchingMotion?: PitchingMotionV77;
  pitchRepertoireV78?: PitchRepertoireV78; minimumSpinRatio?: number;
  /** Tactical preferences; omitted values retain the controller defaults. */
  baserunningSafetyMarginSeconds?: number; fieldingPursuitCostWeight?: number;
  /** SI limits for continuous base rounding; omitted limits resolve in Host. */
  baserunningTurnRadiusMeters?: number; baserunningLateralAccelerationMps2?: number;
  preContactSeconds?: number; followThroughSeconds?: number; contactDepthMeters?: number;
  throwDirectionStdRadians?: number;
  swingDecision?: Readonly<{ approach: 'AUTO' | 'TAKE' | 'SWING'; threshold: number; aggressionWeight: number }>;
}>;
export type LiveRosterPhysicalV1 = LivePlayerPhysicalV1 & LivePhysicalAbilityControlsV1;
export type LiveRosterPhysicalPlayerV1 = Omit<LivePlayerV1, 'physical' | 'traitProfile'> & Readonly<{ physical: LiveRosterPhysicalV1; traitProfile?: LiveTraitProfileV1 }>;
export type LivePhysicalRosterEntryV1 = Readonly<{
  playerId: string; sourceId: string; workbenchPlayer?: WorkbenchPlayer;
  throws?: 'R' | 'L';
  physical?: Pick<LivePlayerPhysicalV1, 'basis'> & Partial<LiveRosterPhysicalV1>;
  maximumPitchSpeedKmh?: number; heightMeters?: number; legacyRelativeRatings?: Readonly<Record<string, number>>; traitLabels?: readonly string[];
  traitProfile?: LiveTraitProfileV1;
}>;
export type LivePhysicalRosterInputV1 = Readonly<{ version: 'live_physical_roster_v1'; sourceId: string; entries: readonly LivePhysicalRosterEntryV1[] }>;
type Projection = Readonly<{ inputPath: string; targetPath: string; conversion: string; value: unknown }>;
type Unsupported = Readonly<{ path: string; value: unknown; reason: string }>;
const scalarKeys = ['batLengthM', 'batMassKg', 'swingRate', 'timingStdSeconds', 'aimStdMeters', 'chaseMarginMeters', 'releaseSpeedMps',
  'commandStdMeters', 'reactionSeconds', 'topSpeedMps', 'accelerationMps2', 'gloveSpeedMps', 'gloveReachMeters', 'gloveRadiusMeters',
  'retentionCapacityJ', 'captureDissipationPowerW', 'transferSeconds', 'throwSpeedMps', 'maximumPitchSpeedMps',
  'maximumSweetSpotSpeedMps', 'targetSweetSpotSpeedMps', 'motorLatencySeconds', 'technicalTimingOffsetSeconds', 'sweetSpotT',
  'attackAngleDegrees', 'pullAngleDegrees', 'badBallControl', 'defensiveDecisionSeconds', 'preContactSeconds', 'followThroughSeconds', 'contactDepthMeters', 'throwDirectionStdRadians', 'zoneJudgmentStdMeters',
  'baserunningSafetyMarginSeconds', 'fieldingPursuitCostWeight', 'baserunningTurnRadiusMeters', 'baserunningLateralAccelerationMps2', 'plateVision',
  'pitchReleaseHeightMeters', 'pitchReleaseSideMeters', 'pitchReleaseExtensionMeters', 'minimumSpinRatio'] as const;
const physicalKeys: readonly string[] = ['basis', ...scalarKeys, 'spinRadPerSecond', 'clipId', 'swingDecision', 'impactTrajectory', 'pitchRepertoire', 'pitchingMotion', 'pitchRepertoireV78', 'batterCourseProfileV79', 'batterCourseProfileV87', 'zoneRecognitionV87'];
const bounds: Partial<Record<typeof scalarKeys[number], readonly [number, number]>> = {
  batLengthM: [.2, 3], batMassKg: [.1, 5], swingRate: [.3, 3], timingStdSeconds: [0, .08], aimStdMeters: [0, .35],
  chaseMarginMeters: [0, .6], releaseSpeedMps: [15, 85], maximumPitchSpeedMps: [15, 85], commandStdMeters: [0, .6],
  gloveSpeedMps: [.1, 40], gloveReachMeters: [.4, 3], gloveRadiusMeters: [.03, .3], retentionCapacityJ: [1, 2000],
  captureDissipationPowerW: [10, 1e6], maximumSweetSpotSpeedMps: [.1, 90], targetSweetSpotSpeedMps: [.1, 90],
  motorLatencySeconds: [0, 2], technicalTimingOffsetSeconds: [-.5, .5], sweetSpotT: [.65, .9],
  attackAngleDegrees: [-80, 80], pullAngleDegrees: [-80, 80], badBallControl: [0, 1],
  preContactSeconds: [.005, 2], followThroughSeconds: [.005, 2], contactDepthMeters: [.001, 2],
  throwDirectionStdRadians: [0, .12],
  zoneJudgmentStdMeters: [0, .6],
  plateVision: [1, 100],
  pitchReleaseHeightMeters: [.2, 3.2], pitchReleaseSideMeters: [0, 1.5], pitchReleaseExtensionMeters: [0, 3.5],
  minimumSpinRatio: [0, 1],
  baserunningSafetyMarginSeconds: [0, 3], fieldingPursuitCostWeight: [.25, 4],
  baserunningTurnRadiusMeters: [.5, 10], baserunningLateralAccelerationMps2: [.5, 20],
};
const nonnegative = new Set<string>(['reactionSeconds', 'transferSeconds', 'defensiveDecisionSeconds']);
const heightBounds = [1.1, 2.5] as const, maximumPitchSpeedKmhBounds = [54, 306] as const;
const decisionBounds = [0, 1] as const, spinMagnitudeLimit = 1200;
/** The same scalar limits used below; catalog display increments are not constraints. */
export function getLiveInternalValueLimitsV82(path: string, entryPath = false) {
  if (typeof path !== 'string') return null;
  const scalar = (scalarKeys as readonly string[]).includes(path);
  const limits = entryPath ? path === 'heightMeters' ? heightBounds : path === 'maximumPitchSpeedKmh' ? maximumPitchSpeedKmhBounds : null
    : scalar ? bounds[path as typeof scalarKeys[number]] : ['swingDecision.threshold', 'swingDecision.aggressionWeight'].includes(path) ? decisionBounds
    : ['spinRadPerSecond.x', 'spinRadPerSecond.y', 'spinRadPerSecond.z'].includes(path) ? [-spinMagnitudeLimit, spinMagnitudeLimit] as const : null;
  if (!limits && (entryPath || !scalar)) return null;
  return Object.freeze({ minimum: limits?.[0] ?? 0, maximum: limits?.[1] ?? null,
    minimumInclusive: !!limits || nonnegative.has(path), maximumInclusive: true, integer: false });
}
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error('live physical roster: ' + message); }
const validText = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200;
/** Legacy authoring fallback, independent of names, leagues and populations.
 * It reads an old packet without rewriting its SI, source IDs or JSON shape. */
export function resolveLivePlateVisionV1(physical: Readonly<{ plateVision?: number; zoneJudgmentStdMeters?: number }> = {}): number {
  if (physical.plateVision !== undefined) {
    assert(Number.isFinite(physical.plateVision) && physical.plateVision >= 1 && physical.plateVision <= 100, 'invalid absolute plate vision');
    return physical.plateVision;
  }
  const std = physical.zoneJudgmentStdMeters ?? .025;
  assert(Number.isFinite(std) && std >= 0 && std <= .6, 'invalid zone judgment SI');
  return std === 0 ? 100 : Math.max(1, Math.min(100, 45 - 100 * Math.log(std / .025)));
}
function fields(value: unknown, allowed: readonly string[], required: readonly string[], path: string): asserts value is Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'object required at ' + path);
  assert(Object.keys(value).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(value, k)), 'unknown or missing fields at ' + path);
}
function validatePhysical(raw: unknown): asserts raw is LiveRosterPhysicalV1 {
  fields(raw, physicalKeys, ['basis'], 'physical');
  assert(raw.basis === 'EXPLICIT_AUTHORED_SI_V1', 'explicit SI basis required');
  for (const key of scalarKeys) if (Object.hasOwn(raw, key)) {
    const value = raw[key], limits = bounds[key];
    assert(typeof value === 'number' && Number.isFinite(value) && (limits ? value >= limits[0] && value <= limits[1]
      : nonnegative.has(key) ? value >= 0 : value > 0), 'unsupported physical range: ' + key);
  }
  if (Object.hasOwn(raw, 'spinRadPerSecond')) {
    fields(raw.spinRadPerSecond, ['x', 'y', 'z'], ['x', 'y', 'z'], 'spinRadPerSecond');
    const spin = raw.spinRadPerSecond;
    assert(Object.values(spin).every(n => typeof n === 'number' && Number.isFinite(n))
      && Math.hypot(spin.x as number, spin.y as number, spin.z as number) <= spinMagnitudeLimit, 'invalid SI spin');
  }
  if (Object.hasOwn(raw, 'clipId')) assert(validText(raw.clipId), 'invalid measured clip identity');
  if (Object.hasOwn(raw, 'impactTrajectory')) validateImpactTrajectorySettingsV1(raw.impactTrajectory);
  if (Object.hasOwn(raw, 'batterCourseProfileV79')) validateBatterCourseProfileV79(raw.batterCourseProfileV79);
  if (Object.hasOwn(raw, 'batterCourseProfileV87')) validateBatterCourseProfileV87(raw.batterCourseProfileV87);
  if (Object.hasOwn(raw, 'zoneRecognitionV87')) validateZoneRecognitionV87(raw.zoneRecognitionV87);
  if (Object.hasOwn(raw, 'pitchRepertoire')) validatePitchRepertoireV77(raw.pitchRepertoire, raw.maximumPitchSpeedMps as number | undefined);
  assert(!(Object.hasOwn(raw, 'pitchRepertoire') && Object.hasOwn(raw, 'pitchRepertoireV78')), 'ambiguous V77 and V78 pitch ownership');
  if (Object.hasOwn(raw, 'pitchRepertoireV78')) validatePitchRepertoireV78(raw.pitchRepertoireV78, raw.maximumPitchSpeedMps as number | undefined);
  if (Object.hasOwn(raw, 'pitchingMotion')) validatePitchingMotionV77(raw.pitchingMotion);
  if (Object.hasOwn(raw, 'swingDecision')) {
    fields(raw.swingDecision, ['approach', 'threshold', 'aggressionWeight'], ['approach', 'threshold', 'aggressionWeight'], 'swingDecision');
    assert(['AUTO', 'TAKE', 'SWING'].includes(raw.swingDecision.approach as string)
      && [raw.swingDecision.threshold, raw.swingDecision.aggressionWeight].every(v => typeof v === 'number' && Number.isFinite(v) && v >= decisionBounds[0] && v <= decisionBounds[1]), 'invalid explicit swing decision');
  }
  if (raw.maximumSweetSpotSpeedMps !== undefined && raw.targetSweetSpotSpeedMps !== undefined)
    assert((raw.targetSweetSpotSpeedMps as number) <= (raw.maximumSweetSpotSpeedMps as number), 'target swing speed exceeds declared motor ceiling');
}

/** Preserves identity and every unsupported authored field. PROJECTED here means
 * an explicit numerical input was copied, not that a downstream execution ran. */
export function applyLivePhysicalRosterV1(raw: unknown) {
  const input = cloneInert(raw);
  fields(input, ['players', 'roster'], ['players', 'roster'], 'input');
  assert(Array.isArray(input.players), 'players required');
  const players = input.players as LivePlayerV1[];
  assert(players.every(p => validText(p.playerId) && validText(p.name) && Number.isFinite(p.heightMeters) && p.heightMeters >= heightBounds[0] && p.heightMeters <= heightBounds[1] && ['R', 'L'].includes(p.bats))
    && new Set(players.map(p => p.playerId)).size === players.length, 'invalid roster identity');
  fields(input.roster, ['version', 'sourceId', 'entries'], ['version', 'sourceId', 'entries'], 'roster');
  assert(input.roster.version === 'live_physical_roster_v1' && validText(input.roster.sourceId) && Array.isArray(input.roster.entries), 'invalid roster packet');
  const entries = input.roster.entries as LivePhysicalRosterEntryV1[];
  assert(new Set(entries.map(e => e.playerId)).size === entries.length, 'duplicate player source binding');
  const byId = new Map(players.map(p => [p.playerId, p]));
  for (const entry of entries) {
    fields(entry, ['playerId', 'sourceId', 'throws', 'workbenchPlayer', 'physical', 'maximumPitchSpeedKmh', 'heightMeters', 'legacyRelativeRatings', 'traitLabels', 'traitProfile'], ['playerId', 'sourceId'], 'entry');
    assert(validText(entry.playerId) && validText(entry.sourceId) && byId.has(entry.playerId), 'unknown player or source binding');
    assert(!(Object.hasOwn(entry, 'workbenchPlayer') && Object.hasOwn(entry, 'physical')), 'ambiguous physical authoring sources');
    if (Object.hasOwn(entry, 'throws')) assert(entry.throws === 'R' || entry.throws === 'L', 'invalid throwing hand');
    if (Object.hasOwn(entry, 'workbenchPlayer')) assert(entry.workbenchPlayer && typeof entry.workbenchPlayer === 'object', 'invalid maker authoring source');
    if (Object.hasOwn(entry, 'physical')) assert(entry.physical && typeof entry.physical === 'object', 'invalid physical authoring source');
  }
  const auditPlayers: { playerId: string; sourceId: string | null; sourcePlayerId: string | null; projected: Projection[]; unsupported: Unsupported[]; referenceDefaultPaths: string[] }[] = [];
  const output = players.map(player => {
    const entry = entries.find(e => e.playerId === player.playerId), projected: Projection[] = [], unsupported: Unsupported[] = [];
    let physical: LiveRosterPhysicalV1 = { ...(player.physical ?? LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1) }, heightMeters = player.heightMeters;
    validatePhysical(physical);
    let sourcePlayerId: string | null = null;
    const project = (inputPath: string, targetPath: string, value: unknown, conversion = 'identity') => {
      projected.push({ inputPath, targetPath, value: cloneInert(value), conversion });
    };
    if (entry?.physical) {
      validatePhysical(entry.physical);
      physical = { ...physical, ...entry.physical };
      for (const key of Object.keys(entry.physical).filter(k => k !== 'basis')) project('physical.' + key, key, entry.physical[key as keyof typeof entry.physical]);
    }
    if (entry?.workbenchPlayer) {
      const maker = createWorkbenchPlayer(entry.workbenchPlayer), c = maker.capability, s = maker.swing;
      sourcePlayerId = maker.identity.playerId; heightMeters = maker.body.heightMeters;
      physical = { ...physical, batLengthM: maker.bat.lengthM, batMassKg: maker.bat.massKg, sweetSpotT: maker.bat.sweetSpotT,
        maximumSweetSpotSpeedMps: c.maximumSweetSpotSpeedMps, targetSweetSpotSpeedMps: s.speedMps,
        motorLatencySeconds: c.motorLatencyTicks / WORKBENCH_TICKS_PER_SECOND,
        technicalTimingOffsetSeconds: c.technicalTimingOffsetTicks / WORKBENCH_TICKS_PER_SECOND,
        timingStdSeconds: c.timingErrorTicks / WORKBENCH_TICKS_PER_SECOND, aimStdMeters: c.positionErrorMeters,
        topSpeedMps: c.runSpeedMps, throwSpeedMps: c.throwSpeedMps, releaseSpeedMps: c.pitchSpeedMps,
        attackAngleDegrees: s.attackAngleDeg, pullAngleDegrees: s.pullAngleDeg, swingDecision: maker.decision, badBallControl: maker.traits.badBallControl,
        preContactSeconds: s.preContactSeconds, followThroughSeconds: s.followThroughSeconds, contactDepthMeters: s.contactDepthM };
      const mappings = [['body.heightMeters', 'heightMeters'], ['bat.lengthM', 'batLengthM'], ['bat.massKg', 'batMassKg'], ['bat.sweetSpotT', 'sweetSpotT'],
        ['capability.maximumSweetSpotSpeedMps', 'maximumSweetSpotSpeedMps'], ['swing.speedMps', 'targetSweetSpotSpeedMps'],
        ['capability.motorLatencyTicks', 'motorLatencySeconds'], ['capability.technicalTimingOffsetTicks', 'technicalTimingOffsetSeconds'],
        ['capability.timingErrorTicks', 'timingStdSeconds'], ['capability.positionErrorMeters', 'aimStdMeters'], ['capability.runSpeedMps', 'topSpeedMps'],
        ['capability.throwSpeedMps', 'throwSpeedMps'], ['capability.pitchSpeedMps', 'releaseSpeedMps'], ['swing.attackAngleDeg', 'attackAngleDegrees'],
        ['swing.pullAngleDeg', 'pullAngleDegrees'], ['decision', 'swingDecision'], ['traits.badBallControl', 'badBallControl'],
        ['swing.preContactSeconds', 'preContactSeconds'], ['swing.followThroughSeconds', 'followThroughSeconds'], ['swing.contactDepthM', 'contactDepthMeters']] as const;
      for (const [from, to] of mappings) project('workbenchPlayer.' + from, to, to === 'heightMeters' ? heightMeters : physical[to], from.endsWith('Ticks') ? 'tick / 1000000' : 'identity');
      for (const path of ['body.massKg', 'swing.loadAngleDeg', 'swing.finishAngleDeg', 'swing.handTravelM']) {
        const [group, key] = path.split('.');
        unsupported.push({ path: 'workbenchPlayer.' + path, value: (maker[group as 'body' | 'swing'] as unknown as Record<string, unknown>)[key],
          reason: 'No corresponding individual body/reference-trajectory motor consumer in this local Host; no inferred effect.' });
      }
      for (const key of ['playerId', 'name', 'leagueId', 'bats', 'throws'] as const) unsupported.push({ path: 'workbenchPlayer.identity.' + key,
        value: maker.identity[key], reason: 'Ability-only binding keeps the selected match identity and handedness; this identity field is retained as source provenance, not applied.' });
      maker.traits.labels.forEach((value, index) => unsupported.push({ path: `workbenchPlayer.traits.labels[${index}]`, value,
        reason: 'A display label does not supply a calibrated technical source or an extra physical bonus.' }));
    }
    if (entry?.maximumPitchSpeedKmh !== undefined) {
      assert(Number.isFinite(entry.maximumPitchSpeedKmh) && entry.maximumPitchSpeedKmh >= maximumPitchSpeedKmhBounds[0] && entry.maximumPitchSpeedKmh <= maximumPitchSpeedKmhBounds[1], 'unsupported maximum pitch speed');
      const maximumPitchSpeedMps = entry.maximumPitchSpeedKmh / 3.6;
      assert(physical.maximumPitchSpeedMps === undefined || physical.maximumPitchSpeedMps === maximumPitchSpeedMps, 'conflicting pitch speed limits');
      physical = { ...physical, maximumPitchSpeedMps };
      project('maximumPitchSpeedKmh', 'maximumPitchSpeedMps', maximumPitchSpeedMps, 'km/h / 3.6');
    }
    if (entry?.heightMeters !== undefined) {
      assert(Number.isFinite(entry.heightMeters) && entry.heightMeters >= heightBounds[0] && entry.heightMeters <= heightBounds[1], 'unsupported physical height');
      assert(!entry.workbenchPlayer || entry.workbenchPlayer.body.heightMeters === entry.heightMeters, 'conflicting body heights');
      heightMeters = entry.heightMeters; project('heightMeters', 'heightMeters', heightMeters);
    }
    if (entry?.throws !== undefined) project('throws', 'throws', entry.throws);
    if (entry?.legacyRelativeRatings !== undefined) {
      assert(entry.legacyRelativeRatings && typeof entry.legacyRelativeRatings === 'object' && !Array.isArray(entry.legacyRelativeRatings), 'invalid relative ratings');
      for (const [key, value] of Object.entries(entry.legacyRelativeRatings)) {
        assert(validText(key) && Number.isFinite(value), 'invalid relative rating entry');
        unsupported.push({ path: 'legacyRelativeRatings.' + key, value, reason: 'Relative display rating has no calibrated SI inverse; preserved without physical conversion.' });
      }
    }
    if (entry?.traitLabels !== undefined) {
      assert(Array.isArray(entry.traitLabels) && entry.traitLabels.every(validText) && new Set(entry.traitLabels).size === entry.traitLabels.length, 'invalid trait labels');
      entry.traitLabels.forEach((value, index) => unsupported.push({ path: `traitLabels[${index}]`, value,
        reason: 'Trait name alone is descriptive; an explicit current numerical source is required to execute its skill.' }));
    }
    validatePhysical(physical);
    const traitProfile = entry?.traitProfile === undefined ? undefined : validateLiveTraitProfileV1(entry.traitProfile, physical);
    if (traitProfile !== undefined) project('traitProfile', 'traitProfile', traitProfile,
      traitProfile.version === 'live_trait_profile_v2' ? 'INDEPENDENT_RUNTIME_TECHNIQUE_BASE_SI_UNCHANGED' : 'LOCAL_SOURCE_METADATA_NO_ADDITIONAL_EFFECT');
    assert(heightMeters >= heightBounds[0] && heightMeters <= heightBounds[1], 'unsupported physical height');
    const targetPaths = new Set(projected.map(p => p.targetPath));
    auditPlayers.push({ playerId: player.playerId, sourceId: entry?.sourceId ?? null, sourcePlayerId, projected, unsupported,
      referenceDefaultPaths: player.physical ? [] : Object.keys(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1).filter(k => k !== 'basis' && !targetPaths.has(k)) });
    // An omitted legacy profile stays unassessed, even after an earlier packet
    // supplied one. Never infer possession from a retained continuous source.
    const { traitProfile: _previousProfile, ...basePlayer } = player as LivePlayerV1 & Readonly<{ traitProfile?: LiveTraitProfileV1 }>;
    return { ...basePlayer, heightMeters, physical, ...(entry?.throws === undefined ? {} : { throws: entry.throws }),
      ...(traitProfile === undefined ? {} : { traitProfile }) } as LiveRosterPhysicalPlayerV1;
  });
  return freeze({ players: output, audit: { version: 'live_physical_roster_projection_v1' as const, sourceId: input.roster.sourceId,
    nativeAuthentication: false as const, projectionOnly: true as const, players: auditPlayers } });
}
