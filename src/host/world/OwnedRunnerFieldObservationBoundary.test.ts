import { expect, it, vi } from 'vitest';
import * as observations from './SqliteActualFieldObservationStore';
import { requireOwnedRunnerObservation, runnerObservationFixture } from './OwnedRunnerFieldObservationContracts.test-support';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

it.each(['currentBase', 'nextBase', 'force', 'tag_up', 'knowledge', 'rule', 'official', 'communication', 'cue', 'forecast',
  'controller', 'command', 'sample_time', 'result', 'physical_state'] as const)
('rejects caller %s injection after proving the actual observation capability exists', field => {
  const x = runnerObservationFixture(state);
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db); expect(derive(x.source).playerId).toBe('runner');
    const source = { ...x.source } as any;
    if (field === 'currentBase') source.currentBase = 2;
    if (field === 'nextBase') source.nextBase = 4;
    if (field === 'force') source.forcedToAdvance = true;
    if (field === 'tag_up') source.tagUp = { kind: 'none' };
    if (field === 'knowledge') source.knownContext = { currentBase: 1, nextBase: 2, forcedToAdvance: false, tagUp: { kind: 'none' } };
    if (field === 'rule') source.correctRuleSnapshot = { fair: true, caught: false, forcedToAdvance: true };
    if (field === 'official') source.officialPlayClosure = { bases: { first: null, second: 'runner', third: null } };
    if (field === 'communication') source.communicationSourceId = 'unconsumed-call';
    if (field === 'cue') source.perceivedCues = [{ kind: 'next_base_race', runnerArrivalTick: 3_500_000, defenderControlTick: null }];
    if (field === 'forecast') source.forecast = { trueDefenderControlTick: 3_500_000 };
    if (field === 'controller') source.controller = x.runner.controller;
    if (field === 'command') source.command = { playerId: 'runner', acceleration: { x: 0, y: 0, z: 0 } };
    if (field === 'sample_time') source.atTick = x.field.field.motion.world.moment.ball.tick;
    if (field === 'result') source.result = 'safe';
    if (field === 'physical_state') source.position = x.runner.canonical.position;
    expect(() => derive(source)).toThrow();
  } finally { x.close(); }
});

it.each(['pitch', 'batter', 'defender', 'field', 'runner_source', 'model'] as const)
('rejects a foreign %s identity instead of borrowing an original runner proof', field => {
  const x = runnerObservationFixture(state);
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db); expect(derive(x.source).playerId).toBe('runner');
    const source = { ...x.source };
    if (field === 'pitch') source.physicalPitchSourceId = 'other-pitch';
    if (field === 'batter') source.playerId = 'batter';
    if (field === 'defender') source.playerId = 'defender-0';
    if (field === 'field') source.fieldSourceId = 'missing-field';
    if (field === 'runner_source') source.prePitchRunnerSourceId = 'other-original-controller';
    if (field === 'model') source.observationModelSourceId = 'other-model';
    expect(() => derive(source)).toThrow();
  } finally { x.close(); }
});

it('rejects a correctly matched defender/model pair at the dedicated runner capability', () => {
  const x = runnerObservationFixture(state, { modelPlayerId: 'defender-0' });
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db);
    expect(x.observationModel.source.playerId).toBe('defender-0');
    expect(() => derive({ ...x.source, playerId: 'defender-0' })).toThrow();
  } finally { x.close(); }
});

it.each(['kind', 'fieldSourceId', 'view'] as const)('rejects a Source %s accessor before invoking it', field => {
  const x = runnerObservationFixture(state);
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db); expect(derive(x.source).playerId).toBe('runner');
    let called = false; const source = { ...x.source };
    Object.defineProperty(source, field, { enumerable: true, get() { called = true; return x.source[field]; } });
    expect(() => derive(source)).toThrow(/accessor|inert/); expect(called).toBe(false);
  } finally { x.close(); }
});

it.each(['future_day', 'clock'] as const)('rejects an authenticated observation model with a different %s', kind => {
  const x = runnerObservationFixture(state, { configureModel: source => kind === 'future_day'
    ? { ...source, acceptedAtDay: source.acceptedAtDay + 1 }
    : { ...source, calibration: { ...source.calibration, memoryDecayParameters: { ...source.calibration.memoryDecayParameters,
      ticksPerSecond: source.calibration.memoryDecayParameters.ticksPerSecond + 1 } } } });
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db);
    expect(() => derive(x.source)).toThrow();
  } finally { x.close(); }
});

it.each(['revision', 'occupancy', 'duplicate_base', 'person'] as const)
('rejects altered original %s evidence before deriving public knowledge', kind => {
  const x = runnerObservationFixture(state);
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db); expect(derive(x.source).playerId).toBe('runner');
    state.response = structuredClone(state.response);
    const world = state.response.touch.worldContact, frame = world.flight.physicalPitch.frame;
    if (kind === 'revision') frame.batterActor.officialRevision += 1;
    if (kind === 'occupancy') frame.batterActor.match.bases.first = null;
    if (kind === 'duplicate_base') frame.batterActor.match.bases.second = 'runner';
    if (kind === 'person') world.modelActorEvidence.find((actor: any) => actor.binding.playerId === 'runner').person.personId = 'other-person';
    expect(() => derive(x.source)).toThrow();
  } finally { x.close(); }
});

it('preserves the legacy observer fence and cannot turn a sensory projection into a received signal or decision', () => {
  const x = runnerObservationFixture(state);
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db), value = derive(x.source);
    const legacy = { ...x.observationSource, baseFieldSourceId: x.field.source.sourceId };
    expect(() => observations.actualFieldObservationEvidenceFromSqlite(x.db).derive(legacy)).toThrow(/unsupported original pre-pitch runner consumer/);
    expect(value.receipt.perceived.communications).toEqual([]); expect(value.knowledge.consumedSignals).toEqual([]);
    expect(value.knowledge.knownContext).toBeNull(); expect(value.knowledge.perceivedCues).toEqual([]);
    expect(value).not.toHaveProperty('decisionInput'); expect(value).not.toHaveProperty('issuedAt');
  } finally { x.close(); }
});
