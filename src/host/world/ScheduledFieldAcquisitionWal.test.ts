import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { actorJson, actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { assertNoBattedWorldFieldExecutionOwner } from './BattedWorldMotionOwnershipFence';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

const fixture = (phase: 'capturing' | 'fence_pending' = 'capturing') => {
  const x = battedWorldFieldExecutionFixture(join(mkdtempSync(join(tmpdir(), 'scheduled-capture-wal-')), 'state.sqlite'), 'candidate');
  const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'wal-capture-plan', action: { kind: 'acquisition_plan' } };
  x.sources.set(planSource.sourceId, planSource);
  const planned = x.executions.accept(planSource.sourceId);
  if (planned.execution.kind !== 'acquisition_plan') throw new Error('fixture capture plan');
  const plan = planned.execution.plan;
  const middleSource: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'wal-capture-middle', previousExecutionSourceId: planSource.sourceId,
    action: { kind: 'acquisition_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: phase === 'capturing'
      ? (plan.contactMoment.elapsedSeconds + plan.secureElapsedSeconds) / 2 : (plan.secureElapsedSeconds + plan.fenceElapsedSeconds) / 2 } };
  x.sources.set(middleSource.sourceId, middleSource);
  const middle = x.executions.accept(middleSource.sourceId);
  if (middle.execution.kind !== 'acquisition_advance' || middle.execution.progress.kind !== phase) throw new Error(`fixture ${phase}`);
  const endSource: AcceptedBattedWorldFieldExecution = { ...middleSource, sourceId: 'wal-capture-confirmed', previousExecutionSourceId: middleSource.sourceId,
    action: { kind: 'acquisition_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds + 0.001 } };
  x.sources.set(endSource.sourceId, endSource);
  return { ...x, planSource, planned, plan, middleSource, middle, middleProgress: middle.execution.progress, endSource };
};
type Fixture = ReturnType<typeof fixture>;
const rows = (x: Fixture, table: string) => x.f.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
const archive = (x: Fixture) => rows(x, 'batted_world_field_executions');
const heads = (x: Fixture) => rows(x, 'batted_world_field_execution_heads');
const restoreRows = (x: Fixture, table: string, saved: ReturnType<typeof rows>) => {
  for (const [index, row] of saved.entries()) {
    const columns = Object.keys(row);
    x.f.db.prepare(`UPDATE ${table} SET ${columns.map((column) => `${column}=?`).join(',')} WHERE rowid=(SELECT rowid FROM ${table} ORDER BY rowid LIMIT 1 OFFSET ?)`)
      .run(...columns.map((column) => row[column]), index);
  }
};
const dependencies = (x: Fixture) => ['physical_pitch_progress_actions', 'physical_pitch_progress_heads', 'world_player_person_links',
  'world_player_workload_heads', 'batted_world_models', 'batted_contact_response_models', 'batted_contact_responses',
  'batted_world_field_geometries', 'batted_world_field_actions', 'batted_world_field_heads'].map((table) => rows(x, table));
const expectOriginals = (x: Fixture) => {
  expect(x.executions.read(x.planSource.sourceId)).toEqual(x.planned);
  expect(x.executions.read(x.middleSource.sourceId)).toEqual(x.middle);
  expect(x.fields.read(x.baseField.source.sourceId)).toEqual(x.baseField);
};
const expectConfirmed = (x: Fixture) => {
  const confirmed = x.executions.accept(x.endSource.sourceId);
  if (confirmed.execution.kind !== 'acquisition_advance' || confirmed.execution.progress.kind !== 'secured') throw new Error('fixture confirmation');
  const { progress, liveWork } = confirmed.execution;
  expect(progress.acquisition.moment.elapsedSeconds).toBe(x.plan.secureElapsedSeconds);
  expect(progress.cursor.moment.elapsedSeconds).toBe(x.plan.fenceElapsedSeconds);
  expect(progress.world.moment).toEqual(progress.cursor.moment);
  expect(progress.transport.remainingEnergyJ).toBe(0);
  expect(liveWork.receipts).toHaveLength(1);
  const receipt = liveWork.receipts[0];
  expect(receipt).toMatchObject({ kind: 'acquisition_confirmed', status: 'consumed', acquisition: progress.acquisition,
    confirmationMoment: progress.cursor.moment, cursor: progress.cursor });
  expect(liveWork.source.completion).toEqual({ completedAtTick: receipt.adoptedAtTick, basisEventId: receipt.eventId });
  expect(liveWork.handoffs).toHaveLength(2);
  expect(liveWork.handoffs.find((handoff) => handoff.kind === 'custody')).toMatchObject({ cursor: progress.cursor });
  expect(liveWork.handoffs.find((handoff) => handoff.kind === 'rule_evidence')).toMatchObject({ status: 'pending', acquisition: progress.acquisition });
  for (const handoff of liveWork.handoffs) {
    expect(handoff).toMatchObject({ fromSourceId: liveWork.source.sourceId, basisEventId: receipt.eventId });
    expect(handoff.source.sourceId).toBe(handoff.toSourceId);
    expect(handoff.source).not.toHaveProperty('completion');
  }
  return confirmed;
};
const rehashSnapshot = (x: Fixture, sourceId: string, expression: string) => {
  const row = x.f.db.prepare(`SELECT ${expression} AS value FROM batted_world_field_executions WHERE source_id=?`).get(sourceId)!;
  const changed = JSON.parse(row.value as string) as unknown;
  x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
    .run(actorJson(changed), actorHash(changed), sourceId);
};

const lateMutations = [
  ['original response Source', "UPDATE batted_contact_responses SET source_hash='changed';"],
  ['original retention calibration', "UPDATE batted_contact_response_models SET source_hash='changed';"],
  ['original actor model', "UPDATE batted_world_models SET source_hash='changed';"],
  ['original Person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['original geometry', "UPDATE batted_world_field_geometries SET snapshot_hash='changed';"],
  ['original field', "UPDATE batted_world_field_actions SET source_hash='changed';"],
  ['original physical pitch', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['original pitch head', 'UPDATE physical_pitch_progress_heads SET progress_revision=progress_revision+1;'],
  ['current Player workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['admitted plan Source', "UPDATE batted_world_field_executions SET source_hash='changed' WHERE source_id='wal-capture-plan';"],
  ['admitted secure deadline', "UPDATE batted_world_field_executions SET snapshot_json=json_set(snapshot_json,'$.execution.plan.secureElapsedSeconds',1000000) WHERE source_id='wal-capture-plan';"],
  ['previous capture progress', "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id='wal-capture-middle';"],
  ['inserted Source', "UPDATE batted_world_field_executions SET source_hash='changed' WHERE source_id=NEW.source_id;"],
  ['inserted ownership mirror', "UPDATE batted_world_field_executions SET base_field_source_id='changed' WHERE source_id=NEW.source_id;"],
  ['inserted snapshot', "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id=NEW.source_id;"],
  ['current fence cursor', "UPDATE batted_world_field_executions SET snapshot_json=json_remove(snapshot_json,'$.execution.progress.cursor') WHERE source_id=NEW.source_id;"],
  ['confirmed exact evidence', "UPDATE batted_world_field_executions SET snapshot_json=json_remove(snapshot_json,'$.execution.liveWork.receipts[0].acquisition') WHERE source_id=NEW.source_id;"],
  ['confirmation receipt', "UPDATE batted_world_field_executions SET snapshot_json=json_remove(snapshot_json,'$.execution.liveWork.receipts[0].confirmationMoment') WHERE source_id=NEW.source_id;"],
  ['receipt identity', "UPDATE batted_world_field_executions SET snapshot_json=json_set(snapshot_json,'$.execution.liveWork.receipts[0].eventId','foreign') WHERE source_id=NEW.source_id;"],
  ['successor work', "UPDATE batted_world_field_executions SET snapshot_json=json_set(snapshot_json,'$.execution.liveWork.handoffs',json('[]')) WHERE source_id=NEW.source_id;"],
  ['capture completion', "UPDATE batted_world_field_executions SET snapshot_json=json_remove(snapshot_json,'$.execution.liveWork.source.completion') WHERE source_id=NEW.source_id;"],
] as const;

it('rolls back every late capture mutation with its receipts and handoffs, then preserves the archive across retry and reopen', () => {
  const x = fixture();
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    const before = archive(x), head = heads(x), roots = dependencies(x);
    for (const [name, mutation] of lateMutations) {
      x.f.db.exec(`CREATE TRIGGER mutate_scheduled_capture AFTER INSERT ON batted_world_field_executions BEGIN ${mutation} END`);
      expect(() => x.executions.accept(x.endSource.sourceId), name).toThrow();
      expect(archive(x), name).toEqual(before); expect(heads(x), name).toEqual(head); expect(dependencies(x), name).toEqual(roots);
      expect(x.executions.read(x.endSource.sourceId), name).toBeNull();
      expect(x.f.db.prepare("SELECT count(*) AS n FROM batted_world_field_executions WHERE json_extract(snapshot_json,'$.execution.liveWork.source.completion') IS NOT NULL").get(), name).toEqual({ n: 0 });
      x.f.db.exec('DROP TRIGGER mutate_scheduled_capture');
    }
    expectOriginals(x);
    const confirmed = expectConfirmed(x);
    expect(archive(x).slice(0, before.length)).toEqual(before); expect(dependencies(x)).toEqual(roots);
    x.executions.close();
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, x.authority));
    expect(reopened.read(x.planSource.sourceId)).toEqual(x.planned);
    expect(reopened.read(x.middleSource.sourceId)).toEqual(x.middle);
    expect(reopened.read(x.endSource.sourceId)).toEqual(confirmed);
    expect(reopened.accept(x.endSource.sourceId)).toEqual(confirmed);
  } finally { x.f.close(); }
});

it('rechecks pending capture inside the write and after the final head update with independent clean rollback checks', () => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x), roots = dependencies(x);
    for (const [stage, table, mutation] of [
      ['BEFORE INSERT', 'batted_world_field_executions', "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id='wal-capture-plan';"],
      ['AFTER UPDATE', 'batted_world_field_execution_heads', 'UPDATE batted_world_field_execution_heads SET revision=revision+1;'],
    ]) {
      x.f.db.exec(`CREATE TRIGGER mutate_capture_boundary ${stage} ON ${table} BEGIN ${mutation} END`);
      expect(() => x.executions.accept(x.endSource.sourceId), stage).toThrow();
      expect(archive(x), stage).toEqual(before); expect(heads(x), stage).toEqual(head); expect(dependencies(x), stage).toEqual(roots);
      expect(x.executions.read(x.endSource.sourceId), stage).toBeNull();
      x.f.db.exec('DROP TRIGGER mutate_capture_boundary');
    }
    expectOriginals(x); expectConfirmed(x);
  } finally { x.f.close(); }
});

