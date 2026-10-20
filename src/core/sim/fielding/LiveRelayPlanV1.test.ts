import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { planLiveRelayV1, type LiveRelayActorV1, type LiveRelayPlanInputV1 } from './LiveRelayPlanV1';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const actor = (playerId: string, z: number, throwSpeedMps = 34): LiveRelayActorV1 => ({ playerId,
  position: v(0, 1, z), velocity: v(), homePosition: v(0, 1, z), glovePosition: v(0, 1.3, z), gloveVelocity: v(),
  topSpeedMps: 7, accelerationMps2: 6, throwSpeedMps, remainingReactionSeconds: 0,
  gloveSpeedMps: 11, gloveReachMeters: 1.35, gloveRadiusMeters: .1, transferSeconds: .25, throwBackspinRadPerSecond: 120 });
const input = (distance = 20): LiveRelayPlanInputV1 => ({ actors: [actor('holder', 0), actor('receiver', distance)],
  holderPlayerId: 'holder', receiverPlayerId: 'receiver', finalBase: 4, runnerId: 'runner', target: v(0, 1, distance),
  runnerArrivalSeconds: 20, holderTransferRemainingSeconds: 0, throwHandOffset: { forwardMeters: .5, heightAboveHipMeters: .7 },
  physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1e6, integrationStepTicks: 5000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1e6, gravityMps2: 9.81,
    radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .2,
    material: { restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .36, normalSpinDecayPerSecond: .18 } } } });

it('prefers a feasible direct throw over an unnecessary relay and preserves immutable current-state input', () => {
  const raw = { ...input(), actors: [...input().actors, actor('spare', 10)] }, before = JSON.stringify(raw), result = planLiveRelayV1(raw);
  expect(result.kind).toBe('direct'); expect(result.legs).toHaveLength(1); expect(result.firstHop?.receiverPlayerId).toBe('receiver');
  expect(result.firstHop?.intent).toBe('base_cover'); expect(result.firstHop?.target).toEqual(raw.target);
  expect(result.diagnostics.aerodynamicSolveCount).toBe(1);
  expect(result.diagnostics).toMatchObject({ actualSourceRead: false, actualCatchGuaranteed: false, replanAfterReceiptRequired: true });
  expect(JSON.stringify(raw)).toBe(before); expect(Object.isFrozen(result.firstHop?.target)).toBe(true);
});

it('routes a weak outfield arm through a stronger actual receiver when the direct Aero command is unreachable', () => {
  const raw = { ...input(90), actors: [actor('holder', 0, 16), actor('cutoff', 20, 38), actor('receiver', 90)] }, result = planLiveRelayV1(raw);
  expect(result.diagnostics.directReachable).toBe(false); expect(result.kind).toBe('relay'); expect(result.legs).toHaveLength(2);
  expect(result.firstHop).toEqual({ receiverPlayerId: 'cutoff', target: v(0, 1.3, 20), receiverPoint: v(0, 1, 20), intent: 'relay' });
  expect(result.legs[1].transferSeconds).toBe(.25); expect(result.readySeconds).toBeLessThan(result.carrySeconds);
  for (const leg of result.legs) {
    const body = raw.actors.find(a => a.playerId === leg.throwerPlayerId)!, predicted = createSourceFreeBallKernel({
      kind: 'aero_ground_continuous_source_kernel_v2', initial: { originTick: 0, elapsedSeconds: 0,
        ball: { tick: 0, position: leg.releasePosition, velocity: leg.initialVelocity, spin: leg.spin } },
      throughElapsedSeconds: leg.flightSeconds, profile: raw.physics }), arrival = predicted.evaluateAt(leg.flightSeconds, 'incoming').moment.ball.position;
    expect(Math.hypot(arrival.x - leg.target.x, arrival.y - leg.target.y, arrival.z - leg.target.z)).toBeLessThanOrEqual(.02);
    expect(Math.hypot(leg.initialVelocity.x - leg.bodyVelocity.x, leg.initialVelocity.y - leg.bodyVelocity.y,
      leg.initialVelocity.z - leg.bodyVelocity.z)).toBeLessThanOrEqual(body.throwSpeedMps);
    expect(predicted.boundaries.some(b => b.kind === 'ground' && b.elapsedSeconds < leg.flightSeconds)).toBe(false);
  }
});

