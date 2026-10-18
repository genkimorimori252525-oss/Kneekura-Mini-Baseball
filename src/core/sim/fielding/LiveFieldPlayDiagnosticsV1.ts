import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import type { BaseballBase } from '../../rules/PhysicalRuleFacts';
import {
  deriveLiveFieldFenceGeometryV1,
  simulateLiveFieldPlayV1,
  type LiveFielderV1,
  type LiveFieldFrameV1,
  type LiveFieldPlayInputV1,
} from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';

export type LiveFieldAnomalyKindV1 =
  | 'UNINTERCEPTED_FALLBACK_TO_PAST'
  | 'ROLE_PING_PONG'
  | 'ORACLE_INFIELD_REACHABLE_LEAKED'
  | 'PREMATURE_BRAKING_MISS'
  | 'WRONG_FIRST_BASE_COVER'
  | 'HELD_BALL_NO_THROW_ON_FORCE'
  | 'THROW_CANCELLED_MIDFLIGHT'
  | 'THROW_HIT_RECEIVER_BODY'
  | 'CAUGHT_THROW_NO_BASE_TOUCH'
  | 'LIVE_PLAY_CLOSED_WITH_ACTIVE_RUNNER'
  | 'LIVE_PLAY_CLOSED_WITH_FREE_BALL'
  | 'UNSUPPORTED_RUNNER_RETIREMENT'
  | 'DUPLICATE_BASE_COVER'
  | 'RUNNER_BASE_TOUCH_LATE'
  | 'FIELDER_BODY_OVERLAP';

export type LiveFieldAnomalyV1 = Readonly<{
  kind: LiveFieldAnomalyKindV1;
  elapsedSeconds: number;
  playerId?: string;
  otherPlayerId?: string;
  distanceMeters?: number;
  playerIntent?: LiveFieldFrameV1['fielders'][number]['intent'];
  otherPlayerIntent?: LiveFieldFrameV1['fielders'][number]['intent'];
  base?: BaseballBase;
  detail: string;
}>;

export type FielderOracleReachV1 = Readonly<{
  playerId: string;
  role: string;
  isInfielder: boolean;
  responseSeconds: number;
  reachable: boolean;
  earliestElapsedSeconds: number | null;
  interceptPoint: Vec3 | null;
  minMarginSeconds: number;
}>;

export type FielderApproachDiagnosticV1 = Readonly<{
  playerId: string;
  role: string;
  wasHandler: boolean;
  closestElapsedSeconds: number;
  minCenterDistanceMeters: number;
  minGloveSurfaceGapMeters: number;
  peakSpeedBeforeClosestMps: number;
  speedAtClosestMps: number;
  gloveExtensionAtClosestMeters: number;
  brakedPrematurely: boolean;
}>;

export type ThrowExchangeDiagnosticV1 = Readonly<{
  releaseElapsedSeconds: number;
  throwerId: string;
  receiverId: string;
  base: BaseballBase;
  forcePlay: boolean;
  relayHop?: boolean;
  cancelledMidFlight: boolean;
  postPassRecovery?: boolean;
  cancelledAtElapsedSeconds: number | null;
  receptionOutcome: 'glove_secured' | 'glove_deflected' | 'body_contact' | 'unfielded';
  receptionElapsedSeconds: number | null;
  secureElapsedSeconds: number | null;
  receiverDistanceToBaseAtReceptionMeters: number | null;
  minGloveGapMeters: number;
  minBodyGapMeters: number;
  closestApproachElapsedSeconds: number | null;
  runnerArrivalElapsedSeconds: number | null;
  baseTouched: boolean;
  baseTouchElapsedSeconds: number | null;
  frozenByTransferBeforeBaseTouch: boolean;
}>;