it('rejects cached peer mutations before commit and authority mutations during identical confirmation retries', () => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x);
    for (const [table, mutation] of [
      ['batted_contact_response_models', "UPDATE batted_contact_response_models SET source_hash='changed';"],
      ['batted_world_field_executions', "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id='wal-capture-plan';"],
      ['physical_pitch_progress_heads', 'UPDATE physical_pitch_progress_heads SET progress_revision=progress_revision+1;'],
    ]) {
      const original = rows(x, table);
      const peer = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, { read() { x.f.db.exec(mutation); return x.baseField; } }, x.authority));
      expect(() => peer.accept(x.endSource.sourceId), table).toThrow();
      expect(x.f.db.prepare('SELECT source_id FROM batted_world_field_executions WHERE source_id=?').get(x.endSource.sourceId), table).toBeUndefined();
      expect(heads(x), table).toEqual(head);
      restoreRows(x, table, original); expect(archive(x), table).toEqual(before);
    }
    expectOriginals(x);
    const confirmed = expectConfirmed(x), completed = archive(x), completedHead = heads(x);
    const retry = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, { readAcceptedExecution() {
      x.f.db.exec("UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id='wal-capture-plan'"); return x.endSource;
    } }));
    expect(() => retry.accept(x.endSource.sourceId)).toThrow(); expect(heads(x)).toEqual(completedHead);
    restoreRows(x, 'batted_world_field_executions', completed);
    expect(x.executions.accept(x.endSource.sourceId)).toEqual(confirmed); expect(archive(x)).toEqual(completed);
  } finally { x.f.close(); }
});

