import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import { evaluateRosterParticipation } from '../../core/world/roster/RosterQueries';
import type { AcceptedPublicCareerEvent } from '../../core/world/popularity/PopularityObservationSource';
import type { PersistOfficialPlayResult, PersistOfficialFinalResult } from '../SqliteOfficialStateStore';

const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;

export type OfficialParticipantBinding = Readonly<{
  gameId: string; careerId: string; competitionEditionId: string;
  gameDay: number; clubId: string; side: 'HOME' | 'AWAY';
  playerId: string; personId: string; personLinkSourceId: string;
  rosterRevision: number; fixtureEventId: string;
  /** National registration is separate from global Club assignment. Both pins are required. */
  nationalRegistrationEventId?: string; nationalRosterSnapshotId?: string;
}>;

export type AcceptedNationalParticipationRegistration = Readonly<{
  careerId: string; competitionEditionId: string; nationId: string;
  playerId: string; personId: string; personLinkSourceId: string; eventId: string;
  registeredAtDay: number; rosterRevision: number; rosterSnapshotId: string;
}>;

/** The host supplies accepted fixture, roster, and player/person identity sources. */
export type ParticipationAuthority = Readonly<{
  readGame(gameId: string): Readonly<{
    careerId: string; competitionEditionId: string; gameDay: number;
    homeClubId: string; awayClubId: string; fixtureEventId: string;
    competitionScope?: 'NATIONAL';
  }> | null;
  readNationalRegistration?(binding: OfficialParticipantBinding): AcceptedNationalParticipationRegistration | null;
  readRoster(careerId: string, clubId: string): RosterState | null;
  readPersonLink(playerId: string, sourceId: string): Readonly<{
    personId: string; sourceId: string;
  }> | null;
}>;

export type DurableParticipationReceipt = Readonly<{
  receiptId: string; binding: OfficialParticipantBinding;
  actorKind: 'DEFENDER' | 'RUNNER';
  activationApplicationId: string; closureApplicationId: string;
  playedPlayId: number; durableRevision: number;
}>;

type ApplicationRow = { match_id: string; result_json: string };
type BindingRow = { binding_json: string };
type ReceiptRow = { receipt_json: string };
type FixtureRow = { fixture_event_id: string };
type MatchRow = { durable_revision: number };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const participationReceiptId = (gameId: string, playerId: string): string =>
  `official-participation:${createHash('sha256')
    .update(JSON.stringify([gameId, playerId])).digest('hex')}`;

