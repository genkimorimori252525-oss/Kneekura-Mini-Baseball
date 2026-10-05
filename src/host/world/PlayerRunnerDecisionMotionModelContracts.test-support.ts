import { rmSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { RunnerDecisionInput } from '../../core/sim/running/RunnerDecision';
import type { RunnerMotionParameters } from '../../core/sim/running/RunnerMotion';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
import { input as runnerInput } from './PrePitchRunnerFixtures.test-support';

export type RunnerDecisionParameters = Pick<RunnerDecisionInput, 'minimumCueConfidence' | 'coachTrust'
  | 'minimumAdvanceSafetyMarginTicks' | 'decisionAbility' | 'timingParameters'>;
export type RunnerDecisionMotionModelSource = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'runner_decision_motion_v1'; careerId: string; playerId: string;
  personLinkSourceId: string; acceptedAtDay: number; decision: RunnerDecisionParameters; motion: RunnerMotionParameters;
}>;
export type RunnerDecisionMotionModel = Readonly<{ source: RunnerDecisionMotionModelSource; person: DurablePlayerPersonLink }>;
export type RunnerDecisionMotionModelReader = Readonly<{
  derive(source: RunnerDecisionMotionModelSource): RunnerDecisionMotionModel;
  read(sourceId: string): RunnerDecisionMotionModel | null;
  selectAtDay(careerId: string, playerId: string, atDay: number): RunnerDecisionMotionModel;
}>;
type ModelStore = Omit<RunnerDecisionMotionModelReader, 'derive'> & Readonly<{ accept(sourceId: string): RunnerDecisionMotionModel; close(): void }>;
type Module = Readonly<{
  playerRunnerDecisionMotionModelEvidenceFromSqlite(db: Pick<DatabaseSync, 'prepare'>): RunnerDecisionMotionModelReader;
  openSqlitePlayerRunnerDecisionMotionModelStore(path: string, authority?: Readonly<{
    readAcceptedModel(sourceId: string): RunnerDecisionMotionModelSource | null;
  }>): ModelStore;
}>;
/** Additive exports are expected alongside the existing model; no fake implementation. */
export const requireRunnerDecisionMotionModel = (module: unknown, db: DatabaseSync) => {
  const factory = (module as Partial<Module>)?.playerRunnerDecisionMotionModelEvidenceFromSqlite;
  if (typeof factory !== 'function') throw new Error('runner decision-motion model capability is not implemented');
  return factory(db);
};
export const requireRunnerDecisionMotionModelStore = (module: unknown): Module['openSqlitePlayerRunnerDecisionMotionModelStore'] => {
  const open = (module as Partial<Module>)?.openSqlitePlayerRunnerDecisionMotionModelStore;
  if (typeof open !== 'function') throw new Error('runner decision-motion model writer capability is not implemented');
  return open;
};

/** Genuine existing World/roster/intake owner, with no accepted fielding baseline.
 * Synthetic parameter values reuse existing runner Core/source fixtures. */
export const runnerDecisionMotionModelFixture = (options: Parameters<typeof playerFieldingModelFixture>[0] = {}) => {
  const f = playerFieldingModelFixture(options); let closed = false;
  const closeHandles = () => { if (!closed) { closed = true; f.close(); } };
  const close = () => { try { closeHandles(); } finally { rmSync(dirname(f.path), { recursive: true, force: true }); } };
  try {
    const person = f.links.readLink(f.person.sourceId);
    if (!person || person.playerId !== f.person.playerId) throw new Error('runner model original Person fixture prerequisite failed');
    const source: RunnerDecisionMotionModelSource = { sourceId: 'runner-model', sourceVersion: 'synthetic-runner-v1',
      capability: 'runner_decision_motion_v1', careerId: person.careerId, playerId: person.playerId,
      personLinkSourceId: person.sourceId, acceptedAtDay: person.acceptedAtDay,
      decision: { minimumCueConfidence: 0.5, coachTrust: 1, minimumAdvanceSafetyMarginTicks: 50_000, decisionAbility: 0.8,
        timingParameters: { minimumDecisionDelayTicks: 30_000, maximumDecisionDelayTicks: 180_000, fixedRecognitionOffsetTicks: 10_000 } },
      motion: runnerInput().parameters };
    const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedModel: (id: string) => sources.get(id) ?? null };
    return { ...f, source, sources, authority, closeHandles, close };
  } catch (error) { close(); throw error; }
};