it('rederives canonically rehashed original deadlines, partial energy, confirmation evidence and successor work', () => {
  const x = fixture();
  try {
    const confirmed = expectConfirmed(x), before = archive(x), head = heads(x);
    const cases = [
      [x.planSource.sourceId, "json_set(snapshot_json,'$.execution.plan.secureElapsedSeconds',1000000)"],
      [x.planSource.sourceId, "json_set(snapshot_json,'$.execution.plan.fenceElapsedSeconds',1000000)"],
      [x.planSource.sourceId, "json_set(snapshot_json,'$.execution.plan.initialEnergyJ',0)"],
      [x.planSource.sourceId, "json_set(snapshot_json,'$.execution.plan.contactOffset.x',1000000)"],
      [x.middleSource.sourceId, "json_set(snapshot_json,'$.execution.progress.transport.remainingEnergyJ',0)"],
      [x.middleSource.sourceId, "json_set(snapshot_json,'$.execution.progress.checkpointElapsedSeconds',json('[]'))"],
      [x.middleSource.sourceId, "json_set(snapshot_json,'$.execution.liveWork.source.completion',json('{\"completedAtTick\":0,\"basisEventId\":\"foreign\"}'))"],
      [x.endSource.sourceId, "json_set(snapshot_json,'$.execution.progress.cursor.moment.elapsedSeconds',0)"],
      [x.endSource.sourceId, "json_set(snapshot_json,'$.execution.progress.acquisition.moment.elapsedSeconds',0)"],
      [x.endSource.sourceId, "json_set(snapshot_json,'$.execution.liveWork.receipts',json('[]'))"],
      [x.endSource.sourceId, "json_set(snapshot_json,'$.execution.liveWork.receipts[0].confirmationMoment.elapsedSeconds',0)"],
      [x.endSource.sourceId, "json_set(snapshot_json,'$.execution.liveWork.handoffs',json('[]'))"],
    ];
    if (confirmed.execution.kind !== 'acquisition_advance') throw new Error('fixture confirmation');
    const custody = confirmed.execution.liveWork.handoffs.findIndex((handoff) => handoff.kind === 'custody');
    const rule = confirmed.execution.liveWork.handoffs.findIndex((handoff) => handoff.kind === 'rule_evidence');
    expect(custody).toBeGreaterThanOrEqual(0); expect(rule).toBeGreaterThanOrEqual(0);
    cases.push([x.endSource.sourceId, `json_set(snapshot_json,'$.execution.liveWork.handoffs[${custody}].cursor',null)`],
      [x.endSource.sourceId, `json_set(snapshot_json,'$.execution.liveWork.handoffs[${rule}].status','consumed')`]);
    for (const [sourceId, expression] of cases) {
      rehashSnapshot(x, sourceId, expression);
      expect(() => x.executions.read(sourceId), expression).toThrow(/snapshot/);
      expect(() => x.executions.accept(sourceId), expression).toThrow(/snapshot/);
      expect(heads(x), expression).toEqual(head);
      if (sourceId !== x.planSource.sourceId) expect(x.executions.read(x.planSource.sourceId), expression).toEqual(x.planned);
      restoreRows(x, 'batted_world_field_executions', before); expect(archive(x), expression).toEqual(before);
    }
    expectOriginals(x); expect(x.executions.accept(x.endSource.sourceId)).toEqual(confirmed);
  } finally { x.f.close(); }
});

