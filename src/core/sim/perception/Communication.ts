import type { DeterministicRng } from '../../rng/DeterministicRng';

export type CommunicationTargetScope =
  | Readonly<{ kind: 'player'; playerId: string }>
  | Readonly<{ kind: 'team' }>
  | Readonly<{ kind: 'nearby' }>;

export type CommunicationKind = 'coach_signal' | 'callout' | 'warning';

export type CommunicationEvent<TContent = unknown> = Readonly<{
  sourceId: string;
  targetScope: CommunicationTargetScope;
  kind: CommunicationKind;
  issuedAt: number;
  content: TContent;
}>;

export type CommunicationReceptionConditions = Readonly<{
  propagationDelayTicks: number;
  recognitionBaseDelayTicks: number;
  maxAdditionalRecognitionDelayTicks: number;
  audibility: number;
  recognition: number;
  attention: number;
  minimumRecognizableQuality: number;
}>;

export type ReceivedCommunication<TContent = unknown> = Readonly<{
  event: CommunicationEvent<TContent>;
  receivedAt: number;
  confidence: number;
}>;

const validateTick = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const validateUnit = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be finite and within [0, 1]`);
  }
};

const validateConditions = (
  conditions: CommunicationReceptionConditions,
): void => {
  validateTick('propagationDelayTicks', conditions.propagationDelayTicks);
  validateTick('recognitionBaseDelayTicks', conditions.recognitionBaseDelayTicks);
  validateTick(
    'maxAdditionalRecognitionDelayTicks',
    conditions.maxAdditionalRecognitionDelayTicks,
  );
  validateUnit('audibility', conditions.audibility);
  validateUnit('recognition', conditions.recognition);
  validateUnit('attention', conditions.attention);
  validateUnit(
    'minimumRecognizableQuality',
    conditions.minimumRecognizableQuality,
  );
};

export const resolveCommunicationReception = <TContent>(
  event: CommunicationEvent<TContent>,
  conditions: CommunicationReceptionConditions,
  rng: DeterministicRng,
): ReceivedCommunication<TContent> | null => {
  validateTick('event.issuedAt', event.issuedAt);
  validateConditions(conditions);

  const quality = (
    conditions.audibility
    * conditions.recognition
    * conditions.attention
  );

  if (quality < conditions.minimumRecognizableQuality) {
    return null;
  }

  const jitterScale = (1 - quality) * conditions.maxAdditionalRecognitionDelayTicks;
  const additionalDelayTicks = Math.floor(rng.nextFloat() * jitterScale);
  const receivedAt = (
    event.issuedAt
    + conditions.propagationDelayTicks
    + conditions.recognitionBaseDelayTicks
    + additionalDelayTicks
  );

  if (!Number.isSafeInteger(receivedAt)) {
    throw new Error('communication receive tick must be a safe integer');
  }

  return {
    event,
    receivedAt,
    confidence: quality,
  };
};

export const isCommunicationAvailable = (
  received: ReceivedCommunication,
  currentTick: number,
): boolean => {
  validateTick('currentTick', currentTick);
  return currentTick >= received.receivedAt;
};
