import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { evaluateRosterParticipation } from '../../core/world/roster/RosterQueries';
import type { PlayerHealthDiagnosis, HealthRehabEvidence } from '../../core/world/development/PlayerHealthRehab';
import { isAcceptedPlayerIntakeSource, type DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import { assertArchivedPlayerWorkloadActivity, type DurablePlayerWorkloadActivity } from './SqlitePlayerWorkloadRecoveryStore';
import { readGlobalRosterSnapshotFromSqlite, type AcceptedNationalRosterSnapshot } from './SqliteNationalRosterSnapshotStore';
import type { DurableParticipationReceipt } from './SqliteOfficialParticipationStore';
import type { PersistOfficialPlayResult, PersistOfficialFinalResult } from '../SqliteOfficialStateStore';
import type { AcceptedHealthRehabEffect } from './SqlitePlayerHealthRehabStore';

type Db = Pick<DatabaseSync, 'prepare'>;
export const clinicalJson = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
export const clinicalHash = (value: unknown): string => createHash('sha256').update(clinicalJson(value)).digest('hex');
// SQL row strings may contain the full large global Roster checkpoint; retain only their digest.
const rowHash = (value: object): string => createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))).digest('hex');
export const clinicalFreeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(clinicalFreeze); Object.freeze(value); } return value; };
export const readClinicalPersonLink = (db: Db, sourceId: string): DurablePlayerPersonLink => {
  const row = db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').get(sourceId) as {
    source_id: string; career_id: string; player_id: string; person_id: string; roster_revision: number; accepted_at_day: number; source_json: string;
  } | undefined;
  const value = row ? JSON.parse(row.source_json) as DurablePlayerPersonLink : null;
  if (!row || !isAcceptedPlayerIntakeSource(value, sourceId) || clinicalJson(value) !== row.source_json || row.source_id !== value.sourceId
    || row.career_id !== value.careerId || row.player_id !== value.playerId || row.person_id !== value.personId
    || row.roster_revision !== value.rosterRevision || row.accepted_at_day !== value.acceptedAtDay) throw new Error('clinical Person Source differs');
  return clinicalFreeze(value);
};

