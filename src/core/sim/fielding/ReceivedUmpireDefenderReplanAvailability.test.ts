import { describe, expect, it } from 'vitest';
import * as Core from '../../index';
import type { ReceivedCallContractSubject } from './ReceivedUmpireDefenderReplan.contract.test-support';

/** Select alone. Failure establishes only that the future public entry is absent. */
describe('ReceivedUmpireDefenderReplan public entry availability', () => {
  it('exposes the callable received-call pure adapter through the existing Core namespace', () => {
    const namespace = Core as typeof Core & { deriveReceivedUmpireDefenderReplan?: ReceivedCallContractSubject };
    expect(namespace.deriveReceivedUmpireDefenderReplan).toBeTypeOf('function');
  });
});