const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const flat = (a: Vec3): Vec3 => v(a.x, 0, a.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const distance = (a: Vec3, b: Vec3) => norm(sub(a, b));

function kinematicTravelSeconds(runMeters: number, topSpeedMps: number, accelerationMps2: number): number {
  const d = Math.max(0, runMeters);
  const accelDist = topSpeedMps ** 2 / (2 * accelerationMps2);
  return d <= accelDist
    ? Math.sqrt((2 * d) / accelerationMps2)
    : d / topSpeedMps + topSpeedMps / (2 * accelerationMps2);
}

export function diagnoseLiveFieldPlayV1(
  input: LiveFieldPlayInputV1,
  result = simulateLiveFieldPlayV1(input),
  roleMap?: Readonly<Record<string, string>>,
) {
  const start = input.ball.elapsedSeconds;
  const fence = deriveLiveFieldFenceGeometryV1(input.field);
  const radiusM = input.physics.ground.radiusM;
  const roleOf = (playerId: string) => roleMap?.[playerId] ?? playerId;
  const isInfielder = (f: LiveFielderV1) => f.position.z > 0 && f.position.z <= 42;
  const basePoint = (b: number) =>
    b === 1 ? input.field.bases.first : b === 2 ? input.field.bases.second : b === 3 ? input.field.bases.third : input.field.bases.home;

  // 1. Kinematic Oracle on undisturbed batted ball trajectory
  const oracleHorizon = Math.min(input.maxPlaySeconds ?? 35, 7);
  const undisturbed = createSourceFreeBallKernel({
    kind: 'aero_ground_continuous_source_kernel_v2',
    initial: input.ball,
    throughElapsedSeconds: start + oracleHorizon,
    profile: input.physics,
  });
  const firstGroundBoundary = undisturbed.boundaries.find((b) => b.kind === 'ground');
  const firstBounceZ = firstGroundBoundary
    ? undisturbed.evaluateAt(firstGroundBoundary.elapsedSeconds, 'incoming').moment.ball.position.z
    : null;

  const oracleControlSeconds = 0.04;
  const oracleByFielder: FielderOracleReachV1[] = input.fielders.map((f) => {
    const resp = f.reactionSeconds + (f.fieldingCognition?.decisionSeconds ?? 0);
    const activeDelay = resp <= 0 ? 0 : Math.ceil((resp - 1e-12) / oracleControlSeconds) * oracleControlSeconds;
    let earliestElapsedSeconds: number | null = null;
    let interceptPoint: Vec3 | null = null;
    let minMarginSeconds = Infinity;
    const gloveFloor = Math.max(f.gloveRadiusMeters, radiusM);
    for (let dt = 0.04; dt <= oracleHorizon; dt += 0.02) {
      const t = start + dt;
      const sample = undisturbed.evaluateAt(t, 'outgoing').moment.ball;
      const insideFence = distance(flat(sample.position), flat(fence.fenceCenter)) <= fence.fenceRadiusMeters - radiusM;
      const heightReachable = sample.position.y <= f.position.y + f.gloveReachMeters;
      if (!insideFence || !heightReachable) continue;
      const activeTime = dt - activeDelay;
      if (activeTime < 0) continue;
      const dy = f.position.y - Math.max(gloveFloor, sample.position.y);
      const horizReach = Math.sqrt(Math.max(0, f.gloveReachMeters * f.gloveReachMeters - dy * dy)) + f.gloveRadiusMeters * 0.5;
      const runDist = Math.max(0, distance(flat(f.position), flat(sample.position)) - horizReach);
      const travel = kinematicTravelSeconds(runDist, f.topSpeedMps, f.accelerationMps2);
      const margin = travel - activeTime;
      if (margin < minMarginSeconds) minMarginSeconds = margin;
      if (travel <= activeTime && earliestElapsedSeconds === null) {
        earliestElapsedSeconds = t;
        interceptPoint = sample.position;
      }
    }
    return {
      playerId: f.playerId,
      role: roleOf(f.playerId),
      isInfielder: isInfielder(f),
      responseSeconds: resp,
      reachable: earliestElapsedSeconds !== null,
      earliestElapsedSeconds,
      interceptPoint,
      minMarginSeconds,
    };
  });

  const reachableInfielders = oracleByFielder
    .filter((o) => o.isInfielder && o.reachable)
    .sort((a, b) => a.earliestElapsedSeconds! - b.earliestElapsedSeconds!);
  const reachableAll = oracleByFielder
    .filter((o) => o.reachable)
    .sort((a, b) => a.earliestElapsedSeconds! - b.earliestElapsedSeconds!);

  // 2. First possession & Closest Approach Analysis
  const firstCatchFact = result.facts.find((f) => f.kind === 'catch_secured');
  const firstTouchFact = result.facts.find((f) => f.kind === 'glove_contact' || f.kind === 'body_contact');
  const pursuitEnd = firstCatchFact?.elapsedSeconds ?? result.end.elapsedSeconds;
  const telemetry = result.diagnostics.aiTelemetry;

  // Descriptive samples, deliberately not an intelligence/quality score. A
  // long run can be a justified recovery/backup; knowing the actual task and
  // observed threat is necessary before calling it unnecessary movement.
  const fieldingMovement = input.fielders.map(spec => {
    let previous: Vec3 | null = null, sampledTravelMeters = 0, maximumDistanceFromHomeMeters = 0;
    const sampledTravelByIntentMeters: Partial<Record<LiveFieldFrameV1['fielders'][number]['intent'], number>> = {};
    for (const frame of result.frames) {
      const f = frame.fielders.find(actor => actor.playerId === spec.playerId);
      if (!f) continue;
      maximumDistanceFromHomeMeters = Math.max(maximumDistanceFromHomeMeters, distance(flat(f.position), flat(spec.position)));
      if (previous) {
        const traveled = distance(flat(previous), flat(f.position));
        sampledTravelMeters += traveled;
        sampledTravelByIntentMeters[f.intent] = (sampledTravelByIntentMeters[f.intent] ?? 0) + traveled;
      }
      previous = f.position;
    }
    return { playerId: spec.playerId, role: roleOf(spec.playerId), sampledTravelMeters,
      maximumDistanceFromHomeMeters, sampledTravelByIntentMeters };
  });

  // Descriptive Source-frame spacing, separate from continuous motor proofs.
  // Receiving, tagging and backing up may legitimately bring actors close.
  // Only actual body-volume penetration is an anomaly; a three-player group
  // is a metric and never, by itself, evidence of a tactical mistake.
  type PairSpacing = { playerId: string; otherPlayerId: string; elapsedSeconds: number; distanceMeters: number;
    playerIntent: LiveFieldFrameV1['fielders'][number]['intent']; otherPlayerIntent: LiveFieldFrameV1['fielders'][number]['intent'] };
  const pairMinima = new Map<string, PairSpacing>();
  let observedTripleClusterFrameCount = 0, maximumActorsWithinTwoMeters = 0;
  for (const frame of result.frames) {
    let frameMaximum = 0;
    for (let i = 0; i < frame.fielders.length; i++) {
      const actor = frame.fielders[i];
      frameMaximum = Math.max(frameMaximum, frame.fielders.filter(other => distance(flat(actor.position), flat(other.position)) < 2).length);
      for (let j = i + 1; j < frame.fielders.length; j++) {
        const other = frame.fielders[j], key = JSON.stringify([actor.playerId, other.playerId]),
          distanceMeters = distance(flat(actor.position), flat(other.position)), previous = pairMinima.get(key);
        if (!previous || distanceMeters < previous.distanceMeters) pairMinima.set(key, {
          playerId: actor.playerId, otherPlayerId: other.playerId, elapsedSeconds: frame.elapsedSeconds, distanceMeters,
          playerIntent: actor.intent, otherPlayerIntent: other.intent });
      }
    }
    maximumActorsWithinTwoMeters = Math.max(maximumActorsWithinTwoMeters, frameMaximum);
    if (frameMaximum >= 3) observedTripleClusterFrameCount++;
  }
  const spacingPairs = [...pairMinima.values()].sort((a, b) => a.distanceMeters - b.distanceMeters),
    fieldingSpacing = { basis: 'OBSERVED_SOURCE_FRAMES_NOT_CONTINUOUS_COLLISION_PROOF' as const,
      requiredCenterDistanceMeters: result.model.bodyRadiusMeters * 2,
      minimumObservedDistanceMeters: spacingPairs[0]?.distanceMeters ?? null,
      observedTripleClusterFrameCount, maximumActorsWithinTwoMeters, pairs: spacingPairs };

  const handlerIdsBeforeCatch = new Set(
    telemetry.roleTransitions
      .filter((tr) => tr.elapsedSeconds <= pursuitEnd && tr.source !== 'possession' && tr.source !== 'pending_catch')
      .map((tr) => tr.handlerId),
  );

  const approaches: FielderApproachDiagnosticV1[] = input.fielders.map((spec) => {
    let closestElapsedSeconds = start;
    let minCenterDistanceMeters = Infinity;
    let minGloveSurfaceGapMeters = Infinity;
    let peakSpeedBeforeClosestMps = 0;
    let speedAtClosestMps = 0;
    let gloveExtensionAtClosestMeters = 0;

    const pursuitFrames = result.frames.filter((fr) => fr.elapsedSeconds <= pursuitEnd);
    for (const fr of pursuitFrames) {
      const f = fr.fielders.find((x) => x.playerId === spec.playerId)!;
      const dCenter = distance(flat(f.position), flat(fr.ball.position));
      const dGloveGap = distance(f.glove, fr.ball.position) - spec.gloveRadiusMeters - radiusM;
      if (dGloveGap < minGloveSurfaceGapMeters) minGloveSurfaceGapMeters = dGloveGap;
      if (dCenter < minCenterDistanceMeters) {
        minCenterDistanceMeters = dCenter;
        closestElapsedSeconds = fr.elapsedSeconds;
        speedAtClosestMps = norm(f.velocity);
        gloveExtensionAtClosestMeters = distance(f.glove, f.position);
      }
    }
    for (const fr of pursuitFrames) {
      if (fr.elapsedSeconds > closestElapsedSeconds) break;
      const f = fr.fielders.find((x) => x.playerId === spec.playerId)!;
      const spd = norm(f.velocity);
      if (spd > peakSpeedBeforeClosestMps) peakSpeedBeforeClosestMps = spd;
    }
    const wasHandler = handlerIdsBeforeCatch.has(spec.playerId);
    const touchedBall = result.facts.some(
      (ev) => (ev.kind === 'glove_contact' || ev.kind === 'body_contact') && ev.playerId === spec.playerId && ev.elapsedSeconds <= pursuitEnd,
    );
    const brakedPrematurely =
      wasHandler &&
      !touchedBall &&
      minCenterDistanceMeters <= spec.gloveReachMeters + 1.2 &&
      peakSpeedBeforeClosestMps >= 2.0 &&
      speedAtClosestMps < peakSpeedBeforeClosestMps * 0.55;

    return {
      playerId: spec.playerId,
      role: roleOf(spec.playerId),
      wasHandler,
      closestElapsedSeconds,
      minCenterDistanceMeters,
      minGloveSurfaceGapMeters,
      peakSpeedBeforeClosestMps,
      speedAtClosestMps,
      gloveExtensionAtClosestMeters,
      brakedPrematurely,
    };
  });

  // 3. Throw Exchange Analysis
  const releaseFacts = result.facts.filter((f) => f.kind === 'throw_release');
  const throws: ThrowExchangeDiagnosticV1[] = releaseFacts.map((rel, idx) => {
    const nextRelTime = releaseFacts[idx + 1]?.elapsedSeconds ?? Infinity;
    const base = rel.base!;
    const receiverId = rel.receiverPlayerId!;
    const contactsInWindow = telemetry.contactDiagnostics.filter(
      (c) => c.elapsedSeconds > rel.elapsedSeconds && c.elapsedSeconds < nextRelTime && c.playerId === receiverId,
    );
    const firstContact = contactsInWindow[0];
    const recvSpec = input.fielders.find((f) => f.playerId === receiverId)!;
    let minGloveGapMeters = Infinity;
    let minBodyGapMeters = Infinity;
    let closestApproachElapsedSeconds: number | null = null;
    let closestDistToBag: number | null = null;
    for (const fr of result.frames) {
      if (fr.elapsedSeconds < rel.elapsedSeconds || fr.elapsedSeconds > (firstContact?.elapsedSeconds ?? nextRelTime)) continue;
      const rf = fr.fielders.find((f) => f.playerId === receiverId);
      if (!rf) continue;
      const gGap = distance(rf.glove, fr.ball.position) - recvSpec.gloveRadiusMeters - radiusM;
      const bGap = distance(rf.position, fr.ball.position) - 0.24 - radiusM;
      if (gGap < minGloveGapMeters) {
        minGloveGapMeters = gGap;
        closestApproachElapsedSeconds = fr.elapsedSeconds;
        closestDistToBag = distance(flat(rf.position), flat(basePoint(base)));
      }
      if (bGap < minBodyGapMeters) minBodyGapMeters = bGap;
    }
    const flightEndTime = firstContact?.elapsedSeconds ?? (closestApproachElapsedSeconds !== null ? closestApproachElapsedSeconds + 0.06 : nextRelTime);
    const cancelEvent = telemetry.throwTargetCancellations.find(
      (c) => c.elapsedSeconds >= rel.elapsedSeconds && c.elapsedSeconds < flightEndTime - 1e-6 && c.base === base,
    );
    const observedFrame = cancelEvent ? result.frames.filter(fr => fr.elapsedSeconds <= cancelEvent.seenAt).at(-1) : null,
      target = rel.target ?? basePoint(base);
    let observedBall: { position: Vec3; velocity: Vec3 } | undefined = observedFrame?.ball;
    const actualLaunch = result.diagnostics.throwDirectionCommands.find(c => c.elapsedSeconds === rel.elapsedSeconds)?.actual;
    // A 55ms frame can straddle closest approach. If no intervening contact
    // changed the free ball, reconstruct this historical observation from the
    // actual issued launch rather than accepting a future frame or assuming
    // that every later target release was premature.
    if (cancelEvent && cancelEvent.seenAt > rel.elapsedSeconds && actualLaunch && rel.position
      && !result.facts.some(f => f.elapsedSeconds > rel.elapsedSeconds && f.elapsedSeconds <= cancelEvent.seenAt
        && ['ground_contact', 'glove_contact', 'body_contact', 'wall_support', 'over_fence'].includes(f.kind))) {
      const historical = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
        initial: { originTick: input.ball.originTick, elapsedSeconds: rel.elapsedSeconds,
          ball: { tick: rel.tick, position: rel.position, velocity: actualLaunch.velocity, spin: actualLaunch.spin } },
        throughElapsedSeconds: cancelEvent.seenAt, profile: input.physics });
      if (!historical.boundaries.length) {
        const actual = historical.evaluateAt(cancelEvent.seenAt, 'outgoing').moment.ball;
        observedBall = { position: actual.position, velocity: actual.velocity };
      }
    }
    const postPassRecovery = !!cancelEvent && cancelEvent.seenAt >= rel.elapsedSeconds && !!observedFrame
        && observedFrame.elapsedSeconds >= rel.elapsedSeconds && !!observedBall
        && (target.x - observedBall.position.x) * observedBall.velocity.x + (target.z - observedBall.position.z) * observedBall.velocity.z < 0
        && distance(flat(observedBall.position), flat(target)) > recvSpec.gloveReachMeters,
      cancelledMidFlight = !!cancelEvent && !postPassRecovery;
    const secureInWindow = result.facts.find(
      (f) => f.kind === 'catch_secured' && f.elapsedSeconds > rel.elapsedSeconds && f.elapsedSeconds < nextRelTime && f.playerId === receiverId,
    );
    const receptionOutcome: ThrowExchangeDiagnosticV1['receptionOutcome'] = !firstContact
      ? 'unfielded'
      : firstContact.role === 'body'
        ? 'body_contact'
        : firstContact.retention?.outcome === 'secured'
          ? 'glove_secured'
          : 'glove_deflected';

    const runnerTouch = result.facts.find((f) => f.kind === 'runner_base_touch' && f.base === base);
    const baseContact = result.facts.find(
      (f) => f.kind === 'controlled_base_contact' && f.playerId === receiverId && f.base === base && f.elapsedSeconds >= rel.elapsedSeconds,
    );
    const waitedTransfer = telemetry.holderDecisions.some(
      (d) =>
        d.playerId === receiverId &&
        d.state === 'waiting_transfer' &&
        d.elapsedSeconds >= (secureInWindow?.elapsedSeconds ?? Infinity) &&
        d.elapsedSeconds <= (runnerTouch?.elapsedSeconds ?? Infinity),
    );
    const runnerArrivalElapsedSeconds = runnerTouch?.elapsedSeconds ?? null;
    const secureElapsedSeconds = secureInWindow?.elapsedSeconds ?? null;
    const caughtBeforeRunner =
      secureElapsedSeconds !== null && (runnerArrivalElapsedSeconds === null || secureElapsedSeconds < runnerArrivalElapsedSeconds - 0.02);

    return {
      releaseElapsedSeconds: rel.elapsedSeconds,
      throwerId: rel.playerId!,
      receiverId,
      base,
      forcePlay: rel.reason === 'force_play' || rel.reason === undefined,
      relayHop: rel.reason === 'relay_play',
      cancelledMidFlight,
      postPassRecovery,
      cancelledAtElapsedSeconds: cancelEvent?.elapsedSeconds ?? null,
      receptionOutcome,
      receptionElapsedSeconds: firstContact?.elapsedSeconds ?? null,
      secureElapsedSeconds,
      receiverDistanceToBaseAtReceptionMeters: firstContact?.distanceToTargetBaseMeters ?? closestDistToBag,
      minGloveGapMeters,
      minBodyGapMeters,
      closestApproachElapsedSeconds,
      runnerArrivalElapsedSeconds,
      baseTouched: !!baseContact,
      baseTouchElapsedSeconds: baseContact?.elapsedSeconds ?? null,
      frozenByTransferBeforeBaseTouch: rel.reason !== 'relay_play' && caughtBeforeRunner && !baseContact && waitedTransfer,
    };
  });

  // 4. Anomaly Detection
  const anomalies: LiveFieldAnomalyV1[] = [];
  for (const pair of spacingPairs) if (pair.distanceMeters < fieldingSpacing.requiredCenterDistanceMeters)
    anomalies.push({ kind: 'FIELDER_BODY_OVERLAP', ...pair,
      detail: `${roleOf(pair.playerId)} (${pair.playerIntent}) and ${roleOf(pair.otherPlayerId)} (${pair.otherPlayerIntent}) body centers overlap: ${pair.distanceMeters.toFixed(3)}m < ${fieldingSpacing.requiredCenterDistanceMeters.toFixed(3)}m.` });

  // These are observation/fact consistency checks, not an independent full
  // baseball umpire. In particular, a controlled tag/catch is accepted as an
  // input fact; its collision/retention proof remains the world's concern.
  const finalFrame = result.frames.at(-1);
  if (result.end.reason === 'live_action_complete' && result.end.complete && finalFrame) {
    for (const r of finalFrame.runners) if (!r.retired && !r.scored && (r.targetBase !== null || norm(r.velocity) > .1))
      anomalies.push({ kind: 'LIVE_PLAY_CLOSED_WITH_ACTIVE_RUNNER', elapsedSeconds: result.end.elapsedSeconds,
        playerId: r.runnerId, detail: `Live play closed while runner ${r.runnerId} still had target ${r.targetBase ?? 'none'} and speed ${norm(r.velocity).toFixed(2)}m/s.` });
    if (finalFrame.ball.possessedBy === null)
      anomalies.push({ kind: 'LIVE_PLAY_CLOSED_WITH_FREE_BALL', elapsedSeconds: result.end.elapsedSeconds,
        detail: `Live play closed without observed custody (ball phase=${finalFrame.ball.phase}).` });
  }

  const duplicateCovers = new Set<number>();
  for (const frame of result.frames) for (const base of [1, 2, 3, 4] as const) {
    const cover = frame.fielders.filter(f => f.intent === 'base_cover' && f.targetBase === base);
    if (cover.length > 1 && !duplicateCovers.has(base)) {
      duplicateCovers.add(base);
      anomalies.push({ kind: 'DUPLICATE_BASE_COVER', elapsedSeconds: frame.elapsedSeconds, base,
        detail: `${cover.map(f => roleOf(f.playerId)).join(', ')} simultaneously own base-cover task ${base}. Nearby distinct intercept/relay/backup tasks alone are not an anomaly.` });
    }
  }

  // Rebuild only the currently supported retirement causes directly from the
  // facts, without calling the production ForceObligation helper. A runner's
  // first legal target touch removes that force. For indistinguishable same-
  // tick occurrences, touch precedes bag control so uncertainty cannot invent
  // a late force out. This does not audit appeals, retreat or interference.
  const supportedRetirements = new Set<string>(), forceSatisfied = new Set<string>();
  const forcedTarget = (runnerId: string) => {
    const spec = input.runners.find(r => r.runnerId === runnerId);
    if (!spec || supportedRetirements.has(runnerId) || forceSatisfied.has(runnerId)) return null;
    for (let b = 0; b < spec.initialBase; b++) {
      const trailing = input.runners.find(r => r.initialBase === b);
      if (!trailing || supportedRetirements.has(trailing.runnerId)) return null;
    }
    return spec.initialBase + 1;
  };
  const priority = (kind: string) => kind === 'runner_base_touch' ? 0 : kind === 'catch_secured' ? 1 : kind === 'controlled_runner_tag' ? 2 : 3;
  const orderedFacts = result.facts.slice().sort((a, b) => a.tick - b.tick || priority(a.kind) - priority(b.kind) || a.elapsedSeconds - b.elapsedSeconds);
  for (const fact of orderedFacts) {
    if (fact.kind === 'runner_base_touch' && fact.runnerId && forcedTarget(fact.runnerId) === fact.base) forceSatisfied.add(fact.runnerId);
    else if (fact.kind === 'catch_secured' && result.ruleFacts.flyCatch?.secureCatchTick === fact.tick
      && result.ruleFacts.flyCatch.fielderId === fact.playerId) {
      const batter = input.runners.find(r => r.initialBase === 0);
      if (batter) supportedRetirements.add(batter.runnerId);
    } else if (fact.kind === 'controlled_runner_tag' && fact.runnerId) supportedRetirements.add(fact.runnerId);
    else if (fact.kind === 'controlled_base_contact') {
      for (const r of input.runners) if (forcedTarget(r.runnerId) === fact.base) supportedRetirements.add(r.runnerId);
    }
  }
  for (const r of result.finalRunners) if (r.retired && !supportedRetirements.has(r.runnerId))
    anomalies.push({ kind: 'UNSUPPORTED_RUNNER_RETIREMENT', elapsedSeconds: result.end.elapsedSeconds, playerId: r.runnerId,
      detail: `Retirement of ${r.runnerId} has no supported fly catch, still-active force bag control, or controlled tag in the emitted fact sequence. This is a fact-consistency finding, not a full-rules oracle.` });

  // A sampled point already inside the declared bag volume is a real bounded
  // witness even though frames cannot locate the exact entry between samples.
  // Restrict to the immediate next base to avoid mistaking the starting home
  // position for a later scoring arrival. No extrapolated/future motor sample.
  for (const touch of result.facts.filter(f => f.kind === 'runner_base_touch' && f.runnerId && f.base)) {
    const witness = result.frames.find(frame => frame.tick < touch.tick && frame.elapsedSeconds < touch.elapsedSeconds
      && frame.runners.some(r => r.runnerId === touch.runnerId && !r.retired && !r.scored && r.currentBase === touch.base! - 1
        && distance(flat(r.position), flat(basePoint(touch.base!))) <= (input.field.baseTouchRadiusMeters ?? .28)));
    if (witness) anomalies.push({ kind: 'RUNNER_BASE_TOUCH_LATE', elapsedSeconds: witness.elapsedSeconds,
      playerId: touch.runnerId, base: touch.base,
      detail: `${touch.runnerId} was observed inside base ${touch.base}'s declared touch volume ${(touch.elapsedSeconds - witness.elapsedSeconds).toFixed(4)}s before its official touch fact. Frame evidence bounds the discrepancy; it does not resolve exact foot contact.` });
  }

  // Anomaly 1: Unintercepted fallback to past position
  const fallbackTransition = telemetry.roleTransitions.find(
    (tr) =>
      tr.intercepted === false &&
      tr.targetPoint &&
      tr.observedPosition &&
      distance(tr.targetPoint, tr.observedPosition) < 1e-6 &&
      tr.elapsedSeconds <= start + 0.5,
  );
  if (fallbackTransition && norm(input.ball.ball.velocity) > 8) {
    anomalies.push({
      kind: 'UNINTERCEPTED_FALLBACK_TO_PAST',
      elapsedSeconds: fallbackTransition.elapsedSeconds,
      playerId: fallbackTransition.handlerId,
      detail: `Handler ${roleOf(fallbackTransition.handlerId)} fell back to past observed ball position (${fallbackTransition.observedPosition!.x.toFixed(1)}, ${fallbackTransition.observedPosition!.z.toFixed(1)}) because forecast found no in-fence intercept.`,
    });
  }

  // Anomaly 2: Role ping-pong before first touch
  const preTouchTransitions = telemetry.roleTransitions.filter(
    (tr) =>
      tr.elapsedSeconds <= (firstTouchFact?.elapsedSeconds ?? result.end.elapsedSeconds) &&
      (tr.source === 'forecast_best' || tr.source === 'forecast_retained' || tr.source === 'fallback_first'),
  );
  if (preTouchTransitions.length >= 4) {
    const chain = preTouchTransitions.map((t) => `${roleOf(t.handlerId)}@${(t.elapsedSeconds - start).toFixed(2)}s`).join(' -> ');
    anomalies.push({
      kind: 'ROLE_PING_PONG',
      elapsedSeconds: preTouchTransitions[0].elapsedSeconds,
      detail: `Intercept handler switched ${preTouchTransitions.length} times before first touch: ${chain}`,
    });
  }

  // Anomaly 3: Oracle infield-reachable grounder leaked to outfield
  const firstCatchFielder = input.fielders.find((f) => f.playerId === firstCatchFact?.playerId);
  const infieldTouched = result.facts.some((ev) => {
    if (ev.kind !== 'glove_contact' && ev.kind !== 'body_contact') return false;
    const spec = input.fielders.find((f) => f.playerId === ev.playerId);
    return spec ? isInfielder(spec) : false;
  });
  if (
    result.ruleFacts.territory === 'fair' &&
    firstBounceZ !== null &&
    firstBounceZ < 38 &&
    reachableInfielders.length > 0 &&
    !infieldTouched &&
    (!firstCatchFielder || !isInfielder(firstCatchFielder))
  ) {
    const bestInf = reachableInfielders[0];
    anomalies.push({
      kind: 'ORACLE_INFIELD_REACHABLE_LEAKED',
      elapsedSeconds: bestInf.earliestElapsedSeconds!,
      playerId: bestInf.playerId,
      detail: `Infielder ${bestInf.role} could physically intercept at t+${(bestInf.earliestElapsedSeconds! - start).toFixed(2)}s (z=${bestInf.interceptPoint!.z.toFixed(1)}m), but ball leaked untouched to outfield (${firstCatchFielder ? roleOf(firstCatchFielder.playerId) : 'none'}).`,
    });
  }

  // Anomaly 4: Premature braking miss (exclude over-fence home runs where wall safety brakes the fielder)
  if (!result.ruleFacts.overFence) {
    for (const app of approaches) {
      if (app.brakedPrematurely) {
        anomalies.push({
          kind: 'PREMATURE_BRAKING_MISS',
          elapsedSeconds: app.closestElapsedSeconds,
          playerId: app.playerId,
          detail: `Handler ${app.role} braked from ${app.peakSpeedBeforeClosestMps.toFixed(1)} m/s down to ${app.speedAtClosestMps.toFixed(1)} m/s before ball passed at center dist ${app.minCenterDistanceMeters.toFixed(2)}m (glove gap ${app.minGloveSurfaceGapMeters.toFixed(2)}m).`,
        });
      }
    }
  }

  // Anomaly 5, 6, 7: Throw anomalies
  for (const th of throws) {
    if (th.cancelledMidFlight) {
      anomalies.push({
        kind: 'THROW_CANCELLED_MIDFLIGHT',
        elapsedSeconds: th.releaseElapsedSeconds,
        playerId: th.receiverId,
        base: th.base,
        detail: `Throw from ${roleOf(th.throwerId)} to base ${th.base} (${roleOf(th.receiverId)}) had throwTarget cancelled before a sampled post-release ball-passed-target observation.`,
      });
    }
    if (th.receptionOutcome === 'body_contact') {
      anomalies.push({
        kind: 'THROW_HIT_RECEIVER_BODY',
        elapsedSeconds: th.receptionElapsedSeconds ?? th.releaseElapsedSeconds,
        playerId: th.receiverId,
        base: th.base,
        detail: `Throw from ${roleOf(th.throwerId)} to base ${th.base} hit receiver ${roleOf(th.receiverId)}'s body collider instead of glove.`,
      });
    }
    if (
      th.forcePlay &&
      th.receptionOutcome === 'glove_secured' &&
      !th.baseTouched &&
      th.secureElapsedSeconds !== null &&
      (th.runnerArrivalElapsedSeconds === null || th.secureElapsedSeconds < th.runnerArrivalElapsedSeconds - 0.04)
    ) {
      anomalies.push({
        kind: 'CAUGHT_THROW_NO_BASE_TOUCH',
        elapsedSeconds: th.secureElapsedSeconds,
        playerId: th.receiverId,
        base: th.base,
        detail: `Receiver ${roleOf(th.receiverId)} secured throw at base ${th.base} ${(th.runnerArrivalElapsedSeconds! - th.secureElapsedSeconds).toFixed(2)}s before runner arrival (dist=${(th.receiverDistanceToBaseAtReceptionMeters ?? 0).toFixed(2)}m), but never touched the base.`,
      });
    }
  }

  // Anomaly 8: Wrong 1B base cover (e.g., 1B assigned hold/backup while 2B/C runs across diamond to cover 1st)
  const firstFrameAfterReaction = result.frames.find((fr) => fr.elapsedSeconds >= start + 0.35 && fr.elapsedSeconds <= pursuitEnd);
  if (firstFrameAfterReaction && !result.ruleFacts.flyCatch) {
    const cover1 = firstFrameAfterReaction.fielders.find((f) => f.intent === 'base_cover' && f.targetBase === 1);
    const closestTo1B = input.fielders
      .slice()
      .sort((a, b) => distance(flat(a.position), flat(input.field.bases.first)) - distance(flat(b.position), flat(input.field.bases.first)))[0];
    const closestState = firstFrameAfterReaction.fielders.find((f) => f.playerId === closestTo1B.playerId);
    if (
      cover1 &&
      closestState &&
      cover1.playerId !== closestTo1B.playerId &&
      closestState.intent !== 'intercept' &&
      distance(flat(closestTo1B.position), flat(input.field.bases.first)) + 4.0 <
        distance(
          flat(input.fielders.find((f) => f.playerId === cover1.playerId)!.position),
          flat(input.field.bases.first),
        )
    ) {
      anomalies.push({
        kind: 'WRONG_FIRST_BASE_COVER',
        elapsedSeconds: firstFrameAfterReaction.elapsedSeconds,
        playerId: cover1.playerId,
        base: 1,
        detail: `${roleOf(cover1.playerId)} was assigned to cover 1st base while ${roleOf(closestTo1B.playerId)} (closest to 1B) was assigned '${closestState.intent}'!`,
      });
    }
  }

  // Anomaly 9: Held ball with no throw on force play when caught well before runner arrival
  const firstRunnerTouch1 = result.facts.find((f) => f.kind === 'runner_base_touch' && f.base === 1);
  if (
    firstCatchFact &&
    !result.ruleFacts.flyCatch &&
    releaseFacts.length === 0 &&
    result.ruleFacts.controlledBaseContacts.length === 0 &&
    firstRunnerTouch1 &&
    firstCatchFact.elapsedSeconds < firstRunnerTouch1.elapsedSeconds
  ) {
    const holdDec = telemetry.holderDecisions.find((d) => (d.state === 'hold_no_positive_margin' || d.state === 'pursue_tag')
      && d.base === 1 && d.elapsedSeconds >= firstCatchFact.elapsedSeconds && d.elapsedSeconds < firstRunnerTouch1.elapsedSeconds);
    const rejectedByFlight = result.diagnostics.throwDecisions.some((d) => d.reason === 'aero_throw_arrives_after_runner');
    // Infinity now also means the bounded Aero route planner explicitly found
    // no positive throw/carry margin. Retaining custody in that state is not a
    // missed throw opportunity. A contradictory positive holder margin still
    // triggers the diagnostic independently of this route explanation.
    const routeDeclinedForMargin = telemetry.relayPlans.some(p => p.playerId === firstCatchFact.playerId
      && p.base === holdDec?.base && p.kind === 'hold' && p.marginSeconds <= 0
      && p.elapsedSeconds >= firstCatchFact.elapsedSeconds && p.elapsedSeconds <= (holdDec?.elapsedSeconds ?? -Infinity));
    if (
      !rejectedByFlight &&
      ((holdDec?.margin !== undefined && holdDec.margin > 0.15) || holdDec?.receivingSeconds === Infinity && !routeDeclinedForMargin)
    ) {
      anomalies.push({
        kind: 'HELD_BALL_NO_THROW_ON_FORCE',
        elapsedSeconds: firstCatchFact.elapsedSeconds,
        playerId: firstCatchFact.playerId,
        base: 1,
        detail: `${roleOf(firstCatchFact.playerId!)} secured ball ${(firstRunnerTouch1.elapsedSeconds - firstCatchFact.elapsedSeconds).toFixed(2)}s before runner reached 1B, but never threw or touched a base (decision=${holdDec?.state ?? 'none'}, margin=${holdDec?.margin?.toFixed(2) ?? 'n/a'}s, recvSec=${holdDec?.receivingSeconds?.toFixed(2) ?? 'n/a'}s).`,
      });
    }
  }

  return Object.freeze({
    startElapsedSeconds: start,
    end: result.end,
    territory: result.ruleFacts.territory,
    firstBounceZ,
    outsRecorded: result.finalRunners.filter((r) => r.retired).length,
    firstTouchPlayerId: firstTouchFact?.playerId ?? null,
    firstTouchRole: firstTouchFact?.playerId ? roleOf(firstTouchFact.playerId) : null,
    firstCatchPlayerId: firstCatchFact?.playerId ?? null,
    firstCatchRole: firstCatchFact?.playerId ? roleOf(firstCatchFact.playerId) : null,
    oracle: Object.freeze({
      infieldReachable: reachableInfielders.length > 0,
      earliestInfielder: reachableInfielders[0] ?? null,
      earliestFielder: reachableAll[0] ?? null,
      byFielder: oracleByFielder,
    }),
    approaches,
    throws,
    anomalies,
    fieldingMovement,
    fieldingSpacing,
    telemetry,
  });
}

