import { expect, it } from 'vitest';
import {
  decideLiveRunnerAdvanceV1,
  estimateLiveRunnerLegSecondsV1,
  type LiveRunnerAdvanceInputV1,
} from './LiveRunnerAdvancePolicyV1';

const fixture = (): LiveRunnerAdvanceInputV1 => ({
  nowSeconds: 3,
  playStartedAtSeconds: 0,
  currentBase: 2,
  distanceToNextBaseMeters: 27.432,
  targetOccupied: false,
  runner: { topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .2 },
  forced: false,
  firstGroundContactElapsedSeconds: 1,
  firstFielderTouchElapsedSeconds: null,
  defenderControlSeconds: 8,
});

it('uses the same accelerate, coast and brake duration as the actual stop-to-stop runner leg', () => {
  expect(estimateLiveRunnerLegSecondsV1(27.432, 8, 5)).toBeCloseTo(27.432 / 8 + 8 / 5, 12);
  // A short leg never reaches top speed and has no coasting phase.
  expect(estimateLiveRunnerLegSecondsV1(1, 8, 5)).toBeCloseTo(2 * Math.sqrt(1 / 5), 12);
  expect(estimateLiveRunnerLegSecondsV1(0, 8, 5)).toBe(0);
});

it('advances a legal elective runner when the physical race exceeds the safety margin', () => {
  const input = fixture(), before = JSON.stringify(input), decision = decideLiveRunnerAdvanceV1(input);
  expect(decision).toMatchObject({ advance: true, reason: 'safe_race_advance', readyAtElapsedSeconds: 1.2 });
  expect(decision.runnerArrivalSeconds).toBeCloseTo(5.029, 12);
  expect(decision.raceMarginSeconds).toBeCloseTo(8 - 5.029, 12);
  expect(JSON.stringify(input)).toBe(before);
  expect(Object.isFrozen(decision)).toBe(true);
});

it('uses the legal first fielder touch and its recognition delay without requiring a secured catch', () => {
  const input = { ...fixture(), firstGroundContactElapsedSeconds: null, firstFielderTouchElapsedSeconds: 5,
    nowSeconds: 5.19 };
  expect(decideLiveRunnerAdvanceV1(input)).toMatchObject({ advance: false, reason: 'recognizing_departure_cue', readyAtElapsedSeconds: 5.2 });
  expect(decideLiveRunnerAdvanceV1({ ...input, nowSeconds: 5.2 })).toMatchObject({ advance: true, reason: 'safe_race_advance' });
});

it('waits for a legal departure cue and recognizes new evidence relative to its occurrence', () => {
  const raw = fixture();
  expect(decideLiveRunnerAdvanceV1({ ...raw, firstGroundContactElapsedSeconds: null })).toMatchObject({ advance: false, reason: 'awaiting_legal_departure', readyAtElapsedSeconds: null });
  const input = { ...raw, nowSeconds: 3.1, firstGroundContactElapsedSeconds: 3 };
  expect(decideLiveRunnerAdvanceV1(input)).toMatchObject({ advance: false, readyAtElapsedSeconds: 3.2 });
  expect(decideLiveRunnerAdvanceV1({ ...input, nowSeconds: 3.2, policy: { recognitionSeconds: .1 } })).toMatchObject({ advance: false, readyAtElapsedSeconds: 3.3 });
  expect(decideLiveRunnerAdvanceV1({ ...input, nowSeconds: 3.3, policy: { recognitionSeconds: .1 } }).advance).toBe(true);
});

it('keeps an elective runner when actual acceleration or a faster defense loses the race', () => {
  const raw = fixture();
  expect(decideLiveRunnerAdvanceV1({ ...raw, defenderControlSeconds: 5.2 })).toMatchObject({ advance: false, reason: 'insufficient_safety_margin' });
  expect(decideLiveRunnerAdvanceV1({ ...raw, runner: { ...raw.runner, accelerationMps2: 1 } }).advance).toBe(false);
  expect(decideLiveRunnerAdvanceV1({ ...raw, runner: { ...raw.runner, topSpeedMps: 3 } }).advance).toBe(false);
});

it('tunes shared risk margin independently of player ability and never calls a tie safe', () => {
  const raw = fixture(), defenderControlSeconds = 5.529;
  expect(decideLiveRunnerAdvanceV1({ ...raw, defenderControlSeconds, policy: { safetyMarginSeconds: .4 } }).advance).toBe(true);
  expect(decideLiveRunnerAdvanceV1({ ...raw, defenderControlSeconds, policy: { safetyMarginSeconds: .6 } }).advance).toBe(false);
  const runnerSeconds = estimateLiveRunnerLegSecondsV1(raw.distanceToNextBaseMeters, raw.runner.topSpeedMps, raw.runner.accelerationMps2);
  expect(decideLiveRunnerAdvanceV1({ ...raw, defenderControlSeconds: runnerSeconds, policy: { safetyMarginSeconds: 0 } }).advance).toBe(false);
});

