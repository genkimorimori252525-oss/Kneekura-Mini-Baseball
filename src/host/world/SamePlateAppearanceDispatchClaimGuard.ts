import { samePaPlayerClaimCanProceed } from './SamePlateAppearanceSettlementAdmission';
import { createRequire } from 'node:module';
import { memoSamePaContinuationRead } from './SamePlateAppearanceContinuationFromSqlite';
import { assertNoSamePaContinuationPlayerClaim, assertNoSamePaContinuationWorkClaim, assertNoSamePaContinuationEnrollmentClaim } from './SamePlateAppearanceContinuationClaimGuard';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertPaDispatchStorage, paDispatchSchema } from './SamePlateAppearanceDispatchStorage';
import { samePaDispatchSourceInput } from './SamePlateAppearanceDispatchSource';
import { samePaMetadataClaim as claim, authenticateSamePaRow, samePaEnrollmentRow } from './SamePlateAppearanceReservationGuard';
import { assertReservedPaClaims } from './SamePlateAppearanceProvisionalClaimGuard';
import { actualLivePlayOwnerIdentityRow } from './ActualLivePlayOwnerMetadata';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
type Db = Pick<DatabaseSync, 'prepare'>;
type Row = Record<string, unknown>;
const prospective = Object.freeze(['pa_dispatch_v1_action_plans', 'pa_dispatch_v1_execution_calibrations', 'pa_dispatch_v1_consumer_sets', 'pa_dispatch_v1_episodes', 'pa_dispatch_v1_rights']);
const capabilities = ['same_pa_first_pitch_action_v1', 'same_pa_execution_calibration_v1', 'same_pa_consumer_set_v1', 'same_pa_first_pitch_episode_v1', 'same_pa_first_pitch_right_v1'];
function fail(): never { throw new Error('same-PA dispatch claim original ownership is missing, malformed or blocks fresh work'); }
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail(); };
const rawIds = (db: Db, row: Row, column: string, path: Parameters<typeof nodes>[1]): string[] =>
  db.prepare(`SELECT atom FROM (${nodes('$document', path)}) WHERE type='text'`).all({ document: String(row[column]) }).map(r => String(r.atom));
const futureReferences = (db: Db, row: Row) => ['source_json', 'snapshot_json'].filter(column => column in row).flatMap(column =>
  db.prepare(`SELECT owner.atom AS owner,identity.atom AS sourceId FROM json_tree(CASE WHEN json_valid($document) THEN $document ELSE 'null' END) container,
    json_each(CASE WHEN container.type='object' THEN container.value ELSE '{}' END) owner,
    json_each(CASE WHEN container.type='object' THEN container.value ELSE '{}' END) identity
    WHERE owner.key='owner' AND owner.type='text' AND identity.key='sourceId' AND identity.type='text'`).all({ document: String(row[column]) })
    .map(ref => ({ owner: String(ref.owner), sourceId: String(ref.sourceId) })));

/** Metadata-only future discovery. Physical payloads are never hydrated here.
 * Original links and all immutable prospective mirrors are checked before an
 * absent older namespace can make a surviving dispatch row disappear. */
