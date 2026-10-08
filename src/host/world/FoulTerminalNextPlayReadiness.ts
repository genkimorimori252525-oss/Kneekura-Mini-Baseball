import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { FoulTerminalCompletionEvidence, FoulTerminalReadinessReference } from './ActualFoulTerminalPostPlayCompletion';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { readPriorFoulTerminalActivationReadiness } from './ActualLivePlayClosureEvidenceFromSqlite';
import { assertFoulTerminalPriorActivation } from './FoulTerminalCompletionAncestryGuard';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Db = Pick<DatabaseSync,'prepare'>;
const referenceKeys = ['version','terminalSourceId','setupSourceId','completionId','snapshotHash','applicationId','gameId','previousPlayId'];
export const foulTerminalReadinessReference = (raw: FoulTerminalReadinessReference): FoulTerminalReadinessReference => {
  const value = cloneInert(raw);
  if (!value || Array.isArray(value) || Object.keys(value).sort().join('|') !== referenceKeys.slice().sort().join('|')
    || value.version !== 'actual_foul_terminal_next_play_readiness_v1'
    || !['terminalSourceId','setupSourceId','completionId','snapshotHash','applicationId','gameId'].every(key => {
      const id = value[key as keyof FoulTerminalReadinessReference]; return typeof id === 'string' && !!id && id === id.trim();
    }) || !/^[a-f0-9]{64}$/.test(value.snapshotHash) || !Number.isSafeInteger(value.previousPlayId) || value.previousPlayId < 0) {
    throw new Error('invalid terminal next-play readiness reference');
  }
  return freeze(value);
};
/** This reader delegates archive authenticity to the completion owner; it owns
 * only the additional current-admission boundary and stable origin reference. */
export const foulTerminalNextPlayReadinessFromSqlite = (db: Db) => {
  const read = (sourceId: string, current: boolean) => {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    if (!(db instanceof DatabaseSync)) throw new Error('terminal readiness requires a Native connection');
    return withBattedVenueLegalReadSnapshot(db,()=>{
    const evidence: FoulTerminalCompletionEvidence | null = foulTerminalPostPlayCompletionEvidenceFromSqlite(db).readWithEffects(sourceId);
    if (!evidence) throw new Error('terminal readiness completed owner is missing');
    const { archive,settlement } = evidence, p = archive.proposal, c = archive.result.completion;
    const first = p.participants[0]?.binding;
    if (!first || settlement.kind !== 'complete' || settlement.careerId !== first.careerId || settlement.gameId !== p.gameId
      || settlement.playId !== p.playId || settlement.gameDay !== first.gameDay || p.participants.length !== 10
      || new Set(p.participants.map(a => a.binding.playerId)).size !== 10 || new Set(p.participants.map(a => a.person.personId)).size !== 10
      || settlement.participants.length !== 10 || new Set(settlement.participants.map(a => a.playerId)).size !== 10) {
      throw new Error('terminal readiness original participant scope differs');
    }
    for (const participant of settlement.participants) {
      const actor = p.participants.find(a => a.binding.playerId === participant.playerId);
      if (!actor || !participant.applied || participant.personId !== actor.person.personId || participant.clubId !== actor.binding.clubId
        || participant.after.playerId !== participant.playerId || participant.after.careerId !== first.careerId) {
        throw new Error('terminal readiness participant effect differs');
      }
      if (current) {
        const head = readActualRoleWorkloadState(db,first.careerId,participant.playerId,undefined,actor.binding.personLinkSourceId);
        if (!head || head.effectiveDay > first.gameDay || head.revision < participant.after.revision
          || head.revision === participant.after.revision && json(head) !== json(participant.after)) {
          throw new Error('terminal readiness current workload head differs');
        }
      }
    }
    const reference: FoulTerminalReadinessReference = {
      version:'actual_foul_terminal_next_play_readiness_v1',terminalSourceId:archive.source.sourceId,
      setupSourceId:c.source.sourceId,completionId:c.completionId,snapshotHash:c.snapshotHash,
      applicationId:c.officialReference.applicationId,gameId:p.gameId,previousPlayId:p.playId,
    };
    if (current) {
      const match = db.prepare('SELECT durable_revision,state_json,activation_json FROM matches WHERE match_id=?').get(p.gameId);
      if (!match || match.durable_revision !== archive.result.official.receipt.durableRevision
        || match.state_json !== json(c.activation.nextMatchState) || match.activation_json !== json({activation:c.activation,nextWorld:c.nextWorld})) {
        throw new Error('terminal readiness current Match activation differs');
      }
    }
    return freeze({kind:'foul_terminal_ready' as const,archive,settlement,reference:foulTerminalReadinessReference(reference)});
    });
  };
  return {read:(sourceId:string) => read(sourceId,true),readHistorical:(sourceId:string) => read(sourceId,false)};
};
export const readFoulTerminalPhysicalActivation = (db: Db, gameId: string, applicationId: string) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const execute=()=>{
  const ready = readPriorFoulTerminalActivationReadiness(db,applicationId);
  if (!ready) return null;
  const { archive,reference } = ready, c = archive.result.completion, p = archive.proposal;
  if (p.gameId !== gameId || archive.source.applicationId !== applicationId || c.activation.previousPlayId !== p.playId
    || c.activation.nextMatchState.playId !== p.playId + 1) throw new Error('terminal physical activation scope differs');
  assertFoulTerminalPriorActivation(db,gameId,p.playId,c.activation.nextMatchState.playId);
  const row = db.prepare('SELECT * FROM applications WHERE application_id=? AND match_id=?').get(applicationId,gameId);
  if (!row) throw new Error('terminal physical activation application missing');
  return freeze({match:c.activation.nextMatchState,world:c.nextWorld,officialRevision:archive.result.official.receipt.durableRevision,
    applicationHash:hash(row),readinessReference:reference});
  };
  // Match the existing actual-live activation bracket on the caller's owned
  // Native transaction; no readiness proof survives into a later operation.
  return db instanceof DatabaseSync && db.isTransaction ? withBattedWorldPhysicalReadTraversal(db,execute) : execute();
};
/** Called on the physical writer connection before and after each real write. */
export const assertFoulTerminalPhysicalActivationCurrent = (db: Db, raw: FoulTerminalReadinessReference,
  consumingGameId: string, consumingPlayId: number): void => {
  const reference = foulTerminalReadinessReference(raw);
  if (reference.gameId !== consumingGameId || reference.previousPlayId + 1 !== consumingPlayId) throw new Error('terminal readiness consuming frame differs');
  const ready = foulTerminalNextPlayReadinessFromSqlite(db).read(reference.terminalSourceId);
  if (json(ready.reference) !== json(reference) || ready.archive.result.completion.activation.nextMatchState.playId !== consumingPlayId) {
    throw new Error('terminal physical activation current readiness differs');
  }
};
