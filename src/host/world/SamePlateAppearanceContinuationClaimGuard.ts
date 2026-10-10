import { sqliteMetadataAll } from './SqliteMetadataStatementScope';
import { readSamePaLifecycleClaimRows } from './SamePlateAppearanceLifecycleClaimGuard';
import { createRequire } from 'node:module';
import { memoSamePaContinuationRead, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { samePaPlayerClaimCanProceed } from './SamePlateAppearanceSettlementAdmission';
import { assertSamePaTakeSuccessorStorage } from './SamePlateAppearanceTakeSuccessorStorage';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaEnrollmentRow, authenticateSamePaRow, samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { assertSamePaContinuationStorage } from './SamePlateAppearanceContinuationStorage';
import { samePaContinuationSourceInput, samePaContinuationTables, samePaContinuationKind } from './SamePlateAppearanceContinuation';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
type Db = Pick<DatabaseSync, 'prepare'>;
const prefixes = ['pa_take_successor_v1_*', 'pa_continuation_v1_*', 'batting_observation_v1_*', 'batting_prediction_v1_*', 'batting_score_v1_*', 'batting_emotion_v1_*', 'batting_emotion_execution_v1_*', 'batting_execution_v1_*'];
const fail = (): never => { throw new Error('same-PA continuation or batting claim blocks work or has missing original ownership'); };
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail(); };
const rootOwners = new Set(['pa_take_successor_v1_action_plans', 'pa_take_successor_v1_setups', 'pa_take_successor_v1_consumer_actions', 'pa_take_successor_v1_pitch_actions', 'pa_take_successor_v1_consumptions', 'pa_take_successor_v1_episode_admissions', 'physical_plate_appearance_actors', 'batting_execution_v1_intents', 'batting_execution_v1_inputs', 'batting_observation_v1_postures', 'batting_observation_v1_observations', 'batting_observation_v1_deliveries', 'batting_prediction_v1_predictions', 'batting_score_v1_assessments', 'batting_emotion_v1_geneses', 'batting_emotion_execution_v1_executions', 'batting_execution_v1_executions', 'same_pa_enrollments', 'reserved_pa_work_prefixes', 'reserved_pa_total_assessments', 'reserved_pa_execution_views',
  'pa_dispatch_v1_action_plans', 'pa_dispatch_v1_execution_calibrations', 'pa_dispatch_v1_consumer_sets', 'pa_dispatch_v1_episodes', 'pa_dispatch_v1_rights',
  'pa_dispatch_v1_pitch_actions', 'pa_dispatch_v1_consumer_actions', 'pa_continuation_v1_work_prefixes', 'pa_continuation_v1_total_assessments', 'pa_continuation_v1_execution_views', 'pa_continuation_v1_execution_calibrations']);
/** Only typed original root/reference metadata is followed. A shared Player or
 * baseline is never a causal game/play link. This guard owns no replay waiver. */
