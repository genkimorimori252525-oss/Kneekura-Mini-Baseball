import type { OfficialStateApplicationReceipt } from '../../core/adjudication/NextPlayActivation';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot, DefenderWorldState } from '../../core/model/CanonicalWorldSnapshot';
import type { RigidBaseballProperties, RigidBatBallContactParameters, RigidBatBallContactResult } from '../../core/sim/contact/RigidBatBallContact';
import { sampleCompatibilityBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { sampleSwingStateV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { createCanonicalPlateAppearanceTimeline, type CanonicalPlateAppearanceEvent, type CanonicalPlateAppearanceStatus, type CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { applyStrikeoutPlateAppearanceToMatchState, applyWalkPlateAppearanceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import { resolveAerodynamicRigidBatSwing, type RigidBatSwingWindow } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import type { AerodynamicRigidPitchAgainstBatterInput } from '../../core/sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { sampleAerodynamicPitchTrajectory, type AerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { resolveAerodynamicTakenPitchPhysicalResult } from '../../core/sim/pitching/AerodynamicTakenPitchPhysicalResult';
import { adaptRigidBatBallContactToCanonicalContact } from '../../core/sim/pitching/RigidBatContactCanonicalAdapter';
import { recordSwingingPitchPhysicalResult } from '../../core/sim/pitching/SwingingPitchTimelineAdapter';
import { recordTakenPitchPhysicalResult } from '../../core/sim/pitching/TakenPitchTimelineAdapter';
import type { StrikeZoneRegion } from '../../core/sim/pitching/TakenPitchPhysicalResult';
import type { CanonicalPresentationSample } from '../../presentation/mini/model';
import { MINI_PRESENTATION_CADENCE_MICROS } from '../../presentation/mini/model';
import { buildMiniPresentationTimeline, createMiniPresentationSampleSchedule } from '../../presentation/mini/MiniPresentationTimeline';
import type { NativeAerodynamicIssuedPitch } from './NativeAerodynamicSession';

export const NATIVE_IMMUTABLE_REPLAY_LEDGER_VERSION = 1 as const;
export const NATIVE_IMMUTABLE_REPLAY_DIGEST_ALGORITHM = 'sha256' as const;
const SCHEMA = 'native-aerodynamic-accepted-replay' as const;
const MAX_PITCHES = 64;

export type NativeReplayStoredAction =
  | Readonly<{ kind: 'take'; plateZ: number; strikeZone: StrikeZoneRegion; ballRadiusMeters: number }>
  | Readonly<{
      kind: 'swing';
      swing: RigidBatSwingWindow;
      ball: RigidBaseballProperties;
      /** Materialized from the original physical resolver; null for an actual miss. */
      impactParameters: RigidBatBallContactParameters | null;
    }>;

export type NativeReplayPitchClock = Readonly<{
  acceptedAtTick: number;
  sourceStartTick: number;
  sourceEndTick: number;
  ticksPerSecond: number;
  integrationStepTicks: number;
  canonicalBeforeTick: number;
  canonicalAfterTick: number;
  observationStopTick: number;
}>;

export type NativeReplayPitchEntry = Readonly<{
  kind: 'accepted_pitch';
  version: 1;
  ordinal: number;
  sourceId: string;
  commandSession: NativeAerodynamicIssuedPitch['commandSession'];
  trajectory: AerodynamicPitchTrajectory;
  action: NativeReplayStoredAction;
  clock: NativeReplayPitchClock;
  phase: NativeAerodynamicIssuedPitch['phase'];
  statusAfter: CanonicalPlateAppearanceStatus;
  events: readonly CanonicalPlateAppearanceEvent[];
  samples: readonly CanonicalPresentationSample[];
  handedness: Readonly<{ batter: 'R' | 'L'; pitcher: 'R' | 'L' }>;
  camera: 'BATTER_POV' | 'PITCHER_POV';
  rigidContact: RigidBatBallContactResult | null;
  previousDigest: string;
  digest: string;
}>;

/** Never created by pitch simulation. The original Native official application owner supplies it. */
export type NativeReplayOfficialReceiptEntry = Readonly<{
  kind: 'external_official_receipt';
  version: 1;
  pitchOrdinal: number;
  /** An external source-provided tick in the same Native canonical clock. */
  receivedAtTick: number;
  receipt: OfficialStateApplicationReceipt;
  previousDigest: string;
  digest: string;
}>;

export type NativeImmutableReplayEntry = NativeReplayPitchEntry | NativeReplayOfficialReceiptEntry;

/** JSON-compatible IndexedDB payload. No callbacks, DB handles, DOM, or native runtime objects. */
export type NativeImmutableReplayLedgerDTO = Readonly<{
  schema: typeof SCHEMA;
  version: typeof NATIVE_IMMUTABLE_REPLAY_LEDGER_VERSION;
  digestAlgorithm: typeof NATIVE_IMMUTABLE_REPLAY_DIGEST_ALGORITHM;
  initialMatch: CanonicalMatchState;
  startedAtTick: number;
  entries: readonly NativeImmutableReplayEntry[];
  headDigest: string;
}>;

export type NativeReplayAppendPitchInput = Readonly<{
  issued: NativeAerodynamicIssuedPitch;
  /** Actual physical Source ID; uniqueness is enforced within the PA. */
  sourceId: string;
  /** The exact input supplied to Native Aero/Rigid Core, including resolver for contact. */
  actualPitch: AerodynamicRigidPitchAgainstBatterInput;
}>;

const safeTick = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const sourceIdValid = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.trim() === id;
const isDigest = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

/**
 * Clone/freeze inert JSON data without getters, prototypes, cycles or undefined
 * array elements. Core may legitimately produce undefined optional OBJECT
 * fields; only capture-time cloning omits those. Parsed persistence is strict.
 */
function inertCopy<T>(input: T, capture = false): T {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (value: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > 150_000 || depth > 64) throw new Error('Native replay DTO exceeds inert data limits.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Native replay DTO contains non-finite numbers.');
      return value === 0 ? 0 : value;
    }
    if (typeof value !== 'object') throw new Error('Native replay DTO accepts pure data only.');
    if (ancestors.has(value)) throw new Error('Native replay DTO cannot contain cycles.');
    ancestors.add(value);
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) throw new Error('Native replay DTO requires dense arrays.');
      const list: unknown[] = [];
      for (let i = 0; i < value.length; i += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error('Native replay DTO cannot contain getters or sparse arrays.');
        }
        list.push(visit(descriptor.value, depth + 1));
      }
      ancestors.delete(value);
      return Object.freeze(list);
    }
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error('Native replay DTO requires plain objects.');
    }
    const record: Record<string, unknown> = {};
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string')) throw new Error('Native replay DTO rejects symbol keys.');
    for (const key of (keys as string[]).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw new Error('Native replay DTO cannot contain getters.');
      }
      if (descriptor.value === undefined && capture) continue;
      Object.defineProperty(record, key, {
        value: visit(descriptor.value, depth + 1),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    ancestors.delete(value);
    return Object.freeze(record);
  };
  return visit(input, 0) as T;
}

