import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { prepareSamePaInitialPlayFixture } from './SamePlateAppearanceInitialBallFixture.test-support';
import { prepareSamePaPhysicalLifecycleContinuation } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';

const boundary = vi.hoisted(() => ({
  db: null as DatabaseSync | null, posture: null as unknown, reads: [] as string[], failure: null as Error | null,
}));
// Only the expensive accepted evidence/next-writer boundaries are substituted.
// The fixture, Native connection, query-only guard and lifecycle phase are real.
// This verifies read scope and unchanged fixture inputs, not a Native LAN pass.
vi.mock('./SqliteSamePlateAppearanceOccupiedRunnerHoldStore', () => ({
  readSamePaOccupiedRunnerHoldFromSqlite: (db: DatabaseSync, pin: { sourceId: string }) =>
    withSamePaLifecycleReadPhase(db, () => {
      boundary.reads.push(pin.sourceId);
      if (boundary.failure) throw boundary.failure;
      return { source: { coverageThroughTick: pin.sourceId === 'first-hold' ? 900 : 800 } };
    }),
}));
vi.mock('./SamePlateAppearanceOriginalParticipants', () => ({
  readSamePaOriginalParticipants: (db: DatabaseSync) => withSamePaLifecycleReadPhase(db, () => []),
}));
vi.mock('./SamePlateAppearanceDispatchRoles', () => ({ deriveSamePaDispatchRoles: () => [{ member: { playerId: 'batter' } }] }));
const outsideRead = () => {
  expect(boundary.db!.isTransaction).toBe(false);
  expect(boundary.db!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
};
vi.mock('./SqliteBattingPerceptionStore', () => ({
  openSqliteBattingPerceptionStore: (_path: string, authority: { readAcceptedPosture(id: string): unknown }) => ({
    acceptPosture: (id: string) => { outsideRead(); boundary.posture = authority.readAcceptedPosture(id); throw new Error('first posture writer'); },
  }),
}));
vi.mock('./SamePlateAppearanceNonemptyFixture.test-support', () => ({
  prepareSamePaNonemptyFixture: () => { outsideRead(); throw new Error('first continuation writer'); },
}));
const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture = () => {
  const db = new Native(':memory:'); boundary.db = db; boundary.posture = null; boundary.reads = []; boundary.failure = null;
  const holds = [{ sourceId: 'first-hold' }, { sourceId: 'second-hold' }];
  const f = { db, path: ':memory:', actor: { world: { tick: 10, runners: [{}] }, binding: { playerId: 'batter' } },
    acceptedAction: { source: { nominalPitch: { delivery: { readyAtUs: 100 }, batter: { plateZ: 0, strikeZone: { bottom: 1, top: 2 } } },
      occupiedRunnerHoldReferences: holds, viewReference: { sourceId: 'view' }, batterModelReference: { sourceId: 'model' } } },
    x: { f: { track: <T>(value: T) => value } }, stance: { handedness: 'R', centerOfMass: { x: 1, y: 2, z: 3 }, eyePosition: { x: 4, y: 5, z: 6 } },
    request: { actionReference: { sourceId: 'action' } }, view: {} };
  return { db, f, holds };
};

it('reads initial occupied evidence in a Native query-only scope and ends it before posture acceptance', () => {
  const { db, f, holds } = fixture(), accepted = new Map<string, unknown>();
  try {
    expect(() => prepareSamePaInitialPlayFixture(f as unknown as Parameters<typeof prepareSamePaInitialPlayFixture>[0], accepted, [],
      {} as Parameters<typeof prepareSamePaInitialPlayFixture>[3], 'lane')).toThrow('first posture writer');
    expect(boundary.reads).toEqual(['first-hold', 'second-hold']);
    expect(boundary.posture).toMatchObject({ sourceId: 'lane:initial-posture', viewReference: { sourceId: 'view' },
      actionReference: { sourceId: 'action' }, modelReference: { sourceId: 'model' }, occupiedRunnerHoldReferences: holds,
      geometry: { startedAtTick: 10, validUntilTick: 800, bodyReadyTick: 100, centerOfMass: f.stance.centerOfMass, eyePosition: f.stance.eyePosition } });
    outsideRead();
  } finally { db.close(); }
});

it('uses the same Native read scope for the direct second-TAKE continuation before its first writer', () => {
  const { db, f } = fixture();
  type Args = Parameters<typeof prepareSamePaPhysicalLifecycleContinuation>;
  try {
    expect(() => prepareSamePaPhysicalLifecycleContinuation(f as unknown as Args[0], new Map(),
      { lineage: { participantReferences: [] } } as unknown as Args[2], [], {} as Args[4], {} as Args[5]))
      .toThrow('first continuation writer');
    expect(boundary.reads).toEqual(['first-hold', 'second-hold']); outsideRead();
  } finally { db.close(); }
});

it('propagates failed occupied evidence, restores the connection and never prepares a posture', () => {
  const { db, f } = fixture(), accepted = new Map<string, unknown>(), failure = new Error('original hold rejected');
  boundary.failure = failure;
  try {
    expect(() => prepareSamePaInitialPlayFixture(f as unknown as Parameters<typeof prepareSamePaInitialPlayFixture>[0], accepted, [],
      {} as Parameters<typeof prepareSamePaInitialPlayFixture>[3])).toThrow(failure);
    expect(accepted.size).toBe(0); expect(boundary.posture).toBe(null); outsideRead();
  } finally { db.close(); }
});
