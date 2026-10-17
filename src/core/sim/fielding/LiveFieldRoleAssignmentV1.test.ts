import { expect, it } from 'vitest';
import { assignLiveFieldRolesV1, liveFieldArrivalSecondsV1, type LiveFieldRoleInputV1 } from './LiveFieldRoleAssignmentV1';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const fixture = (): LiveFieldRoleInputV1 => ({
  actors: [v(0, 1, 10), v(20, 1, 20), v(-1, 1, 39), v(20, 1, 38), v(-20, 1, 20), v(0, 1, -1), v(-40, 1, 70), v(0, 1, 80), v(40, 1, 70)]
    .map((position, i) => ({ playerId: 'p' + i, position, velocity: v(), homePosition: position,
      topSpeedMps: 7, accelerationMps2: 6, throwSpeedMps: 30, remainingReactionSeconds: 0 })),
  bases: { 1: v(20, 0, 20), 2: v(0, 0, 40), 3: v(-20, 0, 20), 4: v() },
  ballPosition: v(0, 0, 10), ballVelocity: v(0, 0, 5), pickupPoint: v(0, 0, 15),
  threats: [{ base: 1, arrivalSeconds: 4 }, { base: 2, arrivalSeconds: 5 }],
  reservations: [{ playerId: 'p0', taskId: 'handler', point: v(0, 0, 15), intent: 'intercept', targetBase: null },
    { playerId: 'p1', taskId: 'receiver:1', point: v(20, 0, 20), intent: 'base_cover', targetBase: 1 }], previous: [],
});
it('reserves the actual receiver exactly once, covers the other threat and preserves one role per actor', () => {
  const raw = fixture(), before = JSON.stringify(raw), roles = assignLiveFieldRolesV1(raw);
  expect(roles.filter(r => r.targetBase === 1)).toHaveLength(1);
  expect(roles.filter(r => r.targetBase === 2)).toHaveLength(1);
  expect(new Set(roles.map(r => r.playerId)).size).toBe(9);
  expect(new Set(roles.map(r => r.taskId)).size).toBe(9);
  expect(roles.find(r => r.playerId === 'p1')?.taskId).toBe('receiver:1');
  expect(roles.some(r => r.targetBase === 3 || r.targetBase === 4)).toBe(false);
  expect(roles.some(r => r.intent === 'hold')).toBe(true);
  expect(JSON.stringify(raw)).toBe(before); expect(Object.isFrozen(roles[0].point)).toBe(true);
});
it('refills the base vacated by a newly reserved receiver instead of overwriting its old coverage', () => {
  const initial = fixture(), old = assignLiveFieldRolesV1(initial), formerSecond = old.find(r => r.targetBase === 2)!;
  const next = assignLiveFieldRolesV1({ ...initial, previous: old, reservations: [initial.reservations[0],
    { ...initial.reservations[1], playerId: formerSecond.playerId }] });
  expect(next.filter(r => r.targetBase === 1)).toHaveLength(1);
  expect(next.filter(r => r.targetBase === 2)).toHaveLength(1);
  expect(next.find(r => r.targetBase === 2)!.playerId).not.toBe(formerSecond.playerId);
});
it('aligns relay and backup with the chosen throw destination, with backup beyond the receiver', () => {
  const raw = fixture(), roles = assignLiveFieldRolesV1({ ...raw, ballPosition: v(-40, 0, 80) }),
    relay = roles.find(r => r.intent === 'relay')!, backup = roles.find(r => r.taskId === 'throw-backup:1')!;
  expect(relay.point).toEqual(v(-10, 0, 50));
  const direction = v(60, 0, -60), relative = v(backup.point.x - 20, 0, backup.point.z - 20);
  expect(relative.x * direction.z - relative.z * direction.x).toBeCloseTo(0);
  expect(relative.x * direction.x + relative.z * direction.z).toBeGreaterThan(0);
});
it('uses movement direction and acceleration in arrival ranking instead of straight distance', () => {
  const a = fixture().actors[0], target = v(10, 1, 10);
  expect(liveFieldArrivalSecondsV1({ ...a, position: v(1, 1, 10), velocity: v(-7, 0, 0) }, target))
    .toBeGreaterThan(liveFieldArrivalSecondsV1({ ...a, velocity: v(7, 0, 0) }, target));
});
it('jointly allocates threatened bases instead of letting first-base greedy selection steal the only quick second-base cover', () => {
  const raw = fixture(), actors = raw.actors.map((p, i) => ({ ...p, position: i === 1 ? v(8, 1, 0) : i === 2 ? v(10, 1, 0) : v(1000 + i, 1, 1000),
    homePosition: i === 1 ? v(8, 1, 0) : i === 2 ? v(10, 1, 0) : v(1000 + i, 1, 1000) }));
  const roles = assignLiveFieldRolesV1({ ...raw, actors, reservations: [raw.reservations[0]],
    ballPosition: v(1000, 0, 1000), pickupPoint: v(1001, 0, 1001),
    bases: { ...raw.bases, 1: v(9, 0, 0), 2: v(0, 0, 0) }, threats: [{ base: 1, arrivalSeconds: 10 }, { base: 2, arrivalSeconds: 10 }] });
  expect(roles.find(r => r.targetBase === 1)?.playerId).toBe('p2');
  expect(roles.find(r => r.targetBase === 2)?.playerId).toBe('p1');
});
it('holds role continuity across small noisy geometry changes and still permits a material reassignment', () => {
  const raw = fixture(), a = assignLiveFieldRolesV1(raw), perturbed = { ...raw, previous: a,
    actors: raw.actors.map(p => ({ ...p, position: { ...p.position, x: p.position.x + .001 } })) }, b = assignLiveFieldRolesV1(perturbed);
  expect(b.map(r => [r.playerId, r.taskId])).toEqual(a.map(r => [r.playerId, r.taskId]));
  const formerSecond = a.find(r => r.targetBase === 2)!;
  const c = assignLiveFieldRolesV1({ ...raw, previous: a, actors: raw.actors.map(p => p.playerId === formerSecond.playerId
    ? { ...p, position: v(-100, 1, -100) } : p) });
  expect(c.find(r => r.targetBase === 2)!.playerId).not.toBe(formerSecond.playerId);
});
it('is invariant under renaming and mirrored geometry without position-name or league exceptions', () => {
  const raw = fixture(), a = assignLiveFieldRolesV1(raw), flip = (p: ReturnType<typeof v>) => ({ ...p, x: -p.x }),
    rename = (id: string) => 'other-' + id;
  const b = assignLiveFieldRolesV1({ ...raw,
    actors: raw.actors.map(p => ({ ...p, playerId: rename(p.playerId), position: flip(p.position), velocity: flip(p.velocity), homePosition: flip(p.homePosition) })),
    bases: { 1: flip(raw.bases[1]), 2: flip(raw.bases[2]), 3: flip(raw.bases[3]), 4: flip(raw.bases[4]) },
    ballPosition: flip(raw.ballPosition), ballVelocity: flip(raw.ballVelocity), pickupPoint: flip(raw.pickupPoint),
    reservations: raw.reservations.map(r => ({ ...r, playerId: rename(r.playerId), point: flip(r.point) })) });
  for (let i = 0; i < a.length; i++) {
    expect(b[i].intent).toBe(a[i].intent); expect(b[i].targetBase).toBe(a[i].targetBase);
    expect(b[i].point.x).toBeCloseTo(-a[i].point.x, 12);
    expect(b[i].point.y).toBeCloseTo(a[i].point.y, 12); expect(b[i].point.z).toBeCloseTo(a[i].point.z, 12);
  }
});
it('rejects duplicate reservations rather than silently assigning two actors to one base', () => {
  const raw = fixture();
  expect(() => assignLiveFieldRolesV1({ ...raw, reservations: [...raw.reservations,
    { ...raw.reservations[1], playerId: 'p2', taskId: 'duplicate' }] })).toThrow(/reservation/);
});
