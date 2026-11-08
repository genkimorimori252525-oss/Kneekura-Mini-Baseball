import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

export type LiveDefensiveTacticalContextV1 = Readonly<{
  schemaVersion: 1; phase: 'pre_play'; scope: Readonly<{ matchId: string; playId: string }>;
  snapshot: Readonly<{ sourceId: string; revision: number; tick: number }>; atTick: number;
  score: Readonly<{ away: number; home: number }>; inning: number; half: 'top' | 'bottom'; outs: number;
  occupiedBases: Readonly<{ first: boolean; second: boolean; third: boolean }>;
  horizon: Readonly<{ kind: 'known'; remainingOuts: number }> | Readonly<{ kind: 'unknown' }>;
}>;
export type LiveDefensiveTacticalPolicyV1 = Readonly<{
  schemaVersion: 1; modelId: string; version: string; maxSnapshotAgeTicks: number;
  scoreScaleRuns: number; progressScaleHalfInnings: number; horizonScaleOuts: number;
  runnerWeights: readonly [number, number, number]; valueScale: number;
  weights: Readonly<{ scoreCloseness: number; elapsedProgress: number; runnerPressure: number; horizonUrgency: number }>;
}>;
export type LiveDefensiveTacticalValueV1 = Readonly<{
  status: 'NOT_CONNECTED' | 'CONNECTED_PROXY'; basis: 'UNCALIBRATED_PUBLIC_STATE_PROXY_V1';
  model: Readonly<{ modelId: string; version: string }> | null; source: LiveDefensiveTacticalContextV1 | null;
  localLeverage: number | null; tacticalValue: number | null;
  components: Readonly<{ scoreCloseness: number; elapsedProgress: number; runnerPressure: number; horizonUrgency: number | null }> | null;
}>;

const check = (condition: unknown): void => { if (!condition) throw Error('invalid live defensive tactical context or policy'); };
const fields = (value: object, keys: readonly string[]): boolean => !!value && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const text = (s: string): boolean => typeof s === 'string' && s.trim().length > 0;
const count = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;
const positive = (n: number): boolean => Number.isFinite(n) && n > 0;
const nonnegative = (n: number): boolean => Number.isFinite(n) && n >= 0;
const freeze = <T>(o: T): T => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };

/** A bounded proxy from the public pre-play snapshot, not official LI, win
 * probability or a calibrated population model. Every coefficient is supplied
 * by an explicit versioned policy. Elapsed progress uses known past innings;
 * no regulation end or extra-inning horizon is inferred. The Host owns source
 * truth and must capture this before the field play, never after its result. */
export function deriveLiveDefensiveTacticalValueV1(context?: LiveDefensiveTacticalContextV1,
  policy?: LiveDefensiveTacticalPolicyV1): LiveDefensiveTacticalValueV1 {
  const basis = 'UNCALIBRATED_PUBLIC_STATE_PROXY_V1' as const;
  if (context === undefined) return freeze({ status: 'NOT_CONNECTED', basis, model: null, source: null,
    localLeverage: null, tacticalValue: null, components: null });
  check(policy !== undefined);
  const c = cloneInert(context), p = cloneInert(policy!);
  check(fields(c, ['schemaVersion', 'phase', 'scope', 'snapshot', 'atTick', 'score', 'inning', 'half', 'outs', 'occupiedBases', 'horizon'])
    && c.schemaVersion === 1 && c.phase === 'pre_play' && fields(c.scope, ['matchId', 'playId'])
    && text(c.scope.matchId) && text(c.scope.playId) && fields(c.snapshot, ['sourceId', 'revision', 'tick'])
    && text(c.snapshot.sourceId) && count(c.snapshot.revision) && count(c.snapshot.tick) && count(c.atTick)
    && c.snapshot.tick <= c.atTick && fields(c.score, ['away', 'home']) && count(c.score.away) && count(c.score.home)
    && count(c.inning) && c.inning >= 1 && ['top', 'bottom'].includes(c.half) && count(c.outs) && c.outs <= 2
    && fields(c.occupiedBases, ['first', 'second', 'third']) && Object.values(c.occupiedBases).every(v => typeof v === 'boolean')
    && c.horizon && (c.horizon.kind === 'unknown' ? fields(c.horizon, ['kind'])
      : c.horizon.kind === 'known' && fields(c.horizon, ['kind', 'remainingOuts'])
        && count(c.horizon.remainingOuts) && c.horizon.remainingOuts >= 3 - c.outs));
  check(fields(p, ['schemaVersion', 'modelId', 'version', 'maxSnapshotAgeTicks', 'scoreScaleRuns', 'progressScaleHalfInnings',
    'horizonScaleOuts', 'runnerWeights', 'valueScale', 'weights']) && p.schemaVersion === 1 && text(p.modelId) && text(p.version)
    && count(p.maxSnapshotAgeTicks) && c.atTick - c.snapshot.tick <= p.maxSnapshotAgeTicks
    && [p.scoreScaleRuns, p.progressScaleHalfInnings, p.horizonScaleOuts, p.valueScale].every(positive)
    && Array.isArray(p.runnerWeights) && p.runnerWeights.length === 3 && p.runnerWeights.every(nonnegative)
    && p.runnerWeights.some(positive) && fields(p.weights, ['scoreCloseness', 'elapsedProgress', 'runnerPressure', 'horizonUrgency'])
    && Object.values(p.weights).every(nonnegative)
    && [p.weights.scoreCloseness, p.weights.elapsedProgress, p.weights.runnerPressure].some(positive));
  const progress = 2 * (c.inning - 1) + (c.half === 'bottom' ? 1 : 0) + c.outs / 3,
    runnerScale = Math.max(...p.runnerWeights), runnerWeights = p.runnerWeights.map(w => w / runnerScale),
    runners = [c.occupiedBases.first, c.occupiedBases.second, c.occupiedBases.third],
    components = { scoreCloseness: 1 / (1 + Math.abs(c.score.away - c.score.home) / p.scoreScaleRuns),
      elapsedProgress: progress / (progress + p.progressScaleHalfInnings),
      runnerPressure: runnerWeights.reduce((n, w, i) => n + (runners[i] ? w : 0), 0) / runnerWeights.reduce((a, b) => a + b, 0),
      horizonUrgency: c.horizon.kind === 'unknown' ? null
        : 1 / (1 + (c.horizon.remainingOuts - (3 - c.outs)) / p.horizonScaleOuts) },
    entries = (Object.keys(components) as (keyof typeof components)[]).filter(k => components[k] !== null),
    weightScale = Math.max(...entries.map(k => p.weights[k])),
    denominator = entries.reduce((n, k) => n + p.weights[k] / weightScale, 0),
    localLeverage = entries.reduce((n, k) => n + components[k]! * (p.weights[k] / weightScale), 0) / denominator,
    tacticalValue = p.valueScale * localLeverage;
  check(Number.isFinite(localLeverage) && localLeverage >= 0 && localLeverage <= 1 && Number.isFinite(tacticalValue));
  return freeze({ status: 'CONNECTED_PROXY', basis, model: { modelId: p.modelId, version: p.version }, source: c,
    localLeverage, tacticalValue, components });
}