/** Reads the actual official application ledger; no caller-provided play result is trusted. */
export class SqliteOfficialParticipationStore {
  private readonly db: InstanceType<typeof DatabaseSync>;
  constructor(path: string, private readonly authority: ParticipationAuthority) {
    if (!id(path) || !authority || typeof authority.readGame !== 'function'
      || typeof authority.readRoster !== 'function'
      || typeof authority.readPersonLink !== 'function') {
      throw new Error('participation requires an accepted source authority');
    }
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS official_participant_bindings (
      game_id TEXT NOT NULL, player_id TEXT NOT NULL, binding_json TEXT NOT NULL,
      PRIMARY KEY(game_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS official_participation_receipts (
      receipt_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, player_id TEXT NOT NULL,
      receipt_json TEXT NOT NULL, UNIQUE(game_id, player_id),
      FOREIGN KEY(game_id, player_id) REFERENCES official_participant_bindings(game_id, player_id)
    );`);
  }

  close(): void { this.db.close(); }

  bindPregame(input: OfficialParticipantBinding): OfficialParticipantBinding {
    if (!id(input.gameId) || !id(input.careerId) || !id(input.competitionEditionId)
      || !day(input.gameDay) || !id(input.clubId) || !id(input.playerId)
      || !id(input.personId) || !id(input.personLinkSourceId)
      || !id(input.fixtureEventId) || !day(input.rosterRevision)
      || (input.nationalRegistrationEventId !== undefined && !id(input.nationalRegistrationEventId))
      || (input.nationalRosterSnapshotId !== undefined && !id(input.nationalRosterSnapshotId))
      || !['HOME', 'AWAY'].includes(input.side)) {
      throw new Error('invalid pregame participant binding');
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.binding(input.gameId, input.playerId);
      if (existing) {
        if (!same(existing, input)) throw new Error('pregame binding already differs');
        this.db.exec('COMMIT');
        return existing;
      }
      const game = this.authority.readGame(input.gameId);
      const national = game?.competitionScope === 'NATIONAL';
      const roster = national ? null : this.authority.readRoster(input.careerId, input.clubId);
      const registration = national ? this.authority.readNationalRegistration?.(input) ?? null : null;
      const link = this.authority.readPersonLink(input.playerId,
        input.personLinkSourceId);
      const fixture = this.db.prepare('SELECT fixture_event_id FROM official_fixtures WHERE game_id=?')
        .get(input.gameId) as FixtureRow | undefined;
      const match = this.db.prepare('SELECT durable_revision FROM matches WHERE match_id=?')
        .get(input.gameId) as MatchRow | undefined;
      const acceptedRoster = national ? registration !== null
        && registration.careerId === input.careerId && registration.competitionEditionId === input.competitionEditionId
        && registration.nationId === input.clubId && registration.playerId === input.playerId
        && registration.personId === input.personId && registration.personLinkSourceId === input.personLinkSourceId
        && registration.eventId === input.nationalRegistrationEventId
        && registration.rosterSnapshotId === input.nationalRosterSnapshotId
        && registration.rosterRevision === input.rosterRevision
        && day(registration.registeredAtDay) && registration.registeredAtDay <= input.gameDay
        : input.nationalRegistrationEventId === undefined && input.nationalRosterSnapshotId === undefined
          && roster !== null && roster.careerId === input.careerId && roster.revision === input.rosterRevision
          && roster.effectiveDay <= input.gameDay && evaluateRosterParticipation(roster, {
            playerId: input.playerId, clubId: input.clubId, competitionEditionId: input.competitionEditionId,
          }).eligible;
      if (!game || !acceptedRoster || !link || !fixture
        || fixture.fixture_event_id !== input.fixtureEventId
        || match && match.durable_revision !== 0
        || game.careerId !== input.careerId
        || game.competitionEditionId !== input.competitionEditionId
        || game.gameDay !== input.gameDay
        || game.fixtureEventId !== input.fixtureEventId
        || (input.side === 'HOME' ? game.homeClubId : game.awayClubId) !== input.clubId
        || link.personId !== input.personId
        || link.sourceId !== input.personLinkSourceId
      ) {
        throw new Error('pregame binding lacks accepted fixture, roster, or person source');
      }
      this.db.prepare(`INSERT INTO official_participant_bindings
        (game_id, player_id, binding_json) VALUES (?, ?, ?)`)
        .run(input.gameId, input.playerId, JSON.stringify(input));
      this.db.exec('COMMIT');
      return Object.freeze({ ...input });
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private binding(gameId: string, playerId: string): OfficialParticipantBinding | null {
    const row = this.db.prepare(`SELECT binding_json FROM official_participant_bindings
      WHERE game_id=? AND player_id=?`).get(gameId, playerId) as BindingRow | undefined;
    return row ? JSON.parse(row.binding_json) as OfficialParticipantBinding : null;
  }

  private application(gameId: string, applicationId: string):
  PersistOfficialPlayResult | PersistOfficialFinalResult {
    const row = this.db.prepare(`SELECT match_id, result_json FROM applications
      WHERE application_id=?`).get(applicationId) as ApplicationRow | undefined;
    if (!row || row.match_id !== gameId) throw new Error('official application is not durable for game');
    return JSON.parse(row.result_json) as PersistOfficialPlayResult | PersistOfficialFinalResult;
  }

  private verify(receipt: DurableParticipationReceipt): void {
    const first = this.application(receipt.binding.gameId, receipt.activationApplicationId);
    const second = this.application(receipt.binding.gameId, receipt.closureApplicationId);
    if (!('activation' in first) || !first.nextWorld
      || first.receipt.applicationId !== receipt.activationApplicationId
      || first.activation.applicationId !== receipt.activationApplicationId
      || first.activation.durableRevision !== first.receipt.durableRevision
      || first.activation.nextMatchState.playId !== receipt.playedPlayId
      || second.receipt.applicationId !== receipt.closureApplicationId
      || second.receipt.previousPlayId !== receipt.playedPlayId
      || second.receipt.durableRevision !== first.receipt.durableRevision + 1
      || second.receipt.durableRevision !== receipt.durableRevision) {
      throw new Error('participation play application chain is invalid');
    }
    const fieldingSide = first.activation.nextMatchState.half === 'top' ? 'HOME' : 'AWAY';
    const actors = receipt.actorKind === 'DEFENDER'
      ? first.nextWorld.defenders : first.nextWorld.runners;
    if ((receipt.actorKind === 'DEFENDER' ? fieldingSide
      : fieldingSide === 'HOME' ? 'AWAY' : 'HOME') !== receipt.binding.side
      || actors.filter((actor) => actor.playerId === receipt.binding.playerId).length !== 1) {
      throw new Error('bound player is absent from durable play actors');
    }
  }

  confirmPlayed(gameId: string, playerId: string, actorKind: 'DEFENDER' | 'RUNNER',
    activationApplicationId: string, closureApplicationId: string): DurableParticipationReceipt {
    if (!id(gameId) || !id(playerId) || !id(activationApplicationId)
      || !id(closureApplicationId) || activationApplicationId === closureApplicationId
      || !['DEFENDER', 'RUNNER'].includes(actorKind)) {
      throw new Error('invalid participation application reference');
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const binding = this.binding(gameId, playerId);
      if (!binding) throw new Error('pregame player binding is absent');
      const first = this.application(gameId, activationApplicationId);
      const second = this.application(gameId, closureApplicationId);
      if (!('activation' in first)) throw new Error('activation application is absent');
      const receipt: DurableParticipationReceipt = {
        receiptId: participationReceiptId(gameId, playerId), binding,
        actorKind, activationApplicationId, closureApplicationId,
        playedPlayId: first.activation.nextMatchState.playId,
        durableRevision: second.receipt.durableRevision,
      };
      this.verify(receipt);
      const existing = this.readReceipt(receipt.receiptId);
      if (existing) {
        if (!same(existing, receipt)) throw new Error('player participation already recorded differently');
        this.db.exec('COMMIT');
        return existing;
      }
      this.db.prepare(`INSERT INTO official_participation_receipts
        (receipt_id, game_id, player_id, receipt_json) VALUES (?, ?, ?, ?)`)
        .run(receipt.receiptId, gameId, playerId, JSON.stringify(receipt));
      this.db.exec('COMMIT');
      return Object.freeze(receipt);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  readReceipt(receiptId: string): DurableParticipationReceipt | null {
    if (!id(receiptId)) throw new Error('invalid participation receipt ID');
    const row = this.db.prepare(`SELECT receipt_json FROM official_participation_receipts
      WHERE receipt_id=?`).get(receiptId) as ReceiptRow | undefined;
    if (!row) return null;
    const receipt = JSON.parse(row.receipt_json) as DurableParticipationReceipt;
    if (receipt.receiptId !== receiptId
      || receipt.receiptId !== participationReceiptId(
        receipt.binding.gameId, receipt.binding.playerId)
      || !same(this.binding(receipt.binding.gameId, receipt.binding.playerId), receipt.binding)) {
      throw new Error('participation receipt does not match binding');
    }
    this.verify(receipt);
    return Object.freeze(receipt);
  }

  /** Only a stored receipt can become an accepted OFFICIAL_GAME Career source. */
  readAcceptedPopularityEvent(receiptId: string): AcceptedPublicCareerEvent | null {
    const receipt = this.readReceipt(receiptId);
    if (!receipt) return null;
    const binding = receipt.binding;
    return Object.freeze({ eventId: receipt.receiptId,
      careerId: binding.careerId, personId: binding.personId,
      kind: 'OFFICIAL_GAME', sourceRecordId: receipt.receiptId,
      acceptedRevision: receipt.durableRevision,
      occurredAtDay: binding.gameDay, acceptedAtDay: binding.gameDay,
      transfer: null });
  }
}
