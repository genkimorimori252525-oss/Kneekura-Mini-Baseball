import { expect, it, vi } from 'vitest';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { ownedPhysicalPlanEncodingFixture } from './OwnedPhysicalPlanEncodingFixtures.test-support';
import * as canonical from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as acquisition from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';

const mutable = (value: unknown) => value as Record<string, any>;

it('canonicalizes one deeply immutable acquisition plan once while retaining every lineage and Core progress check', () => {
  const x = ownedPhysicalPlanEncodingFixture(), before = canonical.actorJson(x.prefix);
  const expected = battedWorldFieldPhysicalPrefix(structuredClone(x.prefix));
  const encodings = vi.spyOn(canonical, 'actorJson'), validations = vi.spyOn(acquisition, 'validateBattedWorldPiecewiseFieldAcquisitionProgress');
  try {
    expect(battedWorldFieldPhysicalPrefix(x.prefix)).toEqual(expected);
    expect(encodings.mock.calls.filter(([value]) => value === x.plan)).toHaveLength(1);
    expect(validations).toHaveBeenCalledTimes(x.count);
    encodings.mockClear(); validations.mockClear();
    expect(battedWorldFieldPhysicalPrefix(x.prefix)).toEqual(expected);
    expect(encodings.mock.calls.filter(([value]) => value === x.plan)).toHaveLength(1);
    expect(validations).toHaveBeenCalledTimes(x.count);
    expect(canonical.actorJson(x.prefix)).toBe(before);
  } finally { encodings.mockRestore(); validations.mockRestore(); }
});

it('keeps distinct equal plans separate instead of sharing by Source ID or canonical equality', () => {
  const x = ownedPhysicalPlanEncodingFixture(4, 'distinct'), expected = battedWorldFieldPhysicalPrefix(structuredClone(x.prefix));
  const encodings = vi.spyOn(canonical, 'actorJson');
  try {
    expect(battedWorldFieldPhysicalPrefix(x.prefix)).toEqual(expected);
    expect(encodings.mock.calls.filter(([value]) => x.plans.includes(value as never))).toHaveLength(x.count + 1);
  } finally { encodings.mockRestore(); }
});

it.each(['mutable', 'shallow'] as const)('does not memoize a %s operation plan', mode => {
  const x = ownedPhysicalPlanEncodingFixture(4, mode), encodings = vi.spyOn(canonical, 'actorJson');
  try {
    battedWorldFieldPhysicalPrefix(x.prefix);
    expect(encodings.mock.calls.filter(([value]) => value === x.plan)).toHaveLength(x.count * (x.count + 3));
  } finally { encodings.mockRestore(); }
});

it('observes mutable nested changes between same-call plan comparisons', () => {
  const x = ownedPhysicalPlanEncodingFixture(2, 'shallow'), original = canonical.actorJson;
  let changed = false;
  const spy = vi.spyOn(canonical, 'actorJson').mockImplementation(value => {
    const result = original(value);
    if (value === x.plan && !changed) { changed = true; mutable(x.plan).input.field.motion.world.moment.ball.velocity.x += 1; }
    return result;
  });
  try { expect(() => battedWorldFieldPhysicalPrefix(x.prefix)).toThrow(/original plan differs/); }
  finally { spy.mockRestore(); }
});

it.each(['accessor', 'cycle', 'oversized', 'nonfinite'] as const)('rejects an independent %s plan body at its encoding boundary', kind => {
  const x = ownedPhysicalPlanEncodingFixture(), copy = structuredClone(x.prefix);
  const operation = mutable(copy.executions[1].execution).operation;
  operation.plan = structuredClone(operation.plan); const invalid = operation.plan; let calls = 0;
  if (kind === 'accessor') Object.defineProperty(invalid, 'extra', { enumerable: true, get() { calls++; return 1; } });
  if (kind === 'cycle') invalid.extra = invalid;
  if (kind === 'oversized') invalid.extra = Array.from({ length: 100_001 }, () => 0);
  if (kind === 'nonfinite') invalid.extra = Infinity;
  Object.freeze(invalid);
  const spy = vi.spyOn(canonical, 'actorJson');
  try {
    expect(() => battedWorldFieldPhysicalPrefix(copy)).toThrow(/inert|accessor|cycle|size limits|finite/);
    expect(spy.mock.calls.some(([value]) => value === invalid)).toBe(true);
    expect(calls).toBe(0);
  } finally { spy.mockRestore(); }
  expect(() => battedWorldFieldPhysicalPrefix(x.prefix)).not.toThrow();
});

