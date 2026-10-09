import { samePaLifecycleSourceInput } from './SamePlateAppearanceLifecycle';
import { samePaLifecycleOutcomeInput } from './SamePlateAppearanceLifecycleOutcome';
import { samePaPhysicalEpisodeSourceInput } from './SamePlateAppearancePhysicalEpisode';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text } from './SamePlateAppearanceWorkPrefix';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { assertSamePaLifecycleStorage } from './SamePlateAppearanceLifecycleStorage';
import { assertSamePaPhysicalEpisodeStorage } from './SamePlateAppearancePhysicalEpisodeStorage';
import { assertSamePaTerminalEndpointStorage } from './SamePlateAppearanceTerminalStorage';
import { assertSamePaCatchWorkStorage } from './SamePlateAppearanceCatchWorkStorage';
import { samePaCatchWorkInput } from './SamePlateAppearanceCatchWork';
import { assertBatterRunPlanStorage } from './SqliteBatterRunPlanStore';
import { batterRunPlanInput } from './BatterRunPlan';

type Db = Pick<DatabaseSync, 'prepare'>;
export type SamePaLifecycleClaimRow = Readonly<{ table: string; row: Record<string, unknown>; enrollmentSourceIds: readonly string[] }>;
const patterns = ['pa_lifecycle_v1_*', 'pa_physical_v1_*', 'pa_terminal_v1_*', 'pa_catch_v1_*', 'world_batter_run_plans'] as const;
const olderOwners = new Set(['same_pa_enrollments', 'physical_plate_appearance_actors', 'reserved_pa_work_prefixes', 'reserved_pa_total_assessments',
  'reserved_pa_execution_views', 'pa_dispatch_v1_action_plans', 'pa_dispatch_v1_execution_calibrations', 'pa_dispatch_v1_consumer_sets',
  'pa_dispatch_v1_episodes', 'pa_dispatch_v1_rights', 'pa_dispatch_v1_pitch_actions', 'pa_dispatch_v1_consumer_actions',
  'pa_take_successor_v1_action_plans', 'pa_take_successor_v1_setups', 'pa_take_successor_v1_pitch_actions',
  'pa_continuation_v1_work_prefixes', 'pa_continuation_v1_total_assessments', 'pa_continuation_v1_execution_views', 'pa_continuation_v1_execution_calibrations',
  'batting_observation_v1_postures', 'batting_observation_v1_observations', 'batting_observation_v1_deliveries', 'batting_prediction_v1_predictions',
  'batting_score_v1_assessments', 'batting_emotion_v1_geneses', 'batting_emotion_execution_v1_executions', 'batting_execution_v1_intents',
  'batting_execution_v1_inputs', 'batting_execution_v1_executions']);
const fail = (): never => { throw new Error('same-PA lifecycle has malformed or orphan original ownership claims'); };
const knownOwner = (owner: string) => olderOwners.has(owner) || patterns.some(p => p.endsWith('*') ? owner.startsWith(p.slice(0, -1)) : owner === p);
const predicate = patterns.map(() => '(lower(name) GLOB ? OR lower(tbl_name) GLOB ?)').join(' OR ');
const args = patterns.flatMap(p => [p, p]);

/** Metadata-only closure. The workload owner authenticates active/released
 * enrollment authority after this discovery. No release, participant or
 * physical payload is interpreted here; shared Players never join PA graphs. */
