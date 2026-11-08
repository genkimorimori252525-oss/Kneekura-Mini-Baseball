import { isDeepStrictEqual } from 'node:util';
import type { OfficialStateApplicationReceipt } from '../../core/adjudication/NextPlayActivation';
import type { OfficialGameResult } from '../../core/world/competition/OfficialGameCompletion';
import type { PersistedMatch, SqliteOfficialStateStore } from '../../host/SqliteOfficialStateStore';
import type { PersistedOfficialScoring } from '../../host/SqliteOfficialScoringStore';
import type { DurablePhysicalPitch, SqlitePhysicalPitchProgressStore } from '../../host/world/SqlitePhysicalPitchProgressStore';
import type { SqlitePhysicalPlayClosureStore } from '../../host/world/SqlitePhysicalPlayClosureStore';

type NonLiveTerminal = 'walk' | 'strikeout';

export type PhysicalGamePitchRequest = Readonly<{
  gameId: string;
  plateAppearanceIndex: number;
  pitchIndex: number;
  before: PersistedMatch;
  priorActivationApplicationId: string | null;
  startedAtTick: number;
  readyAtTick: number;
}>;

export type PhysicalGameClosureRequest = Readonly<{
  gameId: string;
  plateAppearanceIndex: number;
  before: PersistedMatch;
  terminal: NonLiveTerminal;
  lastPhysicalPitch: DurablePhysicalPitch;
  pitchSourceIds: readonly string[];
}>;

/**
 * Native-host smoke driver. The supplied publishers register actual accepted
 * Sources with their own Native owners and return the Source IDs. This driver
 * never manufactures pitch outcomes, rule rulings, or saved MatchState rows.
 * It deliberately stops if the real physical play becomes live or unresolved.
 */
export type PhysicalGameSmokeInput = Readonly<{
  gameId: string;
  initialStartedAtTick: number;
  matches: Pick<SqliteOfficialStateStore, 'getMatch'>;
  pitches: Pick<SqlitePhysicalPitchProgressStore, 'accept'>;
  closures: Pick<SqlitePhysicalPlayClosureStore, 'submit'>;
  publishPitchSource: (request: PhysicalGamePitchRequest) => string;
  publishClosureSource: (request: PhysicalGameClosureRequest) => string;
  maxPlateAppearances?: number;
  maxPitchesPerPlateAppearance?: number;
}>;

export type PhysicalGameSmokePlay = Readonly<{
  playId: number;
  inning: number;
  half: PersistedMatch['matchState']['half'];
  terminal: NonLiveTerminal;
  pitchSourceIds: readonly string[];
  closureSourceId: string;
  receipt: OfficialStateApplicationReceipt;
  scoring: PersistedOfficialScoring;
  workloadSourceId: string;
}>;

export type PhysicalGameSmokeResult = Readonly<{
  gameId: string;
  physicalPitchCount: number;
  plateAppearanceCount: number;
  walks: number;
  strikeouts: number;
  plays: readonly PhysicalGameSmokePlay[];
  finalResult: OfficialGameResult;
}>;

const acceptedId = (value: string): boolean => typeof value === 'string'
  && value.length > 0 && value.trim() === value;

const boundedCount = (value: number, maximum: number): boolean => Number.isSafeInteger(value)
  && value > 0 && value <= maximum;

