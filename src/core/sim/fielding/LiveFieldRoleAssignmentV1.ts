import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BaseballBase } from '../../rules/PhysicalRuleFacts';

export type LiveFieldRoleV1 = Readonly<{ playerId: string; taskId: string; point: Vec3;
  intent: 'intercept' | 'base_cover' | 'relay' | 'backup' | 'hold' | 'tag'; targetBase: BaseballBase | null }>;
export type LiveFieldDefensivePositionV1 = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';
export type LiveFieldRoleActorV1 = Readonly<{ playerId: string; position: Vec3; velocity: Vec3; homePosition: Vec3;
  topSpeedMps: number; accelerationMps2: number; throwSpeedMps: number; remainingReactionSeconds: number;
  defensivePosition?: LiveFieldDefensivePositionV1;
  pursuitCostWeight?: number }>;
export type LiveFieldRoleInputV1 = Readonly<{ actors: readonly LiveFieldRoleActorV1[];
  bases: Readonly<Record<BaseballBase, Vec3>>; ballPosition: Vec3; ballVelocity: Vec3; pickupPoint: Vec3;
  ballPhase?: 'free' | 'held' | 'throw'; activeThrow?: Readonly<{ from: Vec3; target: Vec3 }>;
  threats: readonly Readonly<{ base: BaseballBase; arrivalSeconds: number }>[];
  reservations: readonly LiveFieldRoleV1[]; previous: readonly LiveFieldRoleV1[] }>;
type RoleTask = Omit<LiveFieldRoleV1, 'playerId'> & { deadline?: number;
  responsiblePositions?: readonly LiveFieldDefensivePositionV1[]; supportingPositions?: readonly LiveFieldDefensivePositionV1[] };