const stableJSON = (value: unknown, capture = false): string => JSON.stringify(inertCopy(value, capture));
const identical = (a: unknown, b: unknown): boolean => stableJSON(a, true) === stableJSON(b, true);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('Native immutable replay: ' + message);
}
const exactKeys = (value: unknown, keys: readonly string[], label: string): void => {
  assert(typeof value === 'object' && value !== null && !Array.isArray(value), label + ' must be a record.');
  assert(identical(Object.keys(value).sort(), [...keys].sort()), label + ' has unexpected or missing fields.');
};

function isTakeInput(
  input: AerodynamicRigidPitchAgainstBatterInput,
): input is Extract<AerodynamicRigidPitchAgainstBatterInput, { action: { kind: 'take' } }> {
  return input.action.kind === 'take';
}

/** No global crypto, TextEncoder, Node, WebCrypto, or browser APIs. Pure UTF-8. */
function utf8(value: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const first = value.charCodeAt(i);
    let cp = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(++i);
      if (!(second >= 0xdc00 && second <= 0xdfff)) throw new Error('Native replay rejects invalid UTF-16.');
      cp = 0x10000 + ((first - 0xd800) << 10) + second - 0xdc00;
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      throw new Error('Native replay rejects invalid UTF-16.');
    }
    if (cp <= 0x7f) out.push(cp);
    else if (cp <= 0x7ff) out.push(0xc0 | (cp >>> 6), 0x80 | (cp & 63));
    else if (cp <= 0xffff) out.push(0xe0 | (cp >>> 12), 0x80 | ((cp >>> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >>> 18), 0x80 | ((cp >>> 12) & 63), 0x80 | ((cp >>> 6) & 63), 0x80 | (cp & 63));
  }
  return Uint8Array.from(out);
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;
const rotr = (v: number, shift: number): number => (v >>> shift) | (v << (32 - shift));

/** Stable standard SHA-256 over canonical UTF-8 JSON; integrity, not source authentication. */
export function digestNativeReplayData(value: unknown): string {
  const bytes = utf8(stableJSON(value));
  if (bytes.length > 16_000_000) throw new Error('Native replay digest input is too large.');
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  for (let i = 0; i < 8; i += 1) data[paddedLength - 1 - i] = Math.floor(bitLength / (2 ** (8 * i))) & 0xff;
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] = ((data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15];
      const y = w[i - 2];
      const small0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const small1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + small0 + w[i - 7] + small1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const big1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (hh + big1 + choice + K[i] + w[i]) >>> 0;
      const big0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (big0 + majority) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    for (const [index, value] of [a, b, c, d, e, f, g, hh].entries()) h[index] = (h[index] + value) >>> 0;
  }
  return h.map(value => value.toString(16).padStart(8, '0')).join('');
}

