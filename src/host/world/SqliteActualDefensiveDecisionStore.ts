import { beginActualLivePitchWrite, recordActualLivePlayAdmission, assertActualLivePlayWriteUnchanged } from './ActualLivePlayFence';
import { createRequire } from 'node:module';
import { assertDefensiveMetadataUnambiguous as unambiguous, defensiveMetadataId as metadataId, defensiveMetadataScope as metadataScope } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches } from './SqliteOwnershipMetadata';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { type DefensiveIntentCandidate } from '../../core/sim/fielding/DefensiveDecision';
import { calculateDefensiveExecution } from './DefensiveExecutionCalculation';
import type { Vec2 } from '../../core/model/geometry';
import { actualObservationId as id, type ActualObservationMoment } from './ActualFieldObservation';
import { actualDefensiveBoundary, actualDefensiveContextFromSqlite, defensiveFields as fields, defensiveTick, type DefensiveDb } from './ActualDefensiveContext';
import { actualDefensivePlanEvidenceFromSqlite } from './SqliteActualDefensivePlanStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** No caller clock, outcome, target, cue or physical execution. Later Sources advance the same decision, never replan. */
export type AcceptedActualDefensiveDecision = Readonly<{
  sourceId: string; sourceVersion: string; physicalPitchSourceId: string; playerId: string; observationSourceId: string;
  decisionModelSourceId: string; planSourceId: string; previousDecisionSourceId: string | null;
}>;
export type ActualDefensiveDecisionReceipt = Readonly<{
  originDecisionSourceId: string; originObservationSourceId: string;
  self: ReturnType<ReturnType<typeof actualDefensiveContextFromSqlite>['read']>['self'];
  availability: ActualObservationMoment; observedThrough: ActualObservationMoment; ticksPerSecond: number;
  selected: DefensiveIntentCandidate; target: Vec2 | null;
  evidence: Readonly<{ captureAt: ActualObservationMoment; confidence: number }> | null;
  scheduling: Readonly<{ startedAtTick: number; decisionDelayTicks: number; decisionTick: number; firstStepDelayTicks: number; movementStartTick: number }>;
  lifecycle: Readonly<{ status: 'pending_decision' | 'pending_first_step' | 'issued'; issuedAt: ActualObservationMoment | null; issuedBySourceId: string | null }>;
}>;
export type DurableActualDefensiveDecision = Readonly<{ source: AcceptedActualDefensiveDecision; revision: number;
  history: readonly AcceptedActualDefensiveDecision[]; observationHash: string; decisionModelHash: string; planHash: string;
  receipt: ActualDefensiveDecisionReceipt }>;
