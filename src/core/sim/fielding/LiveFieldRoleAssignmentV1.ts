import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BaseballBase } from '../../rules/PhysicalRuleFacts';

export type LiveFieldRoleV1 = Readonly<{ playerId: string; taskId: string; point: Vec3;
  intent: 'intercept' | 'base_cover' | 'relay' | 'backup' | 'hold' | 'tag'; targetBase: BaseballBase | null }>;
export type LiveFieldRoleActorV1 = Readonly<{ playerId: string; position: Vec3; velocity: Vec3; homePosition: Vec3;
  topSpeedMps: number; accelerationMps2: number; throwSpeedMps: number; remainingReactionSeconds: number }>;
export type LiveFieldRoleInputV1 = Readonly<{ actors: readonly LiveFieldRoleActorV1[];
  bases: Readonly<Record<BaseballBase, Vec3>>; ballPosition: Vec3; ballVelocity: Vec3; pickupPoint: Vec3;
  threats: readonly Readonly<{ base: BaseballBase; arrivalSeconds: number }>[];
  reservations: readonly LiveFieldRoleV1[]; previous: readonly LiveFieldRoleV1[] }>;

/** Controller geometry/costs, not player intelligence or empirical ability.
 * Cutoff lies on the intended throw line; backup lies beyond its receiver.
 * See Sam Piraro, ABCA Inside Pitch July/August 2020, Cutoff and Relay System.
 * No role is a possession, arrival, catch, force out or teleportation. */
export const LIVE_FIELD_ROLE_POLICY_V1 = Object.freeze({ switchCostSeconds: .25,
  lateArrivalCost: 2, backupDepthMeters: 10, pickupBackupDepthMeters: 6, directThrowSeconds: .9 });
const flatDistance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (p: Vec3) => p && [p.x, p.y, p.z].every(Number.isFinite);
const freeze = <T>(x: T): T => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };

/** Acceleration-limited planar arrival estimate including current along-track
 * velocity, reversal and lateral braking. Used for ranking only; the actual
 * motor integrates its own continuous command and alone establishes arrival. */
export function liveFieldArrivalSecondsV1(actor: LiveFieldRoleActorV1, target: Vec3, radius = .28): number {
  if (!finite(actor.position) || !finite(actor.velocity) || !finite(target)
    || ![actor.accelerationMps2, actor.topSpeedMps].every(n => Number.isFinite(n) && n > 0)
    || !Number.isFinite(radius) || radius < 0 || !Number.isFinite(actor.remainingReactionSeconds) || actor.remainingReactionSeconds < 0)
    throw new Error('invalid live field arrival estimate');
  let d = Math.max(0, flatDistance(actor.position, target) - radius);
  if (d === 0) return 0;
  const length = flatDistance(actor.position, target), dx = (target.x - actor.position.x) / length, dz = (target.z - actor.position.z) / length,
    a = actor.accelerationMps2, maximum = actor.topSpeedMps,
    along = actor.velocity.x * dx + actor.velocity.z * dz,
    lateral = Math.abs(actor.velocity.x * dz - actor.velocity.z * dx);
  let initial = Math.max(-maximum, Math.min(maximum, along)), delay = actor.remainingReactionSeconds + lateral / a;
  if (initial < 0) { delay -= initial / a; d += initial * initial / (2 * a); initial = 0; }
  const acceleratingDistance = (maximum * maximum - initial * initial) / (2 * a);
  return delay + (d <= acceleratingDistance ? (Math.sqrt(initial * initial + 2 * a * d) - initial) / a
    : (maximum - initial) / a + (d - acceleratingDistance) / maximum);
}

/** One actor per task, one task per actor. Bitmask dynamic programming is
 * O(n² 2^n), bounded to nine; it never searches permutations. Only threatened
 * bases are reserved, leaving actual throw/pickup backups and deep positions. */
