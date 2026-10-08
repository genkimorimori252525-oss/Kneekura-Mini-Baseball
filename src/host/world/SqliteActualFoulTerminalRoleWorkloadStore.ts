import { assertNoSamePaPlayerReservation } from './SamePlateAppearanceReservationGuard';
import { createRequire } from 'node:module';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayId as id } from './ActualLivePlayScope';
import { foulTerminalApplicationPin } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { foulTerminalRoleWorkloadAssessmentInput as input, type AcceptedFoulTerminalRoleWorkloadAssessment } from './ActualFoulTerminalRoleWorkloadAssessment';
import { foulTerminalRoleWorkloadContextFromSqlite as context, deriveFoulTerminalWorkloadAssessment as derive,
  readFoulTerminalWorkloadAssessments, prepareFoulTerminalWorkloadPlan, foulTerminalWorkloadEvidenceFromSqlite as evidence,
  type FoulTerminalRoleWorkloadContext } from './ActualFoulTerminalRoleWorkloadEvidenceFromSqlite';
import { foulTerminalWorkloadIdentityRow as identity } from './ActualFoulTerminalRoleWorkloadMetadata';
import { assertFoulTerminalWorkloadStorage } from './ActualFoulTerminalRoleWorkloadStorage';
import { foulTerminalWorkloadTransaction } from './FoulTerminalWorkloadTransaction';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { playerWorkloadRecoveryStoreFromSqlite, type AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';

export type AcceptedFoulTerminalWorkloadAuthority = Readonly<{
  readAcceptedAssessment(sourceId: string): AcceptedFoulTerminalRoleWorkloadAssessment | null;
  readAcceptedBaseline?(sourceId: string): AcceptedPlayerWorkloadBaseline | null;
}>;
const same = (actual: unknown, expected: unknown, message: string) => { if (json(actual) !== json(expected)) throw new Error(message); };
type Settlement = ReturnType<ReturnType<typeof evidence>['readSettlement']>;
type Frozen = Exclude<Settlement, { kind: 'pending' }>;

/** A terminal workload prerequisite only. The acknowledged terminal, original
 * physical archives and all official pending mirrors are never updated here. */
export const openSqliteActualFoulTerminalRoleWorkloadStore = (path: string,
  personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>, authority?: AcceptedFoulTerminalWorkloadAuthority) => {
  if (!id(path) || !isAbsolute(path) || path === ':memory:' || !lstatSync(path).isFile() || realpathSync(path) !== path
    || !personLinks || typeof personLinks.readLink !== 'function' || authority && typeof authority.readAcceptedAssessment !== 'function') {
    throw new Error('terminal workload requires an existing canonical artifact and accepted authorities');
  }
  const { DatabaseSync: NativeDatabase } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new NativeDatabase(path);
  try {
    db.exec('BEGIN'); assertFoulTerminalWorkloadStorage(db); db.exec('COMMIT');
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  } catch (error) {
    const errors = [error];
    try { if (db.isTransaction) db.exec('ROLLBACK'); } catch (cleanup) { errors.push(cleanup); }
    try { db.close(); } catch (cleanup) { errors.push(cleanup); }
    if (errors.length > 1) throw new AggregateError(errors, 'terminal workload constructor cleanup failed', { cause: error });
    throw error;
  }
  const tx = foulTerminalWorkloadTransaction(db, () => assertFoulTerminalWorkloadStorage(db));
  const check = (sourceId: string) => { tx.check(); if (!id(sourceId)) throw new Error('invalid terminal workload Source identity'); };
  const currentHeads = (c: FoulTerminalRoleWorkloadContext) => c.actors.map(actor => readActualRoleWorkloadState(db,
    actor.binding.careerId, actor.binding.playerId, undefined, actor.binding.personLinkSourceId));
  const pin = (c: FoulTerminalRoleWorkloadContext) => foulTerminalApplicationPin(db, c.terminal.proposal);
  const readSettlement = (sourceId: string) => {
    check(sourceId); return tx.transaction(false, () => ({ value: tx.proof(() => evidence(db).readSettlement(sourceId)), changes: 0 }));
  };
  const acceptAssessments = (sourceIds: readonly string[]) => {
    tx.check();
    if (!Array.isArray(sourceIds) || !sourceIds.length || sourceIds.some(sourceId => !id(sourceId))
      || new Set(sourceIds).size !== sourceIds.length) throw new Error('terminal assessment IDs must be unique nonempty IDs');
    const requested = sourceIds.map(sourceId => {
      const raw = authority?.readAcceptedAssessment(sourceId) ?? null;
      return raw === null ? null : input(raw, sourceId);
    });
    return tx.transaction(true, () => {
      const before = tx.proof(() => {
        const sources = sourceIds.map((sourceId, i) => {
          const row = identity(db, 'actual_role_workload_assessments', sourceId);
          const archived = row ? input(JSON.parse(String(row.source_json)), sourceId) : null;
          if (archived && requested[i]) same(archived, requested[i], 'terminal assessment already frozen differently');
          const source = requested[i] ?? archived;
          if (!source) throw new Error('accepted terminal workload assessment missing');
          return source;
        });
        const terminalSourceId = sources[0].terminalReference.sourceId;
        if (sources.some(source => source.terminalReference.sourceId !== terminalSourceId)) throw new Error('terminal assessment batch source differs');
        const c = context(db, terminalSourceId), existing = readFoulTerminalWorkloadAssessments(db, c), values = sources.map(source => derive(c, source));
        // Missing baselines remain pending, but existing chains and settlement
        // ownership must authenticate even on a zero-write assessment retry.
        const heads = currentHeads(c), settlement = evidence(db).readSettlement(terminalSourceId);
        if (new Set(values.map(v => v.playerId)).size !== values.length) throw new Error('terminal workload canonical participant charge alias differs');
        const added = values.filter(value => !existing.some(prior => prior.source.sourceId === value.source.sourceId));
        for (const value of values) {
          const prior = existing.find(prior => prior.playerId === value.playerId);
          if (prior) same(prior, value, 'terminal workload canonical charge already assessed');
        }
        for (const value of added) assertNoSamePaPlayerReservation(db,value);
        if (added.length && identity(db, 'actual_role_workload_settlements', terminalSourceId)) throw new Error('terminal assessment set is already frozen');
        return { c, existing, values, added, heads, settlement, original: pin(c) };
      });
      for (const value of before.added) db.prepare('INSERT INTO actual_role_workload_assessments VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(value.source.sourceId, before.c.reference.terminalSourceId, value.careerId, value.gameId, value.playId,
          value.playerId, json(value.source), hash(value.source), json(value), hash(value));
      tx.proof(() => {
        for (const value of before.added) assertNoSamePaPlayerReservation(db,value);
        const c = context(db, before.c.reference.terminalSourceId), saved = readFoulTerminalWorkloadAssessments(db, c);
        same(pin(c), before.original, 'terminal assessment changed original physical/official evidence');
        same(currentHeads(c), before.heads, 'terminal assessment changed original participant heads');
        const settlement = evidence(db).readSettlement(before.c.reference.terminalSourceId);
        if (before.settlement.kind !== 'pending') same(settlement, before.settlement, 'terminal assessment changed frozen settlement');
        if (saved.length !== before.existing.length + before.added.length
          || [...before.existing, ...before.added].some(value => !saved.some(row => json(row) === json(value)))) throw new Error('terminal workload assessment changed during acceptance');
      });
      return { value: before.values, changes: before.added.length };
    });
  };
  const freeze = (terminalSourceId: string): Settlement => {
    check(terminalSourceId);
    return tx.transaction(true, () => {
      const before = tx.proof(() => {
        const current = evidence(db).readSettlement(terminalSourceId);
        if (current.kind !== 'pending' || current.missingAssessments.length || current.missingBaselines.length) return { kind: 'no_write' as const, current };
        const c = context(db, terminalSourceId), plan = prepareFoulTerminalWorkloadPlan(db, c);
        if (plan.kind !== 'frozen') return { kind: 'no_write' as const, current: plan };
        for (const p of plan.participants) assertNoSamePaPlayerReservation(db,{careerId:plan.careerId,playerId:p.playerId});
        return { kind: 'freeze' as const, c, plan, heads: currentHeads(c), original: pin(c) };
      });
      if (before.kind === 'no_write') return { value: before.current, changes: 0 };
      const plan = before.plan;
      db.prepare('INSERT INTO actual_role_workload_settlements VALUES(?,?,?,?,?,?)')
        .run(terminalSourceId, plan.careerId, plan.gameId, plan.playId, json(plan), hash(plan));
      const saved = tx.proof(() => {
        for (const p of plan.participants) assertNoSamePaPlayerReservation(db,{careerId:plan.careerId,playerId:p.playerId});
        const c = context(db, terminalSourceId), saved = evidence(db).readSettlement(terminalSourceId);
        same(pin(c), before.original, 'terminal freeze changed original physical/official evidence');
        same(currentHeads(c), before.heads, 'terminal workload BEFORE changed during freeze');
        if (saved.kind !== 'applying' || saved.participants.some(p => p.applied)) throw new Error('terminal workload initial frozen stage differs');
        return saved;
      });
      return { value: saved, changes: 1 };
    });
  };
  type Operation = Readonly<{ kind: 'baseline' | 'activity'; terminalSourceId: string; sourceId: string }>;
  let operation: Operation | null = null;
  let globalBefore: Readonly<{ operation: Operation; c: FoulTerminalRoleWorkloadContext; original: ReturnType<typeof pin>;
    heads: ReturnType<typeof currentHeads>; plan: Frozen | null; participant: Frozen['participants'][number] | null;
    baseline: AcceptedPlayerWorkloadBaseline | null; prior: boolean; changes: number }> | null = null;
  let guardPhases: string[] = [];
  const validateBaseline = (c: FoulTerminalRoleWorkloadContext, raw: AcceptedPlayerWorkloadBaseline) => {
    const actor = c.actors.find(a => a.binding.playerId === raw.playerId);
    if (!actor || raw.careerId !== c.reference.careerId || raw.personLinkSourceId !== actor.binding.personLinkSourceId
      || raw.createdAtDay > c.reference.gameDay) throw new Error('terminal baseline original participant/Person/day differs');
  };
  const onGlobalTransaction = <T>(body: () => T): T => {
    if (!operation) throw new Error('terminal workload global operation scope missing');
    const requested = operation;
    try {
      return tx.transaction(true, () => {
        globalBefore = tx.proof(() => {
          const c = context(db, requested.terminalSourceId);
          // Both branches preserve reverse legacy exclusion, including missing
          // assessments and baseline initialization before the first charge.
          readFoulTerminalWorkloadAssessments(db, c);
          if (requested.kind === 'activity') {
            const plan = evidence(db).readSettlement(requested.terminalSourceId);
            if (plan.kind === 'pending') throw new Error('terminal workload exact frozen settlement missing');
            const participant = plan.participants.find(p => p.activity.sourceEventId === requested.sourceId);
            if (!participant) throw new Error('terminal workload frozen activity missing');
            return { operation: requested, c, original: pin(c), heads: currentHeads(c), plan, participant,
              baseline: null, prior: participant.applied, changes: participant.applied ? 0 : 2 };
          }
          const row = db.prepare('SELECT * FROM main.world_player_workload_baselines WHERE source_id=?').get(requested.sourceId);
          if (c.terminal.status === 'POST_PLAY_COMPLETED_CONTINUING' && !row) throw new Error('completed terminal baseline repair is forbidden');
          const raw = authority?.readAcceptedBaseline?.(requested.sourceId) ?? null;
          const source = raw === null ? row ? JSON.parse(String(row.source_json)) as AcceptedPlayerWorkloadBaseline : null : cloneInert(raw);
          if (!source || source.sourceId !== requested.sourceId) throw new Error('accepted terminal workload baseline missing');
          validateBaseline(c, source);
          if (row) same(source, JSON.parse(String(row.source_json)), 'terminal baseline already frozen differently');
          const policy = db.prepare('SELECT 1 FROM main.world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?')
            .get(source.careerId, source.policy.policyId, source.policy.version);
          return { operation: requested, c, original: pin(c), heads: currentHeads(c), plan: null, participant: null,
            baseline: source, prior: !!row, changes: row ? 0 : policy ? 2 : 3 };
        });
        guardPhases = [];
        const before = globalBefore, value = body();
        tx.proof(() => {
          const c = context(db, requested.terminalSourceId);
          same(pin(c), before.original, 'terminal global workload changed original physical/official evidence');
          same(guardPhases, before.prior ? ['retry'] : ['write', 'written'], 'terminal workload writer guard phases differ');
          const heads = currentHeads(c);
          const target = before.participant?.playerId ?? before.baseline!.playerId;
          for (const [i, actor] of c.actors.entries()) {
            if (before.prior || actor.binding.playerId !== target) same(heads[i], before.heads[i], 'terminal workload other participant changed during global write');
            else if (before.participant) same(heads[i], before.participant.after, 'terminal workload charged head differs');
            else {
              if (before.heads[i] !== null || !heads[i]) throw new Error('terminal baseline replaced an existing head');
              const row = db.prepare('SELECT source_json FROM main.world_player_workload_baselines WHERE source_id=?').get(requested.sourceId);
              if (row?.source_json !== json(before.baseline)) throw new Error('terminal accepted baseline archive differs');
            }
          }
          if (before.plan && before.participant) {
            const result = evidence(db).readSettlement(requested.terminalSourceId);
            const participants = before.plan.participants.map(p => p.playerId === target ? { ...p, applied: true } : p);
            same(result, { ...before.plan, kind: participants.every(p => p.applied) ? 'complete' : 'applying', participants }, 'terminal workload frozen effects changed during charge');
          }
        });
        return { value, changes: before.changes };
      });
    } finally { globalBefore = null; guardPhases = []; }
  };
  const guard = (connection: Pick<DatabaseSync, 'prepare'>, sourceId: string, phase: 'write' | 'written' | 'retry') => {
    const before = globalBefore;
    if (connection !== db || !db.isTransaction || !before || sourceId !== before.operation.sourceId
      || phase === 'retry' && !before.prior || phase !== 'retry' && before.prior) throw new Error('terminal workload global writer boundary differs');
    guardPhases.push(phase);
    tx.proof(() => {
      const c = context(db, before.operation.terminalSourceId);
      same(pin(c), before.original, 'terminal workload original evidence changed on writer connection');
      readFoulTerminalWorkloadAssessments(db, c);
    });
    return before;
  };
  let workload: ReturnType<typeof playerWorkloadRecoveryStoreFromSqlite>;
  try {
    workload = playerWorkloadRecoveryStoreFromSqlite(db, personLinks, {
      readAcceptedBaseline: sourceId => globalBefore?.operation.kind === 'baseline' && globalBefore.operation.sourceId === sourceId ? globalBefore.baseline : null,
      readAcceptedActivity: sourceId => globalBefore?.operation.kind === 'activity' && globalBefore.operation.sourceId === sourceId ? globalBefore.participant!.activity : null,
    }, {
      transaction: onGlobalTransaction,
      baseline: (connection, source, phase) => {
        const before = guard(connection, source.sourceId, phase);
        if (before.operation.kind !== 'baseline') throw new Error('terminal baseline writer mode differs');
        validateBaseline(before.c, source); same(source, before.baseline, 'terminal baseline writer source differs');
      },
      activity: (connection, activity, phase) => {
        const before = guard(connection, activity.sourceEventId, phase);
        if (before.operation.kind !== 'activity') throw new Error('terminal activity writer mode differs');
        same(activity, before.participant!.activity, 'terminal activity differs from accepted TOTAL');
      },
    });
  } catch (error) { tx.close(); throw error; }
  const global = <T>(request: Operation, work: () => T): T => {
    check(request.terminalSourceId); check(request.sourceId);
    if (operation) throw new Error('terminal workload global operation is already active');
    operation = request; try { return work(); } finally { operation = null; }
  };
  const settle = (terminalSourceId: string): Settlement => {
    const frozen = freeze(terminalSourceId);
    if (frozen.kind === 'pending') return frozen;
    for (const p of frozen.participants) {
      const accepted = authority?.readAcceptedAssessment(p.assessmentSourceId) ?? null;
      if (accepted !== null) {
        const row = identity(db, 'actual_role_workload_assessments', p.assessmentSourceId);
        if (!row || row.source_json !== json(input(accepted, p.assessmentSourceId))) throw new Error('terminal assessment changed after freeze');
      }
      // The authenticated frozen read already proved this exact archived
      // activity and its current chain. Keep Source checks above and the final
      // all-participant read below; only missing effects need the writer/CAS.
      if (p.applied) continue;
      const after = global({ kind: 'activity', terminalSourceId, sourceId: p.activity.sourceEventId }, () => workload.apply(p.activity.sourceEventId, p.before.revision));
      same(after, p.after, 'terminal workload global AFTER differs');
    }
    const result = readSettlement(terminalSourceId);
    if (result.kind !== 'complete') throw new Error('terminal workload participant settlement incomplete');
    return result;
  };
  return Object.freeze({ acceptAssessment: (sourceId: string) => acceptAssessments([sourceId])[0], acceptAssessments,
    initializeBaseline: (terminalSourceId: string, baselineSourceId: string) => global({ kind: 'baseline', terminalSourceId, sourceId: baselineSourceId },
      () => workload.initialize(baselineSourceId)), freeze, settle, readSettlement, close: () => tx.close() });
};
