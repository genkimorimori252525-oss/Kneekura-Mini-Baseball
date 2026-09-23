import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { deriveClosedNonLiveMatchState, type NonLiveOfficialContext } from './NonLiveOfficialApplication';
import { cloneInert } from './OfficialWindowPolicy';
import {
  deriveClosedLiveBallMatchState,
  getOfficialPlayClosure,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';

export type OfficialScoringInput = Readonly<{
  match: CanonicalMatchState;
  timeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
}> & (
  | Readonly<{ kind: 'non_live'; context: NonLiveOfficialContext }>
  | Readonly<{ kind: 'live_ball' }>
);

export type SupportedOfficialScoringRecord = Readonly<{
  playId: number;
  closureId: string;
  basisRulingId: string;
  classification: 'base_on_balls' | 'strikeout';
  battingTeam: 'away' | 'home';
  runsScored: number;
  hitsCredited: 0;
  errorsCharged: 0;
}>;

export type OfficialScoringResult =
  | Readonly<{ kind: 'supported'; record: SupportedOfficialScoringRecord }>
  | Readonly<{
      kind: 'unsupported';
      playId: number;
      closureId: string;
      reason: 'live_ball_hit_error_fielders_choice_not_classified';
    }>;

/** Classify only results established by the closed official state and existing rule path. */
export const classifyClosedPlayForOfficialScoring = (
  input: OfficialScoringInput,
): OfficialScoringResult => {
  const request = cloneInert(input);
  if (request.kind === 'non_live') {
    const next = deriveClosedNonLiveMatchState({
      match: request.match,
      timeline: request.timeline,
      adjudication: request.adjudication,
      context: request.context,
    });
    const closure = getOfficialPlayClosure(request.adjudication);
    if (closure === null) throw new Error('official scoring requires OfficialPlayClosure');
    const battingTeam = request.match.half === 'top' ? 'away' : 'home';
    const runsScored = next.score[battingTeam] - request.match.score[battingTeam];
    return Object.freeze({
      kind: 'supported',
      record: Object.freeze({
        playId: closure.playId,
        closureId: closure.closureId,
        basisRulingId: closure.finalRuling.rulingId,
        classification: request.context.kind === 'walk' ? 'base_on_balls' : 'strikeout',
        battingTeam,
        runsScored,
        hitsCredited: 0,
        errorsCharged: 0,
      }),
    });
  }
  if (request.kind === 'live_ball') {
    deriveClosedLiveBallMatchState(request.match, request.timeline, request.adjudication);
    const closure = getOfficialPlayClosure(request.adjudication);
    if (closure === null) throw new Error('official scoring requires OfficialPlayClosure');
    return Object.freeze({
      kind: 'unsupported',
      playId: closure.playId,
      closureId: closure.closureId,
      reason: 'live_ball_hit_error_fielders_choice_not_classified',
    });
  }
  throw new Error('unknown official scoring play kind');
};
