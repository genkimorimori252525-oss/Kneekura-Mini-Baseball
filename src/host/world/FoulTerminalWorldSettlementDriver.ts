import { isDeepStrictEqual } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { resolveOfficialGameBoundary, type OfficialGameBoundaryInput } from '../../core/world/competition/OfficialGameCompletion';
import { settleRegularSeasonGame } from '../../core/world/competition/OfficialSeasonEconomySettlement';
import { deriveOfficialPendingNonLiveResult, type PersistOfficialPendingNonLiveInput } from '../OfficialPendingPostPlay';
import { foulTerminalCompletedOfficial } from '../OfficialTerminalPostPlayReceipt';
import type { SqliteActualFoulTerminalApplicationStore } from './ActualFoulTerminalApplication';
import type { PersistOfficialCompletedTerminalResult } from './ActualFoulTerminalPostPlayCompletion';
import type { OfficialWorldSettlementRequest } from './OfficialWorldSettlementDriver';
import { assertDurableOfficialGameFinal, assertOfficialWorldSettlementScope } from './OfficialWorldSettlementDriver';
import type { DurableWorldApplication } from './SqliteWorldSettlementStore';

export type CompletedFoulTerminalGame = Readonly<{
  careerId: string; terminalSourceId: string; originalInput: PersistOfficialPendingNonLiveInput;
  official: Extract<PersistOfficialCompletedTerminalResult, { finalResult: unknown }>;
  game: OfficialGameBoundaryInput;
}>;
export type FoulTerminalWorldSettlementStores = Pick<OfficialWorldSettlementRequest, 'matchStore' | 'worldStore'> & Readonly<{
  foulTerminal: Pick<SqliteActualFoulTerminalApplicationStore, 'read'>;
}>;
export type DurableFoulTerminalWorldSettlementRequest = Pick<OfficialWorldSettlementRequest,
  'worldInput' | 'expectedSeasonRevision' | 'expectedClubRevision'> & Readonly<{
  kind: 'foul_terminal_world_settlement_v1'; final: CompletedFoulTerminalGame;
}>;
export type FoulTerminalWorldSettlementResult = Readonly<{
  final: CompletedFoulTerminalGame['official']; world: DurableWorldApplication;
}>;

/** The existing completion owner authenticates original history, official
 * mirrors, scoring and all workload. Keep its pending input/hash and completion
 * receipt intact; neither is a legacy applyAndFinalize request. */
export const readCompletedFoulTerminalGame = (
  owner: FoulTerminalWorldSettlementStores['foulTerminal'], terminalSourceId: string,
): CompletedFoulTerminalGame => {
  const saved = cloneInert(owner.read(terminalSourceId));
  if (!saved || saved.status !== 'POST_PLAY_COMPLETED_FINAL' || saved.source.sourceId !== terminalSourceId
    || !('finalResult' in saved.result.completion) || !saved.proposal.applicationBody.game) {
    throw new Error('foul terminal final completion is missing or incomplete');
  }
  const p = saved.proposal, originalInput: PersistOfficialPendingNonLiveInput = { ...p.applicationBody,
    origin: saved.result.official.pendingPostPlay.origin };
  const pending = deriveOfficialPendingNonLiveResult(originalInput, p.originalOfficialRevision + 1);
  if (!isDeepStrictEqual(pending, saved.result.official)) throw new Error('foul terminal original pending receipt differs');
  const official = foulTerminalCompletedOfficial(pending, saved.result.completion);
  if (!('finalResult' in official)) throw new Error('foul terminal final result is missing');
  const game = { ...p.applicationBody.game!, gameId: p.gameId, priorMatch: p.applicationBody.match,
    application: official.receipt, lineScore: official.finalResult.lineScore };
  const boundary = resolveOfficialGameBoundary(game);
  if (p.source.sourceId !== terminalSourceId || originalInput.matchId !== game.gameId
    || p.playId !== game.priorMatch.playId || p.seasonFixture.competitionEditionId !== game.seasonId
    || p.seasonFixture.game.gameId !== game.gameId || p.seasonFixture.game.homeClubId !== game.homeClubId
    || p.seasonFixture.game.awayClubId !== game.awayClubId || boundary.kind !== 'GAME_FINAL'
    || !isDeepStrictEqual(boundary.result, official.finalResult)) throw new Error('foul terminal completed game scope differs');
  return Object.freeze({ careerId: p.seasonFixture.careerId, terminalSourceId, originalInput, official, game });
};

/** Delivery is World-only. Even a completed outbox retry authenticates the
 * original terminal before accepting its retained request or persisted result. */
export const settleCompletedFoulTerminalWorldGame = (
  request: DurableFoulTerminalWorldSettlementRequest,
  stores: FoulTerminalWorldSettlementStores,
  completed?: FoulTerminalWorldSettlementResult,
): FoulTerminalWorldSettlementResult => {
  const final = readCompletedFoulTerminalGame(stores.foulTerminal, request.final.terminalSourceId);
  if (request.kind !== 'foul_terminal_world_settlement_v1' || !isDeepStrictEqual(final, request.final)
    || final.careerId !== request.worldInput.attendance.careerId) throw new Error('foul terminal World request differs from original completion');
  assertOfficialWorldSettlementScope(final.game, request.worldInput);
  assertDurableOfficialGameFinal(stores.matchStore, final.game.gameId, final.official.receipt, final.official.finalResult);
  const settlement = settleRegularSeasonGame({ ...request.worldInput, game: final.game });
  if (request.expectedSeasonRevision !== request.worldInput.priorResults.length
    || request.expectedClubRevision !== request.worldInput.homeClub.revision
    || !isDeepStrictEqual(settlement.gameResult, final.official.finalResult)) throw new Error('foul terminal World settlement revision or final differs');
  const world = completed ? stores.worldStore.readApplication(final.official.receipt.applicationId)
    : stores.worldStore.persist(settlement, request.expectedSeasonRevision, request.expectedClubRevision);
  if (!world || !isDeepStrictEqual(world.settlement, settlement) || world.seasonRevision !== request.expectedSeasonRevision + 1
    || world.clubRevision !== settlement.economy.state.revision || completed && (!isDeepStrictEqual(completed.world, world)
      || !isDeepStrictEqual(completed.final, final.official))) throw new Error('foul terminal final lacks authentic durable World settlement');
  return Object.freeze({ final: final.official, world });
};
