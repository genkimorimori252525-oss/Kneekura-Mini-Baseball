import type { DatabaseSync } from 'node:sqlite';
import type { OfficialGameResult } from '../../core/world/competition/OfficialGameCompletion';
import type { PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { SqliteOfficialStateWriter } from '../SqliteOfficialStateWriter';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readDurableOfficialGameResult } from './PostseasonResultsFromMatches';
import { readCompletedMatchScoringHistory, derivePhysicalClosureLineScore } from './PhysicalPlayClosureEvidenceFromSqlite';
import { foulApplicationOwnershipRows as ownerRows, foulTerminalApplicationRawIdentities,
  foulTerminalApplicationOriginalScopeClaim } from './ActualFoulTerminalApplicationOwnership';
import { originalFoulMetadataValues as values } from './OriginalFoulOwnershipMetadata';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import type { OfficialPlayerOutcomeSource } from './OfficialPlayerOutcomeEvidenceFromSqlite';

export type CompletedMatchPlayerOutcomePlay = Readonly<{
  applicationId: string; playId: number; durableRevision: number;
  scoring: PersistedOfficialScoring; sources: readonly OfficialPlayerOutcomeSource[];
}>;
export type CompletedMatchPlayerOutcomeCensus = Readonly<{
  finalResult: OfficialGameResult; plays: readonly CompletedMatchPlayerOutcomePlay[];
}>;

const owners: readonly OfficialPlayerOutcomeSource['owner'][] = [
  'physical_play_closures', 'actual_live_play_closures',
  'actual_foul_terminal_applications', 'pa_terminal_v1_transitions',
];

/** Discovery is not proof. Independent raw mirrors retain duplicate/escaped
 * and array-wrapped identity claims before the original owner authenticates.
 * Only the four existing attribution owners are candidates. */
const discover = (db: DatabaseSync, gameId: string, plays: readonly Omit<CompletedMatchPlayerOutcomePlay, 'sources'>[]) => {
  const result = plays.map(() => [] as OfficialPlayerOutcomeSource[]);
  for (const owner of owners) {
    const reserved = owner === 'pa_terminal_v1_transitions', document = reserved ? 'snapshot_json' : 'proposal_json';
    const rows = ownerRows(db, owner, { source_id: 'TEXT', game_id: 'TEXT', play_id: 'INTEGER', application_id: 'TEXT',
      source_json: 'TEXT', [document]: 'TEXT', ...(!reserved ? { result_json: 'TEXT' as const } : {}) });
    for (const row of rows) {
      const read = (column: string, paths: readonly (readonly string[])[]) => paths.flatMap(path => values(db, String(row[column]), path));
      const physical = owner === 'physical_play_closures', terminal = owner === 'actual_foul_terminal_applications';
      const official = (column: string, root: string, keys: readonly string[]) => read(column,
        ['receipt', 'activation', 'result'].flatMap(branch => keys.map(key => [root, branch, key])));
      // Physical closure IDs are its official application IDs. Other owners'
      // closure/Source labels stay in their own domains and are never compared
      // to a different owner's application ID or unrelated game's closure.
      const apps = terminal ? foulTerminalApplicationRawIdentities(db, row).applicationIds : [row.application_id,
        ...read('source_json', [['applicationId']]), ...read(document, reserved
          ? [['source', 'applicationId'], ['officialApplication', 'applicationId'], ['scoring', 'officialApplicationId']]
          : [['source', 'applicationId'], ['application', 'applicationId']]),
        ...official(document, reserved ? 'official' : 'expectedOfficial', physical ? ['applicationId', 'closureId'] : ['applicationId']),
        ...(!reserved ? official('result_json', 'official', physical ? ['applicationId', 'closureId'] : ['applicationId']) : [])];
      const games = [row.game_id, ...read(document, reserved
        ? [['lineage', 'gameId'], ['officialApplication', 'matchId'], ['official', 'result', 'gameId'], ['scoring', 'matchId']]
        : physical ? [['application', 'matchId'], ['physicalPitch', 'frame', 'gameId'], ['worldFixture', 'game', 'gameId']]
          : [['gameId'], ['application', 'matchId']]),
        ...(!reserved && !terminal ? read('result_json', physical ? [['gameId'], ['official', 'result', 'gameId']]
          : [['official', 'result', 'gameId']]) : [])];
      const ids = [row.play_id, ...read(document, reserved
        ? [['lineage', 'playId'], ['officialApplication', 'match', 'playId'], ['official', 'receipt', 'previousPlayId'], ['scoring', 'record', 'playId']]
        : physical ? [['application', 'match', 'playId'], ['physicalPitch', 'frame', 'match', 'playId'], ['expectedOfficial', 'receipt', 'previousPlayId']]
          : [['playId'], ['application', 'match', 'playId'], ['expectedOfficial', 'receipt', 'previousPlayId']]),
        ...(!reserved && !terminal ? read('result_json', physical ? [['playId'], ['official', 'receipt', 'previousPlayId']]
          : [['official', 'receipt', 'previousPlayId']]) : [])];
      for (const [index, play] of plays.entries()) if (apps.includes(play.applicationId) || (terminal
        ? foulTerminalApplicationOriginalScopeClaim(db, row, gameId, play.playId)
        : games.includes(gameId) && (ids.includes(play.playId) || physical && ids.includes(String(play.playId))))) {
        if (typeof row.source_id !== 'string' || !row.source_id || row.source_id.trim() !== row.source_id
          || row.application_id !== play.applicationId || row.game_id !== gameId || row.play_id !== play.playId) {
          throw new Error('completed Match outcome original owner identity differs');
        }
        result[index].push({ owner, sourceId: row.source_id });
      }
    }
  }
  return result;
};

