import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { validateBatterCourseProfileV79 } from './BatterCourseProfileV79';
import { buildPitcherWorkbenchInputV77, type PitcherWorkbenchBuildInputV77 } from './PitcherWorkbenchV77';
import { simulateLivePitchV1 } from './LivePitchV1';

export type BatterCourseWorkbenchInputV79 = Omit<PitcherWorkbenchBuildInputV77, 'originTick'> & Readonly<{ attempts?: number }>;
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function assert(value: unknown, message: string): asserts value { if (!value) throw Error('batter course workbench v79: ' + message); }
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>, keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
}

/** Paired physical swings: only the independent direction-intent stream varies.
 * Counts describe contact exit velocity; fielding and official scoring do not run. */
export function compareBatterCourseDirectionsV79(raw: BatterCourseWorkbenchInputV79) {
  const input = cloneInert(raw);
  assert(input && typeof input === 'object' && !Array.isArray(input)
    && Object.keys(input).every(key => ['players', 'roster', 'pitcherId', 'batterId', 'catcherId', 'measuredClips',
      'seed', 'pitchType', 'pitchId', 'location', 'attempts'].includes(key)), 'unknown trial fields');
  const { attempts = 20, ...build } = input;
  assert(Number.isSafeInteger(attempts) && attempts >= 1 && attempts <= 40, 'one to 40 paired trials required');
  const pitch = { ...buildPitcherWorkbenchInputV77(build), batting: 'balanced' as const };
  assert(pitch.batter.batterCourseProfileV79 !== undefined, 'enable explicit five-direction intention weights before trial');
  const profile = validateBatterCourseProfileV79(pitch.batter.batterCourseProfileV79);
  assert(profile.directionWeights !== undefined, 'enable explicit five-direction intention weights before trial');
  const counts = [0, 0, 0, 0, 0]; let fouls = 0, misses = 0;
  let fixedSource: ReturnType<typeof simulateLivePitchV1>['diagnostics']['sourceDescriptor'] | null = null;
  for (let i = 0; i < attempts; i++) {
    const trial = simulateLivePitchV1({ ...pitch, directionTrialSeedV79: (input.seed + i) >>> 0 }), descriptor = trial.diagnostics.sourceDescriptor;
    if (fixedSource === null) fixedSource = descriptor;
    else assert(same(fixedSource, descriptor), 'paired trial changed the incoming pitch Source');
    // Unresolved contact/custody is not evidence of a miss.
    assert(trial.diagnostics.unsupportedReason === null, 'unresolved physical trial: ' + trial.diagnostics.unsupportedReason);
    if (trial.contact === null) { misses++; continue; }
    const velocity = trial.contact.exitVelocity, angle = Math.atan2(velocity.x, velocity.z) * 180 / Math.PI;
    assert(Object.values(velocity).every(Number.isFinite) && Math.hypot(velocity.x, velocity.z) > 0, 'finite outgoing direction required');
    if (angle < -45 || angle > 45) fouls++;
    else counts[Math.min(4, Math.floor((angle + 45) / 18))]++;
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  return freeze({ version: 79 as const, attempts, pitchSourceUnchanged: true as const, counts,
    ratios: counts.map(count => total ? count / total : 0), total, fouls, misses,
    authority: 'SHARED_LIVE_PITCH_SWING_TRIAL' as const, nativeAdmission: false as const });
}
