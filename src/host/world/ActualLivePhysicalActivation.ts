import type { ActualLiveReadinessReference } from './ActualLivePlayReadiness';
import { actualLiveClosureApplicationRows, assertPriorActualLiveClosureCompleted } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import type { ActorDb } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** A historical actor origin binds completed original effects. The accepting
 * physical writer separately requires current workload/frame readiness. */
export const readActualLivePhysicalActivation = (db: ActorDb, gameId: string, applicationId: string) => {
  assertPriorActualLiveClosureCompleted(db, applicationId, true);
  const rows = actualLiveClosureApplicationRows(db, applicationId);
  if (!rows.length) return null;
  const ready = actualLivePlayReadinessFromSqlite(db).readHistorical(String(rows[0].source_id));
  if (ready.kind !== 'ready') throw new Error('actual live physical activation required effects pending');
  const p = ready.closure.proposal, result = p.expectedOfficial;
  if (p.gameId !== gameId || p.application.applicationId !== applicationId || result.receipt.applicationId !== applicationId
    || result.receipt.previousPlayId !== p.playId || result.activation.previousPlayId !== p.playId
    || result.activation.nextMatchState.playId !== p.playId + 1) throw new Error('actual live physical activation scope differs');
  const row = db.prepare('SELECT * FROM applications WHERE application_id=? AND match_id=?').get(applicationId, gameId);
  if (!row) throw new Error('actual live physical activation application missing');
  return freeze({ match: result.activation.nextMatchState, world: result.nextWorld, officialRevision: result.receipt.durableRevision,
    applicationHash: hash(row), readinessReference: ready.reference });
};

/** Called by the physical actor writer before and after its INSERT, on that exact connection. */
export const assertActualLivePhysicalActivationCurrent = (db: ActorDb, reference: ActualLiveReadinessReference): void => {
  const ready = actualLivePlayReadinessFromSqlite(db).read(reference.closureSourceId);
  if (ready.kind !== 'ready' || json(ready.reference) !== json(reference)) throw new Error('actual live physical activation current readiness differs');
};
