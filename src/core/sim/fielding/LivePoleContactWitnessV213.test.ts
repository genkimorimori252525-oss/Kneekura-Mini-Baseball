import { expect, it } from 'vitest';
import { deriveLiveFieldFenceGeometryV1, simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { captureLivePoleContactWitnessV213, type LivePoleContactCaptureV213 } from './LivePoleContactWitnessV213';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createSourceFreePoleSessionV148 } from '../ball/SourceFreeBallWorldQuery';
import type { SourceFreeBallDescriptorV2 } from '../ball/SourceFreeBallKernel';
import { quantizeEventTick } from '../ExactEventTime';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const fixture = (): LiveFieldPlayInputV1 => {
  const originTick = 100000, elapsedSeconds = .123456789, ticksPerSecond = 1e6;
  return {
    ball: { originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, ticksPerSecond),
      position: v(0, 2, 8), velocity: v(0, 0, 30), spin: v(0, 12, -50) } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15,
      material: { restitution: .4, slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2, poleEquipmentV148: { version: 'source_free_pole_session_v148',
        poles: [{ surfaceId: 'capture-pole', center: { x: 0, z: 9.5 }, minimumHeight: 0, maximumHeight: 3, radiusM: .1 }],
        materials: [{ surfaceId: 'capture-pole', material: { restitution: .5, tangentialDamping: .25, spinDamping: .2 } }] } },
    fielders: Array.from({ length: 9 }, (_, index) => ({ playerId: 'fielder-' + index, position: v(-24 + 6 * index, 1, 50),
      reactionSeconds: 1, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 32, catchRetention: { ticksPerSecond, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 2, maxPlaySeconds: .12,
  };
};

it('captures the original executed pole contact as unadopted diagnostics without changing its fact', () => {
  const input = fixture(), before = structuredClone(input), result = simulateLiveFieldPlayV1(input), diagnostics = result.diagnostics.poleV148;
  expect(result.facts.filter(fact => fact.kind === 'pole_contact')).toHaveLength(1);
  expect(diagnostics?.contactWitnessesV213).toBeDefined();
  expect(diagnostics?.contactWitnessesV213).toHaveLength(1);
  const packet = diagnostics!.contactWitnessesV213![0], poleFactIndex = result.facts.findIndex(fact => fact.kind === 'pole_contact');
  expect(packet.contact.moment).toEqual(diagnostics!.impulses[0].incomingMoment);
  expect(result.facts[poleFactIndex]).toEqual({ kind: 'pole_contact', tick: packet.contact.moment.ball.tick,
    elapsedSeconds: packet.contact.moment.elapsedSeconds, position: packet.contact.moment.ball.position, surfaceId: packet.contact.surfaceId });
  expect(packet.clock).toEqual({ originTick: input.ball.originTick, ticksPerSecond: input.physics.air.ticksPerSecond });
  expect(packet.geometry).toEqual({ bases: input.field.bases, fence: deriveLiveFieldFenceGeometryV1(input.field), equipment: input.field.poleEquipmentV148 });
  expect(packet.sourceQuery.descriptor.initial).toEqual(input.ball);
  expect(packet.sourceQuery.moment.elapsedSeconds).toBeLessThan(packet.contact.moment.elapsedSeconds);
  expect(packet.sourceQuery.throughElapsedSeconds).toBeGreaterThanOrEqual(packet.contact.moment.elapsedSeconds);
  expect(packet.prefixBinding).toEqual({ playInitialMoment: input.ball, precedingFactCount: poleFactIndex,
    hasThrown: false, firstGroundContactSeconds: null, firstFielderTouchSeconds: null });
  expect(packet).not.toHaveProperty('territory'); expect(packet).not.toHaveProperty('homeRun'); expect(packet).not.toHaveProperty('adoptedPolicy');
  expect(result.ruleFacts.pendingEquipmentPolicyV148?.surfaceIds).toEqual(['capture-pole']);
  expect(input).toEqual(before);
});

const actualCapture = (location: 'side' | 'cap' | 'rim'): LivePoleContactCaptureV213 => {
  const input = fixture(), surfaceId = 'query-' + location, equipment = { version: 'source_free_pole_session_v148' as const,
    poles: [{ surfaceId, center: { x: location === 'side' ? 1 : 0, z: 0 }, minimumHeight: 0, maximumHeight: 3, radiusM: .1 }],
    materials: [{ surfaceId, material: { restitution: .5, tangentialDamping: .25, spinDamping: .2 } }] };
  const descriptor: SourceFreeBallDescriptorV2 = { kind: 'aero_ground_continuous_source_kernel_v2', throughElapsedSeconds: .1,
    initial: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: location === 'side' ? v(0, 1, 0) : v(location === 'rim' ? .12 : 0, 4, 0),
      velocity: location === 'side' ? v(30, 0, 0) : v(0, -30, 0), spin: v() } }, profile: input.physics };
  const sourceQuery = { descriptor, moment: descriptor.initial, side: 'outgoing' as const, throughElapsedSeconds: descriptor.throughElapsedSeconds },
    observed = createSourceFreePoleSessionV148(equipment).query(sourceQuery);
  if (observed.kind !== 'boundary' || observed.contacts.length !== 1 || observed.contacts[0].kind !== 'surface') throw Error('actual sole pole query required');
  return { clock: { originTick: 0, ticksPerSecond: input.physics.air.ticksPerSecond },
    geometry: { bases: input.field.bases, fence: deriveLiveFieldFenceGeometryV1(input.field), equipment }, sourceQuery,
    contact: observed.contacts[0], search: { authority: observed.authority, phase: observed.phase,
      numericalResolution: observed.numericalResolution, contactSearchWitnesses: observed.contactSearchWitnesses },
    prefixBinding: { playInitialMoment: descriptor.initial, precedingFactCount: 0, hasThrown: false,
      firstGroundContactSeconds: null, firstFielderTouchSeconds: null } };
};

it.each(['side', 'cap', 'rim'] as const)('retains the actual unrounded nonlinear %s moment, point and normal without a second query', location => {
  const raw = actualCapture(location), before = structuredClone(raw), packet = captureLivePoleContactWitnessV213(raw);
  expect(packet.contact).toEqual({ ...raw.contact, kind: 'pole' });
  expect(packet.sourceQuery).toEqual(raw.sourceQuery); expect(packet.search).toEqual(raw.search);
  expect(packet.contact.moment.elapsedSeconds * packet.clock.ticksPerSecond).not.toBe(packet.contact.moment.ball.tick);
  expect(packet.search.contactSearchWitnesses.every(witness => witness.witnessElapsedSeconds === packet.contact.moment.elapsedSeconds)).toBe(true);
  expect(packet).not.toHaveProperty('completePhysicalPrefix'); expect(packet).not.toHaveProperty('policy');
  expect(JSON.parse(JSON.stringify(packet))).toEqual(packet);
  expect(Object.isFrozen(packet.contact.moment.ball.position)).toBe(true); expect(Object.isFrozen(packet.sourceQuery.descriptor)).toBe(true);
  expect(packet.sourceQuery).not.toBe(raw.sourceQuery); expect(packet.geometry.equipment).not.toBe(raw.geometry.equipment);
  expect(Object.isFrozen(raw.geometry.equipment)).toBe(false); expect(raw).toEqual(before);
});

it('refuses a closure in a nested capture field instead of leaking executable state into a packet', () => {
  const raw = actualCapture('side'), invalid = { ...raw, sourceQuery: { ...raw.sourceQuery, kernel: { evaluateAt: () => raw.contact.moment } } };
  expect(() => captureLivePoleContactWitnessV213(invalid)).toThrow(/inert data/);
});

it('omits capture data for absent and empty equipment and preserves their entire legacy result', () => {
  const input = fixture(), { poleEquipmentV148: _equipment, ...field } = input.field;
  const absent = simulateLiveFieldPlayV1({ ...input, field }), empty = simulateLiveFieldPlayV1({ ...input,
    field: { ...field, poleEquipmentV148: { version: 'source_free_pole_session_v148', poles: [], materials: [] } } });
  expect(empty).toEqual(absent); expect(absent.diagnostics).not.toHaveProperty('poleV148');
});

it('does not capture a hypothetical later pole or a pole whose existing response is unresolved', () => {
  const input = fixture(), first = input.fielders[0], earlierActor = simulateLiveFieldPlayV1({ ...input,
    fielders: [{ ...first, position: v(0, 1.9, 8.8), velocity: v(.1, 0, 0) }, ...input.fielders.slice(1)] });
  expect(earlierActor.facts.some(fact => fact.kind === 'glove_contact' || fact.kind === 'body_contact')).toBe(true);
  expect(earlierActor.diagnostics.poleV148).not.toHaveProperty('contactWitnessesV213');
  const equipment = input.field.poleEquipmentV148!, unresolved = simulateLiveFieldPlayV1({ ...input,
    field: { ...input.field, poleEquipmentV148: { ...equipment, materials: [{ surfaceId: 'capture-pole',
      material: { restitution: 0, tangentialDamping: 1, spinDamping: 1 } }] } } });
  expect(unresolved.diagnostics.unresolvedDetail).toMatchObject({ kind: 'pole_support_required_v148' });
  expect(unresolved.diagnostics.poleV148).not.toHaveProperty('contactWitnessesV213');
});

it('binds each rebound to its own preceding Source and fact prefix without future contact inputs', () => {
  const input = fixture(), equipment = input.field.poleEquipmentV148!, second = { ...equipment.poles[0], surfaceId: 'second-pole', center: { x: 0, z: 6.5 } },
    result = simulateLiveFieldPlayV1({ ...input, maxPlaySeconds: .35, field: { ...input.field, poleEquipmentV148: { ...equipment,
      poles: [...equipment.poles, second], materials: [...equipment.materials, { surfaceId: second.surfaceId, material: equipment.materials[0].material }] } } });
  const diagnostics = result.diagnostics.poleV148!, packets = diagnostics.contactWitnessesV213!;
  expect(packets.map(packet => packet.contact.surfaceId)).toEqual(['capture-pole', 'second-pole']);
  expect(packets[1].sourceQuery.descriptor.initial).toEqual(diagnostics.impulses[0].outgoingMoment);
  for (const packet of packets) {
    expect(result.facts[packet.prefixBinding.precedingFactCount].surfaceId).toBe(packet.contact.surfaceId);
    expect(packet.search.contactSearchWitnesses.every(witness => witness.witnessElapsedSeconds <= packet.contact.moment.elapsedSeconds)).toBe(true);
    expect(packet).not.toHaveProperty('futureContacts');
  }
  expect(packets[0].prefixBinding.precedingFactCount).toBeLessThan(packets[1].prefixBinding.precedingFactCount);
});

it('preserves physics facts and the captured contact at a different presentation cadence', () => {
  const input = fixture(), first = simulateLiveFieldPlayV1(input), other = simulateLiveFieldPlayV1({ ...input, frameSeconds: .01 });
  expect(other.facts).toEqual(first.facts); expect(other.ruleFacts).toEqual(first.ruleFacts); expect(other.end).toEqual(first.end);
  expect(other.diagnostics.poleV148?.contactWitnessesV213).toEqual(first.diagnostics.poleV148?.contactWitnessesV213);
});
