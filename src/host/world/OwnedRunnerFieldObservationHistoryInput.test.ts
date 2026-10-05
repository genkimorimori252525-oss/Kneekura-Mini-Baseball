import { expect, it, vi } from 'vitest';
import * as observations from './SqliteActualFieldObservationStore';
import { requireRunnerObservationHistory, runnerObservationHistoryFixture, type RunnerObservationHistorySource } from './OwnedRunnerFieldObservationHistoryContracts.test-support';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

const injections = [
  ['receipt', { perceived: { knownContext: null } }], ['previous', { receipt: {} }], ['atTick', 3_300_000],
  ['atElapsedSeconds', 0.3], ['currentBase', 1], ['nextBase', 2], ['forcedToAdvance', false], ['tagUp', { kind: 'none' }],
  ['knownContext', { currentBase: 1, nextBase: 2, forcedToAdvance: false, tagUp: { kind: 'none' } }],
  ['communicationSourceId', 'actual-call'], ['consumedSignals', ['actual-call']], ['perceivedCues', []],
  ['decisionModelSourceId', 'defender-model'], ['decision', { reason: 'no_actionable_evidence' }],
  ['controller', { kind: 'route_following' }], ['command', { kind: 'hold' }], ['result', 'safe'],
  ['canonicalWorld', { runners: [] }],
] as const;
it.each(injections)('rejects caller-supplied %s after authenticating the original projection', (key, value) => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db); expect(own.derive(x.historySource).playerId).toBe('runner');
    expect(() => own.derive({ ...x.historySource, [key]: value } as RunnerObservationHistorySource)).toThrow();
  } finally { x.close(); }
});

it.each(['physicalPitchSourceId', 'playerId', 'baseFieldSourceId', 'prePitchRunnerSourceId', 'observationModelSourceId'] as const)
('rejects foreign %s ownership', key => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db); expect(own.derive(x.historySource).revision).toBe(1);
    expect(() => own.derive({ ...x.historySource, [key]: 'foreign' })).toThrow();
  } finally { x.close(); }
});

it.each(['kind', 'view', 'previousObservationSourceId'] as const)('rejects a %s accessor without invoking it', key => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db); expect(own.derive(x.historySource).revision).toBe(1);
    const source = { ...x.historySource }; let calls = 0;
    Object.defineProperty(source, key, { enumerable: true, get() { calls += 1; return x.historySource[key]; } });
    expect(() => own.derive(source)).toThrow(/accessor|inert/); expect(calls).toBe(0);
  } finally { x.close(); }
});

it.each(['missing_predecessor', 'self_predecessor', 'execution', 'legacy_kind', 'pose', 'eye'] as const)
('rejects a %s continuation without adopting a foreign baseline', kind => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    const next: any = x.nextObservation(first);
    if (kind === 'missing_predecessor') next.previousObservationSourceId = null;
    if (kind === 'self_predecessor') next.previousObservationSourceId = next.sourceId;
    if (kind === 'execution') next.executionSourceId = 'runner-acquisition';
    if (kind === 'legacy_kind') delete next.kind;
    if (kind === 'pose') next.view = { ...next.view, poseVersion: 'different-pose' };
    if (kind === 'eye') next.view = { ...next.view, bodyRelativeEyeOffset: { ...next.view.bodyRelativeEyeOffset, y: 100 } };
    expect(() => own.derive(next)).toThrow(); expect(own.read(first.source.sourceId)).toEqual(first);
  } finally { x.close(); }
});
