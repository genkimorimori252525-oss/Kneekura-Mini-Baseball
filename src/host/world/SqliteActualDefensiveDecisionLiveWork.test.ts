import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';
import { actualDefensiveDecisionLiveWorkFromSqlite, openSqliteActualDefensiveDecisionLiveWork } from './SqliteActualDefensiveDecisionLiveWork';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const advance = (x: ReturnType<typeof fixture>, name: string, tick: number, previousExecution: string | null,
  previousObservation: string, previousDecision: string) => {
  const from = previousExecution === null ? x.baseField.field.motion.world.moment.ball.tick
    : x.executions.read(previousExecution)!.execution.field.motion.world.moment.ball.tick;
  const execution = { ...x.source, sourceId: `execution-${name}`, previousExecutionSourceId: previousExecution,
    action: { kind: 'motion' as const, availableAtTick: from, throughTick: tick, commands: x.fieldSource.commands } };
  x.sources.set(execution.sourceId, execution); x.executions.accept(execution.sourceId);
  const observation = { ...x.observationSource, sourceId: `observation-${name}`, executionSourceId: execution.sourceId,
    previousObservationSourceId: previousObservation };
  x.observationSources.set(observation.sourceId, observation); x.observations.accept(observation.sourceId);
  const decision = { ...x.decisionSource, sourceId: `decision-${name}`, observationSourceId: observation.sourceId,
    previousDecisionSourceId: previousDecision };
  x.decisionSources.set(decision.sourceId, decision);
  return { execution, observation, decision };
};
const databaseRows = (x: ReturnType<typeof fixture>) => x.f.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name")
  .all().map(row => ({ ...row, rows: x.f.db.prepare(`SELECT * FROM "${row.name}"`).all() }));

it('rederives owned references on a read-only connection; repeats/reopens immutably without writing or invoking Source authorities', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId); const decision = x.decisions.accept(x.decisionSource.sourceId);
    const before = databaseRows(x), reader = x.f.track(openSqliteActualDefensiveDecisionLiveWork(x.f.path));
    x.decisionSources.set(decision.source.sourceId, { ...decision.source, observationSourceId: 'unowned-latest' });
    const value = reader.read(decision.source.sourceId)!;
    expect(value.decisionSourceId).toBe(decision.source.sourceId); expect(value.decisionHash).toBe(actorHash(decision));
    expect(value.observationHash).toBe(decision.observationHash);
    expect(value.decisionModelHash).toBe(decision.decisionModelHash); expect(value.planHash).toBe(decision.planHash);
    expect(value.work).toMatchObject({ phase: 'pending_decision', revision: 1,
      cut: { observationSourceId: x.observationSource.sourceId, baseFieldSourceId: x.baseField.source.sourceId,
        executionSourceId: null, at: x.observation.receipt.at } });
    expect(reader.read(decision.source.sourceId)).toEqual(value);
    expect(x.f.track(openSqliteActualDefensiveDecisionLiveWork(x.f.path)).read(decision.source.sourceId)).toEqual(value);
    expect(actualDefensiveDecisionLiveWorkFromSqlite(x.f.db).read(decision.source.sourceId)).toEqual(value);
    expect(reader.read('missing')).toBeNull(); expect(Object.isFrozen(value.work.cut.at)).toBe(true);
    expect(databaseRows(x)).toEqual(before);
    reader.close(); expect(() => reader.read(decision.source.sourceId)).toThrow(/closed/);
  } finally { x.f.close(); }
});

it('pins each historical cut and never equates later observation/issuance with actual motor adoption', () => {
  const directory = mkdtempSync(join(tmpdir(), 'legacy-defensive-live-work-')), path = join(directory, 'state.sqlite');
  const x = fixture(path);
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    expect(x.f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(path);
    x.plans.accept(x.planSource.sourceId); const first = x.decisions.accept(x.decisionSource.sourceId);
    const reader = x.f.track(openSqliteActualDefensiveDecisionLiveWork(x.f.path)), original = reader.read(first.source.sourceId)!;
    const mid = advance(x, 'first-step', first.receipt.scheduling.decisionTick, null, x.observationSource.sourceId, first.source.sourceId);
    x.decisions.accept(mid.decision.sourceId); const middle = reader.read(mid.decision.sourceId)!;
    expect(middle.work.phase).toBe('pending_first_step');
    const later = advance(x, 'issued', first.receipt.scheduling.movementStartTick + 5, mid.execution.sourceId, mid.observation.sourceId, mid.decision.sourceId);
    // Physical clock/observation progress alone never advances an existing decision receipt.
    expect(reader.read(mid.decision.sourceId)).toEqual(middle); expect(reader.read(first.source.sourceId)).toEqual(original);
    const issued = x.decisions.accept(later.decision.sourceId), last = reader.read(later.decision.sourceId)!;
    expect(last.work.phase).toBe('issued'); expect(last.work.deadlines).toEqual(original.work.deadlines);
    expect(last.work.handoff).toMatchObject({ status: 'pending', due: original.work.deadlines.firstStep,
      availableAt: issued.receipt.lifecycle.issuedAt, source: { physical: [], intents: [{ dueTick: first.receipt.scheduling.movementStartTick }] } });
    expect(reader.read(first.source.sourceId)).toEqual(original); expect(reader.read(mid.decision.sourceId)).toEqual(middle);
    expect(last.work).not.toHaveProperty('executedThrough');
    // Corrupt future non-identity payloads are opaque to a bounded historical read.
    x.f.db.prepare("UPDATE actual_defensive_decisions SET source_json='future-payload-not-parsed',snapshot_json='future-payload-not-parsed' WHERE source_id=?")
      .run(later.decision.sourceId);
    x.f.db.prepare("UPDATE actual_field_observations SET source_json='future-payload-not-parsed',snapshot_json='future-payload-not-parsed' WHERE source_id=?")
      .run(later.observation.sourceId);
    expect(reader.read(first.source.sourceId)).toEqual(original); expect(reader.read(mid.decision.sourceId)).toEqual(middle);
    expect(() => reader.read(later.decision.sourceId)).toThrow();
    x.f.db.prepare("UPDATE actual_defensive_decisions SET observation_source_id='missing' WHERE source_id=?").run(later.decision.sourceId);
    expect(() => reader.read(first.source.sourceId)).toThrow(/metadata/);
  } finally { x.f.close(); rmSync(directory, { recursive: true }); }
});

