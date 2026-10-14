import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { resolveOfficialGameProgression } from '../../core/world/competition/OfficialGameCompletion';
import { actualLivePlayClosureInput } from './ActualLivePlayClosureSource';
import { actualLivePlayClosureEvidenceFromSqlite } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualRoleWorkloadEvidenceFromSqlite } from './ActualRoleWorkloadEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { assertActualLiveReadyEffects, type ActualLiveReadinessScope, type ActualLiveReadinessReference } from './ActualLivePlayReadiness';
import type { ActualAdjudicationDb } from './ActualLiveAdjudicationFromSqlite';
import { actorHash as hash, actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type ReadinessReadScope = Readonly<{ check(): void; completed: Map<string, unknown> }>;
const readinessReadScopes = new WeakMap<ActualAdjudicationDb, ReadinessReadScope>();

/** One owner-controlled synchronous snapshot. No supplied evidence can seed it.
 * Independent/nested brackets start empty; completed children are not promoted.
 * The caller retains responsibility for its enclosing transaction. */
export const withActualLiveReadinessReadScope = <T>(db: ActualAdjudicationDb, work: () => T): T => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync) || !db.isTransaction) throw new Error('readiness scope requires a Native read snapshot');
  const queryOnly = () => db.prepare('PRAGMA query_only').get()!.query_only;
  const databases = () => json(db.prepare('PRAGMA database_list').all());
  if (queryOnly() !== 1 || db.prepare('PRAGMA database_list').all().some(row => row.name !== 'main' && row.name !== 'temp')
    || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
    throw new Error('readiness scope requires main-only query-only authority');
  }
  const originalDatabases = databases();
  const stamp = () => json([db.prepare('SELECT total_changes() AS n').get()!.n,
    db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    db.prepare('PRAGMA temp.schema_version').get()!.schema_version]);
  const name = `actual_readiness_scope_${randomUUID().replaceAll('-', '')}`, prior = readinessReadScopes.get(db);
  let opened = false, failed = false, failure: unknown, value!: T;
  const cleanup: unknown[] = [];
  try {
    db.exec(`SAVEPOINT ${name}`); opened = true;
    const before = stamp();
    const scope: ReadinessReadScope = { completed: new Map(), check: () => {
      if (!db.isTransaction || queryOnly() !== 1 || stamp() !== before || databases() !== originalDatabases
        || readinessReadScopes.get(db) !== scope) throw new Error('readiness scope snapshot changed');
    } };
    readinessReadScopes.set(db, scope);
    value = work(); scope.check();
    // Stamps cannot distinguish rollback/rebegin. The private savepoint must
    // still belong to the original transaction before the scope result escapes.
    db.exec(`RELEASE ${name}`); opened = false;
    scope.check();
  } catch (error) { failed = true; failure = error; }
  finally {
    if (prior) readinessReadScopes.set(db, prior); else readinessReadScopes.delete(db);
    if (opened) try { db.exec(`RELEASE ${name}`); } catch (error) { cleanup.push(error); }
    try {
      if (queryOnly() !== 1) db.exec('PRAGMA query_only=ON');
      if (queryOnly() !== 1) throw new Error('readiness scope read setting restore failed');
    } catch (error) { cleanup.push(error); }
  }
  if (cleanup.length) throw new AggregateError([...(failed ? [failure] : []), ...cleanup],
    'readiness scope cleanup failed', { cause: failed ? failure : cleanup[0] });
  if (failed) throw failure;
  return value;
};

/** Readiness is a connection of independently owned effects. Unsupported official
 * scoring is retained and is never used as a substitute workload/setup authority. */