export function formatLiveFieldPlayDiagnosticReportV1(diag: ReturnType<typeof diagnoseLiveFieldPlayV1>, label = 'Play'): string {
  const t0 = diag.startElapsedSeconds;
  const rel = (t: number | null | undefined) => (t == null ? 'n/a' : `+${(t - t0).toFixed(2)}s`);
  const lines: string[] = [
    `=== [${label}] territory=${diag.territory} outs=${diag.outsRecorded} firstBounceZ=${diag.firstBounceZ?.toFixed(1) ?? 'air'}m firstCatch=${diag.firstCatchRole ?? 'NONE'} ===`,
    `  Oracle: infieldReachable=${diag.oracle.infieldReachable} earliestInfielder=${diag.oracle.earliestInfielder ? `${diag.oracle.earliestInfielder.role}@${rel(diag.oracle.earliestInfielder.earliestElapsedSeconds)}` : 'none'} earliestAny=${diag.oracle.earliestFielder ? `${diag.oracle.earliestFielder.role}@${rel(diag.oracle.earliestFielder.earliestElapsedSeconds)}` : 'none'}`,
    `  ObservedSpacing: min=${diag.fieldingSpacing.minimumObservedDistanceMeters?.toFixed(3) ?? 'n/a'}m bodyDiameter=${diag.fieldingSpacing.requiredCenterDistanceMeters.toFixed(3)}m tripleClusterFrames=${diag.fieldingSpacing.observedTripleClusterFrameCount} (samples, not continuous proof)`,
  ];
  const handlers = diag.approaches.filter((a) => a.wasHandler || a.minCenterDistanceMeters < 3.5);
  if (handlers.length > 0) {
    lines.push(
      `  Approaches: ` +
        handlers
          .map(
            (a) =>
              `${a.role}(minDist=${a.minCenterDistanceMeters.toFixed(2)}m, gloveGap=${a.minGloveSurfaceGapMeters.toFixed(2)}m@${rel(a.closestElapsedSeconds)}, spd=${a.peakSpeedBeforeClosestMps.toFixed(1)}->${a.speedAtClosestMps.toFixed(1)}m/s${a.brakedPrematurely ? ' [BRAKED]' : ''})`,
          )
          .join(', '),
    );
  }
  const nonWaitDecisions = diag.telemetry.holderDecisions.filter((d) => d.state !== 'waiting_transfer');
  if (nonWaitDecisions.length > 0) {
    const firstDec = nonWaitDecisions[0];
    lines.push(
      `  HolderDecision @${rel(firstDec.elapsedSeconds)}: state=${firstDec.state} base=${firstDec.base ?? 'none'} margin=${firstDec.margin?.toFixed(2) ?? 'n/a'}s recvSec=${firstDec.receivingSeconds?.toFixed(2) ?? 'n/a'}s carrySec=${firstDec.carrySeconds?.toFixed(2) ?? 'n/a'}s`,
    );
  }
  for (const th of diag.throws) {
    lines.push(
      `  Throw -> Base ${th.base}: ${th.throwerId} -> ${th.receiverId} play=${th.relayHop ? 'relay' : th.forcePlay ? 'force' : 'tag'} rel=${rel(th.releaseElapsedSeconds)} outcome=${th.receptionOutcome} sec=${rel(th.secureElapsedSeconds)} runner=${rel(th.runnerArrivalElapsedSeconds)} distToBag=${th.receiverDistanceToBaseAtReceptionMeters?.toFixed(2) ?? 'n/a'}m minGloveGap=${th.minGloveGapMeters.toFixed(3)}m@${rel(th.closestApproachElapsedSeconds)} minBodyGap=${th.minBodyGapMeters.toFixed(3)}m cancelAt=${rel(th.cancelledAtElapsedSeconds)} baseTouched=${th.baseTouched}${th.frozenByTransferBeforeBaseTouch ? ' [FROZEN_BY_TRANSFER]' : ''}`,
    );
  }
  if (diag.anomalies.length > 0) {
    for (const a of diag.anomalies) {
      lines.push(`  [ANOMALY:${a.kind}] @${rel(a.elapsedSeconds)}: ${a.detail}`);
    }
  } else {
    lines.push(`  [OK] No anomalies detected.`);
  }
  return lines.join('\n');
}

