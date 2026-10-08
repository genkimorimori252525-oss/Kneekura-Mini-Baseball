import { actualLiveRuntimeClaims } from './ActualLivePlayOwnerMetadata';
/** Transaction-local guard shared by every original-pitch live admission route.
 * A completed physical envelope owns the fence; this module cannot create one.
 * Historical reads and identical retries never enter new-write admission. */
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare' | 'isTransaction'>;
export type ActualLivePlayWriteScope = Readonly<{ gameId: string; playId: number; physicalPitchSourceId?: string }>;
export type ActualLivePlayWriteFence = Readonly<{ scope: ActualLivePlayWriteScope }>;
export const actualLiveAdmissionOwners = ['physical_plate_appearance_actors', 'physical_pitch_progress_actions',
  'batted_ball_flights', 'batted_world_contacts', 'batted_first_fielder_touches', 'batted_contact_responses',
  'batted_post_response_flights', 'batted_world_continuations', 'batted_world_acquisitions', 'batted_world_motions',
  'batted_world_executions', 'batted_world_field_actions', 'batted_world_field_executions', 'actual_field_observations',
  'actual_defensive_plans', 'actual_defensive_decisions', 'actual_locomotion_receipts', 'actual_live_rule_consumptions', 'actual_runner_public_knowledge',
  'actual_first_base_umpire_setups', 'actual_first_base_umpire_observations', 'actual_first_base_umpire_calls',
  'actual_call_communications', 'actual_settled_foul_stop_productions', 'actual_foul_rule_consumptions'] as const;
export type ActualLiveAdmission = Readonly<{ owner: typeof actualLiveAdmissionOwners[number]; sourceId: string }>;
const tokens = new WeakMap<ActualLivePlayWriteFence, { db: Db; state: string; runtimeId: string | null;
  event?: ActualLiveAdmission; journalBefore: string; journalAfter: string | null; output: Record<string, unknown> | null }>();
