import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createHumanControlState, changeHumanControl } from '../../core/world/control/HumanControl';
import { acceptEmotionExecution } from '../../core/world/psychology/execution/ExecutionAcceptance';
import type { EmotionExecutionAcceptance } from '../../core/world/psychology/execution/ExecutionTypes';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText, samePaFields } from './SamePlateAppearanceWorkPrefix';
import type { DurableWorldControlHead } from './SqliteWorldControlStore';

export type EmotionWorldRevision = Readonly<{ head: DurableWorldControlHead; controlJson: string }>;
const fail = (detail: string): never => { throw new Error('emotion actual World ' + detail); };
const same = (left: unknown, right: unknown) => { if (json(left) !== json(right)) fail('revision or original bytes differ'); };
const revision = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
// These are the existing normal World owner's two schemas, not new emotion tables.
const schemas = {
  world_control_heads: 'CREATE TABLE world_control_heads(career_id TEXT PRIMARY KEY,world_revision INTEGER NOT NULL,control_revision INTEGER NOT NULL,control_json TEXT NOT NULL,CHECK(world_revision>=0),CHECK(control_revision>=0))',
  world_decision_revision_events: 'CREATE TABLE world_decision_revision_events(career_id TEXT NOT NULL,world_revision INTEGER NOT NULL,source_kind TEXT NOT NULL,source_event_id TEXT NOT NULL,event_json TEXT NOT NULL,PRIMARY KEY(career_id,world_revision),UNIQUE(career_id,source_event_id))',
} as const;
const normalized = (sql: unknown) => String(sql).replace(/\s+/g, '').replace(/;$/, '');
const namespace = (db: DatabaseSync): boolean => {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  if (!(db instanceof Native) || !db.isTransaction) fail('requires an owned Native transaction');
  assertBodyCompositionNativeConnection(db);
  const rows = db.prepare("SELECT type,name,tbl_name,sql FROM main.sqlite_master WHERE lower(name) GLOB 'world_control_heads*' OR lower(name) GLOB 'world_decision_revision_events*' OR lower(tbl_name) IN ('world_control_heads','world_decision_revision_events')").all();
  if (!rows.length) return false;
  const expected = new Set<string>();
  for (const [name, sql] of Object.entries(schemas)) {
    const table = rows.filter(r => r.name === name);
    if (table.length !== 1 || table[0].type !== 'table' || table[0].tbl_name !== name || normalized(table[0].sql) !== normalized(sql)) fail('namespace is partial or malformed');
    expected.add(name);
    const keys = name === 'world_control_heads' ? [['career_id']] : [['career_id', 'world_revision'], ['career_id', 'source_event_id']];
    const indexes = db.prepare(`PRAGMA main.index_list(${name})`).all();
    if (indexes.length !== keys.length) fail('indexes differ');
    keys.forEach((columns, i) => {
      const indexName = `sqlite_autoindex_${name}_${i + 1}`, found = indexes.filter(r => r.name === indexName), catalog = rows.filter(r => r.name === indexName);
      if (found.length !== 1 || found[0].unique !== 1 || found[0].partial !== 0 || found[0].origin !== (i === 0 ? 'pk' : 'u')
        || catalog.length !== 1 || catalog[0].type !== 'index' || catalog[0].sql !== null || catalog[0].tbl_name !== name) fail('index ownership differs');
      const info = db.prepare(`PRAGMA main.index_xinfo(${indexName})`).all();
      same(info.filter(r => r.key === 1).map(r => r.name), columns);
      if (info.length !== columns.length + 1 || info.some(r => r.coll !== 'BINARY' || r.desc !== 0) || info.at(-1)?.cid !== -1) fail('index columns differ');
      expected.add(indexName);
    });
  }
  if (rows.length !== expected.size || rows.some(r => !expected.has(String(r.name)))) fail('namespace has additional claims');
  return true;
};
const counters = (db: DatabaseSync) => ({ changes: Number(db.prepare('SELECT total_changes() n').get()!.n),
  main: db.prepare('PRAGMA main.schema_version').get()!.schema_version, temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version });