export function runPhysicalGameSmoke(input: PhysicalGameSmokeInput): PhysicalGameSmokeResult {
  const maxAppearances = input.maxPlateAppearances ?? 80;
  const maxPitches = input.maxPitchesPerPlateAppearance ?? 8;
  if (!acceptedId(input.gameId) || !Number.isSafeInteger(input.initialStartedAtTick)
    || input.initialStartedAtTick < 0 || !boundedCount(maxAppearances, 80)
    || !boundedCount(maxPitches, 12)) {
    throw new Error('invalid bounded physical game smoke scope');
  }
  if (typeof input.matches?.getMatch !== 'function' || typeof input.pitches?.accept !== 'function'
    || typeof input.closures?.submit !== 'function' || typeof input.publishPitchSource !== 'function'
    || typeof input.publishClosureSource !== 'function') {
    throw new Error('native physical game owners and accepted Source publishers are required');
  }

  const original = input.matches.getMatch(input.gameId);
  const first = original?.matchState;
  if (!original || original.durableRevision !== 0 || original.activation !== null
    || original.finalResult !== null || original.pendingPostPlay
    || first?.inning !== 1 || first.half !== 'top' || first.outs !== 0
    || first.balls !== 0 || first.strikes !== 0 || first.score.away !== 0 || first.score.home !== 0
    || first.bases.first !== null || first.bases.second !== null || first.bases.third !== null) {
    throw new Error('physical nine-inning smoke requires a fresh official Match');
  }

  const plays: PhysicalGameSmokePlay[] = [];
  const usedSourceIds = new Set<string>();
  let physicalPitchCount = 0;
  let walks = 0;
  let strikeouts = 0;
  let startedAtTick = input.initialStartedAtTick;
  let priorActivationApplicationId: string | null = null;

  for (let plateAppearanceIndex = 0; plateAppearanceIndex < maxAppearances; plateAppearanceIndex++) {
    const before = input.matches.getMatch(input.gameId);
    if (!before || before.finalResult || before.pendingPostPlay
      || before.durableRevision !== plateAppearanceIndex
      || before.matchState.inning > 9) {
      throw new Error('native official Match advanced unexpectedly or passed nine innings');
    }

    const pitchSourceIds: string[] = [];
    let readyAtTick = startedAtTick;
    let terminal: NonLiveTerminal | null = null;
    let lastPhysicalPitch: DurablePhysicalPitch | null = null;
    for (let pitchIndex = 0; pitchIndex < maxPitches; pitchIndex++) {
      const sourceId = input.publishPitchSource({ gameId: input.gameId, plateAppearanceIndex,
        pitchIndex, before, priorActivationApplicationId, startedAtTick, readyAtTick });
      if (!acceptedId(sourceId) || usedSourceIds.has(sourceId)) {
        throw new Error('physical pitch publisher reused an accepted Source ID');
      }
      usedSourceIds.add(sourceId);
      const accepted = input.pitches.accept(sourceId, pitchIndex);
      if (accepted.source.sourceId !== sourceId || accepted.frame.gameId !== input.gameId
        || accepted.frame.match.playId !== before.matchState.playId
        || accepted.frame.officialRevision !== before.durableRevision
        || accepted.frame.activationApplicationId !== priorActivationApplicationId
        || accepted.progressRevision !== pitchIndex + 1
        || accepted.result.pitch.resolution.kind !== 'recorded') {
        throw new Error('native physical pitch did not return the authenticated Match progress');
      }
      const timeline = accepted.result.pitch.resolution.timeline;
      pitchSourceIds.push(sourceId);
      physicalPitchCount++;
      lastPhysicalPitch = accepted;
      readyAtTick = timeline.lastEventTick;
      if (timeline.status.kind === 'walk' || timeline.status.kind === 'strikeout') {
        terminal = timeline.status.kind;
        break;
      }
      if (timeline.status.kind !== 'active') {
        throw new Error(`physical play ${before.matchState.playId} requires its real live-ball/umpire path: ${timeline.status.kind}`);
      }
    }
    if (terminal === null || lastPhysicalPitch === null) {
      throw new Error(`physical play ${before.matchState.playId} did not reach a real K/BB terminal within the pitch bound`);
    }

    const closureSourceId = input.publishClosureSource({ gameId: input.gameId,
      plateAppearanceIndex, before, terminal, lastPhysicalPitch,
      pitchSourceIds: Object.freeze([...pitchSourceIds]) });
    if (!acceptedId(closureSourceId) || usedSourceIds.has(closureSourceId)) {
      throw new Error('physical closure publisher reused an accepted Source ID');
    }
    usedSourceIds.add(closureSourceId);
    const closed = input.closures.submit(closureSourceId);
    const receipt = closed.official.receipt;
    const after = input.matches.getMatch(input.gameId);
    if (closed.sourceId !== closureSourceId || closed.gameId !== input.gameId
      || closed.playId !== before.matchState.playId || receipt.previousPlayId !== before.matchState.playId
      || receipt.durableRevision !== before.durableRevision + 1
      || !after || after.durableRevision !== receipt.durableRevision
      || !isDeepStrictEqual(after.matchState, receipt.appliedMatchState)
      || closed.scoring.matchId !== input.gameId
      || closed.scoring.officialApplicationId !== receipt.applicationId
      || closed.scoring.closureId !== receipt.closureId
      || closed.scoring.record.playId !== before.matchState.playId
      || closed.scoring.record.classification !== (terminal === 'walk' ? 'base_on_balls' : 'strikeout')
      || closed.workload.activity.kind !== 'MATCH'
      || closed.workload.before.revision !== lastPhysicalPitch.frame.workload.revision) {
      throw new Error('Native completed closure, official state, scoring or workload receipt differs');
    }

    plays.push(Object.freeze({ playId: before.matchState.playId,
      inning: before.matchState.inning, half: before.matchState.half, terminal,
      pitchSourceIds: Object.freeze([...pitchSourceIds]), closureSourceId,
      receipt, scoring: closed.scoring, workloadSourceId: closed.workload.activity.sourceEventId }));
    if (terminal === 'walk') walks++; else strikeouts++;

    if ('result' in closed.official) {
      const result = closed.official.result;
      if (before.matchState.inning !== 9 || result.lineScore.innings.length !== 9
        || !isDeepStrictEqual(after.finalResult, result) || after.activation !== null) {
        throw new Error('Native official nine-inning final is not durably identical');
      }
      return Object.freeze({ gameId: input.gameId, physicalPitchCount,
        plateAppearanceCount: plays.length, walks, strikeouts,
        plays: Object.freeze(plays), finalResult: result });
    }
    if (after.finalResult !== null || !after.activation
      || !isDeepStrictEqual(after.activation, closed.official.activation)
      || !isDeepStrictEqual(after.nextWorld, closed.official.nextWorld)) {
      throw new Error('Native official next-play activation differs from durable SQLite');
    }
    startedAtTick = closed.official.activation.nextTimeline.startedAtTick;
    priorActivationApplicationId = receipt.applicationId;
  }
  throw new Error('physical game did not reach a genuine nine-inning official final within the plate appearance bound');
}
