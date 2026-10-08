import type { PersistOfficialPendingNonLiveResult } from '../OfficialPendingPostPlay';
import type { FoulTerminalApplicationProposal, FoulTerminalAcknowledgedResult } from './ActualFoulTerminalApplication';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export const deriveFoulTerminalAcknowledgedResult = (p: FoulTerminalApplicationProposal,
  official: PersistOfficialPendingNonLiveResult): FoulTerminalAcknowledgedResult => {
  if (p.officialObligation.status !== 'pending' || p.officialObligation.consumer !== null
    || p.officialObligation.pendingReason !== 'terminal_official_closure_unowned') {
    throw new Error('foul terminal original official child acknowledgement premise differs');
  }
  return freeze({ sourceId:p.source.sourceId,official,acknowledgement:{
    version:'actual_foul_terminal_official_acknowledgement_v1',
    acknowledgementId:json(['actual_foul_terminal_official_acknowledgement_v1',p.officialObligation.obligationKey,p.source.sourceId]),
    obligationKey:p.officialObligation.obligationKey,originalSuccessorKey:p.originalSuccessorKey,
    scope:p.officialObligation.scope,status:'consumed',consumer:official.pendingPostPlay.origin,
    physicalEndReference:p.physicalEndReference,consumptionReference:p.consumptionReference,officialReference:p.officialReference,
    applicationReference:{ owner:'applications',matchId:p.gameId,
      applicationId:official.receipt.applicationId,closureId:official.receipt.closureId,previousPlayId:official.receipt.previousPlayId,
      durableRevision:official.receipt.durableRevision,requestHash:official.pendingPostPlay.requestHash,receiptHash:hash(official.receipt) },
  } });
};
