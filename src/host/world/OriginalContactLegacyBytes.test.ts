import { expect, it, vi } from 'vitest';
import { prePitchRunnerContactFixture } from './PrePitchRunnerContactFixtures.test-support';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const state = vi.hoisted(() => ({ flight: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
// Full snapshot hashes captured from unchanged 3088794's owner, then compared byte-for-byte with the new owner.
const legacyHashes = { zero: '2948ed772c23f92dfbb2573bc921227918582d5f3a4a68b1de241904f638f076',
  rich: '5068e05f077b4d7d19d58da34e10be05a2cfdf4c07067c982c6f82d80c2a890b',
  cleanup: 'f2557ca026e96128aabe7441abf3f9f45bf8a084078d8fbd493dbf33f0ac13f1' };
it.each(['zero', 'rich', 'cleanup'] as const)('preserves complete legacy ten-player snapshot bytes for %s input', kind => {
  const x = prePitchRunnerContactFixture();
  try {
    const flight = structuredClone(x.flight) as any;
    delete flight.physicalPitch.source.prePitchRunner; delete flight.physicalPitch.frame.prePitchRunner;
    flight.physicalPitch.frame.match.bases = { first: null, second: null, third: null };
    flight.physicalPitch.frame.world.runners = [];
    state.flight = flight;
    const { kind: _kind, prePitchRunnerSourceId: _runner, ...original } = x.source;
    const source = { ...original, commands: original.commands.map((c, i) => ({ ...c,
      bodyAcceleration: { x: kind === 'zero' ? 0 : (i + 1) * (kind === 'cleanup' ? 1e-14 : 0.2), y: 0, z: kind === 'rich' ? -0.3 : 0 },
      primitiveMotions: c.primitiveMotions.map((p, j) => ({ ...p, offsetVelocity: { x: kind === 'rich' ? (j + 1) * 0.1 : 0, y: 0, z: 0 },
        offsetAcceleration: { x: 0, y: kind === 'rich' ? j * -0.04 : 0, z: 0 } })) })) };
    const value = battedWorldContactEvidenceFromSqlite(x.db).derive(source, x.model, null);
    expect(hash(value)).toBe(legacyHashes[kind]); expect(value.actors).toHaveLength(50);
    expect(value.source).not.toHaveProperty('kind'); expect(value.flight.physicalPitch.frame).not.toHaveProperty('prePitchRunner');
  } finally { x.db.close(); }
});
