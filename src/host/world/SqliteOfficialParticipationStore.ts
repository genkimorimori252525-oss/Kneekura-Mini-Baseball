import type { DatabaseSync as NativeDatabase } from 'node:sqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import { evaluateRosterParticipation } from '../../core/world/roster/RosterQueries';
import type { AcceptedPublicCareerEvent } from '../../core/world/popularity/PopularityObservationSource';
import type { PersistOfficialPlayResult, PersistOfficialFinalResult } from '../SqliteOfficialStateStore';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { deriveActualLiveParticipationEvidence, assertActualLiveParticipationCurrent } from './ActualLiveParticipationEvidenceFromSqlite';
import { participationReceiptId, readOwnedParticipationReceiptRow, readOwnedParticipationBindingJson,
  participationHasRawDiscriminator, assertTaggedParticipationFields } from './ActualLiveParticipationMetadata';
import { deriveCompletedPlayParticipationEvidence, assertCompletedPlayParticipationCurrent } from './CompletedPlayParticipationEvidenceFromSqlite';
import { readTaggedParticipationReceipt } from './TaggedParticipationEvidenceFromSqlite';

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
export type ActualLiveParticipationReceipt = Readonly<{
  evidenceKind: 'ACTUAL_LIVE_V1' | 'NATIONAL_ACTUAL_LIVE_V1'; receiptId: string; binding: OfficialParticipantBinding;
  actorKind: 'DEFENDER' | 'BATTER_RUNNER'; closureSourceId: string; closureApplicationId: string;
  closureProposalHash: string; playedPlayId: number; durableRevision: number;
}>;
export type CompletedPlayParticipationReceipt = Readonly<{
  evidenceKind: 'PHYSICAL_PLAY_V1' | 'FOUL_TERMINAL_V1' | 'NATIONAL_PHYSICAL_PLAY_V1' | 'NATIONAL_FOUL_TERMINAL_V1'; receiptId: string; binding: OfficialParticipantBinding;
  actorKind: 'DEFENDER' | 'BATTER' | 'RUNNER'; closureSourceId: string; closureApplicationId: string;
  closureProposalHash: string; playedPlayId: number; durableRevision: number;
}>;
export type OfficialParticipationReceipt = DurableParticipationReceipt | ActualLiveParticipationReceipt | CompletedPlayParticipationReceipt;
export type AcceptedPitcherPlay = Omit<DurableParticipationReceipt, 'receiptId' | 'actorKind'> & Readonly<{
  activatedMatchState: CanonicalMatchState;
}>;