it('bounds historical payload reads but checks every future ownership mirror and head in the entire prefix', () => {
  const x = fixture();
  try {
    const confirmed = expectConfirmed(x), before = archive(x), head = heads(x);
    const observation: AcceptedBattedWorldFieldExecution = { ...x.endSource, sourceId: 'after-capture-history', previousExecutionSourceId: x.endSource.sourceId,
      action: { kind: 'whole_play_history' } };
    x.sources.set(observation.sourceId, observation);
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='not-json',source_hash='changed',snapshot_json='not-json',snapshot_hash='changed' WHERE source_id=?").run(x.endSource.sourceId);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, x.authority));
    expect(reopened.read(x.planSource.sourceId)).toEqual(x.planned);
    expect(reopened.read(x.middleSource.sourceId)).toEqual(x.middle);
    expect(reopened.accept(x.middleSource.sourceId)).toEqual(x.middle);
    expect(() => reopened.read(x.endSource.sourceId)).toThrow(); expect(() => reopened.accept(observation.sourceId)).toThrow();
    expect(heads(x)).toEqual(head); expect(reopened.read(observation.sourceId)).toBeNull();
    restoreRows(x, 'batted_world_field_executions', before);
    for (const mutation of [
      "UPDATE batted_world_field_executions SET previous_source_id='foreign' WHERE source_id='wal-capture-confirmed';",
      "UPDATE batted_world_field_executions SET game_id='foreign' WHERE source_id='wal-capture-confirmed';",
      "UPDATE batted_world_field_executions SET physical_pitch_source_id='foreign' WHERE source_id='wal-capture-confirmed';",
      "UPDATE batted_world_field_executions SET base_field_source_id='foreign' WHERE source_id='wal-capture-confirmed';",
      "UPDATE batted_world_field_executions SET revision=revision+10 WHERE source_id='wal-capture-confirmed';",
      "UPDATE batted_world_field_execution_heads SET source_id='foreign';",
      'DELETE FROM batted_world_field_execution_heads;',
    ]) {
      // Deletion is restored separately so every case starts with the same complete head.
      x.f.db.exec(mutation);
      expect(() => reopened.read(x.planSource.sourceId), mutation).toThrow();
      expect(() => reopened.accept(x.middleSource.sourceId), mutation).toThrow();
      restoreRows(x, 'batted_world_field_executions', before);
      if (!heads(x).length) {
        const row = head[0], columns = Object.keys(row);
        x.f.db.prepare(`INSERT INTO batted_world_field_execution_heads (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map((column) => row[column]));
      } else restoreRows(x, 'batted_world_field_execution_heads', head);
      expect(archive(x), mutation).toEqual(before); expect(heads(x), mutation).toEqual(head);
    }
    expect(reopened.read(x.endSource.sourceId)).toEqual(confirmed);
    expect(reopened.accept(observation.sourceId).execution.kind).toBe('whole_play_history');
    expect(archive(x).slice(0, before.length)).toEqual(before);
  } finally { x.f.close(); }
});

it('finds hidden pending capture ownership through Source or snapshot and rejects restart and lower field append', () => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x), roots = dependencies(x);
    const restart: AcceptedBattedWorldFieldExecution = { ...x.planSource, sourceId: 'capture-restart', previousExecutionSourceId: null };
    const lower = { ...x.fieldSource, sourceId: 'lower-after-capture', previousFieldSourceId: x.baseField.source.sourceId,
      throughTick: x.baseField.field.motion.world.moment.ball.tick + 2000 };
    x.sources.set(restart.sourceId, restart); x.fieldSources.set(lower.sourceId, lower);
    for (const hiddenPayload of ["snapshot_json='invalid-hidden-snapshot'", "source_json='invalid-hidden-source'"]) {
      x.f.db.exec(`UPDATE batted_world_field_executions SET physical_pitch_source_id='foreign',base_field_source_id='foreign',${hiddenPayload};
        UPDATE batted_world_field_execution_heads SET physical_pitch_source_id='foreign',base_field_source_id='foreign';`);
      expect(() => x.executions.accept(restart.sourceId), hiddenPayload).toThrow(/prefix|metadata/);
      expect(() => assertNoBattedWorldFieldExecutionOwner(x.f.db, x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId), hiddenPayload)
        .toThrow(/owner|execution/);
      // The original candidate has no continuation cursor, so the lower owner
      // may reject its unresolved capture before reaching the ownership fence.
      expect(() => x.fields.accept(lower.sourceId), hiddenPayload).toThrow(/owner|execution|capture.*pending/);
      expect(dependencies(x), hiddenPayload).toEqual(roots);
      expect(x.executions.read(restart.sourceId), hiddenPayload).toBeNull();
      restoreRows(x, 'batted_world_field_executions', before); restoreRows(x, 'batted_world_field_execution_heads', head);
    }
    expectOriginals(x); expectConfirmed(x);
  } finally { x.f.close(); }
});

it('keeps original pending snapshots after legitimate Player recovery while rejecting a fresh stale confirmation', () => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x), rest = { sourceEventId: 'scheduled-capture-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest',
      careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    x.f.activities.set(rest.sourceEventId, rest); x.f.workload.apply(rest.sourceEventId, 0);
    expectOriginals(x); expect(x.executions.accept(x.planSource.sourceId)).toEqual(x.planned);
    expect(x.executions.accept(x.middleSource.sourceId)).toEqual(x.middle);
    x.executions.close();
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, x.authority));
    expect(reopened.read(x.middleSource.sourceId)).toEqual(x.middle);
    expect(() => reopened.accept(x.endSource.sourceId)).toThrow(/workload/);
    expect(reopened.read(x.endSource.sourceId)).toBeNull(); expect(archive(x)).toEqual(before); expect(heads(x)).toEqual(head);
  } finally { x.f.close(); }
});

it('owns pending custody and possession qualifiers through WAL, rehashed reads, confirmation and reopen', () => {
  const x = fixture('fence_pending');
  try {
    const baseSource: AcceptedBattedWorldFieldExecution = { ...x.middleSource, sourceId: 'capture-base-history', previousExecutionSourceId: x.middleSource.sourceId,
      action: { kind: 'base_touch_history', playerId: x.plan.acquirerPlayerId, base: 'first' } };
    x.sources.set(baseSource.sourceId, baseSource);
    const before = archive(x), head = heads(x), roots = dependencies(x);
    for (const expression of ["json_remove(snapshot_json,'$.execution.custodyEvidence')",
      "json_set(snapshot_json,'$.execution.custodyEvidence.status','confirmed_contacts_only')",
      "json_set(snapshot_json,'$.execution.custodyEvidence.pending',json('[]'))"]) {
      x.f.db.exec(`CREATE TRIGGER mutate_capture_qualifier AFTER INSERT ON batted_world_field_executions BEGIN
        UPDATE batted_world_field_executions SET snapshot_json=${expression} WHERE source_id=NEW.source_id; END`);
      expect(() => x.executions.accept(baseSource.sourceId), expression).toThrow();
      expect(archive(x), expression).toEqual(before); expect(heads(x), expression).toEqual(head); expect(dependencies(x), expression).toEqual(roots);
      expect(x.executions.read(baseSource.sourceId), expression).toBeNull(); x.f.db.exec('DROP TRIGGER mutate_capture_qualifier');
    }
    const base = x.executions.accept(baseSource.sourceId);
    if (base.execution.kind !== 'base_touch_history') throw new Error('fixture base history');
    expect(base.execution.controlledContacts).toEqual([]);
    expect(base.execution.custodyEvidence).toMatchObject({ status: 'bounded_unconfirmed', throughElapsedSeconds: x.middleProgress.world.moment.elapsedSeconds,
      pending: [{ planSourceId: x.planSource.sourceId, playerId: x.plan.acquirerPlayerId, phase: 'fence_pending', earliestPotentialControlElapsedSeconds: x.plan.secureElapsedSeconds }] });
    const raceSource: AcceptedBattedWorldFieldExecution = { ...baseSource, sourceId: 'capture-race', previousExecutionSourceId: baseSource.sourceId, action: { kind: 'first_base_race' } };
    x.sources.set(raceSource.sourceId, raceSource); const race = x.executions.accept(raceSource.sourceId);
    if (race.execution.kind !== 'first_base_race') throw new Error('fixture race');
    expect(race.execution.possessionEvidence).toMatchObject({ policy: 'scheduled_capture_confirmation_v1',
      pending: base.execution.custodyEvidence!.pending });
    const pendingArchive = archive(x), pendingHead = heads(x);
    const cases = [
      [baseSource.sourceId, "json_remove(snapshot_json,'$.execution.custodyEvidence')"],
      [baseSource.sourceId, "json_set(snapshot_json,'$.execution.custodyEvidence.pending[0].playerId','foreign')"],
      [raceSource.sourceId, "json_remove(snapshot_json,'$.execution.possessionEvidence')"],
      [raceSource.sourceId, "json_set(snapshot_json,'$.execution.possessionEvidence.pending',json('[]'))"],
      [raceSource.sourceId, "json_set(snapshot_json,'$.execution.possessionEvidence.pending[0].planSourceId','foreign')"],
      [raceSource.sourceId, "json_set(snapshot_json,'$.execution.possessionEvidence.pending[0].earliestPotentialControlElapsedSeconds',0)"],
      [raceSource.sourceId, "json_set(snapshot_json,'$.execution.possessionEvidence.originTick',0)"],
      [raceSource.sourceId, "json_set(snapshot_json,'$.execution.possessionEvidence.throughElapsedSeconds',1000000)"],
      [raceSource.sourceId, "json_remove(snapshot_json,'$.execution.possessionGuard')"],
    ];
    for (const [sourceId, expression] of cases) {
      rehashSnapshot(x, sourceId, expression);
      expect(() => x.executions.read(sourceId), expression).toThrow(/snapshot/);
      expect(() => x.executions.accept(sourceId), expression).toThrow(/snapshot/);
      expect(x.executions.read(x.middleSource.sourceId), expression).toEqual(x.middle); expect(heads(x), expression).toEqual(pendingHead);
      restoreRows(x, 'batted_world_field_executions', pendingArchive); expect(archive(x), expression).toEqual(pendingArchive);
    }
    const endSource = { ...x.endSource, previousExecutionSourceId: raceSource.sourceId };
    x.sources.set(endSource.sourceId, endSource);
    const confirmed = expectConfirmed({ ...x, endSource });
    expect(archive(x).slice(0, pendingArchive.length)).toEqual(pendingArchive);
    x.executions.close();
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, x.authority));
    expect(reopened.read(baseSource.sourceId)).toEqual(base); expect(reopened.accept(raceSource.sourceId)).toEqual(race);
    expect(reopened.accept(endSource.sourceId)).toEqual(confirmed);
    expect(archive(x).slice(0, pendingArchive.length)).toEqual(pendingArchive);
  } finally { x.f.close(); }
});
