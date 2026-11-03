import { isDeepStrictEqual } from 'node:util';
import { SqliteOfficialStateStore } from '../../host/SqliteOfficialStateStore';
import { openSqliteActualFirstBasePlayEndStore } from '../../host/world/SqliteActualFirstBasePlayEndStore';
import { openSqliteActualLiveAdjudicationStore } from '../../host/world/SqliteActualLiveAdjudicationStore';
import { openSqliteActualLivePlayClosureStore } from '../../host/world/SqliteActualLivePlayClosureStore';
import { openSqliteActualLiveScoringStore } from '../../host/world/SqliteActualLiveScoringStore';
import type { AcceptedActualLiveAdjudication } from '../../host/world/ActualLiveAdjudicationSource';
import type { AcceptedActualLivePlayClosure } from '../../host/world/ActualLivePlayClosureSource';
import type { AcceptedActualLiveScoringSource } from '../../host/world/ActualLiveScoringSource';

type PhysicalEnd = NonNullable<ReturnType<ReturnType<typeof openSqliteActualFirstBasePlayEndStore>['read']>>;
type NativeAdjudication = ReturnType<ReturnType<typeof openSqliteActualLiveAdjudicationStore>['accept']>;
type NativeClosure = NonNullable<ReturnType<ReturnType<typeof openSqliteActualLivePlayClosureStore>['read']>>;

export type PhysicalLivePlaySmokeInput = Readonly<{
  /** A real Node.js SQLite archive whose original batted-ball owners have already committed. */
  databasePath: string;
  gameId: string;
  physicalEndSourceId: string;
  /** An accepted Source bound to this exact physical end; Native derives the actual ruling. */
  adjudicationSource: AcceptedActualLiveAdjudication;
  /** Caller supplies only next-play setup/policy, not an OUT/SAFE or hit. */
  createClosureSource: (evidence: Readonly<{
    physicalEnd: PhysicalEnd;
    adjudication: NativeAdjudication;
  }>) => AcceptedActualLivePlayClosure;
  /** Owner source for the genuine ground-out sidecar, derived after official closure. */
  createScoringSource: (evidence: Readonly<{
    physicalEnd: PhysicalEnd;
    adjudication: NativeAdjudication;
    closure: NativeClosure;
  }>) => AcceptedActualLiveScoringSource;
}>;

export type PhysicalLivePlaySmokeResult = Readonly<{
  authority: 'NODE_NATIVE_PHYSICAL_FAIR_GROUND_OUT';
  gameId: string;
  playId: number;
  physicalPitchSourceId: string;
  physicalEndSourceId: string;
  adjudicationSourceId: string;
  closureSourceId: string;
  scoringSourceId: string;
  officialReceipt: ReturnType<ReturnType<typeof openSqliteActualLivePlayClosureStore>['submit']>['official']['receipt'];
  scoring: ReturnType<ReturnType<typeof openSqliteActualLiveScoringStore>['submit']>;
}>;

const validId = (value: string): boolean =>
  typeof value === 'string' && value.length > 0 && value.trim() === value;

/**
 * One bounded positive Node Native integration entry, starting from the actual,
 * sealed fair-ground first-base physical chain. Every outcome/official effect
 * is rederived by its unchanged SQLite owner. No synthetic hits, putouts,
 * score rows, or new physical observations are admitted by this module.
 *
 * The completed scorer is a separate Native owner: the physical closure's
 * provisional unsupported scoring state is never treated as a scored hit/out.
 */
