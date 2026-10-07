import { expect, it } from 'vitest';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedRead, pairedPitchFixture } from './BattedBallFlightPairedPitch.test-support';

// Initial RED selection: this existing derive API works on 4550. No future paired API is invoked.
it('paired flight derive authenticates each owned action once with unchanged bytes', () => {
  const x = pairedPitchFixture();
  try {
    const counts = x.observeReplay();
    const value = ownedRead(x.db, () => x.owner.derive(x.g.input, null));
    expect(actorJson(value)).toBe(x.expectedJson);
    expect(actorJson(x.rows())).toBe(x.beforeRows);
    console.info(JSON.stringify({ schema: 'batted_flight_pair_red_witness_v1', ownedActions: 3,
      authentications: counts.authentications, executions: counts.executions,
      resultBytesMatch: true, originalRowsUnchanged: true }));
    // Removing authentic validation would also fail: exactly one full replay is required.
    expect(counts.authentications).toBe(1);
    expect(counts.executions).toEqual([0, 1, 2]);
  } finally { x.close(); }
});
