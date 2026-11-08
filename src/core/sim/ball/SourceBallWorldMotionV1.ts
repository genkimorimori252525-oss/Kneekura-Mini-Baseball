import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import type { BallWorldContinuation, BallWorldMotionActor } from './BallWorldContinuation';
import { assertBattedResponseProfiles, type BallWorldResponseInput } from './BattedBallContactResponse';
import { respondToBallWorldBoundary, type BattedWorldBallCursor } from './BattedWorldContinuation';
import { deriveBattedWorldMotionActorsAtExactCoverage, type BattedWorldPrimitiveMotionCommand } from './BattedWorldMotion';
import { createSourceFreeBallKernel } from './SourceFreeBallKernel';
import { createSourceImpactEscapeSessionV3 } from './SourceFreeBallWorldQuery';
import { measureRigidBatBallSurfaceSeparation, type RigidBatState, type RigidBaseballProperties } from '../contact/RigidBatBallContact';
import { multiplyQuaternions } from '../pitching/BaseballOrientation';
import type { BattedWorldBaseId } from './BattedWorldBaseGeometry';
import type { BattedBallBasePrism } from './BattedBallBaseContact';
import type { BallContactMaterial } from './BallContactResponse';

type Quaternion = Readonly<{ x: number; y: number; z: number; w: number }>;
type HeldBat = Readonly<{ equipmentId: string; holderPlayerId: string; bat: RigidBatState; ball: RigidBaseballProperties }>;
type BaseGeometry = Readonly<{ bases: Readonly<Record<BattedWorldBaseId, BattedBallBasePrism>>;
  materials: Readonly<Record<BattedWorldBaseId, BallContactMaterial>> }>;
