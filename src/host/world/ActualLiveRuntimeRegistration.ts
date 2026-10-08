import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches,
  type SqliteJsonMetadataPath as Path } from './SqliteOwnershipMetadata';

type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Scope = Readonly<{ gameId: string; playId: number; physicalPitchSourceId: string }>;
type Link = readonly [field: string, column: string, owner: string];
type Domain = Readonly<{ owner: string; root?: 'flight' | 'input' | 'model'; parent?: string; previous?: string; links: readonly Link[];
  head?: Readonly<{ owner: string; links?: readonly Link[] }> }>;
const domains: readonly Domain[] = [
  { owner: 'batted_ball_flights', root: 'flight', parent: 'physicalPitchSourceId', previous: 'previousFlightSourceId', links: [['physicalPitchSourceId', 'physical_pitch_source_id', 'physical_pitch_progress_actions']], head: { owner: 'batted_ball_flight_heads' } },
  { owner: 'batted_world_contacts', root: 'input', parent: 'flightSourceId', previous: 'previousContactSourceId', links: [['flightSourceId', 'flight_source_id', 'batted_ball_flights']], head: { owner: 'batted_world_contact_heads' } },
  { owner: 'batted_first_fielder_touches', root: 'input', parent: 'worldContactSourceId', links: [['worldContactSourceId', 'world_contact_source_id', 'batted_world_contacts']] },
  { owner: 'batted_contact_responses', root: 'input', parent: 'firstFielderTouchSourceId', links: [['firstFielderTouchSourceId', 'first_fielder_touch_source_id', 'batted_first_fielder_touches']] },
  { owner: 'actual_communication_models', root: 'model', parent: 'physicalPitchSourceId', links: [['physicalPitchSourceId', 'physical_pitch_source_id', 'physical_pitch_progress_actions']] },
  { owner: 'batted_post_response_flights', links: [['contactResponseSourceId', 'contact_response_source_id', 'batted_contact_responses']], head: { owner: 'batted_post_response_flight_heads', links: [['contactResponseSourceId', 'contact_response_source_id', 'batted_contact_responses']] } },
  { owner: 'batted_world_continuations', links: [['responseSourceId', 'response_source_id', 'batted_contact_responses']], head: { owner: 'batted_world_continuation_heads' } },
  { owner: 'batted_world_acquisitions', links: [['responseSourceId', 'response_source_id', 'batted_contact_responses'], ['continuationSourceId', 'continuation_source_id', 'batted_world_continuations']] },
  { owner: 'batted_world_motions', links: [['responseSourceId', 'response_source_id', 'batted_contact_responses'], ['continuationSourceId', 'continuation_source_id', 'batted_world_continuations'], ['acquisitionSourceId', 'acquisition_source_id', 'batted_world_acquisitions']], head: { owner: 'batted_world_motion_heads' } },
  { owner: 'batted_world_executions', links: [['baseMotionSourceId', 'base_motion_source_id', 'batted_world_motions']], head: { owner: 'batted_world_execution_heads' } },
  { owner: 'batted_world_field_actions', links: [['responseSourceId', 'response_source_id', 'batted_contact_responses']], head: { owner: 'batted_world_field_heads' } },
  { owner: 'batted_world_field_executions', links: [['baseFieldSourceId', 'base_field_source_id', 'batted_world_field_actions']], head: { owner: 'batted_world_field_execution_heads' } },
  { owner: 'actual_field_observations', links: [['baseFieldSourceId', 'base_field_source_id', 'batted_world_field_actions'], ['executionSourceId', 'execution_source_id', 'batted_world_field_executions']], head: { owner: 'actual_field_observation_heads' } },
  { owner: 'actual_runner_public_knowledge', links: [['physicalPitchSourceId', 'physical_pitch_source_id', 'physical_pitch_progress_actions']] },
  { owner: 'actual_defensive_plans', links: [['observationSourceId', 'observation_source_id', 'actual_field_observations']] },
  { owner: 'actual_defensive_decisions', links: [['observationSourceId', 'observation_source_id', 'actual_field_observations'], ['planSourceId', 'plan_source_id', 'actual_defensive_plans']], head: { owner: 'actual_defensive_decision_heads' } },
  { owner: 'actual_locomotion_receipts', links: [['decisionSourceId', 'decision_source_id', 'actual_defensive_decisions'], ['baseFieldSourceId', 'base_field_source_id', 'batted_world_field_actions'], ['executionSourceId', 'execution_source_id', 'batted_world_field_executions']], head: { owner: 'actual_locomotion_heads' } },
  { owner: 'actual_live_rule_consumptions', links: [['captureExecutionSourceId', 'capture_execution_source_id', 'batted_world_field_executions'], ['ruleExecutionSourceId', 'rule_execution_source_id', 'batted_world_field_executions']] },
  { owner: 'actual_settled_foul_stop_productions', links: [['baseFieldSourceId', 'base_field_source_id', 'batted_world_field_actions']] },
  { owner: 'actual_foul_rule_consumptions', links: [['stopProductionSourceId', 'stop_production_source_id', 'actual_settled_foul_stop_productions']] },
  { owner: 'actual_first_base_umpire_setups', links: [] },
  { owner: 'actual_first_base_umpire_observations', links: [['setupSourceId', 'dependency_source_id', 'actual_first_base_umpire_setups'], ['ruleExecutionSourceId', 'current_execution_source_id', 'batted_world_field_executions']] },
  { owner: 'actual_first_base_umpire_calls', links: [['observationSourceId', 'dependency_source_id', 'actual_first_base_umpire_observations'], ['currentExecutionSourceId', 'current_execution_source_id', 'batted_world_field_executions']] },
  { owner: 'actual_call_communications', links: [['callSourceId', 'call_source_id', 'actual_first_base_umpire_calls'], ['modelSourceId', 'model_source_id', 'actual_communication_models'], ['currentExecutionSourceId', 'current_execution_source_id', 'batted_world_field_executions']], head: { owner: 'actual_call_communication_heads', links: [['callSourceId', 'call_source_id', 'actual_first_base_umpire_calls']] } },
];
/** A private copy of the declared dependency graph; consumers cannot mutate registration. */
export const originalLiveOwnerDomains = (): readonly Domain[] => structuredClone(domains);
const mirrors: readonly (readonly [string, Path])[] = [['source_json', []], ['snapshot_json', ['source']],
  ['snapshot_json', ['history', { array: 'all' }]], ['snapshot_json', ['history']]];
