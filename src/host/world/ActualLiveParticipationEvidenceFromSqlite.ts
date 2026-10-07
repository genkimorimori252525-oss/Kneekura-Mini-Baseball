import type { DatabaseSync } from 'node:sqlite';
import type { ActualLiveParticipationReceipt, OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actualLivePlayClosureEvidenceFromSqlite, actualLiveClosureApplicationRows,
  assertActualLiveClosureStage, type ActualLivePlayClosureProposal } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertParticipationApplicationOwnership, assertParticipationClosureOwnership,
  assertParticipationDomesticSeason, assertParticipationMetadataNode, participationReceiptId,
  readOwnedParticipationBindingJson } from './ActualLiveParticipationMetadata';

type Db = Pick<DatabaseSync, 'prepare'>;
export type ActualLiveParticipationEvidence = Readonly<{
  receipt: ActualLiveParticipationReceipt; proposal: ActualLivePlayClosureProposal;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const bindingFields = ['gameId', 'careerId', 'competitionEditionId', 'gameDay', 'clubId', 'side',
  'playerId', 'personId', 'personLinkSourceId', 'rosterRevision', 'fixtureEventId'] as const;

/** Reconstruct the original persisted fact. No live authority, replacement closure, or cross-transaction cache. */
export const deriveActualLiveParticipationEvidence = (db: Db, gameId: string,
  playerId: string, closureSourceId: string): ActualLiveParticipationEvidence => {
  if (![gameId, playerId, closureSourceId].every(id)) throw new Error('invalid actual-live participation reference');
  const closure = actualLivePlayClosureEvidenceFromSqlite(db).read(closureSourceId);
  if (!closure || closure.status !== 'OFFICIAL_APPLIED' || !closure.officialApplied || !closure.result) {
    throw new Error('actual-live participation requires an applied original closure');
  }
  const p = closure.proposal, receipt = p.expectedOfficial.receipt;
  if (p.gameId !== gameId || p.source.sourceId !== closureSourceId || p.application.matchId !== gameId
    || !integer(p.playId) || !integer(p.application.expectedDurableRevision) || !integer(receipt.durableRevision)
    || p.application.match.playId !== p.playId || receipt.previousPlayId !== p.playId
    || receipt.applicationId !== p.application.applicationId || receipt.closureId !== closureSourceId
    || receipt.durableRevision !== p.application.expectedDurableRevision + 1) {
    throw new Error('actual-live participation original game or revision differs');
  }
  assertParticipationClosureOwnership(db, p);
  const owners = actualLiveClosureApplicationRows(db, p.application.applicationId);
  if (owners.length !== 1 || owners[0].source_id !== closureSourceId) throw new Error('actual-live participation closure application owner differs');
  assertParticipationApplicationOwnership(db, p);
  assertActualLiveClosureStage(db, p, true);
  const actors = p.actors, participants = p.workload.participants;
  if (actors.length !== 10 || new Set(actors.map(actor => actor.binding.playerId)).size !== 10
    || new Set(actors.map(actor => actor.person.personId)).size !== 10 || participants.length !== 10
    || new Set(participants.map(actor => actor.playerId)).size !== 10
    || participants.filter(actor => actor.role === 'BATTER_RUNNER').length !== 1
    || participants.filter(actor => actor.role === 'DEFENDER').length !== 9) {
    throw new Error('actual-live participation original actor membership differs');
  }
  const selected = actors.filter(actor => actor.binding.playerId === playerId);
  if (selected.length !== 1) throw new Error('player is absent from original actual-live actors');
  const fieldingSide = p.application.match.half === 'top' ? 'HOME' : 'AWAY';
  for (const actor of actors) {
    const b = actor.binding, person = actor.person;
    const document = readOwnedParticipationBindingJson(db, gameId, b.playerId);
    if (document === null || json(JSON.parse(document)) !== json(b)
      || Object.hasOwn(b, 'nationalRegistrationEventId') || Object.hasOwn(b, 'nationalRosterSnapshotId')) {
      throw new Error('actual-live participation original domestic binding differs');
    }
    for (const key of bindingFields) {
      const value = b[key];
      if (key === 'gameDay' || key === 'rosterRevision') {
        if (!integer(value)) throw new Error('actual-live participation binding revision or day differs');
        assertParticipationMetadataNode(db, document, [key], 'integer', value);
      } else {
        if (!id(value)) throw new Error('actual-live participation binding identity differs');
        assertParticipationMetadataNode(db, document, [key], 'text', value);
      }
    }
    const role = participants.find(participant => participant.playerId === b.playerId);
    if (!role || role.personId !== b.personId || role.clubId !== b.clubId
      || (role.role === 'DEFENDER' ? fieldingSide : fieldingSide === 'HOME' ? 'AWAY' : 'HOME') !== b.side
      || b.gameId !== gameId || b.careerId !== p.seasonFixture.careerId
      || b.competitionEditionId !== p.seasonFixture.seasonId || b.fixtureEventId !== p.fixture.fixture_event_id
      || p.seasonFixture.game.gameId !== gameId || b.gameDay !== actors[0].binding.gameDay
      || b.clubId !== (b.side === 'HOME' ? p.seasonFixture.game.homeClubId : p.seasonFixture.game.awayClubId)
      || person.playerId !== b.playerId || person.personId !== b.personId || person.careerId !== b.careerId
      || person.sourceId !== b.personLinkSourceId || person.rosterRevision > b.rosterRevision || person.acceptedAtDay > b.gameDay) {
      throw new Error('actual-live participation original role or Person scope differs');
    }
  }
  // The original closure's first actor is its authenticated current batter, not a next-World runner.
  if (participants.find(actor => actor.role === 'BATTER_RUNNER')?.playerId !== actors[0].binding.playerId) {
    throw new Error('actual-live participation original batter role differs');
  }
  const binding: OfficialParticipantBinding = selected[0].binding;
  assertParticipationDomesticSeason(db, binding.careerId, binding.competitionEditionId);
  const role = participants.find(actor => actor.playerId === playerId)!.role;
  return freeze({ proposal: p, receipt: { evidenceKind: 'ACTUAL_LIVE_V1' as const,
    receiptId: participationReceiptId(gameId, playerId), binding, actorKind: role,
    closureSourceId, closureApplicationId: p.application.applicationId, closureProposalHash: hash(p),
    playedPlayId: p.playId, durableRevision: receipt.durableRevision } });
};

/** Fresh admission only; historical read and exact retry intentionally do not call this fence. */
export const assertActualLiveParticipationCurrent = (db: Db, evidence: ActualLiveParticipationEvidence): void => {
  assertActualLiveClosureStage(db, evidence.proposal, true, true);
};
