import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields, samePaReferenceValid, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaTerminalEndpoint } from './SamePlateAppearanceTerminalEndpoint';

export type AcceptedSamePaTerminalSettlement = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'same_pa_terminal_settlement_v1';
  terminalReference: SamePaReference<'pa_terminal_v1_endpoints'>;
}>;
export type SamePaTerminalSettlementPlan = Readonly<{
  kind: 'terminal_settlement_plan'; source: AcceptedSamePaTerminalSettlement;
  lineage: SamePaTerminalEndpoint['lineage']; enrollmentReference: SamePaTerminalEndpoint['enrollmentReference'];
  finalViewReference: SamePaTerminalEndpoint['finalViewReference']; coverageHash: string;
  participants: SamePaTerminalEndpoint['participants'];
}>;
export type SamePaTerminalSettlement = Readonly<{
  kind: 'applying' | 'settled'; reference: SamePaReference<'pa_settlement_v1_plans'>;
  plan: SamePaTerminalSettlementPlan;
  participants: readonly (SamePaTerminalSettlementPlan['participants'][number] & Readonly<{ applied: boolean }>)[];
}>;
export const samePaTerminalSettlementInput = (raw: unknown, sourceId?: string): AcceptedSamePaTerminalSettlement => {
  const source = cloneInert(raw) as AcceptedSamePaTerminalSettlement;
  if (!samePaFields(source, ['sourceId', 'sourceVersion', 'capability', 'terminalReference'])
    || !samePaText(source.sourceId) || !samePaText(source.sourceVersion)
    || sourceId !== undefined && source.sourceId !== sourceId || source.capability !== 'same_pa_terminal_settlement_v1'
    || !samePaReferenceValid(source.terminalReference, 'pa_terminal_v1_endpoints')) throw new Error('invalid same-PA terminal settlement Source');
  return freeze(source);
};