const inspectClaims = (db: Db) => {
  if (!assertPaDispatchStorage(db)) return [];
  const records = Object.keys(paDispatchSchema).flatMap(table => db.prepare(`SELECT * FROM main.${table}`).all().map(row => ({ table, row })));
  if (!records.length) return [];
  const roots = new Map<string, NonNullable<ReturnType<typeof authenticateSamePaRow>>>();
  const root = (id: string) => {
    let value = roots.get(id);
    if (!value) { const row = samePaEnrollmentRow(db, id); if (!row) fail(); value = authenticateSamePaRow(db, row!); roots.set(id, value); }
    return value;
  };
  try {
    assertReservedPaClaims(db);
    const inspected = records.map(({ table, row }) => {
      const typedRefs = prospective.includes(table) ? [] : futureReferences(db, row), refs = [...typedRefs];
      const ids = new Set([String(row.enrollment_source_id), ...refs.filter(r => r.owner === 'same_pa_enrollments').map(r => r.sourceId),
        ...('source_json' in row ? rawIds(db, row, 'source_json', ['enrollmentReference', 'sourceId']) : []),
        ...('snapshot_json' in row ? [...rawIds(db, row, 'snapshot_json', ['source', 'enrollmentReference', 'sourceId']),
          ...rawIds(db, row, 'snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'])] : [])]);
      for (const owner of ['reserved_pa_work_prefixes', 'reserved_pa_total_assessments', 'reserved_pa_execution_views'] as const) for (const ref of refs.filter(r => r.owner === owner)) {
        const value = actualLivePlayOwnerIdentityRow(db, owner, ref.sourceId); if (!value) fail(); ids.add(String(value.enrollment_source_id));
      }
      for (const ref of refs.filter(r => r.owner === 'physical_plate_appearance_actors')) {
        const originals = db.prepare(`SELECT source_id FROM main.same_pa_enrollments WHERE actor_source_id=$actor
          OR ${claim('source_json', ['actorReference', 'sourceId'], '$actor')} OR ${claim('snapshot_json', ['source', 'actorReference', 'sourceId'], '$actor')}`).all({ actor: ref.sourceId });
        if (originals.length !== 1) fail(); ids.add(String(originals[0].source_id));
      }
      const enrollments = [...ids].map(root);
      if (prospective.includes(table)) {
        const source = samePaDispatchSourceInput(JSON.parse(String(row.source_json)), String(row.source_id));
        if (!('enrollmentReference' in source) || source.capability !== capabilities[prospective.indexOf(table)]) fail();
        const value = JSON.parse(String(row.snapshot_json));
        const e = root(source.enrollmentReference.sourceId);
        same(source.enrollmentReference, { owner: 'same_pa_enrollments', sourceId: e.source.sourceId, sourceHash: hash(e.source), snapshotHash: hash(e) });
        const view = actualLivePlayOwnerIdentityRow(db, 'reserved_pa_execution_views', source.viewReference.sourceId);
        if (!view || view.source_hash !== source.viewReference.sourceHash || view.snapshot_hash !== source.viewReference.snapshotHash
          || view.enrollment_source_id !== e.source.sourceId) fail();
        const v = JSON.parse(String(view.snapshot_json));
        same(value.lineage, v.lineage); same(value.source, source);
        if (row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)
          || row.source_version !== source.sourceVersion || row.career_id !== e.careerId || row.game_id !== e.gameId || row.play_id !== e.playId
          || row.enrollment_source_id !== e.source.sourceId || row.first_pitch_source_id !== e.source.firstPhysicalPitchSourceId
          || source.firstPhysicalPitchSourceId !== e.source.firstPhysicalPitchSourceId || row.view_source_id !== source.viewReference.sourceId) fail();
        if (source.capability === 'same_pa_execution_calibration_v1' && (row.player_id !== source.member.playerId || row.route !== source.route
          || row.nominal_parameter_identity !== json(source.nominalParameterReference ?? source.nominalReference))) fail();
        if (source.capability === 'same_pa_first_pitch_right_v1' && row.episode_source_id !== source.episodeReference.sourceId) fail();
      }
      const sourceIds = new Set([...(typeof row.source_id === 'string' ? [row.source_id] : []), ...('source_json' in row ? rawIds(db, row, 'source_json', ['sourceId']) : []),
        ...('snapshot_json' in row ? rawIds(db, row, 'snapshot_json', ['source', 'sourceId']) : [])]);
      for (const [column, owner] of [['right_source_id', 'pa_dispatch_v1_rights'], ['episode_source_id', 'pa_dispatch_v1_episodes'],
        ['physical_source_id', 'pa_dispatch_v1_pitch_actions'], ['pitch_source_id', 'pa_dispatch_v1_pitch_actions'], ['last_source_id', 'pa_dispatch_v1_pitch_actions']] as const) {
        if (typeof row[column] === 'string') refs.push({ owner, sourceId: String(row[column]) });
      }
      const pitchIds = new Set([String(row.first_pitch_source_id), ...['physical_source_id', 'pitch_source_id', 'last_source_id'].flatMap(c => typeof row[c] === 'string' ? [String(row[c])] : []),
        ...('source_json' in row ? rawIds(db, row, 'source_json', ['physicalSourceReference', 'sourceId']) : []),
        ...('snapshot_json' in row ? rawIds(db, row, 'snapshot_json', ['source', 'physicalSourceReference', 'sourceId']) : [])]);
      return { table, row, enrollments, refs, typedRefs, sourceIds, pitchIds };
    });
    // Follow only typed owner/Source identities and schema-owned index roles.
    // These are claims, not future payload authentication or replay. A moved
    // copied enrollment cannot sever its surviving original action/right link.
    let changed = true;
    while (changed) {
      changed = false;
      for (const record of inspected.filter(r => !prospective.includes(r.table))) {
        for (const ref of record.typedRefs.filter(ref => prospective.includes(ref.owner))) {
          if (!inspected.some(target => target.table === ref.owner && target.sourceIds.has(ref.sourceId))) fail();
        }
        const targets = inspected.filter(target => record.refs.some(ref => ref.owner === target.table && target.sourceIds.has(ref.sourceId)));
        const linked = [...targets.flatMap(t => t.enrollments), ...[...roots.values()].filter(e => record.pitchIds.has(e.source.firstPhysicalPitchSourceId))];
        for (const e of linked) if (!record.enrollments.some(value => value.source.sourceId === e.source.sourceId)) { record.enrollments.push(e); changed = true; }
      }
    }
    const prepared = inspected.filter(record => prospective.includes(record.table));
    if (new Set(prepared.map(record => record.row.source_id)).size !== prepared.length) fail();
    for (const record of prepared) {
      const source = samePaDispatchSourceInput(JSON.parse(String(record.row.source_json)));
      if (!('enrollmentReference' in source)) fail();
      const linked = (ref: { owner: string; sourceId: string; sourceHash: string; snapshotHash: string }) => {
        const targets = prepared.filter(r => r.table === ref.owner && r.row.source_id === ref.sourceId);
        if (targets.length !== 1 || targets[0].row.source_hash !== ref.sourceHash || targets[0].row.snapshot_hash !== ref.snapshotHash
          || targets[0].row.enrollment_source_id !== source.enrollmentReference.sourceId || targets[0].row.view_source_id !== source.viewReference.sourceId
          || targets[0].row.first_pitch_source_id !== source.firstPhysicalPitchSourceId) fail();
        return samePaDispatchSourceInput(JSON.parse(String(targets[0].row.source_json)));
      };
      if (source.capability === 'same_pa_execution_calibration_v1') {
        // Action-first bootstrap means a surviving calibration is a durable
        // dependency claim. Deleting its action can never permit repair.
        const actions = prepared.filter(r => r.table === prospective[0] && r.row.enrollment_source_id === source.enrollmentReference.sourceId
          && r.row.first_pitch_source_id === source.firstPhysicalPitchSourceId && r.row.view_source_id === source.viewReference.sourceId);
        if (actions.length !== 1) fail();
        const action = samePaDispatchSourceInput(JSON.parse(String(actions[0].row.source_json)));
        if (action.capability !== 'same_pa_first_pitch_action_v1') fail();
        if (source.route === 'pitch_delivery') { same(source.nominalReference, action.timingReference); same(source.response.policyReference, action.pitchResponseReference); }
      }
      if ('actionReference' in source) linked(source.actionReference);
      if (source.capability === 'same_pa_consumer_set_v1') for (const p of source.participantInputs) for (const r of p.calibrationReferences) {
        const calibration = linked(r.calibrationReference); if (calibration.capability !== 'same_pa_execution_calibration_v1') fail();
        same(calibration.member, p.member); same(calibration.route, r.route);
      }
      if ('consumerSetReference' in source) {
        const consumer = linked(source.consumerSetReference); if (consumer.capability !== 'same_pa_consumer_set_v1') fail(); same(consumer.actionReference, source.actionReference);
      }
      if (source.capability === 'same_pa_first_pitch_right_v1') {
        const episode = linked(source.episodeReference); if (episode.capability !== 'same_pa_first_pitch_episode_v1') fail();
        same(episode.actionReference, source.actionReference); same(episode.consumerSetReference, source.consumerSetReference);
        const view = actualLivePlayOwnerIdentityRow(db, 'reserved_pa_execution_views', source.viewReference.sourceId); if (!view) fail();
        same(JSON.parse(String(view.source_json)).prefixReference, source.prefixReference);
      }
    }
    return inspected;
  } catch { return fail(); }
};
const inspect = (db: Db) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  return db instanceof Native && db.isTransaction && db.prepare('PRAGMA query_only').get()!.query_only === 1
    ? memoSamePaContinuationRead(db, 'dispatch-claim-census', () => freeze(inspectClaims(db))) : inspectClaims(db);
};
const rawWorkRows = (db: Db, table: string, scope: { gameId: string; playId: number; physicalPitchSourceId?: string }) => {
  if (table === 'pa_dispatch_v1_pitch_heads') return db.prepare(`SELECT * FROM main.${table} WHERE (game_id=$game AND play_id=$play) OR first_pitch_source_id=$pitch`).all({ game: scope.gameId, play: scope.playId, pitch: scope.physicalPitchSourceId ?? null });
  const paths = [['lineage'], []] as const;
  return db.prepare(`SELECT * FROM main.${table} WHERE (game_id=$game AND play_id=$play) OR first_pitch_source_id=$pitch
    ${table === 'pa_dispatch_v1_consumer_actions' ? 'OR physical_source_id=$pitch' : table === 'pa_dispatch_v1_consumptions' || table === 'pa_dispatch_v1_episode_admissions' ? 'OR pitch_source_id=$pitch' : ''}
    OR ${claim('source_json', ['firstPhysicalPitchSourceId'], '$pitch')} OR ${claim('source_json', ['physicalSourceReference', 'sourceId'], '$pitch')}
    OR ${claim('snapshot_json', ['source', 'firstPhysicalPitchSourceId'], '$pitch')} OR ${claim('snapshot_json', ['source', 'physicalSourceReference', 'sourceId'], '$pitch')}
    OR ${claim('snapshot_json', ['lineage', 'firstPhysicalPitchSourceId'], '$pitch')}
    OR ${paths.map(path => `(${claim('snapshot_json', [...path, 'gameId'], '$game')} AND ${claim('snapshot_json', [...path, 'playId'], '$play', true)})`).join(' OR ')}`)
    .all({ game: scope.gameId, play: scope.playId, pitch: scope.physicalPitchSourceId ?? null });
};
/** Unconditional writer fences: these functions accept no exemption. */
export const assertNoPaDispatchPlayerClaim = (db: Db, scope: { careerId: string; playerId: string }): void => {
  assertNoSamePaContinuationPlayerClaim(db, scope);
  for (const record of inspect(db)) {
    if (record.enrollments.length && record.enrollments.every(e => samePaPlayerClaimCanProceed(db, e.source.sourceId, scope))) continue;
    if (record.enrollments.some(e => e.careerId === scope.careerId && e.participants.some(p => p.binding.playerId === scope.playerId))) fail();
    if (record.table !== 'pa_dispatch_v1_pitch_heads' && db.prepare(`SELECT 1 FROM main.${record.table} WHERE
      (career_id=$career OR ${claim('snapshot_json', ['lineage', 'careerId'], '$career')}) AND
      (${record.table === 'pa_dispatch_v1_execution_calibrations' || record.table === 'pa_dispatch_v1_consumer_actions' ? 'player_id=$player OR ' : ''}
      ${claim('source_json', ['member', 'playerId'], '$player')} OR ${claim('snapshot_json', ['source', 'member', 'playerId'], '$player')}
      OR ${claim('source_json', ['participantInputs', { array: 'all' }, 'member', 'playerId'], '$player')}
      OR ${claim('snapshot_json', ['lineage', 'participantReferences', { array: 'all' }, 'playerId'], '$player')})`).get({ career: scope.careerId, player: scope.playerId })) fail();
    if (!prospective.includes(record.table) && 'source_json' in record.row) {
      // A retained member baseline binds a global Player, not a causal PA.
      // Never use this edge in the fresh game/play predicate below.
      const members = [nodes('$source', ['member']), nodes('$source', ['participantInputs', { array: 'all' }, 'member']),
        nodes('$snapshot', ['source', 'member']), nodes('$snapshot', ['source', 'participantInputs', { array: 'all' }, 'member']),
        nodes('$snapshot', ['roles', { array: 'all' }, 'member']), nodes('$snapshot', ['lineage', 'participantReferences', { array: 'all' }])].join(' UNION ALL ');
      if (db.prepare(`SELECT 1 FROM (${members}) member,main.world_player_workload_baselines baseline WHERE member.type='object'
        AND (baseline.career_id=$career OR ${claim('baseline.source_json', ['careerId'], '$career')} OR ${claim('baseline.initial_json', ['careerId'], '$career')})
        AND (baseline.player_id=$player OR ${claim('baseline.source_json', ['playerId'], '$player')} OR ${claim('baseline.initial_json', ['playerId'], '$player')})
        AND (${claim('member.value', ['baselineSourceId'], 'baseline.source_id')} OR EXISTS(SELECT 1 FROM (${nodes('baseline.source_json', ['sourceId'])}) identity
          WHERE identity.type='text' AND ${claim('member.value', ['baselineSourceId'], 'identity.atom')}))`).get({ source: String(record.row.source_json), snapshot: String(record.row.snapshot_json), career: scope.careerId, player: scope.playerId })) fail();
    }
  }
};
export const assertNoPaDispatchWorkClaim = (db: Db, scope: { gameId: string; playId: number; physicalPitchSourceId?: string }): void => {
  assertNoSamePaContinuationWorkClaim(db, scope);
  for (const record of inspect(db)) if (record.enrollments.some(e => e.gameId === scope.gameId && e.playId === scope.playId
    || e.source.firstPhysicalPitchSourceId === scope.physicalPitchSourceId) || rawWorkRows(db, record.table, scope).length) fail();
};
/** Called only by the old owner's existing original-enrollment read branch.
 * Prospective prerequisites are not causal work. Actual dispatch work always
 * invalidates a fresh empty-view proof, without changing the frozen v1 census. */