export type SourceBallWorldMotionInputV1 = Readonly<{
  version: 'source_ball_world_motion_v1'; response: BallWorldResponseInput;
  cursor: BattedWorldBallCursor; materialOrientationAtSourceBasis: Quaternion;
  heldBats: readonly HeldBat[]; baseGeometry: BaseGeometry | null;
}>;
const axes = ['x', 'y', 'z'] as const, ids = ['home', 'first', 'second', 'third'] as const;
const zero = (p: Readonly<{ x: number; y: number; z: number }>) => axes.every(k => p[k] === 0);
const json = (p: unknown): string => JSON.stringify(p, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
const freeze = <T>(p: T): T => { if (p && typeof p === 'object') { Object.values(p).forEach(freeze); Object.freeze(p); } return p; };
function assert(p: unknown, message: string): asserts p { if (!p) throw new Error('Source ball World motion: ' + message); }
const baseSurface = (id: BattedWorldBaseId) => `source-motion-base:${id}`;

/** Exact-offset, flight-independent free-ball control. This pure session grants
 * no Native actuation/custody/official authority. The owner must reconstruct
 * the root, complete geometry, materials and commands from authenticated rows.
 * V1 retains stationary held bats; moving/releasing one requires a new physical
 * equipment controller, rather than deleting its collider. */
export function createSourceBallWorldMotionSessionV1(raw: SourceBallWorldMotionInputV1) {
  const root = cloneInert(raw);
  assert(root && Object.keys(root).sort().join('|') === 'baseGeometry|cursor|heldBats|materialOrientationAtSourceBasis|response|version'
    && root.version === 'source_ball_world_motion_v1' && Array.isArray(root.heldBats), 'invalid root');
  assertBattedResponseProfiles(root.response);
  assert(root.cursor?.sourceCurve && ['incoming', 'outgoing'].includes(root.cursor.sourceSide!), 'missing exact Source cursor');
  const p = root.response.world.parameters, d = root.cursor.sourceCurve, q = root.materialOrientationAtSourceBasis;
  assert(json(root.response.world.sourceCurve) === json(d) && p.ticksPerSecond === d.profile.air.ticksPerSecond
    && p.gravityY === d.profile.air.gravityY && p.ballRadius === d.profile.ground.radiusM
    && p.integrationStepTicks === d.profile.air.integrationStepTicks, 'response Source/profile differs');
  assert(q && Object.keys(q).sort().join('|') === 'w|x|y|z' && Object.values(q).every(Number.isFinite)
    && Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) <= 8 * Number.EPSILON, 'invalid material orientation');
  assert(!root.response.world.surfaces.some(s => ids.some(id => s.surfaceId === baseSurface(id))), 'reserved base surface identity');
  if (root.baseGeometry !== null) assert(root.baseGeometry && Object.keys(root.baseGeometry).sort().join('|') === 'bases|materials'
    && Object.keys(root.baseGeometry.bases).sort().join('|') === 'first|home|second|third'
    && Object.keys(root.baseGeometry.materials).sort().join('|') === 'first|home|second|third'
    && ids.every(id => Object.values(root.baseGeometry!.materials[id]).every(x => Number.isFinite(x) && x >= 0 && x <= 1)
      && Object.keys(root.baseGeometry!.materials[id]).sort().join('|') === 'restitution|spinDamping|tangentialDamping'), 'invalid base material coverage');
  let cursor: BattedWorldBallCursor = root.cursor;
  let actors: readonly BallWorldMotionActor[] = root.response.world.actors;
  let orientationBasis = q, stopped = false;
  const session = createSourceImpactEscapeSessionV3(), equipmentIds = new Set<string>();
  const stationaryBats = (at: BattedWorldBallCursor, bodies: typeof actors) => {
    for (const item of root.heldBats) {
      assert(item && Object.keys(item).sort().join('|') === 'ball|bat|equipmentId|holderPlayerId'
        && typeof item.equipmentId === 'string' && item.equipmentId.trim() === item.equipmentId && item.equipmentId.length > 0
        && typeof item.holderPlayerId === 'string' && item.holderPlayerId.length > 0, 'invalid held bat identity');
      const palm = bodies.find(a => a.playerId === item.holderPlayerId && a.primitive.role === 'tag_hand');
      assert(palm && zero(palm.primitive.startVelocity) && zero(palm.primitive.acceleration)
        && zero(item.bat.centerOfMassVelocity) && zero(item.bat.angularVelocity), 'moving held bat requires equipment controller');
      assert(item.ball.radiusM === p.ballRadius, 'equipment ball radius differs');
      // Existing rigid-body validator checks the entire tapered geometry/material.
      measureRigidBatBallSurfaceSeparation(at.moment.ball, item.bat, item.ball);
    }
  };
  stationaryBats(cursor, actors);
  for (const item of root.heldBats) { assert(!equipmentIds.has(item.equipmentId), 'duplicate equipment'); equipmentIds.add(item.equipmentId); }
  const query = (at: BattedWorldBallCursor, throughElapsedSeconds: number) => {
    const baseOf = (surfaceId: string) => ids.find(id => baseSurface(id) === surfaceId);
    return session.query({ descriptor: at.sourceCurve!, moment: at.moment,
      side: at.sourceSide!, throughElapsedSeconds, actors, surfaces: root.response.world.surfaces,
      previousContacts: at.previousContacts.filter(c => c.kind !== 'surface' || !baseOf(c.surfaceId)),
      previousBaseContacts: at.previousContacts.flatMap(c => c.kind === 'surface' && baseOf(c.surfaceId) ? [baseOf(c.surfaceId)!] : []),
      ...(root.baseGeometry ? { bases: root.baseGeometry.bases } : {}) });
  };
  // Validate current actor coverage and exact original ball without advancing it.
  query(cursor, cursor.moment.elapsedSeconds);
  const snapshot = () => freeze({ cursor, actors, heldBats: root.heldBats,
    orientation: multiplyQuaternions(createSourceFreeBallKernel(cursor.sourceCurve!).evaluateAt(cursor.moment.elapsedSeconds, cursor.sourceSide!).orientation, orientationBasis),
    stopped, nativeAdmission: false as const });
  const advance = (throughTick: number) => {
    assert(!stopped && Number.isSafeInteger(throughTick) && throughTick >= 0, 'stopped or invalid horizon');
    const horizon = (throughTick - cursor.moment.originTick) / p.ticksPerSecond;
    assert(horizon > cursor.moment.elapsedSeconds && horizon <= cursor.sourceCurve!.throughElapsedSeconds, 'finite Source horizon exceeded');
    const observed = query(cursor, horizon);
    if (observed.kind === 'unresolved') return freeze({ kind: 'unresolved' as const, observed, state: snapshot() });
    const kernel = createSourceFreeBallKernel(cursor.sourceCurve!);
    // Stationary full tapered bat, bounded against every original Source cell.
    // No frame sampling, radius substitution, collider omission or position nudge.
    type Hit = { equipmentId: string; from: number; through: number; hit: boolean };
    const hits: Hit[] = [];
    let budget = 500000;
    for (const item of root.heldBats) {
      const gap = (t: number) => measureRigidBatBallSurfaceSeparation(kernel.evaluateAt(t, 'incoming').moment.ball, item.bat, item.ball);
      const search = (lo: number, hi: number, speed: number, rounding: number, depth = 0): Omit<Hit, 'equipmentId'> | null => {
        assert(--budget >= 0, 'equipment contact proof budget exhausted');
        const x = gap(lo), y = gap(hi);
        if (x <= 0) return { from: lo, through: lo, hit: true };
        if (Math.min(x, y) > speed * (hi - lo) + rounding) return null;
        const mid = (lo + hi) / 2;
        if (depth === 60 || mid === lo || mid === hi || hi - lo <= 1e-15) return { from: lo, through: hi, hit: y <= 0 };
        const left = search(lo, mid, speed, rounding, depth + 1);
        if (left?.hit || left && mid - left.from > 1e-12) return left;
        const right = search(mid, hi, speed, rounding, depth + 1);
        if (!left) return right;
        return right && right.through - left.from <= 1e-12 ? { ...right, from: left.from } : left;
      };
      for (const cell of kernel.cells) {
        const lo = Math.max(cursor.moment.elapsedSeconds, cell.fromElapsedSeconds), hi = Math.min(observed.moment.elapsedSeconds, cell.throughElapsedSeconds);
        if (hi < lo) continue;
        const norm = (x: Readonly<{ x: number; y: number; z: number }>) => Math.hypot(x.x, x.y, x.z);
        const arithmetic = 256 * Number.EPSILON * (1 + norm(item.bat.pose.grip) + norm(item.bat.pose.tip)
          + Math.max(norm(kernel.evaluateAt(lo).moment.ball.position), norm(kernel.evaluateAt(hi).moment.ball.position)) + item.ball.radiusM);
        const found = search(lo, hi, cell.maximumPositionSpeedMps, cell.positionRoundingBoundMeters + arithmetic);
        if (found) { hits.push({ equipmentId: item.equipmentId, ...found }); break; }
      }
    }
    hits.sort((a, b) => a.from - b.from);
    const first = hits[0];
    if (first) {
      if (!first.hit || hits.slice(1).some(h => h.from <= first.through)
        || observed.kind === 'boundary' && observed.contactSearchWitnesses.some(w => w.firstPossibleElapsedSeconds <= first.through)
        || observed.kind === 'boundary' && observed.contacts.some(c => c.kind === 'ground' || c.kind === 'rolling_stop') && observed.moment.elapsedSeconds <= first.through)
        return freeze({ kind: 'unresolved' as const, reason: 'equipment_contact_order_or_refinement', interval: first, state: snapshot() });
      const moment = kernel.evaluateAt(first.through, 'incoming').moment;
      cursor = { ...cursor, moment, sourceSide: 'incoming' }; stopped = true;
      return freeze({ kind: 'equipment_boundary' as const, contact: first, state: snapshot() });
    }
    const world: BallWorldContinuation = observed.kind === 'boundary' ? { kind: 'boundary', moment: observed.moment, phase: observed.phase,
      contacts: observed.contacts.map(c => c.kind === 'base' ? { ...c, kind: 'surface' as const, surfaceId: baseSurface(c.baseId) } : c),
      ...(observed.pendingReason ? { pendingReason: observed.pendingReason } : {}) }
      : { kind: observed.kind, moment: observed.moment, phase: observed.phase, throughTick };
    const responseInput = { ...root.response, world: { ...root.response.world, actors }, surfaces: [...root.response.surfaces,
      ...(root.baseGeometry ? ids.map(id => ({ surfaceId: baseSurface(id), material: root.baseGeometry!.materials[id] })) : [])] };
    const response = respondToBallWorldBoundary(responseInput, { ...cursor, previousContacts: [] }, world);
    if (response.kind === 'rebound' && response.cursor.sourceCurve) {
      const physicalResponse = { ...root.response, world: { ...root.response.world, actors } };
      if (observed.contacts[0].kind === 'base') session.adoptBaseImpulse(observed, physicalResponse, root.baseGeometry!.materials, response.cursor.sourceCurve);
      else session.adoptImpulse(observed, physicalResponse, response.cursor.sourceCurve);
      orientationBasis = multiplyQuaternions(kernel.evaluateAt(observed.moment.elapsedSeconds, 'incoming').orientation, orientationBasis);
    }
    if (response.cursor) cursor = response.cursor;
    else { cursor = { ...cursor, moment: observed.moment, sourceSide: 'incoming' }; stopped = true; }
    return freeze({ kind: 'world' as const, observed, response, state: snapshot() });
  };
  const adoptMotion = (rawCommand: Readonly<{ throughTick: number; availableAtElapsedSeconds: number; commands: readonly BattedWorldPrimitiveMotionCommand[] }>) => {
    const command = cloneInert(rawCommand);
    assert(!stopped && command && Object.keys(command).sort().join('|') === 'availableAtElapsedSeconds|commands|throughTick', 'stopped or invalid motion');
    assert(!(cursor.previousContacts.length && cursor.moment.elapsedSeconds === cursor.sourceCurve!.initial.elapsedSeconds),
      'certified impulse departure must finish before replacing actor commands');
    const next = deriveBattedWorldMotionActorsAtExactCoverage({ response: root.response, actors, cursor, carrierPlayerId: null,
      availableAtTick: quantizeEventTick(cursor.moment.originTick, command.availableAtElapsedSeconds, p.ticksPerSecond),
      throughTick: command.throughTick, commands: command.commands }, command.availableAtElapsedSeconds);
    stationaryBats(cursor, next);
    actors = next;
    return snapshot();
  };
  return Object.freeze({ snapshot, advance, adoptMotion });
}