export type CanonicalScenarioSpecV1 = Readonly<{
  id: string;
  category: 'infield_grounder' | 'slow_roller' | 'double_play' | 'outfield_fly' | 'wall_or_gap';
  description: string;
  ballPosition: Vec3;
  ballVelocity: Vec3;
  ballSpin?: Vec3;
  runners?: readonly (0 | 1 | 2 | 3)[];
  outs?: 0 | 1 | 2;
  expectedMinOutsWithCompetentAI: number;
}>;

export const CANONICAL_FIELDING_SCENARIOS_V1: readonly CanonicalScenarioSpecV1[] = Object.freeze([
  { id: 'P_comebacker', category: 'infield_grounder', description: 'Pitcher comebacker grounder', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(0.5, -1.8, 22), expectedMinOutsWithCompetentAI: 1 },
  { id: '3B_routine', category: 'infield_grounder', description: 'Routine grounder to 3B', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(-14.5, -2.0, 22), expectedMinOutsWithCompetentAI: 1 },
  { id: '56_hole_grounder', category: 'infield_grounder', description: 'Grounder in the 5-6 hole (3B/SS)', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(-11.5, -1.6, 26), expectedMinOutsWithCompetentAI: 1 },
  { id: 'SS_routine', category: 'infield_grounder', description: 'Routine grounder to SS', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(-8.5, -1.8, 26), expectedMinOutsWithCompetentAI: 1 },
  { id: 'SS_up_middle', category: 'infield_grounder', description: 'Grounder up the middle (SS side)', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(-3.2, -1.5, 25), expectedMinOutsWithCompetentAI: 1 },
  { id: '2B_routine', category: 'infield_grounder', description: 'Routine grounder to 2B', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(8.5, -1.8, 26), expectedMinOutsWithCompetentAI: 1 },
  { id: '34_hole_grounder', category: 'infield_grounder', description: 'Grounder in the 3-4 hole (1B/2B)', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(12.0, -1.7, 25), expectedMinOutsWithCompetentAI: 1 },
  { id: '1B_routine', category: 'infield_grounder', description: 'Routine grounder to 1B', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(15.0, -2.0, 21), expectedMinOutsWithCompetentAI: 1 },
  { id: 'slow_roller_3B', category: 'slow_roller', description: 'Slow roller down 3B line', ballPosition: v(0, 0.3, 0.3), ballVelocity: v(-6.0, -1.0, 12), expectedMinOutsWithCompetentAI: 1 },
  { id: 'slow_roller_2B', category: 'slow_roller', description: 'Slow roller toward 2B', ballPosition: v(0, 0.3, 0.3), ballVelocity: v(5.0, -1.0, 14), expectedMinOutsWithCompetentAI: 1 },
  { id: 'DP_643_grounder', category: 'double_play', description: 'Runner on 1st, grounder to SS', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(-8.0, -2.0, 27), runners: [0, 1], expectedMinOutsWithCompetentAI: 1 },
  { id: 'DP_463_grounder', category: 'double_play', description: 'Runner on 1st, grounder to 2B', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(8.0, -2.0, 27), runners: [0, 1], expectedMinOutsWithCompetentAI: 1 },
  { id: 'force_3B_grounder', category: 'double_play', description: 'Runners on 1st & 2nd, grounder to 3B', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(-14.0, -2.0, 22), runners: [0, 1, 2], expectedMinOutsWithCompetentAI: 1 },
  { id: 'routine_CF_fly', category: 'outfield_fly', description: 'Routine fly ball to CF', ballPosition: v(0, 0.9, 0.3), ballVelocity: v(0, 24, 31), ballSpin: v(-140, 0, 0), expectedMinOutsWithCompetentAI: 1 },
  { id: 'routine_LF_fly', category: 'outfield_fly', description: 'Routine fly ball to LF', ballPosition: v(0, 0.9, 0.3), ballVelocity: v(-13, 21, 24), ballSpin: v(-130, -40, 0), expectedMinOutsWithCompetentAI: 1 },
  { id: 'routine_RF_fly', category: 'outfield_fly', description: 'Routine fly ball to RF', ballPosition: v(0, 0.9, 0.3), ballVelocity: v(13, 21, 24), ballSpin: v(-130, 40, 0), expectedMinOutsWithCompetentAI: 1 },
  { id: 'shallow_CF_liner', category: 'outfield_fly', description: 'Sinking line drive in front of CF', ballPosition: v(0, 0.9, 0.3), ballVelocity: v(2, 13, 30), ballSpin: v(-80, 0, 0), expectedMinOutsWithCompetentAI: 0 },
  { id: 'fast_grounder_CF_wall', category: 'wall_or_gap', description: 'Hard grounder through middle toward CF fence', ballPosition: v(0, 0.4, 0.3), ballVelocity: v(-20.45, 0.08, 43.06), ballSpin: v(223, -364, 149), expectedMinOutsWithCompetentAI: 0 },
  { id: 'gap_liner_LCF', category: 'wall_or_gap', description: 'Hard drive into left-center gap', ballPosition: v(0, 0.8, 0.3), ballVelocity: v(-14, 14, 38), ballSpin: v(-120, -30, 0), expectedMinOutsWithCompetentAI: 0 },
  { id: 'one_hop_RF_wall', category: 'wall_or_gap', description: 'Deep one-hop drive to RF wall', ballPosition: v(0, 0.8, 0.3), ballVelocity: v(17, 13, 30), ballSpin: v(-110, 40, 0), expectedMinOutsWithCompetentAI: 0 },
]);

