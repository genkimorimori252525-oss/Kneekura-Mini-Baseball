import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

export const scheduledAcquisitionHistoryFixture = () => {
  const x = battedWorldFieldExecutionFixture(undefined, 'candidate');
  const executions: DurableBattedWorldFieldExecution[] = [];
  const accept = (sourceId: string, action: AcceptedBattedWorldFieldExecution['action']) => {
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId,
      previousExecutionSourceId: executions.at(-1)?.source.sourceId ?? null, action };
    x.sources.set(sourceId, source);
    const result = x.executions.accept(sourceId); executions.push(result); return result;
  };
  const prefix = () => ({ baseField: x.baseField, fields: [x.baseField], executions });
  return { ...x, executionPrefix: executions, accept, prefix };
};
