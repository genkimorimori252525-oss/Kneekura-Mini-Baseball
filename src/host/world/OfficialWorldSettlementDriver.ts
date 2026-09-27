import { isDeepStrictEqual } from 'node:util';
import type { RegularSeasonGameInput } from
  '../../core/world/competition/OfficialSeasonEconomySettlement';
import { settleRegularSeasonGame } from
  '../../core/world/competition/OfficialSeasonEconomySettlement';
import type { PersistOfficialFinalInput,
  PersistOfficialFinalResult,
  SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { DurableWorldApplication,
  SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';

export type OfficialWorldSettlementRequest = Readonly<{
  matchStore: SqliteOfficialStateStore;
  worldStore: SqliteWorldSettlementStore;
  finalInput: PersistOfficialFinalInput;
  worldInput: Omit<RegularSeasonGameInput, 'game'>;
  expectedSeasonRevision: number;
  expectedClubRevision: number;
}>;
export type OfficialWorldSettlementResult = Readonly<{
  final: PersistOfficialFinalResult;
  world: DurableWorldApplication;
}>;

/**
 * Match and world use distinct databases. Retain the exact request until this
 * returns: after a crash, retrying the same applicationId completes whichever
 * durable stage is missing. This is recovery by replay, not cross-DB atomicity.
 */
export const applyAndSettleOfficialRegularSeasonGame = (
  request: OfficialWorldSettlementRequest,
): OfficialWorldSettlementResult => {
  const { matchStore, worldStore, finalInput, worldInput } = request;
  const scheduled = worldInput.schedule.games.find((game) =>
    game.gameId === finalInput.matchId);
  if (!scheduled
    || worldInput.schedule.seasonId !== finalInput.game.seasonId
    || scheduled.homeClubId !== finalInput.game.homeClubId
    || scheduled.awayClubId !== finalInput.game.awayClubId
    || worldInput.homeClub.identity.clubId !== scheduled.homeClubId
    || worldInput.homeClub.careerId !== worldInput.attendance.careerId
    || worldInput.attendance.gameId !== finalInput.matchId
    || worldInput.revenuePolicy.seasonId !== finalInput.game.seasonId) {
    throw new Error('official world settlement scope mismatch');
  }

  const final = matchStore.applyAndFinalize(finalInput);
  const durableMatch = matchStore.getMatch(finalInput.matchId);
  if (!durableMatch || durableMatch.finalResult === null
    || durableMatch.durableRevision !== final.receipt.durableRevision
    || final.receipt.applicationId !== finalInput.applicationId
    || !isDeepStrictEqual(durableMatch.finalResult, final.result)
    || !isDeepStrictEqual(durableMatch.matchState,
      final.receipt.appliedMatchState)) {
    throw new Error('official Match final is not durable or authentic');
  }

  const game = { ...finalInput.game, gameId: finalInput.matchId,
    priorMatch: finalInput.match, application: final.receipt };
  const settlement = settleRegularSeasonGame({ ...worldInput, game });
  if (!isDeepStrictEqual(settlement.gameResult, final.result)) {
    throw new Error('official Match final result mismatch');
  }
  const world = worldStore.persist(settlement,
    request.expectedSeasonRevision, request.expectedClubRevision);
  return Object.freeze({ final, world });
};