it('does not reuse a successful earlier-call plan when a same-Source immutable body changes', () => {
  const x = ownedPhysicalPlanEncodingFixture(), expected = battedWorldFieldPhysicalPrefix(x.prefix), changed = structuredClone(x.prefix);
  const operation = mutable(changed.executions[1].execution).operation;
  operation.plan = structuredClone(operation.plan); operation.plan.initialEnergyJ += 1;
  expect(() => battedWorldFieldPhysicalPrefix(canonical.actorFreeze(changed))).toThrow(/original plan differs|lineage/);
  expect(battedWorldFieldPhysicalPrefix(x.prefix)).toEqual(expected);
});

import * as encoders from './OwnedScheduledMotionDependencyEncoding';
import { fixture as coreFixture, throwInput } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory.test-support';
import { prepareBattedWorldPiecewiseFieldThrow } from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';

type Pair = Readonly<{ json: string; hash: string }>;
type PlanEncoding = Readonly<{ acquisition(value: object): Pair; throw(value: object): Pair }>;

it('isolates acquisition and throw encoding roles and new calls without changing canonical bytes', () => {
  expect(encoders).toHaveProperty('createOwnedScheduledMotionPlanEncoding');
  const create = Reflect.get(encoders, 'createOwnedScheduledMotionPlanEncoding') as () => PlanEncoding;
  const a = ownedPhysicalPlanEncodingFixture().plan;
  const { availableAtTick: _a, throughTick: _t, commands: _c, ...throwing } = throwInput(coreFixture());
  const t = prepareBattedWorldPiecewiseFieldThrow(throwing);
  const expected = [a, t].map(value => ({ json: canonical.actorJson(value), hash: canonical.actorHash(value) }));
  const scope = create(), calls = vi.spyOn(canonical, 'actorJson');
  try {
    const first = scope.acquisition(a), second = scope.throw(t);
    expect(first).toEqual(expected[0]); expect(second).toEqual(expected[1]);
    expect(scope.acquisition(a)).toBe(first); expect(scope.throw(t)).toBe(second);
    expect(calls).toHaveBeenCalledTimes(2);
    // This utility provides inert canonicalization, not domain acceptance.
    expect(scope.throw(a)).toEqual(first); expect(scope.throw(a)).not.toBe(first);
    expect(calls).toHaveBeenCalledTimes(3);
    expect(create().acquisition(a)).toEqual(first); expect(calls).toHaveBeenCalledTimes(4);
    expect(Object.isFrozen(first)).toBe(true);
  } finally { calls.mockRestore(); }
});

import { ownedPhysicalThrowEncodingFixture } from './OwnedPhysicalPlanEncodingFixtures.test-support';
import * as throwing from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';

it('rejects forged later acquisition progress after the shared plan cache is warm', () => {
  const x = ownedPhysicalPlanEncodingFixture(), changed = structuredClone(x.prefix);
  const last = mutable(changed.executions.at(-1)!.execution).operation;
  last.progress.world.moment.ball.velocity.x += 1;
  canonical.actorFreeze(changed);
  const encoded = vi.spyOn(canonical, 'actorJson'), validated = vi.spyOn(acquisition, 'validateBattedWorldPiecewiseFieldAcquisitionProgress');
  try {
    expect(() => battedWorldFieldPhysicalPrefix(changed)).toThrow(/progress differs/);
    expect(encoded.mock.calls.filter(([value]) => value === last.plan)).toHaveLength(1);
    expect(validated).toHaveBeenCalledTimes(x.count);
    expect(validated.mock.calls.at(-1)![0].progress).toBe(last.progress);
  } finally { encoded.mockRestore(); validated.mockRestore(); }
});

it('retains throw memo hits and every Core check, including forged progress after warming', () => {
  const x = ownedPhysicalThrowEncodingFixture(), expected = battedWorldFieldPhysicalPrefix(structuredClone(x.prefix));
  const encoded = vi.spyOn(canonical, 'actorJson'), validated = vi.spyOn(throwing, 'validateBattedWorldPiecewiseFieldThrowProgress');
  try {
    expect(canonical.actorJson(battedWorldFieldPhysicalPrefix(x.prefix))).toBe(canonical.actorJson(expected));
    expect(encoded.mock.calls.filter(([value]) => value === x.plan)).toHaveLength(1);
    expect(validated).toHaveBeenCalledTimes(x.count);
    encoded.mockClear(); validated.mockClear();
    const changed = structuredClone(x.prefix), last = mutable(changed.executions.at(-1)!.execution).operation;
    last.progress.field.motion.world.moment.ball.velocity.x += 1;
    canonical.actorFreeze(changed);
    expect(() => battedWorldFieldPhysicalPrefix(changed)).toThrow(/progress differs/);
    expect(encoded.mock.calls.filter(([value]) => value === last.plan)).toHaveLength(1);
    expect(validated).toHaveBeenCalledTimes(x.count);
    expect(validated.mock.calls.at(-1)![0].progress).toBe(last.progress);
  } finally { encoded.mockRestore(); validated.mockRestore(); }
});
