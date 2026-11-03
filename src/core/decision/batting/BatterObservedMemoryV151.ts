import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { forecastObservedPitchV151 } from './ObservedPitchForecastV151';

/** Explicit operational weights, not a measured personality or visual calibration. */
export type BatterObservedMemoryPolicyV151 = Readonly<{
  version:'batter_observed_memory_policy_v151';sourceId:string;maximumEntriesPerPair:number;unprofiledPriorWeight:number;
}>;
/** A forecast episode remains unclassified; no real PitchCall or outcome enters this data. */
export type BatterObservedEvidenceV151 = Readonly<{
  version:'batter_observed_evidence_v151';evidenceId:string;observerPlayerId:string;pitcherId:string;pitchOrdinal:number;
  observedTick:number;availableTick:number;position:Vec3;arrivalAfterReleaseSeconds:number;regionId:string|null;
  classification:'UNCLASSIFIED_OBSERVED_FLIGHT';sourceObservationIds:readonly string[];
}>;
export type BatterObservedMemoryV151 = Readonly<{
  version:'batter_observed_memory_v151';observerPlayerId:string;pitcherId:string;totalObservations:number;
  entries:readonly BatterObservedEvidenceV151[];
}>;
export type BatterObservedRecallV151 = Readonly<{
  kind:'UNCLASSIFIED_EMPIRICAL_FORECAST';evidenceId:string;position:Vec3;arrivalAfterReleaseSeconds:number;
  observedThroughTick:number;eligibleObservationCount:number;empiricalProbability:number;priorWeight:number;
  confidence:null;pitchFamilyRecognized:false;
}>;
type ForecastV151 = ReturnType<typeof forecastObservedPitchV151>;
type EvidenceSourceV151 = Readonly<{
  evidenceId:string;observerPlayerId:string;pitcherId:string;pitchOrdinal:number;forecast:ForecastV151;regionId:string|null;
}>;
const fields = (value:unknown, names:readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const text = (value:unknown):value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200;
const tick = (value:number) => Number.isSafeInteger(value) && value >= 0;
const unit = (value:number) => Number.isFinite(value) && value >= 0 && value <= 1;
const vector = (value:Vec3) => fields(value, ['x', 'y', 'z']) && [value.x, value.y, value.z].every(Number.isFinite);
const ids = (values:readonly string[]) => Array.isArray(values) && values.length > 0 && values.every(text) && new Set(values).size === values.length;
function assert(condition:unknown, message:string):asserts condition {
  if (!condition) throw new Error('batter observed memory v151: ' + message);
}
function frozen<T>(value:T):T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(frozen);Object.freeze(value); }
  return value;
}

export function validateBatterObservedMemoryPolicyV151(raw:unknown):BatterObservedMemoryPolicyV151 {
  const policy = cloneInert(raw) as BatterObservedMemoryPolicyV151;
  assert(fields(policy, ['version', 'sourceId', 'maximumEntriesPerPair', 'unprofiledPriorWeight'])
    && policy.version === 'batter_observed_memory_policy_v151' && text(policy.sourceId)
    && Number.isInteger(policy.maximumEntriesPerPair) && policy.maximumEntriesPerPair >= 1 && policy.maximumEntriesPerPair <= 64
    && unit(policy.unprofiledPriorWeight), 'invalid explicit operation policy');
  return frozen(policy);
}
function readEvidence(evidence:BatterObservedEvidenceV151):BatterObservedEvidenceV151 {
  assert(fields(evidence, ['version', 'evidenceId', 'observerPlayerId', 'pitcherId', 'pitchOrdinal', 'observedTick', 'availableTick',
    'position', 'arrivalAfterReleaseSeconds', 'regionId', 'classification', 'sourceObservationIds'])
    && evidence.version === 'batter_observed_evidence_v151' && [evidence.evidenceId, evidence.observerPlayerId, evidence.pitcherId].every(text)
    && Number.isSafeInteger(evidence.pitchOrdinal) && evidence.pitchOrdinal > 0 && tick(evidence.observedTick)
    && tick(evidence.availableTick) && evidence.availableTick >= evidence.observedTick && vector(evidence.position)
    && Number.isFinite(evidence.arrivalAfterReleaseSeconds) && evidence.arrivalAfterReleaseSeconds > 0
    && (evidence.regionId === null || text(evidence.regionId)) && evidence.classification === 'UNCLASSIFIED_OBSERVED_FLIGHT'
    && ids(evidence.sourceObservationIds), 'invalid unclassified observed evidence');
  return evidence;
}
export function validateBatterObservedEvidenceV151(raw:unknown):BatterObservedEvidenceV151 {
  return frozen(readEvidence(cloneInert(raw) as BatterObservedEvidenceV151));
}

