import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { deriveBallWorldFieldFirstBaseRace } from '../rules/BallWorldFieldFirstBaseRace';
import { deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence,
  type BattedWorldPossessionEvidence } from '../rules/BallWorldFieldFirstBaseRaceWithPossessionEvidence';
import type { BallWorldFirstBaseRaceInput } from '../rules/BallWorldFirstBaseRace';
import type { GroundedPlayableWallInput } from '../rules/BallWorldGroundedPlayableWall';
import { projectActualFairFieldTimeline,
  type ActualFairFieldTimelineInput } from '../sim/plateAppearance/ActualFairFieldTimeline';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { SupportedOfficialScoringRecord } from './OfficialScoring';
import { cloneInert } from './OfficialWindowPolicy';
import { deriveClosedLiveBallMatchState, getOfficialPlayClosure,
  type PlayAdjudicationLedger } from './PlayAdjudicationLedger';

/** Native must authenticate these complete original histories and their sealed
 * end. The input carries no caller-selected ground-out or scorer judgment. */
export type ActualGroundOutScoringInput = Readonly<{
  physical: ActualFairFieldTimelineInput;
  race: BallWorldFirstBaseRaceInput;
  possessionEvidence?: BattedWorldPossessionEvidence;
  playableWalls?: GroundedPlayableWallInput;
}>;

const json = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

/** Strict intersection of the executed fair-ground race and final official OUT.
 * A differing or unresolved physical/official result remains unsupported here. */
export const classifyActualGroundOutForOfficialScoring = (input: Readonly<{
  match: CanonicalMatchState;
  timeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
  evidence: ActualGroundOutScoringInput;
}>): SupportedOfficialScoringRecord => {
  const request = cloneInert(input), evidence = request.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || Object.keys(evidence).sort().join('|') !== ['physical', 'race',
      ...(evidence.possessionEvidence === undefined ? [] : ['possessionEvidence']),
      ...(evidence.playableWalls === undefined ? [] : ['playableWalls'])].sort().join('|')) {
    throw new Error('invalid ground-out scoring evidence');
  }
  // Validate the complete official application, including third-out transition,
  // before using its closure delta. Next Match outs may already have reset.
  deriveClosedLiveBallMatchState(request.match, request.timeline, request.adjudication);
  const closure = getOfficialPlayClosure(request.adjudication);
  if (closure === null) throw new Error('ground-out scoring requires official closure');

  const { physical, race } = evidence;
  const raceInput = { field: physical.field, race,
    ...(evidence.playableWalls === undefined ? {} : { playableWalls: evidence.playableWalls }) };
  const actual = evidence.possessionEvidence === undefined
    ? deriveBallWorldFieldFirstBaseRace(raceInput)
    : deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence({ ...raceInput,
      possessionEvidence: evidence.possessionEvidence });
  const correct = actual.groundRule?.correctRuleResult;
  const projection = projectActualFairFieldTimeline(physical);
  const batter = physical.field.evidence.batterRunnerId;
  if (actual.ballEvidence.kind !== 'grounded' || actual.ballEvidence.territory !== 'fair'
    || actual.pendingContacts.length !== 0
    || !correct || correct.kind !== 'resolved'
    || correct.batterRunnerFirstBase.kind !== 'out'
    || correct.batterRunnerFirstBase.reason !== 'batter_runner_before_first'
    || correct.batterRunnerFirstBase.runnerId !== batter
    || race.batterRunnerId !== batter || race.outsAtStart !== request.match.outs
    || projection.kind !== 'projected' || json(projection.timeline) !== json(request.timeline)
    || physical.originalTimeline.playId !== request.match.playId
    || json(physical.playEnd) !== json(closure.playEnd)
    || Object.values(request.match.bases).some(runner => runner !== null)
    || Object.values(closure.officialDelta.basesAfter).some(runner => runner !== null)
    || closure.officialDelta.scoredRunnerIds.length !== 0
    || closure.officialDelta.outsAfter !== request.match.outs + 1) {
    throw new Error('ground-out scoring requires the exact fair-ground first-base OUT and closed empty-base batter retirement');
  }
  return Object.freeze({ playId: closure.playId, closureId: closure.closureId,
    basisRulingId: closure.finalRuling.rulingId, classification: 'ground_out',
    battingTeam: request.match.half === 'top' ? 'away' : 'home',
    runsScored: 0, hitsCredited: 0, errorsCharged: 0 });
};
