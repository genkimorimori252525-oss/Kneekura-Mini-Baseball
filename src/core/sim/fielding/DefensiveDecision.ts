import type {
  DefensivePosition,
} from '../../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../../model/geometry';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import {
  resolveDefensiveDecisionTiming,
  type DefensiveDecisionTimingParameters,
} from './DefensiveDecisionTiming';

export type DefensiveKnownContext = Readonly<{
  outs: number;
  occupiedBases: readonly (1 | 2 | 3)[];
}>;

export type DefenderDecisionSelf = Readonly<{
  playerId: string;
  registeredPosition: DefensivePosition;
  position: Vec2;
}>;

export type PrePlayBaseCoverPriority = Readonly<{
  base: 1 | 2 | 3 | 4;
  priority: number;
}>;

export type PrePlayDefensivePlan = Readonly<{
  ballPursuitPriority: number;
  baseCoverPriorities: readonly PrePlayBaseCoverPriority[];
  relayPriority: number;
  backupPriority: number;
  deepCoveragePriority: number;
  holdPriority: number;
}>;

type PerceivedCueBase = Readonly<{
  observedAt: number;
  confidence: number;
}>;

export type DefensivePerceivedCue =
  | (PerceivedCueBase & Readonly<{
      kind: 'teammate_ball_commitment';
      playerId: string;
    }>)
  | (PerceivedCueBase & Readonly<{
      kind: 'base_needs_cover';
      base: 1 | 2 | 3 | 4;
    }>)
  | (PerceivedCueBase & Readonly<{
      kind: 'relay_needed';
      target: Vec2;
    }>)
  | (PerceivedCueBase & Readonly<{
      kind: 'backup_needed';
      target: Vec2;
    }>)
  | (PerceivedCueBase & Readonly<{
      kind: 'deep_coverage_needed';
      target: Vec2;
    }>);

export type DefensiveCommunicationContent = Readonly<{
  kind: 'cover_base';
  base: 1 | 2 | 3 | 4;
}>;

export type DefensiveIntent =
  | Readonly<{ kind: 'ball_handler' }>
  | Readonly<{ kind: 'base_cover'; base: 1 | 2 | 3 | 4 }>
  | Readonly<{ kind: 'relay'; target: Vec2 }>
  | Readonly<{ kind: 'backup'; target: Vec2 }>
  | Readonly<{ kind: 'deep_coverage'; target: Vec2 }>
  | Readonly<{ kind: 'hold' }>;

export type DefensiveIntentCandidate = Readonly<{
  intent: DefensiveIntent;
  localPriority: number;
  evidenceAvailableAt: number;
  evidenceKinds: readonly string[];
}>;

export type DefensiveDecisionInput = Readonly<{
  perceivedWorld: PlayerPerceivedWorldState<DefensiveKnownContext>;
  self: DefenderDecisionSelf;
  prePlayPlan: PrePlayDefensivePlan;
  perceivedCues: readonly DefensivePerceivedCue[];
  minimumCueConfidence: number;
  communicationTrust: number;
}>;

/** Additive Native seam: current individual candidate selection consumes identity only, never self coordinates or known context. */
export type DefensiveIdentityDecisionInput = Omit<DefensiveDecisionInput, 'self' | 'perceivedWorld'> & Readonly<{
  self: DefenderDecisionSelf | Pick<DefenderDecisionSelf, 'playerId'>;
  perceivedWorld: PlayerPerceivedWorldState<unknown>;
}>;

