import { createRequire } from 'node:module';
import { beginActualLivePlayWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { readOriginalPrePitchRunnerRecipient } from './PrePitchRunnerEvidenceFromSqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze, assertPhysicalActorOpenFrame,
  readPhysicalActorForPlayFromSqlite, readPhysicalPlateAppearanceActorFromSqlite,
  type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection,
  sqliteJsonMetadataMatches as matches, type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import { runnerContactWaitId as id, runnerContactWaitPolicyInput as policyInput, runnerContactWaitViewInput as viewInput,
  type AcceptedRunnerVisibleContactWaitPolicy, type AcceptedRunnerEventView, type RunnerContactWaitPolicyAdmission,
  type RunnerContactWaitViewAdmission, type RunnerContactWaitPolicyViewAuthority,
  type RunnerContactWaitPolicyViewStore } from './RunnerContactWaitPolicyView';
export type { AcceptedRunnerVisibleContactWaitPolicy, AcceptedRunnerEventView, RunnerContactWaitPolicyAdmission,
  RunnerContactWaitViewAdmission, RunnerContactWaitPolicyViewAuthority, RunnerContactWaitPolicyViewStore } from './RunnerContactWaitPolicyView';

type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Row = { source_id: string; source_version: string; source_json: string; source_hash: string;
  snapshot_json: string; snapshot_hash: string };
type PolicyRow = Row & { career_id: string; player_id: string; person_link_source_id: string;
  observation_model_source_id: string; accepted_at_day: number };
type ViewRow = Row & { physical_actor_source_id: string; game_id: string; play_id: number; player_id: string;
  policy_source_id: string; valid_from_tick: number; valid_through_tick: number };
const claim = (document: string, path: SqliteJsonMetadataPath, parameter: string) =>
  `EXISTS (SELECT 1 FROM (${nodes(document, path)}) n WHERE n.atom=${parameter})`;
const objectClaim = (document: string, path: SqliteJsonMetadataPath, values: Readonly<Record<string, string>>) =>
  `EXISTS (SELECT 1 FROM (${nodes(document, path)}) owner WHERE owner.type='object'
    AND ${Object.entries(values).map(([key, parameter]) => claim('owner.value', [key], parameter)).join(' AND ')})`;
const exists = (db: Db, table: string) => !!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(table);
const metadata = (db: Db, document: string, path: SqliteJsonMetadataPath, expected: Record<string, string | number>) => {
  const row = db.prepare(`SELECT count(*) AS n,sum(owner.type='object') AS typed,
    CASE WHEN owner.type='object' THEN ${projection('owner.value', Object.keys(expected))} END AS value
    FROM (${nodes('$document', path)}) owner`).get({ document }) as { n: number; typed: number; value: string | null };
  if (row.n !== 1 || row.typed !== 1 || !matches(row.value, expected)) throw new Error('runner contact wait ownership metadata differs');
};
const identities = <T extends Row>(db: Db, table: string, sourceId: string): T | null => {
  if (!id(sourceId)) throw new Error('invalid runner contact wait Source identity');
  if (!exists(db, table)) return null;
  const rows = db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
    OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: sourceId }) as T[];
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('runner contact wait Source identity scope differs');
  return rows[0] ?? null;
};

/** Same-connection main authority, preserving the caller's transaction and settings. */
const withRunnerContactWaitReadSnapshot = <T>(db: Db, body: () => T): T => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('runner contact wait evidence requires its actual native connection');
  const mainOnly = () => {
    // Transitive physical, binding and model readers also use unqualified SQL.
    const databases = db.prepare('PRAGMA database_list').all();
    if (databases.filter(row => row.name === 'main').length !== 1
      || databases.some(row => row.name !== 'main' && row.name !== 'temp')
      || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
      throw new Error('runner contact wait evidence requires main-only authority storage');
    }
  };
  const read = () => withBattedWorldPhysicalReadTraversal(db, () => {
    mainOnly(); const value = body(); mainOnly(); return value;
  });
  if (db.isTransaction) return read();
  db.exec('BEGIN');
  try {
    const value = read();
    if (!db.isTransaction) throw new Error('runner contact wait read transaction disappeared');
    db.exec('COMMIT'); return value;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
};