type Authority = Readonly<{ readAcceptedDecision(sourceId: string): AcceptedActualDefensiveDecision | null }>;
type Row = { source_id: string; source_version: string; physical_pitch_source_id: string; player_id: string; observation_source_id: string;
  decision_model_source_id: string; plan_source_id: string; previous_source_id: string | null; revision: number;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type Head = { physical_pitch_source_id: string; player_id: string; source_id: string; revision: number };
const input = (raw: AcceptedActualDefensiveDecision, sourceId?: string): AcceptedActualDefensiveDecision => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'observationSourceId', 'decisionModelSourceId', 'planSourceId', 'previousDecisionSourceId'])
    || sourceId !== undefined && s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.physicalPitchSourceId, s.playerId, s.observationSourceId, s.decisionModelSourceId, s.planSourceId].every(id)
    || s.previousDecisionSourceId !== null && (!id(s.previousDecisionSourceId) || s.previousDecisionSourceId === s.sourceId)) {
    throw new Error('invalid accepted actual defensive decision Source');
  }
  return freeze(s);
};
export const actualDefensiveDecisionEvidenceFromSqlite = (db: DefensiveDb) => {
  const contexts = actualDefensiveContextFromSqlite(db), plans = actualDefensivePlanEvidenceFromSqlite(db), models = playerDecisionModelEvidenceFromSqlite(db);
  const dependencies = (source: AcceptedActualDefensiveDecision, current = false) => {
    const context = contexts.read(source.observationSourceId, source.physicalPitchSourceId, source.playerId, current);
    const plan = plans.read(source.planSourceId), model = models.read(source.decisionModelSourceId), b = context.binding;
    if (!plan || !model || plan.source.physicalPitchSourceId !== source.physicalPitchSourceId || plan.source.playerId !== source.playerId
      || json(plan.binding) !== json(b) || plan.source.fieldingModelSourceId !== context.fieldingModel.source.sourceId
      || model.source.playerId !== source.playerId || model.source.careerId !== b.careerId || model.source.personLinkSourceId !== b.personLinkSourceId
      || model.source.fieldingModelSourceId !== context.fieldingModel.source.sourceId || json(model.fieldingModel) !== json(context.fieldingModel)
      || model.source.acceptedAtDay > b.gameDay || plan.availability.originTick !== context.observation.receipt.at.originTick
      || plan.availability.elapsedSeconds > context.observation.receipt.at.elapsedSeconds
      || !context.observation.history.some(s => s.sourceId === plan.source.observationSourceId)) {
      throw new Error('actual defensive decision original model/plan/Player/Person/day or availability differs');
    }
    return { ...context, plan, model };
  };
  const execute = (source: AcceptedActualDefensiveDecision, previous: DurableActualDefensiveDecision | null): DurableActualDefensiveDecision => {
    const c = dependencies(source), at = c.observation.receipt.at;
    let receipt: ActualDefensiveDecisionReceipt;
    if (previous) {
      const p = previous.receipt;
      if (previous.source.decisionModelSourceId !== source.decisionModelSourceId || previous.source.planSourceId !== source.planSourceId
        || previous.source.physicalPitchSourceId !== source.physicalPitchSourceId || previous.source.playerId !== source.playerId
        || previous.decisionModelHash !== hash(c.model) || previous.planHash !== hash(c.plan)
        || !c.observation.history.some(s => s.sourceId === previous.source.observationSourceId)
        || p.observedThrough.originTick !== at.originTick || at.elapsedSeconds <= p.observedThrough.elapsedSeconds
        || c.ticksPerSecond !== p.ticksPerSecond || p.lifecycle.status === 'issued') {
        throw new Error('actual defensive decision requires later original observation; no replan or repeated issuance');
      }
      receipt = { ...p, observedThrough: at };
    } else {
      const calibration = c.model.source.calibration, perceived = c.observation.receipt.perceived;
      if (perceived.communications.length || perceived.knownContext !== null) throw new Error('actual defensive semantic context/cues are not owned');
      const calculated = calculateDefensiveExecution({ decision: { perceivedWorld: perceived, self: { playerId: source.playerId },
        prePlayPlan: c.plan.source.priorities, perceivedCues: [] }, startedAtTick: actualDefensiveBoundary(at, c.ticksPerSecond), ratings: c.fieldingModel.source.ratings }, calibration);
      const chosen = calculated.selected;
      if (chosen.intent.kind !== 'ball_handler' && chosen.intent.kind !== 'hold') throw new Error('unsupported actual defensive intent');
      const ball = chosen.intent.kind === 'ball_handler' ? c.observation.receipt.samples.ball : null;
      if (ball && (ball.at.originTick !== at.originTick || ball.at.elapsedSeconds > at.elapsedSeconds)) throw new Error('actual defensive ball evidence is from the future');
      receipt = { originDecisionSourceId: source.sourceId, originObservationSourceId: source.observationSourceId, self: c.self,
        availability: at, observedThrough: at, ticksPerSecond: c.ticksPerSecond,
        selected: { ...chosen, evidenceKinds: chosen.evidenceKinds.map(k => k === 'pre_play_plan' ? 'accepted_contextual_priorities' : k) },
        target: chosen.intent.kind === 'ball_handler' ? { x: perceived.ball!.estimate.position.x, z: perceived.ball!.estimate.position.z } : null,
        evidence: ball ? { captureAt: ball.at, confidence: perceived.ball!.confidence } : null,
        scheduling: calculated.scheduling,
        lifecycle: { status: 'pending_decision', issuedAt: null, issuedBySourceId: null } };
    }
    const reached = (tick: number) => {
      if (!defensiveTick(tick)) throw new Error('actual defensive deadline overflow');
      return at.elapsedSeconds >= (tick - at.originTick) / c.ticksPerSecond;
    };
    const status = reached(receipt.scheduling.movementStartTick) ? 'issued' : reached(receipt.scheduling.decisionTick) ? 'pending_first_step' : 'pending_decision';
    receipt = { ...receipt, lifecycle: { status, issuedAt: status === 'issued' ? at : null, issuedBySourceId: status === 'issued' ? source.sourceId : null } };
    return freeze(cloneInert({ source, revision: (previous?.revision ?? 0) + 1, history: [...(previous?.history ?? []), source],
      observationHash: hash(c.observation), decisionModelHash: hash(c.model), planHash: hash(c.plan), receipt }));
  };
  const scope = (pitchId: string, playerId: string, throughSourceId?: string): readonly DurableActualDefensiveDecision[] => {
    const owners = `(physical_pitch_source_id=? AND player_id=?)
      OR ${metadataScope('source_json')}
      OR ${metadataScope('snapshot_json', ['source'])}
      OR (${metadataId('snapshot_json', ['source', 'physicalPitchSourceId'])} AND ${metadataId('snapshot_json', ['receipt', 'self', 'playerId'])})
      OR ${metadataScope('snapshot_json', ['history', { array: 'all' }])}
      OR EXISTS (SELECT 1 FROM actual_field_observations o WHERE o.physical_pitch_source_id=? AND o.player_id=?
        AND (o.source_id=actual_defensive_decisions.observation_source_id
          OR ${metadataId('actual_defensive_decisions.source_json', ['observationSourceId'], 'o.source_id')}
          OR ${metadataId('actual_defensive_decisions.snapshot_json', ['source', 'observationSourceId'], 'o.source_id')}
          OR ${metadataId('actual_defensive_decisions.snapshot_json', ['receipt', 'originObservationSourceId'], 'o.source_id')}))`;
    const args = [pitchId, playerId, pitchId, playerId, pitchId, playerId, pitchId, playerId, pitchId, playerId, pitchId, playerId];
    const rows = db.prepare(`SELECT * FROM actual_defensive_decisions WHERE ${owners} ORDER BY revision`).all(...args) as Row[];
    const heads = db.prepare(`SELECT * FROM actual_defensive_decision_heads WHERE (physical_pitch_source_id=? AND player_id=?)
      OR source_id IN (SELECT source_id FROM actual_defensive_decisions WHERE ${owners})`).all(pitchId, playerId, ...args) as Head[];
    if (!rows.length) { if (heads.length || throughSourceId) throw new Error('unowned actual defensive decision head'); return []; }
    const head = heads[0];
    if (heads.length !== 1 || head.physical_pitch_source_id !== pitchId || head.player_id !== playerId
      || head.source_id !== rows.at(-1)!.source_id || head.revision !== rows.length) throw new Error('actual defensive decision head differs');
    const seen = new Set<string>(); let observationRevision = 0;
    for (const [index, row] of rows.entries()) {
      unambiguous(db, 'decision', row.source_json, row.snapshot_json);
      if (!id(row.source_id) || seen.has(row.source_id) || !id(row.source_version) || row.physical_pitch_source_id !== pitchId || row.player_id !== playerId
        || row.revision !== index + 1 || row.previous_source_id !== (rows[index - 1]?.source_id ?? null)
        || !id(row.observation_source_id) || !id(row.decision_model_source_id) || !id(row.plan_source_id)
        || row.decision_model_source_id !== rows[0].decision_model_source_id || row.plan_source_id !== rows[0].plan_source_id) {
        throw new Error('corrupt actual defensive decision prefix metadata');
      }
      const observation = db.prepare('SELECT physical_pitch_source_id,player_id,revision FROM actual_field_observations WHERE source_id=?')
        .get(row.observation_source_id) as { physical_pitch_source_id: string; player_id: string; revision: number } | undefined;
      if (!observation || observation.physical_pitch_source_id !== pitchId || observation.player_id !== playerId
        || !defensiveTick(observation.revision) || observation.revision <= observationRevision) throw new Error('actual defensive observation metadata differs');
      // Inspect ownership metadata only, including valid future mirrors. Never parse or execute a future receipt payload.
      const metadataKeys = [['source_id', 'sourceId'], ['source_version', 'sourceVersion'], ['physical_pitch_source_id', 'physicalPitchSourceId'],
        ['player_id', 'playerId'], ['observation_source_id', 'observationSourceId'], ['decision_model_source_id', 'decisionModelSourceId'],
        ['plan_source_id', 'planSourceId'], ['previous_source_id', 'previousDecisionSourceId']] as const;
      for (const [column, prefix] of [['source_json', '$'], ['snapshot_json', '$.source']] as const) {
        const valid = db.prepare(`SELECT json_valid(${column}) AS valid FROM actual_defensive_decisions WHERE source_id=?`).get(row.source_id)!;
        if (!valid.valid) continue;
        const expected = (r: Row) => Object.fromEntries(metadataKeys.map(([key, name]) => [name, r[key]]));
        const mirrors = db.prepare(`SELECT ${projection(column, metadataKeys.map(([, key]) => key), prefix)} AS metadata
          FROM actual_defensive_decisions WHERE source_id=?`).get(row.source_id)!;
        if (!matches(mirrors.metadata as string, expected(row))) throw new Error('actual defensive decision identity metadata mirror differs');
        if (column === 'snapshot_json') {
          const history = db.prepare(`SELECT h.type,${projection("CASE WHEN h.type='object' THEN h.value ELSE 'null' END", metadataKeys.map(([, key]) => key))} AS metadata
            FROM actual_defensive_decisions d,json_each(d.snapshot_json,'$.history') h WHERE d.source_id=? ORDER BY CAST(h.key AS INTEGER)`).all(row.source_id);
          const snapshotMetadata = db.prepare(`SELECT ${projection('snapshot_json', ['revision'])} AS revision,
            ${projection('snapshot_json', ['playerId'], '$.receipt.self')} AS self,
            ${projection('snapshot_json', ['originDecisionSourceId', 'originObservationSourceId'], '$.receipt')} AS origin
            FROM actual_defensive_decisions WHERE source_id=?`).get(row.source_id)!;
          if (history.length !== row.revision || !matches(snapshotMetadata.revision as string, { revision: row.revision })
            || !matches(snapshotMetadata.self as string, { playerId })
            || !matches(snapshotMetadata.origin as string, { originDecisionSourceId: rows[0].source_id, originObservationSourceId: rows[0].observation_source_id })
            || history.some((h, i) => h.type !== 'object' || !matches(h.metadata as string, expected(rows[i])))) {
            throw new Error('actual defensive decision history metadata mirror differs');
          }
        }
      }
      observationRevision = observation.revision; seen.add(row.source_id);
    }
    const bound = throughSourceId === undefined ? rows.length - 1 : rows.findIndex(r => r.source_id === throughSourceId);
    if (bound < 0) throw new Error('actual defensive decision outside its original prefix');
    const values: DurableActualDefensiveDecision[] = [];
    for (const row of rows.slice(0, bound + 1)) {
      const source = input(JSON.parse(row.source_json), row.source_id);
      if (source.sourceVersion !== row.source_version || source.physicalPitchSourceId !== pitchId || source.playerId !== playerId
        || source.observationSourceId !== row.observation_source_id || source.decisionModelSourceId !== row.decision_model_source_id
        || source.planSourceId !== row.plan_source_id || source.previousDecisionSourceId !== row.previous_source_id
        || row.source_json !== json(source) || row.source_hash !== hash(source)) throw new Error('corrupt original actual defensive decision Source');
      const value = execute(source, values.at(-1) ?? null);
      if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt actual defensive decision snapshot');
      values.push(value);
    }
    return values;
  };
  const read = (sourceId: string): DurableActualDefensiveDecision | null => {
    if (!id(sourceId)) throw new Error('invalid actual defensive decision identity');
    const rows = db.prepare(`SELECT * FROM actual_defensive_decisions WHERE source_id=?
      OR ${metadataId('source_json', ['sourceId'])} OR ${metadataId('snapshot_json', ['source', 'sourceId'])}
      OR ${metadataId('snapshot_json', ['history', { array: 'last' }, 'sourceId'])}`).all(sourceId, sourceId, sourceId, sourceId) as Row[];
    if (rows.length > 1) throw new Error('actual defensive decision identity scope differs');
    if (!rows.length) return null;
    unambiguous(db, 'decision', rows[0].source_json, rows[0].snapshot_json);
    const source = input(JSON.parse(rows[0].source_json), sourceId);
    return scope(source.physicalPitchSourceId, source.playerId, sourceId).at(-1)!;
  };
  const derive = (raw: AcceptedActualDefensiveDecision) => {
    const source = input(raw);
    const previous = scope(source.physicalPitchSourceId, source.playerId).at(-1) ?? null;
    if (source.previousDecisionSourceId !== (previous?.source.sourceId ?? null)) throw new Error('actual defensive decision predecessor differs');
    return execute(source, previous);
  };
  const currentDependencies = (value: DurableActualDefensiveDecision) => {
    const c = dependencies(value.source, true);
    if (hash(c.observation) !== value.observationHash || hash(c.model) !== value.decisionModelHash || hash(c.plan) !== value.planHash) {
      throw new Error('actual defensive decision dependencies changed during write');
    }
  };
  const before = (raw: DurableActualDefensiveDecision) => {
    const value = cloneInert(raw);
    currentDependencies(value);
    if (json(derive(value.source)) !== json(value)) throw new Error('actual defensive decision changed before write');
  };
  const current = (raw: DurableActualDefensiveDecision) => {
    const value = cloneInert(raw);
    currentDependencies(value); const values = scope(value.source.physicalPitchSourceId, value.source.playerId);
    if (values.length !== value.revision || json(values.at(-1)) !== json(value)) throw new Error('actual defensive decision changed during write');
  };
  return { read, derive, before, current };
};
export const openSqliteActualDefensiveDecisionStore = (path: string, authority?: Authority) => {
  if (!id(path) || authority != null && typeof authority.readAcceptedDecision !== 'function') throw new Error('invalid actual defensive decision owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS actual_defensive_decisions (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
    physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,observation_source_id TEXT NOT NULL,decision_model_source_id TEXT NOT NULL,
    plan_source_id TEXT NOT NULL,previous_source_id TEXT,revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(physical_pitch_source_id,player_id,revision));
    CREATE TABLE IF NOT EXISTS actual_defensive_decision_heads (physical_pitch_source_id TEXT NOT NULL,player_id TEXT NOT NULL,
    source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,PRIMARY KEY(physical_pitch_source_id,player_id));`);
  const own = actualDefensiveDecisionEvidenceFromSqlite(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed actual defensive decision store'); };
  return Object.freeze({ read(sourceId: string) { check(); return own.read(sourceId); },
    accept(sourceId: string): DurableActualDefensiveDecision {
      check(); const prior = own.read(sourceId), raw = authority?.readAcceptedDecision(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual defensive decision Source frozen differently');
        const saved = own.read(sourceId); if (!saved || json(saved) !== json(prior)) throw new Error('actual defensive decision changed during retry'); return saved;
      }
      if (!source) throw new Error('accepted actual defensive decision Source missing');
      const value = own.derive(source); own.before(value); db.exec('BEGIN IMMEDIATE');
      try {
        const liveFence = beginActualLivePitchWrite(db, source.physicalPitchSourceId, { owner: 'actual_defensive_decisions', sourceId });
        own.before(value);
        db.prepare('INSERT INTO actual_defensive_decisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion,
          source.physicalPitchSourceId, source.playerId, source.observationSourceId, source.decisionModelSourceId, source.planSourceId,
          source.previousDecisionSourceId, value.revision, json(source), hash(source), json(value), hash(value));
        if (value.revision === 1) db.prepare('INSERT INTO actual_defensive_decision_heads VALUES (?,?,?,?)').run(source.physicalPitchSourceId, source.playerId, sourceId, 1);
        else {
          const changed = db.prepare(`UPDATE actual_defensive_decision_heads SET source_id=?,revision=?
            WHERE physical_pitch_source_id=? AND player_id=? AND source_id=? AND revision=?`).run(sourceId, value.revision,
            source.physicalPitchSourceId, source.playerId, source.previousDecisionSourceId, value.revision - 1);
          if (Number(changed.changes) !== 1) throw new Error('actual defensive decision predecessor changed during write');
        }
        recordActualLivePlayAdmission(db, liveFence);
        own.current(value); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('actual defensive decision original changed during write');
        assertActualLivePlayWriteUnchanged(db, liveFence); db.exec('COMMIT'); return saved;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    }, close() { if (!closed) { db.close(); closed = true; } } });
};
