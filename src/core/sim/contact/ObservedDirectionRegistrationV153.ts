import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1, type ReferenceBatKinematicsMotionV1 } from './ReferenceBatKinematicsV1';
import { referenceWorldTickAtSourceV121 } from './ReferenceBatMotorV121';
import type { PitchWorldState } from './BatBallContact';
import { createRigidBatStateFromBatterSwingState, measureRigidBatBallGeometry, measureRigidBatBallSurfaceSeparation,
  type RigidBaseballProperties, type RigidBatPhysicalProperties, type RigidBatBallContactResult } from './RigidBatBallContact';
import { resolveWoodBatSpeedProfileBallContact } from './WoodBatSpeedResponseProfile';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from './WoodBatProductionProfileV1';

export type ObservedDirectionRegistrationInputV153 = Readonly<{
  reference:ReferenceBatKinematicsInputV1;contactSourceTick:number;
  prediction:Readonly<{ anchorTick:number;availableTick:number;position:Vec3;velocity:Vec3;acceleration:Vec3 }>;
  desiredFieldAngleDegrees:number;batPhysical:RigidBatPhysicalProperties;ballPhysical:RigidBaseballProperties;
  limits?:Readonly<{ maximumSweetSpotSpeedMps?:number;maximumGripAccelerationMps2?:number;
    maximumAngularAccelerationRadPerSecond2?:number;maximumSweetSpotAccelerationMps2?:number }>;
}>;
export type ObservedReactiveRegistrationInputV161 = Omit<ObservedDirectionRegistrationInputV153, 'desiredFieldAngleDegrees'>;
const LIMIT_KEYS = ['maximumSweetSpotSpeedMps', 'maximumGripAccelerationMps2',
  'maximumAngularAccelerationRadPerSecond2', 'maximumSweetSpotAccelerationMps2'] as const;
const YAW_DEGREES = Object.freeze(Array.from({ length:17 }, (_, index) => index * 5 - 40));
const CONTACT_TIME_WIDTH_SECONDS = 1e-5, LEAF_TIME_SECONDS = 1e-7, SEARCH_EVALUATIONS = 4096;
const REGISTRATION_INWARD_METERS = 1e-10;
const add = (one:Vec3, two:Vec3):Vec3 => ({ x:one.x + two.x, y:one.y + two.y, z:one.z + two.z });
const sub = (one:Vec3, two:Vec3):Vec3 => ({ x:one.x - two.x, y:one.y - two.y, z:one.z - two.z });
const scale = (value:Vec3, factor:number):Vec3 => ({ x:value.x * factor, y:value.y * factor, z:value.z * factor });
const dot = (one:Vec3, two:Vec3) => one.x * two.x + one.y * two.y + one.z * two.z;
const norm = (value:Vec3) => Math.hypot(value.x, value.y, value.z);
const fields = (value:unknown, keys:readonly string[], optional:readonly string[] = []) => !!value && typeof value === 'object' && !Array.isArray(value) &&
  keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => keys.includes(key) || optional.includes(key));
const vector = (value:Vec3) => fields(value, ['x', 'y', 'z']) && Object.values(value).every(Number.isFinite);
function assert(condition:unknown, message:string):asserts condition {
  if (!condition) throw Error('observed direction registration v153: ' + message);
}
function frozen<T>(value:T):T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(frozen);Object.freeze(value); }
  return value;
}
type Certificates = Readonly<{ maximumSweetSpotSpeedMps:number;maximumGripAccelerationMps2:number|null;
  maximumAngularAccelerationRadPerSecond2:number|null;maximumSweetSpotAccelerationMps2:number|null;c1:boolean;
  includesPreparationRecovery:boolean;intervalCertificatesV154?:ReferenceBatKinematicsMotionV1['intervalCertificatesV154'] }>;
type PredictedContact = Readonly<{ atTick:number;contactWindow:Readonly<{ fromTick:number;throughTick:number;maximumWidthSeconds:number }>;
  fieldAngleDegrees:number;surfaceSeparationM:number;geometry:ReturnType<typeof measureRigidBatBallGeometry>;
  response:RigidBatBallContactResult;searchEvaluations:number }>;