const runnerContactWaitPolicyViewOwner = (db: Db) => {
  const models = playerObservationModelEvidenceFromSqlite(db);
  const derivePolicy = (source: AcceptedRunnerVisibleContactWaitPolicy): RunnerContactWaitPolicyAdmission => {
    const model = models.read(source.observationModelSourceId);
    if (!model || model.source.careerId !== source.careerId || model.source.playerId !== source.playerId
      || model.source.personLinkSourceId !== source.personLinkSourceId || source.acceptedAtDay < model.source.acceptedAtDay
      || source.ticksPerSecond !== model.source.calibration.memoryDecayParameters.ticksPerSecond) {
      throw new Error('runner contact wait policy original observation model/Player/Person/day/clock differs');
    }
    return freeze({ source, sourceHash: hash(source), observationModelHash: hash(model) });
  };
  const readPolicy = (sourceId: string): RunnerContactWaitPolicyAdmission | null => {
    const row = identities<PolicyRow>(db, 'actual_runner_contact_wait_policies', sourceId);
    if (!row) return null;
    const expected = { sourceId: row.source_id, sourceVersion: row.source_version, capability: 'runner_visible_contact_fly_wait_v1',
      careerId: row.career_id, playerId: row.player_id, personLinkSourceId: row.person_link_source_id,
      observationModelSourceId: row.observation_model_source_id, acceptedAtDay: row.accepted_at_day };
    metadata(db, row.source_json, [], expected); metadata(db, row.snapshot_json, ['source'], expected);
    const source = policyInput(JSON.parse(row.source_json), sourceId), value = derivePolicy(source);
    if (row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original runner contact wait policy archive');
    return value;
  };
  const actorFor = (source: AcceptedRunnerEventView): DurablePhysicalPlateAppearanceActor => {
    // An alias in either actor archive mirror cannot evade the original actor identity.
    const claims = db.prepare(`SELECT source_id FROM main.physical_plate_appearance_actors WHERE source_id=$id
      OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`)
      .all({ id: source.physicalActorSourceId });
    if (claims.length !== 1 || claims[0].source_id !== source.physicalActorSourceId) throw new Error('runner event view original actor ownership differs');
    const actor = readPhysicalPlateAppearanceActorFromSqlite(db, source.physicalActorSourceId);
    if (!actor || actor.source.gameId !== source.gameId) throw new Error('runner event view original actor/game scope differs');
    return actor;
  };
  const deriveView = (source: AcceptedRunnerEventView): RunnerContactWaitViewAdmission => {
    const actor = actorFor(source), recipient = readOriginalPrePitchRunnerRecipient(db, actor, source.playerId);
    const policy = readPolicy(source.policySourceId), binding = recipient.binding;
    if (!policy || policy.source.playerId !== binding.playerId || policy.source.careerId !== binding.careerId
      || policy.source.personLinkSourceId !== binding.personLinkSourceId || policy.source.acceptedAtDay > binding.gameDay
      || source.validFromTick < actor.world.tick || source.attentionStartedAtTick < actor.world.tick) {
      throw new Error('runner event view original recipient/policy/day/prospective scope differs');
    }
    const model = models.read(policy.source.observationModelSourceId);
    if (!model || json(model.fieldingModel.person) !== json(recipient.person)) throw new Error('runner event view original Player/Person differs');
    return freeze({ source, sourceHash: hash(source), policyHash: hash(policy), observationModelHash: hash(model),
      actorHash: hash(actor), recipientBindingHash: hash(binding),
      registeredAt: { originTick: actor.world.tick, elapsedSeconds: 0, tick: actor.world.tick },
      admission: 'prospective_before_dependent_pitch' as const });
  };
  const decodeView = (row: ViewRow): RunnerContactWaitViewAdmission => {
    const expected = { sourceId: row.source_id, sourceVersion: row.source_version, kind: 'prospective_runner_event_view_v1',
      physicalActorSourceId: row.physical_actor_source_id, gameId: row.game_id, playerId: row.player_id,
      policySourceId: row.policy_source_id, validFromTick: row.valid_from_tick, validThroughTick: row.valid_through_tick };
    metadata(db, row.source_json, [], expected); metadata(db, row.snapshot_json, ['source'], expected);
    const source = viewInput(JSON.parse(row.source_json), row.source_id), value = deriveView(source), actor = actorFor(source);
    if (row.play_id !== actor.match.playId || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt original runner event view archive');
    return value;
  };
  const scopeViews = (source: AcceptedRunnerEventView) => {
    const actor = actorFor(source);
    const scope = { physicalActorSourceId: '$actor', playerId: '$player' };
    const rows = db.prepare(`SELECT * FROM main.actual_runner_event_views WHERE (physical_actor_source_id=$actor AND player_id=$player)
      OR (game_id=$game AND play_id=$play AND player_id=$player)
      OR ${objectClaim('source_json', [], scope)} OR ${objectClaim('snapshot_json', ['source'], scope)}`)
      .all({ actor: source.physicalActorSourceId, player: source.playerId, game: source.gameId, play: actor.match.playId }) as ViewRow[];
    const values = rows.map(decodeView);
    if (values.some(v => v.source.physicalActorSourceId !== source.physicalActorSourceId || v.source.playerId !== source.playerId)) {
      throw new Error('runner event view scope identity differs');
    }
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
      if (values[i].source.validFromTick <= values[j].source.validThroughTick
        && values[j].source.validFromTick <= values[i].source.validThroughTick) throw new Error('competing overlapping runner event view scope');
    }
    return values;
  };
  const readView = (sourceId: string): RunnerContactWaitViewAdmission | null => {
    const row = identities<ViewRow>(db, 'actual_runner_event_views', sourceId);
    if (!row) return null;
    const value = decodeView(row), values = scopeViews(value.source);
    if (values.filter(v => v.source.sourceId === sourceId).length !== 1) throw new Error('runner event view is outside its original scope');
    return value;
  };
  const prospective = (source: AcceptedRunnerEventView) => {
    const actor = actorFor(source), current = readPhysicalActorForPlayFromSqlite(db, source.gameId, actor.match.playId);
    if (json(current) !== json(actor)) throw new Error('runner event view prospective actor frame differs');
    assertPhysicalActorOpenFrame(db, actor);
    if (exists(db, 'physical_pitch_progress_actions')) {
      const activation = 'activationApplicationId' in actor.source
        ? objectClaim('source_json', [], { gameId: '$game', activationApplicationId: '$activation' })
        : objectClaim('source_json', [], { gameId: '$game', initialWorldSourceId: '$activation' });
      const rows = db.prepare(`SELECT source_id FROM main.physical_pitch_progress_actions WHERE (game_id=$game AND play_id=$play)
        OR ${objectClaim('snapshot_json', ['frame'], { gameId: '$game' })}
          AND ${claim('snapshot_json', ['frame', 'match', 'playId'], '$play')}
        OR ${claim('snapshot_json', ['frame', 'batterActor', 'source', 'sourceId'], '$actor')}
        OR ${claim('snapshot_json', ['frame', 'prePitchRunner', 'source', 'physicalActorSourceId'], '$actor')}
        OR ${claim('source_json', ['prePitchRunner', 'physicalActorSourceId'], '$actor')}
        OR ${claim('source_json', ['battingIntent', 'actorSourceId'], '$actor')} OR ${activation}`)
        .all({ game: source.gameId, play: actor.match.playId, actor: actor.source.sourceId,
          activation: 'activationApplicationId' in actor.source ? actor.source.activationApplicationId : actor.source.initialWorldSourceId });
      if (rows.length) throw new Error('runner event view must be prospective before the dependent pitch');
    }
    if (exists(db, 'physical_pitch_progress_heads') && db.prepare('SELECT 1 FROM main.physical_pitch_progress_heads WHERE game_id=? AND play_id=?')
      .get(source.gameId, actor.match.playId)) throw new Error('runner event view prospective pitch head has already advanced');
    return actor;
  };
  const policyBefore = (value: RunnerContactWaitPolicyAdmission) => {
    if (readPolicy(value.source.sourceId) || json(derivePolicy(value.source)) !== json(value)) {
      throw new Error('runner contact wait policy dependencies changed before write');
    }
  };
  const viewBefore = (value: RunnerContactWaitViewAdmission) => {
    prospective(value.source);
    if (readView(value.source.sourceId) || json(deriveView(value.source)) !== json(value)) throw new Error('runner event view dependencies changed before write');
    if (scopeViews(value.source).some(v => v.source.validFromTick <= value.source.validThroughTick
      && value.source.validFromTick <= v.source.validThroughTick)) throw new Error('competing overlapping runner event view scope');
  };
  return { readPolicy, readView, derivePolicy, deriveView, prospective, policyBefore, viewBefore };
};

/** References-only saved ownership evidence; reconstruction cannot manufacture an admission. */
export const runnerContactWaitPolicyViewEvidenceFromSqlite = (db: Db) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('runner contact wait evidence requires its actual native connection');
  const own = runnerContactWaitPolicyViewOwner(db);
  return Object.freeze({ readPolicy: (sourceId: string) => withRunnerContactWaitReadSnapshot(db, () => own.readPolicy(sourceId)),
    readView: (sourceId: string) => withRunnerContactWaitReadSnapshot(db, () => own.readView(sourceId)) });
};

