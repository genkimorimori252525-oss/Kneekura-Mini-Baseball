import type { Vec3 } from '../../core/model/geometry';
import type { PitchWorldState, BatterSwingState } from '../../core/sim/contact/BatBallContact';
import { createRigidBatStateFromBatterSwingState, measureRigidBatBallSurfaceSeparation,
  resolveRigidBatBallContactWithParameterResolver, sampleBatRadius, type RigidBatBallContactResult } from '../../core/sim/contact/RigidBatBallContact';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { resolveWoodBatSpeedResponse } from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import { createFreeBaseballTrajectory, type FreeBaseballSample } from '../../core/sim/ball/FreeBaseballTrajectory';
import { advanceAerodynamicPitchState, findAerodynamicPitchPlateCrossing,
} from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { advanceBaseballOrientation, IDENTITY_QUATERNION, quaternionFromAxisAngle, rotateVectorByQuaternion } from '../../core/sim/pitching/BaseballOrientation';
import { DeterministicRng } from '../../core/rng/DeterministicRng';
import { createWorkbenchPlayer, exportWorkbenchPlayerSources, WORKBENCH_TICKS_PER_SECOND, type WorkbenchPlayer } from './WorkbenchPlayer';
import { createWorkbenchPitchTrajectory } from './WorkbenchPitchTrajectory';

export type WorkbenchPitch = Readonly<{ speedMps: number; spinRpm: number;
  spinAxis: 'backspin' | 'topspin' | 'sidespin' | 'gyro'; courseX: number; courseY: number }>;
export type BattingWorkbenchInput = Readonly<{ player: WorkbenchPlayer; seed: number; pitch: WorkbenchPitch;
  timingOffsetMs?: number; positionOffsetM?: number; throughSeconds?: number }>;
export type WorkbenchBatFrame = Readonly<{ tick: number; grip: Vec3; tip: Vec3; sweetSpot: Vec3;
  sweetSpotVelocity: Vec3; body: Readonly<{ shoulders: readonly Vec3[]; elbows: readonly Vec3[];
    hands: readonly Vec3[]; torsoCenter: Vec3 }> }>;

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, n: number): Vec3 => ({ x: a.x * n, y: a.y * n, z: a.z * n });
const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a: Vec3) => scale(a, 1 / Math.max(1e-12, norm(a)));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const rad = (v: number) => v * Math.PI / 180;
const gaussian = (rng: DeterministicRng) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng.nextFloat()))) * Math.cos(2 * Math.PI * rng.nextFloat());

/** Controlled, reproducible batting instrument using existing Core kernels.
 * It is not a second match-result engine: actor/rule/official admission remains
 * outside this instrument. Authored body reach is a geometric two-link prior;
 * whole-body muscle torque, hand compliance and player scouting are not inferred. */