it('lets batter, legal force and awards bypass elective race uncertainty', () => {
  const raw = fixture(), uncertain = { ...raw, defenderControlSeconds: null };
  expect(decideLiveRunnerAdvanceV1(uncertain)).toMatchObject({ advance: false, reason: 'no_defense_forecast' });
  expect(decideLiveRunnerAdvanceV1({ ...uncertain, currentBase: 0, firstGroundContactElapsedSeconds: null })).toMatchObject({ advance: true, reason: 'batter_advance' });
  expect(decideLiveRunnerAdvanceV1({ ...uncertain, forced: true })).toMatchObject({ advance: true, reason: 'forced_advance' });
  expect(decideLiveRunnerAdvanceV1({ ...uncertain, firstGroundContactElapsedSeconds: null, awardThroughBase: 4 })).toMatchObject({ advance: true, reason: 'award_advance' });
  expect(decideLiveRunnerAdvanceV1({ ...uncertain, firstGroundContactElapsedSeconds: null, forced: true })).toMatchObject({ advance: false, reason: 'awaiting_legal_departure' });
  expect(decideLiveRunnerAdvanceV1({ ...uncertain, awardThroughBase: 2 })).toMatchObject({ advance: false, reason: 'no_defense_forecast' });
});

it('never departs into an occupied target, including forced runners, batters and awards', () => {
  const raw = { ...fixture(), targetOccupied: true };
  for (const patch of [{}, { forced: true }, { currentBase: 0 as const }, { awardThroughBase: 4 as const }]) {
    expect(decideLiveRunnerAdvanceV1({ ...raw, ...patch })).toMatchObject({ advance: false, reason: 'target_occupied' });
  }
});

it('never treats a pending fly catch as a force and recognizes the ground cue before a force bypass', () => {
  const raw = { ...fixture(), forced: true, firstGroundContactElapsedSeconds: null, firstFielderTouchElapsedSeconds: 1 };
  expect(decideLiveRunnerAdvanceV1({ ...raw, defenderControlSeconds: null })).toMatchObject({ advance: false, reason: 'no_defense_forecast' });
  expect(decideLiveRunnerAdvanceV1(raw)).toMatchObject({ advance: true, reason: 'safe_race_advance' });
  expect(decideLiveRunnerAdvanceV1({ ...raw, firstGroundContactElapsedSeconds: 2.9 })).toMatchObject({
    advance: false, reason: 'recognizing_departure_cue', readyAtElapsedSeconds: 3.1,
  });
  expect(decideLiveRunnerAdvanceV1({ ...raw, firstGroundContactElapsedSeconds: 2.8, defenderControlSeconds: 0 }))
    .toMatchObject({ advance: true, reason: 'forced_advance' });
});

it('does not confuse a known unreachable defense with a missing forecast', () => {
  expect(decideLiveRunnerAdvanceV1({ ...fixture(), defenderControlSeconds: Infinity })).toMatchObject({ advance: true, raceMarginSeconds: Infinity });
});

it('runs on contact with two outs, with reaction and target occupancy still respected', () => {
  const raw = { ...fixture(), outs: 2 as const, firstGroundContactElapsedSeconds: null, defenderControlSeconds: 0 };
  expect(decideLiveRunnerAdvanceV1(raw)).toMatchObject({ advance: true, reason: 'two_out_advance', readyAtElapsedSeconds: .2 });
  expect(decideLiveRunnerAdvanceV1({ ...raw, nowSeconds: .1 })).toMatchObject({ advance: false, reason: 'recognizing_departure_cue' });
  expect(decideLiveRunnerAdvanceV1({ ...raw, targetOccupied: true })).toMatchObject({ advance: false, reason: 'target_occupied' });
});

it('resumes ordinary advance risk after a two-out ball is grounded or touched', () => {
  const raw = { ...fixture(), outs: 2 as const, defenderControlSeconds: 0 };
  expect(decideLiveRunnerAdvanceV1(raw)).toMatchObject({ advance: false, reason: 'insufficient_safety_margin' });
  expect(decideLiveRunnerAdvanceV1({ ...raw, firstGroundContactElapsedSeconds: null, firstFielderTouchElapsedSeconds: 1 }))
    .toMatchObject({ advance: false, reason: 'insufficient_safety_margin' });
  expect(decideLiveRunnerAdvanceV1({ ...raw, forced: true })).toMatchObject({ advance: true, reason: 'forced_advance' });
});

it('rejects invalid SI, policy, clocks and future facts instead of manufacturing an advance', () => {
  const raw = fixture();
  for (const patch of [
    { distanceToNextBaseMeters: -1 }, { defenderControlSeconds: NaN }, { defenderControlSeconds: -1 },
    { nowSeconds: -1 }, { playStartedAtSeconds: 4 }, { firstGroundContactElapsedSeconds: 4 },
    { firstFielderTouchElapsedSeconds: -.1 }, { policy: { safetyMarginSeconds: -1 } },
    { policy: { recognitionSeconds: Infinity } }, { runner: { ...raw.runner, accelerationMps2: 0 } },
  ]) expect(() => decideLiveRunnerAdvanceV1({ ...raw, ...patch })).toThrow(/live runner advance/);
});