export const readSamePaLifecycleClaimRows = (db: Db): readonly SamePaLifecycleClaimRow[] => {
  assertSamePaLifecycleStorage(db); assertSamePaPhysicalEpisodeStorage(db); assertSamePaTerminalEndpointStorage(db); assertSamePaCatchWorkStorage(db);
  assertBatterRunPlanStorage(db);
  if (db.prepare('SELECT 1 FROM temp.sqlite_master WHERE ' + predicate).get(...args)) return fail();
  const catalog = db.prepare('SELECT type,name,tbl_name FROM main.sqlite_master WHERE ' + predicate).all(...args);
  if (catalog.some(r => r.type !== 'table' && r.type !== 'index')) return fail();
  const metadata = (row: Record<string, unknown>, path: Parameters<typeof nodes>[1]) => ['source_json', 'snapshot_json'].filter(c => c in row).flatMap(c =>
    db.prepare(`SELECT atom FROM (${nodes('$document', path)}) WHERE type='text'`).all({ document: String(row[c]) }).map(r => String(r.atom)));
  const references = (row: Record<string, unknown>) => ['source_json', 'snapshot_json'].filter(c => c in row).flatMap(c => db.prepare(`SELECT o.atom owner,i.atom sourceId
    FROM json_tree(CASE WHEN json_valid($document) THEN $document ELSE 'null' END) obj,
      json_each(CASE WHEN obj.type='object' THEN obj.value ELSE '{}' END) o,json_each(CASE WHEN obj.type='object' THEN obj.value ELSE '{}' END) i
    WHERE o.key='owner' AND o.type='text' AND i.key='sourceId' AND i.type='text'`).all({ document: String(row[c]) })
    .map(r => ({ owner: String(r.owner), sourceId: String(r.sourceId) })));
  const directIds = (row: Record<string, unknown>) => [...(typeof row.enrollment_source_id === 'string' ? [row.enrollment_source_id] : []),
    ...metadata(row, ['enrollmentReference', 'sourceId']), ...metadata(row, ['source', 'enrollmentReference', 'sourceId']), ...metadata(row, ['lineage', 'enrollmentReference', 'sourceId'])];
  const cache = new Map<string, readonly string[]>(), active = new Set<string>();
  const resolve = (owner: string, id: string): readonly string[] => {
    if (!knownOwner(owner)) return [];
    if (owner === 'same_pa_enrollments') return [id];
    const key = owner + ':' + id, saved = cache.get(key); if (saved) return saved; if (active.has(key)) return fail(); active.add(key);
    try {
      if (owner === 'physical_plate_appearance_actors') {
        if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='same_pa_enrollments'").get()) return fail();
        const rows = db.prepare(`SELECT source_id FROM main.same_pa_enrollments WHERE actor_source_id=$id OR ${claim('source_json', ['actorReference', 'sourceId'], '$id')}
          OR ${claim('snapshot_json', ['source', 'actorReference', 'sourceId'], '$id')}`).all({ id });
        if (rows.length !== 1 || typeof rows[0].source_id !== 'string') return fail(); const result = [rows[0].source_id]; cache.set(key, result); return result;
      }
      const table = db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(owner);
      if (table.length !== 1 || table[0].type !== 'table' || table[0].name !== owner) return fail();
      const rows = db.prepare(`SELECT * FROM main.${owner} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
        OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id });
      if (rows.length !== 1 || rows[0].source_id !== id) return fail();
      const row = rows[0], ids = new Set(directIds(row));
      for (const ref of references(row)) for (const enrollment of resolve(ref.owner, ref.sourceId)) ids.add(enrollment);
      if (!ids.size) return fail(); const result = [...ids].sort(); cache.set(key, result); return result;
    } finally { active.delete(key); }
  };
  return catalog.filter(r => r.type === 'table').flatMap(table => {
    const name = String(table.name), rows = db.prepare('SELECT * FROM main."' + name.replaceAll('"', '""') + '"').all();
    return rows.map(row => {
      if ('source_json' in row) {
        if (typeof row.source_json !== 'string' || typeof row.snapshot_json !== 'string') return fail();
        let source: Record<string, unknown>, snapshot: Record<string, unknown>;
        try { source = JSON.parse(row.source_json); snapshot = JSON.parse(row.snapshot_json); } catch { return fail(); }
        if (!source || !snapshot || Array.isArray(source) || Array.isArray(snapshot) || source.sourceId !== row.source_id
          || name !== 'world_batter_run_plans' && source.sourceVersion !== row.source_version || json(source) !== row.source_json || json(snapshot) !== row.snapshot_json
          || hash(source) !== row.source_hash || hash(snapshot) !== row.snapshot_hash || json(snapshot.source) !== json(source)) return fail();
      }
      if ('source_json' in row) {
        const source=JSON.parse(String(row.source_json));
        const lifecycleKinds:Record<string,string>={pa_lifecycle_v1_work_prefixes:'same_pa_lifecycle_prefix_v1',pa_lifecycle_v1_total_assessments:'same_pa_lifecycle_cumulative_total_v1',pa_lifecycle_v1_execution_views:'same_pa_lifecycle_cumulative_view_v1',pa_lifecycle_v1_execution_calibrations:'same_pa_lifecycle_execution_calibration_v1'};
        const physicalKinds:Record<string,string>={pa_physical_v1_field_calibrations:'same_pa_physical_field_calibration_v1',pa_physical_v1_action_plans:'same_pa_physical_action_v1',pa_physical_v1_rights:'same_pa_physical_right_v1',pa_physical_v1_launches:'same_pa_physical_launch_v1',pa_physical_v1_cuts:'same_pa_physical_cut_v1',pa_physical_v1_commitments:'same_pa_physical_commitment_v1',pa_physical_v1_resolutions:'same_pa_physical_resolution_v1',pa_physical_v1_field_roots:'same_pa_physical_field_root_v1',pa_physical_v1_field_steps:'same_pa_physical_field_step_v1'};
        if(name==='world_batter_run_plans'){batterRunPlanInput(source,String(row.source_id));}
        else if(name==='pa_catch_v1_work'){samePaCatchWorkInput(source,String(row.source_id));}
        else if(lifecycleKinds[name]){const s=samePaLifecycleSourceInput(source,String(row.source_id));if(s.capability!==lifecycleKinds[name])return fail();}
        else if(name==='pa_lifecycle_v1_outcomes'||name==='pa_lifecycle_v1_resets'){const s=samePaLifecycleOutcomeInput(source,String(row.source_id));if(s.capability!==(name==='pa_lifecycle_v1_outcomes'?'same_pa_lifecycle_outcome_v1':'same_pa_lifecycle_reset_v1'))return fail();}
        else if(physicalKinds[name]){const s=samePaPhysicalEpisodeSourceInput(source,String(row.source_id));if(s.capability!==physicalKinds[name])return fail();}
        else if(name.startsWith('pa_physical_v1_')){const role=name==='pa_physical_v1_pitch_consumers'?'consumer':name==='pa_physical_v1_consumptions'?'consumption':name==='pa_physical_v1_admissions'?'admission':null;
          if(!role||!fields(source,['sourceId','sourceVersion','capability','launchSourceReference','viewReference'])||source.capability!=='same_pa_physical_'+role+'_v1'
            ||!ref(source.viewReference,'pa_lifecycle_v1_execution_views')||!fields(source.launchSourceReference,['sourceId','sourceVersion','sourceHash'])
            ||!text(source.launchSourceReference.sourceId)||!text(source.launchSourceReference.sourceVersion)||!text(source.launchSourceReference.sourceHash))return fail();
        }else if(name==='pa_terminal_v1_endpoints'){
          if(!fields(source,['sourceId','sourceVersion','capability','enrollmentReference','finalViewReference','outcomeReference'])||source.capability!=='same_pa_terminal_endpoint_v1'
            ||!ref(source.enrollmentReference,'same_pa_enrollments')||!ref(source.finalViewReference,'pa_lifecycle_v1_execution_views')||!ref(source.outcomeReference,'pa_lifecycle_v1_outcomes'))return fail();
        }else if(name==='pa_terminal_v1_transitions'){
          if(source.capability!=='same_pa_terminal_transition_v1'||!ref(source.terminalReference,'pa_terminal_v1_endpoints')||!ref(source.settlementReference,'pa_settlement_v1_plans'))return fail();
        }else return fail();
      }
      const ids = new Set(directIds(row));
      for (const ref of references(row)) for (const enrollment of resolve(ref.owner, ref.sourceId)) ids.add(enrollment);
      if (!ids.size) return fail();
      // Head indexes cannot erase the original last operation/root authority.
      if (typeof row.last_owner === 'string' && typeof row.last_source_id === 'string') {
        const linked = resolve(row.last_owner, row.last_source_id); if (!linked.length || linked.some(id => !ids.has(id))) return fail();
        const last = db.prepare('SELECT * FROM main.' + row.last_owner + ' WHERE source_id=?').get(row.last_source_id);
        if (!last || last.snapshot_hash !== row.last_snapshot_hash || last.enrollment_source_id !== row.enrollment_source_id
          || last.career_id !== row.career_id || last.game_id !== row.game_id || last.play_id !== row.play_id
          || last.pitch_ordinal !== row.pitch_ordinal || last.operation_ordinal !== row.operation_ordinal
          || last.physical_pitch_source_id !== row.launch_source_id) return fail();
        const launch = db.prepare('SELECT * FROM main.pa_physical_v1_launches WHERE source_id=?').get(row.launch_source_id);
        if (!launch || launch.enrollment_source_id !== row.enrollment_source_id || launch.pitch_ordinal !== row.pitch_ordinal) return fail();
      }
      return { table: name, row, enrollmentSourceIds: [...ids].sort() };
    });
  });
};