const validateUnit = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be finite and within [0, 1]`);
  }
};

const validateTick = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const validatePlan = (plan: PrePlayDefensivePlan): void => {
  validateUnit('ballPursuitPriority', plan.ballPursuitPriority);
  validateUnit('relayPriority', plan.relayPriority);
  validateUnit('backupPriority', plan.backupPriority);
  validateUnit('deepCoveragePriority', plan.deepCoveragePriority);
  validateUnit('holdPriority', plan.holdPriority);

  const seenBases = new Set<number>();
  for (const entry of plan.baseCoverPriorities) {
    validateUnit(`baseCoverPriorities[${entry.base}]`, entry.priority);
    if (seenBases.has(entry.base)) {
      throw new Error('base cover priorities must not repeat a base');
    }
    seenBases.add(entry.base);
  }
};

const validateCue = (
  cue: DefensivePerceivedCue,
  observationTime: number,
): void => {
  validateTick('cue.observedAt', cue.observedAt);
  validateUnit('cue.confidence', cue.confidence);
  if (cue.observedAt > observationTime) {
    throw new Error('perceived cue cannot occur after observationTime');
  }
};

const bestVisibleCommitment = (
  input: DefensiveIdentityDecisionInput,
): Extract<DefensivePerceivedCue, { kind: 'teammate_ball_commitment' }> | null => {
  const visiblePlayers = new Map(
    input.perceivedWorld.players.map((player) => [
      player.playerId,
      player.memory.confidence,
    ]),
  );

  let best: Extract<
    DefensivePerceivedCue,
    { kind: 'teammate_ball_commitment' }
  > | null = null;
  let bestUsableConfidence = -1;

  for (const cue of input.perceivedCues) {
    if (
      cue.kind !== 'teammate_ball_commitment'
      || cue.confidence < input.minimumCueConfidence
    ) {
      continue;
    }

    const playerConfidence = visiblePlayers.get(cue.playerId);
    if (
      playerConfidence === undefined
      || playerConfidence < input.minimumCueConfidence
    ) {
      continue;
    }

    const usableConfidence = Math.min(cue.confidence, playerConfidence);
    if (
      usableConfidence > bestUsableConfidence
      || (
        usableConfidence === bestUsableConfidence
        && best !== null
        && (
          cue.observedAt < best.observedAt
          || (
            cue.observedAt === best.observedAt
            && cue.playerId < best.playerId
          )
        )
      )
    ) {
      best = cue;
      bestUsableConfidence = usableConfidence;
    }
  }

  return best;
};

const addCueCandidate = (
  candidates: DefensiveIntentCandidate[],
  cue: DefensivePerceivedCue,
  priority: number,
  intent: DefensiveIntent,
): void => {
  if (priority <= 0) return;

  candidates.push({
    intent,
    localPriority: priority * cue.confidence,
    evidenceAvailableAt: cue.observedAt,
    evidenceKinds: [cue.kind, 'pre_play_plan'],
  });
};

export const generateDefensiveIntentCandidates = (
  input: DefensiveIdentityDecisionInput,
): readonly DefensiveIntentCandidate[] => {
  if (input.self.playerId !== input.perceivedWorld.observerId) {
    throw new Error('defender decision self must match perceived-world observer');
  }
  validateTick('observationTime', input.perceivedWorld.observationTime);
  validateUnit('minimumCueConfidence', input.minimumCueConfidence);
  validateUnit('communicationTrust', input.communicationTrust);
  validatePlan(input.prePlayPlan);
  for (const cue of input.perceivedCues) {
    validateCue(cue, input.perceivedWorld.observationTime);
  }

  const candidates: DefensiveIntentCandidate[] = [];

  const ball = input.perceivedWorld.ball;
  if (
    ball !== null
    && ball.confidence >= input.minimumCueConfidence
    && input.prePlayPlan.ballPursuitPriority > 0
  ) {
    candidates.push({
      intent: { kind: 'ball_handler' },
      localPriority: input.prePlayPlan.ballPursuitPriority * ball.confidence,
      evidenceAvailableAt: ball.sourceObservedAt,
      evidenceKinds: ['observed_ball', 'pre_play_plan'],
    });
  }

  const commitment = bestVisibleCommitment(input);
  if (commitment !== null) {
    const visiblePlayer = input.perceivedWorld.players.find(
      (player) => player.playerId === commitment.playerId,
    );
    const commitmentConfidence = Math.min(
      commitment.confidence,
      visiblePlayer?.memory.confidence ?? 0,
    );

    for (const cover of input.prePlayPlan.baseCoverPriorities) {
      const needsCover = input.perceivedCues
        .filter((cue): cue is Extract<
          DefensivePerceivedCue,
          { kind: 'base_needs_cover' }
        > => (
          cue.kind === 'base_needs_cover'
          && cue.base === cover.base
          && cue.confidence >= input.minimumCueConfidence
        ))
        .sort((a, b) => (
          b.confidence - a.confidence
          || a.observedAt - b.observedAt
        ))[0];

      if (needsCover === undefined || cover.priority <= 0) {
        continue;
      }

      candidates.push({
        intent: { kind: 'base_cover', base: cover.base },
        localPriority: (
          cover.priority
          * Math.min(commitmentConfidence, needsCover.confidence)
        ),
        evidenceAvailableAt: Math.max(
          commitment.observedAt,
          needsCover.observedAt,
        ),
        evidenceKinds: [
          'teammate_ball_commitment',
          'base_needs_cover',
          'pre_play_plan',
        ],
      });
    }
  }

  for (const cue of input.perceivedCues) {
    if (cue.confidence < input.minimumCueConfidence) continue;

    switch (cue.kind) {
      case 'relay_needed':
        addCueCandidate(
          candidates,
          cue,
          input.prePlayPlan.relayPriority,
          { kind: 'relay', target: cue.target },
        );
        break;
      case 'backup_needed':
        addCueCandidate(
          candidates,
          cue,
          input.prePlayPlan.backupPriority,
          { kind: 'backup', target: cue.target },
        );
        break;
      case 'deep_coverage_needed':
        addCueCandidate(
          candidates,
          cue,
          input.prePlayPlan.deepCoveragePriority,
          { kind: 'deep_coverage', target: cue.target },
        );
        break;
      default:
        break;
    }
  }

  const isCommunicationForSelf = (
    targetScope: { kind: string; playerId?: string },
  ): boolean => (
    targetScope.kind !== 'player'
    || targetScope.playerId === input.self.playerId
  );

  const parseDefensiveCommunication = (
    value: unknown,
  ): DefensiveCommunicationContent | null => {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as { kind?: unknown; base?: unknown };
    if (record.kind !== 'cover_base') return null;
    if (
      record.base !== 1
      && record.base !== 2
      && record.base !== 3
      && record.base !== 4
    ) {
      return null;
    }
    return {
      kind: 'cover_base',
      base: record.base,
    };
  };

  for (const received of input.perceivedWorld.communications) {
    validateTick('communication.receivedAt', received.receivedAt);
    validateUnit('communication.confidence', received.confidence);

    if (
      received.receivedAt > input.perceivedWorld.observationTime
      || received.confidence < input.minimumCueConfidence
      || input.communicationTrust <= 0
      || !isCommunicationForSelf(received.event.targetScope)
    ) {
      continue;
    }

    const communication = parseDefensiveCommunication(received.event.content);
    if (communication === null) continue;

    const coverPriority = input.prePlayPlan.baseCoverPriorities.find(
      (entry) => entry.base === communication.base,
    )?.priority ?? 0;

    if (coverPriority <= 0) continue;

    candidates.push({
      intent: { kind: 'base_cover', base: communication.base },
      localPriority: (
        coverPriority
        * received.confidence
        * input.communicationTrust
      ),
      evidenceAvailableAt: received.receivedAt,
      evidenceKinds: [
        'communication:cover_base',
        'pre_play_plan',
      ],
    });
  }

  candidates.push({
    intent: { kind: 'hold' },
    localPriority: input.prePlayPlan.holdPriority,
    evidenceAvailableAt: input.perceivedWorld.observationTime,
    evidenceKinds: ['pre_play_plan'],
  });

  return candidates;
};


export type DefensiveIntentDecision = Readonly<{
  intent: DefensiveIntent;
  selectedPriority: number;
  evidenceAvailableAt: number;
  decisionTick: number;
}>;

const normalizePriority = (value: number): number => (
  Math.round(value * 1_000_000_000_000) / 1_000_000_000_000
);

const canonicalIntentKey = (intent: DefensiveIntent): string => {
  const normalizeZero = (value: number): number => (
    Object.is(value, -0) ? 0 : value
  );

  switch (intent.kind) {
    case 'ball_handler':
      return 'ball_handler';
    case 'base_cover':
      return `base_cover:${intent.base}`;
    case 'relay':
      return `relay:${normalizeZero(intent.target.x)}:${normalizeZero(intent.target.z)}`;
    case 'backup':
      return `backup:${normalizeZero(intent.target.x)}:${normalizeZero(intent.target.z)}`;
    case 'deep_coverage':
      return `deep_coverage:${normalizeZero(intent.target.x)}:${normalizeZero(intent.target.z)}`;
    case 'hold':
      return 'hold';
  }
};

export const chooseDefensiveIntentCandidate = (
  candidates: readonly DefensiveIntentCandidate[],
): DefensiveIntentCandidate => {
  if (candidates.length === 0) {
    throw new Error('at least one defensive intent candidate is required');
  }

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.localPriority) || candidate.localPriority < 0) {
      throw new Error('candidate localPriority must be finite and non-negative');
    }
    validateTick('candidate.evidenceAvailableAt', candidate.evidenceAvailableAt);
  }

  return [...candidates].sort((a, b) => {
    const priorityOrder = b.localPriority - a.localPriority;
    if (priorityOrder !== 0) return priorityOrder;

    const keyOrder = canonicalIntentKey(a.intent).localeCompare(
      canonicalIntentKey(b.intent),
    );
    if (keyOrder !== 0) return keyOrder;

    const evidenceOrder = a.evidenceAvailableAt - b.evidenceAvailableAt;
    if (evidenceOrder !== 0) return evidenceOrder;

    return a.evidenceKinds.join('|').localeCompare(b.evidenceKinds.join('|'));
  })[0];
};

export const decideDefensiveIntent = (
  input: DefensiveIdentityDecisionInput,
  situationalAwareness: number,
  timingParameters: DefensiveDecisionTimingParameters,
): DefensiveIntentDecision => {
  const selected = chooseDefensiveIntentCandidate(
    generateDefensiveIntentCandidates(input),
  );
  const timing = resolveDefensiveDecisionTiming(
    selected.evidenceAvailableAt,
    situationalAwareness,
    timingParameters,
  );

  return {
    intent: selected.intent,
    selectedPriority: normalizePriority(selected.localPriority),
    evidenceAvailableAt: selected.evidenceAvailableAt,
    decisionTick: timing.decisionTick,
  };
};