it.each(['decision', 'observation', 'model', 'plan'] as const)('rejects tampered owned %s evidence instead of trusting mirrored payloads', kind => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId); x.decisions.accept(x.decisionSource.sourceId);
    const reader = x.f.track(openSqliteActualDefensiveDecisionLiveWork(x.f.path));
    const table = { decision: 'actual_defensive_decisions', observation: 'actual_field_observations',
      model: 'world_player_decision_models', plan: 'actual_defensive_plans' }[kind];
    x.f.db.prepare(`UPDATE ${table} SET snapshot_hash='tampered'`).run();
    expect(() => reader.read(x.decisionSource.sourceId)).toThrow();
  } finally { x.f.close(); }
});

it('keeps fractional pending deadlines distinct from same-tick physical/observation progress', () => {
  const calibration = { ...playerDecisionCalibrationFixture(),
    decisionTimingParameters: { minimumDecisionDelayTicks: 0, maximumDecisionDelayTicks: 0, fixedProcessingOffsetTicks: 0 },
    firstStepTimingParameters: { minimumFirstStepDelayTicks: 0, maximumFirstStepDelayTicks: 0, fixedMotorOffsetTicks: 0 } };
  const x = fixture(undefined, { kind: 'candidate', calibration, captureTiming: { contactElapsedSeconds: 0.0100002, captureDissipationPowerW: 1e12 } });
  try {
    x.plans.accept(x.planSource.sourceId); const first = x.decisions.accept(x.decisionSource.sourceId);
    const acquisition = x.executions.accept(x.source.sourceId);
    const observation = { ...x.observationSource, sourceId: 'same-tick-observation', executionSourceId: acquisition.source.sourceId,
      previousObservationSourceId: x.observationSource.sourceId };
    x.observationSources.set(observation.sourceId, observation); x.observations.accept(observation.sourceId);
    const source = { ...x.decisionSource, sourceId: 'same-tick-decision', observationSourceId: observation.sourceId, previousDecisionSourceId: first.source.sourceId };
    x.decisionSources.set(source.sourceId, source); const decision = x.decisions.accept(source.sourceId);
    const work = x.f.track(openSqliteActualDefensiveDecisionLiveWork(x.f.path)).read(source.sourceId)!.work;
    expect(work.phase).toBe('pending_decision'); expect(work.cut.at.tick).toBe(first.receipt.observedThrough.tick);
    expect(work.cut.at.elapsedSeconds).toBe(decision.receipt.observedThrough.elapsedSeconds);
    expect(work.cut.at.elapsedSeconds).toBeLessThan(work.deadlines.decision.elapsedSeconds);
    expect(work.handoff).toBeNull(); expect(work.source.information).toEqual([]);
  } finally { x.f.close(); }
});

it('rejects supplied payloads, active identities and invalid paths without reading accessor data', () => {
  const x = fixture();
  try {
    const reader = x.f.track(openSqliteActualDefensiveDecisionLiveWork(x.f.path)); let called = false;
    const active = Object.defineProperty({}, 'decisionSourceId', { get() { called = true; return 'fake'; }, enumerable: true });
    for (const value of ['', ' ', { decisionSourceId: 'fake' }, { source: x.decisionSource, receipt: {} }, active, 1, null]) {
      expect(() => reader.read(value as string)).toThrow();
    }
    expect(called).toBe(false);
    expect(() => openSqliteActualDefensiveDecisionLiveWork(' ')).toThrow();
  } finally { x.f.close(); }
});
