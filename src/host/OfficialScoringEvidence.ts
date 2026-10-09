import type { OfficialScoringInput } from '../core/adjudication/OfficialScoring';
import type { AcceptedOfficialScoringEvidence } from './SqliteOfficialScoringStore';

/** The writer and every archive consumer dispatch the same accepted evidence
 * format before the Core classifier rederives its complete physical sidecar. */
export const officialScoringEvidenceArguments = (evidence: AcceptedOfficialScoringEvidence | null, sourceEventId: string):
  Pick<Extract<OfficialScoringInput, { kind: 'live_ball' }>, 'scoringEvidence' | 'fairCatchEvidence'> => {
  if (!evidence) return {};
  if (evidence.sourceEventId !== sourceEventId) throw new Error('official scoring evidence Source identity differs');
  if (evidence.sourceKind === 'owned_fair_catch') {
    if (evidence.schemaVersion !== 1 || Object.keys(evidence).sort().join('|') !== 'physical|schemaVersion|sourceEventId|sourceKind')
      throw new Error('invalid owned fair catch scoring evidence');
    return { fairCatchEvidence: evidence.physical };
  }
  return { scoringEvidence: evidence };
};
