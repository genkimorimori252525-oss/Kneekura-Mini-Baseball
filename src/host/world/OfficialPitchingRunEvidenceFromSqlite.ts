import type { DatabaseSync } from 'node:sqlite';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { deriveOfficialPitchingRuns, type OfficialPitchingRunPlay } from '../../core/world/competition/OfficialPitchingRunResponsibility';
import { SqliteOfficialStateWriter } from '../SqliteOfficialStateWriter';
import { readDurableOfficialGameResult } from './PostseasonResultsFromMatches';
import { readCompletedMatchPlayerOutcomeCensus } from './CompletedMatchPlayerOutcomesFromSqlite';
import { readCompletedMatchScoringHistory } from './PhysicalPlayClosureEvidenceFromSqlite';
import { deriveOfficialPlayerOutcomeFromSqlite } from './OfficialPlayerOutcomeEvidenceFromSqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Reuses final/fixture, contiguous accepted scoring, and all four original
 * participant owners. Terminal fouls retain their distinct archived pending
 * request, already authenticated by the completed-history reader. */
export const readOfficialPitchingRunOriginal = (db: DatabaseSync, careerId: string, gameId: string) => {
  if (!db.isTransaction) throw new Error('pitching responsibility requires an owned transaction');
  const final = readDurableOfficialGameResult(new SqliteOfficialStateWriter(db), gameId);
  if (!final) return null;
  const census = readCompletedMatchPlayerOutcomeCensus(db, gameId);
  if (json(final) !== json(census.finalResult)) throw new Error('pitching responsibility final differs');
  const history = readCompletedMatchScoringHistory(db, final);
  const outcomes = census.plays.map(play => {
    if (play.sources.length !== 1) return null;
    const value = deriveOfficialPlayerOutcomeFromSqlite(db, play.sources[0]);
    if (value.kind === 'unavailable') return null;
    if (value.careerId !== careerId || value.gameId !== gameId || value.competitionEditionId !== final.seasonId
      || value.officialApplicationId !== play.applicationId || value.playId !== play.playId
      || value.durableRevision !== play.durableRevision || json(value.scoring) !== json(play.scoring)
      || [value.batter, value.pitcher].some(binding => binding.fixtureEventId !== final.venueBinding!.fixtureEventId
        || binding.clubId !== (binding.side === 'HOME' ? final.homeClubId : final.awayClubId))) {
      throw new Error('pitching responsibility original attribution differs');
    }
    return value;
  });
  if (!outcomes.some(Boolean)) throw new Error('pitching responsibility original Career binding is unavailable');
  const plays: OfficialPitchingRunPlay[] = history.map((item, index) => {
    const row = db.prepare('SELECT request_json FROM main.official_scoring_applications WHERE scoring_application_id=?')
      .get(item.scoringApplicationId);
    if (!row) throw new Error('pitching responsibility accepted scoring is missing');
    const saved = JSON.parse(String(row.request_json));
    const closure = getOfficialPlayClosure(saved.input.officialApplication.adjudication);
    if (!closure || json(saved.input.officialApplication.match) !== json(item.before)
      || item.applicationId !== census.plays[index].applicationId) throw new Error('pitching responsibility original closure differs');
    return { applicationId: item.applicationId, before: item.before, after: item.after, closure,
      record: item.scoring.record, outcome: outcomes[index],
      retiredPriorRunnerId: saved.evidence?.judgment?.kind === 'fielders_choice'
        ? saved.evidence.judgment.retiredPriorRunnerId ?? null : null };
  });
  const proof = { census, history, outcomes, plays };
  return freeze({ careerId, gameId, competitionEditionId: final.seasonId, ruleProfileId: plays[0].before.ruleProfileId,
    originalProofHash: hash(proof), runs: deriveOfficialPitchingRuns(gameId, plays), outcomes });
};
export type OfficialPitchingRunOriginal = NonNullable<ReturnType<typeof readOfficialPitchingRunOriginal>>;