export const actualLivePlayReadinessFromSqlite = (db: ActualAdjudicationDb) => {
  const read = (closureSourceId: string, currentHeads: boolean) => {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const transactional = db instanceof DatabaseSync && db.isTransaction;
    const beforeSettlement = (closure: NonNullable<ReturnType<ReturnType<typeof actualLivePlayClosureEvidenceFromSqlite>['read']>>) => {
    if (!closure.officialApplied || !closure.result) return freeze({ kind: 'pending' as const, reason: 'official_application_pending' as const, closureSourceId });
    const p = closure.proposal;
    // An old accepted activation can remain readable without authorizing a new
    // physical play across an unknown/final game boundary. Historical origins
    // retain their original bytes; current admission checks the shared policy.
    const before = p.application.match, after = p.expectedOfficial.receipt.appliedMatchState;
    if (currentHeads && !p.source.gamePolicy && before.half === 'bottom'
      && before.score.home <= before.score.away && after.score.home > after.score.away) {
      const installed = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='physical_closure_game_policies'").get();
      const row = installed && db.prepare('SELECT policy_json FROM physical_closure_game_policies WHERE game_id=?').get(p.gameId);
      if (!row) return freeze({ kind: 'pending' as const, reason: 'game_policy_pending' as const, closureSourceId });
      const saved = JSON.parse(String(row.policy_json));
      const game = { seasonId: p.seasonFixture.seasonId, homeClubId: p.seasonFixture.game.homeClubId,
        awayClubId: p.seasonFixture.game.awayClubId, policy: saved.policy };
      if (json(game) !== row.policy_json) throw new Error('actual live current game policy scope differs');
      actualLivePlayClosureInput({ ...p.source, gamePolicy: saved.policy }, p.source.sourceId);
      const progression = resolveOfficialGameProgression({ ...game, gameId: p.gameId, priorMatch: before, application: p.expectedOfficial.receipt });
      if (progression.kind !== 'GAME_CONTINUES') return freeze({ kind: 'pending' as const, reason: 'game_final_scoring_pending' as const, closureSourceId });
    }
    return null;
    };
    const execute = () => {
    const roles = actualRoleWorkloadEvidenceFromSqlite(db), gated = { pending: null as ReturnType<typeof beforeSettlement> };
    const pair = transactional ? roles.readWithClosure(closureSourceId, closure => {
      gated.pending = beforeSettlement(closure); return gated.pending === null;
    }) : null;
    const closure = pair ? pair.closure : actualLivePlayClosureEvidenceFromSqlite(db).read(closureSourceId);
    if (!closure) throw new Error('actual live readiness closure is missing');
    const pending = pair ? gated.pending : beforeSettlement(closure);
    if (pending) return pending;
    const p = closure.proposal;
    const settlement = pair ? pair.settlement! : roles.readSettlement(closureSourceId);
    if (settlement.kind !== 'complete') return 'result' in p.expectedOfficial
      ? freeze({ kind: 'game_final' as const, reason: 'game_final' as const, closureSourceId, closure, settlement })
      : freeze({ kind: 'pending' as const, reason: 'actual_role_workload_pending' as const, closureSourceId, settlement });
    const first = p.actors[0].binding;
    const scope: ActualLiveReadinessScope = { closureSourceId, closureApplicationId: p.application.applicationId, closureProposalHash: hash(p),
      careerId: first.careerId, gameId: p.gameId, playId: p.playId, gameDay: first.gameDay,
      physicalEndReference: p.physicalEndReference, wholeHistoryReference: p.wholeHistoryReference,
      actors: p.actors.map(a => ({ playerId: a.binding.playerId, personId: a.person.personId, clubId: a.binding.clubId,
        personLinkSourceId: a.binding.personLinkSourceId })) };
    const current = currentHeads ? scope.actors.map(a => {
      const head = readActualRoleWorkloadState(db, scope.careerId, a.playerId, undefined, a.personLinkSourceId);
      if (!head) throw new Error('actual live readiness current workload head missing');
      return head;
    }) : settlement.participants.map(p => p.after);
    assertActualLiveReadyEffects(scope, { ...settlement, kind: 'complete' }, current);
    if ('result' in p.expectedOfficial) return freeze({ kind: 'game_final' as const, reason: 'game_final' as const, closureSourceId, closure, settlement });
    // Stable original effects only: later authorized recovery cannot rewrite a frozen actor's origin.
    const reference: ActualLiveReadinessReference = { version: 'actual_live_next_play_readiness_v1' as const, closureSourceId, applicationId: p.application.applicationId,
      gameId: p.gameId, previousPlayId: p.playId, closureProposalHash: hash(p), settlementHash: hash(settlement),
      controllerResetHash: hash(p.controllerReset), physicalEndReference: p.physicalEndReference, wholeHistoryReference: p.wholeHistoryReference };
    return freeze({ kind: 'ready' as const, closure, settlement, reference });
    };
    const scope = readinessReadScopes.get(db), key = scope ? json([closureSourceId, currentHeads]) : '';
    scope?.check();
    if (scope?.completed.has(key)) return scope.completed.get(key) as ReturnType<typeof execute>;
    const result = transactional ? withBattedWorldPhysicalReadTraversal(db, execute) : execute();
    scope?.check();
    // Publish only this owner's complete immutable readiness, after the physical
    // traversal and all its cleanup have returned successfully.
    if (scope && result.kind === 'ready') scope.completed.set(key, result);
    return result;
  };
  return { read: (sourceId: string) => read(sourceId, true), readHistorical: (sourceId: string) => read(sourceId, false) };
};