const genesisDigest = (match: CanonicalMatchState, startedAtTick: number): string =>
  digestNativeReplayData({ domain: SCHEMA + '/genesis/v1', match, startedAtTick });

function entryDigest(entry: unknown): string {
  return digestNativeReplayData({ domain: SCHEMA + '/entry/v1', entry });
}

export function createNativeImmutableReplayLedger(input: Readonly<{
  initialMatch: CanonicalMatchState;
  startedAtTick: number;
}>): NativeImmutableReplayLedgerDTO {
  const initialMatch = inertCopy(input.initialMatch, true);
  createCanonicalPlateAppearanceTimeline(initialMatch, input.startedAtTick);
  return verifyNativeImmutableReplayLedger(inertCopy({
    schema: SCHEMA,
    version: NATIVE_IMMUTABLE_REPLAY_LEDGER_VERSION,
    digestAlgorithm: NATIVE_IMMUTABLE_REPLAY_DIGEST_ALGORITHM,
    initialMatch,
    startedAtTick: input.startedAtTick,
    entries: [],
    headDigest: genesisDigest(initialMatch, input.startedAtTick),
  }));
}

function validateWorldActors(world: CanonicalWorldSnapshot): void {
  exactKeys(world, ['tick', 'defenders', 'runners', 'ball'], 'world snapshot');
  assert(Array.isArray(world.defenders) && Array.isArray(world.runners), 'real actor arrays are required.');
  const playerIds = new Set<string>();
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const isPosition = (value: unknown): value is { x: number; z: number } => {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as { x: number; z: number };
    return finite(v.x) && finite(v.z);
  };
  const validatePosition = (value: unknown, label: string): void => {
    assert(isPosition(value), 'invalid physical ' + label + ' coordinates.');
    exactKeys(value, ['x', 'z'], label);
  };
  const register = (playerId: string): void => {
    assert(sourceIdValid(playerId) && !playerIds.has(playerId), 'actor identity must be nonempty and unique.');
    playerIds.add(playerId);
  };
  for (const defender of world.defenders) {
    exactKeys(defender, ['playerId', 'registeredPosition', 'position', 'velocity', 'assignment'], 'defender');
    register(defender.playerId);
    assert(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].includes(defender.registeredPosition), 'invalid defender position.');
    validatePosition(defender.position, 'defender position');
    validatePosition(defender.velocity, 'defender velocity');
    const assignment: DefenderWorldState['assignment'] = defender.assignment;
    assert(assignment !== null && typeof assignment === 'object', 'invalid defensive assignment.');
    switch (assignment.kind) {
      case 'hold':
      case 'ball_handler':
        exactKeys(assignment, ['kind'], 'defender assignment');
        break;
      case 'base_cover':
        exactKeys(assignment, ['kind', 'base'], 'defender assignment');
        assert([1, 2, 3, 4].includes(assignment.base), 'invalid covered base.');
        break;
      case 'relay':
      case 'backup':
      case 'deep_coverage':
        exactKeys(assignment, ['kind', 'target'], 'defender assignment');
        validatePosition(assignment.target, 'fielding target');
        break;
      default:
        throw new Error('Native immutable replay: unrecognized defender assignment.');
    }
  }
  for (const runner of world.runners) {
    exactKeys(runner, ['playerId', 'position', 'velocity'], 'runner');
    register(runner.playerId);
    validatePosition(runner.position, 'runner position');
    validatePosition(runner.velocity, 'runner velocity');
  }
}

