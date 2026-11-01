import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { createSourceFreePoleSessionV148, type SourceFreePoleSessionInputV148 } from '../ball/SourceFreeBallWorldQuery';
import { respondToBallContact } from '../ball/BallContactResponse';
import { quantizeEventTick } from '../ExactEventTime';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const material = { restitution: .5, tangentialDamping: .25, spinDamping: .2 };
// Explicit authored collision fixtures, not real stadium calibration or a legal policy.
const equipment = (z = 9.5): SourceFreePoleSessionInputV148 => ({ version: 'source_free_pole_session_v148',
  poles: [{ surfaceId: 'synthetic-live-pole', center: { x: 0, z }, minimumHeight: 0, maximumHeight: 3, radiusM: .1 }],
  materials: [{ surfaceId: 'synthetic-live-pole', material }] });
const fixture = (poleEquipmentV148?: SourceFreePoleSessionInputV148): LiveFieldPlayInputV1 => {
  const tps = 1e6, originTick = 100000, elapsedSeconds = .123456789;
  return { ball: { originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, tps),
    position: v(0, 2, 8), velocity: v(0, 0, 30), spin: v(0, 12, -50) } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2, ...(poleEquipmentV148 ? { poleEquipmentV148 } : {}) },
    fielders: Array.from({ length: 9 }, (_, i) => ({ playerId: `fielder-${i}`, position: v(-24 + 6 * i, 1, 50),
      reactionSeconds: 1, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 32, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 2, maxPlaySeconds: .12 };
};

it('reflects the actual free ball at an explicit pole and preserves the original clock and material response', () => {
  const input = fixture(equipment()), before = JSON.stringify(input), result = simulateLiveFieldPlayV1(input);
  const descriptor = { kind: 'aero_ground_continuous_source_kernel_v2' as const, initial: input.ball,
    throughElapsedSeconds: input.ball.elapsedSeconds + input.maxPlaySeconds!, profile: input.physics };
  const observed = createSourceFreePoleSessionV148(input.field.poleEquipmentV148!).query({ descriptor,
    moment: input.ball, side: 'incoming', throughElapsedSeconds: descriptor.throughElapsedSeconds });
  if (observed.kind !== 'boundary' || observed.contacts[0]?.kind !== 'surface') throw Error('missing independent fixture pole contact');
  const contact = observed.contacts[0], outgoing = respondToBallContact({ ball: contact.moment.ball,
    normal: contact.normal!, surfaceVelocity: v(), material });
  expect(result.facts.filter(f => f.kind === 'pole_contact')).toEqual([{ kind: 'pole_contact', tick: contact.moment.ball.tick,
    elapsedSeconds: contact.moment.elapsedSeconds, position: contact.moment.ball.position, surfaceId: 'synthetic-live-pole' }]);
  expect(result.diagnostics.poleV148?.impulses).toHaveLength(1);
  expect(result.diagnostics.poleV148?.impulses[0].outgoingMoment.ball).toEqual(outgoing);
  expect(result.diagnostics.poleV148?.advances).toHaveLength(1);
  const expected = createSourceFreeBallKernel({ ...descriptor, initial: { ...contact.moment, ball: outgoing } });
  expect(result.frames.at(-1)!.ball.position).toEqual(expected.evaluateAt(result.end.elapsedSeconds).moment.ball.position);
  expect(result.ruleFacts.overFence).toBeNull(); expect(result.ruleFacts.territory).toBe('fair');
  expect(result.ruleFacts.pendingEquipmentPolicyV148).toEqual({ firstContactTick: contact.moment.ball.tick,
    surfaceIds: ['synthetic-live-pole'] });
  expect(JSON.stringify(input)).toBe(before);
});

it('does not turn a hypothetical pole behind an actual earlier moving actor into an impulse', () => {
  const input = fixture(equipment()), first = input.fielders[0];
  const result = simulateLiveFieldPlayV1({ ...input, fielders: [{ ...first, position: v(0, 1.9, 8.8), velocity: v(.1, 0, 0) }, ...input.fielders.slice(1)] });
  expect(result.facts.some(f => f.kind === 'glove_contact' || f.kind === 'body_contact')).toBe(true);
  expect(result.facts.filter(f => f.kind === 'pole_contact')).toEqual([]);
});

it('preserves all legacy results for omitted or explicitly empty pole scope', () => {
  const original = fixture(), empty = fixture({ version: 'source_free_pole_session_v148', poles: [], materials: [] });
  expect(simulateLiveFieldPlayV1(empty)).toEqual(simulateLiveFieldPlayV1(original));
});

it('validates even unused equipment material instead of silently ignoring it', () => {
  const invalid = { ...equipment(90), materials: [{ surfaceId: 'foreign-pole', material }] };
  expect(() => simulateLiveFieldPlayV1(fixture(invalid))).toThrow(/pole.*membership/);
});

it('rejects explicit null equipment at the raw Core boundary instead of treating it as omitted', () => {
  const raw = JSON.parse(JSON.stringify(fixture())); raw.field.poleEquipmentV148 = null;
  expect(() => simulateLiveFieldPlayV1(raw)).toThrow(/pole session scope/);
});

it('uses the same pole events at different presentation frame cadences', () => {
  const input = fixture(equipment()), a = simulateLiveFieldPlayV1(input), b = simulateLiveFieldPlayV1({ ...input, frameSeconds: .01 });
  expect(a.facts).toEqual(b.facts); expect(a.ruleFacts).toEqual(b.ruleFacts); expect(a.end).toEqual(b.end);
  expect(a.frames.length).not.toBe(b.frames.length);
});

it('does not ignore a second real pole after the first rebound', () => {
  const first = equipment(), second = { ...first.poles[0], surfaceId: 'second-pole', center: { x: 0, z: 6.5 } };
  const result = simulateLiveFieldPlayV1({ ...fixture({ ...first, poles: [...first.poles, second],
    materials: [...first.materials, { surfaceId: second.surfaceId, material }] }), maxPlaySeconds: .35 });
  expect(result.facts.filter(f => f.kind === 'pole_contact').map(f => f.surfaceId)).toEqual(['synthetic-live-pole', 'second-pole']);
  expect(result.diagnostics.poleV148?.impulses).toHaveLength(2);
  expect(result.diagnostics.poleV148?.advances).toHaveLength(2);
});

it('keeps the next ground event after a pole rebound in actual chronological order', () => {
  const original = fixture(equipment()), input = { ...original, ball: { ...original.ball,
    ball: { ...original.ball.ball, position: v(0, .3, 8), velocity: v(0, -2, 30) } }, maxPlaySeconds: .25 };
  const result = simulateLiveFieldPlayV1(input), physical = result.facts.filter(f => f.kind === 'pole_contact' || f.kind === 'ground_contact');
  expect(physical[0].kind).toBe('pole_contact'); expect(physical[1].kind).toBe('ground_contact');
  expect(physical[1].elapsedSeconds).toBeGreaterThan(physical[0].elapsedSeconds);
  expect(result.diagnostics.poleV148?.advances).toHaveLength(1);
});

it('preserves material phase across an actual seam-active pole impulse', () => {
  const original = fixture(equipment()), orientation = quaternionFromAxisAngle(v(1, 0, 0), .3),
    input = { ...original, orientation, physics: { ...original.physics, air: { ...original.physics.air,
      aerodynamics: { ...original.physics.air.aerodynamics, seamForce: { version: 'baseball_seam_force_v1' as const, coefficientScale: 1 } } } } };
  const result = simulateLiveFieldPlayV1(input);
  expect(result.diagnostics.poleV148?.impulses).toHaveLength(1);
  const impulse = result.diagnostics.poleV148!.impulses[0], throughElapsedSeconds = input.ball.elapsedSeconds + input.maxPlaySeconds!,
    descriptor = { kind: 'aero_ground_continuous_source_kernel_v2' as const, initial: input.ball,
      throughElapsedSeconds, profile: input.physics, materialOrientationAtStart: orientation },
    phase = createSourceFreeBallKernel(descriptor).evaluateAt(impulse.incomingMoment.elapsedSeconds, 'incoming').materialOrientation!,
    expected = createSourceFreeBallKernel({ ...descriptor, initial: impulse.outgoingMoment, materialOrientationAtStart: phase })
      .evaluateAt(result.end.elapsedSeconds);
  expect(result.frames.at(-1)!.ball.position).toEqual(expected.moment.ball.position);
  expect(result.frames.at(-1)!.ball.orientation).toEqual(expected.materialOrientation);
});

it('reports a zero-restitution pole support as unresolved rather than inventing outward escape', () => {
  const scope = equipment(), result = simulateLiveFieldPlayV1(fixture({ ...scope,
    materials: [{ surfaceId: scope.poles[0].surfaceId, material: { restitution: 0, tangentialDamping: 1, spinDamping: 1 } }] }));
  expect(result.end.complete).toBe(false); expect(result.diagnostics.unresolvedDetail).toMatchObject({ kind: 'pole_support_required_v148' });
  expect(result.diagnostics.poleV148?.impulses).toHaveLength(0);
});

it.each([0, .1, .13659, .1366])('keeps an initially overlapping or tangent pole unresolved without a fabricated departure (offset %s)', offset => {
  const result = simulateLiveFieldPlayV1(fixture(equipment(8 + offset)));
  expect(result.end.complete).toBe(false); expect(result.end.reason).toBe('numerical_contact_refinement_required');
  expect(result.diagnostics.poleV148?.impulses).toHaveLength(0);
  expect(result.facts.filter(f => f.kind === 'pole_contact')).toEqual([]);
});

it('does not force a pole response across an overlapping original ground-time bracket', () => {
  const original = fixture(), input = { ...original, maxPlaySeconds: .25, ball: { ...original.ball,
    ball: { ...original.ball.ball, position: v(0, .3, 8), velocity: v(0, -2, 30), spin: v() } } },
    descriptor = { kind: 'aero_ground_continuous_source_kernel_v2' as const, initial: input.ball,
      throughElapsedSeconds: input.ball.elapsedSeconds + input.maxPlaySeconds, profile: input.physics },
    kernel = createSourceFreeBallKernel(descriptor), ground = kernel.boundaries.find(b => b.kind === 'ground')!;
  expect(ground).toBeDefined();
  const atGround = kernel.evaluateAt(ground.elapsedSeconds, 'incoming').moment.ball.position,
    scope = equipment(atGround.z + .1 + input.physics.ground.radiusM - 5e-12),
    result = simulateLiveFieldPlayV1({ ...input, field: { ...input.field, poleEquipmentV148: scope } });
  expect(result.end.complete).toBe(false);
  expect(result.diagnostics.unresolvedDetail).toMatchObject({ kind: 'pole_contact_order_v148' });
  expect(result.diagnostics.poleV148?.impulses).toHaveLength(0);
});

it('does not choose a sole pole response when the actual body contact bracket overlaps it', () => {
  const input = fixture(equipment()), descriptor = { kind: 'aero_ground_continuous_source_kernel_v2' as const,
    initial: input.ball, throughElapsedSeconds: input.ball.elapsedSeconds + input.maxPlaySeconds!, profile: input.physics },
    pole = createSourceFreePoleSessionV148(input.field.poleEquipmentV148!).query({ descriptor,
      moment: input.ball, side: 'incoming', throughElapsedSeconds: descriptor.throughElapsedSeconds });
  if (pole.kind !== 'boundary') throw Error('missing independent pole boundary');
  const point = pole.moment.ball.position, actor = { ...input.fielders[0],
    position: v(point.x, point.y, point.z + .24 + input.physics.ground.radiusM) },
    result = simulateLiveFieldPlayV1({ ...input, fielders: [actor, ...input.fielders.slice(1)] });
  expect(result.end.complete).toBe(false);
  expect(result.diagnostics.unresolvedDetail).toMatchObject({ kind: 'pole_contact_order_v148' });
  expect(result.diagnostics.poleV148?.impulses).toHaveLength(0);
  expect(result.facts.filter(f => f.kind === 'pole_contact')).toEqual([]);
});