export function assignLiveFieldRolesV1(raw: LiveFieldRoleInputV1): readonly LiveFieldRoleV1[] {
  const input = cloneInert(raw), actors = input.actors;
  if (actors.length !== 9 || new Set(actors.map(a => a.playerId)).size !== actors.length
    || actors.some(a => !a.playerId || !finite(a.position) || !finite(a.velocity) || !finite(a.homePosition)
      || ![a.topSpeedMps, a.accelerationMps2, a.throwSpeedMps].every(n => Number.isFinite(n) && n > 0)
      || !Number.isFinite(a.remainingReactionSeconds) || a.remainingReactionSeconds < 0)
    || !finite(input.ballPosition) || !finite(input.ballVelocity) || !finite(input.pickupPoint)
    || ![1, 2, 3, 4].every(n => finite(input.bases[n as BaseballBase]))) throw new Error('invalid live field role geometry/actors');
  const reservedIds = new Set<string>(), covered = new Set<BaseballBase>(), taskIds = new Set<string>();
  for (const role of input.reservations) {
    if (!actors.some(a => a.playerId === role.playerId) || reservedIds.has(role.playerId) || !role.taskId || taskIds.has(role.taskId)
      || !finite(role.point) || !['intercept', 'base_cover', 'hold', 'tag'].includes(role.intent)
      || role.targetBase !== null && ![1, 2, 3, 4].includes(role.targetBase)
      || role.targetBase !== null && covered.has(role.targetBase)) throw new Error('duplicate or invalid live field reservation');
    reservedIds.add(role.playerId); taskIds.add(role.taskId); if (role.targetBase !== null) covered.add(role.targetBase);
  }
  const threats = new Map<BaseballBase, number>();
  for (const threat of input.threats) {
    if (![1, 2, 3, 4].includes(threat.base) || !Number.isFinite(threat.arrivalSeconds) || threat.arrivalSeconds < 0)
      throw new Error('invalid live field runner threat');
    threats.set(threat.base, Math.min(threats.get(threat.base) ?? Infinity, threat.arrivalSeconds));
  }
  type Task = Omit<LiveFieldRoleV1, 'playerId'> & { deadline?: number };
  const available = actors.filter(a => !reservedIds.has(a.playerId)), tasks: Task[] = [];
  const primary = input.reservations.find(r => r.intent === 'base_cover')?.targetBase
    ?? [...threats].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]?.[0] ?? null;
  for (const [base, deadline] of [...threats].sort((a, b) => a[1] - b[1] || a[0] - b[0])) if (!covered.has(base))
    tasks.push({ taskId: 'cover:' + base, point: input.bases[base], intent: 'base_cover', targetBase: base, deadline });
  const beyond = (from: Vec3, target: Vec3, depth: number, fallback: Vec3): Vec3 => {
    let dx = target.x - from.x, dz = target.z - from.z, length = Math.hypot(dx, dz);
    if (length === 0) { dx = fallback.x; dz = fallback.z; length = Math.hypot(dx, dz); }
    if (length === 0) return { ...target }; // no invented global direction
    return { x: target.x + dx / length * depth, y: target.y, z: target.z + dz / length * depth };
  };
  if (primary !== null && tasks.length < available.length) {
    const target = input.bases[primary], length = flatDistance(input.ballPosition, target),
      strongest = Math.max(...actors.map(a => a.throwSpeedMps));
    if (length > strongest * LIVE_FIELD_ROLE_POLICY_V1.directThrowSeconds && tasks.length + 1 < available.length)
      tasks.push({ taskId: 'relay:' + primary, point: { x: (input.ballPosition.x + target.x) / 2, y: target.y,
        z: (input.ballPosition.z + target.z) / 2 }, intent: 'relay', targetBase: null });
    tasks.push({ taskId: 'throw-backup:' + primary, point: beyond(input.ballPosition, target, LIVE_FIELD_ROLE_POLICY_V1.backupDepthMeters, input.ballVelocity),
      intent: 'backup', targetBase: null });
  }
  if (tasks.length < available.length && flatDistance(input.ballPosition, input.pickupPoint) + Math.hypot(input.ballVelocity.x, input.ballVelocity.z) > 0)
    tasks.push({ taskId: 'pickup-backup', point: beyond(input.ballPosition, input.pickupPoint, LIVE_FIELD_ROLE_POLICY_V1.pickupBackupDepthMeters, input.ballVelocity),
      intent: 'backup', targetBase: null });
  // Hold is a genuine motor target at a declared home position, never an
  // arbitrary offset around the ball. Select spare homes farthest from play.
  for (const a of [...available].sort((a, b) => flatDistance(b.homePosition, input.ballPosition) - flatDistance(a.homePosition, input.ballPosition))) {
    if (tasks.length === available.length) break;
    tasks.push({ taskId: 'hold:' + a.playerId, point: a.homePosition, intent: 'hold', targetBase: null });
  }
  if (tasks.length !== available.length) throw new Error('live field tasks exceed available actors');
  const n = available.length, size = 1 << n, costs = new Float64Array(size).fill(Infinity), parents = new Int32Array(size).fill(-1);
  costs[0] = 0;
  for (let mask = 0; mask < size; mask++) {
    if (!Number.isFinite(costs[mask])) continue;
    let task = 0; for (let bits = mask; bits; bits &= bits - 1) task++;
    if (task === n) continue;
    for (let i = 0; i < n; i++) if (!(mask & (1 << i))) {
      const actor = available[i], slot = tasks[task], eta = liveFieldArrivalSecondsV1(actor, slot.point), previous = input.previous.find(r => r.playerId === actor.playerId),
        weight = slot.intent === 'base_cover' ? 4 : slot.intent === 'relay' ? 1 : slot.intent === 'backup' ? .25 : .1,
        switchCost = previous && previous.taskId !== slot.taskId ? LIVE_FIELD_ROLE_POLICY_V1.switchCostSeconds : 0,
        cost = costs[mask] + weight * eta + (slot.deadline === undefined ? 0 : LIVE_FIELD_ROLE_POLICY_V1.lateArrivalCost * Math.max(0, eta - slot.deadline)) + switchCost,
        next = mask | (1 << i);
      if (cost < costs[next]) { costs[next] = cost; parents[next] = i; }
    }
  }
  const result: LiveFieldRoleV1[] = [...input.reservations]; let mask = size - 1;
  for (let task = n - 1; task >= 0; task--) { const actor = parents[mask];
    if (actor < 0) throw new Error('live field role assignment is unresolved');
    const { deadline: _deadline, ...role } = tasks[task]; result.push({ playerId: available[actor].playerId, ...role }); mask ^= 1 << actor;
  }
  return freeze(actors.map(a => result.find(r => r.playerId === a.playerId)!));
}