/** Read only the actual normal World decision head and its contiguous revision
 * extent. Other event payloads remain opaque. This reader never bootstraps it. */
export const readEmotionWorldRevisionFromSqlite = (db: DatabaseSync, careerId: string): EmotionWorldRevision | null => {
  if (!samePaText(careerId) || db.prepare('PRAGMA query_only').get()!.query_only !== 1) return fail('requires a read-only proof');
  const before = counters(db);
  if (!namespace(db)) return null;
  const rows = db.prepare('SELECT * FROM main.world_control_heads WHERE career_id=?').all(careerId);
  const events = db.prepare('SELECT career_id,world_revision,source_kind,source_event_id FROM main.world_decision_revision_events WHERE career_id=? ORDER BY world_revision').all(careerId);
  if (rows.length === 0) { if (events.length) fail('orphan revision events'); same(counters(db), before); return null; }
  if (rows.length !== 1) return fail('head identity differs');
  const row = rows[0], control = createHumanControlState(JSON.parse(String(row.control_json)));
  if (!revision(row.world_revision) || row.control_revision !== control.revision || JSON.stringify(control) !== row.control_json
    || events.length !== row.world_revision || events.some((event, i) => event.career_id !== careerId || event.world_revision !== i + 1
      || !samePaText(event.source_kind) || !samePaText(event.source_event_id))) return fail('head or revision extent corrupt');
  same(counters(db), before);
  return freeze({ head: { careerId, worldRevision: row.world_revision, control }, controlJson: String(row.control_json) });
};

/** Historical decision-cut replay. Only CONTROL_CHANGE owns control changes;
 * other revision event payloads stay opaque. Replaying Core's exact control
 * events backwards recovers the earlier bytes without treating the current
 * control overlay as the original emotion frame. */
export const readHistoricalEmotionWorldRevisionFromSqlite = (db: DatabaseSync, careerId: string, atRevision: number): EmotionWorldRevision | null => {
  if (!revision(atRevision)) return fail('invalid historical revision');
  const current = readEmotionWorldRevisionFromSqlite(db, careerId); if (!current) return null;
  if (atRevision > current.head.worldRevision) return fail('historical revision is beyond actual World head');
  const events = db.prepare("SELECT * FROM main.world_decision_revision_events WHERE career_id=? AND source_kind='CONTROL_CHANGE' ORDER BY world_revision DESC").all(careerId);
  if (events.length !== current.head.control.revision) return fail('control event extent differs');
  let control = current.head.control, selected = atRevision === current.head.worldRevision ? control : null;
  for (const row of events) {
    if (Number(row.world_revision) <= atRevision && selected === null) selected = control;
    const event = JSON.parse(String(row.event_json));
    if (!samePaFields(event, ['kind', 'controllerId', 'fromRevision', 'toRevision', 'previousClubId', 'controlledClubId', 'previousManualDomainIds', 'manualDomainIds'])
      || event.kind !== 'HUMAN_CONTROL_CHANGED' || event.controllerId !== control.controllerId || event.toRevision !== control.revision
      || row.source_event_id !== `control:${careerId}:${event.toRevision}`) return fail('historical control identity differs');
    const before = createHumanControlState({ ...control, revision: event.fromRevision, controlledClubId: event.previousClubId, manualDomainIds: event.previousManualDomainIds });
    const replay = changeHumanControl(before, { expectedRevision: before.revision, controlledClubId: event.controlledClubId, manualDomainIds: event.manualDomainIds });
    if (!replay.ok || replay.events.length !== 1 || JSON.stringify(replay.events[0]) !== row.event_json) return fail('historical control event differs');
    same(replay.state, control); control = before;
  }
  if (control.revision !== 0) return fail('historical control origin differs');
  selected ??= control;
  return freeze({ head: { careerId, worldRevision: atRevision, control: selected }, controlJson: JSON.stringify(selected) });
};