/** This boundary accepts the raw position-only forecast, never an old-prior mixture. */
function readForecast(forecast:ForecastV151):ForecastV151 {
  assert(fields(forecast, ['version', 'status', 'cutoffTick', 'observedThroughTick', 'availableAtTick', 'usedObservationIds', 'prediction',
    'model', 'humanCalibration', 'opponentPrivateStateUsed', 'futureSourceUsed'])
    && forecast.version === 'observed_pitch_forecast_v151'
    && ['PREDICTED', 'NO_DELIVERED_OBSERVATIONS', 'INSUFFICIENT_OBSERVATIONS', 'PLANE_ALREADY_PASSED', 'NO_FORWARD_CROSSING'].includes(forecast.status)
    && tick(forecast.cutoffTick) && forecast.model === 'POSITION_SAMPLES_CONSTANT_ACCELERATION_EXTRAPOLATION'
    && forecast.humanCalibration === 'NOT_MEASURED' && forecast.opponentPrivateStateUsed === false && forecast.futureSourceUsed === false
    && Array.isArray(forecast.usedObservationIds) && forecast.usedObservationIds.length <= 3
    && forecast.usedObservationIds.every(text) && new Set(forecast.usedObservationIds).size === forecast.usedObservationIds.length,
  'invalid raw observed forecast');
  assert(forecast.usedObservationIds.length === 0
    ? forecast.observedThroughTick === null && forecast.availableAtTick === null
    : forecast.observedThroughTick !== null && forecast.availableAtTick !== null && tick(forecast.observedThroughTick)
      && tick(forecast.availableAtTick) && forecast.observedThroughTick <= forecast.availableAtTick && forecast.availableAtTick <= forecast.cutoffTick,
  'invalid raw forecast chronology');
  if (forecast.status === 'PREDICTED') {
    const prediction = forecast.prediction;
    assert(forecast.usedObservationIds.length >= 2 && prediction !== null
      && fields(prediction, ['position', 'arrivalAfterReleaseSeconds', 'estimatedVelocity', 'estimatedAcceleration'])
      && vector(prediction.position) && vector(prediction.estimatedVelocity) && vector(prediction.estimatedAcceleration)
      && Number.isFinite(prediction.arrivalAfterReleaseSeconds) && prediction.arrivalAfterReleaseSeconds > 0,
    'invalid raw forecast prediction');
  } else assert(forecast.prediction === null, 'an unavailable forecast cannot contain a prediction');
  return forecast;
}
export function createBatterObservedEvidenceV151(raw:EvidenceSourceV151):BatterObservedEvidenceV151|null {
  const source = cloneInert(raw);
  assert(fields(source, ['evidenceId', 'observerPlayerId', 'pitcherId', 'pitchOrdinal', 'forecast', 'regionId'])
    && [source.evidenceId, source.observerPlayerId, source.pitcherId].every(text)
    && Number.isSafeInteger(source.pitchOrdinal) && source.pitchOrdinal > 0 && (source.regionId === null || text(source.regionId)),
  'invalid observation evidence scope');
  const forecast = readForecast(source.forecast);
  if (forecast.status !== 'PREDICTED') return null;
  return frozen(readEvidence({ version:'batter_observed_evidence_v151', evidenceId:source.evidenceId,
    observerPlayerId:source.observerPlayerId, pitcherId:source.pitcherId, pitchOrdinal:source.pitchOrdinal,
    observedTick:forecast.observedThroughTick!, availableTick:forecast.cutoffTick, position:forecast.prediction!.position,
    arrivalAfterReleaseSeconds:forecast.prediction!.arrivalAfterReleaseSeconds, regionId:source.regionId,
    classification:'UNCLASSIFIED_OBSERVED_FLIGHT', sourceObservationIds:forecast.usedObservationIds }));
}