export const runPhysicalLivePlaySmoke = (
  input: PhysicalLivePlaySmokeInput,
): PhysicalLivePlaySmokeResult => {
  if (!validId(input.databasePath) || !validId(input.gameId) || !validId(input.physicalEndSourceId)
    || input.adjudicationSource?.physicalEndSourceId !== input.physicalEndSourceId
    || typeof input.createClosureSource !== 'function' || typeof input.createScoringSource !== 'function') {
    throw new Error('physical live game smoke requires the exact sealed end and source publishers');
  }
  const stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  try {
    const matches = track(new SqliteOfficialStateStore(input.databasePath));
    const original = matches.getMatch(input.gameId);
    if (!original || original.finalResult || original.pendingPostPlay || original.activation
      || original.durableRevision !== 0 || original.matchState.outs !== 0) {
      throw new Error('one-PA live smoke requires an original unfinished physical Match');
    }

    const ends = track(openSqliteActualFirstBasePlayEndStore(input.databasePath));
    const physicalEnd = ends.read(input.physicalEndSourceId);
    if (!physicalEnd || physicalEnd.kind !== 'ended' || physicalEnd.gameId !== input.gameId
      || physicalEnd.playId !== original.matchState.playId
      || physicalEnd.playEnd.reason !== 'live_action_complete'
      || physicalEnd.finalRuleReference.owner !== 'batted_world_field_executions'
      || physicalEnd.operativeRetirement.kind !== 'retired') {
      throw new Error('original physical fair-ground first-base retirement is not complete');
    }

    const adjudications = track(openSqliteActualLiveAdjudicationStore(input.databasePath, {
      readAcceptedAdjudication: id => id === input.adjudicationSource.sourceId ? input.adjudicationSource : null,
    }));
    const adjudication = adjudications.accept(input.adjudicationSource.sourceId);
    if (adjudication.kind !== 'official_ready') {
      throw new Error('real Native first-base adjudication is still pending: ' + adjudication.pendingReasons.join(', '));
    }
    if (adjudication.gameId !== input.gameId || adjudication.playId !== physicalEnd.playId
      || adjudication.source.physicalEndSourceId !== physicalEnd.source.sourceId) {
      throw new Error('Native first-base adjudication references another actual physical end');
    }

    const closureSource = input.createClosureSource({ physicalEnd, adjudication });
    if (!validId(closureSource?.sourceId)
      || closureSource.adjudicationSourceId !== adjudication.source.sourceId
      || closureSource.worldSetup === null || closureSource.nextStartedAtTick === null
      || closureSource.closureTick < physicalEnd.playEnd.tick) {
      throw new Error('actual live closure requires an original adjudication and a legal next-play setup');
    }
    const closures = track(openSqliteActualLivePlayClosureStore(input.databasePath, {
      readAcceptedClosure: id => id === closureSource.sourceId ? closureSource : null,
    }));
    const queued = closures.enqueue(closureSource.sourceId);
    if (queued.proposal.gameId !== input.gameId || queued.proposal.playId !== physicalEnd.playId
      || queued.proposal.scoring.kind !== 'unsupported') {
      throw new Error('native live closure does not match the original physical unscored play');
    }
    const official = closures.resume(closureSource.sourceId);
    const receipt = official.official.receipt;
    const saved = matches.getMatch(input.gameId);
    if (!saved || receipt.applicationId !== closureSource.applicationId
      || receipt.previousPlayId !== physicalEnd.playId || receipt.durableRevision !== 1
      || !isDeepStrictEqual(saved.matchState, receipt.appliedMatchState)
      || !saved.activation || !saved.nextWorld || saved.finalResult !== null
      || !('activation' in official.official)
      || !isDeepStrictEqual(saved.activation, official.official.activation)
      || !isDeepStrictEqual(saved.nextWorld, official.official.nextWorld)) {
      throw new Error('Native physical live closure does not have exact durable Match/activation receipts');
    }
    const applied = closures.read(closureSource.sourceId);
    if (applied?.status !== 'OFFICIAL_APPLIED' || !applied.result
      || !isDeepStrictEqual(applied.result, official)) {
      throw new Error('Native real live play closure was not durably applied');
    }

    const scoringSource = input.createScoringSource({ physicalEnd, adjudication, closure: applied });
    if (!validId(scoringSource?.sourceId) || scoringSource.gameId !== input.gameId
      || scoringSource.closureReference.sourceId !== closureSource.sourceId
      || scoringSource.evidence.sourceKind !== 'owned_ground_out'
      || scoringSource.evidence.playId !== physicalEnd.playId
      || scoringSource.evidence.closureId !== closureSource.sourceId) {
      throw new Error('scorer Source must refer to the exact owned first-base ground out');
    }
    const scorer = track(openSqliteActualLiveScoringStore(input.databasePath, {
      readAcceptedScoringSource: id => id === scoringSource.sourceId ? scoringSource : null,
    }));
    const scoring = scorer.submit(scoringSource.sourceId);
    if (scoring.record.classification !== 'ground_out' || scoring.record.playId !== physicalEnd.playId
      || scoring.record.hitsCredited !== 0 || scoring.record.errorsCharged !== 0
      || scoring.record.runsScored !== 0 || scoring.officialApplicationId !== receipt.applicationId
      || scoring.closureId !== receipt.closureId) {
      throw new Error('real physical ground-out scoring is not supported or disagrees with its official closure');
    }
    const durableScore = scorer.read(scoringSource.sourceId);
    if (durableScore?.status !== 'SCORED' || !isDeepStrictEqual(durableScore.result, scoring)) {
      throw new Error('Native ground-out scoring receipt is not durable');
    }
    return Object.freeze({ authority: 'NODE_NATIVE_PHYSICAL_FAIR_GROUND_OUT', gameId: input.gameId,
      playId: physicalEnd.playId, physicalPitchSourceId: physicalEnd.physicalPitchSourceId,
      physicalEndSourceId: physicalEnd.source.sourceId, adjudicationSourceId: adjudication.source.sourceId,
      closureSourceId: closureSource.sourceId, scoringSourceId: scoringSource.sourceId,
      officialReceipt: receipt, scoring });
  } finally {
    for (const store of stores.reverse()) store.close();
  }
};