it('supports two actual intermediate receivers without duplicate actors or throw cycles', () => {
  const raw = { ...input(66), actors: [actor('holder', 0, 16), actor('one', 22, 16), actor('two', 44, 16), actor('receiver', 66)],
    maximumIntermediateReceivers: 2 as const }, result = planLiveRelayV1(raw);
  expect(result.kind).toBe('relay'); expect(result.legs.map(leg => leg.receiverPlayerId)).toEqual(['one', 'two', 'receiver']);
  expect(new Set([raw.holderPlayerId, ...result.legs.map(leg => leg.receiverPlayerId)]).size).toBe(4);
  expect(result.legs[1].readySeconds).toBeGreaterThan(result.legs[0].readySeconds + raw.actors[1].transferSeconds);
  expect(planLiveRelayV1({ ...raw, maximumIntermediateReceivers: 1 }).kind).toBe('carry');
  expect(planLiveRelayV1({ ...raw, excludedRelayPlayerIds: ['one'] }).kind).toBe('carry');
});

it('carries predicted seam phase through relay hypotheses while requiring a new plan after actual receipt', () => {
  const base=input(90),phase={w:Math.cos(.3),x:0,y:0,z:Math.sin(.3)},raw={...base,
    actors:[actor('holder',0,16),actor('cutoff',20,38),actor('receiver',90)].map(a=>({...a,throwSpinRadPerSecond:v(8,2,3)})),
    materialOrientationAtRelease:phase,physics:{...base.physics,air:{...base.physics.air,aerodynamics:{...base.physics.air.aerodynamics,
      seamForce:{version:'baseball_seam_force_v1' as const,coefficientScale:1}}}}},before=JSON.stringify(raw),result=planLiveRelayV1(raw);
  expect(result.kind).toBe('relay');expect(result.legs).toHaveLength(2);expect(result.diagnostics.replanAfterReceiptRequired).toBe(true);
  let material=phase;
  for(const leg of result.legs){
    const predicted=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:0,elapsedSeconds:0,
      ball:{tick:0,position:leg.releasePosition,velocity:leg.initialVelocity,spin:leg.spin}},throughElapsedSeconds:leg.flightSeconds,
      profile:raw.physics,materialOrientationAtStart:material}),arrival=predicted.evaluateAt(leg.flightSeconds,'incoming');
    expect(Math.hypot(arrival.moment.ball.position.x-leg.target.x,arrival.moment.ball.position.y-leg.target.y,
      arrival.moment.ball.position.z-leg.target.z)).toBeLessThanOrEqual(.02);
    expect(arrival.materialOrientation).toBeDefined();material=arrival.materialOrientation!;
  }
  expect(material).not.toEqual(phase);expect(JSON.stringify(raw)).toBe(before);
});

it('aims a moving relay at its braking point while retaining measured glove offset and arrival delay', () => {
  const raw = { ...input(90), actors: [actor('holder', 0, 16), { ...actor('cutoff', 20, 38),
    velocity: v(2, 0, 0), gloveVelocity: v(2, 0, 0) }, actor('receiver', 90)] }, result = planLiveRelayV1(raw);
  expect(result.kind).toBe('relay'); expect(result.firstHop?.receiverPoint.x).toBeCloseTo(1 / 3);
  expect(result.firstHop?.target.x).toBeCloseTo(1 / 3); expect(result.firstHop?.target.y).toBe(1.3);
  expect(result.legs[0].receiverArrivalSeconds).toBeGreaterThanOrEqual(2 / 6);
});

