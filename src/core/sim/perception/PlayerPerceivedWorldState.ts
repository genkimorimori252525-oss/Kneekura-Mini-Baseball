import type { AttentionState } from './Observation';
import type {
  PlanarMotionEstimate,
  RememberedPrediction,
  SpatialMotionEstimate,
} from './ObservationMemory';
import {
  isCommunicationAvailable,
  type ReceivedCommunication,
} from './Communication';

export type PerceivedPlayerMemory = Readonly<{
  playerId: string;
  memory: RememberedPrediction<PlanarMotionEstimate>;
}>;

export type PlayerPerceivedWorldInput<TKnownContext = unknown> = Readonly<{
  observerId: string;
  observationTime: number;
  attention: AttentionState;
  ball: RememberedPrediction<SpatialMotionEstimate> | null;
  players: readonly PerceivedPlayerMemory[];
  communications: readonly ReceivedCommunication[];
  knownContext: TKnownContext;
}>;

export type PlayerPerceivedWorldState<TKnownContext = unknown> = Readonly<{
  observerId: string;
  observationTime: number;
  attention: AttentionState;
  ball: RememberedPrediction<SpatialMotionEstimate> | null;
  players: readonly PerceivedPlayerMemory[];
  communications: readonly ReceivedCommunication[];
  knownContext: TKnownContext;
}>;

const validateTick = (tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error('observationTime must be a non-negative safe integer tick');
  }
};

const validatePredictionTime = (
  label: string,
  predictedAt: number,
  observationTime: number,
): void => {
  if (predictedAt !== observationTime) {
    throw new Error(`${label} prediction must be resolved at observationTime`);
  }
};

export const buildPlayerPerceivedWorldState = <TKnownContext>(
  input: PlayerPerceivedWorldInput<TKnownContext>,
): PlayerPerceivedWorldState<TKnownContext> => {
  validateTick(input.observationTime);

  if (input.ball !== null) {
    validatePredictionTime('ball', input.ball.predictedAt, input.observationTime);
  }

  for (const player of input.players) {
    validatePredictionTime(
      `player ${player.playerId}`,
      player.memory.predictedAt,
      input.observationTime,
    );
  }

  return {
    observerId: input.observerId,
    observationTime: input.observationTime,
    attention: input.attention,
    ball: input.ball,
    players: [...input.players],
    communications: input.communications.filter((communication) => (
      isCommunicationAvailable(communication, input.observationTime)
    )),
    knownContext: input.knownContext,
  };
};
