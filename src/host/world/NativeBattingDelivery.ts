import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { calculateBattingObservation, type BattingObservationCalculation } from '../../core/world/psychology/batting/BattingObservationCalculation';
import { predictSpatialObservationMemory, type ObservationMemoryDecayParameters, type RememberedPrediction, type SpatialMotionEstimate } from '../../core/sim/perception/ObservationMemory';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields } from './SamePlateAppearanceWorkPrefix';
export type BattingObservationDelivery = Readonly<{ kind: 'batting_observation_delivered'; availableTick: number; evaluatedAtTick: number;
  nominalMemoryParameters: ObservationMemoryDecayParameters; effectiveMemoryParameters: ObservationMemoryDecayParameters;
  deliveredMemory: RememberedPrediction<SpatialMotionEstimate> }>;
/** Original capture is immutable. The current accepted retention parameters
 * affect only delivered memory, never the already captured position or noise. */
export const deriveBattingObservationDelivery = (rawCapture: BattingObservationCalculation, rawNominal: ObservationMemoryDecayParameters,
  rawEffective: ObservationMemoryDecayParameters, evaluatedAtTick: number): BattingObservationDelivery | Readonly<{ kind: 'pending'; reason: string }> => {
  const capture = cloneInert(rawCapture), nominalMemoryParameters = cloneInert(rawNominal), effectiveMemoryParameters = cloneInert(rawEffective);
  if (!Number.isSafeInteger(evaluatedAtTick) || evaluatedAtTick < capture.input.observedTick
    || !fields(nominalMemoryParameters, ['ticksPerSecond', 'confidenceLossPerSecond', 'confidenceFloor'])
    || !fields(effectiveMemoryParameters, ['ticksPerSecond', 'confidenceLossPerSecond', 'confidenceFloor'])
    || nominalMemoryParameters.ticksPerSecond !== capture.input.ticksPerSecond || effectiveMemoryParameters.ticksPerSecond !== capture.input.ticksPerSecond) throw new Error('invalid owned batting delivery clock or parameters');
  const original = calculateBattingObservation({ nominalValues: capture.nominalValues, effectiveValues: capture.effectiveValues, input: capture.input });
  if (!original.ok || json(original.value) !== json(capture)) throw new Error('owned batting delivery original capture differs');
  if (!capture.sample || capture.availableTick === null) return freeze({ kind: 'pending', reason: 'batting_capture_unavailable' });
  if (capture.availableTick > evaluatedAtTick) return freeze({ kind: 'pending', reason: 'batting_delivery_latency_not_reached' });
  predictSpatialObservationMemory(capture.sample, evaluatedAtTick, nominalMemoryParameters);
  return freeze({ kind: 'batting_observation_delivered', availableTick: capture.availableTick, evaluatedAtTick, nominalMemoryParameters, effectiveMemoryParameters,
    deliveredMemory: predictSpatialObservationMemory(capture.sample, evaluatedAtTick, effectiveMemoryParameters) });
};