type Candidate = Readonly<{ yawDegrees:number;status:'PREDICTED_CONTACT'|'LIMIT_EXCEEDED'|'UNRESOLVED'|'NO_CLOSING_RESPONSE';
  reason:string;certificates:Certificates|null;nominalTargetSweetSpot:Vec3|null;nominalSurfaceSeparationM:number|null;
  predictedContact:PredictedContact|null;residualDegrees:number|null }>;
function certificates(motion:ReferenceBatKinematicsMotionV1):Certificates {
  return { maximumSweetSpotSpeedMps:motion.maximumSweetSpotSpeedUpperBoundMps,
    maximumGripAccelerationMps2:motion.maximumGripAccelerationMps2 ?? null,
    maximumAngularAccelerationRadPerSecond2:motion.maximumAngularAccelerationRadPerSecond2 ?? null,
    maximumSweetSpotAccelerationMps2:motion.maximumSweetSpotAccelerationMps2 ?? null,
    c1:motion.executionInterpolationV122 === 'cubic-c1', includesPreparationRecovery:motion.motionStartTickV133 !== undefined,
    ...(motion.intervalCertificatesV154===undefined?{}:{intervalCertificatesV154:motion.intervalCertificatesV154}) };
}
function predictedBall(input:ObservedReactiveRegistrationInputV161, atTick:number):PitchWorldState {
  const dt = (atTick - input.prediction.anchorTick) / input.reference.ticksPerSecond,
    position = add(input.prediction.position, add(scale(input.prediction.velocity, dt), scale(input.prediction.acceleration, .5 * dt * dt))),
    velocity = add(input.prediction.velocity, scale(input.prediction.acceleration, dt));
  assert(vector(position) && vector(velocity), 'nonfinite frozen prediction');
  return { tick:atTick, position, velocity, spin:{ x:0, y:0, z:0 } };
}

/** Pure positional-gap search. All bounds come from this frozen p/v/a and the
 * final bat certificate; no actual Source cells/kernel are accepted or used.
 * Uncertified near misses are retained as unresolved instead of skipped. */
function firstPredictedContact(input:ObservedReactiveRegistrationInputV161, motion:ReferenceBatKinematicsMotionV1,
  fromTick:number, throughTick:number, maximumRadius:number) {
  const tps = input.reference.ticksPerSecond, seconds = Math.max(Math.abs((fromTick - input.prediction.anchorTick) / tps),
    Math.abs((throughTick - input.prediction.anchorTick) / tps)),
    speedBound = norm(input.prediction.velocity) + norm(input.prediction.acceleration) * seconds + motion.maximumGripSpeedMps +
      motion.maximumAngularSpeedRadPerSecond * (motion.batLengthM + maximumRadius);
  assert(Number.isFinite(speedBound) && speedBound >= 0, 'nonfinite contact speed bound');
  const samples = new Map<number, number>();let evaluations = 0, possibleFrom:number|null = null;
  const gap = (tick:number) => {
    const old = samples.get(tick);if (old !== undefined) return old;
    if (evaluations >= SEARCH_EVALUATIONS) return null;
    const ball = predictedBall(input, tick), bat = createRigidBatStateFromBatterSwingState(motion.sampleContinuous(tick).state, input.batPhysical),
      distance = measureRigidBatBallSurfaceSeparation(ball, bat, input.ballPhysical);
    assert(Number.isFinite(distance), 'nonfinite contact gap');samples.set(tick, distance);evaluations++;return distance;
  };
  const leftGap = gap(fromTick), rightGap = gap(throughTick);
  if (leftGap === null || rightGap === null || leftGap < -1e-8) return { status:'UNRESOLVED' as const, reason:'INITIAL_OVERLAP_OR_SEARCH_BUDGET', evaluations };
  type Interval = { left:number;right:number;leftGap:number;rightGap:number };
  const stack:Interval[] = [{ left:fromTick, right:throughTick, leftGap, rightGap }];
  while (stack.length) {
    const interval = stack.pop()!, { left, right } = interval, middle = (left + right) / 2, middleGap = gap(middle);
    if (middleGap === null) return { status:'UNRESOLVED' as const, reason:'SEARCH_BUDGET', evaluations };
    const duration = (right - left) / tps,
      rounding = 128 * Number.EPSILON * Math.max(1, norm(predictedBall(input, middle).position), motion.batLengthM),
      lower = Math.min(interval.leftGap, middleGap, interval.rightGap) - speedBound * duration / 4 - rounding;
    if (lower > 0) continue;
    if (duration > LEAF_TIME_SECONDS && middle > left && middle < right) {
      stack.push({ left:middle, right, leftGap:middleGap, rightGap:interval.rightGap },
        { left, right:middle, leftGap:interval.leftGap, rightGap:middleGap });continue;
    }
    possibleFrom ??= left;
    const inside = [[left, interval.leftGap], [middle, middleGap], [right, interval.rightGap]].find(([, distance]) => distance <= 0);
    if (inside) {
      let lo = left, hi = inside[0];
      if (interval.leftGap <= 0) hi = left;
      else for (let count = 0; count < 48 && hi > lo; count++) {
        const at = (lo + hi) / 2;if (at === lo || at === hi) break;
        const distance = gap(at);if (distance === null) return { status:'UNRESOLVED' as const, reason:'SEARCH_BUDGET', evaluations };
        if (distance <= 0) hi = at;else lo = at;
      }
      if ((hi - possibleFrom) / tps > CONTACT_TIME_WIDTH_SECONDS)
        return { status:'UNRESOLVED' as const, reason:'EARLIER_POSSIBLE_CONTACT_NOT_LOCALIZED', evaluations };
      return { status:'FOUND' as const, atTick:hi, fromTick:possibleFrom, throughTick:hi, evaluations };
    }
    if ((right - possibleFrom) / tps > CONTACT_TIME_WIDTH_SECONDS)
      return { status:'UNRESOLVED' as const, reason:'EARLIER_POSSIBLE_CONTACT_NOT_LOCALIZED', evaluations };
  }
  return { status:'UNRESOLVED' as const, reason:'NO_CERTIFIED_SURFACE_CONTACT', evaluations };
}

