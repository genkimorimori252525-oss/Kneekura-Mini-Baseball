import { expect, it } from 'vitest';
import { resolveBattingDirectionRequestV149, validateBattingDirectionRequestV149 } from './BattingDirectionRequestV149';

const request = (mode: 'AUTO' | 'PULL' | 'CENTER' | 'OPPOSITE') => ({
  version: 'batting_direction_request_v149' as const, sourceId: 'practice-direction', mode });
const reactive = { kind: 'REACTIVE' as const, aim: null, pullAngleDegrees: null, fieldAngleDegrees: null };
const opposite = { kind: 'AIMED' as const, aim: 'OPPOSITE' as const, pullAngleDegrees: -25, fieldAngleDegrees: 25 };
const base = { bats: 'R' as const, selectedAtTick: 1000000 };

it('uses a one-pitch reactive request without inventing an unobserved personal preference', () => {
  const r = resolveBattingDirectionRequestV149({ ...base, request: request('AUTO') });
  expect(r).toMatchObject({ mode: 'AUTO', owner: 'OBSERVATION_RESPONSE', reason: 'NO_AUTHORED_DIRECTION_PREFERENCE',
    direction: reactive, persistentPreferenceChanged: false, postContactResultOverride: false });
});

it('preserves authored reactive/aimed directions and old five-sector choices on AUTO', () => {
  for (const personalDirection of [reactive, opposite]) {
    const input = { ...base, request: request('AUTO'), personalDirection }, before = JSON.stringify(input);
    const r = resolveBattingDirectionRequestV149(input);
    expect(r.owner).toBe('PERSONAL_APPROACH'); expect(r.direction).toEqual(personalDirection);
    expect(JSON.stringify(input)).toBe(before); expect(Object.isFrozen(input)).toBe(false);
  }
  const legacyDirection = { sectorIndex: 4, fieldAngleDegrees: 36, pullAngleDegrees: -36 };
  const r = resolveBattingDirectionRequestV149({ ...base, request: request('AUTO'), legacyDirection });
  expect(r.owner).toBe('LEGACY_DIRECTION_DISTRIBUTION');
  expect(r.direction).toMatchObject({ kind: 'LEGACY_SECTOR', fieldAngleDegrees: 36, pullAngleDegrees: -36 });
});

it('lets a temporary manual request override even a zero-weight authored direction without saving it', () => {
  const targets = { pull: 31, center: 0, opposite: -25 };
  const input = { ...base, request: request('PULL'), personalDirection: opposite, targetPullAnglesDegrees: targets };
  const before = JSON.stringify(input), r = resolveBattingDirectionRequestV149(input);
  expect(r).toMatchObject({ owner: 'TEMPORARY_REQUEST', targetBasis: 'AUTHORED_DIRECTION_TARGET',
    direction: { kind: 'AIMED', aim: 'PULL', pullAngleDegrees: 31, fieldAngleDegrees: -31 } });
  expect(JSON.stringify(input)).toBe(before);
  expect(resolveBattingDirectionRequestV149({ ...input, request: request('AUTO') }).direction).toEqual(opposite);
});

it.each(['R', 'L'] as const)('mirrors %s manual operation targets without introducing random draws', bats => {
  for (const [mode, angle] of [['PULL', 20], ['CENTER', 0], ['OPPOSITE', -20]] as const) {
    const r = resolveBattingDirectionRequestV149({ ...base, bats, request: request(mode) });
    expect(r.direction.pullAngleDegrees).toBe(angle);
    expect(r.direction.fieldAngleDegrees).toBe(-angle * (bats === 'R' ? 1 : -1));
    expect(r.targetBasis).toBe('DEFAULT_OPERATION_TARGET_NOT_MEASURED');
    expect(r.postContactResultOverride).toBe(false);
  }
});

it('rejects malformed request fields, including hidden opponent/result inputs', () => {
  for (const value of [null, { ...request('AUTO'), mode: 'random' }, { ...request('AUTO'), sourceId: '' },
    { ...request('AUTO'), actualPitchType: 'curve' }, { ...request('PULL'), exitVelocity: { x: 1, y: 0, z: 0 } }])
    expect(() => validateBattingDirectionRequestV149(value)).toThrow(/方向/);
});
