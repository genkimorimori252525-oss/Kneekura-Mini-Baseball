import { actualLiveRuleConsumptionOwnerFromSqlite, type AcceptedActualLiveRuleConsumption } from './ActualLiveRuleConsumptionFromSqlite';
import { openActualLiveImmutableReceiptStore } from './ActualLiveImmutableReceiptStore';
export type { AcceptedActualLiveRuleConsumption, DurableActualLiveRuleConsumption } from './ActualLiveRuleConsumptionFromSqlite';

export const openSqliteActualLiveRuleConsumptionStore = (path: string,
  authority?: Readonly<{ readAcceptedConsumption(sourceId: string): AcceptedActualLiveRuleConsumption | null }>) => {
  if (authority != null && typeof authority.readAcceptedConsumption !== 'function') throw new Error('invalid actual rule consumption authority');
  return openActualLiveImmutableReceiptStore(path, 'actual_live_rule_consumptions', actualLiveRuleConsumptionOwnerFromSqlite,
    authority && (sourceId => authority.readAcceptedConsumption(sourceId)));
};
