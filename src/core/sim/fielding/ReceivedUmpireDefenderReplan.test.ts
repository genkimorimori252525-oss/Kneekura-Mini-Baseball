import { beforeAll, expect } from 'vitest';
import * as Core from '../../index';
import { registerReceivedUmpireDefenderReplanContractTests, type ReceivedCallContractSubject } from './ReceivedUmpireDefenderReplan.contract.test-support';

// Authored and normally collected, but UNEXECUTED until the parent qualifies a callable
// real adapter. An unavailable entry/setup failure is never behavioral RED evidence.
// This optional type adds no production export, stub, fallback, mock, or runtime skip.
const namespace = Core as typeof Core & { deriveReceivedUmpireDefenderReplan?: ReceivedCallContractSubject };
beforeAll(() => {
  expect(namespace.deriveReceivedUmpireDefenderReplan,
    'Behavioral qualification requires the real callable adapter; availability failure is setup evidence only').toBeTypeOf('function');
});
registerReceivedUmpireDefenderReplanContractTests(input => {
  const derive = namespace.deriveReceivedUmpireDefenderReplan;
  if (!derive) throw new Error('The real received-call adapter has not been qualified for behavioral execution');
  return derive(input);
});