/** Stage A owns prospective prerequisites only; no event capture, decision, issuance or settlement. */
export const openSqliteRunnerContactWaitStore = (path: string, authority?: RunnerContactWaitPolicyViewAuthority): RunnerContactWaitPolicyViewStore => {
  if (!id(path) || authority != null && (typeof authority.readAcceptedPolicy !== 'function' || typeof authority.readAcceptedView !== 'function')) {
    throw new Error('invalid runner contact wait owner');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
    db.exec(`CREATE TABLE IF NOT EXISTS main.actual_runner_contact_wait_policies (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
      career_id TEXT NOT NULL,player_id TEXT NOT NULL,person_link_source_id TEXT NOT NULL,observation_model_source_id TEXT NOT NULL,
      accepted_at_day INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS main.actual_runner_event_views (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
      physical_actor_source_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,player_id TEXT NOT NULL,policy_source_id TEXT NOT NULL,
      valid_from_tick INTEGER NOT NULL,valid_through_tick INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
    const own = runnerContactWaitPolicyViewOwner(db); let closed = false;
    const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed runner contact wait scope'); };
    const reading = <T>(work: () => T): T => withRunnerContactWaitReadSnapshot(db, work);
    return Object.freeze({
      readPolicy(sourceId) { check(sourceId); return reading(() => own.readPolicy(sourceId)); },
      readView(sourceId) { check(sourceId); return reading(() => own.readView(sourceId)); },
      acceptPolicy(sourceId) {
        check(sourceId); const prior = reading(() => own.readPolicy(sourceId)), raw = authority?.readAcceptedPolicy(sourceId) ?? null;
        const source = raw === null ? null : policyInput(raw, sourceId);
        if (prior) {
          if (source && json(source) !== json(prior.source)) throw new Error('runner contact wait policy Source is frozen differently');
          const saved = reading(() => own.readPolicy(sourceId));
          if (json(saved) !== json(prior)) throw new Error('runner contact wait policy changed during retry');
          return saved!;
        }
        if (!source) throw new Error('accepted runner contact wait policy Source is missing');
        const value = reading(() => own.derivePolicy(source));
        db.exec('BEGIN IMMEDIATE');
        try {
          own.policyBefore(value);
          db.prepare('INSERT INTO main.actual_runner_contact_wait_policies VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion,
            source.careerId, source.playerId, source.personLinkSourceId, source.observationModelSourceId, source.acceptedAtDay,
            json(source), hash(source), json(value), hash(value));
          const saved = own.readPolicy(sourceId);
          if (json(saved) !== json(value)) throw new Error('runner contact wait policy dependencies changed during write');
          db.exec('COMMIT'); return saved!;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
      acceptView(sourceId) {
        check(sourceId); const prior = reading(() => own.readView(sourceId)), raw = authority?.readAcceptedView(sourceId) ?? null;
        const source = raw === null ? null : viewInput(raw, sourceId);
        if (prior) {
          if (source && json(source) !== json(prior.source)) throw new Error('runner event view Source is frozen differently');
          const saved = reading(() => own.readView(sourceId));
          if (json(saved) !== json(prior)) throw new Error('runner event view changed during historical retry');
          return saved!;
        }
        if (!source) throw new Error('accepted runner event view Source is missing');
        const value = reading(() => own.deriveView(source));
        db.exec('BEGIN IMMEDIATE');
        try {
          own.viewBefore(value);
          const actor = own.prospective(source), fence = beginActualLivePlayWrite(db, { gameId: source.gameId, playId: actor.match.playId });
          db.prepare('INSERT INTO main.actual_runner_event_views VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion,
            source.physicalActorSourceId, source.gameId, actor.match.playId, source.playerId, source.policySourceId,
            source.validFromTick, source.validThroughTick, json(source), hash(source), json(value), hash(value));
          recordActualLivePlayAdmission(db, fence);
          own.prospective(source); const saved = own.readView(sourceId);
          if (json(saved) !== json(value)) throw new Error('runner event view dependencies changed during write');
          assertActualLivePlayWriteUnchanged(db, fence); db.exec('COMMIT'); return saved!;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
      close() { if (!closed) { db.close(); closed = true; } },
    });
  } catch (error) { db.close(); throw error; }
};
