import { describe, expect, it } from 'vitest';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { applyLivePhysicalRosterV1, getLiveInternalValueLimitsV82, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { createWorkbenchPlayer, defaultWorkbenchPlayer, getWorkbenchInternalValueLimitsV82 } from './WorkbenchPlayer';
import { suggestLiveInternalValueV82, suggestWorkbenchInternalValueV82 } from './MakerValueRecoveryV82';

const players = [{ playerId: 'batter-a', name: 'Authored player', heightMeters: 1.8, bats: 'R' as const }];
const roster = (): LivePhysicalRosterInputV1 => ({ version: 'live_physical_roster_v1', sourceId: 'recovery-test', entries: [
  { playerId: 'batter-a', sourceId: 'authored-source', heightMeters: 1.8,
    physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, maximumSweetSpotSpeedMps: 40, targetSweetSpotSpeedMps: 34.5,
      spinRadPerSecond: { x: 100, y: 900, z: 0 } } },
] });
const live = (path: string, value: number, entryPath = false, packet = roster()) => suggestLiveInternalValueV82({
  players, roster: packet, playerId: 'batter-a', path, value, entryPath,
});

describe('explicit maker internal-value recovery', () => {
  it('returns the nearest scalar limit and preserves every other authored value and source', () => {
    const packet = roster(), before = structuredClone(packet);
    for (const [value, suggestedValue] of [[3.1, 3], [.1, .2]]) {
      const result = live('batLengthM', value, false, packet);
      expect(result).toMatchObject({ version: 82, status: 'ADJUSTED', requestedValue: value, suggestedValue,
        minimum: .2, maximum: 3, minimumInclusive: true, maximumInclusive: true,
        changes: [{ path: 'batLengthM', before: .84, after: suggestedValue }] });
      const expected = structuredClone(packet);
      (expected.entries[0].physical as { batLengthM: number }).batLengthM = suggestedValue;
      expect(result.roster).toEqual(expected);
      expect(() => applyLivePhysicalRosterV1({ players, roster: result.roster })).not.toThrow();
      expect(Object.isFrozen(result.roster?.entries[0].physical)).toBe(true);
    }
    expect(packet).toEqual(before);
  });

  it('uses live height bounds independently of bat length and keeps accepted precision', () => {
    expect(live('heightMeters', 3, true)).toMatchObject({ status: 'ADJUSTED', suggestedValue: 2.5, minimum: 1.1, maximum: 2.5 });
    expect(live('heightMeters', .5, true)).toMatchObject({ status: 'ADJUSTED', suggestedValue: 1.1 });
    expect(live('batLengthM', .847123456789)).toMatchObject({ status: 'VALID', suggestedValue: .847123456789 });
    expect(live('batLengthM', .84)).toMatchObject({ status: 'VALID', changes: [] });
  });

  it('keeps the other swing-speed value fixed at either relational boundary', () => {
    const target = live('targetSweetSpotSpeedMps', 90), ceiling = live('maximumSweetSpotSpeedMps', .1);
    expect(target).toMatchObject({ status: 'ADJUSTED', suggestedValue: 40, maximum: 40 });
    expect(ceiling).toMatchObject({ status: 'ADJUSTED', suggestedValue: 34.5, minimum: 34.5 });
    expect(target.roster?.entries[0].physical?.maximumSweetSpotSpeedMps).toBe(40);
    expect(ceiling.roster?.entries[0].physical?.targetSweetSpotSpeedMps).toBe(34.5);
  });

  it('finds a validated one-component spin boundary in both directions', () => {
    const boundary = Math.sqrt(1200 ** 2 - 900 ** 2);
    for (const value of [900, -1800]) {
      const result = live('spinRadPerSecond.x', value);
      expect(result.status).toBe('ADJUSTED');
      expect(result.suggestedValue).toBeCloseTo(Math.sign(value) * boundary, 10);
      const spin = result.roster!.entries[0].physical!.spinRadPerSecond!;
      expect(spin.y).toBe(900); expect(spin.z).toBe(0);
      expect(Math.hypot(spin.x, spin.y, spin.z)).toBeLessThanOrEqual(1200);
      expect(() => applyLivePhysicalRosterV1({ players, roster: result.roster })).not.toThrow();
      const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, Math.abs(spin.x));
      bytes.setBigUint64(0, bytes.getBigUint64(0) + 1n);
      const beyond = structuredClone(result.roster!);
      (beyond.entries[0].physical!.spinRadPerSecond as { x: number }).x = Math.sign(value) * bytes.getFloat64(0);
      expect(() => applyLivePhysicalRosterV1({ players, roster: beyond })).toThrow(/spin/);
    }
  });

  it('resolves the true accepted spin endpoint even when the mathematical remaining radius is zero', () => {
    const packet = roster();
    (packet.entries[0].physical as { spinRadPerSecond: { x: number; y: number; z: number } }).spinRadPerSecond = { x: 0, y: 1200, z: 0 };
    const result = live('spinRadPerSecond.x', 1, false, packet);
    expect(result.status).toBe('ADJUSTED');
    expect(result.suggestedValue).toBeGreaterThanOrEqual(0);
    expect(result.suggestedValue).toBeLessThan(1);
    expect(() => applyLivePhysicalRosterV1({ players, roster: result.roster })).not.toThrow();
    const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, result.suggestedValue!);
    bytes.setBigUint64(0, bytes.getBigUint64(0) + 1n);
    const beyond = structuredClone(result.roster!);
    (beyond.entries[0].physical!.spinRadPerSecond as { x: number }).x = bytes.getFloat64(0);
    expect(() => applyLivePhysicalRosterV1({ players, roster: beyond })).toThrow(/spin/);
  });

  it('preserves an omitted default exactly on a no-op and authors only the requested field on an edit', () => {
    const packet: LivePhysicalRosterInputV1 = { version: 'live_physical_roster_v1', sourceId: 'sparse', entries: [
      { playerId: 'batter-a', sourceId: 'sparse-source', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1' } },
    ] };
    const same = live('batLengthM', .84, false, packet);
    expect(same).toMatchObject({ status: 'VALID', changes: [] });
    expect(same.roster).toEqual(packet);
    const edited = live('batLengthM', 4, false, packet);
    expect(edited.roster!.entries[0].physical).toEqual({ basis: 'EXPLICIT_AUTHORED_SI_V1', batLengthM: 3 });
    expect(packet.entries[0].physical).toEqual({ basis: 'EXPLICIT_AUTHORED_SI_V1' });
  });

  it('does not invent catalog maxima or quantize continuous SI to catalog increments', () => {
    for (const [path, value] of [['topSpeedMps', 30], ['topSpeedMps', .05], ['reactionSeconds', 2], ['accelerationMps2', 100]] as const) {
      expect(live(path, value)).toMatchObject({ status: 'VALID', suggestedValue: value, maximum: null });
    }
    expect(live('topSpeedMps', 0)).toMatchObject({ status: 'ADJUSTED', suggestedValue: Number.MIN_VALUE,
      minimum: 0, minimumInclusive: false, maximum: null });
  });

  it('keeps limits read-only and preserves the distinct workbench limits', () => {
    expect(getLiveInternalValueLimitsV82('batLengthM')).toMatchObject({ minimum: .2, maximum: 3 });
    expect(getLiveInternalValueLimitsV82('heightMeters', true)).toMatchObject({ minimum: 1.1, maximum: 2.5 });
    expect(getWorkbenchInternalValueLimitsV82('body.heightMeters')).toMatchObject({ minimum: .8, maximum: 3 });
    const limits = getLiveInternalValueLimitsV82('batLengthM')!;
    expect(Object.isFrozen(limits)).toBe(true);
    expect(() => { (limits as { maximum: number }).maximum = 100; }).toThrow();
    expect(getLiveInternalValueLimitsV82('__proto__')).toBeNull();
    expect(getWorkbenchInternalValueLimitsV82('constructor')).toBeNull();
  });

  it('returns unavailable for unsupported paths or an invalid accepted baseline', () => {
    expect(live('inventedPhysicalField', 3)).toMatchObject({ status: 'UNAVAILABLE', suggestedValue: null, changes: [] });
    const packet = roster();
    (packet.entries[0].physical as { targetSweetSpotSpeedMps: number }).targetSweetSpotSpeedMps = 41;
    expect(live('batLengthM', 3.1, false, packet)).toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'BASE_INVALID', changes: [] });
  });

  it('requires finite inert requests and never reads a getter as a numeric field', () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(() => live('batLengthM', value)).toThrow();
    let reads = 0;
    const packet = roster();
    Object.defineProperty(packet.entries[0].physical, 'batLengthM', { enumerable: true, get: () => { reads++; return .84; } });
    expect(() => live('batLengthM', 3.1, false, packet)).toThrow(/accessors/);
    expect(reads).toBe(0);
    const request = { players, roster: roster(), playerId: 'batter-a', path: 'batLengthM', get value() { reads++; return 3.1; } };
    expect(() => suggestLiveInternalValueV82(request)).toThrow(/accessors/);
    expect(reads).toBe(0);
  });

  it('uses workbench bounds and nearest tick integers without changing other values', () => {
    const player = defaultWorkbenchPlayer(), before = structuredClone(player);
    for (const [path, value, suggestedValue] of [
      ['body.heightMeters', .1, .8], ['bat.massKg', .01, .05], ['capability.motorLatencyTicks', .1, 1],
      ['capability.motorLatencyTicks', 5.8, 6], ['capability.technicalTimingOffsetTicks', -5.8, -6],
      ['capability.timingErrorTicks', 500001, 500000],
    ] as const) {
      const result = suggestWorkbenchInternalValueV82({ player, path, value });
      expect(result).toMatchObject({ status: 'ADJUSTED', suggestedValue });
      expect(() => createWorkbenchPlayer(result.player)).not.toThrow();
      expect(result.changes).toHaveLength(1);
    }
    expect(player).toEqual(before);
  });

  it('retains the other workbench speed and reports unsupported or invalid players', () => {
    const player = defaultWorkbenchPlayer();
    expect(suggestWorkbenchInternalValueV82({ player, path: 'swing.speedMps', value: 90 }))
      .toMatchObject({ status: 'ADJUSTED', suggestedValue: 45, maximum: 45 });
    expect(suggestWorkbenchInternalValueV82({ player, path: 'capability.maximumSweetSpotSpeedMps', value: .1 }))
      .toMatchObject({ status: 'ADJUSTED', suggestedValue: player.swing.speedMps, minimum: player.swing.speedMps });
    expect(suggestWorkbenchInternalValueV82({ player, path: 'identity.name', value: 4 }))
      .toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'UNSUPPORTED_PATH' });
    const bad = { ...player, swing: { ...player.swing, speedMps: 91 } };
    expect(suggestWorkbenchInternalValueV82({ player: bad, path: 'bat.lengthM', value: 4 }))
      .toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'BASE_INVALID' });
  });
});