function replayPhysicalPitch(
  before: CanonicalPlateAppearanceTimeline,
  entry: NativeReplayPitchEntry,
): CanonicalPlateAppearanceTimeline {
  const { trajectory, action } = entry;
  if (action.kind === 'take') {
    exactKeys(action, ['kind', 'plateZ', 'strikeZone', 'ballRadiusMeters'], 'source take action');
    const physical = resolveAerodynamicTakenPitchPhysicalResult({
      trajectory, plateZ: action.plateZ, strikeZone: action.strikeZone,
      ballRadiusMeters: action.ballRadiusMeters,
    });
    assert(entry.rigidContact === null, 'a taken pitch cannot possess rigid contact.');
    if (physical === null) {
      assert(entry.phase === 'unresolved', 'a pitch with no physical plate crossing must remain unresolved.');
      return before;
    }
    assert(entry.phase !== 'unresolved', 'a genuine physical plate crossing cannot be unresolved.');
    return recordTakenPitchPhysicalResult(before, physical);
  }
  exactKeys(action, ['kind', 'swing', 'ball', 'impactParameters'], 'source swing action');
  const physical = resolveAerodynamicRigidBatSwing({
    trajectory,
    swing: action.swing,
    ball: action.ball,
    parameterResolver: () => {
      assert(action.impactParameters !== null, 'a physical impact requires source contact parameters.');
      return action.impactParameters;
    },
  });
  assert(entry.phase !== 'unresolved', 'a rigid swing must carry a canonical physical result.');
  if (physical.kind === 'contact') {
    assert(action.impactParameters !== null, 'rigid collision parameters were not recorded.');
    assert(identical(entry.rigidContact, physical.contact), 'rigid collision differs from the actual source replay.');
    return recordSwingingPitchPhysicalResult(before, {
      kind: 'contact',
      contact: adaptRigidBatBallContactToCanonicalContact(physical.contact),
    });
  }
  assert(action.impactParameters === null && entry.rigidContact === null, 'a physical miss cannot retain impact evidence.');
  return recordSwingingPitchPhysicalResult(before, {
    kind: 'swinging_miss', adjudicationTick: physical.adjudicationTick,
  });
}

function verifySnapshots(entry: NativeReplayPitchEntry): void {
  const { trajectory, clock, rigidContact, action, samples, events } = entry;
  assert(entry.handedness.batter === 'R' || entry.handedness.batter === 'L', 'invalid batter handedness.');
  assert(entry.handedness.pitcher === 'R' || entry.handedness.pitcher === 'L', 'invalid pitcher handedness.');
  assert(entry.camera === 'BATTER_POV' || entry.camera === 'PITCHER_POV', 'invalid Native pitch camera.');
  const stopTick = rigidContact?.tick ?? trajectory.endTick;
  assert(clock.observationStopTick === stopTick, 'source physical contact observation boundary was altered.');
  const cadence = Math.max(1, Math.round(MINI_PRESENTATION_CADENCE_MICROS
    * trajectory.parameters.ticksPerSecond / 1_000_000));
  const ticks = createMiniPresentationSampleSchedule(
    trajectory.start.tick, stopTick, cadence, events,
  );
  assert(samples.length === ticks.length, 'canonical physical sample schedule was truncated or expanded.');
  for (let i = 0; i < ticks.length; i += 1) {
    const tick = ticks[i];
    const sample = samples[i];
    exactKeys(sample, ['world', 'batter', 'pitcherHandedness'], 'canonical presentation sample');
    assert(sample.world.tick === tick, 'physical sample must preserve exact source clock tick.');
    validateWorldActors(sample.world);
    assert(sample.pitcherHandedness === entry.handedness.pitcher, 'pitcher source handedness changed.');
    const actual = sampleAerodynamicPitchTrajectory(trajectory, tick);
    const ball = rigidContact !== null && tick === rigidContact.tick
      ? { position: rigidContact.ballCenter, velocity: rigidContact.exitVelocity, spin: rigidContact.exitSpin }
      : { position: actual.position, velocity: actual.velocity, spin: actual.spin };
    assert(identical(sample.world.ball, ball), 'stored canonical ball sample differs from physical source flight.');
    const pose = action.kind === 'swing' && tick >= action.swing.startTick && tick <= action.swing.endTick
      ? (action.swing.kinematicsV1 !== undefined
          ? sampleSwingStateV1(action.swing.kinematicsV1, tick).pose
          : sampleCompatibilityBatterSwingState(
              action.swing.stateAtStart, tick - action.swing.startTick, action.swing.ticksPerSecond,
            ).pose)
      : null;
    const expectedBatter = {
      handedness: entry.handedness.batter,
      action: pose === null ? 'idle' : 'normal_swing',
      bat: pose,
    };
    assert(identical(sample.batter, expectedBatter), 'stored bat pose differs from genuine physical swing source.');
  }
  const frames = buildMiniPresentationTimeline(samples, events, entry.camera);
  assert(frames.length === samples.length && frames.every(frame => frame.cameraMode === entry.camera),
    'pitch-only replay cannot invent a live field camera or extra frames.');
}

type ReplayCursor = Readonly<{
  timeline: CanonicalPlateAppearanceTimeline;
  lastPitch: NativeReplayPitchEntry | null;
  stopped: boolean;
}>;