const contexts: readonly Path[] = [[], ['recipient'], ['receipt', 'self'], ['receipt', 'self', 'cut'], ['setup'], ['observation'], ['observation', 'setup'], ['baseField'], ['scope'], ['execution', 'physicalHistory', 'scope']];
const flights: readonly Path[] = [[], ['flight'], ['worldContact', 'flight'], ['touch', 'worldContact', 'flight'],
  ['response', 'touch', 'worldContact', 'flight'], ['baseMotion', 'response', 'touch', 'worldContact', 'flight'],
  ['baseField', 'response', 'touch', 'worldContact', 'flight']];
const embedded: Readonly<Record<string, readonly Path[]>> = {
  flightSourceId: [['flight', 'source', 'sourceId']], worldContactSourceId: [['worldContact', 'source', 'sourceId']],
  firstFielderTouchSourceId: [['touch', 'source', 'sourceId']], responseSourceId: [['response', 'source', 'sourceId']],
  contactResponseSourceId: [['response', 'source', 'sourceId']], baseMotionSourceId: [['baseMotion', 'source', 'sourceId']],
  baseFieldSourceId: [['baseField', 'source', 'sourceId']], observationSourceId: [['observation', 'source', 'sourceId']],
  stopProductionSourceId: [['producerReference', 'sourceId']],
  setupSourceId: [['setup', 'sourceId'], ['setup', 'source', 'sourceId']], callSourceId: [['call', 'source', 'sourceId']],
};
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
function fail(): never { throw new Error('actual live runtime must be registered before governed work; original ownership metadata differs'); }