const runtimes = (db: Db, scope: ActualLivePlayWriteScope) => {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actual_live_play_runtimes'").get()) return [];
  const rows = actualLiveRuntimeClaims(db, scope);
  if (rows.some(row => row.game_id !== scope.gameId || row.play_id !== scope.playId
    || scope.physicalPitchSourceId !== undefined && row.physical_pitch_source_id !== scope.physicalPitchSourceId)) {
    throw new Error('actual live-play runtime ownership metadata differs');
  }
  return rows;
};
const journal = (db: Db, runtimeId: string) => db.prepare('SELECT * FROM actual_live_play_admissions WHERE runtime_source_id=? ORDER BY sequence').all(runtimeId);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const state = (db: Db, scope: ActualLivePlayWriteScope, includeRuntime = true): string => {
  if (!db.isTransaction) throw new Error('actual live-play fence requires an active write transaction');
  const closureSchema = db.prepare("SELECT type,sql FROM sqlite_master WHERE name='actual_first_base_play_ends'").all();
  if (closureSchema.length) {
    if (closureSchema.length !== 1 || closureSchema[0].type !== 'table') throw new Error('actual live-play terminal owner differs');
    const claims = db.prepare(`SELECT source_id FROM actual_first_base_play_ends WHERE (game_id=$game AND play_id=$play)
      OR physical_pitch_source_id=$pitch OR NOT json_valid(snapshot_json) OR NOT json_valid(source_json)
      OR EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(source_json) THEN source_json ELSE '{}' END)
        WHERE key='runtimeSourceId' AND value IN (SELECT value FROM json_each($runtimeIds)))
      OR EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(snapshot_json) THEN snapshot_json ELSE '{}' END) parent,
        json_each(CASE WHEN parent.type='object' THEN parent.value ELSE '{}' END) child
        WHERE parent.key='source' AND child.key='runtimeSourceId' AND child.value IN (SELECT value FROM json_each($runtimeIds)))
      OR EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(snapshot_json) THEN snapshot_json ELSE '{}' END)
        WHERE key='physicalPitchSourceId' AND value=$pitch)
      OR (EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(snapshot_json) THEN snapshot_json ELSE '{}' END) WHERE key='gameId' AND value=$game)
        AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(snapshot_json) THEN snapshot_json ELSE '{}' END) WHERE key='playId' AND value=$play))`)
      .all({ game: scope.gameId, play: scope.playId, pitch: scope.physicalPitchSourceId ?? null,
        runtimeIds: JSON.stringify(runtimes(db, scope).map(row => row.source_id)) });
    if (claims.length) throw new Error('actual live play has terminal closure ownership and is sealed');
  }
  const schema = db.prepare("SELECT type,sql FROM sqlite_master WHERE name='actual_live_play_fences'").all();
  if (!schema.length) return JSON.stringify(['not_installed', closureSchema, includeRuntime ? runtimes(db, scope) : null]);
  if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('actual live-play fence owner differs');
  const rows = db.prepare(`SELECT * FROM actual_live_play_fences WHERE (game_id=? AND play_id=?)
    OR physical_pitch_source_id=?`).all(scope.gameId, scope.playId, scope.physicalPitchSourceId ?? null);
  // Any claim closes admission, even a corrupt or cross-game claim. The complete
  // physical reader authenticates the closure; a writer must never ignore it.
  if (rows.length) throw new Error('actual live play is sealed against new causal work');
  return JSON.stringify([schema, closureSchema, includeRuntime ? runtimes(db, scope) : null]);
};
export const beginActualLivePlayWrite = (db: Db, scope: ActualLivePlayWriteScope, event?: ActualLiveAdmission): ActualLivePlayWriteFence => {
  if (!id(scope.gameId) || !Number.isSafeInteger(scope.playId) || scope.playId < 0
    || scope.physicalPitchSourceId !== undefined && !id(scope.physicalPitchSourceId)) throw new Error('invalid actual live-play write scope');
  const token = Object.freeze({ scope: Object.freeze({ ...scope }) });
  const originalState = state(db, token.scope), runtime = runtimes(db, token.scope);
  if (runtime.length > 1) throw new Error('actual live-play runtime ownership differs');
  if (runtime.length && (!event || !actualLiveAdmissionOwners.includes(event.owner) || !id(event.sourceId))) {
    throw new Error('registered actual live-play admission requires its concrete producer');
  }
  const runtimeId = runtime.length ? String(runtime[0].source_id) : null;
  if (event?.owner === 'actual_settled_foul_stop_productions'
    && (!runtimeId || !['causal_original_settled_foul_runtime_v1', 'causal_original_settled_foul_count_runtime_v1',
      'causal_original_settled_foul_end_runtime_v1']
      .includes(JSON.parse(String(runtime[0].source_json)).capability))) {
    throw new Error('settled-foul admission requires its explicit registered runtime capability');
  }
  if (event?.owner === 'actual_foul_rule_consumptions'
    && (!runtimeId || !['causal_original_settled_foul_count_runtime_v1', 'causal_original_settled_foul_end_runtime_v1']
      .includes(JSON.parse(String(runtime[0].source_json)).capability))) {
    throw new Error('foul count admission requires its explicit registered count runtime capability');
  }
  if (runtimeId && ['physical_pitch_progress_actions', 'physical_plate_appearance_actors'].includes(event!.owner)) {
    throw new Error('registered actual live-play original pitch is already fixed');
  }
  tokens.set(token, { db, state: originalState, runtimeId, event,
    journalBefore: runtimeId ? JSON.stringify(journal(db, runtimeId)) : '', journalAfter: null, output: null });
  return token;
};
/** Record after the producer/head writes, BEFORE its final dependency replay.
 * This insertion can fire triggers, so all concrete owners verify again after it. */
