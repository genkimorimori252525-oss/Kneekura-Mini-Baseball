import { expect, it } from 'vitest';
import { verifyActualKnownProfileSetup } from './ActualKnownProfileSetupPreflight.test-support';
it('checks all known-profile setup prerequisites while preserving every genuine downstream owner gate', () => {
  const value = verifyActualKnownProfileSetup();
  expect(value.checked).toHaveLength(8);
  expect(value.initialRuleProfileId).toBe('npb-2026');
  expect(value.roleEffortFixtureInputs.map(value => value.effortUnits)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(value.missingRoleBaselinePlayerIds).toHaveLength(9);
  expect(value.acceptedPhysicalPitchActions).toBe(0); expect(value.acceptedOfficialApplications).toBe(0);
  expect(value.acceptedWorkloadActivities).toBe(0); expect(value.acceptedNextActors).toBe(0);
  expect(value.pendingOwnerGates).toHaveLength(7); expect(value.wholePipelinePassed).toBe(false);
});