/** Discover original-scope claims without replaying physical or future payloads.
 * Only zero-horizon input roots and configuration remain admissible. No row set
 * or caller-provided domain list serves as a complete capability manifest. */
export const assertActualLiveRegistrationBeforeWork = (db: Db, scope: Scope): void => {
  const known = new Map<string, Set<string>>([['physical_pitch_progress_actions', new Set([scope.physicalPitchSourceId])]]);
  const columns = (table: string): Set<string> | null => {
    const schema = db.prepare('SELECT type FROM sqlite_master WHERE name=?').all(table);
    if (!schema.length) return null;
    if (schema.length !== 1 || schema[0].type !== 'table') return fail();
    return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(r => String(r.name)));
  };
  const select = (table: string, links: readonly Link[], ownIds: Set<string>, metadata: boolean) => {
    const cols = columns(table); if (!cols) return [];
    if (metadata && ['source_id', 'source_json', 'snapshot_json'].some(c => !cols.has(c))) return fail();
    const bindings: Record<string, string | number> = {}, args = new Map<string, string>();
    const bind = (value: string | number): string => {
      const key = `${typeof value}:${value}`; if (args.has(key)) return args.get(key)!;
      const name = `p${args.size}`; bindings[name] = value; args.set(key, `$${name}`); return `$${name}`;
    };
    const clauses: string[] = [];
    const indexed = (column: string, ids: readonly string[]) => { if (cols.has(column) && ids.length) clauses.push(`${column} IN (SELECT value FROM json_each(${bind(JSON.stringify(ids))}))`); };
    indexed('physical_pitch_source_id', [scope.physicalPitchSourceId]); indexed('source_id', [...ownIds]);
    if (cols.has('game_id') && cols.has('play_id')) clauses.push(`(game_id=${bind(scope.gameId)} AND play_id=${bind(scope.playId)})`);
    if (metadata) {
      for (const [document, path] of mirrors) {
        clauses.push(claim(document, [...path, 'physicalPitchSourceId'], bind(scope.physicalPitchSourceId)));
        clauses.push(`(${claim(document, [...path, 'gameId'], bind(scope.gameId))} AND EXISTS (SELECT 1 FROM (${nodes(document, [...path, 'playId'])}) n WHERE n.atom=${bind(scope.playId)}))`);
        if (ownIds.size) clauses.push(`EXISTS (SELECT 1 FROM (${nodes(document, [...path, 'sourceId'])}) n WHERE n.type='text' AND n.atom IN (SELECT value FROM json_each(${bind(JSON.stringify([...ownIds]))})))`);
      }
      for (const path of contexts) {
        clauses.push(claim('snapshot_json', [...path, 'physicalPitchSourceId'], bind(scope.physicalPitchSourceId)));
        clauses.push(`(${claim('snapshot_json', [...path, 'gameId'], bind(scope.gameId))} AND EXISTS (SELECT 1 FROM (${nodes('snapshot_json', [...path, 'playId'])}) n WHERE n.atom=${bind(scope.playId)}))`);
      }
      for (const path of flights) {
        clauses.push(claim('snapshot_json', [...path, 'source', 'physicalPitchSourceId'], bind(scope.physicalPitchSourceId)));
        clauses.push(claim('snapshot_json', [...path, 'physicalPitch', 'source', 'sourceId'], bind(scope.physicalPitchSourceId)));
        clauses.push(`(${claim('snapshot_json', [...path, 'physicalPitch', 'frame', 'gameId'], bind(scope.gameId))} AND EXISTS (SELECT 1 FROM (${nodes('snapshot_json', [...path, 'physicalPitch', 'frame', 'match', 'playId'])}) n WHERE n.atom=${bind(scope.playId)}))`);
      }
    }
    for (const [field, column, owner] of links) {
      const ids = [...(known.get(owner) ?? [])]; if (!ids.length) continue;
      indexed(column, ids);
      if (metadata) for (const [document, path] of [...mirrors, ['snapshot_json', ['receipt', 'self', 'cut']] as const]) {
        clauses.push(`EXISTS (SELECT 1 FROM (${nodes(document, [...path, field])}) n WHERE n.type='text' AND n.atom IN (SELECT value FROM json_each(${bind(JSON.stringify(ids))})))`);
      }
      if (metadata) for (const path of embedded[field] ?? []) clauses.push(`EXISTS (SELECT 1 FROM (${nodes('snapshot_json', path)}) n WHERE n.type='text' AND n.atom IN (SELECT value FROM json_each(${bind(JSON.stringify(ids))})))`);
    }
    return clauses.length ? db.prepare(`SELECT * FROM ${table} WHERE ${clauses.join(' OR ')}`).all(bindings) : [];
  };
  for (const domain of domains) {
    const ids = new Set<string>(); known.set(domain.owner, ids);
    const links: readonly Link[] = domain.previous ? [...domain.links, [domain.previous, 'previous_source_id', domain.owner]] : domain.links;
    const seen = new Set<string>();
    // A root predecessor can be relevant only through another root's Source or
    // a head; repeat metadata discovery until every such identity is reconciled.
    while (true) {
      // Row discovery can reveal a Source named by a foreign-scope head. Repeat
      // the head census with those IDs and authenticate its scope, not only its ID.
      const heads = domain.head ? select(domain.head.owner, domain.head.links ?? links, ids, false) : [];
      if (heads.length && !domain.root || heads.length > 1) fail();
      for (const head of heads) {
        if (!id(head.source_id) || head.physical_pitch_source_id !== scope.physicalPitchSourceId
          || head.game_id !== undefined && head.game_id !== scope.gameId
          || head.play_id !== undefined && head.play_id !== scope.playId) fail();
        ids.add(head.source_id);
      }
      const rows = select(domain.owner, links, ids, true);
      if (rows.length && !domain.root) fail();
      let changed = false;
      for (const row of rows) {
        if (!id(row.source_id)) fail();
        if (seen.has(row.source_id)) continue;
        if (row.physical_pitch_source_id !== undefined && row.physical_pitch_source_id !== scope.physicalPitchSourceId) fail();
        const parent = domain.links.find(([field]) => field === domain.parent)!;
        const fields = ['sourceId', domain.parent!, ...(domain.root === 'flight' ? ['searchDurationTicks'] : [])];
        const projected = db.prepare(`SELECT ${projection('$document', fields)} AS value`).get({ document: String(row.source_json) })!;
        const candidates = [...(known.get(parent[2]) ?? [])];
        const selected = candidates.find(value => matches(projected.value as string, { sourceId: row.source_id as string,
          [domain.parent!]: value, ...(domain.root === 'flight' ? { searchDurationTicks: 0 } : {}) }));
        if (!selected) fail();
        const snapshots = db.prepare(`SELECT ${projection('n.value', fields)} AS value FROM (${nodes('$document', ['source'])}) n`).all({ document: String(row.snapshot_json) });
        if (snapshots.length !== 1 || snapshots[0].value !== projected.value) fail();
        ids.add(row.source_id); seen.add(row.source_id); changed = true;
        if (domain.previous) {
          const previous = db.prepare(`SELECT type,atom FROM (${nodes('$document', [domain.previous])})`).all({ document: String(row.source_json) });
          if (previous.length > 1 || previous.some(v => v.type !== 'null' && (v.type !== 'text' || !id(v.atom)))) fail();
          if (previous[0]?.type === 'text') ids.add(previous[0].atom as string);
        }
      }
      if (!changed) break;
    }
    if ([...ids].some(sourceId => !seen.has(sourceId))) fail();
  }
};