export const readPaDispatchWorkClaimRows = (db: Db, enrollmentSourceId: string): readonly Readonly<{ table: string; row: Row }>[] => {
  const records = inspect(db).filter(record => !prospective.includes(record.table)); if (!records.length) return [];
  const row = samePaEnrollmentRow(db, enrollmentSourceId); if (!row) fail(); const original = authenticateSamePaRow(db, row);
  const scope = { gameId: original.gameId, playId: original.playId, physicalPitchSourceId: original.source.firstPhysicalPitchSourceId };
  const direct = new Map([...new Set(records.map(record => record.table))].map(table => [table, new Set(rawWorkRows(db, table, scope).map(json))]));
  return records.filter(record => record.enrollments.some(e => e.source.sourceId === enrollmentSourceId) || direct.get(record.table)!.has(json(record.row)))
    .map(({ table, row }) => ({ table, row }));
};
/** Release also pins prospective action/calibration/right rows. */
export const readPaDispatchClaimRows = (db: Db, enrollmentSourceId: string) => inspect(db)
  .filter(record => record.enrollments.some(e => e.source.sourceId === enrollmentSourceId))
  .map(({ table, row }) => ({ table, row }));
export const assertFreshPaDispatchEnrollment = (db: Db, enrollmentSourceId: string): void => {
  assertNoSamePaContinuationEnrollmentClaim(db, enrollmentSourceId);
  if (readPaDispatchWorkClaimRows(db, enrollmentSourceId).length) fail();
};
/** Read-only discovery for a prospective physical identity, including surviving
 * consumers/heads/receipts when the pitch row itself is absent or moved. */
export const readPaDispatchPhysicalClaimRows = (db: Db, physicalSourceId: string): readonly Readonly<{ table: string; row: Row }>[] => {
  const records = inspect(db).filter(record => !prospective.includes(record.table)); if (!records.length) return [];
  const roots = db.prepare(`SELECT source_id FROM main.same_pa_enrollments WHERE first_pitch_source_id=$id
    OR ${claim('source_json', ['firstPhysicalPitchSourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'firstPhysicalPitchSourceId'], '$id')}`).all({ id: physicalSourceId });
  const found = new Map<string, { table: string; row: Row }>();
  for (const record of records) if (record.pitchIds.has(physicalSourceId)
    || record.table === 'pa_dispatch_v1_pitch_actions' && record.sourceIds.has(physicalSourceId)
    || record.refs.some(ref => ref.owner === 'pa_dispatch_v1_pitch_actions' && ref.sourceId === physicalSourceId)) {
    found.set(record.table + ':' + json(record.row), { table: record.table, row: record.row });
  }
  for (const root of roots) for (const record of readPaDispatchWorkClaimRows(db, String(root.source_id))) found.set(record.table + ':' + json(record.row), record);
  return [...found.values()];
};
