import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerObservationCalibration, type PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { createPlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
import { createPlayerLocomotionCalibration, type PlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import { samePaFieldThrowValuesInput, type SamePaFieldThrowValues } from '../../host/world/SamePlateAppearanceLifecycleCalibrationSource';
import type { AcceptedPlayerObservationModel } from '../../host/world/SqlitePlayerObservationModelStore';
import type { AcceptedPlayerDecisionModel } from '../../host/world/SqlitePlayerDecisionModelStore';
import type { AcceptedPlayerLocomotionModel } from '../../host/world/SqlitePlayerLocomotionModelStore';

type Triple = Readonly<{ minimum: string; maximum: string }>;
type AuthoredDefender = Readonly<{
  playerId: string; personLinkSourceId: string; fieldingModelSourceId: string;
  observation: Omit<PlayerObservationCalibration, 'refreshPolicy' | 'qualityParameters' | 'memoryDecayParameters'> & Readonly<{
    refreshSeconds: Readonly<{ attended: string; peripheral: string }>;
    qualityParameters: Omit<PlayerObservationCalibration['qualityParameters'], 'fullQualityObservationDurationSeconds'> & Readonly<{ fullQualityObservationDurationSeconds: string }>;
    memoryDecayParameters: Omit<PlayerObservationCalibration['memoryDecayParameters'], 'ticksPerSecond'>;
  }>;
  decision: Readonly<{
    decisionSeconds: Triple & Readonly<{ fixedProcessingOffset: string }>;
    firstStepSeconds: Triple & Readonly<{ fixedMotorOffset: string }>;
    minimumCueConfidence: number; communicationTrust: number;
  }>;
  locomotion: Omit<PlayerLocomotionCalibration, 'maxIntegrationStepTicks'> & Readonly<{ maximumControlStepSeconds: string }>;
  transferSeconds: Triple & Readonly<{ fixedGripOffset: string }>;
  throwCalibration: SamePaFieldThrowValues['throwCalibration'];
}>;
export type AuthoredMatchClockManifestV1 = Readonly<{
  version: 'authored_match_si_clock_v1'; authority: 'AUTHORED_SYNTHETIC_NOT_EMPIRICAL'; units: 'SI';
  namespace: string; revision: number; careerId: string; acceptedAtDay: number;
  clock: Readonly<{ ticksPerSecond: 1_000_000 }>; defenders: readonly AuthoredDefender[];
}>;
type Conversion = Readonly<{ path: string; seconds: string; ticks: number; ticksPerSecond: 1_000_000 }>;
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const fields = (value: unknown, names: readonly string[]): void => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== [...names].sort().join('|')) throw new Error('invalid authored clock fields');
};
const integer = (value: number, minimum: number) => {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error('invalid authored clock integer');
};

/** Compiles new, explicitly authored SI declarations only. It never changes
 * legacy nominal/effective models, invents measurements, or grants Native
 * acceptance. Original owners still authenticate Person/model/ref/current-view
 * and lineage. A future writer must use this generated Source set and assert
 * the same physical clock; sourceVersion alone is not general unit authority. */
