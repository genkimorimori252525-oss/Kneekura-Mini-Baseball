// Native physical pitch bridge compiled directly from src/core and src/presentation; no browser result simulator.\n"use strict";
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
    createNativeSinglePaSession: () => createNativeSinglePaSession,
    issueNativeCommandPitch: () => issueNativeCommandPitch,
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
  return __toCommonJS(browser_exports);
})();
