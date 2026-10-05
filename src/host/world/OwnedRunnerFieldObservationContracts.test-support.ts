import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AcceptedActualFieldObservation, ActualFieldObservationReceipt } from './ActualFieldObservation';
import type { AcceptedPlayerObservationModel } from './SqlitePlayerObservationModelStore';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { appendRunnerPieceRow, deriveRunnerPieces, runnerFieldPiecesFixture } from './OwnedRunnerFieldPiecesContracts.test-support';
import { projectedActorState } from './PrePitchRunnerFieldPiecesContracts.test-support';

/** Test-only Source/result interface. No perception, knowledge or decision implementation is supplied. */
export type OwnedRunnerObservationSource = Readonly<{
  kind: 'owned_runner_field_observation_v1'; sourceId: string; sourceVersion: string; physicalPitchSourceId: string;
  playerId: string; fieldSourceId: string; prePitchRunnerSourceId: string; observationModelSourceId: string;
  view: AcceptedActualFieldObservation['view'];
}>;
export type OwnedRunnerObservation = Readonly<{
  version: 'owned_runner_field_observation_v1'; source: OwnedRunnerObservationSource; playerId: string; personId: string;
  prePitchRunnerSourceId: string; motionRevision: number; receipt: ActualFieldObservationReceipt;
  dependencyHashes: Readonly<{ field: string; physicalPrefix: string; physicalPitch: string; model: string }>;
  originalPublicContext: Readonly<{ kind: 'original_official_occupancy_v1'; startingBase: 1 | 2 | 3; normalNextBase: 2 | 3 | 4;
    actorSourceId: string; officialRevision: number; matchHash: string; availableAtTick: number }>;
  knowledge: Readonly<{ status: 'pending'; knownContext: null;
    force: 'unavailable'; tagUp: 'unavailable'; cueGeneration: 'unavailable'; consumedSignals: readonly never[]; perceivedCues: readonly never[] }>;
}>;
type FutureModule = { ownedRunnerFieldObservationEvidenceFromSqlite(db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>): {
  derive(source: OwnedRunnerObservationSource): OwnedRunnerObservation;
} };
export const requireOwnedRunnerObservation = (module: unknown, db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const factory = (module as Partial<FutureModule>)?.ownedRunnerFieldObservationEvidenceFromSqlite;
  if (typeof factory !== 'function') throw new Error('owned runner field observation/context capability is not implemented');
  return factory(db).derive;
};

/** Uses real existing field and model owners. Only the suites' documented original
 * flight/response/base readers are substituted; this is not a legal Native chain. */
export const runnerObservationFixture = (state: { flight: unknown; response: unknown; bases: unknown }, options: Readonly<{
  startingBase?: 1 | 2 | 3; collision?: true; zeroBag?: true; reverseView?: true;
  modelPlayerId?: string;
  configureModel?: (source: AcceptedPlayerObservationModel) => AcceptedPlayerObservationModel;
}> = {}) => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-observation-')), path = join(directory, 'source.sqlite');
  const handles: { close(): void }[] = [];
  let fixture: ReturnType<typeof runnerFieldPiecesFixture> | undefined;
  const close = () => { try { while (handles.length) handles.pop()!.close(); } finally { try { fixture?.db.close(); }
    finally { rmSync(directory, { recursive: true, force: true }); } } };
  try {
    const x = fixture = runnerFieldPiecesFixture(state, { path, ...(options.collision ? { collision: 'after' as const } : {}),
      ...(options.zeroBag ? { zeroBag: true } : {}), originalContext: { startingBase: options.startingBase ?? 1, officialRevision: 1, matchSeed: 19 } });
    const field = options.collision || options.zeroBag ? deriveRunnerPieces(x.own, x.source) : appendRunnerPieceRow(x).second;
    if (options.collision || options.zeroBag) x.archive(field);
    const installed = installSyntheticObservation({ baseField: field, f: { path,
      track<T extends { close(): void }>(handle: T): T { handles.push(handle); return handle; } } }, options.modelPlayerId ?? 'runner', null, undefined, options.configureModel);
    const at = field.field.motion.world.moment, body = field.field.motion.actors.find(actor => actor.playerId === 'runner' && actor.primitive.role === 'body')!;
    const actual = projectedActorState(body, at.originTick, at.elapsedSeconds), offset = installed.observationSource.view.bodyRelativeEyeOffset;
    const direction = (axis: 'x' | 'y' | 'z') => (at.ball.position[axis] - actual.position[axis] - offset[axis]) * (options.reverseView ? -1 : 1);
    const source: OwnedRunnerObservationSource = { kind: 'owned_runner_field_observation_v1', sourceId: 'runner-observation', sourceVersion: 'synthetic-v1',
      physicalPitchSourceId: x.flight.source.physicalPitchSourceId, playerId: 'runner', fieldSourceId: field.source.sourceId,
      prePitchRunnerSourceId: x.runner.source.sourceId, observationModelSourceId: installed.observationModel.source.sourceId,
      view: { ...installed.observationSource.view, forward: { x: direction('x'), y: direction('y'), z: direction('z') } } };
    return { ...x, ...installed, field, source, close };
  } catch (error) { close(); throw error; }
};
