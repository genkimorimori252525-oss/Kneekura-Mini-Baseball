import { assertFoulTerminalPriorActivation } from './FoulTerminalCompletionAncestryGuard';
import { createRequire } from 'node:module';
import type { ActualLiveReadinessReference } from './ActualLivePlayReadiness';
import { actualLiveClosureApplicationRows, assertPriorActualLiveClosureCompleted, readPriorActualLiveActivationReadiness } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import type { ActorDb } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** A historical actor origin binds completed original effects. The accepting
 * physical writer separately requires current workload/frame readiness. */
export const readActualLivePhysicalActivation = (db: ActorDb, gameId: string, applicationId: string) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const transactional = db instanceof DatabaseSync && db.isTransaction;
  const readReady = () => {
    if (transactional) return readPriorActualLiveActivationReadiness(db, applicationId);
    assertPriorActualLiveClosureCompleted(db, applicationId, true);
    const rows = actualLiveClosureApplicationRows(db, applicationId);
    if (!rows.length) return null;
    return actualLivePlayReadinessFromSqlite(db).readHistorical(String(rows[0].source_id));
  };
  const execute = () => {
    const ready = readReady();
    if (ready === null) return null;
    if (ready.kind !== 'ready') throw new Error('actual live physical activation required effects pending');
    const p = ready.closure.proposal, result = p.expectedOfficial;
    if (!('activation' in result)) throw new Error('actual live game final cannot activate another physical play');
    if (p.gameId !== gameId || p.application.applicationId !== applicationId || result.receipt.applicationId !== applicationId
      || result.receipt.previousPlayId !== p.playId || result.activation.previousPlayId !== p.playId
      || result.activation.nextMatchState.playId !== p.playId + 1) throw new Error('actual live physical activation scope differs');
    assertFoulTerminalPriorActivation(db,gameId,p.playId,result.activation.nextMatchState.playId);
    const row = db.prepare('SELECT * FROM applications WHERE application_id=? AND match_id=?').get(applicationId, gameId);
    if (!row) throw new Error('actual live physical activation application missing');
    return freeze({ match: result.activation.nextMatchState, world: result.nextWorld, officialRevision: result.receipt.durableRevision,
      applicationHash: hash(row), readinessReference: ready.reference });
  };
  return transactional ? withBattedWorldPhysicalReadTraversal(db, execute) : execute();
};

/** Called by the physical actor writer before and after its INSERT, on that exact connection. */
export const assertActualLivePhysicalActivationCurrent = (db: ActorDb, reference: ActualLiveReadinessReference): void => {
  const ready = actualLivePlayReadinessFromSqlite(db).read(reference.closureSourceId);
  if (ready.kind !== 'ready' || json(ready.reference) !== json(reference)) throw new Error('actual live physical activation current readiness differs');
};
