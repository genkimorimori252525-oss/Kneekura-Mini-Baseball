import type { DurableFoulTerminalApplicationQueue, DurableFoulTerminalAppliedPending } from './ActualFoulTerminalApplication';
import { officialStateHash as hash, officialStateSerialized as json } from '../OfficialStateEncoding';

export type Applied = DurableFoulTerminalAppliedPending;
export type Acknowledgement = ReturnType<typeof expectedAcknowledgement>;
export type Acknowledged = Omit<Applied,'status'|'result'> & Readonly<{
  status:'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY';
  result:Omit<Applied['result'],'acknowledgement'> & { acknowledgement:Acknowledgement };
}>;
export type AcknowledgementRunner = {
  read(sourceId: string): DurableFoulTerminalApplicationQueue | Applied | Acknowledged | null;
  apply(sourceId: string): Applied | Acknowledged;
  acknowledge?: (sourceId: string) => Acknowledged;
  close(): void;
};
/** Independent test oracle. Never imported by a production module and never
 * used to insert a synthetic successful receipt. Its inputs come from genuine
 * original E/C/proposal and the real pending application in acceptance tests. */
export const expectedAcknowledgement = (applied: Pick<Applied,'source'|'proposal'> &
  { result:Pick<Applied['result'],'official'> }) => {
  const p = applied.proposal, o = applied.result.official;
  return {
    version:'actual_foul_terminal_official_acknowledgement_v1' as const,
    acknowledgementId:json(['actual_foul_terminal_official_acknowledgement_v1',p.officialObligation.obligationKey,p.source.sourceId]),
    obligationKey:p.officialObligation.obligationKey,originalSuccessorKey:p.originalSuccessorKey,
    scope:p.officialObligation.scope,status:'consumed' as const,consumer:o.pendingPostPlay.origin,
    physicalEndReference:p.physicalEndReference,consumptionReference:p.consumptionReference,officialReference:p.officialReference,
    applicationReference:{ owner:'applications' as const,matchId:p.gameId,
      applicationId:o.receipt.applicationId,closureId:o.receipt.closureId,previousPlayId:o.receipt.previousPlayId,
      durableRevision:o.receipt.durableRevision,requestHash:o.pendingPostPlay.requestHash,receiptHash:hash(o.receipt) },
  };
};