export const captureClinicalWorkloadRows = (db: Db, diagnosis: PlayerHealthDiagnosis, activityId: string): readonly string[] => {
  const row = db.prepare('SELECT * FROM world_player_workload_activities WHERE source_id=?').get(activityId) as {
    career_id: string; player_id: string; after_revision: number;
  } | undefined;
  const baseline = db.prepare('SELECT * FROM world_player_workload_baselines WHERE career_id=? AND player_id=?')
    .get(diagnosis.careerId, diagnosis.playerId) as { source_json: string } | undefined;
  if (!row || row.career_id !== diagnosis.careerId || row.player_id !== diagnosis.playerId || !baseline) throw new Error('clinical actual workload is missing');
  const input = JSON.parse(baseline.source_json) as { personLinkSourceId: string; policy: { policyId: string; version: string } };
  const policy = db.prepare('SELECT * FROM world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?')
    .get(diagnosis.careerId, input.policy.policyId, input.policy.version);
  const person = db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?').get(input.personLinkSourceId);
  if (!policy || !person) throw new Error('clinical workload provenance is missing');
  const prefix = db.prepare('SELECT * FROM world_player_workload_activities WHERE career_id=? AND player_id=? AND after_revision<=? ORDER BY after_revision')
    .all(diagnosis.careerId, diagnosis.playerId, row.after_revision);
  return [baseline, policy, person, ...prefix].map(rowHash);
};
export type RehabRosterProof = Readonly<{
  snapshotId: string; careerId: string; revision: number; effectiveDay: number;
  player: AcceptedNationalRosterSnapshot['roster']['players'][number];
  unit: AcceptedNationalRosterSnapshot['roster']['units'][number];
  profile: AcceptedNationalRosterSnapshot['roster']['profiles'][number];
}>;
export const projectRehabRosterProof = (snapshot: AcceptedNationalRosterSnapshot, receipt: DurableParticipationReceipt): RehabRosterProof => {
  const b = receipt.binding, player = snapshot.roster.players.find((p) => p.playerId === b.playerId);
  const unit = snapshot.roster.units.find((u) => u.unitId === player?.assignment?.unitId);
  const profile = snapshot.roster.profiles.find((p) => p.competitionEditionId === b.competitionEditionId);
  if (snapshot.careerId !== b.careerId || snapshot.revision !== b.rosterRevision || snapshot.effectiveDay > b.gameDay || !player || !unit || !profile
    || player.availability.status !== 'REHAB' || !profile.rehabParticipationAllowed
    || !evaluateRosterParticipation(snapshot.roster, { playerId: b.playerId, clubId: b.clubId, competitionEditionId: b.competitionEditionId }).eligible) {
    throw new Error('actual pregame REHAB roster evidence is missing or differs');
  }
  return clinicalFreeze({ snapshotId: snapshot.snapshotId, careerId: snapshot.careerId, revision: snapshot.revision,
    effectiveDay: snapshot.effectiveDay, player, unit, profile });
};
const ownReceipt = (db: Db, receiptId: string): DurableParticipationReceipt => {
  const row = db.prepare('SELECT * FROM official_participation_receipts WHERE receipt_id=?').get(receiptId) as {
    receipt_id: string; game_id: string; player_id: string; receipt_json: string;
  } | undefined;
  if (!row) throw new Error('actual played rehabilitation receipt is missing');
  const receipt = JSON.parse(row.receipt_json) as DurableParticipationReceipt, b = receipt.binding;
  const binding = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?')
    .get(b.gameId, b.playerId) as { binding_json: string } | undefined;
  const fixture = db.prepare('SELECT fixture_event_id FROM official_fixtures WHERE game_id=?')
    .get(b.gameId) as { fixture_event_id: string } | undefined;
  const applications = [receipt.activationApplicationId, receipt.closureApplicationId].map((id) => db.prepare('SELECT match_id, result_json FROM applications WHERE application_id=?')
    .get(id) as { match_id: string; result_json: string } | undefined);
  if (receipt.receiptId !== receiptId || row.receipt_id !== receiptId || row.game_id !== b.gameId || row.player_id !== b.playerId
    || !binding || clinicalJson(JSON.parse(binding.binding_json)) !== clinicalJson(b) || fixture?.fixture_event_id !== b.fixtureEventId
    || applications.some((a) => !a || a.match_id !== b.gameId) || !['DEFENDER', 'RUNNER'].includes(receipt.actorKind)) throw new Error('rehabilitation actor proof scope differs');
  const first = JSON.parse(applications[0]!.result_json) as PersistOfficialPlayResult;
  const second = JSON.parse(applications[1]!.result_json) as PersistOfficialPlayResult | PersistOfficialFinalResult;
  const side = first.activation?.nextMatchState.half === 'top' ? 'HOME' : 'AWAY';
  const actors = receipt.actorKind === 'DEFENDER' ? first.nextWorld?.defenders : first.nextWorld?.runners;
  if (receipt.activationApplicationId === receipt.closureApplicationId || first.receipt.applicationId !== receipt.activationApplicationId
    || first.activation?.applicationId !== receipt.activationApplicationId || first.activation.durableRevision !== first.receipt.durableRevision
    || first.activation.nextMatchState.playId !== receipt.playedPlayId || second.receipt.applicationId !== receipt.closureApplicationId
    || second.receipt.previousPlayId !== receipt.playedPlayId || second.receipt.durableRevision !== first.receipt.durableRevision + 1
    || second.receipt.durableRevision !== receipt.durableRevision || (receipt.actorKind === 'DEFENDER' ? side : side === 'HOME' ? 'AWAY' : 'HOME') !== b.side
    || actors?.filter((actor) => actor.playerId === b.playerId).length !== 1) throw new Error('rehabilitation played actor chain differs');
  return receipt;
};
export const captureClinicalGameRows = (db: Db, diagnosis: PlayerHealthDiagnosis, receiptId: string, snapshotId: string): readonly string[] => {
  const receipt = ownReceipt(db, receiptId), b = receipt.binding;
  if (b.careerId !== diagnosis.careerId || b.playerId !== diagnosis.playerId) throw new Error('clinical played actor scope differs');
  const queries = [db.prepare('SELECT * FROM official_participation_receipts WHERE receipt_id=?').get(receiptId),
    db.prepare('SELECT * FROM official_participant_bindings WHERE game_id=? AND player_id=?').get(b.gameId, b.playerId),
    db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(b.gameId),
    db.prepare('SELECT * FROM world_national_roster_snapshots WHERE career_id=? AND snapshot_id=?').get(b.careerId, snapshotId),
    ...[receipt.activationApplicationId, receipt.closureApplicationId].map((id) => db.prepare('SELECT * FROM applications WHERE application_id=?').get(id))];
  if (queries.some((row) => !row)) throw new Error('clinical played original evidence is missing');
  return queries.map((row) => rowHash(row!));
};
export type ClinicalEffectProof = Readonly<{ workload: DurablePlayerWorkloadActivity; rows: readonly string[] }>
  | Readonly<{ receipt: DurableParticipationReceipt; roster: RehabRosterProof; rows: readonly string[] }>;