export function simulateBattingWorkbench(raw: BattingWorkbenchInput) {
  const player = createWorkbenchPlayer(raw.player), pitch = structuredClone(raw.pitch);
  const duration = raw.throughSeconds ?? 8, timeOffset = raw.timingOffsetMs ?? 0, positionOffset = raw.positionOffsetM ?? 0;
  if (!Number.isSafeInteger(raw.seed) || !pitch || ![pitch.speedMps, pitch.spinRpm, pitch.courseX, pitch.courseY,
    duration, timeOffset, positionOffset].every(Number.isFinite) || pitch.speedMps < 10 || pitch.speedMps > 80
    || pitch.spinRpm < 0 || pitch.spinRpm > 5000 || Math.abs(pitch.courseX) > 1.5 || pitch.courseY < 0.2 || pitch.courseY > 2.5
    || duration < 1 || duration > 20 || Math.abs(timeOffset) > 500 || Math.abs(positionOffset) > 0.5
    || !['backspin', 'topspin', 'sidespin', 'gyro'].includes(pitch.spinAxis)) throw new Error('invalid workbench physical scenario');
  const sourceValues = exportWorkbenchPlayerSources(player), equipment = sourceValues.equipment;
  const p = WORKBENCH_TICKS_PER_SECOND;
  const {initial,parameters,trajectory,flightEnd} = createWorkbenchPitchTrajectory(pitch);
  const target = findAerodynamicPitchPlateCrossing(trajectory, player.swing.contactDepthM)!;
  const rng = new DeterministicRng(raw.seed), diagnostics: string[] = [];
  const awkwardness = Math.max(0, Math.abs(target.position.x) / 0.2159 - 1,
    (0.55 - target.position.y) / 0.5, (target.position.y - 1.5) / 0.5);
  const executionError = player.capability.positionErrorMeters * (1 + awkwardness * (1 - player.traits.badBallControl));
  const aimed = add(target.position, { x: gaussian(rng) * executionError,
    y: gaussian(rng) * executionError + positionOffset, z: 0 });
  const timingNoise = Math.round(gaussian(rng) * player.capability.timingErrorTicks);
  const plannedContactTick = target.tick + player.capability.technicalTimingOffsetTicks + Math.round(timeOffset * 1000) + timingNoise;
  const preTicks = Math.round(player.swing.preContactSeconds * p), followTicks = Math.round(player.swing.followThroughSeconds * p);
  const startTick = Math.max(player.capability.motorLatencyTicks, plannedContactTick - preTicks);
  const motorDelay = startTick - (plannedContactTick - preTicks), contactTick = plannedContactTick + motorDelay;
  const endTick = contactTick + followTicks;
  if (motorDelay > 0) diagnostics.push('身体の反応が始動予定に間に合わず、実スイングを遅らせました');
  const side = player.identity.bats === 'R' ? 1 : -1;
  const pull = rad(player.swing.pullAngleDeg * side), attack = rad(player.swing.attackAngleDeg);
  const contactAxis = { x: side * Math.cos(pull), y: 0, z: side * Math.sin(pull) };
  const tangent = { x: -Math.sin(pull) * Math.cos(attack), y: Math.sin(attack), z: Math.cos(pull) * Math.cos(attack) };
  const axisNormal = unit(cross(contactAxis, tangent)), sweetRadius = player.bat.lengthM * player.bat.sweetSpotT;
  const omega = player.swing.speedMps / sweetRadius;
  if (player.swing.loadAngleDeg >= -1 || player.swing.finishAngleDeg <= 1) {
    throw new Error('始動角は-1度未満、終点角は1度超にしてください');
  }
  const loadAngle = -rad(player.swing.loadAngleDeg), finishAngle = rad(player.swing.finishAngleDeg);
  if (loadAngle < 0.01 || finishAngle < 0.01) throw new Error('バットの始動角と終点角は1度以上にしてください');
  const preExponent = omega * player.swing.preContactSeconds / loadAngle;
  const postExponent = omega * player.swing.followThroughSeconds / finishAngle;
  if (preExponent < 1 || postExponent < 1) throw new Error('角度に対してスイング時間が短すぎます。時間を増やすか角度を減らしてください');
  const centerAtContact = add(aimed, { x: 0, y: 0,
    z: -(equipment.ball.radiusM + sampleBatRadius(equipment.batPhysical.radiusProfile, player.bat.sweetSpotT)) });
  const contactGrip = sub(centerAtContact, scale(contactAxis, sweetRadius));
  const shoulderCenter = { x: -side * player.body.heightMeters * 0.47, y: player.body.heightMeters * 0.64, z: 0.08 };
  const shoulders = [-1, 1].map(s => add(shoulderCenter, { x: side * s * player.body.heightMeters * 0.09, y: 0, z: 0 }));
  const upperArm = player.body.heightMeters * 0.18, forearm = player.body.heightMeters * 0.16;
  const reach = upperArm + forearm - 1e-5;
  const minimumReach = Math.abs(upperArm - forearm) + 1e-5;
  const angles = (tick: number) => {
    if (tick <= startTick) return { theta: -loadAngle, rate: 0, hand: -player.swing.handTravelM };
    if (tick < contactTick) {
      const u = (tick - startTick) / preTicks;
      return { theta: -loadAngle * (1 - u ** preExponent), rate: omega * u ** (preExponent - 1),
        hand: -player.swing.handTravelM * (1 - smooth(u)) };
    }
    if (tick < endTick) {
      const u = (tick - contactTick) / followTicks;
      return { theta: finishAngle * (1 - (1 - u) ** postExponent), rate: omega * (1 - u) ** (postExponent - 1),
        hand: player.swing.handTravelM * 0.35 * smooth(u) };
    }
    return { theta: finishAngle, rate: 0, hand: player.swing.handTravelM * 0.35 };
  };
  const pose = (tick: number) => {
    const a = angles(tick), axis = rotateVectorByQuaternion(contactAxis, quaternionFromAxisAngle(axisNormal, a.theta));
    let grip = add(contactGrip, scale(contactAxis, a.hand));
    // Reach is a body constraint, never a bad-ball reach bonus. Project both
    // actual hands into the intersection of the two-link reach shells. The
    // lower radius matters too: unequal bone lengths cannot fold to zero.
    for (let i = 0; i < 64; i++) {
      let changed = false;
      for (let arm = 0; arm < 2; arm++) {
        const offset = scale(axis, arm * 0.045), hand = add(grip, offset), distance = sub(hand, shoulders[arm]);
        const length = norm(distance), allowed = clamp(length, minimumReach, reach);
        if (length !== allowed) {
          changed = true;
          const direction = length > 1e-12 ? unit(distance) : { x: 0, y: 0, z: 1 };
          grip = sub(add(shoulders[arm], scale(direction, allowed)), offset);
        }
      }
      if (!changed) break;
    }
    for (let arm = 0; arm < 2; arm++) {
      const distance = norm(sub(add(grip, scale(axis, arm * 0.045)), shoulders[arm]));
      if (distance < minimumReach - 1e-8 || distance > reach + 1e-8) throw new Error('両腕の到達範囲を満たす姿勢を解けません');
    }
    return { grip, tip: add(grip, scale(axis, player.bat.lengthM)), axis, angularVelocity: scale(axisNormal, a.rate) };
  };
  const swingState = (tick: number): BatterSwingState => {
    const current = pose(tick), before = pose(Math.max(0, tick - 10)), after = pose(tick + 10);
    const dt = (tick + 10 - Math.max(0, tick - 10)) / p;
    return { pose: { grip: current.grip, tip: current.tip }, linearVelocity: scale(sub(after.grip, before.grip), 1 / dt),
      angularVelocity: current.angularVelocity };
  };
  const rigidAt = (tick: number) => createRigidBatStateFromBatterSwingState(swingState(tick), equipment.batPhysical);
  const physicalAt = (tick: number) => advanceAerodynamicPitchState(initial, tick, parameters);
  const pitchFrames: Readonly<{ tick: number; position: Vec3; spin: Vec3; orientation: typeof IDENTITY_QUATERNION }>[] = [];
  let ball = initial, orientation = IDENTITY_QUATERNION, contact: RigidBatBallContactResult | null = null;
  const perceivedZoneScore = clamp(1 - Math.max(Math.abs(target.position.x) / 0.45,
    Math.abs(target.position.y - 1.0) / 0.8), 0, 1);
  const shouldSwing = player.decision.approach === 'SWING' || player.decision.approach === 'AUTO'
    && perceivedZoneScore + player.decision.aggressionWeight * 0.2 >= player.decision.threshold;
  // Audit the motor, not the render frames. Include the hand-translation
  // extrema explicitly and a 0.1ms source lattice through the entire motion.
  let maximumSpeed = 0;
  const speedAt = (tick: number) => {
    const state = swingState(tick), axis = unit(sub(state.pose.tip, state.pose.grip));
    return norm(add(state.linearVelocity, cross(state.angularVelocity, scale(axis, sweetRadius))));
  };
  if (shouldSwing) {
    for (let tick = startTick; tick <= endTick; tick += 100) maximumSpeed = Math.max(maximumSpeed, speedAt(tick));
    for (const tick of [startTick, startTick + Math.round(preTicks / 2), contactTick,
      contactTick + Math.round(followTicks / 2), endTick]) maximumSpeed = Math.max(maximumSpeed, speedAt(tick));
    if (maximumSpeed > player.capability.maximumSweetSpotSpeedMps * 1.001) throw new Error('実軌道の芯速度が選手の身体上限を超えます');
  }
  // In the no-wind profile, drag dissipates speed and lift is orthogonal to
  // velocity. Gravity bounds ball speed; the admitted bat envelope plus its
  // rigid lever bounds surface speed. Search suspected intervals on the actual
  // 1us source clock, including contacts wholly between the 1ms Aero anchors.
  const relativeSpeedBound = norm(initial.velocity) + 9.81 * flightEnd / p
    + player.capability.maximumSweetSpotSpeedMps + omega * Math.max(sweetRadius, player.bat.lengthM - sweetRadius);
  const contactWithin = (anchor: PitchWorldState, lower: number, upper: number): number | null => {
    const at = (tick: number) => advanceAerodynamicPitchState(anchor, tick - anchor.tick, parameters);
    const separation = (tick: number) => measureRigidBatBallSurfaceSeparation(at(tick), rigidAt(shouldSwing ? tick : 0), equipment.ball);
    const search = (a: number, b: number, sa: number, sb: number): number | null => {
      if (sa <= 0) return a;
      if (b - a <= 1) return sb <= 0 ? b : null;
      if (Math.min(sa, sb) > relativeSpeedBound * (b - a) / p) return null;
      const middle = Math.floor((a + b) / 2), sm = separation(middle);
      return search(a, middle, sa, sm) ?? search(middle, b, sm, sb);
    };
    return search(lower, upper, separation(lower), separation(upper));
  };
  for (let tick = 0; tick <= flightEnd; tick += 1_000) {
    const anchor = ball;
    if (tick > 0) {
      const next = advanceAerodynamicPitchState(ball, 1_000, parameters);
      orientation = advanceBaseballOrientation(orientation, scale(add(ball.spin, next.spin), 0.5), 0.001);
      ball = next;
    }
    if (tick % 8_000 === 0) pitchFrames.push({ tick, position: ball.position, spin: ball.spin, orientation });
    // A decision is not a collision filter: even a held bat can be hit by a
    // pitched ball. The same bat that is rendered must participate physically.
    {
      const low = contactWithin(anchor, anchor.tick, tick);
      if (low === null) continue;
      const at = physicalAt(low);
      contact = resolveRigidBatBallContactWithParameterResolver(at, rigidAt(shouldSwing ? low : 0), equipment.ball,
        k => resolveWoodBatSpeedResponse(NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1, k.normalApproachSpeedMps));
      if (contact) {
        if (!shouldSwing) diagnostics.push('見送り中の静止バットに球が接触しました。公式裁定は未実行');
        // Preserve the incoming material phase at exact impact; impulse changes
        // angular velocity, never the position/orientation discontinuously.
        orientation = IDENTITY_QUATERNION;
        let cursor = initial;
        while (cursor.tick < low) {
          const step = Math.min(1_000, low - cursor.tick), next = advanceAerodynamicPitchState(cursor, step, parameters);
          orientation = advanceBaseballOrientation(orientation, scale(add(cursor.spin, next.spin), 0.5), step / p); cursor = next;
        }
        pitchFrames.push({ tick: low, position: at.position, spin: at.spin, orientation });
        break;
      }
    }
  }
  const batFrames: WorkbenchBatFrame[] = [];
  const elbow = (shoulder: Vec3, hand: Vec3, arm: number): Vec3 => {
    const delta = sub(hand, shoulder), distance = norm(delta), direction = unit(delta);
    const along = (upperArm ** 2 - forearm ** 2 + distance ** 2) / (2 * distance);
    let perpendicular = cross(direction, { x: 0, y: 1, z: 0 });
    if (norm(perpendicular) < 1e-8) perpendicular = cross(direction, { x: 0, y: 0, z: 1 });
    perpendicular = unit(perpendicular);
    return add(add(shoulder, scale(direction, along)), scale(perpendicular,
      side * (arm === 0 ? 1 : -1) * Math.sqrt(Math.max(0, upperArm ** 2 - along ** 2))));
  };
  const batEnd = Math.max(flightEnd, endTick);
  const batTicks = Array.from({ length: Math.floor(batEnd / 4_000) + 1 }, (_, i) => i * 4_000);
  const exactBatTicks = [...new Set([...batTicks, startTick, contactTick, endTick, ...(contact ? [contact.tick] : [])])]
    .filter(tick => tick >= 0).sort((a, b) => a - b);
  for (const tick of exactBatTicks) {
    const state = swingState(shouldSwing ? tick : 0), axis = unit(sub(state.pose.tip, state.pose.grip));
    const sweetSpot = add(state.pose.grip, scale(axis, sweetRadius));
    const sweetSpotVelocity = add(state.linearVelocity, cross(state.angularVelocity, scale(axis, sweetRadius)));
    maximumSpeed = Math.max(maximumSpeed, norm(sweetSpotVelocity));
    const hands = [state.pose.grip, add(state.pose.grip, scale(axis, 0.045))];
    batFrames.push({ tick, ...state.pose, sweetSpot, sweetSpotVelocity,
      body: { shoulders, elbows: hands.map((h, i) => elbow(shoulders[i], h, i)), hands, torsoCenter: { ...shoulderCenter, y: player.body.heightMeters * 0.5 } } });
  }
  if (maximumSpeed > player.capability.maximumSweetSpotSpeedMps * 1.001) throw new Error('実軌道の芯速度が選手の身体上限を超えます');
  let flightFrames: readonly FreeBaseballSample[] = [], firstLanding: Vec3 | null = null;
  if (contact) {
    const throughTick = contact.tick + Math.round(duration * p);
    const free = createFreeBaseballTrajectory({ initialBall: { tick: contact.tick, position: contact.ballCenter,
      velocity: contact.exitVelocity, spin: contact.exitSpin }, throughTick, aerodynamics: parameters,
      ground: { radiusM: equipment.ball.radiusM, inertiaRatio: equipment.ball.rotationalInertiaFactor,
        gravityMps2: 9.81, ticksPerSecond: p, restingVerticalSpeedMps: 0.15,
        material: { restitution: 0.4, slidingFriction: 0.3, rollingDecelerationMps2: 0.8, normalSpinDecayPerSecond: 0.5 } },
      orientationAtStart: orientation });
    const ticks = Array.from({ length: Math.floor(duration * 100) + 1 }, (_, i) => contact!.tick + i * 10_000);
    flightFrames = free.observe(ticks);
    firstLanding = free.groundContacts[0]?.incoming.position ?? null;
  }
  const horizontal = contact ? Math.hypot(contact.exitVelocity.x, contact.exitVelocity.z) : 0;
  const exitSpeed = contact ? norm(contact.exitVelocity) : null;
  const exitSpin = contact ? norm(contact.exitSpin) : null;
  const perpendicularSpin = contact && exitSpeed ? norm(cross(contact.exitSpin, unit(contact.exitVelocity))) : 0;
  const carry = contact && firstLanding ? Math.hypot(firstLanding.x - contact.ballCenter.x, firstLanding.z - contact.ballCenter.z) : null;
  diagnostics.push('全身の筋力・握りの弾性・実選手別校正は未確定。打撃の衝突と飛翔はCoreの同じ計算を使用');
  diagnostics.push('衝突後のバットは規定フォロースルー。Coreの反動速度は計算済みですが身体との連成は未実装');
  return { authority: 'CORE_PHYSICAL_BATTING_WORKBENCH' as const, officialResult: null, player, sourceValues,
    numericalResolution: { contactClockTicks: 1, motorAuditStepTicks: 100, renderStepTicks: 4_000 },
    trajectoryAuthority: { beforeContact: 'BODY_CONSTRAINED_KINEMATICS', afterContact: 'PRESCRIBED_FOLLOW_THROUGH_RECOIL_NOT_COUPLED' } as const,
    batFrames, pitchFrames, flightFrames, contact, diagnostics,
    metrics: { batSpeedMps: maximumSpeed, exitSpeedMps: exitSpeed,
      launchAngleDeg: contact ? Math.atan2(contact.exitVelocity.y, horizontal) * 180 / Math.PI : null,
      spinRpm: exitSpin === null ? null : exitSpin * 60 / (2 * Math.PI),
      spinEfficiency: exitSpin ? perpendicularSpin / exitSpin : null, carryM: carry } };
}