export const recordActualLivePlayAdmission = (db: Db, token: ActualLivePlayWriteFence): void => {
  const original = tokens.get(token);
  if (!original || original.db !== db || state(db, token.scope) !== original.state) throw new Error('actual live-play fence changed during write');
  if (!original.runtimeId) return;
  if (original.journalAfter !== null) throw new Error('actual live-play admission already recorded');
  const rows = journal(db, original.runtimeId), event = original.event!;
  if (JSON.stringify(rows) !== original.journalBefore || rows.some(r => r.owner === event.owner && r.source_id === event.sourceId)
    || rows.some((r, i) => r.sequence !== i + 1)) throw new Error('actual live-play admission journal changed during write');
  const output = db.prepare(`SELECT * FROM ${event.owner} WHERE source_id=?`).get(event.sourceId);
  if (!output || !id(output.source_hash) || !id(output.snapshot_hash)) throw new Error('actual live-play producer output missing');
  const receipt = { runtime_source_id: original.runtimeId, sequence: rows.length + 1, owner: event.owner,
    source_id: event.sourceId, source_hash: output.source_hash, snapshot_hash: output.snapshot_hash };
  db.prepare('INSERT INTO actual_live_play_admissions VALUES (?,?,?,?,?,?)').run(...Object.values(receipt));
  original.journalAfter = JSON.stringify([...rows, receipt]); original.output = output;
  assertActualLivePlayWriteUnchanged(db, token);
};
export const assertActualLivePlayWriteUnchanged = (db: Db, token: ActualLivePlayWriteFence): void => {
  const original = tokens.get(token);
  if (!original || original.db !== db || state(db, token.scope) !== original.state) throw new Error('actual live-play fence changed during write');
  if (!original.runtimeId) return;
  if (original.journalAfter === null || original.output === null) throw new Error('actual live-play admission must be recorded before final verification');
  const event = original.event!, output = db.prepare(`SELECT * FROM ${event.owner} WHERE source_id=?`).get(event.sourceId);
  if (JSON.stringify(journal(db, original.runtimeId)) !== original.journalAfter || !output
    || Object.keys(output).sort().join('|') !== Object.keys(original.output).sort().join('|')
    || Object.keys(output).some(key => output[key] !== original.output![key])) throw new Error('actual live-play admission or producer changed after receipt');
};
/** The concrete owner has already authenticated its pitch. This indexed lookup
 * shares that transaction and prevents an alternate Source from bypassing scope. */
export const beginActualLivePitchWrite = (db: Db, physicalPitchSourceId: string, event: ActualLiveAdmission) => {
  const row = db.prepare('SELECT game_id,play_id FROM physical_pitch_progress_actions WHERE source_id=?').get(physicalPitchSourceId);
  if (!row || !id(row.game_id) || typeof row.play_id !== 'number') throw new Error('actual live-play original pitch scope missing');
  return beginActualLivePlayWrite(db, { gameId: row.game_id, playId: row.play_id, physicalPitchSourceId }, event);
};

const registrationTokens = new WeakMap<ActualLivePlayWriteFence, Readonly<{ db: Db; state: string }>>();
export const beginActualLivePlayRegistration = (db: Db, scope: ActualLivePlayWriteScope): ActualLivePlayWriteFence => {
  if (!id(scope.gameId) || !Number.isSafeInteger(scope.playId) || scope.playId < 0 || !id(scope.physicalPitchSourceId)) {
    throw new Error('invalid actual live-play registration scope');
  }
  if (runtimes(db, scope).length) throw new Error('actual live-play runtime already registered');
  const token = Object.freeze({ scope: Object.freeze({ ...scope }) });
  registrationTokens.set(token, { db, state: state(db, token.scope, false) });
  return token;
};
export const assertActualLivePlayRegistrationUnchanged = (db: Db, token: ActualLivePlayWriteFence): void => {
  const original = registrationTokens.get(token);
  if (!original || original.db !== db || state(db, token.scope, false) !== original.state) throw new Error('actual live-play registration seal state changed');
};