function replayLedger(dto: NativeImmutableReplayLedgerDTO): ReplayCursor {
  exactKeys(dto, ['schema', 'version', 'digestAlgorithm', 'initialMatch', 'startedAtTick', 'entries', 'headDigest'], 'ledger');
  assert(dto.schema === SCHEMA && dto.version === 1 && dto.digestAlgorithm === 'sha256',
    'unsupported Native immutable replay version or digest algorithm.');
  assert(Array.isArray(dto.entries) && dto.entries.length <= MAX_PITCHES + 1, 'too many replay entries.');
  assert(safeTick(dto.initialMatch.playId) && typeof dto.initialMatch.ruleProfileId === 'string',
    'invalid initial Native Match identity.');
  exactKeys(dto.initialMatch, [
    'ruleProfileId', 'inning', 'half', 'outs', 'balls', 'strikes', 'bases', 'score', 'playId',
  ], 'initial Native Match');
  exactKeys(dto.initialMatch.bases, ['first', 'second', 'third'], 'initial base occupancy');
  exactKeys(dto.initialMatch.score, ['away', 'home'], 'initial score');
  assert(dto.initialMatch.half === 'top' || dto.initialMatch.half === 'bottom', 'invalid initial half-inning.');
  assert(safeTick(dto.initialMatch.inning) && dto.initialMatch.inning > 0
    && safeTick(dto.initialMatch.outs) && dto.initialMatch.outs <= 2
    && safeTick(dto.initialMatch.score.away) && safeTick(dto.initialMatch.score.home),
    'invalid initial Native Match inning, outs or score.');
  let timeline = createCanonicalPlateAppearanceTimeline(dto.initialMatch, dto.startedAtTick);
  let previousDigest = genesisDigest(dto.initialMatch, dto.startedAtTick);
  let lastPitch: NativeReplayPitchEntry | null = null;
  let stopped = false;
  let hasReceipt = false;
  const usedSources = new Set<string>();
  for (const item of dto.entries as readonly NativeImmutableReplayEntry[]) {
    assert(item.version === 1 && item.previousDigest === previousDigest,
      'digest chain has a missing, reordered, or altered link.');
    const { digest, ...entryWithoutDigest } = item;
    assert(isDigest(digest) && digest === entryDigest(entryWithoutDigest),
      'replay entry integrity digest mismatch.');
    previousDigest = digest;
    if (item.kind === 'accepted_pitch') {
      exactKeys(item, [
        'kind', 'version', 'ordinal', 'sourceId', 'commandSession', 'trajectory', 'action', 'clock',
        'phase', 'statusAfter', 'events', 'samples', 'handedness', 'camera', 'rigidContact', 'previousDigest', 'digest',
      ], 'accepted pitch');
      assert(!stopped && !hasReceipt && timeline.status.kind === 'active',
        'another pitch after an unresolved or terminal Native play is forbidden.');
      assert(safeTick(item.ordinal) && item.ordinal === usedSources.size, 'duplicate or out-of-order pitch ordinal.');
      assert(sourceIdValid(item.sourceId) && !usedSources.has(item.sourceId), 'duplicate or invalid physical Source ID.');
      usedSources.add(item.sourceId);
      const session = item.commandSession;
      exactKeys(session, ['playId', 'batterRunnerId', 'acceptedAtTick', 'matchSeed', 'command'], 'accepted command');
      assert(session.playId === dto.initialMatch.playId && sourceIdValid(session.batterRunnerId)
        && Number.isSafeInteger(session.matchSeed) && session.acceptedAtTick === timeline.lastEventTick,
        'command provenance differs from canonical acceptance tick.');
      if (lastPitch) {
        assert(session.matchSeed === lastPitch.commandSession.matchSeed
          && session.batterRunnerId === lastPitch.commandSession.batterRunnerId,
          'a one-PA replay cannot change batter or match seed.');
      }
      const clock = item.clock;
      exactKeys(clock, [
        'acceptedAtTick', 'sourceStartTick', 'sourceEndTick', 'ticksPerSecond', 'integrationStepTicks',
        'canonicalBeforeTick', 'canonicalAfterTick', 'observationStopTick',
      ], 'source/canonical clock');
      const { start, endTick, parameters } = item.trajectory;
      assert(safeTick(start.tick) && safeTick(endTick) && endTick >= start.tick
        && safeTick(parameters.ticksPerSecond) && parameters.ticksPerSecond > 0
        && safeTick(parameters.integrationStepTicks) && parameters.integrationStepTicks > 0,
        'invalid physical source clock.');
      assert(clock.acceptedAtTick === session.acceptedAtTick
        && clock.sourceStartTick === start.tick && clock.sourceEndTick === endTick
        && clock.ticksPerSecond === parameters.ticksPerSecond
        && clock.integrationStepTicks === parameters.integrationStepTicks
        && clock.canonicalBeforeTick === timeline.lastEventTick
        && start.tick >= timeline.lastEventTick
        && (lastPitch === null || start.tick > lastPitch.clock.sourceEndTick),
        'source clock crossed a canonical event boundary or overlapped an earlier flight.');
      const before = timeline;
      const after = replayPhysicalPitch(before, item);
      const expectedEvents = after.events.slice(before.events.length);
      assert(identical(item.events, expectedEvents)
        && identical(item.statusAfter, after.status)
        && item.clock.canonicalAfterTick === after.lastEventTick,
        'accepted events, physical contact, count, or chronology disagree with Native Core replay.');
      assert(item.events.every((event, i) => event.sequence === before.nextSequence + i
        && event.tick >= start.tick && event.tick <= endTick
        && (i === 0 || event.tick >= item.events[i - 1].tick)),
        'invalid canonical physical event chronology.');
      const expectedPhase = expectedEvents.length === 0 ? 'unresolved' : after.status.kind;
      assert(item.phase === expectedPhase && (item.phase !== 'unresolved' || item.events.length === 0),
        'pitch completion phase diverged from the real canonical count.');
      verifySnapshots(item);
      timeline = after;
      lastPitch = item;
      stopped = item.phase !== 'active';
    } else if (item.kind === 'external_official_receipt') {
      exactKeys(item, [
        'kind', 'version', 'pitchOrdinal', 'receivedAtTick', 'receipt', 'previousDigest', 'digest',
      ], 'external official receipt');
      assert(lastPitch !== null && !hasReceipt && stopped && lastPitch.phase !== 'unresolved'
        && item.pitchOrdinal === lastPitch.ordinal, 'official receipt must bind exactly one terminal accepted pitch.');
      assert(safeTick(item.receivedAtTick) && item.receivedAtTick >= lastPitch.clock.sourceEndTick,
        'external receipt clock must follow its source flight.');
      const receipt = item.receipt;
      exactKeys(receipt, ['applicationId', 'closureId', 'previousPlayId', 'durableRevision', 'appliedMatchState'],
        'external Native official receipt');
      assert(sourceIdValid(receipt.applicationId) && sourceIdValid(receipt.closureId)
        && safeTick(receipt.durableRevision) && receipt.previousPlayId === dto.initialMatch.playId,
        'external official receipt identity does not bind this Native play.');
      assert(receipt.appliedMatchState.ruleProfileId === dto.initialMatch.ruleProfileId
        && receipt.appliedMatchState.playId === dto.initialMatch.playId + 1,
        'external official receipt next Match identity differs.');
      exactKeys(receipt.appliedMatchState, [
        'ruleProfileId', 'inning', 'half', 'outs', 'balls', 'strikes', 'bases', 'score', 'playId',
      ], 'external applied Match');
      exactKeys(receipt.appliedMatchState.bases, ['first', 'second', 'third'], 'external applied bases');
      exactKeys(receipt.appliedMatchState.score, ['away', 'home'], 'external applied score');
      assert(receipt.appliedMatchState.half === 'top' || receipt.appliedMatchState.half === 'bottom',
        'external receipt half-inning is invalid.');
      assert(safeTick(receipt.appliedMatchState.inning) && receipt.appliedMatchState.inning > 0
        && safeTick(receipt.appliedMatchState.outs) && receipt.appliedMatchState.outs <= 2
        && safeTick(receipt.appliedMatchState.score.away) && safeTick(receipt.appliedMatchState.score.home)
        && safeTick(receipt.appliedMatchState.balls) && receipt.appliedMatchState.balls <= 3
        && safeTick(receipt.appliedMatchState.strikes) && receipt.appliedMatchState.strikes <= 2,
        'external official receipt contains invalid post-play Match data.');
      const expected = lastPitch.phase === 'walk'
        ? applyWalkPlateAppearanceToMatchState(dto.initialMatch, timeline, lastPitch.commandSession.batterRunnerId)
        : lastPitch.phase === 'strikeout'
          ? applyStrikeoutPlateAppearanceToMatchState(dto.initialMatch, timeline)
          : null;
      if (expected !== null) {
        assert(identical(receipt.appliedMatchState, expected),
          'externally supplied receipt contradicts non-live canonical Match Core.');
      }
      // A batted-ball receipt is opaque: only its owning umpire/fielding Core
      // can prove its closure. No OUT, SAFE or scoring is inferred here.
      hasReceipt = true;
    } else {
      throw new Error('Native immutable replay: unknown entry type.');
    }
  }
  assert(dto.headDigest === previousDigest, 'Native replay head digest mismatch.');
  return { timeline, lastPitch, stopped };
}

