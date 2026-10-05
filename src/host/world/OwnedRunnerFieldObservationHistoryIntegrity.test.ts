import { expect, it, vi } from 'vitest';
import * as observations from './SqliteActualFieldObservationStore';
import { requireRunnerObservationHistory, runnerObservationHistoryFixture } from './OwnedRunnerFieldObservationHistoryContracts.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

it.each(['head', 'revision', 'previous', 'receipt', 'runner', 'model', 'knowledge', 'sample'] as const)
('rejects rehashed %s corruption instead of trusting a saved sensory receipt', mutation => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    if (mutation === 'head') x.db.exec('UPDATE actual_field_observation_heads SET revision=2');
    else if (mutation === 'revision') x.db.exec('UPDATE actual_field_observations SET revision=2');
    else if (mutation === 'previous') x.db.exec("UPDATE actual_field_observations SET previous_source_id='foreign'");
    else {
      const snapshot: any = structuredClone(first);
      if (mutation === 'receipt') snapshot.receipt.at.elapsedSeconds += 0.001;
      if (mutation === 'runner') snapshot.prePitchRunnerSourceId = 'foreign-original-runner';
      if (mutation === 'model') snapshot.dependencyHashes.model = 'foreign-model-hash';
      if (mutation === 'knowledge') snapshot.knowledge.knownContext = { forcedToAdvance: false };
      if (mutation === 'sample') snapshot.receipt.samples.ball.sample.estimate.position.x += 1;
      x.db.prepare('UPDATE actual_field_observations SET snapshot_json=?,snapshot_hash=?').run(json(snapshot), hash(snapshot));
    }
    expect(() => own.read(first.source.sourceId)).toThrow();
  } finally { x.close(); }
});

it.each(['source', 'snapshot', 'history'] as const)('discovers a moved Source through its %s mirror', mirror => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    const source = { ...first.source, sourceId: 'moved' }, snapshot = JSON.parse(json(first));
    Object.assign(snapshot.source, source); Object.assign(snapshot.history[0], source);
    if (mirror === 'source') source.sourceId = first.source.sourceId;
    else if (mirror === 'snapshot') Object.assign(snapshot.source, { sourceId: first.source.sourceId });
    else Object.assign(snapshot.history[0], { sourceId: first.source.sourceId });
    x.db.prepare('UPDATE actual_field_observations SET source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run('moved', json(source), hash(source), json(snapshot), hash(snapshot));
    x.db.exec("UPDATE actual_field_observation_heads SET source_id='moved'");
    expect(() => own.read(first.source.sourceId)).toThrow();
  } finally { x.close(); }
});

it.each(['prePitchRunnerSourceId', 'kind', 'previousObservationSourceId'] as const)
('rejects duplicate future %s metadata while leaving future view/receipt payload opaque', key => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    const second = own.derive(x.nextObservation(first)); x.archiveObservation(second);
    const opaque = { ...second.source, view: 'opaque-future-view' }, canonical = json(opaque);
    const ambiguous = canonical.replace('{', `{${JSON.stringify(key)}:${JSON.stringify(second.source[key])},`);
    x.db.prepare('UPDATE actual_field_observations SET source_json=? WHERE source_id=?').run(ambiguous, second.source.sourceId);
    expect(() => own.read(first.source.sourceId)).toThrow();
  } finally { x.close(); }
});

it('authenticates every older history identity on a later row without consuming its receipt', () => {
  const x = runnerObservationHistoryFixture(state);
  try {
    const own = requireRunnerObservationHistory(observations, x.db), first = own.derive(x.historySource); x.archiveObservation(first);
    const second = own.derive(x.nextObservation(first)); x.archiveObservation(second);
    const snapshot: any = structuredClone(second); snapshot.history[0].prePitchRunnerSourceId = 'foreign-original-runner'; snapshot.receipt = 'opaque';
    x.db.prepare('UPDATE actual_field_observations SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(snapshot), hash(snapshot), second.source.sourceId);
    expect(() => own.read(first.source.sourceId)).toThrow();
  } finally { x.close(); }
});
