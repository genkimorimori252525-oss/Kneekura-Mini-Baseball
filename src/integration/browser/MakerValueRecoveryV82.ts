import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { applyLivePhysicalRosterV1, getLiveInternalValueLimitsV82, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import type { LivePlayerV1 } from './LiveBaseballMatchV1';
import { createWorkbenchPlayer, getWorkbenchInternalValueLimitsV82, type WorkbenchPlayer } from './WorkbenchPlayer';

type Limits = { minimum: number | null; maximum: number | null; minimumInclusive: boolean; maximumInclusive: boolean; integer: boolean };
export type MakerValueRecoveryV82 = Readonly<{
  version: 82; status: 'VALID' | 'ADJUSTED' | 'UNAVAILABLE'; requestedValue: number; suggestedValue: number | null;
  minimum: number | null; maximum: number | null; minimumInclusive: boolean; maximumInclusive: boolean; reasonCode: string;
  changes: readonly Readonly<{ path: string; before: number; after: number }>[];
  roster?: LivePhysicalRosterInputV1; player?: WorkbenchPlayer;
}>;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const read = (object: unknown, path: string): unknown => path.split('.').reduce<unknown>((value, key) =>
  value && typeof value === 'object' && Object.hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined, object);
const write = (object: unknown, path: string, value: number): boolean => {
  const keys = path.split('.'), last = keys.pop()!, parent = keys.reduce<unknown>((node, key) =>
    node && typeof node === 'object' && Object.hasOwn(node, key) ? (node as Record<string, unknown>)[key] : undefined, object);
  if (!parent || typeof parent !== 'object') return false;
  (parent as Record<string, unknown>)[last] = value;
  return true;
};
/** One adjacent finite binary64 value, without applying a catalog/UI step. */
const adjacent = (value: number, direction: number): number => {
  if (value === direction) return value;
  if (value === 0) return direction > 0 ? Number.MIN_VALUE : -Number.MIN_VALUE;
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value);
  const bits = bytes.getBigUint64(0), increase = direction > value;
  bytes.setBigUint64(0, bits + (increase === (value > 0) ? 1n : -1n));
  return bytes.getFloat64(0);
};
const unavailable = (value: number, reasonCode: string, limits?: Limits): MakerValueRecoveryV82 => freeze({ version: 82,
  status: 'UNAVAILABLE', requestedValue: value, suggestedValue: null, minimum: limits?.minimum ?? null,
  maximum: limits?.maximum ?? null, minimumInclusive: limits?.minimumInclusive ?? false,
  maximumInclusive: limits?.maximumInclusive ?? false, reasonCode, changes: [] });
const finiteRequest = (value: unknown): void => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('maker recovery requires a finite numeric value');
};

function recover<T>(input: { path: string; value: number; before: number; limits: Limits; reasonCode?: string;
  spinBoundary?: boolean; candidate: (value: number) => T | null; result: (candidate: T) => Pick<MakerValueRecoveryV82, 'roster' | 'player'> }): MakerValueRecoveryV82 {
  const { path, value, before, limits } = input;
  const accepted = (candidateValue: number): T | null => {
    try { return input.candidate(candidateValue); } catch { return null; }
  };
  const finish = (candidateValue: number, candidate: T, status: 'VALID' | 'ADJUSTED', reasonCode: string): MakerValueRecoveryV82 => freeze({
    version: 82, status, requestedValue: value, suggestedValue: candidateValue, minimum: limits.minimum, maximum: limits.maximum,
    minimumInclusive: limits.minimumInclusive, maximumInclusive: limits.maximumInclusive, reasonCode,
    changes: candidateValue === before ? [] : [{ path, before, after: candidateValue }], ...input.result(candidate),
  });
  const direct = accepted(value);
  if (direct !== null) return finish(value, direct, 'VALID', 'VALID');
  const low = limits.minimum === null ? -Number.MAX_VALUE : limits.minimumInclusive ? limits.minimum : adjacent(limits.minimum, Infinity);
  const high = limits.maximum === null ? Number.MAX_VALUE : limits.maximumInclusive ? limits.maximum : adjacent(limits.maximum, -Infinity);
  let next = Math.max(low, Math.min(high, limits.integer ? Math.round(value) : value));
  if (low > high || !Number.isFinite(next) || next === value && !input.spinBoundary) return unavailable(value, 'VALIDATOR_REJECTED', limits);
  const reason = input.reasonCode ?? (value < low ? 'BELOW_MINIMUM' : value > high ? 'ABOVE_MAXIMUM' : 'INTEGER_REQUIRED');
  let candidate = accepted(next);
  if (input.spinBoundary) {
    // With the other two components fixed, hypot is monotone in this axis's
    // magnitude. Search binary64 order to end at an accepted value adjacent to
    // a rejection, including roundoff near a zero sqrt boundary. No other
    // physical/trajectory constraint is assumed to be monotone.
    if (candidate === null) { next = 0; candidate = accepted(next); }
    if (candidate === null || Math.abs(next) >= Math.abs(value)) return unavailable(value, 'VALIDATOR_REJECTED', limits);
    const bytes = new DataView(new ArrayBuffer(8));
    const bits = (n: number): bigint => { bytes.setFloat64(0, n); return bytes.getBigUint64(0); };
    const number = (n: bigint): number => { bytes.setBigUint64(0, n); return bytes.getFloat64(0); };
    let acceptedBits = bits(Math.abs(next)), rejectedBits = bits(Math.abs(value));
    while (rejectedBits - acceptedBits > 1n) {
      const middle = (acceptedBits + rejectedBits) / 2n, trial = Math.sign(value) * number(middle), checked = accepted(trial);
      if (checked === null) rejectedBits = middle;
      else { acceptedBits = middle; next = trial; candidate = checked; }
    }
    limits.minimum = -Math.abs(next); limits.maximum = Math.abs(next);
    return finish(next, candidate, 'ADJUSTED', reason);
  }
  return candidate === null ? unavailable(value, 'VALIDATOR_REJECTED', limits) : finish(next, candidate, 'ADJUSTED', reason);
}