function validateInput(input:ObservedReactiveRegistrationInputV161, reactive:boolean) {
  const desired = (input as ObservedDirectionRegistrationInputV153|null)?.desiredFieldAngleDegrees;
  assert(fields(input, ['reference', 'contactSourceTick', 'prediction', ...(reactive ? [] : ['desiredFieldAngleDegrees']), 'batPhysical', 'ballPhysical'], ['limits']) &&
    fields(input.prediction, ['anchorTick', 'availableTick', 'position', 'velocity', 'acceleration']) && Number.isFinite(input.prediction.anchorTick) &&
    input.prediction.anchorTick >= 0 && input.prediction.anchorTick <= Number.MAX_SAFE_INTEGER &&
    Number.isSafeInteger(input.prediction.availableTick) && input.prediction.availableTick >= 0 &&
    [input.prediction.position, input.prediction.velocity, input.prediction.acceleration].every(vector) &&
    Number.isFinite(input.contactSourceTick) && (reactive || Number.isFinite(desired) && Math.abs(desired!) <= 180),
  'invalid nominal prediction or private extra fields');
  if (input.limits !== undefined) assert(fields(input.limits, [], LIMIT_KEYS) &&
    Object.values(input.limits).every(value => Number.isFinite(value) && value > 0), 'invalid explicit limits');
  assert(input.reference.aimCorrectionV121 === undefined, 'nominal reference must not contain delivered aim correction');
}

