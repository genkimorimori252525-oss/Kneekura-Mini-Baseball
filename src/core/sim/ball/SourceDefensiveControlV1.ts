import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec2 } from '../../model/geometry';
import { buildDefenderMotionTrajectory, type DefenderMotionParameters } from '../fielding/DefenderMotion';
import type { BattedWorldFieldMotionAdoptionInput } from './BattedWorldFieldMotion';
import { createSourceBattedFieldMotorSessionV1, type SourceBattedFieldMotorActionV1 } from './SourceBattedFieldMotorMotionV1';

/** Targets and review deadlines come from perception/decision, never the free
 * ball's future trajectory. Native must authenticate their original Sources.
 * bodyOffset is the model's horizontal body-primitive offset from its root. */
export type SourceDefensiveControlPlanV1 = Readonly<{
  playerId: string; decisionSourceId: string; availableAtTick: number;
  movementStartTick: number; reviewAtTick: number; bodyOffset: Vec2;
  waypoints: readonly Vec2[] | null; parameters: DefenderMotionParameters;
}>;
const keys = (value: object, expected: readonly string[]) => Object.keys(value).sort().join('|') === [...expected].sort().join('|');
const tick = (value: number) => Number.isSafeInteger(value) && value >= 0;
const vector = (value: Vec2) => value && keys(value, ['x', 'z']) && Number.isFinite(value.x) && Number.isFinite(value.z);
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** A live, bounded-work controller over the original continuous Source ball.
 * Numerical control ticks do not cause new observations or decisions. Each
 * advance stops at a real contact or the earliest declared review deadline.
 * The caller may resume after a bounce with the private witness still alive;
 * a glove candidate remains terminal until the acquisition consumer takes over.
 * This is execution, not Native admission, AI selection, custody or adjudication. */