export const compileAuthoredMatchClockV1 = (raw: unknown) => {
  const manifest = cloneInert(raw) as AuthoredMatchClockManifestV1;
  fields(manifest, ['version', 'authority', 'units', 'namespace', 'revision', 'careerId', 'acceptedAtDay', 'clock', 'defenders']);
  fields(manifest.clock, ['ticksPerSecond']);
  if (manifest.version !== 'authored_match_si_clock_v1' || manifest.authority !== 'AUTHORED_SYNTHETIC_NOT_EMPIRICAL'
    || manifest.units !== 'SI' || manifest.clock.ticksPerSecond !== 1_000_000
    || typeof manifest.namespace !== 'string' || !/^[a-z][a-z0-9-]{2,80}$/.test(manifest.namespace)
    || !Array.isArray(manifest.defenders) || manifest.defenders.length !== 9) throw new Error('invalid authored match clock scope');
  integer(manifest.revision, 1); integer(manifest.acceptedAtDay, 0);
  const used = new Set<string>(), conversionLedger: Conversion[] = [];
  const identity = (id: string): string => {
    if (typeof id !== 'string' || !id.startsWith(manifest.namespace + ':') || id.length <= manifest.namespace.length + 1
      || id.length > 240 || /\s/.test(id) || used.has(id)) throw new Error('invalid or duplicate authored namespace identity');
    used.add(id); return id;
  };
  identity(manifest.careerId);
  // Record every requested source identity before generating any new ID, so
  // a cross-role alias cannot depend on input traversal order.
  for (const defender of manifest.defenders) {
    fields(defender, ['playerId', 'personLinkSourceId', 'fieldingModelSourceId', 'observation', 'decision', 'locomotion', 'transferSeconds', 'throwCalibration']);
    identity(defender.playerId); identity(defender.personLinkSourceId); identity(defender.fieldingModelSourceId);
  }
  const seconds = (value: string, path: string, positive = false): number => {
    if (typeof value !== 'string' || value.length > 32 || !/^(0|[1-9]\d{0,9})(?:\.(\d{1,18}))?$/.test(value)) throw new Error('invalid authored decimal seconds');
    const [whole, fraction = ''] = value.split('.'), denominator = 10n ** BigInt(fraction.length);
    const numerator = BigInt(whole) * denominator + BigInt(fraction || '0');
    const scaled = numerator * 1_000_000n;
    if (scaled % denominator !== 0n || scaled / denominator > BigInt(Number.MAX_SAFE_INTEGER)
      || positive && scaled === 0n) throw new Error('authored seconds cannot be represented exactly as safe ticks');
    const ticks = Number(scaled / denominator);
    conversionLedger.push({ path, seconds: value, ticks, ticksPerSecond: 1_000_000 }); return ticks;
  };
  const plannedDefenders = manifest.defenders.map((defender, index) => {
    const path = 'defenders[' + index + ']', o = defender.observation, d = defender.decision, l = defender.locomotion, t = defender.transferSeconds;
    fields(o, ['perceptionAbility', 'refreshSeconds', 'geometryParameters', 'qualityParameters', 'errorParameters', 'memoryDecayParameters']);
    fields(o.refreshSeconds, ['attended', 'peripheral']);
    fields(o.memoryDecayParameters, ['confidenceLossPerSecond', 'confidenceFloor']);
    fields(d, ['decisionSeconds', 'firstStepSeconds', 'minimumCueConfidence', 'communicationTrust']);
    fields(d.decisionSeconds, ['minimum', 'maximum', 'fixedProcessingOffset']);
    fields(d.firstStepSeconds, ['minimum', 'maximum', 'fixedMotorOffset']);
    fields(t, ['minimum', 'maximum', 'fixedGripOffset']);
    const { refreshSeconds, ...nonRefresh } = o;
    const observation = createPlayerObservationCalibration({ ...nonRefresh,
      refreshPolicy: { attendedIntervalTicks: seconds(refreshSeconds.attended, path + '.observation.refresh.attended', true),
        peripheralIntervalTicks: seconds(refreshSeconds.peripheral, path + '.observation.refresh.peripheral', true) },
      qualityParameters: { ...o.qualityParameters, fullQualityObservationDurationSeconds:
        seconds(o.qualityParameters.fullQualityObservationDurationSeconds, path + '.observation.duration', true) / 1_000_000 },
      memoryDecayParameters: { ...o.memoryDecayParameters, ticksPerSecond: 1_000_000 } });
    const decision = createPlayerDecisionCalibration({ minimumCueConfidence: d.minimumCueConfidence, communicationTrust: d.communicationTrust,
      decisionTimingParameters: { minimumDecisionDelayTicks: seconds(d.decisionSeconds.minimum, path + '.decision.minimum'),
        maximumDecisionDelayTicks: seconds(d.decisionSeconds.maximum, path + '.decision.maximum'),
        fixedProcessingOffsetTicks: seconds(d.decisionSeconds.fixedProcessingOffset, path + '.decision.fixed') },
      firstStepTimingParameters: { minimumFirstStepDelayTicks: seconds(d.firstStepSeconds.minimum, path + '.firstStep.minimum'),
        maximumFirstStepDelayTicks: seconds(d.firstStepSeconds.maximum, path + '.firstStep.maximum'),
        fixedMotorOffsetTicks: seconds(d.firstStepSeconds.fixedMotorOffset, path + '.firstStep.fixed') } });
    const { maximumControlStepSeconds, ...locomotionSI } = l;
    const locomotion = createPlayerLocomotionCalibration({ ...locomotionSI,
      maxIntegrationStepTicks: seconds(maximumControlStepSeconds, path + '.locomotion.maximumControlStep', true) });
    const defenderThrow: SamePaFieldThrowValues = { throwCalibration: defender.throwCalibration,
      transferParameters: { minimumTransferDelayTicks: seconds(t.minimum, path + '.transfer.minimum'),
        maximumTransferDelayTicks: seconds(t.maximum, path + '.transfer.maximum'), fixedGripOffsetTicks: seconds(t.fixedGripOffset, path + '.transfer.fixed') } };
    samePaFieldThrowValuesInput(defenderThrow);
    const declarationId = (route: string) => identity(manifest.namespace + ':r' + manifest.revision + ':' + route + ':' + defender.playerId);
    const common = { sourceVersion: 'authored_si_clock_1000000_v1', careerId: manifest.careerId, playerId: defender.playerId,
      personLinkSourceId: defender.personLinkSourceId, fieldingModelSourceId: defender.fieldingModelSourceId, acceptedAtDay: manifest.acceptedAtDay };
    const plannedModelSources: { observation: AcceptedPlayerObservationModel; decision: AcceptedPlayerDecisionModel; locomotion: AcceptedPlayerLocomotionModel } = {
      observation: { ...common, sourceId: declarationId('observation'), calibration: observation },
      decision: { ...common, sourceId: declarationId('decision'), calibration: decision },
      locomotion: { ...common, sourceId: declarationId('locomotion'), capability: 'defender_locomotion_v1', calibration: locomotion } };
    return { playerId: defender.playerId, plannedModelSources,
      effectiveValues: { defender_observation: observation, defender_decision: decision, defender_locomotion: locomotion, defender_throw: defenderThrow },
      plannedEffectiveDeclarationIds: { defender_observation: declarationId('effective-observation'), defender_decision: declarationId('effective-decision'),
        defender_locomotion: declarationId('effective-locomotion'), defender_throw: declarationId('effective-throw') } };
  });
  return freeze({ manifest, plannedDefenders, conversionLedger, nativeReady: false as const,
    boundary: 'AUTHORING_DECLARATIONS_NOT_NATIVE_SOURCE_ACCEPTANCE' as const,
    unconnectedTemporalDomains: ['batting', 'pitch', 'communication', 'runner', 'scene_and_role_coverage', 'native_genesis'] as const });
};
