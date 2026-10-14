import { expect, it, vi } from 'vitest';
import * as terminal from './SamePlateAppearanceTerminalLifecycleFixture.test-support';

it('enters the remaining original release directly without repeating freeze, settle, transition, or lifecycle writers', () => {
  const resume = terminal.completeSamePaTerminalReleaseFixture;
  expect(resume).toBeTypeOf('function');
  type Args = Parameters<typeof resume>;
  const prefix = vi.fn(() => { throw new Error('completed prefix replayed'); });
  const release = vi.fn(() => { throw new Error('first unreturned release'); });
  // This controlled fake contains only fields read before release. The sentinel
  // throws there; no fabricated record reaches a Native owner or later assertion.
  const retained = { outcome: { source: { sourceId: 'in-flight-fixture:fair-terminal:outcome' } },
    endpoint: { source: { sourceId: 'in-flight-fixture:fair-terminal:endpoint' }, enrollmentReference: { sourceId: 'native-enrollment' } },
    settled: { plan: { source: { sourceId: 'in-flight-fixture:fair-terminal:settlement' } } },
    transition: { source: { sourceId: 'in-flight-fixture:fair-terminal:transition' } }, originalEnrollment: { participants: new Array(10) } } as unknown as Args[1];
  const h = { f: { x: { f: { track: prefix } } }, save: prefix, advance: prefix } as unknown as Args[0];
  const owners = { settlements: { freeze: prefix, settle: prefix, release }, transitions: { complete: prefix },
    outcomes: { acceptOutcome: prefix }, endpoints: { accept: prefix }, enrollmentOwner: {} } as unknown as Args[2];
  expect(() => resume(h, retained, owners)).toThrow('first unreturned release');
  expect(prefix).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledWith('in-flight-fixture:fair-terminal:settlement');
});
