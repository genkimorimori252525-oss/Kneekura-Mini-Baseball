import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BaseballBase } from '../../rules/PhysicalRuleFacts';
import { estimateLiveFieldArrivalV84 } from './LiveFieldArrivalV84';

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
export type LiveFieldRoleCostDiagnosticV118=Readonly<{playerId:string;task:RoleTask;cost:ReturnType<typeof liveFieldRoleCostV1>}>;
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
  return estimateLiveFieldArrivalV84(actor, target, radius);
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
export function assignLiveFieldRolesV1(raw: LiveFieldRoleInputV1,diagnostics?:LiveFieldRoleCostDiagnosticV118[]): readonly LiveFieldRoleV1[] {
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
  if(diagnostics)for(const actor of available)for(const task of tasks)
    diagnostics.push({playerId:actor.playerId,task,cost:liveFieldRoleCostV1(actor,task,input.previous.find(r=>r.playerId===actor.playerId))});
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

/** fieldCoverV1: who goes for the ball and who takes each bag, chosen together as one fielder sees it. No position owns a bag
 * or the ball. The choice keeps the batting side's expected runs lowest:
 *   P(somebody going fields the ball) x (runs saved by the best play the covers then allow),
 * the best play being an out at one bag or a double play, as the holder would choose it by run value. A play at a bag is a
 * race: the out comes when both the throw and the man covering are there, against the runner. The throw leaves from where the
 * likeliest man going takes the ball, after his exchange; a double play adds the pivot man's exchange and throw. So a man late
 * to second costs the double play, and a man still in the race for the ball costs the chance he would have added. Chances
 * come from forecast margins with the same race model the holder uses to pick an out. Ability moves all of it.
 * chancePool: at most this many of the best chances are tried as chasers, every subset of them.
 * coverChoices: for each bag only this many of the quickest free men are tried.
 * Ties go to the quicker covers, then to fewer chasers, then by id. Pure arithmetic, nothing is reserved here. */
export type LiveFieldCoverCandidateV1 = Readonly<{ playerId: string; ballChance: number;
  /** When he would have the ball (seconds from now) and where; null when he has no chance at it. The holder: 0 and where he is. */
  fieldSeconds: number | null; fieldPoint: Vec3 | null; exchangeSeconds: number; throwSpeedMps: number;
  baseSeconds: Readonly<Partial<Record<BaseballBase, number>>> }>;
export type LiveFieldCoverBagV1 = Readonly<{ base: BaseballBase; point: Vec3; runnerSeconds: number }>;
export function assignLiveFieldCoverV1(x: Readonly<{ holder: string | null; spreadSeconds: number; chancePool: number; coverChoices: number;
  candidates: readonly LiveFieldCoverCandidateV1[]; bags: readonly LiveFieldCoverBagV1[];
  /** Runs the batting side expects from here with outs made at these bags and every other runner making his bag. */
  runs: (outsAt: readonly BaseballBase[]) => number;
  win: (marginSeconds: number, spreadSeconds: number) => number }>) {
  if (!Number.isFinite(x.spreadSeconds) || x.spreadSeconds <= 0 || !Number.isInteger(x.chancePool) || x.chancePool < 0
    || !Number.isInteger(x.coverChoices) || x.coverChoices < 1
    || x.candidates.some(c => !c.playerId || !Number.isFinite(c.ballChance) || c.ballChance < 0 || c.ballChance > 1
      || !(c.exchangeSeconds >= 0) || !(c.throwSpeedMps > 0) || (c.fieldSeconds === null) !== (c.fieldPoint === null))
    || x.holder !== null && x.candidates.find(c => c.playerId === x.holder)?.fieldPoint == null
    || new Set(x.bags.map(b => b.base)).size !== x.bags.length
    || x.bags.some(b => ![1, 2, 3, 4].includes(b.base) || !finite(b.point) || !Number.isFinite(b.runnerSeconds)))
    throw new Error('invalid live field cover assignment');
  const rest = x.candidates.filter(c => c.playerId !== x.holder).slice().sort((p, q) => p.playerId.localeCompare(q.playerId)),
    holder = x.candidates.find(c => c.playerId === x.holder) ?? null,
    pool = holder ? [] : rest.filter(c => c.ballChance > 0 && c.fieldSeconds !== null)
      .sort((p, q) => q.ballChance - p.ballChance || p.playerId.localeCompare(q.playerId)).slice(0, x.chancePool),
    seconds = (c: LiveFieldCoverCandidateV1, b: LiveFieldCoverBagV1) => c.baseSeconds[b.base] ?? Infinity,
    none = x.runs([]), saved = new Map<string, number>(),
    savedBy = (outsAt: readonly BaseballBase[]) => { const k = outsAt.join(','); let v = saved.get(k); if (v === undefined) saved.set(k, v = none - x.runs(outsAt)); return v; };
  type Cover = Readonly<{ base: BaseballBase; playerId: string; seconds: number }>;
  // The runs the best play saves, once the ball is in hand at `from` after `readySeconds`, with these men on the bags.
  const gain = (origin: LiveFieldCoverCandidateV1, covers: readonly (LiveFieldCoverCandidateV1 | null)[]) => {
    const readySeconds = origin.fieldSeconds! + origin.exchangeSeconds, from = origin.fieldPoint!;
    const outAt = x.bags.map((b, i) => { const c = covers[i];
      return c ? Math.max(readySeconds + flatDistance(from, b.point) / origin.throwSpeedMps, seconds(c, b)) : null; });
    let best = 0;
    x.bags.forEach((b, i) => { const t = outAt[i]; if (t === null) return;
      best = Math.max(best, x.win(b.runnerSeconds - t, x.spreadSeconds) * savedBy([b.base]));
      x.bags.forEach((b2, j) => { const pivot = covers[i], last = covers[j]; if (j === i || !pivot || !last) return;
        const p1 = x.win(b.runnerSeconds - t, x.spreadSeconds),
          t2 = Math.max(t + pivot.exchangeSeconds + flatDistance(b.point, b2.point) / pivot.throwSpeedMps, seconds(last, b2)),
          p2 = x.win(b2.runnerSeconds - t2, x.spreadSeconds);
        best = Math.max(best, p1 * p2 * savedBy([b.base, b2.base]) + p1 * (1 - p2) * savedBy([b.base])); }); });
    return best;
  };
  type Choice = { chasers: string[]; chance: number; covers: Cover[]; gain: number; value: number; time: number };
  const chosen: { best: Choice | null } = { best: null };
  const consider = (cand: Choice) => {
    const best = chosen.best;
    if (!best) { chosen.best = cand; return; }
    const a = [cand.value, cand.gain, -cand.time, -cand.chasers.length], z = [best.value, best.gain, -best.time, -best.chasers.length],
      i = a.findIndex((v, k) => Math.abs(v - z[k]) > 1e-12);
    if (i >= 0 && a[i] > z[i]) chosen.best = cand;
  };
  for (let set = holder ? 0 : pool.length ? 1 : 0; set < 1 << pool.length; set++) {
    const chasers = pool.filter((_, i) => set & (1 << i)), chance = holder ? 1 : 1 - chasers.reduce((m, c) => m * (1 - c.ballChance), 1),
      origin = holder ?? chasers[0] ?? null, free = rest.filter(c => !chasers.includes(c)),
      options = x.bags.map(b => free.filter(c => Number.isFinite(seconds(c, b))).sort((p, q) => seconds(p, b) - seconds(q, b) || p.playerId.localeCompare(q.playerId)).slice(0, x.coverChoices));
    const walk = (i: number, taken: (LiveFieldCoverCandidateV1 | null)[]) => {
      if (i === x.bags.length) {
        const g = origin ? gain(origin, taken) : 0, covers = taken.flatMap((c, k) => c ? [{ base: x.bags[k].base, playerId: c.playerId, seconds: seconds(c, x.bags[k]) }] : []);
        consider({ chasers: chasers.map(c => c.playerId), chance, covers, gain: g, value: chance * g, time: covers.reduce((s, c) => s + c.seconds, 0) - 1e3 * covers.length });
        return;
      }
      let any = false;
      for (const c of options[i]) if (!taken.includes(c)) { any = true; walk(i + 1, [...taken, c]); }
      if (!any) walk(i + 1, [...taken, null]);
    };
    walk(0, []);
  }
  const b = chosen.best;
  return Object.freeze({ chasers: Object.freeze((b?.chasers ?? []).slice().sort()), ballChance: b?.chance ?? 0, runsSaved: b?.value ?? 0,
    cover: Object.freeze((b?.covers ?? []).slice().sort((p: Cover, q: Cover) => p.base - q.base)) });
}