export const createSourceDefensiveControlV1 = (raw: Readonly<{
  initial: BattedWorldFieldMotionAdoptionInput; priorActions: readonly SourceBattedFieldMotorActionV1[];
  plans: readonly SourceDefensiveControlPlanV1[];
}>) => {
  const input = cloneInert(raw);
  if (!keys(input, ['initial', 'priorActions', 'plans']) || !Array.isArray(input.priorActions) || input.priorActions.length > 256)
    throw new Error('invalid Source defensive control input');
  const motor = createSourceBattedFieldMotorSessionV1(input.initial), origin = motor.read().motion.world.moment.originTick;
  // Reconstruct the real earlier cut. A serialized moving cursor, actor frame
  // or escape certificate is never substituted for the original prefix.
  for (const action of input.priorActions) motor.apply(action);
  const ticksPerSecond = input.initial.response.world.parameters.ticksPerSecond;
  const coverage = Math.min(input.initial.coverageThroughTick, ...motor.read().motion.actors.map(a => a.primitive.endTick));
  const secondsAt = (at: number) => (at - origin) / ticksPerSecond;
  const exactTick = () => {
    const at = motor.read().motion.world.moment;
    if (at.elapsedSeconds !== secondsAt(at.ball.tick)) throw new Error('Source defensive control requires an exact integer boundary');
    return at.ball.tick;
  };
  type Control = { plan: SourceDefensiveControlPlanV1; nextTick: number; waypoint: number };
  const createControls = (rawPlans: readonly SourceDefensiveControlPlanV1[], now: number): Control[] => {
    const plans = cloneInert(rawPlans), actors = motor.read().motion.actors;
    if (!Array.isArray(plans) || plans.length !== 9 || new Set(plans.map(p => p.playerId)).size !== 9)
      throw new Error('Source defensive control requires nine distinct plans');
    return plans.map(plan => {
      const p = plan.parameters, own = actors.filter(a => a.playerId === plan.playerId), body = own.find(a => a.primitive.role === 'body');
      if (!keys(plan, ['playerId', 'decisionSourceId', 'availableAtTick', 'movementStartTick', 'reviewAtTick', 'bodyOffset', 'waypoints', 'parameters'])
        || typeof plan.playerId !== 'string' || !plan.playerId.trim() || typeof plan.decisionSourceId !== 'string' || !plan.decisionSourceId.trim()
        || !tick(plan.availableAtTick) || plan.availableAtTick > now || !tick(plan.movementStartTick) || plan.movementStartTick < plan.availableAtTick
        || !tick(plan.reviewAtTick) || plan.reviewAtTick <= now || !vector(plan.bodyOffset)
        || !p || !keys(p, ['ticksPerSecond', 'maxIntegrationStepTicks', 'accelerationMps2', 'brakingMps2', 'topSpeedMps', 'arrivalRadiusMeters'])
        || p.ticksPerSecond !== ticksPerSecond || !body || own.length !== 5 || new Set(own.map(a => a.primitive.role)).size !== 5
        || plan.waypoints !== null && (!Array.isArray(plan.waypoints) || plan.waypoints.length < 1 || plan.waypoints.length > 16 || !plan.waypoints.every(vector)))
        throw new Error('invalid Source defensive control plan or body coverage');
      // Reuse Core's parameter validation, including for holds and future starts.
      buildDefenderMotionTrajectory({ tick: now, position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }, null, 0, p);
      if (own.some(a => a.primitive.startVelocity.y !== 0 || a.primitive.acceleration.y !== 0
        || a.startElapsedSeconds !== body.startElapsedSeconds || a.primitive.startTick !== body.primitive.startTick
        || (['x', 'y', 'z'] as const).some(axis => a.primitive.acceleration[axis] !== body.primitive.acceleration[axis]
          || a.primitive.startVelocity[axis] !== body.primitive.startVelocity[axis]))) {
        throw new Error('Source defensive control requires a retained rigid pose');
      }
      return { plan, nextTick: now, waypoint: 0 };
    });
  };
  let controls = createControls(input.plans, exactTick());
  const reviewTick = () => Math.min(...controls.map(c => c.plan.reviewAtTick));
  const view = () => freeze({ authority: 'SOURCE_DEFENSIVE_CONTROL_V1' as const, nativeAdmission: false as const, official: null,
    field: motor.read(), controls: controls.map(c => ({ playerId: c.plan.playerId, decisionSourceId: c.plan.decisionSourceId,
      nextControlTick: c.nextTick, waypointIndex: c.waypoint })), reviewAtTick: reviewTick() });
  let failed = false;
  const healthy = () => { if (failed) throw new Error('Source defensive control session failed'); };
  const adoptDue = () => {
    const field = motor.read(), at = field.motion.world.moment, due = controls.filter(c => secondsAt(c.nextTick) === at.elapsedSeconds);
    if (!due.length) return;
    const now = exactTick();
    const bodyCommands = new Map(due.map(c => {
      const a = field.motion.actors.find(a => a.playerId === c.plan.playerId && a.primitive.role === 'body')!, b = a.primitive;
      const dt = secondsAt(now) + (origin - b.startTick) / ticksPerSecond - (a.startElapsedSeconds ?? 0);
      const position = { x: b.startCenter.x + b.startVelocity.x * dt + .5 * b.acceleration.x * dt * dt - c.plan.bodyOffset.x,
        z: b.startCenter.z + b.startVelocity.z * dt + .5 * b.acceleration.z * dt * dt - c.plan.bodyOffset.z };
      const velocity = { x: b.startVelocity.x + b.acceleration.x * dt, z: b.startVelocity.z + b.acceleration.z * dt };
      if (Math.hypot(velocity.x, velocity.z) > c.plan.parameters.topSpeedMps) throw new Error('Source defensive control inherited speed exceeds top speed');
      while (c.plan.waypoints && c.waypoint < c.plan.waypoints.length
        && Math.hypot(c.plan.waypoints[c.waypoint].x - position.x, c.plan.waypoints[c.waypoint].z - position.z) <= c.plan.parameters.arrivalRadiusMeters) c.waypoint += 1;
      const target = now < c.plan.movementStartTick ? null : c.plan.waypoints?.[c.waypoint] ?? null;
      const next = Math.min(coverage, now + c.plan.parameters.maxIntegrationStepTicks,
        c.plan.movementStartTick > now ? c.plan.movementStartTick : coverage);
      if (!tick(next) || next <= now) throw new Error('Source defensive control coverage exhausted');
      const segment = buildDefenderMotionTrajectory({ tick: now, position, velocity }, target, next - now, c.plan.parameters)[0];
      c.nextTick = next;
      return [c.plan.playerId, segment.acceleration] as const;
    }));
    motor.apply({ kind: 'adopt', availableAtTick: now, coverageThroughTick: Math.min(...controls.map(c => c.nextTick)),
      commands: field.motion.actors.map(a => {
        const acceleration = bodyCommands.get(a.playerId);
        // Every primitive remains in the same world. Nondefenders retain their
        // original commands; no collider or runner is omitted from the query.
        return { playerId: a.playerId, role: a.primitive.role,
          acceleration: acceleration ? { x: acceleration.x, y: 0, z: acceleration.z } : a.primitive.acceleration };
      }) });
  };
  const advanceThrough = (throughTick: number) => {
    healthy();
    const start = motor.read().motion.world.moment;
    if (!tick(throughTick) || secondsAt(throughTick) < start.elapsedSeconds || throughTick > coverage)
      throw new Error('invalid Source defensive control horizon');
    let advances = 0;
    try {
      for (;;) {
        const field = motor.read(), elapsed = field.motion.world.moment.elapsedSeconds;
        if (!field.motion.cursor) return freeze({ ...view(), status: 'capture_candidate' as const, advances });
        if (elapsed === secondsAt(reviewTick())) return freeze({ ...view(), status: 'review_due' as const, advances });
        if (elapsed === secondsAt(throughTick)) return freeze({ ...view(), status: 'horizon_reached' as const, advances });
        // Yield cooperatively; neither the clock nor any body is advanced on a
        // work-budget boundary. Resume continues the same accepted intent.
        if (advances === 256) return freeze({ ...view(), status: 'work_limit' as const, advances });
        adoptDue();
        const end = Math.min(throughTick, reviewTick(), ...controls.map(c => c.nextTick));
        if (secondsAt(end) <= elapsed) throw new Error('Source defensive control did not advance its clock');
        const next = motor.apply({ kind: 'advance', throughTick: end }); advances += 1;
        if (next.motion.world.kind === 'boundary') return freeze({ ...view(), status: next.motion.cursor ? 'physical_boundary' as const : 'capture_candidate' as const, advances });
      }
    } catch (error) { failed = true; throw error; }
  };
  const replacePlans = (plans: readonly SourceDefensiveControlPlanV1[]) => {
    healthy();
    if (motor.read().motion.carrierPlayerId !== null || !motor.read().motion.cursor || exactTick() !== reviewTick())
      throw new Error('Source defensive control replacement requires the due free-ball review');
    const next = createControls(plans, exactTick());
    if (next.some(c => c.plan.availableAtTick !== exactTick())) throw new Error('Source defensive control replacement must be available now');
    controls = next;
    return view();
  };
  return Object.freeze({ read: () => { healthy(); return view(); }, advanceThrough, replacePlans,
    evidence: () => { healthy(); return motor.evidence(); } });
};