type ApplicationRow = { match_id: string; result_json: string };
type BindingRow = { binding_json: string };
type FixtureRow = { fixture_event_id: string };
type MatchRow = { durable_revision: number };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** Reads the actual official application ledger; no caller-provided play result is trusted. */
export class SqliteOfficialParticipationStore {
  private readonly db: InstanceType<typeof DatabaseSync>;
  private readonly ownsConnection: boolean;
  constructor(path: string | NativeDatabase, private readonly authority?: ParticipationAuthority) {
    if (typeof path === 'string' && !id(path) || authority !== undefined && (!authority || typeof authority.readGame !== 'function'
      || typeof authority.readRoster !== 'function'
      || typeof authority.readPersonLink !== 'function')) {
      throw new Error('participation requires an accepted source authority');
    }
    this.ownsConnection = typeof path === 'string';
    this.db = typeof path === 'string' ? new DatabaseSync(path) : path;
    if (!(this.db instanceof DatabaseSync)) throw new Error('participation evidence requires a Native connection');
    if (this.ownsConnection) {
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
  }

  close(): void { if (this.ownsConnection) this.db.close(); }

  bindPregame(input: OfficialParticipantBinding): OfficialParticipantBinding {
    if (!this.authority) throw new Error('pregame participation requires an accepted source authority');
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

  /** Historical accepted identity/fixture binding; later availability does not rewrite it. */
  readPregameBinding(gameId: string, playerId: string): OfficialParticipantBinding | null {
    if (!id(gameId) || !id(playerId)) throw new Error('invalid pregame binding reference');
    if (!this.authority) throw new Error('pregame participation requires an accepted source authority');
    const raw = this.binding(gameId, playerId);
    if (!raw) return null;
    const binding = cloneInert(raw);
    if (binding.gameId !== gameId || binding.playerId !== playerId || !id(binding.careerId) || !id(binding.competitionEditionId)
      || !day(binding.gameDay) || !id(binding.clubId) || !id(binding.personId) || !id(binding.personLinkSourceId)
      || !day(binding.rosterRevision) || !id(binding.fixtureEventId) || !['HOME', 'AWAY'].includes(binding.side)) {
      throw new Error('invalid stored pregame binding scope');
    }
    const game = this.authority.readGame(gameId), link = this.authority.readPersonLink(playerId, binding.personLinkSourceId);
    const fixture = this.db.prepare('SELECT fixture_event_id FROM official_fixtures WHERE game_id=?').get(gameId) as FixtureRow | undefined;
    if (!game || !link || !fixture || game.careerId !== binding.careerId || game.competitionEditionId !== binding.competitionEditionId
      || game.gameDay !== binding.gameDay || game.fixtureEventId !== binding.fixtureEventId || fixture.fixture_event_id !== binding.fixtureEventId
      || (binding.side === 'HOME' ? game.homeClubId : game.awayClubId) !== binding.clubId
      || link.personId !== binding.personId || link.sourceId !== binding.personLinkSourceId) {
      throw new Error('pregame accepted game or Person scope differs');
    }
    return Object.freeze(binding);
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

  /** Read-only per-play evidence; presence at P is bound to this actual activation/closure. */
  readPitcherPlay(gameId: string, activationApplicationId: string, closureApplicationId: string): AcceptedPitcherPlay {
    if (!id(gameId) || !id(activationApplicationId) || !id(closureApplicationId)
      || activationApplicationId === closureApplicationId) throw new Error('invalid pitcher play references');
    const first = this.application(gameId, activationApplicationId), second = this.application(gameId, closureApplicationId);
    if (!('activation' in first) || !first.nextWorld) throw new Error('pitcher activation is absent');
    const pitchers = first.nextWorld.defenders.filter((defender) => defender.registeredPosition === 'P');
    if (pitchers.length !== 1) throw new Error('actual play must have one pitcher actor');
    const binding = this.readPregameBinding(gameId, pitchers[0].playerId);
    if (!binding || binding.gameId !== gameId || binding.playerId !== pitchers[0].playerId) {
      throw new Error('actual pitcher lacks accepted pregame binding');
    }
    const proof = { binding: Object.freeze(cloneInert(binding)), activationApplicationId, closureApplicationId,
      activatedMatchState: cloneInert(first.activation.nextMatchState),
      playedPlayId: first.activation.nextMatchState.playId, durableRevision: second.receipt.durableRevision };
    this.verify({ ...proof, receiptId: participationReceiptId(gameId, binding.playerId), actorKind: 'DEFENDER' });
    return Object.freeze(proof);
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
      const existing = this.readStoredReceipt(receipt.receiptId, gameId, playerId);
      if (existing) {
        if ('evidenceKind' in existing || !same(existing, receipt)) throw new Error('player participation already recorded differently');
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

  private readStoredReceipt(receiptId: string, gameId?: string, playerId?: string): OfficialParticipationReceipt | null {
    const row = readOwnedParticipationReceiptRow(this.db, receiptId, gameId, playerId);
    if (!row) return null;
    const receipt = JSON.parse(row.receipt_json) as OfficialParticipationReceipt;
    const bindingJson = readOwnedParticipationBindingJson(this.db, row.game_id, row.player_id);
    if (receipt.receiptId !== receiptId
      || receipt.receiptId !== participationReceiptId(
        receipt.binding.gameId, receipt.binding.playerId)
      || bindingJson === null) {
      throw new Error('participation receipt does not match binding');
    }
    if (participationHasRawDiscriminator(this.db, row.receipt_json)) {
      return readTaggedParticipationReceipt(this.db, receiptId);
    }
    if ('evidenceKind' in receipt || !id(receipt.activationApplicationId) || !id(receipt.closureApplicationId)
      || !same(JSON.parse(bindingJson), receipt.binding)) throw new Error('participation receipt does not match binding');
    this.verify(receipt);
    return Object.freeze(receipt);
  }

  private receiptRead<T>(read: () => T): T {
    if (this.db.isTransaction) return read();
    this.db.exec('BEGIN');
    try { const result = read(); this.db.exec('COMMIT'); return result; }
    catch (error) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw error; }
  }

  readReceipt(receiptId: string): OfficialParticipationReceipt | null {
    if (!id(receiptId)) throw new Error('invalid participation receipt ID');
    return this.receiptRead(() => this.readStoredReceipt(receiptId));
  }

  /** One binary game fact, derived exclusively from its original applied actual-live closure. */
  confirmActualLivePlayed(gameId: string, playerId: string, closureSourceId: string): ActualLiveParticipationReceipt {
    return this.confirmActualLive(gameId, playerId, closureSourceId, 'ACTUAL_LIVE_V1');
  }

  confirmNationalActualLivePlayed(gameId: string, playerId: string, closureSourceId: string): ActualLiveParticipationReceipt {
    return this.confirmActualLive(gameId, playerId, closureSourceId, 'NATIONAL_ACTUAL_LIVE_V1');
  }

  private confirmActualLive(gameId: string, playerId: string, closureSourceId: string,
    evidenceKind: ActualLiveParticipationReceipt['evidenceKind']): ActualLiveParticipationReceipt {
    if (![gameId, playerId, closureSourceId].every(id)) throw new Error('invalid actual-live participation reference');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const receiptId = participationReceiptId(gameId, playerId);
      const existing = this.readStoredReceipt(receiptId, gameId, playerId);
      if (existing) {
        if (!('evidenceKind' in existing) || existing.evidenceKind !== evidenceKind || existing.closureSourceId !== closureSourceId) {
          throw new Error('player participation already recorded differently');
        }
        // readStoredReceipt freshly rederived the complete original candidate on this transaction.
        this.db.exec('COMMIT'); return existing;
      }
      const evidence = deriveActualLiveParticipationEvidence(this.db, gameId, playerId, closureSourceId, evidenceKind);
      assertActualLiveParticipationCurrent(this.db, evidence);
      const receiptJson = actorJson(evidence.receipt);
      this.db.prepare(`INSERT INTO official_participation_receipts
        (receipt_id, game_id, player_id, receipt_json) VALUES (?, ?, ?, ?)`)
        .run(receiptId, gameId, playerId, receiptJson);
      // No outer physical-read traversal spans INSERT: this is a fresh proof of writer-local rows.
      const after = deriveActualLiveParticipationEvidence(this.db, gameId, playerId, closureSourceId, evidenceKind);
      assertActualLiveParticipationCurrent(this.db, after);
      const saved = readOwnedParticipationReceiptRow(this.db, receiptId, gameId, playerId);
      if (!saved || saved.receipt_json !== receiptJson || actorJson(after.receipt) !== receiptJson) {
        throw new Error('actual-live participation changed during admission');
      }
      assertTaggedParticipationFields(this.db, saved.receipt_json, evidenceKind);
      this.db.exec('COMMIT'); return after.receipt;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  confirmPhysicalPlayed(gameId: string, playerId: string, closureSourceId: string): CompletedPlayParticipationReceipt {
    return this.confirmCompletedPlayed(gameId, playerId, closureSourceId, 'PHYSICAL_PLAY_V1');
  }

  confirmNationalPhysicalPlayed(gameId: string, playerId: string, closureSourceId: string): CompletedPlayParticipationReceipt {
    return this.confirmCompletedPlayed(gameId, playerId, closureSourceId, 'NATIONAL_PHYSICAL_PLAY_V1');
  }

  confirmFoulTerminalPlayed(gameId: string, playerId: string, closureSourceId: string): CompletedPlayParticipationReceipt {
    return this.confirmCompletedPlayed(gameId, playerId, closureSourceId, 'FOUL_TERMINAL_V1');
  }

  confirmNationalFoulTerminalPlayed(gameId: string, playerId: string, closureSourceId: string): CompletedPlayParticipationReceipt {
    return this.confirmCompletedPlayed(gameId, playerId, closureSourceId, 'NATIONAL_FOUL_TERMINAL_V1');
  }

  private confirmCompletedPlayed(gameId: string, playerId: string, closureSourceId: string,
    evidenceKind: CompletedPlayParticipationReceipt['evidenceKind']): CompletedPlayParticipationReceipt {
    if (![gameId, playerId, closureSourceId].every(id)) throw new Error('invalid completed participation reference');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const receiptId = participationReceiptId(gameId, playerId), existing = this.readStoredReceipt(receiptId, gameId, playerId);
      if (existing) {
        if (!('evidenceKind' in existing) || existing.evidenceKind !== evidenceKind || existing.closureSourceId !== closureSourceId) {
          throw new Error('player participation already recorded differently');
        }
        this.db.exec('COMMIT'); return existing;
      }
      const evidence = deriveCompletedPlayParticipationEvidence(this.db, gameId, playerId, closureSourceId, evidenceKind);
      assertCompletedPlayParticipationCurrent(this.db, evidence);
      const receiptJson = actorJson(evidence.receipt);
      this.db.prepare(`INSERT INTO official_participation_receipts
        (receipt_id, game_id, player_id, receipt_json) VALUES (?, ?, ?, ?)`).run(receiptId, gameId, playerId, receiptJson);
      // Each pass owns its original read traversal; no evidence cache crosses the actual write.
      const after = deriveCompletedPlayParticipationEvidence(this.db, gameId, playerId, closureSourceId, evidenceKind);
      assertCompletedPlayParticipationCurrent(this.db, after);
      const saved = readOwnedParticipationReceiptRow(this.db, receiptId, gameId, playerId);
      if (!saved || saved.receipt_json !== receiptJson || actorJson(after.receipt) !== receiptJson) {
        throw new Error('completed participation changed during admission');
      }
      this.db.exec('COMMIT'); return after.receipt;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Only a stored receipt can become an accepted OFFICIAL_GAME Career source. */
  readAcceptedPopularityEvent(receiptId: string): AcceptedPublicCareerEvent | null {
    const receipt = this.readReceipt(receiptId);
    if (!receipt) return null;
    return officialParticipationCareerEvent(receipt);
  }
}

/** Projection only; the consuming persistence boundary authenticates the receipt first. */
export const officialParticipationCareerEvent = (receipt: OfficialParticipationReceipt): AcceptedPublicCareerEvent => {
  const binding = receipt.binding;
  return Object.freeze({ eventId: receipt.receiptId,
    careerId: binding.careerId, personId: binding.personId,
    kind: 'OFFICIAL_GAME', sourceRecordId: receipt.receiptId,
    acceptedRevision: receipt.durableRevision,
    occurredAtDay: binding.gameDay, acceptedAtDay: binding.gameDay,
    transfer: null });
};

/** Same receipt owner on the consumer's snapshot; no DDL, writer or close capability escapes. */
export const officialParticipationEvidenceFromSqlite = (db: NativeDatabase): Pick<SqliteOfficialParticipationStore, 'readReceipt'> => {
  const owner = new SqliteOfficialParticipationStore(db);
  return Object.freeze({ readReceipt: (receiptId: string) => withBattedVenueLegalReadSnapshot(db, () => owner.readReceipt(receiptId)) });
};
