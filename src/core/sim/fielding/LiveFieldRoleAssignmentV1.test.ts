import { expect, it } from 'vitest';
import { assignLiveFieldRolesV1, liveFieldArrivalSecondsV1, liveFieldRoleCostV1, type LiveFieldRoleInputV1 } from './LiveFieldRoleAssignmentV1';
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
it('reserves an actual relay at its receive point while keeping the final base covered by another actor', () => {
  const raw = fixture(), receivePoint = v(-5, 1, 35), relay = { playerId: 'p1', taskId: 'relay:1',
    point: receivePoint, intent: 'relay' as const, targetBase: null },
    roles = assignLiveFieldRolesV1({ ...raw, ballPosition: v(-40, 0, 80), reservations: [raw.reservations[0], relay] });
  expect(roles.find(r => r.playerId === 'p1')).toEqual(relay);
  expect(roles.filter(r => r.intent === 'relay')).toHaveLength(1);
  expect(roles.filter(r => r.targetBase === 1)).toHaveLength(1);
  expect(roles.find(r => r.targetBase === 1)!.playerId).not.toBe('p1');
  expect(new Set(roles.map(r => r.taskId)).size).toBe(9);
  expect(() => assignLiveFieldRolesV1({ ...raw, reservations: [raw.reservations[0], { ...relay, targetBase: 1 }] })).toThrow(/reservation/);
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

it('uses nearby outfield pickup backup without exchanging spare players home positions', () => {
  const raw = fixture(), positions = [v(0, .9, 18.44), v(0, .85, -1.5), v(23, .9, 25), v(13, .9, 36),
    v(-23, .9, 25), v(-13, .9, 36), v(-46, .9, 76), v(0, .9, 91), v(46, .9, 76)],
    actors = raw.actors.map((a, i) => ({ ...a, position: positions[i], homePosition: positions[i], topSpeedMps: 8, accelerationMps2: 5.2 }));
  const roles = assignLiveFieldRolesV1({ ...raw, actors, ballPosition: v(0, .9, .3), ballVelocity: v(-8, 28, 16),
    pickupPoint: v(-35.818, .228, 55.235),
    reservations: [{ playerId: 'p4', taskId: 'handler', point: v(-35.818, .228, 55.235), intent: 'intercept', targetBase: null }] });
  expect(roles.find(r => r.taskId === 'pickup-backup')?.playerId).toBe('p6');
  for (const role of roles.filter(r => r.intent === 'hold')) {
    expect(role.point).toEqual(actors.find(a => a.playerId === role.playerId)!.homePosition);
    expect(role.taskId).toBe('hold:' + role.playerId);
  }
  expect(roles.filter(r => r.targetBase === 1)).toHaveLength(1);
  expect(roles.filter(r => r.targetBase === 2)).toHaveLength(1);
});

it('keeps an infielder available for a useful relay while spare actors hold their own homes', () => {
  const raw = fixture(), actors = raw.actors.map(a => a.playerId === 'p2' ? { ...a, position: v(-10, 1, 50), homePosition: v(-10, 1, 50) }
    : a.playerId === 'p3' ? { ...a, position: v(0, 1, 40), homePosition: v(0, 1, 40) } : a),
    roles = assignLiveFieldRolesV1({ ...raw, actors, ballPosition: v(-40, 1, 80), pickupPoint: v(-42, 0, 83),
    reservations: [{ playerId: 'p6', taskId: 'handler', point: v(-42, 0, 83), intent: 'intercept', targetBase: null }] });
  const relay = roles.find(r => r.intent === 'relay')!;
  expect(relay.playerId).toBe('p2');
  expect(roles.filter(r => r.intent === 'base_cover')).toHaveLength(2);
  for (const role of roles.filter(r => r.intent === 'hold'))
    expect(role.point).toEqual(actors.find(a => a.playerId === role.playerId)!.homePosition);
});

it('reports backup abandonment and lets pursuit preference change cost without changing physical arrival', () => {
  const actor = fixture().actors[0], role = { taskId: 'pickup-backup', point: v(-35, 0, 65), intent: 'backup' as const, targetBase: null },
    ordinary = liveFieldRoleCostV1(actor, role), cautious = liveFieldRoleCostV1({ ...actor, pursuitCostWeight: 2 }, role);
  expect(ordinary.homeAbandonmentSeconds).toBeGreaterThan(0);
  expect(cautious.arrivalSeconds).toBe(ordinary.arrivalSeconds);
  expect(cautious.total).toBe(ordinary.total * 2);
  const relay = { ...role, taskId: 'relay:1', intent: 'relay' as const };
  expect(liveFieldRoleCostV1({ ...actor, pursuitCostWeight: 2 }, relay)).toEqual({ ...liveFieldRoleCostV1(actor, relay), pursuitCostWeight: 2 });
  for (const pursuitCostWeight of [.24, 4.1, Infinity, NaN]) {
    expect(() => liveFieldRoleCostV1({ ...actor, pursuitCostWeight }, role)).toThrow();
    expect(() => assignLiveFieldRolesV1({ ...fixture(), actors: fixture().actors.map(a => ({ ...a, pursuitCostWeight })) })).toThrow();
  }
});

it('does not create a pickup backup for a secured ball that no longer needs pickup', () => {
  const raw = fixture(), roles = assignLiveFieldRolesV1({ ...raw, ballPhase: 'held' });
  expect(roles.some(r => r.taskId === 'pickup-backup')).toBe(false);
  expect(roles.filter(r => r.intent === 'hold').length).toBeGreaterThanOrEqual(4);
});

it('backs up the actual issued throw line without chasing the moving ball or creating a fresh cutoff', () => {
  const raw = fixture(), activeThrow = { from: v(-40, 1, 80), target: v(20, 1, 20) },
    atRelease = assignLiveFieldRolesV1({ ...raw, ballPhase: 'throw', activeThrow, ballPosition: activeThrow.from }),
    afterTarget = assignLiveFieldRolesV1({ ...raw, ballPhase: 'throw', activeThrow,
      ballPosition: v(22, .8, 18), ballVelocity: v(30, -1, -30), previous: atRelease }),
    backup = atRelease.find(r => r.taskId === 'throw-backup:1')!;
  expect(atRelease.some(r => r.intent === 'relay' || r.taskId === 'pickup-backup')).toBe(false);
  expect(afterTarget.find(r => r.taskId === 'throw-backup:1')?.point).toEqual(backup.point);
  expect((backup.point.x - activeThrow.target.x) * 60 + (backup.point.z - activeThrow.target.z) * -60).toBeGreaterThan(0);
});

it('backs up an off-base relay receipt at the issued hop rather than a different final base', () => {
  const raw = fixture(), activeThrow = { from: v(-45, 1, 80), target: v(-15, 1, 48) },
    roles = assignLiveFieldRolesV1({ ...raw, ballPhase: 'throw', activeThrow,
      reservations: [raw.reservations[0], { playerId: 'p2', taskId: 'relay:1',
        intent: 'relay', targetBase: null, point: activeThrow.target }] }),
    backup = roles.find(r => r.taskId === 'throw-backup:1')!;
  const direction = v(30, 0, -32), offset = v(backup.point.x + 15, 0, backup.point.z - 48);
  expect(offset.x * direction.z - offset.z * direction.x).toBeCloseTo(0, 10);
  expect(Math.hypot(offset.x, offset.z)).toBeCloseTo(10);
});

it('keeps the catcher at home when an available middle infielder can perform a useful cutoff', () => {
  const raw = fixture(), positions = ['P', '1B', '2B', 'SS', '3B', 'C', 'LF', 'CF', 'RF'] as const,
    actors = raw.actors.map((actor, i) => ({ ...actor, defensivePosition: positions[i],
      position: i === 5 ? v(-10, 1, 50) : i === 3 ? v(-7, 1, 48) : actor.position })),
    roles = assignLiveFieldRolesV1({ ...raw, actors, ballPosition: v(-40, 1, 80), ballPhase: 'held',
      reservations: [{ playerId: 'p6', taskId: 'holder', point: v(-40, 1, 80), intent: 'hold', targetBase: null }],
      threats: [{ base: 1, arrivalSeconds: 9 }] });
  expect(roles.find(r => r.intent === 'relay')?.playerId).toBe('p3');
  expect(roles.find(r => r.playerId === 'p5')).toMatchObject({ intent: 'hold', point: actors[5].homePosition });
});

it('uses first-base responsibility while retaining finite emergency coverage by any capable defender', () => {
  const raw = fixture(), positions = ['P', '1B', '2B', 'SS', '3B', 'C', 'LF', 'CF', 'RF'] as const,
    actors = raw.actors.map((actor, i) => ({ ...actor, defensivePosition: positions[i],
      position: i === 1 ? v(18, 1, 18) : i === 5 ? v(20, 1, 20) : actor.position })),
    input = { ...raw, actors, ballPhase: 'held' as const, threats: [{ base: 1 as const, arrivalSeconds: 4 }],
      reservations: [raw.reservations[0]] }, roles = assignLiveFieldRolesV1(input);
  expect(roles.find(r => r.targetBase === 1)?.playerId).toBe('p1');
  const emergency = assignLiveFieldRolesV1({ ...input, actors: actors.map(a => a.playerId === 'p5' ? a
    : { ...a, position: v(1000, 1, 1000), homePosition: v(1000, 1, 1000) }) });
  expect(emergency.find(r => r.targetBase === 1)?.playerId).toBe('p5');
});

it('rejects invalid phase, position and missing physical issued-throw geometry', () => {
  const raw = fixture();
  expect(() => assignLiveFieldRolesV1({ ...raw, ballPhase: 'teleported' as never })).toThrow();
  expect(() => assignLiveFieldRolesV1({ ...raw, ballPhase: 'throw' })).toThrow();
  expect(() => assignLiveFieldRolesV1({ ...raw, ballPhase: 'throw', activeThrow: { from: v(), target: v(NaN) } })).toThrow();
  expect(() => assignLiveFieldRolesV1({ ...raw, actors: raw.actors.map(a => ({ ...a, defensivePosition: 'X' as never })) })).toThrow();
});

it('does not send two support jobs to the same patch of ground while preserving actual receiver reservations', () => {
  const raw = fixture(), roles = assignLiveFieldRolesV1({ ...raw, ballPosition: v(), ballVelocity: v(8, 0, 8), pickupPoint: v(23, 0, 23),
    reservations: [{ ...raw.reservations[0], point: v(23, 0, 23) }, raw.reservations[1]] }),
    backup = roles.find(r => r.taskId === 'throw-backup:1')!;
  expect(roles.some(r => r.taskId === 'pickup-backup')).toBe(false);
  expect(roles.filter(r => r.intent !== 'hold' && r.intent !== 'intercept'
    && Math.hypot(r.point.x - backup.point.x, r.point.z - backup.point.z) < 4)).toHaveLength(1);
  expect(roles.find(r => r.playerId === 'p1')).toEqual(raw.reservations[1]);
});

it('retains the actual positional response to individual movement ability instead of enforcing a hard position assignment', () => {
  const raw = fixture(), roles = assignLiveFieldRolesV1({ ...raw, ballPhase: 'held', threats: [{ base: 1, arrivalSeconds: 4 }],
    reservations: [raw.reservations[0]], actors: raw.actors.map((a, i) => ({ ...a,
      defensivePosition: i === 1 ? '1B' : i === 5 ? 'C' : 'CF',
      position: i === 1 ? v(18, 1, 18) : i === 5 ? v(20, 1, 20) : v(200, 1, 200),
      topSpeedMps: i === 1 ? .2 : a.topSpeedMps, accelerationMps2: i === 1 ? .1 : a.accelerationMps2 })) });
  expect(roles.find(r => r.targetBase === 1)?.playerId).toBe('p5');
});