export type AbilityTierV1 = 'low' | 'default' | 'high';

export function buildCanonicalFieldingPlayInputV1(
  scenario: CanonicalScenarioSpecV1,
  tier: AbilityTierV1 = 'default',
): { input: LiveFieldPlayInputV1; roleMap: Readonly<Record<string, string>> } {
  const tps = 1_000_000;
  const originTick = 1_000_000;
  const elapsedSeconds = 0.4;
  const baseSide = 27.432 / Math.SQRT2;
  const placements: Readonly<Record<string, Vec3>> = {
    P: v(0, 0.9, 18.44),
    C: v(0, 0.85, -1.5),
    '1B': v(23, 0.9, 25),
    '2B': v(13, 0.9, 36),
    '3B': v(-23, 0.9, 25),
    SS: v(-13, 0.9, 36),
    LF: v(-46, 0.9, 76),
    CF: v(0, 0.9, 91),
    RF: v(46, 0.9, 76),
  };
  const tierSpec =
    tier === 'low'
      ? { reactionSeconds: 0.23, decisionSeconds: 0.09, topSpeedMps: 7.3, accelerationMps2: 4.7, gloveSpeedMps: 9.5, gloveReachMeters: 1.26, transferSeconds: 0.52, throwSpeedMps: 31, throwDirectionStdRadians: 0.022, retentionCapacityJ: 130 }
      : tier === 'high'
        ? { reactionSeconds: 0.14, decisionSeconds: 0.01, topSpeedMps: 8.7, accelerationMps2: 6.0, gloveSpeedMps: 13.0, gloveReachMeters: 1.44, transferSeconds: 0.34, throwSpeedMps: 38, throwDirectionStdRadians: 0.004, retentionCapacityJ: 205 }
        : { reactionSeconds: 0.18, decisionSeconds: 0.04, topSpeedMps: 8.0, accelerationMps2: 5.2, gloveSpeedMps: 11.0, gloveReachMeters: 1.35, transferSeconds: 0.44, throwSpeedMps: 34, throwDirectionStdRadians: 0.011, retentionCapacityJ: 160 };

  const roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
  const roleMap: Record<string, string> = {};
  const fielders: LiveFielderV1[] = roles.map((role, idx) => {
    const playerId = `def-${role}`;
    roleMap[playerId] = role;
    // Slight deterministic per-position offset so players aren't identical clones when testing staggered reaction
    const stagger = (idx % 3) * 0.012;
    return {
      playerId,
      defensivePosition: role,
      position: placements[role],
      reactionSeconds: tierSpec.reactionSeconds + stagger,
      fieldingCognition: { decisionSeconds: tierSpec.decisionSeconds },
      topSpeedMps: tierSpec.topSpeedMps,
      accelerationMps2: tierSpec.accelerationMps2,
      gloveSpeedMps: tierSpec.gloveSpeedMps,
      gloveReachMeters: tierSpec.gloveReachMeters,
      gloveRadiusMeters: 0.11,
      catchRetention: {
        ticksPerSecond: tps,
        ballMassKg: 0.145,
        ballRadiusMeters: 0.0366,
        pocketRadiusMeters: 0.14,
        centerRetentionCapacityJ: tierSpec.retentionCapacityJ,
        captureDissipationPowerW: 3000,
        failedContactRestitution: 0.2,
        failedTangentialDamping: 0.35,
        failedSpinDamping: 0.2,
      },
      transferSeconds: tierSpec.transferSeconds,
      throwSpeedMps: tierSpec.throwSpeedMps,
      throwBackspinRadPerSecond: 120,
      throwDirectionStdRadians: tierSpec.throwDirectionStdRadians,
    };
  });

  const runnerBases = scenario.runners ?? [0];
  const runners = runnerBases.map((b) => ({
    runnerId: `runner-${b}`,
    initialBase: b,
    ...(b === 0 ? { position: v(0.85, 0, -0.2) } : {}),
    topSpeedMps: 8.0,
    accelerationMps2: 5.2,
    reactionSeconds: 0.18,
  }));

  const input: LiveFieldPlayInputV1 = {
    seed: 12345,
    outs: scenario.outs ?? 0,
    maxPlaySeconds: 45,
    ball: {
      originTick,
      elapsedSeconds,
      ball: {
        tick: quantizeEventTick(originTick, elapsedSeconds, tps),
        position: scenario.ballPosition,
        velocity: scenario.ballVelocity,
        spin: scenario.ballSpin ?? v(0, 0, 0),
      },
    },
    physics: {
      kind: 'aero_ground_v1',
      air: {
        ticksPerSecond: tps,
        integrationStepTicks: 5000,
        gravityY: -9.80665,
        aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,
      },
      ground: {
        ticksPerSecond: tps,
        gravityMps2: 9.80665,
        radiusM: 0.0366,
        inertiaRatio: 0.378,
        restingVerticalSpeedMps: 0.28,
        material: {
          restitution: 0.48,
          slidingFriction: 0.24,
          rollingDecelerationMps2: 0.36,
          normalSpinDecayPerSecond: 0.18,
        },
      },
    },
    field: {
      bases: {
        home: v(0, 0, 0),
        first: v(baseSide, 0, baseSide),
        second: v(0, 0, baseSide * 2),
        third: v(-baseSide, 0, baseSide),
      },
      fenceRadiusMeters: 110,
      fenceHeightMeters: 3,
    },
    fielders,
    runners,
  };

  return { input, roleMap };
}
