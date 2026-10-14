import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerHealthRehab, advancePlayerHealthRehab, type PlayerHealthDiagnosis, type PlayerHealthRehabState } from '../../core/world/development/PlayerHealthRehab';
import type { LegalRosterActionBinding } from '../../core/world/manager/ExecutedRosterDecisionDispatcher';
import type { SqlitePlayerPersonLinkStore, DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import type { SqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import type { SqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';
import type { SqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { clinicalJson as json, clinicalHash as hash, clinicalFreeze as freeze, readClinicalPersonLink, captureClinicalWorkloadRows,
  captureClinicalGameRows, projectRehabRosterProof, readClinicalParticipationReceipt, deriveClinicalEffectEvidence, type ClinicalEffectProof } from './HealthRehabEvidenceFromSqlite';

export type AcceptedHealthDiagnosis = Readonly<{
  sourceId: string; sourceVersion: string; clinicalRecordId: string; personLinkSourceId: string; previousCaseId: string | null; diagnosis: PlayerHealthDiagnosis;
}>;
export type AcceptedHealthRehabEffect = Readonly<{ sourceId: string; sourceVersion: string; caseId: string }> & (
  Readonly<{ kind: 'MEDICAL_RECOVERY' | 'REHAB_PRACTICE'; clinicalRecordId: string; workloadActivityId: string }>
  | Readonly<{ kind: 'REHAB_GAME'; participationReceiptId: string; rosterSnapshotId: string }>
);
export type DurableHealthCase = Readonly<{
  source: AcceptedHealthDiagnosis; caseOrdinal: number; person: DurablePlayerPersonLink; initial: PlayerHealthRehabState; predecessor: PlayerHealthRehabState | null;
}>;
export type DurableHealthEffect = Readonly<{
  source: AcceptedHealthRehabEffect; proof: ClinicalEffectProof; before: PlayerHealthRehabState; after: PlayerHealthRehabState;
}>;
export type HealthAvailabilityActionInput = Readonly<{
  careerId: string; clubId: string; caseId: string; caseRevision: number; actionId: string; expectedRosterRevision: number; effectiveDay: number;
}>;
export type SqlitePlayerHealthRehabStore = Readonly<{
  initialize(sourceId: string): DurableHealthCase; apply(sourceId: string, expectedRevision: number): PlayerHealthRehabState;
  readCase(sourceId: string): DurableHealthCase | null; readEffect(sourceId: string): DurableHealthEffect | null;
  readHead(careerId: string, playerId: string): PlayerHealthRehabState | null;
  createAvailabilityAction(input: HealthAvailabilityActionInput): LegalRosterActionBinding; close(): void;
}>;
type Sources = Readonly<{
  personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>; workload: Pick<SqlitePlayerWorkloadRecoveryStore, 'readActivity'>;
  participation: Pick<SqliteOfficialParticipationStore, 'readReceipt'>; rosterSnapshots: Pick<SqliteNationalRosterSnapshotStore, 'readSnapshot'>;
  roster: Pick<SqliteManagerRosterDecisionStore, 'readHead'>;
}>;
type Db = Pick<DatabaseSync, 'prepare'>;
type CaseRow = { source_id: string; career_id: string; player_id: string; case_ordinal: number; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
type EffectRow = { source_id: string; case_id: string; before_revision: number; after_revision: number;
  source_json: string; source_hash: string; record_json: string; record_hash: string };
type PlayerHead = { case_id: string; case_ordinal: number };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const day = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fields = (v: unknown, names: readonly string[]): boolean => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === names.length && names.every((name) => Object.hasOwn(v, name));
const diagnosisInput = (raw: AcceptedHealthDiagnosis, sourceId: string): AcceptedHealthDiagnosis => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'clinicalRecordId', 'personLinkSourceId', 'previousCaseId', 'diagnosis'])
    || !id(sourceId) || source.sourceId !== sourceId || !id(source.sourceVersion) || !id(source.clinicalRecordId) || !id(source.personLinkSourceId)
    || source.previousCaseId !== null && !id(source.previousCaseId) || source.diagnosis?.caseId !== sourceId) throw new Error('invalid accepted clinical diagnosis Source');
  createPlayerHealthRehab(source.diagnosis); return source;
};
const effectInput = (raw: AcceptedHealthRehabEffect, sourceId: string): AcceptedHealthRehabEffect => {
  const source = cloneInert(raw);
  if (!source || source.sourceId !== sourceId || !id(sourceId) || !id(source.sourceVersion) || !id(source.caseId)
    || !fields(source, ['sourceId', 'sourceVersion', 'caseId', 'kind', ...(source.kind === 'REHAB_GAME'
      ? ['participationReceiptId', 'rosterSnapshotId'] : ['clinicalRecordId', 'workloadActivityId'])])
    || (source.kind === 'REHAB_GAME' ? !id(source.participationReceiptId) || !id(source.rosterSnapshotId)
      : !['MEDICAL_RECOVERY', 'REHAB_PRACTICE'].includes(source.kind) || !id(source.clinicalRecordId) || !id(source.workloadActivityId))) {
    throw new Error('invalid accepted clinical rehabilitation effect Source');
  }
  return source;
};
const playerPointer = (db: Db, careerId: string, playerId: string): PlayerHead | null => {
  const pointer = db.prepare('SELECT case_id, case_ordinal FROM world_health_rehab_player_heads WHERE career_id=? AND player_id=?')
    .get(careerId, playerId) as PlayerHead | undefined;
  const latest = db.prepare('SELECT source_id, case_ordinal FROM world_health_rehab_cases WHERE career_id=? AND player_id=? ORDER BY case_ordinal DESC LIMIT 1')
    .get(careerId, playerId) as { source_id: string; case_ordinal: number } | undefined;
  if (latest ? !pointer || pointer.case_id !== latest.source_id || pointer.case_ordinal !== latest.case_ordinal : pointer) {
    throw new Error('clinical Player head is not current');
  }
  return pointer ?? null;
};

const caseHistory = (db: Db, caseId: string, ancestors = new Set<string>()): Readonly<{ snapshot: DurableHealthCase; effects: readonly DurableHealthEffect[]; current: PlayerHealthRehabState }> | null => {
  const row = db.prepare('SELECT * FROM world_health_rehab_cases WHERE source_id=?').get(caseId) as CaseRow | undefined;
  if (!row) {
    if (db.prepare('SELECT 1 FROM world_health_rehab_case_heads WHERE case_id=?').get(caseId)
      || db.prepare('SELECT 1 FROM world_health_rehab_effects WHERE case_id=?').get(caseId)) throw new Error('orphan clinical case history');
    return null;
  }
  try {
    if (ancestors.has(caseId)) throw new Error('clinical predecessor cycle');
    const path = new Set(ancestors).add(caseId), source = diagnosisInput(JSON.parse(row.source_json) as AcceptedHealthDiagnosis, caseId);
    const saved = JSON.parse(row.snapshot_json) as DurableHealthCase, person = readClinicalPersonLink(db, source.personLinkSourceId);
    if (person.careerId !== source.diagnosis.careerId || person.playerId !== source.diagnosis.playerId
      || person.acceptedAtDay > source.diagnosis.diagnosedAtDay || !day(row.case_ordinal) || row.case_ordinal < 1) throw new Error('clinical patient scope differs');
    const previous = source.previousCaseId === null ? null : caseHistory(db, source.previousCaseId, path);
    if (row.case_ordinal === 1 ? source.previousCaseId !== null || saved.predecessor !== null
      : !previous || previous.snapshot.caseOrdinal + 1 !== row.case_ordinal || previous.current.careerId !== source.diagnosis.careerId
        || previous.current.playerId !== source.diagnosis.playerId || source.diagnosis.diagnosedAtDay < previous.current.effectiveDay
        || source.diagnosis.injuryBurden < previous.current.injuryBurden || json(previous.current) !== json(saved.predecessor)) {
      throw new Error('clinical diagnosis predecessor differs');
    }
    const expected: DurableHealthCase = { source, caseOrdinal: row.case_ordinal, person,
      initial: createPlayerHealthRehab(source.diagnosis), predecessor: previous?.current ?? null };
    const policy = db.prepare('SELECT policy_json FROM world_health_rehab_policies WHERE career_id=? AND policy_id=? AND version=?')
      .get(source.diagnosis.careerId, source.diagnosis.policy.policyId, source.diagnosis.policy.version) as { policy_json: string } | undefined;
    if (row.career_id !== source.diagnosis.careerId || row.player_id !== source.diagnosis.playerId || row.source_json !== json(source)
      || row.source_hash !== hash(source) || row.snapshot_json !== json(expected) || row.snapshot_hash !== hash(expected)
      || policy?.policy_json !== json(source.diagnosis.policy)) throw new Error('clinical diagnosis archive differs');
    let current = expected.initial;
    const effects: DurableHealthEffect[] = [];
    for (const effectRow of db.prepare('SELECT * FROM world_health_rehab_effects WHERE case_id=? ORDER BY after_revision').all(caseId) as EffectRow[]) {
      const effectSource = effectInput(JSON.parse(effectRow.source_json) as AcceptedHealthRehabEffect, effectRow.source_id);
      const record = JSON.parse(effectRow.record_json) as DurableHealthEffect;
      const evidence = deriveClinicalEffectEvidence(db, effectSource, source.diagnosis, person, record.proof);
      const after = advancePlayerHealthRehab(current, current.revision, evidence), expectedEffect = { source: effectSource, proof: record.proof, before: current, after };
      if (effectSource.caseId !== caseId || effectRow.case_id !== caseId || effectRow.before_revision !== current.revision || effectRow.after_revision !== after.revision
        || effectRow.source_json !== json(effectSource) || effectRow.source_hash !== hash(effectSource)
        || effectRow.record_json !== json(expectedEffect) || effectRow.record_hash !== hash(expectedEffect)) throw new Error('clinical effect archive differs');
      current = after; effects.push(freeze(expectedEffect));
    }
    const head = db.prepare('SELECT revision, state_json FROM world_health_rehab_case_heads WHERE case_id=?')
      .get(caseId) as { revision: number; state_json: string } | undefined;
    if (!head || head.revision !== current.revision || head.state_json !== json(current)) throw new Error('clinical case head diverged');
    return freeze({ snapshot: expected, effects, current });
  } catch (cause) { throw new Error('corrupt clinical rehabilitation history', { cause }); }
};

export const readHealthAvailabilityFromSqlite = (db: Db, careerId: string, playerId: string, caseId: string, revision: number) => {
  if (![careerId, playerId, caseId].every(id) || !day(revision)) throw new Error('invalid current clinical availability reference');
  const pointer = playerPointer(db, careerId, playerId), history = caseHistory(db, caseId);
  if (!pointer || !history || pointer.case_id !== caseId || pointer.case_ordinal !== history.snapshot.caseOrdinal
    || history.current.careerId !== careerId || history.current.playerId !== playerId || history.current.revision !== revision) throw new Error('clinical availability is not current');
  const state = history.current, evidenceId = `clinical-readiness:${hash({ caseOrdinal: history.snapshot.caseOrdinal, state })}`;
  return freeze({ state, availability: { status: state.phase === 'READY' ? 'AVAILABLE' as const : state.phase, evidenceId } });
};

/** Called by the Roster writer on its own connection before and after accepting a medical action. */
export const assertCurrentMedicalRosterAction = (db: Db, careerId: string, binding: LegalRosterActionBinding): void => {
  if (!binding.medicalSource) {
    const clinicalChanges = binding.command.changes.filter((change) => change.availability
      && ['AVAILABLE', 'INJURED', 'REHAB'].includes(change.availability.status));
    // Existing databases and players without accepted clinical cases retain their availability owner.
    if (clinicalChanges.length && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_health_rehab_cases'").get()) {
      for (const change of clinicalChanges) {
        if (playerPointer(db, careerId, change.playerId)) throw new Error('current clinical availability requires a medical Source');
      }
    }
    return;
  }
  const reference = binding.medicalSource, change = binding.command.changes[0];
  if (!fields(reference, ['caseId', 'caseRevision', 'evidenceId']) || binding.command.changes.length !== 1 || !change
    || !fields(change, ['playerId', 'availability'])) throw new Error('medical roster action payload differs');
  const current = readHealthAvailabilityFromSqlite(db, careerId, change.playerId, reference.caseId, reference.caseRevision);
  if (reference.evidenceId !== current.availability.evidenceId || json(change.availability) !== json(current.availability)
    || binding.command.effectiveDay < current.state.effectiveDay) throw new Error('medical roster availability Source differs');
};

export const openSqlitePlayerHealthRehabStore = (databasePath: string, sources: Sources,
  authority?: Readonly<{ readAcceptedDiagnosis(sourceId: string): AcceptedHealthDiagnosis | null; readAcceptedEffect(sourceId: string): AcceptedHealthRehabEffect | null }>): SqlitePlayerHealthRehabStore => {
  if (!id(databasePath) || typeof sources?.personLinks?.readLink !== 'function' || typeof sources.workload?.readActivity !== 'function'
    || typeof sources.participation?.readReceipt !== 'function' || typeof sources.rosterSnapshots?.readSnapshot !== 'function'
    || typeof sources.roster?.readHead !== 'function' || authority != null && (typeof authority.readAcceptedDiagnosis !== 'function' || typeof authority.readAcceptedEffect !== 'function')) {
    throw new Error('invalid clinical rehabilitation sources');
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_health_rehab_policies (career_id TEXT NOT NULL, policy_id TEXT NOT NULL, version TEXT NOT NULL,
    policy_json TEXT NOT NULL, PRIMARY KEY(career_id, policy_id, version));
    CREATE TABLE IF NOT EXISTS world_health_rehab_cases (source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    case_ordinal INTEGER NOT NULL, source_json TEXT NOT NULL, source_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id, player_id, case_ordinal));
    CREATE TABLE IF NOT EXISTS world_health_rehab_case_heads (case_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS world_health_rehab_player_heads (career_id TEXT NOT NULL, player_id TEXT NOT NULL, case_id TEXT NOT NULL,
    case_ordinal INTEGER NOT NULL, PRIMARY KEY(career_id, player_id));
    CREATE TABLE IF NOT EXISTS world_health_rehab_effects (source_id TEXT PRIMARY KEY, case_id TEXT NOT NULL, before_revision INTEGER NOT NULL,
    after_revision INTEGER NOT NULL, source_json TEXT NOT NULL, source_hash TEXT NOT NULL, record_json TEXT NOT NULL, record_hash TEXT NOT NULL,
    UNIQUE(case_id, after_revision));`);
  let closed = false;
  const check = (...ids: string[]) => { if (closed || ids.some((v) => !id(v))) throw new Error('invalid or closed clinical scope'); };
  const transaction = <T>(work: () => T): T => { db.exec('BEGIN IMMEDIATE'); try { const result = work(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const readEffect = (sourceId: string): DurableHealthEffect | null => {
    check(sourceId); const row = db.prepare('SELECT * FROM world_health_rehab_effects WHERE source_id=?').get(sourceId) as EffectRow | undefined;
    if (!row) return null;
    const effect = caseHistory(db, row.case_id)?.effects.find((value) => value.source.sourceId === sourceId);
    if (!effect) throw new Error('orphan clinical effect history'); return effect;
  };
  return Object.freeze({
    initialize(sourceId): DurableHealthCase {
      check(sourceId);
      const prior = caseHistory(db, sourceId), raw = authority?.readAcceptedDiagnosis(sourceId) ?? null;
      const source = raw === null ? null : diagnosisInput(raw, sourceId);
      if (prior) { if (source && json(source) !== json(prior.snapshot.source)) throw new Error('clinical diagnosis is frozen differently'); return prior.snapshot; }
      if (!source) throw new Error('accepted clinical diagnosis is missing');
      const person = cloneInert(sources.personLinks.readLink(source.personLinkSourceId));
      if (!person || json(person) !== json(readClinicalPersonLink(db, source.personLinkSourceId))) throw new Error('actual clinical Person Source differs');
      return transaction(() => {
        const pointer = playerPointer(db, source.diagnosis.careerId, source.diagnosis.playerId);
        const previous = pointer ? caseHistory(db, pointer.case_id) : null;
        if (source.previousCaseId !== (pointer?.case_id ?? null) || pointer && (!previous || pointer.case_ordinal !== previous.snapshot.caseOrdinal)) throw new Error('clinical current predecessor differs');
        if (db.prepare('SELECT source_id FROM world_health_rehab_effects WHERE source_id=?').get(sourceId)) throw new Error('clinical Source belongs to an effect');
        const ordinal = (pointer?.case_ordinal ?? 0) + 1;
        if (!Number.isSafeInteger(ordinal)) throw new Error('clinical case ordinal overflow');
        const snapshot: DurableHealthCase = { source, caseOrdinal: ordinal, person, initial: createPlayerHealthRehab(source.diagnosis), predecessor: previous?.current ?? null };
        const policy = source.diagnosis.policy, policyRow = db.prepare('SELECT policy_json FROM world_health_rehab_policies WHERE career_id=? AND policy_id=? AND version=?')
          .get(source.diagnosis.careerId, policy.policyId, policy.version) as { policy_json: string } | undefined;
        if (policyRow && policyRow.policy_json !== json(policy)) throw new Error('clinical policy version is frozen differently');
        if (!policyRow) db.prepare('INSERT INTO world_health_rehab_policies VALUES (?, ?, ?, ?)').run(source.diagnosis.careerId, policy.policyId, policy.version, json(policy));
        db.prepare('INSERT INTO world_health_rehab_cases VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(sourceId, source.diagnosis.careerId, source.diagnosis.playerId, ordinal, json(source), hash(source), json(snapshot), hash(snapshot));
        db.prepare('INSERT INTO world_health_rehab_case_heads VALUES (?, ?, ?)').run(sourceId, 0, json(snapshot.initial));
        db.prepare('INSERT INTO world_health_rehab_player_heads VALUES (?, ?, ?, ?) ON CONFLICT(career_id, player_id) DO UPDATE SET case_id=excluded.case_id, case_ordinal=excluded.case_ordinal')
          .run(source.diagnosis.careerId, source.diagnosis.playerId, sourceId, ordinal);
        const saved = caseHistory(db, sourceId)!.snapshot;
        if (json(saved) !== json(snapshot)) throw new Error('clinical diagnosis changed during acceptance');
        readHealthAvailabilityFromSqlite(db, source.diagnosis.careerId, source.diagnosis.playerId, sourceId, 0); return saved;
      });
    },
    apply(sourceId, expectedRevision): PlayerHealthRehabState {
      check(sourceId); if (!day(expectedRevision)) throw new Error('invalid clinical effect revision');
      const prior = readEffect(sourceId), raw = authority?.readAcceptedEffect(sourceId) ?? null;
      const source = raw === null ? null : effectInput(raw, sourceId);
      if (prior) { if (expectedRevision !== prior.before.revision || source && json(source) !== json(prior.source)) throw new Error('clinical effect is frozen differently'); return prior.after; }
      if (!source) throw new Error('accepted clinical rehabilitation effect is missing');
      if (db.prepare('SELECT source_id FROM world_health_rehab_cases WHERE source_id=?').get(sourceId)) throw new Error('clinical Source belongs to a diagnosis');
      const history = caseHistory(db, source.caseId);
      if (!history) throw new Error('accepted clinical case is missing');
      const { snapshot, current: before } = history;
      readHealthAvailabilityFromSqlite(db, before.careerId, before.playerId, before.caseId, expectedRevision);
      let proof: ClinicalEffectProof;
      if (source.kind === 'REHAB_GAME') {
        const rows = captureClinicalGameRows(db, snapshot.source.diagnosis, source.participationReceiptId, source.rosterSnapshotId);
        const acceptedReceipt = sources.participation.readReceipt(source.participationReceiptId);
        if (json(acceptedReceipt) !== json(readClinicalParticipationReceipt(db, source.participationReceiptId))) {
          throw new Error('clinical peer participation differs from local original proof');
        }
        const receipt = cloneInert(acceptedReceipt);
        const roster = sources.rosterSnapshots.readSnapshot(before.careerId, source.rosterSnapshotId);
        if (!receipt || !roster) throw new Error('actual played clinical game Source is missing');
        proof = { receipt, roster: projectRehabRosterProof(roster, receipt), rows };
      } else {
        const rows = captureClinicalWorkloadRows(db, snapshot.source.diagnosis, source.workloadActivityId);
        const workload = cloneInert(sources.workload.readActivity(source.workloadActivityId));
        if (!workload) throw new Error('actual clinical workload Source is missing'); proof = { workload, rows };
      }
      const evidence = deriveClinicalEffectEvidence(db, source, snapshot.source.diagnosis, snapshot.person, proof);
      const after = advancePlayerHealthRehab(before, expectedRevision, evidence), record = { source, proof, before, after };
      return transaction(() => {
        const original = caseHistory(db, source.caseId);
        readHealthAvailabilityFromSqlite(db, before.careerId, before.playerId, source.caseId, expectedRevision);
        if (!original || json(original.current) !== json(before)) throw new Error('clinical state changed before effect');
        deriveClinicalEffectEvidence(db, source, snapshot.source.diagnosis, snapshot.person, proof);
        db.prepare('INSERT INTO world_health_rehab_effects VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(sourceId, source.caseId, before.revision, after.revision, json(source), hash(source), json(record), hash(record));
        const changed = db.prepare('UPDATE world_health_rehab_case_heads SET revision=?, state_json=? WHERE case_id=? AND revision=? AND state_json=?')
          .run(after.revision, json(after), source.caseId, before.revision, json(before));
        if (changed.changes !== 1) throw new Error('clinical case advanced during effect');
        const saved = readEffect(sourceId);
        if (!saved || json(saved) !== json(record)) throw new Error('clinical effect changed during acceptance');
        readHealthAvailabilityFromSqlite(db, before.careerId, before.playerId, source.caseId, after.revision); return saved.after;
      });
    },
    readCase(sourceId) { check(sourceId); return caseHistory(db, sourceId)?.snapshot ?? null; }, readEffect,
    readHead(careerId, playerId) { check(careerId, playerId); const pointer = playerPointer(db, careerId, playerId);
      if (!pointer) {
        if (db.prepare('SELECT 1 FROM world_health_rehab_cases WHERE career_id=? AND player_id=?').get(careerId, playerId)) throw new Error('clinical Player head is missing');
        return null;
      }
      const history = caseHistory(db, pointer.case_id);
      if (!history || history.current.careerId !== careerId || history.current.playerId !== playerId || pointer.case_ordinal !== history.snapshot.caseOrdinal) throw new Error('clinical Player head diverged');
      return history.current; },
    createAvailabilityAction(input): LegalRosterActionBinding {
      check(input.careerId, input.clubId, input.caseId, input.actionId);
      if (!fields(input, ['careerId', 'clubId', 'caseId', 'caseRevision', 'actionId', 'expectedRosterRevision', 'effectiveDay'])
        || !day(input.expectedRosterRevision) || !day(input.effectiveDay)) throw new Error('invalid medical roster projection');
      const history = caseHistory(db, input.caseId);
      if (!history) throw new Error('accepted clinical case is missing');
      const current = readHealthAvailabilityFromSqlite(db, input.careerId, history.current.playerId, input.caseId, input.caseRevision);
      const head = sources.roster.readHead(input.careerId, input.clubId), player = head?.roster.players.find((p) => p.playerId === current.state.playerId);
      if (!head || head.careerId !== input.careerId || head.clubId !== input.clubId || head.roster.revision !== input.expectedRosterRevision
        || input.effectiveDay < current.state.effectiveDay || input.effectiveDay < head.roster.effectiveDay || !player
        || (player.assignment?.clubId ?? player.clubRights.rightsHolderClubId) !== input.clubId) throw new Error('actual medical roster projection scope differs');
      const binding: LegalRosterActionBinding = { actionId: input.actionId,
        medicalSource: { caseId: input.caseId, caseRevision: input.caseRevision, evidenceId: current.availability.evidenceId },
        command: { commandId: input.actionId, expectedRevision: input.expectedRosterRevision, effectiveDay: input.effectiveDay,
          changes: [{ playerId: current.state.playerId, availability: current.availability }] } };
      assertCurrentMedicalRosterAction(db, input.careerId, binding); return freeze(binding);
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