function readMemory(memory:BatterObservedMemoryV151):BatterObservedMemoryV151 {
  assert(fields(memory, ['version', 'observerPlayerId', 'pitcherId', 'totalObservations', 'entries'])
    && memory.version === 'batter_observed_memory_v151' && [memory.observerPlayerId, memory.pitcherId].every(text)
    && Number.isSafeInteger(memory.totalObservations) && memory.totalObservations >= 0 && Array.isArray(memory.entries)
    && memory.entries.length <= 64 && memory.totalObservations >= memory.entries.length
    && (memory.totalObservations === 0) === (memory.entries.length === 0), 'invalid observed memory');
  const seen = new Set<string>();let previous:BatterObservedEvidenceV151|undefined;
  for (const entry of memory.entries) {
    readEvidence(entry);
    assert(entry.observerPlayerId === memory.observerPlayerId && entry.pitcherId === memory.pitcherId && !seen.has(entry.evidenceId)
      && (!previous || entry.pitchOrdinal > previous.pitchOrdinal && entry.observedTick > previous.observedTick
        && entry.availableTick > previous.availableTick), 'memory participants, identity or chronology differs');
    seen.add(entry.evidenceId);previous = entry;
  }
  assert(previous === undefined || memory.totalObservations <= previous.pitchOrdinal, 'memory count exceeds observed pitch ordinal');
  return memory;
}
export function validateBatterObservedMemoryV151(raw:unknown):BatterObservedMemoryV151 {
  return frozen(readMemory(cloneInert(raw) as BatterObservedMemoryV151));
}
export function createEmptyBatterObservedMemoryV151(raw:Readonly<{ observerPlayerId:string;pitcherId:string }>):BatterObservedMemoryV151 {
  const pair = cloneInert(raw);
  assert(fields(pair, ['observerPlayerId', 'pitcherId']) && [pair.observerPlayerId, pair.pitcherId].every(text), 'invalid observer pair');
  return frozen({ version:'batter_observed_memory_v151', ...pair, totalObservations:0, entries:[] });
}
export function appendBatterObservedEvidenceV151(rawMemory:BatterObservedMemoryV151, rawEvidence:BatterObservedEvidenceV151,
  rawPolicy:BatterObservedMemoryPolicyV151, acceptedAtTick:number):BatterObservedMemoryV151 {
  const memory = validateBatterObservedMemoryV151(rawMemory), evidence = validateBatterObservedEvidenceV151(rawEvidence),
    policy = validateBatterObservedMemoryPolicyV151(rawPolicy), previous = memory.entries.at(-1);
  assert(tick(acceptedAtTick) && evidence.availableTick <= acceptedAtTick, 'evidence has not arrived at acceptance');
  assert(evidence.observerPlayerId === memory.observerPlayerId && evidence.pitcherId === memory.pitcherId
    && !memory.entries.some(entry => entry.evidenceId === evidence.evidenceId)
    && (!previous || evidence.pitchOrdinal > previous.pitchOrdinal && evidence.observedTick > previous.observedTick
      && evidence.availableTick > previous.availableTick), 'evidence is foreign, repeated or out of order');
  const totalObservations = memory.totalObservations + 1;
  assert(Number.isSafeInteger(totalObservations), 'observation count overflow');
  return frozen({ ...memory, totalObservations, entries:[...memory.entries, evidence].slice(-policy.maximumEntriesPerPair) });
}
/** Equal weights describe retained experiences, not equal probabilities for pitch families or batting directions. */
export function recallBatterObservedMemoryV151(rawMemory:BatterObservedMemoryV151,
  rawInput:Readonly<{ atTick:number;draw:number;priorWeight:number }>):BatterObservedRecallV151|null {
  const memory = validateBatterObservedMemoryV151(rawMemory), input = cloneInert(rawInput);
  assert(fields(input, ['atTick', 'draw', 'priorWeight']) && tick(input.atTick) && unit(input.draw) && input.draw < 1 && unit(input.priorWeight),
    'invalid explicit recall selection');
  const eligible = memory.entries.filter(entry => entry.availableTick <= input.atTick);
  if (eligible.length === 0) return null;
  const entry = eligible[Math.floor(input.draw * eligible.length)];
  return frozen({ kind:'UNCLASSIFIED_EMPIRICAL_FORECAST', evidenceId:entry.evidenceId, position:entry.position,
    arrivalAfterReleaseSeconds:entry.arrivalAfterReleaseSeconds, observedThroughTick:entry.observedTick,
    eligibleObservationCount:eligible.length, empiricalProbability:1 / eligible.length, priorWeight:input.priorWeight,
    confidence:null, pitchFamilyRecognized:false });
}