/** Suggests only one existing SI/entry field; it never commits the candidate. */
export function suggestLiveInternalValueV82(input: Readonly<{ players: readonly LivePlayerV1[]; roster: LivePhysicalRosterInputV1;
  playerId: string; path: string; value: number; entryPath?: boolean }>): MakerValueRecoveryV82 {
  const clean = cloneInert(input);
  finiteRequest(clean.value);
  const rawLimits = getLiveInternalValueLimitsV82(clean.path, clean.entryPath);
  if (!rawLimits) return unavailable(clean.value, 'UNSUPPORTED_PATH');
  const limits: Limits = { ...rawLimits };
  let projected: ReturnType<typeof applyLivePhysicalRosterV1>;
  try { projected = applyLivePhysicalRosterV1({ players: clean.players, roster: clean.roster }); }
  catch { return unavailable(clean.value, 'BASE_INVALID', limits); }
  const entry = clean.roster.entries.find(row => row.playerId === clean.playerId), player = projected.players.find(row => row.playerId === clean.playerId);
  if (!entry || !player) return unavailable(clean.value, 'PLAYER_NOT_FOUND', limits);
  if (entry.workbenchPlayer || !clean.entryPath && !entry.physical) return unavailable(clean.value, 'FIELD_UNAVAILABLE', limits);
  const source = clean.entryPath ? entry : entry.physical, effective = clean.entryPath ? player : player.physical;
  const before = read(source, clean.path) ?? read(effective, clean.path);
  if (typeof before !== 'number' || !Number.isFinite(before)) return unavailable(clean.value, 'FIELD_UNAVAILABLE', limits);
  let reasonCode: string | undefined;
  if (!clean.entryPath && clean.path === 'targetSweetSpotSpeedMps' && player.physical.maximumSweetSpotSpeedMps !== undefined) {
    limits.maximum = Math.min(limits.maximum!, player.physical.maximumSweetSpotSpeedMps);
    if (clean.value > limits.maximum) reasonCode = 'SWING_SPEED_CEILING';
  }
  if (!clean.entryPath && clean.path === 'maximumSweetSpotSpeedMps' && player.physical.targetSweetSpotSpeedMps !== undefined) {
    limits.minimum = Math.max(limits.minimum!, player.physical.targetSweetSpotSpeedMps);
    if (clean.value < limits.minimum) reasonCode = 'SWING_SPEED_CEILING';
  }
  const spinBoundary = !clean.entryPath && clean.path.startsWith('spinRadPerSecond.');
  if (spinBoundary) {
    const spin = player.physical.spinRadPerSecond, axis = clean.path.split('.')[1], others = Object.entries(spin).filter(([key]) => key !== axis).map(([, n]) => n);
    const otherMagnitude = Math.hypot(...others), radius = limits.maximum!;
    const boundary = Math.sqrt(Math.max(0, (radius - otherMagnitude) * (radius + otherMagnitude)));
    limits.minimum = -boundary; limits.maximum = boundary; reasonCode = 'SPIN_MAGNITUDE_LIMIT';
  }
  return recover({ path: clean.path, value: clean.value, before, limits, reasonCode, spinBoundary,
    candidate: value => {
      const candidate = cloneInert(clean.roster), selected = candidate.entries.find(row => row.playerId === clean.playerId)!;
      if (value !== before && !write(clean.entryPath ? selected : selected.physical, clean.path, value)) return null;
      applyLivePhysicalRosterV1({ players: clean.players, roster: candidate });
      return candidate;
    }, result: candidate => ({ roster: candidate }) });
}

export function suggestWorkbenchInternalValueV82(input: Readonly<{ player: WorkbenchPlayer; path: string; value: number }>): MakerValueRecoveryV82 {
  const clean = cloneInert(input);
  finiteRequest(clean.value);
  const rawLimits = getWorkbenchInternalValueLimitsV82(clean.path);
  if (!rawLimits) return unavailable(clean.value, 'UNSUPPORTED_PATH');
  const limits: Limits = { ...rawLimits };
  let player: WorkbenchPlayer;
  try { player = createWorkbenchPlayer(clean.player); } catch { return unavailable(clean.value, 'BASE_INVALID', limits); }
  const before = read(player, clean.path);
  if (typeof before !== 'number') return unavailable(clean.value, 'FIELD_UNAVAILABLE', limits);
  let reasonCode: string | undefined;
  if (clean.path === 'swing.speedMps') {
    limits.maximum = player.capability.maximumSweetSpotSpeedMps;
    if (clean.value > limits.maximum) reasonCode = 'SWING_SPEED_CEILING';
  }
  if (clean.path === 'capability.maximumSweetSpotSpeedMps') {
    limits.minimum = player.swing.speedMps;
    if (clean.value < limits.minimum) reasonCode = 'SWING_SPEED_CEILING';
  }
  return recover({ path: clean.path, value: clean.value, before, limits, reasonCode,
    candidate: value => { const candidate = cloneInert(player); return write(candidate, clean.path, value) ? createWorkbenchPlayer(candidate) : null; },
    result: candidate => ({ player: candidate }) });
}