/** Re-read and verify original facts on the owning consumer connection, not a stale peer snapshot. */
export const deriveClinicalEffectEvidence = (db: Db, source: AcceptedHealthRehabEffect,
  diagnosis: PlayerHealthDiagnosis, patient: DurablePlayerPersonLink, proof: ClinicalEffectProof): HealthRehabEvidence => {
  const expectedKeys = source.kind === 'REHAB_GAME' ? ['receipt', 'roster', 'rows'] : ['workload', 'rows'];
  if (!proof || Object.keys(proof).sort().join('|') !== expectedKeys.sort().join('|')) throw new Error('clinical proof fields differ');
  const common = { sourceId: source.sourceId, sourceVersion: source.sourceVersion, caseId: diagnosis.caseId,
    careerId: diagnosis.careerId, playerId: diagnosis.playerId };
  if (source.kind !== 'REHAB_GAME') {
    if (!('workload' in proof) || proof.workload.activity.sourceEventId !== source.workloadActivityId
      || proof.workload.activity.careerId !== diagnosis.careerId || proof.workload.activity.playerId !== diagnosis.playerId
      || clinicalJson(captureClinicalWorkloadRows(db, diagnosis, source.workloadActivityId)) !== clinicalJson(proof.rows)) throw new Error('clinical original workload Source changed');
    assertArchivedPlayerWorkloadActivity(db, proof.workload);
    const { activity, before } = proof.workload;
    if (source.kind === 'MEDICAL_RECOVERY' && activity.kind === 'RECOVERY') return { ...common, kind: source.kind, atDay: activity.atDay,
      workloadActivityId: activity.sourceEventId, durationHours: activity.durationHours, quality: activity.quality,
      medicalAvailability: activity.medicalAvailability, recoveryCapacity: before.recoveryCapacity };
    if (source.kind === 'REHAB_PRACTICE' && activity.kind === 'PRACTICE') return { ...common, kind: source.kind, atDay: activity.atDay,
      workloadActivityId: activity.sourceEventId, effortUnits: activity.effortUnits, beforeFatigue: before.fatigue, healthAvailability: activity.healthAvailability };
    throw new Error('clinical workload kind differs');
  }
  if (!('receipt' in proof) || proof.receipt.receiptId !== source.participationReceiptId || proof.roster.snapshotId !== source.rosterSnapshotId
    || clinicalJson(captureClinicalGameRows(db, diagnosis, source.participationReceiptId, source.rosterSnapshotId)) !== clinicalJson(proof.rows)) {
    throw new Error('clinical original game evidence changed');
  }
  const receipt = ownReceipt(db, source.participationReceiptId), b = receipt.binding;
  const snapshot = readGlobalRosterSnapshotFromSqlite(db, diagnosis.careerId, source.rosterSnapshotId);
  if (clinicalJson(receipt) !== clinicalJson(proof.receipt) || b.personId !== patient.personId || b.personLinkSourceId !== patient.sourceId
    || !snapshot || clinicalJson(projectRehabRosterProof(snapshot, receipt)) !== clinicalJson(proof.roster)) throw new Error('clinical pregame played proof differs');
  return { ...common, kind: source.kind, atDay: b.gameDay, gameId: b.gameId,
    participationReceiptId: receipt.receiptId, rosterSnapshotId: snapshot.snapshotId };
};
