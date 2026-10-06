import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import { ownedRunnerFieldNativeFixture } from './OwnedRunnerFieldNativeFixtures.test-support';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Proposed original public baseline only, not live force/tag-up knowledge. */
export type OriginalRunnerPublicKnowledgeSource = Readonly<{
  kind: 'original_runner_public_knowledge_v1'; sourceId: string; sourceVersion: string;
  physicalPitchSourceId: string; playerId: string; physicalActorSourceId: string; prePitchRunnerSourceId: string;
}>;
export type OriginalRunnerPublicKnowledge = Readonly<{
  version: 'original_runner_public_knowledge_v1'; source: OriginalRunnerPublicKnowledgeSource;
  recipient: Readonly<{ careerId: string; gameId: string; playId: number; playerId: string; personId: string }>;
  availableAtTick: number;
  original: Readonly<{ physicalActorSourceId: string; prePitchRunnerSourceId: string; officialRevision: number;
    matchHash: string; actorHash: string; runnerHash: string; physicalPitchHash: string }>;
  known: Readonly<{ inning: number; half: 'top' | 'bottom'; battingSide: 'AWAY' | 'HOME'; outs: number;
    score: Readonly<{ home: number; away: number }>; battingRuns: number; defendingRuns: number;
    startingBase: 1 | 2 | 3; normalNextBase: 2 | 3 | 4 }>;
  liveContext: Readonly<{ status: 'pending'; knownContext: null; force: 'unavailable'; tagUp: 'unavailable'; consumedSignals: readonly never[] }>;
}>;
type Reader = Readonly<{ derive(source: OriginalRunnerPublicKnowledgeSource): OriginalRunnerPublicKnowledge;
  read(sourceId: string): OriginalRunnerPublicKnowledge | null }>;
type Store = Omit<Reader, 'derive'> & Readonly<{ accept(sourceId: string): OriginalRunnerPublicKnowledge; close(): void }>;
type Module = Readonly<{
  originalRunnerPublicKnowledgeEvidenceFromSqlite(db: DatabaseSync): Reader;
  openSqliteOriginalRunnerPublicKnowledgeStore(path: string, authority?: Readonly<{
    readAcceptedKnowledge(sourceId: string): OriginalRunnerPublicKnowledgeSource | null;
  }>): Store;
}>;
export const requireOriginalRunnerPublicKnowledge = (module: unknown, db: DatabaseSync): Reader => {
  const factory = (module as Partial<Module>)?.originalRunnerPublicKnowledgeEvidenceFromSqlite;
  if (typeof factory !== 'function') throw new Error('original runner public knowledge capability is not implemented');
  return factory(db);
};
export const requireOriginalRunnerPublicKnowledgeStore = (module: unknown): Module['openSqliteOriginalRunnerPublicKnowledgeStore'] => {
  const open = (module as Partial<Module>)?.openSqliteOriginalRunnerPublicKnowledgeStore;
  if (typeof open !== 'function') throw new Error('original runner public knowledge writer capability is not implemented');
  return open;
};

/** One genuine registered-profile construction per suite. Complete prospective
 * Match creation and the legal walk produce this baseline; no saved Match edits,
 * Source substitutions or mocked original actor/runner readers. */
export const originalRunnerPublicKnowledgeFixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-public-knowledge-')), path = join(directory, 'state.sqlite');
  let x: ReturnType<typeof ownedRunnerFieldNativeFixture> | undefined, closed = false;
  const closeHandles = () => { if (x && !closed) { closed = true; x.f.close(); } };
  const close = () => { try { closeHandles(); } finally { rmSync(directory, { recursive: true, force: true }); } };
  try {
    x = ownedRunnerFieldNativeFixture({ retainedSpeedBoundary: true, databasePath: path });
    const actor = readPhysicalPlateAppearanceActorFromSqlite(x.f.db, x.actor.source.sourceId);
    const pitch = readOriginalPhysicalPitchPrefixFromSqlite(x.f.db, x.action.sourceId).at(-1), runner = pitch?.frame.prePitchRunner;
    if (!actor || !pitch || !runner || actor.match.ruleProfileId !== 'npb-2026' || actor.match.half !== 'top'
      || actor.match.inning !== 1 || actor.match.outs !== 0 || actor.match.score.home !== 0 || actor.match.score.away !== 0
      || actor.match.bases.first !== runner.binding.playerId || actor.match.bases.second !== null || actor.match.bases.third !== null) {
      throw new Error('complete original runner public Match fixture prerequisite failed');
    }
    const source: OriginalRunnerPublicKnowledgeSource = { kind: 'original_runner_public_knowledge_v1',
      sourceId: 'original-runner-public', sourceVersion: 'synthetic-v1', physicalPitchSourceId: pitch.source.sourceId,
      playerId: runner.binding.playerId, physicalActorSourceId: actor.source.sourceId, prePitchRunnerSourceId: runner.source.sourceId };
    return { ...x, actor, pitch, originalRunner: runner, knowledgeSource: source, closeHandles, close };
  } catch (error) { close(); throw error; }
};
