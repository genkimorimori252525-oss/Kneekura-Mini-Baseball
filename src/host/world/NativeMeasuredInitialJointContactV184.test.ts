import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import type { RigidBatBallContactResult } from '../../core/sim/contact/RigidBatBallContact';
import type { CanonicalPlateAppearanceEvent } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readNativeMeasuredInitialJointContactV184FromSqlite as read,
  selectInitialJointContactV184 as select } from './NativeMeasuredInitialJointContactV184';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type ContactEvent = Extract<CanonicalPlateAppearanceEvent, { kind: 'BatBallContact' }>;
// Pure synthetic selection data only. These inputs carry no Native execution,
// actor, control, rigid-physics or fixture authority.
const rigidContact: RigidBatBallContactResult = { tick: 100, ballCenter: { x: 0, y: 1.2, z: 0 }, segmentT: 0.5,
  localBatRadiusM: 0.033, normal: { x: 1, y: 0, z: 0 }, batSurfacePoint: { x: -0.1, y: 1.2, z: 0 },
  ballSurfacePoint: { x: -0.1, y: 1.2, z: 0 }, normalRelativeSpeedBeforeMps: 31, tangentialRelativeSpeedBeforeMps: 2,
  normalImpulseNs: 7, tangentialImpulseNs: { x: 0, y: -0.2, z: 0.3 }, totalImpulseNs: { x: 7, y: -0.2, z: 0.3 },
  effectiveNormalMassKg: 0.1, batNormalEffectiveMassKg: 0.4, normalEffectiveMassSource: 'rigid_body', batRecoilModel: 'rigid_body',
  exitVelocity: { x: -17, y: 23, z: 31 }, exitSpin: { x: 47, y: -53, z: -0 },
  batExitCenterOfMassVelocity: { x: 1, y: 2, z: 3 }, batExitAngularVelocity: { x: 4, y: 5, z: 6 } };
const contactMoment: BallWorldMoment = { originTick: 100, elapsedSeconds: 0.00000025,
  ball: { tick: 100, position: { x: 0, y: 1.2, z: 0 }, velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } };
const contactEvent: ContactEvent = { tick: 100, sequence: 5, kind: 'BatBallContact', payload: { countBefore: { balls: 1, strikes: 2 },
  contact: { tick: rigidContact.tick, ballCenter: rigidContact.ballCenter, point: rigidContact.ballSurfacePoint,
    batPoint: rigidContact.batSurfacePoint, normal: rigidContact.normal, segmentT: rigidContact.segmentT,
    exitVelocity: rigidContact.exitVelocity, exitSpin: rigidContact.exitSpin } } };
const batResult = () => ({ kind: 'bat_contact' as const, contact: rigidContact, moment: contactMoment });

it('IJ184-S01 selects only the added canonical event and retains full rigid contact and the exact sub-tick moment', () => {
  const prior = { ...contactEvent, tick: 7, sequence: 2 }, before = { events: [prior] }, after = { events: [prior, contactEvent] };
  const result = select(before, after, batResult());
  expect(result).toStrictEqual({ contactEvent, rigidContact, contactMoment });
  expect(result?.contactMoment.elapsedSeconds).toBe(0.00000025);
  expect(result?.contactMoment.originTick).toBe(100);
  expect(result?.rigidContact.exitVelocity).toStrictEqual({ x: -17, y: 23, z: 31 });
  expect(Object.is(result?.rigidContact.exitSpin.z, -0)).toBe(true);
  expect(result?.contactEvent.sequence).toBe(5);
});

it('IJ184-S02 keeps non-bat-contact execution distinct from an earlier timeline contact', () => {
  expect(select({ events: [] }, { events: [] }, { kind: 'scene_result' })).toBeNull();
  expect(select({ events: [contactEvent] }, { events: [contactEvent] }, { kind: 'actor_contact' })).toBeNull();
});

it('IJ184-S03 rejects a bat contact whose canonical event was not added after the original launch', () => {
  expect(() => select({ events: [contactEvent] }, { events: [contactEvent] }, batResult())).toThrow(/canonical contact event/);
});

it('IJ184-N01 rejects absent and malformed Native execution refs while preserving the caller snapshot and authorizer', () => {
  const db = new DatabaseSync(':memory:');
  const ref: SamePaReference<'pa_initial_joint_v1_executions'> = { owner: 'pa_initial_joint_v1_executions', sourceId: 'missing-execution',
    sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
  const state = () => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get()!.query_only,
    changes: db.prepare('SELECT total_changes() n').get()!.n, schema: db.prepare('PRAGMA main.schema_version').get()!.schema_version });
  try {
    db.setAuthorizer(code => code === constants.SQLITE_ATTACH || code === constants.SQLITE_DETACH
      ? constants.SQLITE_DENY : constants.SQLITE_OK);
    for (const queryOnly of [0, 1]) {
      db.exec('BEGIN'); db.exec('PRAGMA query_only=' + queryOnly); db.exec('SAVEPOINT initial_joint_measurement_caller');
      try {
        const before = state();
        for (const invalid of [ref, { ...ref, snapshotHash: 'c'.repeat(64) }, { ...ref, sourceHash: 'invalid-hash' },
          { ...ref, owner: 'pa_initial_joint_v1_rights' }, { ...ref, cachedProof: batResult() }]) {
          expect(() => read(db, invalid as typeof ref)).toThrow();
        }
        expect(state()).toStrictEqual(before);
        expect(() => db.exec("ATTACH ':memory:' AS foreign_owner")).toThrow(/authorized/i);
        db.exec('RELEASE initial_joint_measurement_caller'); expect(db.isTransaction).toBe(true);
      } finally { db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
    }
  } finally { db.setAuthorizer(null); db.close(); }
});
