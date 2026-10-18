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
      for (let key3 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key3) && key3 !== except)
          __defProp(to, key3, { get: () => from[key3], enumerable: !(desc = __getOwnPropDesc(from, key3)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/integration/browser/index.ts
  var browser_exports = {};
  __export(browser_exports, {
    LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1: () => LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
    LIVE_MATCH_BASES_V1: () => LIVE_MATCH_BASES_V1,
    REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS: () => REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,
    applyLivePhysicalRosterV1: () => applyLivePhysicalRosterV1,
    createExecutedFieldWorldObserverV1: () => createExecutedFieldWorldObserverV1,
    createLiveBaseballMatchV1: () => createLiveBaseballMatchV1,
    createNativeAerodynamicSession: () => createNativeAerodynamicSession,
    createNativeSinglePaSession: () => createNativeSinglePaSession,
    createReferenceAerodynamicPhysicalSource: () => createReferenceAerodynamicPhysicalSource,
    createSourceBallMaterialHistoryFromContinuationV3: () => createSourceBallMaterialHistoryFromContinuationV3,
    createSourceBallMaterialHistoryV1: () => createSourceBallMaterialHistoryV1,
    editLivePublicAbilityV1: () => editLivePublicAbilityV1,
    issueNativeCommandPitch: () => issueNativeCommandPitch,
    observeNativeAerodynamicPitch: () => observeNativeAerodynamicPitch,
    observeNativeFreeBallContinuation: () => observeNativeFreeBallContinuation,
    observeNativePitch: () => observeNativePitch,
    previewLivePublicLeagueV1: () => previewLivePublicLeagueV1,
    projectLivePublicAbilitiesV1: () => projectLivePublicAbilitiesV1
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

  // src/core/rules/FoulBallRule.ts
  var resolveFoulBallRule = (input) => {
    if (input.territory === "fair") {
      return {
        kind: "not_foul"
      };
    }
    if (input.flyCatch === null) {
      return {
        kind: "uncaught_foul",
        ballDead: true,
        countResult: resolvePitchCountRule(
          input.count,
          {
            kind: input.buntAttempt ? "foul_bunt" : "foul"
          }
        )
      };
    }
    if (input.flyCatch.kind === "unresolved") {
      return {
        kind: "unresolved_foul_fly",
        batterRunnerId: input.flyCatch.batterRunnerId,
        firstFielderTouchTick: input.flyCatch.firstFielderTouchTick
      };
    }
    if (input.flyCatch.kind === "caught") {
      return {
        kind: "caught_foul_fly",
        batterRunnerId: input.flyCatch.batterRunnerId,
        outTick: input.flyCatch.outTick,
        ballRemainsLive: true,
        runnerState: "tag_up_required_if_advancing"
      };
    }
    return {
      kind: "uncaught_foul",
      ballDead: true,
      countResult: resolvePitchCountRule(
        input.count,
        {
          kind: input.buntAttempt ? "foul_bunt" : "foul"
        }
      )
    };
  };

  // src/core/sim/plateAppearance/CanonicalPlateAppearanceTimeline.ts
  var validateTick = (name, tick8) => {
    if (!Number.isSafeInteger(tick8) || tick8 < 0) {
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
  var assertMonotonicTick = (timeline, tick8) => {
    validateTick("plate appearance event tick", tick8);
    if (tick8 < timeline.lastEventTick) {
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
  var recordCountedPitch = (timeline, tick8, adjudication) => {
    const active = assertActive(timeline);
    assertMonotonicTick(timeline, tick8);
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
      tick: tick8,
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
      lastEventTick: tick8,
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
  var validateTick3 = (name, tick8) => {
    if (!Number.isSafeInteger(tick8) || tick8 < 0) {
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
    const distance6 = magnitude(batToBall);
    const contactDistance = parameters.ballRadius + parameters.batRadius;
    if (distance6 > contactDistance) {
      return null;
    }
    const normal4 = distance6 > EPSILON ? scale(batToBall, 1 / distance6) : normalize(scale(pitch.velocity, -1));
    const leverArm = subtract(nearest.point, swing.pose.grip);
    const localBatVelocity = add(
      swing.linearVelocity,
      cross(swing.angularVelocity, leverArm)
    );
    const relativeVelocity = subtract(pitch.velocity, localBatVelocity);
    const normalSpeed = dot(relativeVelocity, normal4);
    if (normalSpeed >= 0) {
      return null;
    }
    const relativeNormal = scale(normal4, normalSpeed);
    const relativeTangent = subtract(relativeVelocity, relativeNormal);
    const postRelativeNormal = scale(
      normal4,
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
      cross(normal4, tangentSlip),
      parameters.spinTransfer / parameters.ballRadius
    );
    const exitSpin = add(pitch.spin, spinDelta);
    const contactPoint = add(nearest.point, scale(normal4, parameters.batRadius));
    return {
      tick: pitch.tick,
      ballCenter: pitch.position,
      point: contactPoint,
      batPoint: nearest.point,
      normal: normal4,
      segmentT: nearest.t,
      exitVelocity,
      exitSpin
    };
  };
  var createBattedBallInitialStateFromContact = (contact) => ({
    tick: contact.tick,
    position: contact.ballCenter,
    velocity: contact.exitVelocity,
    spin: contact.exitSpin
  });

  // src/core/sim/ExactEventTime.ts
  var FLOATING_TICK_TOLERANCE = 1e-9;
  var assertAuthoritativeTick = (tick8, name) => {
    if (!Number.isSafeInteger(tick8) || tick8 < 0) {
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
  var samplePitchTrajectorySegment = (segment, tick8) => {
    validateSegment(segment);
    if (!Number.isSafeInteger(tick8) || tick8 < segment.start.tick || tick8 > segment.endTick) {
      throw new Error(
        "pitch sample tick must lie inside the trajectory segment"
      );
    }
    const elapsedSeconds = (tick8 - segment.start.tick) / segment.ticksPerSecond;
    const sampled = sampleContinuous(
      segment,
      elapsedSeconds
    );
    return {
      tick: tick8,
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
    const roots3 = rootsAtCoordinate(
      segment.start.position.z,
      segment.start.velocity.z,
      segment.acceleration.z,
      plateZ
    ).filter((seconds) => seconds >= -EPSILON2 && seconds <= durationSeconds + EPSILON2).map((seconds) => Math.max(0, Math.min(durationSeconds, seconds))).sort((first, second) => first - second);
    if (roots3.length === 0) {
      return null;
    }
    const elapsedSeconds = roots3[0];
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
    let tick8 = input.swing.startTick;
    while (tick8 <= input.swing.endTick) {
      const pitch = samplePitchTrajectorySegment(
        input.trajectory,
        tick8
      );
      const swing = sampleBatterSwingState(
        input.swing.stateAtStart,
        tick8 - input.swing.startTick,
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
      if (tick8 === input.swing.endTick) {
        break;
      }
      const safeAdvanceTicks = separation > 0 && maxClosingSpeed > EPSILON3 ? Math.floor(
        separation / maxClosingSpeed * input.swing.ticksPerSecond
      ) - 1 : 1;
      tick8 = Math.min(
        input.swing.endTick,
        tick8 + Math.max(1, safeAdvanceTicks)
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
    const crossing2 = findPitchPlateCrossing(
      input.trajectory,
      input.plateZ
    );
    if (crossing2 === null) {
      return null;
    }
    const horizontalMin = input.strikeZone.centerX - input.strikeZone.halfWidth;
    const horizontalMax = input.strikeZone.centerX + input.strikeZone.halfWidth;
    const overlapsHorizontalZone = crossing2.position.x + input.ballRadiusMeters >= horizontalMin && crossing2.position.x - input.ballRadiusMeters <= horizontalMax;
    const overlapsVerticalZone = crossing2.position.y + input.ballRadiusMeters >= input.strikeZone.lowerY && crossing2.position.y - input.ballRadiusMeters <= input.strikeZone.upperY;
    return {
      kind: overlapsHorizontalZone && overlapsVerticalZone ? "called_strike" : "ball",
      crossing: crossing2,
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
      const physical4 = resolveTakenPitchPhysicalResult({
        trajectory: input.trajectory,
        plateZ: input.plateZ,
        strikeZone: input.strikeZone,
        ballRadiusMeters: input.ballRadiusMeters
      });
      if (physical4 === null) {
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
          result: physical4
        },
        timeline: recordTakenPitchPhysicalResult(
          timeline,
          physical4
        )
      };
    }
    const physical3 = resolveSwingingPitchPhysicalResult({
      trajectory: input.trajectory,
      swing: input.action.swing,
      contactParameters: input.contactParameters
    });
    return {
      kind: "recorded",
      physical: {
        kind: "swing",
        result: physical3
      },
      timeline: recordSwingingPitchPhysicalResult(
        timeline,
        physical3
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
  var assertScheduleTick = (name, tick8) => {
    if (!Number.isSafeInteger(tick8) || tick8 < 0) {
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
    const ticks2 = /* @__PURE__ */ new Set();
    ticks2.add(startTick);
    ticks2.add(endTick);
    let tick8 = startTick;
    while (tick8 + cadenceTicks < endTick) {
      tick8 += cadenceTicks;
      ticks2.add(tick8);
    }
    for (const event of events) {
      assertScheduleTick("event.tick", event.tick);
      if (event.tick >= startTick && event.tick <= endTick) {
        ticks2.add(event.tick);
      }
    }
    return [...ticks2].sort(
      (first, second) => first - second
    );
  }
  function buildMiniPresentationTimeline(samples, events, preContactCameraMode = "BATTER_POV") {
    assertStrictlyIncreasingSamples(samples);
    const sampleTicks = new Set(
      samples.map((sample3) => sample3.world.tick)
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
    for (const sample3 of samples) {
      const tick8 = sample3.world.tick;
      const tickEvents = eventsByTick.get(tick8) ?? [];
      const fairDeclaration = tickEvents.find(
        isFairBattedBallDeclaration
      );
      frames.push({
        tick: tick8,
        cameraMode,
        sample: sample3,
        events: tickEvents
      });
      if (cameraMode !== "FIELD_OVERHEAD" && fairDeclaration) {
        cameraMode = "FIELD_OVERHEAD";
        frames.push({
          tick: tick8,
          cameraMode,
          sample: sample3,
          events: tickEvents,
          cutReason: "fair_batted_ball_declared"
        });
      }
    }
    return frames;
  }

  // src/integration/browser/NativePitchObserverAdapter.ts
  var validTick = (tick8) => Number.isSafeInteger(tick8) && tick8 >= 0;
  function nativeBatPose(input, tick8) {
    if (input.action.kind === "take") {
      return { handedness: "R", action: "idle", bat: null };
    }
    const swing = input.action.swing;
    const clampedTick = Math.max(swing.startTick, Math.min(swing.endTick, tick8));
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
    const samples = eventTicks.map((tick8) => {
      const body = input.actorsAtTick(tick8);
      if (!body || !Array.isArray(body.defenders) || !Array.isArray(body.runners)) {
        throw new Error("Missing authoritative actor observation at tick " + tick8);
      }
      const ball = samplePitchTrajectorySegment(trajectory, tick8);
      const bat = nativeBatPose(input.pitch, tick8);
      return {
        world: {
          tick: tick8,
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
  var sampleSwingKinematicsV1 = (trajectory, tick8) => {
    validateTrajectory(
      trajectory
    );
    if (!Number.isSafeInteger(tick8) || tick8 < trajectory.startTick || tick8 > trajectory.endTick) {
      throw new Error(
        "swing kinematics sample tick must lie within the trajectory interval"
      );
    }
    const phase = tick8 < trajectory.contactTick ? "pre_contact" : tick8 === trajectory.contactTick ? "contact" : "follow_through";
    const sampled = tick8 <= trajectory.contactTick ? sampleSegment(
      trajectory.start,
      trajectory.contact,
      trajectory.startTick,
      trajectory.contactTick,
      tick8,
      trajectory.ticksPerSecond
    ) : sampleSegment(
      trajectory.contact,
      trajectory.finish,
      trajectory.contactTick,
      trajectory.endTick,
      tick8,
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
      tick: tick8,
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
  var sampleSwingStateV1 = (trajectory, tick8) => sampleSwingKinematicsV1(
    trajectory,
    tick8
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
    const speed2 = magnitude4(
      airRelativeVelocityMps
    );
    const tau = calculateBaseballSpinDecayTimeConstantSeconds(
      speed2,
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
  var validateAscending = (name, values2) => {
    for (let index = 1; index < values2.length; index += 1) {
      if (!(values2[index] > values2[index - 1])) {
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
    const zero6 = profile.reynoldsCorrectionZeroAtSpinFactor;
    const blend = spinFactor <= full ? 1 : spinFactor >= zero6 ? 0 : (zero6 - spinFactor) / (zero6 - full);
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
    const speed2 = magnitude5(relativeAirVelocity);
    if (speed2 <= EPSILON5 || parameters.airDensityKgM3 <= EPSILON5) {
      const zero6 = { x: 0, y: 0, z: 0 };
      return {
        relativeAirVelocity,
        activeSpin: zero6,
        spinFactor: 0,
        reynoldsNumber: null,
        dragCoefficientUsed: parameters.dragCoefficient,
        liftCoefficientUsed: 0,
        dragAcceleration: zero6,
        liftAcceleration: zero6,
        totalAcceleration: zero6
      };
    }
    const velocityHat = scale4(relativeAirVelocity, 1 / speed2);
    const parallelSpin = scale4(
      velocityHat,
      dot3(ballSpinRadPerSecond, velocityHat)
    );
    const activeSpin = subtract4(ballSpinRadPerSecond, parallelSpin);
    const activeSpinMagnitude = magnitude5(activeSpin);
    const spinFactor = parameters.ballRadiusM * activeSpinMagnitude / speed2;
    const area = Math.PI * parameters.ballRadiusM * parameters.ballRadiusM;
    const dynamicAccelerationScale = 0.5 * parameters.airDensityKgM3 * area * speed2 * speed2 / parameters.ballMassKg;
    const reynoldsNumber = parameters.coefficientProfile === void 0 ? null : speed2 * (2 * parameters.ballRadiusM) / parameters.airKinematicViscosityM2PerSecond;
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
    const speed2 = magnitude6(velocityMps);
    if (speed2 <= EPSILON6) {
      throw new Error(
        "pitch velocity must be non-zero for spin decomposition"
      );
    }
    const velocityDirection = scale5(
      velocityMps,
      1 / speed2
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
  var rotateVectorByQuaternion = (value, orientation) => {
    const q = normalizeQuaternion(orientation);
    const vectorQ = {
      w: 0,
      x: value.x,
      y: value.y,
      z: value.z
    };
    const conjugate = {
      w: q.w,
      x: -q.x,
      y: -q.y,
      z: -q.z
    };
    const rotated = multiplyQuaternions(
      multiplyQuaternions(q, vectorQ),
      conjugate
    );
    return {
      x: rotated.x,
      y: rotated.y,
      z: rotated.z
    };
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
  var sampleAerodynamicPitchStateAtElapsedSeconds = (state, elapsedSeconds, parameters) => {
    validateParameters3(parameters);
    if (!state || !Number.isSafeInteger(state.tick) || state.tick < 0 || ![state.position, state.velocity, state.spin].every((v2) => v2 && [v2.x, v2.y, v2.z].every(Number.isFinite))) {
      throw new Error("continuous aerodynamic evaluation requires an original finite source ball");
    }
    const throughTick = quantizeEventTick(state.tick, elapsedSeconds, parameters.ticksPerSecond);
    const rawTicks = elapsedSeconds * parameters.ticksPerSecond, nearest = Math.round(rawTicks);
    let remaining = elapsedSeconds === nearest / parameters.ticksPerSecond ? nearest : rawTicks;
    let current = state;
    while (remaining > 0) {
      const stepTicks = Math.min(parameters.integrationStepTicks, remaining);
      current = advanceAerodynamicPitchStep(current, stepTicks, parameters);
      remaining -= stepTicks;
    }
    return { ...current, tick: throughTick };
  };
  var sampleAerodynamicPitchTrajectory = (trajectory, tick8) => {
    validateTrajectory2(trajectory);
    if (!Number.isSafeInteger(tick8) || tick8 < trajectory.start.tick || tick8 > trajectory.endTick) {
      throw new Error(
        "aerodynamic pitch sample tick must lie inside the trajectory interval"
      );
    }
    return advanceAerodynamicPitchState(
      trajectory.start,
      tick8 - trajectory.start.tick,
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
      (tick8) => {
        const sampled = sampleAerodynamicPitchTrajectory(
          trajectory,
          tick8
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

  // src/presentation/mini/NativeSpinOrientationObserver.ts
  var MAX_INTEGRATION_ANCHORS = 1e5;
  var MAX_PRESENTATION_FRAMES = 2e4;
  var SPIN_ZERO_EPSILON = 1e-12;
  var HALF_TURN = Math.PI;
  var QUARTER_TURN = Math.PI / 2;
  function requireTick(value, name) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("Native spin orientation " + name + " must be a non-negative safe integer tick.");
    }
  }
  function finiteVector(value, name) {
    if (value === null || typeof value !== "object" || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
      throw new Error("Native spin orientation requires finite " + name + " vector components.");
    }
  }
  function copyAndFreezeInert(value) {
    const ancestors = /* @__PURE__ */ new Set();
    let nodes = 0;
    const visit = (current, depth) => {
      nodes++;
      if (nodes > 1e5 || depth > 64) {
        throw new Error("Native spin source exceeds pure-data size/depth limits.");
      }
      if (current === null || typeof current === "string" || typeof current === "boolean") return current;
      if (typeof current === "number") {
        if (!Number.isFinite(current)) throw new Error("Native spin source requires finite numbers.");
        return current === 0 ? 0 : current;
      }
      if (typeof current !== "object") {
        throw new Error("Native spin source must contain inert physics data only.");
      }
      if (ancestors.has(current)) throw new Error("Native spin source must not contain cycles.");
      ancestors.add(current);
      if (Array.isArray(current)) {
        if (Reflect.ownKeys(current).length !== current.length + 1) {
          throw new Error("Native spin source requires dense arrays.");
        }
        const array = [];
        for (let i = 0; i < current.length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(i));
          if (!descriptor?.enumerable || !("value" in descriptor)) {
            throw new Error("Native spin source must not contain accessors.");
          }
          array.push(visit(descriptor.value, depth + 1));
        }
        ancestors.delete(current);
        return Object.freeze(array);
      }
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error("Native spin source requires plain physical-data objects.");
      }
      const out = {};
      for (const key3 of Reflect.ownKeys(current)) {
        if (typeof key3 !== "string") throw new Error("Native spin source rejects symbol keys.");
        const descriptor = Object.getOwnPropertyDescriptor(current, key3);
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          throw new Error("Native spin source must not contain accessors.");
        }
        if (descriptor.value === void 0) continue;
        Object.defineProperty(out, key3, {
          value: visit(descriptor.value, depth + 1),
          enumerable: true
        });
      }
      ancestors.delete(current);
      return Object.freeze(out);
    };
    return visit(value, 0);
  }
  function speed(spin) {
    return Math.hypot(spin.x, spin.y, spin.z);
  }
  function finiteSpin(state, tick8) {
    if (state.tick !== tick8) {
      throw new Error("Native spin physical sampler returned a different canonical tick.");
    }
    finiteVector(state.spin, "angular velocity");
    finiteVector(state.position, "ball position");
    finiteVector(state.velocity, "ball velocity");
  }
  function integrateInterval(current, deltaTicks, trajectory) {
    if (deltaTicks === 0) return current;
    const { parameters } = trajectory;
    const halfTicks = Math.floor(deltaTicks / 2);
    const midpoint = advanceAerodynamicPitchState(current.physical, halfTicks, parameters);
    const endpoint = advanceAerodynamicPitchState(current.physical, deltaTicks, parameters);
    const s0 = current.physical.spin;
    const sm = midpoint.spin;
    const s1 = endpoint.spin;
    const elapsedSeconds = deltaTicks / parameters.ticksPerSecond;
    const angularVelocityMean = {
      x: (s0.x + 4 * sm.x + s1.x) / 6,
      y: (s0.y + 4 * sm.y + s1.y) / 6,
      z: (s0.z + 4 * sm.z + s1.z) / 6
    };
    const materialOrientation = advanceBaseballOrientation(
      current.materialOrientation,
      angularVelocityMean,
      elapsedSeconds
    );
    const angularTravel = elapsedSeconds * (speed(s0) + 4 * speed(sm) + speed(s1)) / 6;
    if (!Number.isFinite(angularTravel)) {
      throw new Error("Native spin physical angular travel must be finite.");
    }
    finiteSpin(endpoint, current.tick + deltaTicks);
    return {
      tick: endpoint.tick,
      physical: endpoint,
      materialOrientation,
      unwrappedAngularTravelRadians: current.unwrappedAngularTravelRadians + angularTravel
    };
  }
  function createNativeSpinOrientationObserver(input) {
    const trajectory = copyAndFreezeInert(input.trajectory);
    const { start, endTick, parameters } = trajectory;
    requireTick(start.tick, "source release");
    requireTick(endTick, "source end");
    requireTick(parameters.ticksPerSecond, "ticksPerSecond");
    requireTick(parameters.integrationStepTicks, "integrationStepTicks");
    if (endTick < start.tick || parameters.ticksPerSecond === 0 || parameters.integrationStepTicks === 0) {
      throw new Error("Native spin requires a valid real flight interval and positive source clock.");
    }
    finiteSpin(start, start.tick);
    const physicalStopTick = input.physicalStopTick ?? endTick;
    requireTick(physicalStopTick, "physical stop");
    if (physicalStopTick < start.tick || physicalStopTick > endTick) {
      throw new Error("Native spin stop tick must lie within the true source flight.");
    }
    if ((physicalStopTick - start.tick) / parameters.integrationStepTicks > MAX_INTEGRATION_ANCHORS) {
      throw new Error("Native spin source grid exceeds the bounded observation limit.");
    }
    const hasRelease = trajectory.releaseOrientation !== void 0;
    const releaseOrientation = hasRelease ? normalizeQuaternion(trajectory.releaseOrientation) : IDENTITY_QUATERNION;
    const orientationProvenance = hasRelease ? "native_source_release_orientation" : "identity_display_convention_uncalibrated";
    const anchors = [{
      tick: start.tick,
      physical: start,
      materialOrientation: releaseOrientation,
      unwrappedAngularTravelRadians: 0
    }];
    const gridStep = parameters.integrationStepTicks;
    const integrateToTick = (tick8) => {
      requireTick(tick8, "sample");
      if (tick8 < start.tick || tick8 > physicalStopTick) {
        throw new Error("Native spin cannot observe outside actual release/physical stop.");
      }
      const gridIndex = Math.floor((tick8 - start.tick) / gridStep);
      while (anchors.length <= gridIndex) {
        const prior = anchors[anchors.length - 1];
        anchors.push(integrateInterval(prior, gridStep, trajectory));
      }
      const base = anchors[gridIndex];
      return integrateInterval(base, tick8 - base.tick, trajectory);
    };
    const sampleAtTick = (tick8, options) => {
      if (!options) throw new Error("Native spin requires explicit display shutter settings.");
      requireTick(options.shutterTicks, "shutterTicks");
      const current = integrateToTick(tick8);
      const previous = options.previousFrameTick;
      if (previous !== void 0) {
        requireTick(previous, "previous frame");
        if (previous >= tick8) {
          throw new Error("Native spin previous frame must strictly precede the current tick.");
        }
      }
      const previousAnchor = previous === void 0 ? null : integrateToTick(previous);
      const openTick = Math.max(start.tick, tick8 - Math.floor(options.shutterTicks / 2));
      const closeTick = Math.min(physicalStopTick, tick8 + Math.ceil(options.shutterTicks / 2));
      const opened = integrateToTick(openTick);
      const closed = integrateToTick(closeTick);
      const shutterAngle = Math.max(
        0,
        closed.unwrappedAngularTravelRadians - opened.unwrappedAngularTravelRadians
      );
      const interframeAngle = previousAnchor === null ? null : Math.max(
        0,
        current.unwrappedAngularTravelRadians - previousAnchor.unwrappedAngularTravelRadians
      );
      const instantSpin = current.physical.spin;
      const angularSpeed = speed(instantSpin);
      const axis = angularSpeed <= SPIN_ZERO_EPSILON ? null : Object.freeze({
        x: instantSpin.x / angularSpeed,
        y: instantSpin.y / angularSpeed,
        z: instantSpin.z / angularSpeed
      });
      const shutter = {
        requestedShutterTicks: options.shutterTicks,
        openTick,
        closeTick,
        exposureSeconds: (closeTick - openTick) / parameters.ticksPerSecond,
        angularTravelRadians: shutterAngle,
        rotationsDuringExposure: shutterAngle / (2 * Math.PI),
        openOrientation: opened.materialOrientation,
        closeOrientation: closed.materialOrientation,
        quarterTurnSampleCount: Math.max(1, Math.ceil(shutterAngle / QUARTER_TURN) + 1),
        singleSamplePhaseAliasingRisk: shutterAngle > HALF_TURN
      };
      return copyAndFreezeInert({
        authority: "PRESENTATION_ONLY_NATIVE_SPIN",
        tick: tick8,
        elapsedSecondsSinceRelease: (tick8 - start.tick) / parameters.ticksPerSecond,
        ticksPerSecond: parameters.ticksPerSecond,
        angularVelocityWorldRadPerSecond: instantSpin,
        angularSpeedRadPerSecond: angularSpeed,
        spinAxisWorld: axis,
        orientationMaterialToWorld: current.materialOrientation,
        orientationProvenance,
        hasSourceReleaseOrientation: hasRelease,
        angularTravelSinceReleaseRadians: current.unwrappedAngularTravelRadians,
        previousFrameTick: previous ?? null,
        angularTravelSincePreviousFrameRadians: interframeAngle,
        interframePhaseAliasingRisk: interframeAngle === null ? null : interframeAngle > HALF_TURN,
        shutter
      });
    };
    const sampleFrameTicks = (ticks2, options) => {
      if (!Array.isArray(ticks2) || ticks2.length > MAX_PRESENTATION_FRAMES) {
        throw new Error("Native spin requires a bounded array of high-frequency frame ticks.");
      }
      if (!options) throw new Error("Native spin requires explicit display shutter settings.");
      requireTick(options.shutterTicks, "shutterTicks");
      for (let index = 0; index < ticks2.length; index++) {
        requireTick(ticks2[index], "frame tick");
        if (index > 0 && ticks2[index] <= ticks2[index - 1]) {
          throw new Error("Native spin presentation timestamps must be strictly increasing.");
        }
        if (ticks2[index] < start.tick || ticks2[index] > physicalStopTick) {
          throw new Error("Native spin frame is outside true source flight.");
        }
      }
      return Object.freeze(ticks2.map((tick8, i) => sampleAtTick(tick8, {
        shutterTicks: options.shutterTicks,
        previousFrameTick: i === 0 ? void 0 : ticks2[i - 1]
      })));
    };
    return Object.freeze({
      releaseTick: start.tick,
      physicalStopTick,
      ticksPerSecond: parameters.ticksPerSecond,
      orientationProvenance,
      sampleAtTick,
      sampleFrameTicks
    });
  }

  // src/integration/browser/NativeAerodynamicObserver.ts
  var isTick = (tick8) => Number.isSafeInteger(tick8) && tick8 >= 0;
  var sameVector = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
  var sameContact = (actual, expected) => actual.tick === expected.tick && actual.segmentT === expected.segmentT && sameVector(actual.ballCenter, expected.ballCenter) && sameVector(actual.point, expected.point) && sameVector(actual.batPoint, expected.batPoint) && sameVector(actual.normal, expected.normal) && sameVector(actual.exitVelocity, expected.exitVelocity) && sameVector(actual.exitSpin, expected.exitSpin);
  function assertCountedCall(call, kind, tick8, before, after) {
    if (call?.kind !== "PitchAdjudicated" || call.tick !== tick8 || call.payload.adjudication.kind !== kind || before.status.kind !== "active" || call.payload.countBefore.balls !== before.status.count.balls || call.payload.countBefore.strikes !== before.status.count.strikes) {
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
      const crossing2 = events[0];
      if (pitch.action.kind !== "take" || events.length !== 2 || crossing2?.kind !== "TakenPitchPlateCrossed" || crossing2.tick !== resolution.physical.crossing.tick || JSON.stringify(crossing2.payload.result) !== JSON.stringify(resolution.physical)) {
        throw new Error("Native aerodynamic observation requires the real aerodynamic plate crossing.");
      }
      assertCountedCall(events[1], resolution.physical.kind, crossing2.tick, before, after);
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
  function batterPose(input, tick8) {
    const handedness = input.batterHandedness;
    if (input.pitch.action.kind === "take") return { handedness, action: "idle", bat: null };
    const { swing } = input.pitch.action;
    if (tick8 < swing.startTick || tick8 > swing.endTick) return { handedness, action: "idle", bat: null };
    const pose = swing.kinematicsV1 !== void 0 ? sampleSwingStateV1(swing.kinematicsV1, tick8).pose : sampleCompatibilityBatterSwingState(swing.stateAtStart, tick8 - swing.startTick, swing.ticksPerSecond).pose;
    return { handedness, action: "normal_swing", bat: pose };
  }
  function observedSpinTicks(canonicalTicks, additionalTicks, startTick, stopTick) {
    if (additionalTicks === void 0) return canonicalTicks;
    if (!Array.isArray(additionalTicks)) {
      throw new Error("Native spin render ticks must be an array of physical source ticks.");
    }
    for (let index = 0; index < additionalTicks.length; index++) {
      const tick8 = additionalTicks[index];
      if (!isTick(tick8) || tick8 < startTick || tick8 > stopTick) {
        throw new Error("Native spin render tick must lie inside the true source flight through physical contact.");
      }
      if (index > 0 && tick8 <= additionalTicks[index - 1]) {
        throw new Error("Native spin render ticks must be strictly increasing.");
      }
    }
    return [.../* @__PURE__ */ new Set([...canonicalTicks, ...additionalTicks])].sort((a, b) => a - b);
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
    const ticks2 = createMiniPresentationSampleSchedule(trajectory.start.tick, stopTick, cadenceTicks, events);
    const spinTicks = observedSpinTicks(ticks2, input.spinFrameTicks, trajectory.start.tick, stopTick);
    const spinFrames = createNativeSpinOrientationObserver({
      trajectory,
      physicalStopTick: stopTick
    }).sampleFrameTicks(spinTicks, { shutterTicks: input.spinShutterTicks ?? 0 });
    const samples = ticks2.map((tick8) => {
      const actors = input.actorsAtTick(tick8);
      if (!actors || !Array.isArray(actors.defenders) || !Array.isArray(actors.runners)) {
        throw new Error(`Missing authoritative native actor state at tick ${tick8}.`);
      }
      const flight = sampleAerodynamicPitchTrajectory(trajectory, tick8);
      const ball = contact !== null && tick8 === contact.tick ? { position: contact.ballCenter, velocity: contact.exitVelocity, spin: contact.exitSpin } : { position: flight.position, velocity: flight.velocity, spin: flight.spin };
      return {
        world: { tick: tick8, defenders: actors.defenders, runners: actors.runners, ball },
        batter: batterPose(input, tick8),
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
      spinFrames,
      rigidContact: contact,
      nextMatchState: null,
      requiresOfficialLiveBallResolution: contact !== null
    };
  }

  // src/core/rules/RuleProfile.ts
  var NPB_2026_RULE_PROFILE = {
    id: asRuleProfileId("npb-2026"),
    jurisdiction: "NPB",
    season: 2026,
    rulesRevision: "2026",
    tagUp: {
      legalReleaseBasis: "first_fielder_touch",
      earlyDepartureRequiresAppeal: true
    },
    appeal: {
      nextPitchOrPlayClosesWindow: true,
      defenseLeavingFieldClosesInningEndingWindow: true,
      sameTickWindowCloseResolution: "unresolved",
      advantageousFourthOutPolicy: "defense_may_elect_advantageous_out"
    },
    officialWindows: {
      appeal: { available: true }
    },
    thirdOutScoring: {
      batterRunnerBeforeFirstSuppressesRuns: true,
      forceThirdOutSuppressesRuns: true,
      precedingRunnerAppealSuppressesFollowingRuns: true
    },
    defensiveAlignment: {
      requiredInfielderCount: 4,
      infieldBoundary: {
        enabled: true,
        evaluationMoment: "pitching_related_motion_start",
        geometrySource: "stadium_profile"
      },
      secondBaseSide: {
        enabled: true,
        evaluationMoment: "pitch_release",
        minimumInfieldersEachSideOfSecondBase: 2,
        sideDeterminedBy: "both_feet",
        assignmentLock: {
          enabled: true,
          establishedAt: "inning_first_pitch_release",
          duration: "half_inning"
        }
      },
      violationPolicyId: "npb_2026_5_02_c"
    }
  };
  var RULE_PROFILES = /* @__PURE__ */ new Map([
    [NPB_2026_RULE_PROFILE.id, NPB_2026_RULE_PROFILE]
  ]);

  // src/core/adjudication/OfficialWindowPolicy.ts
  var cloneInert = (input) => {
    const ancestors = /* @__PURE__ */ new Set();
    let nodes = 0;
    const visit = (value, depth) => {
      nodes += 1;
      if (nodes > 1e5 || depth > 64) throw new Error("official window input exceeds size limits");
      if (value === null || typeof value === "string" || typeof value === "boolean") return value;
      if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new Error("official window input must be finite");
        return value;
      }
      if (typeof value !== "object") throw new Error("official window input must contain inert data only");
      if (ancestors.has(value)) throw new Error("official window input must not contain cycles");
      ancestors.add(value);
      const result = Array.isArray(value) ? [] : {};
      if (!Array.isArray(value)) {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
          throw new Error("official window input must be a plain inert object");
        }
      } else if (Reflect.ownKeys(value).length !== value.length + 1) {
        throw new Error("official window input must be a dense inert array");
      }
      for (const key3 of Reflect.ownKeys(value)) {
        if (Array.isArray(value) && key3 === "length") continue;
        if (typeof key3 !== "string") throw new Error("official window input must not contain symbols");
        const descriptor = Object.getOwnPropertyDescriptor(value, key3);
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
          throw new Error("official window input must not contain accessors");
        }
        Object.defineProperty(result, key3, {
          value: visit(descriptor.value, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true
        });
      }
      ancestors.delete(value);
      return result;
    };
    return visit(input, 0);
  };

  // src/core/sim/contact/ReferenceBatKinematicsV1.ts
  var add6 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  var sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  var scale8 = (a, n) => ({ x: a.x * n, y: a.y * n, z: a.z * n });
  var cross6 = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  var magnitude8 = (a) => Math.hypot(a.x, a.y, a.z);
  var dot5 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var fields = (a, names2) => !!a && typeof a === "object" && !Array.isArray(a) && Object.keys(a).sort().join("|") === names2.sort().join("|");
  var vec = (a) => fields(a, ["x", "y", "z"]) && Object.values(a).every((v2) => Number.isFinite(v2) && Math.abs(v2) <= 1e6);
  var quat = (a) => fields(a, ["x", "y", "z", "w"]) && Object.values(a).every(Number.isFinite) && Math.abs(Math.hypot(a.x, a.y, a.z, a.w) - 1) < 1e-6;
  var tick = (a) => Number.isSafeInteger(a) && a >= 0;
  var zero = () => ({ x: 0, y: 0, z: 0 });
  var createReferenceBatKinematicsV1 = (raw) => {
    const input = cloneInert(raw);
    if (!fields(input, ["provenance", "frames", "batLengthM", "sweetSpotT", "sourceTicksPerSecond", "startTick", "ticksPerSecond", "playbackRate", "transform"]) || !fields(input.provenance, ["clipId", "sourceSha256"]) || !input.provenance.clipId?.trim() || !/^[0-9a-f]{64}$/.test(input.provenance.sourceSha256) || !Array.isArray(input.frames) || input.frames.length < 2 || input.frames.length > 1e4 || ![input.batLengthM, input.sweetSpotT, input.sourceTicksPerSecond, input.ticksPerSecond, input.playbackRate].every(Number.isFinite) || input.batLengthM <= 0 || input.batLengthM > 2 || input.sweetSpotT < 0.65 || input.sweetSpotT > 0.9 || !Number.isSafeInteger(input.sourceTicksPerSecond) || input.sourceTicksPerSecond <= 0 || input.sourceTicksPerSecond > 1e9 || !Number.isSafeInteger(input.ticksPerSecond) || input.ticksPerSecond <= 0 || input.ticksPerSecond > 1e9 || input.playbackRate < 0.01 || input.playbackRate > 20 || !tick(input.startTick) || !fields(input.transform, ["rotation", "translation", "scale"]) || !quat(input.transform.rotation) || !vec(input.transform.translation) || !Number.isFinite(input.transform.scale) || input.transform.scale <= 0 || input.transform.scale > 10 || input.frames.some((f, i) => !fields(f, ["tick", "grip", "orientation"]) || !tick(f.tick) || !vec(f.grip) || !quat(f.orientation) || i > 0 && f.tick <= input.frames[i - 1].tick)) throw new Error("invalid sampled reference bat trajectory");
    const rotation = normalizeQuaternion(input.transform.rotation), length = input.batLengthM * input.transform.scale;
    const radius = length * input.sweetSpotT, speedScale = input.transform.scale * input.playbackRate;
    const frames = input.frames.map((f) => ({ ...f, orientation: normalizeQuaternion(f.orientation) }));
    const segments = frames.slice(0, -1).map((one, i) => {
      const two = frames[i + 1], dt = (two.tick - one.tick) / input.sourceTicksPerSecond;
      let next = two.orientation;
      if (Object.keys(one.orientation).reduce((v2, k) => v2 + one.orientation[k] * next[k], 0) < 0)
        next = { x: -next.x, y: -next.y, z: -next.z, w: -next.w };
      const q = normalizeQuaternion(multiplyQuaternions(next, { x: -one.orientation.x, y: -one.orientation.y, z: -one.orientation.z, w: one.orientation.w }));
      const sine = Math.hypot(q.x, q.y, q.z), angle2 = 2 * Math.atan2(sine, Math.max(0, q.w));
      const omega = sine < 1e-12 ? zero() : scale8({ x: q.x, y: q.y, z: q.z }, angle2 / (sine * dt));
      const velocity = scale8(sub(two.grip, one.grip), 1 / dt);
      const axis = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, one.orientation);
      const speedBound = magnitude8(velocity) * speedScale + magnitude8(cross6(omega, axis)) * radius * input.playbackRate;
      const linear = scale8(velocity, speedScale), rotational = scale8(cross6(omega, axis), radius * input.playbackRate);
      const omegaNorm = magnitude8(omega), turnAxis = omegaNorm ? scale8(omega, 1 / omegaNorm) : zero();
      const a = dot5(linear, rotational), b = dot5(linear, cross6(turnAxis, rotational));
      const candidates = [0, angle2], maximumPhase = Math.atan2(b, a);
      for (const phase of [maximumPhase, maximumPhase + 2 * Math.PI, maximumPhase - 2 * Math.PI])
        if (phase >= 0 && phase <= angle2) candidates.push(phase);
      const peak = Math.max(...candidates.map((phase) => a * Math.cos(phase) + b * Math.sin(phase)));
      const maximumSweetSpeed = Math.sqrt(Math.max(0, dot5(linear, linear) + dot5(rotational, rotational) + 2 * peak));
      return { one, two, dt, omega, velocity, speedBound, maximumSweetSpeed };
    });
    const first = frames[0], last = frames[frames.length - 1];
    const sampleCoordinate = (sourceTick, atTick, side) => {
      let grip, orientation, linear = zero(), angular = zero();
      if (sourceTick < first.tick || sourceTick > last.tick || sourceTick === first.tick && side === "incoming" || sourceTick === last.tick && side === "outgoing") {
        const frame2 = sourceTick <= first.tick ? first : last;
        grip = frame2.grip;
        orientation = frame2.orientation;
      } else {
        let lo = 0, hi = segments.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (side === "incoming" ? segments[mid].one.tick < sourceTick : segments[mid].one.tick <= sourceTick) lo = mid;
          else hi = mid - 1;
        }
        const s = segments[lo], u = (sourceTick - s.one.tick) / (s.two.tick - s.one.tick);
        grip = add6(s.one.grip, scale8(sub(s.two.grip, s.one.grip), u));
        orientation = normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(s.omega, magnitude8(s.omega) * s.dt * u), s.one.orientation));
        linear = scale8(rotateVectorByQuaternion(s.velocity, rotation), speedScale);
        angular = scale8(rotateVectorByQuaternion(s.omega, rotation), input.playbackRate);
      }
      const worldGrip = add6(input.transform.translation, scale8(rotateVectorByQuaternion(grip, rotation), input.transform.scale));
      const worldOrientation = normalizeQuaternion(multiplyQuaternions(rotation, orientation));
      const axis = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, worldOrientation);
      const state = { pose: { grip: worldGrip, tip: add6(worldGrip, scale8(axis, length)) }, linearVelocity: linear, angularVelocity: angular };
      return {
        tick: atTick,
        sourceTick: Math.max(first.tick, Math.min(last.tick, sourceTick)),
        orientation: worldOrientation,
        state,
        sweetSpot: add6(worldGrip, scale8(axis, radius)),
        sweetSpotVelocity: add6(linear, cross6(angular, scale8(axis, radius)))
      };
    };
    const sampleContinuous2 = (atTick) => {
      if (!Number.isFinite(atTick) || atTick < 0) throw new Error("invalid reference bat observation tick");
      const sourceTick = first.tick + (atTick - input.startTick) / input.ticksPerSecond * input.sourceTicksPerSecond * input.playbackRate;
      return sampleCoordinate(sourceTick, atTick, "outgoing");
    };
    const sampleAtSourceTick = (sourceTick, side = "outgoing") => {
      if (!Number.isFinite(sourceTick) || sourceTick < 0 || !["incoming", "outgoing"].includes(side)) throw new Error("invalid original reference source tick");
      const atTick = input.startTick + (sourceTick - first.tick) / input.sourceTicksPerSecond / input.playbackRate * input.ticksPerSecond;
      return sampleCoordinate(sourceTick, atTick, side);
    };
    const sample3 = (atTick) => {
      if (!tick(atTick)) throw new Error("invalid reference bat observation tick");
      return sampleContinuous2(atTick);
    };
    return Object.freeze({
      authority: "SAMPLED_RIGID_REFERENCE_RESEARCH",
      nativeAdmission: false,
      officialResult: null,
      provenance: Object.freeze({ ...input.provenance }),
      batLengthM: length,
      sweetSpotT: input.sweetSpotT,
      maximumSweetSpotSpeedUpperBoundMps: Math.max(...segments.map((s) => s.speedBound)),
      maximumSweetSpotSpeedMps: Math.max(...segments.map((s) => s.maximumSweetSpeed)),
      maximumGripSpeedMps: Math.max(...segments.map((s) => magnitude8(s.velocity) * speedScale)),
      maximumAngularSpeedRadPerSecond: Math.max(...segments.map((s) => magnitude8(s.omega) * input.playbackRate)),
      sample: sample3,
      sampleContinuous: sampleContinuous2,
      sampleAtSourceTick
    });
  };

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
  var add7 = (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  });
  var subtract7 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var scale9 = (value, scalar) => ({
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar
  });
  var dot6 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var cross7 = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  var magnitude9 = (value) => Math.hypot(value.x, value.y, value.z);
  var normalize4 = (value) => {
    const length = magnitude9(value);
    if (length <= EPSILON9) {
      throw new Error("cannot normalize a zero-length vector");
    }
    return scale9(value, 1 / length);
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
    const lengthM = magnitude9(delta);
    if (lengthM <= EPSILON9) {
      throw new Error("bat pose grip and tip must not be identical");
    }
    return {
      axis: scale9(delta, 1 / lengthM),
      lengthM
    };
  };
  var closestPointOnTaperedBat = (point, bat) => {
    const { axis, lengthM } = axisGeometry(bat.pose);
    const fromGrip = subtract7(
      point,
      bat.pose.grip
    );
    const projectedS = dot6(
      fromGrip,
      axis
    );
    const perpendicular = subtract7(
      fromGrip,
      scale9(axis, projectedS)
    );
    const perpendicularDistance = magnitude9(
      perpendicular
    );
    let best = null;
    const consider = (candidateT) => {
      const t = clamp012(candidateT);
      const axisPoint = add7(
        bat.pose.grip,
        scale9(axis, t * lengthM)
      );
      const localRadiusM = sampleBatRadius(
        bat.physical.radiusProfile,
        t
      );
      const surfaceSeparationM = magnitude9(subtract7(point, axisPoint)) - localRadiusM;
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
  var batCenterOfMassPoint = (bat) => add7(
    bat.pose.grip,
    scale9(
      subtract7(bat.pose.tip, bat.pose.grip),
      bat.physical.centerOfMassT
    )
  );
  var applyBatInverseInertia = (value, batAxis, physical3) => {
    const parallel = scale9(batAxis, dot6(value, batAxis));
    const perpendicular = subtract7(value, parallel);
    return add7(
      scale9(parallel, 1 / physical3.axialMomentOfInertiaKgM2),
      scale9(
        perpendicular,
        1 / physical3.transverseMomentOfInertiaKgM2
      )
    );
  };
  var applyBallInverseInertia = (value, ball) => {
    const inertia = ball.rotationalInertiaFactor * ball.massKg * ball.radiusM * ball.radiusM;
    return scale9(value, 1 / inertia);
  };
  var pointVelocity = (centerVelocity, angularVelocity, leverArm) => add7(
    centerVelocity,
    cross7(angularVelocity, leverArm)
  );
  var applyImpulse = (state, impulseOnBall, ballLeverArm, batLeverArm, ball, bat, batAxis) => {
    state.ballVelocity = add7(
      state.ballVelocity,
      scale9(impulseOnBall, 1 / ball.massKg)
    );
    state.ballSpin = add7(
      state.ballSpin,
      applyBallInverseInertia(
        cross7(ballLeverArm, impulseOnBall),
        ball
      )
    );
    const impulseOnBat = scale9(impulseOnBall, -1);
    state.batVelocity = add7(
      state.batVelocity,
      scale9(impulseOnBat, 1 / bat.physical.massKg)
    );
    state.batAngularVelocity = add7(
      state.batAngularVelocity,
      applyBatInverseInertia(
        cross7(batLeverArm, impulseOnBat),
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
    const angular = dot6(
      direction,
      cross7(
        applyBallInverseInertia(
          cross7(ballLeverArm, direction),
          ball
        ),
        ballLeverArm
      )
    );
    return 1 / ball.massKg + angular;
  };
  var rigidBatInverseMassContributionAlong = (direction, batLeverArm, bat, batAxis) => {
    const angular = dot6(
      direction,
      cross7(
        applyBatInverseInertia(
          cross7(batLeverArm, direction),
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
  var createRigidBatStateFromBatterSwingState = (swing, physical3) => {
    validateBat({
      pose: swing.pose,
      centerOfMassVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      angularVelocity: swing.angularVelocity,
      physical: physical3
    });
    const centerOfMassPoint = add7(
      swing.pose.grip,
      scale9(
        subtract7(
          swing.pose.tip,
          swing.pose.grip
        ),
        physical3.centerOfMassT
      )
    );
    const gripToCenterOfMass = subtract7(
      centerOfMassPoint,
      swing.pose.grip
    );
    return {
      pose: swing.pose,
      centerOfMassVelocity: add7(
        swing.linearVelocity,
        cross7(
          swing.angularVelocity,
          gripToCenterOfMass
        )
      ),
      angularVelocity: swing.angularVelocity,
      physical: physical3
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
    const centerDistance = magnitude9(axisToBall);
    const centerOfMass = batCenterOfMassPoint(bat);
    const fallbackRelative = subtract7(
      pitch.velocity,
      bat.centerOfMassVelocity
    );
    const normal4 = centerDistance > EPSILON9 ? scale9(
      axisToBall,
      1 / centerDistance
    ) : normalize4(
      scale9(
        fallbackRelative,
        -1
      )
    );
    const batSurfacePoint = add7(
      nearest.point,
      scale9(
        normal4,
        localBatRadiusM
      )
    );
    const ballSurfacePoint = add7(
      pitch.position,
      scale9(
        normal4,
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
    const normalRelativeSpeed = dot6(
      relativeBefore,
      normal4
    );
    if (normalRelativeSpeed >= 0) {
      return null;
    }
    const tangentBefore = subtract7(
      relativeBefore,
      scale9(
        normal4,
        normalRelativeSpeed
      )
    );
    const tangentialRelativeSpeedBeforeMps = magnitude9(tangentBefore);
    return {
      kinematics: {
        tick: pitch.tick,
        segmentT: nearest.t,
        localBatRadiusM,
        normal: normal4,
        batSurfacePoint,
        ballSurfacePoint,
        relativeSurfaceVelocityBefore: relativeBefore,
        totalRelativeSurfaceSpeedMps: magnitude9(relativeBefore),
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
    const normalImpulse = scale9(
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
      const normalAfterNormal = dot6(
        relativeAfterNormal,
        kinematics.normal
      );
      const tangentAfterNormal = subtract7(
        relativeAfterNormal,
        scale9(
          kinematics.normal,
          normalAfterNormal
        )
      );
      const tangentSpeedAfterNormal = magnitude9(tangentAfterNormal);
      if (tangentSpeedAfterNormal > EPSILON9) {
        const tangentDirection = scale9(
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
        tangentialImpulseNs = scale9(
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
    const totalImpulseNs = add7(
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
  var createRigidBatSwingWindowFromKinematicsV1 = (kinematicsV1, physical3) => ({
    startTick: kinematicsV1.startTick,
    endTick: kinematicsV1.endTick,
    ticksPerSecond: kinematicsV1.ticksPerSecond,
    stateAtStart: sampleSwingStateV1(
      kinematicsV1,
      kinematicsV1.startTick
    ),
    physical: physical3,
    kinematicsV1
  });
  var EPSILON10 = 1e-12;
  var magnitude10 = (value) => Math.hypot(
    value.x,
    value.y,
    value.z
  );
  var subtract8 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var cross8 = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  var add8 = (a, b) => ({
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
  var sampleSwing = (swing, tick8) => swing.kinematicsV1 !== void 0 ? sampleSwingStateV1(
    swing.kinematicsV1,
    tick8
  ) : sampleCompatibilityBatterSwingState(
    swing.stateAtStart,
    tick8 - swing.startTick,
    swing.ticksPerSecond
  );
  var maximumClosingSpeed = (input, sampledBatPointSpeed) => {
    const durationSeconds = (input.swing.endTick - input.trajectory.start.tick) / input.swing.ticksPerSecond;
    const wind = input.trajectory.parameters.aerodynamics.windVelocityMps;
    const releaseAirRelative = subtract8(
      input.trajectory.start.velocity,
      wind
    );
    const conservativePitchSpeed = magnitude10(releaseAirRelative) + Math.abs(
      input.trajectory.parameters.gravityY
    ) * durationSeconds + magnitude10(wind);
    if (sampledBatPointSpeed !== void 0) return conservativePitchSpeed + sampledBatPointSpeed;
    if (input.swing.kinematicsV1 !== void 0) {
      return conservativePitchSpeed + SWING_KINEMATICS_V1_CONSERVATIVE_MAX_BAT_POINT_SPEED_MPS;
    }
    const batAxis = subtract8(
      input.swing.stateAtStart.pose.tip,
      input.swing.stateAtStart.pose.grip
    );
    const gripSpeed = magnitude10(
      input.swing.stateAtStart.linearVelocity
    );
    const tipSpeed = magnitude10(
      add8(
        input.swing.stateAtStart.linearVelocity,
        cross8(
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
    const gripSpeed = magnitude10(
      sampledSwing.linearVelocity
    );
    const tipSpeed = magnitude10(
      add8(
        sampledSwing.linearVelocity,
        cross8(
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
    const rawSampled = input.swing.sampledKinematicsV1;
    if (Object.hasOwn(input.swing, "sampledKinematicsV1") && !rawSampled) throw new Error("invalid sampled rigid swing model");
    if (rawSampled && input.swing.kinematicsV1) throw new Error("rigid swing cannot select two kinematic models");
    const sampled = rawSampled ? createReferenceBatKinematicsV1(rawSampled) : null;
    let pointSpeed;
    if (sampled && rawSampled) {
      const seed = sampled.sample(input.swing.startTick).state, actual = input.swing.stateAtStart;
      const sameVector2 = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
      if (rawSampled.ticksPerSecond !== input.swing.ticksPerSecond || !sameVector2(seed.pose.grip, actual.pose.grip) || !sameVector2(seed.pose.tip, actual.pose.tip) || !sameVector2(seed.linearVelocity, actual.linearVelocity) || !sameVector2(seed.angularVelocity, actual.angularVelocity))
        throw new Error("sampled rigid swing original clock or seed differs");
      createRigidBatStateFromBatterSwingState(input.swing.stateAtStart, input.swing.physical);
      const radius = Math.max(...input.swing.physical.radiusProfile.knots.map((k) => k.radiusM));
      pointSpeed = sampled.maximumGripSpeedMps + sampled.maximumAngularSpeedRadPerSecond * (sampled.batLengthM + radius);
      if (!Number.isFinite(pointSpeed)) throw new Error("sampled rigid swing point-speed bound overflow");
    }
    const closingSpeed = maximumClosingSpeed(input, pointSpeed);
    let tick8 = input.swing.startTick;
    let pitch = sampleAerodynamicPitchTrajectory(
      input.trajectory,
      tick8
    );
    while (tick8 <= input.swing.endTick) {
      const sampledSwing = sampled ? sampled.sample(tick8).state : sampleSwing(input.swing, tick8);
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
      if (tick8 === input.swing.endTick) {
        break;
      }
      const safeAdvanceTicks = separation > 0 && closingSpeed > EPSILON10 ? Math.floor(
        separation / closingSpeed * input.swing.ticksPerSecond
      ) - 1 : 1;
      const advanceTicks = Math.min(
        input.swing.endTick - tick8,
        Math.max(
          1,
          safeAdvanceTicks
        )
      );
      pitch = sampled ? sampleAerodynamicPitchTrajectory(input.trajectory, tick8 + advanceTicks) : advanceAerodynamicPitchState(pitch, advanceTicks, input.trajectory.parameters);
      tick8 += advanceTicks;
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
    const crossing2 = findAerodynamicPitchPlateCrossing(
      input.trajectory,
      input.plateZ
    );
    if (crossing2 === null) {
      return null;
    }
    const horizontalMin = input.strikeZone.centerX - input.strikeZone.halfWidth;
    const horizontalMax = input.strikeZone.centerX + input.strikeZone.halfWidth;
    const overlapsHorizontalZone = crossing2.position.x + input.ballRadiusMeters >= horizontalMin && crossing2.position.x - input.ballRadiusMeters <= horizontalMax;
    const overlapsVerticalZone = crossing2.position.y + input.ballRadiusMeters >= input.strikeZone.lowerY && crossing2.position.y - input.ballRadiusMeters <= input.strikeZone.upperY;
    return {
      kind: overlapsHorizontalZone && overlapsVerticalZone ? "called_strike" : "ball",
      crossing: crossing2,
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
      const physical4 = resolveAerodynamicTakenPitchPhysicalResult({
        trajectory: input.trajectory,
        plateZ: input.plateZ,
        strikeZone: input.strikeZone,
        ballRadiusMeters: input.ballRadiusMeters
      });
      if (physical4 === null) {
        return {
          kind: "unresolved",
          reason: "pitch_did_not_reach_plate",
          timeline
        };
      }
      return {
        kind: "recorded_take",
        physical: physical4,
        timeline: recordTakenPitchPhysicalResult(
          timeline,
          physical4
        )
      };
    }
    const physical3 = resolveAerodynamicRigidBatSwing({
      trajectory: input.trajectory,
      swing: input.action.swing,
      ball: input.ball,
      parameterResolver: input.parameterResolver
    });
    if (physical3.kind === "contact") {
      const canonicalContact = adaptRigidBatBallContactToCanonicalContact(
        physical3.contact
      );
      return {
        kind: "recorded_swing",
        physical: physical3,
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
      physical: physical3,
      timeline: recordSwingingPitchPhysicalResult(
        timeline,
        {
          kind: "swinging_miss",
          adjudicationTick: physical3.adjudicationTick
        }
      )
    };
  };

  // src/integration/browser/NativeAerodynamicSession.ts
  function isTick2(tick8) {
    return Number.isSafeInteger(tick8) && tick8 >= 0;
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
    let unresolved2 = false;
    let issuing = false;
    let nextMatchState = null;
    const phase = () => unresolved2 ? "unresolved" : observablePhase(timeline.status.kind);
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
      if (unresolved2 || timeline.status.kind !== "active") {
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
        unresolved2 = resolution.kind === "unresolved";
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
    if (spec.spinVectorRadPerSec !== void 0 && (![spec.spinVectorRadPerSec.x, spec.spinVectorRadPerSec.y, spec.spinVectorRadPerSec.z].every(Number.isFinite) || Math.hypot(
      spec.spinVectorRadPerSec.x,
      spec.spinVectorRadPerSec.y,
      spec.spinVectorRadPerSec.z
    ) > 5e3 * 2 * Math.PI / 60)) {
      throw new Error("Reference aerodynamic spin requires finite source angular velocity <= 5000rpm.");
    }
    if (spec.releaseOrientation !== void 0 && (![
      spec.releaseOrientation.w,
      spec.releaseOrientation.x,
      spec.releaseOrientation.y,
      spec.releaseOrientation.z
    ].every(Number.isFinite) || Math.hypot(
      spec.releaseOrientation.w,
      spec.releaseOrientation.x,
      spec.releaseOrientation.y,
      spec.releaseOrientation.z
    ) < 1e-10)) {
      throw new Error("Reference aerodynamic seam release orientation must be a valid quaternion.");
    }
    if (spec.sweetSpotBand !== void 0 && (!Number.isFinite(spec.sweetSpotBand.minimumT) || !Number.isFinite(spec.sweetSpotBand.maximumT) || spec.sweetSpotBand.minimumT <= 0 || spec.sweetSpotBand.maximumT >= 1 || spec.sweetSpotBand.minimumT > spec.sweetSpotBand.maximumT)) {
      throw new Error("Reference sweet-spot band must be ordered and inside the rigid bat");
    }
    if (spec.aimAtPlate !== void 0 && typeof spec.aimAtPlate !== "boolean") {
      throw new Error("Reference plate-aim option must be boolean");
    }
    const aerodynamicProfile = spec.aerodynamics ?? REFERENCE_BASEBALL_AERODYNAMICS;
    if (aerodynamicProfile.ballMassKg !== REALISTIC_BASEBALL_RIGID_BODY.massKg || aerodynamicProfile.ballRadiusM !== REALISTIC_BASEBALL_RIGID_BODY.radiusM) {
      throw new Error("Reference flight and rigid contact must use the same physical baseball");
    }
    calculateBaseballAerodynamics(
      { x: 0, y: 0, z: -spec.pitchSpeedMps },
      spec.spinVectorRadPerSec ?? { x: 15, y: 65, z: 0 },
      aerodynamicProfile
    );
    return (context2) => {
      const { pitcher, batter } = context2.commandSession.command;
      const startTick = Math.max(
        context2.lastEventTick + 1e5,
        (context2.previousFlightEndTick ?? 0) + 1e5
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
          spin: spec.spinVectorRadPerSec ?? { x: 15, y: 65, z: 0 }
        },
        ...spec.releaseOrientation !== void 0 ? { releaseOrientation: spec.releaseOrientation } : {},
        endTick: startTick + 7e5,
        parameters: {
          ticksPerSecond: 1e6,
          integrationStepTicks: 500,
          gravityY: -9.81,
          aerodynamics: aerodynamicProfile
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
        const crossing2 = spec.aimAtPlate ? findAerodynamicPitchPlateCrossing(trajectory, 0) : null;
        if (spec.aimAtPlate && !crossing2) throw new Error("Reference plate aim requires an actual course crossing");
        const midpoint = crossing2?.tick ?? startTick + 47e4;
        const intended = crossing2?.position ?? { x: 0.08, y: 0.95, z: 0 };
        const smoothSwing = createSwingKinematicsTrajectoryV1({
          startTick: midpoint - 75e3,
          contactTick: midpoint,
          endTick: midpoint + 65e3,
          ticksPerSecond: 1e6,
          batLengthM: 0.84,
          sweetSpotT: spec.sweetSpotBand === void 0 ? 0.5 : spec.sweetSpotBand.minimumT + (spec.sweetSpotBand.maximumT - spec.sweetSpotBand.minimumT) * new DeterministicRng(fnv1a32(`${context2.commandSession.matchSeed}:${context2.commandSession.playId}:${context2.ordinal}:sweet-spot`)).nextFloat(),
          start: {
            sweetSpotPosition: crossing2 ? { x: intended.x - 0.18, y: intended.y, z: intended.z + 0.45 } : { x: -0.1, y: 0.95, z: 0.45 },
            sweetSpotVelocity: { x: 0, y: 0, z: -1 },
            batAxis: { x: 1, y: 0, z: 0 }
          },
          contact: {
            sweetSpotPosition: intended,
            sweetSpotVelocity: { x: 8, y: 0, z: -2 },
            batAxis: { x: 1, y: 0, z: 0 }
          },
          finish: {
            sweetSpotPosition: crossing2 ? { x: intended.x + 0.37, y: intended.y + 0.05, z: intended.z - 0.3 } : { x: 0.45, y: 1, z: -0.3 },
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

  // src/core/sim/ball/BaseballGroundDynamics.ts
  var EPSILON11 = 1e-10;
  function validate2(ball, p) {
    if (!ball || !Number.isSafeInteger(ball.tick) || ball.tick < 0 || ![ball.position, ball.velocity, ball.spin].every((v2) => v2 && Object.values(v2).every(Number.isFinite))) {
      throw new Error("ground dynamics requires a finite physical ball and source clock");
    }
    if (!p || !p.material || !Number.isSafeInteger(p.ticksPerSecond) || p.ticksPerSecond <= 0 || ![p.radiusM, p.inertiaRatio, p.gravityMps2].every((v2) => Number.isFinite(v2) && v2 > 0) || ![
      p.restingVerticalSpeedMps,
      p.material.slidingFriction,
      p.material.rollingDecelerationMps2,
      p.material.normalSpinDecayPerSecond
    ].every((v2) => Number.isFinite(v2) && v2 >= 0) || !Number.isFinite(p.material.restitution) || p.material.restitution < 0 || p.material.restitution > 1) {
      throw new Error("invalid ground dynamics physical parameters");
    }
  }
  function slip(ball, radius) {
    return { x: ball.velocity.x + radius * ball.spin.z, z: ball.velocity.z - radius * ball.spin.x };
  }
  function resolveBaseballGroundImpact(ball, p) {
    validate2(ball, p);
    if (Math.abs(ball.position.y - p.radiusM) > EPSILON11 || ball.velocity.y > 0) {
      throw new Error("ground impact requires an actual incoming floor contact");
    }
    const normalImpulsePerMass = -(1 + p.material.restitution) * ball.velocity.y;
    const relative = slip(ball, p.radiusM), speed2 = Math.hypot(relative.x, relative.z);
    const impulse = Math.min(speed2 / (1 + 1 / p.inertiaRatio), p.material.slidingFriction * normalImpulsePerMass);
    const dx = speed2 <= EPSILON11 ? 0 : -relative.x / speed2 * impulse;
    const dz = speed2 <= EPSILON11 ? 0 : -relative.z / speed2 * impulse;
    const rebound = -p.material.restitution * ball.velocity.y;
    const result = {
      ...ball,
      position: { ...ball.position, y: p.radiusM },
      velocity: { x: ball.velocity.x + dx, y: rebound < p.restingVerticalSpeedMps ? 0 : rebound, z: ball.velocity.z + dz },
      spin: {
        x: ball.spin.x - dz / (p.inertiaRatio * p.radiusM),
        y: ball.spin.y,
        z: ball.spin.z + dx / (p.inertiaRatio * p.radiusM)
      }
    };
    validate2(result, p);
    return result;
  }
  function advanceBaseballGroundMotion(initial, deltaTicks, p) {
    validate2(initial, p);
    if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0 || !Number.isSafeInteger(initial.tick + deltaTicks)) {
      throw new Error("ground motion requires a bounded non-negative source-clock interval");
    }
    return advanceBaseballGroundMotionSeconds(initial, deltaTicks / p.ticksPerSecond, initial.tick + deltaTicks, p);
  }
  function sampleBaseballGroundMotionAtElapsedSeconds(initial, elapsedSeconds, p) {
    validate2(initial, p);
    const throughTick = quantizeEventTick(initial.tick, elapsedSeconds, p.ticksPerSecond);
    return advanceBaseballGroundMotionSeconds(initial, elapsedSeconds, throughTick, p);
  }
  function advanceBaseballGroundMotionSeconds(initial, duration, throughTick, p) {
    if (Math.abs(initial.position.y - p.radiusM) > EPSILON11 || initial.velocity.y !== 0) {
      throw new Error("ground motion requires a ball resting on the actual floor");
    }
    let remaining = duration, elapsed = 0;
    let x = initial.position.x, z = initial.position.z;
    let vx = initial.velocity.x, vz = initial.velocity.z;
    let wx = initial.spin.x, wz = initial.spin.z;
    const transitions = [];
    const relative = slip(initial, p.radiusM), slipSpeed = Math.hypot(relative.x, relative.z);
    const friction = p.material.slidingFriction * p.gravityMps2;
    let rolling = slipSpeed <= EPSILON11;
    if (!rolling) {
      const untilRolling = friction === 0 ? Infinity : slipSpeed / (friction * (1 + 1 / p.inertiaRatio));
      const dt = Math.min(remaining, untilRolling);
      const ax = -friction * relative.x / slipSpeed, az = -friction * relative.z / slipSpeed;
      x += vx * dt + 0.5 * ax * dt * dt;
      z += vz * dt + 0.5 * az * dt * dt;
      vx += ax * dt;
      vz += az * dt;
      wx -= az * dt / (p.inertiaRatio * p.radiusM);
      wz += ax * dt / (p.inertiaRatio * p.radiusM);
      remaining -= dt;
      elapsed += dt;
      if (dt === untilRolling) {
        rolling = true;
        transitions.push({ kind: "rolling_started", elapsedSeconds: elapsed });
      }
    }
    let phase = rolling ? "rolling" : "sliding";
    if (rolling) {
      const speed2 = Math.hypot(vx, vz), deceleration = p.material.rollingDecelerationMps2;
      const stopSeconds = speed2 === 0 ? 0 : deceleration === 0 ? Infinity : speed2 / deceleration;
      const dt = Math.min(remaining, stopSeconds);
      const distance6 = speed2 * dt - 0.5 * deceleration * dt * dt;
      if (speed2 > EPSILON11) {
        x += vx / speed2 * distance6;
        z += vz / speed2 * distance6;
        const nextSpeed = Math.max(0, speed2 - deceleration * dt);
        vx = vx / speed2 * nextSpeed;
        vz = vz / speed2 * nextSpeed;
      } else {
        vx = 0;
        vz = 0;
      }
      if (stopSeconds <= remaining) {
        vx = 0;
        vz = 0;
        phase = "resting";
        if (speed2 > EPSILON11) transitions.push({ kind: "rolling_stopped", elapsedSeconds: elapsed + stopSeconds });
      }
      wx = vz === 0 ? 0 : vz / p.radiusM;
      wz = vx === 0 ? 0 : -vx / p.radiusM;
    }
    const result = {
      tick: throughTick,
      position: { x, y: p.radiusM, z },
      velocity: { x: vx, y: 0, z: vz },
      spin: { x: wx, y: initial.spin.y * Math.exp(-p.material.normalSpinDecayPerSecond * duration), z: wz }
    };
    validate2(result, p);
    return { ball: result, phase, transitions };
  }

  // src/core/sim/ball/FreeBaseballTrajectory.ts
  var freeze = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  function createFreeBaseballTrajectory(raw) {
    const input = structuredClone(raw), { initialBall, throughTick, aerodynamics: aero, ground } = input;
    if (!initialBall || !aero || !ground || !Number.isSafeInteger(initialBall.tick) || initialBall.tick < 0 || !Number.isSafeInteger(throughTick) || throughTick < initialBall.tick || !Number.isSafeInteger(aero.ticksPerSecond) || aero.ticksPerSecond <= 0 || !Number.isSafeInteger(aero.integrationStepTicks) || aero.integrationStepTicks <= 0 || ![initialBall.position, initialBall.velocity, initialBall.spin].every((v2) => v2 && [v2.x, v2.y, v2.z].every(Number.isFinite)) || ground.ticksPerSecond !== aero.ticksPerSecond || ground.radiusM !== aero.aerodynamics.ballRadiusM || ground.gravityMps2 !== -aero.gravityY || (throughTick - initialBall.tick) / aero.ticksPerSecond > 120 || initialBall.position.y < ground.radiusM - 1e-10) {
      throw new Error("free baseball trajectory requires consistent original physical parameters and a bounded horizon");
    }
    advanceAerodynamicPitchState(initialBall, 0, aero);
    calculateBaseballAerodynamics(initialBall.velocity, initialBall.spin, aero.aerodynamics);
    advanceBaseballGroundMotion({
      ...initialBall,
      position: { ...initialBall.position, y: ground.radiusM },
      velocity: { ...initialBall.velocity, y: 0 }
    }, 0, ground);
    const samples = [], groundContacts = [];
    const grounded = (b) => Math.abs(b.position.y - ground.radiusM) <= 1e-10 && b.velocity.y === 0;
    const phaseAt = (b) => grounded(b) ? advanceBaseballGroundMotion(b, 0, ground).phase : "airborne";
    const oriented = (anchor, ball) => {
      const meanSpin = {
        x: (anchor.ball.spin.x + ball.spin.x) / 2,
        y: (anchor.ball.spin.y + ball.spin.y) / 2,
        z: (anchor.ball.spin.z + ball.spin.z) / 2
      };
      return { tick: ball.tick, ball, phase: phaseAt(ball), orientation: advanceBaseballOrientation(
        anchor.orientation,
        meanSpin,
        (ball.tick - anchor.tick) / aero.ticksPerSecond
      ) };
    };
    const advance = (anchor, tick8) => oriented(
      anchor,
      grounded(anchor.ball) ? advanceBaseballGroundMotion(anchor.ball, tick8 - anchor.tick, ground).ball : advanceAerodynamicPitchState(anchor.ball, tick8 - anchor.tick, aero)
    );
    let current = {
      tick: initialBall.tick,
      ball: initialBall,
      orientation: normalizeQuaternion(input.orientationAtStart ?? IDENTITY_QUATERNION),
      phase: phaseAt(initialBall)
    };
    if (initialBall.position.y <= ground.radiusM && initialBall.velocity.y < 0) {
      const incoming = { ...initialBall, position: { ...initialBall.position, y: ground.radiusM } };
      const outgoing = resolveBaseballGroundImpact(incoming, ground);
      groundContacts.push({ incoming, outgoing });
      current = { ...current, ball: outgoing, phase: phaseAt(outgoing) };
    }
    samples.push(current);
    while (current.tick < throughTick) {
      const lattice = initialBall.tick + (Math.floor((current.tick - initialBall.tick) / aero.integrationStepTicks) + 1) * aero.integrationStepTicks;
      let endTick = Math.min(lattice, throughTick);
      if (grounded(current.ball)) {
        const nextTransition = advanceBaseballGroundMotion(current.ball, endTick - current.tick, ground).transitions[0];
        if (nextTransition) {
          const boundaryTick = quantizeEventTick(current.tick, nextTransition.elapsedSeconds, aero.ticksPerSecond);
          if (boundaryTick > current.tick) endTick = Math.min(endTick, boundaryTick);
        }
      }
      const proposed = advance(current, endTick);
      let floorHorizon = endTick;
      if (!grounded(current.ball) && current.ball.velocity.y < 0 && proposed.ball.velocity.y >= 0) {
        const turnTick = findFirstTrueTick(current.tick, endTick, (tick8) => advance(current, tick8).ball.velocity.y >= 0);
        if (turnTick !== null) {
          const before = Math.max(current.tick, turnTick - 1);
          floorHorizon = advance(current, before).ball.position.y < advance(current, turnTick).ball.position.y ? before : turnTick;
        }
      }
      if (!grounded(current.ball) && advance(current, floorHorizon).ball.position.y <= ground.radiusM) {
        const first = current.ball.position.y <= ground.radiusM ? current.tick + 1 : current.tick;
        const contactTick = findFirstTrueTick(
          first,
          floorHorizon,
          (tick8) => advance(current, tick8).ball.position.y <= ground.radiusM
        );
        if (contactTick === null) throw new Error("free trajectory ground crossing has no physical contact");
        const atContact = advance(current, contactTick);
        const incoming = { ...atContact.ball, position: { ...atContact.ball.position, y: ground.radiusM } };
        const outgoing = resolveBaseballGroundImpact(incoming, ground);
        groundContacts.push({ incoming, outgoing });
        current = { ...atContact, ball: outgoing, phase: phaseAt(outgoing) };
      } else current = proposed;
      samples.push(current);
    }
    const frozenSamples = freeze(samples), frozenContacts = freeze(groundContacts);
    const observe = (ticks2) => {
      let previous = -1;
      return ticks2.map((tick8) => {
        if (!Number.isSafeInteger(tick8) || tick8 <= previous || tick8 < initialBall.tick || tick8 > throughTick) {
          throw new Error("free baseball observation requires strictly increasing available source ticks");
        }
        previous = tick8;
        let low = 0, high = frozenSamples.length - 1;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (frozenSamples[mid].tick <= tick8) low = mid;
          else high = mid - 1;
        }
        const anchor = frozenSamples[low];
        return anchor.tick === tick8 ? anchor : freeze(advance(anchor, tick8));
      });
    };
    return Object.freeze({ samples: frozenSamples, groundContacts: frozenContacts, observe });
  }

  // src/integration/browser/NativeFreeBallObservation.ts
  var vectorEqual = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
  function observeNativeFreeBallContinuation(input) {
    const { observation: observed } = input, contact = observed.rigidContact;
    const event = observed.events.find((e) => e.kind === "BatBallContact");
    const status = observed.result.timeline.status;
    const materialFrame = observed.spinFrames.at(-1);
    if (observed.authority !== "NATIVE_CORE_AERODYNAMIC_RIGID_PITCH" || observed.kind !== "recorded_swing" || !contact || !event || event.kind !== "BatBallContact" || status.kind !== "batted_ball_pending" || status.contactTick !== contact.tick || event.tick !== contact.tick || !materialFrame || materialFrame.tick !== contact.tick || input.aerodynamics.ticksPerSecond !== materialFrame.ticksPerSecond) {
      throw new Error("Native free-ball continuation requires original pending rigid-impact and material observations");
    }
    const canonical3 = adaptRigidBatBallContactToCanonicalContact(contact), accepted = event.payload.contact;
    if (canonical3.tick !== accepted.tick || canonical3.segmentT !== accepted.segmentT || !["ballCenter", "point", "batPoint", "normal", "exitVelocity", "exitSpin"].every((key3) => vectorEqual(canonical3[key3], accepted[key3]))) {
      throw new Error("Native free-ball continuation impact differs from the accepted canonical event");
    }
    if (input.orientationAtContact && !["w", "x", "y", "z"].every((key3) => input.orientationAtContact[key3] === materialFrame.orientationMaterialToWorld[key3])) {
      throw new Error("Native free-ball continuation cannot replace the original impact orientation");
    }
    const trajectory = createFreeBaseballTrajectory({
      initialBall: { tick: contact.tick, position: contact.ballCenter, velocity: contact.exitVelocity, spin: contact.exitSpin },
      throughTick: input.throughTick,
      aerodynamics: input.aerodynamics,
      ground: input.ground,
      orientationAtStart: materialFrame.orientationMaterialToWorld
    });
    const ticks2 = input.sampleTicks ? [...input.sampleTicks] : [];
    if (!input.sampleTicks) {
      const cadence = Math.max(1, Math.round(0.0275 * input.aerodynamics.ticksPerSecond));
      for (let tick8 = contact.tick; tick8 <= input.throughTick; tick8 += cadence) ticks2.push(tick8);
      ticks2.push(input.throughTick, ...trajectory.groundContacts.map((c) => c.outgoing.tick));
    }
    const sampleTicks = input.sampleTicks ? ticks2 : [...new Set(ticks2)].sort((a, b) => a - b);
    return Object.freeze({
      authority: "NATIVE_CORE_FREE_BALL_CONTINUATION",
      samples: trajectory.observe(sampleTicks),
      groundContacts: trajectory.groundContacts,
      orientationProvenance: materialFrame.orientationProvenance,
      requiresOfficialLiveBallResolution: true,
      officialResult: null
    });
  }

  // src/core/sim/ball/VersionedBattedBallPhysics.ts
  var fields2 = (value, required, optional = []) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return required.every((key3) => keys.includes(key3)) && keys.every((key3) => required.includes(key3) || optional.includes(key3));
  };
  var freeze2 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze2);
      Object.freeze(value);
    }
    return value;
  };
  var createAeroGroundBallPhysicsProfile = (raw) => {
    const p = cloneInert(raw);
    const air = p?.air, aero = air?.aerodynamics, ground = p?.ground, coefficients = aero?.coefficientProfile;
    if (!fields2(p, ["kind", "air", "ground"]) || p.kind !== "aero_ground_v1" || !fields2(air, ["ticksPerSecond", "integrationStepTicks", "gravityY", "aerodynamics"]) || !fields2(
      aero,
      ["ballMassKg", "ballRadiusM", "airDensityKgM3", "windVelocityMps", "dragCoefficient"],
      ["coefficientProfile", "airKinematicViscosityM2PerSecond", "spinDecay"]
    ) || !fields2(aero.windVelocityMps, ["x", "y", "z"]) || "airKinematicViscosityM2PerSecond" in aero && (typeof aero.airKinematicViscosityM2PerSecond !== "number" || !Number.isFinite(aero.airKinematicViscosityM2PerSecond) || aero.airKinematicViscosityM2PerSecond <= 0) || !fields2(ground, ["radiusM", "inertiaRatio", "gravityMps2", "ticksPerSecond", "restingVerticalSpeedMps", "material"]) || !fields2(ground.material, ["restitution", "slidingFriction", "rollingDecelerationMps2", "normalSpinDecayPerSecond"]) || "spinDecay" in aero && !fields2(aero.spinDecay, ["referenceSpeedMps", "timeConstantSecondsAtReferenceSpeed"]) || "coefficientProfile" in aero && (!fields2(coefficients, [
      "profileId",
      "version",
      "referenceReynoldsNumber",
      "spinKnots",
      "reynoldsKnots",
      "reynoldsCorrectionFullThroughSpinFactor",
      "reynoldsCorrectionZeroAtSpinFactor"
    ]) || !Array.isArray(coefficients?.spinKnots) || !Array.isArray(coefficients?.reynoldsKnots) || typeof coefficients?.profileId !== "string" || !coefficients.profileId.length || typeof coefficients.version !== "string" || !coefficients.version.length || !coefficients.spinKnots.every((k) => fields2(k, ["spinFactor", "dragCoefficientAtReferenceRe", "liftCoefficient"])) || !coefficients.reynoldsKnots.every((k) => fields2(k, ["reynoldsNumber", "dragCorrectionFactorAtLowSpin"])))) {
      throw new Error("invalid versioned Aero/ground ball physics profile");
    }
    const ball = {
      tick: 0,
      position: { x: 0, y: ground.radiusM, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      spin: { x: 0, y: 0, z: 0 }
    };
    createFreeBaseballTrajectory({ initialBall: ball, throughTick: 0, aerodynamics: air, ground });
    return freeze2(p);
  };

  // src/core/sim/ball/SourceFreeBallSpeedBound.ts
  var maximumSlope = (knots) => Math.max(
    0,
    ...knots.slice(1).map((k, i) => Math.abs((k.y - knots[i].y) / (k.x - knots[i].x)))
  );
  var sourceRk4PositionBounds = (ball, seconds, parameters) => {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error("invalid nonlinear Source cell duration");
    const p = parameters.aerodynamics, r = p.ballRadiusM, wind = Math.hypot(p.windVelocityMps.x, p.windVelocityMps.y, p.windVelocityMps.z);
    const v0 = Math.hypot(ball.velocity.x - p.windVelocityMps.x, ball.velocity.y - p.windVelocityMps.y, ball.velocity.z - p.windVelocityMps.z);
    const w0 = Math.hypot(ball.spin.x, ball.spin.y, ball.spin.z), g = Math.abs(parameters.gravityY);
    const c = 0.5 * p.airDensityKgM3 * Math.PI * r * r / p.ballMassKg;
    const coefficient = p.coefficientProfile;
    let cd = p.dragCoefficient, cl = 0, cdSpinSlope = 0, cdVelocitySlope = 0, clSpinSlope = 0;
    if (coefficient) {
      if (coefficient.spinKnots[0].liftCoefficient !== 0) throw new Error("nonlinear Source lift must be continuous at zero spin");
      const baseCd = Math.max(...coefficient.spinKnots.map((k) => k.dragCoefficientAtReferenceRe));
      const correction = Math.max(1, ...coefficient.reynoldsKnots.map((k) => k.dragCorrectionFactorAtLowSpin));
      const deviation = Math.max(...coefficient.reynoldsKnots.map((k) => Math.abs(k.dragCorrectionFactorAtLowSpin - 1)));
      cd = baseCd * correction;
      cl = Math.max(...coefficient.spinKnots.map((k) => k.liftCoefficient));
      cdSpinSlope = correction * maximumSlope(coefficient.spinKnots.map((k) => ({ x: k.spinFactor, y: k.dragCoefficientAtReferenceRe }))) + baseCd * deviation / (coefficient.reynoldsCorrectionZeroAtSpinFactor - coefficient.reynoldsCorrectionFullThroughSpinFactor);
      cdVelocitySlope = baseCd * maximumSlope(coefficient.reynoldsKnots.map((k) => ({ x: k.reynoldsNumber, y: k.dragCorrectionFactorAtLowSpin }))) * 2 * r / p.airKinematicViscosityM2PerSecond;
      clSpinSlope = maximumSlope(coefficient.spinKnots.map((k) => ({ x: k.spinFactor, y: k.liftCoefficient })));
    }
    const acceleration = (v5, w) => g + c * (coefficient ? (cd + cl) * v5 * v5 : (cd + 0.09) * v5 * v5 + 1.5 * r * w * v5);
    const velocityGradient = (v5, w) => c * (coefficient ? 2 * (cd + cl) * v5 + (3 * cdSpinSlope + 4 * clSpinSlope) * r * w + cdVelocitySlope * v5 * v5 : (2 * cd + 0.18) * v5 + 1.5 * r * w);
    const spinGradient = (v5) => c * r * v5 * (coefficient ? cdSpinSlope + 2 * clSpinSlope : 1.5);
    const decayScale = p.spinDecay ? 1 / (p.spinDecay.referenceSpeedMps * p.spinDecay.timeConstantSecondsAtReferenceSpeed) : 0;
    const a0 = acceleration(v0, w0), s0 = v0 * w0 * decayScale;
    const v2 = v0 + seconds * a0 / 2, w2 = w0 + seconds * s0 / 2, dv2 = a0 / 2, dw2 = s0 / 2;
    const a2 = acceleration(v2, w2), da2 = velocityGradient(v2, w2) * dv2 + spinGradient(v2) * dw2;
    const s2 = v2 * w2 * decayScale, ds2 = (w2 * dv2 + v2 * dw2) * decayScale;
    const v3 = v0 + seconds * a2 / 2, w3 = w0 + seconds * s2 / 2;
    const dv3 = a2 / 2 + seconds * da2 / 2, dw3 = s2 / 2 + seconds * ds2 / 2;
    const a3 = acceleration(v3, w3), da3 = velocityGradient(v3, w3) * dv3 + spinGradient(v3) * dw3;
    const v4 = v0 + seconds * a3, dv4 = a3 + seconds * da3;
    const bound = wind + (v0 + 2 * v2 + 2 * v3 + v4) / 6 + seconds * (2 * dv2 + 2 * dv3 + dv4) / 6;
    if (!Number.isFinite(bound) || bound < 0) throw new Error("nonlinear Source derivative bound overflows");
    const linearDeviationMps2 = (a0 + a2 + a3) / 6 * (1 + 128 * Number.EPSILON);
    if (!Number.isFinite(linearDeviationMps2)) throw new Error("nonlinear Source position deviation bound overflows");
    const w4 = w0 + seconds * v3 * w3 * decayScale;
    const maximumAccelerationMps2 = Math.max(a0, a2, a3, acceleration(v4, w4)) * (1 + 128 * Number.EPSILON);
    if (!Number.isFinite(maximumAccelerationMps2)) throw new Error("nonlinear Source acceleration bound overflows");
    return { maximumSpeedMps: bound * (1 + 128 * Number.EPSILON), linearDeviationMps2, maximumAccelerationMps2 };
  };
  var boundSourceRk4PositionSpeed = (ball, seconds, parameters) => sourceRk4PositionBounds(ball, seconds, parameters).maximumSpeedMps;

  // src/core/sim/ball/SourceFreeBallKernel.ts
  var fields3 = (value, names2) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...names2].sort().join("|");
  var freeze3 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze3);
      Object.freeze(value);
    }
    return value;
  };
  var createSourceFreeBallKernel = (raw) => {
    const descriptor = cloneInert(raw), initial = descriptor?.initial, ball = initial?.ball;
    if (!fields3(descriptor, ["kind", "initial", "throughElapsedSeconds", "profile"]) || descriptor.kind !== "aero_ground_continuous_source_kernel_v2" || !fields3(initial, ["originTick", "elapsedSeconds", "ball"]) || !fields3(ball, ["tick", "position", "velocity", "spin"]) || ![ball.position, ball.velocity, ball.spin].every((v2) => fields3(v2, ["x", "y", "z"]) && Object.values(v2).every(Number.isFinite)) || !Number.isFinite(descriptor.throughElapsedSeconds) || descriptor.throughElapsedSeconds < initial.elapsedSeconds || descriptor.throughElapsedSeconds - initial.elapsedSeconds > 120) throw new Error("invalid nonlinear free ball Source descriptor");
    const profile = createAeroGroundBallPhysicsProfile(descriptor.profile), p = profile.air.ticksPerSecond;
    if (ball.tick !== quantizeEventTick(initial.originTick, initial.elapsedSeconds, p) || ball.position.y < profile.ground.radiusM - 1e-10) throw new Error("free ball Source descriptor physical clock or floor differs");
    const boundaryToleranceSeconds = 1e-12;
    const samples = [], boundaries = [];
    const groundIncoming = /* @__PURE__ */ new Map();
    const groundPositionCorrections = /* @__PURE__ */ new Map();
    const phaseAt = (moment) => Math.abs(moment.ball.position.y - profile.ground.radiusM) <= 1e-10 && moment.ball.velocity.y === 0 ? sampleBaseballGroundMotionAtElapsedSeconds(moment.ball, 0, profile.ground).phase : "airborne";
    const advance = (anchor, elapsedSeconds) => {
      const seconds = elapsedSeconds - anchor.moment.elapsedSeconds;
      const ground = anchor.phase === "airborne" ? null : sampleBaseballGroundMotionAtElapsedSeconds(anchor.moment.ball, seconds, profile.ground);
      const b = ground?.ball ?? sampleAerodynamicPitchStateAtElapsedSeconds(anchor.moment.ball, seconds, profile.air);
      const moment = {
        originTick: initial.originTick,
        elapsedSeconds,
        ball: { ...b, tick: quantizeEventTick(initial.originTick, elapsedSeconds, p) }
      };
      const a = anchor.moment.ball.spin, meanSpin = { x: (a.x + b.spin.x) / 2, y: (a.y + b.spin.y) / 2, z: (a.z + b.spin.z) / 2 };
      return { moment, phase: ground?.phase ?? "airborne", orientation: advanceBaseballOrientation(anchor.orientation, meanSpin, seconds) };
    };
    const firstTrue = (lower, upper, predicate) => {
      if (!predicate(upper)) throw new Error("continuous physical boundary is not bracketed");
      let lo = lower, hi = upper;
      for (let i = 0; i < 96 && hi - lo > boundaryToleranceSeconds; i++) {
        const middle = (lo + hi) / 2;
        if (middle === lo || middle === hi) break;
        if (predicate(middle)) hi = middle;
        else lo = middle;
      }
      return hi;
    };
    const impact = (incoming) => {
      const moment = incoming.moment, b = { ...moment.ball, position: { ...moment.ball.position, y: profile.ground.radiusM } };
      const at2 = { ...incoming, moment: { ...moment, ball: b } };
      groundIncoming.set(moment.elapsedSeconds, at2);
      groundPositionCorrections.set(moment.elapsedSeconds, Math.abs(moment.ball.position.y - profile.ground.radiusM));
      boundaries.push({ kind: "ground", elapsedSeconds: moment.elapsedSeconds });
      const outgoing = { ...moment, ball: resolveBaseballGroundImpact(b, profile.ground) };
      return { moment: outgoing, phase: phaseAt(outgoing), orientation: incoming.orientation };
    };
    let current = { moment: initial, phase: phaseAt(initial), orientation: IDENTITY_QUATERNION };
    if (ball.position.y <= profile.ground.radiusM && ball.velocity.y <= 0) current = impact(current);
    samples.push(current);
    const stepSeconds = profile.air.integrationStepTicks / p;
    let cellIndex = 1;
    while (current.moment.elapsedSeconds < descriptor.throughElapsedSeconds) {
      if (samples.length > 25e4) throw new Error("continuous Source trajectory exceeds bounded integration work");
      const cellEnd = initial.elapsedSeconds + cellIndex * stepSeconds;
      const requestedEnd = Math.min(cellEnd, descriptor.throughElapsedSeconds);
      let end = cellEnd;
      if (requestedEnd <= current.moment.elapsedSeconds) throw new Error("continuous Source lattice loses physical time resolution");
      if (current.phase !== "airborne") {
        const motion = sampleBaseballGroundMotionAtElapsedSeconds(current.moment.ball, end - current.moment.elapsedSeconds, profile.ground);
        const transition = motion.transitions[0];
        if (transition && transition.elapsedSeconds > 0) {
          const time = current.moment.elapsedSeconds + transition.elapsedSeconds;
          if (time <= end) {
            end = time;
            if (time <= descriptor.throughElapsedSeconds) boundaries.push({
              kind: transition.kind === "rolling_stopped" ? "rolling_stop" : "rolling_started",
              elapsedSeconds: time
            });
          }
        }
      }
      const proposed = advance(current, end);
      let floorHorizon = end;
      if (current.phase === "airborne" && current.moment.ball.velocity.y < 0 && proposed.moment.ball.velocity.y >= 0) {
        floorHorizon = firstTrue(current.moment.elapsedSeconds, end, (time) => advance(current, time).moment.ball.velocity.y >= 0);
      }
      if (current.phase === "airborne" && advance(current, floorHorizon).moment.ball.position.y <= profile.ground.radiusM) {
        const time = firstTrue(
          current.moment.elapsedSeconds,
          floorHorizon,
          (at2) => advance(current, at2).moment.ball.position.y <= profile.ground.radiusM
        );
        if (time <= current.moment.elapsedSeconds) throw new Error("continuous ground boundary cannot advance source time");
        current = time <= descriptor.throughElapsedSeconds ? impact(advance(current, time)) : advance(current, requestedEnd);
      } else current = end <= descriptor.throughElapsedSeconds ? proposed : advance(current, requestedEnd);
      samples.push(current);
      if (current.moment.elapsedSeconds === cellEnd) cellIndex++;
    }
    freeze3(samples);
    freeze3(boundaries);
    const norm8 = (v2) => Math.hypot(v2.x, v2.y, v2.z);
    const cells = freeze3(samples.slice(0, -1).map((anchor, index) => {
      const next = samples[index + 1], duration = next.moment.elapsedSeconds - anchor.moment.elapsedSeconds;
      const maximumPositionSpeedMps = anchor.phase === "airborne" ? boundSourceRk4PositionSpeed(anchor.moment.ball, duration, profile.air) : Math.max(norm8(anchor.moment.ball.velocity), norm8(next.moment.ball.velocity));
      const positionRoundingBoundMeters = (groundPositionCorrections.get(next.moment.elapsedSeconds) ?? 0) + (anchor.phase === "airborne" ? 0 : Math.abs(anchor.moment.ball.position.y - profile.ground.radiusM)) + 64 * Number.EPSILON * Math.max(1, norm8(anchor.moment.ball.position), norm8(next.moment.ball.position));
      if (![maximumPositionSpeedMps, positionRoundingBoundMeters].every(Number.isFinite)) throw new Error("nonlinear Source cell bound overflows");
      return {
        fromElapsedSeconds: anchor.moment.elapsedSeconds,
        throughElapsedSeconds: next.moment.elapsedSeconds,
        maximumPositionSpeedMps,
        positionRoundingBoundMeters
      };
    }));
    const evaluateAt = (elapsedSeconds, side = "outgoing") => {
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < initial.elapsedSeconds || elapsedSeconds > descriptor.throughElapsedSeconds || !["incoming", "outgoing"].includes(side)) {
        throw new Error("nonlinear free ball Source evaluation exceeds its physical horizon");
      }
      if (side === "incoming" && groundIncoming.has(elapsedSeconds)) return freeze3(groundIncoming.get(elapsedSeconds));
      let low = 0, high = samples.length - 1;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (samples[middle].moment.elapsedSeconds <= elapsedSeconds) low = middle;
        else high = middle - 1;
      }
      const anchor = samples[low];
      return anchor.moment.elapsedSeconds === elapsedSeconds ? anchor : freeze3(advance(anchor, elapsedSeconds));
    };
    return Object.freeze({ descriptor: freeze3(descriptor), boundaries, cells, evaluateAt });
  };
  var createContinuousBattedBallFlightEvidence = (contact, searchDurationTicks, profile) => {
    if (!Number.isSafeInteger(searchDurationTicks) || searchDurationTicks < 0) throw new Error("invalid continuous batted flight horizon");
    const original = cloneInert(contact), initialBall = createBattedBallInitialStateFromContact(original);
    const kernel = createSourceFreeBallKernel({
      kind: "aero_ground_continuous_source_kernel_v2",
      initial: { originTick: initialBall.tick, elapsedSeconds: 0, ball: initialBall },
      throughElapsedSeconds: searchDurationTicks / profile.air.ticksPerSecond,
      profile
    });
    const first = kernel.boundaries.find((b) => b.kind === "ground");
    const incoming = first ? kernel.evaluateAt(first.elapsedSeconds, "incoming").moment.ball : null;
    return freeze3({
      contact: original,
      initialBall,
      ballRadiusMeters: profile.ground.radiusM,
      firstGroundContact: incoming ? { tick: incoming.tick, state: incoming } : null
    });
  };

  // src/core/sim/ball/SourceBallMaterialHistoryV1.ts
  var declaration = Object.freeze({
    phaseAuthority: "DECLARED_INITIAL_PHASE",
    native: false,
    nativeAdmission: false,
    official: null
  });
  function assert(condition, reason) {
    if (!condition) throw new Error("Source ball material history: " + reason);
  }
  var fields4 = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
  var freeze4 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze4);
      Object.freeze(value);
    }
    return value;
  };
  var canonical = (value) => {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key3) => JSON.stringify(key3) + ":" + canonical(value[key3])).join(",") + "}";
    const encoded = JSON.stringify(value);
    assert(encoded !== void 0, "invalid original profile value");
    return encoded;
  };
  var material = (relative, basis2) => normalizeQuaternion(multiplyQuaternions(relative, basis2));
  var createSourceBallMaterialHistoryV1 = (raw) => {
    const source = cloneInert(raw);
    assert(fields4(source, ["initialMaterialOrientation", "spans"]) && fields4(source.initialMaterialOrientation, ["w", "x", "y", "z"]) && Object.values(source.initialMaterialOrientation).every(Number.isFinite) && Array.isArray(source.spans) && source.spans.length > 0 && source.spans.length <= 256, "invalid declared phase or free spans");
    const initialMaterialOrientation = freeze4(normalizeQuaternion(source.initialMaterialOrientation));
    let carried = initialMaterialOrientation, totalCells = 0;
    const endpoints = [];
    const compiled = source.spans.map((span, index) => {
      assert(fields4(span, ["descriptor", "throughElapsedSeconds", "side"]) && ["incoming", "outgoing"].includes(span.side) && Number.isFinite(span.throughElapsedSeconds), "invalid free span");
      const kernel = createSourceFreeBallKernel(span.descriptor), from = kernel.descriptor.initial;
      assert(
        span.throughElapsedSeconds >= from.elapsedSeconds && span.throughElapsedSeconds <= kernel.descriptor.throughElapsedSeconds,
        "backwards span or span outside its original horizon"
      );
      totalCells += kernel.cells.length;
      assert(totalCells <= 25e4, "history exceeds bounded original kernel work");
      const preceding = index ? source.spans[index - 1] : null;
      if (preceding) {
        const prior = endpoints[index - 1];
        assert(from.originTick === source.spans[0].descriptor.initial.originTick, "original root clock changed");
        assert(from.elapsedSeconds === preceding.throughElapsedSeconds, "gap or overlap between free spans");
        assert(canonical(kernel.descriptor.profile) === canonical(source.spans[0].descriptor.profile), "original physics profile changed");
        assert(
          ["x", "y", "z"].every((axis) => from.ball.position[axis] === prior.moment.ball.position[axis]),
          "impulse position is discontinuous"
        );
      }
      const basis2 = carried, endpoint = kernel.evaluateAt(span.throughElapsedSeconds, span.side);
      carried = freeze4(material(endpoint.orientation, basis2));
      endpoints.push(endpoint);
      return { kernel, basis: basis2 };
    });
    const fromElapsedSeconds = source.spans[0].descriptor.initial.elapsedSeconds;
    const throughElapsedSeconds = source.spans.at(-1).throughElapsedSeconds;
    const evaluateAt = (elapsedSeconds, side = "outgoing") => {
      assert(Number.isFinite(elapsedSeconds) && elapsedSeconds >= fromElapsedSeconds && elapsedSeconds <= throughElapsedSeconds && ["incoming", "outgoing"].includes(side), "observation exceeds original free history");
      let spanIndex = -1;
      if (side === "incoming") spanIndex = source.spans.findIndex((span2) => span2.throughElapsedSeconds === elapsedSeconds);
      if (spanIndex < 0) {
        for (let index = 0; index < source.spans.length; index++) {
          const span2 = source.spans[index];
          if (span2.descriptor.initial.elapsedSeconds <= elapsedSeconds && elapsedSeconds <= span2.throughElapsedSeconds) spanIndex = index;
        }
      }
      assert(spanIndex >= 0, "observation has no original free span");
      const span = source.spans[spanIndex], { kernel, basis: basis2 } = compiled[spanIndex];
      const ending = side === "incoming" && spanIndex < source.spans.length - 1 && span.throughElapsedSeconds === elapsedSeconds;
      const sample3 = kernel.evaluateAt(elapsedSeconds, ending ? span.side : side);
      return freeze4({
        ...declaration,
        moment: sample3.moment,
        phase: sample3.phase,
        relativeOrientation: sample3.orientation,
        orientation: material(sample3.orientation, basis2),
        spanIndex
      });
    };
    return freeze4({ ...declaration, initialMaterialOrientation, spans: source.spans, fromElapsedSeconds, throughElapsedSeconds, evaluateAt });
  };

  // src/core/sim/ball/BallContactResponse.ts
  var finiteVector2 = (v2) => v2 && [v2.x, v2.y, v2.z].every(Number.isFinite);
  var subtract9 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  var add9 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  var scale10 = (v2, s) => ({ x: v2.x * s, y: v2.y * s, z: v2.z * s });
  var respondToBallContact = (input) => {
    const { ball, surfaceVelocity, normal: normal4, material: material2 } = input;
    if (!ball || !Number.isSafeInteger(ball.tick) || ball.tick < 0 || !finiteVector2(ball.position) || !finiteVector2(ball.velocity) || !finiteVector2(ball.spin) || !finiteVector2(surfaceVelocity) || !finiteVector2(normal4) || !material2 || ![material2.restitution, material2.tangentialDamping, material2.spinDamping].every((v2) => Number.isFinite(v2) && v2 >= 0 && v2 <= 1)) throw new Error("invalid ball contact response");
    const lengthSquared = normal4.x * normal4.x + normal4.y * normal4.y + normal4.z * normal4.z;
    if (!Number.isFinite(lengthSquared) || lengthSquared <= 0) throw new Error("contactNormal must have a finite non-zero length");
    const n = scale10(normal4, 1 / Math.sqrt(lengthSquared)), relative = subtract9(ball.velocity, surfaceVelocity);
    const normalSpeed = relative.x * n.x + relative.y * n.y + relative.z * n.z;
    const normalVelocity = scale10(n, normalSpeed), tangent = subtract9(relative, normalVelocity);
    const postNormal = normalSpeed < 0 ? scale10(n, -material2.restitution * normalSpeed) : normalVelocity;
    const velocity = add9(surfaceVelocity, add9(postNormal, scale10(tangent, 1 - material2.tangentialDamping)));
    const spin = scale10(ball.spin, 1 - material2.spinDamping);
    if (!finiteVector2(velocity) || !finiteVector2(spin)) throw new Error("ball contact response arithmetic overflow");
    return { ...ball, velocity, spin };
  };

  // src/core/sim/fielding/CatchOutcome.ts
  var createSecuredCatchOutcome = (gloveContactTick, secureTick) => ({
    kind: "secured",
    gloveContactTick,
    secureTick
  });
  var createLiveBallCatchOutcome = (gloveContactTick, ball) => {
    if (ball.tick < gloveContactTick) {
      throw new Error("live ball tick must be at or after glove contact");
    }
    return {
      kind: "live-ball",
      gloveContactTick,
      ball
    };
  };

  // src/core/sim/fielding/CatchRetention.ts
  var isFiniteNumber = (value) => Number.isFinite(value);
  var isFiniteVec3 = (value) => isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.z);
  var magnitudeSquared = (value) => value.x * value.x + value.y * value.y + value.z * value.z;
  var subtract10 = (first, second) => ({
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z
  });
  var validateUnitInterval = (value, name) => {
    if (!isFiniteNumber(value) || value < 0 || value > 1) {
      throw new Error(`${name} must be a finite number in [0, 1]`);
    }
  };
  var validateParameters4 = (parameters) => {
    if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
      throw new Error("ticksPerSecond must be a positive integer");
    }
    const positiveParameters = [
      [parameters.ballMassKg, "ballMassKg"],
      [parameters.ballRadiusMeters, "ballRadiusMeters"],
      [parameters.pocketRadiusMeters, "pocketRadiusMeters"],
      [parameters.centerRetentionCapacityJ, "centerRetentionCapacityJ"],
      [parameters.captureDissipationPowerW, "captureDissipationPowerW"]
    ];
    for (const [value, name] of positiveParameters) {
      if (!isFiniteNumber(value) || value <= 0) {
        throw new Error(`${name} must be a finite positive number`);
      }
    }
    validateUnitInterval(parameters.failedContactRestitution, "failedContactRestitution");
    validateUnitInterval(parameters.failedTangentialDamping, "failedTangentialDamping");
    validateUnitInterval(parameters.failedSpinDamping, "failedSpinDamping");
  };
  var validateContact = (contact) => {
    if (!Number.isSafeInteger(contact.contactTick) || contact.contactTick < 0) {
      throw new Error("contactTick must be a non-negative safe integer tick");
    }
    if (contact.ball.tick !== contact.contactTick || contact.glove.tick !== contact.contactTick) {
      throw new Error("ball and glove states must be sampled at contactTick");
    }
    if (!isFiniteVec3(contact.ball.position) || !isFiniteVec3(contact.ball.velocity) || !isFiniteVec3(contact.ball.spin) || !isFiniteVec3(contact.glove.position) || !isFiniteVec3(contact.glove.velocity) || !isFiniteVec3(contact.contactNormal)) {
      throw new Error("catch retention vectors must contain finite components");
    }
    if (!isFiniteNumber(contact.pocketOffsetMeters) || contact.pocketOffsetMeters < 0) {
      throw new Error("pocketOffsetMeters must be a finite non-negative number");
    }
    validateUnitInterval(contact.bodyStability, "bodyStability");
  };
  var evaluateCatchRetentionLoad = (contact, parameters) => {
    validateContact(contact);
    validateParameters4(parameters);
    const relativeVelocity = subtract10(contact.ball.velocity, contact.glove.velocity);
    const translationalEnergyJ = 0.5 * parameters.ballMassKg * magnitudeSquared(relativeVelocity);
    const sphereInertia = 2 / 5 * parameters.ballMassKg * parameters.ballRadiusMeters * parameters.ballRadiusMeters;
    const rotationalEnergyJ = 0.5 * sphereInertia * magnitudeSquared(contact.ball.spin);
    const retentionLoadJ = translationalEnergyJ + rotationalEnergyJ;
    const normalizedOffset = contact.pocketOffsetMeters / parameters.pocketRadiusMeters;
    const pocketFactor = normalizedOffset >= 1 ? 0 : Math.sqrt(Math.max(0, 1 - normalizedOffset * normalizedOffset));
    const effectiveCapacityJ = parameters.centerRetentionCapacityJ * contact.bodyStability * pocketFactor;
    return {
      relativeVelocity,
      translationalEnergyJ,
      rotationalEnergyJ,
      retentionLoadJ,
      pocketFactor,
      effectiveCapacityJ
    };
  };
  var resolveCatchRetention = (contact, parameters) => {
    const diagnostics = evaluateCatchRetentionLoad(contact, parameters);
    if (diagnostics.retentionLoadJ <= diagnostics.effectiveCapacityJ) {
      const settleSeconds = diagnostics.retentionLoadJ / parameters.captureDissipationPowerW;
      const secureTick = quantizeEventTick(
        contact.contactTick,
        settleSeconds,
        parameters.ticksPerSecond
      );
      return {
        outcome: createSecuredCatchOutcome(contact.contactTick, secureTick),
        diagnostics
      };
    }
    const liveBall = respondToBallContact({
      ball: contact.ball,
      surfaceVelocity: contact.glove.velocity,
      normal: contact.contactNormal,
      material: {
        restitution: parameters.failedContactRestitution,
        tangentialDamping: parameters.failedTangentialDamping,
        spinDamping: parameters.failedSpinDamping
      }
    });
    return {
      outcome: createLiveBallCatchOutcome(contact.contactTick, liveBall),
      diagnostics
    };
  };

  // src/core/sim/ball/BallFlight.ts
  var DEFAULT_BALL_FLIGHT_PARAMETERS = Object.freeze({
    ticksPerSecond: 1e6,
    gravityY: -9.81,
    ballRadius: 0.0366,
    groundRestitution: 0.35,
    groundFriction: 0.78,
    groundRollingDecelerationMps2: 4,
    integrationStepTicks: 2e3,
    restingVerticalSpeed: 0.5
  });
  var GROUND_EPSILON = 1e-12;
  var validateParameters5 = (parameters) => {
    if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
      throw new Error("ticksPerSecond must be a positive integer");
    }
    if (!Number.isInteger(parameters.integrationStepTicks) || parameters.integrationStepTicks <= 0) {
      throw new Error("integrationStepTicks must be a positive integer");
    }
    if (parameters.ballRadius <= 0) {
      throw new Error("ballRadius must be positive");
    }
    if (parameters.groundRestitution < 0 || parameters.groundRestitution > 1) {
      throw new Error("groundRestitution must be within [0, 1]");
    }
    if (parameters.groundFriction < 0 || parameters.groundFriction > 1) {
      throw new Error("groundFriction must be within [0, 1]");
    }
    const rollingDeceleration = parameters.groundRollingDecelerationMps2 ?? DEFAULT_BALL_FLIGHT_PARAMETERS.groundRollingDecelerationMps2 ?? 0;
    if (!Number.isFinite(rollingDeceleration) || rollingDeceleration < 0) {
      throw new Error(
        "groundRollingDecelerationMps2 must be finite and non-negative"
      );
    }
    if (parameters.restingVerticalSpeed < 0) {
      throw new Error("restingVerticalSpeed must be non-negative");
    }
  };
  var advanceFreeFlight = (state, stepTicks, parameters) => {
    const dt = stepTicks / parameters.ticksPerSecond;
    return {
      tick: state.tick + stepTicks,
      position: {
        x: state.position.x + state.velocity.x * dt,
        y: state.position.y + state.velocity.y * dt + 0.5 * parameters.gravityY * dt * dt,
        z: state.position.z + state.velocity.z * dt
      },
      velocity: {
        x: state.velocity.x,
        y: state.velocity.y + parameters.gravityY * dt,
        z: state.velocity.z
      },
      spin: state.spin
    };
  };
  var findGroundContactTick = (state, deltaTicks, parameters = DEFAULT_BALL_FLIGHT_PARAMETERS) => {
    validateParameters5(parameters);
    if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
      throw new Error("deltaTicks must be a non-negative integer");
    }
    const atGround = state.position.y <= parameters.ballRadius + GROUND_EPSILON;
    if (state.position.y < parameters.ballRadius - GROUND_EPSILON) {
      return state.tick;
    }
    if (atGround && state.velocity.y < 0) {
      return state.tick;
    }
    if (atGround && state.velocity.y === 0) {
      return null;
    }
    if (deltaTicks === 0) {
      return null;
    }
    return findFirstTrueTick(state.tick, state.tick + deltaTicks, (tick8) => {
      if (tick8 === state.tick) {
        return false;
      }
      const dt = (tick8 - state.tick) / parameters.ticksPerSecond;
      const y = state.position.y + state.velocity.y * dt + 0.5 * parameters.gravityY * dt * dt;
      return y <= parameters.ballRadius;
    });
  };
  var getGroundRollingDeceleration = (parameters) => parameters.groundRollingDecelerationMps2 ?? DEFAULT_BALL_FLIGHT_PARAMETERS.groundRollingDecelerationMps2 ?? 0;
  var isOnGround = (state, parameters) => state.position.y <= parameters.ballRadius + GROUND_EPSILON && Math.abs(state.velocity.y) <= GROUND_EPSILON;
  var advanceGroundRoll = (state, stepTicks, parameters) => {
    const speed2 = Math.hypot(
      state.velocity.x,
      state.velocity.z
    );
    if (speed2 <= GROUND_EPSILON) {
      return {
        ...state,
        tick: state.tick + stepTicks,
        position: {
          ...state.position,
          y: parameters.ballRadius
        },
        velocity: {
          x: 0,
          y: 0,
          z: 0
        }
      };
    }
    const deceleration = getGroundRollingDeceleration(parameters);
    const durationSeconds = stepTicks / parameters.ticksPerSecond;
    if (deceleration <= GROUND_EPSILON) {
      return {
        tick: state.tick + stepTicks,
        position: {
          x: state.position.x + state.velocity.x * durationSeconds,
          y: parameters.ballRadius,
          z: state.position.z + state.velocity.z * durationSeconds
        },
        velocity: {
          x: state.velocity.x,
          y: 0,
          z: state.velocity.z
        },
        spin: state.spin
      };
    }
    const directionX = state.velocity.x / speed2;
    const directionZ = state.velocity.z / speed2;
    const stopSeconds = speed2 / deceleration;
    const travelSeconds = Math.min(
      durationSeconds,
      stopSeconds
    );
    const distance6 = speed2 * travelSeconds - 0.5 * deceleration * travelSeconds * travelSeconds;
    const remainingSpeed = Math.max(
      0,
      speed2 - deceleration * durationSeconds
    );
    return {
      tick: state.tick + stepTicks,
      position: {
        x: state.position.x + directionX * distance6,
        y: parameters.ballRadius,
        z: state.position.z + directionZ * distance6
      },
      velocity: remainingSpeed <= GROUND_EPSILON ? {
        x: 0,
        y: 0,
        z: 0
      } : {
        x: directionX * remainingSpeed,
        y: 0,
        z: directionZ * remainingSpeed
      },
      spin: state.spin
    };
  };
  var groundContactState = (state, parameters) => {
    let velocity = state.velocity;
    if (velocity.y < 0) {
      const reflectedY = -velocity.y * parameters.groundRestitution;
      velocity = {
        x: velocity.x * parameters.groundFriction,
        y: reflectedY < parameters.restingVerticalSpeed ? 0 : reflectedY,
        z: velocity.z * parameters.groundFriction
      };
    }
    return { tick: state.tick, position: { x: state.position.x, y: parameters.ballRadius, z: state.position.z }, velocity, spin: state.spin };
  };
  var respondToGroundContact = (state, parameters) => {
    validateParameters5(parameters);
    if (!Number.isSafeInteger(state.tick) || state.tick < 0 || ![state.position, state.velocity, state.spin].every((v2) => v2 && [v2.x, v2.y, v2.z].every(Number.isFinite))) throw new Error("invalid ground contact state");
    return groundContactState(state, parameters);
  };
  var advanceStep = (state, stepTicks, parameters) => {
    let current = state;
    let remaining = stepTicks;
    while (remaining > 0) {
      if (isOnGround(current, parameters)) {
        return advanceGroundRoll(
          current,
          remaining,
          parameters
        );
      }
      const contactTick = findGroundContactTick(current, remaining, parameters);
      if (contactTick === null) {
        return advanceFreeFlight(current, remaining, parameters);
      }
      const ticksToContact = contactTick - current.tick;
      const freeAtContact = ticksToContact === 0 ? current : advanceFreeFlight(current, ticksToContact, parameters);
      current = groundContactState(freeAtContact, parameters);
      remaining -= ticksToContact;
    }
    return current;
  };
  var advanceBallState = (state, deltaTicks, parameters = DEFAULT_BALL_FLIGHT_PARAMETERS) => {
    validateParameters5(parameters);
    if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
      throw new Error("deltaTicks must be a non-negative integer");
    }
    let current = state;
    let remaining = deltaTicks;
    while (remaining > 0) {
      const stepTicks = Math.min(parameters.integrationStepTicks, remaining);
      current = advanceStep(current, stepTicks, parameters);
      remaining -= stepTicks;
    }
    return current;
  };

  // src/core/sim/collision/MovingSphereContact.ts
  var EPSILON12 = 1e-12;
  var subtract11 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var dot7 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var validateState = (state, name) => {
    if (!Number.isSafeInteger(state.tick) || state.tick < 0) {
      throw new Error(`${name}.tick must be a non-negative safe integer tick`);
    }
    if (!Number.isFinite(state.radius) || state.radius <= 0) {
      throw new Error(`${name}.radius must be a finite positive number`);
    }
  };
  var findMovingSphereContactTime = (first, second, deltaTicks, parameters) => {
    validateState(first, "first");
    validateState(second, "second");
    if (!Number.isInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
      throw new Error("ticksPerSecond must be a positive integer");
    }
    if (first.tick !== second.tick) {
      throw new Error("moving contact states must use the same start tick");
    }
    if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
      throw new Error("deltaTicks must be a non-negative integer");
    }
    if (!Number.isSafeInteger(first.tick + deltaTicks)) {
      throw new Error("contact search end tick must be a safe integer");
    }
    const relativePosition = subtract11(first.center, second.center);
    const relativeVelocity = subtract11(first.velocity, second.velocity);
    const contactRadius = first.radius + second.radius;
    const c = dot7(relativePosition, relativePosition) - contactRadius * contactRadius;
    if (c <= 0) {
      return { tick: first.tick, elapsedSeconds: 0 };
    }
    if (deltaTicks === 0) {
      return null;
    }
    const a = dot7(relativeVelocity, relativeVelocity);
    if (a <= EPSILON12) {
      return null;
    }
    const b = 2 * dot7(relativePosition, relativeVelocity);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      return null;
    }
    const sqrtDiscriminant = Math.sqrt(discriminant);
    const entrySeconds = (-b - sqrtDiscriminant) / (2 * a);
    const exitSeconds = (-b + sqrtDiscriminant) / (2 * a);
    const durationSeconds = deltaTicks / parameters.ticksPerSecond;
    if (exitSeconds < 0 || entrySeconds > durationSeconds) {
      return null;
    }
    const elapsedSeconds = Math.max(0, entrySeconds);
    const contactTick = quantizeEventTick(
      first.tick,
      elapsedSeconds,
      parameters.ticksPerSecond
    );
    return contactTick - first.tick <= deltaTicks ? { tick: contactTick, elapsedSeconds } : null;
  };

  // src/core/sim/collision/AcceleratedSphereContact.ts
  var COEFFICIENT_EPSILON = 1e-12;
  var ROOT_BISECTION_ITERATIONS = 80;
  var subtract12 = (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  });
  var dot8 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var magnitudeSquared2 = (value) => dot8(value, value);
  var validateVec34 = (name, value) => {
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
      throw new Error(`${name} must contain finite coordinates`);
    }
  };
  var validateState2 = (state, name) => {
    if (!Number.isSafeInteger(state.tick) || state.tick < 0) {
      throw new Error(`${name}.tick must be a non-negative safe integer tick`);
    }
    validateVec34(`${name}.center`, state.center);
    validateVec34(`${name}.velocity`, state.velocity);
    validateVec34(`${name}.acceleration`, state.acceleration);
    if (!Number.isFinite(state.radius) || state.radius <= 0) {
      throw new Error(`${name}.radius must be a finite positive number`);
    }
  };
  var uniqueSorted = (values2) => {
    const sorted = [...values2].sort((a, b) => a - b);
    const result = [];
    for (const value of sorted) {
      const previous = result[result.length - 1];
      if (previous === void 0 || Math.abs(value - previous) > 1e-10 * Math.max(1, Math.abs(value))) {
        result.push(value);
      }
    }
    return result;
  };
  var solveLinearRoots = (a, b) => {
    if (Math.abs(a) <= COEFFICIENT_EPSILON) {
      return [];
    }
    return [-b / a];
  };
  var solveQuadraticRoots = (a, b, c) => {
    if (Math.abs(a) <= COEFFICIENT_EPSILON) {
      return solveLinearRoots(b, c);
    }
    const discriminant = b * b - 4 * a * c;
    const tolerance = COEFFICIENT_EPSILON * Math.max(
      1,
      Math.abs(b * b),
      Math.abs(4 * a * c)
    );
    if (discriminant < -tolerance) {
      return [];
    }
    if (Math.abs(discriminant) <= tolerance) {
      return [-b / (2 * a)];
    }
    const sqrtDiscriminant = Math.sqrt(discriminant);
    const q = -0.5 * (b + Math.sign(b || 1) * sqrtDiscriminant);
    const first = q / a;
    const second = c / q;
    return uniqueSorted([first, second]);
  };
  var bisectSignChange = (evaluate, start, end) => {
    let low = start;
    let high = end;
    let lowValue = evaluate(low);
    for (let iteration = 0; iteration < ROOT_BISECTION_ITERATIONS; iteration += 1) {
      const middle = (low + high) / 2;
      const middleValue = evaluate(middle);
      if (middleValue === 0) {
        return middle;
      }
      if (lowValue < 0 && middleValue > 0 || lowValue > 0 && middleValue < 0) {
        high = middle;
      } else {
        low = middle;
        lowValue = middleValue;
      }
    }
    return (low + high) / 2;
  };
  var findCubicRootsInInterval = (a, b, c, d, start, end) => {
    if (Math.abs(a) <= COEFFICIENT_EPSILON) {
      return solveQuadraticRoots(b, c, d).filter((root) => root >= start && root <= end);
    }
    const evaluate = (time) => ((a * time + b) * time + c) * time + d;
    const criticalPoints = solveQuadraticRoots(3 * a, 2 * b, c).filter((root) => root > start && root < end);
    const boundaries = uniqueSorted([start, ...criticalPoints, end]);
    const roots3 = [];
    for (const boundary of boundaries) {
      const value = evaluate(boundary);
      const tolerance = COEFFICIENT_EPSILON * Math.max(
        1,
        Math.abs(a * boundary * boundary * boundary),
        Math.abs(b * boundary * boundary),
        Math.abs(c * boundary),
        Math.abs(d)
      );
      if (Math.abs(value) <= tolerance) {
        roots3.push(boundary);
      }
    }
    for (let index = 0; index + 1 < boundaries.length; index += 1) {
      const left = boundaries[index];
      const right = boundaries[index + 1];
      const leftValue = evaluate(left);
      const rightValue = evaluate(right);
      if (leftValue < 0 && rightValue > 0 || leftValue > 0 && rightValue < 0) {
        roots3.push(bisectSignChange(evaluate, left, right));
      }
    }
    return uniqueSorted(
      roots3.filter((root) => root >= start && root <= end)
    );
  };
  var bisectFirstNonPositive = (evaluate, start, end) => {
    let low = start;
    let high = end;
    for (let iteration = 0; iteration < ROOT_BISECTION_ITERATIONS; iteration += 1) {
      const middle = (low + high) / 2;
      if (evaluate(middle) <= 0) {
        high = middle;
      } else {
        low = middle;
      }
    }
    return high;
  };
  var findAcceleratedSphereContactTime = (first, second, deltaTicks, parameters) => {
    validateState2(first, "first");
    validateState2(second, "second");
    if (!Number.isSafeInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
      throw new Error("ticksPerSecond must be a positive safe integer");
    }
    if (first.tick !== second.tick) {
      throw new Error("accelerated contact states must use the same start tick");
    }
    if (!Number.isSafeInteger(deltaTicks) || deltaTicks < 0) {
      throw new Error("deltaTicks must be a non-negative safe integer");
    }
    if (!Number.isSafeInteger(first.tick + deltaTicks)) {
      throw new Error("contact search end tick must be a safe integer");
    }
    const relativePosition = subtract12(first.center, second.center);
    const relativeVelocity = subtract12(first.velocity, second.velocity);
    const relativeAcceleration = subtract12(
      first.acceleration,
      second.acceleration
    );
    const contactRadius = first.radius + second.radius;
    const initialSeparationValue = magnitudeSquared2(relativePosition) - contactRadius * contactRadius;
    if (initialSeparationValue <= 0) {
      return { tick: first.tick, elapsedSeconds: 0 };
    }
    if (deltaTicks === 0) {
      return null;
    }
    if (magnitudeSquared2(relativeAcceleration) <= COEFFICIENT_EPSILON ** 2) {
      return findMovingSphereContactTime(
        {
          tick: first.tick,
          center: first.center,
          velocity: first.velocity,
          radius: first.radius
        },
        {
          tick: second.tick,
          center: second.center,
          velocity: second.velocity,
          radius: second.radius
        },
        deltaTicks,
        parameters
      );
    }
    const c0 = initialSeparationValue;
    const c1 = 2 * dot8(relativePosition, relativeVelocity);
    const c2 = dot8(relativeVelocity, relativeVelocity) + dot8(relativePosition, relativeAcceleration);
    const c3 = dot8(relativeVelocity, relativeAcceleration);
    const c4 = 0.25 * dot8(relativeAcceleration, relativeAcceleration);
    const evaluateSeparation = (time) => (((c4 * time + c3) * time + c2) * time + c1) * time + c0;
    const durationSeconds = deltaTicks / parameters.ticksPerSecond;
    const stationaryTimes = findCubicRootsInInterval(
      4 * c4,
      3 * c3,
      2 * c2,
      c1,
      0,
      durationSeconds
    ).filter((time) => time > 0 && time < durationSeconds);
    const boundaries = uniqueSorted([
      0,
      ...stationaryTimes,
      durationSeconds
    ]);
    const errorScale = 8 * Number.EPSILON;
    const squaredTerms = [
      relativePosition.x * relativePosition.x,
      relativePosition.y * relativePosition.y,
      relativePosition.z * relativePosition.z,
      contactRadius * contactRadius
    ];
    if (squaredTerms.some((value) => !Number.isFinite(value))) {
      throw new Error("accelerated contact squared geometry overflow");
    }
    const scaledErrorBound = squaredTerms.reduce(
      (sum, value) => sum + value * errorScale,
      0
    );
    if (!Number.isFinite(scaledErrorBound)) {
      throw new Error("accelerated contact error bound overflow");
    }
    const valueTolerance = Math.max(
      COEFFICIENT_EPSILON,
      scaledErrorBound
    );
    let contactSeconds = null;
    for (let index = 0; index < boundaries.length; index += 1) {
      const boundary = boundaries[index];
      const boundaryValue = evaluateSeparation(boundary);
      if (boundary > 0 && boundaryValue <= valueTolerance) {
        if (boundaryValue <= 0 && index > 0) {
          const previous = boundaries[index - 1];
          const previousValue = evaluateSeparation(previous);
          contactSeconds = previousValue > 0 ? bisectFirstNonPositive(
            evaluateSeparation,
            previous,
            boundary
          ) : previous;
        } else {
          contactSeconds = boundary;
        }
        break;
      }
      if (index + 1 >= boundaries.length) {
        continue;
      }
      const next = boundaries[index + 1];
      const nextValue = evaluateSeparation(next);
      if (boundaryValue > 0 && nextValue < -valueTolerance) {
        contactSeconds = bisectFirstNonPositive(
          evaluateSeparation,
          boundary,
          next
        );
        break;
      }
    }
    if (contactSeconds === null) {
      return null;
    }
    const contactTick = quantizeEventTick(
      first.tick,
      contactSeconds,
      parameters.ticksPerSecond
    );
    return contactTick - first.tick <= deltaTicks ? { tick: contactTick, elapsedSeconds: contactSeconds } : null;
  };
  var findAcceleratedSphereContactTick = (first, second, deltaTicks, parameters) => findAcceleratedSphereContactTime(first, second, deltaTicks, parameters)?.tick ?? null;
  var continuousPolynomialValue = (coefficients, time) => coefficients.reduceRight((value, coefficient) => value * time + coefficient, 0);
  var continuousPolynomialIsZero = (coefficients, time) => {
    const magnitude13 = coefficients.reduceRight((value, coefficient) => value * Math.abs(time) + Math.abs(coefficient), 0);
    return Math.abs(continuousPolynomialValue(coefficients, time)) <= 8 * Number.EPSILON * magnitude13;
  };
  var continuousBisect = (evaluate, start, end, firstNonPositive) => {
    let low = start, high = end, lowValue = evaluate(low);
    while (true) {
      const middle = low + (high - low) / 2;
      if (middle === low || middle === high) return firstNonPositive ? high : middle;
      const value = evaluate(middle);
      if (!firstNonPositive && value === 0) return middle;
      if (firstNonPositive ? value <= 0 : lowValue < 0 && value > 0 || lowValue > 0 && value < 0) high = middle;
      else {
        low = middle;
        lowValue = value;
      }
    }
  };
  var continuousPolynomialRoots = (input, start, end) => {
    const coefficients = [...input];
    while (coefficients.length > 1 && coefficients[coefficients.length - 1] === 0) coefficients.pop();
    if (coefficients.length < 2) return [];
    if (coefficients.length === 2) {
      const root = -coefficients[0] / coefficients[1];
      return root >= start && root <= end ? [root] : [];
    }
    const derivative = coefficients.slice(1).map((value, index) => value * (index + 1));
    const critical = continuousPolynomialRoots(derivative, start, end).filter((time) => time > start && time < end);
    const boundaries = [.../* @__PURE__ */ new Set([start, ...critical, end])].sort((a, b) => a - b);
    const roots3 = boundaries.filter((time) => continuousPolynomialIsZero(coefficients, time));
    const evaluate = (time) => continuousPolynomialValue(coefficients, time);
    for (let index = 0; index + 1 < boundaries.length; index++) {
      const left = boundaries[index], right = boundaries[index + 1];
      const a = evaluate(left), b = evaluate(right);
      if (a < 0 && b > 0 || a > 0 && b < 0) roots3.push(continuousBisect(evaluate, left, right, false));
    }
    return [...new Set(roots3)].sort((a, b) => a - b);
  };
  var continuousSpherePolynomial = (first, second, durationSeconds) => {
    validateState2(first, "first");
    validateState2(second, "second");
    if (first.tick !== second.tick || !Number.isFinite(durationSeconds) || durationSeconds < 0) throw new Error("invalid continuous sphere contact interval");
    const position = subtract12(first.center, second.center), velocity = subtract12(first.velocity, second.velocity);
    const acceleration = subtract12(first.acceleration, second.acceleration), radius = first.radius + second.radius;
    const c0 = magnitudeSquared2(position) - radius * radius;
    const c1 = 2 * dot8(position, velocity);
    const c2 = magnitudeSquared2(velocity) + dot8(position, acceleration);
    const c3 = dot8(velocity, acceleration), c4 = 0.25 * magnitudeSquared2(acceleration);
    if (![radius, c0, c1, c2, c3, c4].every(Number.isFinite)) throw new Error("continuous sphere geometry arithmetic overflow");
    const scaled = [
      c0,
      c1 * durationSeconds,
      c2 * durationSeconds * durationSeconds,
      c3 * durationSeconds * durationSeconds * durationSeconds,
      c4 * durationSeconds * durationSeconds * durationSeconds * durationSeconds
    ];
    if (!scaled.every(Number.isFinite)) throw new Error("continuous sphere horizon arithmetic overflow");
    const scale12 = Math.max(...scaled.map(Math.abs)) || 1;
    const [a0, a1, a2, a3, a4] = scaled.map((value) => value / scale12);
    const evaluate = (t) => (((a4 * t + a3) * t + a2) * t + a1) * t + a0;
    const tangentSeparation = (t) => {
      const seconds = t * durationSeconds;
      const coordinates = ["x", "y", "z"].map((axis) => {
        const coordinate = position[axis] + velocity[axis] * seconds + 0.5 * acceleration[axis] * seconds * seconds;
        return coordinate * coordinate;
      }).sort((a, b) => b - a);
      const value = coordinates[0] - radius * radius + coordinates[1] + coordinates[2];
      if (!Number.isFinite(value)) throw new Error("continuous sphere sample arithmetic overflow");
      const roundoff = [radius * radius, ...coordinates].reduce((sum, term) => sum + 8 * Number.EPSILON * term, 0);
      return { value, roundoff };
    };
    const derivativeCoefficients = [a1, 2 * a2, 3 * a3, 4 * a4];
    const stationaryAt = (t) => continuousPolynomialIsZero(derivativeCoefficients, t);
    const curvature = (t) => (12 * a4 * t + 6 * a3) * t + 2 * a2;
    const stationary = continuousPolynomialRoots(derivativeCoefficients, 0, 1).filter((time) => time > 0 && time < 1);
    const boundaries = [.../* @__PURE__ */ new Set([0, ...stationary, 1])].sort((a, b) => a - b);
    return { c0, a1, a2, a3, a4, evaluate, tangentSeparation, stationaryAt, curvature, boundaries };
  };
  var findAcceleratedSphereContactSeconds = (first, second, durationSeconds, initialContact) => {
    if (!["include", "after_departure"].includes(initialContact)) throw new Error("invalid continuous sphere contact policy");
    const { c0, evaluate, tangentSeparation, stationaryAt, curvature, boundaries } = continuousSpherePolynomial(first, second, durationSeconds);
    if (initialContact === "include" && c0 <= 0) return 0;
    if (durationSeconds === 0) return null;
    let departed = c0 > 0;
    for (let index = 0; index + 1 < boundaries.length; index += 1) {
      const left = boundaries[index], right = boundaries[index + 1];
      const leftValue = evaluate(left), rightValue = evaluate(right);
      if (leftValue > 0) departed = true;
      if (departed && stationaryAt(right) && curvature(right) > 0) {
        const separation = tangentSeparation(right);
        if (separation.value >= 0 && separation.value <= separation.roundoff) return right * durationSeconds;
      }
      if (departed && leftValue > 0 && rightValue <= 0) {
        return continuousBisect(evaluate, left, right, true) * durationSeconds;
      }
      if (rightValue > 0) departed = true;
    }
    return null;
  };
  var findAcceleratedSphereBlockedDepartureSeconds = (first, second, durationSeconds) => {
    const p = continuousSpherePolynomial(first, second, durationSeconds);
    if (p.c0 > 0 || durationSeconds === 0) return null;
    const firstMotion = [p.a1, p.a2, p.a3, p.a4].find((v2) => v2 !== 0);
    if (firstMotion === void 0) return null;
    if (firstMotion < 0) return 0;
    for (let index = 1; index < p.boundaries.length; index++) {
      const time = p.boundaries[index], value = p.evaluate(time);
      if (value > 0) return null;
      if (p.curvature(time) < 0 && p.stationaryAt(time)) return time * durationSeconds;
    }
    return null;
  };
  var piecewiseSpherePolynomial = (first, second, duration) => {
    validateState2(first, "first");
    validateState2(second, "second");
    if (first.tick !== second.tick || !Number.isFinite(duration) || duration < 0) throw new Error("invalid piecewise sphere interval");
    const position = subtract12(first.center, second.center), velocity = subtract12(first.velocity, second.velocity);
    const acceleration = subtract12(first.acceleration, second.acceleration), radius = first.radius + second.radius;
    const coefficients = [
      magnitudeSquared2(position) - radius * radius,
      2 * dot8(position, velocity),
      magnitudeSquared2(velocity) + dot8(position, acceleration),
      dot8(velocity, acceleration),
      0.25 * magnitudeSquared2(acceleration)
    ];
    if (![radius, ...coefficients].every(Number.isFinite)) throw new Error("piecewise sphere geometry arithmetic overflow");
    const tangentSeparation = (seconds) => {
      const squares = ["x", "y", "z"].map((axis) => {
        const coordinate = position[axis] + velocity[axis] * seconds + 0.5 * acceleration[axis] * seconds * seconds;
        return coordinate * coordinate;
      }).sort((a, b) => b - a);
      const value = squares[0] - radius * radius + squares[1] + squares[2];
      const roundoff = [radius * radius, ...squares].reduce((sum, term) => sum + 8 * Number.EPSILON * term, 0);
      if (![value, roundoff].every(Number.isFinite)) throw new Error("piecewise sphere sample arithmetic overflow");
      return { value, roundoff };
    };
    return { coefficients, tangentSeparation };
  };
  var scaleBinary = (value, exponent) => {
    const original = value, originalExponent = exponent;
    while (exponent > 512) {
      value *= 2 ** 512;
      exponent -= 512;
    }
    while (exponent < -512) {
      value *= 2 ** -512;
      exponent += 512;
    }
    value *= 2 ** exponent;
    if (!Number.isFinite(value) || original !== 0 && value === 0) throw new Error("unsupported piecewise polynomial coefficient precision");
    let restored = value;
    exponent = -originalExponent;
    while (exponent > 512) {
      restored *= 2 ** 512;
      exponent -= 512;
    }
    while (exponent < -512) {
      restored *= 2 ** -512;
      exponent += 512;
    }
    restored *= 2 ** exponent;
    if (restored !== original) throw new Error("unsupported piecewise polynomial coefficient precision");
    return value;
  };
  var piecewiseDyadic = (value) => {
    if (value === 0) return { significand: 0n, exponent: 0 };
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    const high = view.getUint32(0), low = view.getUint32(4), exponent = high >>> 20 & 2047;
    const fraction = BigInt(high & 1048575) << 32n | BigInt(low);
    const significand = (exponent === 0 ? fraction : 1n << 52n | fraction) * (high >>> 31 ? -1n : 1n);
    return { significand, exponent: exponent === 0 ? -1074 : exponent - 1075 };
  };
  var piecewisePolynomialEvaluator = (coefficients) => {
    let exact = null;
    return (time) => {
      const value = continuousPolynomialValue(coefficients, time);
      const magnitude13 = coefficients.reduceRight((sum, coefficient) => sum * Math.abs(time) + Math.abs(coefficient), 0);
      if (Math.abs(value) > 8 * Number.EPSILON * magnitude13) return value;
      exact ??= coefficients.map(piecewiseDyadic);
      const at2 = piecewiseDyadic(time);
      let result = { significand: 0n, exponent: 0 };
      for (let i = exact.length - 1; i >= 0; i--) {
        const product = { significand: result.significand * at2.significand, exponent: result.exponent + at2.exponent }, term = exact[i];
        if (product.significand === 0n) result = term;
        else if (term.significand === 0n) result = product;
        else {
          const exponent = Math.min(product.exponent, term.exponent);
          result = { significand: (product.significand << BigInt(product.exponent - exponent)) + (term.significand << BigInt(term.exponent - exponent)), exponent };
        }
      }
      return result.significand < 0n ? -1 : result.significand > 0n ? 1 : 0;
    };
  };
  function* piecewisePolynomialIntervals(coefficients, duration) {
    const first = coefficients.findIndex((value) => value !== 0);
    const last = coefficients.map((value) => value !== 0).lastIndexOf(true);
    if (first < 0 || first === last || duration === 0) return;
    let characteristicLog = Infinity;
    for (let i = first + 1; i <= last; i++) if (coefficients[i] !== 0) {
      characteristicLog = Math.min(characteristicLog, (Math.log2(Math.abs(coefficients[first])) - Math.log2(Math.abs(coefficients[i]))) / (i - first));
    }
    let exponent = Math.floor(characteristicLog - Math.log2(last - first + 1)) - 1;
    if (exponent > Math.log2(duration)) return;
    if (exponent < -1074 || exponent > 1023) throw new Error("unsupported piecewise polynomial time precision");
    let initial = true;
    while (true) {
      const scale12 = 2 ** exponent;
      const normalization = Math.floor(Math.max(...coefficients.map((value, i) => value === 0 ? -Infinity : Math.log2(Math.abs(value)) + i * exponent)));
      const normalized2 = coefficients.map((value, i) => scaleBinary(value, i * exponent - normalization));
      const derivative = normalized2.slice(1).map((value, i) => value * (i + 1));
      const start = initial ? 0 : 0.5;
      const stationary = continuousPolynomialRoots(derivative, start, 1).filter((time) => time > start && time < 1);
      const boundaries = [.../* @__PURE__ */ new Set([start, ...stationary, 1])].sort((a, b) => a - b);
      yield {
        scale: scale12,
        boundaries,
        evaluate: piecewisePolynomialEvaluator(normalized2),
        stationaryAt: (time) => continuousPolynomialIsZero(derivative, time),
        curvature: (time) => (12 * normalized2[4] * time + 6 * normalized2[3]) * time + 2 * normalized2[2]
      };
      if (scale12 >= duration) return;
      exponent++;
      initial = false;
      if (exponent > 1023) throw new Error("piecewise polynomial interval overflow");
    }
  }
  var findPiecewiseAcceleratedSphereContactSeconds = (first, second, duration, initialContact) => {
    if (!["include", "after_departure"].includes(initialContact)) throw new Error("invalid piecewise sphere contact policy");
    const p = piecewiseSpherePolynomial(first, second, duration), c0 = p.coefficients[0];
    if (initialContact === "include" && c0 <= 0) return 0;
    if (p.coefficients.every((value) => value >= 0) || p.coefficients.every((value) => value <= 0)) return null;
    let departed = c0 > 0;
    for (const interval of piecewisePolynomialIntervals(p.coefficients, duration)) {
      const { boundaries, scale: scale12, evaluate } = interval;
      for (let i = 0; i + 1 < boundaries.length; i++) {
        const left = boundaries[i], right = boundaries[i + 1], rightSeconds = right * scale12;
        const leftValue = evaluate(left), rightValue = evaluate(right);
        if (leftValue > 0) departed = true;
        if (departed && rightSeconds <= duration && interval.stationaryAt(right) && interval.curvature(right) > 0) {
          const separation = p.tangentSeparation(rightSeconds);
          if (separation.value >= 0 && separation.value <= separation.roundoff) return rightSeconds;
        }
        if (departed && leftValue > 0 && rightValue <= 0) {
          const candidate = continuousBisect(evaluate, left, right, true) * scale12;
          return candidate <= duration ? candidate : null;
        }
        if (rightSeconds >= duration) return null;
        if (rightValue > 0) departed = true;
      }
    }
    return null;
  };
  var findPiecewiseAcceleratedSphereBlockedDepartureSeconds = (first, second, duration) => {
    const p = piecewiseSpherePolynomial(first, second, duration);
    if (p.coefficients[0] > 0 || duration === 0) return null;
    const firstMotion = p.coefficients.slice(1).find((value) => value !== 0);
    if (firstMotion === void 0) return null;
    if (firstMotion < 0) return 0;
    for (const interval of piecewisePolynomialIntervals(p.coefficients, duration)) {
      for (const time of interval.boundaries.slice(1)) {
        const seconds = time * interval.scale;
        if (seconds > duration) return null;
        if (interval.evaluate(time) > 0) return null;
        if (interval.curvature(time) < 0 && interval.stationaryAt(time)) return seconds;
      }
    }
    return null;
  };

  // src/core/sim/fielding/DefenderPhysicalPrimitive.ts
  var EPSILON13 = 1e-12;
  var clean = (value) => Math.abs(value) <= EPSILON13 ? 0 : value;
  var validateTick4 = (name, value) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative safe integer tick`);
    }
  };
  var sampleDefenderPhysicalPrimitiveSegment = (segment, tick8) => {
    validateTick4("tick", tick8);
    if (tick8 < segment.startTick || tick8 > segment.endTick) {
      throw new Error("tick must be inside the defender physical primitive segment");
    }
    if (!Number.isSafeInteger(segment.ticksPerSecond) || segment.ticksPerSecond <= 0) {
      throw new Error("segment.ticksPerSecond must be a positive safe integer");
    }
    const dt = (tick8 - segment.startTick) / segment.ticksPerSecond;
    const halfDt2 = 0.5 * dt * dt;
    return {
      tick: tick8,
      center: {
        x: clean(segment.startCenter.x + segment.startVelocity.x * dt + segment.acceleration.x * halfDt2),
        y: clean(segment.startCenter.y + segment.startVelocity.y * dt + segment.acceleration.y * halfDt2),
        z: clean(segment.startCenter.z + segment.startVelocity.z * dt + segment.acceleration.z * halfDt2)
      },
      velocity: {
        x: clean(segment.startVelocity.x + segment.acceleration.x * dt),
        y: clean(segment.startVelocity.y + segment.acceleration.y * dt),
        z: clean(segment.startVelocity.z + segment.acceleration.z * dt)
      },
      acceleration: segment.acceleration,
      radius: segment.radius,
      role: segment.role
    };
  };

  // src/core/sim/ball/BattedBallFlightEvidence.ts
  var createBattedBallFlightEvidence = (input) => {
    if (!Number.isInteger(input.searchDurationTicks) || input.searchDurationTicks < 0) {
      throw new Error(
        "searchDurationTicks must be a non-negative integer"
      );
    }
    const initialBall = createBattedBallInitialStateFromContact(input.contact);
    const firstGroundContactTick = findGroundContactTick(
      initialBall,
      input.searchDurationTicks,
      input.parameters
    );
    const firstGroundContact = firstGroundContactTick === null ? null : {
      tick: firstGroundContactTick,
      state: advanceBallState(
        initialBall,
        firstGroundContactTick - initialBall.tick,
        input.parameters
      )
    };
    return {
      contact: input.contact,
      initialBall,
      ballRadiusMeters: input.parameters.ballRadius,
      firstGroundContact
    };
  };

  // src/core/sim/ball/BattedBallWorldContacts.ts
  var id = (v2) => typeof v2 === "string" && v2.length > 0 && v2 === v2.trim();
  var tick2 = (v2) => typeof v2 === "number" && Number.isSafeInteger(v2) && v2 >= 0;
  var finite = (v2) => typeof v2 === "number" && Number.isFinite(v2);
  var vector = (v2) => v2 && [v2.x, v2.y, v2.z].every(finite);
  var freeze5 = (v2) => {
    if (v2 && typeof v2 === "object") {
      Object.values(v2).forEach(freeze5);
      Object.freeze(v2);
    }
    return v2;
  };
  var json = (v2) => JSON.stringify(v2, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
  var ballAt = (initial, at2, p, dt = (at2 - initial.tick) / p.ticksPerSecond) => {
    const state = {
      tick: at2,
      position: {
        x: initial.position.x + initial.velocity.x * dt,
        y: initial.position.y + initial.velocity.y * dt + 0.5 * p.gravityY * dt * dt,
        z: initial.position.z + initial.velocity.z * dt
      },
      velocity: { x: initial.velocity.x, y: initial.velocity.y + p.gravityY * dt, z: initial.velocity.z },
      spin: initial.spin
    };
    if (!vector(state.position) || !vector(state.velocity)) throw new Error("batted World flight arithmetic overflow");
    return state;
  };
  var surfaceFrame = (s) => {
    if (!s || !id(s.surfaceId) || !s.start || !s.end || ![s.start.x, s.start.z, s.end.x, s.end.z, s.minimumHeight, s.maximumHeight].every(finite) || s.minimumHeight < 0 || s.maximumHeight <= s.minimumHeight) throw new Error("invalid batted World surface");
    const dx = s.end.x - s.start.x, dz = s.end.z - s.start.z, length = Math.hypot(dx, dz);
    if (!finite(length) || length <= 0) throw new Error("invalid batted World surface extent");
    return { length, ux: dx / length, uz: dz / length };
  };
  var surfaceContactTime = (initial, endTick, p, s) => {
    const { length, ux, uz } = surfaceFrame(s), duration = endTick - initial.tick;
    const along = (point) => (point.x - s.start.x) * ux + (point.z - s.start.z) * uz;
    const u0 = along(initial.position), uv = initial.velocity.x * ux + initial.velocity.z * uz;
    const within = (value, lower, upper) => value >= lower - 1e-9 && value <= upper + 1e-9;
    const candidates = [];
    const feature = (u, y) => {
      const movingU = u === null, movingY = y === null;
      const positionU = u ?? u0, positionY = y ?? initial.position.y;
      const wallPoint = {
        tick: initial.tick,
        center: { x: s.start.x + ux * positionU, y: positionY, z: s.start.z + uz * positionU },
        velocity: { x: movingU ? ux * uv : 0, y: movingY ? initial.velocity.y : 0, z: movingU ? uz * uv : 0 },
        acceleration: { x: 0, y: movingY ? p.gravityY : 0, z: 0 },
        radius: p.ballRadius / 2
      };
      const contact = findAcceleratedSphereContactTime({
        tick: initial.tick,
        center: initial.position,
        velocity: initial.velocity,
        acceleration: { x: 0, y: p.gravityY, z: 0 },
        radius: p.ballRadius / 2
      }, wallPoint, duration, { ticksPerSecond: p.ticksPerSecond });
      if (contact === null) return;
      const ball = ballAt(initial, contact.tick, p, contact.elapsedSeconds);
      if ((!movingU || within(along(ball.position), 0, length)) && (!movingY || within(ball.position.y, s.minimumHeight, s.maximumHeight))) candidates.push(contact);
    };
    feature(null, null);
    for (const u of [0, length]) feature(u, null);
    for (const y of [s.minimumHeight, s.maximumHeight]) feature(null, y);
    for (const u of [0, length]) for (const y of [s.minimumHeight, s.maximumHeight]) feature(u, y);
    return candidates.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)[0] ?? null;
  };
  var surfacePoint = (s, point) => {
    const { length, ux, uz } = surfaceFrame(s);
    const u = Math.max(0, Math.min(length, (point.x - s.start.x) * ux + (point.z - s.start.z) * uz));
    return { x: s.start.x + ux * u, y: Math.max(s.minimumHeight, Math.min(s.maximumHeight, point.y)), z: s.start.z + uz * u };
  };
  var deriveSourceContact = (input) => {
    const descriptor = input.sourceCurve, { flight, parameters: p } = input;
    const kernel = createSourceFreeBallKernel(descriptor);
    if (!tick2(input.throughTick) || input.throughTick < flight.initialBall.tick || descriptor.initial.originTick !== flight.initialBall.tick || descriptor.initial.elapsedSeconds !== 0 || json(descriptor.initial.ball) !== json(flight.initialBall) || descriptor.throughElapsedSeconds !== (input.throughTick - flight.initialBall.tick) / p.ticksPerSecond || descriptor.profile.air.ticksPerSecond !== p.ticksPerSecond || descriptor.profile.air.integrationStepTicks !== p.integrationStepTicks || descriptor.profile.air.gravityY !== p.gravityY || descriptor.profile.ground.radiusM !== p.ballRadius) {
      throw new Error("original nonlinear batted World Source scope differs");
    }
    const actual = createContinuousBattedBallFlightEvidence(flight.contact, input.throughTick - flight.initialBall.tick, descriptor.profile);
    if (json(actual.initialBall) !== json(flight.initialBall) || actual.ballRadiusMeters !== flight.ballRadiusMeters || flight.firstGroundContact && flight.firstGroundContact.tick <= input.throughTick && json(actual.firstGroundContact) !== json(flight.firstGroundContact)) throw new Error("nonlinear batted World original flight evidence differs");
    const query = querySourceFreeBallWorldV2({
      descriptor,
      moment: kernel.evaluateAt(0, "incoming").moment,
      side: "incoming",
      throughElapsedSeconds: descriptor.throughElapsedSeconds,
      actors: input.actors,
      surfaces: input.surfaces
    });
    if (query.kind === "unresolved") throw new Error("nonlinear first World contact requires numerical refinement");
    const ball = query.moment.ball;
    if (query.kind !== "boundary") return freeze5({ world: { kind: "airborne", throughTick: input.throughTick, ball, sourceMoment: query.moment }, geometry: null });
    const contacts = query.contacts.map((c2) => {
      if (c2.kind === "ground") return { kind: "ground" };
      if (c2.kind === "surface") return { kind: "surface", surfaceId: c2.surfaceId, point: c2.point };
      if (c2.kind !== "actor") throw new Error("unsupported original nonlinear World boundary");
      const primitive = input.actors.find((a) => a.playerId === c2.playerId && a.primitive.role === c2.role).primitive;
      return { kind: "actor", playerId: c2.playerId, role: c2.role, actor: {
        tick: ball.tick,
        center: c2.center,
        velocity: c2.velocity,
        acceleration: primitive.acceleration,
        radius: primitive.radius,
        role: c2.role
      } };
    });
    contacts.sort((a, b) => {
      const key3 = (c2) => JSON.stringify(c2.kind === "actor" ? [c2.kind, c2.playerId, c2.role] : c2.kind === "surface" ? [c2.kind, c2.surfaceId] : [c2.kind]);
      return key3(a) < key3(b) ? -1 : key3(a) > key3(b) ? 1 : 0;
    });
    const world = { kind: "contact", tick: ball.tick, ball, contacts, sourceMoment: query.moment };
    if (contacts.length !== 1 || contacts[0].kind === "ground") return freeze5({ world, geometry: null });
    const contact = contacts[0], c = query.contacts[0];
    if (c.kind !== "actor" && c.kind !== "surface") throw new Error("nonlinear contact geometry differs");
    return freeze5({ world, geometry: {
      contact,
      elapsedSeconds: query.moment.elapsedSeconds,
      ball,
      point: c.kind === "actor" ? c.center : c.point,
      surfaceVelocity: c.kind === "actor" ? c.velocity : { x: 0, y: 0, z: 0 },
      normal: c.normal
    } });
  };
  var deriveFirstBattedWorldContact = (raw) => {
    const input = cloneInert(raw), { flight, parameters: p } = input;
    if (input.sourceCurve !== void 0) return deriveSourceContact(input).world;
    if (!flight || !p || !tick2(input.throughTick) || !tick2(flight.contact?.tick) || input.throughTick < flight.contact.tick || !Array.isArray(input.actors) || !Array.isArray(input.surfaces)) throw new Error("invalid batted World contact interval");
    const actual = createBattedBallFlightEvidence({ contact: flight.contact, parameters: p, searchDurationTicks: input.throughTick - flight.contact.tick });
    if (json(actual.initialBall) !== json(flight.initialBall) || actual.ballRadiusMeters !== flight.ballRadiusMeters || flight.firstGroundContact && flight.firstGroundContact.tick <= input.throughTick && json(actual.firstGroundContact) !== json(flight.firstGroundContact)) throw new Error("batted World original flight evidence differs");
    const actorKeys = /* @__PURE__ */ new Set(), surfaceIds = /* @__PURE__ */ new Set();
    for (const actor of input.actors) {
      const s = actor?.primitive, key3 = JSON.stringify([actor?.playerId, s?.role]);
      if (!id(actor?.playerId) || !s || actorKeys.has(key3) || !["glove", "body", "tag_hand", "left_foot", "right_foot"].includes(s.role) || !tick2(s.startTick) || !tick2(s.endTick) || s.startTick > actual.initialBall.tick || s.endTick < input.throughTick || s.ticksPerSecond !== p.ticksPerSecond || !finite(s.radius) || s.radius <= 0 || !vector(s.startCenter) || !vector(s.startVelocity) || !vector(s.acceleration)) throw new Error("invalid batted World actor primitive");
      actorKeys.add(key3);
      const end = sampleDefenderPhysicalPrimitiveSegment(s, input.throughTick);
      if (!vector(end.center) || !vector(end.velocity)) throw new Error("batted World actor arithmetic overflow");
    }
    for (const surface of input.surfaces) {
      surfaceFrame(surface);
      if (surfaceIds.has(surface.surfaceId)) throw new Error("duplicate batted World surface");
      surfaceIds.add(surface.surfaceId);
    }
    const candidates = [];
    const ground = actual.firstGroundContact;
    if (ground) candidates.push({ tick: ground.tick, contact: { kind: "ground" } });
    const through = ground?.tick ?? input.throughTick, initial = actual.initialBall;
    for (const actor of input.actors) {
      const start = sampleDefenderPhysicalPrimitiveSegment(actor.primitive, initial.tick);
      const at3 = findAcceleratedSphereContactTick(
        {
          tick: initial.tick,
          center: initial.position,
          velocity: initial.velocity,
          acceleration: { x: 0, y: p.gravityY, z: 0 },
          radius: p.ballRadius
        },
        { tick: initial.tick, center: start.center, velocity: start.velocity, acceleration: start.acceleration, radius: start.radius },
        through - initial.tick,
        { ticksPerSecond: p.ticksPerSecond }
      );
      if (at3 !== null) candidates.push({ tick: at3, contact: {
        kind: "actor",
        playerId: actor.playerId,
        role: actor.primitive.role,
        actor: sampleDefenderPhysicalPrimitiveSegment(actor.primitive, at3)
      } });
    }
    for (const surface of input.surfaces) {
      const at3 = surfaceContactTime(initial, through, p, surface)?.tick ?? null;
      if (at3 !== null) candidates.push({ tick: at3, contact: { kind: "surface", surfaceId: surface.surfaceId, point: surfacePoint(surface, ballAt(initial, at3, p).position) } });
    }
    if (candidates.length === 0) return freeze5({ kind: "airborne", throughTick: input.throughTick, ball: ballAt(initial, input.throughTick, p) });
    const at2 = Math.min(...candidates.map((c) => c.tick));
    const contacts = candidates.filter((c) => c.tick === at2).map((c) => c.contact).sort((a, b) => {
      const key3 = (c) => JSON.stringify(c.kind === "actor" ? [c.kind, c.playerId, c.role] : c.kind === "surface" ? [c.kind, c.surfaceId] : [c.kind]);
      return key3(a) < key3(b) ? -1 : key3(a) > key3(b) ? 1 : 0;
    });
    return freeze5({ kind: "contact", tick: at2, ball: ground?.tick === at2 ? ground.state : ballAt(initial, at2, p), contacts });
  };
  var deriveFirstBattedWorldContactGeometry = (raw) => {
    const input = cloneInert(raw);
    if (input.sourceCurve !== void 0) return deriveSourceContact(input);
    const world = deriveFirstBattedWorldContact(input);
    if (world.kind !== "contact" || world.contacts.length !== 1 || world.contacts[0].kind === "ground") return freeze5({ world, geometry: null });
    const contact = world.contacts[0], p = input.parameters, initial = input.flight.initialBall;
    const originalFlight = createBattedBallFlightEvidence({
      contact: input.flight.contact,
      parameters: p,
      searchDurationTicks: input.throughTick - initial.tick
    });
    const through = originalFlight.firstGroundContact?.tick ?? input.throughTick;
    let time, point, surfaceVelocity;
    if (contact.kind === "surface") {
      const surface = input.surfaces.find((s) => s.surfaceId === contact.surfaceId);
      time = surfaceContactTime(initial, through, p, surface);
      if (!time || time.tick !== world.tick) throw new Error("original batted surface contact geometry differs");
      point = surfacePoint(surface, ballAt(initial, time.tick, p, time.elapsedSeconds).position);
      surfaceVelocity = { x: 0, y: 0, z: 0 };
    } else {
      const actor = input.actors.find((a) => a.playerId === contact.playerId && a.primitive.role === contact.role);
      const start = sampleDefenderPhysicalPrimitiveSegment(actor.primitive, initial.tick);
      time = findAcceleratedSphereContactTime(
        {
          tick: initial.tick,
          center: initial.position,
          velocity: initial.velocity,
          acceleration: { x: 0, y: p.gravityY, z: 0 },
          radius: p.ballRadius
        },
        { tick: initial.tick, center: start.center, velocity: start.velocity, acceleration: start.acceleration, radius: start.radius },
        through - initial.tick,
        { ticksPerSecond: p.ticksPerSecond }
      );
      if (!time || time.tick !== world.tick) throw new Error("original batted actor contact geometry differs");
      const dt = time.elapsedSeconds;
      point = {
        x: start.center.x + start.velocity.x * dt + 0.5 * start.acceleration.x * dt * dt,
        y: start.center.y + start.velocity.y * dt + 0.5 * start.acceleration.y * dt * dt,
        z: start.center.z + start.velocity.z * dt + 0.5 * start.acceleration.z * dt * dt
      };
      surfaceVelocity = {
        x: start.velocity.x + start.acceleration.x * dt,
        y: start.velocity.y + start.acceleration.y * dt,
        z: start.velocity.z + start.acceleration.z * dt
      };
    }
    const ball = ballAt(initial, time.tick, p, time.elapsedSeconds), difference = {
      x: ball.position.x - point.x,
      y: ball.position.y - point.y,
      z: ball.position.z - point.z
    };
    const length = Math.hypot(difference.x, difference.y, difference.z);
    if (!vector(point) || !vector(surfaceVelocity) || !finite(length)) throw new Error("batted contact geometry arithmetic overflow");
    const normal4 = length === 0 ? null : { x: difference.x / length, y: difference.y / length, z: difference.z / length };
    return freeze5({ world, geometry: { contact, elapsedSeconds: time.elapsedSeconds, ball, point, surfaceVelocity, normal: normal4 } });
  };

  // src/core/sim/ball/BattedBallContactResponse.ts
  var id2 = (v2) => typeof v2 === "string" && v2.length > 0 && v2 === v2.trim();
  var unit = (v2) => Number.isFinite(v2) && v2 >= 0 && v2 <= 1;
  var positive = (v2) => Number.isFinite(v2) && v2 > 0;
  var vector2 = (v2) => v2 && [v2.x, v2.y, v2.z].every(Number.isFinite);
  var freeze6 = (v2) => {
    if (v2 && typeof v2 === "object") {
      Object.values(v2).forEach(freeze6);
      Object.freeze(v2);
    }
    return v2;
  };
  var materialValid = (m) => m && [m.restitution, m.tangentialDamping, m.spinDamping].every(unit);
  var assertBattedActorResponseProfile = (p, parameters) => {
    if (!p || !["glove", "body", "tag_hand", "left_foot", "right_foot"].includes(p.role)) throw new Error("invalid batted actor response role");
    if (p.role === "glove") {
      const c = p.parameters;
      if (!vector2(p.pocketCenterOffset) || !unit(p.bodyStability) || !c || c.ticksPerSecond !== parameters.ticksPerSecond || c.ballRadiusMeters !== parameters.ballRadius || ![c.ballMassKg, c.ballRadiusMeters, c.pocketRadiusMeters, c.centerRetentionCapacityJ, c.captureDissipationPowerW].every(positive) || ![c.failedContactRestitution, c.failedTangentialDamping, c.failedSpinDamping].every(unit)) throw new Error("invalid batted glove response profile");
    } else if (!materialValid(p.material)) throw new Error("invalid batted actor response material");
  };
  var assertBattedResponseProfiles = (input) => {
    if (!input.world || !Array.isArray(input.world.actors) || !Array.isArray(input.world.surfaces) || !Array.isArray(input.actors) || !Array.isArray(input.surfaces)) throw new Error("invalid batted response profiles");
    const actorKeys = /* @__PURE__ */ new Set(), surfaceIds = /* @__PURE__ */ new Set();
    for (const a of input.actors) {
      const p = a?.profile, key3 = JSON.stringify([a?.playerId, p?.role]);
      if (!id2(a?.playerId) || !p || actorKeys.has(key3) || !input.world.actors.some((w) => w.playerId === a.playerId && w.primitive.role === p.role)) {
        throw new Error("batted response actor profile differs");
      }
      actorKeys.add(key3);
      assertBattedActorResponseProfile(p, input.world.parameters);
    }
    for (const s of input.surfaces) {
      if (!id2(s?.surfaceId) || surfaceIds.has(s.surfaceId) || !input.world.surfaces.some((w) => w.surfaceId === s.surfaceId) || !materialValid(s.material)) throw new Error("batted response surface profile differs");
      surfaceIds.add(s.surfaceId);
    }
    if (actorKeys.size !== input.world.actors.length || surfaceIds.size !== input.world.surfaces.length) throw new Error("incomplete batted response profiles");
  };
  var deriveBattedBallContactResponse = (raw) => {
    const input = cloneInert(raw);
    assertBattedResponseProfiles(input);
    const { world, geometry } = deriveFirstBattedWorldContactGeometry(input.world);
    if (world.kind === "airborne") return freeze6({ kind: "airborne", world, ball: world.ball });
    if (world.contacts.length !== 1) return freeze6({ kind: "unresolved", reason: "simultaneous", world });
    if (world.contacts[0].kind === "ground") return freeze6({ kind: "ground", world, ball: world.ball });
    if (!geometry?.normal) return freeze6({ kind: "unresolved", reason: "degenerate_normal", world });
    const c = geometry.contact;
    if (c.kind === "actor") {
      const profile = input.actors.find((a) => a.playerId === c.playerId && a.profile.role === c.role).profile;
      if (profile.role === "glove") {
        const pocket = {
          x: geometry.point.x + profile.pocketCenterOffset.x,
          y: geometry.point.y + profile.pocketCenterOffset.y,
          z: geometry.point.z + profile.pocketCenterOffset.z
        };
        const pocketOffsetMeters = Math.hypot(geometry.ball.position.x - pocket.x, geometry.ball.position.y - pocket.y, geometry.ball.position.z - pocket.z);
        const retention = resolveCatchRetention({
          contactTick: geometry.ball.tick,
          ball: geometry.ball,
          glove: { tick: geometry.ball.tick, position: geometry.point, velocity: geometry.surfaceVelocity },
          contactNormal: geometry.normal,
          pocketOffsetMeters,
          bodyStability: profile.bodyStability
        }, profile.parameters);
        return retention.outcome.kind === "secured" ? freeze6({ kind: "capture_candidate", world, geometry, retention }) : freeze6({ kind: "rebound", world, geometry, retention, ball: retention.outcome.ball });
      }
      return freeze6({ kind: "rebound", world, geometry, ball: respondToBallContact({
        ball: geometry.ball,
        normal: geometry.normal,
        surfaceVelocity: geometry.surfaceVelocity,
        material: profile.material
      }) });
    }
    const material2 = input.surfaces.find((s) => s.surfaceId === c.surfaceId).material;
    return freeze6({ kind: "rebound", world, geometry, ball: respondToBallContact({
      ball: geometry.ball,
      normal: geometry.normal,
      surfaceVelocity: geometry.surfaceVelocity,
      material: material2
    }) });
  };

  // src/core/sim/ball/SourceFreeBallWorldQuery.ts
  var axes = ["x", "y", "z"];
  var baseIds = ["home", "first", "second", "third"];
  var finite2 = (v2) => typeof v2 === "number" && Number.isFinite(v2);
  var fields5 = (v2, required, optional = []) => !!v2 && typeof v2 === "object" && !Array.isArray(v2) && required.every((k) => Object.hasOwn(v2, k)) && Object.keys(v2).every((k) => required.includes(k) || optional.includes(k));
  var vector3 = (v2) => fields5(v2, axes) && axes.every((axis) => finite2(v2[axis]));
  var id3 = (v2) => typeof v2 === "string" && !!v2.length && v2 === v2.trim();
  var tick3 = (v2) => Number.isSafeInteger(v2) && v2 >= 0;
  var norm = (v2) => Math.hypot(v2.x, v2.y, v2.z);
  var sub2 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  var distance = (a, b) => norm(sub2(a, b));
  var normal = (a, b) => {
    const d = distance(a, b);
    return d === 0 ? null : { x: (a.x - b.x) / d, y: (a.y - b.y) / d, z: (a.z - b.z) / d };
  };
  var freeze7 = (v2) => {
    if (v2 && typeof v2 === "object") {
      Object.values(v2).forEach(freeze7);
      Object.freeze(v2);
    }
    return v2;
  };
  var json2 = (v2) => JSON.stringify(v2, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
  var scopeKey = (q) => json2([q.actors, q.surfaces, q.bases ?? null]);
  var basisKey = (d) => json2([d.initial, d.profile]);
  var querySourceFreeBallWorld = (raw, proof) => {
    const input = cloneInert(raw), { descriptor, moment } = input;
    if (!fields5(input, ["descriptor", "moment", "side", "throughElapsedSeconds", "actors", "surfaces"], ["bases", "previousContacts", "previousBaseContacts"]) || !moment || !finite2(input.throughElapsedSeconds) || input.throughElapsedSeconds < moment.elapsedSeconds || !["incoming", "outgoing"].includes(input.side) || !Array.isArray(input.actors) || !Array.isArray(input.surfaces)) {
      throw new Error("invalid nonlinear Source World query");
    }
    const kernel = createSourceFreeBallKernel(descriptor), p = descriptor.profile.air.ticksPerSecond, radius = descriptor.profile.ground.radiusM;
    if (json2(kernel.evaluateAt(moment.elapsedSeconds, input.side).moment) !== json2(moment) || input.throughElapsedSeconds > descriptor.throughElapsedSeconds) throw new Error("nonlinear World query differs from its original Source moment");
    const ballAt2 = (time) => kernel.evaluateAt(time, "incoming").moment.ball.position;
    const colliders = [], identities = /* @__PURE__ */ new Set();
    for (const actor of input.actors) {
      const s = actor?.primitive, key3 = json2(["actor", actor?.playerId, s?.role]);
      if (!fields5(actor, ["playerId", "primitive"], ["startElapsedSeconds"]) || !id3(actor.playerId) || !s || !fields5(s, ["role", "radius", "startTick", "endTick", "ticksPerSecond", "startCenter", "startVelocity", "acceleration"]) || !["glove", "body", "tag_hand", "left_foot", "right_foot"].includes(s.role) || !finite2(s.radius) || s.radius <= 0 || !tick3(s.startTick) || !tick3(s.endTick) || s.ticksPerSecond !== p || s.endTick < quantizeEventTick(moment.originTick, input.throughElapsedSeconds, p) || input.throughElapsedSeconds > (s.endTick - moment.originTick) / p || ![s.startCenter, s.startVelocity, s.acceleration].every(vector3) || identities.has(key3) || actor.startElapsedSeconds !== void 0 && (!finite2(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0)) {
        throw new Error("invalid nonlinear World actor coverage");
      }
      const at3 = (time) => {
        const dt = (moment.originTick - s.startTick) / p + time - (actor.startElapsedSeconds ?? 0);
        if (dt < 0) throw new Error("nonlinear World actor begins after source time");
        const center = {
          x: s.startCenter.x + s.startVelocity.x * dt + s.acceleration.x * dt * dt / 2,
          y: s.startCenter.y + s.startVelocity.y * dt + s.acceleration.y * dt * dt / 2,
          z: s.startCenter.z + s.startVelocity.z * dt + s.acceleration.z * dt * dt / 2
        };
        const velocity = {
          x: s.startVelocity.x + s.acceleration.x * dt,
          y: s.startVelocity.y + s.acceleration.y * dt,
          z: s.startVelocity.z + s.acceleration.z * dt
        };
        if (![center, velocity].every(vector3)) throw new Error("nonlinear actor arithmetic overflow");
        return { center, velocity };
      };
      at3(moment.elapsedSeconds);
      at3(input.throughElapsedSeconds);
      identities.add(key3);
      colliders.push({
        key: key3,
        separation: (time) => distance(ballAt2(time), at3(time).center) - radius - s.radius,
        speedBound: (a, b) => Math.max(norm(at3(a).velocity), norm(at3(b).velocity)),
        accelerationBoundMps2: norm(s.acceleration),
        contact: (m) => {
          const state = at3(m.elapsedSeconds);
          return {
            kind: "actor",
            playerId: actor.playerId,
            role: s.role,
            moment: m,
            ...state,
            normal: normal(m.ball.position, state.center)
          };
        }
      });
    }
    for (const surface of input.surfaces) {
      const s = surface, key3 = json2(["surface", s?.surfaceId]);
      if (!fields5(s, ["surfaceId", "start", "end", "minimumHeight", "maximumHeight"]) || !id3(s.surfaceId) || !fields5(s.start, ["x", "z"]) || !fields5(s.end, ["x", "z"]) || ![s.start.x, s.start.z, s.end.x, s.end.z, s.minimumHeight, s.maximumHeight].every(finite2) || s.minimumHeight < 0 || s.maximumHeight <= s.minimumHeight || identities.has(key3)) throw new Error("invalid nonlinear surface");
      const dx = s.end.x - s.start.x, dz = s.end.z - s.start.z, length = Math.hypot(dx, dz);
      if (!finite2(length) || length <= 0) throw new Error("invalid nonlinear surface extent");
      const closest = (point) => {
        const u = Math.max(0, Math.min(length, ((point.x - s.start.x) * dx + (point.z - s.start.z) * dz) / length));
        return { x: s.start.x + dx / length * u, y: Math.max(s.minimumHeight, Math.min(s.maximumHeight, point.y)), z: s.start.z + dz / length * u };
      };
      identities.add(key3);
      colliders.push({
        key: key3,
        separation: (time) => distance(ballAt2(time), closest(ballAt2(time))) - radius,
        speedBound: () => 0,
        accelerationBoundMps2: 0,
        contact: (m) => {
          const point = closest(m.ball.position);
          return {
            kind: "surface",
            surfaceId: s.surfaceId,
            moment: m,
            point,
            normal: normal(m.ball.position, point)
          };
        }
      });
    }
    if (input.bases !== void 0) {
      if (!fields5(input.bases, baseIds)) throw new Error("invalid nonlinear base coverage");
      for (const baseId of baseIds) {
        const b = input.bases[baseId], r = b?.region;
        if (!fields5(b, ["region", "bottomY", "topY"]) || !fields5(r, ["center", "halfSize", "rotationRadians"]) || !fields5(r.center, ["x", "z"]) || !fields5(r.halfSize, ["x", "z"]) || ![r.center.x, r.center.z, r.halfSize.x, r.halfSize.z, r.rotationRadians, b.bottomY, b.topY].every(finite2) || r.halfSize.x <= 0 || r.halfSize.z <= 0 || b.bottomY < 0 || b.topY <= b.bottomY) throw new Error("invalid nonlinear base prism");
        const extent = Math.hypot(r.halfSize.x, r.halfSize.z);
        if (![
          extent,
          r.center.x - extent,
          r.center.x + extent,
          r.center.z - extent,
          r.center.z + extent,
          b.topY - b.bottomY
        ].every(finite2)) throw new Error("nonlinear base arithmetic overflow");
        const c = Math.cos(r.rotationRadians), s = Math.sin(r.rotationRadians);
        const closest = (point) => {
          const dx = point.x - r.center.x, dz = point.z - r.center.z;
          const x = Math.max(-r.halfSize.x, Math.min(r.halfSize.x, dx * c + dz * s));
          const z = Math.max(-r.halfSize.z, Math.min(r.halfSize.z, -dx * s + dz * c));
          return { x: r.center.x + x * c - z * s, y: Math.max(b.bottomY, Math.min(b.topY, point.y)), z: r.center.z + x * s + z * c };
        };
        colliders.push({
          key: json2(["base", baseId]),
          separation: (time) => distance(ballAt2(time), closest(ballAt2(time))) - radius,
          speedBound: () => 0,
          accelerationBoundMps2: 0,
          contact: (m) => {
            const point = closest(m.ball.position);
            return {
              kind: "base",
              baseId,
              moment: m,
              point,
              normal: normal(m.ball.position, point)
            };
          }
        });
      }
    }
    const previous = /* @__PURE__ */ new Set(), known = new Set(colliders.map((c) => c.key));
    if (input.previousContacts !== void 0 && !Array.isArray(input.previousContacts) || input.previousBaseContacts !== void 0 && !Array.isArray(input.previousBaseContacts)) throw new Error("invalid nonlinear previous contact scope");
    for (const c of input.previousContacts ?? []) {
      const key3 = c?.kind === "actor" && fields5(c, ["kind", "playerId", "role"]) ? json2(["actor", c.playerId, c.role]) : c?.kind === "surface" && fields5(c, ["kind", "surfaceId"]) ? json2(["surface", c.surfaceId]) : "";
      if (!known.has(key3) || previous.has(key3)) throw new Error("invalid nonlinear previous collider");
      previous.add(key3);
    }
    for (const base of input.previousBaseContacts ?? []) {
      const key3 = json2(["base", base]);
      if (!known.has(key3) || previous.has(key3)) throw new Error("invalid nonlinear previous base");
      previous.add(key3);
    }
    const firstBoundary = kernel.boundaries.find((b) => b.kind !== "rolling_started" && (b.elapsedSeconds > moment.elapsedSeconds || input.side === "incoming" && b.elapsedSeconds === moment.elapsedSeconds) && b.elapsedSeconds <= input.throughElapsedSeconds);
    const horizon = firstBoundary?.elapsedSeconds ?? input.throughElapsedSeconds;
    let evaluations = 0;
    const searches = colliders.map((collider) => {
      const separation = (time) => {
        if (++evaluations > 5e5) throw new Error("nonlinear World contact search exceeds bounded work");
        const value = collider.separation(time);
        if (!finite2(value)) throw new Error("nonlinear World separation arithmetic overflow");
        return value;
      };
      const search = (a, b, sa, sb, speed2, rounding) => {
        if (sa <= 0) return { kind: "hit", time: a, from: a };
        if (Math.min(sa, sb) > speed2 * (b - a) + rounding) return { kind: "clear" };
        if (b - a <= 1e-15 || (a + b) / 2 === a || (a + b) / 2 === b) {
          return sb <= 0 ? { kind: "hit", time: b, from: a } : { kind: "unresolved", from: a, through: b };
        }
        const middle = (a + b) / 2, sm = separation(middle);
        const left = search(a, middle, sa, sm, speed2, rounding);
        if (left.kind === "hit") return left;
        if (left.kind === "unresolved" && middle - left.from > 1e-12) return left;
        const right = search(middle, b, sm, sb, speed2, rounding);
        if (left.kind === "clear") return right;
        if (right.kind === "hit" && right.time - left.from <= 1e-12) return { ...right, from: left.from };
        return right.kind === "unresolved" ? { kind: "unresolved", from: left.from, through: right.through } : left;
      };
      const start = separation(moment.elapsedSeconds);
      let searchFrom = moment.elapsedSeconds;
      if (start <= 0) {
        const blocked = () => ({
          collider,
          result: { kind: "hit", time: moment.elapsedSeconds, from: moment.elapsedSeconds, persistent: true }
        });
        if (!previous.has(collider.key)) return { collider, result: { kind: "hit", time: searchFrom, from: searchFrom } };
        const certified = proof && proof.colliderKey === collider.key && previous.size === 1 && proof.basisKey === basisKey(descriptor) && proof.scopeKey === scopeKey(input) && json2(moment) === json2(proof.diagnostic.outgoingMoment);
        if (certified && start !== proof.diagnostic.initialSignedGapMeters) return blocked();
        if (start < 0 && !certified || input.side !== "outgoing" || moment.elapsedSeconds !== descriptor.initial.elapsedSeconds) return blocked();
        const c = collider.contact(moment);
        if (!("normal" in c) || !c.normal) return blocked();
        const relative = sub2(moment.ball.velocity, c.kind === "actor" ? c.velocity : { x: 0, y: 0, z: 0 });
        const outward = axes.reduce((sum, axis) => sum + c.normal[axis] * relative[axis], 0);
        if (!finite2(outward) || outward <= 0) return blocked();
        if (horizon === searchFrom) return { collider, result: { kind: "clear" } };
        const cell = kernel.cells.find((cell2) => cell2.fromElapsedSeconds === searchFrom);
        if (!cell) return blocked();
        const phase = kernel.evaluateAt(searchFrom, input.side).phase;
        const deviation = (phase === "airborne" ? sourceRk4PositionBounds(moment.ball, cell.throughElapsedSeconds - searchFrom, descriptor.profile.air).linearDeviationMps2 : Math.max(
          descriptor.profile.ground.material.slidingFriction * descriptor.profile.ground.gravityMps2,
          descriptor.profile.ground.material.rollingDecelerationMps2
        ) / 2) + collider.accelerationBoundMps2 / 2;
        const window = Math.min(horizon - searchFrom, cell.throughElapsedSeconds - searchFrom, deviation === 0 ? Infinity : outward / (2 * deviation));
        const escape = 2 * (Math.max(0, -start) + cell.positionRoundingBoundMeters) / outward;
        if (!finite2(window) || window <= 0 || !finite2(escape) || escape > 1e-12 || escape >= window) {
          return { collider, result: { kind: "unresolved", from: searchFrom, through: searchFrom + Math.max(0, window) } };
        }
        const lowerGap = start + outward * escape - deviation * escape * escape - cell.positionRoundingBoundMeters;
        if (certified && (!finite2(lowerGap) || lowerGap <= 0)) return blocked();
        const gapAtEscape = separation(searchFrom + escape), gapAtEnd = separation(searchFrom + window);
        if (gapAtEscape <= 0 || gapAtEnd <= 0) return blocked();
        if (certified) proof.recordAdvance(freeze7({
          colliderKey: collider.key,
          fromElapsedSeconds: searchFrom,
          escapeBracketThroughElapsedSeconds: searchFrom + escape,
          provenClearThroughElapsedSeconds: searchFrom + window,
          linearDeviationMps2: deviation,
          positionRoundingBoundMeters: cell.positionRoundingBoundMeters,
          signedGapAtEscapeMeters: gapAtEscape,
          signedGapAtClearWindowEndMeters: gapAtEnd,
          supportingPlaneLowerGapAtEscapeMeters: lowerGap
        }));
        searchFrom += window;
      }
      for (const cell of kernel.cells) {
        const a = Math.max(searchFrom, cell.fromElapsedSeconds), b = Math.min(horizon, cell.throughElapsedSeconds);
        if (b <= a) continue;
        const speed2 = cell.maximumPositionSpeedMps + collider.speedBound(a, b);
        if (!finite2(speed2)) throw new Error("nonlinear relative speed bound overflows");
        const result = search(a, b, separation(a), separation(b), speed2, cell.positionRoundingBoundMeters);
        if (result.kind !== "clear") return { collider, result };
      }
      return { collider, result: { kind: "clear" } };
    });
    const hits = searches.filter((s) => s.result.kind === "hit");
    const earliest = Math.min(horizon, ...hits.map((s) => s.result.time));
    const uncertain = searches.find((s) => s.result.kind === "unresolved" && s.result.from <= earliest)?.result;
    if (uncertain?.kind === "unresolved") return freeze7({
      authority: "SOURCE_NONLINEAR_FREE_BALL_QUERY_RESEARCH",
      kind: "unresolved",
      reason: "numerical_contact_refinement_required",
      interval: { from: uncertain.from, through: uncertain.through }
    });
    const at2 = kernel.evaluateAt(earliest, firstBoundary?.elapsedSeconds === earliest ? "incoming" : earliest === moment.elapsedSeconds ? input.side : "incoming"), contacts = [];
    if (firstBoundary?.elapsedSeconds === earliest) contacts.push({ kind: firstBoundary.kind === "ground" ? "ground" : "rolling_stop", moment: at2.moment });
    const persistent = new Set(searches.filter((s) => s.result.kind === "hit" && s.result.persistent).map((s) => s.collider.key));
    for (const collider of colliders) if (collider.separation(earliest) <= 0) {
      if (earliest === moment.elapsedSeconds && previous.has(collider.key) && searches.find((s) => s.collider === collider)?.result.kind === "clear") continue;
      const contact = collider.contact(at2.moment);
      contacts.push(persistent.has(collider.key) ? { ...contact, continuing: true } : contact);
    }
    contacts.sort((a, b) => json2(a) < json2(b) ? -1 : json2(a) > json2(b) ? 1 : 0);
    const contactSearchWitnesses = hits.filter((s) => s.result.kind === "hit" && s.result.time === earliest).map((s) => {
      const hit = s.result;
      const cell = kernel.cells.find((c) => c.fromElapsedSeconds <= hit.time && c.throughElapsedSeconds >= hit.time);
      return {
        colliderKey: s.collider.key,
        firstPossibleElapsedSeconds: hit.from,
        witnessElapsedSeconds: hit.time,
        signedGapMeters: s.collider.separation(hit.time),
        positionRoundingBoundMeters: cell?.positionRoundingBoundMeters ?? 0
      };
    });
    return freeze7({
      authority: "SOURCE_NONLINEAR_FREE_BALL_QUERY_RESEARCH",
      kind: contacts.length ? "boundary" : at2.phase === "resting" ? "resting" : "moving",
      moment: at2.moment,
      phase: at2.phase,
      contacts,
      numericalResolution: { contactBracketSeconds: 1e-12 },
      contactSearchWitnesses,
      ...contacts.some((c) => "continuing" in c && c.continuing) ? { pendingReason: "persistent_contact" } : {}
    });
  };
  var querySourceFreeBallWorldV2 = (raw) => querySourceFreeBallWorld(raw);
  var createSourceImpactEscapeSessionV3 = () => {
    const observations = /* @__PURE__ */ new WeakMap();
    const proofs = /* @__PURE__ */ new Map(), diagnostics = [], advances = [];
    const query = (raw) => {
      const input = cloneInert(raw), proof = proofs.get(basisKey(input.descriptor));
      const result = querySourceFreeBallWorld(input, proof);
      observations.set(result, { input: freeze7(input), result });
      return result;
    };
    const adoptImpulse = (observed, raw, rawBasis) => {
      const record = observations.get(observed);
      if (!record || record.result !== observed || observed.kind !== "boundary" || observed.pendingReason || observed.contacts.length !== 1) {
        throw new Error("v3 impulse requires its own sole original query witness");
      }
      const response = cloneInert(raw), descriptor = cloneInert(rawBasis), c = observed.contacts[0], prior = record.input;
      assertBattedResponseProfiles(response);
      if (c.kind !== "actor" && c.kind !== "surface" || !c.normal || json2(response.world.actors) !== json2(prior.actors) || json2(response.world.surfaces) !== json2(prior.surfaces) || response.world.parameters.ticksPerSecond !== prior.descriptor.profile.air.ticksPerSecond || response.world.parameters.integrationStepTicks !== prior.descriptor.profile.air.integrationStepTicks || response.world.parameters.gravityY !== prior.descriptor.profile.air.gravityY || response.world.parameters.ballRadius !== prior.descriptor.profile.ground.radiusM || json2(descriptor.profile) !== json2(prior.descriptor.profile)) throw new Error("v3 original response geometry/profile scope differs");
      const colliderKey2 = c.kind === "actor" ? json2(["actor", c.playerId, c.role]) : json2(["surface", c.surfaceId]);
      const witness = observed.contactSearchWitnesses.find((w) => w.colliderKey === colliderKey2);
      if (!witness || witness.witnessElapsedSeconds !== observed.moment.elapsedSeconds || witness.witnessElapsedSeconds <= prior.moment.elapsedSeconds || witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds > 1e-12) throw new Error("v3 impulse contact bracket is unsupported");
      const surfaceVelocity = c.kind === "actor" ? c.velocity : { x: 0, y: 0, z: 0 };
      const normalSpeed = (v2) => axes.reduce((sum, axis) => sum + c.normal[axis] * (v2[axis] - surfaceVelocity[axis]), 0);
      const incomingNormalSpeedMps = normalSpeed(c.moment.ball.velocity);
      if (!finite2(incomingNormalSpeedMps) || incomingNormalSpeedMps >= 0) throw new Error("v3 impulse lacks inward contact velocity");
      let outgoingBall;
      if (c.kind === "actor") {
        const profile = response.actors.find((a) => a.playerId === c.playerId && a.profile.role === c.role).profile;
        if (profile.role === "glove") {
          const pocket = { x: c.center.x + profile.pocketCenterOffset.x, y: c.center.y + profile.pocketCenterOffset.y, z: c.center.z + profile.pocketCenterOffset.z };
          const retention = resolveCatchRetention({
            contactTick: c.moment.ball.tick,
            ball: c.moment.ball,
            glove: { tick: c.moment.ball.tick, position: c.center, velocity: c.velocity },
            contactNormal: c.normal,
            bodyStability: profile.bodyStability,
            pocketOffsetMeters: distance(c.moment.ball.position, pocket)
          }, profile.parameters);
          if (retention.outcome.kind !== "live-ball") throw new Error("v3 free basis cannot adopt a secured custody candidate");
          outgoingBall = retention.outcome.ball;
        } else outgoingBall = respondToBallContact({ ball: c.moment.ball, normal: c.normal, surfaceVelocity, material: profile.material });
      } else outgoingBall = respondToBallContact({
        ball: c.moment.ball,
        normal: c.normal,
        surfaceVelocity,
        material: response.surfaces.find((s) => s.surfaceId === c.surfaceId).material
      });
      const outgoingMoment = { ...c.moment, ball: outgoingBall };
      if (json2(descriptor.initial) !== json2(outgoingMoment)) throw new Error("v3 new basis differs from original impulse/clock tuple");
      createSourceFreeBallKernel(descriptor);
      const outgoingNormalSpeedMps = normalSpeed(outgoingBall.velocity);
      if (!finite2(outgoingNormalSpeedMps) || outgoingNormalSpeedMps <= 0) throw new Error("v3 original impulse has no outward departure");
      const kernel = createSourceFreeBallKernel(prior.descriptor), cell = kernel.cells.find((cell2) => cell2.fromElapsedSeconds <= witness.witnessElapsedSeconds && cell2.throughElapsedSeconds >= witness.witnessElapsedSeconds);
      if (!cell) throw new Error("v3 witness lacks original Source cell bounds");
      let otherSpeed = 0;
      if (c.kind === "actor") {
        const actor = prior.actors.find((a) => a.playerId === c.playerId && a.primitive.role === c.role), s = actor.primitive;
        const velocity = (time) => {
          const dt = (c.moment.originTick - s.startTick) / s.ticksPerSecond + time - (actor.startElapsedSeconds ?? 0);
          return norm({ x: s.startVelocity.x + s.acceleration.x * dt, y: s.startVelocity.y + s.acceleration.y * dt, z: s.startVelocity.z + s.acceleration.z * dt });
        };
        otherSpeed = Math.max(velocity(witness.firstPossibleElapsedSeconds), velocity(witness.witnessElapsedSeconds));
      }
      const gapBoundMeters = cell.positionRoundingBoundMeters + (cell.maximumPositionSpeedMps + otherSpeed) * (witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds);
      if (!finite2(gapBoundMeters) || witness.signedGapMeters < -gapBoundMeters) throw new Error("v3 witness penetration exceeds its original bracket bound");
      const diagnostic = freeze7({
        colliderKey: colliderKey2,
        incomingMoment: c.moment,
        outgoingMoment,
        firstPossibleElapsedSeconds: witness.firstPossibleElapsedSeconds,
        witnessElapsedSeconds: witness.witnessElapsedSeconds,
        initialSignedGapMeters: witness.signedGapMeters,
        sourcePositionRoundingBoundMeters: cell.positionRoundingBoundMeters,
        gapBoundMeters,
        incomingNormalSpeedMps,
        outgoingNormalSpeedMps
      });
      proofs.set(basisKey(descriptor), {
        basisKey: basisKey(descriptor),
        scopeKey: scopeKey(prior),
        colliderKey: colliderKey2,
        diagnostic,
        recordAdvance: (advance) => advances.push(advance)
      });
      diagnostics.push(diagnostic);
      return diagnostic;
    };
    const adoptBaseImpulse = (observed, raw, rawMaterials, rawBasis) => {
      const record = observations.get(observed);
      if (!record || record.result !== observed || observed.kind !== "boundary" || observed.pendingReason || observed.contacts.length !== 1 || observed.contacts[0].kind !== "base" || !observed.contacts[0].normal) throw new Error("v3 base impulse requires its own sole original base query witness");
      const response = cloneInert(raw), materials = cloneInert(rawMaterials), descriptor = cloneInert(rawBasis), c = observed.contacts[0], prior = record.input;
      assertBattedResponseProfiles(response);
      if (!prior.bases || !fields5(materials, baseIds) || baseIds.some((id6) => !fields5(materials[id6], ["restitution", "tangentialDamping", "spinDamping"]) || Object.values(materials[id6]).some((n) => !finite2(n) || n < 0 || n > 1)) || json2(response.world.actors) !== json2(prior.actors) || json2(response.world.surfaces) !== json2(prior.surfaces) || response.world.parameters.ticksPerSecond !== prior.descriptor.profile.air.ticksPerSecond || response.world.parameters.integrationStepTicks !== prior.descriptor.profile.air.integrationStepTicks || response.world.parameters.gravityY !== prior.descriptor.profile.air.gravityY || response.world.parameters.ballRadius !== prior.descriptor.profile.ground.radiusM || json2(descriptor.profile) !== json2(prior.descriptor.profile)) throw new Error("v3 original base response geometry/material/profile differs");
      const colliderKey2 = json2(["base", c.baseId]), witness = observed.contactSearchWitnesses.find((w) => w.colliderKey === colliderKey2);
      if (!witness || witness.witnessElapsedSeconds !== c.moment.elapsedSeconds || witness.witnessElapsedSeconds <= prior.moment.elapsedSeconds || witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds > 1e-12) throw new Error("v3 base impulse contact bracket is unsupported");
      const normalSpeed = (v2) => axes.reduce((sum, axis) => sum + c.normal[axis] * v2[axis], 0);
      const incomingNormalSpeedMps = normalSpeed(c.moment.ball.velocity);
      if (!finite2(incomingNormalSpeedMps) || incomingNormalSpeedMps >= 0) throw new Error("v3 base impulse lacks inward contact velocity");
      const ball = respondToBallContact({ ball: c.moment.ball, normal: c.normal, surfaceVelocity: { x: 0, y: 0, z: 0 }, material: materials[c.baseId] });
      const outgoingMoment = { ...c.moment, ball };
      if (json2(descriptor.initial) !== json2(outgoingMoment)) throw new Error("v3 new base basis differs from original impulse/clock tuple");
      createSourceFreeBallKernel(descriptor);
      const outgoingNormalSpeedMps = normalSpeed(ball.velocity);
      if (!finite2(outgoingNormalSpeedMps) || outgoingNormalSpeedMps <= 0) throw new Error("v3 original base impulse has no outward departure");
      const kernel = createSourceFreeBallKernel(prior.descriptor), cell = kernel.cells.find((cell2) => cell2.fromElapsedSeconds <= witness.witnessElapsedSeconds && cell2.throughElapsedSeconds >= witness.witnessElapsedSeconds);
      if (!cell) throw new Error("v3 base witness lacks original Source cell bounds");
      const gapBoundMeters = cell.positionRoundingBoundMeters + cell.maximumPositionSpeedMps * (witness.witnessElapsedSeconds - witness.firstPossibleElapsedSeconds);
      if (!finite2(gapBoundMeters) || witness.signedGapMeters < -gapBoundMeters) throw new Error("v3 base witness penetration exceeds its original bracket bound");
      const diagnostic = freeze7({
        colliderKey: colliderKey2,
        incomingMoment: c.moment,
        outgoingMoment,
        firstPossibleElapsedSeconds: witness.firstPossibleElapsedSeconds,
        witnessElapsedSeconds: witness.witnessElapsedSeconds,
        initialSignedGapMeters: witness.signedGapMeters,
        sourcePositionRoundingBoundMeters: cell.positionRoundingBoundMeters,
        gapBoundMeters,
        incomingNormalSpeedMps,
        outgoingNormalSpeedMps
      });
      proofs.set(basisKey(descriptor), {
        basisKey: basisKey(descriptor),
        scopeKey: scopeKey(prior),
        colliderKey: colliderKey2,
        diagnostic,
        recordAdvance: (advance) => advances.push(advance)
      });
      diagnostics.push(diagnostic);
      return diagnostic;
    };
    return Object.freeze({ query, adoptImpulse, adoptBaseImpulse, diagnostics: () => freeze7([...diagnostics]), advances: () => freeze7([...advances]) });
  };

  // src/core/sim/ball/BallWorldBaseBoundary.ts
  var baseIds2 = ["home", "first", "second", "third"];
  var axes2 = ["x", "y", "z"];
  var fields6 = (v2, names2) => !!v2 && typeof v2 === "object" && !Array.isArray(v2) && Object.keys(v2).sort().join("|") === [...names2].sort().join("|");
  var finite3 = (v2) => typeof v2 === "number" && Number.isFinite(v2);
  var tick4 = (v2) => typeof v2 === "number" && Number.isSafeInteger(v2) && v2 >= 0;
  var vector4 = (v2) => fields6(v2, axes2) && axes2.every((axis) => finite3(v2[axis]));
  var freeze8 = (v2) => {
    if (v2 && typeof v2 === "object") {
      Object.values(v2).forEach(freeze8);
      Object.freeze(v2);
    }
    return v2;
  };
  var distance2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  var sample = (p, v2, a, t) => {
    const point = {
      x: p.x + v2.x * t + 0.5 * a.x * t * t,
      y: p.y + v2.y * t + 0.5 * a.y * t * t,
      z: p.z + v2.z * t + 0.5 * a.z * t * t
    };
    const velocity = { x: v2.x + a.x * t, y: v2.y + a.y * t, z: v2.z + a.z * t };
    if (!vector4(point) || !vector4(velocity)) throw new Error("ball/base motion arithmetic overflow");
    return { point, velocity };
  };
  var roots = (a, b, c) => {
    if (![a, b, c].every(finite3)) throw new Error("ball/base feature arithmetic overflow");
    if (a === 0) return b === 0 ? [] : [-c / b];
    const maximum = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
    const scale12 = 2 ** Math.max(-1022, Math.min(1023, Math.floor(Math.log2(maximum))));
    a /= scale12;
    b /= scale12;
    c /= scale12;
    const d = b * b - 4 * a * c;
    if (!finite3(d)) throw new Error("ball/base root arithmetic overflow");
    if (d < 0) return [];
    if (d === 0) return [-b / (2 * a)];
    const q = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(d));
    return [q / a, c / q];
  };
  var scope = (raw, localDurationSeconds) => {
    const input = cloneInert(raw), m = input?.moment, b = m?.ball;
    if (!fields6(input, ["moment", "acceleration", "throughElapsedSeconds", "ticksPerSecond", "ballRadius", "bases", "previousBaseContacts"]) || !fields6(m, ["originTick", "elapsedSeconds", "ball"]) || !fields6(b, ["tick", "position", "velocity", "spin"]) || !tick4(m.originTick) || !finite3(m.elapsedSeconds) || m.elapsedSeconds < 0 || !tick4(b.tick) || !vector4(b.position) || !vector4(b.velocity) || !vector4(b.spin) || !vector4(input.acceleration) || !tick4(input.ticksPerSecond) || input.ticksPerSecond === 0 || !finite3(input.ballRadius) || input.ballRadius <= 0 || !finite3(input.throughElapsedSeconds) || input.throughElapsedSeconds < m.elapsedSeconds || quantizeEventTick(m.originTick, m.elapsedSeconds, input.ticksPerSecond) !== b.tick || !fields6(input.bases, baseIds2) || !Array.isArray(input.previousBaseContacts) || new Set(input.previousBaseContacts).size !== input.previousBaseContacts.length || input.previousBaseContacts.some((base) => !baseIds2.includes(base))) throw new Error("invalid actual ball/base boundary scope");
    quantizeEventTick(m.originTick, input.throughElapsedSeconds, input.ticksPerSecond);
    for (const prism of Object.values(input.bases)) {
      const r = prism?.region;
      if (!fields6(prism, ["region", "bottomY", "topY"]) || !fields6(r, ["center", "halfSize", "rotationRadians"]) || !fields6(r.center, ["x", "z"]) || !fields6(r.halfSize, ["x", "z"]) || ![r.center.x, r.center.z, r.halfSize.x, r.halfSize.z, r.rotationRadians, prism.bottomY, prism.topY].every(finite3) || r.halfSize.x <= 0 || r.halfSize.z <= 0 || prism.topY <= prism.bottomY) throw new Error("invalid actual ball/base prism");
      const extent = Math.hypot(r.halfSize.x, r.halfSize.z);
      if (![
        extent,
        r.center.x - extent,
        r.center.x + extent,
        r.center.z - extent,
        r.center.z + extent,
        prism.topY - prism.bottomY
      ].every(finite3)) throw new Error("ball/base prism arithmetic overflow");
    }
    const requestedDuration = input.throughElapsedSeconds - m.elapsedSeconds;
    if (localDurationSeconds !== void 0 && (!finite3(localDurationSeconds) || localDurationSeconds < 0 || localDurationSeconds > requestedDuration)) {
      throw new Error("invalid exact ball/base local duration");
    }
    const duration = localDurationSeconds ?? requestedDuration;
    sample(b.position, b.velocity, input.acceleration, duration);
    return { input, duration };
  };
  var localFrame = (prism) => {
    const c = Math.cos(prism.region.rotationRadians), s = Math.sin(prism.region.rotationRadians);
    const rotate = (v2) => ({ x: v2.x * c + v2.z * s, y: v2.y, z: -v2.x * s + v2.z * c });
    const toLocal = (p) => rotate({ x: p.x - prism.region.center.x, y: p.y, z: p.z - prism.region.center.z });
    const toWorld = (p) => ({
      x: prism.region.center.x + p.x * c - p.z * s,
      y: p.y,
      z: prism.region.center.z + p.x * s + p.z * c
    });
    const low = { x: -prism.region.halfSize.x, y: prism.bottomY, z: -prism.region.halfSize.z };
    const high = { x: prism.region.halfSize.x, y: prism.topY, z: prism.region.halfSize.z };
    const closest = (p) => ({
      x: Math.max(low.x, Math.min(high.x, p.x)),
      y: Math.max(low.y, Math.min(high.y, p.y)),
      z: Math.max(low.z, Math.min(high.z, p.z))
    });
    return { rotate, toLocal, toWorld, low, high, closest };
  };
  var baseTime = (ball, prism, duration, previous, piecewise = false) => {
    const contactSeconds = piecewise ? findPiecewiseAcceleratedSphereContactSeconds : findAcceleratedSphereContactSeconds;
    const blockedSeconds = piecewise ? findPiecewiseAcceleratedSphereBlockedDepartureSeconds : findAcceleratedSphereBlockedDepartureSeconds;
    const f = localFrame(prism), center = f.toLocal(ball.center), velocity = f.rotate(ball.velocity), acceleration = f.rotate(ball.acceleration);
    if (![center, velocity, acceleration].every(vector4)) throw new Error("ball/base local projection arithmetic overflow");
    const touching = distance2(center, f.closest(center)) <= ball.radius;
    if (!previous && touching) return { time: 0, continuing: false };
    if (duration === 0) return previous && touching ? { time: 0, continuing: true } : null;
    const changes = [0, duration, ...axes2.flatMap((axis) => [f.low[axis], f.high[axis]].flatMap((boundary) => roots(0.5 * acceleration[axis], velocity[axis], center[axis] - boundary)))];
    const boundaries = [...new Set(changes.filter((t) => finite3(t) && t >= 0 && t <= duration))].sort((a, b) => a - b);
    let departed = !previous || !touching;
    for (let index = 0; index + 1 < boundaries.length; index++) {
      const start = boundaries[index], end = boundaries[index + 1], middle = start + (end - start) / 2;
      const mid = sample(center, velocity, acceleration, middle).point, at2 = sample(center, velocity, acceleration, start);
      const moving = (axis) => mid[axis] > f.low[axis] && mid[axis] < f.high[axis];
      const component = (axis) => moving(axis) ? at2.point[axis] : mid[axis] <= f.low[axis] ? f.low[axis] : f.high[axis];
      const feature = {
        tick: ball.tick,
        radius: ball.radius / 2,
        center: { x: component("x"), y: component("y"), z: component("z") },
        velocity: { x: moving("x") ? at2.velocity.x : 0, y: moving("y") ? at2.velocity.y : 0, z: moving("z") ? at2.velocity.z : 0 },
        acceleration: { x: moving("x") ? acceleration.x : 0, y: moving("y") ? acceleration.y : 0, z: moving("z") ? acceleration.z : 0 }
      };
      const movingBall = { tick: ball.tick, radius: ball.radius / 2, center: at2.point, velocity: at2.velocity, acceleration };
      if (!departed && axes2.every((axis) => movingBall.velocity[axis] === feature.velocity[axis] && acceleration[axis] === feature.acceleration[axis]) && distance2(at2.point, feature.center) <= ball.radius) {
        return { time: start, continuing: true };
      }
      const blocked = departed ? null : blockedSeconds(movingBall, feature, end - start);
      if (blocked !== null) return { time: start + blocked, continuing: true };
      const outside = axes2.filter((axis) => !moving(axis));
      const faceAxis = outside.length === 1 ? outside[0] : null;
      let time;
      if (faceAxis) {
        const d = at2.point[faceAxis] - feature.center[faceAxis], v2 = at2.velocity[faceAxis], a = acceleration[faceAxis];
        const faceRoots = [ball.radius, -ball.radius].flatMap((r) => roots(0.5 * a, v2, d - r)).filter((t) => finite3(t) && t >= 0 && t <= end - start).sort((a2, b) => a2 - b);
        time = departed && Math.abs(d) <= ball.radius ? 0 : faceRoots.find((t) => {
          const separation = d + v2 * t + 0.5 * a * t * t, speed2 = v2 + a * t;
          return departed || t > 0 && (separation * speed2 < 0 || speed2 === 0 && separation * a > 0);
        }) ?? null;
      } else time = contactSeconds(movingBall, feature, end - start, departed ? "include" : "after_departure");
      if (time !== null) return { time: start + time, continuing: false };
      const endpoint = sample(center, velocity, acceleration, end).point;
      if (distance2(endpoint, f.closest(endpoint)) > ball.radius) departed = true;
    }
    return null;
  };
  var deriveBallWorldBaseBoundary = (raw, piecewise = false, preservePhysicalTime = false, localDurationSeconds) => {
    const { input, duration } = scope(raw, localDurationSeconds), initial = input.moment.ball;
    const sphere = {
      tick: input.moment.originTick,
      center: initial.position,
      velocity: initial.velocity,
      acceleration: input.acceleration,
      radius: input.ballRadius
    };
    const contacts = [];
    for (const baseId of baseIds2) {
      const prism = input.bases[baseId], event = baseTime(sphere, prism, duration, input.previousBaseContacts.includes(baseId), piecewise);
      if (!event) continue;
      const state = sample(initial.position, initial.velocity, input.acceleration, event.time);
      const elapsedSeconds = !preservePhysicalTime && event.time === duration ? input.throughElapsedSeconds : input.moment.elapsedSeconds + event.time;
      const moment = { ...input.moment, elapsedSeconds, ball: {
        ...initial,
        tick: quantizeEventTick(input.moment.originTick, elapsedSeconds, input.ticksPerSecond),
        position: state.point,
        velocity: state.velocity
      } };
      const f = localFrame(prism), point = f.toWorld(f.closest(f.toLocal(state.point))), length = distance2(state.point, point);
      if (!vector4(point) || !finite3(length)) throw new Error("ball/base contact arithmetic overflow");
      const normal4 = length === 0 ? null : {
        x: (state.point.x - point.x) / length,
        y: (state.point.y - point.y) / length,
        z: (state.point.z - point.z) / length
      };
      contacts.push({ kind: "base", baseId, moment, point, normal: normal4, ...event.continuing ? { continuing: true } : {} });
    }
    if (!contacts.length) return null;
    const earliest = contacts.reduce((a, b) => a.elapsedSeconds <= b.moment.elapsedSeconds ? a : b.moment, contacts[0].moment);
    return freeze8({ moment: earliest, contacts: contacts.filter((contact) => contact.moment.elapsedSeconds === earliest.elapsedSeconds).sort((a, b) => a.baseId < b.baseId ? -1 : a.baseId > b.baseId ? 1 : 0) });
  };
  var findBallWorldBaseBoundary = (raw) => deriveBallWorldBaseBoundary(raw);
  var findPiecewiseBallWorldBaseBoundary = (raw) => deriveBallWorldBaseBoundary(raw, true);
  var findExactBallWorldBaseBoundaryCandidatesV1 = (raw, localDurationSeconds) => deriveBallWorldBaseBoundary(raw, true, true, localDurationSeconds);

  // src/core/sim/ball/BallWorldContinuation.ts
  var finite4 = (v2) => typeof v2 === "number" && Number.isFinite(v2);
  var tick5 = (v2) => typeof v2 === "number" && Number.isSafeInteger(v2) && v2 >= 0;
  var id4 = (v2) => typeof v2 === "string" && v2.length > 0 && v2 === v2.trim();
  var vector5 = (v2) => v2 && [v2.x, v2.y, v2.z].every(finite4);
  var unit2 = (v2) => finite4(v2) && v2 >= 0 && v2 <= 1;
  var freeze9 = (v2) => {
    if (v2 && typeof v2 === "object") {
      Object.values(v2).forEach(freeze9);
      Object.freeze(v2);
    }
    return v2;
  };
  var ballWorldFreeMotionCurve = (initial, p) => {
    if (!initial || !p || !vector5(initial.position) || !vector5(initial.velocity) || !finite4(p.ballRadius) || p.ballRadius <= 0 || !finite4(p.gravityY) || !finite4(p.groundRollingDecelerationMps2) || p.groundRollingDecelerationMps2 < 0 || initial.position.y < p.ballRadius - 1e-12) throw new Error("invalid ball World free motion basis");
    const speed2 = Math.hypot(initial.velocity.x, initial.velocity.z), onFloor = initial.position.y <= p.ballRadius + 1e-12 && initial.velocity.y === 0;
    if (!finite4(speed2)) throw new Error("ball World speed arithmetic overflow");
    const phase = onFloor ? speed2 === 0 ? "resting" : "rolling" : "airborne";
    const acceleration = onFloor ? {
      x: speed2 === 0 ? 0 : -initial.velocity.x / speed2 * p.groundRollingDecelerationMps2,
      y: 0,
      z: speed2 === 0 ? 0 : -initial.velocity.z / speed2 * p.groundRollingDecelerationMps2
    } : { x: 0, y: p.gravityY, z: 0 };
    return { phase, acceleration, rollingStopAfterSeconds: phase === "rolling" && p.groundRollingDecelerationMps2 > 0 ? speed2 / p.groundRollingDecelerationMps2 : null };
  };
  var distance3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  var colliderKey = (c) => JSON.stringify(c.kind === "actor" ? [c.kind, c.playerId, c.role] : [c.kind, c.surfaceId]);
  var normal2 = (a, b) => {
    const length = distance3(a, b);
    if (!finite4(length)) throw new Error("ball World normal arithmetic overflow");
    return length === 0 ? null : { x: (a.x - b.x) / length, y: (a.y - b.y) / length, z: (a.z - b.z) / length };
  };
  var sample2 = (position, velocity, acceleration, seconds) => {
    const point = {
      x: position.x + velocity.x * seconds + 0.5 * acceleration.x * seconds * seconds,
      y: position.y + velocity.y * seconds + 0.5 * acceleration.y * seconds * seconds,
      z: position.z + velocity.z * seconds + 0.5 * acceleration.z * seconds * seconds
    };
    const motion = { x: velocity.x + acceleration.x * seconds, y: velocity.y + acceleration.y * seconds, z: velocity.z + acceleration.z * seconds };
    if (!vector5(point) || !vector5(motion)) throw new Error("ball World motion arithmetic overflow");
    return { point, motion };
  };
  var roots2 = (a, b, c) => {
    if (![a, b, c].every(finite4)) throw new Error("ball World boundary arithmetic overflow");
    if (a === 0) return b === 0 ? [] : [-c / b];
    const discriminant = b * b - 4 * a * c;
    if (!finite4(discriminant)) throw new Error("ball World root arithmetic overflow");
    if (discriminant < 0) return [];
    if (discriminant === 0) return [-b / (2 * a)];
    const q = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(discriminant));
    return [q / a, c / q].sort((x, y) => x - y);
  };
  var axialSphereTime = (first, second, duration, previous) => {
    const axes5 = ["x", "y", "z"];
    const nonzero = axes5.filter((axis2) => first.center[axis2] !== second.center[axis2] || first.velocity[axis2] !== second.velocity[axis2] || first.acceleration[axis2] !== second.acceleration[axis2]);
    if (nonzero.length !== 1) return void 0;
    const axis = nonzero[0], d = first.center[axis] - second.center[axis], v2 = first.velocity[axis] - second.velocity[axis], a = first.acceleration[axis] - second.acceleration[axis], radius = first.radius + second.radius;
    if (![d, v2, a, radius].every(finite4)) throw new Error("ball field axial contact arithmetic overflow");
    const separated = Math.abs(d) > radius;
    if (!previous && !separated) return 0;
    return [radius, -radius].flatMap((r) => roots2(0.5 * a, v2, d - r)).filter((t) => finite4(t) && t >= 0 && t <= duration).sort((a2, b) => a2 - b).find((t) => {
      const separation = d + v2 * t + 0.5 * a * t * t, speed2 = v2 + a * t;
      return separated || t > 0 && (separation * speed2 < 0 || speed2 === 0 && separation * a > 0);
    }) ?? null;
  };
  var frame = (s) => {
    if (!id4(s?.surfaceId) || !s.start || !s.end || ![s.start.x, s.start.z, s.end.x, s.end.z, s.minimumHeight, s.maximumHeight].every(finite4) || s.minimumHeight < 0 || s.maximumHeight <= s.minimumHeight) throw new Error("invalid ball World surface");
    const length = Math.hypot(s.end.x - s.start.x, s.end.z - s.start.z);
    if (!finite4(length) || length <= 0) throw new Error("invalid ball World surface extent");
    return { length, ux: (s.end.x - s.start.x) / length, uz: (s.end.z - s.start.z) / length };
  };
  var closestPoint = (s, p) => {
    const f = frame(s), u = Math.max(0, Math.min(f.length, (p.x - s.start.x) * f.ux + (p.z - s.start.z) * f.uz));
    return { x: s.start.x + u * f.ux, y: Math.max(s.minimumHeight, Math.min(s.maximumHeight, p.y)), z: s.start.z + u * f.uz };
  };
  var surfaceTime = (ball, s, seconds, previous, exactFieldFace = false, piecewise = false) => {
    const contactSeconds = piecewise ? findPiecewiseAcceleratedSphereContactSeconds : findAcceleratedSphereContactSeconds;
    const blockedSeconds = piecewise ? findPiecewiseAcceleratedSphereBlockedDepartureSeconds : findAcceleratedSphereBlockedDepartureSeconds;
    const f = frame(s), u0 = (ball.center.x - s.start.x) * f.ux + (ball.center.z - s.start.z) * f.uz;
    const uv = ball.velocity.x * f.ux + ball.velocity.z * f.uz, ua = ball.acceleration.x * f.ux + ball.acceleration.z * f.uz;
    if (![u0, uv, ua].every(finite4)) throw new Error("ball World surface projection arithmetic overflow");
    if (!previous && distance3(ball.center, closestPoint(s, ball.center)) <= ball.radius) return { time: 0, blocked: false };
    const changes = [
      0,
      seconds,
      ...[0, f.length].flatMap((u) => roots2(0.5 * ua, uv, u0 - u)),
      ...[s.minimumHeight, s.maximumHeight].flatMap((y) => roots2(0.5 * ball.acceleration.y, ball.velocity.y, ball.center.y - y))
    ];
    const boundaries = [...new Set(changes.filter((t) => finite4(t) && t >= 0 && t <= seconds))].sort((a, b) => a - b);
    let departed = !previous || distance3(ball.center, closestPoint(s, ball.center)) > ball.radius;
    for (let i = 0; i + 1 < boundaries.length; i++) {
      const start = boundaries[i], end = boundaries[i + 1], middle = (start + end) / 2;
      const mid = sample2(ball.center, ball.velocity, ball.acceleration, middle).point;
      const midU = u0 + uv * middle + 0.5 * ua * middle * middle;
      const movingU = midU > 0 && midU < f.length, movingY = mid.y > s.minimumHeight && mid.y < s.maximumHeight;
      const actual = sample2(ball.center, ball.velocity, ball.acceleration, start);
      const u = movingU ? u0 + uv * start + 0.5 * ua * start * start : midU <= 0 ? 0 : f.length;
      const feature = {
        tick: ball.tick,
        radius: ball.radius / 2,
        center: {
          x: s.start.x + f.ux * u,
          y: movingY ? actual.point.y : mid.y <= s.minimumHeight ? s.minimumHeight : s.maximumHeight,
          z: s.start.z + f.uz * u
        },
        velocity: { x: movingU ? f.ux * (uv + ua * start) : 0, y: movingY ? actual.motion.y : 0, z: movingU ? f.uz * (uv + ua * start) : 0 },
        acceleration: { x: movingU ? f.ux * ua : 0, y: movingY ? ball.acceleration.y : 0, z: movingU ? f.uz * ua : 0 }
      };
      const movingBall = { ...ball, center: actual.point, velocity: actual.motion, radius: ball.radius / 2 };
      const blocked = departed ? null : blockedSeconds(movingBall, feature, end - start);
      if (blocked !== null) return { time: start + blocked, blocked: true };
      const signed = exactFieldFace && movingU && movingY ? axialSphereTime(
        {
          ...movingBall,
          center: { x: f.uz * (actual.point.x - s.start.x) - f.ux * (actual.point.z - s.start.z), y: 0, z: 0 },
          velocity: { x: f.uz * actual.motion.x - f.ux * actual.motion.z, y: 0, z: 0 },
          acceleration: { x: f.uz * ball.acceleration.x - f.ux * ball.acceleration.z, y: 0, z: 0 }
        },
        { ...feature, center: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } },
        end - start,
        !departed
      ) : void 0;
      const at2 = signed === void 0 ? contactSeconds(
        movingBall,
        feature,
        end - start,
        departed ? "include" : "after_departure"
      ) : signed;
      if (at2 !== null) return { time: start + at2, blocked: false };
      const point = sample2(ball.center, ball.velocity, ball.acceleration, end).point;
      if (distance3(point, closestPoint(s, point)) > ball.radius) departed = true;
    }
    return null;
  };
  var deriveWorldSegment = (raw, constrained, bases, jointPlayerId, exactThroughElapsedSeconds) => {
    const piecewise = jointPlayerId !== void 0 || exactThroughElapsedSeconds !== void 0;
    const contactSeconds = piecewise ? findPiecewiseAcceleratedSphereContactSeconds : findAcceleratedSphereContactSeconds;
    const blockedSeconds = piecewise ? findPiecewiseAcceleratedSphereBlockedDepartureSeconds : findAcceleratedSphereBlockedDepartureSeconds;
    const baseBoundary = exactThroughElapsedSeconds !== void 0 ? findExactBallWorldBaseBoundaryCandidatesV1 : piecewise ? findPiecewiseBallWorldBaseBoundary : findBallWorldBaseBoundary;
    const input = cloneInert(raw), { moment, parameters: p } = input, initial = moment?.ball;
    if (!moment || !initial || !p || !tick5(moment.originTick) || !finite4(moment.elapsedSeconds) || moment.elapsedSeconds < 0 || !tick5(initial.tick) || !tick5(input.throughTick) || input.throughTick < initial.tick || !vector5(initial.position) || !vector5(initial.velocity) || !vector5(initial.spin) || !tick5(p.ticksPerSecond) || p.ticksPerSecond === 0 || !finite4(p.gravityY) || !finite4(p.ballRadius) || p.ballRadius <= 0 || !unit2(p.groundRestitution) || !unit2(p.groundFriction) || !finite4(p.groundRollingDecelerationMps2) || p.groundRollingDecelerationMps2 < 0 || !finite4(p.restingVerticalSpeed) || p.restingVerticalSpeed < 0 || !tick5(p.integrationStepTicks) || p.integrationStepTicks === 0 || initial.position.y < p.ballRadius - 1e-12 || quantizeEventTick(moment.originTick, moment.elapsedSeconds, p.ticksPerSecond) !== initial.tick || !Array.isArray(input.actors) || !Array.isArray(input.surfaces) || !Array.isArray(input.previousContacts)) throw new Error("invalid ball World continuation");
    if (constrained && (!vector5(constrained.acceleration) || !finite4(constrained.throughElapsedSeconds) || constrained.throughElapsedSeconds < moment.elapsedSeconds)) throw new Error("invalid accelerated ball World interval");
    if (exactThroughElapsedSeconds !== void 0 && (!finite4(exactThroughElapsedSeconds) || exactThroughElapsedSeconds < moment.elapsedSeconds)) throw new Error("invalid exact ball World interval");
    const actorKeys = /* @__PURE__ */ new Set(), surfaceIds = /* @__PURE__ */ new Set();
    for (const a of input.actors) {
      const s = a?.primitive, key3 = JSON.stringify([a?.playerId, s?.role]);
      if (!id4(a?.playerId) || !s || actorKeys.has(key3) || !["glove", "body", "tag_hand", "left_foot", "right_foot"].includes(s.role) || !tick5(s.startTick) || !tick5(s.endTick) || s.startTick > initial.tick || s.endTick < input.throughTick || s.ticksPerSecond !== p.ticksPerSecond || !finite4(s.radius) || s.radius <= 0 || !vector5(s.startCenter) || !vector5(s.startVelocity) || !vector5(s.acceleration) || a.startElapsedSeconds !== void 0 && (!finite4(a.startElapsedSeconds) || a.startElapsedSeconds < 0)) throw new Error("invalid ball World actor coverage");
      const currentSeconds = (moment.originTick - s.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (a.startElapsedSeconds ?? 0);
      if (currentSeconds < 0) throw new Error("ball World actor starts after the continuous moment");
      sample2(s.startCenter, s.startVelocity, s.acceleration, currentSeconds);
      if (exactThroughElapsedSeconds !== void 0 && exactThroughElapsedSeconds > (s.endTick - moment.originTick) / p.ticksPerSecond) {
        throw new Error("exact ball World actor coverage is exhausted");
      }
      const endSeconds = exactThroughElapsedSeconds === void 0 ? (input.throughTick - s.startTick) / p.ticksPerSecond - (a.startElapsedSeconds ?? 0) : (moment.originTick - s.startTick) / p.ticksPerSecond + exactThroughElapsedSeconds - (a.startElapsedSeconds ?? 0);
      sample2(s.startCenter, s.startVelocity, s.acceleration, endSeconds);
      actorKeys.add(key3);
    }
    for (const s of input.surfaces) {
      frame(s);
      if (surfaceIds.has(s.surfaceId)) throw new Error("duplicate ball World surface");
      surfaceIds.add(s.surfaceId);
    }
    const prior = /* @__PURE__ */ new Set();
    for (const c of input.previousContacts) {
      const key3 = c?.kind === "actor" ? JSON.stringify([c.playerId, c.role]) : c?.kind === "surface" ? c.surfaceId : "";
      if (!key3 || prior.has(colliderKey(c)) || (c.kind === "actor" ? !actorKeys.has(key3) : !surfaceIds.has(key3))) throw new Error("invalid prior ball World collider");
      prior.add(colliderKey(c));
    }
    const free = ballWorldFreeMotionCurve(initial, p);
    const phase = constrained ? "airborne" : free.phase;
    const acceleration = constrained?.acceleration ?? free.acceleration;
    const duration = exactThroughElapsedSeconds !== void 0 ? exactThroughElapsedSeconds - moment.elapsedSeconds : constrained ? constrained.throughElapsedSeconds - moment.elapsedSeconds : Math.max(0, (input.throughTick - moment.originTick) / p.ticksPerSecond - moment.elapsedSeconds);
    const ground = phase !== "airborne" ? null : initial.position.y <= p.ballRadius + 1e-12 && (initial.velocity.y < 0 || constrained && initial.velocity.y === 0 && acceleration.y < 0) ? 0 : roots2(0.5 * acceleration.y, initial.velocity.y, initial.position.y - p.ballRadius).find((t) => t > 0 && t <= duration && (initial.velocity.y + acceleration.y * t < 0 || constrained && acceleration.y > 0 && t === -initial.velocity.y / acceleration.y)) ?? null;
    const stop = phase === "rolling" && free.rollingStopAfterSeconds !== null && free.rollingStopAfterSeconds <= duration ? free.rollingStopAfterSeconds : null;
    const horizon = Math.min(duration, ground ?? duration, stop ?? duration);
    const atMoment = (seconds) => {
      const state = sample2(initial.position, initial.velocity, acceleration, seconds), elapsedSeconds = moment.elapsedSeconds + seconds;
      const stopped = stop !== null && seconds === stop;
      return { originTick: moment.originTick, elapsedSeconds, ball: {
        tick: quantizeEventTick(moment.originTick, elapsedSeconds, p.ticksPerSecond),
        position: state.point,
        velocity: stopped ? { x: 0, y: 0, z: 0 } : state.motion,
        spin: initial.spin
      } };
    };
    const contacts = [];
    const blockedContacts = /* @__PURE__ */ new Set();
    if (bases) {
      const baseInput = {
        moment,
        acceleration,
        throughElapsedSeconds: exactThroughElapsedSeconds ?? moment.elapsedSeconds + horizon,
        ticksPerSecond: p.ticksPerSecond,
        ballRadius: p.ballRadius,
        ...bases
      };
      const boundary = exactThroughElapsedSeconds === void 0 ? baseBoundary(baseInput) : findExactBallWorldBaseBoundaryCandidatesV1(baseInput, horizon);
      for (const contact of boundary?.contacts ?? []) {
        contacts.push(contact);
        if (contact.continuing) blockedContacts.add(contact);
      }
    }
    if (ground !== null) contacts.push({ kind: "ground", moment: atMoment(ground) });
    if (stop !== null) contacts.push({ kind: "rolling_stop", moment: atMoment(stop) });
    const sphere = { tick: moment.originTick, center: initial.position, velocity: initial.velocity, acceleration, radius: p.ballRadius };
    for (const a of input.actors) {
      if (a.playerId === jointPlayerId && a.primitive.role === "glove") continue;
      const s = a.primitive, dt = (moment.originTick - s.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (a.startElapsedSeconds ?? 0);
      const start = sample2(s.startCenter, s.startVelocity, s.acceleration, dt);
      const previous = prior.has(colliderKey({ kind: "actor", playerId: a.playerId, role: s.role }));
      const other = { tick: moment.originTick, center: start.point, velocity: start.motion, acceleration: s.acceleration, radius: s.radius };
      const blocked = previous ? blockedSeconds(sphere, other, horizon) : null;
      const axial = bases && blocked === null ? axialSphereTime(sphere, other, horizon, previous) : void 0;
      const time = blocked ?? (axial === void 0 ? contactSeconds(sphere, other, horizon, previous ? "after_departure" : "include") : axial);
      if (time === null) continue;
      const state = sample2(start.point, start.motion, s.acceleration, time), at2 = atMoment(time);
      const contact = {
        kind: "actor",
        playerId: a.playerId,
        role: s.role,
        moment: at2,
        center: state.point,
        velocity: state.motion,
        normal: normal2(at2.ball.position, state.point),
        ...blocked === null ? {} : { continuing: true }
      };
      contacts.push(contact);
      if (blocked !== null) blockedContacts.add(contact);
    }
    for (const s of input.surfaces) {
      const event = surfaceTime(sphere, s, horizon, prior.has(colliderKey({ kind: "surface", surfaceId: s.surfaceId })), bases !== void 0, piecewise);
      if (event === null) continue;
      const at2 = atMoment(event.time), point = closestPoint(s, at2.ball.position);
      const contact = {
        kind: "surface",
        surfaceId: s.surfaceId,
        moment: at2,
        point,
        normal: normal2(at2.ball.position, point),
        ...event.blocked ? { continuing: true } : {}
      };
      contacts.push(contact);
      if (event.blocked) blockedContacts.add(contact);
    }
    if (!contacts.length) {
      const endpoint = atMoment(duration);
      const end = exactThroughElapsedSeconds === void 0 ? endpoint : {
        ...endpoint,
        elapsedSeconds: exactThroughElapsedSeconds,
        ball: { ...endpoint.ball, tick: input.throughTick }
      };
      return freeze9({ kind: phase === "resting" ? "resting" : "moving", throughTick: input.throughTick, phase, moment: end });
    }
    const earliestTick = Math.min(...contacts.map((c) => c.moment.ball.tick));
    const earliestTime = Math.min(...contacts.map((c) => c.moment.elapsedSeconds));
    if (exactThroughElapsedSeconds !== void 0 && earliestTime > exactThroughElapsedSeconds) {
      throw new Error("exact ball World boundary exceeds requested horizon");
    }
    const selected = contacts.filter((c) => bases ? c.moment.elapsedSeconds === earliestTime : c.moment.ball.tick === earliestTick);
    const earliest = selected.reduce((a, b) => a.elapsedSeconds <= b.moment.elapsedSeconds ? a : b.moment, selected[0].moment);
    if (bases) {
      const previous = baseBoundary({
        moment: earliest,
        acceleration,
        throughElapsedSeconds: earliest.elapsedSeconds,
        ticksPerSecond: p.ticksPerSecond,
        ballRadius: p.ballRadius,
        ...bases
      });
      for (const contact of previous?.contacts ?? []) {
        if (!contact.continuing || selected.some((c) => c.kind === "base" && c.baseId === contact.baseId)) continue;
        selected.push(contact);
        blockedContacts.add(contact);
      }
    }
    for (const c of input.previousContacts) {
      if (selected.some((s) => (s.kind === "actor" || s.kind === "surface") && colliderKey(s) === colliderKey(c))) continue;
      if (c.kind === "surface") {
        const surface = input.surfaces.find((s) => s.surfaceId === c.surfaceId), point = closestPoint(surface, earliest.ball.position);
        if (distance3(point, earliest.ball.position) <= p.ballRadius) selected.push({
          kind: "surface",
          surfaceId: c.surfaceId,
          moment: earliest,
          point,
          normal: normal2(earliest.ball.position, point),
          continuing: true
        });
      } else {
        const actor = input.actors.find((a) => a.playerId === c.playerId && a.primitive.role === c.role), s = actor.primitive;
        const state = sample2(
          s.startCenter,
          s.startVelocity,
          s.acceleration,
          (moment.originTick - s.startTick) / p.ticksPerSecond + earliest.elapsedSeconds - (actor.startElapsedSeconds ?? 0)
        );
        if (c.playerId === jointPlayerId && c.role === "glove" || distance3(state.point, earliest.ball.position) <= p.ballRadius + s.radius) selected.push({
          kind: "actor",
          playerId: c.playerId,
          role: c.role,
          moment: earliest,
          center: state.point,
          velocity: state.motion,
          normal: normal2(earliest.ball.position, state.point),
          continuing: true
        });
      }
    }
    selected.sort((a, b) => {
      const key3 = (c) => JSON.stringify(c.kind === "actor" ? [c.kind, c.playerId, c.role] : c.kind === "surface" ? [c.kind, c.surfaceId] : c.kind === "base" ? [c.kind, c.baseId] : [c.kind]);
      return key3(a) < key3(b) ? -1 : key3(a) > key3(b) ? 1 : 0;
    });
    return freeze9({
      kind: "boundary",
      phase,
      contacts: selected,
      moment: earliest,
      ...selected.some((c) => blockedContacts.has(c)) ? { pendingReason: "persistent_contact" } : {}
    });
  };
  var deriveBallWorldContinuation = (raw) => {
    if (!Object.hasOwn(raw, "sourceCurve")) return deriveWorldSegment(raw);
    const input = cloneInert(raw), { moment, parameters: p, sourceCurve } = input;
    if (sourceCurve === void 0) return deriveWorldSegment(input);
    if (!tick5(input.throughTick) || input.throughTick < moment.ball.tick || !sourceCurve || p.ticksPerSecond !== sourceCurve.profile.air.ticksPerSecond || p.integrationStepTicks !== sourceCurve.profile.air.integrationStepTicks || p.gravityY !== sourceCurve.profile.air.gravityY || p.ballRadius !== sourceCurve.profile.ground.radiusM) throw new Error("nonlinear continuation Source clock differs");
    const throughElapsedSeconds = Math.max(moment.elapsedSeconds, (input.throughTick - moment.originTick) / p.ticksPerSecond);
    const result = querySourceFreeBallWorldV2({
      descriptor: sourceCurve,
      moment,
      side: "outgoing",
      throughElapsedSeconds,
      actors: input.actors,
      surfaces: input.surfaces,
      previousContacts: input.previousContacts
    });
    if (result.kind === "unresolved") throw new Error("nonlinear World continuation requires numerical refinement");
    return result.kind === "boundary" ? freeze9({
      kind: "boundary",
      moment: result.moment,
      phase: result.phase,
      contacts: result.contacts,
      ...result.pendingReason ? { pendingReason: result.pendingReason } : {}
    }) : freeze9({ kind: result.kind, moment: result.moment, phase: result.phase, throughTick: input.throughTick });
  };

  // src/core/sim/ball/BattedWorldContinuation.ts
  var freeze10 = (v2) => {
    if (v2 && typeof v2 === "object") {
      Object.values(v2).forEach(freeze10);
      Object.freeze(v2);
    }
    return v2;
  };
  var key = (c) => JSON.stringify(c.kind === "actor" ? [c.kind, c.playerId, c.role] : [c.kind, c.surfaceId]);
  var addCollider = (previous, contact) => previous.some((c) => key(c) === key(contact)) ? previous : [...previous, contact];
  var json3 = (v2) => JSON.stringify(v2, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
  var withImpulseBasis = (prior, moment, previousContacts) => ({
    moment,
    previousContacts,
    ...prior.sourceCurve ? { sourceCurve: { ...prior.sourceCurve, initial: moment } } : {},
    ...prior.sourceSide ? { sourceSide: "outgoing" } : {}
  });
  var respondToBallWorldBoundary = (input, prior, world) => {
    if (world.kind !== "boundary") return { kind: world.kind, cursor: {
      ...prior,
      moment: world.moment,
      ...prior.sourceSide ? { sourceSide: "outgoing" } : {}
    } };
    if (world.pendingReason) return { kind: "unresolved", cursor: null, reason: world.pendingReason };
    if (world.contacts.length !== 1) return { kind: "unresolved", cursor: null, reason: "simultaneous" };
    const c = world.contacts[0], moment = c.moment;
    if (c.kind === "rolling_stop") return { kind: "rolling_stop", cursor: { ...prior, moment } };
    if (c.kind === "ground") {
      if (prior.sourceCurve) {
        const kernel = createSourceFreeBallKernel(prior.sourceCurve);
        if (json3(kernel.evaluateAt(moment.elapsedSeconds, "incoming").moment) !== json3(moment)) throw new Error("nonlinear ground response incoming Source differs");
        return { kind: "ground", cursor: {
          ...prior,
          moment: kernel.evaluateAt(moment.elapsedSeconds, "outgoing").moment,
          ...prior.sourceSide ? { sourceSide: "outgoing" } : {}
        } };
      }
      return { kind: "ground", cursor: { ...prior, moment: { ...moment, ball: respondToGroundContact(moment.ball, input.world.parameters) } } };
    }
    if (!c.normal) return { kind: "unresolved", cursor: null, reason: "degenerate_normal" };
    const collider = c.kind === "actor" ? { kind: c.kind, playerId: c.playerId, role: c.role } : { kind: c.kind, surfaceId: c.surfaceId };
    const previousContacts = addCollider(prior.previousContacts, collider);
    if (c.kind === "actor") {
      const profile = input.actors.find((a) => a.playerId === c.playerId && a.profile.role === c.role).profile;
      if (profile.role === "glove") {
        const pocket = {
          x: c.center.x + profile.pocketCenterOffset.x,
          y: c.center.y + profile.pocketCenterOffset.y,
          z: c.center.z + profile.pocketCenterOffset.z
        };
        const retention = resolveCatchRetention({
          contactTick: moment.ball.tick,
          ball: moment.ball,
          glove: { tick: moment.ball.tick, position: c.center, velocity: c.velocity },
          contactNormal: c.normal,
          bodyStability: profile.bodyStability,
          pocketOffsetMeters: Math.hypot(moment.ball.position.x - pocket.x, moment.ball.position.y - pocket.y, moment.ball.position.z - pocket.z)
        }, profile.parameters);
        return retention.outcome.kind === "secured" ? { kind: "capture_candidate", cursor: null, moment, retention } : { kind: "rebound", retention, cursor: withImpulseBasis(prior, { ...moment, ball: retention.outcome.ball }, previousContacts) };
      }
      return { kind: "rebound", cursor: withImpulseBasis(prior, { ...moment, ball: respondToBallContact({
        ball: moment.ball,
        normal: c.normal,
        surfaceVelocity: c.velocity,
        material: profile.material
      }) }, previousContacts) };
    }
    const material2 = input.surfaces.find((s) => s.surfaceId === c.surfaceId).material;
    return { kind: "rebound", cursor: withImpulseBasis(prior, { ...moment, ball: respondToBallContact({
      ball: moment.ball,
      normal: c.normal,
      surfaceVelocity: { x: 0, y: 0, z: 0 },
      material: material2
    }) }, previousContacts) };
  };
  var respondToBattedWorldBoundary = respondToBallWorldBoundary;
  var deriveBattedWorldContinuation = (raw) => {
    const input = cloneInert(raw);
    if (!input || !Array.isArray(input.throughTicks)) throw new Error("invalid batted World continuation requests");
    const original = deriveBattedBallContactResponse(input.response), p = input.response.world.parameters;
    const originTick = input.response.world.flight.initialBall.tick;
    let cursor;
    if (original.kind === "unresolved" || original.kind === "capture_candidate") cursor = null;
    else if (original.kind === "rebound") {
      const c = original.geometry.contact;
      const moment = { originTick, elapsedSeconds: original.geometry.elapsedSeconds, ball: original.ball };
      cursor = {
        moment,
        previousContacts: [c.kind === "actor" ? { kind: "actor", playerId: c.playerId, role: c.role } : { kind: "surface", surfaceId: c.surfaceId }],
        ...input.response.world.sourceCurve ? { sourceCurve: { ...input.response.world.sourceCurve, initial: moment } } : {}
      };
    } else if (input.response.world.sourceCurve) {
      const sourceCurve = input.response.world.sourceCurve, incoming = original.world.sourceMoment;
      if (!incoming || json3(incoming.ball) !== json3(original.ball)) throw new Error("nonlinear original response Source moment differs");
      const kernel = createSourceFreeBallKernel(sourceCurve);
      if (json3(kernel.evaluateAt(incoming.elapsedSeconds, "incoming").moment) !== json3(incoming)) throw new Error("nonlinear original response root differs");
      cursor = {
        moment: original.kind === "ground" ? kernel.evaluateAt(incoming.elapsedSeconds, "outgoing").moment : incoming,
        previousContacts: [],
        sourceCurve
      };
    } else cursor = { moment: {
      originTick,
      elapsedSeconds: (original.ball.tick - originTick) / p.ticksPerSecond,
      ball: original.kind === "ground" ? respondToGroundContact(original.ball, p) : original.ball
    }, previousContacts: [] };
    const initialCursor = cursor, steps = [];
    for (const throughTick of input.throughTicks) {
      if (!cursor) throw new Error("batted World acquisition or unresolved contact is pending");
      if (cursor.sourceCurve) cursor = { ...cursor, sourceCurve: {
        ...cursor.sourceCurve,
        throughElapsedSeconds: Math.max(cursor.sourceCurve.throughElapsedSeconds, (throughTick - originTick) / p.ticksPerSecond)
      } };
      const world = deriveBallWorldContinuation({
        moment: cursor.moment,
        previousContacts: cursor.previousContacts,
        parameters: p,
        throughTick,
        actors: input.response.world.actors,
        surfaces: input.response.world.surfaces,
        ...cursor.sourceCurve ? { sourceCurve: cursor.sourceCurve } : {}
      });
      if (world.kind !== "boundary" && world.moment.elapsedSeconds <= cursor.moment.elapsedSeconds) throw new Error("batted World continuation makes no actual progress");
      const response = respondToBattedWorldBoundary(input.response, cursor, world);
      steps.push({ throughTick, world, response });
      cursor = response.cursor;
    }
    return freeze10({ original, initialCursor, steps, cursor });
  };

  // src/core/sim/ball/SourceBattedWorldContinuationV3.ts
  var json4 = (v2) => JSON.stringify(v2, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
  var freeze11 = (v2) => {
    if (v2 && typeof v2 === "object") {
      Object.values(v2).forEach(freeze11);
      Object.freeze(v2);
    }
    return v2;
  };
  var deriveSourceBattedWorldContinuationV3 = (raw) => {
    const input = cloneInert(raw), curve = input.response?.world?.sourceCurve;
    if (!curve || !Array.isArray(input.throughTicks)) throw new Error("v3 continuation requires an explicit original Source kernel");
    const base = deriveBattedWorldContinuation({ response: input.response, throughTicks: [] }), session = createSourceImpactEscapeSessionV3();
    const certificates = [], advances = [];
    let cursor = base.initialCursor;
    if (base.original.kind === "rebound") {
      const observed = session.query({
        descriptor: curve,
        moment: curve.initial,
        side: "incoming",
        throughElapsedSeconds: curve.throughElapsedSeconds,
        actors: input.response.world.actors,
        surfaces: input.response.world.surfaces
      });
      if (observed.kind !== "boundary" || json4(observed.moment.ball) !== json4(base.original.geometry.ball) || observed.moment.elapsedSeconds !== base.original.geometry.elapsedSeconds || !cursor?.sourceCurve) {
        throw new Error("v3 original response query differs from its own physical root");
      }
      certificates.push({ afterStepIndex: -1, diagnostic: session.adoptImpulse(observed, input.response, cursor.sourceCurve) });
    }
    const steps = [], p = curve.profile.air.ticksPerSecond;
    for (const [stepIndex, throughTick] of input.throughTicks.entries()) {
      if (!cursor?.sourceCurve) throw new Error("v3 acquisition or unresolved contact is pending");
      if (!Number.isSafeInteger(throughTick) || throughTick < cursor.moment.ball.tick) throw new Error("invalid v3 continuation horizon");
      const throughElapsedSeconds = Math.max(cursor.moment.elapsedSeconds, (throughTick - cursor.moment.originTick) / p);
      const prior = { ...cursor, sourceCurve: {
        ...cursor.sourceCurve,
        throughElapsedSeconds: Math.max(cursor.sourceCurve.throughElapsedSeconds, throughElapsedSeconds)
      } };
      const advanceCount = session.advances().length;
      const queried = session.query({
        descriptor: prior.sourceCurve,
        moment: prior.moment,
        side: "outgoing",
        throughElapsedSeconds,
        actors: input.response.world.actors,
        surfaces: input.response.world.surfaces,
        previousContacts: prior.previousContacts
      });
      if (queried.kind === "unresolved") throw new Error("v3 continuation requires numerical contact refinement");
      const world = queried.kind === "boundary" ? {
        kind: "boundary",
        moment: queried.moment,
        phase: queried.phase,
        contacts: queried.contacts,
        ...queried.pendingReason ? { pendingReason: queried.pendingReason } : {}
      } : { kind: queried.kind, moment: queried.moment, phase: queried.phase, throughTick };
      if (world.kind !== "boundary" && world.moment.elapsedSeconds <= prior.moment.elapsedSeconds) throw new Error("v3 continuation makes no physical progress");
      const response = respondToBallWorldBoundary(input.response, prior, world);
      steps.push({ throughTick, world, response });
      for (const advance of session.advances().slice(advanceCount)) advances.push({ stepIndex, advance });
      if (response.kind === "rebound" && response.cursor.sourceCurve) {
        certificates.push({ afterStepIndex: stepIndex, diagnostic: session.adoptImpulse(queried, input.response, response.cursor.sourceCurve) });
      }
      cursor = response.cursor;
    }
    return freeze11({
      original: base.original,
      initialCursor: base.initialCursor,
      steps,
      cursor,
      solverVersion: "source_contact_escape_v3",
      impulseCertificates: certificates,
      escapedIntervals: advances
    });
  };

  // src/core/sim/ball/SourceBallMaterialHistoryFromContinuationV3.ts
  var json5 = (value) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
  var fields7 = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
  function assert2(condition, reason) {
    if (!condition) throw new Error("Source material continuation mapper: " + reason);
  }
  var same = (a, b) => assert2(json5(a) === json5(b), "original replay or kernel geometry differs");
  var basis = (descriptor) => json5([descriptor.kind, descriptor.initial, descriptor.profile]);
  var createSourceBallMaterialHistoryFromContinuationV3 = (raw) => {
    const source = cloneInert(raw), trace = source?.continuation;
    assert2(
      fields7(source, ["response", "continuation", "initialMaterialOrientation"]) && fields7(source.response, ["world", "actors", "surfaces"]) && fields7(source.response.world, ["flight", "parameters", "throughTick", "actors", "surfaces", "sourceCurve"]) && fields7(trace, ["solverVersion", "original", "initialCursor", "steps", "cursor", "impulseCertificates", "escapedIntervals"]) && trace.solverVersion === "source_contact_escape_v3" && Array.isArray(trace.steps) && trace.steps.length <= 4096,
      "requires an original free v3 response and bounded trace"
    );
    const curve = source.response.world.sourceCurve;
    assert2(curve, "original Source descriptor is missing");
    const replay = deriveSourceBattedWorldContinuationV3({ response: source.response, throughTicks: trace.steps.map((step) => step.throughTick) });
    same(trace, replay);
    const free = (cursor) => {
      assert2(cursor?.sourceCurve, "capture, custody or unresolved free cursor");
      return cursor;
    };
    const initial = free(replay.initialCursor);
    assert2(replay.original.kind === "airborne" || replay.original.kind === "ground" || replay.original.kind === "rebound", "original response is not supported free motion");
    const spans = [];
    let active = curve, end = active.initial.elapsedSeconds, endSide = "incoming";
    const kernels = /* @__PURE__ */ new Map();
    const kernel = () => {
      const key3 = json5(active);
      let value = kernels.get(key3);
      if (!value) {
        value = createSourceFreeBallKernel(active);
        kernels.set(key3, value);
      }
      return value;
    };
    const horizon = (throughElapsedSeconds) => {
      if (throughElapsedSeconds > active.throughElapsedSeconds) active = { ...active, throughElapsedSeconds };
    };
    const note = (moment, side) => {
      assert2(moment.elapsedSeconds >= end, "adopted physical time moves backwards");
      same(kernel().evaluateAt(moment.elapsedSeconds, side).moment, moment);
      end = moment.elapsedSeconds;
      endSide = side;
    };
    const acceptSameBasis = (cursor) => {
      const next = free(cursor);
      same(basis(active), basis(next.sourceCurve));
      horizon(next.sourceCurve.throughElapsedSeconds);
      note(next.moment, "outgoing");
    };
    const startOutgoingBasis = (cursor) => {
      const next = free(cursor);
      same(next.sourceCurve.initial, next.moment);
      spans.push({ descriptor: active, throughElapsedSeconds: end, side: endSide });
      active = next.sourceCurve;
      end = active.initial.elapsedSeconds;
      endSide = "outgoing";
      note(next.moment, "outgoing");
    };
    const originalMoment = replay.original.world.sourceMoment;
    assert2(originalMoment, "original exact Source moment is missing");
    note(originalMoment, "incoming");
    if (replay.original.kind === "rebound") {
      assert2(replay.original.geometry.contact.kind === "surface", "only surface impulse histories are supported");
      startOutgoingBasis(initial);
    } else acceptSameBasis(initial);
    let prior = initial;
    for (const step of replay.steps) {
      const requested = Math.max(
        prior.moment.elapsedSeconds,
        (step.throughTick - prior.moment.originTick) / active.profile.air.ticksPerSecond
      );
      horizon(requested);
      const cursor = free(step.response.cursor);
      assert2(["moving", "resting", "ground", "rolling_stop", "rebound"].includes(step.response.kind), "unsupported response");
      if (step.response.kind === "rebound") {
        assert2(
          step.world.kind === "boundary" && step.world.contacts.length === 1 && step.world.contacts[0].kind === "surface",
          "only surface impulse histories are supported"
        );
        note(step.world.moment, "incoming");
        startOutgoingBasis(cursor);
      } else {
        if (step.response.kind === "ground") {
          assert2(
            step.world.kind === "boundary" && step.world.contacts.length === 1 && step.world.contacts[0].kind === "ground",
            "ground history differs"
          );
          note(step.world.moment, "incoming");
        } else if (step.response.kind === "rolling_stop") {
          assert2(
            step.world.kind === "boundary" && step.world.contacts.length === 1 && step.world.contacts[0].kind === "rolling_stop",
            "rolling history differs"
          );
        } else same(step.world.moment, cursor.moment);
        acceptSameBasis(cursor);
      }
      prior = cursor;
    }
    same(free(replay.cursor), prior);
    spans.push({ descriptor: active, throughElapsedSeconds: end, side: endSide });
    return createSourceBallMaterialHistoryV1({ initialMaterialOrientation: source.initialMaterialOrientation, spans });
  };

  // src/core/sim/ball/BattedWorldMotion.ts
  var vector6 = (value) => !!value && [value.x, value.y, value.z].every(Number.isFinite);
  var tick6 = (value) => Number.isSafeInteger(value) && value >= 0;
  var key2 = (playerId, role) => JSON.stringify([playerId, role]);
  var freeze12 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze12);
      Object.freeze(value);
    }
    return value;
  };
  var prepareMotion = (raw, exactCoverage = false, availableAtElapsedSeconds) => {
    const input = cloneInert(raw), moment = input?.cursor?.moment, p = input?.response?.world?.parameters;
    if (availableAtElapsedSeconds !== void 0 && (!exactCoverage || !moment || !p || !Number.isFinite(availableAtElapsedSeconds) || availableAtElapsedSeconds < 0 || quantizeEventTick(moment.originTick, availableAtElapsedSeconds, p.ticksPerSecond) !== input.availableAtTick))
      throw new Error("exact batted command availability differs from its occurrence tick");
    if (!moment || !p || !tick6(input.availableAtTick) || (exactCoverage ? (availableAtElapsedSeconds ?? (input.availableAtTick - moment.originTick) / p.ticksPerSecond) > moment.elapsedSeconds : input.availableAtTick > moment.ball.tick) || !tick6(input.throughTick) || (exactCoverage ? (input.throughTick - moment.originTick) / p.ticksPerSecond <= moment.elapsedSeconds : input.throughTick <= moment.ball.tick) || !Array.isArray(input.actors) || !input.actors.length || !Array.isArray(input.commands) || input.commands.length !== input.actors.length || input.carrierPlayerId !== null && (typeof input.carrierPlayerId !== "string" || !input.carrierPlayerId.length)) throw new Error("invalid accepted batted motion interval");
    const commands = new Map(input.commands.map((command) => [key2(command.playerId, command.role), command]));
    if (commands.size !== input.commands.length || input.commands.some((command) => !vector6(command.acceleration) || Object.keys(command).sort().join("|") !== "acceleration|playerId|role")) throw new Error("invalid accepted batted motion commands");
    const actorKeys = /* @__PURE__ */ new Set();
    const actors = input.actors.map((actor) => {
      const s = actor.primitive, actorKey = key2(actor.playerId, s.role), command = commands.get(actorKey);
      const dt = (moment.originTick - s.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
      if (!command || actorKeys.has(actorKey) || !tick6(s.startTick) || !tick6(s.endTick) || (exactCoverage ? moment.elapsedSeconds > (s.endTick - moment.originTick) / p.ticksPerSecond : s.endTick < moment.ball.tick) || s.ticksPerSecond !== p.ticksPerSecond || !Number.isFinite(dt) || dt < 0 || !vector6(s.startCenter) || !vector6(s.startVelocity) || !vector6(s.acceleration) || actor.startElapsedSeconds !== void 0 && (!Number.isFinite(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0) || !input.response.actors.some((profile) => key2(profile.playerId, profile.profile.role) === actorKey)) throw new Error("batted motion prior actor basis differs");
      actorKeys.add(actorKey);
      const component = (axis) => s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt;
      const velocity = (axis) => s.startVelocity[axis] + s.acceleration[axis] * dt;
      const startCenter = { x: component("x"), y: component("y"), z: component("z") }, startVelocity = { x: velocity("x"), y: velocity("y"), z: velocity("z") };
      if (!vector6(startCenter) || !vector6(startVelocity)) throw new Error("batted motion actor arithmetic overflow");
      return { playerId: actor.playerId, startElapsedSeconds: moment.elapsedSeconds, primitive: {
        ...s,
        startTick: moment.originTick,
        endTick: input.throughTick,
        startCenter,
        startVelocity,
        acceleration: command.acceleration
      } };
    });
    if (actors.length !== input.response.actors.length) throw new Error("batted motion complete actor coverage differs");
    return { input, actors };
  };
  var deriveBattedWorldMotionActorsAtExactCoverage = (raw, availableAtElapsedSeconds) => freeze12(prepareMotion(raw, true, availableAtElapsedSeconds).actors);

  // src/core/sim/ball/SourceBallWorldMotionV1.ts
  var axes3 = ["x", "y", "z"];
  var ids = ["home", "first", "second", "third"];
  var zero2 = (p) => axes3.every((k) => p[k] === 0);
  var json6 = (p) => JSON.stringify(p, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
  var freeze13 = (p) => {
    if (p && typeof p === "object") {
      Object.values(p).forEach(freeze13);
      Object.freeze(p);
    }
    return p;
  };
  function assert3(p, message) {
    if (!p) throw new Error("Source ball World motion: " + message);
  }
  var baseSurface = (id6) => `source-motion-base:${id6}`;
  function createSourceBallWorldMotionSessionV1(raw) {
    const root = cloneInert(raw);
    assert3(root && Object.keys(root).sort().join("|") === "baseGeometry|cursor|heldBats|materialOrientationAtSourceBasis|response|version" && root.version === "source_ball_world_motion_v1" && Array.isArray(root.heldBats), "invalid root");
    assertBattedResponseProfiles(root.response);
    assert3(root.cursor?.sourceCurve && ["incoming", "outgoing"].includes(root.cursor.sourceSide), "missing exact Source cursor");
    const p = root.response.world.parameters, d = root.cursor.sourceCurve, q = root.materialOrientationAtSourceBasis;
    assert3(json6(root.response.world.sourceCurve) === json6(d) && p.ticksPerSecond === d.profile.air.ticksPerSecond && p.gravityY === d.profile.air.gravityY && p.ballRadius === d.profile.ground.radiusM && p.integrationStepTicks === d.profile.air.integrationStepTicks, "response Source/profile differs");
    assert3(q && Object.keys(q).sort().join("|") === "w|x|y|z" && Object.values(q).every(Number.isFinite) && Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) <= 8 * Number.EPSILON, "invalid material orientation");
    assert3(!root.response.world.surfaces.some((s) => ids.some((id6) => s.surfaceId === baseSurface(id6))), "reserved base surface identity");
    if (root.baseGeometry !== null) assert3(root.baseGeometry && Object.keys(root.baseGeometry).sort().join("|") === "bases|materials" && Object.keys(root.baseGeometry.bases).sort().join("|") === "first|home|second|third" && Object.keys(root.baseGeometry.materials).sort().join("|") === "first|home|second|third" && ids.every((id6) => Object.values(root.baseGeometry.materials[id6]).every((x) => Number.isFinite(x) && x >= 0 && x <= 1) && Object.keys(root.baseGeometry.materials[id6]).sort().join("|") === "restitution|spinDamping|tangentialDamping"), "invalid base material coverage");
    let cursor = root.cursor;
    let actors = root.response.world.actors;
    let orientationBasis = q, stopped = false;
    const session = createSourceImpactEscapeSessionV3(), equipmentIds = /* @__PURE__ */ new Set();
    const stationaryBats = (at2, bodies) => {
      for (const item of root.heldBats) {
        assert3(item && Object.keys(item).sort().join("|") === "ball|bat|equipmentId|holderPlayerId" && typeof item.equipmentId === "string" && item.equipmentId.trim() === item.equipmentId && item.equipmentId.length > 0 && typeof item.holderPlayerId === "string" && item.holderPlayerId.length > 0, "invalid held bat identity");
        const palm = bodies.find((a) => a.playerId === item.holderPlayerId && a.primitive.role === "tag_hand");
        assert3(palm && zero2(palm.primitive.startVelocity) && zero2(palm.primitive.acceleration) && zero2(item.bat.centerOfMassVelocity) && zero2(item.bat.angularVelocity), "moving held bat requires equipment controller");
        assert3(item.ball.radiusM === p.ballRadius, "equipment ball radius differs");
        measureRigidBatBallSurfaceSeparation(at2.moment.ball, item.bat, item.ball);
      }
    };
    stationaryBats(cursor, actors);
    for (const item of root.heldBats) {
      assert3(!equipmentIds.has(item.equipmentId), "duplicate equipment");
      equipmentIds.add(item.equipmentId);
    }
    const query = (at2, throughElapsedSeconds) => {
      const baseOf = (surfaceId) => ids.find((id6) => baseSurface(id6) === surfaceId);
      return session.query({
        descriptor: at2.sourceCurve,
        moment: at2.moment,
        side: at2.sourceSide,
        throughElapsedSeconds,
        actors,
        surfaces: root.response.world.surfaces,
        previousContacts: at2.previousContacts.filter((c) => c.kind !== "surface" || !baseOf(c.surfaceId)),
        previousBaseContacts: at2.previousContacts.flatMap((c) => c.kind === "surface" && baseOf(c.surfaceId) ? [baseOf(c.surfaceId)] : []),
        ...root.baseGeometry ? { bases: root.baseGeometry.bases } : {}
      });
    };
    query(cursor, cursor.moment.elapsedSeconds);
    const snapshot = () => freeze13({
      cursor,
      actors,
      heldBats: root.heldBats,
      orientation: multiplyQuaternions(createSourceFreeBallKernel(cursor.sourceCurve).evaluateAt(cursor.moment.elapsedSeconds, cursor.sourceSide).orientation, orientationBasis),
      stopped,
      nativeAdmission: false
    });
    const advance = (throughTick) => {
      assert3(!stopped && Number.isSafeInteger(throughTick) && throughTick >= 0, "stopped or invalid horizon");
      const horizon = (throughTick - cursor.moment.originTick) / p.ticksPerSecond;
      assert3(horizon > cursor.moment.elapsedSeconds && horizon <= cursor.sourceCurve.throughElapsedSeconds, "finite Source horizon exceeded");
      const observed = query(cursor, horizon);
      if (observed.kind === "unresolved") return freeze13({ kind: "unresolved", observed, state: snapshot() });
      const kernel = createSourceFreeBallKernel(cursor.sourceCurve);
      const hits = [];
      let budget = 5e5;
      for (const item of root.heldBats) {
        const gap = (t) => measureRigidBatBallSurfaceSeparation(kernel.evaluateAt(t, "incoming").moment.ball, item.bat, item.ball);
        const search = (lo, hi, speed2, rounding, depth = 0) => {
          assert3(--budget >= 0, "equipment contact proof budget exhausted");
          const x = gap(lo), y = gap(hi);
          if (x <= 0) return { from: lo, through: lo, hit: true };
          if (Math.min(x, y) > speed2 * (hi - lo) + rounding) return null;
          const mid = (lo + hi) / 2;
          if (depth === 60 || mid === lo || mid === hi || hi - lo <= 1e-15) return { from: lo, through: hi, hit: y <= 0 };
          const left = search(lo, mid, speed2, rounding, depth + 1);
          if (left?.hit || left && mid - left.from > 1e-12) return left;
          const right = search(mid, hi, speed2, rounding, depth + 1);
          if (!left) return right;
          return right && right.through - left.from <= 1e-12 ? { ...right, from: left.from } : left;
        };
        for (const cell of kernel.cells) {
          const lo = Math.max(cursor.moment.elapsedSeconds, cell.fromElapsedSeconds), hi = Math.min(observed.moment.elapsedSeconds, cell.throughElapsedSeconds);
          if (hi < lo) continue;
          const norm8 = (x) => Math.hypot(x.x, x.y, x.z);
          const arithmetic = 256 * Number.EPSILON * (1 + norm8(item.bat.pose.grip) + norm8(item.bat.pose.tip) + Math.max(norm8(kernel.evaluateAt(lo).moment.ball.position), norm8(kernel.evaluateAt(hi).moment.ball.position)) + item.ball.radiusM);
          const found = search(lo, hi, cell.maximumPositionSpeedMps, cell.positionRoundingBoundMeters + arithmetic);
          if (found) {
            hits.push({ equipmentId: item.equipmentId, ...found });
            break;
          }
        }
      }
      hits.sort((a, b) => a.from - b.from);
      const first = hits[0];
      if (first) {
        if (!first.hit || hits.slice(1).some((h) => h.from <= first.through) || observed.kind === "boundary" && observed.contactSearchWitnesses.some((w) => w.firstPossibleElapsedSeconds <= first.through) || observed.kind === "boundary" && observed.contacts.some((c) => c.kind === "ground" || c.kind === "rolling_stop") && observed.moment.elapsedSeconds <= first.through)
          return freeze13({ kind: "unresolved", reason: "equipment_contact_order_or_refinement", interval: first, state: snapshot() });
        const moment = kernel.evaluateAt(first.through, "incoming").moment;
        cursor = { ...cursor, moment, sourceSide: "incoming" };
        stopped = true;
        return freeze13({ kind: "equipment_boundary", contact: first, state: snapshot() });
      }
      const world = observed.kind === "boundary" ? {
        kind: "boundary",
        moment: observed.moment,
        phase: observed.phase,
        contacts: observed.contacts.map((c) => c.kind === "base" ? { ...c, kind: "surface", surfaceId: baseSurface(c.baseId) } : c),
        ...observed.pendingReason ? { pendingReason: observed.pendingReason } : {}
      } : { kind: observed.kind, moment: observed.moment, phase: observed.phase, throughTick };
      const responseInput = { ...root.response, world: { ...root.response.world, actors }, surfaces: [
        ...root.response.surfaces,
        ...root.baseGeometry ? ids.map((id6) => ({ surfaceId: baseSurface(id6), material: root.baseGeometry.materials[id6] })) : []
      ] };
      const response = respondToBallWorldBoundary(responseInput, { ...cursor, previousContacts: [] }, world);
      if (response.kind === "rebound" && response.cursor.sourceCurve) {
        const physicalResponse = { ...root.response, world: { ...root.response.world, actors } };
        if (observed.contacts[0].kind === "base") session.adoptBaseImpulse(observed, physicalResponse, root.baseGeometry.materials, response.cursor.sourceCurve);
        else session.adoptImpulse(observed, physicalResponse, response.cursor.sourceCurve);
        orientationBasis = multiplyQuaternions(kernel.evaluateAt(observed.moment.elapsedSeconds, "incoming").orientation, orientationBasis);
      }
      if (response.cursor) cursor = response.cursor;
      else {
        cursor = { ...cursor, moment: observed.moment, sourceSide: "incoming" };
        stopped = true;
      }
      return freeze13({ kind: "world", observed, response, state: snapshot() });
    };
    const adoptMotion = (rawCommand) => {
      const command = cloneInert(rawCommand);
      assert3(!stopped && command && Object.keys(command).sort().join("|") === "availableAtElapsedSeconds|commands|throughTick", "stopped or invalid motion");
      assert3(
        !(cursor.previousContacts.length && cursor.moment.elapsedSeconds === cursor.sourceCurve.initial.elapsedSeconds),
        "certified impulse departure must finish before replacing actor commands"
      );
      const next = deriveBattedWorldMotionActorsAtExactCoverage({
        response: root.response,
        actors,
        cursor,
        carrierPlayerId: null,
        availableAtTick: quantizeEventTick(cursor.moment.originTick, command.availableAtElapsedSeconds, p.ticksPerSecond),
        throughTick: command.throughTick,
        commands: command.commands
      }, command.availableAtElapsedSeconds);
      stationaryBats(cursor, next);
      actors = next;
      return snapshot();
    };
    return Object.freeze({ snapshot, advance, adoptMotion });
  }

  // src/integration/browser/ExecutedFieldWorldObservationV1.ts
  var axes4 = ["x", "y", "z"];
  var freeze14 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze14);
      Object.freeze(value);
    }
    return value;
  };
  function assert4(value, message) {
    if (!value) throw new Error("Executed field observation: " + message);
  }
  var canonical2 = (value) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  var same2 = (a, b) => canonical2(a) === canonical2(b);
  function createExecutedFieldWorldObserverV1(raw) {
    const recording = cloneInert(raw);
    assert4(recording?.kind === "joint_field_successor_executed_v1" && recording.physicalExecutionAdmitted === true && recording.motionIssued === true && recording.nextMotionAllowed === false && recording.officialResult === null && typeof recording.source?.sourceId === "string" && recording.source.sourceId.trim().length > 0 && typeof recording.source.sourceVersion === "string" && recording.source.sourceVersion.trim().length > 0 && Array.isArray(recording.steps) && recording.steps.length > 0, "requires a completed finite execution export");
    const initial = createSourceBallWorldMotionSessionV1(recording.root).snapshot();
    const steps = recording.steps;
    const states = [initial, ...steps.map((step) => step.state)];
    const start = initial.cursor.moment, end = recording.executedThroughMoment;
    const tps = recording.root.response.world.parameters.ticksPerSecond;
    let previous = start.elapsedSeconds;
    const identities = new Set(initial.actors.map((a) => a.playerId + "\0" + a.primitive.role));
    for (const state of states) {
      const at2 = state?.cursor?.moment;
      assert4(
        at2?.originTick === start.originTick && Number.isFinite(at2.elapsedSeconds) && at2.elapsedSeconds >= previous && at2.elapsedSeconds <= end.elapsedSeconds,
        "nonmonotonic or different-origin stored state"
      );
      assert4(state.actors.length === identities.size && new Set(state.actors.map((a) => a.playerId + "\0" + a.primitive.role)).size === identities.size && state.actors.every((a) => identities.has(a.playerId + "\0" + a.primitive.role)), "stored actor coverage differs");
      assert4(
        state.orientation && Object.values(state.orientation).every(Number.isFinite) && Math.abs(Math.hypot(...Object.values(state.orientation)) - 1) <= 32 * Number.EPSILON,
        "invalid stored material orientation"
      );
      assert4(state.heldBats.length === initial.heldBats.length && state.heldBats.every((bat, i) => same2(bat, initial.heldBats[i])), "retained equipment differs");
      previous = at2.elapsedSeconds;
    }
    assert4(same2(states.at(-1).cursor.moment, end), "execution endpoint differs from final stored state");
    const frames = states.map((state) => {
      const moment = state.cursor.moment;
      const sampled = state.actors.map((actor) => {
        const p = actor.primitive;
        const dt = (moment.originTick - p.startTick) / tps + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
        assert4(p.ticksPerSecond === tps && dt >= 0 && moment.elapsedSeconds <= (p.endTick - moment.originTick) / tps, "stored primitive coverage expired");
        const position = Object.fromEntries(axes4.map((axis) => [
          axis,
          p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt
        ]));
        const velocity = Object.fromEntries(axes4.map((axis) => [axis, p.startVelocity[axis] + p.acceleration[axis] * dt]));
        return { playerId: actor.playerId, role: p.role, radiusM: p.radius, position, velocity };
      });
      const players = [...new Set(sampled.map((a) => a.playerId))].map((playerId) => {
        const primitives = sampled.filter((a) => a.playerId === playerId), body = primitives.find((a) => a.role === "body");
        const feet = primitives.filter((a) => a.role === "left_foot" || a.role === "right_foot");
        assert4(body && feet.length === 2, "player body and both feet required");
        return {
          playerId,
          primitives,
          bodyPosition: body.position,
          velocity: body.velocity,
          // Existing PNGs are ground-anchored. Feet set the visible ground height;
          // neither this anchor nor a sprite is a physical body/catch primitive.
          anchor: { x: body.position.x, y: feet.reduce((sum, foot) => sum + foot.position.y - foot.radiusM, 0) / 2, z: body.position.z }
        };
      });
      return freeze14({
        moment,
        players,
        ball: {
          ...moment.ball,
          orientation: state.orientation,
          nativeObservation: true,
          ballKind: "batted"
        },
        heldBats: state.heldBats.map((bat) => ({
          equipmentId: bat.equipmentId,
          holderPlayerId: bat.holderPlayerId,
          ...bat.bat.pose,
          radiusProfile: bat.bat.physical.radiusProfile,
          nativeObservation: true
        })),
        stopped: state.stopped,
        atCoverageEnd: same2(moment, end),
        officialResult: null
      });
    });
    const observe = (elapsedSeconds) => {
      assert4(
        Number.isFinite(elapsedSeconds) && elapsedSeconds >= start.elapsedSeconds && elapsedSeconds <= end.elapsedSeconds,
        "requested observation exceeds executed coverage"
      );
      let index = 0;
      while (index + 1 < frames.length && frames[index + 1].moment.elapsedSeconds <= elapsedSeconds) index++;
      return frames[index];
    };
    return freeze14({
      provenance: "HOST_EXPORTED_EXECUTION_NOT_BROWSER_AUTHENTICATION",
      executionSource: recording.source,
      fromElapsedSeconds: start.elapsedSeconds,
      throughElapsedSeconds: end.elapsedSeconds,
      ticksPerSecond: tps,
      frames,
      observe,
      officialResult: null,
      canIssueMotion: false
    });
  }

  // src/core/sim/fielding/DefenderMotion.ts
  var EPSILON14 = 1e-12;
  var clean2 = (value) => Math.abs(value) < EPSILON14 ? 0 : value;
  var cleanVec = (value) => ({
    x: clean2(value.x),
    z: clean2(value.z)
  });
  var magnitude11 = (value) => Math.hypot(value.x, value.z);
  var subtract13 = (a, b) => ({
    x: a.x - b.x,
    z: a.z - b.z
  });
  var add10 = (a, b) => ({
    x: a.x + b.x,
    z: a.z + b.z
  });
  var scale11 = (value, amount) => ({
    x: value.x * amount,
    z: value.z * amount
  });
  var dot9 = (a, b) => a.x * b.x + a.z * b.z;
  var normalized = (value) => {
    const length = magnitude11(value);
    if (length <= EPSILON14) return { x: 0, z: 0 };
    return {
      x: value.x / length,
      z: value.z / length
    };
  };
  var moveToward = (current, target, maxDelta) => {
    const delta = subtract13(target, current);
    const distance6 = magnitude11(delta);
    if (distance6 <= maxDelta || distance6 <= EPSILON14) {
      return cleanVec(target);
    }
    return cleanVec(add10(current, scale11(delta, maxDelta / distance6)));
  };
  var validateVec = (name, value) => {
    if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
      throw new Error(`${name} must contain finite coordinates`);
    }
  };
  var validateTick5 = (name, value) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative safe integer tick`);
    }
  };
  var validatePositive = (name, value) => {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be finite and positive`);
    }
  };
  var validateParameters6 = (parameters) => {
    if (!Number.isSafeInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
      throw new Error("ticksPerSecond must be a positive safe integer");
    }
    if (!Number.isSafeInteger(parameters.maxIntegrationStepTicks) || parameters.maxIntegrationStepTicks <= 0) {
      throw new Error("maxIntegrationStepTicks must be a positive safe integer");
    }
    validatePositive("accelerationMps2", parameters.accelerationMps2);
    validatePositive("brakingMps2", parameters.brakingMps2);
    validatePositive("topSpeedMps", parameters.topSpeedMps);
    if (!Number.isFinite(parameters.arrivalRadiusMeters) || parameters.arrivalRadiusMeters < 0) {
      throw new Error("arrivalRadiusMeters must be finite and non-negative");
    }
  };
  var validateState3 = (state, parameters) => {
    validateTick5("state.tick", state.tick);
    validateVec("state.position", state.position);
    validateVec("state.velocity", state.velocity);
    if (magnitude11(state.velocity) > parameters.topSpeedMps + 1e-9) {
      throw new Error("state velocity exceeds configured top speed");
    }
  };
  var computeEndVelocity = (state, target, deltaSeconds, parameters) => {
    const speed2 = magnitude11(state.velocity);
    if (target === null) {
      return moveToward(
        state.velocity,
        { x: 0, z: 0 },
        parameters.brakingMps2 * deltaSeconds
      );
    }
    validateVec("target", target);
    const toTarget = subtract13(target, state.position);
    const distance6 = magnitude11(toTarget);
    if (distance6 <= parameters.arrivalRadiusMeters + EPSILON14) {
      return moveToward(
        state.velocity,
        { x: 0, z: 0 },
        parameters.brakingMps2 * deltaSeconds
      );
    }
    const direction = normalized(toTarget);
    const forwardSpeed = dot9(state.velocity, direction);
    const stoppingDistance = forwardSpeed > 0 ? forwardSpeed * forwardSpeed / (2 * parameters.brakingMps2) : 0;
    const remainingDistance = Math.max(
      0,
      distance6 - parameters.arrivalRadiusMeters
    );
    if (speed2 > EPSILON14 && forwardSpeed > 0 && stoppingDistance + 1e-9 >= remainingDistance) {
      return moveToward(
        state.velocity,
        { x: 0, z: 0 },
        parameters.brakingMps2 * deltaSeconds
      );
    }
    const desiredVelocity = scale11(direction, parameters.topSpeedMps);
    return moveToward(
      state.velocity,
      desiredVelocity,
      parameters.accelerationMps2 * deltaSeconds
    );
  };
  var createSegment = (state, target, stepTicks, parameters) => {
    const deltaSeconds = stepTicks / parameters.ticksPerSecond;
    const endVelocity = computeEndVelocity(
      state,
      target,
      deltaSeconds,
      parameters
    );
    const acceleration = deltaSeconds === 0 ? { x: 0, z: 0 } : {
      x: (endVelocity.x - state.velocity.x) / deltaSeconds,
      z: (endVelocity.z - state.velocity.z) / deltaSeconds
    };
    return {
      startTick: state.tick,
      endTick: state.tick + stepTicks,
      ticksPerSecond: parameters.ticksPerSecond,
      startPosition: state.position,
      startVelocity: state.velocity,
      acceleration: cleanVec(acceleration),
      target
    };
  };
  var sampleDefenderMotionSegment = (segment, tick8) => {
    validateTick5("tick", tick8);
    if (tick8 < segment.startTick || tick8 > segment.endTick) {
      throw new Error("tick must be inside the defender motion segment");
    }
    if (!Number.isSafeInteger(segment.ticksPerSecond) || segment.ticksPerSecond <= 0) {
      throw new Error("segment ticksPerSecond must be a positive safe integer");
    }
    const elapsedSeconds = (tick8 - segment.startTick) / segment.ticksPerSecond;
    const halfTimeSquared = 0.5 * elapsedSeconds * elapsedSeconds;
    return {
      tick: tick8,
      position: cleanVec({
        x: segment.startPosition.x + segment.startVelocity.x * elapsedSeconds + segment.acceleration.x * halfTimeSquared,
        z: segment.startPosition.z + segment.startVelocity.z * elapsedSeconds + segment.acceleration.z * halfTimeSquared
      }),
      velocity: cleanVec({
        x: segment.startVelocity.x + segment.acceleration.x * elapsedSeconds,
        z: segment.startVelocity.z + segment.acceleration.z * elapsedSeconds
      })
    };
  };
  var buildDefenderMotionTrajectory = (state, target, deltaTicks, parameters) => {
    validateParameters6(parameters);
    validateState3(state, parameters);
    validateTick5("deltaTicks", deltaTicks);
    if (target !== null) validateVec("target", target);
    if (!Number.isSafeInteger(state.tick + deltaTicks)) {
      throw new Error("end tick must be a safe integer");
    }
    const segments = [];
    let current = state;
    let remaining = deltaTicks;
    while (remaining > 0) {
      const stepTicks = Math.min(
        remaining,
        parameters.maxIntegrationStepTicks
      );
      const segment = createSegment(
        current,
        target,
        stepTicks,
        parameters
      );
      segments.push(segment);
      current = sampleDefenderMotionSegment(segment, segment.endTick);
      remaining -= stepTicks;
    }
    return segments;
  };

  // src/core/sim/fielding/GroundWallRollingCurveV1.ts
  var freeze15 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze15);
      Object.freeze(value);
    }
    return value;
  };
  function createGroundWallRollingCurveV1(raw) {
    const p = freeze15(cloneInert(raw)), initial = p.initial, b = initial.ball, tps = p.profile.ground.ticksPerSecond;
    const rx = b.position.x - p.fenceCenter.x, rz = b.position.z - p.fenceCenter.z, radius = Math.hypot(rx, rz);
    const gap = p.nominalContactRadiusMeters - radius, tangent = { x: rz / radius, y: 0, z: -rx / radius };
    const radialVelocity = (rx * b.velocity.x + rz * b.velocity.z) / radius;
    if (!(radius > 0 && Number.isFinite(radius) && gap <= 0 && gap >= -p.maximumCompressionMeters && p.maximumCompressionMeters >= 0 && p.maximumCompressionMeters < p.profile.ground.radiusM && b.position.y === p.profile.ground.radiusM && b.velocity.y === 0 && Math.abs(radialVelocity) <= 256 * Number.EPSILON * Math.max(1, Math.hypot(b.velocity.x, b.velocity.z)) && p.throughElapsedSeconds > initial.elapsedSeconds && p.throughElapsedSeconds - initial.elapsedSeconds <= 120))
      throw new Error("ground wall rolling: actual supported floor/wall impulse basis required");
    const total = p.throughElapsedSeconds - initial.elapsedSeconds;
    const groundThrough = sampleBaseballGroundMotionAtElapsedSeconds(b, total, p.profile.ground);
    const boundaries = groundThrough.transitions.map((t) => ({
      kind: t.kind === "rolling_started" ? "rolling_started" : "rolling_stop",
      elapsedSeconds: initial.elapsedSeconds + t.elapsedSeconds
    }));
    const rotate = (v2, angle2) => ({
      x: v2.x * Math.cos(angle2) + v2.z * Math.sin(angle2),
      y: v2.y,
      z: -v2.x * Math.sin(angle2) + v2.z * Math.cos(angle2)
    });
    const stateAt = (time) => {
      const ground = sampleBaseballGroundMotionAtElapsedSeconds(b, time - initial.elapsedSeconds, p.profile.ground);
      const dx = ground.ball.position.x - b.position.x, dz = ground.ball.position.z - b.position.z;
      const angle2 = (dx * tangent.x + dz * tangent.z) / radius, radial = rotate({ x: rx, y: 0, z: rz }, angle2);
      const speed2 = ground.ball.velocity.x * tangent.x + ground.ball.velocity.z * tangent.z;
      const velocity = rotate({ x: tangent.x * speed2, y: 0, z: tangent.z * speed2 }, angle2);
      return { phase: ground.phase, moment: {
        originTick: initial.originTick,
        elapsedSeconds: time,
        ball: {
          ...ground.ball,
          tick: quantizeEventTick(initial.originTick, time, tps),
          position: { x: p.fenceCenter.x + radial.x, y: b.position.y, z: p.fenceCenter.z + radial.z },
          velocity,
          spin: rotate(ground.ball.spin, angle2)
        }
      } };
    };
    const knots = /* @__PURE__ */ new Set([initial.elapsedSeconds, p.throughElapsedSeconds, ...boundaries.map((x) => x.elapsedSeconds)]);
    const step = p.profile.air.integrationStepTicks / tps;
    for (let n = 1; initial.elapsedSeconds + n * step < p.throughElapsedSeconds; n++) knots.add(initial.elapsedSeconds + n * step);
    const times = [...knots].sort((a, b2) => a - b2), samples = [{
      moment: initial,
      phase: sampleBaseballGroundMotionAtElapsedSeconds(b, 0, p.profile.ground).phase,
      orientation: IDENTITY_QUATERNION
    }];
    for (let i = 1; i < times.length; i++) {
      const previous = samples[i - 1], next = stateAt(times[i]), a = previous.moment.ball.spin, w = next.moment.ball.spin;
      samples.push({ ...next, orientation: advanceBaseballOrientation(
        previous.orientation,
        { x: (a.x + w.x) / 2, y: (a.y + w.y) / 2, z: (a.z + w.z) / 2 },
        times[i] - times[i - 1]
      ) });
    }
    const norm8 = (x) => Math.hypot(x.x, x.y, x.z);
    const cells = samples.slice(0, -1).map((s, i) => ({
      fromElapsedSeconds: s.moment.elapsedSeconds,
      throughElapsedSeconds: times[i + 1],
      maximumPositionSpeedMps: Math.max(norm8(s.moment.ball.velocity), norm8(samples[i + 1].moment.ball.velocity)) + p.profile.ground.material.slidingFriction * p.profile.ground.gravityMps2 * (times[i + 1] - times[i]),
      positionRoundingBoundMeters: 256 * Number.EPSILON * Math.max(1, norm8(s.moment.ball.position), norm8(samples[i + 1].moment.ball.position))
    }));
    freeze15(samples);
    freeze15(cells);
    freeze15(boundaries);
    const evaluateAt = (time) => {
      if (!Number.isFinite(time) || time < initial.elapsedSeconds || time > p.throughElapsedSeconds) throw new Error("ground wall rolling: finite source horizon exceeded");
      let lo = 0, hi = samples.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (times[mid] <= time) lo = mid;
        else hi = mid - 1;
      }
      if (times[lo] === time) return samples[lo];
      const a = samples[lo], next = stateAt(time), w = a.moment.ball.spin, z = next.moment.ball.spin;
      return freeze15({ ...next, orientation: advanceBaseballOrientation(
        a.orientation,
        { x: (w.x + z.x) / 2, y: (w.y + z.y) / 2, z: (w.z + z.z) / 2 },
        time - times[lo]
      ) });
    };
    return Object.freeze({
      kind: "compliant_ground_wall_arc_source_v1",
      initial,
      boundaries,
      cells,
      evaluateAt,
      support: Object.freeze({
        signedGapMeters: gap,
        maximumCompressionMeters: p.maximumCompressionMeters,
        representedRadialVelocityMps: radialVelocity,
        radialVelocityArithmeticBoundMps: 256 * Number.EPSILON * Math.max(1, Math.hypot(b.velocity.x, b.velocity.z)),
        radialCoordinateCorrected: false,
        radialReactionOwnedByWall: true,
        groundModel: "existing_analytic_sliding_rolling_v1"
      })
    });
  }

  // src/core/sim/fielding/LiveFieldForecastV1.ts
  var fields8 = (v2, keys, optional = []) => !!v2 && typeof v2 === "object" && !Array.isArray(v2) && keys.every((k) => Object.hasOwn(v2, k)) && Object.keys(v2).every((k) => keys.includes(k) || optional.includes(k));
  var magnitude12 = (v2) => Math.hypot(v2.x, v2.y, v2.z);
  function assert5(v2, message) {
    if (!v2) throw new Error("live field forecast: " + message);
  }
  function createLiveFieldForecastV1(raw) {
    const started = performance.now(), input = cloneInert(raw), horizon = input.horizonSeconds ?? 8;
    assert5(fields8(input, ["observation", "physics"], ["horizonSeconds"]) && fields8(input.observation, ["tick", "position", "velocity", "spin"]) && Number.isFinite(horizon) && horizon > 0 && horizon <= 8, "observation and finite horizon up to eight seconds required");
    const profile = createAeroGroundBallPhysicsProfile(input.physics), kernel = createSourceFreeBallKernel({
      kind: "aero_ground_continuous_source_kernel_v2",
      initial: { originTick: input.observation.tick, elapsedSeconds: 0, ball: input.observation },
      throughElapsedSeconds: horizon,
      profile
    }), buildWallMilliseconds = performance.now() - started;
    let queries = 0, sampleWallMilliseconds = 0, maximumSampledSpeedMps = magnitude12(input.observation.velocity);
    const diagnostics = Object.freeze({
      basis: "EXPLICIT_SENSOR_PREDICTION_MODEL",
      actualSourceRead: false,
      nativeAuthentication: false,
      observationReanchoredForPrediction: true,
      predictionOriginTick: input.observation.tick,
      horizonSeconds: horizon,
      kernelBuildCount: 1,
      sourceCellCount: kernel.cells.length,
      maximumPositionSpeedUpperBoundMps: Math.max(0, ...kernel.cells.map((c) => c.maximumPositionSpeedMps)),
      groundContactElapsedSeconds: Object.freeze(kernel.boundaries.filter((b) => b.kind === "ground").map((b) => b.elapsedSeconds)),
      venueReflectionPrediction: "NOT_AVAILABLE_WITHOUT_VENUE_GEOMETRY"
    });
    const sampleAtElapsedSeconds = (seconds) => {
      assert5(Number.isFinite(seconds) && seconds >= 0 && seconds <= horizon, "sample outside finite prediction horizon");
      const began = performance.now(), sample3 = kernel.evaluateAt(seconds, "outgoing");
      queries++;
      maximumSampledSpeedMps = Math.max(maximumSampledSpeedMps, magnitude12(sample3.moment.ball.velocity));
      sampleWallMilliseconds += performance.now() - began;
      return Object.freeze({ ...sample3.moment.ball, orientation: sample3.orientation, phase: sample3.phase });
    };
    const readPerformance = () => Object.freeze({
      kernelBuildCount: 1,
      queries,
      buildWallMilliseconds,
      sampleWallMilliseconds,
      maximumSampledSpeedMps,
      sourceCellCount: kernel.cells.length,
      timingBasis: "MONOTONIC_WALL_CLOCK_NOT_PROCESS_CPU"
    });
    return Object.freeze({ basis: diagnostics.basis, diagnostics, sampleAtElapsedSeconds, readPerformance });
  }

  // src/core/sim/fielding/GroundedActorContactResponseV1.ts
  var dot10 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  var finite5 = (p) => !!p && [p.x, p.y, p.z].every(Number.isFinite);
  var freeze16 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze16);
      Object.freeze(value);
    }
    return value;
  };
  function assert6(value, message) {
    if (!value) throw new Error("grounded actor contact: " + message);
  }
  function resolveGroundedActorContactResponseV1(raw) {
    const input = cloneInert(raw);
    const { incoming, actorResponse, ground, surfaceVelocity } = input, length = Math.sqrt(dot10(input.normal, input.normal));
    assert6([
      incoming?.position,
      incoming?.velocity,
      incoming?.spin,
      actorResponse?.position,
      actorResponse?.velocity,
      actorResponse?.spin,
      input.normal,
      surfaceVelocity
    ].every(finite5) && Number.isFinite(length) && length > 0 && Number.isSafeInteger(incoming.tick) && incoming.tick >= 0 && actorResponse.tick === incoming.tick && ["x", "y", "z"].every((axis) => incoming.position[axis] === actorResponse.position[axis]) && incoming.position.y === ground.radiusM && Number.isFinite(input.actorRestitution) && input.actorRestitution >= 0 && input.actorRestitution <= 1, "actual same-position floor/actor contact required");
    const normal4 = { x: input.normal.x / length, y: input.normal.y / length, z: input.normal.z / length };
    const nominal = actorResponse.velocity.y < 0 ? resolveBaseballGroundImpact(actorResponse, ground) : actorResponse;
    const actorTarget = Math.max(0, -input.actorRestitution * Math.min(0, dot10(sub3(incoming.velocity, surfaceVelocity), normal4))), groundTarget = Math.max(0, -ground.material.restitution * Math.min(0, incoming.velocity.y)), actorNominal = dot10(sub3(nominal.velocity, surfaceVelocity), normal4), actorDeficit = actorTarget - actorNominal, groundDeficit = groundTarget - nominal.velocity.y;
    let actorImpulsePerMass = 0, groundImpulsePerMass = 0, activeSet = "none";
    let velocity = nominal.velocity;
    if (actorDeficit > 0 || groundDeficit > 0) {
      const actorOnly = Math.max(0, actorDeficit), groundOnly = Math.max(0, groundDeficit);
      if (nominal.velocity.y + actorOnly * normal4.y >= groundTarget) {
        activeSet = "actor";
        actorImpulsePerMass = actorOnly;
        velocity = {
          x: nominal.velocity.x + actorOnly * normal4.x,
          y: nominal.velocity.y + actorOnly * normal4.y,
          z: nominal.velocity.z + actorOnly * normal4.z
        };
      } else if (actorNominal + groundOnly * normal4.y >= actorTarget) {
        activeSet = "ground";
        groundImpulsePerMass = groundOnly;
        velocity = { ...nominal.velocity, y: groundTarget };
      } else {
        const horizontalSquared = normal4.x * normal4.x + normal4.z * normal4.z;
        assert6(horizontalSquared > 0, "opposed parallel contact normals have no admissible impulse");
        actorImpulsePerMass = (actorTarget - normal4.x * (nominal.velocity.x - surfaceVelocity.x) - normal4.z * (nominal.velocity.z - surfaceVelocity.z) - normal4.y * (groundTarget - surfaceVelocity.y)) / horizontalSquared;
        groundImpulsePerMass = groundTarget - nominal.velocity.y - actorImpulsePerMass * normal4.y;
        assert6(actorImpulsePerMass >= 0 && groundImpulsePerMass >= 0, "contact active-set impulses are tensile");
        activeSet = "both";
        velocity = {
          x: nominal.velocity.x + actorImpulsePerMass * normal4.x,
          y: groundTarget,
          z: nominal.velocity.z + actorImpulsePerMass * normal4.z
        };
      }
    }
    const actorNormalSpeed = dot10(sub3(velocity, surfaceVelocity), normal4), groundNormalSpeed = velocity.y;
    assert6(finite5(velocity) && [actorImpulsePerMass, groundImpulsePerMass].every(Number.isFinite) && actorNormalSpeed >= 0 && groundNormalSpeed >= 0, "no finite nonclosing two-contact response");
    return freeze16({ ball: { ...nominal, velocity }, proof: {
      basis: "EXPLICIT_TWO_CONTACT_NORMAL_ACTIVE_SET_V1",
      activeSet,
      normal: normal4,
      actorImpulsePerMass,
      groundImpulsePerMass,
      actorTarget,
      groundTarget,
      actorNormalSpeed,
      groundNormalSpeed,
      groundMaterialResponseApplied: actorResponse.velocity.y < 0,
      retainedMaterialSpin: nominal.spin,
      sameClockAndPosition: true
    } });
  }

  // src/core/sim/fielding/LiveThrowPlanV1.ts
  var add11 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  var sub4 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  var mul = (a, n) => ({ x: a.x * n, y: a.y * n, z: a.z * n });
  var norm2 = (v2) => Math.hypot(v2.x, v2.y, v2.z);
  var values = (v2) => [v2.x, v2.y, v2.z];
  var vector7 = (a) => ({ x: a[0], y: a[1], z: a[2] });
  var matvec = (a, v2) => a.map((row) => row.reduce((s, x, i) => s + x * v2[i], 0));
  var dot11 = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  var fields9 = (a, required, optional = []) => !!a && typeof a === "object" && !Array.isArray(a) && required.every((k) => Object.hasOwn(a, k)) && Object.keys(a).every((k) => required.includes(k) || optional.includes(k));
  var finiteVec = (v2) => fields9(v2, ["x", "y", "z"]) && values(v2).every(Number.isFinite);
  function assert7(v2, message) {
    if (!v2) throw new Error("live throw plan: " + message);
  }
  function planLiveThrowV1(raw) {
    const started = performance.now(), input = cloneInert(raw), maximumFlightSeconds = input.maximumFlightSeconds ?? 4;
    assert7(fields9(input, ["releasePosition", "bodyVelocity", "maximumThrowSpeedMps", "spin", "physics", "target"], ["maximumFlightSeconds"]) && [input.releasePosition, input.bodyVelocity, input.spin, input.target].every(finiteVec) && Number.isFinite(input.maximumThrowSpeedMps) && input.maximumThrowSpeedMps > 0 && input.maximumThrowSpeedMps <= 120 && Number.isFinite(maximumFlightSeconds) && maximumFlightSeconds >= 0.05 && maximumFlightSeconds <= 8, "finite throw command, target and SI speed required");
    const physics = createAeroGroundBallPhysicsProfile(input.physics), tolerance = 0.02, initial = (velocity) => ({ tick: 0, position: input.releasePosition, velocity, spin: input.spin });
    assert7(input.releasePosition.y >= physics.ground.radiusM && input.target.y >= physics.ground.radiusM, "airborne throw endpoints must be above the physical floor");
    let candidateCount = 0, solverEvaluationCount = 0, shootingIntegrationStepUpperBound = 0, verificationKernelBuilds = 0, completedWallMilliseconds = 0;
    const performanceCounters = () => Object.freeze({
      wallMilliseconds: completedWallMilliseconds,
      candidateCount,
      solverEvaluationCount,
      shootingIntegrationStepUpperBound,
      verificationKernelBuilds,
      timingBasis: "MONOTONIC_WALL_CLOCK_NOT_PROCESS_CPU"
    });
    const diagnostics = () => Object.freeze({
      basis: "EXPLICIT_AERO_THROW_COMMAND_PREDICTION_V1",
      actualSourceRead: false,
      nativeAuthentication: false,
      candidateCount,
      solverEvaluationCount,
      shootingIntegrationStepUpperBound,
      verificationKernelBuilds,
      speedCapBasis: "RELEASE_VELOCITY_RELATIVE_TO_THROWER_BODY",
      targetToleranceMeters: tolerance,
      maximumFlightSeconds,
      maximumThrowSpeedMps: input.maximumThrowSpeedMps
    });
    const delta = sub4(input.target, input.releasePosition), directDistance = norm2(delta), firstTime = Math.max(0.05, directDistance / (input.maximumThrowSpeedMps + norm2(input.bodyVelocity)));
    const candidates = [];
    for (let t = firstTime; t < maximumFlightSeconds && candidates.length < 18; t = Math.max(t + 0.035, t * 1.16)) candidates.push(t);
    if (candidates.at(-1) !== maximumFlightSeconds) candidates.push(maximumFlightSeconds);
    let bestRejectedError = Infinity, bestRejectedRelativeSpeed = Infinity;
    for (const seconds of candidates) {
      candidateCount++;
      let velocity = { x: delta.x / seconds, y: delta.y / seconds - physics.air.gravityY * seconds / 2, z: delta.z / seconds }, inverse = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_2, j) => i === j ? 1 / seconds : 0)), previous = null;
      for (let iteration = 0; iteration < 9; iteration++) {
        if (solverEvaluationCount >= 100) break;
        solverEvaluationCount++;
        shootingIntegrationStepUpperBound += 1 + Math.ceil(seconds * physics.air.ticksPerSecond / physics.air.integrationStepTicks);
        const arrival = sampleAerodynamicPitchStateAtElapsedSeconds(initial(velocity), seconds, physics.air), error = sub4(input.target, arrival.position), errorMeters = norm2(error), relativeSpeed = norm2(sub4(velocity, input.bodyVelocity));
        if (errorMeters < bestRejectedError) {
          bestRejectedError = errorMeters;
          bestRejectedRelativeSpeed = relativeSpeed;
        }
        if (errorMeters <= tolerance) {
          if (relativeSpeed > input.maximumThrowSpeedMps) break;
          verificationKernelBuilds++;
          const kernel = createSourceFreeBallKernel({
            kind: "aero_ground_continuous_source_kernel_v2",
            initial: { originTick: 0, elapsedSeconds: 0, ball: initial(velocity) },
            throughElapsedSeconds: seconds,
            profile: physics
          }), verified = kernel.evaluateAt(seconds, "incoming"), verifiedError = norm2(sub4(input.target, verified.moment.ball.position));
          if (kernel.boundaries.some((b) => b.kind === "ground" && b.elapsedSeconds < seconds) || verifiedError > tolerance) break;
          completedWallMilliseconds = performance.now() - started;
          const result = Object.freeze({
            kind: "planned",
            initialVelocity: Object.freeze(velocity),
            flightSeconds: seconds,
            predictedArrivalPosition: verified.moment.ball.position,
            predictedArrivalVelocity: verified.moment.ball.velocity,
            arrivalErrorMeters: verifiedError,
            relativeReleaseSpeedMps: relativeSpeed,
            diagnostics: diagnostics(),
            readPerformance: performanceCounters
          });
          return result;
        }
        if (previous) {
          const step2 = values(sub4(velocity, previous.velocity)), change = values(sub4(arrival.position, previous.position)), mapped = matvec(inverse, change), row = [0, 1, 2].map((j) => step2.reduce((s, x, i) => s + x * inverse[i][j], 0)), denominator = dot11(step2, mapped);
          if (Math.abs(denominator) > 1e-12 * Math.max(1, norm2(vector7(step2)) * norm2(vector7(mapped)))) {
            inverse = inverse.map((line, i) => line.map((x, j) => x + (step2[i] - mapped[i]) * row[j] / denominator));
          }
        }
        previous = { velocity, position: arrival.position };
        let step = vector7(matvec(inverse, values(error)));
        if (!finiteVec(step)) break;
        const length = norm2(step), stepLimit = Math.max(20, input.maximumThrowSpeedMps * 2);
        if (length > stepLimit) step = mul(step, stepLimit / length);
        velocity = add11(velocity, step);
        if (norm2(velocity) > 240) break;
      }
    }
    completedWallMilliseconds = performance.now() - started;
    return Object.freeze({
      kind: "unreachable",
      reason: "NO_AIRBORNE_SOLUTION_WITHIN_SPEED_TIME_AND_FINITE_SOLVER_LIMITS",
      diagnostics: Object.freeze({
        ...diagnostics(),
        bestCandidateArrivalErrorMeters: Number.isFinite(bestRejectedError) ? bestRejectedError : null,
        bestCandidateRelativeReleaseSpeedMps: Number.isFinite(bestRejectedRelativeSpeed) ? bestRejectedRelativeSpeed : null
      }),
      readPerformance: performanceCounters
    });
  }

  // src/core/sim/fielding/LiveHandPreparationV1.ts
  var zero3 = Object.freeze({ x: 0, y: 0, z: 0 });
  var norm3 = (p) => Math.hypot(p.x, p.y, p.z);
  var dot12 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var add12 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  var sub5 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  var mul2 = (p, scale12) => ({ x: p.x * scale12, y: p.y * scale12, z: p.z * scale12 });
  var finiteVec2 = (p) => !!p && typeof p === "object" && [p.x, p.y, p.z].every(Number.isFinite);
  var copy = (p) => Object.freeze({ x: p.x, y: p.y, z: p.z });
  var controls = (a, b, c, d) => Object.freeze([copy(a), copy(b), copy(c), copy(d)]);
  var unreachable = (reason, candidateCount = 0) => Object.freeze({ kind: "unreachable", reason, candidateCount });
  function createLiveHandPreparationV1(raw) {
    if (!raw || typeof raw !== "object" || !Number.isFinite(raw.fromElapsedSeconds) || raw.fromElapsedSeconds < 0 || ![raw.initialOffset, raw.initialRelativeVelocity, raw.targetOffset].every(finiteVec2) || !Number.isFinite(raw.maximumRelativeSpeedMps) || raw.maximumRelativeSpeedMps <= 0 || !Number.isFinite(raw.maximumReachMeters) || raw.maximumReachMeters <= 0)
      return unreachable("INVALID_FINITE_HAND_PREPARATION_INPUT");
    const from = raw.fromElapsedSeconds, a = copy(raw.initialOffset), v2 = copy(raw.initialRelativeVelocity), b = copy(raw.targetOffset), speedLimit = raw.maximumRelativeSpeedMps, reach = raw.maximumReachMeters, initialReach = norm3(a), targetReach = norm3(b), initialSpeed = norm3(v2), delta = sub5(b, a), distance6 = norm3(delta);
    if (initialReach > reach || targetReach > reach) return unreachable("ENDPOINT_OUTSIDE_REACH");
    if (initialSpeed > speedLimit) return unreachable("INITIAL_RELATIVE_SPEED_EXCEEDS_MOTOR");
    if (!Number.isFinite(distance6)) return unreachable("NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS");
    const speedRatio = initialSpeed / speedLimit, speedSlack = (1 - speedRatio) * (1 + speedRatio), projection = distance6 === 0 ? 0 : dot12(mul2(delta, 1 / distance6), mul2(v2, 1 / speedLimit)), speedRoot = Math.sqrt(projection * projection + speedSlack), speedDenominator = projection < 0 ? speedSlack / (speedRoot - projection) : projection + speedRoot, minimumDuration = distance6 === 0 ? 0 : 3 * (distance6 / speedLimit) / speedDenominator;
    const reachRatio = initialReach / reach, reachSlack = (1 - reachRatio) * (1 + reachRatio), outward = initialSpeed === 0 ? 0 : dot12(mul2(a, 1 / reach), mul2(v2, 1 / initialSpeed)), reachRoot = Math.sqrt(outward * outward + reachSlack), reachFactor = outward > 0 ? reachSlack / (reachRoot + outward) : reachRoot - outward, maximumDuration = initialSpeed === 0 ? Infinity : 3 * (reach / initialSpeed) * reachFactor;
    if (!Number.isFinite(minimumDuration) || minimumDuration > maximumDuration || maximumDuration <= 0)
      return unreachable("NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS");
    const build = (durationSeconds, throughElapsedSeconds, fullControls, controlPointReachBoundMeters, derivativeControlSpeedBoundMps, candidateCount2) => {
      const accelerationAt2 = (u) => durationSeconds === 0 ? zero3 : add12(mul2(mul2(delta, 1 / durationSeconds), (6 - 12 * u) / durationSeconds), mul2(v2, (6 * u - 4) / durationSeconds));
      const sampleAtElapsedSeconds = (t) => {
        if (!Number.isFinite(t) || t < from || t > throughElapsedSeconds) throw new Error("live hand preparation: sample outside command interval");
        const u = durationSeconds === 0 ? 0 : (t - from) / durationSeconds;
        const offset = t === from ? a : t === throughElapsedSeconds ? b : add12(add12(a, mul2(delta, u * u * (3 - 2 * u))), mul2(v2, durationSeconds * u * (1 - u) * (1 - u))), relativeVelocity = t === from ? v2 : t === throughElapsedSeconds ? zero3 : add12(mul2(delta, 6 * u * (1 - u) / durationSeconds), mul2(v2, (1 - u) * (1 - 3 * u)));
        return Object.freeze({ offset: copy(offset), relativeVelocity: copy(relativeVelocity), relativeAcceleration: copy(accelerationAt2(u)) });
      };
      const cubicBezierControls = (startElapsedSeconds, endElapsedSeconds) => {
        if (!Number.isFinite(startElapsedSeconds) || !Number.isFinite(endElapsedSeconds) || startElapsedSeconds < from || endElapsedSeconds > throughElapsedSeconds || endElapsedSeconds < startElapsedSeconds)
          throw new Error("live hand preparation: Bezier interval outside command interval");
        if (startElapsedSeconds === from && endElapsedSeconds === throughElapsedSeconds) return fullControls;
        const start = sampleAtElapsedSeconds(startElapsedSeconds), end = sampleAtElapsedSeconds(endElapsedSeconds), third = (endElapsedSeconds - startElapsedSeconds) / 3;
        return controls(start.offset, add12(start.offset, mul2(start.relativeVelocity, third)), sub5(end.offset, mul2(end.relativeVelocity, third)), end.offset);
      };
      return Object.freeze({
        kind: "planned",
        fromElapsedSeconds: from,
        throughElapsedSeconds,
        durationSeconds,
        sampleAtElapsedSeconds,
        cubicBezierControls,
        diagnostics: Object.freeze({
          basis: "CUBIC_BEZIER_CONVEX_HULL_V1",
          maximumReachMeters: reach,
          maximumRelativeSpeedMps: speedLimit,
          controlPointReachBoundMeters,
          derivativeControlSpeedBoundMps,
          candidateCount: candidateCount2
        })
      });
    };
    if (distance6 === 0 && initialSpeed === 0) return build(0, from, controls(a, a, a, a), initialReach, 0, 0);
    const preferred = minimumDuration > 0 ? minimumDuration * 1.0625 : Math.min(1, reach / speedLimit), midpoint = minimumDuration / 2 + maximumDuration / 2, candidates = [Math.min(preferred, midpoint), minimumDuration, midpoint, maximumDuration];
    let candidateCount = 0;
    for (const candidate of candidates) {
      const through = from + candidate, duration = through - from;
      if (!Number.isFinite(candidate) || !Number.isFinite(through) || !Number.isFinite(duration) || duration <= 0) continue;
      candidateCount++;
      const fullControls = controls(a, add12(a, mul2(v2, duration / 3)), b, b), middleDerivative = sub5(mul2(delta, 3 / duration), v2), derivativeControls = fullControls.slice(1).map((point, n) => mul2(sub5(point, fullControls[n]), 3 / duration)), reachBound = Math.max(...fullControls.map(norm3)), speedBound = Math.max(initialSpeed, norm3(middleDerivative), ...derivativeControls.map(norm3)), startAcceleration = add12(mul2(mul2(delta, 1 / duration), 6 / duration), mul2(v2, -4 / duration)), endAcceleration = add12(mul2(mul2(delta, 1 / duration), -6 / duration), mul2(v2, 2 / duration));
      if (!fullControls.every(finiteVec2) || !derivativeControls.every(finiteVec2) || !finiteVec2(middleDerivative) || !finiteVec2(startAcceleration) || !finiteVec2(endAcceleration) || reachBound > reach || speedBound > speedLimit) continue;
      return build(duration, through, fullControls, reachBound, speedBound, candidateCount);
    }
    return unreachable("NO_FINITE_C1_PREPARATION_WITHIN_CONTROL_BOUNDS", candidateCount);
  }

  // src/core/sim/fielding/LiveFieldRoleAssignmentV1.ts
  var defensivePositions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  var LIVE_FIELD_ROLE_POLICY_V1 = Object.freeze({
    switchCostSeconds: 0.25,
    lateArrivalCost: 2,
    backupDepthMeters: 10,
    pickupBackupDepthMeters: 6,
    directThrowSeconds: 0.9,
    backupHomeAbandonmentCost: 0.1,
    secondaryResponsibilityCostSeconds: 1.5,
    otherResponsibilityCostSeconds: 5,
    catcherHomePriorityCostSeconds: 8,
    supportSeparationMeters: 4
  });
  var flatDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  var finite6 = (p) => p && [p.x, p.y, p.z].every(Number.isFinite);
  var freeze17 = (x) => {
    if (x && typeof x === "object") {
      Object.values(x).forEach(freeze17);
      Object.freeze(x);
    }
    return x;
  };
  function liveFieldArrivalSecondsV1(actor, target, radius = 0.28) {
    if (!finite6(actor.position) || !finite6(actor.velocity) || !finite6(target) || ![actor.accelerationMps2, actor.topSpeedMps].every((n) => Number.isFinite(n) && n > 0) || !Number.isFinite(radius) || radius < 0 || !Number.isFinite(actor.remainingReactionSeconds) || actor.remainingReactionSeconds < 0)
      throw new Error("invalid live field arrival estimate");
    let d = Math.max(0, flatDistance(actor.position, target) - radius);
    if (d === 0) return 0;
    const length = flatDistance(actor.position, target), dx = (target.x - actor.position.x) / length, dz = (target.z - actor.position.z) / length, a = actor.accelerationMps2, maximum = actor.topSpeedMps, along = actor.velocity.x * dx + actor.velocity.z * dz, lateral = Math.abs(actor.velocity.x * dz - actor.velocity.z * dx);
    let initial = Math.max(-maximum, Math.min(maximum, along)), delay = actor.remainingReactionSeconds + lateral / a;
    if (initial < 0) {
      delay -= initial / a;
      d += initial * initial / (2 * a);
      initial = 0;
    }
    const acceleratingDistance = (maximum * maximum - initial * initial) / (2 * a);
    return delay + (d <= acceleratingDistance ? (Math.sqrt(initial * initial + 2 * a * d) - initial) / a : (maximum - initial) / a + (d - acceleratingDistance) / maximum);
  }
  function liveFieldRoleCostV1(actor, role, previous) {
    const pursuit = actor.pursuitCostWeight ?? 1;
    if (!Number.isFinite(pursuit) || pursuit < 0.25 || pursuit > 4 || actor.defensivePosition !== void 0 && !defensivePositions.includes(actor.defensivePosition))
      throw new Error("invalid live field pursuit cost weight or defensive position");
    const point = role.intent === "hold" ? actor.homePosition : role.point, taskId = role.intent === "hold" ? "hold:" + actor.playerId : role.taskId, arrivalSeconds = liveFieldArrivalSecondsV1(actor, point), weight = role.intent === "base_cover" ? 4 : role.intent === "relay" ? 1 : role.intent === "backup" ? 0.25 : 0.1, homeAbandonmentSeconds = role.intent === "backup" ? flatDistance(actor.homePosition, point) / actor.topSpeedMps : 0, movementCost = weight * arrivalSeconds * (role.intent === "backup" ? pursuit : 1), homeAbandonmentCost = LIVE_FIELD_ROLE_POLICY_V1.backupHomeAbandonmentCost * homeAbandonmentSeconds * pursuit, responsibilityCost = !actor.defensivePosition || !role.responsiblePositions || role.responsiblePositions.includes(actor.defensivePosition) ? 0 : actor.defensivePosition === "C" ? LIVE_FIELD_ROLE_POLICY_V1.catcherHomePriorityCostSeconds : role.supportingPositions?.includes(actor.defensivePosition) ? LIVE_FIELD_ROLE_POLICY_V1.secondaryResponsibilityCostSeconds : LIVE_FIELD_ROLE_POLICY_V1.otherResponsibilityCostSeconds, lateCost = role.deadline === void 0 ? 0 : LIVE_FIELD_ROLE_POLICY_V1.lateArrivalCost * Math.max(0, arrivalSeconds - role.deadline), switchCost = previous && previous.taskId !== taskId ? LIVE_FIELD_ROLE_POLICY_V1.switchCostSeconds : 0;
    return Object.freeze({
      arrivalSeconds,
      homeAbandonmentSeconds,
      pursuitCostWeight: pursuit,
      movementCost,
      homeAbandonmentCost,
      responsibilityCost,
      lateCost,
      switchCost,
      total: movementCost + homeAbandonmentCost + responsibilityCost + lateCost + switchCost
    });
  }
  function assignLiveFieldRolesV1(raw) {
    const input = cloneInert(raw), actors = input.actors, ballPhase = input.ballPhase ?? "free";
    if (actors.length !== 9 || new Set(actors.map((a) => a.playerId)).size !== actors.length || actors.some((a) => !a.playerId || !finite6(a.position) || !finite6(a.velocity) || !finite6(a.homePosition) || ![a.topSpeedMps, a.accelerationMps2, a.throwSpeedMps].every((n2) => Number.isFinite(n2) && n2 > 0) || !Number.isFinite(a.remainingReactionSeconds) || a.remainingReactionSeconds < 0 || a.defensivePosition !== void 0 && !defensivePositions.includes(a.defensivePosition) || !Number.isFinite(a.pursuitCostWeight ?? 1) || (a.pursuitCostWeight ?? 1) < 0.25 || (a.pursuitCostWeight ?? 1) > 4) || !finite6(input.ballPosition) || !finite6(input.ballVelocity) || !finite6(input.pickupPoint) || !["free", "held", "throw"].includes(ballPhase) || ballPhase === "throw" && !input.activeThrow || input.activeThrow !== void 0 && (!finite6(input.activeThrow.from) || !finite6(input.activeThrow.target)) || ![1, 2, 3, 4].every((n2) => finite6(input.bases[n2]))) throw new Error("invalid live field role geometry/actors");
    const reservedIds = /* @__PURE__ */ new Set(), covered = /* @__PURE__ */ new Set(), taskIds = /* @__PURE__ */ new Set();
    for (const role of input.reservations) {
      if (!actors.some((a) => a.playerId === role.playerId) || reservedIds.has(role.playerId) || !role.taskId || taskIds.has(role.taskId) || !finite6(role.point) || !["intercept", "base_cover", "relay", "hold", "tag"].includes(role.intent) || role.intent === "relay" && role.targetBase !== null || role.targetBase !== null && ![1, 2, 3, 4].includes(role.targetBase) || role.targetBase !== null && covered.has(role.targetBase)) throw new Error("duplicate or invalid live field reservation");
      reservedIds.add(role.playerId);
      taskIds.add(role.taskId);
      if (role.targetBase !== null) covered.add(role.targetBase);
    }
    const threats = /* @__PURE__ */ new Map();
    for (const threat of input.threats) {
      if (![1, 2, 3, 4].includes(threat.base) || !Number.isFinite(threat.arrivalSeconds) || threat.arrivalSeconds < 0)
        throw new Error("invalid live field runner threat");
      threats.set(threat.base, Math.min(threats.get(threat.base) ?? Infinity, threat.arrivalSeconds));
    }
    const available = actors.filter((a) => !reservedIds.has(a.playerId)), tasks = [];
    const coverPositions = {
      1: ["1B"],
      2: ["2B", "SS"],
      3: ["3B"],
      4: ["C"]
    }, coverSupport = {
      1: ["P", "2B"],
      2: ["P", "3B"],
      3: ["SS", "P"],
      4: ["P"]
    }, backupPositions = {
      1: ["RF", "P"],
      2: ["CF", "LF", "RF"],
      3: ["LF", "P"],
      4: ["P"]
    };
    const primary = input.reservations.find((r) => r.intent === "base_cover")?.targetBase ?? [...threats].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]?.[0] ?? null;
    for (const [base, deadline] of [...threats].sort((a, b) => a[1] - b[1] || a[0] - b[0])) if (!covered.has(base))
      tasks.push({
        taskId: "cover:" + base,
        point: input.bases[base],
        intent: "base_cover",
        targetBase: base,
        deadline,
        responsiblePositions: coverPositions[base],
        supportingPositions: coverSupport[base]
      });
    const beyond = (from, target, depth, fallback) => {
      let dx = target.x - from.x, dz = target.z - from.z, length = Math.hypot(dx, dz);
      if (length === 0) {
        dx = fallback.x;
        dz = fallback.z;
        length = Math.hypot(dx, dz);
      }
      if (length === 0) return { ...target };
      return { x: target.x + dx / length * depth, y: target.y, z: target.z + dz / length * depth };
    };
    const separatedSupport = (point) => [...input.reservations, ...tasks].every((r) => r.intent === "hold" || flatDistance(point, r.point) >= LIVE_FIELD_ROLE_POLICY_V1.supportSeparationMeters);
    if ((primary !== null || input.activeThrow) && tasks.length < available.length) {
      const target = input.activeThrow?.target ?? input.bases[primary], from = input.activeThrow?.from ?? input.ballPosition, length = flatDistance(from, target), strongest = Math.max(...actors.map((a) => a.throwSpeedMps));
      const relayPoint = { x: (from.x + target.x) / 2, y: target.y, z: (from.z + target.z) / 2 };
      if (ballPhase !== "throw" && !input.reservations.some((r) => r.intent === "relay") && length > strongest * LIVE_FIELD_ROLE_POLICY_V1.directThrowSeconds && tasks.length + 1 < available.length && separatedSupport(relayPoint))
        tasks.push({
          taskId: "relay:" + primary,
          point: relayPoint,
          intent: "relay",
          targetBase: null,
          responsiblePositions: ["2B", "SS"],
          supportingPositions: ["1B", "3B"]
        });
      const backupPoint = beyond(from, target, LIVE_FIELD_ROLE_POLICY_V1.backupDepthMeters, input.activeThrow ? { x: 0, y: 0, z: 0 } : input.ballVelocity), receivingBase = [1, 2, 3, 4].find((base) => flatDistance(target, input.bases[base]) < LIVE_FIELD_ROLE_POLICY_V1.supportSeparationMeters), offBaseResponsibility = flatDistance(target, input.bases[4]) > flatDistance(input.bases[2], input.bases[4]) ? ["LF", "CF", "RF"] : ["P", "1B", "2B", "3B", "SS"];
      if (separatedSupport(backupPoint)) tasks.push({
        taskId: "throw-backup:" + (primary ?? "active"),
        point: backupPoint,
        intent: "backup",
        targetBase: null,
        responsiblePositions: input.activeThrow && receivingBase === void 0 ? offBaseResponsibility : backupPositions[receivingBase ?? primary],
        supportingPositions: ["P", "LF", "CF", "RF"]
      });
    }
    const pickupBackup = beyond(input.ballPosition, input.pickupPoint, LIVE_FIELD_ROLE_POLICY_V1.pickupBackupDepthMeters, input.ballVelocity), deepPickup = flatDistance(input.pickupPoint, input.bases[4]) > flatDistance(input.bases[2], input.bases[4]), nearHomePickup = flatDistance(input.pickupPoint, input.bases[4]) < flatDistance(input.bases[1], input.bases[4]) / 2;
    if (ballPhase === "free" && tasks.length < available.length && separatedSupport(pickupBackup) && flatDistance(input.ballPosition, input.pickupPoint) + Math.hypot(input.ballVelocity.x, input.ballVelocity.z) > 0)
      tasks.push({
        taskId: "pickup-backup",
        point: pickupBackup,
        intent: "backup",
        targetBase: null,
        responsiblePositions: deepPickup ? ["LF", "CF", "RF"] : nearHomePickup ? ["C", "P", "1B", "2B", "3B", "SS"] : ["P", "1B", "2B", "3B", "SS"],
        supportingPositions: ["LF", "CF", "RF"]
      });
    while (tasks.length < available.length)
      tasks.push({ taskId: "hold-slot:" + tasks.length, point: available[0].homePosition, intent: "hold", targetBase: null });
    if (tasks.length !== available.length) throw new Error("live field tasks exceed available actors");
    const n = available.length, size = 1 << n, costs = new Float64Array(size).fill(Infinity), parents = new Int32Array(size).fill(-1);
    costs[0] = 0;
    for (let mask2 = 0; mask2 < size; mask2++) {
      if (!Number.isFinite(costs[mask2])) continue;
      let task = 0;
      for (let bits = mask2; bits; bits &= bits - 1) task++;
      if (task === n) continue;
      for (let i = 0; i < n; i++) if (!(mask2 & 1 << i)) {
        const actor = available[i], slot = tasks[task], previous = input.previous.find((r) => r.playerId === actor.playerId), cost = costs[mask2] + liveFieldRoleCostV1(actor, slot, previous).total, next = mask2 | 1 << i;
        if (cost < costs[next]) {
          costs[next] = cost;
          parents[next] = i;
        }
      }
    }
    const result = [...input.reservations];
    let mask = size - 1;
    for (let task = n - 1; task >= 0; task--) {
      const actor = parents[mask];
      if (actor < 0) throw new Error("live field role assignment is unresolved");
      const { deadline: _deadline, responsiblePositions: _responsible, supportingPositions: _supporting, ...role } = tasks[task], player = available[actor];
      result.push({ playerId: player.playerId, ...role, ...role.intent === "hold" ? { taskId: "hold:" + player.playerId, point: player.homePosition } : {} });
      mask ^= 1 << actor;
    }
    return freeze17(actors.map((a) => result.find((r) => r.playerId === a.playerId)));
  }

  // src/core/sim/fielding/LiveThrowDirectionV1.ts
  function applyLiveThrowDirectionV1(raw) {
    const input = cloneInert(raw), finite10 = (p) => p && [p.x, p.y, p.z].every(Number.isFinite), sigma = input.standardDeviationRadians;
    if (![input.velocity, input.bodyVelocity, input.spin].every(finite10) || !Number.isFinite(sigma) || sigma < 0 || sigma > 0.12 || !Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 4294967295 || !Number.isSafeInteger(input.releaseOrdinal) || input.releaseOrdinal < 0 || input.releaseOrdinal > 4294967295)
      throw new Error("invalid live throw direction SI/seed/ordinal");
    let yawRadians = 0, pitchRadians = 0, velocity = input.velocity;
    if (sigma !== 0) {
      const rng = new SeedRoot(input.seed).streamRng(0, "fielding", "throw-direction-v1:" + input.releaseOrdinal), bound = Math.sqrt(3) * sigma;
      yawRadians = (2 * rng.nextFloat() - 1) * bound;
      pitchRadians = (2 * rng.nextFloat() - 1) * bound;
      const x = input.velocity.x - input.bodyVelocity.x, y = input.velocity.y - input.bodyVelocity.y, z = input.velocity.z - input.bodyVelocity.z, cy = Math.cos(yawRadians), sy = Math.sin(yawRadians), horizontal = { x: cy * x + sy * z, y, z: -sy * x + cy * z }, length = Math.hypot(horizontal.x, horizontal.z), axis = length === 0 ? { x: 1, z: 0 } : { x: -horizontal.z / length, z: horizontal.x / length }, cp = Math.cos(pitchRadians), sp = Math.sin(pitchRadians), dot15 = axis.x * horizontal.x + axis.z * horizontal.z;
      velocity = {
        x: input.bodyVelocity.x + horizontal.x * cp - axis.z * horizontal.y * sp + axis.x * dot15 * (1 - cp),
        y: input.bodyVelocity.y + horizontal.y * cp + (axis.z * horizontal.x - axis.x * horizontal.z) * sp,
        z: input.bodyVelocity.z + horizontal.z * cp + axis.x * horizontal.y * sp + axis.z * dot15 * (1 - cp)
      };
    }
    return Object.freeze({
      velocity: Object.freeze(velocity),
      spin: Object.freeze(input.spin),
      yawRadians,
      pitchRadians,
      standardDeviationRadians: sigma,
      seed: input.seed,
      releaseOrdinal: input.releaseOrdinal,
      distribution: "INDEPENDENT_ZERO_MEAN_BOUNDED_UNIFORM_YAW_PITCH_V1",
      speedBasis: "THROWER_BODY_RELATIVE"
    });
  }

  // src/core/sim/fielding/LiveRunnerAdvancePolicyV1.ts
  var LIVE_RUNNER_ADVANCE_POLICY_V1 = Object.freeze({
    safetyMarginSeconds: 0.35,
    recognitionSeconds: 0
  });
  function assert8(value, message) {
    if (!value) throw new Error("live runner advance: " + message);
  }
  var nonnegative = (value) => Number.isFinite(value) && value >= 0;
  function estimateLiveRunnerLegSecondsV1(distanceMeters, topSpeedMps, accelerationMps2, touchRadiusMeters = 0) {
    assert8(nonnegative(distanceMeters) && Number.isFinite(topSpeedMps) && topSpeedMps > 0 && Number.isFinite(accelerationMps2) && accelerationMps2 > 0 && nonnegative(touchRadiusMeters), "finite runner route SI required");
    if (distanceMeters <= touchRadiusMeters) return 0;
    const peak = Math.min(topSpeedMps, Math.sqrt(accelerationMps2 * distanceMeters)), accelerateFor = peak / accelerationMps2, coastFor = Math.max(0, (distanceMeters - peak * peak / accelerationMps2) / peak), duration = 2 * accelerateFor + coastFor;
    assert8(Number.isFinite(duration), "runner duration exceeds finite SI");
    if (touchRadiusMeters === 0) return duration;
    const travel = distanceMeters - touchRadiusMeters, acceleratingDistance = peak * peak / (2 * accelerationMps2), coastingDistance = peak * coastFor;
    return travel <= acceleratingDistance ? Math.sqrt(2 * travel / accelerationMps2) : travel <= acceleratingDistance + coastingDistance ? accelerateFor + (travel - acceleratingDistance) / peak : duration - Math.sqrt(2 * touchRadiusMeters / accelerationMps2);
  }
  function decideLiveRunnerAdvanceV1(input) {
    const safetyMargin = input.policy?.safetyMarginSeconds ?? LIVE_RUNNER_ADVANCE_POLICY_V1.safetyMarginSeconds, recognition = input.policy?.recognitionSeconds ?? LIVE_RUNNER_ADVANCE_POLICY_V1.recognitionSeconds, reaction = input.runner.reactionSeconds;
    assert8(nonnegative(input.nowSeconds) && nonnegative(input.playStartedAtSeconds) && input.playStartedAtSeconds <= input.nowSeconds, "finite ordered play clock required");
    assert8([0, 1, 2, 3].includes(input.currentBase) && typeof input.targetOccupied === "boolean" && typeof input.forced === "boolean", "explicit runner base and obligation required");
    assert8(input.outs === void 0 || [0, 1, 2].includes(input.outs), "invalid active out count");
    assert8(nonnegative(reaction) && nonnegative(safetyMargin) && nonnegative(recognition), "finite reaction and policy SI required");
    assert8(input.awardThroughBase === void 0 || input.awardThroughBase === null || [1, 2, 3, 4].includes(input.awardThroughBase), "invalid physical award target");
    const cues = [input.firstGroundContactElapsedSeconds, input.firstFielderTouchElapsedSeconds];
    assert8(
      cues.every((cue) => cue === null || nonnegative(cue) && cue >= input.playStartedAtSeconds && cue <= input.nowSeconds),
      "departure cue must be an occurred physical event"
    );
    assert8(
      input.defenderControlSeconds === null || nonnegative(input.defenderControlSeconds) || input.defenderControlSeconds === Infinity,
      "invalid defense control forecast"
    );
    const runnerTravelSeconds = estimateLiveRunnerLegSecondsV1(
      input.distanceToNextBaseMeters,
      input.runner.topSpeedMps,
      input.runner.accelerationMps2,
      input.baseTouchRadiusMeters ?? 0
    ), award = input.awardThroughBase !== void 0 && input.awardThroughBase !== null && input.awardThroughBase > input.currentBase, batter = input.currentBase === 0, twoOuts = input.outs === 2 && input.firstGroundContactElapsedSeconds === null && input.firstFielderTouchElapsedSeconds === null, groundedForce = input.forced && input.firstGroundContactElapsedSeconds !== null, available = cues.filter((cue) => cue !== null), legalCue = batter || award || twoOuts ? input.playStartedAtSeconds : groundedForce ? input.firstGroundContactElapsedSeconds : available.length ? Math.min(...available) : null, readyAtElapsedSeconds = legalCue === null ? null : legalCue + (reaction + recognition);
    assert8(readyAtElapsedSeconds === null || Number.isFinite(readyAtElapsedSeconds), "recognition exceeds finite play clock");
    const runnerArrivalSeconds = readyAtElapsedSeconds === null ? null : Math.max(0, readyAtElapsedSeconds - input.nowSeconds) + runnerTravelSeconds, raceMarginSeconds = input.defenderControlSeconds === null || runnerArrivalSeconds === null ? null : input.defenderControlSeconds - runnerArrivalSeconds;
    const result = (advance, reason) => Object.freeze({
      advance,
      reason,
      readyAtElapsedSeconds,
      runnerTravelSeconds,
      runnerArrivalSeconds,
      raceMarginSeconds
    });
    if (input.targetOccupied) return result(false, "target_occupied");
    if (readyAtElapsedSeconds === null) return result(false, "awaiting_legal_departure");
    if (input.nowSeconds < readyAtElapsedSeconds) return result(false, "recognizing_departure_cue");
    if (award) return result(true, "award_advance");
    if (batter) return result(true, "batter_advance");
    if (twoOuts) return result(true, "two_out_advance");
    if (groundedForce) return result(true, "forced_advance");
    if (raceMarginSeconds === null) return result(false, "no_defense_forecast");
    return raceMarginSeconds > safetyMargin ? result(true, "safe_race_advance") : result(false, "insufficient_safety_margin");
  }

  // src/core/sim/fielding/LiveFieldHandlerSelectionV1.ts
  var LIVE_FIELD_HANDLER_POLICY_V1 = Object.freeze({
    interceptionWindowSeconds: 0,
    switchBurdenSeconds: 0.25,
    minimumPursuitCostWeight: 0.25,
    maximumPursuitCostWeight: 4
  });
  function selectLiveFieldHandlerV1(input) {
    const window = input.interceptionWindowSeconds ?? LIVE_FIELD_HANDLER_POLICY_V1.interceptionWindowSeconds;
    if (!Number.isFinite(window) || window < 0 || window > 0.1 || new Set(input.candidates.map((c) => c.playerId)).size !== input.candidates.length || input.candidates.some((c) => !c.playerId || typeof c.intercepted !== "boolean" || ![c.interceptSeconds, c.arrivalSeconds, c.travelDistanceMeters].every((n) => Number.isFinite(n) && n >= 0) || !Number.isFinite(c.approachPenaltySeconds ?? 0) || (c.approachPenaltySeconds ?? 0) < 0 || !Number.isFinite(c.pursuitCostWeight ?? 1) || (c.pursuitCostWeight ?? 1) < 0.25 || (c.pursuitCostWeight ?? 1) > 4))
      throw new Error("invalid live field handler candidates/policy");
    const feasible = input.candidates.filter((c) => c.intercepted), pool = feasible.length ? feasible : input.candidates;
    if (!pool.length) return Object.freeze({
      playerId: null,
      intercepted: false,
      retained: false,
      earliestInterceptSeconds: null,
      arrivalBurdenSeconds: null,
      eligiblePlayerIds: Object.freeze([])
    });
    const earliest = Math.min(...pool.map((c) => c.interceptSeconds)), eligible = pool.filter((c) => c.interceptSeconds <= earliest + window), burden = (c) => (c.arrivalSeconds + (c.approachPenaltySeconds ?? 0)) * (c.pursuitCostWeight ?? 1), ranked = [...eligible].sort((a, b) => burden(a) - burden(b) || a.travelDistanceMeters * (a.pursuitCostWeight ?? 1) - b.travelDistanceMeters * (b.pursuitCostWeight ?? 1)), best = ranked[0], incumbent = eligible.find((c) => c.playerId === input.previousPlayerId), chosen = incumbent && burden(incumbent) <= burden(best) + LIVE_FIELD_HANDLER_POLICY_V1.switchBurdenSeconds ? incumbent : best;
    return Object.freeze({
      playerId: chosen.playerId,
      intercepted: chosen.intercepted,
      retained: chosen === incumbent,
      earliestInterceptSeconds: earliest,
      arrivalBurdenSeconds: burden(chosen),
      eligiblePlayerIds: Object.freeze(eligible.map((c) => c.playerId))
    });
  }

  // src/core/sim/fielding/LiveRelayPlanV1.ts
  var LIVE_RELAY_PLAN_POLICY_V1 = Object.freeze({
    maximumIntermediateReceivers: 2,
    maximumEvaluatedRoutes: 8,
    minimumProgressMeters: 0.28,
    baseTouchRadiusMeters: 0.28
  });
  var add13 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  var sub6 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  var mul3 = (p, scale12) => ({ x: p.x * scale12, y: p.y * scale12, z: p.z * scale12 });
  var norm4 = (p) => Math.hypot(p.x, p.y, p.z);
  var flatDistance2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  var finite7 = (p) => !!p && [p.x, p.y, p.z].every(Number.isFinite);
  var freeze18 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze18);
      Object.freeze(value);
    }
    return value;
  };
  var allowedInputKeys = [
    "actors",
    "holderPlayerId",
    "receiverPlayerId",
    "finalBase",
    "runnerId",
    "target",
    "runnerArrivalSeconds",
    "holderTransferRemainingSeconds",
    "physics",
    "throwHandOffset",
    "maximumIntermediateReceivers",
    "minimumMarginSeconds",
    "excludedRelayPlayerIds"
  ];
  function planLiveRelayV1(raw) {
    const input = cloneInert(raw), policy = LIVE_RELAY_PLAN_POLICY_V1, maximumIntermediateReceivers = input.maximumIntermediateReceivers ?? policy.maximumIntermediateReceivers, minimumMargin = input.minimumMarginSeconds ?? 0;
    if (!input || Object.keys(input).some((key3) => !allowedInputKeys.includes(key3)) || !Array.isArray(input.actors) || input.actors.length < 2 || input.actors.length > 9 || new Set(input.actors.map((a) => a.playerId)).size !== input.actors.length || ![1, 2, 3, 4].includes(input.finalBase) || !input.runnerId || !finite7(input.target) || ![input.runnerArrivalSeconds, input.holderTransferRemainingSeconds, minimumMargin].every((n) => Number.isFinite(n) && n >= 0) || ![0, 1, 2].includes(maximumIntermediateReceivers) || input.excludedRelayPlayerIds !== void 0 && (!Array.isArray(input.excludedRelayPlayerIds) || input.excludedRelayPlayerIds.some((id6) => typeof id6 !== "string" || !id6)) || !input.throwHandOffset || ![input.throwHandOffset.forwardMeters, input.throwHandOffset.heightAboveHipMeters].every((n) => Number.isFinite(n) && n >= 0) || input.actors.some((a) => !a.playerId || ![a.position, a.velocity, a.homePosition, a.glovePosition, a.gloveVelocity].every(finite7) || ![a.topSpeedMps, a.accelerationMps2, a.throwSpeedMps, a.gloveSpeedMps, a.gloveReachMeters, a.gloveRadiusMeters].every((n) => Number.isFinite(n) && n > 0) || a.throwSpeedMps > 120 || ![a.remainingReactionSeconds, a.transferSeconds].every((n) => Number.isFinite(n) && n >= 0) || !Number.isFinite(a.throwDirectionStdRadians ?? 0) || (a.throwDirectionStdRadians ?? 0) < 0 || (a.throwDirectionStdRadians ?? 0) > 0.12 || !Number.isFinite(a.throwBackspinRadPerSecond ?? 0) || (a.throwBackspinRadPerSecond ?? 0) < 0 || a.throwSpinRadPerSecond !== void 0 && !finite7(a.throwSpinRadPerSecond))) throw new Error("invalid live relay plan actors, target or policy");
    const holder = input.actors.find((a) => a.playerId === input.holderPlayerId), receiver = input.actors.find((a) => a.playerId === input.receiverPlayerId);
    if (!holder || !receiver || holder === receiver || !Number.isFinite(input.physics?.ground?.radiusM) || input.target.y < input.physics.ground.radiusM || input.actors.some((a) => a.glovePosition.y < input.physics.ground.radiusM))
      throw new Error("invalid live relay holder, receiver or airborne target");
    const relayBodyPoint = (a) => {
      const speed2 = Math.hypot(a.velocity.x, a.velocity.z), factor = speed2 / (2 * a.accelerationMps2);
      return { x: a.position.x + a.velocity.x * factor, y: a.position.y, z: a.position.z + a.velocity.z * factor };
    }, bodyPoint = (a) => a === holder ? a.position : relayBodyPoint(a), point = (a) => a === receiver ? input.target : add13(relayBodyPoint(a), sub6(a.glovePosition, a.position)), receiverPoint = (a) => a === receiver ? { x: input.target.x, y: a.position.y, z: input.target.z } : relayBodyPoint(a), remainingDistance = (a) => flatDistance2(bodyPoint(a), input.target), progresses = (from, to) => to === receiver || remainingDistance(to) + policy.minimumProgressMeters < remainingDistance(from);
    const handOffset = (from, target) => {
      const origin = bodyPoint(from), direction = { x: target.x - origin.x, y: 0, z: target.z - origin.z }, length = norm4(direction), desired = add13(
        mul3(direction, input.throwHandOffset.forwardMeters / Math.max(length, 1e-30)),
        { x: 0, y: input.throwHandOffset.heightAboveHipMeters, z: 0 }
      );
      return mul3(desired, Math.min(1, from.gloveReachMeters / Math.max(norm4(desired), 1e-30)));
    };
    const edgeGeometry = (from, to) => {
      const target = point(to), offset = handOffset(from, target), preparation = createLiveHandPreparationV1({
        fromElapsedSeconds: 0,
        initialOffset: sub6(from.glovePosition, from.position),
        initialRelativeVelocity: from === holder ? sub6(from.gloveVelocity, from.velocity) : { x: 0, y: 0, z: 0 },
        targetOffset: offset,
        maximumRelativeSpeedMps: from.gloveSpeedMps,
        maximumReachMeters: from.gloveReachMeters
      }), releasePosition = add13(bodyPoint(from), offset), bodyVelocity = from === holder ? from.velocity : { x: 0, y: 0, z: 0 }, d = sub6(target, releasePosition), horizontal = Math.hypot(d.x, d.z), backspin = from.throwBackspinRadPerSecond ?? 0, spin = from.throwSpinRadPerSecond ?? (horizontal > 0 ? { x: -d.z / horizontal * backspin, y: 0, z: d.x / horizontal * backspin } : { x: 0, y: 0, z: 0 });
      return {
        target,
        receiverPoint: receiverPoint(to),
        releasePosition,
        bodyVelocity,
        spin,
        preparationSeconds: preparation.kind === "planned" ? preparation.durationSeconds : Infinity,
        transferSeconds: from === holder ? input.holderTransferRemainingSeconds : from.transferSeconds,
        receiverArrivalSeconds: Math.max(
          liveFieldArrivalSecondsV1(to, receiverPoint(to), policy.baseTouchRadiusMeters),
          to === receiver ? 0 : Math.hypot(to.velocity.x, to.velocity.z) / to.accelerationMps2
        ),
        acquisitionSeconds: (to.gloveRadiusMeters + input.physics.ground.radiusM) / to.gloveSpeedMps,
        // An inspectable correction-time cost, not a calibrated success chance.
        directionRecoveryCostSeconds: flatDistance2(releasePosition, target) * Math.tan(from.throwDirectionStdRadians ?? 0) / to.gloveSpeedMps
      };
    };
    const geometryCache = /* @__PURE__ */ new Map(), geometry = (from, to) => {
      const key3 = input.actors.indexOf(from) + ":" + input.actors.indexOf(to);
      let result = geometryCache.get(key3);
      if (!result) {
        result = edgeGeometry(from, to);
        geometryCache.set(key3, result);
      }
      return result;
    };
    const intermediates = input.actors.filter((a) => a !== holder && a !== receiver && !input.excludedRelayPlayerIds?.includes(a.playerId) && progresses(holder, a));
    const routes = [[holder, receiver]];
    if (maximumIntermediateReceivers > 0) for (const a of intermediates) {
      routes.push([holder, a, receiver]);
      if (maximumIntermediateReceivers > 1) {
        for (const b of intermediates) if (b !== a && progresses(a, b)) routes.push([holder, a, b, receiver]);
      }
    }
    const cheapCost = (route) => {
      let seconds = 0, risk = 0;
      for (let i = 1; i < route.length; i++) {
        const from = route[i - 1], to = route[i], g = geometry(from, to), flight = Math.max(0.05, norm4(sub6(g.target, g.releasePosition)) / (from.throwSpeedMps + norm4(g.bodyVelocity)));
        seconds = Math.max(seconds + g.transferSeconds + g.preparationSeconds + flight, g.receiverArrivalSeconds) + g.acquisitionSeconds;
        risk += g.directionRecoveryCostSeconds;
      }
      return seconds + risk;
    };
    const selected = [{ route: routes[0], cost: cheapCost(routes[0]) }, ...routes.slice(1).map((route, index) => ({ route, index, cost: cheapCost(route) })).sort((a, b) => a.cost - b.cost || a.route.length - b.route.length || a.index - b.index).slice(0, policy.maximumEvaluatedRoutes - 1)];
    const aeroCache = /* @__PURE__ */ new Map();
    let aerodynamicSolveCount = 0, aerodynamicCacheHits = 0, evaluatedRouteCount = 0, directSeconds = Infinity;
    let best = null;
    for (const candidate of selected) {
      if (best && candidate.cost >= best.costSeconds) continue;
      const route = candidate.route;
      evaluatedRouteCount++;
      let seconds = 0, risk = 0, feasible = true;
      const legs2 = [];
      for (let i = 1; i < route.length; i++) {
        const from = route[i - 1], to = route[i], g = geometry(from, to);
        if (!Number.isFinite(g.preparationSeconds)) {
          feasible = false;
          break;
        }
        const key3 = input.actors.indexOf(from) + ":" + input.actors.indexOf(to);
        let aero = aeroCache.get(key3);
        if (!aero) {
          aerodynamicSolveCount++;
          aero = planLiveThrowV1({
            releasePosition: g.releasePosition,
            bodyVelocity: g.bodyVelocity,
            maximumThrowSpeedMps: from.throwSpeedMps,
            spin: g.spin,
            physics: input.physics,
            target: g.target
          });
          aeroCache.set(key3, aero);
        } else aerodynamicCacheHits++;
        if (aero.kind !== "planned") {
          feasible = false;
          break;
        }
        const earliestArrival = seconds + g.transferSeconds + g.preparationSeconds + aero.flightSeconds, waitingSeconds = Math.max(0, g.receiverArrivalSeconds - earliestArrival);
        seconds = earliestArrival + waitingSeconds + g.acquisitionSeconds;
        risk += g.directionRecoveryCostSeconds;
        legs2.push({
          throwerPlayerId: from.playerId,
          receiverPlayerId: to.playerId,
          target: g.target,
          receiverPoint: g.receiverPoint,
          intent: to === receiver ? "base_cover" : "relay",
          releasePosition: g.releasePosition,
          bodyVelocity: g.bodyVelocity,
          spin: g.spin,
          transferSeconds: g.transferSeconds,
          preparationSeconds: g.preparationSeconds,
          receiverArrivalSeconds: g.receiverArrivalSeconds,
          waitingSeconds,
          flightSeconds: aero.flightSeconds,
          readySeconds: seconds,
          directionRecoveryCostSeconds: g.directionRecoveryCostSeconds,
          initialVelocity: aero.initialVelocity
        });
      }
      if (!feasible) continue;
      if (route.length === 2) directSeconds = seconds;
      const costSeconds2 = seconds + risk;
      if (!best || costSeconds2 < best.costSeconds) best = { legs: legs2, readySeconds: seconds, costSeconds: costSeconds2 };
    }
    const carrySeconds = liveFieldArrivalSecondsV1({ ...holder, remainingReactionSeconds: 0 }, input.target, policy.baseTouchRadiusMeters), carryPreferred = !best || carrySeconds <= best.costSeconds, readySeconds = carryPreferred ? carrySeconds : best.readySeconds, costSeconds = carryPreferred ? carrySeconds : best.costSeconds, marginSeconds = input.runnerArrivalSeconds - costSeconds - minimumMargin, legs = !carryPreferred && marginSeconds > 0 ? best.legs : [], first = legs[0], kind = marginSeconds <= 0 ? "hold" : carryPreferred ? "carry" : legs.length === 1 ? "direct" : "relay";
    return freeze18({
      kind,
      finalBase: input.finalBase,
      runnerId: input.runnerId,
      readySeconds,
      marginSeconds,
      costSeconds,
      carrySeconds,
      directSeconds,
      firstHop: first ? { receiverPlayerId: first.receiverPlayerId, target: first.target, receiverPoint: first.receiverPoint, intent: first.intent } : null,
      legs,
      diagnostics: {
        basis: "BOUNDED_AERO_RELAY_COMMAND_PREDICTION_V1",
        actualSourceRead: false,
        actualCatchGuaranteed: false,
        replanAfterReceiptRequired: true,
        candidateRouteCount: routes.length,
        evaluatedRouteCount,
        aerodynamicSolveCount,
        aerodynamicCacheHits,
        maximumIntermediateReceivers,
        maximumEvaluatedRoutes: policy.maximumEvaluatedRoutes,
        directReachable: Number.isFinite(directSeconds)
      }
    });
  }

  // src/core/sim/running/RunnerRoute.ts
  var EPSILON15 = 1e-12;
  var CONTINUITY_TOLERANCE_METERS = 1e-9;
  var validateVec2 = (name, value) => {
    if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
      throw new Error(`${name} must be finite`);
    }
  };
  var distance4 = (first, second) => Math.hypot(
    second.x - first.x,
    second.z - first.z
  );
  var arcPoint = (center, radiusMeters, angleRadians) => ({
    x: center.x + radiusMeters * Math.cos(angleRadians),
    z: center.z + radiusMeters * Math.sin(angleRadians)
  });
  var segmentStart = (segment) => {
    if (segment.kind === "line") {
      return segment.start;
    }
    return arcPoint(
      segment.center,
      segment.radiusMeters,
      segment.startAngleRadians
    );
  };
  var segmentEnd = (segment) => {
    if (segment.kind === "line") {
      return segment.end;
    }
    return arcPoint(
      segment.center,
      segment.radiusMeters,
      segment.startAngleRadians + segment.sweepRadians
    );
  };
  var segmentLength = (segment) => {
    if (segment.kind === "line") {
      return distance4(segment.start, segment.end);
    }
    return segment.radiusMeters * Math.abs(segment.sweepRadians);
  };
  var validateSegment2 = (segment, index) => {
    if (segment.kind === "line") {
      validateVec2(`segments[${index}].start`, segment.start);
      validateVec2(`segments[${index}].end`, segment.end);
      if (segmentLength(segment) <= EPSILON15) {
        throw new Error("runner route line segments must have positive length");
      }
      return;
    }
    validateVec2(`segments[${index}].center`, segment.center);
    if (!Number.isFinite(segment.radiusMeters) || segment.radiusMeters <= 0) {
      throw new Error("runner route arc radiusMeters must be finite and positive");
    }
    if (!Number.isFinite(segment.startAngleRadians)) {
      throw new Error("runner route arc startAngleRadians must be finite");
    }
    if (!Number.isFinite(segment.sweepRadians) || Math.abs(segment.sweepRadians) <= EPSILON15) {
      throw new Error("runner route arc sweepRadians must be finite and non-zero");
    }
  };
  var validateRoute = (route) => {
    if (route.segments.length === 0) {
      throw new Error("runner route must contain at least one segment");
    }
    const lengths = [];
    for (let index = 0; index < route.segments.length; index += 1) {
      const segment = route.segments[index];
      validateSegment2(segment, index);
      lengths.push(segmentLength(segment));
      if (index > 0) {
        const previousEnd = segmentEnd(route.segments[index - 1]);
        const currentStart = segmentStart(segment);
        if (distance4(previousEnd, currentStart) > CONTINUITY_TOLERANCE_METERS) {
          throw new Error("runner route segments must be continuous");
        }
      }
    }
    return lengths;
  };
  var getRunnerRouteLength = (route) => validateRoute(route).reduce((sum, value) => sum + value, 0);
  var sampleLine = (segment, localDistanceMeters, lengthMeters) => {
    const dx = segment.end.x - segment.start.x;
    const dz = segment.end.z - segment.start.z;
    const tangent = {
      x: dx / lengthMeters,
      z: dz / lengthMeters
    };
    const fraction = localDistanceMeters / lengthMeters;
    return {
      position: {
        x: segment.start.x + dx * fraction,
        z: segment.start.z + dz * fraction
      },
      tangent
    };
  };
  var sampleArc = (segment, localDistanceMeters) => {
    const sweepDirection = Math.sign(segment.sweepRadians);
    const angle2 = segment.startAngleRadians + sweepDirection * localDistanceMeters / segment.radiusMeters;
    return {
      position: arcPoint(segment.center, segment.radiusMeters, angle2),
      tangent: {
        x: -Math.sin(angle2) * sweepDirection,
        z: Math.cos(angle2) * sweepDirection
      }
    };
  };
  var sampleRunnerRoute = (route, distanceMeters) => {
    if (!Number.isFinite(distanceMeters)) {
      throw new Error("distanceMeters must be finite");
    }
    const lengths = validateRoute(route);
    const totalLength = lengths.reduce((sum, value) => sum + value, 0);
    if (distanceMeters < -EPSILON15 || distanceMeters - totalLength > EPSILON15) {
      throw new Error("distanceMeters must lie on the runner route");
    }
    const authoritativeDistance = Math.min(totalLength, Math.max(0, distanceMeters));
    let traversed = 0;
    for (let index = 0; index < route.segments.length; index += 1) {
      const segment = route.segments[index];
      const lengthMeters = lengths[index];
      const segmentEndDistance = traversed + lengthMeters;
      if (authoritativeDistance <= segmentEndDistance + EPSILON15 || index === route.segments.length - 1) {
        const localDistanceMeters = Math.min(
          lengthMeters,
          Math.max(0, authoritativeDistance - traversed)
        );
        const sampled = segment.kind === "line" ? sampleLine(segment, localDistanceMeters, lengthMeters) : sampleArc(segment, localDistanceMeters);
        return {
          position: sampled.position,
          tangent: sampled.tangent,
          segmentIndex: index,
          distanceMeters: authoritativeDistance
        };
      }
      traversed = segmentEndDistance;
    }
    throw new Error("runner route sampling failed");
  };

  // src/core/sim/running/LiveRunnerMotionV1.ts
  var EPSILON16 = 1e-10;
  var TWO_PI = 2 * Math.PI;
  var add14 = (a, b) => ({ x: a.x + b.x, z: a.z + b.z });
  var sub7 = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
  var mul4 = (a, n) => ({ x: a.x * n, z: a.z * n });
  var norm5 = (a) => Math.hypot(a.x, a.z);
  var dot13 = (a, b) => a.x * b.x + a.z * b.z;
  var normal3 = (a) => ({ x: -a.z, z: a.x });
  var unit3 = (a) => mul4(a, 1 / norm5(a));
  var angle = (a) => Math.atan2(a.z, a.x);
  var polar = (a) => ({ x: Math.cos(a), z: Math.sin(a) });
  var positiveAngle = (a) => (a % TWO_PI + TWO_PI) % TWO_PI;
  var finite8 = (a) => !!a && Number.isFinite(a.x) && Number.isFinite(a.z);
  var segmentLength2 = (s) => s.kind === "line" ? norm5(sub7(s.end, s.start)) : s.radiusMeters * Math.abs(s.sweepRadians);
  var arc = (center, radiusMeters, from, to, direction) => ({
    kind: "arc",
    center,
    radiusMeters,
    startAngleRadians: angle(sub7(from, center)),
    sweepRadians: direction * positiveAngle(direction * (angle(sub7(to, center)) - angle(sub7(from, center))))
  });
  function connect(from, heading, to, endHeading, radius) {
    if (norm5(sub7(from, to)) <= EPSILON16 && dot13(heading, endHeading) > 1 - EPSILON16) return [];
    const candidates = [];
    for (const left of [-1, 1]) for (const right of [-1, 1]) {
      const first = add14(from, mul4(normal3(heading), left * radius));
      const last = add14(to, mul4(normal3(endHeading), right * radius));
      const delta = sub7(last, first), length = norm5(delta), shift = (left - right) * radius;
      if (length > EPSILON16 && length + EPSILON16 >= Math.abs(shift)) {
        const tangent = polar(angle(delta) + Math.asin(Math.max(-1, Math.min(1, shift / length))));
        const a = sub7(first, mul4(normal3(tangent), left * radius));
        const b = sub7(last, mul4(normal3(tangent), right * radius));
        candidates.push([arc(first, radius, from, a, left), { kind: "line", start: a, end: b }, arc(last, radius, b, to, right)]);
      }
      if (left !== right || length > 4 * radius + EPSILON16) continue;
      if (length <= EPSILON16) {
        candidates.push([arc(first, radius, from, to, left)]);
        continue;
      }
      const midpoint = mul4(add14(first, last), 0.5);
      const offset = Math.sqrt(Math.max(0, 4 * radius * radius - 0.25 * length * length));
      for (const side of [-1, 1]) {
        const middle = add14(midpoint, mul4(normal3(unit3(delta)), side * offset));
        const a = mul4(add14(first, middle), 0.5), b = mul4(add14(middle, last), 0.5);
        candidates.push([arc(first, radius, from, a, left), arc(middle, radius, a, b, -left), arc(last, radius, b, to, left)]);
      }
    }
    const cleaned = candidates.map((parts) => parts.filter((part) => segmentLength2(part) > EPSILON16)).filter((parts) => {
      const winding = parts.reduce((sum, s) => sum + (s.kind === "arc" ? Math.abs(s.sweepRadians) : 0), 0);
      const pathLength = parts.reduce((sum, s) => sum + segmentLength2(s), 0);
      return winding <= Math.PI + EPSILON16 && pathLength <= norm5(sub7(to, from)) + 2 * radius + EPSILON16;
    });
    cleaned.sort((a, b) => a.reduce((sum, s) => sum + segmentLength2(s), 0) - b.reduce((sum, s) => sum + segmentLength2(s), 0));
    return cleaned[0] ?? null;
  }
  function buildRoute(input, radius, lateral, initialSpeed) {
    const segments = [], centerDistances = [];
    const append = (parts) => {
      segments.push(...parts);
    };
    const length = () => segments.reduce((sum, s) => sum + segmentLength2(s), 0);
    let position = input.position;
    let heading = initialSpeed > EPSILON16 ? unit3(input.velocity) : unit3(sub7(input.bases[0].position, position));
    for (let index = 0; index < input.bases.length; index++) {
      const bag = input.bases[index].position;
      const previous = index ? input.bases[index - 1].position : input.position;
      const incoming = unit3(sub7(bag, previous));
      const connectorRadius = segments.length === 0 ? Math.max(radius, initialSpeed * initialSpeed / lateral) : radius;
      if (index === input.bases.length - 1) {
        const connector2 = connect(position, heading, bag, incoming, connectorRadius);
        if (!connector2) return null;
        append(connector2);
        centerDistances.push(length());
        break;
      }
      const outgoing = unit3(sub7(input.bases[index + 1].position, bag));
      const turn = Math.atan2(incoming.x * outgoing.z - incoming.z * outgoing.x, dot13(incoming, outgoing));
      if (Math.abs(turn) < EPSILON16) {
        const connector2 = connect(position, heading, bag, incoming, connectorRadius);
        if (!connector2) return null;
        append(connector2);
        centerDistances.push(length());
        position = bag;
        heading = incoming;
        continue;
      }
      const sign = Math.sign(turn), middleHeading = polar(angle(incoming) + turn / 2);
      const center = add14(bag, mul4(normal3(middleHeading), sign * radius));
      const entry = sub7(center, mul4(normal3(incoming), sign * radius));
      const exit = sub7(center, mul4(normal3(outgoing), sign * radius));
      const connector = connect(position, heading, entry, incoming, connectorRadius);
      if (!connector) return null;
      append(connector);
      const beforeArc = length();
      append([{ kind: "arc", center, radiusMeters: radius, startAngleRadians: angle(sub7(entry, center)), sweepRadians: turn }]);
      centerDistances.push(beforeArc + radius * Math.abs(turn) / 2);
      position = exit;
      heading = outgoing;
    }
    const route = { segments };
    return { route, centerDistances, lengthMeters: getRunnerRouteLength(route) };
  }
  function buildSpeedSegments(route, initialSpeed, topSpeed, acceleration, braking, lateral) {
    const lengths = route.segments.map(segmentLength2);
    const caps = route.segments.map((s) => s.kind === "line" ? topSpeed : Math.min(topSpeed, Math.sqrt(lateral * s.radiusMeters)));
    if (initialSpeed > caps[0] + EPSILON16) return null;
    const speeds = [initialSpeed];
    for (let i = 0; i < lengths.length; i++) speeds.push(Math.min(
      i === lengths.length - 1 ? 0 : Math.min(caps[i], caps[i + 1]),
      Math.sqrt(speeds[i] * speeds[i] + 2 * acceleration * lengths[i])
    ));
    for (let i = lengths.length - 1; i >= 0; i--) speeds[i] = Math.min(speeds[i], Math.sqrt(speeds[i + 1] ** 2 + 2 * braking * lengths[i]));
    if (speeds[0] < initialSpeed - EPSILON16) return null;
    speeds[0] = initialSpeed;
    const segments = [];
    let time = 0, distance6 = 0;
    const append = (duration, startSpeed, a, endDistance) => {
      if (duration <= 0) return;
      segments.push({
        startElapsedSeconds: time,
        endElapsedSeconds: time + duration,
        startDistanceMeters: distance6,
        endDistanceMeters: endDistance,
        startSpeedMps: startSpeed,
        accelerationMps2: a
      });
      time += duration;
      distance6 = endDistance;
    };
    for (let i = 0; i < lengths.length; i++) {
      const from = speeds[i], to = speeds[i + 1], startDistance = distance6;
      const peak = Math.min(caps[i], Math.sqrt((2 * acceleration * braking * lengths[i] + braking * from ** 2 + acceleration * to ** 2) / (acceleration + braking)));
      const acceleratingDistance = Math.max(0, (peak ** 2 - from ** 2) / (2 * acceleration));
      const brakingDistance = Math.max(0, (peak ** 2 - to ** 2) / (2 * braking));
      const coastingDistance = Math.max(0, lengths[i] - acceleratingDistance - brakingDistance);
      append(Math.max(0, (peak - from) / acceleration), from, acceleration, startDistance + acceleratingDistance);
      append(coastingDistance / peak, peak, 0, startDistance + acceleratingDistance + coastingDistance);
      append(Math.max(0, (peak - to) / braking), peak, -braking, startDistance + lengths[i]);
    }
    return { segments, durationSeconds: time };
  }
  function firstTouchDistance(route, bag, radius, centerDistance) {
    let traversed = 0;
    for (const part of route.segments) {
      const length = segmentLength2(part), maximum = Math.min(length, centerDistance - traversed);
      if (maximum < -EPSILON16) break;
      const candidates = [0];
      if (part.kind === "line") {
        const heading = unit3(sub7(part.end, part.start)), offset = sub7(part.start, bag), b = dot13(offset, heading);
        const discriminant = b * b - dot13(offset, offset) + radius * radius;
        if (discriminant >= 0) candidates.push(-b - Math.sqrt(discriminant), -b + Math.sqrt(discriminant));
      } else {
        const offset = sub7(bag, part.center), d = norm5(offset);
        if (d > 0) {
          const cosine = (part.radiusMeters ** 2 + d * d - radius * radius) / (2 * part.radiusMeters * d);
          if (cosine >= -1 && cosine <= 1) for (const sign of [-1, 1]) {
            const theta = angle(offset) + sign * Math.acos(cosine);
            candidates.push(part.radiusMeters * positiveAngle(Math.sign(part.sweepRadians) * (theta - part.startAngleRadians)));
          }
        }
      }
      candidates.sort((a, b) => a - b);
      for (const local of candidates) {
        if (local < -EPSILON16 || local > maximum + EPSILON16) continue;
        let candidate = Math.max(traversed, Math.min(centerDistance, traversed + local));
        for (let attempt = 0; attempt < 12; attempt++) {
          if (norm5(sub7(sampleRunnerRoute(route, candidate).position, bag)) <= radius) return candidate;
          candidate = Math.min(centerDistance, candidate + Number.EPSILON * Math.max(1, centerDistance) * 2 ** attempt);
        }
      }
      traversed += length;
    }
    if (norm5(sub7(sampleRunnerRoute(route, centerDistance).position, bag)) <= radius) return centerDistance;
    throw new Error("live runner motion: planned base lacks a physical touch");
  }
  function createLiveRunnerMotionV1(input) {
    const braking = input.brakingMps2 ?? input.accelerationMps2;
    const radius = input.roundingRadiusMeters ?? 4.5;
    const lateral = input.lateralAccelerationMps2 ?? 1.5 * input.accelerationMps2;
    const touchRadius = input.baseTouchRadiusMeters ?? 0.28;
    if (!finite8(input.position) || input.velocity && !finite8(input.velocity) || !input.bases.length || !input.bases.every((b) => Number.isInteger(b.base) && b.base >= 1 && b.base <= 4 && finite8(b.position)) || ![input.topSpeedMps, input.accelerationMps2, braking, radius, lateral, touchRadius].every((n) => Number.isFinite(n) && n > 0)) {
      throw new Error("live runner motion: finite positive motor and base geometry required");
    }
    let previous = input.position;
    for (const bag of input.bases) {
      if (norm5(sub7(bag.position, previous)) <= EPSILON16) throw new Error("live runner motion: consecutive positions must differ");
      previous = bag.position;
    }
    const initialSpeed = input.velocity ? norm5(input.velocity) : 0;
    if (initialSpeed > input.topSpeedMps + EPSILON16) return null;
    const geometry = buildRoute(input, radius, lateral, initialSpeed);
    if (!geometry) return null;
    const timing = buildSpeedSegments(geometry.route, initialSpeed, input.topSpeedMps, input.accelerationMps2, braking, lateral);
    if (!timing) return null;
    const elapsedSecondsAtDistanceMeters = (rawDistance) => {
      if (!Number.isFinite(rawDistance) || rawDistance < 0 || rawDistance > geometry.lengthMeters + EPSILON16)
        throw new Error("live runner motion: distance must lie on finite route");
      const distance6 = Math.min(rawDistance, geometry.lengthMeters);
      if (distance6 === geometry.lengthMeters) return timing.durationSeconds;
      const s = timing.segments.find((s2) => distance6 <= s2.endDistanceMeters + EPSILON16) ?? timing.segments[timing.segments.length - 1];
      const local = Math.max(0, Math.min(s.endDistanceMeters - s.startDistanceMeters, distance6 - s.startDistanceMeters));
      const endSpeed = Math.sqrt(Math.max(0, s.startSpeedMps ** 2 + 2 * s.accelerationMps2 * local));
      return s.startElapsedSeconds + (local === 0 ? 0 : 2 * local / (s.startSpeedMps + endSpeed));
    };
    const sampleAtElapsedSeconds = (elapsed) => {
      if (!Number.isFinite(elapsed)) throw new Error("live runner motion: elapsed time must be finite");
      if (elapsed <= 0) return { position: { ...input.position }, velocity: { ...input.velocity ?? { x: 0, z: 0 } }, speedMps: initialSpeed, distanceMeters: 0 };
      if (elapsed >= timing.durationSeconds) return { position: { ...input.bases[input.bases.length - 1].position }, velocity: { x: 0, z: 0 }, speedMps: 0, distanceMeters: geometry.lengthMeters };
      const s = timing.segments.find((s2) => elapsed <= s2.endElapsedSeconds) ?? timing.segments[timing.segments.length - 1];
      const dt = Math.max(0, elapsed - s.startElapsedSeconds);
      const distance6 = Math.min(geometry.lengthMeters, Math.max(0, s.startDistanceMeters + s.startSpeedMps * dt + 0.5 * s.accelerationMps2 * dt * dt));
      const speed2 = Math.max(0, s.startSpeedMps + s.accelerationMps2 * dt);
      const point = sampleRunnerRoute(geometry.route, distance6);
      return { position: point.position, velocity: mul4(point.tangent, speed2), speedMps: speed2, distanceMeters: distance6 };
    };
    const touches = input.bases.map((bag, index) => {
      const centerDistanceMeters = geometry.centerDistances[index];
      const distanceMeters = firstTouchDistance(geometry.route, bag.position, touchRadius, centerDistanceMeters);
      return {
        base: bag.base,
        distanceMeters,
        elapsedSeconds: elapsedSecondsAtDistanceMeters(distanceMeters),
        position: sampleRunnerRoute(geometry.route, distanceMeters).position,
        centerDistanceMeters,
        centerElapsedSeconds: elapsedSecondsAtDistanceMeters(centerDistanceMeters)
      };
    });
    return Object.freeze({
      route: geometry.route,
      lengthMeters: geometry.lengthMeters,
      durationSeconds: timing.durationSeconds,
      speedSegments: timing.segments,
      touches,
      sampleAtElapsedSeconds,
      elapsedSecondsAtDistanceMeters
    });
  }

  // src/core/rules/ForceObligation.ts
  var participantFor = (runnerId, startBase) => ({
    runnerId,
    startBase,
    active: true,
    obligationSatisfied: false
  });
  var createInitialForceObligationState = (bases, batterRunnerId) => {
    if (batterRunnerId.length === 0) {
      throw new Error("batterRunnerId must not be empty");
    }
    const participants = [
      participantFor(batterRunnerId, 0)
    ];
    if (bases.first !== null) {
      participants.push(participantFor(bases.first, 1));
    }
    if (bases.second !== null) {
      participants.push(participantFor(bases.second, 2));
    }
    if (bases.third !== null) {
      participants.push(participantFor(bases.third, 3));
    }
    const ids2 = participants.map((participant) => participant.runnerId);
    if (new Set(ids2).size !== ids2.length) {
      throw new Error("force participants must have unique runner ids");
    }
    return {
      batterRunnerId,
      participants
    };
  };
  var activeAtBase = (state, base) => state.participants.find(
    (participant) => participant.startBase === base && participant.active
  );
  var deriveCurrentForceObligations = (state) => {
    const batter = activeAtBase(state, 0);
    if (batter === void 0) {
      return [];
    }
    const obligations = [];
    if (!batter.obligationSatisfied) {
      obligations.push({
        runnerId: batter.runnerId,
        fromBase: 0,
        targetBase: 1,
        classification: "batter_runner_before_first"
      });
    }
    for (const fromBase of [1, 2, 3]) {
      const previous = activeAtBase(
        state,
        fromBase - 1
      );
      const current = activeAtBase(state, fromBase);
      if (previous === void 0 || current === void 0) {
        break;
      }
      if (!current.obligationSatisfied) {
        obligations.push({
          runnerId: current.runnerId,
          fromBase,
          targetBase: fromBase + 1,
          classification: "force"
        });
      }
    }
    return obligations;
  };
  var retireForceParticipant = (state, runnerId) => {
    const participant = state.participants.find(
      (candidate) => candidate.runnerId === runnerId
    );
    if (participant === void 0) {
      throw new Error("cannot retire unknown force participant");
    }
    return {
      batterRunnerId: state.batterRunnerId,
      participants: state.participants.map((candidate) => candidate.runnerId === runnerId ? { ...candidate, active: false } : candidate)
    };
  };
  var satisfyForceParticipantObligation = (state, runnerId) => {
    const participant = state.participants.find(
      (candidate) => candidate.runnerId === runnerId
    );
    if (participant === void 0 || !participant.active) {
      throw new Error("cannot satisfy inactive or unknown force participant");
    }
    if (participant.obligationSatisfied) {
      throw new Error("force participant obligation is already satisfied");
    }
    const obligation = deriveCurrentForceObligations(state).find(
      (candidate) => candidate.runnerId === runnerId
    );
    if (obligation === void 0) {
      throw new Error("cannot satisfy participant without a current obligation");
    }
    return {
      batterRunnerId: state.batterRunnerId,
      participants: state.participants.map((candidate) => candidate.runnerId === runnerId ? { ...candidate, obligationSatisfied: true } : candidate)
    };
  };

  // src/core/sim/fielding/LiveFieldPlayV1.ts
  var LIVE_FIELD_TEST_MODEL_V1 = Object.freeze({
    basis: "EXPLICIT_SYNTHETIC_LIVE_FIELD_CONTROL_V1",
    controlSeconds: 0.04,
    frameSeconds: 0.055,
    bodyRadiusMeters: 0.24,
    roleAssignment: LIVE_FIELD_ROLE_POLICY_V1,
    catchApproachCostFraction: 0.3,
    bodyMaterial: Object.freeze({ restitution: 0.25, tangentialDamping: 0.3, spinDamping: 0.1 }),
    wallMaterial: Object.freeze({
      restitution: 0.25,
      tangentialDamping: 0.3,
      spinDamping: 0.1,
      groundNormalHysteresisLossJ: 1e-4,
      maximumCompressionMeters: 2e-3
    }),
    sensorPrediction: Object.freeze({
      horizonSeconds: 8,
      maximumPositionResidualMeters: 0.01,
      maximumVelocityResidualMps: 0.05,
      maximumSpinResidualRadPerSecond: 0.5,
      nearInterceptStepSeconds: 0.02,
      nearInterceptThroughSeconds: 0.5,
      farInterceptStepSeconds: 0.1
    }),
    fenceMotorStoppingReserveMeters: 0.02,
    throwHand: Object.freeze({ heightAboveHipMeters: 0.7, forwardMeters: 0.5, readyRadiusUsesBallRadius: true }),
    neuralReactionCalibrated: false,
    muscleTorqueCalibrated: false,
    tagUpAppealsImplemented: false
  });
  var v = (x = 0, y = 0, z = 0) => ({ x, y, z });
  var add15 = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
  var sub8 = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
  var mul5 = (a, s) => v(a.x * s, a.y * s, a.z * s);
  var norm6 = (a) => Math.hypot(a.x, a.y, a.z);
  var flat = (a) => v(a.x, 0, a.z);
  var distance5 = (a, b) => norm6(sub8(a, b));
  var finite9 = (a) => !!a && [a.x, a.y, a.z].every(Number.isFinite);
  var clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  var freeze19 = (a) => {
    if (a && typeof a === "object") {
      Object.values(a).forEach(freeze19);
      Object.freeze(a);
    }
    return a;
  };
  function assert9(a, m) {
    if (!a) throw new Error("live field play: " + m);
  }
  var at = (c, t) => {
    if (c.exactEnd?.time === t) return c.exactEnd.position;
    const dt = t - c.from, accelerating = Math.min(dt, c.stopAfter ?? dt);
    const after = dt - accelerating;
    return add15(c.p, add15(
      add15(add15(mul5(c.velocity, accelerating), mul5(c.acceleration, 0.5 * accelerating ** 2)), mul5(c.jerk ?? v(), accelerating ** 3 / 6)),
      add15(add15(mul5(c.continuingVelocity ?? v(), after), mul5(c.continuingAcceleration ?? v(), 0.5 * after ** 2)), mul5(c.continuingJerk ?? v(), after ** 3 / 6))
    ));
  };
  var velocityAt = (c, t) => {
    if (c.exactEnd?.time === t) return c.exactEnd.velocity;
    const dt = t - c.from;
    if (c.stopAfter !== void 0 && dt >= c.stopAfter) {
      const after = dt - c.stopAfter;
      return add15(c.continuingVelocity ?? v(), add15(mul5(c.continuingAcceleration ?? v(), after), mul5(c.continuingJerk ?? v(), 0.5 * after ** 2)));
    }
    return add15(c.velocity, add15(mul5(c.acceleration, dt), mul5(c.jerk ?? v(), 0.5 * dt ** 2)));
  };
  var maximumCurveSpeed = (c, from, through) => {
    if (c.stopAfter !== void 0 && c.from + c.stopAfter > from && c.from + c.stopAfter < through)
      return Math.max(maximumCurveSpeed(c, from, c.from + c.stopAfter), maximumCurveSpeed(c, c.from + c.stopAfter, through));
    const dt = through - from, after = c.stopAfter !== void 0 && from - c.from >= c.stopAfter, local = from - c.from - (after ? c.stopAfter : 0), acceleration = add15(after ? c.continuingAcceleration ?? v() : c.acceleration, mul5(after ? c.continuingJerk ?? v() : c.jerk ?? v(), local)), middleDerivativeControl = add15(velocityAt(c, from), mul5(acceleration, dt / 2));
    return Math.max(norm6(velocityAt(c, from)), norm6(velocityAt(c, through)), norm6(middleDerivativeControl));
  };
  var maximumCurveAcceleration = (c, through) => {
    const dt = Math.min(through - c.from, c.stopAfter ?? Infinity), after = Math.max(0, through - c.from - (c.stopAfter ?? Infinity));
    return Math.max(
      norm6(c.acceleration),
      norm6(add15(c.acceleration, mul5(c.jerk ?? v(), dt))),
      norm6(c.continuingAcceleration ?? v()),
      norm6(add15(c.continuingAcceleration ?? v(), mul5(c.continuingJerk ?? v(), after)))
    );
  };
  function deriveLiveFieldFenceGeometryV1(field) {
    const back = field.foulFenceRadiusMeters ?? 35;
    assert9(finite9(field.bases.home) && Number.isFinite(back) && back > 0 && Number.isFinite(field.fenceRadiusMeters) && field.fenceRadiusMeters > 0 && Number.isFinite(field.fenceHeightMeters) && field.fenceHeightMeters >= 0, "finite fence geometry required");
    return freeze19({
      fenceCenter: add15(field.bases.home, v(0, 0, (field.fenceRadiusMeters - back) / 2)),
      fenceRadiusMeters: (field.fenceRadiusMeters + back) / 2,
      fenceHeightMeters: field.fenceHeightMeters
    });
  }
  function firstContact(gap, speed2, rounding, lo, hi, depth = 0, maximumPencilSeconds = 1e-6) {
    const a = gap(lo), b = gap(hi);
    if (a <= 0) return { t: lo, from: lo, gap: a, rounding, speed: speed2 };
    if (Math.min(a, b) > speed2 * (hi - lo) + rounding) return null;
    if (hi - lo <= 1e-13 || depth >= 48 || (hi + lo) / 2 === lo || (hi + lo) / 2 === hi)
      return { t: hi, from: lo, gap: b, rounding, speed: speed2, ...b > 0 ? { ambiguous: true } : {} };
    const mid = (lo + hi) / 2, left = firstContact(gap, speed2, rounding, lo, mid, depth + 1, maximumPencilSeconds);
    if (left && !left.ambiguous) return left;
    if (left?.ambiguous && mid - left.from > maximumPencilSeconds) return left;
    const right = firstContact(gap, speed2, rounding, mid, hi, depth + 1, maximumPencilSeconds);
    if (!left) return right;
    if (right && !right.ambiguous) return { ...right, from: left.from };
    return left;
  }
  function simulateLiveFieldPlayV1(raw) {
    const input = cloneInert(raw), start = input.ball.elapsedSeconds, originTick = input.ball.originTick, tps = input.physics.air.ticksPerSecond, max = start + (input.maxPlaySeconds ?? 35), frameSeconds = input.frameSeconds ?? 0.055;
    assert9(input.fielders.length === 9 && new Set(input.fielders.map((f) => f.playerId)).size === 9, "nine unique defenders required");
    assert9(input.runners.length >= 1 && input.runners.length <= 4 && new Set(input.runners.map((r) => r.runnerId)).size === input.runners.length && new Set(input.runners.map((r) => r.initialBase)).size === input.runners.length && input.runners.some((r) => r.initialBase === 0), "complete unique runner population required");
    assert9(Number.isInteger(input.outs) && input.outs >= 0 && input.outs <= 2 && Number.isFinite(max) && max > start && max - start <= 120 && frameSeconds > 0 && Number.isFinite(frameSeconds) && (input.seed === void 0 || Number.isSafeInteger(input.seed) && input.seed >= 0 && input.seed <= 4294967295), "invalid finite play scope");
    assert9(input.ball.ball.tick === quantizeEventTick(originTick, start, tps) && input.physics.ground.ticksPerSecond === tps, "actual contact clock differs");
    const field = input.field, base = (n) => field.bases[["home", "first", "second", "third", "home"][n]];
    assert9(Object.values(field.bases).every(finite9) && Number.isFinite(field.fenceRadiusMeters) && Number.isFinite(field.fenceHeightMeters) && field.fenceRadiusMeters > 0 && field.fenceHeightMeters >= 0, "finite field geometry required");
    const fieldGeometry = deriveLiveFieldFenceGeometryV1(field), fenceCenter = fieldGeometry.fenceCenter, fenceRadius = fieldGeometry.fenceRadiusMeters;
    for (const f of input.fielders) assert9(f.playerId && finite9(f.position) && (!f.velocity || finite9(f.velocity)) && f.position.y > 0 && (f.defensivePosition === void 0 || ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].includes(f.defensivePosition)) && [f.topSpeedMps, f.accelerationMps2, f.gloveSpeedMps, f.gloveReachMeters, f.gloveRadiusMeters, f.throwSpeedMps].every((x) => Number.isFinite(x) && x > 0) && [f.reactionSeconds, f.transferSeconds].every((x) => Number.isFinite(x) && x >= 0) && f.catchRetention.ticksPerSecond === tps && f.catchRetention.ballRadiusMeters === input.physics.ground.radiusM && f.catchRetention.ballMassKg === input.physics.air.aerodynamics.ballMassKg && [f.catchRetention.pocketRadiusMeters, f.catchRetention.centerRetentionCapacityJ, f.catchRetention.captureDissipationPowerW].every((x) => Number.isFinite(x) && x > 0) && [f.catchRetention.failedContactRestitution, f.catchRetention.failedTangentialDamping, f.catchRetention.failedSpinDamping].every((x) => Number.isFinite(x) && x >= 0 && x <= 1) && (f.throwBackspinRadPerSecond === void 0 || Number.isFinite(f.throwBackspinRadPerSecond) && f.throwBackspinRadPerSecond >= 0) && (!f.throwSpinRadPerSecond || finite9(f.throwSpinRadPerSecond)) && (f.throwDirectionStdRadians === void 0 || Number.isFinite(f.throwDirectionStdRadians) && f.throwDirectionStdRadians >= 0 && f.throwDirectionStdRadians <= 0.12) && (f.fieldingCognition === void 0 || Object.keys(f.fieldingCognition).every((k) => ["decisionSeconds", "pursuitCostWeight"].includes(k)) && Number.isFinite(f.fieldingCognition.decisionSeconds) && f.fieldingCognition.decisionSeconds >= 0 && (f.fieldingCognition.pursuitCostWeight === void 0 || Number.isFinite(f.fieldingCognition.pursuitCostWeight) && f.fieldingCognition.pursuitCostWeight >= 0.25 && f.fieldingCognition.pursuitCostWeight <= 4) && Number.isFinite(f.reactionSeconds + f.fieldingCognition.decisionSeconds)), "explicit fielder SI required");
    for (const r of input.runners) assert9(r.runnerId && [0, 1, 2, 3].includes(r.initialBase) && [r.topSpeedMps, r.accelerationMps2].every((x) => Number.isFinite(x) && x > 0) && Number.isFinite(r.reactionSeconds) && r.reactionSeconds >= 0 && (!r.position || finite9(r.position)) && (r.advanceSafetyMarginSeconds === void 0 || Number.isFinite(r.advanceSafetyMarginSeconds) && r.advanceSafetyMarginSeconds >= 0 && r.advanceSafetyMarginSeconds <= 3) && (r.roundingRadiusMeters === void 0 || Number.isFinite(r.roundingRadiusMeters) && r.roundingRadiusMeters >= 0.5 && r.roundingRadiusMeters <= 10) && (r.lateralAccelerationMps2 === void 0 || Number.isFinite(r.lateralAccelerationMps2) && r.lateralAccelerationMps2 >= 0.5 && r.lateralAccelerationMps2 <= 20), "explicit runner SI required");
    const facts = [], frames = [], runnerTouches = [], controlledBaseContacts = [], controlledRunnerTags = [], runnerDepartures = [];
    const tick8 = (t) => quantizeEventTick(originTick, t, tps);
    const findContact = (gap, speed2, rounding, lo, hi) => firstContact(gap, speed2, rounding, lo, hi, 0, 1 / tps);
    const emit = (kind, t, extra = {}) => facts.push({ kind, tick: tick8(t), elapsedSeconds: t, ...extra });
    const defenders = input.fielders.map((spec) => ({
      spec,
      body: { from: start, p: spec.position, velocity: spec.velocity ?? v(), acceleration: v() },
      glove: { from: start, p: spec.position, velocity: spec.velocity ?? v(), acceleration: v() },
      intent: "hold",
      targetBase: null,
      catchEnabledAfter: start
    }));
    const runners = input.runners.map((spec) => ({ spec, base: spec.initialBase, p: spec.position ?? base(spec.initialBase), leg: null, retired: false, scored: false }));
    const physicalBaseDepartures = /* @__PURE__ */ new Map();
    const batter = runners.find((r) => r.base === 0);
    let force = createInitialForceObligationState({
      first: runners.find((r) => r.base === 1)?.spec.runnerId ?? null,
      second: runners.find((r) => r.base === 2)?.spec.runnerId ?? null,
      third: runners.find((r) => r.base === 3)?.spec.runnerId ?? null
    }, batter.spec.runnerId);
    let retiredCount = 0, firstGroundContactTick = null, firstTouchTick = null, flyCatch = null, overFence = null;
    let firstGroundContactSeconds = null, firstFielderTouchSeconds = null;
    let territory = "fair", territoryFixed = false, time = start, endReason = "scope_exhausted", dead = false;
    let kernelBuilds = 0, kernelExtensions = 0, wallKernelBuilds = 0, collisionQueries = 0, kernel, orientationBasis = input.orientation ?? IDENTITY_QUATERNION;
    let freeScope = null;
    let wallContact = null;
    const wallSupports = [];
    const simultaneousContacts = [];
    const throwDecisions = [];
    const throwDirectionCommands = [];
    const handPreparationProofs = [];
    const roleTransitions = [];
    const throwTargetCancellations = [];
    const contactDiagnostics = [];
    const holderDecisions = [];
    const rejectedThrows = /* @__PURE__ */ new Set();
    const relayPlans = [];
    const relayCache = /* @__PURE__ */ new Map();
    const relayVisited = /* @__PURE__ */ new Map();
    const runnerMotions = [];
    const roundingRecheckAfter = /* @__PURE__ */ new Map();
    const runnerDecisions = [];
    let runnerDecisionPending = false;
    let lastRunnerEvaluationSeconds = null;
    let unresolvedDetail = null;
    const build = (moment) => {
      kernelBuilds++;
      const through = Math.min(max, moment.elapsedSeconds + 8), result = createSourceFreeBallKernel({
        kind: "aero_ground_continuous_source_kernel_v2",
        initial: moment,
        throughElapsedSeconds: through,
        profile: input.physics
      });
      freeScope = { initial: result.descriptor.initial, spanSeconds: 8, through };
      return result;
    };
    const ensureThrough = (through) => {
      if (!freeScope || through <= freeScope.through) return;
      let span = freeScope.spanSeconds;
      while (freeScope.initial.elapsedSeconds + span < through) span *= 2;
      const end = Math.min(max, freeScope.initial.elapsedSeconds + span);
      kernel = createSourceFreeBallKernel({
        kind: "aero_ground_continuous_source_kernel_v2",
        initial: freeScope.initial,
        throughElapsedSeconds: end,
        profile: input.physics
      });
      freeScope = { ...freeScope, spanSeconds: span, through: end };
      kernelExtensions++;
    };
    kernel = build(input.ball);
    let side = "incoming", possession = null, pendingCatch = null, throwTarget = null, releaseAt = null, custodySince = Infinity;
    let releaseOpen = null;
    let hasThrown = false, lastThrowBases = {};
    let handPreparation = null;
    let fenceEscape = null;
    const departureProofs = [];
    let reboundEscape = null;
    const isFair = (point) => {
      const d = sub8(point, base(0));
      return d.z >= Math.abs(d.x);
    };
    const determineTerritory = (t, value) => {
      if (!territoryFixed) emit("territory_determined", t, { reason: value });
      territory = value;
      territoryFixed = true;
    };
    const runnerAt = (r, t) => {
      const leg = r.leg;
      if (!leg) return r.p;
      const p = leg.motion.sampleAtElapsedSeconds(t - leg.from).position;
      return v(p.x, leg.height, p.z);
    };
    const runnerVelocityAt = (r, t) => {
      if (!r.leg) return v();
      const vel = r.leg.motion.sampleAtElapsedSeconds(t - r.leg.from).velocity;
      return v(vel.x, 0, vel.z);
    };
    const ballAt2 = (t) => {
      const holder = possession ?? pendingCatch?.fielder;
      if (holder) {
        const u = pendingCatch ? clamp((t - pendingCatch.first) / Math.max(pendingCatch.secure - pendingCatch.first, Number.MIN_VALUE), 0, 1) : 1;
        const grip = at(holder.glove, t), translatedEntry = pendingCatch ? add15(pendingCatch.initialPosition, sub8(grip, pendingCatch.initialGlove)) : grip;
        return {
          position: pendingCatch ? u === 0 ? pendingCatch.initialPosition : u === 1 ? grip : add15(mul5(translatedEntry, 1 - u), mul5(grip, u)) : grip,
          velocity: pendingCatch ? sub8(velocityAt(holder.glove, t), mul5(pendingCatch.offset, 1 / (pendingCatch.secure - pendingCatch.first))) : velocityAt(holder.glove, t),
          spin: pendingCatch ? mul5(pendingCatch.spin, 1 - u) : v(),
          orientation: pendingCatch ? advanceBaseballOrientation(orientationBasis, mul5(pendingCatch.spin, 1 - u / 2), t - pendingCatch.first) : orientationBasis,
          phase: "possessed"
        };
      }
      const b = kernel.evaluateAt(t, t === time ? side : "outgoing");
      return { ...b.moment.ball, orientation: multiplyQuaternions(b.orientation, orientationBasis), phase: dead ? "dead" : wallContact ? "wall_" + b.phase : b.phase };
    };
    const sampleFrame = (t) => {
      const b = ballAt2(t);
      frames.push({
        elapsedSeconds: t,
        tick: tick8(t),
        ball: {
          position: b.position,
          velocity: b.velocity,
          spin: b.spin,
          orientation: b.orientation,
          phase: b.phase,
          visible: !dead && !possession && !pendingCatch,
          possessedBy: (possession ?? pendingCatch?.fielder)?.spec.playerId ?? null
        },
        fielders: defenders.map((f) => ({ playerId: f.spec.playerId, position: at(f.body, t), velocity: velocityAt(f.body, t), glove: at(f.glove, t), intent: f.intent, targetBase: f.targetBase })),
        runners: runners.map((r) => ({
          runnerId: r.spec.runnerId,
          position: runnerAt(r, t),
          velocity: runnerVelocityAt(r, t),
          currentBase: r.base,
          targetBase: r.leg && r.leg.to > r.base ? r.leg.to : null,
          retired: r.retired,
          scored: r.scored
        }))
      });
    };
    const retire = (r, t) => {
      if (r.retired) return;
      r.p = runnerAt(r, t);
      r.leg = null;
      r.retired = true;
      retiredCount++;
      force = retireForceParticipant(force, r.spec.runnerId);
      runnerDecisionPending = true;
      controlThrough = t;
    };
    const beginLeg = (r, n, t) => {
      const p = runnerAt(r, t), motion = createLiveRunnerMotionV1({
        position: p,
        velocity: runnerVelocityAt(r, t),
        bases: [{ base: n, position: base(n) }],
        topSpeedMps: r.spec.topSpeedMps,
        accelerationMps2: r.spec.accelerationMps2,
        baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? 0.28
      });
      if (!motion) return;
      physicalBaseDepartures.delete(r.spec.runnerId);
      r.leg = { from: t, to: n, motion, nextTouchIndex: 0, height: p.y, departure: null };
      runnerMotions.push({
        elapsedSeconds: t,
        runnerId: r.spec.runnerId,
        throughBases: [n],
        position: p,
        velocity: v(),
        durationSeconds: motion.durationSeconds,
        lengthMeters: motion.lengthMeters,
        route: motion.route
      });
      if (r.base > 0) {
        runnerDepartures.push({ kind: "runner_base_departure", runnerId: r.spec.runnerId, base: r.base, tick: tick8(t) });
        emit("runner_base_departure", t, { runnerId: r.spec.runnerId, base: r.base });
      }
    };
    const runnerArrivalSeconds = (r, n, t) => {
      const touch = r.leg?.motion.touches.slice(r.leg.nextTouchIndex).find((b) => b.base === n);
      return touch && r.leg ? Math.max(0, r.leg.from + touch.elapsedSeconds - t) : estimateLiveRunnerLegSecondsV1(distance5(flat(runnerAt(r, t)), flat(base(n))), r.spec.topSpeedMps, r.spec.accelerationMps2, field.baseTouchRadiusMeters ?? 0.28);
    };
    const outTargets = () => {
      const forced = deriveCurrentForceObligations(force).map((o) => ({ ...o, forced: true }));
      return [...forced, ...runners.filter((r) => !r.retired && !r.scored && r.leg && r.leg.to > r.base && !forced.some((o) => o.runnerId === r.spec.runnerId)).map((r) => ({ runnerId: r.spec.runnerId, targetBase: r.leg.to, forced: false }))];
    };
    const history = [];
    const observe = (t) => {
      const b = ballAt2(t);
      history.push({ t, position: b.position, velocity: b.velocity, spin: b.spin, phase: b.phase });
    };
    const responseSeconds = (f) => f.spec.reactionSeconds + (f.spec.fieldingCognition?.decisionSeconds ?? 0);
    const seenBy = (f, t) => {
      const delay = hasThrown && f === throwTarget?.receiver ? f.spec.reactionSeconds : responseSeconds(f);
      for (let i = history.length - 1; i >= 0; i--) if (history[i].t <= t - delay) return history[i];
      return null;
    };
    const predictions = [];
    let forecastBuilds = 0;
    const predict = (f, t) => {
      const seen = seenBy(f, t) ?? (!hasThrown && history.length ? history[0] : null);
      if (!seen || seen.phase === "possessed" || possession || pendingCatch || dead || t - seen.t >= LIVE_FIELD_TEST_MODEL_V1.sensorPrediction.horizonSeconds) return null;
      const policy = LIVE_FIELD_TEST_MODEL_V1.sensorPrediction, requiredLookahead = Math.min(5, Math.max(0.1, (policy.horizonSeconds - responseSeconds(f)) / 2));
      let hypothesis;
      for (let i = predictions.length - 1; i >= 0; i--) if (predictions[i].observation.t <= seen.t && t - predictions[i].observation.t + requiredLookahead <= policy.horizonSeconds) {
        hypothesis = predictions[i];
        break;
      }
      if (hypothesis) {
        const prior = hypothesis.curve.sampleAtElapsedSeconds(seen.t - hypothesis.observation.t);
        if (distance5(prior.position, seen.position) > policy.maximumPositionResidualMeters || distance5(prior.velocity, seen.velocity) > policy.maximumVelocityResidualMps || distance5(prior.spin, seen.spin) > policy.maximumSpinResidualRadPerSecond) hypothesis = void 0;
      }
      if (!hypothesis) {
        hypothesis = { observation: seen, curve: createLiveFieldForecastV1({ observation: {
          tick: tick8(seen.t),
          position: seen.position,
          velocity: seen.velocity,
          spin: seen.spin
        }, physics: input.physics, horizonSeconds: policy.horizonSeconds }) };
        predictions.push(hypothesis);
        forecastBuilds++;
      }
      const age = t - hypothesis.observation.t;
      return {
        observedPosition: seen.position,
        maximumSeconds: policy.horizonSeconds - age,
        sample: (h) => hypothesis.curve.sampleAtElapsedSeconds(age + h)
      };
    };
    const roleActor = (f, t) => ({
      playerId: f.spec.playerId,
      position: at(f.body, t),
      velocity: velocityAt(f.body, t),
      homePosition: f.spec.position,
      topSpeedMps: f.spec.topSpeedMps,
      accelerationMps2: f.spec.accelerationMps2,
      throwSpeedMps: f.spec.throwSpeedMps,
      remainingReactionSeconds: Math.max(0, start + responseSeconds(f) - t),
      ...f.spec.defensivePosition === void 0 ? {} : { defensivePosition: f.spec.defensivePosition },
      ...f.spec.fieldingCognition?.pursuitCostWeight === void 0 ? {} : { pursuitCostWeight: f.spec.fieldingCognition.pursuitCostWeight }
    });
    const forecast = (f, t) => {
      const prediction = predict(f, t);
      if (!prediction) return null;
      const bodyPos = flat(at(f.body, t)), bodyVel = velocityAt(f.body, t), activeAt = start + Math.ceil(Math.max(0, responseSeconds(f) - 1e-12) / LIVE_FIELD_TEST_MODEL_V1.controlSeconds) * LIVE_FIELD_TEST_MODEL_V1.controlSeconds, wait = Math.max(0, activeAt - t), a = f.spec.accelerationMps2, vmax = f.spec.topSpeedMps, gloveFloor = Math.max(f.spec.gloveRadiusMeters, input.physics.ground.radiusM);
      const horizontalReachAt = (y) => {
        const dy = f.spec.position.y - Math.max(gloveFloor, y);
        return Math.sqrt(Math.max(0, f.spec.gloveReachMeters * f.spec.gloveReachMeters - dy * dy)) + f.spec.gloveRadiusMeters * 0.5;
      };
      const travelTo = (p) => {
        const toP = sub8(flat(p), bodyPos), dist = norm6(toP);
        let run = Math.max(0, dist - horizontalReachAt(p.y));
        if (run === 0) return wait;
        const rawAlong = dist > 1e-9 ? (bodyVel.x * toP.x + bodyVel.z * toP.z) / dist : 0;
        let along = Math.min(vmax, rawAlong), reversal = 0;
        if (along < 0) {
          reversal = -along / a;
          run += along * along / (2 * a);
          along = 0;
        }
        const accelDist = Math.max(0, (vmax * vmax - along * along) / (2 * a)), move = run <= accelDist ? (Math.sqrt(along * along + 2 * a * run) - along) / a : (vmax - along) / a + (run - accelDist) / vmax;
        return wait + reversal + move;
      };
      const observed = prediction.observedPosition, fallbackTravel = travelTo(observed);
      let best = { point: observed, eta: fallbackTravel + Math.max(0, observed.y - f.spec.position.y - f.spec.gloveReachMeters), prediction, intercepted: false };
      let lastInFence = null;
      const near = LIVE_FIELD_TEST_MODEL_V1.sensorPrediction, horizons = [
        ...Array.from({ length: Math.floor(near.nearInterceptThroughSeconds / near.nearInterceptStepSeconds) }, (_, i) => (i + 1) * near.nearInterceptStepSeconds),
        ...Array.from({ length: Math.floor(prediction.maximumSeconds / near.farInterceptStepSeconds) }, (_, i) => (i + 1) * near.farInterceptStepSeconds).filter((h) => h > near.nearInterceptThroughSeconds)
      ];
      const tryHorizon = (h) => {
        const p = prediction.sample(h).position, insideFence = distance5(flat(p), flat(fenceCenter)) <= fenceRadius - input.physics.ground.radiusM;
        if (!insideFence) return null;
        const travel = travelTo(p);
        lastInFence = { point: p, eta: Math.max(h, travel) };
        if (p.y <= f.spec.position.y + f.spec.gloveReachMeters && travel <= h) {
          best = { point: p, eta: h, prediction, intercepted: true };
          return true;
        }
        return travel - h;
      };
      let prevH = 0;
      for (const h of horizons) {
        if (h > prediction.maximumSeconds) break;
        const step = h - prevH;
        const res = tryHorizon(h);
        if (res === true) break;
        if (typeof res === "number" && res < 0.35 && step > 0.01) {
          const subSteps = Math.min(10, Math.ceil(step / 0.01));
          for (let s = 1; s < subSteps; s++) {
            const subH = prevH + step * s / subSteps;
            if (subH <= prediction.maximumSeconds && tryHorizon(subH) === true) break;
          }
          if (best.intercepted) break;
        }
        prevH = h;
      }
      if (!best.intercepted && lastInFence) best = { point: lastInFence.point, eta: lastInFence.eta, prediction, intercepted: false };
      return best;
    };
    const roundBound = (p) => 256 * Number.EPSILON * Math.max(1, norm6(p), norm6(fenceCenter), fenceRadius);
    const pointInside = (p, radius) => distance5(flat(p), flat(fenceCenter)) + roundBound(p) <= radius;
    const curveInside = (c, from, through, radius, floor, depth = 0) => {
      if (c.stopAfter !== void 0 && c.from + c.stopAfter > from && c.from + c.stopAfter < through)
        return curveInside(c, from, c.from + c.stopAfter, radius, floor, depth) && curveInside(c, c.from + c.stopAfter, through, radius, floor, depth);
      const a = at(c, from), b = at(c, through), control = add15(a, mul5(velocityAt(c, from), (through - from) / 3)), control2 = sub8(b, mul5(velocityAt(c, through), (through - from) / 3));
      if (!pointInside(a, radius) || !pointInside(b, radius) || a.y < floor || b.y < floor) return false;
      if (pointInside(control, radius) && pointInside(control2, radius) && control.y >= floor && control2.y >= floor) return true;
      if (depth >= 12 || from === through) return false;
      const mid = (from + through) / 2;
      return curveInside(c, from, mid, radius, floor, depth + 1) && curveInside(c, mid, through, radius, floor, depth + 1);
    };
    const shifted = (c, offset, velocity = v()) => ({
      ...c,
      p: add15(c.p, offset),
      velocity: add15(c.velocity, velocity),
      ...c.stopAfter !== void 0 ? { continuingVelocity: add15(c.continuingVelocity ?? v(), velocity) } : {}
    });
    const stopPoint = (c, t, acceleration) => {
      const speed2 = norm6(velocityAt(c, t));
      return add15(at(c, t), mul5(velocityAt(c, t), speed2 / (2 * acceleration)));
    };
    const targetInside = (p, radius) => {
      const d = flat(sub8(p, fenceCenter)), length = norm6(d);
      return length <= radius ? p : add15(fenceCenter, add15(mul5(d, radius / length), v(0, p.y - fenceCenter.y, 0)));
    };
    const throwOffset = (f, position, target) => {
      const direction = flat(sub8(target, position)), length = norm6(direction), model = LIVE_FIELD_TEST_MODEL_V1.throwHand, desired = add15(mul5(direction, model.forwardMeters / Math.max(length, 1e-30)), v(0, model.heightAboveHipMeters, 0));
      return mul5(desired, Math.min(1, f.spec.gloveReachMeters / norm6(desired)));
    };
    let motorBoundaryFailure = null;
    let previousRoles = [], previousHandlerId = null;
    const plan = (t, through) => {
      observe(t);
      if (!possession && throwTarget) {
        const seen = seenBy(throwTarget.receiver, t), target = throwTarget.point;
        if (seen && seen.phase !== "possessed" && (throwTarget.releasedAt === void 0 || seen.t >= throwTarget.releasedAt) && (target.x - seen.position.x) * seen.velocity.x + (target.z - seen.position.z) * seen.velocity.z < 0 && distance5(flat(seen.position), flat(target)) > throwTarget.receiver.spec.gloveReachMeters) {
          throwTargetCancellations.push({
            elapsedSeconds: t,
            base: throwTarget.base,
            receiverPlayerId: throwTarget.receiver.spec.playerId,
            releasedAt: throwTarget.releasedAt ?? null,
            seenAt: seen.t,
            distanceToTargetMeters: distance5(flat(seen.position), flat(target))
          });
          throwTarget = null;
        }
      }
      const forecasts = defenders.map((f) => ({ f, predicted: forecast(f, t) }));
      const selection = selectLiveFieldHandlerV1({
        candidates: forecasts.flatMap(({ f, predicted }) => {
          if (!predicted) return [];
          const route = flat(sub8(predicted.point, at(f.body, t))), incoming = flat(predicted.prediction.sample(Math.min(predicted.eta, predicted.prediction.maximumSeconds)).velocity), arrivalSeconds = liveFieldArrivalSecondsV1(roleActor(f, t), predicted.point, f.spec.gloveReachMeters), chasing = Math.max(0, (route.x * incoming.x + route.z * incoming.z) / Math.max(norm6(route) * norm6(incoming), 1e-30));
          return [{
            playerId: f.spec.playerId,
            intercepted: predicted.intercepted,
            interceptSeconds: predicted.eta,
            arrivalSeconds,
            approachPenaltySeconds: predicted.point.y > input.physics.ground.radiusM + 0.2 ? chasing * arrivalSeconds * LIVE_FIELD_TEST_MODEL_V1.catchApproachCostFraction : 0,
            travelDistanceMeters: distance5(flat(at(f.body, t)), flat(predicted.point)),
            ...f.spec.fieldingCognition?.pursuitCostWeight === void 0 ? {} : { pursuitCostWeight: f.spec.fieldingCognition.pursuitCostWeight }
          }];
        }),
        previousPlayerId: previousHandlerId
      });
      const incumbent = forecasts.find((x) => x.f.spec.playerId === previousHandlerId), best = forecasts.find((x) => x.f.spec.playerId === selection.playerId), retained = best?.f;
      const handler = possession ?? pendingCatch?.fielder ?? throwTarget?.receiver ?? retained ?? defenders[0];
      const handlerPrediction = forecasts.find((x) => x.f === handler)?.predicted;
      if (handler.spec.playerId !== previousHandlerId) {
        const source = possession ? "possession" : pendingCatch ? "pending_catch" : throwTarget ? "throw_receiver" : retained && retained === incumbent?.f ? "forecast_retained" : best?.f === handler ? "forecast_best" : "fallback_first";
        roleTransitions.push({
          elapsedSeconds: t,
          previousHandlerId,
          handlerId: handler.spec.playerId,
          source,
          intercepted: handlerPrediction?.intercepted ?? null,
          eta: handlerPrediction?.eta ?? null,
          targetPoint: handlerPrediction?.point ?? null,
          observedPosition: handlerPrediction?.prediction.observedPosition ?? null,
          reactionGatedCount: forecasts.filter((x) => !x.predicted).length
        });
      }
      previousHandlerId = handler.spec.playerId;
      let holderTask = { point: at(handler.body, t), intent: "hold", base: null };
      if ((possession || pendingCatch) && !throwTarget && releaseAt === null) {
        const activeObligations = deriveCurrentForceObligations(force);
        const nearForcedBase = activeObligations.map((o) => {
          const r = runners.find((x) => x.spec.runnerId === o.runnerId), b = base(o.targetBase), runnerSec = runnerArrivalSeconds(r, o.targetBase, t), holderSec = liveFieldArrivalSecondsV1({ ...roleActor(handler, t), remainingReactionSeconds: 0 }, b, field.baseTouchRadiusMeters ?? 0.28), otherSec = Math.min(...defenders.filter((f) => f !== handler).map((f) => liveFieldArrivalSecondsV1(roleActor(f, t), b, field.baseTouchRadiusMeters ?? 0.28))), dist = distance5(flat(at(handler.body, t)), flat(b));
          return { base: o.targetBase, point: b, dist, holderSec, otherSec, runnerSec };
        }).filter((c) => c.holderSec < c.runnerSec && (c.dist <= 3.5 || c.dist <= 7.5 && c.runnerSec - c.holderSec > 0.45 || c.holderSec <= c.otherSec + 0.35 || handler.targetBase === c.base)).sort((a, b) => a.holderSec - b.holderSec)[0];
        if (nearForcedBase) {
          holderTask = { point: nearForcedBase.point, intent: "base_cover", base: nearForcedBase.base };
        }
      }
      const threats = [];
      for (const runner of runners.filter((r) => !r.retired && !r.scored)) {
        const n = runner.leg?.to ?? (runner.base < 4 ? runner.base + 1 : null);
        if (n === null) continue;
        const eta = runnerArrivalSeconds(runner, n, t);
        threats.push({ base: n, arrivalSeconds: eta });
        if (n < 4) threats.push({
          base: n + 1,
          arrivalSeconds: eta + estimateLiveRunnerLegSecondsV1(distance5(flat(base(n)), flat(base(n + 1))), runner.spec.topSpeedMps, runner.spec.accelerationMps2)
        });
      }
      const assignment = () => {
        const reservations = [];
        if (possession || pendingCatch) reservations.push({
          playerId: handler.spec.playerId,
          taskId: "holder",
          point: holderTask.point,
          intent: holderTask.intent,
          targetBase: holderTask.base
        });
        else if (throwTarget) reservations.push({
          playerId: throwTarget.receiver.spec.playerId,
          taskId: "receiver:" + throwTarget.base,
          point: throwTarget.receiverPoint,
          intent: throwTarget.intent,
          targetBase: throwTarget.intent === "relay" ? null : throwTarget.base
        });
        else reservations.push({
          playerId: handler.spec.playerId,
          taskId: "handler",
          point: handlerPrediction?.point ?? at(handler.body, t),
          intent: "intercept",
          targetBase: null
        });
        if (throwTarget && (possession || pendingCatch) && throwTarget.receiver !== handler)
          reservations.push({
            playerId: throwTarget.receiver.spec.playerId,
            taskId: "receiver:" + throwTarget.base,
            point: throwTarget.receiverPoint,
            intent: throwTarget.intent,
            targetBase: throwTarget.intent === "relay" ? null : throwTarget.base
          });
        const seen = seenBy(handler, t), ball = possession || pendingCatch ? ballAt2(t) : seen;
        const roles = assignLiveFieldRolesV1({
          actors: defenders.map((f) => roleActor(f, t)),
          bases: { 1: base(1), 2: base(2), 3: base(3), 4: base(4) },
          ballPosition: ball?.position ?? at(handler.body, t),
          ballVelocity: ball?.velocity ?? v(),
          ballPhase: possession || pendingCatch ? "held" : throwTarget ? "throw" : "free",
          ...throwTarget ? { activeThrow: { from: throwTarget.releasedFrom ?? throwTarget.issuedFrom, target: throwTarget.point } } : {},
          pickupPoint: handlerPrediction?.point ?? at(handler.body, t),
          threats,
          reservations,
          previous: previousRoles
        });
        return { roles, targets: new Map(defenders.map((f) => {
          const role = roles.find((r) => r.playerId === f.spec.playerId);
          return [f, { point: role.point, intent: role.intent, base: role.targetBase }];
        })) };
      };
      let planned = assignment(), assigned = planned.targets;
      if (possession && !pendingCatch && t < custodySince + possession.spec.transferSeconds && releaseAt === null) {
        const oblig = deriveCurrentForceObligations(force)[0];
        holderDecisions.push({
          elapsedSeconds: t,
          playerId: possession.spec.playerId,
          state: "waiting_transfer",
          base: oblig?.targetBase ?? null,
          receiverDistanceToBaseMeters: oblig ? distance5(flat(at(possession.body, t)), flat(base(oblig.targetBase))) : void 0
        });
      }
      if (possession && !pendingCatch && t >= custodySince + possession.spec.transferSeconds && releaseAt === null) {
        const arrive = (f, target) => liveFieldArrivalSecondsV1({ ...roleActor(f, t), remainingReactionSeconds: 0 }, target, field.baseTouchRadiusMeters ?? 0.28);
        const candidates = outTargets().map((o) => {
          const r = runners.find((r2) => r2.spec.runnerId === o.runnerId), target = base(o.targetBase), receiver = defenders.find((f) => f !== possession && assigned.get(f)?.intent === "base_cover" && assigned.get(f)?.base === o.targetBase) ?? defenders.filter((f) => f !== possession).sort((a, b) => liveFieldArrivalSecondsV1(roleActor(a, t), target) - liveFieldArrivalSecondsV1(roleActor(b, t), target))[0], throwSeconds = Math.max(0.05, distance5(at(possession.glove, t), add15(target, v(0, receiver.spec.position.y, 0))) / possession.spec.throwSpeedMps) + (receiver.spec.gloveRadiusMeters + input.physics.ground.radiusM) / receiver.spec.gloveSpeedMps, runnerSeconds = runnerArrivalSeconds(r, o.targetBase, t), preparation = createLiveHandPreparationV1({
            fromElapsedSeconds: t,
            initialOffset: sub8(at(possession.glove, t), at(possession.body, t)),
            initialRelativeVelocity: sub8(velocityAt(possession.glove, t), velocityAt(possession.body, t)),
            targetOffset: throwOffset(possession, at(possession.body, t), target),
            maximumRelativeSpeedMps: possession.spec.gloveSpeedMps,
            maximumReachMeters: possession.spec.gloveReachMeters
          }), carrySeconds = o.forced ? arrive(possession, target) : liveFieldArrivalSecondsV1({ ...roleActor(possession, t), remainingReactionSeconds: 0 }, runnerAt(r, t), possession.spec.gloveReachMeters), receiverArriveSeconds = arrive(receiver, target), holderDist = distance5(flat(at(possession.body, t)), flat(target)), directReceivingSeconds = Math.max(
            receiverArriveSeconds,
            (preparation.kind === "planned" ? preparation.durationSeconds : Infinity) + throwSeconds
          );
          const cacheKey = custodySince + ":" + possession.spec.playerId + ":" + r.spec.runnerId + ":" + o.targetBase, cached = relayCache.get(cacheKey);
          let relayPlan = null;
          if (holderDist > 3.5) {
            relayPlan = cached && t - cached.at < 0.12 ? cached.plan : planLiveRelayV1({
              actors: defenders.map((f) => ({
                ...roleActor(f, t),
                glovePosition: at(f.glove, t),
                gloveVelocity: velocityAt(f.glove, t),
                gloveSpeedMps: f.spec.gloveSpeedMps,
                gloveReachMeters: f.spec.gloveReachMeters,
                gloveRadiusMeters: f.spec.gloveRadiusMeters,
                transferSeconds: f.spec.transferSeconds,
                ...f.spec.throwDirectionStdRadians === void 0 ? {} : { throwDirectionStdRadians: f.spec.throwDirectionStdRadians },
                ...f.spec.throwBackspinRadPerSecond === void 0 ? {} : { throwBackspinRadPerSecond: f.spec.throwBackspinRadPerSecond },
                ...f.spec.throwSpinRadPerSecond === void 0 ? {} : { throwSpinRadPerSecond: f.spec.throwSpinRadPerSecond }
              })),
              holderPlayerId: possession.spec.playerId,
              receiverPlayerId: receiver.spec.playerId,
              finalBase: o.targetBase,
              runnerId: r.spec.runnerId,
              target: add15(target, v(0, receiver.spec.position.y, 0)),
              runnerArrivalSeconds: runnerSeconds,
              holderTransferRemainingSeconds: 0,
              physics: input.physics,
              excludedRelayPlayerIds: [...relayVisited.get(r.spec.runnerId + ":" + o.targetBase) ?? []],
              throwHandOffset: {
                forwardMeters: LIVE_FIELD_TEST_MODEL_V1.throwHand.forwardMeters,
                heightAboveHipMeters: LIVE_FIELD_TEST_MODEL_V1.throwHand.heightAboveHipMeters
              }
            });
            if (!cached || relayPlan !== cached.plan) {
              relayCache.set(cacheKey, { at: t, plan: relayPlan });
              relayPlans.push({
                elapsedSeconds: t,
                playerId: possession.spec.playerId,
                runnerId: r.spec.runnerId,
                base: o.targetBase,
                kind: relayPlan.kind,
                receivers: relayPlan.legs.map((l) => l.receiverPlayerId),
                readySeconds: relayPlan.readySeconds,
                marginSeconds: relayPlan.marginSeconds,
                aerodynamicSolveCount: relayPlan.diagnostics.aerodynamicSolveCount
              });
            }
          }
          const receivingSeconds = relayPlan ? relayPlan.firstHop ? relayPlan.readySeconds : Infinity : directReceivingSeconds;
          return {
            runnerId: r.spec.runnerId,
            forced: o.forced,
            base: o.targetBase,
            receiver,
            relayPlan,
            margin: runnerSeconds - Math.min(carrySeconds, receivingSeconds),
            target,
            carrySeconds,
            receivingSeconds,
            carryPreferred: carrySeconds <= receivingSeconds || (carrySeconds <= receiverArriveSeconds + 0.5 || holderDist <= 7.5) && runnerSeconds - carrySeconds > 0.45
          };
        }).filter((c) => !rejectedThrows.has(c.runnerId + ":" + c.base)).sort((a, b) => b.margin - a.margin || b.base - a.base);
        const pick = candidates.find((candidate) => candidate.margin > 0);
        if (pick) {
          const here = distance5(flat(at(possession.body, t)), flat(pick.target));
          if (!pick.forced && (here <= possession.spec.gloveReachMeters + 0.5 || pick.carryPreferred)) {
            holderTask = { point: runnerAt(runners.find((r) => r.spec.runnerId === pick.runnerId), t), intent: "tag", base: null };
          } else if (here <= (field.baseTouchRadiusMeters ?? 0.28)) {
            holderTask = { point: pick.target, intent: "base_cover", base: pick.base };
            holderDecisions.push({
              elapsedSeconds: t,
              playerId: possession.spec.playerId,
              state: "on_base_cover",
              base: pick.base,
              margin: pick.margin,
              carrySeconds: pick.carrySeconds,
              receivingSeconds: pick.receivingSeconds,
              receiverDistanceToBaseMeters: here
            });
          } else if (pick.carryPreferred) {
            holderTask = { point: pick.target, intent: "base_cover", base: pick.base };
            holderDecisions.push({
              elapsedSeconds: t,
              playerId: possession.spec.playerId,
              state: "carry_to_base",
              base: pick.base,
              margin: pick.margin,
              carrySeconds: pick.carrySeconds,
              receivingSeconds: pick.receivingSeconds,
              receiverDistanceToBaseMeters: here
            });
          } else {
            const hop = pick.relayPlan?.firstHop;
            holderTask = { point: at(possession.body, t), intent: "hold", base: null };
            throwTarget = {
              receiver: hop ? defenders.find((f) => f.spec.playerId === hop.receiverPlayerId) : pick.receiver,
              base: pick.base,
              runnerId: pick.runnerId,
              forced: pick.forced,
              point: hop?.target ?? add15(pick.target, v(0, pick.receiver.spec.position.y, 0)),
              receiverPoint: hop?.receiverPoint ?? pick.target,
              issuedFrom: at(possession.glove, t),
              intent: hop?.intent ?? "base_cover"
            };
            releaseAt = through;
            holderDecisions.push({
              elapsedSeconds: t,
              playerId: possession.spec.playerId,
              state: "prepare_throw",
              base: pick.base,
              margin: pick.margin,
              carrySeconds: pick.carrySeconds,
              receivingSeconds: pick.receivingSeconds,
              receiverPlayerId: pick.receiver.spec.playerId,
              receiverDistanceToBaseMeters: distance5(flat(at(pick.receiver.body, t)), flat(pick.target))
            });
          }
        } else {
          const bestCand = candidates[0];
          const offBase = runners.filter((r) => !r.retired && !r.scored && r.leg).sort((a, b) => distance5(at(possession.body, t), runnerAt(a, t)) - distance5(at(possession.body, t), runnerAt(b, t)))[0];
          if (offBase) holderTask = { point: runnerAt(offBase, t), intent: "tag", base: null };
          else holderTask = { point: at(possession.body, t), intent: "hold", base: null };
          holderDecisions.push({
            elapsedSeconds: t,
            playerId: possession.spec.playerId,
            state: offBase ? "pursue_tag" : "hold_no_positive_margin",
            base: bestCand?.base ?? null,
            margin: bestCand?.margin,
            carrySeconds: bestCand?.carrySeconds,
            receivingSeconds: bestCand?.receivingSeconds
          });
        }
        planned = assignment();
        assigned = planned.targets;
      }
      previousRoles = planned.roles;
      for (const f of defenders) {
        const before = at(f.body, t), vel = velocityAt(f.body, t), target = assigned.get(f), delta = through - t;
        const active = !dead && t >= start + responseSeconds(f);
        const bodyRadius = LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters, gloveRadius = Math.max(f.spec.gloveRadiusMeters, input.physics.ground.radiusM), grip = at(f.glove, t), currentOffset = sub8(grip, before);
        let motorPoint = target.point;
        if (active && target.intent === "intercept" && target.point.y <= gloveRadius + 0.2 && (forecasts.find((x) => x.f === f)?.predicted?.prediction.observedPosition.y ?? Infinity) <= gloveRadius + 0.2) {
          const pred = forecasts.find((x) => x.f === f)?.predicted, toT = flat(sub8(target.point, before)), distT = norm6(toT), stopTime = liveFieldArrivalSecondsV1({ ...roleActor(f, t), remainingReactionSeconds: 0 }, target.point, 0.02) + norm6(vel) / f.spec.accelerationMps2;
          if (distT > 0.35 && (!pred || !pred.intercepted || pred.eta < stopTime)) {
            const runThrough = f.spec.topSpeedMps * f.spec.topSpeedMps / (2 * f.spec.accelerationMps2) + 0.5;
            motorPoint = add15(target.point, mul5(toT, runThrough / distT));
          }
        }
        const seg = buildDefenderMotionTrajectory(
          { tick: 0, position: flat(before), velocity: flat(vel) },
          active ? flat(targetInside(motorPoint, fenceRadius - bodyRadius - 0.02)) : null,
          Math.max(1, Math.round(delta * tps)),
          {
            ticksPerSecond: tps,
            maxIntegrationStepTicks: Math.max(1, Math.round(delta * tps)),
            accelerationMps2: f.spec.accelerationMps2,
            brakingMps2: f.spec.accelerationMps2,
            topSpeedMps: f.spec.topSpeedMps,
            arrivalRadiusMeters: 0.02
          }
        )[0];
        const proposed = { from: t, p: before, velocity: vel, acceleration: v(seg.acceleration.x, 0, seg.acceleration.z) }, speed2 = norm6(vel), emergency = {
          from: t,
          p: before,
          velocity: vel,
          acceleration: speed2 > 0 ? mul5(vel, -f.spec.accelerationMps2 / speed2) : v(),
          stopAfter: speed2 / f.spec.accelerationMps2
        };
        const bodySafe = (c, stoppingReserve = LIVE_FIELD_TEST_MODEL_V1.fenceMotorStoppingReserveMeters) => [{ offset: v(), radius: bodyRadius }, { offset: currentOffset, radius: gloveRadius }].every((o) => {
          const translated = shifted(c, o.offset);
          return curveInside(translated, t, through, fenceRadius - o.radius, 0) && pointInside(add15(stopPoint(c, through, f.spec.accelerationMps2), o.offset), fenceRadius - o.radius - stoppingReserve);
        });
        let body = proposed, bodyBoundaryLimited = false;
        if (!bodySafe(body)) {
          bodyBoundaryLimited = true;
          if (!bodySafe(emergency, 0)) {
            motorBoundaryFailure = {
              kind: "body_fence_motor_infeasible",
              playerId: f.spec.playerId,
              position: before,
              velocity: vel,
              currentOffset,
              emergencyStop: stopPoint(emergency, through, f.spec.accelerationMps2),
              emergencyEnd: at(emergency, through)
            };
            return;
          }
          body = emergency;
          let low = 0, high = 1;
          for (let i = 0; i < 32; i++) {
            const u = (low + high) / 2, candidate = { ...proposed, acceleration: add15(mul5(emergency.acceleration, 1 - u), mul5(proposed.acceleration, u)) };
            if (bodySafe(candidate)) {
              low = u;
              body = candidate;
            } else high = u;
          }
        }
        f.body = body;
        f.intent = active ? target.intent : "hold";
        f.targetBase = target.base;
        const heldOffset = throwTarget && f === possession ? throwOffset(f, at(f.body, through), throwTarget.point) : v(0, 0, -0.5);
        const expected = forecasts.find((x) => x.f === f)?.predicted, sampledNext = expected ? expected.prediction.sample(Math.min(delta, expected.prediction.maximumSeconds)).position : null, perceivedTarget = expected ? expected.intercepted || sampledNext && distance5(flat(sampledNext), flat(fenceCenter)) <= fenceRadius - input.physics.ground.radiusM ? sampledNext : expected.point : at(f.body, through);
        let anticipated = f === handler || f === throwTarget?.receiver ? expected?.point ?? perceivedTarget : perceivedTarget;
        if (distance5(perceivedTarget, at(f.body, through)) <= f.spec.gloveReachMeters + f.spec.gloveRadiusMeters + input.physics.ground.radiusM)
          anticipated = perceivedTarget;
        if (f === throwTarget?.receiver) {
          const bodyAtThrough = at(f.body, through), q = throwTarget.point, frontDist = Math.min(f.spec.gloveReachMeters * 0.55, LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + f.spec.gloveRadiusMeters + 0.12), seen = seenBy(f, t), sourcePos = possession ? at(possession.glove, t) : throwTarget.releasedFrom ?? seen?.position ?? bodyAtThrough, toSourceFromQ = flat(sub8(sourcePos, q)), lenQ = norm6(toSourceFromQ), u = lenQ > 1e-6 ? mul5(toSourceFromQ, 1 / lenQ) : v(0, 0, -1), bodyProj = Math.max(0, (bodyAtThrough.x - q.x) * u.x + (bodyAtThrough.z - q.z) * u.z), distFromQ = bodyProj + frontDist, frac = clamp(distFromQ / Math.max(lenQ, 1), 0, 1), sourceY = Math.max(sourcePos.y, q.y + LIVE_FIELD_TEST_MODEL_V1.throwHand.heightAboveHipMeters * 0.85), frontPoint = add15(q, add15(mul5(u, distFromQ), v(0, (sourceY - q.y) * frac, 0)));
          if (expected && throwTarget.releasedAt !== void 0 && seen && seen.t >= throwTarget.releasedAt) {
            let lo = -(t - seen.t), hi = Math.min(2, expected.prediction.maximumSeconds);
            for (let i = 0; i < 10; i++) {
              const mid = (lo + hi) * 0.5, p = expected.prediction.sample(mid).position;
              if ((p.x - frontPoint.x) * u.x + (p.z - frontPoint.z) * u.z > 0) lo = mid;
              else hi = mid;
            }
            anticipated = expected.prediction.sample((lo + hi) * 0.5).position;
          } else {
            anticipated = frontPoint;
          }
        }
        const reachableTarget = v(anticipated.x, Math.max(gloveRadius, anticipated.y), anticipated.z);
        const tagRunner = f === possession && target.intent === "tag" ? runners.filter((r) => !r.retired && !r.scored && r.leg).sort((a, b) => distance5(at(f.body, through), runnerAt(a, through)) - distance5(at(f.body, through), runnerAt(b, through)))[0] : null;
        const relative = sub8(bodyBoundaryLimited ? at(f.body, through) : tagRunner ? add15(runnerAt(tagRunner, through), v(0, 0.9, 0)) : f === possession || f === pendingCatch?.fielder ? add15(at(f.body, through), heldOffset) : f === handler || f === throwTarget?.receiver ? reachableTarget : at(f.body, through), at(f.body, through));
        const desired = add15(at(f.body, through), mul5(relative, Math.min(1, f.spec.gloveReachMeters / Math.max(norm6(relative), 1e-30)))), limited = targetInside(v(desired.x, Math.max(gloveRadius, desired.y), desired.z), fenceRadius - gloveRadius - 0.02), wantedOffset = sub8(limited, at(f.body, through)), targetOffset = mul5(wantedOffset, Math.min(1, f.spec.gloveReachMeters / Math.max(norm6(wantedOffset), 1e-30))), relativeMove = sub8(targetOffset, currentOffset), relativeVelocity = active ? mul5(relativeMove, Math.min(1, f.spec.gloveSpeedMps * delta / Math.max(norm6(relativeMove), 1e-30)) / delta) : v();
        const gloveCurve = (u) => ({
          ...body,
          p: grip,
          velocity: add15(vel, mul5(relativeVelocity, u)),
          ...body.stopAfter !== void 0 ? { continuingVelocity: mul5(relativeVelocity, u) } : {}
        });
        const gloveSafe = (c, stoppingReserve = LIVE_FIELD_TEST_MODEL_V1.fenceMotorStoppingReserveMeters, motorThrough = through) => {
          if (!curveInside(c, t, motorThrough, fenceRadius - gloveRadius, gloveRadius) || !pointInside(add15(stopPoint(body, motorThrough, f.spec.accelerationMps2), sub8(at(c, motorThrough), at(body, motorThrough))), fenceRadius - gloveRadius - stoppingReserve)) return false;
          if (pendingCatch?.fielder === f) {
            const capture = pendingCatch, duration = capture.secure - capture.first, until = Math.min(through, capture.secure), offset = mul5(capture.offset, Math.max(0, 1 - (t - capture.first) / duration)), captureCurve = shifted(c, offset, mul5(capture.offset, -1 / duration));
            if (until > t && !curveInside(
              captureCurve,
              t,
              until,
              fenceRadius - input.physics.ground.radiusM + LIVE_FIELD_TEST_MODEL_V1.wallMaterial.maximumCompressionMeters,
              input.physics.ground.radiusM - roundBound(at(captureCurve, t))
            )) return false;
          }
          return true;
        };
        if (f === possession && throwTarget && (!bodyBoundaryLimited || handPreparation?.fielder === f)) {
          if (!handPreparation || handPreparation.fielder !== f || handPreparation.base !== throwTarget.base) {
            const preparation = createLiveHandPreparationV1({
              fromElapsedSeconds: t,
              initialOffset: currentOffset,
              initialRelativeVelocity: sub8(velocityAt(f.glove, t), vel),
              targetOffset: heldOffset,
              maximumRelativeSpeedMps: f.spec.gloveSpeedMps,
              maximumReachMeters: f.spec.gloveReachMeters
            });
            if (preparation.kind === "planned") {
              handPreparation = { fielder: f, base: throwTarget.base, curve: preparation, prepared: preparation.throughElapsedSeconds === t };
              handPreparationProofs.push({
                playerId: f.spec.playerId,
                base: throwTarget.base,
                from: preparation.fromElapsedSeconds,
                through: preparation.throughElapsedSeconds,
                target: throwTarget.point,
                controls: preparation.cubicBezierControls(preparation.fromElapsedSeconds, preparation.throughElapsedSeconds),
                diagnostics: preparation.diagnostics
              });
            } else {
              for (const o of deriveCurrentForceObligations(force).filter((o2) => o2.targetBase === throwTarget.base)) rejectedThrows.add(o.runnerId + ":" + o.targetBase);
              throwDecisions.push({ elapsedSeconds: t, base: throwTarget.base, reason: "c1_hand_preparation_unreachable" });
              throwTarget = null;
              releaseAt = null;
            }
          }
          if (handPreparation && handPreparation.fielder === f && throwTarget) {
            const preparation = handPreparation, curve = preparation.curve, motorEnd = preparation.prepared ? through : Math.min(through, curve.throughElapsedSeconds), initial = curve.sampleAtElapsedSeconds(Math.min(t, curve.throughElapsedSeconds)), duration = curve.durationSeconds, controls2 = curve.cubicBezierControls(curve.fromElapsedSeconds, curve.throughElapsedSeconds), relativeJerk = preparation.prepared || duration === 0 ? v() : mul5(add15(sub8(controls2[3], mul5(controls2[2], 3)), sub8(mul5(controls2[1], 3), controls2[0])), 6 / duration ** 3), relativeAcceleration = preparation.prepared ? v() : initial.relativeAcceleration, relativeVelocityAtStart = preparation.prepared ? v() : initial.relativeVelocity;
            const smooth = {
              ...body,
              p: grip,
              velocity: add15(vel, relativeVelocityAtStart),
              acceleration: add15(body.acceleration, relativeAcceleration),
              jerk: relativeJerk
            };
            if (body.stopAfter !== void 0) {
              const stop = body.stopAfter;
              smooth.continuingVelocity = add15(relativeVelocityAtStart, add15(mul5(relativeAcceleration, stop), mul5(relativeJerk, 0.5 * stop ** 2)));
              smooth.continuingAcceleration = add15(relativeAcceleration, mul5(relativeJerk, stop));
              smooth.continuingJerk = relativeJerk;
            }
            if (!preparation.prepared && curve.throughElapsedSeconds <= through) smooth.exactEnd = {
              time: curve.throughElapsedSeconds,
              position: add15(at(body, curve.throughElapsedSeconds), curve.sampleAtElapsedSeconds(curve.throughElapsedSeconds).offset),
              velocity: velocityAt(body, curve.throughElapsedSeconds)
            };
            if (!gloveSafe(smooth, LIVE_FIELD_TEST_MODEL_V1.fenceMotorStoppingReserveMeters, motorEnd)) {
              motorBoundaryFailure = { kind: "c1_hand_fence_motor_infeasible", playerId: f.spec.playerId, position: grip };
              return;
            }
            f.glove = smooth;
            continue;
          }
        }
        let glove = gloveCurve(1);
        if (!gloveSafe(glove)) {
          if (!gloveSafe(gloveCurve(0), 0)) {
            motorBoundaryFailure = { kind: "glove_fence_motor_infeasible", playerId: f.spec.playerId, position: grip };
            return;
          }
          glove = gloveCurve(0);
          let low = 0, high = 1;
          for (let i = 0; i < 32; i++) {
            const u = (low + high) / 2, candidate = gloveCurve(u);
            if (gloveSafe(candidate)) {
              low = u;
              glove = candidate;
            } else high = u;
          }
        }
        f.glove = glove;
      }
      runnerDecisionPending = false;
      lastRunnerEvaluationSeconds = t;
      const defenseControlCache = /* @__PURE__ */ new Map();
      const estimateDefenseControl = (n) => {
        if (defenseControlCache.has(n)) return defenseControlCache.get(n);
        const fastestArm = Math.max(...defenders.map((f) => f.spec.throwSpeedMps + norm6(velocityAt(f.body, t)))), estimates = defenders.flatMap((f) => {
          const controlled = possession ?? pendingCatch?.fielder;
          if (controlled && controlled !== f) return [];
          const predicted = forecasts.find((x) => x.f === f)?.predicted;
          if (!controlled && !predicted) return [];
          const pickupSeconds = possession ? 0 : pendingCatch ? Math.max(0, pendingCatch.secure - t) : predicted.eta, point = controlled ? at(f.glove, t) : predicted.point, transfer = possession ? Math.max(0, custodySince + f.spec.transferSeconds - t) : f.spec.transferSeconds, throwSeconds = distance5(point, add15(base(n), v(0, 0.9, 0))) / fastestArm, receiverSeconds = Math.min(...defenders.filter((other) => other !== f).map((other) => liveFieldArrivalSecondsV1(roleActor(other, t), base(n), other.spec.gloveReachMeters)));
          return [Math.min(
            pickupSeconds + liveFieldArrivalSecondsV1({ ...roleActor(f, t), position: point }, base(n), f.spec.gloveReachMeters),
            Math.max(pickupSeconds + transfer + throwSeconds, receiverSeconds)
          )];
        });
        const result = estimates.length ? Math.min(...estimates) : null;
        defenseControlCache.set(n, result);
        return result;
      };
      const targetOccupiedByOther = (r, n) => runners.some((x) => x !== r && !x.retired && !x.scored && (x.base === n && (!x.leg || x.leg.to <= x.base) || x.leg?.motion.touches.slice(x.leg.nextTouchIndex).some((b) => b.base === n)));
      for (const r of runners.slice().sort((a, b) => b.base - a.base)) {
        if (r.retired || r.scored || r.leg) continue;
        const forced = deriveCurrentForceObligations(force).some((o) => o.runnerId === r.spec.runnerId);
        const next = r.base + 1;
        if (next > 4) continue;
        const targetOccupied = targetOccupiedByOther(r, next);
        const defenderControlSeconds = estimateDefenseControl(next);
        const awardTarget = overFence?.fair ? Math.min(4, (overFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + (overFence.untouchedGround ? 4 : 2)) : null;
        const decision = decideLiveRunnerAdvanceV1({
          nowSeconds: t,
          playStartedAtSeconds: start,
          currentBase: r.base,
          outs: input.outs,
          distanceToNextBaseMeters: distance5(flat(runnerAt(r, t)), flat(base(next))),
          baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? 0.28,
          targetOccupied,
          runner: r.spec,
          forced,
          awardThroughBase: awardTarget,
          firstGroundContactElapsedSeconds: firstGroundContactSeconds,
          firstFielderTouchElapsedSeconds: firstFielderTouchSeconds,
          defenderControlSeconds,
          policy: { safetyMarginSeconds: r.spec.advanceSafetyMarginSeconds }
        });
        if (decision.reason === "recognizing_departure_cue" && !targetOccupied) runnerDecisionPending = true;
        const previous = runnerDecisions.slice().reverse().find((d) => d.runnerId === r.spec.runnerId);
        if (!previous || previous.targetBase !== next || previous.reason !== decision.reason || decision.advance)
          runnerDecisions.push({ elapsedSeconds: t, runnerId: r.spec.runnerId, targetBase: next, defenderControlSeconds, ...decision });
        if (decision.advance && !(r.base === 0 && flyCatch) && !(dead && awardTarget === null)) beginLeg(r, next, t);
      }
      for (const r of runners.slice().sort((a, b) => b.base - a.base)) {
        const leg = r.leg;
        if (!leg || r.retired || r.scored || leg.departure !== null || leg.nextTouchIndex >= leg.motion.touches.length || leg.motion.touches.length - leg.nextTouchIndex > 1 || leg.to >= 4 || t < (roundingRecheckAfter.get(r.spec.runnerId) ?? -Infinity)) continue;
        const awardThrough = overFence?.fair ? Math.min(4, (overFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + (overFence.untouchedGround ? 4 : 2)) : null, cue = firstGroundContactSeconds ?? firstFielderTouchSeconds;
        if (awardThrough === null && (dead || cue === null || t < cue + r.spec.reactionSeconds)) continue;
        const finalBase = awardThrough !== null ? awardThrough : leg.to + 1;
        if (finalBase <= leg.to || Array.from({ length: finalBase - leg.to + 1 }, (_, i) => leg.to + i).some((n) => targetOccupiedByOther(r, n))) continue;
        roundingRecheckAfter.set(r.spec.runnerId, t + 0.12);
        const defense = estimateDefenseControl(finalBase);
        if (awardThrough === null && (defense === null || distance5(flat(runnerAt(r, t)), flat(base(finalBase))) / r.spec.topSpeedMps + (r.spec.advanceSafetyMarginSeconds ?? 0.35) >= defense)) continue;
        const position = runnerAt(r, t), velocity = runnerVelocityAt(r, t), motion = createLiveRunnerMotionV1({
          position,
          velocity,
          bases: Array.from({ length: finalBase - leg.to + 1 }, (_, i) => ({ base: leg.to + i, position: base(leg.to + i) })),
          topSpeedMps: r.spec.topSpeedMps,
          accelerationMps2: r.spec.accelerationMps2,
          roundingRadiusMeters: r.spec.roundingRadiusMeters ?? 4.5,
          lateralAccelerationMps2: r.spec.lateralAccelerationMps2 ?? 1.5 * r.spec.accelerationMps2,
          baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? 0.28
        });
        if (!motion || awardThrough === null && defense - motion.touches[motion.touches.length - 1].elapsedSeconds <= (r.spec.advanceSafetyMarginSeconds ?? 0.35)) continue;
        r.leg = { from: t, to: leg.to, motion, nextTouchIndex: 0, height: position.y, departure: null };
        runnerMotions.push({
          elapsedSeconds: t,
          runnerId: r.spec.runnerId,
          throughBases: motion.touches.map((b) => b.base),
          position,
          velocity,
          durationSeconds: motion.durationSeconds,
          lengthMeters: motion.lengthMeters,
          route: motion.route
        });
      }
    };
    const applyBaseControl = (f, n, t) => {
      const current = controlledBaseContacts.at(-1);
      if (current?.defenderId === f.spec.playerId && current.base === n && tick8(t) - current.tick < tps / 5) return;
      controlledBaseContacts.push({ kind: "controlled_base_contact", defenderId: f.spec.playerId, base: n, tick: tick8(t) });
      emit("controlled_base_contact", t, { playerId: f.spec.playerId, base: n });
      for (const o of deriveCurrentForceObligations(force)) if (o.targetBase === n) {
        const r = runners.find((r2) => r2.spec.runnerId === o.runnerId);
        if (r.leg || r.base !== n) retire(r, t);
      }
    };
    let controlThrough = start, nextFrame = start, terminal = false;
    observe(start);
    while (time < max && !terminal) {
      if (time === controlThrough) {
        controlThrough = Math.min(max, time + LIVE_FIELD_TEST_MODEL_V1.controlSeconds);
        ensureThrough(controlThrough);
        plan(time, controlThrough);
        if (motorBoundaryFailure) {
          unresolvedDetail = motorBoundaryFailure;
          endReason = "actor_boundary_motor_required";
          break;
        }
      }
      let horizon = controlThrough, event = null;
      const choose = (e2) => {
        if (!event || e2.t < event.t) {
          event = e2;
          horizon = e2.t;
        }
      };
      if (pendingCatch && pendingCatch.secure <= horizon) choose({ kind: "secure", t: Math.max(time, pendingCatch.secure) });
      const currentHandPreparation = handPreparation;
      if (currentHandPreparation && !currentHandPreparation.prepared && currentHandPreparation.curve.throughElapsedSeconds <= horizon)
        choose({ kind: "hand_prepared", t: currentHandPreparation.curve.throughElapsedSeconds });
      if (releaseAt !== null && releaseAt <= horizon) choose({ kind: "release", t: Math.max(time, releaseAt) });
      for (const r of runners) if (r.leg) {
        const touch = r.leg.motion.touches[r.leg.nextTouchIndex], atTime = r.leg.from + (touch?.elapsedSeconds ?? r.leg.motion.durationSeconds);
        if (atTime <= horizon) choose({ kind: touch ? "arrival" : "runner_stop", runner: r, t: atTime });
        if (r.leg.departure && r.leg.departure.elapsedSeconds <= horizon)
          choose({ kind: "runner_departure", runner: r, t: r.leg.departure.elapsedSeconds });
      }
      if (!possession && !pendingCatch && !dead) {
        const ground = kernel.boundaries.find((b) => b.kind !== "rolling_stop" && b.kind !== "rolling_started" && b.elapsedSeconds > time && b.elapsedSeconds <= horizon) ?? kernel.boundaries.find((b) => b.kind !== "rolling_started" && b.elapsedSeconds > time && b.elapsedSeconds <= horizon);
        if (ground) choose({ kind: ground.kind, t: ground.elapsedSeconds });
        const cache = /* @__PURE__ */ new Map();
        const evaluated = (t) => {
          let e2 = cache.get(t);
          if (!e2) {
            e2 = kernel.evaluateAt(t, "incoming");
            cache.set(t, e2);
          }
          return e2;
        };
        const cellStart = kernel.cells.findIndex((c) => c.throughElapsedSeconds >= time);
        for (let ci = Math.max(0, cellStart); ci < kernel.cells.length; ci++) {
          const cell = kernel.cells[ci];
          if (cell.fromElapsedSeconds > horizon) break;
          const lo = Math.max(time, cell.fromElapsedSeconds), hi = Math.min(horizon, cell.throughElapsedSeconds);
          if (hi <= lo) continue;
          for (const f of defenders) for (const role of ["glove", "body"]) {
            if (role === "glove" && (time < f.catchEnabledAfter || releaseOpen === f)) continue;
            const c = role === "glove" ? f.glove : f.body, radius = role === "glove" ? f.spec.gloveRadiusMeters : LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters;
            const gap = (t) => distance5(evaluated(t).moment.ball.position, at(c, t)) - radius - input.physics.ground.radiusM;
            let from = lo;
            if (reboundEscape?.fielder === f && reboundEscape.role === role && lo === reboundEscape.outgoing.elapsedSeconds && gap(lo) <= 0) {
              const proof = reboundEscape, rel = sub8(proof.outgoing.ball.velocity, velocityAt(c, lo)), outward = rel.x * proof.normal.x + rel.y * proof.normal.y + rel.z * proof.normal.z;
              const ballDeviation = kernel.evaluateAt(lo, "outgoing").phase === "airborne" ? sourceRk4PositionBounds(proof.outgoing.ball, hi - lo, input.physics.air).linearDeviationMps2 : Math.max(input.physics.ground.material.slidingFriction * input.physics.ground.gravityMps2, input.physics.ground.material.rollingDecelerationMps2) / 2;
              const deviation = ballDeviation + maximumCurveAcceleration(c, hi) / 2;
              const span = Math.min(hi - lo, deviation > 0 ? outward / (2 * deviation) : hi - lo), escape = 2 * (-gap(lo) + cell.positionRoundingBoundMeters) / outward;
              const penetrationBound = proof.hit.rounding + proof.hit.speed * (proof.hit.t - proof.hit.from), lower = gap(lo) + outward * escape - deviation * escape * escape - cell.positionRoundingBoundMeters;
              if (!(tick8(proof.hit.t) === tick8(proof.hit.from) && gap(lo) >= -penetrationBound && outward > 0 && escape >= 0 && Number.isFinite(escape) && escape < span && lower > 0 && gap(lo + escape) > 0 && gap(lo + span) > 0)) {
                unresolvedDetail = { kind: "contact_departure", outward, escape, span, signedGap: gap(lo), rounding: cell.positionRoundingBoundMeters, witness: proof.hit };
                choose({ kind: "unresolved", t: time });
                continue;
              }
              departureProofs.push({
                kind: "actor",
                from: lo,
                through: lo + span,
                escapeThrough: lo + escape,
                signedGap: gap(lo),
                penetrationBoundMeters: penetrationBound,
                supportingPlaneLowerGapMeters: lower,
                actualGapAtEscapeMeters: gap(lo + escape)
              });
              from = lo + span;
            }
            if (from < hi) {
              collisionQueries++;
              const hit = findContact(gap, cell.maximumPositionSpeedMps + maximumCurveSpeed(c, from, hi), cell.positionRoundingBoundMeters, from, hi);
              if (hit) {
                const unsupported = hit.ambiguous || tick8(hit.from) !== tick8(hit.t);
                if (unsupported) unresolvedDetail = { kind: "actor_contact_refinement", playerId: f.spec.playerId, role, hit };
                choose({ kind: unsupported ? "unresolved" : role, t: hit.t, f, role, hit });
              }
            }
          }
          if (!wallContact) {
            const radius = fenceRadius - input.physics.ground.radiusM;
            const gap = (t) => radius - distance5(flat(evaluated(t).moment.ball.position), flat(fenceCenter));
            let fenceFrom = lo;
            if (fenceEscape?.from === lo && fenceEscape.radius === radius && gap(lo) <= 0) {
              const d = flat(sub8(evaluated(lo).moment.ball.position, fenceCenter)), radial = norm6(d), vel = evaluated(lo).moment.ball.velocity;
              const outward = -(d.x * vel.x + d.z * vel.z) / radial, speed2 = cell.maximumPositionSpeedMps;
              const ballDeviation = kernel.evaluateAt(lo, "outgoing").phase === "airborne" ? sourceRk4PositionBounds(fenceEscape.outgoing.ball, hi - lo, input.physics.air).linearDeviationMps2 : Math.max(input.physics.ground.material.slidingFriction * input.physics.ground.gravityMps2, input.physics.ground.material.rollingDecelerationMps2) / 2;
              const denominator = radial - speed2 * (hi - lo), deviation = ballDeviation + speed2 * speed2 / (2 * Math.max(denominator, Number.MIN_VALUE));
              const span = Math.min(hi - lo, outward / (2 * deviation)), escape = 2 * (-gap(lo) + cell.positionRoundingBoundMeters) / outward;
              const hit = fenceEscape.witness, penetrationBound = hit.rounding + hit.speed * (hit.t - hit.from), lower = gap(lo) + outward * escape - deviation * escape * escape - cell.positionRoundingBoundMeters;
              if (!(tick8(hit.t) === tick8(hit.from) && gap(lo) >= -penetrationBound && denominator > 0 && outward > 0 && Number.isFinite(escape) && escape >= 0 && escape < span && lower > 0 && gap(lo + escape) > 0 && gap(lo + span) > 0)) {
                unresolvedDetail = {
                  kind: "fence_departure",
                  denominator,
                  outward,
                  escape,
                  span,
                  gap: gap(lo),
                  rounding: cell.positionRoundingBoundMeters,
                  actualGapAtEscape: escape >= 0 && escape <= hi - lo ? gap(lo + escape) : null,
                  actualGapAtEnd: gap(lo + span)
                };
                choose({ kind: "unresolved", t: time });
              } else {
                departureProofs.push({
                  kind: "fence",
                  from: lo,
                  through: lo + span,
                  escapeThrough: lo + escape,
                  signedGap: gap(lo),
                  penetrationBoundMeters: penetrationBound,
                  supportingPlaneLowerGapMeters: lower,
                  actualGapAtEscapeMeters: gap(lo + escape)
                });
                fenceFrom = lo + span;
              }
            }
            const crossing2 = fenceFrom < Math.min(hi, horizon) ? findContact(
              gap,
              cell.maximumPositionSpeedMps,
              cell.positionRoundingBoundMeters,
              fenceFrom,
              Math.min(hi, horizon)
            ) : null;
            if (crossing2) choose({ kind: crossing2.ambiguous || tick8(crossing2.from) !== tick8(crossing2.t) ? "unresolved" : "fence", t: crossing2.t, hit: crossing2 });
          }
          if (!hasThrown && firstGroundContactTick !== null && !territoryFixed) {
            const gate = findContact(
              (t) => distance5(flat(base(1)), flat(base(0))) - distance5(flat(evaluated(t).moment.ball.position), flat(base(0))),
              cell.maximumPositionSpeedMps,
              cell.positionRoundingBoundMeters,
              lo,
              Math.min(hi, horizon)
            );
            if (gate) choose({ kind: gate.ambiguous || tick8(gate.from) !== tick8(gate.t) ? "unresolved" : "fair_foul_gate", t: gate.t });
          }
        }
      }
      if (possession && !dead) {
        const f = possession, speed2 = Math.max(norm6(velocityAt(f.body, time)), norm6(velocityAt(f.body, horizon)));
        for (const n of [1, 2, 3, 4]) {
          const relevant = deriveCurrentForceObligations(force).some((o) => o.targetBase === n);
          if (!relevant) continue;
          const hit = findContact((t) => distance5(flat(at(f.body, t)), flat(base(n))) - (field.baseTouchRadiusMeters ?? 0.28), speed2, 128 * Number.EPSILON, time, horizon);
          if (hit && !hit.ambiguous) choose({ kind: "base", t: hit.t, f, base: n });
        }
        for (const r of runners) if (!r.retired && !r.scored) {
          const forced = deriveCurrentForceObligations(force).some((o) => o.runnerId === r.spec.runnerId);
          if (!r.leg && !forced) continue;
          const hit = findContact(
            (t) => Math.max(
              distance5(at(f.glove, t), add15(runnerAt(r, t), v(0, 0.9, 0))) - 0.28,
              r.base > 0 && !forced ? (field.baseTouchRadiusMeters ?? 0.28) - distance5(flat(runnerAt(r, t)), flat(base(r.base))) : -Infinity
            ),
            maximumCurveSpeed(f.glove, time, horizon) + r.spec.topSpeedMps,
            128 * Number.EPSILON,
            time,
            horizon
          );
          if (hit && !hit.ambiguous) choose({ kind: "tag", t: hit.t, f, runner: r });
        }
      }
      while (nextFrame < horizon) {
        sampleFrame(nextFrame);
        nextFrame = start + frames.length * frameSeconds;
      }
      time = horizon;
      const e = event;
      if (e) {
        if (e.kind === "unresolved") {
          endReason = "numerical_contact_refinement_required";
          terminal = true;
        } else if (e.kind === "ground" || e.kind === "rolling_stop") {
          if (e.kind === "ground") {
            if (!hasThrown) {
              firstGroundContactTick ??= tick8(time);
              firstGroundContactSeconds ??= time;
            }
            emit("ground_contact", time, { position: kernel.evaluateAt(time, "incoming").moment.ball.position });
          }
          side = "outgoing";
          if (!territoryFixed && (distance5(flat(ballAt2(time).position), flat(base(0))) >= distance5(flat(base(1)), flat(base(0))) || e.kind === "rolling_stop")) {
            determineTerritory(time, isFair(ballAt2(time).position) ? "fair" : "foul");
            if (territory === "foul") {
              dead = true;
              terminal = true;
              endReason = "foul_dead_ball";
            }
          }
        } else if (e.kind === "fair_foul_gate") {
          determineTerritory(time, isFair(kernel.evaluateAt(time, "incoming").moment.ball.position) ? "fair" : "foul");
          if (territory === "foul") {
            dead = true;
            terminal = true;
            endReason = "foul_dead_ball";
          }
        } else if (e.kind === "glove" || e.kind === "body") {
          const f = e.f, c = e.role === "glove" ? f.glove : f.body, incoming = kernel.evaluateAt(time, "incoming"), center = at(c, time), delta = sub8(incoming.moment.ball.position, center), normal4 = mul5(delta, 1 / norm6(delta));
          const phase = multiplyQuaternions(incoming.orientation, orientationBasis);
          if (!territoryFixed) determineTerritory(time, isFair(incoming.moment.ball.position) ? "fair" : "foul");
          firstTouchTick ??= tick8(time);
          firstFielderTouchSeconds ??= time;
          if (territory === "foul" && firstGroundContactTick !== null) {
            dead = true;
            terminal = true;
            endReason = "foul_dead_ball";
            continue;
          }
          let outgoing;
          if (e.kind === "glove") {
            emit("glove_contact", time, { playerId: f.spec.playerId, position: incoming.moment.ball.position });
            const ballSurfacePoint = sub8(incoming.moment.ball.position, mul5(normal4, input.physics.ground.radiusM));
            const pocketEntryCenter = add15(center, mul5(normal4, f.spec.gloveRadiusMeters));
            const pocketOffsetMeters = distance5(ballSurfacePoint, pocketEntryCenter);
            const bodySpd = norm6(velocityAt(f.body, time)), gloveExt = distance5(center, at(f.body, time)), gloveRelSpd = norm6(sub8(velocityAt(c, time), velocityAt(f.body, time))), speedRatio = clamp(bodySpd / Math.max(f.spec.topSpeedMps, 0.1), 0, 1), extRatio = clamp(gloveExt / Math.max(f.spec.gloveReachMeters, 0.1), 0, 1), gloveMoveRatio = clamp(gloveRelSpd / Math.max(f.spec.gloveSpeedMps, 0.1), 0, 1), bodyStability = clamp(1 - 0.22 * speedRatio * speedRatio - 0.2 * Math.max(0, extRatio - 0.55) / 0.45 - 0.15 * gloveMoveRatio, 0.42, 1);
            const retention = resolveCatchRetention({
              contactTick: tick8(time),
              ball: { ...incoming.moment.ball, tick: tick8(time) },
              glove: { tick: tick8(time), position: center, velocity: velocityAt(c, time) },
              contactNormal: normal4,
              pocketOffsetMeters,
              bodyStability
            }, f.spec.catchRetention);
            contactDiagnostics.push({
              elapsedSeconds: time,
              playerId: f.spec.playerId,
              role: "glove",
              ballSpeedMps: norm6(incoming.moment.ball.velocity),
              bodySpeedMps: bodySpd,
              gloveOffsetMeters: gloveExt,
              intent: f.intent,
              targetBase: f.targetBase,
              distanceToTargetBaseMeters: f.targetBase ? distance5(flat(at(f.body, time)), flat(base(f.targetBase))) : null,
              retention: {
                outcome: retention.outcome.kind,
                retentionLoadJ: retention.diagnostics.retentionLoadJ,
                effectiveCapacityJ: retention.diagnostics.effectiveCapacityJ,
                pocketOffsetMeters,
                bodyStability
              }
            });
            if (retention.outcome.kind === "secured") {
              orientationBasis = phase;
              pendingCatch = {
                fielder: f,
                first: time,
                secure: time + Math.max(
                  retention.diagnostics.retentionLoadJ / f.spec.catchRetention.captureDissipationPowerW,
                  norm6(delta) / f.spec.gloveSpeedMps
                ),
                firstTouchWasAirborne: firstGroundContactTick === null,
                offset: delta,
                spin: incoming.moment.ball.spin,
                initialPosition: incoming.moment.ball.position,
                initialGlove: center
              };
              throwTarget = null;
              releaseOpen = null;
              reboundEscape = null;
              controlThrough = time;
              continue;
            }
            outgoing = retention.outcome.ball;
          } else {
            emit("body_contact", time, { playerId: f.spec.playerId, position: incoming.moment.ball.position });
            contactDiagnostics.push({
              elapsedSeconds: time,
              playerId: f.spec.playerId,
              role: "body",
              ballSpeedMps: norm6(incoming.moment.ball.velocity),
              bodySpeedMps: norm6(velocityAt(f.body, time)),
              gloveOffsetMeters: distance5(at(f.glove, time), at(f.body, time)),
              intent: f.intent,
              targetBase: f.targetBase,
              distanceToTargetBaseMeters: f.targetBase ? distance5(flat(at(f.body, time)), flat(base(f.targetBase))) : null
            });
            outgoing = respondToBallContact({ ball: incoming.moment.ball, normal: normal4, surfaceVelocity: velocityAt(c, time), material: LIVE_FIELD_TEST_MODEL_V1.bodyMaterial });
          }
          if (incoming.moment.ball.position.y === input.physics.ground.radiusM) {
            try {
              const coupled = resolveGroundedActorContactResponseV1({
                incoming: incoming.moment.ball,
                actorResponse: outgoing,
                normal: normal4,
                surfaceVelocity: velocityAt(c, time),
                ground: input.physics.ground,
                actorRestitution: e.kind === "glove" ? f.spec.catchRetention.failedContactRestitution : LIVE_FIELD_TEST_MODEL_V1.bodyMaterial.restitution
              });
              outgoing = coupled.ball;
              simultaneousContacts.push(coupled.proof);
              if (coupled.proof.groundMaterialResponseApplied || coupled.proof.groundImpulsePerMass > 0)
                emit("ground_contact", time, { position: incoming.moment.ball.position, reason: "simultaneous_actor_ground_impulse" });
            } catch (error) {
              unresolvedDetail = { kind: "simultaneous_actor_ground_contact", message: error instanceof Error ? error.message : String(error) };
              terminal = true;
              endReason = "simultaneous_contact_response_required";
              continue;
            }
          }
          const moment = { ...incoming.moment, ball: outgoing };
          kernel = build(moment);
          wallContact = null;
          orientationBasis = phase;
          side = "outgoing";
          reboundEscape = { fielder: f, role: e.role, hit: e.hit, normal: normal4, outgoing: kernel.evaluateAt(time, "outgoing").moment };
        } else if (e.kind === "hand_prepared") {
          handPreparation.prepared = true;
          controlThrough = time;
          if (releaseAt !== null) releaseAt = time;
        } else if (e.kind === "secure") {
          const c = pendingCatch;
          orientationBasis = ballAt2(time).orientation;
          possession = c.fielder;
          pendingCatch = null;
          custodySince = time;
          rejectedThrows.clear();
          relayCache.clear();
          handPreparation = null;
          emit("catch_secured", time, { playerId: possession.spec.playerId, position: at(possession.glove, time) });
          if (c.firstTouchWasAirborne && !flyCatch) {
            flyCatch = { fielderId: possession.spec.playerId, firstTouchTick, secureCatchTick: tick8(time) };
            retire(batter, time);
          }
        } else if (e.kind === "release") {
          const f = possession, target = throwTarget, position = at(f.glove, time), q = target.point, d = sub8(q, position), speed2 = f.spec.throwSpeedMps;
          if (!pointInside(position, fenceRadius - input.physics.ground.radiusM)) {
            unresolvedDetail = { kind: "held_ball_fence_constraint", playerId: f.spec.playerId, position };
            terminal = true;
            endReason = "actor_boundary_motor_required";
            continue;
          }
          const obligations = outTargets().filter((o) => o.targetBase === target.base && o.runnerId === target.runnerId);
          const reject = (reason, flightSeconds) => {
            for (const o of obligations) rejectedThrows.add(o.runnerId + ":" + o.targetBase);
            throwDecisions.push({ elapsedSeconds: time, base: target.base, reason, ...flightSeconds === void 0 ? {} : { flightSeconds } });
            throwTarget = null;
            releaseAt = null;
            handPreparation = null;
          };
          if (!obligations.length) {
            reject("force_already_satisfied");
            continue;
          }
          const radial = sub8(position, at(f.body, time));
          const preparation = handPreparation, preparationReady = preparation?.fielder === f && preparation.base === target.base && preparation.prepared, desiredOffset = preparationReady ? preparation.curve.sampleAtElapsedSeconds(preparation.curve.throughElapsedSeconds).offset : throwOffset(f, at(f.body, time), q), otherShapeClear = defenders.filter((other) => other !== f).every((other) => distance5(position, at(other.body, time)) > LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + input.physics.ground.radiusM && distance5(position, at(other.glove, time)) > other.spec.gloveRadiusMeters + input.physics.ground.radiusM);
          const distToBag = distance5(flat(at(target.receiver.body, time)), flat(target.receiverPoint)), touchR = field.baseTouchRadiusMeters ?? 0.28, brakeEtaToBag = distToBag <= touchR ? 0 : Math.sqrt(2 * distToBag / target.receiver.spec.accelerationMps2) - Math.sqrt(2 * touchR / target.receiver.spec.accelerationMps2), receiverEtaToBag = Math.max(
            liveFieldArrivalSecondsV1({ ...roleActor(target.receiver, time), remainingReactionSeconds: 0 }, target.receiverPoint, touchR),
            brakeEtaToBag
          );
          const receiverPrepared = distToBag <= target.receiver.spec.gloveReachMeters + touchR && receiverEtaToBag <= distance5(position, q) / speed2;
          if (norm6(radial) <= LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + input.physics.ground.radiusM || !preparationReady || distance5(radial, desiredOffset) > input.physics.ground.radiusM || !otherShapeClear || !receiverPrepared) {
            releaseAt = controlThrough;
            if (releaseAt === time) releaseAt += LIVE_FIELD_TEST_MODEL_V1.controlSeconds;
            continue;
          }
          const horizontalSpeed = norm6(flat(d)), backspin = f.spec.throwBackspinRadPerSecond ?? 0;
          assert9(Number.isFinite(backspin) && backspin >= 0 && (!f.spec.throwSpinRadPerSecond || finite9(f.spec.throwSpinRadPerSecond)), "explicit throw spin differs");
          const spin = f.spec.throwSpinRadPerSecond ?? (horizontalSpeed > 0 ? v(-d.z / horizontalSpeed * backspin, 0, d.x / horizontalSpeed * backspin) : v()), planned = planLiveThrowV1({
            releasePosition: position,
            bodyVelocity: velocityAt(f.body, time),
            maximumThrowSpeedMps: speed2,
            spin,
            physics: input.physics,
            target: q
          });
          if (planned.kind !== "planned") {
            reject("aero_throw_unreachable");
            continue;
          }
          const runnerTime = Math.max(...obligations.map((o) => {
            const r = runners.find((r2) => r2.spec.runnerId === o.runnerId);
            return runnerArrivalSeconds(r, target.base, time);
          }));
          if (runnerTime <= planned.flightSeconds) {
            reject("aero_throw_arrives_after_runner", planned.flightSeconds);
            continue;
          }
          const bodyVelocity = velocityAt(f.body, time), actualDirection = applyLiveThrowDirectionV1({
            velocity: planned.initialVelocity,
            bodyVelocity,
            spin,
            standardDeviationRadians: f.spec.throwDirectionStdRadians ?? 0,
            seed: input.seed ?? 0,
            releaseOrdinal: throwDirectionCommands.length
          }), velocity = actualDirection.velocity;
          throwDirectionCommands.push({ elapsedSeconds: time, plannedVelocity: planned.initialVelocity, bodyVelocity, actual: actualDirection });
          throwDecisions.push({ elapsedSeconds: time, base: target.base, reason: "positive_margin_physical_throw", flightSeconds: planned.flightSeconds });
          kernel = build({ originTick, elapsedSeconds: time, ball: { tick: tick8(time), position, velocity, spin } });
          wallContact = null;
          emit("throw_release", time, {
            playerId: f.spec.playerId,
            base: target.base,
            position,
            runnerId: target.runnerId,
            reason: target.intent === "relay" ? "relay_play" : obligations.some((o) => o.forced) ? "force_play" : "tag_play",
            receiverPlayerId: target.receiver.spec.playerId,
            target: q
          });
          const visitKey = target.runnerId + ":" + target.base, visited = relayVisited.get(visitKey) ?? /* @__PURE__ */ new Set();
          visited.add(f.spec.playerId);
          relayVisited.set(visitKey, visited);
          hasThrown = true;
          lastThrowBases = Object.fromEntries(runners.filter((r) => !r.retired && !r.scored).map((r) => [r.spec.runnerId, r.base]));
          target.releasedAt = time;
          target.releasedFrom = position;
          handPreparation = null;
          releaseOpen = f;
          f.catchEnabledAfter = time + 0.15;
          possession = null;
          side = "outgoing";
          releaseAt = null;
          reboundEscape = null;
          observe(time);
          controlThrough = time;
        } else if (e.kind === "arrival") {
          const r = e.runner, leg = r.leg, touch = leg.motion.touches[leg.nextTouchIndex];
          physicalBaseDepartures.delete(r.spec.runnerId);
          r.p = runnerAt(r, time);
          r.base = touch.base;
          r.scored = r.base === 4;
          leg.nextTouchIndex++;
          leg.to = leg.motion.touches[leg.nextTouchIndex]?.base ?? r.base;
          if (leg.nextTouchIndex < leg.motion.touches.length) {
            let lo = touch.centerElapsedSeconds, hi = leg.motion.touches[leg.nextTouchIndex].centerElapsedSeconds;
            for (let i = 0; i < 53 && (lo + hi) / 2 !== lo && (lo + hi) / 2 !== hi; i++) {
              const mid = (lo + hi) / 2, p = leg.motion.sampleAtElapsedSeconds(mid).position;
              if (distance5(flat(v(p.x, 0, p.z)), flat(base(r.base))) <= (field.baseTouchRadiusMeters ?? 0.28)) lo = mid;
              else hi = mid;
            }
            leg.departure = { base: r.base, elapsedSeconds: leg.from + hi };
          }
          runnerTouches.push({ kind: "runner_base_touch", runnerId: r.spec.runnerId, base: touch.base, tick: tick8(time) });
          emit("runner_base_touch", time, { runnerId: r.spec.runnerId, base: touch.base, position: r.p });
          if (deriveCurrentForceObligations(force).some((o) => o.runnerId === r.spec.runnerId && o.targetBase === touch.base))
            force = satisfyForceParticipantObligation(force, r.spec.runnerId);
          runnerDecisionPending = true;
          controlThrough = time;
        } else if (e.kind === "runner_stop") {
          const r = e.runner;
          r.p = runnerAt(r, time);
          r.leg = null;
          runnerDecisionPending = true;
          controlThrough = time;
        } else if (e.kind === "runner_departure") {
          const r = e.runner, departure = r.leg.departure;
          r.leg.departure = null;
          physicalBaseDepartures.set(r.spec.runnerId, { ...departure, tick: tick8(time) });
          runnerDepartures.push({ kind: "runner_base_departure", runnerId: r.spec.runnerId, base: departure.base, tick: tick8(time) });
          emit("runner_base_departure", time, { runnerId: r.spec.runnerId, base: departure.base });
        } else if (e.kind === "base") applyBaseControl(e.f, e.base, time);
        else if (e.kind === "tag") {
          const r = e.runner;
          const departure = physicalBaseDepartures.get(r.spec.runnerId), position = runnerAt(r, time), velocity = runnerVelocityAt(r, time), radial = departure ? flat(sub8(position, base(departure.base))) : v(), protectionEndedByDeparture = departure && departure.base === r.base && departure.tick === tick8(time) && departure.elapsedSeconds <= time && !deriveCurrentForceObligations(force).some((o) => o.runnerId === r.spec.runnerId) && norm6(radial) > (field.baseTouchRadiusMeters ?? 0.28) && radial.x * velocity.x + radial.z * velocity.z > 0 && distance5(at(e.f.glove, time), add15(position, v(0, 0.9, 0))) <= 0.28 ? { base: departure.base, tick: departure.tick } : void 0;
          controlledRunnerTags.push({
            kind: "controlled_runner_tag",
            defenderId: e.f.spec.playerId,
            runnerId: r.spec.runnerId,
            tick: tick8(time),
            ...protectionEndedByDeparture ? { protectionEndedByDeparture } : {}
          });
          emit("controlled_runner_tag", time, { playerId: e.f.spec.playerId, runnerId: r.spec.runnerId });
          retire(r, time);
        } else if (e.kind === "fence") {
          const b = kernel.evaluateAt(time, "incoming").moment.ball, geometricFair = isFair(b.position), fair = territoryFixed ? territory === "fair" : geometricFair, untouchedGround = !hasThrown && firstGroundContactTick === null;
          if (b.position.y - input.physics.ground.radiusM > field.fenceHeightMeters || !fair) {
            overFence = {
              tick: tick8(time),
              fair,
              untouchedGround,
              cause: hasThrown ? "throw" : "batted",
              ...hasThrown ? { awardFrom: lastThrowBases } : {}
            };
            determineTerritory(time, fair ? "fair" : "foul");
            emit("over_fence", time, { position: b.position });
            dead = true;
            if (!fair) {
              terminal = true;
              endReason = "foul_dead_ball";
            }
          } else {
            const normal4 = mul5(flat(sub8(fenceCenter, b.position)), 1 / distance5(flat(b.position), flat(fenceCenter)));
            let outgoing = respondToBallContact({ ball: b, normal: normal4, surfaceVelocity: v(), material: LIVE_FIELD_TEST_MODEL_V1.wallMaterial });
            orientationBasis = multiplyQuaternions(kernel.evaluateAt(time, "incoming").orientation, orientationBasis);
            const normalVelocity = outgoing.velocity.x * normal4.x + outgoing.velocity.z * normal4.z;
            const isGrounded = b.position.y === input.physics.ground.radiusM && b.velocity.y === 0;
            const elasticNormalEnergy = 0.5 * input.physics.air.aerodynamics.ballMassKg * normalVelocity ** 2;
            const remainingNormalEnergy = Math.max(0, elasticNormalEnergy - LIVE_FIELD_TEST_MODEL_V1.wallMaterial.groundNormalHysteresisLossJ);
            if (isGrounded && remainingNormalEnergy === 0) {
              const radial = flat(sub8(b.position, fenceCenter)), r = norm6(radial), tangent = v(radial.z / r, 0, -radial.x / r), speed2 = outgoing.velocity.x * tangent.x + outgoing.velocity.z * tangent.z;
              outgoing = { ...outgoing, velocity: mul5(tangent, speed2) };
              const constrained = createGroundWallRollingCurveV1({
                initial: { originTick, elapsedSeconds: time, ball: outgoing },
                throughElapsedSeconds: max,
                profile: input.physics,
                fenceCenter,
                nominalContactRadiusMeters: fenceRadius - input.physics.ground.radiusM,
                maximumCompressionMeters: LIVE_FIELD_TEST_MODEL_V1.wallMaterial.maximumCompressionMeters
              });
              kernel = constrained;
              wallKernelBuilds++;
              wallContact = constrained.support;
              wallSupports.push(constrained.support);
              freeScope = null;
              emit("wall_support", time, { position: b.position, reason: "normal_rebound_energy_dissipated_by_explicit_ground_wall_material" });
              fenceEscape = null;
            } else {
              if (isGrounded) outgoing = { ...outgoing, velocity: add15(
                outgoing.velocity,
                mul5(normal4, Math.sqrt(2 * remainingNormalEnergy / input.physics.air.aerodynamics.ballMassKg) - normalVelocity)
              ) };
              const moment = { originTick, elapsedSeconds: time, ball: outgoing };
              kernel = build(moment);
              wallContact = null;
              fenceEscape = { from: time, radius: fenceRadius - input.physics.ground.radiusM, outgoing: moment, witness: e.hit };
            }
            side = "outgoing";
          }
        }
      }
      if (releaseOpen && time >= releaseOpen.catchEnabledAfter) releaseOpen = null;
      if (retiredCount + input.outs >= 3) {
        endReason = "third_out";
        terminal = true;
      }
      const runnersComplete = runners.every((r) => r.retired || !r.leg && (r.scored || r.base > 0 || !!flyCatch));
      if (overFence?.fair && overFence.untouchedGround && runners.every((r) => r.retired || r.scored && !r.leg)) {
        endReason = "home_run_completed";
        terminal = true;
      }
      const awardedFence = overFence;
      if (awardedFence?.fair && !awardedFence.untouchedGround && runners.every((r) => r.retired || !r.leg && r.base >= Math.min(4, (awardedFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + 2))) {
        endReason = "ground_rule_award_completed";
        terminal = true;
      }
      if (!dead && possession && runnersComplete && !runnerDecisionPending && time - custodySince >= Math.max(0.6, possession.spec.transferSeconds) && (releaseAt === null || outTargets().length === 0)) {
        endReason = "live_action_complete";
        terminal = true;
      }
      if (time === horizon && !e && horizon === max) break;
    }
    sampleFrame(time);
    const complete = ["third_out", "foul_dead_ball", "home_run_completed", "ground_rule_award_completed", "live_action_complete"].includes(endReason), playEnd = { kind: "play_end", tick: tick8(time), reason: dead ? "dead_ball" : "live_action_complete" };
    emit("play_end", time, { reason: endReason });
    const ruleFacts = {
      contactTick: input.ball.ball.tick,
      throughTick: tick8(time),
      territory,
      firstGroundContactTick,
      flyCatch,
      runnerTouches,
      controlledBaseContacts,
      controlledRunnerTags,
      runnerDepartures,
      overFence,
      playEnd
    };
    return freeze19({
      version: "live_field_play_v1",
      modelBasis: LIVE_FIELD_TEST_MODEL_V1.basis,
      model: LIVE_FIELD_TEST_MODEL_V1,
      fieldGeometry,
      frames,
      facts,
      ruleFacts,
      end: { elapsedSeconds: time, tick: tick8(time), reason: endReason, complete },
      finalRunners: runners.map((r) => ({ runnerId: r.spec.runnerId, base: r.base, position: runnerAt(r, time), retired: r.retired, scored: r.scored })),
      diagnostics: {
        kernelBuilds,
        kernelExtensions,
        wallKernelBuilds,
        wallSupports,
        simultaneousContacts,
        throwDecisions,
        throwDirectionCommands,
        handPreparationProofs,
        forecastBuilds,
        collisionQueries,
        unresolvedDetail,
        departureProofs,
        playClosure: {
          lastRunnerEvaluationSeconds,
          runnerDecisionPending,
          activeRunnerIds: runners.filter((r) => !r.retired && r.leg).map((r) => r.spec.runnerId),
          possessedBy: possession?.spec.playerId ?? null,
          pendingCatchBy: pendingCatch?.fielder.spec.playerId ?? null,
          scheduledReleaseSeconds: releaseAt
        },
        aiTelemetry: { roleTransitions, throwTargetCancellations, contactDiagnostics, holderDecisions, runnerDecisions, relayPlans, runnerMotions },
        renderFramesOwnPhysics: false,
        namedLeagueCalibration: false,
        nativeActuation: false
      }
    });
  }

  // src/core/rules/FlyCatchRule.ts
  var validateOptionalTick = (name, tick8) => {
    if (tick8 !== null && (!Number.isSafeInteger(tick8) || tick8 < 0)) {
      throw new Error(`${name} must be null or a non-negative safe integer tick`);
    }
  };
  var resolveFlyCatch = (input) => {
    if (input.batterRunnerId.length === 0) {
      throw new Error("batterRunnerId must not be empty");
    }
    validateOptionalTick("secureCatchTick", input.secureCatchTick);
    validateOptionalTick(
      "firstGroundContactTick",
      input.firstGroundContactTick
    );
    if (input.secureCatchTick !== null && input.secureCatchTick < input.firstTouch.tick) {
      throw new Error(
        "secureCatchTick must be at or after first fielder touch"
      );
    }
    if (input.secureCatchTick === null) {
      return {
        kind: "unresolved",
        batterRunnerId: input.batterRunnerId,
        firstFielderTouchTick: input.firstTouch.tick
      };
    }
    if (input.firstGroundContactTick !== null && input.firstGroundContactTick <= input.secureCatchTick) {
      return {
        kind: "not_caught",
        batterRunnerId: input.batterRunnerId,
        firstFielderTouchTick: input.firstTouch.tick,
        firstGroundContactTick: input.firstGroundContactTick,
        secureCatchTick: input.secureCatchTick
      };
    }
    return {
      kind: "caught",
      batterRunnerId: input.batterRunnerId,
      firstFielderTouchTick: input.firstTouch.tick,
      outTick: input.secureCatchTick,
      secureCatchTick: input.secureCatchTick
    };
  };

  // src/core/rules/ThirdOutScoring.ts
  var validateTick6 = (tick8) => {
    if (!Number.isSafeInteger(tick8) || tick8 < 0) {
      throw new Error("third-out candidate tick must be a non-negative safe integer");
    }
  };
  var resolveThirdOutScoring = (input) => {
    if (!Number.isInteger(input.outsAtStart) || input.outsAtStart < 0 || input.outsAtStart > 2) {
      throw new Error("outsAtStart must be an integer from 0 through 2");
    }
    validateTick6(input.thirdOutCandidate.outTick);
    for (const touch of input.homeTouches) {
      if (touch.base !== 4) {
        throw new Error("third-out scoring requires base-4 home touch facts");
      }
    }
    if (input.outsAtStart !== 2) {
      return {
        kind: "not_third_out",
        createsThirdOut: false
      };
    }
    if (input.thirdOutCandidate.classification === "force" || input.thirdOutCandidate.classification === "batter_runner_before_first") {
      return {
        kind: "resolved",
        createsThirdOut: true,
        thirdOutTick: input.thirdOutCandidate.outTick,
        classification: input.thirdOutCandidate.classification,
        scored: [],
        suppressed: [...input.homeTouches],
        simultaneous: []
      };
    }
    const scored = [];
    const suppressed = [];
    const simultaneous = [];
    for (const touch of input.homeTouches) {
      if (touch.tick < input.thirdOutCandidate.outTick) {
        scored.push(touch);
      } else if (touch.tick > input.thirdOutCandidate.outTick) {
        suppressed.push(touch);
      } else {
        simultaneous.push(touch);
      }
    }
    if (simultaneous.length > 0) {
      return {
        kind: "simultaneous_unresolved",
        createsThirdOut: true,
        thirdOutTick: input.thirdOutCandidate.outTick,
        classification: "time_play",
        scored,
        suppressed,
        simultaneous
      };
    }
    return {
      kind: "resolved",
      createsThirdOut: true,
      thirdOutTick: input.thirdOutCandidate.outTick,
      classification: "time_play",
      scored,
      suppressed,
      simultaneous
    };
  };

  // src/core/rules/PlayRunFinalization.ts
  var finalizePendingRunsAtPlayEnd = (pendingHomeTouches, playEnd) => {
    for (const touch of pendingHomeTouches) {
      if (touch.base !== 4) {
        throw new Error(
          "pending run finalization requires base-4 home touch facts"
        );
      }
      if (touch.tick > playEnd.tick) {
        throw new Error(
          "pending home touch cannot occur after the authoritative play end"
        );
      }
    }
    return {
      finalizedAt: playEnd.tick,
      playEnd,
      scored: [...pendingHomeTouches]
    };
  };

  // src/integration/browser/PlayableMatchRulesV1.ts
  var names = ["first", "second", "third"];
  var tick7 = (n) => Number.isSafeInteger(n) && n >= 0;
  var id5 = (s) => typeof s === "string" && s.length > 0 && s === s.trim();
  function assert10(v2, message) {
    if (!v2) throw new Error("playable match rules: " + message);
  }
  var unresolved = (reason, time) => ({ kind: "unresolved", reason, tick: time });
  function validateMatch(m, batter) {
    assert10(id5(m.ruleProfileId) && Number.isSafeInteger(m.inning) && m.inning >= 1 && ["top", "bottom"].includes(m.half) && Number.isInteger(m.outs) && m.outs >= 0 && m.outs <= 2 && Number.isSafeInteger(m.playId) && m.playId >= 0, "invalid active canonical match");
    resolvePitchCountRule(m, { kind: "ball_in_play" });
    assert10([m.score.away, m.score.home].every((n) => Number.isSafeInteger(n) && n >= 0), "invalid score");
    const runners = names.map((n) => m.bases[n]).filter((r) => r !== null);
    assert10(id5(batter) && runners.every(id5) && !runners.includes(batter) && new Set(runners).size === runners.length, "invalid original runner identities");
  }
  function finish(input, after, batterAdvanced, classification, scored, suppressed, outcomes, endedAtTick) {
    const regulation = input.regulationInnings ?? 9, batting = input.match.half === "top" ? "away" : "home";
    let scoredFinal = [...scored], outsFinal = [...outcomes], end = endedAtTick;
    const walkoff = input.match.half === "bottom" && input.match.inning >= regulation && input.match.score.home + scored.length > input.match.score.away;
    if (walkoff && classification !== "home_run") {
      const needed = input.match.score.away - input.match.score.home + 1;
      scoredFinal = scoredFinal.slice(0, Math.max(0, needed));
      if (scoredFinal.length) {
        end = scoredFinal.at(-1).tick;
        if (input.event.kind === "field_play") {
          const first = input.event.facts.runnerTouches.find((t) => t.runnerId === input.batterRunnerId && t.base === 1);
          if (first) end = Math.max(end, first.tick);
        }
        outsFinal = outsFinal.filter((o) => o.tick <= end);
      }
    }
    const score = { ...input.match.score, [batting]: input.match.score[batting] + scoredFinal.length };
    let match = {
      ...after,
      score,
      outs: input.match.outs + outsFinal.length,
      balls: batterAdvanced ? 0 : after.balls,
      strikes: batterAdvanced ? 0 : after.strikes,
      playId: input.match.playId + (batterAdvanced ? 1 : 0)
    };
    const homeWins = match.inning >= regulation && (match.half === "bottom" && score.home > score.away || match.half === "top" && match.outs === 3 && score.home > score.away);
    const awayWins = match.inning >= regulation && match.half === "bottom" && match.outs === 3 && score.away > score.home;
    const gameOver = homeWins || awayWins;
    let halfChanged = false;
    if (!gameOver) {
      const transition = resolveHalfInningTransition({ inning: match.inning, half: match.half, outsAfterPlay: match.outs });
      if (transition.kind === "half_inning_ended") {
        halfChanged = true;
        match = { ...match, inning: transition.nextInning, half: transition.nextHalf, ...transition.reset };
      }
    }
    return {
      kind: "applied",
      match,
      batterAdvanced,
      halfChanged,
      gameOver,
      winner: homeWins ? "home" : awayWins ? "away" : null,
      scoredRunnerIds: scoredFinal.map((t) => t.runnerId),
      suppressedRunnerIds: [...suppressed, ...scored.filter((t) => !scoredFinal.includes(t))].map((t) => t.runnerId),
      outcomes: outsFinal,
      endedAtTick: end,
      classification
    };
  }
  function applyCount(input, call, time) {
    const m = input.match, r = resolvePitchCountRule(m, { kind: call });
    if (r.kind === "continue") return finish(input, { ...m, ...r.count }, false, call === "foul" ? "foul" : "count", [], [], [], time);
    if (r.kind === "walk") {
      const a = resolveWalkForcedAdvancement({ batterRunnerId: input.batterRunnerId, bases: m.bases });
      return finish(input, { ...m, bases: a.bases }, true, "walk", a.scoredRunnerIds.map((runnerId) => ({ kind: "runner_base_touch", runnerId, base: 4, tick: time })), [], [], time);
    }
    assert10(r.kind === "strikeout", "count adjudication did not resolve");
    return finish(input, m, true, "strikeout", [], [], [{ runnerId: input.batterRunnerId, tick: time, classification: "batter_runner_before_first", cause: "pitch_count", defenderId: null }], time);
  }
  function reducePlayableMatchV1(raw) {
    const input = cloneInert(raw), m = input.match, batter = input.batterRunnerId, regulation = input.regulationInnings ?? 9;
    validateMatch(m, batter);
    assert10(Number.isSafeInteger(regulation) && regulation >= 1, "invalid regulation innings");
    if (input.event.kind === "pitch_call") {
      assert10(tick7(input.event.tick), "invalid pitch call tick");
      return applyCount(input, input.event.call, input.event.tick);
    }
    const f = input.event.facts;
    assert10(tick7(f.contactTick) && tick7(f.throughTick) && f.throughTick >= f.contactTick && f.playEnd.kind === "play_end" && tick7(f.playEnd.tick) && f.playEnd.tick >= f.contactTick && f.playEnd.tick <= f.throughTick && ["fair", "foul"].includes(f.territory), "invalid physical play interval or territory");
    const validTime = (t) => tick7(t) && t >= f.contactTick && t <= f.throughTick;
    if (f.firstGroundContactTick !== void 0 && f.firstGroundContactTick !== null) assert10(validTime(f.firstGroundContactTick), "invalid ground contact tick");
    const caught = f.flyCatch ? resolveFlyCatch({
      batterRunnerId: batter,
      firstTouch: { kind: "fly_ball_first_fielder_touch", fielderId: f.flyCatch.fielderId, tick: f.flyCatch.firstTouchTick },
      secureCatchTick: f.flyCatch.secureCatchTick,
      firstGroundContactTick: f.firstGroundContactTick ?? null
    }) : null;
    if (f.flyCatch) assert10(id5(f.flyCatch.fielderId) && validTime(f.flyCatch.firstTouchTick) && validTime(f.flyCatch.secureCatchTick), "invalid catch facts");
    const foul = resolveFoulBallRule({ territory: f.territory, buntAttempt: f.buntAttempt ?? false, count: m, flyCatch: caught });
    if (foul.kind === "uncaught_foul") return applyCount(input, f.buntAttempt ? "foul_bunt" : "foul", f.playEnd.tick);
    if (foul.kind === "unresolved_foul_fly") return unresolved("unresolved_foul_catch", foul.firstFielderTouchTick);
    if (f.overFence) assert10(validTime(f.overFence.tick) && typeof f.overFence.fair === "boolean" && typeof f.overFence.untouchedGround === "boolean", "invalid fence fact");
    const homeRun = !!f.overFence && f.overFence.fair && f.overFence.untouchedGround && f.territory === "fair" && (f.firstGroundContactTick === void 0 || f.firstGroundContactTick === null || f.firstGroundContactTick > f.overFence.tick);
    const groundRuleAward = !!f.overFence && f.overFence.fair && !f.overFence.untouchedGround && f.territory === "fair" && (f.overFence.cause === "throw" || f.firstGroundContactTick !== void 0 && f.firstGroundContactTick !== null && f.firstGroundContactTick <= f.overFence.tick);
    if (f.overFence && !homeRun && !groundRuleAward) return unresolved("ground_rule_award_requires_out_of_play_geometry", f.overFence.tick);
    let force = createInitialForceObligationState(m.bases, batter);
    const runners = force.participants.map((p) => p.runnerId), atBase = /* @__PURE__ */ new Map(), progress = /* @__PURE__ */ new Map();
    for (const p of force.participants) {
      atBase.set(p.runnerId, p.startBase === 0 ? null : p.startBase);
      progress.set(p.runnerId, p.startBase);
    }
    const retired = /* @__PURE__ */ new Set(), homes = [], outcomes = [];
    const events = [
      ...f.runnerTouches,
      ...f.runnerDepartures,
      ...f.controlledBaseContacts,
      ...f.controlledRunnerTags,
      ...caught?.kind === "caught" ? [{ kind: "fly_catch", tick: caught.outTick, defenderId: f.flyCatch.fielderId }] : []
    ];
    for (const e of events) {
      assert10(validTime(e.tick), "fact outside physical play interval");
      if ("runnerId" in e) assert10(runners.includes(e.runnerId), "unknown physical runner");
      if ("base" in e) assert10([1, 2, 3, 4].includes(e.base), "invalid physical base");
      if ("defenderId" in e) assert10(id5(e.defenderId), "invalid physical defender");
      if (e.kind === "controlled_runner_tag" && e.protectionEndedByDeparture) {
        const proof = e.protectionEndedByDeparture;
        assert10([1, 2, 3, 4].includes(proof.base) && validTime(proof.tick) && proof.tick === e.tick, "invalid tag departure evidence");
      }
    }
    const retire = (runnerId, time, classification2, cause, defenderId) => {
      if (retired.has(runnerId) || m.outs + outcomes.length >= 3) return;
      retired.add(runnerId);
      atBase.set(runnerId, null);
      force = retireForceParticipant(force, runnerId);
      outcomes.push({ runnerId, tick: time, classification: classification2, cause, defenderId });
    };
    events.sort((a, b) => a.tick - b.tick);
    for (let offset = 0; offset < events.length; ) {
      const time = events[offset].tick, group = [];
      while (offset < events.length && events[offset].tick === time) group.push(events[offset++]);
      if (time > f.playEnd.tick || m.outs + outcomes.length >= 3) break;
      const forceTargets = deriveCurrentForceObligations(force).filter((o) => group.some((e) => e.kind === "controlled_base_contact" && e.base === o.targetBase));
      if (forceTargets.length > 1) return unresolved("simultaneous_multiple_force_plays", time);
      for (const control of group.filter((e) => e.kind === "controlled_base_contact")) {
        const obligation = deriveCurrentForceObligations(force).find((o) => o.targetBase === control.base);
        if (obligation && group.some((e) => e.kind === "runner_base_touch" && e.runnerId === obligation.runnerId && e.base === control.base)) return unresolved("simultaneous_force_arrival", time);
      }
      for (const tag of group.filter((e) => e.kind === "controlled_runner_tag")) {
        if (group.some((e) => e.kind === "runner_base_touch" && e.runnerId === tag.runnerId)) return unresolved("simultaneous_tag_arrival_or_departure", time);
        const departures = group.filter((e) => e.kind === "runner_base_departure" && e.runnerId === tag.runnerId), proof = tag.protectionEndedByDeparture, bound = !!proof && departures.length === 1 && departures[0].base === proof.base && departures[0].tick === proof.tick && atBase.get(tag.runnerId) === proof.base && !deriveCurrentForceObligations(force).some((o) => o.runnerId === tag.runnerId);
        if (proof && !bound) return unresolved("unbound_tag_departure_evidence", time);
        if (departures.length && !bound) return unresolved("simultaneous_tag_arrival_or_departure", time);
      }
      for (const e of group.filter((e2) => e2.kind === "fly_catch")) retire(batter, time, "batter_runner_before_first", "fly_catch", e.defenderId);
      for (const e of group.filter((a) => a.kind === "runner_base_departure")) {
        if (!retired.has(e.runnerId) && atBase.get(e.runnerId) === e.base) atBase.set(e.runnerId, null);
      }
      for (const e of group.filter((a) => a.kind === "runner_base_touch")) {
        if (retired.has(e.runnerId)) continue;
        const prior = progress.get(e.runnerId);
        if (Math.abs(e.base - prior) > 1) return unresolved("missing_sequential_base_touch", time);
        progress.set(e.runnerId, e.base);
        atBase.set(e.runnerId, e.base);
        const obligation = deriveCurrentForceObligations(force).find((o) => o.runnerId === e.runnerId && o.targetBase === e.base);
        if (obligation) force = satisfyForceParticipantObligation(force, e.runnerId);
        if (e.base === 4 && !homes.some((h) => h.runnerId === e.runnerId)) homes.push(e);
      }
      for (const e of group.filter((a) => a.kind === "controlled_base_contact")) {
        const obligation = deriveCurrentForceObligations(force).find((o) => o.targetBase === e.base);
        if (obligation) retire(obligation.runnerId, time, obligation.classification, "base_control", e.defenderId);
      }
      for (const e of group.filter((a) => a.kind === "controlled_runner_tag")) {
        if (retired.has(e.runnerId)) continue;
        const obligation = deriveCurrentForceObligations(force).find((o) => o.runnerId === e.runnerId), protectedBase = atBase.get(e.runnerId);
        if (protectedBase !== null && (!obligation || obligation.targetBase === protectedBase)) continue;
        retire(e.runnerId, time, obligation?.classification ?? "time_play", "runner_tag", e.defenderId);
      }
    }
    const third = m.outs + outcomes.length === 3 ? outcomes.at(-1) : null;
    let scored = homes, suppressed = [];
    if (third) {
      const r = resolveThirdOutScoring({ outsAtStart: 2, thirdOutCandidate: { runnerId: third.runnerId, outTick: third.tick, classification: third.classification }, homeTouches: homes });
      if (r.kind === "simultaneous_unresolved") return unresolved("simultaneous_third_out_run", third.tick);
      assert10(r.kind === "resolved", "third out was not resolved");
      scored = r.scored;
      suppressed = r.suppressed;
    } else finalizePendingRunsAtPlayEnd(homes, f.playEnd);
    const bases = { first: null, second: null, third: null };
    if (!third) for (const runner of runners) {
      if (retired.has(runner) || homes.some((h) => h.runnerId === runner)) continue;
      const base = atBase.get(runner);
      if (base === null || base === void 0 || base === 4) return unresolved("live_runner_stopped_between_bases", f.playEnd.tick);
      if (bases[names[base - 1]] !== null) return unresolved("conflicting_base_entitlement", f.playEnd.tick);
      bases[names[base - 1]] = runner;
    }
    if (homeRun && !third && runners.some((r) => !retired.has(r) && !homes.some((h) => h.runnerId === r))) return unresolved("home_run_circuits_incomplete", f.playEnd.tick);
    if (groundRuleAward && !third && force.participants.some((p) => !retired.has(p.runnerId) && progress.get(p.runnerId) < Math.min(4, (f.overFence?.awardFrom?.[p.runnerId] ?? p.startBase) + 2)))
      return unresolved("ground_rule_award_touches_incomplete", f.playEnd.tick);
    const classification = homeRun ? "home_run" : groundRuleAward ? "ground_rule_double" : caught?.kind === "caught" ? f.territory === "foul" ? "foul_out" : "fly_out" : "live_ball";
    return finish(input, { ...m, bases }, true, classification, scored, suppressed, outcomes, third?.tick ?? f.playEnd.tick);
  }

  // src/core/sim/contact/WoodBatSpeedResponseProfile.ts
  var HIRONO_2025_WOOD_BAT_SPEED_RESPONSE_EVIDENCE = Object.freeze({
    source: "Hirono, Murata & Nakamura 2025, Journal of the Society of Materials Science, Japan 74(9):582-587",
    testedImpactSpeedComparisonKph: Object.freeze([
      120,
      180
    ]),
    finding: "BBCOR generally decreased as impact velocity increased, but the rate of decrease differed by wooden bat; some tested bats did not decrease monotonically through 180 km/h.",
    implication: "Wood-bat speed response must remain bat/profile-specific; a universal v^(-1/6) wooden-bat law is not justified by this evidence."
  });
  var lerp2 = (a, b, t) => a + (b - a) * t;
  var validateWoodBatSpeedResponseProfile = (profile) => {
    if (profile.profileId.length === 0 || profile.version.length === 0) {
      throw new Error(
        "wood-bat speed response profile id/version must not be empty"
      );
    }
    if (profile.normalRestitutionKnots.length < 2) {
      throw new Error(
        "wood-bat speed response requires at least two same-profile speed knots"
      );
    }
    if (profile.evidenceIds.length === 0 || profile.evidenceIds.some(
      (id6) => id6.length === 0
    )) {
      throw new Error(
        "wood-bat speed response requires explicit evidence ids"
      );
    }
    if (!Number.isFinite(
      profile.tangentialRestitution
    ) || profile.tangentialRestitution < 0 || profile.tangentialRestitution > 1 || !Number.isFinite(
      profile.frictionCoefficient
    ) || profile.frictionCoefficient < 0) {
      throw new Error(
        "wood-bat tangential restitution must be within [0,1] and friction non-negative"
      );
    }
    let previousSpeed = -Infinity;
    for (const knot of profile.normalRestitutionKnots) {
      if (!Number.isFinite(
        knot.relativeImpactSpeedMps
      ) || knot.relativeImpactSpeedMps <= 0 || knot.relativeImpactSpeedMps <= previousSpeed || !Number.isFinite(
        knot.normalRestitution
      ) || knot.normalRestitution < 0 || knot.normalRestitution > 1) {
        throw new Error(
          "wood-bat restitution knots must use strictly increasing positive speed and restitution within [0,1]"
        );
      }
      previousSpeed = knot.relativeImpactSpeedMps;
    }
  };
  var resolveWoodBatSpeedResponse = (profile, relativeImpactSpeedMps) => {
    validateWoodBatSpeedResponseProfile(
      profile
    );
    if (!Number.isFinite(
      relativeImpactSpeedMps
    ) || relativeImpactSpeedMps < 0) {
      throw new Error(
        "wood-bat impact speed must be finite and non-negative"
      );
    }
    const knots = profile.normalRestitutionKnots;
    const first = knots[0];
    const last = knots[knots.length - 1];
    let normalRestitution = first.normalRestitution;
    if (relativeImpactSpeedMps >= last.relativeImpactSpeedMps) {
      normalRestitution = last.normalRestitution;
    } else if (relativeImpactSpeedMps > first.relativeImpactSpeedMps) {
      for (let index = 1; index < knots.length; index += 1) {
        const right = knots[index];
        if (relativeImpactSpeedMps > right.relativeImpactSpeedMps) {
          continue;
        }
        const left = knots[index - 1];
        const t = (relativeImpactSpeedMps - left.relativeImpactSpeedMps) / (right.relativeImpactSpeedMps - left.relativeImpactSpeedMps);
        normalRestitution = lerp2(
          left.normalRestitution,
          right.normalRestitution,
          t
        );
        break;
      }
    }
    return {
      normalRestitution,
      tangentialRestitution: profile.tangentialRestitution,
      frictionCoefficient: profile.frictionCoefficient
    };
  };
  var resolveWoodBatSpeedProfileBallContact = (pitch, bat, ball, profile) => resolveRigidBatBallContactWithParameterResolver(
    pitch,
    bat,
    ball,
    (kinematics) => resolveWoodBatSpeedResponse(
      profile,
      kinematics.normalApproachSpeedMps
    )
  );

  // src/core/sim/contact/HighSpeedObliqueBatCalibration.ts
  var NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT = Object.freeze({
    normalRestitution: 0.52,
    tangentialRestitution: 0.3,
    frictionCoefficient: 0.15
  });
  var NATHAN_2012_OBLIQUE_WOOD_EVIDENCE = Object.freeze({
    maximumIncidentSpeedMph: 120,
    nonSlipNormalRestitution: 0.52,
    nonSlipTangentialRestitution: 0.3,
    tangentialRestitutionUncertainty: 0.02,
    grossSlipFrictionCoefficient: 0.15,
    grossSlipOnsetAngleDegreesApprox: 40,
    source: "Nathan et al. 2012, Spin of a batted baseball"
  });

  // src/core/sim/contact/WoodBatProductionProfileV1.ts
  var MPH_TO_MPS = 0.44704;
  var NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 = Object.freeze({
    profileId: "nathan-2012-rigid-wood-local-contact",
    version: "nathan-2012-47-impact-fit-v1",
    normalRestitutionKnots: Object.freeze([
      {
        relativeImpactSpeedMps: 85 * MPH_TO_MPS,
        normalRestitution: NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT.normalRestitution
      },
      {
        relativeImpactSpeedMps: 120 * MPH_TO_MPS,
        normalRestitution: NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT.normalRestitution
      }
    ]),
    tangentialRestitution: NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT.tangentialRestitution,
    frictionCoefficient: NATHAN_2012_HIGH_SPEED_OBLIQUE_WOOD_CONTACT.frictionCoefficient,
    evidenceIds: Object.freeze([
      "nathan-2012-spin-of-a-batted-baseball",
      "nathan-2012-rigid-three-inch-wood-cylinder-47-impact-fit"
    ])
  });
  var NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_SCOPE = Object.freeze({
    minimumDocumentedIncidentSpeedMph: 85,
    maximumDocumentedIncidentSpeedMph: NATHAN_2012_OBLIQUE_WOOD_EVIDENCE.maximumIncidentSpeedMph,
    fittedNonGrossSlipImpactCount: 47,
    fixture: "rigidly-mounted-three-inch-wood-cylinder",
    finiteBatDynamics: "handled-by-rigid-bat-ball-contact"
  });

  // src/core/sim/pitching/RulebookStrikeZone.ts
  var HOME_PLATE_WIDTH_METERS = 0.4318;
  var HEIGHT_RATIO_V1_TOP_FRACTION = 0.535;
  var HEIGHT_RATIO_V1_BOTTOM_FRACTION = 0.27;
  var validateFinite2 = (name, value) => {
    if (!Number.isFinite(value)) {
      throw new Error(`${name} must be finite`);
    }
  };
  var resolveHalfWidth = (homePlateWidthMeters) => {
    const width = homePlateWidthMeters ?? HOME_PLATE_WIDTH_METERS;
    if (!Number.isFinite(width) || width <= 0) {
      throw new Error(
        "homePlateWidthMeters must be finite and positive"
      );
    }
    return width / 2;
  };
  var resolveHeightRatioStrikeZoneRegion = (input) => {
    validateFinite2(
      "plateCenterX",
      input.plateCenterX
    );
    const heightMeters = input.playerPhysicalProfile.heightMeters;
    if (!Number.isFinite(heightMeters) || heightMeters <= 0) {
      throw new Error(
        "playerPhysicalProfile.heightMeters must be finite and positive"
      );
    }
    const topFraction = input.topFraction ?? HEIGHT_RATIO_V1_TOP_FRACTION;
    const bottomFraction = input.bottomFraction ?? HEIGHT_RATIO_V1_BOTTOM_FRACTION;
    if (!Number.isFinite(topFraction) || !Number.isFinite(bottomFraction) || topFraction <= bottomFraction || bottomFraction < 0) {
      throw new Error(
        "strike-zone height fractions must be finite with topFraction > bottomFraction >= 0"
      );
    }
    return {
      centerX: input.plateCenterX,
      halfWidth: resolveHalfWidth(
        input.homePlateWidthMeters
      ),
      lowerY: heightMeters * bottomFraction,
      upperY: heightMeters * topFraction
    };
  };

  // src/integration/browser/MeasuredBatFieldRegistrationV1.ts
  var MEASURED_BAT_FIELD_REGISTRATION_V1 = Object.freeze({
    authority: "OBP_ORIGINAL_LAB_TO_FIRST_BASE_POSITIVE_X_FIELD_V1",
    rawMeasuredArtifactUnchanged: true,
    storedPositionToField: "(-x,y,z)",
    originalLabPositionToField: "(-labY,labZ,labX)",
    quaternionToField: "(w,x,-y,-z)",
    linearVelocityToField: "(-vx,vy,vz)",
    angularVelocityToField: "(wx,-wy,-wz); axial vector det(M)*M",
    rightHandedBox: "THIRD_BASE_NEGATIVE_X",
    leftHandedBox: "FIRST_BASE_POSITIVE_X"
  });
  function registerMeasuredBatToFieldV1(frames) {
    if (!Array.isArray(frames) || frames.length < 2 || frames.some((f) => !Number.isSafeInteger(f.tick) || f.tick < 0 || !f.grip || !f.orientation || !Object.values(f.grip).every(Number.isFinite) || !Object.values(f.orientation).every(Number.isFinite)))
      throw new Error("measured bat field registration requires finite original frames");
    return frames.map((f) => ({
      tick: f.tick,
      grip: { x: -f.grip.x, y: f.grip.y, z: f.grip.z },
      orientation: { w: f.orientation.w, x: f.orientation.x, y: -f.orientation.y, z: -f.orientation.z }
    }));
  }

  // src/integration/browser/LivePitchV1.ts
  var add16 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  var sub9 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  var mul6 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  var norm7 = (v2) => Math.hypot(v2.x, v2.y, v2.z);
  var clamp2 = (n, a, b) => Math.max(a, Math.min(b, n));
  var bounded = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
  function assert11(v2, message) {
    if (!v2) throw new Error("live pitch: " + message);
  }
  var zero4 = () => ({ x: 0, y: 0, z: 0 });
  var dot14 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var cross9 = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  function betweenDirections(from, to) {
    const a = mul6(from, 1 / norm7(from)), b = mul6(to, 1 / norm7(to)), d = clamp2(dot14(a, b), -1, 1);
    if (d < -1 + 1e-12) return quaternionFromAxisAngle(cross9(a, Math.abs(a.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }), Math.PI);
    const axis = cross9(a, b);
    return normalizeQuaternion({ w: 1 + d, x: axis.x, y: axis.y, z: axis.z });
  }
  var openBiomechanics = "https://github.com/drivelineresearch/openbiomechanics";
  function random(seed) {
    let s = seed >>> 0;
    const uniform = () => {
      s = s + 1831565813 >>> 0;
      let t = s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    return { uniform, normal: () => clamp2(Math.sqrt(-2 * Math.log(Math.max(1e-12, uniform()))) * Math.cos(2 * Math.PI * uniform()), -3, 3) };
  }
  function firstContact2(kernel, gap, colliderSpeed, through) {
    let budget = 2e5;
    const search = (lo, hi, speed2, rounding, depth = 0) => {
      assert11(--budget >= 0, "continuous collision proof budget exhausted");
      const a = gap(lo), b = gap(hi);
      assert11(Number.isFinite(a) && Number.isFinite(b), "nonfinite collision gap");
      if (a <= 0) return { kind: "hit", from: lo, at: lo };
      if (Math.min(a, b) > speed2 * (hi - lo) + rounding) return null;
      const mid = (lo + hi) / 2;
      if (depth === 60 || mid === lo || mid === hi || hi - lo <= 1e-15) return b <= 0 ? { kind: "hit", from: lo, at: hi } : { kind: "unresolved", from: lo, through: hi };
      const left = search(lo, mid, speed2, rounding, depth + 1);
      if (left?.kind === "hit" || left && mid - left.from > 1e-12) return left;
      const right = search(mid, hi, speed2, rounding, depth + 1);
      if (!left) return right;
      if (right?.kind === "hit" && right.at - left.from <= 1e-12) return { ...right, from: left.from };
      return right?.kind === "unresolved" ? { kind: "unresolved", from: left.from, through: right.through } : left;
    };
    for (const c of kernel.cells) {
      const lo = c.fromElapsedSeconds, hi = Math.min(through, c.throughElapsedSeconds);
      if (hi <= lo) continue;
      const r = search(lo, hi, c.maximumPositionSpeedMps + colliderSpeed, c.positionRoundingBoundMeters + 128 * Number.EPSILON);
      if (r) return r;
    }
    return null;
  }
  function crossing(kernel, planeZ) {
    for (const c of kernel.cells) {
      const a = kernel.evaluateAt(c.fromElapsedSeconds).moment.ball, b = kernel.evaluateAt(c.throughElapsedSeconds).moment.ball;
      if (a.position.z >= planeZ && b.position.z <= planeZ) {
        let lo = c.fromElapsedSeconds, hi = c.throughElapsedSeconds;
        for (let i = 0; i < 60 && hi - lo > 1e-12; i++) {
          const mid = (lo + hi) / 2;
          if (kernel.evaluateAt(mid).moment.ball.position.z <= planeZ) hi = mid;
          else lo = mid;
        }
        return hi;
      }
    }
    return null;
  }
  function simulateLivePitchV1(raw) {
    const input = cloneInert(raw), b = input.batter, p = input.pitcher, profile = createAeroGroundBallPhysicsProfile(input.physics), tps = profile.air.ticksPerSecond, catcher = input.catcher ?? { gloveSpeedMps: 7, gloveReachMeters: 0.95, gloveRadiusMeters: 0.14, retentionCapacityJ: 350, captureDissipationPowerW: 1e4, pocketRadiusMeters: 0.18 };
    assert11(Number.isSafeInteger(input.originTick) && input.originTick >= 0 && Number.isSafeInteger(input.seed) && tps === profile.ground.ticksPerSecond, "invalid original clock or seed");
    assert11(bounded(b.heightMeters, 1.1, 2.5) && ["R", "L"].includes(b.bats) && bounded(b.batLengthM, 0.55, 1.2) && bounded(b.batMassKg, 0.4, 1.8) && bounded(b.swingRate, 0.3, 3) && bounded(b.timingStdSeconds, 0, 0.08) && bounded(b.aimStdMeters, 0, 0.35) && bounded(b.chaseMarginMeters, 0, 0.6), "invalid batter SI controls");
    assert11(bounded(p.releaseSpeedMps, 15, 85) && bounded(p.commandStdMeters, 0, 0.6) && p.spinRadPerSecond && Object.values(p.spinRadPerSecond).every(Number.isFinite) && norm7(p.spinRadPerSecond) <= 1200, "invalid pitcher SI controls");
    assert11((p.maximumPitchSpeedMps === void 0 || bounded(p.maximumPitchSpeedMps, 15, 85)) && (p.throws === void 0 || ["R", "L"].includes(p.throws)), "invalid pitcher limit or throwing side");
    for (const [key3, lo, hi] of [
      ["maximumSweetSpotSpeedMps", 0.1, 90],
      ["targetSweetSpotSpeedMps", 0.1, 90],
      ["motorLatencySeconds", 0, 2],
      ["technicalTimingOffsetSeconds", -0.5, 0.5],
      ["sweetSpotT", 0.65, 0.9],
      ["attackAngleDegrees", -80, 80],
      ["pullAngleDegrees", -80, 80],
      ["badBallControl", 0, 1],
      ["preContactSeconds", 5e-3, 2],
      ["followThroughSeconds", 5e-3, 2],
      ["contactDepthMeters", 1e-3, 2],
      ["zoneJudgmentStdMeters", 0, 0.6]
    ])
      assert11(b[key3] === void 0 || bounded(b[key3], lo, hi), "invalid authored batter control: " + key3);
    if (b.swingDecision) assert11(["AUTO", "TAKE", "SWING"].includes(b.swingDecision.approach) && bounded(b.swingDecision.threshold, 0, 1) && bounded(b.swingDecision.aggressionWeight, 0, 1), "invalid authored swing decision");
    assert11(bounded(catcher.gloveSpeedMps, 0.1, 40) && bounded(catcher.gloveReachMeters, 0.4, 3) && bounded(catcher.gloveRadiusMeters, 0.03, 0.3) && bounded(catcher.retentionCapacityJ, 1, 2e3) && bounded(catcher.captureDissipationPowerW, 10, 1e6) && bounded(catcher.pocketRadiusMeters, 0.02, 1), "invalid catcher SI controls");
    assert11(["balanced", "contact", "power", "take", "bunt"].includes(input.batting), "invalid batting command");
    const r = random(input.seed), clips = input.measuredClips.filter((c) => c.side === b.bats && (!b.clipId || c.id === b.clipId));
    assert11(clips.length > 0, "a measured OpenBiomechanics clip for the actual batting side is required");
    const clip = clips[Math.floor(r.uniform() * clips.length)];
    assert11(clip.id.startsWith("obp-") && clip.source.repository === openBiomechanics && /^[a-f0-9]{64}$/.test(clip.source.sha256) && Number.isFinite(clip.contactTimeSeconds) && clip.frames.length >= 2, "unsupported measured clip provenance");
    const pitchType = input.pitchType === "auto" ? ["fastball", "slider", "curve", "changeup"][Math.floor(r.uniform() * 4)] : input.pitchType;
    assert11(["fastball", "slider", "curve", "changeup", "cutter", "sinker", "splitter"].includes(pitchType), "unsupported physical pitch type");
    const factor = { fastball: 1, slider: 0.91, curve: 0.8, changeup: 0.82, cutter: 0.95, sinker: 0.96, splitter: 0.89 }[pitchType], speed2 = Math.min(p.releaseSpeedMps, p.maximumPitchSpeedMps ?? Infinity) * factor * (0.98 + 0.02 * r.uniform()), spinMagnitude = norm7(p.spinRadPerSecond);
    const axes5 = {
      slider: { x: 0.25, y: -0.8, z: 0.55 },
      curve: { x: -1, y: 0, z: 0.1 },
      changeup: { x: 0.65, y: 0.2, z: 0.25 },
      cutter: { x: 0.7, y: -0.45, z: 0.25 },
      sinker: { x: 0.55, y: 0.5, z: 0.2 },
      splitter: { x: -0.15, y: 0.15, z: 0.3 }
    };
    const spin = pitchType === "fastball" ? p.spinRadPerSecond : mul6(axes5[pitchType], spinMagnitude * (pitchType === "changeup" ? 0.7 : 1) / norm7(axes5[pitchType]));
    const zone = resolveHeightRatioStrikeZoneRegion({ plateCenterX: 0, playerPhysicalProfile: { heightMeters: b.heightMeters } }), middle = (zone.lowerY + zone.upperY) / 2;
    const location = input.location === "auto" ? ["zone", "zone", "low", "outside", "inside"][Math.floor(r.uniform() * 5)] : input.location;
    assert11(["zone", "low", "outside", "inside", "high"].includes(location), "unsupported target location");
    const batterSide = b.bats === "R" ? -1 : 1, target = { x: (r.uniform() - 0.5) * 0.32, y: middle + (r.uniform() - 0.5) * (zone.upperY - zone.lowerY) * 0.7, z: 0.15 };
    if (location === "outside") target.x = -batterSide * (0.25 + r.uniform() * 0.25);
    if (location === "inside") target.x = batterSide * (0.19 + r.uniform() * 0.2);
    if (location === "low") target.y = zone.lowerY - 0.06 - r.uniform() * 0.16;
    if (location === "high") target.y = zone.upperY + 0.06 + r.uniform() * 0.16;
    const commanded = { ...target, x: target.x + r.normal() * p.commandStdMeters, y: target.y + r.normal() * p.commandStdMeters };
    const release = { x: p.throws === "L" ? -0.18 : 0.18, y: 1.83, z: 16.9 }, flightGuess = (release.z - commanded.z) / speed2;
    let vx = (commanded.x - release.x) / flightGuess, vy = (commanded.y - release.y - profile.air.gravityY * flightGuess * flightGuess / 2) / flightGuess, vz = -Math.sqrt(Math.max(speed2 * speed2 - vx * vx - vy * vy, speed2 * speed2 * 0.5)), flightTime = flightGuess;
    let initial = { tick: input.originTick, position: release, velocity: { x: vx, y: vy, z: vz }, spin };
    for (let i = 0; i < 3; i++) {
      const at2 = sampleAerodynamicPitchStateAtElapsedSeconds(initial, flightTime, profile.air);
      flightTime = clamp2(flightTime + (commanded.z - at2.position.z) / at2.velocity.z, 0.12, 1.6);
      vx += (commanded.x - at2.position.x) / flightTime;
      vy += (commanded.y - at2.position.y) / flightTime;
      const horizontal = Math.hypot(vx, vy);
      if (horizontal > speed2 * 0.65) {
        vx *= speed2 * 0.65 / horizontal;
        vy *= speed2 * 0.65 / horizontal;
      }
      vz = -Math.sqrt(speed2 * speed2 - vx * vx - vy * vy);
      initial = { ...initial, velocity: { x: vx, y: vy, z: vz } };
    }
    const horizon = Math.min(2.5, Math.max(0.8, flightTime + 0.4)), descriptor = {
      kind: "aero_ground_continuous_source_kernel_v2",
      initial: { originTick: input.originTick, elapsedSeconds: 0, ball: initial },
      throughElapsedSeconds: horizon,
      profile
    }, kernel = createSourceFreeBallKernel(descriptor), plateTime = crossing(kernel, 0.15), catchPlaneTime = crossing(kernel, -0.85);
    assert11(plateTime !== null && catchPlaneTime !== null, "pitched ball did not cross the finite plate/catcher planes");
    const decisionTime = Math.min(0.14, plateTime * 0.35), observed = kernel.evaluateAt(decisionTime).moment.ball;
    const predictAtPlane = (plane) => {
      let dt = Math.max(1e-3, (plane - observed.position.z) / observed.velocity.z), pred = observed;
      for (let i = 0; i < 3; i++) {
        pred = sampleAerodynamicPitchStateAtElapsedSeconds(observed, dt, profile.air);
        dt = clamp2(dt + (plane - pred.position.z) / pred.velocity.z, 1e-3, horizon - decisionTime);
      }
      return { elapsedSeconds: decisionTime + dt, ball: sampleAerodynamicPitchStateAtElapsedSeconds(observed, dt, profile.air) };
    };
    const prediction = predictAtPlane(b.contactDepthMeters ?? 0.15), controlFactor = input.batting === "power" ? 1.08 : input.batting === "contact" ? 0.92 : 1, timingError = r.normal() * b.timingStdSeconds * (input.batting === "contact" ? 0.72 : input.batting === "power" ? 1.15 : 1), awkwardness = Math.max(0, Math.abs(prediction.ball.position.x) / 0.2159 - 1, (0.55 - prediction.ball.position.y) / 0.5, (prediction.ball.position.y - 1.5) / 0.5), awkwardErrorFactor = b.badBallControl === void 0 ? 1 : 1 + awkwardness * (1 - b.badBallControl), aimScale = b.aimStdMeters * (input.batting === "contact" ? 0.7 : input.batting === "power" ? 1.1 : 1) * awkwardErrorFactor, aimError = { x: r.normal() * aimScale, y: r.normal() * aimScale, z: r.normal() * aimScale * 0.3 }, sweetSpotT = clamp2((b.sweetSpotT ?? (b.batLengthM - 0.1524) / b.batLengthM) + (r.uniform() - 0.5) * 0.025, 0.65, 0.9), heightScale = b.heightMeters / 1.8;
    const judgmentStd = b.zoneJudgmentStdMeters ?? 0, judgmentError = { x: 0, y: 0 };
    if (judgmentStd !== 0) {
      const judgmentRng = new SeedRoot(input.seed).streamRng(0, "batting", "zone-judgment-v1"), normal4 = () => Math.sqrt(-2 * Math.log(1 - judgmentRng.nextFloat())) * Math.cos(2 * Math.PI * judgmentRng.nextFloat());
      judgmentError.x = normal4() * judgmentStd;
      judgmentError.y = normal4() * judgmentStd;
    }
    const judgmentPosition = judgmentStd === 0 ? prediction.ball.position : {
      ...prediction.ball.position,
      x: prediction.ball.position.x + judgmentError.x,
      y: prediction.ball.position.y + judgmentError.y
    };
    const inChaseEnvelope = Math.abs(judgmentPosition.x) <= zone.halfWidth + b.chaseMarginMeters && judgmentPosition.y >= zone.lowerY - b.chaseMarginMeters && judgmentPosition.y <= zone.upperY + b.chaseMarginMeters, zoneMargin = Math.min(zone.halfWidth - Math.abs(judgmentPosition.x), judgmentPosition.y - zone.lowerY, zone.upperY - judgmentPosition.y), swingScore = clamp2(0.5 + zoneMargin / Math.max(0.1, zone.halfWidth) + (b.swingDecision ? (b.swingDecision.aggressionWeight - 0.5) * 0.2 : 0), 0, 1), swingOffered = input.batting !== "take" && (b.swingDecision ? b.swingDecision.approach === "SWING" || b.swingDecision.approach === "AUTO" && inChaseEnvelope && swingScore >= b.swingDecision.threshold : inChaseEnvelope);
    const desiredContactTime = Math.max(0.055, prediction.elapsedSeconds + timingError + (b.technicalTimingOffsetSeconds ?? 0)), sourceContactTick = clip.contactTimeSeconds * 1e6;
    const fullFrames = registerMeasuredBatToFieldV1(clip.frames).map((f) => ({ tick: f.tick, grip: mul6(f.grip, heightScale), orientation: f.orientation })), probeInput = {
      provenance: { clipId: clip.id, sourceSha256: clip.source.sha256 },
      frames: fullFrames,
      batLengthM: b.batLengthM,
      sweetSpotT,
      sourceTicksPerSecond: 1e6,
      startTick: input.originTick,
      ticksPerSecond: tps,
      playbackRate: 1,
      transform: { rotation: IDENTITY_QUATERNION, translation: zero4(), scale: 1 }
    }, probe = createReferenceBatKinematicsV1(probeInput), probeVelocity = probe.sampleAtSourceTick(sourceContactTick, "outgoing").sweetSpotVelocity;
    let rate = b.swingRate * controlFactor;
    if (b.targetSweetSpotSpeedMps !== void 0) {
      assert11(norm7(probeVelocity) > 1e-9, "measured reference has no finite contact speed");
      rate *= b.targetSweetSpotSpeedMps / norm7(probeVelocity);
    }
    if (b.maximumSweetSpotSpeedMps !== void 0) rate = Math.min(rate, b.maximumSweetSpotSpeedMps / probe.maximumSweetSpotSpeedMps);
    assert11(bounded(rate, 0.01, 20), "authored motor rate is outside this finite reference model");
    let authoredRotation = IDENTITY_QUATERNION;
    if (b.attackAngleDegrees !== void 0 || b.pullAngleDegrees !== void 0) {
      const side = b.bats === "R" ? 1 : -1, attack = b.attackAngleDegrees === void 0 ? Math.atan2(probeVelocity.y, Math.hypot(probeVelocity.x, probeVelocity.z)) : b.attackAngleDegrees * Math.PI / 180, pull = b.pullAngleDegrees === void 0 ? -Math.atan2(probeVelocity.x, probeVelocity.z) : b.pullAngleDegrees * side * Math.PI / 180;
      authoredRotation = betweenDirections(probeVelocity, { x: -Math.sin(pull) * Math.cos(attack), y: Math.sin(attack), z: Math.cos(pull) * Math.cos(attack) });
    }
    const minimumSourceTick = sourceContactTick - (b.preContactSeconds ?? Math.max(0, desiredContactTime - 0.045)) * rate * 1e6;
    let selectedFrames = fullFrames.filter((f) => f.tick >= minimumSourceTick);
    if (b.preContactSeconds !== void 0) {
      const previous = fullFrames.filter((f) => f.tick < minimumSourceTick).at(-1);
      if (previous) selectedFrames = [previous, ...selectedFrames];
    }
    if (b.followThroughSeconds !== void 0) {
      const maximumSourceTick = sourceContactTick + b.followThroughSeconds * rate * 1e6, last = selectedFrames.findIndex((f) => f.tick >= maximumSourceTick);
      if (last >= 0) selectedFrames = selectedFrames.slice(0, last + 1);
    }
    assert11(selectedFrames.length >= 2 && selectedFrames[0].tick < sourceContactTick && selectedFrames.at(-1).tick > sourceContactTick, "measured swing does not bracket contact reference");
    const startOffset = desiredContactTime - (sourceContactTick - selectedFrames[0].tick) / 1e6 / rate, plannedStartTick = input.originTick + Math.max(0, Math.round(startOffset * tps)), actualStartTick = b.motorLatencySeconds === void 0 ? plannedStartTick : Math.max(plannedStartTick, input.originTick + Math.ceil((decisionTime + b.motorLatencySeconds) * tps)), motorDelaySeconds = (actualStartTick - plannedStartTick) / tps, referenceInput = {
      provenance: { clipId: clip.id, sourceSha256: clip.source.sha256 },
      frames: selectedFrames,
      batLengthM: b.batLengthM,
      sweetSpotT,
      sourceTicksPerSecond: 1e6,
      startTick: actualStartTick,
      ticksPerSecond: tps,
      playbackRate: rate,
      transform: { rotation: authoredRotation, translation: zero4(), scale: 1 }
    };
    const referenceZero = createReferenceBatKinematicsV1(referenceInput), referenceContactTick = referenceInput.startTick + (sourceContactTick - selectedFrames[0].tick) / 1e6 / rate * tps, point = referenceZero.sampleContinuous(referenceContactTick).sweetSpot;
    const registeredReference = { ...referenceInput, transform: { ...referenceInput.transform, translation: sub9(add16(prediction.ball.position, aimError), point) } };
    const reference = createReferenceBatKinematicsV1(registeredReference), radiusProfile = { knots: [
      { t: 0, radiusM: 0.019 },
      { t: 0.06, radiusM: 0.014 },
      { t: 0.42, radiusM: 0.014 },
      { t: 0.7, radiusM: 0.03 },
      { t: 0.94, radiusM: 0.033 },
      { t: 1, radiusM: 0.031 }
    ] }, batPhysical = {
      massKg: b.batMassKg,
      centerOfMassT: 0.65,
      transverseMomentOfInertiaKgM2: b.batMassKg * b.batLengthM * b.batLengthM * 0.075,
      axialMomentOfInertiaKgM2: b.batMassKg * 0.025 * 0.025 / 2,
      radiusProfile
    }, ballPhysical = { massKg: profile.air.aerodynamics.ballMassKg, radiusM: profile.air.aerodynamics.ballRadiusM, rotationalInertiaFactor: profile.ground.inertiaRatio };
    const held = reference.sampleContinuous(input.batting === "bunt" ? referenceContactTick : input.originTick), batSample = (seconds) => swingOffered && input.batting !== "bunt" ? reference.sampleContinuous(input.originTick + seconds * tps) : { ...held, state: { ...held.state, linearVelocity: zero4(), angularVelocity: zero4() } };
    const rigidAt = (seconds) => createRigidBatStateFromBatterSwingState(batSample(seconds).state, batPhysical), batBound = swingOffered && input.batting !== "bunt" ? reference.maximumGripSpeedMps + reference.maximumAngularSpeedRadPerSecond * b.batLengthM : 0;
    const catcherForecast = createSourceFreeBallKernel({ ...descriptor, initial: kernel.evaluateAt(decisionTime).moment }), catcherForecastTime = crossing(catcherForecast, -0.85);
    assert11(catcherForecastTime !== null, "catcher forecast did not reach its finite plane");
    const catcherPrediction = { elapsedSeconds: catcherForecastTime, ball: catcherForecast.evaluateAt(catcherForecastTime).moment.ball }, catcherStart = { x: 0, y: middle, z: -0.85 }, body = { x: 0, y: 0.8, z: -1.2 }, reach = catcher.gloveReachMeters, catcherTarget = { x: catcherPrediction.ball.position.x, y: catcherPrediction.ball.position.y, z: -0.85 };
    catcherTarget.y = Math.max(catcher.gloveRadiusMeters, catcherTarget.y);
    const planarReach = Math.sqrt(reach * reach - (catcherTarget.z - body.z) ** 2), fromBody = { x: catcherTarget.x - body.x, y: catcherTarget.y - body.y, z: 0 };
    if (norm7(fromBody) > planarReach) {
      const constrained = add16(body, mul6(fromBody, planarReach / norm7(fromBody)));
      catcherTarget.x = constrained.x;
      catcherTarget.y = constrained.y;
    }
    const moveStart = decisionTime, moveEnd = Math.max(moveStart + 0.025, catcherPrediction.elapsedSeconds - 0.025), moveDuration = moveEnd - moveStart, delta = sub9(catcherTarget, catcherStart), distance6 = norm7(delta), maximumGloveSpeedMps = catcher.gloveSpeedMps;
    if (distance6 > maximumGloveSpeedMps * moveDuration / 1.5) {
      const limited = add16(catcherStart, mul6(delta, maximumGloveSpeedMps * moveDuration / 1.5 / distance6));
      catcherTarget.x = limited.x;
      catcherTarget.y = limited.y;
    }
    const finalDelta = sub9(catcherTarget, catcherStart), gloveAt = (seconds) => {
      const u = clamp2((seconds - moveStart) / moveDuration, 0, 1), smooth = u * u * (3 - 2 * u), ds = seconds > moveStart && seconds < moveEnd ? 6 * u * (1 - u) / moveDuration : 0;
      return { position: add16(catcherStart, mul6(finalDelta, smooth)), velocity: mul6(finalDelta, ds) };
    };
    const ground = kernel.boundaries.find((x) => x.kind === "ground")?.elapsedSeconds ?? horizon, catcherHit = firstContact2(
      kernel,
      (t) => norm7(sub9(kernel.evaluateAt(t, "incoming").moment.ball.position, gloveAt(t).position)) - catcher.gloveRadiusMeters - ballPhysical.radiusM,
      maximumGloveSpeedMps,
      horizon
    ), catcherAt = catcherHit?.kind === "hit" ? catcherHit.at : Math.min(horizon, catchPlaneTime + 0.05), batHit = firstContact2(kernel, (t) => measureRigidBatBallSurfaceSeparation(kernel.evaluateAt(t, "incoming").moment.ball, rigidAt(t), ballPhysical), batBound, catcherAt);
    let contact = null, contactMoment = null, contactOrientation = null, call = null, endElapsedSeconds = catcherAt, secureTick = null, unsupportedReason = null;
    if (batHit?.kind === "unresolved") {
      unsupportedReason = "bat_contact_refinement_required";
      endElapsedSeconds = batHit.from;
    } else if (batHit?.kind === "hit") {
      const at2 = kernel.evaluateAt(batHit.at, "incoming");
      contact = resolveWoodBatSpeedProfileBallContact(at2.moment.ball, rigidAt(batHit.at), ballPhysical, NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);
      if (contact) {
        contactMoment = at2.moment;
        contactOrientation = at2.orientation;
        endElapsedSeconds = batHit.at;
      } else {
        unsupportedReason = "separating_or_tangent_bat_contact_requires_continuation";
        endElapsedSeconds = batHit.at;
      }
    } else if (catcherHit?.kind === "unresolved") {
      unsupportedReason = "catcher_contact_refinement_required";
      endElapsedSeconds = catcherHit.from;
    } else if (catcherHit?.kind === "hit") {
      const at2 = kernel.evaluateAt(catcherHit.at, "incoming"), glove = gloveAt(catcherHit.at), relative = sub9(at2.moment.ball.position, glove.position), normal4 = mul6(relative, 1 / norm7(relative)), retention = resolveCatchRetention({
        contactTick: at2.moment.ball.tick,
        ball: at2.moment.ball,
        glove: { tick: at2.moment.ball.tick, ...glove },
        contactNormal: normal4,
        pocketOffsetMeters: Math.hypot(relative.x, relative.y),
        bodyStability: 1
      }, {
        ticksPerSecond: tps,
        ballMassKg: ballPhysical.massKg,
        ballRadiusMeters: ballPhysical.radiusM,
        pocketRadiusMeters: catcher.pocketRadiusMeters,
        centerRetentionCapacityJ: catcher.retentionCapacityJ,
        captureDissipationPowerW: catcher.captureDissipationPowerW,
        failedContactRestitution: 0.15,
        failedTangentialDamping: 0.6,
        failedSpinDamping: 0.4
      });
      if (retention.outcome.kind === "secured") {
        secureTick = retention.outcome.secureTick;
        endElapsedSeconds = (secureTick - input.originTick) / tps;
        const plate = kernel.evaluateAt(plateTime).moment.ball.position;
        call = swingOffered ? "swinging_strike" : ground > plateTime && Math.abs(plate.x) <= zone.halfWidth + ballPhysical.radiusM && plate.y + ballPhysical.radiusM >= zone.lowerY && plate.y - ballPhysical.radiusM <= zone.upperY ? "called_strike" : "ball";
      } else unsupportedReason = "catcher_retention_failed_live_ball_requires_successor";
    } else unsupportedReason = "catcher_missed_live_ball_requires_successor";
    const endedAtTick = contactMoment?.ball.tick ?? quantizeEventTick(input.originTick, endElapsedSeconds, tps), times = /* @__PURE__ */ new Set([0, endElapsedSeconds]), referenceThroughTick = registeredReference.startTick + (selectedFrames.at(-1).tick - selectedFrames[0].tick) / 1e6 / rate * tps;
    for (let i = 1; i * 0.011 < endElapsedSeconds; i++) times.add(i * 0.011);
    if (catcherHit?.kind === "hit" && catcherHit.at < endElapsedSeconds) times.add(catcherHit.at);
    const frames = [...times].sort((a, c) => a - c).map((seconds) => {
      const capturing = secureTick !== null && catcherHit?.kind === "hit" && seconds >= catcherHit.at, sample3 = kernel.evaluateAt(Math.min(seconds, capturing && catcherHit?.kind === "hit" ? catcherHit.at : horizon), "incoming"), bat = batSample(seconds).state.pose, owned = secureTick !== null && quantizeEventTick(input.originTick, seconds, tps) >= secureTick;
      const heldPosition = capturing && catcherHit?.kind === "hit" ? add16(sample3.moment.ball.position, sub9(gloveAt(seconds).position, gloveAt(catcherHit.at).position)) : sample3.moment.ball.position;
      return {
        tick: quantizeEventTick(input.originTick, seconds, tps),
        elapsedSeconds: seconds,
        ball: {
          position: heldPosition,
          velocity: capturing ? gloveAt(seconds).velocity : sample3.moment.ball.velocity,
          spin: capturing ? zero4() : sample3.moment.ball.spin,
          orientation: sample3.orientation,
          visible: !owned,
          possessedBy: owned ? "catcher" : null
        },
        bat: input.originTick + seconds * tps <= referenceThroughTick ? { ...bat, radiusProfile } : null
      };
    });
    const sampleBatAtTick = (atTick) => {
      assert11(Number.isFinite(atTick) && atTick >= input.originTick, "bat observation precedes release");
      if (atTick > referenceThroughTick) return null;
      return { ...batSample((atTick - input.originTick) / tps).state.pose, radiusProfile };
    };
    return {
      frames,
      contact,
      contactMoment,
      contactOrientation,
      call,
      endedAtTick,
      clipId: clip.id,
      pitchType,
      speedKmh: speed2 * 3.6,
      sampleBatAtTick,
      diagnostics: {
        authority: "LOCAL_CORE_PHYSICAL_EXPERIMENT_V1",
        nativeAdmission: false,
        sourceDescriptor: descriptor,
        sourceBallReanchored: false,
        sourceClockTicksPerSecond: tps,
        obpSourceSha256: clip.source.sha256,
        battingSide: b.bats,
        measuredClipId: clip.id,
        measuredBatCoordinateRegistration: MEASURED_BAT_FIELD_REGISTRATION_V1,
        swingOffered,
        sweetSpotT,
        playbackRate: rate,
        referenceStartTick: referenceInput.startTick,
        referenceThroughTick,
        predictionMadeAtElapsedSeconds: decisionTime,
        individualControls: {
          maximumPitchSpeedMps: p.maximumPitchSpeedMps ?? null,
          throwingSide: p.throws ?? "R",
          maximumSweetSpotSpeedMps: b.maximumSweetSpotSpeedMps ?? null,
          targetSweetSpotSpeedMps: b.targetSweetSpotSpeedMps ?? null,
          motorLatencySeconds: b.motorLatencySeconds ?? null,
          technicalTimingOffsetSeconds: b.technicalTimingOffsetSeconds ?? null,
          sweetSpotT: b.sweetSpotT ?? null,
          attackAngleDegrees: b.attackAngleDegrees ?? null,
          pullAngleDegrees: b.pullAngleDegrees ?? null,
          badBallControl: b.badBallControl ?? null,
          swingDecision: b.swingDecision ?? null,
          preContactSeconds: b.preContactSeconds ?? null,
          followThroughSeconds: b.followThroughSeconds ?? null,
          contactDepthMeters: b.contactDepthMeters ?? null,
          zoneJudgmentStdMeters: judgmentStd
        },
        zoneJudgment: {
          standardDeviationMeters: judgmentStd,
          errorMeters: judgmentError,
          observedForecastPosition: prediction.ball.position,
          estimatedPosition: judgmentPosition,
          stream: "zone-judgment-v1",
          basis: "AUTHORED_XY_COURSE_ESTIMATE_ERROR_NOT_CHASE_PREFERENCE"
        },
        authoredDecisionPolicy: "BOUNDED_OBSERVED_ZONE_MARGIN_V1_NOT_CALIBRATED_RECOGNITION",
        swingScore,
        awkwardErrorFactor,
        motorDelaySeconds,
        authoredTrajectoryPolicy: "FINITE_MEASURED_KEYS_WITH_EXPLICIT_RIGID_DIRECTION_RATE_AND_WINDOW_CONTROLS",
        referenceMaximumSweetSpotSpeedMps: reference.maximumSweetSpotSpeedMps,
        referenceContactTick,
        plannedReferenceStartTick: plannedStartTick,
        maximumOnTimeMotorLatencySeconds: (plannedStartTick - input.originTick) / tps - decisionTime,
        desiredContactElapsedSeconds: desiredContactTime,
        selectedSourceFirstTick: selectedFrames[0].tick,
        selectedSourceLastTick: selectedFrames.at(-1).tick,
        referenceSpeedCalibration: "EXACT_ORIGINAL_SOURCE_COORDINATE_OUTGOING_HALF_OPEN_SEGMENT",
        referenceContactSweetSpotSpeedMps: norm7(reference.sampleAtSourceTick(sourceContactTick, "outgoing").sweetSpotVelocity),
        referenceContactSweetSpotVelocity: reference.sampleAtSourceTick(sourceContactTick, "outgoing").sweetSpotVelocity,
        referenceIncomingContactSweetSpotVelocity: reference.sampleAtSourceTick(sourceContactTick, "incoming").sweetSpotVelocity,
        referenceWorldSampleContactSweetSpotVelocity: reference.sampleContinuous(referenceContactTick).sweetSpotVelocity,
        predictionModel: "CURRENT_OBSERVED_STATE_AERO_FORECAST_NO_BODY_OR_NEURAL_CALIBRATION",
        timingErrorSeconds: timingError,
        aimErrorMeters: aimError,
        catcherModel: "BOUNDED_C1_GLOVE_IDEAL_STATE_FORECAST_REDUCED_ORDER_RETENTION",
        catcherMaximumSpeedMps: maximumGloveSpeedMps,
        catcherSI: catcher,
        catcherCalibration: input.catcher ? "EXPLICIT_ROSTER_SI" : "EXPLICIT_COMPATIBILITY_TEST_MODEL",
        catcherPredictionPhysics: "OBSERVED_STATE_AERO_GROUND_FORECAST_NOT_A_REPLACEMENT_ACTUAL_SOURCE",
        catcherBodyReachM: reach,
        secureTick,
        catcherContactElapsedSeconds: catcherHit?.kind === "hit" ? catcherHit.at : null,
        unsupportedReason,
        collisionSearch: "ORIGINAL_SOURCE_CELL_SPEED_BOUND_CONTINUOUS_TAPERED_BAT",
        materialProfileId: NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1.profileId,
        bodyTorqueCalibrated: false,
        axialRollMeasured: false,
        postImpactBodyRecoilImplemented: false,
        postImpactBatPresentation: "PRESCRIBED_OBP_REFERENCE_MOTOR_CONTINUATION_RECOIL_NOT_COUPLED",
        batReferenceScope: "FINITE_MEASURED_KEYS_ONLY_NOT_AN_EQUIPMENT_RELEASE_FACT",
        batterBodyCollidersImplemented: false,
        pitcherReleaseHandColliderImplemented: false
      }
    };
  }

  // src/integration/browser/LiveBaseballMatchV1.ts
  var LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 = Object.freeze({
    basis: "EXPLICIT_AUTHORED_SI_V1",
    batLengthM: 0.84,
    batMassKg: 0.88,
    swingRate: 1,
    timingStdSeconds: 9e-3,
    aimStdMeters: 0.022,
    chaseMarginMeters: 0.12,
    releaseSpeedMps: 42.5,
    spinRadPerSecond: Object.freeze({ x: -230, y: 15, z: 10 }),
    commandStdMeters: 0.11,
    reactionSeconds: 0.18,
    topSpeedMps: 8,
    accelerationMps2: 5.2,
    gloveSpeedMps: 11,
    gloveReachMeters: 1.35,
    gloveRadiusMeters: 0.11,
    retentionCapacityJ: 160,
    captureDissipationPowerW: 3e3,
    transferSeconds: 0.46,
    throwSpeedMps: 34
  });
  var positions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  var zero5 = () => ({ x: 0, y: 0, z: 0 });
  var baseSide = 27.432 / Math.sqrt(2);
  var LIVE_MATCH_BASES_V1 = Object.freeze({
    home: Object.freeze(zero5()),
    first: Object.freeze({ x: baseSide, y: 0, z: baseSide }),
    second: Object.freeze({ x: 0, y: 0, z: baseSide * 2 }),
    third: Object.freeze({ x: -baseSide, y: 0, z: baseSide })
  });
  var placements = {
    P: { x: 0, y: 0.9, z: 18.44 },
    C: { x: 0, y: 0.85, z: -1.5 },
    "1B": { x: 23, y: 0.9, z: 25 },
    "2B": { x: 13, y: 0.9, z: 36 },
    "3B": { x: -23, y: 0.9, z: 25 },
    SS: { x: -13, y: 0.9, z: 36 },
    LF: { x: -46, y: 0.9, z: 76 },
    CF: { x: 0, y: 0.9, z: 91 },
    RF: { x: 46, y: 0.9, z: 76 }
  };
  var LIVE_MATCH_PHYSICS_V1 = Object.freeze({
    kind: "aero_ground_v1",
    air: Object.freeze({ ticksPerSecond: 1e6, integrationStepTicks: 5e3, gravityY: -9.80665, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }),
    ground: Object.freeze({
      ticksPerSecond: 1e6,
      gravityMps2: 9.80665,
      radiusM: 0.0366,
      inertiaRatio: 0.378,
      restingVerticalSpeedMps: 0.28,
      material: Object.freeze({ restitution: 0.48, slidingFriction: 0.24, rollingDecelerationMps2: 0.36, normalSpinDecayPerSecond: 0.18 })
    })
  });
  var frozen = (v2) => {
    if (v2 && typeof v2 === "object" && !Object.isFrozen(v2)) {
      Object.values(v2).forEach(frozen);
      Object.freeze(v2);
    }
    return v2;
  };
  function assert12(v2, m) {
    if (!v2) throw new Error("live baseball match: " + m);
  }
  function physical(player) {
    const p = player.physical ?? LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1;
    assert12(p.basis === "EXPLICIT_AUTHORED_SI_V1", "unknown player SI basis");
    const nonnegative3 = ["timingStdSeconds", "aimStdMeters", "chaseMarginMeters", "commandStdMeters", "reactionSeconds", "transferSeconds"];
    const positive2 = [
      "batLengthM",
      "batMassKg",
      "swingRate",
      "releaseSpeedMps",
      "topSpeedMps",
      "accelerationMps2",
      "gloveSpeedMps",
      "gloveReachMeters",
      "gloveRadiusMeters",
      "retentionCapacityJ",
      "captureDissipationPowerW",
      "throwSpeedMps"
    ];
    assert12(nonnegative3.every((k) => Number.isFinite(p[k]) && p[k] >= 0) && positive2.every((k) => Number.isFinite(p[k]) && p[k] > 0) && Object.values(p.spinRadPerSecond).every(Number.isFinite), "invalid explicit player SI");
    assert12(
      p.zoneJudgmentStdMeters === void 0 || Number.isFinite(p.zoneJudgmentStdMeters) && p.zoneJudgmentStdMeters >= 0 && p.zoneJudgmentStdMeters <= 0.6,
      "invalid zone judgment SI"
    );
    assert12(
      p.baserunningSafetyMarginSeconds === void 0 || Number.isFinite(p.baserunningSafetyMarginSeconds) && p.baserunningSafetyMarginSeconds >= 0 && p.baserunningSafetyMarginSeconds <= 3,
      "invalid baserunning safety margin"
    );
    assert12(
      p.fieldingPursuitCostWeight === void 0 || Number.isFinite(p.fieldingPursuitCostWeight) && p.fieldingPursuitCostWeight >= 0.25 && p.fieldingPursuitCostWeight <= 4,
      "invalid fielding pursuit cost weight"
    );
    assert12(
      p.baserunningTurnRadiusMeters === void 0 || Number.isFinite(p.baserunningTurnRadiusMeters) && p.baserunningTurnRadiusMeters >= 0.5 && p.baserunningTurnRadiusMeters <= 10,
      "invalid baserunning turn radius SI"
    );
    assert12(
      p.baserunningLateralAccelerationMps2 === void 0 || Number.isFinite(p.baserunningLateralAccelerationMps2) && p.baserunningLateralAccelerationMps2 >= 0.5 && p.baserunningLateralAccelerationMps2 <= 20,
      "invalid baserunning lateral acceleration SI"
    );
    return p;
  }
  function createLiveBaseballMatchV1(raw) {
    const input = cloneInert(raw), innings = input.innings ?? 9, tps = LIVE_MATCH_PHYSICS_V1.air.ticksPerSecond;
    assert12(Number.isSafeInteger(input.seed) && Number.isSafeInteger(innings) && innings > 0, "invalid seed/innings");
    assert12(input.teams.length === 2 && new Set(input.teams.map((t) => t.id)).size === 2, "two unique teams required");
    const players = new Map(input.players.map((p) => [p.playerId, p]));
    assert12(players.size === input.players.length && input.players.every((p) => p.playerId && p.name && Number.isFinite(p.heightMeters) && p.heightMeters > 0 && ["R", "L"].includes(p.bats) && (p.throws === void 0 || ["R", "L"].includes(p.throws))), "unique physical players required");
    input.players.forEach(physical);
    input.teams.forEach((t) => {
      assert12(t.battingOrder.length === 9 && new Set(t.battingOrder).size === 9 && t.battingOrder.every((id6) => players.has(id6)), "nine-player batting order required");
      assert12(positions.every((pos) => players.has(t.defense[pos])) && new Set(positions.map((pos) => t.defense[pos])).size === 9 && t.defense.P === t.pitcherId, "complete defense required");
    });
    assert12(input.measuredClips.length > 0, "OpenBiomechanics measured bat clips required");
    const park = input.park ?? { fenceRadiusMeters: 110, fenceHeightMeters: 3 };
    assert12(Number.isFinite(park.fenceRadiusMeters) && park.fenceRadiusMeters > baseSide * 2 && Number.isFinite(park.fenceHeightMeters) && park.fenceHeightMeters >= 0, "invalid park geometry");
    const fence = deriveLiveFieldFenceGeometryV1({ bases: LIVE_MATCH_BASES_V1, ...park }), fenceGeometry = frozen({
      center: { x: fence.fenceCenter.x, z: fence.fenceCenter.z },
      radiusMeters: fence.fenceRadiusMeters,
      heightMeters: fence.fenceHeightMeters
    });
    let match = {
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
    let pitchCount = 0, nextTick = tps, finished = false;
    const battingOrderIndices = [0, 0], history = [], line = [{ inning: 1, away: 0, home: null }];
    const offense = () => match.half === "top" ? 0 : 1;
    const current = () => {
      const team = offense();
      return { team, batterPlayerId: input.teams[team].battingOrder[battingOrderIndices[team]], pitcherPlayerId: input.teams[1 - team].pitcherId };
    };
    const readyFrame = () => {
      const c = current(), def = input.teams[1 - c.team], batter = players.get(c.batterPlayerId);
      return frozen({
        tick: nextTick,
        ball: { position: { x: 0, y: 1.8, z: 16.4 }, velocity: zero5(), spin: zero5(), orientation: IDENTITY_QUATERNION, visible: false },
        bat: null,
        actors: [
          ...positions.map((role) => ({ playerId: def.defense[role], role, team: 1 - c.team, position: { ...placements[role], y: 0 }, velocity: zero5() })),
          { playerId: c.batterPlayerId, role: "batter", team: c.team, position: { x: batter.bats === "R" ? -0.85 : 0.85, y: 0, z: -0.2 }, velocity: zero5() },
          ...["first", "second", "third"].flatMap((name) => match.bases[name] ? [{
            playerId: match.bases[name],
            role: "runner",
            team: c.team,
            position: LIVE_MATCH_BASES_V1[name],
            velocity: zero5()
          }] : [])
        ],
        batterPlayerId: c.batterPlayerId,
        pitcherPlayerId: c.pitcherPlayerId,
        phase: "ready",
        ballKind: "pitch",
        fairKnown: false,
        possessedBy: c.pitcherPlayerId
      });
    };
    const inspect = () => frozen({
      version: 33,
      authority: "LOCAL_BROWSER_CORE_HOST_V1",
      nativeAuthentication: false,
      playerCalibration: "EXPLICIT_AUTHORED_SI_NOT_NAMED_LEAGUE_MEASUREMENTS",
      match: cloneInert(match),
      frame: readyFrame(),
      ...current(),
      pitchCount,
      finished,
      battingOrderIndices: [...battingOrderIndices],
      line: cloneInert(line),
      fenceGeometry,
      hits: null,
      errors: null,
      history: [...history]
    });
    function issuePitch(command) {
      assert12(!finished, "game already finished");
      assert12(command && ["balanced", "contact", "power", "take", "bunt"].includes(command.batting) && [0, 1].includes(command.managedTeam), "invalid manager command");
      const beforeMatch = cloneInert(match), c = current(), batter = players.get(c.batterPlayerId), pitcher = players.get(c.pitcherPlayerId), bp = physical(batter), pp = physical(pitcher), cp = physical(players.get(input.teams[1 - c.team].defense.C)), ready = readyFrame();
      const batting = command.managedTeam === c.team ? command.batting : "balanced";
      const pitch = simulateLivePitchV1({
        originTick: nextTick,
        seed: input.seed + Math.imul(pitchCount + 1, 2654435769) >>> 0,
        batter: { ...bp, heightMeters: batter.heightMeters, bats: batter.bats },
        pitcher: { ...pp, ...pitcher.throws === void 0 ? {} : { throws: pitcher.throws } },
        measuredClips: input.measuredClips,
        catcher: {
          gloveSpeedMps: cp.gloveSpeedMps,
          gloveReachMeters: cp.gloveReachMeters,
          gloveRadiusMeters: cp.gloveRadiusMeters,
          retentionCapacityJ: cp.retentionCapacityJ,
          captureDissipationPowerW: cp.captureDissipationPowerW,
          pocketRadiusMeters: 0.14
        },
        batting,
        pitchType: command.managedTeam === 1 - c.team ? command.pitchType : "auto",
        location: command.managedTeam === 1 - c.team ? command.location : "auto",
        physics: LIVE_MATCH_PHYSICS_V1
      });
      const frames = pitch.frames.map((f) => ({ ...ready, tick: f.tick, ball: f.ball, bat: f.bat, phase: "pitch", possessedBy: f.ball.possessedBy === "catcher" ? input.teams[1 - c.team].defense.C : null }));
      let field = null, result, outgoingBallMoment = null;
      if (pitch.contact && pitch.contactMoment) {
        const def = input.teams[1 - c.team];
        const fielders = positions.map((role) => {
          const playerId = def.defense[role], p = physical(players.get(playerId));
          return {
            playerId,
            defensivePosition: role,
            position: placements[role],
            reactionSeconds: p.reactionSeconds,
            topSpeedMps: p.topSpeedMps,
            accelerationMps2: p.accelerationMps2,
            fieldingCognition: { decisionSeconds: p.defensiveDecisionSeconds ?? 0, pursuitCostWeight: p.fieldingPursuitCostWeight ?? 1 },
            gloveSpeedMps: p.gloveSpeedMps,
            gloveReachMeters: p.gloveReachMeters,
            gloveRadiusMeters: p.gloveRadiusMeters,
            catchRetention: {
              ticksPerSecond: tps,
              ballMassKg: 0.145,
              ballRadiusMeters: 0.0366,
              pocketRadiusMeters: 0.14,
              centerRetentionCapacityJ: p.retentionCapacityJ,
              captureDissipationPowerW: p.captureDissipationPowerW,
              failedContactRestitution: 0.2,
              failedTangentialDamping: 0.35,
              failedSpinDamping: 0.2
            },
            transferSeconds: p.transferSeconds,
            throwSpeedMps: p.throwSpeedMps,
            throwBackspinRadPerSecond: 120,
            ...p.throwDirectionStdRadians === void 0 ? {} : { throwDirectionStdRadians: p.throwDirectionStdRadians }
          };
        });
        const runnerSpecs = [
          {
            runnerId: c.batterPlayerId,
            initialBase: 0,
            position: ready.actors.find((a) => a.playerId === c.batterPlayerId).position,
            topSpeedMps: bp.topSpeedMps,
            accelerationMps2: bp.accelerationMps2,
            reactionSeconds: bp.reactionSeconds,
            advanceSafetyMarginSeconds: bp.baserunningSafetyMarginSeconds ?? 0.35,
            roundingRadiusMeters: bp.baserunningTurnRadiusMeters ?? 4.5,
            lateralAccelerationMps2: bp.baserunningLateralAccelerationMps2 ?? 1.5 * bp.accelerationMps2
          },
          ...["first", "second", "third"].flatMap((key3, i) => {
            const runnerId = beforeMatch.bases[key3];
            if (!runnerId) return [];
            const p = physical(players.get(runnerId));
            return [{
              runnerId,
              initialBase: i + 1,
              topSpeedMps: p.topSpeedMps,
              accelerationMps2: p.accelerationMps2,
              reactionSeconds: p.reactionSeconds,
              advanceSafetyMarginSeconds: p.baserunningSafetyMarginSeconds ?? 0.35,
              roundingRadiusMeters: p.baserunningTurnRadiusMeters ?? 4.5,
              lateralAccelerationMps2: p.baserunningLateralAccelerationMps2 ?? 1.5 * p.accelerationMps2
            }];
          })
        ];
        const outgoingMoment = { ...pitch.contactMoment, ball: { ...pitch.contactMoment.ball, velocity: pitch.contact.exitVelocity, spin: pitch.contact.exitSpin } };
        outgoingBallMoment = outgoingMoment;
        field = simulateLiveFieldPlayV1({
          ball: outgoingMoment,
          orientation: pitch.contactOrientation ?? IDENTITY_QUATERNION,
          physics: LIVE_MATCH_PHYSICS_V1,
          seed: input.seed + Math.imul(pitchCount + 1, 2654435769) >>> 0,
          field: { bases: LIVE_MATCH_BASES_V1, ...park },
          fielders,
          runners: runnerSpecs,
          outs: beforeMatch.outs,
          maxPlaySeconds: 45
        });
        if (!field.end.complete) throw new Error(
          "live baseball match: physical field continuation unresolved: " + field.end.reason + " (pitch " + (pitchCount + 1) + ", seed " + input.seed + ")",
          { cause: { outgoingMoment, fielders, runners: runnerSpecs, outs: beforeMatch.outs, field: { bases: LIVE_MATCH_BASES_V1, ...park }, end: field.end, diagnostics: field.diagnostics, facts: field.facts } }
        );
        result = reducePlayableMatchV1({ match: beforeMatch, batterRunnerId: c.batterPlayerId, regulationInnings: innings, event: { kind: "field_play", facts: { ...field.ruleFacts, buntAttempt: batting === "bunt" } } });
        let lastThrow = -Infinity, observer;
        for (const f of field.frames) {
          const events = field.facts.filter((e) => e.tick <= f.tick);
          lastThrow = events.filter((e) => e.kind === "throw_release").at(-1)?.tick ?? -Infinity;
          const latestCatch = events.filter((e) => e.kind === "catch_secured").at(-1);
          observer = f.ball.possessedBy ?? latestCatch?.playerId ?? f.fielders.filter((a) => a.intent === "intercept").sort((a, b) => Math.hypot(a.position.x - f.ball.position.x, a.position.z - f.ball.position.z) - Math.hypot(b.position.x - f.ball.position.x, b.position.z - f.ball.position.z))[0]?.playerId;
          frames.push({
            ...ready,
            tick: f.tick,
            ball: f.ball,
            bat: pitch.sampleBatAtTick(f.tick),
            actors: [
              ...f.fielders.map((a) => ({ playerId: a.playerId, role: positions.find((pos) => def.defense[pos] === a.playerId), team: 1 - c.team, position: { ...a.position, y: 0 }, velocity: a.velocity })),
              ...f.runners.map((r) => {
                const out = result.kind === "applied" ? result.outcomes.find((o) => o.runnerId === r.runnerId) : null, dt = out ? Math.max(0, (f.tick - out.tick) / tps) : 0, dx = (c.team === 0 ? -30 : 30) - r.position.x, dz = 3 - r.position.z, length = Math.hypot(dx, dz), travel = Math.min(length, dt * 3.2);
                return {
                  playerId: r.runnerId,
                  role: "runner",
                  team: c.team,
                  position: { x: r.position.x + dx / (length || 1) * travel, y: 0, z: r.position.z + dz / (length || 1) * travel },
                  velocity: dt > 0 ? { x: dx / (length || 1) * 3.2, y: 0, z: dz / (length || 1) * 3.2 } : r.velocity,
                  retired: r.retired
                };
              })
            ],
            phase: f.ball.possessedBy ? "held" : lastThrow >= (latestCatch?.tick ?? Infinity) ? "throw" : "batted",
            ballKind: lastThrow >= (latestCatch?.tick ?? Infinity) ? "throw" : "batted",
            fairKnown: events.some((e) => e.kind === "territory_determined" && e.reason === "fair"),
            possessedBy: f.ball.possessedBy,
            fieldObserverPlayerId: observer,
            homeRunConfirmed: !!field.ruleFacts.overFence?.fair && field.ruleFacts.overFence.untouchedGround && f.tick >= field.ruleFacts.overFence.tick
          });
        }
      } else {
        assert12(pitch.call !== null, "pitch ended without physical contact or secured count call");
        result = reducePlayableMatchV1({ match: beforeMatch, batterRunnerId: c.batterPlayerId, regulationInnings: innings, event: { kind: "pitch_call", tick: pitch.endedAtTick, call: pitch.call } });
      }
      assert12(result.kind === "applied", "rule continuation unresolved: " + (result.kind === "unresolved" ? result.reason : ""));
      const acceptedFrames = frames.filter((f) => f.tick <= result.endedAtTick);
      if (!acceptedFrames.length) acceptedFrames.push(ready);
      if (result.halfChanged || result.gameOver) {
        const last = acceptedFrames.at(-1), duration = 0.9, step = 0.055;
        for (let dt = step; dt <= duration + step / 2; dt += step) {
          const seconds = Math.min(dt, duration);
          acceptedFrames.push({
            ...last,
            tick: result.endedAtTick + Math.round(seconds * tps),
            phase: "bench",
            ball: last.ball ? { ...last.ball, visible: false } : null,
            actors: last.actors.map((a) => {
              const target = { x: a.team === 0 ? -30 : 30, z: 3 }, dx = target.x - a.position.x, dz = target.z - a.position.z, length = Math.hypot(dx, dz), travel = Math.min(length, seconds * 3.2);
              return { ...a, position: { x: a.position.x + dx / (length || 1) * travel, y: 0, z: a.position.z + dz / (length || 1) * travel }, velocity: { x: dx / (length || 1) * 3.2, y: 0, z: dz / (length || 1) * 3.2 } };
            })
          });
        }
      }
      const row = line.find((r) => r.inning === beforeMatch.inning);
      row[beforeMatch.half === "top" ? "away" : "home"] = (row[beforeMatch.half === "top" ? "away" : "home"] ?? 0) + result.scoredRunnerIds.length;
      match = result.match;
      finished = result.gameOver;
      pitchCount++;
      if (result.batterAdvanced) battingOrderIndices[c.team] = (battingOrderIndices[c.team] + 1) % 9;
      if (result.halfChanged) {
        let r = line.find((r2) => r2.inning === match.inning);
        if (!r) {
          r = { inning: match.inning, away: null, home: null };
          line.push(r);
        }
        r[match.half === "top" ? "away" : "home"] = 0;
      }
      nextTick = Math.max(result.endedAtTick, acceptedFrames.at(-1).tick) + 2 * tps;
      const record = frozen({
        beforeMatch,
        match: cloneInert(match),
        frames: acceptedFrames,
        events: [...field?.facts ?? [], ...result.outcomes.map((o) => ({ kind: "runner_out", ...o })), { kind: "pitch_adjudicated", tick: result.endedAtTick, classification: result.classification }],
        command: cloneInert(command),
        play: {
          classification: result.classification,
          call: pitch.call,
          contact: pitch.contact,
          contactMoment: pitch.contactMoment,
          contactOrientation: pitch.contactOrientation,
          outgoingBallMoment,
          field,
          rules: result,
          diagnostics: pitch.diagnostics
        },
        requiresNextPitch: !finished,
        finished,
        batterPlayerId: c.batterPlayerId,
        pitcherPlayerId: c.pitcherPlayerId,
        pitchType: pitch.pitchType,
        speedKmh: pitch.speedKmh,
        line: cloneInert(line),
        hits: null,
        errors: null
      });
      history.push(record);
      return record;
    }
    return Object.freeze({ issuePitch, inspect });
  }

  // src/core/sim/pitching/CourseAwareSwingKinematicsV1.ts
  var INCH_TO_M = 0.0254;
  var EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1 = Object.freeze({
    profileId: "evidence-bounded-population-swing",
    version: "swing-course-profile-v1",
    batLengthM: 0.84,
    sweetSpotT: 0.72,
    centerContactDepthM: 20.1 * INCH_TO_M,
    contactDepthPopulationStdDevM: 7.2 * INCH_TO_M,
    insideOutsideDepthGainM: 0.075,
    heightDepthGainM: 0.035,
    baseContactSweetSpotSpeedMps: 31,
    contactDepthSpeedGainMpsPerM: 4,
    basePreContactSeconds: 0.165,
    insideOutsideTimingGainSeconds: 0.01,
    heightTimingGainSeconds: 4e-3,
    followThroughSeconds: 0.135,
    highAttackAngleDeg: 7,
    middleAttackAngleDeg: 9,
    lowAttackAngleDeg: 16,
    courseAttackDirectionGainDeg: 6,
    nominalContactSurfaceDistanceM: 0.0366 + 0.033
  });

  // src/integration/browser/WorkbenchPlayer.ts
  var WORKBENCH_TICKS_PER_SECOND = 1e6;
  var leagues = ["NPB", "MLB", "NLB", "KBO", "CUSTOM"];
  var freeze20 = (value) => {
    if (value !== null && typeof value === "object") {
      Object.values(value).forEach(freeze20);
      Object.freeze(value);
    }
    return value;
  };
  var fields10 = (value, keys, path) => {
    if (value === null || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(`invalid workbench fields: ${path}`);
  };
  var text = (value, path) => {
    if (typeof value !== "string" || !value.length || value.trim() !== value || value.length > 160) throw new Error(`invalid workbench text: ${path}`);
  };
  var range = (value, low, high, path) => {
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(`invalid workbench range: ${path}`);
  };
  var ticks = (value, low, high, path) => {
    range(value, low, high, path);
    if (!Number.isSafeInteger(value)) throw new Error(`workbench ticks must be integers: ${path}`);
  };
  function createWorkbenchPlayer(raw) {
    const player = cloneInert(raw);
    fields10(player, ["schemaVersion", "identity", "body", "capability", "bat", "swing", "decision", "traits"], "player");
    if (player.schemaVersion !== 1) throw new Error("unsupported workbench player schema");
    fields10(player.identity, ["playerId", "name", "leagueId", "bats", "throws"], "identity");
    text(player.identity.playerId, "playerId");
    text(player.identity.name, "name");
    if (!leagues.includes(player.identity.leagueId) || !["R", "L"].includes(player.identity.bats) || !["R", "L"].includes(player.identity.throws)) throw new Error("invalid workbench identity");
    fields10(player.body, ["heightMeters", "massKg"], "body");
    range(player.body.heightMeters, 0.8, 3, "heightMeters");
    range(player.body.massKg, 15, 300, "body.massKg");
    fields10(player.capability, [
      "maximumSweetSpotSpeedMps",
      "motorLatencyTicks",
      "technicalTimingOffsetTicks",
      "runSpeedMps",
      "throwSpeedMps",
      "pitchSpeedMps",
      "positionErrorMeters",
      "timingErrorTicks"
    ], "capability");
    const c = player.capability;
    range(c.maximumSweetSpotSpeedMps, 0.1, 90, "maximumSweetSpotSpeedMps");
    ticks(c.motorLatencyTicks, 1, 2e6, "motorLatencyTicks");
    ticks(c.technicalTimingOffsetTicks, -5e5, 5e5, "technicalTimingOffsetTicks");
    range(c.runSpeedMps, 0.1, 20, "runSpeedMps");
    range(c.throwSpeedMps, 0.1, 80, "throwSpeedMps");
    range(c.pitchSpeedMps, 0.1, 80, "pitchSpeedMps");
    range(c.positionErrorMeters, 0, 1, "positionErrorMeters");
    ticks(c.timingErrorTicks, 0, 5e5, "timingErrorTicks");
    fields10(player.bat, ["lengthM", "massKg", "sweetSpotT"], "bat");
    range(player.bat.lengthM, 0.2, 1.5, "bat.lengthM");
    range(player.bat.massKg, 0.05, 3, "bat.massKg");
    range(player.bat.sweetSpotT, 0.65, 0.9, "sweetSpotT (declared barrel reference)");
    fields10(player.swing, [
      "speedMps",
      "attackAngleDeg",
      "pullAngleDeg",
      "preContactSeconds",
      "followThroughSeconds",
      "contactDepthM",
      "loadAngleDeg",
      "finishAngleDeg",
      "handTravelM"
    ], "swing");
    const s = player.swing;
    range(s.speedMps, 0.1, c.maximumSweetSpotSpeedMps, "swing speed envelope");
    range(s.attackAngleDeg, -80, 80, "attackAngleDeg");
    range(s.pullAngleDeg, -80, 80, "pullAngleDeg");
    range(s.preContactSeconds, 5e-3, 2, "preContactSeconds");
    range(s.followThroughSeconds, 5e-3, 2, "followThroughSeconds");
    range(s.contactDepthM, 1e-3, 2, "contactDepthM");
    range(s.loadAngleDeg, -179, 179, "loadAngleDeg");
    range(s.finishAngleDeg, -179, 179, "finishAngleDeg");
    range(s.handTravelM, 0, 1, "handTravelM");
    fields10(player.decision, ["threshold", "aggressionWeight", "approach"], "decision");
    range(player.decision.threshold, 0, 1, "threshold");
    range(player.decision.aggressionWeight, 0, 1, "aggressionWeight");
    if (!["AUTO", "TAKE", "SWING"].includes(player.decision.approach)) throw new Error("invalid workbench approach");
    fields10(player.traits, ["badBallControl", "labels"], "traits");
    range(player.traits.badBallControl, 0, 1, "badBallControl");
    if (!Array.isArray(player.traits.labels) || player.traits.labels.length > 32) throw new Error("invalid workbench trait labels");
    player.traits.labels.forEach((label) => text(label, "trait label"));
    if (new Set(player.traits.labels).size !== player.traits.labels.length) throw new Error("duplicate workbench trait label");
    return freeze20(player);
  }

  // src/integration/browser/LivePhysicalRosterV1.ts
  var scalarKeys = [
    "batLengthM",
    "batMassKg",
    "swingRate",
    "timingStdSeconds",
    "aimStdMeters",
    "chaseMarginMeters",
    "releaseSpeedMps",
    "commandStdMeters",
    "reactionSeconds",
    "topSpeedMps",
    "accelerationMps2",
    "gloveSpeedMps",
    "gloveReachMeters",
    "gloveRadiusMeters",
    "retentionCapacityJ",
    "captureDissipationPowerW",
    "transferSeconds",
    "throwSpeedMps",
    "maximumPitchSpeedMps",
    "maximumSweetSpotSpeedMps",
    "targetSweetSpotSpeedMps",
    "motorLatencySeconds",
    "technicalTimingOffsetSeconds",
    "sweetSpotT",
    "attackAngleDegrees",
    "pullAngleDegrees",
    "badBallControl",
    "defensiveDecisionSeconds",
    "preContactSeconds",
    "followThroughSeconds",
    "contactDepthMeters",
    "throwDirectionStdRadians",
    "zoneJudgmentStdMeters",
    "baserunningSafetyMarginSeconds",
    "fieldingPursuitCostWeight",
    "baserunningTurnRadiusMeters",
    "baserunningLateralAccelerationMps2"
  ];
  var physicalKeys = ["basis", ...scalarKeys, "spinRadPerSecond", "clipId", "swingDecision"];
  var bounds = {
    batLengthM: [0.55, 1.2],
    batMassKg: [0.4, 1.8],
    swingRate: [0.3, 3],
    timingStdSeconds: [0, 0.08],
    aimStdMeters: [0, 0.35],
    chaseMarginMeters: [0, 0.6],
    releaseSpeedMps: [15, 85],
    maximumPitchSpeedMps: [15, 85],
    commandStdMeters: [0, 0.6],
    gloveSpeedMps: [0.1, 40],
    gloveReachMeters: [0.4, 3],
    gloveRadiusMeters: [0.03, 0.3],
    retentionCapacityJ: [1, 2e3],
    captureDissipationPowerW: [10, 1e6],
    maximumSweetSpotSpeedMps: [0.1, 90],
    targetSweetSpotSpeedMps: [0.1, 90],
    motorLatencySeconds: [0, 2],
    technicalTimingOffsetSeconds: [-0.5, 0.5],
    sweetSpotT: [0.65, 0.9],
    attackAngleDegrees: [-80, 80],
    pullAngleDegrees: [-80, 80],
    badBallControl: [0, 1],
    preContactSeconds: [5e-3, 2],
    followThroughSeconds: [5e-3, 2],
    contactDepthMeters: [1e-3, 2],
    throwDirectionStdRadians: [0, 0.12],
    zoneJudgmentStdMeters: [0, 0.6],
    baserunningSafetyMarginSeconds: [0, 3],
    fieldingPursuitCostWeight: [0.25, 4],
    baserunningTurnRadiusMeters: [0.5, 10],
    baserunningLateralAccelerationMps2: [0.5, 20]
  };
  var nonnegative2 = /* @__PURE__ */ new Set(["reactionSeconds", "transferSeconds", "defensiveDecisionSeconds"]);
  var freeze21 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze21);
      Object.freeze(value);
    }
    return value;
  };
  function assert13(value, message) {
    if (!value) throw new Error("live physical roster: " + message);
  }
  var validText = (value) => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 200;
  function fields11(value, allowed, required, path) {
    assert13(value && typeof value === "object" && !Array.isArray(value), "object required at " + path);
    assert13(Object.keys(value).every((k) => allowed.includes(k)) && required.every((k) => Object.hasOwn(value, k)), "unknown or missing fields at " + path);
  }
  function validatePhysical(raw) {
    fields11(raw, physicalKeys, ["basis"], "physical");
    assert13(raw.basis === "EXPLICIT_AUTHORED_SI_V1", "explicit SI basis required");
    for (const key3 of scalarKeys) if (Object.hasOwn(raw, key3)) {
      const value = raw[key3], limits = bounds[key3];
      assert13(typeof value === "number" && Number.isFinite(value) && (limits ? value >= limits[0] && value <= limits[1] : nonnegative2.has(key3) ? value >= 0 : value > 0), "unsupported physical range: " + key3);
    }
    if (Object.hasOwn(raw, "spinRadPerSecond")) {
      fields11(raw.spinRadPerSecond, ["x", "y", "z"], ["x", "y", "z"], "spinRadPerSecond");
      const spin = raw.spinRadPerSecond;
      assert13(Object.values(spin).every((n) => typeof n === "number" && Number.isFinite(n)) && Math.hypot(spin.x, spin.y, spin.z) <= 1200, "invalid SI spin");
    }
    if (Object.hasOwn(raw, "clipId")) assert13(validText(raw.clipId), "invalid measured clip identity");
    if (Object.hasOwn(raw, "swingDecision")) {
      fields11(raw.swingDecision, ["approach", "threshold", "aggressionWeight"], ["approach", "threshold", "aggressionWeight"], "swingDecision");
      assert13(["AUTO", "TAKE", "SWING"].includes(raw.swingDecision.approach) && [raw.swingDecision.threshold, raw.swingDecision.aggressionWeight].every((v2) => typeof v2 === "number" && Number.isFinite(v2) && v2 >= 0 && v2 <= 1), "invalid explicit swing decision");
    }
    if (raw.maximumSweetSpotSpeedMps !== void 0 && raw.targetSweetSpotSpeedMps !== void 0)
      assert13(raw.targetSweetSpotSpeedMps <= raw.maximumSweetSpotSpeedMps, "target swing speed exceeds declared motor ceiling");
  }
  function applyLivePhysicalRosterV1(raw) {
    const input = cloneInert(raw);
    fields11(input, ["players", "roster"], ["players", "roster"], "input");
    assert13(Array.isArray(input.players), "players required");
    const players = input.players;
    assert13(players.every((p) => validText(p.playerId) && validText(p.name) && Number.isFinite(p.heightMeters) && p.heightMeters >= 1.1 && p.heightMeters <= 2.5 && ["R", "L"].includes(p.bats)) && new Set(players.map((p) => p.playerId)).size === players.length, "invalid roster identity");
    fields11(input.roster, ["version", "sourceId", "entries"], ["version", "sourceId", "entries"], "roster");
    assert13(input.roster.version === "live_physical_roster_v1" && validText(input.roster.sourceId) && Array.isArray(input.roster.entries), "invalid roster packet");
    const entries = input.roster.entries;
    assert13(new Set(entries.map((e) => e.playerId)).size === entries.length, "duplicate player source binding");
    const byId = new Map(players.map((p) => [p.playerId, p]));
    for (const entry of entries) {
      fields11(entry, ["playerId", "sourceId", "workbenchPlayer", "physical", "maximumPitchSpeedKmh", "heightMeters", "legacyRelativeRatings", "traitLabels"], ["playerId", "sourceId"], "entry");
      assert13(validText(entry.playerId) && validText(entry.sourceId) && byId.has(entry.playerId), "unknown player or source binding");
      assert13(!(Object.hasOwn(entry, "workbenchPlayer") && Object.hasOwn(entry, "physical")), "ambiguous physical authoring sources");
      if (Object.hasOwn(entry, "workbenchPlayer")) assert13(entry.workbenchPlayer && typeof entry.workbenchPlayer === "object", "invalid maker authoring source");
      if (Object.hasOwn(entry, "physical")) assert13(entry.physical && typeof entry.physical === "object", "invalid physical authoring source");
    }
    const auditPlayers = [];
    const output = players.map((player) => {
      const entry = entries.find((e) => e.playerId === player.playerId), projected = [], unsupported = [];
      let physical3 = { ...player.physical ?? LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 }, heightMeters = player.heightMeters;
      validatePhysical(physical3);
      let sourcePlayerId = null;
      const project = (inputPath, targetPath, value, conversion = "identity") => {
        projected.push({ inputPath, targetPath, value: cloneInert(value), conversion });
      };
      if (entry?.physical) {
        validatePhysical(entry.physical);
        physical3 = { ...physical3, ...entry.physical };
        for (const key3 of Object.keys(entry.physical).filter((k) => k !== "basis")) project("physical." + key3, key3, entry.physical[key3]);
      }
      if (entry?.workbenchPlayer) {
        const maker = createWorkbenchPlayer(entry.workbenchPlayer), c = maker.capability, s = maker.swing;
        sourcePlayerId = maker.identity.playerId;
        heightMeters = maker.body.heightMeters;
        physical3 = {
          ...physical3,
          batLengthM: maker.bat.lengthM,
          batMassKg: maker.bat.massKg,
          sweetSpotT: maker.bat.sweetSpotT,
          maximumSweetSpotSpeedMps: c.maximumSweetSpotSpeedMps,
          targetSweetSpotSpeedMps: s.speedMps,
          motorLatencySeconds: c.motorLatencyTicks / WORKBENCH_TICKS_PER_SECOND,
          technicalTimingOffsetSeconds: c.technicalTimingOffsetTicks / WORKBENCH_TICKS_PER_SECOND,
          timingStdSeconds: c.timingErrorTicks / WORKBENCH_TICKS_PER_SECOND,
          aimStdMeters: c.positionErrorMeters,
          topSpeedMps: c.runSpeedMps,
          throwSpeedMps: c.throwSpeedMps,
          releaseSpeedMps: c.pitchSpeedMps,
          attackAngleDegrees: s.attackAngleDeg,
          pullAngleDegrees: s.pullAngleDeg,
          swingDecision: maker.decision,
          badBallControl: maker.traits.badBallControl,
          preContactSeconds: s.preContactSeconds,
          followThroughSeconds: s.followThroughSeconds,
          contactDepthMeters: s.contactDepthM
        };
        const mappings = [
          ["body.heightMeters", "heightMeters"],
          ["bat.lengthM", "batLengthM"],
          ["bat.massKg", "batMassKg"],
          ["bat.sweetSpotT", "sweetSpotT"],
          ["capability.maximumSweetSpotSpeedMps", "maximumSweetSpotSpeedMps"],
          ["swing.speedMps", "targetSweetSpotSpeedMps"],
          ["capability.motorLatencyTicks", "motorLatencySeconds"],
          ["capability.technicalTimingOffsetTicks", "technicalTimingOffsetSeconds"],
          ["capability.timingErrorTicks", "timingStdSeconds"],
          ["capability.positionErrorMeters", "aimStdMeters"],
          ["capability.runSpeedMps", "topSpeedMps"],
          ["capability.throwSpeedMps", "throwSpeedMps"],
          ["capability.pitchSpeedMps", "releaseSpeedMps"],
          ["swing.attackAngleDeg", "attackAngleDegrees"],
          ["swing.pullAngleDeg", "pullAngleDegrees"],
          ["decision", "swingDecision"],
          ["traits.badBallControl", "badBallControl"],
          ["swing.preContactSeconds", "preContactSeconds"],
          ["swing.followThroughSeconds", "followThroughSeconds"],
          ["swing.contactDepthM", "contactDepthMeters"]
        ];
        for (const [from, to] of mappings) project("workbenchPlayer." + from, to, to === "heightMeters" ? heightMeters : physical3[to], from.endsWith("Ticks") ? "tick / 1000000" : "identity");
        for (const path of ["body.massKg", "swing.loadAngleDeg", "swing.finishAngleDeg", "swing.handTravelM"]) {
          const [group, key3] = path.split(".");
          unsupported.push({
            path: "workbenchPlayer." + path,
            value: maker[group][key3],
            reason: "No corresponding individual body/reference-trajectory motor consumer in this local Host; no inferred effect."
          });
        }
        for (const key3 of ["playerId", "name", "leagueId", "bats", "throws"]) unsupported.push({
          path: "workbenchPlayer.identity." + key3,
          value: maker.identity[key3],
          reason: "Ability-only binding keeps the selected match identity and handedness; this identity field is retained as source provenance, not applied."
        });
        maker.traits.labels.forEach((value, index) => unsupported.push({
          path: `workbenchPlayer.traits.labels[${index}]`,
          value,
          reason: "A display label does not supply a calibrated technical source or an extra physical bonus."
        }));
      }
      if (entry?.maximumPitchSpeedKmh !== void 0) {
        assert13(Number.isFinite(entry.maximumPitchSpeedKmh) && entry.maximumPitchSpeedKmh >= 54 && entry.maximumPitchSpeedKmh <= 306, "unsupported maximum pitch speed");
        const maximumPitchSpeedMps = entry.maximumPitchSpeedKmh / 3.6;
        assert13(physical3.maximumPitchSpeedMps === void 0 || physical3.maximumPitchSpeedMps === maximumPitchSpeedMps, "conflicting pitch speed limits");
        physical3 = { ...physical3, maximumPitchSpeedMps };
        project("maximumPitchSpeedKmh", "maximumPitchSpeedMps", maximumPitchSpeedMps, "km/h / 3.6");
      }
      if (entry?.heightMeters !== void 0) {
        assert13(Number.isFinite(entry.heightMeters) && entry.heightMeters >= 1.1 && entry.heightMeters <= 2.5, "unsupported physical height");
        assert13(!entry.workbenchPlayer || entry.workbenchPlayer.body.heightMeters === entry.heightMeters, "conflicting body heights");
        heightMeters = entry.heightMeters;
        project("heightMeters", "heightMeters", heightMeters);
      }
      if (entry?.legacyRelativeRatings !== void 0) {
        assert13(entry.legacyRelativeRatings && typeof entry.legacyRelativeRatings === "object" && !Array.isArray(entry.legacyRelativeRatings), "invalid relative ratings");
        for (const [key3, value] of Object.entries(entry.legacyRelativeRatings)) {
          assert13(validText(key3) && Number.isFinite(value), "invalid relative rating entry");
          unsupported.push({ path: "legacyRelativeRatings." + key3, value, reason: "Relative display rating has no calibrated SI inverse; preserved without physical conversion." });
        }
      }
      if (entry?.traitLabels !== void 0) {
        assert13(Array.isArray(entry.traitLabels) && entry.traitLabels.every(validText) && new Set(entry.traitLabels).size === entry.traitLabels.length, "invalid trait labels");
        entry.traitLabels.forEach((value, index) => unsupported.push({
          path: `traitLabels[${index}]`,
          value,
          reason: "Trait name alone is descriptive; an explicit current numerical source is required to execute its skill."
        }));
      }
      validatePhysical(physical3);
      assert13(heightMeters >= 1.1 && heightMeters <= 2.5, "unsupported physical height");
      const targetPaths = new Set(projected.map((p) => p.targetPath));
      auditPlayers.push({
        playerId: player.playerId,
        sourceId: entry?.sourceId ?? null,
        sourcePlayerId,
        projected,
        unsupported,
        referenceDefaultPaths: player.physical ? [] : Object.keys(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1).filter((k) => k !== "basis" && !targetPaths.has(k))
      });
      return { ...player, heightMeters, physical: physical3 };
    });
    return freeze21({ players: output, audit: {
      version: "live_physical_roster_projection_v1",
      sourceId: input.roster.sourceId,
      nativeAuthentication: false,
      projectionOnly: true,
      players: auditPlayers
    } });
  }

  // src/integration/browser/LivePublicAbilitiesV1.ts
  var up = (path) => ({ path, direction: 1, floor: 0 });
  var down = (path, floor) => ({ path, direction: -1, floor });
  var specs = [
    { id: "contact", label: "\u30DF\u30FC\u30C8", section: "batter", mode: "group", components: [down("aimStdMeters", 1e-3), down("timingStdSeconds", 1e-3)], note: "\u72D9\u3046\u4F4D\u7F6E\u3068\u30BF\u30A4\u30DF\u30F3\u30B0\u306E\u7CBE\u5EA6" },
    { id: "power", label: "\u30D1\u30EF\u30FC", section: "batter", mode: "group", components: [up("targetSweetSpotSpeedMps"), up("maximumSweetSpotSpeedMps")], note: "\u82AF\u306E\u76EE\u6A19\u901F\u5EA6\u3068\u6700\u5927\u901F\u5EA6" },
    { id: "vision", label: "\u9078\u7403\u773C", section: "batter", mode: "group", components: [down("zoneJudgmentStdMeters", 1e-3)], note: "\u30B3\u30FC\u30B9\u5224\u65AD\u306E\u7CBE\u5EA6\u3002\u7A4D\u6975\u6027\u306F\u8A73\u7D30\u3067\u5225\u306B\u8A2D\u5B9A" },
    { id: "badBallControl", label: "\u60AA\u7403\u3078\u306E\u6280\u8853", section: "batter", mode: "percent", components: [up("badBallControl")], note: "\u7AAE\u5C48\u306A\u4F53\u52E2\u3067\u306E\u5236\u5FA1\u3002\u632F\u308B\u5224\u65AD\u3068\u306F\u5225" },
    { id: "run", label: "\u8D70\u529B", section: "common", mode: "group", components: [up("topSpeedMps"), up("accelerationMps2")], note: "\u6700\u9AD8\u901F\u5EA6\u3068\u52A0\u901F" },
    { id: "arm", label: "\u80A9\u529B", section: "common", mode: "group", components: [up("throwSpeedMps")], note: "\u5B9F\u969B\u306E\u9001\u7403\u521D\u901F" },
    { id: "field", label: "\u5B88\u5099\u529B", section: "common", mode: "group", components: [down("reactionSeconds", 0.01), down("defensiveDecisionSeconds", 0.01), down("transferSeconds", 0.01)], note: "\u521D\u52D5\u30FB\u72B6\u6CC1\u5224\u65AD\u30FB\u6301\u3061\u66FF\u3048\u3002\u8D70\u529B\u3068\u6355\u7403\u306F\u5225" },
    { id: "catching", label: "\u6355\u7403", section: "common", mode: "group", components: [up("gloveSpeedMps"), up("retentionCapacityJ"), up("captureDissipationPowerW")], note: "\u30B0\u30E9\u30D6\u306E\u52D5\u4F5C\u3068\u885D\u6483\u306E\u5438\u53CE\u30FB\u4FDD\u6301" },
    { id: "throwingAccuracy", label: "\u9001\u7403\u7CBE\u5EA6", section: "common", mode: "group", components: [down("throwDirectionStdRadians", 1e-4)], note: "\u30EA\u30EA\u30FC\u30B9\u65B9\u5411\u306E\u7CBE\u5EA6" },
    { id: "maxSpeedKmh", label: "\u7403\u901F", section: "pitcher", mode: "pitchSpeed", components: [up("maximumPitchSpeedMps"), up("releaseSpeedMps")], note: "\u6700\u9AD8\u521D\u901F\u3002\u57FA\u6E96\u521D\u901F\u3068\u306E\u6BD4\u7387\u3092\u7DAD\u6301" },
    { id: "control", label: "\u5236\u7403", section: "pitcher", mode: "group", components: [down("commandStdMeters", 1e-3)], note: "\u6295\u7403\u306E\u72D9\u3044\u4F4D\u7F6E\u306E\u7CBE\u5EA6" }
  ];
  var policyId = "individual-profile-public-authoring-v1";
  var pointsPerLogUnit = 100;
  var assert14 = (value, message) => {
    if (!value) throw new Error("public abilities: " + message);
  };
  var freeze22 = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze22);
      Object.freeze(value);
    }
    return value;
  };
  var physical2 = (entry) => {
    assert14(entry.physical && !entry.workbenchPlayer && entry.maximumPitchSpeedKmh === void 0, "explicit SI entry without competing speed source required");
    return entry.physical;
  };
  function numeric(entry, path) {
    const value = physical2(entry)[path] ?? (path === "zoneJudgmentStdMeters" ? 0 : void 0);
    assert14(typeof value === "number" && Number.isFinite(value), "missing SI control: " + path);
    return value;
  }
  function context(input) {
    const reference = input.reference;
    assert14(reference?.version === "live_public_ability_reference_v1" && reference.policyId === policyId, "unsupported authoring reference");
    assert14(Array.isArray(reference.players) && Array.isArray(reference.anchors) && reference.players.length === reference.anchors.length && new Set(reference.anchors.map((a) => a.playerId)).size === reference.anchors.length, "invalid reference bindings");
    const ids2 = new Set(reference.players.map((p) => p.playerId));
    assert14(reference.anchors.every((a) => ids2.has(a.playerId) && a.entry.playerId === a.playerId && typeof a.leagueId === "string" && typeof a.role === "string" && specs.filter((s) => s.mode === "group").every((s) => Number.isFinite(a.ratings[s.id]) && a.ratings[s.id] >= 0 && a.ratings[s.id] <= 100)), "invalid reference anchor");
    applyLivePhysicalRosterV1({ players: reference.players, roster: input.roster });
    assert14(input.roster.entries.length === ids2.size && input.roster.entries.every((e) => ids2.has(e.playerId)), "complete reference roster required");
    applyLivePhysicalRosterV1({ players: reference.players, roster: { version: "live_physical_roster_v1", sourceId: policyId, entries: reference.anchors.map((a) => a.entry) } });
    const entry = input.roster.entries.find((e) => e.playerId === input.playerId), anchor = reference.anchors.find((a) => a.playerId === input.playerId);
    assert14(entry && anchor, "unknown player");
    return { entry, anchor };
  }
  function quality(entry, spec) {
    const components = spec.mode === "pitchSpeed" ? spec.components.slice(0, 1) : spec.components;
    return components.reduce((sum, c) => {
      const value = numeric(entry, c.path) + c.floor;
      assert14(value > 0, "nonpositive ability component: " + c.path);
      return sum + c.direction * Math.log(value);
    }, 0) / components.length;
  }
  function abilityValue(entry, anchor, spec) {
    if (spec.mode === "percent") return numeric(entry, spec.components[0].path) * 100;
    if (spec.mode === "pitchSpeed") return numeric(entry, spec.components[0].path) * 3.6;
    return anchor.ratings[spec.id] + pointsPerLogUnit * (quality(entry, spec) - quality(anchor.entry, spec));
  }
  function projectLivePublicAbilitiesV1(input) {
    const { entry, anchor } = context(input);
    return freeze22({ policyId, abilities: specs.map((spec) => ({
      id: spec.id,
      label: spec.label,
      section: spec.section,
      value: abilityValue(entry, anchor, spec),
      min: spec.mode === "pitchSpeed" ? 54 : 0,
      max: spec.mode === "pitchSpeed" ? 306 : 100,
      unit: spec.mode === "pitchSpeed" ? "km/h" : "",
      linkedPaths: spec.components.map((c) => c.path),
      note: spec.note
    })) });
  }
  function editLivePublicAbilityV1(input) {
    const projection = projectLivePublicAbilitiesV1(input), spec = specs.find((s) => s.id === input.abilityId), old = projection.abilities.find((a) => a.id === input.abilityId);
    assert14(spec && old && Number.isFinite(input.value), "invalid public ability value");
    assert14(input.value === old.value || input.value >= old.min && input.value <= old.max, "invalid public ability value");
    const copy2 = cloneInert(input.roster);
    const selected = copy2.entries.find((e) => e.playerId === input.playerId);
    const before = input.roster.entries.find((e) => e.playerId === input.playerId);
    const changes = [];
    if (input.value !== old.value) {
      for (const component of spec.components) {
        const previous = numeric(before, component.path);
        const next = spec.mode === "percent" ? input.value / 100 : spec.mode === "pitchSpeed" ? previous * input.value / old.value : (previous + component.floor) * Math.exp(component.direction * (input.value - old.value) / pointsPerLogUnit) - component.floor;
        assert14(Number.isFinite(next) && next >= 0, "requested value exceeds this individual profile; inspect detailed controls");
        selected.physical[component.path] = next;
        changes.push({ path: component.path, before: previous, after: next });
      }
      if (!selected.sourceId.split(":").includes("public-edited")) selected.sourceId += ":public-edited";
      copy2.sourceId = input.roster.sourceId.split(":").includes("public-edited") ? input.roster.sourceId : input.roster.sourceId + ":public-edited";
    }
    const roster = copy2;
    applyLivePhysicalRosterV1({ players: input.reference.players, roster });
    return freeze22({ policyId, roster, projection: projectLivePublicAbilitiesV1({ ...input, roster }), changes });
  }
  function previewLivePublicLeagueV1(input) {
    const { entry, anchor } = context(input);
    assert14(["MLB", "NLB", "NPB", "KBO", "CUSTOM"].includes(input.leagueId), "unsupported preview league");
    const candidates = input.reference.anchors.filter((a) => a.leagueId === input.leagueId);
    const byId = new Map(input.roster.entries.map((e) => [e.playerId, e]));
    return freeze22({ leagueId: input.leagueId, sampleCount: candidates.length, metrics: specs.map((spec) => {
      const peers = candidates.filter((a) => spec.section !== "pitcher" || a.role === "P").filter((a) => spec.section !== "batter" || a.role !== "P");
      const values2 = peers.map((a) => spec.mode === "percent" ? numeric(byId.get(a.playerId), spec.components[0].path) : quality(byId.get(a.playerId), spec));
      const mean = values2.reduce((sum, n) => sum + n, 0) / (values2.length || 1);
      const sd = Math.sqrt(values2.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (values2.length || 1));
      const actual = spec.mode === "percent" ? numeric(entry, spec.components[0].path) : quality(entry, spec);
      return {
        id: spec.id,
        label: spec.label,
        sampleCount: values2.length,
        value: values2.length >= 2 && sd > 0 ? Math.max(0, Math.min(100, 50 + 20 * (actual - mean) / sd)) : null
      };
    }), sourceLeagueId: anchor.leagueId, basis: "SUPPLIED_LOCAL_SAMPLE_NOT_OFFICIAL_LEAGUE_POPULATION" });
  }
  return __toCommonJS(browser_exports);
})();