/** Internal effect within the emotion owner's transaction. The owning producer
 * authenticates original factual inputs and persists its complete acceptance in
 * that same transaction. This helper grants no authority to supplied Core data,
 * performs no bootstrap/commit, and cannot substitute a projected revision. */
export const appendEmotionWorldRevisionFromSqlite = (db: DatabaseSync, rawBefore: EmotionWorldRevision, rawAcceptance: EmotionExecutionAcceptance): EmotionWorldRevision => {
  const before = cloneInert(rawBefore), accepted = cloneInert(rawAcceptance);
  if (!samePaFields(before, ['head', 'controlJson']) || !db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0) return fail('CAS requires owned writable transaction');
  const recomputed = acceptEmotionExecution(accepted.proposal.request, accepted.proposal);
  if (!recomputed.ok) return fail('Core acceptance differs');
  same(recomputed.value, accepted);
  if (accepted.expectedFrame.scope.careerId !== before.head.careerId || accepted.expectedFrame.worldRevision !== before.head.worldRevision
    || accepted.afterWorldRevision !== before.head.worldRevision + 1) return fail('CAS expected frame differs');
  const read = () => { db.exec('PRAGMA query_only=1'); try { return readEmotionWorldRevisionFromSqlite(db, before.head.careerId); } finally { db.exec('PRAGMA query_only=0'); } };
  same(read(), before);
  if (db.prepare('SELECT 1 FROM main.world_decision_revision_events WHERE career_id=? AND source_event_id=?').get(before.head.careerId, accepted.executionId)) return fail('execution identity already consumed');
  const marker = 'emotion_world_' + randomUUID().replaceAll('-', ''), original = counters(db);
  db.exec('SAVEPOINT ' + marker);
  const identity = () => { if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 0) fail('CAS transaction changed'); db.exec('RELEASE ' + marker); db.exec('SAVEPOINT ' + marker); };
  try {
    const event = { kind: 'EMOTION_EXECUTION' as const, executionId: accepted.executionId, expectedFrame: accepted.expectedFrame,
      afterWorldRevision: accepted.afterWorldRevision, beforeEmotionRevision: accepted.beforeEmotionRevision, afterEmotionRevision: accepted.afterEmotionRevision,
      acceptanceHash: hash(accepted) };
    const changed = db.prepare('UPDATE main.world_control_heads SET world_revision=? WHERE career_id=? AND world_revision=? AND control_revision=? AND control_json=?')
      .run(accepted.afterWorldRevision, before.head.careerId, before.head.worldRevision, before.head.control.revision, before.controlJson);
    if (changed.changes !== 1) fail('stale revision CAS'); identity();
    same(counters(db), { ...original, changes: original.changes + 1 });
    const inserted = db.prepare('INSERT INTO main.world_decision_revision_events(career_id,world_revision,source_kind,source_event_id,event_json) VALUES(?,?,?,?,?)')
      .run(before.head.careerId, accepted.afterWorldRevision, 'EMOTION_EXECUTION', accepted.executionId, json(event));
    if (inserted.changes !== 1) fail('event append differs'); identity();
    same(counters(db), { ...original, changes: original.changes + 2 });
    const after = read();
    same(after, { head: { ...before.head, worldRevision: accepted.afterWorldRevision }, controlJson: before.controlJson });
    same(db.prepare('SELECT event_json FROM main.world_decision_revision_events WHERE career_id=? AND world_revision=?').get(before.head.careerId, accepted.afterWorldRevision)!.event_json, json(event));
    identity(); db.exec('RELEASE ' + marker); return after!;
  } catch (cause) {
    // The enclosing owner must roll back the whole acceptance. If a foreign
    // COMMIT removed our marker, retirement is mandatory and no repair occurs.
    try { db.exec('ROLLBACK TO ' + marker); db.exec('RELEASE ' + marker); }
    catch (cleanup) { throw new AggregateError([cause, cleanup], 'emotion World transaction uncertain; owning connection must retire'); }
    throw cause;
  }
};
