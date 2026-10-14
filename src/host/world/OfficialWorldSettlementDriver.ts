import { isDeepStrictEqual } from 'node:util';
import type { OfficialGameBoundaryInput, OfficialGameResult } from '../../core/world/competition/OfficialGameCompletion';
import type { OfficialStateApplicationReceipt } from '../../core/adjudication/NextPlayActivation';
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
  assertOfficialWorldSettlementScope({ ...finalInput.game, gameId: finalInput.matchId }, worldInput);
  const final = matchStore.applyAndFinalize(finalInput);
  if (final.receipt.applicationId !== finalInput.applicationId) throw new Error('official Match final is not durable or authentic');
  assertDurableOfficialGameFinal(matchStore, finalInput.matchId, final.receipt, final.result);

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

export const assertOfficialWorldSettlementScope = (
  game: Pick<OfficialGameBoundaryInput, 'gameId' | 'seasonId' | 'homeClubId' | 'awayClubId'>,
  worldInput: OfficialWorldSettlementRequest['worldInput'],
): void => {
  const scheduled = worldInput.schedule.games.find((scheduledGame) =>
    scheduledGame.gameId === game.gameId);
  if (!scheduled
    || worldInput.schedule.seasonId !== game.seasonId
    || scheduled.homeClubId !== game.homeClubId
    || scheduled.awayClubId !== game.awayClubId
    || worldInput.homeClub.identity.clubId !== scheduled.homeClubId
    || worldInput.homeClub.careerId !== worldInput.attendance.careerId
    || worldInput.attendance.gameId !== game.gameId
    || worldInput.revenuePolicy.seasonId !== game.seasonId) {
    throw new Error('official world settlement scope mismatch');
  }
};

export const assertDurableOfficialGameFinal = (
  matchStore: Pick<SqliteOfficialStateStore, 'getMatch'>, gameId: string,
  receipt: OfficialStateApplicationReceipt, result: OfficialGameResult,
): void => {
  const durableMatch = matchStore.getMatch(gameId);
  if (!durableMatch || durableMatch.finalResult === null
    || durableMatch.durableRevision !== receipt.durableRevision
    || receipt.applicationId !== result.applicationId
    || !isDeepStrictEqual(durableMatch.finalResult, result)
    || !isDeepStrictEqual(durableMatch.matchState,
      receipt.appliedMatchState)) {
    throw new Error('official Match final is not durable or authentic');
  }
};
