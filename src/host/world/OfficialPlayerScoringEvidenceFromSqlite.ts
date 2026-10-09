import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { deriveOfficialPlayerScoringContribution } from '../../core/world/competition/OfficialPlayerScoringStatistics';
import { createSqliteOfficialScoringWriter } from '../SqliteOfficialScoringWriter';
import type { OfficialPlayerOutcomeAttribution } from './OfficialPlayerOutcomeEvidenceFromSqlite';
import { foulTerminalScoringEvidenceFromSqlite, terminalScoringProof } from './ActualFoulTerminalScoringEvidenceFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Called only after the attribution owner's complete history authentication.
 * Reuse the original scoring owner, including the distinct pending foul input;
 * no archived scoring or attribution shape is rewritten for these read metrics. */
export const deriveOfficialPlayerScoringFromSqlite = (db: DatabaseSync, outcome: OfficialPlayerOutcomeAttribution) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('official player scoring requires an owned Native transaction');
  const accepted = outcome.source.owner === 'actual_foul_terminal_applications'
    ? terminalScoringProof(db, () => {
      const terminal = foulTerminalScoringEvidenceFromSqlite(db).prepare(outcome.source.sourceId);
      return terminal?.result ? { scoring: terminal.result, application: terminal.input.officialApplication } : null;
    }) : createSqliteOfficialScoringWriter(db).readAcceptedPlay(outcome.scoring.scoringApplicationId);
  if (!accepted || json(accepted.scoring) !== json(outcome.scoring)
    || accepted.application.matchId !== outcome.gameId || accepted.application.applicationId !== outcome.officialApplicationId
    || accepted.application.match.playId !== outcome.playId || accepted.scoring.record.classification !== outcome.classification) {
    throw new Error('official player scoring accepted original differs');
  }
  const closure = getOfficialPlayClosure(accepted.application.adjudication);
  if (!closure) throw new Error('official player scoring original closure is missing');
  return deriveOfficialPlayerScoringContribution({ match: accepted.application.match, closure, record: accepted.scoring.record });
};