const defensivePositions: readonly LiveFieldDefensivePositionV1[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

/** Controller geometry/costs, not player intelligence or empirical ability.
 * Cutoff lies on the intended throw line; backup lies beyond its receiver.
 * See Sam Piraro, ABCA Inside Pitch July/August 2020, Cutoff and Relay System.
 * Position responsibilities are finite opportunity costs, not prohibitions:
 * emergencies may require any capable actor, including a displaced catcher.
 * No role is a possession, arrival, catch, force out or teleportation. */
export const LIVE_FIELD_ROLE_POLICY_V1 = Object.freeze({ switchCostSeconds: .25,
  lateArrivalCost: 2, backupDepthMeters: 10, pickupBackupDepthMeters: 6, directThrowSeconds: .9,
  backupHomeAbandonmentCost: .1, secondaryResponsibilityCostSeconds: 1.5,
  otherResponsibilityCostSeconds: 5, catcherHomePriorityCostSeconds: 8, supportSeparationMeters: 4 });
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

/** Inspectable tactical cost. Holding always means this actor's own home;
 * backup additionally accounts for abandoning that home after an earlier
 * chase. Pursuit preference changes only this cost, never physical arrival. */
export function liveFieldRoleCostV1(actor: LiveFieldRoleActorV1,
  role: RoleTask, previous?: LiveFieldRoleV1) {
  const pursuit = actor.pursuitCostWeight ?? 1;
  if (!Number.isFinite(pursuit) || pursuit < .25 || pursuit > 4
    || actor.defensivePosition !== undefined && !defensivePositions.includes(actor.defensivePosition))
    throw new Error('invalid live field pursuit cost weight or defensive position');
  const point = role.intent === 'hold' ? actor.homePosition : role.point,
    taskId = role.intent === 'hold' ? 'hold:' + actor.playerId : role.taskId,
    arrivalSeconds = liveFieldArrivalSecondsV1(actor, point),
    weight = role.intent === 'base_cover' ? 4 : role.intent === 'relay' ? 1 : role.intent === 'backup' ? .25 : .1,
    homeAbandonmentSeconds = role.intent === 'backup' ? flatDistance(actor.homePosition, point) / actor.topSpeedMps : 0,
    movementCost = weight * arrivalSeconds * (role.intent === 'backup' ? pursuit : 1),
    homeAbandonmentCost = LIVE_FIELD_ROLE_POLICY_V1.backupHomeAbandonmentCost * homeAbandonmentSeconds * pursuit,
    responsibilityCost = !actor.defensivePosition || !role.responsiblePositions || role.responsiblePositions.includes(actor.defensivePosition) ? 0
      : actor.defensivePosition === 'C' ? LIVE_FIELD_ROLE_POLICY_V1.catcherHomePriorityCostSeconds
      : role.supportingPositions?.includes(actor.defensivePosition) ? LIVE_FIELD_ROLE_POLICY_V1.secondaryResponsibilityCostSeconds
      : LIVE_FIELD_ROLE_POLICY_V1.otherResponsibilityCostSeconds,
    lateCost = role.deadline === undefined ? 0 : LIVE_FIELD_ROLE_POLICY_V1.lateArrivalCost * Math.max(0, arrivalSeconds - role.deadline),
    switchCost = previous && previous.taskId !== taskId ? LIVE_FIELD_ROLE_POLICY_V1.switchCostSeconds : 0;
  return Object.freeze({ arrivalSeconds, homeAbandonmentSeconds, pursuitCostWeight: pursuit,
    movementCost, homeAbandonmentCost, responsibilityCost, lateCost, switchCost,
    total: movementCost + homeAbandonmentCost + responsibilityCost + lateCost + switchCost });
}

/** One actor per task, one task per actor. Bitmask dynamic programming is
 * O(n² 2^n), bounded to nine; it never searches permutations. Only threatened
 * bases are reserved, leaving actual throw/pickup backups and deep positions. */
export function assignLiveFieldRolesV1(raw: LiveFieldRoleInputV1): readonly LiveFieldRoleV1[] {
  const input = cloneInert(raw), actors = input.actors, ballPhase = input.ballPhase ?? 'free';
  if (actors.length !== 9 || new Set(actors.map(a => a.playerId)).size !== actors.length
    || actors.some(a => !a.playerId || !finite(a.position) || !finite(a.velocity) || !finite(a.homePosition)
      || ![a.topSpeedMps, a.accelerationMps2, a.throwSpeedMps].every(n => Number.isFinite(n) && n > 0)
      || !Number.isFinite(a.remainingReactionSeconds) || a.remainingReactionSeconds < 0
      || a.defensivePosition !== undefined && !defensivePositions.includes(a.defensivePosition)
      || !Number.isFinite(a.pursuitCostWeight ?? 1) || (a.pursuitCostWeight ?? 1) < .25 || (a.pursuitCostWeight ?? 1) > 4)
    || !finite(input.ballPosition) || !finite(input.ballVelocity) || !finite(input.pickupPoint)
    || !['free', 'held', 'throw'].includes(ballPhase) || ballPhase === 'throw' && !input.activeThrow
    || input.activeThrow !== undefined && (!finite(input.activeThrow.from) || !finite(input.activeThrow.target))
    || ![1, 2, 3, 4].every(n => finite(input.bases[n as BaseballBase]))) throw new Error('invalid live field role geometry/actors');
  const reservedIds = new Set<string>(), covered = new Set<BaseballBase>(), taskIds = new Set<string>();
  for (const role of input.reservations) {
    if (!actors.some(a => a.playerId === role.playerId) || reservedIds.has(role.playerId) || !role.taskId || taskIds.has(role.taskId)
      || !finite(role.point) || !['intercept', 'base_cover', 'relay', 'hold', 'tag'].includes(role.intent)
      || role.intent === 'relay' && role.targetBase !== null
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
  const available = actors.filter(a => !reservedIds.has(a.playerId)), tasks: RoleTask[] = [];
  const coverPositions: Record<BaseballBase, readonly LiveFieldDefensivePositionV1[]> = {
    1: ['1B'], 2: ['2B', 'SS'], 3: ['3B'], 4: ['C'] },
    coverSupport: Record<BaseballBase, readonly LiveFieldDefensivePositionV1[]> = {
      1: ['P', '2B'], 2: ['P', '3B'], 3: ['SS', 'P'], 4: ['P'] },
    backupPositions: Record<BaseballBase, readonly LiveFieldDefensivePositionV1[]> = {
      1: ['RF', 'P'], 2: ['CF', 'LF', 'RF'], 3: ['LF', 'P'], 4: ['P'] };
  const primary = input.reservations.find(r => r.intent === 'base_cover')?.targetBase
    ?? [...threats].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]?.[0] ?? null;
  for (const [base, deadline] of [...threats].sort((a, b) => a[1] - b[1] || a[0] - b[0])) if (!covered.has(base))
    tasks.push({ taskId: 'cover:' + base, point: input.bases[base], intent: 'base_cover', targetBase: base, deadline,
      responsiblePositions: coverPositions[base], supportingPositions: coverSupport[base] });
  const beyond = (from: Vec3, target: Vec3, depth: number, fallback: Vec3): Vec3 => {
    let dx = target.x - from.x, dz = target.z - from.z, length = Math.hypot(dx, dz);
    if (length === 0) { dx = fallback.x; dz = fallback.z; length = Math.hypot(dx, dz); }
    if (length === 0) return { ...target }; // no invented global direction
    return { x: target.x + dx / length * depth, y: target.y, z: target.z + dz / length * depth };
  };
  const separatedSupport = (point: Vec3) => [...input.reservations, ...tasks]
    .every(r => r.intent === 'hold' || flatDistance(point, r.point) >= LIVE_FIELD_ROLE_POLICY_V1.supportSeparationMeters);
  if ((primary !== null || input.activeThrow) && tasks.length < available.length) {
    const target = input.activeThrow?.target ?? input.bases[primary!], from = input.activeThrow?.from ?? input.ballPosition,
      length = flatDistance(from, target),
      strongest = Math.max(...actors.map(a => a.throwSpeedMps));
    const relayPoint = { x: (from.x + target.x) / 2, y: target.y, z: (from.z + target.z) / 2 };
    if (ballPhase !== 'throw' && !input.reservations.some(r => r.intent === 'relay')
      && length > strongest * LIVE_FIELD_ROLE_POLICY_V1.directThrowSeconds && tasks.length + 1 < available.length && separatedSupport(relayPoint))
      tasks.push({ taskId: 'relay:' + primary, point: relayPoint, intent: 'relay', targetBase: null,
        responsiblePositions: ['2B', 'SS'], supportingPositions: ['1B', '3B'] });
    // The issued hop supplies a stationary line. The ball passing its target
    // must not reverse the backup or create a new cutoff for this same throw.
    const backupPoint = beyond(from, target, LIVE_FIELD_ROLE_POLICY_V1.backupDepthMeters, input.activeThrow ? { x: 0, y: 0, z: 0 } : input.ballVelocity),
      receivingBase = ([1, 2, 3, 4] as const).find(base => flatDistance(target, input.bases[base]) < LIVE_FIELD_ROLE_POLICY_V1.supportSeparationMeters),
      offBaseResponsibility: readonly LiveFieldDefensivePositionV1[] = flatDistance(target, input.bases[4]) > flatDistance(input.bases[2], input.bases[4])
        ? ['LF', 'CF', 'RF'] : ['P', '1B', '2B', '3B', 'SS'];
    if (separatedSupport(backupPoint)) tasks.push({ taskId: 'throw-backup:' + (primary ?? 'active'), point: backupPoint,
      intent: 'backup', targetBase: null, responsiblePositions: input.activeThrow && receivingBase === undefined ? offBaseResponsibility
        : backupPositions[receivingBase ?? primary!],
      supportingPositions: ['P', 'LF', 'CF', 'RF'] });
  }
  const pickupBackup = beyond(input.ballPosition, input.pickupPoint, LIVE_FIELD_ROLE_POLICY_V1.pickupBackupDepthMeters, input.ballVelocity),
    deepPickup = flatDistance(input.pickupPoint, input.bases[4]) > flatDistance(input.bases[2], input.bases[4]),
    nearHomePickup = flatDistance(input.pickupPoint, input.bases[4]) < flatDistance(input.bases[1], input.bases[4]) / 2;
  if (ballPhase === 'free' && tasks.length < available.length && separatedSupport(pickupBackup)
    && flatDistance(input.ballPosition, input.pickupPoint) + Math.hypot(input.ballVelocity.x, input.ballVelocity.z) > 0)
    tasks.push({ taskId: 'pickup-backup', point: pickupBackup, intent: 'backup', targetBase: null,
      responsiblePositions: deepPickup ? ['LF', 'CF', 'RF'] : nearHomePickup ? ['C', 'P', '1B', '2B', '3B', 'SS'] : ['P', '1B', '2B', '3B', 'SS'],
      supportingPositions: ['LF', 'CF', 'RF'] });
  // Spare slots are evaluated at each candidate's own home. Preselecting homes
  // and assigning them as interchangeable destinations can send an outfielder
  // to the catcher's home while forcing an infielder to back up the outfield.
  while (tasks.length < available.length)
    tasks.push({ taskId: 'hold-slot:' + tasks.length, point: available[0].homePosition, intent: 'hold', targetBase: null });
  if (tasks.length !== available.length) throw new Error('live field tasks exceed available actors');
  const n = available.length, size = 1 << n, costs = new Float64Array(size).fill(Infinity), parents = new Int32Array(size).fill(-1);
  costs[0] = 0;
  for (let mask = 0; mask < size; mask++) {
    if (!Number.isFinite(costs[mask])) continue;
    let task = 0; for (let bits = mask; bits; bits &= bits - 1) task++;
    if (task === n) continue;
    for (let i = 0; i < n; i++) if (!(mask & (1 << i))) {
      const actor = available[i], slot = tasks[task], previous = input.previous.find(r => r.playerId === actor.playerId),
        cost = costs[mask] + liveFieldRoleCostV1(actor, slot, previous).total,
        next = mask | (1 << i);
      if (cost < costs[next]) { costs[next] = cost; parents[next] = i; }
    }
  }
  const result: LiveFieldRoleV1[] = [...input.reservations]; let mask = size - 1;
  for (let task = n - 1; task >= 0; task--) { const actor = parents[mask];
    if (actor < 0) throw new Error('live field role assignment is unresolved');
    const { deadline: _deadline, responsiblePositions: _responsible, supportingPositions: _supporting, ...role } = tasks[task], player = available[actor];
    result.push({ playerId: player.playerId, ...role, ...(role.intent === 'hold' ? { taskId: 'hold:' + player.playerId, point: player.homePosition } : {}) });
    mask ^= 1 << actor;
  }
  return freeze(actors.map(a => result.find(r => r.playerId === a.playerId)!));
}
