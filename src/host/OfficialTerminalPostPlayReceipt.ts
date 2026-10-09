import type { FoulTerminalCompletion, FoulTerminalPostPlayCompletionReference,
  PersistOfficialCompletedTerminalResult } from './world/ActualFoulTerminalPostPlayCompletion';
import { freeze } from '../core/world/club/ClubValidation';

/** Pure receipt envelopes. Original completion authentication remains with its
 * Native owner; sharing this formatting does not grant finalization authority. */
export const foulTerminalCompletionReference=(c:FoulTerminalCompletion):FoulTerminalPostPlayCompletionReference=>freeze({
  version:c.version,completionId:c.completionId,terminalSourceId:c.terminalReference.sourceId,setupSourceId:c.source.sourceId,sourceHash:c.sourceHash,snapshotHash:c.snapshotHash,
});
export const foulTerminalCompletionMatchEnvelope=(c:FoulTerminalCompletion|PersistOfficialCompletedTerminalResult)=>
 'finalResult' in c ? freeze({finalResult:c.finalResult}) : freeze({activation:c.activation,nextWorld:c.nextWorld});
export const foulTerminalCompletedOfficial=(official:import('./OfficialPendingPostPlay').PersistOfficialPendingNonLiveResult,c:FoulTerminalCompletion):PersistOfficialCompletedTerminalResult=>freeze({
 ...official,completion:foulTerminalCompletionReference(c),...foulTerminalCompletionMatchEnvelope(c),
});
