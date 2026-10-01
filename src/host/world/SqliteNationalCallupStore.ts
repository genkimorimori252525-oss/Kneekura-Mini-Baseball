import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { canonicalRosterEvidenceJson as json } from './RosterEvidenceJson';
import { evaluateNationalEligibility, snapshotNationalEligibilityPolicy,
  type NationalEligibilityPolicy, type NationalRepresentation, type NationalEligibilityDecision } from '../../core/world/competition/NationalEligibility';
import { evaluateNationalCallup, snapshotNationalCallupPolicy,
  type NationalCallupPolicy, type NationalCallupResponse, type NationalCallupDecision } from '../../core/world/competition/NationalCallup';
import type { SqliteNationalCompetitionSelectionStore, NationalCompetitionSelection } from './SqliteNationalCompetitionSelectionStore';
import type { SqlitePlayerPersonLinkStore, DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import type { SqliteNationalEligibilityFactStore, NationalEligibilityFactsSnapshot } from './SqliteNationalEligibilityFactStore';
import type { SqliteNationalRosterSnapshotStore, AcceptedNationalRosterSnapshot } from './SqliteNationalRosterSnapshotStore';
import type { SqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import type { SqliteOfficialParticipationStore, DurableParticipationReceipt, ParticipationAuthority } from './SqliteOfficialParticipationStore';
import type { SqliteWbcQualifierEditionStore } from './SqliteWbcQualifierEditionStore';
import { createCompetitionSourceReader, withCompetitionSourceReadScope, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';

export type NationalCallupEditionSelection = NationalCompetitionSelection | Readonly<{
  kind: 'WBC_QUALIFIER'; editionId: string; wbcEditionId: string; snapshotId: string; selectedAtDay: number;
  calendarWindow: NationalCompetitionSelection['calendarWindow']; entrantNationIds: readonly string[];
}>;

export type NationalCallupRequest = Readonly<{
  eventId: string; careerId: string; editionId: string; nationId: string;
  playerId: string; personId: string; personLinkSourceId: string; rosterContextClubId: string;
  registeredAtDay: number; replacementOf: string | null;
  eligibilityPolicy: NationalEligibilityPolicy; callupPolicy: NationalCallupPolicy;
  response: NationalCallupResponse;
}>;
export type DurableNationalCallup = Readonly<{
  kind: 'CALLUP';
  revision: number; previousSnapshotId: string | null; snapshotId: string;
  input: NationalCallupRequest; eligibility: NationalEligibilityDecision; decision: NationalCallupDecision;
  releaseClubId: string | null;
  source: Readonly<{ selection: NationalCallupEditionSelection; personLink: DurablePlayerPersonLink;
    roster: AcceptedNationalRosterSnapshot; facts: NationalEligibilityFactsSnapshot | null; nationRegion: string;
    representation: readonly NationalRepresentation[] }>;
}>;
export type NationalAppearanceRequest = Readonly<{
  eventId: string; careerId: string; receiptId: string; acceptedAtDay: number;
}>;
export type DurableNationalAppearance = Readonly<{
  kind: 'APPEARANCE'; revision: number; previousSnapshotId: string | null; snapshotId: string;
  input: NationalAppearanceRequest;
  source: Readonly<{ registrationSnapshotId: string; receipt: DurableParticipationReceipt;
    game: NonNullable<ReturnType<ParticipationAuthority['readGame']>> }>;
}>;
type Entry = DurableNationalCallup | DurableNationalAppearance;
export type NativeNationalEligibilityEvaluation = Readonly<{
  decision: NationalEligibilityDecision; snapshotId: string;
  source: Readonly<{ factsSnapshotId: string | null; representationRevision: number }>;
}>;
export type NationalCallupSources = Readonly<{
  selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  qualifierEditions?: Pick<SqliteWbcQualifierEditionStore, 'readSnapshot'>;
  personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>;
  facts: Pick<SqliteNationalEligibilityFactStore, 'readFacts' | 'readFactsSnapshot'>;
  nations: Pick<SqliteNationCompetitionRegionStore, 'readRegion'>;
  rosterSnapshots: Pick<SqliteNationalRosterSnapshotStore, 'capture' | 'readSnapshot'>;
  participation?: Pick<SqliteOfficialParticipationStore, 'readReceipt'>;
  games?: Pick<ParticipationAuthority, 'readGame'>;
}>;
export type SqliteNationalCallupStore = Readonly<{
  register(input: NationalCallupRequest): DurableNationalCallup;
  adoptAppearance(input: NationalAppearanceRequest): DurableNationalAppearance;
  readRegistration(careerId: string, eventId: string): DurableNationalCallup | null;
  readActiveRoster(careerId: string, editionId: string, nationId: string, beforeDay: number): readonly DurableNationalCallup[];
  readRepresentation(careerId: string, playerId: string, beforeDay: number): readonly NationalRepresentation[];
  readRosterSnapshot(careerId: string, editionId: string, nationId: string, beforeDay: number,
    beforeRevision?: number): Readonly<{ revision: number; roster: readonly DurableNationalCallup[] }>;
  readEligibilityAtDay(careerId: string, eventId: string, beforeDay: number): NativeNationalEligibilityEvaluation | null;
  readEligibilitySnapshot(careerId: string, eventId: string, beforeDay: number,
    source: NativeNationalEligibilityEvaluation['source']): NativeNationalEligibilityEvaluation | null;
  close(): void;
}>;
type Row = { revision: number; event_id: string; effective_day: number; entry_json: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const effectiveDay = (entry: Entry): number => entry.kind === 'CALLUP' ? entry.input.registeredAtDay : entry.input.acceptedAtDay;
const active = (history: readonly Entry[]): DurableNationalCallup[] => {
  const entries = new Map<string, DurableNationalCallup>();
  for (const entry of history) if (entry.kind === 'CALLUP' && entry.decision.registrationStatus === 'ACTIVE') {
    if (entry.input.replacementOf !== null) entries.delete(entry.input.replacementOf);
    entries.set(entry.input.eventId, entry);
  }
  return [...entries.values()];
};
const representation = (history: readonly Entry[], playerId: string): NationalRepresentation[] => {
  const editions = new Map<string, NationalRepresentation>();
  for (const entry of history) if (entry.kind === 'CALLUP' && entry.input.playerId === playerId && entry.decision.registrationStatus === 'ACTIVE'
    && !editions.has(entry.input.editionId)) editions.set(entry.input.editionId, {
    editionId: entry.input.editionId, nationId: entry.input.nationId, registeredAtDay: entry.input.registeredAtDay,
    seniorOfficialAppearanceDay: null, evidenceId: entry.snapshotId,
  });
  for (const entry of history) if (entry.kind === 'APPEARANCE' && entry.source.receipt.binding.playerId === playerId) {
    const binding = entry.source.receipt.binding;
    const prior = editions.get(binding.competitionEditionId);
    if (prior) editions.set(prior.editionId, { ...prior, seniorOfficialAppearanceDay:
      Math.min(prior.seniorOfficialAppearanceDay ?? binding.gameDay, binding.gameDay) });
  }
  return [...editions.values()];
};

/** A representative roster has its own accepted journal and never changes Club assignment. */
export const openSqliteNationalCallupStore = (databasePath: string, sources: NationalCallupSources): SqliteNationalCallupStore => {
  if (!id(databasePath)) throw new Error('invalid national callup database path');
  const readSelection = createCompetitionSourceReader(sources.selections.readSelection, sources.selections);
  const readQualifier = sources.qualifierEditions
    ? createCompetitionSourceReader(sources.qualifierEditions.readSnapshot, sources.qualifierEditions) : null;
  const readLink = createCompetitionSourceReader(sources.personLinks.readLink, sources.personLinks);
  const readFacts = createCompetitionSourceReader(sources.facts.readFacts, sources.facts);
  const readFactsSnapshot = createCompetitionSourceReader(sources.facts.readFactsSnapshot, sources.facts);
  const readRosterSnapshot = createCompetitionSourceReader(sources.rosterSnapshots.readSnapshot, sources.rosterSnapshots);
  const selectEdition = (careerId: string, editionId: string): NationalCallupEditionSelection | null => {
    const regular = readSelection(careerId, editionId);
    const qualifier = readQualifier?.(careerId, editionId);
    if (regular && qualifier) throw new Error('national callup Edition identity is ambiguous');
    if (regular) return regular;
    if (!qualifier) return null;
    const parent = readSelection(careerId, qualifier.source.world.editionId);
    if (!parent || parent.kind !== 'WBC' || json(parent) !== json(qualifier.source.world)
      || qualifier.edition.editionId !== editionId || qualifier.edition.canonicalRole !== 'WBC_GLOBAL_QUALIFIER'
      || qualifier.edition.calendarWindow.endsOnDay > parent.qualificationCutoff.day) {
      throw new Error('national qualifier callup differs from accepted parent WBC');
    }
    return freeze({ kind: 'WBC_QUALIFIER', editionId, wbcEditionId: parent.editionId, snapshotId: qualifier.snapshotId,
      selectedAtDay: qualifier.source.ranking.asOfDay, calendarWindow: qualifier.edition.calendarWindow,
      entrantNationIds: qualifier.edition.pods.flatMap((pod) => pod.entrants.map((entry) => entry.nationId)).sort() });
  };
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_callups (
    career_id TEXT NOT NULL, revision INTEGER NOT NULL, event_id TEXT NOT NULL,
    effective_day INTEGER NOT NULL, entry_json TEXT NOT NULL,
    PRIMARY KEY(career_id, revision), UNIQUE(career_id, event_id)
  );`);
  let closed = false;
  const scope = (careerId: string, reference: string, beforeDay = Number.MAX_SAFE_INTEGER): void => {
    if (closed || !id(careerId) || !id(reference) || !day(beforeDay)) throw new Error('invalid national callup scope');
  };
  const project = (raw: NationalCallupRequest, rosterId: string, factsId: string | null, history: readonly Entry[]): DurableNationalCallup => {
    const input = cloneInert(raw);
    if (!input || Object.keys(input).sort().join('|') !== 'callupPolicy|careerId|editionId|eligibilityPolicy|eventId|nationId|personId|personLinkSourceId|playerId|registeredAtDay|replacementOf|response|rosterContextClubId'
      || ![input.eventId, input.careerId, input.editionId, input.nationId, input.playerId, input.personId,
        input.personLinkSourceId, input.rosterContextClubId].every(id) || !day(input.registeredAtDay)
      || (input.replacementOf !== null && !id(input.replacementOf))) throw new Error('invalid national callup request');
    const eligibilityPolicy = snapshotNationalEligibilityPolicy(input.eligibilityPolicy);
    const callupPolicy = snapshotNationalCallupPolicy(input.callupPolicy);
    for (const prior of history) {
      if (prior.kind !== 'CALLUP') continue;
      if (prior.input.eligibilityPolicy.version === eligibilityPolicy.version
        && json(prior.input.eligibilityPolicy) !== json(eligibilityPolicy)) throw new Error('national eligibility policy version is frozen differently');
      if (prior.input.editionId === input.editionId && json(prior.input.callupPolicy) !== json(callupPolicy)) {
        throw new Error('national callup edition policy is frozen differently');
      }
      if (prior.input.response.evidenceId === input.response?.evidenceId) throw new Error('national response evidence is already used');
    }
    const selection = selectEdition(input.careerId, input.editionId);
    const personLink = readLink(input.personLinkSourceId);
    // A missing basis can justify a permitted refusal, but can never establish positive eligibility.
    const facts = factsId === null ? null : readFactsSnapshot(input.careerId, input.playerId, factsId, input.registeredAtDay);
    const roster = readRosterSnapshot(input.careerId, rosterId);
    const nationRegion = sources.nations.readRegion(input.careerId, input.nationId, input.registeredAtDay);
    if (!selection || selection.editionId !== input.editionId || !personLink
      || personLink.careerId !== input.careerId || personLink.playerId !== input.playerId
      || personLink.personId !== input.personId || personLink.acceptedAtDay > input.registeredAtDay
      || !roster || roster.careerId !== input.careerId || roster.effectiveDay > input.registeredAtDay
      || (factsId !== null && !facts) || (facts && (facts.careerId !== input.careerId || facts.playerId !== input.playerId
        || facts.asOfDay !== input.registeredAtDay)) || !nationRegion
      || (selection.kind === 'REGIONAL_NATIONAL' && selection.region !== nationRegion)
      || (selection.kind === 'WBC_QUALIFIER' && (!selection.entrantNationIds.includes(input.nationId)
        || input.registeredAtDay < selection.selectedAtDay))
      || input.registeredAtDay > selection.calendarWindow.endsOnDay
      || callupPolicy.replacementCutoffDay > selection.calendarWindow.endsOnDay) {
      throw new Error('national callup lacks accepted identity, Nation, roster, or edition source');
    }
    const player = roster.roster.players.find((item) => item.playerId === input.playerId);
    if (!player) throw new Error('national callup requires a global Player');
    const current = active(history);
    const priorRepresentation = representation(history, input.playerId);
    const eligibility = evaluateNationalEligibility({ playerId: input.playerId, personId: input.personId,
      editionId: input.editionId, nationId: input.nationId, asOfDay: input.registeredAtDay,
      policy: eligibilityPolicy, facts: facts?.facts ?? [], representation: priorRepresentation });
    if (priorRepresentation.some((item) => item.editionId === input.editionId)
      && input.response.decision === 'ACCEPT') throw new Error('national Player is already registered in this edition');
    if (input.replacementOf !== null) {
      const outgoing = current.find((item) => item.input.eventId === input.replacementOf);
      const medical = outgoing && roster.roster.players.find((item) => item.playerId === outgoing.input.playerId);
      if (!outgoing || outgoing.input.editionId !== input.editionId || outgoing.input.nationId !== input.nationId
        || input.response.decision !== 'ACCEPT' || !medical
        || !['INJURED', 'REHAB'].includes(medical.availability.status)) throw new Error('national replacement requires active injured Player');
    }
    const decision = evaluateNationalCallup({ eligibility, policy: callupPolicy, availability: player.availability.status,
      response: input.response, activePlayerCount: current.filter((item) => item.input.editionId === input.editionId
        && item.input.nationId === input.nationId).length - (input.replacementOf === null ? 0 : 1),
      alreadyRegistered: false, isReplacement: input.replacementOf !== null, asOfDay: input.registeredAtDay });
    if (!decision.accepted) throw new Error(`national callup rejected: ${decision.reason}`);
    const basis = { kind: 'CALLUP' as const, revision: history.length + 1, previousSnapshotId: history.at(-1)?.snapshotId ?? null,
      input, eligibility, decision, releaseClubId: decision.clubMustRelease
        ? player.clubRights.rightsHolderClubId ?? player.assignment?.clubId ?? null : null,
      source: { selection, personLink, roster, facts, nationRegion, representation: priorRepresentation } };
    return freeze({ ...basis, snapshotId: `national-callup:${createHash('sha256').update(json(basis)).digest('hex')}` });
  };
  const projectAppearance = (raw: NationalAppearanceRequest, history: readonly Entry[]): DurableNationalAppearance => {
    const input = cloneInert(raw);
    if (!input || Object.keys(input).sort().join('|') !== 'acceptedAtDay|careerId|eventId|receiptId'
      || ![input.eventId, input.careerId, input.receiptId].every(id) || !day(input.acceptedAtDay)) throw new Error('invalid national appearance request');
    if (history.some((item) => item.kind === 'APPEARANCE' && item.input.receiptId === input.receiptId)) {
      throw new Error('national participation receipt is already adopted');
    }
    const receipt = sources.participation?.readReceipt(input.receiptId);
    if (!receipt) throw new Error('national appearance requires actual official participation receipt');
    const binding = receipt.binding;
    const game = sources.games?.readGame(binding.gameId);
    const registration = active(history.filter((item) => effectiveDay(item) <= binding.gameDay))
      .find((item) => item.input.eventId === binding.nationalRegistrationEventId);
    const roster = binding.nationalRosterSnapshotId
      ? readRosterSnapshot(input.careerId, binding.nationalRosterSnapshotId) : null;
    const player = roster?.roster.players.find((item) => item.playerId === binding.playerId);
    if (!game || game.competitionScope !== 'NATIONAL' || binding.careerId !== input.careerId
      || game.careerId !== input.careerId || game.competitionEditionId !== binding.competitionEditionId
      || game.gameDay !== binding.gameDay || game.fixtureEventId !== binding.fixtureEventId
      || (binding.side === 'HOME' ? game.homeClubId : game.awayClubId) !== binding.clubId
      || input.acceptedAtDay < binding.gameDay || !registration
      || registration.input.editionId !== binding.competitionEditionId || registration.input.nationId !== binding.clubId
      || registration.input.playerId !== binding.playerId || registration.input.personId !== binding.personId
      || registration.input.personLinkSourceId !== binding.personLinkSourceId
      || binding.gameDay < registration.source.selection.calendarWindow.startsOnDay
      || binding.gameDay > registration.source.selection.calendarWindow.endsOnDay
      || !roster || roster.revision !== binding.rosterRevision || roster.effectiveDay > binding.gameDay
      || player?.availability.status !== 'AVAILABLE') throw new Error('national appearance differs from accepted game or active registration');
    const basis = { kind: 'APPEARANCE' as const, revision: history.length + 1, previousSnapshotId: history.at(-1)?.snapshotId ?? null,
      input, source: { registrationSnapshotId: registration.snapshotId, receipt, game } };
    return freeze({ ...basis, snapshotId: `national-appearance:${createHash('sha256').update(json(basis)).digest('hex')}` });
  };
  const replayPrefix = createCompetitionSourceReader((careerId: string, beforeDay: number, beforeRevision: number): readonly Entry[] => {
    const rows = db.prepare(`SELECT revision, event_id, effective_day, entry_json FROM world_national_callups
      WHERE career_id=? AND effective_day<=? AND revision<=? ORDER BY revision`)
      .all(careerId, beforeDay, beforeRevision) as Row[];
    try {
      const history: Entry[] = [];
      for (const row of rows) {
        const saved = JSON.parse(row.entry_json) as Entry;
        if (row.revision !== history.length + 1 || saved.input.careerId !== careerId
          || saved.input.eventId !== row.event_id || effectiveDay(saved) !== row.effective_day
          || (history.length ? effectiveDay(history[history.length - 1]) : 0) > row.effective_day
          || json(saved) !== row.entry_json) throw new Error('national callup metadata differs');
        const expected = saved.kind === 'CALLUP' ? project(saved.input, saved.source.roster.snapshotId, saved.source.facts?.snapshotId ?? null, history)
          : saved.kind === 'APPEARANCE' ? projectAppearance(saved.input, history) : null;
        if (!expected) throw new Error('invalid national journal kind');
        if (json(expected) !== row.entry_json) throw new Error('national callup replay differs');
        history.push(expected);
      }
      return freeze(history);
    } catch (cause) { throw new Error(`corrupt national callup for ${careerId}`, { cause }); }
  }, db);
  const replay = (careerId: string, beforeDay: number, beforeRevision = Number.MAX_SAFE_INTEGER): readonly Entry[] =>
    withCompetitionSourceReadScope(() => replayPrefix(careerId, beforeDay, beforeRevision));
  const evaluate = (careerId: string, eventId: string, beforeDay: number, pin?: NativeNationalEligibilityEvaluation['source']): NativeNationalEligibilityEvaluation | null => withCompetitionSourceReadScope(() => {
    scope(careerId, eventId, beforeDay);
    if (pin && (!day(pin.representationRevision) || (pin.factsSnapshotId !== null && !id(pin.factsSnapshotId)))) throw new Error('invalid national eligibility prefix');
    const history = replay(careerId, beforeDay, pin?.representationRevision);
    const registration = history.find((entry): entry is DurableNationalCallup => entry.kind === 'CALLUP' && entry.input.eventId === eventId);
    if (!registration || registration.decision.registrationStatus !== 'ACTIVE') return null;
    const input = registration.input;
    const facts = pin ? pin.factsSnapshotId === null ? null
      : readFactsSnapshot(careerId, input.playerId, pin.factsSnapshotId, beforeDay)
      : readFacts(careerId, input.playerId, beforeDay);
    if (pin?.factsSnapshotId && !facts) throw new Error('national eligibility fact prefix is absent');
    const priorRepresentation = representation(history, input.playerId);
    const decision = evaluateNationalEligibility({ playerId: input.playerId, personId: input.personId,
      editionId: input.editionId, nationId: input.nationId, asOfDay: beforeDay,
      policy: input.eligibilityPolicy, facts: facts?.facts ?? [], representation: priorRepresentation });
    const source = { factsSnapshotId: facts?.snapshotId ?? null, representationRevision: history.at(-1)?.revision ?? 0 };
    const basis = { registrationSnapshotId: registration.snapshotId, beforeDay, facts, representation: priorRepresentation, source, decision };
    return freeze({ decision, source, snapshotId: `national-current-eligibility:${createHash('sha256').update(json(basis)).digest('hex')}` });
  });
  return Object.freeze({
    register(raw: NationalCallupRequest): DurableNationalCallup {
      return withCompetitionSourceReadPhase(() => {
        scope(raw?.careerId, raw?.eventId, raw?.registeredAtDay);
        const input = cloneInert(raw);
        const existing = db.prepare('SELECT revision FROM world_national_callups WHERE career_id=? AND event_id=?')
          .get(input.careerId, input.eventId) as { revision: number } | undefined;
        if (existing) {
          const prior = replay(input.careerId, Number.MAX_SAFE_INTEGER, existing.revision).at(-1)!;
          if (prior.kind !== 'CALLUP') throw new Error('national event identity is already used');
          if (json(prior.input) !== json(input)) throw new Error('national callup is frozen differently');
          return prior;
        }
        // This checkpoint comes from the current Native head; a future head is never past evidence.
        const roster = sources.rosterSnapshots.capture(input.careerId, input.rosterContextClubId);
        db.exec('BEGIN IMMEDIATE');
        try {
          const history = replay(input.careerId, Number.MAX_SAFE_INTEGER);
          if ((history.length ? effectiveDay(history[history.length - 1]) : 0) > input.registeredAtDay) throw new Error('national callup is backdated');
          const facts = readFacts(input.careerId, input.playerId, input.registeredAtDay);
          const entry = project(input, roster.snapshotId, facts?.snapshotId ?? null, history);
          db.prepare(`INSERT INTO world_national_callups (career_id, revision, event_id, effective_day, entry_json)
            VALUES (?, ?, ?, ?, ?)`).run(input.careerId, entry.revision, input.eventId, input.registeredAtDay, json(entry));
          db.exec('COMMIT'); return entry;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        });
    },
    adoptAppearance(raw: NationalAppearanceRequest): DurableNationalAppearance {
      return withCompetitionSourceReadPhase(() => {
        scope(raw?.careerId, raw?.eventId, raw?.acceptedAtDay);
        const input = cloneInert(raw);
        db.exec('BEGIN IMMEDIATE');
        try {
          const existing = db.prepare('SELECT revision FROM world_national_callups WHERE career_id=? AND event_id=?')
            .get(input.careerId, input.eventId) as { revision: number } | undefined;
          if (existing) {
            const prior = replay(input.careerId, Number.MAX_SAFE_INTEGER, existing.revision).at(-1)!;
            if (prior.kind !== 'APPEARANCE' || json(prior.input) !== json(input)) throw new Error('national appearance is frozen differently');
            db.exec('COMMIT'); return prior;
          }
          const history = replay(input.careerId, Number.MAX_SAFE_INTEGER);
          if ((history.length ? effectiveDay(history[history.length - 1]) : 0) > input.acceptedAtDay) throw new Error('national appearance is backdated');
          const entry = projectAppearance(input, history);
          db.prepare(`INSERT INTO world_national_callups (career_id, revision, event_id, effective_day, entry_json)
            VALUES (?, ?, ?, ?, ?)`).run(input.careerId, entry.revision, input.eventId, input.acceptedAtDay, json(entry));
          db.exec('COMMIT'); return entry;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        });
    },
    readRegistration(careerId: string, eventId: string): DurableNationalCallup | null {
      scope(careerId, eventId);
      const row = db.prepare('SELECT revision FROM world_national_callups WHERE career_id=? AND event_id=?')
        .get(careerId, eventId) as { revision: number } | undefined;
      const entry = row ? replay(careerId, Number.MAX_SAFE_INTEGER, row.revision).at(-1)! : null;
      return entry?.kind === 'CALLUP' ? entry : null;
    },
    readActiveRoster(careerId: string, editionId: string, nationId: string, beforeDay: number): readonly DurableNationalCallup[] {
      scope(careerId, editionId, beforeDay); scope(careerId, nationId, beforeDay);
      return freeze(active(replay(careerId, beforeDay)).filter((entry) => entry.input.editionId === editionId && entry.input.nationId === nationId));
    },
    readRepresentation(careerId: string, playerId: string, beforeDay: number): readonly NationalRepresentation[] {
      scope(careerId, playerId, beforeDay); return freeze(representation(replay(careerId, beforeDay), playerId));
    },
    readRosterSnapshot(careerId: string, editionId: string, nationId: string, beforeDay: number, beforeRevision = Number.MAX_SAFE_INTEGER) {
      scope(careerId, editionId, beforeDay); scope(careerId, nationId, beforeDay);
      if (!day(beforeRevision)) throw new Error('invalid national roster prefix');
      const history = replay(careerId, beforeDay, beforeRevision);
      return freeze({ revision: history.at(-1)?.revision ?? 0,
        roster: active(history).filter((entry) => entry.input.editionId === editionId && entry.input.nationId === nationId) });
    },
    readEligibilityAtDay: (careerId: string, eventId: string, beforeDay: number) => evaluate(careerId, eventId, beforeDay),
    readEligibilitySnapshot: evaluate,
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