type RegistrationCandidate = Readonly<{ reference:ReferenceBatKinematicsInputV1|null;candidate:Candidate;preparationTransferCostMps:number|null }>;
function registrationCandidates(input:ObservedReactiveRegistrationInputV161, desiredFieldAngleDegrees:number|null):RegistrationCandidate[] {
  const original = createReferenceBatKinematicsV1(input.reference), first = input.reference.frames[0], last = input.reference.frames.at(-1)!;
  assert(input.contactSourceTick >= first.tick && input.contactSourceTick <= last.tick, 'contact Source tick outside original frame window');
  const nominalTick = referenceWorldTickAtSourceV121(input.reference, input.contactSourceTick), nominalBall = predictedBall(input, nominalTick);
  measureRigidBatBallGeometry(nominalBall, createRigidBatStateFromBatterSwingState(original.sampleAtSourceTick(input.contactSourceTick).state,
    input.batPhysical), input.ballPhysical);
  const maximumRadius = Math.max(...input.batPhysical.radiusProfile.knots.map(knot => knot.radiusM)), candidates:RegistrationCandidate[] = [];
  for (const yawDegrees of YAW_DEGREES) {
    let certificate:Certificates|null = null, target:Vec3|null = null, nominalGap:number|null = null;
    const reject = (status:Candidate['status'], reason:string):RegistrationCandidate => ({ reference:null, preparationTransferCostMps:null,
      candidate:{ yawDegrees, status, reason, certificates:certificate,
        nominalTargetSweetSpot:target, nominalSurfaceSeparationM:nominalGap, predictedContact:null, residualDegrees:null } });
    if (desiredFieldAngleDegrees === null && input.reference.executionEnvelopeV133 === undefined) {
      candidates.push(reject('UNRESOLVED', 'MISSING_AUTHORED_HELD_PREPARATION'));continue;
    }
    try {
      const rotation = normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle({ x:0, y:1, z:0 }, yawDegrees * Math.PI / 180), input.reference.transform.rotation)),
        rotated:ReferenceBatKinematicsInputV1 = { ...input.reference, transform:{ ...input.reference.transform, rotation } },
        rotatedMotion = createReferenceBatKinematicsV1(rotated), sample = rotatedMotion.sampleAtSourceTick(input.contactSourceTick),
        axis = scale(sub(sample.state.pose.tip, sample.state.pose.grip), 1 / rotatedMotion.batLengthM),
        relative = sub(sample.sweetSpotVelocity, nominalBall.velocity), perpendicular = sub(relative, scale(axis, dot(relative, axis))), magnitude = norm(perpendicular);
      if (!(magnitude > 1e-12 && Number.isFinite(magnitude))) { candidates.push(reject('UNRESOLVED', 'NO_APPROACH_NORMAL'));continue; }
      const normal = scale(perpendicular, 1 / magnitude), rigid = createRigidBatStateFromBatterSwingState(sample.state, input.batPhysical);
      let low = 0, high = input.ballPhysical.radiusM + maximumRadius;
      for (let count = 0; count < 48; count++) {
        const distance = (low + high) / 2, ball = { ...nominalBall, position:add(sample.sweetSpot, scale(normal, distance)) },
          separation = measureRigidBatBallSurfaceSeparation(ball, rigid, input.ballPhysical);
        if (separation <= 0) low = distance;else high = distance;
      }
      target = sub(nominalBall.position, scale(normal, Math.max(0, low - REGISTRATION_INWARD_METERS)));
      const registered:ReferenceBatKinematicsInputV1 = { ...rotated, transform:{ ...rotated.transform,
        translation:add(rotated.transform.translation, sub(target, sample.sweetSpot)) } },
        motion = createReferenceBatKinematicsV1(registered), nominalBat = createRigidBatStateFromBatterSwingState(motion.sampleAtSourceTick(input.contactSourceTick).state, input.batPhysical);
      certificate = certificates(motion);nominalGap = measureRigidBatBallSurfaceSeparation(nominalBall, nominalBat, input.ballPhysical);
      const missing = LIMIT_KEYS.find(key => input.limits?.[key] !== undefined && certificate![key] === null),
        exceeded = LIMIT_KEYS.find(key => input.limits?.[key] !== undefined && certificate![key] !== null && certificate![key]! > input.limits[key]!);
      if (missing) { candidates.push(reject('UNRESOLVED', 'MISSING_CERTIFICATE:' + missing));continue; }
      if (exceeded) { candidates.push(reject('LIMIT_EXCEEDED', 'EXPLICIT_LIMIT:' + exceeded));continue; }
      const fromTick = motion.motionStartTickV133 ?? input.reference.startTick;
      let preparationTransferCostMps:number|null = null;
      if (desiredFieldAngleDegrees === null) {
        const preparationSeconds = (registered.startTick - fromTick) / registered.ticksPerSecond;
        if (motion.motionStartTickV133 === undefined || !(preparationSeconds > 0 && Number.isFinite(preparationSeconds))) {
          candidates.push(reject('UNRESOLVED', 'MISSING_AUTHORED_HELD_PREPARATION'));continue;
        }
        const held = motion.sampleContinuous(fromTick).state.pose, arcStart = motion.sampleContinuous(registered.startTick).state.pose;
        preparationTransferCostMps = Math.max(norm(sub(arcStart.grip, held.grip)), norm(sub(arcStart.tip, held.tip))) / preparationSeconds;
        if (!Number.isFinite(preparationTransferCostMps)) {
          candidates.push(reject('UNRESOLVED', 'NONFINITE_PREPARATION_TRANSFER_COST'));continue;
        }
      }
      if (input.prediction.availableTick > fromTick || nominalTick < fromTick) {
        candidates.push(reject('UNRESOLVED', 'PREDICTION_AVAILABLE_AFTER_MOTION_START_OR_CONTACT_PRECEDES_MOTION'));continue;
      }
      if (input.prediction.availableTick < fromTick && registered.executionEnvelopeV133 === undefined) {
        candidates.push(reject('UNRESOLVED', 'MISSING_AUTHORED_HELD_PREFIX'));continue;
      }
      const found = firstPredictedContact(input, motion, input.prediction.availableTick, nominalTick, maximumRadius);
      if (found.status !== 'FOUND') { candidates.push(reject('UNRESOLVED', found.reason));continue; }
      const ball = predictedBall(input, found.atTick), bat = createRigidBatStateFromBatterSwingState(motion.sampleContinuous(found.atTick).state, input.batPhysical),
        response = resolveWoodBatSpeedProfileBallContact(ball, bat, input.ballPhysical, NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);
      if (response === null) { candidates.push(reject('NO_CLOSING_RESPONSE', 'RIGID_RESPONSE_NULL'));continue; }
      if (Math.hypot(response.exitVelocity.x, response.exitVelocity.z) === 0) { candidates.push(reject('UNRESOLVED', 'NO_HORIZONTAL_EXIT_DIRECTION'));continue; }
      const fieldAngleDegrees = Math.atan2(response.exitVelocity.x, response.exitVelocity.z) * 180 / Math.PI,
        residualDegrees = desiredFieldAngleDegrees === null ? null : ((fieldAngleDegrees - desiredFieldAngleDegrees + 540) % 360) - 180,
        contact:PredictedContact = { atTick:found.atTick, contactWindow:{ fromTick:found.fromTick, throughTick:found.throughTick,
          maximumWidthSeconds:CONTACT_TIME_WIDTH_SECONDS }, fieldAngleDegrees,
          surfaceSeparationM:measureRigidBatBallSurfaceSeparation(ball, bat, input.ballPhysical),
          geometry:measureRigidBatBallGeometry(ball, bat, input.ballPhysical), response, searchEvaluations:found.evaluations },
        candidate:Candidate = { yawDegrees, status:'PREDICTED_CONTACT', reason:'FINITE_YAW_PREDICTED_SURFACE_CONTACT', certificates:certificate,
          nominalTargetSweetSpot:target, nominalSurfaceSeparationM:nominalGap, predictedContact:contact, residualDegrees };
      candidates.push({ reference:registered, candidate, preparationTransferCostMps });
    } catch (error) { candidates.push(reject('UNRESOLVED', 'CANDIDATE_CERTIFICATION_FAILED:' + String(error instanceof Error ? error.message : error))); }
  }
  return candidates;
}