it('includes current movement, remaining transfer, receiver arrival and hand preparation in the control-time estimate', () => {
  const original = input(20), raw = { ...original, actors: original.actors.map(a => a.playerId === 'holder' ? { ...a, topSpeedMps: 3 } : a) },
    direct = planLiveRelayV1(raw), delayed = planLiveRelayV1({ ...raw, holderTransferRemainingSeconds: .8 }),
    unready = planLiveRelayV1({ ...raw, actors: raw.actors.map(a => a.playerId === 'receiver' ? { ...a, position: v(10, 1, 20),
      glovePosition: v(10, 1.3, 20), velocity: v(7, 0, 0) } : a) });
  expect(delayed.readySeconds - direct.readySeconds).toBeCloseTo(.8, 10); expect(direct.legs[0].preparationSeconds).toBeGreaterThan(0);
  expect(unready.legs[0].receiverArrivalSeconds).toBeGreaterThan(direct.readySeconds);
  expect(unready.legs[0].waitingSeconds).toBeGreaterThan(0); expect(unready.readySeconds).toBeGreaterThan(direct.readySeconds);
  const moving = planLiveRelayV1({ ...raw, actors: raw.actors.map(a => a.playerId === 'holder' ? { ...a, velocity: v(0, 0, 3), gloveVelocity: v(0, 0, 3) } : a) });
  expect(moving.legs[0].bodyVelocity).toEqual(v(0, 0, 3));
});

it('chooses carry near a base and retains control when every estimate misses the runner deadline', () => {
  const near = planLiveRelayV1(input(.29)), late = planLiveRelayV1({ ...input(40), runnerArrivalSeconds: .01 });
  expect(near.kind).toBe('carry'); expect(near.firstHop).toBeNull(); expect(late.kind).toBe('hold');
  expect(late.firstHop).toBeNull(); expect(late.marginSeconds).toBeLessThan(0);
  const ordinary = planLiveRelayV1(input()), margin = planLiveRelayV1({ ...input(), minimumMarginSeconds: 20 });
  expect(ordinary.kind).toBe('direct'); expect(margin.kind).toBe('hold');
});

it('accounts for existing direction-error ability without inventing catch success or public abilities', () => {
  const ordinary = planLiveRelayV1(input(50)), uncertain = planLiveRelayV1({ ...input(50),
    actors: input(50).actors.map(a => a.playerId === 'holder' ? { ...a, throwDirectionStdRadians: .08 } : a) });
  expect(uncertain.legs[0].directionRecoveryCostSeconds).toBeGreaterThan(0);
  expect(uncertain.costSeconds).toBeGreaterThan(ordinary.costSeconds); expect(uncertain.readySeconds).toBe(ordinary.readySeconds);
});

it('bounds search work and caches Aero edges while using no position names or future world state', () => {
  const raw = { ...input(90), actors: [actor('holder', 0, 18), actor('receiver', 90), ...[12, 24, 36, 48, 60, 72, 84].map((z, i) => actor('p' + i, z))] },
    before = JSON.stringify(raw), result = planLiveRelayV1(raw), rename = (id: string) => 'renamed-' + id,
    renamed = planLiveRelayV1({ ...raw, holderPlayerId: rename(raw.holderPlayerId), receiverPlayerId: rename(raw.receiverPlayerId),
      actors: raw.actors.map(a => ({ ...a, playerId: rename(a.playerId) })) });
  expect(result.diagnostics.evaluatedRouteCount).toBeLessThanOrEqual(8); expect(result.diagnostics.aerodynamicSolveCount).toBeLessThanOrEqual(22);
  expect(result.diagnostics.aerodynamicCacheHits).toBeGreaterThanOrEqual(0);
  expect(renamed.kind).toBe(result.kind); expect(renamed.readySeconds).toBe(result.readySeconds);
  expect(renamed.legs.map(leg => leg.receiverPlayerId)).toEqual(result.legs.map(leg => rename(leg.receiverPlayerId)));
  expect(JSON.stringify(raw)).toBe(before);
  expect(() => planLiveRelayV1({ ...raw, futureActualSource: {} } as unknown as LiveRelayPlanInputV1)).toThrow(/invalid live relay/);
  expect(() => planLiveRelayV1({ ...raw, maximumIntermediateReceivers: 3 } as unknown as LiveRelayPlanInputV1)).toThrow(/invalid live relay/);
  expect(() => planLiveRelayV1({ ...raw, actors: [raw.actors[0], raw.actors[0]] })).toThrow(/invalid live relay/);
});
