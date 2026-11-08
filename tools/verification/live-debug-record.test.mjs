import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeDebugRecord, decodeDebugRecord, firstDebugDifference, stringifyDebugRecord, parseDebugRecord } from './live-debug-record.mjs';

test('round trips actual numbers, undefined and marker-like user data without rounding', () => {
  const value = { minusZero: -0, positiveZero: 0, missing: undefined, array: [NaN, Infinity, -Infinity],
    userValue: { $auditSpecial: 'undefined' }, float: 1 + Number.EPSILON };
  assert.deepEqual(decodeDebugRecord(JSON.parse(JSON.stringify(encodeDebugRecord(value)))), value);
  assert.notDeepEqual(encodeDebugRecord(value), encodeDebugRecord({ ...value, minusZero: 0 }));
  assert.throws(() => encodeDebugRecord({ sampler() {} }), /record data/);
});

test('the compact wire format leaves ordinary numeric arrays unexpanded and preserves exceptional data', () => {
  const ordinary = { samples: Array.from({ length: 10000 }, (_, i) => i / 100) };
  assert.equal(stringifyDebugRecord(ordinary), JSON.stringify(ordinary));
  const special = { negativeZero: -0, missing: undefined, infinite: Infinity, nan: NaN,
    user: { $liveDebugValue: ['number', '-0'] }, nested: [undefined, -Infinity, 'NaN'] };
  assert.deepEqual(parseDebugRecord(stringifyDebugRecord(special)), special);
  assert.throws(() => stringifyDebugRecord({ value: new Date() }), /record data/);
  assert.throws(() => stringifyDebugRecord({ value() {} }), /record data/);
});

test('finds the first changed field and its frame tick, including signed zero', () => {
  const a = { frames: [{ tick: 100, ball: { x: -0, y: 1 } }] };
  const b = { frames: [{ tick: 100, ball: { x: 0, y: 1 } }] };
  assert.deepEqual(firstDebugDifference(a, b), { path: '$.frames[0].ball.x', tick: 100,
    expected: ['number', '-0'], actual: ['number', '0'] });
  assert.equal(firstDebugDifference(a, structuredClone(a)), null);
  assert.equal(firstDebugDifference({ optional: undefined }, {}).path, '$');
});

test('rejects a malformed tagged record instead of silently recovering it', () => {
  assert.throws(() => decodeDebugRecord(['unknown', 3]), /invalid debug record/);
  assert.throws(() => decodeDebugRecord(['number', 'garbage']), /invalid debug record/);
});
