// Native physical and aerodynamic rigid pitch bridge compiled directly from src/core and src/presentation; no browser result simulator.
"use strict";
var KneekuraNativeMatchCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/integration/browser/index.ts
  var browser_exports = {};
  __export(browser_exports, {
    createNativeAerodynamicSession: () => createNativeAerodynamicSession,
    createNativeSinglePaSession: () => createNativeSinglePaSession,
    createReferenceAerodynamicPhysicalSource: () => createReferenceAerodynamicPhysicalSource,
    issueNativeCommandPitch: () => issueNativeCommandPitch,
    observeNativeAerodynamicPitch: () => observeNativeAerodynamicPitch,
    observeNativePitch: () => observeNativePitch
  });

  // src/presentation/mini/model.ts
  var MINI_PRESENTATION_CADENCE_MICROS = 55e3;

  // src/core/rules/PitchCountRule.ts
  var validatePrePitchCount = (count) => {
    if (!Number.isInteger(count.balls) || count.balls < 0 || count.balls > 3) {
      throw new Error(
        "pre-pitch balls must be an integer from 0 through 3"
      );
    }
    if (!Number.isInteger(count.strikes) || count.strikes < 0 || count.strikes > 2) {
      throw new Error(
        "pre-pitch strikes must be an integer from 0 through 2"
      );
    }
  };
  var addStrike = (count, cause) => {
    const strikes = count.strikes + 1;
    if (strikes >= 3) {
      return {
        kind: "strikeout",
        terminalCount: {
          balls: count.balls,
          strikes: 3
        },
        cause
      };
    }
    return {
      kind: "continue",
      count: {
        balls: count.balls,
        strikes
      },
      cause
    };
  };
  var resolvePitchCountRule = (count, adjudication) => {
    validatePrePitchCount(count);
    switch (adjudication.kind) {
      case "ball": {
        const balls = count.balls + 1;
        if (balls >= 4) {
          return {
            kind: "walk",
            terminalCount: {
              balls: 4,
              strikes: count.strikes
            },
            cause: "ball"
          };
        }
        return {
          kind: "continue",
          count: {
            balls,
            strikes: count.strikes
          },
          cause: "ball"
        };
      }
      case "called_strike":
        return addStrike(count, "called_strike");
      case "swinging_strike":
        return addStrike(count, "swinging_strike");
      case "foul":
        return {
          kind: "continue",
          count: {
            balls: count.balls,
            strikes: Math.min(2, count.strikes + 1)
          },
          cause: "foul"
        };
      case "foul_bunt":
        return addStrike(count, "foul_bunt");
      case "ball_in_play":
        return {
          kind: "ball_in_play",
          count
        };
    }
  };

  // src/core/sim/plateAppearance/CanonicalPlateAppearanceTimeline.ts
  var validateTick = (name, tick) => {
    if (!Number.isSafeInteger(tick) || tick < 0) {
      throw new Error(
        `${name} must be a non-negative safe integer tick`
      );
    }
  };
  var assertActive = (timeline) => {
    if (timeline.status.kind !== "active") {
      throw new Error(
        "plate appearance timeline is terminal and cannot accept another pitch"
      );
    }
    return timeline.status;
  };
  var assertMonotonicTick = (timeline, tick) => {
    validateTick("plate appearance event tick", tick);
    if (tick < timeline.lastEventTick) {
      throw new Error(
        "plate appearance event tick must not precede the previous event"
      );
    }
  };
  var createCanonicalPlateAppearanceTimeline = (match, startedAtTick) => {
    validateTick("startedAtTick", startedAtTick);
    const countResult = resolvePitchCountRule(
      {
        balls: match.balls,
        strikes: match.strikes
      },
      { kind: "ball_in_play" }
    );
    if (countResult.kind !== "ball_in_play") {
      throw new Error(
        "canonical match count must be valid for an active plate appearance"
      );
    }
    return {
      playId: match.playId,
      startedAtTick,
      lastEventTick: startedAtTick,
      nextSequence: 0,
      status: {
        kind: "active",
        count: countResult.count
      },
      events: []
    };
  };
  var recordCountedPitch = (timeline, tick, adjudication) => {
    const active = assertActive(timeline);
    assertMonotonicTick(timeline, tick);
    if (![
      "ball",
      "called_strike",
      "swinging_strike"
    ].includes(adjudication.kind)) {
      throw new Error(
        "counted pitch adjudication must be a non-contact pitch result"
      );
    }
    const result = resolvePitchCountRule(
      active.count,
      adjudication
    );
    if (result.kind === "ball_in_play") {
      throw new Error(
        "counted pitch adjudication unexpectedly produced ball_in_play"
      );
    }
    const event = {
      tick,
      sequence: timeline.nextSequence,
      kind: "PitchAdjudicated",
      payload: {
        countBefore: active.count,
        adjudication,
        result
      }
    };
    const status = result.kind === "continue" ? {
      kind: "active",
      count: result.count
    } : result.kind === "walk" ? {
      kind: "walk",
      terminalCount: result.terminalCount
    } : {
      kind: "strikeout",
      terminalCount: result.terminalCount
    };
    return {
      ...timeline,
      lastEventTick: tick,
      nextSequence: timeline.nextSequence + 1,
      status,
      events: [...timeline.events, event]
    };
  };
  var recordBatBallContact = (timeline, contact) => {
    const active = assertActive(timeline);
    assertMonotonicTick(timeline, contact.tick);
    const event = {
      tick: contact.tick,
      sequence: timeline.nextSequence,
      kind: "BatBallContact",
      payload: {
        countBefore: active.count,
        contact
      }
    };
    return {
      ...timeline,
      lastEventTick: contact.tick,
      nextSequence: timeline.nextSequence + 1,
      status: {
        kind: "batted_ball_pending",
        count: active.count,
        contactTick: contact.tick
      },
      events: [...timeline.events, event]
    };
  };

  // src/core/rng/DeterministicRng.ts
  function fnv1a32(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }
  function fmix32(value) {
    let hash = value >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2246822507);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 3266489909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  }
  function rotateLeft(value, bits) {
    return (value << bits | value >>> 32 - bits) >>> 0;
  }
  var DeterministicRng = class {
    s0;
    s1;
    s2;
    s3;
    constructor(seed) {
      let state = seed >>> 0;
      const split = () => {
        state = state + 2654435769 >>> 0;
        let z = state;
        z = Math.imul(z ^ z >>> 16, 569420461);
        z = Math.imul(z ^ z >>> 15, 1935289751);
        return (z ^ z >>> 15) >>> 0;
      };
      this.s0 = split();
      this.s1 = split();
      this.s2 = split();
      this.s3 = split();
      if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s3 = 1;
    }
    nextUint32() {
      const result = Math.imul(rotateLeft(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
      const t = this.s1 << 9 >>> 0;
      this.s2 = (this.s2 ^ this.s0) >>> 0;
      this.s3 = (this.s3 ^ this.s1) >>> 0;
      this.s1 = (this.s1 ^ this.s2) >>> 0;
      this.s0 = (this.s0 ^ this.s3) >>> 0;
      this.s2 = (this.s2 ^ t) >>> 0;
      this.s3 = rotateLeft(this.s3, 11);
      return result;
    }
    nextFloat() {
      return this.nextUint32() / 4294967296;
    }
  };

  // src/core/rng/SeedRoot.ts
  var SeedRoot = class {
    constructor(matchSeed) {
      this.matchSeed = matchSeed;
    }
    playSeed(playId) {
      return fmix32((this.matchSeed ^ Math.imul(playId + 1, 2654435769)) >>> 0);
    }
    phaseSeed(playId, phase) {
      return fmix32((this.playSeed(playId) ^ fnv1a32(phase)) >>> 0);
    }
    phaseRng(playId, phase) {
      return new DeterministicRng(this.phaseSeed(playId, phase));
    }
    streamSeed(playId, phase, streamKey) {
      return fmix32((this.phaseSeed(playId, phase) ^ fnv1a32(streamKey)) >>> 0);
    }
    streamRng(playId, phase, streamKey) {
      return new DeterministicRng(this.streamSeed(playId, phase, streamKey));
    }
  };

  // src/core/sim/plateAppearance/PlateAppearanceCommandPitchAdapter.ts
  var validateTick2 = (name, value) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(
        `${name} must be a non-negative safe integer tick`
      );
    }
  };
  var validateFinite = (name, value) => {
    if (!Number.isFinite(value)) {
      throw new Error(
        `${name} must be finite`
      );
    }
  };
  var validateVec3 = (name, value) => {
    validateFinite(`${name}.x`, value.x);
    validateFinite(`${name}.y`, value.y);
    validateFinite(`${name}.z`, value.z);
  };
  var validateProbability = (name, value) => {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(
        `${name} must be finite and within [0, 1]`
      );
    }
  };
  var horizontalFraction = (session, calibration) => {
    switch (session.command.pitcher.aggression) {
      case "challenge":
        return calibration.challengeHorizontalZoneFraction;
      case "balanced":
        return calibration.balancedHorizontalZoneFraction;
      case "waste":
        return calibration.wasteHorizontalZoneFraction;
    }
  };
  var verticalFraction = (session, calibration) => {
    switch (session.command.pitcher.verticalPlan) {
      case "low":
        return calibration.lowVerticalZoneFraction;
      case "middle":
        return calibration.middleVerticalZoneFraction;
      case "high":
        return calibration.highVerticalZoneFraction;
    }
  };
  var targetXDirection = (session, insideXDirection) => {
    switch (session.command.pitcher.attackZone) {
      case "inside":
        return insideXDirection;
      case "middle":
        return 0;
      case "outside":
        return insideXDirection === 1 ? -1 : 1;
    }
  };
  var swingProbability = (session, calibration) => {
    switch (session.command.batter.approach) {
      case "take":
        return 0;
      case "balanced":
        return calibration.balancedSwingProbability;
      case "aggressive":
        return calibration.aggressiveSwingProbability;
    }
  };
  var swingBiasTicks = (session, calibration) => {
    switch (session.command.batter.swingBias) {
      case "early":
        return calibration.earlyTimingOffsetTicks;
      case "neutral":
        return 0;
      case "late":
        return calibration.lateTimingOffsetTicks;
    }
  };
  var validateEnvironment = (environment) => {
    validateTick2(
      "pitchStartTick",
      environment.pitchStartTick
    );
    if (!Number.isSafeInteger(environment.pitchOrdinal) || environment.pitchOrdinal < 0) {
      throw new Error(
        "pitchOrdinal must be a non-negative safe integer"
      );
    }
    if (!Number.isSafeInteger(environment.ticksPerSecond) || environment.ticksPerSecond <= 0) {
      throw new Error(
        "ticksPerSecond must be a positive safe integer"
      );
    }
    if (!Number.isSafeInteger(environment.pitchDurationTicks) || environment.pitchDurationTicks <= 0) {
      throw new Error(
        "pitchDurationTicks must be a positive safe integer"
      );
    }
    validateVec3(
      "releasePosition",
      environment.releasePosition
    );
    validateVec3(
      "acceleration",
      environment.acceleration
    );
    if (environment.releaseSpin !== void 0) {
      validateVec3(
        "releaseSpin",
        environment.releaseSpin
      );
    }
    validateFinite("plateZ", environment.plateZ);
    validateFinite(
      "strikeZone.centerX",
      environment.strikeZone.centerX
    );
    validateFinite(
      "strikeZone.halfWidth",
      environment.strikeZone.halfWidth
    );
    validateFinite(
      "strikeZone.lowerY",
      environment.strikeZone.lowerY
    );
    validateFinite(
      "strikeZone.upperY",
      environment.strikeZone.upperY
    );
    if (environment.strikeZone.halfWidth <= 0 || environment.strikeZone.upperY <= environment.strikeZone.lowerY) {
      throw new Error(
        "strikeZone geometry must be positive and ordered"
      );
    }
    if (!Number.isFinite(environment.ballRadiusMeters) || environment.ballRadiusMeters <= 0) {
      throw new Error(
        "ballRadiusMeters must be finite and positive"
      );
    }
    if (environment.insideXDirection !== -1 && environment.insideXDirection !== 1) {
      throw new Error(
        "insideXDirection must be -1 or 1"
      );
    }
    const target = environment.targetCalibration;
    for (const [name, value] of Object.entries(target)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(
          `targetCalibration.${name} must be finite and non-negative`
        );
      }
    }
    for (const name of [
      "lowVerticalZoneFraction",
      "middleVerticalZoneFraction",
      "highVerticalZoneFraction"
    ]) {
      const value = target[name];
      if (value > 1) {
        throw new Error(
          `targetCalibration.${name} must be within [0, 1]`
        );
      }
    }
    const batter = environment.batterCalibration;
    validateProbability(
      "balancedSwingProbability",
      batter.balancedSwingProbability
    );
    validateProbability(
      "aggressiveSwingProbability",
      batter.aggressiveSwingProbability
    );
    if (!Number.isSafeInteger(
      batter.earlyTimingOffsetTicks
    ) || !Number.isSafeInteger(
      batter.lateTimingOffsetTicks
    )) {
      throw new Error(
        "swing timing offsets must be safe integer ticks"
      );
    }
    validateTick2(
      "swingWindowHalfWidthTicks",
      batter.swingWindowHalfWidthTicks
    );
  };
  var createTargetPlatePosition = (session, environment) => {
    const direction = targetXDirection(
      session,
      environment.insideXDirection
    );
    const x = environment.strikeZone.centerX + direction * environment.strikeZone.halfWidth * horizontalFraction(
      session,
      environment.targetCalibration
    );
    const verticalSpan = environment.strikeZone.upperY - environment.strikeZone.lowerY;
    const y = environment.strikeZone.lowerY + verticalSpan * verticalFraction(
      session,
      environment.targetCalibration
    );
    return {
      x,
      y,
      z: environment.plateZ
    };
  };
  var createTrajectory = (environment, target) => {
    const endTick = environment.pitchStartTick + environment.pitchDurationTicks;
    if (!Number.isSafeInteger(endTick)) {
      throw new Error(
        "pitch end tick must be a safe integer"
      );
    }
    const seconds = environment.pitchDurationTicks / environment.ticksPerSecond;
    const solveVelocity = (start, end, acceleration) => (end - start - 0.5 * acceleration * seconds * seconds) / seconds;
    return {
      start: {
        tick: environment.pitchStartTick,
        position: environment.releasePosition,
        velocity: {
          x: solveVelocity(
            environment.releasePosition.x,
            target.x,
            environment.acceleration.x
          ),
          y: solveVelocity(
            environment.releasePosition.y,
            target.y,
            environment.acceleration.y
          ),
          z: solveVelocity(
            environment.releasePosition.z,
            target.z,
            environment.acceleration.z
          )
        },
        spin: environment.releaseSpin ?? {
          x: 0,
          y: 0,
          z: 0
        }
      },
      acceleration: environment.acceleration,
      endTick,
      ticksPerSecond: environment.ticksPerSecond
    };
  };
  var createCommandedPitchAgainstBatterInput = (input) => {
    const {
      session,
      environment
    } = input;
    validateEnvironment(environment);
    const targetPlatePosition = createTargetPlatePosition(
      session,
      environment
    );
    const trajectory = createTrajectory(
      environment,
      targetPlatePosition
    );
    const rng = new SeedRoot(
      session.matchSeed
    ).streamRng(
      session.playId,
      "batting",
      `p7:pitch:${environment.pitchOrdinal}:decision`
    );
    const batterDecisionRoll = rng.nextFloat();
    const shouldSwing = batterDecisionRoll < swingProbability(
      session,
      environment.batterCalibration
    );
    if (!shouldSwing) {
      return {
        pitchOrdinal: environment.pitchOrdinal,
        targetPlatePosition,
        batterDecisionRoll,
        input: {
          action: {
            kind: "take"
          },
          trajectory,
          plateZ: environment.plateZ,
          strikeZone: environment.strikeZone,
          ballRadiusMeters: environment.ballRadiusMeters
        }
      };
    }
    const crossingTick = trajectory.endTick;
    const centerTick = crossingTick + swingBiasTicks(
      session,
      environment.batterCalibration
    );
    const halfWindow = environment.batterCalibration.swingWindowHalfWidthTicks;
    const startTick = Math.max(
      trajectory.start.tick,
      centerTick - halfWindow
    );
    const endTick = Math.min(
      trajectory.endTick,
      centerTick + halfWindow
    );
    if (endTick <= startTick) {
      throw new Error(
        "commanded swing window must have positive duration inside pitch trajectory"
      );
    }
    return {
      pitchOrdinal: environment.pitchOrdinal,
      targetPlatePosition,
      batterDecisionRoll,
      input: {
        action: {
          kind: "swing",
          swing: {
            startTick,
            endTick,
            ticksPerSecond: environment.ticksPerSecond,
            stateAtStart: environment.swingStateAtWindowStart
          }
        },
        trajectory
      }
    };
  };

  // src/core/sim/plateAppearance/PlateAppearanceCommandSession.ts
  var validateTick3 = (name, tick) => {
    if (!Number.isSafeInteger(tick) || tick < 0) {
      throw new Error(
        `${name} must be a non-negative safe integer tick`
      );
    }
  };
  var createPlateAppearanceCommandSession = (input) => {
    if (!Number.isSafeInteger(input.playId) || input.playId < 0) {
      throw new Error(
        "playId must be a non-negative safe integer"
      );
    }
    if (input.batterRunnerId.length === 0) {
      throw new Error(
        "batterRunnerId must not be empty"
      );
    }
    validateTick3(
      "acceptedAtTick",
      input.acceptedAtTick
    );
    if (!Number.isSafeInteger(input.matchSeed)) {
      throw new Error(
        "matchSeed must be a safe integer"
      );
    }
    return {
      playId: input.playId,
      batterRunnerId: input.batterRunnerId,
      acceptedAtTick: input.acceptedAtTick,
      matchSeed: input.matchSeed,
      command: input.command
    };
  };
  var assertCommandSessionCanDriveTimeline = (session, timeline) => {
    if (session.playId !== timeline.playId) {
      throw new Error(
        "command session playId must match the canonical plate appearance"
      );
    }
    if (session.acceptedAtTick > timeline.lastEventTick) {
      throw new Error(
        "command session acceptance tick must not be after the current timeline"
      );
    }
    if (timeline.status.kind !== "active") {
      throw new Error(
        "command session cannot generate another pitch after the plate appearance stopped accepting pitches"
      );
    }
  };

  // src/core/sim/contact/BatBallContact.ts
  var DEFAULT_CONTACT_PARAMETERS = Object.freeze({
    ballRadius: 0.0366,
    batRadius: 0.033,
    restitution: 0.52,
    tangentialRetention: 0.82,
    spinTransfer: 0.18
  });
  var EPSILON = 1e-12;
  var TICKS_PER_SECOND = 1e6;
  var add = (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  });
  var subtract = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var scale = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  var magnitude = (value) => Math.hypot(value.x, value.y, value.z);
  var normalize = (value) => {
    const length = magnitude(value);
    if (length <= EPSILON) {
      throw new Error("cannot normalize a zero-length vector");
    }
    return scale(value, 1 / length);
  };
  var clamp01 = (value) => Math.max(0, Math.min(1, value));
  var closestPointOnSegment = (point, start, end) => {
    const segment = subtract(end, start);
    const lengthSquared = dot(segment, segment);
    if (lengthSquared <= EPSILON) {
      throw new Error("bat pose grip and tip must not be identical");
    }
    const t = clamp01(dot(subtract(point, start), segment) / lengthSquared);
    return {
      point: add(start, scale(segment, t)),
      t
    };
  };
  var validateParameters = (parameters) => {
    if (parameters.ballRadius <= 0 || parameters.batRadius <= 0) {
      throw new Error("ballRadius and batRadius must be positive");
    }
    if (parameters.restitution < 0 || parameters.restitution > 1) {
      throw new Error("restitution must be within [0, 1]");
    }
    if (parameters.tangentialRetention < 0 || parameters.tangentialRetention > 1) {
      throw new Error("tangentialRetention must be within [0, 1]");
    }
    if (parameters.spinTransfer < 0) {
      throw new Error("spinTransfer must be non-negative");
    }
  };
  var sampleCompatibilityBatterSwingState = (swing, offsetTicks, ticksPerSecond = TICKS_PER_SECOND) => {
    if (!Number.isSafeInteger(offsetTicks) || offsetTicks < 0) {
      throw new Error("swing sample offsetTicks must be a non-negative safe integer");
    }
    if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond <= 0) {
      throw new Error("swing sample ticksPerSecond must be a positive safe integer");
    }
    const dt = offsetTicks / ticksPerSecond;
    const gripTranslation = scale(swing.linearVelocity, dt);
    const batAxis = subtract(swing.pose.tip, swing.pose.grip);
    const tipAngularTranslation = scale(cross(swing.angularVelocity, batAxis), dt);
    return {
      pose: {
        grip: add(swing.pose.grip, gripTranslation),
        tip: add(add(swing.pose.tip, gripTranslation), tipAngularTranslation)
      },
      linearVelocity: swing.linearVelocity,
      angularVelocity: swing.angularVelocity
    };
  };
  var sampleBatterSwingState = sampleCompatibilityBatterSwingState;
  var measureBatBallContactSeparation = (pitch, swing, parameters = DEFAULT_CONTACT_PARAMETERS) => {
    validateParameters(parameters);
    const nearest = closestPointOnSegment(
      pitch.position,
      swing.pose.grip,
      swing.pose.tip
    );
    return magnitude(subtract(pitch.position, nearest.point)) - (parameters.ballRadius + parameters.batRadius);
  };
  var resolveBatBallContact = (pitch, swing, parameters = DEFAULT_CONTACT_PARAMETERS) => {
    validateParameters(parameters);
    const nearest = closestPointOnSegment(
      pitch.position,
      swing.pose.grip,
      swing.pose.tip
    );
    const batToBall = subtract(pitch.position, nearest.point);
    const distance = magnitude(batToBall);
    const contactDistance = parameters.ballRadius + parameters.batRadius;
    if (distance > contactDistance) {
      return null;
    }
    const normal = distance > EPSILON ? scale(batToBall, 1 / distance) : normalize(scale(pitch.velocity, -1));
    const leverArm = subtract(nearest.point, swing.pose.grip);
    const localBatVelocity = add(
      swing.linearVelocity,
      cross(swing.angularVelocity, leverArm)
    );
    const relativeVelocity = subtract(pitch.velocity, localBatVelocity);
    const normalSpeed = dot(relativeVelocity, normal);
    if (normalSpeed >= 0) {
      return null;
    }
    const relativeNormal = scale(normal, normalSpeed);
    const relativeTangent = subtract(relativeVelocity, relativeNormal);
    const postRelativeNormal = scale(
      normal,
      -parameters.restitution * normalSpeed
    );
    const postRelativeTangent = scale(
      relativeTangent,
      parameters.tangentialRetention
    );
    const exitVelocity = add(
      localBatVelocity,
      add(postRelativeNormal, postRelativeTangent)
    );
    const tangentSlip = subtract(relativeTangent, postRelativeTangent);
    const spinDelta = scale(
      cross(normal, tangentSlip),
      parameters.spinTransfer / parameters.ballRadius
    );
    const exitSpin = add(pitch.spin, spinDelta);
    const contactPoint = add(nearest.point, scale(normal, parameters.batRadius));
    return {
      tick: pitch.tick,
      ballCenter: pitch.position,
      point: contactPoint,
      batPoint: nearest.point,
      normal,
      segmentT: nearest.t,
      exitVelocity,
      exitSpin
    };
  };

  // src/core/sim/ExactEventTime.ts
  var FLOATING_TICK_TOLERANCE = 1e-9;
  var assertAuthoritativeTick = (tick, name) => {
    if (!Number.isSafeInteger(tick) || tick < 0) {
      throw new Error(`${name} must be a non-negative safe integer tick`);
    }
  };
  var quantizeEventTick = (startTick, elapsedSeconds, ticksPerSecond) => {
    assertAuthoritativeTick(startTick, "startTick");
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new Error("elapsedSeconds must be a finite non-negative number");
    }
    if (!Number.isInteger(ticksPerSecond) || ticksPerSecond <= 0) {
      throw new Error("ticksPerSecond must be a positive integer");
    }
    const rawOffsetTicks = elapsedSeconds * ticksPerSecond;
    const nearestInteger = Math.round(rawOffsetTicks);
    const tolerance = FLOATING_TICK_TOLERANCE + Number.EPSILON * Math.max(1, Math.abs(rawOffsetTicks)) * 8;
    const offsetTicks = Math.abs(rawOffsetTicks - nearestInteger) <= tolerance ? nearestInteger : Math.ceil(rawOffsetTicks);
    const eventTick = startTick + offsetTicks;
    assertAuthoritativeTick(eventTick, "eventTick");
    return eventTick;
  };
  var findFirstTrueTick = (startTick, endTick, hasOccurredBy) => {
    assertAuthoritativeTick(startTick, "startTick");
    assertAuthoritativeTick(endTick, "endTick");
    if (endTick < startTick) {
      throw new Error("endTick must be greater than or equal to startTick");
    }
    if (hasOccurredBy(startTick)) {
      return startTick;
    }
    if (!hasOccurredBy(endTick)) {
      return null;
    }
    let low = startTick + 1;
    let high = endTick;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (hasOccurredBy(middle)) {
        high = middle;
      } else {
        low = middle + 1;
      }
    }
    return low;
  };

  // src/core/sim/pitching/PitchTrajectory.ts
  var EPSILON2 = 1e-12;
  var validateVec32 = (name, value) => {
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
      throw new Error(
        `${name} must contain finite coordinates`
      );
    }
  };
  var validateSegment = (segment) => {
    if (!Number.isSafeInteger(segment.start.tick) || segment.start.tick < 0) {
      throw new Error(
        "pitch trajectory start tick must be a non-negative safe integer"
      );
    }
    if (!Number.isSafeInteger(segment.endTick) || segment.endTick < segment.start.tick) {
      throw new Error(
        "pitch trajectory endTick must be a safe integer at or after start"
      );
    }
    if (!Number.isSafeInteger(segment.ticksPerSecond) || segment.ticksPerSecond <= 0) {
      throw new Error(
        "pitch trajectory ticksPerSecond must be a positive safe integer"
      );
    }
    validateVec32(
      "pitch trajectory start position",
      segment.start.position
    );
    validateVec32(
      "pitch trajectory start velocity",
      segment.start.velocity
    );
    validateVec32(
      "pitch trajectory start spin",
      segment.start.spin
    );
    validateVec32(
      "pitch trajectory acceleration",
      segment.acceleration
    );
  };
  var evaluateCoordinate = (position, velocity, acceleration, seconds) => position + velocity * seconds + 0.5 * acceleration * seconds * seconds;
  var evaluateVelocity = (velocity, acceleration, seconds) => velocity + acceleration * seconds;
  var rootsAtCoordinate = (position, velocity, acceleration, target) => {
    const a = 0.5 * acceleration;
    const b = velocity;
    const c = position - target;
    if (Math.abs(a) <= EPSILON2) {
      if (Math.abs(b) <= EPSILON2) {
        return Math.abs(c) <= EPSILON2 ? [0] : [];
      }
      return [-c / b];
    }
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -EPSILON2) {
      return [];
    }
    const root = Math.sqrt(Math.max(0, discriminant));
    const denominator = 2 * a;
    return [
      (-b - root) / denominator,
      (-b + root) / denominator
    ];
  };
  var sampleContinuous = (segment, elapsedSeconds) => ({
    position: {
      x: evaluateCoordinate(
        segment.start.position.x,
        segment.start.velocity.x,
        segment.acceleration.x,
        elapsedSeconds
      ),
      y: evaluateCoordinate(
        segment.start.position.y,
        segment.start.velocity.y,
        segment.acceleration.y,
        elapsedSeconds
      ),
      z: evaluateCoordinate(
        segment.start.position.z,
        segment.start.velocity.z,
        segment.acceleration.z,
        elapsedSeconds
      )
    },
    velocity: {
      x: evaluateVelocity(
        segment.start.velocity.x,
        segment.acceleration.x,
        elapsedSeconds
      ),
      y: evaluateVelocity(
        segment.start.velocity.y,
        segment.acceleration.y,
        elapsedSeconds
      ),
      z: evaluateVelocity(
        segment.start.velocity.z,
        segment.acceleration.z,
        elapsedSeconds
      )
    }
  });
  var samplePitchTrajectorySegment = (segment, tick) => {
    validateSegment(segment);
    if (!Number.isSafeInteger(tick) || tick < segment.start.tick || tick > segment.endTick) {
      throw new Error(
        "pitch sample tick must lie inside the trajectory segment"
      );
    }
    const elapsedSeconds = (tick - segment.start.tick) / segment.ticksPerSecond;
    const sampled = sampleContinuous(
      segment,
      elapsedSeconds
    );
    return {
      tick,
      position: sampled.position,
      velocity: sampled.velocity,
      spin: segment.start.spin
    };
  };
  var findPitchPlateCrossing = (segment, plateZ) => {
    validateSegment(segment);
    if (!Number.isFinite(plateZ)) {
      throw new Error("plateZ must be finite");
    }
    const durationSeconds = (segment.endTick - segment.start.tick) / segment.ticksPerSecond;
    const roots = rootsAtCoordinate(
      segment.start.position.z,
      segment.start.velocity.z,
      segment.acceleration.z,
      plateZ
    ).filter((seconds) => seconds >= -EPSILON2 && seconds <= durationSeconds + EPSILON2).map((seconds) => Math.max(0, Math.min(durationSeconds, seconds))).sort((first, second) => first - second);
    if (roots.length === 0) {
      return null;
    }
    const elapsedSeconds = roots[0];
    const sampled = sampleContinuous(
      segment,
      elapsedSeconds
    );
    return {
      tick: quantizeEventTick(
        segment.start.tick,
        elapsedSeconds,
        segment.ticksPerSecond
      ),
      elapsedSeconds,
      position: {
        ...sampled.position,
        z: plateZ
      },
      velocity: sampled.velocity,
      spin: segment.start.spin
    };
  };

  // src/core/sim/pitching/SwingingPitchPhysicalResult.ts
  var EPSILON3 = 1e-12;
  var magnitude3 = (value) => Math.hypot(
    value.x,
    value.y,
    value.z
  );
  var subtract3 = (first, second) => ({
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z
  });
  var cross3 = (first, second) => ({
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x
  });
  var add3 = (first, second) => ({
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z
  });
  var validateSwingWindow = (input) => {
    const { trajectory, swing } = input;
    if (!Number.isSafeInteger(swing.startTick) || !Number.isSafeInteger(swing.endTick) || swing.endTick < swing.startTick || swing.startTick < trajectory.start.tick || swing.endTick > trajectory.endTick) {
      throw new Error(
        "swing window must lie inside the pitch trajectory interval"
      );
    }
    if (!Number.isSafeInteger(swing.ticksPerSecond) || swing.ticksPerSecond <= 0 || swing.ticksPerSecond !== trajectory.ticksPerSecond) {
      throw new Error(
        "pitch trajectory and swing window must share ticksPerSecond"
      );
    }
  };
  var maximumGeometricClosingSpeed = (input) => {
    const pitchAtSwingStart = samplePitchTrajectorySegment(
      input.trajectory,
      input.swing.startTick
    );
    const durationSeconds = (input.swing.endTick - input.swing.startTick) / input.swing.ticksPerSecond;
    const maximumPitchSpeed = magnitude3(pitchAtSwingStart.velocity) + magnitude3(input.trajectory.acceleration) * durationSeconds;
    const batAxis = subtract3(
      input.swing.stateAtStart.pose.tip,
      input.swing.stateAtStart.pose.grip
    );
    const gripSpeed = magnitude3(
      input.swing.stateAtStart.linearVelocity
    );
    const tipSpeed = magnitude3(add3(
      input.swing.stateAtStart.linearVelocity,
      cross3(
        input.swing.stateAtStart.angularVelocity,
        batAxis
      )
    ));
    return maximumPitchSpeed + Math.max(
      gripSpeed,
      tipSpeed
    );
  };
  var resolveSwingingPitchPhysicalResult = (input) => {
    validateSwingWindow(input);
    const parameters = input.contactParameters ?? DEFAULT_CONTACT_PARAMETERS;
    const maxClosingSpeed = maximumGeometricClosingSpeed(input);
    let tick = input.swing.startTick;
    while (tick <= input.swing.endTick) {
      const pitch = samplePitchTrajectorySegment(
        input.trajectory,
        tick
      );
      const swing = sampleBatterSwingState(
        input.swing.stateAtStart,
        tick - input.swing.startTick,
        input.swing.ticksPerSecond
      );
      const separation = measureBatBallContactSeparation(
        pitch,
        swing,
        parameters
      );
      if (separation <= 0) {
        const contact = resolveBatBallContact(
          pitch,
          swing,
          parameters
        );
        if (contact !== null) {
          return {
            kind: "contact",
            contact
          };
        }
      }
      if (tick === input.swing.endTick) {
        break;
      }
      const safeAdvanceTicks = separation > 0 && maxClosingSpeed > EPSILON3 ? Math.floor(
        separation / maxClosingSpeed * input.swing.ticksPerSecond
      ) - 1 : 1;
      tick = Math.min(
        input.swing.endTick,
        tick + Math.max(1, safeAdvanceTicks)
      );
    }
    return {
      kind: "swinging_miss",
      adjudicationTick: input.swing.endTick
    };
  };

  // src/core/sim/pitching/SwingingPitchTimelineAdapter.ts
  var recordSwingingPitchPhysicalResult = (timeline, result) => {
    if (result.kind === "contact") {
      return recordBatBallContact(
        timeline,
        result.contact
      );
    }
    if (!Number.isSafeInteger(result.adjudicationTick) || result.adjudicationTick < timeline.lastEventTick) {
      throw new Error(
        "plate appearance event tick must not precede the previous event"
      );
    }
    const physicalEvent = {
      tick: result.adjudicationTick,
      sequence: timeline.nextSequence,
      kind: "SwingCompletedWithoutContact",
      payload: {
        result
      }
    };
    const withPhysicalEvidence = {
      ...timeline,
      lastEventTick: result.adjudicationTick,
      nextSequence: timeline.nextSequence + 1,
      events: [
        ...timeline.events,
        physicalEvent
      ]
    };
    return recordCountedPitch(
      withPhysicalEvidence,
      result.adjudicationTick,
      { kind: "swinging_strike" }
    );
  };

  // src/core/sim/pitching/TakenPitchPhysicalResult.ts
  var validateZone = (zone) => {
    if (!Number.isFinite(zone.centerX) || !Number.isFinite(zone.halfWidth) || zone.halfWidth <= 0) {
      throw new Error(
        "strike zone centerX/halfWidth must be finite and halfWidth positive"
      );
    }
    if (!Number.isFinite(zone.lowerY) || !Number.isFinite(zone.upperY) || zone.upperY <= zone.lowerY) {
      throw new Error(
        "strike zone upperY must be greater than lowerY"
      );
    }
  };
  var resolveTakenPitchPhysicalResult = (input) => {
    validateZone(input.strikeZone);
    if (!Number.isFinite(input.ballRadiusMeters) || input.ballRadiusMeters <= 0) {
      throw new Error(
        "ballRadiusMeters must be finite and positive"
      );
    }
    const crossing = findPitchPlateCrossing(
      input.trajectory,
      input.plateZ
    );
    if (crossing === null) {
      return null;
    }
    const horizontalMin = input.strikeZone.centerX - input.strikeZone.halfWidth;
    const horizontalMax = input.strikeZone.centerX + input.strikeZone.halfWidth;
    const overlapsHorizontalZone = crossing.position.x + input.ballRadiusMeters >= horizontalMin && crossing.position.x - input.ballRadiusMeters <= horizontalMax;
    const overlapsVerticalZone = crossing.position.y + input.ballRadiusMeters >= input.strikeZone.lowerY && crossing.position.y - input.ballRadiusMeters <= input.strikeZone.upperY;
    return {
      kind: overlapsHorizontalZone && overlapsVerticalZone ? "called_strike" : "ball",
      crossing,
      geometry: {
        overlapsHorizontalZone,
        overlapsVerticalZone
      }
    };
  };

  // src/core/sim/pitching/TakenPitchTimelineAdapter.ts
  var recordTakenPitchPhysicalResult = (timeline, result) => {
    if (!Number.isSafeInteger(result.crossing.tick) || result.crossing.tick < timeline.lastEventTick) {
      throw new Error(
        "plate appearance event tick must not precede the previous event"
      );
    }
    const physicalEvent = {
      tick: result.crossing.tick,
      sequence: timeline.nextSequence,
      kind: "TakenPitchPlateCrossed",
      payload: {
        result
      }
    };
    const withPhysicalEvidence = {
      ...timeline,
      lastEventTick: result.crossing.tick,
      nextSequence: timeline.nextSequence + 1,
      events: [
        ...timeline.events,
        physicalEvent
      ]
    };
    return recordCountedPitch(
      withPhysicalEvidence,
      result.crossing.tick,
      {
        kind: result.kind
      }
    );
  };

  // src/core/sim/pitching/PitchAgainstBatter.ts
  var isTakePitchAgainstBatterInput = (input) => input.action.kind === "take";
  var resolveAndRecordPitchAgainstBatter = (timeline, input) => {
    if (isTakePitchAgainstBatterInput(input)) {
      const physical2 = resolveTakenPitchPhysicalResult({
        trajectory: input.trajectory,
        plateZ: input.plateZ,
        strikeZone: input.strikeZone,
        ballRadiusMeters: input.ballRadiusMeters
      });
      if (physical2 === null) {
        return {
          kind: "unresolved",
          reason: "pitch_did_not_reach_plate",
          timeline
        };
      }
      return {
        kind: "recorded",
        physical: {
          kind: "taken",
          result: physical2
        },
        timeline: recordTakenPitchPhysicalResult(
          timeline,
          physical2
        )
      };
    }
    const physical = resolveSwingingPitchPhysicalResult({
      trajectory: input.trajectory,
      swing: input.action.swing,
      contactParameters: input.contactParameters
    });
    return {
      kind: "recorded",
      physical: {
        kind: "swing",
        result: physical
      },
      timeline: recordSwingingPitchPhysicalResult(
        timeline,
        physical
      )
    };
  };

  // src/core/rules/HalfInningTransitionRule.ts
  var resolveHalfInningTransition = (input) => {
    if (!Number.isInteger(input.inning) || input.inning <= 0) {
      throw new Error("inning must be a positive integer");
    }
    if (!Number.isInteger(input.outsAfterPlay) || input.outsAfterPlay < 0 || input.outsAfterPlay > 3) {
      throw new Error(
        "outsAfterPlay must be an integer from 0 through 3"
      );
    }
    if (input.outsAfterPlay < 3) {
      return {
        kind: "half_inning_continues",
        inning: input.inning,
        half: input.half,
        outs: input.outsAfterPlay
      };
    }
    return {
      kind: "half_inning_ended",
      nextInning: input.half === "top" ? input.inning : input.inning + 1,
      nextHalf: input.half === "top" ? "bottom" : "top",
      reset: {
        outs: 0,
        balls: 0,
        strikes: 0,
        bases: {
          first: null,
          second: null,
          third: null
        }
      }
    };
  };

  // src/core/rules/WalkAdvancementRule.ts
  var validateRunnerIds = (input) => {
    if (input.batterRunnerId.length === 0) {
      throw new Error("batterRunnerId must not be empty");
    }
    const occupied = [
      input.bases.first,
      input.bases.second,
      input.bases.third
    ].filter((value) => value !== null);
    if (occupied.some((runnerId) => runnerId.length === 0) || new Set(occupied).size !== occupied.length) {
      throw new Error(
        "walk advancement requires unique occupied runner ids"
      );
    }
    if (occupied.includes(input.batterRunnerId)) {
      throw new Error(
        "batterRunnerId must not already occupy a base"
      );
    }
  };
  var resolveWalkForcedAdvancement = (input) => {
    validateRunnerIds(input);
    const first = input.bases.first;
    const second = input.bases.second;
    const third = input.bases.third;
    if (first === null) {
      return {
        bases: {
          first: input.batterRunnerId,
          second,
          third
        },
        scoredRunnerIds: []
      };
    }
    if (second === null) {
      return {
        bases: {
          first: input.batterRunnerId,
          second: first,
          third
        },
        scoredRunnerIds: []
      };
    }
    if (third === null) {
      return {
        bases: {
          first: input.batterRunnerId,
          second: first,
          third: second
        },
        scoredRunnerIds: []
      };
    }
    return {
      bases: {
        first: input.batterRunnerId,
        second: first,
        third: second
      },
      scoredRunnerIds: [third]
    };
  };

  // src/core/sim/plateAppearance/PlateAppearanceMatchState.ts
  var nextPlayId = (playId) => {
    if (!Number.isSafeInteger(playId) || playId < 0) {
      throw new Error(
        "CanonicalMatchState.playId must be a non-negative safe integer"
      );
    }
    if (!Number.isSafeInteger(playId + 1)) {
      throw new Error("next playId must be a safe integer");
    }
    return playId + 1;
  };
  var applyStrikeoutPlateAppearanceToMatchState = (match, timeline) => {
    if (timeline.playId !== match.playId) {
      throw new Error(
        "plate appearance timeline playId must match CanonicalMatchState.playId"
      );
    }
    if (timeline.status.kind !== "strikeout") {
      throw new Error(
        "strikeout match-state application requires a strikeout timeline"
      );
    }
    const outsAfterPlay = match.outs + 1;
    const transition = resolveHalfInningTransition({
      inning: match.inning,
      half: match.half,
      outsAfterPlay
    });
    const playId = nextPlayId(match.playId);
    if (transition.kind === "half_inning_continues") {
      return {
        ...match,
        outs: transition.outs,
        balls: 0,
        strikes: 0,
        playId
      };
    }
    return {
      ruleProfileId: match.ruleProfileId,
      inning: transition.nextInning,
      half: transition.nextHalf,
      outs: transition.reset.outs,
      balls: transition.reset.balls,
      strikes: transition.reset.strikes,
      bases: transition.reset.bases,
      score: match.score,
      playId
    };
  };
  var applyWalkPlateAppearanceToMatchState = (match, timeline, batterRunnerId) => {
    if (timeline.playId !== match.playId) {
      throw new Error(
        "plate appearance timeline playId must match CanonicalMatchState.playId"
      );
    }
    if (timeline.status.kind !== "walk") {
      throw new Error(
        "walk match-state application requires a walk timeline"
      );
    }
    if (!Number.isInteger(match.outs) || match.outs < 0 || match.outs > 2) {
      throw new Error(
        "walk match-state application requires outs from 0 through 2"
      );
    }
    const advancement = resolveWalkForcedAdvancement({
      batterRunnerId,
      bases: match.bases
    });
    const runs = advancement.scoredRunnerIds.length;
    return {
      ...match,
      balls: 0,
      strikes: 0,
      bases: advancement.bases,
      score: match.half === "top" ? {
        away: match.score.away + runs,
        home: match.score.home
      } : {
        away: match.score.away,
        home: match.score.home + runs
      },
      playId: nextPlayId(match.playId)
    };
  };

  // src/presentation/mini/MiniPresentationTimeline.ts
  function isFairBattedBallDeclaration(event) {
    return event.kind === "BattedBallDeclaredFair";
  }
  function assertStrictlyIncreasingSamples(samples) {
    for (let index = 1; index < samples.length; index += 1) {
      if (samples[index - 1].world.tick >= samples[index].world.tick) {
        throw new Error(
          "Presentation samples must have strictly increasing ticks."
        );
      }
    }
  }
  var assertScheduleTick = (name, tick) => {
    if (!Number.isSafeInteger(tick) || tick < 0) {
      throw new Error(
        `${name} must be a non-negative safe integer tick.`
      );
    }
  };
  function createMiniPresentationSampleSchedule(startTick, endTick, cadenceTicks, events) {
    assertScheduleTick("startTick", startTick);
    assertScheduleTick("endTick", endTick);
    if (endTick < startTick) {
      throw new Error(
        "Presentation schedule endTick must be at or after startTick."
      );
    }
    if (!Number.isSafeInteger(cadenceTicks) || cadenceTicks <= 0) {
      throw new Error(
        "Presentation cadenceTicks must be a positive safe integer."
      );
    }
    const ticks = /* @__PURE__ */ new Set();
    ticks.add(startTick);
    ticks.add(endTick);
    let tick = startTick;
    while (tick + cadenceTicks < endTick) {
      tick += cadenceTicks;
      ticks.add(tick);
    }
    for (const event of events) {
      assertScheduleTick("event.tick", event.tick);
      if (event.tick >= startTick && event.tick <= endTick) {
        ticks.add(event.tick);
      }
    }
    return [...ticks].sort(
      (first, second) => first - second
    );
  }
  function buildMiniPresentationTimeline(samples, events, preContactCameraMode = "BATTER_POV") {
    assertStrictlyIncreasingSamples(samples);
    const sampleTicks = new Set(
      samples.map((sample) => sample.world.tick)
    );
    for (const event of events) {
      if (isFairBattedBallDeclaration(event) && !sampleTicks.has(event.tick)) {
        throw new Error(
          `Missing exact canonical sample for BattedBallDeclaredFair at tick ${event.tick}.`
        );
      }
    }
    const eventsByTick = /* @__PURE__ */ new Map();
    for (const event of events) {
      const list = eventsByTick.get(event.tick);
      if (list) list.push(event);
      else eventsByTick.set(event.tick, [event]);
    }
    const frames = [];
    let cameraMode = preContactCameraMode;
    for (const sample of samples) {
      const tick = sample.world.tick;
      const tickEvents = eventsByTick.get(tick) ?? [];
      const fairDeclaration = tickEvents.find(
        isFairBattedBallDeclaration
      );
      frames.push({
        tick,
        cameraMode,
        sample,
        events: tickEvents
      });
      if (cameraMode !== "FIELD_OVERHEAD" && fairDeclaration) {
        cameraMode = "FIELD_OVERHEAD";
        frames.push({
          tick,
          cameraMode,
          sample,
          events: tickEvents,
          cutReason: "fair_batted_ball_declared"
        });
      }
    }
    return frames;
  }

  // src/integration/browser/NativePitchObserverAdapter.ts
  var validTick = (tick) => Number.isSafeInteger(tick) && tick >= 0;
  function nativeBatPose(input, tick) {
    if (input.action.kind === "take") {
      return { handedness: "R", action: "idle", bat: null };
    }
    const swing = input.action.swing;
    const clampedTick = Math.max(swing.startTick, Math.min(swing.endTick, tick));
    const pose = sampleBatterSwingState(swing.stateAtStart, clampedTick - swing.startTick).pose;
    return { handedness: "R", action: "normal_swing", bat: pose };
  }
  function observeNativePitch(input) {
    const timeline = input.timeline ?? createCanonicalPlateAppearanceTimeline(input.match, input.startedAtTick);
    if (timeline.playId !== input.match.playId || timeline.status.kind !== "active") {
      throw new Error("Native bridge requires the same active canonical playId.");
    }
    if (!input.batterRunnerId || !["R", "L"].includes(input.batterHandedness) || !["R", "L"].includes(input.pitcherHandedness)) {
      throw new Error("Native bridge requires actual player identities and handedness.");
    }
    const { trajectory } = input.pitch;
    if (!validTick(trajectory.start.tick) || !validTick(trajectory.endTick) || trajectory.start.tick < timeline.lastEventTick) {
      throw new Error("Native pitch must start after the accepted current timeline boundary.");
    }
    const resolved = resolveAndRecordPitchAgainstBatter(timeline, input.pitch);
    const newlyAcceptedEvents = resolved.timeline.events.slice(timeline.events.length);
    if (resolved.timeline.events.length < timeline.events.length || !timeline.events.every((event, i) => resolved.timeline.events[i] === event)) {
      throw new Error("Native bridge cannot rewrite a committed pitch prefix.");
    }
    const contactTick = resolved.kind === "recorded" && resolved.physical.kind === "swing" && resolved.physical.result.kind === "contact" ? resolved.physical.result.contact.tick : null;
    const observationEndTick = contactTick ?? trajectory.endTick;
    const eventTicks = createMiniPresentationSampleSchedule(
      trajectory.start.tick,
      observationEndTick,
      MINI_PRESENTATION_CADENCE_MICROS,
      newlyAcceptedEvents
    );
    const samples = eventTicks.map((tick) => {
      const body = input.actorsAtTick(tick);
      if (!body || !Array.isArray(body.defenders) || !Array.isArray(body.runners)) {
        throw new Error("Missing authoritative actor observation at tick " + tick);
      }
      const ball = samplePitchTrajectorySegment(trajectory, tick);
      const bat = nativeBatPose(input.pitch, tick);
      return {
        world: {
          tick,
          defenders: body.defenders,
          runners: body.runners,
          ball: { position: ball.position, velocity: ball.velocity, spin: ball.spin }
        },
        batter: { ...bat, handedness: input.batterHandedness },
        pitcherHandedness: input.pitcherHandedness
      };
    });
    const frames = buildMiniPresentationTimeline(samples, newlyAcceptedEvents, input.camera ?? "BATTER_POV");
    let nextMatchState = null;
    switch (resolved.timeline.status.kind) {
      case "walk":
        nextMatchState = applyWalkPlateAppearanceToMatchState(input.match, resolved.timeline, input.batterRunnerId);
        break;
      case "strikeout":
        nextMatchState = applyStrikeoutPlateAppearanceToMatchState(input.match, resolved.timeline);
        break;
      default:
        break;
    }
    return {
      authority: "NATIVE_CORE_PHYSICAL_PITCH",
      kind: resolved.kind,
      result: resolved,
      events: newlyAcceptedEvents,
      samples,
      frames,
      nextMatchState,
      requiresOfficialLiveBallResolution: resolved.timeline.status.kind === "batted_ball_pending"
    };
  }
  function issueNativeCommandPitch(input) {
    const timeline = input.timeline ?? createCanonicalPlateAppearanceTimeline(input.match, input.startedAtTick);
    assertCommandSessionCanDriveTimeline(input.commandSession, timeline);
    const commanded = createCommandedPitchAgainstBatterInput({
      session: input.commandSession,
      environment: input.environment
    });
    const observed = observeNativePitch({ ...input, timeline, pitch: commanded.input });
    return { ...observed, commanded };
  }

  // src/core/model/RuleProfileRef.ts
  var asRuleProfileId = (value) => {
    if (value.length === 0) {
      throw new Error("rule profile id must not be empty");
    }
    return value;
  };

  // src/core/sim/plateAppearance/PlateAppearanceCommand.ts
  var assertOneOf = (name, value, allowed, description) => {
    if (!allowed.includes(value)) {
      throw new Error(
        `${name} must be ${description}`
      );
    }
  };
  var createPlateAppearanceCommand = (input) => {
    assertOneOf(
      "pitcher.attackZone",
      input.pitcher.attackZone,
      ["inside", "middle", "outside"],
      "inside, middle, or outside"
    );
    assertOneOf(
      "pitcher.verticalPlan",
      input.pitcher.verticalPlan,
      ["low", "middle", "high"],
      "low, middle, or high"
    );
    assertOneOf(
      "pitcher.aggression",
      input.pitcher.aggression,
      ["challenge", "balanced", "waste"],
      "challenge, balanced, or waste"
    );
    assertOneOf(
      "batter.approach",
      input.batter.approach,
      ["take", "balanced", "aggressive"],
      "take, balanced, or aggressive"
    );
    assertOneOf(
      "batter.swingBias",
      input.batter.swingBias,
      ["early", "neutral", "late"],
      "early, neutral, or late"
    );
    assertOneOf(
      "runners.posture",
      input.runners.posture,
      ["conservative", "balanced", "aggressive"],
      "conservative, balanced, or aggressive"
    );
    return {
      pitcher: { ...input.pitcher },
      batter: { ...input.batter },
      runners: { ...input.runners }
    };
  };

  // src/integration/browser/NativeSinglePaSession.ts
  var EMPTY_ACTORS = Object.freeze({
    defenders: Object.freeze([]),
    runners: Object.freeze([])
  });
  function createNativeSinglePaSession(seed) {
    if (!Number.isSafeInteger(seed)) throw new Error("Native session seed must be a safe integer.");
    const match = {
      ruleProfileId: asRuleProfileId("npb-2026"),
      inning: 1,
      half: "top",
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: { first: null, second: null, third: null },
      score: { away: 0, home: 0 },
      playId: 0
    };
    let timeline = createCanonicalPlateAppearanceTimeline(match, 1e6);
    let ordinal = 0;
    let lastFlightEndTick = 1e6;
    const inspect = () => ({
      phase: timeline.status.kind,
      count: timeline.status.kind === "active" ? { balls: timeline.status.count.balls, strikes: timeline.status.count.strikes } : null,
      pitches: ordinal
    });
    const issue = (requested) => {
      if (timeline.status.kind !== "active") {
        throw new Error("Native PA is finished or awaiting the genuine fielding/umpire path; no substitute result will be invented.");
      }
      const committed = createPlateAppearanceCommand(requested);
      const commandSession = createPlateAppearanceCommandSession({
        playId: match.playId,
        batterRunnerId: "lad-2025-ohtani",
        acceptedAtTick: timeline.lastEventTick,
        matchSeed: seed,
        command: committed
      });
      const pitchStartTick = Math.max(lastFlightEndTick + 1e5, timeline.lastEventTick + 1e5);
      const environment = {
        pitchStartTick,
        pitchOrdinal: ordinal,
        ticksPerSecond: 1e6,
        // 18m travel in ~470ms: example flight under Tikao's stated 151km/h max.
        // This is a documented fixture, NOT a calibrated NLB pitcher model.
        pitchDurationTicks: 47e4,
        releasePosition: { x: 0, y: 1.8, z: 18 },
        acceleration: { x: 0, y: -9.8, z: 0 },
        plateZ: 0,
        strikeZone: { centerX: 0, halfWidth: 0.22, lowerY: 0.55, upperY: 1.15 },
        ballRadiusMeters: 0.0366,
        insideXDirection: 1,
        targetCalibration: {
          challengeHorizontalZoneFraction: 0.45,
          balancedHorizontalZoneFraction: 0.8,
          wasteHorizontalZoneFraction: 1.3,
          lowVerticalZoneFraction: 0.2,
          middleVerticalZoneFraction: 0.5,
          highVerticalZoneFraction: 0.8
        },
        batterCalibration: {
          balancedSwingProbability: 0.5,
          aggressiveSwingProbability: 1,
          earlyTimingOffsetTicks: -3e4,
          lateTimingOffsetTicks: 3e4,
          swingWindowHalfWidthTicks: 7e4
        },
        swingStateAtWindowStart: {
          pose: { grip: { x: -0.5, y: 1, z: 0.3 }, tip: { x: 0.4, y: 1, z: 0.3 } },
          linearVelocity: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 12, z: 0 }
        }
      };
      const issued = issueNativeCommandPitch({
        match,
        timeline,
        startedAtTick: 1e6,
        commandSession,
        environment,
        batterRunnerId: "lad-2025-ohtani",
        batterHandedness: "L",
        pitcherHandedness: "R",
        actorsAtTick: () => EMPTY_ACTORS
      });
      timeline = issued.result.timeline;
      lastFlightEndTick = environment.pitchStartTick + environment.pitchDurationTicks;
      if (timeline.status.kind === "live_ball" || timeline.status.kind === "caught_foul_live" || timeline.status.kind === "live_ball_complete") {
        throw new Error("Full live-ball completion needs its separate physical fielding and umpire producer.");
      }
      return {
        ordinal: ordinal++,
        intendedTarget: issued.commanded.targetPlatePosition,
        result: {
          authority: issued.authority,
          kind: issued.kind,
          result: issued.result,
          events: issued.events,
          samples: issued.samples,
          frames: issued.frames,
          nextMatchState: issued.nextMatchState,
          requiresOfficialLiveBallResolution: issued.requiresOfficialLiveBallResolution
        },
        eventKinds: issued.events.map((event) => event.kind),
        count: timeline.status.kind === "active" ? { balls: timeline.status.count.balls, strikes: timeline.status.count.strikes } : null,
        phase: issued.kind === "unresolved" ? "unresolved" : timeline.status.kind
      };
    };
    return Object.freeze({ issue, inspect });
  }

  // src/core/sim/contact/SwingKinematicsV1.ts
  var SWING_KINEMATICS_V1_VERSION = "swing-kinematics-v1";
  var EPSILON4 = 1e-12;
  var add2 = (first, second) => ({
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z
  });
  var subtract2 = (first, second) => ({
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z
  });
  var scale2 = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var dot2 = (first, second) => first.x * second.x + first.y * second.y + first.z * second.z;
  var cross2 = (first, second) => ({
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x
  });
  var magnitude2 = (value) => Math.hypot(
    value.x,
    value.y,
    value.z
  );
  var normalize2 = (value) => {
    const length = magnitude2(value);
    if (!Number.isFinite(length) || length <= EPSILON4) {
      throw new Error(
        "swing kinematics bat axis must be finite and non-zero"
      );
    }
    return scale2(
      value,
      1 / length
    );
  };
  var tangentProjection = (axis, derivative) => subtract2(
    derivative,
    scale2(
      axis,
      dot2(axis, derivative)
    )
  );
  var validateVec33 = (name, value) => {
    for (const component of [
      value.x,
      value.y,
      value.z
    ]) {
      if (!Number.isFinite(component)) {
        throw new Error(
          `${name} must contain only finite values`
        );
      }
    }
  };
  var validateTrajectory = (trajectory) => {
    if (trajectory.version !== SWING_KINEMATICS_V1_VERSION) {
      throw new Error(
        "unsupported swing kinematics trajectory version"
      );
    }
    if (!Number.isSafeInteger(
      trajectory.startTick
    ) || !Number.isSafeInteger(
      trajectory.contactTick
    ) || !Number.isSafeInteger(
      trajectory.endTick
    ) || trajectory.startTick >= trajectory.contactTick || trajectory.contactTick >= trajectory.endTick) {
      throw new Error(
        "swing kinematics ticks must be safe integers with start < contact < end"
      );
    }
    if (!Number.isSafeInteger(
      trajectory.ticksPerSecond
    ) || trajectory.ticksPerSecond <= 0) {
      throw new Error(
        "swing kinematics ticksPerSecond must be a positive safe integer"
      );
    }
    if (!Number.isFinite(
      trajectory.batLengthM
    ) || trajectory.batLengthM <= 0) {
      throw new Error(
        "swing kinematics batLengthM must be finite and positive"
      );
    }
    if (!Number.isFinite(
      trajectory.sweetSpotT
    ) || trajectory.sweetSpotT <= 0 || trajectory.sweetSpotT >= 1) {
      throw new Error(
        "swing kinematics sweetSpotT must lie strictly within (0, 1)"
      );
    }
    for (const [
      name,
      knot
    ] of [
      ["start", trajectory.start],
      ["contact", trajectory.contact],
      ["finish", trajectory.finish]
    ]) {
      validateVec33(
        `${name}.sweetSpotPosition`,
        knot.sweetSpotPosition
      );
      validateVec33(
        `${name}.sweetSpotVelocity`,
        knot.sweetSpotVelocity
      );
      validateVec33(
        `${name}.batAxis`,
        knot.batAxis
      );
      validateVec33(
        `${name}.batAxisDerivative`,
        knot.batAxisDerivative
      );
      const axisLength = magnitude2(knot.batAxis);
      if (Math.abs(axisLength - 1) > 1e-9) {
        throw new Error(
          `${name}.batAxis must be normalized`
        );
      }
      if (Math.abs(
        dot2(
          knot.batAxis,
          knot.batAxisDerivative
        )
      ) > 1e-8) {
        throw new Error(
          `${name}.batAxisDerivative must be tangent to batAxis`
        );
      }
    }
  };
  var estimateEndpointAxisDerivative = (fromAxis, toAxis, durationSeconds, scaleFactor) => {
    const raw = scale2(
      subtract2(
        toAxis,
        fromAxis
      ),
      scaleFactor / durationSeconds
    );
    return tangentProjection(
      fromAxis,
      raw
    );
  };
  var estimateSharedContactAxisDerivative = (startAxis, contactAxis, finishAxis, totalSeconds) => {
    const raw = scale2(
      subtract2(
        finishAxis,
        startAxis
      ),
      1 / totalSeconds
    );
    return tangentProjection(
      contactAxis,
      raw
    );
  };
  var createSwingKinematicsTrajectoryV1 = (input) => {
    if (!Number.isSafeInteger(
      input.startTick
    ) || !Number.isSafeInteger(
      input.contactTick
    ) || !Number.isSafeInteger(
      input.endTick
    ) || input.startTick >= input.contactTick || input.contactTick >= input.endTick) {
      throw new Error(
        "swing kinematics input ticks must satisfy start < contact < end"
      );
    }
    if (!Number.isSafeInteger(
      input.ticksPerSecond
    ) || input.ticksPerSecond <= 0) {
      throw new Error(
        "swing kinematics input ticksPerSecond must be a positive safe integer"
      );
    }
    const startAxis = normalize2(
      input.start.batAxis
    );
    const contactAxis = normalize2(
      input.contact.batAxis
    );
    const finishAxis = normalize2(
      input.finish.batAxis
    );
    const preContactSeconds = (input.contactTick - input.startTick) / input.ticksPerSecond;
    const postContactSeconds = (input.endTick - input.contactTick) / input.ticksPerSecond;
    const totalSeconds = preContactSeconds + postContactSeconds;
    const contactAxisDerivative = estimateSharedContactAxisDerivative(
      startAxis,
      contactAxis,
      finishAxis,
      totalSeconds
    );
    const trajectory = {
      version: SWING_KINEMATICS_V1_VERSION,
      startTick: input.startTick,
      contactTick: input.contactTick,
      endTick: input.endTick,
      ticksPerSecond: input.ticksPerSecond,
      batLengthM: input.batLengthM,
      sweetSpotT: input.sweetSpotT,
      start: {
        sweetSpotPosition: input.start.sweetSpotPosition,
        sweetSpotVelocity: input.start.sweetSpotVelocity,
        batAxis: startAxis,
        batAxisDerivative: estimateEndpointAxisDerivative(
          startAxis,
          contactAxis,
          preContactSeconds,
          0.45
        )
      },
      contact: {
        sweetSpotPosition: input.contact.sweetSpotPosition,
        sweetSpotVelocity: input.contact.sweetSpotVelocity,
        batAxis: contactAxis,
        batAxisDerivative: contactAxisDerivative
      },
      finish: {
        sweetSpotPosition: input.finish.sweetSpotPosition,
        sweetSpotVelocity: input.finish.sweetSpotVelocity,
        batAxis: finishAxis,
        batAxisDerivative: estimateEndpointAxisDerivative(
          finishAxis,
          contactAxis,
          postContactSeconds,
          -0.35
        )
      }
    };
    validateTrajectory(
      trajectory
    );
    return trajectory;
  };
  var sampleHermite = (startValue, startDerivativePerSecond, endValue, endDerivativePerSecond, durationSeconds, u) => {
    const clamped = Math.max(
      0,
      Math.min(1, u)
    );
    const u2 = clamped * clamped;
    const u3 = u2 * clamped;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + clamped;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const value = add2(
      add2(
        scale2(
          startValue,
          h00
        ),
        scale2(
          startDerivativePerSecond,
          h10 * durationSeconds
        )
      ),
      add2(
        scale2(
          endValue,
          h01
        ),
        scale2(
          endDerivativePerSecond,
          h11 * durationSeconds
        )
      )
    );
    const dh00 = 6 * u2 - 6 * clamped;
    const dh10 = 3 * u2 - 4 * clamped + 1;
    const dh01 = -6 * u2 + 6 * clamped;
    const dh11 = 3 * u2 - 2 * clamped;
    const derivativePerU = add2(
      add2(
        scale2(
          startValue,
          dh00
        ),
        scale2(
          startDerivativePerSecond,
          dh10 * durationSeconds
        )
      ),
      add2(
        scale2(
          endValue,
          dh01
        ),
        scale2(
          endDerivativePerSecond,
          dh11 * durationSeconds
        )
      )
    );
    return {
      value,
      derivativePerSecond: scale2(
        derivativePerU,
        1 / durationSeconds
      )
    };
  };
  var normalizeWithDerivative = (value, derivativePerSecond) => {
    const length = magnitude2(value);
    if (!Number.isFinite(length) || length <= EPSILON4) {
      throw new Error(
        "swing kinematics interpolated bat axis collapsed to zero"
      );
    }
    const axis = scale2(
      value,
      1 / length
    );
    const tangent = subtract2(
      derivativePerSecond,
      scale2(
        axis,
        dot2(
          axis,
          derivativePerSecond
        )
      )
    );
    return {
      axis,
      derivativePerSecond: scale2(
        tangent,
        1 / length
      )
    };
  };
  var sampleSegment = (start, end, startTick, endTick, sampleTick, ticksPerSecond) => {
    const durationTicks = endTick - startTick;
    const durationSeconds = durationTicks / ticksPerSecond;
    const u = (sampleTick - startTick) / durationTicks;
    const sweetSpot = sampleHermite(
      start.sweetSpotPosition,
      start.sweetSpotVelocity,
      end.sweetSpotPosition,
      end.sweetSpotVelocity,
      durationSeconds,
      u
    );
    const axisRaw = sampleHermite(
      start.batAxis,
      start.batAxisDerivative,
      end.batAxis,
      end.batAxisDerivative,
      durationSeconds,
      u
    );
    const axis = normalizeWithDerivative(
      axisRaw.value,
      axisRaw.derivativePerSecond
    );
    return {
      sweetSpotPosition: sweetSpot.value,
      sweetSpotVelocity: sweetSpot.derivativePerSecond,
      batAxis: axis.axis,
      batAxisDerivative: axis.derivativePerSecond
    };
  };
  var sampleSwingKinematicsV1 = (trajectory, tick) => {
    validateTrajectory(
      trajectory
    );
    if (!Number.isSafeInteger(tick) || tick < trajectory.startTick || tick > trajectory.endTick) {
      throw new Error(
        "swing kinematics sample tick must lie within the trajectory interval"
      );
    }
    const phase = tick < trajectory.contactTick ? "pre_contact" : tick === trajectory.contactTick ? "contact" : "follow_through";
    const sampled = tick <= trajectory.contactTick ? sampleSegment(
      trajectory.start,
      trajectory.contact,
      trajectory.startTick,
      trajectory.contactTick,
      tick,
      trajectory.ticksPerSecond
    ) : sampleSegment(
      trajectory.contact,
      trajectory.finish,
      trajectory.contactTick,
      trajectory.endTick,
      tick,
      trajectory.ticksPerSecond
    );
    const grip = subtract2(
      sampled.sweetSpotPosition,
      scale2(
        sampled.batAxis,
        trajectory.batLengthM * trajectory.sweetSpotT
      )
    );
    const tip = add2(
      grip,
      scale2(
        sampled.batAxis,
        trajectory.batLengthM
      )
    );
    const gripVelocity = subtract2(
      sampled.sweetSpotVelocity,
      scale2(
        sampled.batAxisDerivative,
        trajectory.batLengthM * trajectory.sweetSpotT
      )
    );
    const angularVelocity = cross2(
      sampled.batAxis,
      sampled.batAxisDerivative
    );
    return {
      tick,
      phase,
      sweetSpotPosition: sampled.sweetSpotPosition,
      sweetSpotVelocity: sampled.sweetSpotVelocity,
      batAxis: sampled.batAxis,
      batAxisDerivative: sampled.batAxisDerivative,
      swingState: {
        pose: {
          grip,
          tip
        },
        linearVelocity: gripVelocity,
        angularVelocity
      }
    };
  };
  var sampleSwingStateV1 = (trajectory, tick) => sampleSwingKinematicsV1(
    trajectory,
    tick
  ).swingState;

  // src/core/sim/ball/BaseballSpinDecay.ts
  var NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE = Object.freeze({
    referenceSpeedMps: 44.704,
    timeConstantSecondsAtReferenceSpeed: 20
  });
  var magnitude4 = (value) => Math.hypot(
    value.x,
    value.y,
    value.z
  );
  var scale3 = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var validateBaseballSpinDecayParameters = (parameters) => {
    if (!Number.isFinite(
      parameters.referenceSpeedMps
    ) || parameters.referenceSpeedMps <= 0 || !Number.isFinite(
      parameters.timeConstantSecondsAtReferenceSpeed
    ) || parameters.timeConstantSecondsAtReferenceSpeed <= 0) {
      throw new Error(
        "baseball spin-decay reference speed and time constant must be finite and positive"
      );
    }
  };
  var calculateBaseballSpinDecayTimeConstantSeconds = (airRelativeSpeedMps, parameters = NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE) => {
    validateBaseballSpinDecayParameters(
      parameters
    );
    if (!Number.isFinite(
      airRelativeSpeedMps
    ) || airRelativeSpeedMps < 0) {
      throw new Error(
        "airRelativeSpeedMps must be finite and non-negative"
      );
    }
    if (airRelativeSpeedMps <= 1e-12) {
      return Infinity;
    }
    return parameters.timeConstantSecondsAtReferenceSpeed * parameters.referenceSpeedMps / airRelativeSpeedMps;
  };
  var calculateBaseballSpinDecayDerivative = (spinRadPerSecond, airRelativeVelocityMps, parameters) => {
    const speed = magnitude4(
      airRelativeVelocityMps
    );
    const tau = calculateBaseballSpinDecayTimeConstantSeconds(
      speed,
      parameters
    );
    if (!Number.isFinite(tau)) {
      return {
        x: 0,
        y: 0,
        z: 0
      };
    }
    return scale3(
      spinRadPerSecond,
      -1 / tau
    );
  };

  // src/core/sim/ball/BaseballAerodynamicCoefficientProfile.ts
  var lerp = (a, b, t) => a + (b - a) * t;
  var validateAscending = (name, values) => {
    for (let index = 1; index < values.length; index += 1) {
      if (!(values[index] > values[index - 1])) {
        throw new Error(
          `${name} must be strictly increasing`
        );
      }
    }
  };
  var validateBaseballAerodynamicCoefficientProfile = (profile) => {
    if (profile.profileId.length === 0 || profile.version.length === 0) {
      throw new Error(
        "aerodynamic coefficient profile id/version must not be empty"
      );
    }
    if (!Number.isFinite(
      profile.referenceReynoldsNumber
    ) || profile.referenceReynoldsNumber <= 0) {
      throw new Error(
        "referenceReynoldsNumber must be finite and positive"
      );
    }
    if (profile.spinKnots.length < 2) {
      throw new Error(
        "aerodynamic coefficient profile requires at least two spin knots"
      );
    }
    if (profile.reynoldsKnots.length < 2) {
      throw new Error(
        "aerodynamic coefficient profile requires at least two Reynolds knots"
      );
    }
    validateAscending(
      "spin factors",
      profile.spinKnots.map(
        (knot) => knot.spinFactor
      )
    );
    validateAscending(
      "Reynolds numbers",
      profile.reynoldsKnots.map(
        (knot) => knot.reynoldsNumber
      )
    );
    for (const knot of profile.spinKnots) {
      if (!Number.isFinite(knot.spinFactor) || knot.spinFactor < 0 || !Number.isFinite(
        knot.dragCoefficientAtReferenceRe
      ) || knot.dragCoefficientAtReferenceRe < 0 || !Number.isFinite(
        knot.liftCoefficient
      ) || knot.liftCoefficient < 0) {
        throw new Error(
          "aerodynamic spin knots must contain finite non-negative values"
        );
      }
    }
    for (const knot of profile.reynoldsKnots) {
      if (!Number.isFinite(
        knot.reynoldsNumber
      ) || knot.reynoldsNumber <= 0 || !Number.isFinite(
        knot.dragCorrectionFactorAtLowSpin
      ) || knot.dragCorrectionFactorAtLowSpin < 0) {
        throw new Error(
          "aerodynamic Reynolds knots must contain finite positive Re and non-negative correction"
        );
      }
    }
    if (!Number.isFinite(
      profile.reynoldsCorrectionFullThroughSpinFactor
    ) || !Number.isFinite(
      profile.reynoldsCorrectionZeroAtSpinFactor
    ) || profile.reynoldsCorrectionFullThroughSpinFactor < 0 || profile.reynoldsCorrectionZeroAtSpinFactor <= profile.reynoldsCorrectionFullThroughSpinFactor) {
      throw new Error(
        "aerodynamic Reynolds spin-blend thresholds must be finite and ordered"
      );
    }
  };
  var interpolate = (x, xs, ys) => {
    if (x <= xs[0]) {
      return ys[0];
    }
    if (x >= xs[xs.length - 1]) {
      return ys[ys.length - 1];
    }
    for (let index = 1; index < xs.length; index += 1) {
      const rightX = xs[index];
      if (x > rightX) {
        continue;
      }
      const leftX = xs[index - 1];
      const t = (x - leftX) / (rightX - leftX);
      return lerp(
        ys[index - 1],
        ys[index],
        t
      );
    }
    throw new Error(
      "unreachable aerodynamic interpolation interval"
    );
  };
  var resolveBaseballAerodynamicCoefficients = (profile, reynoldsNumber, spinFactor) => {
    validateBaseballAerodynamicCoefficientProfile(
      profile
    );
    if (!Number.isFinite(reynoldsNumber) || reynoldsNumber < 0 || !Number.isFinite(spinFactor) || spinFactor < 0) {
      throw new Error(
        "Reynolds number and spin factor must be finite and non-negative"
      );
    }
    const spinXs = profile.spinKnots.map(
      (knot) => knot.spinFactor
    );
    const baseDrag = interpolate(
      spinFactor,
      spinXs,
      profile.spinKnots.map(
        (knot) => knot.dragCoefficientAtReferenceRe
      )
    );
    const liftCoefficient = interpolate(
      spinFactor,
      spinXs,
      profile.spinKnots.map(
        (knot) => knot.liftCoefficient
      )
    );
    const reynoldsCorrection = interpolate(
      reynoldsNumber,
      profile.reynoldsKnots.map(
        (knot) => knot.reynoldsNumber
      ),
      profile.reynoldsKnots.map(
        (knot) => knot.dragCorrectionFactorAtLowSpin
      )
    );
    const full = profile.reynoldsCorrectionFullThroughSpinFactor;
    const zero = profile.reynoldsCorrectionZeroAtSpinFactor;
    const blend = spinFactor <= full ? 1 : spinFactor >= zero ? 0 : (zero - spinFactor) / (zero - full);
    return {
      dragCoefficient: baseDrag * (1 + blend * (reynoldsCorrection - 1)),
      liftCoefficient: spinFactor <= 0 ? 0 : liftCoefficient
    };
  };
  var LYU_2022_SEAM_AVERAGED_AERO_PROFILE = Object.freeze({
    profileId: "lyu-2022-seam-averaged",
    version: "lyu-2022-figure-digitization-v1",
    referenceReynoldsNumber: 144e3,
    spinKnots: Object.freeze([
      {
        spinFactor: 0,
        dragCoefficientAtReferenceRe: 0.35,
        liftCoefficient: 0
      },
      {
        spinFactor: 0.05,
        dragCoefficientAtReferenceRe: 0.34,
        liftCoefficient: 0.1
      },
      {
        spinFactor: 0.1,
        dragCoefficientAtReferenceRe: 0.32,
        liftCoefficient: 0.115
      },
      {
        spinFactor: 0.15,
        dragCoefficientAtReferenceRe: 0.32,
        liftCoefficient: 0.17
      },
      {
        spinFactor: 0.2,
        dragCoefficientAtReferenceRe: 0.33,
        liftCoefficient: 0.195
      },
      {
        spinFactor: 0.25,
        dragCoefficientAtReferenceRe: 0.34,
        liftCoefficient: 0.23
      },
      {
        spinFactor: 0.3,
        dragCoefficientAtReferenceRe: 0.36,
        liftCoefficient: 0.27
      },
      {
        spinFactor: 0.35,
        dragCoefficientAtReferenceRe: 0.38,
        liftCoefficient: 0.305
      },
      {
        spinFactor: 0.4,
        dragCoefficientAtReferenceRe: 0.39,
        liftCoefficient: 0.34
      },
      {
        spinFactor: 0.45,
        dragCoefficientAtReferenceRe: 0.41,
        liftCoefficient: 0.385
      },
      {
        spinFactor: 0.5,
        dragCoefficientAtReferenceRe: 0.42,
        liftCoefficient: 0.4
      }
    ]),
    reynoldsKnots: Object.freeze([
      {
        reynoldsNumber: 75e3,
        dragCorrectionFactorAtLowSpin: 0.46 / 0.34
      },
      {
        reynoldsNumber: 1e5,
        dragCorrectionFactorAtLowSpin: 0.44 / 0.34
      },
      {
        reynoldsNumber: 125e3,
        dragCorrectionFactorAtLowSpin: 0.42 / 0.34
      },
      {
        reynoldsNumber: 15e4,
        dragCorrectionFactorAtLowSpin: 0.36 / 0.34
      },
      {
        reynoldsNumber: 175e3,
        dragCorrectionFactorAtLowSpin: 0.32 / 0.34
      },
      {
        reynoldsNumber: 2e5,
        dragCorrectionFactorAtLowSpin: 0.34 / 0.34
      },
      {
        reynoldsNumber: 25e4,
        dragCorrectionFactorAtLowSpin: 0.35 / 0.34
      }
    ]),
    reynoldsCorrectionFullThroughSpinFactor: 0.05,
    reynoldsCorrectionZeroAtSpinFactor: 0.15
  });

  // src/core/sim/ball/BaseballAerodynamics.ts
  var REFERENCE_BASEBALL_AERODYNAMICS = Object.freeze({
    ballMassKg: 0.145,
    ballRadiusM: 0.0366,
    airDensityKgM3: 1.225,
    windVelocityMps: Object.freeze({ x: 0, y: 0, z: 0 }),
    dragCoefficient: 0.35
  });
  var REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS = Object.freeze({
    ...REFERENCE_BASEBALL_AERODYNAMICS,
    coefficientProfile: LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
    airKinematicViscosityM2PerSecond: 15e-6,
    spinDecay: NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE
  });
  var EPSILON5 = 1e-12;
  var add4 = (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  });
  var subtract4 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var scale4 = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var cross4 = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  var magnitude5 = (value) => Math.hypot(value.x, value.y, value.z);
  var validateParameters2 = (parameters) => {
    if (!Number.isFinite(parameters.ballMassKg) || parameters.ballMassKg <= 0) {
      throw new Error("ballMassKg must be finite and positive");
    }
    if (!Number.isFinite(parameters.ballRadiusM) || parameters.ballRadiusM <= 0) {
      throw new Error("ballRadiusM must be finite and positive");
    }
    if (!Number.isFinite(parameters.airDensityKgM3) || parameters.airDensityKgM3 < 0) {
      throw new Error("airDensityKgM3 must be finite and non-negative");
    }
    if (!Number.isFinite(parameters.dragCoefficient) || parameters.dragCoefficient < 0) {
      throw new Error("dragCoefficient must be finite and non-negative");
    }
    if (parameters.spinDecay !== void 0) {
      validateBaseballSpinDecayParameters(
        parameters.spinDecay
      );
    }
    if (parameters.coefficientProfile !== void 0) {
      validateBaseballAerodynamicCoefficientProfile(
        parameters.coefficientProfile
      );
      if (!Number.isFinite(
        parameters.airKinematicViscosityM2PerSecond
      ) || (parameters.airKinematicViscosityM2PerSecond ?? 0) <= 0) {
        throw new Error(
          "airKinematicViscosityM2PerSecond must be finite and positive when coefficientProfile is enabled"
        );
      }
    }
    for (const component of [
      parameters.windVelocityMps.x,
      parameters.windVelocityMps.y,
      parameters.windVelocityMps.z
    ]) {
      if (!Number.isFinite(component)) {
        throw new Error("windVelocityMps must contain only finite values");
      }
    }
  };
  var calculateBaseballLiftCoefficient = (spinFactor) => {
    if (!Number.isFinite(spinFactor) || spinFactor < 0) {
      throw new Error("spinFactor must be finite and non-negative");
    }
    return spinFactor <= 0.1 ? 1.5 * spinFactor : 0.09 + 0.6 * spinFactor;
  };
  var calculateBaseballAerodynamics = (ballVelocityMps, ballSpinRadPerSecond, parameters = REFERENCE_BASEBALL_AERODYNAMICS) => {
    validateParameters2(parameters);
    const relativeAirVelocity = subtract4(
      ballVelocityMps,
      parameters.windVelocityMps
    );
    const speed = magnitude5(relativeAirVelocity);
    if (speed <= EPSILON5 || parameters.airDensityKgM3 <= EPSILON5) {
      const zero = { x: 0, y: 0, z: 0 };
      return {
        relativeAirVelocity,
        activeSpin: zero,
        spinFactor: 0,
        reynoldsNumber: null,
        dragCoefficientUsed: parameters.dragCoefficient,
        liftCoefficientUsed: 0,
        dragAcceleration: zero,
        liftAcceleration: zero,
        totalAcceleration: zero
      };
    }
    const velocityHat = scale4(relativeAirVelocity, 1 / speed);
    const parallelSpin = scale4(
      velocityHat,
      dot3(ballSpinRadPerSecond, velocityHat)
    );
    const activeSpin = subtract4(ballSpinRadPerSecond, parallelSpin);
    const activeSpinMagnitude = magnitude5(activeSpin);
    const spinFactor = parameters.ballRadiusM * activeSpinMagnitude / speed;
    const area = Math.PI * parameters.ballRadiusM * parameters.ballRadiusM;
    const dynamicAccelerationScale = 0.5 * parameters.airDensityKgM3 * area * speed * speed / parameters.ballMassKg;
    const reynoldsNumber = parameters.coefficientProfile === void 0 ? null : speed * (2 * parameters.ballRadiusM) / parameters.airKinematicViscosityM2PerSecond;
    const resolvedCoefficients = parameters.coefficientProfile === void 0 ? {
      dragCoefficient: parameters.dragCoefficient,
      liftCoefficient: calculateBaseballLiftCoefficient(
        spinFactor
      )
    } : resolveBaseballAerodynamicCoefficients(
      parameters.coefficientProfile,
      reynoldsNumber,
      spinFactor
    );
    const dragAcceleration = scale4(
      velocityHat,
      -dynamicAccelerationScale * resolvedCoefficients.dragCoefficient
    );
    let liftAcceleration = { x: 0, y: 0, z: 0 };
    if (activeSpinMagnitude > EPSILON5) {
      const liftDirectionRaw = cross4(activeSpin, velocityHat);
      const liftDirectionMagnitude = magnitude5(liftDirectionRaw);
      if (liftDirectionMagnitude > EPSILON5) {
        liftAcceleration = scale4(
          liftDirectionRaw,
          dynamicAccelerationScale * resolvedCoefficients.liftCoefficient / liftDirectionMagnitude
        );
      }
    }
    return {
      relativeAirVelocity,
      activeSpin,
      spinFactor,
      reynoldsNumber,
      dragCoefficientUsed: resolvedCoefficients.dragCoefficient,
      liftCoefficientUsed: resolvedCoefficients.liftCoefficient,
      dragAcceleration,
      liftAcceleration,
      totalAcceleration: add4(dragAcceleration, liftAcceleration)
    };
  };

  // src/core/sim/pitching/PitchSpinPhysics.ts
  var EPSILON6 = 1e-12;
  var scale5 = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var subtract5 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var dot4 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var cross5 = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  var magnitude6 = (value) => Math.hypot(value.x, value.y, value.z);
  var normalize3 = (value) => {
    const length = magnitude6(value);
    if (length <= EPSILON6) {
      throw new Error("cannot normalize a zero-length vector");
    }
    return scale5(value, 1 / length);
  };
  var decomposePitchSpin = (velocityMps, spinRadPerSecond) => {
    const speed = magnitude6(velocityMps);
    if (speed <= EPSILON6) {
      throw new Error(
        "pitch velocity must be non-zero for spin decomposition"
      );
    }
    const velocityDirection = scale5(
      velocityMps,
      1 / speed
    );
    const signedGyroRate = dot4(
      spinRadPerSecond,
      velocityDirection
    );
    const gyroSpin = Math.abs(signedGyroRate) <= EPSILON6 ? { x: 0, y: 0, z: 0 } : scale5(
      velocityDirection,
      signedGyroRate
    );
    const activeSpin = subtract5(
      spinRadPerSecond,
      gyroSpin
    );
    const totalSpinRadPerSecond = magnitude6(
      spinRadPerSecond
    );
    const activeSpinRadPerSecond = magnitude6(
      activeSpin
    );
    const gyroSpinRadPerSecond = Math.abs(
      signedGyroRate
    );
    const activeSpinFraction = totalSpinRadPerSecond <= EPSILON6 ? 0 : activeSpinRadPerSecond / totalSpinRadPerSecond;
    const gyroSpinFraction = totalSpinRadPerSecond <= EPSILON6 ? 0 : gyroSpinRadPerSecond / totalSpinRadPerSecond;
    const magnusRaw = cross5(
      activeSpin,
      velocityDirection
    );
    const magnusDirection = magnitude6(magnusRaw) <= EPSILON6 ? null : normalize3(magnusRaw);
    return {
      velocityDirection,
      activeSpin,
      gyroSpin,
      totalSpinRadPerSecond,
      activeSpinRadPerSecond,
      gyroSpinRadPerSecond,
      activeSpinFraction,
      gyroSpinFraction,
      magnusDirection
    };
  };

  // src/core/sim/pitching/BaseballOrientation.ts
  var IDENTITY_QUATERNION = Object.freeze({
    w: 1,
    x: 0,
    y: 0,
    z: 0
  });
  var EPSILON7 = 1e-12;
  var magnitude7 = (value) => Math.hypot(value.x, value.y, value.z);
  var scale6 = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var normalizeQuaternion = (value) => {
    const length = Math.hypot(
      value.w,
      value.x,
      value.y,
      value.z
    );
    if (!Number.isFinite(length) || length <= EPSILON7) {
      throw new Error(
        "quaternion must have finite non-zero magnitude"
      );
    }
    return {
      w: value.w / length,
      x: value.x / length,
      y: value.y / length,
      z: value.z / length
    };
  };
  var multiplyQuaternions = (a, b) => ({
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  });
  var quaternionFromAxisAngle = (axis, angleRadians) => {
    if (!Number.isFinite(angleRadians)) {
      throw new Error("angleRadians must be finite");
    }
    const axisMagnitude = magnitude7(axis);
    if (axisMagnitude <= EPSILON7) {
      if (Math.abs(angleRadians) <= EPSILON7) {
        return IDENTITY_QUATERNION;
      }
      throw new Error(
        "axis must be non-zero for a non-zero rotation"
      );
    }
    const unitAxis = scale6(
      axis,
      1 / axisMagnitude
    );
    const half = angleRadians / 2;
    const sine = Math.sin(half);
    return normalizeQuaternion({
      w: Math.cos(half),
      x: unitAxis.x * sine,
      y: unitAxis.y * sine,
      z: unitAxis.z * sine
    });
  };
  var advanceBaseballOrientation = (orientation, angularVelocityWorldRadPerSecond, elapsedSeconds) => {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new Error(
        "elapsedSeconds must be finite and non-negative"
      );
    }
    const spinRate = magnitude7(
      angularVelocityWorldRadPerSecond
    );
    if (spinRate <= EPSILON7 || elapsedSeconds <= EPSILON7) {
      return normalizeQuaternion(orientation);
    }
    const delta = quaternionFromAxisAngle(
      angularVelocityWorldRadPerSecond,
      spinRate * elapsedSeconds
    );
    return normalizeQuaternion(
      multiplyQuaternions(
        delta,
        normalizeQuaternion(orientation)
      )
    );
  };

  // src/core/sim/pitching/AerodynamicPitchTrajectory.ts
  var EPSILON8 = 1e-12;
  var add5 = (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  });
  var subtract6 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var scale7 = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var weightedSum = (a, b, c, d) => ({
    x: a.x + 2 * b.x + 2 * c.x + d.x,
    y: a.y + 2 * b.y + 2 * c.y + d.y,
    z: a.z + 2 * b.z + 2 * c.z + d.z
  });
  var lerpVec3 = (a, b, t) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  });
  var validateParameters3 = (parameters) => {
    if (!Number.isSafeInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
      throw new Error(
        "pitch aerodynamics ticksPerSecond must be a positive safe integer"
      );
    }
    if (!Number.isSafeInteger(parameters.integrationStepTicks) || parameters.integrationStepTicks <= 0) {
      throw new Error(
        "pitch aerodynamics integrationStepTicks must be a positive safe integer"
      );
    }
    if (!Number.isFinite(parameters.gravityY)) {
      throw new Error(
        "pitch aerodynamics gravityY must be finite"
      );
    }
  };
  var validateTrajectory2 = (trajectory) => {
    validateParameters3(trajectory.parameters);
    if (!Number.isSafeInteger(trajectory.start.tick) || trajectory.start.tick < 0) {
      throw new Error(
        "aerodynamic pitch start tick must be a non-negative safe integer"
      );
    }
    if (!Number.isSafeInteger(trajectory.endTick) || trajectory.endTick < trajectory.start.tick) {
      throw new Error(
        "aerodynamic pitch endTick must be a safe integer at or after start"
      );
    }
  };
  var accelerationAt = (velocity, spin, parameters) => {
    const aerodynamic = calculateBaseballAerodynamics(
      velocity,
      spin,
      parameters.aerodynamics
    );
    return {
      x: aerodynamic.totalAcceleration.x,
      y: aerodynamic.totalAcceleration.y + parameters.gravityY,
      z: aerodynamic.totalAcceleration.z
    };
  };
  var spinDerivativeAt = (velocity, spin, parameters) => {
    const decay = parameters.aerodynamics.spinDecay;
    if (decay === void 0) {
      return {
        x: 0,
        y: 0,
        z: 0
      };
    }
    return calculateBaseballSpinDecayDerivative(
      spin,
      subtract6(
        velocity,
        parameters.aerodynamics.windVelocityMps
      ),
      decay
    );
  };
  var advanceAerodynamicPitchStep = (state, stepTicks, parameters) => {
    const dt = stepTicks / parameters.ticksPerSecond;
    const k1Position = state.velocity;
    const k1Velocity = accelerationAt(
      state.velocity,
      state.spin,
      parameters
    );
    const k1Spin = spinDerivativeAt(
      state.velocity,
      state.spin,
      parameters
    );
    const k2VelocityInput = add5(
      state.velocity,
      scale7(k1Velocity, dt / 2)
    );
    const k2SpinInput = add5(
      state.spin,
      scale7(k1Spin, dt / 2)
    );
    const k2Position = k2VelocityInput;
    const k2Velocity = accelerationAt(
      k2VelocityInput,
      k2SpinInput,
      parameters
    );
    const k2Spin = spinDerivativeAt(
      k2VelocityInput,
      k2SpinInput,
      parameters
    );
    const k3VelocityInput = add5(
      state.velocity,
      scale7(k2Velocity, dt / 2)
    );
    const k3SpinInput = add5(
      state.spin,
      scale7(k2Spin, dt / 2)
    );
    const k3Position = k3VelocityInput;
    const k3Velocity = accelerationAt(
      k3VelocityInput,
      k3SpinInput,
      parameters
    );
    const k3Spin = spinDerivativeAt(
      k3VelocityInput,
      k3SpinInput,
      parameters
    );
    const k4VelocityInput = add5(
      state.velocity,
      scale7(k3Velocity, dt)
    );
    const k4SpinInput = add5(
      state.spin,
      scale7(k3Spin, dt)
    );
    const k4Position = k4VelocityInput;
    const k4Velocity = accelerationAt(
      k4VelocityInput,
      k4SpinInput,
      parameters
    );
    const k4Spin = spinDerivativeAt(
      k4VelocityInput,
      k4SpinInput,
      parameters
    );
    return {
      tick: state.tick + stepTicks,
      position: add5(
        state.position,
        scale7(
          weightedSum(
            k1Position,
            k2Position,
            k3Position,
            k4Position
          ),
          dt / 6
        )
      ),
      velocity: add5(
        state.velocity,
        scale7(
          weightedSum(
            k1Velocity,
            k2Velocity,
            k3Velocity,
            k4Velocity
          ),
          dt / 6
        )
      ),
      // Aerodynamic torque changes spin magnitude only in the current model;
      // no unmeasured precession is manufactured.
      spin: add5(
        state.spin,
        scale7(
          weightedSum(
            k1Spin,
            k2Spin,
            k3Spin,
            k4Spin
          ),
          dt / 6
        )
      )
    };
  };
  var advanceAerodynamicPitchState = (state, deltaTicks, parameters) => {
    validateParameters3(parameters);
    if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0) {
      throw new Error(
        "aerodynamic pitch deltaTicks must be a non-negative safe integer"
      );
    }
    let current = state;
    let remaining = deltaTicks;
    while (remaining > 0) {
      const stepTicks = Math.min(
        parameters.integrationStepTicks,
        remaining
      );
      current = advanceAerodynamicPitchStep(
        current,
        stepTicks,
        parameters
      );
      remaining -= stepTicks;
    }
    return current;
  };
  var sampleAerodynamicPitchTrajectory = (trajectory, tick) => {
    validateTrajectory2(trajectory);
    if (!Number.isSafeInteger(tick) || tick < trajectory.start.tick || tick > trajectory.endTick) {
      throw new Error(
        "aerodynamic pitch sample tick must lie inside the trajectory interval"
      );
    }
    return advanceAerodynamicPitchState(
      trajectory.start,
      tick - trajectory.start.tick,
      trajectory.parameters
    );
  };
  var sampleAerodynamicPitchOrientation = (trajectory, elapsedSeconds) => {
    if (trajectory.releaseOrientation === void 0) {
      return void 0;
    }
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new Error(
        "pitch orientation elapsedSeconds must be finite and non-negative"
      );
    }
    return advanceBaseballOrientation(
      normalizeQuaternion(
        trajectory.releaseOrientation
      ),
      trajectory.start.spin,
      elapsedSeconds
    );
  };
  var crossedPlate = (startZ, currentZ, plateZ) => startZ > plateZ ? currentZ <= plateZ : currentZ >= plateZ;
  var findAerodynamicPitchPlateCrossing = (trajectory, plateZ) => {
    validateTrajectory2(trajectory);
    if (!Number.isFinite(plateZ)) {
      throw new Error("plateZ must be finite");
    }
    if (Math.abs(
      trajectory.start.position.z - plateZ
    ) <= EPSILON8) {
      return {
        tick: trajectory.start.tick,
        elapsedSeconds: 0,
        position: {
          ...trajectory.start.position,
          z: plateZ
        },
        velocity: trajectory.start.velocity,
        spin: trajectory.start.spin,
        spinDecomposition: decomposePitchSpin(
          trajectory.start.velocity,
          trajectory.start.spin
        ),
        orientation: sampleAerodynamicPitchOrientation(
          trajectory,
          0
        )
      };
    }
    const end = sampleAerodynamicPitchTrajectory(
      trajectory,
      trajectory.endTick
    );
    if (!crossedPlate(
      trajectory.start.position.z,
      end.position.z,
      plateZ
    )) {
      return null;
    }
    const crossingTick = findFirstTrueTick(
      trajectory.start.tick,
      trajectory.endTick,
      (tick) => {
        const sampled = sampleAerodynamicPitchTrajectory(
          trajectory,
          tick
        );
        return crossedPlate(
          trajectory.start.position.z,
          sampled.position.z,
          plateZ
        );
      }
    );
    if (crossingTick === null) {
      return null;
    }
    if (crossingTick === trajectory.start.tick) {
      return {
        tick: crossingTick,
        elapsedSeconds: 0,
        position: {
          ...trajectory.start.position,
          z: plateZ
        },
        velocity: trajectory.start.velocity,
        spin: trajectory.start.spin,
        spinDecomposition: decomposePitchSpin(
          trajectory.start.velocity,
          trajectory.start.spin
        ),
        orientation: sampleAerodynamicPitchOrientation(
          trajectory,
          0
        )
      };
    }
    const before = sampleAerodynamicPitchTrajectory(
      trajectory,
      crossingTick - 1
    );
    const after = sampleAerodynamicPitchTrajectory(
      trajectory,
      crossingTick
    );
    const denominator = after.position.z - before.position.z;
    const interpolation = Math.abs(denominator) <= EPSILON8 ? 1 : Math.max(
      0,
      Math.min(
        1,
        (plateZ - before.position.z) / denominator
      )
    );
    const position = lerpVec3(
      before.position,
      after.position,
      interpolation
    );
    const velocity = lerpVec3(
      before.velocity,
      after.velocity,
      interpolation
    );
    const elapsedTicks = crossingTick - 1 - trajectory.start.tick + interpolation;
    return {
      tick: crossingTick,
      elapsedSeconds: elapsedTicks / trajectory.parameters.ticksPerSecond,
      position: {
        ...position,
        z: plateZ
      },
      velocity,
      spin: lerpVec3(
        before.spin,
        after.spin,
        interpolation
      ),
      spinDecomposition: decomposePitchSpin(
        velocity,
        lerpVec3(
          before.spin,
          after.spin,
          interpolation
        )
      ),
      orientation: sampleAerodynamicPitchOrientation(
        trajectory,
        elapsedTicks / trajectory.parameters.ticksPerSecond
      )
    };
  };

  // src/core/sim/pitching/RigidBatContactCanonicalAdapter.ts
  var adaptRigidBatBallContactToCanonicalContact = (contact) => {
    const batPoint = {
      x: contact.batSurfacePoint.x - contact.normal.x * contact.localBatRadiusM,
      y: contact.batSurfacePoint.y - contact.normal.y * contact.localBatRadiusM,
      z: contact.batSurfacePoint.z - contact.normal.z * contact.localBatRadiusM
    };
    return {
      tick: contact.tick,
      ballCenter: contact.ballCenter,
      point: contact.batSurfacePoint,
      batPoint,
      normal: contact.normal,
      segmentT: contact.segmentT,
      exitVelocity: contact.exitVelocity,
      exitSpin: contact.exitSpin
    };
  };

  // src/integration/browser/NativeAerodynamicObserver.ts
  var isTick = (tick) => Number.isSafeInteger(tick) && tick >= 0;
  var sameVector = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
  var sameContact = (actual, expected) => actual.tick === expected.tick && actual.segmentT === expected.segmentT && sameVector(actual.ballCenter, expected.ballCenter) && sameVector(actual.point, expected.point) && sameVector(actual.batPoint, expected.batPoint) && sameVector(actual.normal, expected.normal) && sameVector(actual.exitVelocity, expected.exitVelocity) && sameVector(actual.exitSpin, expected.exitSpin);
  function assertCountedCall(call, kind, tick, before, after) {
    if (call?.kind !== "PitchAdjudicated" || call.tick !== tick || call.payload.adjudication.kind !== kind || before.status.kind !== "active" || call.payload.countBefore.balls !== before.status.count.balls || call.payload.countBefore.strikes !== before.status.count.strikes) {
      throw new Error("Native aerodynamic observation requires the exact accepted pitch adjudication.");
    }
    const counted = call.payload.result;
    if (counted.kind === "ball_in_play" || counted.cause !== kind || counted.kind !== after.status.kind && !(counted.kind === "continue" && after.status.kind === "active")) {
      throw new Error("Native aerodynamic observation has mismatched canonical pitch count status.");
    }
    if (counted.kind === "continue" && after.status.kind === "active" && (counted.count.balls !== after.status.count.balls || counted.count.strikes !== after.status.count.strikes)) {
      throw new Error("Native aerodynamic observation has mismatched live pitch count.");
    }
    if (counted.kind === "walk" && after.status.kind === "walk" && (counted.terminalCount.balls !== after.status.terminalCount.balls || counted.terminalCount.strikes !== after.status.terminalCount.strikes)) {
      throw new Error("Native aerodynamic observation has mismatched walk count.");
    }
    if (counted.kind === "strikeout" && after.status.kind === "strikeout" && (counted.terminalCount.balls !== after.status.terminalCount.balls || counted.terminalCount.strikes !== after.status.terminalCount.strikes)) {
      throw new Error("Native aerodynamic observation has mismatched strikeout count.");
    }
  }
  function acceptedPitchEvents(input) {
    const { timelineBefore: before, resolution, pitch } = input;
    const after = resolution.timeline;
    const { trajectory } = pitch;
    if (before.status.kind !== "active" || before.playId !== after.playId || before.startedAtTick !== after.startedAtTick || !isTick(trajectory.start.tick) || !isTick(trajectory.endTick) || trajectory.endTick < trajectory.start.tick || trajectory.start.tick < before.lastEventTick || after.events.length < before.events.length || !before.events.every((event2, index) => after.events[index] === event2)) {
      throw new Error("Native aerodynamic observation requires a preserved active canonical timeline prefix.");
    }
    const events = after.events.slice(before.events.length);
    if (after.nextSequence !== before.nextSequence + events.length || events.some((event2, index) => !isTick(event2.tick) || event2.tick < trajectory.start.tick || event2.tick > trajectory.endTick || event2.sequence !== before.nextSequence + index || index > 0 && event2.tick < events[index - 1].tick) || events.length > 0 && after.lastEventTick !== events[events.length - 1].tick) {
      throw new Error("Native aerodynamic observation requires exact in-flight canonical event ticks and sequences.");
    }
    if (resolution.kind === "unresolved") {
      if (pitch.action.kind !== "take" || events.length !== 0 || after.lastEventTick !== before.lastEventTick || JSON.stringify(after.status) !== JSON.stringify(before.status)) {
        throw new Error("Unresolved aerodynamic pitch cannot emit a canonical call.");
      }
      return { events, contact: null };
    }
    if (resolution.kind === "recorded_take") {
      const crossing = events[0];
      if (pitch.action.kind !== "take" || events.length !== 2 || crossing?.kind !== "TakenPitchPlateCrossed" || crossing.tick !== resolution.physical.crossing.tick || JSON.stringify(crossing.payload.result) !== JSON.stringify(resolution.physical)) {
        throw new Error("Native aerodynamic observation requires the real aerodynamic plate crossing.");
      }
      assertCountedCall(events[1], resolution.physical.kind, crossing.tick, before, after);
      return { events, contact: null };
    }
    if (pitch.action.kind !== "swing" || events.length < 1) {
      throw new Error("Native aerodynamic observation requires the resolved rigid swing action.");
    }
    const { swing } = pitch.action;
    if (!isTick(swing.startTick) || !isTick(swing.endTick) || swing.startTick < trajectory.start.tick || swing.endTick > trajectory.endTick || swing.endTick < swing.startTick || swing.ticksPerSecond !== trajectory.parameters.ticksPerSecond || swing.kinematicsV1 !== void 0 && (swing.kinematicsV1.startTick !== swing.startTick || swing.kinematicsV1.endTick !== swing.endTick || swing.kinematicsV1.ticksPerSecond !== swing.ticksPerSecond)) {
      throw new Error("Native aerodynamic observation requires the actual bounded rigid swing window.");
    }
    if (resolution.physical.kind === "swinging_miss") {
      const miss = events[0];
      if (events.length !== 2 || miss?.kind !== "SwingCompletedWithoutContact" || miss.tick !== resolution.physical.adjudicationTick || miss.payload.result.kind !== "swinging_miss" || miss.payload.result.adjudicationTick !== resolution.physical.adjudicationTick) {
        throw new Error("Native aerodynamic observation requires the physical swinging-miss event.");
      }
      assertCountedCall(events[1], "swinging_strike", miss.tick, before, after);
      return { events, contact: null };
    }
    const contact = resolution.physical.contact;
    const event = events[0];
    if (events.length !== 1 || event?.kind !== "BatBallContact" || event.tick !== contact.tick || !isTick(contact.tick) || contact.tick < swing.startTick || contact.tick > swing.endTick || after.status.kind !== "batted_ball_pending" || after.status.contactTick !== contact.tick || !sameContact(event.payload.contact, adaptRigidBatBallContactToCanonicalContact(contact))) {
      throw new Error("Native aerodynamic observation requires the exact rigid contact and pending canonical event.");
    }
    return { events, contact };
  }
  function batterPose(input, tick) {
    const handedness = input.batterHandedness;
    if (input.pitch.action.kind === "take") return { handedness, action: "idle", bat: null };
    const { swing } = input.pitch.action;
    if (tick < swing.startTick || tick > swing.endTick) return { handedness, action: "idle", bat: null };
    const pose = swing.kinematicsV1 !== void 0 ? sampleSwingStateV1(swing.kinematicsV1, tick).pose : sampleCompatibilityBatterSwingState(swing.stateAtStart, tick - swing.startTick, swing.ticksPerSecond).pose;
    return { handedness, action: "normal_swing", bat: pose };
  }
  function observeNativeAerodynamicPitch(input) {
    if (input.batterHandedness !== "R" && input.batterHandedness !== "L" || input.pitcherHandedness !== "R" && input.pitcherHandedness !== "L") {
      throw new Error("Native aerodynamic observation requires actual batter and pitcher handedness.");
    }
    const { events, contact } = acceptedPitchEvents(input);
    const { trajectory } = input.pitch;
    const ticksPerSecond = trajectory.parameters.ticksPerSecond;
    if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond <= 0) {
      throw new Error("Native aerodynamic observation requires physical ticksPerSecond.");
    }
    const cadenceTicks = Math.max(1, Math.round(MINI_PRESENTATION_CADENCE_MICROS * ticksPerSecond / 1e6));
    const stopTick = contact?.tick ?? trajectory.endTick;
    const ticks = createMiniPresentationSampleSchedule(trajectory.start.tick, stopTick, cadenceTicks, events);
    const samples = ticks.map((tick) => {
      const actors = input.actorsAtTick(tick);
      if (!actors || !Array.isArray(actors.defenders) || !Array.isArray(actors.runners)) {
        throw new Error(`Missing authoritative native actor state at tick ${tick}.`);
      }
      const flight = sampleAerodynamicPitchTrajectory(trajectory, tick);
      const ball = contact !== null && tick === contact.tick ? { position: contact.ballCenter, velocity: contact.exitVelocity, spin: contact.exitSpin } : { position: flight.position, velocity: flight.velocity, spin: flight.spin };
      return {
        world: { tick, defenders: actors.defenders, runners: actors.runners, ball },
        batter: batterPose(input, tick),
        pitcherHandedness: input.pitcherHandedness
      };
    });
    return {
      authority: "NATIVE_CORE_AERODYNAMIC_RIGID_PITCH",
      kind: input.resolution.kind,
      result: input.resolution,
      events,
      samples,
      frames: buildMiniPresentationTimeline(samples, events, input.camera ?? "BATTER_POV"),
      rigidContact: contact,
      nextMatchState: null,
      requiresOfficialLiveBallResolution: contact !== null
    };
  }

  // src/core/sim/contact/RigidBatBallContact.ts
  var REFERENCE_BASEBALL_RIGID_BODY = Object.freeze({
    massKg: 0.145,
    radiusM: 0.0366,
    rotationalInertiaFactor: 0.4
  });
  var MEASURED_BASEBALL_ROTATIONAL_INERTIA_FACTOR = 0.378;
  var REALISTIC_BASEBALL_RIGID_BODY = Object.freeze({
    ...REFERENCE_BASEBALL_RIGID_BODY,
    rotationalInertiaFactor: MEASURED_BASEBALL_ROTATIONAL_INERTIA_FACTOR
  });
  var CROSS_NATHAN_2006_LOW_SPEED_BAT_CONTACT_FIXTURE = Object.freeze({
    normalRestitution: 0.63,
    tangentialRestitution: 0.16,
    frictionCoefficient: 0.5
  });
  var EPSILON9 = 1e-12;
  var add6 = (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  });
  var subtract7 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var scale8 = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var dot5 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var cross6 = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  var magnitude8 = (value) => Math.hypot(value.x, value.y, value.z);
  var normalize4 = (value) => {
    const length = magnitude8(value);
    if (length <= EPSILON9) {
      throw new Error("cannot normalize a zero-length vector");
    }
    return scale8(value, 1 / length);
  };
  var clamp012 = (value) => Math.max(0, Math.min(1, value));
  var validateRadiusProfile = (profile) => {
    if (profile.knots.length < 2) {
      throw new Error("bat radius profile requires at least two knots");
    }
    let previousT = -Infinity;
    for (const knot of profile.knots) {
      if (!Number.isFinite(knot.t) || knot.t < 0 || knot.t > 1) {
        throw new Error("bat radius knot t must be finite within [0, 1]");
      }
      if (!Number.isFinite(knot.radiusM) || knot.radiusM <= 0) {
        throw new Error("bat radius knot radiusM must be finite and positive");
      }
      if (knot.t <= previousT) {
        throw new Error("bat radius knots must be strictly increasing");
      }
      previousT = knot.t;
    }
    if (profile.knots[0].t !== 0 || profile.knots[profile.knots.length - 1].t !== 1) {
      throw new Error("bat radius profile must include t=0 and t=1 endpoints");
    }
  };
  var validateEffectiveMassProfile = (profile) => {
    if (profile.knots.length < 2) {
      throw new Error(
        "bat effective-mass profile requires at least two knots"
      );
    }
    let previousT = -Infinity;
    for (const knot of profile.knots) {
      if (!Number.isFinite(knot.t) || knot.t < 0 || knot.t > 1) {
        throw new Error(
          "bat effective-mass knot t must be finite within [0, 1]"
        );
      }
      if (!Number.isFinite(knot.effectiveMassKg) || knot.effectiveMassKg <= 0) {
        throw new Error(
          "bat effective-mass knot value must be finite and positive"
        );
      }
      if (knot.t <= previousT) {
        throw new Error(
          "bat effective-mass knots must be strictly increasing"
        );
      }
      previousT = knot.t;
    }
    if (profile.knots[0].t !== 0 || profile.knots[profile.knots.length - 1].t !== 1) {
      throw new Error(
        "bat effective-mass profile must include t=0 and t=1 endpoints"
      );
    }
  };
  var validateBat = (bat) => {
    const p = bat.physical;
    if (!Number.isFinite(p.massKg) || p.massKg <= 0) {
      throw new Error("bat massKg must be finite and positive");
    }
    if (!Number.isFinite(p.centerOfMassT) || p.centerOfMassT < 0 || p.centerOfMassT > 1) {
      throw new Error("bat centerOfMassT must be finite within [0, 1]");
    }
    if (!Number.isFinite(p.transverseMomentOfInertiaKgM2) || p.transverseMomentOfInertiaKgM2 <= 0 || !Number.isFinite(p.axialMomentOfInertiaKgM2) || p.axialMomentOfInertiaKgM2 <= 0) {
      throw new Error("bat moments of inertia must be finite and positive");
    }
    validateRadiusProfile(p.radiusProfile);
    if (p.normalEffectiveMassProfile !== void 0) {
      validateEffectiveMassProfile(
        p.normalEffectiveMassProfile
      );
    }
  };
  var validateBall = (ball) => {
    if (!Number.isFinite(ball.massKg) || ball.massKg <= 0) {
      throw new Error("ball massKg must be finite and positive");
    }
    if (!Number.isFinite(ball.radiusM) || ball.radiusM <= 0) {
      throw new Error("ball radiusM must be finite and positive");
    }
    if (!Number.isFinite(ball.rotationalInertiaFactor) || ball.rotationalInertiaFactor <= 0) {
      throw new Error(
        "ball rotationalInertiaFactor must be finite and positive"
      );
    }
  };
  var validateContactParameters = (parameters) => {
    for (const [name, value] of [
      ["normalRestitution", parameters.normalRestitution],
      ["tangentialRestitution", parameters.tangentialRestitution]
    ]) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`${name} must be finite within [0, 1]`);
      }
    }
    if (!Number.isFinite(parameters.frictionCoefficient) || parameters.frictionCoefficient < 0) {
      throw new Error("frictionCoefficient must be finite and non-negative");
    }
  };
  var sampleBatRadius = (profile, t) => {
    validateRadiusProfile(profile);
    if (!Number.isFinite(t)) {
      throw new Error("bat radius sample t must be finite");
    }
    const clamped = clamp012(t);
    for (let index = 1; index < profile.knots.length; index += 1) {
      const right = profile.knots[index];
      if (clamped > right.t) {
        continue;
      }
      const left = profile.knots[index - 1];
      const span = right.t - left.t;
      const local = span <= EPSILON9 ? 0 : (clamped - left.t) / span;
      return left.radiusM + (right.radiusM - left.radiusM) * local;
    }
    return profile.knots[profile.knots.length - 1].radiusM;
  };
  var sampleBatEffectiveMass = (profile, t) => {
    validateEffectiveMassProfile(profile);
    if (!Number.isFinite(t)) {
      throw new Error("bat effective-mass sample t must be finite");
    }
    const clamped = clamp012(t);
    for (let index = 1; index < profile.knots.length; index += 1) {
      const right = profile.knots[index];
      if (clamped > right.t) {
        continue;
      }
      const left = profile.knots[index - 1];
      const span = right.t - left.t;
      const local = span <= EPSILON9 ? 0 : (clamped - left.t) / span;
      return left.effectiveMassKg + (right.effectiveMassKg - left.effectiveMassKg) * local;
    }
    return profile.knots[profile.knots.length - 1].effectiveMassKg;
  };
  var axisGeometry = (pose) => {
    const delta = subtract7(pose.tip, pose.grip);
    const lengthM = magnitude8(delta);
    if (lengthM <= EPSILON9) {
      throw new Error("bat pose grip and tip must not be identical");
    }
    return {
      axis: scale8(delta, 1 / lengthM),
      lengthM
    };
  };
  var closestPointOnTaperedBat = (point, bat) => {
    const { axis, lengthM } = axisGeometry(bat.pose);
    const fromGrip = subtract7(
      point,
      bat.pose.grip
    );
    const projectedS = dot5(
      fromGrip,
      axis
    );
    const perpendicular = subtract7(
      fromGrip,
      scale8(axis, projectedS)
    );
    const perpendicularDistance = magnitude8(
      perpendicular
    );
    let best = null;
    const consider = (candidateT) => {
      const t = clamp012(candidateT);
      const axisPoint = add6(
        bat.pose.grip,
        scale8(axis, t * lengthM)
      );
      const localRadiusM = sampleBatRadius(
        bat.physical.radiusProfile,
        t
      );
      const surfaceSeparationM = magnitude8(subtract7(point, axisPoint)) - localRadiusM;
      if (best === null || surfaceSeparationM < best.surfaceSeparationM) {
        best = {
          point: axisPoint,
          t,
          localRadiusM,
          surfaceSeparationM
        };
      }
    };
    const knots = bat.physical.radiusProfile.knots;
    for (let index = 1; index < knots.length; index += 1) {
      const left = knots[index - 1];
      const right = knots[index];
      consider(left.t);
      consider(right.t);
      const intervalLengthM = (right.t - left.t) * lengthM;
      const radiusSlope = (right.radiusM - left.radiusM) / intervalLengthM;
      if (Math.abs(radiusSlope) < 1) {
        const longitudinalOffsetM = radiusSlope * perpendicularDistance / Math.sqrt(
          1 - radiusSlope * radiusSlope
        );
        const candidateS = projectedS + longitudinalOffsetM;
        const candidateT = candidateS / lengthM;
        if (candidateT >= left.t && candidateT <= right.t) {
          consider(candidateT);
        }
      }
    }
    if (best === null) {
      throw new Error("bat radius profile produced no contact candidates");
    }
    return best;
  };
  var batCenterOfMassPoint = (bat) => add6(
    bat.pose.grip,
    scale8(
      subtract7(bat.pose.tip, bat.pose.grip),
      bat.physical.centerOfMassT
    )
  );
  var applyBatInverseInertia = (value, batAxis, physical) => {
    const parallel = scale8(batAxis, dot5(value, batAxis));
    const perpendicular = subtract7(value, parallel);
    return add6(
      scale8(parallel, 1 / physical.axialMomentOfInertiaKgM2),
      scale8(
        perpendicular,
        1 / physical.transverseMomentOfInertiaKgM2
      )
    );
  };
  var applyBallInverseInertia = (value, ball) => {
    const inertia = ball.rotationalInertiaFactor * ball.massKg * ball.radiusM * ball.radiusM;
    return scale8(value, 1 / inertia);
  };
  var pointVelocity = (centerVelocity, angularVelocity, leverArm) => add6(
    centerVelocity,
    cross6(angularVelocity, leverArm)
  );
  var applyImpulse = (state, impulseOnBall, ballLeverArm, batLeverArm, ball, bat, batAxis) => {
    state.ballVelocity = add6(
      state.ballVelocity,
      scale8(impulseOnBall, 1 / ball.massKg)
    );
    state.ballSpin = add6(
      state.ballSpin,
      applyBallInverseInertia(
        cross6(ballLeverArm, impulseOnBall),
        ball
      )
    );
    const impulseOnBat = scale8(impulseOnBall, -1);
    state.batVelocity = add6(
      state.batVelocity,
      scale8(impulseOnBat, 1 / bat.physical.massKg)
    );
    state.batAngularVelocity = add6(
      state.batAngularVelocity,
      applyBatInverseInertia(
        cross6(batLeverArm, impulseOnBat),
        batAxis,
        bat.physical
      )
    );
  };
  var relativeSurfaceVelocity = (state, ballLeverArm, batLeverArm) => subtract7(
    pointVelocity(
      state.ballVelocity,
      state.ballSpin,
      ballLeverArm
    ),
    pointVelocity(
      state.batVelocity,
      state.batAngularVelocity,
      batLeverArm
    )
  );
  var ballInverseMassContributionAlong = (direction, ballLeverArm, ball) => {
    const angular = dot5(
      direction,
      cross6(
        applyBallInverseInertia(
          cross6(ballLeverArm, direction),
          ball
        ),
        ballLeverArm
      )
    );
    return 1 / ball.massKg + angular;
  };
  var rigidBatInverseMassContributionAlong = (direction, batLeverArm, bat, batAxis) => {
    const angular = dot5(
      direction,
      cross6(
        applyBatInverseInertia(
          cross6(batLeverArm, direction),
          batAxis,
          bat.physical
        ),
        batLeverArm
      )
    );
    return 1 / bat.physical.massKg + angular;
  };
  var effectiveInverseMassAlong = (direction, ballLeverArm, batLeverArm, ball, bat, batAxis) => ballInverseMassContributionAlong(
    direction,
    ballLeverArm,
    ball
  ) + rigidBatInverseMassContributionAlong(
    direction,
    batLeverArm,
    bat,
    batAxis
  );
  var createRigidBatStateFromBatterSwingState = (swing, physical) => {
    validateBat({
      pose: swing.pose,
      centerOfMassVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      angularVelocity: swing.angularVelocity,
      physical
    });
    const centerOfMassPoint = add6(
      swing.pose.grip,
      scale8(
        subtract7(
          swing.pose.tip,
          swing.pose.grip
        ),
        physical.centerOfMassT
      )
    );
    const gripToCenterOfMass = subtract7(
      centerOfMassPoint,
      swing.pose.grip
    );
    return {
      pose: swing.pose,
      centerOfMassVelocity: add6(
        swing.linearVelocity,
        cross6(
          swing.angularVelocity,
          gripToCenterOfMass
        )
      ),
      angularVelocity: swing.angularVelocity,
      physical
    };
  };
  var measureRigidBatBallSurfaceSeparation = (pitch, bat, ball) => {
    validateBat(bat);
    validateBall(ball);
    const nearest = closestPointOnTaperedBat(
      pitch.position,
      bat
    );
    return nearest.surfaceSeparationM - ball.radiusM;
  };
  var prepareRigidBatBallContact = (pitch, bat, ball) => {
    validateBat(bat);
    validateBall(ball);
    const { axis: batAxis } = axisGeometry(bat.pose);
    const nearest = closestPointOnTaperedBat(
      pitch.position,
      bat
    );
    const localBatRadiusM = nearest.localRadiusM;
    if (nearest.surfaceSeparationM > ball.radiusM) {
      return null;
    }
    const axisToBall = subtract7(
      pitch.position,
      nearest.point
    );
    const centerDistance = magnitude8(axisToBall);
    const centerOfMass = batCenterOfMassPoint(bat);
    const fallbackRelative = subtract7(
      pitch.velocity,
      bat.centerOfMassVelocity
    );
    const normal = centerDistance > EPSILON9 ? scale8(
      axisToBall,
      1 / centerDistance
    ) : normalize4(
      scale8(
        fallbackRelative,
        -1
      )
    );
    const batSurfacePoint = add6(
      nearest.point,
      scale8(
        normal,
        localBatRadiusM
      )
    );
    const ballSurfacePoint = add6(
      pitch.position,
      scale8(
        normal,
        -ball.radiusM
      )
    );
    const batLeverArm = subtract7(
      batSurfacePoint,
      centerOfMass
    );
    const ballLeverArm = subtract7(
      ballSurfacePoint,
      pitch.position
    );
    const state = {
      ballVelocity: pitch.velocity,
      ballSpin: pitch.spin,
      batVelocity: bat.centerOfMassVelocity,
      batAngularVelocity: bat.angularVelocity
    };
    const relativeBefore = relativeSurfaceVelocity(
      state,
      ballLeverArm,
      batLeverArm
    );
    const normalRelativeSpeed = dot5(
      relativeBefore,
      normal
    );
    if (normalRelativeSpeed >= 0) {
      return null;
    }
    const tangentBefore = subtract7(
      relativeBefore,
      scale8(
        normal,
        normalRelativeSpeed
      )
    );
    const tangentialRelativeSpeedBeforeMps = magnitude8(tangentBefore);
    return {
      kinematics: {
        tick: pitch.tick,
        segmentT: nearest.t,
        localBatRadiusM,
        normal,
        batSurfacePoint,
        ballSurfacePoint,
        relativeSurfaceVelocityBefore: relativeBefore,
        totalRelativeSurfaceSpeedMps: magnitude8(relativeBefore),
        normalRelativeSpeedBeforeMps: normalRelativeSpeed,
        normalApproachSpeedMps: -normalRelativeSpeed,
        tangentialRelativeSpeedBeforeMps
      },
      batAxis,
      batLeverArm,
      ballLeverArm,
      state
    };
  };
  var resolveRigidBatBallContactWithParameterResolver = (pitch, bat, ball, parameterResolver) => {
    const prepared = prepareRigidBatBallContact(
      pitch,
      bat,
      ball
    );
    if (prepared === null) {
      return null;
    }
    const {
      kinematics,
      batAxis,
      batLeverArm,
      ballLeverArm,
      state
    } = prepared;
    const parameters = parameterResolver(kinematics);
    validateContactParameters(
      parameters
    );
    const rigidBatNormalInverseMass = rigidBatInverseMassContributionAlong(
      kinematics.normal,
      batLeverArm,
      bat,
      batAxis
    );
    const rigidBatNormalEffectiveMassKg = 1 / rigidBatNormalInverseMass;
    const dynamicProfile = bat.physical.normalEffectiveMassProfile;
    const batNormalEffectiveMassKg = dynamicProfile === void 0 ? rigidBatNormalEffectiveMassKg : sampleBatEffectiveMass(
      dynamicProfile,
      kinematics.segmentT
    );
    const normalEffectiveMassSource = dynamicProfile === void 0 ? "rigid_body" : "dynamic_profile";
    const normalInverseMass = ballInverseMassContributionAlong(
      kinematics.normal,
      ballLeverArm,
      ball
    ) + 1 / batNormalEffectiveMassKg;
    if (normalInverseMass <= EPSILON9) {
      throw new Error(
        "normal effective inverse mass must be positive"
      );
    }
    const normalImpulseNs = -(1 + parameters.normalRestitution) * kinematics.normalRelativeSpeedBeforeMps / normalInverseMass;
    const normalImpulse = scale8(
      kinematics.normal,
      normalImpulseNs
    );
    applyImpulse(
      state,
      normalImpulse,
      ballLeverArm,
      batLeverArm,
      ball,
      bat,
      batAxis
    );
    let tangentialImpulseNs = {
      x: 0,
      y: 0,
      z: 0
    };
    if (parameters.frictionCoefficient > 0 && kinematics.tangentialRelativeSpeedBeforeMps > EPSILON9) {
      const relativeAfterNormal = relativeSurfaceVelocity(
        state,
        ballLeverArm,
        batLeverArm
      );
      const normalAfterNormal = dot5(
        relativeAfterNormal,
        kinematics.normal
      );
      const tangentAfterNormal = subtract7(
        relativeAfterNormal,
        scale8(
          kinematics.normal,
          normalAfterNormal
        )
      );
      const tangentSpeedAfterNormal = magnitude8(tangentAfterNormal);
      if (tangentSpeedAfterNormal > EPSILON9) {
        const tangentDirection = scale8(
          tangentAfterNormal,
          1 / tangentSpeedAfterNormal
        );
        const tangentialInverseMass = effectiveInverseMassAlong(
          tangentDirection,
          ballLeverArm,
          batLeverArm,
          ball,
          bat,
          batAxis
        );
        if (tangentialInverseMass <= EPSILON9) {
          throw new Error(
            "tangential effective inverse mass must be positive"
          );
        }
        const targetImpulseMagnitude = (1 + parameters.tangentialRestitution) * tangentSpeedAfterNormal / tangentialInverseMass;
        const frictionLimit = parameters.frictionCoefficient * normalImpulseNs;
        const tangentialImpulseMagnitude = Math.min(
          targetImpulseMagnitude,
          frictionLimit
        );
        tangentialImpulseNs = scale8(
          tangentDirection,
          -tangentialImpulseMagnitude
        );
        applyImpulse(
          state,
          tangentialImpulseNs,
          ballLeverArm,
          batLeverArm,
          ball,
          bat,
          batAxis
        );
      }
    }
    const totalImpulseNs = add6(
      normalImpulse,
      tangentialImpulseNs
    );
    return {
      tick: kinematics.tick,
      ballCenter: pitch.position,
      segmentT: kinematics.segmentT,
      localBatRadiusM: kinematics.localBatRadiusM,
      normal: kinematics.normal,
      batSurfacePoint: kinematics.batSurfacePoint,
      ballSurfacePoint: kinematics.ballSurfacePoint,
      normalRelativeSpeedBeforeMps: kinematics.normalRelativeSpeedBeforeMps,
      tangentialRelativeSpeedBeforeMps: kinematics.tangentialRelativeSpeedBeforeMps,
      normalImpulseNs,
      tangentialImpulseNs,
      totalImpulseNs,
      effectiveNormalMassKg: 1 / normalInverseMass,
      batNormalEffectiveMassKg,
      normalEffectiveMassSource,
      batRecoilModel: normalEffectiveMassSource === "rigid_body" ? "rigid_body" : "rigid_projection_only",
      exitVelocity: state.ballVelocity,
      exitSpin: state.ballSpin,
      batExitCenterOfMassVelocity: state.batVelocity,
      batExitAngularVelocity: state.batAngularVelocity
    };
  };

  // src/core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult.ts
  var SWING_KINEMATICS_V1_CONSERVATIVE_MAX_BAT_POINT_SPEED_MPS = 200;
  var createRigidBatSwingWindowFromKinematicsV1 = (kinematicsV1, physical) => ({
    startTick: kinematicsV1.startTick,
    endTick: kinematicsV1.endTick,
    ticksPerSecond: kinematicsV1.ticksPerSecond,
    stateAtStart: sampleSwingStateV1(
      kinematicsV1,
      kinematicsV1.startTick
    ),
    physical,
    kinematicsV1
  });
  var EPSILON10 = 1e-12;
  var magnitude9 = (value) => Math.hypot(
    value.x,
    value.y,
    value.z
  );
  var subtract8 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var cross7 = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  var add7 = (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  });
  var validate = (input) => {
    const { trajectory, swing } = input;
    if (!Number.isSafeInteger(
      swing.startTick
    ) || !Number.isSafeInteger(
      swing.endTick
    ) || swing.endTick < swing.startTick || swing.startTick < trajectory.start.tick || swing.endTick > trajectory.endTick) {
      throw new Error(
        "rigid bat swing window must lie inside the aerodynamic pitch trajectory"
      );
    }
    if (!Number.isSafeInteger(
      swing.ticksPerSecond
    ) || swing.ticksPerSecond <= 0 || swing.ticksPerSecond !== trajectory.parameters.ticksPerSecond) {
      throw new Error(
        "rigid bat swing and aerodynamic pitch must share ticksPerSecond"
      );
    }
    const kinematics = swing.kinematicsV1;
    if (kinematics !== void 0 && (kinematics.startTick !== swing.startTick || kinematics.endTick !== swing.endTick || kinematics.ticksPerSecond !== swing.ticksPerSecond)) {
      throw new Error(
        "swing kinematics v1 interval must exactly match rigid bat swing window"
      );
    }
  };
  var sampleSwing = (swing, tick) => swing.kinematicsV1 !== void 0 ? sampleSwingStateV1(
    swing.kinematicsV1,
    tick
  ) : sampleCompatibilityBatterSwingState(
    swing.stateAtStart,
    tick - swing.startTick,
    swing.ticksPerSecond
  );
  var maximumClosingSpeed = (input) => {
    const durationSeconds = (input.swing.endTick - input.trajectory.start.tick) / input.swing.ticksPerSecond;
    const wind = input.trajectory.parameters.aerodynamics.windVelocityMps;
    const releaseAirRelative = subtract8(
      input.trajectory.start.velocity,
      wind
    );
    const conservativePitchSpeed = magnitude9(releaseAirRelative) + Math.abs(
      input.trajectory.parameters.gravityY
    ) * durationSeconds + magnitude9(wind);
    if (input.swing.kinematicsV1 !== void 0) {
      return conservativePitchSpeed + SWING_KINEMATICS_V1_CONSERVATIVE_MAX_BAT_POINT_SPEED_MPS;
    }
    const batAxis = subtract8(
      input.swing.stateAtStart.pose.tip,
      input.swing.stateAtStart.pose.grip
    );
    const gripSpeed = magnitude9(
      input.swing.stateAtStart.linearVelocity
    );
    const tipSpeed = magnitude9(
      add7(
        input.swing.stateAtStart.linearVelocity,
        cross7(
          input.swing.stateAtStart.angularVelocity,
          batAxis
        )
      )
    );
    return conservativePitchSpeed + Math.max(
      gripSpeed,
      tipSpeed
    );
  };
  var validateV1PointSpeed = (swing, sampledSwing) => {
    if (swing.kinematicsV1 === void 0) {
      return;
    }
    const batAxis = subtract8(
      sampledSwing.pose.tip,
      sampledSwing.pose.grip
    );
    const gripSpeed = magnitude9(
      sampledSwing.linearVelocity
    );
    const tipSpeed = magnitude9(
      add7(
        sampledSwing.linearVelocity,
        cross7(
          sampledSwing.angularVelocity,
          batAxis
        )
      )
    );
    if (Math.max(
      gripSpeed,
      tipSpeed
    ) > SWING_KINEMATICS_V1_CONSERVATIVE_MAX_BAT_POINT_SPEED_MPS) {
      throw new Error(
        "swing kinematics v1 exceeded conservative bat-point speed safety bound"
      );
    }
  };
  var resolveAerodynamicRigidBatSwing = (input) => {
    validate(input);
    const closingSpeed = maximumClosingSpeed(input);
    let tick = input.swing.startTick;
    let pitch = sampleAerodynamicPitchTrajectory(
      input.trajectory,
      tick
    );
    while (tick <= input.swing.endTick) {
      const sampledSwing = sampleSwing(
        input.swing,
        tick
      );
      validateV1PointSpeed(
        input.swing,
        sampledSwing
      );
      const rigidBat = createRigidBatStateFromBatterSwingState(
        sampledSwing,
        input.swing.physical
      );
      const separation = measureRigidBatBallSurfaceSeparation(
        pitch,
        rigidBat,
        input.ball
      );
      if (separation <= 0) {
        const contact = resolveRigidBatBallContactWithParameterResolver(
          pitch,
          rigidBat,
          input.ball,
          input.parameterResolver
        );
        if (contact !== null) {
          return {
            kind: "contact",
            contact
          };
        }
      }
      if (tick === input.swing.endTick) {
        break;
      }
      const safeAdvanceTicks = separation > 0 && closingSpeed > EPSILON10 ? Math.floor(
        separation / closingSpeed * input.swing.ticksPerSecond
      ) - 1 : 1;
      const advanceTicks = Math.min(
        input.swing.endTick - tick,
        Math.max(
          1,
          safeAdvanceTicks
        )
      );
      pitch = advanceAerodynamicPitchState(
        pitch,
        advanceTicks,
        input.trajectory.parameters
      );
      tick += advanceTicks;
    }
    return {
      kind: "swinging_miss",
      adjudicationTick: input.swing.endTick
    };
  };

  // src/core/sim/pitching/AerodynamicTakenPitchPhysicalResult.ts
  var validateZone2 = (zone) => {
    if (!Number.isFinite(zone.centerX) || !Number.isFinite(zone.halfWidth) || zone.halfWidth <= 0) {
      throw new Error(
        "strike zone centerX/halfWidth must be finite and halfWidth positive"
      );
    }
    if (!Number.isFinite(zone.lowerY) || !Number.isFinite(zone.upperY) || zone.upperY <= zone.lowerY) {
      throw new Error(
        "strike zone upperY must be greater than lowerY"
      );
    }
  };
  var resolveAerodynamicTakenPitchPhysicalResult = (input) => {
    validateZone2(input.strikeZone);
    if (!Number.isFinite(input.ballRadiusMeters) || input.ballRadiusMeters <= 0) {
      throw new Error(
        "ballRadiusMeters must be finite and positive"
      );
    }
    const crossing = findAerodynamicPitchPlateCrossing(
      input.trajectory,
      input.plateZ
    );
    if (crossing === null) {
      return null;
    }
    const horizontalMin = input.strikeZone.centerX - input.strikeZone.halfWidth;
    const horizontalMax = input.strikeZone.centerX + input.strikeZone.halfWidth;
    const overlapsHorizontalZone = crossing.position.x + input.ballRadiusMeters >= horizontalMin && crossing.position.x - input.ballRadiusMeters <= horizontalMax;
    const overlapsVerticalZone = crossing.position.y + input.ballRadiusMeters >= input.strikeZone.lowerY && crossing.position.y - input.ballRadiusMeters <= input.strikeZone.upperY;
    return {
      kind: overlapsHorizontalZone && overlapsVerticalZone ? "called_strike" : "ball",
      crossing,
      geometry: {
        overlapsHorizontalZone,
        overlapsVerticalZone
      }
    };
  };

  // src/core/sim/pitching/AerodynamicRigidPitchAgainstBatter.ts
  var isAerodynamicRigidTakePitchInput = (input) => input.action.kind === "take";
  var resolveAndRecordAerodynamicRigidPitchAgainstBatter = (timeline, input) => {
    if (isAerodynamicRigidTakePitchInput(input)) {
      const physical2 = resolveAerodynamicTakenPitchPhysicalResult({
        trajectory: input.trajectory,
        plateZ: input.plateZ,
        strikeZone: input.strikeZone,
        ballRadiusMeters: input.ballRadiusMeters
      });
      if (physical2 === null) {
        return {
          kind: "unresolved",
          reason: "pitch_did_not_reach_plate",
          timeline
        };
      }
      return {
        kind: "recorded_take",
        physical: physical2,
        timeline: recordTakenPitchPhysicalResult(
          timeline,
          physical2
        )
      };
    }
    const physical = resolveAerodynamicRigidBatSwing({
      trajectory: input.trajectory,
      swing: input.action.swing,
      ball: input.ball,
      parameterResolver: input.parameterResolver
    });
    if (physical.kind === "contact") {
      const canonicalContact = adaptRigidBatBallContactToCanonicalContact(
        physical.contact
      );
      return {
        kind: "recorded_swing",
        physical,
        timeline: recordSwingingPitchPhysicalResult(
          timeline,
          {
            kind: "contact",
            contact: canonicalContact
          }
        )
      };
    }
    return {
      kind: "recorded_swing",
      physical,
      timeline: recordSwingingPitchPhysicalResult(
        timeline,
        {
          kind: "swinging_miss",
          adjudicationTick: physical.adjudicationTick
        }
      )
    };
  };

  // src/integration/browser/NativeAerodynamicSession.ts
  function isTick2(tick) {
    return Number.isSafeInteger(tick) && tick >= 0;
  }
  function observablePhase(status) {
    switch (status) {
      case "active":
      case "walk":
      case "strikeout":
      case "batted_ball_pending":
        return status;
      default:
        throw new Error("Native aerodynamic one-PA requires separate real fielding and umpire adjudication.");
    }
  }
  function immutableCommand(command) {
    const validated = createPlateAppearanceCommand(command);
    return Object.freeze({
      pitcher: Object.freeze({ ...validated.pitcher }),
      batter: Object.freeze({ ...validated.batter }),
      runners: Object.freeze({ ...validated.runners })
    });
  }
  function createNativeAerodynamicSession(input) {
    if (!Number.isSafeInteger(input.matchSeed)) {
      throw new Error("Native aerodynamic session matchSeed must be a safe integer.");
    }
    if (typeof input.batterRunnerId !== "string" || input.batterRunnerId.trim().length === 0) {
      throw new Error("Native aerodynamic session requires an actual batter-runner ID.");
    }
    if (input.batterHandedness !== "R" && input.batterHandedness !== "L" || input.pitcherHandedness !== "R" && input.pitcherHandedness !== "L") {
      throw new Error("Native aerodynamic session requires actual batter and pitcher handedness.");
    }
    const match = Object.freeze({
      ...input.match,
      bases: Object.freeze({ ...input.match.bases }),
      score: Object.freeze({ ...input.match.score })
    });
    let timeline = createCanonicalPlateAppearanceTimeline(
      match,
      input.startedAtTick
    );
    let ordinal = 0;
    let pendingCommand = null;
    let previousFlightEndTick = null;
    let unresolved = false;
    let issuing = false;
    let nextMatchState = null;
    const phase = () => unresolved ? "unresolved" : observablePhase(timeline.status.kind);
    const count = () => timeline.status.kind === "active" ? { balls: timeline.status.count.balls, strikes: timeline.status.count.strikes } : null;
    const inspect = () => ({
      phase: phase(),
      count: count(),
      pitches: ordinal,
      pendingCommand,
      previousFlightEndTick,
      nextMatchState
    });
    const assertAcceptingPitch = () => {
      if (unresolved || timeline.status.kind !== "active") {
        throw new Error("Native aerodynamic PA is stopped or awaiting real physical/umpire evidence; another pitch is forbidden.");
      }
      if (issuing) {
        throw new Error("Native aerodynamic PA cannot reenter an in-progress physical issue.");
      }
    };
    const acceptNextCommand = (requested) => {
      assertAcceptingPitch();
      if (pendingCommand !== null) {
        throw new Error("A Native aerodynamic next-pitch command is already accepted and must be issued first.");
      }
      const accepted = Object.freeze(createPlateAppearanceCommandSession({
        playId: match.playId,
        batterRunnerId: input.batterRunnerId,
        acceptedAtTick: timeline.lastEventTick,
        matchSeed: input.matchSeed,
        command: immutableCommand(requested)
      }));
      assertCommandSessionCanDriveTimeline(accepted, timeline);
      pendingCommand = accepted;
      return accepted;
    };
    const issue = (source) => {
      assertAcceptingPitch();
      if (pendingCommand === null) {
        throw new Error("Native aerodynamic pitch requires an accepted next-pitch command.");
      }
      if (typeof source !== "function") {
        throw new Error("Native aerodynamic pitch requires an explicit physical source.");
      }
      if (!Number.isSafeInteger(ordinal + 1)) {
        throw new Error("Native aerodynamic pitch ordinal has exceeded the safe integer range.");
      }
      const accepted = pendingCommand;
      assertCommandSessionCanDriveTimeline(accepted, timeline);
      if (accepted.acceptedAtTick !== timeline.lastEventTick) {
        throw new Error("Native aerodynamic next-pitch command has a stale timeline acceptance tick.");
      }
      issuing = true;
      try {
        const actual = source(Object.freeze({
          commandSession: accepted,
          ordinal,
          count: Object.freeze(count()),
          lastEventTick: timeline.lastEventTick,
          previousFlightEndTick,
          match
        }));
        if (!actual || !actual.pitch || typeof actual.actorsAtTick !== "function" || !actual.pitch.trajectory || !actual.pitch.trajectory.start) {
          throw new Error("Native aerodynamic physical source must supply a real pitch and actor sampler.");
        }
        const { pitch } = actual;
        const { start, endTick } = pitch.trajectory;
        if (!isTick2(start.tick) || !isTick2(endTick) || endTick < start.tick || start.tick < timeline.lastEventTick || previousFlightEndTick !== null && start.tick <= previousFlightEndTick) {
          throw new Error("Native aerodynamic physical flight must follow the accepted count and all previous flights.");
        }
        const before = timeline;
        const resolution = resolveAndRecordAerodynamicRigidPitchAgainstBatter(before, pitch);
        const observation = observeNativeAerodynamicPitch({
          timelineBefore: before,
          pitch,
          resolution,
          actorsAtTick: actual.actorsAtTick,
          batterHandedness: input.batterHandedness,
          pitcherHandedness: input.pitcherHandedness,
          camera: input.camera
        });
        const next = resolution.timeline.status.kind === "walk" ? applyWalkPlateAppearanceToMatchState(match, resolution.timeline, input.batterRunnerId) : resolution.timeline.status.kind === "strikeout" ? applyStrikeoutPlateAppearanceToMatchState(match, resolution.timeline) : null;
        const issuedPhase = resolution.kind === "unresolved" ? "unresolved" : observablePhase(resolution.timeline.status.kind);
        timeline = resolution.timeline;
        previousFlightEndTick = endTick;
        nextMatchState = next;
        pendingCommand = null;
        ordinal += 1;
        unresolved = resolution.kind === "unresolved";
        return {
          ordinal: ordinal - 1,
          commandSession: accepted,
          result: observation,
          eventKinds: observation.events.map((event) => event.kind),
          phase: issuedPhase,
          count: count(),
          nextMatchState
        };
      } finally {
        issuing = false;
      }
    };
    return Object.freeze({ acceptNextCommand, issue, inspect });
  }

  // src/integration/browser/NativeAerodynamicReferenceFixture.ts
  var REFERENCE_BAT = Object.freeze({
    massKg: 0.9,
    centerOfMassT: 0.6,
    transverseMomentOfInertiaKgM2: 0.06,
    axialMomentOfInertiaKgM2: 55e-5,
    radiusProfile: { knots: [{ t: 0, radiusM: 0.033 }, { t: 1, radiusM: 0.033 }] }
  });
  function createReferenceAerodynamicPhysicalSource(spec) {
    if (!Number.isFinite(spec.pitchSpeedMps) || spec.pitchSpeedMps <= 0 || spec.pitchSpeedMps > 151 / 3.6 || spec.batterAction !== "take" && spec.batterAction !== "swing" || typeof spec.actorsAtTick !== "function") {
      throw new Error("Reference aerodynamic fixture requires explicit speed <= 151 km/h, actors and action.");
    }
    return (context) => {
      const { pitcher, batter } = context.commandSession.command;
      const startTick = Math.max(
        context.lastEventTick + 1e5,
        (context.previousFlightEndTick ?? 0) + 1e5
      );
      const sign = pitcher.attackZone === "outside" ? -1 : pitcher.attackZone === "inside" ? 1 : 0;
      const xSpeed = sign * 0.45;
      const ySpeed = pitcher.verticalPlan === "high" ? 2 : pitcher.verticalPlan === "middle" ? 1.1 : 0.3;
      const yOffset = pitcher.aggression === "waste" ? 0.7 : 0;
      const trajectory = {
        start: {
          tick: startTick,
          position: { x: 0, y: 1.7 + yOffset, z: 18 },
          velocity: { x: xSpeed, y: ySpeed, z: -spec.pitchSpeedMps },
          spin: { x: 15, y: 65, z: 0 }
        },
        endTick: startTick + 7e5,
        parameters: {
          ticksPerSecond: 1e6,
          integrationStepTicks: 500,
          gravityY: -9.81,
          aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS
        }
      };
      let pitch;
      if (spec.batterAction === "take" || batter.approach === "take") {
        pitch = {
          action: { kind: "take" },
          trajectory,
          plateZ: 0,
          strikeZone: { centerX: 0, halfWidth: 0.2159, lowerY: 0.55, upperY: 1.5 },
          ballRadiusMeters: REALISTIC_BASEBALL_RIGID_BODY.radiusM
        };
      } else {
        const midpoint = startTick + 47e4;
        const smoothSwing = createSwingKinematicsTrajectoryV1({
          startTick: midpoint - 75e3,
          contactTick: midpoint,
          endTick: midpoint + 65e3,
          ticksPerSecond: 1e6,
          batLengthM: 0.84,
          sweetSpotT: 0.5,
          start: {
            sweetSpotPosition: { x: -0.1, y: 0.95, z: 0.45 },
            sweetSpotVelocity: { x: 0, y: 0, z: -1 },
            batAxis: { x: 1, y: 0, z: 0 }
          },
          contact: {
            sweetSpotPosition: { x: 0.08, y: 0.95, z: 0 },
            sweetSpotVelocity: { x: 8, y: 0, z: -2 },
            batAxis: { x: 1, y: 0, z: 0 }
          },
          finish: {
            sweetSpotPosition: { x: 0.45, y: 1, z: -0.3 },
            sweetSpotVelocity: { x: 3, y: 0, z: 0 },
            batAxis: { x: 0, y: 0, z: 1 }
          }
        });
        pitch = {
          action: {
            kind: "swing",
            swing: createRigidBatSwingWindowFromKinematicsV1(smoothSwing, REFERENCE_BAT)
          },
          trajectory,
          ball: REALISTIC_BASEBALL_RIGID_BODY,
          parameterResolver: () => ({
            normalRestitution: 0.5,
            tangentialRestitution: 0.3,
            frictionCoefficient: 0.2
          })
        };
      }
      return { pitch, actorsAtTick: spec.actorsAtTick };
    };
  }
  return __toCommonJS(browser_exports);
})();
