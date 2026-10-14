import { createRunnerPrecedence } from '../../rules/RunnerPrecedence';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import type { OfficialPlayClosure } from '../../adjudication/PlayAdjudicationLedger';
import type { AttributedOfficialPlayerOutcome } from './OfficialPlayerOutcomeStatistics';
import type { SupportedOfficialScoringRecord } from '../../adjudication/OfficialScoring';

export type OfficialPitchingRunPlay = Readonly<{
  applicationId: string; before: CanonicalMatchState; after: CanonicalMatchState;
  closure: OfficialPlayClosure; record: SupportedOfficialScoringRecord;
  outcome: AttributedOfficialPlayerOutcome | null;
  retiredPriorRunnerId: string | null;
}>;
export type PitchingRunResponsibility = Readonly<{
  pitcherPlayerId: string; entryApplicationId: string; entryAttributionId: string;
  transferApplicationIds: readonly string[];
}>;
export type OfficialPitchingRun = Readonly<{
  runId: string; gameId: string; scoringApplicationId: string; scoringPlayId: number;
  fieldingSide: 'home' | 'away'; runnerId: string; runnerStintId: string; runnerEntryApplicationId: string | null;
  responsibility: PitchingRunResponsibility | null;
  unavailableReason: 'original_runner_entry_missing' | 'original_attribution_missing' | 'unsupported_liability_transfer' | null;
  runnerReachedOnError: boolean; pitcherEarned: boolean | null; teamEarned: boolean | null;
}>;
export type OfficialPitchingRunJudgment = Readonly<{
  schemaVersion: 1; sourceKind: 'official_pitching_run_scorer_judgment'; sourceEventId: string;
  scorerId: string; ruleProfileId: string; careerId: string; gameId: string;
  originalProofHash: string;
  runs: readonly Readonly<{ runId: string; runnerStintId: string; responsiblePitcherId: string;
    responsibilityEntryApplicationId: string; pitcherEarned: boolean; teamEarned: boolean }>[];
}>;
const ids = (bases: CanonicalMatchState['bases']) => [bases.third, bases.second, bases.first].filter((v): v is string => v !== null);
const serialized = (value: unknown) => JSON.stringify(value, (_key, v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : v);
const same = (a: unknown, b: unknown) => serialized(a) === serialized(b);
const id = (v: unknown): v is string => typeof v === 'string' && !!v && v.trim() === v;
const fields = (v: unknown, names: string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === names.sort().join('|');
type Runner = { stint: string; entry: string | null; charge: PitchingRunResponsibility | null; reason: OfficialPitchingRun['unavailableReason']; reachedOnError: boolean };

/** OBR 9.16(g): preserve liability slots through a supported preceding-runner
 * FC, including transfer to an existing runner ahead of the batter. No earned
 * reconstruction is inferred here. Native supplies the complete original game. */
export const deriveOfficialPitchingRuns = (gameId: string, plays: readonly OfficialPitchingRunPlay[]): readonly OfficialPitchingRun[] => {
  if (!id(gameId) || !Array.isArray(plays)) throw new Error('invalid pitching responsibility game');
  let runners = new Map<string, Runner>(), previous: CanonicalMatchState | null = null;
  const runs: OfficialPitchingRun[] = [], applications = new Set<string>();
  for (const p of plays) {
    const { before: b, after, closure: c, record: r, outcome: o } = p;
    if (!id(p.applicationId) || applications.has(p.applicationId) || previous && !same(previous, b)
      || !previous && (b.inning !== 1 || b.half !== 'top' || b.outs !== 0 || b.score.away !== 0 || b.score.home !== 0)
      || c.playId !== b.playId || r.playId !== b.playId || r.closureId !== c.closureId || r.basisRulingId !== c.finalRuling.rulingId
      || r.battingTeam !== (b.half === 'top' ? 'away' : 'home') || r.runsScored !== c.officialDelta.scoredRunnerIds.length
      || o && (o.gameId !== gameId || o.playId !== b.playId || o.classification !== r.classification)) {
      throw new Error('pitching responsibility original history differs');
    }
    applications.add(p.applicationId);
    const prior = ids(b.bases), final = ids(c.officialDelta.basesAfter), scored = [...c.officialDelta.scoredRunnerIds];
    if (new Set(prior).size !== prior.length || new Set([...final, ...scored]).size !== final.length + scored.length) {
      throw new Error('pitching responsibility original runners differ');
    }
    for (const runner of prior) if (!runners.has(runner)) runners.set(runner, {
      stint: JSON.stringify([gameId, b.inning, b.half, null, runner]), entry: null, charge: null, reason: 'original_runner_entry_missing', reachedOnError: false,
    });
    if ([...runners.keys()].some(runner => !prior.includes(runner))) throw new Error('pitching responsibility runner continuity differs');
    const added = [...final, ...scored].filter(runner => !prior.includes(runner));
    if (added.length > 1 || o && added.some(runner => runner !== o.batterPlayerId)) throw new Error('pitching responsibility new runner differs');
    for (const runner of added) runners.set(runner, {
      stint: JSON.stringify([gameId, b.inning, b.half, b.playId, runner]), entry: p.applicationId,
      charge: o ? { pitcherPlayerId: o.pitcherPlayerId, entryApplicationId: p.applicationId,
        entryAttributionId: o.attributionId, transferApplicationIds: [] } : null,
      reason: o ? null : 'original_attribution_missing', reachedOnError: r.classification === 'reached_on_error',
    });
    const retired = prior.filter(runner => !final.includes(runner) && !scored.includes(runner));
    if (r.classification === 'fielders_choice' && retired.length) {
      const ordered = added.length === 1 ? [...createRunnerPrecedence(b.bases, added[0]).runners].sort((a, b) => b.originBase - a.originBase).map(r => r.runnerId) : [...prior, ...added], survivors = ordered.filter(runner => !retired.includes(runner));
      if (retired.length === 1 && p.retiredPriorRunnerId === retired[0] && added.length === 1 && c.officialDelta.outsAfter - b.outs === 1
        && final.includes(added[0])
        && survivors.slice(0, scored.length).every(runner => scored.includes(runner))
        && same(survivors.slice(scored.length), final)) {
        const liabilities = prior.map(runner => runners.get(runner)!);
        for (const [index, runner] of survivors.entries()) {
          const own = runners.get(runner)!, inherited = liabilities[index];
          runners.set(runner, { ...own, charge: inherited.charge ? { ...inherited.charge,
            transferApplicationIds: [...inherited.charge.transferApplicationIds, p.applicationId] } : null, reason: inherited.reason });
        }
      } else for (const runner of survivors) runners.set(runner, { ...runners.get(runner)!, charge: null, reason: 'unsupported_liability_transfer' });
    }
    for (const runner of scored) {
      const entry = runners.get(runner);
      if (!entry) throw new Error('pitching responsibility scored runner is missing');
      runs.push({ runId: JSON.stringify([gameId, p.applicationId, runner]), gameId, scoringApplicationId: p.applicationId,
        scoringPlayId: b.playId, fieldingSide: b.half === 'top' ? 'home' : 'away', runnerId: runner, runnerStintId: entry.stint, runnerEntryApplicationId: entry.entry,
        responsibility: entry.charge, unavailableReason: entry.reason, runnerReachedOnError: entry.reachedOnError,
        pitcherEarned: entry.reachedOnError ? false : null, teamEarned: entry.reachedOnError ? false : null });
    }
    runners = new Map(final.map(runner => [runner, runners.get(runner)!]));
    if (after.inning !== b.inning || after.half !== b.half) runners = new Map();
    previous = after;
  }
  return runs;
};

/** The scorer assesses errorless counterfactuals. It cannot change the actual
 * runner or override a missing/contradictory original responsible pitcher. */
export const applyOfficialPitchingRunJudgment = (runs: readonly OfficialPitchingRun[], raw: OfficialPitchingRunJudgment,
  scope: Readonly<{ careerId: string; gameId: string; ruleProfileId: string; originalProofHash: string }>) => {
  if (!fields(raw, ['schemaVersion', 'sourceKind', 'sourceEventId', 'scorerId', 'ruleProfileId', 'careerId', 'gameId', 'originalProofHash', 'runs'])
    || raw.schemaVersion !== 1 || raw.sourceKind !== 'official_pitching_run_scorer_judgment'
    || ![raw.sourceEventId, raw.scorerId, raw.ruleProfileId, raw.careerId, raw.gameId, raw.originalProofHash].every(id)
    || (['careerId', 'gameId', 'ruleProfileId', 'originalProofHash'] as const).some(key => raw[key] !== scope[key])
    || !Array.isArray(raw.runs)) throw new Error('invalid accepted pitching run judgment');
  const seen = new Set<string>();
  for (const decision of raw.runs) {
    const run = runs.find(run => run.runId === decision.runId);
    if (!fields(decision, ['runId', 'runnerStintId', 'responsiblePitcherId', 'responsibilityEntryApplicationId', 'pitcherEarned', 'teamEarned'])
      || seen.has(decision.runId) || !run?.responsibility || decision.runnerStintId !== run.runnerStintId
      || decision.responsiblePitcherId !== run.responsibility.pitcherPlayerId
      || decision.responsibilityEntryApplicationId !== run.responsibility.entryApplicationId
      || typeof decision.pitcherEarned !== 'boolean' || typeof decision.teamEarned !== 'boolean'
      || run.runnerReachedOnError && (decision.pitcherEarned || decision.teamEarned)) {
      throw new Error('accepted pitching run judgment original differs');
    }
    seen.add(decision.runId);
  }
  return runs.map(run => { const decision = raw.runs.find(d => d.runId === run.runId);
    return decision ? { ...run, pitcherEarned: decision.pitcherEarned, teamEarned: decision.teamEarned } : run; });
};

export const totalOfficialPitchingRuns = (runs: readonly OfficialPitchingRun[], pitcherPlayerId: string) => {
  const unknown = runs.filter(run => !run.responsibility).map(run => ({ runId: run.runId, reason: run.unavailableReason! }));
  const own = runs.filter(run => run.responsibility?.pitcherPlayerId === pitcherPlayerId);
  const earnedUnknown = [...unknown, ...own.filter(run => run.pitcherEarned === null).map(run => ({ runId: run.runId, reason: 'earned_run_judgment_missing' as const }))];
  return { runsAllowed: { value: unknown.length ? null : own.length, knownSubtotal: own.length, unavailable: unknown },
    earnedRuns: { value: earnedUnknown.length ? null : own.filter(run => run.pitcherEarned).length,
      knownSubtotal: own.filter(run => run.pitcherEarned).length, unavailable: earnedUnknown } };
};