/** Finite nominal registration only. Real timing/aim/sweet-spot errors belong
 * to the caller after planning, and this function never changes clock/phase. */
export function planObservedDirectionRegistrationV153(raw:ObservedDirectionRegistrationInputV153) {
  const input = cloneInert(raw);validateInput(input, false);
  const registrations = registrationCandidates(input, input.desiredFieldAngleDegrees), candidates = registrations.map(entry => entry.candidate);
  let selected:RegistrationCandidate|null = null;
  for (const entry of registrations) {
    if (entry.reference === null) continue;
    const { residualDegrees, yawDegrees } = entry.candidate;
    if (selected === null || Math.abs(residualDegrees!) < Math.abs(selected.candidate.residualDegrees!) - 1e-10 ||
      Math.abs(Math.abs(residualDegrees!) - Math.abs(selected.candidate.residualDegrees!)) <= 1e-10 && Math.abs(yawDegrees) < Math.abs(selected.candidate.yawDegrees))
      selected = entry;
  }
  return frozen({ reference:selected?.reference ?? null, diagnostics:{ version:'observed_direction_registration_v153' as const,
    sourceId:'finite-yaw-surface-registration-v153', status:selected ? 'PLANNED' as const :
      candidates.some(candidate => candidate.status === 'UNRESOLVED') ? 'UNRESOLVED' as const : 'NO_FEASIBLE_CANDIDATE' as const,
    modelAssumptions:{ ballFlight:'CONSTANT_ACCELERATION_FROM_OBSERVED_ARRIVAL', unknownSpin:'ZERO_OPERATIONAL_ASSUMPTION',
      materialProfile:NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1.profileId, contact:'EARLIEST_SURFACE_WITHIN_TIME_BOUND',
      surfaceRegistrationInwardMeters:REGISTRATION_INWARD_METERS, phaseChanged:false, errorsApplied:false,
      actualWorldUsed:false, opponentPrivateStateUsed:false, anthropometricFeasibilityCertified:false },
    selectedYawDegrees:selected?.candidate.yawDegrees ?? null, nominalTargetSweetSpot:selected?.candidate.nominalTargetSweetSpot ?? null,
    predictedContact:selected?.candidate.predictedContact ?? null, residualDegrees:selected?.candidate.residualDegrees ?? null, candidates } });
}

