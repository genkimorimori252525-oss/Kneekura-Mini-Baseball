import type { DatabaseSync } from 'node:sqlite';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import type { SignatureContextObservationV123 } from '../../core/world/competition/SignatureContextEvidenceV123';
import { deriveOfficialPlayerScoringContribution } from '../../core/world/competition/OfficialPlayerScoringStatistics';
import type { OfficialPlayerOutcomeAttribution } from './OfficialPlayerOutcomeEvidenceFromSqlite';
import { readOfficialPlayerAcceptedScoringFromSqlite } from './OfficialPlayerScoringEvidenceFromSqlite';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** The existing attribution owner must first authenticate its entire edition.
 * This rereads accepted scoring on that SAME Native snapshot. The official
 * application's original match, not the final ruling/next activation, supplies
 * the only contextual variables. No peer handle or raw scoring row is accepted. */
export const deriveOfficialPlayerContextEvidenceV123 = (db: DatabaseSync, outcome: OfficialPlayerOutcomeAttribution): SignatureContextObservationV123 => {
  const accepted = readOfficialPlayerAcceptedScoringFromSqlite(db, outcome);
  const closure = getOfficialPlayClosure(accepted.application.adjudication);
  if (!closure) throw new Error('official player context original closure is missing');
  const contribution = deriveOfficialPlayerScoringContribution({ match: accepted.application.match, closure, record: accepted.scoring.record });
  const before = accepted.application.match;
  return freeze({ outcome, before: { bases: before.bases, outs: before.outs, balls: before.balls, strikes: before.strikes },
    atBats: contribution.atBats, hits: { kind: 'known', value: accepted.scoring.record.hitsCredited } });
};
