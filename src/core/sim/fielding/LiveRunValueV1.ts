/** Run value as the defense's currency. A fielder choosing an out compares where each choice leaves the inning:
 * the runs it lets in now plus the runs the batting side can still expect from the bases and outs left behind.
 * Pure arithmetic over a supplied table; no ball, runner or rule fact is read or decided here. */

/** Occupied bags first, second and third, and outs made. Three outs ends the half, worth nothing more. */
export type LiveBaseOutStateV1 = Readonly<{ bases: readonly [boolean, boolean, boolean]; outs: number }>;
/** values[outs][first + 2*second + 4*third]: runs the batting side scores on average from that state to the end of the half. */
export type LiveRunExpectancyTableV1 = Readonly<{ sourceId: string; values: readonly (readonly number[])[] }>;
export type LivePlayOutcomeV1 = Readonly<{ runs: number; state: LiveBaseOutStateV1 }>;
export type LivePlayBranchV1 = Readonly<{ probability: number; outcome: LivePlayOutcomeV1 }>;

export function validateLiveRunExpectancyTableV1(table: LiveRunExpectancyTableV1) {
  if (!table || typeof table.sourceId !== 'string' || !table.sourceId || !Array.isArray(table.values) || table.values.length !== 3
    || table.values.some(row => !Array.isArray(row) || row.length !== 8 || row.some(n => !Number.isFinite(n) || n < 0)))
    throw new Error('invalid run expectancy table');
  return table;
}
const index = (bases: LiveBaseOutStateV1['bases']) => (bases[0] ? 1 : 0) + (bases[1] ? 2 : 0) + (bases[2] ? 4 : 0);
export function liveRunExpectancyV1(table: LiveRunExpectancyTableV1, state: LiveBaseOutStateV1): number {
  if (!Number.isInteger(state.outs) || state.outs < 0) throw new Error('invalid out count');
  return state.outs >= 3 ? 0 : table.values[state.outs][index(state.bases)];
}
/** Runs from now to the end of the half for the batting side. The defense prefers the smaller. */
export function liveOutcomeRunsV1(table: LiveRunExpectancyTableV1, outcome: LivePlayOutcomeV1): number {
  if (!Number.isFinite(outcome.runs) || outcome.runs < 0) throw new Error('invalid runs');
  return outcome.runs + liveRunExpectancyV1(table, outcome.state);
}
export function liveExpectedRunsV1(table: LiveRunExpectancyTableV1, branches: readonly LivePlayBranchV1[]): number {
  const total = branches.reduce((s, b) => s + b.probability, 0);
  if (!branches.length || branches.some(b => !Number.isFinite(b.probability) || b.probability < 0) || Math.abs(total - 1) > 1e-9)
    throw new Error('branch probabilities must sum to one');
  return branches.reduce((s, b) => s + b.probability * liveOutcomeRunsV1(table, b.outcome), 0);
}
/** Chance a race is won, from the forecast margin in seconds. The spread is the play-to-play scatter of throws, catches
 * and tags that a forecast cannot know. Positive margins favour the defense. */
export function liveRaceWinProbabilityV1(marginSeconds: number, spreadSeconds: number): number {
  if (!Number.isFinite(marginSeconds) || !Number.isFinite(spreadSeconds) || spreadSeconds <= 0) throw new Error('invalid race margin');
  // Abramowitz-Stegun 7.1.26 erf, enough for a choice between plays.
  const x = marginSeconds / (spreadSeconds * Math.SQRT2), s = Math.sign(x), a = Math.abs(x), k = 1 / (1 + .3275911 * a),
    erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - .284496736) * k + .254829592) * k * Math.exp(-a * a);
  return .5 * (1 + s * erf);
}