/** Completed Match/fixture and the contiguous accepted scoring history are the
 * census authority. The final foul completion keeps its pending receipt/hash:
 * it must never enter the prior-play reader as a continuing terminal play. */
export const readCompletedMatchPlayerOutcomeCensus = (db: DatabaseSync, gameId: string): CompletedMatchPlayerOutcomeCensus =>
  withBattedVenueLegalReadSnapshot(db, () => {
    const writer = new SqliteOfficialStateWriter(db), final = readDurableOfficialGameResult(writer, gameId);
    if (!final || !Number.isSafeInteger(final.durableRevision) || final.durableRevision < 1) {
      throw new Error('completed Match outcome requires a final Match and fixture');
    }
    const applications = ownerRows(db, 'applications', { application_id: 'TEXT', match_id: 'TEXT', closure_id: 'TEXT', request_hash: 'TEXT', result_json: 'TEXT' })
      .filter(row => row.match_id === gameId || [['result', 'gameId'], ['finalResult', 'gameId'], ['pendingPostPlay', 'matchId']]
        .some(path => values(db, String(row.result_json), path).includes(gameId)));
    if (applications.length !== final.durableRevision || applications.some(row => row.match_id !== gameId)) {
      throw new Error('completed Match outcome official history differs');
    }
    const last = applications.filter(row => row.application_id === final.applicationId);
    if (last.length !== 1) throw new Error('completed Match outcome final application is missing');
    const lastResult = JSON.parse(String(last[0].result_json));
    const history = readCompletedMatchScoringHistory(db, final);
    const lastHistory = history.at(-1)!;
    if (history.length !== final.durableRevision || lastHistory.applicationId !== final.applicationId
      || json(lastHistory.after) !== json(writer.getMatch(gameId)!.matchState)
      || json(lastResult.result ?? lastResult.finalResult) !== json(final)
      || json(derivePhysicalClosureLineScore(history)) !== json(final.lineScore)) {
      throw new Error('completed Match outcome final scoring history differs');
    }
    const plays = history.map((play, index) => ({ applicationId: play.applicationId, playId: play.before.playId,
      durableRevision: index + 1, scoring: play.scoring }));
    if (new Set(plays.map(play => play.playId)).size !== plays.length) throw new Error('completed Match outcome repeated official play');
    const candidates = discover(db, gameId, plays);
    return freeze({ finalResult: final, plays: plays.map((play, index) => ({ ...play, sources: candidates[index] })) });
  });