/** Prospective enrollment admits no physical/configuration work at all. It
 * uses the declared original owner graph and typed original PA/pitch mirrors;
 * a shared Player identity never links otherwise unrelated PA histories. */
export const assertSamePaRegistrationBeforeWork = (db:Db,scope:Scope & Readonly<{actorSourceId:string;initialWorldSourceId?:string;activationApplicationId?:string}>):void => {
  const owners=new Set(['physical_pitch_progress_actions','physical_pitch_progress_heads','actual_live_play_runtimes',
    'actual_live_play_fences','actual_first_base_play_ends','actual_foul_play_ends',...domains.flatMap(d=>[d.owner,...(d.head?[d.head.owner]:[])])]);
  const paths:readonly Path[]=[[],['source'],['frame'],['scope'],['physicalPitch','frame'],['frame','batterActor'],['frame','batterActor','source'],
    ...contexts,...flights.flatMap(p=>[[...p,'physicalPitch','frame'] as Path,[...p,'physicalPitch'] as Path,
      [...p,'physicalPitch','frame','batterActor'] as Path,[...p,'physicalPitch','frame','batterActor','source'] as Path])];
  for(const owner of owners){
    const schema=db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(owner);
    if(!schema.length)continue;
    if(schema.length!==1||schema[0].type!=='table'||schema[0].name!==owner)fail();
    const cols=new Set(db.prepare(`PRAGMA main.table_info(${owner})`).all().map(c=>String(c.name)));
    const clauses:string[]=[];
    if(cols.has('game_id')&&cols.has('play_id'))clauses.push('(game_id=$game AND play_id=$play)');
    if(cols.has('physical_pitch_source_id'))clauses.push('physical_pitch_source_id=$pitch');
    if(owner==='physical_pitch_progress_actions'&&cols.has('source_id'))clauses.push('source_id=$pitch');
    if(owner==='physical_pitch_progress_heads'&&cols.has('last_source_id'))clauses.push('last_source_id=$pitch');
    for(const document of ['source_json','snapshot_json','proof_json'])if(cols.has(document)){
      for(const path of paths){
        clauses.push(claim(document,[...path,'physicalPitchSourceId'],'$pitch'));
        clauses.push(claim(document,[...path,'initialWorldSourceId'],'$initial'));
        clauses.push(claim(document,[...path,'activationApplicationId'],'$activation'));
        if(path.includes('batterActor'))clauses.push(claim(document,[...path,'sourceId'],'$actor'));
        clauses.push(`(${claim(document,[...path,'gameId'],'$game')} AND EXISTS(SELECT 1 FROM (${nodes(document,[...path,'playId'])}) n WHERE n.type IN ('integer','real') AND n.atom=$play))`);
        clauses.push(`(${claim(document,[...path,'gameId'],'$game')} AND EXISTS(SELECT 1 FROM (${nodes(document,[...path,'match','playId'])}) n WHERE n.type IN ('integer','real') AND n.atom=$play))`);
      }
      if(owner==='physical_pitch_progress_actions')for(const path of [[],['source']] as const)clauses.push(claim(document,[...path,'sourceId'],'$pitch'));
    }
    const predicate=clauses.join(' OR '),parameters={game:scope.gameId,play:scope.playId,pitch:scope.physicalPitchSourceId,
      actor:scope.actorSourceId,initial:scope.initialWorldSourceId??null,activation:scope.activationApplicationId??null};
    if(clauses.length&&db.prepare(`SELECT 1 FROM main.${owner} WHERE ${predicate} LIMIT 1`)
      .get(Object.fromEntries(Object.entries(parameters).filter(([key])=>predicate.includes('$'+key))))){
      throw new Error('same-PA enrollment must precede every original physical work/pitch claim');
    }
  }
};
