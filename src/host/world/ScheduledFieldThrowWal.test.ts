import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

const directories: string[] = [];
const path = () => {
  const directory = mkdtempSync(join(tmpdir(), 'scheduled-field-throw-wal-'));
  directories.push(directory); return join(directory, 'state.sqlite');
};
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`) || !basename(target).startsWith('scheduled-field-throw-wal-')) {
      throw new Error('scheduled throw WAL cleanup escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const fixture = () => {
  const x = battedWorldFieldThrowFixture(path());
  if (x.source.action.kind !== 'throw') throw new Error('fixture throw');
  const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'wal-throw-plan',
    action: { ...x.source.action, kind: 'throw_plan' } };
  x.sources.set(planSource.sourceId, planSource);
  const plan = x.executions.accept(planSource.sourceId);
  if (plan.execution.kind !== 'throw_plan') throw new Error('fixture plan');
  const start = plan.execution.plan.input.cursor.moment.elapsedSeconds, due = plan.execution.plan.releaseElapsedSeconds;
  const middleSource: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'wal-throw-middle', previousExecutionSourceId: planSource.sourceId,
    action: { kind: 'throw_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: (start + due) / 2 } };
  x.sources.set(middleSource.sourceId, middleSource);
  const middle = x.executions.accept(middleSource.sourceId);
  if (middle.execution.kind !== 'throw_advance' || middle.execution.progress.kind !== 'transfer') throw new Error('fixture pending transfer');
  const releaseSource: AcceptedBattedWorldFieldExecution = { ...middleSource, sourceId: 'wal-throw-release', previousExecutionSourceId: middleSource.sourceId,
    action: { kind: 'throw_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: due + 0.001 } };
  x.sources.set(releaseSource.sourceId, releaseSource);
  return { ...x, planSource, plan, middleSource, middle, releaseSource, due };
};
type Fixture = ReturnType<typeof fixture>;
const archive = (x: Fixture) => x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
const heads = (x: Fixture) => x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
const restoreRows = (x: Fixture, table: string, rows: ReturnType<typeof archive>) => {
  for (const [index, row] of rows.entries()) {
    const columns = Object.keys(row);
    x.f.db.prepare(`UPDATE ${table} SET ${columns.map((column) => `${column}=?`).join(',')} WHERE rowid=(SELECT rowid FROM ${table} ORDER BY rowid LIMIT 1 OFFSET ?)`)
      .run(...columns.map((column) => row[column]), index);
  }
};
const dependencyArchive = (x: Fixture) => [
  'physical_pitch_progress_actions', 'physical_pitch_progress_heads', 'world_player_person_links', 'world_player_fielding_models',
  'world_player_workload_heads', 'batted_world_field_geometries', 'batted_world_field_actions',
].map((table) => x.f.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
const expectOriginals = (x: Fixture, label?: string) => {
  expect(x.executions.read(x.planSource.sourceId), label).toEqual(x.plan);
  expect(x.executions.read(x.middleSource.sourceId), label).toEqual(x.middle);
  expect(x.fielding.read(x.model.source.sourceId), label).toEqual(x.model);
  expect(x.fields.read(x.baseField.source.sourceId), label).toEqual(x.baseField);
};
const expectRelease = (x: Fixture) => {
  const released = x.executions.accept(x.releaseSource.sourceId);
  if (released.execution.kind !== 'throw_advance' || released.execution.progress.kind !== 'released') throw new Error('missing release after retry');
  expect(released.execution.progress.transfer).toEqual(x.plan.execution.kind === 'throw_plan' ? x.plan.execution.plan.transfer : null);
  expect(released.execution.field.motion.world.moment.elapsedSeconds).toBe(x.due);
  expect(released.execution.field.motion.carrierPlayerId).toBeNull();
  expect(released.execution.field.motion.cursor).toEqual(released.execution.progress.releaseCursor);
  expect(x.executions.accept(x.releaseSource.sourceId)).toEqual(released);
  return released;
};

const lateMutations = [
  ['original model Source', "UPDATE world_player_fielding_models SET source_hash='changed';"],
  ['original model snapshot', "UPDATE world_player_fielding_models SET snapshot_hash='changed';"],
  ['original model Person binding', "UPDATE world_player_fielding_models SET person_link_source_id='changed';"],
  ['original model removal', 'DELETE FROM world_player_fielding_models;'],
  ['original Person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['original geometry', "UPDATE batted_world_field_geometries SET snapshot_hash='changed';"],
  ['original field', "UPDATE batted_world_field_actions SET source_hash='changed';"],
  ['original physical pitch', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['original pitch head', 'UPDATE physical_pitch_progress_heads SET progress_revision=progress_revision+1;'],
  ['current Player workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['admitted plan Source', "UPDATE batted_world_field_executions SET source_hash='changed' WHERE source_id='wal-throw-plan';"],
  ['admitted release timing', "UPDATE batted_world_field_executions SET snapshot_json=json_set(snapshot_json,'$.execution.plan.releaseElapsedSeconds',1000000) WHERE source_id='wal-throw-plan';"],
  ['previous transfer snapshot', "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id='wal-throw-middle';"],
  ['inserted progress Source', "UPDATE batted_world_field_executions SET source_hash='changed' WHERE source_id=NEW.source_id;"],
  ['inserted progress ownership', "UPDATE batted_world_field_executions SET base_field_source_id='changed' WHERE source_id=NEW.source_id;"],
  ['inserted progress snapshot', "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id=NEW.source_id;"],
  ['inserted release cursor', "UPDATE batted_world_field_executions SET snapshot_json=json_remove(snapshot_json,'$.execution.progress.releaseCursor') WHERE source_id=NEW.source_id;"],
] as const;
it('rolls back every late pending-throw mutation atomically without rewriting the original archive', () => {
  const x = fixture();
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    const before = archive(x), head = heads(x), dependencies = dependencyArchive(x);
    for (const [name, mutation] of lateMutations) {
      x.f.db.exec(`CREATE TRIGGER mutate_scheduled_throw AFTER INSERT ON batted_world_field_executions BEGIN ${mutation} END`);
      expect(() => x.executions.accept(x.releaseSource.sourceId), name).toThrow();
      expect(archive(x), name).toEqual(before); expect(heads(x), name).toEqual(head);
      expect(dependencyArchive(x), name).toEqual(dependencies);
      expect(x.executions.read(x.releaseSource.sourceId), name).toBeNull();
      expect(x.f.db.prepare("SELECT count(*) AS n FROM batted_world_field_executions WHERE json_extract(snapshot_json,'$.execution.liveWork.source.completion') IS NOT NULL").get(), name).toEqual({ n: 0 });
      expectOriginals(x, name);
      x.f.db.exec('DROP TRIGGER mutate_scheduled_throw');
    }
    expectRelease(x);
    expect(archive(x).slice(0, before.length)).toEqual(before);
  } finally { x.f.close(); }
});

it('rolls back the inserted release and its receipts when the final head update is corrupted', () => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x);
    x.f.db.exec('CREATE TRIGGER mutate_scheduled_head AFTER UPDATE ON batted_world_field_execution_heads BEGIN UPDATE batted_world_field_execution_heads SET revision=revision+1; END');
    expect(() => x.executions.accept(x.releaseSource.sourceId)).toThrow();
    expect(archive(x)).toEqual(before); expect(heads(x)).toEqual(head);
    expect(x.executions.read(x.releaseSource.sourceId)).toBeNull(); expectOriginals(x);
    x.f.db.exec('DROP TRIGGER mutate_scheduled_head'); expectRelease(x);
  } finally { x.f.close(); }
});

it.each([
  ['model', "UPDATE world_player_fielding_models SET snapshot_hash='changed';", 'world_player_fielding_models'],
  ['plan', "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id='wal-throw-plan';", 'batted_world_field_executions'],
  ['pitch head', 'UPDATE physical_pitch_progress_heads SET progress_revision=progress_revision+1;', 'physical_pitch_progress_heads'],
])('does not let a cached peer field bless a changed %s before release', (_name, mutation, table) => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x), original = x.f.db.prepare(`SELECT * FROM ${table}`).all();
    const store = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, { read() { x.f.db.exec(mutation); return x.baseField; } }, x.authority));
    expect(() => store.accept(x.releaseSource.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT source_id FROM batted_world_field_executions WHERE source_id=?').get(x.releaseSource.sourceId)).toBeUndefined();
    expect(heads(x)).toEqual(head);
    restoreRows(x, table, original);
    expect(archive(x)).toEqual(before); expectOriginals(x); expectRelease(x);
  } finally { x.f.close(); }
});

it('rechecks the original plan after an identical release retry authority callback changes it', () => {
  const x = fixture();
  try {
    const released = expectRelease(x), before = archive(x), head = heads(x);
    const original = x.f.db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(x.planSource.sourceId)!;
    const store = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, { readAcceptedExecution() {
      x.f.db.exec("UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id='wal-throw-plan'"); return x.releaseSource;
    } }));
    expect(() => store.accept(x.releaseSource.sourceId)).toThrow();
    expect(heads(x)).toEqual(head);
    x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(original.snapshot_json, original.snapshot_hash, x.planSource.sourceId);
    expect(archive(x)).toEqual(before); expect(x.executions.accept(x.releaseSource.sourceId)).toEqual(released);
  } finally { x.f.close(); }
});

it('bounds historical plan and transfer replay before corrupt future release payloads while fencing fresh appends', () => {
  const x = fixture();
  try {
    const released = expectRelease(x), before = archive(x), head = heads(x);
    const original = x.f.db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(x.releaseSource.sourceId)!;
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='not-json',source_hash='changed',snapshot_json='not-json',snapshot_hash='changed' WHERE source_id=?").run(x.releaseSource.sourceId);
    expect(x.executions.read(x.planSource.sourceId)).toEqual(x.plan);
    expect(x.executions.accept(x.middleSource.sourceId)).toEqual(x.middle);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, x.authority));
    expect(reopened.read(x.middleSource.sourceId)).toEqual(x.middle);
    expect(() => reopened.read(x.releaseSource.sourceId)).toThrow();
    const observation: AcceptedBattedWorldFieldExecution = { ...x.releaseSource, sourceId: 'after-corrupt-release', previousExecutionSourceId: x.releaseSource.sourceId,
      action: { kind: 'whole_play_history' } };
    x.sources.set(observation.sourceId, observation); expect(() => reopened.accept(observation.sourceId)).toThrow();
    expect(heads(x)).toEqual(head);
    x.f.db.prepare('UPDATE batted_world_field_executions SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(original.source_json, original.source_hash, original.snapshot_json, original.snapshot_hash, x.releaseSource.sourceId);
    expect(archive(x)).toEqual(before); expect(reopened.read(x.releaseSource.sourceId)).toEqual(released);
    expect(reopened.accept(observation.sourceId).execution.kind).toBe('whole_play_history');
  } finally { x.f.close(); }
});

it.each([
  ['predecessor', "UPDATE batted_world_field_executions SET previous_source_id='foreign' WHERE source_id='wal-throw-release';"],
  ['game', "UPDATE batted_world_field_executions SET game_id='foreign' WHERE source_id='wal-throw-release';"],
  ['physical pitch', "UPDATE batted_world_field_executions SET physical_pitch_source_id='foreign' WHERE source_id='wal-throw-release';"],
  ['revision', "UPDATE batted_world_field_executions SET revision=revision+10 WHERE source_id='wal-throw-release';"],
  ['head', "UPDATE batted_world_field_execution_heads SET source_id='foreign';"],
])('rejects corrupt future %s metadata even on bounded pending-plan reads', (_name, mutation) => {
  const x = fixture();
  try {
    const released = expectRelease(x), before = archive(x), head = heads(x);
    x.f.db.exec(mutation);
    expect(() => x.executions.read(x.planSource.sourceId)).toThrow();
    expect(() => x.executions.accept(x.middleSource.sourceId)).toThrow();
    restoreRows(x, 'batted_world_field_executions', before); restoreRows(x, 'batted_world_field_execution_heads', head);
    expect(archive(x)).toEqual(before); expect(heads(x)).toEqual(head);
    expectOriginals(x); expect(x.executions.accept(x.releaseSource.sourceId)).toEqual(released);
  } finally { x.f.close(); }
});

it('retains original pending reads after legitimate Player recovery but rejects a fresh advance', () => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x);
    const rest = { sourceEventId: 'scheduled-throw-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest',
      careerId: x.actor.binding.careerId, playerId: x.actor.binding.playerId, atDay: x.actor.binding.gameDay + 1,
      kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    x.f.activities.set(rest.sourceEventId, rest); x.f.workload.apply(rest.sourceEventId, 0);
    expectOriginals(x);
    expect(x.executions.accept(x.planSource.sourceId)).toEqual(x.plan);
    expect(x.executions.accept(x.middleSource.sourceId)).toEqual(x.middle);
    x.executions.close();
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, x.authority));
    expect(reopened.read(x.planSource.sourceId)).toEqual(x.plan);
    expect(reopened.read(x.middleSource.sourceId)).toEqual(x.middle);
    expect(() => reopened.accept(x.releaseSource.sourceId)).toThrow(/workload/);
    expect(reopened.read(x.releaseSource.sourceId)).toBeNull(); expect(archive(x)).toEqual(before); expect(heads(x)).toEqual(head);
  } finally { x.f.close(); }
});

it('rejects a rehashed original model replacement without rewriting the pending archive', () => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x), changedSource = { ...x.model.source,
      transferParameters: { ...x.model.source.transferParameters, fixedGripOffsetTicks: x.model.source.transferParameters.fixedGripOffsetTicks + 1 } };
    const changed = { ...x.model, source: changedSource };
    x.f.db.prepare('UPDATE world_player_fielding_models SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(actorJson(changedSource), actorHash(changedSource), actorJson(changed), actorHash(changed), x.model.source.sourceId);
    expect(x.fielding.read(x.model.source.sourceId)).toEqual(changed);
    expect(() => x.executions.read(x.planSource.sourceId)).toThrow(/snapshot/);
    expect(() => x.executions.accept(x.releaseSource.sourceId)).toThrow(/snapshot/);
    expect(archive(x)).toEqual(before); expect(heads(x)).toEqual(head);
    x.f.db.prepare('UPDATE world_player_fielding_models SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(actorJson(x.model.source), actorHash(x.model.source), actorJson(x.model), actorHash(x.model), x.model.source.sourceId);
    expectOriginals(x); expectRelease(x);
  } finally { x.f.close(); }
});

it('atomically rejects late consumed-receipt and successor-handoff corruption, then commits their matching actual cursor together', () => {
  const x = fixture();
  try {
    const before = archive(x), head = heads(x);
    for (const mutation of [
      "json_remove(snapshot_json,'$.execution.liveWork.receipts[0].cursor')",
      "json_set(snapshot_json,'$.execution.liveWork.receipts[0].eventId','foreign-release')",
      "json_set(snapshot_json,'$.execution.liveWork.handoff',null)",
      "json_set(snapshot_json,'$.execution.liveWork.handoff.cursor',null)",
      "json_remove(snapshot_json,'$.execution.liveWork.handoff.field')",
      "json_set(snapshot_json,'$.execution.liveWork.handoff.basisEventId','foreign-release')",
    ]) {
      x.f.db.exec(`CREATE TRIGGER mutate_scheduled_receipt AFTER INSERT ON batted_world_field_executions BEGIN
        UPDATE batted_world_field_executions SET snapshot_json=${mutation} WHERE source_id=NEW.source_id; END`);
      expect(() => x.executions.accept(x.releaseSource.sourceId)).toThrow();
      expect(archive(x)).toEqual(before); expect(heads(x)).toEqual(head);
      expect(x.f.db.prepare("SELECT count(*) AS n FROM batted_world_field_executions WHERE json_extract(snapshot_json,'$.execution.liveWork.source.completion') IS NOT NULL").get()).toEqual({ n: 0 });
      x.f.db.exec('DROP TRIGGER mutate_scheduled_receipt');
    }
    expectOriginals(x);
    const released = expectRelease(x);
    if (released.execution.kind !== 'throw_advance' || released.execution.progress.kind !== 'released') throw new Error('fixture release');
    const live = released.execution.liveWork, receipt = live.receipts[0];
    expect(live.receipts).toHaveLength(1);
    expect(receipt).toMatchObject({ kind: 'throw_released', status: 'consumed', cursor: released.execution.progress.releaseCursor });
    expect(live.source.completion).toEqual({ completedAtTick: receipt.adoptedAtTick, basisEventId: receipt.eventId });
    expect(live.handoff).toMatchObject({ fromSourceId: live.source.sourceId, basisEventId: receipt.eventId,
      cursor: released.execution.field.motion.cursor, field: released.execution.field });
    expect(live.handoff!.source.sourceId).toBe(live.handoff!.toSourceId);
    expect(live.handoff!.source.physical.length).toBeGreaterThan(0);
    expect(live.handoff!.source.completion).toBeUndefined();
    expect(archive(x).slice(0, before.length)).toEqual(before);
  } finally { x.f.close(); }
});

it('rederives saved release receipts and handoff payloads even when a corrupt snapshot is canonically rehashed', () => {
  const x = fixture();
  try {
    const released = expectRelease(x), before = archive(x), head = heads(x);
    if (released.execution.kind !== 'throw_advance') throw new Error('fixture release');
    const live = released.execution.liveWork;
    for (const changedLive of [
      { ...live, receipts: [] },
      { ...live, handoff: null },
      { ...live, handoff: { ...live.handoff!, cursor: null } },
      { ...live, handoff: { ...live.handoff!, field: x.middle.execution.field } },
    ]) {
      const changed = { ...released, execution: { ...released.execution, liveWork: changedLive } };
      x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
        .run(actorJson(changed), actorHash(changed), released.source.sourceId);
      expect(() => x.executions.read(released.source.sourceId)).toThrow(/snapshot/);
      expect(() => x.executions.accept(released.source.sourceId)).toThrow(/snapshot/);
      expect(x.executions.read(x.middleSource.sourceId)).toEqual(x.middle);
      expect(heads(x)).toEqual(head);
    }
    x.f.db.prepare('UPDATE batted_world_field_executions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(actorJson(released), actorHash(released), released.source.sourceId);
    expect(archive(x)).toEqual(before); expect(x.executions.accept(released.source.sourceId)).toEqual(released);
  } finally { x.f.close(); }
});