const inspectClaims = (db: Db) => {
  assertSamePaContinuationStorage(db); assertSamePaTakeSuccessorStorage(db);
  const predicate = prefixes.map(() => '(lower(name) GLOB ? OR lower(tbl_name) GLOB ?)').join(' OR '), args = prefixes.flatMap(p => [p, p]);
  if (db.prepare('SELECT 1 FROM temp.sqlite_master WHERE ' + predicate).get(...args)) fail();
  const catalog = db.prepare('SELECT type,name,tbl_name FROM main.sqlite_master WHERE ' + predicate).all(...args);
  if (catalog.some(r => r.type !== 'table' && r.type !== 'index')) fail();
  const lifecycle=readSamePaLifecycleClaimRows(db);
  const records = catalog.filter(r => r.type === 'table').flatMap(t => db.prepare('SELECT * FROM main."' + String(t.name).replaceAll('"', '""') + '"').all()
    .map(row => ({ table: String(t.name), row })));
  const roots = new Map<string, ReturnType<typeof authenticateSamePaRow>>();
  const root = (id: string) => { let value = roots.get(id); if (!value) { const row = samePaEnrollmentRow(db, id); if (!row) fail(); value = authenticateSamePaRow(db, row!); roots.set(id, value); } return value; };
  const metadata = (row: Record<string, unknown>, path: Parameters<typeof nodes>[1]) => ['source_json', 'snapshot_json'].filter(c => c in row).flatMap(c =>
    sqliteMetadataAll(db, `SELECT atom FROM (${nodes('$document', path)}) WHERE type='text'`, String(row[c])).map(r => String(r.atom)));
  const refs = (row: Record<string, unknown>) => ['source_json', 'snapshot_json'].filter(c => c in row).flatMap(c => sqliteMetadataAll(db, `SELECT o.atom owner,i.atom sourceId
    FROM json_tree(CASE WHEN json_valid($document) THEN $document ELSE 'null' END) obj,json_each(CASE WHEN obj.type='object' THEN obj.value ELSE '{}' END) o,
    json_each(CASE WHEN obj.type='object' THEN obj.value ELSE '{}' END) i WHERE o.key='owner' AND o.type='text' AND i.key='sourceId' AND i.type='text'`, String(row[c])).map(r => ({ owner: String(r.owner), sourceId: String(r.sourceId) })));
  const resolvedRefs = new Map<string, string[]>();
  const fromRef = (ref: { owner: string; sourceId: string }, active = new Set<string>()): string[] => {
    if (!rootOwners.has(ref.owner)) return [];
    if (ref.owner === 'same_pa_enrollments') { root(ref.sourceId); return [ref.sourceId]; }
    const key = ref.owner + ':' + ref.sourceId; if (active.has(key)) fail();
    const prior = resolvedRefs.get(key); if (prior) return prior; active.add(key);
    if (ref.owner === 'physical_plate_appearance_actors') {
      try {
        const rows = db.prepare(`SELECT source_id FROM main.same_pa_enrollments WHERE actor_source_id=$id OR ${claim('source_json', ['actorReference', 'sourceId'], '$id')}
          OR ${claim('snapshot_json', ['source', 'actorReference', 'sourceId'], '$id')}`).all({ id: ref.sourceId });
        if (rows.length !== 1) fail(); const ids = rows.map(r => String(r.source_id)); ids.forEach(root); resolvedRefs.set(key, ids); return ids;
      } finally { active.delete(key); }
    }
    try {
      if (!db.prepare('SELECT 1 FROM main.sqlite_master WHERE type=\'table\' AND name=?').get(ref.owner)) fail();
      const rows = db.prepare(`SELECT * FROM main.${ref.owner} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
        OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: ref.sourceId });
      if (rows.length !== 1 || rows[0].source_id !== ref.sourceId) fail(); const row = rows[0];
      const ids = new Set([...(typeof row.enrollment_source_id === 'string' ? [row.enrollment_source_id] : []),
        ...metadata(row, ['enrollmentReference', 'sourceId']), ...metadata(row, ['source', 'enrollmentReference', 'sourceId']), ...metadata(row, ['lineage', 'enrollmentReference', 'sourceId'])]);
      // Follow typed original owner links as well as mirrors. A moved index
      // cannot erase a retained predecessor/view/physical reference.
      refs(row).flatMap(r => fromRef(r, active)).forEach(id => ids.add(id));
      for (const id of ids) root(id); const value = [...ids]; resolvedRefs.set(key, value); return value;
    } finally { active.delete(key); }
  };
  const inspected=records.map(({ table, row }) => {
    if (table !== 'pa_take_successor_v1_pitch_heads' && ('first_source_id' in row || 'last_source_id' in row)) {
      const owner = table === 'batting_emotion_execution_v1_heads' ? 'batting_emotion_execution_v1_executions'
        : table === 'batting_execution_v1_heads' ? 'batting_execution_v1_executions' : row.owner;
      if (typeof owner !== 'string' || !prefixes.some(pattern => owner.startsWith(pattern.slice(0, -1)))) fail();
      for (const id of [row.first_source_id, row.last_source_id]) {
        const targets = records.filter(r => r.table === owner && r.row.source_id === id);
        if (targets.length !== 1 || targets[0].row.enrollment_source_id !== row.enrollment_source_id
          || targets[0].row.physical_pitch_source_id !== row.physical_pitch_source_id || targets[0].row.player_id !== row.player_id) fail();
        if (id === row.last_source_id && targets[0].row.snapshot_hash !== row.last_snapshot_hash) fail();
      }
    }
    const ids = new Set([...(typeof row.enrollment_source_id === 'string' ? [row.enrollment_source_id] : []),
      ...metadata(row, ['enrollmentReference', 'sourceId']), ...metadata(row, ['source', 'enrollmentReference', 'sourceId']), ...metadata(row, ['lineage', 'enrollmentReference', 'sourceId']),
      ...refs(row).flatMap(r => fromRef(r))]);
    if (!ids.size && typeof row.view_source_id === 'string') {
      for (const owner of ['reserved_pa_execution_views', 'pa_continuation_v1_execution_views']) if (db.prepare('SELECT 1 FROM main.sqlite_master WHERE type=\'table\' AND name=?').get(owner)) {
        if (db.prepare('SELECT 1 FROM main.' + owner + ' WHERE source_id=?').get(row.view_source_id)) fromRef({ owner, sourceId: row.view_source_id }).forEach(id => ids.add(id));
      }
    }
    if (!ids.size) fail(); const enrollments = [...ids].map(root);
    if (table.startsWith('pa_continuation_v1_')) {
      const s = samePaContinuationSourceInput(JSON.parse(String(row.source_json)), String(row.source_id));
      if (samePaContinuationTables[samePaContinuationKind(s)] !== table) fail();
      const v = JSON.parse(String(row.snapshot_json)), e = root(s.enrollmentReference.sourceId);
      same(v.source, s); same(s.enrollmentReference, { owner: 'same_pa_enrollments', sourceId: e.source.sourceId, sourceHash: hash(e.source), snapshotHash: hash(e) });
      if (row.source_version !== s.sourceVersion || row.enrollment_source_id !== e.source.sourceId || row.career_id !== e.careerId
        || row.game_id !== e.gameId || row.play_id !== e.playId || row.actor_source_id !== e.source.actorReference.sourceId
        || row.first_pitch_source_id !== e.source.firstPhysicalPitchSourceId || row.source_json !== json(s) || row.source_hash !== hash(s)
        || row.snapshot_json !== json(v) || row.snapshot_hash !== hash(v)) fail();
      same(v.lineage.enrollmentReference, s.enrollmentReference); same(v.lineage.actorReference, e.source.actorReference);
    }
    return { table, row, enrollments };
  });
  return [...inspected,...lifecycle.map(record=>({table:record.table,row:record.row,enrollments:record.enrollmentSourceIds.map(root)}))];
};
// Share only the completed typed ownership census inside one immutable Native
// proof. Each caller still evaluates its current scope and admission fences.
const inspect = (db: Db) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  return db instanceof Native && db.isTransaction && db.prepare('PRAGMA query_only').get()!.query_only === 1
    ? withSamePaContinuationReadPhase(db, () => {
      assertBodyCompositionNativeConnection(db);
      return memoSamePaContinuationRead(db, 'continuation-claim-census', () => freeze(inspectClaims(db)));
    }) : inspectClaims(db);
};
export const assertNoSamePaContinuationPlayerClaim = (db: Db, scope: { careerId: string; playerId: string }) => {
  for (const record of inspect(db)) {
    if (record.enrollments.length && record.enrollments.every(e => samePaPlayerClaimCanProceed(db, e.source.sourceId, scope))) continue;
    if (record.enrollments.some(e => e.careerId === scope.careerId && e.participants.some(p => p.binding.playerId === scope.playerId))) fail();
    // Retained member references preserve the global Player fence even if a
    // damaged row points its game index at an unrelated otherwise valid root.
    if (!('source_json' in record.row)) continue;
    if (db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='world_player_workload_baselines'").get()) {
      const baselines = db.prepare(`SELECT * FROM main.world_player_workload_baselines WHERE (career_id=$career OR ${claim('source_json', ['careerId'], '$career')})
        AND (player_id=$player OR ${claim('source_json', ['playerId'], '$player')})`).all({ career: scope.careerId, player: scope.playerId });
      for (const b of baselines) if (db.prepare(`SELECT ${claim('$source', ['member', 'baselineSourceId'], '$baseline')} OR ${claim('$snapshot', ['source', 'member', 'baselineSourceId'], '$baseline')}
        OR ${claim('$source', ['participantReference', 'baselineSourceId'], '$baseline')} OR ${claim('$snapshot', ['lineage', 'participantReferences', { array: 'all' }, 'baselineSourceId'], '$baseline')} matched`)
        .get({ source: String(record.row.source_json), snapshot: String(record.row.snapshot_json), baseline: String(b.source_id) })!.matched) fail();
    }
  }
};
const scopeClaimed = (db: Db, row: Record<string, unknown>, scope: { gameId: string; playId: number; physicalPitchSourceId?: string }) => {
  if (row.game_id === scope.gameId && row.play_id === scope.playId || scope.physicalPitchSourceId !== undefined
    && [row.physical_pitch_source_id, row.physical_source_id, row.pitch_source_id, row.last_source_id, row.first_pitch_source_id].includes(scope.physicalPitchSourceId)) return true;
  if (!('source_json' in row)) return false;
  return !!db.prepare(`SELECT (${claim('$snapshot', ['lineage', 'gameId'], '$game')} AND ${claim('$snapshot', ['lineage', 'playId'], '$play', true)})
    OR ${claim('$source', ['physicalSourceReference', 'sourceId'], '$pitch')} OR ${claim('$source', ['physicalPitchReference', 'sourceId'], '$pitch')} OR ${claim('$source', ['pitchReference', 'sourceId'], '$pitch')}
    OR ${claim('$snapshot', ['physicalPitchSourceId'], '$pitch')} OR ${claim('$snapshot', ['source', 'physicalPitchReference', 'sourceId'], '$pitch')}
    OR ${claim('$snapshot', ['lineage', 'firstPhysicalPitchSourceId'], '$pitch')} matched`)
    .get({ source: String(row.source_json), snapshot: String(row.snapshot_json), game: scope.gameId, play: scope.playId, pitch: scope.physicalPitchSourceId ?? null })!.matched;
};
export const assertNoSamePaContinuationWorkClaim = (db: Db, scope: { gameId: string; playId: number; physicalPitchSourceId?: string }) => {
  for (const record of inspect(db)) if (record.enrollments.some(e => e.gameId === scope.gameId && e.playId === scope.playId || e.source.firstPhysicalPitchSourceId === scope.physicalPitchSourceId)
    || scopeClaimed(db, record.row, scope)) fail();
};
export const assertNoSamePaContinuationEnrollmentClaim = (db: Db, enrollmentSourceId: string) => {
  const preparation = new Set(['pa_take_successor_v1_action_plans', 'pa_take_successor_v1_setups', 'batting_execution_v1_intents', 'batting_execution_v1_inputs', 'batting_observation_v1_postures', 'batting_score_v1_assessments', 'batting_emotion_v1_geneses', 'world_same_pa_occupied_runner_holds']);
  for (const record of inspect(db)) if (!preparation.has(record.table) && record.enrollments.some(e => e.source.sourceId === enrollmentSourceId)) fail();
};

/** Future successor discovery remains metadata-only for an older current view. */
export const readSamePaSuccessorWorkClaimRows = (db: Db, scope: Readonly<{ enrollmentSourceId?: string; physicalPitchSourceId?: string }>) =>
  inspect(db).filter(r => r.table.startsWith('pa_take_successor_v1_') && !['pa_take_successor_v1_action_plans', 'pa_take_successor_v1_setups'].includes(r.table)
    && (scope.enrollmentSourceId !== undefined && r.enrollments.some(e => e.source.sourceId === scope.enrollmentSourceId)
      || scope.physicalPitchSourceId !== undefined && (r.table === 'pa_take_successor_v1_pitch_actions' && r.row.source_id === scope.physicalPitchSourceId
        || scopeClaimed(db, r.row, { gameId: '', playId: -1, physicalPitchSourceId: scope.physicalPitchSourceId }))))
    .map(({ table, row }) => ({ table, row }));
/** Unlike the current-work filter, release retains every preparation claim. */
export const readSamePaContinuationClaimRows = (db: Db, enrollmentSourceId: string) => inspect(db)
  .filter(record => record.enrollments.some(e => e.source.sourceId === enrollmentSourceId))
  .map(({ table, row }) => ({ table, row }));