/** Validate a persisted/transported DTO, then return an independent deep-frozen copy. */
export function verifyNativeImmutableReplayLedger(
  stored: unknown,
  /** Trusted externally saved head anchor detects complete chain substitution. */
  expectedHeadDigest?: string,
): NativeImmutableReplayLedgerDTO {
  const dto = inertCopy(stored) as NativeImmutableReplayLedgerDTO;
  if (expectedHeadDigest !== undefined) {
    assert(isDigest(expectedHeadDigest) && dto.headDigest === expectedHeadDigest,
      'Native replay does not match the external trusted head digest.');
  }
  replayLedger(dto);
  return dto;
}

/**
 * Capture one already-issued physical pitch; immutable copy-on-append.
 * The physical source's resolver must be repeatable: a second evaluation is
 * checked against the original rigid result so replay parameters can be
 * persisted as plain data rather than serializing any function.
 */
export function appendNativeImmutableReplayPitch(
  existing: NativeImmutableReplayLedgerDTO,
  input: NativeReplayAppendPitchInput,
): NativeImmutableReplayLedgerDTO {
  const ledger = verifyNativeImmutableReplayLedger(existing);
  const cursor = replayLedger(ledger);
  const { actualPitch, issued, sourceId } = input;
  assert(sourceIdValid(sourceId), 'accepted pitch requires a nonempty exact physical source ID.');
  assert(!cursor.stopped && cursor.timeline.status.kind === 'active',
    'a terminal or unresolved Native one-PA cannot accept another pitch.');
  const before = cursor.timeline;
  const { trajectory } = actualPitch;
  const ordinal = ledger.entries.filter(e => e.kind === 'accepted_pitch').length;
  assert(ordinal < MAX_PITCHES && issued.ordinal === ordinal, 'accepted physical pitch ordinal is duplicated or skipped.');
  assert(issued.commandSession.playId === ledger.initialMatch.playId
    && issued.commandSession.acceptedAtTick === before.lastEventTick
    && (cursor.lastPitch === null
      || (issued.commandSession.matchSeed === cursor.lastPitch.commandSession.matchSeed
        && issued.commandSession.batterRunnerId === cursor.lastPitch.commandSession.batterRunnerId)),
    'source command does not belong to this accepted canonical PA prefix.');
  assert(ledger.entries.every(e => e.kind !== 'accepted_pitch' || e.sourceId !== sourceId),
    'physical source ID was already persisted.');
  assert(safeTick(trajectory.start.tick) && safeTick(trajectory.endTick)
    && trajectory.start.tick >= before.lastEventTick
    && (cursor.lastPitch === null || trajectory.start.tick > cursor.lastPitch.clock.sourceEndTick),
    'source flight overlaps a previous source or accepted canonical clock.');
  assert(issued.result.authority === 'NATIVE_CORE_AERODYNAMIC_RIGID_PITCH'
    && issued.result.result.timeline.playId === ledger.initialMatch.playId,
    'accepted observation must originate from the actual aerodynamic Core.');
  assert(issued.result.nextMatchState === null, 'read-only observer cannot produce an official Match transition.');
  assert(issued.result.kind === issued.result.result.kind,
    'observed physical result must match the accepted Native resolution.');
  const result = issued.result.result;
  assert(issued.eventKinds.length === issued.result.events.length
    && issued.eventKinds.every((kind, i) => kind === issued.result.events[i].kind),
    'issued pitch event kinds must match exact accepted canonical events.');
  const after = result.timeline;
  assert(after.playId === before.playId
    && after.startedAtTick === before.startedAtTick
    && identical(after.events.slice(0, before.events.length), before.events),
    'issued physical result changes an already accepted canonical prefix.');
  const accepted = after.events.slice(before.events.length);
  assert(identical(accepted, issued.result.events),
    'read-only physical observation must retain the actual newly accepted events.');
  assert(issued.phase === (result.kind === 'unresolved' ? 'unresolved' : after.status.kind),
    'issued pitch completion differs from canonical phase.');
  assert(issued.result.requiresOfficialLiveBallResolution === (after.status.kind === 'batted_ball_pending'),
    'physical contact cannot be marked as an official completed live ball.');
  const expectedMatch = after.status.kind === 'walk'
    ? applyWalkPlateAppearanceToMatchState(ledger.initialMatch, after, issued.commandSession.batterRunnerId)
    : after.status.kind === 'strikeout'
      ? applyStrikeoutPlateAppearanceToMatchState(ledger.initialMatch, after)
      : null;
  assert(identical(issued.nextMatchState, expectedMatch),
    'only the original canonical walk/strikeout rule may advance MatchState.');
  assert(issued.result.frames.length === issued.result.samples.length
    && issued.result.samples.length > 0,
    'physical source samples and read-only frames must exist.');
  const camera = issued.result.frames[0].cameraMode;
  assert(camera === 'BATTER_POV' || camera === 'PITCHER_POV',
    'pitch recorder accepts only the actual precontact observer camera.');
  assert(identical(issued.result.frames, buildMiniPresentationTimeline(
    issued.result.samples, issued.result.events, camera,
  )), 'presentation frames differ from the read-only canonical observation.');
  let action: NativeReplayStoredAction;
  if (isTakeInput(actualPitch)) {
    assert(result.kind === 'recorded_take' || result.kind === 'unresolved',
      'take physical source cannot produce a rigid swing result.');
    action = {
      kind: 'take',
      plateZ: actualPitch.plateZ,
      strikeZone: inertCopy(actualPitch.strikeZone, true),
      ballRadiusMeters: actualPitch.ballRadiusMeters,
    };
  } else {
    assert(result.kind === 'recorded_swing',
      'rigid swing physical source must produce the existing contact/miss result.');
    let recordedParameters: RigidBatBallContactParameters | null = null;
    let calls = 0;
    const replayed = resolveAerodynamicRigidBatSwing({
      trajectory: actualPitch.trajectory,
      swing: actualPitch.action.swing,
      ball: actualPitch.ball,
      parameterResolver: kinematics => {
        const parameters = inertCopy(actualPitch.parameterResolver(kinematics), true);
        if (recordedParameters !== null) {
          assert(identical(parameters, recordedParameters),
            'original physical contact response was not repeatable.');
        }
        recordedParameters = parameters;
        calls += 1;
        return parameters;
      },
    });
    assert(identical(replayed, result.physical),
      'the actual source physical rigid-body outcome was not reproducible.');
    assert(replayed.kind !== 'contact' || (calls === 1 && recordedParameters !== null),
      'contact must carry exactly one measured source response.');
    assert(replayed.kind !== 'swinging_miss' || calls === 0,
      'physical misses cannot materialize contact parameters.');
    action = {
      kind: 'swing',
      swing: inertCopy(actualPitch.action.swing, true),
      ball: inertCopy(actualPitch.ball, true),
      impactParameters: recordedParameters,
    };
  }
  const first = issued.result.samples[0];
  const handedness = {
    batter: first.batter.handedness,
    pitcher: first.pitcherHandedness,
  };
  assert(handedness.pitcher === 'R' || handedness.pitcher === 'L',
    'pitch source must report a real pitcher handedness.');
  const clock: NativeReplayPitchClock = {
    acceptedAtTick: issued.commandSession.acceptedAtTick,
    sourceStartTick: trajectory.start.tick,
    sourceEndTick: trajectory.endTick,
    ticksPerSecond: trajectory.parameters.ticksPerSecond,
    integrationStepTicks: trajectory.parameters.integrationStepTicks,
    canonicalBeforeTick: before.lastEventTick,
    canonicalAfterTick: after.lastEventTick,
    observationStopTick: issued.result.rigidContact?.tick ?? trajectory.endTick,
  };
  const payload = inertCopy({
    kind: 'accepted_pitch',
    version: 1,
    ordinal,
    sourceId,
    commandSession: issued.commandSession,
    trajectory: actualPitch.trajectory,
    action,
    clock,
    phase: issued.phase,
    statusAfter: after.status,
    events: accepted,
    samples: issued.result.samples,
    handedness,
    camera,
    rigidContact: issued.result.rigidContact,
    previousDigest: ledger.headDigest,
  }, true) as Omit<NativeReplayPitchEntry, 'digest'>;
  const entry: NativeReplayPitchEntry = inertCopy({ ...payload, digest: entryDigest(payload) });
  return verifyNativeImmutableReplayLedger(inertCopy({
    ...ledger,
    entries: [...ledger.entries, entry],
    headDigest: entry.digest,
  }));
}