/** Direction-free reactive registration. This finite kinematic transfer proxy
 * ranks feasible motions; it is not measured effort or a human reach model. */
export function planObservedReactiveRegistrationV161(raw:ObservedReactiveRegistrationInputV161) {
  const input = cloneInert(raw);validateInput(input, true);
  const registrations = registrationCandidates(input, null), candidates = registrations.map(entry => ({ ...entry.candidate,
    preparationTransferCostMps:entry.preparationTransferCostMps }));
  let selected:RegistrationCandidate|null = null;
  for (const entry of registrations) {
    if (entry.reference === null || entry.preparationTransferCostMps === null) continue;
    if (selected === null || entry.preparationTransferCostMps < selected.preparationTransferCostMps! ||
      entry.preparationTransferCostMps === selected.preparationTransferCostMps && Math.abs(entry.candidate.yawDegrees) < Math.abs(selected.candidate.yawDegrees))
      selected = entry;
  }
  return frozen({ reference:selected?.reference ?? null, diagnostics:{ version:'observed_reactive_registration_v161' as const,
    sourceId:'finite-yaw-reactive-surface-registration-v161', status:selected ? 'PLANNED' as const :
      candidates.some(candidate => candidate.status === 'UNRESOLVED') ? 'UNRESOLVED' as const : 'NO_FEASIBLE_CANDIDATE' as const,
    nominalIntent:'REACTIVE' as const, nominalFieldAngleDegrees:null,
    modelAssumptions:{ ballFlight:'CONSTANT_ACCELERATION_FROM_OBSERVED_ARRIVAL', unknownSpin:'ZERO_OPERATIONAL_ASSUMPTION',
      materialProfile:NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1.profileId, contact:'EARLIEST_SURFACE_WITHIN_TIME_BOUND',
      surfaceRegistrationInwardMeters:REGISTRATION_INWARD_METERS, phaseChanged:false, errorsApplied:false,
      actualWorldUsed:false, opponentPrivateStateUsed:false, anthropometricFeasibilityCertified:false,
      selection:'MINIMUM_MAX_ENDPOINT_PREPARATION_TRANSFER_SPEED', preparationCost:'KINEMATIC_PROXY_NOT_MEASURED_HUMAN_EFFORT' },
    selectedYawDegrees:selected?.candidate.yawDegrees ?? null, nominalTargetSweetSpot:selected?.candidate.nominalTargetSweetSpot ?? null,
    predictedContact:selected?.candidate.predictedContact ?? null, residualDegrees:null,
    selectedPreparationTransferCostMps:selected?.preparationTransferCostMps ?? null, candidates } });
}

export {firstPredictedContact,predictedBall,certificates};