/**
 * Separate immutable append: never derive an official closure from the flight
 * or guessed hit/out. The provided object must be the ACTUAL receipt from the
 * external Native adjudication/application owner.
 */
export function appendNativeExternalOfficialReceipt(
  existing: NativeImmutableReplayLedgerDTO,
  supplied: Readonly<{
    pitchOrdinal: number;
    receivedAtTick: number;
    receipt: OfficialStateApplicationReceipt;
  }>,
): NativeImmutableReplayLedgerDTO {
  const ledger = verifyNativeImmutableReplayLedger(existing);
  const { lastPitch } = replayLedger(ledger);
  assert(lastPitch !== null && lastPitch.phase !== 'active' && lastPitch.phase !== 'unresolved',
    'external official application can only attach after a terminal physical pitch.');
  assert(!ledger.entries.some(entry => entry.kind === 'external_official_receipt'),
    'duplicate official application receipt for the same PA.');
  const payload = inertCopy({
    kind: 'external_official_receipt',
    version: 1,
    pitchOrdinal: supplied.pitchOrdinal,
    receivedAtTick: supplied.receivedAtTick,
    receipt: supplied.receipt,
    previousDigest: ledger.headDigest,
  }, true) as Omit<NativeReplayOfficialReceiptEntry, 'digest'>;
  const entry: NativeReplayOfficialReceiptEntry = inertCopy({
    ...payload, digest: entryDigest(payload),
  });
  return verifyNativeImmutableReplayLedger(inertCopy({
    ...ledger,
    entries: [...ledger.entries, entry],
    headDigest: entry.digest,
  }));
}
